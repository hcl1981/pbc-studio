/* =====================================================================
 * Register all PBC blocks
 * ===================================================================== */

// Translation pass: run every block's message0 / label / dropdown
// option labels through t() so the English mode picks up our
// translations without having to manually wrap every string in the
// PBC_BLOCKS array above. In German mode t() is a no-op, so nothing
// changes.
PBC_BLOCKS.forEach((entry) => {
  if (entry.label) entry.label = t(entry.label);
  const d = entry.def;
  if (d.message0) d.message0 = t(d.message0);
  // Translate dropdown option labels (e.g. ['Knopf A', 'a']).
  // Don't touch the second element -- that's the internal value
  // that the code generator reads.
  if (Array.isArray(d.args0)) {
    d.args0.forEach(arg => {
      if (arg.type === 'field_dropdown' && Array.isArray(arg.options)) {
        arg.options = arg.options.map(([lab, val]) => [t(lab), val]);
      }
    });
  }
});

// List literals ("erzeuge Liste mit"): the items sit side by side, not
// stacked -- a list of ten numbers would otherwise fill half the screen.
// Set in init, so it also holds for loaded files and for slots added
// with the gear; a file that saved "inline": false still wins.
if (Blockly.Blocks['lists_create_with']) {
  const listeInit = Blockly.Blocks['lists_create_with'].init;
  Blockly.Blocks['lists_create_with'].init = function() {
    listeInit.call(this);
    this.setInputsInline(true);
  };
}

// Blocks with value inputs (x, y, Farbe …) show them in one row instead
// of stacking each one on its own line, unless the definition says
// otherwise. Blocks that hold statements (loops, if) keep their shape.
PBC_BLOCKS.forEach((entry) => {
  const d = entry.def;
  if (d.inputsInline !== undefined) return;
  const args = [];
  for (let i = 0; d['args' + i]; i++) args.push(...d['args' + i]);
  const werte = args.some((a) => a.type === 'input_value');
  const anweisungen = args.some((a) => a.type === 'input_statement');
  if (werte && !anweisungen) d.inputsInline = true;
});

PBC_BLOCKS.forEach((entry) => {
  if (!entry.skipJson) {
    Blockly.defineBlocksWithJsonArray([entry.def]);
  }
  PY.forBlock[entry.def.type] = entry.gen;
});

// Image-related blocks: defined in JS so the file-name field can be a
// dynamic dropdown that always reflects the currently uploaded PNGs.
// JSON block definitions can't express dynamic dropdown menus, so we
// hand-roll the init function.
Blockly.Blocks['pbc_show_image'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(t('Bild'))
        .appendField(new Blockly.FieldDropdown(imageOptions), 'NAME')
        .appendField(t('anzeigen'));
    this.appendValueInput('X').setCheck('Number').appendField(t('bei x'));
    this.appendValueInput('Y').setCheck('Number').appendField(t('y'));
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(HUE_NUM.display);
  },
};

// Canvas variant of pbc_show_image: paints a PNG into the canvas
// backbuffer instead of straight onto the display. The same dynamic
// dropdown of uploaded PNGs as the display block, but no separate
// position field group -- the image lands at (x, y) on the canvas.
Blockly.Blocks['canvas_load_image'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(t('Bild'))
        .appendField(new Blockly.FieldDropdown(imageOptions), 'NAME')
        .appendField(t('auf Canvas'));
    this.appendValueInput('X').setCheck('Number').appendField(t('bei x'));
    this.appendValueInput('Y').setCheck('Number').appendField(t('y'));
    this.setInputsInline(true);
    this.setPreviousStatement(true, null);
    this.setNextStatement(true, null);
    this.setColour(HUE_NUM.canvas);
  },
};

/* =====================================================================
 * User-defined methods (Funktionen).
 *
 * Two blocks: a top-level definition (hat block, like pbc_when_start),
 * and a call block whose dropdown is filled from the currently-defined
 * methods on the workspace.
 *
 * No parameters, no return values -- methods are pure "name something
 * and use it later" containers. Keeps the introduction to functions
 * simple; we can add returns / args later if the curriculum needs it.
 * ===================================================================== */

// Function definitions. Two separate top-level blocks that share all
// their behaviour except whether they return a value:
//
//   pbc_method_def         -- no return value; its call is a normal
//                             statement block.
//   pbc_method_def_return  -- returns a value (a "gib zurück" slot); its
//                             call is an OUTPUT block that drops straight
//                             into a value lücke, like a variable.
//
// The return-ness is fixed by the block TYPE -- the student picks it up
// front via two distinct sidebar entries, so there's no checkbox to
// misunderstand.
//
// PARAMETERS are edited DIRECTLY ON THE BLOCK, kid-style: a green "+"
// button at the end of the header adds a parameter, a red "×" next to
// each parameter removes it, and the parameter name is an editable field
// right there. No gear, no pop-up bubble, no dragging tiny blocks. The
// default is zero parameters. Names live in this.arguments_ and
// round-trip via saveExtraState / loadExtraState. this.hasReturn_ is a
// constant derived from the block type so the rest of the code (call
// sync, code-gen) can read it uniformly.

