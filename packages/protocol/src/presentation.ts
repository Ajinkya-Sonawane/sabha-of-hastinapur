import { Faction, type RoleId } from "./roles";

/**
 * Public rulebook information about each character. This is the same text a
 * printed card would carry, so it is safe to ship to every browser. It never
 * says *who* holds a card.
 */
export interface RolePresentation {
  id: RoleId;
  name: string;
  title: string;
  /** Printed faction on the card. Shikhandi may become Dharma when Bhishma is absent. */
  faction: Faction;
  icon: string;
  objective: string;
  night: string;
  ability?: string;
}

export const ROLE_PRESENTATION: Record<RoleId, RolePresentation> = {
  DURYODHANA: {
    id: "DURYODHANA",
    name: "Duryodhana",
    title: "The Crown Prince",
    faction: Faction.KAURAVA,
    icon: "👑",
    objective: "No Kaurava Conspirator may be removed by the Sabha.",
    night: "You see the other Kaurava Conspirators.",
  },
  SHAKUNI: {
    id: "SHAKUNI",
    name: "Shakuni",
    title: "The Manipulator",
    faction: Faction.KAURAVA,
    icon: "🎲",
    objective: "No Kaurava Conspirator may be removed by the Sabha.",
    night: "You see the other Conspirators, then swap the cards of two other players without looking.",
  },
  DUSHASANA: {
    id: "DUSHASANA",
    name: "Dushasana",
    title: "The Enforcer",
    faction: Faction.KAURAVA,
    icon: "🗡️",
    objective: "No Kaurava Conspirator may be removed by the Sabha.",
    night: "You see the other Kaurava Conspirators.",
  },
  ASHWATTHAMA: {
    id: "ASHWATTHAMA",
    name: "Ashwatthama",
    title: "The Undying",
    faction: Faction.KAURAVA,
    icon: "💎",
    objective: "No Kaurava Conspirator may be removed by the Sabha.",
    night: "You do not wake.",
    ability: "If you are removed, you take one surviving player with you.",
  },
  YUDHISHTHIRA: {
    id: "YUDHISHTHIRA",
    name: "Yudhishthira",
    title: "The Just King",
    faction: Faction.DHARMA,
    icon: "⚖️",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "You do not wake.",
    ability: "Dharma Vote: your vote silently counts twice if it falls on a Conspirator.",
  },
  BHIMA: {
    id: "BHIMA",
    name: "Bhima",
    title: "The Mighty",
    faction: Faction.DHARMA,
    icon: "🔨",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "You do not wake.",
    ability: "If you are removed, you choose one other surviving player to fall with you.",
  },
  ARJUNA: {
    id: "ARJUNA",
    name: "Arjuna",
    title: "The Archer",
    faction: Faction.DHARMA,
    icon: "🏹",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "Aim your arrow at one player.",
    ability: "If the Arjuna card is removed, the arrow strikes its target.",
  },
  NAKULA: {
    id: "NAKULA",
    name: "Nakula",
    title: "The Twin",
    faction: Faction.DHARMA,
    icon: "🐎",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "You sense where your twin Sahadeva sits.",
  },
  SAHADEVA: {
    id: "SAHADEVA",
    name: "Sahadeva",
    title: "The Seer",
    faction: Faction.DHARMA,
    icon: "🔮",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "Look at one player's card, or two cards in the centre.",
  },
  DRAUPADI: {
    id: "DRAUPADI",
    name: "Draupadi",
    title: "The Fire-Born",
    faction: Faction.DHARMA,
    icon: "🔥",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "Learn whether one player currently stands with or against the Pandavas.",
  },
  KRISHNA: {
    id: "KRISHNA",
    name: "Krishna",
    title: "The Charioteer",
    faction: Faction.DHARMA,
    icon: "🪈",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "Learn the factions of two players, then choose whether to swap their cards.",
  },
  VIDURA: {
    id: "VIDURA",
    name: "Vidura",
    title: "The Wise Minister",
    faction: Faction.DHARMA,
    icon: "📜",
    objective: "Remove at least one Kaurava Conspirator.",
    night: "Learn whether one player is Pandava, Kaurava or Other.",
  },
  KARNA: {
    id: "KARNA",
    name: "Karna",
    title: "The Loyal Friend",
    faction: Faction.KAURAVA,
    icon: "☀️",
    objective: "Survive, and let no Kaurava Conspirator be removed.",
    night: "You know where Duryodhana sits. He does not know you.",
  },
  BHISHMA: {
    id: "BHISHMA",
    name: "Bhishma",
    title: "The Grandsire",
    faction: Faction.KURU,
    icon: "🛡️",
    objective: "Yudhishthira and Duryodhana must both survive.",
    night: "Protect one player's card from every swap tonight.",
  },
  DRONA: {
    id: "DRONA",
    name: "Drona",
    title: "The Teacher",
    faction: Faction.KURU,
    icon: "🎯",
    objective: "At least one Dharma player and one Conspirator must survive.",
    night: "Learn who trained one player: Pandava, Kuru or unknown.",
  },
  SANJAYA: {
    id: "SANJAYA",
    name: "Sanjaya",
    title: "The Far-Seer",
    faction: Faction.KURU,
    icon: "👁️",
    objective: "Correctly predict how many cards moved tonight.",
    night: "Predict how many cards will change hands, then learn the true count at dawn.",
  },
  SHIKHANDI: {
    id: "SHIKHANDI",
    name: "Shikhandi",
    title: "The Reborn",
    faction: Faction.INDEPENDENT,
    icon: "🌗",
    objective: "Bhishma must be removed. (If Bhishma is not in the deck, you fight for Dharma.)",
    night: "You do not wake.",
  },
  GANDHARI: {
    id: "GANDHARI",
    name: "Gandhari",
    title: "The Blindfolded Queen",
    faction: Faction.INDEPENDENT,
    icon: "🕯️",
    objective: "Duryodhana must survive and at least one Pandava must fall.",
    night: "Choose one player. They will know Gandhari chose them.",
    ability: "A mother cannot condemn her son: a vote for Duryodhana silently counts for nothing.",
  },
};

export const FACTION_PRESENTATION: Record<Faction, { label: string; icon: string; alliance: string }> = {
  [Faction.DHARMA]: { label: "Dharma", icon: "🔵", alliance: "DHARMA ALLIANCE" },
  [Faction.KAURAVA]: { label: "Kaurava", icon: "🔴", alliance: "KAURAVA ALLIANCE" },
  [Faction.KURU]: { label: "Kuru", icon: "🟡", alliance: "HOUSE OF KURU" },
  [Faction.INDEPENDENT]: { label: "Independent", icon: "⚪", alliance: "INDEPENDENT" },
};

export const MODE_PRESENTATION = {
  BEGINNER: { label: "Beginner", description: "The classic court. Recommended for a first game." },
  STANDARD: { label: "Standard", description: "Adds the twins and more information roles." },
  ADVANCED: { label: "Advanced", description: "Ashwatthama, Shikhandi, Gandhari and Sanjaya join." },
} as const;
