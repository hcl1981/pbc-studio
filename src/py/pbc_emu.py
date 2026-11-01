
import js

_d = js.globalThis.__pbc

# Colour constants
BLACK   = 0x0000
WHITE   = 0xFFFF
RED     = 0xF800
GREEN   = 0x07E0
BLUE    = 0x001F
YELLOW  = 0xFFE0
CYAN    = 0x07FF
MAGENTA = 0xF81F
ORANGE  = 0xFD20
PURPLE  = 0x780F   # same value as the firmware (colors.h)
GRAY    = 0x8410   # colors.h COLOR_GRAY

WIDTH  = 240
HEIGHT = 280

LEFT, RIGHT, UP, DOWN, CENTER, A, B = 0,1,2,3,4,5,6

def _tstr(s):
    # The device's text functions take only strings (display.c uses
    # mp_obj_str_get_str); give the same TypeError as the device.
    if isinstance(s, str):
        return s
    raise TypeError("can't convert '%s' object to str implicitly" % type(s).__name__)

def _gint(v):
    # like mp_obj_get_int on the device: ints (and bools) only, so a
    # coordinate like 120.0 fails here exactly as on the PBC+
    if isinstance(v, int):
        return v
    raise TypeError("can't convert %s to int" % type(v).__name__)

def color(r, g, b):
    # the device clamps each value to 0..255
    r, g, b = [min(255, max(0, _gint(v))) for v in (r, g, b)]
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3)

# The real device exposes the colour constructor as pbc.rgb(...).
# Block-generated code uses this name (the colour-picker block emits
# "pbc.rgb(R, G, B)"), so we keep color as a friendly alias and rgb
# as the canonical name.
rgb = color

# Active drawing surface. When a turtle (or canvas-based program) is
# running, it registers its Canvas here so that the plain pbc.fill /
# pbc.line / pbc.pixel / ... display calls draw onto that SAME canvas
# instead of straight to the framebuffer. Without this, mixing a
# "Bildschirm füllen" block with turtle drawing produced two
# independent buffers -- the turtle's canvas would overwrite the
# fill (or vice versa) and the screen looked wrong/black. None means
# "draw directly to the display" (the normal, no-turtle case).
_active_canvas = None

def _set_active_canvas(cv):
    global _active_canvas
    _active_canvas = cv

def fill(c=BLACK):
    _sprites_jetzt()
    c = _gint(c)
    if _active_canvas is not None:
        _active_canvas.fill(c)
        show(_active_canvas)
    else:
        _d.fill(c)
def clear(color=BLACK):
    fill(color)
def pixel(x, y, c):
    _sprites_jetzt()
    x, y, c = _gint(x), _gint(y), _gint(c)
    if _active_canvas is not None:
        _active_canvas.pixel(x, y, c)
    else:
        _d.pixel(x, y, c)
def fill_rect(x, y, w, h, c):   _sprites_jetzt(); _d.fill_rect(_gint(x), _gint(y), _gint(w), _gint(h), _gint(c))
def rect(x, y, w, h, c, fill=False):
    _sprites_jetzt()
    x, y, w, h, c = _gint(x), _gint(y), _gint(w), _gint(h), _gint(c)
    if fill:
        _d.fill_rect(x, y, w, h, c)
    else:
        _d.rect(x, y, w, h, c)
def hline(x, y, w, c):          _sprites_jetzt(); _d.hline(_gint(x), _gint(y), _gint(w), _gint(c))
def vline(x, y, h, c):          _sprites_jetzt(); _d.vline(_gint(x), _gint(y), _gint(h), _gint(c))
def line(x0, y0, x1, y1, c):    _sprites_jetzt(); _d.line(_gint(x0), _gint(y0), _gint(x1), _gint(y1), _gint(c))
def poly(ox, oy, coords, c, fill=False):
    # coords is an array.array('h') (or list) of x0,y0,x1,y1,... offsets
    # relative to (ox, oy). A plain Python array can't be indexed from JS,
    # so copy it into a real JS array before handing it to the dispatcher.
    _sprites_jetzt()
    _ja = js.Array.new()
    for _v in coords:
        _ja.push(_v)
    _d.poly(ox, oy, _ja, c, fill)