// Small inline SVG icons for the +/× buttons (data URIs -> work offline).
const _svgIcon = (inner) => 'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22">' +
    inner + '</svg>');
const ICON_PLUS = _svgIcon(
  '<circle cx="11" cy="11" r="10" fill="#3fb95c"/>' +
  '<path d="M11 5.5V16.5M5.5 11H16.5" stroke="white" stroke-width="2.8" ' +
  'stroke-linecap="round"/>');
const ICON_X = _svgIcon(
  '<circle cx="11" cy="11" r="10" fill="#d9534f"/>' +
  '<path d="M7 7L15 15M15 7L7 15" stroke="white" stroke-width="2.6" ' +
  'stroke-linecap="round"/>');

// Preferred default names for freshly added parameters.
const DEFAULT_PARAM_NAMES = ['x', 'y', 'z', 'a', 'b', 'c', 'd', 'e'];

// Rename every parameter getter inside this def's body from oldName to
// newName, so renaming a parameter on the header keeps the body working.
function renameParamReferences(defBlock, oldName, newName) {
  if (!oldName || oldName === newName) return;
  PENDING_PARAM_NAMES.add(newName);
  try {
    defBlock.getDescendants(false).forEach(b => {
      if (b.type === 'pbc_method_param_get' &&
          b.getFieldValue('PARAM') === oldName) {
        try { b.getField('PARAM').setValue(newName); } catch (_) {}
      }
    });
  } finally {
    PENDING_PARAM_NAMES.delete(newName);
  }
}

const METHOD_DEF_MIXIN = {
  saveExtraState: function() {
    return { params: (this.arguments_ || []).slice() };
  },
  loadExtraState: function(state) {
    this.arguments_ = (state && Array.isArray(state.params))
      ? state.params.slice() : [];
    this.updateParams_();
  },

  // Build (or rebuild) the header row: "Funktion <name> mit <p1 ×> <p2 ×> +".
  // Called on init and whenever a parameter is added/removed.
  updateParams_: function() {
    const block = this;
    const name = this.getInput('HEAD')
      ? (this.getFieldValue('NAME') || '') : '';
    if (this.getInput('HEAD')) this.removeInput('HEAD');
    const head = this.appendDummyInput('HEAD');
    head.appendField(t('Funktion'));
    head.appendField(new Blockly.FieldTextInput(
      name || 'meine_funktion', validateMethodName), 'NAME');
    if (this.arguments_.length) head.appendField(t('mit'));
    this.arguments_.forEach((p, i) => {
      head.appendField(new Blockly.FieldTextInput(
        p, makeParamValidator(block, i)), 'P' + i);
      head.appendField(new Blockly.FieldImage(
        ICON_X, 18, 18, t('Parameter entfernen'),
        () => block.removeParam_(i)), 'X' + i);
    });
    head.appendField(new Blockly.FieldImage(
      ICON_PLUS, 20, 20, t('Parameter hinzufügen'),
      () => block.addParam_()), 'PLUS');
    // Keep the header at the top, above the body / return slot.
    if (this.getInput('BODY')) this.moveInputBefore('HEAD', 'BODY');
  },

  nextParamName_: function() {
    for (const n of DEFAULT_PARAM_NAMES) {
      if (!this.arguments_.includes(n)) return n;
    }
    let i = 1;
    while (this.arguments_.includes('p' + i)) i++;
    return 'p' + i;
  },

  addParam_: function() {
    const block = this;
    const nm = this.nextParamName_();
    // Defer the structural change out of the field-click handler so we
    // don't dispose the just-clicked button mid-click.
    setTimeout(() => {
      Blockly.Events.setGroup(true);
      try {
        block.arguments_.push(nm);
        block.updateParams_();
        if (typeof refreshMethodsCategory === 'function') refreshMethodsCategory();
      } catch (e) { console.warn('addParam failed:', e); }
      finally { Blockly.Events.setGroup(false); }
    }, 0);
  },

  removeParam_: function(index) {
    const block = this;
    setTimeout(() => {
      Blockly.Events.setGroup(true);
      try {
        const removed = block.arguments_[index];
        block.arguments_.splice(index, 1);
        block.updateParams_();
        // Orphaned getters for the removed parameter now read "(kein
        // Parameter)"; we leave them in place so the student notices.
        if (typeof refreshMethodsCategory === 'function') refreshMethodsCategory();
      } catch (e) { console.warn('removeParam failed:', e); }
      finally { Blockly.Events.setGroup(false); }
    }, 0);
  },
};

