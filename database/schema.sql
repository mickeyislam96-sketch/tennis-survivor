-- Final Serve-ivor — Supabase PostgreSQL Schema
-- Run this once against your Supabase project via the SQL Editor or migration tool.
-- All tables use UUID primary keys and include created_at timestamps.

-- ── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Users ───────────────────────────────────────────────────────────────────
-- Mirrors Supabase Auth; extend with app-specific profile fields.
CREATE TABLE IF NOT EXISTS users (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email         TEXT UNIQUE NOT NULL,
  display_name  TEXT NOT NULL,
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tournaments ──────────────────────────────────────────────────────────────
-- One row per ATP event. Add a new row to launch a new season of pools.
CREATE TABLE IF NOT EXISTS tournaments (
  id                  TEXT PRIMARY KEY,          -- e.g. 'miami-2026'
  name                TEXT NOT NULL,             -- 'Miami Open'
  short_name          TEXT NOT NULL,             -- 'Miami'
  year                INT  NOT NULL,
  tour_level          TEXT NOT NULL,             -- 'ATP Masters 1000'
  surface             TEXT,                      -- 'Hard', 'Clay', 'Grass'
  location            TEXT,
  start_date          DATE NOT NULL,
  end_date            DATE NOT NULL,
  status              TEXT NOT NULL DEFAULT 'upcoming',
                        -- CHECK (status IN ('upcoming','active','completed'))
  draw_available      BOOLEAN NOT NULL DEFAULT FALSE,
  pick_window_open    TIMESTAMPTZ,               -- when picks open for current round
  pick_window_close   TIMESTAMPTZ,               -- when picks close
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Pools ────────────────────────────────────────────────────────────────────
-- A pool is one group of players competing across a single tournament.
-- Multiple pools can run for the same tournament (private friend groups, etc.)
CREATE TABLE IF NOT EXISTS pools (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tournament_id   TEXT NOT NULL REFERENCES tournaments(id),
  name            TEXT NOT NULL,
  invite_code     TEXT UNIQUE NOT NULL,
  entry_fee_cents INT  NOT NULL DEFAULT 0,
  prize_pool_cents INT NOT NULL DEFAULT 0,
  admin_user_id   UUID NOT NULL REFERENCES users(id),
  is_public       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Entries ──────────────────────────────────────────────────────────────────
-- One row per user per pool. Tracks whether they are still alive.
CREATE TABLE IF NOT EXISTS entries (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pool_id         UUID NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id),
  is_alive        BOOLEAN NOT NULL DEFAULT TRUE,
  eliminated_round TEXT,                         -- e.g. 'R32', 'QF'
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (pool_id, user_id)
);

-- ── Picks ────────────────────────────────────────────────────────────────────
-- One row per round per entry. Records the player chosen and outcome.
CREATE TABLE IF NOT EXISTS picks (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  pool_id         UUID NOT NULL REFERENCES pools(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  round           TEXT NOT NULL,                 -- 'R64', 'R32', 'R16', 'QF', 'SF', 'F'
  player_id       TEXT NOT NULL,
  player_name     TEXT NOT NULL,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  survived        BOOLEAN,                       -- NULL until round completes
  UNIQUE (entry_id, round)                       -- one pick per round per entry
);

-- ── Payments ─────────────────────────────────────────────────────────────────
-- Placeholder for future Stripe / PayPal integration.
-- NOT active — do not process real transactions against this table yet.
CREATE TABLE IF NOT EXISTS payments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id        UUID NOT NULL REFERENCES entries(id),
  user_id         UUID NOT NULL REFERENCES users(id),
  pool_id         UUID NOT NULL REFERENCES pools(id),
  amount_cents    INT  NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'GBP',
  provider        TEXT,                          -- 'stripe' | 'paypal'
  provider_ref    TEXT,                          -- provider transaction ID
  status          TEXT NOT NULL DEFAULT 'pending',
                    -- CHECK (status IN ('pending','completed','failed','refunded'))
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_entries_pool    ON entries(pool_id);
CREATE INDEX IF NOT EXISTS idx_entries_user    ON entries(user_id);
CREATE INDEX IF NOT EXISTS idx_picks_entry     ON picks(entry_id);
CREATE INDEX IF NOT EXISTS idx_picks_pool      ON picks(pool_id);
CREATE INDEX IF NOT EXISTS idx_picks_user      ON picks(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_entry  ON payments(entry_id);

-- ── Row Level Security (Supabase) ────────────────────────────────────────────
-- Enable RLS on all tables. Policies below allow users to read their own data
-- and restrict writes appropriately. Adjust to match your auth setup.

ALTER TABLE users     ENABLE ROW LEVEL SECURITY;
ALTER TABLE pools     ENABLE ROW LEVEL SECURITY;
ALTER TABLE entries   ENABLE ROW LEVEL SECURITY;
ALTER TABLE picks     ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- Tournaments: anyone can read
CREATE POLICY "tournaments_read_all" ON tournaments FOR SELECT USING (true);

-- Pools: anyone can read public pools; members can read private pools
CREATE POLICY "pools_read_public" ON pools FOR SELECT USING (is_public = true);
CREATE POLICY "pools_read_member" ON pools FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.pool_id = pools.id
      AND e.user_id = auth.uid()
  ));

-- Entries: users can read entries for pools they belong to
CREATE POLICY "entries_read_own_pool" ON entries FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM entries e2
    WHERE e2.pool_id = entries.pool_id
      AND e2.user_id = auth.uid()
  ));
CREATE POLICY "entries_insert_own" ON entries FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Picks: users can read picks for pools they belong to; only insert their own
CREATE POLICY "picks_read_pool" ON picks FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM entries e
    WHERE e.pool_id = picks.pool_id
      AND e.user_id = auth.uid()
  ));
CREATE POLICY "picks_insert_own" ON picks FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Payments: users can only see their own payment records
CREATE POLICY "payments_read_own" ON payments FOR SELECT
  USING (user_id = auth.uid());
