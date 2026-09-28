"use client";

import { io, type Socket } from "socket.io-client";
import { WS_CHANNEL, type ClientEvent, type CommandAck, type ServerEvent } from "@sabha/protocol";
import { useGameStore } from "@/game/gameStore";
import { buildEnvelope, newRequestId } from "@/game/protocol";
import { handleServerEvent } from "./handlers";

let socket: Socket | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;

/**
 * One socket per tab. The HttpOnly session cookie rides along with the
 * handshake automatically, so the server knows who we are.
 */
export function connectSocket(): Socket {
  if (socket) return socket;
  const store = useGameStore.getState();
  store.setStatus("connecting");

  socket = io({ path: "/socket.io", transports: ["websocket", "polling"], withCredentials: true });

  socket.on(WS_CHANNEL, (event: ServerEvent) => {
    if (event.type === "pong") {
      const now = Date.now();
      const rtt = now - event.payload.clientTime;
      useGameStore.getState().setServerOffset(event.payload.serverTime + rtt / 2 - now);
      return;
    }
    handleServerEvent(event);
  });
  socket.on("connect", () => {
    ping();
  });
  socket.on("disconnect", () => {
    if (useGameStore.getState().status !== "no-session") useGameStore.getState().setStatus("reconnecting");
  });
  socket.io.on("reconnect_attempt", () => useGameStore.getState().setStatus("reconnecting"));

  pingTimer = setInterval(ping, 15_000);
  return socket;
}

export function disconnectSocket(): void {
  if (pingTimer) clearInterval(pingTimer);
  pingTimer = null;
  socket?.disconnect();
  socket = null;
}

function ping() {
  socket?.emit(WS_CHANNEL, buildEnvelope("ping", { clientTime: Date.now() }));
}

/** Send a command and wait for the server's acknowledgement. */
export function send<T extends ClientEvent["type"]>(type: T, payload: unknown = {}, requestId = newRequestId()): Promise<CommandAck> {
  return new Promise((resolve) => {
    if (!socket?.connected) {
      const ack: CommandAck = { ok: false, requestId, code: "INTERNAL", message: "Reconnecting to the Sabha…" };
      useGameStore.getState().setError({ code: ack.code, message: ack.message });
      return resolve(ack);
    }
    socket
      .timeout(8000)
      .emit(WS_CHANNEL, buildEnvelope(type, payload, requestId), (err: Error | null, ack: CommandAck) => {
        if (err) {
          resolve({ ok: false, requestId, code: "INTERNAL", message: "The Sabha did not answer. Try again." });
          return;
        }
        resolve(ack);
      });
  });
}
