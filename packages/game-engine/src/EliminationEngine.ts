import type { PlayerId } from "@sabha/protocol";
import { currentRoleIdOf } from "./CardEngine";
import { GameError } from "./errors";
import { recordEvent } from "./events";
import { seatOrder } from "./NightEngine";
import { getRole } from "./roles/registry";
import type { EliminationReason, EliminationState, GameTimers, InternalGameState } from "./types";

/**
 * Resolution queue. The vote removes the primary targets; revenge effects
 * (Bhima, Ashwatthama) and Arjuna's arrow keep resolving until nothing is left.
 */
export class EliminationEngine {
  constructor(private readonly timers: GameTimers) {}

  begin(state: InternalGameState, primaryTargets: PlayerId[], now: number): EliminationState {
    const ordered = seatOrder(state).filter((pid) => primaryTargets.includes(pid));
    state.elimination = {
      primaryTargets: ordered,
      secondaryTargets: [],
      allEliminated: [],
      pendingSpecialActions: [],
    };
    // Primary targets fall simultaneously, then their effects trigger in seat order.
    for (const pid of ordered) this.markEliminated(state, pid, "VOTE", undefined, now);
    for (const pid of ordered) this.triggerEffect(state, pid, now);
    return state.elimination;
  }

  isComplete(state: InternalGameState): boolean {
    return !!state.elimination && state.elimination.pendingSpecialActions.length === 0;
  }

  survivors(state: InternalGameState): PlayerId[] {
    return seatOrder(state).filter((pid) => !state.players[pid].eliminated);
  }

  targetsFor(state: InternalGameState, playerId: PlayerId): PlayerId[] {
    return this.survivors(state).filter((pid) => pid !== playerId);
  }

  submitChoice(state: InternalGameState, playerId: PlayerId, targetId: PlayerId, now: number): void {
    const elimination = state.elimination;
    const pending = elimination?.pendingSpecialActions.find((a) => a.playerId === playerId);
    if (!elimination || !pending) throw new GameError("INVALID_PHASE");
    if (!this.targetsFor(state, playerId).includes(targetId)) throw new GameError("INVALID_TARGET");

    elimination.pendingSpecialActions = elimination.pendingSpecialActions.filter((a) => a !== pending);
    const reason = pending.role as EliminationReason;
    this.markEliminated(state, targetId, reason, playerId, now);
    this.triggerEffect(state, targetId, now);
  }

  /** Revenge choices not made in time simply lapse. */
  timeout(state: InternalGameState, now: number): void {
    const elimination = state.elimination;
    if (!elimination) return;
    const expired = elimination.pendingSpecialActions.filter((a) => a.deadline <= now);
    elimination.pendingSpecialActions = elimination.pendingSpecialActions.filter((a) => a.deadline > now);
    for (const action of expired) {
      recordEvent(state, "SPECIAL_SKIPPED", action.playerId, { role: action.role }, now);
    }
  }

  nextDeadline(state: InternalGameState): number | null {
    const deadlines = state.elimination?.pendingSpecialActions.map((a) => a.deadline) ?? [];
    return deadlines.length ? Math.min(...deadlines) : null;
  }

  private markEliminated(
    state: InternalGameState,
    playerId: PlayerId,
    reason: EliminationReason,
    byPlayerId: PlayerId | undefined,
    now: number,
  ): boolean {
    const player = state.players[playerId];
    const elimination = state.elimination!;
    if (!player || player.eliminated) return false;
    player.eliminated = true;
    elimination.allEliminated.push(playerId);
    if (reason !== "VOTE") elimination.secondaryTargets.push(playerId);
    recordEvent(
      state,
      "PLAYER_ELIMINATED",
      byPlayerId,
      { target: playerId, reason, finalRole: currentRoleIdOf(state, playerId) },
      now,
    );
    return true;
  }

  private triggerEffect(state: InternalGameState, playerId: PlayerId, now: number): void {
    const role = getRole(currentRoleIdOf(state, playerId));
    const effect = role.eliminationEffect;
    if (!effect) return;

    if (effect.type === "ARROW") {
      // The arrow belongs to the Arjuna card: whoever holds it at dawn fires it.
      const arrow = state.night?.arrow;
      if (arrow && !state.players[arrow.targetId]?.eliminated) {
        this.markEliminated(state, arrow.targetId, "ARJUNA", playerId, now);
        this.triggerEffect(state, arrow.targetId, now);
      }
      return;
    }

    if (effect.type === "CHOOSE_ANOTHER" && this.targetsFor(state, playerId).length > 0) {
      state.elimination!.pendingSpecialActions.push({
        playerId,
        role: role.id,
        deadline: now + this.timers.SPECIAL_ELIMINATION * 1000,
      });
    }
  }
}
