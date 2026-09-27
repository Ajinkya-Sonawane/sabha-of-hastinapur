import { z } from "zod";
import { GAME_MODES, MAX_PLAYERS, MIN_PLAYERS, MOVEMENT_COUNT_GUESSES } from "./roles";

/** Runtime validation for everything that arrives from a browser. */

export const playerNameSchema = z
  .string()
  .transform((s) => s.trim().replace(/\s+/g, " "))
  .pipe(
    z
      .string()
      .min(2, "Names must be 2-20 characters.")
      .max(20, "Names must be 2-20 characters.")
      .regex(/^[\p{L}\p{N} ._'-]+$/u, "Names may contain letters, numbers, spaces and . _ ' -"),
  );

export const roomCodeSchema = z
  .string()
  .transform((s) => s.trim().toUpperCase().replace(/\s+/g, ""))
  .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "Room codes are 6 characters."));

export const gameModeSchema = z.enum(GAME_MODES as [string, ...string[]]);
export const playerCountSchema = z.number().int().min(MIN_PLAYERS).max(MAX_PLAYERS);
const idSchema = z.string().min(1).max(64);
const slotSchema = z.union([z.literal(0), z.literal(1), z.literal(2)]);
const guessSchema = z.enum(MOVEMENT_COUNT_GUESSES as [string, ...string[]]);

export const createGameRequestSchema = z.object({
  playerName: playerNameSchema,
  playerCount: playerCountSchema,
  mode: gameModeSchema,
});

export const joinGameRequestSchema = z.object({
  playerName: playerNameSchema,
});

export const nightActionInputSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("SWAP_PLAYERS"), targets: z.tuple([idSchema, idSchema]) }),
  z.object({ type: z.literal("INSPECT_PLAYER"), target: idSchema }),
  z.object({ type: z.literal("INSPECT_CENTER"), slots: z.tuple([slotSchema, slotSchema]) }),
  z.object({ type: z.literal("INSPECT_PAIR"), targets: z.tuple([idSchema, idSchema]) }),
  z.object({ type: z.literal("SWAP_OR_NOT"), targets: z.tuple([idSchema, idSchema]), swap: z.boolean() }),
  z.object({ type: z.literal("PROTECT_PLAYER"), target: idSchema }),
  z.object({ type: z.literal("ARROW_TARGET"), target: idSchema }),
  z.object({ type: z.literal("PREDICT_MOVES"), count: guessSchema }),
  z.object({ type: z.literal("CHOOSE_PLAYER"), target: idSchema }),
  z.object({ type: z.literal("ACKNOWLEDGE") }),
]);

const empty = z.object({}).passthrough().optional().default({});

export const clientPayloadSchemas = {
  "room.create": createGameRequestSchema,
  "room.join": z.object({ roomCode: roomCodeSchema, playerName: playerNameSchema }),
  "room.ready": z.object({ ready: z.boolean() }),
  "game.start": empty,
  "role.confirm": empty,
  "night.action": nightActionInputSchema,
  "discussion.end": empty,
  "vote.cast": z.object({ targetPlayerId: idSchema }),
  "special.elimination": z.object({ targetPlayerId: idSchema }),
  "sanjaya.predict": z.object({ movementCount: guessSchema }),
  "game.rematch": empty,
  "game.leave": empty,
  ping: z.object({ clientTime: z.number() }),
} as const;

export const envelopeSchema = z.object({
  v: z.literal(1),
  type: z.enum(Object.keys(clientPayloadSchemas) as [keyof typeof clientPayloadSchemas, ...(keyof typeof clientPayloadSchemas)[]]),
  requestId: z.string().min(1).max(64),
  timestamp: z.number().optional().default(0),
  payload: z.unknown().optional(),
});
