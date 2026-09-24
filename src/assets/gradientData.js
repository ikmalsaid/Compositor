// ─────────────────────────────────────────────────────────────────────────────
// assets/gradientData.js — Multi-Point Gradient Presets & Color System Engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Curated multi-point gradient presets
 */
export const GRADIENT_PRESETS = {
  'rainbow-spectrum': {
    id: 'rainbow-spectrum',
    name: 'Rainbow Spectrum (7 Colors)',
    category: 'rainbow',
    stops: [
      { offset: 0.00, color: '#ff0000' },
      { offset: 0.17, color: '#ff7700' },
      { offset: 0.33, color: '#ffff00' },
      { offset: 0.50, color: '#00dd44' },
      { offset: 0.67, color: '#00bbff' },
      { offset: 0.83, color: '#4400ff' },
      { offset: 1.00, color: '#aa00ff' },
    ],
  },
  'rainbow-pastel': {
    id: 'rainbow-pastel',
    name: 'Pastel Rainbow Clouds',
    category: 'rainbow',
    stops: [
      { offset: 0.00, color: '#ffb3ba' },
      { offset: 0.17, color: '#ffdfba' },
      { offset: 0.33, color: '#ffffba' },
      { offset: 0.50, color: '#baffc9' },
      { offset: 0.67, color: '#bae1ff' },
      { offset: 0.83, color: '#e8baff' },
      { offset: 1.00, color: '#ffd1dc' },
    ],
  },
  'sunset-flame': {
    id: 'sunset-flame',
    name: 'Sunset Horizon',
    category: 'warm',
    stops: [
      { offset: 0.00, color: '#ff0844' },
      { offset: 0.25, color: '#ff4e50' },
      { offset: 0.55, color: '#f9d423' },
      { offset: 0.80, color: '#ff758c' },
      { offset: 1.00, color: '#780206' },
    ],
  },
  'cyberpunk-neon': {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    category: 'vibrant',
    stops: [
      { offset: 0.00, color: '#ff007f' },
      { offset: 0.35, color: '#7928ca' },
      { offset: 0.70, color: '#00f0ff' },
      { offset: 1.00, color: '#39ff14' },
    ],
  },
  'metallic-chrome': {
    id: 'metallic-chrome',
    name: 'Metallic Silver Chrome',
    category: 'metallic',
    stops: [
      { offset: 0.00, color: '#ffffff' },
      { offset: 0.25, color: '#e6e6fa' },
      { offset: 0.50, color: '#808099' },
      { offset: 0.75, color: '#ffffff' },
      { offset: 1.00, color: '#303048' },
    ],
  },
  'golden-royal': {
    id: 'golden-royal',
    name: 'Golden Royalty',
    category: 'metallic',
    stops: [
      { offset: 0.00, color: '#ffe066' },
      { offset: 0.28, color: '#f5af19' },
      { offset: 0.55, color: '#e65c00' },
      { offset: 0.78, color: '#ffd700' },
      { offset: 1.00, color: '#8a6515' },
    ],
  },
  'emerald-aurora': {
    id: 'emerald-aurora',
    name: 'Emerald Aurora',
    category: 'cool',
    stops: [
      { offset: 0.00, color: '#00f260' },
      { offset: 0.35, color: '#0575e6' },
      { offset: 0.70, color: '#00f5d4' },
      { offset: 1.00, color: '#0f3443' },
    ],
  },
  'ocean-deep': {
    id: 'ocean-deep',
    name: 'Ocean Depths',
    category: 'cool',
    stops: [
      { offset: 0.00, color: '#2b5876' },
      { offset: 0.40, color: '#4e4376' },
      { offset: 0.75, color: '#00c6ff' },
      { offset: 1.00, color: '#0072ff' },
    ],
  },
  'fire-lava': {
    id: 'fire-lava',
    name: 'Molten Fire Lava',
    category: 'warm',
    stops: [
      { offset: 0.00, color: '#ffffff' },
      { offset: 0.25, color: '#ffff00' },
      { offset: 0.65, color: '#ff3300' },
      { offset: 1.00, color: '#330000' },
    ],
  },
  'cotton-candy': {
    id: 'cotton-candy',
    name: 'Cotton Candy Pastel',
    category: 'fun',
    stops: [
      { offset: 0.00, color: '#ff9a9e' },
      { offset: 0.35, color: '#fecfef' },
      { offset: 0.70, color: '#a1c4fd' },
      { offset: 1.00, color: '#c2e9fb' },
    ],
  },
};

