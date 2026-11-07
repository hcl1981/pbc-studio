/* =====================================================================
 * Code pane
 * ===================================================================== */

document.getElementById('codetab').addEventListener('click', () => {
  document.getElementById('codepane').classList.toggle('open');
});

/* =====================================================================
 * Files dropdown
 * ===================================================================== */

(function setupFilesDropdown() {
  const dd     = document.getElementById('dd-files');
  const toggle = document.getElementById('dd-files-btn');
  const menu   = document.getElementById('dd-files-menu');

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    // Reflect the active target in the "Daten auf dem ..." section so
    // it's clear whether you're managing the device's or the
    // emulator's files/images.
    const sec = document.getElementById('dd-data-section');
    if (sec && typeof targetLabel === 'function') {
      sec.textContent = t('Daten auf dem') + ' ' + targetLabel();
    }
    dd.classList.toggle('open');
  });

  // Click elsewhere -> close. Escape too, as a courtesy.
  document.addEventListener('click', () => dd.classList.remove('open'));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') dd.classList.remove('open');
  });

  // Map dropdown actions to the existing (hidden) buttons. Keeping
  // the old buttons around as hidden nodes means we don't have to
  // re-wire every existing handler -- the dropdown is purely a UI
  // skin on top of the same actions.
  const actions = {
    'new':         'btn-new',
    // Open is now split into two direct actions, mirroring Save.
    // Both bypass the legacy combined Open dialog -- we kick the
    // local-file path (file input) or the device-list path directly.
    'open-local':  () => openFromLocal(),
    'open-device': () => openFromDevice(),
    'save-local':  'btn-save',
    'save-device': 'btn-upload',
    'images':      'btn-images',
    'paint-new':   async () => {
      if (!(await ensureTargetReady())) return;
      if (window.__openPaintEditor) window.__openPaintEditor();
    },
    'manage-files': () => showManageFilesDialog(),
    'transfer-to-emu': () => showTransferDialog('to-emu'),
    'transfer-to-dev': () => showTransferDialog('to-dev'),
    'install-launcher': () => installLauncher(),
    'install-micropython': () => showInstallMicroPythonDialog(),
    'backup-flash': () => runFlashBackupUI(),
  };
  menu.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const target = actions[btn.dataset.action];
    dd.classList.remove('open');
    if (typeof target === 'function') target();
    else if (target) document.getElementById(target).click();
  });
})();

/* =====================================================================
 * Save / load
 * ===================================================================== */

// Name of the program file (without extension): suggested when saving,
// taken over when a file is opened, shown in the browser tab.
const DATEINAME_KEY = 'pbc.dateiname';
let aktuellerDateiname = '';
try { aktuellerDateiname = localStorage.getItem(DATEINAME_KEY) || ''; } catch (e) {}
function setzeDateiname(name) {
  aktuellerDateiname = (name || '').replace(/\.(py|pbcp|json)$/i, '');
  try { localStorage.setItem(DATEINAME_KEY, aktuellerDateiname); } catch (e) {}
  document.title = (aktuellerDateiname ? aktuellerDateiname + ' – ' : '') + 'PBC+ Studio';
}
setzeDateiname(aktuellerDateiname);

document.getElementById('btn-new').addEventListener('click', () => {
  if (!confirm(t('Aktuelles Programm verwerfen und neu beginnen?'))) return;
  setzeDateiname('');
  if (isTextMode) {
    if (codeEditor) codeEditor.setValue('');
  } else {
    workspace.clear();
    // Restart with the same friendly demo the very first session
    // shows -- "Beim Start" + "Bildschirm löschen" + "Hallo PBC+!".
    // loadDemoProgram() also calls ensureStartBlock() internally.
    loadDemoProgram();
  }
  PBC_SPRITES = [];
  refreshSpritesCategory();
  updateCodeView();
});

// The current block program as the text of a .pbcp file. "py" is the
// complete program with its import lines: the start menu on the
// PicoBoy runs it straight from the file.
function projektText() {
  return JSON.stringify({
    kind: 'pbc-blocks',
    json: Blockly.serialization.workspaces.save(workspace),
    py: fullProgram(),
    stringVars: Array.from(STRING_VAR_NAMES),
    canvasVars: Array.from(CANVAS_VAR_NAMES),
    sprites: PBC_SPRITES,
  }, null, 2);
}

