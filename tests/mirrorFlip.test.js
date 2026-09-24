// ─────────────────────────────────────────────────────────────────────────────
// tests/mirrorFlip.test.js  —  Unit tests for Layer Flip & Mirror Duplication
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/store/session.js';
import { LayerTransform } from '../src/store/document.js';

describe('Layer Flip & Symmetrical Mirroring', () => {
  it('toggles horizontal and vertical flip flags in place', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Sprite');

    assert.equal(layer.transform.flipX, false);
    assert.equal(layer.transform.flipY, false);

    session.flipLayerH(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipX, true);

    session.flipLayerH(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipX, false);

    session.flipLayerV(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipY, true);

    session.flipLayerV(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipY, false);
  });

  it('creates symmetrical horizontal mirror duplicate with inverted flipX and position offset', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    const layer = session.addBlankLayer('Character');
    session.setLayerTransform(layer.id, new LayerTransform({ x: 100, y: 150, w: 200, h: 300, flipX: false }));

    const initialCount = session.document.layers.length;
    const mirrorLayer = session.mirrorLayerH(layer.id, 'offset');

    assert.ok(mirrorLayer, 'Mirror layer must be created');
    assert.equal(session.document.layers.length, initialCount + 1);
    assert.equal(mirrorLayer.name, 'Character (Mirror H)');
    assert.equal(mirrorLayer.transform.flipX, true, 'Mirror layer must invert flipX');
    assert.equal(mirrorLayer.transform.y, 150, 'Y position must be preserved');
    assert.equal(mirrorLayer.transform.x, 320, 'X position should be offset by w + 20px padding');
    assert.equal(session.activeLayerId, mirrorLayer.id, 'New mirror layer should be selected');
  });

  it('creates symmetrical vertical mirror duplicate with inverted flipY and position offset', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    const layer = session.addBlankLayer('Water Reflection');
    session.setLayerTransform(layer.id, new LayerTransform({ x: 200, y: 100, w: 400, h: 250, flipY: false }));

    const mirrorLayer = session.mirrorLayerV(layer.id, 'offset');

    assert.ok(mirrorLayer);
    assert.equal(mirrorLayer.name, 'Water Reflection (Mirror V)');
    assert.equal(mirrorLayer.transform.flipY, true, 'Mirror layer must invert flipY');
    assert.equal(mirrorLayer.transform.x, 200, 'X position must be preserved');
    assert.equal(mirrorLayer.transform.y, 370, 'Y position should be offset by h + 20px padding');
  });

  it('creates in-place mirror duplicate when requested', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    const layer = session.addBlankLayer('Emblem');
    session.setLayerTransform(layer.id, new LayerTransform({ x: 300, y: 200, w: 100, h: 100, flipX: false }));

    const mirrorLayer = session.mirrorLayerH(layer.id, 'in-place');
    assert.ok(mirrorLayer);
    assert.equal(mirrorLayer.transform.x, 300, 'In-place mirror should maintain exact same X');
    assert.equal(mirrorLayer.transform.flipX, true, 'FlipX should still be inverted');
  });

  it('correctly tracks mirror duplicate creation in history for undo/redo', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Wing');
    const startCount = session.document.layers.length;

    const mirror = session.mirrorLayerH(layer.id);
    assert.equal(session.document.layers.length, startCount + 1);

    session.undo();
    assert.equal(session.document.layers.length, startCount);
    assert.equal(session.document.layerByID(mirror.id), null);

    session.redo();
    assert.equal(session.document.layers.length, startCount + 1);
    assert.ok(session.document.layerByID(mirror.id));
  });
});
