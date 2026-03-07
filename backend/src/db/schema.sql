-- Tennis Last Man Standing - PostgreSQL schema

-- Grand Slam rounds: R128, R64, R32, R16, QF, SF, F
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  entry_fee_cents INTEGER DEFAULT 0,
  prize_pool_cents INTEGER DEFAULT 0,
  tournament_id TEXT,
  admin_user_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  display_name TEXT NOT NULL,
  is_alive BOOLEAN DEFAULT true,
  eliminated_round TEXT,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  round TEXT NOT NULL,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  survived BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, round)
);

CREATE TABLE IF NOT EXISTS draw_players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  seed INTEGER,
  round_eliminated TEXT
);

CREATE TABLE IF NOT EXISTS draw_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round TEXT NOT NULL,
  match_order INTEGER NOT NULL,
  player1_id TEXT REFERENCES draw_players(id),
  player2_id TEXT REFERENCES draw_players(id),
  winner_id TEXT REFERENCES draw_players(id),
  status TEXT DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tiebreaker_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id),
  user_id UUID NOT NULL,
  match_id UUID REFERENCES draw_matches(id),
  question_key TEXT NOT NULL,
  answer_value NUMERIC NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id, match_id, question_key)
);

CREATE INDEX idx_picks_group_user ON picks(group_id, user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_draw_matches_round ON draw_matches(round);
