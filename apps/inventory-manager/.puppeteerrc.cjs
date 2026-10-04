// Keeps Puppeteer's downloaded Chrome inside the project folder instead of
// ~/.cache. Render only ships the project directory from the build step to
// the running service, so without this, PDF export fails with
// "Could not find Chrome" in production.
const { join } = require('path');

/** @type {import("puppeteer").Configuration} */
module.exports = {
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
};
