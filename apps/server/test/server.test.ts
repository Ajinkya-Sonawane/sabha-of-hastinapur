import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  ROLE_IDS,
  WS_CHANNEL,
  type AvailableAction,
  type ClientEvent,
  type CommandAck,
  type NightActionInput,
  type PrivatePlayerView,
  type PublicGameView,
  type ServerEvent,
} from "@sabha/protocol";
import { createSabhaServer, type SabhaServer } from "../src/app";
import { loadConfig } from "../src/config";

let server: SabhaServer;
let base: string;

beforeEach(async () => {
  const config = {
    ...loadConfig({} as NodeJS.ProcessEnv),
    port: 0,
    host: "127.0.0.1",
    serveWeb: false,
    cookieSecure: false,
    timers: { ROLE_REVEAL: 2, NIGHT_ACTION: 2, DISCUSSION: 60, VOTING: 3, SPECIAL_ELIMINATION: 2, RESULTS: 60, LOBBY_GRACE: 60 },
  };
  server = await createSabhaServer({ config });
  const port = await server.listen();
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await server.close();
});

interface Client {
  name: string;
  cookie: string;
  playerId: string;
  socket: Socket;
  received: ServerEvent[];
  publicView?: PublicGameView;
  privateView?: PrivatePlayerView;
  send(type: ClientEvent["type"], payload?: unknown, requestId?: string): Promise<CommandAck>;
  waitFor(predicate: (c: Client) => boolean, timeoutMs?: number): Promise<void>;
}

async function post(path: string, body: unknown, cookie?: string) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body),
  });
  const setCookie = res.headers.get("set-cookie");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  return { status: res.status, body: json, cookie: setCookie?.split(";")[0] ?? cookie ?? "" };
}

let rid = 0;
async function openClient(name: string, cookie: string, playerId: string): Promise<Client> {
  const socket = connect(base, { transports: ["websocket"], extraHeaders: { cookie }, forceNew: true });
  const client: Client = {
    name,
    cookie,
    playerId,
    socket,
    received: [],
    send(type, payload = {}, requestId = `r${++rid}`) {
      return new Promise((resolve) =>
        socket.emit(WS_CHANNEL, { v: 1, type, requestId, timestamp: Date.now(), payload }, (ack: CommandAck) => resolve(ack)),
      );
    },
    waitFor(predicate, timeoutMs = 15_000) {
      return new Promise((resolve, reject) => {
        if (predicate(client)) return resolve();
        const timer = setTimeout(() => reject(new Error(`${name}: timed out waiting`)), timeoutMs);
        const check = () => {
          if (predicate(client)) {
            clearTimeout(timer);
            socket.off(WS_CHANNEL, check);
            resolve();
          }
        };
        socket.on(WS_CHANNEL, check);
      });
    },
  };
  socket.on(WS_CHANNEL, (event: ServerEvent) => {
    client.received.push(event);
    if (event.type === "room.state") client.publicView = event.payload;
    if (event.type === "player.private_state") client.privateView = event.payload;
    if (event.type === "session.restore") {
      client.publicView = event.payload.game;
      client.privateView = event.payload.privateState;
    }
  });
  await client.waitFor((c) => !!c.privateView);
  return client;
}

async function seatTable(n: number, mode = "BEGINNER") {
  const created = await post("/api/games", { playerName: "Host", playerCount: n, mode });
  expect(created.status).toBe(201);
  expect(created.cookie).toMatch(/^sabha_session=/);
  const roomCode = created.body.roomCode as string;
  const clients = [await openClient("Host", created.cookie, created.body.playerId)];
  const names = ["Rahul", "Priya", "Amit", "Neha", "Kiran", "Meera", "Arjun", "Divya", "Sanjay"];
  for (let i = 1; i < n; i++) {
    const joined = await post(`/api/games/${roomCode}/join`, { playerName: names[i - 1] });
    expect(joined.status).toBe(200);
    clients.push(await openClient(names[i - 1], joined.cookie, joined.body.playerId));
  }
  await clients[0].waitFor((c) => c.publicView?.players.filter((p) => p.connected).length === n);
  return { roomCode, clients };
}

