// =====================================================================
// PBC+ emulator worker (runs in a Web Worker; the page starts it from
// a Blob, so the whole IDE stays one file).
//
// MicroPython runs here SYNCHRONOUSLY: time.sleep, input() and
// wait_for_button() really block -- with Atomics.wait on shared memory,
// so the page stays responsive and the program needs no rewriting.
//
// Shared with the page (SharedArrayBuffers, set up by the page):
//   fb       Uint16Array 240*280   the display (RGB565)
//   ctrl     Int32Array            counters and flags, indexes in K below
//   neigung  Float32Array(3)       tilt sensor x, y, z in g
//   eingabe  Uint8Array(4096)      a line typed into the terminal (UTF-8)
// Everything else (text output, LEDs, sound, files) goes by postMessage.
// =====================================================================
'use strict';

const K = {
  BILD: 0,        // display counter, +1 per drawing change
  X0: 1, Y0: 2, X1: 3, Y1: 4,     // dirty rectangle since the page last drew
  TASTEN: 5,      // bit mask of the buttons held now
  FLANKEN: 6,     // bit mask "was pressed" since the last query
  STOP: 7,        // 1 = Stop was pressed
  WECKER: 8,      // only notified (wakes sleeps on Stop)
  EIN_BEREIT: 9,  // 1 = eingabe holds a line
  EIN_LAENGE: 10, // its length in bytes
};
const TASTE = { left: 0, right: 1, up: 2, down: 3, center: 4, a: 5, b: 6 };

let mp = null;
let ctrl, neigung, eingabeBuf;
const emu = { W: 240, H: 280, fb: null, debtNs: 0 };
const bilder = new Map();          // name -> { w, h, buf: Uint8Array }
let textmodus = true;

const sende = (nachricht) => postMessage(nachricht);

// ---- display bookkeeping (names used by the shared display ops) ----
function emuMark(x, y, w, h) {
  if (w <= 0 || h <= 0) return;
  const x2 = Math.min(emu.W, x + w), y2 = Math.min(emu.H, y + h);
  x = Math.max(0, x); y = Math.max(0, y);
  if (x >= x2 || y >= y2) return;
  Atomics.store(ctrl, K.X0, Math.min(Atomics.load(ctrl, K.X0), x));
  Atomics.store(ctrl, K.Y0, Math.min(Atomics.load(ctrl, K.Y0), y));
  Atomics.store(ctrl, K.X1, Math.max(Atomics.load(ctrl, K.X1), x2));
  Atomics.store(ctrl, K.Y1, Math.max(Atomics.load(ctrl, K.Y1), y2));
  Atomics.add(ctrl, K.BILD, 1);
}
function emuFlushArea(x, y, w, h) { emuMark(x, y, w, h); }
function emuFlushAll() { emuMark(0, 0, emu.W, emu.H); }
function emuFlushDirtySync() {}
function emuFillRect(x, y, w, h, c) {
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > emu.W) w = emu.W - x;
  if (y + h > emu.H) h = emu.H - y;
  if (w <= 0 || h <= 0) return;
  c &= 0xffff;
  for (let yy = y; yy < y + h; yy++) emu.fb.fill(c, yy * emu.W + x, yy * emu.W + x + w);
  emuMark(x, y, w, h);
}
// Display transfer time as on the device (SPI): the program waits for
// it. Same constants as the page's emulator. Firmware from 29.10.2026:
// 75 MHz SPI, a full frame 15.7 ms = 67 200 px x 234 ns.
const SPI_NS_PER_PIXEL = 234, OP_OVERHEAD_NS = 80_000, DEBT_BUDGET_NS = 2_500_000;
function emuCharge(pixels) {
  emu.debtNs += OP_OVERHEAD_NS + pixels * SPI_NS_PER_PIXEL;
  if (emu.debtNs >= DEBT_BUDGET_NS) {
    const ms = Math.floor(emu.debtNs / 1e6);
    emu.debtNs -= ms * 1e6;
    warte(ms);
  }
}

// ---- waiting, stop ----------------------------------------------------
// Blocks the worker; returns true if Stop was pressed meanwhile.
function warte(ms) {
  if (ms > 0) {
    if (ausgabePuffer) ausgabeSenden();   // show print() output before pausing
    Atomics.wait(ctrl, K.WECKER, 0, ms);
  }
  return Atomics.load(ctrl, K.STOP) === 1;
}
function gestoppt() { return Atomics.load(ctrl, K.STOP) === 1; }

@@GETEILT:schrift.js@@
@@GETEILT:anzeige_ops.js@@

