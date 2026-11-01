// Display operations of the emulated PicoBoy, used by the worker
// (src/worker/w0_kern.js). They draw into emu.fb (Uint16Array, RGB565,
// emu.W x emu.H) and report through emuMark / emuFlushArea / emuFlushAll
// / emuFlushDirtySync / emuFillRect / emuCharge, which the worker defines.
function pbcAnzeigeOps() {
  return {
    // Display ops -- all coordinates and colours match pbc.py.
    fill: (c) => {
      for (let i = 0; i < emu.fb.length; i++) emu.fb[i] = c & 0xffff;
      emuFlushAll();
      emuCharge(emu.W * emu.H);
    },
    pixel: (x, y, c) => {
      x = x|0; y = y|0;
      if (x<0||y<0||x>=emu.W||y>=emu.H) return;
      emu.fb[y*emu.W+x] = c & 0xffff;
      emuFlushArea(x, y, 1, 1);
      emuCharge(1);
    },
    fill_rect: (x, y, w, h, c) => {
      emuFillRect(x|0, y|0, w|0, h|0, c & 0xffff);
      emuCharge(Math.max(0, (w|0) * (h|0)));
    },
    rect: (x, y, w, h, c) => {
      x=x|0; y=y|0; w=w|0; h=h|0;
      emuFillRect(x, y, w, 1, c);
      emuFillRect(x, y+h-1, w, 1, c);
      emuFillRect(x, y, 1, h, c);
      emuFillRect(x+w-1, y, 1, h, c);
      emuCharge(2*w + 2*Math.max(0, h-2));
    },
    hline: (x, y, w, c) => {
      emuFillRect(x|0, y|0, w|0, 1, c);
      emuCharge(Math.max(0, w|0));
    },
    vline: (x, y, h, c) => {
      emuFillRect(x|0, y|0, 1, h|0, c);
      emuCharge(Math.max(0, h|0));
    },
    line: (x0, y0, x1, y1, c) => {
      x0=x0|0; y0=y0|0; x1=x1|0; y1=y1|0;
      // Remember the line's bounding box for the dirty mark at the end.
      // Bresenham touches every pixel inside this rect at most once, so
      // the per-pixel inner loop stays tight.
      const bx = Math.min(x0, x1), by = Math.min(y0, y1);
      const bw = Math.abs(x1 - x0) + 1, bh = Math.abs(y1 - y0) + 1;
      const dx = Math.abs(x1-x0), sx = x0<x1?1:-1;
      const dy = -Math.abs(y1-y0), sy = y0<y1?1:-1;
      let err = dx+dy;
      let count = 0;
      while (true) {
        if (x0>=0 && y0>=0 && x0<emu.W && y0<emu.H) {
          emu.fb[y0*emu.W+x0] = c & 0xffff;
        }
        count++;
        if (x0===x1 && y0===y1) break;
        const e2 = 2*err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
      emuMark(bx, by, bw, bh);
      emuCharge(count);
    },
    ellipse: (cx, cy, rx, ry, c, fill) => {
      cx=cx|0; cy=cy|0; rx=rx|0; ry=ry|0;
      const rxry = rx*rx*ry*ry;
      const ry2 = ry*ry, rx2 = rx*rx;
      let count = 0;
      for (let y=-ry; y<=ry; y++) {
        const yry2 = y*y*rx2;
        const yry2_up = (y-1)*(y-1)*rx2;
        const yry2_dn = (y+1)*(y+1)*rx2;
        for (let x=-rx; x<=rx; x++) {
          const xry2 = x*x*ry2;
          if (xry2 + yry2 > rxry) continue;
          if (!fill) {
            const onEdge =
              ((x+1)*(x+1)*ry2 + yry2) > rxry ||
              ((x-1)*(x-1)*ry2 + yry2) > rxry ||
              (xry2 + yry2_dn) > rxry ||
              (xry2 + yry2_up) > rxry;
            if (!onEdge) continue;
          }
          const px=cx+x, py=cy+y;
          if (px>=0 && py>=0 && px<emu.W && py<emu.H) {
            emu.fb[py*emu.W+px] = c & 0xffff;
            count++;
          }
        }
      }
      emuMark(cx-rx, cy-ry, rx*2+1, ry*2+1);
      emuCharge(count);
    },
    // Polygon. coords is a flat JS array [x0,y0, x1,y1, ...] of points
    // RELATIVE to (ox, oy) -- same convention as the device's
    // framebuf.poly. Outline connects consecutive points and closes
    // back to the first; fill=true fills the interior via scanline.
    poly: (ox, oy, coords, c, fill) => {
      ox=ox|0; oy=oy|0; c=c&0xffff;
      const n = (coords && coords.length ? coords.length : 0) >> 1; // #points
      if (n < 2) return;
      // Absolute points.
      const px = new Array(n), py = new Array(n);
      let minx=1e9, miny=1e9, maxx=-1e9, maxy=-1e9;
      for (let i=0; i<n; i++) {
        const x = ox + (coords[2*i]|0), y = oy + (coords[2*i+1]|0);
        px[i]=x; py[i]=y;
        if (x<minx)minx=x; if (x>maxx)maxx=x;
        if (y<miny)miny=y; if (y>maxy)maxy=y;
      }
      const setpx = (x,y) => {
        if (x>=0 && y>=0 && x<emu.W && y<emu.H) emu.fb[y*emu.W+x]=c;
      };
      let charged = 0;
      if (fill) {
        // Scanline polygon fill. For each y, find edge crossings and fill
        // between pairs. Standard even-odd rule.
        const ylo = Math.max(0, miny|0), yhi = Math.min(emu.H-1, maxy|0);
        for (let y=ylo; y<=yhi; y++) {
          const xs = [];
          for (let i=0; i<n; i++) {
            const j = (i+1)%n;
            let ya=py[i], yb=py[j], xa=px[i], xb=px[j];
            if (ya===yb) continue;
            if ((y>=ya && y<yb) || (y>=yb && y<ya)) {
              const x = xa + (y-ya)*(xb-xa)/(yb-ya);
              xs.push(x);
            }
          }
          xs.sort((a,b)=>a-b);
          for (let k=0; k+1<xs.length; k+=2) {
            const x0 = Math.max(0, Math.ceil(xs[k]));
            const x1 = Math.min(emu.W-1, Math.floor(xs[k+1]));
            for (let x=x0; x<=x1; x++) { setpx(x,y); charged++; }
          }
        }
      } else {
        // Outline: Bresenham line between each consecutive point, closed.
        const drawLine = (x0,y0,x1,y1) => {
          let dx=Math.abs(x1-x0), sx=x0<x1?1:-1;
          let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
          let err=dx+dy;
          while (true) {
            setpx(x0,y0); charged++;
            if (x0===x1 && y0===y1) break;
            const e2=2*err;
            if (e2>=dy){ err+=dy; x0+=sx; }
            if (e2<=dx){ err+=dx; y0+=sy; }
          }
        };
        for (let i=0; i<n; i++) {
          const j=(i+1)%n;
          drawLine(px[i],py[i], px[j],py[j]);
        }
      }
      emuMark(minx, miny, (maxx-minx)+1, (maxy-miny)+1);
      emuCharge(charged);
    },
    // 8x8 font -- the device's pbc.text() (petme128 glyphs from
    // pbcText8Pixels). Signature matches the device:
    // text(s, x, y, color) -- no bg parameter.
    text: (s, x, y, c) => {
      x=x|0; y=y|0;
      s = '' + s;
      const w = Math.max(1, new TextEncoder().encode(s).length * 8), h = 8;
      const pts = pbcText8Pixels(s, 63);    // '?' like the display driver
      for (let i = 0; i < pts.length; i += 2) {
        const px = x + pts[i], py = y + pts[i + 1];
        if (px>=0 && py>=0 && px<emu.W && py<emu.H) {
          emu.fb[py*emu.W+px] = c & 0xffff;
        }
      }
      emuFlushArea(Math.max(0,x), Math.max(0,y),
                   Math.min(w, emu.W - Math.max(0,x)),
                   Math.min(h, emu.H - Math.max(0,y)));
      emuCharge(w * h);
    },
    // Glyph pixel offsets of the 8x8 font for Canvas.text() (same flat
    // [dx0,dy0,...] form as text_pixels).
    text8_pixels: (s) => pbcText8Pixels('' + s, 127),   // like framebuf
    // Text rendering: very basic 8x12 monospace. Each char is a 8x12
    // bitmap synthesised from the system font via an offscreen canvas.
    // text12 / text18 / text24 now render with the EXACT device font
    // tables (see PBC_FONT above) instead of a browser sans-serif
    // approximation, so glyph shapes and widths match the real PBC+.
    text12: (s, x, y, c, bg) => pbcDrawTextDisplay(12, '' + s, x, y, c, bg),
    // Flat [dx0,dy0,...] foreground-pixel offsets for the Canvas path.
    text_pixels: (s) => pbcTextPixels(12, '' + s),
    // Pixel width of a string (pbc.text12_width etc.).
    text_width: (size, s) => pbcFontWidth(size, '' + s),
    // text18: same proportional font, 18-px cell.
    text18: (s, x, y, c, bg) => pbcDrawTextDisplay(18, '' + s, x, y, c, bg),
    // Glyph pixel offsets for text18 on a Canvas (see text_pixels).
    text18_pixels: (s) => pbcTextPixels(18, '' + s),
    // text24: same proportional font, 32-px cell.
    text24: (s, x, y, c, bg) => pbcDrawTextDisplay(24, '' + s, x, y, c, bg),
    // Glyph pixel offsets for text24 on a Canvas (see text_pixels).
    text24_pixels: (s) => pbcTextPixels(24, '' + s),
    blit: (bufView, x, y, w, h, key) => {
      x=x|0; y=y|0; w=w|0; h=h|0;
      // bufView may arrive as a JS Array (load_image_blob built it)
      // or a JS Uint8Array (typed array). Python bytearrays do NOT
      // pass through here -- blit_row is used for those, because
      // accessing JsProxy-wrapped Python bytearrays from JS throws.
      let n = 0;
      try { n = (bufView.length | 0) || (bufView.byteLength | 0); }
      catch (_) { /* shouldn't happen for JS arrays */ }
      if (n === 0) n = (w * h * 2) | 0;
      const has_key = (key !== null && key !== undefined);
      const keyVal = (key & 0xffff);
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const off = (row*w + col) * 2;
          if (off + 1 >= n) continue;
          const lo = bufView[off] & 0xff;
          const hi = bufView[off + 1] & 0xff;
          const c = (hi << 8) | lo;
          if (has_key && c === keyVal) continue;
          const px = x + col, py = y + row;
          if (px>=0 && py>=0 && px<emu.W && py<emu.H) {
            emu.fb[py*emu.W+px] = c;
          }
        }
      }
      emuFlushArea(Math.max(0,x), Math.max(0,y),
                   Math.min(w, emu.W-x), Math.min(h, emu.H-y));
      emuCharge(w * h);
    },
    // Single-row blit. Python passes 2*w small ints as separate
    // arguments via the spread call below; this avoids JsProxy entirely
    // because JS sees primitive numbers.
    //
    // Actually we can't spread an unbounded list to JS args portably
    // either, so use blit_pixel for per-pixel writes from Python.
    // (Kept here for API stability; see blit_pixel for the working
    // path.)
    blit_row: (rowList, rowLen, x, y, key) => {
      // Best-effort: only works if rowList happens to expose array
      // semantics to JS (which it does NOT for Python lists in
      // MicroPython.wasm). Use blit_pixel from Python instead.
      x=x|0; y=y|0; rowLen=rowLen|0;
      const has_key = (key !== null && key !== undefined);
      const keyVal = (key & 0xffff);
      try {
        for (let col = 0; col < rowLen; col++) {
          const lo = rowList[col*2]     & 0xff;
          const hi = rowList[col*2 + 1] & 0xff;
          const c = (hi << 8) | lo;
          if (has_key && c === keyVal) continue;
          const px = x + col;
          if (px < 0 || px >= emu.W) continue;
          if (y < 0 || y >= emu.H) continue;
          emu.fb[y*emu.W + px] = c;
        }
      } catch (_) { /* see blit_pixel */ }
    },
    // Write one RGB565 pixel directly to the framebuffer. Python uses
    // this when its source is a bytearray (which can't be subscripted
    // from JS at all). One JS call per pixel is slow but it's the
    // only memory-safe option -- a 240x280 image is 67 200 calls,
    // which is fine for one-shot blits but discouraged in tight loops.
    blit_pixel: (x, y, c) => {
      x=x|0; y=y|0; c=c&0xffff;
      if (x < 0 || x >= emu.W || y < 0 || y >= emu.H) return;
      emu.fb[y*emu.W + x] = c;
    },
    blit_finalize: (x, y, w, h) => {
      x=x|0; y=y|0; w=w|0; h=h|0;
      emuFlushArea(Math.max(0,x), Math.max(0,y),
                   Math.min(w, emu.W-x), Math.min(h, emu.H-y));
      emuCharge(w * h);
    },
    // Fast path for Sprite._redraw_sprites: clears the framebuffer to
    // black (or skips that if there's a background queued via
    // composite_bg). Called once per frame; the per-pixel work is then
    // done in JS rather than Python, which would otherwise take
    // multiple seconds per frame on MicroPython.wasm.
    composite_clear: () => {
      emu.fb.fill(0x0000);
    },
    // Composite a JS-side image buffer (from load_image_blob, in
    // .buf_arr form) at (x, y) into emu.fb. Used by _redraw_sprites
    // for the background AND for each sprite. Honours an optional
    // colour-key for transparency.
    composite_blit_arr: (arr, w, h, x, y, key) => {
      w=w|0; h=h|0; x=x|0; y=y|0;
      const has_key = (key !== null && key !== undefined);
      const keyVal = (key & 0xffff);
      const arrLen = arr.length | 0;
      for (let row = 0; row < h; row++) {
        const py = y + row;
        if (py < 0 || py >= emu.H) continue;
        for (let col = 0; col < w; col++) {
          const px = x + col;
          if (px < 0 || px >= emu.W) continue;
          const off = (row * w + col) * 2;
          if (off + 1 >= arrLen) continue;
          const lo = arr[off] & 0xff;
          const hi = arr[off + 1] & 0xff;
          const c = (hi << 8) | lo;
          if (has_key && c === keyVal) continue;
          emu.fb[py * emu.W + px] = c;
        }
      }
    },
    // Same as composite_blit_arr but for a Python bytearray source.
    // Python streams the source row-by-row using composite_row to
    // avoid the JsProxy-cannot-be-subscripted issue. This is the
    // last-resort path used when the background canvas was painted
    // entirely in Python (rare in practice, but legal).
    composite_blit_pixel: (x, y, c) => {
      x=x|0; y=y|0; c=c&0xffff;
      if (x < 0 || x >= emu.W || y < 0 || y >= emu.H) return;
      emu.fb[y*emu.W + x] = c;
    },
    // After composite_clear + composite_blit_*, push to canvas in
    // one shot and charge the equivalent SPI time. Uses the SYNC
    // flush so glide loops (which call _redraw_sprites between
    // sleep_ms calls in sync Python code) actually see incremental
    // frames rather than a single end-of-program rAF.
    composite_finalize: () => {
      emuMark(0, 0, emu.W, emu.H);
      emuFlushDirtySync();
      emuCharge(emu.W * emu.H);
    },
    // Bulk pixel push for the turtle / partial-canvas path. Python
    // can't hand JS a typed array, a list, or even a bytes object
    // (JsProxy from MicroPython.wasm refuses subscript-read from JS
    // for any of them). What DOES cross cleanly is a Python str --
    // it arrives as a normal JS string with working .charCodeAt().
    // So we ship the dirty rect as a UCS-2 string: two bytes per
    // RGB565 pixel packed into one UTF-16 code unit, n code units
    // total. Reading it from JS is then a single charCodeAt() per
    // pixel and the whole rect is pushed in one function call.
    push_pixels_str: function(s, dstX, dstY, w, h) {
      dstX|=0; dstY|=0; w|=0; h|=0;
      const sLen = s.length;
      for (let row = 0; row < h; row++) {
        const py = dstY + row;
        if (py < 0 || py >= emu.H) continue;
        const srcRow = row * w;
        const dstRow = py * emu.W;
        for (let col = 0; col < w; col++) {
          const i = srcRow + col;
          if (i >= sLen) continue;
          const sx = dstX + col;
          if (sx < 0 || sx >= emu.W) continue;
          emu.fb[dstRow + sx] = s.charCodeAt(i);
        }
      }
      emuMark(dstX, dstY, w, h);
      emuFlushDirtySync();
      emuCharge(w * h);
    },
    // Like push_pixels_str but the string holds TWO Latin-1 chars per
    // pixel (low byte then high byte of the RGB565 value). This avoids
    // ever placing a UTF-16 surrogate code unit in the string, which
    // is what hangs MicroPython.wasm's str bridge.
    push_pixels_bytes: function(s, dstX, dstY, w, h) {
      dstX|=0; dstY|=0; w|=0; h|=0;
      const sLen = s.length;
      for (let row = 0; row < h; row++) {
        const py = dstY + row;
        if (py < 0 || py >= emu.H) continue;
        const srcRow = row * w * 2;
        const dstRow = py * emu.W;
        for (let col = 0; col < w; col++) {
          const i = srcRow + col * 2;
          if (i + 1 >= sLen) continue;
          const sx = dstX + col;
          if (sx < 0 || sx >= emu.W) continue;
          const lo = s.charCodeAt(i)     & 0xff;
          const hi = s.charCodeAt(i + 1) & 0xff;
          emu.fb[dstRow + sx] = (hi << 8) | lo;
        }
      }
      emuMark(dstX, dstY, w, h);
      emuFlushDirtySync();
      emuCharge(w * h);
    },
    // Fill the whole framebuffer with one RGB565 colour in a single
    // call. Used to clear the screen without streaming a full-canvas
    // pixel buffer across the JsProxy bridge (that bulk transfer is
    // pathologically slow / freezes MicroPython.wasm).
    clear_display: function(color) {
      emu.fb.fill(color & 0xffff);
      emuMark(0, 0, emu.W, emu.H);
      emuFlushDirtySync();
      emuCharge(emu.W * emu.H);
    },
  };
}
