# Final Serve-ivor — CTO Agent Context

> Last updated: 20 March 2026. Keep this file updated at the end of every session.

---

## What the product is

**Final Serve-ivor** is a tennis survivor fantasy game. Players join groups, make picks on match results each round, and are eliminated if their pick loses. Last survivor wins. Built around major ATP/WTA draws — current live tournament is **Miami Open 2026** (launched 20 March 2026 as a practice tournament).

---

## Live URLs

| Service | URL |
|---|---|
| Frontend | https://tennis-survivor.vercel.app |
| Backend API | https://tennis-survivor-production.up.railway.app |
| Sofascore proxy (inactive) | https://sofascore-proxy.finalservivor.workers.dev |

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React, deployed on Vercel |
| Backend | Node.js / Express, deployed on Railway |
| Source control | GitHub — main branch auto-deploys to Railway |
| Primary data | API-Tennis (paid) — live fixtures and results |
| Secondary data | Sofascore (free) — currently 403-blocked on all cloud IPs |
| Fallback data | Hardcoded mock draw (has a known bug — see issues below) |
| Proxy | Cloudflare Workers (deployed but inactive — Sofascore blocks cloud IPs) |
| Storage | Railway volume (persistent — picks, group data) |

---

## Infrastructure reference

| Item | Value |
|---|---|
| Railway Project ID | `0ec066c7-c7e1-4abf-8897-3577208c64cd` |
| Railway Service ID | `df618c7b-3678-4595-aaf7-3ff2f0e86d72` |
| Railway Environment ID | `148fec0e-b919-423b-93d7-1487cdaa82d4` |
| Deploy region | europe-west4 (Netherlands) |
| Replicas | 1 |

---

## Key environment variables (Railway)

| Variable | Purpose |
|---|---|
| `TENNIS_API_KEY` | API-Tennis auth key — **critical, never remove** |
| `MIAMI_TOURNAMENT_KEY` | Tournament identifier for Miami Open |
| `SOFASCORE_BASE_URL` | Points to Cloudflare proxy — currently set to `https://sofascore-proxy.finalservivor.workers.dev` |
| `NODE_ENV` | Runtime environment |

WARNING: If TENNIS_API_KEY is missing, the draw silently falls back to broken mock data with no error shown. After changing any env var in Railway, you must manually trigger a container restart — Railway does not always auto-redeploy on variable changes. Use the Railway GraphQL API: mutation deploymentRestart(id) via browser session at backboard.railway.com/graphql/v2.

---

## Backend API endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/draw/bracket?round=F` | Full draw with rounds R1–F, player names, match status. Frontend always calls with ?round=F. |
| `GET /api/draw/debug` | Returns fixture counts by round, raw field list. Use to confirm API-Tennis is live. |

### Data fallback chain
fetchApiDraw() (API-Tennis) -> fetchSofascoreFixtures() (Sofascore, usually 403) -> getMiamiMockDraw() (mock, has bug)

---

## Key source files

| File | What it does |
|---|---|
| `backend/src/services/tennisData.js` | Core data logic — fetchApiDraw(), getDraw(), fallback chain |
| `backend/src/services/sofascoreAdapter.js` | Sofascore fetch — reads SOFASCORE_BASE_URL env var |
| `backend/src/data/miamiDraw.js` | Hardcoded mock draw — buildMiamiMatches() has a bug |
| `backend/src/routes/draw.js` | /bracket and /debug route handlers |
| `frontend/src/pages/DrawViewer.jsx` | Draw page — Bracket tab (Sofascore iframe) + By Round tab (API data) |

---

## API-Tennis data structure

Raw fixtures have these fields: event_key, event_date, event_first_player, event_second_player, event_winner, event_status, tournament_round, tournament_name.

Round label mapping from API-Tennis to app:
- "ATP Miami - 1/64-finals" = R1 (32 main draw matches between unseeded players)
- "ATP Miami - 1/32-finals" = R64 (32 matches, but only partially scheduled until R1 completes)
- "ATP Miami - 1/16-finals" = R32, etc.
- qualification: "True" = qualifying matches — filter these out for main draw

CRITICAL: Seeded players (top 32) have R1 byes — they do not appear in R1 fixtures. They only appear when their R64 fixture is scheduled. This means the R64 picks pool cannot be built from R64 fixtures alone — you must also include R1 winners from completed R1 matches.

---

## Known issues (open)

### 1. R64 picks pool — only 18 players showing (should be 60+)
Root cause: The picks pool is built only from the 9 currently-scheduled R64 fixtures (9 x 2 = 18 players). It is missing:
- 32 seeds who had R1 byes (they do not appear in R1 fixtures)
- R1 winners from completed matches that do not yet have a scheduled R64 opponent

Fix needed: Build the R64 eligible pool from: (a) R1 winners — status=Finished, take event_winner side, (b) seeds who appear in R64 fixtures but have no R1 match.

As of 20 March 2026: 23 of 32 R1 matches completed, 9 R64 fixtures scheduled, 17 fixtures with null round (likely other qual/doubles — needs investigation).

### 2. Bracket tab only shows R16 onwards
Root cause: The Sofascore iframe widget (widgets.sofascore.com/embed/unique-tournament/2430/season/80799/cuptree/10850024) is limited — it does not show R1/R64 in the embedded widget. The full bracket is visible on sofascore.com itself.

Fix needed: Either find an alternative Sofascore embed parameter that shows the full draw, or build a custom bracket visualisation using the API-Tennis data already in the backend.

### 3. Mock draw fallback bug
File: backend/src/data/miamiDraw.js, function buildMiamiMatches()
Bug: Uses prevWinners.slice(0, count * 2) which does not propagate winners — R32 through Final all repeat the same pairings.
Priority: Low while API-Tennis is live. Fix before next major tournament.

### 4. No health check for API key
No endpoint confirms TENNIS_API_KEY is present and valid. Silent fallback to broken mock data is the only signal of failure.

---

## Current tournament state (as of 20 March 2026)

- Tournament: ATP Miami Open 2026
- Stage: R1 in progress (23/32 R1 matches completed)
- Live fixture count: 94 total (58 main draw, 36 qualifying)
- Mode: Practice tournament — collecting feedback, no competitive stakes yet

---

## Session history summary

| Session | What was done |
|---|---|
| Prior session | Deployed Cloudflare Worker sofascore-proxy; updated sofascoreAdapter.js to use SOFASCORE_BASE_URL; added SOFASCORE_BASE_URL to Railway. Accidentally removed TENNIS_API_KEY during this work. |
| Session 20 Mar 2026 | Diagnosed broken draw (mock fallback due to missing key); restored TENNIS_API_KEY; triggered container restart via Railway GraphQL API; confirmed 88-94 live fixtures returning; identified R64 picks pool bug and bracket widget limitation; created this CLAUDE.md. |

---

## How to update this file

At the end of each session, update:
- Known issues — mark fixed issues, add new ones
- Current tournament state — stage, fixture count
- Session history — one line summary of what was done
