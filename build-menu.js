/* The original scraper described 50 items and would overwrite the current 64-item catalog.
   Edit from /owner.html or update data/menu.json intentionally instead. */
console.error(
  "Legacy catalog generator retired. Use the owner dashboard; assets: node scripts/prepare.js",
);
process.exitCode = 1;
