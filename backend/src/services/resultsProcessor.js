/**
 * Automated results processor.
 * Polls the draw for completed matches and updates picks + group_members.
 * Idempotent — safe to run multiple times for the same round.
 */
import { pool } from '../db/pool.js';
import { getDraw, getDeadlines } from './tennisData.js';
import { TOURNAMENT, ROUNDS } from '../config/tournament.js';
import { sendRoundResultEmail, sendWinnerAnnouncementEmail } from '../utils/email.js';
import { getAllTournaments } from '../data/tournaments.js';
import { detectWinner } from '../routes/leaderboard.js';
import { logOps } from './opsMonitor.js';
/**
 * A match is "decided" if it has a winner, regardless of how it ended.
 * Covers: completed (normal win), retired (opponent retired mid-match),
 * walkover (opponent withdrew before/during match).
 */
const DECIDED_STATUSES = new Set(['completed', 'retired', 'walkover']);
function isMatchDecided(m) {
  return DECIDED_STATUSES.has(m.status) && m.winnerId;
}


/**
 * Process results for a single round.
 * Marks picks survived=true/false, eliminates members who picked losers.
 */
export async function processRoundResults(round) {
  console.log(`[results] Processing ${round}...`);
  const draw = await getDraw(round);
  const completed = (draw.matches || []).filter(
    (m) => m.round === round && isMatchDecided(m)
  );

  if (completed.length === 0) {
    console.log(`[results] No decided matches for ${round}`);
    return { round, processed: 0, picksUpdated: 0, eliminated: 0 };
  }

  const outcomes = completed.map((m) => ({
    winnerId: m.winnerId,
    loserId: m.winnerId === m.player1Id ? m.player2Id : m.player1Id,
  }));

  let picksUpdated = 0;
  let eliminated = 0;

  for (const { winnerId, loserId } of outcomes) {
    const w = await pool.query(
      `UPDATE picks SET survived = true WHERE round = $1 AND player_id = $2 AND survived IS NULL AND tournament_id = $3`,
      [round, winnerId, TOURNAMENT.id]
    );
    picksUpdated += w.rowCount;

    const l = await pool.query(
      `UPDATE picks SET survived = false WHERE round = $1 AND player_id = $2 AND survived IS NULL AND tournament_id = $3`,
      [round, loserId, TOURNAMENT.id]
    );
    picksUpdated += l.rowCount;

    const e = await pool.query(
      `UPDATE group_members gm
         SET is_alive = false, eliminated_round = $1
         FROM picks p
         JOIN groups g ON g.id = p.group_id
        WHERE p.round = $1
          AND p.player_id = $2
          AND p.survived = false
          AND p.user_id = gm.user_id
          AND p.group_id = gm.group_id
          AND gm.is_alive = true
          AND g.tournament_id = $3`,
      [round, loserId, TOURNAMENT.id]
    );
    eliminated += e.rowCount;
  }

  // Send round result emails for all picks that now have a result.
  // sendWithDedup ensures each user only gets one email per round,
  // even if this function runs multiple times.
  await sendResultEmails(round);

  const nonPickers = await eliminateNonPickers(round);
  console.log(`[results] ${round}: ${completed.length} matches, ${picksUpdated} picks updated, ${eliminated} eliminated, ${nonPickers} non-pickers removed`);

  // Log to persistent ops log (only when something actually happened)
  if (picksUpdated > 0 || eliminated > 0 || nonPickers > 0) {
    await logOps('results', 'processed', {
      round,
      matchesCompleted: completed.length,
      picksUpdated,
      eliminated,
      nonPickers,
    });
  }

  return { round, processed: completed.length, picksUpdated, eliminated, nonPickers };
}

/**
 * Auto-detect and process all rounds with completed-but-unprocessed results.
 * Safe to call on a schedule.
 */
export async function autoProcessResults() {
  console.log('[results] Auto-processing...');
  const draw = await getDraw();
  const summary = [];

  for (const round of ROUNDS) {
    const completed = (draw.matches || []).filter(
      (m) => m.round === round && isMatchDecided(m)
    );
    if (completed.length === 0) continue;

    const { rows } = await pool.query(
      `SELECT COUNT(*) FROM picks WHERE round = $1 AND survived IS NULL AND tournament_id = $2`,
      [round, TOURNAMENT.id]
    );
    if (Number(rows[0].count) === 0) continue;

    console.log(`[results] ${round}: ${rows[0].count} unprocessed picks found`);
    const result = await processRoundResults(round);
    summary.push(result);
  }

  // Defence in depth: even if no rounds had NULL picks, sync any
  // already-resolved picks whose member is_alive flag drifted. Cheap.
  const synced = await syncGroupMembersFromPicks();
  if (synced > 0) {
    summary.push({ round: 'sync', eliminated: synced });
  }

  // Defence-in-depth: any tournament that has flipped to status=completed
  // gets a winner-announcement email queued for its unique survivor. Idempotent
  // — sendWithDedup ensures one email per (user, group, round, type).
  try {
    const { queued } = await processCompletedTournaments();
    if (queued > 0) summary.push({ winnerEmailsQueued: queued });
  } catch (err) {
    console.error('[results] processCompletedTournaments error:', err.message);
  }

  if (summary.length === 0) console.log('[results] Nothing to process.');
  return summary;
}

