// ─────────────────────────────────────────────────────────────────────────────
// document.js  —  Core data model (mirrors Compositor Swift structs)
// ─────────────────────────────────────────────────────────────────────────────

export const LayerBlendMode = Object.freeze({
  NORMAL:      'Normal',
  MULTIPLY:    'Multiply',
  SCREEN:      'Screen',
  OVERLAY:     'Overlay',
  DARKEN:      'Darken',
  LIGHTEN:     'Lighten',
  DIFFERENCE:  'Difference',
  COLOR_DODGE: 'Color Dodge',
  COLOR_BURN:  'Color Burn',
  HUE:         'Hue',
  SATURATION:  'Saturation',
  COLOR:       'Color',
  LUMINOSITY:  'Luminosity',
  ALL: ['Normal','Multiply','Screen','Overlay','Darken','Lighten',
        'Difference','Color Dodge','Color Burn','Hue','Saturation','Color','Luminosity'],
});

/** Maps LayerBlendMode string → Canvas 2D globalCompositeOperation */
export function blendModeToCompositeOp(mode) {
  switch (mode) {
    case 'Multiply':    return 'multiply';
    case 'Screen':      return 'screen';
    case 'Overlay':     return 'overlay';
    case 'Darken':      return 'darken';
    case 'Lighten':     return 'lighten';
    case 'Difference':  return 'difference';
    case 'Color Dodge': return 'color-dodge';
    case 'Color Burn':  return 'color-burn';
    case 'Hue':         return 'hue';
    case 'Saturation':  return 'saturation';
    case 'Color':       return 'color';
    case 'Luminosity':  return 'luminosity';
    default:            return 'source-over'; // Normal
  }
}

// ─── LayerTransform ───────────────────────────────────────────────────────────

export class LayerTransform {
  constructor({ x = 0, y = 0, w = 100, h = 100, rotation = 0, flipX = false, flipY = false } = {}) {
    this.x = x;          // origin x (document pixels)
    this.y = y;          // origin y (document pixels)
    this.w = w;          // width  (document pixels)
    this.h = h;          // height (document pixels)
    this.rotation = rotation; // degrees, clockwise
    this.flipX = flipX;
    this.flipY = flipY;
  }

  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }

  clone() { return new LayerTransform(this); }

  /** Unrotated bounding rect in document space */
  get bounds() {
    return { x: this.x, y: this.y, w: this.w, h: this.h };
  }

  /** Test whether a document-space point is inside this (possibly rotated) layer. */
  contains(px, py) {
    const rad = -this.rotation * Math.PI / 180;
    const dx = px - this.cx, dy = py - this.cy;
    const rx = dx * Math.cos(rad) - dy * Math.sin(rad);
    const ry = dx * Math.sin(rad) + dy * Math.cos(rad);
    return Math.abs(rx) <= this.w / 2 && Math.abs(ry) <= this.h / 2;
  }

  toJSON() {
    return { x: this.x, y: this.y, w: this.w, h: this.h, rotation: this.rotation, flipX: this.flipX, flipY: this.flipY };
  }

  static fromJSON(o) { return new LayerTransform(o); }
}

// ─── ImageLayer ───────────────────────────────────────────────────────────────

let _idCounter = 0;
export function newUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `layer-${Date.now()}-${++_idCounter}`;
}

