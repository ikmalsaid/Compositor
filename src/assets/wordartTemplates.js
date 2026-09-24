// ─────────────────────────────────────────────────────────────────────────────
// assets/wordartTemplates.js — 25+ Iconic Classic & Retro MS WordArt Style Presets
// ─────────────────────────────────────────────────────────────────────────────

import { normalizeStops } from './gradientData.js';

export const WORDART_TEMPLATES = [
  // ─── Iconic Rainbow WordArt Styles ───
  {
    id: 'rainbow-arch',
    name: 'Classic Rainbow Arch',
    category: 'rainbow',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#ff0000', '#ff7f00', '#ffff00', '#00e676', '#00b0ff', '#4400ff', '#8b00ff'],
    gradientAngle: 0,
    strokeColor: '#000000',
    strokeWidth: 3.5,
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    shadowBlur: 6,
    shadowX: 5,
    shadowY: 6,
    warpType: 'arch-up',
    warpAmount: 22,
    depth3D: 8,
    depthColor: '#1a1a24',
  },
  {
    id: 'rainbow-wave',
    name: 'Rainbow Wave',
    category: 'rainbow',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#ff0044', '#ff7700', '#ffea00', '#00dd44', '#00bbff', '#651fff', '#d500f9'],
    gradientAngle: 0,
    strokeColor: '#000000',
    strokeWidth: 3,
    shadowColor: 'rgba(0, 0, 0, 0.6)',
    shadowBlur: 6,
    shadowX: 4,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 20,
    depth3D: 4,
    depthColor: '#222222',
  },
  {
    id: 'rainbow-3d-extrude',
    name: 'Isometric 3D Rainbow',
    category: 'rainbow',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#ff2a55', '#ff9900', '#ffe600', '#00e676', '#00c3ff', '#7928ca'],
    gradientAngle: 45,
    strokeColor: '#0f0c29',
    strokeWidth: 2.5,
    shadowColor: 'rgba(0, 0, 40, 0.8)',
    shadowBlur: 4,
    shadowX: 12,
    shadowY: 12,
    warpType: 'none',
    warpAmount: 0,
    depth3D: 16,
    depthColor: '#1a103c',
  },
  {
    id: 'rainbow-neon-glow',
    name: 'Cyber Rainbow Neon',
    category: 'rainbow',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ff0055', '#ffaa00', '#ffff00', '#00ff66', '#00ffff', '#aa00ff'],
    gradientAngle: 0,
    strokeColor: '#ffffff',
    strokeWidth: 2,
    shadowColor: '#ff00ff',
    shadowBlur: 16,
    shadowX: 0,
    shadowY: 0,
    warpType: 'inflate',
    warpAmount: 18,
    depth3D: 2,
    depthColor: '#000000',
  },
  {
    id: 'rainbow-pastel-dream',
    name: 'Pastel Rainbow Clouds',
    category: 'rainbow',
    fontFamily: 'Trebuchet MS, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#ffb3ba', '#ffdfba', '#ffffba', '#baffc9', '#bae1ff', '#e8baff', '#ffd1dc'],
    gradientAngle: 90,
    strokeColor: '#ffffff',
    strokeWidth: 2.5,
    shadowColor: 'rgba(180, 150, 220, 0.6)',
    shadowBlur: 8,
    shadowX: 4,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 16,
    depth3D: 6,
    depthColor: '#6d597a',
  },
  {
    id: 'rainbow-slant-speed',
    name: 'Dynamic Rainbow Slant',
    category: 'rainbow',
    fontFamily: 'Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ff0000', '#ff8800', '#ffff00', '#00cc44', '#0088ff', '#8800ff'],
    gradientAngle: 0,
    strokeColor: '#111111',
    strokeWidth: 3,
    shadowColor: 'rgba(0, 0, 0, 0.7)',
    shadowBlur: 8,
    shadowX: 6,
    shadowY: 6,
    warpType: 'slant',
    warpAmount: 18,
    depth3D: 6,
    depthColor: '#330033',
  },

  // ─── 3D & Extruded Classic Styles ───
  {
    id: 'silver-chrome-3d',
    name: 'Silver Chrome 3D',
    category: '3d',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ffffff', '#e6e6fa', '#a0a0b0', '#ffffff', '#404060'],
    gradientAngle: 90,
    strokeColor: '#000022',
    strokeWidth: 2.5,
    shadowColor: 'rgba(0, 0, 40, 0.7)',
    shadowBlur: 8,
    shadowX: 8,
    shadowY: 10,
    warpType: 'arch-up',
    warpAmount: 15,
    depth3D: 12,
    depthColor: '#1a1a3a',
  },
  {
    id: 'sunset-flame',
    name: 'Sunset Flame',
    category: 'classic',
    fontFamily: 'Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ffff00', '#ff8c00', '#e74c3c', '#8b0000'],
    gradientAngle: 90,
    strokeColor: '#330000',
    strokeWidth: 3,
    shadowColor: 'rgba(230, 80, 0, 0.6)',
    shadowBlur: 10,
    shadowX: 5,
    shadowY: 5,
    warpType: 'slant',
    warpAmount: 14,
    depth3D: 6,
    depthColor: '#660000',
  },
  {
    id: 'ocean-wave',
    name: 'Ocean Wave',
    category: 'classic',
    fontFamily: 'Trebuchet MS, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#00f2fe', '#4facfe', '#00008b'],
    gradientAngle: 90,
    strokeColor: '#001a4d',
    strokeWidth: 3,
    shadowColor: 'rgba(0, 180, 255, 0.5)',
    shadowBlur: 8,
    shadowX: 4,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 24,
    depth3D: 6,
    depthColor: '#001133',
  },
  {
    id: 'isometric-3d',
    name: 'Isometric 3D Block',
    category: '3d',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'solid',
    colors: ['#f1c40f'],
    strokeColor: '#000000',
    strokeWidth: 2,
    shadowColor: 'rgba(0, 0, 0, 0.8)',
    shadowBlur: 4,
    shadowX: 12,
    shadowY: 12,
    warpType: 'none',
    warpAmount: 0,
    depth3D: 14,
    depthColor: '#1b4f72',
  },
  {
    id: 'neon-cyber',
    name: 'Neon Cyber Glow',
    category: 'modern',
    fontFamily: '"Courier New", monospace, sans-serif',
    fillType: 'solid',
    colors: ['#ff007f'],
    strokeColor: '#00ffff',
    strokeWidth: 2,
    shadowColor: '#00ffff',
    shadowBlur: 16,
    shadowX: 0,
    shadowY: 0,
    warpType: 'none',
    warpAmount: 0,
    depth3D: 0,
    depthColor: '#000',
  },
  {
    id: 'gold-trophy',
    name: 'Gold Trophy Emboss',
    category: 'classic',
    fontFamily: 'Georgia, serif',
    fillType: 'gradient',
    colors: ['#ffe066', '#ffd700', '#d4af37', '#8a6515'],
    gradientAngle: 90,
    strokeColor: '#4d3700',
    strokeWidth: 2.5,
    shadowColor: 'rgba(77, 55, 0, 0.7)',
    shadowBlur: 6,
    shadowX: 6,
    shadowY: 6,
    warpType: 'arch-up',
    warpAmount: 18,
    depth3D: 8,
    depthColor: '#5c4103',
  },
  {
    id: 'comic-pow',
    name: 'Comic Book POW',
    category: 'fun',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'solid',
    colors: ['#fff200'],
    strokeColor: '#000000',
    strokeWidth: 4,
    shadowColor: '#e74c3c',
    shadowBlur: 0,
    shadowX: 7,
    shadowY: 7,
    warpType: 'inflate',
    warpAmount: 22,
    depth3D: 8,
    depthColor: '#e74c3c',
  },
  {
    id: 'synthwave-80s',
    name: '80s Synthwave Sunset',
    category: 'modern',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ff007f', '#ff7700', '#ffe600'],
    gradientAngle: 90,
    strokeColor: '#00f2fe',
    strokeWidth: 3,
    shadowColor: 'rgba(255, 0, 127, 0.7)',
    shadowBlur: 12,
    shadowX: 6,
    shadowY: 8,
    warpType: 'slant',
    warpAmount: 12,
    depth3D: 6,
    depthColor: '#4a0072',
  },
  {
    id: 'emerald-gloss',
    name: 'Emerald Green Gloss',
    category: 'classic',
    fontFamily: 'Trebuchet MS, sans-serif',
    fillType: 'gradient',
    colors: ['#a8ff78', '#78ffd6', '#11998e', '#0f3443'],
    gradientAngle: 90,
    strokeColor: '#06261c',
    strokeWidth: 2.5,
    shadowColor: 'rgba(6, 38, 28, 0.6)',
    shadowBlur: 8,
    shadowX: 4,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 16,
    depth3D: 6,
    depthColor: '#083325',
  },
  {
    id: 'outline-3d',
    name: 'Hollow Wireframe 3D',
    category: '3d',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'solid',
    colors: ['#ffffff'],
    strokeColor: '#000000',
    strokeWidth: 3,
    shadowColor: 'rgba(0, 0, 0, 0.7)',
    shadowBlur: 0,
    shadowX: 10,
    shadowY: 10,
    warpType: 'arch-up',
    warpAmount: 16,
    depth3D: 10,
    depthColor: '#888888',
  },
  {
    id: 'parchment-vintage',
    name: 'Vintage Mahogany',
    category: 'classic',
    fontFamily: 'Georgia, "Times New Roman", serif',
    fillType: 'gradient',
    colors: ['#d7ccc8', '#8d6e63', '#4e342e', '#3e2723'],
    gradientAngle: 90,
    strokeColor: '#2b1b17',
    strokeWidth: 2.5,
    shadowColor: 'rgba(43, 27, 23, 0.6)',
    shadowBlur: 6,
    shadowX: 5,
    shadowY: 5,
    warpType: 'arch-up',
    warpAmount: 14,
    depth3D: 6,
    depthColor: '#271714',
  },
  {
    id: 'ice-cube-frost',
    name: 'Ice Frost 3D',
    category: '3d',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ffffff', '#e0f7fa', '#80deea', '#0097a7'],
    gradientAngle: 90,
    strokeColor: '#006064',
    strokeWidth: 2.5,
    shadowColor: 'rgba(0, 151, 167, 0.6)',
    shadowBlur: 8,
    shadowX: 6,
    shadowY: 6,
    warpType: 'arch-up',
    warpAmount: 16,
    depth3D: 10,
    depthColor: '#00363a',
  },
  {
    id: 'bubblegum-pop',
    name: 'Bubblegum Pop',
    category: 'fun',
    fontFamily: 'Impact, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#ff9a9e', '#fecfef', '#f43f5e'],
    gradientAngle: 90,
    strokeColor: '#881337',
    strokeWidth: 3,
    shadowColor: 'rgba(244, 63, 94, 0.6)',
    shadowBlur: 6,
    shadowX: 5,
    shadowY: 5,
    warpType: 'inflate',
    warpAmount: 20,
    depth3D: 8,
    depthColor: '#4c0519',
  },
  {
    id: 'laser-blast',
    name: 'Laser Red Blast',
    category: 'modern',
    fontFamily: 'Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ffffff', '#ff4d4d', '#cc0000'],
    gradientAngle: 90,
    strokeColor: '#660000',
    strokeWidth: 3,
    shadowColor: 'rgba(255, 0, 0, 0.8)',
    shadowBlur: 14,
    shadowX: 0,
    shadowY: 0,
    warpType: 'slant',
    warpAmount: 18,
    depth3D: 4,
    depthColor: '#330000',
  },
  {
    id: 'royal-velvet',
    name: 'Royal Purple Velvet',
    category: 'classic',
    fontFamily: 'Georgia, serif',
    fillType: 'gradient',
    colors: ['#e9d5ff', '#c084fc', '#9333ea', '#581c87'],
    gradientAngle: 90,
    strokeColor: '#3b0764',
    strokeWidth: 2.5,
    shadowColor: 'rgba(88, 28, 135, 0.7)',
    shadowBlur: 8,
    shadowX: 6,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 16,
    depth3D: 8,
    depthColor: '#2e1065',
  },
  {
    id: 'fire-arch',
    name: 'Inferno Arch Down',
    category: 'classic',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#fef08a', '#f97316', '#dc2626'],
    gradientAngle: 90,
    strokeColor: '#7f1d1d',
    strokeWidth: 3,
    shadowColor: 'rgba(220, 38, 38, 0.7)',
    shadowBlur: 8,
    shadowX: 5,
    shadowY: 7,
    warpType: 'arch-down',
    warpAmount: 20,
    depth3D: 6,
    depthColor: '#450a0a',
  },
  {
    id: 'toxic-ooze',
    name: 'Toxic Slime 3D',
    category: 'fun',
    fontFamily: 'Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#facc15', '#a3e635', '#4d7c0f'],
    gradientAngle: 90,
    strokeColor: '#1a2e05',
    strokeWidth: 3,
    shadowColor: 'rgba(163, 230, 53, 0.6)',
    shadowBlur: 8,
    shadowX: 6,
    shadowY: 8,
    warpType: 'wave',
    warpAmount: 22,
    depth3D: 10,
    depthColor: '#142004',
  },
  {
    id: 'candy-cane',
    name: 'Candy Stripe 3D',
    category: 'fun',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'gradient',
    colors: ['#ffffff', '#fca5a5', '#ef4444', '#b91c1c'],
    gradientAngle: 45,
    strokeColor: '#7f1d1d',
    strokeWidth: 2.5,
    shadowColor: 'rgba(185, 28, 28, 0.6)',
    shadowBlur: 6,
    shadowX: 5,
    shadowY: 5,
    warpType: 'arch-up',
    warpAmount: 18,
    depth3D: 8,
    depthColor: '#450a0a',
  },
  {
    id: 'midnight-shadow',
    name: 'Midnight Monolith',
    category: '3d',
    fontFamily: '"Arial Black", Impact, sans-serif',
    fillType: 'solid',
    colors: ['#38bdf8'],
    strokeColor: '#0c4a6e',
    strokeWidth: 2.5,
    shadowColor: 'rgba(12, 74, 110, 0.8)',
    shadowBlur: 2,
    shadowX: 14,
    shadowY: 14,
    warpType: 'none',
    warpAmount: 0,
    depth3D: 14,
    depthColor: '#082f49',
  },
  {
    id: 'copper-bronze',
    name: 'Antique Bronze 3D',
    category: 'classic',
    fontFamily: 'Georgia, serif',
    fillType: 'gradient',
    colors: ['#fdba74', '#ea580c', '#9a3412', '#431407'],
    gradientAngle: 90,
    strokeColor: '#270c04',
    strokeWidth: 2.5,
    shadowColor: 'rgba(67, 20, 7, 0.7)',
    shadowBlur: 6,
    shadowX: 6,
    shadowY: 6,
    warpType: 'arch-up',
    warpAmount: 15,
    depth3D: 8,
    depthColor: '#1a0703',
  },
  {
    id: 'aqua-drop',
    name: 'Aqua Marine Float',
    category: 'classic',
    fontFamily: 'Trebuchet MS, "Arial Black", sans-serif',
    fillType: 'gradient',
    colors: ['#67e8f9', '#06b6d4', '#0e7490'],
    gradientAngle: 90,
    strokeColor: '#164e63',
    strokeWidth: 2.5,
    shadowColor: 'rgba(14, 116, 144, 0.6)',
    shadowBlur: 8,
    shadowX: 4,
    shadowY: 6,
    warpType: 'wave',
    warpAmount: 18,
    depth3D: 6,
    depthColor: '#083344',
  }
];

