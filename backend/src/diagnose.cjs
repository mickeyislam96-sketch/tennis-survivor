// Diagnostic: passes healthcheck immediately, then tests each import from index.js
const http = require('http');
const PORT = process.env.PORT || 4000;

let status = 'starting';

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: true, status }));
});

server.listen(Number(PORT), '0.0.0.0', () => {
  console.log('[diag] Healthcheck server on 0.0.0.0:' + PORT);
  testImports();
});

async function testImports() {
  const modules = [
    'dotenv/config',
    'node-cron',
    'express',
    'cors',
    'pg',
    'stripe',
    'uuid',
    'bcryptjs',
    'nodemailer',
    'express-rate-limit',
    'node-fetch',
    './db/pool.js',
    './utils/email.js',
    './config/activeTournament.js',
    './services/dataAdapter.js',
    './services/tennisData.js',
    './services/resultsProcessor.js',
    './services/emailScheduler.js',
    './routes/groups.js',
    './routes/pools.js',
    './routes/picks.js',
    './routes/draw.js',
    './routes/leaderboard.js',
    './routes/auth.js',
    './routes/tiebreaker.js',
    './routes/health.js',
    './routes/payments.js',
  ];

  for (const mod of modules) {
    status = 'testing: ' + mod;
    try {
      console.log('[diag] import', mod, '...');
      await import(mod);
      console.log('[diag]  OK:', mod);
    } catch (err) {
      console.error('[diag]  FAIL:', mod);
      console.error('[diag]  Error:', err.message);
      if (err.stack) console.error('[diag]  Stack:', err.stack.split('\n').slice(0, 5).join('\n'));
    }
  }

  status = 'all imports tested';
  console.log('[diag] === All imports tested ===');
}
