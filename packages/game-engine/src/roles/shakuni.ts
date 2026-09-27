import { Faction, type NightActionInput } from "@sabha/protocol";
import { swapPlayerCards } from "../CardEngine";
import type { RoleDefinition } from "../types";
import { CONSPIRATOR_ROLES, roleBefore } from "./helpers";

export const SHAKUNI: RoleDefinition = {
  id: "SHAKUNI",
  name: "Shakuni",
  title: "The Manipulator",
  faction: Faction.KAURAVA,
  tags: ["KAURAVA_CONSPIRATOR", "SWAPPER"],
  nightPriority: 130,
  startingKnowledge: [{ type: "SEE_STARTING_ROLES", roles: CONSPIRATOR_ROLES }],
  victory: { type: "KAURAVA" },
  nightAction: {
    options: (ctx) => [{ type: "SWAP_PLAYERS", targets: ctx.otherPlayerIds() }],
    resolve(ctx, input: NightActionInput) {
      if (input.type !== "SWAP_PLAYERS") return "DONE";
      const [a, b] = input.targets;
      const roles = [roleBefore(ctx, a), roleBefore(ctx, b)];
      const swapped = swapPlayerCards(ctx, a, b);
      ctx.record(swapped ? "CARD_SWAP" : "SWAP_BLOCKED", { targets: [a, b], roles });
      // Shakuni never sees the cards — or whether Bhishma blocked the swap.
      ctx.addKnowledge(ctx.actor.id, {
        kind: "PLAYER",
        attribute: "SWAPPED_WITH",
        playerId: a,
        otherPlayerId: b,
        source: "SHAKUNI",
        observedAt: ctx.now,
      });
      return "DONE";
    },
  },
};
