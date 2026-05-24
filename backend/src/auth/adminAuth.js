/**
 * Admin authentication & audit log.
 *
 * Two-tier token model:
 *
 *   1. Master token: process.env.ADMIN_SECRET
 *      - Backwards-compatible "superuser" token.
 *      - Grants every scope.
 *      - Existing scripts (ops cron, email approval links, scrape triggers)
 *        keep working exactly as before.
 *
 *   2. Scoped tokens: process.env.ADMIN_TOKEN_<SCOPE> = <value>
 *      - One env var per logical scope. Examples:
 *           ADMIN_TOKEN_READ        — inspection only (status, picks, lookups)
 *           ADMIN_TOKEN_TOURNAMENT  — locks, scrape, draw fixes
 *           ADMIN_TOKEN_USER        — fix-email, revive, reset
 *           ADMIN_TOKEN_EMAILS      — email approval, sends
 *      - Each token is single-purpose. Compromise of one limits blast radius.
 *      - Add or rotate without touching code: just set/change the env var.
 *
 * Every authentication attempt (success or failure) writes one row to
 * admin_audit_log, so we can answer "who did what when" after the fact.
 *
 * Token extraction order (same as before):
 *   1. Authorization: Bearer <secret>
 *   2. POST body { secret: ... }
 *   3. Query string ?secret=...   (used by one-click email approval links)
 *
 * Usage from a route:
 *   import { requireAdmin } from '../auth/adminAuth.js';
 *   adminRouter.post('/process-results', async (req, res) => {
 *     const ok = await requireAdmin(req, res, 'tournament');
 *     if (!ok) return;
 *     ...
 *   });
 *
 * Backwards-compat usage (no scope changes needed):
 *   import { checkSecret } from '../auth/adminAuth.js';
 *   if (!await checkSecret(req, res)) return;     // logs as scope='legacy'
 */

import { pool } from '../db/pool.js';

// ── Scope token registry ─────────────────────────────────────────────────────
// Built once at boot from environment. Map of scope name → secret value.
const SCOPE_TOKENS = {};
function loadScopeTokens() {
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('ADMIN_TOKEN_') && v) {
      const scope = k.slice('ADMIN_TOKEN_'.length).toLowerCase();
      SCOPE_TOKENS[scope] = v;
    }
  }
}
loadScopeTokens();

function getMasterSecret() {
  return process.env.ADMIN_SECRET || null;
}

// ── Token extraction ─────────────────────────────────────────────────────────
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  if (req.body && typeof req.body === 'object' && req.body.secret) {
    return req.body.secret;
  }
  if (req.query && req.query.secret) {
    return req.query.secret;
  }
  return null;
}

function getClientInfo(req) {
  // Express puts proxy-aware IP on req.ip when trust proxy is set.
  // Fall back to the X-Forwarded-For chain if not.
  const fwd = req.headers['x-forwarded-for'];
  const ip = req.ip || (typeof fwd === 'string' ? fwd.split(',')[0].trim() : null);
  return {
    ip:        ip ? ip.slice(0, 64) : null,
    userAgent: (req.headers['user-agent'] || '').slice(0, 256) || null,
  };
}

// Strip secrets out of req.body before logging it.
function redactBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const SENSITIVE_KEYS = new Set(['secret', 'password', 'token', 'apiKey', 'api_key', 'auth', 'authorization']);
  const out = {};
  for (const [k, v] of Object.entries(body)) {
    if (SENSITIVE_KEYS.has(k)) {
      out[k] = '[redacted]';
    } else if (typeof v === 'string' && v.length > 200) {
      out[k] = v.slice(0, 200) + '…';
    } else {
      out[k] = v;
    }
  }
  return out;
}

// ── Audit logging ────────────────────────────────────────────────────────────
async function logAudit(entry) {
  try {
    await pool.query(
      `INSERT INTO admin_audit_log
         (scope, token_name, route, method, ip, user_agent, success, reason, body_summary)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)`,
      [
        entry.scope,
        entry.tokenName || null,
        entry.route,
        entry.method,
        entry.ip,
        entry.userAgent,
        entry.success,
        entry.reason || null,
        entry.bodySummary ? JSON.stringify(entry.bodySummary) : null,
      ]
    );
  } catch (err) {
    // Audit-log failures must never block the actual request.
    console.error('[admin-audit] log write failed:', err.message);
  }
}

