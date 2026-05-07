import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTournament } from '../data/tournaments';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { ROUND_FULL as ROUND_LABELS } from '../data/roundLabels';
import PlayerAvatar from '../ui/PlayerAvatar';
import './PickScreen.css';

// ── Helpers ────────────────────────────────────────────────────
function formatWindowTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' at '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function formatMatchTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
    + ', ' + d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}

function getMatchStartHint(isoString) {
  if (!isoString) return null;
  const matchTime = new Date(isoString);
  const now = new Date();
  const msUntilStart = matchTime.getTime() - now.getTime();
  const hoursUntilStart = msUntilStart / (1000 * 60 * 60);

  if (hoursUntilStart < 0) return null; // Match already started or passed
  if (hoursUntilStart <= 2) return 'urgent'; // Red badge for within 2 hours
  if (hoursUntilStart <= 6) return 'today'; // Amber badge for within 6 hours
  return null;
}

function Countdown({ to, className = 'ps-countdown-value', onExpire }) {
  const [left, setLeft] = useState('');

  useEffect(() => {
    const end = new Date(to);
    const tick = () => {
      const now = new Date();
      if (now >= end) {
        setLeft('—');
        clearInterval(id);
        if (onExpire) onExpire();
        return;
      }
      const ms = end - now;
      const d  = Math.floor(ms / 86400000);
      const h  = Math.floor((ms % 86400000) / 3600000);
      const m  = Math.floor((ms % 3600000)  / 60000);
      const s  = Math.floor((ms % 60000)    / 1000);
      setLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={className}>{left}</span>;
}

// ── Main component ─────────────────────────────────────────────
export function PickScreen() {
  const { groupId } = useParams();
  const { userId, authFetch } = useAuth();
  const [available, setAvailable]     = useState([]);
  const [rounds, setRounds]           = useState([]);
  const [currentRound, setCurrentRound] = useState('R1');
  const [pickMatchDetail]             = useState(null); // TODO: wire up match detail for locked pick card
  const [deadline, setDeadline]       = useState(null);
  const [opensAt, setOpensAt]         = useState(null);
  const [deadlines, setDeadlines]     = useState([]);
  const [search, setSearch]           = useState('');
  const [submitting, setSubmitting]   = useState(false);
  const [message, setMessage]         = useState('');
  const [myPickThisRound, setMyPickThisRound] = useState(null);
  const [member, setMember]           = useState(null);
  const [rowError, setRowError]       = useState({ id: null, msg: '' });
  const [drawAvailable, setDrawAvailable] = useState(true);
  const [tournamentCompleted, setTournamentCompleted] = useState(false);
  const [allPicks, setAllPicks]       = useState([]);
  const [isPerMatchLock, setIsPerMatchLock] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${API}/draw/rounds`, { signal: controller.signal })
      .then((r) => r.json())
      .then(setRounds)
      .catch((e) => { if (e.name !== 'AbortError') setRounds([]); });
    return () => controller.abort();
  }, []);

  const fetchDeadlines = () => {
    const controller = new AbortController();
    fetch(`${API}/draw/deadlines`, { signal: controller.signal })
      .then((r) => r.json())
      .then((list) => setDeadlines(Array.isArray(list) ? list : []))
      .catch((e) => { if (e.name !== 'AbortError') setDeadlines([]); });
    return () => controller.abort();
  };

  useEffect(() => {
    const cleanup = fetchDeadlines();
    return cleanup;
  }, []);

  useEffect(() => {
    if (!groupId || !userId) return;
    const controller = new AbortController();
    authFetch(`${API}/picks/available?userId=${userId}&groupId=${groupId}&round=${currentRound}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setAvailable(Array.isArray(data) ? data : []))
      .catch((e) => { if (e.name !== 'AbortError') setAvailable([]); });
    return () => controller.abort();
  }, [groupId, userId, currentRound]);

  useEffect(() => {
    if (!groupId || !userId) return;
    const controller = new AbortController();
    authFetch(`${API}/picks/history?userId=${userId}&groupId=${groupId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((picks) => setAllPicks(Array.isArray(picks) ? picks : []))
      .catch((e) => { if (e.name !== 'AbortError') setAllPicks([]); });
    return () => controller.abort();
  }, [groupId, userId]);

  useEffect(() => {
    const pick = allPicks.find((p) => p.round === currentRound);
    setMyPickThisRound(pick || null);
  }, [allPicks, currentRound]);

  useEffect(() => {
    if (!deadlines.length) return;
    const now = new Date();
    for (const d of deadlines) {
      const lockAt = d.lockAt ? new Date(d.lockAt) : null;
      const isLocked = lockAt && now >= lockAt;
      const isOpen = d.isOpen !== false;
      if (isOpen && !isLocked) {
        setCurrentRound(d.round);
        setDeadline(d.lockAt || null);
        setOpensAt(d.opensAt || null);
        setIsPerMatchLock(d.perMatchLock || false);
        return;
      }
    }
  }, [deadlines]);

  useEffect(() => {
    if (!deadlines.length) return;
    const d = deadlines.find((d) => d.round === currentRound);
    setDeadline(d ? d.lockAt : null);
    setOpensAt(d ? d.opensAt : null);
    setIsPerMatchLock(d ? (d.perMatchLock || false) : false);
  }, [currentRound, deadlines]);

  useEffect(() => {
    if (!groupId) return;
    const controller = new AbortController();
    fetch(`${API}/groups/${groupId}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((g) => {
        const me = g?.members?.find((m) => m.userId === userId);
        setMember(me || null);
        const tournament = getTournament(g?.tournamentId);
        if (tournament?.drawAvailable === false) setDrawAvailable(false);
        if (tournament?.status === 'completed') {
          setTournamentCompleted(true);
          setDrawAvailable(false);
        }
      })
      .catch((e) => { if (e.name !== 'AbortError') setMember(null); });
    return () => controller.abort();
  }, [groupId, userId]);

  const submitPick = (player) => {
    if (!groupId || !userId) return;
    setSubmitting(true);
    setMessage('');
    setRowError({ id: null, msg: '' });
    authFetch(`${API}/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId, groupId, round: currentRound,
        playerId: player.id, playerName: player.name,
      }),
    })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => { throw new Error(d.error || 'Failed'); });
        return r.json();
      })
      .then((pick) => {
        const wasChange = !!myPickThisRound;
        const oldPick = myPickThisRound;
        setMyPickThisRound(pick);
        setAllPicks((prev) => [
          ...prev.filter((p) => p.round !== currentRound),
          pick,
        ]);
        setAvailable((prev) => {
          let updated = prev.filter((p) => p.id !== player.id);
          if (wasChange && oldPick && !updated.find((p) => p.id === oldPick.playerId)) {
            updated = [...updated, { id: oldPick.playerId, name: oldPick.playerName, seed: oldPick.seed ?? null }];
          }
          return updated;
        });
        setMessage(wasChange ? 'Pick updated!' : 'Pick locked in!');
      })
      .catch((e) => {
        const msg = e.message || "Your pick couldn't be saved. The deadline may have passed. Refresh the page and try again.";
        setRowError({ id: player.id, msg });
        setTimeout(() => setRowError({ id: null, msg: '' }), 4000);
      })
      .finally(() => setSubmitting(false));
  };

  const usedIds = new Set(allPicks.map((p) => p.playerId).filter(Boolean));
  const usedLastNames = new Set(
    allPicks
      .map((p) => {
        const parts = (p.playerName || '').trim().split(' ');
        return parts[parts.length - 1].toLowerCase();
      })
      .filter(Boolean)
  );

  const filtered = available.filter((p) => {
    const name = (p.name || '').toLowerCase().trim();
    const opponentName = (p.opponentName || '').toLowerCase().trim();
    const opponentPossible = (p.opponentPossible || []).join(' ').toLowerCase();
    const alive = !p.roundEliminated;
    const searchTerm = search.trim().toLowerCase();
    const matchesSearch = !searchTerm ||
      name.includes(searchTerm) ||
      opponentName.includes(searchTerm) ||
      opponentPossible.includes(searchTerm);
    return alive && matchesSearch;
  }).sort((a, b) => {
    // Sort by match start time (earliest first) in R1 per-match lock
    if (!isPerMatchLock) return 0;
    const timeA = a.matchStartTime ? new Date(a.matchStartTime).getTime() : Infinity;
    const timeB = b.matchStartTime ? new Date(b.matchStartTime).getTime() : Infinity;
    return timeA - timeB;
  });

  const lockTime     = deadline ? new Date(deadline) : null;
  const openTime     = opensAt  ? new Date(opensAt)  : null;
  const isLocked     = lockTime && new Date() >= lockTime;
  const isNotYetOpen = !isLocked && openTime && new Date() < openTime;
  const isOpen       = !isLocked && !isNotYetOpen;

  const survivedCount = allPicks.filter((p) => p.survived === true).length;

  const prevRound = rounds[rounds.indexOf(currentRound) - 1] || null;
  const prevRoundPick = prevRound ? allPicks.find((p) => p.round === prevRound) : null;
  const prevRoundDeadline = prevRound ? deadlines.find((d) => d.round === prevRound) : null;
  const prevRoundIsLocked = prevRoundDeadline
    ? (prevRoundDeadline.isLocked || (prevRoundDeadline.lockAt && new Date() >= new Date(prevRoundDeadline.lockAt)))
    : false;
  const showPrevPickPending =
    isOpen && prevRoundPick && prevRoundPick.survived === null && prevRoundIsLocked;

  const hasPendingPlayers = available.some((p) => p.pendingPrevRound);
  const showOverlapTip = isOpen && hasPendingPlayers && prevRound;

  const roundLabel = ROUND_LABELS[currentRound] || currentRound;

  // ── Empty state: draw not released / tournament complete ─────
  if (!drawAvailable) {
    return (
      <div className="ps-page">
        <Hero
          tone={tournamentCompleted ? 'gold' : 'primary'}
          compact
          showCourt
          eyebrow={tournamentCompleted ? 'TOURNAMENT COMPLETE' : 'MAKE YOUR PICK'}
          title={tournamentCompleted ? <>This one's <em>in the books</em>.</> : <>Picks aren't <em>open</em> yet.</>}
          lede={tournamentCompleted
            ? "Head back to the pool to see the final standings and the winner."
            : "The draw hasn't been released. Once it drops, you'll be able to make your pick here."}
        />
        <Section tone="canvas" size="md">
          <div className="ps-back-row">
            <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
              ← Back to pool
            </Button>
          </div>
          <Card tone="muted" padding="lg" className="ps-empty-card">
            <div className="ps-empty-icon" aria-hidden="true">
              {tournamentCompleted ? '🏆' : '🎾'}
            </div>
            <p className="ps-empty-title">
              {tournamentCompleted ? 'Tournament finished' : 'Waiting on the draw'}
            </p>
            <p className="ps-empty-sub">
              {tournamentCompleted
                ? 'Final standings are up on the pool page.'
                : "We'll open picks automatically the moment the bracket is released."}
            </p>
            {tournamentCompleted && (
              <Button as={Link} to={`/group/${groupId}`} variant="primary" size="md">
                View final standings →
              </Button>
            )}
          </Card>
        </Section>
      </div>
    );
  }

  // ── Header state description ─────────────────────────────────
  const heroTone = 'primary';
  const heroLede = isOpen
    ? `Pick one player to make it through ${roundLabel}. You can swap your pick until the window closes.`
    : isNotYetOpen
      ? `The ${roundLabel} pick window hasn't opened yet. Check back when the draw lines up.`
      : `${roundLabel} is locked. No more changes for this round.`;

  return (
    <div className="ps-page">
      <Hero
        tone={heroTone}
        compact
        showCourt
        eyebrow={`PICK · ${roundLabel.toUpperCase()}`}
        title={<>Make your <em>pick</em>.</>}
        lede={heroLede}
        meta={
          member !== null ? (
            <div className="ps-hero-status">
              {member.isAlive ? (
                <Badge tone="success" size="md" dot>
                  Alive · {survivedCount} round{survivedCount !== 1 ? 's' : ''} survived
                </Badge>
              ) : (
                <Badge tone="danger" size="md" dot>
                  Out in {ROUND_LABELS[member.eliminatedRound] || member.eliminatedRound} — unlucky!
                </Badge>
              )}
            </div>
          ) : null
        }
      />

      <Section tone="canvas" size="md">
        <div className="ps-top-row">
          <SectionHeader
            eyebrow={`ROUND · ${roundLabel.toUpperCase()}`}
            title={<>Who's going <em>through</em>?</>}
          />
          <Button as={Link} to={`/group/${groupId}`} variant="ghost" size="sm">
            ← Back to pool
          </Button>
        </div>

        {/* Round tabs */}
        {rounds.length > 0 && (
          <div className="ps-round-tabs" role="tablist" aria-label="Select round">
            {rounds.map((r) => (
              <button
                key={r}
                type="button"
                role="tab"
                aria-selected={r === currentRound}
                className={`ps-round-tab${r === currentRound ? ' is-active' : ''}`}
                onClick={() => setCurrentRound(r)}
              >
                {r}
              </button>
            ))}
          </div>
        )}

        {/* Window open: closing countdown */}
        {isOpen && deadline && (
          <Card tone="primary" padding="md" className="ps-countdown-card">
            <span className="ps-countdown-label">Pick window closes in</span>
            <Countdown to={deadline} onExpire={fetchDeadlines} />
          </Card>
        )}

        {/* Window not yet open */}
        {isNotYetOpen && (
          <Card tone="muted" padding="md" className="ps-future-card">
            <div className="ps-future-row">
              <span className="ps-future-label">Pick window opens in</span>
              <Countdown to={opensAt} className="ps-future-value" />
            </div>
            {deadline && (
              <div className="ps-future-close">
                Closes: {formatWindowTime(deadline)}
              </div>
            )}
          </Card>
        )}

        {/* Round overlap tip */}
        {showOverlapTip && (
          <div className="ps-banner ps-banner--info">
            <span className="ps-banner-icon" aria-hidden="true">💡</span>
            <div className="ps-banner-body">
              <p className="ps-banner-title">No rush — {prevRound} matches still in play</p>
              <p className="ps-banner-sub">
                Some {prevRound} results aren't in yet, so not all {currentRound} matchups are confirmed.
                You can wait until today's play finishes to see the full picture before picking.
                Look for players whose opponent is already known.
              </p>
            </div>
          </div>
        )}

        {/* Previous round pending */}
        {showPrevPickPending && (
          <div className={`ps-banner ${myPickThisRound ? 'ps-banner--waiting' : 'ps-banner--urgent'}`}>
            <span className="ps-banner-icon" aria-hidden="true">
              {myPickThisRound ? '⏳' : '⚠️'}
            </span>
            <div className="ps-banner-body">
              <p className="ps-banner-title">
                {myPickThisRound
                  ? `${currentRound} pick submitted — waiting on your ${prevRound} result`
                  : `Make your ${currentRound} pick now`}
              </p>
              <p className="ps-banner-sub">
                {myPickThisRound
                  ? `Your ${prevRound} pick (${prevRoundPick.playerName}) hasn't finished yet, but you're covered — your ${currentRound} pick is saved and will count if they come through.`
                  : `Your ${prevRound} pick (${prevRoundPick.playerName}) hasn't finished yet, but the ${currentRound} window is already open. Submit your ${currentRound} pick now — it will only count if ${prevRoundPick.playerName} advances.`}
              </p>
            </div>
          </div>
        )}

        {/* Locked pick result */}
        {isLocked && myPickThisRound && (() => {
          const survived = myPickThisRound.survived;
          const md = pickMatchDetail;
          const opponent = md
            ? (md.player1Id === myPickThisRound.playerId ? md.player2Name : md.player1Name)
            : null;
          const s = (md?.status || '').toLowerCase();
          const isLiveNow = s === 'in_progress' || s === '1' || s === '2' || s === '3' || s.startsWith('set');
          const statusText = survived === true ? 'Advanced ✓'
            : survived === false ? 'Unlucky — out ✗'
            : isLiveNow ? '● Live now'
            : s === 'completed' ? 'Match complete'
            : md?.startTime ? `Scheduled ${new Date(md.startTime).toLocaleDateString('en-GB', { day:'numeric', month:'short' })}`
            : null;
          const tone = survived === true ? 'success'
            : survived === false ? 'danger'
            : isLiveNow ? 'info' : 'neutral';
          return (
            <Card
              tone={survived === true ? 'gold' : survived === false ? 'default' : 'muted'}
              padding="md"
              className={`ps-picked-card ps-picked-card--locked${survived === false ? ' ps-picked-card--eliminated' : ''}`}
            >
              <div className="ps-picked-inner">
                <PlayerAvatar playerId={myPickThisRound.playerId} playerName={myPickThisRound.playerName} size={40} />
                <div className="ps-picked-body">
                  <p className="ps-picked-label">Your {currentRound} pick — locked in</p>
                  <p className="ps-picked-player">{myPickThisRound.playerName}</p>
                  {opponent && <p className="ps-picked-opponent">vs {opponent}</p>}
                  {statusText && (
                    <div className="ps-picked-status">
                      <Badge tone={tone} size="sm" dot={tone !== 'neutral'}>{statusText}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })()}

        {isLocked && !myPickThisRound && (
          <Card tone="default" padding="md" className="ps-picked-card ps-picked-card--missed">
            <div className="ps-picked-inner">
              <span className="ps-picked-icon" aria-hidden="true">⚠️</span>
              <div className="ps-picked-body">
                <p className="ps-picked-label">Pick window closed — no pick made for {currentRound}</p>
              </div>
            </div>
          </Card>
        )}

        {/* Not signed in */}
        {isOpen && !userId && (
          <Card tone="muted" padding="md" className="ps-auth-prompt">
            <p>Sign in to make your pick.</p>
          </Card>
        )}

        {/* Eliminated */}
        {isOpen && userId && member && !member.isAlive && (
          <Card tone="default" padding="lg" className="ps-eliminated-card">
            <div className="ps-eliminated-icon" aria-hidden="true">😔</div>
            <h2 className="ps-eliminated-title">Unlucky! You're out this time.</h2>
            <p className="ps-eliminated-sub">
              Your {ROUND_LABELS[member.eliminatedRound] || member.eliminatedRound || ''} pick didn't make it through. It happens to the best of us.
            </p>
            <p className="ps-eliminated-cta">
              Follow the rest of the action on the{' '}
              <Link to={`/group/${groupId}`} className="ps-inline-link">pool page</Link>{' '}
              and the{' '}
              <Link to={`/group/${groupId}/draw`} className="ps-inline-link">bracket</Link>.
              See you next tournament!
            </p>
          </Card>
        )}

        {/* Window open + alive: current pick banner + player list */}
        {isOpen && userId && (!member || member.isAlive) && (
          <>
            {myPickThisRound && (
              <Card tone="primary" padding="md" className="ps-picked-card ps-picked-card--changeable">
                <div className="ps-picked-inner">
                  <PlayerAvatar playerId={myPickThisRound.playerId} playerName={myPickThisRound.playerName} size={40} />
                  <div className="ps-picked-body">
                    <p className="ps-picked-label">Current {currentRound} pick</p>
                    <p className="ps-picked-player">{myPickThisRound.playerName}</p>
                  </div>
                  <span className="ps-picked-hint">You can change until the window closes</span>
                </div>
              </Card>
            )}

            <div className="ps-search-row">
              <input
                type="text"
                placeholder="Search players…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="ds-input ps-search-input"
                aria-label="Search players"
              />
              <span className="ps-available-count">
                {filtered.length} player{filtered.length === 1 ? '' : 's'} available
              </span>
            </div>

            <Link to={`/group/${groupId}/draw`} className="ps-bracket-hint">
              Tap a matchup in the bracket to compare players before you pick →
            </Link>

            <div className="ps-player-cards">
              {filtered.slice(0, 80).map((player) => {
                const name = (player.name || '').toLowerCase().trim();
                const lastName = name.split(' ').pop();
                const isCurrentPick = player.id === myPickThisRound?.playerId;
                const usedInOtherRound = !isCurrentPick &&
                  (usedIds.has(player.id) || (lastName && usedLastNames.has(lastName)));
                const isTopSeed = player.seed && player.seed <= 8;

                const cardClass = [
                  'ps-pcard',
                  usedInOtherRound ? 'ps-pcard--used' : '',
                  isTopSeed ? 'ps-pcard--top-seed' : '',
                  isCurrentPick ? 'ps-pcard--current' : '',
                ].filter(Boolean).join(' ');

                return (
                  <div key={player.id} className={cardClass}>
                    {player.seed ? (
                      <span className="ps-pcard-seed">#{player.seed}</span>
                    ) : (
                      <span className="ps-pcard-seed-empty" aria-hidden="true" />
                    )}
                    <PlayerAvatar playerId={player.id} playerName={player.name} size={36} />
                    <div className="ps-pcard-info">
                      <div className="ps-pcard-name">
                        <span className="ps-pcard-name-text">{player.name}</span>
                        {usedInOtherRound && (
                          <span className="ps-pcard-tag ps-pcard-tag--used">Already used</span>
                        )}
                        {isCurrentPick && (
                          <span className="ps-pcard-tag ps-pcard-tag--pick"><span className="ps-pcard-tag-dot" /> Your pick</span>
                        )}
                        {!usedInOtherRound && player.pendingPrevRound && (
                          <span
                            className="ps-pcard-tag ps-pcard-tag--pending"
                            title={`Still in ${prevRound} — pick counts only if they advance`}
                          >
                            ⚠ {prevRound} pending
                          </span>
                        )}
                      </div>
                      {player.opponentName ? (
                        <div className="ps-pcard-opponent">vs {player.opponentName}</div>
                      ) : (player.opponentPossible && player.opponentPossible.length > 0) ? (
                        <div className="ps-pcard-opponent ps-pcard-opponent--possible">
                          vs {player.opponentPossible.join(' or ')}
                        </div>
                      ) : null}
                      {isPerMatchLock && player.matchStartTime && (
                        <div className="ps-pcard-match-time">
                          {formatMatchTime(player.matchStartTime)}
                          {(() => {
                            const hint = getMatchStartHint(player.matchStartTime);
                            if (hint === 'urgent') {
                              return <span className="ps-pcard-soon ps-pcard-soon--urgent">Starts soon</span>;
                            }
                            if (hint === 'today') {
                              return <span className="ps-pcard-soon ps-pcard-soon--today">Today</span>;
                            }
                            return null;
                          })()}
                        </div>
                      )}
                    </div>
                    {rowError.id === player.id && (
                      <span className="ps-pcard-error">{rowError.msg}</span>
                    )}
                    {!usedInOtherRound && !isCurrentPick && rowError.id !== player.id && (
                      <Button
                        variant="primary"
                        size="sm"
                        loading={submitting}
                        onClick={() => submitPick(player)}
                      >
                        {myPickThisRound ? 'Switch' : 'Pick'}
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>

            {filtered.length > 80 && (
              <p className="ps-overflow-hint">Showing first 80 — use search to find others.</p>
            )}
          </>
        )}

        {message && <p className="ps-success">{message}</p>}
      </Section>
    </div>
  );
}
