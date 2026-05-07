---
name: Seeded-player withdrawal with bye → manual seed-draw update
description: When a seeded player with a bye withdraws and an LL replaces them, seedDrawOverlay's auto-replacement does not fire (it only handles R1). Update the seed-draw JSON manually; player ID convention shifts from rome-sN (seed-based) to rome-pPos (position-based).
type: feedback
---

# Seeded-player withdrawal (with bye) — manual seed-draw update required

`seedDrawOverlay.js` has an auto-replacement pre-pass that detects withdrawals and swaps in lucky losers — but it ONLY runs against `seedDraw.rounds[0]` (R1). For seeded players with byes, the withdrawal happens at R64 (their first match), and the auto-detection cannot fire because:

- Cancelled fixture lookup is keyed off R1 surname matching.
- The R64 fixture against the seeded player's R1-winner opponent doesn't exist in scraper data until FlashScore creates it.

So if a seed (e.g. Vacherot at Rome 2026, seed #14, pos 48) withdraws, you must update `backend/src/data/seedDraws/<tournament>.json` manually:

1. Find the `drawPositions` entry for the withdrawn player's pos.
2. Replace `name`, set `seed: null`, update `country`, add `isLuckyLoser: true` and `replaces: "<original name>"` for the audit trail.
3. Annotate `seeds["<seed-num>"]` with `withdrawn: true` + `replacedBy: "<LL name> (LL, pos <N>)"` — keeps the audit trail in the file.

**Why:** ATP rule — LL inherits the bracket slot but **not** the seed. So the player ID convention also flips:
- Old (seed-based): `${prefix}-s${seed_number}`  e.g. `rome-s14`
- New (position-based): `${prefix}-p${pos}`     e.g. `rome-p48`

This is correct behaviour because `seedDrawLoader.js` derives IDs from each `drawPosition` record's seed/non-seed status. Old rome-s14 picks are orphaned by definition, but if no picks have been made yet (R64 picks not open), there are no DB rows to migrate.

**How to apply:**
1. Make the JSON change in a feature branch (per working agreement).
2. Call `POST /api/admin/withdrawal` with the OLD player ID (`rome-s14`) and round (R64). Returns "No active picks found" if the round is not open yet, or a count + list of unlocked picks otherwise. Either way, audit log records the action.
3. Run `node scripts/validate-tournament.mjs <id>` — the seed count check has a built-in tolerance for "more seeds than seedsWithByes" (LL replacements legitimately push the count up).
4. Open PR. Mickey reviews + merges.
5. Backend redeploys, bracket pulls fresh seed draw on next request.
6. When the LL's R64 fixture appears in scraper data ("Landaluce M. vs Cilic M."), the surname overlay matches it onto the seed draw R64 slot via subset matching ("landaluce" ⊂ ["landaluce","martin"]). No further intervention needed.

**Reference incident:** Vacherot (seed 14) → Landaluce (LL) at Rome 2026, 6 May 2026. PR #7. Result-tracking confirmed working post-merge: bracket shows `Landaluce, Martin (rome-p48)` in R64 vs Cilic (placeholder for R1 winner); R64 surname overlay primed for when FlashScore creates the fixture.
