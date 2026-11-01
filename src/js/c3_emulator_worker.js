// =====================================================================
// Worker emulator (page side).
//
// Programs run in a Web Worker: MicroPython blocks there for real
// (sleep, input, wait_for_button) and the program text is run as
// written. This needs a cross-origin isolated page (COOP/COEP headers,
// see src/htaccess) for SharedArrayBuffer; without it (a local file, a
// server without the headers) the emulator says so (emuOhneIsolation).
//
// This file sits inside the emulator's closure (emu, RGBA_LUT, emuSetLed …).
// =====================================================================
const WORKER_QUELLE = @@WORKER@@;
const WK = {
  BILD: 0, X0: 1, Y0: 2, X1: 3, Y1: 4, TASTEN: 5, FLANKEN: 6, STOP: 7,
  WECKER: 8, EIN_BEREIT: 9, EIN_LAENGE: 10,
};
const WK_TASTE = { left: 0, right: 1, up: 2, down: 3, center: 4, a: 5, b: 6 };
// After Stop, a program that never sleeps or draws (while True: pass)
// cannot notice the flag: the worker is then terminated.
const WK_STOP_FRIST_MS = 400;

const wk = {
  worker: null, bereit: null, ctrl: null, fb: null, neigung: null, eingabe: null,
  sab: null, laeuft: false, fertig: null, letztesBild: -1, malt: false,
};

function emuWorkerMoeglich() {
  return typeof SharedArrayBuffer !== 'undefined' && typeof Atomics !== 'undefined' &&
         self.crossOriginIsolated === true;
}
window.emuWorkerMoeglich = emuWorkerMoeglich;

let wkOhneIsolationGemeldet = false;
function emuOhneIsolation() {
  setEmuStatus('nicht verfügbar');
  if (wkOhneIsolationGemeldet) return;
  wkOhneIsolationGemeldet = true;
  term.write('\r\n\x1b[31m' +
    t('Der Emulator kann hier nicht laufen: Der Webserver sendet die nötigen Header nicht (siehe .htaccess). Öffne PBC+ Studio über pbcstudio.de; ein Doppelklick auf die Datei reicht nicht.') +
    '\x1b[0m\r\n');
}

function wkSpeicher() {
  if (wk.sab) return;
  wk.sab = {
    ctrl: new SharedArrayBuffer(16 * 4),
    fb: new SharedArrayBuffer(emu.W * emu.H * 2),
    neigung: new SharedArrayBuffer(3 * 4),
    eingabe: new SharedArrayBuffer(4096),
  };
  wk.ctrl = new Int32Array(wk.sab.ctrl);
  wk.fb = new Uint16Array(wk.sab.fb);
  wk.neigung = new Float32Array(wk.sab.neigung);
  wk.eingabe = new Uint8Array(wk.sab.eingabe);
  wkNeigung(emu.neigung || [0, 0, 1]);
  wkBildZuruecksetzen();
}

function wkBildZuruecksetzen() {
  Atomics.store(wk.ctrl, WK.X0, emu.W);
  Atomics.store(wk.ctrl, WK.Y0, emu.H);
  Atomics.store(wk.ctrl, WK.X1, 0);
  Atomics.store(wk.ctrl, WK.Y1, 0);
}

// Called by the button and tilt handlers of the page.
function wkTaste(name, unten) {
  if (!wk.ctrl || !(name in WK_TASTE)) return;
  const bit = 1 << WK_TASTE[name];
  if (unten) {
    if (!(Atomics.load(wk.ctrl, WK.TASTEN) & bit)) Atomics.or(wk.ctrl, WK.FLANKEN, bit);
    Atomics.or(wk.ctrl, WK.TASTEN, bit);
  } else {
    Atomics.and(wk.ctrl, WK.TASTEN, ~bit);
  }
}
function wkNeigung(werte) {
  if (!wk.neigung) return;
  wk.neigung[0] = werte[0]; wk.neigung[1] = werte[1]; wk.neigung[2] = werte[2];
}
window.wkTaste = wkTaste;
window.wkNeigung = wkNeigung;

