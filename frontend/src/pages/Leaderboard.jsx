import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Hero } from '../ui/Hero.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Stat } from '../ui/Stat.jsx';
import { Button } from '../ui/Button.jsx';
import { PageSkeleton } from '../ui/Skeleton.jsx';
import { ROUND_FULL as ROUND_LABELS } from '../data/roundLabels';
import { useFocusTrap } from '../hooks/useFocusTrap';
import './Leaderboard.css';

// ── Formatting helpers ────────────────────────────────────────
function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function initials(name) {
  return (name || '?')
    .split(' ')
    .map((w) => w[0] || '')
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLOURS = [
  '#0F4A23', '#1E7A3E', '#C1572E', '#A84620',
  '#1F5580', '#7C3AED', '#B67300', '#0891B2',
];

function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

// ── Pick History Modal ────────────────────────────────────────
function PickHistoryModal({ member, groupId, currentRound, onClose }) {
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
  const visiblePicks = (picks || []).filter(p => !currentRound || p.round !== currentRound);

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
        <header className="ds-modal-header lb-picks-modal-header">
          <div className="lb-picks-modal-identity">
            <span
              className="lb-avatar lb-avatar--lg"
              style={{ background: colour }}
            >
              {ini}
            </span>
            <div>
              <span className="ds-modal-eyebrow">PICK HISTORY</span>
              <h3 id="pick-history-modal-title" className="ds-modal-title">{member.displayName}</h3>
              <p className="lb-picks-modal-sub">
                {member.isAlive
                  ? `Still in · ${member.survivedRounds ?? 0} round${(member.survivedRounds ?? 0) === 1 ? '' : 's'} survived`
                  : `Eliminated in ${ROUND_LABELS[member.eliminatedRound] || member.eliminatedRound || '—'}`}
              </p>
            </div>
          </div>
          <button className="ds-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ds-modal-body">
          {picks === null && <p className="lb-picks-loading">Loading picks…</p>}
          {error && <p className="ds-form-error">Could not load picks.</p>}
          {picks !== null && !error && visiblePicks.length === 0 && (
            <p className="lb-picks-empty">No picks submitted yet.</p>
          )}

          {visiblePicks.length > 0 && (
            <div className="lb-picks-table-wrap">
              <table className="lb-picks-table">
                <thead>
                  <tr>
                    <th>Round</th>
                    <th>Player picked</th>
                    <th className="lb-picks-table__result">Result</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePicks.map((p) => (
                    <tr key={p.id || p.round} className={p.survived === false ? 'lb-pick-row-out' : ''}>
                      <td className="lb-pick-round">{ROUND_LABELS[p.round] || p.round}</td>
                      <td className="lb-pick-player">{p.playerName || '—'}</td>
                      <td className="lb-pick-result">
                        {p.survived === true  && <Badge tone="success" size="sm" dot>Advanced</Badge>}
                        {p.survived === false && <Badge tone="danger" size="sm" dot>Eliminated</Badge>}
                        {p.survived == null   && <Badge tone="neutral" size="sm">Result pending</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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

  const { group, leaderboard, aliveCount, currentRound, roundIsLocked } = data;
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

        <p className="lb-click-hint">Click any player to see their pick history.</p>

        <div className="lb-table-wrap">
          <table className="lb-table">
            <thead>
              <tr>
                <th>Player</th>
                <th className="lb-th-status">Status</th>
                <th className="lb-th-progress">Progress</th>
                {currentRound && <th className="lb-th-pick">{currentRound} pick</th>}
              </tr>
            </thead>
            <tbody>
              {leaderboard.length === 0 && (
                <tr>
                  <td colSpan={currentRound ? 4 : 3} className="lb-empty-row">
                    No entries yet — be the first to join!
                  </td>
                </tr>
              )}
              {leaderboard.map((m) => {
                const isYou    = m.userId === userId;
                const survived = m.survivedRounds ?? 0;
                const rowClass = [
                  'lb-row',
                  isYou ? 'lb-row--you' : '',
                  m.isWinner ? 'lb-row--winner' : m.isAlive ? 'lb-row--alive' : 'lb-row--out',
                ].filter(Boolean).join(' ');

                const handleRowKeyDown = (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedMember(m);
                  }
                };

                return (
                  <tr
                    key={m.id}
                    className={rowClass}
                    onClick={() => setSelectedMember(m)}
                    onKeyDown={handleRowKeyDown}
                    tabIndex={0}
                    role="button"
                    aria-label={`View pick history for ${m.displayName}`}
                    title="Click to view picks"
                  >
                    <td className="lb-td-player">
                      <span
                        className="lb-avatar"
                        style={{ background: avatarColour(m.displayName) }}
                      >
                        {initials(m.displayName)}
                      </span>
                      <span className="lb-display-name">
                        {m.displayName}
                      </span>
                      {isYou && <Badge tone="primary" size="sm">You</Badge>}
                      {m.isWinner && <span className="lb-winner-tag" aria-hidden="true">🏆</span>}
                    </td>
                    <td className="lb-td-status">
                      {m.isWinner ? (
                        <Badge tone="gold" size="sm" dot>Winner</Badge>
                      ) : m.isAlive ? (
                        <Badge tone="success" size="sm" dot>Alive</Badge>
                      ) : (
                        <Badge tone="danger" size="sm">Eliminated</Badge>
                      )}
                    </td>
                    <td className="lb-td-progress">
                      {m.isWinner ? (
                        <span className="lb-progress-value">
                          {survived} {survived === 1 ? 'round' : 'rounds'} survived
                        </span>
                      ) : m.isAlive ? (
                        survived === 0 ? (
                          <span className="lb-progress-muted">No results yet</span>
                        ) : (
                          <span className="lb-progress-value">
                            {survived} {survived === 1 ? 'round' : 'rounds'} survived
                          </span>
                        )
                      ) : (
                        <span className="lb-progress-out">
                          Out in {ROUND_LABELS[m.eliminatedRound] || m.eliminatedRound || '—'}
                          {survived > 0 && (
                            <span className="lb-progress-sub"> · {survived} {survived === 1 ? 'round' : 'rounds'}</span>
                          )}
                        </span>
                      )}
                    </td>
                    {currentRound && (
                      <td className="lb-td-pick">
                        {roundIsLocked ? (
                          m.currentRoundPick ? (
                            <span className={m.isAlive ? 'lb-pick-live' : 'lb-pick-dead'}>
                              {m.currentRoundPick}
                            </span>
                          ) : (
                            <span className="lb-pick-none">—</span>
                          )
                        ) : (
                          <span className="lb-pick-hidden">
                            <span aria-hidden="true">🔒</span> Hidden
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Section>

      {selectedMember && (
        <PickHistoryModal
          member={selectedMember}
          groupId={groupId}
          currentRound={currentRound}
          onClose={() => setSelectedMember(null)}
        />
      )}
    </div>
  );
}
