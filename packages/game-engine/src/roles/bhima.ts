import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const BHIMA: RoleDefinition = {
  id: "BHIMA",
  name: "Bhima",
  title: "The Mighty",
  faction: Faction.DHARMA,
  tags: ["PANDAVA", "REVENGE"],
  nightPriority: 0,
  startingKnowledge: [],
  eliminationEffect: { type: "CHOOSE_ANOTHER" },
  victory: { type: "DHARMA" },
  trainingFaction: "PANDAVA_TRAINED",
};