// Own MicroPython build for the worker (micropython/README.md).
const MP_PBC_MJS = @@MP_PBC_MJS@@;
const MP_PBC_WASM = @@MP_PBC_WASM@@;
// Measured on a real PicoBoy Color Plus (tests/geraet_speicher.py): a
// program finds 465 KB free after gc.collect(), the largest single block
// is 457 KB, three full-screen Canvas fit, a fourth does not. The emulator
// adds what its own start state takes (pbc/turtle/time loaded, ~24 KB, on
// the device they are in flash) plus a little slack for fragmentation, so
// a program sees the same free memory as on the device.
const WK_HEAP_GERAET_FREI = 465 * 1024;
const WK_HEAP_EMULATOR = 40 * 1024;
let wkMpUrls = null;
function wkMpUrlsHolen() {
  if (!wkMpUrls) {
    const bin = atob(MP_PBC_WASM);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    wkMpUrls = {
      mjs: URL.createObjectURL(new Blob([MP_PBC_MJS], { type: 'text/javascript' })),
      wasm: URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' })),
    };
  }
  return wkMpUrls;
}

function wkStarteWorker() {
  wkSpeicher();
  const url = URL.createObjectURL(new Blob([WORKER_QUELLE], { type: 'text/javascript' }));
  const w = new Worker(url, { type: 'module', name: 'pbc-emulator' });
  URL.revokeObjectURL(url);
  wk.worker = w;
  wk.bereit = new Promise((ok, fehler) => {
    w.onmessage = (e) => {
      const m = e.data;
      if (m.typ === 'bereit') { w.onmessage = wkNachricht; ok(); }
      else if (m.typ === 'ladefehler') fehler(new Error(m.text));
    };
    w.onerror = (e) => fehler(new Error(e.message || 'Worker-Fehler'));
  });
  const urls = wkMpUrlsHolen();
  w.postMessage({ typ: 'init', mjsUrl: urls.mjs, wasmUrl: urls.wasm,
                  heapsize: WK_HEAP_GERAET_FREI + WK_HEAP_EMULATOR, ctrl: wk.sab.ctrl, fb: wk.sab.fb,
                  neigung: wk.sab.neigung, eingabe: wk.sab.eingabe });
  return wk.bereit;
}

function wkBeenden() {
  if (wk.worker) { try { wk.worker.terminate(); } catch (_) {} }
  wk.worker = null;
  wk.bereit = null;
}

// ---- messages from the worker --------------------------------------
function wkNachricht(e) {
  const m = e.data;
  switch (m.typ) {
    case 'ausgabe':
      term.write(m.text.replace(/\r?\n/g, '\r\n'));
      break;
    case 'led': emuSetLed(m.idx, m.an); break;
    case 'rgb': emuSetRgb(m.r, m.g, m.b); break;
    case 'ton': emuTon(m.freq, m.ms); break;
    case 'ton_aus': emuTonAus(); break;
    case 'eingabe': wkEingabeAnfordern(m.prompt); break;
    case 'fertig': if (wk.fertig) wk.fertig(m); break;
  }
}

function wkEingabeAnfordern(prompt) {
  if (prompt) term.write(prompt.replace(/\n/g, '\r\n'));
  emu.inputLine = '';
  emu.inputActive = true;
  // the terminal's onData handler calls this with the typed line
  emu.inputResolve = (zeile) => {
    const bytes = new TextEncoder().encode(zeile == null ? '' : '' + zeile).slice(0, wk.eingabe.length);
    wk.eingabe.set(bytes);
    Atomics.store(wk.ctrl, WK.EIN_LAENGE, bytes.length);
    Atomics.store(wk.ctrl, WK.EIN_BEREIT, 1);
    Atomics.notify(wk.ctrl, WK.EIN_BEREIT);
  };
}

// ---- display: copy the shared framebuffer to the canvas ------------
function wkMalen() {
  if (!wk.ctrl) return;
  const n = Atomics.load(wk.ctrl, WK.BILD);
  if (n !== wk.letztesBild) {
    wk.letztesBild = n;
    let x0 = Atomics.exchange(wk.ctrl, WK.X0, emu.W), y0 = Atomics.exchange(wk.ctrl, WK.Y0, emu.H);
    let x1 = Atomics.exchange(wk.ctrl, WK.X1, 0), y1 = Atomics.exchange(wk.ctrl, WK.Y1, 0);
    if (x1 > x0 && y1 > y0 && emu.ctx) {
      const w = x1 - x0, h = y1 - y0;
      const img = emu.ctx.createImageData(w, h);
      const u32 = new Uint32Array(img.data.buffer);
      for (let yy = 0; yy < h; yy++) {
        const q = (y0 + yy) * emu.W + x0, z = yy * w;
        for (let xx = 0; xx < w; xx++) {
          const c = wk.fb[q + xx];
          emu.fb[q + xx] = c;          // keep the page's copy in step
          u32[z + xx] = RGBA_LUT[c];
        }
      }
      emu.ctx.putImageData(img, x0, y0);
    }
  }
}
function wkMalSchleife() {
  if (wk.malt) return;
  wk.malt = true;
  const schritt = () => {
    wkMalen();
    if (wk.laeuft) requestAnimationFrame(schritt);
    else { wk.malt = false; wkMalen(); }
  };
  requestAnimationFrame(schritt);
}

