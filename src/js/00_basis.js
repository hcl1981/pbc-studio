'use strict';

// User-facing version = build date + a running build number. The build
// number is simply how many times this file has been built; it goes up
// by one with every build (no manual version bookkeeping needed). Shown
// only in the terminal banner. APP_BUILD doubles as the internal build
// marker, so there's a single source of truth.
const APP_BUILD = 135;
const APP_DATE  = '2026-10-29';   // build.py sets the day of the build

/* =====================================================================
 * Quiet Blockly's internal deprecation warning. Blockly 12's own
 * serialization code still calls Workspace.getAllVariables() (the
 * deprecated method) under the hood, which prints a noisy warning to
 * the console every time we load a workspace. Nothing we do in this
 * file triggers it -- it's Blockly calling its own deprecated method.
 * We filter just that one message out of console.warn so the real
 * console stays useful for actual debugging.
 * ===================================================================== */
(function quietBlocklyDeprecation() {
  const origWarn = console.warn;
  console.warn = function(...args) {
    const msg = args.map(String).join(' ');
    if (msg.indexOf('getAllVariables was deprecated') >= 0) return;
    origWarn.apply(console, args);
  };
})();

/* =====================================================================
 * Override Blockly's built-in German translation of "wenn" with
 * "falls". The sidebar uses "falls" (matches our internal naming),
 * so the rendered block label needs to agree -- otherwise the same
 * concept reads two different ways depending on where you look.
 *
 * Only kicks in for the German build of Blockly Msg -- in English
 * Blockly already says "if", which we want to keep.
 * ===================================================================== */
(function tweakBlocklyMessages() {
  if (typeof Blockly === 'undefined' || !Blockly.Msg) return;
  // The German bundle uses "wenn" for both keywords. We override
  // only if that's what's currently loaded; an English build would
  // already say "if" / "else if".
  if (Blockly.Msg.CONTROLS_IF_MSG_IF === 'wenn') {
    Blockly.Msg.CONTROLS_IF_MSG_IF = 'falls';
  }
  if (Blockly.Msg.CONTROLS_IF_MSG_ELSEIF === 'wenn') {
    Blockly.Msg.CONTROLS_IF_MSG_ELSEIF = 'sonst falls';
  }
})();

/* =====================================================================
 * Strip the "Rename variable…" and "Delete the 'x' variable" entries
 * from every variable-picker dropdown in the workspace. Those entries
 * make sense in a teaching environment, but they let a 6th-grader
 * casually destroy the variable that other blocks (especially turtle
 * commands) still reference -- which leads to NameError-style
 * crashes that look like the IDE is broken.
 *
 * Approach: monkey-patch FieldVariable.dropdownCreate_ to filter out
 * the two terminal "internal" options. They're identified by their
 * special sentinel values in Blockly.RENAME_VARIABLE_ID /
 * DELETE_VARIABLE_ID. We do this once, after Blockly has loaded, and
 * it applies to every variable field on every block thereafter.
 *
 * Students who want to delete a variable still can -- the X button
 * in the Variables / Texts sidebar does the deed properly, with the
 * confirm dialog and the safe "detach embedded values first"
 * cleanup.
 * ===================================================================== */
// A turtle command block (turtle_forward, turtle_left, …) – but not
// "neue Turtle" itself, which names a new turtle instead of picking one.
function istTurtleBefehl(block) {
  return !!(block && block.type && block.type.startsWith('turtle_') && block.type !== 'turtle_new');
}

