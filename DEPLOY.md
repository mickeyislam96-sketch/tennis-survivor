# Deployment Guide

This app deploys in two halves:
- **Backend** → Railway (Node API + Postgres database)
- **Frontend** → Vercel (React/Vite)

Total time: ~20 minutes.

---

## Prerequisites

1. Push your code to GitHub first (if you haven't already):
   ```
   cd /Users/mikaeelislam/tennis-survivor
   git init
   git add .
   git commit -m "Initial commit"
   ```
   Then create a new repo at github.com and push:
   ```
   git remote add origin https://github.com/YOUR_USERNAME/tennis-survivor.git
   git push -u origin main
   ```

---

## Step 1 — Deploy the backend on Railway

1. Go to [railway.app](https://railway.app) and sign up with GitHub.

2. Click **New Project → Deploy from GitHub repo** → select `tennis-survivor`.

3. When asked which folder, set the **Root Directory** to `backend`.

4. Railway will detect Node.js and build automatically.

5. Add a database: in your project dashboard click **New** → **Database** → **Add PostgreSQL**. Railway will automatically add a `DATABASE_URL` variable to your backend service.

6. Set environment variables (Settings → Variables):
   ```
   NODE_ENV=production
   TENNIS_API_KEY=your_api_tennis_key
   INDIAN_WELLS_TOURNAMENT_KEY=your_tournament_key
   FRONTEND_URL=https://PLACEHOLDER (update this after Step 2)
   ```

7. Once deployed, go to **Settings → Networking → Generate Domain**. Copy the URL — it will look like `https://tennis-survivor-production.up.railway.app`.

8. Run the database schema once. In Railway dashboard → your backend service → click **Shell**:
   ```
   npm run db:init
   ```

---

## Step 2 — Deploy the frontend on Vercel

1. Go to [vercel.com](https://vercel.com) and sign up with GitHub.

2. Click **Add New Project** → import `tennis-survivor` from GitHub.

3. Set the **Root Directory** to `frontend`.

4. Under **Environment Variables**, add:
   ```
   VITE_API_URL = https://your-railway-url.up.railway.app/api
   ```
   (Use the Railway URL from Step 1, with `/api` at the end.)

5. Click **Deploy**. Vercel will build and give you a URL like `https://tennis-survivor.vercel.app`.

---

## Step 3 — Link them together

1. Back in Railway, update the `FRONTEND_URL` variable:
   ```
   FRONTEND_URL=https://tennis-survivor.vercel.app
   ```
   Railway will redeploy automatically.

---

## Step 4 — Test it

1. Visit your Vercel URL.
2. The home page should load and show your pool.
3. Share the invite link with friends — it will now be a real public URL they can visit.

---

## Updating the app later

After making code changes locally:
```
git add .
git commit -m "Your change description"
git push
```
Both Railway and Vercel will automatically redeploy within ~2 minutes.

---

## Custom domain (optional)

In Vercel → your project → **Settings → Domains**, you can add a custom domain like `tennislms.com`. Vercel handles the SSL certificate automatically.
