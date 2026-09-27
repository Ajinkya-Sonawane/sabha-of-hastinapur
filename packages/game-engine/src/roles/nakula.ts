import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const NAKULA: RoleDefinition = {
  id: "NAKULA",
  name: "Nakula",
  title: "The Twin",
  faction: Faction.DHARMA,
  tags: ["PANDAVA", "TWIN", "INFORMATION"],
  nightPriority: 120,
  startingKnowledge: [],
  victory: { type: "DHARMA" },
  trainingFaction: "PANDAVA_TRAINED",
  nightAction: {
    onStart(ctx) {
      const twin = ctx.otherPlayerIds().find((pid) => ctx.currentCardOf(pid).roleId === "SAHADEVA");
      if (twin) {
        ctx.addKnowledge(ctx.actor.id, {
          kind: "ROLE",
          playerId: twin,
          role: "SAHADEVA",
          source: "NAKULA",
          observedAt: ctx.now,
        });
      } else {
        ctx.addKnowledge(ctx.actor.id, {
          kind: "NOTIFICATION",
          code: "NO_TWIN",
          message: "You sense no twin.",
          source: "NAKULA",
          observedAt: ctx.now,
        });
      }
      ctx.record("TWIN_SENSED", { target: twin ?? null });
    },
    options: () => [{ type: "ACKNOWLEDGE" }],
    resolve: () => "DONE",
  },
};
