import { describe, expect, it } from "vitest";
import {
  asGameId,
  asPlayerId,
  GAME_MODES,
  ROLE_IDS,
  type PlayerId,
  type RoleId,
} from "@sabha/protocol";
import {
  assertInvariants,
  currentRoleIdOf,
  dealRoles,
  GameEngine,
  GameError,
  getRolePack,
  InvariantViolation,
  SeededRandomSource,
  secureShuffle,
  type InternalGameState,
} from "../src";

function lobby(count: number, engine = new GameEngine({ rng: new SeededRandomSource(7) })) {
  let now = 1_000;
  const ids = Array.from({ length: count }, (_, i) => asPlayerId(`p${i + 1}`));
  let state = engine.createGame(
    { gameId: asGameId("g"), roomCode: "KURU42", mode: "BEGINNER", capacity: Math.max(5, count), host: { id: ids[0], displayName: "Host", sessionId: "s0" } },
    now,
  );
  for (let i = 1; i < count; i++) {
    state = engine.apply(state, { type: "ADD_PLAYER", player: { id: ids[i], displayName: `Player ${i + 1}`, sessionId: `s${i}` } }, now);
  }
  for (const id of ids) state = engine.apply(state, { type: "SET_CONNECTED", playerId: id, connected: true }, now);
  return {
    engine,
    ids,
    get state() {
      return state;
    },
    apply(cmd: Parameters<GameEngine["apply"]>[1], at = now) {
      now = at;
      state = engine.apply(state, cmd, now);
      return state;
    },
    get now() {
      return now;
    },
  };
}

describe("role packs", () => {
  it.each(GAME_MODES.flatMap((mode) => [5, 6, 7, 8, 9, 10].map((n) => [mode, n] as const)))(
    "%s pack for %i players has playerCount + 3 unique roles",
    (mode, n) => {
      const pack = getRolePack(mode, n);
      expect(pack.roles).toHaveLength(n + 3);
      expect(new Set(pack.roles).size).toBe(n + 3);
      expect(pack.roles.every((r) => (ROLE_IDS as readonly string[]).includes(r))).toBe(true);
    },
  );

  it("matches the curated beginner packs from the rules", () => {
    expect(getRolePack("BEGINNER", 5).roles.sort()).toEqual(
      ["DURYODHANA", "SHAKUNI", "YUDHISHTHIRA", "BHIMA", "SAHADEVA", "KRISHNA", "KARNA", "VIDURA"].sort(),
    );
    expect(getRolePack("BEGINNER", 10).roles).toEqual(expect.arrayContaining(["DUSHASANA", "BHISHMA", "DRONA", "ARJUNA", "DRAUPADI"]));
  });

  it("rejects out-of-range tables", () => {
    expect(() => getRolePack("BEGINNER", 4)).toThrow(GameError);
    expect(() => getRolePack("BEGINNER", 11)).toThrow(GameError);
  });
});

describe("dealing and randomness", () => {
  it("deals playerCount cards and 3 to the centre", () => {
    const roles = getRolePack("BEGINNER", 7).roles;
    const players = Array.from({ length: 7 }, (_, i) => asPlayerId(`p${i}`));
    const deal = dealRoles(roles, players, new SeededRandomSource(1));
    expect(deal.playerCards).toHaveLength(7);
    expect(deal.centerCards).toHaveLength(3);
    expect([...deal.playerCards, ...deal.centerCards].sort()).toEqual([...roles].sort());
  });

  it("seeded shuffles are reproducible", () => {
    const a = secureShuffle([1, 2, 3, 4, 5, 6, 7, 8], new SeededRandomSource(99));
    const b = secureShuffle([1, 2, 3, 4, 5, 6, 7, 8], new SeededRandomSource(99));
    expect(a).toEqual(b);
  });

  it("every card gets a unique id", () => {
    const g = lobby(8);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    const ids = Object.keys(g.state.cards);
    expect(new Set(ids).size).toBe(11);
  });
});

describe("lobby", () => {
  it("requires five connected players to start", () => {
    const g = lobby(4);
    expect(() => g.apply({ type: "START_GAME", playerId: g.ids[0] })).toThrow(/more player/);
  });

  it("only the host may start", () => {
    const g = lobby(5);
    expect(() => g.apply({ type: "START_GAME", playerId: g.ids[1] })).toThrowError(expect.objectContaining({ code: "NOT_HOST" }));
  });

  it("rejects duplicate names case-insensitively", () => {
    const g = lobby(5);
    // capacity is 5 → game full first; use a bigger lobby
    const g2 = lobby(3);
    expect(() => g2.apply({ type: "ADD_PLAYER", player: { id: asPlayerId("x"), displayName: "host", sessionId: "x" } }))
      .toThrowError(expect.objectContaining({ code: "NAME_TAKEN" }));
    expect(() => g.apply({ type: "ADD_PLAYER", player: { id: asPlayerId("y"), displayName: "Newcomer", sessionId: "y" } }))
      .toThrowError(expect.objectContaining({ code: "GAME_FULL" }));
  });

  it("refuses joins once the game has begun", () => {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    expect(() => g.apply({ type: "ADD_PLAYER", player: { id: asPlayerId("late"), displayName: "Late", sessionId: "l" } }))
      .toThrowError(expect.objectContaining({ code: "GAME_ALREADY_STARTED" }));
  });

  it("drops players who stay disconnected in the lobby and hands over host", () => {
    const g = lobby(5);
    g.apply({ type: "SET_CONNECTED", playerId: g.ids[0], connected: false });
    const deadline = g.engine.nextDeadline(g.state)!;
    g.apply({ type: "TICK" }, deadline);
    expect(g.state.players[g.ids[0]]).toBeUndefined();
    expect(g.state.hostPlayerId).toBe(g.ids[1]);
  });
});