WORDART_TEMPLATES.forEach(t => {
  if (!t.warp) t.warp = t.warpType;
  if (t.depth === undefined) t.depth = t.depth3D;
});

/**
 * Render WordArt to a standalone high-resolution canvas
 * @param {object} config
 * @returns {HTMLCanvasElement}
 */
export function renderWordArtCanvas(config = {}) {
  const text = config.text || 'WordArt';
  const tpl = WORDART_TEMPLATES.find(t => t.id === config.templateId) || WORDART_TEMPLATES[0];

  const fontSize = Math.max(16, config.fontSize || 64);
  const fontFamily = config.fontFamily || tpl.fontFamily || 'Impact, sans-serif';
  const warpType = config.warpType !== undefined ? config.warpType : (config.warp !== undefined ? config.warp : tpl.warpType);
  const warpAmount = config.warpAmount !== undefined ? config.warpAmount : tpl.warpAmount;
  const depth3D = config.depth3D !== undefined ? config.depth3D : (config.depth !== undefined ? config.depth : tpl.depth3D);

  const fillType = config.fillType || tpl.fillType || 'solid';
  const colors = config.colors || tpl.colors || ['#ffffff'];
  const gradientStops = config.gradientStops || config.stops || null;
  const gradientAngle = typeof config.gradientAngle === 'number' ? config.gradientAngle : (tpl.gradientAngle ?? 90);

  const fontStr = `bold ${fontSize}px ${fontFamily}`;

  // Temporary canvas to measure text
  const mCanvas = document.createElement('canvas');
  const mCtx = mCanvas.getContext('2d');
  mCtx.font = fontStr;
  const textMetrics = mCtx.measureText(text);
  const textW = Math.max(20, textMetrics.width);
  const textH = fontSize * 1.2;

  // Extra padding for 3D extrusion, shadows, and warp curvature
  const padX = 60 + Math.abs(depth3D) * 2;
  const padY = 60 + Math.abs(depth3D) * 2 + Math.abs(warpAmount) * 2;

  const canvasW = Math.ceil(textW + padX * 2);
  const canvasH = Math.ceil(textH + padY * 2);

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');

  ctx.font = fontStr;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';

  const centerX = canvasW / 2;
  const centerY = canvasH / 2;

  // ─── 3D Extrusion Pass ───
  if (depth3D > 0) {
    ctx.save();
    ctx.fillStyle = config.depthColor || tpl.depthColor || '#111111';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.5;

    for (let d = depth3D; d > 0; d--) {
      const offsetX = centerX + d * 0.8;
      const offsetY = centerY + d * 0.8;
      _drawWarpedText(ctx, text, offsetX, offsetY, textW, fontSize, warpType, warpAmount, true);
    }
    ctx.restore();
  }

  // ─── Main Text Pass ───
  ctx.save();

  // Create Fill style with multi-point gradient support
  if (fillType === 'gradient') {
    const stops = gradientStops
      ? normalizeStops(gradientStops)
      : (colors.length > 1 ? normalizeStops(colors) : normalizeStops([colors[0] || '#ffffff', colors[0] || '#ffffff']));
    const rad = (gradientAngle * Math.PI) / 180;
    const halfW = textW / 2;
    const halfH = fontSize / 2;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    const len = Math.max(1, Math.abs(halfW * cos) + Math.abs(halfH * sin));

    const x1 = centerX - cos * len;
    const y1 = centerY - sin * len;
    const x2 = centerX + cos * len;
    const y2 = centerY + sin * len;

    const grad = ctx.createLinearGradient(x1, y1, x2, y2);
    for (const s of stops) {
      grad.addColorStop(Math.max(0, Math.min(1, s.offset)), s.color);
    }
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = config.fillColor || (colors && colors[0]) || '#ffffff';
  }

  const sWidth = config.strokeWidth !== undefined ? config.strokeWidth : tpl.strokeWidth;
  const sColor = config.strokeColor || tpl.strokeColor;
  if (sWidth && sColor) {
    ctx.strokeStyle = sColor;
    ctx.lineWidth = sWidth;
  }

  const shColor = config.shadowColor || tpl.shadowColor;
  const shBlur = config.shadowBlur !== undefined ? config.shadowBlur : tpl.shadowBlur;
  if (shColor && shBlur) {
    ctx.shadowColor = shColor;
    ctx.shadowBlur = shBlur;
    ctx.shadowOffsetX = config.shadowX !== undefined ? config.shadowX : (tpl.shadowX || 0);
    ctx.shadowOffsetY = config.shadowY !== undefined ? config.shadowY : (tpl.shadowY || 0);
  }

  _drawWarpedText(ctx, text, centerX, centerY, textW, fontSize, warpType, warpAmount, false);

  ctx.restore();

  return canvas;
}

