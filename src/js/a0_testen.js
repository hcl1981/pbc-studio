/* =====================================================================
 * Test / Upload
 * ===================================================================== */

// =====================================================================
// Preflight checks before "Testen ▶".
//
// A 6th-grader's program can be technically well-formed (no syntax
// errors, all variables exist) but still fail in ways that look like
// "the device is broken" -- empty loop bodies that finish in 0 ms,
// sprite references to images that aren't on the device, etc. We
// catch the common cases here and block Test ▶ with an actionable
// message before any code reaches the PBC+. The student gets useful
// feedback in the IDE instead of staring at a confusing traceback in
// the terminal.
// =====================================================================

// Lists every sprite-image filename referenced on the workspace.
// Currently we treat PBC_SPRITES as the source of truth -- it's
// updated whenever the user adds or removes a sprite via the sidebar.
function referencedSpriteImages() {
  const seen = new Set();
  for (const sp of PBC_SPRITES) {
    if (sp && sp.image) seen.add(sp.image);
  }
  return [...seen];
}

// Probe the device for which of the given filenames exist. Returns
// an array of missing names. If the device isn't connected or the
// probe fails for any reason, returns null -- the caller treats null
// as "couldn't check, let it proceed" rather than blocking on an
// unrelated error.
async function findMissingSpriteImages(images) {
  if (!images.length) return [];
  if (!serialPort) return null;
  // Emulator mode: the "filesystem" is IndexedDB, populated by
  // uploadBlob() instead of the serial transfer that the device path
  // uses. Asking MicroPython.os.listdir would only see /lib/pbc.py,
  // so we'd falsely flag every image as missing.
  if (deviceMode === 'emulator' && window.__emuImgList) {
    const entries = await window.__emuImgList();
    const present = new Set(entries.map(e => e.name));
    return images.filter(name => !present.has(name));
  }
  // List the root once and intersect locally. Faster (and quieter on
  // the wire) than asking the device for each file individually.
  const probe =
    'import os\n' +
    'print(",".join(os.listdir("/")))\n';
  const r = await runOnDevice(probe, 8000);
  if (!r || r.stderr) return null;
  const present = new Set((r.stdout || '').trim().split(','));
  return images.filter(name => !present.has(name));
}

// Run all preflight checks and, if any complain, show a blocking
// dialog with a clear message. Returns true if it's safe to run the
// code, false if the user should stay in the editor and fix things.
//
// Empty statement-bodies are intentionally NOT flagged here -- the
// generator emits a `pass` statement for any empty body it sees, so
// the program runs cleanly; it just doesn't *do* anything in that
// spot. That's the natural state of a new block the student hasn't
// filled in yet, and warning every time would be more annoying than
// helpful.
async function preflightChecks() {
  // Turtle constructor presence: a turtle command block (forward,
  // left, pen_down, ...) is on the workspace, but no matching
  // "neue Turtle"-block exists for its variable. The IDE auto-
  // inserts the constructor when the first command is dropped, but
  // the student might have deleted it later -- catch that here so
  // the device doesn't crash with NameError when t.forward(...)
  // runs against an undefined t.
  const missingTurtle = findTurtleCommandsWithoutConstructor();
  if (missingTurtle.length > 0) {
    const list = [...new Set(missingTurtle)].join(', ');
    await alertDialog(t('Turtle fehlt'),
      t('Es gibt Turtle-Befehle für:') + ' ' + list + '\n\n' +
      t('Bevor du sie benutzt, musst du sie mit einem "neue Turtle"-Block erstellen.'));
    return false;
  }

  // Unselected image dropdowns. If the student has dropped a
  // "Bild anzeigen" / "Bild auf Canvas" / "Bild laden" block but
  // hasn't picked a file in the dropdown, the generator emits
  // `pbc.load_image('')` which crashes the program. Catch it here
  // with a clear "please pick an image" message before launching.
  const unselectedImageTypes = findBlocksWithEmptyImageField();
  if (unselectedImageTypes.length > 0) {
    await alertDialog(t('Bild nicht ausgewählt'),
      t('In einem oder mehreren Bild-Blöcken ist noch kein Bild ausgewählt.') + '\n\n' +
      t('Klicke auf den Bild-Block und wähle eine Datei aus der Liste. ' +
        'Falls die Liste leer ist, lade zuerst über Dateien → Bilder verwalten ein PNG hoch.'));
    return false;
  }

  // Sprite commands referencing a sprite that no longer exists. The
  // student might have placed a "zeige Sprite [held]"-block, then
  // deleted "held" in the sprite manager. The dropdown then shows
  // "(kein Sprite)" with an empty value; the generator emits
  // `_sprite.show()` which crashes with NameError.
  const orphanSpriteCmds = findSpriteCommandsWithoutSprite();
  if (orphanSpriteCmds.length > 0) {
    await alertDialog(t('Sprite-Befehl ohne Sprite'),
      t('In einem oder mehreren Sprite-Befehlen ist kein Sprite ausgewählt.') + '\n\n' +
      t('Klicke auf den Befehl-Block und wähle aus dem Dropdown ein Sprite aus, ' +
        'oder lösche den Block.'));
    return false;
  }

  // Function-call blocks pointing at a function name that no longer
  // exists. The student dropped a `Funktion aufrufen [foo]` block,
  // then renamed/deleted the foo function definition. The generator
  // would emit `foo()` which crashes with NameError on the device.
  const orphanCalls = findFunctionCallsWithoutDefinition();
  if (orphanCalls.length > 0) {
    const list = [...new Set(orphanCalls)].join(', ');
    await alertDialog(t('Funktionsaufruf ohne Funktion'),
      t('Diese Funktionen werden aufgerufen, aber nicht (mehr) definiert:') +
      '\n\n' + list + '\n\n' +
      t('Lege die Funktion neu an, oder wähle im Aufruf eine andere ' +
        'Funktion aus dem Dropdown.'));
    return false;
  }

  // Forever-loops without any blocking call inside. A pbc_forever
  // body that just churns through a few statements with no sleep
  // hogs the CPU at 100 %, makes the device unresponsive to Stop,
  // and can freeze the USB CDC link entirely on the RP2350. Warn
  // the student before they brick their test session. Non-blocking:
  // some forever loops legitimately do their own pacing via
  // pbc.was_pressed_*() polling, so we don't refuse to run -- just
  // make the trade-off visible.
  const noSleepForever = findForeverWithoutSleep();
  if (noSleepForever > 0) {
    const proceed = await confirmDialog(
      t('Endlosschleife ohne Pause'),
      t('Eine "unendlich wiederholen"-Schleife enthält keinen ' +
        '"warte ... ms"-Block. Das Programm wird das Gerät zu 100% ' +
        'auslasten und reagiert vielleicht nicht mehr auf Stop.') +
      '\n\n' +
      t('Empfohlen: füge in der Schleife einen "warte 20 ms"-Block ' +
        'ein.') +
      '\n\n' +
      t('Trotzdem starten?'));
    if (!proceed) return false;
  }

  // Sprites without a chosen PNG. A sprite that was created in the
  // sprite manager but never had its image picked would also crash
  // on first show(). Check the PBC_SPRITES registry.
  const unselectedSprites = PBC_SPRITES
    .filter(sp => !sp.image || !sp.image.trim())
    .map(sp => sp.name);
  if (unselectedSprites.length > 0) {
    const list = unselectedSprites.slice(0, 6).join(', ');
    await alertDialog(t('Sprite-Bild fehlt'),
      t('Diese Sprites haben kein Bild ausgewählt:') + '\n\n' + list + '\n\n' +
      t('Öffne den Sprite-Editor und wähle für jeden ein PNG aus.'));
    return false;
  }

  // Sprite-image presence on the device. We only run this when
  // actually connected -- without a device there's nothing to check,
  // and we'd rather let the user click Test and see the "please
  // connect" toast than block them with an unrelated dialog about
  // image files.
  const images = referencedSpriteImages();
  if (images.length > 0 && serialPort) {
    const missing = await findMissingSpriteImages(images);
    if (missing && missing.length > 0) {
      const list = missing.slice(0, 6).join(', ');
      await alertDialog(t('Bilder fehlen auf dem PBC+'),
        t('Diese Bild-Dateien sind nicht auf dem Gerät:') + '\n\n' +
        list + '\n\n' +
        t('Lade sie hoch über Dateien → Bilder verwalten.'));
      return false;
    }
  }
  return true;
}

// Walk the workspace and return the types of any image-loading blocks
// whose file-name dropdown is still empty. Used by preflight to refuse
// running a program that would crash on `pbc.load_image('')`.
function findBlocksWithEmptyImageField() {
  if (!workspace) return [];
  const types = ['pbc_show_image', 'pbc_load_image', 'canvas_load_image'];
  const seen = new Set();
  workspace.getAllBlocks(false).forEach(b => {
    if (!b.type || types.indexOf(b.type) < 0) return;
    if (!isBlockActiveOnWorkspace(b)) return;
    const name = b.getFieldValue('NAME');
    if (!name || !String(name).trim()) seen.add(b.type);
  });
  return [...seen];
}

// Walk the workspace for sprite_* command blocks whose SP (or SP2)
// dropdown is empty. That happens when the student deleted the
// referenced sprite in the manager after placing the command --
// the dropdown falls back to "(kein Sprite)" with value "". Letting
// the generator run produces `_sprite.show()` which crashes.
function findSpriteCommandsWithoutSprite() {
  if (!workspace) return [];
  // Known sprite names right now -- a SP value that's not in this
  // set is also an orphan (sprite was renamed/removed).
  const valid = new Set(PBC_SPRITES.map(s => s.name));
  const seen = new Set();
  workspace.getAllBlocks(false).forEach(b => {
    if (!b.type || !b.type.startsWith('pbc_sprite_')) return;
    if (!isBlockActiveOnWorkspace(b)) return;
    ['SP', 'SP2'].forEach(fieldName => {
      const field = b.getField && b.getField(fieldName);
      if (!field) return;
      const v = b.getFieldValue(fieldName);
      if (!v || !valid.has(v)) seen.add(b.type);
    });
  });
  return [...seen];
}

// Walk the workspace for pbc_method_call blocks whose NAME points
// at a function that's no longer defined. Returns the missing names
// so the preflight dialog can list them.
function findFunctionCallsWithoutDefinition() {
  if (!workspace) return [];
  const defined = new Set();
  workspace.getTopBlocks(false).forEach(b => {
    if (b.type === 'pbc_method_def' || b.type === 'pbc_method_def_return') {
      const n = (b.getFieldValue('NAME') || '').trim();
      if (n) defined.add(n);
    }
  });
  const missing = new Set();
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'pbc_method_call') return;
    if (!isBlockActiveOnWorkspace(b)) return;
    const n = (b.getFieldValue('NAME') || '').trim();
    if (!n || !defined.has(n)) missing.add(n || '(leer)');
  });
  return [...missing];
}

// Count the active pbc_forever blocks that have no time-blocking
// statement inside their body. The IDE has three "this yields the
// CPU"-blocks: pbc_delay (warte … ms), pbc_wait_button (warte auf
// Taste), and pbc_wait_specific_button (warte auf bestimmte Taste).
// Anything else in the body is fast enough that an outer forever
// loop will saturate the CPU.
//
// We only count truly-empty cases (zero blocking statements
// anywhere within the body, including inside if/else / inner loops).
// False positives are fine here: the preflight is a "confirm before
// running" dialog, not an outright refusal.
function findForeverWithoutSleep() {
  if (!workspace) return 0;
  const blockingTypes = new Set([
    'pbc_delay',
    'pbc_sleep_s',
    'pbc_wait_button',
    'pbc_wait_specific_button',
  ]);
  let bad = 0;
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'pbc_forever') return;
    if (!isBlockActiveOnWorkspace(b)) return;
    const body = b.getInput && b.getInput('BODY');
    const first = body && body.connection && body.connection.targetBlock();
    if (!first) return;   // empty body -- the program loops doing nothing.
                          // Technically also bad, but trivial to spot in
                          // the editor; let it through.
    let hasSleep = false;
    function visit(cur) {
      while (cur) {
        if (blockingTypes.has(cur.type)) { hasSleep = true; return; }
        if (cur.inputList) {
          for (const inp of cur.inputList) {
            if (inp.connection && inp.connection.targetBlock) {
              visit(inp.connection.targetBlock());
              if (hasSleep) return;
            }
          }
        }
        cur = cur.getNextBlock ? cur.getNextBlock() : null;
      }
    }
    visit(first);
    if (!hasSleep) bad++;
  });
  return bad;
}

