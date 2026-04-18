import { useState, useEffect, useRef } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import { getTournament, TOURNAMENTS } from '../data/tournaments';
import { Hero } from '../ui/Hero.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Button } from '../ui/Button.jsx';
import { Badge, Pill } from '../ui/Badge.jsx';
import { Card } from '../ui/Card.jsx';
import { Stat } from '../ui/Stat.jsx';
import './GroupHome.css';

// ── Date + formatting helpers ─────────────────────────────────
function daysUntil(dateStr) {
  if (!dateStr) return Infinity;
  return (new Date(dateStr) - new Date()) / (1000 * 60 * 60 * 24);
}

function fmtDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  });
}

function fmtGBP(cents) {
  return '£' + (cents / 100).toLocaleString('en-GB', {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });
}

function fmtWindowDate(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  return d.toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })
    + ', '
    + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function isPreLaunch(tournament) {
  if (!tournament) return false;
  if (tournament.status === 'active') return false;
  return daysUntil(tournament.startDate) > 3;
}

// ── Avatar helpers ────────────────────────────────────────────
const AVATAR_COLOURS = [
  '#0F4A23', '#1E7A3E', '#C1572E', '#A84620',
  '#1F5580', '#7C3AED', '#B67300', '#0891B2',
];

function avatarColour(name) {
  let hash = 0;
  for (const c of (name || '')) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

function initials(name) {
  return (name || '?')
    .split(' ').map((w) => w[0] || '').join('')
    .toUpperCase().slice(0, 2);
}

// ── Icons ─────────────────────────────────────────────────────
const DrawIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
    <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"/>
  </svg>
);
const HistoryIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 0 .5-4H6"/><path d="M3 3v4h4"/>
  </svg>
);
const LeaderboardIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 20V10M12 20V4M6 20v-6"/>
  </svg>
);
const DocsIcon = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
    <polyline points="14,2 14,8 20,8"/>
    <line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>
  </svg>
);

const NAV_CARDS = [
  { to: 'pick',        Icon: DrawIcon,        title: 'Make pick',     desc: 'Pick your survivor for the current round' },
  { to: 'draw',        Icon: DrawIcon,        title: 'View draw',     desc: 'Tournament bracket & results' },
  { to: 'history',     Icon: HistoryIcon,     title: 'Pick history',  desc: 'Your past picks' },
  { to: 'leaderboard', Icon: LeaderboardIcon, title: 'Leaderboard',   desc: "Who's still in" },
];

// ── Timers ────────────────────────────────────────────────────
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

function PickWindow({ opensAt, lockAt }) {
  const now = new Date();
  const windowOpen = opensAt ? new Date(opensAt) <= now : true;

  if (!lockAt && !opensAt) {
    return <span>Window open — make your pick</span>;
  }
  if (!windowOpen && opensAt) {
    return (
      <span className="gh-pick-window">
        <span className="gh-pw-label">Pick window opens</span>
        <span className="gh-pw-value">{fmtWindowDate(opensAt)}</span>
      </span>
    );
  }
  return (
    <span className="gh-pick-window">
      {opensAt && (
        <>
          <span className="gh-pw-label">Window</span>
          <span className="gh-pw-value">{fmtWindowDate(opensAt)}</span>
          <span className="gh-pw-arrow">→</span>
        </>
      )}
      {lockAt && (
        <>
          <span className="gh-pw-value">{fmtWindowDate(lockAt)}</span>
          <span className="gh-pw-closes">· closes in <DeadlineCountdown to={lockAt} /></span>
        </>
      )}
    </span>
  );
}

// ── Survivor meter ────────────────────────────────────────────
function SurvivorMeter({ alive, total }) {
  const eliminated = total - alive;
  const pct = total > 1 ? Math.round((eliminated / (total - 1)) * 100) : 0;

  let tone = 'primary';
  if (pct >= 80) tone = 'danger';
  else if (pct >= 50) tone = 'accent';

  return (
    <Card tone="muted" padding="md" className="gh-meter">
      <div className="gh-meter-header">
        <span className="gh-meter-label">Survivor meter</span>
        <span className="gh-meter-counts">
          <strong>{alive}</strong> still in · <strong>{eliminated}</strong> eliminated
        </span>
      </div>
      <div className="gh-meter-track">
        <div className={`gh-meter-fill gh-meter-fill--${tone}`} style={{ width: `${pct}%` }} />
      </div>
      <div className="gh-meter-footer">
        <span>{pct}% of the field eliminated</span>
        <span>{alive === 1 ? '🏆 We have a winner' : 'Last one standing wins the prize pool'}</span>
      </div>
    </Card>
  );
}

