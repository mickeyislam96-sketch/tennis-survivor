import { Router } from 'express';
import { requireAuth, optionalAuth } from '../middleware/auth.js';
import { pool } from '../db/pool.js';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';
import { TOURNAMENTS, getTournament } from '../data/tournaments.js';
import { sendTournamentJoinEmail } from '../utils/email.js';

export const groupsRouter = Router();

function isUUID(str) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(str || ''));
}

function rowToGroup(g) {
  return {
    id: g.id,
    name: g.name,
    inviteCode: g.invite_code,
    entryFeeCents: g.entry_fee_cents,
    prizePoolCents: g.prize_pool_cents,
    tournamentId: g.tournament_id,
    adminUserId: g.admin_user_id,
    createdAt: g.created_at,
  };
}

function rowToMember(m) {
  return {
    id: m.id,
    groupId: m.group_id,
    userId: m.user_id,
    displayName: m.display_name,
    isAlive: m.is_alive,
    eliminatedRound: m.eliminated_round,
    joinedAt: m.joined_at,
  };
}

// GET /api/groups — groups the user belongs to
groupsRouter.get('/', async (req, res) => {
  const userId = req.userId;
  if (!userId) return res.json([]);

  if (isUUID(userId)) {
    try {
      const result = await pool.query(
        `SELECT g.id::text, g.name, g.invite_code, g.entry_fee_cents, g.prize_pool_cents,
                g.tournament_id, g.admin_user_id::text, g.created_at
         FROM groups g
         JOIN group_members m ON m.group_id = g.id
         WHERE m.user_id = $1
         ORDER BY g.created_at DESC`,
        [userId]
      );
      // Filter out groups whose tournament is no longer in the registry
      // (e.g. Miami test run) so stale memberships don't surface in the UI.
      const visible = result.rows
        .map(rowToGroup)
        .filter(g => getTournament(g.tournamentId) !== null);
      return res.json(visible);
    } catch (e) {
      console.error('DB groups list error:', e.message);
    }
  }

  // Mock fallback — also filter against the registry as defence-in-depth.
  const myGroups = MOCK_GROUPS.filter(g =>
    MOCK_MEMBERS.some(m => m.groupId === g.id && m.userId === userId)
    && getTournament(g.tournamentId) !== null
  );
  res.json(myGroups);
});

// GET /api/groups/invite/:code — look up group by invite code
groupsRouter.get('/invite/:code', async (req, res) => {
  const code = req.params.code.toUpperCase();

  try {
    const result = await pool.query(
      `SELECT id::text, name, invite_code, entry_fee_cents, prize_pool_cents,
              tournament_id, admin_user_id::text, created_at
       FROM groups WHERE invite_code = $1`,
      [code]
    );
    if (result.rows.length > 0) {
      const g = result.rows[0];
      const membersResult = await pool.query(
        `SELECT id::text, group_id::text, user_id::text, display_name, is_alive, eliminated_round, joined_at
         FROM group_members WHERE group_id = $1`,
        [g.id]
      );
      return res.json({ ...rowToGroup(g), members: membersResult.rows.map(rowToMember) });
    }
  } catch (e) {
    console.error('DB invite lookup error:', e.message);
  }

  // Mock fallback
  const group = MOCK_GROUPS.find(g => g.inviteCode === code);
  if (!group) return res.status(404).json({ error: 'Invalid invite code' });
  const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
  res.json({ ...group, members });
});

