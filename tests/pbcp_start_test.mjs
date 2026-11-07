// Block projects start from the device menu (firmware Nov 2026): a
// saved .pbcp carries the complete program with import lines in "py",
// and the save dialog offers the block project first, in German and
// English.
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
const PROJEKT = fs.readFileSync(path.resolve(HIER, '../../dokumentation/buch/programme/' + 'k06_rechentrainer.pbcp'), 'utf8');
let fehler = 0;
const pruefe = (ok, text) => { console.log((ok ? 'ok     ' : 'FEHLER ') + text); if (!ok) fehler++; };

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  for (const lang of ['de', 'en']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('dialog', (d) => d.accept());
    const seitenfehler = [];
    page.on('pageerror', (e) => seitenfehler.push(e.message));
    await page.addInitScript((l) => { try { localStorage.setItem('pbc.lang', l); } catch (_) {} }, lang);
    await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
    await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
    await page.click('#target-emulator');
    await page.waitForTimeout(800);
    // a book program that needs "import random"
    await page.evaluate((t) => dateitextLaden('k06_rechentrainer.pbcp', t), PROJEKT);
    const vorher = await page.evaluate(() => workspace.getAllBlocks(false).length);
    const py = await page.evaluate(() => JSON.parse(projektText()).py);
    pruefe(/^import pbc/m.test(py) && /^import random/m.test(py), `${lang}: py enthält Importzeilen (${JSON.stringify(py.slice(0, 40))})`);
    await page.evaluate(() => openSaveDialog());
    await page.waitForTimeout(500);
    const d = await page.evaluate(() => ({
      art: document.querySelector('input[name="save-art"]:checked').value,
      name: document.getElementById('save-name').value,
      pbcp: document.getElementById('save-art-pbcp').textContent,
      py: document.getElementById('save-art-py').textContent,
    }));
    pruefe(d.art === '.pbcp' && d.name.endsWith('.pbcp'), `${lang}: Block-Projekt vorausgewählt (${d.name})`);
    const erwartet = lang === 'de' ? /Startmenü/ : /launcher/;
    pruefe(erwartet.test(d.pbcp) && d.py.length > 20, `${lang}: Texte: ${d.pbcp} | ${d.py}`);
    await page.screenshot({ path: path.join(HIER, `ergebnisse/pbcp_dialog_${lang}.png`), clip: { x: 380, y: 150, width: 680, height: 560 } });
    await page.fill('#save-name', 'wuerfel');
    await page.click('#save-confirm');
    await page.waitForTimeout(1500);
    const datei = await page.evaluate(async () => {
      const e = (await window.__emuImgList()).find(x => x.name === 'wuerfel.pbcp');
      return e ? JSON.parse(await e.blob.text()) : null;
    });
    pruefe(datei && /^import random/m.test(datei.py) && datei.json, `${lang}: wuerfel.pbcp im Emulator mit json und vollständigem py`);
    // reopen: becomes blocks again
    const bloecke = await page.evaluate(async () => {
      const e = (await window.__emuImgList()).find(x => x.name === 'wuerfel.pbcp');
      workspace.clear(); ensureStartBlock();
      dateitextLaden('wuerfel.pbcp', await e.blob.text());
      return workspace.getAllBlocks(false).length;
    });
    pruefe(bloecke === vorher && vorher > 10, `${lang}: wieder als Blöcke geöffnet (${bloecke} von ${vorher} Blöcken)`);
    pruefe(seitenfehler.length === 0, `${lang}: keine Seitenfehler ${seitenfehler.join('; ')}`);
    await page.close();
  }
} finally {
  await browser.close();
  srv.close?.();
}
console.log(fehler ? `${fehler} FEHLER` : 'alles ok');
process.exit(fehler ? 1 : 0);
