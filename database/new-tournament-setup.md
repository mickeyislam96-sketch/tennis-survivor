# New Tournament Setup Template

Everything that needs to change in code when launching a new tournament in Final Serve-ivor. Follow in order.

---

## Phase 1: Before the draw is released (1-2 weeks before tournament)

### 1. Add tournament config to backend

**File:** `backend/src/config/activeTournament.js`

Add a new entry in the `TOURNAMENTS` object:

```js
'rome-2026': {
  id: 'rome-2026',
  name: 'Internazionali BNL d\'Italia',
  shortName: 'Rome',
  year: 2026,
  tourLevel: 'ATP Masters 1000',
  startDate: '2026-05-11',
  endDate: '2026-05-18',
  surface: 'Clay (outdoor)',
  drawSize: 96,            // 96 for Masters, 128 for Grand Slams
  seedsWithByes: 32,       // 32 for 96-draw Masters, 0 for 128-draw Slams
  rounds: ['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F'],
  matchesPerRound: { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 },
  r1PerMatchLock: false,   // true = players removed as match starts, false = fixed deadline
  lockTimeOverrides: { R1: null, R64: null, R32: null, R16: null, QF: null, SF: null, F: null },
  windowOpensOverrides: {},
  roundDateFallbacks: {
    R1:  '2026-05-11T09:00:00Z',
    R64: '2026-05-13T09:00:00Z',
    R32: '2026-05-14T09:00:00Z',
    R16: '2026-05-15T09:00:00Z',
    QF:  '2026-05-16T09:00:00Z',
    SF:  '2026-05-17T09:00:00Z',
    F:   '2026-05-18T13:00:00Z',
  },
  apiTennisTournamentKey: null,
  apiSeason: null,
},
```

What to customise: draw size (96 vs 128), seeds with byes (32 vs 0), round structure, fallback dates, surface.

### 2. Add tournament to frontend registry

**File:** `frontend/src/data/tournaments.js`

Add a new entry matching the backend config. Key fields: `id`, `name`, `status: 'upcoming'`, `drawAvailable: false`, `entryOpen: true`, dates.

### 3. Add tournament to backend registry

**File:** `backend/src/data/tournaments.js`

Mirror the frontend entry. This is used by the pools/groups system.

### 4. Create the database group

Run this API call (or use admin endpoint):

```bash
curl -X POST https://tennis-survivor-production.up.railway.app/api/groups \
  -H "Content-Type: application/json" \
  -d '{"name": "Rome 2026", "tournamentId": "rome-2026", "entryFee": 0, "maxMembers": 100}'
```

Save the returned `groupId` — you'll need it for invite links.

### 5. Set Railway environment variable

```
ACTIVE_TOURNAMENT=rome-2026
```

Then restart the Railway service (env var changes require restart).

### 6. Update FlashScore scraper name mapping

Update the `flashscore-scraper` Cowork scheduled task with name mappings for all players in the new draw. FlashScore uses abbreviated names ("Z. Bergs") which must be mapped to full seed draw names ("Zizou Bergs"). Start with R1 players, then extend to seeds when they enter at R64.

---

## Phase 2: When the draw is released (1-2 days before tournament)

### 7. Create seed draw JSON

**File:** `backend/src/data/seedDraws/{tournament-id}.json`

Source: ATP official draw PDF. Structure:

```json
{
  "tournament": "rome-2026",
  "drawSize": 96,
  "seedsWithByes": 32,
  "rounds": ["R1", "R64", "R32", "R16", "QF", "SF", "F"],
  "matchesPerRound": { "R1": 32, "R64": 32, ... },
  "generatedAt": "2026-05-09T12:00:00Z",
  "source": "ATP Official Draw PDF",
  "seeds": [
    { "seed": 1, "name": "Player Name", "country": "ITA", "drawPos": 1 },
    ...
  ],
  "drawPositions": [
    { "pos": 1, "name": "Player Name", "seed": 1, "country": "ITA" },
    { "pos": 2, "name": null, "seed": null, "country": null, "bye": true },
    { "pos": 3, "name": null, "seed": null, "country": null, "qualifier": true },
    ...
  ]
}
```

Key rules for `drawPositions` (128 entries for a 96-draw):
- Consecutive pairs form matches (pos 1 vs 2, pos 3 vs 4, etc.)
- Byes: `{ "bye": true }` — no name, no seed
- Qualifiers not yet named: `{ "qualifier": true }` — no name
- Wild cards: `{ "seed": "WC" }`
- Protected ranking: `{ "seed": "PR" }`
- Lucky losers: `{ "seed": "LL" }`

