'use strict';
// ─────────────────────────────────────────────────────────────────────────────
// main.js  —  Electron main process
// ─────────────────────────────────────────────────────────────────────────────

process.on('uncaughtException', (err) => console.error('[main] uncaughtException:', err));
process.on('unhandledRejection', (err) => console.error('[main] unhandledRejection:', err));

const { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme } = require('electron');
const path   = require('path');
const fs     = require('fs');
const os     = require('os');

nativeTheme.themeSource = 'dark';

let sharp;
try { sharp = require('sharp'); } catch { sharp = null; }

let JSZip;
try { JSZip = require('jszip'); } catch { JSZip = require('./node_modules/jszip/dist/jszip.js'); }

let autoUpdater;
try {
  autoUpdater = require('electron-updater').autoUpdater;
  autoUpdater.logger = null;
} catch { autoUpdater = null; }

// ─── Preferences & Hardware Acceleration ──────────────────────────────────────

function getPrefPath() {
  return path.join(app.getPath('userData'), 'preferences.json');
}

function loadPreferences() {
  try {
    const prefPath = getPrefPath();
    if (fs.existsSync(prefPath)) {
      return JSON.parse(fs.readFileSync(prefPath, 'utf8'));
    }
  } catch (e) {
    console.warn('[main] Could not read preferences:', e);
  }
  return { hardwareAcceleration: true };
}

function savePreferences(prefs) {
  try {
    const prefPath = getPrefPath();
    const dir = path.dirname(prefPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(prefPath, JSON.stringify(prefs, null, 2), 'utf8');
  } catch (e) {
    console.error('[main] Could not save preferences:', e);
  }
}

const userPrefs = loadPreferences();

if (userPrefs.hardwareAcceleration === false) {
  console.log('[main] Hardware Acceleration is disabled by user configuration.');
  app.disableHardwareAcceleration();
} else {
  console.log('[main] Hardware Acceleration is enabled (default). Applying high-performance GPU flags.');
  app.commandLine.appendSwitch('enable-gpu-rasterization');
  app.commandLine.appendSwitch('enable-zero-copy');
  app.commandLine.appendSwitch('ignore-gpu-blocklist');
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width:  1280,
    height: 840,
    minWidth:  900,
    minHeight: 600,
    backgroundColor: '#161616',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    mainWindow.focus();
    console.log('[main] Window ready and shown.');
  });

  mainWindow.webContents.on('render-process-gone', (_, details) => {
    console.error('[main] Renderer process gone:', JSON.stringify(details));
  });
  mainWindow.webContents.on('did-fail-load', (_, code, desc, url) => {
    console.error('[main] did-fail-load:', code, desc, url);
  });
  mainWindow.webContents.on('console-message', (_, level, msg, line, src) => {
    const tag = ['LOG','WARN','ERR','DBG'][level] ?? '?';
    console.log(`[renderer:${tag}] ${msg}  (${src}:${line})`);
  });

  const indexPath = path.join(__dirname, '..', 'src', 'index.html');
  mainWindow.loadFile(indexPath);

  let isClosingConfirmed = false;
  mainWindow.on('close', (e) => {
    if (isClosingConfirmed) return;
    e.preventDefault();
    mainWindow.webContents.send('app:before-close');
  });

  ipcMain.on('app:confirm-close', () => {
    isClosingConfirmed = true;
    mainWindow.destroy();
  });

  buildMenu();
}

