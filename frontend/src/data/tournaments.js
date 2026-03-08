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
    status: 'active',
    drawAvailable: true,
    entryOpen: false,          // Tournament is underway — entry period is over
    entryClosedReason: 'started',
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
    status: 'upcoming',
    drawAvailable: false,
    entryOpen: false,          // Not launched yet — opens when draw is released (~Mar 16)
    entryOpenDate: '2026-03-16',
    entryClosedReason: 'not-launched',
  },
];

export function getTournament(id) {
  return TOURNAMENTS.find(t => t.id === id) || null;
}
