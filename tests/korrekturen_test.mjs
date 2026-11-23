// Build 144: the points a review found.
//   - one confirmDialog; Escape and a click beside it answer "no"
//   - the old block pbc_load_image generates Python again
//   - Stop ends Sprite.glide_to and a moving turtle at once
//   - the status line in the terminal header follows the emulator
//   - <html lang>, footer links reachable by keyboard
//   - names the completion offers exist in the emulator
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';
import { dialogeBestaetigen } from './dialoge.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
let fehler = 0;
const pruefe = (ok, text) => { console.log((ok ? 'ok     ' : 'FEHLER ') + text); if (!ok) fehler++; };

const srv = await starteServer(STUDIO, { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
const bereit = (page) => page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
try {
  // ---------------------------------------------------------------- dialogs (answered by hand)
  let page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let nativ = 0;
  page.on('dialog', (d) => { nativ++; d.accept(); });
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await bereit(page);
  pruefe(await page.evaluate(() => document.documentElement.lang) === 'de', 'html lang ist "de"');

  const frage = async (aufruf, antwort) => {
    await page.evaluate((a) => { window.__erg = 'offen'; eval(a).then((v) => { window.__erg = v; }); }, aufruf);
    await page.waitForSelector('.pbc-confirm');
    await antwort();
    await page.waitForTimeout(150);
    return page.evaluate(() => ({ erg: window.__erg, weg: !document.querySelector('.pbc-confirm') }));
  };
  let r = await frage("confirmDialog('Titel', 'Text')", () => page.keyboard.press('Escape'));
  pruefe(r.erg === false && r.weg, 'Escape beantwortet den Dialog mit nein');
  r = await frage("confirmDialog('Titel', 'Text')", () => page.mouse.click(5, 5));
  pruefe(r.erg === false && r.weg, 'Klick daneben beantwortet den Dialog mit nein');
  r = await frage("confirmDialog('Titel', 'Text')", () => page.keyboard.press('Enter'));
  pruefe(r.erg === true && r.weg, 'Enter bestätigt');
  r = await frage("confirmDialog('Titel', 'Text', 'Ja bitte', 'Lieber nicht')", async () => {
    const t = await page.$$eval('.pbc-confirm button', (bs) => bs.map((b) => b.textContent));
    pruefe(t.join('|') === 'Lieber nicht|Ja bitte', 'eigene Beschriftungen: ' + t.join('|'));
    await page.click('.pbc-confirm [data-dlg="no"]');
  });
  pruefe(r.erg === false, 'Nein-Knopf');
  r = await frage("confirmDelete('Variable löschen?')", async () => {
    const b = await page.$eval('.pbc-confirm [data-dlg="yes"]', (b) => ({ t: b.textContent, rot: !b.classList.contains('primary') && !!b.style.background }));
    pruefe(b.t === 'Löschen' && b.rot, 'Löschabfrage hat den roten Knopf „Löschen“');
    await page.click('.pbc-confirm [data-dlg="yes"]');
  });
  pruefe(r.erg === true, 'Löschen bestätigt');
  pruefe(await page.evaluate(() => (document.documentElement.innerHTML.match(/function confirmDialog\(/g) || []).length) === 1,
         'confirmDialog ist nur einmal definiert');

  // "Neu" asks in the page's own dialog, not with the browser's confirm()
  await page.evaluate(() => document.getElementById('btn-new').click());   // sits in the Dateien menu
  await page.waitForSelector('.pbc-confirm');
  await page.keyboard.press('Escape');
  pruefe(nativ === 0, '„Neu“ fragt im eigenen Dialog (kein confirm() des Browsers)');

  // footer links: real links, reachable with the keyboard
  const fuss = await page.$$eval('.page-footer a', (as) => as.map((a) => a.tabIndex === 0 && a.hasAttribute('href')));
  pruefe(fuss.length === 3 && fuss.every(Boolean), 'Fußzeile: drei Links mit href, per Tab erreichbar');
  await page.focus('#footer-impressum');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(300);
  pruefe(await page.evaluate(() => !!document.querySelector('.modal-bg.show .modal h2') && !location.hash),
         'Impressum öffnet mit Enter, die Adresse bekommt kein „#“');
  await page.keyboard.press('Escape');

  // old block without a sidebar entry
  const code = await page.evaluate(() => {
    const b = workspace.newBlock('pbc_load_image');
    const c = PY.blockToCode(b);
    b.dispose();
    return Array.isArray(c) ? c[0] : String(c);
  });
  pruefe(/^pbc\.load_image\('.*'\)$/.test(code), 'pbc_load_image erzeugt Python: ' + code);

  // completion
  r = await page.evaluate(() => pyObjektArten('held = pbc.Sprite(bild)\nfigur = pbc.sprite("a.png")\n'));
  pruefe(r.held === 'sprite' && r.figur === 'sprite', 'pbc.Sprite(...) und pbc.sprite(...) werden als Sprite erkannt');
  await page.close();

  // ---------------------------------------------------------------- emulator
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());
  await dialogeBestaetigen(page);
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await bereit(page);
  const status = () => page.$eval('#conn-info', (e) => e.textContent);
  pruefe(await status() === 'nicht verbunden', 'Status vor dem Verbinden: ' + await status());
  await page.click('#target-emulator');
  await page.click('#btn-connect');
  await page.waitForTimeout(800);
  pruefe(await status() === 'verbunden (Emulator)', 'Status mit Emulator: ' + await status());

  const termText = () => page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  const laeuft = () => page.evaluate(() => !!(window.emuWorkerLaeuft && window.emuWorkerLaeuft()));
  const lade = async (name, text) => {
    const datei = path.join(os.tmpdir(), 'pbc_korr_' + name + '.py');
    fs.writeFileSync(datei, text);
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', datei);
    await page.waitForTimeout(600);
    await page.click('#btn-test');
  };
  // Without the fix Stop only works when the watchdog kills the worker
  // (WK_STOP_FRIST_MS); with it the program ends within a frame or two.
  const frist = 400;   // WK_STOP_FRIST_MS in src/js/c3_emulator_worker.js
  const stopFall = async (name, text) => {
    await lade(name, text);
    await page.waitForTimeout(2500);
    const vorher = await laeuft();
    const t0 = Date.now();
    await page.click('#btn-stop');
    for (let i = 0; i < 100 && await laeuft(); i++) await page.waitForTimeout(20);
    const dauer = Date.now() - t0;
    pruefe(vorher && !(await laeuft()) && dauer < frist - 100,
           `${name}: Stop beendet in ${dauer} ms (Notbremse erst nach ${frist} ms)`);
  };
  await stopFall('glide', 'import pbc\nc = pbc.Canvas(16, 16)\nc.fill(pbc.RED)\ns = pbc.Sprite(c)\ns.show()\nwhile True:\n    s.glide_to(200, 200, 4000)\n    s.glide_to(10, 10, 4000)\n');
  await stopFall('turtle', 'import turtle\nt = turtle.Turtle()\nt.speed(1)\nwhile True:\n    t.forward(60)\n    t.left(90)\n');

  await lade('namen', 'import pbc, turtle\nc = turtle.get_canvas()\nprint("canvas", c.width, c.height)\npbc.help()\ntry:\n    pbc.on_press_a(print)\nexcept NotImplementedError as e:\n    print("FEHLT:", e)\ntry:\n    pbc.menu()\nexcept NotImplementedError as e:\n    print("FEHLT:", e)\n');
  for (let i = 0; i < 100 && !/menu\(\) works only/.test(await termText()); i++) await page.waitForTimeout(100);
  const aus = await termText();
  pruefe(/canvas 240 280/.test(aus), 'turtle.get_canvas() gibt es im Emulator');
  pruefe(/quick reference/.test(aus) && /on_press_a\(\) works only on the real PBC\+/.test(aus) && /menu\(\) works only/.test(aus),
         'pbc.help, pbc.on_press_a, pbc.menu: vorhanden, mit klarer Meldung');

  await page.click('#emu-close-btn');
  pruefe(await status() === 'nicht verbunden', 'Status nach dem Schließen: ' + await status());
  await page.close();

  // ---------------------------------------------------------------- English
  page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript(() => { try { localStorage.setItem('pbc.lang', 'en'); } catch (_) {} });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await bereit(page);
  pruefe(await page.evaluate(() => document.documentElement.lang) === 'en', 'html lang ist "en" in der englischen Fassung');
  pruefe(await page.$eval('#conn-info', (e) => e.textContent) === 'not connected', 'Status englisch');
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
