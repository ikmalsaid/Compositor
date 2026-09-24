// ─────────────────────────────────────────────────────────────────────────────
// ui/tabs.js  —  Multi-project tab strip (mirrors ProjectWorkspace.swift)
// ─────────────────────────────────────────────────────────────────────────────

import { EditorSession } from '../store/session.js';
import { iconClose } from './icons.js';

export class TabStrip {
  constructor(onTabChange, options = {}) {
    this.el             = document.getElementById('tabs');
    this.onTabChange    = onTabChange; // (session) => void
    this.onConfirmClose = options.onConfirmClose ?? null; // async (tab) => 'save' | 'discard' | 'cancel'
    this.onSaveTab      = options.onSaveTab ?? null;      // async (tab) => boolean
    this.tabs           = [];          // [{ id, session, title, modified }]
    this.activeID       = null;
    this._render();
  }

  get activeTab() { return this.tabs.find(t => t.id === this.activeID) ?? null; }
  get activeSession() { return this.activeTab?.session ?? null; }

  getNextUntitledTitle() {
    const existingTitles = new Set(this.tabs.map(t => t.title));
    if (!existingTitles.has('Untitled')) {
      return 'Untitled';
    }
    let counter = 2;
    while (existingTitles.has(`Untitled ${counter}`)) {
      counter++;
    }
    return `Untitled ${counter}`;
  }

  getDisplayTitle(tab) {
    if (!tab) return '';
    const baseName = tab.title || tab.session?.document?.name || 'Untitled';
    const s = tab.session;
    if (!s || !s.document) return baseName;

    const scale = s.viewScale ?? 1;
    const pct = scale * 100;
    const zoomStr = (Math.abs(pct - Math.round(pct)) < 0.05)
      ? `${Math.round(pct)}%`
      : `${pct.toFixed(1)}%`;

    const activeLayer = s.activeLayer;
    const selectedCount = s.selectedLayerIDs?.size || 0;
    let layerStr = 'Layer';
    if (selectedCount > 1) {
      layerStr = `${selectedCount} Layers`;
    } else if (activeLayer && !activeLayer.isGroup) {
      layerStr = activeLayer.name || 'Layer';
    } else if (activeLayer && activeLayer.isGroup) {
      layerStr = activeLayer.name || 'Group';
    } else if (s.document.layers && s.document.layers.length > 0) {
      layerStr = s.document.layers[s.document.layers.length - 1].name || 'Layer';
    }

    const colorMode = 'RGB/8';
    const modStr = tab.modified ? ' *' : '';
    return `${baseName} @ ${zoomStr} (${layerStr}, ${colorMode})${modStr}`;
  }

  addTab(session, title) {
    const id = crypto.randomUUID();
    const hasCustomDocName = session.document?.name && !session.document.name.startsWith('Untitled');
    const name = title ?? (hasCustomDocName ? session.document.name : this.getNextUntitledTitle());
    if (session.document && (!session.document.name || session.document.name === 'Untitled' || !title)) {
      session.document.name = name;
    }
    const modified = Boolean(session.isModified || session.history?.isModified);
    const tab = { id, session, title: session.document?.name || name, modified };
    this.tabs.push(tab);

    // Keep tab title + modified state in sync
    const onUpdate = () => {
      tab.modified = Boolean(session.isModified || session.history?.isModified);
      if (session.projectURL) {
        const projName = session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '');
        tab.title = projName;
        if (session.document) session.document.name = projName;
      } else if (session.document?.name) {
        tab.title = session.document.name;
      } else {
        tab.title = name;
      }
      this._render();
      this._updateWindowTitle();
    };

    tab._onUpdate = onUpdate;
    session.on('change', onUpdate);
    session.on('zoom-change', onUpdate);
    session.on('selection-change', onUpdate);

