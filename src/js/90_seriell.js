/* =====================================================================
 * Web Serial + terminal
 * ===================================================================== */

let serialPort = null, serialReader = null, serialWriter = null;
// 'serial' when a USB device is connected, 'emulator' when the
// in-browser virtual PBC+ is running, null when nothing is connected.
// runOnDevice, sendRaw and a few other low-level functions branch on
// this -- everything else (uploadBlob, image management, the paint
// editor save flow, etc.) can keep checking serialPort/deviceMode as
// a generic "is anything connected?" flag.
let deviceMode = null;
let interactive = true;
let protoBuffer = new Uint8Array(0);
let term;

// Border between workspace and terminal: drag it to resize the terminal.
// The height lives in --terminal-h and is remembered per browser.
const TERMINAL_H_KEY = 'pbc.terminalHoehe';
function terminalHoeheSetzen(h) {
  const app = document.querySelector('.app');
  const titel = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--titlebar-h')) || 52;
  const max = (app ? app.clientHeight : window.innerHeight) - titel - 120;   // workspace keeps 120px
  h = Math.round(Math.max(80, Math.min(max, h)));
  document.documentElement.style.setProperty('--terminal-h', h + 'px');
  return h;
}
function terminalTrennerAnbinden() {
  const trenner = document.getElementById('terminal-trenner');
  if (!trenner) return;
  let gespeichert = null;
  try { gespeichert = Number(localStorage.getItem(TERMINAL_H_KEY)) || null; } catch (_) {}
  if (gespeichert) terminalHoeheSetzen(gespeichert);
  // xterm, Blockly and the code editor all re-measure on 'resize'
  const neuMessen = () => window.dispatchEvent(new Event('resize'));
  // while dragging only the workspace follows: re-fitting the terminal on
  // every step redraws all its text and makes it flicker; it is fitted
  // once on release (the black area just clips or extends meanwhile)
  const flaecheMessen = () => {
    if (typeof workspace !== 'undefined' && workspace) Blockly.svgResize(workspace);
    if (typeof codeEditor !== 'undefined' && codeEditor) codeEditor.refresh();
  };
  let startY = 0, startH = 0, zieht = false, wartet = false;
  trenner.addEventListener('pointerdown', (e) => {
    zieht = true;
    startY = e.clientY;
    startH = document.querySelector('.terminal-area').getBoundingClientRect().height;
    trenner.setPointerCapture(e.pointerId);
    trenner.classList.add('zieht');
    document.body.classList.add('trenner-zieht');
    e.preventDefault();
  });
  trenner.addEventListener('pointermove', (e) => {
    if (!zieht) return;
    terminalHoeheSetzen(startH - (e.clientY - startY));
    if (!wartet) { wartet = true; requestAnimationFrame(() => { wartet = false; flaecheMessen(); }); }
  });
  const ende = () => {
    if (!zieht) return;
    zieht = false;
    trenner.classList.remove('zieht');
    document.body.classList.remove('trenner-zieht');
    const h = terminalHoeheSetzen(document.querySelector('.terminal-area').getBoundingClientRect().height);
    try { localStorage.setItem(TERMINAL_H_KEY, String(h)); } catch (_) {}
    neuMessen();
  };
  trenner.addEventListener('pointerup', ende);
  trenner.addEventListener('pointercancel', ende);
  // double click: back to the default height
  trenner.addEventListener('dblclick', () => {
    document.documentElement.style.removeProperty('--terminal-h');
    try { localStorage.removeItem(TERMINAL_H_KEY); } catch (_) {}
    neuMessen();
  });
}

