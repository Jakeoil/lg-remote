// sliding-ruler.js — Reusable horizontal sliding ruler control
// Canvas-based, touch-friendly. Drag to scrub, tap to nudge, double-tap center to jump to midpoint.
// Includes inertia coast with friction and snap-to-integer.

export class SlidingRuler {
  constructor(canvas, options = {}) {
    this._c   = canvas;
    this._ctx = canvas.getContext('2d');
    this._min = options.min ?? 0;
    this._max = options.max ?? 100;
    this._labels = options.labels || null; // {0:'Off', 1:'Low', ...}
    this._vol = Math.max(this._min, Math.min(this._max, options.value ?? options.volume ?? 0));
    this._onChange = options.onChange || (() => {});

    // Colors (all overridable)
    this._bgColor       = options.bgColor       ?? '#0d1826';
    this._indicatorColor = options.indicatorColor ?? '#4a90d9';
    this._majorTickColor = options.majorTickColor ?? '#4a6080';
    this._midTickColor   = options.midTickColor   ?? '#5a7a9a';
    this._minorTickColor = options.minorTickColor ?? '#3a5068';
    this._labelColor     = options.labelColor     ?? '#94a3b8';
    this._fadeColor      = options.fadeColor      ?? 'rgba(13,24,38,0.9)';

    const dpr  = window.devicePixelRatio || 1;
    const cssW = canvas.offsetWidth || options.width || 260;
    const cssH = options.height || 70;

    canvas.width  = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width  = cssW + 'px';
    canvas.style.height = cssH + 'px';
    this._ctx.scale(dpr, dpr);

    this._w   = cssW;
    this._h   = cssH;
    this._ppu = cssW / (options.visibleRange || 30); // pixels per unit

    // Interaction state
    this._dragging  = false;
    this._lastX     = 0;
    this._lastT     = 0;
    this._vel       = 0;
    this._raf       = null;
    this._vHist     = [];
    this._lastFired = null;
    this._downStartX = 0;
    this._lastTapTime = 0;

    canvas.style.touchAction = 'none';
    this._bind();
    this._draw();
  }

  // ── Public API ───────────────────────────────────────────────────

  /** Set value programmatically (ignored while user is dragging) */
  setValue(v) {
    if (this._dragging || this._raf) return;
    this._vol = Math.max(this._min, Math.min(this._max, v));
    this._draw();
  }

  /** Alias for backwards compat */
  setVolume(v) { this.setValue(v); }

  /** Get current value */
  getValue() { return Math.round(this._vol); }

