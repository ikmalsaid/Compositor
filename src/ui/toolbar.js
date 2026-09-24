// ─────────────────────────────────────────────────────────────────────────────
// ui/toolbar.js  —  Left-side tool palette with FontAwesome 6 icons & prominent color swatches
// ─────────────────────────────────────────────────────────────────────────────

import { Tool } from '../store/session.js';
import {
  iconCursor, iconMove, iconMarquee, iconLasso, iconWand, iconCrop,
  iconEyedropper, iconBrush, iconEraser, iconClone, iconHeal,
  iconBlur, iconGradient, iconBucket, iconShape, iconText,
  iconHand, iconZoom, iconSwap, iconResetColor
} from './icons.js';

const TOOLS = [
  { id: Tool.CURSOR,     icon: iconCursor(15),     label: 'Cursor / Select', key: 'V' },
  { id: Tool.MOVE,       icon: iconMove(15),       label: 'Move / Transform',key: 'M' },
  { id: Tool.MARQUEE,    icon: iconMarquee(15),    label: 'Marquee Rect',   key: 'Q' },
  { id: Tool.LASSO,      icon: iconLasso(15),      label: 'Lasso',          key: 'L' },
  { id: Tool.WAND,       icon: iconWand(15),       label: 'Magic Wand',     key: 'W' },
  null, // separator
  { id: Tool.CROP,       icon: iconCrop(15),       label: 'Crop Tool',      key: 'C' },
  { id: Tool.EYEDROPPER, icon: iconEyedropper(15), label: 'Eyedropper',     key: 'I' },
  null,
  { id: Tool.BRUSH,      icon: iconBrush(15),      label: 'Brush Tool',     key: 'B' },
  { id: Tool.ERASER,     icon: iconEraser(15),     label: 'Eraser Tool',    key: 'E' },
  { id: Tool.CLONE,      icon: iconClone(15),      label: 'Clone Stamp',    key: 'S' },
  { id: Tool.HEAL,       icon: iconHeal(15),       label: 'Spot Healing',   key: 'J' },
  { id: Tool.BLUR,       icon: iconBlur(15),       label: 'Blur Tool',      key: 'R' },
  null,
  { id: Tool.GRADIENT,   icon: iconGradient(15),   label: 'Gradient Tool',  key: 'G' },
  { id: Tool.BUCKET,     icon: iconBucket(15),     label: 'Paint Bucket',   key: 'K' },
  { id: Tool.SHAPE,      icon: iconShape(15),      label: 'Shape Tool',     key: 'U' },
  { id: Tool.TEXT,       icon: iconText(15),       label: 'Text Tool',      key: 'T' },
  null,
  { id: Tool.HAND,       icon: iconHand(15),       label: 'Hand (Pan)',     key: 'H' },
  { id: Tool.ZOOM,       icon: iconZoom(15),       label: 'Zoom Tool',      key: 'Z' },
];

export class Toolbar {
  constructor(session) {
    this.el = document.getElementById('toolbar');
    this._session = null;
    this._handlers = null;
    this.session = session;
    this._render();
    this.setSession(session);
  }

  setSession(session) {
    if (this._session && this._handlers) {
      this._session.off('tool-change', this._handlers.toolChange);
      this._session.off('color-change', this._handlers.colorChange);
    }
    this._session = session;
    this.session = session;
    if (session) {
      this._handlers = {
        toolChange: () => this._updateActive(),
        colorChange: () => this._updateColors(),
      };
      session.on('tool-change', this._handlers.toolChange);
      session.on('color-change', this._handlers.colorChange);
    }
    this._updateActive();
    this._updateColors();
  }

  _render() {
    this.el.innerHTML = '';

    const toolList = document.createElement('div');
    toolList.className = 'tool-list';
    toolList.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;width:100%;';

    for (const tool of TOOLS) {
      if (!tool) {
        const sep = document.createElement('div');
        sep.className = 'tool-separator';
        toolList.appendChild(sep);
        continue;
      }

      const btn = document.createElement('button');
      btn.className = 'tool-btn';
      btn.dataset.tool = tool.id;

      btn.innerHTML = `
        ${tool.icon}
        <span class="tool-tooltip">${tool.label}<span style="margin-left:8px;opacity:.5">${tool.key}</span></span>
      `;

      btn.addEventListener('click', () => {
        this.session.setTool(tool.id);
      });

      toolList.appendChild(btn);
    }

    this.el.appendChild(toolList);

    // Separator between tools and color module
    const midSep = document.createElement('div');
    midSep.className = 'tool-separator';
    midSep.style.margin = '6px 0 6px 0';
    this.el.appendChild(midSep);

    // High-visibility, prominent Photoshop-style Overlapping Color Swatches
    const colorModule = document.createElement('div');
    colorModule.className = 'ps-color-module';
    colorModule.innerHTML = `
      <div class="swatches-box-container">
        <div class="swatch-box swatch-bg" id="swatch-bg" title="Background Color — Click to choose"></div>
        <div class="swatch-box swatch-fg" id="swatch-fg" title="Foreground Color — Click to choose"></div>
      </div>
      <div class="swatches-actions-row">
        <button class="color-mini-btn" id="swatch-reset" title="Default Colors (D) — Black & White">${iconResetColor(10)}</button>
        <button class="color-mini-btn" id="swatch-swap" title="Swap Colors (X)">${iconSwap(11)}</button>
      </div>
      <input type="color" id="hidden-color-picker" style="opacity:0;position:absolute;pointer-events:none;width:0;height:0;" />
    `;

    this.el.appendChild(colorModule);

    const fgEl = colorModule.querySelector('#swatch-fg');
    const bgEl = colorModule.querySelector('#swatch-bg');
    const swapBtn = colorModule.querySelector('#swatch-swap');
    const resetBtn = colorModule.querySelector('#swatch-reset');
    const colorPicker = colorModule.querySelector('#hidden-color-picker');

    let pickingTarget = 'fg';

    fgEl.addEventListener('click', () => {
      pickingTarget = 'fg';
      colorPicker.value = this.session.fgColor;
      colorPicker.click();
    });

    bgEl.addEventListener('click', () => {
      pickingTarget = 'bg';
      colorPicker.value = this.session.bgColor;
      colorPicker.click();
    });

    colorPicker.addEventListener('input', (e) => {
      if (pickingTarget === 'fg') this.session.setFgColor(e.target.value);
      else this.session.setBgColor(e.target.value);
    });

    swapBtn.addEventListener('click', () => this.session.swapColors());
    resetBtn.addEventListener('click', () => this.session.resetColors());

    this._updateActive();
    this._updateColors();
  }

  _updateActive() {
    if (!this.session) return;
    const btns = this.el.querySelectorAll('.tool-btn');
    btns.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tool === this.session.tool);
    });
  }

  _updateColors() {
    if (!this.session) return;
    const fg = this.el.querySelector('#swatch-fg');
    const bg = this.el.querySelector('#swatch-bg');
    if (fg) fg.style.backgroundColor = this.session.fgColor;
    if (bg) bg.style.backgroundColor = this.session.bgColor;
  }
}