function setupTerminal() {
  term = new Terminal({
    fontFamily: 'ui-monospace, SF Mono, Consolas, monospace',
    fontSize: 13,
    theme: { background: '#000', foreground: '#e6edf3', cursor: '#4f9eff' },
    cursorBlink: true, convertEol: true,
  });
  const fit = new FitAddon.FitAddon();
  term.loadAddon(fit);
  term.open(document.getElementById('terminal'));
  fit.fit();
  window.addEventListener('resize', () => fit.fit());
  terminalTrennerAnbinden();

  term.onData((data) => {
    // When the emulator is waiting on input(), capture keystrokes here
    // (with echo + basic line editing) instead of sending them to a
    // serial device. This makes console input() work in the emulator.
    // (`emu` is declared in another scope; use its global handle.)
    const emu = globalThis.__emu || {};
    if (emu.inputActive) {
      for (const ch of data) {
        const code = ch.charCodeAt(0);
        if (ch === '\r' || ch === '\n') {
          term.write('\r\n');
          const line = emu.inputLine;
          emu.inputLine = '';
          emu.inputActive = false;
          const resolve = emu.inputResolve;
          emu.inputResolve = null;
          if (resolve) resolve(line);
        } else if (code === 127 || code === 8) {   // backspace / DEL
          if (emu.inputLine.length > 0) {
            emu.inputLine = emu.inputLine.slice(0, -1);
            term.write('\b \b');                     // erase last char
          }
        } else if (code === 3) {                     // Ctrl-C cancels
          term.write('^C\r\n');
          emu.inputLine = '';
          emu.inputActive = false;
          const resolve = emu.inputResolve;
          emu.inputResolve = null;
          if (resolve) resolve('');
        } else if (code >= 32) {                      // printable
          emu.inputLine += ch;
          term.write(ch);                             // echo
        }
      }
      return;
    }
    if (serialWriter)
      serialWriter.write(new TextEncoder().encode(data));
  });

  term.write('\x1b[36m' + t('PBC+ Studio Terminal') + '\x1b[0m');
  term.write('\x1b[90m  Build ' + APP_BUILD + ' · ' + APP_DATE + '\x1b[0m\r\n');
  // Split a translatable sentence around a bold-styled placeholder so
  // word order can change between languages.
  const greet = t('Klicke %1, um einen PBC+ per USB anzuschließen.');
  const [pre, post] = greet.split('%1');
  term.write(pre + '\x1b[1m' + t('Verbinden') + '\x1b[0m' + post + '\r\n');
}

// Connect to the device. With no argument we ask the browser to show
// the port picker (first-time connection or a different device).
// With a port object we re-use one we already got permission for --
// used by tryReconnect() after the user pressed reset on the device.
async function connect(presetPort) {
  if (!('serial' in navigator)) {
    toast(t('Web Serial nicht unterstützt. Bitte Chrome oder Edge nutzen.'), 'bad');
    return;
  }
  try {
    serialPort = presetPort || await navigator.serial.requestPort();
    try {
      await serialPort.open({ baudRate: 115200 });
    } catch (openErr) {
      // "The port is already open" (InvalidStateError) happens when a
      // previous session didn't fully release the handle. Try to close
      // it and reopen once before giving up.
      if (openErr && (openErr.name === 'InvalidStateError' ||
                      /already open/i.test(openErr.message || ''))) {
        try { await serialPort.close(); } catch (_) {}
        await new Promise(r => setTimeout(r, 150));
        await serialPort.open({ baudRate: 115200 });
      } else {
        throw openErr;
      }
    }
    serialWriter = serialPort.writable.getWriter();
    serialReader = serialPort.readable.getReader();
    deviceMode = 'serial';

    document.getElementById('btn-connect').classList.add('connected');
    document.getElementById('btn-connect').textContent = t('Trennen');
    const info = serialPort.getInfo();
    document.getElementById('conn-info').textContent =
      t('verbunden') +
      ` (USB ${info.usbVendorId?.toString(16)||'?'}:${info.usbProductId?.toString(16)||'?'})`;
    term.write('\r\n\x1b[32m' + t('-- verbunden --') + '\x1b[0m\r\n');
    if (typeof updateConnectButton === 'function') updateConnectButton();

    pumpSerial();
    toast(t('Verbunden'), 'good');

    // Pre-handshake: nudge the device into a clean REPL state before
    // any background task tries to talk to it. The device might be
    // mid-program (main.py running, REPL idle in pbc.menu, etc.); in
    // that case the first runOnDevice would just see "Raw-REPL-Prompt
    // nicht gesehen". We send a more patient burst of Ctrl-C than the
    // regular runOnDevice burst, with longer waits, plus a soft-reset
    // fallback if Ctrl-C alone doesn't pry it loose.
    await primeReplOnConnect();

    // IMPORTANT: these talk to the device over the same serial port and
    // MUST run one after another -- never concurrently, or their
    // raw-REPL handshakes collide (you get "[Raw-REPL-Prompt nicht
    // gesehen]" and the menu restarts mid-handshake). So: await each.
    //
    // Sync the list of existing PNGs first (so the "Bild anzeigen" /
    // "Bild laden" dropdowns find files from previous sessions)...
    await syncImagesQuietly();
    // ...then draw the "REPL connected" splash LAST, so it's the final
    // thing on screen and nothing redraws over it.
    await showReplSplash();
  } catch (err) {
    if (err.name !== 'NotFoundError')
      toast(t('Verbindung fehlgeschlagen:') + ' ' + err.message, 'bad');
    serialPort = null;
  }
}