### 8. Flip drawAvailable to true

**Frontend:** `frontend/src/data/tournaments.js` — set `drawAvailable: true`
**Backend:** `backend/src/data/tournaments.js` — set `drawAvailable: true`

### 9. Update player headshots

Check if new players in the draw are missing from the sprite sheet. If so:
- Get their ATP 4-char player ID
- Download headshots from ATP Tour CDN
- Regenerate sprite sheet (`frontend/public/headshots-sprite.webp` + manifest)

### 10. Test the draw loads

```bash
# Backend: check bracket returns data
curl -s "https://tennis-survivor-production.up.railway.app/api/draw/bracket?round=F" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Rounds: {d.get(\"rounds\")}, Matches: {len(d.get(\"matches\",[]))}')"

# Backend: check picks are available
curl -s "https://tennis-survivor-production.up.railway.app/api/picks/available?userId=test&groupId={groupId}&round=R1" | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Available players: {len(d.get(\"players\",[]))}')"
```

Expected: 95 rounds returned, ~280 matches, 32 available R1 players (non-bye, non-qualifier).

---

## Phase 3: Tournament starts (day of first match)

### 11. Set lock time overrides

Once the order of play is announced for each round, update `lockTimeOverrides` in `activeTournament.js`. Set each to 1 hour before the first match of that round.

```js
lockTimeOverrides: {
  R1:  '2026-05-11T08:00:00Z',  // 1h before first R1 match
  R64: '2026-05-13T08:00:00Z',  // update once OOP announced
  // ... fill in as each round's schedule is released
},
```

This is the most operationally critical step — if lock times are wrong, users can change picks after matches start.

### 12. Verify scraper data is flowing

```bash
curl -s "https://tennis-survivor-production.up.railway.app/api/health" | python3 -m json.tool
```

Look for `data_adapter.provider: "scraper"` and `fixtures_total > 0`. If the scraper hasn't posted yet, the system falls back to the static seed draw (picks work but no live results). Run the `flashscore-scraper` scheduled task manually to seed initial data.

### 13. Monitor the first few rounds

Watch for:
- Withdrawals: use `POST /api/admin/withdrawal` to handle mid-tournament withdrawals
- Round name mismatches: check if FlashScore round labels are being mapped correctly in the scraper task
- Lock time accuracy: verify picks are locked before first match of each round

---

## Phase 4: Tournament complete

### 14. Set tournament status to completed

**Frontend:** `frontend/src/data/tournaments.js` — set `status: 'completed'`
**Backend:** `backend/src/data/tournaments.js` — set `status: 'completed'`

### 15. Switch ACTIVE_TOURNAMENT

Update Railway env var to the next tournament's ID. The completed tournament's data remains in the database and is still viewable.

### 16. Verify winner detection

The leaderboard's `isWinner` flag is set automatically for the longest-surviving member(s). Check GroupHome shows the winner banner.

---

## Files changed per tournament (summary)

| File | What changes |
|---|---|
| `backend/src/config/activeTournament.js` | New tournament config block |
| `backend/src/data/tournaments.js` | New registry entry |
| `frontend/src/data/tournaments.js` | New registry entry |
| `backend/src/data/seedDraws/{id}.json` | New draw file (Phase 2) |
| Railway env: `ACTIVE_TOURNAMENT` | Switch to new ID |

Everything else (routes, components, data adapter, overlay) is reusable and doesn't change between tournaments.

---

## Common gotchas

1. **Lock times not set**: If `lockTimeOverrides` are all null, the system uses `roundDateFallbacks` which are estimates. Users could pick after matches start. Always set real lock times once the order of play is out.

2. **Scraper name mapping incomplete**: If players are appearing in FlashScore but not overlaying onto the seed draw, the name mapping in the scraper task is missing entries. Check Railway logs for unmatched player names and add to the mapping.

3. **Stale ACTIVE_TOURNAMENT**: Railway caches env vars. After changing, trigger a manual restart.

4. **Qualifier names**: Qualifiers are initially placeholder ("Qualifier 3"). Once qualifying finishes, update the seed draw JSON with real names and clear the seed draw cache (or restart backend).

5. **Draw size mismatch**: A 96-draw Masters has 128 draw positions (64 pairs, 32 of which are byes). A 128-draw Grand Slam has 128 draw positions with 0 byes. Make sure `drawSize`, `seedsWithByes`, and `drawPositions` array length are consistent.

6. **Round name mapping**: FlashScore uses labels like "1/64-finals", "1/32-finals" etc. If the draw shows 0 matches for a round, check the scraper task's round mapping is correct for the tournament format.
