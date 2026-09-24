// ─────────────────────────────────────────────────────────────────────────────
// scripts/syncFluentEmoji.js
// Generates src/assets/clipartData.js with ALL icons from @iconify-json/fluent-emoji
// Run via: npm run update-cliparts
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const fluentIcons = require('@iconify-json/fluent-emoji/icons.json');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

export const CLIPART_CATEGORIES = [
  { id: 'all', label: 'All Cliparts', icon: 'fa-table-cells-large' },
  { id: 'characters', label: 'Characters & People', icon: 'fa-person' },
  { id: 'nature', label: 'Nature & Animals', icon: 'fa-cloud-sun' },
  { id: 'food', label: 'Food & Drinks', icon: 'fa-burger' },
  { id: 'tech', label: 'Tech & Gadgets', icon: 'fa-laptop' },
  { id: 'office', label: 'Office & Work', icon: 'fa-briefcase' },
  { id: 'school', label: 'School & Education', icon: 'fa-graduation-cap' },
  { id: 'banners', label: 'Banners & Awards', icon: 'fa-ribbon' },
  { id: 'bubbles', label: 'Speech & Bubbles', icon: 'fa-comment-dots' },
  { id: 'symbols', label: 'Symbols & Signs', icon: 'fa-star' },
  { id: 'vehicles', label: 'Vehicles & Transport', icon: 'fa-rocket' },
  { id: 'music', label: 'Music & Audio', icon: 'fa-music' },
  { id: 'retro', label: 'Retro & Arcade', icon: 'fa-dice' },
  { id: 'custom', label: 'My Custom Imports', icon: 'fa-folder-plus' },
];