describe("phases and timers", () => {
  it("runs the full loop driven only by timers", () => {
    const g = lobby(6);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    const seen = [g.state.phase];
    let guard = 0;
    while (g.state.phase !== "RESULTS" && guard++ < 50) {
      const deadline = g.engine.nextDeadline(g.state);
      expect(deadline).not.toBeNull();
      g.apply({ type: "TICK" }, deadline!);
      if (seen.at(-1) !== g.state.phase) seen.push(g.state.phase);
    }
    expect(seen).toEqual(["ROLE_REVEAL", "NIGHT", "DISCUSSION", "VOTING", "RESULTS"]);
    expect(g.state.results!.eliminatedPlayerIds).toEqual([]);
  });

  it("moves from role reveal to night once everyone confirms", () => {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    for (const id of g.ids) g.apply({ type: "CONFIRM_ROLE", playerId: id });
    expect(["NIGHT", "DISCUSSION"]).toContain(g.state.phase);
  });

  it("the host can end discussion early, others cannot", () => {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    while (g.state.phase !== "DISCUSSION") g.apply({ type: "TICK" }, g.engine.nextDeadline(g.state)!);
    expect(() => g.apply({ type: "END_DISCUSSION", playerId: g.ids[1] })).toThrowError(expect.objectContaining({ code: "NOT_HOST" }));
    g.apply({ type: "END_DISCUSSION", playerId: g.ids[0] });
    expect(g.state.phase).toBe("VOTING");
  });

  it("does not mutate the previous state", () => {
    const g = lobby(5);
    const before = g.state;
    const snapshot = JSON.stringify(before);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    expect(JSON.stringify(before)).toBe(snapshot);
    expect(g.state.stateVersion).toBe(before.stateVersion + 1);
  });

  it("rejects out-of-phase commands", () => {
    const g = lobby(5);
    expect(() => g.apply({ type: "CAST_VOTE", playerId: g.ids[0], targetId: g.ids[1] }))
      .toThrowError(expect.objectContaining({ code: "INVALID_PHASE" }));
  });

  it("votes: no self-votes, one vote each", () => {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    while (g.state.phase !== "VOTING") g.apply({ type: "TICK" }, g.engine.nextDeadline(g.state)!);
    expect(() => g.apply({ type: "CAST_VOTE", playerId: g.ids[0], targetId: g.ids[0] })).toThrowError(expect.objectContaining({ code: "INVALID_VOTE" }));
    g.apply({ type: "CAST_VOTE", playerId: g.ids[0], targetId: g.ids[1] });
    expect(() => g.apply({ type: "CAST_VOTE", playerId: g.ids[0], targetId: g.ids[2] })).toThrowError(expect.objectContaining({ code: "ACTION_ALREADY_SUBMITTED" }));
  });

  it("rematch returns everyone to the lobby with fresh state", () => {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    while (g.state.phase !== "RESULTS") g.apply({ type: "TICK" }, g.engine.nextDeadline(g.state)!);
    g.apply({ type: "REMATCH", playerId: g.ids[0] });
    expect(g.state.phase).toBe("LOBBY");
    expect(g.state.round).toBe(2);
    expect(Object.keys(g.state.cards)).toHaveLength(0);
    expect(Object.values(g.state.players).every((p) => p.knownInformation.length === 0 && !p.eliminated)).toBe(true);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    expect(g.state.phase).toBe("ROLE_REVEAL");
  });
});

describe("invariants", () => {
  function started(): InternalGameState {
    const g = lobby(5);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    return structuredClone(g.state);
  }

  it("accepts a valid state", () => {
    expect(() => assertInvariants(started())).not.toThrow();
  });

  it("detects a player holding two cards", () => {
    const s = started();
    const [c1, c2] = Object.values(s.cards).filter((c) => c.currentLocation.type === "PLAYER");
    c2.currentLocation = { ...c1.currentLocation };
    expect(() => assertInvariants(s)).toThrow(InvariantViolation);
  });

  it("detects a missing centre card", () => {
    const s = started();
    const center = Object.values(s.cards).find((c) => c.currentLocation.type === "CENTER")!;
    delete s.cards[center.id];
    expect(() => assertInvariants(s)).toThrow(InvariantViolation);
  });

  it("detects an invalid phase", () => {
    const s = started();
    (s as { phase: string }).phase = "PARTY";
    expect(() => assertInvariants(s)).toThrow(InvariantViolation);
  });
});

describe("information boundaries", () => {
  it("public views never contain role ids before results", () => {
    const g = lobby(10);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    let guard = 0;
    while (g.state.phase !== "RESULTS" && guard++ < 60) {
      const pub = g.engine.publicView(g.state);
      const { deck: _deck, ...rest } = pub;
      const json = JSON.stringify(rest);
      for (const role of ROLE_IDS) expect(json).not.toContain(`"${role}"`);
      g.apply({ type: "TICK" }, g.engine.nextDeadline(g.state)!);
    }
  });

  it("private views only reveal the player's own starting role", () => {
    const g = lobby(6);
    g.apply({ type: "START_GAME", playerId: g.ids[0] });
    for (const id of g.ids) {
      const view = g.engine.privateView(g.state, id, g.now);
      expect(view.startingRole).toBe(currentRoleIdOf(g.state, id));
      expect(view.finalRole).toBeUndefined();
      expect(view.canSeeFinalRole).toBe(false);
    }
  });
});

export type { PlayerId, RoleId };
