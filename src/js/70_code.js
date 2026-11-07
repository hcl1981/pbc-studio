/* =====================================================================
 * Code generation + view
 * ===================================================================== */

// Make sure the workspace always has exactly one "Beim Start" block,
// and that the user can't drag it away, accidentally delete it, or
// duplicate it via the right-click menu. Called after any operation
// that might disturb the workspace (load, new, open).
function ensureStartBlock() {
  if (!workspace) return;
  let start = workspace.getTopBlocks(false).find(b => b.type === 'pbc_when_start');
  if (!start) {
    // The workspace doesn't have one -- create it from scratch.
    start = workspace.newBlock('pbc_when_start');
    start.initSvg();
    start.render();
    start.moveBy(60, 40);
  }
  start.setDeletable(false);
  start.setMovable(true);    // user can still reposition it
  start.setEditable(true);
  // No right-click context menu on the root block. The default menu
  // offers "duplicate" (would give us a forbidden second start
  // block), "delete" (forbidden), and "external inputs" (layout
  // vandalism) -- none of which are appropriate for a fixed program
  // entry point. In Blockly 12 the older `contextMenu = false` flag
  // is ignored on a per-block basis; the supported way is to attach
  // a customContextMenu callback that empties the options array.
  start.contextMenu = false;
  start.customContextMenu = function(options) {
    // Splice in place so the array passed to us is left empty.
    options.length = 0;
  };
}

// Walk a function-def block's body and collect the Python identifiers
// of every variable it assigns to (via variables_set). Used to emit
// `global x, y` at the top of the function body so Python doesn't
// turn the function-local "var = var + 1" pattern into an
// UnboundLocalError.
function collectWrittenVariableNames(funcBlock) {
  const bodyInput = funcBlock.getInput && funcBlock.getInput('BODY');
  if (!bodyInput || !bodyInput.connection) return [];
  const first = bodyInput.connection.targetBlock();
  if (!first) return [];
  const names = new Set();
  let nameType;
  try {
    nameType = (Blockly.Names && Blockly.Names.NameType)
      ? Blockly.Names.NameType.VARIABLE
      : 'VARIABLE';
  } catch (_) { nameType = 'VARIABLE'; }
  function visit(b) {
    while (b) {
      if (b.type === 'variables_set') {
        const varId = b.getFieldValue('VAR');
        const v = workspace.getVariableMap().getVariableById(varId);
        if (v) {
          let safe = v.name;
          try {
            if (PY.nameDB_ && typeof PY.nameDB_.getName === 'function') {
              safe = PY.nameDB_.getName(v.name, nameType);
            }
          } catch (_) {}
          names.add(safe);
        }
      }
      // math_change is the "increase x by 1" block in Blockly's
      // standard library -- it also writes to its variable. list_set
      // rebinds a list name the same way. (append / pop / ... only
      // mutate the list object and need no global.)
      if (b.type === 'math_change' || b.type === 'list_set') {
        const varId = b.getFieldValue('VAR');
        const v = workspace.getVariableMap().getVariableById(varId);
        if (v) {
          let safe = v.name;
          try {
            if (PY.nameDB_ && typeof PY.nameDB_.getName === 'function') {
              safe = PY.nameDB_.getName(v.name, nameType);
            }
          } catch (_) {}
          names.add(safe);
        }
      }
      // Recurse into nested statement inputs (if/else, loops, ...).
      if (b.inputList) {
        for (const inp of b.inputList) {
          if (inp.connection && inp.connection.targetBlock &&
              inp.type === 3 /* NEXT_STATEMENT */) {
            visit(inp.connection.targetBlock());
          }
        }
      }
      b = b.getNextBlock ? b.getNextBlock() : null;
    }
  }
  visit(first);
  return [...names];
}

// Remove one level of leading indent (whatever statementToCode used,
// typically 2 spaces in MicroPython's python generator) from every
// line. Used when promoting a body to module top-level.
function dedent(code) {
  if (!code) return code;
  const lines = code.split('\n');
  // Find the common leading whitespace of all non-empty lines, but
  // cap at the indent of the first non-empty line -- so a deeper-
  // indented nested block doesn't drag everything else over.
  let prefix = null;
  for (const line of lines) {
    if (!line.trim()) continue;
    const m = line.match(/^(\s*)/)[1];
    if (prefix === null || m.length < prefix.length) prefix = m;
    break;   // first non-empty line sets the cap
  }
  if (!prefix) return code;
  return lines.map(l => l.startsWith(prefix) ? l.slice(prefix.length) : l)
              .join('\n');
}

