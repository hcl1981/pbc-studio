// Runs .py programs in the PBC+ Studio emulator (text mode), reports
// errors, saves the console output and takes emulator pictures.
//
//   node pruefe.mjs <datei.py> [...]
//
// What happens with a program is set in pruefung.json next to it
// (all keys optional; pruefung-<kuerzel>.json files are read too):
//
//   "k03_name.py": {
//     "schritte": [ {"eingabe": "Lena"}, {"taste": "ArrowLeft", "ms": 300},
//                   {"warte": 500}, {"bild": "../bilder/k03/emu-k03-name.png"} ],
//     "dauer": 4000,          // ms to let it run after the steps (default 2500)
//     "bild": "../bilder/k03/emu-k03-name.png",   // picture at the end
//     "fehler": "NameError",  // the program is SUPPOSED to fail like this
//     "tasten": false,        // don't press the arrow keys (default: true)
//     "vorher": ["k15_schreiben.py"]  // run these first (same folder)
//   }
//
// Paths are relative to the program's folder. The console text of each
// run is written to <ordner>/ausgaben/<name>.txt (include it in the
// book with "@ausgabe"). Without "schritte" the checker presses every
// arrow key once. A program that waits for input() without an "eingabe"
// step is reported as an error.
import { chromium } from 'playwright';
import { starteServer } from './server.mjs';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const freierPort = () => new Promise((ok) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
});
const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const MATERIAL = path.resolve(process.env.PBC_MATERIAL || path.join(HIER, '../../dokumentation_python/material'));
// PBC_AUSGABE=<dir>: write console output and pictures there instead of
// next to the programs (test runs must not touch the book's files).
const AUSGABE = process.env.PBC_AUSGABE ? path.resolve(process.env.PBC_AUSGABE) : null;
const ausgabeOrdner = (ordner) => AUSGABE || path.join(ordner, 'ausgaben');
const bildZiel = (ordner, rel) => AUSGABE ? path.join(AUSGABE, 'bilder', path.basename(rel)) : path.resolve(ordner, rel);
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
const dateien = process.argv.slice(2).filter((a) => !a.startsWith('--'));

// Visible IDE dialogs: return their texts and close each one.
async function dialoge(page) {
  return page.evaluate(() => {
    const texte = [];
    const offen = [...document.querySelectorAll('body *')].filter((el) => {
      const st = getComputedStyle(el);
      return st.position === 'fixed' && st.display !== 'none' && st.visibility !== 'hidden' &&
             el.offsetWidth > 200 && el.querySelector('button') &&
             (el.classList.contains('show') || !el.classList.contains('modal-bg')) &&
             !el.closest('header') && el.id !== 'emu-panel' && !el.querySelector('#emu-display') &&
             !el.querySelector('#blockly');
    });
    for (const el of offen) {
      const txt = el.innerText.replace(/\s+/g, ' ').trim();
      if (!txt) continue;
      texte.push(txt);
      const knoepfe = [...el.querySelectorAll('button')];
      const ok = knoepfe.find((b) => /^(OK|Verstanden|Schließen|Weiter)$/i.test(b.textContent.trim())) ||
                 knoepfe[knoepfe.length - 1];
      ok.click();
    }
    return texte;
  });
}

const terminalText = (page) => page.evaluate(() => {
  const b = term.buffer.active; let s = '';
  for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n';
  return s;
});
const laeuft = (page) => page.evaluate(() => !!(globalThis.__emu && globalThis.__emu.running));
const wartetAufEingabe = (page) => page.evaluate(() => !!(globalThis.__emu && globalThis.__emu.inputActive));

async function bild(page, ziel) {
  fs.mkdirSync(path.dirname(ziel), { recursive: true });
  await page.locator('#emu-display').screenshot({ path: ziel });
}

