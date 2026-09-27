import { describe, expect, it } from "vitest";
import { Faction } from "@sabha/protocol";
import { setup } from "./helpers";

describe("interactions", () => {
  it("Bhishma protects a player from Shakuni", () => {
    const h = setup(["BHISHMA", "SHAKUNI", "BHIMA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "PROTECT_PLAYER", target: h.byName.C }); // protect("C")
    h.act("B", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] }); // swap("C","E")
    expect(h.role("C")).toEqual(h.initialRole("C"));
    expect(h.role("E")).toEqual(h.initialRole("E"));
  });

  it("Bhishma protects a player from Krishna, who still learns the factions", () => {
    const h = setup(["BHISHMA", "KRISHNA", "DURYODHANA", "VIDURA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "PROTECT_PLAYER", target: h.byName.C });
    h.act("B", { type: "INSPECT_PAIR", targets: [h.byName.C, h.byName.E] });
    expect(h.knowledge("B")).toContainEqual(expect.objectContaining({ kind: "FACTION", playerId: h.byName.C, faction: Faction.KAURAVA }));
    h.act("B", { type: "SWAP_OR_NOT", targets: [h.byName.C, h.byName.E], swap: true });
    expect(h.role("C")).toBe("DURYODHANA");
    expect(h.state.events.some((e) => e.type === "SWAP_BLOCKED")).toBe(true);
  });

  it("Shakuni then Krishna: Krishna reads the cards after Shakuni's swap", () => {
    const h = setup(["SHAKUNI", "KRISHNA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.D] });
    h.act("B", { type: "INSPECT_PAIR", targets: [h.byName.C, h.byName.D] });
    expect(h.knowledge("B")).toContainEqual(expect.objectContaining({ playerId: h.byName.C, faction: Faction.DHARMA }));
    expect(h.knowledge("B")).toContainEqual(expect.objectContaining({ playerId: h.byName.D, faction: Faction.KAURAVA }));
    h.act("B", { type: "SWAP_OR_NOT", targets: [h.byName.C, h.byName.D], swap: true });
    expect(h.role("C")).toBe("DURYODHANA");
    expect(h.state.night!.movementCount).toBe(4);
  });

  it("Shakuni + Sahadeva: Sahadeva's vision predates the swap", () => {
    const h = setup(["SHAKUNI", "SAHADEVA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("B", { type: "INSPECT_PLAYER", target: h.byName.C });
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.D] });
    expect(h.knowledge("B")).toContainEqual(expect.objectContaining({ kind: "ROLE", playerId: h.byName.C, role: "DURYODHANA" }));
    expect(h.role("C")).toBe("BHIMA");
  });

  it("Krishna + Sahadeva: Sahadeva can be swapped away from his own card", () => {
    const h = setup(["KRISHNA", "SAHADEVA", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("B", { type: "INSPECT_PLAYER", target: h.byName.C });
    h.act("A", { type: "INSPECT_PAIR", targets: [h.byName.B, h.byName.C] });
    h.act("A", { type: "SWAP_OR_NOT", targets: [h.byName.B, h.byName.C], swap: true });
    // B started as Sahadeva (and acted as Sahadeva) but now holds Duryodhana.
    expect(h.role("B")).toBe("DURYODHANA");
    h.toVoting();
    for (const n of ["A", "C", "D", "E"]) h.vote(n, "B");
    h.vote("B", "A");
    const b = h.state.results!.playerResults.find((r) => r.playerId === h.byName.B)!;
    expect(b.startingRole).toBe("SAHADEVA");
    expect(b.finalRole).toBe("DURYODHANA");
    expect(b.faction).toBe(Faction.KAURAVA);
    expect(b.won).toBe(false);
    expect(h.state.results!.winningTeams).toContain(Faction.DHARMA);
  });

  it("Karna + Duryodhana: Karna's win depends on his FINAL card", () => {
    const h = setup(["KARNA", "DURYODHANA", "SHAKUNI", "SAHADEVA", "YUDHISHTHIRA"]);
    h.confirmAll();
    h.act("D", { type: "INSPECT_CENTER", slots: [0, 1] });
    h.act("C", { type: "SWAP_PLAYERS", targets: [h.byName.A, h.byName.D] });
    expect(h.role("A")).toBe("SAHADEVA");
    h.toVoting();
    for (const n of ["A", "B", "C", "D"]) h.vote(n, "E");
    h.vote("E", "A");
    const a = h.state.results!.playerResults.find((r) => r.playerId === h.byName.A)!;
    expect(a.finalRole).toBe("SAHADEVA");
    expect(a.won).toBe(false); // Dharma lost: no conspirator removed
    const d = h.state.results!.playerResults.find((r) => r.playerId === h.byName.D)!;
    expect(d.finalRole).toBe("KARNA");
    expect(d.won).toBe(true);
  });

  it("Bhima + Arjuna: Bhima takes Arjuna, whose arrow takes a third", () => {
    const h = setup(["BHIMA", "ARJUNA", "DURYODHANA", "SHAKUNI", "VIDURA"]);
    h.confirmAll();
    h.act("D", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.E] });
    h.act("E", { type: "INSPECT_PLAYER", target: h.byName.A });
    h.act("B", { type: "ARROW_TARGET", target: h.byName.D });
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "B");
    expect(h.state.phase).toBe("RESOLUTION");
    h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.A, targetId: h.byName.B });
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds.sort()).toEqual([h.byName.A, h.byName.B, h.byName.D].sort());
    expect(h.state.results!.winningTeams).toContain(Faction.DHARMA);
  });

  it("Ashwatthama + Bhima: revenge chains resolve until the queue is empty", () => {
    const h = setup(["ASHWATTHAMA", "BHIMA", "YUDHISHTHIRA", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    for (const n of ["B", "C", "D", "E"]) h.vote(n, "A");
    h.vote("A", "C");
    h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.A, targetId: h.byName.B });
    expect(h.state.phase).toBe("RESOLUTION");
    h.apply({ type: "SPECIAL_ELIMINATION", playerId: h.byName.B, targetId: h.byName.D });
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds.sort()).toEqual([h.byName.A, h.byName.B, h.byName.D].sort());
  });

  it("Yudhishthira + Kaurava: the double vote decides a close Sabha", () => {
    const h = setup(["YUDHISHTHIRA", "DURYODHANA", "BHIMA", "VIDURA", "SAHADEVA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "B");
    h.vote("B", "C");
    h.vote("C", "B");
    h.vote("D", "C");
    h.vote("E", "C");
    // B: 2 (Yudhishthira) + 1 = 3; C: 3 → tie, both removed
    expect(h.state.voting!.result!.primaryTargets.sort()).toEqual([h.byName.B, h.byName.C].sort());
    expect(h.state.phase).toBe("RESOLUTION"); // Bhima's revenge
  });

  it("Draupadi + Shakuni: Draupadi reads the card as it is after the swap", () => {
    const h = setup(["DRAUPADI", "SHAKUNI", "DURYODHANA", "BHIMA", "YUDHISHTHIRA"], ["VIDURA", "KARNA", "KRISHNA"]);
    h.confirmAll();
    h.act("B", { type: "SWAP_PLAYERS", targets: [h.byName.C, h.byName.D] });
    h.act("A", { type: "INSPECT_PLAYER", target: h.byName.C });
    expect(h.knowledge("A")).toContainEqual(expect.objectContaining({ value: "WITH_PANDAVAS" }));
  });

  it("a swapped player keeps their STARTING night action", () => {
    const h = setup(["SHAKUNI", "VIDURA", "DRAUPADI", "BHIMA", "YUDHISHTHIRA"], ["DURYODHANA", "KARNA", "KRISHNA"]);
    h.confirmAll();
    h.act("A", { type: "SWAP_PLAYERS", targets: [h.byName.B, h.byName.D] });
    // B now holds Bhima but still acts as Vidura.
    const view = h.engine.privateView(h.state, h.byName.B, h.now);
    expect(view.availableActions[0]).toMatchObject({ kind: "NIGHT_ACTION", role: "VIDURA" });
    // D now holds Vidura but gains no action.
    expect(h.engine.privateView(h.state, h.byName.D, h.now).availableActions).toHaveLength(0);
  });

  it("with no conspirator in play, Dharma wins only if someone is removed", () => {
    const h = setup(["BHIMA", "VIDURA", "SAHADEVA", "KARNA", "YUDHISHTHIRA"], ["DURYODHANA", "SHAKUNI", "KRISHNA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.vote("A", "D");
    h.vote("B", "D");
    h.vote("C", "D");
    h.vote("E", "D");
    h.vote("D", "A");
    expect(h.state.results!.winningTeams).toContain(Faction.DHARMA);
    expect(h.state.results!.winningTeams).not.toContain(Faction.KAURAVA);
  });

  it("with no votes at all, nobody is removed", () => {
    const h = setup(["BHIMA", "VIDURA", "SAHADEVA", "KARNA", "DURYODHANA"]);
    h.confirmAll();
    h.skipNight();
    h.toVoting();
    h.advance(31_000);
    expect(h.state.phase).toBe("RESULTS");
    expect(h.state.results!.eliminatedPlayerIds).toEqual([]);
    expect(h.state.results!.winningTeams).toContain(Faction.KAURAVA);
  });
});