// Validator for an on-block parameter name field. Sanitizes to a legal
// identifier, blocks duplicates, keeps this.arguments_ in sync, renames
// body references, and refreshes the sidebar / call blocks.
function makeParamValidator(block, index) {
  return function(newValue) {
    const cleaned = validateMethodName(newValue);
    if (!cleaned) return null;   // empty / invalid -> keep editing
    // Reject a name already used by another parameter (def f(x, x) is a
    // SyntaxError); the student just keeps the old text.
    if (block.arguments_.some((p, j) => j !== index && p === cleaned)) {
      return null;
    }
    const old = block.arguments_[index];
    block.arguments_[index] = cleaned;
    setTimeout(() => {
      try {
        renameParamReferences(block, old, cleaned);
        if (typeof refreshMethodsCategory === 'function') refreshMethodsCategory();
      } catch (_) {}
    }, 0);
    return cleaned;
  };
}

function makeMethodDefInit(hasReturn) {
  return function() {
    this.arguments_ = [];
    this.hasReturn_ = hasReturn;
    this.appendStatementInput('BODY');
    if (hasReturn) {
      this.appendValueInput('RETURN').appendField(t('gib zurück'));
    }
    this.updateParams_();   // builds the HEAD row and moves it on top
    this.setColour(HUE_NUM.methods);
    this.setTooltip(hasReturn
      ? t('Definiert eine Funktion mit Rückgabewert. Ihr Aufruf lässt ' +
          'sich direkt in eine Wert-Lücke ziehen. Mit + fügst du ' +
          'Parameter hinzu.')
      : t('Definiert eine eigene Funktion. Mit + fügst du Parameter ' +
          'hinzu; rufe sie unten überall auf.'));
  };
}

Blockly.Blocks['pbc_method_def'] =
  Object.assign({ init: makeMethodDefInit(false) }, METHOD_DEF_MIXIN);
Blockly.Blocks['pbc_method_def_return'] =
  Object.assign({ init: makeMethodDefInit(true) }, METHOD_DEF_MIXIN);

// Scoped value getter: an output block that reads one PARAMETER or one
// LOCAL VARIABLE of the enclosing function. The dropdown lists both,
// resolved live from the surrounding pbc_method_def, plus any pending
// name (see PENDING_PARAM_NAMES) so the value survives both construction
// and load -- FieldDropdown rejects a setValue whose target isn't
// already in the option list.
Blockly.Blocks['pbc_method_param_get'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(new Blockly.FieldDropdown(methodParamOptions), 'PARAM');
    this.setOutput(true, null);
    this.setColour(HUE_NUM.methods);
    this.setTooltip(t('Liest einen Parameter oder eine lokale Variable ' +
                    'der Funktion.'));
  },
};

// Local variable assignment: "lokale Variable [name] = [wert]". A plain
// statement that lives inside a function body. Unlike the normal
// (global) variable blocks, the value it creates is LOCAL to the
// function -- Python's natural scoping makes "name = value" a local, so
// no "global" declaration is needed and the name never leaks into the
// module-level init list. Reading it back uses the scoped value getter
// above (pbc_method_param_get), which lists locals alongside parameters.
Blockly.Blocks['pbc_local_set'] = {
  init: function() {
    this.appendValueInput('VALUE')
        .appendField(t('lokale Variable'))
        .appendField(new Blockly.FieldTextInput('wert', validateMethodName), 'NAME')
        .appendField('=');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(HUE_NUM.methods);
    this.setTooltip(t('Erstellt eine lokale Variable, die nur in dieser ' +
                    'Funktion gilt (kein "global" nötig).'));
  },
};

