import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const GANDHARI: RoleDefinition = {
  id: "GANDHARI",
  name: "Gandhari",
  title: "The Blindfolded Queen",
  faction: Faction.INDEPENDENT,
  tags: ["INDEPENDENT"],
  nightPriority: 210,
  startingKnowledge: [],
  // Enforced silently server-side: rejecting the vote would reveal Duryodhana.
  votingRule: { type: "NULL_AGAINST_ROLE", role: "DURYODHANA" },
  victory: { type: "CUSTOM", ruleId: "GANDHARI" },
  nightAction: {
    options: (ctx) => [{ type: "CHOOSE_PLAYER", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "CHOOSE_PLAYER") return "DONE";
      ctx.addKnowledge(input.target, {
        kind: "NOTIFICATION",
        code: "GANDHARI_CHOSE_YOU",
        message: "Gandhari has chosen you.",
        source: "GANDHARI",
        observedAt: ctx.now,
      });
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER", attribute: "CHOSEN", playerId: input.target, source: "GANDHARI", observedAt: ctx.now,
      });
      ctx.record("PLAYER_CHOSEN", { target: input.target });
      return "DONE";
    },
  },
};