// Single-click reconnect after the student pressed reset on the
// device. The browser remembers which ports the user has previously
// authorised via navigator.serial.getPorts(); we just reopen the
// most-recently-used one. If no remembered port exists, fall back
// to the normal picker -- one click takes them through that too.
async function tryReconnect() {
  if (!('serial' in navigator)) {
    toast(t('Web Serial nicht unterstützt. Bitte Chrome oder Edge nutzen.'), 'bad');
    return;
  }
  // Already connected -- gracefully disconnect first so we don't end
  // up with two open ports if the user spams reconnect.
  if (serialPort) {
    await disconnect();
  }
  let port = null;
  try {
    const ports = await navigator.serial.getPorts();
    // Pick the last (= most recently granted) port that's not
    // already opened by another tab. Reset/replug typically keeps
    // the same vendor/product pair, so this hits the same device.
    for (let i = ports.length - 1; i >= 0; i--) {
      try {
        // Probe by attempting to read state; if open() would fail
        // we'd discover that anyway in connect(), so just pick the
        // first one and try.
        port = ports[i];
        break;
      } catch (_) {}
    }
  } catch (e) {
    console.warn('getPorts failed:', e);
  }
  if (port) {
    await connect(port);
  } else {
    // No remembered port; fall through to the normal picker so the
    // student isn't left wondering why nothing happened.
    toast(t('Kein gespeicherter Port – bitte auswählen.'), 'warn');
    await connect();
  }
}

async function disconnect() {
  // Order matters for releasing the OS-level serial handle cleanly,
  // otherwise a reconnect hits "the port is already open".
  //
  // 1. Signal pumpSerial to stop and cancel the in-flight read so its
  //    await returns. We grab local handles first and null the globals
  //    so the pump loop's `while (serialReader)` condition flips.
  const reader = serialReader;
  const writer = serialWriter;
  const port   = serialPort;
  serialReader = null;     // stops pumpSerial's loop on its next turn
  serialWriter = null;
  // 2. Cancel + release the reader. cancel() unblocks a pending
  //    read(); releaseLock() detaches it from the readable stream so
  //    port.close() won't throw "ReadableStream is locked".
  try { if (reader) await reader.cancel(); } catch (_) {}
  try { if (reader) reader.releaseLock(); } catch (_) {}
  // 3. Release the writer the same way.
  try { if (writer) { try { await writer.close(); } catch (_) {} writer.releaseLock(); } } catch (_) {}
  // 4. Give the pump loop a tick to notice serialReader === null and
  //    fall out of its while-loop before we close the port underneath
  //    it (avoids a close()-vs-read() race that can wedge the handle).
  await new Promise(r => setTimeout(r, 30));
  // 5. Now the streams are unlocked -- close the port.
  try { if (port) await port.close(); } catch (_) {}
  serialPort = null;
  deviceMode = null;
  document.getElementById('btn-connect').classList.remove('connected');
  document.getElementById('btn-connect').textContent = t('Verbinden');
  document.getElementById('conn-info').textContent = t('nicht verbunden');
  term.write('\r\n\x1b[31m' + t('-- getrennt --') + '\x1b[0m\r\n');
  toast(t('Getrennt'));
  if (typeof updateConnectButton === 'function') updateConnectButton();
}

// Connect button: ask USB vs Emulator first. If we already have a
// connection (real or emulated), this disconnects instead. The
// `deviceMode` global tracks which adapter is active -- 'serial' for
// real hardware, 'emulator' for the in-browser PBC+, null for
// disconnected. runOnDevice, sendRaw, etc. branch on deviceMode so
// the rest of the IDE doesn't have to know which is which.
function openConnectChooser() {
  // Re-enable the buttons; they might have been blanked from a
  // previous open with no Serial API support.
  document.getElementById('connect-real').disabled =
    !('serial' in navigator);
  document.getElementById('connect-real').title =
    ('serial' in navigator) ? '' :
    'Browser ohne WebSerial - Chrome / Edge erforderlich';
  document.getElementById('connect-chooser-modal').classList.add('show');
}
function closeConnectChooser() {
  document.getElementById('connect-chooser-modal').classList.remove('show');
}
// Which target the toolbar buttons act on: 'device' (USB) or
// 'emulator' (in-browser). The switch only changes intent; actually
// connecting happens when the user presses Verbinden. Restored from
// the last session so the switch stays where the student left it.
let runTarget = 'device';
try {
  const __savedTarget = localStorage.getItem(TARGET_KEY);
  if (__savedTarget === 'emulator' || __savedTarget === 'device') {
    runTarget = __savedTarget;
  }
} catch (e) {}

