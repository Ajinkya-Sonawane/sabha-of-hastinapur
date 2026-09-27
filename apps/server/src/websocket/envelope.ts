import type { ServerEvent } from "@sabha/protocol";

export function envelope<E extends ServerEvent>(type: E["type"], payload: E["payload"], requestId = ""): E {
  return { v: 1, type, requestId, timestamp: Date.now(), payload } as E;
}
