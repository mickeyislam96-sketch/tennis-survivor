---
name: Critical-gaps audit and fix queue (post-Rome launch)
description: Five critical gaps identified 5 May 2026. Status as of end-session 36 (7 May 2026): #1 ✅, #2 ✅, #3 ✅, #4 stage 1 ✅, #5 still open. Stage 2 admin tokens before RG.
type: project
---

**Audited 5 May 2026 (session 35), post-Rome-launch.** Mickey explicitly
asked for the bigger-picture gaps. Five rated critical, in priority order:

1. **Observability / alerting.** If the backend, scraper, or webhook
   handler dies, only manual page-refresh detects it. Scraper cache TTL
   is 30min; if scrape fails 4hrs running, lock-time decisions get made
   on stale data. **Status: CLOSED 7 May (session 36).** UptimeRobot now
   monitors prod and staging /api/health every 5min. Email alerts to
   mickeyislam96@gmail.com on both. Confirmed working — Mickey received
   an alert during the morning's prod redeploy. Required prerequisite
   T1 cacheAge fix (also session 36) so /api/health stops lying about
   freshness.

2. **Automated tests.** Every push was a roll of the dice. **Status:
   CLOSED session 35.** ~20 backend tests covering invite round-trip,
   leaderboard math, picks-available filter. CI runs on every push.
   Two-day effort delivered.

3. **Staging environment.** Every change went from laptop to live
   users. Smoke test covered some things but not data-corrupting bugs
   (bad migration, wrong tournament ID). **Status: CLOSED 7 May
   (session 36).** Railway env duplicated, isolated Postgres, Vercel
   preview wired. `staging` branch is the test gate before main.

4. **Single shared `ADMIN_SECRET`.** Loss of that secret = total
   compromise (refund all payments, reset eliminations, send arbitrary
   emails, fake confirmed payments). **Status: STAGE 1 CLOSED session
   35.** Central `requireAdmin(req, res, scope)` module + `admin_audit_log`
   table. Per-scope `ADMIN_TOKEN_<SCOPE>` env vars supported but unused.
   **Stage 2 still open**: roll out scoped tokens for financial actions
   (refunds, payouts, settlement) before RG R1 on 18 May.

5. **DB backups + restore verified.** Daily pg_dump runs via GitHub
   Actions; restore drill workflow shipped session 38 (PR #17,
   `db-restore-verify.yml`). Quarterly cron + manual script
   (`scripts/test-db-restore.sh`). First quarterly fire 1 Jul 2026.
   **Status: DONE in code.** Manual smoke run pending so we don't wait
   until July to discover a bug.

**Final pre-RG queue (9 days to RG R1 as of end session 38b — 9 May 2026):**

- **Mickey-side env-var rollout for Stage 2 admin tokens** (gap #4
  stage 2). Code shipped session 38 PR #16 — once Mickey sets
  `ADMIN_TOKEN_FINANCIAL` on Railway, master `ADMIN_SECRET` is
  auto-blocked from financial endpoints. No code redeploy.
- **First manual DB-restore smoke run** — pull latest pg_dump artifact,
  run `scripts/test-db-restore.sh`, confirm schema + row counts.
  Should be ≤30 minutes. After this, the quarterly workflow gives us
  ongoing assurance.
- **T2 / suspended-vs-retired status mapping** — partially addressed by
  walkover handling shipped session 38b (scraper no longer guesses
  walkover winners; retired requires strict majority on score).
  Suspended status remains untreated — those matches resume later, no
  winner declared. Brief skill domain caveat covers the lesson; code
  change deferred to its own session.
- **Walkover daily check during tournament** — operational, not a code
  task. Run `GET /api/admin/walkover-pending` every morning; populate
  `manualResultOverrides` for any non-zero count. Phase 8.5 in
  transition prompts.

**Suggested order:** Stage 2 env var rollout (zero-code, immediate
impact). Then DB-restore smoke (zero-code). Then T2 suspended-status
mapping (own session, integration test required, low blast radius).
