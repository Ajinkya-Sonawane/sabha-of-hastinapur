import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type GameId,
  type GameMode,
  type NightActionInput,
  type PlayerId,
  type PrivatePlayerView,
  type PublicGameView,
  type RoleId,
} from "@sabha/protocol";
import { assertInvariants, dealRoles, placeCards, startingHoldersOf, startingRoleIdOf, type DealResult } from "./CardEngine";
import { EliminationEngine } from "./EliminationEngine";
import { GameError } from "./errors";
import { recordEvent } from "./events";
import { NightEngine, seatOrder } from "./NightEngine";
import { getRolePack, validatePack } from "./packs";
import { CryptoRandomSource, type RandomSource } from "./random";
import { getRole } from "./roles/registry";
import { DEFAULT_TIMERS, type GameTimers, type InternalGameState, type InternalPlayerState } from "./types";
import { VictoryEngine } from "./VictoryEngine";
import { buildVote, tallyVotes } from "./VotingEngine";
import { toPrivateView, toPublicView } from "./views";

export interface NewPlayer {
  id: PlayerId;
  displayName: string;
  sessionId: string;
}

export interface CreateGameInput {
  gameId: GameId;
  roomCode: string;
  mode: GameMode;
  capacity: number;
  host: NewPlayer;
}

export type EngineCommand =
  | { type: "ADD_PLAYER"; player: NewPlayer }
  | { type: "LEAVE"; playerId: PlayerId }
  | { type: "SET_CONNECTED"; playerId: PlayerId; connected: boolean }
  | { type: "SET_READY"; playerId: PlayerId; ready: boolean }
  | { type: "START_GAME"; playerId: PlayerId }
  | { type: "CONFIRM_ROLE"; playerId: PlayerId }
  | { type: "NIGHT_ACTION"; playerId: PlayerId; input: NightActionInput }
  | { type: "END_DISCUSSION"; playerId: PlayerId }
  | { type: "CAST_VOTE"; playerId: PlayerId; targetId: PlayerId }
  | { type: "SPECIAL_ELIMINATION"; playerId: PlayerId; targetId: PlayerId }
  | { type: "REMATCH"; playerId: PlayerId }
  | { type: "TICK" };

export interface GameEngineOptions {
  timers?: Partial<GameTimers>;
  rng?: RandomSource;
  /** Test hook: force the deal instead of shuffling. Not reachable from the protocol. */
  dealOverride?: (state: InternalGameState) => DealResult | undefined;
}

/**
 * Pure, synchronous game reducer. `apply` never mutates its input: it works
 * on a clone and returns the next state, or throws a GameError.
 */
export class GameEngine {
  readonly timers: GameTimers;
  readonly night: NightEngine;
  readonly elimination: EliminationEngine;
  readonly victory = new VictoryEngine();
  private readonly rng: RandomSource;
  private readonly dealOverride?: GameEngineOptions["dealOverride"];

  constructor(options: GameEngineOptions = {}) {
    this.timers = { ...DEFAULT_TIMERS, ...options.timers };
    this.rng = options.rng ?? new CryptoRandomSource();
    this.dealOverride = options.dealOverride;
    this.night = new NightEngine(this.timers);
    this.elimination = new EliminationEngine(this.timers);
  }

  createGame(input: CreateGameInput, now: number): InternalGameState {
    if (!Number.isInteger(input.capacity) || input.capacity < MIN_PLAYERS || input.capacity > MAX_PLAYERS) {
      throw new GameError("INVALID_REQUEST", "Choose between 5 and 10 players.");
    }
    getRolePack(input.mode, MIN_PLAYERS); // validates mode
    const state: InternalGameState = {
      gameId: input.gameId,
      roomCode: input.roomCode,
      phase: "LOBBY",
      mode: input.mode,
      capacity: input.capacity,
      round: 1,
      hostPlayerId: input.host.id,
      players: {},
      cards: {},
      center: null,
      deck: [],
      timer: null,
      night: null,
      voting: null,
      elimination: null,
      results: null,
      events: [],
      stateVersion: 0,
      createdAt: now,
      updatedAt: now,
    };
    recordEvent(state, "GAME_CREATED", input.host.id, { mode: input.mode, capacity: input.capacity }, now);
    this.addPlayer(state, input.host, now);
    return state;
  }

  apply(previous: InternalGameState, command: EngineCommand, now: number): InternalGameState {
    const state = structuredClone(previous);
    this.mutate(state, command, now);
    this.settle(state, now);
    assertInvariants(state);
    state.stateVersion = previous.stateVersion + 1;
    state.updatedAt = now;
    return state;
  }

