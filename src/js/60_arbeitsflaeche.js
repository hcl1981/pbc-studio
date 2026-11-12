/* =====================================================================
 * Workspace
 * ===================================================================== */

function setupWorkspace() {
  workspace = Blockly.inject('blockly', {
    grid: { spacing: 24, length: 1, color: '#1a2230', snap: true },
    // scaleSpeed = factor applied per +/- click. 1.2 means each press
    // grows/shrinks the workspace by 20 %; the previous 1.1 (= 10 %)
    // felt too gradual.
    zoom: { controls: true, wheel: true, startScale: 1.0,
            maxScale: 3, minScale: 0.3, scaleSpeed: 1.2 },
    trashcan: false,
    scrollbars: true,
    move: { scrollbars: true, drag: true, wheel: false },
    theme: makeDarkTheme(),
    renderer: 'zelos',
    // Icons and sounds from jsdelivr (cdnjs lacks the .wav files): the default host (blockly-demo.appspot.com)
    // sends no CORP header, so with COEP require-corp (needed for Safari,
    // see src/htaccess) they would be blocked.
    media: 'https://cdn.jsdelivr.net/npm/blockly@12.3.1/media/',
  });
  workspace.addChangeListener(updateCodeView);

  // No gear on ANY if-block: spawnBlock strips it, but loaded, pasted and
  // duplicated blocks come in through BLOCK_CREATE and kept it.
  workspace.addChangeListener((e) => {
    if (e.type !== Blockly.Events.BLOCK_CREATE) return;
    (e.ids || [e.blockId]).forEach(id => {
      const b = workspace.getBlockById(id);
      if (b && b.type === 'controls_if') stripMutatorIcon(b);
    });
  });

  // Persist the block workspace to localStorage on every change so a
  // browser reload (F5, accidental Ctrl-R, tab restored after crash)
  // doesn't wipe the student's work. Sister to TEXT_BUF_KEY which
  // already does the same for the text editor.
  // We coalesce rapid changes (dragging a block fires many events)
  // with a small debounce so we're not thrashing localStorage.
  let _persistTimer = null;
  workspace.addChangeListener((e) => {
    // Skip UI-only events (selection, scroll) -- only persist on
    // real model mutations.
    if (e.isUiEvent) return;
    clearTimeout(_persistTimer);
    _persistTimer = setTimeout(persistWorkspace, 250);
  });

  // Rebuild the Variables sidebar entry when variables are
  // added / deleted / renamed elsewhere (e.g. via the right-click
  // menu on a variable block).
  workspace.addChangeListener((e) => {
    if (e.type === Blockly.Events.VAR_CREATE ||
        e.type === Blockly.Events.VAR_DELETE ||
        e.type === Blockly.Events.VAR_RENAME) {
      // Keep STRING_VAR_NAMES in sync with rename/delete events from
      // the right-click "rename / delete variable" menu.
      if (e.type === Blockly.Events.VAR_RENAME &&
          STRING_VAR_NAMES.has(e.oldName)) {
        STRING_VAR_NAMES.delete(e.oldName);
        STRING_VAR_NAMES.add(e.newName);
      }
      if (e.type === Blockly.Events.VAR_RENAME &&
          USER_VAR_NAMES.has(e.oldName)) {
        USER_VAR_NAMES.delete(e.oldName);
        USER_VAR_NAMES.add(e.newName);
      }
      if (e.type === Blockly.Events.VAR_DELETE &&
          STRING_VAR_NAMES.has(e.varName)) {
        STRING_VAR_NAMES.delete(e.varName);
      }
      if (e.type === Blockly.Events.VAR_DELETE &&
          USER_VAR_NAMES.has(e.varName)) {
        USER_VAR_NAMES.delete(e.varName);
      }
      refreshVariablesCategory();
    }
    // Whenever a block is deleted, the variable(s) it referenced
    // may have just lost their last user. purgeUnusedDefaultVariables
    // sweeps any orphaned variables (turtle `t`, "Element" stand-ins,
    // anything else) out of the variable map and refreshes the
    // sidebar so the entry disappears with the block.
    if (e.type === Blockly.Events.BLOCK_DELETE) {
      purgeUnusedDefaultVariables();
      refreshVariablesCategory();
    }
    // Whenever a color-picker block is created (manually, from a
    // load, or as part of the demo program), trigger a repaint so the
    // hex value is reflected as a visible colored swatch immediately
    // -- the user shouldn't need to click the field first.
    if (e.type === Blockly.Events.BLOCK_CREATE) {
      (e.ids || []).forEach(id => {
        const b = workspace.getBlockById(id);
        if (!b) return;
        if (b.type === 'pbc_color_picker') {
          const field = b.getField('COLOR');
          if (field && field._repaint) {
            requestAnimationFrame(() => field._repaint());
          }
        }
      });
      // Variable-bearing blocks (controls_for, variables_set,
      // variables_get, etc.) may have implicitly created a new
      // variable in the workspace that VAR_CREATE didn't surface
      // -- e.g. when dropping a controls_for whose `i` already
      // matches an existing variable name. Refresh the sidebar
      // so the user sees the variable in the category right away.
      refreshVariablesCategory();
    }
    // Methods category: rebuild whenever the set of method-def blocks
    // changes (created, deleted, or renamed). We can't watch a single
    // event type because a rename arrives as BLOCK_CHANGE with
    // element='field', so we check for any event that could have
    // touched a definition block.
    if (e.type === Blockly.Events.BLOCK_CREATE ||
        e.type === Blockly.Events.BLOCK_DELETE ||
        (e.type === Blockly.Events.BLOCK_CHANGE &&
         (e.element === 'field' || e.element === 'mutation'))) {
      // Cheap heuristic: just rebuild on every potentially-relevant
      // event. The category is small so the cost is negligible.
      // 'mutation' covers the gear editor changing a function's
      // parameters or return flag -- the sidebar's parameter buttons
      // and call entries must follow.
      refreshMethodsCategory();
    }
  });
}