// A block body that holds only "Kommentar" blocks becomes a suite of
// comment lines, which Python rejects ("expected an indented block").
// Add a `pass` after every block header whose body is comments only.
// "Canvas anlegen" inside a function assigns the canvas variable. Without
// a `global` line Python makes it local to that function: the function
// draws fine, but the main program later fails with a NameError far
// away from the cause. Add the canvas name to the function's globals.
function declareCanvasGlobal(code) {
  const cn = canvasName();
  const lines = code.split('\n');
  const assign = new RegExp('^\\s+' + cn + '\\s*=\\s*pbc\\.Canvas\\(');
  for (let i = 0; i < lines.length; i++) {
    if (!/^def\s+\w+\s*\(.*\):\s*$/.test(lines[i])) continue;
    let end = i + 1;
    while (end < lines.length && (lines[end] === '' || /^\s/.test(lines[end]))) end++;
    if (!lines.slice(i + 1, end).some((l) => assign.test(l))) continue;
    const first = i + 1;
    const ind = ((lines[first] || '').match(/^\s*/) || ['    '])[0] || '    ';
    const g = (lines[first] || '').match(/^(\s*)global\s+(.*)$/);
    if (g) {
      const names = g[2].split(',').map((n) => n.trim());
      if (!names.includes(cn)) lines[first] = g[1] + 'global ' + names.concat(cn).join(', ');
    } else {
      lines.splice(first, 0, ind + 'global ' + cn);
    }
  }
  return lines.join('\n');
}