document.getElementById('btn-save').addEventListener('click', async () => {
  const ext = isTextMode ? '.py' : '.pbcp';
  const gewaehlt = await askString(t('Dateiname?'), aktuellerDateiname || 'programm', (n) => {
    const c = (n || '').trim().replace(/\.(py|pbcp|json)$/i, '');
    if (!c) return t('Ungültiger Name.');
    if (/[\\/:*?"<>|]/.test(c)) return t('Ungültiger Name.');
    return null;
  });
  if (!gewaehlt) return;
  setzeDateiname(gewaehlt.trim());
  let text, name, mime;
  if (isTextMode) {
    text = codeEditor ? codeEditor.getValue() : '';
    name = aktuellerDateiname + ext; mime = 'text/x-python';
  } else {
    text = projektText();
    name = aktuellerDateiname + ext; mime = 'application/json';
  }
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast(t('Gespeichert als') + ' ' + name, 'good');
});

document.getElementById('btn-open').addEventListener('click', () => {
  // Pre-fill state every time: hide the device pane and forget any
  // previous listing so users don't see stale data.
  document.getElementById('open-device-pane').style.display = 'none';
  cancelBlocklyGesture(); document.getElementById('open-modal').classList.add('show');
});

// Local-file path: just trigger the hidden <input type="file">.
document.getElementById('open-local-btn').addEventListener('click', () => {
  document.getElementById('open-modal').classList.remove('show');
  document.getElementById('file-open').click();
});

// Device path: query the PBC+ for .py files in the filesystem root,
// then render a clickable list. Selecting one downloads the file
// content into the text editor.
document.getElementById('open-device-btn').addEventListener('click',
  async () => {
    if (!serialPort) {
      toast(t('Erst verbinden.'), 'warn');
      return;
    }
    const pane = document.getElementById('open-device-pane');
    const list = document.getElementById('open-device-list');
    pane.style.display = '';
    list.innerHTML = '<div style="color:var(--fg-2);text-align:center;' +
                     'padding:24px;">Lade…</div>';

    const code = `
import os
for n in sorted(os.listdir('/')):
    if n.lower().endswith('.py'):
        try: sz = os.stat('/' + n)[6]
        except: sz = -1
        print(n, sz)
`;
    const r = await runOnDevice(code, 5000);
    if (!r || r.stderr) {
      list.innerHTML = '<div style="color:var(--bad);padding:16px;">' +
        'Auflisten fehlgeschlagen.' +
        (r?.stderr ? '<br><small>' + r.stderr + '</small>' : '') +
        '</div>';
      return;
    }
    const files = r.stdout.split(/\r?\n/)
                           .map(s => s.trim())
                           .filter(Boolean)
                           .map(l => {
      const parts = l.split(/\s+/);
      const sz = parseInt(parts.pop(), 10);
      return { name: parts.join(' '), size: sz };
    });

    if (files.length === 0) {
      list.innerHTML = '<div style="color:var(--fg-2);padding:16px;">' +
        'Keine <code>.py</code>-Dateien auf dem Gerät.</div>';
      return;
    }

    list.innerHTML = '';
    files.forEach(f => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;padding:8px 10px;' +
        'border-radius:4px;gap:10px;' +
        'border:1px solid transparent;';
      row.onmouseover = () => row.style.background = 'var(--bg-2)';
      row.onmouseout  = () => row.style.background = '';

      // Filename + size: click area that loads the file. Has its own
      // click handler so the delete-X to the right of it stays
      // independent (no event-bubbling surprises).
      const main = document.createElement('span');
      main.style.cssText =
        'flex:1;display:flex;align-items:center;gap:10px;' +
        'cursor:pointer;min-width:0;';
      main.innerHTML =
        `<span style="flex:1;color:var(--fg-0);font-family:` +
          `ui-monospace,monospace;overflow:hidden;` +
          `text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>` +
        `<span style="color:var(--fg-2);font-size:11px;` +
          `font-family:ui-monospace,monospace;">${f.size} B</span>`;
      main.addEventListener('click', () => loadFromDevice(f.name));
      row.appendChild(main);

      // Delete button: small × in the danger color. Confirms before
      // deleting so a misclick can't wipe an hour of work.
      const del = document.createElement('button');
      del.textContent = '×';
      del.title = t('Datei löschen');
      del.style.cssText =
        'background:transparent;color:var(--danger);' +
        'border:1px solid transparent;border-radius:4px;' +
        'width:26px;height:26px;font-size:18px;line-height:1;' +
        'cursor:pointer;flex-shrink:0;';
      del.onmouseover = () => {
        del.style.background = 'color-mix(in srgb, var(--danger) 18%, var(--bg-2))';
        del.style.borderColor = 'var(--danger)';
      };
      del.onmouseout = () => {
        del.style.background = 'transparent';
        del.style.borderColor = 'transparent';
      };
      del.addEventListener('click', async (e) => {
        e.stopPropagation();
        await deleteFromDevice(f.name);
      });
      row.appendChild(del);

      list.appendChild(row);
    });
  });

async function deleteFromDevice(name) {
  if (!serialPort) { toast(t('Nicht verbunden'), 'bad'); return; }
  if (!confirm(t('Datei „%1“ wirklich vom PBC+ löschen?').replace('%1', name) + '\n\n' +
               t('Das kann nicht rückgängig gemacht werden.'))) {
    return;
  }
  const code = `
import os
try:
    os.remove(${pyStringLit(name)})
    print('OK')
except Exception as e:
    print('ERR', repr(e))
`;
  const r = await runOnDevice(code, 4000);
  if (!r) return;
  if (r.stdout.trim().startsWith('OK')) {
    toast(name + ' ' + t('gelöscht'), 'good');
    // Refresh the list in place by re-running the device-list query.
    document.getElementById('open-device-btn').click();
  } else {
    const msg = r.stderr || r.stdout.trim();
    toast(t('Löschen fehlgeschlagen'), 'bad');
    term.write('\r\n\x1b[31m' + msg.replace(/\n/g,'\r\n') + '\x1b[0m\r\n');
  }
}

// Read a file off the target and put it on the workspace: a block
// project on the block surface, Python in the text editor. Read in
// chunks: a .pbcp with sprites easily reaches 50 KB and more.
async function loadFromDevice(name) {
  if (!(await ensureTargetReady())) return;

  // Loading replaces the current program -- warn first, same as the
  // "Neu" button and the local-file open path. Keeps the behaviour
  // consistent: any action that wipes the workspace asks first.
  if (!confirm(t('Aktuelles Programm verwerfen und die Datei laden?'))) {
    return;
  }
  document.getElementById('open-modal').classList.remove('show');
  const blob = runTarget === 'emulator'
    ? await window.__emuImgGet(name)
    : await readDeviceFileBlob(name);
  if (!blob) { toast(t('Laden fehlgeschlagen'), 'bad'); return; }
  // We assume UTF-8 -- if a file is in some exotic encoding the
  // TextDecoder replaces invalid sequences with U+FFFD, it doesn't throw.
  dateitextLaden(name, new TextDecoder('utf-8').decode(await blob.arrayBuffer()));
}

document.getElementById('open-cancel').addEventListener('click', () => {
  document.getElementById('open-modal').classList.remove('show');
});
document.getElementById('open-modal').addEventListener('click', (e) => {
  if (e.target.id === 'open-modal')
    document.getElementById('open-modal').classList.remove('show');
});

document.getElementById('file-open').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  // Loading replaces whatever's currently in the editor / workspace,
  // so warn first -- same courtesy as the "Neu" button. We reset the
  // input value on cancel so picking the same file again still fires
  // a change event.
  if (!confirm(t('Aktuelles Programm verwerfen und die Datei laden?'))) {
    e.target.value = '';
    return;
  }
  const text = await file.text();
  e.target.value = '';
  dateitextLaden(file.name, text);
});

