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
  {
    id: 'miami-2026',
    name: 'Miami Open',
    shortName: 'Miami',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-03-19',
    endDate: '2026-03-30',
    location: 'Miami, FL, USA',
    surface: 'Hard (outdoor)',
    status: 'active',
    drawDate: 'March 16, 2026',
    drawAvailable: true,
    entryCloseAt: '2026-03-17T16:00:00Z',  // Closes 4pm UK time March 17
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  {
    id: 'monte-carlo-2026',
    name: 'Rolex Monte-Carlo Masters',
    shortName: 'Monte Carlo',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-06',
    endDate: '2026-04-13',
    location: 'Monte-Carlo, Monaco',
    surface: 'Clay (outdoor)',
    status: 'completed',
    drawDate: 'April 4, 2026',
    drawAvailable: true,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
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
    drawAvailable: false,
    r1PerMatchLock: true,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  {
    id: 'roland-garros-2026',
    name: 'Roland-Garros',
    shortName: 'Roland Garros',
    year: 2026,
    tourLevel: 'Grand Slam',
    startDate: '2026-05-18',
    endDate: '2026-06-07',
    location: 'Paris, France',
    surface: 'Clay (outdoor)',
    status: 'upcoming',
    drawDate: 'May 15, 2026',
    drawAvailable: false,
    isPaid: true,
    entryFeeCents: 1000,
    pickWindowOpen: null,
    pickWindowClose: null,
  },
];

/**
 * Compute tournament status from its start/end dates.
 * Overrides any hardcoded `status` on the registry to prevent stale data
 * (e.g. Miami left as 'active' after it finished).
 */
export function computeStatus(startDate, endDate, now = new Date()) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  // Treat end-of-endDate as the cutover (23:59:59 UTC of endDate).
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
