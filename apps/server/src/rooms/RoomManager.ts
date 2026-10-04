import { randomUUID } from "node:crypto";
import {
  GameEngine,
  GameError,
  InvariantViolation,
  type EngineCommand,
  type InternalGameState,
} from "@sabha/game-engine";
import {
  asGameId,
  asPlayerId,
  DEFAULT_ERROR_MESSAGES,
  type CommandAck,
  type GameId,
  type GameMode,
  type GameResults,
  type NightActionInput,
  type PlayerId,
  type RoomSummaryResponse,
} from "@sabha/protocol";
import type { AnalyticsSink } from "../persistence/analytics";
import { ConcurrencyError, type GameRepository, type StoredGame } from "../persistence/GameRepository";
import { generateRoomCode, hashSessionToken, SessionStore, type SessionRecord } from "../security/sessions";

export interface CreateGameConfig {
  playerCount: number;
  mode: GameMode;
  hostName: string;
}

export interface PlayerSession {
  gameId: GameId;
  roomCode: string;
  playerId: PlayerId;
  /** Raw token — only ever placed in an HttpOnly cookie. */
  token: string;
}

export interface RoomChange {
  prev: InternalGameState | null;
  next: InternalGameState;
  command: EngineCommand | null;
  actorId: PlayerId | null;
}

interface Room {
  gameId: GameId;
  state: InternalGameState;
  chain: Promise<unknown>;
  timer?: NodeJS.Timeout;
  /** Idempotency: request ids already processed in the current phase. */
  processed: Map<string, CommandAck>;
  processedPhase: string;
}

const MAX_TIMEOUT = 2 ** 31 - 1;
/** Back-off before re-running a timer whose write failed (e.g. the database blipped). */
const TICK_RETRY_MS = 2_000;

/**
 * Owns every live room. All state changes for a room are serialised through
 * a per-room promise chain, persisted with a state_version check, then
 * broadcast to listeners (the WebSocket gateway).
 */
export class RoomManager {
  private readonly rooms = new Map<GameId, Room>();
  private readonly codes = new Map<string, GameId>();
  private readonly listeners = new Set<(change: RoomChange) => void>();
  private sweeper?: NodeJS.Timeout;
  private closed = false;
  /** Whether this process holds a live socket for the player (set by the gateway). */
  private presence: (gameId: GameId, playerId: PlayerId) => boolean = () => false;

  constructor(
    readonly engine: GameEngine,
    private readonly repo: GameRepository,
    readonly sessions: SessionStore,
    private readonly analytics: AnalyticsSink,
    private readonly clock: () => number = Date.now,
    private readonly maxRooms = Infinity,
  ) {}

