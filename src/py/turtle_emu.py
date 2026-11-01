
import js
import math
import pbc

_NAMED_COLORS = {
    "black":   pbc.BLACK,  "white":   pbc.WHITE,
    "red":     pbc.RED,    "green":   pbc.GREEN,
    "blue":    pbc.BLUE,   "yellow":  pbc.YELLOW,
    "cyan":    pbc.CYAN,   "magenta": pbc.MAGENTA,
    "orange":  pbc.ORANGE, "purple":  pbc.PURPLE,
    "gray":    pbc.GRAY,   "grey":    pbc.GRAY,
}

def _resolve_color(c, default=None):
    if isinstance(c, str):
        return _NAMED_COLORS.get(c, pbc.WHITE if default is None else default)
    return c

_CX = pbc.WIDTH  // 2
_CY = pbc.HEIGHT // 2

# Single shared canvas. We keep it in module state so multiple Turtle
# instances draw on the same surface, just like real Logo turtles do.
_canvas = None

# Cursor-area snapshot so we can erase the marker without erasing the
# pen-drawn line underneath.
_BACKUP_SIZE = 20
_backup = None

def _ensure_canvas():
    """Create the shared canvas if needed. True if it was created
    (then it is known to be all black)."""
    global _canvas
    if _canvas is not None:
        return False
    if True:
        _canvas = pbc.Canvas(pbc.WIDTH, pbc.HEIGHT)
        _canvas.fill(pbc.BLACK)
        # Clear the physical display in one fast JS call instead of
        # streaming 134 400 bytes across the bridge (that pixel-by-
        # pixel chr() build is what was freezing the tab on Turtle()).
        pbc._d.clear_display(pbc.BLACK)
    return True

def _show_full(canvas):
    """Push an entire canvas to the display. If a stamped image is
    cached, blit it straight from the JS Array (fast). If the canvas is
    a uniform colour (the common 'new background' / fill case) use the
    O(1) clear_display. Otherwise fall back to a full per-pixel push
    (slow-ish but one-shot, only at turtle construction)."""
    # Cached image (e.g. a wallpaper stamped onto the canvas): blit it
    # in one fast JS call. MUST be checked before the uniform test,
    # because a cached canvas still has an all-zero bytearray buf and
    # the uniform test would wrongly clear the screen to black.
    if getattr(canvas, '_js_arr_cache', None) is not None:
        pbc._show_raw(canvas, 0, 0)
        return
    buf = canvas.buf
    w = canvas.width
    h = canvas.height
    if isinstance(buf, (bytes, bytearray)):
        # Uniform fill (the common fill(BLACK) case): compare row by row
        # against one colour (C-level, one row of extra memory). A
        # sampled test would miss thin lines such as a 1-px frame and
        # blank the screen.
        n = w * 2
        zeile = bytes(buf[:2]) * w
        uniform = True
        for i in range(0, n * h, n):
            if buf[i:i + n] != zeile:
                uniform = False
                break
        if uniform:
            pbc._d.clear_display((buf[1] << 8) | buf[0])
            return
    _show_dirty_rect_full(canvas)

def _show_dirty_rect_full(canvas):
    """Full-canvas push for a non-uniform background. Used only once at
    turtle construction. Delegates to pbc._show_raw, which does a
    null-safe per-pixel blit (a string transfer breaks on chr(0))."""
    pbc._show_raw(canvas, 0, 0)

def _ensure_backup():
    global _backup
    if _backup is None:
        _backup = bytearray(_BACKUP_SIZE * _BACKUP_SIZE * 2)

def _save_under(cx, cy):
    """Copy a BACKUP_SIZE x BACKUP_SIZE region around (cx,cy) from
    _canvas.buf into _backup. Returns (x0, y0) -- the top-left corner
    we actually saved, clamped to the screen."""
    _ensure_backup()
    # The canvas may still hold a stamped image only in its JS-Array
    # cache (buf not yet written). We read buf here, so materialize the
    # image into buf first -- otherwise we'd save (and later restore)
    # black instead of the picture, leaving a black trail. _materialize
    # is a no-op once done, so calling it on every save is cheap after
    # the first time.
    if getattr(_canvas, '_js_arr_cache', None) is not None:
        _canvas._materialize()
    n = _BACKUP_SIZE; half = n // 2
    x0 = max(0, min(cx - half, pbc.WIDTH  - n))
    y0 = max(0, min(cy - half, pbc.HEIGHT - n))
    cb = _canvas.buf
    for row in range(n):
        src = ((y0 + row) * pbc.WIDTH + x0) * 2
        dst = row * n * 2
        _backup[dst:dst + n*2] = cb[src:src + n*2]
    return (x0, y0)

