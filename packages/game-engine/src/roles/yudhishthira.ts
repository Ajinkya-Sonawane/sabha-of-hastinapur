import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const YUDHISHTHIRA: RoleDefinition = {
  id: "YUDHISHTHIRA",
  name: "Yudhishthira",
  title: "The Just King",
  faction: Faction.DHARMA,
  tags: ["PANDAVA"],
  nightPriority: 0,
  startingKnowledge: [],
  votingRule: { type: "DOUBLE_AGAINST_CONSPIRATOR" },
  victory: { type: "DHARMA" },
  trainingFaction: "PANDAVA_TRAINED",
};
