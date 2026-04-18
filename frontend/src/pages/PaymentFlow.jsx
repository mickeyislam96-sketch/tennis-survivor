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
import { Section } from '../ui/Section.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import './PaymentFlow.css';

export function PaymentFlow() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { userId, isRegistered } = useAuth();

  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [groupName, setGroupName] = useState('');
  const pollRef = useRef(null);

  useEffect(() => {
    if (!isRegistered || !userId) {
      navigate(`/group/${groupId}`);
    }
  }, [isRegistered, userId, groupId, navigate]);

  const returningOrderId = searchParams.get('orderId');
  const paymentResult = searchParams.get('result');

  useEffect(() => {
    if (!userId || !groupId) return;

    const init = async () => {
      try {
        if (returningOrderId) {
          setStatus('processing');
          startPolling(returningOrderId);
          return;
        }

        if (paymentResult === 'cancel') {
          setStatus('failed');
          setError("Payment was cancelled. You can try again whenever you're ready.");
          return;
        }

        const res = await fetch(`${API}/payments/create-order`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ groupId, userId }),
        });

        const data = await res.json();

        if (!res.ok) {
          if (data.error === 'Already a member of this pool') {
            navigate(`/group/${groupId}`);
            return;
          }
          throw new Error(data.error || 'Failed to process the payment. Please refresh the page and try again.');
        }

        setOrder(data);
        setGroupName(data.groupName || '');

        if (data.status === 'confirmed') {
          setStatus('confirmed');
          setTimeout(() => navigate(`/group/${groupId}`), 2000);
          return;
        }

        if (data.checkoutUrl) {
          window.location.href = data.checkoutUrl;
          return;
        }

        setStatus('created');
      } catch (err) {
        setStatus('error');
        setError(err.message || 'Something went wrong. Please try again in a moment.');
      }
    };

    init();

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [userId, groupId, returningOrderId, paymentResult, navigate]);

  const startPolling = (orderId) => {
    let attempts = 0;
    const maxAttempts = 30;

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
          setError('Payment was declined. Please check your card details and try again.');
        } else if (attempts >= maxAttempts) {
          clearInterval(pollRef.current);
          setStatus('error');
          setError("Payment is taking longer than expected. If your card was charged, we'll sort it out. Contact us and let us know.");
        }
      } catch {
        /* keep trying */
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
    <div className="pf-page">
      <Section tone="canvas" size="lg">
        <Card tone="surface" padding="lg" className="pf-card">

          {status === 'loading' && (
            <div className="pf-state">
              <div className="pf-spinner" aria-hidden="true" />
              <h2 className="pf-title">Setting up payment…</h2>
              <p className="pf-sub">Just a moment.</p>
            </div>
          )}

          {status === 'created' && order && (
            <div className="pf-state">
              <p className="pf-eyebrow">ENTRY PAYMENT</p>
              {groupName && <p className="pf-group">{groupName}</p>}
              <div className="pf-amount">{fmtAmount(order.amountCents)}</div>
              <p className="pf-sub">
                Payment processing is being set up. Entry payments will be available shortly.
                You can still join for free during the setup period — check back soon.
              </p>
              <Button
                variant="primary"
                size="md"
                onClick={() => navigate(`/group/${groupId}`)}
              >
                Back to pool
              </Button>
            </div>
          )}

          {status === 'processing' && (
            <div className="pf-state">
              <div className="pf-spinner" aria-hidden="true" />
              <h2 className="pf-title">Verifying payment…</h2>
              <p className="pf-sub">This usually takes a few seconds.</p>
            </div>
          )}

          {status === 'confirmed' && (
            <div className="pf-state pf-state--success">
              <div className="pf-check" aria-hidden="true">✓</div>
              <h2 className="pf-title">Payment confirmed.</h2>
              <p className="pf-sub">You're in. Redirecting to your pool…</p>
            </div>
          )}

          {(status === 'failed' || status === 'error') && (
            <div className="pf-state pf-state--error">
              <h2 className="pf-title">
                {status === 'failed' ? 'Payment failed' : 'Something went wrong'}
              </h2>
              <p className="pf-sub">{error}</p>
              <div className="pf-actions">
                <Button variant="primary" size="md" onClick={retryPayment}>
                  Try again
                </Button>
                <Button
                  variant="secondary"
                  size="md"
                  onClick={() => navigate(`/group/${groupId}`)}
                >
                  Back to pool
                </Button>
              </div>
            </div>
          )}

        </Card>
      </Section>
    </div>
  );
}
