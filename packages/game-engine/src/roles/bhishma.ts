import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const BHISHMA: RoleDefinition = {
  id: "BHISHMA",
  name: "Bhishma",
  title: "The Grandsire",
  faction: Faction.KURU,
  tags: ["KURU", "PROTECTOR"],
  // Acts before every swapper so that "protected for the rest of the night"
  // actually shields against Shakuni and Krishna (see README, "Night order").
  nightPriority: 110,
  startingKnowledge: [],
  victory: { type: "BOTH_SURVIVE", roles: ["YUDHISHTHIRA", "DURYODHANA"] },
  nightAction: {
    options: (ctx) => [{ type: "PROTECT_PLAYER", targets: ctx.allPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "PROTECT_PLAYER") return "DONE";
      ctx.state.night!.protectedPlayerId = input.target;
      ctx.record("PROTECT", { target: input.target });
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER", attribute: "PROTECTED", playerId: input.target, source: "BHISHMA", observedAt: ctx.now,
      });
      return "DONE";
    },
  },
};
