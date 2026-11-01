/* =====================================================================
 * Block + sidebar definitions
 * ===================================================================== */

const COLORS_HUE = {
  display:  '#4f9eff', draw:    '#5fb1ff', text:    '#b54fff',
  led:      '#f5a142', sound:   '#ff6f9c', input:   '#3fb95c',
  sensor:   '#3fc5b9', sprite:  '#e0c64a', control: '#c98ad6',
  value:    '#80a0c0', turtle:  '#58cf8b', console: '#c98ad6',
  misc:     '#9b8c7a', operators: '#b06a8a', starter: '#d8943a',
  methods:  '#69a9b3', canvas: '#7c8df5', math: '#7ea4d7',
  lists:    '#9a7ae0',
};
const HUE_NUM = {  // Blockly wants a numeric hue (0..360) on JSON blocks
  display:  210, draw: 205, text: 280, led: 30, sound: 340,
  input:    140, sensor: 175, sprite: 50,  control: 295, value: 230,
  turtle:   145, console: 295, misc: 35,  operators: 330, starter: 38,
  methods:  190, canvas: 230, math: 215, lists: 260,
};

const NAMED_COLORS = [
  // weiß first so a freshly-dropped "Farbe nach Namen" block (whose
  // dropdown defaults to the first option) starts on white -- the most
  // useful default for drawing on the device's black screen.
  ['weiß',     'WHITE'],   ['schwarz', 'BLACK'],
  ['rot',      'RED'],     ['grün',    'GREEN'],
  ['blau',     'BLUE'],    ['gelb',    'YELLOW'],
  ['cyan',     'CYAN'],    ['magenta', 'MAGENTA'],
  ['grau',     'GRAY'],    ['orange',  'ORANGE'],
  ['lila',     'PURPLE'],
];

// Dropdown entries whose constant does NOT exist in pbc.py -- neither
// in the emulator's module nor in the device firmware. Emitting
// `pbc.GRAY` for "grau" raised AttributeError on BOTH targets, which
// is why the colour silently did nothing everywhere. We emit the
// literal mix instead: no firmware change needed, and it renders
// identically on emulator and hardware.
//
// Deliberately NOT solved by adding GRAY to the emulator's pbc module
// only -- that would make `pbc.GRAY` work in the browser and still
// fail on the device, i.e. exactly the emulator/hardware divergence
// this file already suffers from elsewhere. Once pbc.py on the device
// grows a GRAY constant, drop the entry here and the generator falls
// back to `pbc.GRAY` on its own.
const COLOR_CONST_FALLBACK = {
  GRAY: 'pbc.rgb(128, 128, 128)',
};
const BUTTON_NAMES = [
  ['HOCH', 'up'], ['RUNTER', 'down'], ['LINKS', 'left'], ['RECHTS', 'right'],
  ['MITTE', 'center'], ['A', 'a'], ['B', 'b'],
];

const VI = (name, check) =>
  check ? { type: 'input_value', name, check }
        : { type: 'input_value', name };

