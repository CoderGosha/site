#!/usr/bin/env node
/**
 * Builds the favicon set from a single monogram SVG: favicon.ico (16/32),
 * apple-touch-icon.png (180) and the vector icon browsers prefer.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const IMG_DIR = path.join(TEMPLATES_DIR, "img");

const ACCENT = "#064f4f";
const MARK = "#fbfaf6";

// "ИП"/"IP" monogram as paths: text nodes would depend on locally installed fonts.
const icon = (radius) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">
  <rect width="64" height="64" rx="${radius}" fill="${ACCENT}"/>
  <g fill="${MARK}">
    <rect x="17" y="18" width="7" height="28" rx="2"/>
    <rect x="32" y="18" width="7" height="28" rx="2"/>
    <path d="M37 18h5.5a8.5 8.5 0 0 1 0 17H37z"/>
  </g>
</svg>`;

function icoFromPngs(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size === 256 ? 0 : size, 0);
    entry.writeUInt8(size === 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((p) => p.data)]);
}

const render = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

fs.writeFileSync(path.join(IMG_DIR, "favicon.svg"), `${icon(14)}\n`);

const icoPngs = await Promise.all(
  [16, 32, 48].map(async (size) => ({ size, data: await render(icon(10), size) }))
);
fs.writeFileSync(path.join(TEMPLATES_DIR, "favicon.ico"), icoFromPngs(icoPngs));

// iOS masks the icon itself, so the source stays square with a small radius.
fs.writeFileSync(path.join(IMG_DIR, "apple-touch-icon.png"), await render(icon(6), 180));

for (const file of ["favicon.svg", "apple-touch-icon.png"]) {
  const { size } = fs.statSync(path.join(IMG_DIR, file));
  console.log(`${file}: ${(size / 1024).toFixed(1)} KB`);
}
const { size } = fs.statSync(path.join(TEMPLATES_DIR, "favicon.ico"));
console.log(`favicon.ico: ${(size / 1024).toFixed(1)} KB`);
