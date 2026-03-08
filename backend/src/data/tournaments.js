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
    status: 'active',       // 'upcoming' | 'active' | 'completed'
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
    status: 'upcoming',
    drawAvailable: false,
    pickWindowOpen: null,   // set once schedule is confirmed
    pickWindowClose: null,
  },
];

export function getTournament(id) {
  return TOURNAMENTS.find(t => t.id === id) || null;
}
