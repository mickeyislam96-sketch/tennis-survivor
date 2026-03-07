/**
 * Fetch tournament list from API-Tennis and find BNP Paribas Open Indian Wells (ATP).
 * Run: node scripts/find-indian-wells.js
 * Requires TENNIS_API_KEY in .env or environment.
 */
import 'dotenv/config';

const apiKey = process.env.TENNIS_API_KEY;
if (!apiKey) {
  console.error('Missing TENNIS_API_KEY. Add it to backend/.env or run: TENNIS_API_KEY=your_key node scripts/find-indian-wells.js');
  process.exit(1);
}

const url = `https://api.api-tennis.com/tennis/?method=get_tournaments&APIkey=${apiKey}`;

try {
  const res = await fetch(url);
  const data = await res.json();
  if (!data.success) {
    console.error('API error:', data.message || data);
    process.exit(1);
  }
  const tournaments = data.result || [];
  const searchTerms = ['indian wells', 'bnp paribas'];
  const atpSingles = tournaments.filter(
    (t) => t.event_type_type && String(t.event_type_type).toLowerCase() === 'atp singles'
  );
  const indianWells = atpSingles.filter(
    (t) => searchTerms.some((term) => (t.tournament_name || '').toLowerCase().includes(term))
  );
  if (indianWells.length === 0) {
    console.log('No "Indian Wells" / "BNP Paribas Open" in ATP Singles list. All ATP Singles tournaments:');
    atpSingles.forEach((t) => console.log(' ', t.tournament_key, t.tournament_name));
  } else {
    console.log('Use this in your .env for Indian Wells 2025:\n');
    indianWells.forEach((t) => {
      console.log(`INDIAN_WELLS_TOURNAMENT_KEY=${t.tournament_key}`);
      console.log(`# ${t.tournament_name} (${t.event_type_type})\n`);
    });
  }
} catch (e) {
  console.error('Request failed:', e.message);
  process.exit(1);
}
