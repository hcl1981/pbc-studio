// English UI: no German text left.
//   1. Heuristic word list (umlauts, common German words) over the static
//      page, the block labels, tooltips and toolbox categories.
//   2. Exact comparison: the page is loaded in German and in English;
//      any text (page, attributes, block labels, dropdown options) that
//      reads the same in both and is not in GLEICH_ERLAUBT counts as
//      untranslated. This also finds German words the list does not know.
//   3. Every dialog built at runtime that needs no device (privacy,
//      legal notice, contact, settings) is opened and checked with 1.
import { chromium } from 'playwright';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { starteServer } from './server.mjs';
const HIER = path.dirname(fileURLToPath(import.meta.url));
const CHROME = os.homedir() + '/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome';
const srv = await starteServer(path.resolve(process.env.PBC_STUDIO || path.join(HIER, '../dist')), { isolation: true });
const browser = await chromium.launch({ executablePath: CHROME });

// Texts that are rightly the same in both languages.
const GLEICH_ERLAUBT = new Set([
  'PBC+ Studio', 'PBC+', 'Emulator', 'PBC+ Emulator', 'PBC+ → Emulator…', 'Emulator → PBC+…',
  '■ Stop', 'Display', 'Pixel', 'Ellipse', 'Text', 'Canvas', 'Sprites', 'Sprite', 'Turtle', 'LEDs', 'Sound',
  'Sensor', 'Minimum / Maximum', 'Minimum', 'Maximum', 'Code', 'Name:', 'Name', 'System',
  '@aria-label: Terminal input', 'English', 'Deutsch', 'OK', 'Canvas:', 'myturtle', 'text', 'Minute',
  'machine', 'time.sleep', 'Pixel x', 'LED',
  'cyan', 'magenta', 'orange', 'RGB', 'Hz', 'ms', 'PNG', 'ZIP', 'USB', 'Joystick',
]);

