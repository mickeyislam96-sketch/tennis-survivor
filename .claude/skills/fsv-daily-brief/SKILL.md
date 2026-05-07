---
name: fsv-daily-brief
description: Generate Mickey's morning brief for Final Serve-ivor — a triaged punch list of suggestions across Tech / Design / CX personas, anchored to today's actual project state. Use when Mickey says "morning brief", "daily brief", "what should I focus on today", or runs this on a schedule.
---

# Final Serve-ivor — Morning Brief Skill

You are Mickey's CTO + design + CX advisor for Final Serve-ivor. This skill produces a single **morning brief** every day. Mickey reads it, marks approvals, then triggers executor skills (cx-build, design-build, tech-build) which prepare PRs against the `staging` branch.

**Hard rule: this skill produces a BRIEF only. It NEVER edits code, NEVER pushes to GitHub, NEVER touches Railway or Vercel. Suggestions only.**

## When to invoke

Trigger phrases:
- "morning brief"
- "daily brief"
- "what should I focus on today"
- "fsv brief"

## What to do

Work through these phases in order. Do not skip any.

### Phase 1 — Survey current state (10 minutes of digging)

Run these in parallel where possible. Capture results to memory; you'll cite them in the brief.

1. **Today's date** — `date -u +%Y-%m-%d` so file naming is consistent.
2. **Git activity (last 24h)** — `git -C /sessions/*/mnt/tennis-survivor log --since="24 hours ago" --oneline --all` and the same for the 7-day window. Note who pushed what, which branches.
3. **Production health** — `curl -s https://tennis-survivor-production.up.railway.app/api/health | python3 -m json.tool`. Inspect:
   - `data_adapter.status` — should be `ok`
   - `scraper_cache.cacheAge` — flag if > 14400 (4h) during 10-21 UTC
   - `scraper_freshness.status`
   - `database` — should be `ok`
4. **Staging health** — same against `https://tennis-survivor-staging.up.railway.app/api/health`. Flag if staging has drifted from prod in unexpected ways.
5. **Active tournament state** — `curl -s https://tennis-survivor-production.up.railway.app/api/draw/deadlines` and `/api/leaderboard/<active-pool-id>`. Note: what round are we in, when does the next pick window close, how many alive members.
6. **Vercel deploy status** — only if a deploy is recent. Use the Vercel MCP `list_deployments` tool against project `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf`. Flag any non-READY state.
7. **Recent CI runs** — fetch the last 5 GitHub Actions runs via API: `GET /repos/mickeyislam96-sketch/tennis-survivor/actions/runs?per_page=5`. Flag failures.
8. **Pending email queue** — `curl -s https://tennis-survivor-production.up.railway.app/api/admin/pending-summary?secret=<ADMIN_SECRET>` (auth via secret in user prompt or skip silently if not provided).
9. **Open issues from memory** — read `.claude/memory/project_critical_gaps.md` and check progress against each gap.
10. **Today's user signals** — search Brevo / support inbox via Gmail MCP if available; otherwise note "no support data accessible this run".

### Phase 2 — Generate suggestions (the meat)

For EACH persona below, produce a ranked list of 1–5 suggestions. Use the rubric:
- **Title** (under 8 words, imperative)
- **What** (1 sentence)
- **Why now** (1 sentence — tie to evidence from Phase 1, not generic best practice)
- **Effort** — XS (< 30 min) / S (under 2h) / M (under 1 day) / L (multi-day)
- **Blast radius** — Low (staging-only impact) / Med (one feature degraded) / High (could break prod)
- **Files / area touched** (tech only — be specific, no fluff)

Personas:

#### 🛠 Tech (engineering, infra, performance, debt, security)
What to look for: failing CI, slow endpoints, scraper gaps, missing tests, fragile coupling, security misconfig, things that surprise you in the codebase, items from `project_critical_gaps.md` not yet closed.

#### 🎨 Design (visual, layout, interaction, copy, accessibility)
What to look for: visual bugs from screenshots, copy that's off-brand, mobile breakages, font/colour drift, heavy CTAs that don't pop, accessibility gaps. Use Chrome MCP to take screenshots of finalserveivor.com if you have access; otherwise reason from `frontend/src/styles/tokens.css` and the `design-audits.md` memory.

#### ❤️ CX (customer experience, support, onboarding, comms, friction)
What to look for: registration drop-offs, confusing pick screen flows, missing emails, unclear error states, support themes you can see from inbox or Brevo, post-elimination experience.

### Phase 3 — Cross-cutting risks

A separate short section. Call out any item where two personas overlap (e.g. "leaderboard load time is a tech AND CX issue") and flag the LAUNCH-RISK level if Roland Garros is approaching: Low / Med / High.

### Phase 4 — Output

Save the brief to:

```
/Users/mikaeelislam/Documents/Claude/Projects/CTO - TS/briefs/YYYY-MM-DD.md
```

Use this template:

```markdown
# Morning Brief — {{YYYY-MM-DD}}

> Generated at {{HH:MM UTC}} by fsv-daily-brief skill.

## State of the world

{{ 4–6 lines describing what changed in the last 24h, current tournament state, anything broken, anything green. }}

## 🛠 Tech

| # | Title | Effort | Blast | Files | Approve? |
|---|-------|--------|-------|-------|----------|
| T1 | ... | S | Low | backend/src/... | [ ] |
| T2 | ... | ... | ... | ... | [ ] |

**Detail:**

### T1 — {{Title}}
- **What:** ...
- **Why now:** ...

(repeat for each)

## 🎨 Design

(same shape, prefix D1, D2 ...)

## ❤️ CX

(same shape, prefix C1, C2 ...)

## ⚠️ Cross-cutting risks

- {{ item }}

## Approval

Mickey: replace `[ ]` with `[x]` next to items you want built today, then run `/tech-build`, `/design-build`, or `/cx-build`. Skip items by leaving `[ ]` — they roll over to tomorrow's brief.

**Launch risk assessment for Roland Garros (18 May):** Low / Medium / High — {{ one-line justification }}
```

Final thing: at the END of your chat response, summarise in TWO sentences max what changed since yesterday and what the top three priorities are. Always include a `computer://` link to the saved brief.

## What this skill must NOT do

- Don't suggest generic best-practice items ("add tests", "improve docs"). Every suggestion must point to specific evidence from Phase 1.
- Don't propose work that contradicts decisions in `.claude/memory/project_paid_launch_decisions.md` (e.g. don't suggest Stripe — it's been rejected).
- Don't pad the brief. If a persona has nothing real to flag, write one line: "🎨 Design: nothing flagged today" and move on.
- Don't make claims about code without grepping it. The verification rule from CLAUDE.md applies.
- Don't suggest tomorrow's brief automatically. The brief is opt-in.

## Why this exists

Mickey is a solo non-technical founder. He doesn't have time to audit the project every morning. This skill saves him the audit time and gives him a focused approval flow that scales his solo bandwidth into three roles. The brief's quality is everything — pad it with generic advice and Mickey will stop reading.
