"use client";

import type { RoleId } from "@sabha/protocol";
import { displayFaction, FACTION_STYLES, ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { FactionBadge } from "./FactionBadge";

/**
 * A character card. Only rendered once the player chooses to reveal it —
 * hidden roles never sit in the DOM.
 */
export function RoleCard({ role, deck, compact = false }: { role: RoleId; deck: readonly RoleId[]; compact?: boolean }) {
  const p = ROLE_PRESENTATION[role];
  const faction = displayFaction(role, deck);
  const style = FACTION_STYLES[faction];
  return (
    <article
      aria-label={`${p.name}, ${p.title}`}
      className={`relative w-full overflow-hidden rounded-[28px] border-2 ${style.border} bg-gradient-to-b from-panel-2 to-panel px-6 ${compact ? "py-5" : "py-8"} text-center shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)] animate-rise`}
    >
      <div aria-hidden className="pointer-events-none absolute inset-2 rounded-[22px] border border-gold/25" />
      <div aria-hidden className={`${compact ? "text-4xl" : "text-6xl"} mb-3`}>{p.icon}</div>
      <h2 className={`font-serif ${compact ? "text-3xl" : "text-4xl"} uppercase tracking-[0.08em] text-parchment`}>{p.name}</h2>
      <p className="mt-1 text-sm uppercase tracking-[0.3em] text-gold">{p.title}</p>
      <div className="mt-4 flex justify-center">
        <FactionBadge faction={faction} variant="alliance" />
      </div>
      {!compact && (
        <>
          <p className="mt-6 text-xs uppercase tracking-[0.3em] text-muted">Your objective</p>
          <p className="mt-2 font-serif text-lg leading-snug">{p.objective}</p>
          <p className="mt-5 text-xs uppercase tracking-[0.3em] text-muted">At night</p>
          <p className="mt-1 text-[15px] leading-snug text-muted">{p.night}</p>
          {p.ability && <p className="mt-3 text-[15px] leading-snug text-muted">{p.ability}</p>}
        </>
      )}
    </article>
  );
}
