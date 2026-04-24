---
name: Tournament setup template
description: 16-step checklist for launching new tournaments. Covers config, seed draw, lock times, scraper name mapping, headshots, and common gotchas.
type: reference
---
**Location:** `CTO - TS/New Tournament Setup Template.md` (user's workspace) AND `docs/new-tournament-setup.md` (in repo, pushed 20 Apr 2026).

**4 phases, 16 steps:**
1. Before draw (config, DB group, Railway env, FlashScore URL verification)
2. Draw released (seed draw JSON, drawAvailable flag, scraper name mapping, headshots, test)
3. Tournament starts (lock time overrides, scraper data check, monitoring)
4. Tournament complete (status flip, switch ACTIVE_TOURNAMENT, winner check)

**Files changed per tournament:** `activeTournament.js`, both `tournaments.js` (FE+BE), `seedDraws/{id}.json`, Railway env `ACTIVE_TOURNAMENT`, scraper scheduled task name mapping. Everything else is reusable.

**Common gotchas:** lock times not set (users pick after matches start), scraper name mapping missing new players (FlashScore abbreviations don't match seed draw), stale ACTIVE_TOURNAMENT (needs Railway restart), qualifier name updates, draw size mismatch (96-draw has 128 positions), cross-tournament deadline contamination (global `/api/draw/deadlines` returns active tournament's schedule — upcoming pools must NOT use r1LockAt as entry gate).

**Why:** Created 20 Apr to prevent the multi-session debugging that Madrid setup required. Should make Rome and Roland Garros launches significantly faster.
