"use client";

import { create } from "zustand";
import type { GameErrorCode, PrivatePlayerView, PublicGameView } from "@sabha/protocol";

export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "no-session";

interface GameStore {
  status: ConnectionStatus;
  game: PublicGameView | null;
  me: PrivatePlayerView | null;
  /** serverTime − clientTime, measured with ping/pong. */
  serverOffset: number;
  error: { code: GameErrorCode; message: string; at: number } | null;
  nudge: number;

  setStatus(status: ConnectionStatus): void;
  setGame(game: PublicGameView): void;
  setMe(me: PrivatePlayerView): void;
  setServerOffset(offset: number): void;
  setError(error: { code: GameErrorCode; message: string } | null): void;
  bumpNudge(): void;
  reset(): void;
}

/**
 * Client state. Deliberately module-scoped (never attached to `window`) and
 * never persisted to localStorage/sessionStorage.
 */
export const useGameStore = create<GameStore>((set) => ({
  status: "idle",
  game: null,
  me: null,
  serverOffset: 0,
  error: null,
  nudge: 0,

  setStatus: (status) => set({ status }),
  setGame: (game) =>
    set((s) => (s.game && s.game.gameId === game.gameId && s.game.stateVersion > game.stateVersion ? s : { game })),
  setMe: (me) => set({ me }),
  setServerOffset: (serverOffset) => set({ serverOffset }),
  setError: (error) => set({ error: error ? { ...error, at: Date.now() } : null }),
  bumpNudge: () => set((s) => ({ nudge: s.nudge + 1 })),
  reset: () => set({ status: "idle", game: null, me: null, error: null }),
}));

export function serverNow(offset: number): number {
  return Date.now() + offset;
}
