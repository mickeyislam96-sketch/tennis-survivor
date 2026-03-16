# Miami Open 2026 — Launch Checklist

---

## ✅ Already done (committed to main)

- `frontend/src/data/tournaments.js` — Miami flipped to `status: 'active'`, `drawAvailable: true`
- `backend/src/data/tournaments.js` — same
- `tennisData.js` — API date window set to Miami (Mar 16–30), fallback schedule set to Miami dates
- Entry closing now controlled by `entryOpen` flag only — not by status

---

## 🔴 Do NOW (March 16 — draw is out)

### 1. Railway — swap tournament key

In Railway → Final Serve-ivor backend → Variables:

| Variable | Set to |
|---|---|
| `INDIAN_WELLS_TOURNAMENT_KEY` | **Miami Open key** (from API-Tennis dashboard) |

Redeploy after saving. This is what makes live draw data appear.

### 2. SofaScore bracket widget (optional but nice)

1. Go to sofascore.com → Miami Open 2026 men's singles draw
2. Click Share → Embed → copy the iframe `src` URL
3. In `frontend/src/data/tournaments.js`, uncomment `bracketWidget` and paste the URL
4. Push to main

Without this, the draw viewer falls back to the custom built bracket — still works, just no SofaScore widget.

---

## 🟡 Do on March 19 (tournament starts, final entry cutoff)

In `frontend/src/data/tournaments.js`:
```js
// miami-2026:
entryOpen: false,   // closes the "Join this group" button for non-members
```

Push to main.

---

## ✅ Verify after Railway redeploy

- [ ] Group home for Miami members shows dashboard (not pre-launch view)
- [ ] DrawViewer shows bracket with player names (not "draw not released")
- [ ] PickScreen shows player list and round tabs
- [ ] Pick window countdown shows correctly (picks lock ~30 min before first match)
- [ ] Leaderboard loads
- [ ] Non-members see "Join this group" button (until March 19)

---

## Notes

- API data fallback: if Railway key isn't set yet, the app falls back to Indian Wells mock data — draw will show Indian Wells names. Fix by setting the Railway env var.
- The soft launch group invite link is the cleanest way to onboard friends — they land on `/join/CODE` which handles auth + join in one step.
