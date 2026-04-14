import { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../db/pool.js';
import { getTournament } from '../data/tournaments.js';

export const paymentsRouter = Router();

/* ─── Startup validation ─────────────────────────────── */

if (!process.env.STRIPE_SECRET_KEY) {
  console.error('[payments] WARNING: STRIPE_SECRET_KEY not set — payment endpoints will fail gracefully');
}

const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

/* ─── Helpers ────────────────────────────────────────── */

function cents(n) { return Math.round(Number(n) || 0); }

const MAX_FEE_CENTS = 50_000; // £500 hard cap — sanity guard

function stripeReady(res) {
  if (!stripe) {
    return res.status(503).json({ error: 'Payment system not configured' });
  }
  return null;
}

/* ─── POST /api/payments/create-checkout ──────────────── *
 *  Body: { userId, groupId, displayName }
 *  Creates a Stripe Checkout Session for the group's entry fee.
 *  Returns { url } — the hosted Stripe Checkout page URL.
 *
 *  Guards:
 *  - Rejects if group is free
 *  - Rejects if user is already a member
 *  - Rejects if a pending or completed order already exists (double-click guard)
 *  - Caps fee at MAX_FEE_CENTS
 *  - Truncates displayName to 50 chars
 * ──────────────────────────────────────────────────────── */
paymentsRouter.post('/create-checkout', async (req, res) => {
  const blocked = stripeReady(res);
  if (blocked) return blocked;

  const { userId, groupId, displayName } = req.body;
  if (!userId || !groupId) {
    return res.status(400).json({ error: 'userId and groupId are required' });
  }

  // Sanitise display name
  const safeName = (displayName || 'Player').trim().slice(0, 50);

  try {
    // 1. Fetch group and validate entry fee
    const groupResult = await pool.query(
      `SELECT id::text, name, entry_fee_cents, tournament_id FROM groups WHERE id = $1`,
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];
    const fee = cents(group.entry_fee_cents);
    if (fee <= 0) {
      return res.status(400).json({ error: 'This group is free — no payment needed' });
    }
    if (fee > MAX_FEE_CENTS) {
      console.error(`[payments] Fee ${fee} exceeds cap ${MAX_FEE_CENTS} for group ${groupId}`);
      return res.status(400).json({ error: 'Entry fee exceeds allowed maximum' });
    }

    // 2. Check user isn't already a member
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    // 3. Check for existing pending OR completed order (double-click guard)
    const existingOrder = await pool.query(
      `SELECT stripe_session_id, status FROM payment_orders
       WHERE user_id = $1 AND group_id = $2 AND status IN ('pending', 'completed')`,
      [userId, groupId]
    );
    if (existingOrder.rows.length > 0) {
      const order = existingOrder.rows[0];
      if (order.status === 'completed') {
        return res.status(400).json({ error: 'Payment already completed for this group' });
      }
      // Pending order exists — return the existing session URL instead of creating a new one
      // (Stripe session may have expired, but this prevents DB pollution)
      return res.status(409).json({
        error: 'A payment is already in progress. Please complete or cancel it first.',
        sessionId: order.stripe_session_id,
      });
    }

    // 4. Get tournament info for the checkout description
    const tournament = getTournament(group.tournament_id);
    const tournamentName = tournament?.name || group.name;

    // 5. Create Stripe Checkout Session
    const frontendUrl = process.env.FRONTEND_URL || 'https://finalserveivor.com';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'gbp',
          unit_amount: fee,
          product_data: {
            name: `${tournamentName} — Season Membership`,
            description: `Entry to ${group.name} prediction league`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        userId,
        groupId,
        displayName: safeName,
      },
      success_url: `${frontendUrl}/group/${groupId}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/group/${groupId}/pay/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
    });

    // 6. Record the order
    await pool.query(
      `INSERT INTO payment_orders (user_id, group_id, stripe_session_id, amount_cents, currency, status)
       VALUES ($1, $2, $3, $4, 'gbp', 'pending')`,
      [userId, groupId, session.id, fee]
    );

    console.log(`[payments] Checkout session created: ${session.id} for user ${userId} group ${groupId} (£${(fee / 100).toFixed(2)})`);
    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[payments] create-checkout error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/* ─── GET /api/payments/status?sessionId=X ───────────── *
 *  Check the status of a payment by Stripe session ID.
 *  Returns only { status } — no user/group data (privacy).
 * ──────────────────────────────────────────────────────── */
paymentsRouter.get('/status', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const result = await pool.query(
      `SELECT status FROM payment_orders WHERE stripe_session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    return res.json({ status: result.rows[0].status });
  } catch (err) {
    console.error('[payments] status error:', err.message);
    return res.status(500).json({ error: 'Failed to check payment status' });
  }
});

/* ─── POST /api/payments/webhook ──────────────────────── *
 *  Stripe webhook handler. Verifies signature, processes
 *  checkout.session.completed events, joins user to group.
 *
 *  IMPORTANT: This route needs the raw body (not parsed JSON)
 *  so it must be mounted BEFORE express.json() middleware.
 *
 *  Safety measures:
 *  - Validates STRIPE_WEBHOOK_SECRET exists
 *  - Uses DB transaction for atomicity
 *  - Idempotent via atomic UPDATE ... WHERE status = 'pending'
 *  - Uses ON CONFLICT DO NOTHING for member insert
 *  - Returns 500 on transient errors so Stripe retries
 * ──────────────────────────────────────────────────────── */
export async function handleStripeWebhook(req, res) {
  /* 1. Validate webhook secret is configured */
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) {
    console.error('[payments] CRITICAL: STRIPE_WEBHOOK_SECRET not set');
    return res.status(500).send('Webhook not configured');
  }
  if (!stripe) {
    return res.status(500).send('Stripe not configured');
  }

  /* 2. Verify signature */
  const sig = req.headers['stripe-signature'];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[payments] Webhook signature failed:', err.message);
    return res.status(401).send('Unauthorized');
  }

  /* 3. Only handle checkout.session.completed */
  if (event.type !== 'checkout.session.completed') {
    return res.status(200).json({ received: true });
  }

  const session = event.data.object;
  const { userId, groupId, displayName } = session.metadata || {};

  if (!userId || !groupId) {
    console.error('[payments] Webhook missing metadata:', session.id);
    return res.status(200).json({ received: true });
  }

  const safeName = (displayName || 'Player').trim().slice(0, 50);

  /* 4. Process in a transaction — atomic or nothing */
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Idempotency gate: only process if order is still 'pending'
    // This atomic UPDATE ensures only one webhook delivery succeeds
    const updateResult = await client.query(
      `UPDATE payment_orders SET status = 'completed', completed_at = NOW()
       WHERE stripe_session_id = $1 AND status = 'pending'
       RETURNING id`,
      [session.id]
    );

    if (updateResult.rowCount === 0) {
      // Already processed (or order doesn't exist) — idempotent, return 200
      await client.query('ROLLBACK');
      return res.status(200).json({ received: true, note: 'already processed' });
    }

    // Insert member (ON CONFLICT prevents duplicates)
    await client.query(
      `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
       VALUES ($1, $2, $3, true)
       ON CONFLICT (group_id, user_id) DO NOTHING`,
      [groupId, userId, safeName]
    );

    // Increment prize pool
    await client.query(
      `UPDATE groups SET prize_pool_cents = prize_pool_cents + entry_fee_cents
       WHERE id = $1 AND entry_fee_cents > 0`,
      [groupId]
    );

    await client.query('COMMIT');
    console.log(`[payments] SUCCESS: User ${userId} joined group ${groupId} via payment ${session.id}`);
    return res.status(200).json({ received: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[payments] Webhook transaction error:', err.message);
    // Return 500 so Stripe retries (transient failure)
    return res.status(500).json({ error: 'Processing failed, will retry' });
  } finally {
    client.release();
  }
}
