# Final Serve-ivor — Project Prompt

## What is this?
A tennis last-man-standing web app called **Final Serve-ivor**. Each round, players pick one match winner. Pick correctly and you survive. Pick wrong and you're out. Last player standing wins the prize pool. Players can never pick the same player twice across the tournament.

The first competitive tournament is **Rolex Monte-Carlo Masters 2026** (live, 11 entrants, free entry). Miami Open 2026 was a practice test and has been fully removed from the codebase.

---

## Tech Stack
- **Frontend**: React + Vite, deployed on **Vercel** (auto-deploys from GitHub `main`)
- **Backend**: Node/Express (ES Modules), deployed on **Railway** (auto-deploys from GitHub `main`)
- **Database**: PostgreSQL on Railway
- **Email**: Brevo (formerly Sendinblue) transactional emails with admin approval system
- **Tennis data**: API-Tennis (api-tennis.com) — key stored as `TENNIS_API_KEY` in Railway
- **Repo**: `mickeyislam96-sketch/tennis-survivor` on GitHub

### Key env vars in Railway:
- `DATABASE_URL` — auto-set by Railway Postgres plugin
- `FRONTEND_URL` — production domain (for CORS + email links)
- `TENNIS_API_KEY` — API-Tennis key (critical — draw silently falls back to mock if missing)
- `ACTIVE_TOURNAMENT` — which tournament config to load (currently `monte-carlo-2026`)
- `ADMIN_SECRET` — auth for admin/diagnostic endpoints

---

## Project structure
```
tennis-survivor/
  frontend/src/
    App.jsx                  — routes, useAuth hook (register/login/logout)
    index.css                — all styles
    components/
      Layout.jsx             — header, AuthModal with email validation
      Layout.css
      MatchupModal.jsx       — H2H data modal for draw viewer
    pages/
      GroupHome.jsx          — group dashboard, pick CTA, countdown cards
      PickScreen.jsx         — make/change pick, player list, round tabs, window countdowns
      DrawViewer.jsx         — bracket view + by-round list view
      Leaderboard.jsx        — standings table with pick history modal
      JoinGroup.jsx          — invite link landing
      PickHistory.jsx        — user's pick history
      ResetPassword.jsx      — /reset-password?token=xxx page
      TermsAndConditions.jsx
    data/
      tournaments.js         — tournament config (only Monte Carlo 2026)
  backend/src/
    index.js                 — Express app, auto-applies schema.sql on startup
    config/
      tournament.js          — active tournament selector (reads ACTIVE_TOURNAMENT env var)
      tournaments/
        monte-carlo-2026.js  — MC config: API params, round structure, lock times, manual results
    routes/
      auth.js                — register, login, forgot-password, reset-password, email validation
      groups.js / pools.js   — group/pool endpoints
      picks.js               — make pick, available players, history, double deadline check
      draw.js                — bracket, deadlines, rounds, admin diagnostics
      leaderboard.js         — standings with pick visibility control
      matchup.js             — H2H data from API-Tennis
      admin.js               — admin endpoints
    services/
      tennisData.js          — fetches from API-Tennis, builds draw, dynamic API key discovery,
                               in-memory cache (2 min TTL), getDeadlines()
      resultsProcessor.js    — auto-grades picks against completed matches
      sofascoreAdapter.js    — Sofascore fetch (currently 403-blocked)
    data/
      monteCarloMockDraw.js  — MC draw with 56 real player names
      mockDraw.js            — mock draw dispatcher
      mockGroups.js          — mock groups (MC only)
    db/
      schema.sql             — auto-applied on startup
      pool.js                — pg Pool
```

---

## Tournament architecture

Single-tournament system using `ACTIVE_TOURNAMENT` env var. Tournament configs live in `backend/src/config/tournaments/` and define:
- API parameters (tournament key, season, date range)
- Round structure and labels
- Lock time overrides and window open overrides
- Manual result overrides (for matches the API doesn't index)
- Round date fallbacks

The pick pool is decoupled from bracket display. For R1, only R1 match participants are eligible. For R32+, all non-eliminated non-qualifier players are eligible regardless of bracket slot state.

---

## Important notes
- Railway on Hobby plan (persistent)
- Entry fee is free for Monte Carlo — no payment processing built yet
- The schema auto-applies on Railway startup via `index.js` reading `schema.sql`
- Every push to `main` auto-deploys to real users — treat every commit as production
- User preference: UK English, no em dashes, analytical tone, non-technical explanations
- See `CLAUDE.md` for full operational context, known issues, and session history
