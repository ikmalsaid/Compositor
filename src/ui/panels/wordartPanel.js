// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/wordartPanel.js  —  Classic MS Word-Style WordArt Gallery & Multi-Point Editor
// ─────────────────────────────────────────────────────────────────────────────

import { WORDART_TEMPLATES, renderWordArtCanvas } from '../../assets/wordartTemplates.js';
import { GRADIENT_PRESETS, normalizeStops, stopsToCss, sampleGradient } from '../../assets/gradientData.js';
import { iconClose, iconCheck } from '../icons.js';

let _activeModal = null;
const _thumbCache = new Map();

function getTemplateThumbnail(tpl) {
  if (_thumbCache.has(tpl.id)) {
    const cached = _thumbCache.get(tpl.id);
    const copy = document.createElement('canvas');
    copy.width = cached.width;
    copy.height = cached.height;
    const ctx = copy.getContext('2d');
    ctx.drawImage(cached, 0, 0);
    return copy;
  }
  const canvas = renderWordArtCanvas({
    text: 'WordArt',
    templateId: tpl.id,
    fontSize: 66,
    warpType: tpl.warpType,
    warpAmount: tpl.warpAmount,
    depth3D: tpl.depth3D,
  });
  _thumbCache.set(tpl.id, canvas);
  const copy = document.createElement('canvas');
  copy.width = canvas.width;
  copy.height = canvas.height;
  const ctx = copy.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  return copy;
}

/**
 * Show WordArt Gallery & Editor Modal
 * @param {EditorSession} session
 * @param {Function} [onInserted]
 */
