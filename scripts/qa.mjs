import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "data/menu.js"), "utf8"), { window });
vm.runInNewContext(fs.readFileSync(path.join(root, "data/sales.js"), "utf8"), { window });

const menu = window.MENU;
const sales = window.SALES;
const failures = [];
const warnings = [];
const pass = (condition, message) => { if (!condition) failures.push(message); };

const items = menu.sections.flatMap(section =>
  (section.cats || []).flatMap(cat => (cat.items || []).map(item => ({ ...item, section: section.id })))
);
const names = new Set(items.map(item => item.n));
const keys = new Set(items.map(item => item.k));

pass(menu.sections.length === 8, `عدد الأقسام المعتمدة المتوقع 8، الموجود ${menu.sections.length}`);
pass(items.length === 32, `عدد الأصناف المعتمدة المتوقع 32، الموجود ${items.length}`);
pass(names.size === items.length, "يوجد اسم صنف مكرر");
pass(keys.size === items.length, "يوجد مفتاح صورة مكرر");

items.forEach(item => {
  const prices = item.s || [item.p];
  pass(prices.some(p => Number.isFinite(p) && p >= 0), `سعر غير صالح: ${item.n}`);
  pass(typeof item.n === "string" && item.n.trim().length > 0, "صنف بلا اسم");
});

const referenced = [
  ...(sales.badges.hot || []), ...(sales.badges.chef || []), ...(sales.badges.profit || []),
  ...Object.values(sales.pairings || {}).flat(),
  ...(sales.combos || []).flatMap(combo => combo.parts || [])
];
referenced.forEach(name => pass(names.has(name), `مرجع لصنف غير موجود: ${name}`));

(sales.combos || []).forEach(combo => {
  pass(Number.isFinite(combo.p) && combo.p >= 0, `سعر كومبو غير صالح: ${combo.n}`);
  pass(Number.isFinite(combo.was) && combo.was >= combo.p, `السعر السابق للكومبو غير منطقي: ${combo.n}`);
  pass(typeof combo.img === "string" && combo.img.length > 0, `صورة الكومبو غير محددة: ${combo.n}`);
  const comboImage = combo.img && path.join(root, combo.img);
  pass(comboImage && fs.existsSync(comboImage) && fs.statSync(comboImage).size > 0,
    `صورة الكومبو ناقصة: ${combo.n}`);
});

pass(Array.isArray(sales.order.modes) && sales.order.modes.length === 1 && sales.order.modes[0] === "الطاولة",
  "الموقع يجب أن يقبل الطلب من الطاولة فقط");
pass(Number.isInteger(sales.order.tables) && sales.order.tables > 0, "عدد الطاولات غير صالح");

const atlasNumbers = new Set(items.map(item => Math.floor(item._imageIndex / 6) + 1));
for (const i of atlasNumbers) {
  const file = path.join(root, "assets/img/atlases", `products-${String(i).padStart(2, "0")}.webp`);
  pass(fs.existsSync(file) && fs.statSync(file).size > 0, `ملف صور ناقص: ${path.basename(file)}`);
}

for (const fileName of ["index.html", "owner.html"]) {
  const html = fs.readFileSync(path.join(root, fileName), "utf8");
  pass(html.includes("Content-Security-Policy"), `${fileName}: سياسة أمان المحتوى غير موجودة`);
  pass(!/\son(?:click|change|error|load|input)\s*=/i.test(html), `${fileName}: يوجد معالج حدث مضمّن غير آمن`);
  const unsafeBlank = [...html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)]
    .filter(match => !/rel=["'][^"']*noopener/i.test(match[0]));
  pass(unsafeBlank.length === 0, `${fileName}: رابط خارجي يفتح دون noopener`);
}

const requiredClientIds = ["hero", "nav", "menu", "combos", "bar", "shItem", "shCart", "shRev", "toast"];
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
requiredClientIds.forEach(id => pass(new RegExp(`id=["']${id}["']`).test(indexHtml), `عنصر أساسي ناقص: #${id}`));

if (!/^9665\d{8}$/.test(String(sales.order.whatsapp)) || sales.order.whatsapp === "966500000000") {
  warnings.push("رقم واتساب استقبال الطلبات ما زال تجريبيًا؛ الإرسال معطّل بأمان حتى ضبط الرقم الحقيقي.");
}
warnings.push("لوحة الإدارة محلية على المتصفح ولا تمثل تسجيل دخول أو قاعدة بيانات مشتركة بين الأجهزة.");

console.log(`PASS: ${items.length} صنفًا، ${menu.sections.length} أقسام، ${atlasNumbers.size} ملفات أطلس و${(sales.combos || []).length} صور عروض.`);
warnings.forEach(message => console.warn(`WARN: ${message}`));
if (failures.length) {
  failures.forEach(message => console.error(`FAIL: ${message}`));
  process.exitCode = 1;
} else {
  console.log("PASS: فحوص البيانات والأمان البنيوي نجحت.");
}
