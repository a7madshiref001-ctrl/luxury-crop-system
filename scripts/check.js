const fs = require("node:fs"),
  path = require("node:path"),
  { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
  m = JSON.parse(fs.readFileSync(path.join(root, "data/menu.json"), "utf8"));
require("../lib/domain").validateMenu(m);
let count = 0,
  size = 0;
for (const c of m.categories)
  for (const i of c.items) {
    const f = path.join(root, i.image);
    if (!fs.existsSync(f)) throw Error("Missing " + i.id);
    count++;
    size += fs.statSync(f).size;
  }
for (const f of [
  "server.js",
  "lib/domain.js",
  "js/menu.js",
  "js/admin.js",
  "js/shared.js",
])
  execFileSync(process.execPath, ["--check", path.join(root, f)], {
    stdio: "inherit",
  });
for (const f of ["js/admin.js", "js/menu.js"])
  if (
    /github_pat_|ghp_|GH_TOKEN|GH_TP/.test(
      fs.readFileSync(path.join(root, f), "utf8"),
    )
  )
    throw Error("Public publishing credential found");
console.log(
  `${count} products / ${m.categories.length} categories; ${(size / 1024 / 1024).toFixed(2)} MB total images. Syntax and asset checks passed.`,
);
