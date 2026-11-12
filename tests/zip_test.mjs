// "ZIP hochladen…" in the image manager: every PNG of a ZIP goes into
// the emulator's storage without the image editor, pixel for pixel.
// The ZIP mixes deflated and stored entries, a folder, macOS extras
// and a non-PNG file.
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
const MATERIAL = path.resolve(HIER, '../../buecher/showcase_bloecke/material');
let fehler = 0;
const pruefe = (ok, text) => { console.log((ok ? 'ok     ' : 'FEHLER ') + text); if (!ok) fehler++; };

const ordner = fs.mkdtempSync(path.join(os.homedir(), '.cache', 'pbc-zip-'));
const zip = path.join(ordner, 'bilder.zip');
const namen = ['apfel.png', 'korb.png', 'labyrinth.png', 'meteor.png'];
execFileSync('python3', ['-c', `
import zipfile, sys
m, z = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(z, 'w') as f:
    f.write(m + '/apfel.png', 'apfel.png', zipfile.ZIP_DEFLATED)
    f.write(m + '/korb.png', 'korb.png', zipfile.ZIP_STORED)
    f.write(m + '/labyrinth.png', 'spiel/labyrinth.png', zipfile.ZIP_DEFLATED)
    f.writestr('spiel/', '')
    f.write(m + '/meteor.png', 'meteor.png', zipfile.ZIP_DEFLATED)
    f.writestr('__MACOSX/._apfel.png', b'junk')
    f.writestr('liesmich.txt', 'kein Bild')
`, MATERIAL, zip]);

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.waitForTimeout(1000);
  // the entry sits in the "Dateien" menu
  await page.evaluate(() => document.getElementById('btn-images').click());
  await page.waitForSelector('#img-zip-btn', { state: 'visible' });
  pruefe(true, 'Knopf „ZIP hochladen…“ sichtbar');
  await page.setInputFiles('#file-zip', zip);
  await page.waitForFunction((namen) => namen.every((n) => KNOWN_IMAGES.includes(n)), namen, { timeout: 15000 }).catch(() => {});
  const ergebnis = await page.evaluate(async (namen) => {
    const pixel = (blob) => new Promise((ok) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ok({ w: c.width, h: c.height, d: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) });
      };
      img.onerror = () => ok(null);
      img.src = URL.createObjectURL(blob);
    });
    const aus = {};
    for (const n of namen) {
      const b = await window.__emuImgGet(n);
      aus[n] = b ? await pixel(b) : null;
    }
    aus.__liste = KNOWN_IMAGES.slice();
    aus.__txt = !!(await window.__emuImgGet('liesmich.txt'));
    aus.__mac = !!(await window.__emuImgGet('._apfel.png'));
    return aus;
  }, namen);
  // Originals, decoded the same way
  const orig = await page.evaluate(async (dateien) => {
    const aus = {};
    for (const [n, b64] of dateien) {
      const blob = new Blob([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], { type: 'image/png' });
      aus[n] = await new Promise((ok) => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          ok({ w: c.width, h: c.height, d: Array.from(ctx.getImageData(0, 0, c.width, c.height).data) });
        };
        img.src = URL.createObjectURL(blob);
      });
    }
    return aus;
  }, namen.map((n) => [n, fs.readFileSync(path.join(MATERIAL, n)).toString('base64')]));
  for (const n of namen) {
    const a = ergebnis[n], b = orig[n];
    const gleich = a && b && a.w === b.w && a.h === b.h && a.d.every((v, i) => v === b.d[i]);
    pruefe(gleich, `${n} im Emulator gespeichert, Pixel gleich`);
    pruefe(ergebnis.__liste.includes(n), `${n} in der Bilderliste`);
  }
  pruefe(!ergebnis.__txt, 'Textdatei aus der ZIP nicht übernommen');
  pruefe(!ergebnis.__mac, 'macOS-Beiwerk (__MACOSX/._…) nicht übernommen');
  const bildeditor = await page.evaluate(() => {
    const m = document.getElementById('ie-modal');
    return !m || m.classList.contains('show');
  });
  pruefe(!bildeditor, 'Bildeditor bleibt zu');
  pruefe(seitenfehler.length === 0, 'keine Seitenfehler' + (seitenfehler.length ? ': ' + seitenfehler.join(' | ') : ''));
} finally {
  await browser.close();
  srv.schliessen();
  fs.rmSync(ordner, { recursive: true, force: true });
}
process.exit(fehler ? 1 : 0);