// Returns an array of variable names referenced by active turtle
// command blocks that lack a matching active turtle_new constructor.
// Used by preflightChecks to refuse to run programs that would crash
// with NameError on the first turtle method call.
function findTurtleCommandsWithoutConstructor() {
  if (!workspace) return [];
  const missing = new Set();
  workspace.getAllBlocks(false).forEach(b => {
    if (!b.type || !b.type.startsWith('turtle_')) return;
    if (b.type === 'turtle_new') return;
    if (!isBlockActiveOnWorkspace(b)) return;
    if (!b.getVarModels) return;
    b.getVarModels().forEach(v => {
      if (!hasActiveTurtleNewFor(v.getId())) {
        missing.add(v.name);
      }
    });
  });
  return [...missing];
}

// One-button informational dialog. Wraps confirmDialog's machinery
// but only shows OK -- used for "blocking" preflight messages where
// the user has to go fix something rather than choose Yes/No.
// Modal dialog showing a step-by-step guide to flashing MicroPython
// onto the PBC+, plus a download link to the firmware UF2 next to
// this IDE file. We ship the file alongside index.html (same
// directory) so the link works offline -- if you can load the IDE
// from a USB stick or local file:// path, you can flash from it too.
// Manage-files dialog: a unified view of everything on the PBC+
// filesystem, with delete buttons. We already have specialised
// dialogs for .py (Open/Save) and .png (Bilder verwalten), but
// neither lets the student clean up the OTHER files -- old test
// outputs, .json configs, stray .txt files, the launcher itself.
// This one shows the lot in a single list and lets them tidy up.
// "Startmenü installieren": write a tiny main.py that calls
// pbc.menu(). If a main.py already exists, rename it to main(2).py
// (or main(3).py, ...) so we never destroy the user's launcher
// without giving them a way back. The student gets a single click
// solution: now the device boots straight into the launcher and
// every .py and .pbcp file on it shows up as a runnable program.
async function installLauncher() {
  if (!serialPort) { toast(t('Erst verbinden.'), 'warn'); return; }
  const ok = confirm(
    t('Das Startmenü wird als main.py auf dem PBC+ installiert. ' +
      'Beim nächsten Start zeigt das Gerät die Liste aller Programme.\n\n' +
      'Falls schon eine main.py existiert, wird sie zu main(2).py ' +
      '(oder main(3).py usw.) umbenannt – nichts geht verloren.\n\n' +
      'Fortfahren?'));
  if (!ok) return;

  // We do the whole thing in one Python snippet so it's atomic from
  // the user's point of view (either the rename + write both work,
  // or neither does). Walk main(2).py, main(3).py, ... to find the
  // first free slot, then rename, then write the new content.
  //
  // Note the dance with the print() calls: their output ends up in
  // r.stdout below, which is how we tell the user whether the old
  // file was preserved (and under what name) or not.
  const launcherCode = "import pbc\npbc.menu()\n";
  const code =
    'import os\n' +
    'try:\n' +
    "    os.stat('/main.py')\n" +
    '    n = 2\n' +
    '    while True:\n' +
    "        cand = 'main(' + str(n) + ').py'\n" +
    '        try:\n' +
    "            os.stat('/' + cand)\n" +
    '            n += 1\n' +
    '        except OSError:\n' +
    '            break\n' +
    "    os.rename('/main.py', '/' + cand)\n" +
    "    print('RENAMED', cand)\n" +
    'except OSError:\n' +
    "    print('FRESH')\n" +
    "with open('/main.py', 'w') as _f:\n" +
    '    _f.write(' + pyStringLit(launcherCode) + ')\n' +
    "print('OK')\n";

  const r = await runOnDevice(code, 5000);
  if (!r || r.stderr) {
    toast(t('Installation fehlgeschlagen'), 'bad');
    if (r?.stderr) term.write('\r\n\x1b[31m' +
                              r.stderr.replace(/\n/g,'\r\n') + '\x1b[0m');
    return;
  }
  const out = r.stdout || '';
  if (out.indexOf('RENAMED') >= 0) {
    const m = out.match(/RENAMED\s+(\S+)/);
    const oldName = m ? m[1] : '?';
    toast(t('Startmenü installiert. Alte main.py → ') + oldName, 'good');
  } else {
    toast(t('Startmenü installiert'), 'good');
  }
}

// =====================================================================
// Transfer files between the real PBC+ (USB) and the in-browser
// Emulator (IndexedDB). Two directions, same dialog:
//   'to-emu' : copy selected device files INTO the emulator
//   'to-dev' : copy selected emulator files ONTO the device
// The list shows a checkbox per file; files that already exist on the
// destination are flagged and require an extra confirmation before they
// get overwritten.
//
// Requires the PBC+ to be connected over USB (deviceMode === 'serial').
// The emulator side is always reachable via IndexedDB, independent of
// which run-target is currently active.
// =====================================================================

// A simple yes/no confirmation dialog. Returns a Promise<boolean>.
// Used for the overwrite warning in the transfer dialog.
function showConfirm(titleText, bodyText) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
      'display:flex; align-items:center; justify-content:center;' +
      'z-index:100010;';
    const dialog = document.createElement('div');
    dialog.style.cssText =
      'background:var(--bg-2); border:1px solid var(--border); ' +
      'border-radius:12px; padding:20px; max-width:440px; width:90%; ' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.4);';
    const h = document.createElement('h2');
    h.textContent = titleText;
    h.style.cssText = 'margin:0 0 10px; font-size:17px;';
    const p = document.createElement('div');
    p.textContent = bodyText;
    p.style.cssText =
      'color:var(--fg-1); font-size:14px; white-space:pre-wrap; ' +
      'margin-bottom:16px; line-height:1.45;';
    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; justify-content:flex-end;';
    const no = document.createElement('button');
    no.className = 'tb-btn';
    no.textContent = t('Abbrechen');
    const yes = document.createElement('button');
    yes.className = 'tb-btn danger';
    yes.textContent = t('Überschreiben');
    row.appendChild(no);
    row.appendChild(yes);
    dialog.appendChild(h);
    dialog.appendChild(p);
    dialog.appendChild(row);
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    const close = (val) => { overlay.remove(); resolve(val); };
    no.addEventListener('click', () => close(false));
    yes.addEventListener('click', () => close(true));
    overlay.addEventListener('click',
      (e) => { if (e.target === overlay) close(false); });
  });
}

// List files on the USB device (name + size), root only.
async function listDeviceFilesRaw() {
  const code =
    'import os\n' +
    "for n in sorted(os.listdir('/')):\n" +
    "    try: sz = os.stat('/' + n)[6]\n" +
    "    except: sz = -1\n" +
    "    print(n, sz)\n";
  const r = await runOnDevice(code, 8000);
  if (!r || r.stderr) return null;
  return r.stdout.split(/\r?\n/)
    .map(s => s.trim()).filter(Boolean)
    .map(l => {
      const parts = l.split(/\s+/);
      const sz = parseInt(parts.pop(), 10);
      return { name: parts.join(' '), size: isNaN(sz) ? -1 : sz };
    })
    .filter(f => f.name && f.name !== '.' && f.name !== '..');
}

// List emulator files (IndexedDB). Returns [{name, size}].
async function listEmuFilesRaw() {
  if (!window.__emuImgList) return [];
  const entries = await window.__emuImgList();
  return entries.map(e => ({
    name: e.name,
    size: (e.blob && typeof e.blob.size === 'number') ? e.blob.size : -1,
  })).sort((a, b) => a.name.localeCompare(b.name));
}

// Read one file off the USB device as a Blob (base64 chunks, like
// downloadFile but without the browser-save). Returns a Blob or null.
async function readDeviceFileBlob(name) {
  const sizeCode =
    'import os\n' +
    'try:\n' +
    "    print('SIZE', os.stat(" + pyStringLit(name) + ")[6])\n" +
    'except Exception as e:\n' +
    "    print('ERR', repr(e))\n";
  const sizeR = await runOnDevice(sizeCode, 5000);
  if (!sizeR || sizeR.stderr) return null;
  const m = (sizeR.stdout || '').match(/SIZE\s+(\d+)/);
  if (!m) return null;
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
    if (!r || r.stderr) return null;
    const b64 = (r.stdout || '').trim();
    parts.push(Uint8Array.from(atob(b64), c => c.charCodeAt(0)));
  }
  let totalLen = 0; parts.forEach(p => totalLen += p.length);
  const combined = new Uint8Array(totalLen);
  let off = 0; parts.forEach(p => { combined.set(p, off); off += p.length; });
  return new Blob([combined], { type: 'application/octet-stream' });
}

// Write a Blob onto the USB device (base64 chunks, wb then ab).
async function writeDeviceFileBlob(name, blob) {
  const buf = new Uint8Array(await blob.arrayBuffer());
  const CHUNK = 8 * 1024;
  const total = buf.length;
  if (total === 0) {
    const code = 'with open(' + pyStringLit(name) + ", 'wb') as _f:\n    pass\n";
    const r = await runOnDevice(code, 8000);
    return !!(r && !r.stderr);
  }
  for (let offset = 0; offset < total; offset += CHUNK) {
    const slice = buf.subarray(offset, Math.min(offset + CHUNK, total));
    const b64 = base64FromBytes(slice);
    const mode = offset === 0 ? 'wb' : 'ab';
    const code =
      'import binascii\n' +
      'with open(' + pyStringLit(name) + ', ' + pyStringLit(mode) + ') as _f:\n' +
      '    _f.write(binascii.a2b_base64(' + pyStringLit(b64) + '))\n';
    const r = await runOnDevice(code, 20000);
    if (!r || r.stderr) return false;
  }
  return true;
}

