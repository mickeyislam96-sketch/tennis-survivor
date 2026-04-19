#!/usr/bin/env node
/**
 * download-headshots.js
 *
 * Downloads ATP player headshots from atptour.com's public CDN
 * and saves them as name-slug JPGs for the PlayerAvatar component.
 *
 * Usage:
 *   cd tennis-survivor
 *   node scripts/download-headshots.js
 *
 * Output: frontend/public/players/{name-slug}.jpg
 *
 * How it works:
 * 1. Uses a hardcoded map of player names → ATP Tour 4-char IDs
 * 2. Downloads headshot from https://www.atptour.com/-/media/alias/player-headshot/{id}
 * 3. Saves as {name-slug}.jpg in the players directory
 *
 * These are static files served by Vercel's CDN — no API calls at runtime.
 * Images rarely change (new headshots once per season), so run this script
 * once, commit the images, and you're done.
 *
 * To add a player: find their profile at atptour.com/en/players/{slug}/{ID}/overview
 * and add their name + 4-char ID to the ATP_IDS map below.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Configuration ─────────────────────────────────────────────
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'players');
const BASE_URL = 'https://www.atptour.com/-/media/alias/player-headshot';

// ATP Tour 4-character player IDs.
// Source: atptour.com/en/players/{name-slug}/{ID}/overview
const ATP_IDS = {
  // — Top 10 —
  'Jannik Sinner': 's0ag',
  'Alexander Zverev': 'z355',
  'Carlos Alcaraz': 'a0e2',
  'Novak Djokovic': 'd643',
  'Taylor Fritz': 'fb98',
  'Casper Ruud': 'rh16',
  'Alex de Minaur': 'dh58',
  'Andrey Rublev': 're44',
  'Daniil Medvedev': 'mm58',
  'Jack Draper': 'd0co',

  // — 11-20 —
  'Tommy Paul': 'pl56',
  'Holger Rune': 'r0dg',
  'Lorenzo Musetti': 'm0ej',
  'Grigor Dimitrov': 'd875',
  'Frances Tiafoe': 'td51',
  'Ugo Humbert': 'hh26',
  'Ben Shelton': 's0s1',
  'Arthur Fils': 'f0f1',
  'Stefanos Tsitsipas': 'te51',
  'Felix Auger-Aliassime': 'ag37',

  // — 21-40 —
  'Sebastian Korda': 'k0ah',
  'Karen Khachanov': 'ke29',
  'Francisco Cerundolo': 'c0au',
  'Flavio Cobolli': 'c0e9',
  'Tomas Machac': 'm0fh',
  'Matteo Berrettini': 'bk40',
  'Alexander Bublik': 'bk92',
  'Giovanni Mpetshi Perricard': 'm0gz',
  'Jiri Lehecka': 'l0bv',
  'Alejandro Davidovich Fokina': 'dh50',
  'Jakub Mensik': 'm0ni',
  'Learner Tien': 't0ha',
  'Joao Fonseca': 'f0fv',
  'Hubert Hurkacz': 'hb71',
  'Gael Monfils': 'mc65',
  'Tallon Griekspoor': 'gj37',
  'Jordan Thompson': 'tc61',
  'Brandon Nakashima': 'n0ae',
  'Jan-Lennard Struff': 'sl28',
  'Marcos Giron': 'gc88',

  // — 41-60 —
  'Alexei Popyrin': 'p09z',
  'Nuno Borges': 'bt72',
  'Fabian Marozsan': 'm0ci',
  'Lorenzo Sonego': 'su87',
  'Denis Shapovalov': 'su55',
  'Alejandro Tabilo': 'te30',
  'Roberto Bautista Agut': 'bd06',
  'Matteo Arnaldi': 'a0fc',
  'Nicolas Jarry': 'j551',
  'Luciano Darderi': 'd0fj',
  'Sebastian Baez': 'b0bi',
  'Stan Wawrinka': 'w367',
  'Mariano Navone': 'n0bs',
  'Adrian Mannarino': 'me82',
  'Alex Michelsen': 'm0qi',
  'Arthur Rinderknech': 'rc91',
  'Miomir Kecmanovic': 'ki95',
  'Pedro Martinez': 'mo44',
  'Botic van de Zandschulp': 'v812',
  'Mackenzie McDonald': 'mk66',

  // — 61-80 —
  'Christopher Eubanks': 'e865',
  'Roman Safiullin': 'sx50',
  'Yoshihito Nishioka': 'n732',
  'Pavel Kotov': 'k09f',
  'Corentin Moutet': 'mw02',
  'Fabio Fognini': 'f510',
  'Dusan Lajovic': 'l987',
  'Daniel Evans': 'e687',
  'Cameron Norrie': 'n771',
  'Thanasi Kokkinakis': 'kd46',
  'Hugo Gaston': 'g09o',
  'Zhizhen Zhang': 'z371',
  'Rinky Hijikata': 'h0bh',
  'Daniel Altmaier': 'ae14',
  'Hamad Medjedovic': 'm0jf',
  'Borna Coric': 'cg80',
  'Luca Nardi': 'n0bg',
  'Sumit Nagal': 'n897',
  'Luca Van Assche': 'v0dz',
  'Tomas Martin Etcheverry': 'ea24',

  // — 81-100 —
  'Filip Misolic': 'm0jz',
  'Laslo Djere': 'db63',
  'Federico Coria': 'ce77',
  'Dominik Koepfer': 'ke73',
  'Yannick Hanfmann': 'h997',
  'Quentin Halys': 'hb64',
  'Thiago Monteiro': 'mj08',
  'Thiago Seyboth Wild': 'sx91',
  'Alexandre Muller': 'mp20',
  'Facundo Diaz Acosta': 'd0cg',
  'Juncheng Shang': 's0re',
  'Zizou Bergs': 'bu13',
  'Roberto Carballes Baena': 'cf59',
  'Maximilian Marterer': 'mn13',
  'Reilly Opelka': 'o522',

  // — Extras (frequent draw entrants, veterans) —
  'Damir Dzumhur': 'd923',
  'Arthur Cazaux': 'c0h0',
  'Gregoire Barrere': 'bk24',
  'Constant Lestienne': 'lb66',
  'Terence Atmane': 'a0gc',
  'Stefano Travaglia': 'ta12',
  'Aslan Karatsev': 'kc56',
  'Harold Mayot': 'm0g4',
  'Pablo Llamas Ruiz': 'l0cx',
  'Aleksandar Vukic': 'v832',
  'James Duckworth': 'd994',
  'Jaume Munar': 'mu94',
  'Albert Ramos-Vinolas': 'r772',
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
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    }, (res) => {
      // Follow redirects (up to 3)
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        res.resume();
        downloadFile(res.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
      file.on('error', (e) => { try { fs.unlinkSync(dest); } catch (_) {} reject(e); });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entries = Object.entries(ATP_IDS);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  console.log(`Downloading headshots for ${entries.length} players...`);
  console.log(`Source: ${BASE_URL}/{id}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  for (const [name, atpId] of entries) {
    const slug = nameSlug(name);
    const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);

    // Skip if already downloaded (and file is non-trivial)
    if (fs.existsSync(dest)) {
      const stat = fs.statSync(dest);
      if (stat.size > 500) {
        skipped++;
        continue;
      }
      // Remove tiny/corrupt files and re-download
      fs.unlinkSync(dest);
    }

    try {
      const imageUrl = `${BASE_URL}/${atpId}`;
      await downloadFile(imageUrl, dest);

      // Verify the file is a real image (> 1KB)
      const stat = fs.statSync(dest);
      if (stat.size < 1000) {
        console.log(`  WARN  ${name} (${atpId}) — file too small (${stat.size}B), removing`);
        fs.unlinkSync(dest);
        failed++;
        failures.push(name);
      } else {
        downloaded++;
        console.log(`  OK    ${name} → ${slug}.jpg (${Math.round(stat.size / 1024)}KB)`);
      }
    } catch (err) {
      console.log(`  FAIL  ${name} (${atpId}) — ${err.message}`);
      failed++;
      failures.push(name);
    }

    // 200ms between requests
    await sleep(200);
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done: ${downloaded} downloaded, ${skipped} existed, ${failed} failed`);
  console.log(`Total players in map: ${entries.length}`);
  console.log(`Images in: ${OUTPUT_DIR}`);

  if (failures.length > 0) {
    console.log(`\nFailed players:`);
    failures.forEach(n => console.log(`  - ${n}`));
    console.log(`\nRe-run the script to retry. It skips existing files.`);
  }

  console.log(`\nNext steps:`);
  console.log(`  git add frontend/public/players/*.jpg`);
  console.log(`  git commit -m "add player headshot images"`);
  console.log(`  git push origin main`);
}

main().catch(console.error);