/**
 * Queue winner-announcement emails for any tournament that has just been
 * marked completed and has a unique winner.
 *
 * Per Option B (Mickey, 2026-05-15) winner detection is gated by
 * tournament.status === 'completed'. Tournament status is date-driven via
 * computeStatus() — flips at end-of-endDate UTC — so this function naturally
 * fires on the first cron tick after the tournament ends.
 *
 * Restricted to tournaments ending within the last 7 days so older completed
 * events don't get retroactive emails. Idempotent via emails_sent UNIQUE.
 *
 * Returns { queued } — number of new emails queued this run.
 */
export async function processCompletedTournaments() {
  const FRESH_WINDOW_DAYS = 7;
  const cutoffMs = Date.now() - FRESH_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  let queued = 0;

  for (const t of getAllTournaments()) {
    if (t.status !== 'completed') continue;
    const endTs = new Date(t.endDate).getTime();
    if (Number.isNaN(endTs) || endTs < cutoffMs) continue;

    const { rows: groups } = await pool.query(
      `SELECT id, prize_pool_cents FROM groups WHERE tournament_id = $1`,
      [t.id]
    );
    if (groups.length === 0) continue;

    for (const g of groups) {
      const { rows: members } = await pool.query(
        `SELECT gm.user_id, gm.is_alive, gm.eliminated_round,
                u.display_name, u.email,
                (SELECT COUNT(*)::int FROM picks p
                  WHERE p.user_id = gm.user_id
                    AND p.group_id = gm.group_id
                    AND p.survived = true) AS survived_rounds
           FROM group_members gm
           JOIN users u ON u.id = gm.user_id
          WHERE gm.group_id = $1`,
        [g.id]
      );
      if (members.length < 2) continue;

      const decorated = members.map(m => ({
        userId: m.user_id,
        displayName: m.display_name,
        email: m.email,
        isAlive: m.is_alive,
        eliminatedRound: m.eliminated_round,
        survivedRounds: Number(m.survived_rounds) || 0,
      }));

      const alive = decorated.filter(m => m.isAlive)
        .sort((a, b) => b.survivedRounds - a.survivedRounds);
      const eliminated = decorated.filter(m => !m.isAlive)
        .sort((a, b) => b.survivedRounds - a.survivedRounds);

      const { hasWinner, winners } = detectWinner({
        alive, eliminated, members: decorated, tournamentCompleted: true,
      });
      if (!hasWinner || winners.length !== 1) continue;

      const winner = winners[0];
      if (!winner.email) {
        console.warn(`[winner-email] Skip: winner has no email | group=${g.id}`);
        continue;
      }

      // Find their best representative pick — prefer F, fall back to deepest
      // round survived. Matches the spirit of "your winning pick that crowned you".
      const { rows: pickRows } = await pool.query(
        `SELECT player_name, round FROM picks
          WHERE user_id = $1 AND group_id = $2 AND survived = true
          ORDER BY CASE round
            WHEN 'F'   THEN 0
            WHEN 'SF'  THEN 1
            WHEN 'QF'  THEN 2
            WHEN 'R16' THEN 3
            WHEN 'R32' THEN 4
            WHEN 'R64' THEN 5
            WHEN 'R1'  THEN 6
            ELSE 99 END
          LIMIT 1`,
        [winner.userId, g.id]
      );
      const winningPickName = pickRows[0]?.player_name || 'your final pick';

      try {
        const result = await sendWinnerAnnouncementEmail({
          userId: winner.userId,
          groupId: g.id,
          email: winner.email,
          displayName: winner.displayName,
          tournamentName: t.name,
          tournamentShortName: t.shortName,
          winningPickName,
          roundCount: winner.survivedRounds,
          memberCount: decorated.length,
          prizePoolCents: g.prize_pool_cents || 0,
        });
        if (result.queued) {
          queued++;
          console.log(`[winner-email] Queued for ${winner.email} | tournament=${t.id} | group=${g.id}`);
        }
      } catch (err) {
        console.error(`[winner-email] Failed for ${winner.email}: ${err.message}`);
      }
    }
  }

  if (queued > 0) {
    await logOps('results', 'winner_announced', { queued });
  }
  return { queued };
}

/**
 * Eliminate group members who did not submit a pick for a round.
 * Called after a round locks — anyone still alive with no pick is out.
 */