def ellipse(cx, cy, rx, ry, c, fill=False):
    _sprites_jetzt()
    _d.ellipse(_gint(cx), _gint(cy), _gint(rx), _gint(ry), _gint(c), fill)
def text(s, x, y, c):
    _sprites_jetzt()
    _d.text(_tstr(s), _gint(x), _gint(y), _gint(c))
def text12(s, x, y, c, bg=None):
    _sprites_jetzt()
    _d.text12(_tstr(s), _gint(x), _gint(y), _gint(c), bg)

def text18(s, x, y, c, bg=None):
    _sprites_jetzt()
    _d.text18(_tstr(s), _gint(x), _gint(y), _gint(c), bg)

def text24(s, x, y, c, bg=None):
    _sprites_jetzt()
    _d.text24(_tstr(s), _gint(x), _gint(y), _gint(c), bg)

# Pixel width of a string in the proportional fonts (as on the device).
def text12_width(s): return int(_d.text_width(12, _tstr(s)))
def text18_width(s): return int(_d.text_width(18, _tstr(s)))
def text24_width(s): return int(_d.text_width(24, _tstr(s)))

def backlight(level):
    pass    # the emulator display has no backlight

# Battery: the emulator behaves like a device powered over USB.
def battery_voltage(): return 5.0
def is_on_usb():       return battery_voltage() > 4.0

def pressed_left():   return bool(_d.pressed_left())
def pressed_right():  return bool(_d.pressed_right())
def pressed_up():     return bool(_d.pressed_up())
def pressed_down():   return bool(_d.pressed_down())
def pressed_center(): return bool(_d.pressed_center())
def pressed_a():      return bool(_d.pressed_a())
def pressed_b():      return bool(_d.pressed_b())

# Edge-triggered variants: True exactly once per press, then False
# again until the button is released and pressed anew. Same contract as
# the device firmware, so a program that uses them behaves identically
# in the browser and on hardware.
def was_pressed_left():   return bool(_d.was_pressed_left())
def was_pressed_right():  return bool(_d.was_pressed_right())
def was_pressed_up():     return bool(_d.was_pressed_up())
def was_pressed_down():   return bool(_d.was_pressed_down())
def was_pressed_center(): return bool(_d.was_pressed_center())
def was_pressed_a():      return bool(_d.was_pressed_a())
def was_pressed_b():      return bool(_d.was_pressed_b())

def any_pressed():
    return bool(_d.any_pressed())

def wait_for_button():
    # blocks in the worker until a button goes down (or Stop)
    if _d.wait_button():
        raise KeyboardInterrupt()

def set_led(idx, on): _d.set_led(idx, on)
def led_red(on=True):    _d.set_led(0, on)
def led_yellow(on=True): _d.set_led(1, on)
def led_green(on=True):  _d.set_led(2, on)
def leds_off():
    _d.set_led(0, False)
    _d.set_led(1, False)
    _d.set_led(2, False)
def rgb_led(r, g, b):
    # the device clamps each value to 0..255
    _d.rgb_led(*[min(255, max(0, _gint(v))) for v in (r, g, b)])
def rgb_led_off():    _d.rgb_led_off()

# ---- accelerometer ---------------------------------------------
# The emulator has no real sensor, so we report a device lying
# flat on its back: x and y are zero, z holds the full pull of
# gravity. This lets programs that read accel values run without
# crashing; programs that depend on tilt to do something interesting
# will just see a static reading.
#
# Sign of z: on the real PBC+ "display up, lying on a table" reads
# z ≈ +1 g (the sensor measures the reaction force the table exerts
# UP on it, not the gravity vector itself).
# The tilt pad under the emulator sets the reading (default: flat).
def accel_x_g():  return float(_d.accel_g(0))
def accel_y_g():  return float(_d.accel_g(1))
def accel_z_g():  return float(_d.accel_g(2))
def accel_x():    return accel_x_g() * 9.81
def accel_y():    return accel_y_g() * 9.81
def accel_z():    return accel_z_g() * 9.81

