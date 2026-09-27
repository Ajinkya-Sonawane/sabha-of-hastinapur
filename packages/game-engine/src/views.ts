import {
  MAX_PLAYERS,
  MIN_PLAYERS,
  type AvailableAction,
  type PlayerId,
  type PrivatePlayerView,
  type PublicGameView,
  type PublicPlayer,
} from "@sabha/protocol";
import { currentRoleIdOf, startingRoleIdOf } from "./CardEngine";
import type { GameEngine } from "./GameEngine";
import { seatOrder } from "./NightEngine";
import type { InternalGameState } from "./types";

const JUDGED_PHASES = new Set(["RESOLUTION", "RESULTS"]);

/**
 * Everything any browser in the room may see. No roles, no centre cards,
 * no unresolved votes, no night progress.
 */
export function toPublicView(state: InternalGameState): PublicGameView {
  const judged = JUDGED_PHASES.has(state.phase);
  const players: PublicPlayer[] = seatOrder(state).map((pid) => {
    const p = state.players[pid];
    const view: PublicPlayer = {
      id: p.id,
      displayName: p.displayName,
      seat: p.seat,
      connected: p.connected,
      ready: p.ready,
    };
    if (judged) view.eliminated = p.eliminated;
    return view;
  });

  const elimination = state.elimination;
  const voteResult = state.voting?.result;

  return {
    gameId: state.gameId,
    roomCode: state.roomCode,
    hostPlayerId: state.hostPlayerId,
    phase: state.phase,
    mode: state.mode,
    round: state.round,
    capacity: state.capacity,
    minPlayers: MIN_PLAYERS,
    maxPlayers: MAX_PLAYERS,
    players,
    deck: [...state.deck].sort(),
    timer: state.timer ? { ...state.timer } : null,
    roleReveal:
      state.phase === "ROLE_REVEAL"
        ? { confirmedCount: Object.values(state.players).filter((p) => p.roleConfirmed).length }
        : null,
    voting:
      state.phase === "VOTING" && state.voting
        ? { votedPlayerIds: seatOrder(state).filter((pid) => state.voting!.votes[pid]) }
        : null,
    resolution:
      judged && elimination && voteResult
        ? {
            voteResult: { ...voteResult, totals: { ...voteResult.totals } },
            primaryTargets: [...elimination.primaryTargets],
            eliminatedPlayerIds: [...elimination.allEliminated],
            pendingFinalActs: elimination.pendingSpecialActions.length,
          }
        : null,
    results: state.phase === "RESULTS" ? state.results : null,
    stateVersion: state.stateVersion,
  };
}

/** Exactly what one player is entitled to know. */
export function toPrivateView(
  engine: GameEngine,
  state: InternalGameState,
  playerId: PlayerId,
  now: number,
): PrivatePlayerView {
  const player = state.players[playerId];
  const isHost = state.hostPlayerId === playerId;
  const actions: AvailableAction[] = [];
  const dealt = !!player?.startingCardId && Object.keys(state.cards).length > 0;

  if (!player) {
    return {
      playerId,
      isHost: false,
      roleConfirmed: false,
      knownInformation: [],
      availableActions: [],
      nightActionSubmitted: false,
      canSeeFinalRole: false,
      eliminated: false,
    };
  }

  switch (state.phase) {
    case "LOBBY":
      if (isHost) {
        const check = engine.startCheck(state);
        actions.push({ kind: "START_GAME", enabled: check.ok, reason: check.reason });
      }
      break;
    case "ROLE_REVEAL":
      if (!player.roleConfirmed) actions.push({ kind: "CONFIRM_ROLE", deadline: state.timer?.deadline ?? null });
      break;
    case "NIGHT": {
      const action = engine.night.getAvailableAction(state, playerId, now);
      if (action) actions.push(action);
      break;
    }
    case "DISCUSSION":
      if (isHost) actions.push({ kind: "END_DISCUSSION" });
      break;
    case "VOTING":
      if (state.voting && !state.voting.votes[playerId]) {
        actions.push({
          kind: "VOTE",
          targets: seatOrder(state).filter((pid) => pid !== playerId),
          deadline: state.voting.deadline,
        });
      }
      break;
    case "RESOLUTION": {
      const pending = state.elimination?.pendingSpecialActions.find((a) => a.playerId === playerId);
      if (pending) {
        actions.push({
          kind: "SPECIAL_ELIMINATION",
          role: pending.role,
          targets: engine.elimination.targetsFor(state, playerId),
          deadline: pending.deadline,
        });
      }
      break;
    }
    case "RESULTS":
      if (isHost) actions.push({ kind: "REMATCH" });
      break;
    default:
      break;
  }

  const canSeeFinalRole = state.phase === "RESULTS" && dealt;
  return {
    playerId,
    isHost,
    startingRole: dealt ? startingRoleIdOf(state, playerId) : undefined,
    roleConfirmed: player.roleConfirmed,
    knownInformation: player.knownInformation.map((k) => ({ ...k })),
    availableActions: actions,
    nightActionSubmitted: player.nightActionSubmitted,
    voteTarget: player.voteTarget,
    canSeeFinalRole,
    finalRole: canSeeFinalRole ? currentRoleIdOf(state, playerId) : undefined,
    eliminated: JUDGED_PHASES.has(state.phase) ? player.eliminated : false,
  };
}
