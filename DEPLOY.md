# Deployment Guide — Final Serve-ivor

Stack: **Backend → Railway** (Node API + Postgres) · **Frontend → Vercel** (React/Vite)
Live domain: **finalserveivor.com** (added in Vercel after deploy)

Total time: ~20 minutes on first deploy. Subsequent deploys are automatic on `git push`.

---

## Prerequisites — push to GitHub first

```bash
cd /Users/mikaeelislam/tennis-survivor
git add .
git commit -m "Latest changes"
git push
```

If this is the first push:
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/tennis-survivor.git
git push -u origin main
```

---

## Step 1 — Deploy the backend on Railway

1. Go to [railway.app](https://railway.app) and sign in with GitHub.

2. **New Project → Deploy from GitHub repo** → select `tennis-survivor`.

3. Set **Root Directory** to `backend`. Railway detects Node.js automatically.

4. Add a database: in the project dashboard click **New → Database → Add PostgreSQL**.
   Railway automatically injects `DATABASE_URL` into your backend service.

5. Set environment variables (**Settings → Variables**):

   | Variable | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `TENNIS_API_KEY` | Your API-Tennis key |
   | `MIAMI_TOURNAMENT_KEY` | Miami Open 2026 tournament key from API-Tennis |
   | `RESEND_API_KEY` | Your Resend key (for password reset emails) |
   | `RESEND_FROM` | `noreply@finalserveivor.com` (or verified sender) |
   | `APP_URL` | `https://finalserveivor.com` |
   | `FRONTEND_URL` | `https://finalserveivor.com` *(update after Step 2)* |

   > **Note on `MIAMI_TOURNAMENT_KEY`:** Find the Miami Open 2026 key in your API-Tennis dashboard.
   > The old `INDIAN_WELLS_TOURNAMENT_KEY` still works as a fallback but should be replaced.
   > If neither key is set, the app falls back to the static Miami draw (fully functional).

6. Go to **Settings → Networking → Generate Domain**. Copy the URL —
   it looks like `https://tennis-survivor-production.up.railway.app`.

7. The database schema auto-initialises on startup (no manual step needed).

---

## Step 2 — Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub.

2. **Add New Project → Import** `tennis-survivor` from GitHub.

3. Set **Root Directory** to `frontend`.

4. Under **Environment Variables**, add:

   | Variable | Value |
   |---|---|
   | `VITE_API_URL` | `https://your-railway-url.up.railway.app/api` |

   Use the Railway URL from Step 1 with `/api` appended.

5. Click **Deploy**. You'll get a URL like `https://tennis-survivor.vercel.app`.

---

## Step 3 — Link backend and frontend

In Railway, update these two variables (then Railway redeploys automatically):

```
FRONTEND_URL = https://finalserveivor.com
APP_URL      = https://finalserveivor.com
```

If you don't have the custom domain yet, use the Vercel URL temporarily.

---

## Step 4 — Add finalserveivor.com in Vercel

1. In Vercel → your project → **Settings → Domains**.
2. Click **Add** and enter `finalserveivor.com`.
3. Vercel gives you two DNS records to add:

   | Type | Name | Value |
   |---|---|---|
   | `A` | `@` | `76.76.21.21` |
   | `CNAME` | `www` | `cname.vercel-dns.com` |

4. Add these in your domain registrar (GoDaddy / Namecheap / Cloudflare / etc.).
5. Wait 5–30 minutes for DNS to propagate. Vercel issues an SSL cert automatically.
6. Once live: test `https://finalserveivor.com` and `https://www.finalserveivor.com`.

---

## Step 5 — Smoke test

- [ ] `https://finalserveivor.com` loads the home page
- [ ] `https://your-railway-url.up.railway.app/api/health` returns `{"ok":true}`
- [ ] Sign up with a test account
- [ ] Create or join a pool
- [ ] Navigate to Make Pick — players should show from the Miami draw
- [ ] Pick window shows a countdown to the correct lock time
- [ ] Leaderboard loads and rows are clickable

---

## Updating the app

```bash
git add .
git commit -m "Describe your change"
git push
```

Railway and Vercel redeploy automatically within ~2 minutes. No manual steps.

---

## Switching tournaments (future)

When a new tournament starts:

1. In `backend/src/data/tournaments.js`:
   - Set the current tournament `status: 'completed'`
   - Add the new tournament with `status: 'active'`

2. In `backend/src/data/` — add a new mock draw file (e.g. `canadaDraw.js`) and update the `getMockDraw()` call in `tennisData.js`.

3. Update the fallback schedule dates in `tennisData.js` (`ROUND_DATES` and `ROUND_DATE_FALLBACK`).

4. Update `MIAMI_TOURNAMENT_KEY` → `CANADA_TOURNAMENT_KEY` (or the relevant new env var) in Railway.

5. Push to GitHub — both services redeploy automatically.
