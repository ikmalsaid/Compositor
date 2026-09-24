'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// preload.js  —  Context bridge: safe IPC surface for the renderer
// ─────────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

let _fluentIcons = null;

function prefixSvgIds(svgBody, prefix) {
  if (!prefix) return svgBody;
  const idRegex = /\bid="([^"]+)"/g;
  const ids = new Set();
  let m;
  while ((m = idRegex.exec(svgBody)) !== null) {
    ids.add(m[1]);
  }
  let result = svgBody;
  for (const id of ids) {
    const newId = `${prefix}-${id}`;
    result = result.split(`id="${id}"`).join(`id="${newId}"`);
    result = result.split(`url(#${id})`).join(`url(#${newId})`);
    result = result.split(`href="#${id}"`).join(`href="#${newId}"`);
  }
  return result;
}

const _svgCache = new Map();

function getFluentIconSvg(iconKey, prefix = '') {
  const cacheKey = `${iconKey}::${prefix}`;
  if (_svgCache.has(cacheKey)) {
    return _svgCache.get(cacheKey);
  }
  try {
    if (!_fluentIcons) {
      _fluentIcons = require('@iconify-json/fluent-emoji/icons.json');
    }
    const item = _fluentIcons.icons ? _fluentIcons.icons[iconKey] : null;
    if (!item || !item.body) return null;
    const body = prefixSvgIds(item.body, prefix);
    const svg = `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;
    _svgCache.set(cacheKey, svg);
    return svg;
  } catch (err) {
    console.error('[preload] Error loading fluent icon:', iconKey, err);
    return null;
  }
}

contextBridge.exposeInMainWorld('api', {

  // ─── Dialogs ─────────────────────────────────────────────────────────────
  openProjectDialog: ()               => ipcRenderer.invoke('dialog:open-project'),
  saveProjectDialog: (name)           => ipcRenderer.invoke('dialog:save-project', name),
  openImagesDialog:  ()               => ipcRenderer.invoke('dialog:open-images'),
  saveExportDialog:  (name, ext)      => ipcRenderer.invoke('dialog:save-export', name, ext),

  // ─── Image I/O ───────────────────────────────────────────────────────────
  importImage:       (filePath)       => ipcRenderer.invoke('image:import', filePath),
  exportJpeg:        (opts)           => ipcRenderer.invoke('image:export-jpeg', opts),
  exportPng:         (opts)           => ipcRenderer.invoke('image:export-png', opts),
  printDocument:     (opts)           => ipcRenderer.invoke('print:document', opts),
  printToPdf:        (opts)           => ipcRenderer.invoke('print:to-pdf', opts),

  // ─── Project I/O ─────────────────────────────────────────────────────────
  saveProject:       (opts)           => ipcRenderer.invoke('project:save', opts),
  loadProject:       (filePath)       => ipcRenderer.invoke('project:load', filePath),

  // ─── AI Model Loading ─────────────────────────────────────────────────────
  loadModel:         ()               => ipcRenderer.invoke('ai:load-model'),

  // ─── Window ───────────────────────────────────────────────────────────────
  setWindowTitle:    (title)          => ipcRenderer.send('window:set-title', title),
  setModified:       (modified)       => ipcRenderer.send('window:set-modified', modified),
  confirmClose:      ()               => ipcRenderer.send('app:confirm-close'),
  setAppReady:       ()               => ipcRenderer.send('app:ready'),

  // ─── Performance & Hardware Acceleration ───────────────────────────────────
  getHardwareAcceleration: ()         => ipcRenderer.invoke('app:get-hardware-acceleration'),
  setHardwareAcceleration: (enabled)  => ipcRenderer.invoke('app:set-hardware-acceleration', enabled),

  // ─── Fluent Emoji Vector Engine ──────────────────────────────────────────
  getFluentIconSvg: (iconKey, prefix) => getFluentIconSvg(iconKey, prefix),

  // ─── Menu events (main → renderer) ───────────────────────────────────────
  onMenu: (channel, fn) => {
    const allowed = [
      'menu:new-canvas','menu:open','menu:save','menu:save-as',
      'menu:import','menu:export-jpeg','menu:export-png','menu:print','menu:close-tab',
      'menu:undo','menu:redo','menu:cut','menu:copy','menu:paste',
      'menu:new-layer','menu:new-group',
      'menu:duplicate-layer','menu:merge-down','menu:flatten','menu:delete-layer',
      'menu:layer-up','menu:layer-down','menu:bring-forward','menu:send-backward',
      'menu:bring-to-front','menu:send-to-back',
      'menu:canvas-size','menu:image-size',
      'menu:levels','menu:curves','menu:hue-saturation','menu:exposure',
      'menu:invert','menu:filters',
      'menu:filters-gaussian','menu:filters-motion','menu:filters-radial','menu:deselect',
      'menu:flip-canvas-h','menu:flip-canvas-v',
      'menu:flip-layer-h','menu:flip-layer-v',
      'menu:mirror-layer-h','menu:mirror-layer-v',
      'menu:insert-clipart','menu:insert-wordart',
      'menu:remove-bg',
      'menu:zoom-in','menu:zoom-out','menu:zoom-fit','menu:zoom-100',
      'menu:toggle-rulers','menu:toggle-guides','menu:toggle-snap-guides',
      'app:before-close',
    ];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_, ...args) => fn(...args));
  },
});