// Call: dropdown of existing method names, one value input per
// parameter, and -- when the target function returns a value -- an
// output plug so it can sit in any value slot (it then replaces the
// statement form rather than appearing alongside it). The argument
// count / return flag live in this.arguments_ / this.hasReturn_,
// serialized via saveExtraState so the dynamic input slots round-trip.
Blockly.Blocks['pbc_method_call'] = {
  init: function() {
    this.arguments_ = [];
    this.hasReturn_ = false;
    this.renderedArgCount_ = 0;
    this.appendDummyInput('HEAD')
        .appendField(t('Funktion'))
        .appendField(new Blockly.FieldDropdown(methodNameOptions), 'NAME');
    this.setInputsInline(true);
    this.setPreviousStatement(true);
    this.setNextStatement(true);
    this.setColour(HUE_NUM.methods);
    this.setTooltip(t('Ruft eine eigene Funktion auf.'));
  },

  saveExtraState: function() {
    return {
      params: (this.arguments_ || []).slice(),
      hasReturn: !!this.hasReturn_,
    };
  },
  loadExtraState: function(state) {
    this.arguments_ = (state && Array.isArray(state.params))
      ? state.params.slice() : [];
    this.hasReturn_ = !!(state && state.hasReturn);
    this.updateShape_();
  },

  // Rebuild the argument value inputs and switch between output form
  // (returns a value) and statement form, preserving any blocks the
  // student already plugged into matching argument slots.
  updateShape_: function() {
    const prevCount = this.renderedArgCount_ || 0;
    const saved = {};
    for (let i = 0; i < prevCount; i++) {
      const inp = this.getInput('ARG' + i);
      if (inp && inp.connection && inp.connection.targetConnection) {
        saved[i] = inp.connection.targetConnection;
        // Disconnect first: some Blockly versions throw when disposing
        // a still-connected input. The child block survives as an
        // orphan and gets reconnected below if its slot still exists.
        try { inp.connection.disconnect(); } catch (_) {}
      }
      if (inp) this.removeInput('ARG' + i, true);
    }
    const params = this.arguments_ || [];
    params.forEach((p, i) => {
      const inp = this.appendValueInput('ARG' + i).appendField(p + ':');
      if (saved[i]) { try { inp.connection.connect(saved[i]); } catch (_) {} }
    });
    this.renderedArgCount_ = params.length;
    this.setInputsInline(true);
    // Output vs statement form.
    if (this.hasReturn_) {
      if (this.previousConnection) this.setPreviousStatement(false);
      if (this.nextConnection) this.setNextStatement(false);
      if (!this.outputConnection) this.setOutput(true, null);
    } else {
      if (this.outputConnection) this.setOutput(false);
      if (!this.previousConnection) this.setPreviousStatement(true);
      if (!this.nextConnection) this.setNextStatement(true);
    }
  },
};

// Sanitize a method name as the user types it. Allowed: ASCII letters,
// digits and underscore; must not start with a digit. We tolerate
// anything during editing (Blockly calls the validator on every
// keystroke) and only enforce the rules at submit time -- a stricter
// approach would block legitimate intermediate states like "" while
// the user is still typing.
function validateMethodName(name) {
  if (!name) return null;
  // Strip whitespace and obvious invalid chars; keep what's typeable.
  let cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  // Method names can't start with a digit.
  if (/^[0-9]/.test(cleaned)) cleaned = '_' + cleaned;
  return cleaned;
}

// Returns the dropdown options for pbc_method_call: one entry per
// currently-defined method. Crucially it ALSO includes the field's
// current value even if no matching definition exists yet -- this is
// what makes save/load round-trip correctly. On load Blockly may
// create a call block before (or independent of) the matching
// definition block, and a FieldDropdown silently resets to its first
// option if the saved value isn't in the list. By injecting the
// current value we guarantee it survives; if the function genuinely
// doesn't exist, the preflight check catches it at run time.
// Names that a load operation is about to introduce. We populate
// this from the .pbcp JSON *before* calling workspaces.load(), so
// that while Blockly is constructing the call blocks and validating
// their NAME field against the dropdown options, the saved names are
// already considered valid -- otherwise FieldDropdown rejects the
// value during setValue (when this.getValue() is still the old/empty
// value, so the per-field "current" trick can't help) and silently
// resets the call to "(keine Funktion)".
let PENDING_METHOD_NAMES = [];

// Parameter names that should be considered valid options for a
// pbc_method_param_get dropdown even though its surrounding function
// can't be resolved yet (during sidebar spawn, before the block is
// connected, and during load before child blocks are wired up). Same
// FieldDropdown-freezes-its-options workaround as PENDING_METHOD_NAMES.
let PENDING_PARAM_NAMES = new Set();

// The function definition that encloses a block, or null if the block
// hangs under "Beim Start" / floats free.
function enclosingMethodDef(block) {
  let p = block && block.getParent ? block.getParent() : null;
  while (p) {
    if (p.type === 'pbc_method_def' || p.type === 'pbc_method_def_return') {
      return p;
    }
    p = p.getParent ? p.getParent() : null;
  }
  return null;
}

// Names of the local variables declared inside a function body (every
// pbc_local_set NAME among the def's descendants).
function collectLocalVarNames(defBlock) {
  if (!defBlock || !defBlock.getDescendants) return [];
  const names = [];
  const seen = new Set();
  defBlock.getDescendants(false).forEach(b => {
    if (b.type !== 'pbc_local_set') return;
    const n = (b.getFieldValue('NAME') || '').trim();
    if (n && !seen.has(n)) { seen.add(n); names.push(n); }
  });
  return names;
}

