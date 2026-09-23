// ─────────────────────────────────────────────────────────────────────────────
// app.js  —  Application bootstrap
//            Wires together all UI components and menu/keyboard events
// ─────────────────────────────────────────────────────────────────────────────

import { EditorSession, Tool } from './store/session.js';
import { TabStrip       } from './ui/tabs.js';
import { Toolbar        } from './ui/toolbar.js';
import { Inspector      } from './ui/inspector.js';
import { CanvasView     } from './ui/canvas.js';
import { LayersPanel    } from './ui/layers.js';
import { showNewCanvasPanel, getDefaultCanvasSettings } from './ui/panels/newCanvas.js';
import { showJpegExportPanel, showPngExportPanel } from './ui/panels/jpegExport.js';
import { showImageSizePanel, showCanvasSizePanel } from './ui/panels/imageSize.js';
import { showLevelsPanel, showHueSatPanel, showExposurePanel, showFilterPanel } from './ui/panels/adjustments.js';
import { showPrintPreviewPanel } from './ui/panels/printPreview.js';
import { removeBackground } from './ai/backgroundRemoval.js';
import { saveProject, loadProject } from './io/project.js';

// ─── Bootstrap ───────────────────────────────────────────────────────────────

let tabs, toolbar, inspector, canvasView, layersPanel;
/** The currently active EditorSession */
let session;

// ─── Status bar elements ─────────────────────────────────────────────────────
const statusEls = {};

function onTabChange(newSession) {
  session = newSession;
  toolbar?.setSession(session);
  inspector?.setSession(session);
  canvasView?.setSession(session);
  layersPanel?.setSession(session);
  bindStatusBar(session);
  updateStatusBar();
}

/** Tool hint strings (matches macOS original's status bar) */
const TOOL_HINTS = {
  [Tool.MOVE]:        'Drag to move · Handles to resize · Circle to rotate · 1–0 layer opacity · Space to pan',
  [Tool.BRUSH]:       'Drag to paint · [ ] size · Shift-[ ] hardness · 1–0 opacity · Space to pan',
  [Tool.ERASER]:      'Drag to erase · [ ] size · Shift-[ ] hardness · 1–0 opacity · Space to pan',
  [Tool.BUCKET]:      'Click to flood-fill contiguous area · Tolerance and Sample All in inspector · Space to pan',
  [Tool.BLUR]:        'Drag to soften · [ ] size · 1–0 strength · Space to pan',
  [Tool.EYEDROPPER]:  'Click to sample a color',
  [Tool.SHAPE]:       'Drag to draw a shape on a new layer · Shift square/circle · Space to pan',
  [Tool.GRADIENT]:    'Drag to draw · Shift 45° · 1–0 opacity · Enter apply · Escape cancel',
  [Tool.CROP]:        'Drag to crop · Enter apply · Escape cancel · Space to pan',
  [Tool.MARQUEE]:     'Drag a rectangle · Shift square · Drag inside to move · Delete clears · Ctrl+D deselect',
  [Tool.LASSO]:       'Drag to select · Delete clears · Ctrl+D deselect',
  [Tool.WAND]:        'Click to select similar colors · Shift add · Delete clears · Ctrl+D deselect',
  [Tool.HAND]:        'Drag to pan · Pinch to zoom',
  [Tool.ZOOM]:        'Click to zoom in · Alt-click to zoom out · Drag to zoom smoothly · Space to pan',
  [Tool.HEAL]:        'Drag over blemishes to heal · [ ] size · Space to pan',
  [Tool.CLONE]:       'Alt-click to set source · Drag to clone · [ ] size · Space to pan',
};

let _statusSession = null;
let _statusHandlers = null;

function bindStatusBar(s) {
  if (_statusSession && _statusHandlers) {
    _statusSession.off('change', _statusHandlers.change);
    _statusSession.off('tool-change', _statusHandlers.toolChange);
    _statusSession.off('canvas-dirty', _statusHandlers.canvasDirty);
  }
  _statusSession = s;
  if (s) {
    _statusHandlers = {
      change: () => updateStatusBar(),
      toolChange: () => updateStatusBar(),
      canvasDirty: () => updateStatusBar(),
    };
    s.on('change', _statusHandlers.change);
    s.on('tool-change', _statusHandlers.toolChange);
    s.on('canvas-dirty', _statusHandlers.canvasDirty);
  }
}

