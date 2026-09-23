// ─────────────────────────────────────────────────────────────────────────────
// tests/document.test.js  —  Unit tests for Document & ImageLayer model
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Document,
  ImageLayer,
  LayerTransform,
  LayerBlendMode,
  blendModeToCompositeOp
} from '../src/store/document.js';

describe('Document Model', () => {
  it('creates a Document with specified dimensions and name', () => {
    const bgLayer = new ImageLayer({ name: 'Background', pixelW: 1920, pixelH: 1080 });
    const doc = new Document({ width: 1920, height: 1080, name: 'Test Canvas', layers: [bgLayer] });
    assert.equal(doc.width, 1920);
    assert.equal(doc.height, 1080);
    assert.equal(doc.name, 'Test Canvas');
    assert.equal(doc.layers.length, 1);
    assert.equal(doc.layers[0].name, 'Background');
    assert.equal(doc.layers[0].pixelW, 1920);
    assert.equal(doc.layers[0].pixelH, 1080);
  });

  it('supports all 13 blend modes mapped to standard Canvas composite operations', () => {
    assert.equal(LayerBlendMode.ALL.length, 13);
    assert.equal(blendModeToCompositeOp('Multiply'), 'multiply');
    assert.equal(blendModeToCompositeOp('Screen'), 'screen');
    assert.equal(blendModeToCompositeOp('Overlay'), 'overlay');
    assert.equal(blendModeToCompositeOp('Darken'), 'darken');
    assert.equal(blendModeToCompositeOp('Lighten'), 'lighten');
    assert.equal(blendModeToCompositeOp('Difference'), 'difference');
    assert.equal(blendModeToCompositeOp('Color Dodge'), 'color-dodge');
    assert.equal(blendModeToCompositeOp('Color Burn'), 'color-burn');
    assert.equal(blendModeToCompositeOp('Hue'), 'hue');
    assert.equal(blendModeToCompositeOp('Saturation'), 'saturation');
    assert.equal(blendModeToCompositeOp('Color'), 'color');
    assert.equal(blendModeToCompositeOp('Luminosity'), 'luminosity');
    assert.equal(blendModeToCompositeOp('Normal'), 'source-over');
  });

  it('adds and removes layers correctly', () => {
    const doc = new Document({ width: 800, height: 600 });
    const layer1 = new ImageLayer({ name: 'Layer 1', pixelW: 400, pixelH: 300 });
    doc.addLayer(layer1);
    assert.equal(doc.layers.length, 1);
    assert.equal(doc.layerByID(layer1.id), layer1);

    doc.removeLayer(layer1.id);
    assert.equal(doc.layers.length, 0);
    assert.equal(doc.layerByID(layer1.id), null);
  });

  it('reorders layers with moveLayer', () => {
    const doc = new Document({ width: 800, height: 600 });
    const l1 = new ImageLayer({ name: 'L1' });
    const l2 = new ImageLayer({ name: 'L2' });
    doc.addLayer(l1);
    doc.addLayer(l2);
    // order: [L1, L2]
    assert.equal(doc.layers[0].name, 'L1');
    assert.equal(doc.layers[1].name, 'L2');

    doc.moveLayer(l2.id, 0);
    // order: [L2, L1]
    assert.equal(doc.layers[0].name, 'L2');
    assert.equal(doc.layers[1].name, 'L1');
  });

  it('supports group layers and parent-child hierarchy', () => {
    const doc = new Document({ width: 800, height: 600 });
    const group = new ImageLayer({ name: 'Group 1', isGroup: true });
    doc.addLayer(group);
    const child = new ImageLayer({ name: 'Child Layer', parentID: group.id });
    doc.addLayer(child);

    assert.equal(group.isGroup, true);
    assert.equal(child.parentID, group.id);
    assert.equal(doc.childLayersOf(group.id).length, 1);
    assert.equal(doc.childLayersOf(group.id)[0].id, child.id);
  });

  it('clones a Document and its raster layers accurately', () => {
    const doc = new Document({ width: 1000, height: 800, name: 'Original' });
    const l = new ImageLayer({ name: 'Photo', opacity: 0.8, isLocked: true });
    doc.addLayer(l);

    const clone = doc.clone();
    assert.equal(clone.width, 1000);
    assert.equal(clone.height, 800);
    assert.equal(clone.name, 'Original');
    assert.equal(clone.layers.length, 1);
    assert.equal(clone.layers[0].name, 'Photo');
    assert.equal(clone.layers[0].opacity, 0.8);
    assert.equal(clone.layers[0].isLocked, true);
  });
});
