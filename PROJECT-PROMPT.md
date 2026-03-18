# Final Serve-ivor — Project Prompt

## What is this?
A tennis last-man-standing web app called **Final Serve-ivor**. Each round, players pick one match winner. Pick correctly and you survive. Pick wrong and you're out. Last player standing wins the prize pool. Players can never pick the same player twice across the tournament.

The first real test will be **ATP Miami Open 2026** (draw: March 16, play: March 19–30) with ~3 beta testers, entry fee waived.

---

## Tech Stack
- **Frontend**: React + Vite, deployed on **Vercel**
- **Backend**: Node/Express (ES Modules), deployed on **Railway**
- **Database**: PostgreSQL on Railway
- **Email**: Nodemailer via Gmail (`finalservivor@gmail.com`)
- **Tennis data**: API-Tennis (api-tennis.com) — key stored as `TENNIS_API_KEY` in Railway
- **Repo**: `mickeyislam96-sketch/tennis-survivor` on GitHub (main branch auto-deploys to both Vercel + Railway)

### Key env vars in Railway:
- `DATABASE_URL` — auto-set by Railway Postgres plugin
- `FRONTEND_URL` — Vercel domain (for CORS + password reset links)
- `TENNIS_API_KEY` — API-Tennis key
- `INDIAN_WELLS_TOURNAMENT_KEY` — currently set to Indian Wells; swap to Miami key on March 16
- `GMAIL_USER=finalservivor@gmail.com`
- `GMAIL_APP_PASSWORD` — Gmail App Password (already set)

---

## Project structure
```
tennis-survivor/
  frontend/src/
    App.jsx                  — routes, useAuth hook (register/login/logout)
    index.css                — all styles
    components/
      Layout.jsx             — header (Sign in / Create account buttons, user menu), AuthModal with forgot password
      Layout.css
    pages/
      GroupHome.jsx          — group dashboard, pick CTA, countdown cards
      PickScreen.jsx         — make/change pick, player list, round tabs, window countdowns
      DrawViewer.jsx         — bracket view + by-round list view
      Leaderboard.jsx        — standings table
      JoinGroup.jsx          — invite link landing, register/login inline before join
      PickHistory.jsx        — user's pick history
      ResetPassword.jsx      — /reset-password?token=xxx page
      TermsAndConditions.jsx
    data/
      tournaments.js         — tournament config (status, drawAvailable, bracketWidget URL etc.)
  backend/src/
    index.js                 — Express app, auto-applies schema.sql on startup
    routes/
      auth.js                — register, login, forgot-password, reset-password, verify-reset-token
      groups.js / pools.js   — group/pool endpoints
      picks.js               — make pick, available players, history
      draw.js                — bracket, deadlines, rounds
      leaderboard.js
    services/
      tennisData.js          — fetches from API-Tennis, builds draw, computes pick windows
                               contains ROUND_DATE_FALLBACK (hardcoded dates for when API has no times)
    utils/
      email.js               — sendRegistrationEmail, sendPasswordResetEmail (HTML templates)
    data/
      mockGroups.js          — mock groups (g1=Indian Wells, g2=Miami), MOCK_USERS
      tournaments.js         — backend tournament config
    db/
      schema.sql             — auto-applied on startup (CREATE TABLE IF NOT EXISTS + ALTER TABLE migrations)
      pool.js                — pg Pool
```

---

## Auth system (fully built)
- **Register**: name + email + password (min 8 chars), bcryptjs hashed, welcome email sent
- **Login**: email + password, verified against hash
- **Forgot password**: "Forgot your password?" on sign-in form → email input → reset link emailed (1h expiry)
- **Reset password**: `/reset-password?token=xxx` page — validates token, shows new password form, auto-redirects home after reset
- **Duplicate email**: returns clear error "An account with this email already exists. Please sign in instead."
- **Header**: Shows "Sign in" (outlined) + "Create account" (green) when logged out; user's name with dropdown + sign out when logged in
- **JoinGroup**: Inline register/login form shown before join button when user is not logged in

---

## Pick window logic
- `opensAt` = 12h after previous round's first match
- `lockAt` = 1h before current round's first match
- Three states: `isOpen` (amber countdown to close), `isNotYetOpen` (blue countdown to open), `isLocked`
- `ROUND_DATE_FALLBACK` in `tennisData.js` provides hardcoded dates when live API returns fixtures without start times

---

## What's been completed (pre-Miami)
- ✅ Pick window countdowns on GroupHome and PickScreen (amber = closes in, blue = opens in)
- ✅ JoinGroup beta waiver notice (🎁 "Entry fee waived for beta")
- ✅ Miami mock group: £20 entry fee, `betaFree: true`
- ✅ Full auth: register, login with passwords, forgot password, reset password page
- ✅ Gmail env vars set in Railway
- ✅ Railway build fixed (bcryptjs added to package-lock.json)
- ✅ Password reset tokens table in schema

---

## What's left to build (do these now)

### 1. Scores on match cards in DrawViewer
The API returns `event_final_result` (e.g. "6-3 7-5") for completed matches but it's not being passed through or displayed.

**Backend fix** — in `backend/src/services/tennisData.js`, inside `buildMatch()`, add to the returned object:
```js
score: f.event_final_result || null,
```

**Frontend fix** — in `frontend/src/pages/DrawViewer.jsx`:
- `BracketCard`: show score in small text below the player rows when `match.status === 'completed'` and `match.score` exists
- `ListCard`: show score prominently on the right side of completed match cards

### 2. Mobile optimisation
The site works on mobile but needs polish. Key issues to address:
- Header: two auth buttons ("Sign in" + "Create account") are too wide on small screens — abbreviate or stack
- PickScreen: player rows, search bar, round tabs need checking on 375px width
- GroupHome: countdown cards, pick CTA buttons
- DrawViewer list view: match cards (`lc-grid`, player names)
- Leaderboard: table columns too wide on mobile
- General: touch targets, font sizes, padding throughout

The existing mobile breakpoint is `@media (max-width: 680px)` in both `Layout.css` and `index.css`.

---

## March 16 launch plan (all in one push)
Everything is documented in `MARCH-16-LAUNCH.md` in the repo root. Summary:

1. **Flip tournament config** in both `frontend/src/data/tournaments.js` and `backend/src/data/tournaments.js` — set Miami to `status: 'active', drawAvailable: true, entryOpen: true`
2. **Add SofaScore bracket widget URL** to `frontend/src/data/tournaments.js` Miami entry (`bracketWidget: '<embed URL>'`)
3. **Update `tennisData.js`** date range (`dateStart: '2026-03-19', dateStop: '2026-03-30'`) and `ROUND_DATE_FALLBACK` to Miami dates
4. **Railway Variables** → update `INDIAN_WELLS_TOURNAMENT_KEY` to Miami tournament key from API-Tennis

---

## Important notes
- The Railway free trial is being used (sufficient for 3-person beta through March 30)
- Entry fee is waived for beta — no payment processing built yet
- `betaFree: true` on the Miami mock group controls the waiver UI
- The schema auto-applies on Railway startup via `index.js` reading `schema.sql`
- Indian Wells data is currently live; Miami goes live on March 16 when config is flipped
- User preference: UK English, no em dashes, analytical tone, non-technical explanations