async function showTransferDialog(direction) {
  // direction: 'to-emu' (device -> emulator) | 'to-dev' (emulator -> device)
  const toEmu = (direction === 'to-emu');

  // Both directions need the real device over USB. The emulator side is
  // IndexedDB and always available.
  if (deviceMode !== 'serial' || !serialPort) {
    toast(t('Bitte zuerst den PBC+ per USB verbinden (Schalter auf PBC+).'),
          'warn');
    return;
  }

  cancelBlocklyGesture();

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
    'display:flex; align-items:center; justify-content:center;' +
    'z-index:100000;';
  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:var(--bg-2); border:1px solid var(--border); ' +
    'border-radius:12px; padding:20px; max-width:560px; width:92%; ' +
    'max-height:80vh; display:flex; flex-direction:column; ' +
    'box-shadow:0 4px 24px rgba(0,0,0,0.4);';

  const title = document.createElement('h2');
  title.textContent = toEmu
    ? t('PBC+ → Emulator übertragen')
    : t('Emulator → PBC+ übertragen');
  title.style.cssText = 'margin:0 0 4px; font-size:18px;';
  dialog.appendChild(title);

  const sub = document.createElement('div');
  sub.style.cssText = 'color:var(--fg-2); font-size:13px; margin-bottom:12px;';
  sub.textContent = toEmu
    ? t('Dateien auswählen, die vom Gerät in den Emulator kopiert werden.')
    : t('Dateien auswählen, die aus dem Emulator auf das Gerät kopiert werden.');
  dialog.appendChild(sub);

  const listBox = document.createElement('div');
  listBox.style.cssText =
    'flex:1; overflow:auto; border:1px solid var(--border); ' +
    'border-radius:8px; padding:6px; min-height:160px; background:var(--bg-1);';
  dialog.appendChild(listBox);

  const buttons = document.createElement('div');
  buttons.style.cssText =
    'display:flex; gap:8px; justify-content:flex-end; margin-top:14px;';
  dialog.appendChild(buttons);

  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    overlay.remove();
  };

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'tb-btn';
  cancelBtn.textContent = t('Schließen');
  cancelBtn.addEventListener('click', finish);

  const goBtn = document.createElement('button');
  goBtn.className = 'tb-btn primary';
  goBtn.textContent = t('Übertragen');
  goBtn.disabled = true;

  buttons.appendChild(cancelBtn);
  buttons.appendChild(goBtn);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) finish(); });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // Build the source + destination listings.
  listBox.innerHTML =
    '<div style="color:var(--fg-2);text-align:center;padding:24px;">' +
    t('Lade…') + '</div>';

  let sourceFiles, destNames;
  try {
    if (toEmu) {
      sourceFiles = await listDeviceFilesRaw();
      const dest = await listEmuFilesRaw();
      destNames = new Set(dest.map(f => f.name));
    } else {
      sourceFiles = await listEmuFilesRaw();
      const dev = await listDeviceFilesRaw();
      destNames = new Set((dev || []).map(f => f.name));
    }
  } catch (e) {
    console.warn('transfer list failed:', e);
    sourceFiles = null;
  }

  if (!sourceFiles) {
    listBox.innerHTML = '<div style="color:var(--bad);padding:16px;">' +
      t('Auflisten fehlgeschlagen.') + '</div>';
    return;
  }
  if (sourceFiles.length === 0) {
    listBox.innerHTML = '<div style="color:var(--fg-2);padding:16px;">' +
      t('Keine Dateien gefunden.') + '</div>';
    return;
  }

  // Render the checkbox rows.
  listBox.innerHTML = '';
  const rowState = [];   // { name, checkbox, exists }
  sourceFiles.forEach(f => {
    const exists = destNames.has(f.name);
    const row = document.createElement('label');
    row.style.cssText =
      'display:flex; align-items:center; gap:10px; padding:7px 8px; ' +
      'border-radius:6px; cursor:pointer; font-size:14px;';
    row.addEventListener('mouseenter',
      () => row.style.background = 'var(--bg-3)');
    row.addEventListener('mouseleave',
      () => row.style.background = '');

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.style.cssText = 'width:16px; height:16px; flex:none;';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = f.name;
    nameSpan.style.cssText = 'flex:1; font-family:monospace;';

    const meta = document.createElement('span');
    meta.style.cssText = 'color:var(--fg-2); font-size:12px; flex:none;';
    const kb = f.size >= 0 ? (f.size / 1024).toFixed(1) + ' KB' : '';
    meta.textContent = kb;

    row.appendChild(cb);
    row.appendChild(nameSpan);
    row.appendChild(meta);

    if (exists) {
      const warn = document.createElement('span');
      warn.textContent = t('überschreibt');
      warn.style.cssText =
        'flex:none; font-size:11px; color:#000; background:var(--warn,#e0b84c); ' +
        'padding:2px 7px; border-radius:10px; font-weight:600;';
      row.appendChild(warn);
    }

    listBox.appendChild(row);
    const st = { name: f.name, checkbox: cb, exists, size: f.size };
    rowState.push(st);
    cb.addEventListener('change', updateGoButton);
  });

  function updateGoButton() {
    const any = rowState.some(s => s.checkbox.checked);
    goBtn.disabled = !any;
  }

  goBtn.addEventListener('click', async () => {
    const chosen = rowState.filter(s => s.checkbox.checked);
    if (chosen.length === 0) return;

    // Warn about overwrites.
    const overwrites = chosen.filter(s => s.exists).map(s => s.name);
    if (overwrites.length > 0) {
      const list = overwrites.length > 6
        ? overwrites.slice(0, 6).join(', ') + ', …'
        : overwrites.join(', ');
      const ok = await showConfirm(
        t('Überschreiben bestätigen'),
        t('Diese Dateien existieren am Ziel bereits und werden überschrieben:') +
          '\n\n' + list + '\n\n' + t('Fortfahren?'));
      if (!ok) return;
    }

    goBtn.disabled = true;
    cancelBtn.disabled = true;
    let done = 0, failed = 0;
    for (const s of chosen) {
      const rowIdx = rowState.indexOf(s);
      const label = listBox.children[rowIdx];
      if (label) label.style.opacity = '0.5';
      try {
        let blob;
        if (toEmu) {
          blob = await readDeviceFileBlob(s.name);
          if (!blob) { failed++; continue; }
          await window.__emuImgPut(s.name, blob);
          // Keep image dropdowns fresh for PNGs.
          if (s.name.toLowerCase().endsWith('.png') &&
              KNOWN_IMAGES.indexOf(s.name) < 0) {
            KNOWN_IMAGES.push(s.name); KNOWN_IMAGES.sort();
            if (typeof refreshImageBlocks === 'function') refreshImageBlocks();
          }
        } else {
          blob = await window.__emuImgGet(s.name);
          if (!blob) { failed++; continue; }
          const ok = await writeDeviceFileBlob(s.name, blob);
          if (!ok) { failed++; continue; }
        }
        done++;
        if (label) {
          label.style.opacity = '1';
          const tag = document.createElement('span');
          tag.textContent = '✓';
          tag.style.cssText = 'flex:none; color:var(--good); font-weight:700;';
          label.appendChild(tag);
        }
      } catch (e) {
        console.warn('transfer of', s.name, 'failed:', e);
        failed++;
      }
    }
    cancelBtn.disabled = false;
    cancelBtn.textContent = t('Fertig');
    if (failed === 0) {
      toast(done + ' ' + t('Datei(en) übertragen'), 'good');
    } else {
      toast(done + ' ' + t('übertragen') + ', ' + failed + ' ' +
            t('fehlgeschlagen'), failed === chosen.length ? 'bad' : 'warn');
    }
  });
}

async function showManageFilesDialog() {
  if (!(await ensureTargetReady())) return;
  cancelBlocklyGesture();

  const overlay = document.createElement('div');
  overlay.style.cssText =
    'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
    'display:flex; align-items:center; justify-content:center;' +
    'z-index:100000;';
  const dialog = document.createElement('div');
  dialog.style.cssText =
    'background:var(--bg-1, #1f2630); color:var(--fg-0, #fff);' +
    'padding:22px 24px; border-radius:8px;' +
    'width:min(560px, 92vw); max-height:88vh;' +
    'display:flex; flex-direction:column;' +
    'box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
    'border:1px solid var(--border, #2d3744);';

  const h = document.createElement('div');
  h.textContent = t('Dateien auf dem') + ' ' + targetLabel();
  h.style.cssText = 'font-weight:600; font-size:16px; margin-bottom:6px;';
  dialog.appendChild(h);

  const sub = document.createElement('div');
  sub.textContent = t('Hier siehst du alle Dateien auf dem Gerät. Du kannst neue Dateien hochladen oder vorhandene löschen.');
  sub.style.cssText = 'font-size:12.5px; color:var(--fg-1); margin-bottom:14px;';
  dialog.appendChild(sub);

  // Upload bar below the list, like in the image manager: a single
  // button that opens a multi-file picker. Selected files get uploaded
  // to the device root, then the list above refreshes automatically. Saves the student a
  // round trip through a separate "Datei auf den PBC+…" menu.
  const uploadBar = document.createElement('div');
  uploadBar.style.cssText =
    'display:flex; gap:8px; align-items:center; margin-right:auto;';
  const uploadBtn = document.createElement('button');
  uploadBtn.textContent = '⬆  ' + t('Datei(en) oder ZIP hochladen…');
  uploadBtn.className = 'tb-btn';
  uploadBtn.style.cssText = 'padding:6px 14px;';
  uploadBar.appendChild(uploadBtn);
  const hiddenInp = document.createElement('input');
  hiddenInp.type = 'file';
  hiddenInp.multiple = true;
  hiddenInp.style.display = 'none';
  uploadBar.appendChild(hiddenInp);
  uploadBtn.addEventListener('click', () => hiddenInp.click());
  hiddenInp.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    e.target.value = '';
    if (files.length === 0) return;
    uploadBtn.disabled = true;
    uploadBtn.textContent = t('Lade hoch…');
    // A ZIP counts as the files inside it; everything lands in the root.
    const liste = [];
    for (const f of files) {
      if (!/\.zip$/i.test(f.name)) { liste.push({ name: f.name, blob: f }); continue; }
      try {
        liste.push(...await zipFuerGeraet(f));
      } catch (err) {
        toast(t('ZIP-Datei nicht lesbar:') + ' ' + err.message, 'bad');
      }
    }
    let ok = 0;
    if (await passtAufsGeraet(liste)) {
      for (const f of liste) {
        try {
          const r = await uploadBlob(f.blob, f.name);
          if (r === false) break;   // device gone
          ok++;
        } catch (err) {
          console.warn('upload failed:', f.name, err);
        }
      }
      // The toast is gone after 2 s; the terminal keeps the summary.
      term.write('\r\n\x1b[' + (ok === liste.length ? '32' : '31') + 'm-- ' + ok + ' / ' +
                 liste.length + ' ' + t('hochgeladen') + ' --\x1b[0m\r\n');
      toast(ok + ' / ' + liste.length + ' ' + t('hochgeladen'),
            ok === liste.length ? 'good' : 'warn');
    }
    uploadBtn.disabled = false;
    uploadBtn.textContent = '⬆  ' + t('Datei(en) oder ZIP hochladen…');
    if (ok && liste.some(f => /\.pbcp$/i.test(f.name))) {
      const hinweis = await pbcpFirmwareHinweis();
      if (hinweis) {
        pbcpHinweis.textContent = hinweis;
        pbcpHinweis.style.display = '';
      }
    }
    await refresh();
  });

  // Stays until the dialog closes: old firmware does not list .pbcp.
  const pbcpHinweis = document.createElement('div');
  pbcpHinweis.style.cssText =
    'display:none; font-size:12.5px; line-height:1.45; margin-top:10px;' +
    'padding:8px 10px; border-radius:6px; background:var(--bg-2);' +
    'border-left:3px solid var(--warn);';

  const listBox = document.createElement('div');
  listBox.style.cssText =
    'flex:1; min-height:200px; max-height:55vh; overflow:auto;' +
    'border:1px solid var(--border); border-radius:6px;' +
    'padding:4px;';
  listBox.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">' +
                     t('Lade…') + '</div>';
  dialog.appendChild(listBox);
  dialog.appendChild(pbcpHinweis);

  const buttons = document.createElement('div');
  buttons.style.cssText =
    'display:flex; gap:8px; justify-content:flex-end; margin-top:14px;';
  buttons.appendChild(uploadBar);
  function finish() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    // After file changes, the various other dialogs' lists are now
    // stale. Refresh whatever caches we keep.
    refreshImages().catch(() => {});
  }
  const closeBtn = document.createElement('button');
  closeBtn.textContent = t('Schließen');
  closeBtn.className = 'tb-btn primary';
  closeBtn.addEventListener('click', finish);
  buttons.appendChild(closeBtn);
  dialog.appendChild(buttons);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  // List EVERY file at the root, not just one extension. The Python
  // helper here mirrors the patterns used by the other file dialogs
  // (listdir + os.stat) but doesn't filter by suffix.
  async function refresh() {
    listBox.innerHTML = '<div style="color:var(--fg-2);text-align:center;padding:24px;">' +
                       t('Lade…') + '</div>';
    // Emulator: its files (uploads, images) live in the browser's
    // IndexedDB store, not in a filesystem a listing program could see.
    const emuFiles = runTarget === 'emulator' && window.__emuImgList;
    const code =
      'import os\n' +
      "for n in sorted(os.listdir('/')):\n" +
      "    try: sz = os.stat('/' + n)[6]\n" +
      "    except: sz = -1\n" +
      "    print(n, sz)\n";
    const r = emuFiles
      ? { stdout: (await window.__emuImgList())
            .sort((a, b) => (a.name < b.name ? -1 : 1))
            .map((f) => f.name + ' ' + (f.blob ? f.blob.size : -1)).join('\n'),
          stderr: '' }
      : await runOnDevice(code, 5000);
    if (!r || r.stderr) {
      listBox.innerHTML = '<div style="color:var(--bad);padding:16px;">' +
        t('Auflisten fehlgeschlagen.') + '</div>';
      return;
    }
    const files = r.stdout.split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .map(l => {
        const parts = l.split(/\s+/);
        const sz = parseInt(parts.pop(), 10);
        return { name: parts.join(' '), size: sz };
      })
      // System files we'd rather the student didn't nuke by accident.
      // boot.py / main.py / the pbc.py module / launcher state are
      // load-bearing -- deleting them turns the device into a brick
      // (well, a paperweight needing a re-flash). We keep them in
      // the list but mark them so the delete prompt is more loudly
      // confirmatory.
      .map(f => ({
        ...f,
        critical: ['boot.py', 'main.py', 'pbc.py'].indexOf(f.name) >= 0,
      }));

    if (files.length === 0) {
      listBox.innerHTML = '<div style="color:var(--fg-2);padding:16px;">' +
        t('Keine Dateien auf dem Gerät.') + '</div>';
      return;
    }
    listBox.innerHTML = '';
    files.forEach(f => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex;align-items:center;padding:7px 10px;' +
        'border-radius:4px;gap:10px;' +
        'border:1px solid transparent;';
      row.onmouseover = () => row.style.background = 'var(--bg-2)';
      row.onmouseout  = () => row.style.background = '';

      const name = document.createElement('span');
      name.style.cssText =
        'flex:1;color:var(--fg-0);font-family:ui-monospace,monospace;' +
        'overflow:hidden;text-overflow:ellipsis;white-space:nowrap;' +
        'font-size:13px;';
      name.textContent = f.name;
      row.appendChild(name);

      if (f.critical) {
        const tag = document.createElement('span');
        tag.textContent = t('System');
        tag.style.cssText =
          'color:var(--warn);font-size:10.5px;' +
          'padding:1px 6px;border:1px solid var(--warn);' +
          'border-radius:10px;text-transform:uppercase;letter-spacing:0.5px;';
        row.appendChild(tag);
      }

      const sz = document.createElement('span');
      sz.style.cssText =
        'color:var(--fg-2);font-size:11px;font-family:ui-monospace,monospace;' +
        'min-width:60px;text-align:right;';
      sz.textContent = (f.size >= 0)
        ? (f.size < 1024
            ? f.size + ' B'
            : (f.size/1024).toFixed(1) + ' KB')
        : '?';
      row.appendChild(sz);

      // Download button: arrow-down icon, no text. Sits just before
      // the delete button so the row pattern is "name … size [↓] [×]"
      // -- destructive action (delete) on the far right per
      // convention, non-destructive (download) just inside it.
      const dl = document.createElement('button');
      dl.innerHTML = '⭳';
      dl.title = t('Herunterladen');
      dl.style.cssText =
        'background:transparent;color:var(--fg-1);' +
        'border:1px solid transparent;border-radius:4px;' +
        'width:26px;height:26px;font-size:18px;line-height:1;' +
        'cursor:pointer;flex-shrink:0;';
      dl.onmouseover = () => {
        dl.style.background = 'var(--bg-3)';
        dl.style.borderColor = 'var(--border)';
        dl.style.color = 'var(--fg-0)';
      };
      dl.onmouseout = () => {
        dl.style.background = 'transparent';
        dl.style.borderColor = 'transparent';
        dl.style.color = 'var(--fg-1)';
      };
      dl.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        await downloadFile(f.name);
      });
      row.appendChild(dl);

      const del = document.createElement('button');
      del.textContent = '×';
      del.title = t('Datei löschen');
      del.style.cssText =
        'background:transparent;color:var(--bad);' +
        'border:1px solid transparent;border-radius:4px;' +
        'width:26px;height:26px;font-size:18px;line-height:1;' +
        'cursor:pointer;flex-shrink:0;font-weight:bold;';
      del.onmouseover = () => {
        del.style.background = 'color-mix(in srgb, var(--bad) 20%, var(--bg-2))';
        del.style.borderColor = 'var(--bad)';
      };
      del.onmouseout = () => {
        del.style.background = 'transparent';
        del.style.borderColor = 'transparent';
      };
      del.addEventListener('click', async (ev) => {
        ev.stopPropagation();
        const prompt = f.critical
          ? f.name + t(' ist eine Systemdatei. Wirklich löschen? Das Gerät kann danach kaputt sein!')
          : f.name + t(' wirklich löschen?');
        if (!confirm(prompt)) return;
        const r = emuFiles
          ? (await window.__emuImgDelete(f.name), { stdout: '', stderr: '' })
          : await runOnDevice(
              'import os\nos.remove(' + pyStringLit(f.name) + ")\nprint('geloescht')\n",
              5000);
        if (r && !r.stderr) {
          toast(f.name + ' ' + t('gelöscht'), 'good');
          await refresh();
        } else {
          toast(t('Löschen fehlgeschlagen') +
                (r && r.stderr ? ': ' + r.stderr.split('\n').pop().trim() : ''),
                'bad');
        }
      });
      row.appendChild(del);
      listBox.appendChild(row);
    });
  }

  refresh();
}

