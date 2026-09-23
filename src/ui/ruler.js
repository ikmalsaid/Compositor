// ─────────────────────────────────────────────────────────────────────────────
// ui/ruler.js  —  Pixel Rulers, Draggable Guides, and Smart Snapping
// ─────────────────────────────────────────────────────────────────────────────

export class RulerView {
  /**
   * @param {import('./canvas.js').CanvasView} canvasView
   * @param {import('../store/session.js').EditorSession} session
   */
  constructor(canvasView, session) {
    this.canvasView = canvasView;
    this.session    = session;

    this.corner = document.getElementById('ruler-corner');
    this.rulerH = document.getElementById('ruler-h');
    this.rulerV = document.getElementById('ruler-v');
    this.ctxH   = this.rulerH?.getContext('2d');
    this.ctxV   = this.rulerV?.getContext('2d');

    this.guidesLayer = document.getElementById('guides-overlay');

    this._activeGuideDrag = null; // { type: 'horizontal'|'vertical', index: number, isNew: boolean }
    this._mouseDocPos     = null; // { x, y }

    this._bindEvents();
  }

  // ─── Event Binding ─────────────────────────────────────────────────────────

  _bindEvents() {
    if (!this.rulerH || !this.rulerV) return;

    // Drag from horizontal ruler -> create/drag horizontal guide
    this.rulerH.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = this.canvasView.area.getBoundingClientRect();
      const sy = e.clientY - rect.top;
      const [, dy] = this.canvasView.screenToDoc(0, sy);
      this.session.guides.horizontal.push(Math.round(dy));
      const idx = this.session.guides.horizontal.length - 1;
      this._startGuideDrag('horizontal', idx, true);
    });

    // Drag from vertical ruler -> create/drag vertical guide
    this.rulerV.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      const rect = this.canvasView.area.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const [dx] = this.canvasView.screenToDoc(sx, 0);
      this.session.guides.vertical.push(Math.round(dx));
      const idx = this.session.guides.vertical.length - 1;
      this._startGuideDrag('vertical', idx, true);
    });

    // Corner click: center canvas and zoom to fit
    this.corner?.addEventListener('click', () => {
      this.canvasView.zoomToFit();
    });
  }

  _startGuideDrag(type, index, isNew = false) {
    this._activeGuideDrag = { type, index, isNew };
    this.guidesLayer?.classList.add('dragging');

    const onPointerMove = (e) => {
      if (!this._activeGuideDrag) return;
      const rect = this.canvasView.area.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const [dx, dy] = this.canvasView.screenToDoc(sx, sy);

      if (this._activeGuideDrag.type === 'horizontal') {
        // If dragged back into ruler area (< 20px from top), mark as delete
        if (sy < 20 && !this._activeGuideDrag.isNew) {
          this.session.guides.horizontal[this._activeGuideDrag.index] = -999999;
        } else {
          this.session.guides.horizontal[this._activeGuideDrag.index] = Math.round(dy);
        }
      } else {
        // If dragged back into ruler area (< 20px from left), mark as delete
        if (sx < 20 && !this._activeGuideDrag.isNew) {
          this.session.guides.vertical[this._activeGuideDrag.index] = -999999;
        } else {
          this.session.guides.vertical[this._activeGuideDrag.index] = Math.round(dx);
        }
      }

      this.renderGuides();
      this.renderRulers();
    };

    const onPointerUp = (e) => {
      if (!this._activeGuideDrag) return;
      const rect = this.canvasView.area.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;

      if (this._activeGuideDrag.type === 'horizontal') {
        if (sy < 20) {
          this.session.guides.horizontal.splice(this._activeGuideDrag.index, 1);
        } else {
          this.session.guides.horizontal[this._activeGuideDrag.index] = Math.round(this.session.guides.horizontal[this._activeGuideDrag.index]);
        }
      } else {
        if (sx < 20) {
          this.session.guides.vertical.splice(this._activeGuideDrag.index, 1);
        } else {
          this.session.guides.vertical[this._activeGuideDrag.index] = Math.round(this.session.guides.vertical[this._activeGuideDrag.index]);
        }
      }

      this._activeGuideDrag = null;
      this.guidesLayer?.classList.remove('dragging');
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      this.renderGuides();
      this.renderRulers();
    };

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // ─── Snapping Engine ───────────────────────────────────────────────────────

  /**
   * Snaps a box (x, y, w, h) against guides and canvas boundaries.
   * @param {number} x
   * @param {number} y
   * @param {number} w
   * @param {number} h
   * @returns {{ snapX: number, snapY: number, guideLinesX: number[], guideLinesY: number[] }}
   */
  snapRect(x, y, w, h) {
    if (!this.session.snapToGuides) return { snapX: x, snapY: y, guideLinesX: [], guideLinesY: [] };

    const doc = this.session.document;
    const tol = Math.max(4, 7 / this.canvasView.scale); // snap tolerance in doc units

    // Targets in X
    const targetsX = [
      0, doc?.width ?? 0, (doc?.width ?? 0) / 2,
      ...this.session.guides.vertical
    ];

    // Targets in Y
    const targetsY = [
      0, doc?.height ?? 0, (doc?.height ?? 0) / 2,
      ...this.session.guides.horizontal
    ];

    let snapX = x;
    let snapY = y;
    const guideLinesX = [];
    const guideLinesY = [];

    // X candidates: left (x), center (x + w/2), right (x + w)
    const candX = [
      { pos: x, offset: 0 },
      { pos: x + w / 2, offset: -w / 2 },
      { pos: x + w, offset: -w }
    ];

    let minDiffX = tol + 1;
    for (const c of candX) {
      for (const t of targetsX) {
        const diff = Math.abs(c.pos - t);
        if (diff <= tol && diff < minDiffX) {
          minDiffX = diff;
          snapX = Math.round(t + c.offset);
          guideLinesX.length = 0;
          guideLinesX.push(t);
        }
      }
    }

    // Y candidates: top (y), middle (y + h/2), bottom (y + h)
    const candY = [
      { pos: y, offset: 0 },
      { pos: y + h / 2, offset: -h / 2 },
      { pos: y + h, offset: -h }
    ];

    let minDiffY = tol + 1;
    for (const c of candY) {
      for (const t of targetsY) {
        const diff = Math.abs(c.pos - t);
        if (diff <= tol && diff < minDiffY) {
          minDiffY = diff;
          snapY = Math.round(t + c.offset);
          guideLinesY.length = 0;
          guideLinesY.push(t);
        }
      }
    }

    return { snapX, snapY, guideLinesX, guideLinesY };
  }

  // ─── Rendering ─────────────────────────────────────────────────────────────

  update(mouseDocPos = null) {
    if (mouseDocPos) this._mouseDocPos = mouseDocPos;
    const show = this.session.showRulers;

    if (this.corner) this.corner.style.display = show ? 'flex' : 'none';
    if (this.rulerH) this.rulerH.style.display = show ? 'block' : 'none';
    if (this.rulerV) this.rulerV.style.display = show ? 'block' : 'none';

    if (show) this.renderRulers();
    this.renderGuides();
  }

  renderRulers() {
    if (!this.session.showRulers) return;
    const area = this.canvasView.area;
    if (!area) return;

    const areaW = area.clientWidth;
    const areaH = area.clientHeight;
    if (areaW <= 0 || areaH <= 0) return;

    const scale = this.canvasView.scale;
    const tx = this.canvasView.tx;
    const ty = this.canvasView.ty;

    // Resize canvas buffers to match CSS pixels (1:1)
    if (this.rulerH.width !== areaW || this.rulerH.height !== 20) {
      this.rulerH.width = areaW;
      this.rulerH.height = 20;
    }
    if (this.rulerV.width !== 20 || this.rulerV.height !== areaH) {
      this.rulerV.width = 20;
      this.rulerV.height = areaH;
    }

    // Determine interval step based on zoom
    let step = 100;
    if (scale >= 4) step = 10;
    else if (scale >= 2) step = 25;
    else if (scale >= 0.8) step = 50;
    else if (scale >= 0.3) step = 100;
    else if (scale >= 0.1) step = 250;
    else step = 500;

    const doc = this.session.document;
    const docW = doc?.width ?? 0;
    const docH = doc?.height ?? 0;

    // ─── Horizontal Ruler ─────────────────────────────────────────────────────
    const ctxH = this.ctxH;
    const canvasStartSX = Math.round(tx);
    const canvasEndSX   = Math.round(tx + docW * scale);
    const canvasMidSX   = Math.round(tx + (docW / 2) * scale);

    // Dark background outside canvas
    ctxH.fillStyle = '#141414';
    ctxH.fillRect(0, 0, areaW, 20);

    // Active canvas span highlighting
    const visStartSX = Math.max(20, canvasStartSX);
    const visEndSX   = Math.min(areaW, canvasEndSX);
    if (visEndSX > visStartSX) {
      ctxH.fillStyle = '#222222';
      ctxH.fillRect(visStartSX, 0, visEndSX - visStartSX, 20);
      ctxH.fillStyle = 'rgba(79, 142, 247, 0.4)';
      ctxH.fillRect(visStartSX, 0, visEndSX - visStartSX, 2);
    }

    ctxH.fillStyle = '#777777';
    ctxH.strokeStyle = '#3e3e3e';
    ctxH.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctxH.lineWidth = 1;

    // Calculate start and end document coordinates visible in viewport
    const startDocX = Math.floor((-tx) / (step * scale)) * step;
    const endDocX   = Math.ceil((areaW - tx) / (step * scale)) * step;

    for (let x = startDocX; x <= endDocX; x += step) {
      const screenX = Math.round(tx + x * scale);
      if (screenX < 20 || screenX > areaW) continue;

      // Major tick & number
      ctxH.beginPath();
      ctxH.moveTo(screenX, 0);
      ctxH.lineTo(screenX, 10);
      ctxH.stroke();
      ctxH.fillText(`${x}`, screenX + 2, 13);

      // Minor ticks
      const sub = step / 5;
      for (let s = 1; s < 5; s++) {
        const subSX = Math.round(tx + (x + s * sub) * scale);
        if (subSX >= 20 && subSX <= areaW) {
          ctxH.beginPath();
          ctxH.moveTo(subSX, 0);
          ctxH.lineTo(subSX, s === 2 || s === 3 ? 6 : 3);
          ctxH.stroke();
        }
      }
    }

    // Prominent canvas edge markers on horizontal ruler
    if (canvasStartSX >= 20 && canvasStartSX <= areaW) {
      ctxH.strokeStyle = '#4f8ef7';
      ctxH.lineWidth = 2;
      ctxH.beginPath();
      ctxH.moveTo(canvasStartSX, 0);
      ctxH.lineTo(canvasStartSX, 18);
      ctxH.stroke();
    }
    if (canvasEndSX >= 20 && canvasEndSX <= areaW) {
      ctxH.strokeStyle = '#4f8ef7';
      ctxH.lineWidth = 2;
      ctxH.beginPath();
      ctxH.moveTo(canvasEndSX, 0);
      ctxH.lineTo(canvasEndSX, 18);
      ctxH.stroke();
    }
    if (canvasMidSX >= 20 && canvasMidSX <= areaW) {
      ctxH.strokeStyle = '#00d2ff';
      ctxH.lineWidth = 1.5;
      ctxH.beginPath();
      ctxH.moveTo(canvasMidSX, 0);
      ctxH.lineTo(canvasMidSX, 14);
      ctxH.stroke();
    }

    // Cursor position indicator tick on horizontal ruler
    if (this._mouseDocPos) {
      const cursorSX = Math.round(tx + this._mouseDocPos.x * scale);
      if (cursorSX >= 20 && cursorSX <= areaW) {
        ctxH.strokeStyle = '#00d2ff';
        ctxH.lineWidth = 1.5;
        ctxH.beginPath();
        ctxH.moveTo(cursorSX, 0);
        ctxH.lineTo(cursorSX, 20);
        ctxH.stroke();
      }
    }

    // ─── Vertical Ruler ───────────────────────────────────────────────────────
    const ctxV = this.ctxV;
    const canvasStartSY = Math.round(ty);
    const canvasEndSY   = Math.round(ty + docH * scale);
    const canvasMidSY   = Math.round(ty + (docH / 2) * scale);

    // Dark background outside canvas
    ctxV.fillStyle = '#141414';
    ctxV.fillRect(0, 0, 20, areaH);

    // Active canvas span highlighting
    const visStartSY = Math.max(20, canvasStartSY);
    const visEndSY   = Math.min(areaH, canvasEndSY);
    if (visEndSY > visStartSY) {
      ctxV.fillStyle = '#222222';
      ctxV.fillRect(0, visStartSY, 20, visEndSY - visStartSY);
      ctxV.fillStyle = 'rgba(79, 142, 247, 0.4)';
      ctxV.fillRect(0, visStartSY, 2, visEndSY - visStartSY);
    }

    ctxV.fillStyle = '#777777';
    ctxV.strokeStyle = '#3e3e3e';
    ctxV.font = '9px -apple-system, BlinkMacSystemFont, sans-serif';
    ctxV.lineWidth = 1;

    const startDocY = Math.floor((-ty) / (step * scale)) * step;
    const endDocY   = Math.ceil((areaH - ty) / (step * scale)) * step;

    for (let y = startDocY; y <= endDocY; y += step) {
      const screenY = Math.round(ty + y * scale);
      if (screenY < 20 || screenY > areaH) continue;

      ctxV.beginPath();
      ctxV.moveTo(0, screenY);
      ctxV.lineTo(10, screenY);
      ctxV.stroke();

      ctxV.save();
      ctxV.translate(13, screenY + 2);
      ctxV.rotate(-Math.PI / 2);
      ctxV.fillText(`${y}`, 0, 0);
      ctxV.restore();

      // Minor ticks
      const sub = step / 5;
      for (let s = 1; s < 5; s++) {
        const subSY = Math.round(ty + (y + s * sub) * scale);
        if (subSY >= 20 && subSY <= areaH) {
          ctxV.beginPath();
          ctxV.moveTo(0, subSY);
          ctxV.lineTo(s === 2 || s === 3 ? 6 : 3, subSY);
          ctxV.stroke();
        }
      }
    }

    // Prominent canvas edge markers on vertical ruler
    if (canvasStartSY >= 20 && canvasStartSY <= areaH) {
      ctxV.strokeStyle = '#4f8ef7';
      ctxV.lineWidth = 2;
      ctxV.beginPath();
      ctxV.moveTo(0, canvasStartSY);
      ctxV.lineTo(18, canvasStartSY);
      ctxV.stroke();
    }
    if (canvasEndSY >= 20 && canvasEndSY <= areaH) {
      ctxV.strokeStyle = '#4f8ef7';
      ctxV.lineWidth = 2;
      ctxV.beginPath();
      ctxV.moveTo(0, canvasEndSY);
      ctxV.lineTo(18, canvasEndSY);
      ctxV.stroke();
    }
    if (canvasMidSY >= 20 && canvasMidSY <= areaH) {
      ctxV.strokeStyle = '#00d2ff';
      ctxV.lineWidth = 1.5;
      ctxV.beginPath();
      ctxV.moveTo(0, canvasMidSY);
      ctxV.lineTo(14, canvasMidSY);
      ctxV.stroke();
    }

    // Cursor position indicator tick on vertical ruler
    if (this._mouseDocPos) {
      const cursorSY = Math.round(ty + this._mouseDocPos.y * scale);
      if (cursorSY >= 20 && cursorSY <= areaH) {
        ctxV.strokeStyle = '#00d2ff';
        ctxV.lineWidth = 1.5;
        ctxV.beginPath();
        ctxV.moveTo(0, cursorSY);
        ctxV.lineTo(20, cursorSY);
        ctxV.stroke();
      }
    }
  }

  renderGuides() {
    if (!this.guidesLayer) return;
    if (!this.session.showGuides) {
      this.guidesLayer.innerHTML = '';
      this.guidesLayer.style.display = 'none';
      return;
    }

    this.guidesLayer.style.display = 'block';
    const scale = this.canvasView.scale;
    const tx = this.canvasView.tx;
    const ty = this.canvasView.ty;

    let html = '';

    // Horizontal guides
    this.session.guides.horizontal.forEach((y, idx) => {
      if (y === -999999) return;
      const sy = Math.round(ty + y * scale);
      html += `
        <div class="guide-line guide-h" data-type="horizontal" data-idx="${idx}" style="top:${sy}px">
          <span class="guide-label">${y}px</span>
        </div>`;
    });

    // Vertical guides
    this.session.guides.vertical.forEach((x, idx) => {
      if (x === -999999) return;
      const sx = Math.round(tx + x * scale);
      html += `
        <div class="guide-line guide-v" data-type="vertical" data-idx="${idx}" style="left:${sx}px">
          <span class="guide-label">${x}px</span>
        </div>`;
    });

    this.guidesLayer.innerHTML = html;

    // Attach drag handlers on rendered guide elements
    this.guidesLayer.querySelectorAll('.guide-line').forEach((el) => {
      el.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        const type = el.dataset.type;
        const idx = parseInt(el.dataset.idx, 10);
        this._startGuideDrag(type, idx, false);
      });
    });
  }
}
