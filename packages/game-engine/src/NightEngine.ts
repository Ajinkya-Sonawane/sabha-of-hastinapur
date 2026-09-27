import type { AvailableAction, KnownInformation, NightActionInput, NightActionOption, PlayerId } from "@sabha/protocol";
import {
  centerCard,
  currentCardOf,
  moveCard,
  startingHoldersOf,
  startingRoleIdOf,
} from "./CardEngine";
import { recordEvent } from "./events";
import { getRole } from "./roles/registry";
import type {
  ActionContext,
  GameEvent,
  GameTimers,
  InternalGameState,
  NightState,
  NightStep,
  ValidationResult,
} from "./types";

export function seatOrder(state: InternalGameState): PlayerId[] {
  return Object.values(state.players)
    .sort((a, b) => a.seat - b.seat)
    .map((p) => p.id);
}

export function createActionContext(state: InternalGameState, actorId: PlayerId, now: number, sink?: GameEvent[]): ActionContext {
  const actor = state.players[actorId];
  const actorStartingRole = startingRoleIdOf(state, actorId)!;
  return {
    state,
    actor,
    actorStartingRole,
    now,
    otherPlayerIds: () => seatOrder(state).filter((pid) => pid !== actorId),
    allPlayerIds: () => seatOrder(state),
    currentCardOf: (pid) => currentCardOf(state, pid),
    currentRoleOf: (pid) => getRole(currentCardOf(state, pid).roleId),
    centerCard: (slot) => centerCard(state, slot),
    isProtected: (pid) => state.night?.protectedPlayerId === pid,
    addKnowledge: (pid, info: KnownInformation) => {
      state.players[pid].knownInformation.push(info);
    },
    moveCard: (cardId, destination) => moveCard(state, cardId, destination),
    record: (type, payload) => {
      const event = recordEvent(state, type, actorId, { ...payload, actorRole: actorStartingRole }, now);
      sink?.push(event);
    },
  };
}

/**
 * Deterministic night state machine. Players act in priority groups based on
 * their STARTING role; a card received mid-night never grants its action.
 */
export class NightEngine {
  constructor(private readonly timers: GameTimers) {}

  buildSchedule(state: InternalGameState): NightStep[] {
    const byPriority = new Map<number, PlayerId[]>();
    for (const pid of seatOrder(state)) {
      const role = getRole(startingRoleIdOf(state, pid)!);
      if (!role.nightAction) continue;
      const list = byPriority.get(role.nightPriority) ?? [];
      list.push(pid);
      byPriority.set(role.nightPriority, list);
    }
    return [...byPriority.entries()]
      .sort(([a], [b]) => a - b)
      .map(([priority, playerIds]) => ({ priority, playerIds }));
  }

  start(state: InternalGameState, now: number): NightState {
    const night: NightState = {
      step: -1,
      schedule: this.buildSchedule(state),
      completedPlayerIds: [],
      pendingPlayerIds: [],
      movementCount: 0,
      inspectedPairs: {},
      startedAt: now,
      deadline: now,
      completed: false,
    };
    state.night = night;
    for (const p of Object.values(state.players)) p.nightActionSubmitted = false;
    recordEvent(state, "NIGHT_STARTED", undefined, { steps: night.schedule.length }, now);
    this.advance(state, now);
    return night;
  }

  /** Move to the next step that has actors. Completes the night when none remain. */
  advance(state: InternalGameState, now: number): void {
    const night = state.night!;
    while (night.pendingPlayerIds.length === 0 && !night.completed) {
      night.step += 1;
      const step = night.schedule[night.step];
      if (!step) {
        this.complete(state, now);
        return;
      }
      night.pendingPlayerIds = [...step.playerIds];
      night.activePlayerId = step.playerIds[0];
      night.deadline = now + this.timers.NIGHT_ACTION * 1000;
      recordEvent(state, "NIGHT_STEP", undefined, { priority: step.priority, actors: step.playerIds.length }, now);
      for (const pid of step.playerIds) {
        const role = getRole(startingRoleIdOf(state, pid)!);
        role.nightAction?.onStart?.(createActionContext(state, pid, now));
      }
    }
  }

  getNextActor(state: InternalGameState): PlayerId | null {
    return state.night?.pendingPlayerIds[0] ?? null;
  }

  isActing(state: InternalGameState, playerId: PlayerId): boolean {
    return !!state.night && !state.night.completed && state.night.pendingPlayerIds.includes(playerId);
  }

  getOptions(state: InternalGameState, playerId: PlayerId, now: number): NightActionOption[] {
    if (!this.isActing(state, playerId)) return [];
    const role = getRole(startingRoleIdOf(state, playerId)!);
    return role.nightAction?.options(createActionContext(state, playerId, now)) ?? [];
  }

  getAvailableAction(state: InternalGameState, playerId: PlayerId, now: number): AvailableAction | null {
    if (!this.isActing(state, playerId)) return null;
    return {
      kind: "NIGHT_ACTION",
      role: startingRoleIdOf(state, playerId)!,
      options: this.getOptions(state, playerId, now),
      deadline: state.night!.deadline,
    };
  }