/* =====================================================================
 * Sidebar as trash zone.
 *
 * When a student drags a block out of the workspace and drops it on
 * the category sidebar, the block (and its sub-stack) gets deleted.
 *
 * Implementation notes:
 *   - During a block drag Blockly captures the pointer on its own
 *     SVG element, so document-level mousemove listeners don't fire.
 *     We listen for pointermove directly on the workspace SVG (which
 *     still receives the captured events) AND in capture-phase on the
 *     document (caught before the SVG hand-off in some browsers).
 *   - We track the drag id via Blockly's BLOCK_DRAG event so we know
 *     when a drag starts and ends. On end, if the cursor was over the
 *     sidebar rect at the last pointermove, we dispose the block.
 *   - Visual cue: tint the sidebar red while a block is being dragged
 *     AND the cursor is over the sidebar.
 * ===================================================================== */
let _trashMouseX = -1, _trashMouseY = -1;
let _trashDraggingId = null;
// Workspace scroll position at the moment the drag started. When we
// trash a block, Blockly has already expanded its scroll area to make
// room for the (now-vanished) drop position. Restoring the original
// scroll keeps the visual stable.
let _trashScrollX = 0, _trashScrollY = 0;

function isOverSidebar(x, y) {
  const sb = document.getElementById('sidebar');
  if (!sb) return false;
  const r = sb.getBoundingClientRect();
  return x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
}

function updateTrashHover() {
  const sb = document.getElementById('sidebar');
  if (!sb) return;
  if (_trashDraggingId !== null &&
      isOverSidebar(_trashMouseX, _trashMouseY)) {
    sb.classList.add('trash-active');
  } else {
    sb.classList.remove('trash-active');
  }
}

function trackPointer(e) {
  _trashMouseX = e.clientX;
  _trashMouseY = e.clientY;
  if (_trashDraggingId !== null) updateTrashHover();
}

