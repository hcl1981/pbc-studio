/* =====================================================================
 * Image editor: load an image from disk, drag a crop rectangle over
 * it, optionally scale down to a target size, then upload as PNG.
 * Output is capped at 240x280 (display size).
 * ===================================================================== */

const IE_DISPLAY_MAX_W = 240;
const IE_DISPLAY_MAX_H = 280;

const ieState = {
  img: null,           // HTMLImageElement of the loaded source
  displayScale: 1,     // factor from image px -> canvas px (<= 1)
  crop: { x: 0, y: 0, w: 0, h: 0 },   // in image px
  outW: 0, outH: 0,    // target PNG size (image px)
  dragging: null,      // 'move', 'nw', 'ne', 'sw', 'se' or null
  dragStart: null,     // { mx, my, crop }
};

function openImageEditor() {
  cancelBlocklyGesture(); document.getElementById('ie-modal').classList.add('show');
  if (!ieState.img) {
    document.getElementById('ie-empty').style.display = '';
    document.getElementById('ie-edit').style.display = 'none';
  } else {
    document.getElementById('ie-empty').style.display = 'none';
    document.getElementById('ie-edit').style.display = '';
    requestAnimationFrame(drawIeCanvas);
  }
}

function closeImageEditor() {
  document.getElementById('ie-modal').classList.remove('show');
}

document.getElementById('ie-pick-btn').addEventListener('click',
  () => document.getElementById('ie-file').click());
document.getElementById('ie-pick-btn-alt').addEventListener('click',
  () => document.getElementById('ie-file').click());
document.getElementById('ie-cancel').addEventListener('click', closeImageEditor);
document.getElementById('ie-modal').addEventListener('click', (e) => {
  if (e.target.id === 'ie-modal') closeImageEditor();
});

document.getElementById('ie-file').addEventListener('change', (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f) return;
  loadIeImage(f);
});

function loadIeImage(file) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    ieState.img = img;
    // Default crop = entire image. Output size = crop size, clamped
    // to the display max.
    ieState.crop = { x: 0, y: 0, w: img.width, h: img.height };
    const fit = fitToDisplay(img.width, img.height);
    ieState.outW = fit.w;
    ieState.outH = fit.h;

    // Default filename = source name with .png extension.
    // Build a safe filename from the source. Keep the workflow
    // intuitive for German users -- "König.png" should become
    // "koenig.png", not "k_nig.png". The MicroPython filesystem can
    // technically take unicode but a clean ASCII name is friendlier
    // and avoids surprises with tools like Thonny.
    const stem = file.name
      .replace(/\.[^.]+$/, '')      // strip extension
      .replace(/ä/g,'ae').replace(/ö/g,'oe').replace(/ü/g,'ue')
      .replace(/Ä/g,'Ae').replace(/Ö/g,'Oe').replace(/Ü/g,'Ue')
      .replace(/ß/g,'ss')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')  // anything else → underscore
      .replace(/^_+|_+$/g, '');           // trim leading/trailing
    document.getElementById('ie-name').value = (stem || 'bild') + '.png';

    document.getElementById('ie-out-w').value = ieState.outW;
    document.getElementById('ie-out-h').value = ieState.outH;
    document.getElementById('ie-scale').value = 100;
    document.getElementById('ie-scale-val').textContent = '100 %';
    document.getElementById('ie-empty').style.display = 'none';
    document.getElementById('ie-edit').style.display = '';
    requestAnimationFrame(drawIeCanvas);
    URL.revokeObjectURL(url);
  };
  img.onerror = () => {
    toast(t('Bild konnte nicht geladen werden'), 'bad');
    URL.revokeObjectURL(url);
  };
  img.src = url;
}

