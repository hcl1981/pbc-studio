// Build 146: Stop with a connected PBC+ (not a Testen run) leaves no
// noise in the terminal: neither the KeyboardInterrupt traceback of the
// interrupted program nor the echo of the line that silences the
// speaker. The device is faked: what it "answers" goes the way the read
// loop sends it (terminal while interactive, protocol buffer otherwise).
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
  page.on('pageerror', (e) => { console.log('Seitenfehler: ' + e.message); fehler++; });
  await page.goto(`http://127.0.0.1:${srv.port}/index.html`);
  await page.waitForFunction(() => { try { return !!workspace && !!term; } catch (_) { return false; } });

  await page.evaluate(() => {
    window.__gesendet = '';
    window.__sichtbar = '';
    const zeige = term.write.bind(term);
    term.write = (d) => { window.__sichtbar += typeof d === 'string' ? d : new TextDecoder().decode(d); return zeige(d); };
    const antworte = (text) => {                       // like the read loop in 90_seriell.js
      const b = new TextEncoder().encode(text);
      if (interactive) term.write(b);
      else { const m = new Uint8Array(protoBuffer.length + b.length); m.set(protoBuffer); m.set(b, protoBuffer.length); protoBuffer = m; }
    };
    serialPort = {}; deviceMode = 'serial';
    serialWriter = { write: async (b) => {
      const txt = new TextDecoder().decode(b);
      window.__gesendet += txt;
      if (txt.includes('\x03'))
        antworte('\r\nTraceback (most recent call last):\r\n  File "main.py", line 2, in <module>\r\n  File "pbc.py", line 801, in menu\r\nKeyboardInterrupt: \r\n>>> ');
      else if (txt.includes('tone_off'))
        antworte(txt + '\n>>> ');
      else if (txt === '\r')
        antworte('\r\n>>> ');
    } };
  });
  await page.click('#btn-stop');
  await page.waitForFunction(() => />>> $/.test(window.__sichtbar), null, { timeout: 5000 });
  await page.waitForTimeout(100);
  const r = await page.evaluate(() => ({ gesendet: window.__gesendet, sichtbar: window.__sichtbar, interaktiv: interactive }));
  pruefe(r.gesendet.includes('\x03\x03'), 'Stop sendet den Abbruch');
  pruefe(/tone_off/.test(r.gesendet), 'Stop schaltet den Ton ab');
  pruefe(!/Traceback|KeyboardInterrupt/.test(r.sichtbar), 'kein Traceback im Terminal');
  pruefe(!/tone_off|exec\(/.test(r.sichtbar), 'keine mitgetippte Zeile im Terminal');
  pruefe(/-- gestoppt --/.test(r.sichtbar) && />>> $/.test(r.sichtbar), 'eine Zeile "gestoppt" und ein frischer Prompt');
  pruefe(r.interaktiv === true, 'das Terminal zeigt danach wieder alles');

  // during a Testen run: only the interrupt, the run itself does the rest
  await page.evaluate(() => { window.__gesendet = ''; window.__sichtbar = ''; window.__testlaufAktiv = true; window.__stopImTestlauf = false; });
  await page.click('#btn-stop');
  await page.waitForTimeout(400);
  const t = await page.evaluate(() => ({ gesendet: window.__gesendet, flag: window.__stopImTestlauf }));
  pruefe(t.gesendet === '\x03\x03' && t.flag === true, 'im Testlauf: nur der Abbruch, der Testlauf räumt selbst auf');
} finally {
  await browser.close();
  srv.schliessen();
}
process.exit(fehler ? 1 : 0);