  /** Earliest moment at which `TICK` would change something. */
  nextDeadline(state: InternalGameState): number | null {
    switch (state.phase) {
      case "LOBBY": {
        const grace = this.timers.LOBBY_GRACE * 1000;
        const times = Object.values(state.players)
          .filter((p) => !p.connected)
          .map((p) => p.lastSeenAt + grace);
        return times.length ? Math.min(...times) : null;
      }
      case "ROLE_REVEAL":
      case "DISCUSSION":
      case "VOTING":
        return state.timer?.deadline ?? null;
      case "NIGHT":
        return state.night && !state.night.completed ? state.night.deadline : null;
      case "RESOLUTION":
        return this.elimination.nextDeadline(state);
      default:
        return null;
    }
  }

  publicView(state: InternalGameState): PublicGameView {
    return toPublicView(state);
  }

  privateView(state: InternalGameState, playerId: PlayerId, now: number): PrivatePlayerView {
    return toPrivateView(this, state, playerId, now);
  }

  // -------------------------------------------------------------------------

  private mutate(state: InternalGameState, command: EngineCommand, now: number): void {
    switch (command.type) {
      case "ADD_PLAYER":
        return this.addPlayer(state, command.player, now);
      case "LEAVE":
        return this.leave(state, command.playerId, now);
      case "SET_CONNECTED": {
        const player = this.player(state, command.playerId);
        player.connected = command.connected;
        player.lastSeenAt = now;
        if (command.connected) player.left = false;
        return;
      }
      case "SET_READY":
        this.requirePhase(state, "LOBBY");
        this.player(state, command.playerId).ready = command.ready;
        return;
      case "START_GAME":
        return this.startGame(state, command.playerId, now);
      case "CONFIRM_ROLE": {
        this.requirePhase(state, "ROLE_REVEAL");
        const player = this.player(state, command.playerId);
        if (player.roleConfirmed) return;
        player.roleConfirmed = true;
        recordEvent(state, "ROLE_CONFIRMED", player.id, {}, now);
        if (Object.values(state.players).every((p) => p.roleConfirmed)) this.beginNight(state, now);
        return;
      }
      case "NIGHT_ACTION": {
        this.requirePhase(state, "NIGHT");
        this.player(state, command.playerId);
        const verdict = this.night.validateAction(state, command.playerId, command.input, now);
        if (!verdict.ok) throw new GameError(verdict.code ?? "INVALID_REQUEST", verdict.message);
        this.night.resolveAction(state, command.playerId, command.input, now);
        return;
      }
      case "END_DISCUSSION":
        this.requirePhase(state, "DISCUSSION");
        this.requireHost(state, command.playerId);
        return this.beginVoting(state, now);
      case "CAST_VOTE":
        return this.castVote(state, command.playerId, command.targetId, now);
      case "SPECIAL_ELIMINATION":
        this.requirePhase(state, "RESOLUTION");
        this.player(state, command.playerId);
        this.elimination.submitChoice(state, command.playerId, command.targetId, now);
        return;
      case "REMATCH":
        this.requirePhase(state, "RESULTS");
        this.requireHost(state, command.playerId);
        return this.rematch(state, now);
      case "TICK":
        return this.tick(state, now);
    }
  }

  /** Follow-on transitions that happen automatically once a phase's work is done. */
  private settle(state: InternalGameState, now: number): void {
    if (state.phase === "NIGHT" && state.night?.completed) this.beginDiscussion(state, now);
    if (state.phase === "RESOLUTION" && this.elimination.isComplete(state)) this.finish(state, now);
  }

  private tick(state: InternalGameState, now: number): void {
    switch (state.phase) {
      case "LOBBY": {
        const grace = this.timers.LOBBY_GRACE * 1000;
        for (const p of Object.values(state.players)) {
          if (!p.connected && p.lastSeenAt + grace <= now) this.leave(state, p.id, now);
        }
        return;
      }
      case "ROLE_REVEAL":
        if (state.timer && state.timer.deadline <= now) this.beginNight(state, now);
        return;
      case "NIGHT":
        if (state.night && !state.night.completed && state.night.deadline <= now) this.night.timeoutStep(state, now);
        return;
      case "DISCUSSION":
        if (state.timer && state.timer.deadline <= now) this.beginVoting(state, now);
        return;
      case "VOTING":
        if (state.timer && state.timer.deadline <= now) this.closeVoting(state, now);
        return;
      case "RESOLUTION":
        this.elimination.timeout(state, now);
        return;
      default:
        return;
    }
  }