export class ImageLayer {
  /**
   * @param {object} opts
   * @param {string}  [opts.id]
   * @param {string}   opts.name
   * @param {boolean} [opts.isVisible]
   * @param {number}  [opts.opacity]      0–1
   * @param {string}  [opts.blendMode]
   * @param {string}  [opts.parentID]
   * @param {boolean} [opts.isGroup]
   * @param {LayerTransform} [opts.transform]
   * @param {ImageBitmap|HTMLCanvasElement|OffscreenCanvas|null} [opts.bitmap]
   * @param {HTMLCanvasElement|OffscreenCanvas|null} [opts.canvas]
   * @param {string|null} [opts.dataURL]   Base64 PNG for serialisation / thumbnails
   * @param {number}  [opts.pixelW]       Natural pixel width of the layer
   * @param {number}  [opts.pixelH]       Natural pixel height
   * @param {number}  [opts.version]
   */
  constructor(opts = {}) {
    this.id        = opts.id        ?? newUUID();
    this.name      = opts.name      ?? 'Layer';
    this.isVisible = opts.isVisible ?? true;
    this.isLocked  = opts.isLocked  ?? false;
    this.opacity   = opts.opacity   ?? 1;
    this.blendMode = opts.blendMode ?? LayerBlendMode.NORMAL;
    this.parentID  = opts.parentID  ?? null;
    this.isGroup   = opts.isGroup   ?? false;
    this.transform = opts.transform instanceof LayerTransform
      ? opts.transform
      : new LayerTransform(opts.transform ?? {});
    
    this.pixelW    = opts.pixelW    ?? Math.max(1, Math.round(opts.transform?.w ?? 100));
    this.pixelH    = opts.pixelH    ?? Math.max(1, Math.round(opts.transform?.h ?? 100));
    this.isCollapsed = false;
    this.version   = opts.version   ?? 1;

    this.canvas    = opts.canvas    ?? null;
    this.bitmap    = opts.bitmap    ?? null;
    this.dataURL   = opts.dataURL   ?? null;

    // Canva-style shape frame / masking and vector data
    this.shapeMask = opts.shapeMask ?? 'none';
    this.shapeCornerRadius = opts.shapeCornerRadius ?? 12;
    this.shapeData = opts.shapeData ? { ...opts.shapeData } : null;
    this.textData  = opts.textData  ? { ...opts.textData  } : null;

    if (!this.isGroup) {
      this.ensureCanvas();
    }
  }

  /** Ensure layer has a backing canvas context for direct raster editing */
  ensureCanvas() {
    if (this.isGroup) return null;
    if (!this.canvas) {
      const w = Math.max(1, Math.round(this.pixelW));
      const h = Math.max(1, Math.round(this.pixelH));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true });
      if (this.bitmap) {
        try {
          ctx.drawImage(this.bitmap, 0, 0, w, h);
        } catch (e) {
          console.warn('Could not draw initial bitmap to layer canvas:', e);
        }
      }
      this.canvas = c;
      this.bitmap = c; // canvas is directly drawable as a CanvasImageSource
    }
    return this.canvas;
  }

  get ctx() {
    return this.ensureCanvas()?.getContext('2d', { willReadFrequently: true });
  }

  markChanged() {
    this.version++;
    this.dataURL = null; // Invalidate cached thumbnail
  }

  getThumbnailDataURL(maxSize = 64) {
    if (this.isGroup) return null;
    if (this.dataURL) return this.dataURL;
    const c = this.ensureCanvas();
    if (!c || c.width === 0 || c.height === 0) return null;
    
    const aspect = c.width / c.height;
    let tw = maxSize, th = maxSize;
    if (aspect > 1) {
      th = Math.max(1, Math.round(maxSize / aspect));
    } else {
      tw = Math.max(1, Math.round(maxSize * aspect));
    }

    const thumb = document.createElement('canvas');
    thumb.width = tw;
    thumb.height = th;
    const tctx = thumb.getContext('2d');
    tctx.drawImage(c, 0, 0, tw, th);
    this.dataURL = thumb.toDataURL('image/png');
    return this.dataURL;
  }

  clone() {
    let clonedCanvas = null;
    if (this.canvas && !this.isGroup) {
      clonedCanvas = document.createElement('canvas');
      clonedCanvas.width = this.canvas.width;
      clonedCanvas.height = this.canvas.height;
      const ctx = clonedCanvas.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(this.canvas, 0, 0);
    }
    return new ImageLayer({
      id:        this.id,
      name:      this.name,
      isVisible: this.isVisible,
      isLocked:  this.isLocked,
      opacity:   this.opacity,
      blendMode: this.blendMode,
      parentID:  this.parentID,
      isGroup:   this.isGroup,
      transform: this.transform.clone(),
      pixelW:    this.pixelW,
      pixelH:    this.pixelH,
      canvas:    clonedCanvas,
      bitmap:    clonedCanvas,
      dataURL:   this.dataURL,
      shapeMask: this.shapeMask,
      shapeCornerRadius: this.shapeCornerRadius,
      shapeData: this.shapeData ? { ...this.shapeData } : null,
      textData:  this.textData  ? { ...this.textData  } : null,
      version:   this.version,
    });
  }

  /** Apply an ImageData transformer function (r, g, b, a, x, y) => [r, g, b, a] */
  applyPixelFilter(fn) {
    if (this.isGroup) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const imgData = ctx.getImageData(0, 0, this.pixelW, this.pixelH);
    const data = imgData.data;
    const len = data.length;
    for (let i = 0; i < len; i += 4) {
      const px = (i / 4) % this.pixelW;
      const py = Math.floor((i / 4) / this.pixelW);
      const res = fn(data[i], data[i + 1], data[i + 2], data[i + 3], px, py);
      data[i]     = res[0];
      data[i + 1] = res[1];
      data[i + 2] = res[2];
      data[i + 3] = res[3];
    }
    ctx.putImageData(imgData, 0, 0);
    this.markChanged();
  }

  /** Invert layer colors */
  invert() {
    this.applyPixelFilter((r, g, b, a) => [255 - r, 255 - g, 255 - b, a]);
  }

  /** Flip layer pixel buffer horizontally or vertically */
  flip(horizontal = true, vertical = false) {
    if (this.isGroup) return;
    const ctx = this.ctx;
    if (!ctx) return;
    const temp = document.createElement('canvas');
    temp.width = this.pixelW;
    temp.height = this.pixelH;
    const tctx = temp.getContext('2d');
    tctx.drawImage(this.canvas, 0, 0);

    ctx.clearRect(0, 0, this.pixelW, this.pixelH);
    ctx.save();
    ctx.translate(horizontal ? this.pixelW : 0, vertical ? this.pixelH : 0);
    ctx.scale(horizontal ? -1 : 1, vertical ? -1 : 1);
    ctx.drawImage(temp, 0, 0);
    ctx.restore();
    this.markChanged();
  }

  toJSON() {
    return {
      id:        this.id,
      name:      this.name,
      isVisible: this.isVisible,
      isLocked:  this.isLocked,
      opacity:   this.opacity,
      blendMode: this.blendMode,
      parentID:  this.parentID,
      isGroup:   this.isGroup,
      transform: this.transform.toJSON(),
      pixelW:    this.pixelW,
      pixelH:    this.pixelH,
    };
  }

  static fromJSON(o) {
    return new ImageLayer({ ...o, transform: LayerTransform.fromJSON(o.transform) });
  }
}

