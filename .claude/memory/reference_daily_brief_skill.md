---
name: fsv-daily-brief skill — Mickey's morning ritual
description: Skill at `.claude/skills/fsv-daily-brief/SKILL.md` produces a daily Tech/Design/CX brief plus data-integrity and visual-check phases. Saves to `CTO - TS/briefs/YYYY-MM-DD.md`. Runs daily at 12:00 BST via Cowork scheduled task.
type: reference
---

## What this skill does

Lives at `.claude/skills/fsv-daily-brief/SKILL.md`. Triggered by chat phrases ("morning brief", "daily brief", "what should I focus on today", "fsv brief") OR by the Cowork scheduled task at 12:00 BST daily.

Five phases:

1. **Phase 1a — State survey.** Git activity, prod/staging /api/health, recent CI runs, scraper freshness, pending email queue, critical-gaps progress.
2. **Phase 1b — Data integrity check (mandatory).** Trace scraper → bracket → leaderboard. For every completed match, verify winnerId set and propagated to next round; for every leaderboard member, verify alive/eliminated state matches their pick versus the bracket. Cross-checks: member counts balance, no `isAlive=true` with `eliminatingPick`, scraper freshness vs active hours, no stale data from previous tournament.
3. **Phase 1c — Frontend visual check (mandatory if Chrome MCP available).** Screenshots of finalserveivor.com homepage, group home, leaderboard, draw bracket view, draw list view, matchup modal. Flags rendering issues, copy contradictions, broken images.
4. **Phase 2 — Tech/Design/CX suggestions.** Each item has title, what, why-now (must cite Phase 1 evidence), effort (XS/S/M/L), blast radius (Low/Med/High).
5. **Phase 3 — Cross-cutting risks + RG launch-risk assessment.**

Output: `CTO - TS/briefs/YYYY-MM-DD.md`, plus a two-sentence summary in chat with a `computer://` link.

## Hard rules

- Suggestions only — NEVER edits code, pushes, or touches Railway/Vercel.
- Every suggestion must cite specific Phase 1 evidence. No generic best-practice padding.
- If a persona has nothing real to flag, write one line and move on.
- Domain caveats apply (see `feedback_brief_domain_caveats.md`): suspended ≠ retired, (n-1) is correct survivor-pool denominator.

## Schedule

Daily at 12:00 BST local time (cron `0 12 * * *`). Cowork applies a few-minute deterministic delay, so actual fire is around 12:04. Mickey's machine must be on and Cowork running for the scheduled task to fire — if asleep, the brief skips that day.

## Approval flow (executor skills planned for next session)

Mickey marks `[ ]` → `[x]` next to brief items. Executor skills (`cx-build`, `design-build`, `tech-build`) read approved items and operate only on the `staging` branch, opening PRs for Mickey to review. Manual review still gates everything that reaches main.

## Track record (session 36)

- First scheduled run on 2026-05-07 caught three real bugs I had missed in manual passes (the cacheAge silent freshness lie, the closing-soon banner contradiction, the matchup modal contradiction). Two were shipped same-day; the matchup-modal one needs deeper diagnosis.
- It also misdiagnosed twice in ways Mickey caught: a rain-suspended match read as retired, and a correctly-implemented (n-1) survivometer read as a denominator bug. Caveats now baked into the skill memory.
