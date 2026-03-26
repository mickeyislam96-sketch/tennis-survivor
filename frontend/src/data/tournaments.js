/**
 * Tournament registry — mirrors backend/src/data/tournaments.js.
 * Keep in sync when adding new events.
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
    location: 'Miami, FL',
    surface: 'Hard',
    status: 'completed',
    drawDate: '2026-03-16',
    drawAvailable: true,
    entryOpen: false,
    entryClosedReason: 'ended',
  },
  {
    id: 'monte-carlo-2026',
    name: 'Rolex Monte-Carlo Masters',
    shortName: 'Monte Carlo',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-04-05',
    endDate: '2026-04-13',
    location: 'Monte Carlo, Monaco',
    surface: 'Clay',
    status: 'upcoming',   // change to 'active' when live
    drawDate: '2026-04-04',
    drawAvailable: false, // set to true once draw is released
    entryOpen: true,      // entry is open
    entryCloseAt: '2026-04-04T16:00:00Z',
  },
];

export function getTournament(id) {
  return TOURNAMENTS.find(t => t.id === id) || null;
}

export function getActiveTournament() {
  return (
    TOURNAMENTS.find(t => t.status === 'active') ||
    TOURNAMENTS.find(t => t.status === 'upcoming') ||
    [...TOURNAMENTS].reverse().find(t => t.status === 'completed') ||
    null
  );
}
