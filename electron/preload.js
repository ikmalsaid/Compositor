'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// preload.js  —  Context bridge: safe IPC surface for the renderer
// ─────────────────────────────────────────────────────────────────────────────

const { contextBridge, ipcRenderer } = require('electron');

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
      'menu:remove-bg',
      'menu:zoom-in','menu:zoom-out','menu:zoom-fit','menu:zoom-100',
      'menu:toggle-rulers','menu:toggle-guides','menu:toggle-snap-guides',
      'app:before-close',
    ];
    if (!allowed.includes(channel)) return;
    ipcRenderer.on(channel, (_, ...args) => fn(...args));
  },
});
