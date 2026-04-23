# Final Serve-ivor — Product Context

## What it is
Tennis survivor fantasy game. Players join groups, pick one match winner per round, eliminated if pick loses. Last survivor wins the prize pot. Built around major ATP draws.

## History
- Monte Carlo 2026: complete (Mark won, 11 entrants, free entry)
- Madrid 2026: active (started 22 Apr), free entry, R1 complete (12 of 32 matches), R64 entries starting, FlashScore Railway cron scraper providing live data
- Rome 2026: planned free + mobile app launch (higher tournament activity, scraper will run every 15 min)
- Roland Garros 2026: planned first paid tournament

## Key architectural patterns
- R1 uses per-match lock (players removed as their match starts), R2+ uses round-level lock deadlines
- Data adapter layer in `dataAdapter.js` — unified interface for FlashScore scraper (primary), API-Tennis (fallback), Sofascore (defunct). Goalserve fully removed 22 Apr.
- Email dedup/approval: all emails queue as `pending`, admin approves via API endpoint. Cron never sends directly. Exception: support emails send immediately.
- Auto-deploys: every push to `main` deploys to Vercel (frontend) and Railway (backend) immediately

## Active tournament config
`backend/src/config/activeTournament.js` controls everything: tournament ID, lock time overrides, r1PerMatchLock flag. (Goalserve ID field removed 22 Apr.)

## Repositories
- Web: `mickeyislam96-sketch/tennis-survivor` (GitHub)
- Mobile: `mickeyislam96-sketch/tennis-survivor-mobile` (GitHub)

## Key features built (as of 23 Apr 2026)
- **Support contact form** (`/support`): category dropdown, subject, message, user context auto-attached. `POST /api/support` with 5/hr rate limiting. Emails sent directly to finalservivor@gmail.com via Brevo.
- **Gold pill "My Pool" nav link**: fetches user's pool membership, links to group page. Shows pool name (single) or "My Pools" (multiple). Logged-in only.
- **How to Play page** (`/how-to-play`): 5-step guide + 3 strategy tips. Simplified copy (no free/paid/retirements/prize splitting).
- **Email system**: 9 templates (welcome, pick reminder, survival, elimination, winner, draw released, withdrawal alert, admin digest, support). All aligned to brand design system. Direct send via Brevo (no queue), dedup via `emails_sent` table.
- **Micro-interactions**: 8 CSS transitions (button press, card entrance, pick pulse, skeleton shimmer, tab crossfade, gold CTA shimmer, arrow nudge, modal exit).
- **Tournament ops automation (Phase 1)**: 15-min cron + `opsMonitor.js` handles result settlement, withdrawal detection, draw release detection, lock time auto-setting. Ops logging to `ops_log` table. Daily ops brief Cowork task at 8am. Playbook: CTO workspace.
- **Ops API endpoints**: `GET /api/ops/summary`, `GET /api/ops/log`, `POST /api/ops/setup-tournament`, `GET /api/ops/health-deep`. All behind ADMIN_SECRET auth.
- **FlashScore Railway cron scraper** (23 Apr): Production-ready. Playwright/Chromium Docker service, runs hourly 10-21 UTC, 3-pass name matching, auto-withdrawal detection, sole live data provider.
- **By Round view redesign** (23 Apr): Scoreboard-style match cards with score breakdowns, tiebreak decoding, winner highlighting, status badges (Live/Finished/Scheduled).
