import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../App';
import { API } from '../App';
import { getTournament, TOURNAMENTS } from '../data/tournaments';

// Days until a YYYY-MM-DD date (positive = future)
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

// ── Avatar helpers (match Leaderboard.jsx) ─────────────────
const AVATAR_COLOURS = [
  '#16a34a', '#0891b2', '#7c3aed', '#db2777',
  '#d97706', '#65a30d', '#0369a1', '#9333ea',
];
function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}
function initials(name) {
  return (name || '?').split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2);
}

// Pre-launch = upcoming tournament more than 3 days away (no draw/picks yet)
function isPreLaunch(tournament) {
  if (!tournament) return false;
  if (tournament.status === 'active') return false;
  return daysUntil(tournament.startDate) > 3;
}

function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

// ── SVG icons (consistent across all platforms) ──────────────
const DrawIcon = () => (
  <svg className="nc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
  </svg>
);
const HistoryIcon = () => (
  <svg className="nc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 0 .5-4H6"/><path d="M3 3v4h4"/>
  </svg>
);
const LeaderboardIcon = () => (
  <svg className="nc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const DocsIcon = () => (
  <svg className="nc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="9" y1="13" x2="15" y2="13"/>
    <line x1="9" y1="17" x2="13" y2="17"/>
  </svg>
);

const NAV_CARDS = [
  { to: 'draw',        Icon: DrawIcon,        title: 'View draw',    desc: 'Tournament bracket & results' },
  { to: 'history',     Icon: HistoryIcon,     title: 'Pick history', desc: 'Your past picks' },
  { to: 'leaderboard', Icon: LeaderboardIcon, title: 'Leaderboard',  desc: "Who's still in" },
];

