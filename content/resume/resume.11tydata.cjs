const fs = require("fs");
const path = require("path");

const aboutPath = path.join(__dirname, "about.json");
const resumePath = path.join(__dirname, "resume.json");
const about = JSON.parse(fs.readFileSync(aboutPath, "utf8"));
const resume = JSON.parse(fs.readFileSync(resumePath, "utf8"));

const pdfPillLabels = {
  "Миграция .NET Framework -> .NET Core": ".NET FX → Core",
  "Migration .NET Framework -> .NET Core": ".NET FX → Core",
  "Embedded Systems (Raspberry Pi, ТСД)": "Embedded (RPi, ТСД)",
  "Embedded Systems (Raspberry Pi, PDT)": "Embedded (RPi, PDT)",
  "Garmin Watch (Monkey C)": "Garmin (Monkey C)",
};

const stackPills = [...resume.skills]
  .sort((a, b) => a.index - b.index)
  .flatMap((group) => group.data.map((item) => pdfPillLabels[item] || item));

module.exports = {
  ...about,
  stackPills,
  resumePdfUrl: about.resumePdfUrl || "/resume/resume_pakholkov_ru.pdf",
  resumePdfLabel: about.resumePdfLabel || "Скачать PDF",
  resumePdfFilename: about.resumePdfFilename || "ipakholkov_resume_ru.pdf",
};
