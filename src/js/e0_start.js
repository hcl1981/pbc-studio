/* =====================================================================
 * Terminal toolbar
 * ===================================================================== */

document.getElementById('btn-term-clear').addEventListener('click',
  () => term.clear());
document.getElementById('btn-term-reset').addEventListener('click', () => {
  if (serialWriter) serialWriter.write(new Uint8Array([0x04]));
});

/* =====================================================================
 * Init
 * ===================================================================== */

// Drop the default "Hallo PBC+!" demo into the workspace. Used on
// the very first visit (no persisted workspace yet) and as a fallback
// when a persisted workspace fails to load.
function loadDemoProgram() {
  try {
    // Greeting + horizontal centre depend on the language (the strings
    // have different widths). X is chosen so the großer-Text (text24)
    // string sits centred on the 240-px-wide display; Y centres it
    // vertically (24-px tall text on a 280-px display).
    const isEn = (LANG === 'en');
    const greetText = isEn ? 'Ready?' : 'Bereit?';
    // Centred X for the großer-Text greeting, precomputed from the real
    // device font metrics (240-px display): "Bereit?" is 93 px wide ->
    // X=74; "Ready?" is 95 px -> X=72. Hard-coded so loadDemoProgram has
    // no dependency on the emulator font helpers (different scope).
    const greetX = isEn ? 72 : 74;
    const demoJson = {
      blocks: { languageVersion: 0, blocks: [{
        type: 'pbc_when_start', x: 60, y: 40,
        next: { block: {
          type: 'pbc_clear',
          next: { block: {
            type: 'pbc_text24',
            inputs: {
              TEXT:  { shadow: { type: 'text',        fields: { TEXT: greetText } } },
              X:     { shadow: { type: 'math_number', fields: { NUM: greetX } } },
              Y:     { shadow: { type: 'math_number', fields: { NUM: 128 } } },
              COLOR: { block:  { type: 'pbc_color_named', fields: { NAME: 'WHITE' } } },
            },
          } },
        } },
      }] }
    };
    loadWorkspaceJson(demoJson, workspace);
    ensureStartBlock();
    centerWorkspaceOnContent();
  } catch (e) {
    console.warn('Demo-Programm konnte nicht geladen werden:', e);
    ensureStartBlock();
  }
}

