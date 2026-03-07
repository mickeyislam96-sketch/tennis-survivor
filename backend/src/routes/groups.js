import { Router } from 'express';
import { MOCK_GROUPS, MOCK_MEMBERS } from '../data/mockGroups.js';

export const groupsRouter = Router();

groupsRouter.get('/', (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  const myGroups = MOCK_GROUPS.filter(g =>
    MOCK_MEMBERS.some(m => m.groupId === g.id && m.userId === userId)
  );
  res.json(myGroups);
});

groupsRouter.get('/:id', (req, res) => {
  const group = MOCK_GROUPS.find(g => g.id === req.params.id);
  if (!group) return res.status(404).json({ error: 'Group not found' });
  const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
  res.json({ ...group, members });
});

groupsRouter.get('/invite/:code', (req, res) => {
  const group = MOCK_GROUPS.find(g => g.inviteCode === req.params.code.toUpperCase());
  if (!group) return res.status(404).json({ error: 'Invalid invite code' });
  const members = MOCK_MEMBERS.filter(m => m.groupId === group.id);
  res.json({ ...group, members });
});

groupsRouter.post('/', (req, res) => {
  const { name, entryFeeCents = 0, adminUserId } = req.body;
  const inviteCode = (name || 'GROUP').replace(/\s+/g, '-').toUpperCase().slice(0, 20) + '-' + Date.now().toString(36).slice(-6);
  const group = {
    id: 'g' + Date.now(),
    name: name || 'My Pool',
    inviteCode,
    entryFeeCents: entryFeeCents || 0,
    prizePoolCents: 0,
    tournamentId: 'indian-wells-2026',
    adminUserId: adminUserId || req.headers['x-user-id'],
    createdAt: new Date().toISOString()
  };
  MOCK_GROUPS.push(group);
  res.status(201).json(group);
});

groupsRouter.post('/:id/join', (req, res) => {
  const { userId, displayName } = req.body;
  const group = MOCK_GROUPS.find(g => g.id === req.params.id);
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
    joinedAt: new Date().toISOString()
  };
  MOCK_MEMBERS.push(member);
  if (group.entryFeeCents) {
    group.prizePoolCents = (group.prizePoolCents || 0) + group.entryFeeCents;
  }
  res.status(201).json(member);
});
