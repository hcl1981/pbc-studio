/* =====================================================================
 * Image manager
 * ===================================================================== */

document.getElementById('btn-images').addEventListener('click', async () => {
  cancelBlocklyGesture();
  if (!(await ensureTargetReady())) return;
  const h = document.querySelector('#img-modal h2');
  if (h) h.textContent = t('Bilder auf dem') + ' ' + targetLabel();
  document.getElementById('img-modal').classList.add('show');
  refreshImages();
});
document.getElementById('img-close').addEventListener('click', () => {
  document.getElementById('img-modal').classList.remove('show');
});
document.getElementById('img-refresh').addEventListener('click', refreshImages);
document.getElementById('img-upload-btn').addEventListener('click', () => {
  // Open the image editor instead of uploading raw -- the editor lets
  // the user crop / scale to the display's 240x280 before transfer.
  document.getElementById('img-modal').classList.remove('show');
  openImageEditor();
});
document.getElementById('file-image').addEventListener('change', async (e) => {
  // Drag-and-drop / direct file-input path. Unlike the image editor
  // (which already routes through an HTML5 canvas and so produces
  // standard 8-bit RGBA PNGs), this path could pass through a
  // grayscale or palette PNG that the firmware's png.py decoder
  // doesn't fully support. Normalise each file by drawing it onto a
  // canvas and re-exporting as PNG -- that gives us RGBA every time.
  const files = Array.from(e.target.files);
  e.target.value = '';
  if (!(await ensureTargetReady())) return;
  for (const f of files) {
    const normalised = await normaliseToRgbaPng(f).catch(err => {
      console.warn('PNG normalise failed for', f.name, err);
      return null;
    });
    const blob = normalised || f;
    await uploadBlob(blob, f.name);
  }
  refreshImages();
});

// ZIP with several images: every PNG inside goes straight to the
// target (browser storage for the emulator, the device over serial),
// without the image editor. Folders in the ZIP are ignored, only the
// file names count.
document.getElementById('img-zip-btn').addEventListener('click', () => {
  document.getElementById('file-zip').click();
});
document.getElementById('file-zip').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  if (!(await ensureTargetReady())) return;
  let pngs;
  try {
    pngs = (await zipEintraege(f)).filter(z => /\.png$/i.test(z.name));
  } catch (err) {
    toast(t('ZIP-Datei nicht lesbar:') + ' ' + err.message, 'bad');
    return;
  }
  if (!pngs.length) { toast(t('Keine PNG-Bilder in der ZIP-Datei.'), 'warn'); return; }
  const liste = [];
  for (const z of pngs) {
    try {
      const datei = new File([await z.daten()], z.name, { type: 'image/png' });
      const normalised = await normaliseToRgbaPng(datei).catch(() => null);
      liste.push({ name: z.name, blob: normalised || datei });
    } catch (err) {
      toast(t('ZIP-Datei nicht lesbar:') + ' ' + z.name + ': ' + err.message, 'bad');
    }
  }
  if (!(await passtAufsGeraet(liste))) return;
  let ok = 0;
  for (const z of liste) {
    if (!(await uploadBlob(z.blob, z.name))) break;   // device gone
    ok++;
  }
  refreshImages();
  // The toast is gone after 2 s; the terminal keeps the summary.
  const meldung = ok + ' ' + t('von') + ' ' + pngs.length + ' ' + t('Bilder aus der ZIP-Datei hochgeladen');
  term.write('\r\n\x1b[' + (ok === pngs.length ? '32' : '31') + 'm-- ' + meldung + ' --\x1b[0m\r\n');
  toast(meldung, ok === pngs.length ? 'good' : 'bad');
});

// Entries of a ZIP file as [{name, daten: async () => Uint8Array}].
// Reads the central directory; "stored" and "deflate" entries (what
// every common ZIP tool writes) are supported, deflate through the
// browser's DecompressionStream.
async function zipEintraege(file) {
  const buf = new Uint8Array(await file.arrayBuffer());
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End of central directory record, searched from the end (a ZIP
  // comment may follow it, up to 64 KB).
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 22 - 0xffff); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error(t('keine ZIP-Datei'));
  const anzahl = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const liste = [];
  for (let n = 0; n < anzahl; n++) {
    if (p + 46 > buf.length || dv.getUint32(p, true) !== 0x02014b50) throw new Error(t('keine ZIP-Datei'));
    const flags = dv.getUint16(p + 8, true);
    const methode = dv.getUint16(p + 10, true);
    const laenge = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const kommLen = dv.getUint16(p + 32, true);
    const lokal = dv.getUint32(p + 42, true);
    const pfad = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + kommLen;
    const name = pfad.split('/').pop();
    // folders, macOS extras (__MACOSX/, ._name) and hidden files
    if (!name || name.startsWith('.') || pfad.startsWith('__MACOSX/')) continue;
    if (flags & 1) throw new Error(t('verschlüsselte ZIP-Dateien gehen nicht'));
    const start = lokal + 30 + dv.getUint16(lokal + 26, true) + dv.getUint16(lokal + 28, true);
    const roh = buf.subarray(start, start + laenge);
    liste.push({ name, daten: async () => {
      if (methode === 0) return roh;
      if (methode !== 8) throw new Error(t('unbekannte Packart') + ' ' + methode);
      const strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Uint8Array(await new Response(strom).arrayBuffer());
    } });
  }
  return liste;
}

