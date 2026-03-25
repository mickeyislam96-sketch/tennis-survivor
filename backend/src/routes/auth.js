import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { MOCK_USERS } from '../data/mockGroups.js';
import { sendWelcomeEmail, sendPasswordResetEmail } from '../utils/email.js';

export const authRouter = Router();

// Rate limiters — protect against brute-force and spam
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 10,                     // 10 attempts per window
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 registrations per hour per IP
  message: { error: 'Too many accounts created. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 3,                     // 3 reset requests per hour per IP
  message: { error: 'Too many password reset requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// ââ GET /api/auth/me?userId= âââââââââââââââââââââââââââââââââââââââââââââââââ
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
    // DB unavailable â fall through to mock
  }

  const mock = MOCK_USERS.find(u => u.id === userId);
  if (!mock) return res.status(404).json({ error: 'User not found' });
  res.json(mock);
});

// ââ POST /api/auth/register ââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.post('/register', registerLimiter, async (req, res) => {
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

// ââ POST /api/auth/login âââââââââââââââââââââââââââââââââââââââââââââââââââââ
authRouter.post('/login', loginLimiter, async (req, res) => {
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

// ââ POST /api/auth/forgot-password âââââââââââââââââââââââââââââââââââââââââââ
authRouter.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
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
    if (result.rows.length === 0) return; // No account â silent

    const u = result.rows[0];
    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Clear any existing tokens for this user
    await pool.query('DELETE FROM password_reset_tokens WHERE user_id = $1', [u.id]);

    await pool.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
      [u.id, token, expiresAt]
    );

    const frontendUrl = process.env.FRONTEND_URL || 'https://finalserveivor.com';
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

// ââ POST /api/auth/reset-password ââââââââââââââââââââââââââââââââââââââââââââ
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

// ââ GET /api/auth/verify-reset-token?token= ââââââââââââââââââââââââââââââââââ
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

// ââ PATCH /api/auth/me âââââââââââââââââââââââââââââââââââââââââââââââââââââââ
// Update display name, email, and/or password
authRouter.patch('/me', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  const { displayName, email, currentPassword, newPassword } = req.body;

  try {
    // Fetch current user
    const userResult = await pool.query(
      'SELECT id::text, email, display_name, password_hash FROM users WHERE id::text = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }
    const u = userResult.rows[0];

    // If changing password, verify current password first
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to set a new one.' });
      }
      if (newPassword.length < 8) {
        return res.status(400).json({ error: 'New password must be at least 8 characters.' });
      }
      const valid = await bcrypt.compare(currentPassword, u.password_hash || '');
      if (!valid) {
        return res.status(401).json({ error: 'Current password is incorrect.' });
      }
    }

    // If changing email, check it is not already taken
    if (email && email.trim().toLowerCase() !== u.email) {
      const normEmail = email.trim().toLowerCase();
      const existing = await pool.query(
        'SELECT id FROM users WHERE email = $1 AND id::text != $2',
        [normEmail, userId]
      );
      if (existing.rows.length > 0) {
        return res.status(409).json({ error: 'That email is already in use.' });
      }
    }

    // Build update
    const updates = [];
    const params  = [];
    let idx = 1;

    if (displayName?.trim()) {
      updates.push(`display_name = $${idx++}`);
      params.push(displayName.trim());
    }
    if (email?.trim()) {
      updates.push(`email = $${idx++}`);
      params.push(email.trim().toLowerCase());
    }
    if (newPassword) {
      const hash = await bcrypt.hash(newPassword, 12);
      updates.push(`password_hash = $${idx++}`);
      params.push(hash);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No changes provided.' });
    }

    params.push(userId);
    const updated = await pool.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id::text = $${idx} RETURNING id::text, email, display_name`,
      params
    );

    const row = updated.rows[0];
    return res.json({ id: row.id, email: row.email, displayName: row.display_name });
  } catch (err) {
    console.error('PATCH /me error:', err.message);
    return res.status(500).json({ error: 'Failed to update profile. Please try again.' });
  }
});

// ââ GET /api/auth/me/pools âââââââââââââââââââââââââââââââââââââââââââââââââââ
// Returns all pools (groups) the user has joined, with their alive/eliminated status
authRouter.get('/me/pools', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'];
  if (!userId) return res.status(401).json({ error: 'Not authenticated.' });

  try {
    const result = await pool.query(
      `SELECT
         g.id::text AS "groupId",
         g.name AS "groupName",
         g.prize_pool_cents AS "prizePoolCents",
         gm.is_alive AS "isAlive",
         gm.eliminated_round AS "eliminatedRound",
         gm.joined_at AS "joinedAt",
         (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS "totalMembers"
       FROM group_members gm
       JOIN groups g ON g.id = gm.group_id
       WHERE gm.user_id::text = $1
       ORDER BY gm.joined_at DESC`,
      [userId]
    );
    return res.json(result.rows);
  } catch (err) {
    console.error('GET /me/pools error:', err.message);
    return res.status(500).json({ error: 'Failed to load pool history.' });
  }
});
