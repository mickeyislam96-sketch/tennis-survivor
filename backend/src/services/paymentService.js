/**
 * Payment service — processor-agnostic core operations.
 * Handles order creation, confirmation, webhook logging, and the
 * atomic confirm-and-join transaction.
 *
 * All processor-specific logic lives in adapter files (e.g. quadrapayAdapter.js).
 */

import { pool } from '../db/pool.js';

/**
 * Create (or return existing) payment order for a user + group.
 * Idempotent: ON CONFLICT returns the existing row unchanged.
 */
export async function createPaymentOrder(groupId, userId, amountCents) {
  const result = await pool.query(
    `INSERT INTO payment_orders (group_id, user_id, amount_cents, currency)
     VALUES ($1, $2, $3, 'GBP')
     ON CONFLICT(group_id, user_id) DO UPDATE SET group_id = payment_orders.group_id
     RETURNING id, group_id, user_id, amount_cents, currency, status,
               processor_checkout_url, created_at`,
    [groupId, userId, amountCents]
  );
  return result.rows[0];
}

/**
 * Attach processor details to an order after initiating checkout.
 */
export async function setProcessorDetails(orderId, processorName, processorOrderId, checkoutUrl) {
  await pool.query(
    `UPDATE payment_orders
     SET processor_name = $2, processor_order_id = $3,
         processor_checkout_url = $4, status = 'awaiting_payment'
     WHERE id = $1`,
    [orderId, processorName, processorOrderId, checkoutUrl]
  );
  await logPaymentEvent(orderId, 'sent_to_processor', { processorName, processorOrderId });
}

/**
 * Confirm payment and auto-join user to group in a single transaction.
 * Returns { joined: true } on success, { alreadyJoined: true } if already done.
 */
export async function confirmPaymentAndJoin(orderId, processorRef) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Lock the order row to prevent double-processing
    const orderResult = await client.query(
      'SELECT id, group_id, user_id, amount_cents, status FROM payment_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (orderResult.rows.length === 0) throw new Error('Order not found');
    const order = orderResult.rows[0];

    if (order.status === 'confirmed') {
      await client.query('COMMIT');
      return { alreadyJoined: true };
    }

    // Mark confirmed
    await client.query(
      `UPDATE payment_orders SET status = 'confirmed', processor_ref = $2, confirmed_at = NOW()
       WHERE id = $1`,
      [orderId, processorRef || null]
    );

    // Get user display name
    const userResult = await client.query(
      'SELECT display_name FROM users WHERE id = $1',
      [order.user_id]
    );
    const displayName = userResult.rows[0]?.display_name || 'Player';

    // Join group (idempotent — ON CONFLICT does nothing if already a member)
    await client.query(
      `INSERT INTO group_members (group_id, user_id, display_name, is_alive)
       VALUES ($1, $2, $3, true)
       ON CONFLICT(group_id, user_id) DO NOTHING`,
      [order.group_id, order.user_id, displayName]
    );

    // Increment prize pool
    await client.query(
      `UPDATE groups SET prize_pool_cents = prize_pool_cents + $2
       WHERE id = $1`,
      [order.group_id, order.amount_cents]
    );

    // Log event
    await client.query(
      `INSERT INTO payment_events (payment_order_id, event_type, details)
       VALUES ($1, 'confirmed', $2)`,
      [orderId, JSON.stringify({ processorRef })]
    );

    await client.query('COMMIT');
    return { joined: true, groupId: order.group_id, userId: order.user_id };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Look up an order by processor's external ID.
 */
export async function getOrderByProcessorId(processorOrderId) {
  const result = await pool.query(
    'SELECT * FROM payment_orders WHERE processor_order_id = $1',
    [processorOrderId]
  );
  return result.rows[0] || null;
}

/**
 * Get order by our internal ID.
 */
export async function getOrderById(orderId) {
  const result = await pool.query(
    `SELECT id, group_id, user_id, amount_cents, currency, status,
            processor_name, processor_checkout_url, confirmed_at, created_at
     FROM payment_orders WHERE id = $1`,
    [orderId]
  );
  return result.rows[0] || null;
}

/**
 * Log a webhook payload (for audit and dedup).
 */
export async function logWebhook(processorName, webhookId, payload) {
  // Dedup by webhook_id if provided
  if (webhookId) {
    const existing = await pool.query(
      'SELECT id FROM payment_webhooks WHERE webhook_id = $1',
      [webhookId]
    );
    if (existing.rows.length > 0) return { duplicate: true };
  }

  await pool.query(
    `INSERT INTO payment_webhooks (processor_name, webhook_id, raw_payload)
     VALUES ($1, $2, $3)`,
    [processorName, webhookId, JSON.stringify(payload)]
  );
  return { duplicate: false };
}

/**
 * Mark a payment as failed.
 */
export async function failPayment(orderId, reason) {
  await pool.query(
    "UPDATE payment_orders SET status = 'failed' WHERE id = $1",
    [orderId]
  );
  await logPaymentEvent(orderId, 'failed', { reason });
}

/**
 * Process a refund — marks order as refunded and removes user from group.
 */
export async function refundPayment(orderId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT group_id, user_id, amount_cents FROM payment_orders WHERE id = $1 FOR UPDATE',
      [orderId]
    );
    if (orderResult.rows.length === 0) throw new Error('Order not found');
    const order = orderResult.rows[0];

    await client.query(
      "UPDATE payment_orders SET status = 'refunded' WHERE id = $1",
      [orderId]
    );

    // Remove from group
    await client.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2',
      [order.group_id, order.user_id]
    );

    // Decrement prize pool
    await client.query(
      'UPDATE groups SET prize_pool_cents = GREATEST(0, prize_pool_cents - $2) WHERE id = $1',
      [order.group_id, order.amount_cents]
    );

    await client.query(
      `INSERT INTO payment_events (payment_order_id, event_type, details)
       VALUES ($1, 'refunded', '{}')`,
      [orderId]
    );

    await client.query('COMMIT');
    return { refunded: true };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Internal helper — log a payment lifecycle event. */
async function logPaymentEvent(orderId, eventType, details = {}) {
  await pool.query(
    `INSERT INTO payment_events (payment_order_id, event_type, details)
     VALUES ($1, $2, $3)`,
    [orderId, eventType, JSON.stringify(details)]
  );
}
