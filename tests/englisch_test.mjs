// English UI: no German text left in the static page, the block
// labels, tooltips and toolbox categories (heuristic word list).
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';
const HIER = path.dirname(fileURLToPath(import.meta.url));
const CHROME = os.homedir() + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const srv = await starteServer(path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist')), { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.addInitScript(() => { try { localStorage.setItem('pbc.lang', 'en'); } catch (_) {} });
await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
await page.waitForTimeout(1500);
const r = await page.evaluate(() => {
  const DE = /[äöüßÄÖÜ]|\b(und|der|die|das|nicht|mit|auf|ein|eine|ist|zu|von|für|wird|Datei|Dateien|Bild|Bilder|Gerät|Zeige|zeige|setze|wenn|sonst|wiederhole|warte|Taste|Farbe|Zahl|Liste|neue|neuer|lösche)\b/;
  const html = new Set();
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) {
    const p = n.parentElement; if (!p || p.closest('script,style,#blockly,.blocklyFlyout,#helppane,#codeview,.xterm')) continue;
    const s = n.textContent.replace(/\s+/g, ' ').trim(); if (s && DE.test(s)) html.add(s + '  <' + p.tagName + (p.id ? '#' + p.id : '') + '>');
  }
  for (const el of document.querySelectorAll('[title],[placeholder]')) for (const a of ['title','placeholder']) { const v = el.getAttribute(a); if (v && DE.test(v)) html.add('@' + a + ': ' + v); }
  // blocks
  const bl = new Set(); const ws = new Blockly.Workspace();
  for (const typ of Object.keys(Blockly.Blocks)) {
    try { const b = ws.newBlock(typ); const s = b.toString(); if (DE.test(s)) bl.add(typ + ': ' + s); const tt = typeof b.tooltip === 'function' ? b.tooltip() : b.tooltip; if (tt && DE.test(tt)) bl.add(typ + ' (Tooltip): ' + String(tt).slice(0,100)); } catch (e) {}
  }
  // toolbox categories
  const tb = []; try { for (const c of workspace.getToolbox().getToolboxItems()) { const nm = c.getName ? c.getName() : ''; if (nm && DE.test(nm)) tb.push(nm); } } catch (e) {}
  return { html: [...html], bl: [...bl], tb };
});
console.log('== HTML (' + r.html.length + ')'); r.html.forEach(s => console.log('  ' + s));
console.log('== Blöcke (' + r.bl.length + ')'); r.bl.forEach(s => console.log('  ' + s));
console.log('== Kategorien'); r.tb.forEach(s => console.log('  ' + s));
const n = r.html.length + r.bl.length + r.tb.length;
console.log(n ? n + ' deutsche Textstücke in der englischen Oberfläche' : 'alles ok');
await browser.close(); srv.schliessen();
process.exit(n ? 1 : 0);