  onChange(listener: (change: RoomChange) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  now(): number {
    return this.clock();
  }

  getState(gameId: GameId): InternalGameState | undefined {
    return this.rooms.get(gameId)?.state;
  }

  gameIdForCode(roomCode: string): GameId | undefined {
    return this.codes.get(roomCode.toUpperCase());
  }

  roomCount(): number {
    return this.rooms.size;
  }

  setPresence(presence: (gameId: GameId, playerId: PlayerId) => boolean): void {
    this.presence = presence;
  }

  /**
   * Game id for a room code. Falls back to the database for a room this
   * process has not seen, e.g. one the previous instance created while a
   * deploy was handing over.
   */
  async findByCode(roomCode: string): Promise<GameId | undefined> {
    const code = roomCode.toUpperCase();
    const known = this.codes.get(code);
    if (known) return known;
    const stored = await this.repo.loadOne({ roomCode: code });
    if (!stored) return undefined;
    return (this.rooms.get(stored.state.gameId) ?? this.adopt(stored)).gameId;
  }

  /** Session for a cookie token, with the same database fallback as findByCode. */
  async resolveSession(token: string | undefined): Promise<SessionRecord | null> {
    const known = this.sessions.resolve(token);
    if (known || !token) return known;
    const stored = await this.repo.loadOne({ sessionHash: hashSessionToken(token) });
    if (!stored) return null;
    const room = this.rooms.get(stored.state.gameId);
    // Holding an older copy means the player joined on another instance.
    if (room) await this.run(room, () => this.reload(room));
    else this.adopt(stored);
    return this.sessions.resolve(token);
  }

  async summary(roomCode: string): Promise<RoomSummaryResponse | null> {
    const gameId = await this.findByCode(roomCode);
    const state = gameId && this.rooms.get(gameId)?.state;
    if (!state) return null;
    const count = Object.keys(state.players).length;
    return {
      roomCode: state.roomCode,
      phase: state.phase,
      playerCount: count,
      capacity: state.capacity,
      joinable: state.phase === "LOBBY" && count < state.capacity,
    };
  }

  // -------------------------------------------------------------------------
  // Spec §75 surface
  // -------------------------------------------------------------------------

  async createGame(config: CreateGameConfig): Promise<PlayerSession> {
    if (this.rooms.size >= this.maxRooms) throw new GameError("SERVER_BUSY");
    const gameId = asGameId(randomUUID());
    const playerId = asPlayerId(randomUUID());
    let roomCode = generateRoomCode();
    for (let i = 0; this.codes.has(roomCode) && i < 50; i++) roomCode = generateRoomCode();
    if (this.codes.has(roomCode)) throw new GameError("INTERNAL");

    const state = this.engine.createGame(
      {
        gameId,
        roomCode,
        mode: config.mode,
        capacity: config.playerCount,
        host: { id: playerId, displayName: config.hostName, sessionId: randomUUID() },
      },
      this.clock(),
    );
    const { token } = this.sessions.issue({ gameId, playerId });
    const room = this.register(state);
    await this.repo.save(state, null, this.sessionHashes(room));
    this.analytics.track("game_created", { mode: config.mode, capacity: config.playerCount });
    this.emit({ prev: null, next: state, command: null, actorId: playerId });
    return { gameId, roomCode, playerId, token };
  }

  async joinGame(roomCode: string, playerName: string): Promise<PlayerSession> {
    const gameId = await this.findByCode(roomCode);
    const room = gameId && this.rooms.get(gameId);
    if (!room) throw new GameError("ROOM_NOT_FOUND");
    const playerId = asPlayerId(randomUUID());
    let token = "";
    await this.run(room, async () => {
      // Issued first so the session hash is saved with the new player.
      token = this.sessions.issue({ gameId: room.gameId, playerId }).token;
      try {
        await this.applyAndCommit(
          room,
          { type: "ADD_PLAYER", player: { id: playerId, displayName: playerName, sessionId: randomUUID() } },
          playerId,
          { type: "ADD_PLAYER", player: { id: playerId, displayName: playerName, sessionId: "" } },
        );
      } catch (error) {
        this.sessions.revokePlayer(room.gameId, playerId);
        throw error;
      }
    });
    return { gameId: room.gameId, roomCode: room.state.roomCode, playerId, token };
  }

  startGame(gameId: GameId, hostId: PlayerId, requestId?: string) {
    return this.execute(gameId, hostId, requestId ?? null, { type: "START_GAME", playerId: hostId });
  }

  handleNightAction(gameId: GameId, playerId: PlayerId, action: NightActionInput, requestId?: string) {
    return this.execute(gameId, playerId, requestId ?? null, { type: "NIGHT_ACTION", playerId, input: action });
  }

  castVote(gameId: GameId, playerId: PlayerId, targetId: PlayerId, requestId?: string) {
    return this.execute(gameId, playerId, requestId ?? null, { type: "CAST_VOTE", playerId, targetId });
  }

  async resolveGame(gameId: GameId): Promise<GameResults> {
    const state = this.rooms.get(gameId)?.state;
    if (!state?.results) throw new GameError("INVALID_PHASE");
    return state.results;
  }

  rematch(gameId: GameId, hostId: PlayerId, requestId?: string) {
    return this.execute(gameId, hostId, requestId ?? null, { type: "REMATCH", playerId: hostId });
  }

  // -------------------------------------------------------------------------

  /**
   * Apply one command. Duplicate request ids within a phase are acknowledged
   * without being applied again.
   */
  async execute(gameId: GameId, playerId: PlayerId | null, requestId: string | null, command: EngineCommand): Promise<CommandAck> {
    const room = this.rooms.get(gameId);
    const rid = requestId ?? "";
    if (!room) return { ok: false, requestId: rid, code: "ROOM_NOT_FOUND", message: DEFAULT_ERROR_MESSAGES.ROOM_NOT_FOUND };

    return this.run(room, async () => {
      const key = playerId && requestId ? `${playerId}:${requestId}` : null;
      if (key) {
        const seen = room.processed.get(key);
        if (seen) return { ...seen, duplicate: true } as CommandAck;
      }
      try {
        await this.applyAndCommit(room, command, playerId);
        const ack: CommandAck = { ok: true, requestId: rid };
        if (key) room.processed.set(key, ack);
        return ack;
      } catch (error) {
        if (error instanceof GameError) {
          return { ok: false, requestId: rid, code: error.code, message: error.message };
        }
        if (error instanceof InvariantViolation) {
          console.error(`[room ${room.state.roomCode}] invariant violation`, error);
        } else {
          console.error(`[room ${room.state.roomCode}] command failed`, error);
          // The state did not change, and a failed TICK would otherwise leave the room with no timer.
          if (!room.timer) this.schedule(room, TICK_RETRY_MS);
        }
        return { ok: false, requestId: rid, code: "INTERNAL", message: DEFAULT_ERROR_MESSAGES.INTERNAL };
      }
    });
  }

  async setConnected(gameId: GameId, playerId: PlayerId, connected: boolean): Promise<void> {
    const state = this.rooms.get(gameId)?.state;
    if (!state?.players[playerId] || state.players[playerId].connected === connected) return;
    await this.execute(gameId, null, null, { type: "SET_CONNECTED", playerId, connected });
  }

  async restore(): Promise<number> {
    const stored = await this.repo.loadActive();
    for (const game of stored) this.adopt(game);
    return stored.length;
  }

  startSweeper(intervalMs = 60_000): void {
    let lastExpiry = 0;
    this.sweeper = setInterval(() => {
      const now = this.clock();
      for (const room of this.rooms.values()) {
        const s = room.state;
        const stale =
          s.phase === "ENDED" ||
          (s.phase === "RESULTS" && now - s.updatedAt > 24 * 3600_000) ||
          (Object.values(s.players).every((p) => !p.connected) && now - s.updatedAt > 6 * 3600_000);
        if (stale) this.drop(room);
      }
      if (now - lastExpiry > 3600_000) {
        lastExpiry = now;
        this.repo.deleteExpired(now).catch((e) => console.warn("[retention]", e.message));
      }
    }, intervalMs);
    this.sweeper.unref();
  }

  async shutdown(): Promise<void> {
    this.closed = true;
    if (this.sweeper) clearInterval(this.sweeper);
    for (const room of this.rooms.values()) if (room.timer) clearTimeout(room.timer);
    await Promise.all([...this.rooms.values()].map((r) => r.chain.catch(() => undefined)));
  }

  // -------------------------------------------------------------------------

  private register(state: InternalGameState): Room {
    const room: Room = {
      gameId: state.gameId,
      state,
      chain: Promise.resolve(),
      processed: new Map(),
      processedPhase: `${state.round}:${state.phase}`,
    };
    this.rooms.set(state.gameId, room);
    this.codes.set(state.roomCode, state.gameId);
    return room;
  }

  /**
   * Take over a stored game, or refresh `room` in place. Connection flags
   * describe another process's sockets, so they are reset to this one's, and
   * everyone not connected here gets a full lobby grace period to reconnect.
   */
  private adopt({ state, sessions }: StoredGame, room?: Room): Room {
    const now = this.clock();
    for (const p of Object.values(state.players)) {
      const connected = this.presence(state.gameId, p.id);
      if (!connected) p.lastSeenAt = Math.max(p.lastSeenAt, now);
      p.connected = connected;
    }
    if (room) {
      room.state = state;
      room.processed.clear();
      room.processedPhase = `${state.round}:${state.phase}`;
      this.codes.set(state.roomCode, state.gameId);
    } else {
      room = this.register(state);
    }
    for (const [playerId, hash] of Object.entries(sessions)) {
      if (hash) this.sessions.restore(hash, { gameId: state.gameId, playerId: playerId as PlayerId });
    }
    this.schedule(room);
    return room;
  }

  /** Catch up with a newer copy another instance saved. False if the game is gone. Call inside run(). */
  private async reload(room: Room): Promise<boolean> {
    const stored = await this.repo.loadOne({ gameId: room.gameId });
    if (!stored) {
      this.drop(room);
      return false;
    }
    const prev = room.state;
    if (stored.state.stateVersion > prev.stateVersion) {
      this.adopt(stored, room);
      this.emit({ prev, next: room.state, command: null, actorId: null });
    } else {
      for (const [playerId, hash] of Object.entries(stored.sessions)) {
        if (hash) this.sessions.restore(hash, { gameId: room.gameId, playerId: playerId as PlayerId });
      }
    }
    return true;
  }

  /**
   * Apply a command and persist it. If another instance wrote first (both run
   * briefly during a deploy), catch up from the database and try once more.
   */
  private async applyAndCommit(room: Room, command: EngineCommand, actorId: PlayerId | null, logged: EngineCommand = command) {
    try {
      await this.commit(room, this.engine.apply(room.state, command, this.clock()), logged, actorId);
    } catch (error) {
      if (!(error instanceof ConcurrencyError)) throw error;
      console.warn(`[room ${room.state.roomCode}] saved elsewhere since loaded; reloading`);
      if (!(await this.reload(room))) throw new GameError("ROOM_NOT_FOUND");
      await this.commit(room, this.engine.apply(room.state, command, this.clock()), logged, actorId);
    }
  }

  private drop(room: Room): void {
    if (room.timer) clearTimeout(room.timer);
    this.rooms.delete(room.gameId);
    this.codes.delete(room.state.roomCode);
    this.sessions.revokeGame(room.gameId);
  }

  /** Serialise work on one room (the in-process equivalent of SELECT … FOR UPDATE). */
  private run<T>(room: Room, fn: () => Promise<T>): Promise<T> {
    const result = room.chain.then(fn, fn);
    room.chain = result.catch(() => undefined);
    return result;
  }

  private sessionHashes(room: Room): Record<PlayerId, string> {
    const out = {} as Record<PlayerId, string>;
    for (const pid of Object.keys(room.state.players) as PlayerId[]) {
      out[pid] = this.sessions.hashFor(room.gameId, pid) ?? "";
    }
    return out;
  }

  private async commit(room: Room, next: InternalGameState, command: EngineCommand | null, actorId: PlayerId | null) {
    const prev = room.state;
    await this.repo.save(next, prev.stateVersion, this.sessionHashes({ ...room, state: next }));
    room.state = next;

    const phaseKey = `${next.round}:${next.phase}`;
    if (phaseKey !== room.processedPhase) {
      room.processed.clear();
      room.processedPhase = phaseKey;
    }

    // Players removed from the lobby lose their session.
    for (const pid of Object.keys(prev.players) as PlayerId[]) {
      if (!next.players[pid]) this.sessions.revokePlayer(next.gameId, pid);
    }

    this.trackAnalytics(prev, next, command);
    this.emit({ prev, next, command, actorId });
    this.schedule(room);
    if (next.phase === "ENDED") this.drop(room);
  }

  private schedule(room: Room, minDelay = 0): void {
    if (room.timer) clearTimeout(room.timer);
    room.timer = undefined;
    if (this.closed || this.rooms.get(room.gameId) !== room) return;
    const deadline = this.engine.nextDeadline(room.state);
    if (deadline === null) return;
    const delay = Math.min(MAX_TIMEOUT, Math.max(minDelay, deadline - this.clock() + 5));
    room.timer = setTimeout(() => {
      room.timer = undefined;
      void this.execute(room.gameId, null, null, { type: "TICK" });
    }, delay);
    room.timer.unref?.();
  }

  private emit(change: RoomChange): void {
    for (const listener of this.listeners) {
      try {
        listener(change);
      } catch (error) {
        console.error("[room] listener failed", error);
      }
    }
  }

  private trackAnalytics(prev: InternalGameState, next: InternalGameState, command: EngineCommand | null) {
    const playerCount = Object.keys(next.players).length;
    if (prev.phase === "LOBBY" && next.phase === "ROLE_REVEAL") {
      this.analytics.track("game_started", { mode: next.mode, player_count: playerCount, role_distribution: next.deck });
    }
    if (prev.phase !== "RESULTS" && next.phase === "RESULTS" && next.results) {
      const started = [...next.events].reverse().find((e) => e.type === "GAME_STARTED");
      this.analytics.track("game_completed", {
        mode: next.mode,
        player_count: playerCount,
        game_duration_ms: started ? next.updatedAt - started.createdAt : null,
        winner_distribution: next.results.winningTeams,
        role_distribution: next.deck,
      });
    }
    if (command?.type === "SET_CONNECTED" && !command.connected && next.phase !== "LOBBY") {
      this.analytics.track("player_disconnected", { phase: next.phase, player_count: playerCount });
    }
  }
}
