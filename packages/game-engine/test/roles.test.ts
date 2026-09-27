import { describe, expect, it } from "vitest";
import { Faction, type PlayerId } from "@sabha/protocol";
import { GameError } from "../src";
import { setup } from "./helpers";

const expectGameError = (fn: () => unknown, code: string) => {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(GameError);
    expect((e as GameError).code).toBe(code);
    return;
  }
  throw new Error(`expected GameError ${code}`);
};

describe("Duryodhana", () => {
  it("sees the other starting conspirators but not Karna", () => {
    const h = setup(["DURYODHANA", "SHAKUNI", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    const known = h.knowledge("A");
    expect(known).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: h.byName.B, role: "SHAKUNI" }));
    expect(known.some((k) => "playerId" in k && k.playerId === h.byName.C)).toBe(false);
  });

  it("is told when he stands alone", () => {
    const h = setup(["DURYODHANA", "SAHADEVA", "KARNA", "BHIMA", "YUDHISHTHIRA"], ["SHAKUNI", "VIDURA", "KRISHNA"]);
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "NOTIFICATION", code: "NO_OTHER_CONSPIRATORS" }));
  });
});

describe("Shakuni", () => {
  const roles = ["SHAKUNI", "DURYODHANA", "BHIMA", "SAHADEVA", "YUDHISHTHIRA"] as const;

  it("swaps two unprotected players", () => {
    const h = setup([...roles]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] });
    expect(h.role("C")).toBe("YUDHISHTHIRA");
    expect(h.role("E")).toBe("BHIMA");
    expect(h.state.night!.movementCount).toBe(2);
  });

  it("does not see either card", () => {
    const h = setup([...roles]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] });
    const learned = h.knowledge("A").filter((k) => k.kind === "ROLE" && (k.playerId === h.byName.C || k.playerId === h.byName.E));
    expect(learned).toHaveLength(0);
  });

  it("cannot target himself", () => {
    const h = setup([...roles]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    expectGameError(() => h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.A, h.byName.C] }), "INVALID_TARGET");
  });

  it("cannot pick the same player twice", () => {
    const h = setup([...roles]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    expectGameError(() => h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.C] }), "INVALID_TARGET");
  });

  it("cannot swap a protected player", () => {
    const h = setup(["SHAKUNI", "BHISHMA", "BHIMA", "SAHADEVA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("B", { type: "PROTECT_PLAYER", target: h.byName.C });
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] });
    expect(h.role("C")).toBe("BHIMA");
    expect(h.role("E")).toBe("YUDHISHTHIRA");
    expect(h.state.night!.movementCount).toBe(0);
  });

  it("cannot act out of turn", () => {
    const h = setup([...roles]);
    h.confirmAll();
    // Sahadeva (120) acts before Shakuni (130).
    expectGameError(() => h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] }), "NOT_YOUR_TURN");
  });

  it("cannot act twice", () => {
    const h = setup(["SHAKUNI", "DURYODHANA", "BHIMA", "KRISHNA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] });
    expectGameError(() => h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] }), "ACTION_ALREADY_SUBMITTED");
  });
});

describe("Dushasana", () => {
  it("sees the other conspirators", () => {
    const h = setup(["DUSHASANA", "DURYODHANA", "SHAKUNI", "BHIMA", "YUDHISHTHIRA"]);
    const roles = h.knowledge("A").filter((k) => k.kind === "ROLE").map((k) => (k as { role: string }).role).sort();
    expect(roles).toEqual(["DURYODHANA", "SHAKUNI"]);
  });
});