/** Helper to draw straight or warped text */
function _drawWarpedText(ctx, text, cx, cy, textW, fontSize, warpType, warpAmount, is3DPass) {
  if (warpType === 'none' || warpAmount === 0 || text.length <= 1) {
    if (!is3DPass && ctx.lineWidth) ctx.strokeText(text, cx, cy);
    ctx.fillText(text, cx, cy);
    return;
  }

  // Character-by-character warp deformation
  const chars = text.split('');
  const charWidths = chars.map(c => ctx.measureText(c).width);
  const totalW = charWidths.reduce((a, b) => a + b, 0);
  let curX = cx - totalW / 2;

  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    const cw = charWidths[i];
    const charCenterX = curX + cw / 2;
    const norm = (charCenterX - cx) / (totalW / 2 || 1); // -1.0 to +1.0

    let offsetY = 0;
    let charAngle = 0;
    let charScaleY = 1.0;

    if (warpType === 'arch-up') {
      offsetY = -(1 - norm * norm) * warpAmount;
      charAngle = norm * (warpAmount * 0.03);
    } else if (warpType === 'arch-down') {
      offsetY = (1 - norm * norm) * warpAmount;
      charAngle = -norm * (warpAmount * 0.03);
    } else if (warpType === 'wave') {
      offsetY = Math.sin(norm * Math.PI * 1.5) * warpAmount;
      charAngle = Math.cos(norm * Math.PI * 1.5) * (warpAmount * 0.025);
    } else if (warpType === 'inflate') {
      charScaleY = 1 + (1 - Math.abs(norm)) * (warpAmount / 30);
    } else if (warpType === 'slant') {
      offsetY = -norm * warpAmount;
    }

    ctx.save();
    ctx.translate(charCenterX, cy + offsetY);
    if (charAngle) ctx.rotate(charAngle);
    if (charScaleY !== 1.0) ctx.scale(1, charScaleY);

    if (!is3DPass && ctx.lineWidth) ctx.strokeText(ch, 0, 0);
    ctx.fillText(ch, 0, 0);

    ctx.restore();

    curX += cw;
  }
}

/**
 * Convenience wrapper for rendering WordArt to canvas
 */
export function renderWordArtToCanvas(text, templateId, options = {}) {
  return renderWordArtCanvas({
    text,
    templateId,
    ...options,
  });
}
