/* =====================================================================
 * Editor helpers for the Python text mode
 *
 *  - the line of the last error is highlighted in the editor and the
 *    cursor jumps there; "line N" in the terminal is a clickable link
 *  - completion for pbc. / turtle. / time. / random. / math. / os. and
 *    for methods of turtles, sprites and canvases (Ctrl+Space, or
 *    automatically after the dot)
 *  - a check before each run in text mode: modules used without import,
 *    names that do not exist in pbc/time/random/math (with a "did you
 *    mean …?" suggestion). It only warns; the program still runs.
 * ===================================================================== */

// Known names per module (pbc: firmware + emulator, see werkzeuge/api.md
// of the Python book). Used for completion and for the check.
const PY_MODUL_NAMEN = {
  pbc: ['WIDTH', 'HEIGHT', 'BLACK', 'WHITE', 'RED', 'GREEN', 'BLUE', 'YELLOW', 'CYAN',
        'MAGENTA', 'ORANGE', 'PURPLE', 'GRAY', 'rgb', 'clear', 'fill', 'pixel', 'line',
        'hline', 'vline', 'rect', 'fill_rect', 'ellipse', 'poly', 'text', 'text12', 'text18',
        'text24', 'text12_width', 'text18_width', 'text24_width', 'backlight', 'delay',
        'pressed_up', 'pressed_down', 'pressed_left', 'pressed_right', 'pressed_center',
        'pressed_a', 'pressed_b', 'was_pressed_up', 'was_pressed_down', 'was_pressed_left',
        'was_pressed_right', 'was_pressed_center', 'was_pressed_a', 'was_pressed_b',
        'any_pressed', 'wait_for_button', 'led_red', 'led_yellow', 'led_green', 'leds_off',
        'rgb_led', 'rgb_led_off', 'tone', 'tone_off', 'no_tone', 'accel_x', 'accel_y',
        'accel_z', 'accel_x_g', 'accel_y_g', 'accel_z_g', 'battery_voltage', 'is_on_usb',
        'Canvas', 'show', 'load_image', 'sprite', 'Sprite', 'on_press_up', 'on_press_down',
        'on_press_left', 'on_press_right', 'on_press_center', 'on_press_a', 'on_press_b',
        'menu', 'help'],
  turtle: ['Turtle', 'get_canvas'],
  time: ['sleep', 'sleep_ms', 'sleep_us', 'ticks_ms', 'ticks_us', 'ticks_cpu', 'ticks_diff',
         'ticks_add', 'time', 'time_ns', 'localtime', 'mktime', 'gmtime'],
  random: ['randint', 'random', 'choice', 'randrange', 'uniform', 'seed', 'getrandbits'],
  math: ['pi', 'e', 'tau', 'inf', 'nan', 'sqrt', 'pow', 'exp', 'log', 'log2', 'log10',
         'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2', 'degrees', 'radians',
         'floor', 'ceil', 'trunc', 'fabs', 'fmod', 'modf', 'frexp', 'ldexp', 'copysign',
         'isfinite', 'isinf', 'isnan', 'hypot'],
  os: ['listdir', 'remove', 'rename', 'mkdir', 'rmdir', 'stat', 'getcwd', 'chdir', 'uname'],
};
const PY_OBJEKT_METHODEN = {
  turtle: ['forward', 'back', 'left', 'right', 'setDirection', 'setPosition', 'moveTo',
           'home', 'penUp', 'penDown', 'setPenColor', 'speed', 'hide', 'show', 'clear',
           'on_color'],
  sprite: ['show', 'hide', 'set_to', 'set_by', 'glide_to', 'glide_by', 'touches',
           'touches_edge', 'on_color', 'x', 'y', 'width', 'height'],
  canvas: ['fill', 'pixel', 'line', 'hline', 'vline', 'rect', 'fill_rect', 'ellipse',
           'text', 'text12', 'text18', 'text24', 'text12_width', 'text18_width',
           'text24_width', 'blit', 'stamp_on', 'width', 'height'],
};