function categorize(key) {
  // music
  if (key.includes('guitar') || key.includes('violin') || key.includes('drum') || key.includes('piano') || key.includes('trumpet') || key.includes('saxophone') || key.includes('accordion') || key.includes('banjo') || key.includes('flute') || key.includes('microphone') || key.includes('headphone') || key.includes('musical') || key.includes('music') || key.includes('radio') || key.includes('speaker') || key.includes('sound') || key.includes('bell') || key.includes('horn')) {
    return 'music';
  }
  // tech
  if (key.includes('computer') || key.includes('laptop') || key.includes('phone') || key.includes('telephone') || key.includes('mouse') || key.includes('keyboard') || key.includes('screen') || key.includes('printer') || key.includes('floppy') || key.includes('optical-disk') || key.includes('cd') || key.includes('dvd') || key.includes('disk') || key.includes('game') || key.includes('video-game') || key.includes('joystick') || key.includes('cassette') || key.includes('camera') || key.includes('video') || key.includes('television') || key.includes('tv') || key.includes('battery') || key.includes('electric') || key.includes('plug') || key.includes('satellite') || key.includes('robot')) {
    return 'tech';
  }
  // office
  if (key.includes('briefcase') || key.includes('folder') || key.includes('file') || key.includes('paperclip') || key.includes('clipboard') || key.includes('calendar') || key.includes('desk') || key.includes('memo') || key.includes('card-file') || key.includes('card-index') || key.includes('ledger') || key.includes('chart') || key.includes('graph') || key.includes('envelope') || key.includes('mailbox') || key.includes('postbox') || key.includes('package') || key.includes('box') || key.includes('stapler') || key.includes('calculator') || key.includes('abacus') || key.includes('wastebasket')) {
    return 'office';
  }
  // school
  if (key.includes('book') || key.includes('pencil') || key.includes('pen') || key.includes('crayon') || key.includes('graduation') || key.includes('globe') || key.includes('microscope') || key.includes('telescope') || key.includes('alembic') || key.includes('test-tube') || key.includes('petri') || key.includes('dna') || key.includes('ruler') || key.includes('compass') || key.includes('backpack') || key.includes('school') || key.includes('mortarboard') || key.includes('blackboard') || key.includes('light-bulb')) {
    return 'school';
  }
  // bubbles
  if (key.includes('speech') || key.includes('thought') || key.includes('anger-bubble') || key.includes('bubble') || key.includes('collision') || key.includes('balloon')) {
    return 'bubbles';
  }
  // banners
  if (key.includes('medal') || key.includes('ribbon') || key.includes('rosette') || key.includes('trophy') || key.includes('scroll') || key.includes('shield') || key.includes('crown') || key.includes('flag') || key.includes('banner') || key.includes('ticket') || key.includes('label')) {
    return 'banners';
  }
  // food
  if (key.includes('apple') || key.includes('fruit') || key.includes('bread') || key.includes('pizza') || key.includes('burger') || key.includes('hamburger') || key.includes('coffee') || key.includes('tea') || key.includes('beverage') || key.includes('drink') || key.includes('ice-cream') || key.includes('cake') || key.includes('chocolate') || key.includes('candy') || key.includes('doughnut') || key.includes('cookie') || key.includes('pie') || key.includes('meat') || key.includes('chicken') || key.includes('egg') || key.includes('cheese') || key.includes('rice') || key.includes('noodle') || key.includes('soup') || key.includes('salad') || key.includes('sandwich') || key.includes('taco') || key.includes('burrito') || key.includes('sushi') || key.includes('bento') || key.includes('potato') || key.includes('carrot') || key.includes('corn') || key.includes('pepper') || key.includes('banana') || key.includes('grape') || key.includes('melon') || key.includes('watermelon') || key.includes('orange') || key.includes('lemon') || key.includes('pineapple') || key.includes('mango') || key.includes('strawberry') || key.includes('cherry') || key.includes('peach') || key.includes('pear') || key.includes('avocado') || key.includes('tomato') || key.includes('olive') || key.includes('coconut') || key.includes('garlic') || key.includes('onion') || key.includes('mushroom') || key.includes('croissant') || key.includes('bagel') || key.includes('pancake') || key.includes('waffle') || key.includes('butter') || key.includes('popcorn') || key.includes('cup') || key.includes('mug') || key.includes('bottle') || key.includes('beer') || key.includes('wine') || key.includes('cocktail')) {
    return 'food';
  }
  // vehicles
  if (key.includes('car') || key.includes('automobile') || key.includes('vehicle') || key.includes('bus') || key.includes('train') || key.includes('rail') || key.includes('metro') || key.includes('tram') || key.includes('truck') || key.includes('lorry') || key.includes('bicycle') || key.includes('bike') || key.includes('motor') || key.includes('scooter') || key.includes('airplane') || key.includes('plane') || key.includes('helicopter') || key.includes('rocket') || key.includes('ship') || key.includes('boat') || key.includes('sailboat') || key.includes('canoe') || key.includes('ferry') || key.includes('anchor') || key.includes('parachute')) {
    return 'vehicles';
  }
  // retro
  if (key.includes('dice') || key.includes('die') || key.includes('magic') || key.includes('wand') || key.includes('crystal-ball') || key.includes('mirror-ball') || key.includes('gem') || key.includes('diamond') || key.includes('arcade') || key.includes('circus') || key.includes('yo-yo') || key.includes('kite') || key.includes('puzzle') || key.includes('chess') || key.includes('mahjong') || key.includes('cards') || key.includes('alien') || key.includes('monster') || key.includes('ghost') || key.includes('genie') || key.includes('dragon')) {
    return 'retro';
  }
  // nature
  if (key.includes('tree') || key.includes('flower') || key.includes('sun') || key.includes('cloud') || key.includes('rain') || key.includes('snow') || key.includes('wind') || key.includes('lightning') || key.includes('rainbow') || key.includes('star') || key.includes('moon') || key.includes('planet') || key.includes('comet') || key.includes('water') || key.includes('ocean') || key.includes('fire') || key.includes('flame') || key.includes('dog') || key.includes('cat') || key.includes('mouse') || key.includes('hamster') || key.includes('rabbit') || key.includes('fox') || key.includes('bear') || key.includes('panda') || key.includes('koala') || key.includes('tiger') || key.includes('lion') || key.includes('cow') || key.includes('pig') || key.includes('frog') || key.includes('monkey') || key.includes('bird') || key.includes('penguin') || key.includes('duck') || key.includes('eagle') || key.includes('owl') || key.includes('bat') || key.includes('wolf') || key.includes('horse') || key.includes('unicorn') || key.includes('bee') || key.includes('bug') || key.includes('butterfly') || key.includes('fish') || key.includes('shark') || key.includes('whale') || key.includes('dolphin') || key.includes('snake') || key.includes('turtle') || key.includes('leaf') || key.includes('plant') || key.includes('seedling') || key.includes('herb') || key.includes('clover') || key.includes('cactus') || key.includes('blossom') || key.includes('rose') || key.includes('tulip') || key.includes('mountain') || key.includes('volcano') || key.includes('beach') || key.includes('island')) {
    return 'nature';
  }
  // symbols
  if (key.includes('heart') || key.includes('check') || key.includes('cross') || key.includes('mark') || key.includes('sign') || key.includes('symbol') || key.includes('warning') || key.includes('arrow') || key.includes('stop') || key.includes('radioactive') || key.includes('biohazard') || key.includes('recycle') || key.includes('wheelchair') || key.includes('clock') || key.includes('hourglass') || key.includes('zodiac') || key.includes('button') || key.includes('keycap') || key.includes('target') || key.includes('bullseye') || key.includes('infinity') || key.includes('sparkle') || key.includes('sparkles') || key.includes('peace') || key.includes('trident') || key.includes('om') || key.includes('yin-yang')) {
    return 'symbols';
  }
  // characters (faces, people, expressions, professions)
  return 'characters';
}