function fillEmptySuites(code) {
  const lines = code.split('\n');
  const indentOf = (l) => l.match(/^\s*/)[0].length;
  const after = {};            // line index -> 'pass' line to add after it
  for (let i = 0; i < lines.length; i++) {
    const head = lines[i];
    if (!/:\s*(#.*)?$/.test(head) || /^\s*#/.test(head)) continue;
    const ind = indentOf(head);
    let last = i, onlyComments = true, bodyIndent = ' '.repeat(ind + 4);
    for (let j = i + 1; j < lines.length; j++) {
      const l = lines[j];
      if (!l.trim()) continue;
      if (indentOf(l) <= ind) break;
      if (!/^\s*#/.test(l)) { onlyComments = false; break; }
      if (last === i) bodyIndent = l.match(/^\s*/)[0];
      last = j;
    }
    if (onlyComments) after[last] = bodyIndent + 'pass';
  }
  const out = [];
  lines.forEach((l, k) => { out.push(l); if (after[k]) out.push(after[k]); });
  return out.join('\n');
}

function generatedCode() {
  // The workspace always contains exactly one "Beim Start" block,
  // pinned in place via setDeletable(false). Its body is the entire
  // main program. Anything else on the workspace -- stray blocks the
  // user hasn't connected up yet -- is silently ignored, EXCEPT for
  // top-level pbc_method_def blocks, which become Python def's.
  const top = workspace.getTopBlocks(true);
  const startBlock = top.find(b => b.type === 'pbc_when_start');
  const methodDefs = top.filter(b =>
    b.type === 'pbc_method_def' || b.type === 'pbc_method_def_return');

  if (!startBlock) {
    return '# (Der "Beim Start"-Block fehlt; bitte Seite neu laden.)\n';
  }

  // Initialise Blockly's Python generator. This rebuilds the internal
  // name database -- the mapping from Blockly's internal variable IDs
  // to legal Python identifiers. Without it, variables_set emits an
  // empty line (the name can't be resolved) and variables_get returns
  // null, which the standard logic_compare generator then substitutes
  // with the literal `False` -- so `if wert == 0:` collapses to
  // `if False:` and the matching assignment vanishes entirely.
  //
  // workspaceToCode() does init/finish automatically; statementToCode
  // alone does not. We mirror its lifecycle by hand below.
  //
  // Defensive: this runs on every workspace change, including from
  // inside VAR_CREATE listeners while the variable is still mid-
  // registration. If init throws on a half-built state, we fall back
  // to the previous (slightly broken) behaviour instead of crashing
  // the whole listener chain -- otherwise downstream listeners (like
  // the one that refreshes the Variables sidebar) never run.
  let needFinish = false;
  try {
    if (typeof PY.init === 'function') {
      PY.init(workspace);
      needFinish = true;
    }
  } catch (e) {
    console.warn('PY.init failed (continuing without):', e);
  }

  try {
    const parts = [];

    // Sprite definitions FIRST -- methods and the main body both
    // reference sprite names, so the assignments need to exist before
    // anything tries to use them. Each entry in PBC_SPRITES maps to a
    // single Python line:
    //     spielername = pbc.sprite('bild.png')
    for (const sp of PBC_SPRITES) {
      const safeImage = sp.image.replace(/[\r\n\\']/g, '');
      parts.push(`${sp.name} = pbc.sprite('${safeImage}')\n`);
    }
    if (PBC_SPRITES.length) parts.push('\n');

    // Implicit canvas. There's only one canvas per program (the
    // "background"); whenever any canvas block or any turtle_new
    // appears on the workspace, the program needs it initialised
    // up here so later blocks can reference it freely. If neither
    // is present we don't emit anything -- the canvas is purely
    // pay-as-you-need.
    //
    // BUT: if the student has an explicit "Canvas anlegen" (canvas_new
    // CREATE) block, that block emits its own
    // `hintergrund = pbc.Canvas(...)` line. Emitting the implicit one
    // too would produce a confusing duplicate assignment. So when an
    // explicit create block is present we skip the implicit decl and
    // only keep the Sprite._background wiring (the create block sets
    // that itself, so we skip that too).
    //
    // Bonus: when there are sprites too, also wire the canvas in
    // as Sprite._background. That way sprites composite over the
    // student's painted scene instead of a black backdrop -- no
    // separate block required.
    if (programUsesCanvas() && !hasExplicitCanvasCreate()) {
      parts.push(`${canvasName()} = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)\n`);
      if (PBC_SPRITES.length > 0) {
        parts.push(`pbc.Sprite._background = ${canvasName()}\n`);
      }
      parts.push('\n');
    }

    // Implicit variable initialisation. Every variable / text on the
    // workspace gets a default-value assignment at the very top so
    // students can never trip on a NameError -- reading a freshly-
    // created variable before any block has set it returns 0 / "".
    // If the user has an explicit setze-block for the same variable
    // somewhere in their start body, that simply overwrites the
    // default a few lines later, which is fine.
    //
    // We route the variable name through Blockly's name database
    // (already initialised above via PY.init) so it matches what
    // the variables_set / variables_get generators emit -- otherwise
    // an awkward name like "1 wert" would yield two different
    // identifiers and the init would miss its target.
    const allVars = getAllVars(workspace).filter(v =>
      !isTurtleVariable(v) && !isCanvasVariable(v));
    if (allVars.length > 0) {
      let nameType;
      try {
        nameType = (Blockly.Names && Blockly.Names.NameType)
          ? Blockly.Names.NameType.VARIABLE
          : 'VARIABLE';
      } catch (_) { nameType = 'VARIABLE'; }

      let wroteAny = false;
      for (const v of allVars) {
        let safe = v.name;
        try {
          if (PY.nameDB_ && typeof PY.nameDB_.getName === 'function') {
            safe = PY.nameDB_.getName(v.name, nameType);
          }
        } catch (_) {}
        const isText = STRING_VAR_NAMES.has(v.name);
        const init = isListVariable(v) ? '[]' : (isText ? '""' : '0');
        parts.push(`${safe} = ${init}\n`);
        wroteAny = true;
      }
      if (wroteAny) parts.push('\n');
    }

    // (Turtle construction is emitted by the turtle_new block itself,
    // at its position in the student's stack. We intentionally do NOT
    // hoist it: hoisting would construct the turtle before an earlier
    // "Bild auf Canvas" block runs, so the turtle would snapshot an
    // empty canvas. The student builds "neue Turtle" before any turtle
    // command anyway -- the IDE auto-inserts it -- so the variable
    // always exists in time.)

    // Emit each method definition. statementToCode indents the body
    // one level for us, which is exactly what `def name():` wants.
    //
    // Python scoping foot-gun mitigation: any variable a function
    // assigns to (via a variables_set block) gets a `global xxx`
    // declaration at the top of the body. Otherwise Python sees the
    // assignment, marks the name as local for the whole function,
    // and then `var = var + 1` on the same line throws
    // UnboundLocalError because the read happens before the local
    // is initialised. We do this unconditionally for any variable
    // assigned inside the function -- the IDE has no parameters or
    // local-only variables, so making everything global matches the
    // student's mental model ("variables are just named values
    // shared across blocks").
    for (const def of methodDefs) {
      const name = (def.getFieldValue('NAME') || '').trim();
      if (!name) continue;
      const params = (def.arguments_ || []).slice();
      // A parameter is already a local name; declaring it `global` is a
      // SyntaxError ("name 'x' is parameter and global"). Filter the
      // parameters out of the global line.
      const writtenVars = collectWrittenVariableNames(def)
        .filter(v => !params.includes(v));
      let body = PY.statementToCode(def, 'BODY');
      let globalLine = '';
      if (writtenVars.length > 0) {
        globalLine = '    global ' + writtenVars.join(', ') + '\n';
      }
      let returnLine = '';
      if (def.hasReturn_) {
        const expr = PY.valueToCode(def, 'RETURN', 0) || 'None';
        returnLine = '    return ' + expr + '\n';
      }
      let inner = globalLine + body + returnLine;
      if (!inner.trim()) inner = '    pass\n';
      parts.push(`def ${name}(${params.join(', ')}):\n${inner}\n`);
    }

    // The hat block has no BODY input -- the program is the chain of
    // blocks attached UNDER it via its next connection. Walk to the
    // first attached block and let blockToCode generate the whole
    // chain (it follows nextConnection automatically). This produces
    // column-zero code already (no wrapping construct), so unlike the
    // old input_statement version we do NOT dedent.
    let mainBody = '';
    const firstBlock = startBlock.getNextBlock();
    if (firstBlock) {
      const code = PY.blockToCode(firstBlock);
      mainBody = Array.isArray(code) ? code[0] : code;
    }
    if (!mainBody.trim()) {
      mainBody = '# (Es hängt noch kein Block unter "Beim Start".)\n';
    }
    parts.push(mainBody);

    // Helper functions Blockly's own generators register in
    // definitions_ (e.g. the "für i von … bis …" loop with variable
    // bounds needs upRange/downRange). Imports are added separately by
    // fullProgram(), so skip those; everything else goes to the top.
    const helpers = [];
    for (const [key, def] of Object.entries(PY.definitions_ || {})) {
      if (key === 'variables') continue;      // "x = None" lines; init comes above
      if (/^import_|^from_/.test(key) || /^\s*(import|from)\s/.test(def)) continue;
      helpers.push(def.trim() + '\n\n');
    }
    if (helpers.length) parts.unshift(...helpers);

    return fillEmptySuites(declareCanvasGlobal(parts.join('')));
  } finally {
    // Symmetric to init(). We pass an empty string because we don't
    // use finish's return value -- fullProgram() handles imports.
    // Wrapped in try/catch for the same reason as init above.
    if (needFinish) {
      try { PY.finish(''); }
      catch (e) { console.warn('PY.finish failed:', e); }
    }
  }
}
function fullProgram() {
  const body = isTextMode
    ? (codeEditor ? codeEditor.getValue() : '')
    : generatedCode();
  // Auto-prepend imports based on what the generated code mentions,
  // unless the user has already added the import line manually. Block
  // mode only: in text mode the student writes the imports, and a
  // missing one fails with a NameError as in any Python.
  const lines = [];
  if (isTextMode) return body;
  if (!/^\s*import\s+pbc/m.test(body))    lines.push('import pbc');
  if (/\bturtle\.Turtle\(/.test(body) &&
      !/^\s*import\s+turtle/m.test(body)) lines.push('import turtle');
  if (/\btime\.(ticks_ms|ticks_diff|sleep_ms|sleep)\(/.test(body) &&
      !/^\s*import\s+time/m.test(body))   lines.push('import time');
  // The "Zufallszahl"-block emits random.randint(...). It needs
  // `import random`; without it the program dies with
  // NameError: name 'random' isn't defined. (The Python generator's
  // own definitions_ collection is discarded in generatedCode(), so
  // we detect the usage here instead.)
  if (/\brandom\./.test(body) &&
      !/^\s*import\s+random/m.test(body)) lines.push('import random');
  // Some blocks emit math.* (e.g. trig in future blocks). Import on
  // demand so they never NameError either.
  if (/\bmath\./.test(body) &&
      !/^\s*import\s+math/m.test(body))   lines.push('import math');

  // External-sensor setup gets injected between the imports and the
  // user's body. We only do this in block mode -- in text mode the
  // user owns the file and can opt in by typing their own driver
  // calls. (The sensors menu primarily exists to support the block
  // editor anyway.)
  const sensorSetup = (!isTextMode) ? extSensorsSetup() : '';

  if (!lines.length && !sensorSetup) return body;
  const importHeader = lines.length ? lines.join('\n') + '\n\n' : '';
  return importHeader + sensorSetup + body;
}
function updateCodeView() {
  if (isTextMode) return;
  document.getElementById('codeview').textContent = fullProgram();
}

/* =====================================================================
 * Mode toggle
 * ===================================================================== */

let isTextMode = false;

// Tear down any in-flight Blockly drag / selection / bubble before
// the user does something that hides or replaces the workspace.
// Without this, switching to text mode while a block is selected
// (or just hovered with a tool-tip showing) leaves the floating SVG
// preview behind, drawn on top of the text editor like a ghost.
function cancelBlocklyGesture() {
  try {
    // 1) Cancel the active gesture if Blockly is currently dragging
    //    or has a pointerdown in flight. The current gesture lives on
    //    workspace.currentGesture_ -- we do NOT call workspace.getGesture()
    //    here, because in Blockly 12 that method expects a pointer event
    //    (it reads e.type) and throws a TypeError when called with no
    //    argument. Its absence is a normal state (no gesture running).
    if (workspace) {
      if (typeof Blockly.Tooltip?.hide === 'function') {
        Blockly.Tooltip.hide();
      }
      const gesture = workspace.currentGesture_ || null;
      if (gesture && typeof gesture.cancel === 'function') {
        try { gesture.cancel(); } catch (_) {}
      }
      // 2) Drop the selection so the highlight ring goes with it.
      if (Blockly.getSelected && Blockly.getSelected()) {
        try { Blockly.getSelected().unselect(); } catch (_) {}
      } else if (Blockly.selected && Blockly.selected.unselect) {
        try { Blockly.selected.unselect(); } catch (_) {}
      }
      // 3) Hide any open dropdown / WidgetDiv (the number-pad / text
      //    input that pops up when a field is clicked). These attach
      //    themselves to body and are NOT inside the block container,
      //    so display:none on blkDiv won't hide them.
      if (Blockly.DropDownDiv && Blockly.DropDownDiv.hideWithoutAnimation) {
        try { Blockly.DropDownDiv.hideWithoutAnimation(); } catch (_) {}
      }
      if (Blockly.WidgetDiv && Blockly.WidgetDiv.hide) {
        try { Blockly.WidgetDiv.hide(); } catch (_) {}
      }
    }
  } catch (e) {
    console.warn('cancelBlocklyGesture:', e);
  }
}

// CodeMirror instance, created lazily the first time we enter text
// mode. It replaces the plain <textarea> with a proper editor that
// has Python syntax highlighting, electric-indent, and bracket
// matching.
let codeEditor = null;

// Snapshot of the editor's content at the moment we last entered
// text mode. Used by setMode(false) to decide whether to warn the
// user about losing their edits -- if the current text matches this
// snapshot, nothing has changed and we can switch silently.
let textBaseline = '';

/* =====================================================================
 * Settings (Einstellungen).
 *
 * Currently the only user-facing setting is which external sensors to
 * enable, plus their pin assignments. Everything lives in localStorage
 * under one JSON-encoded key so future settings just add fields.
 * ===================================================================== */

const SETTINGS_KEY = 'pbc.settings';

// In-memory representation. Loaded from localStorage at boot, written
// back whenever the user changes anything in the dialog.
let EXT_SETTINGS = {
  enabled: {},   // sensor_id -> boolean
  pins:    {},   // sensor_id -> { pin_key: number }
};

function loadSettings() {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && typeof obj === 'object') {
      EXT_SETTINGS.enabled = obj.enabled || {};
      EXT_SETTINGS.pins    = obj.pins    || {};
    }
  } catch (e) { /* corrupted -- start fresh */ }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(EXT_SETTINGS));
  } catch (e) { /* quota / private mode -- accept */ }
}

// Returns the list of currently-enabled sensor IDs.
function activeSensors() {
  return Object.keys(EXT_SENSORS_CATALOG)
    .filter(id => EXT_SETTINGS.enabled[id]);
}

// Build the combined Python prologue for all enabled sensors. The
// code generator prepends this to the user's program so the user
// doesn't have to manage drivers manually.
//
// All currently supported sensors share one I2C bus -- the PBC+'s
// STEMMA QT chain on EXT_I2C_SDA/SCL. So we emit a single
// machine.I2C() before the sensor drivers.
// Returns the set of sensor IDs for which the workspace currently
// contains at least one block. Used to skip driver code for sensors
// the user activated in settings but isn't actually using in this
// particular program -- saves RAM and program startup time on the
// device.
function sensorsUsedInWorkspace() {
  const used = new Set();
  if (!workspace) return used;
  for (const b of workspace.getAllBlocks(false)) {
    const entry = PBC_BLOCKS.find(e => e.def && e.def.type === b.type);
    if (entry && entry.requires) {
      used.add(entry.requires);
    }
  }
  return used;
}

function extSensorsSetup() {
  // Only emit setup for sensors that are BOTH enabled in settings AND
  // actually referenced by a block in the current program.
  const enabled = activeSensors();
  if (enabled.length === 0) return '';
  const used = sensorsUsedInWorkspace();
  const ids = enabled.filter(id => used.has(id));
  if (ids.length === 0) return '';

  const parts = ['# --- Externe Sensoren -------------------------------\n'];
  parts.push(
    `import machine\n` +
    `_i2c = machine.I2C(0, sda=machine.Pin(${EXT_I2C_SDA}), ` +
      `scl=machine.Pin(${EXT_I2C_SCL}), freq=100000)\n`);
  for (const id of ids) {
    parts.push(EXT_SENSORS_CATALOG[id].setup());
  }
  parts.push('# ---------------------------------------------------\n\n');
  return parts.join('');
}

// Build the contents of the settings dialog freshly each time it
// opens. Restoring values from current state, NOT from the dialog
// fields, so cancelled edits truly cancel.
function renderSettingsDialog() {
  // Pre-fill the language selector with the active language.
  document.getElementById('settings-lang').value = LANG;
  document.getElementById('settings-editor-font').value =
    String(getEditorFontSize());

  const host = document.getElementById('settings-sensors');
  host.innerHTML = '';
  for (const id of Object.keys(EXT_SENSORS_CATALOG)) {
    const cat = EXT_SENSORS_CATALOG[id];
    const enabled = !!EXT_SETTINGS.enabled[id];

    const row = document.createElement('div');
    row.style.cssText =
      'border:1px solid var(--border);border-radius:6px;' +
      'padding:10px 12px;margin-bottom:10px;' +
      'background:var(--bg-1);';

    // Top line: checkbox + label. No pin config -- everything hangs
    // off the fixed STEMMA QT pins (SDA=20, SCL=21).
    const top = document.createElement('label');
    top.style.cssText = 'display:flex;align-items:center;gap:10px;' +
                        'cursor:pointer;';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = enabled;
    cb.dataset.sensor = id;
    cb.className = 'settings-enable';
    const title = document.createElement('div');
    title.style.cssText = 'flex:1;';
    title.innerHTML =
      `<div style="font-weight:600;">${t(cat.label)}</div>` +
      `<div style="font-size:12px;color:var(--fg-2);">` +
        `${t(cat.description)}</div>`;
    top.appendChild(cb);
    top.appendChild(title);
    row.appendChild(top);

    host.appendChild(row);
  }
}

document.getElementById('btn-settings').addEventListener('click', () => {
  renderSettingsDialog();
  {
    const info = document.getElementById('settings-emu-info');
    const isoliert = typeof SharedArrayBuffer !== 'undefined' && self.crossOriginIsolated === true;
    if (info) info.textContent = isoliert
      ? t('Programme laufen unverändert in einem eigenen Thread, mit so viel Speicher wie auf dem PicoBoy.')
      : t('Nicht verfügbar: Der Webserver sendet die nötigen Header nicht (siehe .htaccess).');
  }
  cancelBlocklyGesture(); document.getElementById('settings-modal').classList.add('show');
});
document.getElementById('settings-cancel').addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('show');
});
// "Your module is missing?" -- open the hardware-wish form. We close the
// settings modal first so the form isn't stacked behind it.
document.getElementById('settings-hw-wish')?.addEventListener('click', () => {
  document.getElementById('settings-modal').classList.remove('show');
  showHardwareWishDialog();
});
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal')
    document.getElementById('settings-modal').classList.remove('show');
});
document.getElementById('settings-save').addEventListener('click', () => {
  // Read checkbox values back into EXT_SETTINGS. (Pins aren't user-
  // configurable -- the STEMMA QT connector is wired to fixed pins.)
  EXT_SETTINGS.enabled = {};
  document.querySelectorAll('.settings-enable').forEach(cb => {
    EXT_SETTINGS.enabled[cb.dataset.sensor] = cb.checked;
  });
  saveSettings();

  // Editor font size: persist and apply right away (no reload needed).
  try {
    localStorage.setItem(EDITOR_FONT_KEY,
      document.getElementById('settings-editor-font').value);
  } catch (e) {}
  applyEditorFontSize();

  // Language change: if the user picked a different language, persist
  // it and reload so the whole UI rebuilds in the new language. Before
  // reloading we stash the current workspace + text editor content in
  // sessionStorage so nothing gets lost across the reload boundary.
  const newLang = document.getElementById('settings-lang').value;
  if (newLang !== LANG) {
    try {
      const snapshot = {
        blocks: Blockly.serialization.workspaces.save(workspace),
        stringVars: Array.from(STRING_VAR_NAMES || []),
        canvasVars: Array.from(CANVAS_VAR_NAMES || []),
        sprites: PBC_SPRITES,
        text: codeEditor ? codeEditor.getValue() : '',
        textMode: isTextMode,
      };
      sessionStorage.setItem('pbc.lang_reload_snapshot',
                             JSON.stringify(snapshot));
    } catch (e) { /* if it fails we just lose the workspace, oh well */ }
    try { localStorage.setItem(LANG_KEY, newLang); } catch (e) {}
    location.reload();
    return;
  }

  // Rebuild the sidebar so the ext category appears or disappears
  // and its block list reflects the current toggles.
  buildSidebar();
  updateCodeView();
  document.getElementById('settings-modal').classList.remove('show');
  toast(t('Einstellungen gespeichert'), 'good');
});