export function GroupHome() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const { userId, isRegistered, register, login, user } = useAuth();
  const [groups, setGroups] = useState([]);
  const [allPools, setAllPools] = useState([]);
  const [group, setGroup] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [openRound, setOpenRound] = useState(null);
  const [openRoundDeadline, setOpenRoundDeadline] = useState(null);
  const [openRoundOpensAt, setOpenRoundOpensAt] = useState(null);
  const [r1LockAt, setR1LockAt] = useState(null);
  const [myCurrentPick, setMyCurrentPick] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [joinAfterAuth, setJoinAfterAuth] = useState(false); // trigger join after registration
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  useEffect(() => {
    if (groupId) {
      fetch(`${API}/groups/${groupId}`)
        .then((r) => r.json())
        .then(setGroup)
        .catch(() => setGroup(null))
        .finally(() => setLoading(false));
    } else {
      // Load all available pools (for the lobby) and user's joined groups
      Promise.all([
        fetch(`${API}/pools?userId=${userId}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/groups?userId=${userId}`).then(r => r.json()).catch(() => []),
      ]).then(([pools, myGroups]) => {
        setAllPools(Array.isArray(pools) ? pools : []);
        setGroups(Array.isArray(myGroups) ? myGroups : []);
      }).finally(() => setLoading(false));
    }
  }, [groupId, userId]);

  // Fetch current open round
  useEffect(() => {
    fetch(`${API}/draw/deadlines`)
      .then((r) => r.json())
      .then((deadlines) => {
        if (!Array.isArray(deadlines)) return;
        const now = new Date();
        const open = deadlines.find((d) => {
          const lockAt = d.lockAt ? new Date(d.lockAt) : null;
          return !d.isLocked && (!lockAt || now < lockAt);
        });
        if (open) {
          setOpenRound(open.round);
          setOpenRoundDeadline(open.lockAt || null);
          setOpenRoundOpensAt(open.opensAt || null);
        }
        // Save R1 lockAt specifically — used to compute dynamic entry close time
        const r1 = deadlines.find((d) => d.round === 'R1');
        if (r1?.lockAt) setR1LockAt(r1.lockAt);
      })
      .catch(() => {});
  }, []);

  // Fetch user's pick for the current open round
  useEffect(() => {
    if (!groupId || !userId || !openRound) return;
    fetch(`${API}/picks/history?userId=${userId}&groupId=${groupId}`)
      .then((r) => r.json())
      .then((picks) => {
        if (!Array.isArray(picks)) return;
        const pick = picks.find((p) => p.round === openRound);
        setMyCurrentPick(pick || null);
      })
      .catch(() => {});
  }, [groupId, userId, openRound]);

  // Join the current group directly (used from pre-launch dashboard)
  // For paid groups, redirects to payment flow if backend returns 402.
  const joinGroup = async (uid, displayName) => {
    if (!group) return;
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch(`${API}/groups/${group.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: uid, displayName }),
      });
      if (!res.ok) {
        const d = await res.json();
        // Paid group — redirect to payment flow
        if (res.status === 402 && d.code === 'PAYMENT_REQUIRED') {
          navigate(`/group/${group.id}/pay`);
          return;
        }
        throw new Error(d.error || 'Could not join');
      }
      // Refresh group data to reflect new membership
      const updated = await fetch(`${API}/groups/${group.id}`).then(r => r.json());
      setGroup(updated);
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  };

  // After auth modal succeeds, trigger join if user wanted to join
  useEffect(() => {
    if (joinAfterAuth && isRegistered && userId && group) {
      setJoinAfterAuth(false);
      joinGroup(userId, user?.displayName || 'Player');
    }
  }, [joinAfterAuth, isRegistered, userId]);

  if (loading) return <div className="page-loading">Loading…</div>;

  // ── Group dashboard ──────────────────────────────────────────
  if (groupId && group) {
    const isMember = group.members?.some((m) => m.userId === userId);
    const totalMembers = group.members?.length ?? 0;
    const aliveMembers = group.members?.filter((m) => m.isAlive).length ?? 0;
    const inviteUrl = `${window.location.origin}/join/${group.inviteCode}`;

    const copyInvite = () => {
      navigator.clipboard.writeText(inviteUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    const tournament = getTournament(group.tournamentId);
    const preLaunch  = isPreLaunch(tournament);
    const isCompleted = tournament?.status === 'completed';
    // Entry closes 1 hour before R1 picks lock (gives new joiners time to make their first pick).
    // Falls back to the tournament's explicit entryOpen flag if the deadline isn't loaded yet.
    const entryDeadline = r1LockAt
      ? new Date(new Date(r1LockAt).getTime() - 60 * 60 * 1000)
      : null;
    const isEntryClosed = isCompleted || tournament?.entryOpen === false
      || (entryDeadline && new Date() >= entryDeadline);

    // Show an urgency banner when the user hasn't picked and the deadline is within 24 h
    // For R1, show a softer reminder since there's no fixed deadline (per-match lock)
    const msUntilDeadline = openRoundDeadline ? new Date(openRoundDeadline) - new Date() : Infinity;
    const closingSoon = !isCompleted && openRound && openRound !== 'R1' && !myCurrentPick && msUntilDeadline > 0 && msUntilDeadline < 24 * 60 * 60 * 1000;
    const r1NoPick = !isCompleted && openRound === 'R1' && !myCurrentPick;

    // Winner(s) for completed tournaments
    const winners = isCompleted ? (group.members || []).filter(m => m.isAlive) : [];
    // Next tournament for CTA
    const nextTournament = TOURNAMENTS.find(t => t.status === 'upcoming' || t.status === 'active');

    // ── Pre-launch dashboard for NON-MEMBERS (join CTA) ──────────
    if (preLaunch && tournament && !isMember) {
      const startDate    = tournament.startDate;
      const startDateFmt = fmtDate(startDate);
      // Use the explicit draw date from config if set, else estimate 3 days before start
      const drawDateStr  = tournament.drawDate
        || new Date(new Date(startDate) - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const drawDateFmt  = fmtDate(drawDateStr);
      const isFree       = group.entryFeeCents === 0;

      const handleJoinClick = () => {
        if (!isRegistered) {
          setJoinAfterAuth(true);
          setShowAuthModal(true);
        } else {
          joinGroup(userId, user?.displayName || 'Player');
        }
      };

      return (
        <div className="page group-home">
          {showAuthModal && (
            <AuthModal
              onClose={() => { setShowAuthModal(false); setJoinAfterAuth(false); }}
              onSuccess={() => setShowAuthModal(false)}
              poolName={group.name}
              register={register}
              login={login}
            />
          )}

          {/* Hero */}
          <div className="group-hero">
            <div className="group-hero-court" aria-hidden="true" />
            <div className="group-hero-inner">
              <p className="group-hero-eyebrow">
                🎾 {tournament.name} {tournament.year} · {tournament.tourLevel}
              </p>
              <h1 className="group-hero-title">{group.name}</h1>
              <div className="group-hero-stats">
                <div className="group-hero-stat">
                  <span className="group-stat-value">{isFree ? 'Free' : fmtGBP(group.entryFeeCents)}</span>
                  <span className="group-stat-label">Entry</span>
                </div>
                <div className="group-hero-divider" />
                <div className="group-hero-stat">
                  <span className="group-stat-value">{startDateFmt}</span>
                  <span className="group-stat-label">Starts</span>
                </div>
                <div className="group-hero-divider" />
                <div className="group-hero-stat">
                  <span className="group-stat-value">{totalMembers}</span>
                  <span className="group-stat-label">Registered</span>
                </div>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="prelaunch-timeline">
            <div className="plt-step plt-step--done">
              <div className="plt-dot plt-dot--done" />
              <div className="plt-body">
                <span className="plt-label">Registration open</span>
                <span className="plt-sub">Join now to secure your spot</span>
              </div>
            </div>
            <div className="plt-connector" />
            <div className="plt-step">
              <div className="plt-dot" />
              <div className="plt-body">
                <span className="plt-label">Draw released</span>
                <span className="plt-sub">{drawDateFmt} · pick window opens</span>
              </div>
            </div>
            <div className="plt-connector" />
            <div className="plt-step">
              <div className="plt-dot" />
              <div className="plt-body">
                <span className="plt-label">Tournament begins</span>
                <span className="plt-sub">{startDateFmt} · {tournament.location}</span>
              </div>
            </div>
          </div>

          {/* CTA */}
          <div className="prelaunch-cta-section">
            {isMember ? (
              <div className="prelaunch-registered">
                <span className="prelaunch-registered-icon">✓</span>
                <div>
                  <p className="prelaunch-registered-label">You're registered</p>
                  <p className="prelaunch-registered-sub">
                    We'll show your pick window here once the draw is released on {drawDateFmt}.
                  </p>
                </div>
              </div>
            ) : isEntryClosed ? (
              <div className="entry-closed-notice">
                <span className="entry-closed-icon">🔒</span>
                <p className="entry-closed-title">This tournament hasn't launched yet</p>
                <p className="entry-closed-sub">
                  {tournament.entryOpenDate
                    ? `Entries are expected to open around ${fmtDate(tournament.entryOpenDate)}, once the draw is released.`
                    : 'Check back when the draw is released.'}
                </p>
              </div>
            ) : (
              <>
                <button
                  className="btn primary btn-lg"
                  onClick={handleJoinClick}
                  disabled={joining}
                >
                  {joining ? 'Joining…' : isFree ? 'Join free →' : `Join for ${fmtGBP(group.entryFeeCents)} →`}
                </button>
                <p className="prelaunch-cta-hint">
                  {isRegistered
                    ? `Joining as ${user.displayName}`
                    : 'You\'ll create a free account to join'}
                </p>
                {joinError && <p className="error">{joinError}</p>}
              </>
            )}
          </div>

          {/* Invite + T&C */}
          {isMember && (
            <div className="invite-box">
              <span className="invite-box-label">Invite friends</span>
              <div className="invite-box-row">
                <code className="invite-box-code">{inviteUrl}</code>
                <button className={`btn invite-copy-btn ${copied ? 'copied' : ''}`} onClick={copyInvite}>
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          )}

          <div className="prelaunch-footer-links">
            <Link to="/terms" className="prelaunch-footer-link">Terms &amp; Conditions</Link>
          </div>
        </div>
      );
    }

    // ── Pre-launch MEMBER view — leaderboard style ───────────────────────
    if (preLaunch && tournament && isMember) {
      const drawDateStr  = tournament.drawDate
        || new Date(new Date(tournament.startDate) - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const drawDateFmt  = fmtDate(drawDateStr);

      return (
        <div className="page leaderboard">
          <div className="leaderboard-header">
            <h1>Leaderboard</h1>
          </div>

          {/* Stats bar — same layout as Leaderboard.jsx */}
          <div className="lb-stats-bar">
            <div className="lb-stat">
              <span className="lb-stat-value">{fmtGBP(group.prizePoolCents || 0)}</span>
              <span className="lb-stat-label">Prize pool</span>
            </div>
            <div className="lb-stat lb-stat-alive">
              <span className="lb-stat-value">{totalMembers}</span>
              <span className="lb-stat-label">Still in</span>
            </div>
            <div className="lb-stat lb-stat-out">
              <span className="lb-stat-value">0</span>
              <span className="lb-stat-label">Eliminated</span>
            </div>
            <div className="lb-stat">
              <span className="lb-stat-value">{totalMembers}</span>
              <span className="lb-stat-label">Total entrants</span>
            </div>
          </div>

          <p className="lb-group-name">{group.name}</p>

          {/* Draw release notice */}
          <div className="prelaunch-registered" style={{ marginBottom: '1rem' }}>
            <span className="prelaunch-registered-icon">✓</span>
            <div>
              <p className="prelaunch-registered-label">You're in!</p>
              <p className="prelaunch-registered-sub">
                The draw is released on {drawDateFmt} — your pick window opens then.
              </p>
            </div>
          </div>

          {/* Member table — matches leaderboard table styling */}
          <div className="lb-table-wrap">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="lb-th-status">Status</th>
                </tr>
              </thead>
              <tbody>
                {(group.members || []).map((m) => {
                  const isYou = m.userId === userId;
                  return (
                    <tr key={m.id || m.userId} className={isYou ? 'lb-row-you' : ''}>
                      <td className="lb-td-player">
                        <span className="lb-avatar" style={{ background: avatarColour(m.displayName) }}>
                          {initials(m.displayName)}
                        </span>
                        <span className="lb-display-name">{m.displayName}</span>
                        {isYou && <span className="lb-you-tag">You</span>}
                      </td>
                      <td className="lb-td-status">
                        <span className="status-alive">Alive</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Invite */}
          <div className="invite-box">
            <span className="invite-box-label">Invite friends</span>
            <div className="invite-box-row">
              <code className="invite-box-code">{inviteUrl}</code>
              <button className={`btn invite-copy-btn ${copied ? 'copied' : ''}`} onClick={copyInvite}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </button>
            </div>
          </div>

          <div className="prelaunch-footer-links">
            <Link to="/terms" className="prelaunch-footer-link">Terms &amp; Conditions</Link>
          </div>
        </div>
      );
    }

    // ── Completed tournament dashboard ──────────────────────────
    if (isCompleted && tournament) {
      const winnerNames = winners.map(w => w.displayName);
      const nextT = TOURNAMENTS.find(t => t.status === 'upcoming' && t.id !== tournament.id);

      return (
        <div className="page group-home">
          {/* Hero — completed state */}
          <div className="group-hero group-hero--completed">
            <div className="group-hero-court" aria-hidden="true" />
            <div className="group-hero-inner">
              <p className="group-hero-eyebrow">
                🏆 {tournament.name} {tournament.year} · {tournament.tourLevel}
              </p>
              <h1 className="group-hero-title">{group.name}</h1>
              <p className="completed-label">Tournament complete</p>
            </div>
          </div>

          {/* Winner banner */}
          <div className="completed-winner-section">
            {winners.length === 1 ? (
              <div className="winner-banner">
                <div className="winner-trophy">🏆</div>
                <h2 className="winner-name">{winnerNames[0]}</h2>
                <p className="winner-subtitle">Winner — Last one standing!</p>
                {group.prizePoolCents > 0 && (
                  <p className="winner-prize">Takes the {fmtGBP(group.prizePoolCents)} prize pool</p>
                )}
              </div>
            ) : winners.length > 1 ? (
              <div className="winner-banner">
                <div className="winner-trophy">🏆</div>
                <h2 className="winner-name">{winnerNames.join(', ')}</h2>
                <p className="winner-subtitle">{winners.length} survivors — prize shared!</p>
                {group.prizePoolCents > 0 && (
                  <p className="winner-prize">{fmtGBP(group.prizePoolCents)} prize pool split {winners.length} ways ({fmtGBP(Math.floor(group.prizePoolCents / winners.length))} each)</p>
                )}
              </div>
            ) : (
              <div className="winner-banner winner-banner--none">
                <div className="winner-trophy">😮</div>
                <h2 className="winner-name">No survivors!</h2>
                <p className="winner-subtitle">Everyone was eliminated — nobody beat the draw.</p>
              </div>
            )}
          </div>

          {/* Final stats */}
          <div className="completed-stats">
            <div className="completed-stat">
              <span className="completed-stat-value">{totalMembers}</span>
              <span className="completed-stat-label">Entered</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-value">{winners.length}</span>
              <span className="completed-stat-label">{winners.length === 1 ? 'Survivor' : 'Survivors'}</span>
            </div>
            <div className="completed-stat">
              <span className="completed-stat-value">{totalMembers - aliveMembers}</span>
              <span className="completed-stat-label">Eliminated</span>
            </div>
          </div>

          {/* Nav cards — still accessible for review */}
          <div className="nav-card-row">
            <Link to={`/group/${groupId}/leaderboard`} className="nav-card">
              <span className="nav-card-icon"><LeaderboardIcon /></span>
              <span className="nav-card-title">Final standings</span>
              <span className="nav-card-desc">Full leaderboard</span>
            </Link>
            <Link to={`/group/${groupId}/draw`} className="nav-card">
              <span className="nav-card-icon"><DrawIcon /></span>
              <span className="nav-card-title">View draw</span>
              <span className="nav-card-desc">Tournament bracket & results</span>
            </Link>
            <Link to={`/group/${groupId}/history`} className="nav-card">
              <span className="nav-card-icon"><HistoryIcon /></span>
              <span className="nav-card-title">Pick history</span>
              <span className="nav-card-desc">Review your picks</span>
            </Link>
          </div>

          {/* Next tournament CTA */}
          {nextT && (
            <div className="next-tournament-cta">
              <p className="next-cta-eyebrow">Next up</p>
              <h3 className="next-cta-title">{nextT.name} {nextT.year}</h3>
              <p className="next-cta-meta">
                {nextT.tourLevel} · {nextT.location} · Starts {fmtDate(nextT.startDate)}
              </p>
              <Link to="/" className="btn primary btn-lg next-cta-btn">
                View upcoming pools →
              </Link>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="page group-home">

        {/* ── Closing-soon urgency banner (R2+) ── */}
        {closingSoon && (
          <div className="pick-urgency-banner">
            <span className="pub-icon">⚠️</span>
            <span className="pub-text">
              <strong>Deadline closing soon!</strong>{' '}
              <DeadlineCountdown to={openRoundDeadline} /> left to pick for <strong>{openRound}</strong>.
            </span>
            <Link to={`/group/${groupId}/pick`} className="pub-cta">Pick now →</Link>
          </div>
        )}

        {/* ── R1 reminder banner (no fixed deadline) ── */}
        {r1NoPick && (
          <div className="pick-urgency-banner pick-urgency-banner--r1">
            <span className="pub-icon">🎾</span>
            <span className="pub-text">
              <strong>R1 is open!</strong>{' '}
              Pick any player before their match starts. Players are removed from the list as matches begin.
            </span>
            <Link to={`/group/${groupId}/pick`} className="pub-cta">Make your pick →</Link>
          </div>
        )}

        {/* Hero banner */}
        <div className="group-hero">
          <div className="group-hero-court" aria-hidden="true" />
          <div className="group-hero-inner">
            <p className="group-hero-eyebrow">
              🎾 {(() => { const t = getTournament(group.tournamentId); return t ? `${t.name} ${t.year} · ${t.tourLevel}` : 'Final Serve-ivor'; })()}
            </p>
            <h1 className="group-hero-title">{group.name}</h1>
            <div className="group-hero-stats">
              <div className="group-hero-stat">
                <span className="group-stat-value">{fmtGBP(group.prizePoolCents)}</span>
                <span className="group-stat-label">Prize pool</span>
              </div>
              <div className="group-hero-divider" />
              <div className="group-hero-stat">
                <span className="group-stat-value">{fmtGBP(group.entryFeeCents)}</span>
                <span className="group-stat-label">Entry fee</span>
              </div>
              {totalMembers > 0 && (
                <>
                  <div className="group-hero-divider" />
                  <div className="group-hero-stat">
                    <span className="group-stat-value">{aliveMembers}<span className="group-stat-total"> / {totalMembers}</span></span>
                    <span className="group-stat-label">Still in</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Survivor progress meter */}
        {totalMembers > 1 && (
          <SurvivorMeter alive={aliveMembers} total={totalMembers} />
        )}

        {!isMember ? (
          <div className="join-cta-section">
            {isEntryClosed ? (
              <div className="entry-closed-notice">
                <span className="entry-closed-icon">🎾</span>
                <p className="entry-closed-title">Entry period is over</p>
                <p className="entry-closed-sub">
                  {tournament.name} is already underway — new entries are no longer accepted.
                </p>
                <Link to={`/group/${groupId}/leaderboard`} className="btn primary btn-lg" style={{ marginTop: '0.75rem' }}>
                  View leaderboard →
                </Link>
              </div>
            ) : (
              <Link to={`/join/${group.inviteCode}`} className="btn primary btn-lg">
                Join this group
              </Link>
            )}
          </div>
        ) : (
          <>
            {/* Primary CTA */}
            <div className="pick-cta-section">
              {myCurrentPick ? (
                <div className="pick-cta-done">
                  <span className="pick-cta-done-icon">✓</span>
                  <div className="pick-cta-done-text">
                    <span className="pick-cta-done-label">{openRound} pick locked in</span>
                    <span className="pick-cta-done-player">{myCurrentPick.playerName}</span>
                  </div>
                  <Link to={`/group/${groupId}/pick`} className="btn pick-cta-change-btn">
                    View picks
                  </Link>
                </div>
              ) : (
                <>
                  <Link to={`/group/${groupId}/pick`} className="btn primary btn-lg pick-cta-btn">
                    {openRound ? `Pick for ${openRound} →` : 'Make your pick →'}
                  </Link>
                  {openRound && openRound === 'R1' ? (
                    <p className="pick-cta-hint pick-cta-hint--r1">
                      No deadline for R1. Players are removed as their match starts, so pick before your player begins.
                    </p>
                  ) : openRound ? (
                    <p className="pick-cta-hint">
                      <PickWindow opensAt={openRoundOpensAt} lockAt={openRoundDeadline} />
                    </p>
                  ) : null}
                </>
              )}
            </div>

            {/* Secondary nav cards */}
            <div className="nav-card-row">
              {NAV_CARDS.map(({ to, Icon, title, desc }) => (
                <Link key={to} to={`/group/${groupId}/${to}`} className="nav-card">
                  <span className="nav-card-icon"><Icon /></span>
                  <span className="nav-card-title">{title}</span>
                  <span className="nav-card-desc">{desc}</span>
                </Link>
              ))}
              <Link to="/terms" className="nav-card">
                <span className="nav-card-icon"><DocsIcon /></span>
                <span className="nav-card-title">Terms &amp; Conditions</span>
                <span className="nav-card-desc">Rules and entry terms</span>
              </Link>
            </div>

            {/* Invite link */}
            <div className="invite-box">
              <span className="invite-box-label">Invite friends</span>
              <div className="invite-box-row">
                <code className="invite-box-code">{inviteUrl}</code>
                <button className={`btn invite-copy-btn ${copied ? 'copied' : ''}`} onClick={copyInvite}>
                  {copied ? '✓ Copied!' : 'Copy link'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  if (groupId && !group) {
    return (
      <div className="page">
        <p>Group not found.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  // ── Lobby / home ────────────────────────────────────────────
  const activePools    = allPools.filter(p => p.tournament?.status === 'active');
  const upcomingPools  = allPools.filter(p => p.tournament?.status === 'upcoming');
  const completedPools = allPools.filter(p => p.tournament?.status === 'completed');

  return (
    <div className="page home-page">
      <div className="home-hero">
        <div className="home-hero-court" aria-hidden="true" />
        <div className="home-hero-inner">
          <p className="home-hero-eyebrow">🎾 Year-round ATP tennis prediction</p>
          <h1 className="home-hero-title">Final Serve-ivor</h1>
          <p className="home-hero-sub">
            Pick one player per round. If they win, you survive.<br />
            Last one standing takes the prize.
          </p>
        </div>
      </div>

      {/* How it works */}
      <section className="how-it-works">
        <h2 className="hiw-heading">How it works</h2>
        <div className="hiw-steps">
          <div className="hiw-step">
            <div className="hiw-step-num">1</div>
            <h3 className="hiw-step-title">Enter a pool</h3>
            <p className="hiw-step-desc">Join an open tournament pool below, or use a friend's invite code to enter their private group.</p>
          </div>
          <div className="hiw-step">
            <div className="hiw-step-num">2</div>
            <h3 className="hiw-step-title">Pick one player</h3>
            <p className="hiw-step-desc">Each round, pick any player you predict will win. You can never pick the same player twice.</p>
          </div>
          <div className="hiw-step">
            <div className="hiw-step-num">3</div>
            <h3 className="hiw-step-title">Last one standing wins</h3>
            <p className="hiw-step-desc">If your player loses, you're out. Run out of valid picks and you're eliminated — so don't burn your best players too soon. Outlast everyone else and take the entire prize pool.</p>
          </div>
        </div>
      </section>

      {/* Active tournaments */}
      {activePools.length > 0 && (
        <section className="home-section">
          <h2 className="home-section-title">Open now</h2>
          <div className="pool-card-list">
            {activePools.map(p => <PoolCard key={p.id} pool={p} />)}
          </div>
        </section>
      )}

      {/* Upcoming tournaments */}
      {upcomingPools.length > 0 && (
        <section className="home-section">
          <h2 className="home-section-title">Coming soon</h2>
          <div className="pool-card-list">
            {upcomingPools.map(p => <PoolCard key={p.id} pool={p} />)}
          </div>
        </section>
      )}

      {/* Recently completed */}
      {completedPools.length > 0 && (
        <section className="home-section">
          <h2 className="home-section-title">Recent results</h2>
          <div className="pool-card-list">
            {completedPools.map(p => <PoolCard key={p.id} pool={p} />)}
          </div>
        </section>
      )}

      {/* My pools */}
      {groups.length > 0 && (
        <section className="home-section">
          <h2 className="home-section-title">Your pools</h2>
          <div className="group-card-list">
            {groups.map((g) => {
              const alive = g.members?.filter((m) => m.isAlive).length ?? 0;
              const total = g.members?.length ?? 0;
              return (
                <Link key={g.id} to={`/group/${g.id}`} className="group-card-item">
                  <div className="group-card-left">
                    <span className="group-card-name">🎾 {g.name}</span>
                    {total > 0 && (
                      <span className="group-card-meta">{alive} of {total} still in · {fmtGBP(g.prizePoolCents || 0)} prize</span>
                    )}
                  </div>
                  <span className="group-card-arrow">→</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="home-section join-section">
        <h2 className="home-section-title">Have an invite code?</h2>
        <p className="home-section-sub">Enter a private group invite code below.</p>
        <JoinForm />
      </section>
    </div>
  );
}

function PoolCard({ pool }) {
  const t = pool.tournament;
  const isFree = pool.entryFeeCents === 0;
  const isCompleted = t?.status === 'completed';
  const statusLabel = isCompleted ? 'Completed' : t?.status === 'active' ? 'Live' : 'Coming soon';
  const statusClass = isCompleted ? 'pool-status--completed' : t?.status === 'active' ? 'pool-status--active' : 'pool-status--upcoming';

  return (
    <Link to={`/group/${pool.id}`} className={`pool-card ${isCompleted ? 'pool-card--completed' : ''}`}>
      <div className="pool-card-top">
        <div>
          <span className={`pool-status-badge ${statusClass}`}>{statusLabel}</span>
          <h3 className="pool-card-name">{t?.name || pool.name} {t?.year}</h3>
          <p className="pool-card-meta">{t?.tourLevel} · {t?.location} · {t?.surface}</p>
        </div>
        <div className="pool-card-entry">
          {isFree
            ? <span className="pool-entry-free">Free entry</span>
            : <span className="pool-entry-paid">{fmtGBP(pool.entryFeeCents)} entry</span>
          }
        </div>
      </div>
      <div className="pool-card-bottom">
        {isCompleted && pool.memberCount > 0 && (
          <span className="pool-card-stat">{pool.aliveCount === 1 ? '🏆 1 winner' : pool.aliveCount === 0 ? 'No survivors' : `🏆 ${pool.aliveCount} survivors`} from {pool.memberCount} entries</span>
        )}
        {t?.status === 'active' && pool.memberCount > 0 && (
          <span className="pool-card-stat">{pool.aliveCount} of {pool.memberCount} still in</span>
        )}
        {t?.status === 'active' && pool.prizePoolCents > 0 && (
          <span className="pool-card-stat">{fmtGBP(pool.prizePoolCents)} prize pool</span>
        )}
        {t?.status === 'upcoming' && t?.startDate && (
          <span className="pool-card-stat">Starts {new Date(t.startDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}</span>
        )}
        {!isCompleted && !t?.drawAvailable && (
          <span className="pool-card-stat pool-card-tbc">Draw TBC</span>
        )}
        <span className="pool-card-cta">
          {isCompleted ? 'View results →' : pool.isMember ? 'Open pool →' : isFree ? 'Enter free →' : 'Enter →'}
        </span>
      </div>
    </Link>
  );
}

function SurvivorMeter({ alive, total }) {
  const eliminated = total - alive;
  // Fill the bar based on how many of the (total-1) needed eliminations have happened
  const pct = total > 1 ? Math.round((eliminated / (total - 1)) * 100) : 0;

  // Colour shifts from green → amber → red as the field narrows
  let barColour = 'var(--accent)';
  if (pct >= 80) barColour = '#dc2626';
  else if (pct >= 50) barColour = '#d97706';

  return (
    <div className="survivor-meter">
      <div className="survivor-meter-header">
        <span className="survivor-meter-label">Survivor meter</span>
        <span className="survivor-meter-counts">
          <strong>{alive}</strong> still in &nbsp;·&nbsp; <strong>{eliminated}</strong> eliminated
        </span>
      </div>
      <div className="survivor-meter-track">
        <div
          className="survivor-meter-fill"
          style={{ width: `${pct}%`, background: barColour }}
        />
      </div>
      <div className="survivor-meter-footer">
        <span>{pct}% of the field eliminated</span>
        <span>{alive === 1 ? '🏆 We have a winner!' : 'Last one standing wins the prize pool'}</span>
      </div>
    </div>
  );
}

// ── Auth modal — create account or sign in ────────────────────────────────
function AuthModal({ onClose, onSuccess, poolName, register, login }) {
  const [mode, setMode] = useState('register'); // 'register' | 'login'
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const switchMode = (m) => { setMode(m); setError(''); setPassword(''); };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'register') {
        await register(email.trim(), displayName.trim(), password);
      } else {
        await login(email.trim(), password);
      }
      onSuccess();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="auth-modal">
        <button className="auth-modal-close" onClick={onClose} aria-label="Close">✕</button>

        <div className="auth-modal-header">
          <p className="auth-modal-eyebrow">🎾 {poolName}</p>
          <h2 className="auth-modal-title">
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="auth-modal-sub">
            {mode === 'register'
              ? 'A free account lets us track your picks and keep you in the game.'
              : 'Sign in to join this pool.'}
          </p>
        </div>

        <form onSubmit={submit} className="auth-modal-form">
          <label className="auth-field-label">Email address</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="input auth-input"
            required
            autoFocus
          />

          {mode === 'register' && (
            <>
              <label className="auth-field-label">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder="How you'll appear on the leaderboard"
                className="input auth-input"
                required
                maxLength={32}
              />
            </>
          )}

          <label className="auth-field-label">
            {mode === 'register' ? 'Create a password' : 'Password'}
          </label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
            className="input auth-input"
            required
          />

          {error && <p className="error auth-error">{error}</p>}

          <button type="submit" className="btn primary btn-lg auth-submit-btn" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'register' ? 'Create account & join →' : 'Sign in & join →'}
          </button>
        </form>

        <p className="auth-toggle">
          {mode === 'register' ? (
            <>Already have an account?{' '}
              <button className="auth-toggle-btn" onClick={() => switchMode('login')}>
                Sign in
              </button>
            </>
          ) : (
            <>New here?{' '}
              <button className="auth-toggle-btn" onClick={() => switchMode('register')}>
                Create account
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function JoinForm() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError('');
    fetch(`${API}/groups/invite/${encodeURIComponent(code.trim().toUpperCase())}`)
      .then((r) => {
        if (!r.ok) throw new Error('Invalid code');
        return r.json();
      })
      .then((group) => {
        window.location.href = `/group/${group.id}`;
      })
      .catch(() => setError('Invalid invite code'))
      .finally(() => setLoading(false));
  };

  return (
    <form onSubmit={submit} className="join-form">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. FAMILY-SLAM-2026"
        className="input"
      />
      <button type="submit" className="btn primary" disabled={loading}>
        {loading ? 'Checking…' : 'Join'}
      </button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}

function fmtWindowDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    + ', '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function DeadlineCountdown({ to }) {
  const [label, setLabel] = useState('');
  const timerRef = useRef(null);

  useEffect(() => {
    const end = new Date(to);
    const tick = () => {
      const diff = end - new Date();
      if (diff <= 0) { setLabel('closed'); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      if (d > 0) setLabel(`${d}d ${h}h`);
      else if (h > 0) setLabel(`${h}h ${m}m`);
      else setLabel(`${m}m`);
    };
    tick();
    timerRef.current = setInterval(tick, 30000);
    return () => clearInterval(timerRef.current);
  }, [to]);

  return <strong>{label}</strong>;
}

// Shows the full pick window: "opens [date] → closes in [countdown]"
function PickWindow({ opensAt, lockAt }) {
  const now = new Date();
  const windowOpen = opensAt ? new Date(opensAt) <= now : true;

  if (!lockAt && !opensAt) {
    return <span>Window open — make your pick</span>;
  }

  if (!windowOpen && opensAt) {
    return (
      <span className="pick-window">
        <span className="pw-label">Pick window opens</span>
        <span className="pw-opens">{fmtWindowDate(opensAt)}</span>
      </span>
    );
  }

  return (
    <span className="pick-window">
      {opensAt && (
        <>
          <span className="pw-label">Window</span>
          <span className="pw-opens">{fmtWindowDate(opensAt)}</span>
          <span className="pw-arrow">→</span>
        </>
      )}
      {lockAt && (
        <>
          <span className="pw-closes">{fmtWindowDate(lockAt)}</span>
          <span className="pw-countdown">· closes in <DeadlineCountdown to={lockAt} /></span>
        </>
      )}
    </span>
  );
}