// Text with string literals and comments blanked out (same length), so
// the scanners below never look inside them.
function pyNurCode(src) {
  let out = '', q = null;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '\\') { out += '  '; i++; continue; }
      if (src.startsWith(q, i)) { out += ' '.repeat(q.length); i += q.length - 1; q = null; continue; }
      if (q.length === 1 && ch === '\n') { q = null; out += '\n'; continue; }
      out += ch === '\n' ? '\n' : ' ';
      continue;
    }
    if (ch === '#') {
      while (i < src.length && src[i] !== '\n') { out += ' '; i++; }
      if (i < src.length) out += '\n';
      continue;
    }
    if (ch === '"' || ch === "'") {
      q = src.startsWith(ch.repeat(3), i) ? ch.repeat(3) : ch;
      out += ' '.repeat(q.length); i += q.length - 1;
      continue;
    }
    out += ch;
  }
  return out;
}

// Which variables hold a turtle / sprite / canvas (x = turtle.Turtle() …).
function pyObjektArten(code) {
  const arten = {};
  const re = /(?:^|[^\w.])((?:self\.)?\w+)\s*=\s*(turtle\.Turtle|pbc\.sprite|pbc\.Canvas|pbc\.load_image)\s*\(/g;
  let m;
  while ((m = re.exec(code)) !== null) {
    arten[m[1]] = m[2] === 'turtle.Turtle' ? 'turtle' : m[2] === 'pbc.sprite' ? 'sprite' : 'canvas';
  }
  return arten;
}

function pyAbstand(a, b) {
  const d = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const t = d[j];
      d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = t;
    }
  }
  return d[b.length];
}

function pyVorschlag(name, kandidaten) {
  let best = null, bestD = 99;
  for (const k of kandidaten) {
    const dd = pyAbstand(name.toLowerCase(), k.toLowerCase());
    if (dd < bestD) { best = k; bestD = dd; }
  }
  return bestD <= Math.max(2, Math.floor(name.length / 3)) ? best : null;
}

// Warnings for the program text (text mode). [{zeile, text}]
function pyVorpruefung(src) {
  const code = pyNurCode(src);
  const zeilen = code.split('\n');
  const warnungen = [];
  const importiert = new Set();
  for (const z of zeilen) {
    let m = z.match(/^\s*import\s+(.+)$/);
    if (m) m[1].split(',').forEach((t) => {
      const teile = t.trim().split(/\s+as\s+/);
      importiert.add((teile[1] || teile[0]).trim());
    });
    m = z.match(/^\s*from\s+(\w+)\s+import\b/);
    if (m) importiert.add('from:' + m[1]);
  }
  const definiert = new Set();
  for (const z of zeilen) {
    const m = z.match(/^\s*(?:def|class)\s+(\w+)|^\s*(\w+)\s*=/);
    if (m) definiert.add(m[1] || m[2]);
  }
  const gemeldet = new Set();
  zeilen.forEach((z, i) => {
    const re = /(?<![\w.])(pbc|time|random|math|turtle|os)\.(\w+)/g;
    let m;
    while ((m = re.exec(z)) !== null) {
      const [, modul, name] = m;
      if (definiert.has(modul)) continue;          // a variable called e.g. "time"
      if (!importiert.has(modul) && !gemeldet.has('imp:' + modul)) {
        gemeldet.add('imp:' + modul);
        warnungen.push({ zeile: i + 1, text: t('„%1“ wird benutzt, aber nicht importiert. Schreibe oben: import %1').replace(/%1/g, modul) });
      }
      const bekannt = PY_MODUL_NAMEN[modul];
      if (bekannt && bekannt.indexOf(name) < 0 && !gemeldet.has(modul + '.' + name)) {
        gemeldet.add(modul + '.' + name);
        const v = pyVorschlag(name, bekannt);
        warnungen.push({ zeile: i + 1, text: t('%1 gibt es nicht.').replace('%1', modul + '.' + name) + (v ? ' ' + t('Meintest du %1?').replace('%1', modul + '.' + v) : '') });
      }
    }
  });
  return warnungen;
}

