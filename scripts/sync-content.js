#!/usr/bin/env node
/**
 * Merges templates/ + content/ into src/ for Eleventy (replaces b4d prebuilt step).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const TEMPLATES_DIR = path.join(ROOT, "templates");
const CONTENT_DIR = path.join(ROOT, "content");
const SRC_DIR = path.join(ROOT, "src");
const LANGUAGES_PATH = path.join(CONTENT_DIR, "languages.json");

const LANG_EXT_RE = /.+\.([a-z]{2})\.[^.]+$/i;

function normalizePath(p) {
  return p.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyFile(src, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(from, to);
    } else {
      copyFile(from, to);
    }
  }
}

function loadLanguages() {
  if (!fs.existsSync(LANGUAGES_PATH)) {
    throw new Error(`languages.json not found: ${LANGUAGES_PATH}`);
  }
  const languages = JSON.parse(fs.readFileSync(LANGUAGES_PATH, "utf8"));
  if (!languages.length) {
    throw new Error("languages.json must contain at least one language");
  }
  const defaultLanguageCode = languages[0].code;
  const availableLanguages = languages.map((l) => l.code);
  const intlData = Object.fromEntries(languages.map((l) => [l.code, l]));
  return { languages, defaultLanguageCode, availableLanguages, intlData };
}

function getOutPathByLang(lang, defaultLanguageCode) {
  if (lang === defaultLanguageCode) {
    return SRC_DIR;
  }
  return path.join(SRC_DIR, lang);
}

function walkFiles(dir, files = []) {
  if (!fs.existsSync(dir)) return files;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function contentFileToRecord(filePath, defaultLanguageCode) {
  const relative = path.relative(CONTENT_DIR, filePath);
  if (relative === "languages.json") {
    return null;
  }

  const match = LANG_EXT_RE.exec(filePath);
  let languageCode = defaultLanguageCode;
  let targetRelative = relative;

  if (match) {
    languageCode = match[1];
    targetRelative = relative.replace(`.${languageCode}`, "");
  }

  const targetPath = path.join(getOutPathByLang(languageCode, defaultLanguageCode), targetRelative);
  return { filePath, targetPath, languageCode };
}

function writeIntlFiles(intlData, defaultLanguageCode) {
  const defaultOut = getOutPathByLang(defaultLanguageCode, defaultLanguageCode);
  const defaultIntlPath = path.join(defaultOut, "data", "intl.json");
  fs.mkdirSync(path.dirname(defaultIntlPath), { recursive: true });
  fs.writeFileSync(defaultIntlPath, JSON.stringify(intlData[defaultLanguageCode], null, 2));

  for (const [langCode, data] of Object.entries(intlData)) {
    if (langCode === defaultLanguageCode) continue;
    const langOut = getOutPathByLang(langCode, defaultLanguageCode);
    const langIntlPath = path.join(langOut, `${langCode}.json`);
    fs.mkdirSync(path.dirname(langIntlPath), { recursive: true });
    fs.writeFileSync(langIntlPath, JSON.stringify({ intl: data }, null, 2));
  }
}

function sync() {
  const { defaultLanguageCode, availableLanguages, intlData } = loadLanguages();

  rmDir(SRC_DIR);
  copyDir(TEMPLATES_DIR, SRC_DIR);

  const filesByLanguage = {};
  for (const filePath of walkFiles(CONTENT_DIR)) {
    const record = contentFileToRecord(filePath, defaultLanguageCode);
    if (!record) continue;
    if (!availableLanguages.includes(record.languageCode)) {
      console.warn(
        `skip ${filePath}: language "${record.languageCode}" is not in languages.json`
      );
      continue;
    }
    if (!filesByLanguage[record.languageCode]) {
      filesByLanguage[record.languageCode] = [];
    }
    filesByLanguage[record.languageCode].push(record);
  }

  for (const records of Object.values(filesByLanguage)) {
    for (const { filePath, targetPath } of records) {
      copyFile(filePath, targetPath);
    }
  }

  writeIntlFiles(intlData, defaultLanguageCode);

  console.log(`sync: ${normalizePath(SRC_DIR)} ready (${Object.values(filesByLanguage).flat().length} content files)`);
}

sync();