// ---- the dispatcher the Python modules call (pbc_emu.py: _d) ----------
function tasteBit(name) { return 1 << TASTE[name]; }
function gedrueckt(name) { return (Atomics.load(ctrl, K.TASTEN) & tasteBit(name)) ? 1 : 0; }
function flanke(name) {
  const b = tasteBit(name);
  return (Atomics.and(ctrl, K.FLANKEN, ~b) & b) ? 1 : 0;
}
function irgendeine() { return Atomics.load(ctrl, K.TASTEN) ? 1 : 0; }

globalThis.__pbc = {
  ...pbcAnzeigeOps(),
  pressed_left: () => gedrueckt('left'), pressed_right: () => gedrueckt('right'),
  pressed_up: () => gedrueckt('up'), pressed_down: () => gedrueckt('down'),
  pressed_center: () => gedrueckt('center'), pressed_a: () => gedrueckt('a'),
  pressed_b: () => gedrueckt('b'),
  was_pressed_left: () => flanke('left'), was_pressed_right: () => flanke('right'),
  was_pressed_up: () => flanke('up'), was_pressed_down: () => flanke('down'),
  was_pressed_center: () => flanke('center'), was_pressed_a: () => flanke('a'),
  was_pressed_b: () => flanke('b'),
  any_pressed: () => irgendeine(),
  clear_button_edges: () => { Atomics.store(ctrl, K.FLANKEN, 0); },
  accel_g: (achse) => neigung[achse | 0],
  // sound and LEDs: the page plays / shows them
  tone: (freq, ms) => sende({ typ: 'ton', freq, ms: ms == null ? null : ms }),
  tone_off: () => sende({ typ: 'ton_aus' }),
  set_led: (idx, on) => sende({ typ: 'led', idx: idx | 0, an: !!on }),
  rgb_led: (r, g, b) => sende({ typ: 'rgb', r: r & 0xff, g: g & 0xff, b: b & 0xff }),
  rgb_led_off: () => sende({ typ: 'rgb', r: 0, g: 0, b: 0 }),
  // waiting (return 1 = stopped; the Python side raises KeyboardInterrupt)
  sleep_ms: (ms) => (warte(Math.max(0, ms | 0)) ? 1 : 0),
  wait_button: () => {
    Atomics.store(ctrl, K.FLANKEN, 0);
    while (!irgendeine()) if (warte(10)) return 1;
    while (irgendeine()) if (warte(10)) return 1;
    Atomics.store(ctrl, K.FLANKEN, 0);
    return 0;
  },
  // pictures, decoded by the page before the run
  load_image_blob: (name) => {
    const b = bilder.get('' + name);
    return b ? { buf_arr: Array.from(b.buf), w: b.w, h: b.h } : null;
  },
};

// input(): ask the page, block until it delivers the line.
globalThis.__pbcEingabe = (prompt) => {
  ausgabeSenden();                 // earlier print() output first
  Atomics.store(ctrl, K.EIN_BEREIT, 0);
  sende({ typ: 'eingabe', prompt: prompt == null ? '' : '' + prompt });
  while (Atomics.load(ctrl, K.EIN_BEREIT) === 0) {
    Atomics.wait(ctrl, K.EIN_BEREIT, 0, 200);
    if (gestoppt()) return null;
  }
  const n = Atomics.load(ctrl, K.EIN_LAENGE);
  Atomics.store(ctrl, K.EIN_BEREIT, 0);
  return new TextDecoder().decode(eingabeBuf.slice(0, n));
};

// ---- MicroPython -------------------------------------------------------
let ausgabePuffer = '';
let ausgabeTimer = null;
let ausgabeZuletzt = 0;
function ausgabe(text) {
  ausgabePuffer += text;
  // A busy program never lets the timer fire, so also send by clock.
  if (ausgabePuffer.length > 2000 || performance.now() - ausgabeZuletzt >= 30) ausgabeSenden();
  else if (!ausgabeTimer) ausgabeTimer = setTimeout(ausgabeSenden, 30);
}
function ausgabeSenden() {
  if (ausgabeTimer) { clearTimeout(ausgabeTimer); ausgabeTimer = null; }
  if (ausgabePuffer) sende({ typ: 'ausgabe', text: ausgabePuffer });
  ausgabePuffer = '';
  ausgabeZuletzt = performance.now();
}

