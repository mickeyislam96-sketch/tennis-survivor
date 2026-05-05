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

CREATE INDEX IF NOT EXISTS idx_picks_group_user ON picks(group_id, user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_draw_matches_round ON draw_matches(round);

-- Migrations (safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reset_tokens_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_reset_tokens_user ON password_reset_tokens(user_id);

-- Email dedup + approval tracking.
-- The UNIQUE constraint is the dedup key: one email per (user, group, round, type).
-- status: 'pending' = queued awaiting approval, 'sent' = delivered via Brevo.
-- Emails are inserted as 'pending' by the cron. An admin endpoint approves and sends them.
CREATE TABLE IF NOT EXISTS emails_sent (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  round TEXT NOT NULL,
  email_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  subject TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  UNIQUE(user_id, group_id, round, email_type)
);

CREATE INDEX IF NOT EXISTS idx_emails_sent_lookup
  ON emails_sent(user_id, group_id, round, email_type);
CREATE INDEX IF NOT EXISTS idx_emails_sent_pending
  ON emails_sent(status) WHERE status = 'pending';

-- Payment orders: one order per user per group (idempotent on group_id + user_id)
CREATE TABLE IF NOT EXISTS payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'GBP',
  status TEXT NOT NULL DEFAULT 'pending',
  processor_name TEXT,
  processor_order_id TEXT,
  processor_ref TEXT,
  processor_checkout_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);

-- Payment audit log: tracks every state change
CREATE TABLE IF NOT EXISTS payment_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_order_id UUID NOT NULL REFERENCES payment_orders(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Webhook log: for dedup and debugging
CREATE TABLE IF NOT EXISTS payment_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processor_name TEXT NOT NULL,
  webhook_id TEXT,
  raw_payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_orders_group_user
  ON payment_orders(group_id, user_id);
-- Idempotent migrations for payment_orders so pre-existing tables (created
-- before the processor_* columns were added) get backfilled on boot.
-- CREATE TABLE IF NOT EXISTS is a no-op when the table already exists, so
-- without these ALTERs the new columns never appear in production.
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS processor_name TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS processor_order_id TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS processor_ref TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS processor_checkout_url TEXT;
ALTER TABLE payment_orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_payment_orders_status
  ON payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_processor_id
  ON payment_orders(processor_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_order
  ON payment_events(payment_order_id);

-- Operations log: persistent record of all automated actions.
-- Replaces console.log for anything the admin needs to review.
-- Used by the ops-summary endpoint for the daily brief.
CREATE TABLE IF NOT EXISTS ops_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,        -- 'results', 'withdrawal', 'draw', 'lock_time', 'tournament', 'system'
  action TEXT NOT NULL,           -- 'processed', 'detected', 'released', 'auto_set', 'setup', 'error'
  details JSONB DEFAULT '{}',
  tournament_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ops_log_tournament_time
  ON ops_log(tournament_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ops_log_category
  ON ops_log(category, created_at DESC);

-- Scraped results: persisted cache for FlashScore-scraped match data.
-- Replaced in bulk each time the scraper runs. Survives Railway restarts.
CREATE TABLE IF NOT EXISTS scraped_results (
  match_id TEXT NOT NULL,
  round TEXT,
  player1_id TEXT,
  player1_name TEXT,
  player2_id TEXT,
  player2_name TEXT,
  winner_id TEXT,
  winner_name TEXT,
  status TEXT DEFAULT 'scheduled',
  start_time TIMESTAMPTZ,
  score TEXT,
  is_withdrawal BOOLEAN DEFAULT false,
  withdrawn_player_id TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (match_id)
);

CREATE INDEX IF NOT EXISTS idx_scraped_results_round
  ON scraped_results(round);


-- ── Tournament scoping: denormalise tournament_id onto picks + emails_sent ──
-- This prevents cross-tournament contamination bugs where queries forget to
-- JOIN groups. With tournament_id on the table, scoping is a simple WHERE clause.
ALTER TABLE picks ADD COLUMN IF NOT EXISTS tournament_id TEXT;
ALTER TABLE emails_sent ADD COLUMN IF NOT EXISTS tournament_id TEXT;

-- Backfill from groups table (safe to re-run)
UPDATE picks SET tournament_id = g.tournament_id
  FROM groups g WHERE g.id = picks.group_id AND picks.tournament_id IS NULL;

UPDATE emails_sent SET tournament_id = g.tournament_id
  FROM groups g WHERE g.id = emails_sent.group_id AND emails_sent.tournament_id IS NULL;

-- Index for fast tournament-scoped queries
CREATE INDEX IF NOT EXISTS idx_picks_tournament ON picks(tournament_id);
CREATE INDEX IF NOT EXISTS idx_emails_sent_tournament ON emails_sent(tournament_id);


-- ── Admin audit log (added 5 May 2026) ──────────────────────────────────────
-- Every call to an admin endpoint writes one row here, success or failure.
-- Read with: SELECT * FROM admin_audit_log ORDER BY timestamp DESC LIMIT 50;
-- Backed by backend/src/auth/adminAuth.js requireAdmin() middleware.
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id           BIGSERIAL PRIMARY KEY,
  timestamp    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scope        TEXT NOT NULL,             -- scope required by the endpoint (e.g. 'tournament', 'emails', 'legacy')
  token_name   TEXT,                      -- which named token was used (e.g. 'master', 'tournament', 'read')
  route        TEXT NOT NULL,             -- request path
  method       TEXT NOT NULL,             -- GET / POST / etc.
  ip           TEXT,
  user_agent   TEXT,
  success      BOOLEAN NOT NULL,
  reason       TEXT,                      -- failure reason: 'no_token' | 'invalid_token' | 'scope_mismatch'
  body_summary JSONB                      -- redacted request body (no secrets/passwords/tokens)
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_timestamp
  ON admin_audit_log (timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_token
  ON admin_audit_log (token_name, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_failures
  ON admin_audit_log (timestamp DESC) WHERE success = false;

