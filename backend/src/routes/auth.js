import { Router } from 'express';
import { MOCK_USERS } from '../data/mockGroups.js';

export const authRouter = Router();

// Simple mock auth: pass ?userId=u1 or body { userId }
authRouter.get('/me', (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Not found. Use ?userId=u1 for demo.' });
  }
  res.json(user);
});

authRouter.post('/login', (req, res) => {
  const { userId } = req.body;
  const user = MOCK_USERS.find(u => u.id === userId);
  if (!user) {
    return res.status(401).json({ error: 'Invalid user' });
  }
  res.json(user);
});
