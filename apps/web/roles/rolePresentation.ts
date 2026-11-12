import {
  Faction,
  FACTION_PRESENTATION,
  ROLE_PRESENTATION,
  type RoleId,
} from "@sabha/protocol";

export { FACTION_PRESENTATION, ROLE_PRESENTATION };

/** Each faction is an M3 extended colour: an accent plus a tonal container. */
export const FACTION_STYLES: Record<Faction, { text: string; border: string; bg: string; container: string; onContainer: string }> = {
  [Faction.DHARMA]: { text: "text-dharma", border: "border-dharma/60", bg: "bg-dharma/10", container: "bg-dharma-container", onContainer: "text-on-dharma-container" },
  [Faction.KAURAVA]: { text: "text-kaurava", border: "border-kaurava/60", bg: "bg-kaurava/10", container: "bg-kaurava-container", onContainer: "text-on-kaurava-container" },
  [Faction.KURU]: { text: "text-kuru", border: "border-kuru/60", bg: "bg-kuru/10", container: "bg-kuru-container", onContainer: "text-on-kuru-container" },
  [Faction.INDEPENDENT]: { text: "text-neutral", border: "border-neutral/60", bg: "bg-neutral/10", container: "bg-neutral-container", onContainer: "text-on-neutral-container" },
};

export function roleName(role: RoleId): string {
  return ROLE_PRESENTATION[role].name;
}

/** Printed faction, adjusted for Shikhandi when Bhishma is absent from the deck. */
export function displayFaction(role: RoleId, deck: readonly RoleId[]): Faction {
  if (role === "SHIKHANDI" && deck.length > 0 && !deck.includes("BHISHMA")) return Faction.DHARMA;
  return ROLE_PRESENTATION[role].faction;
}
