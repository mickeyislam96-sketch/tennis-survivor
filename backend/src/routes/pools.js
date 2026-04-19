/**
 * GET /api/pools
 * Returns all available tournament pools enriched with tournament metadata
 * and the requesting user's membership status.
 *
 * Merges real DB groups with mock groups (mock groups serve as the
 * "official" demo pools visible in the lobby).
 */
import { Router } from 'express';
import { optionalAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';
import { getTournament } from '../data/tournaments.js';

export const poolsRouter = Router();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

poolsRouter.get('/', async (req, res) => {
  const userId = req.userId || req.query.userId;  // JWT or legacy

  // ── Real DB groups ────────────────────────────────────────────────────────
  let dbPools = [];
  try {
    const result = await pool.query(
      `SELECT
         g.id::text,
         g.name,
         g.invite_code,
         g.entry_fee_cents,
         g.prize_pool_cents,
         g.tournament_id,
         COUNT(m.id) AS member_count,
         COUNT(m.id) FILTER (WHERE m.is_alive) AS alive_count,
         COUNT(m.id) FILTER (WHERE m.user_id = $1) AS is_member
       FROM groups g
       LEFT JOIN group_members m ON m.group_id = g.id
       GROUP BY g.id
       ORDER BY g.created_at DESC`,
      [isUUID(userId) ? userId : null]
    );

    dbPools = result.rows.map(row => {
      const tournament = getTournament(row.tournament_id);
      return {
        id: row.id,
        name: row.name,
        inviteCode: row.invite_code,
        entryFeeCents: parseInt(row.entry_fee_cents, 10),
        prizePoolCents: parseInt(row.prize_pool_cents, 10),
        tournamentId: row.tournament_id,
        tournament,
        memberCount: parseInt(row.member_count, 10),
        aliveCount: parseInt(row.alive_count, 10),
        isMember: parseInt(row.is_member, 10) > 0,
        isReal: true,
        winnerName: null,
      };
    }).filter(p => p.tournament !== null); // Hide orphaned pools (e.g. retired test tournaments)

    // For completed tournaments, find the winner (last survivor / most rounds survived)
    for (const p of dbPools) {
      if (p.tournament?.status !== 'completed' || p.memberCount === 0) continue;
      try {
        // If someone is still alive, they're the winner
        if (p.aliveCount === 1) {
          const winnerResult = await pool.query(
            `SELECT display_name FROM group_members WHERE group_id = $1 AND is_alive = true LIMIT 1`,
            [p.id]
          );
          if (winnerResult.rows.length) p.winnerName = winnerResult.rows[0].display_name;
        } else if (p.aliveCount === 0) {
          // Everyone eliminated — pick the one(s) who survived the most rounds
          const bestResult = await pool.query(
            `SELECT m.display_name, COUNT(pk.id) AS pick_count
             FROM group_members m
             LEFT JOIN picks pk ON pk.user_id = m.user_id AND pk.group_id = m.group_id AND pk.survived = true
             WHERE m.group_id = $1
             GROUP BY m.id
             ORDER BY pick_count DESC
             LIMIT 1`,
            [p.id]
          );
          if (bestResult.rows.length) p.winnerName = bestResult.rows[0].display_name;
        }
      } catch (e) {
        console.error(`Winner lookup failed for pool ${p.id}:`, e.message);
      }
    }
  } catch (e) {
    console.error('DB pools error:', e.message);
    // Fall through to mock-only
  }

  // ── Mock groups (official demo pools) ─────────────────────────────────────
  // Drop any mock groups whose tournamentId isn't in the registry so retired
  // events (Miami, Monte Carlo) can never leak into the lobby via the mock path.
  const mockPools = MOCK_GROUPS
    .map(group => ({ group, tournament: getTournament(group.tournamentId) }))
    .filter(({ tournament }) => tournament !== null)
    .map(({ group, tournament }) => {
      const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
      const isMember = userId ? members.some(m => m.userId === userId) : false;
      const aliveCount = members.filter(m => m.isAlive).length;
      return {
        id: group.id,
        name: group.name,
        inviteCode: group.inviteCode,
        entryFeeCents: group.entryFeeCents,
        prizePoolCents: group.prizePoolCents,
        tournamentId: group.tournamentId,
        tournament,
        memberCount: members.length,
        aliveCount,
        isMember,
        isReal: false,
      };
    });

  // Combine: DB pools first, then mock pools that don't duplicate a tournament
  // (avoid showing both a real and mock pool for the same tournament)
  const dbTournamentIds = new Set(dbPools.map(p => p.tournamentId));
  const filteredMock = mockPools.filter(p => !dbTournamentIds.has(p.tournamentId));

  res.json([...dbPools, ...filteredMock]);
});
