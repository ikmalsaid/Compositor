// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/textEditor.js  —  Modal text editor for the Text tool
// ─────────────────────────────────────────────────────────────────────────────

let _modal = null;
let _state = null;

export function openTextEditor(session, layer, docX, docY, existing, onConfirm, onCancel, opts = {}) {
  if (_modal) _destroyModal();
  const s = session;
  _state = {
    session, layer, docX, docY,
    text:          existing?.text          ?? '',
    fontFamily:    existing?.fontFamily    ?? s.fontFamily ?? "'Plus Jakarta Sans', sans-serif",
    fontSize:      existing?.fontSize      ?? s.fontSize   ?? 48,
    fontWeight:    existing?.fontWeight    ?? s.fontWeight ?? 'normal',
    fontStyle:     existing?.fontStyle     ?? s.fontStyle  ?? 'normal',
    textAlign:     existing?.textAlign     ?? s.textAlign  ?? 'left',
    lineHeight:    existing?.lineHeight    ?? s.lineHeight ?? 1.2,
    letterSpacing: existing?.letterSpacing ?? s.letterSpacing ?? 0,
    color:         existing?.color         ?? s.fgColor    ?? '#000000',
    initialBoxW:   opts?.initialBoxW       ?? existing?.initialBoxW ?? existing?.boxW ?? layer?.transform?.w ?? 0,
    initialBoxH:   opts?.initialBoxH       ?? existing?.initialBoxH ?? existing?.boxH ?? layer?.transform?.h ?? 0,
    onConfirm, onCancel,
  };
  _modal = _buildModal();
  document.body.appendChild(_modal);
  _renderLive();
  s._emit('text-editor-open', { layer });
  requestAnimationFrame(() => {
    const ta = _modal.querySelector('#te-textarea');
    if (ta) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  });
}

export function closeTextEditor() {
  if (_modal) _destroyModal();
}

export function isTextEditorOpen() { return !!_modal; }
export function getActiveTextEditingLayer() { return _state?.layer ?? null; }

