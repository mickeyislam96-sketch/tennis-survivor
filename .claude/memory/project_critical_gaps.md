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

5. **DB backups unverified.** Daily pg_dump runs via GitHub Actions but
   restore has never been tested. **Status: PARTIAL.** Backup workflow
   live, restore verification still untested. Quarterly process to
   establish.

**Final pre-RG queue (11 days to RG R1 as of end session 36):**

- Stage 2 admin tokens (gap #4 stage 2) — implement `ADMIN_TOKEN_FINANCIAL`,
  gate refunds + payouts + settlement endpoints. Single new env var,
  ~5-line route changes per endpoint.
- DB-restore verification (gap #5) — pull latest pg_dump artifact,
  restore to throwaway Docker Postgres, verify schema and row counts.
  Quarterly cadence after first verification.
- T2 from 7 May brief — suspended/retired/walkover match status fix.
  Needs proper FlashScore-status reading rather than score inference.
  Integration test required before merging.

**Suggested order:** DB-restore verification first (lowest risk, no
code change), then Stage 2 admin tokens (touches payment paths but is
additive — old behaviour preserved via back-compat), then T2 (medium
blast, touches scraper status mapper).
