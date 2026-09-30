import type { InternalGameState } from "@sabha/game-engine";
import type { PlayerId } from "@sabha/protocol";
import pg from "pg";
import { ConcurrencyError, type GameRepository, type StoredGame } from "./GameRepository";

const STATUS: Record<string, string> = {
  LOBBY: "OPEN",
  RESULTS: "COMPLETED",
  ENDED: "ENDED",
};

/**
 * PostgreSQL persistence. Every write happens in a transaction that locks the
 * game row (SELECT … FOR UPDATE) and verifies state_version first.
 */
export class PostgresGameRepository implements GameRepository {
  readonly pool: pg.Pool;

  constructor(connectionString: string) {
    this.pool = new pg.Pool({ connectionString, max: 10 });
    // Hosted Postgres drops idle connections; an unhandled pool error would kill the process.
    this.pool.on("error", (error) => console.warn("[pg] idle client error:", error.message));
  }

  async save(state: InternalGameState, expectedVersion: number | null, sessions: Record<PlayerId, string>) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const current = await client.query<{ state_version: number }>(
        "SELECT state_version FROM games WHERE id = $1 FOR UPDATE",
        [state.gameId],
      );
      const row = current.rows[0];
      if (row && expectedVersion !== null && row.state_version !== expectedVersion) {
        throw new ConcurrencyError();
      }

      const now = new Date(state.updatedAt);
      await client.query(
        `INSERT INTO games (id, room_code, status, phase, mode, host_player_id, state_version, state, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (id) DO UPDATE SET
           status = EXCLUDED.status, phase = EXCLUDED.phase, host_player_id = EXCLUDED.host_player_id,
           state_version = EXCLUDED.state_version, state = EXCLUDED.state, updated_at = EXCLUDED.updated_at`,
        [
          state.gameId,
          state.roomCode,
          STATUS[state.phase] ?? "ACTIVE",
          state.phase,
          state.mode,
          state.hostPlayerId,
          state.stateVersion,
          JSON.stringify(state),
          new Date(state.createdAt),
          now,
        ],
      );

      // Roster: public data only.
      const playerIds = Object.keys(state.players);
      await client.query("DELETE FROM game_players WHERE game_id = $1 AND NOT (id = ANY($2::uuid[]))", [state.gameId, playerIds]);
      // Seats may shuffle on rematch; clear them first to dodge the UNIQUE(game_id, seat) constraint.
      await client.query("UPDATE game_players SET seat = -seat - 100 WHERE game_id = $1", [state.gameId]);
      for (const p of Object.values(state.players)) {
        await client.query(
          `INSERT INTO game_players (id, game_id, display_name, seat, session_token_hash, connected, ready, joined_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           ON CONFLICT (id) DO UPDATE SET seat = EXCLUDED.seat, session_token_hash = EXCLUDED.session_token_hash,
             connected = EXCLUDED.connected, ready = EXCLUDED.ready`,
          [p.id, state.gameId, p.displayName, p.seat, sessions[p.id] ?? "", p.connected, p.ready, now],
        );
      }

      // Append-only event log.
      const max = await client.query<{ max: number | null }>(
        "SELECT MAX(version) AS max FROM game_events WHERE game_id = $1",
        [state.gameId],
      );
      const persisted = max.rows[0]?.max ?? 0;
      for (const event of state.events.filter((e) => e.version > persisted)) {
        await client.query(
          `INSERT INTO game_events (game_id, version, type, actor_player_id, payload, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [state.gameId, event.version, event.type, event.actorPlayerId ?? null, JSON.stringify(event.payload), new Date(event.createdAt)],
        );
      }
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async loadActive(): Promise<StoredGame[]> {
    const games = await this.pool.query<{ id: string; state: InternalGameState }>(
      "SELECT id, state FROM games WHERE phase <> 'ENDED' AND updated_at > now() - interval '24 hours'",
    );
    const out: StoredGame[] = [];
    for (const row of games.rows) {
      const players = await this.pool.query<{ id: PlayerId; session_token_hash: string }>(
        "SELECT id, session_token_hash FROM game_players WHERE game_id = $1",
        [row.id],
      );
      out.push({
        state: row.state,
        sessions: Object.fromEntries(players.rows.map((p) => [p.id, p.session_token_hash])) as Record<PlayerId, string>,
      });
    }
    return out;
  }

  async delete(gameId: string) {
    await this.pool.query("DELETE FROM games WHERE id = $1", [gameId]);
  }

  async deleteExpired() {
    await this.pool.query(
      "DELETE FROM games WHERE (status IN ('COMPLETED', 'ENDED') AND updated_at < now() - interval '24 hours') OR updated_at < now() - interval '7 days'",
    );
    await this.pool.query("DELETE FROM game_events WHERE created_at < now() - interval '72 hours'");
  }

  async close() {
    await this.pool.end();
  }
}
