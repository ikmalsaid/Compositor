// ─────────────────────────────────────────────────────────────────────────────
// tests/transform.test.js  —  Unit tests for LayerTransform & Geometry calculations
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { LayerTransform } from '../src/store/document.js';

describe('LayerTransform & Geometry', () => {
  it('computes center points cx, cy and bounding boxes correctly', () => {
    const t = new LayerTransform({ x: 100, y: 200, w: 400, h: 300, rotation: 0 });
    assert.equal(t.cx, 300);
    assert.equal(t.cy, 350);
    assert.deepEqual(t.bounds, { x: 100, y: 200, w: 400, h: 300 });
  });

  it('tests point containment (contains) on unrotated transform', () => {
    const t = new LayerTransform({ x: 50, y: 50, w: 100, h: 100, rotation: 0 });
    assert.equal(t.contains(100, 100), true);
    assert.equal(t.contains(50, 50), true);
    assert.equal(t.contains(150, 150), true);
    assert.equal(t.contains(40, 100), false);
    assert.equal(t.contains(160, 100), false);
    assert.equal(t.contains(100, 160), false);
  });

  it('tests point containment (contains) on 45-degree rotated transform', () => {
    const t = new LayerTransform({ x: 100, y: 100, w: 100, h: 100, rotation: 45 });
    // Center is (150, 150)
    assert.equal(t.contains(150, 150), true);
    // At 45 degrees, diamond vertex extends along Y axis
    const halfDiag = (100 / 2) * Math.SQRT2;
    assert.equal(t.contains(150, 150 - halfDiag + 1), true);
    assert.equal(t.contains(150, 150 - halfDiag - 10), false);
  });

  it('preserves flipX and flipY non-destructive flags on clone', () => {
    const t1 = new LayerTransform({ x: 0, y: 0, w: 200, h: 200, flipX: true, flipY: false });
    assert.equal(t1.flipX, true);
    assert.equal(t1.flipY, false);

    const t2 = t1.clone();
    assert.equal(t2.flipX, true);
    assert.equal(t2.flipY, false);
    assert.equal(t2.w, 200);

    t2.flipY = true;
    assert.equal(t2.flipY, true);
    assert.equal(t1.flipY, false); // independent clone
  });

  it('correctly calculates angle snapping for cardinal, 45-degree, and shift-key constraints', () => {
    function computeSnappedRotation(rawAngle, shiftKey, snapToGuides = true) {
      let newRot = (rawAngle % 360 + 360) % 360;
      let isSnapped = false;
      if (shiftKey) {
        newRot = Math.round(newRot / 15) * 15;
        isSnapped = true;
      } else if (snapToGuides) {
        const snapAngles = [0, 45, 90, 135, 180, 225, 270, 315, 360];
        const snapTolerance = 3.0;
        for (const targetAngle of snapAngles) {
          const diff = Math.abs(newRot - targetAngle);
          if (diff <= snapTolerance || Math.abs(newRot - (targetAngle - 360)) <= snapTolerance) {
            newRot = targetAngle % 360;
            isSnapped = true;
            break;
          }
        }
      }
      newRot = ((newRot % 360) + 360) % 360;
      if (newRot < 0.05 || newRot > 359.95) newRot = 0;
      return { rotation: Math.round(newRot * 10) / 10, isSnapped };
    }

    // Near 0 degrees
    assert.deepEqual(computeSnappedRotation(1.8, false), { rotation: 0, isSnapped: true });
    assert.deepEqual(computeSnappedRotation(358.5, false), { rotation: 0, isSnapped: true });

    // Near 45 degrees
    assert.deepEqual(computeSnappedRotation(46.2, false), { rotation: 45, isSnapped: true });
    assert.deepEqual(computeSnappedRotation(43.1, false), { rotation: 45, isSnapped: true });

    // Free angle away from snap zones
    assert.deepEqual(computeSnappedRotation(23.4, false), { rotation: 23.4, isSnapped: false });

    // Shift key constraint to 15-degree steps
    assert.deepEqual(computeSnappedRotation(23.4, true), { rotation: 30, isSnapped: true });
    assert.deepEqual(computeSnappedRotation(7, true), { rotation: 0, isSnapped: true });
    assert.deepEqual(computeSnappedRotation(8, true), { rotation: 15, isSnapped: true });
  });
});
