// ─────────────────────────────────────────────────────────────────────────────
// ai/backgroundRemoval.js  —  Local WebGL AI Background Removal (u2netp.onnx)
//                             Runs 100% offline via bundled ONNX model & WebGL
// ─────────────────────────────────────────────────────────────────────────────

let _ortSession = null;

async function ensureOrtLoaded() {
  if (window.ort) return window.ort;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = '../node_modules/onnxruntime-web/dist/ort.all.min.js';
    script.onload = () => resolve(window.ort);
    script.onerror = (e) => reject(new Error('Failed to load ONNX runtime script: ' + e));
    document.head.appendChild(script);
  });
}

function showToast(message) {
  let toast = document.getElementById('ai-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'ai-toast';
    toast.style.cssText = `
      position: fixed; bottom: 24px; right: 24px; z-index: 9999;
      background: var(--panel-bg-2); border: 1px solid var(--panel-border);
      border-radius: var(--radius-lg); padding: 12px 18px;
      color: var(--text); font-size: 12px; display: flex; align-items: center; gap: 10px;
      box-shadow: var(--shadow); backdrop-filter: blur(8px);
      animation: slide-up 160ms ease;
    `;
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="loading" style="font-size:14px">✨</span> <span>${message}</span>`;
  toast.style.display = 'flex';
  return toast;
}

function hideToast() {
  const toast = document.getElementById('ai-toast');
  if (toast) toast.style.display = 'none';
}

/** Get or initialize the cached ONNX InferenceSession */
async function getInferenceSession() {
  if (_ortSession) return _ortSession;

  const ort = await ensureOrtLoaded();
  if (!ort) throw new Error('ONNX Runtime Web is not loaded.');

  const res = await window.api.loadModel();
  if (!res.ok) throw new Error(res.error || 'Failed to load local model weights');

  // Try WebGL execution provider first, fallback to wasm/cpu
  try {
    _ortSession = await ort.InferenceSession.create(res.buffer, {
      executionProviders: ['webgl', 'wasm'],
      graphOptimizationLevel: 'all',
    });
  } catch (err) {
    console.warn('WebGL inference provider failed, falling back to WASM:', err);
    _ortSession = await ort.InferenceSession.create(res.buffer, {
      executionProviders: ['wasm'],
    });
  }

  return _ortSession;
}

/**
 * Remove background from the active layer using local WebGL AI matting.
 * @param {import('../store/session.js').EditorSession} session
 */
export async function removeBackground(session) {
  const layer = session.activeLayer;
  if (!layer || layer.isGroup) {
    alert('Please select a raster image layer first.');
    return;
  }

  const toast = showToast('Removing background using local WebGL GPU…');

  try {
    const sessionOrt = await getInferenceSession();
    const ort = window.ort;

    const srcCanvas = layer.canvas;
    const origW = layer.pixelW;
    const origH = layer.pixelH;

    // 1. Prepare 320x320 input canvas
    const W = 320, H = 320;
    const scaleCanvas = document.createElement('canvas');
    scaleCanvas.width = W;
    scaleCanvas.height = H;
    const sCtx = scaleCanvas.getContext('2d', { willReadFrequently: true });
    sCtx.drawImage(srcCanvas, 0, 0, W, H);
    const imgData = sCtx.getImageData(0, 0, W, H).data;

    // 2. Preprocess into ImageNet normalized Float32 NCHW Tensor
    const inputData = new Float32Array(1 * 3 * W * H);
    const mean = [0.485, 0.456, 0.406];
    const std  = [0.229, 0.224, 0.225];

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const srcIdx = (y * W + x) * 4;
        const tensorIdx = y * W + x;

        const r = imgData[srcIdx]     / 255.0;
        const g = imgData[srcIdx + 1] / 255.0;
        const b = imgData[srcIdx + 2] / 255.0;

        inputData[0 * W * H + tensorIdx] = (r - mean[0]) / std[0];
        inputData[1 * W * H + tensorIdx] = (g - mean[1]) / std[1];
        inputData[2 * W * H + tensorIdx] = (b - mean[2]) / std[2];
      }
    }

    const inputTensor = new ort.Tensor('float32', inputData, [1, 3, W, H]);
    const inputName = sessionOrt.inputNames[0] || 'input.1';
    const outputName = sessionOrt.outputNames[0] || '1959';

    // 3. Run WebGL forward pass
    const feeds = {};
    feeds[inputName] = inputTensor;
    const results = await sessionOrt.run(feeds);
    const maskData = results[outputName].data;

    // 4. Normalize mask output
    let minVal = Infinity, maxVal = -Infinity;
    for (let i = 0; i < maskData.length; i++) {
      if (maskData[i] < minVal) minVal = maskData[i];
      if (maskData[i] > maxVal) maxVal = maskData[i];
    }
    const range = maxVal - minVal || 1.0;

    // 5. Construct 320x320 alpha mask image
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = W;
    maskCanvas.height = H;
    const mCtx = maskCanvas.getContext('2d');
    const mImgData = mCtx.createImageData(W, H);

    for (let i = 0; i < maskData.length; i++) {
      const norm = (maskData[i] - minVal) / range;
      const alpha = Math.round(Math.max(0, Math.min(1, norm)) * 255);
      mImgData.data[i * 4 + 0] = 255;
      mImgData.data[i * 4 + 1] = 255;
      mImgData.data[i * 4 + 2] = 255;
      mImgData.data[i * 4 + 3] = alpha;
    }
    mCtx.putImageData(mImgData, 0, 0);

    // 6. Commit to layer with Undo/Redo support
    session.beginEdit('Remove Background');
    const ctx = layer.ctx;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskCanvas, 0, 0, origW, origH);
    ctx.restore();

    layer.markChanged();
    session.endEdit();
    session._emit('canvas-dirty');

    showToast('Background removed successfully! (Undo: Ctrl+Z)');
    setTimeout(hideToast, 2000);
  } catch (err) {
    console.error('Background removal failed:', err);
    alert('AI Background Removal error: ' + err.message);
    hideToast();
  }
}
