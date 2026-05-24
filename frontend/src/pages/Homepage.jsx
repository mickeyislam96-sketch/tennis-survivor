import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth, API } from '../App';
import { Button } from '../ui/Button.jsx';
import { Card } from '../ui/Card.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Pill } from '../ui/Badge.jsx';
import { Section, SectionHeader } from '../ui/Section.jsx';
import { Hero } from '../ui/Hero.jsx';
import { PoolCard } from '../ui/PoolCard.jsx';
import { Stat } from '../ui/Stat.jsx';
import './Homepage.css';

const fmtGBP = (cents) => `£${(cents / 100).toFixed(0)}`;
const fmtDateRange = (start, end) => {
  if (!start) return '';
  const s = new Date(start);
  const sMonth = s.toLocaleDateString('en-GB', { month: 'short' });
  const sDay = s.getDate();
  if (!end) return `${sMonth} ${sDay}`;
  const e = new Date(end);
  const eMonth = e.toLocaleDateString('en-GB', { month: 'short' });
  const eDay = e.getDate();
  if (eMonth !== sMonth) return `${sMonth} ${sDay} – ${eMonth} ${eDay}`;
  return `${sMonth} ${sDay} – ${eDay}`;
};

const HOW_IT_WORKS = [
  {
    step: 1,
    title: 'Pick one player, one time',
    body: 'Each round, pick a player you think will win their next match. Once you use a player, you cannot pick them again the whole tournament.',
  },
  {
    step: 2,
    title: 'Survive every round',
    body: 'If your pick wins, you move on. If they lose, you are out.',
  },
  {
    step: 3,
    title: 'Last one standing wins the pot',
    body: 'The last one standing wins the pool. In paid pools, that win is the entire prize pot.',
  },
];

function PoolsGrid({ pools, emptyMsg, showDescription = true }) {
  if (!pools?.length) return <p className="hp-empty">{emptyMsg}</p>;
  return (
    <div className="hp-pool-grid">
      {pools.map((pool) => {
        const t = pool.tournament;
        const isFree = pool.entryFeeCents === 0;
        const isCompleted = t?.status === 'completed';
        const isActive = t?.status === 'active';

        const status = isCompleted
          ? { label: 'Completed', tone: 'neutral' }
          : isActive
            ? { label: pool.entryOpen === false ? 'Live · entry closed' : 'Live', tone: 'primary', dot: true }
            : { label: 'Coming soon', tone: 'warning' };

        const meta = [];
        if (pool.prizePoolCents > 0) {
          meta.push(<Stat size="sm" tone="gold" label="Prize pool" value={fmtGBP(pool.prizePoolCents)} />);
        }
        meta.push(
          <Stat
            size="sm"
            label={isFree ? 'Entry' : 'Entry fee'}
            value={isFree ? 'Free' : fmtGBP(pool.entryFeeCents)}
          />
        );
        if (pool.memberCount != null) {
          meta.push(
            <Stat
              size="sm"
              label={isActive ? 'Alive' : isCompleted ? 'Finished' : 'Entries'}
              value={isActive ? `${pool.aliveCount}/${pool.memberCount}` : pool.memberCount}
            />
          );
        }
        if (t?.startDate && !isCompleted) {
          meta.push(
            <Stat size="sm" label="Starts" value={fmtDateRange(t.startDate, t.endDate)} />
          );
        }

        const description = showDescription
          ? [t?.tourLevel, t?.location, t?.surface].filter(Boolean).join(' · ')
          : null;

        const isEntryClosed = pool.entryOpen === false;
        const ctaLabel = isCompleted
          ? 'View results'
          : pool.isMember
            ? 'Open pool'
            : isEntryClosed
              ? 'View leaderboard'
              : isFree
                ? 'Enter free'
                : 'Enter';

        return (
          <Link key={pool.id} to={`/group/${pool.id}`} className="hp-pool-card-link">
            <PoolCard
              eyebrow={t?.year ? `${t.tourLevel || 'TOUR'} · ${t.year}` : t?.tourLevel}
              title={<>{t?.name || pool.name}</>}
              status={status}
              meta={meta}
              description={description}
              footer={
                isCompleted && pool.winnerName ? (
                  <span>Winner: <strong style={{ color: 'var(--ds-gold-deep)' }}>{pool.winnerName}</strong></span>
                ) : isActive && pool.aliveCount === 1 ? (
                  <span>One survivor left</span>
                ) : isActive && isEntryClosed ? (
                  <span>{pool.aliveCount}/{pool.memberCount} still in</span>
                ) : !isActive && !isCompleted && pool.entryFeeCents === 0 ? (
                  <span>Free entry — sign up now</span>
                ) : (
                  <span>{pool.memberCount || 0} entries</span>
                )
              }
              cta={
                <Button variant={isCompleted ? 'ghost' : 'primary'} size="sm">
                  {ctaLabel} →
                </Button>
              }
              interactive
            />
          </Link>
        );
      })}
    </div>
  );
}