export async function eliminateNonPickers(round) {
  // Guard: do not eliminate non-pickers if the pick window is still open
  try {
    const deadlines = await getDeadlines();
    const roundDeadline = deadlines.find(d => d.round === round);
    if (roundDeadline && !roundDeadline.isLocked) {
      console.log(`[results] Skipping non-picker elimination for ${round} — pick window still open`);
      return 0;
    }
  } catch (err) {
    console.warn(`[results] Could not check deadline for ${round}, proceeding cautiously:`, err.message);
    // If we can't verify the deadline, skip elimination to be safe
    return 0;
  }

  console.log(`[results] Eliminating non-pickers for ${round}...`);
  const result = await pool.query(
    `UPDATE group_members gm
        SET is_alive = false, eliminated_round = $1
       FROM groups g
      WHERE g.id = gm.group_id
        AND g.tournament_id = $2
        AND gm.is_alive = true
        AND NOT EXISTS (
          SELECT 1 FROM picks p
           WHERE p.group_id = gm.group_id
             AND p.user_id  = gm.user_id
             AND p.round    = $1
        )`,
    [round, TOURNAMENT.id]
  );
  console.log(`[results] ${round}: ${result.rowCount} non-pickers eliminated`);
  return result.rowCount;
}

/**
 * Sync group_members.is_alive from picks.survived.
 *
 * History (2026-05-09 incident — see CLAUDE.md session 38):
 * processRoundResults updates picks.survived AND group_members.is_alive in
 * the same call. But autoProcessResults SKIPS rounds where the NULL-pick
 * count is zero. So once every member's current-round pick is resolved,
 * the round is skipped — leaving any group_member whose pick lost but
 * whose is_alive flag wasn't flipped (e.g. due to ordering, retries, or
 * manual reset-member calls) permanently mis-marked as alive.
 *
 * The Rome 2026 R64 case: Rafa picked de Minaur, who lost; pick.survived
 * went to false but is_alive stayed true. /api/leaderboard reported the
 * stale state; /api/pools.aliveCount disagreed with the leaderboard.
 *
 * This function runs every cron tick. Idempotent — if there's nothing to
 * sync, it's a single SELECT that returns zero. Cheap insurance.
 */
export async function syncGroupMembersFromPicks() {
  try {
    const result = await pool.query(
      `UPDATE group_members gm
          SET is_alive = false,
              eliminated_round = COALESCE(gm.eliminated_round, p.round)
         FROM picks p
         JOIN groups g ON g.id = p.group_id
        WHERE p.survived = false
          AND p.user_id  = gm.user_id
          AND p.group_id = gm.group_id
          AND gm.is_alive = true
          AND g.tournament_id = $1`,
      [TOURNAMENT.id]
    );
    if (result.rowCount > 0) {
      console.log(`[results] syncGroupMembersFromPicks: flipped ${result.rowCount} member(s) to is_alive=false`);
      await logOps('results', 'sync_alive', { eliminated: result.rowCount });
    }
    return result.rowCount;
  } catch (err) {
    console.error('[results] syncGroupMembersFromPicks error:', err.message);
    return 0;
  }
}

/**
 * Send round result emails for all resolved picks in a round.
 * Uses sendWithDedup — safe to call repeatedly; duplicates are impossible.
 */
async function sendResultEmails(round) {
  try {
    const { rows } = await pool.query(
      `SELECT p.user_id, p.group_id, p.player_name, p.survived,
              u.email, u.display_name
         FROM picks p
         JOIN users u ON u.id = p.user_id
         JOIN groups g ON g.id = p.group_id
        WHERE p.round = $1
          AND p.survived IS NOT NULL
          AND u.email IS NOT NULL
          AND g.tournament_id = $2`,
      [round, TOURNAMENT.id]
    );

    let sent = 0;
    for (const row of rows) {
      try {
        const result = await sendRoundResultEmail({
          userId: row.user_id,
          groupId: row.group_id,
          round,
          email: row.email,
          displayName: row.display_name,
          playerName: row.player_name,
          survived: row.survived,
        });
        if (result.sent || result.queued) sent++;
      } catch (err) {
        // Non-fatal — log and continue to next user
        console.error(`[results-email] Failed for ${row.email}: ${err.message}`);
      }
    }
    console.log(`[results-email] ${round}: ${sent} result emails queued (${rows.length} total picks)`);
  } catch (err) {
    // Non-fatal — don't let email failures break results processing
    console.error(`[results-email] Error querying picks for ${round}: ${err.message}`);
  }
}

/**
 * Sweep every locked round for non-pickers and eliminate them.
 *
 * Without this, non-picker elimination only fires when the round's
 * first match completes (because it's a sub-step of processRoundResults).
 * That creates a window of 1-2 hours where a user who didn't pick
 * still appears alive on the leaderboard. Calling this on the 15-min
 * cron closes that window — within 15 mins of a round locking, every
 * non-picker is removed.
 *
 * The eliminateNonPickers function itself guards against running
 * while the round is open, so this is safe to call repeatedly.
 *
 * Returns the total number of non-pickers eliminated across all
 * rounds in this sweep.
 */
export async function sweepLockedRoundNonPickers() {
  let total = 0;
  try {
    const deadlines = await getDeadlines();
    if (!Array.isArray(deadlines)) return 0;
    for (const d of deadlines) {
      if (d.isLocked && d.round) {
        const n = await eliminateNonPickers(d.round);
        total += n;
        if (n > 0) {
          console.log(`[results] sweep: eliminated ${n} non-pickers for locked round ${d.round}`);
        }
      }
    }
  } catch (err) {
    console.error('[results] sweepLockedRoundNonPickers error:', err.message);
  }
  return total;
}

