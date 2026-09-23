// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/imageSize.js  —  Interactive Image Size & Canvas Size modal dialogs
// ─────────────────────────────────────────────────────────────────────────────

import { iconLink, iconUnlink } from '../icons.js';

/**
 * Image Size Panel — Proportionally or arbitrarily resamples the canvas and all layers
 */
export function showImageSizePanel(session) {
  const doc = session.document;
  if (!doc) return;

  const origW = doc.width;
  const origH = doc.height;
  const origRes = doc.resolution || 72;
  const aspect = origW / (origH || 1);

  let lockRatio = true;
  let currentUnit = 'px'; // 'px' | 'in' | '%'

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="min-width:380px;box-shadow:var(--shadow-lg,#000000 0 16px 36px)">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
        <span>Image Size</span>
        <span style="font-size:11px;font-weight:normal;color:var(--text-muted)">Original: ${origW} × ${origH} px</span>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;padding:16px">

        <div style="display:grid;grid-template-columns:1fr auto 1fr;gap:8px;align-items:center">
          <div class="form-group">
            <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block">Width</label>
            <input class="form-input mono" id="is-width" type="number" step="any" min="1" max="50000" value="${origW}" style="width:100%" />
          </div>

          <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding-top:16px">
            <button class="btn btn-secondary btn-sm" id="is-lock-btn" title="Constrain Aspect Ratio" style="width:28px;height:28px;padding:0;display:flex;align-items:center;justify-content:center;background:var(--accent-dim,rgba(79,142,247,0.15));border-color:var(--accent,#4f8ef7);color:var(--accent,#4f8ef7)">${iconLink(14)}</button>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block">Height</label>
            <input class="form-input mono" id="is-height" type="number" step="any" min="1" max="50000" value="${origH}" style="width:100%" />
          </div>
        </div>

        <div class="form-row" style="display:flex;align-items:center;justify-content:space-between">
          <label class="form-label" style="margin:0">Unit</label>
          <select class="form-input" id="is-unit-select" style="width:120px;padding:4px 8px">
            <option value="px" selected>Pixels (px)</option>
            <option value="percent">Percent (%)</option>
            <option value="in">Inches (in)</option>
          </select>
        </div>

        <div class="form-row" style="display:flex;align-items:center;justify-content:space-between">
          <label class="form-label" style="margin:0">Resolution</label>
          <div style="display:flex;align-items:center;gap:6px">
            <input class="form-input mono" id="is-res" type="number" min="1" max="2400" value="${origRes}" style="width:75px" />
            <span style="color:var(--text-muted);font-size:11px">ppi</span>
          </div>
        </div>

        <div class="form-row" style="display:flex;align-items:center;justify-content:space-between">
          <label class="form-label" style="margin:0">Resampling</label>
          <select class="form-input" id="is-resample-method" style="width:170px;padding:4px 8px">
            <option value="bicubic" selected>Bicubic (High Quality)</option>
            <option value="bilinear">Bilinear (Medium)</option>
            <option value="nearest">Nearest Neighbor (Pixelated)</option>
          </select>
        </div>

      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--panel-border)">
        <button class="btn btn-secondary" id="is-cancel">Cancel</button>
        <button class="btn btn-primary" id="is-apply">Apply</button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  const wInput = overlay.querySelector('#is-width');
  const hInput = overlay.querySelector('#is-height');
  const lockBtn = overlay.querySelector('#is-lock-btn');
  const unitSelect = overlay.querySelector('#is-unit-select');
  const resInput = overlay.querySelector('#is-res');
  const methodSelect = overlay.querySelector('#is-resample-method');
  const cancelBtn = overlay.querySelector('#is-cancel');
  const applyBtn = overlay.querySelector('#is-apply');

  const close = () => overlay.remove();

  lockBtn.addEventListener('click', () => {
    lockRatio = !lockRatio;
    lockBtn.innerHTML = lockRatio ? iconLink(14) : iconUnlink(14);
    lockBtn.style.color = lockRatio ? 'var(--accent,#4f8ef7)' : 'var(--text-muted)';
    lockBtn.style.borderColor = lockRatio ? 'var(--accent,#4f8ef7)' : 'var(--panel-border)';
  });

  const getPixels = () => {
    const rawW = parseFloat(wInput.value) || origW;
    const rawH = parseFloat(hInput.value) || origH;
    const res = parseFloat(resInput.value) || origRes;

    if (currentUnit === 'percent') {
      return {
        w: Math.max(1, Math.round((rawW / 100) * origW)),
        h: Math.max(1, Math.round((rawH / 100) * origH))
      };
    }
    if (currentUnit === 'in') {
      return {
        w: Math.max(1, Math.round(rawW * res)),
        h: Math.max(1, Math.round(rawH * res))
      };
    }
    return {
      w: Math.max(1, Math.round(rawW)),
      h: Math.max(1, Math.round(rawH))
    };
  };

  wInput.addEventListener('input', () => {
    if (!lockRatio) return;
    const rawW = parseFloat(wInput.value);
    if (!rawW || rawW <= 0) return;
    if (currentUnit === 'percent') {
      hInput.value = rawW.toFixed(1);
    } else {
      hInput.value = Math.max(1, Math.round(rawW / aspect));
    }
  });

  hInput.addEventListener('input', () => {
    if (!lockRatio) return;
    const rawH = parseFloat(hInput.value);
    if (!rawH || rawH <= 0) return;
    if (currentUnit === 'percent') {
      wInput.value = rawH.toFixed(1);
    } else {
      wInput.value = Math.max(1, Math.round(rawH * aspect));
    }
  });

  unitSelect.addEventListener('change', () => {
    const px = getPixels();
    currentUnit = unitSelect.value;
    const res = parseFloat(resInput.value) || origRes;

    if (currentUnit === 'percent') {
      wInput.value = ((px.w / origW) * 100).toFixed(1);
      hInput.value = ((px.h / origH) * 100).toFixed(1);
    } else if (currentUnit === 'in') {
      wInput.value = (px.w / res).toFixed(2);
      hInput.value = (px.h / res).toFixed(2);
    } else {
      wInput.value = px.w;
      hInput.value = px.h;
    }
  });

  applyBtn.addEventListener('click', () => {
    const { w, h } = getPixels();
    const res = Math.max(1, parseInt(resInput.value, 10) || origRes);
    const method = methodSelect.value;
    session.resizeImage(w, h, res, method);
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}

/**
 * Canvas Size Panel — Expands or crops the canvas boundary with 9-point anchor grid
 */
export function showCanvasSizePanel(session) {
  const doc = session.document;
  if (!doc) return;

  const origW = doc.width;
  const origH = doc.height;

  let selectedAnchor = 'center';
  let isRelative = false;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal" style="min-width:390px;box-shadow:var(--shadow-lg,#000000 0 16px 36px)">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between">
        <span>Canvas Size</span>
        <span style="font-size:11px;font-weight:normal;color:var(--text-muted)">Current: ${origW} × ${origH} px</span>
      </div>
      <div class="modal-body" style="display:flex;flex-direction:column;gap:12px;padding:16px">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="form-group">
            <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block">New Width (px)</label>
            <input class="form-input mono" id="cs-width" type="number" step="any" min="1" max="50000" value="${origW}" style="width:100%" />
          </div>
          <div class="form-group">
            <label class="form-label" style="font-size:11px;margin-bottom:4px;display:block">New Height (px)</label>
            <input class="form-input mono" id="cs-height" type="number" step="any" min="1" max="50000" value="${origH}" style="width:100%" />
          </div>
        </div>

        <div class="form-row" style="display:flex;align-items:center;gap:6px">
          <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:12px">
            <input type="checkbox" id="cs-relative" />
            <span>Relative (Add / Subtract delta pixels)</span>
          </label>
        </div>

        <div class="form-row" style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px">
          <div>
            <label class="form-label" style="font-size:11px;margin-bottom:6px;display:block">Anchor Position</label>
            <div id="cs-anchor-grid" style="display:grid;grid-template-columns:repeat(3, 28px);grid-template-rows:repeat(3, 28px);gap:3px">
              <button class="anchor-cell" data-anchor="top-left" title="Top Left">↖</button>
              <button class="anchor-cell" data-anchor="top" title="Top Center">↑</button>
              <button class="anchor-cell" data-anchor="top-right" title="Top Right">↗</button>
              <button class="anchor-cell" data-anchor="left" title="Middle Left">←</button>
              <button class="anchor-cell active" data-anchor="center" title="Center" style="font-weight:bold">•</button>
              <button class="anchor-cell" data-anchor="right" title="Middle Right">→</button>
              <button class="anchor-cell" data-anchor="bottom-left" title="Bottom Left">↙</button>
              <button class="anchor-cell" data-anchor="bottom" title="Bottom Center">↓</button>
              <button class="anchor-cell" data-anchor="bottom-right" title="Bottom Right">↘</button>
            </div>
          </div>

          <div style="flex:1">
            <label class="form-label" style="font-size:11px;margin-bottom:6px;display:block">Canvas Extension Fill</label>
            <select class="form-input" id="cs-bg-mode" style="width:100%;padding:4px 8px;margin-bottom:8px">
              <option value="transparent" selected>Transparent</option>
              <option value="white">White</option>
              <option value="black">Black</option>
              <option value="fg">Foreground Color</option>
              <option value="bg">Background Color</option>
              <option value="custom">Custom Color…</option>
            </select>
            <input type="color" id="cs-custom-color" value="#ffffff" style="display:none;width:100%;height:26px;border-radius:4px;cursor:pointer" />
          </div>
        </div>

      </div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:8px;padding:12px 16px;border-top:1px solid var(--panel-border)">
        <button class="btn btn-secondary" id="cs-cancel">Cancel</button>
        <button class="btn btn-primary" id="cs-apply">Apply</button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  const styleEl = document.createElement('style');
  styleEl.textContent = `
    .anchor-cell {
      background: var(--panel-bg-3, #222);
      border: 1px solid var(--panel-border, rgba(255,255,255,0.1));
      border-radius: 3px;
      color: var(--text-muted, #888);
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      padding: 0;
      transition: all 0.15s;
    }
    .anchor-cell:hover {
      background: var(--panel-bg-2, #333);
      color: var(--text, #fff);
    }
    .anchor-cell.active {
      background: var(--accent, #4f8ef7) !important;
      border-color: var(--accent, #4f8ef7) !important;
      color: #fff !important;
    }
  `;
  overlay.appendChild(styleEl);

  const wInput = overlay.querySelector('#cs-width');
  const hInput = overlay.querySelector('#cs-height');
  const relCb = overlay.querySelector('#cs-relative');
  const anchorCells = overlay.querySelectorAll('.anchor-cell');
  const bgModeSelect = overlay.querySelector('#cs-bg-mode');
  const customColorInput = overlay.querySelector('#cs-custom-color');
  const cancelBtn = overlay.querySelector('#cs-cancel');
  const applyBtn = overlay.querySelector('#cs-apply');

  const close = () => overlay.remove();

  relCb.addEventListener('change', () => {
    isRelative = relCb.checked;
    if (isRelative) {
      wInput.value = '0';
      hInput.value = '0';
    } else {
      wInput.value = origW;
      hInput.value = origH;
    }
  });

  anchorCells.forEach(btn => {
    btn.addEventListener('click', () => {
      anchorCells.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      selectedAnchor = btn.dataset.anchor;
    });
  });

  bgModeSelect.addEventListener('change', () => {
    customColorInput.style.display = bgModeSelect.value === 'custom' ? 'block' : 'none';
  });

  applyBtn.addEventListener('click', () => {
    const rawW = parseFloat(wInput.value) || 0;
    const rawH = parseFloat(hInput.value) || 0;
    const targetW = isRelative ? Math.max(1, Math.round(origW + rawW)) : Math.max(1, Math.round(rawW));
    const targetH = isRelative ? Math.max(1, Math.round(origH + rawH)) : Math.max(1, Math.round(rawH));

    const bgMode = bgModeSelect.value;
    const customColor = customColorInput.value;

    session.resizeCanvas(targetW, targetH, selectedAnchor, bgMode, customColor);
    close();
  });

  cancelBtn.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
}