// Own MicroPython build (variant "pbc", see micropython/README.md): it
// collects garbage during a long synchronous run, and its fixed heap
// matches the PicoBoy's, so MemoryError comes where it would on the device.
async function ladeMicroPython(mjsUrl, wasmUrl, heapsize) {
  const mod = await import(mjsUrl);
  mp = await mod.loadMicroPython({
    url: wasmUrl,
    heapsize,
    pystack: 8 * 1024,
    // linebuffer off: print(..., end="") appears at once
    linebuffer: false,
    stdout: (t) => ausgabe(typeof t === 'string' ? t : new TextDecoder().decode(t)),
    stderr: (t) => ausgabe(typeof t === 'string' ? t : new TextDecoder().decode(t)),
  });
  try { mp.FS.mkdir('/lib'); } catch (_) {}
  mp.FS.writeFile('/lib/pbc.py', PBC_PY);
  mp.FS.writeFile('/lib/turtle.py', TURTLE_PY);
  mp.FS.writeFile('/lib/_pbc_zeit.py', ZEIT_PY);
  try { mp.FS.mkdir('/flash'); } catch (_) {}
}

const PBC_PY = @@PY_WORKER:pbc_emu.py@@;
const TURTLE_PY = @@PY_WORKER:turtle_emu.py@@;
// time with real (blocking, stoppable) sleeps
const ZEIT_PY = `from time import *
import js as _js
import sys as _sys
_d = _js.globalThis.__pbc
def sleep_ms(ms):
    # waiting draws moved sprites first (as the device's timer does)
    _p = _sys.modules.get("pbc")
    if _p is not None:
        _p._sprites_jetzt()
    if _d.sleep_ms(int(ms)):
        raise KeyboardInterrupt()
def sleep(s):
    sleep_ms(int(s * 1000))
def sleep_us(us):
    sleep_ms(int(us) // 1000)
`;

// Run before every program: fresh globals, fresh pbc/turtle modules,
// the blocking time module, input() from the terminal, /flash as
// working directory. Uses only private names.
const VORLAUF = `
import sys as __s
__g = globals()
for __k in list(__g.keys()):
    if not __k.startswith("__"):
        del __g[__k]
for __m in ("pbc", "turtle", "time", "_pbc_zeit"):
    if __m in __s.modules:
        del __s.modules[__m]
import _pbc_zeit as __z
__s.modules["time"] = __z
import js as __j
import sys as __s2
def __eingabe(prompt="", __hole=__j.globalThis.__pbcEingabe):
    if "pbc" in __s2.modules:
        __s2.modules["pbc"]._sprites_jetzt()
    t = __hole(str(prompt))
    if t is None:
        raise KeyboardInterrupt()
    return t
__g["input"] = __eingabe
import os as __o
__o.chdir("/flash")
del __s, __z, __j, __o, __k, __m
`;

function dateienSchreiben(dateien) {
  for (const n of mp.FS.readdir('/flash')) {
    if (n === '.' || n === '..') continue;
    try { mp.FS.unlink('/flash/' + n); } catch (_) {}
  }
  for (const f of dateien) mp.FS.writeFile('/flash/' + f.name, f.daten);
}
function dateienLesen() {
  const out = [];
  for (const n of mp.FS.readdir('/flash')) {
    if (n === '.' || n === '..') continue;
    try {
      const st = mp.FS.stat('/flash/' + n);
      if (mp.FS.isFile(st.mode)) out.push({ name: n, daten: mp.FS.readFile('/flash/' + n) });
    } catch (_) {}
  }
  return out;
}

onmessage = async (e) => {
  const m = e.data;
  if (m.typ === 'init') {
    ctrl = new Int32Array(m.ctrl);
    emu.fb = new Uint16Array(m.fb);
    neigung = new Float32Array(m.neigung);
    eingabeBuf = new Uint8Array(m.eingabe);
    try {
      await ladeMicroPython(m.mjsUrl, m.wasmUrl, m.heapsize);
      sende({ typ: 'bereit' });
    } catch (err) {
      sende({ typ: 'ladefehler', text: '' + (err && err.message || err) });
    }
    return;
  }
  if (m.typ === 'start') {
    textmodus = !!m.textmodus;
    globalThis.__pbcTextMode = textmodus;
    bilder.clear();
    for (const b of m.bilder || []) bilder.set(b.name, b);
    dateienSchreiben(m.dateien || []);
    emu.debtNs = 0;
    let fehler = null;
    try {
      mp.runPython(VORLAUF);
      // the previous program's objects are garbage now
      mp.runPython('import gc\ngc.collect()\ndel gc');
    } catch (err) {
      fehler = 'Interner Fehler im Vorlauf: ' + (err && err.message || err);
    }
    if (!fehler) {
      try {
        mp.runPython(m.code);
      } catch (err) {
        fehler = (err && err.message) ? err.message : '' + err;
      }
    }
    // Sprites moved at the very end are drawn (the device's timer does that).
    try {
      mp.runPython('import sys as __s3\nif "pbc" in __s3.modules:\n    __s3.modules["pbc"]._sprites_jetzt()\ndel __s3');
    } catch (_) {}
    ausgabeSenden();
    sende({ typ: 'fertig', fehler, dateien: dateienLesen() });
  }
};
