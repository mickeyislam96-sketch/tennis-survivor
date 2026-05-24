/**
 * Tournament registry — the single source of truth for all events.
 * Add a new object here to register a tournament. No other code changes required.
 */
export const TOURNAMENTS = [
  {
    id: 'indian-wells-2026',
    name: 'BNP Paribas Open',
    shortName: 'Indian Wells',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-03-05',
    endDate: '2026-03-16',
    location: 'Indian Wells, CA, USA',
    surface: 'Hard (outdoor)',
    status: 'completed',    // 'upcoming' | 'active' | 'completed'
    drawDate: 'March 3, 2026',
    drawAvailable: true,
    // Pick window is computed dynamically via getDeadlines() for active tournaments.
    // For upcoming tournaments, set manually below once the schedule is confirmed.
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  // Miami Open 2026 and Monte Carlo Masters 2026 — closed friends-only runs that
  // pre-date the public Madrid launch. Intentionally omitted from the registry so
  // getTournament() returns null and the /pools endpoint drops any orphan groups
  // that still reference them. Keep the mock draw files on disk; just unwire them
  // from the user-facing lobby.
  {
    id: 'madrid-2026',
    name: 'Mutua Madrid Open',
    shortName: 'Madrid',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-22',
    endDate: '2026-05-03',
    location: 'Madrid, Spain',
    surface: 'Clay (outdoor)',
    status: 'upcoming',
    drawDate: 'April 19, 2026',
    drawAvailable: true,
    r1PerMatchLock: false,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  {
    id: 'rome-2026',
    name: 'Internazionali BNL d\'Italia',
    shortName: 'Rome',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-05-05',
    endDate: '2026-05-17',
    location: 'Rome, Italy',
    surface: 'Clay (outdoor)',
    status: 'upcoming',
    drawDate: 'May 3, 2026',
    drawAvailable: true,
    r1PerMatchLock: false,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  {
    id: 'roland-garros-2026',
    name: 'Roland-Garros',
    shortName: 'Roland Garros',
    year: 2026,
    tourLevel: 'Grand Slam',
    startDate: '2026-05-24',
    endDate: '2026-06-07',
    location: 'Paris, France',
    surface: 'Clay (outdoor)',
    status: 'upcoming',
    drawDate: 'May 21, 2026',
    drawAvailable: true,
    isPaid: false,
    entryFeeCents: 0,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
];

/**
 * Compute tournament status from its start/end dates.
 * Overrides any hardcoded `status` field on the registry so the lobby never
 * drifts out of reality (e.g. an event left as 'active' weeks after it ended).
 *
 * Boundary rules:
 *   - before startDate           → 'upcoming'
 *   - between start and end-day  → 'active'
 *   - after end-of-endDate (UTC) → 'completed'
 */
export function computeStatus(startDate, endDate, now = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const endOfDay = new Date(end.getTime() + 24 * 60 * 60 * 1000 - 1);
  if (now > endOfDay) return 'completed';
  if (now >= start) return 'active';
  return 'upcoming';
}

function withComputedStatus(t) {
  if (!t) return t;
  return { ...t, status: computeStatus(t.startDate, t.endDate) };
}

export function getTournament(id) {
  const raw = TOURNAMENTS.find(t => t.id === id);
  return raw ? withComputedStatus(raw) : null;
}

export function getAllTournaments() {
  return TOURNAMENTS.map(withComputedStatus);
}
