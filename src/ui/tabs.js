// ─────────────────────────────────────────────────────────────────────────────
// ui/tabs.js  —  Multi-project tab strip (mirrors ProjectWorkspace.swift)
// ─────────────────────────────────────────────────────────────────────────────

import { EditorSession } from '../store/session.js';
import { iconClose } from './icons.js';

export class TabStrip {
  constructor(onTabChange) {
    this.el          = document.getElementById('tabs');
    this.onTabChange = onTabChange; // (session) => void
    this.tabs        = [];          // [{ id, session, title, modified }]
    this.activeID    = null;
    this._untitledCount = 1;
    this._render();
  }

  get activeTab() { return this.tabs.find(t => t.id === this.activeID) ?? null; }
  get activeSession() { return this.activeTab?.session ?? null; }

  addTab(session, title) {
    const id = crypto.randomUUID();
    const name = title ?? `Untitled${this._untitledCount > 1 ? ' ' + this._untitledCount : ''}`;
    this._untitledCount++;
    const tab = { id, session, title: name, modified: false };
    this.tabs.push(tab);

    // Keep tab title + modified state in sync
    session.on('change', () => {
      tab.modified = session.isModified;
      tab.title    = session.projectURL
        ? session.projectURL.split(/[/\\]/).pop().replace(/\.compositor$/, '')
        : name;
      this._render();
      this._updateWindowTitle();
    });

    this._selectTab(id);
    return tab;
  }

  closeTab(id) {
    const idx = this.tabs.findIndex(t => t.id === id);
    if (idx < 0) return;
    this.tabs.splice(idx, 1);
    if (this.tabs.length === 0) {
      // Always keep at least one tab
      const newSession = new EditorSession();
      newSession.createDefaultDocument(1920, 1080);
      this.addTab(newSession);
      return;
    }
    if (this.activeID === id) {
      const next = this.tabs[Math.min(idx, this.tabs.length - 1)];
      this._selectTab(next.id);
    }
    this._render();
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
    this.el.innerHTML = '';
    for (const tab of this.tabs) {
      const el = document.createElement('div');
      el.className = 'tab' + (tab.id === this.activeID ? ' active' : '');
      el.innerHTML = `
        <span style="overflow:hidden;text-overflow:ellipsis;flex:1">${tab.title}</span>
        ${tab.modified ? '<span class="tab-modified">●</span>' : ''}
        <span class="tab-close" data-close="${tab.id}" style="display:flex;align-items:center;justify-content:center">${iconClose(10)}</span>
      `;
      el.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close]');
        if (closeBtn) {
          e.stopPropagation();
          this.closeTab(closeBtn.dataset.close);
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