window.addEventListener('load', () => {
  // Initialise the PBC+ / Emulator target switch and Verbinden button.
  if (typeof syncTargetSwitch === 'function') syncTargetSwitch();
  if (typeof updateConnectButton === 'function') updateConnectButton();
  // Translate the static HTML markup. Walk every text-bearing element
  // that contains a German string we know about and rewrite it. This
  // is a brute-force pass but it's done once at boot and avoids
  // peppering the markup with t()-calls.
  if (LANG === 'en') {
    // Buttons and headings with simple textContent.
    document.querySelectorAll(
      'button, h1, h2, h3, label, span, option, p, .dropdown-section, ' +
      '.titlebar-spacer + button, .modal-foot button'
    ).forEach(el => {
      // Only translate leaf elements (no element children), to avoid
      // clobbering rich markup like the dropdown menu.
      if (el.children.length === 0) {
        const txt = el.textContent.trim();
        if (txt && I18N_EN[txt]) el.textContent = I18N_EN[txt];
      }
    });
    // Text pieces inside mixed markup ("… (Block <em>Bild anzeigen</em>
    // unter …"): the pass above skips elements with children, so look
    // up every remaining text node by itself, whitespace normalised.
    const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const knoten = [];
    while (tw.nextNode()) knoten.push(tw.currentNode);
    for (const n of knoten) {
      if (n.parentElement && n.parentElement.closest('script, style')) continue;
      const roh = n.textContent;
      const en = I18N_EN[roh.replace(/\s+/g, ' ').trim()];
      if (en) n.textContent = roh.match(/^\s*/)[0] + en + roh.match(/\s*$/)[0];
    }
    // Placeholders and titles attributes.
    document.querySelectorAll('[placeholder]').forEach(el => {
      const v = el.getAttribute('placeholder');
      if (I18N_EN[v]) el.setAttribute('placeholder', I18N_EN[v]);
    });
    document.querySelectorAll('[title]').forEach(el => {
      const v = el.getAttribute('title');
      if (I18N_EN[v]) el.setAttribute('title', I18N_EN[v]);
    });
  }

  setupTerminal();
  loadSettings();           // restore EXT_SETTINGS from localStorage
  buildSidebar();
  setupWorkspace();
  setupSidebarTrash();
  setupEditLockButton();

  // Help-pane close button: simply hides the help pane; the sidebar
  // stays so the user can pick another topic.
  document.getElementById('helppane-close').addEventListener('click', () => {
    document.getElementById('helppane').hidden = true;
  });

  // Look for a workspace snapshot stashed across a language-reload.
  // If we find one, it takes precedence over the demo program -- the
  // user's actual work survives the reload boundary.
  let langSnapshot = null;
  try {
    const raw = sessionStorage.getItem('pbc.lang_reload_snapshot');
    if (raw) {
      langSnapshot = JSON.parse(raw);
      sessionStorage.removeItem('pbc.lang_reload_snapshot');
    }
  } catch (e) { langSnapshot = null; }

  if (langSnapshot) {
    try {
      // Sprites/vars must be set before loadWorkspaceJson so sprite
      // dropdowns keep their saved values (see the .pbcp load path).
      STRING_VAR_NAMES = new Set(langSnapshot.stringVars || []);
      CANVAS_VAR_NAMES = new Set(langSnapshot.canvasVars || []);
      PBC_SPRITES = Array.isArray(langSnapshot.sprites)
                    ? langSnapshot.sprites : [];
      loadWorkspaceJson(langSnapshot.blocks, workspace);
      refreshVariablesCategory();
      refreshSpritesCategory();
      refreshMethodsCategory();
      ensureStartBlock();
      centerWorkspaceOnContent();
    } catch (e) {
      console.warn('Sprach-Snapshot konnte nicht geladen werden:', e);
      ensureStartBlock();
    }
  } else {
    // No language-snapshot. Try the persisted workspace (saved on
    // every change so an F5 doesn't blow away the student's work).
    // If THAT's missing too, fall back to the friendly demo.
    const persisted = loadPersistedWorkspace();
    if (persisted) {
      try {
        // Sprites/vars before load, so sprite dropdowns keep values.
        STRING_VAR_NAMES = new Set(persisted.stringVars || []);
        CANVAS_VAR_NAMES = new Set(persisted.canvasVars || []);
        PBC_SPRITES = Array.isArray(persisted.sprites)
                      ? persisted.sprites : [];
        loadWorkspaceJson(persisted.blocks, workspace);
        refreshVariablesCategory();
        refreshSpritesCategory();
        refreshMethodsCategory();
        ensureStartBlock();
        centerWorkspaceOnContent();
      } catch (e) {
        console.warn('Persistierter Workspace defekt, lade Demo:', e);
        loadDemoProgram();
      }
    } else {
      loadDemoProgram();
    }
  }
  updateCodeView();

  // If we came back from a language reload that was in text mode,
  // jump straight there with the saved buffer so the editor content
  // also survives the round trip.
  if (langSnapshot && langSnapshot.textMode) {
    // setMode picks up the buffer via the storage key, so write it
    // there first.
    try { localStorage.setItem(TEXT_BUF_KEY, langSnapshot.text || ''); }
    catch (e) {}
    setMode(true, { restoreFromStorage: true });
  }

  // Restore the user's last-used mode (only if we didn't already do
  // it above as part of a language snapshot).
  // also bring back the saved buffer so they don't lose their work to
  // a reload. The demo blocks above stay loaded in the workspace
  // anyway -- they're just hidden behind the text editor.
  let lastMode = null;
  try { lastMode = localStorage.getItem(MODE_KEY); } catch (e) {}
  if (lastMode === 'text' && !langSnapshot) {
    setMode(true, { restoreFromStorage: true });
  }
});

// Move every top-level block so the collective bounding box is
// centred at the workspace origin (0, 0), then scroll the viewport
// so origin sits at its centre. Result: whatever was just loaded
// shows up visually in the middle of the canvas, with the scrollbars
// centred too.
function centerWorkspaceOnContent() {
  if (!workspace) return;
  const tops = workspace.getTopBlocks(false);
  if (!tops.length) {
    workspace.scrollCenter();
    return;
  }
  let minX = Infinity, minY = Infinity;
  let maxX = -Infinity, maxY = -Infinity;
  tops.forEach(b => {
    const r = b.getBoundingRectangle();
    if (r.left   < minX) minX = r.left;
    if (r.top    < minY) minY = r.top;
    if (r.right  > maxX) maxX = r.right;
    if (r.bottom > maxY) maxY = r.bottom;
  });
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  tops.forEach(b => b.moveBy(-cx, -cy));
  // Defer the scroll so Blockly has a chance to re-measure after the
  // moveBy calls; otherwise scrollCenter sometimes lands on stale
  // metrics and the viewport ends up just slightly off.
  requestAnimationFrame(() => workspace.scrollCenter());
}

window.addEventListener('resize', () => {
  if (workspace) Blockly.svgResize(workspace);
  // Re-snap the emulator display to the best whole-pixel scale.
  if (typeof applyEmuIntegerScale === 'function') applyEmuIntegerScale();
});
