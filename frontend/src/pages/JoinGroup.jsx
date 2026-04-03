import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';

function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export function JoinGroup() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { userId, user, register, login } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  // Auth form state (shown when not logged in)
  const [authMode, setAuthMode] = useState('register'); // 'register' | 'login'
  const [authEmail, setAuthEmail] = useState('');
  const [authName, setAuthName] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!code) return;
    fetch(`${API}/groups/invite/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setGroup)
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  }, [code]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    if (authMode === 'register' && authPassword.length < 8) {
      setAuthError('Password must be at least 8 characters.');
      return;
    }
    setAuthLoading(true);
    try {
      let authUser;
      if (authMode === 'register') {
        if (!authName.trim()) { setAuthError('Please enter your name.'); setAuthLoading(false); return; }
        authUser = await register(authEmail.trim(), authName.trim(), authPassword);
      } else {
        authUser = await login(authEmail.trim(), authPassword);
      }
      // Auto-join the group immediately after auth succeeds
      if (authUser && group) {
        join(authUser);
      }
    } catch (err) {
      setAuthError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const join = (currentUser) => {
    const uid = currentUser?.id || userId;
    const uName = currentUser?.displayName || user?.displayName || 'Player';
    if (!group || !uid) return;
    setJoining(true);
    setError('');
    fetch(`${API}/groups/${group.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: uid, displayName: uName })
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Failed'); });
        return r.json();
      })
      .then(() => navigate(`/group/${group.id}`))
      .catch((e) => setError(e.message || 'Could not join'))
      .finally(() => setJoining(false));
  };

  if (loading) return <div className="page-loading">Loading…</div>;

  if (!group) {
    return (
      <div className="page join-page">
        <div className="join-invalid">
          <span className="join-invalid-icon">🎾</span>
          <h2>Invalid invite code</h2>
          <p>This invite code isn't valid or has expired. Double-check the link and try again.</p>
          <Link to="/" className="btn primary">Back to home</Link>
        </div>
      </div>
    );
  }

  const isMember = group.members?.some((m) => m.userId === userId);
  const memberCount = group.members?.length ?? 0;

  return (
    <div className="page join-page">
      <div className="join-card">

        <div className="join-card-hero">
          <p className="join-eyebrow">🎾 You've been invited to join</p>
          <h1 className="join-group-name">{group.name}</h1>
        </div>

        <div className="join-details">
          <div className="join-detail-item">
            <span className="join-detail-value">{fmtGBP(group.entryFeeCents || 0)}</span>
            <span className="join-detail-label">Entry fee</span>
          </div>
          <div className="join-detail-divider" />
          <div className="join-detail-item">
            <span className="join-detail-value">{fmtGBP(group.prizePoolCents || 0)}</span>
            <span className="join-detail-label">Prize pool</span>
          </div>
          <div className="join-detail-divider" />
          <div className="join-detail-item">
            <span className="join-detail-value">{memberCount}</span>
            <span className="join-detail-label">Players in</span>
          </div>
        </div>

        <ul className="join-rules-list">
          <li>Pick one player per round — if they win, you survive</li>
          <li>You can never pick the same player twice</li>
          <li>Last player standing wins the entire prize pool</li>
        </ul>

        {group.betaFree && (
          <div className="beta-waiver-notice">
            <span className="beta-waiver-icon">🎁</span>
            <div>
              <p className="beta-waiver-title">Free entry</p>
              <p className="beta-waiver-sub">No payment required for this tournament.</p>
            </div>
          </div>
        )}

        {/* ── Not logged in: show register / login form ── */}
        {!userId && (
          <div className="join-auth-section">
            <div className="join-auth-tabs">
              <button
                className={`join-auth-tab${authMode === 'register' ? ' active' : ''}`}
                onClick={() => { setAuthMode('register'); setAuthError(''); setAuthPassword(''); }}
              >
                Create account
              </button>
              <button
                className={`join-auth-tab${authMode === 'login' ? ' active' : ''}`}
                onClick={() => { setAuthMode('login'); setAuthError(''); setAuthPassword(''); }}
              >
                Sign in
              </button>
            </div>

            <form className="join-auth-form" onSubmit={handleAuth}>
              {authMode === 'register' && (
                <input
                  className="input"
                  type="text"
                  placeholder="Your name"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  required
                  autoFocus
                />
              )}
              <input
                className="input"
                type="email"
                placeholder="Email address"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                required
                autoFocus={authMode === 'login'}
              />
              <input
                className="input"
                type="password"
                placeholder={authMode === 'register' ? 'Create a password (min. 8 characters)' : 'Password'}
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                required
              />
              {authError && <p className="error">{authError}</p>}
              <button
                type="submit"
                className="btn primary btn-lg join-submit-btn"
                disabled={authLoading}
              >
                {authLoading
                  ? (authMode === 'register' ? 'Creating account…' : 'Signing in…')
                  : (authMode === 'register' ? 'Create account & join →' : 'Sign in & join →')}
              </button>
              {authMode === 'register' && (
                <p className="join-auth-hint">We'll send you a confirmation email.</p>
              )}
            </form>
          </div>
        )}

        {/* ── Logged in: show join / already member ── */}
        {userId && (
          isMember ? (
            <div className="join-already">
              <p className="text-muted">You're already in this pool.</p>
              <Link to={`/group/${group.id}`} className="btn primary btn-lg">Go to group →</Link>
            </div>
          ) : (
            <div className="join-action">
              <p className="join-welcome">Joining as <strong>{user?.displayName}</strong></p>
              <button onClick={() => join()} className="btn primary btn-lg join-submit-btn" disabled={joining}>
                {joining ? 'Joining…' : group.betaFree ? 'Join free →' : `Join for ${fmtGBP(group.entryFeeCents || 0)} →`}
              </button>
              {!group.betaFree && (
                <p className="join-disclaimer">Entry fee is non-refundable once the tournament begins.</p>
              )}
              {error && <p className="error">{error}</p>}
            </div>
          )
        )}
      </div>
    </div>
  );
}
