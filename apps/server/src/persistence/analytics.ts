import type pg from "pg";

export type AnalyticsEventType = "game_created" | "game_started" | "game_completed" | "player_disconnected";

/**
 * Anonymous analytics only: counts, durations and distributions.
 * Never names, session data or anything that identifies a person.
 */
export interface AnalyticsSink {
  track(type: AnalyticsEventType, payload: Record<string, unknown>): void;
}

export class MemoryAnalytics implements AnalyticsSink {
  readonly events: { type: AnalyticsEventType; payload: Record<string, unknown> }[] = [];
  track(type: AnalyticsEventType, payload: Record<string, unknown>) {
    this.events.push({ type, payload });
    if (this.events.length > 1000) this.events.shift();
  }
}

export class PostgresAnalytics implements AnalyticsSink {
  constructor(private readonly pool: pg.Pool) {}
  track(type: AnalyticsEventType, payload: Record<string, unknown>) {
    this.pool
      .query("INSERT INTO analytics_events (type, payload) VALUES ($1, $2)", [type, JSON.stringify(payload)])
      .catch((error) => console.warn("[analytics] write failed:", error.message));
  }
}