// Files of a ZIP for the device, as [{name, blob}]. The device has one
// flat folder, so of two entries with the same name only the first
// stays. System files are left alone: a main.py from a ZIP would
// replace the one the device starts with.
async function zipFuerGeraet(file) {
  const liste = [];
  const gesehen = new Set();
  for (const z of await zipEintraege(file)) {
    const grund = ['boot.py', 'main.py', 'pbc.py'].indexOf(z.name) >= 0 ? t('Systemdatei')
      : gesehen.has(z.name) ? t('Name doppelt') : '';
    if (grund) {
      term.write('\r\n\x1b[33m-- ' + t('Ausgelassen:') + ' ' + z.name + ' (' + grund + ') --\x1b[0m\r\n');
      continue;
    }
    gesehen.add(z.name);
    const blob = new Blob([await z.daten()], { type: /\.png$/i.test(z.name) ? 'image/png' : '' });
    const datei = new File([blob], z.name, { type: blob.type });
    liste.push({ name: z.name, blob: await normaliseToRgbaPng(datei).catch(() => null) || datei });
  }
  return liste;
}

// Is there room for these files on the device? Checked up front, so a
// big ZIP does not stop halfway. Files that get replaced free their
// room; the emulator stores in the browser and has no such limit.
async function passtAufsGeraet(liste) {
  if (runTarget === 'emulator') return true;
  const r = await runOnDevice("import os\ns = os.statvfs('/')\nprint(s[0], s[3])\n", 5000);
  const m = r && !r.stderr && (r.stdout || '').match(/(\d+)\s+(\d+)/);
  const alt = m && await listDeviceFilesRaw();
  if (!alt) return true;   // not measurable: the upload reports its own errors
  const block = parseInt(m[1], 10);
  const belegt = (n) => Math.ceil(n / block) * block;
  let frei = block * parseInt(m[2], 10);
  let noetig = 0;
  for (const f of liste) {
    noetig += belegt(f.blob.size);
    const da = alt.find(a => a.name === f.name);
    if (da && da.size > 0) frei += belegt(da.size);
  }
  if (noetig <= frei) return true;
  const kb = (n) => Math.ceil(n / 1024) + ' KB';
  const meldung = t('Nicht genug Platz:') + ' ' + kb(noetig) + ' ' + t('nötig') + ', ' + kb(frei) + ' ' + t('frei');
  term.write('\r\n\x1b[31m-- ' + meldung + ' --\x1b[0m\r\n');
  toast(meldung, 'bad');
  return false;
}

// Load a File as an Image, paint it onto a canvas of the same size,
// and re-export as PNG. The canvas pipeline normalises any input
// PNG (palette / grayscale / 16-bit) into the 8-bit RGBA the device
// expects. Returns null on failure so the caller can fall back to
// the raw upload.
async function normaliseToRgbaPng(file) {
  if (!file || !/\.png$/i.test(file.name)) return null;
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        const ctx = c.getContext('2d');
        ctx.drawImage(img, 0, 0);
        c.toBlob(blob => {
          URL.revokeObjectURL(url);
          resolve(blob);
        }, 'image/png');
      } catch (_) {
        URL.revokeObjectURL(url);
        resolve(null);
      }
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

