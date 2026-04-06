/**
 * Email scheduler — runs on the existing 15-minute cron.
 * Checks for pick reminders that need sending.
 *
 * All emails go through sendWithDedup, so this is safe to run
 * repeatedly — duplicates are impossible.
 */
import { pool } from '../db/pool.js';
import { getDeadlines } from './tennisData.js';
import { TOURNAMENT } from '../config/tournament.js';
import { sendPickReminderEmail } from '../utils/email.js';

const REMINDER_WINDOW_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Check all rounds and send pick reminders where needed.
 * A reminder is sent when:
 *   1. The round is currently open (not yet locked)
 *   2. Lock time is within 24 hours from now
 *   3. The user is alive in the group
 *   4. The user has not submitted a pick for this round
 *   5. We haven't already sent them a reminder (dedup table)
 */
export async function checkPickReminders() {
  try {
    const deadlines = await getDeadlines();
    const now = new Date();

    for (const d of deadlines) {
      if (!d.isOpen || !d.lockAt) continue;

      const lockTime = new Date(d.lockAt);
      const msUntilLock = lockTime.getTime() - now.getTime();

      // Only send reminders when lock is within 24h (and hasn't passed)
      if (msUntilLock <= 0 || msUntilLock > REMINDER_WINDOW_MS) continue;

      await sendRemindersForRound(d.round, d.lockAt);
    }
  } catch (err) {
    console.error('[pick-reminder] Error checking reminders:', err.message);
  }
}

async function sendRemindersForRound(round, lockAt) {
  // Find alive members who have no pick for this round
  const { rows } = await pool.query(
    `SELECT gm.user_id, gm.group_id, gm.display_name,
            u.email, g.name AS group_name
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       JOIN groups g ON g.id = gm.group_id
      WHERE gm.is_alive = true
        AND u.email IS NOT NULL
        AND g.tournament_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM picks p
           WHERE p.user_id = gm.user_id
             AND p.group_id = gm.group_id
             AND p.round = $1
        )`,
    [round, TOURNAMENT.id]
  );

  if (rows.length === 0) return;

  let sent = 0;
  for (const row of rows) {
    try {
      const result = await sendPickReminderEmail({
        userId: row.user_id,
        groupId: row.group_id,
        round,
        email: row.email,
        displayName: row.display_name,
        groupName: row.group_name,
        lockAt,
      });
      if (result.queued) sent++;
    } catch (err) {
      console.error(`[pick-reminder] Failed for ${row.email}: ${err.message}`);
    }
  }
  console.log(`[pick-reminder] ${round}: ${sent} reminders processed (${rows.length} unpicked members)`);
}
