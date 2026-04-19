/**
 * Payment routes — handles order creation, status checks, webhooks, and admin ops.
 *
 * POST /api/payments/create-order   — start a payment for a paid group
 * GET  /api/payments/:orderId       — check order status (frontend polls this)
 * POST /api/payments/webhook/:proc  — processor webhook callback
 * GET  /api/payments/admin/list     — admin: all payment orders
 * POST /api/payments/admin/refund   — admin: refund an order
 */

import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db/pool.js';
import {
  createPaymentOrder,
  setProcessorDetails,
  confirmPaymentAndJoin,
  getOrderById,
  getOrderByProcessorId,
  logWebhook,
  failPayment,
  refundPayment,
} from '../services/paymentService.js';

/**
 * Verify webhook signature from payment processor.
 * Uses HMAC-SHA256 with the processor's webhook secret.
 * Returns true if signature is valid, false otherwise.
 */
function verifyWebhookSignature(processor, headers, rawBody) {
  const secretEnvVar = `${processor.toUpperCase()}_WEBHOOK_SECRET`;
  const secret = process.env[secretEnvVar] || process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) {
    // No secret configured — reject all webhooks for safety.
    // This forces us to set up the secret before payments can work.
    console.error(`[payments] No webhook secret configured (set ${secretEnvVar} or PAYMENT_WEBHOOK_SECRET)`);
    return false;
  }

  // Support common signature header formats
  const signature = headers['x-webhook-signature']
    || headers['x-signature']
    || headers['stripe-signature']
    || headers['x-quadrapay-signature'];

  if (!signature) {
    console.warn(`[payments] Webhook from ${processor} missing signature header`);
    return false;
  }

  // HMAC-SHA256 verification
  const expected = crypto
    .createHmac('sha256', secret)
    .update(typeof rawBody === 'string' ? rawBody : JSON.stringify(rawBody))
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    // Lengths differ — signatures don't match
    return false;
  }
}

export const paymentsRouter = Router();

// ── Rate limiting (simple in-memory, fine for <1000 users) ──────────────────
const rateLimits = new Map();
function rateLimit(key, maxPerMinute = 10) {
  const now = Date.now();
  const window = rateLimits.get(key) || [];
  const recent = window.filter(t => now - t < 60000);
  if (recent.length >= maxPerMinute) return false;
  recent.push(now);
  rateLimits.set(key, recent);
  return true;
}