// ── Auth modal (pool-scoped) ──────────────────────────────────
function AuthModal({ onClose, onSuccess, poolName, register, login }) {
  const [mode, setMode] = useState('register');
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
    <div className="ds-modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="ds-modal-card" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <header className="ds-modal-header">
          <span className="ds-modal-eyebrow">JOIN · {poolName}</span>
          <h2 className="ds-modal-title">
            {mode === 'register' ? 'Create your account' : 'Welcome back'}
          </h2>
          <button className="ds-modal-close" onClick={onClose} aria-label="Close">✕</button>
        </header>

        <div className="ds-modal-body">
          <p className="gh-auth-sub">
            {mode === 'register'
              ? 'A free account lets us track your picks and keep you in the game.'
              : 'Sign in to join this pool.'}
          </p>

          <div className="ds-modal-tabs" role="tablist">
            <button
              role="tab"
              aria-selected={mode === 'register'}
              className={`ds-modal-tab${mode === 'register' ? ' is-active' : ''}`}
              onClick={() => switchMode('register')}
            >
              Create account
            </button>
            <button
              role="tab"
              aria-selected={mode === 'login'}
              className={`ds-modal-tab${mode === 'login' ? ' is-active' : ''}`}
              onClick={() => switchMode('login')}
            >
              Sign in
            </button>
          </div>

          <form onSubmit={submit} className="ds-modal-form">
            <label className="ds-field">
              <span className="ds-field-label">Email</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="ds-input"
                required
                autoFocus
              />
            </label>

            {mode === 'register' && (
              <label className="ds-field">
                <span className="ds-field-label">Display name</span>
                <input
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="How you'll appear on the leaderboard"
                  className="ds-input"
                  required
                  maxLength={32}
                />
              </label>
            )}

            <label className="ds-field">
              <span className="ds-field-label">
                {mode === 'register' ? 'Create a password' : 'Password'}
              </span>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'Min. 8 characters' : 'Your password'}
                className="ds-input"
                required
              />
            </label>

            {error && <p className="ds-form-error">{error}</p>}

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              {mode === 'register' ? 'Create account & join →' : 'Sign in & join →'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Invite code form ──────────────────────────────────────────
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
    <form onSubmit={submit} className="gh-join-form">
      <input
        type="text"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="e.g. FAMILY-SLAM-2026"
        className="ds-input"
      />
      <Button type="submit" variant="primary" loading={loading}>
        Join
      </Button>
      {error && <p className="ds-form-error">{error}</p>}
    </form>
  );
}

