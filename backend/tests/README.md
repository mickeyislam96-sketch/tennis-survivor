# Backend test suite

Two layers, by directory:

## `tests/smoke/`

Black-box tests that hit the **live production API**. They catch:

- Endpoints returning unexpected shapes after a deploy
- The case-sensitivity class of bug (invite round-trip)
- Scraper or DB outages (via `/api/health`)
- Auth/rate-limit regressions

Run with:

```bash
npm run test:smoke
```

Run automatically by `scripts/smoke.sh` — these tests are the structured
counterpart to the bash smoke script, callable from Vitest with proper
assertions and CI-friendly exit codes.

## `tests/integration/` (TODO — not yet wired)

DB-backed tests that spin up an in-memory or Docker Postgres, seed
fixtures, and exercise mutations (create pool, join, pick, eliminate,
reset). These run **before push** and catch regressions in code paths
the smoke suite can't safely test on production.

The plan, to be tackled in the 4-day window between Rome final and
Roland Garros R1:

1. Add `pg-mem` (in-memory Postgres) or `testcontainers` (Docker pg)
   as a devDependency.
2. Extract schema from `backend/src/db/init.js` into a reusable
   `setupTestDb()` helper.
3. Migrate the highest-value cases — invite-create-roundtrip, payment
   gate, picks-available, leaderboard math, withdrawal, reset-member —
   from smoke to proper integration with mutating fixtures.
4. Wire `npm test` into a pre-push git hook.

Until then, smoke tests + the validator (`scripts/validate-tournament.mjs`)
+ the bash smoke (`scripts/smoke.sh`) are the safety net.

## Running tests

```bash
# All tests (currently just smoke)
npm test

# Smoke only
npm run test:smoke

# Watch mode (rerun on file change)
npm run test:watch
```

## Adding a new smoke test

Create `tests/smoke/<name>.test.js`:

```js
import { test, expect } from 'vitest';

const API = process.env.SMOKE_API || 'https://tennis-survivor-production.up.railway.app';

test('description of what should hold', async () => {
  const res = await fetch(`${API}/api/some-endpoint`);
  expect(res.status).toBe(200);
  const data = await res.json();
  expect(data.someField).toBeDefined();
});
```

Override the target with `SMOKE_API=https://staging.example bash` once
staging exists.
