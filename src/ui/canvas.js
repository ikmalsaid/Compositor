// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ui/canvas.js  â€”  Canvas compositor + viewport interaction + full editing tools
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

import { Tool } from '../store/session.js';
import { blendModeToCompositeOp } from '../store/document.js';
import { LayerTransform } from '../store/document.js';
import { RulerView } from './ruler.js';
import { openTextEditor, closeTextEditor, renderTextToLayer, layerNameFromText, isTextEditorOpen, getActiveTextEditingLayer } from './panels/textEditor.js';
import { showContextMenu, closeContextMenu } from './panels/contextMenu.js';
import { promptDeleteLayers } from './panels/layerDialogs.js';
import { removeBackground } from '../ai/backgroundRemoval.js';
import { sampleGradient } from '../assets/gradientData.js';

const MIN_ZOOM = 0.05;
const MAX_ZOOM = 32;
const ZOOM_STEP = 1.2;

const ROTATE_CURSOR = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none'%3E%3Cpath d='M21 12a9 9 0 1 1-2.64-6.36L21 8m0-6v6h-6' stroke='%23000000' stroke-width='3.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3Cpath d='M21 12a9 9 0 1 1-2.64-6.36L21 8m0-6v6h-6' stroke='%23ffffff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E") 12 12, crosshair`;

export class CanvasView {
  constructor(session) {
    this._session = session;
    this.area = document.getElementById('canvas-area');
    this.el = document.getElementById('compositor-canvas');
    this.ctx = this.el.getContext('2d');
    this.empty = document.getElementById('canvas-empty');
    this.zoomLbl = document.getElementById('zoom-label');

    // Scrollbar elements
    this.sbH = document.getElementById('canvas-scrollbar-h');
    this.sbV = document.getElementById('canvas-scrollbar-v');
    this.thumbH = this.sbH?.querySelector?.('.canvas-scrollbar-thumb') || null;
    this.thumbV = this.sbV?.querySelector?.('.canvas-scrollbar-thumb') || null;

    // Ruler & Guides overlay
    this.rulerView = new RulerView(this, this._session);

    // Viewport dimensions tracker
    this._lastAreaW = this.area.clientWidth || 800;
    this._lastAreaH = this.area.clientHeight || 600;

    // Viewport transform
    this.scale = 1;
    this.tx = 0; // translation x (screen pixels inside canvas-area)
    this.ty = 0; // translation y (screen pixels inside canvas-area)

    // HUD & Overlays
    this.hud = document.getElementById('transform-hud');
    this._isAngleSnapped = false;

    // Interaction state
    this._drag = null;
    this._rafId = null;
    this._dirty = false;
    this._isSpaceDown = false;
    this._cursorDocPos = null;
    this._liveShape = null;
    this._liveGrad = null;
    this._activeSnapLines = null;

    // Marching ants selection animation state
    this._marchingAntsOffset = 0;
    this._antsAnimId = null;

    this._initResizeObserver();
    window.addEventListener('resize', () => {
      this.zoomToFit();
    });
    this._bindScrollbarEvents();
    this._bindEvents();
    this._bindSession();
    this._scheduleRender();
  }

  docToScreen(dx, dy) {
    return [dx * this.scale + this.tx, dy * this.scale + this.ty];
  }

  get session() {
    return this._session;
  }

  set session(s) {
    this.setSession(s);
  }

  setSession(s) {
    if (this._session && this._sessionHandlers) {
      this._session.off('canvas-dirty', this._sessionHandlers.dirty);
      this._session.off('change', this._sessionHandlers.change);
      this._session.off('tool-change', this._sessionHandlers.toolChange);
      this._session.off('selection-change', this._sessionHandlers.selChange);
      this._session.off('text-editor-open', this._sessionHandlers.textOpen);
      this._session.off('text-editor-close', this._sessionHandlers.textClose);
    }
    this._session = s;
    if (this.rulerView) this.rulerView.session = s;
    if (s) {
      if (s.viewScale) {
        this.scale = s.viewScale;
      } else {
        s.viewScale = this.scale;
      }
      this._notifyZoomChange();
      this._sessionHandlers = {
        dirty: () => this._markDirty(),
        change: () => this._updateAreaTool(),
        toolChange: () => {
          this._updateAreaTool();
          this._markDirty();
        },
        selChange: () => this._onSelectionChange(),
        textOpen: () => {
          this._startAntsAnimation();
          this._markDirty();
        },
        textClose: () => {
          if (!this.session?.hasSelection || !this.session.hasSelection()) {
            this._stopAntsAnimation();
          }
          this._markDirty();
        },
      };
      s.on('canvas-dirty', this._sessionHandlers.dirty);
      s.on('change', this._sessionHandlers.change);
      s.on('tool-change', this._sessionHandlers.toolChange);
      s.on('selection-change', this._sessionHandlers.selChange);
      s.on('text-editor-open', this._sessionHandlers.textOpen);
      s.on('text-editor-close', this._sessionHandlers.textClose);
      if ((s.hasSelection && s.hasSelection()) || isTextEditorOpen() || this._liveTextBox) {
        this._startAntsAnimation();
      } else {
        this._stopAntsAnimation();
      }
    } else {
      this._stopAntsAnimation();
    }
    this._updateAreaTool();
    this._markDirty();
  }

  _onSelectionChange() {
    if ((this.session?.hasSelection && this.session.hasSelection()) || isTextEditorOpen() || this._liveTextBox) {
      this._startAntsAnimation();
    } else {
      this._stopAntsAnimation();
    }
    this._markDirty();
  }

  _startAntsAnimation() {
    if (this._antsAnimId) return;
    let lastTime = performance.now();
    const loop = (now) => {
      const hasSel = this.session?.hasSelection && this.session.hasSelection();
      const isEditingText = isTextEditorOpen();
      const isDraggingTextBox = !!this._liveTextBox;

      if (!hasSel && !isEditingText && !isDraggingTextBox) {
        this._stopAntsAnimation();
        return;
      }
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      this._marchingAntsOffset = (this._marchingAntsOffset + dt * 14) % 8;
      this._markDirty();
      this._antsAnimId = requestAnimationFrame(loop);
    };
    this._antsAnimId = requestAnimationFrame(loop);
  }

  _stopAntsAnimation() {
    if (this._antsAnimId) {
      cancelAnimationFrame(this._antsAnimId);
      this._antsAnimId = null;
    }
  }

  // â”€â”€â”€ Session bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _bindSession() {
    this.setSession(this._session);

