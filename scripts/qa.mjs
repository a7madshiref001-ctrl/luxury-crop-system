import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const window = {};
vm.runInNewContext(fs.readFileSync(path.join(root, "data/menu.js"), "utf8"), { window });
vm.runInNewContext(fs.readFileSync(path.join(root, "data/sales.js"), "utf8"), { window });
vm.runInNewContext(fs.readFileSync(path.join(root, "data/backend-config.js"), "utf8"), { window });

const menu = window.MENU;
const sales = window.SALES;
const site = window.SITE_CONFIG;
const failures = [];
const warnings = [];
const pass = (condition, message) => { if (!condition) failures.push(message); };

const items = menu.sections.flatMap(section =>
  (section.cats || []).flatMap(cat => (cat.items || []).map(item => ({ ...item, section: section.id })))
);
const names = new Set(items.map(item => item.n));
const keys = new Set(items.map(item => item.k));

pass(menu.sections.length === 9, `عدد الأقسام المعتمدة المتوقع 9، الموجود ${menu.sections.length}`);
pass(items.length === 55, `عدد الأصناف المعتمدة المتوقع 55، الموجود ${items.length}`);
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

const atlasNumbers = new Set(items.filter(item => Number.isInteger(item._imageIndex)).map(item => Math.floor(item._imageIndex / 6) + 1));
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

const i18nWindow = { location: { search: "" } };
const i18nDocument = { documentElement: { lang: "", dir: "" } };
vm.runInNewContext(fs.readFileSync(path.join(root, "data/i18n.js"), "utf8"), {
  window: i18nWindow,
  document: i18nDocument,
  localStorage: { getItem: () => null, setItem: () => {} },
  URLSearchParams
});
pass(i18nWindow.LC_I18N.lang === "ar" && i18nDocument.documentElement.dir === "rtl",
  "اللغة الافتراضية للزيارة الأولى يجب أن تكون العربية");

const menuJs = fs.readFileSync(path.join(root, "assets/menu.js"), "utf8");
const backendJs = fs.readFileSync(path.join(root, "assets/backend.js"), "utf8");
const ownerJs = fs.readFileSync(path.join(root, "assets/owner.js"), "utf8");
const ownerLiveJs = fs.readFileSync(path.join(root, "assets/owner-live.js"), "utf8");
const configJs = fs.readFileSync(path.join(root, "data/backend-config.js"), "utf8");
const migration = fs.readFileSync(path.join(root, "supabase/migrations/20260921030000_secure_ordering.sql"), "utf8");
pass(!menuJs.includes("wa.me/") && !menuJs.includes("أرسل الطلب على واتساب"), "مسار طلب واتساب ما زال موجودًا");
pass(menuJs.includes("Backend.placeOrder"), "واجهة العميل لا تستخدم مسار الطلب الآمن");
pass(backendJs.includes('.rpc("place_order"'), "الطلب لا يمر عبر دالة الخادم المحمية");
pass(!/service[_-]?role/i.test(configJs), "ملف الواجهة يذكر مفتاح service role المحظور");
pass(migration.includes("enable row level security"), "RLS غير مفعّل في مخطط قاعدة البيانات");
pass(migration.includes("security definer") && migration.includes("set search_path = ''"), "دالة الطلب المحمية لا تثبّت search_path");
pass(migration.includes("rate_limited") && migration.includes("idempotency_key"), "الحماية من التكرار أو الإغراق غير مكتملة");
pass(migration.includes("revoke all on public.admin_users"), "صلاحيات الجداول لم تُسحب افتراضيًا");
pass(site && site.menuUrl === "https://www.luxurycrop.site/", "رابط المنيو النهائي غير مضبوط في SITE_CONFIG");
pass(site && site.adminUrl === "https://www.luxurycrop.site/owner", "رابط لوحة الإدارة النهائي غير مضبوط");
pass(indexHtml.includes('rel="canonical" href="https://www.luxurycrop.site/"'), "الرابط canonical النهائي ناقص من المنيو");
pass(!/<a\b/i.test(indexHtml), "يوجد رابط قابل للنقر في واجهة المنيو غير الرابط النهائي");
const runtimeText = [indexHtml, fs.readFileSync(path.join(root, "owner.html"), "utf8"), menuJs, ownerJs, ownerLiveJs, fs.readFileSync(path.join(root, "data/menu.js"), "utf8"), fs.readFileSync(path.join(root, "data/sales.js"), "utf8")].join("\n");
for (const forbidden of ["api.qrserver.com", "wa.me/", "instagram.com/", "maps.app.goo.gl/"]) {
  pass(!runtimeText.includes(forbidden), `رابط خارجي غير معتمد ما زال موجودًا: ${forbidden}`);
}
pass(ownerJs.includes("LuxuryQR.finalMenuUrl") && ownerLiveJs.includes("LuxuryQR.finalMenuUrl"), "مولدات الروابط والـQR لا تستخدم الرابط النهائي الموحد");
pass(fs.existsSync(path.join(root, "assets/vendor/qrcode-generator-1.4.4.js")) && fs.existsSync(path.join(root, "assets/qr.js")), "مولد QR المحلي ناقص");
pass(ownerLiveJs.includes("maxFailedAttempts: 5") && ownerLiveJs.includes("LOGIN_GUARD_KEY"), "قفل محاولات دخول الإدارة غير مفعل");
pass(ownerLiveJs.includes("value.length < 12") && backendJs.includes("value.length < 12"), "سياسة كلمة مرور الإدارة القوية غير مطبقة في الواجهة والخلفية");
if (!/url:\s*"https:\/\//.test(configJs)) warnings.push("البرمجة جاهزة لكن بيانات ربط Supabase لم توضع بعد؛ الطلبات ستظل مغلقة بأمان.");

console.log(`PASS: ${items.length} صنفًا، ${menu.sections.length} أقسام، ${atlasNumbers.size} ملفات أطلس و${(sales.combos || []).length} صور عروض.`);
warnings.forEach(message => console.warn(`WARN: ${message}`));
if (failures.length) {
  failures.forEach(message => console.error(`FAIL: ${message}`));
  process.exitCode = 1;
} else {
  console.log("PASS: فحوص البيانات والأمان البنيوي نجحت.");
}
