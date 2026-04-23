# Adding a New Tournament Pool

This guide walks through everything needed to launch a new Final Serve-ivor pool for an upcoming ATP event.

---

## 1. Add the tournament to the registry

Open `backend/src/data/tournaments.js` and add a new entry to the `TOURNAMENTS` array.

```js
{
  id: 'madrid-2026',           // kebab-case, unique — used as foreign key
  name: 'Mutua Madrid Open',   // full official name
  shortName: 'Madrid',         // used in UI chips and labels
  year: 2026,
  tourLevel: 'ATP Masters 1000',
  startDate: '2026-04-24',     // YYYY-MM-DD, first day of qualifying/R64
  endDate:   '2026-05-04',
  location:  'Madrid, Spain',
  surface:   'Clay (outdoor)',
  status:    'upcoming',       // 'upcoming' | 'active' | 'completed'
  drawAvailable: false,        // set to true once the draw is released
  pickWindowOpen:  null,       // ISO timestamp or null
  pickWindowClose: null,       // ISO timestamp or null
}
```

Copy the same entry into `frontend/src/data/tournaments.js` — the two files must stay in sync until a shared data layer is wired up.

---

## 2. Add a pool (group) to mock data

Open `backend/src/data/mockGroups.js` and add to the `MOCK_GROUPS` array:

```js
{
  id: 'g3',                        // unique group ID
  name: 'Madrid Open 2026 Pool',
  inviteCode: 'MADRID-2026',       // uppercase, URL-safe
  entryFeeCents: 500,              // 0 for free pools
  prizePoolCents: 0,               // 0 until entries confirmed
  tournamentId: 'madrid-2026',     // must match tournament id above
  adminUserId: 'u1',
  createdAt: new Date().toISOString(),
}
```

No members or picks are needed — the pool starts empty.

---

## 3. Update tournament status when play begins

When the tournament goes live, change `status` to `'active'` in both
`backend/src/data/tournaments.js` and `frontend/src/data/tournaments.js`.

Also set `drawAvailable: true` once the draw is published (usually 1–2 days
before the first match). This flips the Draw page from the TBC banner to the
live bracket view automatically.

---

## 4. Set pick windows (optional)

Pick windows control when users can submit picks for each round. They're
currently managed inside `backend/src/services/tennisData.js` via the
`getDeadlines()` function. For now, the system calculates deadlines
automatically based on match schedules fetched from the live API.

To override with manual times, set `pickWindowOpen` and `pickWindowClose`
on the tournament object. These fields are reserved for future use once the
database layer (Supabase) is connected.

---

## 5. Deploy

```bash
git add backend/src/data/tournaments.js \
        backend/src/data/mockGroups.js \
        frontend/src/data/tournaments.js
git commit -m "feat: add [Tournament Name] [Year] pool"
git push
```

Railway and Vercel deploy automatically on push. The new pool appears on the
home lobby within ~60 seconds.

---

## Future: Supabase database

Once the Supabase schema (`database/schema.sql`) is active, all of the above
will be done through database inserts rather than editing source files. The
`tournaments` and `pools` tables in the schema map directly to the data
structures described here.
