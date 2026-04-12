// sliding-ruler-element.js — Web Component wrapper for SlidingRuler
// Usage: <sliding-ruler min="0" max="100" value="25" height="70"></sliding-ruler>

import { SlidingRuler } from './sliding-ruler.js';

class SlidingRulerElement extends HTMLElement {
  static get observedAttributes() {
    return ['min', 'max', 'value', 'height', 'visible-range',
            'bg-color', 'indicator-color', 'label-color'];
  }

  constructor() {
    super();
    this._ruler = null;
    this._shadow = this.attachShadow({ mode: 'open' });
    this._shadow.innerHTML = `
      <style>
        :host {
          display: block;
          width: 100%;
        }
        canvas {
          display: block;
          width: 100%;
        }
      </style>
      <canvas></canvas>
    `;
  }

  connectedCallback() {
    // Wait a frame so the element has layout dimensions
    requestAnimationFrame(() => this._init());
  }

  disconnectedCallback() {
    if (this._ruler) this._ruler.destroy();
    this._ruler = null;
  }

  _init() {
    const canvas = this._shadow.querySelector('canvas');
    const labels = this._parseLabels();

    this._ruler = new SlidingRuler(canvas, {
      min:            this._num('min', 0),
      max:            this._num('max', 100),
      value:          this._num('value', 0),
      height:         this._num('height', 70),
      visibleRange:   this._num('visible-range', 30),
      labels:         labels,
      bgColor:        this.getAttribute('bg-color')        || undefined,
      indicatorColor: this.getAttribute('indicator-color')  || undefined,
      labelColor:     this.getAttribute('label-color')      || undefined,
      onChange: (v) => {
        this.dispatchEvent(new CustomEvent('change', { detail: { value: v } }));
      }
    });
  }

  _num(attr, def) {
    const v = this.getAttribute(attr);
    return v != null ? Number(v) : def;
  }

  _parseLabels() {
    // Labels can be passed as a JSON attribute: labels='{"0":"Off","1":"Low"}'
    const raw = this.getAttribute('labels');
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      // Convert string keys to numbers
      const result = {};
      for (const [k, v] of Object.entries(obj)) result[Number(k)] = v;
      return result;
    } catch { return null; }
  }

  attributeChangedCallback(name, oldVal, newVal) {
    if (!this._ruler) return;
    if (name === 'value') {
      this._ruler.setValue(Number(newVal));
    }
    // For other attribute changes, re-init
    if (['min', 'max', 'height', 'visible-range'].includes(name)) {
      this._ruler.destroy();
      this._init();
    }
  }

  // Programmatic API
  get value() { return this._ruler?.getValue() ?? 0; }
  set value(v) { this._ruler?.setValue(v); }
}

customElements.define('sliding-ruler', SlidingRulerElement);

export { SlidingRulerElement };
