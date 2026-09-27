import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const KARNA: RoleDefinition = {
  id: "KARNA",
  name: "Karna",
  title: "The Loyal Friend",
  // Kaurava-aligned, but deliberately NOT a conspirator.
  faction: Faction.KAURAVA,
  tags: [],
  nightPriority: 100,
  startingKnowledge: [{ type: "SEE_STARTING_ROLES", roles: ["DURYODHANA"] }],
  victory: { type: "ROLE_SURVIVES_AND_CONSPIRACY_SURVIVES", role: "KARNA" },
  trainingFaction: "KURU_TRAINED",
};