// Make sure the selected target is usable for a file/image operation.
// For the emulator we DON'T require an explicit "connect" -- having it
// selected is enough; we bring it up automatically (its files live in
// the in-browser MicroPython FS, which only exists once it's loaded).
// For the real device a USB connection is genuinely required, so we
// keep the "Erst verbinden" gate. Returns true if ready to proceed.
async function ensureTargetReady() {
  if (runTarget === 'emulator') {
    if (deviceMode !== 'emulator') {
      if (window.__connectEmulator) await window.__connectEmulator();
    }
    return deviceMode === 'emulator';
  }
  if (!serialPort || deviceMode !== 'serial') {
    toast(t('Erst verbinden.'), 'warn');
    return false;
  }
  return true;
}

// Human-readable name of the active target, for dialog titles etc.
function targetLabel() {
  return runTarget === 'emulator' ? 'Emulator' : 'PBC+';
}

function updateConnectButton() {
  const btn = document.getElementById('btn-connect');
  const recon = document.getElementById('btn-reconnect');
  if (!btn) return;
  const connected =
    (runTarget === 'emulator' && deviceMode === 'emulator') ||
    (runTarget === 'device'  && deviceMode === 'serial' && serialPort);
  if (connected) {
    btn.classList.add('connected');
    btn.textContent = t('Trennen');
  } else {
    btn.classList.remove('connected');
    btn.textContent = t('Verbinden');
  }
  // The USB reconnect (↻) button only does anything for the real
  // device, so we disable it in emulator mode -- but keep it VISIBLE
  // so the layout (and the target switch to its right) doesn't shift.
  if (recon) {
    recon.style.display = '';
    const emuMode = (runTarget === 'emulator');
    recon.disabled = emuMode;
    recon.style.opacity = emuMode ? '0.4' : '';
    recon.style.pointerEvents = emuMode ? 'none' : '';
  }
}

function setRunTarget(target) {
  if (target === runTarget) return;
  // Don't let the student switch targets while one is actively
  // connected -- that would leave a dangling connection behind. Ask
  // them to disconnect first.
  if (deviceMode) {
    toast(t('Erst trennen, dann das Ziel wechseln.'), 'warn');
    // Re-sync the visual state of the switch to the actual target.
    syncTargetSwitch();
    return;
  }
  runTarget = target;
  try { localStorage.setItem(TARGET_KEY, target); } catch (e) {}
  syncTargetSwitch();
  updateConnectButton();
}

function syncTargetSwitch() {
  const d = document.getElementById('target-device');
  const e = document.getElementById('target-emulator');
  if (!d || !e) return;
  d.classList.toggle('active', runTarget === 'device');
  e.classList.toggle('active', runTarget === 'emulator');
}

document.getElementById('target-device').addEventListener('click',
  () => setRunTarget('device'));
document.getElementById('target-emulator').addEventListener('click',
  () => setRunTarget('emulator'));
// Reflect the restored target (from a previous session) on the switch
// right away -- the HTML defaults to 'device' being active, so if the
// student last used the emulator we need to move the highlight.
syncTargetSwitch();

document.getElementById('btn-connect').addEventListener('click', () => {
  // The Verbinden/Trennen button acts on whichever target the switch
  // selects. For the emulator, "connect" shows the panel and "Trennen"
  // hides it; for the device it opens/closes the USB serial port.
  if (runTarget === 'emulator') {
    if (deviceMode === 'emulator') {
      if (window.__disconnectEmulator) window.__disconnectEmulator();
    } else {
      if (window.__connectEmulator) window.__connectEmulator();
    }
    return;
  }
  // Device target.
  if (serialPort && deviceMode === 'serial') return disconnect();
  connect();
});
document.getElementById('btn-reconnect').addEventListener('click',
  () => tryReconnect());

async function pumpSerial() {
  let disconnected = false;
  // Capture the reader locally. disconnect() nulls the global
  // serialReader to signal "stop", and also cancels this reader so
  // the pending read() returns -- but we must keep our own handle to
  // finish the in-flight read cleanly instead of dereferencing a
  // global that may already be null.
  const reader = serialReader;
  while (serialReader && reader) {
    try {
      const { value, done } = await reader.read();
      if (done) { disconnected = true; break; }
      if (!value) continue;
      if (interactive) {
        term.write(value);
      } else {
        const merged = new Uint8Array(protoBuffer.length + value.length);
        merged.set(protoBuffer);
        merged.set(value, protoBuffer.length);
        protoBuffer = merged;
      }
    } catch (err) {
      // Read errors typically mean the USB serial endpoint is gone --
      // e.g. the cable was unplugged or the device was reset. We
      // can't recover; flag the loss and break out so the cleanup
      // path runs below.
      disconnected = true;
      break;
    }
  }
  // If we exited because the device vanished mid-stream (rather than
  // because the user clicked "Trennen"), inform them and reset the
  // UI. Otherwise downstream actions like Test would fail mysteriously
  // with stale serialPort/serialWriter references.
  if (disconnected && serialPort) {
    await handleUnexpectedDisconnect();
  }
}

