CREATE TABLE IF NOT EXISTS scores (
  id BIGSERIAL PRIMARY KEY,
  player_id VARCHAR(80) NOT NULL,
  player_name VARCHAR(16) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 10000000),
  run_id VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_score_idx ON scores (score DESC, created_at ASC);
CREATE INDEX IF NOT EXISTS scores_player_idx ON scores (player_id, score DESC);
