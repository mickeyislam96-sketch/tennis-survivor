import React, { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Button } from '../ui/Button.jsx';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './Layout.css';

// ── Error Boundary ─────────────────────────────────────────────
// Catches render errors and shows a friendly fallback instead of
// a white screen. This has saved us from 3 separate incidents.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '60vh', padding: '2rem',
          fontFamily: 'Outfit, sans-serif', textAlign: 'center',
        }}>
          <h2 style={{ fontSize: '1.5rem', marginBottom: '0.5rem', color: '#141414' }}>
            Something went wrong
          </h2>
          <p style={{ color: '#4A4A46', marginBottom: '1.5rem', maxWidth: '400px' }}>
            The page hit an unexpected error. A refresh usually fixes it.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              background: '#0F4A23', color: '#fff', border: 'none',
              padding: '12px 24px', borderRadius: '8px', fontSize: '1rem',
              cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
            }}
          >
            Refresh page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export { ErrorBoundary };

const groupNav = [
  { to: 'pick',        label: 'Make pick' },
  { to: 'draw',        label: 'Draw' },
  { to: 'history',     label: 'My picks' },
  { to: 'leaderboard', label: 'Leaderboard' },
];

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLOURS = [
  '#0F4A23', '#1E7A3E', '#C1572E', '#A84620',
  '#1F5580', '#7C3AED', '#B67300', '#0891B2',
];

