import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const ARJUNA: RoleDefinition = {
  id: "ARJUNA",
  name: "Arjuna",
  title: "The Archer",
  faction: Faction.DHARMA,
  tags: ["PANDAVA", "REVENGE"],
  nightPriority: 190,
  startingKnowledge: [],
  eliminationEffect: { type: "ARROW" },
  victory: { type: "DHARMA" },
  trainingFaction: "PANDAVA_TRAINED",
  nightAction: {
    options: (ctx) => [{ type: "ARROW_TARGET", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "ARROW_TARGET") return "DONE";
      // Arjuna does not learn anything about the target.
      ctx.state.night!.arrow = { archerId: ctx.actor.id, targetId: input.target };
      ctx.record("ARROW_AIMED", { target: input.target });
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER",
        attribute: "ARROW",
        playerId: input.target,
        source: "ARJUNA",
        observedAt: ctx.now,
      });
      return "DONE";
    },
  },
};
