import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';
import { getTournament } from '../data/tournaments.js';
import { sendTournamentJoinEmail } from '../utils/email.js';
import { getDeadlines } from '../services/tennisData.js';

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

// GET /api/groups â groups the user belongs to
groupsRouter.get('/', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
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
      return res.json(result.rows.map(rowToGroup).filter(g => getTournament(g.tournamentId) !== null));
    } catch (e) {
      console.error('DB groups list error:', e.message);
    }
  }

  // Mock fallback
  const myGroups = MOCK_GROUPS.filter(g =>
    MOCK_MEMBERS.some(m => m.groupId === g.id && m.userId === userId)
  );
  res.json(myGroups);
});

// GET /api/groups/invite/:code â look up group by invite code
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
      const groupData = rowToGroup(g);
      // Expose betaFree flag so JoinGroup page shows "Entry fee waived" notice
      const tournament = getTournament(g.tournament_id);
      const betaFree = groupData.entryFeeCents === 0;
      return res.json({ ...groupData, betaFree, members: membersResult.rows.map(rowToMember) });
    }
  } catch (e) {
    console.error('DB invite lookup error:', e.message);
  }

  // Mock fallback
  const group = MOCK_GROUPS.find(g => g.inviteCode === code);
  if (!group) return res.status(404).json({ error: 'Invalid invite code' });
  const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
  const betaFree = (group.entryFeeCents || 0) === 0;
  res.json({ ...group, betaFree, members });
});

// GET /api/groups/:id â group detail + members
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
        const groupData = rowToGroup(g);
        const betaFree = groupData.entryFeeCents === 0;
        let members = membersResult.rows.map(rowToMember);

        // Self-healing: if a member was eliminated in a round whose pick
        // window is still open, they shouldn't be eliminated yet (they can
        // still change their pick). Override to alive and fix the DB.
        try {
          const deadlines = await getDeadlines();
          const openRounds = new Set(deadlines.filter(d => d.isOpen).map(d => d.round));
          for (const m of members) {
            if (!m.isAlive && m.eliminatedRound && openRounds.has(m.eliminatedRound)) {
              const badRound = m.eliminatedRound;
              console.log(`[groups] Self-healing: ${m.displayName} was eliminated in ${badRound} but window is still open â overriding to alive`);
              m.isAlive = true;
              m.eliminatedRound = null;
              // Also fix the DB so this doesn't repeat every request
              pool.query(
                'UPDATE group_members SET is_alive = true, eliminated_round = NULL WHERE id = $1::uuid',
                [m.id]
              ).then(() => {
                // Also reset the pick for that round so it's changeable
                return pool.query(
                  'UPDATE picks SET survived = NULL WHERE group_id = $1::uuid AND user_id = $2::uuid AND round = $3 AND survived = false',
                  [m.groupId, m.userId, badRound]
                );
              }).catch(err => console.error('[groups] Self-healing DB fix error:', err.message));
            }
          }
        } catch (err) {
          // Non-fatal â if deadlines fail, just return raw DB data
          console.warn('[groups] Could not check deadlines for self-healing:', err.message);
        }

        return res.json({ ...groupData, betaFree, members });
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

// POST /api/groups â create a new group
groupsRouter.post('/', async (req, res) => {
  const { name, entryFeeCents = 0, adminUserId, tournamentId } = req.body;
  const adminId = adminUserId || req.headers['x-user-id'];
  const groupName = (name || 'My Pool').trim();
  // Generate invite code: short tournament prefix + random alphanumeric suffix
  const prefix = groupName.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 8);
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const inviteCode = `${prefix}-${suffix}`;
  const tournament = tournamentId || 'monte-carlo-2026';

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
  const { userId, displayName } = req.body;
  const groupId = req.params.id;

  if (isUUID(groupId) && isUUID(userId)) {
    try {
      const groupCheck = await pool.query(
        'SELECT id, entry_fee_cents FROM groups WHERE id = $1', [groupId]
      );
      if (groupCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Group not found' });
      }

      // PAYMENT GATE: paid groups require a completed Stripe payment before joining
      const groupFee = parseInt(groupCheck.rows[0].entry_fee_cents, 10) || 0;
      if (groupFee > 0) {
        const paymentCheck = await pool.query(
          `SELECT id FROM payment_orders
           WHERE user_id = $1 AND group_id = $2 AND status = 'completed'`,
          [userId, groupId]
        );
        if (paymentCheck.rows.length === 0) {
          return res.status(402).json({ error: 'Payment required to join this group' });
        }
      }

      const existing = await pool.query(
        `SELECT id::text, group_id::text, user_id::text, display_name, is_alive, eliminated_round, joined_at
         FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      if (existing.rows.length > 0) {
        // Return 200 (not 400) so auto-join flows don't show errors
        return res.status(200).json(rowToMember(existing.rows[0]));
      }

      const result = await pool.query(
        `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
         VALUES ($1, $2, $3, true)
         RETURNING id::text, group_id::text, user_id::text, display_name, is_alive, eliminated_round, joined_at`,
        [groupId, userId, (displayName || 'Player').trim()]
      );

      // Increment prize pool if group has an entry fee
      await pool.query(
        `UPDATE groups SET prize_pool_cents = prize_pool_cents + entry_fee_cents
         WHERE id = $1 AND entry_fee_cents > 0`,
        [groupId]
      );

      // Queue tournament join confirmation email (pending admin approval)
      try {
        const [userResult, groupResult, memberCountResult] = await Promise.all([
          pool.query('SELECT email, display_name FROM users WHERE id = $1', [userId]),
          pool.query('SELECT name, tournament_id FROM groups WHERE id = $1', [groupId]),
          pool.query('SELECT COUNT(*) FROM group_members WHERE group_id = $1', [groupId]),
        ]);
        const user = userResult.rows[0];
        const grp = groupResult.rows[0];
        const tournament = getTournament(grp?.tournament_id);
        if (user && tournament) {
          const fmt = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
          await sendTournamentJoinEmail({
            userId,
            groupId,
            email: user.email,
            displayName: user.display_name,
            tournamentName: tournament.name,
            tournamentShortName: tournament.shortName || tournament.name,
            tournamentLevel: tournament.tourLevel || '',
            drawDate: tournament.drawDate || fmt(tournament.startDate || ''),
            firstMatchDate: fmt(tournament.startDate || ''),
            groupPlayerCount: Number(memberCountResult.rows[0].count),
            groupUrl: `https://finalserveivor.com/group/${groupId}`,
            inviteUrl: '',
          });
        }
      } catch (emailErr) {
        console.error('Tournament join email queue failed:', emailErr.message);
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
