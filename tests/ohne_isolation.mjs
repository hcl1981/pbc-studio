// Without the COOP/COEP headers (local file, other server) the emulator
// cannot run. It must say why instead of failing silently, and the rest
// of the IDE must keep working.
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

const srv = await starteServer(STUDIO, { isolation: false });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.click('#btn-connect');
  await page.waitForTimeout(800);
  const termText = () => page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  pruefe(/nötigen Header/.test(await termText()), 'Meldung beim Verbinden');
  const datei = path.join(os.tmpdir(), 'pbc_ohne_iso.py');
  fs.writeFileSync(datei, 'print("hallo")\n');
  await page.setInputFiles('#file-open', datei);
  await page.waitForTimeout(600);
  await page.click('#btn-test');
  await page.waitForTimeout(1500);
  const tx = await termText();
  pruefe(!/hallo/.test(tx), 'Programm läuft nicht');
  pruefe((tx.match(/nötigen Header/g) || []).length === 1, 'Meldung nur einmal');
  await page.click('#btn-stop');
  await page.waitForTimeout(300);
  await page.click('#btn-settings');
  await page.waitForTimeout(300);
  const info = await page.evaluate(() => document.getElementById('settings-emu-info').textContent);
  pruefe(/Nicht verfügbar/.test(info), 'Einstellungen: ' + info);
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
