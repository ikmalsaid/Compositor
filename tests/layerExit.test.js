// ─────────────────────────────────────────────────────────────────────────────
// tests/layerExit.test.js  —  Unit tests for Canvas-Sized New Layers & Exit Prompt
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/store/session.js';

describe('Manual Add New Layer Canvas Size & Exit Prompt Behavior', () => {
  it('manually added blank layer defaults to exact canvas size at (0, 0)', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1920, 1080);

    const layer1 = session.addBlankLayer();
    assert.ok(layer1);
    assert.equal(layer1.pixelW, 1920);
    assert.equal(layer1.pixelH, 1080);
    assert.equal(layer1.transform.x, 0);
    assert.equal(layer1.transform.y, 0);
    assert.equal(layer1.transform.w, 1920);
    assert.equal(layer1.transform.h, 1080);
    assert.equal(layer1.name, 'Layer 1');

    const layer2 = session.addBlankLayer();
    assert.ok(layer2);
    assert.equal(layer2.pixelW, 1920);
    assert.equal(layer2.pixelH, 1080);
    assert.equal(layer2.name, 'Layer 2');
  });

  it('custom canvas size creates blank layer matching that canvas size', () => {
    const session = new EditorSession();
    session.createDefaultDocument(3840, 2160);

    const layer = session.addBlankLayer();
    assert.equal(layer.pixelW, 3840);
    assert.equal(layer.pixelH, 2160);
    assert.equal(layer.transform.w, 3840);
    assert.equal(layer.transform.h, 2160);
  });

  it('explicit bounds in opts are still respected if provided', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 1000);

    const layer = session.addBlankLayer('Card', { x: 150, y: 200, w: 300, h: 400 });
    assert.equal(layer.transform.x, 150);
    assert.equal(layer.transform.y, 200);
    assert.equal(layer.transform.w, 300);
    assert.equal(layer.transform.h, 400);
    assert.equal(layer.pixelW, 300);
    assert.equal(layer.pixelH, 400);
    assert.equal(layer.name, 'Card');
  });
});