  /** Destroy: remove listeners, cancel animation */
  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    this._c.removeEventListener('pointerdown',   this._downHandler);
    this._c.removeEventListener('pointermove',   this._moveHandler);
    this._c.removeEventListener('pointerup',     this._upHandler);
    this._c.removeEventListener('pointercancel', this._upHandler);
  }

  // ── Internals ────────────────────────────────────────────────────

  _bind() {
    const c = this._c;
    this._downHandler = e => this._down(e);
    this._moveHandler = e => this._move(e);
    this._upHandler   = e => this._up(e);
    c.addEventListener('pointerdown',   this._downHandler, { passive: false });
    c.addEventListener('pointermove',   this._moveHandler, { passive: false });
    c.addEventListener('pointerup',     this._upHandler);
    c.addEventListener('pointercancel', this._upHandler);
  }

  _down(e) {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      this._snap();
      return;
    }
    this._dragging  = true;
    this._downStartX = e.clientX;
    this._lastX    = e.clientX;
    this._lastT    = performance.now();
    this._vHist    = [];
    this._c.setPointerCapture(e.pointerId);
    e.preventDefault();
  }

  _move(e) {
    if (!this._dragging) return;
    const now = performance.now();
    const dx  = e.clientX - this._lastX;
    const dv  = -dx / this._ppu; // drag left = value up

    this._vHist.push({ v: dv / Math.max(now - this._lastT, 1) * 16, t: now });
    if (this._vHist.length > 6) this._vHist.shift();

    this._vol   = Math.max(this._min, Math.min(this._max, this._vol + dv));
    this._lastX = e.clientX;
    this._lastT = now;
    this._fireChange();
    this._draw();
    e.preventDefault();
  }

  _up(e) {
    if (!this._dragging) return;
    this._dragging = false;
    const now = performance.now();

    // Tap detection: pointer barely moved
    if (Math.abs(e.clientX - this._downStartX) < 5) {
      const rect = this._c.getBoundingClientRect();
      const tapX = e.clientX - rect.left;
      const cx = this._w / 2;
      const mid = (this._min + this._max) / 2;

      // Double-tap near centre -> jump to midpoint
      if (now - this._lastTapTime < 350 && Math.abs(tapX - cx) < this._w * 0.15) {
        this._lastTapTime = 0;
        this._vol = mid;
        this._fireChange();
        this._draw();
        return;
      }
      this._lastTapTime = now;

      // Single tap: right of hairline -> +1, left -> -1
      const delta = tapX > cx ? 1 : -1;
      this._vol = Math.max(this._min, Math.min(this._max, Math.round(this._vol) + delta));
      this._fireChange();
      this._draw();
      return;
    }

    this._lastTapTime = 0;
    const recent = this._vHist.filter(h => now - h.t < 120);
    this._vel = recent.length
      ? recent.reduce((s, h) => s + h.v, 0) / recent.length
      : 0;
    Math.abs(this._vel) > 0.05 ? this._coast() : this._snap();
  }

  _coast() {
    const FRIC = 0.93;
    const step = () => {
      this._vel *= FRIC;
      this._vol  = Math.max(this._min, Math.min(this._max, this._vol + this._vel));
      this._fireChange();
      this._draw();
      if (Math.abs(this._vel) < 0.02 || this._vol <= this._min || this._vol >= this._max) {
        this._raf = null;
        this._snap();
        return;
      }
      this._raf = requestAnimationFrame(step);
    };
    this._raf = requestAnimationFrame(step);
  }

  _snap() {
    this._vol = Math.round(this._vol);
    this._fireChange();
    this._draw();
  }

  _fireChange() {
    const v = Math.round(this._vol);
    if (v !== this._lastFired) {
      this._lastFired = v;
      this._onChange(v);
    }
  }

  _draw() {
    const ctx = this._ctx;
    const { _w: w, _h: h, _ppu: ppu, _vol: vol } = this;
    const cx = w / 2;
    const TRACK_Y = 0;
    const TRACK_H = h;
    const MID_Y   = TRACK_Y + TRACK_H / 2;

    ctx.clearRect(0, 0, w, h);

    // Track background
    ctx.fillStyle = this._bgColor;
    this._rrect(0, TRACK_Y, w, TRACK_H, 6);
    ctx.fill();

    // Tick marks
    const uMin = Math.floor(vol - w / ppu / 2) - 1;
    const uMax = Math.ceil (vol + w / ppu / 2) + 1;

    for (let u = uMin; u <= uMax; u++) {
      if (u < this._min || u > this._max) continue;
      const x = cx + (u - vol) * ppu;
      if (x < 0 || x > w) continue;
      const rx = Math.round(x);

      // Custom labels mode
      if (this._labels) {
        const label = this._labels[u];
        if (label !== undefined) {
          const labelSize = Math.round(TRACK_H * 0.38);
          ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
          ctx.fillStyle = this._majorTickColor;
          ctx.fillRect(rx - 0.75, TRACK_Y, 1.5, MID_Y - TRACK_Y - labelSize / 2 - 2);
          ctx.fillRect(rx - 0.75, MID_Y + labelSize / 2 + 2, 1.5, TRACK_Y + TRACK_H - (MID_Y + labelSize / 2 + 2));
          ctx.fillStyle = this._labelColor;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(label, rx, MID_Y);
          ctx.textBaseline = 'alphabetic';
        } else {
          const th = TRACK_H * 0.22;
          ctx.fillStyle = this._minorTickColor;
          ctx.fillRect(rx - 0.5, TRACK_Y + TRACK_H - th, 1, th);
        }
        continue;
      }

      if (u % 10 === 0) {
        const labelSize = Math.round(TRACK_H * 0.45);
        ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
        ctx.fillStyle = this._majorTickColor;
        ctx.fillRect(rx - 0.75, TRACK_Y, 1.5, MID_Y - TRACK_Y - labelSize / 2 - 2);
        ctx.fillRect(rx - 0.75, MID_Y + labelSize / 2 + 2, 1.5, TRACK_Y + TRACK_H - (MID_Y + labelSize / 2 + 2));
        ctx.fillStyle = this._labelColor;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(u), rx, MID_Y);
        ctx.textBaseline = 'alphabetic';
      } else if (u % 5 === 0) {
        const th = TRACK_H * 0.44;
        ctx.fillStyle = this._midTickColor;
        ctx.fillRect(rx - 0.75, TRACK_Y + TRACK_H - th, 1.5, th);
      } else {
        const th = TRACK_H * 0.22;
        ctx.fillStyle = this._minorTickColor;
        ctx.fillRect(rx - 0.5, TRACK_Y + TRACK_H - th, 1, th);
      }
    }

    // Edge fades
    const fw = w * 0.12;
    [[0, fw, true], [w - fw, fw, false]].forEach(([x, width, leftSide]) => {
      const g = ctx.createLinearGradient(x, 0, x + width, 0);
      g.addColorStop(leftSide ? 0 : 1, this._fadeColor);
      g.addColorStop(leftSide ? 1 : 0, 'rgba(13,24,38,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, TRACK_Y, width, TRACK_H);
    });

    // Centre indicator line
    ctx.save();
    ctx.shadowColor = this._indicatorColor;
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = this._indicatorColor;
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, TRACK_Y);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.restore();
  }

  _rrect(x, y, w, h, r) {
    const ctx = this._ctx;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y,     x + w, y + r,     r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x,      y + h, x,      y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x,      y,     x + r,  y,         r);
    ctx.closePath();
  }
}

// Also export as default for convenience
export default SlidingRuler;
