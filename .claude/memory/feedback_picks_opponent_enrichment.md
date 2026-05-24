---
name: Picks opponent enrichment must cover all rounds
description: backend/src/routes/picks.js has separate code paths for R1 (per-match-lock and round-lock) vs R2+. Each path must build opponentMap and return opponentName/opponentPossible — otherwise the pick screen renders names with no `vs <opponent>` sub-line.
type: feedback
---

# Picks opponent enrichment — every round path must populate it

`backend/src/routes/picks.js > getAvailablePlayers()` has multiple code paths:

1. R1 with per-match lock (TOURNAMENT.r1PerMatchLock) — enriches via the live fixtures
2. R1 with round-level lock — enriches via the seed-draw R1 matches
3. R2+ standard path (R64, R32, R16, QF, SF, F)

For 7 weeks (since R1 per-match-lock landed 13 Apr 2026) only paths 1 and 2 enriched players with `opponentName` / `matchStartTime` / `matchStatus`. The R2+ path returned the player pool without ever building an opponentMap. Effect: as soon as a tournament moved past R1, the pick screen showed names + Pick button with no "vs <opponent>" sub-line. Mickey caught it on the Rome 2026 R64 screen on 7 May 2026 (PR #8 fixed it).

**Why:** opponent enrichment was added to R1 first because of the per-match-lock work, and the R2+ branch was never updated in lockstep. There was no test asserting opponentName/opponentPossible was populated for any round. The frontend silently renders nothing when both fields are null, so the bug was visually invisible to anyone who didn't know to look for the sub-line.

**How to apply:**

- Anyone touching `picks.js > getAvailablePlayers()` must verify opponent fields are populated for ALL round paths, including the fallback path.
- For R64+ (where one slot may be a still-pending R1 winner), build candidates via the prev-round feeder match: if feeder has a winner, single candidate; if not, both feeder players are candidates → `opponentPossible: [A, B]`.
- The frontend `PickScreen.jsx` renders `opponentName` (solid) → `opponentPossible.join(' or ')` (italic) → nothing. Never silently rely on the third state.
- New tests guard this regression class:
  - `backend/tests/smoke/picks-and-deadlines.test.js` — asserts ≥95% of players in the open round have either field populated.
  - `scripts/smoke.sh` step 3b — same check, runs in CI and post-launch.
  - Both transition prompts now have a manual visual check in Phase 6 (incognito pick screen, every row must show `vs ...`).

Reference incident: PR #8 / commit `a80cd584`. Bug was invisible from the start of every tournament because R2+ rounds didn't open until R1 closed, but it would have been visible at the start of every round transition since 13 Apr.
