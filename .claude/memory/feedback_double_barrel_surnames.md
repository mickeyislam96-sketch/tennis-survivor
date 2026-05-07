---
name: Double-barrel surnames break strict surname-subset matching
description: seedDrawOverlay's surnameSubsetMatch was strict-subset only. When scraper and seed disagree on which half of a double-barrel surname is recorded (Merida vs Merida Aguilar), the match silently dropped. Fixed in PR #10 with Pass 3b shared-token fallback. Always store full name in seed draw to avoid relying on the looser fallback.
type: feedback
---

# Double-barrel surnames need full-name storage in seed draw

`seedDrawOverlay.js > findFixtureMatch()` runs three passes against scraper fixtures: exact normalised, Levenshtein > 0.85, and surname-subset. The subset pass strict-subsets one side's parts against the other.

**Bug, 7 May 2026 (Rome R1):** Basilashvili vs Merida wouldn't settle. Seed draw had `Merida, Daniel` (parts `["merida","daniel"]`); FlashScore had `Merida Aguilar D.` (parts `["merida","aguilar"]`). Each side has 2 tokens but neither is a strict subset → all three passes failed → bracket showed match as `scheduled` even though Basilashvili won. PR #10 added Pass 3b (shared-token overlap) as a fallback.

**How to apply:**

- **Always store the full surname in seed draw.** When the player's full surname is a double-barrel ("Carreno Busta", "Davidovich Fokina", "Mpetshi Perricard", "Merida Aguilar"), record it that way in `drawPositions[].name`. Existing convention is `"Surname, Firstname"`. For double-barrel, that means `"Merida Aguilar, Daniel"` not `"Merida, Daniel"`.
- The Pass 3b shared-token fallback now exists as a safety net but should not be relied on. Its safety comes from the both-sides-must-match structural constraint — the round filter + 2-of-2 confidence keeps false positives away. Tests in `backend/tests/smoke/overlay-surname-match.test.js` cover both the match case and the over-match guard.
- When importing a new tournament's draw from ATP / FlashScore, double-check Spanish, Hispanic, and French players whose ATP profile shows a multi-word surname. Common heuristic: if FlashScore abbreviates the player as `"<Surname1> <Surname2> <Initial>."` (two pre-initial words), put both in the seed draw.
- The scraper post-pass already has tolerance for `Carreno-Busta P.` style hyphenated double-barrels because `surnameParts()` splits on hyphens. The bug class is specifically when the seed has only one half.

Reference incident: PR #10. Files touched: `backend/src/data/seedDraws/rome-2026.json` (data fix for Merida Aguilar), `backend/src/services/seedDrawOverlay.js` (Pass 3b structural fix), `backend/tests/smoke/overlay-surname-match.test.js` (regression test).
