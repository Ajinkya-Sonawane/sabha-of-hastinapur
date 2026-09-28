import type { Faction } from "@sabha/protocol";
import { FACTION_PRESENTATION, FACTION_STYLES } from "@/roles/rolePresentation";

/** Faction is always shown with an icon AND a word — never colour alone. */
export function FactionBadge({ faction, variant = "label" }: { faction: Faction; variant?: "label" | "alliance" }) {
  const p = FACTION_PRESENTATION[faction];
  const s = FACTION_STYLES[faction];
  return (
    <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${s.border} ${s.bg} ${s.text}`}>
      <span aria-hidden>{p.icon}</span>
      {variant === "alliance" ? p.alliance : p.label}
    </span>
  );
}
