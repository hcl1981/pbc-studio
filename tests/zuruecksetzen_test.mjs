// Build 145: "Dateisystem zurücksetzen…" in the Files menu.
//   - without a PBC+ nothing happens but a hint
//   - the warning dialog names what is lost; Cancel and Escape send nothing
//   - "Alles löschen" sends the formatting code; the result is reported
// The device is faked here (serialPort, runOnDevice). The Python code
// itself was run against the firmware in PBConPC.
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

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
const bereit = (page) => page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
const waehle = (page) => page.evaluate(() => document.querySelector('button[data-action="reset-filesystem"]').click());
const toasts = (page) => page.evaluate(() => [...document.querySelectorAll('.toast')].map((e) => e.textContent).join(' | '));
try {
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let nativ = 0;
  page.on('dialog', (d) => { nativ++; d.accept(); });
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await bereit(page);

  pruefe(await page.$eval('button[data-action="reset-filesystem"]', (e) => e.textContent) === 'Dateisystem zurücksetzen…',
         'Menüpunkt im Menü Dateien');
  await waehle(page);
  await page.waitForTimeout(300);
  pruefe(!(await page.$('.pbc-confirm')) && /nur mit einem verbundenen PBC\+/.test(await toasts(page)),
         'ohne PBC+: nur ein Hinweis, kein Dialog');

  // a faked device that records what it is sent
  await page.evaluate(() => {
    window.__gesendet = [];
    window.__antwort = { stdout: 'OK main.py\r\n', stderr: '', ok: true };
    serialPort = {}; deviceMode = 'serial';
    runOnDevice = async (code) => { window.__gesendet.push(code); return window.__antwort; };
  });

  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  const d = await page.evaluate(() => {
    const o = document.querySelector('.pbc-confirm');
    const ja = o.querySelector('[data-dlg="yes"]');
    return { text: o.textContent, ja: ja.textContent, nein: o.querySelector('[data-dlg="no"]').textContent,
             rot: ja.style.background.includes('danger'),
             haken: o.querySelector('[data-dlg="check"]').checked,
             hakenText: o.querySelector('label').textContent };
  });
  pruefe(/Dateisystem des PBC\+ zurücksetzen\?/.test(d.text) && /Programme, Block-Projekte, Bilder und das Startmenü/.test(d.text) &&
         /nicht rückgängig/.test(d.text), 'Warndialog nennt, was verloren geht');
  pruefe(d.ja === 'Alles löschen' && d.nein === 'Abbrechen' && d.rot, 'roter Knopf „Alles löschen“ und „Abbrechen“');
  pruefe(d.haken && d.hakenText === 'Startmenü danach neu installieren', 'Häkchen fürs Startmenü, von Haus aus gesetzt');
  await page.click('.pbc-confirm [data-dlg="no"]');
  await page.waitForTimeout(200);
  pruefe((await page.evaluate(() => window.__gesendet.length)) === 0, 'Abbrechen sendet nichts');

  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(200);
  pruefe((await page.evaluate(() => window.__gesendet.length)) === 0, 'Escape sendet nichts');

  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.click('.pbc-confirm [data-dlg="yes"]');
  await page.waitForFunction(() => window.__gesendet.length === 1);
  const code = await page.evaluate(() => window.__gesendet[0]);
  pruefe(/vfs\.umount\('\/'\)/.test(code) && /VfsLfs2\.mkfs\(_b, progsize=256\)/.test(code) && /vfs\.mount\(/.test(code),
         'Alles löschen sendet: aushängen, formatieren, einhängen');
  pruefe(/open\('\/main\.py', 'w'\)/.test(code) && /import pbc\\npbc\.menu\(\)/.test(code), 'mit Häkchen: main.py mit dem Startmenü wird geschrieben');
  await page.waitForTimeout(300);
  pruefe(/Dateisystem zurückgesetzt, Startmenü installiert/.test(await toasts(page)), 'Erfolg wird gemeldet');

  // without the tick: no main.py; the device answers with an empty list
  await page.evaluate(() => { window.__gesendet = []; window.__antwort = { stdout: 'OK \r\n', stderr: '', ok: true }; });
  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.click('.pbc-confirm [data-dlg="check"]');
  await page.click('.pbc-confirm [data-dlg="yes"]');
  await page.waitForFunction(() => window.__gesendet.length === 1);
  await page.waitForTimeout(300);
  pruefe(!/main\.py/.test(await page.evaluate(() => window.__gesendet[0])) && /Der PBC\+ ist jetzt leer/.test(await toasts(page)),
         'ohne Häkchen: kein Startmenü, Gerät leer');
  // a device that still lists files afterwards counts as failed
  await page.evaluate(() => { window.__antwort = { stdout: 'OK alt.py\r\n', stderr: '', ok: true }; });
  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.click('.pbc-confirm [data-dlg="yes"]');
  await page.waitForFunction(() => window.__gesendet.length === 2);
  await page.waitForTimeout(300);
  pruefe(/Zurücksetzen fehlgeschlagen/.test(await toasts(page)), 'unerwartete Dateiliste gilt als Fehler');
  await page.evaluate(() => { window.__gesendet = [0]; });

  await page.evaluate(() => { window.__antwort = { stdout: '', stderr: 'OSError: 5', ok: false }; });
  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.click('.pbc-confirm [data-dlg="yes"]');
  await page.waitForFunction(() => window.__gesendet.length === 2);
  await page.waitForTimeout(300);
  pruefe(/Zurücksetzen fehlgeschlagen/.test(await toasts(page)), 'Fehler wird gemeldet');
  pruefe(nativ === 0, 'kein Dialog des Browsers');
  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  await page.screenshot({ path: path.join(HIER, 'ergebnisse/zuruecksetzen_dialog.png') }).catch(() => {});
  await page.close();

  // ---------------------------------------------------------------- English
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { try { localStorage.setItem('pbc.lang', 'en'); } catch (_) {} });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await bereit(page);
  pruefe(await page.$eval('button[data-action="reset-filesystem"]', (e) => e.textContent) === 'Reset file system…', 'Menüpunkt englisch');
  await page.evaluate(() => { serialPort = {}; deviceMode = 'serial'; runOnDevice = async () => ({ stdout: 'OK main.py', stderr: '' }); });
  await waehle(page);
  await page.waitForSelector('.pbc-confirm');
  const en = await page.$eval('.pbc-confirm', (e) => e.textContent);
  pruefe(/Reset the file system of the PBC\+\?/.test(en) && /Erase everything/.test(en) && /cannot be undone/.test(en) && /Install the launcher again afterwards/.test(en) && !/löschen|Dateien/.test(en),
         'Warndialog englisch');
  await page.screenshot({ path: path.join(HIER, 'ergebnisse/zuruecksetzen_dialog_en.png') }).catch(() => {});
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
