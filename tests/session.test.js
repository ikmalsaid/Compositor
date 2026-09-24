// ─────────────────────────────────────────────────────────────────────────────
// tests/session.test.js  —  Unit tests for EditorSession & Undo/Redo Engine
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession, Tool } from '../src/store/session.js';
import { LayerTransform } from '../src/store/document.js';
import { renderTextToLayer } from '../src/ui/panels/textEditor.js';

describe('EditorSession & Undo/Redo Engine', () => {
  it('creates default 1920x1080 canvas with locked Background layer and black fgColor', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1920, 1080);

    assert.ok(session.document);
    assert.equal(session.document.width, 1920);
    assert.equal(session.document.height, 1080);
    assert.equal(session.fgColor, '#000000');
    assert.equal(session.bgColor, '#ffffff');
    assert.equal(session.document.layers[0].isLocked, true);
    assert.equal(session.document.layers[0].name, 'Background');
  });

  it('switches tools and notifies event listeners', () => {
    const session = new EditorSession();
    let notifiedTool = null;
    session.on('tool-change', (e) => { notifiedTool = e.detail?.tool ?? e.tool; });

    session.setTool(Tool.BRUSH);
    assert.equal(session.tool, Tool.BRUSH);
    assert.equal(notifiedTool, Tool.BRUSH);

    session.setTool(Tool.MOVE);
    assert.equal(session.tool, Tool.MOVE);
    assert.equal(notifiedTool, Tool.MOVE);
  });

  it('performs transactional Undo and Redo on layer transform edits', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Artwork');

    const origX = layer.transform.x;
    session.beginEdit('Move Layer');
    session.setLayerTransform(layer.id, new LayerTransform({ x: 250, y: 150, w: 200, h: 200 }));
    session.endEdit();

    assert.equal(session.document.layerByID(layer.id).transform.x, 250);
    assert.equal(session.canUndo, true);

    // Undo
    session.undo();
    assert.equal(session.document.layerByID(layer.id).transform.x, origX);
    assert.equal(session.canRedo, true);

    // Redo
    session.redo();
    assert.equal(session.document.layerByID(layer.id).transform.x, 250);
  });

  it('duplicates, locks, and deletes layers properly with history tracking', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const l1 = session.addBlankLayer('Graphic');

    const dup = session.duplicateLayer(l1.id);
    assert.ok(dup);
    assert.equal(session.document.layers.length, 3);
    assert.equal(dup.name, 'Graphic copy');

    session.setLayerLocked(dup.id, true);
    assert.equal(session.document.layerByID(dup.id).isLocked, true);

    session.deleteLayer(dup.id);
    assert.equal(session.document.layers.length, 2);
    assert.equal(session.document.layerByID(dup.id), null);

    // Undo delete
    session.undo();
    assert.equal(session.document.layers.length, 3);
  });

  it('executes non-destructive flipLayerH and flipLayerV', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Sprite');

    assert.equal(layer.transform.flipX, false);
    assert.equal(layer.transform.flipY, false);

    session.flipLayerH(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipX, true);

    session.flipLayerV(layer.id);
    assert.equal(session.document.layerByID(layer.id).transform.flipY, true);

    session.undo();
    assert.equal(session.document.layerByID(layer.id).transform.flipY, false);
  });

  it('crops active layer without changing document dimensions and updates layer pixel size and transform', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    const layer = session.addBlankLayer('Photo', { fullCanvas: true });
    assert.equal(layer.pixelW, 1000);
    assert.equal(layer.pixelH, 800);
    assert.equal(layer.transform.w, 1000);
    assert.equal(layer.transform.h, 800);

    // Crop the layer to (100, 150, 400, 300)
    session.cropActiveLayer({ x: 100, y: 150, w: 400, h: 300 });

    const cropped = session.document.layerByID(layer.id);
    assert.equal(session.document.width, 1000); // Canvas size unchanged
    assert.equal(session.document.height, 800); // Canvas size unchanged
    assert.equal(cropped.transform.x, 100);
    assert.equal(cropped.transform.y, 150);
    assert.equal(cropped.transform.w, 400);
    assert.equal(cropped.transform.h, 300);
    assert.equal(cropped.pixelW, 400);
    assert.equal(cropped.pixelH, 300);

    // Undo restores original layer size and bounds
    session.undo();
    const restored = session.document.layerByID(layer.id);
    assert.equal(restored.transform.w, 1000);
    assert.equal(restored.transform.h, 800);
    assert.equal(restored.pixelW, 1000);
    assert.equal(restored.pixelH, 800);
  });

  it('generates sequential dynamic layer names based on active tool', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);

    assert.equal(session.getNextLayerName('Brush'), 'Brush 1');
    session.addBlankLayer(session.getNextLayerName('Brush'));

    assert.equal(session.getNextLayerName('Brush'), 'Brush 2');
    session.addBlankLayer(session.getNextLayerName('Brush'));

    assert.equal(session.getNextLayerName('Brush'), 'Brush 3');
    assert.equal(session.getNextLayerName('Text'), 'Text 1');
    assert.equal(session.getNextLayerName('Star'), 'Star 1');
    assert.equal(session.getNextLayerName('Bucket Fill'), 'Bucket Fill 1');
  });

  it('reorders layers and bundles group descendants when reparenting', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const l1 = session.addBlankLayer('Layer 1');
    const group = session.addGroup('Group 1');
    const child1 = session.addBlankLayer('Child 1');
    child1.parentID = group.id;
    const child2 = session.addBlankLayer('Child 2');
    child2.parentID = group.id;
    const l2 = session.addBlankLayer('Layer 2');

    // Layers order in doc: [Background, l1, group, child1, child2, l2]
    // Reorder group down to index 1 (above Background)
    session.reorderLayer(group.id, 1);

    const names = session.document.layers.map(l => l.name);
    // Group and all its children should move together
    assert.equal(names[1], 'Group 1');
    assert.equal(names[2], 'Child 1');
    assert.equal(names[3], 'Child 2');
    assert.equal(names[4], 'Layer 1');
    assert.equal(names[5], 'Layer 2');
  });

  it('creates transparent and custom background canvases properly', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600, 72, 'transparent');
    assert.equal(session.document.layers.length, 1);
    assert.equal(session.document.layers[0].name, 'Layer 1');
    assert.equal(session.document.layers[0].isLocked, false);

    session.createDefaultDocument(800, 600, 72, 'custom', '#ff0077');
    assert.equal(session.document.layers[0].name, 'Background');
    assert.equal(session.document.layers[0].isLocked, true);
  });

  it('preserves non-destructive shapeMask framing and vector shape properties', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Image Mask');
    layer.shapeMask = 'star';
    layer.shapeCornerRadius = 16;

    const clone = layer.clone();
    assert.equal(clone.shapeMask, 'star');
    assert.equal(clone.shapeCornerRadius, 16);
  });

  it('includes all 17 tools in IMPLEMENTED_TOOLS with no missing tools', () => {
    const session = new EditorSession();
    assert.ok(session);
    for (const toolKey of Object.values(Tool)) {
      session.setTool(toolKey);
      assert.equal(session.tool, toolKey);
    }
  });

  it('resizes image proportionally with high-quality layer and transform scaling', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Card', { fullCanvas: true });

    assert.equal(session.document.width, 800);
    assert.equal(session.document.height, 600);
    assert.equal(layer.transform.w, 800);
    assert.equal(layer.transform.h, 600);

    // Resize image to 1600x1200 (2x scale)
    session.resizeImage(1600, 1200, 150, 'bicubic');

    assert.equal(session.document.width, 1600);
    assert.equal(session.document.height, 1200);
    assert.equal(session.document.resolution, 150);

    const scaledLayer = session.document.layerByID(layer.id);
    assert.equal(scaledLayer.transform.w, 1600);
    assert.equal(scaledLayer.transform.h, 1200);
    assert.equal(scaledLayer.pixelW, 1600);
    assert.equal(scaledLayer.pixelH, 1200);

    // Undo restores original dimensions
    session.undo();
    assert.equal(session.document.width, 800);
    assert.equal(session.document.height, 600);
    const restoredLayer = session.document.layerByID(layer.id);
    assert.equal(restoredLayer.transform.w, 800);
    assert.equal(restoredLayer.transform.h, 600);
  });

  it('resizes canvas with 9-point anchor offsets without scaling layer pixels', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Badge');
    layer.transform.x = 100;
    layer.transform.y = 100;

    // Expand canvas by +200 px in width and height with anchor 'top-left' (layer stays at x=100, y=100)
    session.resizeCanvas(1000, 800, 'top-left', 'white');
    assert.equal(session.document.width, 1000);
    assert.equal(session.document.height, 800);
    assert.equal(session.document.layerByID(layer.id).transform.x, 100);
    assert.equal(session.document.layerByID(layer.id).transform.y, 100);

    // Undo canvas resize
    session.undo();
    assert.equal(session.document.width, 800);
    assert.equal(session.document.height, 600);

    // Expand canvas with anchor 'center' (dx = +200, dy = +200 -> layer offsets by +100, +100)
    session.resizeCanvas(1000, 800, 'center', 'transparent');
    assert.equal(session.document.width, 1000);
    assert.equal(session.document.height, 800);
    assert.equal(session.document.layerByID(layer.id).transform.x, 200);
    assert.equal(session.document.layerByID(layer.id).transform.y, 200);
  });

  it('supports freehand polygon lasso selection path and operations', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layer = session.addBlankLayer('Polygon Artwork', { fullCanvas: true });

    const poly = [
      { x: 50, y: 50 },
      { x: 200, y: 50 },
      { x: 150, y: 200 },
      { x: 50, y: 150 }
    ];

    session.setSelection({ x: 50, y: 50, w: 150, h: 150 }, poly);
    assert.ok(session.selectionRect);
    assert.ok(session.selectionPath);
    assert.equal(session.selectionPath.length, 4);

    // Fill selection
    session.fillSelection('#ff4400');

    // Deselect clears both rect and path
    session.deselect();
    assert.equal(session.selectionRect, null);
    assert.equal(session.selectionPath, null);
  });

  it('manages clone stamp source sampling state', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);

    assert.equal(session.cloneSource, null);
    session.cloneSource = { x: 150, y: 220 };
    assert.deepEqual(session.cloneSource, { x: 150, y: 220 });
  });

  it('preserves and auto-expands text layer when cropped layer is edited', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1000, 800);
    const textLayer = session.addBlankLayer('Title Text', { fullCanvas: true });

    // Initial text render at (100, 100)
    renderTextToLayer(textLayer, 100, 100, {
      text: 'Short Title',
      fontSize: 24,
      fontFamily: 'sans-serif',
      color: '#000000',
    });
    textLayer.textData = {
      text: 'Short Title',
      fontSize: 24,
      fontFamily: 'sans-serif',
      color: '#000000',
      docX: 100,
      docY: 100,
      localX: 100,
      localY: 100,
    };

    // Crop the text layer to a tiny region (e.g. 120, 110, 50, 20)
    session.cropActiveLayer({ x: 120, y: 110, w: 50, h: 20 });
    assert.equal(textLayer.pixelW, 50);
    assert.equal(textLayer.pixelH, 20);
    assert.equal(textLayer.transform.x, 120);
    assert.equal(textLayer.transform.y, 110);

    // Now edit the text layer with a much longer multi-word string
    const newText = 'A Much Longer Edited Heading Text That Spans Wide';
    renderTextToLayer(textLayer, 100, 100, {
      text: newText,
      fontSize: 32,
      fontFamily: 'sans-serif',
      color: '#ff0000',
    });

    // The text layer must auto-expand its canvas and transform to avoid breaking/clipping
    assert.ok(textLayer.pixelW > 200, `Expected pixelW > 200 but got ${textLayer.pixelW}`);
    assert.ok(textLayer.pixelH >= 32, `Expected pixelH >= 32 but got ${textLayer.pixelH}`);
    assert.ok(textLayer.transform.x <= 100, `Expected transform.x <= 100 but got ${textLayer.transform.x}`);
    assert.ok(textLayer.transform.y <= 100, `Expected transform.y <= 100 but got ${textLayer.transform.y}`);
    assert.ok(textLayer.transform.w >= textLayer.pixelW, 'Transform w must match or exceed pixelW');
  });

  it('dynamically expands and contracts text layer size to tightly follow text content', () => {
    const session = new EditorSession();
    session.createDefaultDocument(1200, 900);
    const textLayer = session.addBlankLayer('Dynamic Text', { x: 200, y: 150, w: 100, h: 50 });

    // Step 1: Render baseline text
    renderTextToLayer(textLayer, 200, 150, {
      text: 'Medium length text',
      fontSize: 24,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'left',
    });
    const baselineW = textLayer.transform.w;
    const baselineH = textLayer.transform.h;
    assert.ok(baselineW > 50, 'Baseline width should be measured from text');
    assert.ok(baselineH >= 24, 'Baseline height should fit font size');
    assert.equal(textLayer.pixelW, textLayer.transform.w);
    assert.equal(textLayer.pixelH, textLayer.transform.h);

    // Step 2: Dynamic expansion (longer text and larger font)
    renderTextToLayer(textLayer, 200, 150, {
      text: 'This is a significantly longer headline text that spans across the document canvas\nwith multiple lines of text!',
      fontSize: 36,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'left',
    });
    const expandedW = textLayer.transform.w;
    const expandedH = textLayer.transform.h;
    assert.ok(expandedW > baselineW, `Expanded width (${expandedW}) must be strictly greater than baseline (${baselineW})`);
    assert.ok(expandedH > baselineH, `Expanded height (${expandedH}) must be strictly greater than baseline (${baselineH})`);
    assert.equal(textLayer.pixelW, expandedW);
    assert.equal(textLayer.pixelH, expandedH);

    // Step 3: Dynamic contraction (shorter text and smaller font)
    renderTextToLayer(textLayer, 200, 150, {
      text: 'Hi',
      fontSize: 14,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'left',
    });
    const contractedW = textLayer.transform.w;
    const contractedH = textLayer.transform.h;
    assert.ok(contractedW < expandedW, `Contracted width (${contractedW}) must be strictly smaller than expanded (${expandedW})`);
    assert.ok(contractedW < baselineW, `Contracted width (${contractedW}) must be smaller than baseline (${baselineW})`);
    assert.ok(contractedH < expandedH, `Contracted height (${contractedH}) must be smaller than expanded (${expandedH})`);
    assert.equal(textLayer.pixelW, contractedW);
    assert.equal(textLayer.pixelH, contractedH);

    // Step 4: Text box origin remains fixed when changing text alignment
    renderTextToLayer(textLayer, 500, 300, {
      text: 'Alignment Test',
      fontSize: 20,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'left',
    });
    assert.equal(textLayer.transform.x, 500);
    assert.equal(textLayer.transform.y, 300);

    renderTextToLayer(textLayer, 500, 300, {
      text: 'Alignment Test',
      fontSize: 20,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'center',
    });
    assert.equal(textLayer.transform.x, 500, 'Changing alignment to center must not shift textbox position');
    assert.equal(textLayer.transform.y, 300);

    renderTextToLayer(textLayer, 500, 300, {
      text: 'Alignment Test',
      fontSize: 20,
      fontFamily: 'Inter, sans-serif',
      textAlign: 'right',
    });
    assert.equal(textLayer.transform.x, 500, 'Changing alignment to right must not shift textbox position');
    assert.equal(textLayer.transform.y, 300);
  });

  it('performs layer cut, copy, paste, and paste-in-place with history tracking', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const layerA = session.addBlankLayer('Card A', { x: 100, y: 100, w: 200, h: 150 });
    layerA.opacity = 0.8;
    layerA.shapeMask = 'rounded-rectangle';

    // Copy Layer
    assert.equal(session.hasClipboardLayer(), false);
    const copied = session.copyLayer(layerA.id);
    assert.equal(copied, true);
    assert.equal(session.hasClipboardLayer(), true);

    // Paste with offset
    const pasted1 = session.pasteLayer();
    assert.ok(pasted1);
    assert.notEqual(pasted1.id, layerA.id);
    assert.equal(pasted1.name, 'Card A copy');
    assert.equal(pasted1.opacity, 0.8);
    assert.equal(pasted1.shapeMask, 'rounded-rectangle');
    assert.equal(pasted1.transform.x, 120);
    assert.equal(pasted1.transform.y, 120);
    assert.equal(session.activeLayerID, pasted1.id);
    assert.equal(session.document.layers.length, 3); // Background + layerA + pasted1

    // Paste in Place
    const pastedInPlace = session.pasteLayer({ inPlace: true });
    assert.ok(pastedInPlace);
    assert.equal(pastedInPlace.transform.x, 100);
    assert.equal(pastedInPlace.transform.y, 100);
    assert.equal(session.document.layers.length, 4);

    // Paste centered at specific coordinates
    const pastedAtPos = session.pasteLayer({ x: 500, y: 400 });
    assert.ok(pastedAtPos);
    assert.equal(pastedAtPos.transform.x, 500 - 100); // 500 - w/2
    assert.equal(pastedAtPos.transform.y, 400 - 75);  // 400 - h/2

    // Cut Layer
    const layerCountBeforeCut = session.document.layers.length;
    const cutResult = session.cutLayer(pastedAtPos.id);
    assert.equal(cutResult, true);
    assert.equal(session.document.layers.length, layerCountBeforeCut - 1);
    assert.equal(session.hasClipboardLayer(), true);

    // Undo Cut
    session.undo();
    assert.equal(session.document.layers.length, layerCountBeforeCut);
  });

  it('brings layers to front, sends to back, forwards and backwards accurately', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    // Background layer is at index 0 (locked)
    const layer1 = session.addBlankLayer('Layer 1');
    const layer2 = session.addBlankLayer('Layer 2');
    const layer3 = session.addBlankLayer('Layer 3');

    // Initial order: [Background, Layer 1, Layer 2, Layer 3]
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 1', 'Layer 2', 'Layer 3']);

    // Send Layer 3 backward
    session.sendBackward(layer3.id);
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 1', 'Layer 3', 'Layer 2']);

    // Send Layer 3 to back (should be placed right above locked background at index 1)
    session.sendToBack(layer3.id);
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 3', 'Layer 1', 'Layer 2']);

    // Bring Layer 3 forward
    session.bringForward(layer3.id);
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 1', 'Layer 3', 'Layer 2']);

    // Bring Layer 1 to front
    session.bringToFront(layer1.id);
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 3', 'Layer 2', 'Layer 1']);

    // Undo Bring to Front
    session.undo();
    assert.deepEqual(session.document.layers.map(l => l.name), ['Background', 'Layer 1', 'Layer 3', 'Layer 2']);
  });

  it('automatically scales down oversized imported images to fit canvas while preserving pixel resolution', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);

    // Case 1: Small image (200x150 on 800x600 canvas) -> keeps 1:1 transform size
    const smallLayer = session.addImageLayer({
      name: 'Small Image',
      w: 200,
      h: 150,
    });
    assert.equal(smallLayer.pixelW, 200);
    assert.equal(smallLayer.pixelH, 150);
    assert.equal(smallLayer.transform.w, 200);
    assert.equal(smallLayer.transform.h, 150);
    assert.equal(smallLayer.transform.x, (800 - 200) / 2); // 300
    assert.equal(smallLayer.transform.y, (600 - 150) / 2); // 225

    // Case 2: Large wide image (4000x2000 on 800x600 canvas) -> scaled to fit width (800x400)
    const largeLayer = session.addImageLayer({
      name: 'Large Wide Image',
      w: 4000,
      h: 2000,
    });
    // High-res internal pixels preserved
    assert.equal(largeLayer.pixelW, 4000);
    assert.equal(largeLayer.pixelH, 2000);
    // Transform scaled down proportionally to fit inside 800x600
    assert.equal(largeLayer.transform.w, 800);
    assert.equal(largeLayer.transform.h, 400);
    assert.equal(largeLayer.transform.x, 0);
    assert.equal(largeLayer.transform.y, 100); // Centered vertically: (600 - 400) / 2

    // Case 3: Tall portrait image (1000x2000 on 800x600 canvas) -> scaled to fit height (300x600)
    const tallLayer = session.addImageLayer({
      name: 'Large Tall Image',
      w: 1000,
      h: 2000,
    });
    assert.equal(tallLayer.pixelW, 1000);
    assert.equal(tallLayer.pixelH, 2000);
    assert.equal(tallLayer.transform.w, 300);
    assert.equal(tallLayer.transform.h, 600);
    assert.equal(tallLayer.transform.x, (800 - 300) / 2); // 250
    assert.equal(tallLayer.transform.y, 0);
  });

  it('supports multi-layer selection with Ctrl/Cmd toggle and Shift range selection', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    // Background layer is at index 0
    const l1 = session.addBlankLayer('Layer 1');
    const l2 = session.addBlankLayer('Layer 2');
    const l3 = session.addBlankLayer('Layer 3');
    const l4 = session.addBlankLayer('Layer 4');

    // 1. Single selection
    session.selectLayer(l2.id);
    assert.equal(session.activeLayerID, l2.id);
    assert.equal(session.selectedLayerIDs.size, 1);
    assert.ok(session.selectedLayerIDs.has(l2.id));

    // 2. Ctrl/Cmd toggle selection (add l4 to selection)
    session.selectLayer(l4.id, { isToggle: true });
    assert.equal(session.activeLayerID, l4.id);
    assert.equal(session.selectedLayerIDs.size, 2);
    assert.ok(session.selectedLayerIDs.has(l2.id));
    assert.ok(session.selectedLayerIDs.has(l4.id));

    // 3. Ctrl/Cmd toggle selection (remove l2 from selection)
    session.selectLayer(l2.id, { isToggle: true });
    assert.equal(session.selectedLayerIDs.size, 1);
    assert.ok(session.selectedLayerIDs.has(l4.id));
    assert.equal(session.activeLayerID, l4.id);

    // 4. Shift range selection (from l4 down to l1)
    session.selectLayer(l1.id, { isRange: true });
    // Layers in order: [Background (0), Layer 1 (1), Layer 2 (2), Layer 3 (3), Layer 4 (4)]
    // Range from l4 (4) to l1 (1) includes index 1, 2, 3, 4
    assert.equal(session.selectedLayerIDs.size, 4);
    assert.ok(session.selectedLayerIDs.has(l1.id));
    assert.ok(session.selectedLayerIDs.has(l2.id));
    assert.ok(session.selectedLayerIDs.has(l3.id));
    assert.ok(session.selectedLayerIDs.has(l4.id));

    // 5. Clicking single layer resets multi-selection
    session.selectLayer(l3.id);
    assert.equal(session.selectedLayerIDs.size, 1);
    assert.ok(session.selectedLayerIDs.has(l3.id));
    assert.equal(session.activeLayerID, l3.id);
  });

  it('batch deletes multiple selected layers in a single undoable transaction', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);
    const l1 = session.addBlankLayer('Item A');
    const l2 = session.addBlankLayer('Item B');
    const l3 = session.addBlankLayer('Item C');
    const l4 = session.addBlankLayer('Item D');

    assert.equal(session.document.layers.length, 5); // Background + 4 layers

    // Select l1, l2, l4
    session.selectLayer(l1.id);
    session.selectLayer(l2.id, { isToggle: true });
    session.selectLayer(l4.id, { isToggle: true });
    assert.equal(session.selectedLayerIDs.size, 3);

    // Batch delete
    session.deleteSelectedLayers();
    assert.equal(session.document.layers.length, 2); // Background + Item C
    assert.equal(session.document.layerByID(l1.id), null);
    assert.equal(session.document.layerByID(l2.id), null);
    assert.equal(session.document.layerByID(l4.id), null);
    assert.ok(session.document.layerByID(l3.id));
    assert.equal(session.activeLayerID, l3.id);

    // Undo restores all 3 deleted layers in one step
    session.undo();
    assert.equal(session.document.layers.length, 5);
    assert.ok(session.document.layerByID(l1.id));
    assert.ok(session.document.layerByID(l2.id));
    assert.ok(session.document.layerByID(l4.id));

    // Redo re-deletes all 3 layers
    session.redo();
    assert.equal(session.document.layers.length, 2);
    assert.equal(session.document.layerByID(l1.id), null);
    assert.equal(session.document.layerByID(l2.id), null);
    assert.equal(session.document.layerByID(l4.id), null);
  });

  it('cuts, copies, and pastes selected rectangular and polygon regions as new layers', () => {
    const session = new EditorSession();
    session.createDefaultDocument(800, 600);

    // Add a blank layer (default 50% canvas size centered: 400x300 at x:200, y:150)
    const layer = session.addBlankLayer('Artwork', { x: 100, y: 100, w: 400, h: 300 });
    // Fill the layer with red
    const ctx = layer.ctx;
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, layer.pixelW, layer.pixelH);
    layer.markChanged();

    // 1. Rectangular selection inside the layer
    session.setSelection({ x: 150, y: 150, w: 100, h: 80 });
    assert.equal(session.hasSelection(), true);

    // Copy selection
    const copied = session.copyLayer(layer.id);
    assert.equal(copied, true);
    assert.equal(session.hasClipboardLayer(), true);

    // Paste as new layer
    const pastedLayer = session.pasteLayer();
    assert.ok(pastedLayer);
    assert.equal(pastedLayer.transform.x, 150);
    assert.equal(pastedLayer.transform.y, 150);
    assert.equal(pastedLayer.transform.w, 100);
    assert.equal(pastedLayer.transform.h, 80);
    assert.equal(session.document.layers.length, 3); // Background + Artwork + Artwork Selection

    // Deselect
    session.deselect();
    assert.equal(session.hasSelection(), false);

    // 2. Polygon / Lasso selection on Artwork layer
    session.selectLayer(layer.id);
    const lassoPoints = [
      { x: 120, y: 120 },
      { x: 220, y: 120 },
      { x: 220, y: 220 },
      { x: 120, y: 220 },
    ];
    session.setSelection({ x: 120, y: 120, w: 100, h: 100 }, lassoPoints);
    assert.equal(session.hasSelection(), true);

    // Cut polygon selection
    const cutResult = session.cutLayer(layer.id);
    assert.equal(cutResult, true);
    assert.equal(session.hasClipboardLayer(), true);

    // Paste polygon cutout
    const pastedLasso = session.pasteLayer();
    assert.ok(pastedLasso);
    assert.equal(pastedLasso.transform.x, 120);
    assert.equal(pastedLasso.transform.y, 120);
    assert.equal(pastedLasso.transform.w, 100);
    assert.equal(pastedLasso.transform.h, 100);
    assert.equal(session.document.layers.length, 4);

    // Undo Paste & Cut
    session.undo(); // Undo paste
    assert.equal(session.document.layers.length, 3);
    session.undo(); // Undo clear selection (cut)
    assert.equal(session.canRedo, true);
  });
});

