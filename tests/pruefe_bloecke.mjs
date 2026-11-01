// Runs .pbcp programs in the PBC+ Studio emulator and reports errors.
//
//   node pruefe.mjs <datei.pbcp> [...]      (--code prints the Python)
import { chromium } from 'playwright';
import { starteServer } from './server.mjs';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Free TCP port for the local web server (parallel runs must not clash).
const freierPort = () => new Promise((ok) => {
  const s = net.createServer();
  s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); });
});
const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const MATERIAL = path.resolve(process.env.PBC_MATERIAL || path.join(HIER, '../../dokumentation/material'));
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');
const zeigeCode = process.argv.includes('--code');

// Visible IDE dialogs: returns their texts and closes each one with its
// confirming button (OK / Verstanden / last button).
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
const dateien = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const srv = await starteServer(STUDIO, { isolation: true });
const PORT = srv.port;
await new Promise((r) => setTimeout(r, 800));
const browser = await chromium.launch({ executablePath: CHROME });
let fehler = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } });
  page.on('dialog', (d) => d.accept());
  page.on('pageerror', (e) => { console.error('Seitenfehler:', e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${PORT}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.waitForTimeout(1200);
  const pngs = fs.readdirSync(MATERIAL).filter((f) => f.endsWith('.png')).map((f) => path.join(MATERIAL, f));
  await page.setInputFiles('#file-image', pngs);
  await page.waitForTimeout(1500);
  for (const d of dateien) {
    await page.click('#btn-stop').catch(() => {});
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', path.resolve(d));
    await page.waitForTimeout(800);
    const code = await page.evaluate(() => fullProgram());
    await page.click('#btn-test');
    await page.waitForTimeout(1500);
    // The IDE may ask before running ("Endlosschleife ohne Pause"):
    // note it as a warning and run anyway.
    let warnung = '';
    for (const d of await dialoge(page)) {
      if (/Endlosschleife/.test(d)) warnung = 'Endlosschleife ohne Pause';
    }
    // Press every direction once so all branches of a game loop run.
    await page.waitForTimeout(1500);
    for (const k of ['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) {
      await page.keyboard.down(k); await page.waitForTimeout(250); await page.keyboard.up(k);
    }
    await page.waitForTimeout(1000);
    const term = await page.evaluate(() => {
      const b = term.buffer.active; let s = '';
      for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n';
      return s;
    });
    // Error dialogs of the IDE (they would block the next program).
    const offen = await dialoge(page);
    const kaputt = /Traceback|Error|Fehler/.test(term) || /\(\?\)/.test(code) || offen.length > 0;
    if (kaputt) fehler++;
    console.log((kaputt ? 'FEHLER ' : warnung ? 'WARN   ' : 'ok     ') + path.basename(d) +
                (warnung ? '  (' + warnung + ')' : ''));
    if (kaputt) console.log(term.trim().split('\n').slice(-8).join('\n'));
    for (const t of offen) console.log('  Dialog: ' + t.slice(0, 200));
    if (zeigeCode) console.log(code);
  }
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
