const fs = require("node:fs");
const path = require("node:path");
const out = path.resolve("dist-pages");
fs.mkdirSync(out, { recursive: true });
for (const file of [
  "index.html",
  "owner.html",
  "admin.html",
  "js/menu.js",
  "js/admin.js",
  "js/shared.js",
  "css/system.css",
  "css/menu.css",
  "css/admin.css",
  "data/menu.json",
]) {
  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(file, dest);
}
function assets(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) assets(file);
    else if (
      /\.(webp|png|woff2|svg)$/.test(file) &&
      !/^assets[\\/]products[\\/].*\.png$/.test(file)
    ) {
      const dest = path.join(out, file);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(file, dest);
    }
  }
}
assets("assets");
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(
  "Public static files exported to dist-pages; private runtime and server files excluded.",
);
