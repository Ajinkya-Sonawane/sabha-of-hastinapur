import { Faction } from "@sabha/protocol";
import type { RoleDefinition } from "../types";

export const SHIKHANDI: RoleDefinition = {
  id: "SHIKHANDI",
  name: "Shikhandi",
  title: "The Reborn",
  // Becomes DHARMA when Bhishma is not in the deck (see effectiveFaction).
  faction: Faction.INDEPENDENT,
  tags: ["INDEPENDENT"],
  nightPriority: 0,
  startingKnowledge: [],
  victory: { type: "ROLE_ELIMINATED", role: "BHISHMA" },
};
