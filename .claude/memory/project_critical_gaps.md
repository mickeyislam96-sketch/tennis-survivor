---
name: Critical-gaps audit and fix queue (post-Rome launch)
description: Five critical gaps identified 5 May 2026. Order: alerting → tests → staging → admin secret rotation → DB backup verification. Mickey opted to address these between Rome and Roland Garros.
type: project
---

**Audited 5 May 2026 (session 35), post-Rome-launch.** Mickey explicitly
asked for the bigger-picture gaps. Five rated critical, in priority order:

1. **No observability or alerting.** If the backend, scraper, or webhook
   handler dies, only manual page-refresh detects it. Scraper cache TTL
   is 30min; if scrape fails 4hrs running, lock-time decisions get made
   on stale data. **Fix:** UptimeRobot or Better Stack on `/api/health`
   (5-min pings, SMS alert) + Railway log alert on 500s. ~10min setup.

2. **No automated tests.** Every push is a roll of the dice. The 5 May
   invite-case bug had been latent for weeks; one 5-line test would have
   caught it. Three white-screen incidents from React hooks rules — same
   lesson. **Fix:** ~20 backend integration tests covering invite
   round-trip, payment-gate, leaderboard math, picks-available filter.
   Two days.

3. **No staging environment.** Every change goes from laptop to live
   users. Smoke test covers some things but not data-corrupting bugs
   (bad migration, wrong tournament ID). **Fix:** Railway branch deploy
   from `staging` branch. Half a day. Free tier.

4. **Single shared `ADMIN_SECRET`.** Loss of that secret = total
   compromise (refund all payments, reset eliminations, send arbitrary
   emails, fake confirmed payments). No audit log. **Fix before first
   paid tournament:** scoped tokens per admin action, every call logged.

5. **DB backups unverified.** Railway runs automated Postgres backups
   but restore has never been tested. Day you need it is the worst time
   to discover it doesn't work. **Fix:** quarterly clone-and-restore
   smoke test. 30min/quarter.

**Suggested sequence:**

- Now: alerting (#1) — quick win, catches future incidents while we work.
- Between Rome final and RG R1 (4-day window): tests (#2), staging (#3),
  admin secret rotation (#4). All three before first paid event.
- Background: DB restore verification (#5) — quarterly cron in Mickey's
  calendar.

**Why this matters:** the audit was prompted by today's invite-bug
incident. Mickey realised the failure mode wasn't the bug itself but
that nobody noticed for hours, and there was no automated check that
would have caught it. Same shape applies to all five gaps.

**How to apply:** before starting any new feature work, check if any
of these five gaps would be exercised by the change. New webhook? It
needs alerting. New endpoint? It needs an integration test. Mutating
admin action? It needs scoped token + audit log.


## Progress as of 5 May 2026 (end of session 35)

| # | Gap | Status |
|---|---|---|
| 1 | Observability / alerting | **Pending Mickey** — UptimeRobot account creation. Backend side ready: `/api/health` returns 503 with `scraper_freshness: STALE` when scrapes go missing during active hours. Steps documented in chat. |
| 2 | Automated tests | **Done.** `backend/tests/smoke/` (11 tests against live API). `backend/tests/integration/` (DB-backed, one example, skips without `TEST_DATABASE_URL`). `.github/workflows/tests.yml` runs both on every push (smoke against prod + integration with Postgres 17 service container). First run green at commit `273455b`, ~30s total. |
| 3 | Staging environment | **Not started — but now critical.** New working agreement (`docs/working-agreement.md`, 6 May 2026) routes all user-facing changes through Vercel preview URLs. Without a staging Railway service, those previews still hit prod for backend mutations. Mickey to spin up a Railway service that auto-deploys from `staging` branch with its own Postgres + ACTIVE_TOURNAMENT env. Until then, mutating tests run on prod with cleanup. |
| 4 | `ADMIN_SECRET` rotation | **Stage 1 shipped.** New `backend/src/auth/adminAuth.js` provides `requireAdmin(req, res, scope)` and the back-compat `checkSecret(req, res)`. Every admin call now writes to `admin_audit_log`. Per-scope tokens supported via `ADMIN_TOKEN_<SCOPE>` env vars but currently unused — `ADMIN_SECRET` still grants every scope. Stage 2 (incremental scope rollout) deferred. |
| 5 | DB backups | **Mostly addressed already.** Daily pg_dump runs via `.github/workflows/db-backup.yml` (gzipped, 30-day artifact retention). Restore verification still untested — quarterly process. |

**Stage 2 plan (4-day window between Rome final and RG R1):**

- Mickey runs UptimeRobot setup.
- Set up Railway staging branch deploy.
- Roll out scoped tokens per critical action (`ADMIN_TOKEN_FINANCIAL` first — refunds and settlement are the highest blast radius).
- Test DB restore from a recent pg_dump artifact.
