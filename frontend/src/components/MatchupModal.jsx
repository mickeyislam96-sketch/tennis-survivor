import { useState, useEffect, useCallback } from 'react';
import { API } from '../App';
import PlayerAvatar from '../ui/PlayerAvatar';

// ── Score formatting ─────────────────────────────────────────────────────────
// API-Tennis uses decimal notation for tiebreaks: "6.3" → "6(3)", "7.7" → "7(7)"
function formatSetScore(s1, s2) {
  const format = (v) => {
    const str = String(v);
    if (str.includes('.')) {
      const [game, tb] = str.split('.');
      return `${game}(${tb})`;
    }
    return str;
  };
  return `${format(s1)}-${format(s2)}`;
}

function formatMatchScore(scores) {
  if (!Array.isArray(scores)) return '';
  return scores
    .filter(s => !(s.score_first === '0' && s.score_second === '0'))
    .map(s => formatSetScore(s.score_first, s.score_second))
    .join(' ');
}

// ── Round name shortener ─────────────────────────────────────────────────────
function shortRound(roundStr) {
  if (!roundStr) return '';
  const r = roundStr.toLowerCase();
  // Check fraction-based rounds FIRST — "1/32-finals" contains "final" but isn't the Final
  if (r.includes('1/64'))    return 'R128';
  if (r.includes('1/32'))    return 'R64';
  if (r.includes('1/16'))    return 'R32';
  if (r.includes('1/8'))     return 'R16';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('semi'))    return 'SF';
  if (r.includes('final'))   return 'F';
  return roundStr.replace(/^.*?-\s*/, '');
}

// ── Date formatting ──────────────────────────────────────────────────────────
function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ── Surname helper ──────────────────────────────────────────────────────────
function surname(name) {
  if (!name) return '';
  return name.split(' ').pop();
}

// ── Win percentage helper ───────────────────────────────────────────────────
function winPct(won, lost) {
  const total = won + lost;
  if (total === 0) return 0;
  return won / total;
}

// ── Component ────────────────────────────────────────────────────────────────
// Check if a player name represents an unknown/placeholder
function isUnknownPlayer(name) {
  if (!name) return true;
  return ['Qualifier', 'TBD', 'BYE'].includes(name);
}

