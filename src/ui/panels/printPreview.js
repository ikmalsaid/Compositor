// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/printPreview.js  —  Interactive Print Preview modal with Paper Sizes,
//                               Scaling, Margins, PDF Export, and Direct Print
// ─────────────────────────────────────────────────────────────────────────────

import { blendModeToCompositeOp } from '../../store/document.js';
import { iconPrinter, iconPortrait, iconLandscape, iconPdf, iconDownload } from '../icons.js';

export const PAPER_SIZES = [
  { id: 'A4',     label: 'A4 (210 × 297 mm)',       wMm: 210,   hMm: 297,   wIn: 8.27,  hIn: 11.69 },
  { id: 'Letter', label: 'US Letter (8.5 × 11 in)', wMm: 215.9, hMm: 279.4, wIn: 8.5,   hIn: 11.0  },
  { id: 'Legal',  label: 'US Legal (8.5 × 14 in)',  wMm: 215.9, hMm: 355.6, wIn: 8.5,   hIn: 14.0  },
  { id: 'Photo4x6', label: 'Photo 4 × 6 in',        wMm: 101.6, hMm: 152.4, wIn: 4.0,   hIn: 6.0   },
  { id: 'Photo5x7', label: 'Photo 5 × 7 in',        wMm: 127.0, hMm: 177.8, wIn: 5.0,   hIn: 7.0   },
  { id: 'Photo8x10', label: 'Photo 8 × 10 in',      wMm: 203.2, hMm: 254.0, wIn: 8.0,   hIn: 10.0  },
  { id: 'A3',     label: 'A3 (297 × 420 mm)',       wMm: 297,   hMm: 420,   wIn: 11.69, hIn: 16.54 },
  { id: 'Tabloid', label: 'Tabloid (11 × 17 in)',   wMm: 279.4, hMm: 431.8, wIn: 11.0,  hIn: 17.0  },
];

export const MARGIN_PRESETS = [
  { id: 'normal', label: 'Normal (0.5 in / 12.7 mm)', in: 0.5 },
  { id: 'narrow', label: 'Narrow (0.25 in / 6.35 mm)', in: 0.25 },
  { id: 'wide',   label: 'Wide (1.0 in / 25.4 mm)', in: 1.0 },
  { id: 'none',   label: 'None (Borderless / 0 in)', in: 0.0 },
];

/**
 * Render complete document onto a flat PNG data URL for printing
 */
export function renderDocumentToDataURL(session, canvasView = null) {
  const doc = session.document;
  if (!doc) return null;

  const off = document.createElement('canvas');
  off.width = doc.width;
  off.height = doc.height;
  const ctx = off.getContext('2d', { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  // Draw layers bottom to top
  for (const layer of doc.layers.filter(l => l.isVisible && !l.isGroup && (l.canvas || l.bitmap))) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, layer.opacity));
    ctx.globalCompositeOperation = blendModeToCompositeOp(layer.blendMode);

    const t = layer.transform;
    const cx = t.x + t.w / 2;
    const cy = t.y + t.h / 2;
    ctx.translate(cx, cy);
    if (t.rotation) ctx.rotate(t.rotation * Math.PI / 180);
    if (t.flipX) ctx.scale(-1, 1);
    if (t.flipY) ctx.scale(1, -1);

    if (layer.shapeMask && layer.shapeMask !== 'none' && canvasView?._applyShapePath) {
      ctx.beginPath();
      canvasView._applyShapePath(ctx, layer.shapeMask, -t.w / 2, -t.h / 2, t.w, t.h, layer.shapeCornerRadius || 12);
      ctx.clip();
    }

    ctx.drawImage(layer.canvas || layer.bitmap, -t.w / 2, -t.h / 2, t.w, t.h);
    ctx.restore();
  }

  return off.toDataURL('image/png');
}

