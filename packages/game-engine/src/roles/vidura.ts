import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { viduraReading } from "./helpers";

export const VIDURA: RoleDefinition = {
  id: "VIDURA",
  name: "Vidura",
  title: "The Wise Minister",
  faction: Faction.DHARMA,
  tags: ["INFORMATION"],
  nightPriority: 150,
  startingKnowledge: [],
  victory: { type: "DHARMA" },
  nightAction: {
    options: (ctx) => [{ type: "INSPECT_PLAYER", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "INSPECT_PLAYER") return "DONE";
      const role = ctx.currentRoleOf(input.target);
      const value = viduraReading(role, ctx.state.deck);
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER", attribute: "BROAD_FACTION", playerId: input.target, value, source: "VIDURA", observedAt: ctx.now,
      });
      ctx.record("INSPECT_PLAYER", { target: input.target, role: role.id, reading: value });
      return "DONE";
    },
  },
};
