# Final Serve-ivor

Tennis survivor fantasy game. Pick one player per round to win their match. If they win, you survive. If they lose, you're out. Last person standing wins. You can never pick the same player twice.

**Live at [finalserveivor.com](https://finalserveivor.com)**

Currently running: **Rolex Monte-Carlo Masters 2026**

## Tech stack

- **Frontend:** React (Vite), deployed on Vercel
- **Backend:** Node.js / Express (ESM), deployed on Railway
- **Database:** PostgreSQL on Railway
- **Tennis data:** API-Tennis (live fixtures and results)
- **Email:** Brevo transactional emails with admin approval

## Quick start (local dev)

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Runs at `http://localhost:4000`. Uses in-memory mock data without a database.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. Proxies `/api` to the backend.

### 3. Live data (optional)

Set `TENNIS_API_KEY` and `ACTIVE_TOURNAMENT=monte-carlo-2026` in `backend/.env`. The app will use [API-Tennis](https://api-tennis.com) for live draw and results. Without these, it uses the built-in Monte Carlo mock draw (56 players).

## Core features

| Feature | Description |
|--------|-------------|
| **Pick screen** | Available players, search, round selector, countdown to lock, opponent info |
| **Draw viewer** | Custom bracket with SVG connectors + by-round list view |
| **Leaderboard** | Group standings, pick visibility after lock, pick history modal |
| **Group / invite** | Private groups, invite codes, join via link |
| **Auto-grading** | Results processor auto-grades picks against completed matches |
| **H2H matchup** | Click any match in the draw to see head-to-head stats |

## Docs

- `CLAUDE.md` — full operational context, known issues, session history
- `DEPLOY.md` — deployment guide for Railway + Vercel
- `docs/ADDING_TOURNAMENTS.md` — how to add new tournament pools
- `PROJECT-PROMPT.md` — project overview and architecture
