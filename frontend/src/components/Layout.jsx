import { Link, NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../App';
import './Layout.css';

const nav = [
  { to: 'pick',        label: 'Make Pick' },
  { to: 'draw',        label: 'Draw' },
  { to: 'history',     label: 'My Picks' },
  { to: 'leaderboard', label: 'Leaderboard' },
];

export function Layout({ children }) {
  const location = useLocation();
  const groupMatch = location.pathname.match(/^\/group\/([^/]+)/);
  const groupId = groupMatch ? groupMatch[1] : null;
  const { user } = useAuth();
  const base = groupId ? `/group/${groupId}` : '/';

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

        {user && (
          <span className="user-badge">{user.displayName || user.email}</span>
        )}
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
    </div>
  );
}