// Called on every pointerup. If a drag was in progress and ended over
// the sidebar, delete the dragged block. We trigger from pointerup
// instead of Blockly's BLOCK_DRAG end event because in Blockly 12 the
// end-of-drag event sometimes arrives with isStart left undefined
// (only isStart=true is reliably set), which made the original
// "else" branch never run.
function handlePointerUp() {
  if (_trashDraggingId === null) return;
  const wasOver = isOverSidebar(_trashMouseX, _trashMouseY);
  const id = _trashDraggingId;
  _trashDraggingId = null;
  updateTrashHover();
  if (wasOver && id) {
    const b = workspace.getBlockById(id);
    if (b && !b.isDeletable()) {
      // Block refuses to be deleted (currently only the pinned
      // "Beim Start" block). Nothing to say -- the block just
      // snaps back, which is the expected behaviour for fixed
      // anchors.
      return;
    }
    if (b && b.isDeletable()) {
      // Defer so Blockly's own drag-end housekeeping (snap-back,
      // event firing) finishes before we tear the block down.
      //
      // dispose(false) -- the `false` means "don't heal the stack",
      // which paradoxically is what we want: when a student drags a
      // 5-block stack onto the trash, all 5 should disappear. With
      // dispose(true) Blockly tries to preserve the trailing blocks
      // by re-parenting them, which on a dragged-out stack with no
      // parent results in the trailing blocks being left behind as
      // orphans. dispose(false) just nukes the whole sub-tree.
      //
      // After disposing, restore the scroll position to where it was
      // when the drag started. Blockly's drag-end logic has already
      // expanded the workspace bounds to accommodate the "dropped"
      // block; without the restore the scrollbars (and visible
      // viewport) shift even though the block is gone.
      setTimeout(() => {
        try {
          b.dispose(false);
          // Blockly enlarges the workspace's content-bounds to make
          // room for the (now-disposed) drop position. We have to ask
          // it to recompute those bounds against the actual blocks,
          // OTHERWISE the scrollbars still reflect the imaginary
          // larger area. Both calls below are safe no-ops if the
          // method doesn't exist on this Blockly version.
          if (workspace.resizeContents) workspace.resizeContents();
          if (workspace.cleanUp_)       workspace.cleanUp_();
          // After the content bounds are recomputed, restore the
          // scroll position we snapshotted at drag start.
          if (workspace.scroll) {
            workspace.scroll(_trashScrollX, _trashScrollY);
          }
          // Final nudge: schedule a second resize on the next
          // animation frame in case Blockly fires more layout work
          // after our setTimeout(0) completes.
          requestAnimationFrame(() => {
            if (workspace.resizeContents) workspace.resizeContents();
            if (workspace.scroll) {
              workspace.scroll(_trashScrollX, _trashScrollY);
            }
          });
        } catch (e) {}
      }, 0);
    }
  }
}

function setupSidebarTrash() {
  document.addEventListener('pointermove', trackPointer, { capture: true });
  document.addEventListener('mousemove',   trackPointer, { capture: true });
  document.addEventListener('pointerup',   handlePointerUp, { capture: true });
  document.addEventListener('mouseup',     handlePointerUp, { capture: true });

  const svg = workspace.getParentSvg && workspace.getParentSvg();
  if (svg) {
    svg.addEventListener('pointermove', trackPointer);
    svg.addEventListener('pointerup',   handlePointerUp);
  }

  // We only use BLOCK_DRAG for the START side -- to learn which block
  // is being dragged. The END side is handled via pointerup above,
  // which is more reliable across Blockly versions.
  workspace.addChangeListener((e) => {
    const isDrag = e.type === Blockly.Events.BLOCK_DRAG ||
                   e.type === 'drag';
    if (!isDrag) return;
    if (e.isStart) {
      _trashDraggingId = e.blockId;
      // Snapshot the workspace scroll position so we can restore it
      // after disposing a trashed block. Without this, Blockly's
      // scroll bounds adjust to wherever the drag ended -- which
      // makes the workspace jump around as if the block were really
      // placed there.
      _trashScrollX = workspace.scrollX || 0;
      _trashScrollY = workspace.scrollY || 0;
      updateTrashHover();
    }
  });
}

