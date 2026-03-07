# Mac setup: Install Node.js and run the app

Follow these steps in order. Use the **Terminal** app (Applications → Utilities → Terminal).

---

## Step 1: Install Node.js

You need Node.js (which includes npm). Pick one method.

### Option A – Official installer (easiest)

1. Go to **https://nodejs.org**
2. Download the **LTS** version for macOS
3. Open the downloaded `.pkg` and go through the installer
4. Close and reopen Terminal, then run:
   ```bash
   node -v
   npm -v
   ```
   You should see version numbers (e.g. `v20.x.x` and `10.x.x`).

### Option B – Homebrew (if you use Homebrew)

1. Install Homebrew if needed: https://brew.sh  
   (Copy the one-line install command from that page into Terminal.)
2. Then run:
   ```bash
   brew install node
   ```
3. Check:
   ```bash
   node -v
   npm -v
   ```

---

## Step 2: Open the project folder

In Terminal:

```bash
cd /Users/mikaeelislam/tennis-survivor
```

(Or `cd` to wherever your `tennis-survivor` folder lives.)

---

## Step 3: Install backend dependencies

```bash
cd backend
npm install
```

Wait until it finishes without errors.

---

## Step 4: Add your API key to `.env`

1. Open the file **`tennis-survivor/backend/.env`** in Cursor (or any editor).
2. Find the line:
   ```env
   TENNIS_API_KEY=
   ```
3. Paste your API-Tennis key **right after the `=`** (no spaces, no quotes).  
   Example:
   ```env
   TENNIS_API_KEY=abc123yourrealkey
   ```
4. Save the file.

---

## Step 5: Get the Indian Wells tournament key

In Terminal, from the **backend** folder:

```bash
cd /Users/mikaeelislam/tennis-survivor/backend
npm run find-indian-wells
```

The script will print something like:

```text
INDIAN_WELLS_TOURNAMENT_KEY=1234
```

Copy that number. Open **`backend/.env`** again and paste it after `INDIAN_WELLS_TOURNAMENT_KEY=`:

```env
INDIAN_WELLS_TOURNAMENT_KEY=1234
```

Save the file.

---

## Step 6: Install frontend dependencies

In Terminal:

```bash
cd /Users/mikaeelislam/tennis-survivor/frontend
npm install
```

Wait until it finishes.

---

## Step 7: Start the app

You need **two** Terminal windows (or tabs).

**Terminal 1 – Backend:**

```bash
cd /Users/mikaeelislam/tennis-survivor/backend
npm run dev
```

Leave this running. You should see something like: `Tennis Survivor API running on http://localhost:4000`.

**Terminal 2 – Frontend:**

```bash
cd /Users/mikaeelislam/tennis-survivor/frontend
npm run dev
```

Leave this running. You should see a local URL, usually **http://localhost:5173**.

---

## Step 8: Open the app

In your browser, go to: **http://localhost:5173**

- Join with invite code: **INDIAN-WELLS-2025**
- Use **Make your pick**, **View draw**, **Leaderboard**, etc.

---

## Troubleshooting

| Problem | What to do |
|--------|------------|
| `node: command not found` | Node isn’t installed or not on your PATH. Restart Terminal after installing Node; if it still fails, use Option A (official installer). |
| `npm: command not found` | Same as above; npm is installed with Node. |
| Backend won’t start | Make sure you’re in `tennis-survivor/backend` and ran `npm install` there. |
| Frontend won’t start | Make sure you’re in `tennis-survivor/frontend` and ran `npm install` there. |
| Blank page or “Cannot GET” | Start **both** backend and frontend (Steps 7). Backend must be on port 4000, frontend on 5173. |
| Draw still shows mock data | Check `backend/.env` has both `TENNIS_API_KEY` and `INDIAN_WELLS_TOURNAMENT_KEY` set (no quotes). Restart the backend after changing `.env`. |
