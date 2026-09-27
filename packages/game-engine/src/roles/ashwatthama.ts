import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const ASHWATTHAMA: RoleDefinition = {
  id: "ASHWATTHAMA",
  name: "Ashwatthama",
  title: "The Undying",
  faction: Faction.KAURAVA,
  tags: ["KAURAVA_CONSPIRATOR", "REVENGE"],
  nightPriority: 0,
  // The lone warrior: counted among the conspirators, but wakes with no one.
  startingKnowledge: [],
  eliminationEffect: { type: "CHOOSE_ANOTHER" },
  victory: { type: "KAURAVA" },
  trainingFaction: "KURU_TRAINED",
};