    this._selectTab(id);
    return tab;
  }

  async closeTab(id) {
    const tab = this.tabs.find(t => t.id === id);
    if (!tab) return false;

    const isDirty = Boolean(tab.modified || tab.session?.isModified || tab.session?.history?.canUndo);
    if (isDirty && this.onConfirmClose) {
      const action = await this.onConfirmClose(tab);
      if (action === 'cancel') {
        return false;
      }
      if (action === 'save') {
        if (this.onSaveTab) {
          const saved = await this.onSaveTab(tab);
          if (!saved) return false; // user cancelled save dialog or save failed
        }
      }
      // 'discard' falls through to remove tab
    }

    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx < 0) return false;
    const [removedTab] = this.tabs.splice(idx, 1);
    if (removedTab && removedTab._onUpdate && removedTab.session) {
      removedTab.session.off('change', removedTab._onUpdate);
      removedTab.session.off('zoom-change', removedTab._onUpdate);
      removedTab.session.off('selection-change', removedTab._onUpdate);
    }

    if (this.tabs.length === 0) {
      // Always keep at least one tab named 'Untitled'
      const newSession = new EditorSession();
      newSession.createDefaultDocument(1920, 1080, 72, 'white', '#ffffff', 'Untitled');
      this.addTab(newSession, 'Untitled');
      return true;
    }

    if (this.activeID === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this._selectTab(next.id);
    }
    this._render();
    return true;
  }

  _selectTab(id) {
    this.activeID = id;
    const session = this.activeSession;
    if (session) this.onTabChange(session);
    this._render();
    this._updateWindowTitle();
  }

  _updateWindowTitle() {
    const tab = this.activeTab;
    if (!tab) return;
    const displayTitle = this.getDisplayTitle(tab);
    window.api?.setWindowTitle(`${displayTitle} — Compositor`);
  }

  _startRename(tabId, titleEl) {
    const tab = this.tabs.find(t => t.id === tabId);
    if (!tab || this._renamingID) return;
    this._renamingID = tabId;

    const orig = tab.title;
    const input = document.createElement('input');
    input.className = 'tab-rename-input';
    input.value = orig;
    input.style.cssText = 'background:rgba(0,0,0,0.6);border:1px solid var(--accent,#4f8ef7);border-radius:3px;color:#fff;font-size:11px;padding:1px 5px;outline:none;width:100%;max-width:130px;box-sizing:border-box';

    titleEl.replaceWith(input);
    input.focus();
    input.select();

    const commit = () => {
      if (this._renamingID !== tabId) return;
      this._renamingID = null;
      const newName = input.value.trim() || orig;
      tab.title = newName;
      if (tab.session?.document) {
        tab.session.document.name = newName;
        tab.session._emit('change');
      }
      this._render();
      this._updateWindowTitle();
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { input.value = orig; commit(); }
    });
  }

  _render() {
    if (!this.el) return;
    this.el.innerHTML = '';
    for (const tab of this.tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === this.activeID ? ' active' : '');
      const displayTitle = this.getDisplayTitle(tab);
      el.title = displayTitle;
      el.innerHTML = `
        <span class="tab-title" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1;cursor:default">${displayTitle}</span>
        ${tab.modified ? '<span class="tab-modified" style="display:none">●</span>' : ''}
        <span class="tab-close" data-close="${tab.id}" style="display:flex;align-items:center;justify-content:center">${iconClose(10)}</span>
      `;

      const titleSpan = el.querySelector('.tab-title');
      if (titleSpan) {
        titleSpan.addEventListener('dblclick', (e) => {
          e.stopPropagation();
          this._startRename(tab.id, titleSpan);
        });
      }

      el.addEventListener('click', async (e) => {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) {
          e.stopPropagation();
          await this.closeTab(closeBtn.dataset.close);
        } else {
          this._selectTab(tab.id);
        }
      });
      this.el.appendChild(el);
    }

    // New tab button
    const add = document.createElement('div');
    add.className = 'tab-add';
    add.textContent = '+';
    add.title = 'New Tab';
    add.addEventListener('click', () => {
      const s = new EditorSession();
      const nextTitle = this.getNextUntitledTitle();
      s.createDefaultDocument(1920, 1080, 72, 'white', '#ffffff', nextTitle);
      this.addTab(s, nextTitle);
    });
    this.el.appendChild(add);
  }
}
