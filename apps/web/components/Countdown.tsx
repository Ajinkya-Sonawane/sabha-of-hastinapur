"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/game/gameStore";

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Renders the server's deadline. The server is authoritative; the client only
 * corrects for clock skew measured via ping/pong.
 */
export function Countdown({ deadline, size = "md", label = "Time remaining" }: { deadline: number; size?: "sm" | "md" | "lg"; label?: string }) {
  const offset = useGameStore((s) => s.serverOffset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  const remaining = deadline - (now + offset);
  const urgent = remaining < 10_000;
  const sizes = { sm: "text-lg", md: "text-3xl", lg: "text-6xl" };
  return (
    <div className="flex flex-col items-center" role="timer" aria-live="off" aria-label={`${label}: ${format(remaining)}`}>
      {size !== "sm" && <span className="text-xs tracking-wide text-muted">{label}</span>}
      <span className={`font-mono tabular-nums ${sizes[size]} ${urgent ? "text-error" : "text-parchment"}`}>{format(remaining)}</span>
    </div>
  );
}
