"use client";

import type { KnownInformation, PublicPlayer, RoleId } from "@sabha/protocol";
import { FACTION_PRESENTATION, ROLE_PRESENTATION } from "@/roles/rolePresentation";

const READINGS: Record<string, string> = {
  WITH_PANDAVAS: "stands WITH the Pandavas",
  AGAINST_PANDAVAS: "stands AGAINST the Pandavas",
  PANDAVA: "is PANDAVA",
  KAURAVA: "is KAURAVA",
  OTHER: "is OTHER — neither Pandava nor Conspirator",
  PANDAVA_TRAINED: "was PANDAVA-TRAINED",
  KURU_TRAINED: "was KURU-TRAINED",
  UNKNOWN: "has UNKNOWN training",
};

export function describeKnowledge(k: KnownInformation, nameOf: (id: string) => string): { icon: string; text: string } {
  const role = (r: RoleId) => ROLE_PRESENTATION[r].name.toUpperCase();
  switch (k.kind) {
    case "ROLE":
      return { icon: ROLE_PRESENTATION[k.role].icon, text: `${nameOf(k.playerId)} is ${role(k.role)}` };
    case "FACTION":
      return { icon: FACTION_PRESENTATION[k.faction].icon, text: `${nameOf(k.playerId)} is ${FACTION_PRESENTATION[k.faction].label.toUpperCase()}` };
    case "CENTER":
      return { icon: "🂠", text: `Centre card ${k.slot + 1} is ${role(k.role)}` };
    case "MOVEMENT_COUNT":
      return {
        icon: "👁️",
        text: `${k.count} card movement${k.count === 1 ? "" : "s"} happened tonight${k.prediction ? ` — you foresaw ${k.prediction}` : ""}.`,
      };
    case "NOTIFICATION":
      return { icon: k.code === "GANDHARI_CHOSE_YOU" ? "🕯️" : "✦", text: k.message };
    case "PLAYER":
      switch (k.attribute) {
        case "ALLEGIANCE":
        case "BROAD_FACTION":
        case "TRAINING":
          return { icon: "🔍", text: `${nameOf(k.playerId)} ${READINGS[k.value]}` };
        case "PROTECTED":
          return { icon: "🛡️", text: `You shielded ${nameOf(k.playerId)} from every swap` };
        case "ARROW":
          return { icon: "🏹", text: `Your arrow is aimed at ${nameOf(k.playerId)}` };
        case "SWAPPED_WITH":
          return { icon: "🔀", text: `You swapped the cards of ${nameOf(k.playerId)} and ${nameOf(k.otherPlayerId)}` };
        case "LEFT_UNCHANGED":
          return { icon: "✋", text: `You left ${nameOf(k.playerId)} and ${nameOf(k.otherPlayerId)} unchanged` };
        case "CHOSEN":
          return { icon: "🕯️", text: `You chose ${nameOf(k.playerId)}` };
      }
  }
}

export function KnowledgeList({
  items,
  players,
  meId,
  title = "You know",
}: {
  items: KnownInformation[];
  players: PublicPlayer[];
  meId?: string;
  title?: string;
}) {
  if (items.length === 0) return null;
  const nameOf = (id: string) => (id === meId ? "You" : players.find((p) => p.id === id)?.displayName ?? "Someone");
  return (
    <div className="w-full">
      <p className="mb-2 text-xs uppercase tracking-[0.3em] text-muted">{title}</p>
      <ul className="flex flex-col gap-2">
        {items.map((k, i) => {
          const { icon, text } = describeKnowledge(k, nameOf);
          return (
            <li key={i} className="flex items-start gap-3 rounded-2xl border border-line bg-panel-2/60 px-4 py-3 text-[15px] leading-snug">
              <span aria-hidden className="text-lg leading-none">{icon}</span>
              <span>{text}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
