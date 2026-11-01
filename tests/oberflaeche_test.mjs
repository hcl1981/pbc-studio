// Small layout details: the target switch must not move when switching
// PBC+/Emulator, "line N" in a traceback is underlined (it is a link),
// the emulator display sits on the board photo at every window size and
// Windows scaling, and the terminal border can be dragged.
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

  const lage = () => page.evaluate(() => ['target-device', 'target-emulator', 'btn-connect', 'btn-reconnect']
    .map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left, r.width].join('/'); }).join(' '));
  const vorher = await lage();
  await page.click('#target-emulator');
  await page.waitForTimeout(300);
  const nachher = await lage();
  await page.click('#target-device');
  await page.waitForTimeout(300);
  const zurueck = await lage();
  pruefe(vorher === nachher && vorher === zurueck, 'Schalter bleiben stehen: ' + vorher + ' | ' + nachher);

  await page.click('#target-emulator');
  await page.click('#btn-connect');
  const datei = path.join(os.tmpdir(), 'pbc_zeilenlink.py');
  fs.writeFileSync(datei, 'x = 1\nprint(y)\n');
  await page.setInputFiles('#file-open', datei);
  await page.waitForTimeout(600);
  await page.click('#btn-test');
  await page.waitForFunction(() => /NameError/.test((() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; })()), null, { timeout: 15000 });
  await page.keyboard.press('Escape');
  const r = await page.evaluate(() => {
    const b = term.buffer.active;
    for (let i = 0; i < b.length; i++) {
      const z = b.getLine(i); const s = z.translateToString(true);
      const at = s.indexOf('line 2');
      if (at < 0 || !/<stdin>/.test(s)) continue;
      const u = (x) => !!z.getCell(x).isUnderline();
      return { text: s, link: [0, 1, 2, 3, 4, 5].every((k) => u(at + k)), davor: u(at - 1), danach: u(at + 6) };
    }
    return null;
  });
  pruefe(r && r.link && !r.davor && !r.danach, '"line 2" unterstrichen: ' + JSON.stringify(r));
  await page.screenshot({ path: path.join(HIER, 'tmp', 'oberflaeche.png') });

  // terminal border: drag up, height is remembered, double click resets
  const hoehe = () => page.evaluate(() => document.querySelector('.terminal-area').getBoundingClientRect().height);
  const h0 = await hoehe();
  const t = await page.evaluate(() => { const r = document.getElementById('terminal-trenner').getBoundingClientRect(); return { x: r.left + 300, y: r.top + r.height / 2 }; });
  await page.mouse.move(t.x, t.y);
  await page.mouse.down();
  await page.mouse.move(t.x, t.y - 150, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const h1 = await hoehe();
  const spalten = await page.evaluate(() => term.rows);
  pruefe(Math.abs(h1 - h0 - 150) <= 2, `Trenner ziehen: ${h0} -> ${h1}, Terminal ${spalten} Zeilen`);
  await page.reload();
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  pruefe(Math.abs(await hoehe() - h1) <= 2, 'Höhe nach Neuladen gemerkt');
  await page.mouse.move(t.x, t.y - 150);
  await page.mouse.dblclick(t.x, t.y - 150);
  await page.waitForTimeout(200);
  pruefe(Math.abs(await hoehe() - h0) <= 2, 'Doppelklick: Standardhöhe');
  await page.close();

  // emulator display on the photo's display, window sizes x Windows scaling
  for (const [w, h, dpr] of [[1440, 900, 1], [1536, 864, 1.25], [1280, 720, 1.5], [1097, 617, 1.75], [960, 540, 2], [1024, 600, 1], [700, 450, 1]]) {
    const p = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: dpr });
    p.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
    await p.goto(`http://127.0.0.1:${srv.port}/index.html`);
    await p.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
    await p.click('#target-emulator');
    await p.click('#btn-connect');
    await p.waitForTimeout(300);
    const r = await p.evaluate(() => {
      const i = document.querySelector('#emu-device img').getBoundingClientRect();
      const c = document.getElementById('emu-display').getBoundingClientRect();
      const pa = document.getElementById('emulator-panel').getBoundingClientRect();
      const ab = Math.max(Math.abs(c.left - (i.left + 0.1281 * i.width)), Math.abs(c.top - (i.top + 0.1275 * i.height)),
        Math.abs(c.width - 0.7422 * i.width), Math.abs(c.height - 0.5092 * i.height));
      return { ab, breite: c.width, unten: pa.bottom <= innerHeight + 0.5 };
    });
    pruefe(r.ab < 1 && r.unten && r.breite >= 120, `Emulator ${w}x${h} bei ${dpr * 100} %: Abweichung ${r.ab.toFixed(2)} px, Anzeige ${r.breite.toFixed(0)} px breit${r.unten ? '' : ', ragt unten heraus'}`);
    await p.close();
  }
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