function makeDarkTheme() {
  return Blockly.Theme.defineTheme('pbc-dark', {
    base: Blockly.Themes.Classic,
    componentStyles: {
      workspaceBackgroundColour: '#0e1116',
      flyoutBackgroundColour:    '#1f2630',
      flyoutForegroundColour:    '#afbac4',
      flyoutOpacity:             1,
      scrollbarColour:           '#2d3744',
      insertionMarkerColour:     '#4f9eff',
      insertionMarkerOpacity:    0.4,
      scrollbarOpacity:          0.5,
      cursorColour:              '#4f9eff',
    },
  });
}

// Strip Blockly's mutator gear icon from a block. Used for the
// controls_if blocks since we expose if/else as separate sidebar
// entries already -- the gear's +/- editor would just be confusing
// clutter for students. The exact API for icon removal has shifted
// over Blockly releases, so we try each known route in order.
function stripMutatorIcon(block) {
  if (!block) return;
  try {
    // Blockly 11/12: block.removeIcon(IconType) -- IconType is a
    // class instance with name 'mutator'.
    if (Blockly.icons && Blockly.icons.MutatorIcon &&
        Blockly.icons.MutatorIcon.TYPE &&
        typeof block.removeIcon === 'function') {
      block.removeIcon(Blockly.icons.MutatorIcon.TYPE);
      return;
    }
    // Older path: setMutator(null) detaches the mutator extension.
    if (typeof block.setMutator === 'function') {
      block.setMutator(null);
      return;
    }
    // Last resort: filter the icons list manually. Works regardless
    // of API version because every icon has getType() returning
    // either a string or an object with a toString().
    if (Array.isArray(block.icons)) {
      block.icons = block.icons.filter(icon => {
        try {
          const tp = icon && icon.getType ? icon.getType() : null;
          const tpStr = tp ? String(tp).toLowerCase() : '';
          if (tpStr.includes('mutator')) {
            if (icon.dispose) icon.dispose();
            return false;
          }
        } catch (_) {}
        return true;
      });
    }
  } catch (e) {
    console.warn('stripMutatorIcon failed:', e);
  }
}

// Blocks whose TEXT value-input should get a ready-to-type string
// block attached automatically when spawned from the sidebar.
const TEXT_INPUT_BLOCKS = [
  'pbc_text', 'pbc_text18', 'pbc_text24',
  'canvas_text', 'canvas_text18', 'canvas_text24', 'console_print',
];

