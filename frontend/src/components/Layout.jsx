import { useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import './Layout.css';

const nav = [
  { to: 'pick',        label: 'Make Pick' },
  { to: 'draw',        label: 'Draw' },
  { to: 'history',     label: 'My Picks' },
  { to: 'leaderboard', label: 'Leaderboard' },
];

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLOURS = [
  '#16a34a', '#0891b2', '#7c3aed', '#db2777',
  '#d97706', '#65a30d', '#0369a1', '#9333ea',
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
function UserMenu({ user, groupId }) {
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on click outside
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
        className="user-avatar-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label="Account menu"
        aria-expanded={open}
      >
        <span className="user-avatar" style={{ background: colour }}>{ini}</span>
      </button>

      {open && (
        <div className="user-menu-dropdown">
          {/* Identity */}
          <div className="user-menu-identity">
            <span className="user-avatar user-avatar-sm" style={{ background: colour }}>{ini}</span>
            <div className="user-menu-id-text">
              <p className="user-menu-name">{user.displayName || 'You'}</p>
              <p className="user-menu-email">{user.email}</p>
            </div>
          </div>

          <div className="user-menu-divider" />

          {/* Navigation items — Profile and My Pools always visible */}
          <Link
            to="/profile"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            Profile
          </Link>
          <Link
            to="/"
            className="user-menu-item"
            onClick={() => setOpen(false)}
          >
            My Pools
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

function AuthModal({ onClose, initialMode = 'login' }) {
  const { register, login } = useAuth();

  // mode: 'login' | 'register' | 'forgot' | 'forgot-sent'
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const switchMode = (m) => { setMode(m); setError(''); setSuccess(''); setPassword(''); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

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
    'forgot-sent': 'Check your email',
  }[mode];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box modal-box--auth" onClick={(e) => e.stopPropagation()}>

        {/* Green gradient header — matches join card and group hero */}
        <div className="modal-auth-header">
          <div>
            <p className="modal-auth-eyebrow">🎾 Final Serve-ivor</p>
            <h2 className="modal-auth-title">{title}</h2>
          </div>
          <button className="modal-close modal-close--light" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div className="modal-auth-body">
          {/* Tabs — only shown for login / register */}
          {(mode === 'login' || mode === 'register') && (
            <div className="modal-tabs">
              <button
                className={`modal-tab${mode === 'login' ? ' active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Sign in
              </button>
              <button
                className={`modal-tab${mode === 'register' ? ' active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Create account
              </button>
            </div>
          )}

          {/* Forgot password — email sent confirmation */}
          {mode === 'forgot-sent' && (
            <div className="modal-sent">
              <p className="modal-sent-icon">📬</p>
              <p className="modal-sent-text">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. Check your inbox (and spam).
              </p>
              <button className="btn-text-link" onClick={() => switchMode('login')}>
                Back to sign in
              </button>
            </div>
          )}

          {/* Main form */}
          {mode !== 'forgot-sent' && (
            <form onSubmit={handleSubmit} className="modal-form">
              {mode === 'register' && (
                <input
                  className="input auth-input"
                  type="text"
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoFocus
                />
              )}

              <input
                className="input auth-input"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus={mode === 'login' || mode === 'forgot'}
              />

              {(mode === 'login' || mode === 'register') && (
                <input
                  className="input auth-input"
                  type="password"
                  placeholder={mode === 'register' ? 'Create a password (min. 8 characters)' : 'Password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              )}

              {/* Forgot password link — only on login */}
              {mode === 'login' && (
                <button
                  type="button"
                  className="btn-text-link forgot-link"
                  onClick={() => switchMode('forgot')}
                >
                  Forgot your password?
                </button>
              )}

              {error && <p className="error">{error}</p>}
              {success && <p className="success-msg">{success}</p>}

              <button type="submit" className="btn primary btn-lg" disabled={loading} style={{ marginTop: '0.25rem' }}>
                {loading ? (
                  mode === 'register' ? 'Creating account…' :
                  mode === 'login'    ? 'Signing in…' :
                                       'Sending link…'
                ) : (
                  mode === 'register' ? 'Create account →' :
                  mode === 'login'    ? 'Sign in →' :
                                       'Send reset link →'
                )}
              </button>

              {mode === 'register' && (
                <p className="modal-hint">We'll send you a confirmation email.</p>
              )}

              {mode === 'forgot' && (
                <button
                  type="button"
                  className="btn-text-link"
                  onClick={() => switchMode('login')}
                >
                  Back to sign in
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function Layout({ children }) {
  const location = useLocation();
  const groupMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const groupId = groupMatch ? groupMatch[1] : null;
  const { user } = useAuth();
  const base = groupId ? `/group/${groupId}` : '/';
  const [showAuth, setShowAuth] = useState(false);
  const [initialMode, setInitialMode] = useState('login');

  return (
    <div className="layout">
      <header className="header">
        <Link to="/" className="logo">Final Serve-ivor</Link>

        <nav className="nav">
          {groupId && nav.map(({ to, label }) => (
            <NavLink
              key={to}
              to={`${base}/${to}`}
              className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
            >
              {label}
            </NavLink>
          ))}
          <NavLink
            to="/terms"
            className={({ isActive }) => `nav-link${isActive ? ' nav-link-active' : ''}`}
          >
            T&amp;Cs
          </NavLink>
        </nav>

        <div className="header-user">
          {user ? (
            <UserMenu user={user} groupId={groupId} />
          ) : (
            <div className="header-auth-btns">
              <button className="btn-signin" onClick={() => { setInitialMode('login'); setShowAuth(true); }}>
                Sign in
              </button>
              <button className="btn-register" onClick={() => { setInitialMode('register'); setShowAuth(true); }}>
                Create account
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="main">{children}</main>

      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-copy">A game of skill · ATP · 2026</span>
          <div className="footer-links">
            <NavLink to="/terms" className="footer-link">Terms &amp; Conditions</NavLink>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={initialMode} />}
    </div>
  );
}
