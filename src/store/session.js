// ─────────────────────────────────────────────────────────────────────────────
// session.js  —  EditorSession: all editor state + operations
//                Mirrors EditorSession.swift + Document/*.swift helpers
// ─────────────────────────────────────────────────────────────────────────────

import { CanvasDocument, ImageLayer, LayerTransform, newUUID, LayerBlendMode, blendModeToCompositeOp } from './document.js';
import { DocumentHistory } from './history.js';
import { GRADIENT_PRESETS, normalizeStops, sampleGradient } from '../assets/gradientData.js';

export const Tool = Object.freeze({
  CURSOR:      'cursor',
  MOVE:        'move',
  BRUSH:       'brush',
  ERASER:      'eraser',
  HEAL:        'heal',
  CLONE:       'clone',
  BLUR:        'blur',
  HAND:        'hand',
  ZOOM:        'zoom',
  CROP:        'crop',
  GRADIENT:    'gradient',
  SHAPE:       'shape',
  BUCKET:      'bucket',
  EYEDROPPER:  'eyedropper',
  LASSO:       'lasso',
  MARQUEE:     'marquee',
  WAND:        'wand',
  TEXT:        'text',
});

/** Tools that have full implementations */
export const IMPLEMENTED_TOOLS = new Set([
  Tool.CURSOR, Tool.MOVE, Tool.HAND, Tool.ZOOM, Tool.BRUSH, Tool.ERASER,
  Tool.EYEDROPPER, Tool.SHAPE, Tool.BUCKET, Tool.GRADIENT, Tool.CROP,
  Tool.MARQUEE, Tool.LASSO, Tool.WAND, Tool.CLONE, Tool.HEAL,
  Tool.BLUR, Tool.TEXT
]);

// Global clipboard for copied/cut layers
let _layerClipboard = null;
let _isClipboardCutout = false;

export function clearLayerClipboard() {
  _layerClipboard = null;
  _isClipboardCutout = false;
}

export function getLayerClipboard() {
  return _layerClipboard;
}

export function setLayerClipboard(layer) {
  _layerClipboard = layer ? layer.clone() : null;
}

// ─── EditorSession ────────────────────────────────────────────────────────────

export class EditorSession extends EventTarget {
  constructor() {
    super();
    this.history       = new DocumentHistory();
    this.document      = null;      // CanvasDocument | null
    this.activeLayerID = null;   // UUID string | null
    this.selectedLayerIDs = new Set();
    this.tool          = Tool.CURSOR;
    this.projectURL    = null;      // file path | null
    this.isModified    = false;

    // Color palette (default black main foreground, white background)
    this.fgColor       = '#000000';
    this.bgColor       = '#ffffff';

    // Tool settings
    this.brushSize     = 24;
    this.brushOpacity  = 1.0;
    this.brushHardness = 0.8;

    this.shapeType     = 'rectangle'; // rectangle | rounded-rectangle | ellipse | triangle | star | hexagon | pentagon | octagon | trapezoid | diamond | heart | arrow | line
    this.shapeFill     = true;
    this.shapeStroke   = true;
    this.shapeStrokeWidth = 2;
    this.shapeCornerRadius = 12;

    this.bucketTolerance = 32;
    this.bucketContiguous = true;
    this.bucketSampleAll  = true;
    this.bucketOpacity    = 1.0;

    this.gradientType   = 'linear'; // linear | radial
    this.gradientPreset = 'fg-bg';  // 'fg-bg' | 'fg-trans' | preset ID | 'custom'
    this.gradientStops  = [
      { offset: 0, color: this.fgColor },
      { offset: 1, color: this.bgColor },
    ];
    this.gradientSteps  = 0; // 0 = smooth, or N >= 2 for stepped color bands
    this.gradientOpacity = 1.0;

    // Selection & Crop
    this.selectionRect = null; // { x, y, w, h } | null (in doc coords)
    this.selectionPath = null; // Array<{ x, y }> | null (for lasso freeform selection)
    this.selectionMask = null; // ImageData or Canvas | null (for magic wand selection mask)
    this.lassoFeather  = 0;
    this.wandTolerance = 32;
    this.wandContiguous = true;
    this.wandSampleAll  = true;

    // Clone Stamp & Spot Healing
    this.cloneSource   = null; // { x, y, layerID } | null
    this.healSize      = 24;
    this.healHardness  = 0.5;

    this.cropRect      = null; // { x, y, w, h } | null (in doc coords)

    // Rulers, Guides & Snapping
    this.showRulers    = true;
    this.showGuides    = true;
    this.snapToGuides  = true;
    this.guides        = { horizontal: [], vertical: [] };

    // Text tool settings
    this.fontSize       = 48;
    this.fontFamily     = "'Plus Jakarta Sans', sans-serif";
    this.fontWeight     = 'normal'; // normal | bold
    this.fontStyle      = 'normal'; // normal | italic
    this.textAlign      = 'left';   // left | center | right
    this.lineHeight     = 1.4;
    this.letterSpacing  = 0;
  }

  // ─── Event helpers ──────────────────────────────────────────────────────────