// ---- pictures and files for the run --------------------------------
// The worker's /flash is filled from the browser's file store (the one
// "Bilder verwalten" uses) before each run and written back after it.
function emuFlashTyp(name) {
  const n = name.toLowerCase();
  if (n.endsWith('.png')) return 'image/png';
  if (n.endsWith('.txt') || n.endsWith('.py') || n.endsWith('.csv')) return 'text/plain';
  return 'application/octet-stream';
}
async function wkBildDekodieren(blob) {
  const bmp = await createImageBitmap(blob);
  const c = new OffscreenCanvas(bmp.width, bmp.height);
  const cx = c.getContext('2d');
  cx.drawImage(bmp, 0, 0);
  const data = cx.getImageData(0, 0, bmp.width, bmp.height).data;
  const buf = new Uint8Array(bmp.width * bmp.height * 2);
  const u16 = new Uint16Array(buf.buffer);
  const KEY = 0xF81F;
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    if (data[i + 3] < 128) { u16[p] = KEY; continue; }
    let c = ((data[i] & 0xf8) << 8) | ((data[i + 1] & 0xfc) << 3) | ((data[i + 2] & 0xf8) >> 3);
    if (c === KEY) c = 0xF81E;
    u16[p] = c;
  }
  return { w: bmp.width, h: bmp.height, buf };
}
async function wkDateienHolen() {
  const dateien = [], bilder = [];
  const liste = window.__emuImgList ? await window.__emuImgList() : [];
  for (const f of liste) {
    if (!f.blob || /[\/\\]/.test(f.name)) continue;
    dateien.push({ name: f.name, daten: new Uint8Array(await f.blob.arrayBuffer()) });
    if (/\.png$/i.test(f.name)) {
      try { bilder.push({ name: f.name, ...(await wkBildDekodieren(f.blob)) }); } catch (_) {}
    }
  }
  return { dateien, bilder, bekannt: new Set(liste.map((f) => f.name)) };
}
async function wkDateienSichern(nachher, bekannt) {
  if (!window.__emuImgList) return;
  const alt = new Map((await window.__emuImgList()).map((f) => [f.name, f.blob]));
  const jetzt = new Map(nachher.map((f) => [f.name, f.daten]));
  for (const [n, daten] of jetzt) {
    const vorher = alt.get(n);
    if (vorher && vorher.size === daten.length) {
      const a = new Uint8Array(await vorher.arrayBuffer());
      let gleich = true;
      for (let i = 0; i < a.length; i++) if (a[i] !== daten[i]) { gleich = false; break; }
      if (gleich) continue;
    }
    await window.__emuImgPut(n, new Blob([daten], { type: emuFlashTyp(n) }));
  }
  // delete only what the program removed (it was there at the start)
  for (const n of alt.keys()) if (!jetzt.has(n) && bekannt.has(n)) await window.__emuImgDelete(n);
}

