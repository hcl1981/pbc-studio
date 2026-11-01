// "Datei(en) oder ZIP hochladen…" in the file manager: every file of a
// ZIP lands flat in the emulator's storage, nothing opens on the
// workspace, and system files and repeated names are left out. The
// room check runs against a faked device.
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
const MATERIAL = path.resolve(HIER, '../../showcase_bloecke/material');
const PROJEKT = path.resolve(HIER, '../../dokumentation/schule/programme/ab22c_a2.pbcp');
let fehler = 0;
const pruefe = (ok, text) => { console.log((ok ? 'ok     ' : 'FEHLER ') + text); if (!ok) fehler++; };

const ordner = fs.mkdtempSync(path.join(os.homedir(), '.cache', 'pbc-zip-'));
const zip = path.join(ordner, 'paket.zip');
execFileSync('python3', ['-c', `
import zipfile, sys
m, z = sys.argv[1], sys.argv[2]
with zipfile.ZipFile(z, 'w', zipfile.ZIP_DEFLATED) as f:
    f.write(sys.argv[3], 'spiel/schatz.pbcp')
    f.writestr('spiel/start.py', 'print("hallo")')
    f.write(m + '/apfel.png', 'bilder/apfel.png')
    f.writestr('andere/start.py', 'print("zweite")')
    f.writestr('main.py', 'print("system")')
    f.writestr('__MACOSX/._start.py', b'junk')
`, MATERIAL, zip, PROJEKT]);

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
  const vorher = await page.evaluate(() => Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)));
  await page.evaluate(() => showManageFilesDialog());
  const knopf = page.getByRole('button', { name: /Datei\(en\) oder ZIP hochladen/ });
  await knopf.waitFor({ state: 'visible' });
  const [wahl] = await Promise.all([page.waitForEvent('filechooser'), knopf.click()]);
  await wahl.setFiles(zip);
  await page.waitForFunction(async () => (await window.__emuImgList()).length >= 3, null, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500);
  const stand = await page.evaluate(async () => {
    const aus = {};
    for (const e of await window.__emuImgList()) aus[e.name] = await e.blob.text();
    return { aus, liste: KNOWN_IMAGES.slice(), xml: Blockly.Xml.domToText(Blockly.Xml.workspaceToDom(workspace)) };
  });
  const namen = Object.keys(stand.aus).sort().join(' ');
  pruefe(namen === 'apfel.png schatz.pbcp start.py', 'genau drei Dateien im Speicher: ' + namen);
  pruefe(stand.aus['schatz.pbcp'] === fs.readFileSync(PROJEKT, 'utf-8'), '.pbcp liegt unverändert im Speicher');
  pruefe(stand.aus['start.py'] === 'print("hallo")', 'bei doppeltem Namen bleibt die erste Datei');
  pruefe(stand.liste.includes('apfel.png'), 'Bild steht in der Bilderliste');
  pruefe(stand.xml === vorher, 'Arbeitsfläche unverändert, nichts geöffnet');
  const hinweis = page.getByText('Block-Projekte (.pbcp) laufen nicht direkt');
  pruefe(await hinweis.locator('visible=true').count() === 2, 'Hinweis zu .pbcp in Dialog und Terminal');
  await page.getByRole('button', { name: 'Schließen' }).click();

  // open the block project from the target, then save it as Python
  await page.evaluate(() => openFromDevice());
  const zeile = page.getByText('schatz.pbcp', { exact: true });
  await zeile.waitFor({ state: 'visible' });
  pruefe(await page.getByText('start.py', { exact: true }).isVisible(), 'Python-Programm steht in der Liste');
  await zeile.click();
  await page.waitForFunction(() => workspace.getAllBlocks(false).length > 20, null, { timeout: 15000 }).catch(() => {});
  const offen = await page.evaluate(() => ({ text: isTextMode, n: workspace.getAllBlocks(false).length,
    sprites: PBC_SPRITES.length, name: aktuellerDateiname }));
  pruefe(!offen.text && offen.n > 20, '.pbcp als Blöcke geöffnet: ' + offen.n + ' Blöcke');
  pruefe(offen.sprites > 0, 'Sprites geladen: ' + offen.sprites);
  pruefe(offen.name === 'schatz', 'Dateiname übernommen');

  await page.evaluate(() => document.getElementById('btn-upload').click());
  await page.waitForSelector('#save-modal.show');
  await page.waitForTimeout(300);
  pruefe(await page.inputValue('#save-name') === 'schatz.py', 'Name beim Speichern: schatz.py');
  await page.click('#save-confirm');
  await page.waitForFunction(async () => !!(await window.__emuImgGet('schatz.py')), null, { timeout: 5000 }).catch(() => {});
  const py = await page.evaluate(async () => { const b = await window.__emuImgGet('schatz.py'); return b ? b.text() : ''; });
  pruefe(/import pbc/.test(py) && py.length > 500, 'als Python gespeichert: ' + py.length + ' Zeichen');

  // block project back onto the target, then open it again
  await page.evaluate(() => document.getElementById('btn-upload').click());
  await page.waitForSelector('#save-modal.show');
  pruefe(await page.isVisible('#save-block-wahl'), 'Auswahl .py/.pbcp sichtbar');
  await page.check('input[name="save-art"][value=".pbcp"]');
  pruefe(await page.inputValue('#save-name') === 'schatz.pbcp', 'Name wechselt zu schatz.pbcp');
  await page.fill('#save-name', 'mein_spiel');
  await page.click('#save-confirm');
  await page.waitForFunction(async () => !!(await window.__emuImgGet('mein_spiel.pbcp')), null, { timeout: 5000 }).catch(() => {});
  const projekt = await page.evaluate(async () => {
    const b = await window.__emuImgGet('mein_spiel.pbcp');
    return b ? JSON.parse(await b.text()) : null;
  });
  pruefe(projekt && projekt.kind === 'pbc-blocks' && projekt.sprites.length === offen.sprites, '.pbcp gespeichert, mit Sprites');
  pruefe(await page.getByText('Dein Block-Projekt ist auf dem PicoBoy').locator('visible=true').count() === 1, 'Hinweis im Terminal');
  await page.evaluate(() => { workspace.clear(); PBC_SPRITES = []; });
  await page.evaluate(() => openFromDevice());
  await page.getByText('mein_spiel.pbcp', { exact: true }).click();
  await page.waitForFunction(() => workspace.getAllBlocks(false).length > 20, null, { timeout: 15000 }).catch(() => {});
  pruefe(await page.evaluate(() => workspace.getAllBlocks(false).length) === offen.n, 'wieder geöffnet, gleich viele Blöcke');
  await page.evaluate(() => { document.querySelector('input[name="save-art"][value=".py"]').checked = true; });

  // room check, device faked; 4 KB blocks, 2 free, a.py already takes 1
  const platz = await page.evaluate(async () => {
    const echt = [window.runTarget, runOnDevice, listDeviceFilesRaw];
    runTarget = 'usb';
    runOnDevice = async () => ({ stdout: '4096 2\n', stderr: '' });
    listDeviceFilesRaw = async () => [{ name: 'a.py', size: 100 }];
    const groesse = (n) => ({ size: n });
    const aus = [
      await passtAufsGeraet([{ name: 'a.py', blob: groesse(12000) }]),
      await passtAufsGeraet([{ name: 'a.py', blob: groesse(12500) }]),
      await passtAufsGeraet([{ name: 'b.py', blob: groesse(9000) }]),
    ];
    runTarget = 'emulator';
    return aus;
  });
  pruefe(platz[0] === true, 'passt: ersetzte Datei gibt Platz frei');
  pruefe(platz[1] === false, 'zu groß auch mit ersetzter Datei');
  pruefe(platz[2] === false, 'zu groß für den freien Platz');
  pruefe(seitenfehler.length === 0, 'keine Seitenfehler ' + seitenfehler.join(' | '));
} finally {
  await browser.close();
  srv.close?.();
  fs.rmSync(ordner, { recursive: true, force: true });
}
console.log(fehler ? `${fehler} FEHLER` : 'alles ok');
process.exit(fehler ? 1 : 0);