app.whenReady().then(() => {
  createWindow();
  // Check updates asynchronously in background without blocking launch
  if (autoUpdater) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 4000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

let isAppReady = false;

ipcMain.on('app:ready', () => {
  isAppReady = true;
  buildMenu(true);
});

// ─── Native menu ─────────────────────────────────────────────────────────────

function buildMenu(enabled = isAppReady) {
  const send = (ch, ...args) => {
    if (!isAppReady) return;
    mainWindow?.webContents.send(ch, ...args);
  };

  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'New Canvas…',   accelerator: 'CmdOrCtrl+N', enabled, click: () => send('menu:new-canvas') },
        { label: 'Open Project…', accelerator: 'CmdOrCtrl+O', enabled, click: () => send('menu:open') },
        { type: 'separator' },
        { label: 'Save',          accelerator: 'CmdOrCtrl+S', enabled, click: () => send('menu:save') },
        { label: 'Save As…',      accelerator: 'CmdOrCtrl+Shift+S', enabled, click: () => send('menu:save-as') },
        { type: 'separator' },
        { label: 'Import Images…', accelerator: 'CmdOrCtrl+I', enabled, click: () => send('menu:import') },
        { label: 'Export as JPEG…', accelerator: 'CmdOrCtrl+Shift+Alt+S', enabled, click: () => send('menu:export-jpeg') },
        { label: 'Export as PNG…',  enabled, click: () => send('menu:export-png') },
        { type: 'separator' },
        { label: 'Print / Print Preview…', accelerator: 'CmdOrCtrl+P', enabled, click: () => send('menu:print') },
        { type: 'separator' },
        { label: 'Close Tab', accelerator: 'CmdOrCtrl+W', enabled, click: () => send('menu:close-tab') },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'CmdOrCtrl+Z',       enabled, click: () => send('menu:undo') },
        { label: 'Redo', accelerator: 'CmdOrCtrl+Shift+Z', enabled, click: () => send('menu:redo') },
        { type: 'separator' },
        { label: 'Cut',   accelerator: 'CmdOrCtrl+X', enabled, click: () => send('menu:cut') },
        { label: 'Copy',  accelerator: 'CmdOrCtrl+C', enabled, click: () => send('menu:copy') },
        { label: 'Paste', accelerator: 'CmdOrCtrl+V', enabled, click: () => send('menu:paste') },
        { label: 'Deselect', accelerator: 'CmdOrCtrl+D', enabled, click: () => send('menu:deselect') },
        { type: 'separator' },
        { label: 'Canvas Size…',  enabled, click: () => send('menu:canvas-size') },
        { label: 'Image Size…',   enabled, click: () => send('menu:image-size') },
      ],
    },
    {
      label: 'Layer',
      submenu: [
        { label: 'New Layer',   accelerator: 'CmdOrCtrl+Shift+N', enabled, click: () => send('menu:new-layer') },
        { label: 'New Group',   enabled, click: () => send('menu:new-group') },
        { type: 'separator' },
        { label: 'Duplicate Layer', accelerator: 'CmdOrCtrl+J',       enabled, click: () => send('menu:duplicate-layer') },
        { label: 'Merge Down',      accelerator: 'CmdOrCtrl+E',       enabled, click: () => send('menu:merge-down') },
        { label: 'Flatten Image',   enabled, click: () => send('menu:flatten') },
        { label: 'Delete Layer',    accelerator: 'Delete', enabled, click: () => send('menu:delete-layer') },
        { type: 'separator' },
        { label: 'Bring to Front',  accelerator: 'CmdOrCtrl+Shift+]', enabled, click: () => send('menu:bring-to-front') },
        { label: 'Bring Forward',   accelerator: 'CmdOrCtrl+]',       enabled, click: () => send('menu:bring-forward') },
        { label: 'Send Backward',   accelerator: 'CmdOrCtrl+[',       enabled, click: () => send('menu:send-backward') },
        { label: 'Send to Back',    accelerator: 'CmdOrCtrl+Shift+[', enabled, click: () => send('menu:send-to-back') },
        { type: 'separator' },
        { label: 'Flip Layer Horizontal', enabled, click: () => send('menu:flip-layer-h') },
        { label: 'Flip Layer Vertical',   enabled, click: () => send('menu:flip-layer-v') },
        { type: 'separator' },
        { label: 'Mirror Horizontal (Duplicate)', enabled, click: () => send('menu:mirror-layer-h') },
        { label: 'Mirror Vertical (Duplicate)',   enabled, click: () => send('menu:mirror-layer-v') },
      ],
    },
    {
      label: 'Insert',
      submenu: [
        { label: 'Clip Art…',  accelerator: 'CmdOrCtrl+Shift+I', enabled, click: () => send('menu:insert-clipart') },
        { label: 'WordArt…',   accelerator: 'CmdOrCtrl+Shift+W', enabled, click: () => send('menu:insert-wordart') },
      ],
    },
    {
      label: 'Image',
      submenu: [
        { label: 'Levels…',          accelerator: 'CmdOrCtrl+L', enabled, click: () => send('menu:levels') },
        { label: 'Curves…',          accelerator: 'CmdOrCtrl+M', enabled, click: () => send('menu:curves') },
        { label: 'Hue/Saturation…',  accelerator: 'CmdOrCtrl+U', enabled, click: () => send('menu:hue-saturation') },
        { label: 'Exposure…',        enabled, click: () => send('menu:exposure') },
        { label: 'Invert Colors',    enabled, click: () => send('menu:invert') },
        { type: 'separator' },
        { label: 'Flip Canvas Horizontal', enabled, click: () => send('menu:flip-canvas-h') },
        { label: 'Flip Canvas Vertical',   enabled, click: () => send('menu:flip-canvas-v') },
        { type: 'separator' },
        { label: 'Remove Background', enabled, click: () => send('menu:remove-bg') },
      ],
    },
    {
      label: 'Filter',
      submenu: [
        { label: 'Gaussian Blur…', enabled, click: () => send('menu:filters-gaussian') },
        { label: 'Motion Blur…', enabled, click: () => send('menu:filters-motion') },
        { label: 'Radial Blur…', enabled, click: () => send('menu:filters-radial') },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Zoom In',        accelerator: 'CmdOrCtrl+=', enabled, click: () => send('menu:zoom-in') },
        { label: 'Zoom Out',       accelerator: 'CmdOrCtrl+-', enabled, click: () => send('menu:zoom-out') },
        { label: 'Fit to Screen',  accelerator: 'CmdOrCtrl+0', enabled, click: () => send('menu:zoom-fit') },
        { label: 'Actual Size',    accelerator: 'CmdOrCtrl+1', enabled, click: () => send('menu:zoom-100') },
        { type: 'separator' },
        { label: 'Rulers',         accelerator: 'CmdOrCtrl+R', enabled, click: () => send('menu:toggle-rulers') },
        { label: 'Guides',         accelerator: 'CmdOrCtrl+;', enabled, click: () => send('menu:toggle-guides') },
        { label: 'Snap to Guides', accelerator: 'CmdOrCtrl+Shift+;', enabled, click: () => send('menu:toggle-snap-guides') },
        { type: 'separator' },
        {
          label: 'Hardware Acceleration',
          type: 'checkbox',
          checked: userPrefs.hardwareAcceleration !== false,
          enabled,
          click: async (menuItem) => {
            const newStatus = menuItem.checked;
            const prefs = loadPreferences();
            prefs.hardwareAcceleration = newStatus;
            savePreferences(prefs);
            userPrefs.hardwareAcceleration = newStatus;

            const { response } = await dialog.showMessageBox(mainWindow, {
              type: 'question',
              title: 'Hardware Acceleration Changed',
              message: `Hardware Acceleration has been ${newStatus ? 'enabled' : 'disabled'}.\n\nA restart of Compositor is required for this change to take effect.`,
              buttons: ['Restart Now', 'Later'],
              defaultId: 0,
              cancelId: 1,
            });

            if (response === 0) {
              app.relaunch();
              app.exit(0);
            }
          },
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { role: 'reload' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'GitHub Repository', click: () => shell.openExternal('https://github.com/ikmalsaid/compositor') },
        { label: 'Report an Issue',   click: () => shell.openExternal('https://github.com/ikmalsaid/compositor/issues') },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── IPC: Hardware Acceleration & Preferences ────────────────────────────────

ipcMain.handle('app:get-hardware-acceleration', () => {
  const prefs = loadPreferences();
  return prefs.hardwareAcceleration !== false;
});

ipcMain.handle('app:set-hardware-acceleration', async (_, enabled) => {
  const prefs = loadPreferences();
  prefs.hardwareAcceleration = !!enabled;
  savePreferences(prefs);
  userPrefs.hardwareAcceleration = !!enabled;
  buildMenu(isAppReady);

  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    title: 'Hardware Acceleration Changed',
    message: `Hardware Acceleration has been ${enabled ? 'enabled' : 'disabled'}.\n\nA restart of Compositor is required for this change to take effect.`,
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
    cancelId: 1,
  });

  if (response === 0) {
    app.relaunch();
    app.exit(0);
  }
  return true;
});

// ─── IPC: Dialogs ─────────────────────────────────────────────────────────────

ipcMain.handle('dialog:open-project', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Open Project',
    filters: [{ name: 'Compositor Project', extensions: ['compositor'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return filePaths;
});

ipcMain.handle('dialog:save-project', async (_, defaultName) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: 'Save Project',
    defaultPath: defaultName ? `${defaultName}.compositor` : 'Untitled.compositor',
    filters: [{ name: 'Compositor Project', extensions: ['compositor'] }],
  });
  return filePath ?? null;
});

