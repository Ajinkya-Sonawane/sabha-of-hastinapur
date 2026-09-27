import { Faction, MOVEMENT_COUNT_GUESSES } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const SANJAYA: RoleDefinition = {
  id: "SANJAYA",
  name: "Sanjaya",
  title: "The Far-Seer",
  faction: Faction.KURU,
  tags: ["KURU", "INFORMATION"],
  nightPriority: 200,
  startingKnowledge: [],
  victory: { type: "PREDICTION" },
  nightAction: {
    // The prediction is sealed before Sanjaya learns the true count at dawn.
    options: () => [{ type: "PREDICT_MOVES", choices: [...MOVEMENT_COUNT_GUESSES] }],
    resolve(ctx, input) {
      if (input.type !== "PREDICT_MOVES") return "DONE";
      ctx.state.night!.prediction = { playerId: ctx.actor.id, guess: input.count };
      ctx.record("PREDICTION", { guess: input.count });
      ctx.addKnowledge(ctx.actor.id, {
        kind: "NOTIFICATION",
        code: "PREDICTION_LOCKED",
        message: `You foresaw ${input.count} card movement${input.count === "1" ? "" : "s"}.`,
        source: "SANJAYA",
        observedAt: ctx.now,
      });
      return "DONE";
    },
  },
};