// Remember the last-used mode across reloads. Keys:
//   'pbc.last_mode'  = 'text' | 'blocks'   (default 'blocks')
//   'pbc.text_buf'   = saved source from text mode, restored on reload
//   'pbc.block_snap' = JSON snapshot of the block workspace (incl.
//                      string-var names + sprite definitions), so the
//                      block editor also survives an F5.
const MODE_KEY       = 'pbc.last_mode';
const TEXT_BUF_KEY   = 'pbc.text_buf';
const BLOCK_SNAP_KEY = 'pbc.block_snap';
const TARGET_KEY     = 'pbc.run_target';
const EDITOR_FONT_KEY = 'pbc.editor_font';

// Font size (px) of the CodeMirror editor in text mode. Chosen in
// Einstellungen, persisted in localStorage, 14 px by default.
function getEditorFontSize() {
  let v = 14;
  try { v = parseInt(localStorage.getItem(EDITOR_FONT_KEY), 10) || 14; }
  catch (e) {}
  return Math.max(8, Math.min(40, v));
}
function applyEditorFontSize() {
  if (!codeEditor) return;
  codeEditor.getWrapperElement().style.fontSize = getEditorFontSize() + 'px';
  // CodeMirror caches line heights / char widths; re-measure.
  codeEditor.refresh();
}

