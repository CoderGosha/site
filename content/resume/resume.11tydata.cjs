const fs = require("fs");
const path = require("path");

const aboutPath = path.join(__dirname, "about.json");
const about = JSON.parse(fs.readFileSync(aboutPath, "utf8"));

module.exports = {
  ...about,
  resumePdfUrl: about.resumePdfUrl || "/resume/resume_pakholkov_ru.pdf",
  resumePdfLabel: about.resumePdfLabel || "Скачать PDF",
  resumePdfFilename: about.resumePdfFilename || "ipakholkov_resume_ru.pdf",
};
