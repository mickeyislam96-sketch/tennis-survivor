import { useState, useEffect, useCallback } from 'react';
import { API } from '../App';
import PlayerAvatar from '../ui/PlayerAvatar';
import { ROUND_SHORT } from '../data/roundLabels';
import './MatchupModal.css';

// ── Helpers ─────────────────────────────────────────────────────────────────

function isUnknownPlayer(name) {
  if (!name) return true;
  return ['Qualifier', 'TBD', 'BYE'].includes(name);
}

function surname(name) {
  if (!name) return '';
  return name.split(' ').pop();
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

// Country code to flag emoji
function countryFlag(code) {
  if (!code || code.length < 2) return '';
  const cc = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

// ── Tab definitions ────────────────────────────────────────────────────────

const TABS = [
  { key: 'form', label: 'Form' },
  { key: 'h2h', label: 'H2H' },
  { key: 'profile', label: 'Profile' },
];

// ── Component ───────────────────────────────────────────────────────────────

export function MatchupModal({ player1Id, player2Id, player1Name, player2Name, onClose }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [activeTab, setActiveTab] = useState('form');

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
          <div className="mu-header">
            <h2>Matchup Info</h2>
            <button className="mu-close" onClick={onClose}>&times;</button>
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
  const p1Seed = seedLabel(p1.seed);
  const p2Seed = seedLabel(p2.seed);
  const p1Flag = countryFlag(p1.country);
  const p2Flag = countryFlag(p2.country);

  const p1Form = p1.tournamentForm || [];
  const p2Form = p2.tournamentForm || [];
  const p1RecentForm = p1.recentForm || [];
  const p2RecentForm = p2.recentForm || [];
  const hasForm = p1Form.length > 0 || p2Form.length > 0;

  // Determine which tabs have content
  const tabsWithContent = TABS.filter(t => {
    if (t.key === 'form') return true; // always show
    if (t.key === 'h2h') return h2h.available || !hasOnlyOnePlayer;
    if (t.key === 'profile') return p1.profile || p2.profile;
    return true;
  });

  return (
    <div className="mu-backdrop" onClick={handleBackdrop}>
      <div className="mu-modal">

        {/* Header */}
        <div className="mu-header">
          <h2>Matchup Info</h2>
          <button className="mu-close" onClick={onClose}>&times;</button>
        </div>

        {/* Player cards */}
        <div className="mu-h2h-bar">
          <div className="mu-player">
            <PlayerAvatar playerId={player1Id} playerName={p1Name} size={56} />
            <div className="mu-player-name">{p1Name}</div>
            <div className="mu-player-meta">
              {p1Unknown ? 'TBC' : (
                <>
                  {p1Flag && <span className="mu-flag">{p1Flag}</span>}
                  {p1.country && <span>{p1.country}</span>}
                  {p1Seed && <span className="mu-seed">{p1Seed}</span>}
                </>
              )}
            </div>
            {p1.profile?.rank && (
              <div className="mu-player-rank">#{p1.profile.rank}</div>
            )}
          </div>

          {!hasOnlyOnePlayer ? (
            <div className="mu-vs">
              {h2h.available ? (
                <div className="mu-h2h-score">
                  <span className={h2h.player1Wins > h2h.player2Wins ? 'mu-h2h-lead' : ''}>{h2h.player1Wins}</span>
                  <span className="mu-h2h-dash">-</span>
                  <span className={h2h.player2Wins > h2h.player1Wins ? 'mu-h2h-lead' : ''}>{h2h.player2Wins}</span>
                </div>
              ) : (
                <div className="mu-vs-label">vs</div>
              )}
              {data.surface && <div className="mu-surface">{data.surface}</div>}
            </div>
          ) : (
            <div className="mu-vs">
              <div className="mu-vs-label">Player Info</div>
            </div>
          )}

          <div className="mu-player">
            <PlayerAvatar playerId={player2Id} playerName={p2Name} size={56} />
            <div className="mu-player-name">{p2Name}</div>
            <div className="mu-player-meta">
              {p2Unknown ? 'TBC' : (
                <>
                  {p2Flag && <span className="mu-flag">{p2Flag}</span>}
                  {p2.country && <span>{p2.country}</span>}
                  {p2Seed && <span className="mu-seed">{p2Seed}</span>}
                </>
              )}
            </div>
            {p2.profile?.rank && (
              <div className="mu-player-rank">#{p2.profile.rank}</div>
            )}
          </div>
        </div>

        {/* Tab bar */}
        {tabsWithContent.length > 1 && (
          <div className="mu-tabs">
            {tabsWithContent.map(t => (
              <button
                key={t.key}
                className={`mu-tab ${activeTab === t.key ? 'mu-tab-active' : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* ── Form tab ───────────────────────────────────────────────────── */}
        {activeTab === 'form' && (
          <>
            {/* Tournament form */}
            {hasForm && (
              <div className="mu-section">
                <div className="mu-section-title">{data.tournament || 'Tournament'} Form</div>
                <div className={`mu-form-cols${hasOnlyOnePlayer ? ' mu-form-single' : ''}`}>
                  {!p1Unknown && p1Form.length > 0 && (
                    <div>
                      <div className="mu-form-header">{surname(p1Name)}</div>
                      {p1Form.map((r, i) => (
                        <div key={i} className="mu-form-row">
                          <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                          <div className="mu-form-detail">
                            <div className="mu-form-opp">vs {r.opponent}</div>
                            <div className="mu-form-event">{ROUND_SHORT[r.round] || r.round}{r.status === 'retired' ? ' (ret.)' : r.status === 'walkover' ? ' (w/o)' : ''}</div>
                          </div>
                          {r.score && <div className="mu-form-score">{r.score}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!p2Unknown && p2Form.length > 0 && (
                    <div>
                      <div className="mu-form-header">{surname(p2Name)}</div>
                      {p2Form.map((r, i) => (
                        <div key={i} className="mu-form-row">
                          <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                          <div className="mu-form-detail">
                            <div className="mu-form-opp">vs {r.opponent}</div>
                            <div className="mu-form-event">{ROUND_SHORT[r.round] || r.round}{r.status === 'retired' ? ' (ret.)' : r.status === 'walkover' ? ' (w/o)' : ''}</div>
                          </div>
                          {r.score && <div className="mu-form-score">{r.score}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Recent form (from Matchstat) when no tournament form yet */}
            {!hasForm && (p1RecentForm.length > 0 || p2RecentForm.length > 0) && (
              <div className="mu-section">
                <div className="mu-section-title">Recent Form</div>
                <div className={`mu-form-cols${hasOnlyOnePlayer ? ' mu-form-single' : ''}`}>
                  {!p1Unknown && p1RecentForm.length > 0 && (
                    <div>
                      <div className="mu-form-header">{surname(p1Name)}</div>
                      {p1RecentForm.map((r, i) => (
                        <div key={i} className="mu-form-row">
                          <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                          <div className="mu-form-detail">
                            <div className="mu-form-opp">vs {r.opponent}</div>
                            {r.date && <div className="mu-form-event">{r.date}</div>}
                          </div>
                          {r.score && <div className="mu-form-score">{r.score}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                  {!p2Unknown && p2RecentForm.length > 0 && (
                    <div>
                      <div className="mu-form-header">{surname(p2Name)}</div>
                      {p2RecentForm.map((r, i) => (
                        <div key={i} className="mu-form-row">
                          <span className={`mu-wl ${r.won ? 'mu-w' : 'mu-l'}`}>{r.won ? 'W' : 'L'}</span>
                          <div className="mu-form-detail">
                            <div className="mu-form-opp">vs {r.opponent}</div>
                            {r.date && <div className="mu-form-event">{r.date}</div>}
                          </div>
                          {r.score && <div className="mu-form-score">{r.score}</div>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* No form at all */}
            {!hasForm && p1RecentForm.length === 0 && p2RecentForm.length === 0 && (
              <div className="mu-section">
                <div className="mu-empty">
                  No match results yet. Form will appear here as matches are played.
                </div>
              </div>
            )}
          </>
        )}

        {/* ── H2H tab ────────────────────────────────────────────────────── */}
        {activeTab === 'h2h' && (
          <div className="mu-section">
            {h2h.available ? (
              <>
                {/* Surface breakdown */}
                {h2h.bySurface && h2h.bySurface.length > 0 && (
                  <div className="mu-h2h-surfaces">
                    <div className="mu-section-title">H2H by Surface</div>
                    {h2h.bySurface.map((s, i) => (
                      <div key={i} className="mu-h2h-surface-row">
                        <span className="mu-h2h-surface-name">{s.surface}</span>
                        <div className="mu-h2h-surface-bar">
                          <div
                            className="mu-h2h-bar-fill mu-h2h-bar-p1"
                            style={{ flex: s.player1Wins || 0 }}
                          >
                            {s.player1Wins > 0 && s.player1Wins}
                          </div>
                          <div
                            className="mu-h2h-bar-fill mu-h2h-bar-p2"
                            style={{ flex: s.player2Wins || 0 }}
                          >
                            {s.player2Wins > 0 && s.player2Wins}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Recent meetings */}
                {h2h.meetings && h2h.meetings.length > 0 && (
                  <div className="mu-h2h-meetings">
                    <div className="mu-section-title">Recent Meetings</div>
                    {h2h.meetings.map((m, i) => (
                      <div key={i} className="mu-form-row">
                        <span className="mu-h2h-date">{m.date || '?'}</span>
                        <div className="mu-form-detail">
                          <div className="mu-form-opp">
                            <strong>{m.winnerName || '?'}</strong> d. {m.winnerName === m.player1 ? m.player2 : m.player1}
                          </div>
                        </div>
                        {m.score && <div className="mu-form-score">{m.score}</div>}
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="mu-empty">
                No head-to-head record available for these players.
              </div>
            )}
          </div>
        )}

        {/* ── Profile tab ────────────────────────────────────────────────── */}
        {activeTab === 'profile' && (
          <div className="mu-section">
            <div className={`mu-form-cols${hasOnlyOnePlayer ? ' mu-form-single' : ''}`}>
              {!p1Unknown && p1.profile && (
                <ProfileCard player={p1} name={p1Name} surfaceStats={p1.surfaceStats} />
              )}
              {!p2Unknown && p2.profile && (
                <ProfileCard player={p2} name={p2Name} surfaceStats={p2.surfaceStats} />
              )}
            </div>
            {!p1.profile && !p2.profile && (
              <div className="mu-empty">Player profiles not available.</div>
            )}
          </div>
        )}

        <div className="mu-footer">
          Data from {data.tournament || 'tournament draw'}
          {h2h.available && ' & Matchstat'}
        </div>
      </div>
    </div>
  );
}

// ── Profile card sub-component ──────────────────────────────────────────────

function ProfileCard({ player, name, surfaceStats }) {
  const prof = player.profile;
  if (!prof) return null;

  const details = [
    prof.rank && { label: 'Rank', value: `#${prof.rank}` },
    prof.height && { label: 'Height', value: prof.height },
    prof.plays && { label: 'Plays', value: prof.plays },
    prof.coach && { label: 'Coach', value: prof.coach },
    prof.turnedPro && { label: 'Turned Pro', value: prof.turnedPro },
    prof.birthplace && { label: 'From', value: prof.birthplace },
  ].filter(Boolean);

  // Current year surface stats
  const currentYearSurface = surfaceStats?.[0]?.surfaces || [];

  return (
    <div className="mu-profile-card">
      <div className="mu-form-header">{surname(name)}</div>
      {details.map((d, i) => (
        <div key={i} className="mu-profile-row">
          <span className="mu-profile-label">{d.label}</span>
          <span className="mu-profile-value">{d.value}</span>
        </div>
      ))}
      {currentYearSurface.length > 0 && (
        <div className="mu-profile-surface">
          <div className="mu-profile-surface-title">{surfaceStats[0].year} by Surface</div>
          {currentYearSurface.map((s, i) => (
            <div key={i} className="mu-profile-row">
              <span className="mu-profile-label">{s.surface}</span>
              <span className="mu-profile-value">{s.wins}W-{s.losses}L</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
