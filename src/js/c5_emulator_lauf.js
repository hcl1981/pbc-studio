// The tilt pad only appears for programs that read the tilt sensor.
function emuNeigungAnzeigen(code) {
  const el = document.getElementById('emu-neigung');
  if (!el) return;
  const ohne = typeof pyNurCode === 'function' ? pyNurCode(code || '') : (code || '');
  const vorher = el.style.display;
  el.style.display = /\baccel_[xyz]/.test(ohne) ? 'flex' : 'none';
  // the pad changes the panel height
  if (el.style.display !== vorher && typeof applyEmuIntegerScale === 'function') applyEmuIntegerScale();
}

// Programs run in a Web Worker (c3_emulator_worker.js). That needs a
// cross-origin isolated page (headers from src/htaccess); without it the
// emulator explains why it cannot run.
async function emuRun(code) {
  emuNeigungAnzeigen(code);
  if (!emuWorkerMoeglich()) { emuOhneIsolation(); return; }
  return emuWorkerRun(code);
}
function emuStop() {
  if (emuWorkerMoeglich()) emuWorkerStop();
}

// --- drag handling -----------------------------------------------
// The drag handler is wired ONCE on first connect. We track that
// with a flag so subsequent connects don't stack listeners.
let emuDragBound = false;
function bindEmuDrag() {
  if (emuDragBound) return;
  emuDragBound = true;
  const panel  = document.getElementById('emulator-panel');
  const handle = document.getElementById('emu-drag-handle');
  let startX = 0, startY = 0, panelX = 0, panelY = 0, dragging = false;
  handle.addEventListener('pointerdown', (e) => {
    // Ignore clicks on the close button -- it's a child of the handle
    // but should not start a drag.
    if (e.target.closest('#emu-close-btn')) return;
    dragging = true;
    handle.setPointerCapture(e.pointerId);
    const r = panel.getBoundingClientRect();
    panelX = r.left; panelY = r.top;
    startX = e.clientX; startY = e.clientY;
    // Switch from right-anchored to absolute coords so the panel
    // doesn't snap to a different position on the first move.
    panel.style.left = r.left + 'px';
    panel.style.top  = r.top + 'px';
    panel.style.right = 'auto';
    e.preventDefault();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    let nx = panelX + (e.clientX - startX);
    let ny = panelY + (e.clientY - startY);
    // Keep at least 20px of the panel on-screen so the user can't
    // accidentally drag it off the viewport into oblivion.
    const margin = 20;
    nx = Math.max(margin - panel.offsetWidth + 60,
                  Math.min(window.innerWidth - margin, nx));
    ny = Math.max(0,
                  Math.min(window.innerHeight - margin, ny));
    panel.style.left = nx + 'px';
    panel.style.top  = ny + 'px';
  });
  const stop = (e) => { dragging = false; };
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
}

