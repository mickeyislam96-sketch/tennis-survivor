#!/usr/bin/env node
/**
 * FlashScore Scraper for Final Serve-ivor (Cloud Edition)
 * ───────────────────────────────────────────────────────
 * Scrapes ATP singles match results from FlashScore using Playwright.
 * Designed to run on Railway as a cron service (start, scrape, POST, exit).
 *
 * Usage:
 *   node src/scrape.mjs              # scrape + POST to backend
 *   node src/scrape.mjs --dry-run    # scrape + print results (no POST)
 *
 * Environment:
 *   BACKEND_URL    — e.g. https://tennis-survivor-production.up.railway.app
 *   ADMIN_SECRET   — same secret as the backend ADMIN_SECRET env var
 *   FLASHSCORE_URL — (optional) override the tournament URL
 *   RESULTS_URL    — (optional) override the results page URL
 */

import { chromium } from 'playwright';
import {
  FLASHSCORE_URL,
  RESULTS_URL,
  ROUND_MAP,
  TIMEZONE_OFFSET_HOURS,
  BACKEND_URL,
  ADMIN_SECRET,
  DRY_RUN,
  DEFAULT_ROUND_LABEL,
} from './config.mjs';

// ── Logging ─────────────────────────────────────────────────────────────────
// Railway captures stdout/stderr — no file logging needed.

function log(msg) {
  console.log(`[${new Date().toISOString()}] ${msg}`);
}

function logError(msg, err) {
  console.error(`[${new Date().toISOString()}] ERROR: ${msg} — ${err?.message || err}`);
}

// ── Round normalisation ─────────────────────────────────────────────────────

// Valid internal round keys (used to detect if a label is already normalised)
const INTERNAL_ROUNDS = new Set(['R1', 'R64', 'R32', 'R16', 'QF', 'SF', 'F']);

function normalizeRound(raw) {
  if (!raw) return null;
  const trimmed = raw.trim();

  // Already an internal round key (e.g. from DEFAULT_ROUND_LABEL)
  if (INTERNAL_ROUNDS.has(trimmed)) return trimmed;

  const str = trimmed.toLowerCase();

  // Direct lookup
  if (ROUND_MAP[str]) return ROUND_MAP[str];

  // Partial match (handles "ATP Madrid - 1st Round" etc.)
  for (const [label, round] of Object.entries(ROUND_MAP)) {
    if (str.includes(label)) return round;
  }

  log(`Unknown round label: "${raw}"`);
  return null;
}

// ── Status normalisation ────────────────────────────────────────────────────

function normalizeStatus(statusText, hasScore) {
  if (!statusText) return hasScore ? 'completed' : 'scheduled';
  const s = statusText.toLowerCase().trim();

  if (s === 'finished' || s === 'ended' || s === 'fin' || s === 'ft') return 'completed';
  if (s === 'walkover' || s === 'w/o' || s === 'wo' || s.includes('walkover')) return 'walkover';
  if (s === 'retired' || s === 'ret' || s === 'ret.' || s.includes('retired')) return 'retired';
  if (s === 'cancelled' || s === 'canceled' || s === 'canc') return 'cancelled';
  if (s === 'postponed' || s === 'postp.') return 'scheduled';
  if (s === 'not started' || s === 'sched' || s === 'scheduled') return 'scheduled';

  // Live indicators
  if (/^set\s*\d/i.test(s)) return 'live';
  if (/^\d+(st|nd|rd|th)\s+set/i.test(s)) return 'live';
  if (/^\d+:\d+$/.test(s)) return 'live';
  if (s === 'live' || s === 'in progress') return 'live';

  // If there's a score but status is unclear, assume completed
  if (hasScore) return 'completed';

  return 'scheduled';
}

// ── Generate stable match IDs ───────────────────────────────────────────────

function generateMatchId(round, p1Name, p2Name) {
  const key = `${round}-${(p1Name || '').toLowerCase()}-${(p2Name || '').toLowerCase()}`;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = ((hash << 5) - hash) + key.charCodeAt(i);
    hash |= 0;
  }
  return `fs-${Math.abs(hash).toString(36)}`;
}

// ── Generate player IDs from names ──────────────────────────────────────────

