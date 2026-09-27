export enum Faction {
  DHARMA = "DHARMA",
  KAURAVA = "KAURAVA",
  KURU = "KURU",
  INDEPENDENT = "INDEPENDENT",
}

export const ROLE_IDS = [
  "DURYODHANA",
  "SHAKUNI",
  "DUSHASANA",
  "ASHWATTHAMA",
  "YUDHISHTHIRA",
  "BHIMA",
  "ARJUNA",
  "NAKULA",
  "SAHADEVA",
  "DRAUPADI",
  "KRISHNA",
  "VIDURA",
  "KARNA",
  "BHISHMA",
  "DRONA",
  "SANJAYA",
  "SHIKHANDI",
  "GANDHARI",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

/**
 * Active Kaurava conspirators. Karna is Kaurava-aligned but deliberately
 * excluded — this asymmetry is the core of his loyalty mechanic.
 */
export const KAURAVA_CONSPIRATORS: ReadonlySet<RoleId> = new Set<RoleId>([
  "DURYODHANA",
  "SHAKUNI",
  "DUSHASANA",
  "ASHWATTHAMA",
]);

export const isConspirator = (role: RoleId): boolean => KAURAVA_CONSPIRATORS.has(role);

export type GameMode = "BEGINNER" | "STANDARD" | "ADVANCED";
export const GAME_MODES: readonly GameMode[] = ["BEGINNER", "STANDARD", "ADVANCED"];

export const MIN_PLAYERS = 5;
export const MAX_PLAYERS = 10;
export const CENTER_CARD_COUNT = 3;

export type CenterSlot = 0 | 1 | 2;
export const CENTER_SLOTS: readonly CenterSlot[] = [0, 1, 2];

export type MovementCountGuess = "0" | "1" | "2" | "3" | "4+";
export const MOVEMENT_COUNT_GUESSES: readonly MovementCountGuess[] = ["0", "1", "2", "3", "4+"];

export const movementCountToGuess = (count: number): MovementCountGuess =>
  count >= 4 ? "4+" : (String(count) as MovementCountGuess);

export type TrainingFaction = "PANDAVA_TRAINED" | "KURU_TRAINED";
export type DronaReading = TrainingFaction | "UNKNOWN";
export type DraupadiReading = "WITH_PANDAVAS" | "AGAINST_PANDAVAS";
export type ViduraReading = "PANDAVA" | "KAURAVA" | "OTHER";
