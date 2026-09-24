// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/adjustments.js  —  Levels, Hue/Saturation, Exposure, Filters
// ─────────────────────────────────────────────────────────────────────────────

/** Create a modal wrapper and return root elements */
function createModal(title, onCommit, onCancel) {
  const root = document.getElementById('modal-root');
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.minWidth = '360px';

  const header = document.createElement('div');
  header.className = 'modal-header';
  header.textContent = title;

  const body = document.createElement('div');
  body.className = 'modal-body';

  const footer = document.createElement('div');
  footer.className = 'modal-footer';

  const btnCancel = document.createElement('button');
  btnCancel.className = 'btn btn-secondary';
  btnCancel.textContent = 'Cancel';

  const btnOk = document.createElement('button');
  btnOk.className = 'btn btn-primary';
  btnOk.textContent = 'Apply';

  footer.appendChild(btnCancel);
  footer.appendChild(btnOk);

  modal.appendChild(header);
  modal.appendChild(body);
  modal.appendChild(footer);
  overlay.appendChild(modal);
  root.appendChild(overlay);

  const close = (committed) => {
    overlay.remove();
    if (committed) onCommit?.();
    else onCancel?.();
  };

  btnCancel.addEventListener('click', () => close(false));
  btnOk.addEventListener('click', () => close(true));

  overlay.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(false); }
    if (e.key === 'Enter')  { e.stopPropagation(); close(true); }
  });

  return { body, overlay, close };
}

// ─── Levels Adjustment ───────────────────────────────────────────────────────

