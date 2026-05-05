/**
 * DB-backed regression test for the case-sensitivity invite bug.
 *
 * On 5 May 2026, POST /api/groups generated invite codes containing
 * lowercase letters in the suffix while GET /api/groups/invite/:code
 * uppercased the URL parameter and ran a case-sensitive WHERE. Result:
 * silent 404 on roughly half of all generated codes.
 *
 * This test creates a real group via the production code path, then
 * looks up the resulting invite code in three case forms — all three
 * must return the group. If a future change reintroduces the bug, this
 * fails before merge.
 *
 * Skipped automatically if TEST_DATABASE_URL is not set so smoke tests
 * keep running in environments without a test DB.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, cleanTables, teardown, getTestDatabaseUrl, createTestUser } from './setup.js';

const skipIfNoDb = getTestDatabaseUrl() ? describe : describe.skip;

skipIfNoDb('invite-link round-trip (DB-backed)', () => {
  let app;
  let dbPool;
  let user;

  beforeAll(async () => {
    dbPool = await setupTestDb();
    // Import the test app AFTER setupTestDb has set DATABASE_URL so the
    // production code points at the test DB.
    const { buildTestApp } = await import('./testApp.js');
    app = buildTestApp();
  });

  beforeEach(async () => {
    await cleanTables(dbPool);
    user = await createTestUser(dbPool);
  });

  afterAll(async () => {
    await teardown();
  });

  it('round-trips the invite code in as-stored, uppercase, and lowercase forms', async () => {
    // Create a pool via the production endpoint
    const createRes = await request(app)
      .post('/api/groups')
      .set('x-user-id', user.id)
      .send({
        name: 'Roundtrip Test Pool',
        tournamentId: 'rome-2026',
        adminUserId: user.id,
      });

    expect(createRes.status, `create returned ${createRes.status}: ${JSON.stringify(createRes.body)}`).toBe(201);
    const code = createRes.body.inviteCode;
    expect(code).toBeTruthy();

    // Now look it up three ways. All three must return the same group.
    for (const form of [code, code.toUpperCase(), code.toLowerCase()]) {
      const lookup = await request(app).get(`/api/groups/invite/${form}`);
      expect(lookup.status, `lookup of ${form} returned ${lookup.status}`).toBe(200);
      expect(lookup.body.id).toBe(createRes.body.id);
    }
  });

  it('returns 404 for a code that does not exist', async () => {
    const lookup = await request(app).get('/api/groups/invite/DEFINITELY-NOT-A-REAL-CODE-12345');
    expect(lookup.status).toBe(404);
  });
});
