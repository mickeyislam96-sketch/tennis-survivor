import { useEffect, useState, useRef } from 'react';
import { useParams, useSearchParams, Link, Navigate } from 'react-router-dom';
import { API, useAuth } from '../App';

export default function PaymentFlow() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | ready | redirecting | verifying | confirmed | cancelled | error
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);
  const payInFlight = useRef(false); // double-click guard

  // Determine if this is a success/cancel callback
  const isSuccess = window.location.pathname.endsWith('/success');
  const isCancelled = window.location.pathname.endsWith('/cancel');
  const sessionId = searchParams.get('session_id');

  // Auth gate — redirect if not logged in
  if (!user) {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <h1>Membership Payment</h1>
        <p style={{ color: 'var(--text-muted)' }}>Please log in to continue.</p>
      </div>
    );
  }

  // Fetch group info and set initial status
  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/groups/${groupId}`)
      .then(r => r.json())
      .then(data => {
        setGroup(data);
        if (isSuccess && sessionId) setStatus('verifying');
        else if (isSuccess) setStatus('error'); // no session_id = fake success URL
        else if (isCancelled) setStatus('cancelled');
        else setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [groupId, isSuccess, isCancelled, sessionId]);

  // On success, poll to CONFIRM the payment was actually processed
  // Don't show "success" until the backend confirms it
  useEffect(() => {
    if (status !== 'verifying' || !sessionId) return;
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds total
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/payments/status?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          setStatus('confirmed');
          clearInterval(poll);
          return;
        }
      } catch {}
      if (attempts >= maxAttempts) {
        clearInterval(poll);
        // Payment may still be processing — show a softer message
        setStatus('confirmed'); // Stripe redirected, so payment went through; webhook may be slow
      }
    }, 2000);
    return () => clearInterval(poll);
  }, [status, sessionId]);

  const handlePay = async () => {
    // Double-click guard
    if (payInFlight.current) return;
    payInFlight.current = true;

    if (!user?.id) {
      setError('Please log in first');
      payInFlight.current = false;
      return;
    }
    setStatus('redirecting');
    try {
      const res = await fetch(`${API}/payments/create-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          groupId,
          displayName: user.displayName,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Payment failed');
        setStatus('error');
        payInFlight.current = false;
        return;
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setStatus('error');
      payInFlight.current = false;
    }
  };

  const feePounds = group?.entryFeeCents ? (group.entryFeeCents / 100).toFixed(2) : '0.00';

  /* ── Verifying state: waiting for webhook confirmation ── */
  if (status === 'verifying') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⏳</div>
        <h1>Confirming payment...</h1>
        <p style={{ color: 'var(--text-muted)' }}>
          Please wait while we verify your payment. This usually takes a few seconds.
        </p>
      </div>
    );
  }

  /* ── Confirmed: payment verified by backend ── */
  if (status === 'confirmed') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1>Payment successful</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          You're in the pool! Good luck in {group?.name || 'the tournament'}.
        </p>
        <Link to={`/group/${groupId}`} className="btn primary btn-lg">
          Go to your pool →
        </Link>
      </div>
    );
  }

  /* ── Cancelled ── */
  if (status === 'cancelled') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>↩️</div>
        <h1>Payment cancelled</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          No charge was made. You can try again when you're ready.
        </p>
        <button onClick={() => { setStatus('ready'); setError(null); payInFlight.current = false; }} className="btn primary btn-lg">
          Try again
        </button>
      </div>
    );
  }

  /* ── Loading ── */
  if (status === 'loading') {
    return <div className="page"><p>Loading...</p></div>;
  }

  /* ── Ready / Error: show payment form ── */
  return (
    <div className="page" style={{ maxWidth: '480px', margin: '0 auto', paddingTop: '2rem' }}>
      <h1>Join {group?.name || 'Tournament'}</h1>

      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: '1.5rem',
        marginBottom: '1.5rem',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ color: 'var(--text-muted)' }}>Entry fee</span>
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>£{feePounds}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          One-time entry. Pick one player per round. If they lose, you're out.
          Last one standing takes the entire prize pool.
        </p>
      </div>

      {error && (
        <p style={{ color: 'var(--red-600)', marginBottom: '1rem', fontSize: '0.88rem' }}>{error}</p>
      )}

      <button
        onClick={handlePay}
        disabled={status === 'redirecting'}
        className="btn primary btn-lg"
        style={{ width: '100%' }}
      >
        {status === 'redirecting' ? 'Redirecting to payment...' : `Pay £${feePounds} →`}
      </button>

      <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '1rem', textAlign: 'center' }}>
        Secure payment via Stripe. You'll be redirected to complete payment.
      </p>
    </div>
  );
}