// Scale a (w, h) pair so it fits within IE_DISPLAY_MAX_W x
// IE_DISPLAY_MAX_H without exceeding either dimension. Returns
// integer dimensions and preserves aspect ratio.
function fitToDisplay(w, h) {
  const s = Math.min(IE_DISPLAY_MAX_W / w, IE_DISPLAY_MAX_H / h, 1);
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

function drawIeCanvas() {
  if (!ieState.img) return;
  const canvas = document.getElementById('ie-canvas');
  const ctx = canvas.getContext('2d');

  // Cap displayed image to ~520x480 so the modal stays a sane size.
  const maxW = 520, maxH = 480;
  const s = Math.min(maxW / ieState.img.width,
                     maxH / ieState.img.height, 1);
  ieState.displayScale = s;
  const dW = Math.round(ieState.img.width  * s);
  const dH = Math.round(ieState.img.height * s);
  canvas.width = dW;
  canvas.height = dH;

  // Source image
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(ieState.img, 0, 0, dW, dH);

  // Crop overlay -- darken outside the crop box
  const c = ieState.crop;
  const cx = c.x * s, cy = c.y * s;
  const cw = c.w * s, ch = c.h * s;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, dW, cy);
  ctx.fillRect(0, cy, cx, ch);
  ctx.fillRect(cx + cw, cy, dW - (cx + cw), ch);
  ctx.fillRect(0, cy + ch, dW, dH - (cy + ch));

  // Crop border + handles
  ctx.strokeStyle = '#4f9eff';
  ctx.lineWidth = 2;
  ctx.strokeRect(cx, cy, cw, ch);
  ctx.fillStyle = '#4f9eff';
  const hs = 9;
  [[cx, cy], [cx+cw, cy], [cx, cy+ch], [cx+cw, cy+ch]].forEach(([x,y]) => {
    ctx.fillRect(x - hs/2, y - hs/2, hs, hs);
  });

  // Crop info readout
  document.getElementById('ie-crop-info').textContent =
    `${Math.round(c.w)} × ${Math.round(c.h)} px @ (${Math.round(c.x)}, ${Math.round(c.y)})`;

  // Render the preview at output size (pixelated rendering so the user
  // can see exactly what the device will display).
  drawIePreview();
}

function drawIePreview() {
  if (!ieState.img) return;
  const pv = document.getElementById('ie-preview');
  const pctx = pv.getContext('2d');
  const ow = Math.max(1, ieState.outW | 0);
  const oh = Math.max(1, ieState.outH | 0);
  pv.width = ow;
  pv.height = oh;

  // Render the actual output pixels into the canvas. PNG alpha
  // passes through verbatim -- the firmware's pbc.load_image
  // honours it natively, so what you see here is what shows up on
  // the device (the dark "display" background shines through where
  // pixels are transparent).
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = 'high';
  pctx.drawImage(ieState.img,
    ieState.crop.x, ieState.crop.y, ieState.crop.w, ieState.crop.h,
    0, 0, ow, oh);

  // Position + scale the canvas inside the "display frame" so the
  // user sees the image at the correct PROPORTION of the 240x280
  // screen. We centre it within the frame so a small sprite shows
  // floating in the middle of the "screen" -- more visually intuitive
  // than top-left when previewing tiny sprites.
  const frame = document.getElementById('ie-display-frame');
  const frameW = frame.clientWidth;
  const frameH = frame.clientHeight;
  const pxPerUnitW = frameW / IE_DISPLAY_MAX_W;
  const pxPerUnitH = frameH / IE_DISPLAY_MAX_H;
  const u = Math.min(pxPerUnitW, pxPerUnitH);
  const dispW = ow * u;
  const dispH = oh * u;
  pv.style.left   = ((frameW - dispW) / 2) + 'px';
  pv.style.top    = ((frameH - dispH) / 2) + 'px';
  pv.style.width  = dispW + 'px';
  pv.style.height = dispH + 'px';

  // Caption: actual pixel size + percentage of the display covered.
  const area = (ow * oh) / (IE_DISPLAY_MAX_W * IE_DISPLAY_MAX_H) * 100;
  document.getElementById('ie-preview-info').textContent =
    `${ow} × ${oh} px · ${area.toFixed(1)} % vom Display`;
}