export function showLevelsPanel(session) {
  const layer = session.activeLayer;
  if (!layer || layer.isGroup) return;

  const origCanvas = document.createElement('canvas');
  origCanvas.width = layer.pixelW;
  origCanvas.height = layer.pixelH;
  const octx = origCanvas.getContext('2d', { willReadFrequently: true });
  octx.drawImage(layer.canvas, 0, 0);

  let inBlack = 0, gamma = 1.0, inWhite = 255, outBlack = 0, outWhite = 255;

  const apply = () => {
    const ctx = layer.ctx;
    const imgData = octx.getImageData(0, 0, layer.pixelW, layer.pixelH);
    const d = imgData.data;
    const len = d.length;

    // Precalculate LUT for 0..255
    const lut = new Uint8Array(256);
    const rangeIn = Math.max(1, inWhite - inBlack);
    const rangeOut = outWhite - outBlack;
    const invGamma = 1 / gamma;

    for (let i = 0; i < 256; i++) {
      let v = Math.max(0, Math.min(1, (i - inBlack) / rangeIn));
      v = Math.pow(v, invGamma);
      lut[i] = Math.max(0, Math.min(255, Math.round(outBlack + v * rangeOut)));
    }

    for (let i = 0; i < len; i += 4) {
      d[i]     = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }

    ctx.putImageData(imgData, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  };

  const { body } = createModal('Levels', () => {
    session.beginEdit('Levels');
    apply();
    session.endEdit();
  }, () => {
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
    ctx.drawImage(origCanvas, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  });

  const addSlider = (label, min, max, val, step, onVal) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
      <span class="form-label">${label}</span>
      <input type="range" class="opacity-slider" style="flex:1" min="${min}" max="${max}" value="${val}" step="${step}">
      <span class="form-hint" style="width:36px;text-align:right">${val}</span>
    `;
    const slider = row.querySelector('input');
    const valLbl = row.querySelector('.form-hint');
    slider.addEventListener('input', () => {
      valLbl.textContent = slider.value;
      onVal(parseFloat(slider.value));
      apply();
    });
    body.appendChild(row);
  };

  addSlider('Input Black', 0, 254, inBlack, 1, v => inBlack = v);
  addSlider('Midtones (γ)', 0.1, 4.0, gamma, 0.05, v => gamma = v);
  addSlider('Input White', 1, 255, inWhite, 1, v => inWhite = v);
  addSlider('Output Black', 0, 255, outBlack, 1, v => outBlack = v);
  addSlider('Output White', 0, 255, outWhite, 1, v => outWhite = v);
}

// ─── Hue / Saturation ─────────────────────────────────────────────────────────

export function showHueSatPanel(session) {
  const layer = session.activeLayer;
  if (!layer || layer.isGroup) return;

  const origCanvas = document.createElement('canvas');
  origCanvas.width = layer.pixelW;
  origCanvas.height = layer.pixelH;
  const octx = origCanvas.getContext('2d', { willReadFrequently: true });
  octx.drawImage(layer.canvas, 0, 0);

  let hueShift = 0, satShift = 0, lightShift = 0;

  const rgbToHsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  const hslToRgb = (h, s, l) => {
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  const apply = () => {
    const ctx = layer.ctx;
    const imgData = octx.getImageData(0, 0, layer.pixelW, layer.pixelH);
    const d = imgData.data;
    const len = d.length;

    const hDelta = hueShift / 360;
    const sDelta = satShift / 100;
    const lDelta = lightShift / 100;

    for (let i = 0; i < len; i += 4) {
      let [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      h = (h + hDelta + 1) % 1;
      s = Math.max(0, Math.min(1, s * (1 + sDelta)));
      l = Math.max(0, Math.min(1, l + lDelta));
      const [nr, ng, nb] = hslToRgb(h, s, l);
      d[i]     = nr;
      d[i + 1] = ng;
      d[i + 2] = nb;
    }

    ctx.putImageData(imgData, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  };

  const { body } = createModal('Hue / Saturation', () => {
    session.beginEdit('Hue / Saturation');
    apply();
    session.endEdit();
  }, () => {
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
    ctx.drawImage(origCanvas, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  });

  const addSlider = (label, min, max, val, step, onVal) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
      <span class="form-label">${label}</span>
      <input type="range" class="opacity-slider" style="flex:1" min="${min}" max="${max}" value="${val}" step="${step}">
      <span class="form-hint" style="width:36px;text-align:right">${val}</span>
    `;
    const slider = row.querySelector('input');
    const valLbl = row.querySelector('.form-hint');
    slider.addEventListener('input', () => {
      valLbl.textContent = slider.value;
      onVal(parseFloat(slider.value));
      apply();
    });
    body.appendChild(row);
  };

  addSlider('Hue', -180, 180, hueShift, 1, v => hueShift = v);
  addSlider('Saturation', -100, 100, satShift, 1, v => satShift = v);
  addSlider('Lightness', -100, 100, lightShift, 1, v => lightShift = v);
}

// ─── Exposure / Brightness-Contrast ──────────────────────────────────────────

export function showExposurePanel(session) {
  const layer = session.activeLayer;
  if (!layer || layer.isGroup) return;

  const origCanvas = document.createElement('canvas');
  origCanvas.width = layer.pixelW;
  origCanvas.height = layer.pixelH;
  const octx = origCanvas.getContext('2d', { willReadFrequently: true });
  octx.drawImage(layer.canvas, 0, 0);

  let exposure = 0, brightness = 0, contrast = 0;

  const apply = () => {
    const ctx = layer.ctx;
    const imgData = octx.getImageData(0, 0, layer.pixelW, layer.pixelH);
    const d = imgData.data;
    const len = d.length;

    const expMult = Math.pow(2, exposure);
    const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast));

    for (let i = 0; i < len; i += 4) {
      let r = d[i] * expMult + brightness;
      let g = d[i + 1] * expMult + brightness;
      let b = d[i + 2] * expMult + brightness;

      r = contrastFactor * (r - 128) + 128;
      g = contrastFactor * (g - 128) + 128;
      b = contrastFactor * (b - 128) + 128;

      d[i]     = Math.max(0, Math.min(255, r));
      d[i + 1] = Math.max(0, Math.min(255, g));
      d[i + 2] = Math.max(0, Math.min(255, b));
    }

    ctx.putImageData(imgData, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  };

  const { body } = createModal('Brightness / Contrast / Exposure', () => {
    session.beginEdit('Exposure');
    apply();
    session.endEdit();
  }, () => {
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
    ctx.drawImage(origCanvas, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  });

  const addSlider = (label, min, max, val, step, onVal) => {
    const row = document.createElement('div');
    row.className = 'form-row';
    row.innerHTML = `
      <span class="form-label">${label}</span>
      <input type="range" class="opacity-slider" style="flex:1" min="${min}" max="${max}" value="${val}" step="${step}">
      <span class="form-hint" style="width:36px;text-align:right">${val}</span>
    `;
    const slider = row.querySelector('input');
    const valLbl = row.querySelector('.form-hint');
    slider.addEventListener('input', () => {
      valLbl.textContent = slider.value;
      onVal(parseFloat(slider.value));
      apply();
    });
    body.appendChild(row);
  };

  addSlider('Exposure', -3.0, 3.0, exposure, 0.1, v => exposure = v);
  addSlider('Brightness', -100, 100, brightness, 1, v => brightness = v);
  addSlider('Contrast', -100, 100, contrast, 1, v => contrast = v);
}

// ─── Filters (Gaussian Blur, Motion Blur, Radial Blur, Noise) ──────────────

export function showFilterPanel(session, filterType = 'gaussian') {
  const layer = session.activeLayer;
  if (!layer || layer.isGroup) return;

  const origCanvas = document.createElement('canvas');
  origCanvas.width = layer.pixelW;
  origCanvas.height = layer.pixelH;
  const octx = origCanvas.getContext('2d', { willReadFrequently: true });
  octx.drawImage(layer.canvas, 0, 0);

  let blurType = filterType; // 'gaussian' | 'motion' | 'radial'
  let blurRadius = 4, noiseAmt = 0;
  let motionAngle = 0, motionDist = 20;
  let radialAmount = 10;
  let rafId = null;

  const apply = () => {
    const ctx = layer.ctx;
    if (!ctx) return;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);

    if (blurType === 'gaussian') {
      ctx.save();
      if (blurRadius > 0) ctx.filter = `blur(${blurRadius}px)`;
      ctx.drawImage(origCanvas, 0, 0);
      ctx.restore();
    } else if (blurType === 'motion') {
      // GPU-Accelerated Motion Blur: multi-pass directional accumulation
      if (motionDist > 0) {
        const passes = Math.min(24, Math.max(4, Math.round(motionDist)));
        const rad = (motionAngle * Math.PI) / 180;
        const dx = Math.cos(rad), dy = Math.sin(rad);
        const halfDist = motionDist / 2;

        ctx.save();
        ctx.globalAlpha = 1 / passes;
        for (let i = 0; i < passes; i++) {
          const t = (i / (passes - 1 || 1)) * motionDist - halfDist;
          ctx.drawImage(origCanvas, Math.round(dx * t), Math.round(dy * t));
        }
        ctx.restore();
      } else {
        ctx.drawImage(origCanvas, 0, 0);
      }
    } else if (blurType === 'radial') {
      // GPU-Accelerated Radial (Zoom) Blur: multi-pass centered scale accumulation
      if (radialAmount > 0) {
        const passes = Math.min(20, Math.max(4, Math.round(radialAmount)));
        const cx = layer.pixelW / 2, cy = layer.pixelH / 2;
        const maxZoom = 1 + (radialAmount / 100);

        ctx.save();
        ctx.globalAlpha = 1 / passes;
        for (let i = 0; i < passes; i++) {
          const scale = 1 + (i / (passes - 1 || 1)) * (maxZoom - 1);
          const nw = layer.pixelW * scale;
          const nh = layer.pixelH * scale;
          const nx = cx - nw / 2;
          const ny = cy - nh / 2;
          ctx.drawImage(origCanvas, nx, ny, nw, nh);
        }
        ctx.restore();
      } else {
        ctx.drawImage(origCanvas, 0, 0);
      }
    }

    // Fast Noise pass using 32-bit typed buffer
    if (noiseAmt > 0) {
      const imgData = ctx.getImageData(0, 0, layer.pixelW, layer.pixelH);
      const d32 = new Uint32Array(imgData.data.buffer);
      const nScaled = Math.round(noiseAmt * 2.55);
      let seed = 123456789;
      const len = d32.length;
      for (let i = 0; i < len; i++) {
        seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
        const rand = ((seed & 0xFF) - 128) * (nScaled / 128);
        const r = Math.max(0, Math.min(255, (d32[i] & 0xFF) + rand));
        const g = Math.max(0, Math.min(255, ((d32[i] >> 8) & 0xFF) + rand));
        const b = Math.max(0, Math.min(255, ((d32[i] >> 16) & 0xFF) + rand));
        const a = (d32[i] >> 24) & 0xFF;
        d32[i] = (a << 24) | (b << 16) | (g << 8) | r;
      }
      ctx.putImageData(imgData, 0, 0);
    }

    layer.markChanged();
    session._emit('canvas-dirty');
  };

  const scheduleApply = () => {
    if (typeof requestAnimationFrame === 'undefined') {
      apply();
      return;
    }
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      apply();
      rafId = null;
    });
  };

  const titleMap = {
    gaussian: 'Gaussian Blur',
    motion: 'Motion Blur',
    radial: 'Radial Blur',
  };
  const modalTitle = titleMap[blurType] || 'Blur Filter';

  const { body } = createModal(modalTitle, () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    session.beginEdit(modalTitle);
    apply();
    session.endEdit();
  }, () => {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
    const ctx = layer.ctx;
    ctx.clearRect(0, 0, layer.pixelW, layer.pixelH);
    ctx.drawImage(origCanvas, 0, 0);
    layer.markChanged();
    session._emit('canvas-dirty');
  });

  // Blur type selector
  const typeRow = document.createElement('div');
  typeRow.className = 'form-row';
  typeRow.innerHTML = `
    <span class="form-label">Type</span>
    <select class="form-input" id="blur-type-sel" style="flex:1;padding:4px 6px">
      <option value="gaussian" ${blurType === 'gaussian' ? 'selected' : ''}>Gaussian Blur</option>
      <option value="motion" ${blurType === 'motion' ? 'selected' : ''}>Motion Blur</option>
      <option value="radial" ${blurType === 'radial' ? 'selected' : ''}>Radial (Zoom) Blur</option>
    </select>
  `;
  body.appendChild(typeRow);

  // Container for type-specific controls
  const controlsContainer = document.createElement('div');
  controlsContainer.id = 'blur-controls';
  body.appendChild(controlsContainer);

  const renderControls = () => {
    controlsContainer.innerHTML = '';
    if (blurType === 'gaussian') {
      addSlider(controlsContainer, 'Radius (px)', 0, 40, blurRadius, 1, v => { blurRadius = v; scheduleApply(); });
    } else if (blurType === 'motion') {
      addSlider(controlsContainer, 'Angle (°)', -90, 90, motionAngle, 1, v => { motionAngle = v; scheduleApply(); });
      addSlider(controlsContainer, 'Distance (px)', 1, 100, motionDist, 1, v => { motionDist = v; scheduleApply(); });
    } else if (blurType === 'radial') {
      addSlider(controlsContainer, 'Amount', 1, 50, radialAmount, 1, v => { radialAmount = v; scheduleApply(); });
    }
    addSlider(controlsContainer, 'Noise (%)', 0, 100, noiseAmt, 1, v => { noiseAmt = v; scheduleApply(); });
  };

  body.querySelector('#blur-type-sel').addEventListener('change', (e) => {
    blurType = e.target.value;
    renderControls();
    scheduleApply();
  });

  renderControls();
  apply();
}

/** Shared slider helper for filter panels */
function addSlider(container, label, min, max, val, step, onVal) {
  const row = document.createElement('div');
  row.className = 'form-row';
  row.innerHTML = `
    <span class="form-label">${label}</span>
    <input type="range" class="opacity-slider" style="flex:1" min="${min}" max="${max}" value="${val}" step="${step}">
    <span class="form-hint" style="width:36px;text-align:right">${val}</span>
  `;
  const slider = row.querySelector('input');
  const valLbl = row.querySelector('.form-hint');
  slider.addEventListener('input', () => {
    valLbl.textContent = slider.value;
    onVal(parseFloat(slider.value));
  });
  container.appendChild(row);
}

