// Tiny static server for the tests. Serves dist/ and, with
// isolation=true, sends the same COOP/COEP headers as src/htaccess, so
// the worker emulator (SharedArrayBuffer) is active.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const TYPEN = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript',
                '.css': 'text/css', '.png': 'image/png', '.json': 'application/json', '.uf2': 'application/octet-stream' };

export function starteServer(wurzel, { isolation = true } = {}) {
  return new Promise((ok) => {
    const server = http.createServer((req, res) => {
      let p = decodeURIComponent(req.url.split('?')[0]);
      if (p.endsWith('/')) p += 'index.html';
      const datei = path.join(wurzel, p);
      if (!datei.startsWith(wurzel) || !fs.existsSync(datei)) { res.writeHead(404); res.end(); return; }
      const kopf = { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' };
      if (isolation) {
        kopf['Cross-Origin-Opener-Policy'] = 'same-origin';
        kopf['Cross-Origin-Embedder-Policy'] = 'credentialless';
      }
      res.writeHead(200, kopf);
      fs.createReadStream(datei).pipe(res);
    });
    server.listen(0, '127.0.0.1', () => ok({ port: server.address().port, schliessen: () => server.close() }));
  });
}