// Dropdown options for a scoped value getter. Combines: the parameters
// AND local variables of the enclosing function (walked live), any
// pending names, and the field's own current value -- so the saved/typed
// value is never silently dropped.
function methodParamOptions() {
  const names = [];
  const seen = new Set();
  const push = (n) => { if (n && !seen.has(n)) { seen.add(n); names.push(n); } };
  const field = this;
  const block = (field && typeof field.getSourceBlock === 'function')
    ? field.getSourceBlock() : null;
  if (block) {
    const def = enclosingMethodDef(block);
    if (def) {
      (def.arguments_ || []).forEach(push);
      collectLocalVarNames(def).forEach(push);
    }
  }
  PENDING_PARAM_NAMES.forEach(push);
  const current = (field && typeof field.getValue === 'function')
    ? field.getValue() : '';
  push(current);
  if (names.length === 0) return [['(kein Parameter)', '']];
  return names.map(n => [n, n]);
}

// Like listMethodNames, but returns the full signature of each defined
// function: { name, params, hasReturn }. Used by the sidebar (one call
// entry + indented parameter buttons) and to sync call blocks.
function listMethods() {
  if (!workspace) return [];
  const seen = new Set();
  const result = [];
  for (const b of workspace.getAllBlocks(false)) {
    if (b.type !== 'pbc_method_def' && b.type !== 'pbc_method_def_return') continue;
    const n = (b.getFieldValue('NAME') || '').trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      result.push({
        name: n,
        params: (b.arguments_ || []).slice(),
        locals: collectLocalVarNames(b),
        hasReturn: b.type === 'pbc_method_def_return',
      });
    }
  }
  return result;
}

function methodNameOptions() {
  const names = listMethodNames();
  const current = (this && typeof this.getValue === 'function')
    ? this.getValue() : '';
  // Merge: defined functions + names about to be loaded + this
  // field's current value. De-duplicated, order: defined first.
  const merged = [];
  const seen = new Set();
  const push = (n) => { if (n && !seen.has(n)) { seen.add(n); merged.push(n); } };
  names.forEach(push);
  PENDING_METHOD_NAMES.forEach(push);
  const opts = merged.map(n => [n, n]);
  // current value: if it's a defined function it's already in opts;
  // if not, surface it with a "(?)" so a genuinely-missing target
  // stays visible to the user.
  if (current && !seen.has(current)) {
    opts.unshift([current + ' (?)', current]);
  }
  if (opts.length === 0) return [[t('(keine Funktion)'), '']];
  return opts;
}

// Scan a Blockly serialization JSON for every pbc_method_def NAME
// and every pbc_method_call NAME, returning the union. Called right
// before workspaces.load() so PENDING_METHOD_NAMES can prime the
// dropdown validator.
function collectMethodNamesFromJson(blocksJson) {
  const found = new Set();
  function walk(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    if (node.type === 'pbc_method_def' || node.type === 'pbc_method_def_return' ||
        node.type === 'pbc_method_call') {
      const n = node.fields && node.fields.NAME;
      if (typeof n === 'string' && n.trim()) found.add(n.trim());
    }
    for (const k in node) walk(node[k]);
  }
  walk(blocksJson);
  return [...found];
}

