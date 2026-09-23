// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/jpegExport.js  —  JPEG Export sheet (mirrors JPEGExportSheet.swift)
// ─────────────────────────────────────────────────────────────────────────────

export async function showJpegExportPanel(session, canvasView) {
  const doc = session.document;
  if (!doc) return;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  overlay.innerHTML = `
    <div class="modal" style="min-width:340px">
      <div class="modal-header">Export as JPEG</div>
      <div class="modal-body">
        <div class="form-row">
          <label class="form-label">Quality</label>
          <input type="range" id="je-slider" min="1" max="100" value="90" style="flex:1;accent-color:var(--accent)" />
          <input type="number" id="je-num" value="90" min="1" max="100"
            style="width:48px;background:var(--input-bg);border:1px solid var(--input-border);
                   color:var(--text);border-radius:4px;padding:3px 6px;font-family:inherit;font-size:11px;text-align:right" />
          <span style="color:var(--text-muted);font-size:11px">%</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted)" id="je-hint">Estimated size: calculating…</div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secondary" id="je-cancel">Cancel</button>
        <button class="btn btn-primary"   id="je-export">Export…</button>
      </div>
    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  const slider = overlay.querySelector('#je-slider');
  const num    = overlay.querySelector('#je-num');
  const hint   = overlay.querySelector('#je-hint');

  const updateHint = () => {
    const q = parseInt(slider.value) / 100;
    // Rough estimate: base JPEG size scales roughly with quality
    const rawBytes = doc.width * doc.height * 3;
    const factor = 0.05 + q * 0.25;
    const est = Math.round(rawBytes * factor / 1024);
    hint.textContent = `Estimated size: ~${est.toLocaleString()} KB`;
  };

  slider.addEventListener('input', () => { num.value = slider.value; updateHint(); });
  num.addEventListener('change', () => {
    const v = Math.max(1, Math.min(100, parseInt(num.value) || 90));
    num.value = slider.value = v;
    updateHint();
  });
  updateHint();

  const close = () => overlay.remove();
  overlay.querySelector('#je-cancel').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });

  overlay.querySelector('#je-export').addEventListener('click', async () => {
    const quality = parseInt(slider.value) / 100;
    const name = session.projectURL
      ? session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '')
      : 'Untitled';
    const filePath = await window.api.saveExportDialog(name, 'jpg');
    if (!filePath) return;
    close();

    const rgba = canvasView.getDocumentRGBA();
    if (!rgba) return;

    // Convert Uint8ClampedArray to base64
    const b64 = uint8ToBase64(rgba.data);
    const res = await window.api.exportJpeg({ filePath, b64, width: rgba.width, height: rgba.height, quality });
    if (!res.ok) console.error('Export failed:', res.error);
  });
}

export async function showPngExportPanel(session, canvasView) {
  const doc = session.document;
  if (!doc) return;
  const name = session.projectURL
    ? session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '')
    : 'Untitled';
  const filePath = await window.api.saveExportDialog(name, 'png');
  if (!filePath) return;

  const rgba = canvasView.getDocumentRGBA();
  if (!rgba) return;
  const b64 = uint8ToBase64(rgba.data);
  const res = await window.api.exportPng({ filePath, b64, width: rgba.width, height: rgba.height });
  if (!res.ok) console.error('Export failed:', res.error);
}

function uint8ToBase64(data) {
  let bin = '';
  const len = data.length;
  for (let i = 0; i < len; i++) bin += String.fromCharCode(data[i]);
  return btoa(bin);
}