function spawnBlock(type, fields, dropAt) {
  try {
    // Pseudo-type: "controls_if_else" is the same Blockly block as
    // "controls_if", but with the else-clause already enabled via
    // its mutator. Lets the sidebar offer the two common shapes as
    // separate buttons without confronting students with Blockly's
    // plus/minus mutator UI.
    let postProcess = null;
    let realType = type;
    if (type === 'controls_if_else') {
      realType = 'controls_if';
      postProcess = (block) => {
        // Blockly 12 prefers loadExtraState({hasElse: true}); older
        // versions use the legacy mutation XML API. Try the modern
        // API first, fall back so we don't break on older releases.
        try {
          if (typeof block.loadExtraState === 'function') {
            block.loadExtraState({ hasElse: true });
          } else if (typeof block.domToMutation === 'function') {
            const mut = Blockly.utils.xml.createElement('mutation');
            mut.setAttribute('else', '1');
            block.domToMutation(mut);
          }
        } catch (e) {
          console.warn('controls_if_else mutator failed:', e);
        }
      };
    }
    if (type === 'controls_for') {
      // workspace.newBlock() doesn't materialise the shadow-number
      // defaults that the standard Blockly toolbox XML supplies for
      // FROM / TO / BY, so the inputs would otherwise spawn empty.
      // Manually attach shadow math_number blocks with sensible
      // starting values: 1, 10, 1 -- same as Blockly's stock defaults
      // and easy for students to edit.
      postProcess = (block) => {
        const attachShadow = (inputName, value) => {
          const inp = block.getInput(inputName);
          if (!inp || !inp.connection) return;
          if (inp.connection.targetBlock()) return;   // already set
          const shadow = workspace.newBlock('math_number');
          shadow.setShadow(true);
          const f = shadow.getField('NUM');
          if (f) f.setValue(value);
          shadow.initSvg();
          shadow.render();
          inp.connection.connect(shadow.outputConnection);
        };
        attachShadow('FROM', 1);
        attachShadow('TO',   10);
        attachShadow('BY',   1);
      };
    }
    // Text-output blocks (display text12/18/24, canvas text, console
    // print) all take a TEXT value input. workspace.newBlock() leaves
    // that input empty, which is unfriendly: the student has to know to
    // go find the string block in Mathe/Text first. Attach a real
    // (non-shadow) `text` block with an empty value so the quote-marks
    // field is right there, ready to type into -- same convenience the
    // default "Hallo PBC+!" demo shows.
    if (TEXT_INPUT_BLOCKS.indexOf(realType) >= 0) {
      const prev = postProcess;
      postProcess = (block) => {
        if (prev) prev(block);
        const inp = block.getInput('TEXT');
        if (!inp || !inp.connection) return;
        if (inp.connection.targetBlock()) return;   // already filled
        const txt = workspace.newBlock('text');
        // A "real" block (not a shadow) so it survives editing and is
        // obviously clickable; empty default so the student just types.
        const f = txt.getField('TEXT');
        if (f) f.setValue('');
        txt.initSvg();
        txt.render();
        inp.connection.connect(txt.outputConnection);
      };
    }
    // Silence Blockly events during the create-and-configure cycle.
    // variables_set / variables_get auto-create an "Element" stand-in
    // variable in their init() if no matching variable exists yet --
    // and we immediately overwrite it via setValue() below. Without
    // disable() Blockly fires a VAR_CREATE event for "Element" that
    // the sidebar listener sees, briefly flashing "Element" in the
    // Variables list before our setValue + purge cleans it up. Wrap
    // the whole sequence in disable/enable so external listeners see
    // exactly one atomic BLOCK_CREATE at the end.
    Blockly.Events.disable();
    let block;
    try {
      block = workspace.newBlock(realType);
      if (postProcess) postProcess(block);
      if (fields) {
        Object.keys(fields).forEach(k => {
          const f = block.getField(k);
          if (f) f.setValue(fields[k]);
        });
      }
      // Drop any orphan "Element" / "item" stand-in that init()
      // created before our setValue rebound the VAR field.
      purgeUnusedDefaultVariables();
      block.initSvg();
      block.render();
    } finally {
      Blockly.Events.enable();
    }
    // Fire a single BLOCK_CREATE event for the configured block so
    // undo and the sidebar refresh see the final state.
    if (Blockly.Events.isEnabled()) {
      try {
        Blockly.Events.fire(new Blockly.Events.BlockCreate(block));
      } catch (e) { /* older Blockly may not have BlockCreate */ }
    }
    // controls_if ships with a mutator (the small gear icon that
    // opens the +/- editor for else / else-if). We expose if and
    // if/else as separate sidebar entries already, so the gear is
    // redundant clutter for the students -- strip it. Several APIs
    // for this exist across Blockly versions; try them in order.
    if (realType === 'controls_if') {
      stripMutatorIcon(block);
    }
    // Auto-fill empty value slots with default shadow blocks so each
    // socket already shows an editable "0" (or "") that the user can
    // change in place or replace by dragging a variable in.
    attachDefaultShadows(block);
    // Position the block. dropAt = {x,y} in workspace coordinates
    // (used by drag-and-drop from the sidebar) overrides the default
    // cascading-spawn position used for plain clicks.
    if (dropAt && typeof dropAt.x === 'number' && typeof dropAt.y === 'number') {
      block.moveBy(dropAt.x, dropAt.y);
      // Snap-to-nearest-connection is NOT done here -- the sidebar
      // drag handler instead hands the block over to Blockly's
      // native drag system, which provides snap with insertion-
      // marker preview for free.
    } else {
      block.moveBy(lastSpawnPos.x, lastSpawnPos.y);
      lastSpawnPos.x += 20;
      lastSpawnPos.y += 20;
      if (lastSpawnPos.x > 300) { lastSpawnPos.x = 50; lastSpawnPos.y = 50; }
    }
    return block;
  } catch (e) {
    toast(type + ' ' + t('konnte nicht erstellt werden:') + ' ' + e.message, 'bad');
    console.error(e);
    return null;
  }
}

