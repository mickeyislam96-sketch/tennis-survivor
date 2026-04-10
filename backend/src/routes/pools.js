/**
 * GET /api/pools
 * Returns all available tournament pools enriched with tournament metadata
 * and the requesting user's membership status.
 *
 * Merges real DB groups with mock groups (mock groups serve as the
 * "official" demo pools visible in the lobby).
 */
import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';
import { getTournament } from '../data/tournaments.js';

export const poolsRouter = Router();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

poolsRouter.get('/', async (req, res) => {
  const userId = req.query.userId;

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
      };
    });
  } catch (e) {
    console.error('DB pools error:', e.message);
    // Fall through to mock-only
  }

  // ── Mock groups (official demo pools) ─────────────────────────────────────
  const mockPools = MOCK_GROUPS.map(group => {
    const tournament = getTournament(group.tournamentId);
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