function updateStatusBar() {
  if (!session) return;
  const doc = session.document;

  // Zoom
  const zoomPct = canvasView ? `${Math.round(canvasView.scale * 100)}%` : '100%';
  if (statusEls.zoom) statusEls.zoom.textContent = zoomPct;

  // Dimensions
  if (statusEls.dims) {
    statusEls.dims.textContent = doc ? `${doc.width} × ${doc.height} px` : 'No canvas';
  }

  // Tool hint
  if (statusEls.hint) {
    statusEls.hint.textContent = TOOL_HINTS[session.tool] || '';
  }

  // Layers count badge
  const countEl = document.getElementById('layers-count');
  if (countEl && doc) {
    countEl.textContent = doc.layers ? doc.layers.length : '0';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  // Cache status bar elements
  statusEls.zoom = document.getElementById('status-zoom');
  statusEls.dims = document.getElementById('status-dimensions');
  statusEls.profile = document.getElementById('status-profile');
  statusEls.hint = document.getElementById('status-hint');

  // First session with saved default settings
  const defSettings = getDefaultCanvasSettings();
  session = new EditorSession();
  session.createDefaultDocument(
    defSettings.width,
    defSettings.height,
    defSettings.ppi,
    defSettings.bgOption,
    defSettings.customBgColor
  );

  // Initialise components
  tabs        = new TabStrip(onTabChange);
  toolbar     = new Toolbar(session);
  inspector   = new Inspector(session);
  canvasView  = new CanvasView(session);
  layersPanel = new LayersPanel(session);
  window._canvasView = canvasView;  // Expose for inspector button callbacks

  // Add the first tab
  tabs.addTab(session, 'Untitled');
  canvasView.zoomToFit();

  // Wire keyboard shortcuts & menus
  bindKeyboard();
  bindMenuEvents();
  bindStatusBar(session);
  updateStatusBar();

  // Hide startup loader once canvas is ready & show New Canvas dialog on startup
  requestAnimationFrame(() => {
    document.getElementById('startup-loader')?.classList.add('ready');
    window.api?.setAppReady?.();
    showNewCanvasPanel(session, () => {
      canvasView?.zoomToFit();
    });
  });
});

// ─── Keyboard shortcuts ──────────────────────────────────────────────────────

