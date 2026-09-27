import { clientPayloadSchemas, envelopeSchema, type ClientEventType } from "@sabha/protocol";
import { GameError } from "@sabha/game-engine";
import type { z } from "zod";

export interface ParsedCommand<T extends ClientEventType = ClientEventType> {
  type: T;
  requestId: string;
  payload: z.infer<(typeof clientPayloadSchemas)[T]>;
}

/** Validate an envelope from the browser. Never trust its shape. */
export function parseEnvelope(raw: unknown): ParsedCommand {
  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) throw new GameError("INVALID_REQUEST");
  const { type, requestId } = envelope.data;
  const schema = clientPayloadSchemas[type];
  const payload = schema.safeParse(envelope.data.payload ?? {});
  if (!payload.success) {
    const first = payload.error.issues[0]?.message;
    throw new GameError("INVALID_REQUEST", first && !first.startsWith("Invalid") ? first : undefined);
  }
  return { type, requestId, payload: payload.data } as ParsedCommand;
}

/** Simple token-bucket limiter keyed by IP or socket. */
export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updated: number }>();

  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {}

  take(key: string, now = Date.now()): boolean {
    const bucket = this.buckets.get(key) ?? { tokens: this.capacity, updated: now };
    bucket.tokens = Math.min(this.capacity, bucket.tokens + ((now - bucket.updated) / 1000) * this.refillPerSecond);
    bucket.updated = now;
    if (bucket.tokens < 1) {
      this.buckets.set(key, bucket);
      return false;
    }
    bucket.tokens -= 1;
    this.buckets.set(key, bucket);
    if (this.buckets.size > 10_000) this.prune(now);
    return true;
  }

  private prune(now: number) {
    for (const [key, bucket] of this.buckets) {
      if (now - bucket.updated > 60_000) this.buckets.delete(key);
    }
  }
}

/** Reject cross-site origins on state-changing requests and WebSocket handshakes. */
export function originAllowed(origin: string | undefined, host: string | undefined, allowed: string[]): boolean {
  if (!origin) return true; // non-browser clients
  if (allowed.includes(origin)) return true;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
