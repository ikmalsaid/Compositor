// ─────────────────────────────────────────────────────────────────────────────
// tests/clipart.test.js  —  Unit tests for Clipart Gallery & SVG Engine
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import {
  BUILTIN_CLIPARTS,
  CLIPART_CATEGORIES,
  getCustomCliparts,
  addCustomClipart,
  removeCustomClipart,
  getAllCliparts
} from '../src/assets/clipartData.js';
import { EditorSession } from '../src/store/session.js';

describe('Clipart Gallery & SVG Vectors', () => {
  it('contains the complete comprehensive library of 3,000+ built-in SVG clipart items across all categories', () => {
    assert.ok(Array.isArray(BUILTIN_CLIPARTS), 'BUILTIN_CLIPARTS must be an array');
    assert.ok(BUILTIN_CLIPARTS.length >= 3000, `Expected at least 3,000 cliparts, got ${BUILTIN_CLIPARTS.length}`);

    const categories = new Set(BUILTIN_CLIPARTS.map(c => c.category));
    assert.ok(categories.has('tech'), 'Should have tech category');
    assert.ok(categories.has('office'), 'Should have office category');
    assert.ok(categories.has('school'), 'Should have school category');
    assert.ok(categories.has('banners'), 'Should have banners category');
    assert.ok(categories.has('bubbles'), 'Should have bubbles category');
    assert.ok(categories.has('characters'), 'Should have characters category');
    assert.ok(categories.has('symbols'), 'Should have symbols category');
    assert.ok(categories.has('nature'), 'Should have nature category');
    assert.ok(categories.has('food'), 'Should have food category');
    assert.ok(categories.has('vehicles'), 'Should have vehicles category');
    assert.ok(categories.has('music'), 'Should have music category');
    assert.ok(categories.has('retro'), 'Should have retro category');
  });

  it('includes vibrant multi-arc Rainbow clipart with fluffy clouds and sun rays', () => {
    const rainbow = BUILTIN_CLIPARTS.find(c => c.id === 'nature-rainbow');
    assert.ok(rainbow, 'Must contain nature-rainbow clipart');
    assert.ok(rainbow.tags.includes('rainbow'), 'Tags must contain rainbow');
    assert.ok(rainbow.tags.includes('clouds'), 'Tags must contain clouds');
    assert.ok(rainbow.svg.includes('linearGradient id="cloudGrad"'), 'Must have gradient clouds');
    assert.ok(rainbow.svg.includes('stroke="#ff2a4b"'), 'Must have vibrant rainbow arcs');
  });

  it('verifies that cliparts integrate with the @iconify-json/fluent-emoji npm package', () => {
    const packageJsonPath = path.resolve('package.json');
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    assert.ok(pkg.dependencies['@iconify-json/fluent-emoji'], 'Must have @iconify-json/fluent-emoji dependency in package.json');
    assert.ok(pkg.scripts['update-cliparts'], 'Must have update-cliparts script in package.json');

    for (const item of BUILTIN_CLIPARTS) {
      assert.ok(item.id, 'Clipart must have id');
      assert.ok(item.fluentIcon || item.id === 'nature-rainbow', `Clipart ${item.id} must reference a fluent-emoji icon or benchmark`);
      assert.ok(item.svg, `Clipart ${item.id} must have rendered SVG markup`);
      assert.ok(item.svg.startsWith('<svg') && item.svg.endsWith('</svg>'), `Clipart ${item.id} must contain well-formed <svg> tags`);
    }
  });

  it('verifies that all clipart items have valid IDs, names, tags, and SVG markup', () => {
    const ids = new Set();
    for (const item of BUILTIN_CLIPARTS) {
      assert.ok(item.id, 'Clipart must have id');
      assert.ok(!ids.has(item.id), `Duplicate clipart id: ${item.id}`);
      ids.add(item.id);

      assert.ok(item.name, `Clipart ${item.id} must have a name`);
      assert.ok(Array.isArray(item.tags), `Clipart ${item.id} must have tags array`);
      assert.ok(item.tags.length > 0, `Clipart ${item.id} must have at least 1 tag`);
      assert.ok(item.svg, `Clipart ${item.id} must have svg markup`);
      assert.ok(item.svg.startsWith('<svg') && item.svg.endsWith('</svg>'), `Clipart ${item.id} must contain well-formed <svg> tags`);
    }
  });

  it('manages custom imported cliparts with persistent storage and removal', () => {
    const initialCount = getCustomCliparts().length;
    const testSvg = '<svg viewBox="0 0 50 50" xmlns="http://www.w3.org/2000/svg"><circle cx="25" cy="25" r="20" fill="gold"/></svg>';
    const added = addCustomClipart({
      name: 'Test Golden Badge',
      svg: testSvg,
      tags: ['custom', 'test']
    });

    assert.ok(added, 'Must return added custom clipart object');
    assert.ok(added.id.startsWith('custom-'), 'ID must start with custom-');
    assert.equal(added.name, 'Test Golden Badge');
    assert.equal(added.isCustom, true);

    const customList = getCustomCliparts();
    assert.equal(customList.length, initialCount + 1);
    assert.equal(customList[0].id, added.id);

    const allList = getAllCliparts();
    assert.ok(allList.some(item => item.id === added.id), 'getAllCliparts must include custom item');

    removeCustomClipart(added.id);
    const updatedCustom = getCustomCliparts();
    assert.equal(updatedCustom.length, initialCount);
    assert.ok(!updatedCustom.some(item => item.id === added.id));
  });

  it('inserts clipart as a new layer in EditorSession with centering and transforms', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1200, 800);
    const startLayers = session.document.layers.length;

    const sample = BUILTIN_CLIPARTS[0];
    const newLayer = session.insertClipart(sample.svg, sample.name, { width: 300, height: 300 });

    assert.ok(newLayer, 'Clipart layer must be returned');
    assert.equal(session.document.layers.length, startLayers + 1);
    assert.equal(newLayer.name, sample.name);
    assert.equal(newLayer.transform.w, 300);
    assert.equal(newLayer.transform.h, 300);
    assert.equal(newLayer.transform.x, (1200 - 300) / 2);
    assert.equal(newLayer.transform.y, (800 - 300) / 2);
    assert.equal(session.activeLayerId, newLayer.id);
  });
});
