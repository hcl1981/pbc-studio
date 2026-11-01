/* =====================================================================
 * Sidebar
 * ===================================================================== */

let workspace;
let lastSpawnPos = { x: 50, y: 50 };

/* =====================================================================
 * Help sidebar (text mode).
 *
 * Builds a clickable list of help entries on the left, grouped by
 * category and section. Clicking an entry renders its content in the
 * help panel on the right and offers an "Einfügen" button for
 * snippet entries.
 * ===================================================================== */

function buildHelpSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';
  HELP_CATEGORIES.forEach((cat, idx) => {
    const div = document.createElement('div');
    div.className = 'cat';
    // Match the block-sidebar behaviour: every category starts
    // closed. The user can expand whichever one they want.
    div.innerHTML = `
      <div class="cat-header">
        <span>${L(cat.label)}</span>
        <span class="cat-toggle">▶</span>
      </div>
      <div class="cat-body"></div>`;
    div.querySelector('.cat-header').addEventListener('click', () => {
      div.classList.toggle('open');
    });
    const body = div.querySelector('.cat-body');

    cat.sections.forEach((sec, secIdx) => {
      // For consistency with multi-section categories, give single-
      // section categories a clickable sub-header too: if the cat
      // has an intro and its only section is untitled, promote that
      // section to have title = cat.label and intro = cat.intro.
      let title = sec.title;
      let intro = sec.intro;
      if (!title && cat.intro &&
          cat.sections.length === 1 && secIdx === 0) {
        title = cat.label;
        intro = cat.intro;
      }

      if (secIdx > 0) {
        const hr = document.createElement('div');
        hr.className = 'help-divider' +
                       (sec.divider === 'long' ? ' long' : '');
        body.appendChild(hr);
      }
      if (title) {
        const t = document.createElement('div');
        t.className = 'help-sec-header';
        t.textContent = L(title);
        if (intro) {
          t.classList.add('clickable');
          t.addEventListener('click', () => {
            showHelp({
              id: 'sec-' + cat.key + '-' + secIdx,
              label: title,
              content: intro,
            });
          });
        }
        body.appendChild(t);
      }
      sec.entries.forEach(entry => {
        const btn = document.createElement('button');
        btn.className = 'help-entry';
        btn.textContent = L(entry.label);
        btn.dataset.helpId = entry.id;
        btn.addEventListener('click', () => showHelp(entry));
        body.appendChild(btn);
      });
    });

    sidebar.appendChild(div);
  });
}

// Escape any HTML special characters in user-supplied code so they
// render literally (so a < or & in an example doesn't blow up).
function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function showHelp(entry) {
  // Open the pane if the user previously closed it.
  document.getElementById('helppane').hidden = false;

  // Highlight the active entry in the sidebar.
  document.querySelectorAll('.help-entry').forEach(b => {
    b.classList.toggle('active', b.dataset.helpId === entry.id);
  });

  const titleEl = document.getElementById('helppane-title');
  const bodyEl  = document.getElementById('helppane-body');
  titleEl.textContent = L(entry.label);

  const c = entry.content;
  let html = L(c.body) || '';
  if (c.signature) {
    html += `<div class="helppane-signature">${escHtml(L(c.signature))}</div>`;
  }
  if (c.example) {
    const exampleHeading = LANG === 'en' ? 'Example' : 'Beispiel';
    html += `<p style="font-weight:600;margin-bottom:4px;">${exampleHeading}</p>` +
            `<pre><code>${escHtml(L(c.example))}</code></pre>`;
  }
  // The insert button uses an explicit `insert` snippet when one is
  // defined (typically a short fill-in-the-blank template), and
  // falls back to the full example so every topic with an example
  // is one click away from "I have working code in my editor".
  const insertSnippet = c.insert !== undefined ? c.insert : c.example;
  if (insertSnippet) {
    const insertLabel = LANG === 'en'
      ? 'Insert into editor'
      : 'In den Editor einfügen';
    html +=
      `<button class="helppane-insert" id="helppane-insert-btn">` +
      `${insertLabel}</button>`;
  }
  bodyEl.innerHTML = html;

  if (insertSnippet) {
    document.getElementById('helppane-insert-btn').addEventListener('click', () => {
      let s = L(insertSnippet);
      // Trailing newline so the next line in the editor stays clean.
      if (!s.endsWith('\n')) s += '\n';
      insertAtCursor(s);
    });
  }
}

// Insert a snippet at the current cursor position in the CodeMirror
// editor. Used by the "Einfügen" button on help cards.
function insertAtCursor(snippet) {
  if (!codeEditor) return;
  const doc = codeEditor.getDoc();
  doc.replaceSelection(snippet);
  codeEditor.focus();
}

function buildSidebar() {
  const sidebar = document.getElementById('sidebar');
  sidebar.innerHTML = '';   // allow rebuilds (e.g. after settings change)

  // Search box, pinned at the top. Filters the already-rendered block
  // buttons by label so the existing drag/spawn wiring is reused as-is.
  const searchWrap = document.createElement('div');
  searchWrap.className = 'blk-search-wrap';
  searchWrap.innerHTML =
    `<input type="text" class="blk-search" id="blk-search"` +
    ` placeholder="${t('Blöcke suchen…')}"` +
    ` autocomplete="off" autocorrect="off" spellcheck="false">` +
    `<button class="blk-search-clear" id="blk-search-clear"` +
    ` title="${t('Suche löschen')}" tabindex="-1">×</button>`;
  sidebar.appendChild(searchWrap);
  const emptyMsg = document.createElement('div');
  emptyMsg.className = 'blk-search-empty';
  emptyMsg.id = 'blk-search-empty';
  emptyMsg.textContent = t('Keine passenden Blöcke.');

  CATEGORIES.forEach((cat, idx) => {
    // External sensors: skip the whole category if nothing's enabled.
    // The user enables sensors in the Einstellungen dialog.
    if (cat.key === 'ext' && activeSensors().length === 0) {
      return;
    }

    const div = document.createElement('div');
    div.className = 'cat';      // all collapsed at start
    div.dataset.catKey = cat.key;   // so refresh fns can find this
                                    // category by key, not by a fragile
                                    // index (the 'ext' category is
                                    // skipped when no sensor is active,
                                    // which would shift positional
                                    // lookups by one).
    div.innerHTML = `
      <div class="cat-header">
        <span>${cat.label}</span>
        <span class="cat-toggle">▶</span>
      </div>
      <div class="cat-body"></div>`;
    div.querySelector('.cat-header').addEventListener('click', () => {
      div.classList.toggle('open');
    });

    const body = div.querySelector('.cat-body');

    // Variables, Methods, and Sprites are special -- they rebuild
    // dynamically from the current workspace state. Dispatch to the
    // right renderer per category key.
    if (STD_BLOCKS[cat.key] === 'DYNAMIC') {
      if (cat.key === 'methods') {
        renderMethodButtons(body);
      } else if (cat.key === 'sprite') {
        renderSpriteButtons(body);
      } else if (cat.key === 'canvas') {
        renderCanvasButtons(body);
      } else if (cat.key === 'lists') {
        renderListButtons(body);
      } else {
        renderVariableButtons(body);
      }
      sidebar.appendChild(div);
      return;
    }

    // Render the standard Blockly blocks first (if any) -- these have
    // a per-category neutral color so they're visually distinct from
    // PBC-specific blocks. Then append any PBC blocks tagged with
    // this category, so e.g. `pbc_forever` ends up under
    // "Kontrollstrukturen" right after the basic if/loop blocks.
    const stdColor = {
      math:      '#7ea4d7',
      control:   '#c98ad6',
      text:      '#5f9ea0',
      time:      '#c0925a',
      misc:      COLORS_HUE.misc || '#9b8c7a',
    }[cat.key] || '#888';
    if (STD_BLOCKS[cat.key]) {
      STD_BLOCKS[cat.key].forEach(([type, label]) => {
        addBtn(body, label, stdColor, (dropAt) => spawnBlock(type, undefined, dropAt));
      });
    }
    if (cat.key === 'ext') {
      // Group blocks under a subheader per active sensor so the
      // category reads like "PCF8523: 7 blocks, SHT40: 3 blocks"
      // instead of a flat 10-button wall. Keeps the kategorie tidy
      // when both sensors are enabled, and friendly when more are
      // added later.
      activeSensors().forEach(sid => {
        const meta = EXT_SENSORS_CATALOG[sid];
        const hdr = document.createElement('div');
        hdr.className = 'sec-header';
        hdr.textContent = (meta && t(meta.label)) || sid;
        body.appendChild(hdr);
        PBC_BLOCKS.filter(b => b.cat === 'ext' && b.requires === sid)
          .forEach(entry => {
            addBtn(body, entry.label, COLORS_HUE.sensor,
                   (dropAt) => spawnBlock(entry.def.type, undefined, dropAt));
          });
      });
    } else {
      // Filter then sort: blocks whose `cat` is an array (multi-
      // category, like the colour picker / Farbe-rgb mixers that live
      // in display + canvas + turtle + led) get pushed to the bottom
      // of the sidebar entry list. Without this, they appear wherever
      // they happen to be declared in PBC_BLOCKS -- which is up in the
      // display block region -- and end up at the *top* of every
      // category that includes them, ahead of the primary action
      // blocks. Sort.is stable, so blocks with the same rank keep
      // their declaration order.
      const entries = PBC_BLOCKS.filter(b => {
        if (!blockInCategory(b, cat.key)) return false;
        if (b.hidden) return false;
        if (b.requires && !EXT_SETTINGS.enabled[b.requires]) return false;
        return true;
      });
      const rank = (b) => Array.isArray(b.cat) ? 1 : 0;
      entries.sort((a, b) => rank(a) - rank(b));
      entries.forEach(entry => {
        const spawnFn = entry.customSpawn
          ? (dropAt) => entry.customSpawn(dropAt)
          : (dropAt) => spawnBlock(entry.def.type, undefined, dropAt);
        // Entries that open a dialog before spawning (currently
        // turtle_new) can't sensibly participate in drag: a dialog
        // would pop up mid-drag and break the hand-off. Mark those
        // with dialogSpawn: true in the block def to wire them
        // click-only.
        const opts = entry.dialogSpawn ? { noDrag: true } : undefined;
        addBtn(body, entry.label,
               COLORS_HUE[cat.key] || stdColor, spawnFn, opts);
      });
    }

    sidebar.appendChild(div);
  });

  // Fixed area BELOW all the categories: the comment block. It's not
  // a real category (it would otherwise be a one-block section the
  // student has to expand); instead it sits permanently visible at the
  // bottom so a "# Kommentar" can be dropped in from anywhere without
  // hunting through a menu.
  const commentEntry = PBC_BLOCKS.find(b => b.cat === '__comment__');
  if (commentEntry) {
    // The comment sits at RUBRIC LEVEL: a single entry styled like a
    // category header (not a header + a block underneath). Clicking or
    // dragging it spawns the comment block directly. No collapsible
    // body -- there's only ever one thing here.
    const entry = document.createElement('div');
    entry.className = 'cat cat-rubric-entry';
    entry.innerHTML = `
      <div class="cat-header">
        <span>${commentEntry.label}</span>
      </div>`;
    const header = entry.querySelector('.cat-header');
    enableSidebarDrag(header, commentEntry.label,
                      COLORS_HUE.misc || '#9b8c7a',
                      (dropAt) => spawnBlock(commentEntry.def.type,
                                             undefined, dropAt));
    sidebar.appendChild(entry);
  }

  sidebar.appendChild(emptyMsg);
  wireSidebarSearch();
}

