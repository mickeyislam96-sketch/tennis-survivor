import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { pool } from '../db/pool.js';
import { MOCK_USERS } from '../data/mockGroups.js';
import { sendRegistrationEmail } from '../utils/email.js';

export const authRouter = Router();

// ── GET /api/auth/me?userId= ─────────────────────────────────────────────────
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

  const mock = MOCK_USERS.find(u => u.id === userId);
  if (!mock) return res.status(404).json({ error: 'User not found' });
  res.json(mock);
});

// ── POST /api/auth/register ──────────────────────────────────────────────────
authRouter.post('/register', async (req, res) => {
  const { email, displayName, password } = req.body;

  if (!email?.trim() || !displayName?.trim()) {
    return res.status(400).json({ error: 'Email and display name are required.' });
  }
  if (!password || password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });
  }

  const normEmail = email.trim().toLowerCase();
  const normName  = displayName.trim();

  try {
    const existing = await pool.query(
      'SELECT id::text FROM users WHERE email = $1',
      [normEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists. Please sign in instead.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id::text, email, display_name',
      [normEmail, normName, passwordHash]
    );
    const u = result.rows[0];

    sendRegistrationEmail({
      email: u.email,
      displayName: u.display_name,
      tournamentName: 'Miami Open 2026',
      drawDate: 'March 16, 2026',
      startDate: 'March 19, 2026',
    });

    return res.status(201).json({ id: u.id, email: u.email, displayName: u.display_name, isNew: true });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim()) {
    return res.status(400).json({ error: 'Email is required.' });
  }
  if (!password) {
    return res.status(400).json({ error: 'Password is required.' });
  }

  const normEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name, password_hash FROM users WHERE email = $1',
      [normEmail]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email.' });
    }

    const u = result.rows[0];

    if (!u.password_hash) {
      // Legacy account created before passwords were added — prompt them to reset
      return res.status(401).json({ error: 'This account was created before passwords were added. Please create a new account.' });
    }

    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password.' });
    }

    return res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});
