import type { PlayerId } from "./ids";
import type { NightActionInput } from "./game";
import type { GameMode, MovementCountGuess } from "./roles";

/** Every message on the wire uses this envelope. */
export interface WsEnvelope<T extends string, P = unknown> {
  v: 1;
  type: T;
  requestId: string;
  timestamp: number;
  payload: P;
}

export type CreateRoomEvent = WsEnvelope<"room.create", { playerName: string; playerCount: number; mode: GameMode }>;
export type JoinRoomEvent = WsEnvelope<"room.join", { roomCode: string; playerName: string }>;
export type SetReadyEvent = WsEnvelope<"room.ready", { ready: boolean }>;
export type StartGameEvent = WsEnvelope<"game.start", Record<string, never>>;
export type ConfirmRoleRevealEvent = WsEnvelope<"role.confirm", Record<string, never>>;
export type SubmitNightActionEvent = WsEnvelope<"night.action", NightActionInput>;
export type EndDiscussionEvent = WsEnvelope<"discussion.end", Record<string, never>>;
export type SubmitVoteEvent = WsEnvelope<"vote.cast", { targetPlayerId: PlayerId }>;
export type SubmitSpecialEliminationEvent = WsEnvelope<"special.elimination", { targetPlayerId: PlayerId }>;
export type SubmitPredictionEvent = WsEnvelope<"sanjaya.predict", { movementCount: MovementCountGuess }>;
export type RequestRematchEvent = WsEnvelope<"game.rematch", Record<string, never>>;
export type LeaveGameEvent = WsEnvelope<"game.leave", Record<string, never>>;
export type PingEvent = WsEnvelope<"ping", { clientTime: number }>;

export type ClientEvent =
  | CreateRoomEvent
  | JoinRoomEvent
  | SetReadyEvent
  | StartGameEvent
  | SubmitNightActionEvent
  | ConfirmRoleRevealEvent
  | EndDiscussionEvent
  | SubmitVoteEvent
  | SubmitSpecialEliminationEvent
  | SubmitPredictionEvent
  | RequestRematchEvent
  | LeaveGameEvent
  | PingEvent;

export type ClientEventType = ClientEvent["type"];

/** Socket.IO event name that carries envelopes in both directions. */
export const WS_CHANNEL = "msg";

/** Acknowledgement returned through the Socket.IO ack callback. */
export type CommandAck =
  | { ok: true; requestId: string; duplicate?: boolean }
  | { ok: false; requestId: string; code: import("./errors").GameErrorCode; message: string };

// HTTP --------------------------------------------------------------------

export interface CreateGameRequest {
  playerName: string;
  playerCount: number;
  mode: GameMode;
}

export interface JoinGameRequest {
  playerName: string;
}

export interface SessionResponse {
  gameId: string;
  roomCode: string;
  playerId: string;
}

export interface RoomSummaryResponse {
  roomCode: string;
  phase: import("./game").GamePhase;
  playerCount: number;
  capacity: number;
  joinable: boolean;
}
