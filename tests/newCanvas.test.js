// ─────────────────────────────────────────────────────────────────────────────
// tests/newCanvas.test.js  —  Unit Tests for Canva-Style Canvas Catalogue & Recents
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  PRESET_CATALOGUE,
  getDefaultCanvasSettings,
  saveDefaultCanvasSettings,
  getRecentCanvasSizes,
  addRecentCanvasSize,
  removeRecentCanvasSize,
} from '../src/ui/panels/newCanvas.js';

describe('New Canvas Catalogue & Recents Engine', () => {
  beforeEach(() => {
    global.localStorage.clear();
  });

  it('provides a comprehensive preset catalogue organized by categories', () => {
    assert(Array.isArray(PRESET_CATALOGUE));
    assert(PRESET_CATALOGUE.length >= 20);

    const categories = new Set(PRESET_CATALOGUE.map(p => p.category));
    assert(categories.has('popular'));
    assert(categories.has('social'));
    assert(categories.has('print'));
    assert(categories.has('screen'));
    assert(categories.has('photo'));

    for (const preset of PRESET_CATALOGUE) {
      assert(preset.id, 'Preset must have an id');
      assert(preset.label, 'Preset must have a label');
      assert(preset.w > 0, 'Preset width must be positive');
      assert(preset.h > 0, 'Preset height must be positive');
      assert(preset.ppi > 0, 'Preset ppi must be positive');
      assert(preset.ratio, 'Preset must specify an aspect ratio');
    }
  });

  it('saves and restores default canvas settings', () => {
    const customDefaults = {
      presetId: 'ig-post',
      label: 'Instagram Post',
      unit: 'px',
      width: 1080,
      height: 1080,
      ppi: 72,
      bgOption: 'transparent',
      customBgColor: '#ff0055',
    };

    const saved = saveDefaultCanvasSettings(customDefaults);
    assert.strictEqual(saved, true);

    const loaded = getDefaultCanvasSettings();
    assert.strictEqual(loaded.width, 1080);
    assert.strictEqual(loaded.height, 1080);
    assert.strictEqual(loaded.bgOption, 'transparent');
    assert.strictEqual(loaded.customBgColor, '#ff0055');
  });

  it('manages recents history and inserts new custom sizes at the top', () => {
    // Initial recents should return default recents
    const initialRecents = getRecentCanvasSizes();
    assert(initialRecents.length > 0);

    // Add a new custom size
    const customItem = {
      label: 'Custom Banner',
      w: 3200,
      h: 800,
      ppi: 144,
      isCustom: true,
      bgOption: 'black',
    };

    const updatedRecents = addRecentCanvasSize(customItem);
    assert.strictEqual(updatedRecents[0].w, 3200);
    assert.strictEqual(updatedRecents[0].h, 800);
    assert.strictEqual(updatedRecents[0].isCustom, true);
    assert.strictEqual(updatedRecents[0].desc, 'Custom Size');

    // Retrieve again from localStorage
    const reloaded = getRecentCanvasSizes();
    assert.strictEqual(reloaded[0].w, 3200);
    assert.strictEqual(reloaded[0].h, 800);
    assert.strictEqual(reloaded[0].isCustom, true);
  });

  it('removes individual items from recents history', () => {
    const item1 = { label: 'Size A', w: 500, h: 500, isCustom: true };
    const item2 = { label: 'Size B', w: 600, h: 600, isCustom: true };

    addRecentCanvasSize(item1);
    const withTwo = addRecentCanvasSize(item2);
    const topId = withTwo[0].id;

    const remaining = removeRecentCanvasSize(topId);
    assert(!remaining.some(r => r.id === topId));
  });

  it('deduplicates identical dimensions when re-adding to recents', () => {
    const item = { label: 'HD Card', w: 1280, h: 720, ppi: 72 };
    addRecentCanvasSize(item);
    const beforeCount = getRecentCanvasSizes().length;

    // Add same dimensions again
    addRecentCanvasSize({ ...item, label: 'HD Card Renamed' });
    const afterCount = getRecentCanvasSizes().length;

    assert.strictEqual(afterCount, beforeCount);
    assert.strictEqual(getRecentCanvasSizes()[0].w, 1280);
    assert.strictEqual(getRecentCanvasSizes()[0].h, 720);
  });

  it('guarantees unique IDs across the entire preset catalogue', () => {
    const ids = PRESET_CATALOGUE.map(p => p.id);
    const uniqueIds = new Set(ids);
    assert.strictEqual(uniqueIds.size, ids.length, 'All preset IDs must be strictly unique');
  });
});