// Wire the block search box: typing filters the rendered block buttons
// by label. Matching categories are force-opened and their non-matching
// buttons hidden; categories with no match are hidden entirely. Clearing
// the box restores the normal collapsed view.
function wireSidebarSearch() {
  const input = document.getElementById('blk-search');
  const clear = document.getElementById('blk-search-clear');
  const wrap  = input && input.closest('.blk-search-wrap');
  const empty = document.getElementById('blk-search-empty');
  const sidebar = document.getElementById('sidebar');
  if (!input) return;

  // Normalize for accent/case-insensitive matching (ä->a etc. so
  // "grosse"/"große" and "Zahl" both behave intuitively).
  const norm = (s) => (s || '').toLowerCase()
    .replace(/ä/g, 'a').replace(/ö/g, 'o').replace(/ü/g, 'u')
    .replace(/ß/g, 'ss');

  function applyFilter() {
    const q = norm(input.value.trim());
    wrap.classList.toggle('has-text', input.value.length > 0);
    const cats = sidebar.querySelectorAll('.cat');

    if (!q) {
      // Restore normal view: un-hide everything, and re-close exactly
      // the categories that the SEARCH opened (tracked via the
      // data-search-opened marker), so categories the user had open
      // before searching stay open and search-opened ones collapse.
      cats.forEach(c => {
        c.classList.remove('search-hidden');
        c.querySelectorAll('.blk-btn').forEach(b =>
          b.classList.remove('search-hidden'));
        if (c.dataset.searchOpened === '1') {
          c.classList.remove('open');
          delete c.dataset.searchOpened;
        }
      });
      if (empty) empty.style.display = 'none';
      return;
    }

    let anyMatch = false;
    cats.forEach(c => {
      // The comment rubric-entry has no body/buttons; match on its
      // header label so it can still be found by searching "kommentar".
      const isRubricEntry = c.classList.contains('cat-rubric-entry');
      if (isRubricEntry) {
        const label = norm(c.querySelector('.cat-header span')?.textContent);
        const hit = label.includes(q);
        c.classList.toggle('search-hidden', !hit);
        if (hit) anyMatch = true;
        return;
      }
      const btns = c.querySelectorAll('.blk-btn');
      let catHasMatch = false;
      btns.forEach(b => {
        // The label text sits after the colour swatch span.
        const label = norm(b.textContent);
        const hit = label.includes(q);
        b.classList.toggle('search-hidden', !hit);
        if (hit) catHasMatch = true;
      });
      c.classList.toggle('search-hidden', !catHasMatch);
      if (catHasMatch) {
        // Force-open so matches are visible. Remember if WE opened it
        // (it was closed before) so clearing the search re-closes only
        // these, leaving the user's pre-search open categories alone.
        if (!c.classList.contains('open')) {
          c.dataset.searchOpened = '1';
          c.classList.add('open');
        }
        anyMatch = true;
      }
    });
    if (empty) empty.style.display = anyMatch ? 'none' : 'block';
  }

  input.addEventListener('input', applyFilter);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { input.value = ''; applyFilter(); input.blur(); }
  });
  if (clear) {
    clear.addEventListener('click', () => {
      input.value = ''; applyFilter(); input.focus();
    });
  }
}

// Render the body of the "Variables" sidebar category.
// One pair of buttons per existing variable (read + set), plus a
// general "new variable" button at the top. The list updates whenever
// the workspace fires a VAR_CREATE / VAR_DELETE / VAR_RENAME event.
// Variables flagged as "string-typed" by the user. Stored by name
// because Blockly's variable IDs are not stable across save/load.
// Persisted alongside the workspace in .pbcp files.
let STRING_VAR_NAMES = new Set();
// Variables that hold a pbc.Canvas() instance, created via the
// "+ neues Canvas…" sidebar button. Like STRING_VAR_NAMES we keep
// them in a separate set by name so the sidebar can list canvases
// in their own section and the dropdowns on display blocks can
// offer them as a draw target.
let CANVAS_VAR_NAMES = new Set();

// Variables the student created on purpose via "+ neue Variable…" /
// "+ neuer Text…". Tracked by name (like STRING_VAR_NAMES, because
// Blockly's variable IDs aren't stable across save/load) so that
// purgeUnusedDefaultVariables never sweeps away a freshly-created
// variable that doesn't have a block on the canvas yet. Without this,
// dragging one variable onto the workspace fires a BLOCK_DELETE during
// the drag, which used to purge every other still-block-less variable
// out of the sidebar list.
let USER_VAR_NAMES = new Set();

// Lists are Blockly variables of their own type. The type travels with
// the workspace JSON (save/load, rename, delete need no extra
// bookkeeping), and typed field_variable dropdowns keep lists and
// plain variables apart: the list blocks only offer lists, the
// setze/variable blocks only offer numbers and texts.
function isListVariable(v) { return !!v && v.type === LIST_TYPE; }
function listVariables() {
  return getAllVars(workspace).filter(isListVariable);
}

// Themed modal replacement for window.prompt(). Returns a Promise
// that resolves to the entered string (trimmed) or null if the user
// cancelled. We use this instead of prompt() because some browsers
// (notably mobile Safari and certain Chrome contexts) suppress or
// queue prompt() calls silently, so the "+ neue Variable…" button
// just looked dead. A custom modal also gives us proper theming and
// keyboard handling (Enter / Escape).
//
// Optional `validate(value)` callback runs on every keystroke. Return
// a non-empty string to mark the entry as invalid -- the message
// shows under the input in red, and OK is disabled until the user
// fixes it. Return null/undefined when the value is acceptable.
function askString(question, defaultValue, validate) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
      'display:flex; align-items:center; justify-content:center;' +
      'z-index:100000;';

    const dialog = document.createElement('div');
    dialog.style.cssText =
      'background:var(--bg-1, #1f2630); color:var(--fg-0, #fff);' +
      'padding:20px 22px; border-radius:8px; min-width:320px;' +
      'box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
      'border:1px solid var(--border, #2d3744);' +
      'font-family:inherit;';

    const label = document.createElement('div');
    label.textContent = question;
    label.style.cssText = 'margin:0 0 10px; font-size:14px;';
    dialog.appendChild(label);

    const input = document.createElement('input');
    input.type = 'text';
    input.value = defaultValue == null ? '' : String(defaultValue);
    input.style.cssText =
      'width:100%; padding:7px 9px; box-sizing:border-box;' +
      'background:var(--bg-0, #0e1116); color:var(--fg-0, #fff);' +
      'border:1px solid var(--border, #2d3744); border-radius:5px;' +
      'font-size:14px; font-family:inherit;';
    dialog.appendChild(input);

    // Inline error slot. Reserves vertical space even when empty so
    // the dialog doesn't jump around as the user types.
    const errMsg = document.createElement('div');
    errMsg.style.cssText =
      'min-height:18px; margin-top:6px; color:#ff7676;' +
      'font-size:12px; line-height:1.3;';
    dialog.appendChild(errMsg);

    const buttons = document.createElement('div');
    buttons.style.cssText =
      'margin-top:8px; display:flex; gap:8px; justify-content:flex-end;';

    function finish(value) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(value);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('Abbrechen');
    cancelBtn.className = 'tb-btn';
    cancelBtn.addEventListener('click', () => finish(null));

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'tb-btn primary';
    okBtn.addEventListener('click', () => {
      const v = input.value.trim();
      if (!v) return;
      // Final validation -- in case the user somehow clicked OK with
      // an invalid value despite the disabled button.
      if (validate) {
        const err = validate(v);
        if (err) return;
      }
      finish(v);
    });

    // Live validation. Updates the error slot and the OK enable
    // state on every keystroke.
    function recheck() {
      const v = input.value.trim();
      if (!v) {
        errMsg.textContent = '';
        okBtn.disabled = true;
        okBtn.style.opacity = '0.5';
        return;
      }
      let err = null;
      if (validate) {
        try { err = validate(v); } catch (_) {}
      }
      if (err) {
        errMsg.textContent = err;
        okBtn.disabled = true;
        okBtn.style.opacity = '0.5';
      } else {
        errMsg.textContent = '';
        okBtn.disabled = false;
        okBtn.style.opacity = '';
      }
    }
    input.addEventListener('input', recheck);

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(buttons);

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); okBtn.click(); }
      if (e.key === 'Escape') { e.preventDefault(); cancelBtn.click(); }
    });

    overlay.addEventListener('click', (e) => {
      // Click on the backdrop (but not the dialog itself) cancels.
      if (e.target === overlay) finish(null);
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Defer focus + initial validation so the modal is in the DOM
    // tree first.
    setTimeout(() => {
      input.focus();
      input.select();
      recheck();
    }, 0);
  });
}

// Identifiers that would shadow imports the generated program
// already does, leading to AttributeError on the next call against
// the shadowed module. The classic trip-up is naming a turtle
// variable "turtle" -- after `turtle = turtle.Turtle()` the module
// is gone, and the next `turtle.Turtle()` fails. We reject these
// names everywhere a user-defined identifier is registered.
//
// We also list Python keywords (`if`, `for`, ...) and a handful of
// the most common built-ins (`print`, `len`, ...). Using a keyword
// as a variable name is a SyntaxError; shadowing a built-in works
// but produces puzzling behaviour later.
const RESERVED_MODULE_NAMES = new Set([
  // Modules the generator imports on demand.
  'pbc', 'turtle', 'time', 'math', 'random', 'os',
  'machine', 'sys', 'gc', 'framebuf', 'array',
  // Python keywords -- using these as a variable name is a
  // SyntaxError, so the program wouldn't even compile.
  'False', 'None', 'True', 'and', 'as', 'assert', 'async', 'await',
  'break', 'class', 'continue', 'def', 'del', 'elif', 'else',
  'except', 'finally', 'for', 'from', 'global', 'if', 'import',
  'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass', 'raise',
  'return', 'try', 'while', 'with', 'yield',
  // Common built-ins -- shadowing them works but breaks expected
  // behaviour ("why doesn't print() print anymore?").
  'print', 'input', 'len', 'range', 'str', 'int', 'float', 'bool',
  'list', 'dict', 'tuple', 'set', 'abs', 'min', 'max', 'sum',
  'round', 'type', 'open', 'sorted', 'enumerate', 'zip',
]);

