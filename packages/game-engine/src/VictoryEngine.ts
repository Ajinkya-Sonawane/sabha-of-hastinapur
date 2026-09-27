import {
  Faction,
  isConspirator,
  movementCountToGuess,
  type GameResults,
  type PlayerId,
  type PlayerResult,
  type RoleId,
} from "@sabha/protocol";
import { currentRoleIdOf, holdersOf, startingRoleIdOf } from "./CardEngine";
import { explainGame } from "./explain";
import { seatOrder } from "./NightEngine";
import { effectiveFaction, PANDAVA_BROTHERS } from "./roles/helpers";
import { getRole } from "./roles/registry";
import type { InternalGameState, VictoryRule } from "./types";

interface Outcome {
  eliminated: Set<PlayerId>;
  conspiratorsInPlay: PlayerId[];
  conspiratorEliminated: boolean;
  anyEliminated: boolean;
  dharmaWins: boolean;
  kauravaWins: boolean;
}

/** "Survives" means a player holds the card and was not eliminated. A card in the centre never survives. */
function survives(state: InternalGameState, outcome: Outcome, role: RoleId): boolean {
  return holdersOf(state, role).some((pid) => !outcome.eliminated.has(pid));
}

function roleEliminated(state: InternalGameState, outcome: Outcome, role: RoleId): boolean {
  return holdersOf(state, role).some((pid) => outcome.eliminated.has(pid));
}

export class VictoryEngine {
  resolve(state: InternalGameState): GameResults {
    const players = seatOrder(state);
    const eliminated = new Set(players.filter((pid) => state.players[pid].eliminated));
    const finalRoles = Object.fromEntries(players.map((pid) => [pid, currentRoleIdOf(state, pid)])) as Record<PlayerId, RoleId>;
    const startingRoles = Object.fromEntries(players.map((pid) => [pid, startingRoleIdOf(state, pid)!])) as Record<PlayerId, RoleId>;

    const conspiratorsInPlay = players.filter((pid) => isConspirator(finalRoles[pid]));
    const conspiratorEliminated = conspiratorsInPlay.some((pid) => eliminated.has(pid));
    const anyEliminated = eliminated.size > 0;
    const outcome: Outcome = {
      eliminated,
      conspiratorsInPlay,
      conspiratorEliminated,
      anyEliminated,
      // With no conspirator in play, Dharma needs the Sabha to have removed someone.
      dharmaWins: conspiratorsInPlay.length > 0 ? conspiratorEliminated : anyEliminated,
      kauravaWins: conspiratorsInPlay.length > 0 && !conspiratorEliminated,
    };

    const playerResults: PlayerResult[] = players.map((pid) => {
      const role = getRole(finalRoles[pid]);
      const faction = effectiveFaction(role, state.deck);
      const rule: VictoryRule = role.id === "SHIKHANDI" && faction === Faction.DHARMA ? { type: "DHARMA" } : role.victory;
      const { won, reason } = this.evaluate(state, outcome, pid, rule);
      return {
        playerId: pid,
        startingRole: startingRoles[pid],
        finalRole: role.id,
        faction,
        eliminated: eliminated.has(pid),
        won,
        reason,
      };
    });

    const winningTeams: Faction[] = [];
    if (outcome.dharmaWins) winningTeams.push(Faction.DHARMA);
    if (outcome.kauravaWins) winningTeams.push(Faction.KAURAVA);
    for (const faction of [Faction.KURU, Faction.INDEPENDENT]) {
      if (playerResults.some((r) => r.faction === faction && r.won)) winningTeams.push(faction);
    }

    const headline = outcome.dharmaWins
      ? "DHARMA VICTORY"
      : outcome.kauravaWins
        ? "KAURAVA VICTORY"
        : "NO SIDE PREVAILS";

    const votes = players.map((pid) => {
      const vote = state.voting?.votes[pid];
      return { voterId: pid, targetId: vote?.targetId ?? null, weight: vote?.weight ?? 0 };
    });

    const centerRoles = (state.center ?? []).map((cardId) => state.cards[cardId].roleId);

    return {
      winningTeams,
      headline,
      playerResults,
      eliminatedPlayerIds: players.filter((pid) => eliminated.has(pid)),
      finalRoles,
      startingRoles,
      centerRoles,
      votes,
      movementCount: state.night?.movementCount ?? 0,
      explanation: explainGame(state, playerResults),
    };
  }

