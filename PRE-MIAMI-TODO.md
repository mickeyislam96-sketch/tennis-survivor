# Pre-Miami Launch Checklist
**Goal: register → join Miami pool (£20 waived) → draw → picks → leaderboard — all working.**
**Tournament starts: March 19. Draw expected: ~March 16.**

---

## 🔴 Do Now

### 1. Upgrade Railway
Trial shows "27 days or $4.95 left". Miami runs to March 30 — don't risk the backend dying mid-tournament.
> Railway → project → Billing → upgrade to Starter

### 2. Set Gmail env vars in Railway
Registration emails are silently failing right now. New users won't get a welcome email.
> Railway → your service → Variables → add:
```
GMAIL_USER=your.gmail@gmail.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx
```
Test by registering a fresh email and checking the inbox.

---

## 🟠 Do on March 16 (Launch Day)

These all need to go out together in one push — they're the gate between "upcoming" and "live".

### 3. Flip tournament config (two files, keep in sync)

**`frontend/src/data/tournaments.js`** — Miami entry:
```js
status: 'active',
drawAvailable: true,
entryOpen: true,           // removes the lock screen
bracketWidget: '<SofaScore URL>',  // get from SofaScore embed tool
// remove entryOpenDate and entryClosedReason
```

**`backend/src/data/tournaments.js`** — Miami entry:
```js
status: 'active',
drawAvailable: true,
```

### 4. Update Miami mock group to show £20 entry
`backend/src/data/mockGroups.js` — group g2:
```js
entryFeeCents: 2000,        // shows £20 on the join page
prizePoolCents: 20000,      // prize pool grows as people join
```
Since there's no payment processing wired up yet, joining works for free regardless of what this shows.
Add a one-line note to `frontend/src/pages/JoinGroup.jsx` join disclaimer:
> "Beta test — entry fee waived for this tournament. No payment will be taken."

### 5. Swap the API tournament key in Railway
> Railway → Variables → update `TOURNAMENT_KEY` (or `INDIAN_WELLS_TOURNAMENT_KEY`) to the Miami key from API-Tennis.
Without this, the backend keeps fetching Indian Wells fixtures and the draw/pick grading will be wrong.

### 6. Update `tennisData.js` for Miami
Two things in `backend/src/services/tennisData.js`:

**a) Fetch date range** — in `fetchApiDraw()`:
```js
const dateStart = '2026-03-19';
const dateStop  = '2026-03-30';
```

**b) ROUND_DATE_FALLBACK** — replace Indian Wells dates:
```js
const ROUND_DATE_FALLBACK = {
  R1:  '2026-03-19T11:00:00Z',
  R64: '2026-03-20T11:00:00Z',
  R32: '2026-03-22T11:00:00Z',
  R16: '2026-03-24T11:00:00Z',
  QF:  '2026-03-26T11:00:00Z',
  SF:  '2026-03-28T11:00:00Z',
  F:   '2026-03-30T11:00:00Z',
};
```
Without this, pick window countdowns will show wrong times once Miami is live.

---

## 🟡 Before Sharing the Link

### 7. Add pick window countdown to GroupHome
The group home page fetches `openRoundDeadline` and `openRoundOpensAt` from the API but doesn't visibly render a countdown. Users landing on the group page have no indication whether they need to make a pick.
Add the same amber/blue countdown cards from PickScreen to the group dashboard — it's one of the first things people will look for.

### 8. End-to-end test (do this yourself before sending the link)
Walk through the full journey with a fresh email address:
- [ ] Register a new account → welcome email arrives
- [ ] See Miami pool in lobby
- [ ] Join the pool → "Beta: entry fee waived" notice shows
- [ ] Wait for R1 pick window → make a pick
- [ ] Check leaderboard shows your pick
- [ ] Check draw viewer shows the bracket
- [ ] Verify pick locks correctly 1h before first match

### 9. Mobile check
Friends will mostly use their phones. Open the site on iOS/Android and run through the join → pick flow. Fix anything broken before you share the link.

---

## 🟢 Nice to Have

### 10. Scores on match cards
`DrawViewer.jsx` — `event_final_result` is already returned by the API but not displayed.
Shows the score next to completed matches so users can see results without leaving the app.
Not critical for launch but would make the draw feel live rather than just a bracket.

---

## Summary

| # | Task | When | Status |
|---|------|------|--------|
| 1 | Upgrade Railway trial | Now | ☐ |
| 2 | Set Gmail env vars in Railway | Now | ☐ |
| 3 | Flip tournament config (both files) | March 16 | ☐ |
| 4 | Set Miami mock group to £20 + waived note | March 16 | ☐ |
| 5 | Swap API tournament key in Railway | March 16 | ☐ |
| 6 | Update tennisData.js dates for Miami | March 16 | ☐ |
| 7 | Add pick countdown to GroupHome | Before sharing | ☐ |
| 8 | End-to-end test run | Before sharing | ☐ |
| 9 | Mobile check | Before sharing | ☐ |
| 10 | Scores on match cards | If time allows | ☐ |