// Size the emulator panel so the 240x280 display sits exactly on the
// display of the board photo and stays crisp. The display occupies a
// fixed part of the photo (FRAC_*), so the photo width follows from the
// display scale. Preferred: a whole number of screen pixels or of CSS
// pixels per emulator pixel (Windows scaling 125 %, 150 % … changes
// devicePixelRatio); if that leaves a small screen's display much
// smaller than the space allows, simply the largest scale that fits. Header, footer and tilt pad of the
// panel count towards the height.
const EMU_DISP = {
  W: 240, H: 280,
  LEFT: 0.1281, TOP: 0.1275,  // display position as fraction of the photo
  FRAC_W: 0.7422,   // display width  as fraction of the PCB photo width
  FRAC_H: 0.5092,   // display height as fraction of the PCB photo height
  ASPECT: 609 / 1035, // panel width:height of the photo
};
function applyEmuIntegerScale() {
  const panel = document.getElementById('emulator-panel');
  const geraet = document.getElementById('emu-device');
  const cv = document.getElementById('emu-display');
  if (!panel || !geraet || !cv || panel.style.display === 'none') return;
  const rand = panel.offsetWidth - panel.clientWidth;            // left+right border
  const zusatzH = panel.offsetHeight - geraet.offsetHeight;      // header, footer, tilt pad
  // docked at top:60px; a panel dragged lower does not shrink because of it
  const oben = Math.min(60, Math.max(0, panel.getBoundingClientRect().top));
  const availH = Math.max(120, window.innerHeight - oben - 12 - zusatzH);
  const availW = Math.max(120, Math.min(window.innerWidth - 32, window.innerWidth * 0.6) - rand);
  // photo size for a display scale s (CSS pixels per emulator pixel)
  const fotoW = (s) => EMU_DISP.W * s / EMU_DISP.FRAC_W;
  const passt = (s) => fotoW(s) <= availW && fotoW(s) / EMU_DISP.ASPECT <= availH;
  const dpr = window.devicePixelRatio || 1;
  // whole screen pixels (k/dpr) or whole CSS pixels (k), the largest that fits
  let scale = 0;
  for (let k = 1; k <= 16; k++) {
    for (const s of [k / dpr, k]) if (s > scale && passt(s)) scale = s;
  }
  // below the normal size (scale 1) the crisp scale can be much smaller
  // than the space allows; then take the largest that fits, at most 1
  const groesste = Math.min(1, availW / fotoW(1), availH / (fotoW(1) / EMU_DISP.ASPECT));
  if (scale < groesste * 0.8) scale = groesste;
  const w = fotoW(scale);
  panel.style.width = (w + rand) + 'px';
  emu._scale = scale;
  // the canvas gets its exact size and the photo's display position
  cv.style.left = (EMU_DISP.LEFT * 100) + '%';
  cv.style.top = (EMU_DISP.TOP * 100) + '%';
  cv.style.width = (EMU_DISP.W * scale) + 'px';
  cv.style.height = (EMU_DISP.H * scale) + 'px';
}

// --- connect / disconnect ----------------------------------------
async function connectEmulator() {
  // Show the floating panel. Unlike the modals elsewhere in the IDE
  // it's NOT a full-screen overlay; it docks in the top-right and
  // leaves the IDE underneath fully clickable so the student can
  // press Testen / Stop, edit blocks, etc. while it's visible.
  document.getElementById('emulator-panel').style.display = 'block';
  // Snap the panel to the largest whole-pixel display scale that fits.
  applyEmuIntegerScale();
  document.getElementById('emu-text-warning').style.display =
    (typeof isTextMode !== 'undefined' && isTextMode) ? 'block' : 'none';

  // Wire up the canvas the first time we see it.
  const canvas = document.getElementById('emu-display');
  emu.ctx = canvas.getContext('2d');
  emu.ctx.imageSmoothingEnabled = false;
  emu.fb = new Uint16Array(emu.W * emu.H);
  emuFlushAll();
  // Make sure all device state shown to the user is clean.
  emuSetLed(0, false);
  emuSetLed(1, false);
  emuSetLed(2, false);
  emuSetRgb(0, 0, 0);

  bindEmuInput();
  bindEmuDrag();

  // Mark as connected so runOnDevice/uploadBlob/etc. route to us.
  deviceMode = 'emulator';
  serialPort = { __emulator: true };
  // Reflect connected state on the new Verbinden/Trennen button.
  if (typeof updateConnectButton === 'function') updateConnectButton();

  // Pre-populate the image-block dropdowns with whatever PNGs are
  // already in IndexedDB so the student can pick them right away
  // instead of having to open "Bilder verwalten" first.
  if (window.__emuImgList) {
    try {
      const entries = await window.__emuImgList();
      KNOWN_IMAGES = entries
        .filter(e => e.name.toLowerCase().endsWith('.png'))
        .map(e => e.name)
        .sort();
      if (typeof refreshImageBlocks === 'function') {
        refreshImageBlocks();
      }
    } catch (e) {
      console.warn('imgList failed on emu connect:', e);
    }
  }

  // Start the worker and MicroPython now, so the first run starts at once.
  if (emuWorkerMoeglich()) {
    if (!wk.worker) wkStarteWorker().catch(() => {});
  } else {
    emuOhneIsolation();
  }
}

