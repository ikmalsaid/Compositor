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
  createLinearGradient(x0, y0, x1, y1) {
    return {
      addColorStop(offset, color) {},
    };
  }
  createRadialGradient(x0, y0, r0, x1, y1, r1) {
    return {
      addColorStop(offset, color) {},
    };
  }
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
    this._width = Math.max(1, Math.round(w));
    this._height = Math.max(1, Math.round(h));
    this._buffer = null;
    this._ctx = null;
    this.style = {};
    this.dataset = {};
    this.setPointerCapture = () => {};
    this.classList = { add() {}, remove() {}, contains() { return false; } };
  }

  get width() { return this._width; }
  set width(v) {
    this._width = Math.max(1, Math.round(v));
    this._buffer = null;
  }

  get height() { return this._height; }
  set height(v) {
    this._height = Math.max(1, Math.round(v));
    this._buffer = null;
  }

  getContext(type) {
    if (type === '2d') {
      if (!this._buffer) this._buffer = new Uint8ClampedArray(this.width * this.height * 4);
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
  querySelector() { return new MockElement('div'); }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: this._width, height: this._height, right: this._width, bottom: this._height };
  }
}

class MockElement {
  constructor(tagName = 'div') {
    this.tagName = tagName.toUpperCase();
    this.style = {};
    this.children = [];
    this.parentNode = null;
    this.dataset = {};
    this.id = '';
    this.className = '';
    this._listeners = {};
    this._innerHTML = '';
    this.classList = {
      _classes: new Set(),
      add: (...cls) => cls.forEach(c => this.classList._classes.add(c)),
      remove: (...cls) => cls.forEach(c => this.classList._classes.delete(c)),
      contains: (c) => this.classList._classes.has(c),
      toggle: (c) => { if (this.classList._classes.has(c)) this.classList._classes.delete(c); else this.classList._classes.add(c); }
    };
    this.clientWidth = 1280;
    this.clientHeight = 800;
  }

  get innerHTML() {
    return this._innerHTML;
  }

  set innerHTML(val) {
    this._innerHTML = String(val);
    this.children = [];
    const tagMatches = String(val).matchAll(/<([a-zA-Z0-9\-]+)([^>]*)>(.*?)<\/\1>|<([a-zA-Z0-9\-]+)([^>]*)\/?>/gs);
    for (const match of tagMatches) {
      const tag = match[1] || match[4];
      const attrs = match[2] || match[5] || '';
      const text = match[3] || '';
      const child = new MockElement(tag);
      const idM = attrs.match(/id=["']([^"']+)["']/);
      if (idM) child.id = idM[1];
      const classM = attrs.match(/class=["']([^"']+)["']/);
      if (classM) {
        child.className = classM[1];
        classM[1].split(/\s+/).filter(Boolean).forEach(c => child.classList.add(c));
      }
      child.textContent = text.replace(/<[^>]+>/g, '').trim();
      if (text.includes('<')) {
        child.innerHTML = text;
      } else {
        child._innerHTML = text;
      }
      this.appendChild(child);
    }
  }

  get textContent() {
    if (this.children.length === 0) return this._innerHTML ? this._innerHTML.replace(/<[^>]+>/g, '') : '';
    return this.children.map(c => c.textContent).join(' ') + ' ' + (this._innerHTML ? this._innerHTML.replace(/<[^>]+>/g, '') : '');
  }

  set textContent(val) {
    this._innerHTML = String(val);
    this.children = [];
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
    if (child) child.parentNode = null;
    return child;
  }

  remove() {
    if (this.parentNode) {
      this.parentNode.removeChild(this);
    }
  }

  setAttribute(k, v) {
    this[k] = v;
    if (k === 'id') this.id = v;
    if (k === 'class') {
      this.className = v;
      v.split(/\s+/).filter(Boolean).forEach(c => this.classList.add(c));
    }
  }

  getAttribute(k) {
    return this[k] ?? null;
  }

  querySelector(selector) {
    if (!selector) return null;
    if (selector.startsWith('#')) {
      const targetId = selector.slice(1);
      const search = (el) => {
        if (el.id === targetId) return el;
        for (const child of el.children) {
          const res = search(child);
          if (res) return res;
        }
        return null;
      };
      return search(this);
    }
    if (selector.startsWith('.')) {
      const targetClass = selector.slice(1);
      const search = (el) => {
        if (el.classList.contains(targetClass) || (el.className && el.className.split(/\s+/).includes(targetClass))) return el;
        for (const child of el.children) {
          const res = search(child);
          if (res) return res;
        }
        return null;
      };
      return search(this);
    }
    const search = (el) => {
      if (el.tagName.toLowerCase() === selector.toLowerCase()) return el;
      for (const child of el.children) {
        const res = search(child);
        if (res) return res;
      }
      return null;
    };
    return search(this);
  }

  querySelectorAll(selector) {
    const results = [];
    if (!selector) return results;
    const targetClass = selector.startsWith('.') ? selector.slice(1) : null;
    const targetId = selector.startsWith('#') ? selector.slice(1) : null;
    const search = (el) => {
      if (targetClass && (el.classList.contains(targetClass) || (el.className && el.className.split(/\s+/).includes(targetClass)))) results.push(el);
      else if (targetId && el.id === targetId) results.push(el);
      else if (!targetClass && !targetId && el.tagName.toLowerCase() === selector.toLowerCase()) results.push(el);
      for (const child of el.children) {
        search(child);
      }
    };
    for (const child of this.children) search(child);
    return results;
  }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  removeEventListener(event, fn) {
    if (this._listeners[event]) {
      this._listeners[event] = this._listeners[event].filter(h => h !== fn);
    }
  }

  click() {
    const event = { target: this, preventDefault() {}, stopPropagation() {} };
    for (const fn of (this._listeners['click'] || [])) {
      fn(event);
    }
  }

  focus() {}

  getBoundingClientRect() {
    return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
  }
}

// Polyfill globals for Node.js
if (typeof globalThis.ImageData === 'undefined') {
  globalThis.ImageData = MockImageData;
}

if (typeof globalThis.document === 'undefined') {
  const rootBody = new MockElement('body');
  const modalRoot = new MockElement('div');
  modalRoot.id = 'modal-root';
  rootBody.appendChild(modalRoot);

  globalThis.document = {
    body: rootBody,
    _docListeners: {},
    createElement(tagName) {
      if (tagName.toLowerCase() === 'canvas') return new MockCanvas(300, 150);
      return new MockElement(tagName);
    },
    getElementById(id) {
      if (id.includes('canvas') || id.includes('ruler')) return new MockCanvas(800, 600);
      return rootBody.querySelector(`#${id}`) || new MockElement('div');
    },
    querySelector(sel) { return rootBody.querySelector(sel); },
    querySelectorAll(sel) { return rootBody.querySelectorAll(sel); },
    addEventListener(event, fn) {
      if (!this._docListeners[event]) this._docListeners[event] = [];
      this._docListeners[event].push(fn);
    },
    removeEventListener(event, fn) {
      if (this._docListeners[event]) {
        this._docListeners[event] = this._docListeners[event].filter(h => h !== fn);
      }
    },
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

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb) => {
    const t = setTimeout(cb, 0);
    if (t && typeof t.unref === 'function') t.unref();
    return t;
  };
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
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
