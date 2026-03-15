import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';

function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLOURS = [
  '#16a34a', '#0891b2', '#7c3aed', '#db2777',
  '#d97706', '#65a30d', '#0369a1', '#9333ea',
];

function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

export function Leaderboard() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/leaderboard/${groupId}`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [groupId]);

  if (!data) return <div className="page-loading">Loading leaderboard…</div>;

  const { group, leaderboard, aliveCount, currentRound } = data;
  const totalEntrants = leaderboard.length;
  const eliminated = totalEntrants - aliveCount;
  const winner = aliveCount === 1 ? leaderboard[0] : null;

  return (
    <div className="page leaderboard">
      <div className="leaderboard-header">
        <h1>Leaderboard</h1>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* Winner banner — shown when tournament is complete */}
      {winner && (
        <div className="lb-winner-banner">
          <div className="lb-winner-trophy">🏆</div>
          <div className="lb-winner-body">
            <span className="lb-winner-eyebrow">Tournament Winner</span>
            <span className="lb-winner-name">{winner.displayName}</span>
            <span className="lb-winner-sub">Last one standing · {totalEntrants} entrants</span>
          </div>
          {group?.prizePoolCents > 0 && (
            <div className="lb-winner-prize">{fmtGBP(group.prizePoolCents)}</div>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="lb-stats-bar">
        <div className="lb-stat">
          <span className="lb-stat-value">{fmtGBP(group?.prizePoolCents || 0)}</span>
          <span className="lb-stat-label">Prize pool</span>
        </div>
        <div className="lb-stat lb-stat-alive">
          <span className="lb-stat-value">{aliveCount}</span>
          <span className="lb-stat-label">Still in</span>
        </div>
        <div className="lb-stat lb-stat-out">
          <span className="lb-stat-value">{eliminated}</span>
          <span className="lb-stat-label">Eliminated</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-value">{totalEntrants}</span>
          <span className="lb-stat-label">Total entrants</span>
        </div>
      </div>

      <p className="lb-group-name">{group?.name}</p>

      <div className="lb-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="lb-th-status">Status</th>
              <th className="lb-th-progress">Progress</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((m) => {
              const isYou = m.userId === userId;
              const survived = m.survivedRounds ?? 0;
              const rowClass = [
                isYou ? 'lb-row-you' : '',
                m.isAlive ? '' : 'lb-row-out',
              ].filter(Boolean).join(' ');

              return (
                <tr key={m.id} className={rowClass}>
                  <td className="lb-td-player">
                    <span
                      className="lb-avatar"
                      style={{ background: avatarColour(m.displayName) }}
                    >
                      {initials(m.displayName)}
                    </span>
                    <span className="lb-display-name">{m.displayName}</span>
                    {isYou && <span className="lb-you-tag">You</span>}
                  </td>
                  <td className="lb-td-status">
                    {m.isAlive
                      ? <span className="status-alive">Alive</span>
                      : <span className="status-out">Eliminated</span>
                    }
                  </td>
                  <td className="lb-td-progress">
                    {m.isAlive ? (
                      survived === 0
                        ? <span className="lb-progress-pending">No results yet</span>
                        : <span className="lb-progress-alive">
                            {survived} {survived === 1 ? 'round' : 'rounds'} survived
                          </span>
                    ) : (
                      <span className="lb-progress-out">
                        Out in {m.eliminatedRound || '—'}
                        {survived > 0 && (
                          <span className="lb-progress-sub">
                            {' '}· {survived} {survived === 1 ? 'round' : 'rounds'} survived
                          </span>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
