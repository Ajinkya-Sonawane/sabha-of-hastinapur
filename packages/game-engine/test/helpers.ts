import { asGameId, asPlayerId, type NightActionInput, type PlayerId, type RoleId } from "@sabha/protocol";
import {
  currentRoleIdOf,
  GameEngine,
  SeededRandomSource,
  type EngineCommand,
  type InternalGameState,
} from "../src";

export const NAMES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];

export interface Harness {
  engine: GameEngine;
  state: InternalGameState;
  now: number;
  ids: PlayerId[];
  byName: Record<string, PlayerId>;
  apply(command: EngineCommand): InternalGameState;
  act(name: string, input: NightActionInput): void;
  role(name: string): RoleId;
  initialRole(name: string): RoleId;
  knowledge(name: string): InternalGameState["players"][PlayerId]["knownInformation"];
  advance(ms: number): void;
  confirmAll(): void;
  toVoting(): void;
  vote(from: string, to: string): void;
  skipNight(): void;
}

/**
 * Deal `playerRoles` to players A, B, C… in seat order and `center` to the
 * centre, then move to ROLE_REVEAL.
 */
export function setup(playerRoles: RoleId[], center: RoleId[] = defaultCenter(playerRoles)): Harness {
  const engine = new GameEngine({
    rng: new SeededRandomSource(42),
    dealOverride: () => ({ playerCards: playerRoles, centerCards: center }),
  });
  const ids = playerRoles.map((_, i) => asPlayerId(`p-${NAMES[i]}`));
  const byName = Object.fromEntries(ids.map((id, i) => [NAMES[i], id]));
  let now = 1_000_000;
  let state = engine.createGame(
    {
      gameId: asGameId("game-1"),
      roomCode: "KURU42",
      mode: "BEGINNER",
      capacity: Math.max(5, playerRoles.length),
      host: { id: ids[0], displayName: "Player A", sessionId: "s-A" },
    },
    now,
  );
  const h: Harness = {
    engine,
    get state() {
      return state;
    },
    set state(s) {
      state = s;
    },
    get now() {
      return now;
    },
    ids,
    byName,
    apply(command) {
      state = engine.apply(state, command, now);
      return state;
    },
    act(name, input) {
      h.apply({ type: "NIGHT_ACTION", playerId: byName[name], input });
    },
    role: (name) => currentRoleIdOf(state, byName[name]),
    initialRole: (name) => playerRoles[NAMES.indexOf(name)],
    knowledge: (name) => state.players[byName[name]].knownInformation,
    advance(ms) {
      now += ms;
      h.apply({ type: "TICK" });
    },
    confirmAll() {
      for (const id of ids) h.apply({ type: "CONFIRM_ROLE", playerId: id });
    },
    toVoting() {
      if (state.phase === "DISCUSSION") h.apply({ type: "END_DISCUSSION", playerId: ids[0] });
    },
    vote(from, to) {
      h.apply({ type: "CAST_VOTE", playerId: byName[from], targetId: byName[to] });
    },
    skipNight() {
      while (state.phase === "NIGHT") h.advance(31_000);
    },
  };
  for (let i = 1; i < ids.length; i++) {
    h.apply({ type: "ADD_PLAYER", player: { id: ids[i], displayName: `Player ${NAMES[i]}`, sessionId: `s-${NAMES[i]}` } });
  }
  for (const id of ids) h.apply({ type: "SET_CONNECTED", playerId: id, connected: true });
  h.apply({ type: "START_GAME", playerId: ids[0] });
  return h;
}

const FILLER: RoleId[] = ["VIDURA", "DRONA", "DRAUPADI", "BHIMA", "YUDHISHTHIRA", "DUSHASANA", "SANJAYA", "ARJUNA"];

function defaultCenter(playerRoles: RoleId[]): RoleId[] {
  return FILLER.filter((r) => !playerRoles.includes(r)).slice(0, 3);
}

/** Everyone in `names` votes for `target`; others vote for `fallback`. */
export function voteAll(h: Harness, votes: Record<string, string>) {
  for (const [from, to] of Object.entries(votes)) h.vote(from, to);
}
