import { Router } from 'express';
import Stripe from 'stripe';
import { pool } from '../db/pool.js';
import { getTournament } from '../data/tournaments.js';

export const paymentsRouter = Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/* ─── Helper ─────────────────────────────────────────── */

function cents(n) { return Math.round(Number(n) || 0); }

/* ─── POST /api/payments/create-checkout ──────────────── *
 *  Body: { userId, groupId, displayName }
 *  Creates a Stripe Checkout Session for the group's entry fee.
 *  Returns { url } — the hosted Stripe Checkout page URL.
 * ──────────────────────────────────────────────────────── */
paymentsRouter.post('/create-checkout', async (req, res) => {
  const { userId, groupId, displayName } = req.body;
  if (!userId || !groupId) {
    return res.status(400).json({ error: 'userId and groupId are required' });
  }

  try {
    // 1. Fetch group and check it exists + has an entry fee
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

    // 2. Check user isn't already a member
    const existing = await pool.query(
      `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [groupId, userId]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'You are already a member of this group' });
    }

    // 3. Check for an existing pending/completed checkout for this user+group
    const existingOrder = await pool.query(
      `SELECT stripe_session_id, status FROM payment_orders
       WHERE user_id = $1 AND group_id = $2 AND status = 'completed'`,
      [userId, groupId]
    );
    if (existingOrder.rows.length > 0) {
      return res.status(400).json({ error: 'Payment already completed for this group' });
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
        displayName: (displayName || 'Player').trim(),
      },
      success_url: `${frontendUrl}/group/${groupId}/pay/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${frontendUrl}/group/${groupId}/pay/cancel`,
      expires_at: Math.floor(Date.now() / 1000) + 1800, // 30 minutes from now
    });

    // 6. Record the order
    await pool.query(
      `INSERT INTO payment_orders (user_id, group_id, stripe_session_id, amount_cents, currency, status)
       VALUES ($1, $2, $3, $4, 'gbp', 'pending')`,
      [userId, groupId, session.id, fee]
    );

    return res.json({ url: session.url, sessionId: session.id });
  } catch (err) {
    console.error('[payments] create-checkout error:', err.message);
    return res.status(500).json({ error: 'Failed to create checkout session' });
  }
});

/* ─── GET /api/payments/status?sessionId=X ───────────── *
 *  Check the status of a payment by Stripe session ID.
 * ──────────────────────────────────────────────────────── */
paymentsRouter.get('/status', async (req, res) => {
  const { sessionId } = req.query;
  if (!sessionId) return res.status(400).json({ error: 'sessionId required' });

  try {
    const result = await pool.query(
      `SELECT status, user_id::text, group_id::text FROM payment_orders WHERE stripe_session_id = $1`,
      [sessionId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    return res.json(result.rows[0]);
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
 *  so it must be mounted BEFORE express.json() middleware,
 *  or use express.raw() specifically for this path.
 * ──────────────────────────────────────────────────────── */
export async function handleStripeWebhook(req, res) {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[payments] Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, groupId, displayName } = session.metadata || {};

    if (!userId || !groupId) {
      console.error('[payments] Webhook missing metadata:', session.id);
      return res.status(200).json({ received: true });
    }

    try {
      // Mark order as completed
      await pool.query(
        `UPDATE payment_orders SET status = 'completed', completed_at = NOW()
         WHERE stripe_session_id = $1`,
        [session.id]
      );

      // Join user to group (idempotent — skip if already member)
      const existing = await pool.query(
        `SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2`,
        [groupId, userId]
      );
      if (existing.rows.length === 0) {
        await pool.query(
          `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
           VALUES ($1, $2, $3, true)`,
          [groupId, userId, (displayName || 'Player').trim()]
        );

        // Increment prize pool
        await pool.query(
          `UPDATE groups SET prize_pool_cents = prize_pool_cents + entry_fee_cents
           WHERE id = $1 AND entry_fee_cents > 0`,
          [groupId]
        );

        console.log(`[payments] User ${userId} joined group ${groupId} via Stripe payment ${session.id}`);
      }
    } catch (err) {
      console.error('[payments] Webhook processing error:', err.message);
      // Return 200 anyway so Stripe doesn't retry
    }
  }

  res.status(200).json({ received: true });
}