ipcMain.handle('dialog:open-images', async () => {
  const { filePaths } = await dialog.showOpenDialog(mainWindow, {
    title: 'Import Images',
    filters: [{ name: 'Images', extensions: ['jpg','jpeg','png','tiff','tif','webp'] }],
    properties: ['openFile', 'multiSelections'],
  });
  return filePaths;
});

ipcMain.handle('dialog:save-export', async (_, name, ext) => {
  const { filePath } = await dialog.showSaveDialog(mainWindow, {
    title: `Export as ${ext.toUpperCase()}`,
    defaultPath: `${name ?? 'Untitled'}.${ext}`,
    filters: [{ name: ext.toUpperCase(), extensions: [ext] }],
  });
  return filePath ?? null;
});

// ─── IPC: Image import ────────────────────────────────────────────────────────

ipcMain.handle('image:import', async (_, filePath) => {
  try {
    if (!sharp) throw new Error('sharp not available');
    const img = sharp(filePath);
    const meta = await img.metadata();
    const raw  = await img.ensureAlpha().raw().toBuffer();
    const b64  = raw.toString('base64');
    return { ok: true, b64, width: meta.width, height: meta.height, name: path.basename(filePath, path.extname(filePath)) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Image export ────────────────────────────────────────────────────────

ipcMain.handle('image:export-jpeg', async (_, { filePath, b64, width, height, quality }) => {
  try {
    if (!sharp) throw new Error('sharp not available');
    const buf = Buffer.from(b64, 'base64');
    await sharp(buf, { raw: { width, height, channels: 4 } })
      .jpeg({ quality: Math.round(quality * 100) })
      .toFile(filePath);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

ipcMain.handle('image:export-png', async (_, { filePath, b64, width, height }) => {
  try {
    if (!sharp) throw new Error('sharp not available');
    const buf = Buffer.from(b64, 'base64');
    await sharp(buf, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(filePath);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

// ─── IPC: Project save ────────────────────────────────────────────────────────

ipcMain.handle('project:save', async (_, { filePath, manifest, layers }) => {
  try {
    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifest, null, 2));
    for (const layer of layers) {
      if (layer.b64 && layer.id) {
        const buf = Buffer.from(layer.b64, 'base64');
        if (sharp) {
          const png = await sharp(buf, { raw: { width: layer.w, height: layer.h, channels: 4 } }).png().toBuffer();
          zip.file(`layer-${layer.id}.png`, png);
        } else {
          zip.file(`layer-${layer.id}.png`, buf);
        }
      }
    }
    const buf = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    fs.writeFileSync(filePath, buf);
    return { ok: true };
  } catch (err) { return { ok: false, error: err.message }; }
});

// ─── IPC: Project load ────────────────────────────────────────────────────────

ipcMain.handle('project:load', async (_, filePath) => {
  try {
    const buf  = fs.readFileSync(filePath);
    const zip  = await JSZip.loadAsync(buf);
    const mf   = zip.file('manifest.json');
    if (!mf) return { ok: false, error: 'No manifest.json' };
    const manifest = JSON.parse(await mf.async('string'));

    const layers = [];
    for (const record of manifest.layers ?? []) {
      const imgFile = zip.file(`layer-${record.id}.png`);
      let b64 = null, w = 0, h = 0;
      if (imgFile) {
        const rawPng = await imgFile.async('nodebuffer');
        if (sharp) {
          const img  = sharp(rawPng);
          const meta = await img.metadata();
          const raw  = await img.ensureAlpha().raw().toBuffer();
          b64 = raw.toString('base64');
          w = meta.width; h = meta.height;
        } else {
          b64 = rawPng.toString('base64');
          w = record.transform?.w ?? 0; h = record.transform?.h ?? 0;
        }
      }
      layers.push({ record, b64, w, h });
    }

    return { ok: true, manifest, layers };
  } catch (err) { return { ok: false, error: err.message }; }
});

// ─── IPC: AI Model Loading ───────────────────────────────────────────────────

ipcMain.handle('ai:load-model', async () => {
  try {
    const modelPath = path.join(__dirname, '..', 'models', 'u2netp.onnx');
    if (!fs.existsSync(modelPath)) throw new Error('Model file not found at ' + modelPath);
    const buf = fs.readFileSync(modelPath);
    return { ok: true, buffer: buf.buffer };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// ─── IPC: Window title ────────────────────────────────────────────────────────

ipcMain.on('window:set-title', (_, title) => { mainWindow?.setTitle(title); });
ipcMain.on('window:set-modified', (_, modified) => { mainWindow?.setDocumentEdited?.(modified); });

// ─── IPC: Print & PDF Export ──────────────────────────────────────────────────

ipcMain.handle('print:document', async (_, { dataUrl, landscape = false, pageSize = 'A4' }) => {
  try {
    let printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: ${pageSize} ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
          body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" />
      </body>
      </html>
    `;
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    return await new Promise((resolve) => {
      printWin.webContents.print({ silent: false, printBackground: true, landscape, pageSize }, (success, failureReason) => {
        printWin.close();
        resolve({ ok: success, error: failureReason });
      });
    });
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('print:to-pdf', async (_, { dataUrl, landscape = false, pageSize = 'A4', defaultPath = 'document.pdf' }) => {
  try {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: 'Export as PDF',
      defaultPath,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }]
    });
    if (canceled || !filePath) return { canceled: true };

    let printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true } });
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page { size: ${pageSize} ${landscape ? 'landscape' : 'portrait'}; margin: 0; }
          body { margin: 0; padding: 0; display: flex; align-items: center; justify-content: center; height: 100vh; background: #fff; }
          img { max-width: 100%; max-height: 100%; object-fit: contain; }
        </style>
      </head>
      <body>
        <img src="${dataUrl}" />
      </body>
      </html>
    `;
    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    const pdfData = await printWin.webContents.printToPDF({
      printBackground: true,
      landscape,
      pageSize,
    });
    printWin.close();
    await fs.promises.writeFile(filePath, pdfData);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

