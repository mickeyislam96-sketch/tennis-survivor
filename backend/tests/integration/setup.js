/**
 * Integration test setup helper.
 *
 * Resolves a Postgres test database in this priority:
 *   1. TEST_DATABASE_URL env var (set in CI; or by the dev locally)
 *   2. TEST_DB env var (alias)
 *   3. None — tests using requireTestDb() will be skipped with a clear note
 *
 * On request, applies the production schema (idempotent CREATE TABLE IF NOT
 * EXISTS) and returns a pg Pool ready for use. Provides cleanTables() to
 * truncate between tests so state doesn't leak.
 *
 * Local setup (one-off):
 *   docker run --rm -d --name fsv-test-pg \
 *     -e POSTGRES_DB=fsv_test -e POSTGRES_PASSWORD=test \
 *     -p 55432:5432 postgres:17-alpine
 *   export TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/fsv_test
 *   cd backend && npm test
 *
 * CI setup: see .github/workflows/tests.yml — runs a postgres service
 * container automatically.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA_PATH = path.join(__dirname, '..', '..', 'src', 'db', 'schema.sql');

let cachedPool = null;

export function getTestDatabaseUrl() {
  return process.env.TEST_DATABASE_URL || process.env.TEST_DB || null;
}

/**
 * Get a connected pg Pool with the schema applied. Returns null if no
 * TEST_DATABASE_URL is configured — caller should skip the test.
 */
export async function setupTestDb() {
  const url = getTestDatabaseUrl();
  if (!url) return null;

  if (cachedPool) return cachedPool;

  // Critical: route the production code's `pool` (imported by routes) at
  // the SAME connection so route handlers see the test DB. We do this by
  // setting DATABASE_URL before any route imports trigger db/pool.js.
  process.env.DATABASE_URL = url;

  const pool = new pg.Pool({ connectionString: url, max: 5 });

  try {
    await pool.query('SELECT 1');
  } catch (err) {
    throw new Error(`Cannot connect to TEST_DATABASE_URL=${url}: ${err.message}`);
  }

  const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
  await pool.query(schema);

  cachedPool = pool;
  return pool;
}

/**
 * Truncate all mutable tables. Call from beforeEach() so each test starts
 * with a clean slate. Order matters — child tables before parents.
 */
export async function cleanTables(pool) {
  if (!pool) return;
  // Order: child tables → parent. Use TRUNCATE ... CASCADE to be safe.
  await pool.query(`
    TRUNCATE TABLE
      admin_audit_log,
      emails_sent,
      picks,
      group_members,
      groups,
      users
    RESTART IDENTITY CASCADE;
  `);
}

/**
 * Helper: insert a user with a known UUID and email. Returns the user row.
 */
export async function createTestUser(pool, opts = {}) {
  const result = await pool.query(
    `INSERT INTO users (email, display_name)
     VALUES ($1, $2)
     RETURNING id::text, email, display_name`,
    [opts.email || `test-${Date.now()}@example.com`, opts.displayName || 'Test User']
  );
  return result.rows[0];
}

export async function teardown() {
  if (cachedPool) {
    await cachedPool.end();
    cachedPool = null;
  }
}
