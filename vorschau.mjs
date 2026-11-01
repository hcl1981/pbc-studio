// Lokale Vorschau von dist/index.html mit denselben Headern wie die .htaccess auf STRATO.
// Start: node vorschau.mjs   →   http://localhost:8080
import { starteServer } from './tests/server.mjs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = path.join(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const { port } = await starteServer(wurzel, { isolation: true });
// fester Port 8080 als Weiterleitung auf den Testserver
http.createServer((req, res) => {
  const p = http.request({ host: '127.0.0.1', port, path: req.url, method: req.method, headers: req.headers },
    r => { res.writeHead(r.statusCode, r.headers); r.pipe(res); });
  req.pipe(p);
}).listen(8080, '127.0.0.1', () => console.log('Vorschau: http://localhost:8080  (Strg+C beendet)'));