function bindKeyboard() {
  document.addEventListener('keydown', async (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const ctrl  = e.ctrlKey || e.metaKey;
    const shift = e.shiftKey;
    const key   = e.key.toLowerCase();

    // Color swatches (X = swap, D = default)
    if (!ctrl && !shift && key === 'x') { e.preventDefault(); session.swapColors(); return; }
    if (!ctrl && !shift && key === 'd') { e.preventDefault(); session.resetColors(); return; }

    // Brush size ([ = smaller, ] = larger)
    if (!ctrl && key === '[') {
      e.preventDefault();
      session.brushSize = Math.max(1, session.brushSize - 4);
      session._emit('tool-change', { tool: session.tool });
      canvasView._markDirty();
      return;
    }
    if (!ctrl && key === ']') {
      e.preventDefault();
      session.brushSize = Math.min(500, session.brushSize + 4);
      session._emit('tool-change', { tool: session.tool });
      canvasView._markDirty();
      return;
    }

    // Crop / Escape
    if (key === 'enter') {
      if (session.tool === Tool.CROP) {
        e.preventDefault();
        const layer = session.activeLayer;
        const fallback = layer && !layer.isGroup ? { x: layer.transform.x, y: layer.transform.y, w: layer.transform.w, h: layer.transform.h } : (session.document ? { x: 0, y: 0, w: session.document.width, h: session.document.height } : null);
        const cr = session.cropRect || fallback;
        if (cr) session.cropActiveLayer(cr);
        return;
      }
    }
    if (key === 'escape') {
      if (session.tool === Tool.CROP) {
        e.preventDefault();
        session.cropRect = null;
        session.setTool(Tool.MOVE);
        session._emit('canvas-dirty');
        return;
      }
      if (session.selectionRect) {
        e.preventDefault();
        session.deselect();
        return;
      }
    }

    // Tool shortcuts (Photoshop-style single keys)
    if (!ctrl && !shift) {
      const toolKeys = {
        v: Tool.MOVE, b: Tool.BRUSH, e: Tool.ERASER, k: Tool.BUCKET, j: Tool.HEAL, s: Tool.CLONE,
        r: Tool.BLUR, h: Tool.HAND, z: Tool.ZOOM, c: Tool.CROP, g: Tool.GRADIENT,
        u: Tool.SHAPE, i: Tool.EYEDROPPER, l: Tool.LASSO, m: Tool.MARQUEE, w: Tool.WAND,
        t: Tool.TEXT
      };
      if (toolKeys[key]) { session.setTool(toolKeys[key]); e.preventDefault(); return; }
    }

    // Undo / Redo
    if (ctrl && !shift && key === 'z') { e.preventDefault(); session.undo(); return; }
    if (ctrl && shift  && key === 'z') { e.preventDefault(); session.redo(); return; }

    // Deselect (Ctrl+D)
    if (ctrl && !shift && key === 'd') { e.preventDefault(); session.deselect(); return; }

    // Invert (Ctrl+I)
    if (ctrl && !shift && key === 'i') { e.preventDefault(); session.invertActiveLayer(); return; }

    // Merge Down (Ctrl+E)
    if (ctrl && !shift && key === 'e') { e.preventDefault(); if (session.activeLayerID) session.mergeDown(session.activeLayerID); return; }

    // Save
    if (ctrl && !shift && key === 's') { e.preventDefault(); await doSave(); return; }
    if (ctrl && shift  && key === 's') { e.preventDefault(); await doSaveAs(); return; }

    // New canvas
    if (ctrl && !shift && key === 'n') { e.preventDefault(); showNewCanvas(); return; }

    // Open
    if (ctrl && !shift && key === 'o') { e.preventDefault(); doOpen(); return; }

    // Print / Print Preview (Ctrl+P)
    if (ctrl && !shift && key === 'p') { e.preventDefault(); showPrintPreviewPanel(session, canvasView); return; }

    // Duplicate layer
    if (ctrl && !shift && key === 'j') { e.preventDefault(); if (session.activeLayerID) session.duplicateLayer(session.activeLayerID); return; }

    // Copy / Cut / Paste
    if (ctrl && !shift && key === 'c') {
      if (session.activeLayerID) {
        e.preventDefault();
        session.copyLayer(session.activeLayerID);
        return;
      }
    }
    if (ctrl && !shift && key === 'x') {
      if (session.activeLayerID) {
        e.preventDefault();
        session.cutLayer(session.activeLayerID);
        return;
      }
    }
    if (ctrl && !shift && key === 'v') {
      if (session.hasClipboardLayer()) {
        e.preventDefault();
        session.pasteLayer();
        return;
      }
    }
    if (ctrl && shift && key === 'v') {
      if (session.hasClipboardLayer()) {
        e.preventDefault();
        session.pasteLayer({ inPlace: true });
        return;
      }
    }

    // Delete selection or layer
    if (key === 'delete' || key === 'backspace') {
      if (session.hasSelection()) {
        e.preventDefault();
        session.deleteSelection();
        return;
      }
      if ((session.activeLayerID || session.selectedLayerIDs.size > 0) && session.document) {
        session.deleteSelectedLayers();
        e.preventDefault();
      }
      return;
    }

    // Layer order / Arrange
    if (ctrl && shift && key === ']') { e.preventDefault(); if (session.activeLayerID) session.bringToFront(session.activeLayerID); return; }
    if (ctrl && shift && key === '[') { e.preventDefault(); if (session.activeLayerID) session.sendToBack(session.activeLayerID); return; }
    if (ctrl && !shift && key === ']') { e.preventDefault(); if (session.activeLayerID) session.bringForward(session.activeLayerID); return; }
    if (ctrl && !shift && key === '[') { e.preventDefault(); if (session.activeLayerID) session.sendBackward(session.activeLayerID); return; }

    // New layer
    if (ctrl && shift && key === 'n') { e.preventDefault(); session.addBlankLayer(); }

    // Close tab
    if (ctrl && key === 'w') { e.preventDefault(); if (tabs.activeID) tabs.closeTab(tabs.activeID); }

    // Export JPEG
    if (ctrl && shift && e.altKey && key === 's') { e.preventDefault(); showJpegExportPanel(session, canvasView); return; }

    // Rulers (Ctrl+R)
    if (ctrl && !shift && key === 'r') {
      e.preventDefault();
      session.showRulers = !session.showRulers;
      session._emit('canvas-dirty');
      return;
    }

    // Guides (Ctrl+;)
    if (ctrl && !shift && (key === ';' || key === ':')) {
      e.preventDefault();
      session.showGuides = !session.showGuides;
      session._emit('canvas-dirty');
      return;
    }

    // Snap to Guides (Ctrl+Shift+;)
    if (ctrl && shift && (key === ';' || key === ':')) {
      e.preventDefault();
      session.snapToGuides = !session.snapToGuides;
      return;
    }
  });
}

