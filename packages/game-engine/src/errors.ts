import { DEFAULT_ERROR_MESSAGES, type GameErrorCode } from "@sabha/protocol";

/** A rule violation that is safe to show to a player. */
export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string = DEFAULT_ERROR_MESSAGES[code],
  ) {
    super(message);
    this.name = "GameError";
  }
}

/** A broken internal invariant. Never shown to players. */
export class InvariantViolation extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvariantViolation";
  }
}

export function invariant(condition: unknown, message: string): asserts condition {
  if (!condition) throw new InvariantViolation(message);
}
