import type { GameId, PlayerId } from "./ids";
import type {
  CenterSlot,
  DraupadiReading,
  DronaReading,
  Faction,
  GameMode,
  MovementCountGuess,
  RoleId,
  ViduraReading,
} from "./roles";

export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT"
  | "DISCUSSION"
  | "VOTING"
  | "RESOLUTION"
  | "RESULTS"
  | "ENDED";

export const GAME_PHASES: readonly GamePhase[] = [
  "LOBBY",
  "ROLE_REVEAL",
  "NIGHT",
  "DISCUSSION",
  "VOTING",
  "RESOLUTION",
  "RESULTS",
  "ENDED",
];

// ---------------------------------------------------------------------------
// Known information — only ever sent to the player who learned it.
// ---------------------------------------------------------------------------

export interface KnownRoleInfo {
  kind: "ROLE";
  playerId: PlayerId;
  role: RoleId;
  source: RoleId;
  observedAt: number;
}

export interface KnownFactionInfo {
  kind: "FACTION";
  playerId: PlayerId;
  faction: Faction;
  source: RoleId;
  observedAt: number;
}

export type KnownPlayerInfo =
  | { kind: "PLAYER"; attribute: "ALLEGIANCE"; playerId: PlayerId; value: DraupadiReading; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "BROAD_FACTION"; playerId: PlayerId; value: ViduraReading; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "TRAINING"; playerId: PlayerId; value: DronaReading; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "PROTECTED"; playerId: PlayerId; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "ARROW"; playerId: PlayerId; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "SWAPPED_WITH"; playerId: PlayerId; otherPlayerId: PlayerId; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "LEFT_UNCHANGED"; playerId: PlayerId; otherPlayerId: PlayerId; source: RoleId; observedAt: number }
  | { kind: "PLAYER"; attribute: "CHOSEN"; playerId: PlayerId; source: RoleId; observedAt: number };

export interface KnownCenterInfo {
  kind: "CENTER";
  slot: CenterSlot;
  role: RoleId;
  source: RoleId;
  observedAt: number;
}

export interface MovementCountInfo {
  kind: "MOVEMENT_COUNT";
  count: number;
  prediction?: MovementCountGuess;
  source: RoleId;
  observedAt: number;
}

export type NotificationCode =
  | "NO_OTHER_CONSPIRATORS"
  | "DURYODHANA_ABSENT"
  | "NO_TWIN"
  | "GANDHARI_CHOSE_YOU"
  | "ACTION_SKIPPED"
  | "PREDICTION_LOCKED";

export interface NotificationInfo {
  kind: "NOTIFICATION";
  code: NotificationCode;
  message: string;
  source?: RoleId;
  observedAt: number;
}

export type KnownInformation =
  | KnownRoleInfo
  | KnownFactionInfo
  | KnownPlayerInfo
  | KnownCenterInfo
  | MovementCountInfo
  | NotificationInfo;

// ---------------------------------------------------------------------------
// Night actions
// ---------------------------------------------------------------------------

export type NightActionInput =
  | { type: "SWAP_PLAYERS"; targets: [PlayerId, PlayerId] }
  | { type: "INSPECT_PLAYER"; target: PlayerId }
  | { type: "INSPECT_CENTER"; slots: [CenterSlot, CenterSlot] }
  /** Krishna, stage one: learn two factions. */
  | { type: "INSPECT_PAIR"; targets: [PlayerId, PlayerId] }
  /** Krishna, stage two: decide on the pair inspected in stage one. */
  | { type: "SWAP_OR_NOT"; targets: [PlayerId, PlayerId]; swap: boolean }
  | { type: "PROTECT_PLAYER"; target: PlayerId }
  | { type: "ARROW_TARGET"; target: PlayerId }
  | { type: "PREDICT_MOVES"; count: MovementCountGuess }
  /** Gandhari. */
  | { type: "CHOOSE_PLAYER"; target: PlayerId }
  /** Pure-information roles (Nakula) confirm they have read their vision. */
  | { type: "ACKNOWLEDGE" };

export type NightActionType = NightActionInput["type"];

