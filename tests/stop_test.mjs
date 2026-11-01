// Stop must end every kind of program within a moment: a loop without
// any pause, a loop with sleeps, a program waiting in input().
// Afterwards the next run must work normally.
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

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.waitForTimeout(800);
  console.log('Worker-Emulator: ' + await page.evaluate(() => window.emuWorkerMoeglich && window.emuWorkerMoeglich()));
  const termText = () => page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  const laeuft = () => page.evaluate(() => !!(globalThis.__emu && globalThis.__emu.running) || !!(window.emuWorkerLaeuft && window.emuWorkerLaeuft()));
  const fall = async (name, code, wartezeit) => {
    const datei = path.join(os.tmpdir(), 'pbc_stop_' + name + '.py');
    fs.writeFileSync(datei, code);
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', datei);
    await page.waitForTimeout(600);
    await page.click('#btn-test');
    await page.waitForTimeout(wartezeit);
    const vorher = await laeuft();
    const t0 = Date.now();
    await page.click('#btn-stop');
    for (let i = 0; i < 50 && await laeuft(); i++) await page.waitForTimeout(50);
    const dauer = Date.now() - t0;
    const nachher = await laeuft();
    pruefe(vorher && !nachher && dauer < 1500, `${name}: läuft, nach Stop beendet in ${dauer} ms`);
  };
  await fall('ohne_pause', 'x = 0\nwhile True:\n    x += 1\n', 2500);
  await fall('mit_pause', 'import time\nwhile True:\n    time.sleep_ms(50)\n', 2500);
  await fall('eingabe', 'name = input("Name? ")\nprint(name)\n', 2500);
  // the next run is normal again
  const ok = path.join(os.tmpdir(), 'pbc_stop_danach.py');
  fs.writeFileSync(ok, 'print("wieder da", 6 * 7)\n');
  await page.evaluate(() => term.clear());
  await page.setInputFiles('#file-open', ok);
  await page.waitForTimeout(600);
  await page.click('#btn-test');
  for (let i = 0; i < 100 && !/wieder da/.test(await termText()); i++) await page.waitForTimeout(100);
  pruefe(/wieder da 42/.test(await termText()), 'nächster Lauf nach Stop');
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
