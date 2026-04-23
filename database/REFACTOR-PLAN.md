# Post-Tournament Refactor Plan

> Ship after Monte Carlo 2026 ends (13 Apr 2026 or later).
> Do NOT merge during a live tournament.

## Problem

The mock draw file (`monteCarloMockDraw.js`) serves two roles that conflict:

1. **Structural reference** -- bracket layout, player list, seeding, match pairings. This is static and correct from the moment the draw is released.
2. **Live state container** -- `getDraw()` in `tennisData.js` mutates the mock draw object in-place: overlaying API results, propagating winners into next-round slots, clearing `roundEliminated`, resetting fake completions. Every call to `getDraw()` rebuilds this state from scratch.

This coupling caused issues #13 (fake R1 completions), #14 (pick pool tied to bracket slots), and multiple incidents where bracket display changes broke the pick pool or vice versa.

## Goal

Separate the static draw structure from the live match state so that:

- Changing how the bracket displays never affects the pick pool
- Changing how the pick pool filters never affects the bracket
- The mock draw is read once at startup and never mutated
- Live state is built fresh on each request from API data + static structure

## Architecture (proposed)

### Layer 1: Static Draw (`staticDraw.js`)

A pure data file per tournament. No functions, no mutations. Exports:

- `PLAYERS` -- array of `{ id, name, seed, country }`. Immutable reference list.
- `MATCHES` -- array of `{ id, round, matchOrder, player1Id, player2Id, bye }`. Bracket structure only. No status, no winners, no scores.
- `API_KEY_MAP` -- mock ID to API-Tennis key mapping.
- `R32_BRACKET` -- feeder structure (already exists, just move it here).

This replaces `monteCarloMockDraw.js`. The `getMonteCarlMockDraw()` function and its Step 1/2/3 logic (fake completions, winner propagation) are deleted entirely.

### Layer 2: Live State Builder (`liveState.js`)

A pure function: `buildLiveState(staticDraw, apiFixtures, manualResults) => LiveDraw`.

Responsibilities:
- Match API fixtures to static draw entries (by API key, then by surname)
- Compute match status, winners, scores from API data
- Apply manual result overrides
- Propagate winners into next-round bracket slots (for display only)
- Compute `roundEliminated` per player from completed matches
- Return a new object every time (never mutate inputs)

The returned `LiveDraw` has the same shape as today's draw object, so frontend code doesn't change.

### Layer 3: Pick Pool (`pickPool.js`)

Currently embedded in `picks.js` route handler. Extract to its own module.

Input: `PLAYERS` (static) + `eliminatedPlayerIds` (from live state).
Output: list of available players for a given round.

Rules (unchanged from current):
- R1: only players in R1 non-bye matches
- R32+: all non-eliminated, non-qualifier players

**Critical constraint preserved:** the pick pool has NO dependency on bracket slot data. It only needs the static player list and a set of eliminated IDs.

### Layer 4: Bracket Display

`getDraw()` returns the full `LiveDraw` (with bracket slots, propagated winners, scores). The frontend renders this. Changes here are cosmetic only and cannot affect the pick pool.

## Migration steps

1. Create `backend/src/data/staticDraws/monte-carlo-2026.js` with just PLAYERS, MATCHES, API_KEY_MAP, R32_BRACKET. No functions.
2. Create `backend/src/services/liveState.js` with `buildLiveState()`. Port the overlay + propagation logic from `getDraw()` in `tennisData.js`.
3. Create `backend/src/services/pickPool.js`. Extract `getAvailablePlayers()` logic from `picks.js`.
4. Update `tennisData.js` `getDraw()` to call `buildLiveState()` instead of mutating the mock draw.
5. Update `picks.js` to call the new `pickPool.js`.
6. Delete `monteCarloMockDraw.js` and `mockDraw.js` dispatcher.
7. Add integration tests: given a set of static players + fake API fixtures, verify pick pool output and bracket output are independent.

## What stays the same

- Frontend code (no API shape changes)
- `resultsProcessor.js` (uses `getLiveDraw()` which will call the new builder)
- `sofascoreAdapter.js` (unchanged)
- Tournament config files (unchanged)
- Pick submission logic (unchanged)
- Leaderboard logic (unchanged)

## Risk mitigation

- Write the new modules alongside the old ones. Flip a feature flag (`USE_NEW_DRAW_BUILDER=true`) to switch.
- Run both old and new in parallel for one tournament cycle, comparing outputs.
- Only remove the old code after verifying the new path works in production.

## Estimated effort

3-4 hours of focused work. One session should cover it.

## For the next tournament

When creating a new tournament, the work is:
1. Create a new static draw file in `staticDraws/`
2. Add a tournament config in `config/tournaments/`
3. Set `ACTIVE_TOURNAMENT` env var

No other code changes needed. The bracket structure, overlay logic, and pick pool all work generically.