export function renderTextToLayer(layer, docX, docY, state) {
  if (!layer) return;
  const rawText = state.text ?? '';
  const text = rawText.replace(/\r\n/g, '\n');

  const fontStyle     = state.fontStyle     || 'normal';
  const fontWeight    = state.fontWeight    || 'normal';
  const fontSize      = Math.max(4, state.fontSize || 48);
  const fontFamily    = state.fontFamily    || "'Plus Jakarta Sans', sans-serif";
  const lineHeight    = state.lineHeight    || 1.2;
  const letterSpacing = state.letterSpacing || 0;
  const textAlign     = state.textAlign     || 'left';
  const color         = state.color         || '#000000';

  const fontStr = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
  const lines = text.length > 0 ? text.split('\n') : [''];
  const lineH = fontSize * lineHeight;

  // Measurement context
  let measCtx = layer.ctx;
  if (!measCtx && typeof document !== 'undefined') {
    const tempC = document.createElement('canvas');
    measCtx = tempC.getContext('2d');
  }

  let maxW = 0;
  const lineWidths = [];
  if (measCtx) {
    measCtx.save();
    measCtx.font = fontStr;
    for (const line of lines) {
      let lw = measCtx.measureText(line).width;
      if (letterSpacing !== 0 && line.length > 1) {
        lw += letterSpacing * (line.length - 1);
      }
      lineWidths.push(lw);
      maxW = Math.max(maxW, lw);
    }
    measCtx.restore();
  } else {
    for (const line of lines) {
      const lw = line.length * fontSize * 0.6;
      lineWidths.push(lw);
      maxW = Math.max(maxW, lw);
    }
  }

  // Padding to prevent glyph cutoffs (for italics, ascenders, descenders)
  const padX = Math.max(6, Math.round(fontSize * 0.25));
  const padY = Math.max(4, Math.round(fontSize * 0.2));

  const hasContent = text.trim().length > 0;
  const effectiveW = hasContent ? Math.max(12, maxW) : Math.max(12, fontSize * 1.5);
  const effectiveH = hasContent ? Math.max(fontSize, (lines.length - 1) * lineH + fontSize * 1.15) : Math.max(fontSize, lineH);

  const minBoxW = state.initialBoxW ? Math.max(16, state.initialBoxW) : 16;
  const minBoxH = state.initialBoxH ? Math.max(16, state.initialBoxH) : 16;

  const contentW = Math.ceil(effectiveW + padX * 2);
  const contentH = Math.ceil(effectiveH + padY * 2);

  // Layer width & height: accommodate user-defined initial box or tightly follow text content
  const targetW = Math.max(8, Math.max(minBoxW, contentW));
  const targetH = Math.max(8, Math.max(minBoxH, contentH));

  // Fixed top-left origin: text alignment does NOT shift layer position across canvas
  const targetX = Math.round(docX);
  const targetY = Math.round(docY);

  layer.transform.x = targetX;
  layer.transform.y = targetY;
  layer.transform.w = targetW;
  layer.transform.h = targetH;
  layer.pixelW = targetW;
  layer.pixelH = targetH;

  if (typeof document !== 'undefined') {
    if (!layer.canvas || layer.canvas.width !== targetW || layer.canvas.height !== targetH) {
      const newCanvas = document.createElement('canvas');
      newCanvas.width = targetW;
      newCanvas.height = targetH;
      layer.canvas = newCanvas;
      layer.bitmap = newCanvas;
    }
  }

  const ctx = layer.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, targetW, targetH);

  if (!hasContent) {
    layer.markChanged();
    return;
  }

  ctx.save();
  ctx.font = fontStr;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';

  // Align text relative to the bounding box [padX, targetW - padX]
  let alignX = padX;
  if (textAlign === 'center') {
    alignX = targetW / 2;
  } else if (textAlign === 'right') {
    alignX = targetW - padX;
  }
  ctx.textAlign = textAlign;

  const localY = padY;
  for (let i = 0; i < lines.length; i++) {
    const ly = localY + i * lineH;
    if (letterSpacing !== 0 && lines[i].length > 0) {
      ctx.textAlign = 'left';
      let cx = padX;
      if (textAlign === 'center') {
        cx = (targetW - lineWidths[i]) / 2;
      } else if (textAlign === 'right') {
        cx = targetW - padX - lineWidths[i];
      }
      for (const char of lines[i]) {
        ctx.fillText(char, cx, ly);
        cx += (measCtx ? measCtx.measureText(char).width : fontSize * 0.6) + letterSpacing;
      }
    } else {
      ctx.fillText(lines[i], alignX, ly);
    }
  }
  ctx.restore();
  layer.markChanged();
}

export function layerNameFromText(text) {
  const clean = (text || '').replace(/\n+/g, ' ').trim();
  return clean.length > 28 ? clean.slice(0, 27) + '\u2026' : clean || 'Text';
}

function _renderLive() {
  if (!_state) return;
  renderTextToLayer(_state.layer, _state.docX, _state.docY, _state);
  _state.session._emit('canvas-dirty');
}

function _destroyModal() {
  const s = _state?.session;
  if (_modal) { _modal.remove(); _modal = null; }
  _state = null;
  if (s) {
    s._emit('text-editor-close');
    s._emit('canvas-dirty');
  }
}

function _fontOptions(current) {
  const fonts = [
    ["'Plus Jakarta Sans', sans-serif", 'Jakarta'],
    ['Inter, sans-serif', 'Inter'],
    ['Arial, sans-serif', 'Arial'],
    ['Georgia, serif', 'Georgia'],
    ["'Courier New', monospace", 'Courier New'],
    ["'Times New Roman', serif", 'Times New Roman'],
    ['Verdana, sans-serif', 'Verdana'],
    ["'Segoe UI', sans-serif", 'Segoe UI'],
    ['Consolas, monospace', 'Consolas'],
    ['Impact, sans-serif', 'Impact'],
    ["'Trebuchet MS', sans-serif", 'Trebuchet MS'],
  ];
  return fonts.map(([val, label]) =>
    `<option value="${val}"${(val === current || (current && (current.includes('Jakarta') || current.includes('Plus Jakarta')) && val.includes('Jakarta')))?' selected':''}>${label}</option>`
  ).join('');
}