// ── Main check ───────────────────────────────────────────────────────────────
/**
 * Verify a request is allowed to call an admin endpoint with the given scope.
 * Writes an audit log row regardless of outcome.
 *
 * @param {object} req   Express request
 * @param {object} res   Express response
 * @param {string} scope Required scope (e.g. 'tournament', 'emails', 'legacy')
 * @returns {Promise<string|null>} The token name that was used (e.g. 'master',
 *   'tournament') on success, or null on failure (response already sent).
 */
export async function requireAdmin(req, res, scope = 'legacy') {
  const provided = extractToken(req);
  const { ip, userAgent } = getClientInfo(req);
  const route = req.originalUrl ? req.originalUrl.split('?')[0] : req.path;
  const method = req.method;
  const bodySummary = redactBody(req.body);

  if (!provided) {
    await logAudit({ scope, route, method, ip, userAgent, success: false, reason: 'no_token', bodySummary });
    res.status(401).json({ error: 'Unauthorised — missing admin token' });
    return null;
  }

  // 1. Try scoped tokens.
  for (const [name, value] of Object.entries(SCOPE_TOKENS)) {
    if (provided === value) {
      // Token matched. Does it have the required scope?
      // A scoped token's *name* is its scope.
      if (name === scope || name === 'master') {
        await logAudit({ scope, tokenName: name, route, method, ip, userAgent, success: true, bodySummary });
        return name;
      }
      // Token exists but is for a different scope. Reject.
      await logAudit({
        scope,
        tokenName: name,
        route,
        method,
        ip,
        userAgent,
        success: false,
        reason: `scope_mismatch (token=${name}, required=${scope})`,
        bodySummary,
      });
      res.status(403).json({ error: 'Forbidden — token lacks required scope' });
      return null;
    }
  }

  // 2. Fall back to the master ADMIN_SECRET.
  //
  // Important: if the requested scope has its own scoped token configured
  // (ADMIN_TOKEN_<SCOPE> set in env), the master secret no longer grants
  // that scope. This is how Stage 2 rollout works — adding ADMIN_TOKEN_FINANCIAL
  // on Railway automatically restricts the master secret from refund/payout
  // endpoints, no code redeploy needed.
  //
  // Scopes that don't have their own scoped token still accept the master
  // (back-compat with all existing scripts: ops cron, email approval links,
  // scrape triggers). This lets us roll out scopes incrementally.
  const master = getMasterSecret();
  if (master && provided === master) {
    if (SCOPE_TOKENS[scope]) {
      // Scope has its own token configured. Master is blocked.
      await logAudit({
        scope,
        tokenName: 'master',
        route,
        method,
        ip,
        userAgent,
        success: false,
        reason: `master_blocked_by_scoped_token (scope=${scope})`,
        bodySummary,
      });
      res.status(403).json({ error: 'Forbidden — this scope requires its scoped token' });
      return null;
    }
    await logAudit({ scope, tokenName: 'master', route, method, ip, userAgent, success: true, bodySummary });
    return 'master';
  }

  // 3. No match.
  await logAudit({ scope, route, method, ip, userAgent, success: false, reason: 'invalid_token', bodySummary });
  res.status(401).json({ error: 'Unauthorised — invalid admin token' });
  return null;
}

/**
 * Backwards-compatible alias for legacy call sites that used checkSecret().
 * Returns true on success, false on failure (response already sent).
 *
 * Equivalent to: requireAdmin(req, res, 'legacy').
 */
export async function checkSecret(req, res) {
  const result = await requireAdmin(req, res, 'legacy');
  return result !== null;
}

// ── Test helper ──────────────────────────────────────────────────────────────
// Exposed for tests only — lets test fixtures inject scope tokens without
// poking at process.env. Not used by production code.
export function _setScopeTokenForTest(scope, value) {
  if (process.env.NODE_ENV === 'test') {
    SCOPE_TOKENS[scope.toLowerCase()] = value;
  }
}