  private addPlayer(state: InternalGameState, input: NewPlayer, now: number): void {
    if (state.phase !== "LOBBY") throw new GameError("GAME_ALREADY_STARTED");
    const players = Object.values(state.players);
    if (players.length >= state.capacity) throw new GameError("GAME_FULL");
    if (state.players[input.id]) throw new GameError("INVALID_REQUEST");
    const name = input.displayName.trim();
    if (name.length < 2 || name.length > 20) throw new GameError("INVALID_REQUEST", "Names must be 2-20 characters.");
    if (players.some((p) => p.displayName.toLocaleLowerCase() === name.toLocaleLowerCase())) {
      throw new GameError("NAME_TAKEN");
    }
    const taken = new Set(players.map((p) => p.seat));
    let seat = 1;
    while (taken.has(seat)) seat++;
    const player: InternalPlayerState = {
      id: input.id,
      displayName: name,
      seat,
      connected: false,
      lastSeenAt: now,
      ready: false,
      left: false,
      sessionId: input.sessionId,
      startingCardId: null,
      roleConfirmed: false,
      eliminated: false,
      nightActionSubmitted: false,
      knownInformation: [],
    };
    state.players[input.id] = player;
    recordEvent(state, "PLAYER_JOINED", input.id, { seat }, now);
  }

  private leave(state: InternalGameState, playerId: PlayerId, now: number): void {
    const player = this.player(state, playerId);
    if (state.phase === "LOBBY") {
      delete state.players[playerId];
    } else {
      player.left = true;
      player.connected = false;
      player.lastSeenAt = now;
    }
    recordEvent(state, "PLAYER_LEFT", playerId, {}, now);
    if (state.hostPlayerId === playerId) {
      const next = seatOrder(state).find((pid) => pid !== playerId && !state.players[pid].left && state.players[pid].connected)
        ?? seatOrder(state).find((pid) => pid !== playerId && !state.players[pid].left);
      if (next) {
        state.hostPlayerId = next;
        recordEvent(state, "HOST_CHANGED", next, {}, now);
      }
    }
    if (Object.keys(state.players).length === 0) state.phase = "ENDED";
  }

  startCheck(state: InternalGameState): { ok: boolean; reason?: string } {
    const players = Object.values(state.players);
    if (players.length < MIN_PLAYERS) return { ok: false, reason: `Waiting for ${MIN_PLAYERS - players.length} more player(s).` };
    if (players.some((p) => !p.connected)) return { ok: false, reason: "Waiting for everyone to reconnect." };
    return { ok: true };
  }

  private startGame(state: InternalGameState, playerId: PlayerId, now: number): void {
    this.requireHost(state, playerId);
    if (state.phase !== "LOBBY") throw new GameError("GAME_ALREADY_STARTED");
    const check = this.startCheck(state);
    if (!check.ok) throw new GameError("NOT_ENOUGH_PLAYERS", check.reason);

    const players = seatOrder(state);
    const pack = getRolePack(state.mode, players.length);
    validatePack(pack);
    state.deck = [...pack.roles];

    const override = this.dealOverride?.(state);
    if (override) state.deck = [...override.playerCards, ...override.centerCards];
    const deal = override ?? dealRoles(pack.roles, players, this.rng);
    placeCards(state, players, deal);
    recordEvent(state, "GAME_STARTED", playerId, { playerCount: players.length, pack: pack.id }, now);
    recordEvent(state, "CARDS_DEALT", undefined, {
      players: Object.fromEntries(players.map((pid) => [pid, startingRoleIdOf(state, pid)])),
      center: deal.centerCards,
    }, now);

    for (const p of Object.values(state.players)) {
      p.roleConfirmed = false;
      p.eliminated = false;
      p.knownInformation = [];
      p.voteTarget = undefined;
      p.specialVote = undefined;
      p.nightActionSubmitted = false;
    }
    this.grantStartingKnowledge(state, now);

    state.phase = "ROLE_REVEAL";
    state.timer = { phase: "ROLE_REVEAL", startedAt: now, deadline: now + this.timers.ROLE_REVEAL * 1000 };
  }

  private grantStartingKnowledge(state: InternalGameState, now: number): void {
    for (const pid of seatOrder(state)) {
      const role = getRole(startingRoleIdOf(state, pid)!);
      for (const rule of role.startingKnowledge) {
        if (rule.type !== "SEE_STARTING_ROLES") continue;
        const seen: { playerId: PlayerId; role: RoleId }[] = [];
        for (const r of rule.roles) {
          for (const holder of startingHoldersOf(state, r)) {
            if (holder !== pid) seen.push({ playerId: holder, role: r });
          }
        }
        for (const s of seen) {
          state.players[pid].knownInformation.push({ kind: "ROLE", playerId: s.playerId, role: s.role, source: role.id, observedAt: now });
        }
        if (seen.length === 0) {
          const lookingForDuryodhana = rule.roles.length === 1 && rule.roles[0] === "DURYODHANA";
          state.players[pid].knownInformation.push(
            lookingForDuryodhana
              ? { kind: "NOTIFICATION", code: "DURYODHANA_ABSENT", message: "Duryodhana does not sit in the Sabha tonight.", source: role.id, observedAt: now }
              : { kind: "NOTIFICATION", code: "NO_OTHER_CONSPIRATORS", message: "You stand alone. No other conspirator sits in the Sabha.", source: role.id, observedAt: now },
          );
        }
      }
    }
  }

