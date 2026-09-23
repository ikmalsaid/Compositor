// ─────────────────────────────────────────────────────────────────────────────
// ui/inspector.js  —  Tool options / action bar under tabs with full interactive controls
// ─────────────────────────────────────────────────────────────────────────────

import { Tool } from '../store/session.js';
import {
  iconMove, iconMarquee, iconLasso, iconWand, iconCrop,
  iconEyedropper, iconBrush, iconEraser, iconClone, iconHeal,
  iconBlur, iconGradient, iconBucket, iconShape, iconText,
  iconHand, iconZoom, iconCheck, iconClose, iconTrash, iconFill
} from './icons.js';

export class Inspector {
  constructor(session) {
    this.el = document.getElementById('inspector');
    this._session = null;
    this._handlers = null;
    this.setSession(session);
  }

  setSession(session) {
    if (this._session && this._handlers) {
      this._session.off('tool-change', this._handlers.toolChange);
      this._session.off('change', this._handlers.change);
      this._session.off('color-change', this._handlers.colorChange);
      this._session.off('selection-change', this._handlers.selectionChange);
      this._session.off('placeholder', this._handlers.placeholder);
    }

    this._session = session;
    this.session = session;

    if (session) {
      this._handlers = {
        toolChange: () => this._render(),
        change: () => this._render(),
        colorChange: () => this._render(),
        selectionChange: () => this._render(),
        placeholder: (e) => this._showPlaceholder(e.detail?.feature),
      };
      session.on('tool-change', this._handlers.toolChange);
      session.on('change', this._handlers.change);
      session.on('color-change', this._handlers.colorChange);
      session.on('selection-change', this._handlers.selectionChange);
      session.on('placeholder', this._handlers.placeholder);
    }

    this._render();
  }

  _render() {
    if (!this.el) return;
    if (!this.session) {
      this.el.innerHTML = '<span class="inspector-placeholder">No active session</span>';
      return;
    }

    const { tool, document: doc } = this.session;
    this.el.innerHTML = '';

    switch (tool) {
      case Tool.MOVE:
        this._renderMoveInspector(doc);
        break;
      case Tool.BRUSH:
      case Tool.ERASER:
        this._renderBrushInspector(tool === Tool.ERASER);
        break;
      case Tool.BUCKET:
        this._renderBucketInspector();
        break;
      case Tool.EYEDROPPER:
        this._renderEyedropperInspector();
        break;
      case Tool.SHAPE:
        this._renderShapeInspector();
        break;
      case Tool.GRADIENT:
        this._renderGradientInspector();
        break;
      case Tool.CROP:
        this._renderCropInspector();
        break;
      case Tool.MARQUEE:
        this._renderMarqueeInspector();
        break;
      case Tool.LASSO:
        this._renderLassoInspector();
        break;
      case Tool.WAND:
        this._renderWandInspector();
        break;
      case Tool.CLONE:
        this._renderCloneInspector();
        break;
      case Tool.HEAL:
        this._renderHealInspector();
        break;
      case Tool.BLUR:
        this._renderBlurInspector();
        break;
      case Tool.TEXT:
        this._renderTextInspector();
        break;
      case Tool.HAND:
        this._renderHandInspector();
        break;
      case Tool.ZOOM:
        this._renderZoomInspector();
        break;
      default:
        this._renderPlaceholder(this._toolName(tool));
    }
  }

  _renderBadge(label, iconSvg = '') {
    return `<div class="inspector-badge" style="display:inline-flex;align-items:center;gap:6px;padding:2px 8px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:4px;font-size:11px;font-weight:600;color:var(--text);letter-spacing:0.3px;">${iconSvg ? `<span style="display:inline-flex;align-items:center;opacity:0.85">${iconSvg}</span>` : ''}<span>${label}</span></div>`;
  }

