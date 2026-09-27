import {
  Faction,
  KAURAVA_CONSPIRATORS,
  type DraupadiReading,
  type DronaReading,
  type PlayerId,
  type RoleId,
  type ViduraReading,
} from "@sabha/protocol";
import type { ActionContext, RoleDefinition } from "../types";

export const CONSPIRATOR_ROLES: RoleId[] = [...KAURAVA_CONSPIRATORS];

export const DHARMA_ROLES: RoleId[] = [
  "YUDHISHTHIRA",
  "BHIMA",
  "ARJUNA",
  "NAKULA",
  "SAHADEVA",
  "DRAUPADI",
  "KRISHNA",
  "VIDURA",
];

/** The five brothers. */
export const PANDAVA_BROTHERS: RoleId[] = ["YUDHISHTHIRA", "BHIMA", "ARJUNA", "NAKULA", "SAHADEVA"];

/** Faction after deck-dependent adjustments (Shikhandi joins Dharma when Bhishma is absent). */
export function effectiveFaction(role: RoleDefinition, deck: readonly RoleId[]): Faction {
  if (role.id === "SHIKHANDI" && !deck.includes("BHISHMA")) return Faction.DHARMA;
  return role.faction;
}

export function draupadiReading(role: RoleDefinition, deck: readonly RoleId[]): DraupadiReading {
  return effectiveFaction(role, deck) === Faction.DHARMA || role.id === "SHIKHANDI"
    ? "WITH_PANDAVAS"
    : "AGAINST_PANDAVAS";
}

export function viduraReading(role: RoleDefinition, deck: readonly RoleId[]): ViduraReading {
  if (KAURAVA_CONSPIRATORS.has(role.id)) return "KAURAVA";
  if (effectiveFaction(role, deck) === Faction.DHARMA) return "PANDAVA";
  return "OTHER";
}

export function dronaReading(role: RoleDefinition): DronaReading {
  return role.trainingFaction ?? "UNKNOWN";
}

export function roleBefore(ctx: ActionContext, playerId: PlayerId): RoleId {
  return ctx.currentCardOf(playerId).roleId;
}