function showInstallMicroPythonDialog() {
  cancelBlocklyGesture();
  // Use the same .modal-bg / .modal markup as the other dialogs in
  // the app (Settings, Open, Save) so the styling is identical --
  // same border-radius, background, border, button row. We build it
  // with the shared classes rather than ad-hoc inline styles.
  const overlay = document.createElement('div');
  overlay.className = 'modal-bg show';
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.style.cssText = 'min-width:480px; max-width:600px;';

  const h = document.createElement('h2');
  h.textContent = t('MicroPython auf den PBC+ installieren');
  dialog.appendChild(h);

  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.cssText = 'font-size:13.5px; line-height:1.55;';
  body.innerHTML = (LANG === 'en') ? `
    <p>The PBC+ runs MicroPython. Use these steps to install it –
    whether your device doesn't have it yet, you want to update it, or
    you need to restore it after a crash.</p>

    <p style="background:var(--danger-dim); border:1px solid var(--danger);
       border-radius:6px; padding:9px 11px; margin:12px 0;">
      <b>⚠ Warning:</b> Flashing erases <b>everything</b> on the PBC+ –
      all your programs, images and saved files. If you want to keep them,
      create a backup first via <b>File → Create flash backup (.uf2)…</b>
      before you continue.
    </p>

    <ol style="margin:14px 0 14px 22px; padding:0;">
      <li><b>Download the firmware:</b>
        <a id="mp-download" href="micropythonPBCP.uf2" download
           style="color:var(--accent, #4f9eff); text-decoration:underline;">
           micropythonPBCP.uf2
        </a>
      </li>
      <li><b>Connect the PBC+</b> to the computer via USB.</li>
      <li><b>Hold the BOOT button</b> on the back of the device, then
        briefly tap <b>RES</b> – still holding BOOT. Let go of BOOT
        after a moment.</li>
      <li>A new disk drive named <code>RP2350</code>
        appears on the computer.</li>
      <li><b>Drag the <code>micropythonPBCP.uf2</code> file</b> onto that
        drive (or copy it there with your file manager).</li>
      <li>The drive disappears as soon as the copy finishes – that
        means the PBC+ has flashed itself and rebooted.</li>
      <li>Click <b>Connect</b> back in this IDE and you're ready to go.</li>
    </ol>

    <p style="color:var(--fg-1, #afbac4); font-size:12.5px;">
      The RES and BOOT buttons are on the back of the PBC+. RES is a
      plain reset – it restarts whatever's installed. BOOT puts the
      device into firmware-flash mode so the computer sees the drive.
    </p>
  ` : `
    <p>Damit der PBC+ deine Programme ausführen kann, muss MicroPython
    darauf laufen. Mit diesen Schritten spielst du es auf – egal, ob dein
    Gerät noch keines hat, du es aktualisieren oder nach einem Absturz
    wiederherstellen möchtest.</p>

    <p style="background:var(--danger-dim); border:1px solid var(--danger);
       border-radius:6px; padding:9px 11px; margin:12px 0;">
      <b>⚠ Achtung:</b> Beim Flashen wird <b>alles</b> auf dem PBC+
      gelöscht – alle deine Programme, Bilder und gespeicherten Dateien.
      Wenn du sie behalten möchtest, erstelle vorher ein Backup über
      <b>Datei → Flash-Backup erstellen (.uf2)…</b>, bevor du fortfährst.
    </p>

    <ol style="margin:14px 0 14px 22px; padding:0;">
      <li><b>Firmware herunterladen:</b>
        <a id="mp-download" href="micropythonPBCP.uf2" download
           style="color:var(--accent, #4f9eff); text-decoration:underline;">
           micropythonPBCP.uf2
        </a>
      </li>
      <li><b>PBC+ per USB an den Computer anschließen</b>.</li>
      <li><b>BOOT-Knopf</b> auf der Rückseite gedrückt halten und
        währenddessen <b>RES</b> einmal kurz drücken. Anschließend BOOT
        loslassen.</li>
      <li>Auf dem Computer erscheint ein neues Laufwerk mit dem Namen
        <code>RP2350</code>.</li>
      <li><b>Ziehe die Datei <code>micropythonPBCP.uf2</code></b> auf
        dieses Laufwerk (oder kopiere sie dorthin).</li>
      <li>Das Laufwerk verschwindet, sobald das Kopieren abgeschlossen
        ist – das bedeutet, der PBC+ hat sich geflashed und neu
        gestartet.</li>
      <li>Klicke wieder auf <b>Verbinden</b> in der IDE und es kann
        losgehen.</li>
    </ol>

    <p style="color:var(--fg-1, #afbac4); font-size:12.5px;">
      Die RES- und BOOT-Knöpfe sind auf der Rückseite des PBC+. RES ist
      ein einfacher Reset – startet einfach das installierte Programm
      neu. BOOT versetzt das Gerät in den Flash-Modus, sodass der
      Computer das Laufwerk sieht.
    </p>
  `;
  dialog.appendChild(body);

  const buttons = document.createElement('div');
  buttons.className = 'modal-foot';
  function finish() {
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
  }
  const okBtn = document.createElement('button');
  okBtn.textContent = t('Schließen');
  okBtn.className = 'tb-btn primary';
  okBtn.addEventListener('click', finish);
  buttons.appendChild(okBtn);
  dialog.appendChild(buttons);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) finish();
  });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); finish(); }
  });
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);
  setTimeout(() => okBtn.focus(), 0);
}

// =====================================================================
// Full-flash backup as a .uf2
// =====================================================================
// Reads the device's whole 16 MB flash over the REPL and packages the
// non-empty 4 KB sectors into a UF2 the user can restore via BOOTSEL.
//
// Honest caveats (told to the user in the dialog too):
//  - It's slow: even skipping erased (all-0xFF) sectors, the firmware +
//    filesystem are a few MB, sent hex-encoded over USB-CDC. Minutes.
//  - Sparse at sector granularity: all-0xFF sectors are skipped. On
//    restore the bootloader erases each written sector first (erased =
//    0xFF), so the skipped bytes come out 0xFF anyway. Sectors that are
//    entirely 0xFF aren't written at all -- fine for "back up the
//    firmware+fs before installing".
//  - The author could not test the flash read on real hardware; the UF2
//    assembly is verified, the device read is logically sound. Verify
//    the .uf2 before relying on it.

const UF2_BACKUP = {
  XIP_BASE: 0x10000000,
  FLASH_SIZE: 16 * 1024 * 1024,    // PBC+ has 16 MB
  SECTOR: 4096,
  PAYLOAD: 256,                    // UF2 data bytes per block
  FAMILY_RP2350_ARM_S: 0xe48bff59, // verified for RP2350 ARM-S images
};

// Turn a list of {addr, data:Uint8Array(256)} into a UF2 byte array.
function assembleUf2(blocks) {
  const U = UF2_BACKUP;
  const out = new Uint8Array(blocks.length * 512);
  const dv = new DataView(out.buffer);
  for (let i = 0; i < blocks.length; i++) {
    const o = i * 512;
    dv.setUint32(o + 0,  0x0A324655, true);          // magic start 0
    dv.setUint32(o + 4,  0x9E5D5157, true);          // magic start 1
    dv.setUint32(o + 8,  0x00002000, true);          // flags: familyID present
    dv.setUint32(o + 12, blocks[i].addr >>> 0, true);// target address
    dv.setUint32(o + 16, blocks[i].data.length, true);// payload size
    dv.setUint32(o + 20, i, true);                   // block number
    dv.setUint32(o + 24, blocks.length, true);       // total blocks
    dv.setUint32(o + 28, U.FAMILY_RP2350_ARM_S, true);// family id
    out.set(blocks[i].data, o + 32);                 // payload
    dv.setUint32(o + 508, 0x0AB16F30, true);         // magic end
  }
  return out;
}

// Hex -> Uint8Array.
function hexToBytes(hex) {
  const n = hex.length >> 1;
  const a = new Uint8Array(n);
  for (let i = 0; i < n; i++) a[i] = parseInt(hex.substr(i * 2, 2), 16);
  return a;
}

