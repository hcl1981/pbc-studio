// With the headers from src/htaccess (COEP require-corp) the page must be
// cross-origin isolated, every external file must load (require-corp
// blocks files without a CORP header) and the worker emulator must run.
// "credentialless" was used before; Safari does not know it, so the
// emulator did not run on iPad and iPhone.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
let fehler = 0;
const pruefe = (ok, text) => { console.log((ok ? 'ok     ' : 'FEHLER ') + text); if (!ok) fehler++; };

const ht = fs.readFileSync(path.join(STUDIO, '.htaccess'), 'utf8');
pruefe(/Cross-Origin-Embedder-Policy "require-corp"/.test(ht), '.htaccess: COEP require-corp');

const srv = await starteServer(STUDIO);
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const fehlgeschlagen = [];
  page.on('requestfailed', (r) => fehlgeschlagen.push(r.url() + ' ' + (r.failure() || {}).errorText));
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  pruefe(await page.evaluate(() => self.crossOriginIsolated === true), 'crossOriginIsolated');
  // a block on the workspace makes Blockly use its sprites
  await page.evaluate(() => { const b = workspace.newBlock('controls_if'); b.initSvg(); b.render(); });
  await page.waitForTimeout(1500);
  const medien = await page.evaluate(() => performance.getEntriesByType('resource').map(e => e.name).filter(n => /blockly@12\.3\.1\/media\//.test(n)));
  pruefe(medien.length > 0, 'Blockly-Medien von jsdelivr geladen (' + medien.map(m => m.split('/').pop()).join(', ') + ')');
  pruefe(fehlgeschlagen.length === 0, 'keine blockierten Dateien' + (fehlgeschlagen.length ? ': ' + fehlgeschlagen.join(' | ') : ''));
  await page.click('#target-emulator');
  await page.click('#btn-connect');
  await page.waitForTimeout(1500);
  const datei = path.join(os.tmpdir(), 'pbc_iso.py');
  fs.writeFileSync(datei, 'print("hallo iso")\n');
  await page.setInputFiles('#file-open', datei);
  await page.waitForTimeout(600);
  await page.click('#btn-test');
  await page.waitForTimeout(3000);
  const tx = await page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  pruefe(/hallo iso/.test(tx), 'Programm läuft im Worker-Emulator');
  pruefe(!/nötigen Header/.test(tx), 'keine Header-Meldung');
} finally {
  await browser.close();
  srv.schliessen();
}
console.log(fehler ? `${fehler} FEHLER` : 'ALLE OK');
process.exit(fehler ? 1 : 0);