// Returns a human-readable category string if `name` is already in
// use somewhere on the workspace, or null if the name is free.
// Used to keep the user from creating two things with the same
// identifier -- that would generate a Python NameError as soon as
// one shadowed the other (e.g. a variable and a function called
// "punkte" collide because both compile to a bare `punkte =` / `def
// punkte():` at module top level).
function nameTakenCategory(name) {
  if (!name) return null;
  // Reserved imports / keywords / built-ins. Surfaced as a single
  // "reserved" category so the live-validation message can use one
  // sentence -- the user mostly just needs to know "pick a different
  // name", not which specific kind of reserved word they hit.
  if (RESERVED_MODULE_NAMES.has(name)) {
    return 'reserved';
  }
  // Variable or text -- both live in Blockly's variable map; we
  // distinguish them only by STRING_VAR_NAMES membership.
  const v = workspace.getVariableMap().getVariable(name);
  if (v) {
    return STRING_VAR_NAMES.has(name) ? 'text' : 'variable';
  }
  // getVariable(name) only looks at untyped variables.
  if (workspace.getVariableMap().getVariable(name, LIST_TYPE)) {
    return 'list';
  }
  // Function (pbc_method_def) names.
  if (listMethodNames().includes(name)) {
    return 'function';
  }
  // Sprite Python identifiers.
  if (PBC_SPRITES.some(sp => sp.name === name)) {
    return 'sprite';
  }
  return null;
}

function nameInUseMessage(name, category) {
  if (category === 'reserved') {
    return t('Der Name') + ' "' + name + '" ' +
           t('ist in Python reserviert. Bitte einen anderen Namen wählen.');
  }
  const what = {
    variable: t('einer Variable'),
    text:     t('eines Texts'),
    list:     t('einer Liste'),
    function: t('einer Funktion'),
    sprite:   t('eines Sprites'),
  }[category] || category;
  return t('Der Name') + ' "' + name + '" ' +
         t('wird schon als Name') + ' ' + what + ' ' + t('verwendet.');
}

// Multi-field variant of askString. Each entry in `fields` is
//   { label, default, validate?, required? }
// where validate(value) returns an error string or null/undefined,
// and required defaults to true. Resolves to an array of trimmed
// string values, or null if the user cancelled.
function askForm(title, fields) {
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
      'box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
      'border:1px solid var(--border, #2d3744);' +
      'font-family:inherit;';

    if (title) {
      const h = document.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-weight:600; font-size:15px; margin-bottom:14px;';
      dialog.appendChild(h);
    }

    const inputs   = [];
    const errSlots = [];

    fields.forEach((f) => {
      const row = document.createElement('div');
      row.style.cssText = 'margin-bottom:10px;';

      const label = document.createElement('div');
      label.textContent = f.label;
      label.style.cssText = 'font-size:13px; margin-bottom:4px;';
      row.appendChild(label);

      let input;
      if (f.type === 'select') {
        // Dropdown variant: shows a fixed list of choices instead of
        // a free-text field. Used by the Turtle dialog's "Canvas:"
        // row to pick which canvas (or "own") the turtle should
        // draw on.
        input = document.createElement('select');
        input.style.cssText =
          'width:100%; padding:6px 9px; box-sizing:border-box;' +
          'background:var(--bg-0, #0e1116); color:var(--fg-0, #fff);' +
          'border:1px solid var(--border, #2d3744); border-radius:5px;' +
          'font-size:14px; font-family:inherit;';
        (f.options || []).forEach(([value, label]) => {
          const opt = document.createElement('option');
          opt.value = value;
          opt.textContent = label;
          input.appendChild(opt);
        });
        if (f.default != null) input.value = String(f.default);
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = f.default == null ? '' : String(f.default);
        input.style.cssText =
          'width:100%; padding:6px 9px; box-sizing:border-box;' +
          'background:var(--bg-0, #0e1116); color:var(--fg-0, #fff);' +
          'border:1px solid var(--border, #2d3744); border-radius:5px;' +
          'font-size:14px; font-family:inherit;';
      }
      row.appendChild(input);
      inputs.push(input);

      // Reserved row for inline error messages -- prevents the
      // dialog from jumping up and down as the user types.
      const err = document.createElement('div');
      err.style.cssText =
        'min-height:16px; margin-top:3px; color:#ff7676;' +
        'font-size:12px; line-height:1.3;';
      row.appendChild(err);
      errSlots.push(err);

      dialog.appendChild(row);
    });

    const buttons = document.createElement('div');
    buttons.style.cssText =
      'margin-top:6px; display:flex; gap:8px; justify-content:flex-end;';

    function finish(value) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(value);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('Abbrechen');
    cancelBtn.className = 'tb-btn';
    cancelBtn.addEventListener('click', () => finish(null));

    const okBtn = document.createElement('button');
    okBtn.textContent = 'OK';
    okBtn.className = 'tb-btn primary';
    okBtn.addEventListener('click', () => {
      if (okBtn.disabled) return;
      const values = inputs.map(i => i.value.trim());
      finish(values);
    });

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(buttons);

    // Run all validators; gate the OK button on every required field
    // having a value AND every validator returning falsy.
    function recheck() {
      let allOK = true;
      fields.forEach((f, i) => {
        const v = inputs[i].value.trim();
        let errText = null;
        const required = f.required !== false;
        if (required && !v) {
          allOK = false;          // empty + required -- block OK but
          errSlots[i].textContent = '';   // don't yell at the user yet
          return;
        }
        if (f.validate && v) {
          try { errText = f.validate(v); } catch (_) {}
        }
        if (errText) allOK = false;
        errSlots[i].textContent = errText || '';
      });
      okBtn.disabled = !allOK;
      okBtn.style.opacity = allOK ? '' : '0.5';
    }
    inputs.forEach(i => {
      i.addEventListener('input',  recheck);
      i.addEventListener('change', recheck);
    });

    // Enter on any field triggers OK; Escape closes the dialog.
    inputs.forEach((i, idx) => {
      i.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          okBtn.click();
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelBtn.click();
        }
      });
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(null);
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    setTimeout(() => {
      inputs[0].focus();
      if (typeof inputs[0].select === 'function') inputs[0].select();
      recheck();
    }, 0);
  });
}

// Insert a "setze X auf Y" statement at the very start of the "Beim
// Start" block. Used right after the user creates a new variable
// or text with a non-empty initial value, so they see their initial
// assignment without having to drag a setze-block in by hand. Falls
// back to a free-floating block if there's no "Beim Start" on the
// workspace (shouldn't normally happen).
function spawnVariableInit(varName, initValue, isText) {
  const variable = workspace.getVariableMap().getVariable(varName);
  if (!variable) return;
  Blockly.Events.setGroup(true);
  try {
    // Build the block pair with events silenced, exactly like
    // spawnBlock: newBlock('variables_set') auto-creates the "Element"
    // stand-in variable before setFieldValue rebinds VAR. With events
    // on, that VAR_CREATE reached the sidebar listener and "Element"
    // sat in the Variables list until the next block deletion purged
    // it. We purge it right here and fire one BLOCK_CREATE afterwards.
    let setBlock, valBlock;
    Blockly.Events.disable();
    try {
      // The variables_set statement.
      setBlock = workspace.newBlock('variables_set');
      setBlock.setFieldValue(variable.getId(), 'VAR');

      // The value block to plug into VALUE: math_number for variables,
      // a literal text block for texts. We could mark either as a
      // shadow, but a "real" block is friendlier -- the student can
      // click it to change the starting value later.
      if (isText) {
        valBlock = workspace.newBlock('text');
        valBlock.setFieldValue(initValue, 'TEXT');
      } else {
        valBlock = workspace.newBlock('math_number');
        valBlock.setFieldValue(String(initValue), 'NUM');
      }
      valBlock.initSvg();
      valBlock.render();

      setBlock.getInput('VALUE').connection
              .connect(valBlock.outputConnection);
      purgeUnusedDefaultVariables();
      setBlock.initSvg();
      setBlock.render();
    } finally {
      Blockly.Events.enable();
    }
    if (Blockly.Events.isEnabled()) {
      try {
        Blockly.Events.fire(new Blockly.Events.BlockCreate(setBlock));
      } catch (e) { /* older Blockly may not have BlockCreate */ }
    }

    // Splice into the start-block's body. We want the new init to
    // land AFTER any existing initialisations (so multiple inits
    // stack in the order they were created) but BEFORE the rest of
    // the user's code (so the variable exists by the time anything
    // reads it). Strategy: walk down the chain from the body input
    // and skip past consecutive variables_set blocks; insert right
    // there. This makes the natural order:
    //   setze v1 auf 0   <- first variable created
    //   setze v2 auf ""  <- second variable created
    //   ...              <- user's actual program
    const startBlock = workspace.getTopBlocks().find(
      b => b.type === 'pbc_when_start');
    if (startBlock && startBlock.nextConnection) {
      let attachAt  = startBlock.nextConnection;
      let following = attachAt.targetBlock();
      while (following && following.type === 'variables_set') {
        attachAt  = following.nextConnection;
        following = attachAt.targetBlock();
      }
      // 'following' is now either null (end of body) or the first
      // non-init block. Splice setBlock in front of it.
      if (following) {
        following.previousConnection.disconnect();
        setBlock.nextConnection.connect(following.previousConnection);
      }
      attachAt.connect(setBlock.previousConnection);
    } else {
      // No start block -- drop the set-block near the workspace
      // origin so the student can find it.
      setBlock.moveBy(40, 40);
    }
  } catch (e) {
    console.warn('spawnVariableInit failed:', e);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// Themed yes/no replacement for window.confirm(). Same rationale as
// askString -- mobile browsers can silently queue the native dialog,
// and a custom modal also matches the rest of the UI.
function confirmDialog(title, message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText =
      'position:fixed; inset:0; background:rgba(0,0,0,0.55);' +
      'display:flex; align-items:center; justify-content:center;' +
      'z-index:100000;';

    const dialog = document.createElement('div');
    dialog.style.cssText =
      'background:var(--bg-1, #1f2630); color:var(--fg-0, #fff);' +
      'padding:20px 22px; border-radius:8px; min-width:320px;' +
      'max-width:480px; box-shadow:0 4px 24px rgba(0,0,0,0.4);' +
      'border:1px solid var(--border, #2d3744);' +
      'font-family:inherit;';

    if (title) {
      const h = document.createElement('div');
      h.textContent = title;
      h.style.cssText = 'font-weight:600; font-size:15px; margin-bottom:10px;';
      dialog.appendChild(h);
    }
    if (message) {
      const m = document.createElement('div');
      m.textContent = message;
      m.style.cssText = 'font-size:13px; line-height:1.4; margin-bottom:16px;';
      dialog.appendChild(m);
    }

    const buttons = document.createElement('div');
    buttons.style.cssText =
      'display:flex; gap:8px; justify-content:flex-end;';

    function finish(value) {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      resolve(value);
    }

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = t('Abbrechen');
    cancelBtn.className = 'tb-btn';
    cancelBtn.addEventListener('click', () => finish(false));

    const okBtn = document.createElement('button');
    okBtn.textContent = t('Löschen');
    okBtn.className = 'tb-btn';
    okBtn.style.background  = 'var(--danger-dim,#7a2a2a)';
    okBtn.style.borderColor = 'var(--danger,#e57373)';
    okBtn.addEventListener('click', () => finish(true));

    buttons.appendChild(cancelBtn);
    buttons.appendChild(okBtn);
    dialog.appendChild(buttons);

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    dialog.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      if (e.key === 'Enter')  { e.preventDefault(); finish(true);  }
    });

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    setTimeout(() => okBtn.focus(), 0);
  });
}

