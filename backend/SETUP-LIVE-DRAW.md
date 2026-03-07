# Live draw setup (API-Tennis)

## 1. Create `.env` in the backend folder

From the `backend` directory:

```bash
cp .env.example .env
```

## 2. Add your API key

Edit `backend/.env` and set your API-Tennis key:

```
TENNIS_API_KEY=your_actual_api_key_here
```

## 3. Find the Indian Wells tournament key

Run the helper script (from the `backend` directory):

```bash
npm run find-indian-wells
```

The script calls the API and prints the tournament key for BNP Paribas Open Indian Wells (ATP singles). Example output:

```
Use this in your .env for Indian Wells 2025:

INDIAN_WELLS_TOURNAMENT_KEY=1234
# Indian Wells (Atp Singles)
```

## 4. Add the tournament key to `.env`

Add this line to `backend/.env` (use the key from the script output):

```
INDIAN_WELLS_TOURNAMENT_KEY=the_key_from_the_script
```

Your `.env` should look like:

```
PORT=4000
FRONTEND_URL=http://localhost:5173
DATABASE_URL=postgresql://localhost:5432/tennis_survivor

TENNIS_API_KEY=your_api_key_here
INDIAN_WELLS_TOURNAMENT_KEY=the_tournament_key_from_script
```

## 5. Restart the backend

Restart the backend server so it picks up the new env vars. The draw and picks will then use live data from API-Tennis when the tournament has fixtures.

**Note:** If the API returns no fixtures (e.g. before the tournament or wrong key), the app falls back to the Indian Wells mock draw.