// Put a file's text on the workspace: .pbcp/.json as a block project,
// everything else as Python in the text editor. Shared by "Vom
// Computer…" and "Vom PBC+…".
function dateitextLaden(name, text) {
  setzeDateiname(name);
  if (name.endsWith('.pbcp') || name.endsWith('.json')) {
    try {
      const obj = JSON.parse(text);
      if (obj.json) {
        if (isTextMode) setMode(false);
        // IMPORTANT: populate PBC_SPRITES / STRING_VAR_NAMES /
        // CANVAS_VAR_NAMES BEFORE loadWorkspaceJson. The sprite-
        // operation blocks build their name dropdowns from
        // spriteNameOptions(), which reads PBC_SPRITES. If we load the
        // workspace first (while PBC_SPRITES is still empty), every
        // sprite dropdown finds its saved value (e.g. "muenze") absent
        // from the option list and silently falls back to the first
        // option -- so a two-sprite program collapses to "held berührt
        // held". Setting the sprite list first makes the options exist
        // at load time, and the saved values stick.
        STRING_VAR_NAMES = new Set(Array.isArray(obj.stringVars)
                                    ? obj.stringVars : []);
        CANVAS_VAR_NAMES = new Set(Array.isArray(obj.canvasVars)
                                    ? obj.canvasVars : []);
        PBC_SPRITES = Array.isArray(obj.sprites)
          ? obj.sprites.filter(s => s && s.name && s.image)
          : [];
        loadWorkspaceJson(obj.json, workspace);
        ensureStartBlock();
        refreshVariablesCategory();
        refreshSpritesCategory();
        refreshMethodsCategory();
        updateCodeView();
        toast(name + ' geladen', 'good');
        return;
      }
    } catch (err) {
      // The JSON parsed but loading the workspace from it failed --
      // probably an unknown block type or a malformed field. Tell the
      // user instead of silently falling through to "treat as Python"
      // (which would dump the JSON source into the text editor and
      // make the file look completely broken).
      console.error('pbcp load failed:', err);
      toast(name + ': ' + (err && err.message ? err.message : err),
            'bad');
      return;
    }
  }
  // Treat as Python -- switch to text mode, drop into the editor,
  // and unlock editing right away.
  if (!isTextMode) setMode(true, { keepEditorContent: true });
  ensureCodeEditor();
  codeEditor.setValue(text);
  codeEditor.setOption('readOnly', false);
  const banner = document.getElementById('text-banner');
  if (banner) banner.style.display = 'none';
  textBaseline = text;
  toast(name + ' als Python geladen', 'good');
}

