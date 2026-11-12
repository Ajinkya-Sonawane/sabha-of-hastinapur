"use client";

import type { ReactNode } from "react";
import type { RoleId } from "@sabha/protocol";
import { displayFaction, FACTION_STYLES, ROLE_PRESENTATION } from "@/roles/rolePresentation";
import { FactionBadge } from "./FactionBadge";
import { RoleFigure } from "./RoleFigure";
import { Label } from "./ui";

/** Round portrait on the faction's tonal container. */
export function RoleAvatar({ role, deck = [], size = "md" }: { role: RoleId; deck?: readonly RoleId[]; size?: "sm" | "md" | "lg" | "xl" }) {
  const style = FACTION_STYLES[displayFaction(role, deck)];
  const dims = { sm: "h-6 w-6", md: "h-10 w-10", lg: "h-14 w-14", xl: "h-40 w-40" }[size];
  return (
    <span className={`inline-block shrink-0 overflow-hidden rounded-full ${dims} ${style.container}`}>
      <RoleFigure role={role} className="h-full w-full" />
    </span>
  );
}

/**
 * A character card, built as a Material Design 3 card: media, headline,
 * subhead, chip, supporting text. Only rendered once the player chooses to
 * reveal it — hidden roles never sit in the DOM.
 *
 * - `full`: elevated card with a large portrait (role reveal).
 * - `compact`: horizontal filled card (peeks during play).
 * - `detail`: horizontal outlined card with the rules text (How to play).
 */
export function RoleCard({
  role,
  deck,
  compact = false,
  variant,
  footer,
}: {
  role: RoleId;
  deck: readonly RoleId[];
  compact?: boolean;
  variant?: "full" | "compact" | "detail";
  footer?: ReactNode;
}) {
  const p = ROLE_PRESENTATION[role];
  const faction = displayFaction(role, deck);
  const style = FACTION_STYLES[faction];
  const kind = variant ?? (compact ? "compact" : "full");

  if (kind === "compact") {
    return (
      <article aria-label={`${p.name}, ${p.title}`} className="flex items-center gap-4 rounded-xl bg-surface-container-highest p-3 text-left animate-rise">
        <div className={`h-20 w-20 shrink-0 overflow-hidden rounded-lg ${style.container}`}>
          <RoleFigure role={role} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-serif text-[22px] leading-7 text-on-surface">{p.name}</h2>
          <p className="mb-2 text-sm text-on-surface-variant">{p.title}</p>
          <FactionBadge faction={faction} />
        </div>
      </article>
    );
  }

  if (kind === "detail") {
    return (
      <article aria-label={`${p.name}, ${p.title}`} className="flex gap-4 rounded-xl border border-outline-variant bg-surface p-3">
        <div className={`h-24 w-24 shrink-0 overflow-hidden rounded-lg ${style.container}`}>
          <RoleFigure role={role} className="h-full w-full" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-[22px] leading-7 text-on-surface">{p.name}</h3>
          <p className="text-sm text-on-surface-variant">{p.title}</p>
          <p className="mt-2 text-sm leading-5 text-on-surface">{p.objective}</p>
          <p className="mt-1 text-sm leading-5 text-on-surface-variant">Night: {p.night}</p>
          {p.ability && <p className="mt-1 text-sm leading-5 text-on-surface-variant">{p.ability}</p>}
          {footer}
        </div>
      </article>
    );
  }

  return (
    <article aria-label={`${p.name}, ${p.title}`} className="w-full overflow-hidden rounded-xl bg-surface-container-low shadow-elevation-2 animate-rise">
      <div className={`flex h-52 items-end justify-center ${style.container}`}>
        <RoleFigure role={role} className="h-full" />
      </div>
      <div className="p-4">
        <h2 className="font-serif text-[32px] leading-10 text-on-surface">{p.name}</h2>
        <p className="text-base tracking-[0.15px] text-on-surface-variant">{p.title}</p>
        <div className="mt-3">
          <FactionBadge faction={faction} variant="alliance" />
        </div>
        <hr aria-hidden className="my-4 h-px border-0 bg-outline-variant" />
        <Label>Your objective</Label>
        <p className="mt-1 text-base leading-6 tracking-[0.5px] text-on-surface">{p.objective}</p>
        <Label className="mt-4">At night</Label>
        <p className="mt-1 text-sm leading-5 tracking-[0.25px] text-on-surface-variant">{p.night}</p>
        {p.ability && <p className="mt-2 text-sm leading-5 tracking-[0.25px] text-on-surface-variant">{p.ability}</p>}
      </div>
    </article>
  );
}
