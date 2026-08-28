#!/usr/bin/env node
/**
 * Renders the 1200×630 social preview (one per language) from the hero portrait.
 * Twitter/LinkedIn crop the tall portrait to mush without it.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMG_DIR = path.join(ROOT, "templates", "img");
const SOURCE = path.join(IMG_DIR, "portrait.jpg");

const WIDTH = 1200;
const HEIGHT = 630;
const PHOTO_WIDTH = 460;

const SERIF = "PT Serif, Georgia, Times New Roman, serif";
const SANS = "Manrope, Helvetica Neue, Helvetica, Arial, sans-serif";

const VARIANTS = [
  {
    file: "og-cover.jpg",
    name: "Игорь Пахолков",
    role: "Руководитель группы разработки на C#",
    facts: ["11+ лет в разработке", ".NET · Python · Kafka"],
  },
  {
    file: "og-cover-en.jpg",
    name: "Igor Pakholkov",
    role: "C# development team lead",
    facts: ["11+ years in development", ".NET · Python · Kafka"],
  },
];

const escapeXml = (value) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function backdrop({ name, role, facts }) {
  const factLine = facts.map(escapeXml).join("   ·   ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="paper" x1="0" y1="0" x2="0.4" y2="1">
      <stop offset="0" stop-color="#f7f4ec"/>
      <stop offset="0.45" stop-color="#f3f0e8"/>
      <stop offset="1" stop-color="#ece8de"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.1" cy="0" r="0.8">
      <stop offset="0" stop-color="#064f4f" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#064f4f" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#paper)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)"/>
  <text x="72" y="150" font-family="${SANS}" font-size="26" font-weight="600" letter-spacing="4" fill="#064f4f">CODERGOSHA.COM</text>
  <text x="72" y="258" font-family="${SERIF}" font-size="66" font-weight="700" fill="#151813">${escapeXml(name)}</text>
  <rect x="72" y="296" width="96" height="4" rx="2" fill="#064f4f"/>
  <text x="72" y="368" font-family="${SANS}" font-size="34" fill="#3d4a41">${escapeXml(role)}</text>
  <text x="72" y="500" font-family="${SANS}" font-size="24" fill="#667066">${factLine}</text>
</svg>`;
}

if (!fs.existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}

const photo = await sharp(SOURCE)
  .resize({ width: PHOTO_WIDTH, height: HEIGHT, fit: "cover", position: "top" })
  .toBuffer();

for (const variant of VARIANTS) {
  const output = path.join(IMG_DIR, variant.file);
  await sharp(Buffer.from(backdrop(variant)))
    .composite([{ input: photo, left: WIDTH - PHOTO_WIDTH, top: 0 }])
    .jpeg({ quality: 86, mozjpeg: true })
    .toFile(output);

  const { size } = fs.statSync(output);
  console.log(`${variant.file}: ${(size / 1024).toFixed(1)} KB`);
}