def _restore_under(pos):
    """Paint _backup back onto _canvas at the saved (x0, y0)."""
    if _backup is None or pos is None:
        return
    n = _BACKUP_SIZE
    x0, y0 = pos
    cb = _canvas.buf
    for row in range(n):
        src = row * n * 2
        dst = ((y0 + row) * pbc.WIDTH + x0) * 2
        cb[dst:dst + n*2] = _backup[src:src + n*2]
    # Mutating buf invalidates any js-array cache for this canvas.
    _canvas._js_arr_cache = None
    _canvas._js_copy = None

def _show_dirty_rect(x0, y0, w, h):
    """Push only the changed rectangle to the display via per-pixel
    writes. We do NOT use the string bridge here: a Python str built
    with chr() is passed to JS NULL-TERMINATED by MicroPython.wasm, so
    the first black pixel (chr(0)) truncates it to length 0 and nothing
    gets drawn. Per-pixel blit_pixel passes plain ints, which always
    cross cleanly. The rect is small (cursor area, ~20x20), so a few
    hundred calls per frame is fine."""
    cw = pbc.WIDTH
    # Clamp to screen.
    if x0 < 0: w += x0; x0 = 0
    if y0 < 0: h += y0; y0 = 0
    if x0 + w > cw: w = cw - x0
    if y0 + h > pbc.HEIGHT: h = pbc.HEIGHT - y0
    if w <= 0 or h <= 0:
        return
    cb = _canvas.buf
    for row in range(h):
        yy = y0 + row
        base = (yy * cw + x0) * 2
        for col in range(w):
            off = base + col * 2
            c = (cb[off + 1] << 8) | cb[off]
            pbc._d.blit_pixel(x0 + col, yy, c)
    pbc._d.blit_finalize(x0, y0, w, h)

def _bres_line(x0, y0, x1, y1, c):
    """Bresenham line, drawing into _canvas via Canvas.pixel."""
    dx = abs(x1 - x0); sx = 1 if x0 < x1 else -1
    dy = -abs(y1 - y0); sy = 1 if y0 < y1 else -1
    err = dx + dy
    while True:
        _canvas.pixel(x0, y0, c)
        if x0 == x1 and y0 == y1: break
        e2 = 2 * err
        if e2 >= dy: err += dy; x0 += sx
        if e2 <= dx: err += dx; y0 += sy

def _draw_cursor(x, y, heading_deg, color):
    """Draw the asymmetric arrow marker on _canvas."""
    TIP, BASE = 8, 5
    head = math.radians(heading_deg)
    tx = x + round(TIP  * math.cos(head))
    ty = y + round(TIP  * math.sin(head))
    blr = math.radians(heading_deg + 150)
    bx1 = x + round(BASE * math.cos(blr))
    by1 = y + round(BASE * math.sin(blr))
    brr = math.radians(heading_deg - 150)
    bx2 = x + round(BASE * math.cos(brr))
    by2 = y + round(BASE * math.sin(brr))
    _bres_line(tx, ty, bx1, by1, color)
    _bres_line(bx1, by1, bx2, by2, color)
    _bres_line(bx2, by2, tx, ty, color)

import js as _js

# One display frame (16 ms) between animation steps.
def _yield():
    _js.globalThis.__pbc.sleep_ms(16)

