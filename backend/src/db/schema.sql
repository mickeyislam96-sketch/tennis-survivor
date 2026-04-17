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