// Wrapper around Blockly.serialization.workspaces.load that primes
// PENDING_METHOD_NAMES first (so call-block dropdowns accept their
// saved values during construction) and clears it + repaints the
// call blocks afterwards. Every load path should go through this
// instead of calling workspaces.load directly.
function loadWorkspaceJson(blocksJson, ws) {
  ws = ws || workspace;
  // A load fully replaces the workspace, so drop the previous program's
  // user-variable names; they're reseeded from the loaded variables in
  // the finally block below.
  USER_VAR_NAMES = new Set();
  // Migration: older saved programs stored the main program INSIDE the
  // "Beim Start" block as a statement input (inputs.BODY). The block is
  // now a hat -- the program hangs UNDER it via the next connection.
  // Rewrite any old-format start block so those programs don't lose
  // their body on load. Walk the JSON and for every pbc_when_start with
  // inputs.BODY.block, move that block (and its chain) to .next.
  (function migrateStart(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(migrateStart); return; }
    if (node.type === 'pbc_when_start' && node.inputs && node.inputs.BODY) {
      const inner = node.inputs.BODY.block || node.inputs.BODY.shadow;
      if (inner && !node.next) node.next = { block: inner };
      delete node.inputs.BODY;
      if (Object.keys(node.inputs).length === 0) delete node.inputs;
    }
    for (const k in node) migrateStart(node[k]);
  })(blocksJson);
  // Migration: an earlier iteration used a single pbc_method_def block
  // with a "hasReturn" flag in its extraState instead of two block
  // types. Convert any such node to the dedicated return-type block so
  // old programs keep their return value (and drop the now-unused flag).
  (function migrateReturnDef(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(migrateReturnDef); return; }
    if (node.type === 'pbc_method_def' &&
        node.extraState && node.extraState.hasReturn) {
      node.type = 'pbc_method_def_return';
    }
    if ((node.type === 'pbc_method_def' ||
         node.type === 'pbc_method_def_return') &&
        node.extraState && 'hasReturn' in node.extraState) {
      delete node.extraState.hasReturn;
    }
    for (const k in node) migrateReturnDef(node[k]);
  })(blocksJson);
  PENDING_METHOD_NAMES = collectMethodNamesFromJson(blocksJson);
  // Prime parameter-getter dropdowns the same way: collect every
  // parameter name (from method-def / method-call extraState) and every
  // getter's saved PARAM, so FieldDropdown accepts those values while
  // the blocks are being constructed (before they're connected, when
  // the live scope walk can't find them yet).
  const getterParams = {};   // blockId -> saved PARAM
  PENDING_PARAM_NAMES = new Set();
  (function scanParams(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(scanParams); return; }
    if ((node.type === 'pbc_method_def' || node.type === 'pbc_method_def_return' ||
         node.type === 'pbc_method_call') &&
        node.extraState && Array.isArray(node.extraState.params)) {
      node.extraState.params.forEach(p => { if (p) PENDING_PARAM_NAMES.add(p); });
    }
    if (node.type === 'pbc_method_param_get' &&
        node.fields && typeof node.fields.PARAM === 'string' && node.fields.PARAM) {
      PENDING_PARAM_NAMES.add(node.fields.PARAM);
      if (node.id) getterParams[node.id] = node.fields.PARAM;
    }
    // Local-variable names also feed the scoped-getter dropdowns.
    if (node.type === 'pbc_local_set' &&
        node.fields && typeof node.fields.NAME === 'string' && node.fields.NAME) {
      PENDING_PARAM_NAMES.add(node.fields.NAME);
    }
    for (const k in node) scanParams(node[k]);
  })(blocksJson);
  // Build an id -> NAME map for every method-call block in the JSON,
  // so we can forcibly re-apply the saved name after load. This is
  // the belt-and-suspenders fix: even if FieldDropdown rejected the
  // value during deserialization (because the option list wasn't
  // ready yet), we slam the correct value back in afterwards using
  // the block's stable id.
  const callNames = {};   // blockId -> saved NAME
  (function scan(node) {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(scan); return; }
    if (node.type === 'pbc_method_call' && node.id &&
        node.fields && typeof node.fields.NAME === 'string') {
      callNames[node.id] = node.fields.NAME;
    }
    for (const k in node) scan(node[k]);
  })(blocksJson);

  try {
    Blockly.serialization.workspaces.load(blocksJson, ws);
    // Same look as sidebar-spawned if-blocks (also if load ran with
    // events disabled and the BLOCK_CREATE listener never saw it).
    ws.getBlocksByType('controls_if', false).forEach(stripMutatorIcon);
  } finally {
    // Re-apply each saved call name by block id. setValue now
    // succeeds because PENDING_METHOD_NAMES makes methodNameOptions
    // include the name, and the defining blocks exist on the
    // workspace at this point anyway.
    const idKeys = Object.keys(callNames);
    let appliedByLoad = false;
    if (idKeys.length > 0) {
      let hits = 0;
      idKeys.forEach(id => {
        const blk = ws.getBlockById(id);
        if (!blk) return;
        const field = blk.getField('NAME');
        if (field) {
          hits++;
          if (field.getValue() !== callNames[id]) {
            try { field.setValue(callNames[id]); } catch (_) {}
          }
        }
      });
      appliedByLoad = hits > 0;
    }
    // Fallback for serialization JSON that omits block ids (older or
    // hand-authored files): match call blocks positionally. We
    // collect the saved NAMEs in document order and the loaded
    // call-blocks in the same traversal order, then zip them.
    if (!appliedByLoad) {
      const savedOrder = [];
      (function scan(node) {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(scan); return; }
        if (node.type === 'pbc_method_call' &&
            node.fields && typeof node.fields.NAME === 'string') {
          savedOrder.push(node.fields.NAME);
        }
        for (const k in node) scan(node[k]);
      })(blocksJson);
      const liveCalls = ws.getAllBlocks(false)
        .filter(b => b.type === 'pbc_method_call');
      if (savedOrder.length === liveCalls.length) {
        liveCalls.forEach((blk, idx) => {
          const field = blk.getField('NAME');
          if (field && field.getValue() !== savedOrder[idx]) {
            try { field.setValue(savedOrder[idx]); } catch (_) {}
          }
        });
      }
    }
    // Re-apply each getter's saved PARAM by id. Even if FieldDropdown
    // rejected the value during deserialization, PENDING_PARAM_NAMES now
    // makes methodParamOptions include it, so setValue sticks.
    Object.keys(getterParams).forEach(id => {
      const blk = ws.getBlockById(id);
      if (!blk) return;
      const f = blk.getField('PARAM');
      if (f && f.getValue() !== getterParams[id]) {
        try { f.setValue(getterParams[id]); } catch (_) {}
      }
    });
    // Every plain (non-turtle) variable in a loaded program is one the
    // student created on purpose, so register them as user variables.
    // This keeps purgeUnusedDefaultVariables from sweeping away a saved
    // variable that currently has no block referencing it.
    getAllVars(ws).forEach(v => {
      if (!isTurtleVariable(v) && !isCanvasVariable(v)) {
        USER_VAR_NAMES.add(v.name);
      }
    });
    refreshMethodCallBlocks();
    PENDING_METHOD_NAMES = [];
    PENDING_PARAM_NAMES = new Set();
    refreshMethodCallBlocks();
    // Final repaint of getters now that the live scope walk works.
    ws.getAllBlocks(false).forEach(b => {
      if (b.type !== 'pbc_method_param_get') return;
      const f = b.getField('PARAM');
      if (f && typeof f.forceRerender === 'function') {
        try { f.forceRerender(); } catch (_) {}
      }
    });
  }
}

