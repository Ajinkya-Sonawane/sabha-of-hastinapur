"use client";

import { useEffect, useState } from "react";
import type { PublicGameView, VoteResult } from "@sabha/protocol";
import { Eyebrow, Title } from "./ui";

/** Reveals vote totals one stage at a time, highest first. */
export function VoteReveal({ game, result }: { game: PublicGameView; result: VoteResult }) {
  const nameOf = (id: string) => game.players.find((p) => p.id === id)?.displayName ?? "Someone";
  const rows = Object.entries(result.totals)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || nameOf(a[0]).localeCompare(nameOf(b[0])));
  const divided = result.primaryTargets.length > 1;
  const [shown, setShown] = useState(1);

  useEffect(() => {
    if (shown >= rows.length) return;
    const id = setTimeout(() => setShown((n) => n + 1), 1400);
    return () => clearTimeout(id);
  }, [shown, rows.length]);

  if (rows.length === 0) {
    return (
      <div className="text-center">
        <Eyebrow>The Sabha is silent</Eyebrow>
        <Title className="mt-2">No votes were cast.</Title>
      </div>
    );
  }

  if (divided) {
    return (
      <div className="text-center animate-rise">
        <Eyebrow>The Sabha is divided</Eyebrow>
        <table className="mx-auto mt-4 w-full max-w-xs text-left">
          <tbody>
            {rows.map(([id, n]) => (
              <tr key={id} className={result.primaryTargets.includes(id as never) ? "text-saffron" : "text-muted"}>
                <td className="py-1 font-serif text-2xl uppercase">{nameOf(id)}</td>
                <td className="py-1 text-right font-mono text-2xl">{n}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-sm text-muted">Every tied player is removed.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 text-center" aria-live="polite">
      <Eyebrow>The Sabha has spoken</Eyebrow>
      {rows.slice(0, shown).map(([id, n], i) => (
        <div key={id} className="animate-rise">
          <p className={`font-serif uppercase ${i === 0 ? "text-5xl text-saffron" : "text-3xl text-parchment"}`}>{nameOf(id)}</p>
          <p className="text-muted">
            {n} vote{n === 1 ? "" : "s"}
          </p>
        </div>
      ))}
    </div>
  );
}
