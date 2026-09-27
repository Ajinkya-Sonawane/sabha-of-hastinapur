import type {
  CardId,
  CenterSlot,
  EventId,
  Faction,
  GameId,
  GameMode,
  GamePhase,
  GameResults,
  KnownInformation,
  MovementCountGuess,
  PlayerId,
  RoleId,
  TrainingFaction,
  VoteResult,
} from "@sabha/protocol";

/**
 * Server-authoritative game state. Never serialised to a browser — use the
 * projections in `views.ts` instead.
 */
export interface InternalGameState {
  gameId: GameId;
  roomCode: string;

  phase: GamePhase;
  mode: GameMode;
  /** Seats offered when the Sabha was created (5-10). */
  capacity: number;
  round: number;

  hostPlayerId: PlayerId;

  players: Record<PlayerId, InternalPlayerState>;

  /** Every card in the current deal. Cards move; players never change. */
  cards: Record<CardId, CardState>;

  /** Cards currently lying in the centre, by slot. */
  center: [CardId, CardId, CardId] | null;

  /** Roles in the current deck (the public pack). */
  deck: RoleId[];

  timer: TimerState | null;

  night: NightState | null;

  voting: VotingState | null;

  elimination: EliminationState | null;

  results: GameResults | null;

  events: GameEvent[];

  stateVersion: number;

  createdAt: number;
  updatedAt: number;
}

export interface TimerState {
  phase: GamePhase;
  startedAt: number;
  deadline: number;
}

export interface InternalPlayerState {
  id: PlayerId;
  displayName: string;
  seat: number;

  connected: boolean;
  lastSeenAt: number;
  ready: boolean;
  /** Explicitly left mid-game; removed at the next rematch. */
  left: boolean;

  sessionId: string;

  startingCardId: CardId | null;
  roleConfirmed: boolean;

  eliminated: boolean;

  voteTarget?: PlayerId;

  /** True when this player's vote was re-weighted by a hidden rule. Never sent to clients. */
  specialVote?: boolean;

  nightActionSubmitted: boolean;

  knownInformation: KnownInformation[];
}

export type CardLocation =
  | { type: "PLAYER"; playerId: PlayerId }
  | { type: "CENTER"; slot: CenterSlot };

export interface CardState {
  id: CardId;
  roleId: RoleId;
  startingLocation: CardLocation;
  currentLocation: CardLocation;
}

export interface NightStep {
  priority: number;
  playerIds: PlayerId[];
}

export interface NightState {
  step: number;
  schedule: NightStep[];

  activePlayerId?: PlayerId;
  completedPlayerIds: PlayerId[];
  pendingPlayerIds: PlayerId[];

  protectedPlayerId?: PlayerId;

  movementCount: number;

  /** Krishna's first stage, keyed by the acting player. */
  inspectedPairs: Record<string, [PlayerId, PlayerId]>;
  arrow?: { archerId: PlayerId; targetId: PlayerId };
  prediction?: { playerId: PlayerId; guess: MovementCountGuess };

  startedAt: number;
  deadline: number;
  completed: boolean;
}

export interface Vote {
  voterId: PlayerId;
  targetId: PlayerId;
  weight: number;
}

export interface VotingState {
  votes: Record<string, Vote>;
  startedAt: number;
  deadline: number;
  result?: VoteResult;
}

export type EliminationReason = "VOTE" | "BHIMA" | "ARJUNA" | "ASHWATTHAMA";

export interface PendingEliminationAction {
  playerId: PlayerId;
  role: RoleId;
  deadline: number;
}

export interface EliminationState {
  primaryTargets: PlayerId[];
  secondaryTargets: PlayerId[];
  allEliminated: PlayerId[];
  pendingSpecialActions: PendingEliminationAction[];
}

export type GameEventType =
  | "GAME_CREATED"
  | "PLAYER_JOINED"
  | "PLAYER_LEFT"
  | "HOST_CHANGED"
  | "GAME_STARTED"
  | "CARDS_DEALT"
  | "ROLE_CONFIRMED"
  | "NIGHT_STARTED"
  | "NIGHT_STEP"
  | "PROTECT"
  | "INSPECT_PLAYER"
  | "INSPECT_CENTER"
  | "INSPECT_PAIR"
  | "CARD_SWAP"
  | "SWAP_BLOCKED"
  | "SWAP_DECLINED"
  | "ARROW_AIMED"
  | "PREDICTION"
  | "PLAYER_CHOSEN"
  | "TWIN_SENSED"
  | "ACTION_SKIPPED"
  | "NIGHT_COMPLETED"
  | "DISCUSSION_STARTED"
  | "VOTING_STARTED"
  | "VOTE_CAST"
  | "VOTING_CLOSED"
  | "PLAYER_ELIMINATED"
  | "SPECIAL_SKIPPED"
  | "GAME_COMPLETED"
  | "REMATCH";