describe("Ashwatthama", () => {
  it("takes one surviving player with him", () => {
    const h = setup(["ASHWATTHAMA", "BHIMA", "YUDHISHTHIRA", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    expect(h.state.phase).toBe("RESOLUTION");
    h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.A, targetId: h.byName.C });
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds.sort()).toEqual([h.byName.A, h.byName.C].sort());
  });

  it("cannot choose an eliminated player or himself", () => {
    const h = setup(["ASHWATTHAMA", "BHIMA", "YUDHISHTHIRA", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    expectGameError(() => h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.A, targetId: h.byName.A }), "INVALID_TARGET");
  });

  it("lapses if he does not choose in time", () => {
    const h = setup(["ASHWATTHAMA", "BHIMA", "YUDHISHTHIRA", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    h.advance(31_000);
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds).toEqual([h.byName.A]);
  });
});

describe("Yudhishthira", () => {
  it("counts double against a Kaurava Conspirator", () => {
    const h = setup(["YUDHISHTHIRA", "SHAKUNI", "BHIMA", "VIDURA", "KARNA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "B");
    h.vote("B", "C");
    h.vote("C", "D");
    h.vote("D", "C");
    h.vote("E", "A");
    const result = h.state.voting!.result!;
    expect(result.totals[h.byName.B]).toBe(2);
    expect(result.primaryTargets.sort()).toEqual([h.byName.B, h.byName.C].sort());
  });

  it("counts once against anyone else, including Karna", () => {
    const h = setup(["YUDHISHTHIRA", "SHAKUNI", "BHIMA", "VIDURA", "KARNA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "E");
    expect(h.state.voting!.votes[h.byName.A].weight).toBe(1);
  });

  it("never tells the client why a vote weighed more", () => {
    const h = setup(["YUDHISHTHIRA", "SHAKUNI", "BHIMA", "VIDURA", "KARNA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "B");
    const pub = JSON.stringify(h.engine.publicView(h.state));
    const priv = JSON.stringify(h.engine.privateView(h.state, h.byName.A, h.now));
    expect(pub).not.toContain("weight");
    expect(priv).not.toContain("weight");
    expect(pub).not.toContain(h.byName.B + '":2');
  });
});

describe("Bhima", () => {
  it("chooses one other surviving player to fall with him", () => {
    const h = setup(["BHIMA", "DURYODHANA", "SHAKUNI", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    const view = h.engine.privateView(h.state, h.byName.A, h.now);
    const action = view.availableActions.find((a) => a.kind === "SPECIAL_ELIMINATION");
    expect(action).toBeDefined();
    expect(action && "targets" in action && action.targets).not.toContain(h.byName.A);
    h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.A, targetId: h.byName.B });
    expect(h.state.results!.winningTeams).toContain(Faction.DHARMA);
  });

  it("other players cannot use Bhima's revenge", () => {
    const h = setup(["BHIMA", "DURYODHANA", "SHAKUNI", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    expectGameError(() => h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.B, targetId: h.byName.D }), "INVALID_PHASE");
  });
});

describe("Arjuna", () => {
  it("prepares an arrow without learning anything", () => {
    const h = setup(["ARJUNA", "DURYODHANA", "SHAKUNI", "VIDURA", "BHIMA"]);
    h.confirmAll();
    // Shakuni 130, Vidura 150, Arjuna 190
    h.act("C", { type: "SWAP_PLAYERS", targets: [h.byName.D, h.byName.E] });
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.A });
    h.act("A", { type: "ARROW_TARGET", target: h.byName.B });
    const learned = h.knowledge("A").filter((k) => k.kind === "ROLE" || k.kind === "FACTION");
    expect(learned).toHaveLength(0);
    expect(h.state.night!.arrow).toEqual({ archerId: h.byName.A, targetId: h.byName.B });
  });

  it("the arrow strikes when Arjuna is eliminated", () => {
    const h = setup(["ARJUNA", "DURYODHANA", "SHAKUNI", "VIDURA", "BHIMA"]);
    h.confirmAll();
    h.act("C", { type: "SWAP_PLAYERS", targets: [h.byName.D, h.byName.E] });
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.A });
    h.act("A", { type: "ARROW_TARGET", target: h.byName.B });
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "C");
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds.sort()).toEqual([h.byName.A, h.byName.B].sort());
    expect(h.state.results!.winningTeams).toContain(Faction.DHARMA);
  });

  it("cannot aim at himself", () => {
    const h = setup(["ARJUNA", "DURYODHANA", "YUDHISHTHIRA", "VIDURA", "BHIMA"]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.A });
    expectGameError(() => h.act("A", { type: "ARROW_TARGET", target: h.byName.A }), "INVALID_TARGET");
  });
});

