// Minimal CJS healthcheck — zero imports, zero dependencies.
// If even THIS fails Railway healthcheck, the issue is infrastructure, not code.
const http = require('http');
const PORT = process.env.PORT || 4000;

console.log('[diag] Starting bare healthcheck on port ' + PORT);

http.createServer(function(req, res) {
  if (req.url === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end('{"ok":true,"diag":"bare"}');
  } else {
    res.writeHead(404);
    res.end('not found');
  }
}).listen(Number(PORT), '0.0.0.0', function() {
  console.log('[diag] Listening on 0.0.0.0:' + PORT);
});
