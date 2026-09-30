import { GameError, type InternalGameState } from "@sabha/game-engine";
import {
  DEFAULT_ERROR_MESSAGES,
  WS_CHANNEL,
  type CommandAck,
  type ErrorEvent,
  type GameId,
  type PlayerId,
  type ServerEvent,
} from "@sabha/protocol";
import type { Server, Socket } from "socket.io";
import type { ServerConfig } from "../config";
import type { RoomChange, RoomManager } from "../rooms/RoomManager";
import { parseCookies, SESSION_COOKIE, type SessionRecord } from "../security/sessions";
import { clientAddress, originAllowed, parseEnvelope, RateLimiter } from "../security/validation";
import { envelope } from "./envelope";
import { toEngineCommand } from "./handlers";

type Ack = (ack: CommandAck) => void;

interface SocketData {
  session?: SessionRecord;
  ip?: string;
}

const key = (gameId: GameId, playerId: PlayerId) => `${gameId}:${playerId}`;

/**
 * WebSocket gateway. Every browser only ever receives the public room view
 * plus its own private view — never the internal state.
 */
export class GameGateway {
  private readonly sockets = new Map<string, Set<Socket>>();
  private readonly limiter = new RateLimiter(40, 8);
  /** Room create/join per IP — the per-socket limiter alone is bypassed by opening more sockets. */
  private readonly roomLimiter = new RateLimiter(20, 0.5);
  private readonly socketsPerIp = new Map<string, number>();

  constructor(
    private readonly io: Server,
    private readonly rooms: RoomManager,
    private readonly config: Pick<ServerConfig, "allowedOrigins" | "trustProxy" | "maxSocketsPerIp" | "socketRooms">,
  ) {
    io.use((socket, next) => {
      const { origin, host } = socket.handshake.headers;
      if (!originAllowed(origin, host, config.allowedOrigins)) return next(new Error("origin not allowed"));
      const ip = clientAddress(socket.handshake.headers["x-forwarded-for"], socket.handshake.address, config.trustProxy);
      const open = this.socketsPerIp.get(ip) ?? 0;
      if (open >= config.maxSocketsPerIp) return next(new Error("too many connections"));
      this.socketsPerIp.set(ip, open + 1);
      (socket.data as SocketData).ip = ip;
      next();
    });
    io.on("connection", (socket) => void this.onConnection(socket));
    rooms.onChange((change) => this.broadcast(change));
  }

  private async onConnection(socket: Socket) {
    const cookies = parseCookies(socket.handshake.headers.cookie);
    const session = this.rooms.sessions.resolve(cookies[SESSION_COOKIE]);

    socket.on(WS_CHANNEL, (raw: unknown, ack?: Ack) => void this.onMessage(socket, raw, ack));
    socket.on("disconnect", () => {
      this.release(socket);
      void this.onDisconnect(socket);
    });

    if (session && this.rooms.getState(session.gameId)?.players[session.playerId]) {
      await this.bind(socket, session);
    } else {
      this.send(socket, envelope("session.none", { serverTime: Date.now() }));
    }
  }

  private async bind(socket: Socket, session: SessionRecord) {
    const data = socket.data as SocketData;
    if (data.session) this.unbind(socket);
    data.session = session;
    const k = key(session.gameId, session.playerId);
    const set = this.sockets.get(k) ?? new Set();
    set.add(socket);
    this.sockets.set(k, set);
    // Restore first so it arrives before the broadcast triggered by the reconnect.
    this.restore(socket);
    await this.rooms.setConnected(session.gameId, session.playerId, true);
  }

  private release(socket: Socket) {
    const ip = (socket.data as SocketData).ip;
    if (!ip) return;
    const open = (this.socketsPerIp.get(ip) ?? 1) - 1;
    if (open > 0) this.socketsPerIp.set(ip, open);
    else this.socketsPerIp.delete(ip);
  }

  private unbind(socket: Socket): SessionRecord | undefined {
    const data = socket.data as SocketData;
    const session = data.session;
    if (!session) return undefined;
    const k = key(session.gameId, session.playerId);
    const set = this.sockets.get(k);
    set?.delete(socket);
    if (set && set.size === 0) this.sockets.delete(k);
    data.session = undefined;
    return session;
  }

  /** Reconnect flow: verify session → identify player → public state → private state. */
  private restore(socket: Socket) {
    const session = (socket.data as SocketData).session;
    const state = session && this.rooms.getState(session.gameId);
    if (!session || !state) return;
    const now = this.rooms.now();
    this.send(
      socket,
      envelope("session.restore", {
        game: this.rooms.engine.publicView(state),
        privateState: this.rooms.engine.privateView(state, session.playerId, now),
        serverTime: now,
      }),
    );
  }

  private async onDisconnect(socket: Socket) {
    const session = this.unbind(socket);
    if (!session) return;
    if (!this.sockets.has(key(session.gameId, session.playerId))) {
      await this.rooms.setConnected(session.gameId, session.playerId, false);
    }
  }