function formatName(key) {
  return key
    .split('-')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function generateClipartDataJs() {
  console.log('Generating comprehensive clipart catalog from @iconify-json/fluent-emoji...');

  const allKeys = Object.keys(fluentIcons.icons);
  console.log(`Processing all ${allKeys.length} icons from @iconify-json/fluent-emoji...`);

  // Build the catalog metadata array
  const catalog = [];

  // Always prepend the reference benchmark item: nature-rainbow
  catalog.push({
    id: 'nature-rainbow',
    name: 'Vibrant Rainbow & Clouds',
    category: 'nature',
    tags: ['rainbow', 'clouds', 'sun', 'sky', 'weather'],
    fluentIcon: 'rainbow',
    isCustom: false,
    customSvg: `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="cloudGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff"/>
      <stop offset="70%" stop-color="#f0f7ff"/>
      <stop offset="100%" stop-color="#d4e8fc"/>
    </linearGradient>
    <radialGradient id="sunGrad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff8db"/>
      <stop offset="40%" stop-color="#ffd53d"/>
      <stop offset="100%" stop-color="#ff9a00"/>
    </radialGradient>
    <radialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#ffe600" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ffe600" stop-opacity="0"/>
    </radialGradient>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="1.5" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
    <filter id="cloudShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2.5" stdDeviation="2" flood-color="#8baecf" flood-opacity="0.35"/>
    </filter>
  </defs>
  <circle cx="50" cy="50" r="46" fill="url(#sunGlow)"/>
  <circle cx="50" cy="50" r="14" fill="url(#sunGrad)" filter="url(#softGlow)"/>
  <g fill="none" stroke-linecap="round" stroke-linejoin="round">
    <path d="M 12 70 A 38 38 0 0 1 88 70" stroke="#ff2a4b" stroke-width="4.5"/>
    <path d="M 16 70 A 34 34 0 0 1 84 70" stroke="#ff8c00" stroke-width="4.2"/>
    <path d="M 20 70 A 30 30 0 0 1 80 70" stroke="#ffd700" stroke-width="4.2"/>
    <path d="M 24 70 A 26 26 0 0 1 76 70" stroke="#22cc55" stroke-width="4.2"/>
    <path d="M 28 70 A 22 22 0 0 1 72 70" stroke="#0099ff" stroke-width="4.2"/>
    <path d="M 32 70 A 18 18 0 0 1 68 70" stroke="#7733ee" stroke-width="4.2"/>
    <path d="M 36 70 A 14 14 0 0 1 64 70" stroke="#ee33aa" stroke-width="4.2"/>
  </g>
  <g filter="url(#cloudShadow)">
    <path d="M 10 74 C 7 74 5 71 5 68 C 5 65 7 62 10 62 C 10 59 13 56 16 56 C 18 56 20 57 21 59 C 23 57 26 56 29 57 C 32 58 34 60 34 63 C 37 63 39 65 39 68 C 39 71 37 74 34 74 Z" fill="url(#cloudGrad)"/>
    <ellipse cx="20" cy="62" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>
  </g>
  <g filter="url(#cloudShadow)">
    <path d="M 66 74 C 63 74 61 71 61 68 C 61 65 63 62 66 62 C 66 59 69 56 72 56 C 74 56 76 57 77 59 C 79 57 82 56 85 57 C 88 58 90 60 90 63 C 93 63 95 65 95 68 C 95 71 93 74 90 74 Z" fill="url(#cloudGrad)"/>
    <ellipse cx="76" cy="62" rx="6" ry="4" fill="#ffffff" opacity="0.6"/>
  </g>
</svg>`
  });

  for (const key of allKeys) {
    if (key === 'rainbow') continue; // Handled by benchmark nature-rainbow
    const cat = categorize(key);
    const tags = key.split('-').filter(t => t.length > 1);
    if (!tags.includes(cat)) tags.push(cat);

    catalog.push({
      id: `fluent-${key}`,
      name: formatName(key),
      category: cat,
      tags: tags,
      fluentIcon: key
    });
  }

  console.log(`Compiled catalog with ${catalog.length} total cliparts.`);

  const fileContent = `// ─────────────────────────────────────────────────────────────────────────────
// src/assets/clipartData.js — Full Clipart Library Integrated with @iconify-json/fluent-emoji
// Total Built-in Vectors: ${catalog.length}
// Auto-generated by: npm run update-cliparts
// ─────────────────────────────────────────────────────────────────────────────

export const CLIPART_CATEGORIES = ${JSON.stringify(CLIPART_CATEGORIES, null, 2)};

const RAW_CATALOG = ${JSON.stringify(catalog, null, 2)};

// ─── Environment-Aware Fast Fluent Emoji SVG Renderer ──────────────────────────

let _nodeRequire = null;
let _cachedNodeIcons = null;

if (typeof window === 'undefined' && typeof process !== 'undefined') {
  const { createRequire } = await import('module');
  _nodeRequire = createRequire(import.meta.url);
}

function prefixSvgIds(svgBody, prefix) {
  if (!prefix) return svgBody;
  const idRegex = /\\bid="([^"]+)"/g;
  const ids = new Set();
  let m;
  while ((m = idRegex.exec(svgBody)) !== null) {
    ids.add(m[1]);
  }
  let result = svgBody;
  for (const id of ids) {
    const newId = \`\${prefix}-\${id}\`;
    result = result.split(\`id="\${id}"\`).join(\`id="\${newId}"\`);
    result = result.split(\`url(#\${id})\`).join(\`url(#\${newId})\`);
    result = result.split(\`href="#\${id}"\`).join(\`href="#\${newId}"\`);
  }
  return result;
}

export function renderFluentSvg(iconKey, prefix = '') {
  // 1. In Electron renderer: use native IPC bridge
  if (typeof window !== 'undefined' && window.api?.getFluentIconSvg) {
    return window.api.getFluentIconSvg(iconKey, prefix);
  }

  // 2. In Node.js (tests, build scripts): use direct local package
  if (_nodeRequire) {
    try {
      if (!_cachedNodeIcons) {
        _cachedNodeIcons = _nodeRequire('@iconify-json/fluent-emoji/icons.json');
      }
      const item = _cachedNodeIcons.icons[iconKey];
      if (!item || !item.body) return null;
      const body = prefixSvgIds(item.body, prefix);
      return \`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">\${body}</svg>\`;
    } catch (err) {
      console.error('Failed to render fluent icon in Node:', err);
      return \`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#2d323f"/><text x="16" y="21" font-size="14" text-anchor="middle" fill="#4f8ef7">🎨</text></svg>\`;
    }
  }

  return \`<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><rect width="32" height="32" rx="6" fill="#2d323f"/><text x="16" y="21" font-size="14" text-anchor="middle" fill="#4f8ef7">🎨</text></svg>\`;
}

// Attach high-performance lazy getters to each catalog item
export const BUILTIN_CLIPARTS = RAW_CATALOG.map((item) => {
  if (item.customSvg) {
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      tags: item.tags,
      fluentIcon: item.fluentIcon,
      svg: item.customSvg
    };
  }

  return {
    id: item.id,
    name: item.name,
    category: item.category,
    tags: item.tags,
    fluentIcon: item.fluentIcon,
    get svg() {
      if (!this._svg) {
        this._svg = renderFluentSvg(this.fluentIcon, this.id);
      }
      return this._svg;
    },
    set svg(val) {
      this._svg = val;
    }
  };
});

// Precomputed category counts for instantaneous O(1) sidebar rendering
export const CATEGORY_COUNTS = {};
for (const item of BUILTIN_CLIPARTS) {
  CATEGORY_COUNTS[item.category] = (CATEGORY_COUNTS[item.category] || 0) + 1;
}

// ─── Custom Clipart Storage (Local Storage) ───────────────────────────────────

const CUSTOM_CLIPARTS_STORAGE_KEY = 'compositor_custom_cliparts';

export function getCustomCliparts() {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_CLIPARTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error('Failed to load custom cliparts from localStorage:', err);
    return [];
  }
}

export function saveCustomCliparts(items) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(CUSTOM_CLIPARTS_STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    console.error('Failed to save custom cliparts to localStorage:', err);
  }
}

export function addCustomClipart({ name, svg, tags = [] }) {
  if (!name || !svg) return null;
  const items = getCustomCliparts();
  const id = 'custom-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
  const newItem = {
    id,
    name,
    category: 'custom',
    tags: Array.isArray(tags) ? tags : [tags],
    svg: svg.trim(),
    isCustom: true,
    addedAt: Date.now()
  };
  items.unshift(newItem);
  saveCustomCliparts(items);
  return newItem;
}

export function removeCustomClipart(id) {
  const items = getCustomCliparts();
  const filtered = items.filter(item => item.id !== id);
  saveCustomCliparts(filtered);
}

export function getAllCliparts() {
  const custom = getCustomCliparts();
  return [...BUILTIN_CLIPARTS, ...custom];
}
`;

  const outputPath = path.join(rootDir, 'src', 'assets', 'clipartData.js');
  fs.writeFileSync(outputPath, fileContent, 'utf8');
  console.log(`Successfully compiled ${catalog.length} cliparts into ${outputPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  generateClipartDataJs();
}
