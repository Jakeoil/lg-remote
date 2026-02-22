// sliding-ruler.js — Horizontal sliding rule volume control
// Drag right = volume up. Full canvas width = 20 units of travel.

class SlidingRuler {
  constructor(canvas, options = {}) {
    this._c   = canvas;
    this._ctx = canvas.getContext('2d');
    this._vol = Math.max(0, Math.min(100, options.volume || 0));
    this._onChange = options.onChange || (() => {});

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
    this._ppu = cssW / 20; // pixels per unit (full width = 20 units)

    // Interaction state
    this._dragging  = false;
    this._lastX     = 0;
    this._lastT     = 0;
    this._vel       = 0;   // units/frame at 60fps
    this._raf       = null;
    this._vHist     = [];
    this._lastFired = null;

    canvas.style.touchAction = 'none';
    this._bind();
    this._draw();
  }

  _bind() {
    const c = this._c;
    c.addEventListener('pointerdown',   e => this._down(e), { passive: false });
    c.addEventListener('pointermove',   e => this._move(e), { passive: false });
    c.addEventListener('pointerup',     e => this._up(e));
    c.addEventListener('pointercancel', e => this._up(e));
  }

  _down(e) {
    if (this._raf) {
      cancelAnimationFrame(this._raf);
      this._raf = null;
      this._snap();
      return;
    }
    this._dragging = true;
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
    const dt  = Math.max(now - this._lastT, 1);
    const dv  = dx / this._ppu; // right = positive = volume up

    this._vHist.push({ v: dv / dt * 16, t: now }); // store units/frame
    if (this._vHist.length > 6) this._vHist.shift();

    this._vol   = Math.max(0, Math.min(100, this._vol + dv));
    this._lastX = e.clientX;
    this._lastT = now;
    this._fireChange();
    this._draw();
    e.preventDefault();
  }

  _up(e) {
    if (!this._dragging) return;
    this._dragging = false;
    const now    = performance.now();
    const recent = this._vHist.filter(h => now - h.t < 120);
    this._vel    = recent.length
      ? recent.reduce((s, h) => s + h.v, 0) / recent.length
      : 0;
    Math.abs(this._vel) > 0.05 ? this._coast() : this._snap();
  }

  _coast() {
    const FRIC = 0.93;
    const step = () => {
      this._vel *= FRIC;
      this._vol  = Math.max(0, Math.min(100, this._vol + this._vel));
      this._fireChange();
      this._draw();
      if (Math.abs(this._vel) < 0.02 || this._vol <= 0 || this._vol >= 100) {
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

  setVolume(v) {
    if (this._dragging || this._raf) return;
    this._vol = Math.max(0, Math.min(100, v));
    this._draw();
  }

  _draw() {
    const ctx = this._ctx;
    const { _w: w, _h: h, _ppu: ppu, _vol: vol } = this;
    const cx = w / 2;

    // Vertical layout — triangle sits above the track
    const TRI_H   = 9;
    const TRACK_Y = TRI_H + 2;
    const TRACK_H = h - TRACK_Y;
    const MID_Y   = TRACK_Y + TRACK_H / 2; // vertical centre of track

    ctx.clearRect(0, 0, w, h);

    // ── Track background ──────────────────────────────────────────
    ctx.fillStyle = '#0d1826';
    this._rrect(0, TRACK_Y, w, TRACK_H, 6);
    ctx.fill();

    // ── Tick marks ────────────────────────────────────────────────
    // Ruler is reversed: high numbers LEFT, low numbers RIGHT.
    // x = cx + (vol - u) * ppu  →  ruler follows the finger naturally.
    const uMin = Math.floor(vol - w / ppu / 2) - 1;
    const uMax = Math.ceil (vol + w / ppu / 2) + 1;

    for (let u = uMin; u <= uMax; u++) {
      if (u < 0 || u > 100) continue;
      const x = cx + (vol - u) * ppu; // reversed
      if (x < 0 || x > w) continue;

      const rx = Math.round(x);

      if (u % 10 === 0) {
        // Large label — about half the track height
        const labelSize = Math.round(TRACK_H * 0.48);
        ctx.font = `bold ${labelSize}px system-ui, sans-serif`;
        const label = String(u);
        const lw = ctx.measureText(label).width + 6;

        // Full-height line, split above and below the label
        ctx.fillStyle = '#2e4060';
        ctx.fillRect(rx - 0.75, TRACK_Y, 1.5, MID_Y - TRACK_Y - labelSize / 2 - 2);
        ctx.fillRect(rx - 0.75, MID_Y + labelSize / 2 + 2, 1.5, TRACK_Y + TRACK_H - (MID_Y + labelSize / 2 + 2));

        // Label centred vertically
        ctx.fillStyle = '#475569';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, rx, MID_Y);
        ctx.textBaseline = 'alphabetic';

      } else if (u % 5 === 0) {
        const th = TRACK_H * 0.44;
        ctx.fillStyle = '#3a4a60';
        ctx.fillRect(rx - 0.75, TRACK_Y + TRACK_H - th, 1.5, th);

      } else {
        const th = TRACK_H * 0.22;
        ctx.fillStyle = '#1e2d42';
        ctx.fillRect(rx - 0.5, TRACK_Y + TRACK_H - th, 1, th);
      }
    }

    // ── Edge fades ────────────────────────────────────────────────
    const fw = w * 0.12;
    [[0, fw, true], [w - fw, fw, false]].forEach(([x, width, leftSide]) => {
      const g = ctx.createLinearGradient(x, 0, x + width, 0);
      g.addColorStop(leftSide ? 0 : 1, 'rgba(13,24,38,0.9)');
      g.addColorStop(leftSide ? 1 : 0, 'rgba(13,24,38,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, TRACK_Y, width, TRACK_H);
    });

    // ── Centre indicator line (blue glow) ─────────────────────────
    ctx.save();
    ctx.shadowColor = '#4a90d9';
    ctx.shadowBlur  = 8;
    ctx.strokeStyle = '#4a90d9';
    ctx.lineWidth   = 1.5;
    ctx.beginPath();
    ctx.moveTo(cx, TRACK_Y);
    ctx.lineTo(cx, h);
    ctx.stroke();
    ctx.restore();

    // ── Triangle pointer above track ──────────────────────────────
    ctx.fillStyle = '#4a90d9';
    ctx.beginPath();
    ctx.moveTo(cx - TRI_H, 0);
    ctx.lineTo(cx + TRI_H, 0);
    ctx.lineTo(cx, TRACK_Y);
    ctx.closePath();
    ctx.fill();

    // ── Current volume value above the triangle ───────────────────
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(Math.round(vol)), cx, TRI_H - 1);
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
