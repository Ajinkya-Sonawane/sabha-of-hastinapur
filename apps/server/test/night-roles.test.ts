import { describe, expect, it } from "vitest";
import { io as connect, type Socket } from "socket.io-client";
import {
  draupadiReading,
  dronaReading,
  effectiveFaction,
  getRole,
  ROLE_REGISTRY,
  SeededRandomSource,
  viduraReading,
} from "@sabha/game-engine";
import {
  WS_CHANNEL,
  type AvailableAction,
  type ClientEvent,
  type CommandAck,
  type GameMode,
  type GameResults,
  type KnownInformation,
  type NightActionInput,
  type NightActionOption,
  type PrivatePlayerView,
  type PublicGameView,
  type RoleId,
  type ServerEvent,
} from "@sabha/protocol";
import { createSabhaServer, type SabhaServer } from "../src/app";
import { loadConfig } from "../src/config";

/**
 * Black-box night tests: real players over HTTP + WebSocket, then the night is
 * replayed card-by-card from the revealed starting roles and every reading,
 * swap and final card is checked against it.
 */

const EXPECTED_OPTIONS: Partial<Record<RoleId, NightActionOption["type"][]>> = {
  BHISHMA: ["PROTECT_PLAYER"],
  NAKULA: ["ACKNOWLEDGE"],
  SAHADEVA: ["INSPECT_PLAYER", "INSPECT_CENTER"],
  SHAKUNI: ["SWAP_PLAYERS"],
  KRISHNA: ["INSPECT_PAIR"],
  VIDURA: ["INSPECT_PLAYER"],
  DRAUPADI: ["INSPECT_PLAYER"],
  DRONA: ["INSPECT_PLAYER"],
  ARJUNA: ["ARROW_TARGET"],
  SANJAYA: ["PREDICT_MOVES"],
  GANDHARI: ["CHOOSE_PLAYER"],
};
const NIGHT_ROLES = (Object.keys(ROLE_REGISTRY) as RoleId[]).filter((r) => getRole(r).nightAction);

type NightPrompt = Extract<AvailableAction, { kind: "NIGHT_ACTION" }>;

interface Client {
  playerId: string;
  socket: Socket;
  publicView?: PublicGameView;
  privateView?: PrivatePlayerView;
  send(type: ClientEvent["type"], payload?: unknown): Promise<CommandAck>;
}

interface Table {
  clients: Client[];
  prompts: { order: number; playerId: string; role: RoleId; options: NightActionOption["type"][] }[];
  actions: { order: number; playerId: string; role: RoleId; input: NightActionInput; ack: CommandAck }[];
}

const TIMERS = { ROLE_REVEAL: 2, NIGHT_ACTION: 1, DISCUSSION: 60, VOTING: 3, SPECIAL_ELIMINATION: 2, RESULTS: 60, LOBBY_GRACE: 60 };

async function withServer<T>(seed: number, fn: (base: string) => Promise<T>): Promise<T> {
  const config = { ...loadConfig({} as NodeJS.ProcessEnv), port: 0, host: "127.0.0.1", serveWeb: false, cookieSecure: false, timers: TIMERS };
  const server: SabhaServer = await createSabhaServer({ config, rng: new SeededRandomSource(seed) });
  const port = await server.listen();
  try {
    return await fn(`http://127.0.0.1:${port}`);
  } finally {
    await server.close();
  }
}

async function post(base: string, path: string, body: unknown) {
  const res = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const json: any = await res.json();
  expect(res.status, JSON.stringify(json)).toBeLessThan(300);
  return { body: json, cookie: res.headers.get("set-cookie")!.split(";")[0] };
}

async function until(predicate: () => boolean, what: string, timeoutMs = 20_000) {
  const started = Date.now();
  while (!predicate()) {
    if (Date.now() - started > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 20));
  }
}

