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


## Reactive option: loserDisplayName on manualResultOverride

If the withdrawal slips through the pre-emptive check above (e.g. it
happens between R1 picks closing and R64 starting, or simply isn't
caught in time and the bracket is already serving wrong data), there's
a smaller-blast-radius fix that doesn't touch the seed-draw JSON:
add a `manualResultOverride` with the optional `loserDisplayName` field.

```js
{
  round: 'R64',
  matchPlayers: ['Opponent, X', 'Withdrew, Y'],     // SEED-DRAW slot names — stable
  winner: 'Opponent, X',
  loserDisplayName: 'LuckyLoser, Z (LL)',           // displayed loser name
  status: 'completed',                               // they actually played
  note: 'Withdrew, Y withdrew; LuckyLoser replaced and lost. <date>.',
}
```

`matchPlayers` keeps the seed-draw slot names (so the override matcher
remains stable). `loserDisplayName` rewrites only the loser slot's name
in the bracket card. Original is preserved on `target.player[12]OrigName`
for audit. Propagation to the next round uses the winner side, which is
unchanged.

**When to choose which:**

| Detected when | Use |
|---|---|
| Before R1 picks open | Edit seed draw JSON (Vacherot/Landaluce recipe above). Auto-replacement handles the rest. |
| After R1 picks close, before user picks involve the affected slot | Same — JSON edit. |
| Live tournament, bracket already showing wrong data, time-critical | manualResultOverride + loserDisplayName. Doesn't touch picks or seed draw. |
| Walkover with no LL replacement | Standard manualResultOverride (no loserDisplayName needed). |

**Reference incident:** Rinderknech (seed) withdrew → Kovacevic (LL) →
lost to van de Zandschulp. Rome 2026 R64, 2026-05-10. seedDraw JSON
left untouched; manualResultOverride with loserDisplayName recorded the
result. Bracket card now reads "van de Zandschulp d. Kovacevic, A. (LL)".
PR #21. Auto-resolved a downstream Khachanov R32 fixture that was
sitting unmatched (Khachanov had played and won 11:10 UTC; the slot just
needed an opponent name to attach the scraper fixture).
---

**Related (2 Jun 2026):** the same auto-replacement gap also bites **R1**
pre-tournament withdrawals in no-bye Grand Slam draws — the replacement LL has
no cancelled fixture either, so the R1 match never resolves and the gap
cascades up the bracket. See [[feedback_overlay_propagation_cascade]] for the
RG case (Fils→De Jong seed edit + van Assche/Wu/Cobolli overrides) and the
diagnosis/fix recipe.
