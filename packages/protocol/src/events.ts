import type { PlayerId } from "./ids";
import type {
  GamePhase,
  GameResults,
  PrivatePlayerView,
  PublicGameView,
  PublicResolution,
} from "./game";
import type { GameErrorCode } from "./errors";

export interface ServerEnvelope<T extends string, P> {
  v: 1;
  type: T;
  requestId: string;
  timestamp: number;
  payload: P;
}

export type RoomStateEvent = ServerEnvelope<"room.state", PublicGameView>;
export type PlayerPrivateStateEvent = ServerEnvelope<"player.private_state", PrivatePlayerView>;
export type ReconnectStateEvent = ServerEnvelope<
  "session.restore",
  { game: PublicGameView; privateState: PrivatePlayerView; serverTime: number }
>;
export type NoSessionEvent = ServerEnvelope<"session.none", { serverTime: number }>;
export type GamePhaseEvent = ServerEnvelope<"game.phase", { phase: GamePhase; previousPhase: GamePhase }>;
export type TimerStartEvent = ServerEnvelope<"timer.start", { phase: GamePhase; startedAt: number; deadline: number }>;
export type NightPromptEvent = ServerEnvelope<"night.prompt", { deadline: number }>;
export type NightCompleteEvent = ServerEnvelope<"night.complete", Record<string, never>>;
export type DiscussionStartedEvent = ServerEnvelope<"discussion.started", { deadline: number }>;
export type VotingStartedEvent = ServerEnvelope<"voting.started", { deadline: number }>;
export type VoteLockedEvent = ServerEnvelope<"vote.locked", { targetPlayerId: PlayerId }>;
export type VoteRevealEvent = ServerEnvelope<"vote.reveal", PublicResolution>;
export type ResolutionEvent = ServerEnvelope<"resolution.update", PublicResolution>;
export type GameResultsEvent = ServerEnvelope<"game.results", GameResults>;
export type ErrorEvent = ServerEnvelope<"error", { code: GameErrorCode; message: string; requestId?: string }>;
export type PongEvent = ServerEnvelope<"pong", { clientTime: number; serverTime: number }>;

export type ServerEvent =
  | RoomStateEvent
  | PlayerPrivateStateEvent
  | ReconnectStateEvent
  | NoSessionEvent
  | GamePhaseEvent
  | TimerStartEvent
  | NightPromptEvent
  | NightCompleteEvent
  | DiscussionStartedEvent
  | VotingStartedEvent
  | VoteLockedEvent
  | VoteRevealEvent
  | ResolutionEvent
  | GameResultsEvent
  | ErrorEvent
  | PongEvent;

export type ServerEventType = ServerEvent["type"];
