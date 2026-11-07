// =====================================================================
// PBC+ Emulator: virtual device that runs MicroPython in the browser.
//
//   c0  (this file) device on the page: display canvas, buttons, tilt
//       pad, LEDs, buzzer, file store (IndexedDB), traceback mapping
//   c3  the Web Worker running MicroPython (its source: src/worker/,
//       its Python modules: src/py/), shared memory with the page
//   c5  run/stop entry points, panel, connect/disconnect
//
// runOnDevice / uploadBlob / etc. branch on `deviceMode` and route their
// work to the emulator instead of the serial port. connectEmulator()
// sets deviceMode='emulator' and serialPort to a sentinel object so
// "is connected?" checks continue to work.
// =====================================================================
(function() {

// --- IndexedDB: per-browser blob store for images ---------------
// We use IndexedDB instead of localStorage because PNGs run a few
// hundred KB and IDB handles binary Blobs natively. Same store is
// also written into by uploadBlob() when in emulator mode so images
// "uploaded to the PBC+" land here transparently.
const DB_NAME = 'pbc_emu', DB_VERSION = 1, IMG_STORE = 'images';
let dbPromise = null;
function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IMG_STORE)) {
        db.createObjectStore(IMG_STORE); // key = filename, value = Blob
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function imgPut(name, blob) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).put(blob, name);
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error);
  });
}
async function imgGet(name) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IMG_STORE, 'readonly');
    const req = tx.objectStore(IMG_STORE).get(name);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}
async function imgDelete(name) {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(IMG_STORE, 'readwrite');
    tx.objectStore(IMG_STORE).delete(name);
    tx.oncomplete = () => resolve(true);
  });
}
async function imgList() {
  const db = await openDb();
  return new Promise((resolve) => {
    const tx = db.transaction(IMG_STORE, 'readonly');
    const store = tx.objectStore(IMG_STORE);
    const out = [];
    const req = store.openCursor();
    req.onsuccess = (e) => {
      const cur = e.target.result;
      if (cur) {
        out.push({ name: cur.key, blob: cur.value });
        cur.continue();
      } else {
        resolve(out);
      }
    };
  });
}
// Expose for uploadBlob() hook + the menu-driven image listing.
window.__emuImgPut = imgPut;
window.__emuImgGet = imgGet;
window.__emuImgList = imgList;
window.__emuImgDelete = imgDelete;

// --- emulator runtime state -------------------------------------
const emu = {
  ctx: null,                // 2D context for the display canvas
  running: false,           // a program runs in the worker
  // The page's copy of the display (RGB565), updated from the worker's
  // shared framebuffer (c3, wkMalen).
  fb: null,                 // Uint16Array(240 * 280)
  W: 240, H: 280,
  // Button state, for the highlight; the worker reads the shared
  // button bits (c3, wkTaste).
  btn: { left: false, right: false, up: false, down: false,
         center: false, a: false, b: false },
  // Edge latches behind pbc.was_pressed_*() on the page side; cleared
  // at the start of every run.
  btnWas: { left: false, right: false, up: false, down: false,
            center: false, a: false, b: false },
  rgbColor: 0x000000,       // last set rgb led colour
  leds: [false, false, false],  // red, yellow, green
  neigung: [0, 0, 1],       // tilt in g (tilt pad)
  // Terminal input for input(): while inputActive is true, term.onData
  // feeds keystrokes here (with echo + line editing) instead of the
  // serial device, and hands the line to inputResolve.
  inputActive: false,
  inputLine: '',
  inputResolve: null,
};
// The terminal (input()) and the serial code reach the state through this.
globalThis.__emu = emu;

// Forward declaration so the device.c equivalents can call into the
// status update without circular references.
function setEmuStatus(text) {
  const el = document.getElementById('emu-status');
  if (!el) return;
  // The panel is only visible while the emulator is up, so connection /
  // readiness words ("bereit", "getrennt") are redundant -- hide them.
  // The status line still surfaces the states that actually inform the
  // user: loading progress and errors.
  const hidden = (text === 'bereit' || text === 'getrennt' || text === 'lädt…');
  el.textContent = hidden ? '' : t(text);
}