function _buildModal() {
  const st = _state;
  const modal = document.createElement('div');
  modal.id = 'text-editor-modal';
  modal.className = 'te-backdrop';
  modal.innerHTML = `
    <div class="te-dialog" role="dialog" aria-modal="true" aria-label="Text Editor">
      <div class="te-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/></svg>
        <span>Add Text</span>
      </div>
      <div class="te-body">
        <textarea id="te-textarea" class="te-textarea" placeholder="Type your text here\u2026" rows="5" spellcheck="false">${(st.text||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</textarea>

        <div class="te-row">
          <select class="te-select te-font-family" id="te-font">${_fontOptions(st.fontFamily)}</select>
          <input type="number" class="te-input te-size" id="te-size" min="4" max="500" value="${st.fontSize}" title="Font size"/>
          <span class="te-unit">px</span>
        </div>

        <div class="te-row te-row-gap">
          <button class="te-btn te-toggle${st.fontWeight==='bold'?' active':''}" id="te-bold" title="Bold"><b>B</b></button>
          <button class="te-btn te-toggle${st.fontStyle==='italic'?' active':''}" id="te-italic" title="Italic"><i>I</i></button>
          <div class="te-sep"></div>
          <button class="te-btn te-toggle${st.textAlign==='left'?' active':''}" id="te-al-l" title="Left">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg>
          </button>
          <button class="te-btn te-toggle${st.textAlign==='center'?' active':''}" id="te-al-c" title="Center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
          </button>
          <button class="te-btn te-toggle${st.textAlign==='right'?' active':''}" id="te-al-r" title="Right">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="te-sep"></div>
          <div class="te-color-wrap" title="Text color">
            <div class="te-color-swatch" id="te-color-swatch" style="background:${st.color}"></div>
            <input type="color" id="te-color-input" value="${st.color}" style="opacity:0;position:absolute;width:0;height:0">
          </div>
        </div>

        <div class="te-row te-slider-row">
          <span class="te-label-w">Line H</span>
          <input type="range" class="te-slider" id="te-lh" min="0.8" max="4" step="0.05" value="${st.lineHeight}">
          <span class="te-val" id="te-lh-val">${st.lineHeight.toFixed(2)}</span>
        </div>

        <div class="te-row te-slider-row">
          <span class="te-label-w">Spacing</span>
          <input type="range" class="te-slider" id="te-ls" min="-5" max="40" step="0.5" value="${st.letterSpacing}">
          <span class="te-val" id="te-ls-val">${st.letterSpacing}px</span>
        </div>

        <p class="te-hint">Live preview updates on canvas as you type. After confirming, switch to <b>Move (V)</b> to reposition.</p>
      </div>

      <div class="te-footer">
        <button class="te-btn-cancel" id="te-btn-cancel">Cancel</button>
        <button class="te-btn-confirm" id="te-btn-confirm">\u2714 Confirm</button>
      </div>
    </div>
  `;

  // Wire controls
  const ta      = modal.querySelector('#te-textarea');
  const fontSel = modal.querySelector('#te-font');
  const sizeIn  = modal.querySelector('#te-size');
  const boldBtn = modal.querySelector('#te-bold');
  const italBtn = modal.querySelector('#te-italic');
  const alL     = modal.querySelector('#te-al-l');
  const alC     = modal.querySelector('#te-al-c');
  const alR     = modal.querySelector('#te-al-r');
  const lhIn    = modal.querySelector('#te-lh');
  const lhVal   = modal.querySelector('#te-lh-val');
  const lsIn    = modal.querySelector('#te-ls');
  const lsVal   = modal.querySelector('#te-ls-val');
  const swatch  = modal.querySelector('#te-color-swatch');
  const colorIn = modal.querySelector('#te-color-input');

  const update = patch => { Object.assign(_state, patch); _renderLive(); };

  ta.addEventListener('input', () => update({ text: ta.value }));

  fontSel.addEventListener('change', () => {
    update({ fontFamily: fontSel.value });
    st.session.fontFamily = fontSel.value;
  });
  sizeIn.addEventListener('input', () => {
    const v = Math.max(4, Math.min(500, parseInt(sizeIn.value, 10) || 48));
    update({ fontSize: v }); st.session.fontSize = v;
  });
  boldBtn.addEventListener('click', () => {
    const nw = _state.fontWeight === 'bold' ? 'normal' : 'bold';
    boldBtn.classList.toggle('active', nw === 'bold');
    update({ fontWeight: nw }); st.session.fontWeight = nw;
  });
  italBtn.addEventListener('click', () => {
    const ni = _state.fontStyle === 'italic' ? 'normal' : 'italic';
    italBtn.classList.toggle('active', ni === 'italic');
    update({ fontStyle: ni }); st.session.fontStyle = ni;
  });
  const setAlign = a => {
    [alL, alC, alR].forEach(b => b.classList.remove('active'));
    ({ left: alL, center: alC, right: alR })[a]?.classList.add('active');
    update({ textAlign: a }); st.session.textAlign = a;
  };
  alL.addEventListener('click', () => setAlign('left'));
  alC.addEventListener('click', () => setAlign('center'));
  alR.addEventListener('click', () => setAlign('right'));

  lhIn.addEventListener('input', () => {
    const v = parseFloat(lhIn.value);
    lhVal.textContent = v.toFixed(2);
    update({ lineHeight: v }); st.session.lineHeight = v;
  });
  lsIn.addEventListener('input', () => {
    const v = parseFloat(lsIn.value);
    lsVal.textContent = v + 'px';
    update({ letterSpacing: v }); st.session.letterSpacing = v;
  });
  swatch.addEventListener('click', () => colorIn.click());
  colorIn.addEventListener('input', () => {
    swatch.style.background = colorIn.value;
    update({ color: colorIn.value }); st.session.fgColor = colorIn.value;
  });

  modal.querySelector('#te-btn-confirm').addEventListener('click', _confirm);
  modal.querySelector('#te-btn-cancel').addEventListener('click', _cancel);

  // Backdrop click cancels
  modal.addEventListener('click', e => { if (e.target === modal) _cancel(); });

  // Keyboard shortcuts
  ta.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); _cancel(); }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); _confirm(); }
  });
  document.addEventListener('keydown', _onGlobalKey, { once: false });
  modal._onGlobalKey = _onGlobalKey;

  return modal;
}

