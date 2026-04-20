---
name: Tournament setup template
description: 16-step checklist for launching new tournaments. Covers config, seed draw, lock times, Goalserve ID, headshots, and common gotchas. Reference doc in CTO - TS folder and pushed to repo.
type: reference
originSessionId: df7f237f-3f0c-49ed-a81f-5c2c4eac692f
---
**Location:** `CTO - TS/New Tournament Setup Template.md` (user's workspace) AND `docs/new-tournament-setup.md` (in repo, pushed 20 Apr 2026).

**4 phases, 16 steps:**
1. Before draw (config, DB group, Railway env, Goalserve ID)
2. Draw released (seed draw JSON, drawAvailable flag, headshots, test)
3. Tournament starts (lock time overrides, Goalserve data check, monitoring)
4. Tournament complete (status flip, switch ACTIVE_TOURNAMENT, winner check)

**Files changed per tournament:** `activeTournament.js`, both `tournaments.js` (FE+BE), `seedDraws/{id}.json`, Railway env `ACTIVE_TOURNAMENT`. Everything else is reusable.

**Common gotchas:** lock times not set (users pick after matches start), wrong Goalserve tournament ID (0 fixtures), stale ACTIVE_TOURNAMENT (needs Railway restart), qualifier name updates, draw size mismatch (96-draw has 128 positions).

**Why:** Created 20 Apr to prevent the multi-session debugging that Madrid setup required. Should make Rome and Roland Garros launches significantly faster.