  private evaluate(state: InternalGameState, o: Outcome, pid: PlayerId, rule: VictoryRule): { won: boolean; reason: string } {
    switch (rule.type) {
      case "DHARMA":
        if (o.conspiratorsInPlay.length === 0) {
          return o.anyEliminated
            ? { won: true, reason: "No conspirator sat in the Sabha, and judgement was still passed." }
            : { won: false, reason: "No conspirator sat in the Sabha, but no one was removed." };
        }
        return o.conspiratorEliminated
          ? { won: true, reason: "A Kaurava Conspirator was removed." }
          : { won: false, reason: "Every Kaurava Conspirator escaped judgement." };
      case "KAURAVA":
        return o.kauravaWins
          ? { won: true, reason: "No Kaurava Conspirator was removed." }
          : { won: false, reason: o.conspiratorsInPlay.length ? "A Kaurava Conspirator was removed." : "The conspiracy never took a seat." };
      case "SURVIVE":
        return survives(state, o, rule.role)
          ? { won: true, reason: `${getRole(rule.role).name} survived.` }
          : { won: false, reason: `${getRole(rule.role).name} did not survive.` };
      case "BOTH_SURVIVE": {
        const fallen = rule.roles.filter((r) => !survives(state, o, r));
        return fallen.length === 0
          ? { won: true, reason: `${rule.roles.map((r) => getRole(r).name).join(" and ")} both survived.` }
          : { won: false, reason: `${fallen.map((r) => getRole(r).name).join(" and ")} did not survive.` };
      }
      case "ROLE_ELIMINATED":
        return roleEliminated(state, o, rule.role)
          ? { won: true, reason: `${getRole(rule.role).name} was removed.` }
          : { won: false, reason: `${getRole(rule.role).name} was not removed.` };
      case "ROLE_SURVIVES_AND_CONSPIRACY_SURVIVES": {
        const alive = !o.eliminated.has(pid);
        if (!alive) return { won: false, reason: "You were removed by the Sabha." };
        if (o.conspiratorEliminated) return { won: false, reason: "You survived, but a Conspirator fell." };
        return { won: true, reason: "You survived and the conspiracy held." };
      }
      case "MIXED_SURVIVAL": {
        const ok = rule.groups.every((group) => group.some((r) => survives(state, o, r)));
        return ok
          ? { won: true, reason: "Both of your students' houses endured." }
          : { won: false, reason: "One house was left without a survivor." };
      }
      case "PREDICTION": {
        const prediction = state.night?.prediction;
        const actual = movementCountToGuess(state.night?.movementCount ?? 0);
        if (!prediction) return { won: false, reason: "No prediction was sealed for this card." };
        return prediction.guess === actual
          ? { won: true, reason: `The prediction of ${prediction.guess} was true.` }
          : { won: false, reason: `Predicted ${prediction.guess}, but ${actual} cards moved.` };
      }
      case "CUSTOM":
        if (rule.ruleId === "GANDHARI") {
          const sonLives = survives(state, o, "DURYODHANA");
          const pandavaFell = PANDAVA_BROTHERS.some((r) => roleEliminated(state, o, r));
          if (sonLives && pandavaFell) return { won: true, reason: "Duryodhana lives and a Pandava fell." };
          if (!sonLives) return { won: false, reason: "Duryodhana did not survive." };
          return { won: false, reason: "No Pandava fell." };
        }
        return { won: false, reason: "Unknown rule." };
    }
  }
}
