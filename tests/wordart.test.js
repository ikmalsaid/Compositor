// ─────────────────────────────────────────────────────────────────────────────
// tests/wordart.test.js  —  Unit tests for WordArt Retro Templates & Warp Engine
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { WORDART_TEMPLATES, renderWordArtToCanvas, renderWordArtCanvas } from '../src/assets/wordartTemplates.js';
import { EditorSession } from '../src/store/session.js';

describe('WordArt Retro Templates & Warp Engine', () => {
  it('contains at least 20 iconic retro WordArt style presets', () => {
    assert.ok(Array.isArray(WORDART_TEMPLATES));
    assert.ok(WORDART_TEMPLATES.length >= 20, `Expected at least 20 templates, got ${WORDART_TEMPLATES.length}`);

    const ids = new Set();
    for (const t of WORDART_TEMPLATES) {
      assert.ok(t.id, 'Template must have id');
      assert.ok(!ids.has(t.id), `Duplicate template id: ${t.id}`);
      ids.add(t.id);
      assert.ok(t.name, `Template ${t.id} must have a name`);
      assert.ok(t.warp, `Template ${t.id} must define a default warp shape`);
      assert.ok(typeof t.depth === 'number', `Template ${t.id} must define depth`);
    }
  });

  it('includes iconic Rainbow WordArt presets with multi-point color spectrums', () => {
    const rainbowTemplates = WORDART_TEMPLATES.filter(t => t.id.startsWith('rainbow-') || t.category === 'rainbow');
    assert.ok(rainbowTemplates.length >= 4, `Expected at least 4 rainbow templates, got ${rainbowTemplates.length}`);

    const arch = WORDART_TEMPLATES.find(t => t.id === 'rainbow-arch');
    assert.ok(arch, 'Must have classic rainbow arch template');
    assert.equal(arch.warpType, 'arch-up');
    assert.equal(arch.colors.length, 7);

    const wave = WORDART_TEMPLATES.find(t => t.id === 'rainbow-wave');
    assert.ok(wave, 'Must have rainbow wave template');
    assert.equal(wave.warpType, 'wave');
    assert.equal(wave.colors.length, 7);

    const extrude = WORDART_TEMPLATES.find(t => t.id === 'rainbow-3d-extrude');
    assert.ok(extrude, 'Must have 3D rainbow extrude template');
    assert.ok(extrude.depth3D >= 12);
  });

  it('renders text with templates to offscreen canvas', () => {
    const text = 'RETRO 90S';
    for (const t of WORDART_TEMPLATES.slice(0, 5)) {
      const canvas = renderWordArtToCanvas(text, t.id, {
        fontSize: 72,
        fontFamily: 'Impact',
        depth: t.depth,
        warp: t.warp,
      });

      assert.ok(canvas, `Canvas must be rendered for template ${t.id}`);
      assert.ok(canvas.width > 0, `Canvas width must be > 0 for ${t.id}`);
      assert.ok(canvas.height > 0, `Canvas height must be > 0 for ${t.id}`);
    }
  });

  it('renders custom multi-point gradients with arbitrary angles', () => {
    const canvas = renderWordArtCanvas({
      text: 'RAINBOW SPECTRUM',
      templateId: 'rainbow-arch',
      fontSize: 60,
      fillType: 'gradient',
      gradientAngle: 45,
      gradientStops: [
        { offset: 0.0, color: '#ff0000' },
        { offset: 0.2, color: '#ff7700' },
        { offset: 0.4, color: '#ffff00' },
        { offset: 0.6, color: '#00dd44' },
        { offset: 0.8, color: '#00bbff' },
        { offset: 1.0, color: '#aa00ff' },
      ],
      warpType: 'arch-up',
      warpAmount: 20,
      depth3D: 6,
    });

    assert.ok(canvas, 'Canvas must render for custom multi-point gradient');
    assert.ok(canvas.width > 100);
    assert.ok(canvas.height > 50);
  });

  it('renders solid color fill cleanly without gradient confusion', () => {
    const canvas = renderWordArtCanvas({
      text: 'SOLID COLOR',
      templateId: 'rainbow-arch',
      fontSize: 50,
      fillType: 'solid',
      fillColor: '#ff0055',
      warpType: 'none',
      depth3D: 0,
    });

    assert.ok(canvas, 'Canvas must render for solid color fill');
    assert.ok(canvas.width > 50);
    assert.ok(canvas.height > 20);
  });

  it('inserts rendered WordArt into EditorSession as a dedicated raster layer', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1600, 900);
    const startCount = session.document.layers.length;

    const canvas = renderWordArtToCanvas('COMPOSITOR', 'rainbow-wave', {
      fontSize: 64,
      fontFamily: 'Impact',
      depth: 6,
      warp: 'wave',
    });

    const newLayer = session.insertWordArt(canvas, 'COMPOSITOR', {
      templateId: 'rainbow-wave',
      warp: 'wave',
    });

    assert.ok(newLayer, 'WordArt layer must be returned');
    assert.equal(session.document.layers.length, startCount + 1);
    assert.equal(newLayer.name, 'WordArt (COMPOSITOR)');
    assert.equal(session.activeLayerId, newLayer.id);
    assert.ok(newLayer.transform.w > 0);
    assert.ok(newLayer.transform.h > 0);
  });
});