// Render a sidebar entry that mixes a clickable name (spawns a get-
// block when tapped) with a small × on the right to delete the
// variable/text. Used for both the Variables and Texts sections.
// `onDelete` runs after the user confirms in a modal.
function addVariableRow(body, v, color, onDelete, spawnFn) {
  const row = document.createElement('div');
  row.className = 'blk-btn';
  row.style.cssText = 'display:flex;align-items:center;gap:8px;';

  // Coloured dot + name. Clicking anywhere on this area spawns
  // a get-block; dragging it puts the block at the cursor position.
  const main = document.createElement('span');
  main.style.cssText = 'flex:1;display:flex;align-items:center;gap:8px;' +
                       'overflow:hidden;cursor:grab;';
  main.innerHTML =
    `<span class="blk-color" style="background:${color}"></span>` +
    `<span style="overflow:hidden;text-overflow:ellipsis;` +
      `white-space:nowrap;">${v.name}</span>`;
  enableSidebarDrag(main, v.name, color, spawnFn || ((dropAt) =>
    spawnBlock('variables_get', { VAR: v.getId() }, dropAt)));
  row.appendChild(main);

  const del = document.createElement('span');
  del.className = 'no-drag';
  del.textContent = '×';
  del.title = t('Löschen');
  del.style.cssText =
    'color:var(--danger,#e57373);font-size:18px;line-height:1;' +
    'padding:0 6px;cursor:pointer;flex-shrink:0;';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    onDelete();
  });
  row.appendChild(del);

  body.appendChild(row);
}

// Walk the workspace and dispose every block that references the
// given variable id. Used when the user clicks × on a variable or
// text. Before disposing each referencing block, we detach any
// value-children from its inputs -- so an expression like
//
//     setze punkte auf 5 + 3 * x
//
// loses only the "setze punkte auf …" frame: the "5 + 3 * x" tree
// drifts free onto the workspace where the student can reuse it.
// dispose(healStack=true) keeps the surrounding statement chain
// intact: the block above the setze still connects directly to the
// block below.
function deleteVariableAndUsages(variableId) {
  if (!workspace) return;
  Blockly.Events.setGroup(true);
  try {
    // Build the list FIRST so we don't iterate a mutating workspace.
    const toDispose = [];
    workspace.getAllBlocks(false).forEach(b => {
      if (!b.getVarModels) return;
      const refs = b.getVarModels();
      if (refs.some(m => m.getId() === variableId)) {
        toDispose.push(b);
      }
    });
    toDispose.forEach(b => {
      // Detach every input's child block so it survives the dispose.
      // We rescue value-inputs (the "5 + 3" tree above a setze) and
      // statement-inputs (whole sub-stacks that might be nested
      // inside some future custom block) the same way -- unplug()
      // pops the child off its connection and leaves it floating.
      try {
        b.inputList.forEach(input => {
          const conn = input.connection;
          if (!conn) return;
          const child = conn.targetBlock();
          if (child) {
            try { child.unplug(); } catch (_) {}
          }
        });
      } catch (_) {}
      // healStack=true: stitch the surrounding statement chain back
      // together so deleting a setze-block doesn't leave a gap.
      try { b.dispose(true, false); } catch (_) {}
    });
    try {
      const gone = workspace.getVariableMap().getVariableById(variableId);
      if (gone) {
        USER_VAR_NAMES.delete(gone.name);
        // Blockly.Variables.deleteVariable is the non-deprecated v12
        // replacement for the (now-deprecated) deleteVariableById, and
        // it doesn't pop a confirm dialog -- we've already removed the
        // referencing blocks above.
        Blockly.Variables.deleteVariable(workspace, gone);
      }
    } catch (e) {
      console.warn('deleteVariable failed:', e);
    }
  } finally {
    Blockly.Events.setGroup(false);
  }
}

function renderVariableButtons(body) {
  body.innerHTML = '';

  // Turtle-instance variables (the implicit `t` introduced by the
  // turtle blocks) hold Turtle objects, not numbers or strings, so
  // they don't belong in the Variables / Texts lists at all.
  // Turtle-instance variables (the implicit `t` introduced by the
  // turtle blocks) hold Turtle objects; canvas variables hold
  // pbc.Canvas instances; neither belongs in the Variables / Texts
  // lists, which are for plain numbers and strings.
  const vars = getAllVars(workspace).filter(v =>
    !isTurtleVariable(v) && !isCanvasVariable(v) && !isListVariable(v));
  const numVars = vars.filter(v => !STRING_VAR_NAMES.has(v.name));
  const strVars = vars.filter(v =>  STRING_VAR_NAMES.has(v.name));

  // ----- Variables section -----
  const hVar = document.createElement('div');
  hVar.className = 'sec-header';
  hVar.textContent = t('Variablen');
  body.appendChild(hVar);

  addBtn(body, t('+ neue Variable…'), '#7ea4d7', async () => {
    const base = t('wert');
    let candidate = base;
    let i = 2;
    while (nameTakenCategory(candidate)) {
      candidate = base + i++;
    }
    const result = await askForm(t('Neue Variable'), [
      { label: t('Name:'), default: candidate,
        validate: (n) => {
          const taken = nameTakenCategory(n);
          return taken ? nameInUseMessage(n, taken) : null;
        } },
      { label: t('Startwert (leer = 0):'),
        default: '', required: false,
        validate: (v) => isNaN(Number(v))
          ? t('Bitte eine Zahl eingeben.')
          : null },
    ]);
    if (!result) return;
    const [name, initRaw] = result;
    workspace.getVariableMap().createVariable(name);
    USER_VAR_NAMES.add(name);
    // Only spawn an explicit setze-block when the user actually
    // typed a value. When left empty, the variable still gets a
    // safe default at the top of the generated Python (see the
    // implicit init pass in generatedCode), so reading it before
    // any block touches it never raises NameError.
    if (initRaw !== '') {
      spawnVariableInit(name, initRaw, false);
    }
    refreshVariablesCategory();
  }, { noDrag: true });

  // "setze X auf Y" -- pre-selects an existing variable so Blockly
  // doesn't auto-create an "Element" placeholder, and so the attached
  // shadow is a number (instead of a string for text vars).
  addBtn(body, t('setze … auf …'), '#7ea4d7', (dropAt) => {
    const pick = numVars[0] || strVars[0];
    if (!pick) {
      alert(t('Erstelle erst eine Variable unter "+ neue Variable…".'));
      return null;
    }
    return spawnBlock('variables_set', { VAR: pick.getId() }, dropAt);
  });

  if (numVars.length === 0) {
    const note = document.createElement('div');
    note.className = 'sec-note';
    note.textContent = t('Keine Variablen.');
    body.appendChild(note);
  } else {
    numVars.forEach(v => {
      addVariableRow(body, v, '#7ea4d7', async () => {
        const ok = await confirmDialog(t('Variable löschen?'));
        if (!ok) return;
        STRING_VAR_NAMES.delete(v.name);
        deleteVariableAndUsages(v.getId());
        refreshVariablesCategory();
        updateCodeView();
      });
    });
  }

  // ----- Texts section -----
  const hStr = document.createElement('div');
  hStr.className = 'sec-header';
  hStr.textContent = t('Texte');
  body.appendChild(hStr);

  addBtn(body, t('+ neuer Text…'), '#5f9ea0', async () => {
    const base = t('text');
    let candidate = base;
    let i = 2;
    while (nameTakenCategory(candidate)) {
      candidate = base + i++;
    }
    const result = await askForm(t('Neuer Text'), [
      { label: t('Name:'), default: candidate,
        validate: (n) => {
          const taken = nameTakenCategory(n);
          return taken ? nameInUseMessage(n, taken) : null;
        } },
      { label: t('Startwert (leer = leerer Text):'),
        default: '', required: false },
    ]);
    if (!result) return;
    const [name, initRaw] = result;
    workspace.getVariableMap().createVariable(name);
    STRING_VAR_NAMES.add(name);
    USER_VAR_NAMES.add(name);
    if (initRaw !== '') {
      spawnVariableInit(name, initRaw, true);
    }
    purgeUnusedDefaultVariables();
    refreshVariablesCategory();
  }, { noDrag: true });

  // "setze Text … auf …" lives here so it sits next to the text
  // variables it operates on. Pre-selects a text variable so the
  // attached default shadow is a text shadow (typeable, not "0").
  addBtn(body, t('setze Text … auf …'), '#5f9ea0', (dropAt) => {
    const pick = strVars[0] || numVars[0];
    if (!pick) {
      alert(t('Erstelle erst einen Text unter "+ neuer Text…".'));
      return null;
    }
    return spawnBlock('variables_set', { VAR: pick.getId() }, dropAt);
  });

  // Note: the "verbinde … mit …" (string concat) block now lives in
  // its own "Text" category alongside Länge / Teilstück / etc., so it
  // is no longer duplicated here.

  if (strVars.length === 0) {
    const note = document.createElement('div');
    note.className = 'sec-note';
    note.textContent = t('Keine Texte.');
    body.appendChild(note);
  } else {
    strVars.forEach(v => {
      addVariableRow(body, v, '#5f9ea0', async () => {
        const ok = await confirmDialog(t('Text löschen?'));
        if (!ok) return;
        STRING_VAR_NAMES.delete(v.name);
        deleteVariableAndUsages(v.getId());
        refreshVariablesCategory();
        updateCodeView();
      });
    });
  }
}

// Blockly 12 deprecated Workspace.getAllVariables() in favour of
// getVariableMap().getAllVariables(); v13 will remove the old call.
// Wrap it so we work cleanly on both.
function getAllVars(ws) {
  if (!ws) return [];
  if (ws.getVariableMap) {
    return ws.getVariableMap().getAllVariables();
  }
  return ws.getAllVariables();
}