(function stripVariablePickerEdits() {
  if (typeof Blockly === 'undefined' || !Blockly.FieldVariable) return;
  const FV = Blockly.FieldVariable;
  const original = FV.dropdownCreate;
  if (typeof original !== 'function') return;
  FV.dropdownCreate = function() {
    // Turtle commands (forward, left, …) pick among the turtles only:
    // every variable that a "neue Turtle" block creates, nothing else.
    const block = this.getSourceBlock && this.getSourceBlock();
    if (istTurtleBefehl(block) && typeof existingTurtleVariables === 'function') {
      const turtles = existingTurtleVariables().map(v => [v.getName(), v.getId()]);
      const aktuell = this.getVariable && this.getVariable();
      if (aktuell && !turtles.some(o => o[1] === aktuell.getId())) {
        turtles.unshift([aktuell.getName(), aktuell.getId()]);
      }
      if (turtles.length) return turtles;
    }
    const opts = original.call(this);
    if (!Array.isArray(opts)) return opts;
    // The field's own current variable always stays in the list.
    // Blockly 12 rebuilds these options on every setValue() and throws
    // "FieldDropdown options must not be an empty array" if nothing is
    // left -- which happened on turtle_* blocks whenever every variable
    // on the workspace was a turtle (the block's own turtle included).
    const currentId = this.getValue && this.getValue();
    const filtered = opts.filter(opt => {
      // Each entry is [display, value]. The two we want gone are
      // tagged with the Blockly.RENAME_VARIABLE_ID and
      // DELETE_VARIABLE_ID sentinel strings.
      const value = opt && opt[1];
      if (value === Blockly.RENAME_VARIABLE_ID) return false;
      if (value === Blockly.DELETE_VARIABLE_ID) return false;
      if (value === currentId) return true;
      // Turtle-instance variables (the implicit `t`) hold Turtle
      // objects; overwriting one with "setze t auf 5" would break
      // every turtle command, so they never appear in the picker.
      const ws = this.getSourceBlock && this.getSourceBlock() &&
                 this.getSourceBlock().workspace;
      const v = ws && ws.getVariableMap &&
                ws.getVariableMap().getVariableById(value);
      if (v && typeof isTurtleVariable === 'function' &&
          isTurtleVariable(v)) return false;
      return true;
    });
    // Last-resort guard: never hand Blockly an empty list.
    return filtered.length ? filtered : opts.slice(0, 1);
  };

  // Only the "setze … auf …" block (variables_set) keeps its picker:
  // the sidebar spawns it pre-set to the first variable, and with
  // several variables the dropdown is the only way to target another
  // one. Every other variable field stays fixed (see below).
  const isPickable = (field) => {
    const b = field.getSourceBlock && field.getSourceBlock();
    if (!b) return false;
    if (b.type === 'variables_set') return true;
    // Turtle commands spawn with the FIRST turtle; with two or more
    // turtles the picker is the only way to address another one. It
    // lists turtles only (dropdownCreate above).
    if (istTurtleBefehl(b)) return true;
    // List blocks are spawned with the FIRST list and there is no
    // per-list sidebar entry: with two or more lists the picker is the
    // only way to choose another one. It lists lists only (the field's
    // variableTypes).
    const types = field.variableTypes || (field.getVariableTypes_ && field.getVariableTypes_());
    return Array.isArray(types) && types.indexOf('List') >= 0;
  };

  // Variable blocks must not let students switch from one variable name
  // to another via the field dropdown. Once a variable block is on the
  // canvas its name is fixed -- to use a different variable, the matching
  // variable block has to be dragged in. We disable the field editor so
  // clicking the variable name no longer opens any picker dropdown --
  // except on variables_set (isPickable), which has no per-variable
  // sidebar entry to drag in instead.
  if (FV.prototype && typeof FV.prototype.showEditor_ === 'function') {
    const origShowEditor = FV.prototype.showEditor_;
    FV.prototype.showEditor_ = function(e) {
      if (isPickable(this)) return origShowEditor.call(this, e);
    };
  }

  // With the picker gone, the inherited dropdown ▾ arrow next to the
  // variable name is just visual noise (it suggests a menu that no
  // longer opens). FieldVariable extends FieldDropdown, which draws the
  // arrow via createTextArrow_ / createSVGArrow_. We no-op both ON THE
  // VARIABLE FIELD ONLY -- method-call and other real dropdowns keep
  // their arrow. arrowWidth_ stays 0, so no blank space is reserved.
  // variables_set keeps its arrow, since its picker still opens.
  if (FV.prototype) {
    const origTextArrow = FV.prototype.createTextArrow_;
    const origSVGArrow  = FV.prototype.createSVGArrow_;
    FV.prototype.createTextArrow_ = function() {
      if (isPickable(this) && origTextArrow) return origTextArrow.call(this);
    };
    FV.prototype.createSVGArrow_ = function() {
      if (isPickable(this) && origSVGArrow) return origSVGArrow.call(this);
    };
    // Belt-and-suspenders: if a future build creates the arrow before
    // those hooks run, strip whatever arrow node ended up in the field.
    const origInitView = FV.prototype.initView;
    if (typeof origInitView === 'function') {
      FV.prototype.initView = function() {
        origInitView.call(this);
        if (isPickable(this)) return;
        [this.svgArrow_, this.arrow_].forEach(node => {
          if (node && node.parentNode) {
            try { node.parentNode.removeChild(node); } catch (e) {}
          }
        });
        this.svgArrow_ = null;
        this.arrow_ = null;
        this.arrowWidth_ = 0;
      };
    }
  }
})();

/* =====================================================================
 * Boot-time sanity check: make sure all CDN libs actually loaded.
 * ===================================================================== */

function bootError(msg) {
  const el = document.getElementById('boot-error');
  el.innerHTML = '<h1>PBC+ Studio kann nicht starten</h1>' + msg;
  el.classList.add('show');
}