class Turtle:
    def __init__(self, canvas=None):
        global _canvas
        frisch = False
        if canvas is not None:
            _canvas = canvas
        else:
            frisch = _ensure_canvas()
        # Route plain pbc.fill / pbc.line / pbc.pixel / ... onto this
        # same canvas, so "Bildschirm füllen" and turtle drawing share
        # one surface instead of fighting over the display.
        if not js.globalThis.__pbcTextMode:
            pbc._set_active_canvas(_canvas)
        # Push the current canvas contents to the screen once so the
        # background (which may have been filled before the turtle was
        # created) is visible. Do this BEFORE materialize so _show_full
        # can use the fast cached-JS-Array blit if an image is staged.
        # A canvas that already holds a drawing (an earlier turtle) is
        # pushed completely: the sampled "uniform" test in _show_full
        # can miss thin lines and would blank the screen.
        if frisch or getattr(_canvas, '_js_arr_cache', None) is not None:
            _show_full(_canvas)
        elif canvas is None:
            _show_dirty_rect_full(_canvas)
        else:
            _show_full(_canvas)
        # If the canvas holds a stamped image via the fast JS-Array
        # cache, its bytearray buf is still empty. The turtle reads buf
        # to save the area under its cursor, so we must materialize the
        # image into buf now -- otherwise the cursor restores black and
        # leaves a black trail over the picture.
        _canvas._materialize()
        self.color    = pbc.WHITE
        self.draw_pen = True
        self.visible  = True
        self._speed   = 5
        self._x = float(_CX)
        self._y = float(_CY)
        # 0=right, 90=down, 180=left, 270=up. Default points up.
        self._angle = 270.0
        self._cursor_pos = None
        self._bk = None         # this turtle's copy of the area under its marker
        self._draw_cursor_and_push()

    def setPenColor(self, color):
        self.color = _resolve_color(color, pbc.WHITE)

    def penUp(self):    self.draw_pen = False
    def penDown(self):  self.draw_pen = True

    def hide(self):
        self._erase_cursor()
        self.visible = False
        self._push_cursor_area()

    def show(self):
        # Erase the existing marker before redrawing, else show()
        # right after the constructor (which already drew one) stacks
        # a second triangle -> doubled cursor. Matches the
        # erase-then-draw pattern used by left/right/forward/etc.
        was_visible = self.visible
        self.visible = True
        if was_visible:
            self._erase_cursor()
        self._draw_cursor_and_push()

    def speed(self, s):
        if s < 0: s = 0
        self._speed = s

    def left(self, angle):
        self._erase_cursor()
        self._angle = (self._angle - angle) % 360
        self._draw_cursor_and_push()

    def right(self, angle):
        self._erase_cursor()
        self._angle = (self._angle + angle) % 360
        self._draw_cursor_and_push()

    def setDirection(self, angle):
        self._erase_cursor()
        # Compass-like: user 0 = up (screen 270), 90 = right (screen 0),
        # clockwise -- the same way "rechts drehen" turns.
        self._angle = (270 + angle) % 360
        self._draw_cursor_and_push()

    def setPosition(self, x, y):
        alt = self._cursor_pos
        self._erase_cursor()
        if alt is not None:
            # show the erased old marker area, not only the new one
            _show_dirty_rect(alt[0], alt[1], _BACKUP_SIZE, _BACKUP_SIZE)
        self._x = _CX + x
        self._y = _CY - y
        self._draw_cursor_and_push()

    def home(self):
        self.setPosition(0, 0)

    def forward(self, dist):
        """Walk forward dist pixels.

        speed=0: teleport, single frame.
        speed=N (1..10): roughly N pixels per visible frame, capped to
        at most ~12 frames per call so that very long forward() calls
        don't take hundreds of frames."""
        rad = math.radians(self._angle)
        dx, dy = math.cos(rad), math.sin(rad)
        sign  = 1 if dist >= 0 else -1
        adist = abs(dist)
        steps = int(adist)
        if self._speed == 0:
            # Instant: walk all pixels (drawing path), one push at end.
            sx, sy = int(self._x), int(self._y)
            self._erase_cursor()
            for _ in range(steps):
                self._x += sign * dx
                self._y += sign * dy
                if self.draw_pen:
                    _canvas.pixel(int(self._x), int(self._y), self.color)
            rem = adist - steps
            if rem > 0:
                self._x += sign * dx * rem
                self._y += sign * dy * rem
            ex, ey = int(self._x), int(self._y)
            self._draw_cursor_and_push_range(sx, sy, ex, ey)
            return
        # Animated. Decide chunk size so we have at most ~12 frames
        # per forward() call, regardless of how big dist is. This is
        # the difference between a snappy demo and locking up the tab.
        MAX_FRAMES = 12
        base = max(1, int(self._speed))
        if steps // base > MAX_FRAMES:
            block = max(base, steps // MAX_FRAMES)
        else:
            block = base
        walked = 0
        while walked < steps:
            n = min(block, steps - walked)
            sx, sy = int(self._x), int(self._y)
            self._erase_cursor()
            for _ in range(n):
                self._x += sign * dx
                self._y += sign * dy
                if self.draw_pen:
                    _canvas.pixel(int(self._x), int(self._y), self.color)
            ex, ey = int(self._x), int(self._y)
            self._draw_cursor_and_push_range(sx, sy, ex, ey)
            _yield()
            walked += n
        rem = adist - steps
        if rem > 0:
            sx, sy = int(self._x), int(self._y)
            self._erase_cursor()
            self._x += sign * dx * rem
            self._y += sign * dy * rem
            ex, ey = int(self._x), int(self._y)
            self._draw_cursor_and_push_range(sx, sy, ex, ey)

    def back(self, dist):
        self.forward(-dist)

    def moveTo(self, x, y):
        saved = self._angle
        tx = _CX + x
        ty = _CY - y
        dx = tx - self._x
        dy = ty - self._y
        self._angle = math.degrees(math.atan2(dy, dx)) % 360
        self.forward(math.sqrt(dx * dx + dy * dy))
        self._erase_cursor()
        self._angle = saved
        self._draw_cursor_and_push()

    def clear(self, color=None):
        c = pbc.BLACK if color is None else _resolve_color(color, pbc.BLACK)
        _canvas.fill(c)
        self._cursor_pos = None
        # Full repaint after clear is unavoidable.
        pbc.show(_canvas)
        self._draw_cursor_and_push()

    def on_color(self, color, lookahead=3):
        """True if the point lookahead px ahead of the turtle matches
        color (a name like 'red' or an RGB565 int). Looking ahead
        avoids reading the turtle's own trail. On a slanted heading the
        two pixels next to that point towards the turtle count too:
        two 1-px diagonal lines can cross without sharing a pixel, and
        a check of one point alone would slip through the gap (same as
        the device)."""
        color = _resolve_color(color, pbc.WHITE)
        rad = math.radians(self._angle)
        dx, dy = math.cos(rad), math.sin(rad)
        x = int(self._x + lookahead * dx)
        y = int(self._y + lookahead * dy)
        sx = (dx > 1e-6) - (dx < -1e-6)
        sy = (dy > 1e-6) - (dy < -1e-6)
        if self._pixel_is(x, y, color):
            return True
        if sx and sy:
            return self._pixel_is(x - sx, y, color) or self._pixel_is(x, y - sy, color)
        return False

    def _pixel_is(self, x, y, color):
        """Canvas pixel test; where the marker covers (x, y) we read the
        saved area under the marker instead."""
        c = _canvas
        if not (0 <= x < c.width and 0 <= y < c.height):
            return False
        if (self.visible and self._cursor_pos is not None and
                self._bk is not None):
            n = _BACKUP_SIZE
            bx, by = self._cursor_pos
            if bx <= x < bx + n and by <= y < by + n:
                off = ((y - by) * n + (x - bx)) * 2
                return ((self._bk[off + 1] << 8) | self._bk[off]) == color
        return c.pixel(x, y) == color

    # ---- internals --------------------------------------------------

    def _draw_cursor_and_push(self):
        """Draw the cursor at current pos and push that small area."""
        if self.visible:
            cx = int(self._x); cy = int(self._y)
            self._cursor_pos = _save_under(cx, cy)
            self._bk = bytearray(_backup)
            _draw_cursor(cx, cy, self._angle, self.color)
        self._push_cursor_area()

    def _draw_cursor_and_push_range(self, sx, sy, ex, ey):
        """Like _draw_cursor_and_push but also includes the line
        segment between (sx,sy) and (ex,ey) in the pushed area, so the
        newly drawn line pixels become visible too."""
        if self.visible:
            cx = int(self._x); cy = int(self._y)
            self._cursor_pos = _save_under(cx, cy)
            self._bk = bytearray(_backup)
            _draw_cursor(cx, cy, self._angle, self.color)
        # Bounding box that covers the cursor's old and new positions
        # plus the line segment between them.
        n = _BACKUP_SIZE; half = n // 2
        xs = [sx - half, sx + half, ex - half, ex + half]
        ys = [sy - half, sy + half, ey - half, ey + half]
        x0 = min(xs); y0 = min(ys)
        w  = max(xs) - x0 + 1
        h  = max(ys) - y0 + 1
        _show_dirty_rect(x0, y0, w, h)

    def _push_cursor_area(self):
        """Push just the cursor backup-area rectangle to the display."""
        n = _BACKUP_SIZE
        if self._cursor_pos is not None:
            x0, y0 = self._cursor_pos
        else:
            cx = int(self._x); cy = int(self._y); half = n // 2
            x0 = max(0, min(cx - half, pbc.WIDTH  - n))
            y0 = max(0, min(cy - half, pbc.HEIGHT - n))
        _show_dirty_rect(x0, y0, n, n)

    def _erase_cursor(self):
        if self.visible and self._cursor_pos is not None:
            if self._bk is not None:
                _backup[:] = self._bk
            _restore_under(self._cursor_pos)
            self._cursor_pos = None
