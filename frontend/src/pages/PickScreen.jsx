import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';

export function PickScreen() {
  const { groupId } = useParams();
  const { userId } = useAuth();
  const [available, setAvailable] = useState([]);
  const [rounds, setRounds] = useState([]);
  const [currentRound, setCurrentRound] = useState('R32'); // Indian Wells: R1, R64, R32, R16, QF, SF, F
  const [deadline, setDeadline] = useState(null);
  const [deadlines, setDeadlines] = useState([]);
  const [search, setSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [myPickThisRound, setMyPickThisRound] = useState(null);
  const [member, setMember] = useState(null);
  const [rowError, setRowError] = useState({ id: null, msg: '' });

  useEffect(() => {
    fetch(`${API}/draw/rounds`)
      .then((r) => r.json())
      .then(setRounds);
  }, []);

  useEffect(() => {
    fetch(`${API}/draw/deadlines`)
      .then((r) => r.json())
      .then((list) => {
        setDeadlines(Array.isArray(list) ? list : []);
      })
      .catch(() => setDeadlines([]));
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
        return;
      }
    }
  }, [deadlines]);

  // When the user switches tabs, update the deadline for that round.
  useEffect(() => {
    if (!deadlines.length) return;
    const d = deadlines.find((d) => d.round === currentRound);
    setDeadline(d ? d.lockAt : null);
  }, [currentRound, deadlines]);

  useEffect(() => {
    if (!groupId) return;
    fetch(`${API}/groups/${groupId}`)
      .then((r) => r.json())
      .then((g) => {
        const me = g?.members?.find((m) => m.userId === userId);
        setMember(me || null);
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
        setMyPickThisRound(pick);
        setAvailable((prev) => prev.filter((p) => p.id !== player.id));
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

  const lockTime = deadline ? new Date(deadline) : null;
  const isLocked = lockTime && new Date() >= lockTime;

  const survivedCount = allPicks.filter((p) => p.survived === true).length;

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

      {deadline && !isLocked && (
        <div className="countdown-card">
          <span className="countdown-label">Pick window closes in</span>
          <Countdown to={deadline} />
        </div>
      )}

      {/* Window is locked: show locked pick or missed-pick warning */}
      {isLocked && myPickThisRound && (
        <div className="picked-card picked-card--locked">
          <div className="picked-card-inner">
            <span className="picked-card-icon">🔒</span>
            <div>
              <p className="picked-card-label">Your {currentRound} pick — locked in</p>
              <p className="picked-card-player">{myPickThisRound.playerName}</p>
            </div>
          </div>
        </div>
      )}
      {isLocked && !myPickThisRound && (
        <div className="picked-card picked-card--missed">
          <span className="picked-card-icon">⚠️</span>
          <p className="picked-card-label">Pick window closed — no pick made for {currentRound}</p>
        </div>
      )}

      {/* Window is still open: show current pick banner (if any) + full player list */}
      {!isLocked && (
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

function Countdown({ to }) {
  const [left, setLeft] = useState('');

  useEffect(() => {
    const end = new Date(to);
    const tick = () => {
      const now = new Date();
      if (now >= end) {
        setLeft('Locked');
        return;
      }
      const d = Math.floor((end - now) / 86400 / 1000);
      const h = Math.floor(((end - now) % (86400 * 1000)) / 3600 / 1000);
      const m = Math.floor(((end - now) % (3600 * 1000)) / 60 / 1000);
      const s = Math.floor(((end - now) % (60 * 1000)) / 1000);
      setLeft(`${d}d ${h}h ${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [to]);

  return <span className="countdown-value">{left}</span>;
}
