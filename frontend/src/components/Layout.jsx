import { useState } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import './Layout.css';

const nav = [
  { to: 'pick',        label: 'Make Pick' },
  { to: 'draw',        label: 'Draw' },
  { to: 'history',     label: 'My Picks' },
  { to: 'leaderboard', label: 'Leaderboard' },
];

function AuthModal({ onClose, initialMode = 'login' }) {
  const { register, login } = useAuth();
  const [mode, setMode] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      } else {
        await login(email.trim(), password);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {mode === 'register' ? 'Create account' : 'Sign in'}
          </h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

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

        <form onSubmit={handleSubmit} className="modal-form">
          {mode === 'register' && (
            <input
              className="input"
              type="text"
              placeholder="Your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          )}
          <input
            className="input"
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus={mode === 'login'}
          />
          <input
            className="input"
            type="password"
            placeholder={mode === 'register' ? 'Create a password (min. 8 characters)' : 'Password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className="error">{error}</p>}
          <button type="submit" className="btn primary btn-lg" disabled={loading}>
            {loading
              ? (mode === 'register' ? 'Creating account…' : 'Signing in…')
              : (mode === 'register' ? 'Create account →' : 'Sign in →')}
          </button>
          {mode === 'register' && (
            <p className="modal-hint">We'll send you a confirmation email.</p>
          )}
        </form>
      </div>
    </div>
  );
}

export function Layout({ children }) {
  const location = useLocation();
  const groupMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const groupId = groupMatch ? groupMatch[1] : null;
  const { user, logout } = useAuth();
  const base = groupId ? `/group/${groupId}` : '/';
  const [showAuth, setShowAuth] = useState(false);
  const [initialMode, setInitialMode] = useState('login');
  const [showUserMenu, setShowUserMenu] = useState(false);

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
            <div className="user-menu-wrap">
              <button
                className="user-badge user-badge-btn"
                onClick={() => setShowUserMenu(v => !v)}
              >
                {user.displayName || user.email}
                <span className="user-badge-caret">▾</span>
              </button>
              {showUserMenu && (
                <div className="user-menu-dropdown">
                  <p className="user-menu-email">{user.email}</p>
                  <button
                    className="user-menu-signout"
                    onClick={() => { logout(); setShowUserMenu(false); }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
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
          <span className="footer-copy">© 2026 Final Serve-ivor · A game of skill</span>
          <div className="footer-links">
            <NavLink to="/terms" className="footer-link">Terms &amp; Conditions</NavLink>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} initialMode={initialMode} />}
    </div>
  );
}
