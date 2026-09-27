import type { PlayerId, PlayerResult, ResultExplanation, RoleId } from "@sabha/protocol";
import { getRole } from "./roles/registry";
import type { InternalGameState } from "./types";

const READING_LABELS: Record<string, string> = {
  WITH_PANDAVAS: "with the Pandavas",
  AGAINST_PANDAVAS: "against the Pandavas",
  PANDAVA: "Pandava",
  KAURAVA: "Kaurava",
  OTHER: "Other",
  PANDAVA_TRAINED: "Pandava-trained",
  KURU_TRAINED: "Kuru-trained",
  UNKNOWN: "of unknown training",
};

/** Build the "What happened" narrative shown on the results screen. */
export function explainGame(state: InternalGameState, results: PlayerResult[]): ResultExplanation[] {
  const name = (pid: unknown) => state.players[pid as PlayerId]?.displayName ?? "someone";
  const role = (id: unknown) => getRole(id as RoleId).name;
  const lines: ResultExplanation[] = [];
  const night = (text: string) => lines.push({ kind: "NIGHT", text });

  for (const event of state.events.filter((e) => e.round === state.round)) {
    const p = event.payload;
    const actor = name(event.actorPlayerId);
    const actorRole = p.actorRole ? role(p.actorRole) : "";
    switch (event.type) {
      case "PROTECT":
        night(`${actorRole} (${actor}) protected ${name(p.target)}.`);
        break;
      case "TWIN_SENSED":
        night(p.target ? `${actorRole} (${actor}) sensed Sahadeva at ${name(p.target)}.` : `${actorRole} (${actor}) sensed no twin.`);
        break;
      case "INSPECT_PLAYER": {
        const reading = p.reading ? READING_LABELS[p.reading as string] : role(p.role);
        night(`${actorRole} (${actor}) inspected ${name(p.target)}: ${reading}.`);
        break;
      }
      case "INSPECT_CENTER":
        night(`${actorRole} (${actor}) looked at the centre: ${(p.roles as RoleId[]).map(role).join(" + ")}.`);
        break;
      case "INSPECT_PAIR": {
        const [a, b] = p.targets as PlayerId[];
        const [ra, rb] = p.roles as RoleId[];
        night(`${actorRole} (${actor}) read ${name(a)} (${role(ra)}) + ${name(b)} (${role(rb)}).`);
        break;
      }
      case "CARD_SWAP": {
        const [ra, rb] = p.roles as RoleId[];
        const [a, b] = p.targets as PlayerId[];
        night(`${actorRole} (${actor}) swapped ${role(ra)} ↔ ${role(rb)} (${name(a)} ↔ ${name(b)}).`);
        break;
      }
      case "SWAP_BLOCKED": {
        const [a, b] = p.targets as PlayerId[];
        night(`${actorRole} (${actor}) tried to swap ${name(a)} ↔ ${name(b)}, but Bhishma's protection held.`);
        break;
      }
      case "SWAP_DECLINED": {
        const [a, b] = p.targets as PlayerId[];
        night(`${actorRole} (${actor}) left ${name(a)} and ${name(b)} unchanged.`);
        break;
      }
      case "ARROW_AIMED":
        night(`${actorRole} (${actor}) aimed an arrow at ${name(p.target)}.`);
        break;
      case "PREDICTION":
        night(`${actorRole} (${actor}) predicted ${p.guess} card movements.`);
        break;
      case "PLAYER_CHOSEN":
        night(`${actorRole} (${actor}) chose ${name(p.target)}.`);
        break;
      case "ACTION_SKIPPED":
        night(`${role(p.role)} (${actor}) let the night pass without acting.`);
        break;
      case "NIGHT_COMPLETED":
        night(`${p.movementCount} card movement${p.movementCount === 1 ? "" : "s"} happened in the night.`);
        break;
      case "VOTE_CAST": {
        const weight = p.weight as number;
        const note = weight === 2 ? " (Dharma Vote: counted twice)" : weight === 0 ? " (a mother's vote: counted for nothing)" : "";
        lines.push({ kind: "VOTE", text: `${actor} voted for ${name(p.target)}${note}.` });
        break;
      }
      case "PLAYER_ELIMINATED": {
        const how =
          p.reason === "VOTE"
            ? "was removed by the Sabha"
            : p.reason === "ARJUNA"
              ? `was struck by Arjuna's arrow`
              : `was taken by ${role(p.reason)} (${actor})`;
        lines.push({ kind: "ELIMINATION", text: `${name(p.target)} (${role(p.finalRole)}) ${how}.` });
        break;
      }
      case "SPECIAL_SKIPPED":
        lines.push({ kind: "ELIMINATION", text: `${role(p.role)} (${actor}) fell without choosing a final target.` });
        break;
      default:
        break;
    }
  }

  if (!lines.some((l) => l.kind === "ELIMINATION")) {
    lines.push({ kind: "ELIMINATION", text: "No one was removed from the Sabha." });
  }
  for (const r of results) {
    lines.push({ kind: "VICTORY", text: `${name(r.playerId)} — ${role(r.finalRole)}: ${r.won ? "won" : "lost"}. ${r.reason}` });
  }
  return lines;
}