// ─── Menu event bindings ─────────────────────────────────────────────────────

function bindMenuEvents() {
  const on = (ch, fn) => window.api?.onMenu(ch, fn);

  on('menu:new-canvas',       showNewCanvas);
  on('menu:open',             doOpen);
  on('menu:save',             doSave);
  on('menu:save-as',          doSaveAs);
  on('menu:import',           doImport);
  on('menu:export-jpeg',      () => showJpegExportPanel(session, canvasView));
  on('menu:export-png',       () => showPngExportPanel(session, canvasView));
  on('menu:print',            () => showPrintPreviewPanel(session, canvasView));
  on('menu:close-tab',        () => { if (tabs.activeID) tabs.closeTab(tabs.activeID); });
  on('menu:undo',             () => session.undo());
  on('menu:redo',             () => session.redo());
  on('menu:cut',              () => { if (session.activeLayerID) session.cutLayer(session.activeLayerID); });
  on('menu:copy',             () => { if (session.activeLayerID) session.copyLayer(session.activeLayerID); });
  on('menu:paste',            () => { if (session.hasClipboardLayer()) session.pasteLayer(); });
  on('menu:new-layer',        () => session.addBlankLayer());
  on('menu:new-group',        () => session.addGroup());
  on('menu:duplicate-layer',  () => { if (session.activeLayerID) session.duplicateLayer(session.activeLayerID); });
  on('menu:merge-down',       () => { if (session.activeLayerID) session.mergeDown(session.activeLayerID); });
  on('menu:flatten',          () => session.flattenImage());
  on('menu:delete-layer',     () => { if (session.activeLayerID || session.selectedLayerIDs.size > 0) session.deleteSelectedLayers(); });
  on('menu:layer-up',         () => { if (session.activeLayerID) session.moveLayerUp(session.activeLayerID); });
  on('menu:layer-down',       () => { if (session.activeLayerID) session.moveLayerDown(session.activeLayerID); });
  on('menu:bring-forward',    () => { if (session.activeLayerID) session.bringForward(session.activeLayerID); });
  on('menu:send-backward',    () => { if (session.activeLayerID) session.sendBackward(session.activeLayerID); });
  on('menu:bring-to-front',   () => { if (session.activeLayerID) session.bringToFront(session.activeLayerID); });
  on('menu:send-to-back',     () => { if (session.activeLayerID) session.sendToBack(session.activeLayerID); });
  on('menu:image-size',       () => showImageSizePanel(session));
  on('menu:canvas-size',      () => showCanvasSizePanel(session));
  on('menu:zoom-fit',         () => canvasView.zoomToFit());
  on('menu:zoom-100',         () => canvasView.zoomTo(1));
  on('menu:zoom-in',          () => canvasView.zoomBy(1.25));
  on('menu:zoom-out',         () => canvasView.zoomBy(0.8));
  on('menu:toggle-rulers',    () => { session.showRulers = !session.showRulers; session._emit('canvas-dirty'); });
  on('menu:toggle-guides',    () => { session.showGuides = !session.showGuides; session._emit('canvas-dirty'); });
  on('menu:toggle-snap-guides', () => { session.snapToGuides = !session.snapToGuides; });

  // Adjustments & Filters
  on('menu:levels',           () => showLevelsPanel(session));
  on('menu:curves',           () => showLevelsPanel(session));
  on('menu:hue-saturation',   () => showHueSatPanel(session));
  on('menu:exposure',         () => showExposurePanel(session));
  on('menu:filters',          () => showFilterPanel(session));
  on('menu:filters-gaussian',  () => showFilterPanel(session, 'gaussian'));
  on('menu:filters-motion',    () => showFilterPanel(session, 'motion'));
  on('menu:filters-radial',    () => showFilterPanel(session, 'radial'));
  on('menu:invert',           () => session.invertActiveLayer());
  on('menu:flip-canvas-h',    () => session.flipCanvasH());
  on('menu:flip-canvas-v',    () => session.flipCanvasV());
  on('menu:flip-layer-h',     () => session.flipLayerH());
  on('menu:flip-layer-v',     () => session.flipLayerV());
  on('menu:deselect',         () => session.deselect());

  on('menu:remove-bg',        () => removeBackground(session));

  // Before-close: confirm unsaved changes with Save / Don't Save / Cancel
  on('app:before-close', async () => {
    if (!session.isModified) {
      window.api.confirmClose();
      return;
    }
    const choice = await showCloseDialog();
    if (choice === 'save') {
      await doSave();
      window.api.confirmClose();
    } else if (choice === 'discard') {
      window.api.confirmClose();
    }
    // 'cancel' — do nothing, window stays open
  });

  /**
   * Show a clean, compact modal close-confirmation dialog.
   * Returns: 'save' | 'discard' | 'cancel'
   */
  function showCloseDialog(customTitle, customMessage) {
    return new Promise((resolve) => {
      const backdrop = document.createElement('div');
      backdrop.style.cssText = 'position:fixed;inset:0;z-index:99000;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;backdrop-filter:blur(3px);animation:fadeIn .15s ease';

      const dlg = document.createElement('div');
      dlg.style.cssText = 'background:#1a1b22;border:1px solid rgba(255,255,255,0.12);border-radius:10px;box-shadow:0 18px 48px rgba(0,0,0,0.7);width:380px;font-family:var(--font-sans);color:#e0e0e0;padding:20px;display:flex;flex-direction:column;gap:14px;animation:te-dialog-in .15s cubic-bezier(.22,1,.36,1)';

      const docName = session.projectURL
        ? session.projectURL.split(/[/\\]/).pop()
        : 'Untitled';

      const titleText = customTitle || 'Save changes before closing?';
      const msgText = customMessage || `Do you want to save the changes made to "${docName}"? Your changes will be lost if you don't save.`;

      dlg.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px">
          <div style="font-size:14px;font-weight:600;color:#ffffff">${titleText}</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.6);line-height:1.45">${msgText}</div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:4px">
          <button id="cls-discard" style="padding:7px 13px;background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.3);border-radius:6px;color:#fca5a5;font-size:12px;font-weight:500;cursor:pointer;transition:all .12s">Don't Save</button>
          <button id="cls-cancel"  style="padding:7px 13px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#d1d5db;font-size:12px;font-weight:500;cursor:pointer;transition:all .12s">Cancel</button>
          <button id="cls-save"    style="padding:7px 18px;background:#3b82f6;border:none;border-radius:6px;color:#ffffff;font-size:12px;font-weight:600;cursor:pointer;transition:all .12s">Save</button>
        </div>
      `;

      backdrop.appendChild(dlg);
      document.body.appendChild(backdrop);

      const pick = (val) => { backdrop.remove(); resolve(val); };
      dlg.querySelector('#cls-save').onclick    = () => pick('save');
      dlg.querySelector('#cls-discard').onclick = () => pick('discard');
      dlg.querySelector('#cls-cancel').onclick  = () => pick('cancel');
      backdrop.addEventListener('click', e => { if (e.target === backdrop) pick('cancel'); });
      const onKey = e => {
        if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); pick('cancel'); }
        if (e.key === 'Enter')  { document.removeEventListener('keydown', onKey); pick('save'); }
      };
      document.addEventListener('keydown', onKey);
    });
  }
}

// ─── File operations ─────────────────────────────────────────────────────────

function showNewCanvas() {
  showNewCanvasPanel(session, () => {
    canvasView.zoomToFit();
  }, {
    onBeforeCreate: async () => {
      if (!session.isModified) return true;
      const choice = await showCloseDialog('Save changes before creating a new canvas?');
      if (choice === 'save') {
        await doSave();
        return true;
      } else if (choice === 'discard') {
        return true;
      }
      return false; // cancel
    }
  });
}

async function doOpen() {
  const paths = await window.api.openProjectDialog();
  if (!paths?.length) return;
  for (const p of paths) {
    let targetSession = session;
    if (session.document) {
      const newSession = new EditorSession();
      tabs.addTab(newSession, 'Loading…');
      targetSession = newSession;
    }
    await loadProject(targetSession, p);
    canvasView.zoomToFit();
  }
}

async function doSave() {
  if (!session.document) return;
  if (session.projectURL) {
    await saveProject(session, session.projectURL);
  } else {
    await doSaveAs();
  }
}

async function doSaveAs() {
  if (!session.document) return;
  const name = session.projectURL
    ? session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '')
    : 'Untitled';
  const path = await window.api.saveProjectDialog(name);
  if (!path) return;
  await saveProject(session, path);
}

async function doImport() {
  const paths = await window.api.openImagesDialog();
  if (!paths?.length) return;
  await canvasView.importFiles(paths);
}