// Called when the read loop exits unexpectedly (USB unplug, device
// reset that drops CDC, etc.). Tear down the connection state so
// the next test/upload doesn't hold dead handles, and tell the
// student plainly. Keeps the terminal output visible so they can
// see any traceback that came in just before the disconnect.
async function handleUnexpectedDisconnect() {
  // Snapshot then null out so re-entry is safe.
  const port = serialPort;
  serialPort = null;
  serialReader = null;
  serialWriter = null;
  deviceMode = null;
  try {
    document.getElementById('btn-connect').classList.remove('connected');
    document.getElementById('btn-connect').textContent = t('Verbinden');
    const info = document.getElementById('conn-info');
    if (info) info.textContent = '';
    if (typeof updateConnectButton === 'function') updateConnectButton();
  } catch (_) {}
  term.write('\r\n\x1b[31m-- ' + t('Verbindung verloren') + ' --\x1b[0m\r\n');
  toast(t('Verbindung zum PBC+ verloren. ↻ klicken oder neu verbinden.'), 'bad');
  // Best-effort close of the OS-level port. Won't throw fatally if
  // it's already gone.
  try { if (port && port.close) await port.close(); } catch (_) {}
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/* ----- Raw REPL helpers ----- */

async function sendRaw(b) {
  await serialWriter.write(typeof b === 'string'
    ? new TextEncoder().encode(b) : b);
}

async function waitFor(marker, timeoutMs = 3000) {
  // Look for the marker ANYWHERE in protoBuffer (not just at the end)
  // -- otherwise a fast device that crams "OK" plus its first byte of
  // stdout into the same USB packet would make this return false, even
  // though the marker is right there in the buffer. On success, we
  // chop everything up to and including the marker out of the buffer
  // so the next call to waitFor / the indexOf(0x04) probe starts from
  // the bytes that actually come AFTER the marker.
  const target = new TextEncoder().encode(marker);
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const idx = indexOfSub(protoBuffer, target);
    if (idx >= 0) {
      protoBuffer = protoBuffer.slice(idx + target.length);
      return true;
    }
    await sleep(10);
  }
  return false;
}

function indexOfSub(buf, sub) {
  if (sub.length === 0) return 0;
  if (buf.length < sub.length) return -1;
  outer:
  for (let i = 0; i <= buf.length - sub.length; i++) {
    for (let j = 0; j < sub.length; j++) {
      if (buf[i + j] !== sub[j]) continue outer;
    }
    return i;
  }
  return -1;
}

// Like indexOfSub but returns the LAST occurrence. Used for raw-REPL
// detection, where the device may echo the prompt more than once and
// we want to sync on the most recent one.
function lastIndexOfSub(buf, sub) {
  if (sub.length === 0) return buf.length;
  if (buf.length < sub.length) return -1;
  outer:
  for (let i = buf.length - sub.length; i >= 0; i--) {
    for (let j = 0; j < sub.length; j++) {
      if (buf[i + j] !== sub[j]) continue outer;
    }
    return i;
  }
  return -1;
}

function endsWith(buf, suffix) {
  if (buf.length < suffix.length) return false;
  for (let i = 0; i < suffix.length; i++)
    if (buf[buf.length - suffix.length + i] !== suffix[i]) return false;
  return true;
}

const bufToString = (b) => new TextDecoder().decode(b);

