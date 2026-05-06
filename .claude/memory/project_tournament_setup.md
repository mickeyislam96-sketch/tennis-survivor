---
name: Tournament setup template
description: 16-step checklist for launching new tournaments. Covers config, seed draw, lock times, scraper name mapping, headshots, and common gotchas.
type: reference
originSessionId: bed0bd02-0917-4cd2-b3a7-51715be53d77
---
**Location:** `CTO - TS/New Tournament Setup Template.md` (user's workspace) AND `docs/new-tournament-setup.md` (in repo, pushed 20 Apr 2026).

**4 phases, 16 steps:**
1. Before draw (config, DB group, Railway env, FlashScore URL verification)
2. Draw released (seed draw JSON, drawAvailable flag, headshots, test scraper name matching)
3. Tournament starts (lock time overrides, scraper data check, monitoring)
4. Tournament complete (status flip, switch ACTIVE_TOURNAMENT, winner check)

**Files changed per tournament:** `activeTournament.js`, both `tournaments.js` (FE+BE), `seedDraws/{id}.json`, Railway env `ACTIVE_TOURNAMENT`, scraper Railway env vars (`FLASHSCORE_URL`, `RESULTS_URL`, `DEFAULT_ROUND`, `TIMEZONE_OFFSET`). Everything else is reusable.

**Common gotchas:** lock times not set (users pick after matches start), scraper name matching failures (FlashScore abbreviations don't match seed draw via normaliseName), stale ACTIVE_TOURNAMENT (needs Railway restart), qualifier name updates, draw size mismatch (96-draw has 128 positions), cross-tournament deadline contamination (global `/api/draw/deadlines` returns active tournament's schedule — upcoming pools must NOT use r1LockAt as entry gate).

**Automation tooling (added 5 May 2026 in session 35):**
- `scripts/validate-tournament.mjs <id>` — pre-push registry/seed-draw cross-check.
- `scripts/smoke.sh` — post-deploy smoke (health, pools, invite round-trip, frontend).
- `docs/transition-prompt.md` — paste-into-new-task prompt for free transitions.
- `docs/paid-transition-prompt.md` — superset for paid events (RG onwards).
- `.github/workflows/tests.yml` — CI runs smoke + integration on every push.

Use these before reaching for the manual checklist — they catch >90% of past launch issues automatically.

**Critical post-deploy verification (added 6 May, session 37):**
After updating scraper Railway env vars, you MUST verify two things or the bracket will silently show stale data from the previous tournament:

```
curl "$API/api/admin/scraper-fixtures?secret=$SECRET&round=R1" | jq .total
# expected: > 0

curl "$API/api/draw/bracket?round=R1" | jq -r .dataSource
# expected: seed_draw+scraper(N) with N > 0
# scraper(0) = scraping wrong tournament — fix FLASHSCORE_URL
```

`scripts/smoke.sh` step 1b runs this check automatically post-launch.

**Why:** 6 May 2026 incident — `FLASHSCORE_URL` and `RESULTS_URL` were *never set* on the Railway scraper service after Madrid → Rome transition. Hardcoded Madrid defaults in `scraper/src/config.mjs` kicked in. Scraper silently scraped Madrid for a week. Bracket returned `seed_draw+scraper(0)` because Madrid pairings could not be matched onto Rome's seed draw. PR #4 makes the scraper crash loudly on missing env vars going forward, but verification is still the safety net.

**Why (tooling):** Created 20 Apr to prevent the multi-session debugging that Madrid setup required. Should make Rome and Roland Garros launches significantly faster.