// --- display rendering -------------------------------------------
// We back the display with a Uint16Array (RGB565) so the semantics
// match the real device exactly: KEY = 0xF81F means "transparent"
// for sprite/canvas blits. Pushing to the visible canvas converts
// to RGBA on demand.
//
// PERFORMANCE NOTES:
// The naive approach -- run the whole framebuffer through a per-pixel
// RGB565→RGBA conversion and putImageData() after every drawing op --
// turned out 10-20× slower than the real hardware. The fix is twofold:
//
//   1) Pre-compute a 65536-entry RGB565→RGBA lookup table once at boot,
//      so the conversion is one table read instead of three shifts +
//      three mask + three OR per pixel.
//   2) Defer the actual canvas push to the next animation frame and
//      track only the dirty bounding box. Drawing 1000 lines in a tight
//      loop still results in just one putImageData call per refresh,
//      which is what the real device does too (the LCD only refreshes
//      ~60 Hz no matter how fast you write to it).
//
// emuMark(x,y,w,h) is called by every drawing primitive to extend the
// dirty box and schedule a flush. The rAF callback does the actual
// CPU→GPU copy with a single putImageData over the dirty region.
const RGBA_LUT = new Uint32Array(65536);
(function buildLUT() {
  for (let c = 0; c < 65536; c++) {
    const r5 = (c >> 11) & 0x1f, g6 = (c >> 5) & 0x3f, b5 = c & 0x1f;
    const r = (r5 << 3) | (r5 >> 2);
    const g = (g6 << 2) | (g6 >> 4);
    const b = (b5 << 3) | (b5 >> 2);
    // Little-endian: 0xAABBGGRR for canvas-native byte order.
    RGBA_LUT[c] = (0xff << 24) | (b << 16) | (g << 8) | r;
  }
})();

// Dirty-rectangle state. Reset to "no dirty area" after each flush.
let emuDirty = null;
let emuFlushScheduled = false;
function emuMark(x, y, w, h) {
  if (x < 0) { w += x; x = 0; }
  if (y < 0) { h += y; y = 0; }
  if (x + w > emu.W) w = emu.W - x;
  if (y + h > emu.H) h = emu.H - y;
  if (w <= 0 || h <= 0) return;
  if (!emuDirty) {
    emuDirty = { x, y, x2: x + w, y2: y + h };
  } else {
    if (x < emuDirty.x) emuDirty.x = x;
    if (y < emuDirty.y) emuDirty.y = y;
    if (x + w > emuDirty.x2) emuDirty.x2 = x + w;
    if (y + h > emuDirty.y2) emuDirty.y2 = y + h;
  }
  if (!emuFlushScheduled) {
    emuFlushScheduled = true;
    requestAnimationFrame(emuFlushDirty);
  }
}
function emuFlushDirty() {
  emuFlushScheduled = false;
  if (!emuDirty || !emu.ctx) return;
  const { x, y, x2, y2 } = emuDirty;
  emuDirty = null;
  const w = x2 - x, h = y2 - y;
  if (w <= 0 || h <= 0) return;
  const img = emu.ctx.createImageData(w, h);
  const u32 = new Uint32Array(img.data.buffer);
  for (let yy = 0; yy < h; yy++) {
    const srcRow = (y + yy) * emu.W + x;
    const dstRow = yy * w;
    for (let xx = 0; xx < w; xx++) {
      u32[dstRow + xx] = RGBA_LUT[emu.fb[srcRow + xx]];
    }
  }
  emu.ctx.putImageData(img, x, y);
}
function emuFlushAll() { emuMark(0, 0, emu.W, emu.H); }

// --- input wiring ------------------------------------------------
function emuButtonDown(name) {
  // Arm the was_pressed_* latch on the RISING EDGE only. Keyboard
  // auto-repeat calls this over and over while a key is held; re-arming
  // there would make was_pressed_* fire continuously and turn it into a
  // second pressed_*, which is precisely what it must not be.
  if (!emu.btn[name]) emu.btnWas[name] = true;
  emu.btn[name] = true;
  emuHighlight(name, true);
  if (window.wkTaste) window.wkTaste(name, true);
}
function emuButtonUp(name) {
  emu.btn[name] = false;
  emuHighlight(name, false);
  if (window.wkTaste) window.wkTaste(name, false);
}
function emuClearEdges() {
  for (const k of Object.keys(emu.btnWas)) emu.btnWas[k] = false;
}
function emuHighlight(name, on) {
  // Visual feedback: brighten the hit-target area while pressed. The
  // DOM elements are transparent overlays now (vs the old SVG fills),
  // so we tweak background-color instead of the 'fill' attribute.
  const map = {
    a: 'emu-hit-a', b: 'emu-hit-b',
    left:'emu-hit-left', right:'emu-hit-right',
    up:'emu-hit-up', down:'emu-hit-down', center:'emu-hit-center',
  };
  const id = map[name];
  if (!id) return;
  const el = document.getElementById(id);
  if (el) el.style.background = on ? 'rgba(255,255,255,0.2)' : 'transparent';
}
let emuInputBound = false;
// Tilt pad: the dot's offset from the centre (radius = 1 g) gives the
// part of gravity along x and y. Dot to the right = right edge lower;
// the sensor measures the table's reaction force, so x gets negative
// (same for y: dot down = lower edge lower = y negative).
function bindEmuNeigung() {
  const feld = document.getElementById('emu-neigung-feld');
  const punkt = document.getElementById('emu-neigung-punkt');
  const werte = document.getElementById('emu-neigung-werte');
  if (!feld || !punkt) return;
  const setze = (px, py) => {
    const r = Math.hypot(px, py);
    if (r > 1) { px /= r; py /= r; }
    const x = -px, y = -py, z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    emu.neigung = [x, y, z];
    if (window.wkNeigung) window.wkNeigung(emu.neigung);
    const half = feld.clientWidth / 2;
    punkt.style.left = (half + px * (half - 6) - 6) + 'px';
    punkt.style.top = (half + py * (half - 6) - 6) + 'px';
    if (werte) werte.textContent = 'x ' + x.toFixed(2) + ' y ' + y.toFixed(2) + ' z ' + z.toFixed(2) + ' g';
  };
  const ausEreignis = (e) => {
    const r = feld.getBoundingClientRect();
    setze((e.clientX - r.left - r.width / 2) / (r.width / 2 - 6),
          (e.clientY - r.top - r.height / 2) / (r.height / 2 - 6));
  };
  let zieht = false;
  feld.addEventListener('pointerdown', (e) => { zieht = true; feld.setPointerCapture(e.pointerId); ausEreignis(e); });
  feld.addEventListener('pointermove', (e) => { if (zieht) ausEreignis(e); });
  feld.addEventListener('pointerup', () => { zieht = false; });
  feld.addEventListener('dblclick', () => setze(0, 0));
  setze(0, 0);
}

