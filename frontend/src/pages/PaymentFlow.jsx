import { useEffect, useState } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { API, useAuth } from '../App';

export default function PaymentFlow() {
  const { groupId } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState('loading'); // loading | ready | redirecting | success | cancelled | error
  const [group, setGroup] = useState(null);
  const [error, setError] = useState(null);

  // Determine if this is a success/cancel callback
  const isSuccess = window.location.pathname.endsWith('/success');
  const isCancelled = window.location.pathname.endsWith('/cancel');
  const sessionId = searchParams.get('session_id');

  // Fetch group info
  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/groups/${groupId}`)
      .then(r => r.json())
      .then(data => {
        setGroup(data);
        if (isSuccess) setStatus('success');
        else if (isCancelled) setStatus('cancelled');
        else setStatus('ready');
      })
      .catch(() => setStatus('error'));
  }, [groupId]);

  // On success, poll to confirm the webhook processed
  useEffect(() => {
    if (status !== 'success' || !sessionId) return;
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/payments/status?sessionId=${sessionId}`);
        const data = await res.json();
        if (data.status === 'completed') {
          clearInterval(poll);
        }
      } catch {}
      if (attempts >= 10) clearInterval(poll);
    }, 2000);
    return () => clearInterval(poll);
  }, [status, sessionId]);

  const handlePay = async () => {
    if (!user?.id) {
      setError('Please log in first');
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
        return;
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  const feePounds = group?.entryFeeCents ? (group.entryFeeCents / 100).toFixed(2) : '0.00';

  if (!user) {
    return (
      <div className="page">
        <h1>Membership Payment</h1>
        <p>Please log in to continue.</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
        <h1>Payment successful</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          You're in! Your membership for {group?.name || 'this tournament'} is confirmed.
        </p>
        <Link to={`/group/${groupId}`} className="btn primary btn-lg">
          Go to your pool →
        </Link>
      </div>
    );
  }

  if (status === 'cancelled') {
    return (
      <div className="page" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>↩️</div>
        <h1>Payment cancelled</h1>
        <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
          No charge was made. You can try again when you're ready.
        </p>
        <button onClick={() => setStatus('ready')} className="btn primary btn-lg">
          Try again
        </button>
      </div>
    );
  }

  if (status === 'loading') {
    return <div className="page"><p>Loading...</p></div>;
  }

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
          <span style={{ color: 'var(--text-muted)' }}>Season membership</span>
          <span style={{ fontWeight: 700, fontSize: '1.25rem' }}>£{feePounds}</span>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>
          One-time payment. Includes entry to the full tournament prediction league.
          If your player loses in any round, you're eliminated. Last one standing wins the prize pool.
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