// After a sidebar block is dropped onto the workspace at dropAt, try
// to dock it into a compatible connection on a nearby existing block.
// Without this we'd leave the student with a floating block they
// have to drag a second time to actually attach.
//
// Strategy: walk every connection on the new block, and for each
// look for the closest compatible connection on any other block.
// If we find one within a generous snap radius, move the new block
// so the two connections coincide, then connect them.
function trySnapToNearbyConnection(newBlock /*, dropAt */) {
  const match = findBestSnap(newBlock);
  if (!match) return;
  try {
    newBlock.moveBy(-match.dx, -match.dy);
    match.own.connect(match.other);
  } catch (e) {
    console.warn('snap connect failed:', e);
  }
}

// Returns { own, other, dx, dy, dist } for the best snap candidate
// near `newBlock`, or null when nothing's within range. Shared by
// trySnapToNearbyConnection (executes the snap) and the live drag
// preview (highlights the would-be target as you drag).
function findBestSnap(newBlock) {
  if (!newBlock || !newBlock.getConnections_) return null;
  const SNAP_RADIUS = 80;
  const ownConns = newBlock.getConnections_(true);
  if (!ownConns.length) return null;

  // OPPOSITE_TYPE maps Blockly's connection type constants to the
  // one they're allowed to plug into. We use this as a simple
  // compatibility check instead of canConnectWithReason, which has
  // moved/changed several times across Blockly versions and is
  // tricky to call from outside Blockly's own drag flow.
  const OPP = {};
  OPP[Blockly.PREVIOUS_STATEMENT] = Blockly.NEXT_STATEMENT;
  OPP[Blockly.NEXT_STATEMENT]     = Blockly.PREVIOUS_STATEMENT;
  OPP[Blockly.INPUT_VALUE]        = Blockly.OUTPUT_VALUE;
  OPP[Blockly.OUTPUT_VALUE]       = Blockly.INPUT_VALUE;

  // Type-check compatibility: if both sides declare a check list
  // (e.g. ['Number']) at least one entry must match. Either side
  // with no check is treated as "accepts anything".
  function checksOK(a, b) {
    const ac = a.getCheck ? a.getCheck() : null;
    const bc = b.getCheck ? b.getCheck() : null;
    if (!ac || !bc) return true;
    return ac.some(x => bc.includes(x));
  }

  // Build candidate pool: every free connection that is NOT on a
  // shadow and NOT inside the new block's own subtree.
  const others = [];
  workspace.getAllBlocks(false).forEach(b => {
    if (b === newBlock) return;
    if (b.isShadow && b.isShadow()) return;
    let p = b, inSubtree = false;
    while (p) {
      if (p === newBlock) { inSubtree = true; break; }
      p = p.getParent ? p.getParent() : null;
    }
    if (inSubtree) return;
    const conns = b.getConnections_ ? b.getConnections_(true) : [];
    for (const c of conns) {
      if (!c) continue;
      if (c.isConnected && c.isConnected()) continue;
      others.push(c);
    }
  });

  let best = null;
  for (const own of ownConns) {
    if (own.isConnected && own.isConnected()) continue;
    const ownOffset = own.getOffsetInBlock && own.getOffsetInBlock();
    if (!ownOffset) continue;
    const newTL = blockTopLeft(newBlock);
    const ownX  = newTL.x + ownOffset.x;
    const ownY  = newTL.y + ownOffset.y;
    for (const other of others) {
      if (OPP[own.type] !== other.type) continue;
      if (!checksOK(own, other)) continue;
      const otherBlock  = other.getSourceBlock && other.getSourceBlock();
      const otherOffset = other.getOffsetInBlock && other.getOffsetInBlock();
      if (!otherBlock || !otherOffset) continue;
      const otherTL = blockTopLeft(otherBlock);
      const otherX  = otherTL.x + otherOffset.x;
      const otherY  = otherTL.y + otherOffset.y;
      const dx = ownX - otherX;
      const dy = ownY - otherY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > SNAP_RADIUS) continue;
      if (!best || dist < best.dist) {
        best = { own, other, dist, dx, dy };
      }
    }
  }
  return best;
}