function playerIdFromName(name) {
  if (!name) return null;
  return 'fs-' + name.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// ── Parse time string to ISO 8601 ──────────────────────────────────────────

function parseStartTime(timeStr, dateStr) {
  if (!timeStr && !dateStr) return null;

  const now = new Date();
  let day = now.getUTCDate();
  let month = now.getUTCMonth() + 1;
  let year = now.getUTCFullYear();

  if (dateStr) {
    const parts = dateStr.match(/(\d{1,2})[./](\d{1,2})[./](\d{2,4})/);
    if (parts) {
      day = parseInt(parts[1], 10);
      month = parseInt(parts[2], 10);
      year = parseInt(parts[3], 10);
      if (year < 100) year += 2000;
    }
  }

  if (timeStr) {
    const timeParts = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (timeParts) {
      const hours = parseInt(timeParts[1], 10);
      const minutes = parseInt(timeParts[2], 10);
      const utcHours = hours - TIMEZONE_OFFSET_HOURS;
      const pad = n => String(n).padStart(2, '0');
      return `${year}-${pad(month)}-${pad(day)}T${pad(utcHours)}:${pad(minutes)}:00Z`;
    }
  }

  return null;
}

// ── Extract matches from the current page (runs in browser context) ─────────
//
// FlashScore DOM structure (as of April 2026):
//   Round headers:  <div class="event__round event__round--static">1/32-finals</div>
//   Match rows:     <div class="event__match event__match--twoLine ..." id="g_2_XXXXX">
//     Participants: <div class="... event__homeParticipant">Name (Country)</div>
//                   <div class="... event__awayParticipant">Name (Country)</div>
//     Scores:       <div class="... event__score--home">6</div> (per set)
//     Status:       <div class="event__stage--block">Finished</div>
//     Time:         <div class="event__time">14:00</div>

async function extractMatches(page, defaultRound = null) {
  return page.evaluate((defaultRound) => {
    const matches = [];
    let currentRound = defaultRound;  // Use default for matches before first round header
    let seenMainDrawRound = false;
    let inQualification = false;

    // Main-draw-specific round labels (never appear in qualification)
    const MAIN_DRAW_LABELS = ['1/32', '1/64', '1/16', '1/8', 'quarter'];
    // Ambiguous round labels (appear in both main draw and qualifying)
    const AMBIGUOUS_LABELS = ['semi', 'final'];

    // Helper: safely get className as a string (SVG elements return SVGAnimatedString)
    function getClassName(el) {
      if (!el) return '';
      return typeof el.className === 'string' ? el.className : (el.className?.baseVal || '');
    }

    // Query all round headers and match rows
    const allElements = document.querySelectorAll(
      '.event__round, .event__match'
    );

    for (const el of allElements) {
      const cn = getClassName(el);

      // ── Round header ──
      if (cn.includes('event__round') && !cn.includes('event__match')) {
        const roundText = (el.textContent || '').trim();
        const lower = roundText.toLowerCase();

        // Detect if this is a main-draw-specific round
        if (MAIN_DRAW_LABELS.some(label => lower.includes(label))) {
          seenMainDrawRound = true;
          inQualification = false;
        }
        // If we've already seen main-draw rounds and now see an ambiguous
        // label (Semi-finals, Final), we've crossed into qualification
        else if (seenMainDrawRound && AMBIGUOUS_LABELS.some(label => lower.includes(label))) {
          inQualification = true;
        }

        currentRound = inQualification ? null : roundText;
        continue;
      }

      // ── Match row ──
      if (cn.includes('event__match')) {
        // Skip qualification matches
        if (!currentRound || inQualification) continue;

        try {
          // FlashScore match ID: element id is "g_2_XXXXX"
          const elId = el.id || '';
          const fsMatchId = elId.replace(/^g_\d+_/, '') || null;

          // Player names — FlashScore now uses event__homeParticipant / event__awayParticipant
          const p1El = el.querySelector(
            '.event__homeParticipant, .event__participant--home, [class*="homeParticipant"]'
          );
          const p2El = el.querySelector(
            '.event__awayParticipant, .event__participant--away, [class*="awayParticipant"]'
          );
          let p1Name = p1El ? p1El.textContent.trim() : null;
          let p2Name = p2El ? p2El.textContent.trim() : null;

          // Strip country suffix: "Atmane T. (Fra)" → "Atmane T."
          // FlashScore appends "(Xxx)" country codes to all player names.
          // These must be removed for name matching against the seed draw.
          if (p1Name) p1Name = p1Name.replace(/\s*\([A-Za-z]{2,4}\)\s*$/, '').trim();
          if (p2Name) p2Name = p2Name.replace(/\s*\([A-Za-z]{2,4}\)\s*$/, '').trim();

          if (!p1Name || !p2Name) continue;

          // Scores: event__score--home and event__score--away (one per set)
          // Also check for event__part elements which contain per-set scores
          let score = null;
          const homeSets = el.querySelectorAll('.event__score--home, .event__part--home');
          const awaySets = el.querySelectorAll('.event__score--away, .event__part--away');
          if (homeSets.length > 0 && awaySets.length > 0) {
            const sets = [];
            for (let i = 0; i < Math.min(homeSets.length, awaySets.length); i++) {
              const h = (homeSets[i].textContent || '').trim();
              const a = (awaySets[i].textContent || '').trim();
              // Skip empty scores and game scores (15, 30, 40, AD)
              if (h && a && !['15','30','40','AD','A'].includes(h) && !['15','30','40','AD','A'].includes(a)) {
                sets.push(`${h}-${a}`);
              }
            }
            if (sets.length > 0) score = sets.join(', ');
          }

          // Match status
          const statusEl = el.querySelector(
            '.event__stage--block, .event__stage'
          );
          let statusText = statusEl ? statusEl.textContent.trim() : null;

          // FlashScore adds --scheduled CSS class to upcoming matches
          if (cn.includes('--scheduled') && !statusText) {
            statusText = 'scheduled';
          }

          // Match time (may include date like "24.04. 10:00")
          const timeEl = el.querySelector('.event__time');
          const rawTimeText = timeEl ? timeEl.textContent.trim() : null;

          // Parse out date and time from combined strings like "24.04. 10:00"
          let timeText = null;
          let dateText = null;
          if (rawTimeText) {
            const dateTimeMatch = rawTimeText.match(/(\d{1,2}\.\d{1,2}\.)\s*(\d{1,2}:\d{2})/);
            if (dateTimeMatch) {
              dateText = dateTimeMatch[1];
              timeText = dateTimeMatch[2];
            } else if (rawTimeText.match(/^\d{1,2}:\d{2}$/)) {
              timeText = rawTimeText;
            }
          }

          matches.push({
            fsMatchId,
            round: currentRound,
            p1Name,
            p2Name,
            score,
            statusText,
            timeText,
            dateText,
            hasScore: !!score,
          });
        } catch (_) {
          // Skip malformed match elements
        }
      }
    }

    return matches;
  }, defaultRound);
}

// ── Main scraping function ──────────────────────────────────────────────────

async function scrapeFlashScore() {
  log('Starting FlashScore scrape...');

  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-blink-features=AutomationControlled',
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      locale: 'en-GB',
      extraHTTPHeaders: {
        'Accept-Language': 'en-GB,en;q=0.9',
      },
    });

    const page = await context.newPage();

    // Block images, fonts, media, and tracking scripts to speed up loading
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      const url = route.request().url();
      // Block heavy resources
      if (['image', 'font', 'media'].includes(type)) {
        return route.abort();
      }
      // Block known ad/tracking domains that cause networkidle to never fire
      if (url.includes('googlesyndication') || url.includes('doubleclick') ||
          url.includes('googletagmanager') || url.includes('facebook.net') ||
          url.includes('analytics') || url.includes('onetrust.com')) {
        return route.abort();
      }
      return route.continue();
    });

    const allRawMatches = new Map();

    function rawMatchKey(m) {
      if (m.fsMatchId) return m.fsMatchId;
      const names = [m.p1Name, m.p2Name].sort().join('|').toLowerCase();
      return `${(m.round || 'unknown').toLowerCase()}-${names}`;
    }

    // Helper: navigate to a FlashScore page and wait for match content
    async function navigateAndWait(url) {
      log(`Navigating to: ${url}`);
      // Use domcontentloaded — networkidle never fires on FlashScore due to
      // endless ad scripts and tracking pixels.
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });

      // Wait for FlashScore's JS to render match data (up to 15s)
      await page.waitForSelector('.event__match, [class*="event__match"]', { timeout: 15000 })
        .catch(() => null);

      // Extra settle time for any late-rendering JS
      await page.waitForTimeout(3000);

      // Accept cookies if the banner appears (blocks content on first visit)
      try {
        const cookieBtn = page.locator('#onetrust-accept-btn-handler');
        if (await cookieBtn.isVisible({ timeout: 1000 })) {
          await cookieBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (_) {}

      // Click "Show more matches" if available
      try {
        const showMore = page.locator('a.event__more, .event__more--static');
        if (await showMore.isVisible({ timeout: 2000 })) {
          await showMore.click();
          await page.waitForTimeout(2000);
        }
      } catch (_) {}
    }

    // ── Step 1: Scrape LIVE + UPCOMING ──────────────────────────────────
    await navigateAndWait(FLASHSCORE_URL);

    // Debug: log what the page looks like
    const liveTitle = await page.title();
    const liveMatchCount = await page.locator('.event__match, [class*="event__match"]').count();
    log(`Live page title: "${liveTitle}", visible match elements: ${liveMatchCount}`);

    // Pass DEFAULT_ROUND_LABEL for matches at top of live page with no round header
    const liveMatches = await extractMatches(page, DEFAULT_ROUND_LABEL);
    log(`Live/upcoming page: ${liveMatches.length} matches extracted`);
    for (const m of liveMatches) allRawMatches.set(rawMatchKey(m), m);

    // ── Step 2: Scrape RESULTS (completed matches) ──────────────────────
    await navigateAndWait(RESULTS_URL);

    const resultMatches = await extractMatches(page);
    log(`Results page: ${resultMatches.length} matches found`);

    // Results override live data (more authoritative for completed matches)
    for (const m of resultMatches) {
      const key = rawMatchKey(m);
      if (m.hasScore || !allRawMatches.has(key)) {
        allRawMatches.set(key, m);
      }
    }

    const rawList = Array.from(allRawMatches.values());
    log(`Combined unique raw matches: ${rawList.length}`);

    return rawList;
  } finally {
    await browser.close();
  }
}

