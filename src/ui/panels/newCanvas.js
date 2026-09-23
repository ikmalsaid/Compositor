// ─────────────────────────────────────────────────────────────────────────────
// ui/panels/newCanvas.js  —  Streamlined "New Document" Dialog
//                             Clean, focused preset selector & custom inspector
// ─────────────────────────────────────────────────────────────────────────────

import { CanvasDocument } from '../../store/document.js';
import { iconPortrait, iconLandscape, iconSearch, iconClose, iconCheck } from '../icons.js';

const STORAGE_DEFAULT_KEY = 'compositor:default-canvas-settings';
const STORAGE_RECENTS_KEY = 'compositor:recent-canvas-sizes';

export const PRESET_CATALOGUE = [
  // ─── Popular ───
  { id: 'pop-default-ps', category: 'popular', label: 'Default Compositor Size', desc: '16:9 Standard', w: 1920, h: 1080, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'pop-ig-post', category: 'popular', label: 'Instagram Post', desc: '1:1 Square', w: 1080, h: 1080, ppi: 72, ratio: '1:1', unit: 'px' },
  { id: 'pop-a4-doc', category: 'popular', label: 'A4 Document', desc: '210 × 297 mm', w: 2480, h: 3508, ppi: 300, ratio: '1:1.41', unit: 'mm' },
  { id: 'pop-us-letter', category: 'popular', label: 'US Letter', desc: '8.5 × 11 in', w: 2550, h: 3300, ppi: 300, ratio: '8.5:11', unit: 'in' },
  { id: 'pop-4k-uhd', category: 'popular', label: '4K UHD Video', desc: '3840 × 2160', w: 3840, h: 2160, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'pop-yt-thumb', category: 'popular', label: 'YouTube Thumbnail', desc: '1280 × 720', w: 1280, h: 720, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'pop-sq-canvas', category: 'popular', label: 'Square Canvas', desc: '2048 × 2048', w: 2048, h: 2048, ppi: 300, ratio: '1:1', unit: 'px' },
  { id: 'pop-ig-story', category: 'popular', label: 'Instagram Story / Reel', desc: '9:16 Vertical', w: 1080, h: 1920, ppi: 72, ratio: '9:16', unit: 'px' },

  // ─── Photo ───
  { id: 'ph-4x6', category: 'photo', label: 'Landscape 4 × 6', desc: 'Standard Photo', w: 1800, h: 1200, ppi: 300, ratio: '3:2', unit: 'in' },
  { id: 'ph-5x7', category: 'photo', label: 'Landscape 5 × 7', desc: 'Medium Photo', w: 2100, h: 1500, ppi: 300, ratio: '7:5', unit: 'in' },
  { id: 'ph-8x10', category: 'photo', label: 'Portrait 8 × 10', desc: 'Portrait Photo', w: 2400, h: 3000, ppi: 300, ratio: '4:5', unit: 'in' },
  { id: 'ph-5x5', category: 'photo', label: 'Square 5 × 5 in', desc: 'Square Photo', w: 1500, h: 1500, ppi: 300, ratio: '1:1', unit: 'in' },
  { id: 'ph-paint', category: 'photo', label: 'Digital Painting Hi-Res', desc: '4000 × 3000', w: 4000, h: 3000, ppi: 300, ratio: '4:3', unit: 'px' },
  { id: 'ph-comic', category: 'photo', label: 'Comic / Manga Page', desc: '2000 × 3000', w: 2000, h: 3000, ppi: 300, ratio: '2:3', unit: 'px' },
  { id: 'ph-sq-art', category: 'photo', label: 'Square Artwork 2K', desc: '2048 × 2048', w: 2048, h: 2048, ppi: 300, ratio: '1:1', unit: 'px' },

  // ─── Print ───
  { id: 'pr-us-letter', category: 'print', label: 'Letter', desc: '8.5 × 11 in', w: 2550, h: 3300, ppi: 300, ratio: '8.5:11', unit: 'in' },
  { id: 'pr-us-legal', category: 'print', label: 'Legal', desc: '8.5 × 14 in', w: 2550, h: 4200, ppi: 300, ratio: '8.5:14', unit: 'in' },
  { id: 'pr-tabloid', category: 'print', label: 'Tabloid', desc: '11 × 17 in', w: 3300, h: 5100, ppi: 300, ratio: '11:17', unit: 'in' },
  { id: 'pr-a4', category: 'print', label: 'A4', desc: '210 × 297 mm', w: 2480, h: 3508, ppi: 300, ratio: '1:1.41', unit: 'mm' },
  { id: 'pr-a3', category: 'print', label: 'A3', desc: '297 × 420 mm', w: 3508, h: 4960, ppi: 300, ratio: '1:1.41', unit: 'mm' },
  { id: 'pr-a5', category: 'print', label: 'A5', desc: '148 × 210 mm', w: 1748, h: 2480, ppi: 300, ratio: '1:1.41', unit: 'mm' },
  { id: 'pr-biz-card', category: 'print', label: 'Business Card', desc: '3.5 × 2 in', w: 1050, h: 600, ppi: 300, ratio: '7:4', unit: 'in' },
  { id: 'pr-postcard', category: 'print', label: 'Postcard', desc: '6 × 4 in', w: 1800, h: 1200, ppi: 300, ratio: '3:2', unit: 'in' },

  // ─── Social ───
  { id: 'soc-ig-post', category: 'social', label: 'Instagram Square', desc: '1080 × 1080', w: 1080, h: 1080, ppi: 72, ratio: '1:1', unit: 'px' },
  { id: 'soc-ig-story', category: 'social', label: 'Instagram Story', desc: '1080 × 1920', w: 1080, h: 1920, ppi: 72, ratio: '9:16', unit: 'px' },
  { id: 'soc-tiktok', category: 'social', label: 'TikTok Video', desc: '1080 × 1920', w: 1080, h: 1920, ppi: 72, ratio: '9:16', unit: 'px' },
  { id: 'soc-yt-thumb', category: 'social', label: 'YouTube Thumbnail', desc: '1280 × 720', w: 1280, h: 720, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'soc-yt-banner', category: 'social', label: 'YouTube Banner', desc: '2560 × 1440', w: 2560, h: 1440, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'soc-x-header', category: 'social', label: 'Twitter / X Header', desc: '1500 × 500', w: 1500, h: 500, ppi: 72, ratio: '3:1', unit: 'px' },
  { id: 'soc-x-post', category: 'social', label: 'Twitter / X Post', desc: '1200 × 675', w: 1200, h: 675, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'soc-fb-cover', category: 'social', label: 'Facebook Cover', desc: '1640 × 924', w: 1640, h: 924, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'soc-pin', category: 'social', label: 'Pinterest Pin', desc: '1000 × 1500', w: 1000, h: 1500, ppi: 72, ratio: '2:3', unit: 'px' },

  // ─── Web & Screen ───
  { id: 'scr-fhd', category: 'screen', label: 'Web Full HD (1080p)', desc: '1920 × 1080', w: 1920, h: 1080, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'scr-4k', category: 'screen', label: '4K Screen / Video', desc: '3840 × 2160', w: 3840, h: 2160, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'scr-2k', category: 'screen', label: '2K QHD Display', desc: '2560 × 1440', w: 2560, h: 1440, ppi: 72, ratio: '16:9', unit: 'px' },
  { id: 'scr-mbp', category: 'screen', label: 'MacBook Pro 16"', desc: '3456 × 2234', w: 3456, h: 2234, ppi: 72, ratio: '16:10', unit: 'px' },
  { id: 'scr-ipad', category: 'screen', label: 'iPad Pro 12.9"', desc: '2732 × 2048', w: 2732, h: 2048, ppi: 72, ratio: '4:3', unit: 'px' },
  { id: 'scr-phone', category: 'screen', label: 'Mobile Screen', desc: '1170 × 2532', w: 1170, h: 2532, ppi: 72, ratio: '9:19.5', unit: 'px' },
  { id: 'scr-hero', category: 'screen', label: 'Web Banner', desc: '1920 × 600', w: 1920, h: 600, ppi: 72, ratio: '16:5', unit: 'px' },
  { id: 'scr-wall', category: 'screen', label: 'Desktop Wallpaper', desc: '2560 × 1600', w: 2560, h: 1600, ppi: 72, ratio: '16:10', unit: 'px' },
];

