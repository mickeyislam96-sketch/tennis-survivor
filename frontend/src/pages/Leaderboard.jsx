import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Hero } from '../ui/Hero.jsx';
import { Stat } from '../ui/Stat.jsx';
import { Button } from '../ui/Button.jsx';
import { PageSkeleton } from '../ui/Skeleton.jsx';
import { ROUND_FULL as ROUND_LABELS } from '../data/roundLabels';
import { useFocusTrap } from '../hooks/useFocusTrap';
import PlayerAvatar from '../ui/PlayerAvatar';
import { avatarColour, initials } from '../utils/playerImage';
import './Leaderboard.css';

// ── Formatting helpers ────────────────────────────────────────
function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

// ── Pick History Modal (Timeline design) ─────────────────────
function PickHistoryModal({ member, groupId, openRound, onClose }) {
  const [picks, setPicks] = useState(null);
  const [error, setError] = useState(false);
  const trapRef = useFocusTrap(true);

  useEffect(() => {
    fetch(`${API}/picks/history?userId=${member.userId}&groupId=${groupId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setPicks)
      .catch(() => { setError(true); setPicks([]); });
  }, [member.userId, groupId]);

  const colour = avatarColour(member.displayName);
  const ini    = initials(member.displayName);
  const survived = (picks || []).filter(p => p.survived === true).length;
  // Hide picks for any round whose window is still open (not yet locked)
  const visiblePicks = (picks || []).filter(p => !openRound || p.round !== openRound);

  const handleBackdropKeyDown = (e) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="ds-modal-backdrop"
      onClick={onClose}
      onKeyDown={handleBackdropKeyDown}
      role="presentation"
    >
      <div
        ref={trapRef}
        className="ds-modal-card lb-picks-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pick-history-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Green gradient header */}
        <header className="ph-tl-header">
          <div className="ph-tl-header-top">
            <span
              className="lb-avatar lb-avatar--lg"
              style={{ background: 'rgba(255,255,255,0.15)', border: '2px solid rgba(255,255,255,0.25)' }}
            >
              {ini}
            </span>
            <button className="ph-tl-close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <h3 id="pick-history-modal-title" className="ph-tl-name">{member.displayName}</h3>
          <p className="ph-tl-subtitle">
            {member.isAlive
              ? `Still in · ${member.survivedRounds ?? 0} round${(member.survivedRounds ?? 0) === 1 ? '' : 's'} survived`
              : `Eliminated in ${ROUND_LABELS[member.eliminatedRound] || member.eliminatedRound || '—'}`}
          </p>
          <div className="ph-tl-stat-row">
            {member.isAlive ? (
              <span className="ph-tl-pill"><span className="ph-tl-dot ph-tl-dot--alive" /> Still in</span>
            ) : (
              <span className="ph-tl-pill"><span className="ph-tl-dot ph-tl-dot--out" /> Eliminated</span>
            )}
            <span className="ph-tl-pill">{survived} round{survived !== 1 ? 's' : ''} survived</span>
          </div>
        </header>

        {/* Timeline body */}
        <div className="ph-tl-body">
          {picks === null && <p className="lb-picks-loading">Loading picks…</p>}
          {error && <p className="ds-form-error">Could not load picks.</p>}
          {picks !== null && !error && visiblePicks.length === 0 && (
            <p className="lb-picks-empty">No picks submitted yet.</p>
          )}

          {visiblePicks.length > 0 && (
            <div className="ph-tl-timeline">
              {visiblePicks.map((p, idx) => {
                const state = p.survived === null ? 'pending' : p.survived ? 'survived' : 'eliminated';
                const isLast = idx === visiblePicks.length - 1;
                return (
                  <div key={p.id || p.round} className={`ph-tl-step${isLast ? ' ph-tl-step--last' : ''}`}>
                    {/* Marker */}
                    <div className={`ph-tl-marker ph-tl-marker--${state}`}>
                      {state === 'survived' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      )}
                      {state === 'eliminated' && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      )}
                      {state === 'pending' && <span className="ph-tl-marker-q">?</span>}
                    </div>
                    {/* Content */}
                    <div className="ph-tl-content">
                      <div className="ph-tl-round-label">{ROUND_LABELS[p.round] || p.round}</div>
                      <div className={`ph-tl-card ph-tl-card--${state}`}>
                        <div className="ph-tl-card-left">
                          <PlayerAvatar playerName={p.playerName} size={36} />
                          <div className="ph-tl-card-info">
                            <span className="ph-tl-player-name">{p.playerName || '—'}</span>
                          </div>
                        </div>
                        <span className={`ph-tl-tag ph-tl-tag--${state}`}>
                          {state === 'survived' && 'Survived'}
                          {state === 'eliminated' && 'Eliminated'}
                          {state === 'pending' && 'Pending'}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Leaderboard component ────────────────────────────────
export function Leaderboard() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [data, setData] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/leaderboard/${groupId}`)
      .then((r) => {
        if (!r.ok) throw new Error('API error');
        return r.json();
      })
      .then((json) => {
        setData({
          group: json.group || null,
          leaderboard: Array.isArray(json.leaderboard) ? json.leaderboard : [],
          aliveCount: json.aliveCount ?? 0,
          currentRound: json.currentRound ?? null,
          roundIsLocked: json.roundIsLocked ?? false,
          openRound: json.openRound ?? null,
        });
      })
      .catch(() => setData({ group: null, leaderboard: [], aliveCount: 0, currentRound: null }));
  }, [groupId]);

  if (!data) {
    return (
      <Section tone="canvas" size="lg">
        <PageSkeleton />
      </Section>
    );
  }

  const { group, leaderboard, aliveCount, currentRound, roundIsLocked, openRound } = data;
  const totalEntrants = leaderboard.length;
  const eliminated    = totalEntrants - aliveCount;
  const winners       = leaderboard.filter((m) => m.isWinner);
  const winner        = winners.length > 0 ? winners[0] : null;
  const prizePool     = group?.prizePoolCents || 0;

  return (
    <div className="lb-page">
      <Hero
        tone={winner ? 'gold' : 'primary'}
        compact
        showCourt
        eyebrow={winner ? 'TOURNAMENT COMPLETE' : 'LEADERBOARD'}
        title={winner ? (
          <>Winner: <em>{winner.displayName}</em></>
        ) : (
          <>{group?.name}</>
        )}
        lede={winner
          ? `${winner.isAlive ? 'Last one standing' : 'Lasted the longest'} from ${totalEntrants} entrants.`
          : `${group?.name || 'Pool'} — updated live as results come in.`}
        meta={
          <>
            <Stat size="sm" tone="gold" label="Prize pool" value={fmtGBP(prizePool)} />
            <Stat
              size="sm"
              label={winner ? (winners.length === 1 ? 'Winner' : 'Winners') : 'Still in'}
              value={winner ? winners.length : aliveCount}
            />
            <Stat size="sm" label="Eliminated" value={winner ? totalEntrants - winners.length : eliminated} />
            <Stat size="sm" label="Total entrants" value={totalEntrants} />
          </>
        }
      />

      <Section tone="canvas" size="md">
        <div className="lb-top-row">
          <SectionHeader
            eyebrow={currentRound ? `CURRENT ROUND · ${ROUND_LABELS[currentRound] || currentRound}` : 'STANDINGS'}
            title={<>Who's <em>still in</em>.</>}
          />
          <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
            ← Back to pool
          </Button>
        </div>

        <p className="lb-click-hint">Tap any player to see their pick history.</p>

        {/* Survivometer */}
        {totalEntrants > 0 && (
          <div className="lb-survivometer">
            <div className="lb-survivometer-header">
              <span className="lb-survivometer-label">Survivometer</span>
              <span className="lb-survivometer-stat">
                {eliminated} / {totalEntrants} eliminated
              </span>
            </div>
            <div className="lb-survivometer-track">
              <div
                className="lb-survivometer-fill"
                style={{ width: `${Math.round((eliminated / totalEntrants) * 100)}%` }}
              />
            </div>
            <div className="lb-survivometer-footer">
              <span className="lb-survivometer-pct">
                {Math.round((eliminated / totalEntrants) * 100)}%
              </span>
              <span className="lb-survivometer-alive">
                {aliveCount} still standing
              </span>
            </div>
          </div>
        )}

        {leaderboard.length === 0 ? (
          <div className="lb-empty-card">
            No entries yet — be the first to join!
          </div>
        ) : (
          <div className="lb-card-list">
            {leaderboard.map((m, idx) => {
              const isYou    = m.userId === userId;
              const survived = m.survivedRounds ?? 0;
              const cardClass = [
                'lb-card',
                isYou ? 'lb-card--you' : '',
                m.isWinner ? 'lb-card--winner' : !m.isAlive ? 'lb-card--out' : '',
              ].filter(Boolean).join(' ');

              const handleCardKeyDown = (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedMember(m);
                }
              };

              // Meta line
              let metaText;
              if (m.isWinner) {
                metaText = `${survived} round${survived !== 1 ? 's' : ''} survived`;
              } else if (m.isAlive) {
                metaText = survived === 0
                  ? 'No results yet'
                  : `${survived} round${survived !== 1 ? 's' : ''} survived`;
              } else {
                const outLabel = ROUND_LABELS[m.eliminatedRound] || m.eliminatedRound || '—';
                metaText = survived > 0
                  ? `${survived} round${survived !== 1 ? 's' : ''} · Out in ${outLabel}`
                  : `Out in ${outLabel}`;
              }

              return (
                <div
                  key={m.id}
                  className={cardClass}
                  onClick={() => setSelectedMember(m)}
                  onKeyDown={handleCardKeyDown}
                  tabIndex={0}
                  role="button"
                  aria-label={`View pick history for ${m.displayName}`}
                >
                  <span className="lb-card-rank">{idx + 1}</span>
                  <span
                    className="lb-card-avatar"
                    style={{ background: avatarColour(m.displayName) }}
                  >
                    {initials(m.displayName)}
                  </span>
                  <div className="lb-card-info">
                    <div className="lb-card-name">
                      <span className="lb-card-name-text">{m.displayName}</span>
                      {isYou && <span className="lb-card-you-tag">You</span>}
                      {m.isWinner && <span className="lb-card-winner-tag" aria-hidden="true">🏆</span>}
                    </div>
                    <div className="lb-card-meta">
                      <span className="rounds-survived">{metaText}</span>
                    </div>
                  </div>
                  <div className="lb-card-right">
                    {m.isWinner ? (
                      <span className="lb-card-status lb-card-status--winner">Winner</span>
                    ) : m.isAlive ? (
                      <span className="lb-card-status lb-card-status--alive">
                        <span className="status-dot" /> Alive
                      </span>
                    ) : (
                      <span className="lb-card-status lb-card-status--out">Eliminated</span>
                    )}
                    {currentRound && roundIsLocked && m.currentRoundPick && (
                      <span className={`lb-card-pick${!m.isAlive ? ' lb-card-pick--dead' : ''}`}>
                        {currentRound}: <strong>{m.currentRoundPick}</strong>
                      </span>
                    )}
                    {currentRound && !roundIsLocked && (
                      <span className="lb-card-pick lb-card-pick--hidden">
                        🔒 Hidden
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      {selectedMember && (
        <PickHistoryModal
          member={selectedMember}
          groupId={groupId}
          openRound={openRound}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
