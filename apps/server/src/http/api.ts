import type { IncomingMessage, ServerResponse } from "node:http";
import { GameError } from "@sabha/game-engine";
import {
  createGameRequestSchema,
  DEFAULT_ERROR_MESSAGES,
  joinGameRequestSchema,
  roomCodeSchema,
  type GameErrorCode,
  type SessionResponse,
} from "@sabha/protocol";
import type { ServerConfig } from "../config";
import type { RoomManager } from "../rooms/RoomManager";
import { parseCookies, SESSION_COOKIE, sessionCookie } from "../security/sessions";
import { originAllowed, RateLimiter } from "../security/validation";

const STATUS: Partial<Record<GameErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  NAME_TAKEN: 409,
  GAME_FULL: 409,
  GAME_ALREADY_STARTED: 409,
  RATE_LIMITED: 429,
  UNAUTHENTICATED: 401,
  INTERNAL: 500,
};

function json(res: ServerResponse, status: number, body: unknown, headers: Record<string, string> = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...headers,
  });
  res.end(JSON.stringify(body));
}

function fail(res: ServerResponse, code: GameErrorCode, message = DEFAULT_ERROR_MESSAGES[code]) {
  json(res, STATUS[code] ?? 400, { error: { code, message } });
}

async function readJson(req: IncomingMessage, limit = 4096): Promise<unknown> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += (chunk as Buffer).length;
    if (size > limit) throw new GameError("INVALID_REQUEST");
    chunks.push(chunk as Buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    throw new GameError("INVALID_REQUEST");
  }
}

function clientIp(req: IncomingMessage): string {
  return req.socket.remoteAddress ?? "unknown";
}

/**
 * Minimal HTTP surface: create, join, room summary, health.
 * Everything else happens over the WebSocket.
 */
export function createApiHandler(rooms: RoomManager, config: Pick<ServerConfig, "cookieSecure" | "allowedOrigins">) {
  const limiter = new RateLimiter(20, 0.5);
  const startedAt = Date.now();

  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (!url.pathname.startsWith("/api/")) return false;

    try {
      if (req.method === "POST" && !originAllowed(req.headers.origin, req.headers.host, config.allowedOrigins)) {
        fail(res, "INVALID_REQUEST", "Cross-site requests are not allowed.");
        return true;
      }

      if (req.method === "GET" && url.pathname === "/api/health") {
        json(res, 200, { ok: true, rooms: rooms.roomCount(), uptimeSeconds: Math.round((Date.now() - startedAt) / 1000) });
        return true;
      }

      if (req.method === "POST" && url.pathname === "/api/games") {
        if (!limiter.take(clientIp(req))) return fail(res, "RATE_LIMITED"), true;
        const body = createGameRequestSchema.safeParse(await readJson(req));
        if (!body.success) return fail(res, "INVALID_REQUEST", body.error.issues[0]?.message), true;
        const session = await rooms.createGame({
          hostName: body.data.playerName,
          playerCount: body.data.playerCount,
          mode: body.data.mode as never,
        });
        const payload: SessionResponse = { gameId: session.gameId, roomCode: session.roomCode, playerId: session.playerId };
        json(res, 201, payload, { "Set-Cookie": sessionCookie(session.token, config.cookieSecure) });
        return true;
      }

      const joinMatch = url.pathname.match(/^\/api\/games\/([^/]+)\/join$/);
      if (req.method === "POST" && joinMatch) {
        if (!limiter.take(clientIp(req))) return fail(res, "RATE_LIMITED"), true;
        const code = roomCodeSchema.safeParse(decodeURIComponent(joinMatch[1]));
        if (!code.success) return fail(res, "ROOM_NOT_FOUND"), true;
        const body = joinGameRequestSchema.safeParse(await readJson(req));
        if (!body.success) return fail(res, "INVALID_REQUEST", body.error.issues[0]?.message), true;

        // Already seated in this room (e.g. a reload)? Keep the same seat.
        const existing = rooms.sessions.resolve(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
        const gameId = rooms.gameIdForCode(code.data);
        if (existing && gameId && existing.gameId === gameId && rooms.getState(gameId)?.players[existing.playerId]) {
          json(res, 200, { gameId, roomCode: code.data, playerId: existing.playerId } satisfies SessionResponse);
          return true;
        }

        const session = await rooms.joinGame(code.data, body.data.playerName);
        const payload: SessionResponse = { gameId: session.gameId, roomCode: session.roomCode, playerId: session.playerId };
        json(res, 200, payload, { "Set-Cookie": sessionCookie(session.token, config.cookieSecure) });
        return true;
      }

      const roomMatch = url.pathname.match(/^\/api\/games\/([^/]+)$/);
      if (req.method === "GET" && roomMatch) {
        const code = roomCodeSchema.safeParse(decodeURIComponent(roomMatch[1]));
        const summary = code.success ? rooms.summary(code.data) : null;
        if (!summary) return fail(res, "ROOM_NOT_FOUND"), true;
        // Tell the browser whether its cookie already holds a seat here (no identity leak).
        const existing = rooms.sessions.resolve(parseCookies(req.headers.cookie)[SESSION_COOKIE]);
        const gameId = rooms.gameIdForCode(summary.roomCode);
        json(res, 200, { ...summary, seated: !!existing && existing.gameId === gameId && !!rooms.getState(gameId!)?.players[existing.playerId] });
        return true;
      }

      json(res, 404, { error: { code: "INVALID_REQUEST", message: "Not found." } });
      return true;
    } catch (error) {
      if (error instanceof GameError) fail(res, error.code, error.message);
      else {
        console.error("[api]", error);
        fail(res, "INTERNAL");
      }
      return true;
    }
  };
}
