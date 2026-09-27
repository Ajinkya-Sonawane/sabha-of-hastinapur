export type GameErrorCode =
  | "INVALID_PHASE"
  | "NOT_YOUR_TURN"
  | "INVALID_TARGET"
  | "ACTION_ALREADY_SUBMITTED"
  | "INVALID_VOTE"
  | "GAME_FULL"
  | "ROOM_NOT_FOUND"
  | "NAME_TAKEN"
  | "NOT_HOST"
  | "GAME_ALREADY_STARTED"
  | "INVALID_REQUEST"
  | "NOT_ENOUGH_PLAYERS"
  | "UNAUTHENTICATED"
  | "RATE_LIMITED"
  | "INTERNAL";

export const DEFAULT_ERROR_MESSAGES: Record<GameErrorCode, string> = {
  INVALID_PHASE: "That action is no longer available.",
  NOT_YOUR_TURN: "It is not your turn to act.",
  INVALID_TARGET: "That choice is not allowed.",
  ACTION_ALREADY_SUBMITTED: "You have already acted.",
  INVALID_VOTE: "That vote is not allowed.",
  GAME_FULL: "This Sabha is full.",
  ROOM_NOT_FOUND: "No Sabha exists with that code.",
  NAME_TAKEN: "Someone in this Sabha already uses that name.",
  NOT_HOST: "Only the host can do that.",
  GAME_ALREADY_STARTED: "This Sabha has already begun.",
  INVALID_REQUEST: "Something about that request was not right.",
  NOT_ENOUGH_PLAYERS: "At least five connected players are needed.",
  UNAUTHENTICATED: "Your seat could not be found. Please join again.",
  RATE_LIMITED: "Slow down a little and try again.",
  INTERNAL: "Something went wrong. Please try again.",
};