function persistWorkspace() {
  if (!workspace) return;
  try {
    const snap = {
      blocks:     Blockly.serialization.workspaces.save(workspace),
      stringVars: Array.from(STRING_VAR_NAMES || []),
        canvasVars: Array.from(CANVAS_VAR_NAMES || []),
      sprites:    PBC_SPRITES,
    };
    localStorage.setItem(BLOCK_SNAP_KEY, JSON.stringify(snap));
  } catch (e) { /* quota / private mode -- accept */ }
}

function loadPersistedWorkspace() {
  try {
    const raw = localStorage.getItem(BLOCK_SNAP_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function ensureCodeEditor() {
  if (codeEditor) return codeEditor;
  const ta = document.getElementById('texteditor');
  codeEditor = CodeMirror.fromTextArea(ta, {
    mode:             'python',
    theme:            'material-darker',
    lineNumbers:      true,
    indentUnit:       4,
    tabSize:          4,
    indentWithTabs:   false,
    matchBrackets:    true,
    styleActiveLine:  true,
    smartIndent:      true,     // auto-indent body after a `:` line
    electricChars:    true,
  });
  applyEditorFontSize();
  // Indent guides: tag each 4-space group of a line's leading
  // whitespace as "indent-guide", so the CSS draws a vertical line at
  // every indent level. Makes it easy to see whether a line sits under
  // the right if / for / def. Only spaces count -- tabs are never
  // inserted by the editor (indentWithTabs: false). Each level gets its
  // own extra class (indent-guide-N) because CodeMirror merges adjacent
  // tokens with an identical style into one span -- which would leave
  // only a single line for a deeply indented row.
  codeEditor.addOverlay({
    token: function(stream) {
      const lead = stream.string.match(/^ */)[0].length;
      if (stream.pos < lead) {
        // One level (up to 4 spaces) per call; a short last group
        // still gets its line.
        const level = Math.floor(stream.pos / 4);
        let n = 0;
        while (stream.pos < lead && n < 4) { stream.next(); n++; }
        return 'indent-guide indent-guide-' + level;
      }
      stream.skipToEnd();
      return null;
    },
  });
  // Auto-indent the next line by the indent of the previous one, plus
  // an extra level if the previous non-empty line ends with `:` (the
  // standard Python rule for if/while/for/def/class blocks and their
  // brethren). CodeMirror's built-in Python mode handles most of this
  // via smartIndent, but binding Enter explicitly makes the behaviour
  // crisp and predictable in all cases.
  codeEditor.setOption('extraKeys', {
    // Tab: spaces up to the next multiple of 4 (never a tab character,
    // which MicroPython accepts but other Pythons reject when mixed);
    // with a selection, indent the selected lines.
    Tab: function(cm) {
      if (cm.somethingSelected()) { cm.indentSelection('add'); return; }
      const col = cm.getCursor().ch;
      cm.replaceSelection(' '.repeat(4 - (col % 4)), 'end');
    },
    'Shift-Tab': function(cm) { cm.indentSelection('subtract'); },
    Enter: function(cm) {
      const cursor = cm.getCursor();
      const line   = cm.getLine(cursor.line);
      // Indent of the current line (whitespace prefix).
      let leading = '';
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === ' ' || c === '\t') leading += c;
        else break;
      }
      // Lines that introduce a new block end with `:` (possibly with
      // trailing whitespace or a `# comment`). Strip a trailing
      // comment, then check for the colon.
      const codePart = line.replace(/#.*$/, '').replace(/\s+$/, '');
      const opensBlock = codePart.endsWith(':');
      const extra = opensBlock ? '    ' : '';
      cm.replaceSelection('\n' + leading + extra, 'end');
    },
    // Smart Backspace: when the cursor sits inside the leading
    // whitespace of a line (i.e. everything to the left is spaces),
    // a single Backspace removes one full indent level (4 spaces),
    // not just one character. Anywhere else it falls through to
    // CodeMirror's default delete-one-char-back behaviour.
    Backspace: function(cm) {
      // Multi-character selections: let the default handler clear it.
      if (cm.somethingSelected()) return CodeMirror.Pass;
      const cursor = cm.getCursor();
      if (cursor.ch === 0) return CodeMirror.Pass;
      const line = cm.getLine(cursor.line);
      const prefix = line.slice(0, cursor.ch);
      // Cursor is "inside the indent" only if everything before it on
      // this line is whitespace AND there's at least one space there.
      if (!/^\s+$/.test(prefix)) return CodeMirror.Pass;
      // Snap back to the previous multiple of indentUnit.
      const indentUnit = cm.getOption('indentUnit') || 4;
      const target = Math.max(0,
        Math.floor((cursor.ch - 1) / indentUnit) * indentUnit);
      cm.replaceRange('',
        { line: cursor.line, ch: target },
        { line: cursor.line, ch: cursor.ch });
    },
  });
  // Sync changes to localStorage on every edit -- so a reload keeps
  // the user's work, and the auto-restore on next session works.
  codeEditor.on('change', () => {
    try {
      localStorage.setItem(TEXT_BUF_KEY, codeEditor.getValue());
    } catch (e) { /* quota, private mode, etc -- ignore */ }
  });
  return codeEditor;
}

function setMode(text, opts) {
  opts = opts || {};
  const blkDiv = document.getElementById('blockly');
  const wrap   = document.getElementById('text-wrap');
  const btn    = document.getElementById('btn-mode');

  if (text) {
    // ---- Entering text mode ----
    // Compute the program from the blocks BEFORE flipping isTextMode,
    // otherwise fullProgram() would read from the (still empty) text
    // editor and we'd end up with just the "import pbc" header.
    let programText;
    if (opts.restoreFromStorage) {
      // Bootstrap path: take the source we saved last session.
      programText = localStorage.getItem(TEXT_BUF_KEY) || '';
    } else if (opts.keepEditorContent) {
      // Already in text mode -- don't clobber what's there.
      programText = codeEditor ? codeEditor.getValue() : '';
    } else {
      programText = fullProgram();
    }
    isTextMode = true;
    // Cancel any in-flight Blockly gesture before we hide the
    // workspace. Otherwise the SVG bubble / drag-preview / selection
    // ring stays painted at its last position and floats above the
    // text editor when we toggle display:none on the block container.
    cancelBlocklyGesture();
    // Tag the body so the CSS rule above can hide the body-level
    // Blockly helper layers (drag surface, widget div, tooltip div).
    // Without this they survive the display:none on #blockly and
    // hover over the text editor.
    document.body.classList.add('text-mode');
    blkDiv.style.display = 'none';
    wrap.hidden = false;
    btn.textContent = t('Zu Blöcken wechseln');
    // Hide the code preview (would just duplicate the editor) and
    // leave the help panel closed: it opens on demand when the user
    // clicks a sidebar entry.
    document.getElementById('codepane').style.display = 'none';
    document.getElementById('helppane').hidden = true;
    // Rebuild the sidebar in help mode.
    buildHelpSidebar();
    ensureCodeEditor();
    codeEditor.setValue(programText);
    // Remember what we just put in the editor; setMode(false) uses
    // this to detect whether the user actually changed anything
    // before showing the "you're about to lose your edits" warning.
    textBaseline = programText;

    // Locking policy:
    //   - Bootstrap (restoreFromStorage) → text was the user's last
    //     mode, just keep it editable so they can continue working.
    //   - Manual switch from blocks → start read-only so an
    //     accidental click on "Zu Text wechseln" can't strand them
    //     with no way back. The banner offers an explicit unlock.
    if (opts.restoreFromStorage || opts.keepEditorContent) {
      codeEditor.setOption('readOnly', false);
      document.getElementById('text-banner').style.display = 'none';
    } else {
      codeEditor.setOption('readOnly', true);
      const banner = document.getElementById('text-banner');
      banner.style.display = '';
      banner.classList.remove('unlocked');
      document.getElementById('text-banner-msg').textContent =
        t('Schreibgeschützt. Aktiviere die Bearbeitung, um Python direkt zu ändern.');
      document.getElementById('btn-edit-on').hidden = false;
    }
    document.getElementById('codeview').textContent =
      "(Die Code-Vorschau gibt es nur im Block-Modus.\n" +
      "Du bearbeitest hier direkt Python.)";
    setTimeout(() => codeEditor.refresh(), 0);
    try { localStorage.setItem(MODE_KEY, 'text'); } catch (e) {}
  } else {
    // ---- Going back to blocks ----
    // Switching to blocks regenerates Python from the block tree, so
    // anything the user typed in the editor will be overwritten. Only
    // warn when the current content actually differs from what we put
    // there on entry -- if they switched, didn't touch anything, and
    // switched back, no need to interrupt them.
    if (isTextMode && codeEditor) {
      const cur = codeEditor.getValue();
      if (cur !== textBaseline && !confirm(t(
          'Wenn du jetzt zu den Blöcken zurückwechselst, gehen alle ' +
          'Änderungen am Python-Code verloren. Die Blöcke ' +
          'überschreiben den Editor-Inhalt.\n\n' +
          'Wirklich zurückwechseln?'))) {
        return;
      }
    }
    wrap.hidden = true;
    blkDiv.style.display = '';
    isTextMode = false;
    document.body.classList.remove('text-mode');
    btn.textContent = t('Zu Text wechseln');
    // Swap panels back: hide help, show code preview, rebuild block
    // sidebar.
    document.getElementById('helppane').hidden = true;
    document.getElementById('codepane').style.display = '';
    buildSidebar();
    Blockly.svgResize(workspace);
    updateCodeView();
    try { localStorage.setItem(MODE_KEY, 'blocks'); } catch (e) {}
  }
}

// Wires up the "Bearbeitung aktivieren" button that appears when the
// user switches from blocks → text. Asks for explicit confirmation
// since switching back to blocks afterwards will throw away their
// edits.
function setupEditLockButton() {
  document.getElementById('btn-edit-on').addEventListener('click', () => {
    if (!confirm(t(
        'Wenn du die Python-Bearbeitung aktivierst, geht der Weg ' +
        'NUR IN EINE RICHTUNG:\n\n' +
        '  Blöcke  →  Python (jetzt)\n' +
        '  Python  →  Blöcke ist NICHT möglich.\n\n' +
        'Du kannst zwar zurück zu den Blöcken wechseln, aber dann ' +
        'gehen deine Python-Änderungen verloren.\n\nFortfahren?'))) {
      return;
    }
    if (codeEditor) {
      codeEditor.setOption('readOnly', false);
      codeEditor.focus();
    }
    const banner = document.getElementById('text-banner');
    banner.classList.add('unlocked');
    document.getElementById('text-banner-msg').textContent =
      t('Python-Bearbeitung aktiv. Zurück zu Blöcken bedeutet Datenverlust.');
    document.getElementById('btn-edit-on').hidden = true;
  });
}

