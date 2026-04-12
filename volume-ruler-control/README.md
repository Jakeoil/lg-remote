# Sliding Ruler Control

A canvas-based horizontal sliding ruler, useful for volume, temperature, or any numeric input. Touch-friendly with inertia scrolling.

## Features

- **Drag** left/right to change value (inertia coast with friction)
- **Tap** left/right of center for +1/-1 nudge
- **Double-tap** center to jump to midpoint
- Snap to integer on release
- Custom labeled scales (e.g. "Off", "Low", "Max")
- HiDPI/Retina aware
- Fully customizable colors

## Files

| File | What it is |
|---|---|
| `sliding-ruler.js` | Core class — ES module, no dependencies |
| `sliding-ruler-element.js` | `<sliding-ruler>` web component wrapper |
| `example.html` | Working examples of both approaches |

## Quick Start

### Option A: Direct class

```html
<canvas id="my-ruler" style="width:100%; display:block"></canvas>
<script type="module">
  import { SlidingRuler } from './sliding-ruler.js';

  const ruler = new SlidingRuler(document.getElementById('my-ruler'), {
    min: 0,
    max: 100,
    value: 25,
    height: 70,          // CSS pixels
    visibleRange: 30,    // how many units visible at once
    onChange(value) {
      console.log('New value:', value);
    }
  });

  // Set value programmatically (ignored while user is dragging)
  ruler.setValue(50);
</script>
```

### Option B: Web Component

```html
<script type="module" src="sliding-ruler-element.js"></script>

<sliding-ruler
  min="0" max="100" value="25"
  height="70"
  visible-range="30"
  indicator-color="#e06040">
</sliding-ruler>

<script>
  document.querySelector('sliding-ruler')
    .addEventListener('change', e => {
      console.log('New value:', e.detail.value);
    });
</script>
```

## Options / Attributes

| Option (class) | Attribute (component) | Default | Description |
|---|---|---|---|
| `min` | `min` | `0` | Minimum value |
| `max` | `max` | `100` | Maximum value |
| `value` / `volume` | `value` | `0` | Initial value |
| `height` | `height` | `70` | Canvas height in CSS px |
| `visibleRange` | `visible-range` | `30` | Number of units visible |
| `labels` | `labels` (JSON) | `null` | Custom tick labels, e.g. `{0:'Off', 5:'Max'}` |
| `bgColor` | `bg-color` | `#0d1826` | Track background |
| `indicatorColor` | `indicator-color` | `#4a90d9` | Center line + glow |
| `labelColor` | `label-color` | `#94a3b8` | Number/label text |
| `onChange(v)` | `change` event | — | Fires on value change |

## Class API

```js
ruler.setValue(50)   // set value (no-op while dragging)
ruler.getValue()     // get current integer value
ruler.destroy()      // remove listeners, cancel animation
```

## Web Component API

```js
el.value = 50;       // set
console.log(el.value); // get
```

## Using in Another Project

Copy `sliding-ruler.js` (and optionally `sliding-ruler-element.js`) into your project. They are self-contained ES modules with zero dependencies.