function inputFor(action: Extract<AvailableAction, { kind: "NIGHT_ACTION" }>): NightActionInput {
  const option = action.options[0];
  switch (option.type) {
    case "SWAP_PLAYERS":
    case "INSPECT_PAIR":
      return { type: option.type, targets: [option.targets[0], option.targets[1]] };
    case "SWAP_OR_NOT":
      return { type: "SWAP_OR_NOT", targets: option.targets, swap: true };
    case "INSPECT_PLAYER":
    case "PROTECT_PLAYER":
    case "ARROW_TARGET":
    case "CHOOSE_PLAYER":
      return { type: option.type, target: option.targets[0] };
    case "INSPECT_CENTER":
      return { type: "INSPECT_CENTER", slots: [0, 1] };
    case "PREDICT_MOVES":
      return { type: "PREDICT_MOVES", count: "2" };
    case "ACKNOWLEDGE":
      return { type: "ACKNOWLEDGE" };
  }
}

/** A naive bot: answers whatever its own private state asks for. */
function autopilot(client: Client, voteFor: () => string) {
  const busy = new Set<string>();
  client.socket.on(WS_CHANNEL, async (event: ServerEvent) => {
    if (event.type !== "player.private_state" && event.type !== "session.restore") return;
    const view = event.type === "player.private_state" ? event.payload : event.payload.privateState;
    for (const action of view.availableActions) {
      const k = `${action.kind}:${JSON.stringify(action)}`;
      if (busy.has(k)) continue;
      busy.add(k);
      if (action.kind === "CONFIRM_ROLE") await client.send("role.confirm");
      if (action.kind === "NIGHT_ACTION") await client.send("night.action", inputFor(action));
      if (action.kind === "END_DISCUSSION") await client.send("discussion.end");
      if (action.kind === "VOTE") {
        const target = voteFor();
        await client.send("vote.cast", { targetPlayerId: target === client.playerId ? action.targets[0] : target });
      }
      if (action.kind === "SPECIAL_ELIMINATION") await client.send("special.elimination", { targetPlayerId: action.targets[0] });
    }
  });
}