// Detect which handle (or 'move', or null) is at the given canvas
// position. We're generous on hit radius so it's findable with a
// trackpad too.
function hitTestIeHandle(px, py) {
  const c = ieState.crop, s = ieState.displayScale;
  const cx = c.x * s, cy = c.y * s, cw = c.w * s, ch = c.h * s;
  const r = 10;
  if (Math.abs(px - cx)      < r && Math.abs(py - cy)      < r) return 'nw';
  if (Math.abs(px - (cx+cw)) < r && Math.abs(py - cy)      < r) return 'ne';
  if (Math.abs(px - cx)      < r && Math.abs(py - (cy+ch)) < r) return 'sw';
  if (Math.abs(px - (cx+cw)) < r && Math.abs(py - (cy+ch)) < r) return 'se';
  if (px >= cx && px <= cx + cw && py >= cy && py <= cy + ch) return 'move';
  return null;
}

document.getElementById('ie-canvas').addEventListener('mousedown', (e) => {
  if (!ieState.img) return;
  const rect = e.target.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;
  const mode = hitTestIeHandle(px, py);
  if (!mode) return;
  ieState.dragging = mode;
  ieState.dragStart = {
    mx: px, my: py,
    crop: { ...ieState.crop },
  };
  e.preventDefault();
});

document.getElementById('ie-canvas').addEventListener('mousemove', (e) => {
  const canvas = e.target;
  if (!ieState.img) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left, py = e.clientY - rect.top;

  if (!ieState.dragging) {
    // Hover cursor
    const mode = hitTestIeHandle(px, py);
    canvas.style.cursor =
      mode === 'move' ? 'move' :
      mode === 'nw' || mode === 'se' ? 'nwse-resize' :
      mode === 'ne' || mode === 'sw' ? 'nesw-resize' :
      'crosshair';
    return;
  }

  const s = ieState.displayScale;
  const dx = (px - ieState.dragStart.mx) / s;
  const dy = (py - ieState.dragStart.my) / s;
  const start = ieState.dragStart.crop;
  const img = ieState.img;
  let c = { ...start };
  const MIN = 4;   // minimum crop size in image pixels

  switch (ieState.dragging) {
    case 'move':
      c.x = clamp(start.x + dx, 0, img.width  - c.w);
      c.y = clamp(start.y + dy, 0, img.height - c.h);
      break;
    case 'nw': {
      const nx = clamp(start.x + dx, 0, start.x + start.w - MIN);
      const ny = clamp(start.y + dy, 0, start.y + start.h - MIN);
      c.x = nx; c.y = ny;
      c.w = start.w - (nx - start.x);
      c.h = start.h - (ny - start.y);
      break;
    }
    case 'ne': {
      const ny = clamp(start.y + dy, 0, start.y + start.h - MIN);
      c.y = ny;
      c.h = start.h - (ny - start.y);
      c.w = clamp(start.w + dx, MIN, img.width - start.x);
      break;
    }
    case 'sw': {
      const nx = clamp(start.x + dx, 0, start.x + start.w - MIN);
      c.x = nx;
      c.w = start.w - (nx - start.x);
      c.h = clamp(start.h + dy, MIN, img.height - start.y);
      break;
    }
    case 'se':
      c.w = clamp(start.w + dx, MIN, img.width  - start.x);
      c.h = clamp(start.h + dy, MIN, img.height - start.y);
      break;
  }
  ieState.crop = c;

  // Auto-adjust output size if "keep aspect" is on and the crop's
  // proportions have changed. Otherwise leave the user-entered numbers
  // alone and just keep them clamped to the display max.
  syncOutSizeFromCrop();
  drawIeCanvas();
});