// Run the backup. onProgress({done, total, sectors, bytes}) is called as
// sectors arrive. shouldAbort() is polled; if it returns true we stop and
// throw. Resolves to the assembled UF2 Uint8Array.
async function backupFlashToUf2(onProgress, shouldAbort) {
  if (!serialPort || !serialWriter || deviceMode === 'emulator') {
    throw new Error('not-connected');
  }
  const U = UF2_BACKUP;
  const totalSectors = U.FLASH_SIZE / U.SECTOR;

  // Device-side dumper. Streams "S <hex-offset> <hex-data>\n" for each
  // non-empty 4 KB sector, then "DONE <count>\n". Hardened against the
  // failure that produced a truncated backup before (it died after a few
  // sectors with a MemoryError):
  //   - re-aliases the flash per sector instead of one 16 MB alias,
  //   - writes the hex in 256-byte pieces so peak allocation stays tiny,
  //   - gc.collect() after every sector so nothing builds up,
  //   - wraps the body in try/except and emits "ERR <off> <repr>" so a
  //     failure is reported (and surfaced by the IDE) rather than silent.
  // Reading XIP-mapped flash via uctypes.bytearray_at is a plain memory
  // read and does not disturb code execution.
  const dumper =
    'import uctypes,ubinascii,sys,gc\n' +
    'BASE=' + U.XIP_BASE + '\n' +
    'SIZE=' + U.FLASH_SIZE + '\n' +
    'SECT=' + U.SECTOR + '\n' +
    'BLANK=b"\\xff"*SECT\n' +
    'w=sys.stdout.write\n' +
    'n=0\n' +
    'o=0\n' +
    'while o<SIZE:\n' +
    ' try:\n' +
    '  fv=uctypes.bytearray_at(BASE+o,SECT)\n' +
    '  c=bytes(fv)\n' +
    '  if c!=BLANK:\n' +
    '   w("S %x " % o)\n' +
    '   p=0\n' +
    '   while p<SECT:\n' +
    '    w(ubinascii.hexlify(c[p:p+256]).decode())\n' +
    '    p+=256\n' +
    '   w("\\n")\n' +
    '   n+=1\n' +
    ' except Exception as e:\n' +
    '  w("ERR %x %s\\n" % (o,repr(e)))\n' +
    '  break\n' +
    ' o+=SECT\n' +
    ' gc.collect()\n' +
    'w("DONE %d\\n" % n)\n';

  interactive = false;
  protoBuffer = new Uint8Array(0);
  const blocks = [];
  let bytesSeen = 0;
  try {
    // Enter raw REPL (no soft-reset -- we want the live flash as-is).
    await sendRaw('\r\x03');
    await sleep(80);
    protoBuffer = new Uint8Array(0);
    await sendRaw('\x01');                       // Ctrl-A: raw REPL
    if (!await waitFor('raw REPL', 3000)) {
      // one more nudge
      await sendRaw('\x01');
      if (!await waitFor('raw REPL', 2000)) throw new Error('raw-repl-failed');
    }
    await waitFor('>', 1500);
    protoBuffer = new Uint8Array(0);
    await sendRaw(dumper);
    await sendRaw('\x04');                       // execute
    if (!await waitFor('OK', 4000)) throw new Error('no-ok');

    // Stream-parse the frames out of protoBuffer as they arrive. We hold
    // a text tail and consume complete lines. In MicroPython's raw REPL,
    // a 0x04 ends stdout; a traceback (if the program errored) follows
    // and is ended by a second 0x04. So: we only accept the dump as
    // complete when we've actually seen a "DONE" line. If we hit the
    // stdout-terminating 0x04 WITHOUT having seen DONE, the program died
    // partway -- we read the traceback after it and surface that, rather
    // than silently saving a truncated backup.
    const dec = new TextDecoder();
    let tail = '';
    let consumed = 0;          // bytes of protoBuffer already turned to text
    let finished = false;      // saw DONE -> success
    let lastData = Date.now();

    while (!finished) {
      if (shouldAbort && shouldAbort()) {
        await sendRaw('\x03\x03');                // interrupt the dump
        throw new Error('aborted');
      }
      const delim = protoBuffer.indexOf(0x04, consumed);
      const end = (delim >= 0) ? delim : protoBuffer.length;
      if (end > consumed) {
        tail += dec.decode(protoBuffer.slice(consumed, end), { stream: true });
        consumed = end;
        lastData = Date.now();
        let nl;
        while ((nl = tail.indexOf('\n')) >= 0) {
          const line = tail.slice(0, nl);
          tail = tail.slice(nl + 1);
          if (line.startsWith('S ')) {
            const sp = line.indexOf(' ', 2);
            const off = parseInt(line.slice(2, sp), 16);
            const hex = line.slice(sp + 1);
            const data = hexToBytes(hex);
            bytesSeen += data.length;
            for (let p = 0; p < data.length; p += U.PAYLOAD) {
              const slice = data.subarray(p, p + U.PAYLOAD);
              blocks.push({ addr: (U.XIP_BASE + off + p) >>> 0,
                            data: slice });
            }
            if (onProgress) {
              onProgress({ done: (off / U.SECTOR) | 0, total: totalSectors,
                           sectors: blocks.length, bytes: bytesSeen });
            }
          } else if (line.startsWith('DONE')) {
            finished = true;
            break;
          } else if (line.startsWith('ERR ')) {
            // The dumper hit an exception on a sector and reported it.
            const e = new Error('device-error');
            e.deviceTrace = line;
            throw e;
          }
        }
      }
      if (finished) break;
      if (delim >= 0) {
        // stdout ended (0x04) but no DONE was seen -> the dumper crashed.
        // Read the traceback that follows (up to the second 0x04) so we
        // can show the real reason instead of saving a truncated file.
        let tb = '';
        const tbStart = delim + 1;
        const waitTb = Date.now() + 2000;
        while (Date.now() < waitTb) {
          const second = protoBuffer.indexOf(0x04, tbStart);
          const tbEnd = (second >= 0) ? second : protoBuffer.length;
          if (tbEnd > tbStart) {
            tb = dec.decode(protoBuffer.slice(tbStart, tbEnd)).trim();
          }
          if (second >= 0) break;
          await sleep(20);
        }
        const e = new Error('device-error');
        e.deviceTrace = tb;
        throw e;
      }
      if (Date.now() - lastData > 15000) throw new Error('timeout');
      await sleep(20);
    }

    // Leave raw REPL.
    await sendRaw('\x02');
    await sleep(50);

    if (blocks.length === 0) throw new Error('empty');
    return assembleUf2(blocks);
  } finally {
    interactive = true;
    protoBuffer = new Uint8Array(0);
  }
}

// Progress UI for the flash backup: a modal with a bar, live byte/sector
// count, and a Cancel button. Wraps backupFlashToUf2 and downloads the
// resulting .uf2 on success.
async function runFlashBackupUI() {
  if (!serialPort || deviceMode === 'emulator') {
    await alertDialog(t('Nicht verbunden'),
      t('Verbinde zuerst den echten PBC+ per USB, dann kann das Backup ' +
        'erstellt werden.'));
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'modal-bg show';
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.style.cssText = 'min-width:420px; max-width:520px;';
  dialog.innerHTML =
    '<h2>' + t('Flash-Backup wird erstellt…') + '</h2>' +
    '<div class="modal-body" style="font-size:13px;line-height:1.5;">' +
    '<p>' + t('Das kann ein paar Minuten dauern. Trenne den PBC+ ' +
             'in dieser Zeit nicht und schließe diesen Tab nicht.') + '</p>' +
    '<div style="margin:14px 0;background:var(--bg-3);border-radius:6px;' +
    'height:14px;overflow:hidden;">' +
    '<div id="bk-bar" style="height:100%;width:0%;background:var(--accent,#4f9eff);' +
    'transition:width 0.2s;"></div></div>' +
    '<div id="bk-info" style="font-size:12px;color:var(--fg-1);">' +
    t('Starte…') + '</div>' +
    '</div>';
  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'tb-btn';
  cancelBtn.textContent = t('Abbrechen');
  foot.appendChild(cancelBtn);
  dialog.appendChild(foot);
  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const bar  = dialog.querySelector('#bk-bar');
  const info = dialog.querySelector('#bk-info');
  let aborted = false;
  cancelBtn.addEventListener('click', () => {
    aborted = true;
    cancelBtn.disabled = true;
    info.textContent = t('Wird abgebrochen…');
  });

  const onProgress = (p) => {
    const pct = Math.min(100, Math.round((p.done / p.total) * 100));
    bar.style.width = pct + '%';
    const kb = (p.bytes / 1024).toFixed(0);
    info.textContent = t('Gelesen:') + ' ' + kb + ' KB · ' +
      p.sectors + ' ' + t('Blöcke') + ' · ' + pct + '%';
  };

  try {
    const uf2 = await backupFlashToUf2(onProgress, () => aborted);
    // Download it.
    const blob = new Blob([uf2], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const stamp = new Date().toISOString().slice(0, 10);
    a.href = url; a.download = 'pbcplus-backup-' + stamp + '.uf2'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    bar.style.width = '100%';
    info.textContent = t('Fertig! Backup heruntergeladen.') + ' (' +
      ((uf2.length / 1024 / 1024).toFixed(1)) + ' MB)';
    cancelBtn.textContent = t('Schließen');
    cancelBtn.disabled = false;
    cancelBtn.onclick = () => { if (overlay.parentNode) overlay.remove(); };
    toast(t('Flash-Backup gespeichert'), 'good');
  } catch (e) {
    const msg = String(e && e.message || e);
    let human;
    if (msg === 'aborted')            human = t('Backup abgebrochen.');
    else if (msg === 'not-connected') human = t('Nicht verbunden.');
    else if (msg === 'raw-repl-failed' || msg === 'no-ok')
      human = t('Der PBC+ hat nicht reagiert. Läuft gerade ein Programm? ' +
                'Versuche es nach einem Soft-Reset erneut.');
    else if (msg === 'timeout')       human = t('Zeitüberschreitung beim ' +
                'Lesen. Bitte erneut versuchen.');
    else if (msg === 'empty')         human = t('Es wurden keine Daten ' +
                'gelesen. Unterstützt diese Firmware uctypes?');
    else if (msg === 'device-error') {
      // The dumper crashed on the device. Show its message so we know why
      // (this is what was lost as the "REPL message" before).
      human = t('Der PBC+ hat das Auslesen abgebrochen. Meldung vom Gerät:');
      const trace = (e.deviceTrace || '').trim();
      if (trace) {
        const pre = document.createElement('pre');
        pre.textContent = trace;
        pre.style.cssText = 'margin-top:8px;padding:8px;background:var(--bg-3);' +
          'border-radius:4px;font-size:11px;white-space:pre-wrap;' +
          'max-height:120px;overflow:auto;color:var(--fg-1);';
        info.textContent = human;
        info.appendChild(pre);
        bar.style.background = 'var(--bad,#e06c75)';
        cancelBtn.textContent = t('Schließen');
        cancelBtn.disabled = false;
        cancelBtn.onclick = () => { if (overlay.parentNode) overlay.remove(); };
        return;
      }
    }
    else human = t('Backup fehlgeschlagen:') + ' ' + msg;
    info.textContent = human;
    if (msg === 'aborted') {
      // Show the "cancelled" message briefly, then close the window on
      // its own -- no button to click.
      bar.style.background = 'var(--warn,#d8a657)';
      cancelBtn.style.display = 'none';
      setTimeout(() => { if (overlay.parentNode) overlay.remove(); }, 1000);
    } else {
      bar.style.background = 'var(--bad,#e06c75)';
      cancelBtn.textContent = t('Schließen');
      cancelBtn.disabled = false;
      cancelBtn.onclick = () => { if (overlay.parentNode) overlay.remove(); };
    }
  }
}

function alertDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
      'display:flex; align-items:center; justify-content:center;' +
      'z-index:100000;';
    const dialog = document.createElement('div');
    dialog.style.cssText =
      'background:var(--bg-1, #1f2630); color:var(--fg-0, #fff);' +
      'padding:20px 22px; border-radius:8px; min-width:340px;' +
      'max-width:480px; box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
      'border:1px solid var(--border, #2d3744); font-family:inherit;';
    if (title) {
      const h = document.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-weight:600; font-size:15px; margin-bottom:10px;';
      dialog.appendChild(h);
    }
    if (message) {
      const m = document.createElement('div');
      m.textContent = message;
      m.style.cssText = 'font-size:13px; line-height:1.4;' +
                        'margin-bottom:16px; white-space:pre-wrap;';
      dialog.appendChild(m);
    }
    const buttons = document.createElement('div');
    buttons.style.cssText =
      'display:flex; gap:8px; justify-content:flex-end;';
    function finish() {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve();
    }
    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'tb-btn primary';
    okBtn.addEventListener('click', finish);
    buttons.appendChild(okBtn);
    dialog.appendChild(buttons);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish();
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' || e.key === 'Enter') {
        e.preventDefault(); finish();
      }
    });
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    setTimeout(() => okBtn.focus(), 0);
  });
}

// =====================================================================
// Contact form, Impressum, hardware-wish form
// =====================================================================
// All three share one PHP endpoint (kontakt.php) hosted next to this
// page. The endpoint distinguishes messages by a "type" field. Spam is
// handled without a captcha: a honeypot field + a client-side "form was
// open long enough" timer (both also re-checked server-side) + a
// server-side per-IP rate limit.
const CONTACT_ENDPOINT = 'kontakt.php';   // relative to where index.html is hosted

