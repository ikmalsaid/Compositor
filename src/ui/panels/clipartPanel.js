// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/clipartPanel.js  —  MS Word-Style Clipart Gallery & Vector Library
// ─────────────────────────────────────────────────────────────────────────────

import {
  CLIPART_CATEGORIES,
  BUILTIN_CLIPARTS,
  CATEGORY_COUNTS,
  getCustomCliparts,
  addCustomClipart,
  removeCustomClipart,
  getAllCliparts
} from '../../assets/clipartData.js';
import { iconClose, iconSearch, iconCheck } from '../icons.js';

let _activeModal = null;

/**
 * Open the Clip Art Gallery Modal
 * @param {EditorSession} session
 * @param {Function} [onInserted]
 */
export function showClipartPanel(session, onInserted) {
  if (_activeModal) {
    _activeModal.remove();
    _activeModal = null;
  }

  let activeCat = 'all';
  let searchQuery = '';
  const initialAll = getAllCliparts();
  let selectedClipart = initialAll[0] || null;
  let insertSize = 400;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.75);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:99999;opacity:1;';

  const modal = document.createElement('div');
  modal.className = 'modal clipart-modal';
  modal.style.cssText = `
    width: 860px; max-width: 95vw; height: 580px; max-height: 90vh;
    display: flex; flex-direction: column; border-radius: 10px;
    box-shadow: 0 24px 64px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.08);
    background: #18181c; color: #e2e2e8; overflow: hidden;
    font-family: var(--font-sans); font-size: 12px; user-select: none;
    animation: fadeIn 0.15s ease-out;
  `;

  modal.innerHTML = `
    <!-- Top Header -->
    <div style="height:44px;padding:0 18px;display:flex;align-items:center;justify-content:space-between;background:#141417;border-bottom:1px solid rgba(255,255,255,0.08);flex-shrink:0">
      <div style="font-size:13.5px;font-weight:600;color:#ffffff;display:flex;align-items:center;gap:8px">
        <i class="fa-solid fa-icons" style="color:var(--accent,#4f8ef7);font-size:15px"></i>
        <span>Vector Clipart Gallery</span>
      </div>
      <button id="ca-close-btn" style="background:transparent;border:none;color:#8c8c94;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all .12s" title="Close (Esc)">${iconClose(14)}</button>
    </div>

    <!-- Toolbar & Search -->
    <div style="display:flex;align-items:center;justify-content:space-between;padding:0 16px;background:#1b1b20;border-bottom:1px solid rgba(255,255,255,0.06);height:44px;flex-shrink:0">
      <div style="display:flex;align-items:center;gap:10px">
        <button class="btn btn-secondary btn-sm" id="ca-import-btn" style="font-size:11.5px;padding:5px 12px;display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);color:#fff">
          <i class="fa-solid fa-cloud-arrow-up" style="color:var(--accent,#4f8ef7)"></i>
          <span>Import Clipart (SVG)...</span>
        </button>
        <input type="file" id="ca-file-input" accept=".svg,image/svg+xml" style="display:none" multiple />
      </div>

      <div style="position:relative;width:240px">
        <input type="text" id="ca-search-input" placeholder="Search cliparts by name or tags…" style="width:100%;height:28px;padding:2px 28px 2px 10px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;font-size:11.5px;outline:none;box-sizing:border-box" />
        <span style="position:absolute;right:8px;top:7px;color:#888;pointer-events:none">${iconSearch(13)}</span>
      </div>
    </div>

    <!-- Main Content Area -->
    <div style="flex:1;display:flex;min-height:0;background:#18181c">
      <!-- Left Category Sidebar -->
      <div id="ca-sidebar" style="width:180px;min-width:180px;background:#141417;border-right:1px solid rgba(255,255,255,0.07);padding:10px 8px;overflow-y:auto;display:flex;flex-direction:column;gap:3px">
        <!-- Rendered dynamically -->
      </div>

      <!-- Center Clipart Grid -->
      <div style="flex:1;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column" id="ca-grid-container">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div style="font-size:11.5px;font-weight:600;color:rgba(255,255,255,0.7);text-transform:uppercase;letter-spacing:0.5px" id="ca-grid-title">All Cliparts</div>
          <div style="font-size:11px;color:rgba(255,255,255,0.4)" id="ca-grid-count"></div>
        </div>
        <div id="ca-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(115px, 1fr));gap:10px">
          <!-- Injected dynamically -->
        </div>
        <div id="ca-status-msg" style="display:none;padding:50px 16px;text-align:center;color:#888;font-size:12px"></div>
      </div>

      <!-- Right Inspector / Preview Pane -->
      <div style="width:235px;min-width:235px;background:#1e1e24;border-left:1px solid rgba(255,255,255,0.07);padding:14px;display:flex;flex-direction:column;gap:12px;overflow-y:auto">
        <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px">Preview & Options</div>

        <div id="ca-preview-box" style="width:100%;height:150px;background:#141417;border:1px solid rgba(255,255,255,0.08);border-radius:6px;display:flex;align-items:center;justify-content:center;padding:10px;box-sizing:border-box">
          <!-- Live SVG Preview -->
        </div>

        <div id="ca-preview-name" style="font-size:12.5px;font-weight:600;color:#fff;text-align:center;word-break:break-word"></div>

        <div>
          <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Insert Size</label>
          <select class="form-input" id="ca-size-sel" style="width:100%;padding:4px 6px">
            <option value="200">Small (200 × 200 px)</option>
            <option value="400" selected>Medium (400 × 400 px)</option>
            <option value="800">Large (800 × 800 px)</option>
            <option value="1200">Extra Large (1200 px)</option>
          </select>
        </div>

        <div style="margin-top:auto;display:flex;flex-direction:column;gap:8px">
          <button class="btn btn-primary" id="ca-insert-btn" style="width:100%;height:32px;font-weight:600;font-size:12px;display:flex;align-items:center;justify-content:center;gap:6px">
            ${iconCheck(13)} <span>Insert to Canvas</span>
          </button>
        </div>
      </div>
    </div>
  `;

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _activeModal = overlay;

  const close = () => {
    overlay.remove();
    _activeModal = null;
  };

  modal.querySelector('#ca-close-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      window.removeEventListener('keydown', onKey);
      close();
    }
  };
  window.addEventListener('keydown', onKey);

  // ─── Rendering helpers ───

  const getFilteredItems = () => {
    const all = getAllCliparts();
    return all.filter(item => {
      if (activeCat === 'custom') {
        if (!item.isCustom && item.category !== 'custom') return false;
      } else if (activeCat !== 'all') {
        if (item.category !== activeCat) return false;
      }

      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchTitle = (item.title || item.name || '').toLowerCase().includes(q);
        const matchTags = Array.isArray(item.tags) && item.tags.some(t => t.toLowerCase().includes(q));
        return matchTitle || matchTags;
      }
      return true;
    });
  };

  const renderCategories = () => {
    const sidebar = modal.querySelector('#ca-sidebar');
    sidebar.innerHTML = '';

    const all = getAllCliparts();
    const customCount = getCustomCliparts().length;

    for (const cat of CLIPART_CATEGORIES) {
      let count = 0;
      if (cat.id === 'all') {
        count = all.length;
      } else if (cat.id === 'custom') {
        count = customCount;
      } else {
        count = CATEGORY_COUNTS[cat.id] || 0;
      }

      const btn = document.createElement('button');
      btn.className = `ca-cat-btn ${activeCat === cat.id ? 'active' : ''}`;
      btn.style.cssText = `
        text-align: left; padding: 6px 10px; border-radius: 5px; border: none;
        background: ${activeCat === cat.id ? 'rgba(79, 142, 247, 0.16)' : 'transparent'};
        color: ${activeCat === cat.id ? '#4f8ef7' : '#aaa'};
        font-size: 11.5px; font-weight: ${activeCat === cat.id ? '600' : 'normal'};
        cursor: pointer; transition: all 0.1s; display: flex; align-items: center; justify-content: space-between;
      `;
      btn.innerHTML = `
        <span>${cat.label}</span>
        <span style="font-size:10px;opacity:0.6">${count}</span>
      `;
      btn.addEventListener('click', () => {
        activeCat = cat.id;
        renderCategories();
        renderGrid();
      });
      sidebar.appendChild(btn);
    }
  };

  const updatePreview = (item) => {
    selectedClipart = item;
    const box = modal.querySelector('#ca-preview-box');
    const nameEl = modal.querySelector('#ca-preview-name');
    if (!item) {
      box.innerHTML = '<span style="color:#666">Select an item</span>';
      nameEl.textContent = '';
      return;
    }

    nameEl.textContent = item.title || item.name;
    if (item.svg) {
      box.innerHTML = item.svg;
      const svgEl = box.querySelector('svg');
      if (svgEl) {
        svgEl.style.width = '100%';
        svgEl.style.height = '100%';
        svgEl.style.objectFit = 'contain';
      }
    }
  };

  let currentFiltered = [];
  let renderedCount = 0;
  const BATCH_SIZE = 60;

  const getSvgThumbUrl = (svgStr) => {
    if (!svgStr) return '';
    return `data:image/svg+xml;utf8,${encodeURIComponent(svgStr)}`;
  };

  const createCard = (item) => {
    const card = document.createElement('div');
    const isSel = selectedClipart?.id === item.id;
    card.className = 'ca-card';
    card.dataset.id = item.id;
    card.style.cssText = `
      height: 110px; background: #1f1f26; border-radius: 6px;
      border: 1.5px solid ${isSel ? 'var(--accent, #4f8ef7)' : 'rgba(255,255,255,0.06)'};
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 8px; box-sizing: border-box; cursor: pointer; transition: all 0.12s; position: relative;
    `;
    card.innerHTML = `
      ${item.isCustom ? `<button class="ca-del-btn" data-del-id="${item.id}" title="Remove custom clipart" style="position:absolute;top:3px;right:3px;width:18px;height:18px;background:rgba(0,0,0,0.7);border:none;color:#aaa;border-radius:3px;cursor:pointer;display:none;align-items:center;justify-content:center;font-size:10px">${iconClose(10)}</button>` : ''}
      <div style="flex:1;width:100%;display:flex;align-items:center;justify-content:center;overflow:hidden">
        <img src="${getSvgThumbUrl(item.svg)}" width="56" height="56" style="width:56px;height:56px;object-fit:contain;pointer-events:none" alt="${item.title || item.name}" loading="lazy" />
      </div>
      <div style="font-size:10.5px;color:#bbb;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;width:100%;margin-top:4px">${item.title || item.name}</div>
    `;

    if (item.isCustom) {
      const delBtn = card.querySelector('.ca-del-btn');
      if (delBtn) {
        card.addEventListener('mouseenter', () => delBtn.style.display = 'flex');
        card.addEventListener('mouseleave', () => delBtn.style.display = 'none');
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeCustomClipart(item.id);
          renderCategories();
          renderGrid();
          if (selectedClipart?.id === item.id) {
            const remaining = getFilteredItems();
            updatePreview(remaining[0] || null);
          }
        });
      }
    }

    card.addEventListener('click', () => {
      modal.querySelectorAll('.ca-card').forEach(c => c.style.borderColor = 'rgba(255,255,255,0.06)');
      card.style.borderColor = 'var(--accent, #4f8ef7)';
      updatePreview(item);
    });

    card.addEventListener('dblclick', () => {
      updatePreview(item);
      doInsert();
    });

    return card;
  };

  const renderNextBatch = () => {
    if (renderedCount >= currentFiltered.length) return;
    const grid = modal.querySelector('#ca-grid');
    const batch = currentFiltered.slice(renderedCount, renderedCount + BATCH_SIZE);
    const fragment = document.createDocumentFragment();
    for (const item of batch) {
      fragment.appendChild(createCard(item));
    }
    grid.appendChild(fragment);
    renderedCount += batch.length;
  };

  const renderGrid = () => {
    const grid = modal.querySelector('#ca-grid');
    const titleEl = modal.querySelector('#ca-grid-title');
    const countEl = modal.querySelector('#ca-grid-count');
    const statusMsg = modal.querySelector('#ca-status-msg');
    const gridContainer = modal.querySelector('#ca-grid-container');

    grid.innerHTML = '';
    statusMsg.style.display = 'none';
    if (gridContainer) gridContainer.scrollTop = 0;

    currentFiltered = getFilteredItems();
    renderedCount = 0;

    const catObj = CLIPART_CATEGORIES.find(c => c.id === activeCat);
    titleEl.textContent = catObj ? catObj.label : 'Cliparts';
    countEl.textContent = `${currentFiltered.length} items`;

    if (currentFiltered.length === 0) {
      statusMsg.style.display = 'block';
      statusMsg.textContent = activeCat === 'custom'
        ? 'No custom cliparts yet. Click "Import Clipart (SVG)..." to add your own SVG files!'
        : 'No matching cliparts found';
      return;
    }

    renderNextBatch();
  };

  const gridContainer = modal.querySelector('#ca-grid-container');
  if (gridContainer) {
    gridContainer.addEventListener('scroll', () => {
      if (gridContainer.scrollTop + gridContainer.clientHeight >= gridContainer.scrollHeight - 300) {
        renderNextBatch();
      }
    });
  }

  // ─── Import Handling ───

  const fileInput = modal.querySelector('#ca-file-input');
  const importBtn = modal.querySelector('#ca-import-btn');

  importBtn.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') continue;
      const text = await file.text();
      if (text.includes('<svg')) {
        const cleanName = file.name.replace(/\.svg$/i, '').replace(/[-_]/g, ' ');
        const entry = addCustomClipart({
          name: cleanName,
          svg: text,
          tags: ['custom', cleanName.toLowerCase()]
        });
        if (entry) {
          selectedClipart = entry;
        }
      }
    }

    fileInput.value = '';
    activeCat = 'custom';
    renderCategories();
    renderGrid();
    if (selectedClipart) {
      updatePreview(selectedClipart);
    }
  });

  // ─── Search & Controls ───
  let searchTimer = null;
  const searchInput = modal.querySelector('#ca-search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      searchQuery = searchInput.value.trim();
      renderGrid();
    }, 150);
  });

  modal.querySelector('#ca-size-sel').addEventListener('change', (e) => {
    insertSize = parseInt(e.target.value, 10) || 400;
  });

  const doInsert = async () => {
    if (!selectedClipart) return;
    const insertBtn = modal.querySelector('#ca-insert-btn');
    insertBtn.disabled = true;
    insertBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Inserting…</span>';

    try {
      await session.insertClipart(selectedClipart.svg, selectedClipart.title || selectedClipart.name, {
        width: insertSize,
        height: insertSize,
      });
      if (onInserted) onInserted(selectedClipart);
      close();
    } catch (err) {
      console.error('Failed to insert clipart:', err);
      insertBtn.disabled = false;
      insertBtn.innerHTML = `${iconCheck(13)} <span>Insert to Canvas</span>`;
    }
  };

  modal.querySelector('#ca-insert-btn').addEventListener('click', doInsert);

  renderCategories();
  renderGrid();
  if (selectedClipart) {
    updatePreview(selectedClipart);
  }
}

// Global hook for context menu and shortcuts
if (typeof window !== 'undefined') {
  window._showClipartPanel = showClipartPanel;
}
