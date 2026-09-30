import { afterEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import { DEFAULT_TIMERS, GameEngine, type InternalGameState } from "@sabha/game-engine";
import { WS_CHANNEL, type CommandAck, type PlayerId } from "@sabha/protocol";
import { createSabhaServer, type SabhaServer } from "../src/app";
import { loadConfig, type ServerConfig } from "../src/config";
import { MemoryAnalytics } from "../src/persistence/analytics";
import { InMemoryGameRepository } from "../src/persistence/GameRepository";
import { RoomManager } from "../src/rooms/RoomManager";
import { SessionStore } from "../src/security/sessions";
import { clientAddress } from "../src/security/validation";

let server: SabhaServer | undefined;
const sockets: Socket[] = [];

afterEach(async () => {
  for (const s of sockets.splice(0)) s.disconnect();
  await server?.close();
  server = undefined;
});

async function start(overrides: Partial<ServerConfig> = {}) {
  const config = { ...loadConfig({} as NodeJS.ProcessEnv), port: 0, host: "127.0.0.1", serveWeb: false, cookieSecure: false, ...overrides };
  server = await createSabhaServer({ config });
  return `http://127.0.0.1:${await server.listen()}`;
}

function post(base: string, path: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
}

function open(base: string): Promise<Socket> {
  const socket = connect(base, { transports: ["websocket"], forceNew: true, reconnection: false });
  sockets.push(socket);
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve(socket));
    socket.once("connect_error", reject);
  });
}

describe("clientAddress", () => {
  it("uses the socket address unless proxies are trusted", () => {
    expect(clientAddress("1.1.1.1", "10.0.0.1", 0)).toBe("10.0.0.1");
    expect(clientAddress(undefined, "10.0.0.1", 1)).toBe("10.0.0.1");
  });

  it("takes the address the trusted proxy saw, ignoring forged entries to its left", () => {
    expect(clientAddress("6.6.6.6, 2.2.2.2", "10.0.0.1", 1)).toBe("2.2.2.2");
    expect(clientAddress("6.6.6.6, 2.2.2.2, 3.3.3.3", "10.0.0.1", 2)).toBe("2.2.2.2");
    expect(clientAddress("2.2.2.2", "10.0.0.1", 3)).toBe("2.2.2.2");
  });
});

describe("abuse limits", () => {
  it("rate-limits per forwarded client IP behind a proxy, not per proxy", async () => {
    const base = await start({ trustProxy: 1 });
    const create = (ip: string) =>
      post(base, "/api/games", { playerName: "Host", playerCount: 5, mode: "BEGINNER" }, { "X-Forwarded-For": ip });
    for (let i = 0; i < 20; i++) expect((await create("2.2.2.2")).status).toBe(201);
    expect((await create("2.2.2.2")).status).toBe(429);
    expect((await create("3.3.3.3")).status).toBe(201);
  });

  it("throttles room lookups", async () => {
    const base = await start();
    const statuses: number[] = [];
    for (let i = 0; i < 35; i++) statuses.push((await fetch(`${base}/api/games/ABCD23`)).status);
    expect(statuses).toContain(429);
  });

  it("refuses new rooms once the server is at capacity", async () => {
    const base = await start({ maxRooms: 2 });
    const body = { playerName: "Host", playerCount: 5, mode: "BEGINNER" };
    expect((await post(base, "/api/games", body)).status).toBe(201);
    expect((await post(base, "/api/games", body)).status).toBe(201);
    const full = await post(base, "/api/games", body);
    expect(full.status).toBe(503);
    expect(((await full.json()) as { error: { code: string } }).error.code).toBe("SERVER_BUSY");
  });

  it("rejects room commands over the socket when disabled", async () => {
    const base = await start({ socketRooms: false });
    const socket = await open(base);
    const ack = await new Promise<CommandAck>((resolve) =>
      socket.emit(WS_CHANNEL, { v: 1, type: "room.create", requestId: "r1", payload: { playerName: "Host", playerCount: 5, mode: "BEGINNER" } }, resolve),
    );
    expect(ack).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    expect(server!.rooms.roomCount()).toBe(0);
  });

  it("caps sockets per IP and frees the slot on disconnect", async () => {
    const base = await start({ maxSocketsPerIp: 2 });
    const first = await open(base);
    await open(base);
    await expect(open(base)).rejects.toThrow(/too many connections/);
    first.disconnect();
    await new Promise((r) => setTimeout(r, 100));
    await expect(open(base)).resolves.toBeDefined();
  });
});

describe("persistence failures", () => {
  it("retries a timer whose write failed instead of stalling the room", async () => {
    class FlakyRepo extends InMemoryGameRepository {
      failures = 0;
      override async save(state: InternalGameState, expected: number | null, sessions: Record<PlayerId, string>) {
        if (this.failures > 0) {
          this.failures--;
          throw new Error("connection terminated");
        }
        return super.save(state, expected, sessions);
      }
    }
    const repo = new FlakyRepo();
    const engine = new GameEngine({ timers: { ...DEFAULT_TIMERS, LOBBY_GRACE: 0.1 } });
    const rooms = new RoomManager(engine, repo, new SessionStore(), new MemoryAnalytics());
    try {
      repo.failures = 0;
      const { gameId, roomCode } = await rooms.createGame({ hostName: "Host", playerCount: 5, mode: "BEGINNER" });
      await rooms.joinGame(roomCode, "Guest"); // commits, which arms the lobby-grace timer
      // Both players' lobby grace expires; the first write of that TICK fails.
      repo.failures = 1;
      await new Promise((r) => setTimeout(r, 300));
      expect(rooms.getState(gameId)).toBeDefined();
      await new Promise((r) => setTimeout(r, 2_500));
      expect(rooms.getState(gameId)).toBeUndefined();
    } finally {
      await rooms.shutdown();
    }
  });
});
