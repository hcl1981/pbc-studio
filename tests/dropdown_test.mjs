// Every dropdown of every block, operated like a student: a real mouse
// click on the field, the menu must open, choosing another entry must
// change the value. Plus the turtle case: with two turtles, a turtle
// command's picker offers exactly the turtles and switches between them.
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
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('dialog', (d) => d.accept());
  const seitenfehler = [];
  page.on('pageerror', (e) => seitenfehler.push(e.message));
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });

  // Clicks the field of a block (by name) with the mouse; returns the menu entries.
  async function menuOeffnen(blockId, feld) {
    const r = await page.evaluate(([id, f]) => {
      const b = workspace.getBlockById(id);
      const el = b.getField(f).getClickTarget_();
      const k = el.getBoundingClientRect();
      return { x: k.left + k.width / 2, y: k.top + k.height / 2, w: k.width };
    }, [blockId, feld]);
    if (!r.w) return null;
    await page.mouse.click(r.x, r.y);
    try {
      await page.waitForSelector('.blocklyDropDownDiv .blocklyMenuItem', { state: 'visible', timeout: 1500 });
    } catch (_) { return null; }
    return page.$$eval('.blocklyDropDownDiv .blocklyMenuItem', (els) => els.map((e) => e.textContent.trim()));
  }
  async function menuSchliessen() {
    await page.keyboard.press('Escape');
    await page.evaluate(() => Blockly.DropDownDiv.hideWithoutAnimation && Blockly.DropDownDiv.hideWithoutAnimation());
  }

  // ---- 1. Turtle: two turtles, switch a command between them ----------------
  const tb = await page.evaluate(() => {
    workspace.clear();
    const t1 = workspace.createVariable('t');
    const t2 = workspace.createVariable('t2');
    workspace.createVariable('zahl');
    const neu = (typ, varId, x, y) => {
      const b = workspace.newBlock(typ);
      b.setFieldValue(varId, 'VAR');
      b.initSvg(); b.render(); b.moveBy(x, y);
      return b;
    };
    // under "Beim Start": only connected blocks generate code
    const start = workspace.newBlock('pbc_when_start');
    start.initSvg(); start.render(); start.moveBy(40, 20);
    const a = neu('turtle_new', t1.getId(), 40, 80);
    const c = neu('turtle_new', t2.getId(), 40, 140);
    const vor = neu('turtle_forward', t1.getId(), 40, 220);
    const kette = [start, a, c, vor];
    for (let i = 0; i + 1 < kette.length; i++) {
      const unten = kette[i].nextConnection || kette[i].getInput('DO') && kette[i].getInput('DO').connection;
      unten.connect(kette[i + 1].previousConnection);
    }
    workspace.render();
    workspace.scroll(0, 0);
    return { id: vor.id, t1: t1.getId(), t2: t2.getId() };
  });
  const eintraege = await menuOeffnen(tb.id, 'VAR');
  pruefe(Array.isArray(eintraege), 'Turtle-Befehl: Menü öffnet sich');
  pruefe(eintraege && eintraege.join(',') === 't,t2', 'Turtle-Befehl: Menü zeigt genau die Turtles: ' + JSON.stringify(eintraege));
  if (eintraege && eintraege.includes('t2')) {
    await page.click('.blocklyDropDownDiv .blocklyMenuItem:has-text("t2")');
    await page.waitForTimeout(200);
    const wert = await page.evaluate((id) => workspace.getBlockById(id).getFieldValue('VAR'), tb.id);
    pruefe(wert === tb.t2, 'Turtle-Befehl: Auswahl t2 übernommen');
    const code = await page.evaluate(() => generatedCode());
    pruefe(/t2\.forward\(/.test(code), 'Turtle-Befehl: Code benutzt t2');
  }
  await menuSchliessen();
  // "setze … auf …" must still not offer turtles
  const setzeOpts = await page.evaluate(() => {
    const b = workspace.newBlock('variables_set');
    const zahl = workspace.getVariable('zahl') || workspace.createVariable('zahl');
    b.setFieldValue(zahl.getId(), 'VAR');
    b.initSvg(); b.render(); b.moveBy(400, 40);
    return { id: b.id };
  });
  const setzeMenue = await menuOeffnen(setzeOpts.id, 'VAR');
  pruefe(setzeMenue && !setzeMenue.includes('t') && !setzeMenue.includes('t2'), '„setze … auf …“ bietet keine Turtles an: ' + JSON.stringify(setzeMenue));
  await menuSchliessen();

  // ---- 2. Every dropdown of every block type -------------------------------
  const typen = await page.evaluate(() => Object.keys(Blockly.Blocks).sort());
  let geprueft = 0;
  for (const typ of typen) {
    const info = await page.evaluate((typ) => {
      workspace.clear();
      for (const n of ['t', 'liste', 'zahl']) if (!workspace.getVariable(n)) workspace.createVariable(n, n === 'liste' ? 'List' : '');
      let b;
      try {
        b = workspace.newBlock(typ);
        b.initSvg(); b.render(); b.moveBy(200, 200);
      } catch (e) { return { fehler: String(e.message || e) }; }
      workspace.scroll(0, 0);
      const felder = [];
      for (const input of b.inputList) {
        for (const f of input.fieldRow) {
          if (!(f instanceof Blockly.FieldDropdown) || !f.name) continue;
          const variable = f instanceof Blockly.FieldVariable;
          let opts = [];
          try { opts = f.getOptions(false).filter((o) => typeof o[0] === 'string' || (o[0] && o[0].alt)); } catch (e) { opts = []; }
          felder.push({ name: f.name, variable, editierbar: f.isClickable ? f.isClickable() : true,
                        offen: !variable || (f.svgArrow_ || f.arrow_) ? true : false,
                        werte: opts.map((o) => o[1]), wert: f.getValue() });
        }
      }
      return { id: b.id, felder };
    }, typ);
    if (info.fehler) continue;   // blocks that need a parent/mutation to exist
    for (const f of info.felder) {
      if (f.variable && !f.offen) continue;   // locked on purpose (fixed variable)
      geprueft++;
      const menue = await menuOeffnen(info.id, f.name);
      if (!menue) { pruefe(false, `${typ}.${f.name}: Menü öffnet sich nicht`); await menuSchliessen(); continue; }
      const anderer = f.werte.findIndex((w) => w !== f.wert);
      if (anderer >= 0 && anderer < menue.length) {
        const items = await page.$$('.blocklyDropDownDiv .blocklyMenuItem');
        await items[anderer].click();
        await page.waitForTimeout(80);
        const neu = await page.evaluate(([id, n]) => workspace.getBlockById(id) && workspace.getBlockById(id).getFieldValue(n), [info.id, f.name]);
        if (neu !== f.werte[anderer]) pruefe(false, `${typ}.${f.name}: Auswahl „${menue[anderer]}“ nicht übernommen (Wert ${neu})`);
      }
      await menuSchliessen();
    }
  }
  pruefe(geprueft > 40, `${geprueft} Auswahlmenüs in ${typen.length} Blocktypen bedient`);
  pruefe(seitenfehler.length === 0, 'keine Seitenfehler' + (seitenfehler.length ? ': ' + seitenfehler.slice(0, 3).join(' | ') : ''));
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
