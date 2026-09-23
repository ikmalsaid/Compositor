// ─────────────────────────────────────────────────────────────────────────────
// ui/layers.js  —  Layers panel (NativeLayerList equivalent)
// ─────────────────────────────────────────────────────────────────────────────

import { LayerBlendMode } from '../store/document.js';
import { removeBackground } from '../ai/backgroundRemoval.js';
import { showContextMenu } from './panels/contextMenu.js';
import {
  iconEye, iconEyeOff, iconLock, iconLockOpen,
  iconFolder, iconLayer, iconChevronRight, iconChevronDown
} from './icons.js';

export class LayersPanel {
  constructor(session) {
    this.session       = session;
    this.list          = document.getElementById('layers-list');
    this.blendSelect   = document.getElementById('blend-mode-select');
    this.opacitySlider = document.getElementById('opacity-slider');
    this.opacityInput  = document.getElementById('opacity-input');

    this._dragSrc = null;
    this._renamingID = null;

    this._bindResizer();
    this._populateBlendModes();
    this._bindControls();
    this._bindSession();
    this._render();
  }

  // ─── Setup ──────────────────────────────────────────────────────────────────

  _bindResizer() {
    const resizer = document.getElementById('layers-resizer');
    if (!resizer) return;

    const savedW = parseInt(localStorage.getItem('compositor:layers-w'), 10);
    if (savedW && savedW >= 180 && savedW <= 800) {
      document.documentElement.style.setProperty('--layers-w', `${savedW}px`);
    }

    let isResizing = false;

    const onPointerMove = (e) => {
      if (!isResizing) return;
      const minW = 180;
      const maxW = Math.max(minW, Math.min(window.innerWidth * 0.65, window.innerWidth - e.clientX));
      const targetW = Math.round(maxW);
      document.documentElement.style.setProperty('--layers-w', `${targetW}px`);
      localStorage.setItem('compositor:layers-w', targetW.toString());
    };

    const onPointerUp = () => {
      if (!isResizing) return;
      isResizing = false;
      resizer.classList.remove('resizing');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };

    resizer.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      isResizing = true;
      resizer.classList.add('resizing');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
    });
  }

  _populateBlendModes() {
    for (const mode of LayerBlendMode.ALL) {
      const opt = document.createElement('option');
      opt.value = mode; opt.textContent = mode;
      this.blendSelect.appendChild(opt);
    }
  }

  _bindControls() {
    // Blend mode
    this.blendSelect.addEventListener('change', () => {
      const id = this.session.activeLayerID;
      if (id) this.session.setLayerBlendMode(id, this.blendSelect.value);
    });

    // Opacity slider
    this.opacitySlider.addEventListener('input', () => {
      const val = parseFloat(this.opacitySlider.value) / 100;
      this.opacityInput.value = this.opacitySlider.value;
      const id = this.session.activeLayerID;
      if (id) this.session.setLayerOpacity(id, val);
    });
    this.opacityInput.addEventListener('change', () => {
      const val = Math.max(0, Math.min(100, parseFloat(this.opacityInput.value) || 0));
      this.opacityInput.value = val;
      this.opacitySlider.value = val;
      const id = this.session.activeLayerID;
      if (id) this.session.setLayerOpacity(id, val / 100);
    });

    // Action buttons
    document.getElementById('btn-new-layer').addEventListener('click', () => {
      this.session.addBlankLayer();
    });
    document.getElementById('btn-new-group').addEventListener('click', () => {
      this.session.addGroup();
    });
    document.getElementById('btn-duplicate').addEventListener('click', () => {
      if (this.session.activeLayerID) this.session.duplicateLayer(this.session.activeLayerID);
    });
    document.getElementById('btn-delete-layer').addEventListener('click', () => {
      this.session.deleteSelectedLayers();
    });

    // Context menu on empty area of layers list
    this.list.addEventListener('contextmenu', (e) => {
      if (e.target.closest('.layer-row')) return;
      e.preventDefault();
      e.stopPropagation();
      this._showEmptyContextMenu(e.clientX, e.clientY);
    });
  }

  setSession(session) {
    if (this._session && this._handlers) {
      this._session.off('change', this._handlers.change);
      this._session.off('canvas-dirty', this._handlers.dirty);
    }
    this._session = session;
    this.session = session;
    if (session) {
      this._handlers = {
        change: () => this._render(),
        dirty: () => this._updateThumbnails(),
      };
      session.on('change', this._handlers.change);
      session.on('canvas-dirty', this._handlers.dirty);
    }
    this._render();
  }

  _bindSession() {
    this.setSession(this.session);
  }

  // ─── Rendering ──────────────────────────────────────────────────────────────

  _render() {
    const doc = this.session.document;
    this._updateHeader();

    if (!doc) {
      this.list.innerHTML = '<div style="padding:16px;color:var(--text-muted);font-size:11px;text-align:center">No canvas open</div>';
      return;
    }

    // Render layers in reverse order (top of stack = top of list)
    const layers  = [...doc.layers].reverse();
    const frag    = document.createDocumentFragment();

    for (const layer of layers) {
      // Determine indent level
      let depth = 0, p = layer.parentID;
      while (p) { depth++; p = doc.layerByID(p)?.parentID ?? null; }

      // Skip children of collapsed groups
      if (layer.parentID) {
        const parent = doc.layerByID(layer.parentID);
        if (parent?.isCollapsed) continue;
      }

      const row = this._buildRow(layer, depth);
      frag.appendChild(row);
    }

    this.list.innerHTML = '';
    this.list.appendChild(frag);
  }

  _updateHeader() {
    const layer = this.session.activeLayer;
    const hasLayer = !!layer && !layer.isGroup;
    this.blendSelect.disabled = !hasLayer;
    this.opacitySlider.disabled = !hasLayer;
    this.opacityInput.disabled = !hasLayer;
    if (layer) {
      this.blendSelect.value = layer.blendMode;
      const pct = Math.round(layer.opacity * 100);
      this.opacitySlider.value = pct;
      this.opacityInput.value = pct;
    }
  }

  _buildRow(layer, depth) {
    const row = document.createElement('div');
    row.className = 'layer-row';
    row.dataset.id = layer.id;
    row.draggable = true;

    const isSelected = this.session.selectedLayerIDs.has(layer.id) || this.session.activeLayerID === layer.id;
    if (isSelected) row.classList.add('selected');

    // Indent
    if (depth > 0) {
      const indent = document.createElement('span');
      indent.className = 'layer-indent';
      indent.style.width = `${depth * 14}px`;
      row.appendChild(indent);
    }

    // Group collapse toggle
    if (layer.isGroup) {
      const toggle = document.createElement('span');
      toggle.className = 'layer-group-toggle';
      toggle.style.cssText = 'width:16px;height:16px;flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);margin-right:2px;';
      toggle.innerHTML = layer.isCollapsed ? iconChevronRight(11) : iconChevronDown(11);
      toggle.addEventListener('click', (e) => {
        e.stopPropagation();
        this.session.toggleGroupCollapsed(layer.id);
      });
      row.appendChild(toggle);
    }

    // Visibility eye
    const vis = document.createElement('span');
    vis.className = 'layer-vis-btn' + (layer.isVisible ? '' : ' layer-vis-off');
    vis.innerHTML = layer.isVisible ? iconEye(14) : iconEyeOff(14);
    vis.title = layer.isVisible ? 'Hide Layer' : 'Show Layer';
    vis.addEventListener('click', (e) => {
      e.stopPropagation();
      this.session.setLayerVisibility(layer.id, !layer.isVisible);
    });
    row.appendChild(vis);

    // Lock toggle
    const lock = document.createElement('span');
    lock.className = 'layer-lock-btn' + (layer.isLocked ? ' locked' : '');
    lock.innerHTML = layer.isLocked ? iconLock(13) : iconLockOpen(13);
    lock.title = layer.isLocked ? 'Unlock Layer' : 'Lock Layer';
    lock.addEventListener('click', (e) => {
      e.stopPropagation();
      this.session.setLayerLocked(layer.id, !layer.isLocked);
    });
    row.appendChild(lock);

    // Thumbnail
    const thumb = document.createElement('div');
    thumb.className = 'layer-thumb';
    thumb.dataset.thumbFor = layer.id;
    if (layer.isGroup) {
      thumb.innerHTML = `<span class="layer-thumb-icon">${iconFolder(16)}</span>`;
    } else {
      const thumbUrl = layer.getThumbnailDataURL?.();
      if (thumbUrl) {
        const img = document.createElement('img');
        img.src = thumbUrl;
        img.style.cssText = 'width:100%;height:100%;object-fit:contain;';
        thumb.appendChild(img);
      } else {
        thumb.innerHTML = `<span class="layer-thumb-icon">${iconLayer(15)}</span>`;
      }
    }
    row.appendChild(thumb);

    // Name + meta
    const info = document.createElement('div');
    info.className = 'layer-info';
    const nameEl = document.createElement('div');
    nameEl.className = 'layer-name';
    nameEl.textContent = layer.name;
    const meta = document.createElement('div');
    meta.className = 'layer-meta';
    if (!layer.isGroup) {
      meta.textContent = `${layer.pixelW}×${layer.pixelH}`;
    }
    info.appendChild(nameEl);
    info.appendChild(meta);
    row.appendChild(info);

    // Events
    row.addEventListener('click', (e) => {
      if (e.target.closest('.layer-vis-btn, .layer-lock-btn, .layer-group-toggle, .layer-name-input')) return;
      this.session.selectLayer(layer.id, {
        isToggle: e.ctrlKey || e.metaKey,
        isRange: e.shiftKey,
      });
    });
    nameEl.addEventListener('dblclick', (e) => { e.stopPropagation(); this._startRename(layer.id, nameEl); });

    // Drag-to-reorder & group reparenting
    row.addEventListener('dragstart', (e) => {
      this._dragSrc = layer.id;
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', layer.id);
    });

    row.addEventListener('dragover', (e) => {
      if (!this._dragSrc || this._dragSrc === layer.id) return;
      e.preventDefault();
      const rect = row.getBoundingClientRect();
      const relY = (e.clientY - rect.top) / rect.height;

      row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-into-group');

      if (layer.isGroup && relY >= 0.25 && relY <= 0.75) {
        row.classList.add('drag-into-group');
      } else if (relY < (layer.isGroup ? 0.25 : 0.5)) {
        row.classList.add('drag-over-top');
      } else {
        row.classList.add('drag-over-bottom');
      }
    });

    row.addEventListener('dragleave', () => {
      row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-into-group');
    });

    row.addEventListener('drop', (e) => {
      e.preventDefault();
      const isTop = row.classList.contains('drag-over-top');
      const isBottom = row.classList.contains('drag-over-bottom');
      const isIntoGroup = row.classList.contains('drag-into-group');
      row.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-into-group');

      if (this._dragSrc && this._dragSrc !== layer.id) {
        const doc = this.session.document;
        const targetIdx = doc.indexOfID(layer.id);
        if (targetIdx >= 0) {
          if (isIntoGroup && layer.isGroup) {
            // Drop inside group
            this.session.reorderLayer(this._dragSrc, targetIdx, layer.id);
          } else if (isTop) {
            // Visual top in reversed list = higher array index (above layer)
            this.session.reorderLayer(this._dragSrc, targetIdx + 1, layer.parentID);
          } else {
            // Visual bottom in reversed list = lower array index (below layer)
            this.session.reorderLayer(this._dragSrc, targetIdx, layer.parentID);
          }
        }
      }
      this._dragSrc = null;
    });

    row.addEventListener('dragend', () => {
      this._dragSrc = null;
      document.querySelectorAll('.drag-over-top, .drag-over-bottom, .drag-into-group').forEach(el => {
        el.classList.remove('drag-over-top', 'drag-over-bottom', 'drag-into-group');
      });
    });

    // Context menu
    row.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (!this.session.selectedLayerIDs.has(layer.id)) {
        this.session.selectLayer(layer.id);
      }
      this._showContextMenu(layer, e.clientX, e.clientY);
    });

    return row;
  }

  _updateThumbnails() {
    const doc = this.session.document;
    if (!doc) return;
    for (const layer of doc.layers) {
      if (layer.isGroup) continue;
      const row = this.list.querySelector(`[data-id="${layer.id}"]`);
      if (row) {
        const meta = row.querySelector('.layer-meta');
        if (meta) {
          meta.textContent = `${layer.pixelW}×${layer.pixelH}`;
        }
      }
      const thumb = this.list.querySelector(`[data-thumb-for="${layer.id}"]`);
      if (thumb) {
        const thumbUrl = layer.getThumbnailDataURL?.();
        if (thumbUrl) {
          thumb.innerHTML = `<img src="${thumbUrl}" style="width:100%;height:100%;object-fit:contain;" />`;
        }
      }
    }
  }

  // ─── Inline rename ──────────────────────────────────────────────────────────

  _startRename(id, nameEl) {
    if (this._renamingID) return;
    this._renamingID = id;
    const orig = nameEl.textContent;
    const input = document.createElement('input');
    input.className = 'layer-name-input';
    input.value = orig;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    const commit = () => {
      const name = input.value.trim() || orig;
      this.session.renameLayer(id, name);
      this._renamingID = null;
      this._render();
    };
    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.value = orig; commit(); }
    });
  }

  // ─── Context menu ────────────────────────────────────────────────────────────

  _showContextMenu(layer, x, y) {
    const s = this.session;
    const hasClip = s.hasClipboardLayer();

    const shapeOptions = [
      { label: 'None (Standard)', value: 'none' },
      { label: 'Circle / Ellipse', value: 'circle' },
      { label: 'Rounded Rectangle', value: 'rounded-rectangle' },
      { label: 'Star (5-Point)', value: 'star' },
      { label: 'Heart', value: 'heart' },
      { label: 'Diamond', value: 'diamond' },
      { label: 'Triangle', value: 'triangle' },
      { label: 'Hexagon', value: 'hexagon' },
      { label: 'Pentagon', value: 'pentagon' },
      { label: 'Octagon', value: 'octagon' },
      { label: 'Trapezoid', value: 'trapezoid' },
      { label: 'Arrow', value: 'arrow' },
    ];

    const items = [
      {
        label: 'Rename',
        action: () => { const row = this.list.querySelector(`[data-id="${layer.id}"] .layer-name`); if (row) this._startRename(layer.id, row); }
      },
      {
        label: 'Cut',
        shortcut: 'Ctrl+X',
        disabled: layer.isLocked,
        action: () => s.cutLayer(layer.id),
      },
      {
        label: 'Copy',
        shortcut: 'Ctrl+C',
        action: () => s.copyLayer(layer.id),
      },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        disabled: !hasClip,
        action: () => s.pasteLayer(),
      },
      {
        label: 'Duplicate Layer',
        shortcut: 'Ctrl+J',
        action: () => s.duplicateLayer(layer.id),
      },
      {
        label: 'Merge Down',
        shortcut: 'Ctrl+E',
        action: () => s.mergeDown(layer.id),
      },
      { separator: true },
      {
        label: 'Arrange',
        isSubmenu: true,
        submenu: [
          {
            label: 'Bring to Front',
            shortcut: 'Ctrl+Shift+]',
            action: () => s.bringToFront(layer.id),
          },
          {
            label: 'Bring Forward',
            shortcut: 'Ctrl+]',
            action: () => s.bringForward(layer.id),
          },
          {
            label: 'Send Backward',
            shortcut: 'Ctrl+[',
            action: () => s.sendBackward(layer.id),
          },
          {
            label: 'Send to Back',
            shortcut: 'Ctrl+Shift+[',
            action: () => s.sendToBack(layer.id),
          },
        ],
      },
      { separator: true },
      ...(!layer.isGroup ? [
        {
          label: `Frame to Shape (${layer.shapeMask && layer.shapeMask !== 'none' ? layer.shapeMask : 'None'})`,
          isSubmenu: true,
          submenu: shapeOptions.map(opt => ({
            label: opt.label,
            checked: (layer.shapeMask === opt.value || (!layer.shapeMask && opt.value === 'none')),
            action: () => {
              s.beginEdit('Change Layer Shape Frame');
              layer.shapeMask = opt.value;
              layer.markChanged();
              s.endEdit();
              s._emit('canvas-dirty');
            }
          })),
        },
        { separator: true }
      ] : []),
      { label: 'Flip Horizontal',    action: () => s.flipLayerH(layer.id) },
      { label: 'Flip Vertical',      action: () => s.flipLayerV(layer.id) },
      { label: 'Invert Colors',      shortcut: 'Ctrl+I', action: () => s.invertActiveLayer() },
      { label: 'Remove Background (AI)', action: () => removeBackground(s) },
      { label: layer.isLocked ? 'Unlock Layer' : 'Lock Layer', action: () => s.setLayerLocked(layer.id, !layer.isLocked) },
      { separator: true },
      { label: 'Flatten Image',      action: () => s.flattenImage() },
      {
        label: s.selectedLayerIDs.size > 1 ? `Delete Selected Layers (${s.selectedLayerIDs.size})` : 'Delete Layer',
        shortcut: 'Del',
        action: () => s.deleteSelectedLayers(),
        danger: true
      },
    ];

    showContextMenu({ x, y, items });
  }

  _showEmptyContextMenu(x, y) {
    const s = this.session;
    const hasClip = s.hasClipboardLayer();
    const items = [
      {
        label: 'New Layer',
        shortcut: 'Ctrl+Shift+N',
        action: () => s.addBlankLayer(),
      },
      {
        label: 'New Group',
        action: () => s.addGroup(),
      },
      { separator: true },
      {
        label: 'Paste',
        shortcut: 'Ctrl+V',
        disabled: !hasClip,
        action: () => s.pasteLayer(),
      },
      {
        label: 'Paste in Place',
        shortcut: 'Ctrl+Shift+V',
        disabled: !hasClip,
        action: () => s.pasteLayer({ inPlace: true }),
      },
      { separator: true },
      {
        label: 'Flatten Image',
        action: () => s.flattenImage(),
      },
    ];
    showContextMenu({ x, y, items });
  }
}
