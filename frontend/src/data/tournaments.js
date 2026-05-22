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
  // Miami Open 2026 and Monte Carlo Masters 2026 — closed friends-only runs that
  // pre-date the public Madrid launch. Kept out of the frontend registry so no
  // hardcoded references can accidentally surface them. Backend mirrors this.
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
    drawAvailable: true,
    entryOpen: true,
    r1PerMatchLock: false,  // Standard fixed deadline for R1 (same as all other rounds)
    bracketWidget: null,
  },
  {
    id: 'rome-2026',
    name: 'Internazionali BNL d\'Italia',
    shortName: 'Rome',
    year: 2026,
    tourLevel: 'ATP Masters 1000',
    startDate: '2026-05-05',
    endDate: '2026-05-17',
    location: 'Rome, Italy',
    surface: 'Clay',
    status: 'upcoming',
    drawDate: '2026-05-03',
    drawAvailable: true,
    entryOpen: true,
    r1PerMatchLock: false,
    bracketWidget: null,
  },
  {
    id: 'roland-garros-2026',
    name: 'Roland-Garros',
    shortName: 'Roland Garros',
    year: 2026,
    tourLevel: 'Grand Slam',
    startDate: '2026-05-24',
    endDate: '2026-06-07',
    location: 'Paris, France',
    surface: 'Clay',
    status: 'upcoming',
    drawDate: '2026-05-21',
    drawAvailable: true,
    entryOpen: true,
    isPaid: false,
    entryFeeCents: 0,
    bracketWidget: null,
  },
];

/**
 * Compute tournament status from its start/end dates.
 * Overrides any hardcoded `status` field on the registry so the lobby never
 * drifts out of reality (e.g. an event left as 'active' weeks after it ended).
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
