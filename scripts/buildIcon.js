// ─────────────────────────────────────────────────────────────────────────────
// scripts/buildIcon.js  —  Generate multi-resolution Windows .ico asset
// ─────────────────────────────────────────────────────────────────────────────

import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const svg = `<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e1e28"/>
      <stop offset="100%" stop-color="#0e0e16"/>
    </linearGradient>
    <linearGradient id="cGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8"/>
      <stop offset="50%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="10" flood-color="#818cf8" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="256" height="256" rx="54" fill="url(#bgGrad)" stroke="rgba(255,255,255,0.12)" stroke-width="4"/>
  <g filter="url(#glow)">
    <path d="M168 84 C152 64 126 58 102 68 C76 80 62 108 62 136 C62 166 80 192 110 198 C134 204 158 194 172 174" fill="none" stroke="url(#cGrad)" stroke-width="26" stroke-linecap="round"/>
    <circle cx="178" cy="82" r="7" fill="#38bdf8"/>
    <circle cx="180" cy="172" r="7" fill="#c084fc"/>
  </g>
</svg>`;

async function main() {
  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const s of sizes) {
    const buf = await sharp(Buffer.from(svg)).resize(s, s).png().toBuffer();
    pngBuffers.push({ size: s, buf });
  }

  // Build ICO header + directory entries + image data
  const count = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  let offset = headerSize + count * dirEntrySize;

  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // ICO type
  header.writeUInt16LE(count, 4);

  const dirEntries = [];
  for (const img of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 0); // width (0 = 256)
    entry.writeUInt8(img.size === 256 ? 0 : img.size, 1); // height (0 = 256)
    entry.writeUInt8(0, 2); // color palette count
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.buf.length, 8); // size of image in bytes
    entry.writeUInt32LE(offset, 12); // offset of image data
    dirEntries.push(entry);
    offset += img.buf.length;
  }

  const finalIco = Buffer.concat([
    header,
    ...dirEntries,
    ...pngBuffers.map(p => p.buf),
  ]);

  const targetPath = path.resolve('src/assets/icon.ico');
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, finalIco);
  console.log(`✅ Generated multi-res Windows icon at ${targetPath} (${finalIco.length} bytes, ${sizes.length} sizes: ${sizes.join(', ')})`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
