import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { CONSPIRATOR_ROLES, DHARMA_ROLES, dronaReading } from "./helpers";

export const DRONA: RoleDefinition = {
  id: "DRONA",
  name: "Drona",
  title: "The Teacher",
  faction: Faction.KURU,
  tags: ["KURU", "INFORMATION"],
  nightPriority: 170,
  startingKnowledge: [],
  victory: { type: "MIXED_SURVIVAL", groups: [DHARMA_ROLES, CONSPIRATOR_ROLES] },
  nightAction: {
    options: (ctx) => [{ type: "INSPECT_PLAYER", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "INSPECT_PLAYER") return "DONE";
      const role = ctx.currentRoleOf(input.target);
      const value = dronaReading(role);
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER", attribute: "TRAINING", playerId: input.target, value, source: "DRONA", observedAt: ctx.now,
      });
      ctx.record("INSPECT_PLAYER", { target: input.target, role: role.id, reading: value });
      return "DONE";
    },
  },
};
