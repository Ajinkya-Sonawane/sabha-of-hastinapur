import { CENTER_CARD_COUNT, MAX_PLAYERS, MIN_PLAYERS, type GameMode, type RoleId } from "@sabha/protocol";
import { GameError } from "./errors";
import type { RolePack } from "./types";

/**
 * Curated packs. Roles are never drawn at random from the full pool —
 * each pack is balanced for its table size.
 */
const BEGINNER_BASE: RoleId[] = [
  "DURYODHANA",
  "SHAKUNI",
  "YUDHISHTHIRA",
  "BHIMA",
  "SAHADEVA",
  "KRISHNA",
  "KARNA",
  "VIDURA",
];
const BEGINNER_ADDITIONS: RoleId[] = ["DUSHASANA", "BHISHMA", "DRONA", "ARJUNA", "DRAUPADI"];

const STANDARD_BASE: RoleId[] = [
  "DURYODHANA",
  "SHAKUNI",
  "YUDHISHTHIRA",
  "BHIMA",
  "SAHADEVA",
  "NAKULA",
  "KRISHNA",
  "KARNA",
];
const STANDARD_ADDITIONS: RoleId[] = ["DUSHASANA", "BHISHMA", "DRAUPADI", "ARJUNA", "SANJAYA"];

const ADVANCED_BASE: RoleId[] = [
  "DURYODHANA",
  "SHAKUNI",
  "YUDHISHTHIRA",
  "BHIMA",
  "SAHADEVA",
  "KRISHNA",
  "KARNA",
  "GANDHARI",
];
const ADVANCED_ADDITIONS: RoleId[] = ["ASHWATTHAMA", "BHISHMA", "SHIKHANDI", "NAKULA", "SANJAYA"];

const PACK_SOURCES: Record<GameMode, { base: RoleId[]; additions: RoleId[] }> = {
  BEGINNER: { base: BEGINNER_BASE, additions: BEGINNER_ADDITIONS },
  STANDARD: { base: STANDARD_BASE, additions: STANDARD_ADDITIONS },
  ADVANCED: { base: ADVANCED_BASE, additions: ADVANCED_ADDITIONS },
};

export const PACK_VERSION = 1;

export function getRolePack(mode: GameMode, playerCount: number): RolePack {
  if (!Number.isInteger(playerCount) || playerCount < MIN_PLAYERS || playerCount > MAX_PLAYERS) {
    throw new GameError("INVALID_REQUEST", "The Sabha needs between 5 and 10 players.");
  }
  const source = PACK_SOURCES[mode];
  if (!source) throw new GameError("INVALID_REQUEST", "Unknown game mode.");
  const roles = [...source.base, ...source.additions.slice(0, playerCount - MIN_PLAYERS)];
  return {
    id: `${mode.toLowerCase()}-${playerCount}`,
    mode,
    playerCount,
    roles,
    centerCards: CENTER_CARD_COUNT,
    version: PACK_VERSION,
  };
}

export function validatePack(pack: RolePack): void {
  if (pack.roles.length !== pack.playerCount + CENTER_CARD_COUNT) {
    throw new GameError("INVALID_REQUEST", "This role pack does not fit the table.");
  }
  if (new Set(pack.roles).size !== pack.roles.length) {
    throw new GameError("INVALID_REQUEST", "A role pack may not repeat a character.");
  }
}
