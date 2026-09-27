import { describe, expect, it } from "vitest";
import { Faction, ROLE_IDS } from "@sabha/protocol";
import { assertInvariants, currentRoleIdOf } from "../src";
import { NAMES, setup } from "./helpers";

describe("ten-player game, end to end", () => {
  it("plays Start → Deal → Reveal → Night → Discussion → Votes → Resolution → Results", () => {
    // P1 Duryodhana … P10 Bhishma, + 3 centre cards
    const h = setup(
      ["DURYODHANA", "SHAKUNI", "DUSHASANA", "YUDHISHTHIRA", "BHIMA", "SAHADEVA", "KRISHNA", "VIDURA", "KARNA", "BHISHMA"],
      ["DRONA", "ARJUNA", "DRAUPADI"],
    );
    const [A, B, C, D, E, F, G, H, I, J] = NAMES;
    const id = h.byName;

    // Deal
    expect(h.state.phase).toBe("ROLE_REVEAL");
    assertInvariants(h.state);
    expect(Object.keys(h.state.cards)).toHaveLength(13);

    // Starting knowledge
    expect(h.knowledge(A).filter((k) => k.kind === "ROLE").map((k) => (k as { role: string }).role).sort()).toEqual(["DUSHASANA", "SHAKUNI"]);
    expect(h.knowledge(I)).toContainEqual(expect.objectContaining({ playerId: id[A], role: "DURYODHANA" }));

    // Role reveal
    h.confirmAll();
    expect(h.state.phase).toBe("NIGHT");

    // Bhishma (110) protects Yudhishthira
    h.act(J, { type: "PROTECT_PLAYER", target: id[D] });
    // Sahadeva (120) inspects Duryodhana
    h.act(F, { type: "INSPECT_PLAYER", target: id[A] });
    // Shakuni (130) swaps Karna ↔ Sahadeva
    h.act(B, { type: "SWAP_PLAYERS", targets: [id[I], id[F]] });
    // Krishna (140) inspects Bhima + Karna's seat, leaves them
    h.act(G, { type: "INSPECT_PAIR", targets: [id[E], id[I]] });
    expect(h.knowledge(G)).toContainEqual(expect.objectContaining({ playerId: id[I], faction: Faction.DHARMA }));
    h.act(G, { type: "SWAP_OR_NOT", targets: [id[E], id[I]], swap: false });
    // Vidura (150)
    h.act(H, { type: "INSPECT_PLAYER", target: id[C] });

    expect(h.state.phase).toBe("DISCUSSION");
    assertInvariants(h.state);
    expect(h.role(F)).toBe("KARNA");
    expect(h.role(I)).toBe("SAHADEVA");

    // Discussion → Voting
    h.toVoting();
    expect(h.state.phase).toBe("VOTING");

    // Votes: Shakuni (B) takes 5, Yudhishthira's vote on B counts twice
    h.vote(A, C);
    h.vote(B, E);
    h.vote(C, E);
    h.vote(D, B);
    h.vote(E, B);
    h.vote(F, E);
    h.vote(G, B);
    h.vote(H, B);
    h.vote(I, A);
    h.vote(J, C);
    expect(Object.keys(h.state.voting!.votes)).toHaveLength(10);
    expect(h.state.voting!.result!.totals[id[B]]).toBe(5);
    expect(h.state.voting!.result!.primaryTargets).toEqual([id[B]]);

    // Resolution → Results
    expect(h.state.phase).toBe("RESULTS");
    const results = h.state.results!;
    expect(results.eliminatedPlayerIds).toEqual([id[B]]);
    expect(results.winningTeams).toContain(Faction.DHARMA);
    expect(results.winningTeams).not.toContain(Faction.KAURAVA);

    // Final roles correct
    for (const n of NAMES) expect(results.finalRoles[id[n]]).toBe(currentRoleIdOf(h.state, id[n]));
    expect(results.startingRoles[id[F]]).toBe("SAHADEVA");
    expect(results.finalRoles[id[F]]).toBe("KARNA");

    // Victory conditions
    const won = (n: string) => results.playerResults.find((r) => r.playerId === id[n])!.won;
    expect(won(D)).toBe(true); // Yudhishthira
    expect(won(I)).toBe(true); // now Sahadeva
    expect(won(F)).toBe(false); // now Karna, conspirator fell
    expect(won(A)).toBe(false); // Duryodhana
    expect(won(J)).toBe(true); // Bhishma: Yudhishthira and Duryodhana survive

    // What happened
    const text = results.explanation.map((e) => e.text).join("\n");
    expect(text).toContain("Karna ↔ Sahadeva");
    expect(text).toContain("Dharma Vote");

    // No duplicate cards
    const cardIds = Object.keys(h.state.cards);
    expect(new Set(cardIds).size).toBe(13);

    // No leaked roles in anything a non-final client received during play
    // (checked exhaustively in engine.test.ts); here, the results are public.
    expect(h.engine.publicView(h.state).results).not.toBeNull();
    const priv = h.engine.privateView(h.state, id[F], h.now);
    expect(priv.finalRole).toBe("KARNA");
    expect(ROLE_IDS).toContain(priv.startingRole);
  });
});