  _renderMoveInspector(doc) {
    const layer = this.session.activeLayer;
    if (!layer || !doc) {
      this.el.innerHTML = `
        <div class="inspector-group">
          ${this._renderBadge('Move Tool', iconMove(14))}
          <span class="inspector-placeholder" style="margin-left:8px">Select a layer to move or transform</span>
        </div>
      `;
      return;
    }

    const t = layer.transform;
    const docW = doc.width || 1;
    const docH = doc.height || 1;
    const pctW = ((t.w / docW) * 100).toFixed(1);
    const pctH = ((t.h / docH) * 100).toFixed(1);
    const pctX = ((t.x / docW) * 100).toFixed(1);
    const pctY = ((t.y / docH) * 100).toFixed(1);

    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Move', iconMove(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">X</span>
        <span class="inspector-val mono" title="${pctX}% of canvas width">${Math.round(t.x)} <span style="color:var(--accent);font-size:10px">(${pctX}%)</span></span>
        <span class="inspector-label" style="margin-left:8px">Y</span>
        <span class="inspector-val mono" title="${pctY}% of canvas height">${Math.round(t.y)} <span style="color:var(--accent);font-size:10px">(${pctY}%)</span></span>
        <span class="inspector-label" style="margin-left:8px">W</span>
        <span class="inspector-val mono" title="${pctW}% of canvas width">${Math.round(t.w)} <span style="color:var(--accent);font-size:10px">(${pctW}%)</span></span>
        <span class="inspector-label" style="margin-left:8px">H</span>
        <span class="inspector-val mono" title="${pctH}% of canvas height">${Math.round(t.h)} <span style="color:var(--accent);font-size:10px">(${pctH}%)</span></span>
        ${t.rotation ? `<span class="inspector-label" style="margin-left:8px">°</span>
        <span class="inspector-val mono">${t.rotation.toFixed(1)}°</span>` : ''}
      </div>
      ${!layer.isGroup ? `
      <div class="inspector-group" style="margin-left:8px">
        <span class="inspector-label">Shape Frame</span>
        <select class="form-input" id="layer-shape-frame" style="width:155px;padding:2px 6px">
          <option value="none" ${layer.shapeMask === 'none' || !layer.shapeMask ? 'selected' : ''}>None (Standard)</option>
          <option value="circle" ${layer.shapeMask === 'circle' || layer.shapeMask === 'ellipse' ? 'selected' : ''}>Circle / Ellipse</option>
          <option value="rounded-rectangle" ${layer.shapeMask === 'rounded-rectangle' ? 'selected' : ''}>Rounded Rect</option>
          <option value="star" ${layer.shapeMask === 'star' ? 'selected' : ''}>Star (5-pt)</option>
          <option value="heart" ${layer.shapeMask === 'heart' ? 'selected' : ''}>Heart</option>
          <option value="diamond" ${layer.shapeMask === 'diamond' ? 'selected' : ''}>Diamond</option>
          <option value="triangle" ${layer.shapeMask === 'triangle' ? 'selected' : ''}>Triangle</option>
          <option value="hexagon" ${layer.shapeMask === 'hexagon' ? 'selected' : ''}>Hexagon</option>
          <option value="pentagon" ${layer.shapeMask === 'pentagon' ? 'selected' : ''}>Pentagon</option>
          <option value="octagon" ${layer.shapeMask === 'octagon' ? 'selected' : ''}>Octagon</option>
          <option value="trapezoid" ${layer.shapeMask === 'trapezoid' ? 'selected' : ''}>Trapezoid</option>
          <option value="arrow" ${layer.shapeMask === 'arrow' ? 'selected' : ''}>Arrow</option>
        </select>
      </div>` : ''}
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-center-layer" title="Center selected layer on canvas">⌖ Center on Canvas</button>
      </div>
    `;

    this.el.querySelector('#layer-shape-frame')?.addEventListener('change', (e) => {
      this.session.beginEdit('Change Layer Frame Shape');
      layer.shapeMask = e.target.value;
      layer.markChanged();
      this.session.endEdit();
      this.session._emit('canvas-dirty');
    });

    this.el.querySelector('#btn-center-layer')?.addEventListener('click', () => {
      this.session.centerActiveLayer();
    });
  }

  _renderBucketInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Bucket Fill', iconBucket(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Tolerance</span>
        <input type="range" class="opacity-slider" id="bucket-tol-slider" min="0" max="255" value="${this.session.bucketTolerance}" style="width:80px" />
        <span class="inspector-val mono" id="bucket-tol-val">${this.session.bucketTolerance}</span>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="bucket-contig-cb" ${this.session.bucketContiguous ? 'checked' : ''} />
          <span class="inspector-label">Contiguous</span>
        </label>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="bucket-sampleall-cb" ${this.session.bucketSampleAll ? 'checked' : ''} />
          <span class="inspector-label">Sample All Layers</span>
        </label>
      </div>
      <div class="inspector-group" style="margin-left:auto">
        <span class="inspector-placeholder">Click layer or selection to flood fill</span>
      </div>
    `;

    const tolSlider = this.el.querySelector('#bucket-tol-slider');
    const tolVal    = this.el.querySelector('#bucket-tol-val');
    tolSlider?.addEventListener('input', () => {
      this.session.bucketTolerance = parseInt(tolSlider.value, 10);
      tolVal.textContent = `${this.session.bucketTolerance}`;
    });

    this.el.querySelector('#bucket-contig-cb')?.addEventListener('change', (e) => {
      this.session.bucketContiguous = e.target.checked;
    });

    this.el.querySelector('#bucket-sampleall-cb')?.addEventListener('change', (e) => {
      this.session.bucketSampleAll = e.target.checked;
    });
  }

