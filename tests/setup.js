// ─────────────────────────────────────────────────────────────────────────────
// tests/setup.js  —  Headless Mock Environment for Node.js Testing
// ─────────────────────────────────────────────────────────────────────────────

class MockImageData {
  constructor(widthOrData, heightOrWidth, maybeHeight) {
    if (widthOrData instanceof Uint8ClampedArray) {
      this.data = widthOrData;
      this.width = heightOrWidth;
      this.height = maybeHeight;
    } else {
      this.width = widthOrData;
      this.height = heightOrWidth;
      this.data = new Uint8ClampedArray(this.width * this.height * 4);
    }
  }
}

class MockContext2D {
  constructor(canvas) {
    this.canvas = canvas;
    this.globalAlpha = 1.0;
    this.globalCompositeOperation = 'source-over';
    this.fillStyle = '#000000';
    this.strokeStyle = '#000000';
    this.lineWidth = 1;
    this._stack = [];
  }

  save() {
    this._stack.push({
      globalAlpha: this.globalAlpha,
      globalCompositeOperation: this.globalCompositeOperation,
      fillStyle: this.fillStyle,
      strokeStyle: this.strokeStyle,
      lineWidth: this.lineWidth,
    });
  }

  restore() {
    const s = this._stack.pop();
    if (s) Object.assign(this, s);
  }

  translate() {}
  rotate() {}
  scale() {}
  beginPath() {}
  closePath() {}
  clip() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  stroke() {}
  fill() {}
  rect() {}
  roundRect() {}
  ellipse() {}
  strokeRect() {}
  setLineDash() {}
  measureText(text) { return { width: (text || '').length * 7 }; }
  createPattern(src, repeat) { return { src, repeat }; }
  fillText() {}
  strokeText() {}

  clearRect(x, y, w, h) {
    if (!this.canvas._buffer) return;
    const d = this.canvas._buffer;
    const cw = this.canvas.width;
    for (let row = y; row < y + h; row++) {
      for (let col = x; col < x + w; col++) {
        const idx = (row * cw + col) * 4;
        if (idx >= 0 && idx < d.length) {
          d[idx] = d[idx + 1] = d[idx + 2] = d[idx + 3] = 0;
        }
      }
    }
  }

  fillRect(x, y, w, h) {
    if (!this.canvas._buffer) this.canvas._buffer = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4);
    // Parse simple hex or fill
    let r = 0, g = 0, b = 0, a = 255;
    if (typeof this.fillStyle === 'string' && this.fillStyle.startsWith('#')) {
      const hex = this.fillStyle.slice(1);
      if (hex.length === 6) {
        r = parseInt(hex.slice(0, 2), 16);
        g = parseInt(hex.slice(2, 4), 16);
        b = parseInt(hex.slice(4, 6), 16);
      }
    }
    const d = this.canvas._buffer;
    const cw = this.canvas.width;
    for (let row = Math.max(0, y); row < Math.min(this.canvas.height, y + h); row++) {
      for (let col = Math.max(0, x); col < Math.min(this.canvas.width, x + w); col++) {
        const idx = (row * cw + col) * 4;
        if (idx >= 0 && idx < d.length) {
          d[idx] = r;
          d[idx + 1] = g;
          d[idx + 2] = b;
          d[idx + 3] = a;
        }
      }
    }
  }

  drawImage(src, sx, sy, sw, sh, dx, dy, dw, dh) {
    // Basic mock image draw
    if (src && src._buffer && this.canvas._buffer) {
      const srcBuf = src._buffer;
      const dstBuf = this.canvas._buffer;
      const len = Math.min(srcBuf.length, dstBuf.length);
      for (let i = 0; i < len; i++) {
        dstBuf[i] = srcBuf[i];
      }
    }
  }

  getImageData(x, y, w, h) {
    const data = new Uint8ClampedArray(w * h * 4);
    if (this.canvas._buffer) {
      const cw = this.canvas.width;
      for (let row = 0; row < h; row++) {
        for (let col = 0; col < w; col++) {
          const srcIdx = ((y + row) * cw + (x + col)) * 4;
          const dstIdx = (row * w + col) * 4;
          if (srcIdx >= 0 && srcIdx < this.canvas._buffer.length) {
            data[dstIdx]     = this.canvas._buffer[srcIdx];
            data[dstIdx + 1] = this.canvas._buffer[srcIdx + 1];
            data[dstIdx + 2] = this.canvas._buffer[srcIdx + 2];
            data[dstIdx + 3] = this.canvas._buffer[srcIdx + 3];
          }
        }
      }
    }
    return new MockImageData(data, w, h);
  }

  putImageData(imgData, x, y) {
    if (!this.canvas._buffer) this.canvas._buffer = new Uint8ClampedArray(this.canvas.width * this.canvas.height * 4);
    const d = this.canvas._buffer;
    const s = imgData.data;
    const cw = this.canvas.width;
    const w = imgData.width;
    const h = imgData.height;
    for (let row = 0; row < h; row++) {
      for (let col = 0; col < w; col++) {
        const srcIdx = (row * w + col) * 4;
        const dstIdx = ((y + row) * cw + (x + col)) * 4;
        if (dstIdx >= 0 && dstIdx < d.length) {
          d[dstIdx]     = s[srcIdx];
          d[dstIdx + 1] = s[srcIdx + 1];
          d[dstIdx + 2] = s[srcIdx + 2];
          d[dstIdx + 3] = s[srcIdx + 3];
        }
      }
    }
  }
}

