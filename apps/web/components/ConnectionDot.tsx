"use client";

import { useGameStore } from "@/game/gameStore";

export function ConnectionDot() {
  const status = useGameStore((s) => s.status);
  const ok = status === "connected";
  return (
    <span className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted" role="status">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${ok ? "bg-emerald-400" : "bg-kuru animate-glow"}`} />
      {ok ? "Connected" : status === "no-session" ? "No seat" : "Reconnecting…"}
    </span>
  );
}