describe("Nakula", () => {
  it("senses Sahadeva", () => {
    const h = setup(["NAKULA", "SAHADEVA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: h.byName.B, role: "SAHADEVA" }));
    h.act("A", { type: "ACKNOWLEDGE" });
    expect(h.state.players[h.byName.A].nightActionSubmitted).toBe(true);
  });

  it("senses no twin when Sahadeva is in the centre", () => {
    const h = setup(["NAKULA", "VIDURA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"], ["SAHADEVA", "KARNA", "SHAKUNI"]);
    h.confirmAll();
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "NOTIFICATION", code: "NO_TWIN", message: "You sense no twin." }));
  });
});

describe("Sahadeva", () => {
  it("inspects a player's role and faction", () => {
    const h = setup(["SAHADEVA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_PLAYER", target: h.byName.C });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: h.byName.C, role: "KARNA" }));
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "FACTION", playerId: h.byName.C, faction: Faction.KAURAVA }));
  });

  it("inspects two centre cards", () => {
    const h = setup(["SAHADEVA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"], ["VIDURA", "SHAKUNI", "KRISHNA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_CENTER", slots: [0, 2] });
    const center = h.knowledge("A").filter((k) => k.kind === "CENTER");
    expect(center).toEqual([
      expect.objectContaining({ slot: 0, role: "VIDURA" }),
      expect.objectContaining({ slot: 2, role: "KRISHNA" }),
    ]);
  });

  it("cannot inspect the same centre card twice", () => {
    const h = setup(["SAHADEVA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    expectGameError(() => h.act("A", { type: "INSPECT_CENTER", slots: [1, 1] }), "INVALID_TARGET");
  });
});

describe("Draupadi", () => {
  it("reads current allegiance", () => {
    const h = setup(["DRAUPADI", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_PLAYER", target: h.byName.C });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ attribute: "ALLEGIANCE", playerId: h.byName.C, value: "AGAINST_PANDAVAS" }));
  });
});

describe("Krishna", () => {
  it("sees two factions and may swap without seeing the result", () => {
    const h = setup(["KRISHNA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_PAIR", targets: [h.byName.B, h.byName.D] });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "FACTION", playerId: h.byName.B, faction: Faction.KAURAVA }));
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "FACTION", playerId: h.byName.D, faction: Faction.DHARMA }));
    expect(h.state.phase).toBe("NIGHT");
    const before = h.knowledge("A").length;
    h.act("A", { type: "SWAP_OR_NOT", targets: [h.byName.B, h.byName.D], swap: true });
    expect(h.role("B")).toBe("BHIMA");
    expect(h.role("D")).toBe("DURYODHANA");
    const after = h.knowledge("A").slice(before);
    expect(after.every((k) => k.kind === "PLAYER")).toBe(true);
  });

  it("may leave the cards unchanged", () => {
    const h = setup(["KRISHNA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_PAIR", targets: [h.byName.B, h.byName.D] });
    h.act("A", { type: "SWAP_OR_NOT", targets: [h.byName.B, h.byName.D], swap: false });
    expect(h.role("B")).toBe("DURYODHANA");
    expect(h.state.night!.movementCount).toBe(0);
  });

  it("must decide on the pair he inspected", () => {
    const h = setup(["KRISHNA", "DURYODHANA", "KARNA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "INSPECT_PAIR", targets: [h.byName.B, h.byName.D] });
    expectGameError(() => h.act("A", { type: "SWAP_OR_NOT", targets: [h.byName.B, h.byName.E], swap: true }), "INVALID_TARGET");
  });
});

