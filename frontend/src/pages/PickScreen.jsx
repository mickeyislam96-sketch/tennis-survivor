import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { TOURNAMENTS } from '../data/tournaments';

// ── Helper components defined before PickScreen to ensure they are available
// ── regardless of bundler hoisting behaviour ──────────────────────────────

function formatWindowTime(isoString) {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    + ' at '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function Countdown({ to, className = 'countdown-value', onExpire }) {
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
      const ms  = end - now;
      const d   = Math.floor(ms / 86400000);
      const h   = Math.floor((ms % 86400000) / 3600000);
      const m   = Math.floor((ms % 3600000)  / 60000);
      const s   = Math.floor((ms % 60000)    / 1000);
      setLeft(d > 0 ? `${d}d ${h}h ${m}m ${s}s` : `${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span className={className}>{left}</span>;
}

export function PickScreen() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [available, setAvailable] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState('R1');
  const [pickMatchDetail, setPickMatchDetail] = useState(null);
  const [deadline, setDeadline] = useState(null);
  const [opensAt, setOpensAt] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [myPickThisRound, setMyPickThisRound] = useState(null);
  const [member, setMember] = useState(null);
  const [rowError, setRowError] = useState({ id: null, msg: '' });
  const [drawAvailable, setDrawAvailable] = useState(true);

  useEffect(() => {
    fetch(`${API}/draw/rounds`)
      .then((r) => r.json())
      .then(setRounds);
  }, []);

  const fetchDeadlines = () => {
    fetch(`${API}/draw/deadlines`)
      .then((r) => r.json())
      .then((list) => {
        setDeadlines(Array.isArray(list) ? list : []);
      })
      .catch(() => setDeadlines([]));
  };

  useEffect(() => {
    fetchDeadlines();
  }, []);

  useEffect(() => {
    if (!groupId || !userId) return;
    fetch(`${API}/picks/available?userId=${userId}&groupId=${groupId}&round=${currentRound}`)
      .then((r) => r.json())
      .then(setAvailable)
      .catch(() => setAvailable([]));
  }, [groupId, userId, currentRound]);

  const [allPicks, setAllPicks] = useState([]);

  useEffect(() => {
    if (!groupId || !userId) return;
    fetch(`${API}/picks/history?userId=${userId}&groupId=${groupId}`)
      .then((r) => r.json())
      .then((picks) => {
        setAllPicks(Array.isArray(picks) ? picks : []);
      })
      .catch(() => setAllPicks([]));
  }, [groupId, userId]);

  useEffect(() => {
    const pick = allPicks.find((p) => p.round === currentRound);
    setMyPickThisRound(pick || null);
  }, [allPicks, currentRound]);

  // When deadlines load, always navigate to the most recent open round so the
  // user lands on the right tab — whether they have a pick there or not.
  // Runs once on load (deadlines dependency only); user can still click tabs manually.
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
        return;
      }
    }
  }, [deadlines]);

  // When the user switches tabs, update the deadline and opens-at for that round.
  useEffect(() => {
    if (!deadlines.length) return;
    const d = deadlines.find((d) => d.round === currentRound);
    setDeadline(d ? d.lockAt : null);
    setOpensAt(d ? d.opensAt : null);
  }, [currentRound, deadlines]);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/groups/${groupId}`)
      .then((r) => r.json())
      .then((g) => {
        const me = g?.members?.find((m) => m.userId === userId);
        setMember(me || null);
        // Check if this tournament's draw has been released yet
        const tournament = TOURNAMENTS.find(t => t.id === g?.tournamentId);
        if (tournament?.drawAvailable === false) setDrawAvailable(false);
      })
      .catch(() => setMember(null));
  }, [groupId, userId]);

  const submitPick = (player) => {
    if (!groupId || !userId) return;
    setSubmitting(true);
    setMessage('');
    setRowError({ id: null, msg: '' });
    fetch(`${API}/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        groupId,
        round: currentRound,
        playerId: player.id,
        playerName: player.name
      })
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
        const msg = e.message || 'Could not submit pick';
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
    const alive = !p.roundEliminated; // backend should omit eliminated players, but double-check here
    const matchesSearch = !search.trim() || name.includes(search.trim().toLowerCase());
    return alive && matchesSearch;
  });

  const lockTime   = deadline ? new Date(deadline) : null;
  const openTime   = opensAt  ? new Date(opensAt)  : null;
  const isLocked      = lockTime && new Date() >= lockTime;
  const isNotYetOpen  = !isLocked && openTime && new Date() < openTime;
  const isOpen        = !isLocked && !isNotYetOpen;

  const survivedCount = allPicks.filter((p) => p.survived === true).length;

  // ── Previous round result pending banner ─────────────────────────────────────
  // When the current round window is open but the previous round pick hasn't been
  // graded yet (survived===null) and the previous window is locked, show a banner
  // so the user knows to make their current-round pick speculatively. Works for
  // any round transition, not just R1/R64.
  const prevRound = rounds[rounds.indexOf(currentRound) - 1] || null;
  const prevRoundPick = prevRound ? allPicks.find((p) => p.round === prevRound) : null;
  const prevRoundDeadline = prevRound ? deadlines.find((d) => d.round === prevRound) : null;
  const prevRoundIsLocked = prevRoundDeadline
    ? (prevRoundDeadline.isLocked || (prevRoundDeadline.lockAt && new Date() >= new Date(prevRoundDeadline.lockAt)))
    : false;
  const showPrevPickPending =
    isOpen && prevRoundPick && prevRoundPick.survived === null && prevRoundIsLocked;

  if (!drawAvailable) {
    return (
      <div className="page pick-screen">
        <div className="pick-header">
          <h1>Make your pick</h1>
          <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
        </div>
        <div className="draw-empty-state">
          <div className="draw-empty-icon">🎾</div>
          <p className="draw-empty-title">Picks not open yet</p>
          <p className="draw-empty-sub">The draw hasn't been released. Once it is, you'll be able to make your pick here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page pick-screen">
      <div className="pick-header">
        <h1>Make your pick</h1>
        <Link to={`/group/${groupId}`} className="back-link">← Back to group</Link>
      </div>

      {/* Status strip */}
      {member !== null && (
        <div className={`ps-status-strip ${member.isAlive ? 'ps-alive' : 'ps-out'}`}>
          <span className="ps-status-dot" />
          <span className="ps-status-label">
            {member.isAlive
              ? `You're alive · ${survivedCount} round${survivedCount !== 1 ? 's' : ''} survived`
              : `Eliminated in ${member.eliminatedRound}`}
          </span>
        </div>
      )}

      <div className="round-tabs">
        {rounds.map((r) => (
          <button
            key={r}
            type="button"
            className={`round-tab ${r === currentRound ? 'active' : ''}`}
            onClick={() => setCurrentRound(r)}
          >
            {r}
          </button>
        ))}
      </div>

      {/* Window is open: closing countdown */}
      {isOpen && deadline && (() => {
        const msLeft = new Date(deadline) - new Date();
        const closingSoon = msLeft > 0 && msLeft < 24 * 60 * 60 * 1000;
        return (
          <div className="countdown-card--big">
            <span className="countdown-label">Pick window closes in</span>
            <Countdown to={deadline} onExpire={fetchDeadlines} />
            {closingSoon && (
              <span className="countdown-closing-soon">Closing soon</span>
            )}
          </div>
        );
      })()}

      {/* Window not yet open: show open + close times */}
      {isNotYetOpen && (
        <div className="future-window-card">
          <div className="future-window-row">
            <span className="future-window-label">Pick window opens in</span>
            <Countdown to={opensAt} className="future-window-value" />
          </div>
          {deadline && (
            <div className="future-window-close">
              Closes: {formatWindowTime(deadline)}
            </div>
          )}
        </div>
      )}

      {/* Previous round result pending, current window open */}
      {showPrevPickPending && (
        <div className={`pending-prev-pick-banner${!myPickThisRound ? ' pending-prev-pick-banner--urgent' : ''}`}>
          <span className="pending-prev-pick-icon">{myPickThisRound ? '⏳' : '⚠️'}</span>
          <div className="pending-prev-pick-body">
            <p className="pending-prev-pick-title">
              {myPickThisRound
                ? `${currentRound} pick submitted — waiting on your ${prevRound} result`
                : `Make your ${currentRound} pick now`}
            </p>
            <p className="pending-prev-pick-sub">
              {myPickThisRound
                ? `Your ${prevRound} pick (${prevRoundPick.playerName}) hasn't finished yet, but you're covered — your ${currentRound} pick is saved and will count if they come through.`
                : `Your ${prevRound} pick (${prevRoundPick.playerName}) hasn't finished yet, but the ${currentRound} window is already open. Submit your ${currentRound} pick now — it will only count if ${prevRoundPick.playerName} advances.`}
            </p>
          </div>
        </div>
      )}

      {/* Window is locked: show locked pick or missed-pick warning */}
      {isLocked && myPickThisRound && (() => {
        const survived = myPickThisRound.survived;
        const md = pickMatchDetail;
        const opponent = md
          ? (md.player1Id === myPickThisRound.playerId ? md.player2Name : md.player1Name)
          : null;
        const s = (md?.status || '').toLowerCase();
        const isLiveNow = s === 'in_progress' || s === '1' || s === '2' || s === '3' || s.startsWith('set');
        const statusText = survived === true ? 'Advanced ✓'
          : survived === false ? 'Eliminated ✗'
          : isLiveNow ? '● Live now'
          : s === 'completed' ? 'Match complete'
          : md?.startTime ? `Scheduled ${new Date(md.startTime).toLocaleDateString('en-GB', {day:'numeric',month:'short'})}`
          : null;
        const statusCls = survived === true ? 'ps-status--won'
          : survived === false ? 'ps-status--lost'
          : isLiveNow ? 'ps-status--live' : 'ps-status--pending';
        return (
          <div className={`picked-card picked-card--locked${survived === true ? ' picked-card--survived' : survived === false ? ' picked-card--eliminated' : ''}`}>
            <div className="picked-card-inner">
              <span className="picked-card-icon">{survived === true ? '✓' : survived === false ? '✗' : '🔒'}</span>
              <div>
                <p className="picked-card-label">Your {currentRound} pick — locked in</p>
                <p className="picked-card-player">{myPickThisRound.playerName}</p>
                {opponent && <p className="picked-card-opponent">vs {opponent}</p>}
                {statusText && <p className={`ps-match-status ${statusCls}`}>{statusText}</p>}
              </div>
            </div>
          </div>
        );
      })()}
      {isLocked && !myPickThisRound && (
        <div className="picked-card picked-card--missed">
          <span className="picked-card-icon">⚠️</span>
          <p className="picked-card-label">Pick window closed — no pick made for {currentRound}</p>
        </div>
      )}

      {/* Not signed in: prompt to log in */}
      {isOpen && !userId && (
        <div className="auth-prompt">
          <p className="auth-prompt-text">Sign in to make your pick.</p>
        </div>
      )}

      {/* Window is still open: show current pick banner (if any) + full player list */}
      {isOpen && userId && (
        <>
          {myPickThisRound && (
            <div className="picked-card picked-card--changeable">
              <div className="picked-card-inner">
                <span className="picked-card-icon">✓</span>
                <div>
                  <p className="picked-card-label">Current {currentRound} pick</p>
                  <p className="picked-card-player">{myPickThisRound.playerName}</p>
                </div>
                <span className="picked-card-hint">You can change until the window closes</span>
              </div>
            </div>
          )}

          <div className="search-row">
            <input
              type="text"
              placeholder="Search players…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input search-input"
            />
          </div>
          <p className="available-count">{filtered.length} players available</p>
          <ul className="player-list">
            {filtered.slice(0, 80).map((player) => {
              const name = (player.name || '').toLowerCase().trim();
              const lastName = name.split(' ').pop();
              const isCurrentPick = player.id === myPickThisRound?.playerId;
              // "Used" only counts picks from OTHER rounds — the current round's pick is replaceable
              const usedInOtherRound = !isCurrentPick &&
                (usedIds.has(player.id) || (lastName && usedLastNames.has(lastName)));
              const isTopSeed = player.seed && player.seed <= 8;
              return (
                <li key={player.id} className={[
                  'player-row',
                  usedInOtherRound ? 'player-used' : '',
                  isTopSeed ? 'player-top-seed' : '',
                  isCurrentPick ? 'player-current-pick' : '',
                ].filter(Boolean).join(' ')}>
                  {player.seed ? (
                    <span className="player-seed-badge">#{player.seed}</span>
                  ) : (
                    <span className="player-seed-placeholder" />
                  )}
                  <span className="player-name">
                    {player.name}
                    {usedInOtherRound && <span className="player-used-label">Already used</span>}
                    {isCurrentPick && <span className="player-current-label">Your pick</span>}
                    {!usedInOtherRound && player.pendingPrevRound && (
                      <span className="player-pending-badge" title={`Still in ${prevRound} — pick counts only if they advance`}>
                        ⚠️ {prevRound} result pending
                      </span>
                    )}
                  </span>
                  {rowError.id === player.id && (
                    <span className="player-row-error">{rowError.msg}</span>
                  )}
                  {!usedInOtherRound && !isCurrentPick && rowError.id !== player.id && (
                    <button
                      type="button"
                      className="btn primary btn-sm"
                      disabled={submitting}
                      onClick={() => submitPick(player)}
                    >
                      {myPickThisRound ? 'Switch' : 'Pick'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          {filtered.length > 80 && <p className="text-muted">Showing first 80. Use search to find others.</p>}
        </>
      )}

      {message && <p className="success-msg">{message}</p>}
    </div>
  );
}