async function sammle(lang) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.addInitScript((l) => { try { localStorage.setItem('pbc.lang', l); } catch (_) {} }, lang);
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });
  await page.waitForTimeout(1500);
  const r = await page.evaluate(() => {
    const DE = /[äöüßÄÖÜ]|\b(und|der|die|das|nicht|mit|auf|ein|eine|ist|zu|von|für|wird|Datei|Dateien|Bild|Bilder|Gerät|Zeige|zeige|setze|wenn|sonst|wiederhole|warte|Taste|Farbe|Zahl|Liste|neue|neuer|lösche|kein|keine|oder|dein|deine|fehlt|Hinweis|fertig)\b/;
    const seite = [], html = new Set();
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let n; while ((n = w.nextNode())) {
      const p = n.parentElement; if (!p || p.closest('script,style,#blockly,.blocklyFlyout,.blocklyWidgetDiv,.blocklyDropDownDiv,#helppane,#codeview,.CodeMirror,.xterm')) continue;
      const s = n.textContent.replace(/\s+/g, ' ').trim(); if (!s) continue;
      seite.push(s);
      if (DE.test(s)) html.add(s + '  <' + p.tagName + (p.id ? '#' + p.id : '') + '>');
    }
    for (const el of document.querySelectorAll('[title],[placeholder]')) for (const a of ['title','placeholder']) {
      const v = el.getAttribute(a); if (!v || el.closest('#blockly,.blocklyFlyout')) continue;
      seite.push('@' + a + ': ' + v); if (DE.test(v)) html.add('@' + a + ': ' + v);
    }
    // blocks: label fields, dropdown options, tooltips
    const bl = new Set(), blockTexte = []; const ws = new Blockly.Workspace();
    for (const typ of Object.keys(Blockly.Blocks)) {
      try {
        const b = ws.newBlock(typ); const s = b.toString(); if (DE.test(s)) bl.add(typ + ': ' + s);
        const tt = typeof b.tooltip === 'function' ? b.tooltip() : b.tooltip; if (tt && DE.test(tt)) bl.add(typ + ' (Tooltip): ' + String(tt).slice(0,100));
        if (!/^pbc_|^pbcx_/.test(typ)) continue;   // Blockly's own blocks come translated from its msg files
        for (const inp of b.inputList) for (const f of inp.fieldRow) {
          if (typeof f.getOptions === 'function') { let o = []; try { o = f.getOptions(false); } catch (e) {}
            for (const [lab] of o) if (typeof lab === 'string') { blockTexte.push(typ + ' ▾ ' + lab); if (DE.test(lab)) bl.add(typ + ' (Auswahl): ' + lab); } }
          else if (f.constructor && /Label/.test(f.constructor.name || '') || f.EDITABLE === false) { const tx = f.getText(); if (tx) blockTexte.push(typ + ' · ' + tx); }
        }
      } catch (e) {}
    }
    // toolbox categories
    const tb = []; try { for (const c of workspace.getToolbox().getToolboxItems()) { const nm = c.getName ? c.getName() : ''; if (nm && DE.test(nm)) tb.push(nm); } } catch (e) {}
    // sidebar entries
    for (const el of document.querySelectorAll('#sidebar *')) if (!el.children.length) { const s = el.textContent.replace(/\s+/g, ' ').trim(); if (s) seite.push(s); }
    return { html: [...html], bl: [...bl], tb, seite, blockTexte };
  });
  // dialogs built at runtime
  const dialoge = [];
  if (lang === 'en') {
    for (const id of ['footer-datenschutz', 'footer-impressum', 'footer-contact', 'btn-settings']) {
      await page.click('#' + id);
      await page.waitForTimeout(300);
      const funde = await page.evaluate(() => {
        const DE = /[äöüßÄÖÜ]|\b(und|der|die|das|nicht|mit|auf|eine|ist|von|für|wird|Datei|Bild|Gerät|wenn|kein|keine|oder|dein|deine|fehlt|Hinweis)\b/;
        const out = []; for (const m of document.querySelectorAll('.modal-bg.show, .modal-bg[style*="flex"], .modal-bg')) {
          if (!m.offsetParent && getComputedStyle(m).display === 'none') continue;
          const w = document.createTreeWalker(m, NodeFilter.SHOW_TEXT); let n;
          while ((n = w.nextNode())) { const p = n.parentElement; if (!p || p.closest('pre,script,style') || !p.offsetParent) continue;
            const s = n.textContent.replace(/\s+/g, ' ').trim();
            // addresses and statute names stay German
            if (s && DE.test(s) && !/Mondorfer|Troisdorf|UStG|MStV|Großbritannien/.test(s)) out.push(s.slice(0, 120)); }
        }
        return out; });
      funde.forEach(s => dialoge.push(id + ': ' + s));
      await page.keyboard.press('Escape');
      await page.evaluate(() => { for (const b of document.querySelectorAll('.modal-bg button')) if (b.offsetParent && /^(Close|Cancel)$/.test(b.textContent.trim())) { b.click(); break; } });
      await page.waitForTimeout(200);
    }
  }
  await page.close();
  return { ...r, dialoge };
}

const de = await sammle('de'), en = await sammle('en');
const hatBuchstaben = (s) => /[a-zA-ZäöüÄÖÜß]{3}/.test(s);
const kern = (s) => s.replace(/^.* [▾·] /, '').replace(/^@\w+: /, (m) => m);
const deSeite = new Set(de.seite), deBlock = new Set(de.blockTexte);
const gleich = [...new Set([
  ...en.seite.filter(s => deSeite.has(s)),
  ...en.blockTexte.filter(s => deBlock.has(s)),
])].filter(s => hatBuchstaben(kern(s).replace(/%\d/g, '')) && !GLEICH_ERLAUBT.has(s) && !GLEICH_ERLAUBT.has(kern(s)));

console.log('== HTML (' + en.html.length + ')'); en.html.forEach(s => console.log('  ' + s));
console.log('== Blöcke (' + en.bl.length + ')'); en.bl.forEach(s => console.log('  ' + s));
console.log('== Kategorien'); en.tb.forEach(s => console.log('  ' + s));
console.log('== Dialoge (' + en.dialoge.length + ')'); en.dialoge.forEach(s => console.log('  ' + s));
console.log('== gleich auf Deutsch und Englisch (' + gleich.length + ')'); gleich.forEach(s => console.log('  ' + s));
const n = en.html.length + en.bl.length + en.tb.length + en.dialoge.length + gleich.length;
console.log(n ? n + ' deutsche Textstücke in der englischen Oberfläche' : 'alles ok');
await browser.close(); srv.schliessen();
process.exit(n ? 1 : 0);
