import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';

const ROUND_LABELS = {
  R1: '1st Rd',
  R64: '2nd Rd',
  R32: '3rd Rd',
  R16: '4th Rd',
  QF: 'Quarter-final',
  SF: 'Semi-final',
  F: 'Final',
};

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

// -- Pool history section -------------------------------------------------
function PoolHistory({ userId }) {
  const [pools, setPools] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId) return;
    fetch(`${API}/auth/me/pools?userId=${userId}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setPools)
      .catch(() => { setError('Could not load pool history.'); setPools([]); });
  }, [userId]);

  if (pools === null) return <p className="lb-picks-loading">Loading pools…</p>;
  if (error) return <p className="error">{error}</p>;
  if (pools.length === 0) return (
    <p style={{ color: '#888', fontStyle: 'italic' }}>
      You haven't joined any pools yet.
    </p>
  );

  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="lb-picks-table" style={{ width: '100%' }}>
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
            <tr key={p.groupId} className={!p.isAlive ? 'lb-pick-row-out' : ''}>
              <td style={{ fontWeight: 500 }}>
                <Link to={`/group/${p.groupId}`} style={{ color: 'inherit' }}>
                  {p.groupName}
                </Link>
              </td>
              <td>
                {p.isAlive
                  ? <span className="status-alive">Alive</span>
                  : <span className="status-out">
                      Eliminated{p.eliminatedRound
                        ? ` (${ROUND_LABELS[p.eliminatedRound] || p.eliminatedRound})`
                        : ''}
                    </span>
                }
              </td>
              <td>{fmtGBP(p.prizePoolCents || 0)}</td>
              <td>{p.totalMembers}</td>
              <td style={{ color: '#888', fontSize: '0.85rem' }}>{fmtDate(p.joinedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// -- Account settings section ---------------------------------------------
function AccountSettings({ user, updateUser }) {
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

      const res = await fetch(`${API}/auth/me?userId=${user.id}`, {
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
    <form onSubmit={handleSave} style={{ maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', color: '#666', marginBottom: '0.3rem' }}>
          Display name
        </label>
        <input className="input" type="text" value={displayName}
          onChange={e => setDisplayName(e.target.value)} placeholder="Your name" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', color: '#666', marginBottom: '0.3rem' }}>
          Email address
        </label>
        <input className="input" type="email" value={email}
          onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
      </div>
      <hr style={{ border: 'none', borderTop: '1px solid #eee', margin: '0.25rem 0' }} />
      <p style={{ fontSize: '0.85rem', color: '#555', margin: 0 }}>
        Change password — leave blank to keep current password
      </p>
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', color: '#666', marginBottom: '0.3rem' }}>
          Current password
        </label>
        <input className="input" type="password" value={currentPwd}
          onChange={e => setCurrentPwd(e.target.value)}
          placeholder="Required to change password"
          autoComplete="current-password" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', color: '#666', marginBottom: '0.3rem' }}>
          New password
        </label>
        <input className="input" type="password" value={newPwd}
          onChange={e => setNewPwd(e.target.value)}
          placeholder="Min. 8 characters"
          autoComplete="new-password" />
      </div>
      <div>
        <label style={{ display: 'block', fontSize: '0.82rem', color: '#666', marginBottom: '0.3rem' }}>
          Confirm new password
        </label>
        <input className="input" type="password" value={confirmPwd}
          onChange={e => setConfirmPwd(e.target.value)}
          placeholder="Repeat new password"
          autoComplete="new-password" />
      </div>
      {error && <p className="error">{error}</p>}
      {success && <p className="success-msg">{success}</p>}
      <button type="submit" className="btn primary" disabled={saving} style={{ alignSelf: 'flex-start' }}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// -- Main Profile page ----------------------------------------------------
export function Profile() {
  const { user, userId, updateUser } = useAuth();
  const navigate = useNavigate();

  // Redirect to home if not logged in
  useEffect(() => {
    if (user === null) navigate('/', { replace: true });
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <Link to="/" className="back-link">← Back to pools</Link>
        <h1 style={{ marginTop: '0.75rem', marginBottom: '0.25rem' }}>
          {user.displayName || 'Profile'}
        </h1>
        <p style={{ color: '#888', margin: 0 }}>{user.email}</p>
      </div>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
          My pools
        </h2>
        <PoolHistory userId={userId} />
      </section>

      <section>
        <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #eee', paddingBottom: '0.5rem' }}>
          Account settings
        </h2>
        <AccountSettings user={user} updateUser={updateUser} />
      </section>
    </div>
  );
}
