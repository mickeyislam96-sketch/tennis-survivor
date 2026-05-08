---
name: Tournament transition prompts hardened against today's two bug classes
description: After 2026-05-08 brief, transition prompts + smoke + brief skill all updated to catch stale R64 startTimes and Homepage Enter-CTA-when-closed.
type: feedback
---

The 2026-05-08 morning brief flagged two distinct bug classes that
nearly went into Roland Garros (paid):

1. **Stale R64 startTimes** (root cause in `scraper/src/scrape.mjs` →
   fixed in PR #11/#14, defence-in-depth in `seedDrawOverlay.js`).
2. **Homepage Enter CTA on closed pool** (root cause: two FE surfaces
   computed `entryOpen` differently → fixed in PR #12 by surfacing
   `entryOpen` from `/api/pools`).

Both are now wired into the regression-prevention layers so they can't
recur silently:

## What changed

### `scripts/smoke.sh` (PR #19, 8 May 2026)

New steps **3c** and **3d**:
- **3c:** asserts every pool returned by `/api/pools` has `entryOpen`
  populated. Catches removal of the field. Also flags any
  `status: completed` pool that doesn't have `entryOpen: false`.
- **3d:** queries `/api/draw/bracket?round=F` and asserts no
  `status: scheduled` match has a `startTime` >6h in the past. Catches
  the overlay sanity check regressing.

Both run on every push via the existing CI/post-deploy workflow.

### `docs/transition-prompt.md` (free) — Phase 8

Two new subsections:
- **8e:** Bracket startTimes match the tournament day (BLOCKING after
  R1). Same bracket query as smoke 3d, with explicit instruction to
  block the announce if anything fails.
- **8f:** Homepage CTA matches `/api/pools` `entryOpen` (BLOCKING).
  Both API check and visual check.

### `docs/paid-transition-prompt.md` — Phase 8

Same checks, renumbered as **8g** and **8h** (paid prompt already had
8e/8f for orphan picks and FE deadline). Same logic, but the
explanatory copy notes the higher stakes on a paid event (paid user
bouncing off R1 lock, picks made on wrong assumption about match
times).

### `.claude/skills/fsv-daily-brief/SKILL.md`

Phase 1b extended to **6** and **7**:
- **6.** startTime sanity (look for stale times on scheduled matches).
- **7.** `/api/pools` `entryOpen` consistency (cross-check vs.
  tournament status + R1 lock).

Phase 1c step 1 extended: hero eyebrow + entry CTA must match the
backend's `entryOpen`. Step 4 extended: bracket date plausibility.

## Why this is the right shape

- **Belt and braces.** The bug is fixed in code; the smoke check
  catches recurrence on every push; the transition prompts catch any
  variant on every new tournament; the brief skill catches it daily.
- **Each layer's failure mode is different.** Code can regress, smoke
  can be skipped, the prompt can be rushed, the brief can miss a
  visual cue. Four layers means at least one fires.
- **Same pattern as the 6 May silent-Madrid-scraper regression**
  (closed via `feedback_silent_scraper_defaults.md`) — bug → code fix
  → smoke step → prompt step → brief check. Ship it once, never see
  it again.

## How to apply when a new bug class lands

1. Code fix lands in the right architectural location (PR cycle).
2. Add a smoke step in `scripts/smoke.sh` that asserts the contract.
3. Add a Phase 8 subsection in BOTH transition prompts.
4. Add a check to the brief skill's Phase 1b or 1c.
5. Write a memory file (this one) documenting the rollout.
