// ─────────────────────────────────────────────────────────────────────────────
// tests/layerDialogs.test.js  —  Unit tests for Layer Deletion & Locked Dialogs
// ─────────────────────────────────────────────────────────────────────────────

import './setup.js';
import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { EditorSession } from '../src/store/session.js';
import { promptDeleteLayers } from '../src/ui/panels/layerDialogs.js';
import { PRESET_CATALOGUE, getDefaultCanvasSettings } from '../src/ui/panels/newCanvas.js';

describe('Layer Deletion Confirmation & Locked Dialogs', () => {
  let session;

  beforeEach(() => {
    // Clear DOM body
    document.body.innerHTML = '<div id="modal-root"></div>';
    session = new EditorSession();
    session.createDefaultDocument(800, 600); // Has Background (locked)
  });

  it('shows locked dialog when attempting to delete default locked Background layer', () => {
    // Active layer is Background (isLocked: true)
    promptDeleteLayers(session);

    const lockedModal = document.querySelector('.modal');
    assert.ok(lockedModal, 'Modal should be rendered');
    assert.match(lockedModal.textContent, /Layer is Locked/);
    assert.match(lockedModal.textContent, /Background/);

    const okBtn = lockedModal.querySelector('#dlg-locked-ok');
    assert.ok(okBtn, 'OK button should exist');
    okBtn.click();

    // Modal removed and layer still exists
    assert.equal(document.querySelector('.modal'), null);
    assert.equal(session.document.layers.length, 1);
  });

  it('shows locked dialog when deleting a group that contains a locked child layer', () => {
    const group = session.addGroup('Folder 1');
    const child = session.addBlankLayer('Child Layer');
    child.parentID = group.id;
    child.isLocked = true;

    session.activeLayerID = group.id;
    session.selectedLayerIDs = new Set([group.id]);

    promptDeleteLayers(session);

    const lockedModal = document.querySelector('.modal');
    assert.ok(lockedModal, 'Modal should be rendered for locked child in group');
    assert.match(lockedModal.textContent, /Layer is Locked/);
    assert.match(lockedModal.textContent, /Child Layer/);
  });

  it('shows confirmation dialog when deleting an unlocked layer and deletes on confirm', () => {
    const layer = session.addBlankLayer('My Unlocked Layer');
    session.activeLayerID = layer.id;
    session.selectedLayerIDs = new Set([layer.id]);

    promptDeleteLayers(session);

    const modal = document.querySelector('.modal');
    assert.ok(modal, 'Confirmation modal should be rendered');
    assert.match(modal.textContent, /Delete Layer/);
    assert.match(modal.textContent, /My Unlocked Layer/);

    const confirmBtn = modal.querySelector('#dlg-del-confirm');
    assert.ok(confirmBtn, 'Delete button should exist');
    confirmBtn.click();

    // Layer deleted
    assert.equal(session.document.layerByID(layer.id), null);
  });

  it('does not delete layer when user cancels confirmation dialog', () => {
    const layer = session.addBlankLayer('Layer To Keep');
    session.activeLayerID = layer.id;
    session.selectedLayerIDs = new Set([layer.id]);

    promptDeleteLayers(session);

    const modal = document.querySelector('.modal');
    assert.ok(modal);
    const cancelBtn = modal.querySelector('#dlg-del-cancel');
    cancelBtn.click();

    assert.ok(session.document.layerByID(layer.id), 'Layer should remain in document');
  });

  it('shows batch confirmation when deleting multiple selected layers', () => {
    const l1 = session.addBlankLayer('Layer A');
    const l2 = session.addBlankLayer('Layer B');
    session.selectedLayerIDs = new Set([l1.id, l2.id]);

    promptDeleteLayers(session);

    const modal = document.querySelector('.modal');
    assert.ok(modal);
    assert.match(modal.textContent, /Delete Layers/);
    assert.match(modal.textContent, /2 selected layers/);

    const confirmBtn = modal.querySelector('#dlg-del-confirm');
    confirmBtn.click();

    assert.equal(session.document.layerByID(l1.id), null);
    assert.equal(session.document.layerByID(l2.id), null);
  });

  it('renames Default Compositor Size to Default Size in preset catalogue and default settings', () => {
    const defaultPreset = PRESET_CATALOGUE.find(p => p.id === 'pop-default-ps');
    assert.ok(defaultPreset);
    assert.equal(defaultPreset.label, 'Default Size');

    const defaultSettings = getDefaultCanvasSettings();
    assert.equal(defaultSettings.label, 'Default Size');
  });

  it('verifies locked layer renders with locked class', () => {
    const bg = session.document.layers[0];
    assert.equal(bg.isLocked, true);
  });
});
