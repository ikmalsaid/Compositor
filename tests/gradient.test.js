// ─────────────────────────────────────────────────────────────────────────────
// tests/gradient.test.js  —  Unit tests for Multi-Point Gradient & Color System
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  GRADIENT_PRESETS,
  normalizeStops,
  stopsToCss,
  sampleGradient,
} from '../src/assets/gradientData.js';
import { EditorSession } from '../src/store/session.js';
import { CanvasView } from '../src/ui/canvas.js';

describe('Multi-Point Gradient & Color System', () => {
  it('defines curated multi-point gradient presets with rich color ramps', () => {
    assert.ok(GRADIENT_PRESETS['rainbow-spectrum'], 'Must have 7-color rainbow preset');
    assert.equal(GRADIENT_PRESETS['rainbow-spectrum'].stops.length, 7);

    assert.ok(GRADIENT_PRESETS['rainbow-pastel'], 'Must have pastel rainbow preset');
    assert.equal(GRADIENT_PRESETS['rainbow-pastel'].stops.length, 7);

    assert.ok(GRADIENT_PRESETS['sunset-flame'], 'Must have sunset preset');
    assert.ok(GRADIENT_PRESETS['cyberpunk-neon'], 'Must have cyberpunk preset');
    assert.ok(GRADIENT_PRESETS['metallic-chrome'], 'Must have chrome preset');
    assert.ok(GRADIENT_PRESETS['golden-royal'], 'Must have gold preset');
    assert.ok(GRADIENT_PRESETS['emerald-aurora'], 'Must have aurora preset');
    assert.ok(GRADIENT_PRESETS['ocean-deep'], 'Must have ocean preset');
  });

  it('normalizes various stops and color array structures', () => {
    // Array of strings
    const fromColors = normalizeStops(['#ff0000', '#00ff00', '#0000ff']);
    assert.equal(fromColors.length, 3);
    assert.equal(fromColors[0].offset, 0);
    assert.equal(fromColors[0].color, '#ff0000');
    assert.equal(fromColors[1].offset, 0.5);
    assert.equal(fromColors[1].color, '#00ff00');
    assert.equal(fromColors[2].offset, 1.0);
    assert.equal(fromColors[2].color, '#0000ff');

    // Array of stop objects
    const fromStops = normalizeStops([
      { offset: 0.2, color: '#f00' },
      { offset: 0.8, color: '#00f' },
    ]);
    assert.equal(fromStops.length, 2);
    assert.equal(fromStops[0].offset, 0.2);
    assert.equal(fromStops[1].offset, 0.8);
  });

  it('generates valid CSS linear-gradient strings with custom angles', () => {
    const css0 = stopsToCss(['#ff0000', '#0000ff'], 0);
    assert.ok(css0.startsWith('linear-gradient(0deg,'));
    assert.ok(css0.includes('#ff0000 0.0%'));
    assert.ok(css0.includes('#0000ff 100.0%'));

    const css90 = stopsToCss(GRADIENT_PRESETS['rainbow-spectrum'].stops, 90);
    assert.ok(css90.startsWith('linear-gradient(90deg,'));
    assert.ok(css90.includes('#ff0000 0.0%'));
    assert.ok(css90.includes('#aa00ff 100.0%'));
  });

  it('samples multi-point gradient at arbitrary normalized positions', () => {
    const stops = [
      { offset: 0.0, color: '#000000' },
      { offset: 1.0, color: '#ffffff' },
    ];
    const mid = sampleGradient(stops, 0.5);
    assert.ok(mid.startsWith('rgba(128, 128, 128,') || mid.startsWith('rgba(127, 127, 127,') || mid.startsWith('rgba(128,128,128,'));
  });

  it('manages gradient presets and multi-point stops in EditorSession', () => {
    const session = new EditorSession();
    assert.equal(session.gradientPreset, 'fg-bg');
    assert.equal(session.gradientStops.length, 2);

    session.setGradientPreset('rainbow-spectrum');
    assert.equal(session.gradientPreset, 'rainbow-spectrum');
    assert.equal(session.gradientStops.length, 7);

    session.setGradientPreset('sunset-flame');
    assert.equal(session.gradientPreset, 'sunset-flame');
    assert.equal(session.gradientStops.length, 5);

    // Custom stops
    session.setGradientStops([
      { offset: 0, color: '#112233' },
      { offset: 0.5, color: '#445566' },
      { offset: 1, color: '#778899' },
    ]);
    assert.equal(session.gradientPreset, 'custom');
    assert.equal(session.gradientStops.length, 3);
  });

  it('manages gradient steps in EditorSession for stepped or smooth rendering', () => {
    const session = new EditorSession();
    assert.equal(session.gradientSteps, 0, 'Default gradientSteps should be 0 (smooth)');

    session.setGradientSteps(4);
    assert.equal(session.gradientSteps, 4);

    session.setGradientSteps(0);
    assert.equal(session.gradientSteps, 0);

    session.setGradientSteps(8);
    assert.equal(session.gradientSteps, 8);
  });

  it('manages gradient opacity and clamps to valid 0-1 range', () => {
    const session = new EditorSession();
    assert.equal(session.gradientOpacity, 1.0, 'Default gradientOpacity should be 1.0');

    session.setGradientOpacity(0.45);
    assert.equal(session.gradientOpacity, 0.45);

    session.setGradientOpacity(-0.2);
    assert.equal(session.gradientOpacity, 0.0, 'Must clamp negative values to 0');

    session.setGradientOpacity(1.8);
    assert.equal(session.gradientOpacity, 1.0, 'Must clamp values > 1 to 1.0');
  });

  it('reverses gradient stops accurately with inverted offsets and sorted order', () => {
    const session = new EditorSession();
    session.setGradientStops([
      { offset: 0.0, color: '#ff0000' },
      { offset: 0.25, color: '#ffff00' },
      { offset: 1.0, color: '#0000ff' },
    ]);

    session.reverseGradient();
    assert.equal(session.gradientPreset, 'custom');
    assert.equal(session.gradientStops.length, 3);

    // After reverse:
    // Old 1.0 (#0000ff) -> 1 - 1.0 = 0.0 (#0000ff)
    // Old 0.25 (#ffff00) -> 1 - 0.25 = 0.75 (#ffff00)
    // Old 0.0 (#ff0000) -> 1 - 0.0 = 1.0 (#ff0000)
    assert.equal(session.gradientStops[0].offset, 0.0);
    assert.equal(session.gradientStops[0].color, '#0000ff');

    assert.equal(session.gradientStops[1].offset, 0.75);
    assert.equal(session.gradientStops[1].color, '#ffff00');

    assert.equal(session.gradientStops[2].offset, 1.0);
    assert.equal(session.gradientStops[2].color, '#ff0000');
  });

  it('fills active layer or selection cleanly using fillGradient', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);

    session.addBlankLayer('ArtLayer');
    const initialHistoryLen = session.history.undoCount;

    // Direct fill
    session.fillGradient();
    assert.equal(session.history.undoCount, initialHistoryLen + 1, 'fillGradient must push history state');
    assert.equal(session.history.undoName, 'Fill Gradient');

    // Fill with rectangular selection
    session.setSelection({ x: 50, y: 50, w: 200, h: 150 });
    session.fillGradient();
    assert.equal(session.history.undoCount, initialHistoryLen + 2);

    // Fill with lasso polygon selection
    session.setSelection(null, [{ x: 10, y: 10 }, { x: 100, y: 10 }, { x: 100, y: 100 }, { x: 10, y: 100 }]);
    session.fillGradient();
    assert.equal(session.history.undoCount, initialHistoryLen + 3);
  });

  it('protects against sudden accidental clicks by ignoring drags under 6px in CanvasView', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const canvasView = new CanvasView(session);

    session.addBlankLayer('WorkLayer');
    const initialHistoryLen = session.history.undoCount;

    // Accidental micro-drag / click (dist = Math.hypot(2, 1) = ~2.2px < 6px)
    canvasView._commitGradient({ x1: 100, y1: 100, x2: 102, y2: 101 });
    assert.equal(session.history.undoCount, initialHistoryLen, 'Micro-drag under 6px must not commit or alter history');

    // Deliberate drag (dist = 100px >= 6px)
    canvasView._commitGradient({ x1: 100, y1: 100, x2: 200, y2: 100 });
    assert.equal(session.history.undoCount, initialHistoryLen + 1, 'Valid drag >= 6px commits successfully');
    assert.equal(session.history.undoName, 'Draw Gradient');
  });

  it('snaps gradient angle to 45° increments when Shift is held in CanvasView', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const canvasView = new CanvasView(session);

    canvasView._drag = { type: 'gradient', startDX: 100, startDY: 100 };

    // Move with Shift: angle ~11.3° (dx=200, dy=120) should snap to 0° (horizontal)
    canvasView._updateGradientDrag(200, 120, true);
    assert.ok(canvasView._liveGrad.isSnapped, 'Must be marked as snapped');
    assert.equal(Math.round(canvasView._liveGrad.y2), 100, 'Y must snap to start Y for 0°');

    // Move without Shift: angle ~11.3° is unconstrained
    canvasView._updateGradientDrag(200, 120, false);
    assert.equal(canvasView._liveGrad.isSnapped, false);
    assert.equal(canvasView._liveGrad.y2, 120);

    // Move with Shift: angle ~84.3° (dx=110, dy=200) should snap to 90° (vertical)
    canvasView._updateGradientDrag(110, 200, true);
    assert.ok(canvasView._liveGrad.isSnapped);
    assert.equal(Math.round(canvasView._liveGrad.x2), 100, 'X must snap to start X for 90°');
  });

  it('renders live gradient preview with elastic directional arrow and chevrons without error', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const canvasView = new CanvasView(session);

    // Linear drag
    canvasView._liveGrad = { x1: 50, y1: 50, x2: 250, y2: 150, isSnapped: false };
    assert.doesNotThrow(() => {
      canvasView._renderLiveGradientPreview(canvasView.ctx, session.document);
    });

    // Radial drag with snapped gold arrow
    session.gradientType = 'radial';
    canvasView._liveGrad = { x1: 200, y1: 200, x2: 300, y2: 300, isSnapped: true };
    assert.doesNotThrow(() => {
      canvasView._renderLiveGradientPreview(canvasView.ctx, session.document);
    });
  });
});