// ---- error line in the editor ---------------------------------------
let pyFehlerZeileHandle = null;
function pyFehlerzeileLoeschen() {
  if (pyFehlerZeileHandle && codeEditor) {
    codeEditor.removeLineClass(pyFehlerZeileHandle, 'background', 'cm-fehlerzeile');
  }
  pyFehlerZeileHandle = null;
}
window.pbcMarkiereFehlerzeile = function (zeile) {
  if (!isTextMode || !codeEditor || !(zeile >= 1)) return;
  pyFehlerzeileLoeschen();
  const n = Math.min(zeile, codeEditor.lineCount()) - 1;
  pyFehlerZeileHandle = codeEditor.addLineClass(n, 'background', 'cm-fehlerzeile');
  codeEditor.setCursor({ line: n, ch: 0 });
  codeEditor.scrollIntoView({ line: n, ch: 0 }, 80);
};
function pySpringeZuZeile(zeile) {
  if (!isTextMode || !codeEditor) return;
  window.pbcMarkiereFehlerzeile(zeile);
  codeEditor.focus();
}

// ---- completion -----------------------------------------------------
function pyHinweise(cm) {
  const cur = cm.getCursor();
  const vorher = cm.getLine(cur.line).slice(0, cur.ch);
  const m = vorher.match(/((?:self\.)?\w+)\.(\w*)$/);
  if (!m) return null;
  const [, obj, anfang] = m;
  let liste = PY_MODUL_NAMEN[obj];
  if (!liste) {
    const art = pyObjektArten(pyNurCode(cm.getValue()))[obj];
    liste = art && PY_OBJEKT_METHODEN[art];
  }
  if (!liste) return null;
  const treffer = liste.filter((n) => n.toLowerCase().startsWith(anfang.toLowerCase()));
  if (!treffer.length) return null;
  return { list: treffer, from: CodeMirror.Pos(cur.line, cur.ch - anfang.length), to: cur };
}

function pyEditorHilfenAnbinden() {
  if (!codeEditor || codeEditor.__pyHilfen) return;
  codeEditor.__pyHilfen = true;
  codeEditor.on('change', (cm, ch) => {
    pyFehlerzeileLoeschen();
    if (ch.origin === '+input' && ch.text.join('') === '.' && CodeMirror.showHint) {
      cm.showHint({ hint: pyHinweise, completeSingle: false });
    }
  });
  const keys = Object.assign({}, codeEditor.getOption('extraKeys') || {});
  keys['Ctrl-Space'] = (cm) => CodeMirror.showHint && cm.showHint({ hint: pyHinweise, completeSingle: false });
  codeEditor.setOption('extraKeys', keys);
}

// Started after the whole script ran (term is declared further down).
// ensureCodeEditor() is called lazily; attach once it exists.
setTimeout(function warteAufEditor() {
  if (typeof codeEditor !== 'undefined' && codeEditor) { pyEditorHilfenAnbinden(); return; }
  setTimeout(warteAufEditor, 300);
}, 0);

// "line N" in the terminal: click jumps to the line.
setTimeout(function terminalLinks() {
  if (typeof term === 'undefined' || !term || !term.registerLinkProvider) {
    setTimeout(terminalLinks, 300);
    return;
  }
  term.registerLinkProvider({
    provideLinks(y, callback) {
      const zeile = term.buffer.active.getLine(y - 1);
      const text = zeile ? zeile.translateToString(true) : '';
      const links = [];
      const re = /File "<stdin>", (line (\d+))/g;
      let m;
      while (isTextMode && (m = re.exec(text)) !== null) {
        const start = m.index + m[0].length - m[1].length;
        const n = Number(m[2]);
        links.push({
          range: { start: { x: start + 1, y }, end: { x: start + m[1].length, y } },
          text: m[1],
          activate: () => pySpringeZuZeile(n),
        });
      }
      callback(links.length ? links : undefined);
    },
  });
}, 0);

// Check before a run in text mode: warnings in yellow, run continues.
function pyVorpruefungZeigen() {
  if (!isTextMode || !codeEditor || typeof term === 'undefined') return;
  pyFehlerzeileLoeschen();
  const w = pyVorpruefung(codeEditor.getValue());
  for (const x of w.slice(0, 8)) {
    term.write('\x1b[33mHinweis Zeile ' + x.zeile + ': ' + x.text + '\x1b[0m\r\n');
  }
}
