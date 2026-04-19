#!/usr/bin/env node
/**
 * download-headshots.js
 *
 * Downloads ATP player headshots using a real browser (Puppeteer)
 * to bypass bot detection. Saves as name-slug JPGs for PlayerAvatar.
 *
 * Setup (one time):
 *   cd tennis-survivor
 *   npm install puppeteer
 *
 * Usage:
 *   node scripts/download-headshots.js
 *
 * Output: frontend/public/players/{name-slug}.jpg
 *
 * These are static files — commit them once, Vercel serves them
 * from its CDN. No runtime API calls, no database.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'players');
const BASE_URL = 'https://www.atptour.com/-/media/alias/player-headshot';

// ATP Tour 4-char player IDs from atptour.com/en/players/{slug}/{ID}/overview
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

  // — 81-100+ —
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

  // — Extras —
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

// ── Main ──────────────────────────────────────────────────────

async function main() {
  // Check puppeteer is installed
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch (e) {
    console.error('Puppeteer not installed. Run:\n  npm install puppeteer\n');
    process.exit(1);
  }

  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const entries = Object.entries(ATP_IDS);
  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures = [];

  console.log(`\nDownloading headshots for ${entries.length} players...`);
  console.log(`Source: ${BASE_URL}/{id}`);
  console.log(`Output: ${OUTPUT_DIR}\n`);

  // Launch a real browser — bypasses Cloudflare/bot detection
  console.log('Launching browser...\n');
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 720 });

  // Visit ATP Tour homepage first to establish cookies/session
  try {
    await page.goto('https://www.atptour.com', { waitUntil: 'domcontentloaded', timeout: 15000 });
    await sleep(2000);
    console.log('Session established.\n');
  } catch (e) {
    console.log('Warning: could not load ATP homepage, continuing anyway...\n');
  }

  for (const [name, atpId] of entries) {
    const slug = nameSlug(name);
    const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);

    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      const stat = fs.statSync(dest);
      if (stat.size > 500) {
        skipped++;
        continue;
      }
      fs.unlinkSync(dest);
    }

    try {
      const imageUrl = `${BASE_URL}/${atpId}`;

      // Use page.goto to fetch the image (real browser request)
      const response = await page.goto(imageUrl, {
        waitUntil: 'load',
        timeout: 10000,
      });

      if (!response || !response.ok()) {
        throw new Error(`HTTP ${response ? response.status() : 'no response'}`);
      }

      const buffer = await response.buffer();

      if (buffer.length < 1000) {
        throw new Error(`too small (${buffer.length}B)`);
      }

      fs.writeFileSync(dest, buffer);
      downloaded++;
      console.log(`  OK    ${name} → ${slug}.jpg (${Math.round(buffer.length / 1024)}KB)`);

    } catch (err) {
      console.log(`  FAIL  ${name} (${atpId}) — ${err.message}`);
      failed++;
      failures.push(name);
    }

    // Small delay between requests
    await sleep(300);
  }

  await browser.close();

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Done: ${downloaded} downloaded, ${skipped} existed, ${failed} failed`);
  console.log(`Total: ${entries.length} players`);
  console.log(`Images in: ${OUTPUT_DIR}`);

  if (failures.length > 0) {
    console.log(`\nFailed (${failures.length}):`);
    failures.forEach(n => console.log(`  - ${n}`));
    console.log(`\nRe-run to retry (skips existing files).`);
  }

  if (downloaded > 0) {
    console.log(`\nNext steps:`);
    console.log(`  git add frontend/public/players/*.jpg`);
    console.log(`  git commit -m "add player headshot images"`);
    console.log(`  git push origin main`);
  }
}

main().catch(console.error);
