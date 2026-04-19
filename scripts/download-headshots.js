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
 * Output: frontend/public/players/{name-slug}.jpg (160x160)
 *
 * How it works:
 * 1. Searches Sofascore for each player name to get their Sofascore ID
 * 2. Downloads the headshot from their public image endpoint
 * 3. Saves as {name-slug}.jpg in the players directory
 *
 * Prerequisites:
 *   npm install node-fetch@2    (or use Node 18+ with native fetch)
 *
 * Note: This script uses Sofascore's public API which serves images
 * to any browser visitor. Run it from your local machine (not cloud)
 * as Sofascore blocks cloud/datacenter IPs.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// ── Configuration ─────────────────────────────────────────────
const OUTPUT_DIR = path.join(__dirname, '..', 'frontend', 'public', 'players');

// Top 100 ATP + extras likely to appear in Masters 1000 draws.
// Add or remove names as needed.
const PLAYERS = [
  // Top 10
  'Jannik Sinner', 'Alexander Zverev', 'Carlos Alcaraz', 'Novak Djokovic',
  'Taylor Fritz', 'Casper Ruud', 'Alex de Minaur', 'Andrey Rublev',
  'Daniil Medvedev', 'Grigor Dimitrov',
  // 11-20
  'Lorenzo Musetti', 'Jack Draper', 'Tommy Paul', 'Holger Rune',
  'Frances Tiafoe', 'Ugo Humbert', 'Ben Shelton', 'Sebastian Korda',
  'Stefanos Tsitsipas', 'Felix Auger-Aliassime',
  // 21-40
  'Arthur Fils', 'Alejandro Davidovich Fokina', 'Karen Khachanov',
  'Francisco Cerundolo', 'Flavio Cobolli', 'Tomas Martin Etcheverry',
  'Alexander Bublik', 'Brandon Nakashima', 'Jiri Lehecka', 'Matteo Berrettini',
  'Jakub Mensik', 'Valentin Vacherot', 'Luciano Darderi', 'Arthur Rinderknech',
  'Learner Tien', 'Jordan Thompson', 'Tallon Griekspoor', 'Giovanni Mpetshi Perricard',
  'Marcos Giron', 'Jan-Lennard Struff',
  // 41-60
  'Alexei Popyrin', 'Hubert Hurkacz', 'Gael Monfils', 'Adrian Mannarino',
  'Lorenzo Sonego', 'Nuno Borges', 'Fabian Marozsan', 'Roberto Bautista Agut',
  'Denis Shapovalov', 'Alejandro Tabilo', 'Tomas Machac', 'Pedro Martinez',
  'Stan Wawrinka', 'Mariano Navone', 'Joao Fonseca', 'Roman Safiullin',
  'Yoshihito Nishioka', 'Christopher Eubanks', 'Miomir Kecmanovic', 'Pavel Kotov',
  // 61-80
  'Botic van de Zandschulp', 'Juncheng Shang', 'Alex Michelsen', 'Matteo Arnaldi',
  'Nicolas Jarry', 'Mackenzie McDonald', 'Dusan Lajovic', 'Luca Nardi',
  'Reilly Opelka', 'Dominic Thiem', 'Rinky Hijikata', 'Corentin Moutet',
  'Zhizhen Zhang', 'Thanasi Kokkinakis', 'Daniel Altmaier', 'Laslo Djere',
  'Federico Coria', 'Hugo Gaston', 'Zizou Bergs', 'Filip Misolic',
  // 81-100
  'Sumit Nagal', 'Luca Van Assche', 'Hamad Medjedovic', 'James Duckworth',
  'Borna Coric', 'Aleksandar Vukic', 'Thiago Monteiro', 'Yannick Hanfmann',
  'Maximilian Marterer', 'Roberto Carballes Baena', 'Quentin Halys',
  'Sebastian Baez', 'Daniel Evans', 'Cam Norrie', 'Andy Murray',
  'Nick Kyrgios', 'Dominik Koepfer', 'Jaume Munar', 'Damir Dzumhur',
  'Albert Ramos-Vinolas',
  // Extras — frequent draw entrants, qualifiers who go deep
  'Vit Kopriva', 'Alex Molcan', 'Emilio Nava', 'Thiago Seyboth Wild',
  'Alexandre Muller', 'Marc-Andrea Huesler', 'Facundo Diaz Acosta',
  'Mikhail Kukushkin', 'Oscar Otte', 'Gregoire Barrere',
];

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

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        res.resume();
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        fs.unlinkSync(dest);
        reject(new Error(`HTTP ${res.statusCode}`));
        res.resume();
        return;
      }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    }).on('error', (e) => {
      fs.unlinkSync(dest);
      reject(e);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const name of PLAYERS) {
    const slug = nameSlug(name);
    const dest = path.join(OUTPUT_DIR, `${slug}.jpg`);

    // Skip if already downloaded
    if (fs.existsSync(dest)) {
      skipped++;
      continue;
    }

    try {
      // Step 1: Search Sofascore for the player
      const searchUrl = `https://api.sofascore.com/api/v1/search/player?name=${encodeURIComponent(name)}&page=0`;
      const searchResult = await fetchJson(searchUrl);
      const players = searchResult?.results || searchResult?.data || [];

      if (!players.length) {
        console.log(`  SKIP  ${name} — not found on Sofascore`);
        failed++;
        await sleep(500);
        continue;
      }

      // Take the first tennis result
      const player = players[0];
      const sofaId = player.id || player.entity?.id;

      if (!sofaId) {
        console.log(`  SKIP  ${name} — no Sofascore ID found`);
        failed++;
        await sleep(500);
        continue;
      }

      // Step 2: Download the headshot
      const imageUrl = `https://api.sofascore.com/api/v1/player/${sofaId}/image`;
      await downloadFile(imageUrl, dest);
      downloaded++;
      console.log(`  OK    ${name} → ${slug}.jpg (sofaId: ${sofaId})`);

    } catch (err) {
      console.log(`  FAIL  ${name} — ${err.message}`);
      failed++;
    }

    // Be polite — 500ms between requests
    await sleep(500);
  }

  console.log(`\nDone: ${downloaded} downloaded, ${skipped} already existed, ${failed} failed`);
  console.log(`Images saved to: ${OUTPUT_DIR}`);
}

main().catch(console.error);
