import { Faction } from "@sabha/protocol";
import { swapPlayerCards } from "../CardEngine";
import type { RoleDefinition } from "../types";
import { effectiveFaction, roleBefore } from "./helpers";

export const KRISHNA: RoleDefinition = {
  id: "KRISHNA",
  name: "Krishna",
  title: "The Charioteer",
  faction: Faction.DHARMA,
  tags: ["INFORMATION", "SWAPPER"],
  nightPriority: 140,
  startingKnowledge: [],
  victory: { type: "DHARMA" },
  nightAction: {
    options(ctx) {
      const pair = ctx.state.night!.inspectedPairs[ctx.actor.id];
      if (!pair) return [{ type: "INSPECT_PAIR", targets: ctx.otherPlayerIds() }];
      return [{ type: "SWAP_OR_NOT", targets: pair }];
    },
    resolve(ctx, input) {
      const night = ctx.state.night!;
      if (input.type === "INSPECT_PAIR") {
        const [a, b] = input.targets;
        night.inspectedPairs[ctx.actor.id] = [a, b];
        const factions = [a, b].map((pid) => {
          const faction = effectiveFaction(ctx.currentRoleOf(pid), ctx.state.deck);
          ctx.addKnowledge(ctx.actor.id, { kind: "FACTION", playerId: pid, faction, source: "KRISHNA", observedAt: ctx.now });
          return faction;
        });
        ctx.record("INSPECT_PAIR", { targets: [a, b], roles: [roleBefore(ctx, a), roleBefore(ctx, b)], factions });
        return "CONTINUE";
      }
      if (input.type === "SWAP_OR_NOT") {
        const [a, b] = input.targets;
        const roles = [roleBefore(ctx, a), roleBefore(ctx, b)];
        if (input.swap) {
          // Krishna does not see the resulting cards.
          const swapped = swapPlayerCards(ctx, a, b);
          ctx.record(swapped ? "CARD_SWAP" : "SWAP_BLOCKED", { targets: [a, b], roles });
          ctx.addKnowledge(ctx.actor.id, {
            kind: "PLAYER", attribute: "SWAPPED_WITH", playerId: a, otherPlayerId: b, source: "KRISHNA", observedAt: ctx.now,
          });
        } else {
          ctx.record("SWAP_DECLINED", { targets: [a, b], roles });
          ctx.addKnowledge(ctx.actor.id, {
            kind: "PLAYER", attribute: "LEFT_UNCHANGED", playerId: a, otherPlayerId: b, source: "KRISHNA", observedAt: ctx.now,
          });
        }
      }
      return "DONE";
    },
    onTimeout(ctx) {
      const pair = ctx.state.night!.inspectedPairs[ctx.actor.id];
      if (pair) ctx.record("SWAP_DECLINED", { targets: pair, roles: pair.map((p) => roleBefore(ctx, p)), timeout: true });
    },
  },
};