/**
 * Normalizes an array of color strings or stop objects to standardized [{ offset: number, color: string }]
 * @param {Array<string|{offset?: number, color: string}>} stopsOrColors
 * @returns {Array<{offset: number, color: string}>}
 */
export function normalizeStops(stopsOrColors) {
  if (!Array.isArray(stopsOrColors) || stopsOrColors.length === 0) {
    return [
      { offset: 0, color: '#000000' },
      { offset: 1, color: '#ffffff' },
    ];
  }

  // Check if it's already an array of stop objects with offsets
  if (typeof stopsOrColors[0] === 'object' && stopsOrColors[0] !== null && 'color' in stopsOrColors[0]) {
    const sorted = [...stopsOrColors].sort((a, b) => (a.offset ?? 0) - (b.offset ?? 0));
    return sorted.map((s, idx) => ({
      offset: typeof s.offset === 'number' ? Math.max(0, Math.min(1, s.offset)) : (idx / Math.max(1, sorted.length - 1)),
      color: s.color || '#ffffff',
    }));
  }

  // It's an array of color strings
  const count = stopsOrColors.length;
  if (count === 1) {
    return [
      { offset: 0, color: stopsOrColors[0] },
      { offset: 1, color: stopsOrColors[0] },
    ];
  }

  const step = 1 / (count - 1);
  return stopsOrColors.map((col, idx) => ({
    offset: Number((idx * step).toFixed(4)),
    color: typeof col === 'string' ? col : '#ffffff',
  }));
}

/**
 * Generates a CSS linear-gradient() string from stops and an angle in degrees
 * @param {Array<{offset: number, color: string}>|Array<string>} stops
 * @param {number} [angle=90] Angle in degrees (e.g. 0 for to right, 90 for to bottom)
 * @returns {string}
 */
export function stopsToCss(stops, angle = 90) {
  const norm = normalizeStops(stops);
  const stopStr = norm
    .map(s => `${s.color} ${(s.offset * 100).toFixed(1)}%`)
    .join(', ');
  return `linear-gradient(${angle}deg, ${stopStr})`;
}

/**
 * Helper to parse a color string to [r, g, b, a]
 */
function parseColorToRgba(colorStr) {
  if (!colorStr || colorStr === 'transparent') return [0, 0, 0, 0];

  // Hex #rgb or #rrggbb or #rrggbbaa
  if (colorStr.startsWith('#')) {
    let hex = colorStr.slice(1);
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1.0,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16) / 255,
      ];
    }
  }

  // rgb(...) or rgba(...)
  const match = colorStr.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
  if (match) {
    return [
      parseInt(match[1], 10),
      parseInt(match[2], 10),
      parseInt(match[3], 10),
      match[4] !== undefined ? parseFloat(match[4]) : 1.0,
    ];
  }

  return [0, 0, 0, 1.0];
}

/**
 * Samples a multi-point gradient at position t (0 <= t <= 1) and returns rgba string
 * @param {Array<{offset: number, color: string}>} stops
 * @param {number} t (0.0 to 1.0)
 * @returns {string} rgba string
 */
export function sampleGradient(stops, t) {
  const norm = normalizeStops(stops);
  const clampedT = Math.max(0, Math.min(1, t));

  if (clampedT <= norm[0].offset) return norm[0].color;
  if (clampedT >= norm[norm.length - 1].offset) return norm[norm.length - 1].color;

  let left = norm[0];
  let right = norm[norm.length - 1];

  for (let i = 0; i < norm.length - 1; i++) {
    if (clampedT >= norm[i].offset && clampedT <= norm[i + 1].offset) {
      left = norm[i];
      right = norm[i + 1];
      break;
    }
  }

  const range = (right.offset - left.offset) || 1;
  const localFactor = Math.max(0, Math.min(1, (clampedT - left.offset) / range));

  const c1 = parseColorToRgba(left.color);
  const c2 = parseColorToRgba(right.color);

  const r = Math.round(c1[0] + (c2[0] - c1[0]) * localFactor);
  const g = Math.round(c1[1] + (c2[1] - c1[1]) * localFactor);
  const b = Math.round(c1[2] + (c2[2] - c1[2]) * localFactor);
  const a = Number((c1[3] + (c2[3] - c1[3]) * localFactor).toFixed(3));

  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
