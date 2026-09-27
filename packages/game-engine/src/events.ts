import { asEventId, type PlayerId } from "@sabha/protocol";
import type { GameEvent, GameEventType, InternalGameState } from "./types";

/** Append an event to the game's append-only log. */
export function recordEvent(
  state: InternalGameState,
  type: GameEventType,
  actorPlayerId: PlayerId | undefined,
  payload: Record<string, unknown>,
  now: number,
): GameEvent {
  const version = (state.events.at(-1)?.version ?? 0) + 1;
  const event: GameEvent = {
    id: asEventId(`${state.gameId}:${version}`),
    version,
    round: state.round,
    type,
    actorPlayerId,
    payload,
    createdAt: now,
  };
  state.events.push(event);
  return event;
}
