---
name: Final Serve-ivor project context
description: Full technical context for the Final Serve-ivor tennis survivor game — stack, repo, infrastructure IDs, key files, design system
type: project
originSessionId: b7e848b7-b642-43e4-a5e5-5e49e2c370e9
---
**Product:** Final Serve-ivor — tennis survivor fantasy game. Players pick one ATP player per round, eliminated if their pick loses. Live at https://finalserveivor.com. Monte Carlo 2026 complete (Mark won). Current: Madrid Open 2026 (R1 pick window open, 5 entries as of 21 Apr, tournament starts 22 Apr).

**Stack:**
- Frontend: React + Vite → Vercel (auto-deploys from GitHub main)
- Backend: Node.js / Express → Railway (auto-deploys from GitHub main)
- GitHub repo: `mickeyislam96-sketch/tennis-survivor`
- Primary data: FlashScore scraper (free, browser-based via Chrome MCP, 20-min scheduled task)
- Fallback data: Goalserve ($100/mo trial) — returned 0 fixtures on Madrid day 1, demoted to fallback
- Legacy data: API-Tennis — fully retired from matchup modal 20 Apr, kept only as automatic fallback in dataAdapter provider chain
- Database: PostgreSQL on Railway volume (picks, groups, members)
- Email: Brevo transactional (custom HTML templates in email.js, direct send with dedup)

**Live URLs:**
- Production frontend: https://finalserveivor.com
- Vercel alias: https://tennis-survivor.vercel.app
- Backend API: https://tennis-survivor-production.up.railway.app

**Infrastructure IDs:**
- Railway Project: `0ec066c7-c7e1-4abf-8897-3577208c64cd`
- Railway Service: `df618c7b-3678-4595-aaf7-3ff2f0e86d72`
- Railway Environment: `148fec0e-b919-423b-93d7-1487cdaa82d4`
- Vercel Project: `prj_HBePdqF7BaXq1qzw7bxu9prRhtyf`
- Vercel Team: `team_ekuiNPY7cIyY2ieq41oWMYvO`

**Design system:** Direction A "Clean Court" — Outfit + Fraunces + JetBrains Mono, semantic colour tokens, 640px mobile breakpoint. Session 22 redesign implemented card-based layouts for Leaderboard, Pick History, and Make a Pick pages. Player avatars: 169-player CSS sprite sheet (205KB WebP), fallback to coloured initials circle. Brand dark green (#0F4A23) is the standard colour for alive/active status badges across all pages. Player names on bracket and matchup modal use "Surname, F." format via `shortName()` utility.

**Seed draw system (20 Apr 2026):** Reusable two-phase architecture. Phase 1: static JSON from ATP draw PDF (seedDrawLoader.js). Phase 2: Goalserve live overlay (seedDrawOverlay.js). New tournament = add one JSON file. Template: `CTO - TS/New Tournament Setup Template.md`.

**Matchup modal (20 Apr 2026):** Bracket cards are clickable, opens modal with player cards (name, seed, country flag), tournament form (W/L badges, scores). Uses seed draw + Goalserve fixture cache only — no external API calls, 139ms response. H2H placeholder (Goalserve has no H2H endpoint). CSS in `MatchupModal.css` with mobile bottom-sheet.

**Key env vars (Railway):** `GOALSERVE_API_KEY` (primary data), `TENNIS_DATA_PROVIDER=goalserve`, `ACTIVE_TOURNAMENT=madrid-2026`, `ADMIN_SECRET`, `JWT_SECRET` (separate from ADMIN_SECRET), `BREVO_API_KEY`, `MATCHSTAT_API_KEY`, `TENNIS_API_KEY` (legacy fallback only)

**Performance (20 Apr 2026):** Draw/bracket endpoints ~130ms (was 10-20s). Three-layer fix: draw-level cache keyed on Goalserve timestamp, Goalserve-only fetch for seed draw tournaments (skip API-Tennis/Sofascore chain), cache empty Goalserve results. Sprite sheet: 97% image payload reduction (6.4MB → 205KB, 170 requests → 1).

**Automation (Phase 1 — deployed 19 Apr):** 15-min cron handles result settlement, withdrawal detection, draw release detection, lock time auto-setting. All ops logged to `ops_log` table.

**Mac repo path:** `/Users/mikaeelislam/tennis-survivor`

**Why:** Full context in CLAUDE.md at repo root. Read this at the start of every session.
