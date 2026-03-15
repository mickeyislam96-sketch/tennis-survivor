# Miami Open 2026 — Launch Checklist

Run through this on **March 16** once the draw drops (usually mid-morning US time).
Everything below is a code change + one Railway env var update.

---

## 1. Railway — swap tournament key

In the Railway dashboard → Final Serve-ivor backend → Variables:

| Variable | Old value | New value |
|---|---|---|
| `INDIAN_WELLS_TOURNAMENT_KEY` | Indian Wells key | **Miami Open key** (from API-Tennis dashboard) |

Redeploy after saving.

---

## 2. backend/src/data/tournaments.js

```js
// miami-2026 entry:
status: 'active',       // was 'upcoming'
drawDate: 'March 16, 2026',
drawAvailable: true,    // was false
```

---

## 3. frontend/src/data/tournaments.js

```js
// miami-2026 entry:
status: 'active',       // was 'upcoming'
drawDate: '2026-03-16',
drawAvailable: true,    // was false
bracketWidget: 'SOFASCORE_MIAMI_WIDGET_URL',  // uncomment + paste URL from SofaScore
```

To find the SofaScore widget URL:
1. Go to sofascore.com → Miami Open 2026 men's singles bracket
2. Click Share → Embed → copy the `src` URL from the iframe

---

## 4. Verify after deploy

- [ ] Group home for Miami members shows the main dashboard (not pre-launch join view)
- [ ] DrawViewer shows the bracket / SofaScore widget
- [ ] PickScreen shows player list (not "picks not open yet")
- [ ] Leaderboard loads for the Miami group
- [ ] Pick window countdown is counting down correctly (locks ~30 min before first R1 match)
- [ ] Welcome email fires when a new account is created
- [ ] Tournament join email fires when someone joins the Miami group

---

## 5. Day-of comms (optional)

Send a WhatsApp / message to the group with:
- The group link
- Reminder that picks need to be in before the first match

---

## Notes

- The API date window in `tennisData.js` is already set to Miami dates (March 16–30) ✓
- The fallback schedule in `tennisData.js` is already set to Miami approximate dates ✓
- `tennisData.js` still imports the Indian Wells mock as fallback — safe to leave; once the real Miami API key is set, live data takes over
