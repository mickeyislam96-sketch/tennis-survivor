import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { ROUND_SHORT as ROUND_LABELS } from '../data/roundLabels';
import './Profile.css';

function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/* -- Pool history -------------------------------------------------------- */
function PoolHistory({ authFetch }) {
  const [pools, setPools] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    authFetch(`${API}/auth/me/pools`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setPools)
      .catch(() => { setError('Could not load pool history.'); setPools([]); });
  }, [authFetch]);

  if (pools === null) return <p className="pr-loading">Loading pools…</p>;
  if (error) return <p className="pr-error">{error}</p>;
  if (pools.length === 0) {
    return (
      <Card tone="muted" padding="md" className="pr-empty">
        <p className="pr-empty-text">
          No pools yet. Join a tournament pool to get started.
        </p>
      </Card>
    );
  }

  return (
    <div className="pr-pools-wrap">
      <table className="pr-pools-table">
        <thead>
          <tr>
            <th>Pool</th>
            <th>Status</th>
            <th>Prize pool</th>
            <th>Players</th>
            <th>Joined</th>
          </tr>
        </thead>
        <tbody>
          {pools.map(p => (
            <tr key={p.groupId} className={!p.isAlive ? 'pr-row-out' : ''}>
              <td className="pr-pool-name">
                <Link to={`/group/${p.groupId}`}>{p.groupName}</Link>
              </td>
              <td>
                {p.isAlive ? (
                  <Badge tone="success" size="sm">Alive</Badge>
                ) : (
                  <Badge tone="danger" size="sm">
                    Out{p.eliminatedRound
                      ? ` · ${ROUND_LABELS[p.eliminatedRound] || p.eliminatedRound}`
                      : ''}
                  </Badge>
                )}
              </td>
              <td className="pr-mono">{fmtGBP(p.prizePoolCents || 0)}</td>
              <td className="pr-mono">{p.totalMembers}</td>
              <td className="pr-date">{fmtDate(p.joinedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -- Account settings ---------------------------------------------------- */
function AccountSettings({ user, updateUser, authFetch }) {
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPwd && newPwd !== confirmPwd) {
      setError('New passwords do not match.');
      return;
    }
    if (newPwd && newPwd.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      const body = {};
      if (displayName.trim() && displayName.trim() !== user?.displayName)
        body.displayName = displayName.trim();
      if (email.trim() && email.trim().toLowerCase() !== user?.email)
        body.email = email.trim();
      if (newPwd) {
        body.currentPassword = currentPwd;
        body.newPassword = newPwd;
      }

      if (Object.keys(body).length === 0) {
        setError('No changes to save.');
        setSaving(false);
        return;
      }

      const res = await authFetch(`${API}/auth/me`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed.');

      updateUser(data);
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setSuccess('Profile updated successfully.');
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="pr-form">
      <div className="pr-field">
        <label className="pr-label">Display name</label>
        <input
          className="pr-input"
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="Your name"
        />
      </div>
      <div className="pr-field">
        <label className="pr-label">Email address</label>
        <input
          className="pr-input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
        />
      </div>

      <div className="pr-divider">Change password</div>
      <p className="pr-hint">Leave blank to keep your current password.</p>

      <div className="pr-field">
        <label className="pr-label">Current password</label>
        <input
          className="pr-input"
          type="password"
          value={currentPwd}
          onChange={e => setCurrentPwd(e.target.value)}
          placeholder="Required to change password"
          autoComplete="current-password"
        />
      </div>
      <div className="pr-field">
        <label className="pr-label">New password</label>
        <input
          className="pr-input"
          type="password"
          value={newPwd}
          onChange={e => setNewPwd(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password"
        />
      </div>
      <div className="pr-field">
        <label className="pr-label">Confirm new password</label>
        <input
          className="pr-input"
          type="password"
          value={confirmPwd}
          onChange={e => setConfirmPwd(e.target.value)}
          placeholder="Repeat new password"
          autoComplete="new-password"
        />
      </div>

      {error && <p className="pr-error">{error}</p>}
      {success && <p className="pr-success">{success}</p>}

      <Button type="submit" variant="primary" size="md" disabled={saving}>
        {saving ? 'Saving…' : 'Save changes'}
      </Button>
    </form>
  );
}

/* -- Main Profile page --------------------------------------------------- */
export function Profile() {
  const { user, userId, updateUser, authFetch } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user === null) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="pr-page">
      <Hero
        tone="primary"
        compact
        showCourt
        eyebrow="PROFILE"
        title={<>Hi, <em>{user.displayName || 'player'}</em>.</>}
        lede={user.email}
      />

      <Section tone="canvas" size="md">
        <div className="pr-back-row">
          <Button as={Link} to="/" variant="ghost" size="sm">
            ← Back to pools
          </Button>
        </div>

        <SectionHeader
          eyebrow="MY POOLS"
          title={<>Where you're <em>playing</em>.</>}
        />

        <div className="pr-section-body">
          <PoolHistory authFetch={authFetch} />
        </div>

        <SectionHeader
          eyebrow="ACCOUNT"
          title={<>Update your <em>details</em>.</>}
        />

        <Card tone="surface" padding="lg" className="pr-settings-card">
          <AccountSettings user={user} updateUser={updateUser} authFetch={authFetch} />
        </Card>
      </Section>
    </div>
  );
}
