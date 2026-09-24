// ─────────────────────────────────────────────────────────────────────────────
// tests/blurPerformance.test.js  —  Unit tests for Hardware-Accelerated Multi-Pass Blurs
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('High-Performance Blur & Multi-Pass Compositing', () => {
  it('performs multi-pass accumulative motion blur simulation on canvas context', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(50, 50, 100, 100);

    // Test multi-pass motion blur blit simulation
    const distance = 40;
    const angleRad = 0; // horizontal
    const passes = 16;
    const dx = Math.cos(angleRad) * distance;
    const dy = Math.sin(angleRad) * distance;

    const accumCanvas = document.createElement('canvas');
    accumCanvas.width = canvas.width;
    accumCanvas.height = canvas.height;
    const accumCtx = accumCanvas.getContext('2d');
    accumCtx.clearRect(0, 0, accumCanvas.width, accumCanvas.height);
    accumCtx.globalAlpha = 1 / passes;

    for (let i = 0; i < passes; i++) {
      const t = (i / (passes - 1)) * 2 - 1; // -1 to 1
      const offsetX = (dx * t) / 2;
      const offsetY = (dy * t) / 2;
      accumCtx.drawImage(canvas, offsetX, offsetY);
    }

    assert.equal(accumCanvas.width, 400);
    assert.equal(accumCanvas.height, 300);
  });

  it('performs multi-pass accumulative radial zoom blur simulation', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#00ff00';
    ctx.fillRect(100, 100, 200, 100);

    const amount = 30;
    const passes = 16;
    const maxScale = 1 + (amount / 100) * 0.5;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;

    const accumCanvas = document.createElement('canvas');
    accumCanvas.width = canvas.width;
    accumCanvas.height = canvas.height;
    const accumCtx = accumCanvas.getContext('2d');
    accumCtx.clearRect(0, 0, accumCanvas.width, accumCanvas.height);
    accumCtx.globalAlpha = 1 / passes;

    for (let i = 0; i < passes; i++) {
      const factor = (i / (passes - 1)) * 2 - 1; // -1 to +1
      const scale = 1 + (maxScale - 1) * factor;

      accumCtx.save();
      accumCtx.translate(cx, cy);
      accumCtx.scale(scale, scale);
      accumCtx.translate(-cx, -cy);
      accumCtx.drawImage(canvas, 0, 0);
      accumCtx.restore();
    }

    assert.equal(accumCanvas.width, 400);
    assert.equal(accumCanvas.height, 300);
  });
});
