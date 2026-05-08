import { useState, useEffect, useCallback } from 'react';
import { API } from '../App';
import PlayerAvatar from '../ui/PlayerAvatar';
import { shortName } from '../utils/playerImage';
import { ROUND_SHORT } from '../data/roundLabels';
import './MatchupModal.css';

// ── Helpers ─────────────────────────────────────────────────────────────────

function isUnknownPlayer(name) {
  if (!name) return true;
  return ['Qualifier', 'TBD', 'BYE'].includes(name);
}

function seedLabel(seed) {
  if (!seed) return null;
  if (typeof seed === 'number') return `[${seed}]`;
  if (seed === 'WC') return '[WC]';
  if (seed === 'Q') return '[Q]';
  if (seed === 'PR') return '[PR]';
  if (seed === 'LL') return '[LL]';
  if (seed === 'Alt') return '[Alt]';
  return `[${seed}]`;
}

function countryFlag(code) {
  if (!code || code.length < 2) return '';
  const cc = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

function countryName(code) {
  if (!code) return '';
  const map = { ESP: 'Spain', ARG: 'Argentina', GRE: 'Greece', ITA: 'Italy', GER: 'Germany', FRA: 'France', USA: 'USA', GBR: 'Great Britain', AUS: 'Australia', CAN: 'Canada', RUS: 'Russia', SRB: 'Serbia', CRO: 'Croatia', NOR: 'Norway', DEN: 'Denmark', SUI: 'Switzerland', BEL: 'Belgium', NED: 'Netherlands', POL: 'Poland', CZE: 'Czech Republic', CHI: 'Chile', BRA: 'Brazil', JPN: 'Japan', KOR: 'South Korea', CHN: 'China', PER: 'Peru', COL: 'Colombia', BUL: 'Bulgaria', HUN: 'Hungary', FIN: 'Finland', POR: 'Portugal' };
  return map[code?.toUpperCase()] || code;
}

/** Calculate streak from form array (most recent first). Returns e.g. "W3" or "L2". */
function calcStreak(form) {
  if (!form || form.length === 0) return null;
  const first = form[0].won;
  let count = 0;
  for (const r of form) {
    if (r.won === first) count++;
    else break;
  }
  return { type: first ? 'W' : 'L', count };
}

/** Calculate W-L summary from form array */
function formSummary(form) {
  if (!form || form.length === 0) return null;
  const wins = form.filter(r => r.won).length;
  const losses = form.length - wins;
  let label = '';
  if (wins > losses + 1) label = 'Good form';
  else if (losses > wins + 1) label = 'Struggling';
  else label = 'Mixed';
  return { wins, losses, label };
}

// ── Surface colour helper ───────────────────────────────────────────────────

function surfaceDotClass(surface) {
  if (!surface) return '';
  const s = surface.toLowerCase();
  if (s.includes('clay')) return 'mu2-dot--clay';
  if (s.includes('grass')) return 'mu2-dot--grass';
  return 'mu2-dot--hard';
}

// ── Component ───────────────────────────────────────────────────────────────

export function MatchupModal({ player1Id, player2Id, player1Name, player2Name, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  const p1Unknown = isUnknownPlayer(player1Name);
  const p2Unknown = isUnknownPlayer(player2Name);
  const hasOnlyOnePlayer = p1Unknown !== p2Unknown;

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    if (p1Unknown && p2Unknown) {
      setLoading(false);
      setError('No player data available');
      return;
    }

    const params = new URLSearchParams();
    if (player1Name && !p1Unknown) params.set('name1', player1Name);
    if (player2Name && !p2Unknown) params.set('name2', player2Name);

    const id1 = p1Unknown ? '_tbd' : (player1Id || '_unknown');
    const id2 = p2Unknown ? '_tbd' : (player2Id || '_unknown');

    fetch(`${API}/matchup/${id1}/${id2}?${params}`, { signal: controller.signal })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(d => { setData(d); setLoading(false); })
      .catch(e => {
        if (e.name !== 'AbortError') { setError(e.message); setLoading(false); }
      });

    return () => controller.abort();
  }, [player1Id, player2Id, player1Name, player2Name, p1Unknown, p2Unknown]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleBackdrop = useCallback((e) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="mu-backdrop" onClick={handleBackdrop}>
        <div className="mu-modal">
          <div className="mu2-header">
            <div className="mu2-header-top">
              <span className="mu2-eyebrow">Matchup Info</span>
              <button className="mu2-close" onClick={onClose}>✕</button>
            </div>
          </div>
          <div className="mu-loading">
            <div className="mu-spinner" />
            <p>Loading matchup data...</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error / no data state ─────────────────────────────────────────────────
  if (error || !data) {
    return (
      <div className="mu-backdrop" onClick={handleBackdrop}>
        <div className="mu-modal">
          <div className="mu2-header">
            <div className="mu2-header-top">
              <span className="mu2-eyebrow">Matchup Info</span>
              <button className="mu2-close" onClick={onClose}>✕</button>
            </div>
            <div className="mu2-versus-strip">
              <div className="mu2-player-side">
                <div className="mu2-avatar-wrap">
                  <PlayerAvatar playerId={player1Id} playerName={player1Name} size={64} />
                </div>
                <div className="mu2-player-name">{player1Name ? shortName(player1Name) : 'TBD'}</div>
              </div>
              <div className="mu2-vs-divider"><div className="mu2-vs-circle">vs</div></div>
              <div className="mu2-player-side">
                <div className="mu2-avatar-wrap">
                  <PlayerAvatar playerId={player2Id} playerName={player2Name} size={64} />
                </div>
                <div className="mu2-player-name">{player2Name ? shortName(player2Name) : 'TBD'}</div>
              </div>
            </div>
          </div>
          <div className="mu-empty">Player stats will be available once the tournament starts.</div>
        </div>
      </div>
    );
  }

  // ── Data loaded ───────────────────────────────────────────────────────────
  const p1 = data.player1 || {};
  const p2 = data.player2 || {};
  const h2h = data.h2h || {};

  const p1Name = p1.name || player1Name;
  const p2Name = p2.name || player2Name;
  const p1Flag = countryFlag(p1.country);
  const p2Flag = countryFlag(p2.country);
  const p1Country = countryName(p1.country) || p1.country || '';
  const p2Country = countryName(p2.country) || p2.country || '';
  const p1Seed = seedLabel(p1.seed);
  const p2Seed = seedLabel(p2.seed);

  const p1Form = p1.tournamentForm || [];
  const p2Form = p2.tournamentForm || [];
  const p1RecentForm = p1.recentForm || [];
  const p2RecentForm = p2.recentForm || [];
  const hasForm = p1Form.length > 0 || p2Form.length > 0;

  // Use tournament form if available, otherwise recent form
  const p1DisplayForm = p1Form.length > 0 ? p1Form : p1RecentForm;
  const p2DisplayForm = p2Form.length > 0 ? p2Form : p2RecentForm;
  const formTitle = hasForm ? `${data.tournament || 'Tournament'} Form` : 'Recent Form';
  const hasAnyForm = p1DisplayForm.length > 0 || p2DisplayForm.length > 0;

  // Streaks and summaries
  const p1Streak = calcStreak(p1DisplayForm);
  const p2Streak = calcStreak(p2DisplayForm);
  const p1Summary = formSummary(p1DisplayForm);
  const p2Summary = formSummary(p2DisplayForm);

  // Surface stats for the header
  const currentSurface = data.surface || '';
  const surfaceKey = currentSurface.toLowerCase().includes('clay') ? 'clay'
    : currentSurface.toLowerCase().includes('grass') ? 'grass' : 'hard';

  // Try to get surface-specific W-L from surfaceStats
  const p1SurfaceStats = p1.surfaceStats?.[0]?.surfaces?.find(s => s.surface?.toLowerCase() === surfaceKey);
  const p2SurfaceStats = p2.surfaceStats?.[0]?.surfaces?.find(s => s.surface?.toLowerCase() === surfaceKey);
  const p1SurfaceWL = p1SurfaceStats ? `${p1SurfaceStats.wins}-${p1SurfaceStats.losses}` : null;
  const p2SurfaceWL = p2SurfaceStats ? `${p2SurfaceStats.wins}-${p2SurfaceStats.losses}` : null;

  return (
    <div className="mu-backdrop" onClick={handleBackdrop}>
      <div className="mu-modal">

        {/* ── Split-screen header ──────────────────────────────────── */}
        <div className="mu2-header">
          <div className="mu2-header-top">
            <span className="mu2-eyebrow">Matchup Info</span>
            <button className="mu2-close" onClick={onClose}>✕</button>
          </div>

          <div className="mu2-versus-strip">
            <div className="mu2-player-side">
              <div className="mu2-avatar-wrap">
                <PlayerAvatar playerId={player1Id} playerName={p1Name} size={64} />
              </div>
              <div className="mu2-player-name">{p1Unknown ? 'TBD' : shortName(p1Name)}</div>
              <div className="mu2-player-flag">
                {!p1Unknown && p1Flag && <>{p1Flag} {p1Country}</>}
                {p1Seed && <> {p1Seed}</>}
              </div>
              {p1SurfaceWL && (
                <>
                  <div className="mu2-player-record">{p1SurfaceWL}</div>
                  <div className="mu2-record-label">{surfaceKey} W-L</div>
                </>
              )}
              {!p1SurfaceWL && p1.profile?.rank && (
                <>
                  <div className="mu2-player-record">#{p1.profile.rank}</div>
                  <div className="mu2-record-label">Ranking</div>
                </>
              )}
            </div>

            {!hasOnlyOnePlayer && (
              <div className="mu2-vs-divider">
                <div className="mu2-vs-circle">
                  {h2h.available ? (
                    <span className="mu2-vs-h2h">{h2h.player1Wins}-{h2h.player2Wins}</span>
                  ) : (
                    'vs'
                  )}
                </div>
              </div>
            )}

            <div className="mu2-player-side">
              <div className="mu2-avatar-wrap">
                <PlayerAvatar playerId={player2Id} playerName={p2Name} size={64} />
              </div>
              <div className="mu2-player-name">{p2Unknown ? 'TBD' : shortName(p2Name)}</div>
              <div className="mu2-player-flag">
                {!p2Unknown && p2Flag && <>{p2Flag} {p2Country}</>}
                {p2Seed && <> {p2Seed}</>}
              </div>
              {p2SurfaceWL && (
                <>
                  <div className="mu2-player-record">{p2SurfaceWL}</div>
                  <div className="mu2-record-label">{surfaceKey} W-L</div>
                </>
              )}
              {!p2SurfaceWL && p2.profile?.rank && (
                <>
                  <div className="mu2-player-record">#{p2.profile.rank}</div>
                  <div className="mu2-record-label">Ranking</div>
                </>
              )}
            </div>
          </div>

          {currentSurface && (
            <div className="mu2-surface-bar">
              <span className={`mu2-surface-dot ${surfaceDotClass(currentSurface)}`} />
              {currentSurface}{data.tournament ? ` · ${data.tournament}` : ''}
            </div>
          )}
        </div>

        {/* ── Visual form blocks (last 5) ─────────────────────────── */}
        {hasAnyForm && (
          <div className="mu2-section">
            <div className="mu2-section-title">Last {Math.max(p1DisplayForm.length, p2DisplayForm.length)} Matches</div>
            <div className="mu2-form-blocks">
              {!p1Unknown && p1DisplayForm.length > 0 && (
                <div>
                  <div className="mu2-form-label">{shortName(p1Name)}</div>
                  <div className="mu2-form-dots">
                    {p1DisplayForm.slice(0, 5).map((r, i) => (
                      <span key={i} className={`mu2-dot ${r.won ? 'mu2-dot-w' : 'mu2-dot-l'}`}>
                        {r.won ? 'W' : 'L'}
                      </span>
                    ))}
                  </div>
                  {p1Summary && (
                    <div className="mu2-form-summary">
                      {p1Summary.wins}W - {p1Summary.losses}L · {p1Summary.label}
                    </div>
                  )}
                </div>
              )}
              {!p2Unknown && p2DisplayForm.length > 0 && (
                <div>
                  <div className="mu2-form-label">{shortName(p2Name)}</div>
                  <div className="mu2-form-dots">
                    {p2DisplayForm.slice(0, 5).map((r, i) => (
                      <span key={i} className={`mu2-dot ${r.won ? 'mu2-dot-w' : 'mu2-dot-l'}`}>
                        {r.won ? 'W' : 'L'}
                      </span>
                    ))}
                  </div>
                  {p2Summary && (
                    <div className="mu2-form-summary">
                      {p2Summary.wins}W - {p2Summary.losses}L · {p2Summary.label}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Detailed form ───────────────────────────────────────── */}
        {hasAnyForm && (
          <div className="mu2-section">
            <div className="mu2-section-title">{formTitle}</div>
            <div className={`mu2-form-cols${hasOnlyOnePlayer ? ' mu2-form-single' : ''}`}>
              {!p1Unknown && p1DisplayForm.length > 0 && (
                <div>
                  <div className="mu2-form-col-header">
                    {shortName(p1Name)}
                    {p1Streak && (
                      <span className={`mu2-streak ${p1Streak.type === 'W' ? 'mu2-streak--hot' : 'mu2-streak--cold'}`}>
                        {p1Streak.type}{p1Streak.count}
                      </span>
                    )}
                  </div>
                  {p1DisplayForm.map((r, i) => (
                    <div key={i} className="mu2-form-row">
                      <span className={`mu2-wl ${r.won ? 'mu2-wl-w' : 'mu2-wl-l'}`}>{r.won ? 'W' : 'L'}</span>
                      <div className="mu2-form-detail">
                        <span className="mu2-form-opp">vs {shortName(r.opponent)}</span>
                        <span className="mu2-form-event">
                          {ROUND_SHORT[r.round] || r.round || r.date || ''}
                          {r.status === 'retired' ? ' (ret.)' : r.status === 'walkover' ? ' (w/o)' : ''}
                        </span>
                      </div>
                      {r.score && <span className="mu2-form-score">{r.score}</span>}
                    </div>
                  ))}
                </div>
              )}
              {!p2Unknown && p2DisplayForm.length > 0 && (
                <div>
                  <div className="mu2-form-col-header">
                    {shortName(p2Name)}
                    {p2Streak && (
                      <span className={`mu2-streak ${p2Streak.type === 'W' ? 'mu2-streak--hot' : 'mu2-streak--cold'}`}>
                        {p2Streak.type}{p2Streak.count}
                      </span>
                    )}
                  </div>
                  {p2DisplayForm.map((r, i) => (
                    <div key={i} className="mu2-form-row">
                      <span className={`mu2-wl ${r.won ? 'mu2-wl-w' : 'mu2-wl-l'}`}>{r.won ? 'W' : 'L'}</span>
                      <div className="mu2-form-detail">
                        <span className="mu2-form-opp">vs {shortName(r.opponent)}</span>
                        <span className="mu2-form-event">
                          {ROUND_SHORT[r.round] || r.round || r.date || ''}
                          {r.status === 'retired' ? ' (ret.)' : r.status === 'walkover' ? ' (w/o)' : ''}
                        </span>
                      </div>
                      {r.score && <span className="mu2-form-score">{r.score}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* No form at all */}
        {!hasAnyForm && (
          <div className="mu2-section">
            <div className="mu-empty">
              No prior match history available for these players.
            </div>
          </div>
        )}

        {/* ── Season stats ────────────────────────────────────────── */}
        {(p1SurfaceWL || p2SurfaceWL || p1.profile || p2.profile) && (
          <div className="mu2-section">
            <div className="mu2-section-title">{p1.surfaceStats?.[0]?.year || '2025/26'} Season</div>
            <div className="mu2-stats-grid">
              {(p1SurfaceWL || p2SurfaceWL) && (
                <div className="mu2-stat-card">
                  <div className="mu2-stat-label">{surfaceKey} Record</div>
                  <div className="mu2-stat-values">
                    <div>
                      <div className="mu2-stat-val">{p1SurfaceWL || '—'}</div>
                      <div className="mu2-stat-who">{shortName(p1Name)}</div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <div className="mu2-stat-val">{p2SurfaceWL || '—'}</div>
                      <div className="mu2-stat-who">{shortName(p2Name)}</div>
                    </div>
                  </div>
                </div>
              )}
              {(p1.profile?.rank || p2.profile?.rank) && (
                <div className="mu2-stat-card">
                  <div className="mu2-stat-label">Ranking</div>
                  <div className="mu2-stat-values">
                    <div>
                      <div className="mu2-stat-val">{p1.profile?.rank ? `#${p1.profile.rank}` : '—'}</div>
                      <div className="mu2-stat-who">{shortName(p1Name)}</div>
                    </div>
                    <div style={{textAlign: 'right'}}>
                      <div className="mu2-stat-val">{p2.profile?.rank ? `#${p2.profile.rank}` : '—'}</div>
                      <div className="mu2-stat-who">{shortName(p2Name)}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── H2H ─────────────────────────────────────────────────── */}
        {!hasOnlyOnePlayer && (
          <div className="mu2-section">
            <div className="mu2-section-title">Head to Head</div>
            {h2h.available ? (
              <>
                {h2h.bySurface && h2h.bySurface.length > 0 && (
                  <div className="mu2-h2h-surfaces">
                    {h2h.bySurface.map((s, i) => (
                      <div key={i} className="mu2-h2h-surface-row">
                        <span className="mu2-h2h-surface-name">{s.surface}</span>
                        <div className="mu2-h2h-bar">
                          <div className="mu2-h2h-bar-p1" style={{ flex: s.player1Wins || 0 }}>
                            {s.player1Wins > 0 && s.player1Wins}
                          </div>
                          <div className="mu2-h2h-bar-p2" style={{ flex: s.player2Wins || 0 }}>
                            {s.player2Wins > 0 && s.player2Wins}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {h2h.meetings && h2h.meetings.length > 0 && (
                  <div className="mu2-h2h-meetings">
                    <div className="mu2-section-title" style={{marginTop: 12}}>Recent Meetings</div>
                    {h2h.meetings.map((m, i) => (
                      <div key={i} className="mu2-form-row">
                        <span className="mu2-h2h-date">{m.date || '?'}</span>
                        <div className="mu2-form-detail">
                          <span className="mu2-form-opp">
                            <strong>{m.winnerName || '?'}</strong> d. {m.winnerName === m.player1 ? m.player2 : m.player1}
                          </span>
                        </div>
                        {m.score && <span className="mu2-form-score">{m.score}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mu-empty" style={{padding: '16px 0'}}>
                No previous meetings on record
              </div>
            )}
          </div>
        )}

        <div className="mu2-footer">
          Data from {data.tournament || 'tournament draw'}
          {h2h.available && ' & Matchstat'}
        </div>
      </div>
    </div>
  );
}