document.addEventListener('mouseup', () => { ieState.dragging = null; });

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function syncOutSizeFromCrop() {
  // When the crop changes (via dragging on the canvas), the natural
  // output is "crop, fitted to display". Reset the slider to 100 %
  // because anything else doesn't make sense without a fresh base.
  const slider = document.getElementById('ie-scale');
  if (slider) slider.value = 100;
  const valLabel = document.getElementById('ie-scale-val');
  if (valLabel) valLabel.textContent = '100 %';

  const lock = document.getElementById('ie-lock-ratio').checked;
  const c = ieState.crop;
  if (lock) {
    const fit = fitToDisplay(c.w, c.h);
    ieState.outW = fit.w;
    ieState.outH = fit.h;
  } else {
    ieState.outW = clamp(ieState.outW || c.w, 1, IE_DISPLAY_MAX_W);
    ieState.outH = clamp(ieState.outH || c.h, 1, IE_DISPLAY_MAX_H);
  }
  document.getElementById('ie-out-w').value = ieState.outW;
  document.getElementById('ie-out-h').value = ieState.outH;
}

// Apply the scale slider: scales the "natural" output size (= crop
// fitted to display) down by the percentage. So slider=100 keeps
// the full size; slider=10 of a 100x100 crop gives 10x10. Always
// preserves aspect ratio, regardless of the lock-ratio checkbox --
// the slider is the primary "shrink everything" control.
function applyScaleSlider() {
  if (!ieState.img) return;
  const pct = parseInt(document.getElementById('ie-scale').value, 10) || 100;
  document.getElementById('ie-scale-val').textContent = pct + ' %';
  const base = fitToDisplay(ieState.crop.w, ieState.crop.h);
  ieState.outW = Math.max(1, Math.round(base.w * pct / 100));
  ieState.outH = Math.max(1, Math.round(base.h * pct / 100));
  document.getElementById('ie-out-w').value = ieState.outW;
  document.getElementById('ie-out-h').value = ieState.outH;
  drawIePreview();
}

document.getElementById('ie-scale').addEventListener('input', applyScaleSlider);

document.getElementById('ie-out-w').addEventListener('input', (e) => {
  const v = clamp(parseInt(e.target.value, 10) || 1, 1, IE_DISPLAY_MAX_W);
  if (document.getElementById('ie-lock-ratio').checked) {
    const ratio = ieState.crop.h / ieState.crop.w;
    ieState.outW = v;
    ieState.outH = clamp(Math.round(v * ratio), 1, IE_DISPLAY_MAX_H);
    document.getElementById('ie-out-h').value = ieState.outH;
  } else {
    ieState.outW = v;
  }
  drawIePreview();
});
document.getElementById('ie-out-h').addEventListener('input', (e) => {
  const v = clamp(parseInt(e.target.value, 10) || 1, 1, IE_DISPLAY_MAX_H);
  if (document.getElementById('ie-lock-ratio').checked) {
    const ratio = ieState.crop.w / ieState.crop.h;
    ieState.outH = v;
    ieState.outW = clamp(Math.round(v * ratio), 1, IE_DISPLAY_MAX_W);
    document.getElementById('ie-out-w').value = ieState.outW;
  } else {
    ieState.outH = v;
  }
  drawIePreview();
});
document.getElementById('ie-lock-ratio').addEventListener('change',
  () => { syncOutSizeFromCrop(); drawIePreview(); });