export function getDefaultCanvasSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_DEFAULT_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.width === 'number' && typeof parsed.height === 'number') {
        return {
          presetId: parsed.presetId ?? 'pop-default-ps',
          docName: parsed.docName ?? 'Untitled-1',
          label: parsed.label ?? 'Default Compositor Size',
          unit: parsed.unit ?? 'px',
          width: parsed.width,
          height: parsed.height,
          ppi: parsed.ppi ?? 72,
          bgOption: parsed.bgOption ?? 'white',
          customBgColor: parsed.customBgColor ?? '#ffffff',
        };
      }
    }
  } catch (e) {
    console.warn('Could not read default canvas settings:', e);
  }
  return {
    presetId: 'pop-default-ps',
    docName: 'Untitled-1',
    label: 'Default Compositor Size',
    unit: 'px',
    width: 1920,
    height: 1080,
    ppi: 72,
    bgOption: 'white',
    customBgColor: '#ffffff',
  };
}

export function saveDefaultCanvasSettings(settings) {
  try {
    localStorage.setItem(STORAGE_DEFAULT_KEY, JSON.stringify(settings));
    return true;
  } catch (e) {
    console.warn('Could not save default canvas settings:', e);
    return false;
  }
}

export function getRecentCanvasSizes() {
  try {
    const raw = localStorage.getItem(STORAGE_RECENTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Could not read recent canvas sizes:', e);
  }
  return [
    { id: 'rec-fhd', label: '1920 × 1080 px @ 72 ppi', desc: 'Recent Document', w: 1920, h: 1080, ppi: 72, ratio: '16:9', unit: 'px', isCustom: false },
    { id: 'rec-ig', label: '1080 × 1080 px @ 72 ppi', desc: 'Recent Document', w: 1080, h: 1080, ppi: 72, ratio: '1:1', unit: 'px', isCustom: false },
    { id: 'rec-a4', label: 'A4 (2480 × 3508 px @ 300 ppi)', desc: 'Recent Document', w: 2480, h: 3508, ppi: 300, ratio: '1:1.41', unit: 'mm', isCustom: false },
    { id: 'rec-yt', label: '1280 × 720 px @ 72 ppi', desc: 'Recent Document', w: 1280, h: 720, ppi: 72, ratio: '16:9', unit: 'px', isCustom: false },
  ];
}

export function addRecentCanvasSize(item) {
  try {
    const recents = getRecentCanvasSizes().filter(r => !(r.w === item.w && r.h === item.h && r.ppi === item.ppi));
    const newItem = {
      id: `rec-${Date.now()}`,
      label: item.label || `${item.w} × ${item.h} px @ ${item.ppi || 72} ppi`,
      desc: item.desc || (item.isCustom ? 'Custom Size' : 'Recent Document'),
      w: item.w,
      h: item.h,
      ppi: item.ppi || 72,
      ratio: item.ratio || `${(item.w / item.h).toFixed(2)}:1`,
      unit: item.unit || 'px',
      bgOption: item.bgOption || 'white',
      customBgColor: item.customBgColor || '#ffffff',
      isCustom: !!item.isCustom,
      timestamp: Date.now(),
    };
    recents.unshift(newItem);
    const trimmed = recents.slice(0, 16);
    localStorage.setItem(STORAGE_RECENTS_KEY, JSON.stringify(trimmed));
    return trimmed;
  } catch (e) {
    console.warn('Could not save recent size:', e);
    return [];
  }
}

export function removeRecentCanvasSize(id) {
  try {
    const recents = getRecentCanvasSizes().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_RECENTS_KEY, JSON.stringify(recents));
    return recents;
  } catch (e) {
    console.warn('Could not remove recent size:', e);
    return [];
  }
}