// Returns true if the block is reachable from a code-emitting root
// (Beim Start body or a function definition). Free-floating blocks
// on the workspace are NOT considered active -- their code isn't
// emitted, so they shouldn't trigger constructor injection.
function isBlockActiveOnWorkspace(b) {
  if (!b || !b.getRootBlock) return false;
  const root = b.getRootBlock();
  if (!root) return false;
  return root.type === 'pbc_when_start' ||
         root.type === 'pbc_method_def' ||
         root.type === 'pbc_method_def_return';
}

// Does an active turtle_new block reference the given variable id?
function hasActiveTurtleNewFor(varId) {
  if (!workspace) return false;
  return workspace.getAllBlocks(false).some(b => {
    if (b.type !== 'turtle_new') return false;
    if (!isBlockActiveOnWorkspace(b)) return false;
    if (!b.getVarModels) return false;
    return b.getVarModels().some(m => m.getId() === varId);
  });
}

// Returns a list of variable models that are the target of at least
// one turtle_new block on the workspace (active or not -- a free-
// floating "neue Turtle" block still counts as a valid pick, since
// the student might be in the middle of building their program).
// Used by the turtle command blocks' customSpawn to pre-select a
// valid variable when the student drops a command from the sidebar.
function existingTurtleVariables() {
  if (!workspace) return [];
  const seen = new Set();
  const result = [];
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'turtle_new') return;
    if (!b.getVarModels) return;
    b.getVarModels().forEach(v => {
      if (!seen.has(v.getId())) {
        seen.add(v.getId());
        result.push(v);
      }
    });
  });
  return result;
}

// Shared customSpawn for every turtle command block (forward, left,
// pen_down, ...). Refuses to spawn a command if no "neue Turtle"-
// block exists yet -- the student is told to create one first
// instead of being saddled with a phantom "t" variable they never
// asked for. When at least one turtle exists, the command spawns
// pre-selected to the first available turtle so the dropdown is
// never empty.
async function spawnTurtleCommand(blockType, dropAt) {
  const turtles = existingTurtleVariables();
  if (turtles.length === 0) {
    await alertDialog(t('Turtle fehlt'),
      t('Erstelle erst eine Turtle mit "neue Turtle erstellen".'));
    return null;
  }
  return spawnBlock(blockType, { VAR: turtles[0].getId() }, dropAt);
}

// Mirror of spawnTurtleCommand for canvas operations. Refuses to
// spawn if no canvas exists yet, so the student doesn't end up with
// a block dangling against an unknown variable.
async function spawnCanvasCommand(blockType, dropAt) {
  // The canvas is implicit -- always present whenever any canvas
  // block is used (the generator inserts the `hintergrund =
  // pbc.Canvas(...)` init line for us). So we just spawn the block;
  // no variable to wire up, no "create a canvas first" alert.
  return spawnBlock(blockType, undefined, dropAt);
}

// Sprite command spawn helper. Like spawnTurtleCommand, refuses to
// drop a sprite_* command block onto the workspace if no sprites
// exist yet -- otherwise the dropdown shows "(kein Sprite)" and the
// generator emits `_sprite.show()` which crashes with NameError. We
// surface that to the student up front as a friendly dialog telling
// them to create a sprite first.
async function spawnSpriteCommand(blockType, dropAt) {
  if (!PBC_SPRITES || PBC_SPRITES.length === 0) {
    await alertDialog(t('Sprite fehlt'),
      t('Erstelle erst ein Sprite über "+ neues Sprite…" in der Sprite-Sidebar.'));
    return null;
  }
  // Pre-select the first sprite so the SP-dropdown isn't left on the
  // placeholder option. Single-sprite SP, two-sprite blocks (touches)
  // have SP and SP2 -- both default to the first available sprite.
  const first = PBC_SPRITES[0].name;
  return spawnBlock(blockType, { SP: first, SP2: first }, dropAt);
}

// Returns true if the variable is currently referenced by a turtle_*
// block. We use this to keep turtle-instance variables (which hold
// turtle.Turtle() objects) out of the Variables/Texts sidebar and
// out of the implicit `name = 0`/`name = ""` init pass at the top
// of the generated Python -- writing `t = 0` for a turtle variable
// would clobber the object on the next render.
function isTurtleVariable(v) {
  if (!workspace || !v) return false;
  const id = v.getId();
  return workspace.getAllBlocks(false).some(b => {
    if (!b.type || !b.type.startsWith('turtle_')) return false;
    if (!b.getVarModels) return false;
    return b.getVarModels().some(m => m.getId() === id);
  });
}

// True if this variable was created via "+ neues Canvas…". Tracked
// in CANVAS_VAR_NAMES because Blockly's variable map has no type
// system that distinguishes canvases from regular variables.
// Returns the single canvas variable name used by the IDE. There's
// exactly one canvas per program now -- the student doesn't pick or
// name it -- so the name is fixed for the whole session. We pick a
// language-appropriate identifier so the generated Python code reads
// naturally: a German student sees `hintergrund.fill(...)`, an
// English one sees `background.fill(...)`.
function canvasName() {
  return (LANG === 'en') ? 'background' : 'hintergrund';
}

// Returns true if any active turtle_new or canvas_* block on the
// workspace would generate code that depends on the canvas existing.
// The generator emits an implicit `hintergrund = pbc.Canvas(...)`
// at the top of the program whenever this is true.
function programUsesCanvas() {
  if (!workspace) return false;
  return workspace.getAllBlocks(false).some(b => {
    if (!b.type) return false;
    // Only blocks that actually reach the generated program count.
    // A free-floating turtle_new or canvas_* block off in the corner
    // of the workspace shouldn't trigger the import line.
    if (!isBlockActiveOnWorkspace(b)) return false;
    return b.type === 'turtle_new' || b.type.startsWith('canvas_');
  });
}

// True if the student has an active "Canvas anlegen" block in CREATE
// mode -- that block emits its own `hintergrund = pbc.Canvas(...)`
// line, so the implicit canvas declaration must be suppressed to
// avoid a duplicate (and confusing) assignment in the generated code.
function hasExplicitCanvasCreate() {
  if (!workspace) return false;
  return workspace.getAllBlocks(false).some(b => {
    if (b.type !== 'canvas_new') return false;
    if (!isBlockActiveOnWorkspace(b)) return false;
    // Inside a function it only runs when called: keep the implicit
    // canvas at the top so the main program always has one.
    const root = b.getRootBlock();
    if (root && root.type !== 'pbc_when_start') return false;
    const mode = b.getFieldValue('MODE') || 'CREATE';
    return mode === 'CREATE';
  });
}

// Legacy stubs -- the canvas is implicit now, no longer a Blockly
// variable. These existed so older code paths could ask "is this
// variable a canvas?". Returning false / [] keeps them harmless: the
// rest of the code treats turtles and texts and regular variables
// the same as before, and the implicit canvas doesn't appear in any
// variable list because it isn't in Blockly's variable map.
function isCanvasVariable() { return false; }
function listCanvasVariables() { return []; }

// Blockly's variables_set / variables_get blocks auto-create a
// default-named variable ("Element" in German) when none of the
// expected type exists yet. After we spawn such a block with an
// explicit variable, that auto-created stand-in is left orphaned
// in the workspace and shows up in the Variables sidebar -- which
// is confusing. Walk the variable list and drop any unused ones
// whose name matches the locale's default.
// Drop any variable that no block on the workspace references any
// more. This catches:
//   - the "Element" stand-in Blockly creates when variables_set is
//     placed without a chosen variable (locale-specific name)
//   - turtle-instance variables like `t` left behind after every
//     turtle_* block is deleted
//   - any variable the user removed via Blockly's own context-menu
// without our × button, which would otherwise still show up in the
// sidebar list.
function purgeUnusedDefaultVariables() {
  getAllVars(workspace).forEach(v => {
    // Variables the student deliberately created via "+ neue Variable…"
    // / "+ neuer Text…" stay in the list even while no block references
    // them yet -- purging is only meant to sweep auto-created stand-ins
    // (the "Element" placeholder, orphaned turtle `t`, etc.).
    if (USER_VAR_NAMES.has(v.name)) return;
    const used = workspace.getAllBlocks(false).some(b => {
      if (!b.getVarModels) return false;
      return b.getVarModels().some(m => m.getId() === v.getId());
    });
    if (!used) {
      try {
        // Non-deprecated v12 deletion (see deleteVariableAndUsages).
        Blockly.Variables.deleteVariable(workspace, v);
        STRING_VAR_NAMES.delete(v.name);
      } catch (e) {}
    }
  });
}

// Rebuild only the Variables category (call after var create/delete).
function refreshVariablesCategory() {
  if (isTextMode) return;
  const body = document.querySelector(
    '#sidebar .cat[data-cat-key="vars"] .cat-body');
  if (body) renderVariableButtons(body);
  const lists = document.querySelector(
    '#sidebar .cat[data-cat-key="lists"] .cat-body');
  if (lists) renderListButtons(lists);
}

// Listen category: "+ neue Liste…", one row per list (click/drag =
// the list as a value, × = delete), then the list blocks.
function renderListButtons(body) {
  body.innerHTML = '';
  const color = COLORS_HUE.lists;

  addBtn(body, t('+ neue Liste…'), color, async () => {
    const base = t('liste');
    let candidate = base;
    let i = 2;
    while (nameTakenCategory(candidate)) {
      candidate = base + i++;
    }
    const name = await askString(t('Name der Liste?'), candidate, (n) => {
      const cleaned = validateMethodName(n);
      if (!cleaned) return t('Ungültiger Name.');
      const taken = nameTakenCategory(cleaned);
      return taken ? nameInUseMessage(cleaned, taken) : null;
    });
    if (!name) return;
    const cleaned = validateMethodName(name);
    if (!cleaned) return;
    workspace.getVariableMap().createVariable(cleaned, LIST_TYPE);
    USER_VAR_NAMES.add(cleaned);
    refreshVariablesCategory();
    updateCodeView();
  }, { noDrag: true });

  const lists = listVariables();
  if (lists.length === 0) {
    const note = document.createElement('div');
    note.className = 'sec-note';
    note.textContent = t('Keine Listen.');
    body.appendChild(note);
  } else {
    lists.forEach(v => {
      addVariableRow(body, v, color, async () => {
        const ok = await confirmDialog(t('Liste löschen?'));
        if (!ok) return;
        deleteVariableAndUsages(v.getId());
        refreshVariablesCategory();
        updateCodeView();
      }, (dropAt) => spawnBlock('list_value', { VAR: v.getId() }, dropAt));
    });
  }

  const hdr = document.createElement('div');
  hdr.className = 'sec-header';
  hdr.textContent = t('Blöcke');
  body.appendChild(hdr);
  PBC_BLOCKS.filter(b => blockInCategory(b, 'lists')).forEach(entry => {
    addBtn(body, entry.label, color, (dropAt) => entry.customSpawn(dropAt));
    // The list literal sits right after "setze Liste … auf leer",
    // the block it is usually plugged into.
    if (entry.def.type === 'list_set') {
      addBtn(body, t('Liste aus Werten'), color,
             (dropAt) => spawnListLiteral(dropAt));
    }
  });
}