  private async onMessage(socket: Socket, raw: unknown, ack?: Ack) {
    const reply = (result: CommandAck) => {
      if (!result.ok) {
        this.send(socket, envelope<ErrorEvent>("error", { code: result.code, message: result.message, requestId: result.requestId }, result.requestId));
      }
      if (typeof ack === "function") ack(result);
    };
    const requestId = typeof (raw as { requestId?: unknown })?.requestId === "string" ? (raw as { requestId: string }).requestId : "";

    if (!this.limiter.take(socket.id)) {
      return reply({ ok: false, requestId, code: "RATE_LIMITED", message: DEFAULT_ERROR_MESSAGES.RATE_LIMITED });
    }

    try {
      const command = parseEnvelope(raw);
      const data = socket.data as SocketData;

      if (command.type === "ping") {
        const { clientTime } = command.payload as { clientTime: number };
        this.send(socket, envelope("pong", { clientTime, serverTime: Date.now() }, command.requestId));
        return reply({ ok: true, requestId: command.requestId });
      }

      // Socket-only create/join bind this connection. Browsers should prefer the
      // HTTP endpoints, which also set the HttpOnly session cookie for reconnects.
      if (command.type === "room.create" || command.type === "room.join") {
        if (!this.config.socketRooms) throw new GameError("INVALID_REQUEST");
        if (!this.roomLimiter.take(data.ip ?? socket.id)) throw new GameError("RATE_LIMITED");
      }
      if (command.type === "room.create") {
        const p = command.payload as { playerName: string; playerCount: number; mode: never };
        const s = await this.rooms.createGame({ hostName: p.playerName, playerCount: p.playerCount, mode: p.mode });
        await this.bind(socket, { gameId: s.gameId, playerId: s.playerId });
        return reply({ ok: true, requestId: command.requestId });
      }
      if (command.type === "room.join") {
        const p = command.payload as { roomCode: string; playerName: string };
        const s = await this.rooms.joinGame(p.roomCode, p.playerName);
        await this.bind(socket, { gameId: s.gameId, playerId: s.playerId });
        return reply({ ok: true, requestId: command.requestId });
      }

      const session = data.session;
      if (!session) throw new GameError("UNAUTHENTICATED");
      const engineCommand = toEngineCommand(command, session.playerId);
      if (!engineCommand) throw new GameError("INVALID_REQUEST");

      const result = await this.rooms.execute(session.gameId, session.playerId, command.requestId, engineCommand);
      if (result.ok && engineCommand.type === "CAST_VOTE" && !result.duplicate) {
        this.send(socket, envelope("vote.locked", { targetPlayerId: engineCommand.targetId }, command.requestId));
      }
      if (result.ok && engineCommand.type === "LEAVE") {
        const state = this.rooms.getState(session.gameId);
        if (!state?.players[session.playerId]) this.rooms.sessions.revokePlayer(session.gameId, session.playerId);
        this.unbind(socket);
        this.send(socket, envelope("session.none", { serverTime: Date.now() }));
      }
      reply(result);
    } catch (error) {
      if (error instanceof GameError) {
        reply({ ok: false, requestId, code: error.code, message: error.message });
      } else {
        console.error("[gateway] unexpected error", error);
        reply({ ok: false, requestId, code: "INTERNAL", message: DEFAULT_ERROR_MESSAGES.INTERNAL });
      }
    }
  }

  private broadcast({ prev, next }: RoomChange) {
    const engine = this.rooms.engine;
    const now = this.rooms.now();
    const publicView = engine.publicView(next);
    const phaseChanged = !prev || prev.phase !== next.phase || prev.round !== next.round;

    for (const [k, sockets] of this.sockets) {
      const [gameId, playerId] = k.split(":") as [GameId, PlayerId];
      if (gameId !== next.gameId) continue;

      if (!next.players[playerId]) {
        for (const socket of sockets) {
          this.send(socket, envelope("session.none", { serverTime: now }));
          this.unbind(socket);
        }
        continue;
      }

      const events: ServerEvent[] = [
        envelope("room.state", publicView),
        envelope("player.private_state", engine.privateView(next, playerId, now)),
      ];
      if (phaseChanged && prev) events.push(...this.phaseEvents(prev, next));
      if (this.newlyPrompted(prev, next, playerId)) {
        events.push(envelope("night.prompt", { deadline: next.night!.deadline }));
      }
      for (const socket of sockets) for (const event of events) this.send(socket, event);
    }
  }

  private phaseEvents(prev: InternalGameState, next: InternalGameState): ServerEvent[] {
    const events: ServerEvent[] = [envelope("game.phase", { phase: next.phase, previousPhase: prev.phase })];
    if (next.timer) events.push(envelope("timer.start", { phase: next.phase, startedAt: next.timer.startedAt, deadline: next.timer.deadline }));
    if (prev.phase === "NIGHT") events.push(envelope("night.complete", {}));
    if (next.phase === "DISCUSSION" && next.timer) events.push(envelope("discussion.started", { deadline: next.timer.deadline }));
    if (next.phase === "VOTING" && next.timer) events.push(envelope("voting.started", { deadline: next.timer.deadline }));
    const view = this.rooms.engine.publicView(next);
    if (prev.phase === "VOTING" && view.resolution) events.push(envelope("vote.reveal", view.resolution));
    if (next.phase === "RESULTS" && next.results) events.push(envelope("game.results", next.results));
    return events;
  }

  private newlyPrompted(prev: InternalGameState | null, next: InternalGameState, playerId: PlayerId): boolean {
    if (next.phase !== "NIGHT" || !next.night || next.night.completed) return false;
    const now = next.night.pendingPlayerIds.includes(playerId);
    const before = prev?.phase === "NIGHT" && !!prev.night?.pendingPlayerIds.includes(playerId) && prev.night.step === next.night.step;
    return now && !before;
  }

  private send(socket: Socket, event: ServerEvent) {
    socket.emit(WS_CHANNEL, event);
  }
}