class MockCanvas {
  constructor(w = 300, h = 150) {
    this._width = w;
    this._height = h;
    this._buffer = new Uint8ClampedArray(w * h * 4);
    this._ctx = null;
    this.style = {};
    this.classList = { add() {}, remove() {}, contains() { return false; } };
  }

  get width() { return this._width; }
  set width(v) {
    this._width = Math.max(1, Math.round(v));
    this._buffer = new Uint8ClampedArray(this._width * this._height * 4);
  }

  get height() { return this._height; }
  set height(v) {
    this._height = Math.max(1, Math.round(v));
    this._buffer = new Uint8ClampedArray(this._width * this._height * 4);
  }

  getContext(type) {
    if (type === '2d') {
      if (!this._ctx) this._ctx = new MockContext2D(this);
      return this._ctx;
    }
    return null;
  }

  toDataURL(type = 'image/png') {
    return `data:${type};base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }

  addEventListener() {}
  removeEventListener() {}
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.children = [];
    this.dataset = {};
    this.classList = {
      _classes: new Set(),
      add(c) { this._classes.add(c); },
      remove(c) { this._classes.delete(c); },
      contains(c) { return this._classes.has(c); },
      toggle(c) { if (this._classes.has(c)) this._classes.delete(c); else this._classes.add(c); }
    };
    this.clientWidth = 1280;
    this.clientHeight = 800;
  }

  appendChild(child) { this.children.push(child); return child; }
  removeChild(child) { this.children = this.children.filter(c => c !== child); return child; }
  querySelector() { return new MockElement('div'); }
  querySelectorAll() { return []; }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
  }
}

// Polyfill globals for Node.js
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = MockImageData;
}

if (typeof globalThis.document === 'undefined') {
  globalThis.document = {
    createElement(tagName) {
      if (tagName.toLowerCase() === 'canvas') return new MockCanvas(300, 150);
      return new MockElement(tagName);
    },
    getElementById(id) {
      if (id.includes('canvas') || id.includes('ruler')) return new MockCanvas(800, 600);
      return new MockElement('div');
    },
    querySelector() { return new MockElement('div'); },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
  };
}

if (typeof globalThis.window === 'undefined') {
  globalThis.window = {
    innerWidth: 1280,
    innerHeight: 800,
    addEventListener() {},
    removeEventListener() {},
    api: null,
  };
}

if (typeof globalThis.localStorage === 'undefined') {
  const _store = new Map();
  globalThis.localStorage = {
    getItem(k) { return _store.get(k) ?? null; },
    setItem(k, v) { _store.set(k, String(v)); },
    removeItem(k) { _store.delete(k); },
    clear() { _store.clear(); }
  };
}

export { MockCanvas, MockContext2D, MockImageData, MockElement };
