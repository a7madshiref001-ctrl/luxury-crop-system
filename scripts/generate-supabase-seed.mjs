import fs from "node:fs";
import vm from "node:vm";

const box = { window: {} };
vm.createContext(box);
vm.runInContext(fs.readFileSync("data/menu.js", "utf8"), box);
vm.runInContext(fs.readFileSync("data/sales.js", "utf8"), box);

const menu = box.window.MENU;
const sales = box.window.SALES;
const q = (v) => `'${String(v ?? "").replaceAll("'", "''")}'`;
const json = (v) => `${q(JSON.stringify(v))}::jsonb`;
const products = [];

for (const section of menu.sections || []) {
  for (const cat of section.cats || []) {
    for (const item of cat.items || []) {
      const sizes = Array.isArray(item.s) ? item.s.map(Number) : null;
      products.push({
        id: item.k,
        name: item.n,
        description: item.d || "",
        section: section.id,
        price: sizes ? (sizes.find(Number.isFinite) || 0) : Number(item.p || 0),
        sizes
      });
    }
  }
}

const addonRows = [];
for (const [section, list] of Object.entries(sales.addons || {})) {
  list.forEach((addon, index) => addonRows.push({
    id: `addon_${section.replace(/[^a-z0-9_-]/gi, "_").toLowerCase()}_${index}`,
    section,
    name: addon.n,
    price: Number(addon.p),
    order: index
  }));
}

let out = `-- Generated from data/menu.js and data/sales.js. Safe to run more than once.\n\n`;
for (const [i, p] of products.entries()) {
  out += `insert into public.products (id,name,description,section_id,price,size_prices,is_active,sold_out,sort_order) values (${q(p.id)},${q(p.name)},${q(p.description)},${q(p.section)},${p.price},${p.sizes ? json(p.sizes) : "null"},true,false,${i}) on conflict (id) do update set name=excluded.name,description=excluded.description,section_id=excluded.section_id,price=excluded.price,size_prices=excluded.size_prices,sort_order=excluded.sort_order;\n`;
}
out += "\n";
for (const [i, offer] of (sales.combos || []).entries()) {
  out += `insert into public.offers (id,name,description,image_url,price,original_price,parts,is_active,sort_order) values (${q(offer.id)},${q(offer.n)},${q(offer.d || "")},${q(offer.img || "")},${Number(offer.p)},${Number(offer.was)},${json(offer.parts || [])},true,${i}) on conflict (id) do update set name=excluded.name,description=excluded.description,image_url=excluded.image_url,price=excluded.price,original_price=excluded.original_price,parts=excluded.parts,sort_order=excluded.sort_order;\n`;
}
out += "\n";
for (const a of addonRows) {
  out += `insert into public.addons (id,section_id,name,price,is_active,sort_order) values (${q(a.id)},${q(a.section)},${q(a.name)},${a.price},true,${a.order}) on conflict (id) do update set section_id=excluded.section_id,name=excluded.name,price=excluded.price,sort_order=excluded.sort_order;\n`;
}
out += `\ninsert into public.store_settings (id,tables_count,ordering_open) values (1,${Number(sales.order.tables) || 10},true) on conflict (id) do update set tables_count=excluded.tables_count;\n`;

fs.mkdirSync("supabase", { recursive: true });
fs.writeFileSync("supabase/seed.sql", out);
console.log(`Generated ${products.length} products, ${(sales.combos || []).length} offers and ${addonRows.length} add-ons.`);
