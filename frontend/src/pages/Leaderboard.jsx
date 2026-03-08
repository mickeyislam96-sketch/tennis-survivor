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

  return (
    <div className="page leaderboard">
      <div className="leaderboard-header">
        <h1>Leaderboard</h1>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

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
              <th className="lb-th-rank">#</th>
              <th>Player</th>
              <th>Status</th>
              {currentRound && <th className="lb-th-pick">{currentRound} pick</th>}
              <th className="lb-th-rounds">Rounds</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((m, i) => {
              const isYou = m.userId === userId;
              const rowClass = [
                isYou ? 'lb-row-you' : '',
                m.isAlive ? '' : 'lb-row-out',
              ].filter(Boolean).join(' ');

              return (
                <tr key={m.id} className={rowClass}>
                  <td className="lb-td-rank">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
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
                  <td>
                    {m.isAlive ? (
                      <span className="status-alive">✓ Alive</span>
                    ) : (
                      <span className="status-out">✗ {m.eliminatedRound}</span>
                    )}
                  </td>
                  {currentRound && (
                    <td className="lb-td-pick">
                      {m.currentRoundPick ? (
                        <span className="lb-pick-pill">{m.currentRoundPick}</span>
                      ) : (
                        <span className="lb-pick-none">—</span>
                      )}
                    </td>
                  )}
                  <td className="lb-td-rounds">{m.survivedRounds ?? m.picksCount ?? 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