// One-shot REPL primer used right after connect(). The device might
// be in any of several states when we connect:
//   - sitting idle at the >>> prompt              (normal)
//   - running a user main.py in a tight loop      (very common)
//   - blocked inside pbc.menu() / wait_for_button (common)
//   - mid-Test-run from a previous IDE session    (rare)
// We send a generous Ctrl-C burst (more patient than runOnDevice's
// per-call burst), and if nothing shows up, fall back to Ctrl-D
// which triggers a soft-reset that always lands at the prompt. The
// whole thing is "best-effort": failures are logged but don't block
// the IDE -- the user can still click Stop or Soft-Reset manually
// from the terminal.
async function primeReplOnConnect() {
  if (!serialPort || !serialWriter) return;
  interactive = false;
  protoBuffer = new Uint8Array(0);
  try {
    // Phase 1: nudge with a newline so a half-typed REPL line gets
    // flushed.
    await sendRaw('\r\n');
    await sleep(60);

    // Phase 2: up to 1.2 s of Ctrl-C bursts. Stops early as soon as
    // we see a prompt or KeyboardInterrupt -- those are the signal
    // that the device is back in an interactive REPL state.
    const promptBytes = new TextEncoder().encode('>>> ');
    const kbiBytes    = new TextEncoder().encode('KeyboardInterrupt');
    let primed = false;
    for (let i = 0; i < 8; i++) {
      await sendRaw('\r\x03\x03');
      await sleep(150);
      if (indexOfSub(protoBuffer, promptBytes) >= 0 ||
          indexOfSub(protoBuffer, kbiBytes)    >= 0) {
        primed = true;
        break;
      }
    }

    if (!primed) {
      // Phase 3: last resort -- soft reset. Forces MicroPython to
      // restart and land at the bare prompt. Slightly destructive
      // (cancels any running program) but at this point the device
      // is wedged enough that the user expects a reset anyway.
      await sendRaw('\x04');
      await sleep(400);
      // After soft-reset, MicroPython prints its banner -- give it
      // one more breath, then a final Ctrl-C to make sure nothing
      // auto-started from main.py picks up again.
      await sendRaw('\x03');
      await sleep(150);
    }
  } catch (e) {
    console.warn('primeReplOnConnect failed:', e);
  } finally {
    protoBuffer = new Uint8Array(0);
    interactive = true;
  }
}

// Draw a "REPL connected" splash on the real device's screen: the same
// white "+" cross the firmware shows at boot, but smaller and shifted
// up, with the word "REPL" centred underneath. Gives clear visual
// feedback that the PC has taken over the device.
//
// Lightweight on purpose: it does NOT use runOnDevice (which soft-resets
// the board and so restarts the start menu). It assumes the REPL is
// already primed (we call it right after primeReplOnConnect /
// syncImagesQuietly, both of which leave the device at the friendly
// ">>> " prompt) and just sends a single exec(...) line. One line means
// no indentation/continuation pitfalls in the cooked REPL. Best-effort;
// errors are swallowed.
async function showReplSplash() {
  if (!serialPort || !serialWriter || deviceMode === 'emulator') return;
  // Device-side program. Newlines are kept as the two characters
  // backslash+n so the whole thing travels as ONE physical line; Python
  // turns them back into real newlines inside the exec string. Geometry
  // is computed on-device from pbc.WIDTH/HEIGHT. text24 is tried first
  // with a text18 fallback, so "REPL" shows on any firmware.
  const prog = [
    'import pbc',
    'pbc.clear()',
    '_w=pbc.WIDTH',
    '_h=pbc.HEIGHT',
    '_cs=_w*7//10',                      // boot cross size: 70% of width
    '_bt=_cs//4',                        // boot bar thickness
    '_cx=(_w-_cs)//2',                   // centred horizontally
    '_cy=(_h-_cs)//2',                   // centred vertically (like boot)
    '_hb=_cy+(_cs-_bt)//2',
    '_vb=_cx+(_cs-_bt)//2',
    'pbc.fill_rect(_cx,_hb,_cs,_bt,pbc.WHITE)',
    'pbc.fill_rect(_vb,_cy,_bt,_cs,pbc.WHITE)',
    '_ty=_cy+_cs+10',                    // "REPL" just below the cross
    'try:',
    ' _tw=pbc.text24_width("REPL")',
    ' pbc.text24("REPL",(_w-_tw)//2,_ty,pbc.WHITE)',
    'except Exception:',
    ' _tw=pbc.text18_width("REPL")',
    ' pbc.text18("REPL",(_w-_tw)//2,_ty,pbc.WHITE)',
  ].join('\\n');
  try {
    interactive = false;
    // Make sure we're at a clean cooked prompt, then exec the one-liner.
    await sendRaw('\r\x03');           // cancel any half-typed line
    await sleep(60);
    await sendRaw("exec('" + prog + "')\r");
    await sleep(250);                  // let it draw
  } catch (e) {
    console.warn('showReplSplash failed (ignored):', e);
  } finally {
    protoBuffer = new Uint8Array(0);
    interactive = true;
  }
}

