import { Router } from 'express';
import { pool } from '../db/pool.js';
import { MOCK_USERS } from '../data/mockGroups.js';

export const authRouter = Router();

// ── GET /api/auth/me?userId= ─────────────────────────────────────────────────
// Returns user profile. Checks DB first, falls back to mock users.
authRouter.get('/me', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'No userId provided' });

  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE id::text = $1',
      [userId]
    );
    if (result.rows.length > 0) {
      const u = result.rows[0];
      return res.json({ id: u.id, email: u.email, displayName: u.display_name });
    }
  } catch (_) {
    // DB unavailable — fall through to mock
  }

  // Mock user fallback (for Indian Wells demo data)
  const mock = MOCK_USERS.find(u => u.id === userId);
  if (!mock) return res.status(404).json({ error: 'User not found' });
  res.json(mock);
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
// Create a new user account. Returns existing user if email already registered.
authRouter.post('/register', async (req, res) => {
  const { email, displayName } = req.body;
  if (!email?.trim() || !displayName?.trim()) {
    return res.status(400).json({ error: 'Email and display name are required' });
  }

  const normEmail = email.trim().toLowerCase();
  const normName  = displayName.trim();

  try {
    const existing = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE email = $1',
      [normEmail]
    );
    if (existing.rows.length > 0) {
      const u = existing.rows[0];
      return res.json({ id: u.id, email: u.email, displayName: u.display_name, isNew: false });
    }

    const result = await pool.query(
      'INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING id::text, email, display_name',
      [normEmail, normName]
    );
    const u = result.rows[0];
    return res.status(201).json({ id: u.id, email: u.email, displayName: u.display_name, isNew: true });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
// Sign in with email — returns user if account exists.
authRouter.post('/login', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const normEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE email = $1',
      [normEmail]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email.' });
    }
    const u = result.rows[0];
    return res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});
