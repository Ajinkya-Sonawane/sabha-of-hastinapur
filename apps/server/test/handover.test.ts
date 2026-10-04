import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_TIMERS, GameEngine } from "@sabha/game-engine";
import type { GameId, PlayerId } from "@sabha/protocol";
import { MemoryAnalytics } from "../src/persistence/analytics";
import { InMemoryGameRepository } from "../src/persistence/GameRepository";
import { RoomManager } from "../src/rooms/RoomManager";
import { SessionStore } from "../src/security/sessions";

/**
 * During a deploy the old and new instance run side by side against one
 * database. Two RoomManagers sharing a repository stand in for them.
 */

const managers: RoomManager[] = [];
afterEach(async () => {
  for (const m of managers.splice(0)) await m.shutdown();
});

function instance(repo: InMemoryGameRepository, timers = DEFAULT_TIMERS) {
  const m = new RoomManager(new GameEngine({ timers }), repo, new SessionStore(), new MemoryAnalytics());
  managers.push(m);
  return m;
}

const names = (m: RoomManager, gameId: GameId) => Object.values(m.getState(gameId)!.players).map((p) => p.displayName).sort();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("deploy handover", () => {
  it("catches up when the other instance wrote after this one loaded", async () => {
    const repo = new InMemoryGameRepository();
    const old = instance(repo);
    const host = await old.createGame({ hostName: "Host", playerCount: 5, mode: "BEGINNER" });
    const p2 = await old.joinGame(host.roomCode, "Rahul");

    const fresh = instance(repo);
    await fresh.restore();

    // Still serving traffic on the old instance after the new one booted.
    const late = await old.joinGame(host.roomCode, "Priya");
    await old.execute(host.gameId, host.playerId, "r1", { type: "SET_READY", playerId: host.playerId, ready: true });

    // A session issued by the old instance resolves on the new one.
    expect(await fresh.resolveSession(late.token)).toEqual({ gameId: host.gameId, playerId: late.playerId });
    expect(names(fresh, host.gameId)).toEqual(["Host", "Priya", "Rahul"]);

    // A write from a stale copy reloads and applies on top of the newer state.
    await old.execute(host.gameId, late.playerId, "r2", { type: "SET_READY", playerId: late.playerId, ready: true });
    const ack = await fresh.execute(host.gameId, p2.playerId, "r3", { type: "SET_READY", playerId: p2.playerId, ready: true });
    expect(ack.ok).toBe(true);
    const players = fresh.getState(host.gameId)!.players;
    expect([host.playerId, p2.playerId, late.playerId].map((id) => players[id as PlayerId].ready)).toEqual([true, true, true]);
  });

  it("finds a room the other instance created after this one loaded", async () => {
    const repo = new InMemoryGameRepository();
    const old = instance(repo);
    const fresh = instance(repo);
    await fresh.restore();

    const host = await old.createGame({ hostName: "Host", playerCount: 5, mode: "BEGINNER" });
    expect((await fresh.summary(host.roomCode))?.playerCount).toBe(1);
    expect(await fresh.resolveSession(host.token)).toEqual({ gameId: host.gameId, playerId: host.playerId });

    await fresh.joinGame(host.roomCode, "Rahul");
    // The old instance's next write conflicts, reloads, and keeps the join.
    expect((await old.execute(host.gameId, host.playerId, "r1", { type: "SET_READY", playerId: host.playerId, ready: true })).ok).toBe(true);
    expect(names(old, host.gameId)).toEqual(["Host", "Rahul"]);
  });

  it("gives lobby players a fresh grace period after a restart", async () => {
    const repo = new InMemoryGameRepository();
    const timers = { ...DEFAULT_TIMERS, LOBBY_GRACE: 0.3 };
    const old = instance(repo, timers);
    const host = await old.createGame({ hostName: "Host", playerCount: 5, mode: "BEGINNER" });
    await old.joinGame(host.roomCode, "Rahul");
    await old.shutdown();

    // Longer than the grace period passes before the new instance boots.
    await sleep(400);
    const fresh = instance(repo, timers);
    await fresh.restore();
    await sleep(150);
    expect(names(fresh, host.gameId)).toEqual(["Host", "Rahul"]);

    // Nobody reconnected, so the grace period does run out eventually.
    await sleep(400);
    expect(fresh.getState(host.gameId)).toBeUndefined();
  });

  it("returns null for unknown sessions and codes", async () => {
    const fresh = instance(new InMemoryGameRepository());
    expect(await fresh.resolveSession("not-a-token")).toBeNull();
    expect(await fresh.resolveSession(undefined)).toBeNull();
    expect(await fresh.summary("ZZZZ22")).toBeNull();
  });
});