export function showPrintPreviewPanel(session, canvasView) {
  const doc = session.document;
  if (!doc) return;

  const imgDataUrl = renderDocumentToDataURL(session, canvasView);
  if (!imgDataUrl) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay print-preview-overlay';

  // Default settings
  let selectedPaper = PAPER_SIZES[0]; // A4
  let orientation = (doc.width > doc.height) ? 'landscape' : 'portrait'; // auto-select
  let scaling = 'fit'; // 'fit' | 'fill' | 'original'
  let marginPreset = MARGIN_PRESETS[0]; // Normal (0.5 in)
  let showGuides = true;

  overlay.innerHTML = `
    <div class="modal print-modal" style="min-width:820px;max-width:960px;width:90vw;height:85vh;display:flex;flex-direction:column">
      <div class="modal-header" style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:8px">
          <span style="display:inline-flex;align-items:center;color:var(--accent,#4f8ef7)">${iconPrinter(18)}</span>
          <span style="font-weight:600">Print & Print Preview</span>
        </div>
        <span style="font-size:11px;color:var(--text-muted)">${doc.width} × ${doc.height} px · ${doc.resolution || 72} ppi</span>
      </div>

      <div class="modal-body" style="display:grid;grid-template-columns:1fr 310px;gap:20px;padding:16px 20px;flex:1;min-height:0;overflow:hidden">
        <!-- Left Pane: Interactive Live Sheet Mockup -->
        <div class="print-preview-stage" style="display:flex;flex-direction:column;align-items:center;justify-content:center;background:#1a1a1a;border:1px solid var(--panel-border);border-radius:var(--radius);position:relative;overflow:hidden;padding:24px">
          <div id="print-paper-mockup" style="background:#ffffff;box-shadow:0 8px 32px rgba(0,0,0,0.6);position:relative;display:flex;align-items:center;justify-content:center;transition:all 200ms cubic-bezier(0.16,1,0.3,1);overflow:hidden">
            <!-- Margin Guideline Box -->
            <div id="print-margin-box" style="position:absolute;border:1px dashed #4f8ef7;pointer-events:none;z-index:2;box-sizing:border-box"></div>
            <!-- Printed Document Image -->
            <img id="print-preview-img" src="${imgDataUrl}" style="position:relative;z-index:1;max-width:100%;max-height:100%;display:block;transition:all 150ms" />
          </div>

          <!-- Bottom status tag -->
          <div id="print-stage-status" style="position:absolute;bottom:10px;font-size:11px;color:var(--text-muted);background:rgba(0,0,0,0.6);padding:2px 10px;border-radius:12px"></div>
        </div>

        <!-- Right Pane: Print Settings Controls -->
        <div class="print-settings-pane" style="display:flex;flex-direction:column;gap:12px;overflow-y:auto;padding-right:4px">
          <div class="form-row">
            <label class="form-label">Paper Size</label>
            <select class="form-input" id="print-paper-select" style="cursor:pointer">
              ${PAPER_SIZES.map((p, i) => `<option value="${i}">${p.label}</option>`).join('')}
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">Orientation</label>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%">
              <button type="button" class="btn btn-sm print-orient-btn ${orientation === 'portrait' ? 'active' : ''}" data-orient="portrait" style="display:inline-flex;align-items:center;justify-content:center;gap:6px">
                ${iconPortrait(14)} Portrait
              </button>
              <button type="button" class="btn btn-sm print-orient-btn ${orientation === 'landscape' ? 'active' : ''}" data-orient="landscape" style="display:inline-flex;align-items:center;justify-content:center;gap:6px">
                ${iconLandscape(14)} Landscape
              </button>
            </div>
          </div>

          <div class="form-row">
            <label class="form-label">Scale & Fit</label>
            <select class="form-input" id="print-scale-select" style="cursor:pointer">
              <option value="fit" selected>Scale to Fit (Maintain Aspect)</option>
              <option value="fill">Scale to Fill (Bleed to Margins)</option>
              <option value="original">100% Original Size (1:1)</option>
            </select>
          </div>

          <div class="form-row">
            <label class="form-label">Margins</label>
            <select class="form-input" id="print-margin-select" style="cursor:pointer">
              ${MARGIN_PRESETS.map((m, i) => `<option value="${i}">${m.label}</option>`).join('')}
            </select>
          </div>

          <div class="form-row" style="margin-top:4px">
            <label style="display:flex;align-items:center;gap:6px;cursor:pointer">
              <input type="checkbox" id="print-guides-cb" checked />
              <span class="inspector-label" style="font-size:12px">Show margin guidelines in preview</span>
            </label>
          </div>

          <div style="height:1px;background:var(--panel-border);margin:8px 0;"></div>

          <div class="print-details-card" style="background:rgba(255,255,255,0.03);border:1px solid var(--panel-border);border-radius:4px;padding:10px;font-size:11px;display:flex;flex-direction:column;gap:4px">
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--text-muted)">Sheet Dimensions:</span>
              <span id="print-sheet-dim" class="mono" style="font-weight:600">210 × 297 mm</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--text-muted)">Printable Area:</span>
              <span id="print-printable-dim" class="mono">184.6 × 271.6 mm</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="color:var(--text-muted)">Doc Resolution:</span>
              <span class="mono">${doc.resolution || 72} PPI</span>
            </div>
          </div>
        </div>
      </div>

      <div class="modal-footer" style="display:flex;align-items:center;justify-content:space-between;flex-shrink:0;padding:12px 20px">
        <button class="btn btn-secondary" id="print-cancel">Cancel</button>
        <div style="display:flex;gap:8px">
          <button class="btn btn-secondary" id="print-to-pdf" style="display:inline-flex;align-items:center;gap:6px">
            ${iconDownload(15)} Export as PDF
          </button>
          <button class="btn btn-primary" id="print-do-print" style="display:inline-flex;align-items:center;gap:6px">
            ${iconPrinter(15)} Print...
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  const paperSelect  = overlay.querySelector('#print-paper-select');
  const orientBtns   = overlay.querySelectorAll('.print-orient-btn');
  const scaleSelect  = overlay.querySelector('#print-scale-select');
  const marginSelect = overlay.querySelector('#print-margin-select');
  const guidesCb     = overlay.querySelector('#print-guides-cb');

  const paperMockup  = overlay.querySelector('#print-paper-mockup');
  const marginBox    = overlay.querySelector('#print-margin-box');
  const previewImg   = overlay.querySelector('#print-preview-img');
  const stageStatus  = overlay.querySelector('#print-stage-status');

  const sheetDimEl   = overlay.querySelector('#print-sheet-dim');
  const printableDimEl = overlay.querySelector('#print-printable-dim');

  const updateMockup = () => {
    const isLandscape = orientation === 'landscape';
    const paperW_In = isLandscape ? selectedPaper.hIn : selectedPaper.wIn;
    const paperH_In = isLandscape ? selectedPaper.wIn : selectedPaper.hIn;
    const paperW_Mm = isLandscape ? selectedPaper.hMm : selectedPaper.wMm;
    const paperH_Mm = isLandscape ? selectedPaper.wMm : selectedPaper.hMm;

    sheetDimEl.textContent = `${paperW_Mm.toFixed(1)} × ${paperH_Mm.toFixed(1)} mm (${paperW_In.toFixed(2)} × ${paperH_In.toFixed(2)} in)`;

    const marginIn = marginPreset.in;
    const printableW_In = Math.max(0.1, paperW_In - 2 * marginIn);
    const printableH_In = Math.max(0.1, paperH_In - 2 * marginIn);
    const printableW_Mm = printableW_In * 25.4;
    const printableH_Mm = printableH_In * 25.4;

    printableDimEl.textContent = `${printableW_Mm.toFixed(1)} × ${printableH_Mm.toFixed(1)} mm`;

    // Calculate stage viewport scaling
    const stage = overlay.querySelector('.print-preview-stage');
    const maxStageW = (stage.clientWidth || 480) - 64;
    const maxStageH = (stage.clientHeight || 420) - 64;

    const paperAspect = paperW_In / paperH_In;
    let mockW, mockH;

    if (paperAspect >= (maxStageW / maxStageH)) {
      mockW = maxStageW;
      mockH = mockW / paperAspect;
    } else {
      mockH = maxStageH;
      mockW = mockH * paperAspect;
    }

    paperMockup.style.width = `${Math.round(mockW)}px`;
    paperMockup.style.height = `${Math.round(mockH)}px`;

    // Position margin guide box inside sheet mockup
    const marginRatioX = marginIn / paperW_In;
    const marginRatioY = marginIn / paperH_In;

    const marginBoxLeft = mockW * marginRatioX;
    const marginBoxTop  = mockH * marginRatioY;
    const marginBoxW    = mockW * (1 - 2 * marginRatioX);
    const marginBoxH    = mockH * (1 - 2 * marginRatioY);

    marginBox.style.left = `${Math.round(marginBoxLeft)}px`;
    marginBox.style.top = `${Math.round(marginBoxTop)}px`;
    marginBox.style.width = `${Math.round(marginBoxW)}px`;
    marginBox.style.height = `${Math.round(marginBoxH)}px`;
    marginBox.style.display = showGuides ? 'block' : 'none';

    // Position and scale image inside printable region
    const docAspect = doc.width / doc.height;
    const pAspect = marginBoxW / marginBoxH;

    if (scaling === 'fit') {
      previewImg.style.objectFit = 'contain';
      let imgW, imgH;
      if (docAspect >= pAspect) {
        imgW = marginBoxW;
        imgH = marginBoxW / docAspect;
      } else {
        imgH = marginBoxH;
        imgW = marginBoxH * docAspect;
      }
      previewImg.style.width = `${Math.round(imgW)}px`;
      previewImg.style.height = `${Math.round(imgH)}px`;
    } else if (scaling === 'fill') {
      previewImg.style.objectFit = 'cover';
      previewImg.style.width = `${Math.round(marginBoxW)}px`;
      previewImg.style.height = `${Math.round(marginBoxH)}px`;
    } else {
      // 1:1 original size @ 72/300 ppi
      const ppi = doc.resolution || 72;
      const screenPpi = 96; // typical display ppi
      const docW_In = doc.width / ppi;
      const docH_In = doc.height / ppi;
      const pxPerIn = mockW / paperW_In;
      const imgW = docW_In * pxPerIn;
      const imgH = docH_In * pxPerIn;
      previewImg.style.objectFit = 'contain';
      previewImg.style.width = `${Math.round(imgW)}px`;
      previewImg.style.height = `${Math.round(imgH)}px`;
    }

    stageStatus.textContent = `${selectedPaper.id} · ${isLandscape ? 'Landscape' : 'Portrait'} · Scale: ${scaling.toUpperCase()}`;
  };

  paperSelect.addEventListener('change', () => {
    selectedPaper = PAPER_SIZES[+paperSelect.value] || PAPER_SIZES[0];
    updateMockup();
  });

  orientBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      orientBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      orientation = btn.dataset.orient;
      updateMockup();
    });
  });

  scaleSelect.addEventListener('change', () => {
    scaling = scaleSelect.value;
    updateMockup();
  });

  marginSelect.addEventListener('change', () => {
    marginPreset = MARGIN_PRESETS[+marginSelect.value] || MARGIN_PRESETS[0];
    updateMockup();
  });

  guidesCb.addEventListener('change', () => {
    showGuides = guidesCb.checked;
    updateMockup();
  });

  // Initial layout calculation
  requestAnimationFrame(() => updateMockup());

  const close = () => overlay.remove();

  overlay.querySelector('#print-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  // Print Action
  overlay.querySelector('#print-do-print').addEventListener('click', async () => {
    const isLandscape = orientation === 'landscape';
    const pageSize = selectedPaper.id.startsWith('Photo') ? selectedPaper.id : selectedPaper.id;
    if (window.api?.printDocument) {
      await window.api.printDocument({
        dataUrl: imgDataUrl,
        landscape: isLandscape,
        pageSize: selectedPaper.id,
      });
    } else {
      window.print();
    }
    close();
  });

  // Export PDF Action
  overlay.querySelector('#print-to-pdf').addEventListener('click', async () => {
    const isLandscape = orientation === 'landscape';
    if (window.api?.printToPdf) {
      const res = await window.api.printToPdf({
        dataUrl: imgDataUrl,
        landscape: isLandscape,
        pageSize: selectedPaper.id,
        defaultPath: (doc.name || 'Untitled') + '.pdf',
      });
      if (res?.ok) {
        close();
      }
    } else {
      window.print();
      close();
    }
  });
}