export function showWordArtPanel(session, onInserted) {
  if (_activeModal) {
    _activeModal.remove();
    _activeModal = null;
  }

  let text = 'Compositor';
  let selectedTemplate = WORDART_TEMPLATES[0];
  let fontSize = 60;
  let fontFamily = 'Impact, sans-serif';
  let warpType = selectedTemplate.warpType;
  let warpAmount = selectedTemplate.warpAmount;
  let depth3D = selectedTemplate.depth3D;

  let fillType = selectedTemplate.fillType || 'gradient';
  let solidColor = selectedTemplate.colors?.[0] || '#ff4500';
  let gradientAngle = selectedTemplate.gradientAngle ?? 0;
  let gradientStops = selectedTemplate.colors
    ? normalizeStops(selectedTemplate.colors)
    : normalizeStops(GRADIENT_PRESETS['rainbow-spectrum'].stops);
  let selectedStopIdx = 0;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:1;';

  const modal = document.createElement('div');
  modal.className = 'modal wordart-modal';
  modal.style.cssText = `
    width: 1140px; max-width: 96vw; height: 750px; max-height: 93vh;
    display: flex; flex-direction: column; border-radius: 10px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08);
    background: #18181c; color: #e2e2e8; overflow: hidden;
    font-family: var(--font-sans); font-size: 12px; user-select: none;
    animation: fadeIn 0.15s ease-out;
  `;

  modal.innerHTML = `
    <!-- Top Header -->
    <div style="height:44px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;background:#141417;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
      <div style="font-size:13.5px;font-weight:600;color:#ffffff;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-signature" style="color:var(--accent,#4f8ef7);font-size:15px"></i>
        <span>WordArt Gallery & Gradient Studio</span>
      </div>
      <button id="wa-close-btn" style="background:transparent;border:none;color:#8c8c94;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all .12s" title="Close (Esc)">${iconClose(14)}</button>
    </div>

    <!-- Live Preview Header Display -->
    <div style="height:115px;background:#111114;border-bottom:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;justify-content:center;padding:10px 16px;box-sizing:border-box;overflow:hidden" id="wa-preview-container">
      <!-- Injected live canvas preview -->
    </div>

    <!-- Main Split Area -->
    <div style="flex:1;display:flex;min-height:0;background:#18181c">
      <!-- Left Style Template Grid -->
      <div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;border-right:1px solid rgba(255,255,255,0.07)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px">Choose WordArt Style</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4)">${WORDART_TEMPLATES.length} Presets</div>
        </div>
        <div id="wa-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(235px, 1fr));gap:14px">
          <!-- Injected templates -->
        </div>
      </div>

      <!-- Right Properties Inspector -->
      <div style="width:280px;min-width:280px;background:#1e1e24;padding:14px 16px;display:flex;flex-direction:column;gap:11px;overflow-y:auto">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px">Text & Customization</div>

        <div>
          <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Your Text</label>
          <input type="text" id="wa-text-input" value="${text}" style="width:100%;height:28px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 8px;font-size:12px;font-weight:600;outline:none;box-sizing:border-box" />
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div>
            <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Font</label>
            <select class="form-input" id="wa-font-sel" style="width:100%;padding:3px 5px;font-size:11px">
              <option value="Impact, sans-serif" selected>Impact</option>
              <option value='"Arial Black", sans-serif'>Arial Black</option>
              <option value='"Comic Sans MS", cursive, sans-serif'>Comic Sans</option>
              <option value='"Trebuchet MS", sans-serif'>Trebuchet</option>
              <option value="Georgia, serif">Georgia</option>
              <option value='"Times New Roman", serif'>Times New Roman</option>
              <option value="'Plus Jakarta Sans', sans-serif">Modern Sans</option>
            </select>
          </div>
          <div>
            <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Size (${fontSize}px)</label>
            <input type="range" id="wa-size-slider" min="24" max="120" value="${fontSize}" style="width:100%" />
          </div>
        </div>

        <!-- Text Fill Section (Gradient or Solid Color) -->
        <div style="background:rgba(0,0,0,0.25);border:1px solid rgba(255,255,255,0.07);border-radius:6px;padding:10px;display:flex;flex-direction:column;gap:8px">
          <div style="display:flex;align-items:center;justify-content:space-between">
            <span id="wa-fill-section-title" style="font-size:10.5px;font-weight:600;color:var(--accent,#4f8ef7);text-transform:uppercase;letter-spacing:0.5px">${fillType === 'gradient' ? 'Multi-Point Gradient' : 'Solid Color Fill'}</span>
            <select id="wa-fill-type" style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff;border-radius:3px;font-size:10px;padding:2px 5px;cursor:pointer">
              <option value="gradient" ${fillType === 'gradient' ? 'selected' : ''}>Gradient</option>
              <option value="solid" ${fillType === 'solid' ? 'selected' : ''}>Solid Color</option>
            </select>
          </div>

          <!-- Solid Color Controls -->
          <div id="wa-solid-controls" style="display:${fillType === 'solid' ? 'flex' : 'none'};flex-direction:column;gap:8px">
            <div style="display:flex;align-items:center;justify-content:space-between;background:rgba(255,255,255,0.03);padding:8px 10px;border-radius:4px;border:1px solid rgba(255,255,255,0.08)">
              <div style="display:flex;align-items:center;gap:8px">
                <input type="color" id="wa-solid-color-picker" value="${solidColor}" style="width:28px;height:24px;padding:0;border:1px solid rgba(255,255,255,0.25);border-radius:3px;background:none;cursor:pointer" />
                <span style="font-size:11px;font-weight:600;color:#fff" id="wa-solid-color-hex">${solidColor}</span>
              </div>
              <span style="font-size:10px;color:rgba(255,255,255,0.5)">Pick Fill Color</span>
            </div>
          </div>

          <!-- Multi-Point Gradient Controls -->
          <div id="wa-grad-controls" style="display:${fillType === 'gradient' ? 'flex' : 'none'};flex-direction:column;gap:8px">
            <div>
              <label style="font-size:10px;color:rgba(255,255,255,0.5);display:block;margin-bottom:2px">Preset Palettes</label>
              <select class="form-input" id="wa-preset-sel" style="width:100%;padding:3px 5px;font-size:10.5px">
                <option value="custom">Custom Gradient</option>
                <option value="rainbow-spectrum">🌈 Rainbow Spectrum (7 Colors)</option>
                <option value="rainbow-pastel">☁️ Pastel Rainbow</option>
                <option value="sunset-flame">🌅 Sunset Horizon (5 Colors)</option>
                <option value="cyberpunk-neon">⚡ Cyberpunk Neon (4 Colors)</option>
                <option value="metallic-chrome">✨ Silver Chrome (5 Colors)</option>
                <option value="golden-royal">👑 Golden Royalty (5 Colors)</option>
                <option value="emerald-aurora">🌲 Emerald Aurora (4 Colors)</option>
                <option value="ocean-deep">🌊 Ocean Depths (4 Colors)</option>
                <option value="fire-lava">🔥 Molten Lava (4 Colors)</option>
                <option value="cotton-candy">🍬 Cotton Candy</option>
              </select>
            </div>

            <!-- Gradient Track & Stop Editor -->
            <div>
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                <label style="font-size:10px;color:rgba(255,255,255,0.5)">Stops / Steps (Click bar to add, drag pins)</label>
                <span id="wa-stop-count" style="font-size:10px;color:rgba(255,255,255,0.4)">${gradientStops.length} stops</span>
              </div>
              <div id="wa-grad-track" style="position:relative;width:100%;height:22px;border-radius:4px;border:1px solid rgba(255,255,255,0.2);cursor:crosshair;box-sizing:border-box">
                <!-- Injected stops -->
              </div>
            </div>

            <!-- Selected Stop Edit Bar -->
            <div style="display:flex;flex-direction:column;gap:6px;background:rgba(255,255,255,0.03);padding:6px 8px;border-radius:4px">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:6px">
                  <span style="font-size:10px;color:rgba(255,255,255,0.6)">Stop Color:</span>
                  <input type="color" id="wa-stop-color-picker" value="${gradientStops[0]?.color || '#ff0000'}" style="width:24px;height:20px;padding:0;border:1px solid rgba(255,255,255,0.2);border-radius:3px;background:none;cursor:pointer" />
                </div>
                <button id="wa-del-stop-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.1);color:#e05c5c;padding:2px 6px;border-radius:3px;font-size:10px;cursor:pointer" title="Remove active color stop">Delete</button>
              </div>

              <!-- Step / Position Slider -->
              <div style="display:flex;align-items:center;gap:6px">
                <span style="font-size:10px;color:rgba(255,255,255,0.6);white-space:nowrap">Step:</span>
                <input type="range" id="wa-stop-pos-slider" min="0" max="100" value="${Math.round((gradientStops[0]?.offset || 0) * 100)}" style="flex:1;accent-color:var(--accent,#4f8ef7);cursor:pointer" />
                <span id="wa-stop-pos-val" style="font-size:10px;color:var(--accent,#4f8ef7);min-width:32px;text-align:right">${Math.round((gradientStops[0]?.offset || 0) * 100)}%</span>
              </div>
            </div>

            <!-- Angle Selector -->
            <div>
              <div style="display:flex;justify-content:space-between;margin-bottom:2px">
                <label style="font-size:10px;color:rgba(255,255,255,0.5)">Angle</label>
                <span style="font-size:10px;color:var(--accent)" id="wa-angle-val">${gradientAngle}°</span>
              </div>
              <div style="display:flex;align-items:center;gap:6px">
                <input type="range" id="wa-angle-slider" min="0" max="360" value="${gradientAngle}" style="flex:1" />
                <button class="btn btn-secondary btn-sm" data-angle="0" style="font-size:9px;padding:1px 5px">0°</button>
                <button class="btn btn-secondary btn-sm" data-angle="90" style="font-size:9px;padding:1px 5px">90°</button>
              </div>
            </div>
          </div>
        </div>

        <div>
          <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Warp Shape</label>
          <select class="form-input" id="wa-warp-sel" style="width:100%;padding:3px 5px;font-size:11px">
            <option value="none" ${warpType === 'none' ? 'selected' : ''}>Straight (No Warp)</option>
            <option value="arch-up" ${warpType === 'arch-up' ? 'selected' : ''}>Arch Up</option>
            <option value="arch-down" ${warpType === 'arch-down' ? 'selected' : ''}>Arch Down</option>
            <option value="wave" ${warpType === 'wave' ? 'selected' : ''}>Wave</option>
            <option value="inflate" ${warpType === 'inflate' ? 'selected' : ''}>Inflate / Bulge</option>
            <option value="slant" ${warpType === 'slant' ? 'selected' : ''}>Slant Up</option>
          </select>
        </div>

        <div>
          <div style="display:flex;justify-content:space-between;margin-bottom:3px">
            <label style="font-size:10.5px;color:rgba(255,255,255,0.5)">3D Depth</label>
            <span style="font-size:10.5px;color:var(--accent)" id="wa-depth-val">${depth3D}px</span>
          </div>
          <input type="range" id="wa-depth-slider" min="0" max="24" value="${depth3D}" style="width:100%" />
        </div>

        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary" id="wa-insert-btn" style="width:100%;height:32px;font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px">
            ${iconCheck(13)} <span>Insert WordArt</span>
          </button>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _activeModal = overlay;

  const close = () => {
    overlay.remove();
    _activeModal = null;
  };

  modal.querySelector('#wa-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      window.removeEventListener('keydown', onKey);
      close();
    }
  };
  window.addEventListener('keydown', onKey);

  // ─── Live Update ───

  const updateLivePreview = () => {
    const container = modal.querySelector('#wa-preview-container');
    container.innerHTML = '';
    const canvas = renderWordArtCanvas({
      text: text || 'WordArt',
      templateId: selectedTemplate.id,
      fontFamily,
      fontSize,
      warpType,
      warpAmount,
      depth3D,
      fillType,
      fillColor: solidColor,
      gradientStops,
      gradientAngle,
    });
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '96px';
    canvas.style.objectFit = 'contain';
    container.appendChild(canvas);
  };

  const updateGradientTrackUI = () => {
    const track = modal.querySelector('#wa-grad-track');
    const stopCountEl = modal.querySelector('#wa-stop-count');
    const colorPicker = modal.querySelector('#wa-stop-color-picker');
    const posSlider = modal.querySelector('#wa-stop-pos-slider');
    const posVal = modal.querySelector('#wa-stop-pos-val');
    const delBtn = modal.querySelector('#wa-del-stop-btn');

    track.style.background = stopsToCss(gradientStops, 90);
    stopCountEl.textContent = `${gradientStops.length} stops`;
    track.innerHTML = '';

    if (selectedStopIdx >= gradientStops.length) {
      selectedStopIdx = Math.max(0, gradientStops.length - 1);
    }
    const curStop = gradientStops[selectedStopIdx];
    if (curStop) {
      colorPicker.value = curStop.color.startsWith('#') && curStop.color.length === 7 ? curStop.color : '#ff0000';
      if (posSlider) posSlider.value = Math.round(curStop.offset * 100);
      if (posVal) posVal.textContent = `${Math.round(curStop.offset * 100)}%`;
    }
    delBtn.disabled = gradientStops.length <= 2;
    delBtn.style.opacity = gradientStops.length <= 2 ? '0.4' : '1.0';

    gradientStops.forEach((stop, idx) => {
      const pin = document.createElement('div');
      const isSel = idx === selectedStopIdx;
      pin.style.cssText = `
        position: absolute; top: -3px; left: calc(${stop.offset * 100}% - 5px);
        width: 10px; height: 26px; border-radius: 2px;
        background: ${stop.color};
        border: 2px solid ${isSel ? '#ffffff' : '#000000'};
        box-shadow: 0 0 3px rgba(0,0,0,0.8);
        cursor: grab; z-index: ${isSel ? '10' : '2'};
        box-sizing: border-box;
      `;
      pin.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedStopIdx = idx;
        updateGradientTrackUI();
      });

      // Interactive drag for moving step/stop
      pin.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        selectedStopIdx = idx;
        pin.style.cursor = 'grabbing';
        const rect = track.getBoundingClientRect();

        const onMove = (moveEvt) => {
          const curX = moveEvt.clientX - rect.left;
          const newOffset = Math.max(0, Math.min(1, Number((curX / rect.width).toFixed(3))));
          gradientStops[selectedStopIdx].offset = newOffset;
          gradientStops.sort((a, b) => a.offset - b.offset);
          selectedStopIdx = gradientStops.findIndex(s => s.offset === newOffset);
          const pSel = modal.querySelector('#wa-preset-sel');
          if (pSel) pSel.value = 'custom';
          updateGradientTrackUI();
          updateLivePreview();
        };

        const onUp = () => {
          pin.style.cursor = 'grab';
          window.removeEventListener('mousemove', onMove);
          window.removeEventListener('mouseup', onUp);
        };

        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
      });

      track.appendChild(pin);
    });
  };

  const renderGrid = () => {
    const grid = modal.querySelector('#wa-grid');
    grid.innerHTML = '';

    for (const tpl of WORDART_TEMPLATES) {
      const card = document.createElement('div');
      const isSel = selectedTemplate.id === tpl.id;
      card.className = 'wa-card';
      card.style.cssText = `
        height: 168px; background: linear-gradient(180deg, #17171d 0%, #111115 100%); border-radius: 9px;
        border: 1.5px solid ${isSel ? 'var(--accent, #4f8ef7)' : 'rgba(255,255,255,0.08)'};
        box-shadow: ${isSel ? '0 0 0 1px var(--accent, #4f8ef7), 0 6px 20px rgba(79, 142, 247, 0.22)' : '0 2px 8px rgba(0,0,0,0.3)'};
        display: flex; flex-direction: column; align-items: center; justify-content: space-between;
        padding: 8px 8px 6px; box-sizing: border-box; cursor: pointer; transition: all 0.15s ease;
        overflow: hidden; position: relative;
      `;

      card.addEventListener('mouseenter', () => {
        if (selectedTemplate.id !== tpl.id) {
          card.style.borderColor = 'rgba(255,255,255,0.22)';
          card.style.transform = 'translateY(-2px)';
          card.style.boxShadow = '0 6px 16px rgba(0,0,0,0.45)';
        }
      });
      card.addEventListener('mouseleave', () => {
        if (selectedTemplate.id !== tpl.id) {
          card.style.borderColor = 'rgba(255,255,255,0.08)';
          card.style.transform = 'none';
          card.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
        }
      });

      // Thumbnail preview area
      const previewArea = document.createElement('div');
      previewArea.style.cssText = 'flex:1;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:2px;';

      // Large thumbnail canvas
      const miniCanvas = getTemplateThumbnail(tpl);
      miniCanvas.style.maxWidth = '98%';
      miniCanvas.style.maxHeight = '118px';
      miniCanvas.style.objectFit = 'contain';
      miniCanvas.style.filter = 'drop-shadow(0 4px 10px rgba(0,0,0,0.45))';

      previewArea.appendChild(miniCanvas);
      card.appendChild(previewArea);

      // Card footer with title label and style badge
      const footer = document.createElement('div');
      footer.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;padding:4px 2px 0;border-top:1px solid rgba(255,255,255,0.06);margin-top:3px;flex-shrink:0;';

      const titleLabel = document.createElement('div');
      titleLabel.style.cssText = 'font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.9);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;';
      titleLabel.textContent = tpl.name;
      footer.appendChild(titleLabel);

      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:9px;font-weight:500;padding:1px 5px;border-radius:3px;background:rgba(255,255,255,0.06);color:rgba(255,255,255,0.5);margin-left:6px;text-transform:capitalize;flex-shrink:0;';
      badge.textContent = tpl.warpType !== 'none' ? tpl.warpType.replace('-', ' ') : (tpl.depth3D > 0 ? '3D' : 'Classic');
      footer.appendChild(badge);

      card.appendChild(footer);

      card.addEventListener('click', () => {
        selectedTemplate = tpl;
        warpType = tpl.warpType;
        warpAmount = tpl.warpAmount;
        depth3D = tpl.depth3D;
        fillType = tpl.fillType || 'gradient';
        if (tpl.colors && tpl.colors.length > 0) {
          solidColor = tpl.colors[0];
          const scPicker = modal.querySelector('#wa-solid-color-picker');
          const scHex = modal.querySelector('#wa-solid-color-hex');
          if (scPicker) scPicker.value = solidColor.startsWith('#') && solidColor.length === 7 ? solidColor : '#ffffff';
          if (scHex) scHex.textContent = solidColor;
        }
        gradientAngle = tpl.gradientAngle ?? 0;
        gradientStops = tpl.colors ? normalizeStops(tpl.colors) : normalizeStops(['#ffffff']);
        selectedStopIdx = 0;

        modal.querySelector('#wa-warp-sel').value = warpType;
        modal.querySelector('#wa-depth-slider').value = depth3D;
        modal.querySelector('#wa-depth-val').textContent = `${depth3D}px`;
        modal.querySelector('#wa-angle-slider').value = gradientAngle;
        modal.querySelector('#wa-angle-val').textContent = `${gradientAngle}°`;

        modal.querySelectorAll('.wa-card').forEach(c => {
          c.style.borderColor = 'rgba(255,255,255,0.08)';
          c.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
          c.style.transform = 'none';
        });
        card.style.borderColor = 'var(--accent, #4f8ef7)';
        card.style.boxShadow = '0 0 0 1px var(--accent, #4f8ef7), 0 6px 20px rgba(79, 142, 247, 0.22)';

        updateFillSection();
        updateGradientTrackUI();
        updateLivePreview();
      });

      card.addEventListener('dblclick', () => {
        selectedTemplate = tpl;
        doInsert();
      });

      grid.appendChild(card);
    }
  };

  // ─── Event Handlers ───

  const updateFillSection = () => {
    const isGrad = fillType === 'gradient';
    modal.querySelector('#wa-fill-type').value = fillType;
    modal.querySelector('#wa-grad-controls').style.display = isGrad ? 'flex' : 'none';
    modal.querySelector('#wa-solid-controls').style.display = isGrad ? 'none' : 'flex';
    modal.querySelector('#wa-fill-section-title').textContent = isGrad ? 'Multi-Point Gradient' : 'Solid Color Fill';
  };

  const textInput = modal.querySelector('#wa-text-input');
  textInput.addEventListener('input', () => {
    text = textInput.value;
    updateLivePreview();
  });

  const fontSel = modal.querySelector('#wa-font-sel');
  fontSel.addEventListener('change', () => {
    fontFamily = fontSel.value;
    updateLivePreview();
  });

  const sizeSlider = modal.querySelector('#wa-size-slider');
  sizeSlider.addEventListener('input', () => {
    fontSize = parseInt(sizeSlider.value, 10);
    modal.querySelector('#wa-size-slider').previousElementSibling.textContent = `Size (${fontSize}px)`;
    updateLivePreview();
  });

  const warpSel = modal.querySelector('#wa-warp-sel');
  warpSel.addEventListener('change', () => {
    warpType = warpSel.value;
    warpAmount = warpType === 'none' ? 0 : 20;
    updateLivePreview();
  });

  const depthSlider = modal.querySelector('#wa-depth-slider');
  depthSlider.addEventListener('input', () => {
    depth3D = parseInt(depthSlider.value, 10);
    modal.querySelector('#wa-depth-val').textContent = `${depth3D}px`;
    updateLivePreview();
  });

  // Fill Controls (Gradient vs Solid Color)
  const fillTypeSel = modal.querySelector('#wa-fill-type');
  fillTypeSel.addEventListener('change', () => {
    fillType = fillTypeSel.value;
    updateFillSection();
    updateLivePreview();
  });

  const solidColorPicker = modal.querySelector('#wa-solid-color-picker');
  solidColorPicker.addEventListener('input', () => {
    solidColor = solidColorPicker.value;
    modal.querySelector('#wa-solid-color-hex').textContent = solidColor;
    updateLivePreview();
  });

  const presetSel = modal.querySelector('#wa-preset-sel');
  presetSel.addEventListener('change', () => {
    const pId = presetSel.value;
    if (GRADIENT_PRESETS[pId]) {
      gradientStops = normalizeStops(GRADIENT_PRESETS[pId].stops);
      selectedStopIdx = 0;
      updateGradientTrackUI();
      updateLivePreview();
    }
  });

  const gradTrack = modal.querySelector('#wa-grad-track');
  gradTrack.addEventListener('click', (e) => {
    const rect = gradTrack.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const offset = Math.max(0, Math.min(1, Number((clickX / rect.width).toFixed(3))));
    const sampledColor = sampleGradient(gradientStops, offset);
    gradientStops.push({ offset, color: sampledColor });
    gradientStops = normalizeStops(gradientStops);
    selectedStopIdx = gradientStops.findIndex(s => s.offset === offset);
    presetSel.value = 'custom';
    updateGradientTrackUI();
    updateLivePreview();
  });

  const stopColorPicker = modal.querySelector('#wa-stop-color-picker');
  stopColorPicker.addEventListener('input', () => {
    if (gradientStops[selectedStopIdx]) {
      gradientStops[selectedStopIdx].color = stopColorPicker.value;
      presetSel.value = 'custom';
      updateGradientTrackUI();
      updateLivePreview();
    }
  });

  // Step position slider that moves the active stop
  const stopPosSlider = modal.querySelector('#wa-stop-pos-slider');
  stopPosSlider.addEventListener('input', () => {
    if (gradientStops[selectedStopIdx]) {
      const newOffset = Math.max(0, Math.min(1, parseInt(stopPosSlider.value, 10) / 100));
      gradientStops[selectedStopIdx].offset = newOffset;
      gradientStops.sort((a, b) => a.offset - b.offset);
      selectedStopIdx = gradientStops.findIndex(s => s.offset === newOffset);
      presetSel.value = 'custom';
      modal.querySelector('#wa-stop-pos-val').textContent = `${Math.round(newOffset * 100)}%`;
      updateGradientTrackUI();
      updateLivePreview();
    }
  });

  const delStopBtn = modal.querySelector('#wa-del-stop-btn');
  delStopBtn.addEventListener('click', () => {
    if (gradientStops.length > 2) {
      gradientStops.splice(selectedStopIdx, 1);
      selectedStopIdx = Math.max(0, selectedStopIdx - 1);
      presetSel.value = 'custom';
      updateGradientTrackUI();
      updateLivePreview();
    }
  });

  const angleSlider = modal.querySelector('#wa-angle-slider');
  angleSlider.addEventListener('input', () => {
    gradientAngle = parseInt(angleSlider.value, 10);
    modal.querySelector('#wa-angle-val').textContent = `${gradientAngle}°`;
    updateLivePreview();
  });

  modal.querySelectorAll('button[data-angle]').forEach(btn => {
    btn.addEventListener('click', () => {
      gradientAngle = parseInt(btn.dataset.angle, 10);
      angleSlider.value = gradientAngle;
      modal.querySelector('#wa-angle-val').textContent = `${gradientAngle}°`;
      updateLivePreview();
    });
  });

  const doInsert = () => {
    const finalCanvas = renderWordArtCanvas({
      text: text || 'WordArt',
      templateId: selectedTemplate.id,
      fontFamily,
      fontSize,
      warpType,
      warpAmount,
      depth3D,
      fillType,
      fillColor: solidColor,
      gradientStops,
      gradientAngle,
    });
    session.insertWordArt(finalCanvas, text || 'WordArt');
    if (onInserted) onInserted(selectedTemplate);
    close();
  };

  modal.querySelector('#wa-insert-btn').addEventListener('click', doInsert);

  renderGrid();
  updateFillSection();
  updateGradientTrackUI();
  updateLivePreview();
}

// Global hook
if (typeof window !== 'undefined') {
  window._showWordArtPanel = showWordArtPanel;
}