// Spawn a list block pre-set to the first list. Like turtle commands,
// refuse with a hint while no list exists -- otherwise the block would
// silently create a stray default list.
async function spawnListCommand(blockType, dropAt) {
  const lists = listVariables();
  if (lists.length === 0) {
    await alertDialog(t('Liste fehlt'),
      t('Erstelle erst eine Liste unter "+ neue Liste…".'));
    return null;
  }
  const block = spawnBlock(blockType, { VAR: lists[0].getId() }, dropAt);
  if (block && blockType === 'list_set') {
    // "setze Liste … auf leer": plug in an empty list literal.
    const lit = workspace.newBlock('lists_create_with');
    lit.loadExtraState({ itemCount: 0 });
    lit.initSvg();
    lit.render();
    block.getInput('VALUE').connection.connect(lit.outputConnection);
  }
  return block;
}

// Blockly's list literal ("erzeuge Liste mit"), pre-filled with three
// editable numbers. The gear icon adds or removes slots.
function spawnListLiteral(dropAt) {
  const block = spawnBlock('lists_create_with', undefined, dropAt);
  if (!block) return null;
  block.loadExtraState({ itemCount: 3 });
  block.setInputsInline(true);      // [1] [2] [3] in one row
  for (let i = 0; i < 3; i++) {
    const inp = block.getInput('ADD' + i);
    if (!inp || inp.connection.targetBlock()) continue;
    const num = workspace.newBlock('math_number');
    num.setShadow(true);
    num.setFieldValue(String(i + 1), 'NUM');
    num.initSvg();
    num.render();
    inp.connection.connect(num.outputConnection);
  }
  block.render();
  return block;
}

// Same shape, for the Canvas category.
function refreshCanvasesCategory() {
  if (isTextMode) return;
  const body = document.querySelector(
    '#sidebar .cat[data-cat-key="canvas"] .cat-body');
  if (body) renderCanvasButtons(body);
}

// Render the Canvas category sidebar. Mirrors renderVariableButtons:
// one "+ neues Canvas…" creator at the top, then the list of
// existing canvas variables with an × delete button each, then the
// canvas-targeted drawing blocks (Canvas zeigen, füllen, Pixel,
// Linie, Rechteck, Ellipse, Kreis, Text, Sprite-Hintergrund).
function renderCanvasButtons(body) {
  body.innerHTML = '';

  // Single canvas per program -- no "+ new canvas" button, no
  // user-selectable name. The Beim-Start init line and all canvas
  // drawing blocks just reference the fixed background variable.
  // We just list the drawing commands.
  //
  // Order to mirror the Display category as closely as possible:
  //   1. canvas-only action blocks in their declaration order
  //      (Hintergrund anlegen / leeren, zeigen, füllen, pixel, line,
  //       rect, ellipse, circle, text)
  //   2. multi-category value blocks (Farbe(r,g,b), Farbwähler) --
  //      these live earlier in PBC_BLOCKS so they'd otherwise float
  //      to the top of every category that includes them.
  //   3. image-loading block at the very end -- matches where Bild
  //      anzeigen sits in the Display sidebar.
  const canvasEntries = PBC_BLOCKS
    .filter(b => blockInCategory(b, 'canvas') && !b.hidden);
  const rank = (b) => {
    if (b.def && b.def.type === 'canvas_load_image') return 2;
    if (Array.isArray(b.cat))                        return 1;
    return 0;
  };
  // Array.sort is stable on every browser shipping a modern V8 / JSC,
  // so blocks with the same rank stay in their declaration order.
  canvasEntries.sort((a, b) => rank(a) - rank(b));
  canvasEntries.forEach(entry => {
    const spawnFn = entry.customSpawn
      ? (dropAt) => entry.customSpawn(dropAt)
      : (dropAt) => spawnBlock(entry.def.type, undefined, dropAt);
    const opts = entry.dialogSpawn ? { noDrag: true } : undefined;
    addBtn(body, entry.label, COLORS_HUE.canvas, spawnFn, opts);
  });
}

// Spawn `name = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)` near the top of
// the Beim-Start body so the canvas is initialised before any
// drawing block tries to use it. We splice past any existing init
// blocks so the order on screen ends up Canvases-then-other-inits-
// then-program. Mirrors spawnVariableInit's strategy.
function spawnCanvasInit(name) {
  // We don't currently expose a dedicated `pbc_canvas_new` block --
  // a plain assignment from a value expression is enough and keeps
  // the workspace less cluttered. The variables_set block bound to
  // a custom value-block "canvas_construct" would be tidier but
  // adds complexity for limited gain.
  const variable = workspace.getVariableMap().getVariable(name);
  if (!variable) return;
  Blockly.Events.setGroup(true);
  try {
    const setBlock = workspace.newBlock('variables_set');
    setBlock.setFieldValue(variable.getId(), 'VAR');
    // The value: a Canvas-constructor expression. We emit it as a
    // text-only "raw" expression via a single-line pbc_canvas_new
    // shadow block created lazily below.
    const valBlock = workspace.newBlock('canvas_new_expr');
    valBlock.initSvg();
    valBlock.render();
    setBlock.getInput('VALUE').connection
            .connect(valBlock.outputConnection);
    setBlock.initSvg();
    setBlock.render();

    const startBlock = workspace.getTopBlocks()
      .find(b => b.type === 'pbc_when_start');
    if (startBlock && startBlock.nextConnection) {
      let attachAt  = startBlock.nextConnection;
      let following = attachAt.targetBlock();
      while (following && following.type === 'variables_set') {
        attachAt  = following.nextConnection;
        following = attachAt.targetBlock();
      }
      if (following) {
        following.previousConnection.disconnect();
        setBlock.nextConnection.connect(following.previousConnection);
      }
      attachAt.connect(setBlock.previousConnection);
    } else {
      setBlock.moveBy(40, 40);
    }
  } catch (e) {
    console.warn('spawnCanvasInit failed:', e);
  } finally {
    Blockly.Events.setGroup(false);
  }
}

// Render the Methods sidebar. Mirrors renderVariableButtons but works
// off the set of pbc_method_def blocks in the workspace rather than
// Blockly's variable map.
//
// "+ neue Funktion…" prompts for a name, validates it, and creates a
// fresh definition block on the workspace. Clicking a method name in
// the list spawns a call block for that method.
function renderMethodButtons(body) {
  body.innerHTML = '';
  const methods = listMethods();

  // Two creation buttons: one for a plain function (statement call) and
  // one for a function WITH a return value (its call is a value block).
  // The number of parameters is configured afterwards via the gear; new
  // functions start with zero parameters.
  const newFunctionDialog = async (defType) => {
    // Find an unused default name so the user doesn't immediately
    // hit a collision when they accept the prompt with Enter.
    const base = t('meine_funktion');
    let candidate = base;
    let i = 2;
    while (nameTakenCategory(candidate)) {
      candidate = base + i++;
    }
    const raw = await askString(
      t('Name der neuen Funktion?'), candidate,
      (n) => {
        // First check name shape -- letters, digits, underscore.
        const cleaned = validateMethodName(n);
        if (!cleaned) return t('Ungültiger Name.');
        const taken = nameTakenCategory(cleaned);
        return taken ? nameInUseMessage(cleaned, taken) : null;
      }
    );
    if (!raw) return;
    const cleaned = validateMethodName(raw);
    if (!cleaned) return;   // shouldn't happen -- validate already caught it
    // Spawn the definition block at a sensible spot, pre-filling NAME.
    const block = workspace.newBlock(defType);
    block.setFieldValue(cleaned, 'NAME');
    block.initSvg();
    block.render();
    const view = workspace.getMetricsManager().getViewMetrics(true);
    block.moveBy(view.left + 80, view.top + 80);
    refreshMethodsCategory();
  };

  addBtn(body, t('+ neue Funktion…'), COLORS_HUE.methods,
    () => newFunctionDialog('pbc_method_def'), { noDrag: true });
  addBtn(body, t('+ neue Funktion mit Rückgabe…'), COLORS_HUE.methods,
    () => newFunctionDialog('pbc_method_def_return'), { noDrag: true });

  const place = (block, dropAt) => {
    block.initSvg();
    block.render();
    if (dropAt && typeof dropAt.x === 'number') {
      block.moveBy(dropAt.x, dropAt.y);
    } else {
      const view = workspace.getMetricsManager().getViewMetrics(true);
      block.moveBy(view.left + 80, view.top + 80);
    }
  };

  // Find a function-definition block by name.
  const findDefBlock = (name) => workspace.getAllBlocks(false).find(b =>
    (b.type === 'pbc_method_def' || b.type === 'pbc_method_def_return') &&
    (b.getFieldValue('NAME') || '').trim() === name);

  // Insert a block as the FIRST statement of a function's body (declare
  // locals at the top, push the existing chain down).
  const prependToBody = (def, block) => {
    const conn = def.getInput('BODY').connection;
    const first = conn.targetBlock();
    conn.connect(block.previousConnection);
    if (first && block.nextConnection) {
      block.nextConnection.connect(first.previousConnection);
    }
  };

  if (methods.length === 0) {
    const note = document.createElement('div');
    note.className = 'sec-note';
    note.textContent = t('Keine Funktionen.');
    body.appendChild(note);
    return;
  }

  // Spawn a scoped getter for a given parameter / local-variable name.
  // The name is added to PENDING_PARAM_NAMES so the FieldDropdown (which
  // freezes its options at construction) accepts the value before the
  // block is connected to its function.
  const spawnGetter = (nm) => (dropAt) => {
    PENDING_PARAM_NAMES.add(nm);
    let block;
    try {
      block = workspace.newBlock('pbc_method_param_get');
      block.setFieldValue(nm, 'PARAM');
    } finally {
      PENDING_PARAM_NAMES.delete(nm);
    }
    place(block, dropAt);
    const f = block.getField('PARAM');
    if (f && f.forceRerender) { try { f.forceRerender(); } catch (_) {} }
    return block;
  };

  // One call entry per function, with the scoped value getters (its
  // parameters AND its local variables) indented underneath it.
  methods.forEach(m => {
    const sig = m.name + '(' + m.params.join(', ') + ')';
    addBtn(body, sig, COLORS_HUE.methods, (dropAt) => {
      const block = workspace.newBlock('pbc_method_call');
      block.setFieldValue(m.name, 'NAME');
      block.arguments_ = m.params.slice();
      block.hasReturn_ = m.hasReturn;
      block.updateShape_();
      place(block, dropAt);
      return block;
    });

    // Parameter getters.
    m.params.forEach(p => {
      const btn = addBtn(body, p, COLORS_HUE.methods, spawnGetter(p));
      if (btn) btn.style.marginLeft = '18px';
    });
    // "+ neue lokale Variable…" -- creates a local-variable assignment
    // INSIDE this function's body, so it's clearly tied to the function.
    // It then shows up as one of the indented getters listed below it.
    // Placed ABOVE the local getters to mirror the global "+ neue
    // Variable…" button, which also sits above its variable list.
    const addLocalBtn = addBtn(body, t('+ neue lokale Variable…'),
      COLORS_HUE.methods, async () => {
        const def = findDefBlock(m.name);
        if (!def) return;
        const used = new Set([...(m.params || []), ...(m.locals || [])]);
        let base = t('wert'), cand = base, i = 2;
        while (used.has(cand)) cand = base + (i++);
        const raw = await askString(
          t('Name der lokalen Variable?'), cand,
          (n) => {
            const cleaned = validateMethodName(n);
            if (!cleaned) return t('Ungültiger Name.');
            if (used.has(cleaned)) {
              return t('Dieser Name wird in dieser Funktion schon verwendet.');
            }
            return null;
          });
        if (!raw) return;
        const cleaned = validateMethodName(raw);
        if (!cleaned) return;
        Blockly.Events.setGroup(true);
        try {
          const block = workspace.newBlock('pbc_local_set');
          block.setFieldValue(cleaned, 'NAME');
          block.initSvg();
          block.render();
          prependToBody(def, block);
        } catch (e) { console.warn('add local failed:', e); }
        finally { Blockly.Events.setGroup(false); }
        refreshMethodsCategory();
        if (typeof updateCodeView === 'function') updateCodeView();
      }, { noDrag: true });
    if (addLocalBtn) addLocalBtn.style.marginLeft = '18px';

    // Local-variable getters (declared via pbc_local_set in the body).
    // Listed underneath the "+ neue lokale Variable…" button, matching
    // the global Variables section's button-then-list ordering.
    (m.locals || []).forEach(lv => {
      const btn = addBtn(body, lv, COLORS_HUE.methods, spawnGetter(lv));
      if (btn) {
        btn.style.marginLeft = '18px';
        btn.style.fontStyle = 'italic';   // distinguish locals from params
        // Match the global variable rows, which set the name ~16px off
        // the colored dot (swatch margin + flex gap). A plain addBtn only
        // gives 8px, so bump the swatch margin to get the same Abstand
        // before the name.
        const dot = btn.querySelector('.blk-color');
        if (dot) dot.style.marginRight = '16px';
      }
    });
  });
}