// Get the top-left of a block's body in workspace coordinates. Works
// across Blockly versions -- the relevant method has moved several
// times -- by trying the modern getRelativeToSurfaceXY first and
// falling back to xy_ / location_ properties.
function blockTopLeft(block) {
  if (!block) return new Blockly.utils.Coordinate(0, 0);
  if (typeof block.getRelativeToSurfaceXY === 'function') {
    return block.getRelativeToSurfaceXY();
  }
  if (block.xy_) return block.xy_;
  return new Blockly.utils.Coordinate(0, 0);
}

function attachDefaultShadows(block) {
  block.inputList.forEach(input => {
    if (!input.connection) return;
    if (input.connection.type !== Blockly.INPUT_VALUE) return;
    if (input.connection.targetConnection) return;     // already wired

    const checks = input.connection.getCheck();        // null = any
    let shadowType = null;
    let shadowFields = null;

    // Colour inputs: every "Farbe"-slot gets a "Farbe nach Namen"
    // shadow (pbc_color_named) -- a friendly named-colour dropdown
    // (weiß, schwarz, rot, …) rather than an r/g/b number mixer, which
    // is much easier for kids. That way the student can start drawing
    // immediately without first hunting down a colour block, AND --
    // because the shadow is editable in-place -- they can pick another
    // colour right in the socket. Plugging in a real colour block
    // (Farbwähler, Farbe(r,g,b), …) overrides the shadow as usual.
    //
    // Background-fill blocks (whole display or a canvas) default to
    // BLACK -- the natural "erase to background" colour. Every other
    // colour slot defaults to WHITE, the natural "draw something
    // visible" colour on the device's black screen. (We identify
    // colour slots by their socket NAME being COLOR or PEN_COLOR;
    // without this branch the Number type-check below would install a
    // "0" math_number shadow, i.e. invisible black.)
    if (input.name === 'COLOR' || input.name === 'PEN_COLOR') {
      shadowType   = 'pbc_color_named';
      shadowFields = { NAME:
        (block.type === 'pbc_fill' || block.type === 'canvas_fill')
          ? 'BLACK' : 'WHITE' };
    } else if (block.type === 'variables_set' && input.name === 'VALUE') {
      const vm = block.getVarModels && block.getVarModels()[0];
      if (vm && STRING_VAR_NAMES.has(vm.name)) {
        shadowType   = 'text';
        shadowFields = { TEXT: '' };
      } else {
        shadowType   = 'math_number';
        shadowFields = { NUM: 0 };
      }
    } else if (!checks) {
      // No type check at all -- this slot accepts any value and is
      // almost always an object input (image, sprite, canvas). The
      // empty socket signals the user that a real value goes here;
      // attaching a "0" shadow would be both wrong (Sprite from 0?)
      // and misleading. Leave it empty.
      return;
    } else if (checks.includes('Number')) {
      shadowType = 'math_number';
      shadowFields = { NUM: 0 };
    } else if (checks.includes('String')) {
      shadowType = 'text';
      shadowFields = { TEXT: '' };
    } else {
      // Object-typed inputs (e.g. canvas, sprite) get no shadow --
      // the empty socket signals the user that a real value goes here.
      return;
    }
    try {
      const shadow = workspace.newBlock(shadowType);
      if (shadowFields) {
        Object.keys(shadowFields).forEach(f => {
          const fld = shadow.getField(f);
          if (fld) fld.setValue(shadowFields[f]);
        });
      }
      // Recursively prepare the shadow's own sockets (e.g. a math/text
      // shadow that itself has empty inputs). The pbc_color_named
      // shadow has only a dropdown field and no value sockets, so this
      // is a harmless no-op for colour slots.
      shadow.setShadow(true);
      shadow.initSvg();
      shadow.render();
      attachDefaultShadows(shadow);
      input.connection.connect(shadow.outputConnection);
    } catch (e) { console.warn('shadow attach failed:', e); }
  });
}

