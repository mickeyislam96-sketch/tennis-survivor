import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { Hero } from '../ui/Hero.jsx';
import { Section } from '../ui/Section.jsx';
import { Card } from '../ui/Card.jsx';
import { Button } from '../ui/Button.jsx';
import { Stat } from '../ui/Stat.jsx';
import './JoinGroup.css';

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
      if (authUser && group) {
        join(authUser);
      }
    } catch (err) {
      setAuthError(err.message || 'Sign-in failed. Please check your email and password, then try again.');
    } finally {
      setAuthLoading(false);
    }
  };

  const join = (currentUser) => {
    const uid = currentUser?.id || userId;
    const uName = currentUser?.displayName || user?.displayName || 'Player';
    if (!group || !uid) return;

    if (group.entryFeeCents && group.entryFeeCents > 0 && !group.betaFree) {
      setJoining(true);
      navigate(`/group/${group.id}/pay`);
      return;
    }

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
      .catch((e) => setError(e.message || 'Failed to join the pool. Please refresh the page and try again.'))
      .finally(() => setJoining(false));
  };

  if (loading) {
    return (
      <Section tone="canvas" size="lg">
        <p className="jg-loading">Loading invite…</p>
      </Section>
    );
  }

  if (!group) {
    return (
      <div className="jg-page">
        <Hero
          tone="primary"
          compact
          showCourt
          eyebrow="INVITE"
          title={<>That link <em>expired</em>.</>}
          lede="This invite code isn't valid or has already been used. Ask your pool host for a fresh link."
        />
        <Section tone="canvas" size="md">
          <Card tone="muted" padding="lg" className="jg-invalid-card">
            <div className="jg-invalid-icon" aria-hidden="true">🎾</div>
            <h2 className="jg-invalid-title">Invalid invite code</h2>
            <p className="jg-invalid-sub">
              Double-check the full URL, or ask the person who invited you to resend it.
            </p>
            <Button as={Link} to="/" variant="primary" size="md">
              Back to home
            </Button>
          </Card>
        </Section>
      </div>
    );
  }

  const isMember = group.members?.some((m) => m.userId === userId);
  const memberCount = group.members?.length ?? 0;

  return (
    <div className="jg-page">
      <Hero
        tone="primary"
        compact
        showCourt
        eyebrow="YOU'VE BEEN INVITED"
        title={<>Join <em>{group.name}</em>.</>}
        lede="One pick per round. Survive, or you're out. Last one standing takes the pot."
      />

      <Section tone="canvas" size="md">
        <Card tone="surface" padding="lg" className="jg-card">

          <div className="jg-stats">
            <Stat
              label="Entry fee"
              value={fmtGBP(group.entryFeeCents || 0)}
              tone={group.betaFree ? 'accent' : 'default'}
            />
            <Stat
              label="Prize pool"
              value={fmtGBP(group.prizePoolCents || 0)}
              tone="primary"
            />
            <Stat
              label="Players in"
              value={memberCount}
            />
          </div>

          <ul className="jg-rules">
            <li>Pick one player per round. If they win, you survive.</li>
            <li>You can never pick the same player twice.</li>
            <li>Last player standing takes the entire prize pool.</li>
          </ul>

          {group.betaFree && (
            <div className="jg-beta-notice">
              <span className="jg-beta-icon" aria-hidden="true">🎁</span>
              <div>
                <p className="jg-beta-title">Free entry</p>
                <p className="jg-beta-sub">No payment required for this tournament.</p>
              </div>
            </div>
          )}

          {/* ── Not logged in ── */}
          {!userId && (
            <div className="jg-auth">
              <div className="jg-auth-tabs" role="tablist">
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'register'}
                  className={`jg-auth-tab${authMode === 'register' ? ' is-active' : ''}`}
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthPassword(''); }}
                >
                  Create account
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={authMode === 'login'}
                  className={`jg-auth-tab${authMode === 'login' ? ' is-active' : ''}`}
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthPassword(''); }}
                >
                  Sign in
                </button>
              </div>

              <form className="jg-auth-form" onSubmit={handleAuth}>
                {authMode === 'register' && (
                  <input
                    className="jg-input"
                    type="text"
                    placeholder="Your name"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required
                    autoFocus
                  />
                )}
                <input
                  className="jg-input"
                  type="email"
                  placeholder="Email address"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  autoFocus={authMode === 'login'}
                />
                <input
                  className="jg-input"
                  type="password"
                  placeholder={authMode === 'register' ? 'Create a password (min. 8 characters)' : 'Password'}
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                />
                {authError && <p className="jg-error">{authError}</p>}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={authLoading}
                  fullWidth
                >
                  {authLoading
                    ? (authMode === 'register' ? 'Creating account…' : 'Signing in…')
                    : (authMode === 'register' ? 'Create account & join →' : 'Sign in & join →')}
                </Button>
                {authMode === 'register' && (
                  <p className="jg-auth-hint">We'll send you a confirmation email.</p>
                )}
              </form>
            </div>
          )}

          {/* ── Logged in ── */}
          {userId && (
            isMember ? (
              <div className="jg-already">
                <p className="jg-already-msg">You're already in this pool.</p>
                <Button as={Link} to={`/group/${group.id}`} variant="primary" size="lg" fullWidth>
                  Go to pool →
                </Button>
              </div>
            ) : (
              <div className="jg-action">
                <p className="jg-welcome">Joining as <strong>{user?.displayName}</strong></p>
                <Button
                  onClick={() => join()}
                  variant="primary"
                  size="lg"
                  disabled={joining}
                  fullWidth
                >
                  {joining ? 'Joining…' : group.betaFree ? 'Join free →' : `Join for ${fmtGBP(group.entryFeeCents || 0)} →`}
                </Button>
                {!group.betaFree && (
                  <p className="jg-disclaimer">Entry fee is non-refundable once the tournament begins.</p>
                )}
                {error && <p className="jg-error">{error}</p>}
              </div>
            )
          )}
        </Card>
      </Section>
    </div>
  );
}
