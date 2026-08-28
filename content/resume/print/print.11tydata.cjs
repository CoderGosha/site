// The print page exists only as the source for the PDF: it is built on demand by
// scripts/generate-resume-pdf.mjs and stays out of the published site otherwise.
module.exports = {
  permalink: process.env.BUILD_RESUME_PRINT ? "/resume/print/index.html" : false,
};
