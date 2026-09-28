import type { ClientEvent } from "@sabha/protocol";

export function newRequestId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export function buildEnvelope<T extends ClientEvent["type"]>(type: T, payload: unknown, requestId = newRequestId()) {
  return { v: 1 as const, type, requestId, timestamp: Date.now(), payload };
}
