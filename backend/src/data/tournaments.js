/**
 * Tournament registry — single source of truth for all events.
 * Add a new object here to register a new tournament.
 * The system picks up the correct draw data from ACTIVE_TOURNAMENT env var.
 */
export const TOURNAMENTS = [
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
    status: 'completed',
    drawDate: 'March 16, 2026',
    drawAvailable: true,
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
    location: 'Monte Carlo, Monaco',
    surface: 'Clay (outdoor)',
    status: 'upcoming',    // change to 'active' once the tournament begins
    drawDate: 'April 4, 2026',
    drawAvailable: false,  // set to true once the draw is released
    // Entry closes before the draw — update this once confirmed
    entryCloseAt: '2026-04-04T16:00:00Z',
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