async function runOnDevice(code, timeoutMs = 10000, opts = {}) {
  // Emulator path: hand off to the in-browser MicroPython runtime.
  // We return a serial-shaped {stdout, stderr, ok} result so callers
  // that inspect the return value keep working unchanged.
  if (deviceMode === 'emulator') {
    if (window.__emuRun) {
      await window.__emuRun(code);
    }
    return { stdout: '', stderr: '', ok: true };
  }
  if (!serialPort) { toast(t('Nicht verbunden'), 'bad'); return null; }
  const stream = opts.stream === true;
  interactive = false;
  protoBuffer = new Uint8Array(0);
  try {
    // Forcefully stop anything currently running. We try up to ~600 ms
    // worth of Ctrl-C interrupts before giving up -- if the device is
    // deep inside time.sleep_ms() or a blocking USB callback, a single
    // Ctrl-C burst sometimes isn't enough for MicroPython to unwind to
    // a state where it can show a fresh prompt.
    let armed = false;
    for (let tries = 0; tries < 6; tries++) {
      await sendRaw('\r\x03\x03');
      await sleep(100);
      // After Ctrl-C, MicroPython prints either ">>> " (REPL) or
      // "KeyboardInterrupt" + ">>> ". Either is a sign the device is
      // listening again.
      if (indexOfSub(protoBuffer, new TextEncoder().encode('>>> ')) >= 0 ||
          indexOfSub(protoBuffer, new TextEncoder().encode('KeyboardInterrupt')) >= 0) {
        armed = true;
        break;
      }
    }
    if (!armed) {
      // No prompt seen at all -- could just mean it was already idle
      // (no banner to print) or the device is wedged. Proceed anyway
      // and let the raw-REPL handshake decide.
    }

    // Soft-reset before every run. Ctrl-D in the friendly REPL tells
    // MicroPython to re-import everything from scratch: globals are
    // wiped, modules are re-initialised, the heap is reclaimed. USB
    // CDC survives (unlike machine.soft_reset()), so we stay
    // connected. The cost is ~300 ms; the benefit is a guaranteed
    // clean slate for every test run -- no Canvas / Sprite / Turtle
    // residue from the previous run sitting in globals(), no
    // memory-fragmentation buildup.
    //
    // On boards with a main.py launcher (like ours), the soft-reset
    // boot sequence also runs main.py. We follow up with another
    // Ctrl-C burst to interrupt it before it grabs the screen, so
    // by the time we enter raw REPL the device is idle and ready
    // for the student's code.
    protoBuffer = new Uint8Array(0);
    await sendRaw('\x04');                       // soft reset
    // Wait for the "MPY: soft reboot" banner -- that's the signal
    // the reset actually fired. Fall through unconditionally; even
    // if we missed the banner the device will respond to interrupts.
    await waitFor('MPY: soft reboot', 800);
    // Give the boot sequence a brief moment to get through its own
    // `import pbc` before we hammer Ctrl-C. Interrupting mid-import can
    // leave a half-built module in sys.modules (which we also defend
    // against in the run prelude). 120 ms is enough for the import yet
    // short enough that a main.py loop hasn't taken over the screen.
    await sleep(120);
    // main.py / boot.py have a chance to start. Interrupt them hard
    // so they don't keep running and consume the REPL.
    for (let tries = 0; tries < 4; tries++) {
      await sendRaw('\r\x03\x03');
      await sleep(80);
      if (indexOfSub(protoBuffer, new TextEncoder().encode('>>> ')) >= 0 ||
          indexOfSub(protoBuffer, new TextEncoder().encode('KeyboardInterrupt')) >= 0) {
        break;
      }
    }

    protoBuffer = new Uint8Array(0);
    // Enter raw REPL. The prompt is "raw REPL; CTRL-B to exit\r\n>".
    // Earlier this failed sporadically with "[Raw-REPL-Prompt nicht
    // gesehen]" even though the device clearly printed the prompt (you
    // could see it in the terminal). Two causes:
    //   1. The prompt bytes arrived just AFTER a fixed wait elapsed, or
    //   2. a retry flushed protoBuffer right as the prompt landed,
    //      throwing it away.
    // Fix: send Ctrl-A, then poll the buffer GENEROUSLY without ever
    // discarding it, and accept the moment "raw REPL" + a following ">"
    // appears. If the first Ctrl-A doesn't take within a bit, send
    // another (harmless if already in raw mode) and keep polling. We
    // sync on the LAST occurrence so multiple echoed prompts are fine.
    let inRaw = false;
    {
      const rawMark = new TextEncoder().encode('raw REPL');
      const deadline = Date.now() + 3000;
      let resent = 0;
      let nextResend = Date.now() + 800;
      await sendRaw('\x01');
      while (Date.now() < deadline) {
        const idx = lastIndexOfSub(protoBuffer, rawMark);
        if (idx >= 0) {
          // Make sure the ">" prompt that follows the banner has also
          // arrived, so the program bytes we send next start cleanly.
          const after = protoBuffer.slice(idx + rawMark.length);
          const gt = indexOfSub(after, new TextEncoder().encode('>'));
          if (gt >= 0) {
            // Drop everything up to and including the final prompt ">".
            protoBuffer = after.slice(gt + 1);
            inRaw = true;
            break;
          }
        }
        // Re-nudge with another Ctrl-A every ~800 ms (harmless if we're
        // already in raw mode) in case the first one was missed.
        if (resent < 3 && Date.now() >= nextResend) {
          await sendRaw('\x01');
          resent++;
          nextResend = Date.now() + 800;
        }
        await sleep(15);
      }
    }
    if (!inRaw) {
      term.write('\r\n\x1b[31m' + t('[Raw-REPL-Prompt nicht gesehen]') + '\x1b[0m\r\n');
      term.write('\x1b[33m' + t('Hinweis: Vielleicht läuft gerade ein Programm auf dem PBC+ (z.B. main.py). Drücke "Soft-Reset" im Terminal-Header.') + '\x1b[0m\r\n');
      return null;
    }
    // (waitFor has already consumed the prompt bytes; buffer is empty
    // OR contains whatever the device sent immediately after.)

    // Send the program, then Ctrl-D to execute. MicroPython responds
    // with "OK" followed by the program's stdout, then 0x04, then
    // stderr, then another 0x04. We ack the OK with waitFor (which
    // strips it from the buffer) and then look for the two 0x04
    // separators.
    await sendRaw(code);
    await sendRaw('\x04');
    if (!await waitFor('OK', 4000)) {
      term.write('\r\n\x1b[31m[' + t('keine OK-Quittung') + ']\x1b[0m\r\n');
      return null;   // give up cleanly rather than hanging on output
    }

    // Read loop. Two modes:
    //   - stream=false (default): wait silently until both 0x04
    //     delimiters arrive, then return stdout+stderr to the caller.
    //   - stream=true: write stdout bytes into the terminal as they
    //     arrive, so prints in long-running programs show up live.
    //     stderr is still collected as a whole and returned (it's
    //     typically a single traceback at the end).
    const start = Date.now();
    let streamPos    = 0;     // how much of stdout we've already piped out
    let firstDelimAt = -1;    // index of the 0x04 that ends stdout
    let secondDelimAt = -1;   // index of the 0x04 that ends stderr

    while (Date.now() - start < timeoutMs) {
      // Look for the delimiters once each.
      if (firstDelimAt < 0) {
        firstDelimAt = protoBuffer.indexOf(0x04);
      }
      if (firstDelimAt >= 0 && secondDelimAt < 0) {
        const at = protoBuffer.indexOf(0x04, firstDelimAt + 1);
        if (at >= 0) secondDelimAt = at;
      }

      // Live-stream new stdout chunks if requested. We only stream
      // bytes that we know are part of stdout -- if firstDelimAt is
      // still unknown, "everything we have so far" is fair game; once
      // it's known, the stream stops at that boundary.
      if (stream) {
        const stdoutEnd = firstDelimAt >= 0 ? firstDelimAt
                                            : protoBuffer.length;
        if (streamPos < stdoutEnd) {
          const chunk = bufToString(protoBuffer.slice(streamPos, stdoutEnd));
          term.write(chunk.replace(/\n/g, '\r\n'));
          streamPos = stdoutEnd;
        }
      }

      if (secondDelimAt >= 0) break;
      await sleep(20);
    }

    // Build the final stdout/stderr strings for the caller. In stream
    // mode, stdout was already written to the terminal, so we return
    // empty stdout to signal "don't print this again". stderr is
    // always returned -- in stream mode it's painted red after stdout
    // finishes, in non-stream mode the caller decides what to do.
    let stdout = '', stderr = '';
    if (firstDelimAt >= 0) {
      if (!stream) {
        stdout = bufToString(protoBuffer.slice(0, firstDelimAt));
      }
      if (secondDelimAt >= 0) {
        stderr = bufToString(
          protoBuffer.slice(firstDelimAt + 1, secondDelimAt));
      } else {
        // Timed out before stderr ended -- give the caller what we
        // have so the error isn't completely lost.
        stderr = bufToString(protoBuffer.slice(firstDelimAt + 1));
      }
    } else if (!stream) {
      // Program never finished and we weren't streaming -- hand the
      // raw buffer over so the caller can at least see something.
      stdout = bufToString(protoBuffer);
    }

    // Leave raw REPL.
    await sendRaw('\x02');
    await sleep(50);
    return { stdout, stderr, streamed: stream };
  } finally {
    interactive = true;
    protoBuffer = new Uint8Array(0);
  }
}

