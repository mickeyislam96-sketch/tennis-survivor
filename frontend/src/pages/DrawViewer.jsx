import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../App';

const ROUND_LABELS = {
  R1: 'R1', R64: 'R64', R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final',
};
const ROUND_FULL = {
  R1: 'Round 1 (Byes)', R64: 'Round of 64', R32: 'Round of 32',
  R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', F: 'Final',
};
const MATCH_COUNTS = { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

// Rounds shown in the bracket view (R32 onwards — "look ahead" view)
const BRACKET_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

// Fixed pixel height for the bracket container — all columns share this height.
// With space-around, each round's slots auto-scale so bracket lines align.
const BRACKET_H = 1280;

// Y-center of slot `index` out of `total` slots in a space-around flex column
function slotCenterY(index, total) {
  return (2 * index + 1) * BRACKET_H / (2 * total);
}

// SVG bracket connectors between two adjacent round columns.
// `fromCount` matches on the left; `fromCount/2` on the right.
function ConnectorSVG({ fromCount }) {
  const toCount = fromCount / 2;
  const lines = [];
  for (let k = 0; k < toCount; k++) {
    const topY = slotCenterY(k * 2,     fromCount);
    const botY = slotCenterY(k * 2 + 1, fromCount);
    const midY = slotCenterY(k,          toCount);
    lines.push(
      <line key={`ht${k}`} x1="0"  y1={topY} x2="18" y2={topY} />,
      <line key={`hb${k}`} x1="0"  y1={botY} x2="18" y2={botY} />,
      <line key={`v${k}`}  x1="18" y1={topY} x2="18" y2={botY} />,
      <line key={`hm${k}`} x1="18" y1={midY} x2="36" y2={midY} />,
    );
  }
  return (
    <svg width="36" height={BRACKET_H} className="bc-connector" aria-hidden="true">
      <g stroke="#cbd5e1" strokeWidth="1.5" fill="none">{lines}</g>
    </svg>
  );
}

function BracketCard({ match }) {
  if (!match) {
    return (
      <div className="bc-card bc-card--tbd">
        <div className="bc-player">TBD</div>
        <div className="bc-player">TBD</div>
      </div>
    );
  }
  const p1w = match.winnerId && match.winnerId === match.player1Id;
  const p2w = match.winnerId && match.winnerId === match.player2Id;
  const done = match.status === 'completed';
  const live = match.status === 'in_progress';
  return (
    <div className={`bc-card${done ? ' bc-card--done' : ''}${live ? ' bc-card--live' : ''}`}>
      {live && <div className="bc-live-dot">LIVE</div>}
      <div className={`bc-player${p1w ? ' bc-won' : done && !p1w ? ' bc-lost' : ''}`}>
        <span className="bc-name">{match.player1Name || 'TBD'}</span>
        {p1w && <span className="bc-check">✓</span>}
      </div>
      <div className={`bc-player${p2w ? ' bc-won' : done && !p2w ? ' bc-lost' : ''}`}>
        <span className="bc-name">{match.player2Name || 'TBD'}</span>
        {p2w && <span className="bc-check">✓</span>}
      </div>
    </div>
  );
}

function BracketCol({ round, matches }) {
  const count = MATCH_COUNTS[round] || 1;
  const padded = Array.from({ length: count }, (_, i) => matches[i] || null);
  return (
    <div className="bc-col">
      <div className="bc-col-hdr">{ROUND_LABELS[round]}</div>
      <div className="bc-col-body">
        {padded.map((m, i) => (
          <div key={i} className="bc-slot">
            <BracketCard match={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function DrawViewer() {
  const { groupId } = useParams();
  const [data, setData]           = useState(null);
  const [drawAvailable, setDrawAvailable] = useState(true);
  const [view, setView]           = useState('bracket');
  const [listRound, setListRound] = useState('R64');

  useEffect(() => {
    // First check if the pool's tournament has a draw available.
    // We derive this from the /groups/:id response, which includes tournamentId.
    // Then try to fetch the bracket — if the server signals no draw, show TBC.
    fetch(`${API}/draw/bracket?round=F`)
      .then(r => {
        if (!r.ok) throw new Error('no-draw');
        return r.json();
      })
      .then(d => {
        // If server explicitly signals draw is not available, show TBC
        if (d.drawAvailable === false) {
          setDrawAvailable(false);
        } else {
          setData(d);
        }
      })
      .catch(() => {
        // A 404 or error means the draw isn't available yet
        setDrawAvailable(false);
        setData(null);
      });
  }, []);

  if (!drawAvailable) {
    return (
      <div className="page draw-viewer">
        <div className="draw-header">
          <div>
            <h1>Tournament Draw</h1>
          </div>
          <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
        </div>
        <div className="draw-tbc-banner">
          <div className="draw-tbc-icon">🎾</div>
          <h2 className="draw-tbc-title">Draw announced closer to the tournament</h2>
          <p className="draw-tbc-sub">
            The draw for this tournament hasn't been released yet. Check back nearer to the start date — it usually drops 1–2 days before play begins.
          </p>
        </div>
      </div>
    );
  }

  if (!data) return <div className="page-loading">Loading draw…</div>;

  const rounds = data.rounds || [];
  const matchesByRound = (data.matches || []).reduce((acc, m) => {
    (acc[m.round] = acc[m.round] || []).push(m);
    return acc;
  }, {});

  const bracketRounds = BRACKET_ROUNDS.filter(r => rounds.includes(r));

  // Build bracket elements (columns + SVG connectors)
  const bracketEls = [];
  bracketRounds.forEach((round, i) => {
    if (i > 0) {
      const prevCount = MATCH_COUNTS[bracketRounds[i - 1]] || 2;
      bracketEls.push(<ConnectorSVG key={`conn-${round}`} fromCount={prevCount} />);
    }
    bracketEls.push(
      <BracketCol key={round} round={round} matches={matchesByRound[round] || []} />
    );
  });

  return (
    <div className="page draw-viewer">
      <div className="draw-header">
        <div>
          <h1>Tournament Draw</h1>
          {data.tournament && <p className="draw-tournament-name">{data.tournament}</p>}
        </div>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* View toggle */}
      <div className="draw-view-toggle">
        <button
          className={`dvt-btn${view === 'bracket' ? ' dvt-active' : ''}`}
          onClick={() => setView('bracket')}
        >
          Bracket
        </button>
        <button
          className={`dvt-btn${view === 'list' ? ' dvt-active' : ''}`}
          onClick={() => setView('list')}
        >
          By round
        </button>
      </div>

      {view === 'bracket' ? (
        <>
          <p className="bracket-help-text">
            R32 through to the Final — follow the path to the title
          </p>
          <div className="bracket-scroll-wrap">
            <div className="bracket-wrap">{bracketEls}</div>
          </div>
        </>
      ) : (
        <>
          <div className="round-tabs">
            {rounds.map(r => (
              <button
                key={r}
                className={`round-tab${r === listRound ? ' active' : ''}`}
                onClick={() => setListRound(r)}
              >
                {ROUND_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="draw-round-label">{ROUND_FULL[listRound] || listRound}</div>

          {(matchesByRound[listRound] || []).length === 0 ? (
            <div className="draw-empty-state">
              <span className="draw-empty-icon">🎾</span>
              <p className="draw-empty-title">Fixtures not yet available</p>
              <p className="draw-empty-sub">Check back once earlier rounds complete.</p>
            </div>
          ) : (
            <div className="bracket-grid">
              {(matchesByRound[listRound] || []).map((m, idx) => {
                const p1w = m.winnerId && m.winnerId === m.player1Id;
                const p2w = m.winnerId && m.winnerId === m.player2Id;
                const done = m.status === 'completed';
                const live = m.status === 'in_progress';
                return (
                  <div key={m.id || idx} className={`match-card status-${m.status || 'scheduled'}`}>
                    {live && <div className="match-live-badge">LIVE</div>}
                    <div className={`match-player-row${p1w ? ' match-won' : done && !p1w ? ' match-lost' : ''}`}>
                      <span className="match-player-name">{m.player1Name || 'TBD'}</span>
                      {p1w && <span className="match-winner-icon">✓</span>}
                    </div>
                    <div className="match-divider"><span className="match-vs">vs</span></div>
                    <div className={`match-player-row${p2w ? ' match-won' : done && !p2w ? ' match-lost' : ''}`}>
                      <span className="match-player-name">{m.player2Name || 'TBD'}</span>
                      {p2w && <span className="match-winner-icon">✓</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <p className="draw-footer-note">Results update automatically as matches complete.</p>
    </div>
  );
}