describe("HTTP API", () => {
  it("reports health", async () => {
    const res = await fetch(`${base}/api/health`);
    expect(res.status).toBe(200);
    expect(((await res.json()) as { ok: boolean }).ok).toBe(true);
  });

  it("validates create and join", async () => {
    expect((await post("/api/games", { playerName: "A", playerCount: 5, mode: "BEGINNER" })).status).toBe(400);
    expect((await post("/api/games", { playerName: "Host", playerCount: 11, mode: "BEGINNER" })).status).toBe(400);
    const created = await post("/api/games", { playerName: "Host", playerCount: 5, mode: "BEGINNER" });
    const code = created.body.roomCode;
    expect(code).toMatch(/^[A-Z]{4}[0-9]{2}$/);
    expect((await post(`/api/games/ZZZZ99/join`, { playerName: "Rahul" })).status).toBe(404);
    expect((await post(`/api/games/${code}/join`, { playerName: "host" })).status).toBe(409);
    expect((await post(`/api/games/${code.toLowerCase()}/join`, { playerName: "Rahul" })).status).toBe(200);

    const summary = await (await fetch(`${base}/api/games/${code}`)).json();
    expect(summary).toMatchObject({ roomCode: code, phase: "LOBBY", playerCount: 2, capacity: 5, joinable: true });
  });

  it("sets an HttpOnly, SameSite=Lax session cookie", async () => {
    const res = await fetch(`${base}/api/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerName: "Host", playerCount: 5, mode: "BEGINNER" }),
    });
    const cookie = res.headers.get("set-cookie")!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Lax");
  });

  it("rejects cross-site POSTs", async () => {
    const res = await fetch(`${base}/api/games`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "https://evil.example" },
      body: JSON.stringify({ playerName: "Host", playerCount: 5, mode: "BEGINNER" }),
    });
    expect(res.status).toBe(400);
  });
});

describe("WebSocket game", () => {
  it("plays a full five-player game without leaking hidden information", async () => {
    const { clients } = await seatTable(5);
    const [host] = clients;

    // Non-hosts cannot start.
    const denied = await clients[1].send("game.start");
    expect(denied).toMatchObject({ ok: false, code: "NOT_HOST" });

    for (const c of clients) autopilot(c, () => clients[1].playerId);
    await host.send("game.start");

    await Promise.all(clients.map((c) => c.waitFor((x) => x.publicView?.phase === "RESULTS", 30_000)));

    for (const c of clients) {
      for (const event of c.received) {
        if (event.type === "room.state" && event.payload.phase !== "RESULTS") {
          const { deck: _deck, ...rest } = event.payload;
          const json = JSON.stringify(rest);
          for (const role of ROLE_IDS) expect(json, `${c.name} saw ${role} in room.state`).not.toContain(`"${role}"`);
        }
        if (event.type === "player.private_state") {
          expect(event.payload.playerId).toBe(c.playerId);
          if (!event.payload.canSeeFinalRole) expect(event.payload.finalRole).toBeUndefined();
        }
      }
      expect(c.received.some((e) => e.type === "game.results")).toBe(true);
    }

    const results = host.publicView!.results!;
    expect(Object.keys(results.finalRoles)).toHaveLength(5);
    expect(results.votes.filter((v) => v.targetId)).toHaveLength(5);
    expect(host.privateView!.finalRole).toBe(results.finalRoles[host.playerId as never]);

    // Rematch returns to the lobby.
    const again = await host.send("game.rematch");
    expect(again.ok).toBe(true);
    await host.waitFor((c) => c.publicView?.phase === "LOBBY");
  });

  it("does not count a repeated vote request twice", async () => {
    const { clients } = await seatTable(5);
    const [host] = clients;
    for (const c of clients) {
      c.socket.on(WS_CHANNEL, (e: ServerEvent) => {
        if (e.type === "player.private_state" && e.payload.availableActions.some((a) => a.kind === "CONFIRM_ROLE")) void c.send("role.confirm");
        if (e.type === "player.private_state") {
          const night = e.payload.availableActions.find((a) => a.kind === "NIGHT_ACTION");
          if (night && night.kind === "NIGHT_ACTION") void c.send("night.action", inputFor(night));
        }
      });
    }
    await host.send("game.start");
    await host.waitFor((c) => c.publicView?.phase === "DISCUSSION", 20_000);
    await host.send("discussion.end");
    await host.waitFor((c) => c.publicView?.phase === "VOTING");

    const first = await clients[1].send("vote.cast", { targetPlayerId: clients[2].playerId }, "dup-1");
    const second = await clients[1].send("vote.cast", { targetPlayerId: clients[2].playerId }, "dup-1");
    expect(first.ok).toBe(true);
    expect(second).toMatchObject({ ok: true, duplicate: true });
    const third = await clients[1].send("vote.cast", { targetPlayerId: clients[3].playerId }, "dup-2");
    expect(third).toMatchObject({ ok: false, code: "ACTION_ALREADY_SUBMITTED" });

    await host.waitFor((c) => c.publicView?.voting?.votedPlayerIds.length === 1);
    expect(clients[1].received.some((e) => e.type === "vote.locked")).toBe(true);
  });

  it("restores the session and private state on reconnect", async () => {
    const { clients } = await seatTable(5);
    const [host] = clients;
    await host.send("game.start");
    await clients[2].waitFor((c) => !!c.privateView?.startingRole);
    const role = clients[2].privateView!.startingRole;

    clients[2].socket.disconnect();
    await host.waitFor((c) => c.publicView?.players.find((p) => p.id === clients[2].playerId)?.connected === false);

    const again = await openClient("Priya", clients[2].cookie, clients[2].playerId);
    const restore = again.received.find((e) => e.type === "session.restore");
    expect(restore).toBeDefined();
    expect(again.privateView!.playerId).toBe(clients[2].playerId);
    expect(again.privateView!.startingRole).toBe(role);
    await host.waitFor((c) => c.publicView?.players.find((p) => p.id === clients[2].playerId)?.connected === true);
  });

  it("rejects unauthenticated and malformed commands", async () => {
    const stranger = connect(base, { transports: ["websocket"], forceNew: true });
    const none = await new Promise<ServerEvent>((resolve) => stranger.once(WS_CHANNEL, resolve));
    expect(none.type).toBe("session.none");
    const ack = await new Promise<CommandAck>((resolve) =>
      stranger.emit(WS_CHANNEL, { v: 1, type: "vote.cast", requestId: "x", timestamp: 0, payload: { targetPlayerId: "p" } }, resolve),
    );
    expect(ack).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    const bad = await new Promise<CommandAck>((resolve) => stranger.emit(WS_CHANNEL, { hello: "world" }, resolve));
    expect(bad).toMatchObject({ ok: false, code: "INVALID_REQUEST" });
    stranger.disconnect();
  });

  it("plays a ten-player advanced game to completion", async () => {
    const { clients } = await seatTable(10, "ADVANCED");
    for (const c of clients) autopilot(c, () => clients[3].playerId);
    await clients[0].send("game.start");
    await Promise.all(clients.map((c) => c.waitFor((x) => x.publicView?.phase === "RESULTS", 45_000)));
    const results = clients[0].publicView!.results!;
    expect(results.playerResults).toHaveLength(10);
    expect(results.centerRoles).toHaveLength(3);
  }, 60_000);
});
