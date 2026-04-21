---
name: API replacement for Madrid
description: Goalserve for live data (130ms), Matchstat for intelligence (H2H, profiles, surface stats). Two-provider strategy. Free tier, top 200 players cached.
type: project
originSessionId: b42863f3-0280-4b74-8594-7beca144934c
---
## Goalserve Tennis API — Active Provider

**Status (20 Apr 2026):** Fully deployed and optimised. Goalserve is the sole active data provider for Madrid 2026+. API-Tennis removed from matchup modal (was returning empty data anyway). API-Tennis kept only as automatic fallback in the dataAdapter provider chain but effectively unused.

**Key config:** `GOALSERVE_API_KEY` and `TENNIS_DATA_PROVIDER=goalserve` set in Railway env vars. `goalserveTournamentId: '21256'` hardcoded in `activeTournament.js`.

**Performance (20 Apr 2026 — final state):**
- Goalserve cache TTL: 30 minutes (stale data acceptable, fast response is not)
- Draw-level cache: keyed on Goalserve cache timestamp, skips Levenshtein overlay recomputation
- Goalserve-only fetch: seed draw tournaments skip API-Tennis/Sofascore fallback chain entirely
- Empty result caching: when Goalserve returns 0 fixtures (tournament not started), cached as empty array instead of triggering re-fetch
- Promise-level deduplication: concurrent callers share one in-flight fetch
- **Result:** 130ms consistently (was 10-20s before this session's fixes)

**Root cause of 10-20s load times (fixed 20 Apr):** When Goalserve returned 0 valid fixtures, `fetchGoalserve()` returned null WITHOUT updating the cache. The truthy cache check meant every single request re-triggered 3 fresh HTTP calls to Goalserve (~3-4s each). Fix: cache empty results, check `!== null` instead of truthy.

**Matchup modal (rewritten 20 Apr):** No longer uses API-Tennis at all. Uses seed draw JSON (name, seed, country) + Goalserve fixture cache (tournament form). Zero external API calls, 139ms response. H2H data unavailable (Goalserve has no H2H endpoint).

**Goalserve limitations:**
- No H2H endpoint (head-to-head record between two players)
- No player search by name
- Player profiles exist but are behind gated docs (not yet tested)
- Rankings endpoint exists (not yet integrated)

**Architecture:** `dataAdapter.js` has unified interface. Provider chain: Goalserve → API-Tennis → Sofascore → mock. All output internal fixture format.

**Goalserve endpoints used:**
1. `/tennis_scores/{id}` — fixtures/results
2. `/tennis_scores/{id}-draw` — bracket structure
3. `/tennis_scores/home?cat={id}` — livescore

**Why replaced API-Tennis:** Failed repeatedly during Monte Carlo 2026 — empty responses, no reliable withdrawal detection. Now fully retired from the matchup modal too.

## Matchstat Tennis API — Intelligence Layer (LIVE 21 Apr 2026)

**Status (21 Apr 2026):** Fully deployed and active. `MATCHSTAT_API_KEY` set in Railway. Name cache covers top 200 ATP players.

**Purpose:** Supplements Goalserve (live operational data) with historical/statistical intelligence: H2H records, player profiles, surface stats, recent form. Goalserve has no H2H endpoint, so Matchstat fills this gap.

**Provider:** Matchstat Tennis API on RapidAPI (`tennis-api-atp-wta-itf.p.rapidapi.com`).

**Key files:**
- `backend/src/services/matchstatAdapter.js` — all API interactions, name→ID cache, parallel fetching
- `backend/src/routes/matchup.js` — combines seed draw + Goalserve + Matchstat into unified response
- `frontend/src/components/MatchupModal.jsx` — tabbed UI (Form / H2H / Profile)
- `frontend/src/components/MatchupModal.css` — full design system styling

**Architecture:**
- Name→ID cache built from rankings endpoint (24hr TTL). Matchstat uses its own numeric IDs.
- Pagination: `pageSize=100` across 2 pages to cover top 200 players (was default 10, returning only 11).
- Fuzzy surname matching fallback when exact name not in cache.
- `getMatchupIntelligence()` fires 8 parallel requests (H2H info, H2H matches, 2x profile, 2x form, 2x surface).
- 30-min data cache for all Matchstat responses.
- Graceful degradation: if key not set or any call fails, matchup modal shows seed draw + Goalserve data only.

**Free tier (current):** 500 req/month. Cache rebuild = 2 calls/day (~60/month). Remaining ~440 = ~55 unique matchup lookups. Sufficient for Madrid (~10 users). Quota resets monthly on RapidAPI billing cycle.

**Upgrade plan:** Free tier for Madrid. If it works well, upgrade to Pro ($10/mo, 10K req/month) for Rome onwards.

**Env var:** `MATCHSTAT_API_KEY` — RapidAPI key. Set in Railway 21 Apr.
