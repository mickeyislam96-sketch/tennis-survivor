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
  const { userId, user } = useAuth();
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!code) return;
    fetch(`${API}/groups/invite/${encodeURIComponent(code)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setGroup)
      .catch(() => setGroup(null))
      .finally(() => setLoading(false));
  }, [code]);

  const join = () => {
    if (!group || !userId) return;
    setJoining(true);
    setError('');
    fetch(`${API}/groups/${group.id}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName: user?.displayName || 'Player' })
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

        {isMember ? (
          <div className="join-already">
            <p className="text-muted">You're already in this pool.</p>
            <Link to={`/group/${group.id}`} className="btn primary btn-lg">Go to group →</Link>
          </div>
        ) : (
          <div className="join-action">
            <button onClick={join} className="btn primary btn-lg join-submit-btn" disabled={joining}>
              {joining ? 'Joining…' : `Join for ${fmtGBP(group.entryFeeCents || 0)} →`}
            </button>
            <p className="join-disclaimer">Entry fee is non-refundable once the tournament begins.</p>
            {error && <p className="error">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
