---
name: Walkover winners require admin override (scraper cannot guess)
description: Walkovers and retirements where score lacks digits cannot have winner inferred from FlashScore output alone. Scraper must return null winnerId; admin records truth via TOURNAMENT.manualResultOverrides; daily walkover-pending check.
type: feedback
---

**Rule:** Never trust scraper output to assign a walkover or retirement winner.
For `status: 'walkover'`, the scraper now sends `winnerId: null` always. For
`status: 'retired'`, the scraper uses a score-leader heuristic but only when
there is a strict majority — ties return null.

**How to apply:**
- New tournament setup: initialise `TOURNAMENT.manualResultOverrides: []` in
  `backend/src/config/activeTournament.js`. Validator step 6 enforces shape.
- Every morning during a tournament: hit
  `GET /api/admin/walkover-pending?secret=$ADMIN_SECRET`. Count > 0 means
  one or more matches need a `manualResultOverrides` entry. The endpoint
  returns a `suggestedOverride` template you copy-paste, replace the placeholder
  winner with the actual one, push, redeploy.
- Override shape:
  ```js
  {
    round: 'R64',
    matchPlayers: ['Machac, Tomas', 'Medvedev, Daniil'],
    winner: 'Medvedev, Daniil',
    status: 'walkover',
    note: 'Machac withdrew before R64 — Medvedev advances.',
  }
  ```
- Application order: scraper data → seedDrawOverlay Step 1 (refuse to set
  winner from scraper for `walkover` + null winnerId) → Step 1.5 (apply
  manual overrides by normalised name match) → Step 1.6 (flag any unconfirmed
  walkover/retired as `requiresAdminReview: true`) → Step 2 (propagate winners
  to next round). An unconfirmed walkover does NOT propagate — the next
  round's slot stays null.
- Frontend: `DrawViewer.jsx` ListCard renders `Walkover · pending` (amber
  pill with inline style) when status is walkover/retired and winnerId is
  null. The `done` flag now requires winnerId for those statuses, so the
  match doesn't render with strikethrough or "lost" styling for either row.
- Validator step 6 (`scripts/validate-tournament.mjs`) checks: round in
  tournament rounds, matchPlayers length 2, winner equals one of matchPlayers,
  status in {walkover, retired, completed}, no duplicates per match.

**Why:** History — 2026-05-09 Rome R64 — Machac withdrew so Medvedev
advanced. The pre-fix scraper guessed walkover winner by player order
(`if (p1Sets >= p2Sets) winner = p1`); 0 vs 0 sets satisfied `>=` and
defaulted to player1 (Machac). Bracket showed Machac progressing into R32,
R32 picks pool excluded Medvedev, leaderboard contradicted /api/pools. No
member impact in Rome (nobody picked Medvedev or Machac), but at RG paid
scale this exact bug class would directly affect picks → refund risk.

**Regression test:** `backend/tests/smoke/walkover-override.test.js` (CI
green). Two cases: override flips winner correctly and propagates to next
round; unconfirmed walkover does NOT propagate. Mutates
`TOURNAMENT.manualResultOverrides` directly (`vi.mock` hoisting was
unreliable).

**Why this won't recur silently:** four prevention layers (scraper refusal +
overlay flagging + admin endpoint + validator) plus the regression test plus
BLOCKING Phase 8.5 in both transition prompts. The endpoint guarantees no
walkover can stay unresolved without showing up in the daily check.


## Optional: loserDisplayName for LL replacements at R64+

Override entries can include `loserDisplayName` to rewrite the loser
slot's display name. Use this when a seed-bye player withdrew, an LL
took their place, and the seed-draw JSON wasn't pre-emptively patched
(see `feedback_seeded_withdrawal_with_bye.md` for the pre-emptive
recipe). The bracket card then reads with the LL's name, not the
withdrawn seed's. Original is preserved on `target.player[12]OrigName`.

Example (Rome 2026 R64, 2026-05-10):

```js
{
  round: 'R64',
  matchPlayers: ['van de Zandschulp, Botic', 'Rinderknech, Arthur'],
  winner: 'van de Zandschulp, Botic',
  loserDisplayName: 'Kovacevic, Aleksandar (LL)',
  status: 'completed',
  note: 'Rinderknech withdrew before R64; Kovacevic in as Lucky Loser and lost.',
}
```

Implemented in `backend/src/services/seedDrawOverlay.js` Step 1.5
(override apply). Additive — only fires when the field is set, so
existing overrides without it behave unchanged.
**RG 2026 R64 walkovers (1 Jun 2026, session 42):** two unconfirmed walkovers
(`+REVIEW(2)`) — Tabilo/Vacherot and de Minaur/Blockx. Determined winners the
reliable way: the survivor appears in the NEXT round's fixtures (Tabilo played
R32 vs Kouame; de Minaur played R32 vs Mensik). Recorded both in
TOURNAMENT.manualResultOverrides (winners Tabilo, de Minaur). Confirming a
walkover winner by "who shows up in the next round" is the go-to when the
withdrawal isn't otherwise documented.
