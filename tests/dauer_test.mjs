// Long run with lots of garbage: the emulator must not run out of
// memory although the program itself only ever holds a little.
// Usage: node dauer_test.mjs <file.py> [seconds]
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
const datei = path.resolve(process.argv[2]);
const sekunden = Number(process.argv[3] || 240);

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
let fehler = 1;
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => { console.log('Dialog: ' + d.message().slice(0, 80)); d.accept(); });
  page.on('pageerror', (e) => console.log('Seitenfehler: ' + e.message));
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.waitForTimeout(800);
  console.log('Worker-Emulator: ' + await page.evaluate(() => window.emuWorkerMoeglich && window.emuWorkerMoeglich()));
  const termText = () => page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  await page.setInputFiles('#file-open', datei);
  await page.waitForTimeout(600);
  await page.click('#btn-test');
  const t0 = Date.now();
  let text = '';
  while (Date.now() - t0 < sekunden * 1000) {
    await page.waitForTimeout(2000);
    text = await termText();
    if (/fertig|Error|Traceback/.test(text)) break;
  }
  console.log(text.split('\n').filter(Boolean).slice(-6).join('\n'));
  console.log(`nach ${Math.round((Date.now() - t0) / 1000)} s`);
  fehler = /fertig/.test(text) && !/Error/.test(text) ? 0 : 1;
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler);