const srv = await starteServer(STUDIO, { isolation: true });
const PORT = srv.port;
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: CHROME });
let fehler = 0;
const specs = new Map();
const spec = (d) => {
  const ordner = path.dirname(path.resolve(d));
  if (!specs.has(ordner)) {
    // pruefung.json and every pruefung-<kuerzel>.json of the folder.
    const alle = {};
    for (const f of fs.readdirSync(ordner).filter((n) => /^pruefung.*\.json$/.test(n)).sort()) {
      try { Object.assign(alle, JSON.parse(fs.readFileSync(path.join(ordner, f), 'utf8'))); }
      catch (e) { console.error('Kaputte Prüfdatei ' + f + ': ' + e.message); fehler++; }
    }
    specs.set(ordner, alle);
  }
  return specs.get(ordner)[path.basename(d)] || {};
};
try {
  const page = await browser.newPage({ viewport: { width: 2000, height: 1500 }, deviceScaleFactor: 2 });
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.error('Seitenfehler:', e.message); fehler++; });
  // The IDE loads Blockly, the editor and xterm from CDNs; retry a
  // failed page load a few times.
  for (let versuch = 1; ; versuch++) {
    try {
      await page.goto(`http://127.0.0.1:${PORT}/index.html`);
      await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } },
                                 null, { timeout: 30000 });
      break;
    } catch (e) {
      if (versuch >= 4) throw e;
      console.error('Seite lädt nicht, neuer Versuch …');
      await page.waitForTimeout(3000);
    }
  }
  await page.click('#target-emulator');
  await page.waitForTimeout(1200);
  const pngs = fs.readdirSync(MATERIAL).filter((f) => f.endsWith('.png')).map((f) => path.join(MATERIAL, f));
  if (pngs.length) {
    await page.setInputFiles('#file-image', pngs);
    await page.waitForTimeout(1500);
  }
  // Warm-up: the first run loads MicroPython into the emulator; a
  // program checked in that run could lose its first output.
  {
    const warm = path.join(os.tmpdir(), 'pbc_aufwaermen_' + process.pid + '.py');
    fs.writeFileSync(warm, 'print("bereit")\n');
    await page.setInputFiles('#file-open', warm);
    await page.waitForTimeout(800);
    await dialoge(page);
    await page.click('#btn-test');
    for (let i = 0; i < 300; i++) {
      const t = await terminalText(page);
      if (/bereit/.test(t) && !(await laeuft(page))) break;
      await page.waitForTimeout(100);
    }
    await dialoge(page);
    fs.unlinkSync(warm);
  }
  // "vorher": programs that must run first in the same session (e.g. the
  // one that writes a file this one reads). Move them in front.
  const reihe = [];
  const dazu = (d, tiefe = 0) => {
    if (reihe.includes(d) || tiefe > 5) return;
    for (const v of spec(d).vorher || []) {
      const vp = path.join(path.dirname(d), v);
      if (fs.existsSync(vp)) dazu(vp, tiefe + 1);
    }
    reihe.push(d);
  };
  for (const d of dateien) dazu(d);
  for (const d of reihe) {
    const s = spec(d);
    const ordner = path.dirname(path.resolve(d));
    await page.click('#btn-stop').catch(() => {});
    for (let i = 0; i < 40 && await laeuft(page); i++) await page.waitForTimeout(50);
    await page.waitForTimeout(300);
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', path.resolve(d));
    await page.waitForTimeout(800);
    await dialoge(page);
    await page.click('#btn-test');
    await page.waitForTimeout(1200);
    const probleme = [];
    const spaet = await dialoge(page);

    const schritte = s.schritte || (s.tasten === false ? [] :
      ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].map((k) => ({ taste: k, ms: 250 })));
    for (const st of schritte) {
      if (st.warte) await page.waitForTimeout(st.warte);
      if (st.eingabe !== undefined) {
        let ok = false;
        for (let i = 0; i < 100; i++) {
          if (await wartetAufEingabe(page)) { ok = true; break; }
          await page.waitForTimeout(50);
        }
        if (!ok) { probleme.push('wartet nicht auf Eingabe: ' + st.eingabe); continue; }
        await page.evaluate((t) => term._core.coreService.triggerDataEvent(t + '\r', true), String(st.eingabe));
        await page.waitForTimeout(st.ms || 300);
      }
      if (st.taste) {
        await page.keyboard.down(st.taste);
        await page.waitForTimeout(st.ms || 200);
        await page.keyboard.up(st.taste);
      }
      if (st.bild) await bild(page, bildZiel(ordner, st.bild));
    }
    // Let it run (or finish).
    const ende = Date.now() + (s.dauer || 2500);
    while (Date.now() < ende && await laeuft(page)) await page.waitForTimeout(100);
    if (await wartetAufEingabe(page)) probleme.push('wartet am Ende noch auf eine Eingabe');
    if (s.bild) await bild(page, bildZiel(ordner, s.bild));
    spaet.push(...await dialoge(page));
    const lief = await laeuft(page);
    await page.click('#btn-stop').catch(() => {});
    await page.waitForTimeout(300);

    const text = await terminalText(page);
    // Console text of the run itself, without the IDE's markers.
    let teil = text.split('-- Testlauf --').pop();
    teil = teil.split(/\n-- (fertig|gestoppt|Testlauf beendet) --/)[0];
    teil = teil.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n';
    const name = path.basename(d).replace(/\.py$/, '');
    fs.mkdirSync(ausgabeOrdner(ordner), { recursive: true });
    fs.writeFileSync(path.join(ausgabeOrdner(ordner), name + '.txt'), teil);
    // <name>.erwartet next to the program: the output must match exactly
    const erwartet = path.join(ordner, name + '.erwartet');
    const ohneLeer = (t) => t.split('\n').filter((z) => z.trim()).join('\n');
    if (fs.existsSync(erwartet) && ohneLeer(fs.readFileSync(erwartet, 'utf8')) !== ohneLeer(teil)) {
      probleme.push('Ausgabe weicht von ' + name + '.erwartet ab');
    }

    // The IDE's friendly error hint: expected with "fehler", saved for the book.
    const dialogDatei = path.join(ausgabeOrdner(ordner), name + '.dialog.txt');
    if (s.fehler && spaet.length) fs.writeFileSync(dialogDatei, spaet.join('\n') + '\n');
    else if (fs.existsSync(dialogDatei)) fs.unlinkSync(dialogDatei);
    if (!s.fehler) for (const t of spaet) probleme.push('Dialog: ' + t.slice(0, 200));
    // The run must have started and ended visibly (MicroPython may fail
    // to load from the CDN, which leaves the terminal empty).
    const lauf = text.split('-- Testlauf --').pop();
    if (!/-- (fertig|gestoppt) --|Traceback/.test(lauf)) probleme.push('Programm lief nicht (kein „fertig“/„gestoppt“ im Terminal)');
    const hatFehler = /Traceback|Error:/.test(teil);
    if (s.fehler) {
      if (!teil.includes(s.fehler)) probleme.push('erwarteter Fehler „' + s.fehler + '“ kam nicht');
    } else if (hatFehler) {
      probleme.push('Fehler im Programm');
    }
    if (probleme.length) fehler++;
    console.log((probleme.length ? 'FEHLER ' : 'ok     ') + path.basename(d) +
                (lief ? '  (lief noch)' : '  (beendet)'));
    for (const p of probleme) console.log('  ' + p);
    if (probleme.length) console.log(teil.trim().split('\n').slice(-8).map((z) => '  | ' + z).join('\n'));
  }
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
