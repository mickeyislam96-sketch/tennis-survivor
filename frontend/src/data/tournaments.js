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

/**
 * Compute effective status: auto-complete active tournaments 1 day after endDate.
 * Returns a new object with corrected status (does not mutate the original).
 */
function withEffectiveStatus(t) {
  if (!t) return t;
  if (t.status === 'active' && t.endDate) {
    const endPlus1 = new Date(t.endDate);
    endPlus1.setDate(endPlus1.getDate() + 1);
    endPlus1.setHours(23, 59, 59, 999); // End of the day after the final
    if (new Date() > endPlus1) return { ...t, status: 'completed' };
  }
  return t;
}

export function getTournament(id) {
  const t = TOURNAMENTS.find(t => t.id === id);
  return withEffectiveStatus(t) || null;
}

export function getActiveTournament() {
  const effective = TOURNAMENTS.map(withEffectiveStatus);
  return (
    effective.find(t => t.status === 'active') ||
    effective.find(t => t.status === 'upcoming') ||
    [...effective].reverse().find(t => t.status === 'completed') ||
    null
  );
}
