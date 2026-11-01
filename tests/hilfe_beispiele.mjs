// Extracts every code example of the text-mode help sidebar into
// ergebnisse/hilfe/*.py (with the usual imports in front) plus a
// pruefung.json, so pruefe_py.mjs can run them. Then
//   node pruefe_py.mjs ergebnisse/hilfe/*.py | node hilfe_auswerten.mjs
// reports examples that use names the pbc/turtle modules don't have.
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';

const HIER = path.dirname(fileURLToPath(import.meta.url));
const STUDIO = path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist'));
const AUS = path.join(HIER, 'ergebnisse', 'hilfe');
const CHROME = process.env.PBC_CHROME ||
  path.join(os.homedir(), '.cache/ms-playwright/chromium-1228/chrome-linux64/chrome');

const srv = await starteServer(STUDIO, { isolation: false });
const browser = await chromium.launch({ executablePath: CHROME });
try {
  const page = await browser.newPage();
  page.on('dialog', (d) => d.accept());
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!HELP_CATEGORIES; } catch (_) { return false; } });
  const beispiele = await page.evaluate(() => {
    const txt = (v) => (v && typeof v === 'object') ? (v.de || v.en || '') : (v || '');
    const out = [];
    const besuche = (e, kat) => {
      if (!e) return;
      if (Array.isArray(e)) { e.forEach((x) => besuche(x, kat)); return; }
      if (e.content && (e.content.example || e.content.insert)) {
        out.push({ id: e.id || kat + '_' + out.length, code: txt(e.content.example) || txt(e.content.insert) });
      }
      for (const k of ['sections', 'entries', 'items']) if (e[k]) besuche(e[k], kat);
    };
    for (const c of HELP_CATEGORIES) besuche(c, c.key);
    return out;
  });
  fs.rmSync(AUS, { recursive: true, force: true });
  fs.mkdirSync(AUS, { recursive: true });
  const spec = {};
  for (const b of beispiele) {
    const name = b.id.replace(/[^\w]/g, '_') + '.py';
    const kopf = 'import pbc\nimport time\nimport random\nimport math\nimport os\n' +
                 (/turtle\./.test(b.code) && !/^import turtle/m.test(b.code) ? 'import turtle\n' : '');
    fs.writeFileSync(path.join(AUS, name), kopf + b.code + '\n');
    spec[name] = { tasten: false, dauer: 1500, schritte: /input\s*\(/.test(b.code) ? [{ eingabe: '1' }, { eingabe: '2' }] : [] };
  }
  fs.writeFileSync(path.join(AUS, 'pruefung.json'), JSON.stringify(spec, null, 1));
  console.log(beispiele.length + ' Beispiele nach ' + AUS);
} finally {
  await browser.close();
  srv.schliessen();
}