export function Homepage() {
  const navigate = useNavigate();
  const { userId, user, authFetch } = useAuth();
  const [allPools, setAllPools] = useState([]);
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [joinBusy, setJoinBusy] = useState(false);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/pools${userId ? `?userId=${userId}` : ''}`).then((r) => r.json()).catch(() => []),
      userId
        ? authFetch(`${API}/groups?userId=${userId}`).then((r) => r.json()).catch(() => [])
        : Promise.resolve([]),
    ])
      .then(([pools, groups]) => {
        setAllPools(Array.isArray(pools) ? pools : []);
        setMyGroups(Array.isArray(groups) ? groups : []);
      })
      .finally(() => setLoading(false));
  }, [userId]);

  const eligiblePools = allPools
    .filter((p) => ['upcoming', 'active'].includes(p.tournament?.status))
    .sort((a, b) => {
      // Active tournaments first, then upcoming (sorted by start date)
      const statusOrder = { active: 0, upcoming: 1 };
      const aOrder = statusOrder[a.tournament?.status] ?? 2;
      const bOrder = statusOrder[b.tournament?.status] ?? 2;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return new Date(a.tournament?.startDate || 0) - new Date(b.tournament?.startDate || 0);
    });
  // Pools accepting entries: backend's entryOpen flag is the source of truth.
  // Falls back to the legacy "any active or upcoming" rule for older API
  // responses that don't include the flag yet (defence against stale clients).
  const openPools = eligiblePools.filter((p) =>
    p.entryOpen === undefined ? true : p.entryOpen === true
  );
  // Active pools whose entry window has closed — show them in their own
  // "Live now" section with a View CTA instead of Enter.
  const liveClosedPools = eligiblePools.filter((p) =>
    p.tournament?.status === 'active' && p.entryOpen === false
  );
  const completedPools = allPools.filter((p) => p.tournament?.status === 'completed');
  // Hero featured: prefer a live-but-closed pool (so the hero links to the
  // current event) if the open list has nothing live in it. Otherwise the
  // first open pool wins.
  const featured = openPools[0] || liveClosedPools[0];
  const featuredIsLive = featured?.tournament?.status === 'active';
  const featuredEntryOpen = featured?.entryOpen !== false;

  const handleJoin = async (e) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setJoinBusy(true);
    setJoinError('');
    try {
      const res = await fetch(
        `${API}/groups/invite/${encodeURIComponent(joinCode.trim().toUpperCase())}`
      );
      if (!res.ok) throw new Error("That invite code doesn't match any pool. Double-check the code or ask your friend to resend it.");
      const group = await res.json();
      navigate(`/join/${group.inviteCode}`);
    } catch (err) {
      setJoinError(err.message || 'Something went wrong. Please try again in a moment.');
    } finally {
      setJoinBusy(false);
    }
  };

  // ── HERO ─────────────────────────────────────────────────────────────
  const heroCtaVerb = featured?.isMember || featuredIsLive
    ? 'View'
    : featuredEntryOpen
      ? 'Enter'
      : 'View';
  const heroCta = featured ? (
    <>
      <Button
        as={Link}
        to={`/group/${featured.id}`}
        variant="gold"
        size="lg"
      >
        {heroCtaVerb} {featured.tournament?.name} →
      </Button>
      <Button as={Link} to="/how-to-play" variant="ghost" size="lg">
        How it works
      </Button>
    </>
  ) : (
    <Button as={Link} to="/how-to-play" variant="gold" size="lg">
      See how it works →
    </Button>
  );

  const heroFeaturedLabel = featuredIsLive
    ? 'Live now'
    : 'Next tournament';
  const heroMeta = featured ? (
    <>
      <Stat
        size="sm"
        tone="gold"
        label={heroFeaturedLabel}
        value={featured.tournament?.name || ''}
      />
      <Stat
        size="sm"
        label="Dates"
        value={fmtDateRange(featured.tournament?.startDate, featured.tournament?.endDate) || 'TBC'}
      />
      <Stat
        size="sm"
        label="Entry"
        value={featured.entryFeeCents === 0 ? 'Free' : fmtGBP(featured.entryFeeCents)}
      />
    </>
  ) : null;

  return (
    <div className="hp">
      <Hero
        tone="primary"
        eyebrow="A TENNIS SURVIVOR POOL"
        title={<><em>Survive</em> the draw. Take the pot.</>}
        lede="Pick a player each round. If they win, you advance. If they lose, you are out. Last one standing wins the prize pot."
        actions={heroCta}
        meta={heroMeta}
      />

      {/* ── Your pools (signed-in only) ─────────────────────── */}
      {user && myGroups.length > 0 && (
        <Section tone="surface" size="md">
          <SectionHeader
            eyebrow="YOUR POOLS"
            title={<>Pick up where you <em>left off</em>.</>}
          />
          <div className="hp-my-groups">
            {myGroups.map((g) => {
              const alive = g.members?.filter((m) => m.isAlive).length ?? 0;
              const total = g.members?.length ?? 0;
              return (
                <Link
                  key={g.id}
                  to={`/group/${g.id}`}
                  className="hp-my-group-card"
                >
                  <div>
                    <p className="hp-my-group-eyebrow">POOL</p>
                    <h3 className="hp-my-group-title">{g.name}</h3>
                    {total > 0 && (
                      <p className="hp-my-group-meta">
                        {alive} of {total} still in · {fmtGBP(g.prizePoolCents || 0)} prize
                      </p>
                    )}
                  </div>
                  <span className="hp-my-group-arrow">→</span>
                </Link>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── LIVE NOW (active, entry closed) ────────────────── */}
      {!loading && liveClosedPools.length > 0 && (
        <Section tone="canvas" size="lg">
          <SectionHeader
            eyebrow="LIVE NOW"
            title={<>Tournaments <em>underway</em>.</>}
            kicker="Entry has closed for these. Watch the survivors fight it out."
          />
          <PoolsGrid pools={liveClosedPools} emptyMsg="" />
        </Section>
      )}

      {/* ── OPEN NOW ────────────────────────────────────────── */}
      <Section tone="canvas" size="lg">
        <SectionHeader
          eyebrow="OPEN NOW"
          title={<>Pools accepting <em>entries</em>.</>}
          kicker="Enter before the first round locks. After R1 starts, no new entries."
        />
        {loading ? (
          <p className="hp-empty">Loading pools…</p>
        ) : (
          <PoolsGrid pools={openPools} emptyMsg="No pools open right now. Check back soon." />
        )}
      </Section>

      {/* ── HOW IT WORKS ────────────────────────────────────── */}
      <Section tone="muted" size="lg">
        <SectionHeader
          eyebrow="HOW IT WORKS"
          title={<>The game is <em>simple</em>. Winning isn't.</>}
          center
        />
        <div className="hp-how">
          {HOW_IT_WORKS.map((s) => (
            <Card key={s.step} tone="default" padding="lg" className="hp-how-card">
              <div className="hp-how-step">
                <Pill tone="primary" size="md">{s.step}</Pill>
              </div>
              <h3 className="hp-how-title">{s.title}</h3>
              <p className="hp-how-body">{s.body}</p>
            </Card>
          ))}
        </div>
        <div className="hp-how-footer">
          <Button as={Link} to="/how-to-play" variant="secondary" size="md">
            Read full rules →
          </Button>
        </div>
      </Section>

      {/* ── PAST TOURNAMENTS ────────────────────────────────── */}
      {completedPools.length > 0 && (
        <Section tone="canvas" size="lg">
          <SectionHeader
            eyebrow="PAST TOURNAMENTS"
            title={<>Recent <em>survivors</em>.</>}
          />
          <PoolsGrid pools={completedPools} emptyMsg="No completed pools yet." />
        </Section>
      )}

      {/* ── INVITE CODE ─────────────────────────────────────── */}
      <Section tone="primary" size="md">
        <div className="hp-invite">
          <div>
            <p className="hp-invite-eyebrow">PRIVATE POOL</p>
            <h2 className="hp-invite-title">Have an <em>invite code</em>?</h2>
            <p className="hp-invite-sub">
              Enter the code your friend sent you to join their private pool.
            </p>
          </div>
          <form className="hp-invite-form" onSubmit={handleJoin}>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="ABCD-1234"
              className="hp-invite-input"
              autoCapitalize="characters"
            />
            <Button type="submit" variant="gold" size="md" loading={joinBusy}>
              Join pool →
            </Button>
          </form>
          {joinError && <p className="hp-invite-error">{joinError}</p>}
        </div>
      </Section>
    </div>
  );
}
