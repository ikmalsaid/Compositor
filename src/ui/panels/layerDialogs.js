// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/layerDialogs.js  —  Confirmation & Locked Warning dialogs for Layer deletion
// ─────────────────────────────────────────────────────────────────────────────

import { createFaIcon } from '../icons.js';

let _activeDialog = null;

/**
 * Prompt user before deleting layer(s).
 * - If any target layer (or descendant inside a target group) is locked, shows the Locked Dialog.
 * - Otherwise, shows the Delete Confirmation Dialog.
 *
 * @param {import('../../store/session.js').EditorSession} session
 * @param {string} [targetLayerId] Optional specific layer ID (e.g. from context menu)
 */
export function promptDeleteLayers(session, targetLayerId = null) {
  if (!session || !session.document) return;
  if (_activeDialog) {
    // If a dialog is already showing, dismiss it first
    _activeDialog();
    _activeDialog = null;
  }

  const doc = session.document;

  // Determine target layer IDs
  let targetIDs = [];
  if (targetLayerId && doc.layerByID(targetLayerId)) {
    if (session.selectedLayerIDs && session.selectedLayerIDs.has(targetLayerId) && session.selectedLayerIDs.size > 1) {
      targetIDs = Array.from(session.selectedLayerIDs);
    } else {
      targetIDs = [targetLayerId];
    }
  } else if (session.selectedLayerIDs && session.selectedLayerIDs.size > 0) {
    targetIDs = Array.from(session.selectedLayerIDs);
  } else if (session.activeLayerID) {
    targetIDs = [session.activeLayerID];
  }

  const targetLayers = targetIDs.map(id => doc.layerByID(id)).filter(Boolean);
  if (targetLayers.length === 0) return;

  // Recursively collect all affected layers (to inspect child layers in groups)
  const allAffectedLayers = [];
  const collectChildren = (pid) => {
    for (const l of doc.layers) {
      if (l.parentID === pid) {
        allAffectedLayers.push(l);
        if (l.isGroup) collectChildren(l.id);
      }
    }
  };

  for (const l of targetLayers) {
    allAffectedLayers.push(l);
    if (l.isGroup) collectChildren(l.id);
  }

  const lockedLayers = allAffectedLayers.filter(l => l.isLocked);

  if (lockedLayers.length > 0) {
    showLockedLayerDialog(lockedLayers);
  } else {
    showDeleteConfirmationDialog(session, targetLayers, targetLayerId);
  }
}

/**
 * Display modal alert informing the user that the layer is locked.
 * @param {Array<object>} lockedLayers
 */
export function showLockedLayerDialog(lockedLayers) {
  const mountPoint = document.getElementById('modal-root') || document.body;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-overlay';
  backdrop.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    opacity: 1; animation: fadeIn 120ms ease forwards;
  `;

  const isSingle = lockedLayers.length === 1;
  const layerName = isSingle ? lockedLayers[0].name : '';
  const lockedNames = lockedLayers.slice(0, 3).map(l => `"${l.name}"`).join(', ') + (lockedLayers.length > 3 ? '…' : '');

  const msgHtml = isSingle
    ? `Could not complete the delete command because the layer <strong style="color:#ffffff;font-weight:600">"${escapeHtml(layerName)}"</strong> is locked.`
    : `Could not delete the selected layers because ${lockedLayers.length} layers are locked (${escapeHtml(lockedNames)}).`;

  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.style.cssText = `
    background: #1a1b22; border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8);
    width: 390px; max-width: 90vw; font-family: var(--font-sans, system-ui, sans-serif);
    color: #e0e0e0; padding: 22px; display: flex; flex-direction: column;
    gap: 16px; animation: te-dialog-in .15s cubic-bezier(.22,1,.36,1);
    outline: none;
  `;

  dlg.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:38px;height:38px;border-radius:8px;background:rgba(245,158,11,0.14);border:1px solid rgba(245,158,11,0.28);color:#fbbf24;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
        ${createFaIcon('fa-lock', { size: 16 })}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#ffffff">Layer is Locked</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.72);line-height:1.45">${msgHtml}</div>
        <div style="font-size:11px;color:var(--text-muted,#808080);margin-top:2px">Unlock the layer in the Layers panel before deleting.</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:2px">
      <button id="dlg-locked-ok" class="btn btn-primary" style="padding:7px 20px;background:#3b82f6;border-radius:6px;font-weight:600;font-size:12px;cursor:pointer;border:none;color:#ffffff;transition:background .12s">OK</button>
    </div>
  `;

  backdrop.appendChild(dlg);
  mountPoint.appendChild(backdrop);

  function onKeyDown(e) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      close();
    }
  }

  function close() {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (_activeDialog === close) _activeDialog = null;
  }
  _activeDialog = close;

  const okBtn = dlg.querySelector('#dlg-locked-ok');
  if (okBtn) okBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  document.addEventListener('keydown', onKeyDown);

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      okBtn?.focus?.();
    });
  } else {
    okBtn?.focus?.();
  }
}

