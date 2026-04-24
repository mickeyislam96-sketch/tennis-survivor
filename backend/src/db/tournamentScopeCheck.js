/**
 * Startup check: verify all picks and emails_sent rows have tournament_id.
 * Logs a warning if any rows are missing — indicates a code path that
 * forgot to include tournament_id on INSERT.
 *
 * Also backfills any missing values from the groups table.
 */
import { pool } from './pool.js';

export async function checkTournamentScoping() {
  try {
    // Backfill any missing tournament_id from groups (idempotent)
    const backfillPicks = await pool.query(
      `UPDATE picks SET tournament_id = g.tournament_id
         FROM groups g
        WHERE g.id = picks.group_id
          AND picks.tournament_id IS NULL`
    );
    if (backfillPicks.rowCount > 0) {
      console.warn(`⚠️  [tournament-scope] Backfilled ${backfillPicks.rowCount} picks with missing tournament_id`);
    }

    const backfillEmails = await pool.query(
      `UPDATE emails_sent SET tournament_id = g.tournament_id
         FROM groups g
        WHERE g.id = emails_sent.group_id
          AND emails_sent.tournament_id IS NULL`
    );
    if (backfillEmails.rowCount > 0) {
      console.warn(`⚠️  [tournament-scope] Backfilled ${backfillEmails.rowCount} emails_sent with missing tournament_id`);
    }

    // Check for any remaining nulls (shouldn't happen after backfill)
    const { rows: pickNulls } = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE tournament_id IS NULL`
    );
    const { rows: emailNulls } = await pool.query(
      `SELECT COUNT(*) FROM emails_sent WHERE tournament_id IS NULL`
    );

    const pn = Number(pickNulls[0].count);
    const en = Number(emailNulls[0].count);

    if (pn > 0 || en > 0) {
      console.error(`🔴 [tournament-scope] ${pn} picks and ${en} emails_sent rows still have NULL tournament_id after backfill`);
    } else {
      console.log('✅ [tournament-scope] All picks and emails_sent have tournament_id');
    }
  } catch (err) {
    // Non-fatal — column might not exist yet (first deploy)
    if (err.message.includes('column "tournament_id" does not exist')) {
      console.log('[tournament-scope] Columns not yet created — will be added by schema migration');
    } else {
      console.warn('[tournament-scope] Check failed:', err.message);
    }
  }
}