  _emit(type = 'change', detail = {}) {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  on(type, handler) { this.addEventListener(type, handler); }
  off(type, handler) { this.removeEventListener(type, handler); }

  // ─── Undo / Redo ────────────────────────────────────────────────────────────

  beginEdit(name) {
    this.history.begin(name, this.document, this.activeLayerID);
  }

  endEdit() {
    this.history.end(this.document, this.activeLayerID);
    this.isModified = this.history.isModified;
    this._emit('change');
  }

  get canUndo() { return this.history.canUndo; }
  get canRedo() { return this.history.canRedo; }

  get activeLayerId() { return this.activeLayerID; }
  set activeLayerId(v) { this.activeLayerID = v; }

  get selectedLayerIds() { return this.selectedLayerIDs; }
  set selectedLayerIds(v) { this.selectedLayerIDs = v; }

  setTool(tool) {
    if (this.tool === tool) return;
    const prevTool = this.tool;
    this.tool = tool;
    if (tool === Tool.CROP) {
      const l = this.activeLayer;
      if (l && !l.isGroup && !l.isLocked) {
        this.cropRect = { x: l.transform.x, y: l.transform.y, w: l.transform.w, h: l.transform.h };
      } else if (this.document) {
        this.cropRect = { x: 0, y: 0, w: this.document.width, h: this.document.height };
      }
    } else if (prevTool === Tool.CROP) {
      this.cropRect = null;
    }
    this._emit('tool-change', { tool });
    this._emit('change');
    this._emit('canvas-dirty');
  }

  undo() {
    const snap = this.history.undo();
    if (!snap) return;
    this._restoreSnapshot(snap);
  }

  redo() {
    const snap = this.history.redo();
    if (!snap) return;
    this._restoreSnapshot(snap);
  }

  _restoreSnapshot(snap) {
    this.document = snap.document ? snap.document.clone() : null;
    this.activeLayerID = snap.activeLayerID;
    this.selectedLayerIDs = snap.activeLayerID ? new Set([snap.activeLayerID]) : new Set();
    this.isModified = this.history.isModified;
    this._emit('change');
    this._emit('canvas-dirty');
  }

  // ─── Document creation ──────────────────────────────────────────────────────

  newDocument(width, height, resolution = 72) {
    this.document = new CanvasDocument({ width, height, resolution });
    this.activeLayerID = null;
    this.selectedLayerIDs = new Set();
    this.selectionRect = null;
    this.cropRect = null;
    this.projectURL = null;
    this.history.reset();
    this.isModified = false;
    this._emit('change');
    this._emit('canvas-dirty');
  }

  /** Create a new document with options for background fill */
  createDefaultDocument(width = 1920, height = 1080, resolution = 72, bgOption = 'white', customColor = '#ffffff') {
    this.document = new CanvasDocument({ width, height, resolution });
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = width;
    bgCanvas.height = height;
    const bgCtx = bgCanvas.getContext('2d', { willReadFrequently: true });

    let isTransparent = false;
    if (bgOption === 'transparent') {
      isTransparent = true;
    } else if (bgOption === 'black') {
      bgCtx.fillStyle = '#000000';
      bgCtx.fillRect(0, 0, width, height);
    } else if (bgOption === 'custom') {
      bgCtx.fillStyle = customColor || '#ffffff';
      bgCtx.fillRect(0, 0, width, height);
    } else {
      bgCtx.fillStyle = '#ffffff';
      bgCtx.fillRect(0, 0, width, height);
    }

    const bgLayer = new ImageLayer({
      name: isTransparent ? 'Layer 1' : 'Background',
      pixelW: width,
      pixelH: height,
      isLocked: !isTransparent,
      canvas: bgCanvas,
      bitmap: bgCanvas,
      transform: new LayerTransform({ x: 0, y: 0, w: width, h: height }),
    });

    this.document.layers = [bgLayer];
    this.activeLayerID = bgLayer.id;
    this.selectedLayerIDs = new Set([bgLayer.id]);
    this.selectionRect = null;
    this.cropRect = null;
    this.projectURL = null;
    this.history.reset();
    this.isModified = false;
    this._emit('change');
    this._emit('canvas-dirty');
  }

  /** Generate next sequential layer name based on tool (e.g. 'Brush 1', 'Brush 2') */
  getNextLayerName(baseName = 'Layer') {
    if (!this.document) return `${baseName} 1`;
    const existing = this.document.layers.map(l => l.name);
    let maxNum = 0;
    let baseCount = 0;
    const regex = new RegExp(`^${baseName}(?:\\s+(\\d+))?$`, 'i');
    for (const name of existing) {
      const match = name.match(regex);
      if (match) {
        baseCount++;
        if (match[1]) {
          maxNum = Math.max(maxNum, parseInt(match[1], 10));
        } else {
          maxNum = Math.max(maxNum, 1);
        }
      }
    }
    if (baseCount === 0) return `${baseName} 1`;
    return `${baseName} ${maxNum + 1}`;
  }

  // ─── Layer CRUD ─────────────────────────────────────────────────────────────

  get activeLayer() {
    return this.document?.layerByID(this.activeLayerID) ?? null;
  }

  setActiveLayer(id) {
    this.selectLayer(id);
  }

  selectLayer(id, { isToggle = false, isRange = false } = {}) {
    if (!this.document) return;
    if (!id) {
      this.activeLayerID = null;
      this.selectedLayerIDs.clear();
      this._emit('change');
      return;
    }

    const doc = this.document;
    const targetLayer = doc.layerByID(id);
    if (!targetLayer) return;

    if (isToggle) {
      if (this.selectedLayerIDs.has(id)) {
        this.selectedLayerIDs.delete(id);
        if (this.activeLayerID === id) {
          const remaining = Array.from(this.selectedLayerIDs);
          this.activeLayerID = remaining.length > 0 ? remaining[remaining.length - 1] : null;
        }
      } else {
        this.selectedLayerIDs.add(id);
        this.activeLayerID = id;
      }
    } else if (isRange && this.activeLayerID && this.activeLayerID !== id) {
      const fromIdx = doc.indexOfID(this.activeLayerID);
      const toIdx = doc.indexOfID(id);
      if (fromIdx >= 0 && toIdx >= 0) {
        const min = Math.min(fromIdx, toIdx);
        const max = Math.max(fromIdx, toIdx);
        for (let i = min; i <= max; i++) {
          this.selectedLayerIDs.add(doc.layers[i].id);
        }
        this.activeLayerID = id;
      } else {
        this.activeLayerID = id;
        this.selectedLayerIDs = new Set([id]);
      }
    } else {
      this.activeLayerID = id;
      this.selectedLayerIDs = new Set([id]);
    }

    if (this.tool === Tool.CROP && this.activeLayer && !this.activeLayer.isGroup && !this.activeLayer.isLocked) {
      const l = this.activeLayer;
      this.cropRect = { x: l.transform.x, y: l.transform.y, w: l.transform.w, h: l.transform.h };
      this._emit('canvas-dirty');
    }
    this._emit('change');
  }

  /** Import an image as a new top layer. asset = { bitmap, dataURL, name, w, h } */
  addImageLayer(asset) {
    if (!this.document) return;
    const doc = this.document;

    // Scale down layer transform proportionally if image is larger than canvas
    let tw = asset.w;
    let th = asset.h;
    if (tw > doc.width || th > doc.height) {
      const scale = Math.min(doc.width / tw, doc.height / th);
      tw = Math.max(1, Math.round(tw * scale));
      th = Math.max(1, Math.round(th * scale));
    }

    const t = new LayerTransform({
      x: Math.round((doc.width  - tw) / 2),
      y: Math.round((doc.height - th) / 2),
      w: tw,
      h: th,
    });
    const layer = new ImageLayer({
      name:    asset.name ?? 'Layer',
      bitmap:  asset.bitmap,
      dataURL: asset.dataURL,
      pixelW:  asset.w,
      pixelH:  asset.h,
      transform: t,
    });
    this.beginEdit('Add Layer');
    this.document.layers.push(layer);
    this.activeLayerID = layer.id;
    this.selectedLayerIDs = new Set([layer.id]);
    this.endEdit();
    this._emit('canvas-dirty');
    return layer;
  }

  addBlankLayer(name = 'Layer', opts = {}) {
    if (!this.document) return;
    const doc = this.document;

    // Canvas-filling layers (for brush/eraser/shape/gradient tools) use fullCanvas:true.
    // Explicit bounds can be passed with opts.x, opts.y, opts.w, opts.h.
    // A plain user-created layer defaults to ~50% canvas size, centered.
    let lw, lh, lx, ly;
    if (opts.x !== undefined && opts.y !== undefined && opts.w !== undefined && opts.h !== undefined) {
      lw = Math.max(1, Math.round(opts.w));
      lh = Math.max(1, Math.round(opts.h));
      lx = Math.round(opts.x);
      ly = Math.round(opts.y);
    } else if (opts.fullCanvas) {
      lw = doc.width;  lh = doc.height;
      lx = 0;          ly = 0;
    } else {
      lw = Math.max(400, Math.round(doc.width  * 0.5));
      lh = Math.max(300, Math.round(doc.height * 0.5));
      lw = Math.min(lw, doc.width);
      lh = Math.min(lh, doc.height);
      lx = Math.round((doc.width  - lw) / 2);
      ly = Math.round((doc.height - lh) / 2);
    }

    const layer = new ImageLayer({
      name,
      pixelW: lw,
      pixelH: lh,
      transform: new LayerTransform({ x: lx, y: ly, w: lw, h: lh }),
    });
    this.beginEdit('New Layer');
    this.document.layers.push(layer);
    this.activeLayerID = layer.id;
    this.selectedLayerIDs = new Set([layer.id]);
    this.endEdit();
    this._emit('canvas-dirty');
    return layer;
  }

  addGroup(name = 'Group') {
    if (!this.document) return;
    const layer = new ImageLayer({ name, isGroup: true });
    this.beginEdit('New Group');
    this.document.layers.push(layer);
    this.activeLayerID = layer.id;
    this.selectedLayerIDs = new Set([layer.id]);
    this.endEdit();
    return layer;
  }

  deleteLayer(id) {
    if (!this.document) return;
    this.selectedLayerIDs = new Set([id]);
    this.deleteSelectedLayers();
  }

  deleteSelectedLayers() {
    if (!this.document) return;
    if (this.selectedLayerIDs.size === 0 && this.activeLayerID) {
      this.selectedLayerIDs = new Set([this.activeLayerID]);
    }
    if (this.selectedLayerIDs.size === 0) return;

    const doc = this.document;
    const toDelete = new Set();
    const collect = (pid) => {
      for (const l of doc.layers) {
        if (l.parentID === pid) { toDelete.add(l.id); collect(l.id); }
      }
    };

    for (const id of this.selectedLayerIDs) {
      const layer = doc.layerByID(id);
      if (!layer) continue;
      toDelete.add(id);
      if (layer.isGroup) collect(id);
    }

    if (toDelete.size === 0) return;

    this.beginEdit(toDelete.size > 1 ? 'Delete Layers' : 'Delete Layer');
    doc.layers = doc.layers.filter(l => !toDelete.has(l.id));

    if (toDelete.has(this.activeLayerID) || !doc.layerByID(this.activeLayerID)) {
      this.activeLayerID = doc.layers.at(-1)?.id ?? null;
      this.selectedLayerIDs = this.activeLayerID ? new Set([this.activeLayerID]) : new Set();
    } else {
      for (const id of toDelete) {
        this.selectedLayerIDs.delete(id);
      }
      if (this.selectedLayerIDs.size === 0 && this.activeLayerID) {
        this.selectedLayerIDs.add(this.activeLayerID);
      }
    }

    this.endEdit();
    this._emit('canvas-dirty');
  }

  duplicateLayer(id) {
    if (!this.document) return;
    const src = this.document.layerByID(id);
    if (!src) return;
    const copy = src.clone();
    copy.id = newUUID();
    copy.name = src.name + ' copy';
    const srcIdx = this.document.indexOfID(id);
    this.beginEdit('Duplicate Layer');
    this.document.layers.splice(srcIdx + 1, 0, copy);
    this.activeLayerID = copy.id;
    this.selectedLayerIDs = new Set([copy.id]);
    this.endEdit();
    this._emit('canvas-dirty');
    return copy;
  }

  renameLayer(id, name) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.beginEdit('Rename Layer');
    this.document.layers[idx].name = name;
    this.endEdit();
  }

