import { useState, useEffect, useCallback, useRef, useLayoutEffect, forwardRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API } from '../App';
import { getTournament } from '../data/tournaments';
import { MatchupModal } from '../components/MatchupModal';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { ROUND_SHORT as ROUND_LABELS, ROUND_FULL } from '../data/roundLabels';
import PlayerAvatar from '../ui/PlayerAvatar';
import './DrawViewer.css';

const MATCH_COUNTS_FALLBACK = { R1: 64, R64: 32, R32: 16, R16: 8, QF: 4, SF: 2, F: 1 };

// ── Bracket ordering ──────────────────────────────────────────
// Matches are ordered by matchOrder (assigned by seedDrawLoader from the
// static draw JSON). This gives correct top-to-bottom bracket position
// without needing DFS traversal through player IDs — which fails before
// any results exist (all player IDs in R32+ are null pre-tournament).

// ── SVG connectors ─────────────────────────────────────────────
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

      const leftCentres  = leftSlots.map(el => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - svgRect.top;
      });
      const rightCentres = rightSlots.map(el => {
        const r = el.getBoundingClientRect();
        return r.top + r.height / 2 - svgRect.top;
      });

      const newLines = [];

      // Standard 2:1 bracket connector — every pair of left matches feeds one right match
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

    measure();

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
      <g stroke="var(--ds-border-strong, #C9C2B1)" strokeWidth="1.5" fill="none">
        {lines.map(l => <line key={l.key} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} />)}
      </g>
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────
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
  const p1Real = p1 && !skip.includes(p1);
  const p2Real = p2 && !skip.includes(p2);
  return p1Real || p2Real;
}

