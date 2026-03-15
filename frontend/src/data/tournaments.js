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
    drawDate: '2026-03-03',
    drawAvailable: true,
    entryOpen: false,          // Tournament is underway — entry period is over
    entryClosedReason: 'started',
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
    status: 'upcoming',
    drawDate: '2026-03-16',    // Draw released March 16
    drawAvailable: false,
    entryOpen: true,           // Registration open ahead of draw release (Mar 16)
    // bracketWidget: ''       // ← Add SofaScore Miami bracket URL on Mar 16
  },
];

export function getTournament(id) {
  return TOURNAMENTS.find(t => t.id === id) || null;
}
