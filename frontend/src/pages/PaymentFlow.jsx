/**
 * PaymentFlow — handles the paid group entry flow.
 *
 * Route: /group/:groupId/pay
 *
 * Flow:
 * 1. Creates a payment order via backend
 * 2. Redirects to processor's hosted checkout (when configured)
 * 3. On return, polls order status until confirmed
 * 4. Auto-joins user to group on confirmation
 * 5. Redirects to group home
 *
 * While processor is not yet configured, shows a "coming soon" state.
 */

import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, API } from '../App';

export function PaymentFlow() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId, isRegistered } = useAuth();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | created | processing | confirmed | failed | error
  const [error, setError] = useState('');
  const [groupName, setGroupName] = useState('');
  const pollRef = useRef(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!isRegistered || !userId) {
      navigate(`/group/${groupId}`);
    }
  }, [isRegistered, userId, groupId, navigate]);

  // Check if returning from processor checkout
  const returningOrderId = searchParams.get('orderId');
  const paymentResult = searchParams.get('result'); // 'success' or 'cancel'

  // Step 1: Create order or check returning order
  useEffect(() => {
    if (!userId || !groupId) return;

    const init = async () => {
      try {
        if (returningOrderId) {
          // Returning from processor — poll status
          setStatus('processing');
          startPolling(returningOrderId);
          return;
        }

        if (paymentResult === 'cancel') {
          setStatus('failed');
          setError('Payment was cancelled. You can try again.');
          return;
        }

        // Create a new order
        const res = await fetch(`${API}/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId, userId }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === 'Already a member of this group') {
            navigate(`/group/${groupId}`);
            return;
          }
          throw new Error(data.error || 'Failed to create payment');
        }

        setOrder(data);
        setGroupName(data.groupName || '');

        if (data.status === 'confirmed') {
          // Already paid (e.g. via webhook while on this page)
          setStatus('confirmed');
          setTimeout(() => navigate(`/group/${groupId}`), 2000);
          return;
        }

        if (data.checkoutUrl) {
          // Processor is configured — redirect to checkout
          window.location.href = data.checkoutUrl;
          return;
        }

        // No processor configured yet — show pending state
        setStatus('created');
      } catch (err) {
        setStatus('error');
        setError(err.message);
      }
    };

    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, groupId, returningOrderId, paymentResult, navigate]);

  // Poll order status after returning from checkout
  const startPolling = (orderId) => {
    let attempts = 0;
    const maxAttempts = 30; // 30 * 2s = 60s max

    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/payments/${orderId}`);
        const data = await res.json();

        if (data.status === 'confirmed') {
          clearInterval(pollRef.current);
          setStatus('confirmed');
          setTimeout(() => navigate(`/group/${groupId}`), 2000);
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current);
          setStatus('failed');
          setError('Payment was not successful. Please try again.');
        } else if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          setStatus('error');
          setError('Payment verification timed out. If you were charged, contact us and we will sort it out.');
        }
      } catch {
        // Network error — keep trying
      }
    }, 2000);
  };

  const fmtAmount = (cents) => `£${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;

  const retryPayment = () => {
    setStatus('loading');
    setError('');
    setOrder(null);
    navigate(`/group/${groupId}/pay`, { replace: true });
  };

  return (
    <div className="page payment-flow">
      <div className="payment-card">
        {status === 'loading' && (
          <div className="payment-status">
            <div className="spinner" />
            <h2>Setting up payment…</h2>
          </div>
        )}

        {status === 'created' && order && (
          <div className="payment-status">
            <h2>Entry Payment</h2>
            {groupName && <p className="payment-group">{groupName}</p>}
            <div className="payment-amount">{fmtAmount(order.amountCents)}</div>
            <p className="payment-note">
              Payment processing is being set up. Entry payments will be available shortly.
              You can still join for free during the setup period — check back soon.
            </p>
            <button className="btn primary" onClick={() => navigate(`/group/${groupId}`)}>
              Back to group
            </button>
          </div>
        )}

        {status === 'processing' && (
          <div className="payment-status">
            <div className="spinner" />
            <h2>Verifying payment…</h2>
            <p>This usually takes a few seconds.</p>
          </div>
        )}

        {status === 'confirmed' && (
          <div className="payment-status payment-success">
            <div className="payment-checkmark">✓</div>
            <h2>Payment confirmed!</h2>
            <p>You're in. Redirecting to your group…</p>
          </div>
        )}

        {(status === 'failed' || status === 'error') && (
          <div className="payment-status payment-error">
            <h2>{status === 'failed' ? 'Payment failed' : 'Something went wrong'}</h2>
            <p>{error}</p>
            <div className="payment-actions">
              <button className="btn primary" onClick={retryPayment}>
                Try again
              </button>
              <button className="btn secondary" onClick={() => navigate(`/group/${groupId}`)}>
                Back to group
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
