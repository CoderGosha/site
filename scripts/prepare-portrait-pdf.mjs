#!/usr/bin/env node
/**
 * Square center-crop + high-quality resize for PDF resume photo.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE = path.join(ROOT, "templates", "img", "portrait.jpg");
const OUTPUT = path.join(ROOT, "templates", "img", "portrait-pdf.jpg");
const SIZE = 672;

if (!fs.existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}

try {
  execSync("ffmpeg -version", { stdio: "ignore" });
} catch {
  console.error("ffmpeg is required to prepare portrait-pdf.jpg");
  process.exit(1);
}

const filter = [
  "crop='min(iw,ih)':'min(iw,ih)':'(iw-min(iw,ih))/2':'(ih-min(iw,ih))/2'",
  `scale=${SIZE}:${SIZE}:flags=lanczos`,
].join(",");

execSync(
  `ffmpeg -y -hide_banner -loglevel error -i "${SOURCE}" -vf "${filter}" -map_metadata -1 -q:v 2 "${OUTPUT}"`,
  { stdio: "inherit" }
);

console.log(`portrait-pdf.jpg: ${SIZE}×${SIZE}`);
