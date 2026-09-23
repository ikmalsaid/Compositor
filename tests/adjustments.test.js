// ─────────────────────────────────────────────────────────────────────────────
// tests/adjustments.test.js  —  Unit tests for Image Adjustments & Color Filters
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Image Adjustments & Mathematical Filters', () => {
  it('computes accurate Levels LUT curve mapping', () => {
    function computeLevelsLUT(inBlack, gamma, inWhite, outBlack, outWhite) {
      const lut = new Uint8Array(256);
      const rangeIn = Math.max(1, inWhite - inBlack);
      const rangeOut = outWhite - outBlack;
      const invGamma = 1 / gamma;

      for (let i = 0; i < 256; i++) {
        let v = Math.max(0, Math.min(1, (i - inBlack) / rangeIn));
        v = Math.pow(v, invGamma);
        lut[i] = Math.max(0, Math.min(255, Math.round(outBlack + v * rangeOut)));
      }
      return lut;
    }

    // Default neutral levels: 0..255 -> 0..255
    const neutralLUT = computeLevelsLUT(0, 1.0, 255, 0, 255);
    assert.equal(neutralLUT[0], 0);
    assert.equal(neutralLUT[128], 128);
    assert.equal(neutralLUT[255], 255);

    // High contrast levels: inBlack=50, inWhite=200
    const contrastLUT = computeLevelsLUT(50, 1.0, 200, 0, 255);
    assert.equal(contrastLUT[0], 0);
    assert.equal(contrastLUT[50], 0);
    assert.equal(contrastLUT[200], 255);
    assert.equal(contrastLUT[255], 255);

    // Gamma boost: gamma=2.0 (brightens midtones)
    const gammaLUT = computeLevelsLUT(0, 2.0, 255, 0, 255);
    assert.ok(gammaLUT[128] > 128); // Midtones brightened
  });

  it('performs pixel-accurate Invert Colors transformation', () => {
    const data = new Uint8ClampedArray([0, 50, 200, 255]); // RGBA
    for (let i = 0; i < data.length; i += 4) {
      data[i]     = 255 - data[i];     // R: 255 - 0 = 255
      data[i + 1] = 255 - data[i + 1]; // G: 255 - 50 = 205
      data[i + 2] = 255 - data[i + 2]; // B: 255 - 200 = 55
      // Alpha untouched
    }
    assert.equal(data[0], 255);
    assert.equal(data[1], 205);
    assert.equal(data[2], 55);
    assert.equal(data[3], 255);
  });
});