describe("Vidura", () => {
  it.each([
    ["DURYODHANA", "KAURAVA"],
    ["BHIMA", "PANDAVA"],
    ["KARNA", "OTHER"],
  ] as const)("reads %s as %s", (role, reading) => {
    const roles = ["VIDURA", role, "SAHADEVA", "KRISHNA", "YUDHISHTHIRA"] as const;
    const h = setup([...roles], ["DUSHASANA", "DRONA", "ARJUNA"]);
    h.confirmAll();
    h.act("C", { type: "INSPECT_CENTER", slots: [0, 1] });
    h.act("D", { type: "INSPECT_PAIR", targets: [h.byName.C, h.byName.E] });
    h.act("D", { type: "SWAP_OR_NOT", targets: [h.byName.C, h.byName.E], swap: false });
    h.act("A", { type: "INSPECT_PLAYER", target: h.byName.B });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ attribute: "BROAD_FACTION", value: reading }));
  });
});

describe("Karna", () => {
  it("sees Duryodhana, who does not see him", () => {
    const h = setup(["KARNA", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: h.byName.B, role: "DURYODHANA" }));
    expect(h.knowledge("B").some((k) => "playerId" in k && k.playerId === h.byName.A)).toBe(false);
  });

  it("loses personally when he is removed, even if the Kauravas win", () => {
    const h = setup(["KARNA", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "C");
    const results = h.state.results!;
    expect(results.winningTeams).toContain(Faction.KAURAVA);
    expect(results.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(false);
    expect(results.playerResults.find((r) => r.playerId === h.byName.B)!.won).toBe(true);
  });

  it("is not a conspirator: removing only Karna does not give Dharma the win", () => {
    const h = setup(["KARNA", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "C");
    expect(h.state.results!.winningTeams).not.toContain(Faction.DHARMA);
  });
});

describe("Bhishma", () => {
  it("wins when Yudhishthira and Duryodhana both survive", () => {
    const h = setup(["BHISHMA", "DURYODHANA", "YUDHISHTHIRA", "VIDURA", "BHIMA"]);
    h.confirmAll();
    h.act("A", { type: "PROTECT_PLAYER", target: h.byName.B });
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.E });
    h.toVoting();
    for (const n of ["A", "B", "C", "E"]) h.vote(n, "D");
    h.vote("D", "E");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(true);
  });

  it("loses when a required role sits in the centre", () => {
    const h = setup(["BHISHMA", "DURYODHANA", "SAHADEVA", "VIDURA", "BHIMA"], ["YUDHISHTHIRA", "KARNA", "SHAKUNI"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["A", "B", "C", "E"]) h.vote(n, "D");
    h.vote("D", "E");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(false);
  });

  it("does not prevent inspections", () => {
    const h = setup(["BHISHMA", "DURYODHANA", "SAHADEVA", "VIDURA", "BHIMA"]);
    h.confirmAll();
    h.act("A", { type: "PROTECT_PLAYER", target: h.byName.B });
    h.act("C", { type: "INSPECT_PLAYER", target: h.byName.B });
    expect(h.knowledge("C")).toContainEqual(expect.objectContaining({ kind: "ROLE", role: "DURYODHANA" }));
  });
});

describe("Drona", () => {
  it.each([
    ["BHIMA", "PANDAVA_TRAINED"],
    ["KARNA", "KURU_TRAINED"],
    ["KRISHNA", "UNKNOWN"],
  ] as const)("reads %s as %s", (role, reading) => {
    const h = setup(["DRONA", role, "DURYODHANA", "VIDURA", "YUDHISHTHIRA"], ["DUSHASANA", "SANJAYA", "ARJUNA"]);
    h.confirmAll();
    if (role === "KRISHNA") {
      h.act("B", { type: "INSPECT_PAIR", targets: [h.byName.C, h.byName.E] });
      h.act("B", { type: "SWAP_OR_NOT", targets: [h.byName.C, h.byName.E], swap: false });
    }
    // Vidura (150) acts before Drona (170).
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.E });
    h.act("A", { type: "INSPECT_PLAYER", target: h.byName.B });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ attribute: "TRAINING", value: reading }));
  });

  it("wins when a Dharma player and a conspirator both survive", () => {
    const h = setup(["DRONA", "DURYODHANA", "YUDHISHTHIRA", "KARNA", "BHIMA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["A", "B", "C", "E"]) h.vote(n, "D");
    h.vote("D", "E");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(true);
  });
});

