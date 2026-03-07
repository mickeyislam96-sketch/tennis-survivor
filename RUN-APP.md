# Add your API key and run the app

Do these steps **in your Mac Terminal** (not in Cursor).

---

## 1. Fix npm permissions (one-time)

If you see an error about `.npm` or "cache folder", run this once (use your Mac username if different):

```bash
sudo chown -R $(whoami) ~/.npm
```

Enter your Mac password when prompted.

---

## 2. Install dependencies (one-time)

```bash
cd /Users/mikaeelislam/tennis-survivor/backend
npm install
```

```bash
cd /Users/mikaeelislam/tennis-survivor/frontend
npm install
```

---

## 3. Add your API key to .env

1. In Cursor, open **`tennis-survivor/backend/.env`**.
2. Find the line: `TENNIS_API_KEY=`
3. Paste your API-Tennis key **right after the =** (no space, no quotes).  
   Example: `TENNIS_API_KEY=abc123yourkey`
4. Save the file (Cmd+S).

---

## 4. Get the Indian Wells tournament key

In Terminal:

```bash
cd /Users/mikaeelislam/tennis-survivor/backend
npm run find-indian-wells
```

Copy the line it prints, e.g. `INDIAN_WELLS_TOURNAMENT_KEY=1234`.  
Open **`backend/.env`** again and paste that line (or add the number after `INDIAN_WELLS_TOURNAMENT_KEY=`). Save.

---

## 5. Start the app

**Terminal window 1 – backend:**

```bash
cd /Users/mikaeelislam/tennis-survivor/backend
npm run dev
```

Leave it running. You should see: `Tennis Survivor API running on http://localhost:4000`.

**Terminal window 2 – frontend:**

```bash
cd /Users/mikaeelislam/tennis-survivor/frontend
npm run dev
```

Leave it running. It will show a URL, usually **http://localhost:5173**.

---

## 6. Open the app

In your browser go to: **http://localhost:5173**

Use invite code **INDIAN-WELLS-2025** to join the demo group.