// ── POST /api/payments/create-order ─────────────────────────────────────────
paymentsRouter.post('/create-order', async (req, res) => {
  const { groupId, userId } = req.body;
  if (!groupId || !userId) {
    return res.status(400).json({ error: 'groupId and userId required' });
  }

  if (!rateLimit(`create:${userId}`, 5)) {
    return res.status(429).json({ error: 'Too many requests. Try again in a minute.' });
  }

  try {
    // Check group exists and has an entry fee
    const groupResult = await pool.query(
      'SELECT id, entry_fee_cents, name, tournament_id FROM groups WHERE id = $1',
      [groupId]
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }
    const group = groupResult.rows[0];

    if (!group.entry_fee_cents || group.entry_fee_cents === 0) {
      return res.status(400).json({ error: 'This group is free. Use the join endpoint directly.' });
    }

    // Check if already a member
    const memberResult = await pool.query(
      'SELECT id FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, userId]
    );
    if (memberResult.rows.length > 0) {
      return res.status(400).json({ error: 'Already a member of this group' });
    }

    // Create or retrieve existing order (idempotent)
    const order = await createPaymentOrder(groupId, userId, group.entry_fee_cents);

    // If order already has a checkout URL (user refreshed), return it
    if (order.processor_checkout_url && order.status === 'awaiting_payment') {
      return res.json({
        orderId: order.id,
        status: order.status,
        checkoutUrl: order.processor_checkout_url,
        amountCents: order.amount_cents,
        currency: order.currency,
      });
    }

    // TODO: When processor is configured, call adapter here to get checkout URL.
    // For now, return the order in pending state.
    // Example (QuadraPay):
    //   const checkout = await quadrapay.createCheckout(order);
    //   await setProcessorDetails(order.id, 'quadrapay', checkout.id, checkout.url);

    res.json({
      orderId: order.id,
      status: order.status,
      checkoutUrl: null,  // Will be populated once processor is configured
      amountCents: order.amount_cents,
      currency: order.currency,
      groupName: group.name,
    });
  } catch (err) {
    console.error('Create payment order error:', err.message);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// ── GET /api/payments/:orderId ──────────────────────────────────────────────
paymentsRouter.get('/:orderId', async (req, res) => {
  try {
    const order = await getOrderById(req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    res.json(order);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch order' });
  }
});

// ── POST /api/payments/webhook/:processor ───────────────────────────────────
// Generic webhook endpoint. Each processor posts here; we route by name.
paymentsRouter.post('/webhook/:processor', async (req, res) => {
  const { processor } = req.params;
  const payload = req.body;

  try {
    // Log the webhook (dedup by webhook ID if provided)
    const webhookId = payload.webhook_id || payload.id || null;
    const { duplicate } = await logWebhook(processor, webhookId, payload);
    if (duplicate) {
      return res.status(200).json({ ok: true, message: 'Duplicate webhook, already processed' });
    }

    // Verify webhook signature before processing any payment events.
    // This prevents forged payment confirmations from granting free access.
    if (!verifyWebhookSignature(processor, req.headers, req.body)) {
      console.warn(`[payments] Webhook signature verification FAILED for ${processor}`);
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    // Route to processor-specific handling
    if (processor === 'quadrapay') {
      const processorOrderId = payload.order_id || payload.transaction_id;
      const status = payload.status;

      if (!processorOrderId) {
        console.warn('QuadraPay webhook missing order_id');
        return res.status(200).json({ ok: true });
      }

      const order = await getOrderByProcessorId(processorOrderId);
      if (!order) {
        console.warn(`Webhook for unknown processor order: ${processorOrderId}`);
        return res.status(200).json({ ok: true });
      }

      if (status === 'success' || status === 'completed' || status === 'confirmed') {
        const result = await confirmPaymentAndJoin(order.id, payload.ref || processorOrderId);
        console.log(`Payment confirmed for order ${order.id}:`, result);
      } else if (status === 'failed' || status === 'cancelled' || status === 'declined') {
        await failPayment(order.id, status);
        console.log(`Payment failed for order ${order.id}: ${status}`);
      }
    } else {
      console.warn(`Unknown payment processor: ${processor}`);
    }

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(`Webhook error (${processor}):`, err.message);
    // Always return 200 to prevent processor retrying on our errors
    res.status(200).json({ ok: false, message: 'Processing error logged' });
  }
});

// ── Admin auth helper (Authorization header or body.secret) ─────────────────
function checkAdminAuth(req, res) {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) { res.status(401).json({ error: 'Unauthorised' }); return false; }
  let provided = null;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) provided = authHeader.slice(7);
  if (!provided && req.body?.secret) provided = req.body.secret;
  if (!provided || provided !== adminSecret) { res.status(401).json({ error: 'Unauthorised' }); return false; }
  return true;
}

// ── Admin: list all payment orders ──────────────────────────────────────────
paymentsRouter.get('/admin/list', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const result = await pool.query(`
      SELECT po.id, po.group_id, po.user_id, po.amount_cents, po.status,
             po.processor_name, po.processor_order_id, po.confirmed_at, po.created_at,
             g.name AS group_name, g.tournament_id,
             u.email, u.display_name
      FROM payment_orders po
      JOIN groups g ON g.id = po.group_id
      JOIN users u ON u.id = po.user_id
      ORDER BY po.created_at DESC
    `);
    res.json({ count: result.rows.length, orders: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: revenue summary ──────────────────────────────────────────────────
paymentsRouter.get('/admin/revenue', async (req, res) => {
  if (!checkAdminAuth(req, res)) return;

  try {
    const result = await pool.query(`
      SELECT g.tournament_id,
             COUNT(*) FILTER (WHERE po.status = 'confirmed') AS confirmed_count,
             COALESCE(SUM(po.amount_cents) FILTER (WHERE po.status = 'confirmed'), 0) AS total_cents,
             COUNT(*) FILTER (WHERE po.status = 'pending' OR po.status = 'awaiting_payment') AS pending_count,
             COUNT(*) FILTER (WHERE po.status = 'failed') AS failed_count,
             COUNT(*) FILTER (WHERE po.status = 'refunded') AS refunded_count
      FROM payment_orders po
      JOIN groups g ON g.id = po.group_id
      GROUP BY g.tournament_id
      ORDER BY g.tournament_id
    `);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Admin: refund a specific order ──────────────────────────────────────────
paymentsRouter.post('/admin/refund', async (req, res) => {
  const { secret, orderId } = req.body;
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorised' });
  }
  if (!orderId) return res.status(400).json({ error: 'orderId required' });

  try {
    // TODO: Call processor-specific refund API here before marking in DB
    const result = await refundPayment(orderId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
