import {
  asCardId,
  CENTER_CARD_COUNT,
  GAME_PHASES,
  type CardId,
  type CenterSlot,
  type PlayerId,
  type RoleId,
} from "@sabha/protocol";
import { invariant } from "./errors";
import { secureShuffle, type RandomSource } from "./random";
import type { ActionContext, CardLocation, CardState, InternalGameState } from "./types";

export interface DealResult {
  playerCards: RoleId[];
  centerCards: RoleId[];
}

export function dealRoles(roles: RoleId[], players: PlayerId[], rng: RandomSource): DealResult {
  invariant(roles.length === players.length + CENTER_CARD_COUNT, "deck must hold playerCount + 3 cards");
  const shuffled = secureShuffle(roles, rng);
  return {
    playerCards: shuffled.slice(0, players.length),
    centerCards: shuffled.slice(players.length),
  };
}

/** Materialise a deal into card objects with unique ids. */
export function placeCards(
  state: InternalGameState,
  players: PlayerId[],
  deal: DealResult,
): void {
  const cards: Record<CardId, CardState> = {};
  let n = 0;
  const nextId = () => asCardId(`r${state.round}-c${++n}`);

  players.forEach((playerId, i) => {
    const id = nextId();
    const location: CardLocation = { type: "PLAYER", playerId };
    cards[id] = { id, roleId: deal.playerCards[i], startingLocation: location, currentLocation: location };
    state.players[playerId].startingCardId = id;
  });

  const center = deal.centerCards.map((roleId, i) => {
    const id = nextId();
    const location: CardLocation = { type: "CENTER", slot: i as CenterSlot };
    cards[id] = { id, roleId, startingLocation: location, currentLocation: location };
    return id;
  });

  state.cards = cards;
  state.center = center as [CardId, CardId, CardId];
}

export function sameLocation(a: CardLocation, b: CardLocation): boolean {
  if (a.type === "PLAYER" && b.type === "PLAYER") return a.playerId === b.playerId;
  if (a.type === "CENTER" && b.type === "CENTER") return a.slot === b.slot;
  return false;
}

export function currentCardOf(state: InternalGameState, playerId: PlayerId): CardState {
  const card = Object.values(state.cards).find(
    (c) => c.currentLocation.type === "PLAYER" && c.currentLocation.playerId === playerId,
  );
  invariant(card, `player ${playerId} holds no card`);
  return card;
}

export function currentRoleIdOf(state: InternalGameState, playerId: PlayerId): RoleId {
  return currentCardOf(state, playerId).roleId;
}

export function startingRoleIdOf(state: InternalGameState, playerId: PlayerId): RoleId | undefined {
  const cardId = state.players[playerId]?.startingCardId;
  return cardId ? state.cards[cardId]?.roleId : undefined;
}

export function centerCard(state: InternalGameState, slot: CenterSlot): CardState {
  const card = Object.values(state.cards).find(
    (c) => c.currentLocation.type === "CENTER" && c.currentLocation.slot === slot,
  );
  invariant(card, `centre slot ${slot} is empty`);
  return card;
}

/** Players currently holding a given role (usually zero or one). */
export function holdersOf(state: InternalGameState, role: RoleId): PlayerId[] {
  return Object.values(state.cards)
    .filter((c) => c.roleId === role && c.currentLocation.type === "PLAYER")
    .map((c) => (c.currentLocation as { playerId: PlayerId }).playerId);
}

export function startingHoldersOf(state: InternalGameState, role: RoleId): PlayerId[] {
  return Object.values(state.cards)
    .filter((c) => c.roleId === role && c.startingLocation.type === "PLAYER")
    .map((c) => (c.startingLocation as { playerId: PlayerId }).playerId);
}

/**
 * Move a card. Every move that changes a location counts towards Sanjaya's
 * movement tally while the night is running.
 */
export function moveCard(state: InternalGameState, cardId: CardId, destination: CardLocation): void {
  const card = state.cards[cardId];
  invariant(card, `unknown card ${cardId}`);
  if (sameLocation(card.currentLocation, destination)) return;
  card.currentLocation = destination;
  if (state.night && !state.night.completed) state.night.movementCount += 1;
  if (destination.type === "CENTER" && state.center) state.center[destination.slot] = cardId;
}

/**
 * The single swap routine used by every swapping role. Returns false when
 * Bhishma's protection blocks the swap.
 */
export function swapPlayerCards(ctx: ActionContext, a: PlayerId, b: PlayerId): boolean {
  if (ctx.isProtected(a) || ctx.isProtected(b)) {
    return false;
  }

  const cardA = ctx.currentCardOf(a);
  const cardB = ctx.currentCardOf(b);

  ctx.moveCard(cardA.id, { type: "PLAYER", playerId: b });
  ctx.moveCard(cardB.id, { type: "PLAYER", playerId: a });
  return true;
}

// ---------------------------------------------------------------------------
// Invariants (spec §85)
// ---------------------------------------------------------------------------

export function assertInvariants(state: InternalGameState): void {
  invariant(GAME_PHASES.includes(state.phase), `invalid phase ${state.phase}`);

  const dealt = state.phase !== "LOBBY" && Object.keys(state.cards).length > 0;
  if (!dealt) return;

  const playerIds = Object.keys(state.players) as PlayerId[];
  const cards = Object.values(state.cards);

  // every card exists exactly once, with exactly one location
  const ids = new Set(cards.map((c) => c.id));
  invariant(ids.size === cards.length, "duplicate card ids");
  invariant(cards.length === playerIds.length + CENTER_CARD_COUNT, "totalCards must equal playerCount + 3");

  const occupancy = new Map<string, number>();
  for (const card of cards) {
    const key =
      card.currentLocation.type === "PLAYER"
        ? `P:${card.currentLocation.playerId}`
        : `C:${card.currentLocation.slot}`;
    occupancy.set(key, (occupancy.get(key) ?? 0) + 1);
    if (card.currentLocation.type === "PLAYER") {
      invariant(state.players[card.currentLocation.playerId], `card ${card.id} held by unknown player`);
    }
  }

  // every player has exactly one card
  for (const pid of playerIds) {
    invariant(occupancy.get(`P:${pid}`) === 1, `player ${pid} must hold exactly one card`);
  }

  // centre has exactly three cards, one per slot
  for (const slot of [0, 1, 2]) {
    invariant(occupancy.get(`C:${slot}`) === 1, `centre slot ${slot} must hold exactly one card`);
  }
  invariant(
    [...occupancy.values()].every((n) => n === 1),
    "a location holds more than one card",
  );

  // the deck matches the dealt cards
  const deck = [...state.deck].sort().join(",");
  const dealtRoles = cards.map((c) => c.roleId).sort().join(",");
  invariant(deck === dealtRoles, "dealt cards do not match the deck");
}
