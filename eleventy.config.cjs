const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const markdownItAnchor = require("markdown-it-anchor");

const ROOT = __dirname;
const INPUT_DIR = path.join(ROOT, "src");
const OUTPUT_DIR = path.join(ROOT, "dist");
const LANGUAGES_PATH = path.join(ROOT, "content", "languages.json");

function syncContent() {
  execSync("node scripts/sync-content.js", { cwd: ROOT, stdio: "inherit" });
}

function fixPath(p) {
  // Collapse repeated slashes, but leave the "://" after a URL scheme intact.
  return p.replace(/(?<!:)\/{2,}/g, "/");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loadLanguages() {
  const languages = JSON.parse(fs.readFileSync(LANGUAGES_PATH, "utf8"));
  const PATH_PREFIX = process.env.PATH_PREFIX ?? "/";
  const DEFAULT_LANGUAGE_CODE = languages[0].code ?? "en";
  const LANGUAGES = {};

  languages.forEach((language, idx) => {
    LANGUAGES[language.code] = {
      ...language,
      path: fixPath(idx === 0 ? `/${PATH_PREFIX}` : `/${PATH_PREFIX}/${language.code}`),
    };
  });

  return { LANGUAGES, DEFAULT_LANGUAGE_CODE, PATH_PREFIX };
}

module.exports = async function (eleventyConfig) {
  eleventyConfig.setUseGitIgnore(false);

  const { LANGUAGES, DEFAULT_LANGUAGE_CODE, PATH_PREFIX } = loadLanguages();

  function getLanguageCodeByURL(url) {
    const urlPath = fixPath(`/${PATH_PREFIX}/${url}`);
    let matchedLanguageCode = DEFAULT_LANGUAGE_CODE;

    for (let i = 1; i < Object.entries(LANGUAGES).length; i++) {
      if (urlPath.indexOf(Object.entries(LANGUAGES)[i][1].path) > -1) {
        matchedLanguageCode = Object.entries(LANGUAGES)[i][1].code;
        break;
      }
    }

    return matchedLanguageCode;
  }

  function getCanonicalURL(url) {
    const langCode = getLanguageCodeByURL(url);

    if (langCode === DEFAULT_LANGUAGE_CODE) {
      return url;
    }

    return fixPath(url.replace(LANGUAGES[langCode].path, LANGUAGES[DEFAULT_LANGUAGE_CODE].path));
  }

  function getAllLanguagesForURL(url, isAbsolute = false) {
    const urlByLang = {};
    const canonicalURL = getCanonicalURL(url);

    if (isAbsolute) {
      urlByLang[DEFAULT_LANGUAGE_CODE] = fixPath(
        `${LANGUAGES[DEFAULT_LANGUAGE_CODE].base_url}/${canonicalURL}`
      );
    } else {
      urlByLang[DEFAULT_LANGUAGE_CODE] = canonicalURL;
    }

    const relativeURL = canonicalURL.replace(LANGUAGES[DEFAULT_LANGUAGE_CODE].path, "");

    for (const lang in LANGUAGES) {
      if (lang !== DEFAULT_LANGUAGE_CODE) {
        if (isAbsolute) {
          urlByLang[lang] = fixPath(`${LANGUAGES[lang].base_url}/${relativeURL}`);
        } else {
          urlByLang[lang] = fixPath(`${LANGUAGES[lang].path}/${relativeURL}`);
        }
      }
    }

    return urlByLang;
  }

  function getSelfAbsoluteUrl(url) {
    const pageLang = getLanguageCodeByURL(url);
    return getAllLanguagesForURL(url, true)[pageLang];
  }

  eleventyConfig.addPlugin(require("@11ty/eleventy-navigation"));

  eleventyConfig.addTransform("minification", function (content) {
    if (this.outputPath && this.outputPath.endsWith(".html")) {
      return require("html-minifier").minify(content, {
        useShortDoctype: true,
        removeComments: true,
        collapseWhitespace: true,
        minifyJS: true,
      });
    }
    return content;
  });

  // src/ is regenerated on every build; watching it causes an infinite rebuild loop in --serve.
  eleventyConfig.watchIgnores.add("./src/**");
  eleventyConfig.watchIgnores.add("./dist/**");

  eleventyConfig.on("eleventy.before", async () => {
    syncContent();

    await fs.promises.mkdir(path.join(OUTPUT_DIR, "css"), { recursive: true });

    const postcss = require("postcss");
    const postcssPlugins = [
      require("postcss-import"),
      require("tailwindcss/nesting"),
      require("tailwindcss")(path.join(ROOT, "tailwind.config.js")),
      require("autoprefixer"),
    ];

    const mainCss = await fs.promises.readFile(path.join(ROOT, "templates", "css", "main.css"));
    const mainResult = await postcss(postcssPlugins).process(mainCss, {
      from: path.join(ROOT, "templates", "css", "main.css"),
      to: path.join(OUTPUT_DIR, "css", "main.min.css"),
    });
    await fs.promises.writeFile(path.join(OUTPUT_DIR, "css", "main.min.css"), mainResult.css);

    const resumePdfCss = await fs.promises.readFile(
      path.join(ROOT, "templates", "css", "resume-pdf.css")
    );
    const resumePdfResult = await postcss([require("autoprefixer")]).process(resumePdfCss, {
      from: path.join(ROOT, "templates", "css", "resume-pdf.css"),
      to: path.join(OUTPUT_DIR, "css", "resume-pdf.min.css"),
    });
    await fs.promises.writeFile(
      path.join(OUTPUT_DIR, "css", "resume-pdf.min.css"),
      resumePdfResult.css
    );
  });

  eleventyConfig.addWatchTarget("./content/");
  eleventyConfig.addWatchTarget("./templates/");
  eleventyConfig.addWatchTarget("./templates/css/");
  eleventyConfig.addWatchTarget("./templates/css/resume-pdf.css");
  eleventyConfig.setWatchThrottleWaitTime(400);

  eleventyConfig.addPassthroughCopy("src/img");
  eleventyConfig.addPassthroughCopy("src/**/*.pdf");
  eleventyConfig.addPassthroughCopy("src/robots.txt");

  eleventyConfig.setServerOptions({
    port: 8080,
    showVersion: false,
    domDiff: false,
  });

  const markdownLibrary = require("markdown-it")({
    html: true,
    breaks: true,
    linkify: true,
  }).use(markdownItAnchor, {
    permalink: markdownItAnchor.permalink.ariaHidden({
      space: true,
      placement: "after",
      class: "no-underline opacity-50 hover:opacity-100",
      symbol: "#",
      level: 1,
    }),
    slugify: eleventyConfig.getFilter("slug"),
  });

  eleventyConfig.setLibrary("md", markdownLibrary);

  eleventyConfig.addFilter("multiLangNav", function (value, url) {
    const pageLanguage = getLanguageCodeByURL(url);
    return value.filter((navRecord) => getLanguageCodeByURL(navRecord.url) === pageLanguage);
  });

  eleventyConfig.addShortcode("intl_switcher", function (pageUrl) {
    const pageLang = getLanguageCodeByURL(pageUrl);
    const urlByLang = getAllLanguagesForURL(pageUrl);
    let output = "";

    for (const lang in urlByLang) {
      if (lang !== pageLang) {
        const url = urlByLang[lang];
        const languageLabel = LANGUAGES[lang].label ?? lang.toUpperCase();
        output += `
          <a class="menu-lang" href="${url}">${languageLabel}</a>
        `;
      }
    }

    return output;
  });

  eleventyConfig.addShortcode("intl_links", function (pageUrl) {
    const pageLang = getLanguageCodeByURL(pageUrl);
    const urlByLang = getAllLanguagesForURL(pageUrl);
    let output = "";

    for (const lang in urlByLang) {
      const url = urlByLang[lang];
      const languageLabel = LANGUAGES[lang].label ?? lang.toUpperCase();
      output += `
          <a href="${url}" class="flex border-t last:border-b items-center w-full justify-center px-4 h-14 hover:text-slate-900 transition underline-offset-4${lang === pageLang ? " underline" : ""}">
            ${languageLabel}
          </a>
        `;
    }

    return output;
  });

  eleventyConfig.addShortcode("hreflang", function (lang_code, url) {
    const pageLang = getLanguageCodeByURL(url);
    const urlByLang = getAllLanguagesForURL(url, true);
    let output = "";

    for (const lang in urlByLang) {
      if (lang !== pageLang) {
        const href = urlByLang[lang];
        const languageLang = LANGUAGES[lang].lang ?? lang;
        output += `
        <link rel="alternate" href="${href}" hrefLang="${languageLang}"/>
        `;
      }
    }
    return output;
  });

  eleventyConfig.addFilter("absoluteUrl", getSelfAbsoluteUrl);

  const OG_LOCALE_BY_LANG = { ru: "ru_RU", en: "en_US" };

  eleventyConfig.addShortcode("socialMeta", function (url, title, description) {
    const pageLang = getLanguageCodeByURL(url);
    const canonicalUrl = getSelfAbsoluteUrl(url);
    const image = fixPath(`${LANGUAGES[DEFAULT_LANGUAGE_CODE].base_url}/img/portrait.jpg`);
    const locale = OG_LOCALE_BY_LANG[pageLang] ?? OG_LOCALE_BY_LANG[DEFAULT_LANGUAGE_CODE];
    const safeTitle = escapeHtml(title);
    const safeDescription = escapeHtml(description);

    return `
        <link rel="canonical" href="${canonicalUrl}">
        <meta property="og:type" content="profile">
        <meta property="og:site_name" content="CoderGosha">
        <meta property="og:locale" content="${locale}">
        <meta property="og:url" content="${canonicalUrl}">
        <meta property="og:title" content="${safeTitle}">
        <meta property="og:description" content="${safeDescription}">
        <meta property="og:image" content="${image}">
        <meta name="twitter:card" content="summary_large_image">
        <meta name="twitter:title" content="${safeTitle}">
        <meta name="twitter:description" content="${safeDescription}">
        <meta name="twitter:image" content="${image}">
        `;
  });

  const PERSON_BY_LANG = {
    ru: { name: "Игорь Пахолков", jobTitle: "Руководитель группы разработки на C#" },
    en: { name: "Igor Pakholkov", jobTitle: "C# development team lead" },
  };

  eleventyConfig.addShortcode("personSchema", function (url) {
    const pageLang = getLanguageCodeByURL(url);
    const person = PERSON_BY_LANG[pageLang] ?? PERSON_BY_LANG[DEFAULT_LANGUAGE_CODE];
    const data = {
      "@context": "https://schema.org",
      "@type": "Person",
      name: person.name,
      alternateName: "CoderGosha",
      jobTitle: person.jobTitle,
      url: LANGUAGES[pageLang].base_url,
      image: fixPath(`${LANGUAGES[DEFAULT_LANGUAGE_CODE].base_url}/img/portrait.jpg`),
      email: "mailto:coder.gosha@gmail.com",
      address: {
        "@type": "PostalAddress",
        addressLocality: "Saint Petersburg",
        addressCountry: "RU",
      },
      sameAs: [
        "https://github.com/CoderGosha",
        "https://www.linkedin.com/in/codergosha/",
        "https://t.me/CoderGosha",
      ],
    };

    return `<script type="application/ld+json">${JSON.stringify(data)}</script>`;
  });

  return {
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk",
    pathPrefix: PATH_PREFIX,
    dir: {
      input: "src",
      includes: "includes",
      data: "data",
      output: "dist",
    },
  };
};
