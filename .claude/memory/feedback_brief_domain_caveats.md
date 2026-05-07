---
name: fsv-daily-brief — tennis + survivor-pool domain caveats
description: The brief skill must respect tennis match-status nuance and survivor-pool maths semantics. Two specific landmines from session 36 (7 May 2026) Mickey caught.
type: feedback
---

The morning brief skill produces high-quality findings most of the time, but it tripped twice on session 36 in ways that matter. Both lessons live here so the skill prompt can absorb them.

## Caveat 1 — partial scores are not always retirements

**Why:** On 2026-05-07 the scheduled brief flagged Fearnley d. Mpetshi Perricard (`0-0, 5-3, 0-0`) and Fucsovics vs Prizmic (`0-1, 4-6, 0-0, 0-0`) as "match retired". They were rain-suspended matches that resume later. In tennis this is common — the player ahead has not won, the match continues, and no winner should be declared.

**How to apply:** Before classifying a partial score as `retired`, the skill must consider that the match may be **suspended** (interrupted by weather, light, etc., resumes later) rather than abandoned. Always defer to the FlashScore explicit status tag — never infer status from score alone. If FlashScore shows the match as ongoing/scheduled/suspended, do not flag it as retired regardless of score.

The four real states to keep distinct in the brief:
- **Completed** — a player has won the required sets per match format. Honour the FlashScore "Finished" tag.
- **Suspended** — partial score, neither player has clinched, no FlashScore "Finished" tag. Status = scheduled/suspended. **No winner.** Will resume.
- **Retired** — one player abandons mid-match. FlashScore tags this distinctly.
- **Walkover** — abandonment before play. FlashScore tags this distinctly.

## Caveat 2 — survivor-pool denominator is (N-1), not N

**Why:** On 2026-05-07 the scheduled brief flagged "1/5 ELIMINATED · 20%" against a 6-member pool as a bug. I trusted that reading and "fixed" it to use total members (1/6 = 17%). Mickey corrected: the (n-1) denominator is the **correct** survivor-pool semantic.

In a survivor pool, N enter and N-1 will be eliminated, with 1 winner. The "field" being eliminated is therefore total - 1. When all N-1 in the field are gone, that's 100% and the last person standing has won. This makes 100% = "we have a winner", which is the right reading of the meter.

**How to apply:** Do not flag survivor-pool percentages where the denominator is (N-1) as inconsistent. The displayed total members count differing from the percentage's denominator by 1 is **expected** and correct. Only flag if the maths is wrong by other measures (e.g. eliminated count exceeds n-1, or the denominator is something other than n-1 or n).

## Meta-lesson

Mickey is the source of truth for tennis and survivor-pool domain. The brief should write findings as **observations** (what looks unusual), not **diagnoses** (what the bug is) when domain context could change the reading. Suggestions without confident causes are still useful — Mickey can validate or override before any code changes.