/** Seats n bots that answer every prompt; night prompts go through `onNight` (return null to stay silent). */
async function playTable(
  base: string,
  mode: GameMode,
  n: number,
  onNight: (prompt: NightPrompt) => NightActionInput | null,
): Promise<Table> {
  const created = await post(base, "/api/games", { playerName: "Host", playerCount: n, mode });
  const seats = [{ cookie: created.cookie, playerId: created.body.playerId as string }];
  for (let i = 1; i < n; i++) {
    const joined = await post(base, `/api/games/${created.body.roomCode}/join`, { playerName: `Player${i}` });
    seats.push({ cookie: joined.cookie, playerId: joined.body.playerId });
  }

  const table: Table = { clients: [], prompts: [], actions: [] };
  let order = 0;
  let rid = 0;
  for (const seat of seats) {
    const socket = connect(base, { transports: ["websocket"], extraHeaders: { cookie: seat.cookie }, forceNew: true });
    const client: Client = {
      playerId: seat.playerId,
      socket,
      send: (type, payload = {}) =>
        new Promise((resolve) => socket.emit(WS_CHANNEL, { v: 1, type, requestId: `r${++rid}`, timestamp: Date.now(), payload }, resolve)),
    };
    const handled = new Set<string>();
    socket.on(WS_CHANNEL, async (event: ServerEvent) => {
      if (event.type === "room.state") client.publicView = event.payload;
      if (event.type === "session.restore") {
        client.publicView = event.payload.game;
        client.privateView = event.payload.privateState;
      }
      if (event.type !== "player.private_state") return;
      client.privateView = event.payload;
      for (const action of event.payload.availableActions) {
        const key = JSON.stringify(action);
        if (handled.has(key)) continue;
        handled.add(key);
        if (action.kind === "CONFIRM_ROLE") await client.send("role.confirm");
        if (action.kind === "END_DISCUSSION") await client.send("discussion.end");
        if (action.kind === "VOTE") await client.send("vote.cast", { targetPlayerId: action.targets[0] });
        if (action.kind === "SPECIAL_ELIMINATION") await client.send("special.elimination", { targetPlayerId: action.targets[0] });
        if (action.kind === "NIGHT_ACTION") {
          table.prompts.push({ order: ++order, playerId: client.playerId, role: action.role, options: action.options.map((o) => o.type) });
          const input = onNight(action);
          if (!input) continue;
          const ack = await client.send("night.action", input);
          table.actions.push({ order: ++order, playerId: client.playerId, role: action.role, input, ack });
        }
      }
    });
    table.clients.push(client);
  }

  const [host] = table.clients;
  await until(() => host.publicView?.players.filter((p) => p.connected).length === n, "everyone to connect");
  await host.send("game.start");
  await until(() => table.clients.every((c) => c.publicView?.phase === "RESULTS"), "results", 30_000);
  for (const c of table.clients) c.socket.disconnect();
  return table;
}

/** Deterministic bot choices, varied so every branch (centre peek, declined swap, ...) gets exercised. */
function chooser(seed: number) {
  const rng = new SeededRandomSource(seed);
  const pick = <T,>(xs: readonly T[]): T => xs[rng.nextInt(xs.length)];
  const pick2 = <T,>(xs: readonly T[]): [T, T] => {
    const a = pick(xs);
    return [a, pick(xs.filter((x) => x !== a))];
  };
  return (prompt: NightPrompt): NightActionInput => {
    const o = pick(prompt.options);
    switch (o.type) {
      case "SWAP_PLAYERS":
      case "INSPECT_PAIR":
        return { type: o.type, targets: pick2(o.targets) };
      case "SWAP_OR_NOT":
        return { type: o.type, targets: o.targets, swap: rng.nextInt(3) > 0 };
      case "INSPECT_CENTER":
        return { type: o.type, slots: pick2(o.slots) };
      case "PREDICT_MOVES":
        return { type: o.type, count: pick(o.choices) };
      case "ACKNOWLEDGE":
        return { type: o.type };
      default:
        return { type: o.type, target: pick(o.targets) };
    }
  };
}

