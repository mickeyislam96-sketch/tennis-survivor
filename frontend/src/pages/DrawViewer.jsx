import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../App';

const ROUND_LABELS = {
  R1:  'R1 (Byes)',
  R64: 'Round of 64',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-finals',
  SF:  'Semi-finals',
  F:   'Final',
};

const ROUND_SHORT = {
  R1:  'R1',
  R64: 'R64',
  R32: 'R32',
  R16: 'R16',
  QF:  'QF',
  SF:  'SF',
  F:   'Final',
};

export function DrawViewer() {
  const { groupId } = useParams();
  const [data, setData] = useState(null);
  const [round, setRound] = useState('R32');
  const [tournament, setTournament] = useState('');

  useEffect(() => {
    fetch(`${API}/draw/bracket?round=${round}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setTournament(d.tournament || '');
      })
      .catch(() => setData(null));
  }, [round]);

  if (!data) return <div className="page-loading">Loading draw…</div>;

  const rounds = data.rounds || [];
  const matchesByRound = (data.matches || []).reduce((acc, m) => {
    if (!acc[m.round]) acc[m.round] = [];
    acc[m.round].push(m);
    return acc;
  }, {});
  const currentMatches = matchesByRound[round] || [];
  const roundLabel = ROUND_LABELS[round] || round;

  return (
    <div className="page draw-viewer">
      <div className="draw-header">
        <div>
          <h1>Tournament Draw</h1>
          {tournament && <p className="draw-tournament-name">{tournament}</p>}
        </div>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* Round tabs */}
      <div className="round-tabs">
        {rounds.map((r) => (
          <button
            key={r}
            type="button"
            className={`round-tab ${r === round ? 'active' : ''}`}
            onClick={() => setRound(r)}
          >
            {ROUND_SHORT[r] || r}
          </button>
        ))}
      </div>

      <div className="draw-round-label">{roundLabel}</div>

      {/* Match grid */}
      {currentMatches.length === 0 ? (
        <div className="draw-empty-state">
          <span className="draw-empty-icon">🎾</span>
          <p className="draw-empty-title">Fixtures not yet available</p>
          <p className="draw-empty-sub">
            The {roundLabel} draw will be published once earlier rounds are complete. Check back soon.
          </p>
        </div>
      ) : (
        <div className="bracket-grid">
          {currentMatches.map((m, idx) => {
            const p1Wins = m.winnerId && m.winnerId === m.player1Id;
            const p2Wins = m.winnerId && m.winnerId === m.player2Id;
            const completed = m.status === 'completed';
            const live = m.status === 'in_progress';

            return (
              <div key={m.id || `${m.round}-${idx}`} className={`match-card status-${m.status || 'scheduled'}`}>
                {live && <div className="match-live-badge">LIVE</div>}

                <div className={`match-player-row ${p1Wins ? 'match-won' : completed && !p1Wins ? 'match-lost' : ''}`}>
                  <span className="match-player-name">{m.player1Name || 'TBD'}</span>
                  {p1Wins && <span className="match-winner-icon">✓</span>}
                </div>

                <div className="match-divider"><span className="match-vs">vs</span></div>

                <div className={`match-player-row ${p2Wins ? 'match-won' : completed && !p2Wins ? 'match-lost' : ''}`}>
                  <span className="match-player-name">{m.player2Name || 'TBD'}</span>
                  {p2Wins && <span className="match-winner-icon">✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="draw-footer-note">Results update automatically as matches complete.</p>
    </div>
  );
}