/**
 * Display Clean & Simplified New Document Modal
 * @param {EditorSession} session
 * @param {Function} [onCreated]
 * @param {object} [opts]
 * @param {Function} [opts.onBeforeCreate] Async check to prompt unsaved changes
 */
export function showNewCanvasPanel(session, onCreated, opts = {}) {
  if (document.querySelector('.new-canvas-modal')) return;

  const defaults = getDefaultCanvasSettings();

  let activeCategory = 'popular';
  let filterQuery = '';

  let selectedConfig = {
    id: defaults.presetId || 'pop-default-ps',
    docName: defaults.docName || 'Untitled-1',
    label: defaults.label,
    w: defaults.width,
    h: defaults.height,
    ppi: defaults.ppi,
    unit: defaults.unit || 'px',
    bgOption: defaults.bgOption || 'white',
    customBgColor: defaults.customBgColor || '#ffffff',
    isCustom: false,
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal new-canvas-modal" style="width:780px;max-width:95vw;height:520px;max-height:90vh;display:flex;flex-direction:column;border-radius:10px;box-shadow:0 24px 64px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.08);background:#1a1a1e;color:#e2e2e8;overflow:hidden;font-family:var(--font-sans);font-size:12px;user-select:none;animation:modalIn 0.16s cubic-bezier(0.2, 0.9, 0.3, 1)">

      <!-- Top Header & Tabs -->
      <div style="background:#141417;border-bottom:1px solid rgba(255,255,255,0.08);display:flex;flex-direction:column;flex-shrink:0">
        <!-- Title Bar -->
        <div style="height:40px;padding:0 18px;display:flex;align-items:center;justify-content:space-between">
          <div style="font-size:13px;font-weight:600;color:#ffffff;display:flex;align-items:center;gap:8px">
            <span style="color:var(--accent,#4f8ef7);font-size:15px">✦</span>
            <span>New Document</span>
          </div>
          <button id="nc-close-btn" style="background:transparent;border:none;color:#8c8c94;cursor:pointer;padding:6px;display:flex;align-items:center;justify-content:center;border-radius:4px;transition:all .12s" title="Close (Esc)">${iconClose(14)}</button>
        </div>

        <!-- Category Tabs & Search Bar -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:0 14px;background:#18181c;border-top:1px solid rgba(255,255,255,0.04)">
          <div class="nc-tabs-list" style="display:flex;gap:4px;overflow-x:auto">
            <button class="nc-tab-btn active" data-cat="popular">Popular</button>
            <button class="nc-tab-btn" data-cat="recents">Recent</button>
            <button class="nc-tab-btn" data-cat="photo">Photo</button>
            <button class="nc-tab-btn" data-cat="print">Print</button>
            <button class="nc-tab-btn" data-cat="social">Social</button>
            <button class="nc-tab-btn" data-cat="screen">Web</button>
          </div>

          <!-- Filter Search -->
          <div style="position:relative;width:160px;margin-right:4px">
            <input type="text" id="nc-filter-input" placeholder="Search presets…" style="width:100%;height:26px;padding:2px 24px 2px 8px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:4px;color:#fff;font-size:11.5px;box-sizing:border-box;outline:none" />
            <span style="position:absolute;right:8px;top:6px;display:flex;align-items:center;color:#777;pointer-events:none">${iconSearch(12)}</span>
          </div>
        </div>
      </div>

      <!-- Main Split Area -->
      <div style="flex:1;display:flex;min-height:0;background:#1a1a1e">

        <!-- Left Presets Grid -->
        <div class="nc-left-pane" style="flex:1;overflow-y:auto;padding:14px 16px;border-right:1px solid rgba(255,255,255,0.07);display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:0.5px" id="nc-grid-title">Popular Presets</div>
            <div style="font-size:11px;color:rgba(255,255,255,0.4)" id="nc-grid-count"></div>
          </div>

          <div id="nc-presets-grid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(140px, 1fr));gap:10px">
            <!-- Injected dynamically -->
          </div>

          <div id="nc-empty-state" style="display:none;padding:40px 16px;text-align:center;color:#888">
            <div style="margin-bottom:6px;display:flex;justify-content:center;color:#666">${iconSearch(20)}</div>
            <div style="font-size:12px;font-weight:600;color:#ccc">No matching presets found</div>
          </div>
        </div>

        <!-- Right Preset Details Inspector -->
        <div class="nc-right-pane" style="width:260px;min-width:260px;background:#1e1e24;overflow-y:auto;padding:14px 16px;display:flex;flex-direction:column;gap:12px">
          <div>
            <label style="font-size:10.5px;font-weight:600;color:rgba(255,255,255,0.5);text-transform:uppercase;letter-spacing:0.4px;display:block;margin-bottom:4px">Document Name</label>
            <input type="text" id="nc-doc-name" value="${selectedConfig.docName}" style="width:100%;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 8px;font-size:12px;font-weight:600;box-sizing:border-box;outline:none" placeholder="Untitled-1" />
          </div>

          <div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:6px">
              <div>
                <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Width</label>
                <input class="mono" id="nc-inp-w" type="number" step="any" min="1" max="30000" value="${defaults.width}" style="width:100%;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 6px;font-size:12px;font-weight:600;box-sizing:border-box;outline:none" />
              </div>
              <div>
                <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Height</label>
                <input class="mono" id="nc-inp-h" type="number" step="any" min="1" max="30000" value="${defaults.height}" style="width:100%;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 6px;font-size:12px;font-weight:600;box-sizing:border-box;outline:none" />
              </div>
            </div>

            <div style="display:grid;grid-template-columns:1fr auto;gap:8px;align-items:center">
              <div>
                <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Unit</label>
                <select id="nc-inp-unit" style="width:100%;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 6px;font-size:11.5px;outline:none">
                  <option value="px" selected>Pixels</option>
                  <option value="in">Inches</option>
                  <option value="cm">Centimeters</option>
                  <option value="mm">Millimeters</option>
                </select>
              </div>

              <div>
                <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Orientation</label>
                <div style="display:flex;gap:3px">
                  <button class="nc-orient-btn" id="nc-orient-port" title="Portrait" style="width:30px;height:28px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#aaa;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center">${iconPortrait(13)}</button>
                  <button class="nc-orient-btn active" id="nc-orient-land" title="Landscape" style="width:30px;height:28px;border:1px solid rgba(255,255,255,0.12);background:rgba(255,255,255,0.04);color:#aaa;border-radius:4px;cursor:pointer;display:flex;align-items:center;justify-content:center">${iconLandscape(13)}</button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Resolution</label>
            <div style="display:flex;gap:6px;align-items:center">
              <input class="mono" id="nc-inp-ppi" type="number" min="1" max="1200" value="${defaults.ppi}" style="flex:1;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 6px;font-size:12px;font-weight:600;box-sizing:border-box;outline:none" />
              <span style="font-size:11px;color:rgba(255,255,255,0.5)">PPI</span>
            </div>
          </div>

          <div>
            <label style="font-size:10.5px;color:rgba(255,255,255,0.5);display:block;margin-bottom:3px">Background</label>
            <div style="display:flex;gap:6px;align-items:center">
              <select id="nc-bg-select" style="flex:1;height:28px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);border-radius:4px;color:#fff;padding:0 6px;font-size:11.5px;outline:none">
                <option value="white" ${selectedConfig.bgOption === 'white' ? 'selected' : ''}>White</option>
                <option value="black" ${selectedConfig.bgOption === 'black' ? 'selected' : ''}>Black</option>
                <option value="transparent" ${selectedConfig.bgOption === 'transparent' ? 'selected' : ''}>Transparent</option>
                <option value="custom" ${selectedConfig.bgOption === 'custom' ? 'selected' : ''}>Custom Color</option>
              </select>
              <div id="nc-custom-color-chip" style="position:relative;width:28px;height:28px;border-radius:4px;border:1px solid rgba(255,255,255,0.16);background:${selectedConfig.customBgColor};overflow:hidden;cursor:pointer">
                <input type="color" id="nc-bg-color-picker" value="${selectedConfig.customBgColor}" style="position:absolute;left:-10px;top:-10px;width:50px;height:50px;opacity:0;cursor:pointer" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Bottom Footer -->
      <div style="height:48px;background:#141417;border-top:1px solid rgba(255,255,255,0.08);padding:0 18px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0">
        <button id="nc-save-default-btn" style="background:transparent;border:1px solid rgba(255,255,255,0.12);color:rgba(255,255,255,0.7);padding:5px 12px;border-radius:5px;font-size:11px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all 0.12s ease" title="Save these settings as startup default">
          <span id="nc-save-default-lbl">Set as Default</span>
        </button>

        <div style="display:flex;align-items:center;gap:8px">
          <button id="nc-cancel-btn" style="height:30px;padding:0 14px;background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);color:#ccc;border-radius:5px;font-size:11.5px;font-weight:500;cursor:pointer;transition:all 0.12s ease">Cancel</button>
          <button id="nc-create-btn" style="height:30px;padding:0 20px;background:var(--accent,#4f8ef7);border:none;color:#fff;border-radius:5px;font-size:12px;font-weight:600;cursor:pointer;box-shadow:0 2px 8px rgba(79,142,247,0.3);transition:all 0.12s ease">Create</button>
        </div>
      </div>

    </div>
  `;

  document.getElementById('modal-root').appendChild(overlay);

  // Injected CSS
  const styleTag = document.createElement('style');
  styleTag.textContent = `
    .nc-tab-btn {
      background: transparent;
      border: none;
      border-bottom: 2px solid transparent;
      color: rgba(255,255,255,0.6);
      padding: 8px 12px;
      font-size: 11.5px;
      font-weight: 500;
      cursor: pointer;
      white-space: nowrap;
      transition: all 0.12s ease;
    }
    .nc-tab-btn:hover {
      color: #fff;
      background: rgba(255,255,255,0.04);
    }
    .nc-tab-btn.active {
      color: #ffffff !important;
      border-bottom-color: var(--accent,#4f8ef7) !important;
      font-weight: 600;
    }
    .nc-card {
      background: rgba(255,255,255,0.03);
      border: 1px solid rgba(255,255,255,0.07);
      border-radius: 6px;
      padding: 10px 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      cursor: pointer;
      position: relative;
      user-select: none;
      transition: all 0.12s ease;
    }
    .nc-card:hover {
      background: rgba(255,255,255,0.06);
      border-color: rgba(255,255,255,0.18);
      transform: translateY(-1px);
    }
    .nc-card.active {
      background: rgba(79,142,247,0.15) !important;
      border-color: var(--accent,#4f8ef7) !important;
      box-shadow: 0 0 0 1px var(--accent,#4f8ef7);
    }
    .nc-aspect-box {
      border: 1px solid rgba(255,255,255,0.2);
      background: rgba(0,0,0,0.3);
      border-radius: 3px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 6px;
      transition: all 0.12s ease;
    }
    .nc-card:hover .nc-aspect-box {
      border-color: var(--accent,#4f8ef7);
    }
    .nc-card.active .nc-aspect-box {
      border-color: var(--accent,#4f8ef7);
      background: var(--accent,#4f8ef7);
      color: #fff;
    }
    .nc-orient-btn:hover {
      background: rgba(255,255,255,0.08) !important;
      color: #fff !important;
    }
    .nc-orient-btn.active {
      background: var(--accent,#4f8ef7) !important;
      border-color: var(--accent,#4f8ef7) !important;
      color: #fff !important;
    }
    .nc-del-btn {
      position: absolute;
      top: 4px;
      right: 4px;
      width: 18px;
      height: 18px;
      background: rgba(0,0,0,0.6);
      border: none;
      color: #999;
      font-size: 10px;
      display: none;
      align-items: center;
      justify-content: center;
      border-radius: 3px;
      cursor: pointer;
    }
    .nc-card:hover .nc-del-btn { display: flex; }
    .nc-del-btn:hover { background: #e05c5c; color: #fff; }
  `;
  document.head.appendChild(styleTag);

  // Unit conversion helpers
  const unitToPx = (val, unit, ppi) => {
    switch (unit) {
      case 'in': return val * ppi;
      case 'cm': return (val / 2.54) * ppi;
      case 'mm': return (val / 25.4) * ppi;
      case 'px': default: return val;
    }
  };

  const pxToUnit = (px, unit, ppi) => {
    switch (unit) {
      case 'in': return Number((px / ppi).toFixed(2));
      case 'cm': return Number(((px / ppi) * 2.54).toFixed(2));
      case 'mm': return Number(((px / ppi) * 25.4).toFixed(1));
      case 'px': default: return Math.round(px);
    }
  };

  // DOM elements
  const tabBtns = overlay.querySelectorAll('.nc-tab-btn');
  const filterInput = overlay.querySelector('#nc-filter-input');
  const presetsGrid = overlay.querySelector('#nc-presets-grid');
  const gridTitle = overlay.querySelector('#nc-grid-title');
  const gridCount = overlay.querySelector('#nc-grid-count');
  const emptyState = overlay.querySelector('#nc-empty-state');

  const docNameInput = overlay.querySelector('#nc-doc-name');
  const inpW = overlay.querySelector('#nc-inp-w');
  const inpH = overlay.querySelector('#nc-inp-h');
  const inpUnit = overlay.querySelector('#nc-inp-unit');
  const inpPpi = overlay.querySelector('#nc-inp-ppi');
  const bgSelect = overlay.querySelector('#nc-bg-select');
  const customColorChip = overlay.querySelector('#nc-custom-color-chip');
  const bgColorPicker = overlay.querySelector('#nc-bg-color-picker');
  const orientPortBtn = overlay.querySelector('#nc-orient-port');
  const orientLandBtn = overlay.querySelector('#nc-orient-land');

  const saveDefaultBtn = overlay.querySelector('#nc-save-default-btn');
  const saveDefaultLbl = overlay.querySelector('#nc-save-default-lbl');
  const createBtn = overlay.querySelector('#nc-create-btn');
  const cancelBtn = overlay.querySelector('#nc-cancel-btn');
  const closeBtn = overlay.querySelector('#nc-close-btn');

  const updateOrientationUI = () => {
    const isPortrait = selectedConfig.h > selectedConfig.w;
    orientPortBtn.classList.toggle('active', isPortrait);
    orientLandBtn.classList.toggle('active', !isPortrait);
  };

  const updateInspectorFromConfig = () => {
    docNameInput.value = selectedConfig.docName;
    inpUnit.value = selectedConfig.unit || 'px';
    inpPpi.value = selectedConfig.ppi || 72;

    const displayW = pxToUnit(selectedConfig.w, inpUnit.value, selectedConfig.ppi);
    const displayH = pxToUnit(selectedConfig.h, inpUnit.value, selectedConfig.ppi);
    inpW.value = displayW;
    inpH.value = displayH;

    bgSelect.value = selectedConfig.bgOption || 'white';
    customColorChip.style.background = selectedConfig.customBgColor || '#ffffff';
    bgColorPicker.value = selectedConfig.customBgColor || '#ffffff';
    customColorChip.style.display = selectedConfig.bgOption === 'custom' ? 'block' : 'none';

    updateOrientationUI();
  };

  const renderGrid = () => {
    presetsGrid.innerHTML = '';
    const recents = getRecentCanvasSizes();

    let itemsToDisplay = [];
    if (filterQuery) {
      const q = filterQuery.toLowerCase();
      const allItems = [...recents, ...PRESET_CATALOGUE];
      const matched = allItems.filter(p =>
        p.label.toLowerCase().includes(q) ||
        (p.desc && p.desc.toLowerCase().includes(q)) ||
        `${p.w}x${p.h}`.includes(q) ||
        `${p.w} × ${p.h}`.includes(q)
      );

      const seen = new Set();
      for (const item of matched) {
        const key = `${item.label.toLowerCase().trim()}|${item.w}|${item.h}|${item.ppi || 72}`;
        if (!seen.has(key)) {
          seen.add(key);
          itemsToDisplay.push(item);
        }
      }
      gridTitle.textContent = `Search Results for "${filterQuery}"`;
    } else {
      if (activeCategory === 'recents') {
        itemsToDisplay = recents;
        gridTitle.textContent = 'Recent Documents';
      } else if (activeCategory === 'popular') {
        itemsToDisplay = PRESET_CATALOGUE.filter(p => p.category === 'popular');
        gridTitle.textContent = 'Popular Presets';
      } else if (activeCategory === 'photo') {
        itemsToDisplay = PRESET_CATALOGUE.filter(p => p.category === 'photo');
        gridTitle.textContent = 'Photo Presets';
      } else if (activeCategory === 'print') {
        itemsToDisplay = PRESET_CATALOGUE.filter(p => p.category === 'print');
        gridTitle.textContent = 'Print Presets';
      } else if (activeCategory === 'social') {
        itemsToDisplay = PRESET_CATALOGUE.filter(p => p.category === 'social');
        gridTitle.textContent = 'Social Presets';
      } else if (activeCategory === 'screen') {
        itemsToDisplay = PRESET_CATALOGUE.filter(p => p.category === 'screen');
        gridTitle.textContent = 'Web Presets';
      }
    }

    gridCount.textContent = `${itemsToDisplay.length} items`;

    if (itemsToDisplay.length === 0) {
      emptyState.style.display = 'block';
      return;
    }
    emptyState.style.display = 'none';

    for (const item of itemsToDisplay) {
      const isSelected = !selectedConfig.isCustom && (
        selectedConfig.id ? item.id === selectedConfig.id : (selectedConfig.w === item.w && selectedConfig.h === item.h && selectedConfig.ppi === item.ppi)
      );

      const card = document.createElement('div');
      card.className = `nc-card ${isSelected ? 'active' : ''}`;

      const aspect = item.w / (item.h || 1);
      let boxW = 44;
      let boxH = 30;
      if (aspect >= 1) {
        boxW = 44;
        boxH = Math.max(14, Math.min(36, Math.round(44 / aspect)));
      } else {
        boxH = 36;
        boxW = Math.max(14, Math.min(44, Math.round(36 * aspect)));
      }

      card.innerHTML = `
        ${item.id.startsWith('rec-') ? `<button class="nc-del-btn" data-del-id="${item.id}" title="Remove from Recents">${iconClose(10)}</button>` : ''}
        <div style="width:52px;height:40px;display:flex;align-items:center;justify-content:center">
          <div class="nc-aspect-box" style="width:${boxW}px;height:${boxH}px">
            <svg viewBox="0 0 20 16" width="16" height="12" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block;opacity:0.65">
              <circle cx="5" cy="4.5" r="1.6" fill="currentColor"/>
              <path d="M1 14.5L6.5 7L10.5 12L13.5 8.5L19 14.5H1Z" fill="currentColor"/>
            </svg>
          </div>
        </div>
        <div style="font-size:11.5px;font-weight:600;color:#fff;margin-bottom:2px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${item.label}</div>
        <div class="mono" style="font-size:10.5px;color:var(--accent,#4f8ef7);font-weight:500">${item.w} × ${item.h} px</div>
      `;

      card.addEventListener('click', (e) => {
        if (e.target.closest('.nc-del-btn')) return;
        selectedConfig = {
          id: item.id,
          docName: docNameInput.value || 'Untitled-1',
          label: item.label,
          w: item.w,
          h: item.h,
          ppi: item.ppi || 72,
          unit: item.unit || 'px',
          bgOption: selectedConfig.bgOption,
          customBgColor: selectedConfig.customBgColor,
          isCustom: false,
        };
        updateInspectorFromConfig();
        renderGrid();
      });

      card.addEventListener('dblclick', () => {
        executeCreate(item);
      });

      const delBtn = card.querySelector('.nc-del-btn');
      if (delBtn) {
        delBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          removeRecentCanvasSize(item.id);
          renderGrid();
        });
      }

      presetsGrid.appendChild(card);
    }
  };

  const executeCreate = async (config = selectedConfig) => {
    if (opts.onBeforeCreate) {
      const allow = await opts.onBeforeCreate();
      if (!allow) return;
    }

    const finalW = Math.max(1, Math.min(30000, Math.round(config.w)));
    const finalH = Math.max(1, Math.min(30000, Math.round(config.h)));
    const finalPpi = Math.max(1, Math.min(1200, Math.round(config.ppi || 72)));
    const bg = config.bgOption || 'white';
    const customBg = config.customBgColor || '#ffffff';

    addRecentCanvasSize({
      label: config.label || `${finalW} × ${finalH} px @ ${finalPpi} ppi`,
      w: finalW,
      h: finalH,
      ppi: finalPpi,
      unit: config.unit || 'px',
      bgOption: bg,
      customBgColor: customBg,
      isCustom: config.isCustom,
    });

    session.createDefaultDocument(finalW, finalH, finalPpi, bg, customBg);
    close();
    onCreated?.();
  };

  const onInspectorChange = () => {
    const unit = inpUnit.value;
    const ppi = Math.max(1, parseFloat(inpPpi.value) || 72);
    const rawW = parseFloat(inpW.value) || 1920;
    const rawH = parseFloat(inpH.value) || 1080;
    const pxW = Math.max(1, Math.round(unitToPx(rawW, unit, ppi)));
    const pxH = Math.max(1, Math.round(unitToPx(rawH, unit, ppi)));

    selectedConfig = {
      id: null,
      docName: docNameInput.value || 'Untitled-1',
      label: 'Custom Size',
      w: pxW,
      h: pxH,
      ppi,
      unit,
      bgOption: bgSelect.value,
      customBgColor: bgColorPicker.value,
      isCustom: true,
    };

    updateOrientationUI();
    renderGrid();
  };

  inpW.addEventListener('input', onInspectorChange);
  inpH.addEventListener('input', onInspectorChange);
  inpPpi.addEventListener('input', onInspectorChange);
  docNameInput.addEventListener('input', () => {
    selectedConfig.docName = docNameInput.value;
  });

  inpUnit.addEventListener('change', () => {
    const newUnit = inpUnit.value;
    const ppi = Math.max(1, parseFloat(inpPpi.value) || 72);
    selectedConfig.unit = newUnit;
    inpW.value = pxToUnit(selectedConfig.w, newUnit, ppi);
    inpH.value = pxToUnit(selectedConfig.h, newUnit, ppi);
  });

  bgSelect.addEventListener('change', () => {
    selectedConfig.bgOption = bgSelect.value;
    customColorChip.style.display = bgSelect.value === 'custom' ? 'block' : 'none';
  });

  bgColorPicker.addEventListener('input', () => {
    selectedConfig.customBgColor = bgColorPicker.value;
    customColorChip.style.background = bgColorPicker.value;
  });

  orientPortBtn.addEventListener('click', () => {
    if (selectedConfig.w > selectedConfig.h) {
      const tmp = selectedConfig.w;
      selectedConfig.w = selectedConfig.h;
      selectedConfig.h = tmp;
      updateInspectorFromConfig();
      renderGrid();
    }
  });

  orientLandBtn.addEventListener('click', () => {
    if (selectedConfig.h > selectedConfig.w) {
      const tmp = selectedConfig.w;
      selectedConfig.w = selectedConfig.h;
      selectedConfig.h = tmp;
      updateInspectorFromConfig();
      renderGrid();
    }
  });

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeCategory = btn.dataset.cat;
      filterInput.value = '';
      filterQuery = '';
      renderGrid();
    });
  });

  filterInput.addEventListener('input', () => {
    filterQuery = filterInput.value.trim();
    renderGrid();
  });

  saveDefaultBtn.addEventListener('click', () => {
    const ok = saveDefaultCanvasSettings({
      presetId: selectedConfig.id || 'custom',
      docName: docNameInput.value || 'Untitled-1',
      label: selectedConfig.label,
      unit: selectedConfig.unit || 'px',
      width: selectedConfig.w,
      height: selectedConfig.h,
      ppi: selectedConfig.ppi || 72,
      bgOption: selectedConfig.bgOption,
      customBgColor: selectedConfig.customBgColor,
    });
    if (ok) {
      saveDefaultLbl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px;color:#4ade80">${iconCheck(12)} Saved as Default!</span>`;
      setTimeout(() => {
        saveDefaultLbl.textContent = 'Set as Default';
      }, 2000);
    }
  });

  createBtn.addEventListener('click', () => executeCreate());
  cancelBtn.addEventListener('click', () => close());
  closeBtn.addEventListener('click', () => close());

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      close();
    } else if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') {
      e.stopPropagation();
      executeCreate();
    }
  };
  window.addEventListener('keydown', onKeyDown);

  const close = () => {
    window.removeEventListener('keydown', onKeyDown);
    styleTag.remove();
    overlay.remove();
  };

  updateInspectorFromConfig();
  renderGrid();
}
