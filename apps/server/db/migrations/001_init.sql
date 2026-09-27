-- Sabha of Hastinapur — initial schema

CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  room_code VARCHAR(6) UNIQUE NOT NULL,

  status VARCHAR(32) NOT NULL,
  phase VARCHAR(32) NOT NULL,

  mode VARCHAR(32) NOT NULL,

  host_player_id UUID,

  state_version INTEGER NOT NULL DEFAULT 0,

  -- Server-authoritative state, including hidden role data. Never served to clients.
  state JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL
);

-- Public roster. Roles are deliberately NOT stored here.
CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,

  display_name VARCHAR(20) NOT NULL,

  seat SMALLINT NOT NULL,

  session_token_hash TEXT NOT NULL,

  connected BOOLEAN NOT NULL DEFAULT FALSE,

  ready BOOLEAN NOT NULL DEFAULT FALSE,

  joined_at TIMESTAMPTZ NOT NULL,

  UNIQUE(game_id, seat),
  UNIQUE(game_id, display_name)
);

CREATE INDEX IF NOT EXISTS game_players_session_idx ON game_players(session_token_hash);

-- Append-only event log.
CREATE TABLE IF NOT EXISTS game_events (
  id BIGSERIAL PRIMARY KEY,

  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,

  version INTEGER NOT NULL,

  type VARCHAR(64) NOT NULL,

  actor_player_id UUID,

  payload JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL,

  UNIQUE(game_id, version)
);

-- Anonymous, long-lived analytics. No names, no session data.
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGSERIAL PRIMARY KEY,
  type VARCHAR(64) NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS games_phase_updated_idx ON games(phase, updated_at);
CREATE INDEX IF NOT EXISTS game_events_created_idx ON game_events(created_at);
