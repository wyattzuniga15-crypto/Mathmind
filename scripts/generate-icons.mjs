#!/usr/bin/env node
/**
 * Renders the app icons in public/ from the Mercury brand mark.
 *
 * The PNGs are committed, so this only needs running when the mark or the
 * brand colour changes. `sharp` is installed on demand rather than declared
 * as a dependency -- same reasoning as Playwright in the e2e suite: an asset
 * generator has no business in a production bundle.
 *
 *   npm install --no-save sharp && node scripts/generate-icons.mjs
 */
import { writeFile } from 'node:fs/promises';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const publicDir = join(root, 'public');

const BRAND = '#4f46e5';

/**
 * One ray: widest at the centre, tapering to a point at the tip. Six of them
 * rotated about the centre make the mark. Kept in sync by hand with
 * `MercuryMark` in src/components/icons.tsx, which is the same path scaled
 * to a 24-unit viewBox.
 */
const RAY = 'M 128 128 C 118 98, 118 62, 128 32 C 138 62, 138 98, 128 128 Z';

/**
 * @param scale Shrinks the mark about the centre. Maskable icons are cropped
 *   to a circle of 80% diameter by the launcher, so the mark has to sit well
 *   inside that or Android clips its rays.
 */
function markSvg(scale = 1) {
  const rays = [0, 60, 120, 180, 240, 300]
    .map((a) => `<path d="${RAY}" transform="rotate(${a} 128 128)"/>`)
    .join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<rect width="256" height="256" fill="${BRAND}"/>
<g fill="#fff" transform="translate(128 128) scale(${scale}) translate(-128 -128)">${rays}</g>
</svg>`;
}

const targets = [
  { file: 'icon-192.png', size: 192, scale: 1 },
  { file: 'icon-512.png', size: 512, scale: 1 },
  { file: 'apple-touch-icon.png', size: 180, scale: 1 },
  { file: 'icon-maskable-512.png', size: 512, scale: 0.72 },
];

const { default: sharp } = await import('sharp').catch(() => {
  throw new Error('sharp is required: npm install --no-save sharp');
});

for (const { file, size, scale } of targets) {
  await sharp(Buffer.from(markSvg(scale))).resize(size, size).png().toFile(join(publicDir, file));
  console.log(`wrote public/${file} (${size}x${size})`);
}

// The SVG favicon is the master the PNGs are rendered from, so it is written
// here too rather than drifting from them.
await writeFile(join(publicDir, 'favicon.svg'), markSvg(1) + '\n');
console.log('wrote public/favicon.svg');