// Build a modal shell (returns {overlay, dialog, close}). Reuses the
// app's .modal styling so it matches every other dialog.
function buildModalShell(titleText, minW) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-bg show';
  const dialog = document.createElement('div');
  dialog.className = 'modal';
  dialog.style.cssText = 'min-width:' + (minW || 420) + 'px; max-width:560px;';
  const h = document.createElement('h2');
  h.textContent = titleText;
  dialog.appendChild(h);
  overlay.appendChild(dialog);
  const close = () => { if (overlay.parentNode) overlay.remove(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  return { overlay, dialog, close };
}

// License section of the Impressum. MicroPython is embedded in this page,
// so its MIT text has to ship with it; the CDN files carry their own.
function lizenzHtml() {
  const mit = `Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.`;
  const link = (url, text) =>
    `<a href="${url}" target="_blank" rel="noopener" style="color:var(--accent);">${text}</a>`;
  const gpl = link('https://www.gnu.org/licenses/gpl-3.0.html', 'GNU General Public License v3');
  const apache = link('https://www.apache.org/licenses/LICENSE-2.0', 'Apache License 2.0');
  const liste = `<ul style="margin:6px 0;padding-left:20px;">
      <li>MicroPython: Copyright (c) 2013-2026 Damien P. George and contributors, MIT</li>
      <li>Blockly: Copyright Google LLC, ${apache}</li>
      <li>CodeMirror 5: Copyright (c) Marijn Haverbeke and others, MIT</li>
      <li>xterm.js, xterm-addon-fit: Copyright (c) The xterm.js authors, MIT</li>
    </ul>`;
  const mitBlock = `<pre style="white-space:pre-wrap;font-size:11px;line-height:1.4;
      color:var(--fg-1);margin:6px 0 0;">${mit}</pre>`;
  return (LANG === 'en') ? `
    <p style="margin-top:18px;"><b>License</b><br>
       PBC+ Studio by Jan Schulz, released under the ${gpl}.</p>
    <p><b>Software used</b></p>${liste}
    <details><summary style="cursor:pointer;">MIT License text</summary>${mitBlock}</details>
  ` : `
    <p style="margin-top:18px;"><b>Lizenz</b><br>
       PBC+ Studio von Jan Schulz, freigegeben unter der ${gpl}.</p>
    <p><b>Verwendete Software</b></p>${liste}
    <details><summary style="cursor:pointer;">Text der MIT-Lizenz</summary>${mitBlock}</details>
  `;
}

function showImpressumDialog() {
  const { overlay, dialog, close } = buildModalShell(t('Impressum'));
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.cssText = 'font-size:13.5px; line-height:1.6;';
  body.innerHTML = (LANG === 'en') ? `
    <p><b>Information pursuant to § 5 DDG</b></p>
    <p>Jan Schulz<br>Mondorfer Str. 28<br>53844 Troisdorf<br>Germany</p>
    <p><b>Contact</b><br>
       E-mail: <a class="imp-email" style="color:var(--accent);"></a></p>
    <p><b>VAT ID</b><br>
       VAT identification number pursuant to § 27a UStG: DE362029501</p>
    <p><b>Responsible for content</b> pursuant to § 18 (2) MStV:<br>
       Jan Schulz (address as above)</p>
    <p>You can also use the <a data-action="to-contact"
       style="color:var(--accent);cursor:pointer;text-decoration:underline;">contact
       form</a>.</p>
  ` : `
    <p><b>Angaben gemäß § 5 DDG</b></p>
    <p>Jan Schulz<br>Mondorfer Str. 28<br>53844 Troisdorf</p>
    <p><b>Kontakt</b><br>
       E-Mail: <a class="imp-email" style="color:var(--accent);"></a></p>
    <p><b>Umsatzsteuer-ID</b><br>
       Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE362029501</p>
    <p><b>Verantwortlich für den Inhalt</b> nach § 18 Abs. 2 MStV:<br>
       Jan Schulz (Anschrift wie oben)</p>
    <p>Du kannst auch das <a data-action="to-contact"
       style="color:var(--accent);cursor:pointer;text-decoration:underline;">Kontaktformular</a>
       nutzen.</p>
  `;
  body.insertAdjacentHTML('beforeend', lizenzHtml());
  // Assemble the e-mail address at runtime so it never appears as plain
  // text in the page source -- this keeps most spam-harvesting bots from
  // scraping it, without inconveniencing real visitors.
  const _u = 'info', _d2 = 'picoboy.de';
  const _addr = _u + '@' + _d2;
  const _emailEl = body.querySelector('.imp-email');
  if (_emailEl) {
    _emailEl.textContent = _addr;
    _emailEl.setAttribute('href', 'mailto:' + _addr);
  }
  dialog.appendChild(body);
  body.querySelector('[data-action="to-contact"]')
    ?.addEventListener('click', () => { close(); showContactDialog(); });
  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  const ok = document.createElement('button');
  ok.className = 'tb-btn primary';
  ok.textContent = t('Schließen');
  ok.addEventListener('click', close);
  foot.appendChild(ok);
  dialog.appendChild(foot);
  document.body.appendChild(overlay);
  setTimeout(() => ok.focus(), 0);
}

// Shared form renderer. `kind` is 'contact' or 'hardware'. Builds the
// fields, the honeypot, the open-timer, and the submit handler.
function showMessageForm(kind) {
  const isHw = (kind === 'hardware');
  const title = isHw ? t('Hardware-Wunsch')
                     : t('Kontakt');
  const { overlay, dialog, close } = buildModalShell(title, 440);
  const body = document.createElement('div');
  body.className = 'modal-body';
  body.style.cssText = 'font-size:13px; line-height:1.5;';

  const intro = isHw
    ? t('Dir fehlt ein Hardware-Modul (z.B. ein Sensor)? Beschreibe kurz, ' +
        'welches Modul du dir wünschst – am besten mit Name/Typ und einem ' +
        'Link zum Datenblatt, falls du einen hast.')
    : t('Schreib mir eine Nachricht. Wenn du eine Antwort möchtest, gib ' +
        'bitte deine E-Mail-Adresse an – sonst kann ich mich nicht ' +
        'zurückmelden.');

  const inputStyle = 'width:100%;padding:7px 9px;margin:4px 0 12px 0;' +
    'background:var(--bg-3);border:1px solid var(--border);border-radius:5px;' +
    'color:var(--fg-0);font-family:inherit;font-size:13px;box-sizing:border-box;';
  const msgLabel = isHw ? t('Gewünschtes Modul / Beschreibung')
                        : t('Nachricht');

  body.innerHTML =
    '<p>' + intro + '</p>' +
    '<label>' + t('Name') + '</label>' +
    '<input id="cf-name" type="text" autocomplete="name" style="' + inputStyle + '">' +
    '<label>' + t('E-Mail') + ' <span style="color:var(--fg-2);">' +
      t('(für eine Antwort)') + '</span></label>' +
    '<input id="cf-email" type="email" autocomplete="email" style="' + inputStyle + '">' +
    '<label>' + msgLabel + '</label>' +
    '<textarea id="cf-msg" rows="5" style="' + inputStyle + 'resize:vertical;"></textarea>' +
    // Honeypot: hidden from humans, tempting to bots. If filled -> spam.
    '<input id="cf-website" type="text" tabindex="-1" autocomplete="off" ' +
      'aria-hidden="true" style="position:absolute;left:-9999px;width:1px;' +
      'height:1px;opacity:0;">' +
    '<div id="cf-status" style="font-size:12px;min-height:16px;color:var(--fg-1);"></div>';
  dialog.appendChild(body);

  const foot = document.createElement('div');
  foot.className = 'modal-foot';
  const cancel = document.createElement('button');
  cancel.className = 'tb-btn';
  cancel.textContent = t('Abbrechen');
  cancel.addEventListener('click', close);
  const send = document.createElement('button');
  send.className = 'tb-btn primary';
  send.textContent = t('Senden');
  foot.appendChild(cancel);
  foot.appendChild(send);
  dialog.appendChild(foot);

  const openedAt = Date.now();
  const status = body.querySelector('#cf-status');
  const setStatus = (txt, kind2) => {
    status.textContent = txt;
    status.style.color = kind2 === 'bad' ? 'var(--bad)'
                       : kind2 === 'good' ? 'var(--good)'
                       : 'var(--fg-1)';
  };

  send.addEventListener('click', async () => {
    const name  = body.querySelector('#cf-name').value.trim();
    const email = body.querySelector('#cf-email').value.trim();
    const msg   = body.querySelector('#cf-msg').value.trim();
    const honeypot = body.querySelector('#cf-website').value;

    if (!msg) { setStatus(t('Bitte schreibe eine Nachricht.'), 'bad'); return; }

    // Forgot the e-mail? Ask before sending (contact form especially).
    if (!email) {
      const proceed = await confirmDialog(
        t('Keine E-Mail angegeben'),
        t('Du hast keine E-Mail-Adresse angegeben. Hast du sie vielleicht ' +
          'vergessen? Ohne E-Mail kann ich dir nicht antworten.'),
        t('Trotzdem senden'), t('Zurück'));
      if (!proceed) { body.querySelector('#cf-email').focus(); return; }
    }
    // Basic e-mail sanity check if one was given.
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus(t('Die E-Mail-Adresse sieht nicht gültig aus.'), 'bad');
      return;
    }

    send.disabled = true; cancel.disabled = true;
    setStatus(t('Wird gesendet…'));
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          type: kind,
          name, email, message: msg,
          website: honeypot,                       // honeypot
          elapsed: String(Date.now() - openedAt),  // time trap
        }).toString(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setStatus(t('Danke! Deine Nachricht wurde gesendet.'), 'good');
        send.style.display = 'none';
        cancel.textContent = t('Schließen');
        cancel.disabled = false;
      } else {
        setStatus((data && data.error)
          ? data.error
          : t('Senden fehlgeschlagen. Bitte später erneut versuchen.'), 'bad');
        send.disabled = false; cancel.disabled = false;
      }
    } catch (e) {
      setStatus(t('Senden fehlgeschlagen. Läuft die Seite auf einem Server ' +
                  'mit PHP?'), 'bad');
      send.disabled = false; cancel.disabled = false;
    }
  });

  document.body.appendChild(overlay);
  setTimeout(() => body.querySelector('#cf-name').focus(), 0);
}

function showContactDialog()      { showMessageForm('contact'); }
function showHardwareWishDialog() { showMessageForm('hardware'); }

// Small yes/no dialog (Promise<boolean>). Used for the "forgot email?"
// prompt. Mirrors alertDialog's styling.
function confirmDialog(title, message, yesLabel, noLabel) {
  return new Promise((resolve) => {
    const { overlay, dialog, close } = buildModalShell(title || t('Bitte bestätigen'));
    const body = document.createElement('div');
    body.className = 'modal-body';
    body.style.cssText = 'font-size:13px; line-height:1.5;';
    body.textContent = message || '';
    dialog.appendChild(body);
    const foot = document.createElement('div');
    foot.className = 'modal-foot';
    const no = document.createElement('button');
    no.className = 'tb-btn';
    no.textContent = noLabel || t('Abbrechen');
    no.addEventListener('click', () => { close(); resolve(false); });
    const yes = document.createElement('button');
    yes.className = 'tb-btn primary';
    yes.textContent = yesLabel || 'OK';
    yes.addEventListener('click', () => { close(); resolve(true); });
    foot.appendChild(no); foot.appendChild(yes);
    dialog.appendChild(foot);
    document.body.appendChild(overlay);
    setTimeout(() => yes.focus(), 0);
  });
}

// Wire the footer links.
const _fcEl = document.getElementById('footer-contact');
const _fiEl = document.getElementById('footer-impressum');
if (LANG === 'en') {
  if (_fcEl) _fcEl.textContent = t('Kontakt');
  if (_fiEl) _fiEl.textContent = t('Impressum');
}
_fcEl?.addEventListener('click', () => showContactDialog());
_fiEl?.addEventListener('click', () => showImpressumDialog());

