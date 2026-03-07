# Tennis Last Man Standing

Survivor pool for **BNP Paribas Open Indian Wells 2025** (Masters 1000, 96-player draw with 32 byes). Pick one player per round to win. If they win, you survive; if they lose, you're out. Last person standing wins the prize pool.

## Tech stack

- **Frontend:** React (Vite), React Router
- **Backend:** Node.js, Express
- **Database:** PostgreSQL (schema included; app runs with **mock data** by default)
- **Planned:** Firebase (push notifications), Stripe (entry fees)

## Quick start

### 1. Backend

```bash
cd backend
npm install
npm run dev
```

Runs at `http://localhost:4000`. No database required: uses in-memory mock data.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs at `http://localhost:5173`. Proxies `/api` to the backend.

### 3. Try it

- Open **http://localhost:5173**
- You're logged in as **u1** (Alice) by default. Change user via `localStorage.setItem('tennis_user_id', 'u2')` and refresh to be Bob/Carol.
- Go to **Join with invite code** and enter `INDIAN-WELLS-2025`, or open **http://localhost:5173/join/INDIAN-WELLS-2025**
- After joining, use **Make your pick**, **View draw**, **Pick history**, and **Leaderboard**

### 4. Live draw & results (optional)

Set **TENNIS_API_KEY** and **INDIAN_WELLS_TOURNAMENT_KEY** (or **TOURNAMENT_KEY**) in `backend/.env`. The app will use [API-Tennis](https://api-tennis.com) for the Indian Wells 2025 draw and live results. Without these, the app uses the built-in Indian Wells mock (96 players, correct round structure with byes).

## Core flows (mock)

| Feature | Description |
|--------|-------------|
| **Pick screen** | Available players (in draw + not yet used by you), search, round selector, countdown to lock. Submit pick for current round. |
| **Draw viewer** | Bracket by round (R128 → F), match results, winner highlighted. |
| **Pick history** | Your picks per round and whether they survived. |
| **Leaderboard** | Group members, alive/out, rounds survived. |
| **Group / invite** | Private group, invite code, join via link. Entry fee & prize pool (Stripe later). |
| **Tiebreaker** | API for Final prediction questions (sets, games, aces); UI can be added when multiple reach the Final. |

## API (mock)

- `GET /api/auth/me?userId=u1` – current user
- `GET /api/groups?userId=u1` – my groups
- `GET /api/groups/:id` – group + members
- `GET /api/groups/invite/:code` – group by invite code
- `POST /api/groups/:id/join` – join group (body: `userId`, `displayName`)
- `GET /api/draw/rounds` – round list
- `GET /api/draw/bracket?round=R32` – draw + matches
- `GET /api/draw/deadlines` – round lock times (mock)
- `GET /api/picks/available?userId=&groupId=&round=` – players you can pick
- `GET /api/picks/history?userId=&groupId=` – your picks
- `POST /api/picks` – submit pick (body: `userId`, `groupId`, `round`, `playerId`, `playerName`)
- `GET /api/leaderboard/:groupId` – leaderboard
- `GET /api/tiebreaker/questions` – tiebreaker questions
- `POST /api/tiebreaker/answer` – submit tiebreaker answer

## Database (optional)

To use PostgreSQL:

1. Create DB: `createdb tennis_survivor`
2. Set `DATABASE_URL=postgresql://localhost:5432/tennis_survivor`
3. Run `npm run db:init` in `backend`
4. Replace mock data in routes with `pool.query()` using the schema in `backend/src/db/schema.sql`

## Next steps

1. **Live data** – Integrate tennis API (e.g. Tennis Abstract, ATP) for real draw and results.
2. **Payments** – Stripe Checkout for entry fee; credit prize pool when all have paid.
3. **Notifications** – Firebase Cloud Messaging; remind users before each round lock.
4. **Tiebreaker UI** – When multiple players reach the Final, show prediction form and score by closest answer.
