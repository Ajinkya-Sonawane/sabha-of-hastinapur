import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { CONSPIRATOR_ROLES } from "./helpers";

export const DURYODHANA: RoleDefinition = {
  id: "DURYODHANA",
  name: "Duryodhana",
  title: "The Crown Prince",
  faction: Faction.KAURAVA,
  tags: ["KAURAVA_CONSPIRATOR"],
  nightPriority: 100,
  // Sees the other conspirators, but not Karna.
  startingKnowledge: [{ type: "SEE_STARTING_ROLES", roles: CONSPIRATOR_ROLES }],
  victory: { type: "KAURAVA" },
  trainingFaction: "KURU_TRAINED",
};