// ── Transform raw FlashScore data to internal fixture format ────────────────

function transformToFixtures(rawMatches) {
  return rawMatches.map(m => {
    const round = normalizeRound(m.round);
    if (!round) return null;

    const p1Name = m.p1Name;
    const p2Name = m.p2Name;
    const p1Id = playerIdFromName(p1Name);
    const p2Id = playerIdFromName(p2Name);
    const matchId = m.fsMatchId ? `fs-${m.fsMatchId}` : generateMatchId(round, p1Name, p2Name);

    const status = normalizeStatus(m.statusText, m.hasScore);
    const startTime = parseStartTime(m.timeText, m.dateText);

    // Winner detection from set scores
    let winnerId = null;
    let winnerName = null;
    if (status === 'completed' && m.score) {
      const sets = m.score.split(',').map(s => s.trim());
      let p1Sets = 0;
      let p2Sets = 0;
      for (const set of sets) {
        const parts = set.match(/(\d+)-(\d+)/);
        if (parts) {
          const s1 = parseInt(parts[1], 10);
          const s2 = parseInt(parts[2], 10);
          if (s1 > s2) p1Sets++;
          else if (s2 > s1) p2Sets++;
        }
      }
      if (p1Sets > p2Sets) { winnerId = p1Id; winnerName = p1Name; }
      else if (p2Sets > p1Sets) { winnerId = p2Id; winnerName = p2Name; }
    }

    // Walkover/retirement: winner is the opponent of the retired/walkover player
    const isWalkover = status === 'walkover';
    const isRetired = status === 'retired';
    if ((isWalkover || isRetired) && m.score) {
      const sets = m.score.split(',').map(s => s.trim());
      let p1Sets = 0;
      let p2Sets = 0;
      for (const set of sets) {
        const parts = set.match(/(\d+)-(\d+)/);
        if (parts) {
          if (parseInt(parts[1]) > parseInt(parts[2])) p1Sets++;
          else if (parseInt(parts[2]) > parseInt(parts[1])) p2Sets++;
        }
      }
      if (p1Sets >= p2Sets) { winnerId = p1Id; winnerName = p1Name; }
      else { winnerId = p2Id; winnerName = p2Name; }
    }

    const isWithdrawal = isWalkover;
    const withdrawnPlayerId = isWalkover && winnerId
      ? (winnerId === p1Id ? p2Id : p1Id)
      : null;

    return {
      matchId,
      round,
      player1Id: p1Id,
      player1Name: p1Name,
      player2Id: p2Id,
      player2Name: p2Name,
      winnerId,
      winnerName,
      status,
      startTime,
      score: m.score || null,
      isWithdrawal,
      withdrawnPlayerId,
    };
  }).filter(Boolean);
}

