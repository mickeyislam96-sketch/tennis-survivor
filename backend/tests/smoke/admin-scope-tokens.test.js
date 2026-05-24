/**
 * Unit-style test for adminAuth scope-token enforcement.
 *
 * Stage-2 contract: when ADMIN_TOKEN_<SCOPE> is configured for a scope,
 * the master ADMIN_SECRET no longer grants access to that scope. Master
 * still grants every other scope (back-compat for ops cron, email links,
 * scrape triggers).
 *
 * History: 2026-05-08 — first scope rollout was 'financial' (refund,
 * order list, revenue summary). Stage-1 (session 35) shipped the audit
 * log + scoped-token plumbing but kept master-grants-everything as the
 * back-compat path. Stage-2 flips master into "blocked when this scope
 * has its own token" mode automatically — no code redeploy needed when
 * Mickey rotates env vars on Railway.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';

// Tests use a stubbed pool so we don't need a real DB. adminAuth's audit
// log writes are best-effort — failures don't block the auth check.
vi.mock('../../src/db/pool.js', () => ({
  pool: { query: async () => ({ rows: [], rowCount: 0 }) },
}));

const ENV_KEYS_TO_RESTORE = ['ADMIN_SECRET', 'ADMIN_TOKEN_FINANCIAL', 'NODE_ENV'];
const SAVED_ENV = {};

beforeAll(() => {
  for (const k of ENV_KEYS_TO_RESTORE) SAVED_ENV[k] = process.env[k];
});

afterEach(() => {
  for (const k of ENV_KEYS_TO_RESTORE) {
    if (SAVED_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = SAVED_ENV[k];
  }
});

function buildReq() {
  return {
    headers: { authorization: '', 'user-agent': 'vitest' },
    body: {},
    query: {},
    method: 'POST',
    originalUrl: '/api/payments/admin/refund',
    path: '/admin/refund',
    ip: '127.0.0.1',
  };
}
function buildRes() {
  const res = { _status: null, _body: null };
  res.status = (n) => { res._status = n; return res; };
  res.json = (b) => { res._body = b; return res; };
  return res;
}

describe('adminAuth scope enforcement', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('master ADMIN_SECRET grants a scope when no scoped token is configured', async () => {
    process.env.ADMIN_SECRET = 'master-only-token';
    delete process.env.ADMIN_TOKEN_FINANCIAL;

    // Re-import to pick up the env state. adminAuth caches scope tokens at boot.
    vi.resetModules();
    const { requireAdmin, _setScopeTokenForTest } = await import('../../src/auth/adminAuth.js');

    const req = buildReq();
    req.headers.authorization = 'Bearer master-only-token';
    const res = buildRes();

    const result = await requireAdmin(req, res, 'financial');
    expect(result).toBe('master');
    expect(res._status).toBeNull();
  });

  it('master ADMIN_SECRET is BLOCKED when a scoped token exists for that scope', async () => {
    process.env.ADMIN_SECRET = 'master-secret';
    process.env.ADMIN_TOKEN_FINANCIAL = 'financial-only-token';

    vi.resetModules();
    const { requireAdmin } = await import('../../src/auth/adminAuth.js');

    const req = buildReq();
    req.headers.authorization = 'Bearer master-secret';
    const res = buildRes();

    const result = await requireAdmin(req, res, 'financial');
    expect(result).toBeNull();
    expect(res._status).toBe(403);
    expect(res._body?.error).toMatch(/scoped token/i);
  });

  it('the scoped token still works when configured', async () => {
    process.env.ADMIN_SECRET = 'master-secret';
    process.env.ADMIN_TOKEN_FINANCIAL = 'financial-only-token';

    vi.resetModules();
    const { requireAdmin } = await import('../../src/auth/adminAuth.js');

    const req = buildReq();
    req.headers.authorization = 'Bearer financial-only-token';
    const res = buildRes();

    const result = await requireAdmin(req, res, 'financial');
    expect(result).toBe('financial');
    expect(res._status).toBeNull();
  });

  it('master still grants OTHER scopes when one scope is locked down', async () => {
    process.env.ADMIN_SECRET = 'master-secret';
    process.env.ADMIN_TOKEN_FINANCIAL = 'financial-only-token';

    vi.resetModules();
    const { requireAdmin } = await import('../../src/auth/adminAuth.js');

    // 'tournament' scope has no scoped token — master should still grant it.
    const req = buildReq();
    req.headers.authorization = 'Bearer master-secret';
    const res = buildRes();

    const result = await requireAdmin(req, res, 'tournament');
    expect(result).toBe('master');
    expect(res._status).toBeNull();
  });

  it('a token for the wrong scope is rejected with 403', async () => {
    process.env.ADMIN_SECRET = 'master-secret';
    process.env.ADMIN_TOKEN_FINANCIAL = 'financial-only-token';
    process.env.ADMIN_TOKEN_TOURNAMENT = 'tournament-only-token';

    vi.resetModules();
    const { requireAdmin } = await import('../../src/auth/adminAuth.js');

    const req = buildReq();
    req.headers.authorization = 'Bearer tournament-only-token';
    const res = buildRes();

    // tournament token used to call a financial-scoped endpoint
    const result = await requireAdmin(req, res, 'financial');
    expect(result).toBeNull();
    expect(res._status).toBe(403);
  });

  it('an entirely unknown token is rejected with 401', async () => {
    process.env.ADMIN_SECRET = 'master-secret';

    vi.resetModules();
    const { requireAdmin } = await import('../../src/auth/adminAuth.js');

    const req = buildReq();
    req.headers.authorization = 'Bearer not-a-real-token';
    const res = buildRes();

    const result = await requireAdmin(req, res, 'financial');
    expect(result).toBeNull();
    expect(res._status).toBe(401);
  });
});
