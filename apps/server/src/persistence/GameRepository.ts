import type { InternalGameState } from "@sabha/game-engine";
import type { PlayerId } from "@sabha/protocol";

export interface StoredGame {
  state: InternalGameState;
  /** playerId → session token hash */
  sessions: Record<PlayerId, string>;
}

export class ConcurrencyError extends Error {
  constructor(message = "state_version mismatch") {
    super(message);
    this.name = "ConcurrencyError";
  }
}

export interface GameRepository {
  /**
   * Persist a new state. `expectedVersion` is the version the change was
   * computed from; a mismatch means someone else wrote first.
   */
  save(state: InternalGameState, expectedVersion: number | null, sessions: Record<PlayerId, string>): Promise<void>;
  loadActive(): Promise<StoredGame[]>;
  delete(gameId: string): Promise<void>;
  /** Retention: completed games after 24h, event logs after 72h. */
  deleteExpired(now: number): Promise<void>;
  close(): Promise<void>;
}

/** Single-server MVP: state lives in memory only. */
export class InMemoryGameRepository implements GameRepository {
  private readonly games = new Map<string, StoredGame>();

  async save(state: InternalGameState, expectedVersion: number | null, sessions: Record<PlayerId, string>) {
    const existing = this.games.get(state.gameId);
    if (existing && expectedVersion !== null && existing.state.stateVersion !== expectedVersion) {
      throw new ConcurrencyError();
    }
    this.games.set(state.gameId, { state: structuredClone(state), sessions: { ...sessions } });
  }

  async loadActive() {
    return [...this.games.values()].map((g) => structuredClone(g));
  }

  async delete(gameId: string) {
    this.games.delete(gameId);
  }

  async deleteExpired(now: number) {
    for (const [id, g] of this.games) {
      if ((g.state.phase === "RESULTS" || g.state.phase === "ENDED") && now - g.state.updatedAt > 24 * 3600_000) {
        this.games.delete(id);
      }
    }
  }

  async close() {}
}