  private beginNight(state: InternalGameState, now: number): void {
    state.phase = "NIGHT";
    state.timer = null; // the night's rhythm is private
    this.night.start(state, now);
  }

  private beginDiscussion(state: InternalGameState, now: number): void {
    state.phase = "DISCUSSION";
    state.timer = { phase: "DISCUSSION", startedAt: now, deadline: now + this.timers.DISCUSSION * 1000 };
    recordEvent(state, "DISCUSSION_STARTED", undefined, {}, now);
  }

  private beginVoting(state: InternalGameState, now: number): void {
    state.phase = "VOTING";
    const deadline = now + this.timers.VOTING * 1000;
    state.timer = { phase: "VOTING", startedAt: now, deadline };
    state.voting = { votes: {}, startedAt: now, deadline };
    recordEvent(state, "VOTING_STARTED", undefined, {}, now);
  }

  private castVote(state: InternalGameState, voterId: PlayerId, targetId: PlayerId, now: number): void {
    this.requirePhase(state, "VOTING");
    const voter = this.player(state, voterId);
    if (state.voting!.votes[voterId]) throw new GameError("ACTION_ALREADY_SUBMITTED", "Your vote is already locked.");
    if (targetId === voterId || !state.players[targetId]) throw new GameError("INVALID_VOTE");
    const vote = buildVote(state, voterId, targetId);
    state.voting!.votes[voterId] = vote;
    voter.voteTarget = targetId;
    voter.specialVote = vote.weight !== 1;
    recordEvent(state, "VOTE_CAST", voterId, { target: targetId, weight: vote.weight }, now);
    if (Object.keys(state.voting!.votes).length === Object.keys(state.players).length) this.closeVoting(state, now);
  }

  private closeVoting(state: InternalGameState, now: number): void {
    const voting = state.voting!;
    // Missing votes are abstentions. No random votes are ever invented.
    voting.result = tallyVotes(Object.values(voting.votes));
    recordEvent(state, "VOTING_CLOSED", undefined, { ...voting.result }, now);
    state.phase = "RESOLUTION";
    state.timer = null;
    this.elimination.begin(state, voting.result.primaryTargets, now);
  }

  private finish(state: InternalGameState, now: number): void {
    state.results = this.victory.resolve(state);
    state.phase = "RESULTS";
    state.timer = null;
    recordEvent(state, "GAME_COMPLETED", undefined, {
      winningTeams: state.results.winningTeams,
      eliminated: state.results.eliminatedPlayerIds.length,
    }, now);
  }

  private rematch(state: InternalGameState, now: number): void {
    for (const p of Object.values(state.players)) {
      if (p.left) delete state.players[p.id];
    }
    // Close gaps in seating so the next deal is compact.
    seatOrder(state).forEach((pid, i) => (state.players[pid].seat = i + 1));
    for (const p of Object.values(state.players)) {
      p.startingCardId = null;
      p.roleConfirmed = false;
      p.eliminated = false;
      p.voteTarget = undefined;
      p.specialVote = undefined;
      p.nightActionSubmitted = false;
      p.knownInformation = [];
      p.ready = false;
    }
    state.round += 1;
    state.phase = "LOBBY";
    state.cards = {};
    state.center = null;
    state.deck = [];
    state.timer = null;
    state.night = null;
    state.voting = null;
    state.elimination = null;
    state.results = null;
    recordEvent(state, "REMATCH", undefined, {}, now);
  }

  private player(state: InternalGameState, playerId: PlayerId): InternalPlayerState {
    const player = state.players[playerId];
    if (!player) throw new GameError("UNAUTHENTICATED");
    return player;
  }

  private requirePhase(state: InternalGameState, phase: InternalGameState["phase"]): void {
    if (state.phase !== phase) throw new GameError("INVALID_PHASE");
  }

  private requireHost(state: InternalGameState, playerId: PlayerId): void {
    if (state.hostPlayerId !== playerId) throw new GameError("NOT_HOST");
  }
}