// ── Bracket card ──────────────────────────────────────────────
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

  if (match.bye) {
    // Detect which side is the real player (seed) vs the BYE slot
    const p1IsBye = !match.player1Name || match.player1Name === 'BYE';
    const seedName = p1IsBye ? match.player2Name : match.player1Name;
    const seedId   = p1IsBye ? match.player2Id   : match.player1Id;
    return (
      <div className="bc-card bc-card--bye">
        <div className="bc-row bc-won">
          {seedName && <PlayerAvatar playerId={seedId} playerName={seedName} size={20} />}
          <span className="bc-name">{seedName || 'TBD'}</span>
        </div>
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
        {match.player1Name && <PlayerAvatar playerId={match.player1Id} playerName={match.player1Name} size={20} />}
        <span className="bc-name">{match.player1Name || 'TBD'}</span>
        {p1w && <span className="bc-tick">✓</span>}
      </div>
      <div className="bc-divider" />
      <div className={`bc-row${p2w ? ' bc-won' : done ? ' bc-lost' : ''}`}>
        {match.player2Name && <PlayerAvatar playerId={match.player2Id} playerName={match.player2Name} size={20} />}
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

// ── List card ─────────────────────────────────────────────────
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
            {match.player1Name && <PlayerAvatar playerId={match.player1Id} playerName={match.player1Name} size={24} />}
            <span className="lc-name">{match.player1Name || 'TBD'}</span>
            {p1w && <span className="lc-win-dot" />}
          </div>
          <div className="lc-sep" />
          <div className={`lc-row${p2w ? ' lc-won' : done ? ' lc-lost' : ''}`}>
            {match.player2Name && <PlayerAvatar playerId={match.player2Id} playerName={match.player2Name} size={24} />}
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
        {live ? (
          <Badge tone="danger" size="sm" dot>Live</Badge>
        ) : done ? (
          <Badge tone="success" size="sm">Finished</Badge>
        ) : (
          <Badge tone="neutral" size="sm">Scheduled</Badge>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export function DrawViewer() {
  const { groupId } = useParams();
  const [data, setData] = useState(null);
  const [drawAvailable, setDrawAvailable] = useState(true);
  const [view, setView] = useState('bracket');
  const [listRound, setListRound] = useState('R1');
  const [, setTournamentId] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);

  const handleMatchClick = useCallback((match) => setSelectedMatch(match), []);
  const handleCloseModal = useCallback(() => setSelectedMatch(null), []);

  const colRefs = useRef({});
  function getColRef(round) {
    if (!colRefs.current[round]) colRefs.current[round] = { current: null };
    return colRefs.current[round];
  }

  useEffect(() => {
    if (!groupId) return;

    fetch(`${API}/groups/${groupId}`)
      .then(r => r.ok ? r.json() : null)
      .then(g => {
        if (!g) { setDrawAvailable(false); return; }
        const tid = g.tournamentId;
        if (tid) setTournamentId(tid);

        const tournament = getTournament(tid);
        if (tournament?.drawAvailable === false && tournament?.status !== 'completed') {
          setDrawAvailable(false);
          return;
        }

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
      <div className="dv-page">
        <Hero
          tone="primary"
          compact
          showCourt
          eyebrow="TOURNAMENT DRAW"
          title={<>The bracket <em>drops soon</em>.</>}
          lede="Draws are usually released 1–2 days before play begins. We'll open picks automatically."
        />
        <Section tone="canvas" size="md">
          <div className="dv-back-row">
            <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
              ← Back to pool
            </Button>
          </div>
          <Card tone="muted" padding="lg" className="dv-empty-card">
            <div className="dv-empty-icon" aria-hidden="true">🎾</div>
            <p className="dv-empty-title">Draw not yet released</p>
            <p className="dv-empty-sub">
              Check back nearer to the start date — usually 1–2 days before play begins.
            </p>
          </Card>
        </Section>
      </div>
    );
  }

  if (!data) {
    return (
      <Section tone="canvas" size="lg">
        <p className="dv-loading">Loading draw…</p>
      </Section>
    );
  }

  const rounds = data.rounds || [];
  const matchesByRound = (data.matches || []).reduce((acc, m) => {
    (acc[m.round] = acc[m.round] || []).push(m);
    return acc;
  }, {});

  // Standard bracket: show ALL matches including byes (same as ATP website).
  // Byes display as "Seed Name / BYE" with seed advancing. 96-draw Masters
  // has 64 R1 matches (32 real + 32 byes) → 32 R64 → 16 R32 → etc.
  // All connectors are standard 2:1 bracket format.
  const matchCounts = {};
  rounds.forEach(r => {
    matchCounts[r] = (matchesByRound[r] || []).length || MATCH_COUNTS_FALLBACK[r] || 1;
  });

  const firstRound    = rounds[0];
  const firstCount    = matchCounts[firstRound] || 1;
  const BRACKET_H_DYN = Math.max(firstCount * 80, 512);

  const bracketRounds = rounds.filter(r => (matchesByRound[r] || []).length > 0);

  // Sort each round by matchOrder (sequential top-to-bottom from seed draw JSON).
  const orderedBracket = {};
  bracketRounds.forEach(round => {
    orderedBracket[round] = [...(matchesByRound[round] || [])]
      .sort((a, b) => (a.matchOrder ?? 999) - (b.matchOrder ?? 999));
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

  const roundsWithData = rounds.filter(r => (matchesByRound[r] || []).length > 0);

  return (
    <div className="dv-page">
      <Hero
        tone="primary"
        compact
        showCourt
        eyebrow={data.tournament ? `DRAW · ${data.tournament.toUpperCase()}` : 'TOURNAMENT DRAW'}
        title={<>The <em>bracket</em>.</>}
        lede="Live results, scores, and every matchup in the draw."
      />

      <Section tone="canvas" size="md">
        <div className="dv-top-row">
          <SectionHeader
            eyebrow="RESULTS"
            title={<>How the <em>draw</em> is shaping up.</>}
          />
          <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
            ← Back to pool
          </Button>
        </div>

        <div className="dv-controls">
          <div className="dv-view-toggle" role="tablist" aria-label="View mode">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'bracket'}
              className={`dv-view-btn${view === 'bracket' ? ' is-active' : ''}`}
              onClick={() => setView('bracket')}
            >
              Bracket
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'list'}
              className={`dv-view-btn${view === 'list' ? ' is-active' : ''}`}
              onClick={() => setView('list')}
            >
              By round
            </button>
          </div>
          <p className="dv-hint">Tap a matchup for player info.</p>
        </div>

        {view === 'bracket' ? (
          bracketEls.length === 0 ? (
            <Card tone="muted" padding="lg" className="dv-empty-card">
              <div className="dv-empty-icon" aria-hidden="true">🎾</div>
              <p className="dv-empty-title">Bracket not yet available</p>
              <p className="dv-empty-sub">
                Switch to "By round" to see individual match data, or check back once more fixtures are published.
              </p>
            </Card>
          ) : (
            <div className="bracket-scroll-wrap">
              <div className="bracket-wrap">{bracketEls}</div>
            </div>
          )
        ) : (
          <>
            <div className="dv-round-tabs" role="tablist" aria-label="Select round">
              {roundsWithData.map(r => (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={r === listRound}
                  className={`dv-round-tab${r === listRound ? ' is-active' : ''}`}
                  onClick={() => setListRound(r)}
                >
                  {ROUND_LABELS[r]}
                </button>
              ))}
            </div>

            {(() => {
              const listMatches = (matchesByRound[listRound] || []).filter(m => !m.bye);
              return (
                <>
                  <div className="dv-round-header">
                    <span className="dv-round-title">{ROUND_FULL[listRound] || listRound}</span>
                    <span className="dv-round-count">· {listMatches.length} matches</span>
                  </div>

                  {listMatches.length === 0 ? (
                    <Card tone="muted" padding="lg" className="dv-empty-card">
                      <div className="dv-empty-icon" aria-hidden="true">🎾</div>
                      <p className="dv-empty-title">No fixtures yet</p>
                      <p className="dv-empty-sub">Check back once earlier rounds complete.</p>
                    </Card>
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

        <p className="dv-footer-note">Results update automatically as matches complete.</p>
      </Section>

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
