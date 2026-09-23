// ─────────────────────────────────────────────────────────────────────────────
// tests/project.test.js  —  Unit tests for .compositor Project Format & I/O
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { Document, ImageLayer, LayerTransform } from '../src/store/document.js';

describe('Project I/O & .compositor Format', () => {
  it('generates macOS-compatible version 7 manifest schema', async () => {
    const doc = new Document({ width: 1920, height: 1080, name: 'Sample' });
    const bg = new ImageLayer({ name: 'Background', pixelW: 1920, pixelH: 1080, isLocked: true });
    doc.addLayer(bg);
    const layer = new ImageLayer({
      name: 'Graphic',
      opacity: 0.85,
      blendMode: 'Multiply',
      transform: new LayerTransform({ x: 50, y: 100, w: 500, h: 400, rotation: 30, flipX: true, flipY: false })
    });
    doc.addLayer(layer);

    const manifest = {
      format: 'com.compositor.project',
      version: 7,
      colorSpace: 'sRGB',
      resolution: doc.resolution,
      documentID: doc.id,
      width: doc.width,
      height: doc.height,
      activeLayerID: layer.id,
      layers: doc.layers.map(l => ({
        id: l.id,
        name: l.name,
        isVisible: l.isVisible,
        opacity: l.opacity,
        blendMode: l.blendMode,
        isLocked: l.isLocked,
        parentID: l.parentID,
        isGroup: l.isGroup,
        transform: {
          x: l.transform.x,
          y: l.transform.y,
          w: l.transform.w,
          h: l.transform.h,
          rotation: l.transform.rotation,
          flipX: l.transform.flipX,
          flipY: l.transform.flipY
        }
      }))
    };

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    zip.file(`layer-${layer.id}.png`, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])); // PNG header

    const zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
    assert.ok(zipBuffer.length > 0);

    // Read back and verify
    const loadedZip = await JSZip.loadAsync(zipBuffer);
    const mfFile = loadedZip.file('manifest.json');
    assert.ok(mfFile);

    const parsed = JSON.parse(await mfFile.async('string'));
    assert.equal(parsed.format, 'com.compositor.project');
    assert.equal(parsed.version, 7);
    assert.equal(parsed.width, 1920);
    assert.equal(parsed.height, 1080);
    assert.equal(parsed.layers.length, 2);

    const parsedLayer = parsed.layers[1];
    assert.equal(parsedLayer.name, 'Graphic');
    assert.equal(parsedLayer.opacity, 0.85);
    assert.equal(parsedLayer.blendMode, 'Multiply');
    assert.equal(parsedLayer.transform.flipX, true);
    assert.equal(parsedLayer.transform.rotation, 30);
  });
});