export interface GameEvent {
  id: EventId;
  version: number;
  round: number;
  type: GameEventType;
  actorPlayerId?: PlayerId;
  payload: Record<string, unknown>;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// Role registry types
// ---------------------------------------------------------------------------

export type RoleTag =
  | "KAURAVA_CONSPIRATOR"
  | "PANDAVA"
  | "KURU"
  | "INDEPENDENT"
  | "TWIN"
  | "PROTECTOR"
  | "INFORMATION"
  | "REVENGE"
  | "SWAPPER";

export type VictoryRule =
  | { type: "KAURAVA" }
  | { type: "DHARMA" }
  | { type: "SURVIVE"; role: RoleId }
  | { type: "BOTH_SURVIVE"; roles: RoleId[] }
  | { type: "ROLE_ELIMINATED"; role: RoleId }
  | { type: "ROLE_SURVIVES_AND_CONSPIRACY_SURVIVES"; role: RoleId }
  | { type: "MIXED_SURVIVAL"; groups: RoleId[][] }
  | { type: "PREDICTION" }
  | { type: "CUSTOM"; ruleId: string };

export type KnowledgeRule =
  /** See which players started with any of these roles (excluding yourself). */
  | { type: "SEE_STARTING_ROLES"; roles: RoleId[] };

export type EliminationEffect =
  /** Choose another surviving player to eliminate. */
  | { type: "CHOOSE_ANOTHER" }
  /** The arrow aimed during the night strikes its target. */
  | { type: "ARROW" };

export type VotingRule =
  | { type: "DOUBLE_AGAINST_CONSPIRATOR" }
  | { type: "NULL_AGAINST_ROLE"; role: RoleId };

export interface RoleDefinition {
  id: RoleId;
  name: string;
  title: string;
  faction: Faction;
  tags: RoleTag[];
  /** Lower acts first. Only meaningful when `nightAction` is present. */
  nightPriority: number;
  startingKnowledge: KnowledgeRule[];
  nightAction?: NightActionDefinition;
  eliminationEffect?: EliminationEffect;
  votingRule?: VotingRule;
  victory: VictoryRule;
  trainingFaction?: TrainingFaction;
}

export interface ValidationResult {
  ok: boolean;
  code?: "INVALID_TARGET" | "INVALID_REQUEST" | "NOT_YOUR_TURN" | "ACTION_ALREADY_SUBMITTED";
  message?: string;
}

/** What a night action handler gets to work with. */
export interface ActionContext {
  state: InternalGameState;
  actor: InternalPlayerState;
  actorStartingRole: RoleId;
  now: number;

  otherPlayerIds(): PlayerId[];
  allPlayerIds(): PlayerId[];
  currentCardOf(playerId: PlayerId): CardState;
  currentRoleOf(playerId: PlayerId): RoleDefinition;
  centerCard(slot: import("@sabha/protocol").CenterSlot): CardState;
  isProtected(playerId: PlayerId): boolean;
  addKnowledge(playerId: PlayerId, info: KnownInformation): void;
  moveCard(cardId: CardId, destination: CardLocation): void;
  record(type: GameEventType, payload: Record<string, unknown>): void;
}

export type NightResolution = "DONE" | "CONTINUE";

export interface NightActionDefinition {
  /** Options to offer the actor right now (may depend on earlier stages). */
  options(ctx: ActionContext): import("@sabha/protocol").NightActionOption[];
  /** Called once when the actor's step begins (pure-information roles use this). */
  onStart?(ctx: ActionContext): void;
  /** Extra role-specific validation beyond matching an offered option. */
  validate?(ctx: ActionContext, input: import("@sabha/protocol").NightActionInput): ValidationResult;
  resolve(ctx: ActionContext, input: import("@sabha/protocol").NightActionInput): NightResolution;
  /** Called if the actor runs out of time. */
  onTimeout?(ctx: ActionContext): void;
}

export interface RolePack {
  id: string;
  mode: GameMode;
  playerCount: number;
  roles: RoleId[];
  centerCards: number;
  version: number;
}

export interface GameTimers {
  ROLE_REVEAL: number;
  NIGHT_ACTION: number;
  DISCUSSION: number;
  VOTING: number;
  SPECIAL_ELIMINATION: number;
  RESULTS: number;
  /** How long a disconnected player keeps their lobby seat. */
  LOBBY_GRACE: number;
}

export const DEFAULT_TIMERS: GameTimers = {
  ROLE_REVEAL: 15,
  NIGHT_ACTION: 30,
  DISCUSSION: 300,
  VOTING: 30,
  SPECIAL_ELIMINATION: 30,
  RESULTS: 60,
  LOBBY_GRACE: 120,
};
