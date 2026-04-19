#!/usr/bin/env node
/**
 * download-headshots.js
 *
 * Downloads ATP player headshots from Sofascore's public CDN
 * and saves them as name-slug JPGs for the PlayerAvatar component.
 *
 * Usage:
 *   cd tennis-survivor
 *   node scripts/download-headshots.js
 *
 * Output: frontend/public/players/{name-slug}.jpg
 *
 * How it works:
 * 1. Uses a hardcoded map of player names → Sofascore IDs
 * 2. Downloads headshot from https://api.sofascore.com/api/v1/player/{id}/image
 * 3. Saves as {name-slug}.jpg in the players directory
 *
 * Note: Sofascore blocks cloud/datacenter IPs. Run from your local machine.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Configuration ─────────────────────────────────────────────
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'players');

// Hardcoded Sofascore player IDs.
// Source: sofascore.com/tennis/player/{slug}/{id}
// To add a player: find their Sofascore profile page, grab the numeric ID from the URL.
const SOFASCORE_IDS = {
  // Top 10
  'Jannik Sinner': 206570,
  'Alexander Zverev': 57163,
  'Carlos Alcaraz': 275923,
  'Novak Djokovic': 14882,
  'Taylor Fritz': 136042,
  'Casper Ruud': 119248,
  'Alex de Minaur': 201239,
  'Andrey Rublev': 106755,
  'Daniil Medvedev': 163504,
  'Grigor Dimitrov': 23581,

  // 11-20
  'Lorenzo Musetti': 261015,
  'Jack Draper': 258749,
  'Tommy Paul': 138546,
  'Holger Rune': 283070,
  'Frances Tiafoe': 101101,
  'Ugo Humbert': 185388,
  'Ben Shelton': 385485,
  'Sebastian Korda': 195840,
  'Stefanos Tsitsipas': 122366,
  'Felix Auger-Aliassime': 192013,

  // 21-40
  'Arthur Fils': 338500,
  'Alejandro Davidovich Fokina': 157456,
  'Karen Khachanov': 90080,
  'Francisco Cerundolo': 221012,
  'Flavio Cobolli': 273680,
  'Tomas Martin Etcheverry': 169496,
  'Alexander Bublik': 163480,
  'Brandon Nakashima': 235576,
  'Jiri Lehecka': 254742,
  'Matteo Berrettini': 112783,
  'Jakub Mensik': 372312,
  'Luciano Darderi': 308084,
  'Arthur Rinderknech': 63606,
  'Learner Tien': 412818,
  'Jordan Thompson': 87690,
  'Tallon Griekspoor': 122368,
  'Giovanni Mpetshi Perricard': 289146,
  'Marcos Giron': 42379,
  'Jan-Lennard Struff': 46391,

  // 41-60
  'Alexei Popyrin': 128552,
  'Hubert Hurkacz': 158896,
  'Gael Monfils': 14844,
  'Adrian Mannarino': 15894,
  'Lorenzo Sonego': 104847,
  'Nuno Borges': 125006,
  'Fabian Marozsan': 218259,
  'Roberto Bautista Agut': 16720,
  'Denis Shapovalov': 117916,
  'Alejandro Tabilo': 102151,
  'Tomas Machac': 238300,
  'Pedro Martinez': 77223,
  'Stan Wawrinka': 14548,
  'Mariano Navone': 271389,
  'Joao Fonseca': 403869,
  'Roman Safiullin': 124930,
  'Yoshihito Nishioka': 59281,
  'Christopher Eubanks': 197516,
  'Miomir Kecmanovic': 198592,
  'Pavel Kotov': 203258,

  // 61-80
  'Botic van de Zandschulp': 102339,
  'Alex Michelsen': 406728,
  'Matteo Arnaldi': 299538,
  'Nicolas Jarry': 89632,
  'Mackenzie McDonald': 63438,
  'Dusan Lajovic': 39234,
  'Luca Nardi': 289233,
  'Dominic Thiem': 43748,
  'Rinky Hijikata': 237452,
  'Corentin Moutet': 175014,
  'Zhizhen Zhang': 75813,
  'Thanasi Kokkinakis': 71280,
  'Daniel Altmaier': 127208,
  'Laslo Djere': 97231,
  'Federico Coria': 54573,
  'Hugo Gaston': 205906,
  'Filip Misolic': 216488,

  // 81-100
  'Sumit Nagal': 131566,
  'Luca Van Assche': 335102,
  'Hamad Medjedovic': 321404,
  'Borna Coric': 64580,
  'Thiago Monteiro': 47603,
  'Yannick Hanfmann': 47975,
  'Maximilian Marterer': 71660,
  'Quentin Halys': 90798,
  'Sebastian Baez': 221806,
  'Daniel Evans': 16375,
  'Cameron Norrie': 95935,
  'Andy Murray': 15126,
  'Nick Kyrgios': 62490,
  'Dominik Koepfer': 129368,
  'Damir Dzumhur': 49172,

  // Extras - frequent draw entrants, legends, qualifiers who go deep
  'Thiago Seyboth Wild': 161262,
  'Alexandre Muller': 88992,
  'Facundo Diaz Acosta': 264372,
  'Gregoire Barrere': 67154,
  'Fabio Fognini': 15434,
  'Marin Cilic': 15387,
  'Pablo Carreno Busta': 40800,
  'Richard Gasquet': 14414,
  'Gilles Simon': 14736,
  'Benoit Paire': 22218,
  'Rafael Nadal': 14486,
  'Roger Federer': 14342,
  'Kei Nishikori': 15733,
  'Diego Schwartzman': 48599,
  'Yibing Wu': 194186,
  'Taro Daniel': 48632,
  'Denis Kudla': 36595,
  'Terence Atmane': 273679,
  'Stefano Travaglia': 36300,
  'Aslan Karatsev': 60502,
  'Gijs Brouwer': 104967,
  'Arthur Cazaux': 287803,
  'Harold Mayot': 248846,
  'Pablo Llamas Ruiz': 264358,
  'Constant Lestienne': 62790,
  'Filip Krajinovic': 22970,
};

// ── Helpers ───────────────────────────────────────────────────

function nameSlug(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' } }, (res) => {
      // Follow redirects
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        fs.unlinkSync(dest);
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(dest); } catch (_) {}
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (e) => {
      file.close();
      try { fs.unlinkSync(dest); } catch (_) {}
      reject(e);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entries = Object.entries(SOFASCORE_IDS);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  console.log(`Downloading headshots for ${entries.length} players...`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (const [name, sofaId] of entries) {
    const slug = nameSlug(name);
    const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);

    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      const stat = fs.statSync(dest);
      if (stat.size > 500) { // skip only if file is non-trivial (not an error page)
        skipped++;
        continue;
      }
      // Remove tiny/corrupt files and re-download
      fs.unlinkSync(dest);
    }

    try {
      const imageUrl = `https://api.sofascore.com/api/v1/player/${sofaId}/image`;
      await downloadFile(imageUrl, dest);

      // Verify file was actually an image (> 1KB)
      const stat = fs.statSync(dest);
      if (stat.size < 1000) {
        console.log(`  WARN  ${name} — file too small (${stat.size}B), may not be a valid image`);
        fs.unlinkSync(dest);
        failed++;
      } else {
        downloaded++;
        console.log(`  OK    ${name} → ${slug}.jpg (${Math.round(stat.size / 1024)}KB)`);
      }
    } catch (err) {
      console.log(`  FAIL  ${name} — ${err.message}`);
      failed++;
    }

    // Be polite — 300ms between requests
    await sleep(300);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done: ${downloaded} downloaded, ${skipped} already existed, ${failed} failed`);
  console.log(`Total in map: ${entries.length}`);
  console.log(`Images saved to: ${OUTPUT_DIR}`);

  if (failed > 0) {
    console.log(`\nTo retry failed downloads, just run the script again.`);
    console.log(`It skips files that already exist.`);
  }
}

main().catch(console.error);
