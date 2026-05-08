---
name: Admin scope-token rollout — Stage 2 contract (PR #16, 8 May 2026)
description: How to roll out scoped admin tokens. Setting ADMIN_TOKEN_<SCOPE> on Railway automatically blocks the master from that scope.
type: feedback
---

**Stage 1 (session 35):** central `requireAdmin(req, res, scope)` in
`backend/src/auth/adminAuth.js`, every admin call audited to
`admin_audit_log`, scoped tokens supported via env vars but unused.
Master `ADMIN_SECRET` granted every scope.

**Stage 2 (PR #16, 8 May 2026):** when `ADMIN_TOKEN_<SCOPE>` is set in
env, the master `ADMIN_SECRET` no longer grants that scope. Routes
calling `requireAdmin(req, res, 'financial')` strictly require the
financial token. No code redeploy needed when Mickey rotates env vars
on Railway — adding `ADMIN_TOKEN_FINANCIAL` flips that scope into
strict mode automatically.

## Endpoints currently scoped

| Scope | Endpoints | Token env var |
|---|---|---|
| financial | `POST /api/payments/admin/refund`, `GET /api/payments/admin/list`, `GET /api/payments/admin/revenue` | `ADMIN_TOKEN_FINANCIAL` |
| (legacy) | everything else under `/api/admin/*` and `/api/payments/admin/*` | `ADMIN_SECRET` only |

## Mickey's Railway rollout steps for financial scope

1. Generate a new strong token (e.g. `openssl rand -hex 32`).
2. Railway → backend prod service → Variables → add `ADMIN_TOKEN_FINANCIAL=<token>`.
3. Railway redeploys automatically.
4. Update wherever the master secret was used for refund/payout work
   (admin scripts, runbooks, any saved bookmarks) to use the new token.
5. Verify: `curl -H "Authorization: Bearer <ADMIN_SECRET>" -X POST .../api/payments/admin/refund -d '{"orderId":"x"}'` should now return 403 with `Forbidden — this scope requires its scoped token`.
6. Verify: same call with `Bearer <ADMIN_TOKEN_FINANCIAL>` should still process.
7. Repeat on staging service first if you want to dry-run (recommended).

## Adding more scopes

Same recipe. Pick a scope name (lowercase, e.g. `tournament`, `user`,
`emails`), switch the relevant `requireAdmin(req, res, 'legacy')` (or
`checkSecret(req, res)`) calls in routes to
`requireAdmin(req, res, '<scope>')`, then on Railway set
`ADMIN_TOKEN_<SCOPE>=<token>`. Master is automatically blocked from
that scope on the next request.

## Why this design

- **Zero-downtime rollout.** No code change required when Mickey is
  ready to enable strict mode for a scope.
- **Per-scope blast radius.** Compromise of one scoped token doesn't
  enable refunds.
- **Audit log catches misuse.** Every attempt (success or failure)
  writes a row, so we can answer "was the master used to refund X?"
  after the fact.
- **Back-compat preserved.** Scopes without their own token still
  accept the master, so ops cron / email approval / scrape triggers
  keep working as-is.

## Tests

`backend/tests/smoke/admin-scope-tokens.test.js` covers six cases:
master grants when no scoped token, master blocked when scoped exists,
correct scoped token works, master still grants other scopes, wrong
scope rejected, unknown token rejected.