// Wrap a generated expression in str() if it's not already obviously
// a string literal. Used by the "Text"-on-display, "Text"-on-canvas,
// and similar blocks so the student can plug in a number (or any
// other variable) and have it Just Work. pbc.text12() insists on a
// string, so `pbc.text12(42, ...)` would crash with a TypeError;
// `pbc.text12(str(42), ...)` is fine.
//
// We skip the wrap for the obvious cases (literal '...' or "..."
// strings) to keep the generated code readable when the student
// has actually typed a string into the field.
function asStringExpr(expr) {
  if (!expr || expr === "''" || expr === '""') return expr;
  const trimmed = expr.trim();
  // Already a Python string literal -- single, double, or triple
  // quoted -- leave it alone.
  if (/^(['"]).*\1$/.test(trimmed))   return expr;
  if (/^("""|''').*\1$/.test(trimmed)) return expr;
  // Already wrapped in str(...) -- avoid double-wrapping which would
  // produce `str(str(x))`.
  if (/^str\s*\(/.test(trimmed))       return expr;
  return `str(${expr})`;
}

// Helper for the sidebar filter: a block's `cat` field can be either
// a single category key (the original schema) OR an array of keys
// (so the block can appear in more than one section). Used for the
// color picker / rgb mixer blocks, which sit nicely in Display but
// are equally useful when working with Canvas or Turtle -- the
// student shouldn't have to remember which menu they came from.
// The circle blocks need the radius twice (x and y radius). A plain
// number or name can simply be repeated; any other expression (e.g. a
// random number) is evaluated once into _r first -- otherwise the two
// radii differ and the "circle" comes out as an egg.
function circleRadius(r) {
  r = String(r);
  if (/^\(?-?[\w.]+\)?$/.test(r)) return ['', r];
  return [`_r = ${r}\n`, '_r'];
}

// Blockly variable type of list variables (see isListVariable).
const LIST_TYPE = 'List';
// Variable field that only offers lists.
const LIST_FIELD = (name) => ({ type: 'field_variable', name, variable: t('liste'),
                                variableTypes: [LIST_TYPE], defaultType: LIST_TYPE });

function blockInCategory(block, key) {
  if (!block || !block.cat) return false;
  if (Array.isArray(block.cat)) return block.cat.indexOf(key) >= 0;
  return block.cat === key;
}

const PBC_BLOCKS = [

  // =====================================================================
  // Display  -- everything that draws on the screen (was: display + draw
  // + text + value categories, now all under one heading)
  // =====================================================================

  { cat: 'display',
    def: { type: 'pbc_clear', message0: 'Bildschirm löschen',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Bildschirm löschen',
    gen: () => 'pbc.clear()\n' },

  { cat: 'display',
    def: { type: 'pbc_fill', message0: 'Bildschirm füllen mit %1',
           args0: [VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Bildschirm füllen',
    gen: (b, g) =>
      `pbc.fill(${g.valueToCode(b,'COLOR',0) || 'pbc.BLACK'})\n` },

  // ---- Color values, right after fill so they sit next to (and just
  //      above) the drawing blocks that consume them ----
  { cat: 'display',
    def: { type: 'pbc_color_named',
           message0: 'Farbe %1',
           args0: [{ type: 'field_dropdown', name: 'NAME',
                     options: NAMED_COLORS }],
           output: 'Number',
           colour: HUE_NUM.value },
    label: 'Farbe nach Namen',
    gen: (b) => {
      const name = b.getFieldValue('NAME');
      return [COLOR_CONST_FALLBACK[name] || `pbc.${name}`, 0];
    } },

  { cat: ['display', 'canvas', 'turtle', 'led'],
    def: { type: 'pbc_rgb',
           message0: 'Farbe rot %1 grün %2 blau %3',
           args0: [VI('R','Number'), VI('G','Number'), VI('B','Number')],
           output: 'Number',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'Farbe(r, g, b)',
    gen: (b, g) =>
      [`pbc.rgb(${g.valueToCode(b,'R',0)||0}, ${g.valueToCode(b,'G',0)||0}, ${g.valueToCode(b,'B',0)||0})`, 0] },

  // ---- Drawing primitives ----
  { cat: 'display',
    def: { type: 'pbc_pixel', message0: 'Pixel x %1 y %2 Farbe %3',
           args0: [VI('X','Number'), VI('Y','Number'), VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display, inputsInline: true },
    label: 'Pixel',
    gen: (b, g) =>
      `pbc.pixel(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n` },

  { cat: 'display',
    def: { type: 'pbc_line',
           message0: 'Linie von x %1 y %2 bis x %3 y %4 Farbe %5',
           args0: [VI('X1','Number'), VI('Y1','Number'),
                   VI('X2','Number'), VI('Y2','Number'),
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Linie',
    gen: (b, g) =>
      `pbc.line(${g.valueToCode(b,'X1',0)||0}, ${g.valueToCode(b,'Y1',0)||0}, ${g.valueToCode(b,'X2',0)||0}, ${g.valueToCode(b,'Y2',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n` },

  { cat: 'display',
    def: { type: 'pbc_rect',
           message0: '%1 Rechteck x %2 y %3 b %4 h %5 Farbe %6',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['Umriss','OUTLINE'],['gefüllt','FILL']] },
                   VI('X','Number'), VI('Y','Number'),
                   VI('W','Number'), VI('H','Number'),
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Rechteck',
    gen: (b, g) => {
      const fn = b.getFieldValue('STYLE') === 'FILL' ? 'fill_rect' : 'rect';
      return `pbc.${fn}(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'W',0)||0}, ${g.valueToCode(b,'H',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'display',
    def: { type: 'pbc_ellipse',
           // Two lines: first the headline ("Ellipse gefüllt"),
           // second the coordinates. Friendlier than the single-row
           // version because (a) the eye doesn't have to scan past
           // five anonymous inputs in a row, and (b) the field names
           // can be in plain German/English instead of cx/rx codes.
           message0: 'Ellipse %1 %2'
                   + 'Mitte x %3 y %4 %5'
                   + 'Breite %6 Höhe %7 %8'
                   + 'Farbe %9',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['gefüllt','FILL'],['Umriss','OUTLINE']] },
                   { type: 'input_dummy' },
                   VI('CX','Number'), VI('CY','Number'),
                   { type: 'input_dummy' },
                   VI('RX','Number'), VI('RY','Number'),
                   { type: 'input_dummy' },
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Ellipse',
    gen: (b, g) => {
      const tail = b.getFieldValue('STYLE') === 'FILL' ? ', fill=True' : '';
      // The block exposes radii (half-axes), so divide width/height
      // by 2 to land on the centre-radius convention pbc.ellipse uses.
      return `pbc.ellipse(${g.valueToCode(b,'CX',0)||0}, ${g.valueToCode(b,'CY',0)||0}, (${g.valueToCode(b,'RX',0)||0})//2, (${g.valueToCode(b,'RY',0)||0})//2, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'}${tail})\n`;
    } },

  // Circle: a friendlier specialised form of the ellipse where the
  // student only needs centre, radius and colour -- no separate width
  // and height. Generates the same pbc.ellipse() call under the hood
  // with rx == ry, since the firmware has no dedicated circle API.
  { cat: 'display',
    def: { type: 'pbc_circle',
           message0: 'Kreis %1 %2'
                   + 'Mitte x %3 y %4 %5'
                   + 'Radius %6 %7'
                   + 'Farbe %8',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['gefüllt','FILL'],['Umriss','OUTLINE']] },
                   { type: 'input_dummy' },
                   VI('CX','Number'), VI('CY','Number'),
                   { type: 'input_dummy' },
                   VI('R','Number'),
                   { type: 'input_dummy' },
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Kreis',
    gen: (b, g) => {
      const tail = b.getFieldValue('STYLE') === 'FILL' ? ', fill=True' : '';
      const [pre, r] = circleRadius(g.valueToCode(b,'R',0) || 0);
      return `${pre}pbc.ellipse(${g.valueToCode(b,'CX',0)||0}, ${g.valueToCode(b,'CY',0)||0}, ${r}, ${r}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'}${tail})\n`;
    } },

  // ---- Text (only proportional; "Text" without qualifier) ----
  // The TEXT slot accepts anything (no `check`) so the student can
  // plug in a variable, a math expression, or a number block. The
  // generator wraps the value in str() so pbc.text12() (which only
  // accepts strings) never sees a raw int and crashes.
  { cat: 'display',
    def: { type: 'pbc_text', message0: 'kleiner Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'), VI('X','Number'),
                   VI('Y','Number'), VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'kleiner Text',
    gen: (b, g) => {
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `pbc.text12(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  // Larger 18-px text -- same font as the normal Text block, just bigger.
  { cat: 'display',
    def: { type: 'pbc_text18', message0: 'Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'), VI('X','Number'),
                   VI('Y','Number'), VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'Text',
    gen: (b, g) => {
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `pbc.text18(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  // Largest 24-px text -- same font, 2x the normal Text block.
  { cat: 'display',
    def: { type: 'pbc_text24', message0: 'großer Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'), VI('X','Number'),
                   VI('Y','Number'), VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.display },
    label: 'großer Text',
    gen: (b, g) => {
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `pbc.text24(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  // String concatenation. Both sockets are deliberately untyped so
  // students can plug in numbers, strings, variables, anything --
  // the generator wraps each operand in str() if it isn't already
  // a string literal. That makes the natural pattern
  //     "Punkte: " & punkte
  // generate clean output ("Punkte: " + str(punkte)) instead of
  // crashing with TypeError. The block lives in PBC_BLOCKS so save
  // / load round-trips it correctly; it's `hidden: true` so it
  // doesn't appear in any sidebar category -- the only way to drop
  // one is via the "verbinden …" button in the Texts section.
  { cat: 'text',
    def: { type: 'pbc_str_concat',
           message0: 'verbinde %1 mit %2',
           args0: [VI('A'), VI('B')],
           output: 'String',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'verbinde … mit …',
    gen: (b, g) => {
      const a = g.valueToCode(b, 'A', 0) || "''";
      const c = g.valueToCode(b, 'B', 0) || "''";
      return [`${asStringExpr(a)} + ${asStringExpr(c)}`, 0];
    } },

  // Länge: len(text)
  { cat: 'text',
    def: { type: 'pbc_str_len',
           message0: 'Länge von %1',
           args0: [VI('S')],
           output: 'Number',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'Länge von …',
    gen: (b, g) => {
      const s = g.valueToCode(b, 'S', 0) || "''";
      return [`len(${asStringExpr(s)})`, 0];
    } },

  // Zeichen an Position: text[i]
  { cat: 'text',
    def: { type: 'pbc_str_char_at',
           message0: 'Zeichen %1 von %2',
           args0: [VI('I', 'Number'), VI('S')],
           output: 'String',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'Zeichen … von …',
    gen: (b, g) => {
      const i = g.valueToCode(b, 'I', 0) || '0';
      const s = g.valueToCode(b, 'S', 0) || "''";
      return [`${asStringExpr(s)}[${i}]`, 0];
    } },

  // Teilstück: text[a:b]
  { cat: 'text',
    def: { type: 'pbc_str_slice',
           message0: 'Teilstück von %1 ab %2 bis %3',
           args0: [VI('S'), VI('A', 'Number'), VI('B', 'Number')],
           output: 'String',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'Teilstück von … ab … bis …',
    gen: (b, g) => {
      const s = g.valueToCode(b, 'S', 0) || "''";
      const a = g.valueToCode(b, 'A', 0) || '0';
      const c = g.valueToCode(b, 'B', 0) || '0';
      return [`${asStringExpr(s)}[${a}:${c}]`, 0];
    } },

  // Groß-/Kleinschreibung: .upper() / .lower()
  { cat: 'text',
    def: { type: 'pbc_str_case',
           message0: '%1 in %2',
           args0: [VI('S'),
                   { type: 'field_dropdown', name: 'MODE',
                     options: [['GROSSBUCHSTABEN', 'upper'],
                               ['kleinbuchstaben', 'lower']] }],
           output: 'String',
           colour: HUE_NUM.value, inputsInline: true },
    label: 'in GROSS / klein',
    gen: (b, g) => {
      const s = g.valueToCode(b, 'S', 0) || "''";
      const mode = b.getFieldValue('MODE');
      return [`${asStringExpr(s)}.${mode}()`, 0];
    } },

  // Enthält: teil in text
  { cat: 'text',
    def: { type: 'pbc_str_contains',
           message0: '%1 enthält %2',
           args0: [VI('S'), VI('SUB')],
           output: 'Boolean',
           colour: HUE_NUM.value, inputsInline: true },
    label: '… enthält …',
    gen: (b, g) => {
      const s = g.valueToCode(b, 'S', 0) || "''";
      const sub = g.valueToCode(b, 'SUB', 0) || "''";
      return [`(${asStringExpr(sub)} in ${asStringExpr(s)})`, 0];
    } },


  { cat: 'display',
    def: { type: 'pbc_const',
           message0: '%1',
           args0: [{ type: 'field_dropdown', name: 'WHICH',
                     options: [['Bildschirmbreite', 'WIDTH'],
                               ['Bildschirmhöhe',   'HEIGHT']] }],
           output: 'Number',
           colour: HUE_NUM.value },
    label: 'Bildschirm BREITE / HÖHE',
    gen: (b) => [`pbc.${b.getFieldValue('WHICH')}`, 0] },

  // PNG-Bild aus dem Geräte-Dateisystem laden und sofort anzeigen.
  // Erwartet, dass die Datei vorher per "Bilder…" hochgeladen wurde.
  // Block ist JS-definiert (siehe defineImageBlocks weiter unten),
  // damit das Datei-Dropdown sich dynamisch an die gerade hochgeladenen
  // Bilder anpassen kann.
  { cat: 'display',
    def: { type: 'pbc_show_image' },
    skipJson: true,
    label: 'Bild anzeigen',
    gen: (b, g) => {
      // Filenames can't legitimately contain backslashes, quotes or
      // line terminators. If any sneak in (e.g. because something
      // upstream forgot to strip CRLF), they'd corrupt the generated
      // Python string literal -- so we strip them defensively here.
      const name = (b.getFieldValue('NAME') || '')
        .replace(/[\r\n\\']/g, '');
      return `pbc.show(pbc.load_image('${name}'), ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0})\n`;
    } },

  // =====================================================================
  // LEDs
  // =====================================================================
  { cat: 'led',
    def: { type: 'pbc_led',
           message0: 'setze %1 LED %2',
           args0: [{ type: 'field_dropdown', name: 'WHICH',
                     options: [['rot','red'],['gelb','yellow'],['grün','green']] },
                   { type: 'field_dropdown', name: 'STATE',
                     options: [['an','True'],['aus','False']] }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.led },
    label: 'Status-LED setzen',
    gen: (b) =>
      `pbc.led_${b.getFieldValue('WHICH')}(${b.getFieldValue('STATE')})\n` },

  { cat: 'led',
    def: { type: 'pbc_leds_off', message0: 'alle Status-LEDs aus',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.led },
    label: 'alle Status-LEDs aus',
    gen: () => 'pbc.leds_off()\n' },

  { cat: 'led',
    def: { type: 'pbc_rgb_led', message0: 'RGB-LED rot %1 grün %2 blau %3',
           args0: [VI('R','Number'), VI('G','Number'), VI('B','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.led, inputsInline: true },
    label: 'RGB-LED setzen',
    gen: (b, g) =>
      `pbc.rgb_led(${g.valueToCode(b,'R',0)||0}, ${g.valueToCode(b,'G',0)||0}, ${g.valueToCode(b,'B',0)||0})\n` },

  // Set RGB LED from an RGB565 color expression (e.g. the color
  // picker output). Generates a one-line snippet that splits the
  // RGB565 value back into 8-bit R/G/B components inline -- works
  // with any pbc.py version without firmware changes.
  { cat: 'led',
    def: { type: 'pbc_rgb_led_color',
           message0: 'RGB-LED auf Farbe %1',
           args0: [VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.led, inputsInline: true },
    label: 'RGB-LED auf Farbe',
    gen: (b, g) => {
      const c = g.valueToCode(b, 'COLOR', 0) || '0';
      // Use a temp so we don't evaluate the expression three times
      // (the picker is cheap, but a variable lookup or a function
      // call would be more visible if multiplied).
      return `_c = ${c}; pbc.rgb_led((_c >> 8) & 0xF8, (_c >> 3) & 0xFC, (_c << 3) & 0xF8)\n`;
    } },

  { cat: 'led',
    def: { type: 'pbc_rgb_led_off', message0: 'RGB-LED aus',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.led },
    label: 'RGB-LED aus',
    gen: () => 'pbc.rgb_led_off()\n' },

  // =====================================================================
  // Sound
  // =====================================================================
  { cat: 'sound',
    def: { type: 'pbc_tone',
           message0: 'Ton %1 Hz für %2 ms',
           args0: [VI('FREQ','Number'), VI('MS','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sound, inputsInline: true },
    label: 'Ton für ms abspielen',
    gen: (b, g) =>
      `pbc.tone(${g.valueToCode(b,'FREQ',0)||880}, ${g.valueToCode(b,'MS',0)||200})\n` },

  { cat: 'sound',
    def: { type: 'pbc_tone_continuous',
           message0: 'Dauerton %1 Hz starten',
           args0: [VI('FREQ','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sound },
    label: 'Dauerton starten',
    gen: (b, g) =>
      `pbc.tone(${g.valueToCode(b,'FREQ',0)||880})\n` },

  { cat: 'sound',
    def: { type: 'pbc_tone_off', message0: 'Ton stoppen',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sound },
    label: 'Ton stoppen',
    gen: () => 'pbc.tone_off()\n' },

  // =====================================================================
  // Eingabe (buttons)
  // =====================================================================
  { cat: 'input',
    def: { type: 'pbc_pressed',
           message0: 'wird %1 gedrückt?',
           args0: [{ type: 'field_dropdown', name: 'BTN', options: BUTTON_NAMES }],
           output: 'Boolean', colour: HUE_NUM.input },
    label: 'Taste gedrückt?',
    gen: (b) => [`pbc.pressed_${b.getFieldValue('BTN')}()`, 0] },

  { cat: 'input',
    def: { type: 'pbc_was_pressed',
           message0: 'wurde %1 seit der letzten Abfrage gedrückt?',
           args0: [{ type: 'field_dropdown', name: 'BTN', options: BUTTON_NAMES }],
           output: 'Boolean', colour: HUE_NUM.input },
    label: 'Taste vorher gedrückt?',
    gen: (b) => [`pbc.was_pressed_${b.getFieldValue('BTN')}()`, 0] },

  { cat: 'input',
    def: { type: 'pbc_wait_button',
           message0: 'auf beliebige Taste warten',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.input },
    label: 'auf Taste warten',
    gen: () => 'pbc.wait_for_button()\n' },

  // Wait for a specific button, with a dropdown for the choice.
  // Emits an inline poll loop because pbc.py currently only offers
  // wait_for_button() for "any button" -- one sleep_ms(10) per iter
  // keeps CPU and bus traffic low.
  { cat: 'input',
    def: { type: 'pbc_wait_specific_button',
           message0: 'auf %1 warten',
           args0: [{ type: 'field_dropdown', name: 'BTN', options: BUTTON_NAMES }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.input },
    label: 'auf bestimmte Taste warten',
    gen: (b) => {
      const btn = b.getFieldValue('BTN');
      // Poll the button via the pre-existing pressed_* function and
      // also drain any latched was_pressed_* edge afterwards, so a
      // later `was_pressed_x?`-check downstream doesn't fire on the
      // press we just consumed here.
      return (
        `while not pbc.pressed_${btn}():\n` +
        `    time.sleep_ms(10)\n` +
        `pbc.was_pressed_${btn}()  # Flanke abräumen\n` +
        `while pbc.pressed_${btn}():\n` +
        `    time.sleep_ms(10)\n`);
    } },

  // =====================================================================
  // Sensor (g-sensor only; battery voltage removed)
  // =====================================================================
  { cat: 'sensor',
    def: { type: 'pbc_accel',
           message0: 'Beschleunigung %1 in %2',
           args0: [{ type: 'field_dropdown', name: 'AXIS',
                     options: [['X','x'],['Y','y'],['Z','z']] },
                   { type: 'field_dropdown', name: 'UNIT',
                     options: [['g','_g'],['m/s²','']] }],
           output: 'Number', colour: HUE_NUM.sensor },
    label: 'Beschleunigung X/Y/Z (g oder m/s²)',
    gen: (b) =>
      [`pbc.accel_${b.getFieldValue('AXIS')}${b.getFieldValue('UNIT')}()`, 0] },

  // =====================================================================
  // Sprites
  //
  // Mental model for the kids: a sprite is a movable picture on the
  // screen. They name it once (via the "+ neues Sprite…" button in
  // the Sprites category), pick an image, and from then on the name
  // appears in dropdowns on the operation blocks.
  //
  // No Canvas, no draw(), no blit. The sprite class in pbc.py keeps
  // a list of visible sprites internally and repaints them whenever
  // anything changes -- the kids never see a clear/redraw cycle.
  // =====================================================================

  // The dropdown of currently-defined sprites for use in operation
  // blocks. Computed at block-init time; the IDE re-renders blocks
  // when the sprite list changes (see refreshSpritesCategory). If
  // no sprites exist yet, a placeholder option keeps the block
  // renderable.
  { cat: 'sprite',
    def: { type: 'pbc_sprite_show',
           message0: 'zeige Sprite %1',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_show', dropAt),
    label: 'zeige Sprite',
    gen: (b) => `${b.getFieldValue('SP') || '_sprite'}.show()\n` },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_hide',
           message0: 'verstecke Sprite %1',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_hide', dropAt),
    label: 'verstecke Sprite',
    gen: (b) => `${b.getFieldValue('SP') || '_sprite'}.hide()\n` },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_set_to',
           message0: 'setze Sprite %1 auf x %2 y %3',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions },
                   VI('X','Number'), VI('Y','Number')],
           previousStatement: null, nextStatement: null,
           inputsInline: true,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_set_to', dropAt),
    label: 'Sprite setzen auf x/y',
    gen: (b, g) => {
      const sp = b.getFieldValue('SP') || '_sprite';
      return `${sp}.set_to(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0})\n`;
    } },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_set_by',
           message0: 'versetze Sprite %1 um x %2 y %3',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions },
                   VI('DX','Number'), VI('DY','Number')],
           previousStatement: null, nextStatement: null,
           inputsInline: true,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_set_by', dropAt),
    label: 'Sprite versetzen um dx/dy',
    gen: (b, g) => {
      const sp = b.getFieldValue('SP') || '_sprite';
      return `${sp}.set_by(${g.valueToCode(b,'DX',0)||0}, ${g.valueToCode(b,'DY',0)||0})\n`;
    } },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_glide_to',
           message0: 'gleite Sprite %1 nach x %2 y %3 in %4 ms',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions },
                   VI('X','Number'), VI('Y','Number'),
                   VI('MS','Number')],
           previousStatement: null, nextStatement: null,
           inputsInline: true,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_glide_to', dropAt),
    label: 'gleite Sprite nach x/y',
    gen: (b, g) => {
      const sp = b.getFieldValue('SP') || '_sprite';
      return `${sp}.glide_to(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'MS',0)||1000})\n`;
    } },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_glide_by',
           message0: 'gleite Sprite %1 um x %2 y %3 in %4 ms',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions },
                   VI('DX','Number'), VI('DY','Number'),
                   VI('MS','Number')],
           previousStatement: null, nextStatement: null,
           inputsInline: true,
           colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_glide_by', dropAt),
    label: 'gleite Sprite um dx/dy',
    gen: (b, g) => {
      const sp = b.getFieldValue('SP') || '_sprite';
      return `${sp}.glide_by(${g.valueToCode(b,'DX',0)||0}, ${g.valueToCode(b,'DY',0)||0}, ${g.valueToCode(b,'MS',0)||1000})\n`;
    } },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_get_x',
           message0: 'x von Sprite %1',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions }],
           output: 'Number', colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_get_x', dropAt),
    label: 'x von Sprite',
    gen: (b) => [`${b.getFieldValue('SP') || '_sprite'}.x`, 0] },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_get_y',
           message0: 'y von Sprite %1',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions }],
           output: 'Number', colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_get_y', dropAt),
    label: 'y von Sprite',
    gen: (b) => [`${b.getFieldValue('SP') || '_sprite'}.y`, 0] },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_touches',
           message0: 'Sprite %1 berührt Sprite %2',
           args0: [{ type: 'field_dropdown', name: 'A',
                     options: spriteNameOptions },
                   { type: 'field_dropdown', name: 'B',
                     options: spriteNameOptions }],
           output: 'Boolean', colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_touches', dropAt),
    label: 'Sprite berührt Sprite',
    gen: (b) => {
      const a = b.getFieldValue('A') || '_sprite';
      const bb = b.getFieldValue('B') || '_sprite';
      return [`${a}.touches(${bb})`, 0];
    } },

  { cat: 'sprite',
    def: { type: 'pbc_sprite_touches_edge',
           message0: 'Sprite %1 berührt Rand',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions }],
           output: 'Boolean', colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_touches_edge', dropAt),
    label: 'Sprite berührt Rand',
    gen: (b) => [`${b.getFieldValue('SP') || '_sprite'}.touches_edge()`, 0] },

  // Pixel-exact colour check against the background canvas: only the
  // sprite's opaque pixels count, transparent corners are ignored.
  { cat: 'sprite',
    def: { type: 'pbc_sprite_on_color',
           message0: 'Sprite %1 berührt Farbe %2',
           args0: [{ type: 'field_dropdown', name: 'SP',
                     options: spriteNameOptions },
                   VI('COLOR', 'Number')],
           inputsInline: true,
           output: 'Boolean', colour: HUE_NUM.sprite },
    customSpawn: (dropAt) => spawnSpriteCommand('pbc_sprite_on_color', dropAt),
    label: 'Sprite berührt Farbe',
    gen: (b, g) => {
      const sp = b.getFieldValue('SP') || '_sprite';
      const c = g.valueToCode(b, 'COLOR', 0) || 'pbc.WHITE';
      return [`${sp}.on_color(${c})`, 0];
    } },

  // =====================================================================
  // Listen. A list is a variable of type LIST_TYPE, created with
  // "+ neue Liste…" in the Listen category (starts as []). Indexes
  // count from 0, exactly like the Python the blocks turn into.
  // =====================================================================
  { cat: 'lists',
    def: { type: 'list_set',
           message0: 'setze Liste %1 auf %2',
           args0: [LIST_FIELD('VAR'), VI('VALUE', 'Array')],
           previousStatement: null, nextStatement: null,
           inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_set', dropAt),
    label: 'setze Liste … auf leer',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return `${l} = ${g.valueToCode(b, 'VALUE', 0) || '[]'}\n`;
    } },

  { cat: 'lists',
    def: { type: 'list_append',
           message0: 'hänge %1 an Liste %2 an',
           args0: [VI('VALUE', ['Number', 'String']), LIST_FIELD('VAR')],
           previousStatement: null, nextStatement: null,
           inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_append', dropAt),
    label: 'hänge … an Liste an',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return `${l}.append(${g.valueToCode(b, 'VALUE', 0) || '0'})\n`;
    } },

  { cat: 'lists',
    def: { type: 'list_get',
           message0: 'Element Nr. %1 von Liste %2',
           args0: [VI('INDEX', 'Number'), LIST_FIELD('VAR')],
           output: null, inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_get', dropAt),
    label: 'Element Nr. … von Liste',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return [`${l}[${g.valueToCode(b, 'INDEX', 0) || '0'}]`, 0];
    } },

  { cat: 'lists',
    def: { type: 'list_set_item',
           message0: 'setze Element Nr. %1 von Liste %2 auf %3',
           args0: [VI('INDEX', 'Number'), LIST_FIELD('VAR'),
                   VI('VALUE', ['Number', 'String'])],
           previousStatement: null, nextStatement: null,
           inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_set_item', dropAt),
    label: 'setze Element Nr. … auf …',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return `${l}[${g.valueToCode(b, 'INDEX', 0) || '0'}] = ` +
             `${g.valueToCode(b, 'VALUE', 0) || '0'}\n`;
    } },

  { cat: 'lists',
    def: { type: 'list_length',
           message0: 'Länge von Liste %1',
           args0: [LIST_FIELD('VAR')],
           output: 'Number', colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_length', dropAt),
    label: 'Länge von Liste',
    gen: (b, g) => [`len(${g.getVariableName(b.getFieldValue('VAR'))})`, 0] },

  { cat: 'lists',
    def: { type: 'list_contains',
           message0: 'Liste %1 enthält %2 ?',
           args0: [LIST_FIELD('VAR'), VI('VALUE', ['Number', 'String'])],
           output: 'Boolean', inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_contains', dropAt),
    label: 'Liste enthält …?',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return [`(${g.valueToCode(b, 'VALUE', 0) || '0'} in ${l})`, 0];
    } },

  { cat: 'lists',
    def: { type: 'list_pop',
           message0: 'entferne Element Nr. %1 aus Liste %2',
           args0: [VI('INDEX', 'Number'), LIST_FIELD('VAR')],
           previousStatement: null, nextStatement: null,
           inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_pop', dropAt),
    label: 'entferne Element Nr. …',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      return `${l}.pop(${g.valueToCode(b, 'INDEX', 0) || '0'})\n`;
    } },

  // Removing by value: guarded, so a value that isn't in the list is
  // simply ignored instead of stopping the program with ValueError.
  { cat: 'lists',
    def: { type: 'list_remove',
           message0: 'entferne %1 aus Liste %2',
           args0: [VI('VALUE', ['Number', 'String']), LIST_FIELD('VAR')],
           previousStatement: null, nextStatement: null,
           inputsInline: true, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_remove', dropAt),
    label: 'entferne Wert aus Liste',
    gen: (b, g) => {
      const l = g.getVariableName(b.getFieldValue('VAR'));
      const v = g.valueToCode(b, 'VALUE', 0) || '0';
      return `if ${v} in ${l}:\n${g.INDENT}${l}.remove(${v})\n`;
    } },

  { cat: 'lists',
    def: { type: 'list_for_each',
           message0: 'für jedes Element %1 in Liste %2 %3 %4',
           args0: [{ type: 'field_variable', name: 'ITEM', variable: t('element') },
                   LIST_FIELD('VAR'),
                   { type: 'input_dummy' },
                   { type: 'input_statement', name: 'DO' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_for_each', dropAt),
    label: 'für jedes Element in Liste',
    gen: (b, g) => {
      const item = g.getVariableName(b.getFieldValue('ITEM'));
      const l = g.getVariableName(b.getFieldValue('VAR'));
      const body = g.statementToCode(b, 'DO') || g.INDENT + 'pass\n';
      return `for ${item} in ${l}:\n${body}`;
    } },

  { cat: 'lists',
    def: { type: 'list_random',
           message0: 'zufälliges Element aus Liste %1',
           args0: [LIST_FIELD('VAR')],
           output: null, colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_random', dropAt),
    label: 'zufälliges Element aus Liste',
    gen: (b, g) => [`random.choice(${g.getVariableName(b.getFieldValue('VAR'))})`, 0] },

  // The list itself as a value, e.g. for "ausgeben" or to copy it.
  { cat: 'lists',
    def: { type: 'list_value',
           message0: 'Liste %1',
           args0: [LIST_FIELD('VAR')],
           output: 'Array', colour: HUE_NUM.lists },
    customSpawn: (dropAt) => spawnListCommand('list_value', dropAt),
    label: 'Liste (als Wert)',
    gen: (b, g) => [g.getVariableName(b.getFieldValue('VAR')), 0] },

  // =====================================================================
  // Kontrollstrukturen: time + endless loop (the standard control
  // structures from Blockly are added separately via STD_BLOCKS so they
  // share the same sidebar group).
  // =====================================================================
  // =====================================================================
  // Misc utilities -- timing, comments, restart. Things that don't
  // fit any of the other thematic categories.
  // =====================================================================
  { cat: 'time',
    def: { type: 'pbc_delay', message0: 'warte %1 ms',
           args0: [VI('MS','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.misc },
    label: 'warten (ms)',
    gen: (b, g) => `pbc.delay(${g.valueToCode(b,'MS',0)||100})\n` },

  // Wait in whole seconds -- friendlier than ms for longer pauses.
  { cat: 'time',
    def: { type: 'pbc_sleep_s', message0: 'warte %1 Sekunden',
           args0: [VI('S','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.misc },
    label: 'warten (Sekunden)',
    gen: (b, g) => `time.sleep(${g.valueToCode(b,'S',0)||1})\n` },

  { cat: 'time',
    def: { type: 'pbc_ticks_ms',
           message0: 'Zeit seit Programmstart (ms)',
           output: 'Number',
           colour: HUE_NUM.misc },
    label: 'Zeit seit Programmstart (ms)',
    gen: () => ['time.ticks_ms()', 0] },

  // Seconds since program start (ticks_ms / 1000.0, so fractional).
  { cat: 'time',
    def: { type: 'pbc_ticks_s',
           message0: 'Zeit seit Programmstart (Sekunden)',
           output: 'Number',
           colour: HUE_NUM.misc },
    label: 'Zeit seit Programmstart (Sekunden)',
    gen: () => ['(time.ticks_ms() / 1000)', 0] },

  // Elapsed time since an earlier ticks_ms() reading. Wraps
  // time.ticks_diff so it handles the MicroPython tick counter
  // wrap-around correctly -- the right way to measure a duration.
  { cat: 'time',
    def: { type: 'pbc_ticks_diff',
           message0: 'vergangene ms seit %1',
           args0: [VI('START','Number')],
           output: 'Number',
           colour: HUE_NUM.misc, inputsInline: true },
    label: 'vergangene ms seit …',
    gen: (b, g) => {
      const start = g.valueToCode(b, 'START', 0) || '0';
      return [`time.ticks_diff(time.ticks_ms(), ${start})`, 0];
    } },


  // Random integer in a closed range [a, b]. Uses random.randint
  // so the upper bound IS included, which is what students intuit
  // from "Zufallszahl zwischen 1 und 5" -- if 5 weren't included it
  // wouldn't really be "between 1 and 5". Auto-imports the random
  // module on first use; the gen also emits the import lazily so
  // programs that don't use this block don't pay the import cost.
  { cat: 'math',
    def: { type: 'pbc_random_int',
           message0: 'Zufallszahl zwischen %1 und %2',
           args0: [VI('LO', 'Number'), VI('HI', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Zufallszahl zwischen … und …',
    gen: (b, g) => {
      const lo = g.valueToCode(b, 'LO', 0) || '0';
      const hi = g.valueToCode(b, 'HI', 0) || '10';
      // We could also use random.randrange(lo, hi+1), but randint
      // is the more discoverable name and reads identically to the
      // block's label.
      g.definitions_['import_random'] = 'import random';
      return [`random.randint(${lo}, ${hi})`, 0];
    } },

  // A pure-cosmetic block: any text written here becomes a Python
  // comment in the generated code, useful to label sections. Doesn't
  // run anything on the device.
  { cat: '__comment__',
    def: { type: 'pbc_comment',
           message0: '# Kommentar: %1',
           args0: [{ type: 'field_input', name: 'TEXT', text: 'Notiz' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.misc },
    label: 'Kommentar',
    gen: (b) => {
      const text = (b.getFieldValue('TEXT') || '').replace(/\r?\n/g, ' ');
      return `# ${text}\n`;
    } },

  // Clamp a value to a min/max range. The single most-requested
  // utility for sprite-movement code -- "stay on screen" is
  //     spieler.x = beschränken(spieler.x, 0, BREITE)
  // without it students end up writing 4-branch if/elif trees.
  { cat: 'math',
    def: { type: 'pbc_clamp',
           message0: '%1 beschränken auf %2 .. %3',
           args0: [VI('V', 'Number'), VI('LO', 'Number'), VI('HI', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Wert beschränken',
    gen: (b, g) => {
      const v  = g.valueToCode(b, 'V',  0) || '0';
      const lo = g.valueToCode(b, 'LO', 0) || '0';
      const hi = g.valueToCode(b, 'HI', 0) || '100';
      return [`max(${lo}, min(${hi}, ${v}))`, 0];
    } },

  // Map a value from one range to another (linear interpolation).
  // Hugely useful for sensors -- e.g. mapping accelerometer -1..+1
  // onto screen coordinates 0..240. Same shape as Arduino's map().
  { cat: 'math',
    def: { type: 'pbc_map',
           message0: '%1 abbilden von %2 .. %3 auf %4 .. %5',
           args0: [VI('V', 'Number'),
                   VI('A', 'Number'), VI('B', 'Number'),
                   VI('C', 'Number'), VI('D', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Wert abbilden',
    gen: (b, g) => {
      const v = g.valueToCode(b, 'V', 0) || '0';
      const a = g.valueToCode(b, 'A', 0) || '0';
      const bb = g.valueToCode(b, 'B', 0) || '1';
      const c = g.valueToCode(b, 'C', 0) || '0';
      const d = g.valueToCode(b, 'D', 0) || '100';
      // Wrap in int(): the result is almost always used as a screen
      // coordinate, and the device's drawing functions (pbc.ellipse,
      // pbc.pixel, ...) reject floats with "can't convert float to int".
      // The division stays float for accuracy, then int() truncates
      // once at the end.
      return [`int(${c} + (${v} - ${a}) * (${d} - ${c}) / (${bb} - ${a}))`, 0];
    } },

  // Wurzel: math.sqrt(x)
  { cat: 'math',
    def: { type: 'pbc_sqrt',
           message0: 'Wurzel aus %1',
           args0: [VI('X', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Wurzel aus …',
    gen: (b, g) => {
      const x = g.valueToCode(b, 'X', 0) || '0';
      return [`math.sqrt(${x})`, 0];
    } },

  // Potenz: a ** b
  { cat: 'math',
    def: { type: 'pbc_pow',
           message0: '%1 hoch %2',
           args0: [VI('A', 'Number'), VI('B', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: '… hoch …',
    gen: (b, g) => {
      const a = g.valueToCode(b, 'A', 0) || '0';
      const e = g.valueToCode(b, 'B', 0) || '2';
      return [`(${a}) ** (${e})`, 0];
    } },

  // Betrag: abs(x)
  { cat: 'math',
    def: { type: 'pbc_abs',
           message0: 'Betrag von %1',
           args0: [VI('X', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Betrag von …',
    gen: (b, g) => {
      const x = g.valueToCode(b, 'X', 0) || '0';
      return [`abs(${x})`, 0];
    } },

  // Runden: round(x)
  { cat: 'math',
    def: { type: 'pbc_round',
           message0: '%1 runden',
           args0: [VI('X', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: '… runden',
    gen: (b, g) => {
      const x = g.valueToCode(b, 'X', 0) || '0';
      return [`round(${x})`, 0];
    } },

  // Min / Max von zwei Werten (per dropdown)
  { cat: 'math',
    def: { type: 'pbc_min_max',
           message0: '%1 von %2 und %3',
           args0: [{ type: 'field_dropdown', name: 'WHICH',
                     options: [['Minimum', 'min'], ['Maximum', 'max']] },
                   VI('A', 'Number'), VI('B', 'Number')],
           output: 'Number',
           colour: HUE_NUM.math, inputsInline: true },
    label: 'Minimum / Maximum',
    gen: (b, g) => {
      const fn = b.getFieldValue('WHICH');
      const a = g.valueToCode(b, 'A', 0) || '0';
      const bb = g.valueToCode(b, 'B', 0) || '0';
      return [`${fn}(${a}, ${bb})`, 0];
    } },

  { cat: 'control',
    def: { type: 'pbc_forever', message0: 'unendlich wiederholen %1 %2',
           args0: [{ type: 'input_dummy' },
                   { type: 'input_statement', name: 'BODY' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.control },
    label: 'unendlich wiederholen',
    gen: (b, g) => {
      const body = g.statementToCode(b, 'BODY') || '    pass\n';
      return `while True:\n${body}`;
    } },

  // The "Beim Start" hat block. There's only ever one of these and
  // it's not draggable from any sidebar -- it appears in the
  // workspace from the moment the user opens the IDE, with
  // .setDeletable(false) so it can't disappear. It's a HAT: a flat
  // bar that the program's blocks attach UNDER (via nextStatement),
  // not a C-shape that wraps them. So the body isn't indented and
  // there's no enclosing bracket -- the blocks just hang below.
  // Orphaned blocks elsewhere on the workspace are silently ignored
  // by the code generator.
  { cat: '__hidden__',
    def: { type: 'pbc_when_start',
           message0: 'Beim Start',
           nextStatement: null,
           colour: HUE_NUM.starter },
    label: 'Beim Start',
    // No-op gen: the code generator handles this hat specially by
    // walking the chain of blocks attached below it.
    gen: () => '' },


  // pbc.rgb(r, g, b) so the chosen color is a usable RGB565 int.
  //
  // We don't use field_color from core because Blockly 12 moved it
  // into a separate plugin package that's awkward to load standalone.
  // ============================================================
  { cat: ['display', 'canvas', 'turtle', 'led'],
    def: { type: 'pbc_color_picker',
           message0: 'Farbe %1',
           args0: [{ type: 'field_input', name: 'COLOR', text: '#ff8040' }],
           output: 'Number',
           colour: HUE_NUM.value },
    label: 'Farbwähler',
    gen: (b) => {
      const hex = (b.getFieldValue('COLOR') || '#ffffff').trim();
      const m = hex.match(/^#?([0-9a-f]{6})$/i);
      if (!m) return [`pbc.rgb(255, 255, 255)`, 0];
      const v = m[1];
      const r  = parseInt(v.substr(0, 2), 16);
      const g  = parseInt(v.substr(2, 2), 16);
      const bl = parseInt(v.substr(4, 2), 16);
      return [`pbc.rgb(${r}, ${g}, ${bl})`, 0];
    } },

  // ============================================================
  // Turtle graphics. Anything from this category emits an
  // "import turtle" header (handled in fullProgram) plus a shared
  // turtle.Turtle() object per variable, injected automatically by
  // generatedCode() right at the top of the program -- the student
  // doesn't need a "neue Turtle"-block any more, and can't ever end
  // up with t.forward(N) running before t is defined.
  // ============================================================
  // Turtle graphics. The "neue Turtle"-block creates the turtle
  // object; every other turtle_* block is a command on an existing
  // turtle. Preflight checks before "Test ▶" make sure a turtle
  // command never runs without a matching "neue Turtle"-block.
  // ============================================================
  { cat: 'turtle',
    def: { type: 'turtle_new',
           message0: 'neue Turtle %1 %2',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   { type: 'field_dropdown', name: 'BGMODE',
                     options: [['Hintergrund behalten', 'KEEP'],
                               ['neuer Hintergrund',    'NEW']] }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    label: 'neue Turtle erstellen',
    // Drag would pop up the name dialog mid-gesture and break the
    // Blockly hand-off; only spawn on plain click.
    dialogSpawn: true,
    // Custom spawn: prompt for the turtle's name, then drop the block
    // with that variable pre-selected. The background-mode dropdown
    // lives on the block itself and defaults to "keep" -- so dropping
    // a fresh turtle never silently clears a hand-painted background.
    customSpawn: async (dropAt) => {
      const base = t('myturtle');
      let candidate = base;
      let i = 2;
      while (nameTakenCategory(candidate)) {
        candidate = base + i++;
      }
      const name = await askString(
        t('Name der Turtle?'), candidate,
        (n) => {
          const cleaned = validateMethodName(n);
          if (!cleaned) return t('Ungültiger Name.');
          const taken = nameTakenCategory(cleaned);
          return taken ? nameInUseMessage(cleaned, taken) : null;
        }
      );
      if (!name) return;
      const cleaned = validateMethodName(name);
      if (!cleaned) return;
      const variable = workspace.getVariableMap().createVariable(cleaned);
      const block = spawnBlock('turtle_new',
                               { VAR: variable.getId(),
                                 BGMODE: 'KEEP' },
                               dropAt);
      if (block) refreshVariablesCategory();
    },
    gen: (b, g) => {
      const v    = g.getVariableName(b.getFieldValue('VAR'));
      const mode = b.getFieldValue('BGMODE') || 'KEEP';
      const cn   = canvasName();
      // NEW ("neuer Hintergrund"): clear the canvas to black just
      // before constructing the turtle, so the student starts on a
      // fresh surface. KEEP ("Hintergrund behalten"): leave whatever
      // is on the canvas (e.g. an image stamped by an earlier block)
      // -- the turtle will snapshot it correctly because construction
      // happens HERE, after those earlier blocks have run.
      let pre = '';
      if (mode === 'NEW') {
        pre = `${cn}.fill(pbc.BLACK)\n`;
      }
      return `${pre}${v} = turtle.Turtle(canvas=${cn})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_forward',
           message0: '%1 vorwärts %2 Pixel',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('DIST', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_forward', dropAt),
    label: 'vorwärts',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.forward(${g.valueToCode(b,'DIST',0)||50})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_back',
           message0: '%1 rückwärts %2 Pixel',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('DIST', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_back', dropAt),
    label: 'rückwärts',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.back(${g.valueToCode(b,'DIST',0)||50})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_left',
           message0: '%1 links drehen um %2 Grad',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('DEG', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_left', dropAt),
    label: 'links drehen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.left(${g.valueToCode(b,'DEG',0)||90})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_right',
           message0: '%1 rechts drehen um %2 Grad',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('DEG', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_right', dropAt),
    label: 'rechts drehen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.right(${g.valueToCode(b,'DEG',0)||90})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_pen_up',
           message0: '%1 Stift heben',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_pen_up', dropAt),
    label: 'Stift heben',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.penUp()\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_pen_down',
           message0: '%1 Stift senken',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_pen_down', dropAt),
    label: 'Stift senken',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.penDown()\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_pen_color',
           message0: '%1 Stiftfarbe auf %2',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_pen_color', dropAt),
    label: 'Stiftfarbe setzen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      const c = g.valueToCode(b,'COLOR',0) || 'pbc.WHITE';
      return `${v}.setPenColor(${c})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_set_pos',
           message0: '%1 Position auf x %2 y %3',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('X', 'Number'), VI('Y', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_set_pos', dropAt),
    label: 'Position setzen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.setPosition(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_set_dir',
           message0: '%1 Richtung auf %2 Grad',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('DEG', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_set_dir', dropAt),
    label: 'Richtung setzen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.setDirection(${g.valueToCode(b,'DEG',0)||0})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_home',
           message0: '%1 zurück zum Ursprung',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_home', dropAt),
    label: 'zum Ursprung',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.home()\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_speed',
           message0: '%1 Geschwindigkeit %2',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('SP', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle, inputsInline: true },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_speed', dropAt),
    label: 'Geschwindigkeit (0=sofort, 1..10+)',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.speed(${g.valueToCode(b,'SP',0)||5})\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_hide',
           message0: '%1 verstecken',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_hide', dropAt),
    label: 'verstecken',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.hide()\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_show',
           message0: '%1 zeigen',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_show', dropAt),
    label: 'zeigen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.show()\n`;
    } },

  { cat: 'turtle',
    def: { type: 'turtle_clear',
           message0: '%1 Leinwand löschen',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_clear', dropAt),
    label: 'Leinwand löschen',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      return `${v}.clear()\n`;
    } },

  // Looks a few pixels ahead of the turtle, so its own trail and
  // marker don't count as a hit.
  { cat: 'turtle',
    def: { type: 'turtle_on_color',
           message0: 'Turtle %1 berührt Farbe %2',
           args0: [{ type: 'field_variable', name: 'VAR', variable: 't' },
                   VI('COLOR', 'Number')],
           inputsInline: true,
           output: 'Boolean', colour: HUE_NUM.turtle },
    customSpawn: (dropAt) => spawnTurtleCommand('turtle_on_color', dropAt),
    label: 'Turtle berührt Farbe',
    gen: (b, g) => {
      const v = g.getVariableName(b.getFieldValue('VAR'));
      const c = g.valueToCode(b, 'COLOR', 0) || 'pbc.WHITE';
      return [`${v}.on_color(${c})`, 0];
    } },

  // ============================================================
  // Canvas blocks. A pbc.Canvas is an off-screen RGB565 pixel
  // buffer the size of the display. The student draws into it
  // exactly like onto the screen, then sends the finished image
  // with "Canvas zeigen". Useful as a stable background that the
  // turtle (or sprites) can then composite on top of.
  //
  // We use field_variable for the canvas selector, same as turtle
  // blocks; the customSpawn helper refuses to drop a command if no
  // canvas variable exists yet, so the field is never dangling.
  // ============================================================
  // canvas_new: a statement block the student drops to (re)set up
  // the canvas. Two modes:
  //   - "Hintergrund anlegen" => fresh black canvas. Generates a
  //     full `hintergrund = pbc.Canvas(...)` assignment plus the
  //     Sprite._background hook so sprites layer over it.
  //   - "Hintergrund leeren"  => fills the existing canvas with
  //     black. Cheaper than allocating a new one; useful for
  //     game-restart logic.
  // The generator also emits an implicit init at the top of the
  // program for safety, so a student who never drags this block
  // still gets a working canvas as soon as they use any other
  // canvas/turtle block.
  { cat: 'canvas',
    def: { type: 'canvas_new',
           message0: 'Canvas %1',
           args0: [{ type: 'field_dropdown', name: 'MODE',
                     options: [['anlegen', 'CREATE'],
                               ['leeren',  'CLEAR']] }],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    label: 'Canvas anlegen / leeren',
    gen: (b) => {
      const mode = b.getFieldValue('MODE') || 'CREATE';
      const cn   = canvasName();
      if (mode === 'CLEAR') {
        return `${cn}.fill(pbc.BLACK)\n`;
      }
      // CREATE: fresh canvas. Also re-bind Sprite._background since
      // the old canvas object is now gone -- otherwise sprites
      // would keep rendering against the previous canvas.
      return `${cn} = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)\n` +
             `pbc.Sprite._background = ${cn}\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_show',
           message0: 'Canvas zeigen',
           args0: [],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_show', dropAt),
    label: 'Canvas zeigen',
    gen: (b, g) => {
      const v = canvasName();
      return `pbc.show(${v})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_fill',
           message0: 'Canvas füllen mit %1',
           args0: [VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_fill', dropAt),
    label: 'Canvas füllen',
    gen: (b, g) => {
      const v = canvasName();
      const c = g.valueToCode(b, 'COLOR', 0) || 'pbc.BLACK';
      return `${v}.fill(${c})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_pixel',
           message0: 'Canvas Pixel x %1 y %2 Farbe %3',
           args0: [VI('X', 'Number'), VI('Y', 'Number'),
                   VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_pixel', dropAt),
    label: 'Pixel auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      return `${v}.pixel(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_line',
           message0: 'Canvas Linie von x %1 y %2 bis x %3 y %4 Farbe %5',
           args0: [VI('X0', 'Number'), VI('Y0', 'Number'),
                   VI('X1', 'Number'), VI('Y1', 'Number'),
                   VI('COLOR', 'Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_line', dropAt),
    label: 'Linie auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      return `${v}.line(${g.valueToCode(b,'X0',0)||0}, ${g.valueToCode(b,'Y0',0)||0}, ${g.valueToCode(b,'X1',0)||0}, ${g.valueToCode(b,'Y1',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_rect',
           message0: 'Canvas Rechteck %1 %2'
                   + 'x %3 y %4 %5'
                   + 'Breite %6 Höhe %7 %8'
                   + 'Farbe %9',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['gefüllt','FILL'],['Umriss','OUTLINE']] },
                   { type: 'input_dummy' },
                   VI('X','Number'), VI('Y','Number'),
                   { type: 'input_dummy' },
                   VI('W','Number'), VI('H','Number'),
                   { type: 'input_dummy' },
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_rect', dropAt),
    label: 'Rechteck auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const fn = b.getFieldValue('STYLE') === 'FILL' ? 'fill_rect' : 'rect';
      return `${v}.${fn}(${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'W',0)||0}, ${g.valueToCode(b,'H',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_ellipse',
           message0: 'Canvas Ellipse %1 %2'
                   + 'Mitte x %3 y %4 %5'
                   + 'Breite %6 Höhe %7 %8'
                   + 'Farbe %9',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['gefüllt','FILL'],['Umriss','OUTLINE']] },
                   { type: 'input_dummy' },
                   VI('CX','Number'), VI('CY','Number'),
                   { type: 'input_dummy' },
                   VI('RX','Number'), VI('RY','Number'),
                   { type: 'input_dummy' },
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_ellipse', dropAt),
    label: 'Ellipse auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const tail = b.getFieldValue('STYLE') === 'FILL' ? ', True' : '';
      return `${v}.ellipse(${g.valueToCode(b,'CX',0)||0}, ${g.valueToCode(b,'CY',0)||0}, (${g.valueToCode(b,'RX',0)||0})//2, (${g.valueToCode(b,'RY',0)||0})//2, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'}${tail})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_circle',
           message0: 'Canvas Kreis %1 %2'
                   + 'Mitte x %3 y %4 %5'
                   + 'Radius %6 %7'
                   + 'Farbe %8',
           args0: [{ type: 'field_dropdown', name: 'STYLE',
                     options: [['gefüllt','FILL'],['Umriss','OUTLINE']] },
                   { type: 'input_dummy' },
                   VI('CX','Number'), VI('CY','Number'),
                   { type: 'input_dummy' },
                   VI('R','Number'),
                   { type: 'input_dummy' },
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_circle', dropAt),
    label: 'Kreis auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const tail = b.getFieldValue('STYLE') === 'FILL' ? ', True' : '';
      const [pre, r] = circleRadius(g.valueToCode(b,'R',0) || 0);
      return `${pre}${v}.ellipse(${g.valueToCode(b,'CX',0)||0}, ${g.valueToCode(b,'CY',0)||0}, ${r}, ${r}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'}${tail})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_text',
           message0: 'kleiner Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'),
                   VI('X','Number'), VI('Y','Number'),
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_text', dropAt),
    label: 'kleiner Text auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `${v}.text12(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_text18',
           message0: 'Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'),
                   VI('X','Number'), VI('Y','Number'),
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_text18', dropAt),
    label: 'Text auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `${v}.text18(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  { cat: 'canvas',
    def: { type: 'canvas_text24',
           message0: 'großer Text %1 an x %2 y %3 Farbe %4',
           args0: [VI('TEXT'),
                   VI('X','Number'), VI('Y','Number'),
                   VI('COLOR','Number')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas, inputsInline: true },
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_text24', dropAt),
    label: 'großer Text auf Canvas',
    gen: (b, g) => {
      const v = canvasName();
      const txt = g.valueToCode(b,'TEXT',0) || "''";
      return `${v}.text24(${asStringExpr(txt)}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0}, ${g.valueToCode(b,'COLOR',0)||'pbc.WHITE'})\n`;
    } },

  // Paint an uploaded PNG into the canvas backbuffer. JS-defined
  // block (skipJson) so the file dropdown can refresh from the
  // current PNG list. Generator uses stamp_on which respects the
  // image's transparency colour-key.
  { cat: 'canvas',
    def: { type: 'canvas_load_image' },
    skipJson: true,
    customSpawn: (dropAt) => spawnCanvasCommand('canvas_load_image', dropAt),
    label: 'Bild auf Canvas',
    gen: (b, g) => {
      const name = (b.getFieldValue('NAME') || '')
        .replace(/[\r\n\\']/g, '');
      const v = canvasName();
      return `pbc.load_image('${name}').stamp_on(${v}, ${g.valueToCode(b,'X',0)||0}, ${g.valueToCode(b,'Y',0)||0})\n`;
    } },

  // Set the user's canvas as the backdrop drawn under sprites every
  // time a sprite is updated. Without this, sprites composite over a
  // black backbuffer -- with this, they composite over the student's
  // own scene. Pure Python, just sets the class attribute.
  // canvas_as_sprite_bg is now implicit -- the generator sets
  // Sprite._background automatically whenever the program has both
  // a canvas and a sprite. Kept as a hidden block so older .pbcp
  // files that still contain one continue to load and generate
  // valid code; new programs don't see it in the sidebar.
  { cat: 'canvas',
    def: { type: 'canvas_as_sprite_bg',
           message0: 'Canvas als Sprite-Hintergrund setzen',
           args0: [],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.canvas },
    label: 'als Sprite-Hintergrund',
    hidden: true,
    gen: (b, g) => {
      const v = canvasName();
      return `pbc.Sprite._background = ${v}\n`;
    } },

  // ============================================================
  // Console blocks. print() and input() over the USB-serial REPL.
  // ============================================================
  { cat: 'console',
    def: { type: 'console_print',
           message0: 'ausgeben %1',
           args0: [VI('TEXT')],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.console },
    label: 'ausgeben',
    gen: (b, g) =>
      `print(${g.valueToCode(b,'TEXT',0) || "''"})\n` },

  { cat: 'console',
    def: { type: 'console_print_nl',
           message0: 'leere Zeile ausgeben',
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.console },
    label: 'leere Zeile ausgeben',
    gen: () => 'print()\n' },

  { cat: 'console',
    def: { type: 'console_input',
           message0: 'einlesen mit Aufforderung %1',
           args0: [VI('PROMPT', 'String')],
           output: 'String',
           colour: HUE_NUM.console },
    label: 'einlesen (Text)',
    gen: (b, g) =>
      [`input(${g.valueToCode(b,'PROMPT',0) || "''"})`, 0] },

  { cat: 'console',
    def: { type: 'console_input_int',
           message0: 'einlesen als Zahl mit Aufforderung %1',
           args0: [VI('PROMPT', 'String')],
           output: 'Number',
           colour: HUE_NUM.console },
    label: 'einlesen (Zahl)',
    gen: (b, g) =>
      [`int(input(${g.valueToCode(b,'PROMPT',0) || "''"}))`, 0] },

  // =====================================================================
  // External sensors (cat: 'ext').
  //
  // Each block is conditionally available: it only appears in the
  // sidebar when its `requires` sensor is enabled in Einstellungen.
  // The list of currently-enabled sensors lives in EXT_SETTINGS and
  // is persisted in localStorage so the next session remembers.
  //
  // Sensor "setup" Python is prepended to the user's program by the
  // code generator, so the user doesn't have to upload any drivers.
  // All sensors here are STEMMA QT (I2C) modules and share one bus,
  // so the SDA/SCL pins are configured once via the special pseudo-
  // sensor entry 'i2c' (see EXT_SENSORS_CATALOG).
  // =====================================================================

  // ---- PCF8523 RTC (real-time clock) ----
  // Read/write the time registers (0x03..0x09) directly. We keep the
  // driver tiny: BCD-encoded second/minute/hour/weekday/day/month/year.
  // Setting the time also clears the STOP bit (Control_1 bit 5).
  //
  // The "set" block carries field labels for each number so it reads
  // top-to-bottom like a sentence ("Uhr stellen: Jahr 2026 Monat 5
  // Tag 13 ..."). Six values is a lot -- without labels the user has
  // no chance to remember which slot is which.
  { cat: 'ext', requires: 'pcf8523',
    def: { type: 'ext_rtc_set',
           message0: 'RTC: Uhr stellen %1' +
                     'Jahr %2 Monat %3 Tag %4 %5' +
                     'Stunde %6 Minute %7 Sekunde %8',
           args0: [
             { type: 'input_dummy' },
             { type: 'field_number', name: 'Y',  value: 2026, min: 2000, max: 2099, precision: 1 },
             { type: 'field_number', name: 'MO', value: 1,    min: 1,    max: 12,   precision: 1 },
             { type: 'field_number', name: 'D',  value: 1,    min: 1,    max: 31,   precision: 1 },
             { type: 'input_dummy' },
             { type: 'field_number', name: 'H',  value: 12,   min: 0,    max: 23,   precision: 1 },
             { type: 'field_number', name: 'MI', value: 0,    min: 0,    max: 59,   precision: 1 },
             { type: 'field_number', name: 'S',  value: 0,    min: 0,    max: 59,   precision: 1 },
           ],
           previousStatement: null, nextStatement: null,
           colour: HUE_NUM.sensor },
    label: 'RTC: Uhr stellen',
    gen: (b) => {
      const y = b.getFieldValue('Y'), mo = b.getFieldValue('MO');
      const d = b.getFieldValue('D'), h = b.getFieldValue('H');
      const mi = b.getFieldValue('MI'), s = b.getFieldValue('S');
      return `_rtc_set(${y}, ${mo}, ${d}, ${h}, ${mi}, ${s})\n`;
    } },

  { cat: 'ext', requires: 'pcf8523',
    def: { type: 'ext_rtc_get',
           message0: 'RTC: %1',
           args0: [{ type: 'field_dropdown', name: 'FIELD', options: [
             ['Jahr',    '0'],
             ['Monat',   '1'],
             ['Tag',     '2'],
             ['Stunde',  '3'],
             ['Minute',  '4'],
             ['Sekunde', '5'],
           ] }],
           output: 'Number', colour: HUE_NUM.sensor },
    label: 'RTC: Zeit',
    gen: (b) => [`_rtc_read()[${b.getFieldValue('FIELD')}]`, 0] },

  // ---- SHT40 Temperature + Humidity ----
  // High-precision read (0xFD): wait ~10 ms, read 6 bytes
  // (T_msb T_lsb T_crc H_msb H_lsb H_crc). Convert with the
  // formulas from the SHT4x datasheet section 4.5.
  //
  // No separate "measure" block: each value getter runs
  // _sht40_get() which kicks off a fresh I2C read. The driver
  // throttles back-to-back calls so reading temp + humidity in the
  // same statement doesn't pay the 10 ms measurement cost twice.
  { cat: 'ext', requires: 'sht40',
    def: { type: 'ext_sht40_temp',
           message0: 'SHT40: Temperatur (°C)', output: 'Number',
           colour: HUE_NUM.sensor },
    label: 'SHT40: Temperatur (°C)',
    gen: () => [`_sht40_get()[0]`, 0] },
  { cat: 'ext', requires: 'sht40',
    def: { type: 'ext_sht40_humid',
           message0: 'SHT40: Feuchte (%)', output: 'Number',
           colour: HUE_NUM.sensor },
    label: 'SHT40: Feuchte (%)',
    gen: () => [`_sht40_get()[1]`, 0] },
];

// External-sensor catalogue. Each entry is a sensor module that the
// user can toggle in Einstellungen.
//
// All currently supported sensors are I2C / STEMMA QT and share one
// bus. The SDA/SCL pins are configured per sensor for flexibility but
// in practice all entries should carry the same pair (the user only
// has one STEMMA QT chain). extSensorsSetup() de-duplicates the
// machine.I2C() construction, so even if multiple sensors are on, we
// only emit one bus init.
// All external sensors hang off the PBC+'s STEMMA QT connector,
// which routes to fixed pins. Users can't reconfigure these.
const EXT_I2C_SDA = 20;
const EXT_I2C_SCL = 21;

const EXT_SENSORS_CATALOG = {
  pcf8523: {
    label: 'PCF8523 (RTC, Echtzeituhr)',
    description: 'Adafruit STEMMA QT Echtzeituhr-Breakout, I2C 0x68.',
    // Driver. _rtc_read() returns (year, month, day, hour, minute,
    // second). _rtc_set(...) writes those back. We talk to the chip
    // directly via I2C readfrom_mem / writeto_mem so no extra library
    // is needed. Reads are cached for 100 ms so back-to-back accesses
    // (e.g. fetching Hour + Minute on the same line) hit the same
    // sample and don't slip across a second boundary.
    setup: () =>
      `# PCF8523 RTC -- direkt am I2C-Bus.\n` +
      `import time as _t_rtc\n` +
      `_rtc_cache = (None, -1000)\n` +
      `def _bcd2dec(b): return (b >> 4) * 10 + (b & 0x0F)\n` +
      `def _dec2bcd(d): return ((d // 10) << 4) | (d % 10)\n` +
      `def _rtc_read():\n` +
      `    global _rtc_cache\n` +
      `    now = _t_rtc.ticks_ms()\n` +
      `    if _rtc_cache[0] is not None and \\\n` +
      `       _t_rtc.ticks_diff(now, _rtc_cache[1]) < 100:\n` +
      `        return _rtc_cache[0]\n` +
      `    d = _i2c.readfrom_mem(0x68, 0x03, 7)\n` +
      `    sec  = _bcd2dec(d[0] & 0x7F)\n` +
      `    mn   = _bcd2dec(d[1] & 0x7F)\n` +
      `    hr   = _bcd2dec(d[2] & 0x3F)\n` +
      `    day  = _bcd2dec(d[3] & 0x3F)\n` +
      `    mon  = _bcd2dec(d[5] & 0x1F)\n` +
      `    yr   = 2000 + _bcd2dec(d[6])\n` +
      `    tup = (yr, mon, day, hr, mn, sec)\n` +
      `    _rtc_cache = (tup, now)\n` +
      `    return tup\n` +
      `def _rtc_set(y, mo, d, h, mi, s):\n` +
      `    global _rtc_cache\n` +
      `    _rtc_cache = (None, -1000)  # invalidate cache\n` +
      `    # Clear STOP bit in Control_1, then write all time regs.\n` +
      `    _i2c.writeto_mem(0x68, 0x00, b'\\x00')\n` +
      `    buf = bytes([_dec2bcd(s), _dec2bcd(mi), _dec2bcd(h),\n` +
      `                 _dec2bcd(d), 0, _dec2bcd(mo),\n` +
      `                 _dec2bcd(y - 2000)])\n` +
      `    _i2c.writeto_mem(0x68, 0x03, buf)\n`,
  },
  sht40: {
    label: 'SHT40 (Temperatur & Feuchte)',
    description: 'Adafruit STEMMA QT Sensirion Sensor, I2C 0x44.',
    // _sht40_get() returns (temp_C, humid_pct). It does a fresh
    // high-precision read (cmd 0xFD), waits the required ~10 ms, then
    // parses the 6-byte response. The result is cached for 100 ms so
    // back-to-back reads (e.g. temp AND humidity in the same line)
    // only pay the measurement cost once.
    setup: () =>
      `# SHT40 Temperatur/Feuchte -- direkt am I2C-Bus.\n` +
      `import time as _t_sht\n` +
      `_sht40_last = (0.0, 0.0, -1000)\n` +
      `def _sht40_get():\n` +
      `    global _sht40_last\n` +
      `    now = _t_sht.ticks_ms()\n` +
      `    if _t_sht.ticks_diff(now, _sht40_last[2]) < 100:\n` +
      `        return _sht40_last[0], _sht40_last[1]\n` +
      `    _i2c.writeto(0x44, b'\\xfd')\n` +
      `    _t_sht.sleep_ms(10)\n` +
      `    d = _i2c.readfrom(0x44, 6)\n` +
      `    raw_t = (d[0] << 8) | d[1]\n` +
      `    raw_h = (d[3] << 8) | d[4]\n` +
      `    t = round(-45 + 175 * raw_t / 65535, 1)\n` +
      `    h = round(max(0, min(100, -6 + 125 * raw_h / 65535)), 1)\n` +
      `    _sht40_last = (t, h, now)\n` +
      `    return (t, h)\n`,
  },
};

const CATEGORIES = [
  // --- Auf dem Bildschirm (alles, was zeichnet) ---
  { key: 'display', label: t('Display') },
  { key: 'canvas',  label: t('Canvas') },
  { key: 'sprite',  label: t('Sprites') },
  { key: 'turtle',  label: t('Turtle') },
  // --- Hardware-Ausgabe ---
  { key: 'led',     label: t('LEDs') },
  { key: 'sound',   label: t('Sound') },
  // --- Eingabe & Sensorik ---
  { key: 'input',   label: t('Eingabe') },
  { key: 'sensor',  label: t('Sensor') },
  { key: 'ext',     label: t('Externe Sensoren') },
  // --- Logik & Daten (Programmier-Grundbausteine) ---
  { key: 'control', label: t('Kontrollstrukturen') },
  { key: 'vars',    label: t('Variablen') },
  { key: 'lists',   label: t('Listen') },
  { key: 'methods', label: t('Funktionen') },
  { key: 'math',    label: t('Mathe') },
  { key: 'text',    label: t('Text') },
  { key: 'time',    label: t('Zeit') },
  { key: 'console', label: t('Konsole') },
];

