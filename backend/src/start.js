// Diagnostic entry point — catches silent ESM import failures
// that would otherwise kill the process with no output.
console.log('[start.js] Node', process.version, '| PORT=', process.env.PORT);
console.log('[start.js] CWD=', process.cwd());
console.log('[start.js] Loading index.js...');

process.on('uncaughtException', (err) => {
  console.error('[start.js] UNCAUGHT EXCEPTION:', err);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[start.js] UNHANDLED REJECTION:', reason);
});

import('./index.js')
  .then(() => console.log('[start.js] index.js loaded OK'))
  .catch((err) => {
    console.error('[start.js] IMPORT FAILED:', err);
    process.exit(1);
  });
