#!/usr/bin/env node
// Download self-hosted WOFF2 fonts (latin + latin-ext subsets only).
// Run once:  node scripts/download-fonts.js
//
// Fonts: Cinzel Decorative (headings), Cormorant Garamond (body), Jost (UI labels)
//
// Output: public/fonts/ + prints @font-face blocks ready to paste into src/index.css

import { createWriteStream, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = path.resolve(__dirname, '..', 'public', 'fonts');

// Modern Chrome UA → Google Fonts returns WOFF2
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';

// Only download latin and latin-ext (covers most European languages)
const SUBSETS = ['latin', 'latin-ext'];

const FONT_REQUESTS = [
  {
    id: 'cinzel-decorative',
    name: 'Cinzel Decorative',
    url: 'https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700;900&display=swap',
  },
  {
    id: 'cormorant-garamond',
    name: 'Cormorant Garamond',
    url: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;0,600;0,700;1,300;1,400;1,500;1,600;1,700&display=swap',
  },
  {
    id: 'jost',
    name: 'Jost',
    url: 'https://fonts.googleapis.com/css2?family=Jost:wght@300;400;500;600;700&display=swap',
  },
];

mkdirSync(FONTS_DIR, { recursive: true });

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

async function downloadFile(url, dest) {
  if (existsSync(dest)) return false;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  await pipeline(res.body, createWriteStream(dest));
  return true;
}

// Parse @font-face blocks from CSS string
function parseFontFaceBlocks(css) {
  const blocks = [];
  // Split by /* comment */ to get subset labels
  const parts = css.split(/\/\*\s*([\w-]+)\s*\*\//);
  let currentSubset = 'latin';
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      currentSubset = parts[i].trim();
    } else {
      const blockMatches = [...parts[i].matchAll(/@font-face\s*\{([^}]+)\}/g)];
      for (const [, body] of blockMatches) {
        const fontStyle = (body.match(/font-style:\s*(\w+)/) || [])[1] || 'normal';
        const fontWeight = (body.match(/font-weight:\s*([\d]+)/) || [])[1] || '400';
        const src = (body.match(/src:\s*url\(([^)]+\.woff2)\)/) || [])[1];
        const unicodeRange = (body.match(/unicode-range:\s*([^;]+)/) || [])[1]?.trim();
        if (src && SUBSETS.includes(currentSubset)) {
          blocks.push({ subset: currentSubset, fontStyle, fontWeight, src, unicodeRange });
        }
      }
    }
  }
  return blocks;
}

const allFontFace = [];

for (const font of FONT_REQUESTS) {
  console.log(`\n▸ ${font.name}`);
  const css = await fetchText(font.url);
  const blocks = parseFontFaceBlocks(css);

  if (!blocks.length) {
    console.error(`  ⚠ No font-face blocks parsed for ${font.name}`);
    console.error('  Raw CSS (first 500 chars):', css.slice(0, 500));
    continue;
  }

  for (const block of blocks) {
    const style = block.fontStyle === 'italic' ? 'italic' : 'normal';
    const filename = `${font.id}-${block.subset}-${style}-${block.fontWeight}.woff2`;
    const dest = path.join(FONTS_DIR, filename);
    const downloaded = await downloadFile(block.src, dest);
    console.log(`  ${downloaded ? 'downloaded' : 'exists    '}: ${filename}`);

    allFontFace.push(`@font-face {
  font-family: '${font.name}';
  font-style: ${style};
  font-weight: ${block.fontWeight};
  font-display: swap;
  src: url('/fonts/${filename}') format('woff2');${block.unicodeRange ? `
  unicode-range: ${block.unicodeRange};` : ''}
}`);
  }
}

// Print @font-face blocks
const output = allFontFace.join('\n\n');
writeFileSync(path.resolve(__dirname, '..', 'public', 'fonts', '_font-face-blocks.css'), output);

console.log('\n✓ Done. Font-face blocks saved to public/fonts/_font-face-blocks.css');
console.log('  Copy the contents into src/index.css (before the @layer base block).');
