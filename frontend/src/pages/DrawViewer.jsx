import { useState, useEffect, useCallback, useRef, useLayoutEffect, forwardRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';
import { MatchupModal } from '../components/MatchupModal';

// Round labels — extended to cover any tournament structure
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

// These are derived dynamically from API data — see DrawViewer component.
// Kept as fallback only.
const MATCH_COUNTS_FALLBACK = { R1: 32, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

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

// ─── SVG bracket connectors (DOM-measured) ────────────────────────────────────
// Reads actual slot positions from the adjacent BracketCol DOM nodes so that
// connector lines always align with card centres, even when completed cards
// (which include a score row) are taller than pending ones.

function DomConnector({ leftColRef, rightColRef, totalHeight }) {
  const svgRef = useRef(null);
  const [lines, setLines] = useState([]);

  useLayoutEffect(() => {
    function measure() {
      const svg = svgRef.current;
      const leftBody  = leftColRef?.current?.querySelector('.bc-col-body');
      const rightBody = rightColRef?.current?.querySelector('.bc-col-body');
      if (!svg || !leftBody || !rightBody) return;

      const svgRect   = svg.getBoundingClientRect();
      const leftSlots  = [...leftBody.querySelectorAll(':scope > .bc-slot')];
      const rightSlots = [...rightBody.querySelectorAll(':scope > .bc-slot')];

      // Centre Y of each slot relative to the SVG's top edge
      const leftCentres  = leftSlots.map(el => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - svgRect.top;
      });
      const rightCentres = rightSlots.map(el => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - svgRect.top;
      });

      const newLines = [];
      // Each right-column match is fed by a pair of left-column matches
      for (let k = 0; k < rightCentres.length; k++) {
        const topIdx = k * 2;
        const botIdx = k * 2 + 1;
        const topY = leftCentres[topIdx]  ?? 0;
        const botY = leftCentres[botIdx]  ?? topY;
        const midY = rightCentres[k]      ?? (topY + botY) / 2;

        newLines.push(
          { key: `ht${k}`, x1: 0,  y1: topY, x2: 16, y2: topY },
          { key: `hb${k}`, x1: 0,  y1: botY, x2: 16, y2: botY },
          { key: `v${k}`,  x1: 16, y1: topY, x2: 16, y2: botY },
          { key: `hm${k}`, x1: 16, y1: midY, x2: 32, y2: midY },
        );
      }
      setLines(newLines);
    }

    // Measure after paint
    measure();

    // Re-measure if card sizes change (e.g. results loading in)
    const leftBody  = leftColRef?.current?.querySelector('.bc-col-body');
    const rightBody = rightColRef?.current?.querySelector('.bc-col-body');
    const observer = new ResizeObserver(measure);
    if (leftBody)  observer.observe(leftBody);
    if (rightBody) observer.observe(rightBody);
    return () => observer.disconnect();
  }, [leftColRef, rightColRef]);

  const h = totalHeight || 2048;
  return (
    <svg ref={svgRef} width="32" height={h} className="bc-connector" aria-hidden="true">
      <g stroke="#d1d5db" strokeWidth="1.5" fill="none">
        {lines.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
      </g>
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

function canShowMatchup(match) {
  if (!match || match.bye) return false;
  const skip = ['TBD', 'BYE'];
  const p1 = match.player1Name;
  const p2 = match.player2Name;
  // Clickable if at least one real player is present
  const p1Real = p1 && !skip.includes(p1);
  const p2Real = p2 && !skip.includes(p2);
  return p1Real || p2Real;
}

function BracketCard({ match, onMatchClick }) {
  if (!match) {
    return (
      <div className="bc-card bc-card--tbd">
        <div className="bc-row bc-row--tbd"><span className="bc-name">TBD</span></div>
        <div className="bc-divider" />
        <div className="bc-row bc-row--tbd"><span className="bc-name">TBD</span></div>
      </div>
    );
  }

  // Bye card: seed has a first-round bye
  if (match.bye) {
    return (
      <div className="bc-card bc-card--bye">
        <div className="bc-row bc-won"><span className="bc-name">{match.player1Name}</span></div>
        <div className="bc-divider" />
        <div className="bc-row bc-row--tbd"><span className="bc-name bc-bye-label">BYE</span></div>
      </div>
    );
  }

  const p1w  = match.winnerId != null && match.winnerId === match.player1Id;
  const p2w  = match.winnerId != null && match.winnerId === match.player2Id;
  const done = match.status === 'completed';
  const live = isLive(match.status);
  const clickable = canShowMatchup(match);

  return (
    <div
      className={`bc-card${done ? ' bc-done' : ''}${live ? ' bc-live' : ''}${clickable ? ' bc-clickable' : ''}`}
      onClick={clickable ? () => onMatchClick(match) : undefined}
    >
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

const BracketCol = forwardRef(function BracketCol({ round, matches, totalHeight, matchCount, onMatchClick }, ref) {
  const count  = matchCount || MATCH_COUNTS_FALLBACK[round] || 1;
  const padded = Array.from({ length: count }, (_, i) => matches[i] || null);
  return (
    <div className="bc-col" ref={ref}>
      <div className="bc-col-hdr">{ROUND_FULL[round] || round}</div>
      <div className="bc-col-body" style={{ height: totalHeight }}>
        {padded.map((m, i) => (
          <div key={i} className="bc-slot">
            <BracketCard match={m} onMatchClick={onMatchClick} />
          </div>
        ))}
      </div>
    </div>
  );
});

// ─── List-view match card ─────────────────────────────────────────────────────
function ListCard({ match, onMatchClick }) {
  const p1w  = match.winnerId != null && match.winnerId === match.player1Id;
  const p2w  = match.winnerId != null && match.winnerId === match.player2Id;
  const done = match.status === 'completed';
  const live = isLive(match.status);
  const clickable = canShowMatchup(match);
  const date = match.startTime
    ? new Date(match.startTime).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div
      className={`lc${done ? ' lc--done' : live ? ' lc--live' : ' lc--upcoming'}${clickable ? ' lc-clickable' : ''}`}
      onClick={clickable ? () => onMatchClick(match) : undefined}
    >
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
  const [selectedMatch, setSelectedMatch] = useState(null);

  const handleMatchClick = useCallback((match) => {
    setSelectedMatch(match);
  }, []);

  const handleCloseModal = useCallback(() => {
    setSelectedMatch(null);
  }, []);

  // Refs for each bracket column — connectors read these to measure slot positions.
  // Must be declared here (before early returns) to satisfy React's rules of hooks.
  const colRefs = useRef({});
  function getColRef(round) {
    if (!colRefs.current[round]) colRefs.current[round] = { current: null };
    return colRefs.current[round];
  }

  useEffect(() => {
    if (!groupId) return;

    // Fetch group first to get the tournament, then conditionally fetch the draw.
    fetch(`${API}/groups/${groupId}`)
      .then(r => r.ok ? r.json() : null)
      .then(g => {
        if (!g) { setDrawAvailable(false); return; }
        const tid = g.tournamentId;
        if (tid) setTournamentId(tid);

        // Check frontend config — if the draw hasn't been released for this
        // tournament yet, show the "coming soon" state without hitting the API.
        const tournament = TOURNAMENTS.find(t => t.id === tid);
        if (tournament?.drawAvailable === false || tournament?.status !== 'active') {
          setDrawAvailable(false);
          return;
        }

        // Draw is available — fetch it.
        return fetch(`${API}/draw/bracket?round=F`)
          .then(r => { if (!r.ok) throw new Error('no-draw'); return r.json(); })
          .then(d => {
            if (d.drawAvailable === false) { setDrawAvailable(false); return; }
            setData(d);
            const rounds  = d.rounds || [];
            const byRound = (d.matches || []).reduce((a, m) => {
              a[m.round] = (a[m.round] || 0) + 1; return a;
            }, {});
            const first = rounds.find(r => byRound[r] > 0);
            if (first) setListRound(first);

            // If no bracket rounds (R32+) have data yet, default to list view
            // so users see live R1 matches rather than an empty bracket
            // Check if any round beyond R1 has data (bracket view needs at least R32+)
            const hasBracketData = rounds.filter(r => r !== 'R1').some((r) =>
              (d.matches || []).some((m) => m.round === r)
            );
            if (!hasBracketData) setView('list');
          })
          .catch(() => { setDrawAvailable(false); setData(null); });
      })
      .catch(() => { setDrawAvailable(false); });
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

  // Compute match counts dynamically from the draw data (handles any draw size)
  // Fallback to known counts if API data is incomplete.
  const matchCounts = {};
  rounds.forEach(r => {
    matchCounts[r] = (matchesByRound[r] || []).length || MATCH_COUNTS_FALLBACK[r] || 1;
  });

  // Bracket shows all rounds. Fixed height based on the first round (most matches).
  // 80px per slot — completed cards with score rows are ~74px tall; 80px avoids clipping.
  const firstRound    = rounds[0];
  const firstCount    = matchCounts[firstRound] || 1;
  const BRACKET_H_DYN = Math.max(firstCount * 80, 512);

  // All rounds with data form the bracket
  const bracketRounds  = rounds.filter(r => (matchesByRound[r] || []).length > 0);
  const orderedBracket = buildOrderedBracket(matchesByRound, bracketRounds);

  // Sort each round by matchOrder (set by backend for correct bracket alignment).
  // This fixes positioning when DFS cannot follow the bracket tree (e.g. pre-tournament
  // state where R32 player references are null and feeders become orphans).
  bracketRounds.forEach(round => {
    orderedBracket[round].sort((a, b) => (a.matchOrder ?? 999) - (b.matchOrder ?? 999));
  });

  const bracketEls = [];
  bracketRounds.forEach((round, i) => {
    if (i > 0) {
      const prevRound = bracketRounds[i - 1];
      bracketEls.push(
        <DomConnector
          key={`conn-${round}`}
          leftColRef={getColRef(prevRound)}
          rightColRef={getColRef(round)}
          totalHeight={BRACKET_H_DYN}
        />
      );
    }
    bracketEls.push(
      <BracketCol
        key={round}
        ref={getColRef(round)}
        round={round}
        matches={orderedBracket[round] || []}
        totalHeight={BRACKET_H_DYN}
        matchCount={matchCounts[round]}
        onMatchClick={handleMatchClick}
      />
    );
  });

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

      <p className="bracket-hint">Tap a matchup to compare players before you pick</p>

      {view === 'bracket' ? (
        bracketEls.length === 0 ? (
          <div className="draw-empty-state">
            <span className="draw-empty-icon">🎾</span>
            <p className="draw-empty-title">Bracket not yet available</p>
            <p className="draw-empty-sub">Switch to "By Round" to see individual match data, or check back once more fixtures are published.</p>
          </div>
        ) : (
          <>
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
          {/* Filter out bye entries from the list view — users only see real matches */}
          {(() => {
            const listMatches = (matchesByRound[listRound] || []).filter(m => !m.bye);
            return (
              <>
          <div className="draw-round-label">
            {ROUND_FULL[listRound] || listRound}
            <span className="draw-round-count"> · {listMatches.length} matches</span>
          </div>

          {listMatches.length === 0 ? (
            <div className="draw-empty-state">
              <span className="draw-empty-icon">🎾</span>
              <p className="draw-empty-title">No fixtures yet</p>
              <p className="draw-empty-sub">Check back once earlier rounds complete.</p>
            </div>
          ) : (
            <div className="lc-grid">
              {listMatches.map((m, idx) => (
                <ListCard key={m.id || idx} match={m} onMatchClick={handleMatchClick} />
              ))}
            </div>
          )}
              </>
            );
          })()}
        </>
      )}

      <p className="draw-footer-note">Results update automatically as matches complete.</p>

      {selectedMatch && (
        <MatchupModal
          player1Id={selectedMatch.player1ApiKey || selectedMatch.player1Id}
          player2Id={selectedMatch.player2ApiKey || selectedMatch.player2Id}
          player1Name={selectedMatch.player1Name}
          player2Name={selectedMatch.player2Name}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}
