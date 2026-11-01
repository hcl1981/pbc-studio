// Checks the text-mode editor helpers: pre-run warnings, error line
// highlight, completion after "pbc.", file name prompt on save.
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
  await page.waitForTimeout(1000);
  const prog = path.join(os.tmpdir(), 'pbc_editor_test.py');
  fs.writeFileSync(prog, 'import pbc\n\npbc.clear()\npbc.txt24("Hi", 10, 10, pbc.WHITE)\ntime.sleep(1)\n');
  await page.setInputFiles('#file-open', prog);
  await page.waitForTimeout(800);
  await page.click('#btn-test');
  await page.waitForFunction(() => /Traceback|Testlauf beendet|gestoppt/.test(
    (() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; })()),
    null, { timeout: 30000 });
  const text = await page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  pruefe(/Hinweis Zeile 4: pbc\.txt24 gibt es nicht\. Meintest du pbc\.text24\?/.test(text), 'Vorprüfung: Tippfehler mit Vorschlag');
  pruefe(/Hinweis Zeile 5: "time" wird benutzt, aber nicht importiert/.test(text), 'Vorprüfung: fehlender Import');
  // close the friendly hint dialog
  await page.evaluate(() => [...document.querySelectorAll('button')].filter((b) => /^OK$/.test(b.textContent.trim()) && b.offsetParent).forEach((b) => b.click()));
  const markiert = await page.evaluate(() => [...document.querySelectorAll('.CodeMirror .cm-fehlerzeile')].length);
  const cursor = await page.evaluate(() => codeEditor.getCursor().line);
  pruefe(markiert === 1 && cursor === 3, 'Fehlerzeile markiert (Zeile 4)');
  // completion
  await page.evaluate(() => { codeEditor.setValue('import pbc\n'); codeEditor.setCursor({ line: 1, ch: 0 }); codeEditor.focus(); });
  await page.keyboard.type('pbc.te');
  await page.waitForTimeout(400);
  let hints = await page.evaluate(() => [...document.querySelectorAll('.CodeMirror-hint')].map((e) => e.textContent));
  if (!hints.length) { await page.keyboard.press('Control+Space'); await page.waitForTimeout(400);
    hints = await page.evaluate(() => [...document.querySelectorAll('.CodeMirror-hint')].map((e) => e.textContent)); }
  pruefe(hints.includes('text24') && hints.includes('text12_width'), 'Vervollständigung nach pbc.te: ' + hints.slice(0, 6).join(', '));
  // tilt pad: hidden until a program uses the tilt sensor
  const sichtbar = () => page.evaluate(() => getComputedStyle(document.getElementById('emu-neigung')).display !== 'none');
  const termText = () => page.evaluate(() => { const b = term.buffer.active; let s = ''; for (let i = 0; i < b.length; i++) s += b.getLine(i).translateToString(true) + '\n'; return s; });
  pruefe(!await sichtbar(), 'Neigungsfeld anfangs ausgeblendet');
  {
    // the running program waits for the tilt, then reports it
    const prog2 = path.join(os.tmpdir(), 'pbc_neigung.py');
    fs.writeFileSync(prog2, 'import pbc, time\nfor i in range(300):\n    if pbc.accel_x_g() < -0.99:\n        break\n    time.sleep_ms(20)\nprint("neigung", round(pbc.accel_x_g(), 1), round(pbc.accel_z(), 1))\n');
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', prog2);
    await page.waitForTimeout(600);
    await page.click('#btn-test');
    await page.waitForTimeout(1000);
    pruefe(await sichtbar(), 'Neigungsfeld erscheint bei Programm mit accel_x_g');
    // drag the dot to the right edge -> x about -1 g
    const feld = await page.locator('#emu-neigung-feld').boundingBox();
    await page.mouse.move(feld.x + feld.width / 2, feld.y + feld.height / 2);
    await page.mouse.down();
    await page.mouse.move(feld.x + feld.width - 2, feld.y + feld.height / 2, { steps: 5 });
    await page.mouse.up();
    const neigung = await page.evaluate(() => globalThis.__emu.neigung);
    pruefe(neigung && neigung[0] < -0.9 && Math.abs(neigung[1]) < 0.1, 'Neigung nach rechts: x = ' + (neigung && neigung[0].toFixed(2)));
    let tx = '';
    for (let i = 0; i < 60 && !/neigung/.test(tx); i++) { await page.waitForTimeout(200); tx = await termText(); }
    pruefe(/neigung -1\.0 0\.0/.test(tx), 'Programm liest die Neigung: ' + (tx.match(/neigung[^\n]*/) || [''])[0]);
    await page.locator('#emu-neigung').screenshot({ path: path.join(HIER, 'ergebnisse', 'neigung.png') });
    // a program without the sensor hides it again (accel only in a comment)
    const prog3 = path.join(os.tmpdir(), 'pbc_ohne_neigung.py');
    fs.writeFileSync(prog3, '# pbc.accel_x() kommt hier nicht vor\nprint("ohne")\n');
    await page.setInputFiles('#file-open', prog3);
    await page.waitForTimeout(600);
    await page.click('#btn-test');
    await page.waitForTimeout(1000);
    pruefe(!await sichtbar(), 'Neigungsfeld ohne Sensor wieder ausgeblendet');
  }
  await page.locator('#emu-device').screenshot({ path: path.join(HIER, 'ergebnisse', 'emulator.png') });
  // a file written by a program survives a page reload
  const schreib = path.join(os.tmpdir(), 'pbc_reload_a.py');
  const lies = path.join(os.tmpdir(), 'pbc_reload_b.py');
  fs.writeFileSync(schreib, 'with open("bleibt.txt", "w") as f:\n    f.write("42")\nprint("geschrieben")\n');
  fs.writeFileSync(lies, 'with open("bleibt.txt") as f:\n    print("gelesen", f.read())\nimport os\nos.remove("bleibt.txt")\n');
  const lauf = async (datei, muster) => {
    await page.evaluate(() => term.clear());
    await page.setInputFiles('#file-open', datei);
    await page.waitForTimeout(600);
    await page.click('#btn-test');
    for (let i = 0; i < 100 && !muster.test(await termText()); i++) await page.waitForTimeout(200);
    await page.waitForTimeout(800);
    return termText();
  };
  await lauf(schreib, /geschrieben/);
  await page.reload();
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.click('#target-emulator');
  await page.waitForTimeout(1000);
  const t2 = await lauf(lies, /gelesen|Error/);
  pruefe(/gelesen 42/.test(t2), 'Datei bleibt nach Neuladen erhalten');
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
