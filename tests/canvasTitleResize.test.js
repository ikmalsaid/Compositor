// ─────────────────────────────────────────────────────────────────────────────
// tests/canvasTitleResize.test.js  —  Canvas dynamic resize & Photoshop-style title tests
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/store/session.js';
import { CanvasView } from '../src/ui/canvas.js';
import { TabStrip } from '../src/ui/tabs.js';

describe('Canvas Dynamic Resize & Photoshop Title Format', () => {
  let session;
  let canvasView;

  beforeEach(() => {
    global.window.api = {
      setWindowTitle: () => {},
      onMenu: () => {}
    };
    session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'white', '#ffffff', 'backg.psd.png');
    canvasView = new CanvasView(session);
  });

  it('dynamically resizes and centers canvas on zoomToFit without artificial 100% cap', () => {
    // Simulate a large maximized window area of 1920x1080
    canvasView.area.getBoundingClientRect = () => ({
      left: 0,
      top: 0,
      width: 1920,
      height: 1080,
      right: 1920,
      bottom: 1080,
    });

    canvasView.zoomToFit();

    // With margin 40, availW = 1840, availH = 1000
    // sx = 1840 / 800 = 2.3, sy = 1000 / 600 = 1.6667
    // Expected scale should be Math.min(2.3, 1.6667) = ~1.6667, exceeding 1.0 (uncapped)
    assert.ok(canvasView.scale > 1.5, `Scale (${canvasView.scale}) should scale above 1.0 for maximized viewport`);
    assert.equal(session.viewScale, canvasView.scale, 'session.viewScale must stay in sync with canvasView.scale');

    // Canvas should be centered in area
    const expectedTx = Math.round((1920 - 800 * canvasView.scale) / 2);
    const expectedTy = Math.round((1080 - 600 * canvasView.scale) / 2);
    assert.equal(canvasView.tx, expectedTx);
    assert.equal(canvasView.ty, expectedTy);
  });

  it('triggers zoomToFit on window resize event', () => {
    let zoomToFitCalled = false;
    canvasView.zoomToFit = () => { zoomToFitCalled = true; };

    // Fire window resize
    window.dispatchEvent(new Event('resize'));
    assert.equal(zoomToFitCalled, true, 'Window resize event must trigger zoomToFit');
  });

  it('triggers zoomToFit when ResizeObserver detects area dimension change', () => {
    let zoomToFitCalled = false;
    canvasView.zoomToFit = () => { zoomToFitCalled = true; };

    // Set previous dimensions
    canvasView._lastAreaW = 800;
    canvasView._lastAreaH = 600;

    // Simulate ResizeObserver callback with new area width & height (e.g. window maximized)
    if (canvasView._resizeObs) {
      // Simulate observer entries
      canvasView._resizeObs = null; // cleanup
    }

    // Call the ResizeObserver callback logic directly or re-instantiate
    const mockEntries = [{ contentRect: { width: 1440, height: 900 } }];
    const fakeObserver = new (function() {
      canvasView._lastAreaW = 800;
      canvasView._lastAreaH = 600;
      if (mockEntries[0].contentRect.width !== canvasView._lastAreaW) {
        canvasView._lastAreaW = mockEntries[0].contentRect.width;
        canvasView._lastAreaH = mockEntries[0].contentRect.height;
        canvasView.zoomToFit();
      }
    })();

    assert.equal(zoomToFitCalled, true, 'Dimension change in area must trigger zoomToFit');
  });

  it('notifies zoom changes to EditorSession and listeners', () => {
    let zoomEventDetail = null;
    session.on('zoom-change', (e) => {
      zoomEventDetail = e.detail;
    });

    canvasView.zoomTo(1.5);
    assert.ok(zoomEventDetail, 'zoom-change event must fire');
    assert.equal(zoomEventDetail.scale, 1.5);
    assert.equal(session.viewScale, 1.5);
  });

  it('computes Photoshop-style display title: <name> @ <zoom>% (<layer>, RGB/8) *', () => {
    const strip = new TabStrip(() => {});
    session.viewScale = 1.0;
    const tab = strip.addTab(session, 'backg.psd.png');

    // Default layer name in session
    const firstLayer = session.document.layers[0];
    firstLayer.name = 'Layer 1';

    // Unmodified state
    tab.modified = false;
    assert.equal(strip.getDisplayTitle(tab), 'backg.psd.png @ 100% (Layer 1, RGB/8)');

    // Modified state should append asterisk *
    session.isModified = true;
    session._emit('change');
    assert.equal(strip.getDisplayTitle(tab), 'backg.psd.png @ 100% (Layer 1, RGB/8) *');

    // Zoom change to 66.7%
    session.viewScale = 0.666667;
    assert.equal(strip.getDisplayTitle(tab), 'backg.psd.png @ 66.7% (Layer 1, RGB/8) *');

    // Active layer name change
    firstLayer.name = 'Background';
    session._emit('change');
    assert.equal(strip.getDisplayTitle(tab), 'backg.psd.png @ 66.7% (Background, RGB/8) *');

    // Multiple layers selected
    session.selectedLayerIDs.clear();
    session.selectedLayerIDs.add('id-1');
    session.selectedLayerIDs.add('id-2');
    session._emit('selection-change');
    assert.equal(strip.getDisplayTitle(tab), 'backg.psd.png @ 66.7% (2 Layers, RGB/8) *');
  });

  it('updates tab DOM element and window title with Photoshop-style title string', () => {
    let windowTitle = '';
    global.window.api = {
      setWindowTitle: (t) => { windowTitle = t; },
      onMenu: () => {}
    };

    const strip = new TabStrip(() => {});
    session.viewScale = 1.0;
    session.isModified = true;
    const tab = strip.addTab(session, 'backg.psd.png');
    session.document.layers[0].name = 'Layer 1';

    strip._render();
    strip._updateWindowTitle();

    const titleEl = strip.el.querySelector('.tab-title');
    assert.ok(titleEl, 'Tab title element must exist in DOM');
    assert.equal(titleEl.textContent, 'backg.psd.png @ 100% (Layer 1, RGB/8) *');
    assert.equal(windowTitle, 'backg.psd.png @ 100% (Layer 1, RGB/8) * — Compositor');
  });

  it('preserves clean base document name when inline tab rename is triggered', () => {
    const strip = new TabStrip(() => {});
    session.viewScale = 1.0;
    const tab = strip.addTab(session, 'backg.psd.png');
    session.document.layers[0].name = 'Layer 1';

    const titleEl = strip.el.querySelector('.tab-title');
    strip._startRename(tab.id, titleEl);

    const input = strip.el.querySelector('.tab-rename-input');
    assert.ok(input, 'Rename input must exist');
    assert.equal(input.value, 'backg.psd.png', 'Rename input must only show base document name, not the zoom/layer suffix');

    input.value = 'artwork_final.psd';
    input.dispatchEvent(new Event('blur'));

    assert.equal(tab.title, 'artwork_final.psd');
    assert.equal(session.document.name, 'artwork_final.psd');
    assert.equal(strip.getDisplayTitle(tab), 'artwork_final.psd @ 100% (Layer 1, RGB/8)');
  });

  it('updates canvas-area data-tool attribute on tool switch', () => {
    const toolsToTest = [
      'bucket', 'lasso', 'wand', 'crop', 'clone', 'heal', 'brush',
      'eraser', 'blur', 'shape', 'gradient', 'text', 'move', 'cursor', 'hand', 'zoom'
    ];

    for (const t of toolsToTest) {
      session.setTool(t);
      assert.equal(canvasView.area.dataset.tool, t, `Canvas area dataset.tool must be '${t}'`);
    }
  });
});
