---
name: Roland Garros 2026 + Grand Slam modelling
description: How the first Grand Slam (128-draw) was set up. Model a Slam's first round as "R1" NOT "R128" (pick/lock code + roundLabels hardcode "R1"). Reusable for Wimbledon/US Open.
type: project
---
**Roland Garros 2026 activated 22 May 2026 (free).** First Grand Slam this codebase has run (prior events were Masters 1000).

**Key modelling lesson (reuse for any Slam):**
- Playbook says use `rounds: ["R128","R64",...]` — WRONG for this code. `roundLabels.js` has no "R128" label; `picks.js`/`tennisData.js` hardcode `round === 'R1'` as the first round. "R128" breaks frontend labels + pick logic.
- Correct: `rounds: ["R1","R64","R32","R16","QF","SF","F"]`, `drawSize:128`, `seedsWithByes:0`, `matchesPerRound:{R1:64,R64:32,...}`. "R1" renders "First Round" (128 players). `seedDrawLoader.js` already supports a 128-draw no-byes Slam and uses `rounds[0]`. Validator warns "32 seeds, expected 0" — EXPECTED for a Slam, not a failure.

**RG specifics:** pool `20440c2f-...`, invite `ROLAND-GARROS-2026-P-H294FQ`, free, admin = "Mick" `238ae01e-...`. R1 fixed deadline `2026-05-24T08:00:00Z`. Seed draw `seedDraws/roland-garros-2026.json` (32 seeds, 17 "Qualifier N" placeholders; Alcaraz withdrew). Names ASCII "Surname, Firstname"; Chinese names surname-first (Wu Yibing->"Wu, Yibing", Zhang Zhizhen->"Zhang, Zhizhen"). Scraper slug `french-open`, TIMEZONE_OFFSET=2.

**Git remote gotcha (22 May):** `git remote set-url` glued the new token AFTER `.git` (malformed URL, failed auth). When a push token "doesn't work", check the remote URL structure, not just the token.
