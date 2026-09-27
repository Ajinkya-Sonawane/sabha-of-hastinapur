import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { draupadiReading } from "./helpers";

export const DRAUPADI: RoleDefinition = {
  id: "DRAUPADI",
  name: "Draupadi",
  title: "The Fire-Born",
  faction: Faction.DHARMA,
  tags: ["INFORMATION"],
  nightPriority: 160,
  startingKnowledge: [],
  victory: { type: "DHARMA" },
  nightAction: {
    options: (ctx) => [{ type: "INSPECT_PLAYER", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input) {
      if (input.type !== "INSPECT_PLAYER") return "DONE";
      // Allegiance at the instant of inspection; later swaps can make it stale.
      const role = ctx.currentRoleOf(input.target);
      const value = draupadiReading(role, ctx.state.deck);
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER",
        attribute: "ALLEGIANCE",
        playerId: input.target,
        value,
        source: "DRAUPADI",
        observedAt: ctx.now,
      });
      ctx.record("INSPECT_PLAYER", { target: input.target, role: role.id, reading: value });
      return "DONE";
    },
  },
};
