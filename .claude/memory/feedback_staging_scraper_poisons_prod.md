---
name: Staging scraper was poisoning production (cross-env write)
description: 1 Jun 2026 — RG bracket/leaderboard/pick-pool broke because the STAGING scraper (cloned from prod) was scraping Rome and POSTing to the PRODUCTION backend with prod's ADMIN_SECRET, overwriting good RG data every hour. The wrong-event guard then rejected it, falling back to seed_draw.
type: feedback
---

# Staging scraper was poisoning production

**The outage (1 Jun 2026, session 42).** Roland Garros bracket showed
`dataSource: seed_draw` (0 completed), the leaderboard showed everyone alive /
0 rounds survived, and the QF pick pool ballooned to 111 phantom players — all
at once, deep into the tournament.

**Symptom chain (how to read this class of failure):**
- `/api/health` `data_adapter` showed 95 fixtures (raw, unfiltered) but
  `/api/draw/bracket` returned pure `seed_draw`. The asymmetry is the tell:
  `getDraw`→`overlayFixtures` applies `filterFixturesToTournamentWindow`
  (the 27 May wrong-event guard); the health/adapter path does not. Raw count
  high + overlay empty ⇒ the guard is dropping everything ⇒ the cache holds
  **wrong-event data**.
- `/api/admin/scraper-fixtures?secret=…` confirmed it: 95 fixtures, Final
  "Sinner d. Ruud", dates 8–17 May = **Rome 2026**, not RG.
- Bracket shape was the first clue: counts `R1:32,…,F:1` (95 total, Final
  completed) = a finished 96-draw Masters. RG is a 127-match Slam whose Final
  is 7 Jun. A completed Final mid-tournament ⇒ wrong event.

**Root cause.** The **staging** environment was cloned from prod (session 36)
and its scraper (`valiant-forgiveness`, staging env
`6e2a12c6-df61-45dc-89e0-d8e71ca0d14f`) was never reconfigured:
- `BACKEND_URL` = `https://tennis-survivor-production.up.railway.app` (PROD!)
- `FLASHSCORE_URL`/`RESULTS_URL` = `…/atp-singles/rome/` (Rome, the active
  event when staging was created)
- `ADMIN_SECRET` = the **prod** secret (so prod accepted its writes)

Both scrapers run hourly. Prod posted 122 correct RG fixtures at :02; the
staging scraper posted 95 Rome fixtures to prod at :04, two minutes later,
clobbering it. `setScrapedResults` replaces the whole cache, so whoever writes
last wins — and staging won most hours. The 27 May guard then correctly
rejected the Rome data from the overlay, leaving the bracket on `seed_draw`.

**Fix (Railway, via Chrome MCP).** In the **staging** env, repointed the
scraper: `BACKEND_URL`→`https://tennis-survivor-staging.up.railway.app`,
`FLASHSCORE_URL`/`RESULTS_URL`→`…/french-open/…`. Deployed. Then forced a
prod scrape (Run now) → cache healed to 122 RG fixtures; bracket
`seed_draw+scraper(107)+overrides(2)`, QF pool → ~8, leaderboard correct.

**Lessons / how to apply:**
1. **A scraper's `BACKEND_URL` is a loaded gun.** Any non-prod scraper that
   has prod's `BACKEND_URL` + prod's `ADMIN_SECRET` can silently corrupt prod.
   When cloning an environment, the scraper's `BACKEND_URL` MUST be repointed
   to that env's own backend, and ideally given that env's own admin secret.
2. **Latent risk still present:** the staging scraper still holds the prod
   `ADMIN_SECRET`. `BACKEND_URL` now points at staging, but if anyone flips it
   back, corruption returns. Proper fix = rotate prod `ADMIN_SECRET` and give
   staging its own. Flagged to Mickey; not done (rotating a live secret needs
   coordinating the real prod scraper).
3. **Same diagnostic shortcut:** raw adapter count high while
   `/api/draw/bracket` is pure `seed_draw` ⇒ wrong-event data in cache ⇒ dump
   `scraper-fixtures` and read the dates/Final. Don't assume the prod scraper
   is the only writer — check every env's scraper.
4. This is the same *class* as the deleted orphan project (`pleasing-
   appreciation`, session 36) and the silent-Madrid-defaults incident
   ([[feedback_silent_scraper_defaults]]): a second/mis-targeted scraper
   writing the wrong thing. See [[project_staging_environment]].