document.getElementById('btn-test').addEventListener('click', async () => {
  const code = fullProgram();
  if (!code.trim()) { toast(t('Kein Code zum Ausführen.'), 'warn'); return; }
  // Make sure the selected target is connected. For the emulator we can
  // bring it up automatically; for the real device the user must have
  // connected over USB first (we can't open a port without a gesture-
  // driven chooser, and Testen shouldn't surprise-prompt for one).
  if (runTarget === 'emulator') {
    if (deviceMode !== 'emulator') {
      if (window.__connectEmulator) await window.__connectEmulator();
    }
  } else {
    if (!serialPort || deviceMode !== 'serial') {
      toast(t('Erst verbinden.'), 'warn');
      return;
    }
  }
  // Text mode: warn about missing imports and unknown names first.
  if (typeof pyVorpruefungZeigen === 'function') pyVorpruefungZeigen();
  if (!serialPort)  { toast(t('Erst verbinden.'),  'warn'); return; }
  // Block mode only: catch the common foot-guns (empty bodies,
  // missing sprite images) before any code reaches the device.
  // In text mode the user owns the file; we don't second-guess them.
  if (!isTextMode) {
    const ok = await preflightChecks();
    if (!ok) return;
  }
  term.write('\r\n\x1b[36m-- ' + t('Testlauf') + ' --\x1b[0m\r\n');
  // Reset prelude: bring the device back to a fresh state before
  // running. Without this, leftover state from the previous run
  // (sprites in Sprite._visible, Sprite._background pointing at a
  // dead canvas, a backgrounded turtle module, etc.) can leak into
  // the new run and produce mystery bugs that look like the program
  // is broken when really only the order-of-runs is.
  //
  // We don't use machine.soft_reset() because that drops the USB
  // CDC connection and forces a manual reconnect. Instead we
  // selectively wipe the module-level state we know about and
  // re-import on a clean slate.
  //
  // Note: we use bare `except:` rather than `except Exception:`
  // because the MicroPython.wasm build's exception hierarchy doesn't
  // always parent ImportError under Exception (it's a pyscript thing).
  // The bare-except is fine here -- the bodies are tiny single
  // assignments where any error means "skip this cleanup step".
  const prelude =
    // A Ctrl-C during boot (sent to stop main.py) can interrupt the
    // device's own `import pbc` half-way, leaving a partially-built
    // module cached in sys.modules. A later `import pbc` would then
    // reuse that broken module. Drop any cached pbc/turtle first so the
    // import below rebuilds them cleanly from source. Wrapped in
    // try/except because on a clean boot they may not be cached yet.
    // Only private names (__s, __p, __t), deleted again at the end: the
    // prelude must not hand the program a `pbc` or `sys` it didn't import
    // itself (in text mode a missing `import pbc` has to fail, as in
    // any Python).
    'import sys as __s\n' +
    'try:\n' +
    '    if "pbc" in __s.modules: del __s.modules["pbc"]\n' +
    '    if "turtle" in __s.modules: del __s.modules["turtle"]\n' +
    'except:\n' +
    '    pass\n' +
    'import pbc as __p\n' +
    'try:\n' +
    '    __p.Sprite._visible.clear()\n' +
    '    __p.Sprite._background = None\n' +
    'except:\n' +
    '    pass\n' +
    'try:\n' +
    '    __p._set_active_canvas(None)\n' +
    'except:\n' +
    '    pass\n' +
    'try:\n' +
    '    import turtle as __t\n' +
    '    __t._canvas = None\n' +
    '    del __t\n' +
    'except:\n' +
    '    pass\n' +
    'try:\n' +
    '    __p.fill(__p.BLACK)\n' +
    'except:\n' +
    '    pass\n' +
    'try:\n' +
    '    __p.tone_off()\n' +
    'except:\n' +
    '    pass\n' +
    'del __s, __p\n';
  // The emulator receives the same prelude; it needs its length to map
  // traceback lines back to the editor.
  window.__runPreludeLines = prelude.split('\n').length - 1;
  let r;
  window.__testlaufAktiv = true;
  window.__stopImTestlauf = false;
  try {
    r = await runOnDevice(prelude + code, 60000, { stream: true });
  } finally {
    window.__runPreludeLines = 0;
    window.__testlaufAktiv = false;
  }
  if (!r) return;
  // Stopped with ■: the KeyboardInterrupt is no error -- no traceback, no
  // hints. Silence the speaker without typing code into the terminal.
  if (window.__stopImTestlauf && /KeyboardInterrupt/.test(r.stderr || '')) {
    window.__stopImTestlauf = false;
    term.write('\x1b[36m-- ' + t('Testlauf beendet') + ' --\x1b[0m\r\n');
    try { await runOnDevice('import pbc\npbc.tone_off()\n', 5000); } catch (_) {}
    return;
  }
  // stdout was streamed live -- don't write it again. stderr is
  // collected though (it's typically a single traceback that arrives
  // all at once at the end), so paint it red after stdout.
  if (r.stderr) {
    let errText = r.stderr, lineOk = false;
    if (isTextMode) {
      const pre = prelude.split('\n').length - 1;
      const res = remapTraceback(errText, (n) => (n > pre ? n - pre : null));
      errText = res.text; lineOk = res.ok;
    }
    term.write('\x1b[31m' + errText.replace(/\n/g,'\r\n') + '\x1b[0m');
    if (!lineOk) maybeWarnLineNumber(r.stderr);
    // Friendly post-mortem hints: scan the traceback for common
    // error patterns and pop up a dialog with a sentence in plain
    // German/English explaining what went wrong and how to fix it.
    // The raw traceback stays in the terminal for anyone who wants
    // to dig in.
    await showFriendlyErrorHint(r.stderr);
  }
  term.write('\r\n\x1b[36m-- ' + t('Testlauf beendet') + ' --\x1b[0m\r\n');
});

// Inspect a traceback and pop up a tailored hint for whichever
// common error category matched. Returns silently if nothing matches
// -- the traceback in the terminal is enough for advanced students.
// If a traceback contains a "line N" reference, write a short note to the
// terminal that the number refers to the internally transformed program,
// not the line the student wrote. We don't remap the number (the async
// transform shifts lines non-linearly, and in block mode there are no
// source lines to point at) -- we just make sure nobody chases a wrong
// line number. Only fires when there actually is a line number.
function maybeWarnLineNumber(stderr) {
  if (!stderr || !/line\s+\d+/i.test(stderr)) return;
  const note = t('Hinweis: Die Zeilennummer oben bezieht sich auf den ' +
    'intern umgewandelten Code, nicht auf deine geschriebene Zeile. ' +
    'Nutze die Fehlerart und die Erklärung als Wegweiser.');
  try { term.write('\x1b[33m' + note + '\x1b[0m\r\n'); } catch (_) {}
}

async function showFriendlyErrorHint(stderr) {
  // In text mode the student writes Python: name the keyword ("if"),
  // not the German block label ("falls").
  const tx = (s) => (isTextMode
    ? t(s).replace(/"falls"/g, '"if"').replace(/"Länge der Liste"/g, '"len(liste)"')
          .replace(/"Text\(\.\.\.\)"/g, '"str(...)"').replace(/"Zahl\(\.\.\.\)"/g, '"int(...)"')
    : t(s));
  if (!stderr) return;
  if (stderr.indexOf('MemoryError') >= 0) {
    await alertDialog(tx('Nicht genug Speicher'),
      tx('Das Programm hat den Speicher des Geräts überfüllt. ' +
        'Häufige Ursachen:') + '\n\n' +
      '• ' + tx('Zu viele Bilder oder Sprites gleichzeitig aktiv.') + '\n' +
      '• ' + tx('Sehr lange Listen im Programm.') + '\n' +
      '• ' + tx('Mehrere Canvas-Objekte angelegt (jedes belegt rund 134 KB).') +
      '\n\n' +
      tx('Probiere weniger Bilder gleichzeitig zu benutzen, oder lege ' +
        'nur ein Canvas an.'));
    return;
  }
  if (stderr.indexOf('ZeroDivisionError') >= 0) {
    await alertDialog(tx('Division durch Null'),
      tx('Du hast versucht, durch 0 zu teilen oder Modulo 0 zu rechnen. ' +
        'Pass auf, dass der Teiler nicht 0 werden kann – baue zum ' +
        'Beispiel eine "falls"-Abfrage davor ein.'));
    return;
  }
  if (/IndexError: string index/.test(stderr)) {
    await alertDialog(tx('Zeichen-Position außerhalb'),
      tx('Du hast ein Zeichen an einer Stelle angesprochen, die es im Text ' +
        'nicht gibt. Positionen gehen von 0 bis Länge-1.'));
    return;
  }
  if (stderr.indexOf('IndexError') >= 0) {
    await alertDialog(tx('Listen-Position außerhalb'),
      tx('Du hast eine Stelle in einer Liste angesprochen, die es nicht ' +
        'gibt. Listen-Positionen gehen von 0 bis Länge-1. Prüfe mit ' +
        '"Länge der Liste" wie viele Elemente die Liste wirklich hat.'));
    return;
  }
  // ValueError happens most often when int(input(...)) gets a non-
  // numeric input. We catch the generic case and give a specific
  // hint if "invalid literal for int" appears.
  if (stderr.indexOf('ValueError') >= 0) {
    const intCast = /invalid literal for int|invalid syntax for integer/.test(stderr);
    await alertDialog(intCast ? tx('Eingabe ist keine Zahl') : tx('Ungültiger Wert'),
      intCast
        ? tx('Das Programm hat eine Zahl erwartet, aber etwas anderes ' +
            'bekommen (z.B. Buchstaben). Tippe nur Ziffern ein.')
        : /not in sequence|not in list/.test(stderr)
          ? tx('Das gesuchte Element ist nicht in der Liste. Prüfe vorher mit ' +
              '"in", ob es darin vorkommt.')
          : /empty sequence|arg is an empty/.test(stderr)
            ? tx('Die Liste ist leer – davon gibt es kein Minimum oder Maximum.')
            : tx('Ein Wert passt nicht zu dieser Funktion. Schau in die rote ' +
                'Fehlermeldung im Terminal, um zu sehen welcher.'));
    return;
  }
  if (stderr.indexOf('NameError') >= 0) {
    const m = stderr.match(/name '([^']+)' (?:is not defined|isn't defined)/);
    const which = m ? m[1] : null;
    // Text mode: a module name usually means the import line is missing.
    if (isTextMode && /^(pbc|time|random|math|turtle|os)$/.test(which || '')) {
      await alertDialog(tx('Unbekannter Name'),
        tx('Das Programm kennt den Namen "') + which + '" ' + tx('nicht.') + ' ' +
        (LANG === 'en' ? 'Add the line  import ' + which + '  at the top of your program.'
                       : 'Schreibe ganz oben in dein Programm die Zeile  import ' + which));
      return;
    }
    await alertDialog(tx('Unbekannter Name'),
      (which
        ? tx('Das Programm kennt den Namen "') + which + '" ' +
          tx('nicht.')
        : tx('Das Programm kennt einen Namen nicht.')) + ' ' +
      tx('Häufige Ursachen: Variable noch nicht angelegt, Sprite ' +
        'gelöscht, Funktion umbenannt.'));
    return;
  }
  if (/RecursionError|maximum recursion depth/.test(stderr)) {
    await alertDialog(tx('Endlose Selbst-Aufrufe'),
      tx('Eine Funktion ruft sich selbst immer wieder auf. Baue eine ' +
        'Abbruch-Bedingung mit "falls" ein, damit der Aufruf-Stapel ' +
        'nicht überläuft.'));
    return;
  }
  // IndentationError is a subclass of SyntaxError, so check it first.
  if (stderr.indexOf('IndentationError') >= 0) {
    await alertDialog(tx('Einrückung stimmt nicht'),
      tx('Python achtet auf die Einrückung (die Leerzeichen am ' +
        'Zeilenanfang). Innerhalb von "falls", Schleifen und Funktionen ' +
        'müssen die Zeilen gleich weit eingerückt sein. Prüfe, ob eine ' +
        'Zeile zu weit links oder rechts steht.'));
    return;
  }
  if (stderr.indexOf('SyntaxError') >= 0) {
    await alertDialog(tx('Schreibfehler im Code'),
      tx('Python kann eine Zeile nicht verstehen. Häufige Ursachen: ein ' +
        'fehlender Doppelpunkt ":" am Ende von "falls"/Schleife, eine ' +
        'nicht geschlossene Klammer oder ein fehlendes ' +
        'Anführungszeichen bei einem Text.'));
    return;
  }
  if (stderr.indexOf('AttributeError') >= 0) {
    const m = stderr.match(/'([^']+)' object has no attribute '([^']+)'/);
    await alertDialog(tx('Unbekannte Funktion oder Eigenschaft'),
      (m
        ? tx('Ein Objekt vom Typ "') + m[1] + tx('" hat kein "') + m[2] + '". '
        : '') +
      tx('Vermutlich ein Tippfehler im Namen einer Funktion oder ' +
        'Eigenschaft, oder das Objekt ist nicht das, was du denkst.'));
    return;
  }
  // TypeError: very common when mixing text and numbers, or calling
  // something with the wrong number of arguments.
  if (stderr.indexOf('TypeError') >= 0) {
    let hint = tx('Ein Wert hat den falschen Typ für diese Operation.');
    if (/unsupported operand|can't convert|must be str|not.*str/.test(stderr) ||
        /int.*str|str.*int/.test(stderr)) {
      hint = tx('Du rechnest oder verbindest vermutlich Text mit Zahlen. ' +
               'Wandle Zahlen mit "Text(...)" in Text um, bevor du sie mit ' +
               '+ an Text hängst – oder mit "Zahl(...)" andersherum.');
    } else if (/argument|positional|takes.*were given/.test(stderr)) {
      hint = tx('Eine Funktion wurde mit der falschen Anzahl an Werten ' +
               'aufgerufen. Prüfe, wie viele Werte die Funktion erwartet.');
    } else if (/not callable|callable/.test(stderr) && /object/.test(stderr) &&
               /callable/.test(stderr)) {
      hint = tx('Du hast etwas mit "()" aufgerufen, das keine Funktion ist ' +
               '– vielleicht eine Variable mit gleichem Namen wie eine ' +
               'Funktion.');
    } else if (/subscriptable/.test(stderr)) {
      hint = tx('Du hast "[...]" auf etwas angewandt, das keine Liste oder ' +
               'kein Text ist.');
    }
    await alertDialog(tx('Falscher Typ'), hint);
    return;
  }
  if (/OSError.*(ENOENT|Errno 2\b)/.test(stderr)) {
    await alertDialog(tx('Datei nicht gefunden'),
      tx('Das Programm wollte eine Datei öffnen, die es nicht gibt. ' +
        'Prüfe den Dateinamen – oder schreibe die Datei zuerst. Ein Bild ' +
        'muss vorher mit „Dateien → Bilder verwalten…“ hochgeladen sein.'));
    return;
  }
  if (stderr.indexOf('KeyError') >= 0) {
    await alertDialog(tx('Schlüssel nicht gefunden'),
      tx('Du hast in einem Dictionary einen Schlüssel angesprochen, den ' +
        'es nicht gibt. Prüfe die Schreibweise des Schlüssels, oder ob ' +
        'er überhaupt schon hinzugefügt wurde.'));
    return;
  }
  if (/ModuleNotFoundError|ImportError/.test(stderr)) {
    const m = stderr.match(/no module named '([^']+)'/);
    await alertDialog(tx('Modul nicht gefunden'),
      (m
        ? tx('Das Modul "') + m[1] + tx('" gibt es hier nicht. ')
        : '') +
      tx('Manche Module funktionieren nur auf dem echten PBC+, nicht im ' +
        'Emulator. Prüfe außerdem die Schreibweise nach "import".'));
    return;
  }
  if (/OverflowError/.test(stderr)) {
    await alertDialog(tx('Zahl zu groß'),
      tx('Eine Zahl ist zu groß geworden für die Berechnung. Das passiert ' +
        'oft bei sehr hohen Potenzen oder einer Schleife, die eine Zahl ' +
        'immer weiter verdoppelt.'));
    return;
  }
  // No friendly mapping -- silently skip. The raw stderr is already
  // in the terminal.
}

