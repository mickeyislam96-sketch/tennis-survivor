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
    status: 'completed',
    drawDate: 'April 4, 2026',
    drawAvailable: true,
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

/**
 * Compute effective status: auto-complete active tournaments 1 day after endDate.
 * Returns a new object with corrected status (does not mutate the original).
 */
function withEffectiveStatus(t) {
  if (!t) return t;
  if (t.status === 'active' && t.endDate) {
    // Auto-complete at midnight UTC on the day after the final
    const cutoff = new Date(t.endDate + 'T23:59:59Z');
    if (new Date() > cutoff) return { ...t, status: 'completed' };
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