/** Asserts the whole night against a card-by-card replay. Returns the night roles that fully acted. */
function verifyNight(table: Table): RoleId[] {
  const host = table.clients[0].publicView!;
  const results = host.results as GameResults;
  const start = results.startingRoles as Record<string, RoleId>;
  const ids = table.clients.map((c) => c.playerId);
  const knowledge = (pid: string, source: RoleId): KnownInformation[] =>
    table.clients.find((c) => c.playerId === pid)!.privateView!.knownInformation.filter((k) => k.source === source);
  const acted: RoleId[] = [];

  // Every dealt night role wakes the right number of times with the right choices; nobody else wakes.
  for (const pid of ids) {
    const role = start[pid];
    const prompts = table.prompts.filter((p) => p.playerId === pid);
    const actions = table.actions.filter((a) => a.playerId === pid);
    if (!getRole(role).nightAction) {
      expect(prompts, `${role} has no night action`).toHaveLength(0);
      continue;
    }
    const expected = role === "KRISHNA" ? [EXPECTED_OPTIONS.KRISHNA, ["SWAP_OR_NOT"]] : [EXPECTED_OPTIONS[role]];
    expect(prompts.map((p) => p.role), `${role} prompt labels`).toEqual(expected.map(() => role));
    expect(prompts.map((p) => p.options), `${role} options`).toEqual(expected);
    for (const a of actions) expect(a.ack, `${role} ${a.input.type}`).toMatchObject({ ok: true });
    expect(knowledge(pid, role).some((k) => k.kind === "NOTIFICATION" && k.code === "ACTION_SKIPPED"), `${role} timed out`).toBe(false);
    acted.push(role);
  }

  // Wake order follows night priority.
  const priorities = table.prompts.map((p) => getRole(p.role).nightPriority);
  expect(priorities, table.prompts.map((p) => p.role).join(" > ")).toEqual([...priorities].sort((a, b) => a - b));

  // Nakula's vision fires at step start; only Bhishma acts earlier and never moves cards.
  for (const pid of ids.filter((p) => start[p] === "NAKULA")) {
    const twin = ids.find((p) => p !== pid && start[p] === "SAHADEVA");
    const vision = knowledge(pid, "NAKULA")[0];
    if (twin) expect(vision).toMatchObject({ kind: "ROLE", playerId: twin, role: "SAHADEVA" });
    else expect(vision).toMatchObject({ kind: "NOTIFICATION", code: "NO_TWIN" });
  }

  const cards = { ...start };
  let protectedId: string | undefined;
  for (const { playerId, role, input } of [...table.actions].sort((a, b) => a.order - b.order)) {
    const known = knowledge(playerId, role);
    switch (input.type) {
      case "PROTECT_PLAYER":
        protectedId = input.target;
        expect(known).toContainEqual(expect.objectContaining({ attribute: "PROTECTED", playerId: input.target }));
        break;
      case "INSPECT_PLAYER": {
        const held = getRole(cards[input.target]);
        if (role === "SAHADEVA") {
          expect(known).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: input.target, role: held.id }));
        } else {
          const value =
            role === "VIDURA" ? viduraReading(held, host.deck) : role === "DRAUPADI" ? draupadiReading(held, host.deck) : dronaReading(held);
          expect(known, `${role} reading ${held.id}`).toContainEqual(expect.objectContaining({ playerId: input.target, value }));
        }
        break;
      }
      case "INSPECT_CENTER":
        for (const slot of input.slots) {
          expect(known).toContainEqual(expect.objectContaining({ kind: "CENTER", slot, role: results.centerRoles[slot] }));
        }
        break;
      case "INSPECT_PAIR":
        for (const pid of input.targets) {
          const faction = effectiveFaction(getRole(cards[pid]), host.deck);
          expect(known).toContainEqual(expect.objectContaining({ kind: "FACTION", playerId: pid, faction }));
        }
        break;
      case "SWAP_PLAYERS":
      case "SWAP_OR_NOT": {
        if (input.type === "SWAP_OR_NOT" && !input.swap) break;
        const [a, b] = input.targets;
        // Bhishma's protection silently blocks the swap.
        if (a !== protectedId && b !== protectedId) [cards[a], cards[b]] = [cards[b], cards[a]];
        break;
      }
      case "ARROW_TARGET":
        expect(known).toContainEqual(expect.objectContaining({ attribute: "ARROW", playerId: input.target }));
        break;
      case "CHOOSE_PLAYER":
        expect(knowledge(input.target, "GANDHARI")).toContainEqual(expect.objectContaining({ code: "GANDHARI_CHOSE_YOU" }));
        break;
      case "PREDICT_MOVES":
      case "ACKNOWLEDGE":
        break;
    }
  }

  expect(results.finalRoles).toEqual(cards);
  for (const pid of ids.filter((p) => start[p] === "SANJAYA")) {
    expect(knowledge(pid, "SANJAYA")).toContainEqual(expect.objectContaining({ kind: "MOVEMENT_COUNT", count: results.movementCount }));
  }

  // Roles that only wake to see others (Duryodhana, Shakuni, Dushasana, Karna) see exactly the right seats.
  for (const pid of ids) {
    const role = start[pid];
    const sees = getRole(role).startingKnowledge.flatMap((s) => s.roles);
    if (!sees.length) continue;
    const expected = ids.filter((p) => p !== pid && sees.includes(start[p])).sort();
    const seen = [...new Set(knowledge(pid, role).flatMap((k) => (k.kind === "ROLE" ? [k.playerId] : [])))].sort();
    expect(seen, `${role} starting knowledge`).toEqual(expected);
  }
  return acted;
}

describe("night roles over the wire", () => {
  // Seeds are fixed so the deals (and so which roles land on players) are reproducible.
  const TABLES: [GameMode, number][] = [];
  for (const mode of ["BEGINNER", "STANDARD", "ADVANCED"] as const) for (const n of [5, 7, 10]) TABLES.push([mode, n]);

  it("wakes every night role in order and resolves each action correctly", async () => {
    const covered = new Set<RoleId>();
    for (let round = 0; round < 3; round++) {
      for (const [i, [mode, n]] of TABLES.entries()) {
        const seed = round * 100 + i + 1;
        const table = await withServer(seed, (base) => playTable(base, mode, n, chooser(seed)));
        for (const role of verifyNight(table)) covered.add(role);
      }
    }
    expect([...covered].sort()).toEqual([...NIGHT_ROLES].sort());
  }, 120_000);

  it("auto-skips every actor whose night step times out, and the game carries on", async () => {
    const table = await withServer(7, (base) => playTable(base, "STANDARD", 10, () => null));
    const results = table.clients[0].publicView!.results!;
    const start = results.startingRoles as Record<string, RoleId>;
    const actors = table.clients.filter((c) => getRole(start[c.playerId]).nightAction);
    expect(actors.length).toBeGreaterThan(0);
    for (const c of actors) {
      expect(c.privateView!.knownInformation, start[c.playerId]).toContainEqual(expect.objectContaining({ code: "ACTION_SKIPPED" }));
    }
    // Nothing moved.
    expect(results.finalRoles).toEqual(start);
    expect(results.movementCount).toBe(0);
  }, 60_000);
});