// Upload a Blob (File or canvas-derived Blob) under the given name.
// Replaces the older uploadImage(file) helper, which is now a thin
// wrapper for back-compat.
// Convert a Uint8Array to a base64 string without blowing the JS call
// stack. The naive `btoa(String.fromCharCode(...buf))` works only for
// small buffers (~65 k arguments max); larger PNGs spill over and the
// upload silently dies with "Maximum call stack size exceeded". The
// chunk size is conservative so it works on every browser.
function base64FromBytes(bytes) {
  const CHUNK = 0x8000;   // 32 768 -- well below any argv limit
  let bin = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

async function uploadBlob(blob, name) {
  // Emulator path: just stash the blob in IndexedDB; the in-browser
  // pbc.load_image() reads from there. This is what makes "save the
  // image" feel native -- no separate "sync" step.
  if (deviceMode === 'emulator') {
    if (window.__emuImgPut) {
      await window.__emuImgPut(name, blob);
      // Make the new file immediately visible in image-block
      // dropdowns. Without this, KNOWN_IMAGES stays stale until the
      // user opens "Bilder verwalten" (which calls refreshImages
      // and rebuilds the list).
      if (name.toLowerCase().endsWith('.png')) {
        if (KNOWN_IMAGES.indexOf(name) < 0) KNOWN_IMAGES.push(name);
        KNOWN_IMAGES.sort();
        if (typeof refreshImageBlocks === 'function') {
          refreshImageBlocks();
        }
      }
      toast(name + ' im Browser gespeichert', 'good');
      return true;
    }
  }
  // The RP2350's MicroPython heap can't fit a base64 string for a
  // full-size PNG -- a 130 KB image becomes a ~180 KB Python literal,
  // and that allocation alone fails on the device. Send the file in
  // 8 KB binary chunks (≈11 KB base64), opening 'wb' on the first
  // chunk to truncate and 'ab' for the rest to append.
  const buf = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 8 * 1024;
  const total = buf.length;
  term.write('\r\n\x1b[36m-- ' + t('Hochladen:') + ' ' + name +
             ' (' + (total / 1024).toFixed(1) + ' KB) --\x1b[0m\r\n');

  for (let offset = 0; offset < total; offset += CHUNK) {
    const slice = buf.subarray(offset, Math.min(offset + CHUNK, total));
    const b64 = base64FromBytes(slice);
    const mode = offset === 0 ? 'wb' : 'ab';
    const code = `
import binascii
with open(${pyStringLit(name)}, ${pyStringLit(mode)}) as _f:
    _f.write(binascii.a2b_base64(${pyStringLit(b64)}))
`;
    const r = await runOnDevice(code, 20000);
    if (!r) {
      term.write('\r\n\x1b[31m[' + t('Verbindung zum Gerät verloren') + ']\x1b[0m\r\n');
      toast(t('Hochladen fehlgeschlagen'), 'bad');
      return false;
    }
    if (r.stderr) {
      term.write('\r\n\x1b[31m' + r.stderr.replace(/\n/g,'\r\n') + '\x1b[0m\r\n');
      toast(t('Hochladen fehlgeschlagen'), 'bad');
      return false;
    }
    // Inline progress percentage -- "\r" lets us overwrite the line
    // each tick instead of spamming the terminal with new rows.
    const done = Math.min(offset + slice.length, total);
    const pct = Math.round(done / total * 100);
    term.write('\r\x1b[36m   ' + pct + ' %  '
              + (done / 1024).toFixed(1) + ' / '
              + (total / 1024).toFixed(1) + ' KB\x1b[0m');
  }
  term.write('\r\n\x1b[32m-- ' + t('fertig') + ' --\x1b[0m\r\n');
  toast(name + ' ' + t('hochgeladen'), 'good');
  return true;
}
async function uploadImage(file) { return uploadBlob(file, file.name); }

// Read a file from the PBC+ into the browser and prompt a download.
// Mirror of uploadBlob: chunk the file on the device side so we never
// need to materialise the whole base64 string in MicroPython's RAM
// (a single 130 KB binary becomes ~180 KB of base64). 8 KB binary
// chunks → ~11 KB base64 per print, which the REPL handles fine.
async function downloadFile(name) {
  if (!serialPort && deviceMode !== 'emulator') { toast(t('Erst verbinden.'), 'warn'); return false; }
  // Emulator path: pull directly from IndexedDB and save via a
  // blob download. No need to chunk-transfer over a non-existent
  // serial connection.
  if (deviceMode === 'emulator' && window.__emuImgGet) {
    const blob = await window.__emuImgGet(name);
    if (!blob) {
      toast(t('Datei nicht lesbar:') + ' ' + name, 'bad');
      return false;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast(name + ' heruntergeladen', 'good');
    return true;
  }
  term.write('\r\n\x1b[36m-- ' + t('Herunterladen:') + ' ' + name +
             ' --\x1b[0m\r\n');

  // First call: figure out file size + open the file handle.
  // Subsequent calls read CHUNK bytes at the given offset. We don't
  // keep the file handle open across runOnDevice() invocations
  // because each call enters a fresh raw-paste exec and globals
  // wouldn't survive a soft-reset between runs. Re-opening per
  // chunk is cheap.
  const sizeCode =
    'import os\n' +
    'try:\n' +
    "    print('SIZE', os.stat(" + pyStringLit(name) + ")[6])\n" +
    'except Exception as e:\n' +
    "    print('ERR', repr(e))\n";
  const sizeR = await runOnDevice(sizeCode, 5000);
  if (!sizeR || sizeR.stderr) {
    toast(t('Herunterladen fehlgeschlagen'), 'bad');
    return false;
  }
  const m = (sizeR.stdout || '').match(/SIZE\s+(\d+)/);
  if (!m) {
    const err = (sizeR.stdout || '').match(/ERR\s+(.*)/);
    toast(t('Datei nicht lesbar:') + ' ' + (err ? err[1] : name), 'bad');
    return false;
  }
  const total = parseInt(m[1], 10);
  const CHUNK = 8 * 1024;
  const parts = [];
  for (let offset = 0; offset < total; offset += CHUNK) {
    const code =
      'import binascii\n' +
      'with open(' + pyStringLit(name) + ", 'rb') as _f:\n" +
      '    _f.seek(' + offset + ')\n' +
      '    _data = _f.read(' + CHUNK + ')\n' +
      'print(binascii.b2a_base64(_data).decode().strip())\n';
    const r = await runOnDevice(code, 15000);
    if (!r || r.stderr) {
      term.write('\r\n\x1b[31m[' + t('Verbindung zum Gerät verloren') + ']\x1b[0m\r\n');
      toast(t('Herunterladen fehlgeschlagen'), 'bad');
      return false;
    }
    // The raw-paste reply may include trailing whitespace; strip it.
    const b64 = (r.stdout || '').trim();
    parts.push(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
    const done = Math.min(offset + CHUNK, total);
    const pct = Math.round(done / total * 100);
    term.write('\r\x1b[36m   ' + pct + ' %  '
              + (done / 1024).toFixed(1) + ' / '
              + (total / 1024).toFixed(1) + ' KB\x1b[0m');
  }
  term.write('\r\n\x1b[32m-- ' + t('fertig') + ' --\x1b[0m\r\n');

  // Glue the chunks together into one Uint8Array, wrap as a blob,
  // and trigger a browser download via an off-DOM <a download>.
  let totalLen = 0;
  parts.forEach(p => totalLen += p.length);
  const combined = new Uint8Array(totalLen);
  let off = 0;
  parts.forEach(p => { combined.set(p, off); off += p.length; });
  const blob = new Blob([combined], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(name + ' ' + t('heruntergeladen'), 'good');
  return true;
}

// =====================================================================
// Paint editor: a tiny in-browser drawing app for creating sprite
// graphics without needing a separate image editor. Two stages:
//
//   1) Size picker -- a few presets (sprite-like 16/32/48, full
//      display 240x280) plus arbitrary custom dimensions.
//   2) Canvas + tool palette -- pen, line, rect, ellipse (filled and
//      outlined), eraser. Adjustable stroke width and colour, with
//      an explicit "transparent" toggle for drawing alpha-zero
//      pixels (useful for cutting holes / planning sprite shapes).
//
// On save we export the canvas as an RGBA PNG via canvas.toBlob()
// and feed it into the existing uploadBlob() pipeline -- same
// transport the "PNG hochladen…" button uses, so the device sees
// no difference between a hand-drawn and an uploaded sprite.
//
// We don't roll our own PNG encoder; canvas.toBlob('image/png')
// gives us the right encoding for free, including the alpha channel
// that pbc.py's png loader expects.
// =====================================================================
(function() {

// Drawing state. Backed by a Uint8ClampedArray we keep in sync with
// the visible canvas; this lets us push undo snapshots and erase
// pixels back to fully transparent (which a normal canvas clearRect
// can do too, but managing it explicitly is simpler).
const paint = {
  w: 32, h: 32,
  scale: 1,                 // display px per image px
  tool: 'pen',
  color: '#000000',
  transparent: false,       // when true, draws fully-transparent
  size: 2,                  // stroke width in image pixels
  drawing: false,
  startX: 0, startY: 0,     // for line/rect/ellipse drag
  lastX: -1, lastY: -1,     // for pen continuation
  undoStack: [],
  filename: 'bild.png',
};

const SIZE_PRESETS = [
  { w: 16,  h: 16,  label: 'Mini-Sprite' },
  { w: 32,  h: 32,  label: 'kleines Sprite' },
  { w: 48,  h: 48,  label: 'mittleres Sprite' },
  { w: 64,  h: 64,  label: 'großes Sprite' },
  { w: 240, h: 280, label: 'ganzes Display' },
];

// --- size picker --------------------------------------------------
function openPaintEditor() {
  cancelBlocklyGesture();
  // Build the preset grid lazily on first open. Each button
  // commits its size into paint.{w,h} and jumps to the canvas.
  const grid = document.getElementById('paint-size-grid');
  grid.innerHTML = '';
  SIZE_PRESETS.forEach(p => {
    const b = document.createElement('button');
    b.innerHTML = '<strong>' + p.w + ' × ' + p.h + '</strong>' +
                  '<span class="preset-label">' + p.label + '</span>';
    b.addEventListener('click', () => {
      paint.w = p.w; paint.h = p.h;
      document.getElementById('paint-size-w').value = p.w;
      document.getElementById('paint-size-h').value = p.h;
      closePaintSizeModal();
      openPaintCanvas();
    });
    grid.appendChild(b);
  });
  document.getElementById('paint-size-modal').classList.add('show');
}
function closePaintSizeModal() {
  document.getElementById('paint-size-modal').classList.remove('show');
}
document.getElementById('paint-size-cancel').addEventListener(
  'click', closePaintSizeModal);
document.getElementById('paint-size-ok').addEventListener('click', () => {
  // Read the custom w/h fields and validate. We refuse sub-1 or
  // absurdly large values; the device's RAM caps useful sprites
  // well below 320×320 anyway.
  const w = Math.max(1, Math.min(320, parseInt(
    document.getElementById('paint-size-w').value, 10) || 32));
  const h = Math.max(1, Math.min(320, parseInt(
    document.getElementById('paint-size-h').value, 10) || 32));
  paint.w = w; paint.h = h;
  closePaintSizeModal();
  openPaintCanvas();
});
document.getElementById('paint-size-modal').addEventListener(
  'click', (e) => {
    if (e.target.id === 'paint-size-modal') closePaintSizeModal();
  });

// --- main canvas --------------------------------------------------
function openPaintCanvas() {
  // Pick a display scale that fits comfortably in the modal. We aim
  // for ~480 px display height max, biggest sprite-friendly scale.
  const MAX_DISPLAY = 480;
  let scale = Math.floor(Math.min(MAX_DISPLAY / paint.w,
                                  MAX_DISPLAY / paint.h));
  if (scale < 1) scale = 1;
  if (scale > 32) scale = 32;
  paint.scale = scale;

  // The wrapper holds two canvases. We size both identically in
  // display pixels but back them with the small "image-pixel"
  // resolution so each pixel actually corresponds to one PNG pixel.
  // The wrapper's CSS background paints the checkerboard transparency
  // indicator behind everything.
  const wrap = document.getElementById('paint-canvas-wrap');
  const dispW = paint.w * scale;
  const dispH = paint.h * scale;
  wrap.style.width  = dispW + 'px';
  wrap.style.height = dispH + 'px';
  ['paint-canvas', 'paint-canvas-preview'].forEach(id => {
    const c = document.getElementById(id);
    c.width  = paint.w;
    c.height = paint.h;
    c.style.width  = dispW + 'px';
    c.style.height = dispH + 'px';
  });

  // Reset the foreground canvas to fully transparent. The wrapper's
  // CSS checkerboard shows through.
  const c = document.getElementById('paint-canvas');
  const ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, paint.w, paint.h);

  // Preview canvas starts empty too.
  const pv = document.getElementById('paint-canvas-preview');
  const pvctx = pv.getContext('2d');
  pvctx.imageSmoothingEnabled = false;
  pvctx.clearRect(0, 0, paint.w, paint.h);

  paint.undoStack = [];
  paint.lastX = -1; paint.lastY = -1;
  paint.drawing = false;

  // Suggest a default filename based on the size; the user can edit
  // it in the save prompt later. "bild16.png" / "bild32x40.png" etc.
  paint.filename = (paint.w === paint.h)
    ? 'bild' + paint.w + '.png'
    : 'bild' + paint.w + 'x' + paint.h + '.png';
  document.getElementById('paint-title-size').textContent =
    paint.w + ' × ' + paint.h + ' px';

  setPaintTool('pen');
  document.getElementById('paint-modal').classList.add('show');
}
function closePaintEditor() {
  document.getElementById('paint-modal').classList.remove('show');
}

// --- tool selection ----------------------------------------------
function setPaintTool(tool) {
  paint.tool = tool;
  document.querySelectorAll('.paint-tool[data-tool]').forEach(b => {
    b.classList.toggle('active', b.dataset.tool === tool);
  });
}
document.querySelectorAll('.paint-tool[data-tool]').forEach(b => {
  b.addEventListener('click', () => setPaintTool(b.dataset.tool));
});
document.getElementById('paint-color-transparent').addEventListener(
  'click', () => {
    paint.transparent = !paint.transparent;
    document.getElementById('paint-color-transparent').classList.toggle(
      'active', paint.transparent);
  });
document.getElementById('paint-color').addEventListener('input', (e) => {
  paint.color = e.target.value;
  // Picking a colour implies "I want to draw in colour now", so turn
  // off the eraser toggle automatically -- otherwise the new colour
  // would be silently ignored.
  paint.transparent = false;
  document.getElementById('paint-color-transparent').classList.remove(
    'active');
});
document.getElementById('paint-size').addEventListener('input', (e) => {
  paint.size = parseInt(e.target.value, 10);
  document.getElementById('paint-size-label').textContent =
    paint.size + ' px';
});

// --- helpers ------------------------------------------------------
// Translate a pointer event into image-pixel coordinates.
function eventToImagePx(e) {
  const pv = document.getElementById('paint-canvas-preview');
  const r = pv.getBoundingClientRect();
  // Use clientX/Y so it works for both mouse and pen; touch events
  // pass through as pointer events too with the right touch-action.
  const x = Math.floor((e.clientX - r.left) / paint.scale);
  const y = Math.floor((e.clientY - r.top)  / paint.scale);
  return { x, y };
}

// Snapshot the current image for undo. We only keep the last ~30
// snapshots; each is a few KB of ImageData so the cap matters more
// for memory than speed.
function pushUndo() {
  const ctx = document.getElementById('paint-canvas').getContext('2d');
  paint.undoStack.push(ctx.getImageData(0, 0, paint.w, paint.h));
  if (paint.undoStack.length > 30) paint.undoStack.shift();
}

// Pick the right rendering operation for the current colour mode.
// "transparent" draws alpha-zero pixels by using "destination-out"
// composite mode, which subtracts the drawn shape from the canvas.
function withDrawingCtx(ctx, fn) {
  ctx.save();
  if (paint.transparent) {
    // destination-out: drawn pixels erase. Source colour is ignored.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.strokeStyle = '#000';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = paint.color;
    ctx.strokeStyle = paint.color;
  }
  ctx.lineWidth = paint.size;
  // Square line caps/joins: with `round` Canvas2D antialiases the
  // endpoints into half-transparent rings, which on a pixel-art
  // canvas looks blurry and -- worse -- those half-alpha pixels
  // mismatch what the device's PNG loader thresholds them to. Square
  // caps stay on the pixel grid.
  ctx.lineCap = 'square';
  ctx.lineJoin = 'miter';
  fn(ctx);
  ctx.restore();
}

// Pixel-art mode: after every drawing commit, walk the canvas and
// snap every pixel's alpha to either 0 or 255. Canvas2D antialiases
// circles, ellipses, and even diagonal lines by default; the soft
// edges show up as grey haloes on the editor's checkerboard
// background and as magenta fringes on the PBC+ (which treats
// alpha<128 as transparent). Thresholding here, immediately after
// every stamp/shape commit, means WYSIWYG between the editor and
// the device, and removes the need for a separate "no AA" rendering
// path (Canvas2D doesn't expose one).
function snapAlpha(ctx, w, h) {
  const img = ctx.getImageData(0, 0, w, h);
  const p = img.data;
  for (let i = 3; i < p.length; i += 4) {
    p[i] = (p[i] >= 128) ? 255 : 0;
  }
  ctx.putImageData(img, 0, 0);
}

// "Brush stamp" at (x,y) with rounded shape: a 1×1 pixel for size=1
// (a circle at radius 0.5 antialiases to a soft grey blob, which
// looks awful on a pixel-art canvas), and a filled circle of
// diameter `paint.size` for size > 1. The pen feels much more
// natural with rounded ends than with the previous square stamp,
// especially on diagonal strokes and at the start/finish of a line.
function stampAt(ctx, x, y) {
  const s = paint.size;
  withDrawingCtx(ctx, () => {
    if (s <= 1) {
      // Single-pixel placement: use an aligned fillRect so the
      // pixel doesn't get smeared by sub-pixel rounding.
      ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
    } else {
      // Filled circle, radius = size / 2, centred on the pixel.
      // arc() with fill() produces a clean disc that fits exactly
      // inside a size×size bounding box. Whole-pixel coordinates
      // keep it crisp on the small canvas.
      ctx.beginPath();
      ctx.arc(Math.floor(x) + 0.5, Math.floor(y) + 0.5,
              s / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  });
}

// Continuous pen stroke: draw a line of stamps between the last and
// current cursor positions. Uses Bresenham to step pixel-by-pixel
// so stamps at large `size` don't leave gaps along fast strokes.
function penStroke(ctx, x0, y0, x1, y1) {
  let dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1;
  let dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  while (true) {
    stampAt(ctx, x, y);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// --- pointer handlers --------------------------------------------
const previewCanvas = document.getElementById('paint-canvas-preview');

previewCanvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  previewCanvas.setPointerCapture(e.pointerId);
  const { x, y } = eventToImagePx(e);
  paint.drawing = true;
  paint.startX = x; paint.startY = y;
  paint.lastX = x;  paint.lastY = y;

  if (paint.tool === 'pen') {
    // Commit the first stamp immediately so single-clicks place a dot.
    pushUndo();
    const ctx = document.getElementById('paint-canvas').getContext('2d');
    stampAt(ctx, x, y);
    snapAlpha(ctx, paint.w, paint.h);
  } else {
    // Shape tools: snapshot before the drag so the preview can clear
    // cleanly and the final commit replaces the snapshot once.
    pushUndo();
  }
});

previewCanvas.addEventListener('pointermove', (e) => {
  if (!paint.drawing) return;
  e.preventDefault();
  const { x, y } = eventToImagePx(e);
  if (paint.tool === 'pen') {
    if (x === paint.lastX && y === paint.lastY) return;
    const ctx = document.getElementById('paint-canvas').getContext('2d');
    penStroke(ctx, paint.lastX, paint.lastY, x, y);
    // Snap alpha once per move, not once per Bresenham step --
    // the inner loop only touches pixels along the stroke, but
    // snapAlpha walks the whole image; doing it per pixel would
    // be O(image_size * stroke_length) and visibly stutter at
    // 240×280. Once per move event keeps it O(image_size *
    // moves), fast enough at any size.
    snapAlpha(ctx, paint.w, paint.h);
    paint.lastX = x; paint.lastY = y;
  } else {
    // Live preview for line / rect / ellipse: redraw on the preview
    // overlay every move, leaving the committed canvas alone until
    // pointerup. We deliberately don't snap alpha here -- the
    // preview is constantly redrawn from scratch on the next move,
    // and snapping every frame would make the live preview flicker.
    drawShapePreview(paint.startX, paint.startY, x, y);
  }
});

previewCanvas.addEventListener('pointerup', (e) => {
  if (!paint.drawing) return;
  paint.drawing = false;
  const { x, y } = eventToImagePx(e);
  if (paint.tool !== 'pen') {
    // Commit the previewed shape onto the real canvas, clear preview.
    const ctx = document.getElementById('paint-canvas').getContext('2d');
    drawShape(ctx, paint.startX, paint.startY, x, y);
    snapAlpha(ctx, paint.w, paint.h);
    const pvctx = previewCanvas.getContext('2d');
    pvctx.clearRect(0, 0, paint.w, paint.h);
  }
});

// Pointer leaving the canvas while dragging would otherwise strand
// us in `drawing=true` and keep the preview visible.
previewCanvas.addEventListener('pointercancel', () => {
  paint.drawing = false;
  const pvctx = previewCanvas.getContext('2d');
  pvctx.clearRect(0, 0, paint.w, paint.h);
});

// --- shape drawing ------------------------------------------------
function drawShapePreview(x0, y0, x1, y1) {
  const ctx = previewCanvas.getContext('2d');
  ctx.clearRect(0, 0, paint.w, paint.h);
  drawShape(ctx, x0, y0, x1, y1);
}

function drawShape(ctx, x0, y0, x1, y1) {
  switch (paint.tool) {
    case 'line':
      withDrawingCtx(ctx, () => {
        // For 1-pixel-wide lines on a tiny canvas, stroke() centers
        // on float coords and antialiases. Bresenham gives crisp
        // single-pixel lines, but for size > 1 stroke() is fine.
        if (paint.size === 1) {
          // Bresenham with single-pixel stamps.
          penStroke(ctx, x0, y0, x1, y1);
        } else {
          ctx.beginPath();
          ctx.moveTo(x0 + 0.5, y0 + 0.5);
          ctx.lineTo(x1 + 0.5, y1 + 0.5);
          ctx.stroke();
        }
      });
      break;
    case 'rect_fill':
      withDrawingCtx(ctx, () => {
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0) + 1;
        const h = Math.abs(y1 - y0) + 1;
        ctx.fillRect(x, y, w, h);
      });
      break;
    case 'rect':
      // Outline rectangle: draw four border bars only. Previously
      // we filled the rect and carved the inside with destination-out,
      // which had the side effect of erasing anything that already
      // sat inside the outline. Painting only the four sides keeps
      // the interior untouched.
      withDrawingCtx(ctx, () => {
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0) + 1;
        const h = Math.abs(y1 - y0) + 1;
        const t = Math.min(paint.size, Math.floor(Math.min(w, h) / 2) || 1);
        // top, bottom, left, right
        ctx.fillRect(x, y, w, t);
        ctx.fillRect(x, y + h - t, w, t);
        ctx.fillRect(x, y + t, t, h - 2*t);
        ctx.fillRect(x + w - t, y + t, t, h - 2*t);
      });
      break;
    case 'ellipse_fill':
      withDrawingCtx(ctx, () => {
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0) + 1;
        const h = Math.abs(y1 - y0) + 1;
        const cx = x + w/2;
        const cy = y + h/2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      break;
    case 'ellipse':
      // Outline ellipse: fill the outer ring only, using even-odd
      // fill rule. Path is: outer ellipse, then a smaller inner
      // ellipse; even-odd makes the area inside both ellipses
      // (i.e. the inner region) get punched out from the fill, but
      // ONLY for what we're drawing right now -- existing canvas
      // pixels in that region stay intact, unlike the previous
      // approach which used destination-out to erase the inside.
      withDrawingCtx(ctx, () => {
        const x = Math.min(x0, x1);
        const y = Math.min(y0, y1);
        const w = Math.abs(x1 - x0) + 1;
        const h = Math.abs(y1 - y0) + 1;
        const cx = x + w/2;
        const cy = y + h/2;
        const t = paint.size;
        if (w <= 2*t || h <= 2*t) {
          // Outline thicker than half the shape -- just fill solid.
          ctx.beginPath();
          ctx.ellipse(cx, cy, w/2, h/2, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.ellipse(cx, cy, w/2,     h/2,     0, 0, Math.PI * 2);
          ctx.ellipse(cx, cy, w/2 - t, h/2 - t, 0, 0, Math.PI * 2);
          ctx.fill('evenodd');
        }
      });
      break;
  }
}

// --- toolbar buttons ---------------------------------------------
document.getElementById('paint-undo').addEventListener('click', () => {
  if (paint.undoStack.length === 0) return;
  const ctx = document.getElementById('paint-canvas').getContext('2d');
  ctx.putImageData(paint.undoStack.pop(), 0, 0);
});
document.getElementById('paint-clear').addEventListener('click', () => {
  // "Neu" starts over from the size picker -- the most common reason
  // a student wants a clean slate is also wanting a different size
  // (16x16 sprite vs 240x280 full screen, etc.). Always confirm so
  // a misclick doesn't wipe the in-progress drawing.
  if (!confirm(t('Aktuelles Bild verwerfen und neu beginnen?'))) return;
  closePaintEditor();
  openPaintEditor();
});
document.getElementById('paint-cancel').addEventListener(
  'click', closePaintEditor);
document.getElementById('paint-modal').addEventListener('click', (e) => {
  if (e.target.id === 'paint-modal') closePaintEditor();
});

// --- save ---------------------------------------------------------
document.getElementById('paint-save').addEventListener('click', async () => {
  if (!serialPort) { toast(t('Erst verbinden.'), 'warn'); return; }

  // Ask for the filename only now (not on open). Default is the
  // size-based suggestion we stashed at canvas-creation time, but the
  // user can type whatever they want. Auto-appending .png happens
  // after the user confirms, so the input doesn't fight with them
  // while they're typing.
  const result = await askForm(t('Bild speichern'), [
    { label: t('Dateiname:'), default: paint.filename,
      validate: (v) => {
        if (!v.trim()) return t('Bitte Dateinamen eingeben.');
        // Filenames go straight to the device's filesystem, so reject
        // path separators and quotes that would break the upload's
        // Python string literal.
        if (/[\/\\'"`\s]/.test(v.trim())) {
          return t('Keine Leerzeichen oder /\\\'\"\` erlaubt.');
        }
        return null;
      } },
  ]);
  if (!result) return;     // user hit Abbrechen
  let name = result[0].trim();
  if (!/\.png$/i.test(name)) name += '.png';
  paint.filename = name;   // remember for next time the user clicks save

  // Check whether the file already exists on the device. We run a
  // tiny Python probe that prints "EXISTS" or "NEW" depending on
  // os.stat -- cheaper than listing the whole directory just for the
  // one-name check, and it can't lie about a freshly-uploaded file
  // (which a stale KNOWN_IMAGES cache could).
  const probe = await runOnDevice(
    'import os\n' +
    'try:\n' +
    '    os.stat(' + pyStringLit(name) + ')\n' +
    "    print('EXISTS')\n" +
    'except OSError:\n' +
    "    print('NEW')\n", 5000);
  const existsOnDevice = probe && probe.stdout &&
                         probe.stdout.indexOf('EXISTS') >= 0;
  if (existsOnDevice) {
    if (!confirm(t('Datei „') + name +
                 t('" existiert bereits auf dem PBC+ und wird überschrieben. Fortfahren?'))) {
      return;
    }
  }

  // Export as PNG via toBlob. Before we encode, snap every pixel's
  // alpha to either 0 or 255 -- the PBC+'s PNG loader treats alpha
  // < 128 as "transparent" (mapped to the magenta colour key) and
  // alpha >= 128 as fully opaque (keep the RGB). Canvas2D's shape
  // drawing antialiases by default, so the edges of circles, lines,
  // and even some diagonals end up with intermediate alpha values --
  // those would show up as magenta fringes on the device. By
  // hard-thresholding here we make sure every pixel ends up cleanly
  // in one camp or the other.
  const canvas = document.getElementById('paint-canvas');
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, paint.w, paint.h);
  const pixels = imgData.data;       // RGBA, 4 bytes per pixel
  for (let i = 3; i < pixels.length; i += 4) {
    pixels[i] = (pixels[i] >= 128) ? 255 : 0;
  }
  // Build a temporary off-DOM canvas to export from -- writing the
  // thresholded ImageData back to the editor's own canvas would be
  // visible on screen as a one-frame flash whenever the user clicks
  // Speichern, and worse, it would alter the editor state in a way
  // that the user didn't ask for (their next stroke would no longer
  // see the original semi-transparent pixels).
  const exportC = document.createElement('canvas');
  exportC.width = paint.w; exportC.height = paint.h;
  const exportCtx = exportC.getContext('2d');
  exportCtx.putImageData(imgData, 0, 0);
  exportC.toBlob(async (blob) => {
    if (!blob) { toast(t('Speichern fehlgeschlagen'), 'bad'); return; }
    const ok = await uploadBlob(blob, name);
    if (ok) {
      refreshImages();
      // Don't close the editor -- the user might want to keep
      // tweaking the image and re-save. Just toast confirmation.
    }
  }, 'image/png');
});

// --- entry point --------------------------------------------------
// Exposed globally so the "Bild zeichnen…" menu entry can launch it
// without needing the images modal as a stepping stone.
window.__openPaintEditor = openPaintEditor;

})();

