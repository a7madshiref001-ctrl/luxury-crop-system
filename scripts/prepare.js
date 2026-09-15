const fs = require("node:fs"),
  path = require("node:path"),
  sharp = require("sharp");
const root = path.resolve(__dirname, "..");
async function main() {
  const menu = JSON.parse(
    fs.readFileSync(path.join(root, "data/menu.json"), "utf8"),
  );
  const composites = [];
  const all = menu.categories.flatMap((c) => c.items);
  for (const i of all) {
    const src = path.join(root, `assets/products/${i.id}.png`),
      out = path.join(root, i.image);
    if (fs.existsSync(src))
      await sharp(src)
        .resize(720, 720, { fit: "cover" })
        .webp({ quality: 80, effort: 5 })
        .toFile(out);
    if (!fs.existsSync(out)) throw Error("Missing image " + i.id);
    const thumb = await sharp(out)
      .resize(170, 170, { fit: "cover" })
      .png()
      .toBuffer();
    const idx = composites.length;
    composites.push({
      input: thumb,
      left: (idx % 8) * 180,
      top: Math.floor(idx / 8) * 180,
    });
  }
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });
  await sharp({
    create: {
      width: 1440,
      height: Math.ceil(all.length / 8) * 180,
      channels: 3,
      background: "#faf8f3",
    },
  })
    .composite(composites)
    .png()
    .toFile(path.join(root, "docs/products-contact-sheet.png"));
  console.log(`Prepared ${all.length} product photos; catalog untouched.`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
