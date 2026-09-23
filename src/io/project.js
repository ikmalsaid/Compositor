// ─────────────────────────────────────────────────────────────────────────────
// io/project.js  —  .compositor project save/load (renderer side)
//                   Mirrors ProjectStore.swift (version 7 format)
// ─────────────────────────────────────────────────────────────────────────────

import { CanvasDocument, ImageLayer, LayerTransform } from '../store/document.js';

const FORMAT_VERSION = 7;

/** Serialise the current session document and call main-process save. */
export async function saveProject(session, filePath) {
  const doc = session.document;
  if (!doc) return false;

  const manifest = {
    format:        'com.compositor.project',
    version:       FORMAT_VERSION,
    colorSpace:    'sRGB',
    resolution:    doc.resolution,
    documentID:    doc.id,
    width:         doc.width,
    height:        doc.height,
    activeLayerID: session.activeLayerID,
    layers:        doc.layers.map(layerToRecord),
  };

  // Collect pixel data for each layer that has pixel data
  const layers = [];
  for (const layer of doc.layers) {
    if (layer.isGroup) continue;
    const src = layer.canvas || layer.bitmap;
    if (!src) continue;
    const b64 = await bitmapToRGBABase64(src, layer.pixelW, layer.pixelH);
    layers.push({ id: layer.id, b64, w: layer.pixelW, h: layer.pixelH });
  }

  const res = await window.api.saveProject({ filePath, manifest, layers });
  if (!res.ok) { console.error('Save failed:', res.error); return false; }

  session.projectURL = filePath;
  session.history.markSaved();
  session.isModified = false;
  session._emit('change');
  return true;
}

/** Load a .compositor project into the session. */
export async function loadProject(session, filePath) {
  const res = await window.api.loadProject(filePath);
  if (!res.ok) { console.error('Load failed:', res.error); return false; }

  const { manifest, layers: rawLayers } = res;

  // Build a map of id → {b64, w, h}
  const imgMap = new Map(rawLayers.map(l => [l.record.id, l]));

  const layers = [];
  for (const record of manifest.layers ?? []) {
    const imgData = imgMap.get(record.id);
    let bitmap = null, dataURL = null;
    let pixelW = record.transform?.w ?? 0, pixelH = record.transform?.h ?? 0;

    if (imgData?.b64 && !record.isGroup) {
      bitmap  = await rgbaBase64ToBitmap(imgData.b64, imgData.w, imgData.h);
      dataURL = await rgbaBase64ToDataURL(imgData.b64, imgData.w, imgData.h);
      pixelW  = imgData.w;
      pixelH  = imgData.h;
    }

    layers.push(new ImageLayer({
      id:        record.id,
      name:      record.name,
      isVisible: record.isVisible,
      opacity:   record.opacity   ?? 1,
      blendMode: record.blendMode ?? 'Normal',
      parentID:  record.parentID  ?? null,
      isGroup:   record.isGroup   ?? false,
      transform: LayerTransform.fromJSON(transformFromRecord(record.transform)),
      bitmap,
      dataURL,
      pixelW,
      pixelH,
    }));
  }

  const doc = new CanvasDocument({
    id:         manifest.documentID,
    width:      manifest.width,
    height:     manifest.height,
    resolution: manifest.resolution ?? 72,
    layers,
  });

  session.document = doc;
  session.activeLayerID = manifest.activeLayerID ?? layers.at(-1)?.id ?? null;
  session.selectedLayerIDs = session.activeLayerID ? new Set([session.activeLayerID]) : new Set();
  session.projectURL = filePath;
  session.history.reset();
  session.isModified = false;
  session._emit('change');
  session._emit('canvas-dirty');
  return true;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function layerToRecord(layer) {
  return {
    id:        layer.id,
    name:      layer.name,
    isVisible: layer.isVisible,
    opacity:   layer.opacity,
    blendMode: layer.blendMode,
    parentID:  layer.parentID,
    isGroup:   layer.isGroup,
    transform: {
      origin: { x: layer.transform.x, y: layer.transform.y },
      size:   { width: layer.transform.w, height: layer.transform.h },
      rotation: layer.transform.rotation,
      flipX:    layer.transform.flipX,
      flipY:    layer.transform.flipY,
      sampling: 'high',
    },
    imageFile: layer.bitmap ? `layer-${layer.id}.png` : null,
  };
}

function transformFromRecord(t) {
  // Handle both old Swift format {origin:{x,y}, size:{width,height}} and new {x,y,w,h}
  if (!t) return {};
  return {
    x: t.x ?? t.origin?.x ?? 0,
    y: t.y ?? t.origin?.y ?? 0,
    w: t.w ?? t.size?.width  ?? 100,
    h: t.h ?? t.size?.height ?? 100,
    rotation: t.rotation ?? 0,
    flipX:    t.flipX    ?? false,
    flipY:    t.flipY    ?? false,
  };
}

async function bitmapToRGBABase64(bitmap, w, h) {
  const c = new OffscreenCanvas(w, h);
  c.getContext('2d').drawImage(bitmap, 0, 0);
  const id = c.getContext('2d').getImageData(0, 0, w, h);
  return uint8ToBase64(id.data);
}

async function rgbaBase64ToBitmap(b64, w, h) {
  try {
    const bin = atob(b64);
    const raw = new Uint8ClampedArray(bin.length);
    for (let i = 0; i < bin.length; i++) raw[i] = bin.charCodeAt(i);
    return await createImageBitmap(new ImageData(raw, w, h));
  } catch { return null; }
}

async function rgbaBase64ToDataURL(b64, w, h) {
  const bitmap = await rgbaBase64ToBitmap(b64, w, h);
  if (!bitmap) return null;
  const c = new OffscreenCanvas(Math.min(w, 64), Math.min(h, 64));
  c.getContext('2d').drawImage(bitmap, 0, 0, c.width, c.height);
  const blob = await c.convertToBlob({ type: 'image/png' });
  return new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
}

function uint8ToBase64(data) {
  let bin = '';
  for (let i = 0; i < data.length; i++) bin += String.fromCharCode(data[i]);
  return btoa(bin);
}