// ─── CanvasDocument ───────────────────────────────────────────────────────────

export class CanvasDocument {
  /**
   * @param {object} opts
   * @param {string}  [opts.id]
   * @param {number}   opts.width
   * @param {number}   opts.height
   * @param {number}  [opts.resolution]  DPI, default 72
   * @param {ImageLayer[]} [opts.layers]  Bottom-to-top order (index 0 = bottom)
   */
  constructor(opts = {}) {
    this.id         = opts.id         ?? newUUID();
    this.name       = opts.name       ?? 'Untitled';
    this.width      = opts.width      ?? 800;
    this.height     = opts.height     ?? 600;
    this.resolution = opts.resolution ?? 72;
    this.layers     = (opts.layers    ?? []).map(l => l instanceof ImageLayer ? l : ImageLayer.fromJSON(l));
  }

  get size() { return { w: this.width, h: this.height }; }

  /** Deep clone — all layer transforms and live canvases are safely cloned */
  clone() {
    return new CanvasDocument({
      id:         this.id,
      name:       this.name,
      width:      this.width,
      height:     this.height,
      resolution: this.resolution,
      layers:     this.layers.map(l => l.clone()),
    });
  }

  /** Layers that belong to a given parent (null = root), in order. */
  children(parentID = null) {
    return this.layers.filter(l => l.parentID === parentID);
  }

  childLayersOf(parentID = null) {
    return this.children(parentID);
  }

  addLayer(layer) {
    this.layers.push(layer instanceof ImageLayer ? layer : ImageLayer.fromJSON(layer));
  }

  removeLayer(id) {
    const idx = this.indexOfID(id);
    if (idx !== -1) this.layers.splice(idx, 1);
  }

  moveLayer(id, toIndex) {
    const idx = this.indexOfID(id);
    if (idx === -1) return;
    const [layer] = this.layers.splice(idx, 1);
    this.layers.splice(toIndex, 0, layer);
  }

  layerByID(id) { return this.layers.find(l => l.id === id) ?? null; }
  indexOfID(id) { return this.layers.findIndex(l => l.id === id); }

  static validDimension(value) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n >= 1 && n <= 30000 ? n : null;
  }

  toJSON() {
    return {
      id:         this.id,
      name:       this.name,
      width:      this.width,
      height:     this.height,
      resolution: this.resolution,
      layers:     this.layers.map(l => l.toJSON()),
    };
  }
}

export { CanvasDocument as Document };