function disconnectEmulator() {
  emuStop();
  document.getElementById('emulator-panel').style.display = 'none';
  deviceMode = null;
  serialPort = null;
  setEmuStatus('getrennt');
  if (typeof updateConnectButton === 'function') updateConnectButton();
}

document.getElementById('emu-close-btn').addEventListener(
  'click', disconnectEmulator);
// NOTE: no click-outside-to-close handler. The panel only closes via
// the × button (or by pressing Verbinden again to toggle).

// --- images panel ------------------------------------------------
// The Images button has been removed from the panel header per UX
// request; the listing code stays available behind window.__showEmuImages
// in case it's needed later. document.getElementById can return null
// here (after the header redesign), so we only wire it up if the
// element actually exists.
const _emuImagesBtn = document.getElementById('emu-images-btn');
async function showEmuImages() {
  const list = document.getElementById('emu-images-list');
  if (!list) return;
  list.innerHTML = '<div style="padding:8px;color:var(--fg-2);">lädt…</div>';
  document.getElementById('emu-images-modal').classList.add('show');
  const images = await imgList();
  if (images.length === 0) {
    list.innerHTML =
      '<div style="padding:12px;color:var(--fg-2);">' +
      'Noch keine Bilder. Lade welche über „Bilder verwalten" hoch oder ' +
      'zeichne welche mit „Bild zeichnen…".</div>';
    return;
  }
  list.innerHTML = '';
  images.forEach(({name, blob}) => {
    const url = URL.createObjectURL(blob);
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;gap:10px;align-items:center;padding:6px;' +
      'border-bottom:1px solid var(--border);';
    row.innerHTML = `
      <img src="${url}" style="width:40px;height:40px;
           image-rendering:pixelated;background:#222;border-radius:3px;">
      <div style="flex:1;font-family:ui-monospace,monospace;font-size:13px;
                  color:var(--fg-0);">${name}</div>
      <div style="color:var(--fg-2);font-size:12px;">
        ${(blob.size/1024).toFixed(1)} KB</div>
      <button class="tb-btn" data-del="${name}"
              style="width:32px;padding:6px 0;font-size:18px;line-height:1;
                     color:var(--bad);font-weight:bold;">×</button>
    `;
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!confirm(name + ' aus dem Browser löschen?')) return;
      await imgDelete(name);
      showEmuImages();   // refresh
    });
    list.appendChild(row);
  });
}
if (_emuImagesBtn) _emuImagesBtn.addEventListener('click', showEmuImages);
const _emuImagesClose = document.getElementById('emu-images-close');
if (_emuImagesClose) _emuImagesClose.addEventListener('click', () => {
  document.getElementById('emu-images-modal').classList.remove('show');
});
window.__showEmuImages = showEmuImages;

// Expose internal helpers globally for the menu wiring above.
window.__connectEmulator = connectEmulator;
window.__disconnectEmulator = disconnectEmulator;
window.__emuRun = emuRun;

})();

// "Datei auf den PBC+…" menu entry: open a native file picker (any
// type, multi-select allowed) and stream each chosen file straight to
// the device via uploadBlob. Used for non-image assets like text files,
// CSV data, custom .py modules, sound samples, etc. -- the existing
// image manager has its own crop/scale UI, so we keep that flow.
function uploadArbitraryFile() {
  if (!serialPort) {
    toast(t('Erst verbinden.'), 'warn');
    return;
  }
  let inp = document.getElementById('file-upload-any');
  if (!inp) {
    inp = document.createElement('input');
    inp.type = 'file';
    inp.id = 'file-upload-any';
    inp.multiple = true;
    inp.style.display = 'none';
    inp.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files);
      e.target.value = '';   // allow re-uploading the same name later
      for (const f of files) {
        await uploadBlob(f, f.name);
      }
    });
    document.body.appendChild(inp);
  }
  inp.click();
}