function bindEmuInput() {
  bindEmuNeigung();
  if (emuInputBound) return;
  emuInputBound = true;
  const wire = (id, name) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);
      emuButtonDown(name);
    });
    const up = (e) => { emuButtonUp(name); };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('pointerleave', up);
  };
  wire('emu-hit-left',   'left');
  wire('emu-hit-right',  'right');
  wire('emu-hit-up',     'up');
  wire('emu-hit-down',   'down');
  wire('emu-hit-center', 'center');
  wire('emu-hit-a',      'a');
  wire('emu-hit-b',      'b');
  // Keyboard mapping while the modal is open.
  const keyMap = {
    'ArrowLeft':  'left',  'ArrowRight': 'right',
    'ArrowUp':    'up',    'ArrowDown':  'down',
    ' ':          'center',
    'a': 'a', 'A': 'a',
    'b': 'b', 'B': 'b',
  };
  // Typing into the terminal (input()) or into a block's text field
  // must reach that field, not the emulated buttons.
  const typingElsewhere = (e) => {
    if (emu.inputActive) return true;
    const t = e.target;
    return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);
  };
  document.addEventListener('keydown', (e) => {
    if (deviceMode !== 'emulator') return;
    if (typingElsewhere(e)) return;
    const k = keyMap[e.key];
    if (!k) return;
    // preventDefault also for auto-repeat events: otherwise a held arrow
    // key or space scrolls the page while steering the emulator.
    e.preventDefault();
    if (e.repeat) return;
    emuButtonDown(k);
  });
  document.addEventListener('keyup', (e) => {
    if (deviceMode !== 'emulator') return;
    const k = keyMap[e.key];
    if (!k) return;
    e.preventDefault();
    emuButtonUp(k);
  });
}

// --- LED updates -------------------------------------------------
function emuSetLed(idx, on) {
  emu.leds[idx] = !!on;
  const ids = ['emu-led-red', 'emu-led-yellow', 'emu-led-green'];
  const dim = ['#3a0a0a', '#3a3a0a', '#0a3a0a'];
  // Bright colours with white-tinged cores. The actual SMD LEDs on the
  // device emit a much brighter point than the body colour, so we use
  // a near-white body and bleed the saturated colour into the
  // surrounding glow.
  const lit  = ['#ffe0e0', '#ffffe0', '#e0ffe0'];
  const glow = ['#ff2030', '#ffe040', '#30ff60'];
  const el = document.getElementById(ids[idx]);
  if (el) {
    if (on) {
      el.style.background = lit[idx];
      el.style.opacity = '1';
      // Multi-layer box-shadow makes the LED look like it's actually
      // emitting light: a tight bright halo plus a soft wider bloom.
      el.style.boxShadow =
        '0 0 4px 1px ' + lit[idx] + ', ' +
        '0 0 10px 3px ' + glow[idx] + ', ' +
        '0 0 18px 6px ' + glow[idx];
    } else {
      el.style.background = dim[idx];
      el.style.opacity = '0.55';
      el.style.boxShadow = 'inset 0 0 2px rgba(0,0,0,0.5)';
    }
  }
}
function emuSetRgb(r, g, b) {
  emu.rgbColor = (r << 16) | (g << 8) | b;
  const hex = '#' + emu.rgbColor.toString(16).padStart(6, '0');
  const el = document.getElementById('emu-rgb');
  if (el) {
    if ((r|g|b) === 0) {
      // Off: invisible against the white "+" character.
      el.style.background = 'transparent';
      el.style.boxShadow = 'none';
    } else {
      // On: white-hot core with the chosen colour bleeding outward.
      // Multi-layer glow makes the LED clearly visible even against
      // the bright white "+" sign of the PBC+ logo.
      el.style.background = '#ffffff';
      el.style.boxShadow =
        '0 0 4px 2px ' + hex + ', ' +
        '0 0 12px 5px ' + hex + ', ' +
        '0 0 22px 8px ' + hex;
    }
  }
}

