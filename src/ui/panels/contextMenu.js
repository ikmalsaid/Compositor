// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/contextMenu.js  —  Universal floating context menu & submenus
// ─────────────────────────────────────────────────────────────────────────────

import { iconCheck } from '../icons.js';

/**
 * Display a modern dark-mode context menu at specified screen coordinates.
 * @param {object} opts
 * @param {number} opts.x - Screen X
 * @param {number} opts.y - Screen Y
 * @param {Array<object>} opts.items - Array of menu item descriptors
 */
export function showContextMenu({ x, y, items }) {
  closeContextMenu();
  if (!items || items.length === 0) return;

  const menu = document.createElement('div');
  menu.className = 'ctx-menu';
  menu.style.cssText = `
    position: fixed; left: ${x}px; top: ${y}px; z-index: 2200;
    background: var(--panel-bg-2, #282828); border: 1px solid var(--panel-border, #3a3a3a);
    border-radius: 6px; padding: 4px 0; min-width: 180px;
    box-shadow: 0 10px 28px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
    font-size: 12px; user-select: none; font-family: var(--font-sans, system-ui, -apple-system, sans-serif);
    color: var(--text, #e0e0e0);
  `;

  function buildItems(parentMenu, itemList) {
    for (const item of itemList) {
      if (item.separator) {
        const sep = document.createElement('div');
        sep.style.cssText = 'height: 1px; background: var(--panel-border, #3a3a3a); margin: 4px 0;';
        parentMenu.appendChild(sep);
        continue;
      }

      const row = document.createElement('div');
      row.className = `ctx-item${item.disabled ? ' disabled' : ''}${item.danger ? ' danger' : ''}`;
      row.style.cssText = `
        display: flex; align-items: center; justify-content: space-between;
        padding: 5px 12px; cursor: ${item.disabled ? 'default' : 'pointer'}; position: relative;
        color: ${item.disabled ? 'var(--text-muted, #777)' : item.danger ? 'var(--danger, #ff4d4f)' : 'var(--text, #e0e0e0)'};
        opacity: ${item.disabled ? '0.5' : '1'};
        gap: 16px;
      `;

      const leftSpan = document.createElement('span');
      leftSpan.style.cssText = 'display: flex; align-items: center; gap: 6px; white-space: nowrap;';
      if (item.checked !== undefined) {
        const check = document.createElement('span');
        check.style.cssText = 'width: 14px; display: inline-flex; align-items: center; justify-content: center; color: var(--accent, #4f8ef7);';
        check.innerHTML = item.checked ? iconCheck(11) : '';
        leftSpan.appendChild(check);
      }
      const labelText = document.createElement('span');
      labelText.textContent = item.label;
      leftSpan.appendChild(labelText);
      row.appendChild(leftSpan);

      if (item.shortcut) {
        const scSpan = document.createElement('span');
        scSpan.style.cssText = 'color: var(--text-muted, #888); font-size: 11px; font-family: var(--font-mono, monospace); margin-left: auto; padding-left: 12px;';
        scSpan.textContent = item.shortcut;
        row.appendChild(scSpan);
      } else if (item.isSubmenu || (item.submenu && item.submenu.length > 0)) {
        const arrow = document.createElement('span');
        arrow.style.cssText = 'color: var(--text-muted, #888); font-size: 10px; margin-left: auto; padding-left: 8px;';
        arrow.textContent = '▸';
        row.appendChild(arrow);
      }

      if (!item.disabled) {
        row.addEventListener('mouseenter', () => {
          row.style.background = 'var(--hover, rgba(255,255,255,0.08))';
          // Close other submenus in same parent
          parentMenu.querySelectorAll(':scope > .ctx-item > .ctx-submenu').forEach(s => s.remove());

          if (item.submenu && item.submenu.length > 0) {
            const sub = document.createElement('div');
            sub.className = 'ctx-submenu';
            sub.style.cssText = `
              position: absolute; top: -4px; z-index: 2201;
              background: var(--panel-bg-2, #282828); border: 1px solid var(--panel-border, #3a3a3a);
              border-radius: 6px; padding: 4px 0; min-width: 160px;
              box-shadow: 0 10px 28px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4);
              font-size: 12px;
            `;
            buildItems(sub, item.submenu);
            row.appendChild(sub);

            // Position submenu relative to row
            const rowRect = row.getBoundingClientRect();
            const subRect = sub.getBoundingClientRect();

            if (rowRect.right + subRect.width > window.innerWidth - 8) {
              sub.style.left = 'auto';
              sub.style.right = '100%';
            } else {
              sub.style.left = '100%';
              sub.style.right = 'auto';
            }

            if (rowRect.top + subRect.height > window.innerHeight - 8) {
              sub.style.top = `${Math.max(-subRect.height + rowRect.height, -(rowRect.top - 8))}px`;
            }
          }
        });

        row.addEventListener('mouseleave', (e) => {
          if (!row.contains(e.relatedTarget)) {
            row.style.background = '';
          }
        });

        if (!item.submenu) {
          row.addEventListener('click', (ev) => {
            ev.stopPropagation();
            closeContextMenu();
            item.action?.();
          });
        }
      }

      parentMenu.appendChild(row);
    }
  }

  buildItems(menu, items);
  document.body.appendChild(menu);

  // Position and clamp main menu
  const rect = menu.getBoundingClientRect();
  let posX = x;
  let posY = y;
  if (posX + rect.width > window.innerWidth - 8) {
    posX = Math.max(8, window.innerWidth - rect.width - 8);
  }
  if (posY + rect.height > window.innerHeight - 8) {
    posY = Math.max(8, window.innerHeight - rect.height - 8);
  }
  menu.style.left = `${posX}px`;
  menu.style.top = `${posY}px`;

  const dismiss = (e) => {
    if (!menu.contains(e.target)) {
      closeContextMenu();
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      closeContextMenu();
      document.removeEventListener('mousedown', dismiss, true);
      document.removeEventListener('keydown', onKeyDown, true);
    }
  };
  setTimeout(() => {
    document.addEventListener('mousedown', dismiss, true);
    document.addEventListener('keydown', onKeyDown, true);
  }, 0);
}

export function closeContextMenu() {
  document.querySelectorAll('.ctx-menu').forEach(el => el.remove());
}