  validateAction(state: InternalGameState, playerId: PlayerId, input: NightActionInput, now: number): ValidationResult {
    if (!state.night || state.night.completed) return { ok: false, code: "NOT_YOUR_TURN" };
    if (state.night.completedPlayerIds.includes(playerId)) return { ok: false, code: "ACTION_ALREADY_SUBMITTED" };
    if (!this.isActing(state, playerId)) return { ok: false, code: "NOT_YOUR_TURN" };

    const options = this.getOptions(state, playerId, now);
    const option = options.find((o) => o.type === input.type);
    if (!option) return { ok: false, code: "INVALID_REQUEST", message: "That action is not available to you." };

    const result = matchesOption(option, input);
    if (!result.ok) return result;

    const role = getRole(startingRoleIdOf(state, playerId)!);
    return role.nightAction?.validate?.(createActionContext(state, playerId, now), input) ?? { ok: true };
  }

  resolveAction(state: InternalGameState, playerId: PlayerId, input: NightActionInput, now: number): GameEvent[] {
    const events: GameEvent[] = [];
    const role = getRole(startingRoleIdOf(state, playerId)!);
    const outcome = role.nightAction!.resolve(createActionContext(state, playerId, now, events), input);
    if (outcome === "DONE") this.finishActor(state, playerId);
    this.advance(state, now);
    return events;
  }

  /** Called when the current step's deadline passes: remaining actors are auto-skipped. */
  timeoutStep(state: InternalGameState, now: number): void {
    const night = state.night;
    if (!night || night.completed) return;
    for (const pid of [...night.pendingPlayerIds]) {
      const role = getRole(startingRoleIdOf(state, pid)!);
      const ctx = createActionContext(state, pid, now);
      role.nightAction?.onTimeout?.(ctx);
      recordEvent(state, "ACTION_SKIPPED", pid, { role: role.id, reason: "AUTO_SKIP" }, now);
      ctx.addKnowledge(pid, {
        kind: "NOTIFICATION",
        code: "ACTION_SKIPPED",
        message: "The night passed before you acted.",
        source: role.id,
        observedAt: now,
      });
      this.finishActor(state, pid);
    }
    this.advance(state, now);
  }

  complete(state: InternalGameState, now: number): GameEvent[] {
    const night = state.night!;
    night.completed = true;
    night.pendingPlayerIds = [];
    night.activePlayerId = undefined;

    // Sanjaya learns the true count at dawn — after his prediction was sealed.
    for (const pid of startingHoldersOf(state, "SANJAYA")) {
      state.players[pid].knownInformation.push({
        kind: "MOVEMENT_COUNT",
        count: night.movementCount,
        prediction: night.prediction?.playerId === pid ? night.prediction.guess : undefined,
        source: "SANJAYA",
        observedAt: now,
      });
    }
    return [recordEvent(state, "NIGHT_COMPLETED", undefined, { movementCount: night.movementCount }, now)];
  }

  private finishActor(state: InternalGameState, playerId: PlayerId): void {
    const night = state.night!;
    night.pendingPlayerIds = night.pendingPlayerIds.filter((p) => p !== playerId);
    if (!night.completedPlayerIds.includes(playerId)) night.completedPlayerIds.push(playerId);
    night.activePlayerId = night.pendingPlayerIds[0];
    state.players[playerId].nightActionSubmitted = true;
  }
}

function invalid(message = "That choice is not allowed."): ValidationResult {
  return { ok: false, code: "INVALID_TARGET", message };
}

function pairOk(targets: readonly string[], allowed: readonly string[]): boolean {
  return targets.length === 2 && targets[0] !== targets[1] && targets.every((t) => allowed.includes(t));
}

function matchesOption(option: NightActionOption, input: NightActionInput): ValidationResult {
  switch (input.type) {
    case "SWAP_PLAYERS":
    case "INSPECT_PAIR":
      return pairOk(input.targets, (option as { targets: string[] }).targets)
        ? { ok: true }
        : invalid("Choose two different players.");
    case "INSPECT_PLAYER":
    case "PROTECT_PLAYER":
    case "ARROW_TARGET":
    case "CHOOSE_PLAYER":
      return (option as { targets: string[] }).targets.includes(input.target) ? { ok: true } : invalid();
    case "INSPECT_CENTER": {
      const allowed = (option as { slots: number[] }).slots;
      const [a, b] = input.slots;
      return a !== b && allowed.includes(a) && allowed.includes(b) ? { ok: true } : invalid("Choose two different centre cards.");
    }
    case "SWAP_OR_NOT": {
      const [x, y] = (option as { targets: [string, string] }).targets;
      const [a, b] = input.targets;
      return (a === x && b === y) || (a === y && b === x) ? { ok: true } : invalid("Decide on the players you inspected.");
    }
    case "PREDICT_MOVES":
      return (option as { choices: string[] }).choices.includes(input.count) ? { ok: true } : invalid();
    case "ACKNOWLEDGE":
      return { ok: true };
  }
}