// ── Main component ───────────────────────────────────────────
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
  const [joinAfterAuth, setJoinAfterAuth] = useState(false);
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');
  const [lbData, setLbData] = useState(null);

  useEffect(() => {
    if (groupId) {
      fetch(`${API}/groups/${groupId}`)
        .then((r) => r.json())
        .then(setGroup)
        .catch(() => setGroup(null))
        .finally(() => setLoading(false));
    } else {
      Promise.all([
        fetch(`${API}/pools?userId=${userId}`).then(r => r.json()).catch(() => []),
        fetch(`${API}/groups?userId=${userId}`).then(r => r.json()).catch(() => []),
      ]).then(([pools, myGroups]) => {
        setAllPools(Array.isArray(pools) ? pools : []);
        setGroups(Array.isArray(myGroups) ? myGroups : []);
      }).finally(() => setLoading(false));
    }
  }, [groupId, userId]);

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
        const r1 = deadlines.find((d) => d.round === 'R1');
        if (r1?.lockAt) setR1LockAt(r1.lockAt);
      })
      .catch(() => {});
  }, []);

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

  useEffect(() => {
    if (!groupId) return;
    const tournament = group ? getTournament(group.tournamentId) : null;
    if (tournament?.status !== 'completed') return;
    fetch(`${API}/leaderboard/${groupId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setLbData)
      .catch(() => {});
  }, [groupId, group]);

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
        if (res.status === 402 && d.code === 'PAYMENT_REQUIRED') {
          navigate(`/group/${group.id}/pay`);
          return;
        }
        throw new Error(d.error || 'Could not join');
      }
      const updated = await fetch(`${API}/groups/${group.id}`).then(r => r.json());
      setGroup(updated);
    } catch (e) {
      setJoinError(e.message);
    } finally {
      setJoining(false);
    }
  };

  useEffect(() => {
    if (joinAfterAuth && isRegistered && userId && group) {
      setJoinAfterAuth(false);
      joinGroup(userId, user?.displayName || 'Player');
    }
  }, [joinAfterAuth, isRegistered, userId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <Section tone="canvas" size="lg">
        <p className="gh-loading">Loading…</p>
      </Section>
    );
  }

  // ── Group dashboard ────────────────────────────────────────
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

    const tournament  = getTournament(group.tournamentId);
    const preLaunch   = isPreLaunch(tournament);
    const isCompleted = tournament?.status === 'completed';
    const entryDeadline = r1LockAt
      ? new Date(new Date(r1LockAt).getTime() - 60 * 60 * 1000)
      : null;
    const isEntryClosed = isCompleted || tournament?.entryOpen === false
      || (entryDeadline && new Date() >= entryDeadline);

    const msUntilDeadline = openRoundDeadline ? new Date(openRoundDeadline) - new Date() : Infinity;
    const closingSoon = !isCompleted && openRound && openRound !== 'R1' && !myCurrentPick && msUntilDeadline > 0 && msUntilDeadline < 24 * 60 * 60 * 1000;
    const r1NoPick = !isCompleted && openRound === 'R1' && !myCurrentPick;

    const lbWinners = lbData ? (lbData.leaderboard || []).filter(m => m.isWinner) : [];
    const winners = lbWinners.length > 0
      ? lbWinners
      : (isCompleted ? (group.members || []).filter(m => m.isAlive) : []);

    // ── Pre-launch NON-MEMBER view ──────────────────────────
    if (preLaunch && tournament && !isMember) {
      const startDate    = tournament.startDate;
      const startDateFmt = fmtDate(startDate);
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
        <div className="gh-page">
          {showAuthModal && (
            <AuthModal
              onClose={() => { setShowAuthModal(false); setJoinAfterAuth(false); }}
              onSuccess={() => setShowAuthModal(false)}
              poolName={group.name}
              register={register}
              login={login}
            />
          )}

          <Hero
            tone="primary"
            compact
            showCourt
            eyebrow={`${tournament.name.toUpperCase()} ${tournament.year} · ${tournament.tourLevel.toUpperCase()}`}
            title={<>{group.name}</>}
            lede={`${tournament.location} · ${tournament.surface} · Starts ${startDateFmt}.`}
            meta={
              <>
                <Stat size="sm" tone="gold" label="Entry" value={isFree ? 'Free' : fmtGBP(group.entryFeeCents)} />
                <Stat size="sm" label="Starts" value={startDateFmt} />
                <Stat size="sm" label="Registered" value={totalMembers} />
              </>
            }
          />

          <Section tone="canvas" size="md">
            <SectionHeader
              eyebrow="TIMELINE"
              title={<>What happens <em>next</em>.</>}
            />

            <ol className="gh-timeline">
              <li className="gh-timeline-step gh-timeline-step--done">
                <span className="gh-timeline-dot" aria-hidden="true">✓</span>
                <div className="gh-timeline-body">
                  <span className="gh-timeline-label">Registration open</span>
                  <span className="gh-timeline-sub">Join now to secure your spot</span>
                </div>
              </li>
              <li className="gh-timeline-step">
                <span className="gh-timeline-dot" aria-hidden="true" />
                <div className="gh-timeline-body">
                  <span className="gh-timeline-label">Draw released</span>
                  <span className="gh-timeline-sub">{drawDateFmt} · pick window opens</span>
                </div>
              </li>
              <li className="gh-timeline-step">
                <span className="gh-timeline-dot" aria-hidden="true" />
                <div className="gh-timeline-body">
                  <span className="gh-timeline-label">Tournament begins</span>
                  <span className="gh-timeline-sub">{startDateFmt} · {tournament.location}</span>
                </div>
              </li>
            </ol>

            <div className="gh-join-cta">
              {isEntryClosed ? (
                <Card tone="muted" padding="lg" className="gh-notice-card">
                  <div className="gh-notice-icon" aria-hidden="true">🔒</div>
                  <p className="gh-notice-title">This tournament hasn't launched yet</p>
                  <p className="gh-notice-sub">
                    {tournament.entryOpenDate
                      ? `Entries are expected to open around ${fmtDate(tournament.entryOpenDate)}, once the draw is released.`
                      : 'Check back when the draw is released.'}
                  </p>
                </Card>
              ) : (
                <>
                  <Button
                    variant="primary"
                    size="lg"
                    loading={joining}
                    onClick={handleJoinClick}
                  >
                    {isFree ? 'Join free →' : `Join for ${fmtGBP(group.entryFeeCents)} →`}
                  </Button>
                  <p className="gh-cta-hint">
                    {isRegistered
                      ? `Joining as ${user.displayName}`
                      : "You'll create a free account to join"}
                  </p>
                  {joinError && <p className="ds-form-error">{joinError}</p>}
                </>
              )}
            </div>
          </Section>
        </div>
      );
    }

    // ── Pre-launch MEMBER view (registered, waiting on draw) ──
    if (preLaunch && tournament && isMember) {
      const drawDateStr  = tournament.drawDate
        || new Date(new Date(tournament.startDate) - 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const drawDateFmt  = fmtDate(drawDateStr);

      return (
        <div className="gh-page">
          <Hero
            tone="primary"
            compact
            showCourt
            eyebrow={`${tournament.name.toUpperCase()} ${tournament.year} · REGISTERED`}
            title={<>{group.name}</>}
            lede={`You're in. The draw drops on ${drawDateFmt} — we'll open picks automatically.`}
            meta={
              <>
                <Stat size="sm" tone="gold" label="Prize pool" value={fmtGBP(group.prizePoolCents || 0)} />
                <Stat size="sm" label="Registered" value={totalMembers} />
                <Stat size="sm" label="Starts" value={fmtDate(tournament.startDate)} />
              </>
            }
          />

          <Section tone="canvas" size="md">
            <Card tone="primary" padding="md" className="gh-registered-card">
              <span className="gh-registered-icon" aria-hidden="true">✓</span>
              <div className="gh-registered-body">
                <p className="gh-registered-label">You're registered</p>
                <p className="gh-registered-sub">
                  The draw is released on {drawDateFmt} — your pick window opens then.
                </p>
              </div>
            </Card>

            <SectionHeader
              eyebrow="ENTRANTS"
              title={<>Who's <em>in</em>.</>}
            />

            <div className="gh-table-wrap">
              <table className="gh-table">
                <thead>
                  <tr>
                    <th>Player</th>
                    <th className="gh-th-status">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(group.members || []).map((m) => {
                    const isYou = m.userId === userId;
                    return (
                      <tr key={m.id || m.userId} className={isYou ? 'gh-row--you' : ''}>
                        <td className="gh-td-player">
                          <span className="gh-avatar" style={{ background: avatarColour(m.displayName) }}>
                            {initials(m.displayName)}
                          </span>
                          <span className="gh-display-name">{m.displayName}</span>
                          {isYou && <Badge tone="primary" size="sm">You</Badge>}
                        </td>
                        <td className="gh-td-status">
                          <Badge tone="success" size="sm" dot>Registered</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Card tone="muted" padding="md" className="gh-invite-card">
              <span className="gh-invite-label">Invite friends</span>
              <div className="gh-invite-row">
                <code className="gh-invite-code">{inviteUrl}</code>
                <Button
                  variant={copied ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={copyInvite}
                >
                  {copied ? '✓ Copied' : 'Copy link'}
                </Button>
              </div>
            </Card>
          </Section>
        </div>
      );
    }

    // ── Completed tournament ────────────────────────────────
    if (isCompleted && tournament) {
      const nextT = TOURNAMENTS.find(t => t.status === 'upcoming' && t.id !== tournament.id);

      return (
        <div className="gh-page">
          <Hero
            tone="gold"
            compact
            showCourt
            eyebrow={`${tournament.name.toUpperCase()} ${tournament.year} · COMPLETE`}
            title={<>{group.name}</>}
            lede="Tournament complete. Final standings below."
            meta={
              <>
                <Stat size="sm" tone="gold" label="Prize pool" value={fmtGBP(group.prizePoolCents || 0)} />
                <Stat size="sm" label={winners.length === 1 ? 'Winner' : 'Winners'} value={winners.length || 0} />
                <Stat size="sm" label="Entered" value={totalMembers} />
              </>
            }
          />

          <Section tone="canvas" size="md">
            <div className="gh-winner-wrap">
              {winners.length === 1 ? (
                <Card tone="gold" padding="lg" className="gh-winner-card">
                  <div className="gh-winner-trophy" aria-hidden="true">🏆</div>
                  <h2 className="gh-winner-name">{winners[0].displayName}</h2>
                  <p className="gh-winner-subtitle">
                    {winners[0].isAlive
                      ? 'Winner — last one standing'
                      : `Winner — lasted the longest from ${totalMembers} entrants`}
                  </p>
                  {group.prizePoolCents > 0 && (
                    <p className="gh-winner-prize">
                      Takes the <strong>{fmtGBP(group.prizePoolCents)}</strong> prize pool
                    </p>
                  )}
                </Card>
              ) : winners.length === 2 ? (
                <Card tone="gold" padding="lg" className="gh-winner-card">
                  <div className="gh-winner-trophy" aria-hidden="true">🏆</div>
                  <h2 className="gh-winner-name">{winners[0].displayName} &amp; {winners[1].displayName}</h2>
                  <p className="gh-winner-subtitle">Joint winners — prize shared</p>
                  {group.prizePoolCents > 0 && (
                    <p className="gh-winner-prize">
                      {fmtGBP(group.prizePoolCents)} prize pool split 2 ways ({fmtGBP(Math.floor(group.prizePoolCents / 2))} each)
                    </p>
                  )}
                </Card>
              ) : winners.length > 2 ? (
                <Card tone="gold" padding="lg" className="gh-winner-card">
                  <div className="gh-winner-trophy" aria-hidden="true">🏆</div>
                  <h2 className="gh-winner-name">{winners.length} joint winners</h2>
                  <Link to={`/group/${groupId}/leaderboard`} className="gh-winner-link">
                    See who won →
                  </Link>
                  {group.prizePoolCents > 0 && (
                    <p className="gh-winner-prize">
                      {fmtGBP(group.prizePoolCents)} prize pool split {winners.length} ways
                    </p>
                  )}
                </Card>
              ) : (
                <Card tone="muted" padding="lg" className="gh-winner-card">
                  <div className="gh-winner-trophy" aria-hidden="true">😮</div>
                  <h2 className="gh-winner-name">No survivors</h2>
                  <p className="gh-winner-subtitle">Everyone was eliminated — nobody beat the draw.</p>
                </Card>
              )}
            </div>

            <div className="gh-nav-grid">
              <Link to={`/group/${groupId}/leaderboard`} className="gh-nav-card">
                <span className="gh-nav-icon" aria-hidden="true"><LeaderboardIcon /></span>
                <span className="gh-nav-title">Final standings</span>
                <span className="gh-nav-desc">Full leaderboard</span>
              </Link>
              <Link to={`/group/${groupId}/draw`} className="gh-nav-card">
                <span className="gh-nav-icon" aria-hidden="true"><DrawIcon /></span>
                <span className="gh-nav-title">View draw</span>
                <span className="gh-nav-desc">Tournament bracket &amp; results</span>
              </Link>
              <Link to={`/group/${groupId}/history`} className="gh-nav-card">
                <span className="gh-nav-icon" aria-hidden="true"><HistoryIcon /></span>
                <span className="gh-nav-title">Pick history</span>
                <span className="gh-nav-desc">Review your picks</span>
              </Link>
            </div>

            {nextT && (
              <Card tone="primary" padding="lg" className="gh-next-card">
                <span className="gh-next-eyebrow">NEXT UP</span>
                <h3 className="gh-next-title">{nextT.name} {nextT.year}</h3>
                <p className="gh-next-meta">
                  {nextT.tourLevel} · {nextT.location} · Starts {fmtDate(nextT.startDate)}
                </p>
                <Button as={Link} to="/" variant="gold" size="lg">
                  View upcoming pools →
                </Button>
              </Card>
            )}
          </Section>
        </div>
      );
    }

    // ── Active tournament (member or non-member) ───────────
    return (
      <div className="gh-page">
        <Hero
          tone="primary"
          compact
          showCourt
          eyebrow={
            tournament
              ? `${tournament.name.toUpperCase()} ${tournament.year} · ${tournament.tourLevel.toUpperCase()}`
              : 'FINAL SERVE-IVOR'
          }
          title={<>{group.name}</>}
          lede={
            aliveMembers === 1
              ? 'Down to one — final stretch.'
              : 'Updated live as results come in.'
          }
          meta={
            <>
              <Stat size="sm" tone="gold" label="Prize pool" value={fmtGBP(group.prizePoolCents)} />
              <Stat size="sm" label="Entry fee" value={fmtGBP(group.entryFeeCents)} />
              {totalMembers > 0 && (
                <Stat size="sm" label="Still in" value={<>{aliveMembers}<span className="gh-stat-total"> / {totalMembers}</span></>} />
              )}
            </>
          }
        />

        <Section tone="canvas" size="md">
          {/* Urgency banners */}
          {closingSoon && (
            <div className="gh-banner gh-banner--urgent">
              <span className="gh-banner-icon" aria-hidden="true">⚠️</span>
              <span className="gh-banner-text">
                <strong>Deadline closing soon.</strong>{' '}
                <DeadlineCountdown to={openRoundDeadline} /> left to pick for <strong>{openRound}</strong>.
              </span>
              <Button as={Link} to={`/group/${groupId}/pick`} variant="primary" size="sm">
                Pick now →
              </Button>
            </div>
          )}
          {r1NoPick && (
            <div className="gh-banner gh-banner--info">
              <span className="gh-banner-icon" aria-hidden="true">🎾</span>
              <span className="gh-banner-text">
                <strong>R1 is open.</strong>{' '}
                Pick any player before their match starts. Players are removed from the list as matches begin.
              </span>
              <Button as={Link} to={`/group/${groupId}/pick`} variant="primary" size="sm">
                Make your pick →
              </Button>
            </div>
          )}

          {totalMembers > 1 && (
            <SurvivorMeter alive={aliveMembers} total={totalMembers} />
          )}

          {!isMember ? (
            <div className="gh-join-cta">
              {isEntryClosed ? (
                <Card tone="muted" padding="lg" className="gh-notice-card">
                  <div className="gh-notice-icon" aria-hidden="true">🎾</div>
                  <p className="gh-notice-title">Entry period is over</p>
                  <p className="gh-notice-sub">
                    {tournament?.name || 'This tournament'} is already underway — new entries are no longer accepted.
                  </p>
                  <Button as={Link} to={`/group/${groupId}/leaderboard`} variant="primary" size="lg">
                    View leaderboard →
                  </Button>
                </Card>
              ) : (
                <Button as={Link} to={`/join/${group.inviteCode}`} variant="primary" size="lg">
                  Join this pool
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="gh-pick-cta">
                {myCurrentPick ? (
                  <Card tone="primary" padding="md" className="gh-pick-done">
                    <span className="gh-pick-done-icon" aria-hidden="true">✓</span>
                    <div className="gh-pick-done-body">
                      <span className="gh-pick-done-label">{openRound} pick locked in</span>
                      <span className="gh-pick-done-player">{myCurrentPick.playerName}</span>
                    </div>
                    <Button as={Link} to={`/group/${groupId}/pick`} variant="ghost" size="sm">
                      View picks
                    </Button>
                  </Card>
                ) : (
                  <>
                    <Button as={Link} to={`/group/${groupId}/pick`} variant="primary" size="lg">
                      {openRound ? `Pick for ${openRound} →` : 'Make your pick →'}
                    </Button>
                    {openRound === 'R1' ? (
                      <p className="gh-cta-hint">
                        No deadline for R1. Players are removed as their match starts, so pick before your player begins.
                      </p>
                    ) : openRound ? (
                      <p className="gh-cta-hint">
                        <PickWindow opensAt={openRoundOpensAt} lockAt={openRoundDeadline} />
                      </p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="gh-nav-grid">
                {NAV_CARDS.map(({ to, Icon, title, desc }) => (
                  <Link key={to} to={`/group/${groupId}/${to}`} className="gh-nav-card">
                    <span className="gh-nav-icon" aria-hidden="true"><Icon /></span>
                    <span className="gh-nav-title">{title}</span>
                    <span className="gh-nav-desc">{desc}</span>
                  </Link>
                ))}
                <Link to="/terms" className="gh-nav-card">
                  <span className="gh-nav-icon" aria-hidden="true"><DocsIcon /></span>
                  <span className="gh-nav-title">Terms &amp; Conditions</span>
                  <span className="gh-nav-desc">Rules and entry terms</span>
                </Link>
              </div>

              <Card tone="muted" padding="md" className="gh-invite-card">
                <span className="gh-invite-label">Invite friends</span>
                <div className="gh-invite-row">
                  <code className="gh-invite-code">{inviteUrl}</code>
                  <Button
                    variant={copied ? 'secondary' : 'primary'}
                    size="sm"
                    onClick={copyInvite}
                  >
                    {copied ? '✓ Copied' : 'Copy link'}
                  </Button>
                </div>
              </Card>
            </>
          )}
        </Section>
      </div>
    );
  }

  if (groupId && !group) {
    return (
      <div className="gh-page">
        <Section tone="canvas" size="md">
          <Card tone="muted" padding="lg" className="gh-notice-card">
            <p className="gh-notice-title">Pool not found</p>
            <Button as={Link} to="/" variant="ghost" size="sm">
              ← Back to home
            </Button>
          </Card>
        </Section>
      </div>
    );
  }

  // ── Lobby fallback (route: /group with no id — unreachable in practice) ──
  const activePools    = allPools.filter(p => p.tournament?.status === 'active');
  const upcomingPools  = allPools.filter(p => p.tournament?.status === 'upcoming');
  const completedPools = allPools.filter(p => p.tournament?.status === 'completed');

  return (
    <div className="gh-page">
      <Hero
        tone="primary"
        showCourt
        eyebrow="🎾 YEAR-ROUND ATP TENNIS PREDICTION"
        title={<>Final <em>Serve-ivor</em></>}
        lede="Pick one player per round. If they win, you survive. Last one standing takes the prize."
      />

      <Section tone="canvas" size="md">
        <SectionHeader eyebrow="HOW IT WORKS" title={<>Three <em>simple</em> steps.</>} />
        <div className="gh-hiw-grid">
          <Card tone="muted" padding="md">
            <Pill tone="primary" size="md">1</Pill>
            <h3 className="gh-hiw-title">Enter a pool</h3>
            <p className="gh-hiw-desc">Join an open tournament pool below, or use a friend's invite code to enter their private group.</p>
          </Card>
          <Card tone="muted" padding="md">
            <Pill tone="primary" size="md">2</Pill>
            <h3 className="gh-hiw-title">Pick one player</h3>
            <p className="gh-hiw-desc">Each round, pick any player you predict will win. You can never pick the same player twice.</p>
          </Card>
          <Card tone="muted" padding="md">
            <Pill tone="primary" size="md">3</Pill>
            <h3 className="gh-hiw-title">Last one standing wins</h3>
            <p className="gh-hiw-desc">If your player loses, you're out. Outlast everyone else and take the entire prize pool.</p>
          </Card>
        </div>

        {activePools.length > 0 && (
          <>
            <SectionHeader eyebrow="OPEN NOW" title={<>Live <em>pools</em>.</>} />
            <div className="gh-pools-grid">
              {activePools.map(p => <LobbyPoolCard key={p.id} pool={p} />)}
            </div>
          </>
        )}

        {upcomingPools.length > 0 && (
          <>
            <SectionHeader eyebrow="COMING SOON" title={<>What's <em>next</em>.</>} />
            <div className="gh-pools-grid">
              {upcomingPools.map(p => <LobbyPoolCard key={p.id} pool={p} />)}
            </div>
          </>
        )}

        {completedPools.length > 0 && (
          <>
            <SectionHeader eyebrow="RECENT RESULTS" title={<>In the <em>books</em>.</>} />
            <div className="gh-pools-grid">
              {completedPools.map(p => <LobbyPoolCard key={p.id} pool={p} />)}
            </div>
          </>
        )}

        {groups.length > 0 && (
          <>
            <SectionHeader eyebrow="YOUR POOLS" title={<>Back to the <em>pools</em> you're in.</>} />
            <div className="gh-my-groups">
              {groups.map((g) => {
                const alive = g.members?.filter((m) => m.isAlive).length ?? 0;
                const total = g.members?.length ?? 0;
                return (
                  <Link key={g.id} to={`/group/${g.id}`} className="gh-my-group">
                    <div className="gh-my-group-left">
                      <span className="gh-my-group-name">🎾 {g.name}</span>
                      {total > 0 && (
                        <span className="gh-my-group-meta">
                          {alive} of {total} still in · {fmtGBP(g.prizePoolCents || 0)} prize
                        </span>
                      )}
                    </div>
                    <span className="gh-my-group-arrow" aria-hidden="true">→</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        <Card tone="primary" padding="lg" className="gh-invite-section">
          <SectionHeader
            eyebrow="INVITE CODE"
            title={<>Have an <em>invite code</em>?</>}
            kicker="Enter a private group invite code to join friends."
          />
          <JoinForm />
        </Card>
      </Section>
    </div>
  );
}

// ── Lobby pool card ───────────────────────────────────────────
function LobbyPoolCard({ pool }) {
  const t = pool.tournament;
  const isFree = pool.entryFeeCents === 0;
  const isCompleted = t?.status === 'completed';
  const statusLabel = isCompleted ? 'Completed' : t?.status === 'active' ? 'Live' : 'Coming soon';
  const statusTone = isCompleted ? 'neutral' : t?.status === 'active' ? 'success' : 'info';

  return (
    <Link to={`/group/${pool.id}`} className="gh-pool-card">
      <div className="gh-pool-card-top">
        <div className="gh-pool-card-titles">
          <Badge tone={statusTone} size="sm" dot={!isCompleted}>{statusLabel}</Badge>
          <h3 className="gh-pool-card-name">{t?.name || pool.name} {t?.year}</h3>
          <p className="gh-pool-card-meta">{t?.tourLevel} · {t?.location} · {t?.surface}</p>
        </div>
        <div className="gh-pool-card-entry">
          {isFree
            ? <span className="gh-pool-entry-free">Free</span>
            : <span className="gh-pool-entry-paid">{fmtGBP(pool.entryFeeCents)}</span>
          }
        </div>
      </div>
      <div className="gh-pool-card-bottom">
        {isCompleted && pool.memberCount > 0 && (
          <span className="gh-pool-card-stat">
            {pool.winnerName
              ? `🏆 ${pool.winnerName} won`
              : pool.aliveCount === 1 ? '🏆 1 winner'
              : pool.aliveCount === 0 ? 'No survivors'
              : `🏆 ${pool.aliveCount} survivors`} from {pool.memberCount} entries
          </span>
        )}
        {t?.status === 'active' && pool.memberCount > 0 && (
          <span className="gh-pool-card-stat">{pool.aliveCount} of {pool.memberCount} still in</span>
        )}
        {t?.status === 'active' && pool.prizePoolCents > 0 && (
          <span className="gh-pool-card-stat">{fmtGBP(pool.prizePoolCents)} prize pool</span>
        )}
        {t?.status === 'upcoming' && t?.startDate && (
          <span className="gh-pool-card-stat">
            Starts {new Date(t.startDate).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {!isCompleted && !t?.drawAvailable && (
          <span className="gh-pool-card-stat gh-pool-card-tbc">Draw TBC</span>
        )}
        <span className="gh-pool-card-cta">
          {isCompleted ? 'View results →' : pool.isMember ? 'Open pool →' : isFree ? 'Enter free →' : 'Enter →'}
        </span>
      </div>
    </Link>
  );
}