// Buzzer via WebAudio. We keep a single oscillator alive and just
// retune it on each tone() call -- starting/stopping oscillators
// is expensive and causes audible clicks. `no_tone()` and the
// duration-based `tone(freq, ms)` variant fade the gain to zero
// (still leaves the osc running, but inaudible).
function emuTon(freq, ms) {
  try {
    if (!emu.audioCtx) {
      emu.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      emu.audioOsc = emu.audioCtx.createOscillator();
      emu.audioGain = emu.audioCtx.createGain();
      emu.audioGain.gain.value = 0;   // silent until first tone
      emu.audioOsc.connect(emu.audioGain);
      emu.audioGain.connect(emu.audioCtx.destination);
      emu.audioOsc.type = 'square';   // closest to a piezo buzzer
      emu.audioOsc.start();
    }
    // Browser blocks audio until first user gesture; if the ctx
    // is suspended just retry resume(). It's fire-and-forget.
    if (emu.audioCtx.state === 'suspended') emu.audioCtx.resume();
    // A new tone replaces the previous one, including a fade-out
    // that an earlier tone(f, ms) scheduled.
    emu.audioGain.gain.cancelScheduledValues(emu.audioCtx.currentTime);
    emu.audioOsc.frequency.setValueAtTime(
      Math.max(20, Math.min(20000, freq | 0)),
      emu.audioCtx.currentTime);
    emu.audioGain.gain.setValueAtTime(0.15, emu.audioCtx.currentTime);
    // If a duration was given, schedule a fade-out at the end. The
    // real device blocks for that long; we can't easily block JS
    // here, but the Python side calls a separate sleep so the
    // effect lines up.
    if (ms !== null && ms !== undefined && ms > 0) {
      emu.audioGain.gain.setValueAtTime(
        0.15, emu.audioCtx.currentTime + ms/1000 - 0.01);
      emu.audioGain.gain.linearRampToValueAtTime(
        0, emu.audioCtx.currentTime + ms/1000);
    }
  } catch (_) { /* audio unavailable, just ignore */ }
}
function emuTonAus() {
  try {
    if (emu.audioGain) {
      emu.audioGain.gain.cancelScheduledValues(emu.audioCtx.currentTime);
      emu.audioGain.gain.setValueAtTime(0, emu.audioCtx.currentTime);
    }
  } catch (_) {}
}

// Number of lines fullProgram() puts in front of the editor text
// (auto-added imports). Text mode only; 0 otherwise.
function userLineOffset() {
  if (!isTextMode || !codeEditor) return 0;
  const body = codeEditor.getValue();
  const full = fullProgram();
  const at = full.lastIndexOf(body);
  return at > 0 ? full.slice(0, at).split('\n').length - 1 : 0;
}

// Rewrite "line N" in a traceback to the line number in the editor.
// toProgramLine(n) maps a line of the code that ran to a line of
// fullProgram() (or null for an internal line).
function remapTraceback(msg, toProgramLine) {
  const off = userLineOffset();
  let ok = false, letzte = 0;
  const zeilen = [];
  for (const zeile of msg.split('\n')) {
    const fm = zeile.match(/^(\s*File "[^"]*", )line (\d+)(.*)$/);
    if (!fm) { zeilen.push(zeile); continue; }
    const p = toProgramLine(Number(fm[2]));
    const u = p == null ? 0 : p - off;
    if (u < 1) continue;               // a frame in emulator-internal code
    ok = true;
    letzte = u;
    // The emulator runs plain programs inside a helper "__m"; an
    // awaited constructor runs as "__pbc_init__".
    // underlined: the terminal makes it a link to the editor line
    zeilen.push(fm[1] + '\x1b[4mline ' + u + '\x1b[24m' + fm[3].replace(/, in __m$/, ', in <module>')
                                            .replace(/, in __pbc_init__$/, ', in __init__'));
  }
  // innermost frame in the student's code: mark it in the editor
  if (ok && typeof window.pbcMarkiereFehlerzeile === 'function') window.pbcMarkiereFehlerzeile(letzte);
  return { text: ok ? zeilen.join('\n') : msg, ok };
}