document.getElementById('ie-save').addEventListener('click', async () => {
  if (!ieState.img) return;
  if (!serialPort) { toast(t('Erst verbinden.'), 'warn'); return; }
  let name = document.getElementById('ie-name').value.trim() || 'bild.png';
  if (!/\.png$/i.test(name)) name += '.png';

  // Render the cropped & scaled result to an off-screen canvas.
  const out = document.createElement('canvas');
  out.width  = Math.max(1, ieState.outW | 0);
  out.height = Math.max(1, ieState.outH | 0);
  const octx = out.getContext('2d');
  octx.imageSmoothingEnabled = true;
  octx.imageSmoothingQuality = 'high';
  octx.drawImage(ieState.img,
    ieState.crop.x, ieState.crop.y, ieState.crop.w, ieState.crop.h,
    0, 0, out.width, out.height);

  // PNG is saved with its native alpha channel intact. The firmware's
  // png.py reads alpha < 128 as transparent automatically; nothing
  // special needs to happen here.
  const blob = await new Promise(res => out.toBlob(res, 'image/png'));
  if (!blob) { toast(t('PNG-Erzeugung fehlgeschlagen'), 'bad'); return; }

  closeImageEditor();
  const ok = await uploadBlob(blob, name);
  if (ok) {
    cancelBlocklyGesture(); document.getElementById('img-modal').classList.add('show');
    refreshImages();
  }
});

// Image filenames known to the IDE (synced from the device on
// connect/refresh, and updated locally on upload/delete). Used by
// the dropdown in pbc_load_image / pbc_show_image blocks.
let KNOWN_IMAGES = [];

function imageOptions() {
  // `this` is the FieldDropdown instance Blockly calls us on. We use
  // its current value to make sure the dropdown ALWAYS contains the
  // currently-selected image, even if the image isn't (yet) in
  // KNOWN_IMAGES. That happens routinely after Load: the project's
  // .pbcp file remembers "held.png", but KNOWN_IMAGES is still empty
  // until the user connects the PBC+ and we read the file system.
  // Without this safeguard, Blockly's setValue() would silently
  // reset the field to the dropdown's first option (or empty), and
  // the student would see the block's image-name come back blank.
  const current = (this && typeof this.getValue === 'function')
    ? this.getValue()
    : '';
  const opts = KNOWN_IMAGES.map(n => [n, n]);
  if (current && KNOWN_IMAGES.indexOf(current) < 0) {
    // Stick the saved name at the top with a "(?)" hint so it's
    // obvious the file isn't actually on the device right now.
    opts.unshift([current + ' (?)', current]);
  }
  if (opts.length === 0) return [[t('(keine Bilder)'), '']];
  return opts;
}

// Force every existing image block to re-read its dropdown options.
// Blockly caches the menu generator's last result on the field, so we
// recreate the field by calling setValidator (a no-op that triggers
// a recompute) plus a manual repaint.
function refreshImageBlocks() {
  if (!workspace) return;
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'pbc_load_image' &&
        b.type !== 'pbc_show_image' &&
        b.type !== 'canvas_load_image') return;
    const field = b.getField('NAME');
    if (!field || !field.menuGenerator_) return;
    const current = field.getValue();
    // We do NOT reset values that aren't (yet) in KNOWN_IMAGES. The
    // imageOptions() generator above will keep showing them with a
    // "(?)" marker; that way a project loaded from disk before the
    // device is connected still remembers which image each block
    // points at. Once the device is connected and we know the real
    // file list, the marker disappears on its own.
    field.forceRerender();
    // If the saved value matches a file that IS on the device now,
    // pick the canonical option-value (handles case where the saved
    // name has trailing whitespace or similar minor mismatches).
    if (current && KNOWN_IMAGES.includes(current)) {
      // already matches; nothing to do.
    }
  });
}

// Background image-list sync used right after the device connects.
// Unlike refreshImages() it doesn't touch the modal or show toasts;
// it just updates KNOWN_IMAGES and the in-workspace block dropdowns
// so existing files become selectable straight away.
async function syncImagesQuietly() {
  if (!serialPort) return;
  const code = `
import os
for n in sorted(os.listdir('/')):
    if n.lower().endswith('.png'):
        print(n)
`;
  try {
    const r = await runOnDevice(code, 4000);
    if (!r || r.stderr) return;
    // Split on either \n or \r\n -- MicroPython writes CRLF to the
    // serial console, so a plain split('\n') would leave a \r at the
    // end of every filename. That \r then ends up inside the
    // generated code as a literal carriage return, breaking string
    // literals that contain a filename.
    KNOWN_IMAGES = r.stdout.split(/\r?\n/)
                            .map(s => s.trim())
                            .filter(Boolean);
    refreshImageBlocks();
  } catch (e) {
    // Ignore -- the user will hit Refresh in the Images dialog if
    // they need the list and the silent sync didn't work for any
    // reason.
  }
}

