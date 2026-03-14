import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';

const ROUND_LABELS = {
  R1: 'R1', R64: 'R64', R32: 'R32', R16: 'R16', QF: 'QF', SF: 'SF', F: 'Final',
};
const ROUND_FULL = {
  R1:  'First Round',
  R64: 'Round of 64',
  R32: 'Round of 32',
  R16: 'Round of 16',
  QF:  'Quarter-finals',
  SF:  'Semi-finals',
  F:   'Final',
};
// Expected slot counts per round (used to pad TBD slots)
const MATCH_COUNTS = { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

// Rounds shown in the visual bracket (R32 → Final keeps it manageable)
const BRACKET_ROUNDS = ['R32', 'R16', 'QF', 'SF', 'F'];

// Fixed bracket height — every column shares this so SVG connectors align
const BRACKET_H = 1280;

// ─── Bracket ordering ────────────────────────────────────────────────────────
// The API returns matches in arbitrary order. To draw a correct bracket we
// need adjacent pairs in each column to feed into the same next-round match.
// Algorithm: DFS from the Final, tracing each player back to their previous-
// round match. Player1's feeder comes first (top of bracket), Player2's second.

function findFeeder(playerId, prevRoundMatches) {
  if (!playerId) return null;
  return prevRoundMatches.find(
    m => m.player1Id === playerId || m.player2Id === playerId
  ) || null;
}

function buildOrderedBracket(matchesByRound, bracketRounds) {
  const ordered = {};
  bracketRounds.forEach(r => (ordered[r] = []));
  const visited = new Set();

  function dfs(match, roundIdx) {
    if (!match || visited.has(match.id)) return;
    visited.add(match.id);

    const round = bracketRounds[roundIdx];
    ordered[round].push(match);

    if (roundIdx === 0) return;

    const prevRound = bracketRounds[roundIdx - 1];
    const prevMatches = matchesByRound[prevRound] || [];
    dfs(findFeeder(match.player1Id, prevMatches), roundIdx - 1);
    dfs(findFeeder(match.player2Id, prevMatches), roundIdx - 1);
  }

  // Start DFS from the highest round that has actual match data.
  // If we always seed from the Final, we get nothing until the Final is played.
  // Starting from the highest available round (e.g. R16) means each R16 match
  // pulls its two feeder R32 matches into adjacent positions — so connector
  // lines pair correctly even mid-tournament.
  let topIdx = bracketRounds.length - 1;
  while (topIdx > 0 && (matchesByRound[bracketRounds[topIdx]] || []).length === 0) {
    topIdx--;
  }
  (matchesByRound[bracketRounds[topIdx]] || []).forEach(fm =>
    dfs(fm, topIdx)
  );

  // Append any orphan matches (not yet connected to the final bracket path)
  bracketRounds.forEach(round => {
    const placed = new Set(ordered[round].map(m => m.id));
    (matchesByRound[round] || [])
      .filter(m => !placed.has(m.id))
      .forEach(m => ordered[round].push(m));
  });

  return ordered;
}

// ─── SVG bracket connectors ───────────────────────────────────────────────────
function slotCenterY(index, total) {
  return ((2 * index + 1) * BRACKET_H) / (2 * total);
}

function ConnectorSVG({ fromCount }) {
  const toCount = fromCount / 2;
  const lines = [];
  for (let k = 0; k < toCount; k++) {
    const topY = slotCenterY(k * 2,     fromCount);
    const botY = slotCenterY(k * 2 + 1, fromCount);
    const midY = slotCenterY(k,          toCount);
    lines.push(
      <line key={`ht${k}`} x1="0"  y1={topY} x2="16" y2={topY} />,
      <line key={`hb${k}`} x1="0"  y1={botY} x2="16" y2={botY} />,
      <line key={`v${k}`}  x1="16" y1={topY} x2="16" y2={botY} />,
      <line key={`hm${k}`} x1="16" y1={midY} x2="32" y2={midY} />,
    );
  }
  return (
    <svg width="32" height={BRACKET_H} className="bc-connector" aria-hidden="true">
      <g stroke="#d1d5db" strokeWidth="1.5" fill="none">{lines}</g>
    </svg>
  );
}

// ─── Bracket match card ───────────────────────────────────────────────────────
function isLive(status) {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'in_progress' || s === '1' || s === '2' || s === '3' ||
         s === '4' || s === '5' || s.startsWith('set');
}

function BracketCard({ match }) {
  if (!match) {
    return (
      <div className="bc-card bc-card--tbd">
        <div className="bc-row bc-row--tbd"><span className="bc-name">TBD</span></div>
        <div className="bc-divider" />
        <div className="bc-row bc-row--tbd"><span className="bc-name">TBD</span></div>
      </div>
    );
  }
  const p1w  = match.winnerId === match.player1Id;
  const p2w  = match.winnerId === match.player2Id;
  const done = match.status === 'completed';
  const live = isLive(match.status);

  return (
    <div className={`bc-card${done ? ' bc-done' : ''}${live ? ' bc-live' : ''}`}>
      {live && <span className="bc-live-pip" />}
      <div className={`bc-row${p1w ? ' bc-won' : done ? ' bc-lost' : ''}`}>
        <span className="bc-name">{match.player1Name || 'TBD'}</span>
        {p1w && <span className="bc-tick">✓</span>}
      </div>
      <div className="bc-divider" />
      <div className={`bc-row${p2w ? ' bc-won' : done ? ' bc-lost' : ''}`}>
        <span className="bc-name">{match.player2Name || 'TBD'}</span>
        {p2w && <span className="bc-tick">✓</span>}
      </div>
      {done && match.score && (
        <div className="bc-score">{match.score}</div>
      )}
    </div>
  );
}

function BracketCol({ round, matches }) {
  const count = MATCH_COUNTS[round] || 1;
  const padded = Array.from({ length: count }, (_, i) => matches[i] || null);
  return (
    <div className="bc-col">
      <div className="bc-col-hdr">{ROUND_FULL[round] || round}</div>
      <div className="bc-col-body" style={{ height: BRACKET_H }}>
        {padded.map((m, i) => (
          <div key={i} className="bc-slot">
            <BracketCard match={m} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── List-view match card ─────────────────────────────────────────────────────
function ListCard({ match }) {
  const p1w  = match.winnerId === match.player1Id;
  const p2w  = match.winnerId === match.player2Id;
  const done = match.status === 'completed';
  const live = isLive(match.status);
  const date = match.startTime
    ? new Date(match.startTime).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className={`lc${done ? ' lc--done' : live ? ' lc--live' : ' lc--upcoming'}`}>
      {live && <div className="lc-live-bar">● LIVE</div>}
      <div className="lc-body">
        <div className="lc-players">
          <div className={`lc-row${p1w ? ' lc-won' : done ? ' lc-lost' : ''}`}>
            <span className="lc-name">{match.player1Name || 'TBD'}</span>
            {p1w && <span className="lc-win-dot" />}
          </div>
          <div className="lc-sep" />
          <div className={`lc-row${p2w ? ' lc-won' : done ? ' lc-lost' : ''}`}>
            <span className="lc-name">{match.player2Name || 'TBD'}</span>
            {p2w && <span className="lc-win-dot" />}
          </div>
        </div>
        {done && match.score && (
          <div className="lc-score">{match.score}</div>
        )}
      </div>
      <div className="lc-meta">
        {date && <span className="lc-date">{date}</span>}
        <span className={`lc-badge${live ? ' lc-badge--live' : done ? ' lc-badge--done' : ' lc-badge--upcoming'}`}>
          {live ? 'Live' : done ? 'Finished' : 'Scheduled'}
        </span>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function DrawViewer() {
  const { groupId } = useParams();
  const [data, setData]             = useState(null);
  const [drawAvailable, setDrawAvailable] = useState(true);
  const [view, setView]             = useState('bracket');
  const [listRound, setListRound]   = useState('R1');
  const [tournamentId, setTournamentId] = useState(null);

  useEffect(() => {
    // Fetch group info to know which tournament this pool is for
    if (groupId) {
      fetch(`${API}/groups/${groupId}`)
        .then(r => r.ok ? r.json() : null)
        .then(g => { if (g?.tournamentId) setTournamentId(g.tournamentId); })
        .catch(() => {});
    }

    fetch(`${API}/draw/bracket?round=F`)
      .then(r => { if (!r.ok) throw new Error('no-draw'); return r.json(); })
      .then(d => {
        if (d.drawAvailable === false) { setDrawAvailable(false); return; }
        setData(d);
        // Default list tab to earliest round that has matches
        const rounds  = d.rounds || [];
        const byRound = (d.matches || []).reduce((a, m) => {
          a[m.round] = (a[m.round] || 0) + 1; return a;
        }, {});
        const first = rounds.find(r => byRound[r] > 0);
        if (first) setListRound(first);
      })
      .catch(() => { setDrawAvailable(false); setData(null); });
  }, [groupId]);

  if (!drawAvailable) {
    return (
      <div className="page draw-viewer">
        <div className="draw-header">
          <h1>Tournament Draw</h1>
          <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
        </div>
        <div className="draw-tbc-banner">
          <div className="draw-tbc-icon">🎾</div>
          <h2 className="draw-tbc-title">Draw not yet released</h2>
          <p className="draw-tbc-sub">Check back nearer to the start date — usually 1–2 days before play begins.</p>
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

  // Build correctly ordered bracket (traces player progression from Final back)
  const bracketRounds  = BRACKET_ROUNDS.filter(r => rounds.includes(r));
  const orderedBracket = buildOrderedBracket(matchesByRound, bracketRounds);

  const bracketEls = [];
  bracketRounds.forEach((round, i) => {
    if (i > 0) {
      bracketEls.push(
        <ConnectorSVG key={`conn-${round}`} fromCount={MATCH_COUNTS[bracketRounds[i - 1]] || 2} />
      );
    }
    bracketEls.push(
      <BracketCol key={round} round={round} matches={orderedBracket[round] || []} />
    );
  });

  // SofaScore widget URL — stored per tournament in tournaments.js
  const tournament = TOURNAMENTS.find(t => t.id === tournamentId) || TOURNAMENTS.find(t => t.status === 'active');
  const widgetUrl = tournament?.bracketWidget || null;

  // Only show rounds that have at least one match
  const roundsWithData = rounds.filter(r => (matchesByRound[r] || []).length > 0);

  return (
    <div className="page draw-viewer">
      <div className="draw-header">
        <div>
          <h1>Tournament Draw</h1>
          {data.tournament && <p className="draw-tournament-name">{data.tournament}</p>}
        </div>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      <div className="draw-view-toggle">
        <button className={`dvt-btn${view === 'bracket' ? ' dvt-active' : ''}`} onClick={() => setView('bracket')}>
          Bracket
        </button>
        <button className={`dvt-btn${view === 'list' ? ' dvt-active' : ''}`} onClick={() => setView('list')}>
          By Round
        </button>
      </div>

      {view === 'bracket' ? (
        widgetUrl ? (
          <div className="sofascore-widget-wrap">
            <iframe
              src={widgetUrl}
              style={{ width: '100%', maxWidth: 700, height: 872, border: 'none', display: 'block' }}
              scrolling="yes"
              title="Tournament Draw"
            />
            <p className="widget-credit">
              Draw data via <a href="https://www.sofascore.com" target="_blank" rel="noopener noreferrer">SofaScore</a>
            </p>
          </div>
        ) : (
          <>
            <p className="bracket-help-text">R32 through to the Final — follow the path to the title</p>
            <div className="bracket-scroll-wrap">
              <div className="bracket-wrap">{bracketEls}</div>
            </div>
          </>
        )
      ) : (
        <>
          <div className="round-tabs">
            {roundsWithData.map(r => (
              <button
                key={r}
                className={`round-tab${r === listRound ? ' active' : ''}`}
                onClick={() => setListRound(r)}
              >
                {ROUND_LABELS[r]}
              </button>
            ))}
          </div>
          <div className="draw-round-label">
            {ROUND_FULL[listRound] || listRound}
            <span className="draw-round-count"> · {(matchesByRound[listRound] || []).length} matches</span>
          </div>

          {(matchesByRound[listRound] || []).length === 0 ? (
            <div className="draw-empty-state">
              <span className="draw-empty-icon">🎾</span>
              <p className="draw-empty-title">No fixtures yet</p>
              <p className="draw-empty-sub">Check back once earlier rounds complete.</p>
            </div>
          ) : (
            <div className="lc-grid">
              {(matchesByRound[listRound] || []).map((m, idx) => (
                <ListCard key={m.id || idx} match={m} />
              ))}
            </div>
          )}
        </>
      )}

      <p className="draw-footer-note">Results update automatically as matches complete.</p>
    </div>
  );
}