// Refresh just the Methods category -- call after a method def is
// created or its name changes.
function refreshMethodsCategory() {
  // Only relevant for the block sidebar -- in text mode the sidebar
  // shows help entries, not blocks, and the index-based lookup below
  // would otherwise drop method buttons into the wrong help category.
  if (!isTextMode) {
    const body = document.querySelector(
      '#sidebar .cat[data-cat-key="methods"] .cat-body');
    if (body) renderMethodButtons(body);
  }
  // Also repaint the NAME dropdown on every placed call block. Their
  // option list is generated dynamically from the current set of
  // function definitions; a freshly-loaded or freshly-renamed
  // definition needs the calls to re-render so the "(?)" marker
  // appears/disappears correctly. This runs in both modes (harmless
  // in text mode -- no blocks to touch).
  refreshMethodCallBlocks();
}

// Force every pbc_method_call block to re-render its NAME dropdown.
// Used after load and after a function definition is added/renamed/
// removed, so the option list (and the "(?)" missing-marker) stays
// in sync with the actual set of defined functions.
function refreshMethodCallBlocks() {
  if (!workspace) return;
  const defs = {};
  listMethods().forEach(m => { defs[m.name] = m; });
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'pbc_method_call') return;
    const field = b.getField('NAME');
    if (field && typeof field.forceRerender === 'function') {
      try { field.forceRerender(); } catch (_) {}
    }
    // Sync the call's argument slots / return form with its target
    // definition. Only rebuild when something actually changed, so we
    // don't needlessly disconnect a student's plugged-in arguments.
    const m = defs[b.getFieldValue('NAME')];
    if (!m) return;
    const sameParams =
      JSON.stringify(b.arguments_ || []) === JSON.stringify(m.params);
    if (sameParams && !!b.hasReturn_ === m.hasReturn) return;
    b.arguments_ = m.params.slice();
    b.hasReturn_ = m.hasReturn;
    if (typeof b.updateShape_ === 'function') {
      try { b.updateShape_(); } catch (_) {}
    }
  });
  // Parameter getters: repaint so their dropdowns reflect the current
  // parameter set of their enclosing function.
  workspace.getAllBlocks(false).forEach(b => {
    if (b.type !== 'pbc_method_param_get') return;
    const f = b.getField('PARAM');
    if (f && typeof f.forceRerender === 'function') {
      try { f.forceRerender(); } catch (_) {}
    }
  });
}

/* =====================================================================
 * Sprites -- variable-style registry.
 *
 * A sprite has a name (Python identifier) plus an image (PNG filename
 * already uploaded to the device). The list is held in PBC_SPRITES on
 * the IDE side and re-emitted as Python at the top of every program:
 *
 *     spieler = pbc.sprite('held.png')
 *     gegner  = pbc.sprite('zombie.png')
 *
 * Sprite names are referenced by every operation block via a dropdown
 * (set/glide/show/hide/touches/etc), so renaming a sprite is a hard
 * operation -- we keep the list append-only-ish: create + delete only.
 * Saved with .pbcp workspace files so they survive reloads.
 * ===================================================================== */

let PBC_SPRITES = [];   // [{ name, image }, …]

function listSpriteNames() {
  return PBC_SPRITES.map(s => s.name);
}

// Dropdown options for any block that references a sprite. Called by
// Blockly when the block is first rendered AND whenever the field
// gets opened, so we always show the current list.
function spriteNameOptions() {
  if (PBC_SPRITES.length === 0) return [['(kein Sprite)', '']];
  return PBC_SPRITES.map(s => [s.name, s.name]);
}

// Sanitize a sprite name to a valid Python identifier. Same rules as
// validateMethodName: letters/digits/underscore, must not start with
// a digit. Returns null for an empty input.
function validateSpriteName(name) {
  if (!name) return null;
  let cleaned = name.replace(/[^A-Za-z0-9_]/g, '_');
  if (/^[0-9]/.test(cleaned)) cleaned = '_' + cleaned;
  return cleaned;
}

function renderSpriteButtons(body) {
  body.innerHTML = '';

  addBtn(body, t('+ neues Sprite…'), COLORS_HUE.sprite, () => {
    openNewSpriteDialog();
  }, { noDrag: true });

  // --- Existing sprites section --------------------------------------
  // Each sprite gets a row with its name plus a tiny × to delete it.
  // If there are none, we show a short "noch keine Sprites" hint and
  // keep going -- the command buttons still appear below so a teacher
  // can show what's coming.
  if (PBC_SPRITES.length === 0) {
    const note = document.createElement('div');
    note.className = 'sec-note';
    note.textContent = t('Noch keine Sprites.');
    body.appendChild(note);
  } else {
    PBC_SPRITES.forEach((sp, idx) => {
      const row = document.createElement('div');
      row.className = 'blk-btn';
      row.style.cssText = 'display:flex;align-items:center;gap:8px;';
      row.innerHTML =
        `<span class="blk-color" style="background:${COLORS_HUE.sprite}"></span>` +
        `<span style="flex:1;overflow:hidden;text-overflow:ellipsis;` +
          `white-space:nowrap;">${sp.name}` +
        `<span style="color:var(--fg-2);font-size:11px;">` +
          ` · ${sp.image}</span></span>`;
      const del = document.createElement('span');
      del.textContent = '×';
      del.title = 'Sprite löschen';
      del.style.cssText =
        'color:var(--danger);font-size:18px;line-height:1;' +
        'padding:0 6px;cursor:pointer;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!confirm(`Sprite "${sp.name}" löschen?`)) return;
        PBC_SPRITES.splice(idx, 1);
        refreshSpritesCategory();
        updateCodeView();
      });
      row.appendChild(del);
      body.appendChild(row);
    });
  }

  // --- Commands section ----------------------------------------------
  // All the verbs that act on a sprite: show, hide, set position,
  // glide, query position, collide. These come from PBC_BLOCKS (the
  // entries tagged cat:'sprite'). The plain buildSidebar() flow
  // doesn't append PBC_BLOCKS to dynamic categories, so we do it
  // here explicitly.
  const hdr = document.createElement('div');
  hdr.className = 'sec-header';
  hdr.textContent = 'Befehle';
  body.appendChild(hdr);

  PBC_BLOCKS.filter(b => blockInCategory(b, 'sprite')).forEach(entry => {
    const spawnFn = entry.customSpawn
      ? (dropAt) => entry.customSpawn(dropAt)
      : (dropAt) => spawnBlock(entry.def.type, undefined, dropAt);
    addBtn(body, entry.label, COLORS_HUE.sprite, spawnFn);
  });
}

// Refresh just the Sprites category.
function refreshSpritesCategory() {
  if (isTextMode) {
    // Still need the sprite-block-dropdown sync, just skip the
    // sidebar rebuild.
    if (workspace) {
      workspace.getAllBlocks(false).forEach(b => {
        if (b.type && b.type.startsWith('pbc_sprite_') && b.updateSpriteList_) {
          try { b.updateSpriteList_(); } catch (e) {}
        }
      });
    }
    return;
  }
  const body = document.querySelector(
    '#sidebar .cat[data-cat-key="sprite"] .cat-body');
  if (body) renderSpriteButtons(body);
  // Any sprite-using blocks already on the workspace need their
  // dropdowns refreshed so they pick up new entries (or lose deleted
  // ones). The easy way: cycle each field's value, which triggers
  // Blockly to re-fetch the options.
  if (workspace) {
    workspace.getAllBlocks(false).forEach(b => {
      if (!b.type || !b.type.startsWith('pbc_sprite_')) return;
      ['SP', 'A', 'B'].forEach(fname => {
        const f = b.getField(fname);
        if (!f || !f.getOptions) return;
        // Force the dropdown to re-evaluate its options by re-setting
        // the current value -- a no-op visually unless the value is
        // no longer in the option list, in which case it falls back
        // to the first option (the placeholder).
        const cur = b.getFieldValue(fname);
        const opts = f.getOptions(false);
        if (opts && !opts.some(o => o[1] === cur)) {
          b.setFieldValue(opts[0][1], fname);
        }
      });
    });
  }
}