  setLayerVisibility(id, visible) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.beginEdit('Layer Visibility');
    this.document.layers[idx].isVisible = visible;
    this.endEdit();
    this._emit('canvas-dirty');
  }

  setLayerLocked(id, isLocked) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.beginEdit(isLocked ? 'Lock Layer' : 'Unlock Layer');
    this.document.layers[idx].isLocked = isLocked;
    this.endEdit();
    this._emit('change');
  }

  setLayerOpacity(id, opacity) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.beginEdit('Layer Opacity');
    this.document.layers[idx].opacity = Math.max(0, Math.min(1, opacity));
    this.endEdit();
    this._emit('canvas-dirty');
  }

  setLayerBlendMode(id, mode) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.beginEdit('Layer Blend Mode');
    this.document.layers[idx].blendMode = mode;
    this.endEdit();
    this._emit('canvas-dirty');
  }

  bringForward(id = this.activeLayerID) {
    if (!id) return;
    this.moveLayerUp(id);
  }

  sendBackward(id = this.activeLayerID) {
    if (!id) return;
    this.moveLayerDown(id);
  }

  bringToFront(id = this.activeLayerID) {
    if (!this.document || !id) return;
    const doc = this.document;
    const fromIndex = doc.indexOfID(id);
    if (fromIndex < 0 || fromIndex >= doc.layers.length - 1) return;
    this.beginEdit('Bring to Front');
    const layer = doc.layers[fromIndex];
    if (layer.isGroup) {
      this.reorderLayer(id, doc.layers.length);
    } else {
      doc.layers.splice(fromIndex, 1);
      doc.layers.push(layer);
      this.endEdit();
      this._emit('change');
      this._emit('canvas-dirty');
    }
  }

  sendToBack(id = this.activeLayerID) {
    if (!this.document || !id) return;
    const doc = this.document;
    const fromIndex = doc.indexOfID(id);
    if (fromIndex < 0) return;
    // If bottom layer is locked background, send directly above it (index 1), otherwise index 0
    const targetIdx = (doc.layers.length > 1 && doc.layers[0].isLocked && doc.layers[0].id !== id) ? 1 : 0;
    if (fromIndex === targetIdx) return;
    this.beginEdit('Send to Back');
    const layer = doc.layers[fromIndex];
    if (layer.isGroup) {
      this.reorderLayer(id, targetIdx);
    } else {
      doc.layers.splice(fromIndex, 1);
      doc.layers.splice(targetIdx, 0, layer);
      this.endEdit();
      this._emit('change');
      this._emit('canvas-dirty');
    }
  }

  hasClipboardLayer() {
    return !!_layerClipboard;
  }

  hasSelection() {
    if (this.selectionPath && this.selectionPath.length > 2) return true;
    if (this.selectionRect && this.selectionRect.w > 0 && this.selectionRect.h > 0) return true;
    return false;
  }

  copySelection() {
    const layer = this.activeLayer;
    if (!this.document || !layer || layer.isGroup) return false;
    if (!this.hasSelection()) return false;

    let selX = 0, selY = 0, selW = 0, selH = 0;
    if (this.selectionPath && this.selectionPath.length > 2) {
      const xs = this.selectionPath.map(p => p.x);
      const ys = this.selectionPath.map(p => p.y);
      selX = Math.min(...xs);
      selY = Math.min(...ys);
      selW = Math.max(...xs) - selX;
      selH = Math.max(...ys) - selY;
    } else if (this.selectionRect) {
      selX = this.selectionRect.x;
      selY = this.selectionRect.y;
      selW = this.selectionRect.w;
      selH = this.selectionRect.h;
    }

    if (selW <= 0 || selH <= 0) return false;

    // Intersection with layer bounding box in document space
    const lt = layer.transform;
    const intX = Math.max(selX, lt.x);
    const intY = Math.max(selY, lt.y);
    const intR = Math.min(selX + selW, lt.x + lt.w);
    const intB = Math.min(selY + selH, lt.y + lt.h);
    const intW = intR - intX;
    const intH = intB - intY;

    if (intW <= 0 || intH <= 0) return false;

    // Scale from transform dimensions to layer backing canvas pixels
    const scaleX = layer.pixelW / Math.max(1, lt.w);
    const scaleY = layer.pixelH / Math.max(1, lt.h);

    const cutoutPixelW = Math.max(1, Math.round(intW * scaleX));
    const cutoutPixelH = Math.max(1, Math.round(intH * scaleY));

    const cutoutCanvas = document.createElement('canvas');
    cutoutCanvas.width = cutoutPixelW;
    cutoutCanvas.height = cutoutPixelH;
    const cctx = cutoutCanvas.getContext('2d', { willReadFrequently: true });

    if (this.selectionPath && this.selectionPath.length > 2) {
      cctx.save();
      cctx.beginPath();
      const first = this.selectionPath[0];
      cctx.moveTo((first.x - intX) * scaleX, (first.y - intY) * scaleY);
      for (let i = 1; i < this.selectionPath.length; i++) {
        const pt = this.selectionPath[i];
        cctx.lineTo((pt.x - intX) * scaleX, (pt.y - intY) * scaleY);
      }
      cctx.closePath();
      cctx.clip();
    }

    // Draw source layer canvas aligned to cutout coordinates
    const srcLayerCanvas = layer.ensureCanvas();
    const srcOffX = (lt.x - intX) * scaleX;
    const srcOffY = (lt.y - intY) * scaleY;
    cctx.drawImage(srcLayerCanvas, srcOffX, srcOffY, layer.pixelW, layer.pixelH);

    if (this.selectionPath && this.selectionPath.length > 2) {
      cctx.restore();
    }

    const cutoutLayer = new ImageLayer({
      name: `${layer.name} Selection`,
      pixelW: cutoutPixelW,
      pixelH: cutoutPixelH,
      transform: new LayerTransform({ x: Math.round(intX), y: Math.round(intY), w: Math.round(intW), h: Math.round(intH) }),
      canvas: cutoutCanvas,
      bitmap: cutoutCanvas,
    });

    _layerClipboard = cutoutLayer;
    _isClipboardCutout = true;
    return true;
  }

  cutSelection() {
    if (!this.hasSelection() || !this.activeLayer || this.activeLayer.isLocked || this.activeLayer.isGroup) return false;
    const copied = this.copySelection();
    if (copied) {
      this.deleteSelection();
      return true;
    }
    return false;
  }

  copyLayer(id = this.activeLayerID) {
    if (!this.document || !id) return false;
    if (this.hasSelection() && id === this.activeLayerID) {
      return this.copySelection();
    }
    const layer = this.document.layerByID(id);
    if (!layer) return false;
    _layerClipboard = layer.clone();
    _isClipboardCutout = false;
    return true;
  }

  cutLayer(id = this.activeLayerID) {
    if (!this.document || !id) return false;
    if (this.hasSelection() && id === this.activeLayerID) {
      return this.cutSelection();
    }
    const layer = this.document.layerByID(id);
    if (!layer || layer.isLocked) return false;
    _layerClipboard = layer.clone();
    _isClipboardCutout = false;
    this.deleteLayer(id);
    return true;
  }

  pasteLayer(opts = {}) {
    if (!_layerClipboard || !this.document) return null;
    const pasted = _layerClipboard.clone();
    pasted.id = newUUID();
    pasted.name = opts.name || (_isClipboardCutout ? (_layerClipboard.name || 'Pasted Selection') : (_layerClipboard.name.endsWith(' copy') ? _layerClipboard.name : `${_layerClipboard.name} copy`));

    if (opts.inPlace) {
      if (opts.x !== undefined) pasted.transform.x = Math.round(opts.x);
      if (opts.y !== undefined) pasted.transform.y = Math.round(opts.y);
    } else if (opts.x !== undefined && opts.y !== undefined) {
      // Center at specified coordinates
      pasted.transform.x = Math.round(opts.x - pasted.transform.w / 2);
      pasted.transform.y = Math.round(opts.y - pasted.transform.h / 2);
    } else if (_isClipboardCutout) {
      // Pasting a cutout retains its document coordinates by default
      pasted.transform.x = _layerClipboard.transform.x;
      pasted.transform.y = _layerClipboard.transform.y;
    } else {
      // Offset whole layer slightly
      pasted.transform.x += 20;
      pasted.transform.y += 20;
    }

    let insertIdx = this.activeLayerID ? this.document.indexOfID(this.activeLayerID) + 1 : this.document.layers.length;
    if (insertIdx <= 0 || insertIdx > this.document.layers.length) {
      insertIdx = this.document.layers.length;
    }

    this.beginEdit('Paste Layer');
    this.document.layers.splice(insertIdx, 0, pasted);
    this.activeLayerID = pasted.id;
    this.selectedLayerIDs = new Set([pasted.id]);
    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
    return pasted;
  }

  moveLayerUp(id) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0 || idx >= this.document.layers.length - 1) return;
    this.beginEdit('Move Layer Up');
    [this.document.layers[idx], this.document.layers[idx + 1]] =
    [this.document.layers[idx + 1], this.document.layers[idx]];
    this.endEdit();
    this._emit('canvas-dirty');
  }

  moveLayerDown(id) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx <= 0) return;
    this.beginEdit('Move Layer Down');
    [this.document.layers[idx], this.document.layers[idx - 1]] =
    [this.document.layers[idx - 1], this.document.layers[idx]];
    this.endEdit();
    this._emit('canvas-dirty');
  }

  reorderLayer(id, toIndex, targetParentID = undefined) {
    if (!this.document) return;
    const doc = this.document;
    const fromIndex = doc.indexOfID(id);
    if (fromIndex < 0) return;

    const layer = doc.layers[fromIndex];

    this.beginEdit('Reorder Layer');

    if (layer.isGroup) {
      // Collect group and all descendants recursively
      const getDescendantIDs = (parentID) => {
        const result = [];
        for (const l of doc.layers) {
          if (l.parentID === parentID) {
            result.push(l.id);
            if (l.isGroup) result.push(...getDescendantIDs(l.id));
          }
        }
        return result;
      };

      const groupDescendantIDs = new Set(getDescendantIDs(layer.id));
      const groupBundle = doc.layers.filter(l => l.id === id || groupDescendantIDs.has(l.id));

      // Remove bundle from layers
      doc.layers = doc.layers.filter(l => l.id !== id && !groupDescendantIDs.has(l.id));

      // Insert bundle at target index
      const boundedIndex = Math.max(0, Math.min(doc.layers.length, toIndex));
      doc.layers.splice(boundedIndex, 0, ...groupBundle);

      if (targetParentID !== undefined) {
        layer.parentID = targetParentID;
      }
    } else {
      // Single layer move
      doc.layers.splice(fromIndex, 1);
      const boundedIndex = Math.max(0, Math.min(doc.layers.length, toIndex));
      doc.layers.splice(boundedIndex, 0, layer);

      if (targetParentID !== undefined) {
        layer.parentID = targetParentID;
      }
    }

    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
  }

  // ─── Merge Down & Flatten ───────────────────────────────────────────────────

  mergeDown(id) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx <= 0) return;
    const topLayer = this.document.layers[idx];
    const bottomLayer = this.document.layers[idx - 1];
    if (topLayer.isGroup || bottomLayer.isGroup) return;

    this.beginEdit('Merge Down');

    // Composite topLayer onto bottomLayer
    const bCanvas = bottomLayer.ensureCanvas();
    const bCtx = bCanvas.getContext('2d', { willReadFrequently: true });

    bCtx.save();
    bCtx.globalAlpha = topLayer.opacity;
    bCtx.globalCompositeOperation = blendModeToCompositeOp(topLayer.blendMode);

    const relX = topLayer.transform.x - bottomLayer.transform.x;
    const relY = topLayer.transform.y - bottomLayer.transform.y;
    const t = topLayer.transform;

    const cx = relX + t.w / 2;
    const cy = relY + t.h / 2;
    bCtx.translate(cx, cy);
    if (t.rotation) bCtx.rotate(t.rotation * Math.PI / 180);
    if (t.flipX) bCtx.scale(-1, 1);
    if (t.flipY) bCtx.scale(1, -1);
    bCtx.drawImage(topLayer.canvas, -t.w / 2, -t.h / 2, t.w, t.h);
    bCtx.restore();

    bottomLayer.markChanged();

    // Remove top layer
    this.document.layers.splice(idx, 1);
    this.activeLayerID = bottomLayer.id;
    this.selectedLayerIDs = new Set([bottomLayer.id]);

    this.endEdit();
    this._emit('canvas-dirty');
  }

  flattenImage() {
    if (!this.document || this.document.layers.length === 0) return;
    const doc = this.document;
    this.beginEdit('Flatten Image');

    const flatCanvas = document.createElement('canvas');
    flatCanvas.width = doc.width;
    flatCanvas.height = doc.height;
    const fctx = flatCanvas.getContext('2d', { willReadFrequently: true });

    // White background
    fctx.fillStyle = '#ffffff';
    fctx.fillRect(0, 0, doc.width, doc.height);

    for (const layer of doc.layers.filter(l => l.isVisible && !l.isGroup && l.canvas)) {
      fctx.save();
      fctx.globalAlpha = layer.opacity;
      fctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
      const t = layer.transform;
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      fctx.translate(cx, cy);
      if (t.rotation) fctx.rotate(t.rotation * Math.PI / 180);
      if (t.flipX) fctx.scale(-1, 1);
      if (t.flipY) fctx.scale(1, -1);
      fctx.drawImage(layer.canvas, -t.w / 2, -t.h / 2, t.w, t.h);
      fctx.restore();
    }

    const flatLayer = new ImageLayer({
      name: 'Background',
      pixelW: doc.width,
      pixelH: doc.height,
      canvas: flatCanvas,
      bitmap: flatCanvas,
      transform: new LayerTransform({ x: 0, y: 0, w: doc.width, h: doc.height }),
    });

    doc.layers = [flatLayer];
    this.activeLayerID = flatLayer.id;
    this.selectedLayerIDs = new Set([flatLayer.id]);

    this.endEdit();
    this._emit('canvas-dirty');
  }

  centerActiveLayer(id = this.activeLayerID) {
    if (!this.document || !id) return;
    const layer = this.document.layerByID(id);
    if (!layer || layer.isLocked) return;
    this.beginEdit('Center Layer');
    layer.transform.x = Math.round((this.document.width - layer.transform.w) / 2);
    layer.transform.y = Math.round((this.document.height - layer.transform.h) / 2);
    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
  }

  // ─── Flip & Mirror Operations ───────────────────────────────────────────────

  flipLayerH(id = this.activeLayerID) {
    if (!this.document || !id) return;
    const layer = this.document.layerByID(id);
    if (!layer || layer.isGroup || layer.isLocked) return;
    this.beginEdit('Flip Layer Horizontal');
    layer.transform.flipX = !layer.transform.flipX;
    layer.markChanged();
    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
  }

  flipLayerV(id = this.activeLayerID) {
    if (!this.document || !id) return;
    const layer = this.document.layerByID(id);
    if (!layer || layer.isGroup || layer.isLocked) return;
    this.beginEdit('Flip Layer Vertical');
    layer.transform.flipY = !layer.transform.flipY;
    layer.markChanged();
    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
  }

  mirrorLayerH(id = this.activeLayerID, mode = 'offset') {
    if (!this.document || !id) return null;
    const orig = this.document.layerByID(id);
    if (!orig || orig.isGroup) return null;

    this.beginEdit('Mirror Layer Horizontal');
    const clone = orig.clone();
    clone.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('layer_' + Math.random().toString(36).slice(2, 9));
    clone.name = `${orig.name} (Mirror H)`;
    clone.transform.flipX = !orig.transform.flipX;

    if (mode === 'offset' || mode === 'adjacent') {
      clone.transform.x = orig.transform.x + orig.transform.w + 20;
    } else if (mode === 'center') {
      clone.transform.x = this.document.width - (orig.transform.x + orig.transform.w);
    } else if (mode === 'in-place') {
      clone.transform.x = orig.transform.x;
    }
    clone.markChanged();

    const idx = this.document.indexOfID(id);
    this.document.layers.splice(idx + 1, 0, clone);
    this.activeLayerID = clone.id;
    this.selectedLayerIDs = new Set([clone.id]);
    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
    return clone;
  }

  mirrorLayerV(id = this.activeLayerID, mode = 'offset') {
    if (!this.document || !id) return null;
    const orig = this.document.layerByID(id);
    if (!orig || orig.isGroup) return null;

    this.beginEdit('Mirror Layer Vertical');
    const clone = orig.clone();
    clone.id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : ('layer_' + Math.random().toString(36).slice(2, 9));
    clone.name = `${orig.name} (Mirror V)`;
    clone.transform.flipY = !orig.transform.flipY;

    if (mode === 'offset' || mode === 'adjacent') {
      clone.transform.y = orig.transform.y + orig.transform.h + 20;
    } else if (mode === 'center') {
      clone.transform.y = this.document.height - (orig.transform.y + orig.transform.h);
    } else if (mode === 'in-place') {
      clone.transform.y = orig.transform.y;
    }
    clone.markChanged();

    const idx = this.document.indexOfID(id);
    this.document.layers.splice(idx + 1, 0, clone);
    this.activeLayerID = clone.id;
    this.selectedLayerIDs = new Set([clone.id]);
    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
    return clone;
  }

  flipCanvasH() {
    if (!this.document) return;
    this.beginEdit('Flip Canvas Horizontal');
    const w = this.document.width;
    for (const layer of this.document.layers) {
      if (!layer.isGroup) layer.flip(true, false);
      layer.transform.x = w - (layer.transform.x + layer.transform.w);
    }
    this.endEdit();
    this._emit('canvas-dirty');
  }

  flipCanvasV() {
    if (!this.document) return;
    this.beginEdit('Flip Canvas Vertical');
    const h = this.document.height;
    for (const layer of this.document.layers) {
      if (!layer.isGroup) layer.flip(false, true);
      layer.transform.y = h - (layer.transform.y + layer.transform.h);
    }
    this.endEdit();
    this._emit('canvas-dirty');
  }

  /**
   * Insert a rasterized Clipart onto a new layer centered on canvas
   * @param {HTMLImageElement|HTMLCanvasElement|string} svgDataOrUrl
   * @param {string} [name='Clipart']
   * @param {object} [opts]
   */
  insertClipart(svgDataOrUrl, name = 'Clipart', opts = {}) {
    if (!this.document) return null;
    const doc = this.document;
    const layerW = opts.width || opts.pixelW || 400;
    const layerH = opts.height || opts.pixelH || 400;

    const layer = new ImageLayer({
      name: name || 'Clipart',
      pixelW: layerW,
      pixelH: layerH,
      transform: new LayerTransform({
        x: Math.round((doc.width - layerW) / 2),
        y: Math.round((doc.height - layerH) / 2),
        w: layerW,
        h: layerH,
      }),
    });

    const ctx = layer.ctx;
    if (typeof svgDataOrUrl === 'string') {
      if (typeof Image !== 'undefined') {
        const img = new Image();
        img.onload = () => {
          if (ctx) {
            ctx.drawImage(img, 0, 0, layerW, layerH);
            layer.markChanged();
            this._emit('canvas-dirty');
          }
        };
        if (svgDataOrUrl.startsWith('data:') || svgDataOrUrl.startsWith('http') || svgDataOrUrl.startsWith('blob:')) {
          img.src = svgDataOrUrl;
        } else {
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgDataOrUrl)}`;
        }
      }
    } else if (svgDataOrUrl && ctx && (svgDataOrUrl.width || svgDataOrUrl.naturalWidth)) {
      ctx.drawImage(svgDataOrUrl, 0, 0, layerW, layerH);
    }

    layer.markChanged();

    this.beginEdit(`Insert Clipart: ${name}`);
    let insertIdx = this.activeLayerID ? doc.indexOfID(this.activeLayerID) + 1 : doc.layers.length;
    if (insertIdx <= 0 || insertIdx > doc.layers.length) insertIdx = doc.layers.length;
    doc.layers.splice(insertIdx, 0, layer);
    this.activeLayerID = layer.id;
    this.selectedLayerIDs = new Set([layer.id]);
    this.setTool(Tool.CURSOR);
    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
    return layer;
  }

  /**
   * Insert a rendered WordArt canvas/image onto a new layer centered on canvas
   * @param {HTMLCanvasElement|HTMLImageElement} wordartCanvas
   * @param {string} [text='WordArt']
   * @param {object} [opts]
   */
  insertWordArt(wordartCanvas, text = 'WordArt', opts = {}) {
    if (!this.document || !wordartCanvas) return null;
    const doc = this.document;
    const w = wordartCanvas.width || 400;
    const h = wordartCanvas.height || 160;

    const layer = new ImageLayer({
      name: opts.name || `WordArt (${text.slice(0, 20)})`,
      pixelW: w,
      pixelH: h,
      transform: new LayerTransform({
        x: Math.round((doc.width - w) / 2),
        y: Math.round((doc.height - h) / 2),
        w: w,
        h: h,
      }),
    });

    if (layer.ctx) layer.ctx.drawImage(wordartCanvas, 0, 0);
    layer.markChanged();

    this.beginEdit(`Insert WordArt: ${text.slice(0, 20)}`);
    let insertIdx = this.activeLayerID ? doc.indexOfID(this.activeLayerID) + 1 : doc.layers.length;
    if (insertIdx <= 0 || insertIdx > doc.layers.length) insertIdx = doc.layers.length;
    doc.layers.splice(insertIdx, 0, layer);
    this.activeLayerID = layer.id;
    this.selectedLayerIDs = new Set([layer.id]);
    this.setTool(Tool.CURSOR);
    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
    return layer;
  }

  invertActiveLayer() {
    const layer = this.activeLayer;
    if (!layer || layer.isGroup) return;
    this.beginEdit('Invert');
    layer.invert();
    this.endEdit();
    this._emit('canvas-dirty');
  }

  // ─── Crop ───────────────────────────────────────────────────────────────────

  cropActiveLayer(cropRect) {
    if (!this.document) return;
    const layer = this.activeLayer;
    if (!layer || layer.isGroup || layer.isLocked) return;
    if (!cropRect) return;

    const cx = Math.round(cropRect.x);
    const cy = Math.round(cropRect.y);
    const cw = Math.max(1, Math.round(cropRect.w));
    const ch = Math.max(1, Math.round(cropRect.h));

    this.beginEdit('Crop Layer');

    const t = layer.transform;
    const lx = t.x;
    const ly = t.y;
    const lw = Math.max(1, t.w);
    const lh = Math.max(1, t.h);
    const pw = layer.pixelW;
    const ph = layer.pixelH;

    // Scale factors from display transform space to backing pixel canvas space
    const scaleX = pw / lw;
    const scaleY = ph / lh;

    // Relative offset of crop box inside the layer display rect
    const relX = cx - lx;
    const relY = cy - ly;

    // New pixel buffer dimensions
    const newPixelW = Math.max(1, Math.round(cw * scaleX));
    const newPixelH = Math.max(1, Math.round(ch * scaleY));

    // Pixel offset in the source canvas
    const srcX = Math.round(relX * scaleX);
    const srcY = Math.round(relY * scaleY);

    // Create new cropped backing canvas
    const newCanvas = document.createElement('canvas');
    newCanvas.width = newPixelW;
    newCanvas.height = newPixelH;
    const newCtx = newCanvas.getContext('2d', { willReadFrequently: true });

    if (layer.canvas) {
      newCtx.drawImage(layer.canvas, -srcX, -srcY);
    }

    layer.canvas = newCanvas;
    layer.bitmap = newCanvas;
    layer.pixelW = newPixelW;
    layer.pixelH = newPixelH;

    // Update layer transform coordinates & dimensions
    layer.transform.x = cx;
    layer.transform.y = cy;
    layer.transform.w = cw;
    layer.transform.h = ch;

    // Keep text layer coordinates aligned
    if (layer.textData) {
      if (layer.textData.localX !== undefined) {
        layer.textData.localX -= srcX;
        layer.textData.localY -= srcY;
      }
    }

    layer.markChanged();

    this.cropRect = null;
    this.tool = Tool.CURSOR;
    this._emit('tool-change', { tool: Tool.CURSOR });
    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
  }

  cropDocument(cropRect) {
    if (this.activeLayer && !this.activeLayer.isGroup && !this.activeLayer.isLocked) {
      return this.cropActiveLayer(cropRect);
    }
    if (!this.document || !cropRect) return;
    const x = Math.round(cropRect.x);
    const y = Math.round(cropRect.y);
    const w = Math.max(1, Math.round(cropRect.w));
    const h = Math.max(1, Math.round(cropRect.h));

    this.beginEdit('Crop Canvas');
    this.document.width = w;
    this.document.height = h;

    for (const layer of this.document.layers) {
      layer.transform.x -= x;
      layer.transform.y -= y;
      if (layer.textData) {
        if (layer.textData.docX !== undefined) layer.textData.docX -= x;
        if (layer.textData.docY !== undefined) layer.textData.docY -= y;
      }
    }

    this.cropRect = null;
    this.tool = Tool.CURSOR;
    this._emit('tool-change', { tool: Tool.CURSOR });
    this.endEdit();
    this._emit('change');
    this._emit('canvas-dirty');
  }

  // ─── Selection ──────────────────────────────────────────────────────────────

  setSelection(rect, path = null) {
    this.selectionRect = rect ? {
      x: Math.round(Math.min(rect.x, rect.x + rect.w)),
      y: Math.round(Math.min(rect.y, rect.y + rect.h)),
      w: Math.round(Math.abs(rect.w)),
      h: Math.round(Math.abs(rect.h)),
    } : null;
    this.selectionPath = path && path.length > 1 ? path.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })) : null;
    this._emit('selection-change');
    this._emit('canvas-dirty');
  }

  deselect() {
    this.selectionRect = null;
    this.selectionPath = null;
    this.selectionMask = null;
    this._emit('selection-change');
    this._emit('canvas-dirty');
  }

  deleteSelection() {
    const layer = this.activeLayer;
    if (!layer || layer.isGroup) return;

    this.beginEdit('Clear Selection');
    const ctx = layer.ctx;
    if (this.selectionPath && this.selectionPath.length > 2) {
      ctx.save();
      ctx.beginPath();
      const first = this.selectionPath[0];
      ctx.moveTo(first.x - layer.transform.x, first.y - layer.transform.y);
      for (let i = 1; i < this.selectionPath.length; i++) {
        const pt = this.selectionPath[i];
        ctx.lineTo(pt.x - layer.transform.x, pt.y - layer.transform.y);
      }
      ctx.closePath();
      ctx.clip();
      ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
      ctx.restore();
    } else if (this.selectionRect) {
      const relX = this.selectionRect.x - layer.transform.x;
      const relY = this.selectionRect.y - layer.transform.y;
      ctx.clearRect(relX, relY, this.selectionRect.w, this.selectionRect.h);
    } else {
      ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
    }
    layer.markChanged();
    this.endEdit();
    this._emit('canvas-dirty');
  }

  fillSelection(color = this.fgColor) {
    const layer = this.activeLayer;
    if (!layer || layer.isGroup) return;

    this.beginEdit('Fill');
    const ctx = layer.ctx;
    if (this.selectionPath && this.selectionPath.length > 2) {
      ctx.save();
      ctx.beginPath();
      const first = this.selectionPath[0];
      ctx.moveTo(first.x - layer.transform.x, first.y - layer.transform.y);
      for (let i = 1; i < this.selectionPath.length; i++) {
        const pt = this.selectionPath[i];
        ctx.lineTo(pt.x - layer.transform.x, pt.y - layer.transform.y);
      }
      ctx.closePath();
      ctx.clip();
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, layer.pixelW, layer.pixelH);
      ctx.restore();
    } else if (this.selectionRect) {
      const relX = this.selectionRect.x - layer.transform.x;
      const relY = this.selectionRect.y - layer.transform.y;
      ctx.fillStyle = color;
      ctx.fillRect(relX, relY, this.selectionRect.w, this.selectionRect.h);
    } else {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, layer.pixelW, layer.pixelH);
    }
    layer.markChanged();
    this.endEdit();
    this._emit('canvas-dirty');
  }

  // ─── Image Size & Canvas Size Resampling ─────────────────────────────────────

  resizeImage(newWidth, newHeight, resolution = null, resampleMethod = 'bicubic') {
    if (!this.document) return;
    const doc = this.document;
    const oldW = doc.width || 1;
    const oldH = doc.height || 1;
    const targetW = Math.max(1, Math.round(newWidth));
    const targetH = Math.max(1, Math.round(newHeight));
    const scaleX = targetW / oldW;
    const scaleY = targetH / oldH;

    this.beginEdit('Image Size');
    doc.width = targetW;
    doc.height = targetH;
    if (resolution) doc.resolution = Math.max(1, Math.round(resolution));

    for (const layer of doc.layers) {
      layer.transform.x = Math.round(layer.transform.x * scaleX);
      layer.transform.y = Math.round(layer.transform.y * scaleY);
      layer.transform.w = Math.max(1, Math.round(layer.transform.w * scaleX));
      layer.transform.h = Math.max(1, Math.round(layer.transform.h * scaleY));

      if (!layer.isGroup && layer.canvas) {
        const newPixelW = Math.max(1, Math.round(layer.pixelW * scaleX));
        const newPixelH = Math.max(1, Math.round(layer.pixelH * scaleY));

        const newCanvas = document.createElement('canvas');
        newCanvas.width = newPixelW;
        newCanvas.height = newPixelH;
        const nctx = newCanvas.getContext('2d', { willReadFrequently: true });

        if (resampleMethod === 'nearest') {
          nctx.imageSmoothingEnabled = false;
        } else {
          nctx.imageSmoothingEnabled = true;
          nctx.imageSmoothingQuality = resampleMethod === 'bilinear' ? 'medium' : 'high';
        }

        nctx.drawImage(layer.canvas, 0, 0, newPixelW, newPixelH);
        layer.canvas = newCanvas;
        layer.bitmap = newCanvas;
        layer.pixelW = newPixelW;
        layer.pixelH = newPixelH;
        layer.markChanged();
      }
    }

    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
  }

  resizeCanvas(newWidth, newHeight, anchor = 'center', bgOption = 'transparent', customColor = '#ffffff') {
    if (!this.document) return;
    const doc = this.document;
    const oldW = doc.width || 1;
    const oldH = doc.height || 1;
    const targetW = Math.max(1, Math.round(newWidth));
    const targetH = Math.max(1, Math.round(newHeight));
    const dw = targetW - oldW;
    const dh = targetH - oldH;

    let ox = Math.round(dw / 2);
    let oy = Math.round(dh / 2);

    if (anchor.includes('left')) ox = 0;
    else if (anchor.includes('right')) ox = dw;

    if (anchor.includes('top')) oy = 0;
    else if (anchor.includes('bottom')) oy = dh;

    this.beginEdit('Canvas Size');
    doc.width = targetW;
    doc.height = targetH;

    for (const layer of doc.layers) {
      layer.transform.x += ox;
      layer.transform.y += oy;
      layer.markChanged();
    }

    // If bottom layer is a locked Background layer, expand it to match new canvas bounds
    const bottomLayer = doc.layers[0];
    if (bottomLayer && !bottomLayer.isGroup && bottomLayer.isLocked && bottomLayer.name.toLowerCase() === 'background') {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = targetW;
      newCanvas.height = targetH;
      const nctx = newCanvas.getContext('2d', { willReadFrequently: true });

      let fillStyle = '#ffffff';
      if (bgOption === 'black') fillStyle = '#000000';
      else if (bgOption === 'custom') fillStyle = customColor || '#ffffff';
      else if (bgOption === 'fg') fillStyle = this.fgColor;
      else if (bgOption === 'bg') fillStyle = this.bgColor;

      if (bgOption !== 'transparent') {
        nctx.fillStyle = fillStyle;
        nctx.fillRect(0, 0, targetW, targetH);
      }

      if (bottomLayer.canvas) {
        nctx.drawImage(bottomLayer.canvas, ox, oy);
      }

      bottomLayer.canvas = newCanvas;
      bottomLayer.bitmap = newCanvas;
      bottomLayer.pixelW = targetW;
      bottomLayer.pixelH = targetH;
      bottomLayer.transform.x = 0;
      bottomLayer.transform.y = 0;
      bottomLayer.transform.w = targetW;
      bottomLayer.transform.h = targetH;
      bottomLayer.markChanged();
    }

    this.endEdit();
    this._emit('canvas-dirty');
    this._emit('change');
  }

  // ─── Color Palette ──────────────────────────────────────────────────────────

  _syncGradientStops() {
    if (this.gradientPreset === 'fg-bg') {
      this.gradientStops = [
        { offset: 0, color: this.fgColor },
        { offset: 1, color: this.bgColor },
      ];
    } else if (this.gradientPreset === 'fg-trans') {
      this.gradientStops = [
        { offset: 0, color: this.fgColor },
        { offset: 1, color: 'transparent' },
      ];
    }
  }

  setFgColor(color) {
    this.fgColor = color;
    this._syncGradientStops();
    this._emit('color-change', { fgColor: this.fgColor, bgColor: this.bgColor });
    this._emit('change');
  }

  setBgColor(color) {
    this.bgColor = color;
    this._syncGradientStops();
    this._emit('color-change', { fgColor: this.fgColor, bgColor: this.bgColor });
    this._emit('change');
  }

  swapColors() {
    const tmp = this.fgColor;
    this.fgColor = this.bgColor;
    this.bgColor = tmp;
    this._syncGradientStops();
    this._emit('color-change', { fgColor: this.fgColor, bgColor: this.bgColor });
    this._emit('change');
  }

  resetColors() {
    this.fgColor = '#000000';
    this.bgColor = '#ffffff';
    this._syncGradientStops();
    this._emit('color-change', { fgColor: this.fgColor, bgColor: this.bgColor });
    this._emit('change');
  }

  setGradientPreset(presetId) {
    this.gradientPreset = presetId;
    if (presetId === 'fg-bg') {
      this.gradientStops = [
        { offset: 0, color: this.fgColor },
        { offset: 1, color: this.bgColor },
      ];
    } else if (presetId === 'fg-trans') {
      this.gradientStops = [
        { offset: 0, color: this.fgColor },
        { offset: 1, color: 'transparent' },
      ];
    } else if (GRADIENT_PRESETS[presetId]) {
      this.gradientStops = normalizeStops(GRADIENT_PRESETS[presetId].stops);
    }
    this._emit('change');
  }

  setGradientStops(stops) {
    this.gradientStops = normalizeStops(stops);
    this.gradientPreset = 'custom';
    this._emit('change');
  }

  setGradientSteps(steps) {
    this.gradientSteps = Math.max(0, parseInt(steps, 10) || 0);
    this._emit('change');
  }

  setGradientOpacity(opacity) {
    this.gradientOpacity = Math.max(0, Math.min(1, typeof opacity === 'number' ? opacity : 1.0));
    this._emit('change');
  }

  reverseGradient() {
    if (!this.gradientStops || this.gradientStops.length < 2) return;
    const reversed = this.gradientStops.map(s => ({
      offset: Number((1 - s.offset).toFixed(4)),
      color: s.color,
    })).sort((a, b) => a.offset - b.offset);
    this.gradientStops = reversed;
    this.gradientPreset = 'custom';
    this._emit('change');
    this._emit('canvas-dirty');
  }

  fillGradient(options = {}) {
    let layer = this.activeLayer;
    if (!layer || layer.isGroup || layer.isLocked) {
      layer = this.addBlankLayer(this.getNextLayerName('Gradient'), { fullCanvas: true });
    }

    this.beginEdit('Fill Gradient');
    const ctx = layer.ctx;
    ctx.save();

    const scaleX = layer.pixelW / layer.transform.w;
    const scaleY = layer.pixelH / layer.transform.h;

    // Clip to selection if active
    if (this.selectionPath && this.selectionPath.length > 2) {
      ctx.beginPath();
      const first = this.selectionPath[0];
      ctx.moveTo((first.x - layer.transform.x) * scaleX, (first.y - layer.transform.y) * scaleY);
      for (let i = 1; i < this.selectionPath.length; i++) {
        const pt = this.selectionPath[i];
        ctx.lineTo((pt.x - layer.transform.x) * scaleX, (pt.y - layer.transform.y) * scaleY);
      }
      ctx.closePath();
      ctx.clip();
    } else if (this.selectionRect) {
      const sr = this.selectionRect;
      const rx = (sr.x - layer.transform.x) * scaleX;
      const ry = (sr.y - layer.transform.y) * scaleY;
      const rw = sr.w * scaleX;
      const rh = sr.h * scaleY;
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
    }

    let g;
    if (this.gradientType === 'radial') {
      const cx = layer.pixelW / 2;
      const cy = layer.pixelH / 2;
      const r = Math.max(cx, cy);
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    } else {
      const x1 = options.x1 ?? 0;
      const y1 = options.y1 ?? 0;
      const x2 = options.x2 ?? 0;
      const y2 = options.y2 ?? layer.pixelH;
      g = ctx.createLinearGradient(x1, y1, x2, y2);
    }

    const stops = this.gradientStops || [
      { offset: 0, color: this.fgColor },
      { offset: 1, color: this.bgColor },
    ];
    const stepsCount = this.gradientSteps || 0;
    if (stepsCount >= 2) {
      for (let i = 0; i < stepsCount; i++) {
        const t0 = i / stepsCount;
        const t1 = (i + 1) / stepsCount;
        const col = sampleGradient(stops, (i + 0.5) / stepsCount);
        const parsedCol = col === 'transparent' ? 'rgba(0,0,0,0)' : col;
        g.addColorStop(Math.max(0, Math.min(1, t0)), parsedCol);
        g.addColorStop(Math.max(0, Math.min(1, t1 - 0.0001)), parsedCol);
      }
    } else {
      for (const stop of stops) {
        const col = stop.color === 'transparent' ? 'rgba(0,0,0,0)' : stop.color;
        g.addColorStop(Math.max(0, Math.min(1, stop.offset)), col);
      }
    }

    ctx.globalAlpha = Math.max(0, Math.min(1, this.gradientOpacity ?? 1.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layer.pixelW, layer.pixelH);

    ctx.restore();
    layer.markChanged();
    this.endEdit();
    this._emit('canvas-dirty');
  }

  // ─── Transform (Move tool) ──────────────────────────────────────────────────

  setLayerTransform(id, transform) {
    if (!this.document) return;
    const idx = this.document.indexOfID(id);
    if (idx < 0) return;
    this.document.layers[idx].transform = transform;
    this._emit('canvas-dirty');
  }

  // ─── Tool selection ─────────────────────────────────────────────────────────

  setTool(tool) {
    if (this.tool === tool) return;
    this.tool = tool;
    this._emit('tool-change', { tool });
  }

  // ─── Collapse group ─────────────────────────────────────────────────────────

  toggleGroupCollapsed(id) {
    if (!this.document) return;
    const layer = this.document.layerByID(id);
    if (!layer?.isGroup) return;
    layer.isCollapsed = !layer.isCollapsed;
    this._emit('change');
  }
}
