import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';

// ── Formatting helpers ────────────────────────────────────────
function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
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

const ROUND_LABELS = {
  R1: 'Round 1', R64: 'Round of 64', R32: 'Round of 32',
  R16: 'Round of 16', QF: 'Quarter-final', SF: 'Semi-final', F: 'Final',
};

// ── Pick History Modal ────────────────────────────────────────
function PickHistoryModal({ member, groupId, currentRound, onClose }) {
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API}/picks/history?userId=${member.userId}&groupId=${groupId}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setPicks)
      .catch(() => { setError(true); setPicks([]); });
  }, [member.userId, groupId]);

  const colour = avatarColour(member.displayName);
  const ini    = initials(member.displayName);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box lb-picks-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="lb-picks-modal-header">
          <span className="lb-avatar" style={{ background: colour, width: 36, height: 36, fontSize: '0.8rem' }}>
            {ini}
          </span>
          <div>
            <p className="lb-picks-modal-name">{member.displayName}</p>
            <p className="lb-picks-modal-sub">
              {member.isWinner
                ? `🏆 Winner · ${member.survivedRounds ?? 0} round${(member.survivedRounds ?? 0) === 1 ? '' : 's'} survived`
                : member.isAlive
                ? `Still in · ${member.survivedRounds ?? 0} round${(member.survivedRounds ?? 0) === 1 ? '' : 's'} survived`
                : `Eliminated in ${ROUND_LABELS[member.eliminatedRound] || member.eliminatedRound || '—'}`
              }
            </p>
          </div>
          <button className="modal-close" onClick={onClose} style={{ marginLeft: 'auto' }}>✕</button>
        </div>

        {/* Full pick history — current open round is hidden until picks lock */}
        <div className="lb-picks-history-wrap">
          <p className="lb-picks-history-title">Pick history</p>

          {picks === null && (
            <p className="lb-picks-loading">Loading…</p>
          )}

          {error && (
            <p className="lb-picks-error">Could not load picks.</p>
          )}

          {picks !== null && !error && picks.filter(p => !currentRound || p.round !== currentRound).length === 0 && (
            <p className="lb-picks-empty">No picks submitted yet.</p>
          )}

          {picks !== null && picks.filter(p => !currentRound || p.round !== currentRound).length > 0 && (
            <table className="lb-picks-table">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Player picked</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {picks.filter(p => !currentRound || p.round !== currentRound).map((p) => (
                  <tr key={p.id || p.round} className={
                    p.survived === false ? 'lb-pick-row-out' : ''
                  }>
                    <td className="lb-pick-round">{ROUND_LABELS[p.round] || p.round}</td>
                    <td className="lb-pick-player">{p.playerName || '—'}</td>
                    <td className="lb-pick-result">
                      {p.survived === true  && <span className="status-alive">✓ Survived</span>}
                      {p.survived === false && <span className="status-out">✗ Eliminated</span>}
                      {p.survived == null   && <span className="lb-progress-pending">Pending</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Leaderboard component ────────────────────────────────
export function Leaderboard() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [data, setData]           = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/leaderboard/${groupId}`)
      .then((r) => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then((json) => {
        setData({
          group: json.group || null,
          leaderboard: Array.isArray(json.leaderboard) ? json.leaderboard : [],
          aliveCount: json.aliveCount ?? 0,
          currentRound: json.currentRound ?? null,
          roundIsLocked: json.roundIsLocked ?? false,
          openRound: json.openRound ?? null,
        });
      })
      .catch(() => setData({ group: null, leaderboard: [], aliveCount: 0, currentRound: null, openRound: null }));
  }, [groupId]);

  if (!data) return <div className="page-loading">Loading leaderboard…</div>;

  const { group, leaderboard, aliveCount, currentRound, roundIsLocked } = data;

  // Upcoming tournament — show a simple member list with no game state
  const tournament = group?.tournamentId ? TOURNAMENTS.find(t => t.id === group.tournamentId) : null;
  if (tournament && tournament.status !== 'active' && tournament.status !== 'completed') {
    return (
      <div className="page leaderboard">
        <div className="leaderboard-header">
          <h1>Leaderboard</h1>
          <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
        </div>
        <div className="draw-empty-state">
          <div className="draw-empty-icon">🎾</div>
          <p className="draw-empty-title">{tournament.shortName || tournament.name} hasn't started yet</p>
          <p className="draw-empty-sub">
            The leaderboard will be available once the tournament begins on{' '}
            {new Date(tournament.startDate).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.
          </p>
          {leaderboard.length > 0 && (
            <div style={{ marginTop: '1.5rem', textAlign: 'center' }}>
              <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>{leaderboard.length} player{leaderboard.length !== 1 ? 's' : ''} registered</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center' }}>
                {leaderboard.map((m) => (
                  <span key={m.userId} className="lb-avatar" style={{ background: avatarColour(m.displayName), width: 32, height: 32, fontSize: '0.7rem' }}>
                    {initials(m.displayName)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const totalEntrants = leaderboard.length;
  const eliminated    = totalEntrants - aliveCount;
  // Winner: check isWinner flag from backend (handles both alive-winner and last-eliminated-winner)
  const winners       = leaderboard.filter(m => m.isWinner);
  const winner        = winners.length > 0 ? winners[0] : null;

  return (
    <div className="page leaderboard">
      <div className="leaderboard-header">
        <h1>Leaderboard</h1>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* Winner banner */}
      {winner && (
        <div className="lb-winner-banner">
          <div className="lb-winner-trophy">🏆</div>
          <div className="lb-winner-body">
            <span className="lb-winner-eyebrow">Tournament Winner</span>
            <span className="lb-winner-name">{winner.displayName}</span>
            <span className="lb-winner-sub">{winner.isAlive ? 'Last one standing' : 'Lasted longest'} · {totalEntrants} entrants</span>
          </div>
          {group?.prizePoolCents > 0 && (
            <div className="lb-winner-prize">{fmtGBP(group.prizePoolCents)}</div>
          )}
        </div>
      )}

      {/* Stats bar */}
      <div className="lb-stats-bar">
        <div className="lb-stat lb-stat-alive">
          <span className="lb-stat-value lb-stat-value--big">{winner ? (winners.length > 1 ? winners.length : '1') : aliveCount}</span>
          <span className="lb-stat-label">{winner ? (winners.length > 1 ? 'Winners' : 'Winner') : 'Still in'}</span>
        </div>
        <div className="lb-stat lb-stat-out">
          <span className="lb-stat-value lb-stat-value--big">{winner ? totalEntrants - winners.length : eliminated}</span>
          <span className="lb-stat-label">Eliminated</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-value lb-stat-value--big">{totalEntrants}</span>
          <span className="lb-stat-label">Total entrants</span>
        </div>
        <div className="lb-stat">
          <span className="lb-stat-value">{fmtGBP(group?.prizePoolCents || 0)}</span>
          <span className="lb-stat-label">Prize pool</span>
        </div>
      </div>

      <p className="lb-group-name">{group?.name}</p>
      <p className="lb-click-hint">Click any player to see their picks</p>

      <div className="lb-table-wrap">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Player</th>
              <th className="lb-th-status">Status</th>
              {currentRound && <th className="lb-th-pick">{ROUND_LABELS[currentRound] || currentRound} Pick</th>}
            </tr>
          </thead>
          <tbody>
            {leaderboard.length === 0 && (
              <tr>
                <td colSpan={currentRound ? 3 : 2} style={{ textAlign: 'center', padding: '2rem', color: '#888' }}>
                  No entries yet — be the first to join!
                </td>
              </tr>
            )}
            {leaderboard.map((m) => {
              const isYou    = m.userId === userId;
              const survived = m.survivedRounds ?? 0;
              const rowClass = [
                'lb-row-clickable',
                isYou ? 'lb-row-you' : '',
                m.isAlive ? '' : 'lb-row-out',
              ].filter(Boolean).join(' ');

              return (
                <tr
                  key={m.id}
                  className={rowClass}
                  onClick={() => setSelectedMember(m)}
                  title="Click to view picks"
                >
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
                    {m.isWinner ? (
                      <span className="status-winner-solid">🏆 Winner</span>
                    ) : m.isAlive ? (
                      survived === 0
                        ? <span className="status-alive-solid">Active</span>
                        : <span className="status-alive-solid">Survived {survived} {survived === 1 ? 'round' : 'rounds'}</span>
                    ) : (
                      <span className="status-out-solid">Eliminated {ROUND_LABELS[m.eliminatedRound] || m.eliminatedRound || ''}</span>
                    )}
                  </td>
                  {currentRound && (
                    <td className="lb-td-pick">
                      {roundIsLocked
                        ? (m.currentRoundPick
                            ? <span className={m.isAlive ? 'lb-pick-alive' : 'lb-pick-out'}>{m.currentRoundPick}</span>
                            : <span className="lb-pick-none">—</span>)
                        : <span className="lb-pick-hidden">🔒 Hidden</span>}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pick history modal */}
      {selectedMember && (
        <PickHistoryModal
          member={selectedMember}
          groupId={groupId}
          currentRound={data.openRound || null}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
