import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { pool } from '../db/pool.js';
import { sendSupportEmail } from '../utils/email.js';

export const supportRouter = Router();

const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 support requests per IP per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many support requests. Please try again later.' },
});

// ── POST /api/support ────────────────────────────────────────────────────────
// Accepts a support request, auto-attaches user context, sends notification
// email to finalservivor@gmail.com via Brevo.
supportRouter.post('/', supportLimiter, async (req, res) => {
  const { category, subject, message, userId } = req.body;

  // Validate required fields
  if (!subject || !subject.trim()) {
    return res.status(400).json({ error: 'Subject is required.' });
  }
  if (!message || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (subject.trim().length > 200) {
    return res.status(400).json({ error: 'Subject must be under 200 characters.' });
  }
  if (message.trim().length > 5000) {
    return res.status(400).json({ error: 'Message must be under 5,000 characters.' });
  }

  // Gather user context if userId provided
  let userContext = null;
  if (userId) {
    try {
      const userResult = await pool.query(
        'SELECT id::text, email, display_name FROM users WHERE id::text = $1',
        [userId]
      );
      if (userResult.rows.length > 0) {
        const u = userResult.rows[0];
        // Get their group memberships
        const groupsResult = await pool.query(
          `SELECT g.name, g.tournament_id
           FROM members m
           JOIN groups g ON g.id = m.group_id
           WHERE m.user_id = $1`,
          [u.id]
        );
        userContext = {
          id: u.id,
          email: u.email,
          displayName: u.display_name,
          groups: groupsResult.rows.map(g => g.name).join(', ') || 'None',
        };
      }
    } catch (err) {
      console.error('[support] Failed to fetch user context:', err.message);
      // Continue without context — don't block the support request
    }
  }

  try {
    await sendSupportEmail({
      category: category || 'General',
      subject: subject.trim(),
      message: message.trim(),
      userContext,
    });

    console.log(`[support] Request sent — category=${category || 'General'}, user=${userContext?.email || 'anonymous'}`);
    res.json({ ok: true, message: 'Support request sent. We\'ll get back to you soon.' });
  } catch (err) {
    console.error('[support] Failed to send:', err.message);
    res.status(500).json({ error: 'Failed to send support request. Please try again or email us directly at finalservivor@gmail.com.' });
  }
});