    // Menu zoom commands (bind once)
    if (!this._menuBound) {
      this._menuBound = true;
      window.api?.onMenu?.('menu:zoom-in', () => this.zoomBy(ZOOM_STEP));
      window.api?.onMenu?.('menu:zoom-out', () => this.zoomBy(1 / ZOOM_STEP));
      window.api?.onMenu?.('menu:zoom-fit', () => this.zoomToFit());
      window.api?.onMenu?.('menu:zoom-100', () => this.zoomTo(1));
    }
  }

  _updateAreaTool() {
    if (this.area?.dataset) this.area.dataset.tool = this.session.tool;
  }

  // â”€â”€â”€ Rendering â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _markDirty() {
    this._dirty = true;
    this._scheduleRender();
  }

  _scheduleRender() {
    if (this._rafId) return;
    this._rafId = requestAnimationFrame(() => {
      this._rafId = null;
      this._render();
    });
  }

  _render() {
    const doc = this.session.document;

    if (!doc) {
      this.empty.classList.remove('hidden');
      this.el.classList.add('hidden');
      return;
    }

    this.empty.classList.add('hidden');
    this.el.classList.remove('hidden');

    // Resize canvas element if doc size changed
    if (this.el.width !== doc.width || this.el.height !== doc.height) {
      this.el.width = doc.width;
      this.el.height = doc.height;
      this.zoomToFit();
    }

    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.clearRect(0, 0, doc.width, doc.height);

    // Checkerboard background
    this._drawCheckerboard(ctx, doc.width, doc.height);

    // Composite all visible layers (bottom â†’ top)
    const visibleLayers = doc.layers.filter(l => l.isVisible && !l.isGroup);
    for (const layer of visibleLayers) {
      const src = layer.canvas || layer.bitmap;
      if (!src) continue;
      this._compositeLayer(ctx, layer, src);
    }

    // Overlays: Live Drawing, Transform Handles, Selection, Crop, Brush Cursor
    this._renderOverlays(ctx, doc);

    // Update canvas element position/scale via CSS transform
    this.el.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
    this.el.style.transformOrigin = '0 0';

    this._dirty = false;
    this._updateZoomLabel();
    this._updateScrollbars();
    this._updateTransformHUD(this.session.activeLayer);
    this.rulerView?.update(this._cursorDocPos);
  }

  _getCheckerPattern(ctx) {
    if (this._checkerPattern) return this._checkerPattern;
    const size = 12;
    const pc = document.createElement('canvas');
    pc.width = size * 2;
    pc.height = size * 2;
    const pctx = pc.getContext('2d');
    pctx.fillStyle = '#dcdcdc';
    pctx.fillRect(0, 0, size * 2, size * 2);
    pctx.fillStyle = '#bcbcbc';
    pctx.fillRect(size, 0, size, size);
    pctx.fillRect(0, size, size, size);
    this._checkerPattern = ctx.createPattern(pc, 'repeat');
    return this._checkerPattern;
  }

  _drawCheckerboard(ctx, w, h) {
    ctx.fillStyle = this._getCheckerPattern(ctx);
    ctx.fillRect(0, 0, w, h);
  }

  _compositeLayer(ctx, layer, src) {
    const t = layer.transform;
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);

    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    ctx.translate(cx, cy);
    if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);
    if (t.flipX) ctx.scale(-1, 1);
    if (t.flipY) ctx.scale(1, -1);

    // Canva-style non-destructive Shape Masking / Framing
    if (layer.shapeMask && layer.shapeMask !== 'none') {
      ctx.beginPath();
      this._applyShapePath(ctx, layer.shapeMask, -t.w / 2, -t.h / 2, t.w, t.h, layer.shapeCornerRadius || 12);
      ctx.clip();
    }

    ctx.drawImage(src, -t.w / 2, -t.h / 2, t.w, t.h);

    ctx.restore();
  }

  _renderOverlays(ctx, doc) {
    ctx.save();
    ctx.globalAlpha = 1.0;
    ctx.globalCompositeOperation = 'source-over';

    const tool = this.session.tool;

    // Active Snap Guidelines (Smart Snapping)
    if (this._activeSnapLines && this._drag) {
      ctx.save();
      ctx.strokeStyle = '#ff477e';
      ctx.lineWidth = 1 / this.scale;
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      for (const gx of this._activeSnapLines.x || []) {
        ctx.beginPath();
        ctx.moveTo(gx, 0);
        ctx.lineTo(gx, doc.height);
        ctx.stroke();
      }
      for (const gy of this._activeSnapLines.y || []) {
        ctx.beginPath();
        ctx.moveTo(0, gy);
        ctx.lineTo(doc.width, gy);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 1. Move & Cursor Tool Handles on Active Layer
    if ((tool === Tool.MOVE || tool === Tool.CURSOR) && this.session.activeLayer) {
      this._drawTransformHandles(ctx, this.session.activeLayer, tool === Tool.CURSOR);
    }

    // Cursor multi-layer marquee drag box
    if (this._drag && this._drag.type === 'cursor-marquee') {
      const minX = Math.min(this._drag.startDX, this._drag.currDX);
      const minY = Math.min(this._drag.startDY, this._drag.currDY);
      const mw = Math.abs(this._drag.currDX - this._drag.startDX);
      const mh = Math.abs(this._drag.currDY - this._drag.startDY);
      ctx.save();
      ctx.fillStyle = 'rgba(79, 142, 247, 0.12)';
      ctx.fillRect(minX, minY, mw, mh);
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1 / this.scale;
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.strokeRect(minX, minY, mw, mh);
      ctx.restore();
    }

    // 2. Selection (Marquee, Lasso polygon, or Magic Wand)
    if (this.session.selectionPath && this.session.selectionPath.length > 1) {
      const pts = this.session.selectionPath;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 / this.scale;
      ctx.stroke();
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.lineDashOffset = -this._marchingAntsOffset / this.scale;
      ctx.stroke();
      ctx.restore();
    } else if (this.session.selectionRect) {
      const r = this.session.selectionRect;
      ctx.save();
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1 / this.scale;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.strokeStyle = '#ffffff';
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.lineDashOffset = -this._marchingAntsOffset / this.scale;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      ctx.restore();
    }

    // Live Lasso drag polygon
    if (this._drag && this._drag.type === 'lasso' && this._drag.points?.length > 1) {
      const pts = this._drag.points;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Crop Overlay
    if (tool === Tool.CROP && this.session.cropRect) {
      const cr = this.session.cropRect;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      if (cr.y > 0) ctx.fillRect(0, 0, doc.width, cr.y);
      if (cr.y + cr.h < doc.height) ctx.fillRect(0, cr.y + cr.h, doc.width, doc.height - (cr.y + cr.h));
      if (cr.x > 0) ctx.fillRect(0, cr.y, cr.x, cr.h);
      if (cr.x + cr.w < doc.width) ctx.fillRect(cr.x + cr.w, cr.y, doc.width - (cr.x + cr.w), cr.h);

      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.strokeRect(cr.x, cr.y, cr.w, cr.h);

      // Rule of thirds grid
      if (cr.w > 30 && cr.h > 30) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1 / this.scale;
        ctx.beginPath();
        ctx.moveTo(cr.x, cr.y + cr.h / 3);
        ctx.lineTo(cr.x + cr.w, cr.y + cr.h / 3);
        ctx.moveTo(cr.x, cr.y + (2 * cr.h) / 3);
        ctx.lineTo(cr.x + cr.w, cr.y + (2 * cr.h) / 3);
        ctx.moveTo(cr.x + cr.w / 3, cr.y);
        ctx.lineTo(cr.x + cr.w / 3, cr.y + cr.h);
        ctx.moveTo(cr.x + (2 * cr.w) / 3, cr.y);
        ctx.lineTo(cr.x + (2 * cr.w) / 3, cr.y + cr.h);
        ctx.stroke();
      }

      // Draw 8 handles on crop
      this._drawBoxHandles(ctx, cr.x, cr.y, cr.w, cr.h);
    }

    // 4. Live Shape preview
    if (this._liveShape) {
      this._drawLiveShape(ctx, this._liveShape);
    }

    // 4b. Live Text Box preview (animated dotted lines)
    if (this._liveTextBox) {
      const tb = this._liveTextBox;
      ctx.save();
      ctx.fillStyle = 'rgba(79, 142, 247, 0.08)';
      ctx.fillRect(tb.x, tb.y, tb.w, tb.h);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.setLineDash([4 / this.scale, 4 / this.scale]);
      ctx.lineDashOffset = -this._marchingAntsOffset / this.scale;
      ctx.strokeRect(tb.x, tb.y, tb.w, tb.h);
      if (tb.w > 20 && tb.h > 20) {
        this._drawBoxHandles(ctx, tb.x, tb.y, tb.w, tb.h);
      }
      ctx.restore();
    }

    // 4c. Active Text Layer editing bounding box (animated dotted lines)
    if (isTextEditorOpen()) {
      const editingLayer = getActiveTextEditingLayer() || this.session.activeLayer;
      if (editingLayer && editingLayer.transform) {
        const tx = editingLayer.transform.x;
        const ty = editingLayer.transform.y;
        const tw = Math.max(16, editingLayer.transform.w);
        const th = Math.max(16, editingLayer.transform.h);

        ctx.save();
        ctx.fillStyle = 'rgba(79, 142, 247, 0.06)';
        ctx.fillRect(tx, ty, tw, th);

        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1.5 / this.scale;
        ctx.strokeRect(tx, ty, tw, th);

        ctx.strokeStyle = '#4f8ef7';
        ctx.lineWidth = 1.5 / this.scale;
        ctx.setLineDash([4 / this.scale, 4 / this.scale]);
        ctx.lineDashOffset = -this._marchingAntsOffset / this.scale;
        ctx.strokeRect(tx, ty, tw, th);

        if (tw > 20 && th > 20) {
          this._drawBoxHandles(ctx, tx, ty, tw, th);
        }
        ctx.restore();
      }
    }

    // 5. Live Gradient preview & interactive vector guide
    if (this._liveGrad) {
      this._renderLiveGradientPreview(ctx, doc);
    }

    // 6. Clone Source Marker
    if (tool === Tool.CLONE && this.session.cloneSource) {
      const cs = this.session.cloneSource;
      const size = 8 / this.scale;
      ctx.save();
      ctx.strokeStyle = '#4f8ef7';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.beginPath();
      ctx.arc(cs.x, cs.y, size, 0, Math.PI * 2);
      ctx.moveTo(cs.x - size * 1.5, cs.y);
      ctx.lineTo(cs.x + size * 1.5, cs.y);
      ctx.moveTo(cs.x, cs.y - size * 1.5);
      ctx.lineTo(cs.x, cs.y + size * 1.5);
      ctx.stroke();
      ctx.restore();
    }

    // 7. Brush / Eraser / Blur / Clone / Heal Cursor Indicator
    if ((tool === Tool.BRUSH || tool === Tool.ERASER || tool === Tool.BLUR || tool === Tool.CLONE || tool === Tool.HEAL) && this._cursorDocPos) {
      const bSize = tool === Tool.HEAL ? (this.session.healSize || 24) : this.session.brushSize;
      const r = bSize / 2;
      ctx.beginPath();
      ctx.arc(this._cursorDocPos.x, this._cursorDocPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 1.5 / this.scale;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(this._cursorDocPos.x, this._cursorDocPos.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      ctx.lineWidth = 0.75 / this.scale;
      ctx.stroke();
    }

    ctx.restore();
  }

  _drawTransformHandles(ctx, layer, isCursorOnly = false) {
    const t = layer.transform;
    ctx.save();
    const cx = t.cx, cy = t.cy;
    ctx.translate(cx, cy);
    if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);

    const hw = t.w / 2, hh = t.h / 2;
    ctx.strokeStyle = '#4f8ef7';
    ctx.lineWidth = 1.5 / this.scale;
    ctx.strokeRect(-hw, -hh, t.w, t.h);

    if (isCursorOnly) {
      ctx.restore();
      return;
    }

    // 8 resize handles
    const handleSize = 7 / this.scale;
    const pts = [
      [-hw, -hh], [0, -hh], [hw, -hh],
      [-hw, 0], [hw, 0],
      [-hw, hh], [0, hh], [hw, hh],
    ];
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#1e1e1e';
    ctx.lineWidth = 1 / this.scale;
    for (const [px, py] of pts) {
      ctx.fillRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
    }

    // Rotation handle at top
    const rotDist = 20 / this.scale;
    ctx.beginPath();
    ctx.moveTo(0, -hh);
    ctx.lineTo(0, -hh - rotDist);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, -hh - rotDist, handleSize / 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.restore();
  }

  _updateTransformHUD(layer) {
    if (!this.hud) return;
    if (!this._drag || !layer || (this._drag.type !== 'move' && this._drag.type !== 'resize' && this._drag.type !== 'rotate')) {
      this.hud.style.display = 'none';
      return;
    }

    const doc = this.session.document;
    if (!doc) {
      this.hud.style.display = 'none';
      return;
    }

    const t = layer.transform;
    const docW = doc.width || 1;
    const docH = doc.height || 1;
    const dragType = this._drag.type;

    let linesHTML = '';
    if (dragType === 'resize') {
      const wp = ((t.w / docW) * 100).toFixed(1);
      const hp = ((t.h / docH) * 100).toFixed(1);
      const aspect = (t.w / (t.h || 1)).toFixed(2);
      linesHTML = `
        <div class="hud-line"><span class="hud-label">W:</span> <span class="hud-val">${Math.round(t.w)}px</span> <span class="hud-pct">(${wp}%)</span></div>
        <div class="hud-line"><span class="hud-label">H:</span> <span class="hud-val">${Math.round(t.h)}px</span> <span class="hud-pct">(${hp}%)</span></div>
        <div class="hud-line"><span class="hud-label">Ratio:</span> <span class="hud-val">${aspect}:1</span></div>
      `;
    } else if (dragType === 'rotate') {
      const rot = ((t.rotation % 360 + 360) % 360);
      const rotFixed = rot.toFixed(1);
      const turnPct = ((rot / 360) * 100).toFixed(1);
      const isSnapped = !!this._isAngleSnapped;
      linesHTML = `
        <div class="hud-line"><span class="hud-label">Angle:</span> <span class="hud-val${isSnapped ? ' snapped' : ''}">${rotFixed}Â°</span></div>
        <div class="hud-line"><span class="hud-label">Turn:</span> <span class="hud-val">${turnPct}%</span></div>
      `;
    } else if (dragType === 'move') {
      const xp = ((t.x / docW) * 100).toFixed(1);
      const yp = ((t.y / docH) * 100).toFixed(1);
      const snapX = !!(this._activeSnapLines?.x?.length);
      const snapY = !!(this._activeSnapLines?.y?.length);
      linesHTML = `
        <div class="hud-line"><span class="hud-label">X:</span> <span class="hud-val${snapX ? ' snapped' : ''}">${Math.round(t.x)}px</span> <span class="hud-pct">(${xp}%)</span></div>
        <div class="hud-line"><span class="hud-label">Y:</span> <span class="hud-val${snapY ? ' snapped' : ''}">${Math.round(t.y)}px</span> <span class="hud-pct">(${yp}%)</span></div>
      `;
    }

    this.hud.innerHTML = linesHTML;
    this.hud.style.display = 'flex';

    // Position HUD relative to the layer in screen/viewport space
    const [scx] = this.docToScreen(t.cx, t.cy);
    const [, sby] = this.docToScreen(t.x, t.y + t.h);

    const hudW = this.hud.offsetWidth || 130;
    const hudH = this.hud.offsetHeight || 50;
    const areaW = this.area.clientWidth;
    const areaH = this.area.clientHeight;

    // Default position: centered horizontally under the layer bottom edge
    let hx = scx - hudW / 2;
    let hy = sby + 16;

    // If too close to bottom of screen area, place above layer
    if (hy + hudH > areaH - 16) {
      const [, stopY] = this.docToScreen(t.x, t.y);
      hy = stopY - hudH - 16;
    }

    // Clamp within visible viewport so tooltip is NEVER clipped or hidden
    hx = Math.max(12, Math.min(areaW - hudW - 12, hx));
    hy = Math.max(28, Math.min(areaH - hudH - 12, hy));

    this.hud.style.left = `${Math.round(hx)}px`;
    this.hud.style.top = `${Math.round(hy)}px`;
  }

  // â”€â”€â”€ Transform Handles & Hit-Testing â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _getTransformHandleAt(layer, dx, dy) {
    if (!layer || layer.isLocked || layer.isGroup) return null;
    const t = layer.transform;
    const cx = t.cx;
    const cy = t.cy;
    const hw = t.w / 2;
    const hh = t.h / 2;
    const rotRad = -(t.rotation || 0) * Math.PI / 180;

    // Convert (dx, dy) to layer local space centered at (0, 0)
    const relX = dx - cx;
    const relY = dy - cy;
    const lx = relX * Math.cos(rotRad) - relY * Math.sin(rotRad);
    const ly = relX * Math.sin(rotRad) + relY * Math.cos(rotRad);

    const tol = Math.max(6, 9 / this.scale);

    // 1. Rotation knob at top
    const rotDist = 20 / this.scale;
    if (Math.hypot(lx - 0, ly - (-hh - rotDist)) <= tol + 4) {
      return 'rot';
    }

    // 2. 8 resize handles
    if (Math.abs(lx - (-hw)) <= tol && Math.abs(ly - (-hh)) <= tol) return 'nw';
    if (Math.abs(lx - hw) <= tol && Math.abs(ly - (-hh)) <= tol) return 'ne';
    if (Math.abs(lx - (-hw)) <= tol && Math.abs(ly - hh) <= tol) return 'sw';
    if (Math.abs(lx - hw) <= tol && Math.abs(ly - hh) <= tol) return 'se';
    if (Math.abs(lx - 0) <= tol && Math.abs(ly - (-hh)) <= tol) return 'n';
    if (Math.abs(lx - 0) <= tol && Math.abs(ly - hh) <= tol) return 's';
    if (Math.abs(lx - (-hw)) <= tol && Math.abs(ly - 0) <= tol) return 'w';
    if (Math.abs(lx - hw) <= tol && Math.abs(ly - 0) <= tol) return 'e';

    // 3. Body hit inside bounding box
    if (Math.abs(lx) <= hw && Math.abs(ly) <= hh) {
      return 'body';
    }

    return null;
  }

  _getCursorForHandle(handle, rotation = 0) {
    if (!handle) return '';
    if (handle === 'rot') return ROTATE_CURSOR;
    if (handle === 'body') return 'grab';

    const handleAngles = {
      'e': 0, 'se': 45, 's': 90, 'sw': 135,
      'w': 180, 'nw': 225, 'n': 270, 'ne': 315
    };
    const baseAngle = handleAngles[handle] ?? 0;
    const totalAngle = (baseAngle + rotation) % 360;
    const norm = (totalAngle + 360) % 180;

    if (norm >= 22.5 && norm < 67.5) return 'nwse-resize';
    if (norm >= 67.5 && norm < 112.5) return 'ns-resize';
    if (norm >= 112.5 && norm < 157.5) return 'nesw-resize';
    return 'ew-resize';
  }

  _drawBoxHandles(ctx, x, y, w, h) {
    const handleSize = 8 / this.scale;
    const pts = [
      [x, y], [x + w / 2, y], [x + w, y],
      [x, y + h / 2], [x + w, y + h / 2],
      [x, y + h], [x + w / 2, y + h], [x + w, y + h]
    ];
    ctx.fillStyle = '#4f8ef7';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1 / this.scale;
    for (const [px, py] of pts) {
      ctx.fillRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
      ctx.strokeRect(px - handleSize / 2, py - handleSize / 2, handleSize, handleSize);
    }
  }

  /**
   * Apply mathematical 2D path for all supported vector shapes & masks
   */
  _applyShapePath(ctx, shapeType, x, y, w, h, cornerRadius = 12, startX = null, startY = null, curX = null, curY = null) {
    const type = shapeType || 'rectangle';
    const absW = Math.abs(w);
    const absH = Math.abs(h);

    if (type === 'rectangle') {
      ctx.rect(x, y, w, h);
    } else if (type === 'rounded-rectangle') {
      const r = Math.min(cornerRadius, absW / 2, absH / 2);
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, r);
      } else {
        ctx.rect(x, y, w, h);
      }
    } else if (type === 'ellipse' || type === 'circle') {
      ctx.ellipse(x + w / 2, y + h / 2, Math.max(0.1, absW / 2), Math.max(0.1, absH / 2), 0, 0, Math.PI * 2);
    } else if (type === 'triangle') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (type === 'star') {
      // 5-point star
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = absW / 2;
      const ry = absH / 2;
      const irx = rx * 0.4;
      const iry = ry * 0.4;
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI / 5) - (Math.PI / 2);
        const rpx = (i % 2 === 0) ? rx : irx;
        const rpy = (i % 2 === 0) ? ry : iry;
        const px = cx + rpx * Math.cos(angle);
        const py = cy + rpy * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (type === 'hexagon') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = absW / 2;
      const ry = absH / 2;
      for (let i = 0; i < 6; i++) {
        const angle = (i * Math.PI / 3) - (Math.PI / 2);
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (type === 'pentagon') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = absW / 2;
      const ry = absH / 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI / 5) - (Math.PI / 2);
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (type === 'octagon') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = absW / 2;
      const ry = absH / 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i * 2 * Math.PI / 8) - (Math.PI / 8);
        const px = cx + rx * Math.cos(angle);
        const py = cy + ry * Math.sin(angle);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else if (type === 'trapezoid') {
      const inset = w * 0.2;
      ctx.moveTo(x + inset, y);
      ctx.lineTo(x + w - inset, y);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.closePath();
    } else if (type === 'diamond') {
      ctx.moveTo(x + w / 2, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w / 2, y + h);
      ctx.lineTo(x, y + h / 2);
      ctx.closePath();
    } else if (type === 'heart') {
      const topCurveHeight = h * 0.3;
      ctx.moveTo(x + w / 2, y + h);
      ctx.bezierCurveTo(
        x, y + h * 0.6,
        x, y + topCurveHeight * 0.3,
        x + w * 0.25, y
      );
      ctx.bezierCurveTo(
        x + w * 0.45, y,
        x + w / 2, y + topCurveHeight * 0.8,
        x + w / 2, y + topCurveHeight
      );
      ctx.bezierCurveTo(
        x + w / 2, y + topCurveHeight * 0.8,
        x + w * 0.55, y,
        x + w * 0.75, y
      );
      ctx.bezierCurveTo(
        x + w, y + topCurveHeight * 0.3,
        x + w, y + h * 0.6,
        x + w / 2, y + h
      );
      ctx.closePath();
    } else if (type === 'arrow') {
      const headW = w * 0.4;
      const shaftH = h * 0.4;
      const shaftY = y + (h - shaftH) / 2;
      ctx.moveTo(x, shaftY);
      ctx.lineTo(x + w - headW, shaftY);
      ctx.lineTo(x + w - headW, y);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - headW, y + h);
      ctx.lineTo(x + w - headW, shaftY + shaftH);
      ctx.lineTo(x, shaftY + shaftH);
      ctx.closePath();
    } else if (type === 'line') {
      ctx.moveTo(startX ?? x, startY ?? y);
      ctx.lineTo(curX ?? (x + w), curY ?? (y + h));
    } else {
      ctx.rect(x, y, w, h);
    }
  }

  _getShapeBaseName(shapeType) {
    switch (shapeType) {
      case 'rectangle': return 'Rectangle';
      case 'rounded-rectangle': return 'Rounded Rect';
      case 'ellipse':
      case 'circle': return 'Circle';
      case 'triangle': return 'Triangle';
      case 'star': return 'Star';
      case 'hexagon': return 'Hexagon';
      case 'pentagon': return 'Pentagon';
      case 'octagon': return 'Octagon';
      case 'trapezoid': return 'Trapezoid';
      case 'diamond': return 'Diamond';
      case 'heart': return 'Heart';
      case 'arrow': return 'Arrow';
      case 'line': return 'Line';
      default: return 'Shape';
    }
  }

  _drawLiveShape(ctx, shape) {
    ctx.save();
    ctx.fillStyle = this.session.fgColor;
    ctx.strokeStyle = this.session.bgColor;
    ctx.lineWidth = this.session.shapeStrokeWidth;

    const { x, y, w, h, type, startX, startY, curX, curY } = shape;
    ctx.beginPath();
    this._applyShapePath(ctx, type, x, y, w, h, this.session.shapeCornerRadius, startX, startY, curX, curY);

    if (type !== 'line') {
      if (this.session.shapeFill) ctx.fill();
      if (this.session.shapeStroke) ctx.stroke();
    } else {
      ctx.stroke();
    }
    ctx.restore();
  }

  _renderLiveGradientPreview(ctx, doc) {
    if (!this._liveGrad) return;
    const { x1, y1, x2, y2, isSnapped } = this._liveGrad;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const invScale = 1 / this.scale;

    // 1. Live Gradient Raster Preview (shows actual colors while dragging)
    if (dist >= 3) {
      ctx.save();

      // Determine clipping: selection or active layer or doc
      if (this.session.selectionPath && this.session.selectionPath.length > 2) {
        ctx.beginPath();
        const first = this.session.selectionPath[0];
        ctx.moveTo(first.x, first.y);
        for (let i = 1; i < this.session.selectionPath.length; i++) {
          const pt = this.session.selectionPath[i];
          ctx.lineTo(pt.x, pt.y);
        }
        ctx.closePath();
        ctx.clip();
      } else if (this.session.selectionRect) {
        const sr = this.session.selectionRect;
        ctx.beginPath();
        ctx.rect(sr.x, sr.y, sr.w, sr.h);
        ctx.clip();
      } else {
        const layer = this.session.activeLayer;
        if (layer && !layer.isGroup && !layer.isLocked && layer.transform) {
          ctx.beginPath();
          ctx.rect(layer.transform.x, layer.transform.y, layer.transform.w, layer.transform.h);
          ctx.clip();
        } else {
          ctx.beginPath();
          ctx.rect(0, 0, doc.width, doc.height);
          ctx.clip();
        }
      }

      let g;
      if (this.session.gradientType === 'radial') {
        g = ctx.createRadialGradient(x1, y1, 0, x1, y1, Math.max(1, dist));
      } else {
        g = ctx.createLinearGradient(x1, y1, x2, y2);
      }

      const stops = this.session.gradientStops || [
        { offset: 0, color: this.session.fgColor },
        { offset: 1, color: this.session.bgColor },
      ];

      const stepsCount = this.session.gradientSteps || 0;
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

      ctx.globalAlpha = Math.max(0, Math.min(1, this.session.gradientOpacity ?? 1.0));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, doc.width, doc.height);
      ctx.restore();
    }

    // 2. High-Contrast Vector Guide Line with Start/End Handles & Stop Pins
    ctx.save();

    // Vector line shadow / outline
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.lineWidth = 3.5 * invScale;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Vector line inner accent
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * invScale;
    ctx.stroke();

    const stops = this.session.gradientStops || [];
    const cos = dist > 0 ? (x2 - x1) / dist : 1;
    const sin = dist > 0 ? (y2 - y1) / dist : 0;
    const perpX = -sin;
    const perpY = cos;
    const elasticScale = Math.min(1.4, Math.max(0.85, 0.85 + Math.sqrt(dist) * 0.022));

    // Directional elastic chevrons along the shaft showing flow direction
    if (dist >= 45 * invScale && stops.length <= 3) {
      const chevronCount = dist >= 160 * invScale ? 3 : (dist >= 85 * invScale ? 2 : 1);
      const chevronOffsets = chevronCount === 1 ? [0.5] : (chevronCount === 2 ? [0.35, 0.70] : [0.25, 0.50, 0.75]);
      const cLen = 5.5 * invScale * elasticScale;
      const cWing = 4.5 * invScale * elasticScale;

      for (const t of chevronOffsets) {
        const cx = x1 + (x2 - x1) * t;
        const cy = y1 + (y2 - y1) * t;

        ctx.beginPath();
        ctx.moveTo(cx - cos * cLen + perpX * cWing, cy - sin * cLen + perpY * cWing);
        ctx.lineTo(cx + cos * cLen, cy + sin * cLen);
        ctx.lineTo(cx - cos * cLen - perpX * cWing, cy - sin * cLen - perpY * cWing);
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.lineWidth = 3 * invScale;
        ctx.stroke();

        ctx.strokeStyle = isSnapped ? '#ffcf33' : '#ffffff';
        ctx.lineWidth = 1.4 * invScale;
        ctx.stroke();
      }
    }

    // Intermediate color stops along the line
    if (dist >= 15 && stops.length > 2) {
      for (let i = 1; i < stops.length - 1; i++) {
        const stop = stops[i];
        const sx = x1 + (x2 - x1) * stop.offset;
        const sy = y1 + (y2 - y1) * stop.offset;
        const pinR = 3.5 * invScale;

        ctx.beginPath();
        ctx.arc(sx, sy, pinR + 1 * invScale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fill();

        ctx.beginPath();
        ctx.arc(sx, sy, pinR, 0, Math.PI * 2);
        ctx.fillStyle = stop.color === 'transparent' ? 'rgba(255,255,255,0.4)' : stop.color;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1 * invScale;
        ctx.stroke();
      }
    }

    // Start handle circle (at x1, y1)
    const handleR = 5.5 * invScale;
    ctx.beginPath();
    ctx.arc(x1, y1, handleR + 1.5 * invScale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x1, y1, handleR, 0, Math.PI * 2);
    const firstCol = stops[0]?.color;
    ctx.fillStyle = firstCol === 'transparent' ? 'rgba(255,255,255,0.4)' : (firstCol || '#000000');
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * invScale;
    ctx.stroke();

    // End handle circle (at x2, y2)
    ctx.beginPath();
    ctx.arc(x2, y2, handleR + 1.5 * invScale, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(x2, y2, handleR, 0, Math.PI * 2);
    const lastCol = stops[stops.length - 1]?.color;
    ctx.fillStyle = lastCol === 'transparent' ? 'rgba(255,255,255,0.4)' : (lastCol || '#ffffff');
    ctx.fill();
    ctx.strokeStyle = isSnapped ? '#ffcf33' : '#4f8ef7';
    ctx.lineWidth = 1.8 * invScale;
    ctx.stroke();

    // 3. Elastic Directional Arrowhead at the tip
    if (dist >= 8) {
      const headLen = 14 * invScale * elasticScale;
      const wingW = 8 * invScale * elasticScale;

      const tipX = x2 + cos * (headLen + 2 * invScale);
      const tipY = y2 + sin * (headLen + 2 * invScale);
      const wingLeftX = x2 - cos * (headLen * 0.15) + perpX * wingW;
      const wingLeftY = y2 - sin * (headLen * 0.15) + perpY * wingW;
      const wingRightX = x2 - cos * (headLen * 0.15) - perpX * wingW;
      const wingRightY = y2 - sin * (headLen * 0.15) - perpY * wingW;
      const notchX = x2 + cos * (headLen * 0.2);
      const notchY = y2 + sin * (headLen * 0.2);

      // Outer shadow & stroke
      ctx.beginPath();
      ctx.moveTo(tipX, tipY);
      ctx.lineTo(wingLeftX, wingLeftY);
      ctx.lineTo(notchX, notchY);
      ctx.lineTo(wingRightX, wingRightY);
      ctx.closePath();

      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 3.5 * invScale;
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Arrowhead body fill (vibrant accent or snapped gold)
      ctx.fillStyle = isSnapped ? '#ffcf33' : '#4f8ef7';
      ctx.fill();

      // Arrowhead inner highlight stroke
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4 * invScale;
      ctx.stroke();
    }

    // Radial circle outline preview if radial type
    if (this.session.gradientType === 'radial' && dist >= 4) {
      ctx.beginPath();
      ctx.arc(x1, y1, dist, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 1 * invScale;
      ctx.setLineDash([4 * invScale, 4 * invScale]);
      ctx.stroke();
    }

    // Floating Angle & Length HUD badge (positioned cleanly perpendicular to arrow)
    if (dist >= 8) {
      let rawAngle = (Math.atan2(sin, cos) * 180 / Math.PI);
      if (rawAngle < 0) rawAngle += 360;
      const angleText = `${Math.round(rawAngle)}°`;
      const lengthText = `${Math.round(dist)}px`;
      const badgeText = isSnapped ? `${angleText} · ${lengthText} (45°)` : `${angleText} · ${lengthText}`;

      ctx.font = `${Math.max(10, Math.round(11 * invScale))}px system-ui, -apple-system, sans-serif`;
      const textW = ctx.measureText(badgeText).width;
      const padX = 6 * invScale;
      const padY = 3 * invScale;
      const boxW = textW + padX * 2;
      const boxH = 18 * invScale;

      // Position perpendicular to the arrow direction so it never collides with arrowhead
      const badgeOffset = 22 * invScale;
      const perpSign = perpY >= 0 ? 1 : -1;
      const boxX = x2 + perpX * badgeOffset * perpSign - boxW / 2;
      const boxY = y2 + perpY * badgeOffset * perpSign - boxH / 2;

      // Dark rounded pill background
      ctx.fillStyle = 'rgba(18, 18, 24, 0.88)';
      ctx.strokeStyle = isSnapped ? 'rgba(255, 207, 51, 0.7)' : 'rgba(255, 255, 255, 0.25)';
      ctx.lineWidth = 1 * invScale;
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(boxX, boxY, boxW, boxH, 4 * invScale);
      } else {
        ctx.rect(boxX, boxY, boxW, boxH);
      }
      ctx.fill();
      ctx.stroke();

      // Text inside pill
      ctx.fillStyle = isSnapped ? '#ffcf33' : '#ffffff';
      ctx.textBaseline = 'middle';
      ctx.fillText(badgeText, boxX + padX, boxY + boxH / 2);
    }

    ctx.restore();
  }

  // â”€â”€â”€ Resize & Scrollbars â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _initResizeObserver() {
    if (typeof ResizeObserver === 'undefined') return;
    this._resizeObs = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newW = entry.contentRect.width;
        const newH = entry.contentRect.height;
        if (newW > 0 && newH > 0) {
          if (this._lastAreaW > 0 && this._lastAreaH > 0 && (newW !== this._lastAreaW || newH !== this._lastAreaH)) {
            this._lastAreaW = newW;
            this._lastAreaH = newH;
            this.zoomToFit();
          } else {
            this._lastAreaW = newW;
            this._lastAreaH = newH;
          }
        }
      }
    });
    this._resizeObs.observe(this.area);
  }

  _updateScrollbars() {
    const doc = this.session.document;
    if (!doc || !this.sbH || !this.sbV || !this.thumbH || !this.thumbV) {
      if (this.sbH) this.sbH.style.display = 'none';
      if (this.sbV) this.sbV.style.display = 'none';
      return;
    }

    const areaW = this.area.clientWidth;
    const areaH = this.area.clientHeight;
    if (areaW <= 0 || areaH <= 0) return;

    const docW = doc.width * this.scale;
    const docH = doc.height * this.scale;

    // Horizontal Scrollbar
    const minTX = Math.min(this.tx, areaW - docW - 60);
    const maxTX = Math.max(this.tx, 60);
    const rangeX = maxTX - minTX;
    const trackW = Math.max(10, areaW - 10);

    if (docW > areaW || Math.abs(this.tx - (areaW - docW) / 2) > 10) {
      this.sbH.style.display = 'block';
      const visibleRatioX = Math.min(1, areaW / (docW + areaW * 0.4));
      const thumbW = Math.max(24, Math.round(trackW * visibleRatioX));
      const normX = rangeX > 0 ? (maxTX - this.tx) / rangeX : 0.5;
      const thumbLeft = Math.max(0, Math.min(trackW - thumbW, Math.round(normX * (trackW - thumbW))));
      this.thumbH.style.width = `${thumbW}px`;
      this.thumbH.style.left = `${thumbLeft}px`;
    } else {
      this.sbH.style.display = 'none';
    }

    // Vertical Scrollbar
    const minTY = Math.min(this.ty, areaH - docH - 60);
    const maxTY = Math.max(this.ty, 60);
    const rangeY = maxTY - minTY;
    const trackH = Math.max(10, areaH - 10);

    if (docH > areaH || Math.abs(this.ty - (areaH - docH) / 2) > 10) {
      this.sbV.style.display = 'block';
      const visibleRatioY = Math.min(1, areaH / (docH + areaH * 0.4));
      const thumbH = Math.max(24, Math.round(trackH * visibleRatioY));
      const normY = rangeY > 0 ? (maxTY - this.ty) / rangeY : 0.5;
      const thumbTop = Math.max(0, Math.min(trackH - thumbH, Math.round(normY * (trackH - thumbH))));
      this.thumbV.style.height = `${thumbH}px`;
      this.thumbV.style.top = `${thumbTop}px`;
    } else {
      this.sbV.style.display = 'none';
    }
  }

  _bindScrollbarEvents() {
    if (!this.sbH || !this.sbV || !this.thumbH || !this.thumbV) return;

    // Horizontal thumb dragging
    this.thumbH.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startTX = this.tx;
      const trackW = Math.max(10, this.area.clientWidth - 10);
      const thumbW = this.thumbH.offsetWidth;
      const maxTravel = trackW - thumbW;
      this.sbH.classList.add('dragging');
      this.thumbH.classList.add('dragging');

      const onMove = (me) => {
        const dx = me.clientX - startX;
        const doc = this.session.document;
        if (!doc || maxTravel <= 0) return;
        const docW = doc.width * this.scale;
        const minTX = Math.min(this.tx, this.area.clientWidth - docW - 60);
        const maxTX = Math.max(this.tx, 60);
        const rangeX = maxTX - minTX;
        this.tx = Math.round(startTX - (dx / maxTravel) * rangeX);
        this._markDirty();
      };

      const onUp = () => {
        this.sbH.classList.remove('dragging');
        this.thumbH.classList.remove('dragging');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Vertical thumb dragging
    this.thumbV.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      e.preventDefault();
      const startY = e.clientY;
      const startTY = this.ty;
      const trackH = Math.max(10, this.area.clientHeight - 10);
      const thumbH = this.thumbV.offsetHeight;
      const maxTravel = trackH - thumbH;
      this.sbV.classList.add('dragging');
      this.thumbV.classList.add('dragging');

      const onMove = (me) => {
        const dy = me.clientY - startY;
        const doc = this.session.document;
        if (!doc || maxTravel <= 0) return;
        const docH = doc.height * this.scale;
        const minTY = Math.min(this.ty, this.area.clientHeight - docH - 60);
        const maxTY = Math.max(this.ty, 60);
        const rangeY = maxTY - minTY;
        this.ty = Math.round(startTY - (dy / maxTravel) * rangeY);
        this._markDirty();
      };

      const onUp = () => {
        this.sbV.classList.remove('dragging');
        this.thumbV.classList.remove('dragging');
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
    });

    // Track clicking
    this.sbH.addEventListener('pointerdown', (e) => {
      if (e.target === this.thumbH) return;
      const rect = this.sbH.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const thumbLeft = this.thumbH.offsetLeft;
      const dir = clickX < thumbLeft ? 1 : -1;
      this.tx += dir * Math.round(this.area.clientWidth * 0.4);
      this._markDirty();
    });

    this.sbV.addEventListener('pointerdown', (e) => {
      if (e.target === this.thumbV) return;
      const rect = this.sbV.getBoundingClientRect();
      const clickY = e.clientY - rect.top;
      const thumbTop = this.thumbV.offsetTop;
      const dir = clickY < thumbTop ? 1 : -1;
      this.ty += dir * Math.round(this.area.clientHeight * 0.4);
      this._markDirty();
    });
  }

  // â”€â”€â”€ Zoom & Pan â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  centerCanvas() {
    const doc = this.session.document;
    if (!doc) return;
    const rect = this.area.getBoundingClientRect();
    this.tx = Math.round((rect.width - doc.width * this.scale) / 2);
    this.ty = Math.round((rect.height - doc.height * this.scale) / 2);
    this._markDirty();
  }

  zoomToFit() {
    const doc = this.session?.document;
    if (!doc) return;
    const rect = this.area.getBoundingClientRect();
    const margin = 40;
    const availW = Math.max(10, rect.width - margin * 2);
    const availH = Math.max(10, rect.height - margin * 2);
    const sx = availW / doc.width;
    const sy = availH / doc.height;
    const s = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Math.min(sx, sy)));
    this.scale = s;
    this.tx = Math.round((rect.width - doc.width * s) / 2);
    this.ty = Math.round((rect.height - doc.height * s) / 2);
    this._notifyZoomChange();
    this._markDirty();
  }

  zoomTo(scale, screenX, screenY) {
    const doc = this.session?.document;
    if (!doc) return;
    const rect = this.area.getBoundingClientRect();
    const ox = screenX ?? (rect.width / 2);
    const oy = screenY ?? (rect.height / 2);
    const newScale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, scale));

    this.tx = ox - (ox - this.tx) * (newScale / this.scale);
    this.ty = oy - (oy - this.ty) * (newScale / this.scale);
    this.scale = newScale;
    this._notifyZoomChange();
    this._markDirty();
  }

  zoomBy(factor, screenX, screenY) {
    this.zoomTo(this.scale * factor, screenX, screenY);
  }

  screenToDoc(sx, sy) {
    return [(sx - this.tx) / this.scale, (sy - this.ty) / this.scale];
  }

  _notifyZoomChange() {
    this._updateZoomLabel();
    if (this.session) {
      this.session.viewScale = this.scale;
      if (typeof this.session._emit === 'function') {
        this.session._emit('zoom-change', { scale: this.scale });
      } else if (typeof this.session.emit === 'function') {
        this.session.emit('zoom-change', { scale: this.scale });
      }
    }
  }

  _updateZoomLabel() {
    const pct = `${Math.round(this.scale * 100)}%`;
    this.zoomLbl.textContent = pct;
    const statusZoom = document.getElementById('status-zoom');
    if (statusZoom) statusZoom.textContent = pct;
  }

  // â”€â”€â”€ Event Handling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _bindEvents() {
    const area = this.area;

    // Mouse wheel: zoom with Ctrl/Alt/ZoomTool, pan horizontally with Shift, pan vertically otherwise
    area.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = area.getBoundingClientRect();
      const ox = e.clientX - rect.left;
      const oy = e.clientY - rect.top;

      if (e.ctrlKey || e.altKey || this.session.tool === Tool.ZOOM) {
        const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
        this.zoomBy(factor, ox, oy);
      } else if (e.shiftKey) {
        this.tx -= (e.deltaY || e.deltaX);
        this._markDirty();
      } else {
        this.ty -= e.deltaY;
        if (e.deltaX) this.tx -= e.deltaX;
        this._markDirty();
      }
    }, { passive: false });

    area.addEventListener('pointerdown', (e) => this._onPointerDown(e));
    area.addEventListener('pointermove', (e) => this._onPointerMove(e));
    area.addEventListener('pointerup', (e) => this._onPointerUp(e));
    area.addEventListener('contextmenu', (e) => this._onContextMenu(e));
    area.addEventListener('dblclick', (e) => {
      const rect = this.area.getBoundingClientRect();
      const [dx, dy] = this.screenToDoc(e.clientX - rect.left, e.clientY - rect.top);

      if (this.session.tool === Tool.CROP && this.session.cropRect) {
        const cr = this.session.cropRect;
        if (dx >= cr.x && dx <= cr.x + cr.w && dy >= cr.y && dy <= cr.y + cr.h) {
          this.session.cropActiveLayer(cr);
        }
        return;
      }

      // Re-edit text layer on double click (e.g. from Move tool or Selection)
      const layers = this.session.document?.layers || [];
      const hitText = [...layers].reverse().find(l =>
        l.textData && l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy)
      );
      if (hitText) {
        this.session.activeLayerID = hitText.id;
        this.session.selectedLayerIDs = new Set([hitText.id]);
        this.session.beginEdit('Edit Text');
        const targetDocX = hitText.transform.x;
        const targetDocY = hitText.transform.y;

        openTextEditor(
          this.session, hitText, targetDocX, targetDocY,
          hitText.textData,
          () => {
            hitText.markChanged();
            this.session.endEdit();
            this.session.setTool(Tool.MOVE);
            this.session._emit('canvas-dirty');
          },
          () => {
            this.session.endEdit();
            renderTextToLayer(hitText, targetDocX, targetDocY, hitText.textData);
            this.session._emit('canvas-dirty');
          },
          { initialBoxW: hitText.transform.w, initialBoxH: hitText.transform.h }
        );
      }
    });
    area.addEventListener('pointerleave', () => {
      this._cursorDocPos = null;
      this._endDrag();
      this._markDirty();
    });

    // Drop images onto canvas
    area.addEventListener('dragover', (e) => {
      e.preventDefault();
      area.classList.add('drop-target');
    });
    area.addEventListener('dragleave', () => area.classList.remove('drop-target'));
    area.addEventListener('drop', (e) => this._onDrop(e));

    // Keyboard navigation & shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this._isSpaceDown && e.target.tagName !== 'INPUT') {
        this._isSpaceDown = true;
        this.area.classList.add('panning');
      }
      if (e.key === 'Escape' && this._drag?.type === 'gradient') {
        this._liveGrad = null;
        this._drag = null;
        this._endDrag();
        this._markDirty();
      }
      if (e.key === 'Shift' && this._drag?.type === 'gradient' && this._cursorDocPos) {
        this._updateGradientDrag(this._cursorDocPos.x, this._cursorDocPos.y, true);
        this._markDirty();
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._isSpaceDown = false;
        if (!this._drag || this._drag.type !== 'pan') this.area.classList.remove('panning');
      }
      if (e.key === 'Shift' && this._drag?.type === 'gradient' && this._cursorDocPos) {
        this._updateGradientDrag(this._cursorDocPos.x, this._cursorDocPos.y, false);
        this._markDirty();
      }
    });
  }

  _onPointerDown(e) {
    // Only capture and handle pointer down for left (0) and middle (1) mouse buttons.
    // Do NOT capture on right-click (2) so context menu interactions are never trapped.
    if (e.button !== 0 && e.button !== 1) return;
    this.area.setPointerCapture(e.pointerId);
    const rect = this.area.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [dx, dy] = this.screenToDoc(sx, sy);

    const tool = this.session.tool;
    const doc = this.session.document;
    if (!doc) return;

    // Pan with spacebar or middle mouse button or Hand tool
    if (e.button === 1 || this._isSpaceDown || tool === Tool.HAND || (tool !== Tool.ZOOM && e.altKey && e.button === 0)) {
      this._drag = { type: 'pan', startSX: sx, startSY: sy, startTX: this.tx, startTY: this.ty };
      this.area.classList.add('panning');
      return;
    }

    // Zoom tool
    if (tool === Tool.ZOOM) {
      if (e.altKey) this.zoomBy(1 / ZOOM_STEP, sx, sy);
      else this.zoomBy(ZOOM_STEP, sx, sy);
      return;
    }

    // Eyedropper tool
    if (tool === Tool.EYEDROPPER) {
      const px = Math.floor(dx);
      const py = Math.floor(dy);
      if (px >= 0 && px < doc.width && py >= 0 && py < doc.height) {
        const imgData = this.ctx.getImageData(px, py, 1, 1);
        const [r, g, b] = imgData.data;
        const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
        this.session.setFgColor(hex);
      }
      return;
    }

    // Cursor tool (Selection & neutral interaction)
    if (tool === Tool.CURSOR) {
      const active = this.session.activeLayer;

      // 1. If clicked on active layer body
      if (active && !active.isLocked && !active.isGroup && active.transform.contains(dx, dy)) {
        this.session.beginEdit('Move Layer');
        this._drag = {
          type: 'move',
          layerID: active.id,
          startDX: dx,
          startDY: dy,
          origX: active.transform.x,
          origY: active.transform.y,
        };
        return;
      }

      // 2. Hit-test topmost visible, unlocked layer
      const hit = [...doc.layers].reverse().find(l => l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy));
      if (hit) {
        this.session.selectLayer(hit.id, { isToggle: e.ctrlKey || e.metaKey, isRange: e.shiftKey });
        this.session.beginEdit('Move Layer');
        this._drag = {
          type: 'move',
          layerID: hit.id,
          startDX: dx, startDY: dy,
          origX: hit.transform.x,
          origY: hit.transform.y,
        };
        return;
      }

      // 3. Clicked empty space -> start marquee multi-selection
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
        this.session.selectedLayerIDs.clear();
        this.session.activeLayerID = null;
        this.session._emit('change');
        this.session._emit('canvas-dirty');
      }
      this._drag = {
        type: 'cursor-marquee',
        startDX: dx,
        startDY: dy,
        currDX: dx,
        currDY: dy,
      };
      return;
    }

    // Move tool
    if (tool === Tool.MOVE) {
      const active = this.session.activeLayer;

      // 1. Check if active layer's handle or body was clicked
      if (active && !active.isLocked && !active.isGroup) {
        const handle = this._getTransformHandleAt(active, dx, dy);
        if (handle === 'rot') {
          const startAngle = Math.atan2(dy - active.transform.cy, dx - active.transform.cx) * 180 / Math.PI;
          this.session.beginEdit('Rotate Layer');
          this._drag = {
            type: 'rotate',
            layerID: active.id,
            origTransform: active.transform.clone(),
            startAngle,
          };
          return;
        } else if (handle && handle !== 'body') {
          this.session.beginEdit('Resize Layer');
          this._drag = {
            type: 'resize',
            handle,
            layerID: active.id,
            origTransform: active.transform.clone(),
            startDX: dx,
            startDY: dy,
          };
          return;
        } else if (handle === 'body') {
          this.session.beginEdit('Move Layer');
          this._drag = {
            type: 'move',
            layerID: active.id,
            startDX: dx,
            startDY: dy,
            origX: active.transform.x,
            origY: active.transform.y,
          };
          return;
        }
      }

      // 2. If active layer was not hit, search topmost visible, unlocked layer
      const hit = [...doc.layers].reverse().find(l => l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy));
      if (hit) {
        this.session.setActiveLayer(hit.id);
        this.session.beginEdit('Move Layer');
        this._drag = {
          type: 'move',
          layerID: hit.id,
          startDX: dx, startDY: dy,
          origX: hit.transform.x,
          origY: hit.transform.y,
        };
      }
      return;
    }

    // Crop tool
    if (tool === Tool.CROP) {
      const cr = this.session.cropRect;

      if (cr) {
        // Detect handle hit (8 handles + body) for resize/move
        const hw = Math.max(8, 8 / this.scale); // handle half-width in doc coords
        const handles = [
          { id: 'nw', x: cr.x,           y: cr.y },
          { id: 'n',  x: cr.x + cr.w/2,  y: cr.y },
          { id: 'ne', x: cr.x + cr.w,    y: cr.y },
          { id: 'e',  x: cr.x + cr.w,    y: cr.y + cr.h/2 },
          { id: 'se', x: cr.x + cr.w,    y: cr.y + cr.h },
          { id: 's',  x: cr.x + cr.w/2,  y: cr.y + cr.h },
          { id: 'sw', x: cr.x,           y: cr.y + cr.h },
          { id: 'w',  x: cr.x,           y: cr.y + cr.h/2 },
        ];
        const hitHandle = handles.find(h => Math.abs(dx - h.x) <= hw && Math.abs(dy - h.y) <= hw);

        if (hitHandle) {
          this._drag = { type: 'crop-resize', handle: hitHandle.id, startDX: dx, startDY: dy, origCrop: { ...cr } };
        } else if (dx >= cr.x && dx <= cr.x + cr.w && dy >= cr.y && dy <= cr.y + cr.h) {
          this._drag = { type: 'crop-move', startDX: dx, startDY: dy, origCrop: { ...cr } };
        } else {
          this._drag = { type: 'crop-draw', startDX: dx, startDY: dy, origCrop: { ...cr } };
        }
      } else {
        this._drag = { type: 'crop-draw', startDX: dx, startDY: dy };
      }
      return;
    }

    // Marquee tool
    if (tool === Tool.MARQUEE) {
      this._drag = { type: 'marquee', startDX: dx, startDY: dy };
      return;
    }

    // Lasso tool — Freehand polygon selection
    if (tool === Tool.LASSO) {
      this._drag = { type: 'lasso', points: [{ x: dx, y: dy }] };
      this._markDirty();
      return;
    }

    // Magic Wand tool — Tolerance flood selection
    if (tool === Tool.WAND) {
      this._performWandSelection(dx, dy);
      return;
    }

    // Clone Stamp tool — Alt+Click to sample source, normal drag to stamp
    if (tool === Tool.CLONE) {
      if (e.altKey) {
        this.session.cloneSource = { x: Math.round(dx), y: Math.round(dy) };
        this.session._emit('change');
        this._markDirty();
        return;
      }

      let layer = this.session.activeLayer;
      if (!layer || layer.isGroup || layer.isLocked) {
        layer = this.session.addBlankLayer(this.session.getNextLayerName('Clone Stamp'), { fullCanvas: true });
      }

      if (!this.session.cloneSource) {
        this.session.cloneSource = { x: Math.round(dx), y: Math.round(dy) };
      }

      const layerX = (dx - layer.transform.x) * (layer.pixelW / layer.transform.w);
      const layerY = (dy - layer.transform.y) * (layer.pixelH / layer.transform.h);

      this.session.beginEdit('Clone Stamp');

      const srcDocX = this.session.cloneSource.x;
      const srcDocY = this.session.cloneSource.y;

      const sourceCanvas = document.createElement('canvas');
      sourceCanvas.width = doc.width;
      sourceCanvas.height = doc.height;
      const sctx = sourceCanvas.getContext('2d', { willReadFrequently: true });
      sctx.drawImage(this.el, 0, 0);

      this._drag = {
        type: Tool.CLONE,
        layerID: layer.id,
        startDX: dx,
        startDY: dy,
        srcDocX,
        srcDocY,
        sourceCanvas,
        lastLX: layerX,
        lastLY: layerY,
      };

      this._paintCloneStamp(layer, dx, dy, dx, dy, srcDocX, srcDocY, sourceCanvas);
      this._markDirty();
      return;
    }

    // Spot Healing tool — Blemish diffusion & repair
    if (tool === Tool.HEAL) {
      let layer = this.session.activeLayer;
      if (!layer || layer.isGroup || layer.isLocked) {
        layer = this.session.addBlankLayer(this.session.getNextLayerName('Healing Layer'), { fullCanvas: true });
      }

      const layerX = (dx - layer.transform.x) * (layer.pixelW / layer.transform.w);
      const layerY = (dy - layer.transform.y) * (layer.pixelH / layer.transform.h);

      this.session.beginEdit('Spot Healing');
      this._drag = {
        type: Tool.HEAL,
        layerID: layer.id,
        points: [{ x: layerX, y: layerY }],
      };

      this._healRegion(layer, [{ x: layerX, y: layerY }]);
      this._markDirty();
      return;
    }

    // Gradient tool
    if (tool === Tool.GRADIENT) {
      this._drag = { type: 'gradient', startDX: dx, startDY: dy };
      this._liveGrad = { x1: dx, y1: dy, x2: dx, y2: dy, isSnapped: false };
      return;
    }

    // Bucket Fill tool
    if (tool === Tool.BUCKET) {
      this._performBucketFill(dx, dy);
      return;
    }

    // Text tool — wait for user to select & drag bounding box with crosshair, then create text layer
    if (tool === Tool.TEXT) {
      const layers = this.session.document?.layers ?? [];

      // Check if clicked on an existing text layer — re-open editor for it
      const hitText = [...layers].reverse().find(l =>
        l.textData && l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy)
      );

      if (hitText) {
        this.session.activeLayerID = hitText.id;
        this.session.selectedLayerIDs = new Set([hitText.id]);
        this.session.beginEdit('Edit Text');
        const targetDocX = hitText.transform.x;
        const targetDocY = hitText.transform.y;

        openTextEditor(
          this.session, hitText, targetDocX, targetDocY,
          hitText.textData,
          () => {
            hitText.markChanged();
            this.session.endEdit();
            this.session.setTool(Tool.MOVE);
            this.session._emit('canvas-dirty');
          },
          () => {
            // Cancel edit — restore previous render
            this.session.endEdit();
            renderTextToLayer(hitText, targetDocX, targetDocY, hitText.textData);
            this.session._emit('canvas-dirty');
          },
          { initialBoxW: hitText.transform.w, initialBoxH: hitText.transform.h }
        );
        return;
      }

      // Start drag to determine area and size for the new text box
      this._drag = { type: 'textbox', startDX: dx, startDY: dy, startClientX: e.clientX, startClientY: e.clientY };
      this._liveTextBox = { x: dx, y: dy, w: 0, h: 0 };
      this._startAntsAnimation();
      this._markDirty();
      return;
    }

    // Shape tool
    if (tool === Tool.SHAPE) {
      this._drag = { type: 'shape', startDX: dx, startDY: dy };
      this._liveShape = { startX: dx, startY: dy, curX: dx, curY: dy, x: dx, y: dy, w: 0, h: 0, type: this.session.shapeType };
      return;
    }

    // Brush, Eraser, Blur Tools
    if (tool === Tool.BRUSH || tool === Tool.ERASER || tool === Tool.BLUR) {
      let layer = this.session.activeLayer;
      if (!layer || layer.isGroup || layer.isLocked) {
        // Auto-create blank layer if none active or active layer is locked with tool name
        const toolName = tool === Tool.ERASER ? 'Eraser' : tool === Tool.BLUR ? 'Blur' : 'Brush';
        layer = this.session.addBlankLayer(this.session.getNextLayerName(toolName), { fullCanvas: true });
      }

      const layerX = (dx - layer.transform.x) * (layer.pixelW / layer.transform.w);
      const layerY = (dy - layer.transform.y) * (layer.pixelH / layer.transform.h);

      this.session.beginEdit(tool === Tool.ERASER ? 'Erase' : tool === Tool.BLUR ? 'Blur' : 'Brush Stroke');

      // --- Offscreen stroke buffer (prevents opacity banding) ---
      // For brush/eraser: paint dabs at full opacity onto a buffer canvas,
      // then composite the whole stroke at the desired opacity in one pass.
      let strokeBuffer = null;
      let strokeCtx = null;
      if (tool !== Tool.BLUR) {
        strokeBuffer = document.createElement('canvas');
        strokeBuffer.width = layer.pixelW;
        strokeBuffer.height = layer.pixelH;
        strokeCtx = strokeBuffer.getContext('2d');
      }

      // Save a pristine copy of the layer for compositing
      let layerSnapshot = null;
      if (tool !== Tool.BLUR) {
        layerSnapshot = document.createElement('canvas');
        layerSnapshot.width = layer.pixelW;
        layerSnapshot.height = layer.pixelH;
        layerSnapshot.getContext('2d').drawImage(layer.canvas, 0, 0);
      }

      this._drag = {
        type: tool,
        layerID: layer.id,
        lastLX: layerX,
        lastLY: layerY,
        strokeBuffer,
        strokeCtx,
        layerSnapshot,
      };

      this._paintStroke(layer, layerX, layerY, layerX, layerY, tool);
      this._markDirty();
    }
  }

  _onPointerMove(e) {
    const rect = this.area.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const [dx, dy] = this.screenToDoc(sx, sy);

    this._cursorDocPos = { x: dx, y: dy };
    this.rulerView?.update(this._cursorDocPos);

    if (!this._drag) {
      const t = this.session.tool;
      if (t === Tool.CROP && this.session.cropRect) {
        const cr = this.session.cropRect;
        const hw = Math.max(8, 8 / this.scale);
        const handles = [
          { id: 'nw', cursor: 'nwse-resize', x: cr.x,          y: cr.y },
          { id: 'n',  cursor: 'ns-resize',   x: cr.x + cr.w/2, y: cr.y },
          { id: 'ne', cursor: 'nesw-resize', x: cr.x + cr.w,   y: cr.y },
          { id: 'e',  cursor: 'ew-resize',   x: cr.x + cr.w,   y: cr.y + cr.h/2 },
          { id: 'se', cursor: 'nwse-resize', x: cr.x + cr.w,   y: cr.y + cr.h },
          { id: 's',  cursor: 'ns-resize',   x: cr.x + cr.w/2, y: cr.y + cr.h },
          { id: 'sw', cursor: 'nesw-resize', x: cr.x,          y: cr.y + cr.h },
          { id: 'w',  cursor: 'ew-resize',   x: cr.x,          y: cr.y + cr.h/2 },
        ];
        const hitHandle = handles.find(h => Math.abs(dx - h.x) <= hw && Math.abs(dy - h.y) <= hw);
        if (hitHandle) {
          this.area.style.cursor = hitHandle.cursor;
        } else if (dx >= cr.x && dx <= cr.x + cr.w && dy >= cr.y && dy <= cr.y + cr.h) {
          this.area.style.cursor = 'move';
        } else {
          this.area.style.cursor = 'crosshair';
        }
        return;
      }
      if (t === Tool.MOVE) {
        let cursor = '';
        if (this.session.activeLayer) {
          const handle = this._getTransformHandleAt(this.session.activeLayer, dx, dy);
          cursor = this._getCursorForHandle(handle, this.session.activeLayer.transform.rotation);
        }
        if (!cursor) {
          const hit = [...(this.session.document?.layers || [])].reverse().find(l => l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy));
          cursor = hit ? 'grab' : 'move';
        }
        this.area.style.cursor = cursor || 'move';
      } else {
        this.area.style.cursor = '';
      }
      if (t === Tool.BRUSH || t === Tool.ERASER || t === Tool.BLUR || t === Tool.CLONE || t === Tool.HEAL) {
        this._markDirty();
      }
      return;
    }

    if (this._drag.type === 'pan') {
      this.tx = this._drag.startTX + (sx - this._drag.startSX);
      this.ty = this._drag.startTY + (sy - this._drag.startSY);
      this._markDirty();
      return;
    }

    if (this._drag.type === 'rotate') {
      this.area.style.cursor = ROTATE_CURSOR;
      const orig = this._drag.origTransform;
      const curAngle = Math.atan2(dy - orig.cy, dx - orig.cx) * 180 / Math.PI;
      const deltaAngle = curAngle - this._drag.startAngle;
      let newRot = (orig.rotation + deltaAngle) % 360;
      if (newRot < 0) newRot += 360;

      this._isAngleSnapped = false;

      // 1. Shift key: strict 15Â° step constraint
      if (e.shiftKey) {
        newRot = Math.round(newRot / 15) * 15;
        this._isAngleSnapped = true;
      } else if (this.session.snapToGuides !== false) {
        // 2. Magnetic snapping near cardinal and 45Â° diagonal angles
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        const snapTolerance = 3.0; // degrees
        for (const targetAngle of snapAngles) {
          const diff = Math.abs(newRot - targetAngle);
          if (diff <= snapTolerance || Math.abs(newRot - (targetAngle - 360)) <= snapTolerance) {
            newRot = targetAngle % 360;
            this._isAngleSnapped = true;
            break;
          }
        }
      }

      newRot = ((newRot % 360) + 360) % 360;
      if (newRot < 0.05 || newRot > 359.95) newRot = 0;

      const newTransform = orig.clone();
      newTransform.rotation = Math.round(newRot * 10) / 10;
      this.session.setLayerTransform(this._drag.layerID, newTransform);
      return;
    }

    if (this._drag.type === 'resize') {
      this.area.style.cursor = this._getCursorForHandle(this._drag.handle, this._drag.origTransform.rotation);
      const orig = this._drag.origTransform;
      const rotRad = (orig.rotation || 0) * Math.PI / 180;
      const deltaX = dx - this._drag.startDX;
      const deltaY = dy - this._drag.startDY;

      // Project mouse delta into layer unrotated local frame
      const dlx = deltaX * Math.cos(rotRad) + deltaY * Math.sin(rotRad);
      const dly = -deltaX * Math.sin(rotRad) + deltaY * Math.cos(rotRad);

      let newW = orig.w;
      let newH = orig.h;
      let shiftLX = 0;
      let shiftLY = 0;

      const h = this._drag.handle;
      if (h.includes('e')) {
        newW = Math.max(4, orig.w + dlx);
        shiftLX = (newW - orig.w) / 2;
      } else if (h.includes('w')) {
        newW = Math.max(4, orig.w - dlx);
        shiftLX = -(newW - orig.w) / 2;
      }

      if (h.includes('s')) {
        newH = Math.max(4, orig.h + dly);
        shiftLY = (newH - orig.h) / 2;
      } else if (h.includes('n')) {
        newH = Math.max(4, orig.h - dly);
        shiftLY = -(newH - orig.h) / 2;
      }

      // Proportional resize on Shift or for corners
      if (e.shiftKey && (h === 'nw' || h === 'ne' || h === 'sw' || h === 'se')) {
        const aspect = orig.w / orig.h;
        const scaleFactor = Math.max(newW / orig.w, newH / orig.h);
        newW = Math.max(4, Math.round(orig.w * scaleFactor));
        newH = Math.max(4, Math.round(orig.h * scaleFactor));
        if (h.includes('e')) shiftLX = (newW - orig.w) / 2;
        else if (h.includes('w')) shiftLX = -(newW - orig.w) / 2;
        if (h.includes('s')) shiftLY = (newH - orig.h) / 2;
        else if (h.includes('n')) shiftLY = -(newH - orig.h) / 2;
      }

      // Convert center shift from local rotated coords to document space
      const docShiftX = shiftLX * Math.cos(rotRad) - shiftLY * Math.sin(rotRad);
      const docShiftY = shiftLX * Math.sin(rotRad) + shiftLY * Math.cos(rotRad);

      let newCX = orig.cx + docShiftX;
      let newCY = orig.cy + docShiftY;
      let targetX = newCX - newW / 2;
      let targetY = newCY - newH / 2;

      if (this.session.snapToGuides && this.rulerView) {
        const snap = this.rulerView.snapRect(targetX, targetY, newW, newH);
        targetX = snap.snapX;
        targetY = snap.snapY;
        this._activeSnapLines = { x: snap.guideLinesX, y: snap.guideLinesY };
      } else {
        this._activeSnapLines = null;
      }

      const newTransform = new LayerTransform({
        x: Math.round(targetX),
        y: Math.round(targetY),
        w: Math.round(newW),
        h: Math.round(newH),
        rotation: orig.rotation,
        flipX: orig.flipX,
        flipY: orig.flipY,
      });

      this.session.setLayerTransform(this._drag.layerID, newTransform);
      return;
    }

    if (this._drag.type === 'move') {
      this.area.style.cursor = 'grabbing';
      const ddx = dx - this._drag.startDX;
      const ddy = dy - this._drag.startDY;
      const layer = this.session.document?.layerByID(this._drag.layerID);
      if (!layer) return;

      let targetX = this._drag.origX + ddx;
      let targetY = this._drag.origY + ddy;

      if (this.session.snapToGuides && this.rulerView) {
        const snap = this.rulerView.snapRect(targetX, targetY, layer.transform.w, layer.transform.h);
        targetX = snap.snapX;
        targetY = snap.snapY;
        this._activeSnapLines = { x: snap.guideLinesX, y: snap.guideLinesY };
      } else {
        this._activeSnapLines = null;
      }

      const newTransform = layer.transform.clone();
      newTransform.x = Math.round(targetX);
      newTransform.y = Math.round(targetY);
      this.session.setLayerTransform(this._drag.layerID, newTransform);
      return;
    }

    if (this._drag.type === 'cursor-marquee') {
      this.area.style.cursor = 'crosshair';
      this._drag.currDX = dx;
      this._drag.currDY = dy;
      this._dirty = true;
      return;
    }

    if (this._drag.type === 'marquee') {
      const minX = Math.min(this._drag.startDX, dx);
      const minY = Math.min(this._drag.startDY, dy);
      const w = Math.abs(dx - this._drag.startDX);
      const h = Math.abs(dy - this._drag.startDY);
      this.session.setSelection({ x: minX, y: minY, w, h });
      return;
    }

    if (this._drag.type === 'lasso') {
      this._drag.points.push({ x: dx, y: dy });
      this._markDirty();
      return;
    }

    // Crop: draw a new rect
    if (this._drag.type === 'crop-draw') {
      const minX = Math.min(this._drag.startDX, dx);
      const minY = Math.min(this._drag.startDY, dy);
      const w = Math.abs(dx - this._drag.startDX);
      const h = Math.abs(dy - this._drag.startDY);
      if (w > 2 && h > 2) {
        this.session.cropRect = { x: minX, y: minY, w, h };
      }
      this._markDirty();
      return;
    }

    // Crop: move existing rect
    if (this._drag.type === 'crop-move') {
      const ddx = dx - this._drag.startDX;
      const ddy = dy - this._drag.startDY;
      const oc = this._drag.origCrop;
      const doc2 = this.session.document;
      this.session.cropRect = {
        x: Math.max(0, Math.min(doc2.width  - oc.w, oc.x + ddx)),
        y: Math.max(0, Math.min(doc2.height - oc.h, oc.y + ddy)),
        w: oc.w,
        h: oc.h,
      };
      this._markDirty();
      return;
    }

    // Crop: resize via handle
    if (this._drag.type === 'crop-resize') {
      const oc = this._drag.origCrop;
      const ddx = dx - this._drag.startDX;
      const ddy = dy - this._drag.startDY;
      const id = this._drag.handle;
      const doc2 = this.session.document;

      let x1 = oc.x;
      let y1 = oc.y;
      let x2 = oc.x + oc.w;
      let y2 = oc.y + oc.h;

      if (id.includes('w')) {
        x1 = Math.max(0, Math.min(x2 - 10, oc.x + ddx));
      }
      if (id.includes('e')) {
        x2 = Math.min(doc2.width, Math.max(x1 + 10, oc.x + oc.w + ddx));
      }
      if (id.includes('n')) {
        y1 = Math.max(0, Math.min(y2 - 10, oc.y + ddy));
      }
      if (id.includes('s')) {
        y2 = Math.min(doc2.height, Math.max(y1 + 10, oc.y + oc.h + ddy));
      }

      this.session.cropRect = {
        x: Math.round(x1),
        y: Math.round(y1),
        w: Math.round(x2 - x1),
        h: Math.round(y2 - y1),
      };
      this._markDirty();
      return;
    }

    if (this._drag.type === 'gradient') {
      this._updateGradientDrag(dx, dy, e.shiftKey);
      this._markDirty();
      return;
    }

    if (this._drag.type === 'textbox') {
      const sx = this._drag.startDX, sy = this._drag.startDY;
      const minX = Math.min(sx, dx), minY = Math.min(sy, dy);
      const w = Math.abs(dx - sx), h = Math.abs(dy - sy);
      this._liveTextBox = { x: minX, y: minY, w, h };
      this._markDirty();
      return;
    }

    if (this._drag.type === 'shape') {
      const sx = this._drag.startDX, sy = this._drag.startDY;
      const minX = Math.min(sx, dx), minY = Math.min(sy, dy);
      const w = Math.abs(dx - sx), h = Math.abs(dy - sy);
      this._liveShape = {
        startX: sx, startY: sy, curX: dx, curY: dy,
        x: minX, y: minY, w, h,
        type: this.session.shapeType
      };
      this._markDirty();
      return;
    }

    if (this._drag.type === Tool.BRUSH || this._drag.type === Tool.ERASER || this._drag.type === Tool.BLUR) {
      const layer = this.session.document?.layerByID(this._drag.layerID);
      if (!layer) return;
      const layerX = (dx - layer.transform.x) * (layer.pixelW / layer.transform.w);
      const layerY = (dy - layer.transform.y) * (layer.pixelH / layer.transform.h);

      this._paintStroke(layer, this._drag.lastLX, this._drag.lastLY, layerX, layerY, this._drag.type);
      this._drag.lastLX = layerX;
      this._drag.lastLY = layerY;
      this._markDirty();
    }

    if (this._drag.type === Tool.CLONE) {
      const layer = this.session.document?.layerByID(this._drag.layerID);
      if (!layer) return;
      this._paintCloneStamp(
        layer, dx, dy,
        this._drag.startDX, this._drag.startDY,
        this._drag.srcDocX, this._drag.srcDocY,
        this._drag.sourceCanvas
      );
      this._markDirty();
    }

    if (this._drag.type === Tool.HEAL) {
      const layer = this.session.document?.layerByID(this._drag.layerID);
      if (!layer) return;
      const layerX = (dx - layer.transform.x) * (layer.pixelW / layer.transform.w);
      const layerY = (dy - layer.transform.y) * (layer.pixelH / layer.transform.h);
      this._drag.points.push({ x: layerX, y: layerY });
      this._healRegion(layer, [{ x: layerX, y: layerY }]);
      this._markDirty();
    }
  }

  _onPointerUp(e) {
    if (!this._drag) return;

    if (this._drag.type === 'cursor-marquee') {
      const doc = this.session.document;
      const minX = Math.min(this._drag.startDX, this._drag.currDX);
      const minY = Math.min(this._drag.startDY, this._drag.currDY);
      const mw = Math.abs(this._drag.currDX - this._drag.startDX);
      const mh = Math.abs(this._drag.currDY - this._drag.startDY);

      if (mw > 4 && mh > 4 && doc) {
        for (const l of doc.layers) {
          if (!l.isVisible || l.isLocked || l.isGroup) continue;
          const lt = l.transform;
          if (lt.x < minX + mw && lt.x + lt.w > minX && lt.y < minY + mh && lt.y + lt.h > minY) {
            this.session.selectedLayerIDs.add(l.id);
            this.session.activeLayerID = l.id;
          }
        }
        this.session._emit('change');
        this.session._emit('canvas-dirty');
      }
      this._drag = null;
      this._dirty = true;
      this._render();
      return;
    }

    if (this._drag.type === 'move' || this._drag.type === 'resize' || this._drag.type === 'rotate') {
      this.session.endEdit();
    }

    if (this._drag.type === 'lasso') {
      const pts = this._drag.points;
      if (pts && pts.length > 2) {
        const xs = pts.map(p => p.x);
        const ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        this.session.setSelection({ x: minX, y: minY, w: maxX - minX, h: maxY - minY }, pts);
      }
    }

    if (this._drag.type?.startsWith('crop')) {
      this.session._emit('change');
    }

    if (this._drag.type === Tool.BRUSH || this._drag.type === Tool.ERASER || this._drag.type === Tool.BLUR || this._drag.type === Tool.CLONE || this._drag.type === Tool.HEAL) {
      const layer = this.session.document?.layerByID(this._drag.layerID);
      if (layer) layer.markChanged();
      this.session.endEdit();
    }

    if (this._drag.type === 'shape' && this._liveShape) {
      this._commitShape(this._liveShape);
      this._liveShape = null;
      this.session.setTool(Tool.CURSOR);
    }

    if (this._drag.type === 'textbox' && this._liveTextBox) {
      const tb = this._liveTextBox;
      let boxX = Math.round(tb.x);
      let boxY = Math.round(tb.y);
      let boxW = Math.round(tb.w);
      let boxH = Math.round(tb.h);
      this._liveTextBox = null;

      const defaultFontSize = Math.max(12, Math.round(this.session.fontSize || 48));
      if (boxW < 12 || boxH < 12) {
        // Single click without dragging — provide default textbox area starting at click location
        boxW = Math.max(180, Math.round(defaultFontSize * 4));
        boxH = Math.max(48, Math.round(defaultFontSize * 1.5));
      }

      const textLayer = this.session.addBlankLayer(this.session.getNextLayerName('Text'), {
        x: boxX,
        y: boxY,
        w: boxW,
        h: boxH,
      });
      this.session.beginEdit('Add Text');
      openTextEditor(
        this.session, textLayer, boxX, boxY, null,
        () => {
          textLayer.markChanged();
          this.session.endEdit();
          this.session.setTool(Tool.CURSOR);
          this.session._emit('canvas-dirty');
        },
        () => {
          // Cancel — roll back layer creation via undo
          this.session.endEdit();
          this.session.undo();
        },
        { initialBoxW: boxW, initialBoxH: boxH }
      );
      this._endDrag();
      this._markDirty();
      return;
    }

    if (this._drag.type === 'gradient' && this._liveGrad) {
      this._commitGradient(this._liveGrad);
      this._liveGrad = null;
    }

    this._endDrag();
    this._markDirty();
  }

  _endDrag() {
    if (this._drag?.type === 'pan' && !this._isSpaceDown) {
      this.area.classList.remove('panning');
    }
    this._drag = null;
    this._liveTextBox = null;
    this._activeSnapLines = null;
    this._isAngleSnapped = false;
    if (this.hud) this.hud.style.display = 'none';
    this.area.style.cursor = '';
  }

  // â”€â”€â”€ Tool Raster Operations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  _paintStroke(layer, x1, y1, x2, y2, tool) {
    const r = this.session.brushSize / 2;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / Math.max(1, r * 0.3)));
    const hardness = this.session.brushHardness;

    if (tool === Tool.BLUR) {
      // Blur tool: optimized fast sub-region canvas blur
      const ctx = layer.ctx;
      if (!ctx) return;
      ctx.save();
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = x1 + (x2 - x1) * t;
        const py = y1 + (y2 - y1) * t;
        const bx = Math.max(0, Math.round(px - r));
        const by = Math.max(0, Math.round(py - r));
        const bw = Math.min(layer.pixelW - bx, Math.round(r * 2));
        const bh = Math.min(layer.pixelH - by, Math.round(r * 2));
        if (bw > 2 && bh > 2) {
          if (typeof document !== 'undefined') {
            const offCanvas = document.createElement('canvas');
            offCanvas.width = bw;
            offCanvas.height = bh;
            const offCtx = offCanvas.getContext('2d');
            if (offCtx && layer.canvas) {
              offCtx.filter = `blur(${Math.max(1, Math.round(r * 0.25))}px)`;
              offCtx.drawImage(layer.canvas, bx, by, bw, bh, 0, 0, bw, bh);
              ctx.save();
              ctx.beginPath();
              ctx.arc(px, py, r, 0, Math.PI * 2);
              ctx.clip();
              ctx.drawImage(offCanvas, bx, by);
              ctx.restore();
            }
          }
        }
      }
      ctx.restore();
      return;
    }

    // --- Brush / Eraser: draw onto stroke buffer at full opacity ---
    const sCtx = this._drag?.strokeCtx;
    if (!sCtx) return;

    // Parse foreground color for gradient stops
    const color = this.session.fgColor;
    const fillColor = tool === Tool.ERASER ? '0,0,0' : this._hexToRgb(color);

    sCtx.save();
    sCtx.globalCompositeOperation = 'source-over';
    sCtx.globalAlpha = 1.0;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x1 + (x2 - x1) * t;
      const py = y1 + (y2 - y1) * t;

      if (hardness >= 0.99) {
        // Hard brush: solid circle (fast path)
        sCtx.fillStyle = `rgba(${fillColor},1)`;
        sCtx.beginPath();
        sCtx.arc(px, py, r, 0, Math.PI * 2);
        sCtx.fill();
      } else {
        // Soft brush: radial gradient dab matching macOS Gaussian falloff
        // At hardness=0: falloff starts from center
        // At hardness=1: solid disk (handled above)
        const grad = sCtx.createRadialGradient(px, py, r * hardness, px, py, r);
        grad.addColorStop(0, `rgba(${fillColor},1)`);
        // Gaussian-like falloff curve: exp(-2.5*tÂ²) normalized
        const fadeSteps = 5;
        for (let s = 1; s <= fadeSteps; s++) {
          const f = s / fadeSteps;
          const alpha = Math.max(0, (Math.exp(-2.5 * f * f) - Math.exp(-2.5)) / (1 - Math.exp(-2.5)));
          grad.addColorStop(f, `rgba(${fillColor},${alpha.toFixed(3)})`);
        }
        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(px, py, r, 0, Math.PI * 2);
        sCtx.fill();
      }
    }
    sCtx.restore();

    // Composite stroke buffer onto layer with the desired opacity
    this._compositeStrokeBuffer(layer, tool);
  }

  /** Composite the stroke buffer onto the layer at brushOpacity */
  _compositeStrokeBuffer(layer, tool) {
    const drag = this._drag;
    if (!drag?.strokeBuffer || !drag?.layerSnapshot) return;

    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);

    // First restore the pristine layer content
    ctx.drawImage(drag.layerSnapshot, 0, 0);

    // Then composite the stroke buffer on top at the target opacity
    ctx.save();
    ctx.globalAlpha = this.session.brushOpacity;
    if (tool === Tool.ERASER) {
      ctx.globalCompositeOperation = 'destination-out';
    } else {
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.drawImage(drag.strokeBuffer, 0, 0);
    ctx.restore();
  }

  /** Convert hex color like #RRGGBB or #RGB to "R,G,B" string for rgba() */
  _hexToRgb(hex) {
    return this._hexToRgbArray(hex).join(',');
  }

  _hexToRgbArray(color) {
    if (!color) return [0, 0, 0];
    if (Array.isArray(color)) return [color[0] || 0, color[1] || 0, color[2] || 0];
    const s = String(color).trim().toLowerCase();
    if (s.startsWith('rgb')) {
      const nums = s.match(/[\d.]+/g);
      if (nums && nums.length >= 3) {
        return [
          Math.max(0, Math.min(255, Math.round(Number(nums[0])))),
          Math.max(0, Math.min(255, Math.round(Number(nums[1])))),
          Math.max(0, Math.min(255, Math.round(Number(nums[2])))),
        ];
      }
    }
    const h = s.replace('#', '');
    if (h.length === 3 || h.length === 4) {
      return [
        parseInt(h[0] + h[0], 16) || 0,
        parseInt(h[1] + h[1], 16) || 0,
        parseInt(h[2] + h[2], 16) || 0,
      ];
    }
    if (h.length >= 6) {
      return [
        parseInt(h.substring(0, 2), 16) || 0,
        parseInt(h.substring(2, 4), 16) || 0,
        parseInt(h.substring(4, 6), 16) || 0,
      ];
    }
    return [0, 0, 0];
  }

  // ─── Bucket Fill Tool Engine ──────────────────────────────────────────────

  _performBucketFill(dx, dy) {
    const doc = this.session.document;
    if (!doc) return;

    let layer = this.session.activeLayer;

    // Check if active layer is valid and contains click point
    const activeValid = layer && !layer.isGroup && !layer.isLocked && layer.transform.contains(dx, dy);

    if (!activeValid) {
      // Find topmost visible, unlocked layer under cursor
      const hit = [...(doc.layers || [])].reverse().find(l =>
        l.isVisible && !l.isLocked && !l.isGroup && l.transform.contains(dx, dy)
      );
      if (hit) {
        layer = hit;
        this.session.setActiveLayer(hit.id);
      } else if (!layer || layer.isGroup || layer.isLocked) {
        layer = this.session.addBlankLayer(this.session.getNextLayerName('Bucket Fill'), { fullCanvas: true });
      }
    }

    if (!layer || layer.isGroup || layer.isLocked) return;

    const t = layer.transform;
    const rad = -t.rotation * Math.PI / 180;
    const odx = dx - t.cx;
    const ody = dy - t.cy;
    let rx = odx * Math.cos(rad) - ody * Math.sin(rad);
    let ry = odx * Math.sin(rad) + ody * Math.cos(rad);
    if (t.flipX) rx = -rx;
    if (t.flipY) ry = -ry;

    const lx = Math.floor((rx + t.w / 2) * (layer.pixelW / t.w));
    const ly = Math.floor((ry + t.h / 2) * (layer.pixelH / t.h));

    if (lx < 0 || lx >= layer.pixelW || ly < 0 || ly >= layer.pixelH) return;

    const layerToDocPx = (px, py) => {
      if (t.rotation === 0 && !t.flipX && !t.flipY) {
        return [
          Math.floor(t.x + (px * t.w / layer.pixelW)),
          Math.floor(t.y + (py * t.h / layer.pixelH))
        ];
      }
      let normX = (px / layer.pixelW) - 0.5;
      let normY = (py / layer.pixelH) - 0.5;
      if (t.flipX) normX = -normX;
      if (t.flipY) normY = -normY;
      const unrotX = normX * t.w;
      const unrotY = normY * t.h;
      const cos = Math.cos(t.rotation * Math.PI / 180);
      const sin = Math.sin(t.rotation * Math.PI / 180);
      return [
        Math.floor(t.cx + unrotX * cos - unrotY * sin),
        Math.floor(t.cy + unrotX * sin + unrotY * cos)
      ];
    };

    // Selection bounds check
    const sel = this.session.selectionRect;
    const selPath = this.session.selectionPath;
    let minLX = 0, maxLX = layer.pixelW - 1, minLY = 0, maxLY = layer.pixelH - 1;
    if (sel) {
      minLX = Math.max(0, Math.floor((sel.x - t.x) * (layer.pixelW / t.w)));
      maxLX = Math.min(layer.pixelW - 1, Math.ceil((sel.x + sel.w - t.x) * (layer.pixelW / t.w)));
      minLY = Math.max(0, Math.floor((sel.y - t.y) * (layer.pixelH / t.h)));
      maxLY = Math.min(layer.pixelH - 1, Math.ceil((sel.y + sel.h - t.y) * (layer.pixelH / t.h)));
    }

    const isInsideSelection = (px, py) => {
      if (px < minLX || px > maxLX || py < minLY || py > maxLY) return false;
      if (selPath && selPath.length > 2) {
        const [docX, docY] = layerToDocPx(px, py);
        let inside = false;
        for (let i = 0, j = selPath.length - 1; i < selPath.length; j = i++) {
          const xi = selPath[i].x, yi = selPath[i].y;
          const xj = selPath[j].x, yj = selPath[j].y;
          const intersect = ((yi > docY) !== (yj > docY)) &&
            (docX < (xj - xi) * (docY - yi) / (yj - yi) + xi);
          if (intersect) inside = !inside;
        }
        return inside;
      }
      return true;
    };

    if (!isInsideSelection(lx, ly)) return;

    this.session.beginEdit('Paint Bucket Fill');

    const lCanvas = layer.ensureCanvas();
    const lCtx = layer.ctx;
    const pw = layer.pixelW;
    const ph = layer.pixelH;

    const layerImageData = lCtx.getImageData(0, 0, pw, ph);
    const layerData = layerImageData.data;

    // Sample data source:
    let sampleData = layerData;
    let sampleW = pw;
    let sampleH = ph;

    if (this.session.bucketSampleAll) {
      // Sample from composite document rendering (lineart / all layers)
      const comp = this.getDocumentRGBA();
      if (comp) {
        sampleData = comp.data;
        sampleW = comp.width;
        sampleH = comp.height;
      }
    }

    const sampleX = this.session.bucketSampleAll ? Math.floor(dx) : lx;
    const sampleY = this.session.bucketSampleAll ? Math.floor(dy) : ly;

    if (sampleX < 0 || sampleX >= sampleW || sampleY < 0 || sampleY >= sampleH) {
      this.session.endEdit();
      return;
    }

    const sampleIdx = (sampleY * sampleW + sampleX) * 4;
    const targetR = sampleData[sampleIdx];
    const targetG = sampleData[sampleIdx + 1];
    const targetB = sampleData[sampleIdx + 2];
    const targetA = sampleData[sampleIdx + 3];

    // Target fill color
    const hex = this.session.fgColor;
    const [fillR, fillG, fillB] = this._hexToRgbArray(hex);
    const fillA = Math.round((this.session.bucketOpacity ?? 1.0) * 255);

    const tolerance = Math.max(0, Math.min(255, this.session.bucketTolerance ?? 32));

    const colorDist = (r, g, b, a) => {
      // Both fully transparent -> identical color
      if (targetA === 0 && a === 0) return 0;
      // One transparent and one opaque
      if (targetA === 0) return a;
      if (a === 0) return targetA;

      const dr = r - targetR;
      const dg = g - targetG;
      const db = b - targetB;
      const da = a - targetA;

      // Euclidean distance in RGB normalized, combined with alpha difference
      const rgbDist = Math.hypot(dr, dg, db) * 0.577350269;
      return Math.max(rgbDist, Math.abs(da));
    };

    // If target fill color is already identical to the seed pixel, no-op
    if (fillR === targetR && fillG === targetG && fillB === targetB && fillA === targetA &&
        (!this.session.bucketSampleAll || layerData[(ly * pw + lx) * 4] === fillR)) {
      this.session.endEdit();
      return;
    }

    const contiguous = this.session.bucketContiguous !== false;

    if (!contiguous) {
      // Non-contiguous: replace all matching pixels across layer/selection
      for (let y = minLY; y <= maxLY; y++) {
        for (let x = minLX; x <= maxLX; x++) {
          if (!isInsideSelection(x, y)) continue;
          const lIdx = (y * pw + x) * 4;
          let sR = layerData[lIdx], sG = layerData[lIdx + 1], sB = layerData[lIdx + 2], sA = layerData[lIdx + 3];
          if (this.session.bucketSampleAll) {
            const [docPxX, docPxY] = layerToDocPx(x, y);
            if (docPxX >= 0 && docPxX < sampleW && docPxY >= 0 && docPxY < sampleH) {
              const sIdx = (docPxY * sampleW + docPxX) * 4;
              sR = sampleData[sIdx]; sG = sampleData[sIdx + 1]; sB = sampleData[sIdx + 2]; sA = sampleData[sIdx + 3];
            }
          }
          if (colorDist(sR, sG, sB, sA) <= tolerance) {
            layerData[lIdx] = fillR;
            layerData[lIdx + 1] = fillG;
            layerData[lIdx + 2] = fillB;
            layerData[lIdx + 3] = fillA;
          }
        }
      }
    } else {
      // Contiguous 4-way flood fill
      const visited = new Uint8Array(pw * ph);
      const queue = [lx, ly];
      visited[ly * pw + lx] = 1;

      while (queue.length > 0) {
        const curY = queue.pop();
        const curX = queue.pop();

        const lIdx = (curY * pw + curX) * 4;
        layerData[lIdx] = fillR;
        layerData[lIdx + 1] = fillG;
        layerData[lIdx + 2] = fillB;
        layerData[lIdx + 3] = fillA;

        const neighbors = [
          [curX + 1, curY],
          [curX - 1, curY],
          [curX, curY + 1],
          [curX, curY - 1]
        ];

        for (const [nx, ny] of neighbors) {
          if (!isInsideSelection(nx, ny)) continue;
          const nVisitedIdx = ny * pw + nx;
          if (visited[nVisitedIdx]) continue;
          visited[nVisitedIdx] = 1;

          let sR = layerData[(ny * pw + nx) * 4];
          let sG = layerData[(ny * pw + nx) * 4 + 1];
          let sB = layerData[(ny * pw + nx) * 4 + 2];
          let sA = layerData[(ny * pw + nx) * 4 + 3];

          if (this.session.bucketSampleAll) {
            const [docPxX, docPxY] = layerToDocPx(nx, ny);
            if (docPxX >= 0 && docPxX < sampleW && docPxY >= 0 && docPxY < sampleH) {
              const sIdx = (docPxY * sampleW + docPxX) * 4;
              sR = sampleData[sIdx]; sG = sampleData[sIdx + 1]; sB = sampleData[sIdx + 2]; sA = sampleData[sIdx + 3];
            }
          }

          if (colorDist(sR, sG, sB, sA) <= tolerance) {
            queue.push(nx, ny);
          }
        }
      }
    }

    lCtx.putImageData(layerImageData, 0, 0);
    layer.markChanged();
    this.session.endEdit();
    this._markDirty();
  }

  // ─── Magic Wand Tool Engine ───────────────────────────────────────────────

  _performWandSelection(dx, dy) {
    const doc = this.session.document;
    if (!doc) return;

    const sampleCanvas = this.el;
    const sampleW = doc.width;
    const sampleH = doc.height;

    const targetX = Math.floor(dx);
    const targetY = Math.floor(dy);

    if (targetX < 0 || targetX >= sampleW || targetY < 0 || targetY >= sampleH) {
      this.session.deselect();
      return;
    }

    const sctx = sampleCanvas.getContext('2d', { willReadFrequently: true });
    const imgData = sctx.getImageData(0, 0, sampleW, sampleH);
    const data = imgData.data;

    const startIdx = (targetY * sampleW + targetX) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    const tol = Math.max(0, Math.min(255, this.session.wandTolerance ?? 32));
    const isMatch = (idx) => {
      const dr = Math.abs(data[idx] - startR);
      const dg = Math.abs(data[idx + 1] - startG);
      const db = Math.abs(data[idx + 2] - startB);
      const da = Math.abs(data[idx + 3] - startA);
      return (dr + dg + db + da) / 4 <= tol;
    };

    let minX = sampleW, minY = sampleH, maxX = -1, maxY = -1;
    let matchedCount = 0;

    if (this.session.wandContiguous) {
      const visited = new Uint8Array(sampleW * sampleH);
      const queue = [targetX + targetY * sampleW];
      visited[targetX + targetY * sampleW] = 1;

      while (queue.length > 0) {
        const pos = queue.pop();
        const px = pos % sampleW;
        const py = Math.floor(pos / sampleW);
        const idx = (py * sampleW + px) * 4;

        if (isMatch(idx)) {
          matchedCount++;
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;

          const neighbors = [
            px > 0 ? pos - 1 : -1,
            px < sampleW - 1 ? pos + 1 : -1,
            py > 0 ? pos - sampleW : -1,
            py < sampleH - 1 ? pos + sampleW : -1,
          ];

          for (const n of neighbors) {
            if (n >= 0 && !visited[n]) {
              visited[n] = 1;
              queue.push(n);
            }
          }
        }
      }
    } else {
      for (let y = 0; y < sampleH; y++) {
        for (let x = 0; x < sampleW; x++) {
          const idx = (y * sampleW + x) * 4;
          if (isMatch(idx)) {
            matchedCount++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }
    }

    if (matchedCount > 0 && maxX >= minX && maxY >= minY) {
      const path = this._traceContour(isSelected, sampleW, sampleH, minX, minY, maxX, maxY);
      this.session.setSelection({
        x: minX,
        y: minY,
        w: maxX - minX + 1,
        h: maxY - minY + 1,
      }, path && path.length > 2 ? path : [
        { x: minX, y: minY },
        { x: maxX + 1, y: minY },
        { x: maxX + 1, y: maxY + 1 },
        { x: minX, y: maxY + 1 },
      ]);
    } else {
      this.session.deselect();
    }
  }

  _traceContour(mask, w, h, minX, minY, maxX, maxY) {
    const isM = (x, y) => {
      if (x < 0 || x >= w || y < 0 || y >= h) return false;
      return mask[y * w + x] === 1;
    };

    const edges = new Map();
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (!isM(x, y)) continue;
        if (!isM(x, y - 1))     edges.set(`${x},${y}`,     { x: x + 1, y: y });
        if (!isM(x + 1, y))     edges.set(`${x + 1},${y}`, { x: x + 1, y: y + 1 });
        if (!isM(x, y + 1))     edges.set(`${x + 1},${y + 1}`, { x: x, y: y + 1 });
        if (!isM(x - 1, y))     edges.set(`${x},${y + 1}`, { x: x, y: y });
      }
    }

    if (edges.size < 3) return null;

    let startKey = null;
    for (let y = minY; y <= maxY + 1; y++) {
      for (let x = minX; x <= maxX + 1; x++) {
        if (edges.has(`${x},${y}`)) {
          startKey = `${x},${y}`;
          break;
        }
      }
      if (startKey) break;
    }

    if (!startKey) return null;

    const points = [];
    let curKey = startKey;
    const visited = new Set();
    const maxIters = edges.size * 2;
    let count = 0;

    while (curKey && !visited.has(curKey) && count++ < maxIters) {
      visited.add(curKey);
      const [kx, ky] = curKey.split(',').map(Number);
      points.push({ x: kx, y: ky });
      const next = edges.get(curKey);
      if (!next) break;
      const nextKey = `${next.x},${next.y}`;
      if (nextKey === startKey) break;
      curKey = nextKey;
    }

    if (points.length < 3) return null;

    const simplified = [points[0]];
    for (let i = 1; i < points.length; i++) {
      const prev = simplified[simplified.length - 1];
      const cur = points[i];
      const next = i + 1 < points.length ? points[i + 1] : points[0];

      const dx1 = cur.x - prev.x;
      const dy1 = cur.y - prev.y;
      const dx2 = next.x - cur.x;
      const dy2 = next.y - cur.y;

      if (dx1 * dy2 === dy1 * dx2 && Math.sign(dx1) === Math.sign(dx2) && Math.sign(dy1) === Math.sign(dy2)) {
        continue;
      }
      simplified.push(cur);
    }

    return simplified;
  }

  // ─── Clone Stamp Engine ───────────────────────────────────────────────────

  _paintCloneStamp(layer, curDX, curDY, startDX, startDY, srcDocX, srcDocY, sourceCanvas) {
    if (!layer || !sourceCanvas) return;
    const ctx = layer.ctx;
    if (!ctx) return;

    const r = Math.max(1, (this.session.brushSize || 24) / 2);
    const opacity = this.session.brushOpacity ?? 1.0;

    const offX = curDX - startDX;
    const offY = curDY - startDY;

    const targetLX = (curDX - layer.transform.x) * (layer.pixelW / layer.transform.w);
    const targetLY = (curDY - layer.transform.y) * (layer.pixelH / layer.transform.h);

    const sourceX = srcDocX + offX;
    const sourceY = srcDocY + offY;

    ctx.save();
    ctx.globalAlpha = opacity;
    ctx.globalCompositeOperation = 'source-over';

    ctx.beginPath();
    ctx.arc(targetLX, targetLY, r, 0, Math.PI * 2);
    ctx.clip();

    ctx.drawImage(
      sourceCanvas,
      sourceX - r, sourceY - r, r * 2, r * 2,
      targetLX - r, targetLY - r, r * 2, r * 2
    );

    ctx.restore();
    layer.markChanged();
  }

  // ─── Spot Healing Engine ──────────────────────────────────────────────────

  _healRegion(layer, points) {
    if (!layer || !layer.ctx || !points?.length) return;
    const ctx = layer.ctx;
    const pw = layer.pixelW;
    const ph = layer.pixelH;

    const r = Math.max(4, Math.round((this.session.healSize || 24) / 2));
    const hardness = this.session.healHardness ?? 0.5;

    for (const pt of points) {
      const cx = Math.round(pt.x);
      const cy = Math.round(pt.y);

      const x0 = Math.max(0, cx - r - 4);
      const y0 = Math.max(0, cy - r - 4);
      const x1 = Math.min(pw, cx + r + 4);
      const y1 = Math.min(ph, cy + r + 4);
      const bw = x1 - x0;
      const bh = y1 - y0;

      if (bw <= 0 || bh <= 0) continue;

      const imgData = ctx.getImageData(x0, y0, bw, bh);
      const d = imgData.data;

      // Sample border ring pixels
      let borderR = 0, borderG = 0, borderB = 0, borderA = 0, borderCount = 0;
      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const dist = Math.hypot((x0 + x) - cx, (y0 + y) - cy);
          if (dist >= r - 1 && dist <= r + 3) {
            const idx = (y * bw + x) * 4;
            borderR += d[idx];
            borderG += d[idx + 1];
            borderB += d[idx + 2];
            borderA += d[idx + 3];
            borderCount++;
          }
        }
      }

      if (borderCount === 0) continue;
      const avgR = borderR / borderCount;
      const avgG = borderG / borderCount;
      const avgB = borderB / borderCount;
      const avgA = borderA / borderCount;

      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          const dist = Math.hypot((x0 + x) - cx, (y0 + y) - cy);
          if (dist < r) {
            const factor = Math.max(0, Math.min(1, 1 - (dist / r)));
            const blend = Math.pow(factor, 1.5) * (1 - hardness * 0.5);
            const idx = (y * bw + x) * 4;

            d[idx]     = Math.round(d[idx]     * (1 - blend) + avgR * blend);
            d[idx + 1] = Math.round(d[idx + 1] * (1 - blend) + avgG * blend);
            d[idx + 2] = Math.round(d[idx + 2] * (1 - blend) + avgB * blend);
            d[idx + 3] = Math.round(d[idx + 3] * (1 - blend) + avgA * blend);
          }
        }
      }

      ctx.putImageData(imgData, x0, y0);
    }

    layer.markChanged();
    this.session._emit('canvas-dirty');
  }

  // ─── Text tool: see ui/panels/textEditor.js ──────────────────────────────

  _commitShape(shape) {
    let layer = this.session.activeLayer;
    if (!layer || layer.isGroup || layer.isLocked) {
      const baseName = this._getShapeBaseName(shape.type);
      layer = this.session.addBlankLayer(this.session.getNextLayerName(baseName), { fullCanvas: true });
    }

    this.session.beginEdit('Draw Shape');
    const ctx = layer.ctx;
    ctx.save();
    ctx.fillStyle = this.session.fgColor;
    ctx.strokeStyle = this.session.bgColor;
    ctx.lineWidth = this.session.shapeStrokeWidth;

    const scaleX = layer.pixelW / layer.transform.w;
    const scaleY = layer.pixelH / layer.transform.h;
    const relX = (shape.x - layer.transform.x) * scaleX;
    const relY = (shape.y - layer.transform.y) * scaleY;
    const relStartX = (shape.startX - layer.transform.x) * scaleX;
    const relStartY = (shape.startY - layer.transform.y) * scaleY;
    const relCurX = (shape.curX - layer.transform.x) * scaleX;
    const relCurY = (shape.curY - layer.transform.y) * scaleY;
    const relW = shape.w * scaleX;
    const relH = shape.h * scaleY;

    ctx.beginPath();
    this._applyShapePath(ctx, shape.type, relX, relY, relW, relH, this.session.shapeCornerRadius, relStartX, relStartY, relCurX, relCurY);

    if (shape.type !== 'line') {
      if (this.session.shapeFill) ctx.fill();
      if (this.session.shapeStroke) ctx.stroke();
    } else {
      ctx.stroke();
    }

    ctx.restore();
    layer.markChanged();
    this.session.endEdit();
  }

  _updateGradientDrag(dx, dy, isShift) {
    if (!this._drag || this._drag.type !== 'gradient') return;
    const sx = this._drag.startDX;
    const sy = this._drag.startDY;
    let curX = dx;
    let curY = dy;
    let isSnapped = false;

    if (isShift) {
      const deltaX = curX - sx;
      const deltaY = curY - sy;
      const dist = Math.hypot(deltaX, deltaY);
      if (dist > 2) {
        const angleRad = Math.atan2(deltaY, deltaX);
        const angleDeg = angleRad * (180 / Math.PI);
        const snappedDeg = Math.round(angleDeg / 45) * 45;
        const snappedRad = snappedDeg * (Math.PI / 180);
        curX = sx + dist * Math.cos(snappedRad);
        curY = sy + dist * Math.sin(snappedRad);
        isSnapped = true;
      }
    }

    this._liveGrad = {
      x1: sx,
      y1: sy,
      x2: curX,
      y2: curY,
      isSnapped,
    };
  }

  _commitGradient(grad) {
    const dist = Math.hypot(grad.x2 - grad.x1, grad.y2 - grad.y1);
    if (dist < 6) {
      // Ignore accidental click or degenerate micro-drag to prevent sudden harsh color split
      return;
    }

    let layer = this.session.activeLayer;
    if (!layer || layer.isGroup || layer.isLocked) {
      layer = this.session.addBlankLayer(this.session.getNextLayerName('Gradient'), { fullCanvas: true });
    }

    this.session.beginEdit('Draw Gradient');
    const ctx = layer.ctx;
    ctx.save();

    const scaleX = layer.pixelW / layer.transform.w;
    const scaleY = layer.pixelH / layer.transform.h;
    const lx1 = (grad.x1 - layer.transform.x) * scaleX;
    const ly1 = (grad.y1 - layer.transform.y) * scaleY;
    const lx2 = (grad.x2 - layer.transform.x) * scaleX;
    const ly2 = (grad.y2 - layer.transform.y) * scaleY;

    // Clip to selection if active
    if (this.session.selectionPath && this.session.selectionPath.length > 2) {
      ctx.beginPath();
      const first = this.session.selectionPath[0];
      ctx.moveTo((first.x - layer.transform.x) * scaleX, (first.y - layer.transform.y) * scaleY);
      for (let i = 1; i < this.session.selectionPath.length; i++) {
        const pt = this.session.selectionPath[i];
        ctx.lineTo((pt.x - layer.transform.x) * scaleX, (pt.y - layer.transform.y) * scaleY);
      }
      ctx.closePath();
      ctx.clip();
    } else if (this.session.selectionRect) {
      const sr = this.session.selectionRect;
      const rx = (sr.x - layer.transform.x) * scaleX;
      const ry = (sr.y - layer.transform.y) * scaleY;
      const rw = sr.w * scaleX;
      const rh = sr.h * scaleY;
      ctx.beginPath();
      ctx.rect(rx, ry, rw, rh);
      ctx.clip();
    }

    let g;
    if (this.session.gradientType === 'radial') {
      const r = Math.hypot(lx2 - lx1, ly2 - ly1);
      g = ctx.createRadialGradient(lx1, ly1, 0, lx1, ly1, r);
    } else {
      g = ctx.createLinearGradient(lx1, ly1, lx2, ly2);
    }

    const stops = this.session.gradientStops || [
      { offset: 0, color: this.session.fgColor },
      { offset: 1, color: this.session.bgColor },
    ];

    const stepsCount = this.session.gradientSteps || 0;
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

    ctx.globalAlpha = Math.max(0, Math.min(1, this.session.gradientOpacity ?? 1.0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, layer.pixelW, layer.pixelH);

    ctx.restore();
    layer.markChanged();
    this.session.endEdit();
  }

  // ─── File Drag & Drop ───────────────────────────────────────────────────────

  async _onDrop(e) {
    e.preventDefault();
    this.area.classList.remove('drop-target');
    const files = [...(e.dataTransfer?.files ?? [])].filter(f => /\.(png|jpe?g|tiff?|webp)$/i.test(f.name));
    for (const file of files) {
      await this._importFromPath(file.path);
    }
  }

  async _importFromPath(filePath) {
    const res = await window.api.importImage(filePath);
    if (!res.ok) { console.error(res.error); return; }

    const bitmap = await this._b64ToBitmap(res.b64, res.width, res.height);
    if (!bitmap) return;

    if (!this.session.document) {
      this.session.newDocument(res.width, res.height);
    }

    this.session.addImageLayer({ bitmap, w: res.width, h: res.height, name: res.name });
    this._markDirty();
  }

  async _b64ToBitmap(b64, w, h) {
    try {
      const bin = atob(b64);
      const raw = new Uint8ClampedArray(bin.length);
      for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
      const imageData = new ImageData(raw, w, h);
      return await createImageBitmap(imageData);
    } catch (e) { console.error('bitmap decode:', e); return null; }
  }

  async importFiles(filePaths) {
    for (const fp of filePaths) await this._importFromPath(fp);
  }

  getDocumentRGBA() {
    const doc = this.session.document;
    if (!doc) return null;
    const off = document.createElement('canvas');
    off.width = doc.width;
    off.height = doc.height;
    const ctx = off.getContext('2d', { willReadFrequently: true });

    for (const layer of doc.layers.filter(l => l.isVisible && !l.isGroup && (l.canvas || l.bitmap))) {
      ctx.save();
      ctx.globalAlpha = layer.opacity;
      ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);
      const t = layer.transform;
      const cx = t.x + t.w / 2, cy = t.y + t.h / 2;
      ctx.translate(cx, cy);
      if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);
      if (t.flipX) ctx.scale(-1, 1);
      if (t.flipY) ctx.scale(1, -1);
      ctx.drawImage(layer.canvas || layer.bitmap, -t.w / 2, -t.h / 2, t.w, t.h);
      ctx.restore();
    }
    const id = ctx.getImageData(0, 0, doc.width, doc.height);
    return { data: id.data, width: doc.width, height: doc.height };
  }

  // ─── Canvas & Layer Context Menus ───────────────────────────────────────────

  _onContextMenu(e) {
    e.preventDefault();
    e.stopPropagation();

    const rect = this.area.getBoundingClientRect();
    const [dx, dy] = this.screenToDoc(e.clientX - rect.left, e.clientY - rect.top);
    const doc = this.session.document;
    if (!doc) return;

    // Find topmost visible layer under cursor
    const layers = doc.layers || [];
    const hitLayer = [...layers].reverse().find(l =>
      l.isVisible && !l.isGroup && l.transform.contains(dx, dy)
    );

    if (hitLayer) {
      if (this.session.activeLayerID !== hitLayer.id) {
        this.session.activeLayerID = hitLayer.id;
        this.session.selectedLayerIDs = new Set([hitLayer.id]);
        this.session._emit('change');
        this._markDirty();
      }
      this._showItemContextMenu(hitLayer, e.clientX, e.clientY, dx, dy);
    } else {
      this._showCanvasContextMenu(e.clientX, e.clientY, dx, dy);
    }
  }

  _showItemContextMenu(layer, clientX, clientY, docX, docY) {
    const s = this.session;
    const hasClip = s.hasClipboardLayer();

    const shapeOptions = [
      { label: 'None (Standard)', value: 'none' },
      { label: 'Circle / Ellipse', value: 'circle' },
      { label: 'Rounded Rectangle', value: 'rounded-rectangle' },
      { label: 'Star (5-Point)', value: 'star' },
      { label: 'Heart', value: 'heart' },
      { label: 'Diamond', value: 'diamond' },
      { label: 'Triangle', value: 'triangle' },
      { label: 'Hexagon', value: 'hexagon' },
      { label: 'Pentagon', value: 'pentagon' },
      { label: 'Octagon', value: 'octagon' },
      { label: 'Trapezoid', value: 'trapezoid' },
      { label: 'Arrow', value: 'arrow' },
    ];

    const items = [
      {
        label: 'Cut',
        shortcut: 'Ctrl+X',
        disabled: layer.isLocked,
        action: () => s.cutLayer(layer.id),
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: () => s.copyLayer(layer.id),
      },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        disabled: !hasClip,
        action: () => s.pasteLayer({ x: docX, y: docY }),
      },
      {
        label: 'Paste in Place',
        shortcut: 'Ctrl+Shift+V',
        disabled: !hasClip,
        action: () => s.pasteLayer({ inPlace: true }),
      },
      {
        label: 'Duplicate',
        shortcut: 'Ctrl+J',
        action: () => s.duplicateLayer(layer.id),
      },
      {
        label: 'Delete Layer',
        shortcut: 'Del',
        danger: true,
        action: () => promptDeleteLayers(s, layer.id),
      },
      { separator: true },
      {
        label: 'Arrange',
        isSubmenu: true,
        submenu: [
          {
            label: 'Bring to Front',
            shortcut: 'Ctrl+Shift+]',
            action: () => s.bringToFront(layer.id),
          },
          {
            label: 'Bring Forward',
            shortcut: 'Ctrl+]',
            action: () => s.bringForward(layer.id),
          },
          {
            label: 'Send Backward',
            shortcut: 'Ctrl+[',
            action: () => s.sendBackward(layer.id),
          },
          {
            label: 'Send to Back',
            shortcut: 'Ctrl+Shift+[',
            action: () => s.sendToBack(layer.id),
          },
        ],
      },
      { separator: true },
      ...(layer.textData ? [
        {
          label: 'Edit Text…',
          action: () => {
            s.beginEdit('Edit Text');
            const targetDocX = layer.transform.x;
            const targetDocY = layer.transform.y;

            openTextEditor(
              s, layer, targetDocX, targetDocY,
              layer.textData,
              () => {
                layer.markChanged();
                s.endEdit();
                s.setTool(Tool.MOVE);
                s._emit('canvas-dirty');
              },
              () => {
                s.endEdit();
                renderTextToLayer(layer, targetDocX, targetDocY, layer.textData);
                s._emit('canvas-dirty');
              },
              { initialBoxW: layer.transform.w, initialBoxH: layer.transform.h }
            );
          }
        },
        { separator: true }
      ] : [
        {
          label: `Frame to Shape (${layer.shapeMask && layer.shapeMask !== 'none' ? layer.shapeMask : 'None'})`,
          isSubmenu: true,
          submenu: shapeOptions.map(opt => ({
            label: opt.label,
            checked: (layer.shapeMask === opt.value || (!layer.shapeMask && opt.value === 'none')),
            action: () => {
              s.beginEdit('Change Layer Shape Frame');
              layer.shapeMask = opt.value;
              layer.markChanged();
              s.endEdit();
              s._emit('canvas-dirty');
            }
          })),
        },
        { separator: true }
      ]),
      {
        label: layer.isLocked ? 'Unlock Layer' : 'Lock Layer',
        action: () => s.setLayerLocked(layer.id, !layer.isLocked),
      },
      { separator: true },
      {
        label: 'Flip Horizontal',
        action: () => s.flipLayerH(layer.id),
      },
      {
        label: 'Flip Vertical',
        action: () => s.flipLayerV(layer.id),
      },
      {
        label: 'Mirror Horizontal (Duplicate)',
        action: () => s.mirrorLayerH(layer.id),
      },
      {
        label: 'Mirror Vertical (Duplicate)',
        action: () => s.mirrorLayerV(layer.id),
      },
      {
        label: 'Invert Colors',
        shortcut: 'Ctrl+I',
        action: () => s.invertActiveLayer(),
      },
      {
        label: 'Remove Background (AI)',
        action: () => removeBackground(s),
      },
    ];

    showContextMenu({ x: clientX, y: clientY, items });
  }

  _showCanvasContextMenu(clientX, clientY, docX, docY) {
    const s = this.session;
    const hasClip = s.hasClipboardLayer();
    const hasSel = !!(s.selectionRect || s.selectionPath);

    const items = [
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        disabled: !hasClip,
        action: () => s.pasteLayer({ x: docX, y: docY }),
      },
      {
        label: 'Paste in Place',
        shortcut: 'Ctrl+Shift+V',
        disabled: !hasClip,
        action: () => s.pasteLayer({ inPlace: true }),
      },
      { separator: true },
      {
        label: 'New Layer',
        shortcut: 'Ctrl+Shift+N',
        action: () => s.addBlankLayer(),
      },
      {
        label: 'New Text Layer',
        action: () => {
          const defaultFontSize = Math.max(12, Math.round(s.fontSize || 48));
          const boxW = Math.max(180, Math.round(defaultFontSize * 4));
          const boxH = Math.max(48, Math.round(defaultFontSize * 1.5));
          const textLayer = s.addBlankLayer(s.getNextLayerName('Text'), {
            x: Math.round(docX),
            y: Math.round(docY),
            w: boxW,
            h: boxH,
          });
          s.beginEdit('Add Text');
          openTextEditor(
            s, textLayer, docX, docY, null,
            () => {
              textLayer.markChanged();
              s.endEdit();
              s.setTool(Tool.CURSOR);
              s._emit('canvas-dirty');
            },
            () => {
              s.endEdit();
              s.undo();
            },
            { initialBoxW: boxW, initialBoxH: boxH }
          );
        },
      },
      {
        label: 'Insert Clip Art…',
        shortcut: 'Ctrl+Shift+I',
        action: () => window._showClipartPanel?.(s),
      },
      {
        label: 'Insert WordArt…',
        shortcut: 'Ctrl+Shift+W',
        action: () => window._showWordArtPanel?.(s),
      },
      { separator: true },
      {
        label: 'Deselect',
        shortcut: 'Ctrl+D',
        disabled: !hasSel,
        action: () => s.deselect(),
      },
      { separator: true },
      {
        label: 'Fit to Screen',
        shortcut: 'Ctrl+0',
        action: () => this.zoomToFit(),
      },
      {
        label: 'Actual Size (100%)',
        shortcut: 'Ctrl+1',
        action: () => this.zoomTo(1),
      },
    ];

    showContextMenu({ x: clientX, y: clientY, items });
  }
}