// ── POST results to backend ─────────────────────────────────────────────────

async function postToBackend(fixtures) {
  const url = `${BACKEND_URL}/api/admin/scrape-results`;
  log(`POSTing ${fixtures.length} fixtures to ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_SECRET}`,
    },
    body: JSON.stringify({
      fixtures,
      scrapedAt: new Date().toISOString(),
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`Backend returned ${response.status}: ${JSON.stringify(data)}`);
  }

  log(`Backend accepted: ${data.stored} fixtures stored. ` +
    `Completed: ${data.completed}, Live: ${data.live}`);
  return data;
}

async function triggerProcessResults() {
  const url = `${BACKEND_URL}/api/admin/process-results`;
  log(`Triggering results processing: ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_SECRET}`,
    },
    body: JSON.stringify({}),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(`process-results returned ${response.status}: ${JSON.stringify(data)}`);
  }

  log(`Results processing complete: ${JSON.stringify(data.result || data)}`);
  return data;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now();
  log('=== FlashScore cloud scraper starting ===');

  try {
    if (!ADMIN_SECRET && !DRY_RUN) {
      throw new Error('ADMIN_SECRET environment variable not set. Use --dry-run to test without posting.');
    }

    // Scrape
    const rawMatches = await scrapeFlashScore();

    if (rawMatches.length === 0) {
      log('No matches found — tournament may not have started or FlashScore structure changed. Exiting without POSTing.');
      return;
    }

    // Transform to internal format
    const fixtures = transformToFixtures(rawMatches);

    // Summary
    const roundCounts = {};
    for (const f of fixtures) roundCounts[f.round] = (roundCounts[f.round] || 0) + 1;
    const completed = fixtures.filter(f => f.status === 'completed').length;
    const live = fixtures.filter(f => f.status === 'live').length;
    const scheduled = fixtures.filter(f => f.status === 'scheduled').length;
    const walkovers = fixtures.filter(f => f.status === 'walkover').length;
    const retired = fixtures.filter(f => f.status === 'retired').length;
    const withTimes = fixtures.filter(f => f.startTime).length;

    log(`Transformed: ${fixtures.length} valid fixtures from ${rawMatches.length} raw matches`);
    log(`  Completed: ${completed}, Live: ${live}, Scheduled: ${scheduled}, Walkovers: ${walkovers}, Retired: ${retired}`);
    log(`  With start times: ${withTimes}`);
    log(`  Rounds: ${JSON.stringify(roundCounts)}`);

    if (fixtures.length === 0) {
      log('No valid fixtures after transformation — check round mapping. Exiting without POSTing.');
      return;
    }

    if (DRY_RUN) {
      log('DRY RUN — not posting to backend. Fixture summary:');
      // Print a compact summary rather than full JSON
      for (const f of fixtures) {
        const w = f.winnerName ? ` → ${f.winnerName}` : '';
        log(`  [${f.round}] ${f.player1Name} vs ${f.player2Name} | ${f.status}${w} | ${f.score || 'no score'}`);
      }
    } else {
      // POST fixtures to backend
      await postToBackend(fixtures);

      // Trigger results processing (grades picks based on new match data)
      try {
        await triggerProcessResults();
      } catch (err) {
        // Log but don't fail — the fixtures are already stored
        logError('process-results trigger failed (fixtures still stored)', err);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    log(`=== Scraper run completed in ${elapsed}s ===`);

  } catch (err) {
    logError('Scraper run failed', err);
    process.exit(1);
  }
}

main();