def tone(freq, ms=None):
    # The page schedules the buzzer fade-out itself (WebAudio). Like on
    # the device, tone() does not wait; a pause needs a sleep of its own.
    _d.tone(_gint(freq), None if ms is None else _gint(ms))
def tone_off(): _d.tone_off()
no_tone = tone_off    # alias used by some block-generated code

def delay(ms):
    _sprites_jetzt()
    import time as _t
    _t.sleep_ms(_gint(ms))

class Canvas:
    def __init__(self, w, h, buf=None, transparent=None):
        self.width = w
        self.height = h
        self.transparent = transparent
        if buf is None:
            buf = bytearray(w * h * 2)
        self.buf = buf
        # If a full-canvas image has been blitted onto us at (0,0), we
        # remember the source's JS Array buf here. _composite_canvas
        # uses it for a fast JS-side blit instead of streaming our
        # bytearray pixel-by-pixel from Python. None means "no shortcut
        # available, fall back to per-pixel".
        self._js_arr_cache = None
        self._js_arr_cache_key = None
        # JS-side Uint8Array copy of a bytearray buf, so a whole canvas
        # crosses into JS in one call instead of one call per pixel.
        # Every write through the Canvas methods drops it (None), and
        # _js_buf() rebuilds it on the next blit. A static background
        # is therefore copied once, not on every sprite frame. Code that
        # writes canvas.buf directly must reset _js_copy itself.
        self._js_copy = None

    def _js_buf(self):
        buf = self.buf
        if not isinstance(buf, (bytes, bytearray)):
            return buf                    # already a JS Array
        if self._js_copy is None:
            self._js_copy = js.Uint8Array.new(buf)
        return self._js_copy

    def fill(self, color=BLACK):
        """Fill the entire canvas with one RGB565 colour."""
        c = _gint(color) & 0xffff
        lo = c & 0xff
        hi = (c >> 8) & 0xff
        buf = self.buf
        n = self.width * self.height * 2
        # Fill in place by doubling the filled part (no 134 KB temporary,
        # which would need a second large free block, unlike the device).
        if isinstance(buf, bytearray):
            buf[0] = lo
            buf[1] = hi
            mv = memoryview(buf)
            k = 2
            while k < n:
                m = k if k < n - k else n - k
                mv[k:k + m] = mv[0:m]
                k += m
        else:
            for i in range(0, n, 2):
                buf[i]     = lo
                buf[i + 1] = hi
        # A solid fill invalidates any cached image: the canvas no
        # longer matches whatever image was stamped on previously.
        self._js_arr_cache = None
        self._js_arr_cache_key = None
        self._js_copy = None

    def pixel(self, x, y, color=None):
        """Set a single pixel on this canvas (RGB565). Without a colour,
        return the pixel's RGB565 value instead -- the same read form
        as framebuf.FrameBuffer.pixel(x, y) on the device (None when
        (x, y) is outside the canvas)."""
        x = _gint(x); y = _gint(y)
        if x < 0 or y < 0 or x >= self.width or y >= self.height:
            return
        if color is None:
            return self._get_pixel(x, y)
        # If an image is only in the cache, fold it into buf first so
        # this pixel edit doesn't silently drop the picture (we're
        # about to invalidate the cache, after which buf is the only
        # source of truth).
        if self._js_arr_cache is not None:
            self._materialize()
        c = _gint(color) & 0xffff
        off = (y * self.width + x) * 2
        self.buf[off]     = c & 0xff
        self.buf[off + 1] = (c >> 8) & 0xff
        self._js_arr_cache = None
        self._js_arr_cache_key = None
        self._js_copy = None

    def _get_pixel(self, x, y):
        """RGB565 value at an in-bounds (x, y). Reads the cached image
        if one is staged (without materializing it -- that would cost a
        full-canvas copy per read). Cached pixels equal to the cache's
        colour key are see-through, as on the device after a keyed
        blit, so those fall back to the bytearray underneath. buf may
        be a bytearray or a JS Array proxy (images from load_image)."""
        off = (y * self.width + x) * 2
        cache = self._js_arr_cache
        if cache is not None:
            c = (int(cache[off + 1]) << 8) | int(cache[off])
            ck = self._js_arr_cache_key
            if ck is None or c != int(ck):
                return c
            if not isinstance(self.buf, (bytes, bytearray)):
                return c
        buf = self.buf
        return (int(buf[off + 1]) << 8) | int(buf[off])

    # ---- shape drawing into the canvas buffer ----------------------
    # The real device's Canvas inherits these from framebuf.FrameBuffer.
    # The emulator shim builds them on top of self.pixel so the
    # "... auf Canvas" blocks (rect / line / ellipse / text) work the
    # same way -- important for e.g. drawing a score onto the sprite
    # background so it survives sprite redraws.
    def hline(self, x, y, w, color):
        x = _gint(x); y = _gint(y); w = _gint(w)
        for i in range(w):
            self.pixel(x + i, y, color)

    def vline(self, x, y, h, color):
        x = _gint(x); y = _gint(y); h = _gint(h)
        for i in range(h):
            self.pixel(x, y + i, color)

    def fill_rect(self, x, y, w, h, color):
        x = _gint(x); y = _gint(y); w = _gint(w); h = _gint(h)
        if self._js_arr_cache is not None:
            self._materialize()
        for row in range(h):
            self.hline(x, y + row, w, color)

    def rect(self, x, y, w, h, color, *f, **kw):
        # framebuf takes the fill flag only positionally on the device
        if kw:
            raise TypeError("function doesn't take keyword arguments")
        fill = f[0] if f else False
        x = _gint(x); y = _gint(y); w = _gint(w); h = _gint(h)
        if fill:
            self.fill_rect(x, y, w, h, color)
            return
        self.hline(x, y, w, color)
        self.hline(x, y + h - 1, w, color)
        self.vline(x, y, h, color)
        self.vline(x + w - 1, y, h, color)

    def line(self, x0, y0, x1, y1, color):
        x0 = _gint(x0); y0 = _gint(y0); x1 = _gint(x1); y1 = _gint(y1)
        dx = abs(x1 - x0); sx = 1 if x0 < x1 else -1
        dy = -abs(y1 - y0); sy = 1 if y0 < y1 else -1
        err = dx + dy
        while True:
            self.pixel(x0, y0, color)
            if x0 == x1 and y0 == y1:
                break
            e2 = 2 * err
            if e2 >= dy:
                err += dy; x0 += sx
            if e2 <= dx:
                err += dx; y0 += sy

    def ellipse(self, cx, cy, rx, ry, color, *f, **kw):
        if kw:
            raise TypeError("function doesn't take keyword arguments")
        fill = f[0] if f else False
        cx = _gint(cx); cy = _gint(cy); rx = _gint(rx); ry = _gint(ry)
        if rx <= 0 or ry <= 0:
            self.pixel(cx, cy, color); return
        # Simple per-scanline ellipse (good enough for the shim).
        for dy in range(-ry, ry + 1):
            # x extent at this row: rx*sqrt(1-(dy/ry)^2)
            frac = 1.0 - (dy * dy) / float(ry * ry)
            if frac < 0:
                continue
            half = int(rx * (frac ** 0.5))
            if fill:
                self.hline(cx - half, cy + dy, 2 * half + 1, color)
            else:
                self.pixel(cx - half, cy + dy, color)
                self.pixel(cx + half, cy + dy, color)
        if not fill:
            # Column pass as well, so the flat top and bottom of the
            # outline have no gaps (one pixel per row alone is dotted).
            for dx in range(-rx, rx + 1):
                frac = 1.0 - (dx * dx) / float(rx * rx)
                if frac < 0:
                    continue
                half = int(ry * (frac ** 0.5))
                self.pixel(cx + dx, cy - half, color)
                self.pixel(cx + dx, cy + half, color)

    def text(self, s, x, y, color):
        """8x8 monospace text, like framebuf.FrameBuffer.text() on the
        device (pbc.text() draws the same glyphs onto the display)."""
        x = _gint(x); y = _gint(y)
        if self._js_arr_cache is not None:
            self._materialize()
        c = _gint(color) & 0xffff
        pts = _d.text8_pixels(_tstr(s))
        n = int(pts.length)
        i = 0
        while i < n:
            self.pixel(x + int(pts[i]), y + int(pts[i + 1]), c)
            i += 2

    def text12_width(self, s): return text12_width(s)
    def text18_width(self, s): return text18_width(s)
    def text24_width(self, s): return text24_width(s)

    def poly(self, ox, oy, coords, color, fill=False):
        # coords: x0,y0,x1,y1,... relative to (ox, oy), as framebuf.poly
        pts = [int(v) for v in coords]
        n = len(pts) // 2
        if n == 0:
            return
        xs = [int(ox) + pts[2 * i] for i in range(n)]
        ys = [int(oy) + pts[2 * i + 1] for i in range(n)]
        if fill:
            for yy in range(min(ys), max(ys) + 1):
                cuts = []
                for i in range(n):
                    x0, y0 = xs[i], ys[i]
                    x1, y1 = xs[(i + 1) % n], ys[(i + 1) % n]
                    if (y0 <= yy < y1) or (y1 <= yy < y0):
                        cuts.append(x0 + (yy - y0) * (x1 - x0) // (y1 - y0))
                cuts.sort()
                for k in range(0, len(cuts) - 1, 2):
                    self.hline(cuts[k], yy, cuts[k + 1] - cuts[k] + 1, color)
        for i in range(n):
            self.line(xs[i], ys[i], xs[(i + 1) % n], ys[(i + 1) % n], color)

    def text12(self, s, x, y, color, bg=None):
        x = _gint(x); y = _gint(y)
        if self._js_arr_cache is not None:
            self._materialize()
        c = _gint(color) & 0xffff
        # Glyph pixel offsets come from the JS rasteriser as a flat
        # array [dx0, dy0, dx1, dy1, ...]. (bg cells aren't drawn in
        # the shim -- callers that want a filled background can draw a
        # fill_rect first.)
        pts = _d.text_pixels(_tstr(s))
        n = int(pts.length)
        i = 0
        while i < n:
            self.pixel(x + int(pts[i]), y + int(pts[i + 1]), c)
            i += 2

    def text18(self, s, x, y, color, bg=None):
        # Same font as text12, 1.5x larger -- glyph offsets from the
        # 18-px rasteriser.
        x = _gint(x); y = _gint(y)
        if self._js_arr_cache is not None:
            self._materialize()
        c = _gint(color) & 0xffff
        pts = _d.text18_pixels(_tstr(s))
        n = int(pts.length)
        i = 0
        while i < n:
            self.pixel(x + int(pts[i]), y + int(pts[i + 1]), c)
            i += 2

    def text24(self, s, x, y, color, bg=None):
        # Same font as text12, 2x larger -- glyph offsets from the
        # 24-px rasteriser.
        x = _gint(x); y = _gint(y)
        if self._js_arr_cache is not None:
            self._materialize()
        c = _gint(color) & 0xffff
        pts = _d.text24_pixels(_tstr(s))
        n = int(pts.length)
        i = 0
        while i < n:
            self.pixel(x + int(pts[i]), y + int(pts[i + 1]), c)
            i += 2

    def _materialize(self):
        """If a full-canvas image was blitted onto us via the fast
        cache shortcut (which skipped writing self.buf), copy the
        cached JS-Array image into our bytearray now. This is needed
        before any code READS self.buf -- e.g. the turtle's
        save-area-under-cursor logic, which would otherwise read stale
        zeros and paint a black trail where the cursor has been. Safe
        to call when there's no cache (it just no-ops)."""
        cache = self._js_arr_cache
        if cache is None:
            return
        # Make sure we own a bytearray (a cached canvas may still carry
        # the source JS Array as .buf).
        n = self.width * self.height * 2
        if not isinstance(self.buf, bytearray):
            self.buf = bytearray(n)
        db = self.buf
        # cache is a JS Array of byte ints; read via index (JsProxy
        # allows subscripting a real JS Array from Python here).
        for i in range(n):
            db[i] = int(cache[i]) & 0xff
        self._js_copy = None
        # The bytearray now matches the image; drop the cache so future
        # reads/writes use the bytearray as the single source of truth.
        self._js_arr_cache = None
        self._js_arr_cache_key = None

    def blit(self, src, x, y, key=None):
        """Copy src (another Canvas) onto this canvas at (x, y),
        treating key as a transparency colour if given. Mirrors
        framebuf.FrameBuffer.blit() on the real device."""
        x = _gint(x); y = _gint(y)
        sw = int(src.width); sh = int(src.height)
        if x + sw <= 0 or x >= self.width: return
        if y + sh <= 0 or y >= self.height: return
        # Fast-path cache: a full-canvas overwrite at (0,0) effectively
        # makes this canvas a stand-in for the source. We remember the
        # source's underlying JS Array (if it has one -- images from
        # load_image_blob do) AND its transparency key so later
        # operations like _redraw_sprites can blit that JS Array
        # straight into the framebuffer in one fast JS call, instead
        # of streaming our bytearray pixel-by-pixel from Python.
        self._js_copy = None
        if (x == 0 and y == 0 and sw == self.width and sh == self.height
                and not isinstance(src.buf, (bytes, bytearray))):
            self._js_arr_cache = src.buf
            # Treat the source's transparency colour as transparent
            # during later composite, matching what would happen on
            # the real device.
            self._js_arr_cache_key = (
                key if key is not None else src.transparent)
            # Skip the slow Python-side copy entirely: the cache IS the
            # canvas contents now. Anyone who reads self.buf byte-by-
            # byte later (very unusual; mainly the per-pixel fallback
            # path in show()) will see stale zeros, which is a known
            # trade-off for the >100x speedup on glide animations.
            return
        # A partial / keyed blit lands in the bytearray: fold a cached
        # full-canvas image into it first (or the picture would vanish),
        # then the bytearray is the only source of truth.
        if self._js_arr_cache is not None:
            self._materialize()
        self._js_arr_cache = None
        self._js_arr_cache_key = None
        # src.buf may be a Python bytearray or a JS Array proxy. Read
        # via getitem so either works.
        sb = src.buf
        db = self.buf
        for row in range(sh):
            py = y + row
            if py < 0 or py >= self.height: continue
            for col in range(sw):
                px = x + col
                if px < 0 or px >= self.width: continue
                so = (row * sw + col) * 2
                lo = int(sb[so]); hi = int(sb[so + 1])
                c = (hi << 8) | lo
                if key is not None and c == int(key):
                    continue
                do = (py * self.width + px) * 2
                db[do]     = c & 0xff
                db[do + 1] = (c >> 8) & 0xff

    def stamp_on(self, target, x, y):
        """Draw this canvas onto target at (x, y), using
        self.transparent as the transparency key if set. Target can be
        another Canvas or the display module (pbc itself, which has
        .blit via __getattr__-style dispatch)."""
        x = _gint(x); y = _gint(y)
        try:
            tw = int(target.width)
            th = int(target.height)
        except AttributeError:
            tw = WIDTH; th = HEIGHT
        if (x + self.width <= 0 or x >= tw or
            y + self.height <= 0 or y >= th):
            return
        key = self.transparent
        # If target is another Canvas, do the copy purely in Python
        # (Canvas.blit). Otherwise stream to the display via the JS
        # dispatcher. hasattr() can be unreliable across MicroPython
        # builds for JsProxy objects, so we check the type directly:
        # a real Python Canvas is an instance of this module's Canvas.
        if isinstance(target, Canvas):
            try:
                if key is not None:
                    target.blit(self, x, y, key)
                else:
                    target.blit(self, x, y)
            except (ValueError, TypeError):
                pass
        else:
            # Drawing directly to the display from a Python bytearray
            # buffer: same per-pixel streaming as show().
            _d.blit(self._js_buf(), x, y, self.width, self.height, key)

def load_image(path, transparent=MAGENTA):
    res = _d.load_image_blob(path)
    if res is None:
        raise OSError(2)   # like open() on the device: [Errno 2] ENOENT
    # The dispatcher returns:
    #   res.buf_arr : a JS Array of byte-sized ints (the RGB565 pixel
    #                 buffer, little-endian)
    #   res.w / res.h : image dimensions (JS Numbers)
    w = int(res.w)
    h = int(res.h)
    # Build a Canvas that carries the buffer as the original JS Array
    # proxy. blit() in the dispatcher checks for the .length attribute
    # and reads bytes by index, so it accepts either a Python bytearray
    # OR a JS Array proxy. Keeping the JS Array avoids a full O(n)
    # bytearray copy at load time for large images.
    c = Canvas(w, h, None, transparent=transparent)
    c.buf = res.buf_arr
    return c

def show(canvas, x=0, y=0):
    # If the user is showing the same canvas that they've set as the
    # sprite background AND there are visible sprites, re-render the
    # full sprite stack instead. This matches the student's mental
    # model ("show the canvas, with the sprites on top") and is what
    # the real device does too. Without this, a Canvas anlegen / Bild
    # auf Canvas / Canvas zeigen sequence would erase any visible
    # sprites with the bare background.
    if (x == 0 and y == 0 and
        canvas is Sprite._background and
        Sprite._visible):
        _sprites_jetzt(immer=True)
        return
    _sprites_jetzt()
    # same check as the device's display.blit
    x, y = _gint(x), _gint(y)
    if (x < 0 or y < 0 or x + canvas.width > WIDTH or
            y + canvas.height > HEIGHT):
        raise ValueError("blit region out of bounds")
    _show_raw(canvas, x, y)

def _show_raw(canvas, x=0, y=0):
    key = getattr(canvas, 'transparent', None)
    # Fast path: if a full-canvas image was stamped onto this canvas,
    # its JS Array is cached (and the bytearray buf was NOT written,
    # to save time). Blit straight from that JS Array via the
    # dispatcher, which can subscript a real JS Array.
    cache = getattr(canvas, '_js_arr_cache', None)
    if cache is not None:
        cache_key = getattr(canvas, '_js_arr_cache_key', None)
        _d.blit(cache, x, y, canvas.width, canvas.height, cache_key)
        return
    # One bulk blit: a bytearray buf goes over as its cached JS
    # Uint8Array copy (see Canvas._js_buf), a JS Array from
    # load_image_blob as is. (Not a str: MicroPython.wasm hands strings
    # to JS null-terminated, so a black pixel would truncate it.)
    _d.blit(canvas._js_buf(), x, y, canvas.width, canvas.height, key)

# ---- Sprite -----------------------------------------------------
# Minimal port of the on-device Sprite class. The IDE's "Testen"
# prelude touches pbc.Sprite._visible and pbc.Sprite._background to
# wipe any leftover state between runs, so this MUST exist as an
# attribute even if no student code uses it.

_sprite_backbuf = None

# Sprites are drawn together, as on the device (firmware pbc.py): a move
# only notes that the screen is out of date. The redraw follows when the
# program waits (delay, time.sleep, input), draws on the screen itself,
# shows a canvas or ends -- or when the same sprite moves again, so a
# game loop gets one frame per round however many sprites move in it.
# (The device also redraws 5 ms after a move by timer; here the worker's
# waits and the end of the run do that.)
_sprites_offen = False
_bewegt = []

def _sprites_spaeter(sprite):
    global _sprites_offen
    for s in _bewegt:
        if s is sprite:
            _sprites_jetzt()
            break
    _bewegt.append(sprite)
    _sprites_offen = True

def _sprites_jetzt(immer=False):
    global _sprites_offen
    if _sprites_offen or immer:
        _sprites_offen = False
        _bewegt.clear()
        _redraw_sprites()

def _redraw_sprites():
    # Fast path: do the whole composite directly into the JS-side
    # framebuffer, bypassing the Python-side _sprite_backbuf entirely.
    # The Python loop in Canvas.blit is ~67 000 byte-by-byte iterations
    # per frame, which on MicroPython.wasm would make glide_to take
    # multiple seconds per step (and look visibly black between frames).
    _d.composite_clear()
    bg = Sprite._background
    if bg is not None:
        _composite_canvas(bg, 0, 0)
    for s in Sprite._visible:
        _composite_canvas(s.image, int(s.x), int(s.y))
    _d.composite_finalize()

def _composite_canvas(canvas, x, y):
    """Blit a Canvas (image or user canvas) into emu.fb via the JS
    composite_blit_* helpers."""
    # Fast path: this canvas was filled by a single full-image blit and
    # still has the source's JS Array cached. Use it directly -- one JS
    # call, no Python streaming.
    cache = getattr(canvas, '_js_arr_cache', None)
    if cache is not None:
        cache_key = getattr(canvas, '_js_arr_cache_key', None)
        _d.composite_blit_arr(cache, canvas.width, canvas.height,
                              x, y, cache_key)
        return
    # Bytearray canvases (drawn from Python) go over as their cached
    # JS Uint8Array copy, JS Arrays from load_image_blob as is.
    _d.composite_blit_arr(canvas._js_buf(), canvas.width, canvas.height,
                          x, y, canvas.transparent)

class Sprite:
    _visible = []
    _background = None

    def __init__(self, image):
        self.image = image
        self.x = 0
        self.y = 0
        self._shown = False
        self.width  = image.width
        self.height = image.height
        # Plain attributes instead of @property -- some MicroPython
        # builds (notably the minimal/pyscript ones) ship without
        # the property builtin, and a class body that uses property
        # decorators then fails to import.

    def show(self):
        _sprites_spaeter(self)
        if not self._shown:
            Sprite._visible.append(self)
            self._shown = True

    def hide(self):
        _sprites_spaeter(self)
        if self._shown:
            try: Sprite._visible.remove(self)
            except ValueError: pass
            self._shown = False

    def set_to(self, x, y):
        _sprites_spaeter(self)
        self.x = int(x); self.y = int(y)

    def set_by(self, dx, dy):
        _sprites_spaeter(self)
        self.x += int(dx); self.y += int(dy)

    def glide_to(self, x, y, ms):
        x = _gint(x); y = _gint(y); ms = _gint(ms)
        if ms <= 0:
            self.set_to(x, y); return
        _sprites_jetzt()
        sx, sy = self.x, self.y
        dx, dy = x - sx, y - sy
        steps = max(1, ms // 16)
        # one step per display frame (16 ms)
        import js as __js
        for i in range(1, steps + 1):
            t = i / steps
            self.x = int(sx + dx * t)
            self.y = int(sy + dy * t)
            _redraw_sprites()
            __js.globalThis.__pbc.sleep_ms(16)

    def glide_by(self, dx, dy, ms):
        self.glide_to(self.x + int(dx), self.y + int(dy), ms)

    def touches(self, other):
        return (self.x < other.x + other.image.width  and
                self.x + self.image.width  > other.x  and
                self.y < other.y + other.image.height and
                self.y + self.image.height > other.y)

    def touches_edge(self):
        return (self.x < 0 or self.y < 0 or
                self.x + self.image.width  > WIDTH or
                self.y + self.image.height > HEIGHT)

    def on_color(self, color):
        """True if any opaque pixel of this sprite sits over color on
        the background canvas (Sprite._background). Same algorithm as
        the device's pbc.py, so both agree pixel for pixel."""
        bg = Sprite._background
        if bg is None:
            return False
        color = int(color) & 0xFFFF
        img = self.image
        key = img.transparent
        sx = int(self.x); sy = int(self.y)
        bw = bg.width; bh = bg.height
        for yy in range(img.height):
            by = sy + yy
            if by < 0 or by >= bh:
                continue
            for xx in range(img.width):
                bx = sx + xx
                if bx < 0 or bx >= bw:
                    continue
                if key is not None and img.pixel(xx, yy) == key:
                    continue  # skip transparent part of the sprite
                if bg.pixel(bx, by) == color:
                    return True
        return False

# Convenience factory, as on the device.
def sprite(path):
    img = load_image(path)
    return Sprite(img)
