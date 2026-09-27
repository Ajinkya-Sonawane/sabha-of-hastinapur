import type { EngineCommand } from "@sabha/game-engine";
import type { PlayerId } from "@sabha/protocol";
import type { ParsedCommand } from "../security/validation";

/** Translate a validated client command into an engine command. */
export function toEngineCommand(command: ParsedCommand, playerId: PlayerId): EngineCommand | null {
  switch (command.type) {
    case "room.ready":
      return { type: "SET_READY", playerId, ready: (command as ParsedCommand<"room.ready">).payload.ready };
    case "game.start":
      return { type: "START_GAME", playerId };
    case "role.confirm":
      return { type: "CONFIRM_ROLE", playerId };
    case "night.action":
      return { type: "NIGHT_ACTION", playerId, input: (command as ParsedCommand<"night.action">).payload as never };
    case "sanjaya.predict":
      return {
        type: "NIGHT_ACTION",
        playerId,
        input: { type: "PREDICT_MOVES", count: (command as ParsedCommand<"sanjaya.predict">).payload.movementCount as never },
      };
    case "discussion.end":
      return { type: "END_DISCUSSION", playerId };
    case "vote.cast":
      return { type: "CAST_VOTE", playerId, targetId: (command as ParsedCommand<"vote.cast">).payload.targetPlayerId as PlayerId };
    case "special.elimination":
      return {
        type: "SPECIAL_ELIMINATION",
        playerId,
        targetId: (command as ParsedCommand<"special.elimination">).payload.targetPlayerId as PlayerId,
      };
    case "game.rematch":
      return { type: "REMATCH", playerId };
    case "game.leave":
      return { type: "LEAVE", playerId };
    default:
      return null;
  }
}
