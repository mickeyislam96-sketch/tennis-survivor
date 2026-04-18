/**
 * Tournament registry — mirrors backend/src/data/tournaments.js.
 * Keep in sync when adding new events.
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
    location: 'Indian Wells, CA',
    surface: 'Hard',
    status: 'completed',
    drawDate: '2026-03-03',
    drawAvailable: true,
    entryOpen: false,
    entryClosedReason: 'completed',
    bracketWidget: 'https://widgets.sofascore.com/embed/unique-tournament/2487/season/80797/cuptree/10848110?widgetTitle=2026%20Indian%20Wells%2C%20USA&showCompetitionLogo=true&widgetTheme=light',
  },
  {
    id: 'miami-2026',
    name: 'Miami Open',
    shortName: 'Miami',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-03-19',
    endDate: '2026-03-30',
    location: 'Miami, FL',
    surface: 'Hard',
    status: 'active',
    drawDate: '2026-03-16',
    drawAvailable: true,
    entryOpen: true,
    bracketWidget: 'https://widgets.sofascore.com/embed/unique-tournament/2430/season/80799/cuptree/10850024?widgetTitle=2026%20Miami%2C%20USA&showCompetitionLogo=true&widgetTheme=light',
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
    surface: 'Clay',
    status: 'completed',
    drawDate: '2026-04-04',
    drawAvailable: true,
    entryOpen: false,
    entryClosedReason: 'completed',
    bracketWidget: null,
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
    surface: 'Clay',
    status: 'upcoming',
    drawDate: '2026-04-19',
    drawAvailable: false,
    entryOpen: true,
    r1PerMatchLock: true,  // R1 has no fixed deadline; players removed as matches start
    bracketWidget: null,
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
    surface: 'Clay',
    status: 'upcoming',
    drawDate: '2026-05-15',
    drawAvailable: false,
    entryOpen: false,
    isPaid: true,
    entryFeeCents: 1000,
    bracketWidget: null,
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
