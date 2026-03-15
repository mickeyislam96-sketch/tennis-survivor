import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { pool } from '../db/pool.js';
import { MOCK_USERS } from '../data/mockGroups.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email.js';

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

  if (!email?.trim())        return res.status(400).json({ error: 'Email is required.' });
  if (!displayName?.trim())  return res.status(400).json({ error: 'Display name is required.' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  const normEmail = email.trim().toLowerCase();
  const normName  = displayName.trim();

  try {
    const existing = await pool.query(
      'SELECT id::text FROM users WHERE email = $1',
      [normEmail]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({
        error: 'An account with this email already exists. Please sign in instead.',
        code: 'EMAIL_TAKEN',
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      'INSERT INTO users (email, display_name, password_hash) VALUES ($1, $2, $3) RETURNING id::text, email, display_name',
      [normEmail, normName, passwordHash]
    );
    const u = result.rows[0];

    // Non-blocking welcome email
    sendWelcomeEmail({ email: u.email, displayName: u.display_name });

    return res.status(201).json({ id: u.id, email: u.email, displayName: u.display_name, isNew: true });
  } catch (err) {
    console.error('Register error:', err.message);
    return res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// ── POST /api/auth/login ─────────────────────────────────────────────────────
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' });
  if (!password)      return res.status(400).json({ error: 'Password is required.' });

  const normEmail = email.trim().toLowerCase();

  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name, password_hash FROM users WHERE email = $1',
      [normEmail]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No account found with that email. Have you registered?' });
    }

    const u = result.rows[0];

    if (!u.password_hash) {
      return res.status(401).json({
        error: 'This account has no password set. Please use "Forgot password" to set one.',
        code: 'NO_PASSWORD',
      });
    }

    const valid = await bcrypt.compare(password, u.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Incorrect password. Please try again.' });
    }

    return res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    console.error('Login error:', err.message);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// ── POST /api/auth/forgot-password ───────────────────────────────────────────
authRouter.post('/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' });

  const normEmail = email.trim().toLowerCase();

  // Always respond with success to prevent email enumeration
  res.json({ message: 'If an account exists for that email, a reset link has been sent.' });

  try {
    const result = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE email = $1',
      [normEmail]
    );
    if (result.rows.length === 0) return; // No account — silent

    const u = result.rows[0];
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Clear any existing tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [u.id]);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [u.id, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    await sendPasswordResetEmail({
      email: u.email,
      displayName: u.display_name,
      resetUrl,
    });
  } catch (err) {
    console.error('Forgot password error:', err.message);
  }
});

// ── POST /api/auth/reset-password ────────────────────────────────────────────
authRouter.post('/reset-password', async (req, res) => {
  const { token, password } = req.body;

  if (!token)    return res.status(400).json({ error: 'Reset token is missing.' });
  if (!password || password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters.' });

  try {
    const result = await pool.query(
      `SELECT prt.user_id::text, prt.expires_at, u.email, u.display_name
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token = $1`,
      [token]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid or expired reset link. Please request a new one.' });
    }

    const row = result.rows[0];

    if (new Date() > new Date(row.expires_at)) {
      await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);
      return res.status(400).json({ error: 'This reset link has expired. Please request a new one.' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id::text = $2',
      [passwordHash, row.user_id]
    );

    // Delete the used token
    await pool.query('DELETE FROM password_reset_tokens WHERE token = $1', [token]);

    // Return the user so frontend can log them in automatically
    const userResult = await pool.query(
      'SELECT id::text, email, display_name FROM users WHERE id::text = $1',
      [row.user_id]
    );
    const u = userResult.rows[0];

    return res.json({ id: u.id, email: u.email, displayName: u.display_name });
  } catch (err) {
    console.error('Reset password error:', err.message);
    return res.status(500).json({ error: 'Password reset failed. Please try again.' });
  }
});

// ── GET /api/auth/verify-reset-token?token= ──────────────────────────────────
// Lets the frontend validate the token before showing the form
authRouter.get('/verify-reset-token', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).json({ valid: false, error: 'No token provided.' });

  try {
    const result = await pool.query(
      'SELECT expires_at FROM password_reset_tokens WHERE token = $1',
      [token]
    );
    if (result.rows.length === 0) {
      return res.json({ valid: false, error: 'Invalid or already used reset link.' });
    }
    if (new Date() > new Date(result.rows[0].expires_at)) {
      return res.json({ valid: false, error: 'This reset link has expired.' });
    }
    return res.json({ valid: true });
  } catch (err) {
    return res.status(500).json({ valid: false, error: 'Could not verify token.' });
  }
});
