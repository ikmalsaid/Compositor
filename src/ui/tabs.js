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

  addTab(session, title) {
    const id = crypto.randomUUID();
    const name = title ?? this.getNextUntitledTitle();
    const tab = { id, session, title: name, modified: false };
    this.tabs.push(tab);

    // Keep tab title + modified state in sync
    session.on('change', () => {
      tab.modified = Boolean(session.isModified || session.history?.isModified);
      tab.title    = session.projectURL
        ? session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '')
        : name;
      this._render();
      this._updateWindowTitle();
    });

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
    this.tabs.splice(idx, 1);

    if (this.tabs.length === 0) {
      // Always keep at least one tab named 'Untitled'
      const newSession = new EditorSession();
      newSession.createDefaultDocument(1920, 1080);
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
    const mod = tab.modified ? ' ●' : '';
    window.api?.setWindowTitle(`${tab.title}${mod} — Compositor`);
  }

  _render() {
    if (!this.el) return;
    this.el.innerHTML = '';
    for (const tab of this.tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === this.activeID ? ' active' : '');
      el.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;flex:1">${tab.title}</span>
        ${tab.modified ? '<span class="tab-modified">●</span>' : ''}
        <span class="tab-close" data-close="${tab.id}" style="display:flex;align-items:center;justify-content:center">${iconClose(10)}</span>
      `;
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
      s.createDefaultDocument(1920, 1080);
      this.addTab(s);
    });
    this.el.appendChild(add);
  }
}