  _renderBrushInspector(isEraser) {
    const title = isEraser ? 'Eraser' : 'Brush';
    const icon = isEraser ? iconEraser(14) : iconBrush(14);
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge(title, icon)}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Size</span>
        <input type="range" class="opacity-slider" id="brush-size" min="1" max="300" value="${this.session.brushSize}" style="width:90px" />
        <span class="inspector-val mono" id="brush-size-val">${this.session.brushSize}px</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Opacity</span>
        <input type="range" class="opacity-slider" id="brush-op" min="1" max="100" value="${Math.round(this.session.brushOpacity * 100)}" style="width:70px" />
        <span class="inspector-val mono" id="brush-op-val">${Math.round(this.session.brushOpacity * 100)}%</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Hardness</span>
        <input type="range" class="opacity-slider" id="brush-hard" min="0" max="100" value="${Math.round(this.session.brushHardness * 100)}" style="width:70px" />
        <span class="inspector-val mono" id="brush-hard-val">${Math.round(this.session.brushHardness * 100)}%</span>
      </div>
      <div class="inspector-group" style="margin-left:auto">
        <span class="inspector-placeholder">[ / ] resize brush</span>
      </div>
    `;

    const sizeInput = this.el.querySelector('#brush-size');
    const sizeVal   = this.el.querySelector('#brush-size-val');
    sizeInput.addEventListener('input', () => {
      this.session.brushSize = parseInt(sizeInput.value, 10);
      sizeVal.textContent = `${this.session.brushSize}px`;
    });

    const opInput = this.el.querySelector('#brush-op');
    const opVal   = this.el.querySelector('#brush-op-val');
    opInput.addEventListener('input', () => {
      this.session.brushOpacity = parseInt(opInput.value, 10) / 100;
      opVal.textContent = `${opInput.value}%`;
    });

    const hardInput = this.el.querySelector('#brush-hard');
    const hardVal   = this.el.querySelector('#brush-hard-val');
    hardInput.addEventListener('input', () => {
      this.session.brushHardness = parseInt(hardInput.value, 10) / 100;
      hardVal.textContent = `${hardInput.value}%`;
    });
  }

  _renderEyedropperInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Eyedropper', iconEyedropper(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Active Color</span>
        <div style="width:20px;height:20px;border-radius:4px;border:1px solid var(--panel-border);background:${this.session.fgColor};box-shadow:0 1px 3px rgba(0,0,0,0.4)"></div>
        <span class="inspector-val mono" style="font-weight:600">${this.session.fgColor.toUpperCase()}</span>
        <span class="inspector-placeholder" style="margin-left:12px">Click anywhere on canvas to sample pixel color</span>
      </div>
    `;
  }

  _renderShapeInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Shape Tool', iconShape(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Shape</span>
        <select class="form-input" id="shape-type" style="width:145px;padding:2px 6px">
          <option value="rectangle" ${this.session.shapeType === 'rectangle' ? 'selected' : ''}>Rectangle</option>
          <option value="rounded-rectangle" ${this.session.shapeType === 'rounded-rectangle' ? 'selected' : ''}>Rounded Rect</option>
          <option value="ellipse" ${this.session.shapeType === 'ellipse' ? 'selected' : ''}>Ellipse / Circle</option>
          <option value="triangle" ${this.session.shapeType === 'triangle' ? 'selected' : ''}>Triangle</option>
          <option value="star" ${this.session.shapeType === 'star' ? 'selected' : ''}>Star (5-Point)</option>
          <option value="heart" ${this.session.shapeType === 'heart' ? 'selected' : ''}>Heart</option>
          <option value="diamond" ${this.session.shapeType === 'diamond' ? 'selected' : ''}>Diamond</option>
          <option value="hexagon" ${this.session.shapeType === 'hexagon' ? 'selected' : ''}>Hexagon</option>
          <option value="pentagon" ${this.session.shapeType === 'pentagon' ? 'selected' : ''}>Pentagon</option>
          <option value="octagon" ${this.session.shapeType === 'octagon' ? 'selected' : ''}>Octagon</option>
          <option value="trapezoid" ${this.session.shapeType === 'trapezoid' ? 'selected' : ''}>Trapezoid</option>
          <option value="arrow" ${this.session.shapeType === 'arrow' ? 'selected' : ''}>Arrow</option>
          <option value="line" ${this.session.shapeType === 'line' ? 'selected' : ''}>Line</option>
        </select>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="shape-fill-cb" ${this.session.shapeFill ? 'checked' : ''} />
          <span class="inspector-label">Fill</span>
        </label>
        <div id="shape-fill-preview" style="width:18px;height:18px;border-radius:3px;border:1px solid var(--panel-border);background:${this.session.shapeFill ? this.session.fgColor : 'transparent'};cursor:pointer" title="Fill Color"></div>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="shape-stroke-cb" ${this.session.shapeStroke ? 'checked' : ''} />
          <span class="inspector-label">Stroke</span>
        </label>
        <div id="shape-stroke-preview" style="width:18px;height:18px;border-radius:3px;border:1px solid var(--panel-border);background:${this.session.shapeStroke ? this.session.bgColor : 'transparent'};cursor:pointer" title="Stroke Color"></div>
        <input type="number" class="form-input mono" id="shape-stroke-w" min="1" max="50" value="${this.session.shapeStrokeWidth}" style="width:45px;padding:2px 4px" />
        <span class="inspector-label">px</span>
      </div>
      ${this.session.shapeType === 'rounded-rectangle' ? `
      <div class="inspector-group">
        <span class="inspector-label">Radius</span>
        <input type="number" class="form-input mono" id="shape-radius" min="1" max="200" value="${this.session.shapeCornerRadius}" style="width:45px;padding:2px 4px" />
        <span class="inspector-label">px</span>
      </div>` : ''}
    `;

    this.el.querySelector('#shape-type').addEventListener('change', (e) => {
      this.session.shapeType = e.target.value;
      this._render();
    });
    this.el.querySelector('#shape-fill-cb').addEventListener('change', (e) => {
      this.session.shapeFill = e.target.checked;
      this._render();
    });
    this.el.querySelector('#shape-stroke-cb').addEventListener('change', (e) => {
      this.session.shapeStroke = e.target.checked;
      this._render();
    });
    this.el.querySelector('#shape-stroke-w')?.addEventListener('change', (e) => {
      this.session.shapeStrokeWidth = Math.max(1, parseInt(e.target.value, 10) || 1);
    });
    this.el.querySelector('#shape-radius')?.addEventListener('change', (e) => {
      this.session.shapeCornerRadius = Math.max(1, parseInt(e.target.value, 10) || 12);
    });
  }

  _renderGradientInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Gradient', iconGradient(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Type</span>
        <select class="form-input" id="grad-type" style="width:100px;padding:2px 6px">
          <option value="linear" ${this.session.gradientType === 'linear' ? 'selected' : ''}>Linear</option>
          <option value="radial" ${this.session.gradientType === 'radial' ? 'selected' : ''}>Radial</option>
        </select>
        <div style="width:120px;height:18px;border-radius:3px;border:1px solid var(--panel-border);background:linear-gradient(to right, ${this.session.fgColor}, ${this.session.bgColor});margin-left:8px;"></div>
        <span class="inspector-placeholder" style="margin-left:12px">Drag across layer to render gradient</span>
      </div>
    `;

    this.el.querySelector('#grad-type').addEventListener('change', (e) => {
      this.session.gradientType = e.target.value;
    });
  }

  _renderCropInspector() {
    const doc = this.session.document;
    const layer = this.session.activeLayer;
    const layerName = layer && !layer.isGroup ? layer.name : 'Layer';
    const cr = this.session.cropRect || (layer && !layer.isGroup ? { x: layer.transform.x, y: layer.transform.y, w: layer.transform.w, h: layer.transform.h } : (doc ? { x: 0, y: 0, w: doc.width, h: doc.height } : null));
    const cw = cr ? Math.round(cr.w) : 0;
    const ch = cr ? Math.round(cr.h) : 0;

    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Crop Tool', iconCrop(14))}
        <span class="inspector-val" style="margin-left:6px;font-weight:600;color:var(--text-bright,#fff)">Target: ${layerName}</span>
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Crop Bounds</span>
        <span class="inspector-val mono">${cw} × ${ch} px</span>
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-primary btn-sm" id="btn-crop-apply" style="display:inline-flex;align-items:center;gap:5px">${iconCheck(13)} Apply Crop (Enter)</button>
        <button class="btn btn-secondary btn-sm" id="btn-crop-cancel" style="display:inline-flex;align-items:center;gap:5px">${iconClose(12)} Cancel (Esc)</button>
      </div>
    `;

    this.el.querySelector('#btn-crop-apply')?.addEventListener('click', () => {
      const rect = this.session.cropRect || cr;
      if (rect) this.session.cropActiveLayer(rect);
    });
    this.el.querySelector('#btn-crop-cancel')?.addEventListener('click', () => {
      this.session.cropRect = null;
      this.session.setTool(Tool.MOVE);
      this.session._emit('canvas-dirty');
    });
  }

  _renderMarqueeInspector() {
    const hasSel = !!this.session.selectionRect;
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Marquee', iconMarquee(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Selection</span>
        ${hasSel ? `<span class="inspector-val mono">${Math.round(this.session.selectionRect.w)} × ${Math.round(this.session.selectionRect.h)} px</span>` : '<span class="inspector-placeholder">Drag on canvas to select region</span>'}
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-sel-fill" ${hasSel ? '' : 'disabled'} title="Fill selection with foreground color" style="display:inline-flex;align-items:center;gap:5px">${iconFill(13)} Fill Color</button>
        <button class="btn btn-secondary btn-sm" id="btn-sel-del" ${hasSel ? '' : 'disabled'} title="Clear pixels in selection" style="display:inline-flex;align-items:center;gap:5px">${iconTrash(13)} Clear (Del)</button>
        <button class="btn btn-secondary btn-sm" id="btn-sel-none" ${hasSel ? '' : 'disabled'} title="Deselect" style="display:inline-flex;align-items:center;gap:5px">${iconClose(12)} Deselect (Ctrl+D)</button>
      </div>
    `;

    this.el.querySelector('#btn-sel-fill')?.addEventListener('click', () => this.session.fillSelection());
    this.el.querySelector('#btn-sel-del')?.addEventListener('click', () => this.session.deleteSelection());
    this.el.querySelector('#btn-sel-none')?.addEventListener('click', () => this.session.deselect());
  }

  _renderLassoInspector() {
    const hasSel = !!this.session.selectionRect || !!this.session.selectionPath;
    const ptCount = this.session.selectionPath ? this.session.selectionPath.length : 0;
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Lasso Tool', iconLasso(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Mode</span>
        <span class="inspector-val" style="font-weight:600">Freehand Polygon</span>
        ${hasSel ? `<span class="inspector-val mono" style="margin-left:8px;color:var(--accent)">${ptCount ? ptCount + ' pts' : Math.round(this.session.selectionRect.w) + ' × ' + Math.round(this.session.selectionRect.h) + ' px'}</span>` : '<span class="inspector-placeholder" style="margin-left:8px">Draw freehand contour on canvas</span>'}
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-lasso-fill" ${hasSel ? '' : 'disabled'} title="Fill selection with foreground color" style="display:inline-flex;align-items:center;gap:5px">${iconFill(13)} Fill Color</button>
        <button class="btn btn-secondary btn-sm" id="btn-lasso-del" ${hasSel ? '' : 'disabled'} title="Clear pixels in selection" style="display:inline-flex;align-items:center;gap:5px">${iconTrash(13)} Clear (Del)</button>
        <button class="btn btn-secondary btn-sm" id="btn-lasso-none" ${hasSel ? '' : 'disabled'} title="Deselect" style="display:inline-flex;align-items:center;gap:5px">${iconClose(12)} Deselect (Ctrl+D)</button>
      </div>
    `;

    this.el.querySelector('#btn-lasso-fill')?.addEventListener('click', () => this.session.fillSelection());
    this.el.querySelector('#btn-lasso-del')?.addEventListener('click', () => this.session.deleteSelection());
    this.el.querySelector('#btn-lasso-none')?.addEventListener('click', () => this.session.deselect());
  }

  _renderWandInspector() {
    const hasSel = !!this.session.selectionRect;
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Magic Wand', iconWand(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Tolerance</span>
        <input type="range" class="opacity-slider" id="wand-tol-slider" min="0" max="255" value="${this.session.wandTolerance}" style="width:80px" />
        <span class="inspector-val mono" id="wand-tol-val">${this.session.wandTolerance}</span>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="wand-contig-cb" ${this.session.wandContiguous ? 'checked' : ''} />
          <span class="inspector-label">Contiguous</span>
        </label>
      </div>
      <div class="inspector-group">
        <label style="display:flex;align-items:center;gap:4px;cursor:pointer">
          <input type="checkbox" id="wand-sampleall-cb" ${this.session.wandSampleAll ? 'checked' : ''} />
          <span class="inspector-label">Sample All Layers</span>
        </label>
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-wand-fill" ${hasSel ? '' : 'disabled'} title="Fill selection with foreground color" style="display:inline-flex;align-items:center;gap:5px">${iconFill(13)} Fill Color</button>
        <button class="btn btn-secondary btn-sm" id="btn-wand-del" ${hasSel ? '' : 'disabled'} title="Clear pixels in selection" style="display:inline-flex;align-items:center;gap:5px">${iconTrash(13)} Clear (Del)</button>
        <button class="btn btn-secondary btn-sm" id="btn-wand-none" ${hasSel ? '' : 'disabled'} title="Deselect" style="display:inline-flex;align-items:center;gap:5px">${iconClose(12)} Deselect (Ctrl+D)</button>
      </div>
    `;

    const tolSlider = this.el.querySelector('#wand-tol-slider');
    const tolVal    = this.el.querySelector('#wand-tol-val');
    tolSlider?.addEventListener('input', () => {
      this.session.wandTolerance = parseInt(tolSlider.value, 10);
      tolVal.textContent = `${this.session.wandTolerance}`;
    });

    this.el.querySelector('#wand-contig-cb')?.addEventListener('change', (e) => {
      this.session.wandContiguous = e.target.checked;
    });

    this.el.querySelector('#wand-sampleall-cb')?.addEventListener('change', (e) => {
      this.session.wandSampleAll = e.target.checked;
    });

    this.el.querySelector('#btn-wand-fill')?.addEventListener('click', () => this.session.fillSelection());
    this.el.querySelector('#btn-wand-del')?.addEventListener('click', () => this.session.deleteSelection());
    this.el.querySelector('#btn-wand-none')?.addEventListener('click', () => this.session.deselect());
  }

  _renderCloneInspector() {
    const src = this.session.cloneSource;
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Clone Stamp', iconClone(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Size</span>
        <input type="range" class="opacity-slider" id="clone-size" min="1" max="300" value="${this.session.brushSize}" style="width:90px" />
        <span class="inspector-val mono" id="clone-size-val">${this.session.brushSize}px</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Opacity</span>
        <input type="range" class="opacity-slider" id="clone-op" min="1" max="100" value="${Math.round(this.session.brushOpacity * 100)}" style="width:70px" />
        <span class="inspector-val mono" id="clone-op-val">${Math.round(this.session.brushOpacity * 100)}%</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Hardness</span>
        <input type="range" class="opacity-slider" id="clone-hard" min="0" max="100" value="${Math.round(this.session.brushHardness * 100)}" style="width:70px" />
        <span class="inspector-val mono" id="clone-hard-val">${Math.round(this.session.brushHardness * 100)}%</span>
      </div>
      <div class="inspector-group" style="margin-left:6px">
        <span class="inspector-label">Source</span>
        ${src ? `<span class="inspector-val mono" style="color:var(--accent)">(${src.x}, ${src.y})</span>
        <button class="btn btn-secondary btn-sm" id="btn-clone-reset" style="margin-left:4px;padding:1px 6px">Reset</button>` : '<span class="inspector-placeholder">Alt+Click canvas to set source point</span>'}
      </div>
      <div class="inspector-group" style="margin-left:auto">
        <span class="inspector-placeholder">[ / ] resize</span>
      </div>
    `;

    const sizeInput = this.el.querySelector('#clone-size');
    const sizeVal   = this.el.querySelector('#clone-size-val');
    sizeInput?.addEventListener('input', () => {
      this.session.brushSize = parseInt(sizeInput.value, 10);
      sizeVal.textContent = `${this.session.brushSize}px`;
    });

    const opInput = this.el.querySelector('#clone-op');
    const opVal   = this.el.querySelector('#clone-op-val');
    opInput?.addEventListener('input', () => {
      this.session.brushOpacity = parseInt(opInput.value, 10) / 100;
      opVal.textContent = `${opInput.value}%`;
    });

    const hardInput = this.el.querySelector('#clone-hard');
    const hardVal   = this.el.querySelector('#clone-hard-val');
    hardInput?.addEventListener('input', () => {
      this.session.brushHardness = parseInt(hardInput.value, 10) / 100;
      hardVal.textContent = `${hardInput.value}%`;
    });

    this.el.querySelector('#btn-clone-reset')?.addEventListener('click', () => {
      this.session.cloneSource = null;
      this._render();
      this.session._emit('canvas-dirty');
    });
  }

  _renderHealInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Spot Healing', iconHeal(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Size</span>
        <input type="range" class="opacity-slider" id="heal-size" min="1" max="200" value="${this.session.healSize}" style="width:90px" />
        <span class="inspector-val mono" id="heal-size-val">${this.session.healSize}px</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Hardness</span>
        <input type="range" class="opacity-slider" id="heal-hard" min="0" max="100" value="${Math.round(this.session.healHardness * 100)}" style="width:70px" />
        <span class="inspector-val mono" id="heal-hard-val">${Math.round(this.session.healHardness * 100)}%</span>
      </div>
      <div class="inspector-group" style="margin-left:6px">
        <span class="inspector-placeholder">Click or drag over spots/blemishes to heal</span>
      </div>
      <div class="inspector-group" style="margin-left:auto">
        <span class="inspector-placeholder">[ / ] resize</span>
      </div>
    `;

    const sizeInput = this.el.querySelector('#heal-size');
    const sizeVal   = this.el.querySelector('#heal-size-val');
    sizeInput?.addEventListener('input', () => {
      this.session.healSize = parseInt(sizeInput.value, 10);
      sizeVal.textContent = `${this.session.healSize}px`;
    });

    const hardInput = this.el.querySelector('#heal-hard');
    const hardVal   = this.el.querySelector('#heal-hard-val');
    hardInput?.addEventListener('input', () => {
      this.session.healHardness = parseInt(hardInput.value, 10) / 100;
      hardVal.textContent = `${hardInput.value}%`;
    });
  }

  _renderBlurInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Blur Tool', iconBlur(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Radius</span>
        <input type="range" class="opacity-slider" id="blur-size" min="5" max="100" value="${this.session.brushSize}" style="width:90px" />
        <span class="inspector-val mono" id="blur-size-val">${this.session.brushSize}px</span>
        <span class="inspector-placeholder" style="margin-left:12px">Paint on layer to soften pixels</span>
      </div>
    `;
    const sizeInput = this.el.querySelector('#blur-size');
    const sizeVal   = this.el.querySelector('#blur-size-val');
    sizeInput.addEventListener('input', () => {
      this.session.brushSize = parseInt(sizeInput.value, 10);
      sizeVal.textContent = `${this.session.brushSize}px`;
    });
  }

  _renderHandInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Hand (Pan)', iconHand(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-placeholder">Drag viewport or hold Space with any tool</span>
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-zoom-fit">Fit Screen (Ctrl+0)</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-100">100% (Ctrl+1)</button>
      </div>
    `;
    this.el.querySelector('#btn-zoom-fit')?.addEventListener('click', () => window._canvasView?.zoomToFit());
    this.el.querySelector('#btn-zoom-100')?.addEventListener('click', () => window._canvasView?.zoomTo(1));
  }

  _renderZoomInspector() {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Zoom Tool', iconZoom(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-placeholder">Click or scroll to zoom in/out</span>
      </div>
      <div class="inspector-group" style="margin-left:auto;gap:6px">
        <button class="btn btn-secondary btn-sm" id="btn-zoom-in">Zoom In (+)</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-out">Zoom Out (-)</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-fit">Fit Screen (Ctrl+0)</button>
        <button class="btn btn-secondary btn-sm" id="btn-zoom-100">100% (Ctrl+1)</button>
      </div>
    `;
    this.el.querySelector('#btn-zoom-in')?.addEventListener('click', () => window._canvasView?.zoomBy(1.25));
    this.el.querySelector('#btn-zoom-out')?.addEventListener('click', () => window._canvasView?.zoomBy(0.8));
    this.el.querySelector('#btn-zoom-fit')?.addEventListener('click', () => window._canvasView?.zoomToFit());
    this.el.querySelector('#btn-zoom-100')?.addEventListener('click', () => window._canvasView?.zoomTo(1));
  }

  _renderPlaceholder(toolName) {
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge(toolName)}
        <div class="placeholder-banner" style="margin-left:8px;font-size:11px;color:var(--text-muted)">Feature coming in a future update</div>
      </div>
    `;
  }

  _showPlaceholder(feature) {
    this.el.style.outline = '1px solid var(--accent)';
    setTimeout(() => { if (this.el) this.el.style.outline = ''; }, 600);
  }

  _toolName(tool) {
    const names = {
      move: 'Move', brush: 'Brush', eraser: 'Eraser', heal: 'Spot Healing', clone: 'Clone Stamp',
      blur: 'Blur', crop: 'Crop', gradient: 'Gradient', shape: 'Shape',
      eyedropper: 'Eyedropper', lasso: 'Lasso', marquee: 'Marquee', wand: 'Magic Wand',
      hand: 'Hand', zoom: 'Zoom', text: 'Text',
    };
    return names[tool] ?? tool;
  }

  _renderTextInspector() {
    const s = this.session;
    this.el.innerHTML = `
      <div class="inspector-group">
        ${this._renderBadge('Text Tool', iconText(14))}
      </div>
      <div class="inspector-group" style="margin-left:4px">
        <span class="inspector-label">Font</span>
        <select class="form-input" id="text-font" style="width:120px;padding:2px 6px">
          <option value="Inter, sans-serif" ${s.fontFamily.startsWith('Inter') ? 'selected' : ''}>Inter</option>
          <option value="Arial, sans-serif" ${s.fontFamily.startsWith('Arial') ? 'selected' : ''}>Arial</option>
          <option value="Georgia, serif" ${s.fontFamily.startsWith('Georgia') ? 'selected' : ''}>Georgia</option>
          <option value="'Courier New', monospace" ${s.fontFamily.includes('Courier') ? 'selected' : ''}>Courier New</option>
          <option value="'Times New Roman', serif" ${s.fontFamily.includes('Times') ? 'selected' : ''}>Times New Roman</option>
          <option value="Verdana, sans-serif" ${s.fontFamily.startsWith('Verdana') ? 'selected' : ''}>Verdana</option>
          <option value="'Segoe UI', sans-serif" ${s.fontFamily.includes('Segoe') ? 'selected' : ''}>Segoe UI</option>
          <option value="Consolas, monospace" ${s.fontFamily.startsWith('Consolas') ? 'selected' : ''}>Consolas</option>
          <option value="Impact, sans-serif" ${s.fontFamily.startsWith('Impact') ? 'selected' : ''}>Impact</option>
        </select>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Size</span>
        <input type="number" class="form-input mono" id="text-size" min="6" max="500" value="${s.fontSize}" style="width:50px;padding:2px 4px" />
        <span class="inspector-label">px</span>
      </div>
      <div class="inspector-group">
        <button class="btn btn-sm ${s.fontWeight === 'bold' ? 'btn-primary' : 'btn-secondary'}" id="text-bold" title="Bold" style="min-width:28px;font-weight:bold">B</button>
        <button class="btn btn-sm ${s.fontStyle === 'italic' ? 'btn-primary' : 'btn-secondary'}" id="text-italic" title="Italic" style="min-width:28px;font-style:italic">I</button>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Align</span>
        <button class="btn btn-sm ${s.textAlign === 'left' ? 'btn-primary' : 'btn-secondary'}" id="text-align-l" title="Align Left">≡⃖</button>
        <button class="btn btn-sm ${s.textAlign === 'center' ? 'btn-primary' : 'btn-secondary'}" id="text-align-c" title="Align Center">≡</button>
        <button class="btn btn-sm ${s.textAlign === 'right' ? 'btn-primary' : 'btn-secondary'}" id="text-align-r" title="Align Right">≡⃗</button>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Line H</span>
        <input type="range" class="opacity-slider" id="text-lh" min="0.8" max="3" value="${s.lineHeight}" step="0.1" style="width:60px" />
        <span class="inspector-val mono" id="text-lh-val">${s.lineHeight.toFixed(1)}</span>
      </div>
      <div class="inspector-group">
        <span class="inspector-label">Spacing</span>
        <input type="range" class="opacity-slider" id="text-ls" min="-5" max="20" value="${s.letterSpacing}" step="0.5" style="width:60px" />
        <span class="inspector-val mono" id="text-ls-val">${s.letterSpacing}px</span>
      </div>
      <div class="inspector-group" style="margin-left:auto">
        <span class="inspector-placeholder">Click on canvas to place text</span>
      </div>
    `;

    this.el.querySelector('#text-font').addEventListener('change', (e) => {
      this.session.fontFamily = e.target.value;
    });
    this.el.querySelector('#text-size').addEventListener('change', (e) => {
      this.session.fontSize = Math.max(6, Math.min(500, parseInt(e.target.value, 10) || 48));
    });
    this.el.querySelector('#text-bold').addEventListener('click', () => {
      this.session.fontWeight = this.session.fontWeight === 'bold' ? 'normal' : 'bold';
      this._render();
    });
    this.el.querySelector('#text-italic').addEventListener('click', () => {
      this.session.fontStyle = this.session.fontStyle === 'italic' ? 'normal' : 'italic';
      this._render();
    });
    this.el.querySelector('#text-align-l').addEventListener('click', () => { this.session.textAlign = 'left'; this._render(); });
    this.el.querySelector('#text-align-c').addEventListener('click', () => { this.session.textAlign = 'center'; this._render(); });
    this.el.querySelector('#text-align-r').addEventListener('click', () => { this.session.textAlign = 'right'; this._render(); });

    const lhInput = this.el.querySelector('#text-lh');
    const lhVal = this.el.querySelector('#text-lh-val');
    lhInput.addEventListener('input', () => {
      this.session.lineHeight = parseFloat(lhInput.value);
      lhVal.textContent = parseFloat(lhInput.value).toFixed(1);
    });

    const lsInput = this.el.querySelector('#text-ls');
    const lsVal = this.el.querySelector('#text-ls-val');
    lsInput.addEventListener('input', () => {
      this.session.letterSpacing = parseFloat(lsInput.value);
      lsVal.textContent = `${lsInput.value}px`;
    });
  }
}