/** One way a player may answer their current night prompt. */
export type NightActionOption =
  | { type: "SWAP_PLAYERS"; targets: PlayerId[] }
  | { type: "INSPECT_PLAYER"; targets: PlayerId[] }
  | { type: "INSPECT_CENTER"; slots: CenterSlot[] }
  | { type: "INSPECT_PAIR"; targets: PlayerId[] }
  | { type: "SWAP_OR_NOT"; targets: [PlayerId, PlayerId] }
  | { type: "PROTECT_PLAYER"; targets: PlayerId[] }
  | { type: "ARROW_TARGET"; targets: PlayerId[] }
  | { type: "PREDICT_MOVES"; choices: MovementCountGuess[] }
  | { type: "CHOOSE_PLAYER"; targets: PlayerId[] }
  | { type: "ACKNOWLEDGE" };

export type AvailableAction =
  | { kind: "CONFIRM_ROLE"; deadline: number | null }
  | { kind: "NIGHT_ACTION"; role: RoleId; options: NightActionOption[]; deadline: number }
  | { kind: "VOTE"; targets: PlayerId[]; deadline: number }
  | { kind: "SPECIAL_ELIMINATION"; role: RoleId; targets: PlayerId[]; deadline: number }
  | { kind: "START_GAME"; enabled: boolean; reason?: string }
  | { kind: "END_DISCUSSION" }
  | { kind: "REMATCH" };

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export interface PublicPlayer {
  id: PlayerId;
  displayName: string;
  seat: number;
  connected: boolean;
  ready: boolean;
  /** Only present once the Sabha has passed judgement. */
  eliminated?: boolean;
}

export interface TimerInfo {
  phase: GamePhase;
  startedAt: number;
  deadline: number;
}

export interface VoteResult {
  totals: Record<PlayerId, number>;
  highestScore: number;
  primaryTargets: PlayerId[];
}

export interface PublicResolution {
  voteResult: VoteResult;
  primaryTargets: PlayerId[];
  eliminatedPlayerIds: PlayerId[];
  /** Number of fallen warriors still choosing a final target. Who, and why, stays hidden. */
  pendingFinalActs: number;
}

export interface PlayerResult {
  playerId: PlayerId;
  startingRole: RoleId;
  finalRole: RoleId;
  faction: Faction;
  eliminated: boolean;
  won: boolean;
  reason: string;
}

export interface ResultExplanation {
  kind: "NIGHT" | "VOTE" | "ELIMINATION" | "VICTORY";
  text: string;
}

export interface GameResults {
  winningTeams: Faction[];
  headline: string;
  playerResults: PlayerResult[];
  eliminatedPlayerIds: PlayerId[];
  finalRoles: Record<PlayerId, RoleId>;
  startingRoles: Record<PlayerId, RoleId>;
  centerRoles: RoleId[];
  votes: { voterId: PlayerId; targetId: PlayerId | null; weight: number }[];
  movementCount: number;
  explanation: ResultExplanation[];
}

export interface PublicGameView {
  gameId: GameId;
  roomCode: string;
  hostPlayerId: PlayerId;
  phase: GamePhase;
  mode: GameMode;
  round: number;
  capacity: number;
  minPlayers: number;
  maxPlayers: number;
  players: PublicPlayer[];
  /** Composition of the deck (as printed in the rules). Never who holds what. */
  deck: RoleId[];
  timer: TimerInfo | null;
  roleReveal: { confirmedCount: number } | null;
  voting: { votedPlayerIds: PlayerId[] } | null;
  resolution: PublicResolution | null;
  results: GameResults | null;
  stateVersion: number;
}

export interface PrivatePlayerView {
  playerId: PlayerId;
  isHost: boolean;
  startingRole?: RoleId;
  roleConfirmed: boolean;
  knownInformation: KnownInformation[];
  availableActions: AvailableAction[];
  nightActionSubmitted: boolean;
  /** The player's own locked vote, if any. */
  voteTarget?: PlayerId;
  canSeeFinalRole: boolean;
  finalRole?: RoleId;
  eliminated: boolean;
}