// Walk the workspace, collect names of every pbc_method_def block.
function listMethodNames() {
  if (!workspace) return [];
  const seen = new Set();
  const result = [];
  for (const b of workspace.getAllBlocks(false)) {
    if (b.type !== 'pbc_method_def' && b.type !== 'pbc_method_def_return') continue;
    const n = (b.getFieldValue('NAME') || '').trim();
    if (n && !seen.has(n)) {
      seen.add(n);
      result.push(n);
    }
  }
  return result;
}

// Python generators for the def blocks. Method defs live at module
// top-level, so generatedCode() picks them up directly and these just
// return empty. (If the user somehow nests one inside a `Beim Start`
// body, the same logic applies -- the body emits blank for this block,
// and the top-level scan in generatedCode produces the actual def.)
PY.forBlock['pbc_method_def'] = function() { return ''; };
PY.forBlock['pbc_method_def_return'] = function() { return ''; };
PY.forBlock['pbc_method_call'] = function(block, gen) {
  const name = block.getFieldValue('NAME');
  const params = block.arguments_ || [];
  const args = params.map((p, i) => gen.valueToCode(block, 'ARG' + i, 0) || 'None');
  const callExpr = name ? `${name}(${args.join(', ')})` : '';
  if (block.hasReturn_) {
    // Output form: feeds into a value slot.
    return [callExpr || 'None', 0];
  }
  if (!name) return '# (Funktion nicht gewählt)\n';
  return `${callExpr}\n`;
};

// Scoped value getter: emit the parameter / local-variable name
// verbatim. Names are validated to legal Python identifiers, and both
// the def signature and the local-set block emit them unchanged, so they
// line up.
PY.forBlock['pbc_method_param_get'] = function(block) {
  const name = block.getFieldValue('PARAM');
  if (!name) return ['None', 0];
  return [name, 0];
};

// Local variable assignment: a plain "name = value" line. Because it's a
// straight assignment inside the function body, Python scopes the name
// locally on its own -- no "global" declaration, and we never add it to
// the module-level variable init.
PY.forBlock['pbc_local_set'] = function(block, gen) {
  const name = (block.getFieldValue('NAME') || '').trim();
  if (!name) return '';
  const val = gen.valueToCode(block, 'VALUE', 0) || '0';
  return `${name} = ${val}\n`;
};

Blockly.Blocks['pbc_load_image'] = {
  init: function() {
    this.appendDummyInput()
        .appendField(t('Bild laden:'))
        .appendField(new Blockly.FieldDropdown(imageOptions), 'NAME');
    this.setOutput(true, null);
    this.setColour(HUE_NUM.sprite);
  },
};