// Stop interrupts whatever's running on the device. Sends two Ctrl-C
// bytes (raw 0x03) -- the first kicks the REPL out of any blocking
// call, the second forces a KeyboardInterrupt at the Python level
// even if the first arrived during a critical section. Works equally
// well for Testen-runs (which are in raw REPL) and for soft-booted
// programs spinning in main.py.
document.getElementById('btn-stop').addEventListener('click', async () => {
  const isEmu = (deviceMode === 'emulator') ||
                (serialPort && serialPort.__emulator);
  if (!isEmu && !serialPort) { toast(t('Nicht verbunden.'), 'warn'); return; }
  if (isEmu) {
    // emulator: stop flag, or terminate a loop that never pauses
    if (window.emuWorkerLaeuft && window.emuWorkerLaeuft()) {
      window.emuWorkerStopGemeldet = true;
      term.write('\r\n\x1b[33m-- ' + t('gestoppt') + ' --\x1b[0m\r\n');
    }
    if (window.emuWorkerStop) await window.emuWorkerStop();
    toast(t('Programm gestoppt'), 'good');
    return;
  }
  if (serialWriter) {
    try {
      // Phase 1: KeyboardInterrupt the running program.
      await serialWriter.write(new Uint8Array([0x03, 0x03]));
      term.write('\r\n\x1b[33m-- ' + t('Stop gesendet') + ' --\x1b[0m\r\n');
      toast(t('Programm gestoppt'), 'good');
      // A Testen run silences the speaker itself once it has ended
      // (see the btn-test handler) -- nothing to type into the REPL.
      if (window.__testlaufAktiv) { window.__stopImTestlauf = true; return; }
      // Phase 2: silence the speaker. The student might have hit Stop
      // while pbc.tone(...) was still going -- Ctrl-C unwinds the
      // Python program but the PWM keeps running until something
      // clears it. We give the REPL a moment to be ready, then
      // schedule a tiny "no_tone" call. Failures are silent: this is
      // a courtesy, not a correctness requirement.
      setTimeout(async () => {
        try {
          await sendRaw('\r\nimport pbc\r\ntry:\r\n  pbc.tone_off()\r\nexcept Exception:\r\n  pass\r\n');
        } catch (_) {}
      }, 200);
    } catch (e) {
      toast(t('Stop fehlgeschlagen:') + ' ' + e.message, 'bad');
    }
  }
});

document.getElementById('btn-upload').addEventListener('click', async () => {
  if (!(await ensureTargetReady())) return;
  openSaveDialog();
});

// Open the save-to-device modal, populate the file list, and warn
// when saving block-mode programs that can't be round-tripped back
// into the block editor.
async function openSaveDialog() {
  cancelBlocklyGesture(); document.getElementById('save-modal').classList.add('show');
  document.getElementById('save-block-wahl').style.display =
    isTextMode ? 'none' : '';
  document.getElementById('save-art-pbcp').innerHTML =
    '<strong>' + t('Block-Projekt (.pbcp)') + '</strong>: ' +
    t('startet im Startmenü des PicoBoy und lässt sich in PBC+ Studio wieder als Blöcke öffnen.');
  document.getElementById('save-art-py').innerHTML =
    '<strong>' + t('Python-Programm (.py)') + '</strong>: ' +
    t('nur der Python-Code, zum Beispiel zum Weiterschreiben im Text-Modus. Lässt sich nicht wieder als Blöcke öffnen.');
  // Blocks: the block project is the default, it can do everything.
  document.querySelector('input[name="save-art"][value="' +
                         (isTextMode ? '.py' : '.pbcp') + '"]').checked = true;
  // Suggest a default name. If we're in text mode and the user just
  // loaded something from the device, that filename is the obvious
  // default.
  const nameField = document.getElementById('save-name');
  if (!nameField.value || nameField.value === 'programm.py') {
    // the name the program was last saved/opened under (Dateien menu)
    nameField.value = (typeof aktuellerDateiname === 'string' && aktuellerDateiname
                       ? aktuellerDateiname : 'programm') + saveEndung();
  }
  // the choice from last time may differ from the ending in the field
  nameField.value = nameField.value.replace(/\.(py|pbcp)$/i, '') + saveEndung();
  nameField.focus();
  nameField.select();
  await refreshSaveDeviceList();
}

// Ending chosen in the save dialog: .py, or .pbcp for a block project.
function saveEndung() {
  return document.querySelector('input[name="save-art"]:checked').value;
}

document.querySelectorAll('input[name="save-art"]').forEach(r => r.addEventListener('change', () => {
  const feld = document.getElementById('save-name');
  feld.value = feld.value.trim().replace(/\.(py|pbcp)$/i, '') + saveEndung();
  refreshSaveDeviceList();
}));

async function refreshSaveDeviceList() {
  const list = document.getElementById('save-device-list');
  list.innerHTML = '<div style="color:var(--fg-2);text-align:center;' +
                   'padding:24px;">' + t('Lade…') + '</div>';
  const alle = runTarget === 'emulator' ? await listEmuFilesRaw() : await listDeviceFilesRaw();
  if (!alle) {
    list.innerHTML = '<div style="color:var(--bad);padding:16px;">' +
      t('Auflisten fehlgeschlagen.') + '</div>';
    return;
  }
  const endung = saveEndung();
  const files = alle.filter(f => f.name.toLowerCase().endsWith(endung));

  if (files.length === 0) {
    list.innerHTML = '<div style="color:var(--fg-2);padding:16px;">' +
      t('Noch keine %1-Dateien auf dem Gerät.').replace('%1', '<code>' + endung + '</code>') + '</div>';
    return;
  }

  list.innerHTML = '';
  files.forEach(f => {
    const row = document.createElement('div');
    row.style.cssText =
      'display:flex;align-items:center;padding:8px 10px;' +
      'border-radius:4px;cursor:pointer;gap:10px;' +
      'border:1px solid transparent;';
    row.onmouseover = () => row.style.background = 'var(--bg-2)';
    row.onmouseout  = () => row.style.background = '';
    row.innerHTML =
      `<span style="flex:1;color:var(--fg-0);font-family:` +
        `ui-monospace,monospace;overflow:hidden;` +
        `text-overflow:ellipsis;white-space:nowrap;">${f.name}</span>` +
      `<span style="color:var(--fg-2);font-size:11px;` +
        `font-family:ui-monospace,monospace;">${f.size} B</span>`;
    row.addEventListener('click', () => {
      // Single click = adopt the name into the input field. Saving
      // still requires an explicit click on the confirm button so a
      // misclick can't blow away a file.
      document.getElementById('save-name').value = f.name;
      document.getElementById('save-name').focus();
    });
    list.appendChild(row);
  });
}

document.getElementById('save-cancel').addEventListener('click', () => {
  document.getElementById('save-modal').classList.remove('show');
});
document.getElementById('save-modal').addEventListener('click', (e) => {
  if (e.target.id === 'save-modal')
    document.getElementById('save-modal').classList.remove('show');
});

document.getElementById('save-confirm').addEventListener('click', saveToDevice);
document.getElementById('save-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveToDevice();
});

// The start menu runs block projects (.pbcp) since the firmware of
// November 2026; pbc._pbcp_code marks it. With an older firmware on
// the connected PBC+, tell the student (terminal) and return the
// text, else null. The emulator has no start menu: nothing to say.
async function pbcpFirmwareHinweis() {
  if (runTarget === 'emulator' || !serialPort) return null;
  const r = await runOnDevice(
    "import pbc\nprint('PBCP', hasattr(pbc, '_pbcp_code'))\n", 5000);
  if (!r || r.stderr || !/PBCP False/.test(r.stdout || '')) return null;
  const hinweis = t('Auf deinem PBC+ ist noch eine ältere Firmware. Block-Projekte erscheinen dort erst nach einem Update im Startmenü: Dateien → MicroPython installieren…');
  term.write('\r\n\x1b[33m-- ' + hinweis + ' --\x1b[0m\r\n');
  return hinweis;
}

async function saveToDevice() {
  if (!(await ensureTargetReady())) return;
  let name = document.getElementById('save-name').value.trim();
  if (!name) { toast(t('Dateiname fehlt'), 'warn'); return; }
  const endung = saveEndung();
  name = name.replace(/\.(py|pbcp)$/i, '') + endung;

  // Warn when overwriting an existing file -- we can see the list
  // already, so this is a cheap UX win.
  const existing = document.querySelectorAll('#save-device-list span');
  let overwrite = false;
  existing.forEach(s => {
    if (s.textContent === name) overwrite = true;
  });
  if (overwrite &&
      !confirm(t('„%1“ gibt es schon auf dem PBC+. Überschreiben?').replace('%1', name))) {
    return;
  }

  document.getElementById('save-modal').classList.remove('show');

  if (endung === '.pbcp') {
    // uploadBlob sends in chunks: a project with sprites is too big
    // for one Python literal on the device.
    if (await uploadBlob(new Blob([projektText()]), name)) {
      setzeDateiname(name);
      toast(name + ' ' + t('auf PBC+ gespeichert'), 'good');
      term.write('\r\n\x1b[33m-- ' + t('Dein Block-Projekt ist auf dem PicoBoy gespeichert. Du startest es im Startmenü (Eintrag mit Blocksymbol) und öffnest es in PBC+ Studio mit „Vom PBC+…“ im Menü Dateien wieder als Blöcke.') + ' --\x1b[0m\r\n');
      await pbcpFirmwareHinweis();
    }
    return;
  }
  const code = fullProgram();
  if (runTarget === 'emulator') {
    await uploadBlob(new Blob([code]), name);
    return;
  }
  const upload = `
with open(${pyStringLit(name)}, 'w') as f:
    f.write(${pyStringLit(code)})
print('geschrieben:', ${pyStringLit(name)}, len(${pyStringLit(code)}), 'Bytes')
`;
  term.write('\r\n\x1b[36m-- ' + t('Speichern:') + ' ' + name + ' --\x1b[0m\r\n');
  const r = await runOnDevice(upload, 30000, { stream: true });
  if (r && !r.stderr) {
    // stdout was streamed live already.
    toast(name + ' ' + t('auf PBC+ gespeichert'), 'good');
  } else if (r) {
    term.write('\x1b[31m' + r.stderr.replace(/\n/g,'\r\n') + '\x1b[0m');
    toast(t('Speichern fehlgeschlagen'), 'bad');
  }
}

const pyEscape = (s) =>
  s.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\n/g,'\\n')
   .replace(/\r/g,'\\r').replace(/\t/g,'\\t');
const pyStringLit = (s) => "'" + pyEscape(s) + "'";

