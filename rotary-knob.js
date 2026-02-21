// rotary-knob.js — Rotary volume knob with iOS-style momentum

class RotaryKnob {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ volume?: number, onChange?: (v: number) => void }} opts
   */
  constructor(canvas, { volume = 0, onChange } = {}) {
    this.canvas   = canvas;
    this.ctx      = canvas.getContext('2d');
    this.onChange = onChange || null;

    // Geometry: 270° sweep, 7:30 o'clock (bottom-left) → 4:30 o'clock (bottom-right)
    this.START = 3 * Math.PI / 4;  // canvas angle at volume 0
    this.SWEEP = 3 * Math.PI / 2;  // 270° total

    // Volume (float for smooth momentum, rounds when emitting)
    this._vol = Math.max(0, Math.min(100, volume));

    // Drag state
    this._drag    = false;
    this._lastAng = 0;
    this._lastT   = 0;
    this._samples = [];   // recent {d, dt} for velocity calc

    // Momentum state
    this._rafId = null;
    this._vel   = 0;  // radians / ms

    // Emit debounce
    this._emitTimer = null;
    this._lastEmit  = -1;

    // Scale canvas for device pixel ratio
    const dpr  = window.devicePixelRatio || 1;
    const size = 80;
    canvas.width  = size * dpr;
    canvas.height = size * dpr;
    this.ctx.scale(dpr, dpr);
    this._s = size;

    canvas.style.touchAction = 'none';

    canvas.addEventListener('pointerdown',   e => this._down(e));
    canvas.addEventListener('pointermove',   e => this._move(e));
    canvas.addEventListener('pointerup',     e => this._up(e));
    canvas.addEventListener('pointercancel', e => this._up(e));

    this._draw();
  }

  // ── Public API ───────────────────────────────────────────────────

  get volume() { return Math.round(this._vol); }

  /** Sync from external source (SSE). Won't interrupt active drag or spin. */
  setVolume(v) {
    if (this._drag || this._rafId) return;
    this._vol = Math.max(0, Math.min(100, v));
    this._draw();
  }

  // ── Pointer helpers ──────────────────────────────────────────────

  _ang(e) {
    const r  = this.canvas.getBoundingClientRect();
    const cx = r.left + r.width  / 2;
    const cy = r.top  + r.height / 2;
    return Math.atan2(e.clientY - cy, e.clientX - cx);
  }

  // ── Event handlers ───────────────────────────────────────────────

  _down(e) {
    e.preventDefault();

    // Tap while spinning → stop
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
      this._vel   = 0;
      return;
    }

    this.canvas.setPointerCapture(e.pointerId);
    this._drag    = true;
    this._lastAng = this._ang(e);
    this._lastT   = performance.now();
    this._samples = [];
  }

  _move(e) {
    if (!this._drag) return;
    e.preventDefault();

    const now = performance.now();
    const ang = this._ang(e);

    // Angular delta with wrap-around handling
    let d = ang - this._lastAng;
    if (d >  Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;

    const dt = now - this._lastT;
    if (dt > 0) {
      this._samples.push({ d, dt });
      if (this._samples.length > 6) this._samples.shift();
    }

    this._lastAng = ang;
    this._lastT   = now;
    this._apply(d);
  }

  _up(e) {
    if (!this._drag) return;
    this._drag = false;

    // Average velocity from recent samples
    if (this._samples.length) {
      const sumD  = this._samples.reduce((s, x) => s + x.d,  0);
      const sumDt = this._samples.reduce((s, x) => s + x.dt, 0);
      this._vel   = sumDt > 0 ? sumD / sumDt : 0;
    }

    if (Math.abs(this._vel) > 0.0003) {
      this._coast();
    } else {
      // Flush any pending emit on release
      clearTimeout(this._emitTimer);
      this._emit();
    }
  }

  // ── Core helpers ─────────────────────────────────────────────────

  _apply(dAngle) {
    const dVol = (dAngle / this.SWEEP) * 100;
    this._vol  = Math.max(0, Math.min(100, this._vol + dVol));
    this._draw();
    this._schedEmit();
  }

  _schedEmit() {
    clearTimeout(this._emitTimer);
    this._emitTimer = setTimeout(() => this._emit(), 80);
  }

  _emit() {
    const v = Math.round(this._vol);
    if (v !== this._lastEmit && this.onChange) {
      this._lastEmit = v;
      this.onChange(v);
    }
  }

  // ── Momentum / coast ─────────────────────────────────────────────

  _coast() {
    const FRAME = 1000 / 60;
    const FRIC  = 0.96;      // velocity multiplier per frame @ 60 fps
    const STOP  = 0.00008;   // rad/ms — minimum to keep going

    let lastT = performance.now();

    const tick = now => {
      const dt   = now - lastT;
      lastT      = now;

      const d    = this._vel * dt;
      const newV = this._vol + (d / this.SWEEP) * 100;

      // Hit a wall — stop
      if (newV <= 0 || newV >= 100) {
        this._vol   = Math.max(0, Math.min(100, newV));
        this._vel   = 0;
        this._rafId = null;
        this._draw();
        this._emit();
        return;
      }

      this._vol = newV;
      this._draw();
      this._schedEmit();

      // Apply friction (dt-normalised so speed feels consistent at any frame rate)
      this._vel *= Math.pow(FRIC, dt / FRAME);

      if (Math.abs(this._vel) < STOP) {
        this._vel   = 0;
        this._rafId = null;
        clearTimeout(this._emitTimer);
        this._emit();
        return;
      }

      this._rafId = requestAnimationFrame(tick);
    };

    this._rafId = requestAnimationFrame(tick);
  }

  // ── Drawing ──────────────────────────────────────────────────────

  _draw() {
    const ctx = this.ctx;
    const S   = this._s;
    const cx  = S / 2;
    const cy  = S / 2;
    const R   = S / 2 - 4;

    ctx.clearRect(0, 0, S, S);

    const a0   = this.START;
    const a1   = a0 + this.SWEEP;
    const aCur = a0 + (this._vol / 100) * this.SWEEP;

    // Background track
    ctx.beginPath();
    ctx.arc(cx, cy, R - 6, a0, a1, false);
    ctx.strokeStyle = '#1e2d4a';
    ctx.lineWidth   = 5;
    ctx.lineCap     = 'round';
    ctx.stroke();

    // Volume fill
    if (this._vol > 0.5) {
      ctx.beginPath();
      ctx.arc(cx, cy, R - 6, a0, aCur, false);
      ctx.strokeStyle = '#4a90d9';
      ctx.lineWidth   = 5;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }

    // Knob body — radial gradient for slight 3-D feel
    const grad = ctx.createRadialGradient(cx - R * 0.25, cy - R * 0.25, 1, cx, cy, R - 11);
    grad.addColorStop(0, '#2a3a5c');
    grad.addColorStop(1, '#16213e');
    ctx.beginPath();
    ctx.arc(cx, cy, R - 11, 0, 2 * Math.PI);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#2a3a5c';
    ctx.lineWidth   = 1.5;
    ctx.stroke();

    // Indicator dot
    const dotR = R - 18;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(aCur) * dotR, cy + Math.sin(aCur) * dotR, 3, 0, 2 * Math.PI);
    ctx.fillStyle = '#4a90d9';
    ctx.fill();

    // Volume number in centre
    ctx.font         = `700 ${Math.round(S * 0.22)}px -apple-system, BlinkMacSystemFont, sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#e2e8f0';
    ctx.fillText(Math.round(this._vol), cx, cy);

    // Min / max tick marks
    for (const a of [a0, a1]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (R + 1), cy + Math.sin(a) * (R + 1));
      ctx.lineTo(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4));
      ctx.strokeStyle = '#475569';
      ctx.lineWidth   = 2;
      ctx.lineCap     = 'round';
      ctx.stroke();
    }
  }
}