// ---- a run -----------------------------------------------------------
async function emuWorkerRun(code) {
  globalThis.__pbcTextMode = !!isTextMode;
  window.emuWorkerStopGemeldet = false;
  if (wk.laeuft) {
    emuWorkerStop();
    for (let i = 0; i < 60 && wk.laeuft; i++) await new Promise((r) => setTimeout(r, 16));
  }
  emu.running = true;
  emu.inputActive = false;
  emu.inputLine = '';
  emu.inputResolve = null;
  setEmuStatus('lade MicroPython…');
  try {
    if (!wk.worker) wkStarteWorker();
    await wk.bereit;
  } catch (e) {
    wkBeenden();
    emu.running = false;
    setEmuStatus('Fehler: ' + e.message);
    term.write('\r\n\x1b[31m' + t('Der Emulator konnte nicht geladen werden') + ': ' + e.message + '\x1b[0m\r\n');
    return;
  }
  setEmuStatus('läuft');
  // fresh device state
  wkSpeicher();
  wk.fb.fill(0);
  emu.fb.fill(0);
  Atomics.store(wk.ctrl, WK.STOP, 0);
  Atomics.store(wk.ctrl, WK.FLANKEN, 0);
  Atomics.store(wk.ctrl, WK.EIN_BEREIT, 0);
  wkBildZuruecksetzen();
  Atomics.add(wk.ctrl, WK.BILD, 1);
  Atomics.store(wk.ctrl, WK.X0, 0); Atomics.store(wk.ctrl, WK.Y0, 0);
  Atomics.store(wk.ctrl, WK.X1, emu.W); Atomics.store(wk.ctrl, WK.Y1, emu.H);
  emuSetLed(0, false); emuSetLed(1, false); emuSetLed(2, false);
  emuSetRgb(0, 0, 0);
  emuTonAus();
  emuClearEdges();
  // Block mode keeps one emulator convenience: plain pbc.fill & co.
  // draw on the active Canvas (pbc._set_active_canvas in pbc_emu.py).
  if (!isTextMode) {
    code = code.replace(/^([ \t]*)([A-Za-z_][\w]*)\s*=\s*pbc\.Canvas\([^\n]*\)[ \t]*$/gm,
      (zeile, einr, name) => zeile + '\n' + einr + 'pbc._set_active_canvas(' + name + ')');
  }
  const { dateien, bilder, bekannt } = await wkDateienHolen();
  wk.laeuft = true;
  wkMalSchleife();
  const ergebnis = await new Promise((ok) => {
    wk.fertig = ok;
    wk.worker.postMessage({ typ: 'start', code, textmodus: !!isTextMode, dateien, bilder });
  });
  wk.fertig = null;
  wk.laeuft = false;
  emu.running = false;
  emu.inputActive = false;
  wkMalen();
  setEmuStatus('bereit');
  // Every run gets a fresh MicroPython, as on the device (PBC+ Studio
  // soft-resets it before each Testen run). Reusing the old one kept,
  // now and then, a 134 KB canvas of the previous run alive (the
  // conservative GC sees a stale pointer), and a memory-hungry program
  // then failed with MemoryError although it runs on the device. The
  // new worker starts in the background, so the next run need not wait.
  wkBeenden();
  try { wkStarteWorker().catch(() => wkBeenden()); } catch (_) { wkBeenden(); }
  if (ergebnis.dateien) {
    try { await wkDateienSichern(ergebnis.dateien, bekannt); } catch (e) { console.warn('Dateien sichern', e); }
  }
  wkErgebnisMelden(ergebnis);
}

async function wkErgebnisMelden(ergebnis) {
  let msg = ergebnis.fehler;
  if (!msg) {
    term.write('\r\n\x1b[32m-- fertig --\x1b[0m\r\n');
    return;
  }
  if (ergebnis.abgebrochen || /KeyboardInterrupt/.test(msg)) {
    // the Stop button already wrote it
    if (!window.emuWorkerStopGemeldet) term.write('\r\n\x1b[33m-- ' + t('gestoppt') + ' --\x1b[0m\r\n');
    return;
  }
  msg = msg.replace(/OSError: 44\b/g, 'OSError: [Errno 2] ENOENT');
  // frames inside the emulator's own modules (pbc, turtle, time)
  msg = msg.replace(/^ *File "\/lib\/[^"]*", line \d+[^\n]*\n/gm, '');
  let lineOk = false;
  if (isTextMode) {
    const pre = window.__runPreludeLines || 0;
    const r = remapTraceback(msg, (n) => (n > pre ? n - pre : null));
    msg = r.text; lineOk = r.ok;
  }
  term.write('\r\n\x1b[31m' + msg.replace(/\n/g, '\r\n') + '\x1b[0m\r\n');
  if (!lineOk) maybeWarnLineNumber(msg);
  try { await showFriendlyErrorHint(msg); } catch (_) {}
}

// Resolves when the program has ended (cooperatively or terminated).
function emuWorkerStop() {
  const ende = new Promise((ok) => {
    const pruefen = () => (wk.laeuft ? setTimeout(pruefen, 20) : ok());
    pruefen();
  });
  if (!wk.laeuft) return ende;
  Atomics.store(wk.ctrl, WK.STOP, 1);
  Atomics.notify(wk.ctrl, WK.WECKER);
  Atomics.notify(wk.ctrl, WK.EIN_BEREIT);
  if (emu.inputActive) {
    emu.inputActive = false;
    emu.inputResolve = null;
  }
  const fertigVorher = wk.fertig;
  setTimeout(() => {
    // still running: a loop that never sleeps or draws
    if (wk.laeuft && wk.fertig === fertigVorher && fertigVorher) {
      wkBeenden();
      fertigVorher({ fehler: 'KeyboardInterrupt', abgebrochen: true, dateien: null });
    }
  }, WK_STOP_FRIST_MS);
  return ende;
}
window.emuWorkerStop = emuWorkerStop;
window.emuWorkerLaeuft = () => wk.laeuft;
