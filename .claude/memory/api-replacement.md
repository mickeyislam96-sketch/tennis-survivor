---
name: API replacement for Madrid
description: Goalserve tennis API replaces API-Tennis for all data needs. 30-min Goalserve cache, draw-level cache, 130ms responses. API-Tennis fully retired from matchup modal.
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
