/**
 * Tournament registry — single source of truth for all events.
 * Add a new object here to register a new tournament.
 * The system picks up the correct draw data from ACTIVE_TOURNAMENT env var.
 */
export const TOURNAMENTS = [
  {
    id: 'monte-carlo-2026',
    name: 'Rolex Monte-Carlo Masters',
    shortName: 'Monte Carlo',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-05',
    endDate: '2026-04-12',
    location: 'Monte Carlo, Monaco',
    surface: 'Clay (outdoor)',
    status: 'active',
    drawDate: 'April 4, 2026',
    drawAvailable: true,
    // Entry closes before the draw — update this once confirmed
    entryCloseAt: '2026-04-04T16:00:00Z',
    pickWindowOpen: null,
    pickWindowClose: null,
  },
  {
    id: 'madrid-2026',
    name: 'Mutua Madrid Open',
    shortName: 'Madrid',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-21',
    endDate: '2026-05-03',
    location: 'Madrid, Spain',
    surface: 'Clay (outdoor)',
    status: 'upcoming',
    drawDate: 'April 18, 2026',
    drawAvailable: false,
    entryCloseAt: null,  // Set once draw date is confirmed
    pickWindowOpen: null,
    pickWindowClose: null,
  },
];

export function getTournament(id) {
  return TOURNAMENTS.find(t => t.id === id) || null;
}

export function getActiveTournament() {
  // 'active' > 'upcoming' > most recent 'completed'
  return (
    TOURNAMENTS.find(t => t.status === 'active') ||
    TOURNAMENTS.find(t => t.status === 'upcoming') ||
    [...TOURNAMENTS].reverse().find(t => t.status === 'completed') ||
    null
  );
}
