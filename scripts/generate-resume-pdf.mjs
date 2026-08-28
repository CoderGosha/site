#!/usr/bin/env node
/**
 * Generates a self-contained resume PDF (no external URLs in the document).
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const MIME = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

const TARGET = {
  urlPath: "/resume/print/index.html",
  output: path.join(ROOT, "content", "resume", "resume_pakholkov_ru.pdf"),
  portrait: path.join(DIST, "img", "portrait-pdf.jpg"),
  css: path.join(DIST, "css", "resume-pdf.min.css"),
};

async function loadPuppeteer() {
  try {
    return await import("puppeteer");
  } catch {
    console.error("puppeteer is required. Install with: npm install -D puppeteer");
    process.exit(1);
  }
}

function buildWithPrintPage() {
  // The print page is only emitted for this build, never for the published site.
  execSync("npm run build", {
    cwd: ROOT,
    stdio: "inherit",
    env: { ...process.env, BUILD_RESUME_PRINT: "1" },
  });
}

function ensurePortraitPdf() {
  const sourcePortrait = path.join(ROOT, "templates", "img", "portrait.jpg");
  const pdfPortrait = path.join(ROOT, "templates", "img", "portrait-pdf.jpg");
  const needsPrepare =
    !fs.existsSync(pdfPortrait) ||
    fs.statSync(sourcePortrait).mtimeMs > fs.statSync(pdfPortrait).mtimeMs;

  if (needsPrepare) {
    execSync("node scripts/prepare-portrait-pdf.mjs", { cwd: ROOT, stdio: "inherit" });
  }
}

function startStaticServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(DIST, safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(DIST) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({
        baseUrl: `http://127.0.0.1:${port}`,
        close: () =>
          new Promise((done) => {
            server.close(done);
          }),
      });
    });
  });
}

function finalizePdf(inputPath) {
  try {
    execSync("qpdf --version", { stdio: "ignore" });
  } catch {
    console.warn("qpdf not found: PDF left as Chromium generated it");
    return;
  }

  const tmp = `${inputPath}.tmp`;
  // Plain rewrite removes linearization. Chrome on file:// blocks byte-range
  // fetches for linearized PDFs → Network tab shows (blocked:origin) and lags.
  execSync(`qpdf --object-streams=disable --compress-streams=y "${inputPath}" "${tmp}"`, {
    stdio: "ignore",
  });
  fs.renameSync(tmp, inputPath);
}

async function inlineAssets(page, css, portraitBase64) {
  await page.evaluate(
    async ({ cssText, imageBase64 }) => {
      document.querySelector('link[rel="stylesheet"]')?.remove();

      const style = document.createElement("style");
      style.textContent = cssText;
      document.head.appendChild(style);

      const img = document.querySelector(".resume-pdf__photo img");
      if (!img || !imageBase64) return;

      img.src = `data:image/jpeg;base64,${imageBase64}`;
      img.removeAttribute("srcset");
      await img.decode();
    },
    { cssText: css, imageBase64: portraitBase64 }
  );
}

async function generatePdf(browser, baseUrl) {
  if (!fs.existsSync(TARGET.css)) {
    throw new Error(`Missing ${TARGET.css}. Run npm run build first.`);
  }
  if (!fs.existsSync(TARGET.portrait)) {
    throw new Error(`Missing ${TARGET.portrait}. Run npm run build first.`);
  }

  const css = fs.readFileSync(TARGET.css, "utf8");
  const portraitBase64 = fs.readFileSync(TARGET.portrait).toString("base64");

  const page = await browser.newPage();
  await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

  await page.setRequestInterception(true);
  page.on("request", (request) => {
    const url = request.url();
    if (request.isNavigationRequest() || url.startsWith(baseUrl)) {
      request.continue();
      return;
    }
    request.abort();
  });

  await page.goto(`${baseUrl}${TARGET.urlPath}`, { waitUntil: "load", timeout: 15000 });
  await page.waitForSelector(".resume-pdf__photo img", { timeout: 10000 });
  await inlineAssets(page, css, portraitBase64);
  await page.emulateMediaType("print");

  fs.mkdirSync(path.dirname(TARGET.output), { recursive: true });
  const tmpOutput = `${TARGET.output}.raw`;
  await page.pdf({
    path: tmpOutput,
    format: "A4",
    printBackground: true,
    preferCSSPageSize: true,
    tagged: false,
    outline: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  });
  await page.close();

  fs.renameSync(tmpOutput, TARGET.output);
  finalizePdf(TARGET.output);

  const sizeKb = Math.round(fs.statSync(TARGET.output).size / 1024);
  console.log(`${TARGET.output} (${sizeKb} KB)`);
}

async function main() {
  ensurePortraitPdf();
  buildWithPrintPage();
  const puppeteer = await loadPuppeteer();
  const browser = await puppeteer.default.launch({ headless: true });
  const server = await startStaticServer();

  try {
    await generatePdf(browser, server.baseUrl);
  } finally {
    await browser.close();
    await server.close();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
