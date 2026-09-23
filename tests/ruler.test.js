// ─────────────────────────────────────────────────────────────────────────────
// tests/ruler.test.js  —  Unit tests for RulerView & Snapping Engine
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RulerView } from '../src/ui/ruler.js';
import { EditorSession } from '../src/store/session.js';

describe('Ruler & Smart Snapping Engine', () => {
  function createMockCanvasView(session, scale = 1) {
    return {
      session,
      scale,
      tx: 100,
      ty: 100,
      area: {
        clientWidth: 1280,
        clientHeight: 800,
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 800 })
      },
      screenToDoc: (sx, sy) => [(sx - 100) / scale, (sy - 100) / scale]
    };
  }

  it('snaps object left edge to canvas boundary X=0 within tolerance', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1920, 1080);
    session.snapToGuides = true;

    const canvasView = createMockCanvasView(session);
    const ruler = new RulerView(canvasView, session);

    // Object placed at x = 3 (within tolerance of 0)
    const result = ruler.snapRect(3, 100, 200, 200);
    assert.equal(result.snapX, 0);
    assert.equal(result.snapY, 100);
    assert.deepEqual(result.guideLinesX, [0]);
  });

  it('snaps object right edge to canvas boundary X=doc.width', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    session.snapToGuides = true;

    const canvasView = createMockCanvasView(session);
    const ruler = new RulerView(canvasView, session);

    // Object width 200 placed at x = 798 -> right edge is 998 (close to 1000)
    const result = ruler.snapRect(798, 50, 200, 100);
    assert.equal(result.snapX, 800); // 800 + 200 = 1000
    assert.deepEqual(result.guideLinesX, [1000]);
  });

  it('snaps object center to canvas center X=500', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    session.snapToGuides = true;

    const canvasView = createMockCanvasView(session);
    const ruler = new RulerView(canvasView, session);

    // Object width 200 placed at x = 398 -> center is 498 (close to 500)
    const result = ruler.snapRect(398, 50, 200, 100);
    assert.equal(result.snapX, 400); // 400 + 200/2 = 500
    assert.deepEqual(result.guideLinesX, [500]);
  });

  it('snaps object to custom horizontal and vertical guides', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1920, 1080);
    session.snapToGuides = true;
    session.guides.vertical = [350];
    session.guides.horizontal = [420];

    const canvasView = createMockCanvasView(session);
    const ruler = new RulerView(canvasView, session);

    // Object near guide x=350 and guide y=420
    const result = ruler.snapRect(352, 418, 100, 100);
    assert.equal(result.snapX, 350);
    assert.equal(result.snapY, 420);
    assert.deepEqual(result.guideLinesX, [350]);
    assert.deepEqual(result.guideLinesY, [420]);
  });

  it('ignores snapping when snapToGuides is disabled', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    session.snapToGuides = false;

    const canvasView = createMockCanvasView(session);
    const ruler = new RulerView(canvasView, session);

    const result = ruler.snapRect(3, 4, 100, 100);
    assert.equal(result.snapX, 3);
    assert.equal(result.snapY, 4);
    assert.deepEqual(result.guideLinesX, []);
    assert.deepEqual(result.guideLinesY, []);
  });
});