describe("Sanjaya", () => {
  it("seals a prediction and learns the true count at dawn", () => {
    const h = setup(["SANJAYA", "SHAKUNI", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("B", { type: "SWAP_PLAYERS", targets: [h.byName.D, h.byName.E] });
    expect(h.knowledge("A").some((k) => k.kind === "MOVEMENT_COUNT")).toBe(false);
    h.act("A", { type: "PREDICT_MOVES", count: "2" });
    expect(h.state.phase).toBe("DISCUSSION");
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ kind: "MOVEMENT_COUNT", count: 2, prediction: "2" }));
    h.toVoting();
    for (const n of ["A", "B", "C", "E"]) h.vote(n, "D");
    h.vote("D", "E");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(true);
  });

  it("loses on a wrong prediction", () => {
    const h = setup(["SANJAYA", "SHAKUNI", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("B", { type: "SWAP_PLAYERS", targets: [h.byName.D, h.byName.E] });
    h.act("A", { type: "PREDICT_MOVES", count: "4+" });
    h.toVoting();
    for (const n of ["A", "B", "C", "E"]) h.vote(n, "D");
    h.vote("D", "E");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(false);
  });
});

describe("Shikhandi", () => {
  it("wins when Bhishma is eliminated", () => {
    const h = setup(["SHIKHANDI", "BHISHMA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["A", "C", "D", "E"]) h.vote(n, "B");
    h.vote("B", "A");
    const me = h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!;
    expect(me.faction).toBe(Faction.INDEPENDENT);
    expect(me.won).toBe(true);
  });

  it("becomes Dharma when Bhishma is not in the game", () => {
    const h = setup(["SHIKHANDI", "SAHADEVA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"], ["VIDURA", "KARNA", "KRISHNA"]);
    h.confirmAll();
    h.act("B", { type: "INSPECT_PLAYER", target: h.byName.A });
    expect(h.knowledge("B")).toContainEqual(expect.objectContaining({ kind: "FACTION", faction: Faction.DHARMA }));
    h.toVoting();
    for (const n of ["A", "B", "D", "E"]) h.vote(n, "C");
    h.vote("C", "A");
    const me = h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!;
    expect(me.faction).toBe(Faction.DHARMA);
    expect(me.won).toBe(true);
  });
});

describe("Gandhari", () => {
  it("notifies the chosen player and nothing else", () => {
    const h = setup(["GANDHARI", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_PLAYER", target: h.byName.E });
    h.act("A", { type: "CHOOSE_PLAYER", target: h.byName.C });
    expect(h.knowledge("C")).toContainEqual(expect.objectContaining({ code: "GANDHARI_CHOSE_YOU", message: "Gandhari has chosen you." }));
    expect(h.role("C")).toBe("BHIMA");
  });

  it("a vote for Duryodhana silently counts for nothing", () => {
    const h = setup(["GANDHARI", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "B"); // accepted — rejecting it would reveal Duryodhana
    expect(h.state.voting!.votes[h.byName.A].weight).toBe(0);
  });

  it("wins when Duryodhana survives and a Pandava falls", () => {
    const h = setup(["GANDHARI", "DURYODHANA", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["A", "B", "D", "C"]) h.vote(n, "E");
    h.vote("E", "D");
    expect(h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!.won).toBe(true);
  });
});

export type { PlayerId };
