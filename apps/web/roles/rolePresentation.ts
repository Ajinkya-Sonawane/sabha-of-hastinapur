import {
  Faction,
  FACTION_PRESENTATION,
  ROLE_PRESENTATION,
  type RoleId,
} from "@sabha/protocol";

export { FACTION_PRESENTATION, ROLE_PRESENTATION };

export const FACTION_STYLES: Record<Faction, { text: string; border: string; bg: string }> = {
  [Faction.DHARMA]: { text: "text-dharma", border: "border-dharma/60", bg: "bg-dharma/10" },
  [Faction.KAURAVA]: { text: "text-kaurava", border: "border-kaurava/60", bg: "bg-kaurava/10" },
  [Faction.KURU]: { text: "text-kuru", border: "border-kuru/60", bg: "bg-kuru/10" },
  [Faction.INDEPENDENT]: { text: "text-neutral", border: "border-neutral/60", bg: "bg-neutral/10" },
};

export function roleName(role: RoleId): string {
  return ROLE_PRESENTATION[role].name;
}

/** Printed faction, adjusted for Shikhandi when Bhishma is absent from the deck. */
export function displayFaction(role: RoleId, deck: readonly RoleId[]): Faction {
  if (role === "SHIKHANDI" && deck.length > 0 && !deck.includes("BHISHMA")) return Faction.DHARMA;
  return ROLE_PRESENTATION[role].faction;
}
