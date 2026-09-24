// ─────────────────────────────────────────────────────────────────────────────
// tests/bucket.test.js  —  Unit tests for Paint Bucket Flood Fill Engine
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession, Tool } from '../src/store/session.js';
import { CanvasView } from '../src/ui/canvas.js';

describe('Paint Bucket Tool & Color Replacement Engine', () => {
  it('fills contiguous region of matching color with target color', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;
    session.bucketContiguous = true;
    session.bucketTolerance = 32;

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    const ctx = layer.ctx;

    // Fill white
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);

    // Draw two separate red squares
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 10, 30, 30);
    ctx.fillRect(60, 60, 30, 30);

    // Fill first red square with blue
    session.setFgColor('#0000ff');
    canvasView._performBucketFill(20, 20);

    const p1 = Array.from(ctx.getImageData(20, 20, 1, 1).data);
    const p2 = Array.from(ctx.getImageData(70, 70, 1, 1).data);
    const bg = Array.from(ctx.getImageData(5, 5, 1, 1).data);

    assert.deepEqual(p1, [0, 0, 255, 255], 'Clicked red square should change to blue');
    assert.deepEqual(p2, [255, 0, 0, 255], 'Separate disconnected red square should remain red in contiguous mode');
    assert.deepEqual(bg, [255, 255, 255, 255], 'Background should remain white');
  });

  it('replaces all matching pixels across layer when contiguous is false', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;
    session.bucketContiguous = false;
    session.bucketTolerance = 32;

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    const ctx = layer.ctx;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);

    // Draw two separate red squares
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(10, 10, 30, 30);
    ctx.fillRect(60, 60, 30, 30);

    // Non-contiguous fill: both red squares should turn green
    session.setFgColor('#00ff00');
    canvasView._performBucketFill(20, 20);

    const p1 = Array.from(ctx.getImageData(20, 20, 1, 1).data);
    const p2 = Array.from(ctx.getImageData(70, 70, 1, 1).data);
    const bg = Array.from(ctx.getImageData(5, 5, 1, 1).data);

    assert.deepEqual(p1, [0, 255, 0, 255], 'First red square must be green');
    assert.deepEqual(p2, [0, 255, 0, 255], 'Second red square must also be green in non-contiguous mode');
    assert.deepEqual(bg, [255, 255, 255, 255], 'Background must remain white');
  });

  it('accurately parses 3-character hex shorthand (#fff, #f00) without color distortion', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    const canvasView = new CanvasView(session);

    assert.deepEqual(canvasView._hexToRgbArray('#fff'), [255, 255, 255], '#fff must parse to [255, 255, 255]');
    assert.deepEqual(canvasView._hexToRgbArray('#f00'), [255, 0, 0], '#f00 must parse to [255, 0, 0]');
    assert.deepEqual(canvasView._hexToRgbArray('#0f0'), [0, 255, 0], '#0f0 must parse to [0, 255, 0]');
    assert.deepEqual(canvasView._hexToRgbArray('#00f'), [0, 0, 255], '#00f must parse to [0, 0, 255]');
    assert.deepEqual(canvasView._hexToRgbArray('#123456'), [18, 52, 86], '#123456 must parse accurately');
    assert.deepEqual(canvasView._hexToRgbArray('rgb(10, 20, 30)'), [10, 20, 30], 'rgb() string must parse accurately');
  });

  it('correctly treats all transparent pixels as matching color regardless of residual RGB', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;
    session.bucketContiguous = true;

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    const ctx = layer.ctx;

    // Put a transparent pixel with non-zero RGB (like residual eraser data) at (25, 25)
    const imgData = ctx.getImageData(0, 0, 100, 100);
    imgData.data[(25 * 100 + 25) * 4] = 255;
    imgData.data[(25 * 100 + 25) * 4 + 1] = 255;
    imgData.data[(25 * 100 + 25) * 4 + 2] = 255;
    imgData.data[(25 * 100 + 25) * 4 + 3] = 0; // alpha = 0
    ctx.putImageData(imgData, 0, 0);

    session.setFgColor('#ff00ff');
    canvasView._performBucketFill(10, 10);

    const filledPixel = Array.from(ctx.getImageData(25, 25, 1, 1).data);
    assert.deepEqual(filledPixel, [255, 0, 255, 255], 'Transparent pixel with residual RGB must be matched and filled');
  });

  it('respects bucketOpacity setting independently from brushOpacity', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;
    session.brushOpacity = 0.2; // simulate brush opacity adjusted down
    session.bucketOpacity = 1.0; // bucket opacity remains 100%

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    session.setFgColor('#00ffff');
    canvasView._performBucketFill(50, 50);

    const filledPixel = Array.from(layer.ctx.getImageData(50, 50, 1, 1).data);
    assert.equal(filledPixel[3], 255, 'Bucket fill must use bucketOpacity 1.0 (255) rather than brushOpacity 0.2');
  });

  it('constrains bucket fill to active rectangular selection', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;
    session.bucketContiguous = false;

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    const ctx = layer.ctx;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 100, 100);

    // Set selection from (20, 20) to (50, 50)
    session.setSelection({ x: 20, y: 20, w: 30, h: 30 });
    session.setFgColor('#ff0000');
    canvasView._performBucketFill(25, 25);

    const inside = Array.from(ctx.getImageData(25, 25, 1, 1).data);
    const outside = Array.from(ctx.getImageData(5, 5, 1, 1).data);

    assert.deepEqual(inside, [255, 0, 0, 255], 'Inside selection must be filled');
    assert.deepEqual(outside, [255, 255, 255, 255], 'Outside selection must remain unchanged');
  });

  it('no-ops without recording history when fill color is already identical to clicked pixel', () => {
    const session = new EditorSession();
    session.createDefaultDocument(100, 100);
    session.bucketSampleAll = false;

    const canvasView = new CanvasView(session);
    if (canvasView.area) {
      canvasView.area.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 600 });
    }

    const layer = session.addBlankLayer('ArtLayer');
    layer.ctx.fillStyle = '#0000ff';
    layer.ctx.fillRect(0, 0, 100, 100);

    const undoCountBefore = session.history.undoCount;
    session.setFgColor('#0000ff'); // identical to existing blue
    canvasView._performBucketFill(50, 50);

    assert.equal(session.history.undoCount, undoCountBefore, 'Should not push history when filling with identical color');
  });
});