async function refreshImages() {
  const list = document.getElementById('img-list');
  if (!serialPort) {
    const msg = (runTarget === 'emulator')
      ? t('Emulator wird gestartet…')
      : t('Zuerst mit dem Gerät verbinden.');
    list.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">' + msg + '</div>';
    return;
  }
  list.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">Lade…</div>';
  // Emulator path: list from IndexedDB. The serial-Python path below
  // would just return an empty result because uploadBlob() writes to
  // IndexedDB (not to MicroPython's filesystem) when running in the
  // emulator.
  let files;
  if (deviceMode === 'emulator' && window.__emuImgList) {
    const entries = await window.__emuImgList();
    files = entries
      .filter(e => e.name.toLowerCase().endsWith('.png'))
      .map(e => ({ name: e.name, size: e.blob ? e.blob.size : -1 }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const code = `
import os
for n in sorted(os.listdir('/')):
    if n.lower().endswith('.png'):
        try: sz = os.stat('/' + n)[6]
        except: sz = -1
        print(n, sz)
`;
    const r = await runOnDevice(code, 5000);
    if (!r || r.stderr) {
      list.innerHTML = '<div style="color:var(--bad);">Auflisten fehlgeschlagen. ' + (r?.stderr||'') + '</div>';
      return;
    }
    files = r.stdout.split(/\r?\n/)
                    .map(s => s.trim())
                    .filter(Boolean)
                    .map(l => {
      const parts = l.split(/\s+/);
      const sz = parseInt(parts.pop(), 10);
      return { name: parts.join(' '), size: sz };
    });
  }

  // Sync the global list so the dropdown in image blocks knows
  // which filenames are valid.
  KNOWN_IMAGES = files.map(f => f.name);
  refreshImageBlocks();

  if (!files.length) {
    list.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">Keine PNG-Dateien auf dem Gerät.</div>';
    return;
  }
  list.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('div');
    row.className = 'img-row';
    // Layout: PNG-badge, name, size, [↓], [×]. The icon buttons
    // mirror the manage-files dialog for consistency.
    row.innerHTML = `
      <div style="width:40px;height:40px;background:var(--bg-3);border-radius:4px;
           display:flex;align-items:center;justify-content:center;color:var(--fg-2);">PNG</div>
      <div class="name">${f.name}</div>
      <div class="size">${(f.size/1024).toFixed(1)} KB</div>
      <button class="tb-btn" data-dl="${f.name}"
              title="${t('Herunterladen')}"
              style="width:32px;padding:6px 0;font-size:16px;line-height:1;
                     color:var(--fg-1);">⭳</button>
      <button class="tb-btn" data-del="${f.name}"
              title="${t('Datei löschen')}"
              style="width:32px;padding:6px 0;font-size:18px;line-height:1;
                     color:var(--bad);font-weight:bold;">×</button>
    `;
    row.querySelector('[data-dl]').addEventListener('click', async () => {
      await downloadFile(f.name);
    });
    row.querySelector('[data-del]').addEventListener('click', async () => {
      if (!confirm(f.name + ' wirklich löschen?')) return;
      if (deviceMode === 'emulator' && window.__emuImgDelete) {
        await window.__emuImgDelete(f.name);
        toast(f.name + ' gelöscht', 'good');
      } else {
        const r = await runOnDevice(
          `import os\nos.remove(${pyStringLit(f.name)})\nprint('geloescht')\n`);
        if (r && !r.stderr) toast(f.name + ' gelöscht', 'good');
      }
      refreshImages();
    });
    list.appendChild(row);
  });
}