// Arithmetic block: + − × ÷ % combined into one with a dropdown so
// students see them all at once. Uses Blockly's standard math hue
// (230) so it blends in with the rest of the Math category. Python
// "%" is exactly the remainder/modulo operator, so no special casing.
Blockly.defineBlocksWithJsonArray([{
  type: 'pbc_arith',
  message0: '%1 %2 %3',
  args0: [
    { type: 'input_value', name: 'A', check: 'Number' },
    { type: 'field_dropdown', name: 'OP', options: [
        ['+',   'ADD'],
        ['−',   'SUB'],
        ['×',   'MUL'],
        ['÷',   'DIV'],
        ['Rest','MOD'],
      ] },
    { type: 'input_value', name: 'B', check: 'Number' },
  ],
  inputsInline: true,
  output: 'Number',
  colour: 230,
}]);
PY.forBlock['pbc_arith'] = function(block, gen) {
  const op  = block.getFieldValue('OP');
  const map = { ADD: '+', SUB: '-', MUL: '*', DIV: '/', MOD: '%' };
  const a = gen.valueToCode(block, 'A', 0) || '0';
  const b = gen.valueToCode(block, 'B', 0) || '0';
  return [`(${a} ${map[op]} ${b})`, 0];
};

// Hook up the color picker block: the COLOR field is a normal text
// field carrying the hex string. We hijack its click handler so that
// clicking the field opens the OS-native color picker instead of a
// keyboard prompt. setValue then drives the field back and triggers
// code-view refresh through Blockly's normal change events.
(function attachColorPicker() {
  const origInit = Blockly.Blocks['pbc_color_picker'].init;
  Blockly.Blocks['pbc_color_picker'].init = function() {
    origInit.call(this);
    const field = this.getField('COLOR');
    if (!field) return;

    // Repaint the field background to match the chosen color, so the
    // block itself shows you the color you picked.
    const repaint = () => {
      try {
        const hex = (field.getValue() || '#ffffff').trim();
        const m = hex.match(/^#?([0-9a-f]{6})$/i);
        if (!m) return;
        if (field.textElement_) {
          // Pick black or white text depending on luminance.
          const r = parseInt(m[1].substr(0,2),16);
          const g = parseInt(m[1].substr(2,2),16);
          const b = parseInt(m[1].substr(4,2),16);
          const lum = 0.299*r + 0.587*g + 0.114*b;
          field.textElement_.style.fill = lum > 140 ? '#000' : '#fff';
        }
        if (field.borderRect_) {
          field.borderRect_.style.fill = '#' + m[1];
        }
      } catch (e) {}
    };
    // Expose so the workspace BLOCK_CREATE listener can trigger this
    // after the block's SVG is actually in the DOM (the workspace
    // listener fires once per spawned block, including initial demo).
    field._repaint = repaint;

    // Override showEditor: open our own modal with OK / Cancel.
    field.showEditor_ = function() {
      openColorModal(this.getValue() || '#ffffff', (newValue) => {
        this.setValue(newValue);
        repaint();
      });
    };

    // Best-effort initial paint -- a few frames out so we beat any
    // race with Blockly's own rendering pass.
    requestAnimationFrame(() =>
      requestAnimationFrame(repaint));
    const onChange = field.onFinishEditing_;
    field.onFinishEditing_ = function(v) {
      if (onChange) onChange.call(this, v);
      repaint();
    };
  };
})();

// ===== Color-picker modal =====
//
// One shared modal, lazily wired on first open. Caller passes the
// current hex value and a callback that fires only on OK -- Cancel
// dismisses without committing, which is what the user expects from
// a typical "pick a color" dialog.
let colorModalCallback = null;
function openColorModal(initialHex, onOk) {
  const modal = document.getElementById('color-modal');
  const picker = document.getElementById('color-modal-picker');
  const hex = document.getElementById('color-modal-hex');

  // Normalize the incoming value so the native picker is happy.
  const m = (initialHex || '#ffffff').match(/^#?([0-9a-f]{6})$/i);
  const value = m ? '#' + m[1].toLowerCase() : '#ffffff';
  picker.value = value;
  hex.textContent = value;

  // Live hex readout while the user drags inside the color wheel.
  const onPick = () => { hex.textContent = picker.value; };
  picker.addEventListener('input', onPick);

  colorModalCallback = { onOk, cleanup: () => {
    picker.removeEventListener('input', onPick);
  } };
  modal.classList.add('show');
}
document.getElementById('color-modal-ok').addEventListener('click', () => {
  const picker = document.getElementById('color-modal-picker');
  const cb = colorModalCallback;
  document.getElementById('color-modal').classList.remove('show');
  if (cb) {
    cb.cleanup();
    cb.onOk(picker.value);
  }
  colorModalCallback = null;
});
document.getElementById('color-modal-cancel').addEventListener('click', () => {
  if (colorModalCallback) colorModalCallback.cleanup();
  colorModalCallback = null;
  document.getElementById('color-modal').classList.remove('show');
});
// Click on the dimmed background also cancels.
document.getElementById('color-modal').addEventListener('click', (e) => {
  if (e.target.id === 'color-modal') {
    if (colorModalCallback) colorModalCallback.cleanup();
    colorModalCallback = null;
    e.currentTarget.classList.remove('show');
  }
});