/**
 * Display confirmation dialog before deleting unlocked layer(s).
 * @param {import('../../store/session.js').EditorSession} session
 * @param {Array<object>} targetLayers
 * @param {string} [targetLayerId]
 */
export function showDeleteConfirmationDialog(session, targetLayers, targetLayerId = null) {
  const mountPoint = document.getElementById('modal-root') || document.body;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-overlay';
  backdrop.style.cssText = `
    position: fixed; inset: 0; z-index: 99999;
    background: rgba(0, 0, 0, 0.65); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    opacity: 1; animation: fadeIn 120ms ease forwards;
  `;

  const count = targetLayers.length;
  let title = 'Delete Layer';
  let msgHtml = '';

  if (count === 1) {
    const l = targetLayers[0];
    if (l.isGroup) {
      title = 'Delete Group';
      msgHtml = `Are you sure you want to delete the group <strong style="color:#ffffff;font-weight:600">"${escapeHtml(l.name)}"</strong> and its contents?`;
    } else {
      title = 'Delete Layer';
      msgHtml = `Are you sure you want to delete the layer <strong style="color:#ffffff;font-weight:600">"${escapeHtml(l.name)}"</strong>?`;
    }
  } else {
    title = 'Delete Layers';
    msgHtml = `Are you sure you want to delete the <strong style="color:#ffffff;font-weight:600">${count} selected layers</strong>?`;
  }

  const dlg = document.createElement('div');
  dlg.className = 'modal';
  dlg.setAttribute('role', 'dialog');
  dlg.setAttribute('aria-modal', 'true');
  dlg.style.cssText = `
    background: #1a1b22; border: 1px solid rgba(255, 255, 255, 0.14);
    border-radius: 10px; box-shadow: 0 20px 48px rgba(0, 0, 0, 0.8);
    width: 390px; max-width: 90vw; font-family: var(--font-sans, system-ui, sans-serif);
    color: #e0e0e0; padding: 22px; display: flex; flex-direction: column;
    gap: 16px; animation: te-dialog-in .15s cubic-bezier(.22,1,.36,1);
    outline: none;
  `;

  dlg.innerHTML = `
    <div style="display:flex;align-items:flex-start;gap:14px">
      <div style="width:38px;height:38px;border-radius:8px;background:rgba(239,68,68,0.14);border:1px solid rgba(239,68,68,0.28);color:#f87171;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">
        ${createFaIcon('fa-trash-can', { size: 16 })}
      </div>
      <div style="display:flex;flex-direction:column;gap:5px;flex:1;min-width:0">
        <div style="font-size:14px;font-weight:600;color:#ffffff">${title}</div>
        <div style="font-size:12px;color:rgba(255,255,255,0.72);line-height:1.45">${msgHtml}</div>
        <div style="font-size:11px;color:var(--text-muted,#808080);margin-top:2px">This action can be undone with Undo (Ctrl+Z).</div>
      </div>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:2px">
      <button id="dlg-del-cancel" style="padding:7px 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:6px;color:#d1d5db;font-size:12px;font-weight:500;cursor:pointer;transition:all .12s">Cancel</button>
      <button id="dlg-del-confirm" style="padding:7px 18px;background:#ef4444;border:none;border-radius:6px;color:#ffffff;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(239,68,68,0.35);transition:all .12s">Delete</button>
    </div>
  `;

  backdrop.appendChild(dlg);
  mountPoint.appendChild(backdrop);

  function onKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      doDelete();
    }
  }

  function close() {
    document.removeEventListener('keydown', onKeyDown);
    backdrop.remove();
    if (_activeDialog === close) _activeDialog = null;
  }
  _activeDialog = close;

  const cancelBtn = dlg.querySelector('#dlg-del-cancel');
  const confirmBtn = dlg.querySelector('#dlg-del-confirm');

  function doDelete() {
    close();
    if (targetLayerId && count === 1 && (!session.selectedLayerIDs || !session.selectedLayerIDs.has(targetLayerId))) {
      session.deleteLayer(targetLayerId);
    } else {
      session.deleteSelectedLayers();
    }
  }

  if (confirmBtn) confirmBtn.addEventListener('click', doDelete);
  if (cancelBtn) cancelBtn.addEventListener('click', close);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) close();
  });

  document.addEventListener('keydown', onKeyDown);

  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => {
      confirmBtn?.focus?.();
    });
  } else {
    confirmBtn?.focus?.();
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
