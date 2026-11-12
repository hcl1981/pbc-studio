// Emulator controls by mouse and touch (iPad): one zone over the
// joystick module gives the direction from the cap centre, sliding
// changes it, the cap is MITTE; A is the left, B the right button.
import { chromium } from 'playwright';
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

const srv = await starteServer(STUDIO);
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const ctx = await browser.newContext({ viewport: { width: 1180, height: 820 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.click('#btn-connect');
  await page.waitForTimeout(1500);
  const geraet = await page.locator('#emu-device').boundingBox();
  // point in the 609x1035 picture -> page coordinates
  const p = (x, y) => [geraet.x + x / 609 * geraet.width, geraet.y + y / 1035 * geraet.height];
  const gedrueckt = () => page.evaluate(() => { const e = globalThis.__emu; return Object.keys(e.btn).filter(k => e.btn[k]).join(','); });
  const latch = () => page.evaluate(() => { const e = globalThis.__emu; const r = Object.keys(e.btnWas).filter(k => e.btnWas[k]).join(','); for (const k in e.btnWas) e.btnWas[k] = false; return r; });

  // mouse: each direction, then slide from up to right, then release
  for (const [name, x, y] of [['up', 150, 815], ['down', 150, 965], ['left', 55, 887], ['right', 250, 887], ['center', 152, 889]]) {
    await page.mouse.move(...p(x, y)); await page.mouse.down();
    pruefe(await gedrueckt() === name, `Maus ${name}: ${await gedrueckt()}`);
    await page.mouse.up();
  }
  pruefe(await gedrueckt() === '', 'nach dem Loslassen nichts gedrückt');
  await page.mouse.move(...p(150, 815)); await page.mouse.down();
  await page.mouse.move(...p(250, 880), { steps: 5 });
  pruefe(await gedrueckt() === 'right', `Wischen oben -> rechts: ${await gedrueckt()}`);
  await page.mouse.up();
  await latch();

  // touch: taps on the joystick and on A (left) and B (right)
  for (const [name, x, y] of [['left', 60, 887], ['down', 150, 960], ['a', 368, 885], ['b', 488, 885]]) {
    await page.touchscreen.tap(...p(x, y));
    await page.waitForTimeout(50);
    pruefe(await latch() === name, `Tippen ${name}`);
  }
  // the edges of the white button bodies still hit
  await page.touchscreen.tap(...p(328, 830)); await page.waitForTimeout(50);
  pruefe(await latch() === 'a', 'A am Rand des Tastenkörpers');
  await page.touchscreen.tap(...p(528, 940)); await page.waitForTimeout(50);
  pruefe(await latch() === 'b', 'B am Rand des Tastenkörpers');
  pruefe(await page.evaluate(() => getComputedStyle(document.getElementById('emu-joy')).touchAction) === 'none', 'touch-action none');
} finally {
  await browser.close();
  srv.schliessen();
}
console.log(fehler ? `${fehler} FEHLER` : 'ALLE OK');
process.exit(fehler ? 1 : 0);