function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── User menu component ───────────────────────────────────────
function UserMenu({ user }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const colour = avatarColour(user.displayName || user.email);
  const ini    = initials(user.displayName || user.email);

  return (
    <div className="user-menu-wrap" ref={wrapRef}>
      <button
        className="user-avatar-btn ds-focusable"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="user-avatar" style={{ background: colour }}>{ini}</span>
      </button>

      {open && (
        <div className="user-menu-dropdown" role="menu">
          <div className="user-menu-identity">
            <span className="user-avatar user-avatar-sm" style={{ background: colour }}>{ini}</span>
            <div className="user-menu-id-text">
              <p className="user-menu-name">{user.displayName || 'You'}</p>
              <p className="user-menu-email">{user.email}</p>
            </div>
          </div>

          <div className="user-menu-divider" />

          <Link to="/profile" className="user-menu-item" onClick={() => setOpen(false)}>
            Profile
          </Link>
          <Link to="/" className="user-menu-item" onClick={() => setOpen(false)}>
            My pools
          </Link>

          <div className="user-menu-divider" />

          <button
            className="user-menu-signout"
            onClick={() => { logout(); setOpen(false); }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

// ── Auth modal (sign in / register / forgot password) ────────
function AuthModal({ onClose, initialMode = 'login' }) {
  const { register, login } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const trapRef = useFocusTrap(true);

  const switchMode = (m) => { setMode(m); setError(''); setPassword(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email.trim(), name.trim(), password);
        onClose();
      } else if (mode === 'login') {
        await login(email.trim(), password);
        onClose();
      } else if (mode === 'forgot') {
        const res = await fetch(`${API}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim() }),
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Something went wrong.');
        }
        switchMode('forgot-sent');
      }
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const title = {
    login: 'Sign in',
    register: 'Create account',
    forgot: 'Reset password',
    'forgot-sent': 'Check your inbox',
  }[mode];

  const handleBackdropKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="ds-modal-backdrop"
      onClick={onClose}
      onKeyDown={handleBackdropKeyDown}
      role="presentation"
    >
      <div
        ref={trapRef}
        className="ds-modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="ds-modal-header">
          <span className="ds-modal-eyebrow">FINAL SERVE-IVOR</span>
          <h2 id="auth-modal-title" className="ds-modal-title">{title}</h2>
          <button className="ds-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ds-modal-body">
          {(mode === 'login' || mode === 'register') && (
            <div className="ds-modal-tabs" role="tablist">
              <button
                role="tab"
                aria-selected={mode === 'login'}
                className={`ds-modal-tab${mode === 'login' ? ' is-active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                role="tab"
                aria-selected={mode === 'register'}
                className={`ds-modal-tab${mode === 'register' ? ' is-active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create account
              </button>
            </div>
          )}

          {mode === 'forgot-sent' && (
            <div className="ds-modal-sent">
              <p className="ds-modal-sent-icon">✉</p>
              <p className="ds-modal-sent-text">
                If an account exists for <strong>{email}</strong>, a reset link has been sent. Check your inbox (and spam).
              </p>
              <Button variant="ghost" onClick={() => switchMode('login')}>
                ← Back to sign in
              </Button>
            </div>
          )}

          {mode !== 'forgot-sent' && (
            <form onSubmit={handleSubmit} className="ds-modal-form">
              {mode === 'register' && (
                <label className="ds-field">
                  <span className="ds-field-label">Name</span>
                  <input
                    className="ds-input"
                    type="text"
                    placeholder="Your name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </label>
              )}

              <label className="ds-field">
                <span className="ds-field-label">Email</span>
                <input
                  className="ds-input"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoFocus={mode === 'login' || mode === 'forgot'}
                />
              </label>

              {(mode === 'login' || mode === 'register') && (
                <label className="ds-field">
                  <span className="ds-field-label">Password</span>
                  <input
                    className="ds-input"
                    type="password"
                    placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </label>
              )}

              {mode === 'login' && (
                <button
                  type="button"
                  className="ds-text-link"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot your password?
                </button>
              )}

              {error && <p className="ds-form-error">{error}</p>}

              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                {mode === 'register' ? 'Create account →'
                 : mode === 'login' ? 'Sign in →'
                 : 'Send reset link →'}
              </Button>

              {mode === 'register' && (
                <p className="ds-modal-hint">We'll send you a confirmation email.</p>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  className="ds-text-link"
                  onClick={() => switchMode('login')}
                >
                  ← Back to sign in
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Layout root ────────────────────────────────────────────────
export function Layout({ children }) {
  const location = useLocation();
  const groupMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const groupId = groupMatch ? groupMatch[1] : null;
  const { user } = useAuth();
  const base = groupId ? `/group/${groupId}` : '/';

  const [showAuth, setShowAuth] = useState(false);
  const [initialMode, setInitialMode] = useState('login');

  // Fetch user's pool membership for the nav link
  const [myPool, setMyPool] = useState(null);
  useEffect(() => {
    if (!user?.id) { setMyPool(null); return; }
    let cancelled = false;
    fetch(`${API}/pools?userId=${user.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(pools => {
        if (cancelled) return;
        const mine = (pools || []).filter(p => p.isMember);
        if (mine.length === 1) setMyPool({ id: mine[0].id, name: mine[0].name });
        else if (mine.length > 1) setMyPool({ id: null, name: 'My Pools' });
        else setMyPool(null);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user?.id]);

  const openAuth = (mode) => { setInitialMode(mode); setShowAuth(true); };

  return (
    <div className="ds-layout">
      <header className="ds-header">
        <div className="ds-header__inner">
          <Link to="/" className="ds-brand">
            <span className="ds-brand__mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="16" cy="16" r="11" />
                <path d="M6 14 Q 16 4 26 14" />
                <path d="M6 18 Q 16 28 26 18" />
              </svg>
            </span>
            <span className="ds-brand__wordmark">
              Final <em>Serve-ivor</em>
            </span>
          </Link>

          <nav className="ds-nav" aria-label="Primary">
            {groupId && groupNav.map(({ to, label }) => (
              <NavLink
                key={to}
                to={`${base}/${to}`}
                className={({ isActive }) => `ds-nav-link${isActive ? ' is-active' : ''}`}
              >
                {label}
              </NavLink>
            ))}
            {user && myPool && (
              <Link
                to={myPool.id ? `/group/${myPool.id}` : '/'}
                className="ds-nav-pool-pill"
              >
                {myPool.name || 'My Pool'} <span aria-hidden="true">→</span>
              </Link>
            )}
            <NavLink
              to="/how-to-play"
              className={({ isActive }) => `ds-nav-link${isActive ? ' is-active' : ''}`}
            >
              How to play
            </NavLink>
            <NavLink
              to="/terms"
              className={({ isActive }) => `ds-nav-link${isActive ? ' is-active' : ''}`}
            >
              T&amp;Cs
            </NavLink>
          </nav>

          <div className="ds-header__actions">
            {user ? (
              <UserMenu user={user} />
            ) : (
              <>
                <button className="ds-header__signin" onClick={() => openAuth('login')}>
                  Sign in
                </button>
                <Button variant="primary" size="sm" onClick={() => openAuth('register')}>
                  Create account
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="ds-main">{children}</main>

      <footer className="ds-footer">
        <div className="ds-footer__inner">
          <div className="ds-footer__brand">
            <span className="ds-footer__wordmark">
              Final <em>Serve-ivor</em>
            </span>
            <p className="ds-footer__tagline">A tennis survivor pool</p>
          </div>
          <div className="ds-footer__links">
            <NavLink to="/how-to-play" className="ds-footer__link">How to play</NavLink>
            <NavLink to="/terms" className="ds-footer__link">Terms &amp; conditions</NavLink>
            <NavLink to="/support" className="ds-footer__link">Support</NavLink>
          </div>
          <p className="ds-footer__copy">© 2026 Final Serve-ivor</p>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={initialMode} />}
    </div>
  );
}
