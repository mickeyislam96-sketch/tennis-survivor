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

// Country code → flag emoji
function countryFlag(code) {
  if (!code || code.length < 2) return '';
  const cc = code.toUpperCase().slice(0, 2);
  return String.fromCodePoint(...[...cc].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
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

    // Need at least one real player
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
            <p>Loading matchup data…</p>
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
  const hasForm = p1Form.length > 0 || p2Form.length > 0;

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
          </div>

          {!hasOnlyOnePlayer ? (
            <div className="mu-vs">
              <div className="mu-vs-label">vs</div>
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
          </div>
        </div>

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

        {/* No form yet — pre-tournament */}
        {!hasForm && (
          <div className="mu-section">
            <div className="mu-empty">
              No match results yet. Tournament form will appear here as matches are played.
            </div>
          </div>
        )}

        {/* H2H placeholder */}
        {!hasOnlyOnePlayer && (
          <div className="mu-section">
            <div className="mu-h2h-notice">
              Head-to-head record and career stats coming soon.
            </div>
          </div>
        )}

        <div className="mu-footer">
          Data from {data.tournament || 'tournament draw'}
        </div>
      </div>
    </div>
  );
}
