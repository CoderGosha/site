#!/usr/bin/env node
/**
 * Re-encode the hero portrait as JPEG/WebP/AVIF, stripped of EXIF (GPS included)
 * and auto-rotated per the original orientation tag before it's dropped.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG_DIR = path.join(ROOT, "templates", "img");
const SOURCE = path.join(IMG_DIR, "portrait.jpg");
const WIDTH = 1200;

if (!fs.existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}

const pipeline = () =>
  sharp(SOURCE).rotate().resize({ width: WIDTH, withoutEnlargement: true });

const jpegTmp = path.join(IMG_DIR, "portrait.jpg.tmp");
await pipeline().jpeg({ quality: 82, mozjpeg: true }).toFile(jpegTmp);
await pipeline().webp({ quality: 80 }).toFile(path.join(IMG_DIR, "portrait.webp"));
await pipeline().avif({ quality: 55 }).toFile(path.join(IMG_DIR, "portrait.avif"));
fs.renameSync(jpegTmp, SOURCE);

for (const ext of ["jpg", "webp", "avif"]) {
  const { size } = fs.statSync(path.join(IMG_DIR, `portrait.${ext}`));
  console.log(`portrait.${ext}: ${(size / 1024).toFixed(1)} KB`);
}
