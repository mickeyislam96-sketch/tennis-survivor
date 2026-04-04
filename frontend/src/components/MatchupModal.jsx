import { useState, useEffect, useCallback } from 'react';
import { API } from '../App';

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
  if (r.includes('final') && !r.includes('quarter') && !r.includes('semi')) return 'F';
  if (r.includes('semi'))    return 'SF';
  if (r.includes('quarter')) return 'QF';
  if (r.includes('1/8'))     return 'R16';
  if (r.includes('1/16'))    return 'R32';
  if (r.includes('1/32'))    return 'R64';
  if (r.includes('1/64'))    return 'R128';
  return roundStr.replace(/^.*?-\s*/, '');
}

// ── Date formatting ──────────────────────────────────────────────────────────
function shortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-GB', { month: 'short', year: 'numeric' });
}

// ── Component ────────────────────────────────────────────────────────────────
export function MatchupModal({ player1Id, player2Id, player1Name, player2Name, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    if (!player1Id || !player2Id) return;
    setLoading(true);
    setError(null);

    fetch(`${API}/matchup/${player1Id}/${player2Id}`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [player1Id, player2Id]);

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
          <div className="mu-empty">No head-to-head data available.</div>
        </div>
      </div>
    );
  }

  const NO_RECORD = { won: 0, lost: 0 };
  const raw1 = data.player1 || {};
  const raw2 = data.player2 || {};
  const p1 = { ...raw1, clay: raw1.clay || NO_RECORD, overall: raw1.overall || NO_RECORD };
  const p2 = { ...raw2, clay: raw2.clay || NO_RECORD, overall: raw2.overall || NO_RECORD };
  const h2h = data.h2h || { player1Wins: 0, player2Wins: 0, meetings: [] };

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
            <div className="mu-player-name">{p1.name || player1Name}</div>
            <div className="mu-player-meta">{p1.country}{p1.rank ? ` · #${p1.rank}` : ''}</div>
          </div>
          <div className="mu-vs">
            <div className="mu-vs-label">Head to Head</div>
            <div className="mu-vs-score">
              <span className="mu-wins">{h2h.player1Wins}</span>
              <span className="mu-divider">-</span>
              <span className="mu-wins">{h2h.player2Wins}</span>
            </div>
          </div>
          <div className="mu-player">
            <div className="mu-player-name">{p2.name || player2Name}</div>
            <div className="mu-player-meta">{p2.country}{p2.rank ? ` · #${p2.rank}` : ''}</div>
          </div>
        </div>

        {/* Season stats */}
        <div className="mu-section">
          <div className="mu-section-title">{p1.season ? `${p1.season} Season Stats` : 'Season Stats'}</div>
          <div className="mu-stats-grid">
            <div className="mu-stat-card">
              <div className="mu-stat-label">Clay Record</div>
              <div className="mu-stat-values">
                <div>
                  <div className="mu-stat-num mu-stat-green">{p1.clay.won}-{p1.clay.lost}</div>
                  <div className="mu-stat-sub">{(p1.name || player1Name).split(' ').pop()}</div>
                </div>
                <div>
                  <div className="mu-stat-num mu-stat-green">{p2.clay.won}-{p2.clay.lost}</div>
                  <div className="mu-stat-sub">{(p2.name || player2Name).split(' ').pop()}</div>
                </div>
              </div>
            </div>
            <div className="mu-stat-card">
              <div className="mu-stat-label">Overall Record</div>
              <div className="mu-stat-values">
                <div>
                  <div className="mu-stat-num">{p1.overall.won}-{p1.overall.lost}</div>
                  <div className="mu-stat-sub">{(p1.name || player1Name).split(' ').pop()}</div>
                </div>
                <div>
                  <div className="mu-stat-num">{p2.overall.won}-{p2.overall.lost}</div>
                  <div className="mu-stat-sub">{(p2.name || player2Name).split(' ').pop()}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Previous meetings */}
        {h2h.meetings && h2h.meetings.length > 0 && (
          <div className="mu-section">
            <div className="mu-section-title">Previous Meetings</div>
            {h2h.meetings.map((m, i) => (
              <div key={i} className="mu-meeting">
                <div className={`mu-dot ${m.p1Won ? 'mu-dot-p1' : 'mu-dot-p2'}`} />
                <div className="mu-meeting-detail">
                  <div className="mu-meeting-tournament">{m.tournament}</div>
                  <div className="mu-meeting-round">{shortRound(m.round)}</div>
                </div>
                <div className="mu-meeting-score">{formatMatchScore(m.scores)}</div>
                <div className="mu-meeting-date">{shortDate(m.date)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Recent form */}
        {(p1.recent?.length > 0 || p2.recent?.length > 0) && (
          <div className="mu-section">
            <div className="mu-section-title">Recent Form</div>
            <div className="mu-form-cols">
              <div>
                <div className="mu-form-header">{(p1.name || player1Name).split(' ').pop()}</div>
                {(p1.recent || []).map((r, i) => (
                  <div key={i} className="mu-form-row">
                    <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                    <div className="mu-form-detail">
                      <div className="mu-form-opp">{r.opponent}</div>
                      <div className="mu-form-event">{r.tournament} · {shortRound(r.round)}</div>
                    </div>
                    <div className="mu-form-score">{formatMatchScore(r.scores)}</div>
                  </div>
                ))}
              </div>
              <div>
                <div className="mu-form-header">{(p2.name || player2Name).split(' ').pop()}</div>
                {(p2.recent || []).map((r, i) => (
                  <div key={i} className="mu-form-row">
                    <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                    <div className="mu-form-detail">
                      <div className="mu-form-opp">{r.opponent}</div>
                      <div className="mu-form-event">{r.tournament} · {shortRound(r.round)}</div>
                    </div>
                    <div className="mu-form-score">{formatMatchScore(r.scores)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="mu-footer">Data from API-Tennis · Updated every hour</div>
      </div>
    </div>
  );
}