export function MatchupModal({ player1Id, player2Id, player1Name, player2Name, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const p1Unknown = isUnknownPlayer(player1Name);
  const p2Unknown = isUnknownPlayer(player2Name);
  const hasOnlyOnePlayer = p1Unknown !== p2Unknown;

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Both players known: fetch full H2H
    // Pass names as query params so the backend can resolve seed-draw IDs to API-Tennis keys
    if (player1Id && player2Id && !p1Unknown && !p2Unknown) {
      const params = new URLSearchParams();
      if (player1Name) params.set('name1', player1Name);
      if (player2Name) params.set('name2', player2Name);
      fetch(`${API}/matchup/${player1Id}/${player2Id}?${params}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => { setData(d); setLoading(false); })
        .catch(e => { setError(e.message); setLoading(false); });
      return;
    }

    // One player known: fetch just their profile via the matchup endpoint
    // using a dummy second key — the endpoint still returns player1 profile data
    const knownId = p1Unknown ? player2Id : player1Id;
    const knownName = p1Unknown ? player2Name : player1Name;
    if (knownId) {
      const params = new URLSearchParams();
      if (knownName) { params.set('name1', knownName); params.set('name2', knownName); }
      // Fetch single player by requesting H2H with themselves (gives us their profile + recent form)
      fetch(`${API}/matchup/${knownId}/${knownId}?${params}`)
        .then(r => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
          return r.json();
        })
        .then(d => {
          // Restructure: put the known player data in the right slot
          const knownData = d.player1;
          const emptyPlayer = { name: null, country: null, rank: null, clay: { won: 0, lost: 0 }, overall: { won: 0, lost: 0 }, recent: [] };
          setData({
            player1: p1Unknown ? emptyPlayer : knownData,
            player2: p2Unknown ? emptyPlayer : knownData,
            h2h: { player1Wins: 0, player2Wins: 0, meetings: [] },
          });
          setLoading(false);
        })
        .catch(e => { setError(e.message); setLoading(false); });
      return;
    }

    // Neither has a real ID
    setLoading(false);
    setError('No player data available');
  }, [player1Id, player2Id, p1Unknown, p2Unknown]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Close on backdrop click
  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // ── Loading / error states ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mu-backdrop" onClick={handleBackdrop}>
        <div className="mu-modal">
          <div className="mu-header">
            <h2>Matchup Info</h2>
            <button className="mu-close" onClick={onClose}>&times;</button>
          </div>
          <div className="mu-loading">
            <div className="mu-spinner" />
            <p>Loading matchup data…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mu-backdrop" onClick={handleBackdrop}>
        <div className="mu-modal">
          <div className="mu-header">
            <h2>Matchup Info</h2>
            <button className="mu-close" onClick={onClose}>&times;</button>
          </div>
          <div className="mu-h2h-bar">
            <div className="mu-player">
              <PlayerAvatar playerName={player1Name} size={56} />
              <div className="mu-player-name">{player1Name || 'TBD'}</div>
            </div>
            <div className="mu-vs"><div className="mu-vs-label">vs</div></div>
            <div className="mu-player">
              <PlayerAvatar playerName={player2Name} size={56} />
              <div className="mu-player-name">{player2Name || 'TBD'}</div>
            </div>
          </div>
          <div className="mu-empty">Head-to-head stats will be available once the tournament starts.</div>
        </div>
      </div>
    );
  }

  const NO_RECORD = { won: 0, lost: 0 };
  const raw1 = data.player1 || {};
  const raw2 = data.player2 || {};
  const p1 = { ...raw1, clay: raw1.clay || NO_RECORD, overall: raw1.overall || NO_RECORD, claySeason: raw1.claySeason || null };
  const p2 = { ...raw2, clay: raw2.clay || NO_RECORD, overall: raw2.overall || NO_RECORD, claySeason: raw2.claySeason || null };
  const h2h = data.h2h || { player1Wins: 0, player2Wins: 0, meetings: [] };

  const p1Name = p1.name || player1Name;
  const p2Name = p2.name || player2Name;
  const p1Surname = surname(p1Name);
  const p2Surname = surname(p2Name);

  // Determine if clay stats are meaningful (at least one player has data)
  const hasClay = (p1.clay.won + p1.clay.lost + p2.clay.won + p2.clay.lost) > 0;

  // Compare stats to bold the stronger value
  const p1ClayBetter = winPct(p1.clay.won, p1.clay.lost) > winPct(p2.clay.won, p2.clay.lost);
  const p2ClayBetter = winPct(p2.clay.won, p2.clay.lost) > winPct(p1.clay.won, p1.clay.lost);
  const p1OverallBetter = winPct(p1.overall.won, p1.overall.lost) > winPct(p2.overall.won, p2.overall.lost);
  const p2OverallBetter = winPct(p2.overall.won, p2.overall.lost) > winPct(p1.overall.won, p1.overall.lost);

  // Filter recent form: skip entries with empty round (UTS etc.) or self-as-opponent (API quirk)
  const filterRecent = (results, playerName) =>
    (results || []).filter(r => r.opponent && r.opponent !== playerName);

  const p1Recent = filterRecent(p1.recent, p1Name);
  const p2Recent = filterRecent(p2.recent, p2Name);

  return (
    <div className="mu-backdrop" onClick={handleBackdrop}>
      <div className="mu-modal">

        {/* Header */}
        <div className="mu-header">
          <h2>Matchup Info</h2>
          <button className="mu-close" onClick={onClose}>&times;</button>
        </div>

        {/* H2H bar */}
        <div className="mu-h2h-bar">
          <div className="mu-player">
            <PlayerAvatar playerId={player1Id} playerName={p1Name} size={56} />
            <div className="mu-player-name">{p1Name}</div>
            <div className="mu-player-meta">
              {p1Unknown ? 'TBC' : `${p1.country || ''}${p1.rank ? ` · #${p1.rank}` : ''}`}
            </div>
          </div>
          {!hasOnlyOnePlayer ? (
            <div className="mu-vs">
              <div className="mu-vs-label">Head to Head</div>
              <div className="mu-vs-score">
                <span className={`mu-wins ${h2h.player1Wins > h2h.player2Wins ? 'mu-wins-leading' : ''}`}>{h2h.player1Wins}</span>
                <span className="mu-divider">-</span>
                <span className={`mu-wins ${h2h.player2Wins > h2h.player1Wins ? 'mu-wins-leading' : ''}`}>{h2h.player2Wins}</span>
              </div>
            </div>
          ) : (
            <div className="mu-vs">
              <div className="mu-vs-label">vs</div>
            </div>
          )}
          <div className="mu-player">
            <PlayerAvatar playerId={player2Id} playerName={p2Name} size={56} />
            <div className="mu-player-name">{p2Name}</div>
            <div className="mu-player-meta">
              {p2Unknown ? 'TBC' : `${p2.country || ''}${p2.rank ? ` · #${p2.rank}` : ''}`}
            </div>
          </div>
        </div>

        {/* Season stats */}
        <div className="mu-section">
          <div className="mu-section-title">{p1.season || p2.season ? `${p1.season || p2.season} Season` : 'Season Stats'}</div>
          <div className={`mu-stats-grid${hasClay ? '' : ' mu-stats-single'}`}>
            {hasClay && (
              <div className="mu-stat-card">
                <div className="mu-stat-label">Clay Record{(p1.claySeason || p2.claySeason) ? ` (${p1.claySeason || p2.claySeason})` : ''}</div>
                <div className="mu-stat-values">
                  {!p1Unknown && (
                    <div>
                      <div className={`mu-stat-num mu-stat-green${p1ClayBetter ? ' mu-stat-bold' : ''}`}>{p1.clay.won}-{p1.clay.lost}</div>
                      <div className="mu-stat-sub">{p1Surname}</div>
                    </div>
                  )}
                  {!p2Unknown && (
                    <div>
                      <div className={`mu-stat-num mu-stat-green${p2ClayBetter ? ' mu-stat-bold' : ''}`}>{p2.clay.won}-{p2.clay.lost}</div>
                      <div className="mu-stat-sub">{p2Surname}</div>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="mu-stat-card">
              <div className="mu-stat-label">Overall Record</div>
              <div className="mu-stat-values">
                {!p1Unknown && (
                  <div>
                    <div className={`mu-stat-num${!hasOnlyOnePlayer && p1OverallBetter ? ' mu-stat-bold' : ''}`}>{p1.overall.won}-{p1.overall.lost}</div>
                    <div className="mu-stat-sub">{p1Surname}</div>
                  </div>
                )}
                {!p2Unknown && (
                  <div>
                    <div className={`mu-stat-num${!hasOnlyOnePlayer && p2OverallBetter ? ' mu-stat-bold' : ''}`}>{p2.overall.won}-{p2.overall.lost}</div>
                    <div className="mu-stat-sub">{p2Surname}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Previous meetings */}
        {h2h.meetings && h2h.meetings.length > 0 && (
          <div className="mu-section">
            <div className="mu-section-title">Previous Meetings</div>
            {h2h.meetings.map((m, i) => {
              const winnerName = m.p1Won ? p1Surname : p2Surname;
              const roundLabel = shortRound(m.round);
              return (
                <div key={i} className="mu-meeting">
                  <div className={`mu-meeting-winner ${m.p1Won ? 'mu-meeting-winner-p1' : 'mu-meeting-winner-p2'}`}>
                    {winnerName}
                  </div>
                  <div className="mu-meeting-detail">
                    <div className="mu-meeting-tournament">{m.tournament}</div>
                    {roundLabel && <div className="mu-meeting-round">{roundLabel}</div>}
                  </div>
                  <div className="mu-meeting-score">{formatMatchScore(m.scores)}</div>
                  <div className="mu-meeting-date">{shortDate(m.date)}</div>
                </div>
              );
            })}
          </div>
        )}

        {/* Recent form */}
        {(p1Recent.length > 0 || p2Recent.length > 0) && (
          <div className="mu-section">
            <div className="mu-section-title">Recent Form</div>
            <div className={`mu-form-cols${hasOnlyOnePlayer ? ' mu-form-single' : ''}`}>
              {!p1Unknown && p1Recent.length > 0 && (
                <div>
                  <div className="mu-form-header">{p1Surname}</div>
                  {p1Recent.map((r, i) => {
                    const roundLabel = shortRound(r.round);
                    return (
                      <div key={i} className="mu-form-row">
                        <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                        <div className="mu-form-detail">
                          <div className="mu-form-opp">{r.opponent}</div>
                          <div className="mu-form-event">{r.tournament}{roundLabel ? ` · ${roundLabel}` : ''}</div>
                        </div>
                        <div className="mu-form-score">{formatMatchScore(r.scores)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!p2Unknown && p2Recent.length > 0 && (
                <div>
                  <div className="mu-form-header">{p2Surname}</div>
                  {p2Recent.map((r, i) => {
                    const roundLabel = shortRound(r.round);
                    return (
                      <div key={i} className="mu-form-row">
                        <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                        <div className="mu-form-detail">
                          <div className="mu-form-opp">{r.opponent}</div>
                          <div className="mu-form-event">{r.tournament}{roundLabel ? ` · ${roundLabel}` : ''}</div>
                        </div>
                        <div className="mu-form-score">{formatMatchScore(r.scores)}</div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mu-footer">Data from API-Tennis · Updated every hour</div>
      </div>
    </div>
  );
}
