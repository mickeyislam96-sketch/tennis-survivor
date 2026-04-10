/**
 * Tournament registry — mirrors backend/src/data/tournaments.js.
 * Keep in sync when adding new events.
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
    surface: 'Clay',
    status: 'active',
    drawDate: '2026-04-04',
    drawAvailable: true,
    entryOpen: true,
    entryCloseAt: '2026-04-04T16:00:00Z',
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
    surface: 'Clay',
    status: 'upcoming',
    drawDate: '2026-04-18',
    drawAvailable: false,
    entryOpen: true,
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
