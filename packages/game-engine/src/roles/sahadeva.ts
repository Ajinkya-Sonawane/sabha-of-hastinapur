import { Faction, CENTER_SLOTS } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { effectiveFaction } from "./helpers";

export const SAHADEVA: RoleDefinition = {
  id: "SAHADEVA",
  name: "Sahadeva",
  title: "The Seer",
  faction: Faction.DHARMA,
  tags: ["PANDAVA", "TWIN", "INFORMATION"],
  nightPriority: 120,
  startingKnowledge: [],
  victory: { type: "DHARMA" },
  trainingFaction: "PANDAVA_TRAINED",
  nightAction: {
    options: (ctx) => [
      { type: "INSPECT_PLAYER", targets: ctx.otherPlayerIds() },
      { type: "INSPECT_CENTER", slots: [...CENTER_SLOTS] },
    ],
    resolve(ctx, input) {
      if (input.type === "INSPECT_PLAYER") {
        const role = ctx.currentRoleOf(input.target);
        const faction = effectiveFaction(role, ctx.state.deck);
        ctx.addKnowledge(ctx.actor.id, {
          kind: "ROLE",
          playerId: input.target,
          role: role.id,
          source: "SAHADEVA",
          observedAt: ctx.now,
        });
        ctx.addKnowledge(ctx.actor.id, {
          kind: "FACTION",
          playerId: input.target,
          faction,
          source: "SAHADEVA",
          observedAt: ctx.now,
        });
        ctx.record("INSPECT_PLAYER", { target: input.target, role: role.id, faction });
      } else if (input.type === "INSPECT_CENTER") {
        const roles = input.slots.map((slot) => {
          const role = ctx.centerCard(slot).roleId;
          ctx.addKnowledge(ctx.actor.id, { kind: "CENTER", slot, role, source: "SAHADEVA", observedAt: ctx.now });
          return role;
        });
        ctx.record("INSPECT_CENTER", { slots: input.slots, roles });
      }
      return "DONE";
    },
  },
};
