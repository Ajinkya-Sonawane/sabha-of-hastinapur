import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";
import { CONSPIRATOR_ROLES } from "./helpers";

export const DUSHASANA: RoleDefinition = {
  id: "DUSHASANA",
  name: "Dushasana",
  title: "The Enforcer",
  faction: Faction.KAURAVA,
  tags: ["KAURAVA_CONSPIRATOR"],
  nightPriority: 100,
  startingKnowledge: [{ type: "SEE_STARTING_ROLES", roles: CONSPIRATOR_ROLES }],
  victory: { type: "KAURAVA" },
  trainingFaction: "KURU_TRAINED",
};
