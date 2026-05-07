---
name: fsv-daily-brief skill — Mickey's morning ritual
description: Skill at `.claude/skills/fsv-daily-brief/SKILL.md` produces a daily Tech/Design/CX brief saved to `CTO - TS/briefs/YYYY-MM-DD.md`. Mickey reviews, marks approvals, executors run.
type: reference
---

## What this skill does

Lives at `.claude/skills/fsv-daily-brief/SKILL.md`. When Mickey says "morning brief", "daily brief", "what should I focus on today", or "fsv brief":

1. Surveys the project state (git activity, prod/staging health, scraper freshness, leaderboard, CI runs, pending emails, critical-gaps progress).
2. Generates a unified brief with three persona sections: Tech, Design, CX.
3. Each suggestion has: title, what, why-now (must cite Phase 1 evidence), effort (XS/S/M/L), blast radius (Low/Med/High), files touched.
4. Cross-cutting risks section flags overlap and assesses RG launch risk.
5. Saves to `CTO - TS/briefs/YYYY-MM-DD.md` and includes a `computer://` link in chat.

## Hard rules

- Suggestions only — NEVER edits code, NEVER pushes, NEVER touches Railway or Vercel.
- Every suggestion must cite specific evidence. No generic best-practice padding.
- If a persona has nothing real to flag, write one line and move on. Don't pad.

## Approval flow (designed, executors not yet built)

Mickey marks `[ ]` → `[x]` next to items in the brief. Then runs `/cx-build`, `/design-build`, or `/tech-build` (executors planned for next session). Executors will only operate on staging branch and open PRs for Mickey to review.

## Why this exists

Mickey is a solo non-technical founder. The skill scales his bandwidth into three reviewer roles, while keeping the human approval gate. Tested for the first time on 7 May 2026 — generated `CTO - TS/briefs/2026-05-07.md` with 5 tech items, 0 design items, 3 CX items, and a Medium launch risk for RG.