function _onGlobalKey(e) {
  if (!_modal) { document.removeEventListener('keydown', _onGlobalKey); return; }
  if (e.key === 'Escape') { e.preventDefault(); _cancel(); }
}

function _confirm() {
  if (!_state) return;
  const { session, layer, docX, docY, text, onConfirm } = _state;
  const finalText = (text || '').trim();
  if (!finalText) { _cancel(); return; }
  renderTextToLayer(layer, docX, docY, _state);
  layer.name = layerNameFromText(finalText);
  layer.textData = {
    text: finalText,
    fontFamily: _state.fontFamily, fontSize: _state.fontSize,
    fontWeight: _state.fontWeight, fontStyle: _state.fontStyle,
    textAlign: _state.textAlign, lineHeight: _state.lineHeight,
    letterSpacing: _state.letterSpacing, color: _state.color,
    docX: layer.transform.x, docY: layer.transform.y,
    boxX: layer.transform.x, boxY: layer.transform.y,
    boxW: layer.transform.w, boxH: layer.transform.h,
    initialBoxW: _state.initialBoxW || layer.transform.w,
    initialBoxH: _state.initialBoxH || layer.transform.h,
    localX: 0,
    localY: 0,
  };
  layer.markChanged();
  if (_modal?._onGlobalKey) document.removeEventListener('keydown', _modal._onGlobalKey);
  _destroyModal();
  onConfirm?.();
  session._emit('change');
  session._emit('canvas-dirty');
}

function _cancel() {
  if (!_state) return;
  const { onCancel } = _state;
  if (_modal?._onGlobalKey) document.removeEventListener('keydown', _modal._onGlobalKey);
  _destroyModal();
  onCancel?.();
}