// Make a sidebar element act as a drop source: click still works as
// before (whatever `spawnFn(undefined)` does, usually a default-
// position spawn), but pointerdown + drag past a small threshold
// shows a ghost label that follows the cursor; releasing over the
// workspace calls `spawnFn({x, y})` with workspace-local coords so
// the block lands right under the cursor. Releasing outside the
// workspace cancels.
//
// spawnFn receives an optional { x, y } argument (workspace coords)
// when the gesture was a drop; receives undefined for a plain click.
function enableSidebarDrag(element, ghostLabel, ghostColor, spawnFn) {
  element.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // Don't start a drag from inside a child element marked as a
    // separate action (e.g. the × delete button).
    if (e.target.closest('.no-drag')) return;

    const startX = e.clientX, startY = e.clientY;
    let dragMode  = false;
    let liveBlock = null;
    // Re-entrancy guard: handoffToBlockly is async, and pointermove
    // fires many times per second. Without this flag, the second
    // pointermove (which arrives while the first handoff is still
    // awaiting on a customSpawn dialog or even just on the next
    // microtask) sees liveBlock still null and triggers ANOTHER
    // spawn -- and so on, producing one block per pointermove until
    // the await chain resolves. That's where the screen-full-of-
    // duplicate-blocks bug came from.
    let spawning = false;

    // Handoff: once the user crosses the drag threshold, we spawn
    // the real block AT the cursor position on the workspace, then
    // dispatch a fresh pointerdown on its SVG element. Blockly picks
    // that up as a normal workspace block-drag -- which means we
    // get every nicety for free: live block-following-the-cursor,
    // insertion-marker preview, drop-snap, touch handling, undo
    // grouping, the works. No need for us to reinvent any of that.
    //
    // spawnFn may be async (Turtle / Canvas command spawns show an
    // alert when there's no Turtle / Canvas yet). We resolve the
    // promise before continuing so the rest of the handoff only
    // runs once the block actually exists.
    async function handoffToBlockly(ev) {
      if (spawning) return;
      const ws = sidebarDropTarget(ev.clientX, ev.clientY);
      if (!ws) return;   // not over the workspace yet -- wait
      spawning = true;
      try {
        const maybe = spawnFn(ws);
        liveBlock = (maybe && typeof maybe.then === 'function')
          ? (await maybe) || null
          : maybe || null;
      } catch (e) {
        console.warn('sidebar spawn failed:', e);
        liveBlock = null;
      }
      if (!liveBlock) {
        // Spawn failed (canceled dialog, no permission). Reset
        // spawning so a subsequent move-back-over-workspace can
        // try again, but leave the listeners up.
        spawning = false;
        return;
      }

      // Blockly's drag system listens on the workspace's pointerdown
      // event. Synthesising one on the new block's root SVG element
      // makes Blockly start a drag for that block, anchored at the
      // synthetic pointer position. From here on Blockly drives the
      // whole interaction.
      const target = liveBlock.getSvgRoot
        ? liveBlock.getSvgRoot()
        : null;
      if (!target) { spawning = false; return; }

      // The pointer may have moved while the async customSpawn was
      // showing a dialog or running validation. Re-read the current
      // cursor position so the handoff lands where the user is now,
      // not where they were a few hundred ms ago.
      const pointerEvent = new PointerEvent('pointerdown', {
        bubbles: true, cancelable: true,
        clientX: ev.clientX, clientY: ev.clientY,
        button: 0, buttons: 1,
        pointerId: ev.pointerId,
        pointerType: ev.pointerType || 'mouse',
        isPrimary: true,
      });
      target.dispatchEvent(pointerEvent);

      // Once Blockly owns the drag, we don't want our own move/up
      // listeners getting in the way. Tear them down -- Blockly will
      // handle the rest of the gesture on its own.
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
    }

    function onMove(ev) {
      const dx = Math.abs(ev.clientX - startX);
      const dy = Math.abs(ev.clientY - startY);
      if (!dragMode && Math.max(dx, dy) >= 5) {
        dragMode = true;
      }
      if (dragMode && !liveBlock) {
        handoffToBlockly(ev);
      }
    }

    function onUp(ev) {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup',   onUp);
      if (!dragMode) {
        // Plain click -- spawn at the cascading default position.
        spawnFn();
      }
      // If we crossed the threshold but never made it over the
      // workspace, no block was spawned -- treat that as cancel.
    }

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup',   onUp);
    // Don't let the browser turn the pointerdown into a text-selection
    // gesture; users dragging a sidebar entry shouldn't accidentally
    // highlight half the row.
    e.preventDefault();
  });
}

// Returns workspace-local { x, y } if the screen coords are over the
// Blockly workspace SVG, or null otherwise. Used by enableSidebarDrag
// to decide whether a release-point counts as a "drop".
function sidebarDropTarget(screenX, screenY) {
  if (!workspace) return null;
  const svg = workspace.getParentSvg && workspace.getParentSvg();
  if (!svg) return null;
  const rect = svg.getBoundingClientRect();
  if (screenX < rect.left || screenX > rect.right ||
      screenY < rect.top  || screenY > rect.bottom) {
    return null;
  }
  // Use Blockly's own offset helper if available; falls back to
  // hand-rolled arithmetic.
  let offsetX = 0, offsetY = 0;
  if (typeof workspace.getOriginOffsetInPixels === 'function') {
    try {
      const o = workspace.getOriginOffsetInPixels();
      offsetX = o.x; offsetY = o.y;
    } catch (_) {}
  }
  const svgX = screenX - rect.left;
  const svgY = screenY - rect.top;
  const scale = workspace.scale || 1;
  return {
    x: (svgX - offsetX) / scale,
    y: (svgY - offsetY) / scale,
  };
}

function addBtn(parent, label, color, onclick, opts) {
  const btn = document.createElement('button');
  btn.className = 'blk-btn';
  btn.innerHTML =
    `<span class="blk-color" style="background:${color}"></span>${label}`;
  parent.appendChild(btn);
  // Two paths:
  //   - Block-spawning buttons (the default): enableSidebarDrag wires
  //     up click + drag-handoff to Blockly's native drag system.
  //   - Action buttons that open a dialog ("+ neue Variable…",
  //     "+ neue Funktion…", "+ neues Canvas…", and the turtle_new
  //     spawn which also prompts for a name): drag from these makes
  //     no sense -- it would pop up a dialog mid-drag and leave the
  //     student wondering where their block went. Caller signals
  //     this with opts.noDrag = true; we wire a plain click only.
  if (opts && opts.noDrag) {
    btn.addEventListener('click', () => onclick());
  } else {
    enableSidebarDrag(btn, label, color, (dropAt) => onclick(dropAt));
  }
  return btn;
}

function openNewSpriteDialog() {
  const sel = document.getElementById('new-sprite-image');
  const hint = document.getElementById('new-sprite-hint');
  // Fill the image dropdown from the IDE's cached list of PNGs on
  // the device. If empty, we still show the dialog but the Anlegen
  // button rejects -- the user gets a clear pointer to the image
  // manager.
  sel.innerHTML = '';
  if (KNOWN_IMAGES.length === 0) {
    const opt = document.createElement('option');
    opt.textContent = '— Noch keine Bilder hochgeladen —';
    opt.value = '';
    sel.appendChild(opt);
    hint.innerHTML =
      'Lade ein Bild über das Menü <em>Dateien ▾ → Bilder ' +
      'verwalten…</em> hoch und versuche es erneut.';
  } else {
    KNOWN_IMAGES.forEach(name => {
      const opt = document.createElement('option');
      opt.textContent = name;
      opt.value = name;
      sel.appendChild(opt);
    });
    hint.textContent = '';
  }
  cancelBlocklyGesture(); document.getElementById('new-sprite-modal').classList.add('show');
  const nameField = document.getElementById('new-sprite-name');
  // Generate a non-conflicting default name (spieler, spieler2, ...).
  let baseName = 'spieler';
  let candidate = baseName;
  let i = 2;
  while (nameTakenCategory(candidate)) {
    candidate = baseName + i++;
  }
  nameField.value = candidate;
  nameField.focus();
  nameField.select();
}

document.getElementById('new-sprite-cancel').addEventListener('click', () => {
  document.getElementById('new-sprite-modal').classList.remove('show');
});
document.getElementById('new-sprite-modal').addEventListener('click', (e) => {
  if (e.target.id === 'new-sprite-modal')
    document.getElementById('new-sprite-modal').classList.remove('show');
});
document.getElementById('new-sprite-ok').addEventListener('click', () => {
  const raw = document.getElementById('new-sprite-name').value;
  // Strict identifier check: letters/digits/underscore only, must
  // not start with a digit. We don't auto-coerce silently (the old
  // behaviour) -- if the input is invalid, refuse and ask the user
  // to fix it, the same way Variable/Text/Function/Turtle dialogs
  // do. Otherwise "Mein Held!" silently becomes "Mein_Held_" with
  // no warning.
  const cleaned = raw && raw.trim();
  const image = document.getElementById('new-sprite-image').value;
  if (!cleaned) { alert(t('Bitte einen Namen eingeben.')); return; }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(cleaned)) {
    alert(t('Ungültiger Name. Erlaubt sind Buchstaben, Ziffern und Unterstriche. Nicht mit einer Ziffer beginnen.'));
    return;
  }
  if (!image)   { alert(t('Bitte ein Bild auswählen (oder eines hochladen).')); return; }
  const taken = nameTakenCategory(cleaned);
  if (taken) {
    alert(nameInUseMessage(cleaned, taken));
    return;
  }
  PBC_SPRITES.push({ name: cleaned, image: image });
  document.getElementById('new-sprite-modal').classList.remove('show');
  refreshSpritesCategory();
  updateCodeView();
  toast(t('Sprite') + ' "' + cleaned + '" ' + t('angelegt'), 'good');
});

// Live validation in the new-sprite name field. Update the hint area
// as the user types so they see the problem before they hit Anlegen.
document.getElementById('new-sprite-name').addEventListener('input', () => {
  const raw = document.getElementById('new-sprite-name').value.trim();
  const hint = document.getElementById('new-sprite-hint');
  if (!hint) return;
  if (!raw) {
    hint.textContent = '';
    hint.style.color = 'var(--fg-2)';
    return;
  }
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
    hint.textContent = t('Ungültiger Name. Erlaubt sind Buchstaben, Ziffern und Unterstriche. Nicht mit einer Ziffer beginnen.');
    hint.style.color = '#ff7676';
    return;
  }
  const taken = nameTakenCategory(raw);
  if (taken) {
    hint.textContent = nameInUseMessage(raw, taken);
    hint.style.color = '#ff7676';
    return;
  }
  hint.textContent = '';
});
document.getElementById('new-sprite-name').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('new-sprite-ok').click();
});