// "Vom Computer…" menu entry: bypass the legacy open-modal entirely
// and trigger the hidden file input directly. Mirrors how Save lets
// the user pick local vs. device with a one-click menu choice.
function openFromLocal() {
  document.getElementById('file-open').click();
}

// "Vom PBC+…" menu entry: open a dedicated dialog listing the programs
// on the target. Clicking a row loads it: .py into the text editor
// with editing already unlocked, .pbcp as blocks.
async function openFromDevice() {
  if (!(await ensureTargetReady())) return;
  cancelBlocklyGesture();   // close any open field editor first

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
    'display:flex; align-items:center; justify-content:center;' +
    'z-index:100000;';
  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:var(--bg-1, #1f2630); color:var(--fg-0, #fff);' +
    'padding:22px 24px; border-radius:8px;' +
    'width:min(520px, 92vw); max-height:88vh;' +
    'display:flex; flex-direction:column;' +
    'box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
    'border:1px solid var(--border, #2d3744);';

  const h = document.createElement('div');
  h.textContent = t('Datei vom PBC+ öffnen');
  h.style.cssText = 'font-weight:600; font-size:16px; margin-bottom:14px;';
  dialog.appendChild(h);

  const listBox = document.createElement('div');
  listBox.style.cssText =
    'flex:1; min-height:200px; max-height:55vh; overflow:auto;' +
    'border:1px solid var(--border); border-radius:6px; padding:4px;';
  listBox.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">' +
                     t('Lade…') + '</div>';
  dialog.appendChild(listBox);

  const buttons = document.createElement('div');
  buttons.style.cssText =
    'display:flex; gap:8px; justify-content:flex-end; margin-top:14px;';
  function finish() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = t('Abbrechen');
  cancelBtn.className = 'tb-btn';
  cancelBtn.addEventListener('click', finish);
  buttons.appendChild(cancelBtn);
  dialog.appendChild(buttons);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // List programs (Python and block projects) on the target's root.
  const alle = runTarget === 'emulator' ? await listEmuFilesRaw() : await listDeviceFilesRaw();
  if (!alle) {
    listBox.innerHTML = '<div style="color:var(--bad);padding:16px;">' +
      t('Auflisten fehlgeschlagen.') + '</div>';
    return;
  }
  const files = alle.filter(f => /\.(py|pbcp)$/i.test(f.name));
  if (files.length === 0) {
    listBox.innerHTML = '<div style="color:var(--fg-2);padding:16px;">' +
      t('Keine Programme auf dem Gerät.') + '</div>';
    return;
  }
  listBox.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;padding:8px 10px;' +
      'border-radius:4px;gap:10px;cursor:pointer;' +
      'border:1px solid transparent;';
    row.onmouseover = () => row.style.background = 'var(--bg-2)';
    row.onmouseout  = () => row.style.background = '';
    row.innerHTML =
      '<span style="flex:1;color:var(--fg-0);font-family:ui-monospace,monospace;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;">' +
        f.name + '</span>' +
      '<span style="color:var(--fg-2);font-size:11px;font-family:ui-monospace,monospace;">' +
        f.size + ' B</span>';
    row.addEventListener('click', async () => {
      finish();
      await loadFromDevice(f.name);
    });
    listBox.appendChild(row);
  });
}

document.getElementById('btn-mode').addEventListener('click',
  () => setMode(!isTextMode));

/* =====================================================================
 * Toast
 * ===================================================================== */

let toastTimer = null;
function toast(msg, kind) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

