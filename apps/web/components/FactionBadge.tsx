import { Faction } from "@sabha/protocol";
import { FACTION_PRESENTATION, FACTION_STYLES } from "@/roles/rolePresentation";

/** A distinct shape per faction, so it never relies on colour alone. */
export function FactionIcon({ faction, className = "h-[18px] w-[18px]" }: { faction: Faction; className?: string }) {
  const tone = FACTION_STYLES[faction].text;
  return (
    <svg viewBox="0 0 18 18" aria-hidden className={`${className} ${tone} shrink-0`} fill="currentColor">
      {faction === Faction.DHARMA && (
        <g>
          <circle cx="9" cy="9" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="9" cy="9" r="2.2" />
          <path d="M9 2v14M2 9h14" stroke="currentColor" strokeWidth="1.2" />
        </g>
      )}
      {faction === Faction.KAURAVA && <path d="M9 1.5 16.5 9 9 16.5 1.5 9Z" />}
      {faction === Faction.KURU && <path d="M9 2 16.5 15.5h-15Z" />}
      {faction === Faction.INDEPENDENT && <rect x="3" y="3" width="12" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2.2" />}
    </svg>
  );
}

/** M3 assist chip: 32dp tall, small shape (8dp), outlined, leading icon, label-large. */
export function FactionBadge({ faction, variant = "label" }: { faction: Faction; variant?: "label" | "alliance" }) {
  const p = FACTION_PRESENTATION[faction];
  const label = variant === "alliance" ? p.alliance.charAt(0) + p.alliance.slice(1).toLowerCase() : p.label;
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-lg border border-outline pl-2 pr-4 text-sm font-medium tracking-[0.1px] text-on-surface">
      <FactionIcon faction={faction} />
      {label}
    </span>
  );
}
