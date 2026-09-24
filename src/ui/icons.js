// ─────────────────────────────────────────────────────────────────────────────
// ui/icons.js  —  Universal FontAwesome 6 Icon Registry for Compositor
//                 Crisp, consistent, high-resolution vector icon pack
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a FontAwesome 6 icon <i> tag with explicit size and inline-flex alignment.
 * @param {string} iconClass FontAwesome solid class e.g. 'fa-paintbrush', 'fa-trash-can'
 * @param {object} opts
 * @param {number} [opts.size=14] Font size in px
 * @param {string} [opts.className=''] Optional extra CSS classes
 * @param {string} [opts.style=''] Optional inline styles
 */
export const createFaIcon = (iconClass, { size = 14, className = '', style = '' } = {}) => `
  <i class="fa-solid ${iconClass}${className ? ' ' + className : ''}" style="font-size:${size}px;line-height:1;display:inline-flex;align-items:center;justify-content:center;${style}"></i>
`.trim();

/** Backward-compatible SVG helper */
export const createSvg = (content, { size = 16, viewBox = '0 0 24 24', strokeWidth = 2, className = 'svg-icon' } = {}) => `
  <svg class="${className}" width="${size}" height="${size}" viewBox="${viewBox}" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${content}
  </svg>
`.trim();

// ─── Layer Panel Icons ────────────────────────────────────────────────────────

export const iconLayerPlus   = (size = 14) => createFaIcon('fa-plus', { size });
export const iconFolderPlus  = (size = 14) => createFaIcon('fa-folder-plus', { size });
export const iconDuplicate   = (size = 14) => createFaIcon('fa-clone', { size });
export const iconTrash       = (size = 14) => createFaIcon('fa-trash-can', { size });
export const iconEye         = (size = 13) => createFaIcon('fa-eye', { size });
export const iconEyeOff      = (size = 13) => createFaIcon('fa-eye-slash', { size });
export const iconLock        = (size = 13) => createFaIcon('fa-lock', { size });
export const iconLockOpen    = (size = 13) => createFaIcon('fa-lock-open', { size });
export const iconFolder      = (size = 14) => createFaIcon('fa-folder', { size });
export const iconLayer       = (size = 14) => createFaIcon('fa-layer-group', { size });
export const iconChevronRight= (size = 10) => createFaIcon('fa-chevron-right', { size });
export const iconChevronDown = (size = 10) => createFaIcon('fa-chevron-down', { size });

export const iconCursor     = (size = 16) => createFaIcon('fa-arrow-pointer', { size });
export const iconMove        = (size = 16) => createFaIcon('fa-up-down-left-right', { size });
export const iconMarquee     = (size = 16) => createFaIcon('fa-vector-square', { size });
export const iconLasso       = (size = 16) => createFaIcon('fa-draw-polygon', { size });
export const iconWand        = (size = 16) => createFaIcon('fa-wand-magic-sparkles', { size });
export const iconCrop        = (size = 16) => createFaIcon('fa-crop-simple', { size });
export const iconEyedropper  = (size = 16) => createFaIcon('fa-eye-dropper', { size });
export const iconBrush       = (size = 16) => createFaIcon('fa-paintbrush', { size });
export const iconEraser      = (size = 16) => createFaIcon('fa-eraser', { size });
export const iconClone       = (size = 16) => createFaIcon('fa-stamp', { size });
export const iconHeal        = (size = 16) => createFaIcon('fa-bandage', { size });
export const iconBlur        = (size = 16) => createFaIcon('fa-droplet', { size });
export const iconGradient    = (size = 16) => createFaIcon('fa-swatchbook', { size });
export const iconBucket      = (size = 16) => createFaIcon('fa-fill-drip', { size });
export const iconShape       = (size = 16) => createFaIcon('fa-shapes', { size });
export const iconText        = (size = 16) => createFaIcon('fa-font', { size });
export const iconClipart     = (size = 16) => createFaIcon('fa-icons', { size });
export const iconWordArt     = (size = 16) => createFaIcon('fa-signature', { size });
export const iconFlipH       = (size = 14) => createFaIcon('fa-arrows-left-right', { size });
export const iconFlipV       = (size = 14) => createFaIcon('fa-arrows-up-down', { size });
export const iconMirrorH     = (size = 14) => createFaIcon('fa-left-right', { size });
export const iconMirrorV     = (size = 14) => createFaIcon('fa-up-down', { size });
export const iconHand        = (size = 16) => createFaIcon('fa-hand', { size });
export const iconZoom        = (size = 16) => createFaIcon('fa-magnifying-glass', { size });
export const iconSwap        = (size = 12) => createFaIcon('fa-right-left', { size });
export const iconResetColor  = (size = 11) => `
  <span style="display:inline-flex;position:relative;width:${size + 3}px;height:${size + 3}px;">
    <i class="fa-solid fa-square" style="position:absolute;top:0;left:0;font-size:${size - 2}px;color:var(--text,#fff);"></i>
    <i class="fa-regular fa-square" style="position:absolute;bottom:0;right:0;font-size:${size - 2}px;color:var(--text-muted,#888);"></i>
  </span>
`.trim();

// ─── Modal & Action Icons ────────────────────────────────────────────────────

export const iconPrinter     = (size = 16) => createFaIcon('fa-print', { size });
export const iconPortrait    = (size = 14) => createFaIcon('fa-file', { size });
export const iconLandscape   = (size = 14) => createFaIcon('fa-image', { size });
export const iconPdf         = (size = 16) => createFaIcon('fa-file-pdf', { size });
export const iconDownload    = (size = 16) => createFaIcon('fa-download', { size });
export const iconLink        = (size = 14) => createFaIcon('fa-link', { size });
export const iconUnlink      = (size = 14) => createFaIcon('fa-link-slash', { size });
export const iconCheck       = (size = 13) => createFaIcon('fa-check', { size });
export const iconClose       = (size = 13) => createFaIcon('fa-xmark', { size });
export const iconSearch      = (size = 13) => createFaIcon('fa-magnifying-glass', { size });
export const iconPalette     = (size = 14) => createFaIcon('fa-palette', { size });
export const iconFill        = (size = 13) => createFaIcon('fa-fill', { size });
export const iconUndo        = (size = 14) => createFaIcon('fa-rotate-left', { size });
export const iconRedo        = (size = 14) => createFaIcon('fa-rotate-right', { size });
export const iconCut         = (size = 14) => createFaIcon('fa-scissors', { size });
export const iconCopy        = (size = 14) => createFaIcon('fa-copy', { size });
export const iconPaste       = (size = 14) => createFaIcon('fa-clipboard', { size });