// GET /api/groups/:id — group detail + members
groupsRouter.get('/:id', async (req, res) => {
  const { id } = req.params;

  if (isUUID(id)) {
    try {
      const result = await pool.query(
        `SELECT id::text, name, invite_code, entry_fee_cents, prize_pool_cents,
                tournament_id, admin_user_id::text, created_at
         FROM groups WHERE id = $1`,
        [id]
      );
      if (result.rows.length > 0) {
        const g = result.rows[0];
        const membersResult = await pool.query(
          `SELECT id::text, group_id::text, user_id::text, display_name, is_alive, eliminated_round, joined_at
           FROM group_members WHERE group_id = $1
           ORDER BY joined_at`,
          [id]
        );
        return res.json({ ...rowToGroup(g), members: membersResult.rows.map(rowToMember) });
      }
    } catch (e) {
      console.error('DB group lookup error:', e.message);
    }
  }

  // Mock fallback
  const group = MOCK_GROUPS.find(g => g.id === id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
  res.json({ ...group, members });
});

// POST /api/groups — create a new group
groupsRouter.post('/', async (req, res) => {
  const { name, entryFeeCents = 0, adminUserId, tournamentId } = req.body;
  const adminId = adminUserId || req.userId;
  const groupName = (name || 'My Pool').trim();
  const inviteCode = groupName.replace(/\s+/g, '-').toUpperCase().slice(0, 20) + '-' + Date.now().toString(36).slice(-6);
  const tournament = tournamentId || 'indian-wells-2026';

  if (isUUID(adminId)) {
    try {
      const result = await pool.query(
        `INSERT INTO groups (name, invite_code, entry_fee_cents, prize_pool_cents, tournament_id, admin_user_id)
         VALUES ($1, $2, $3, 0, $4, $5)
         RETURNING id::text, name, invite_code, entry_fee_cents, prize_pool_cents, tournament_id, admin_user_id::text, created_at`,
        [groupName, inviteCode, entryFeeCents || 0, tournament, adminId]
      );
      return res.status(201).json(rowToGroup(result.rows[0]));
    } catch (e) {
      console.error('DB group create error:', e.message);
      return res.status(500).json({ error: 'Failed to create group' });
    }
  }

  // Mock fallback
  const group = {
    id: 'g' + Date.now(),
    name: groupName,
    inviteCode,
    entryFeeCents: entryFeeCents || 0,
    prizePoolCents: 0,
    tournamentId: tournament,
    adminUserId: adminId,
    createdAt: new Date().toISOString(),
  };
  MOCK_GROUPS.push(group);
  res.status(201).json(group);
});

// POST /api/groups/:id/join
groupsRouter.post('/:id/join', async (req, res) => {
  const { displayName } = req.body;
  const userId = req.userId || req.body.userId;  // JWT or legacy
  const groupId = req.params.id;

  if (isUUID(groupId) && isUUID(userId)) {
    try {
      const groupCheck = await pool.query('SELECT id FROM groups WHERE id = $1', [groupId]);
      if (groupCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      const existing = await pool.query(
        'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
        [groupId, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Already a member' });
      }

      // Payment gate: if group has an entry fee, require confirmed payment
      const groupFeeCheck = await pool.query(
        'SELECT entry_fee_cents FROM groups WHERE id = $1',
        [groupId]
      );
      const entryFee = groupFeeCheck.rows[0]?.entry_fee_cents || 0;

      if (entryFee > 0) {
        const paymentCheck = await pool.query(
          "SELECT id FROM payment_orders WHERE group_id = $1 AND user_id = $2 AND status = 'confirmed'",
          [groupId, userId]
        );
        if (paymentCheck.rows.length === 0) {
          return res.status(402).json({
            error: 'Payment required',
            code: 'PAYMENT_REQUIRED',
            entryFeeCents: entryFee,
          });
        }
      }

      const result = await pool.query(
        `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
         VALUES ($1, $2, $3, true)
         RETURNING id::text, group_id::text, user_id::text, display_name, is_alive, eliminated_round, joined_at`,
        [groupId, userId, (displayName || 'Player').trim()]
      );

      // Increment prize pool if group has an entry fee
      // Note: for paid groups, prize pool is also incremented in confirmPaymentAndJoin().
      // This handles legacy free groups and direct admin joins.
      if (entryFee === 0) {
        // No-op for free groups (prize pool stays at 0)
      } else {
        // Paid group: prize pool already incremented by payment confirmation.
        // Do NOT double-increment here.
      }

      // Non-blocking tournament join confirmation email
      try {
        const [userResult, groupResult, prizeResult] = await Promise.all([
          pool.query('SELECT email, display_name FROM users WHERE id = $1', [userId]),
          pool.query('SELECT name, tournament_id, entry_fee_cents FROM groups WHERE id = $1', [groupId]),
          pool.query('SELECT prize_pool_cents FROM groups WHERE id = $1', [groupId]),
        ]);
        const user = userResult.rows[0];
        const group = groupResult.rows[0];
        const prize = prizeResult.rows[0];
        const tournament = TOURNAMENTS.find(t => t.id === group?.tournament_id);
        if (user && tournament) {
          const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
          sendTournamentJoinEmail({
            email: user.email,
            displayName: user.display_name,
            groupId,
            groupName: group.name,
            tournamentName: tournament.name,
            tourLevel: tournament.tourLevel,
            location: tournament.location,
            drawDate: tournament.drawDate || fmt(tournament.startDate),
            startDate: fmt(tournament.startDate),
            drawAvailable: tournament.drawAvailable === true,
            prizePoolCents: prize?.prize_pool_cents || 0,
          });
        }
      } catch (emailErr) {
        console.error('Tournament join email lookup failed:', emailErr.message);
      }

      return res.status(201).json(rowToMember(result.rows[0]));
    } catch (e) {
      console.error('DB join group error:', e.message);
      return res.status(500).json({ error: 'Failed to join group' });
    }
  }

  // Mock fallback
  const group = MOCK_GROUPS.find(g => g.id === groupId);
  if (!group) return res.status(404).json({ error: 'Group not found' });

  // Payment gate for mock groups too
  if (group.entryFeeCents && group.entryFeeCents > 0) {
    return res.status(402).json({
      error: 'Payment required',
      code: 'PAYMENT_REQUIRED',
      entryFeeCents: group.entryFeeCents,
    });
  }

  if (MOCK_MEMBERS.some(m => m.groupId === group.id && m.userId === userId)) {
    return res.status(400).json({ error: 'Already a member' });
  }
  const member = {
    id: 'mem' + Date.now(),
    groupId: group.id,
    userId,
    displayName: displayName || 'Player',
    isAlive: true,
    eliminatedRound: null,
    joinedAt: new Date().toISOString(),
  };
  MOCK_MEMBERS.push(member);
  if (group.entryFeeCents) {
    group.prizePoolCents = (group.prizePoolCents || 0) + group.entryFeeCents;
  }
  res.status(201).json(member);
});
