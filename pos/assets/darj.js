/* DARJ — café POS demo engine
   data · state (localStorage, synced across tabs) · live activity · ZATCA QR · receipts · UI helpers
   كل البيانات هنا وهمية، ومفيش أي طلب بيخرج من المتصفح. */
(function () {
  'use strict';
  const D = (window.DARJ = window.DARJ || {});
  // إعدادات النسخة (DARJ_CONFIG): ديمو عام، أو نسخة حقيقية لعميل (mode: 'live') ومعاها وضع تدريب
  const CFG = window.DARJ_CONFIG || {};
  const vatOnOf = (st) => { const v = st && st.settings ? st.settings.vatOn : undefined; return v === undefined ? CFG.vatOn !== false : v !== false; };
  D.CFG = CFG;
  D.LIVE = CFG.mode === 'live';
  const BASE = CFG.key || 'darj:v1';
  let train = false;
  try { train = D.LIVE && localStorage.getItem(BASE + ':train') === '1'; } catch (e) { /* */ }
  D.TRAIN = train;
  D.REAL = D.LIVE && !train; // بيانات حقيقية: من غير أرقام تجريبية ولا محاكاة
  const KEY = BASE + (D.LIVE ? (train ? ':train' : ':live') : '') + ':state';
  const CART_KEY = BASE + ':cart';
  const LEAD_KEY = BASE + ':leader';
  D.setTraining = (on) => { try { localStorage.setItem(BASE + ':train', on ? '1' : '0'); sessionStorage.removeItem('darj:me'); } catch (e) { /* */ } location.reload(); };
  const TAB = Math.random().toString(36).slice(2, 9);

  /* ---------- store ---------- */
  D.STORE = {
    nameAr: 'هَيل', nameEn: 'HAYL', tagEn: 'Specialty Coffee',
    sellerAr: 'مقهى هيل للقهوة المختصة',
    vat: '399999999900003', cr: '1010999999',
    addr: 'الرياض — حي الياسمين، طريق الملك عبدالعزيز',
    branchAr: 'الفرع الرئيسي', branchEn: 'Main branch',
  };
  Object.assign(D.STORE, CFG.store || {});

  /* ---------- staff & roles ---------- */
  D.ROLES = {
    manager: { ar: 'مدير', en: 'Manager' },
    supervisor: { ar: 'مشرف وردية', en: 'Supervisor' },
    cashier: { ar: 'كاشير', en: 'Cashier' },
    barista: { ar: 'باريستا', en: 'Barista' },
  };
  D.STAFF = [
    { id: 'u1', name: 'نورة العتيبي', short: 'نورة', role: 'manager', pin: '9999', c: '#0E7A55' },
    { id: 'u2', name: 'فيصل الحربي', short: 'فيصل', role: 'supervisor', pin: '2222', c: '#2F5DA8' },
    { id: 'u3', name: 'ريم القحطاني', short: 'ريم', role: 'cashier', pin: '1111', c: '#B8730F' },
    { id: 'u5', name: 'سارة الشهري', short: 'سارة', role: 'cashier', pin: '4444', c: '#8A4FA0' },
    { id: 'u4', name: 'Joseph Cruz', short: 'Joseph', role: 'barista', pin: '3333', c: '#4A443B' },
  ];
  D.DEMO_STAFF = D.STAFF;
  const NOBODY = { id: '', name: '—', short: '—', role: 'cashier', pin: '', c: '#8C8478' };
  D.staff = (id) => D.STAFF.find((s) => s.id === id) || (D.REAL ? NOBODY : D.STAFF[2]) || NOBODY;

  // 1 = مسموح · 'ask' = يحتاج موافقة مشرف/مدير بالـPIN · 0 = ممنوع
  D.PERMS = [
    { id: 'sell', ar: 'البيع واستلام الدفع', cashier: 1, supervisor: 1, manager: 1, barista: 0 },
    { id: 'hold', ar: 'تعليق الفاتورة واسترجاعها', cashier: 1, supervisor: 1, manager: 1, barista: 0 },
    { id: 'disc', ar: 'خصم حتى 10%', cashier: 1, supervisor: 1, manager: 1, barista: 0 },
    { id: 'discBig', ar: 'خصم أكبر من 10%', cashier: 'ask', supervisor: 1, manager: 1, barista: 0 },
    { id: 'void', ar: 'حذف صنف بعد إضافته', cashier: 'ask', supervisor: 1, manager: 1, barista: 0 },
    { id: 'refund', ar: 'مرتجع أو إلغاء فاتورة', cashier: 'ask', supervisor: 1, manager: 1, barista: 0 },
    { id: 'nosale', ar: 'فتح الدرج بدون بيع', cashier: 'ask', supervisor: 1, manager: 1, barista: 0 },
    { id: 'payout', ar: 'مصروف نثري من الدرج', cashier: 'ask', supervisor: 1, manager: 1, barista: 0 },
    { id: 'close', ar: 'قفل الوردية (قفل أعمى)', cashier: 1, supervisor: 1, manager: 1, barista: 0 },
    { id: 'expected', ar: 'رؤية المبلغ المتوقع في الدرج', cashier: 0, supervisor: 0, manager: 1, barista: 0 },
    { id: 'avail', ar: 'إيقاف صنف نفد', cashier: 1, supervisor: 1, manager: 1, barista: 1 },
    { id: 'kds', ar: 'شاشة الباريستا', cashier: 1, supervisor: 1, manager: 1, barista: 1 },
    { id: 'reports', ar: 'التقارير والمبيعات', cashier: 0, supervisor: 1, manager: 1, barista: 0 },
    { id: 'stock', ar: 'المخزون والجرد والاستلام', cashier: 0, supervisor: 1, manager: 1, barista: 0 },
    { id: 'cost', ar: 'رؤية التكلفة وصافي الربح', cashier: 0, supervisor: 0, manager: 1, barista: 0 },
    { id: 'price', ar: 'تعديل الأسعار والمنيو', cashier: 0, supervisor: 0, manager: 1, barista: 0 },
    { id: 'team', ar: 'الموظفين والصلاحيات وسجل الحركات', cashier: 0, supervisor: 0, manager: 1, barista: 0 },
    { id: 'settings', ar: 'الإعدادات والأجهزة', cashier: 0, supervisor: 0, manager: 1, barista: 0 },
  ];
  D.can = (u, perm) => {
    const p = D.PERMS.find((x) => x.id === perm);
    const user = typeof u === 'string' ? D.staff(u) : u;
    return p && user ? p[user.role] : 0;
  };

  /* ---------- menu ---------- */
  D.CATS = [
    { id: 'hot', ar: 'قهوة ساخنة', en: 'Hot coffee', ic: 'cup' },
    { id: 'iced', ar: 'قهوة باردة', en: 'Iced', ic: 'ice' },
    { id: 'brew', ar: 'المقطّرة', en: 'Slow bar', ic: 'drip' },
    { id: 'other', ar: 'مشروبات أخرى', en: 'Not coffee', ic: 'leaf' },
    { id: 'sweet', ar: 'حلا ومخبوزات', en: 'Bakery', ic: 'cake' },
    { id: 'beans', ar: 'بن للبيع', en: 'Beans', ic: 'bag' },
  ];
  const M = { milkDrink: ['size', 'milk', 'extra'], hotBlack: ['size', 'extra'] };
  D.PRODUCTS = [
    { id: 'esp', cat: 'hot', ar: 'إسبريسو', en: 'Espresso', price: 10, pop: 3, mods: ['extra'], r: { beans: 18, cup8: 1 } },
    { id: 'amer', cat: 'hot', ar: 'أمريكانو', en: 'Americano', price: 13, pop: 6, mods: M.hotBlack, r: { beans: 18, cup: 1, lid: 1 } },
    { id: 'cort', cat: 'hot', ar: 'كورتادو', en: 'Cortado', price: 15, pop: 5, mods: ['milk', 'extra'], r: { beans: 18, milk: 60, cup8: 1 } },
    { id: 'flat', cat: 'hot', ar: 'فلات وايت', en: 'Flat White', price: 17, pop: 6, mods: ['milk', 'extra'], r: { beans: 18, milk: 120, cup8: 1, lid: 1 } },
    { id: 'capp', cat: 'hot', ar: 'كابتشينو', en: 'Cappuccino', price: 16, pop: 6, mods: M.milkDrink, r: { beans: 18, milk: 170, cup: 1, lid: 1 } },
    { id: 'latte', cat: 'hot', ar: 'لاتيه', en: 'Latte', price: 17, pop: 7, mods: M.milkDrink, r: { beans: 18, milk: 210, cup: 1, lid: 1 } },
    { id: 'span', cat: 'hot', ar: 'سبانش لاتيه', en: 'Spanish Latte', price: 19, pop: 9, mods: M.milkDrink, r: { beans: 18, milk: 190, cond: 30, cup: 1, lid: 1 } },
    { id: 'mocha', cat: 'hot', ar: 'موكا', en: 'Mocha', price: 19, pop: 3, mods: M.milkDrink, r: { beans: 18, milk: 180, choc: 25, cup: 1, lid: 1 } },
    { id: 'saudi', cat: 'hot', ar: 'قهوة سعودية (دلّة)', en: 'Saudi Coffee pot', price: 28, pop: 3, mods: [], r: { gahwa: 30 } },
    { id: 'ilatte', cat: 'iced', ar: 'آيس لاتيه', en: 'Iced Latte', price: 18, pop: 7, iced: 1, mods: ['size', 'milk', 'extra', 'ice'], r: { beans: 18, milk: 200, icecup: 1, lid: 1 } },
    { id: 'ispan', cat: 'iced', ar: 'آيس سبانش لاتيه', en: 'Iced Spanish Latte', price: 20, pop: 11, iced: 1, mods: ['size', 'milk', 'extra', 'ice'], r: { beans: 18, milk: 190, cond: 30, icecup: 1, lid: 1 } },
    { id: 'iamer', cat: 'iced', ar: 'آيس أمريكانو', en: 'Iced Americano', price: 14, pop: 5, iced: 1, mods: ['size', 'extra', 'ice'], r: { beans: 18, icecup: 1, lid: 1 } },
    { id: 'cold', cat: 'iced', ar: 'كولد برو', en: 'Cold Brew', price: 19, pop: 4, iced: 1, mods: ['ice'], r: { coldbrew: 220, icecup: 1, lid: 1 } },
    { id: 'imocha', cat: 'iced', ar: 'آيس موكا', en: 'Iced Mocha', price: 20, pop: 3, iced: 1, mods: ['size', 'milk', 'extra', 'ice'], r: { beans: 18, milk: 180, choc: 25, icecup: 1, lid: 1 } },
    { id: 'v60', cat: 'brew', ar: 'V60', en: 'V60 Pour-over', price: 22, pop: 6, mods: ['origin', 'temp'], r: { filter: 18, cup: 1, lid: 1 } },
    { id: 'chemex', cat: 'brew', ar: 'كيمكس (لشخصين)', en: 'Chemex for two', price: 36, pop: 1.5, mods: ['origin'], r: { filter: 30 } },
    { id: 'drip', cat: 'brew', ar: 'قهوة اليوم', en: 'Coffee of the day', price: 12, pop: 3, mods: ['temp'], r: { filter: 15, cup: 1, lid: 1 } },
    { id: 'matcha', cat: 'other', ar: 'ماتشا لاتيه', en: 'Matcha Latte', price: 21, pop: 4, mods: ['size', 'milk', 'temp'], r: { matcha: 4, milk: 200, cup: 1, lid: 1 } },
    { id: 'hchoc', cat: 'other', ar: 'هوت شوكلت', en: 'Hot Chocolate', price: 17, pop: 2, mods: ['size', 'milk'], r: { choc: 35, milk: 200, cup: 1, lid: 1 } },
    { id: 'karak', cat: 'other', ar: 'كرك', en: 'Karak', price: 9, pop: 4, mods: ['sugar'], r: { karak: 12, milk: 120, cup8: 1 } },
    { id: 'tea', cat: 'other', ar: 'شاي أحمر', en: 'Black Tea', price: 7, pop: 2, mods: ['sugar'], r: { tea: 1, cup8: 1 } },
    { id: 'lemon', cat: 'other', ar: 'ليمون بالنعناع', en: 'Lemon Mint', price: 16, pop: 3, mods: ['sugar', 'ice'], r: { lemon: 1, icecup: 1, lid: 1 } },
    { id: 'water', cat: 'other', ar: 'مويه', en: 'Water', price: 3, pop: 4, mods: [], r: { water: 1 } },
    { id: 'sanseb', cat: 'sweet', ar: 'سان سباستيان', en: 'San Sebastián', price: 26, pop: 6, mods: [], r: { sanseb: 1 } },
    { id: 'tira', cat: 'sweet', ar: 'تيراميسو', en: 'Tiramisu', price: 24, pop: 3, mods: [], r: { tira: 1 } },
    { id: 'brownie', cat: 'sweet', ar: 'براوني', en: 'Brownie', price: 14, pop: 3, mods: [], r: { brownie: 1 } },
    { id: 'cookie', cat: 'sweet', ar: 'كوكيز', en: 'Cookie', price: 10, pop: 5, mods: [], r: { cookie: 1 } },
    { id: 'crois', cat: 'sweet', ar: 'كرواسون زبدة', en: 'Butter Croissant', price: 12, pop: 4, mods: [], r: { crois: 1 } },
    { id: 'datecake', cat: 'sweet', ar: 'كيكة التمر', en: 'Date Cake', price: 18, pop: 3, mods: [], r: { datecake: 1 } },
    { id: 'beth', cat: 'beans', ar: 'إثيوبيا جوجي 250جم', en: 'Ethiopia Guji 250g', price: 78, pop: .6, mods: [], r: { 'bag-eth': 1 }, code: '6287001200014' },
    { id: 'bcol', cat: 'beans', ar: 'كولومبيا هويلا 250جم', en: 'Colombia Huila 250g', price: 72, pop: .5, mods: [], r: { 'bag-col': 1 }, code: '6287001200021' },
    { id: 'bhouse', cat: 'beans', ar: 'هاوس إسبريسو 1كجم', en: 'House Espresso 1kg', price: 185, pop: .3, mods: [], r: { 'bag-house': 1 }, code: '6287001200038' },
  ];
  // صنف اتضاف في الموقع بعد آخر تحديث لمنيو الكاشير: بيظهر في الطلب باسمه كملاحظة، ومش موجود في شاشة البيع
  D.SITE_ITEM = { id: 'site_item', cat: '_site', ar: 'صنف من الموقع', online: 'صنف من الموقع', en: 'Website item', price: 0, drink: true, station: 'bar', mods: [], r: {}, pop: 0 };
  D.prod = (id) => D.PRODUCTS.find((p) => p.id === id) || (id === 'site_item' ? D.SITE_ITEM : undefined);
  D.isDrink = (p) => (p.drink != null ? !!p.drink : !['sweet', 'beans'].includes(p.cat) && p.id !== 'water');
  D.PIMG = D.PIMG || {}; // id → true لما الصورة تكون موجودة في assets/img/p/ (بيتملى من img.js)
  D.img = (p) => p.img || (D.PIMG[p.id] ? `assets/img/p/${p.id}.jpg` : '');

  D.MODS = {
    size: { ar: 'الحجم', en: 'Size', one: 1, opts: [
      { id: 's', ar: 'صغير', en: 'Small', k: 'S', d: 0 },
      { id: 'm', ar: 'وسط', en: 'Medium', k: 'M', d: 3, def: 1 },
      { id: 'l', ar: 'كبير', en: 'Large', k: 'L', d: 6 }] },
    milk: { ar: 'الحليب', en: 'Milk', one: 1, opts: [
      { id: 'full', ar: 'كامل الدسم', en: 'Whole', d: 0, def: 1 },
      { id: 'oat', ar: 'شوفان', en: 'Oat', d: 4, k: 'OAT' },
      { id: 'almond', ar: 'لوز', en: 'Almond', d: 4, k: 'ALMOND' },
      { id: 'lf', ar: 'خالي اللاكتوز', en: 'Lactose-free', d: 2, k: 'LACTOSE-FREE' },
      { id: 'skim', ar: 'خالي الدسم', en: 'Skim', d: 0, k: 'SKIM' }] },
    extra: { ar: 'إضافات', en: 'Extras', one: 0, opts: [
      { id: 'shot', ar: 'شوت إضافي', en: 'Extra shot', d: 4, k: '+SHOT' },
      { id: 'van', ar: 'فانيلا', en: 'Vanilla', d: 3, k: 'VANILLA' },
      { id: 'car', ar: 'كراميل', en: 'Caramel', d: 3, k: 'CARAMEL' },
      { id: 'haz', ar: 'بندق', en: 'Hazelnut', d: 3, k: 'HAZELNUT' },
      { id: 'decaf', ar: 'منزوع الكافيين', en: 'Decaf', d: 0, k: 'DECAF' },
      { id: 'xhot', ar: 'حار زيادة', en: 'Extra hot', d: 0, k: 'EXTRA HOT' }] },
    sugar: { ar: 'السكر', en: 'Sugar', one: 1, opts: [
      { id: 'none', ar: 'بدون', en: 'No sugar', d: 0, k: 'NO SUGAR' },
      { id: 'light', ar: 'خفيف', en: 'Light', d: 0, k: 'LIGHT SUGAR' },
      { id: 'normal', ar: 'وسط', en: 'Normal', d: 0, def: 1 },
      { id: 'extra', ar: 'زيادة', en: 'Extra', d: 0, k: 'EXTRA SUGAR' }] },
    ice: { ar: 'الثلج', en: 'Ice', one: 1, opts: [
      { id: 'normal', ar: 'عادي', en: 'Regular ice', d: 0, def: 1 },
      { id: 'less', ar: 'خفيف', en: 'Less ice', d: 0, k: 'LESS ICE' },
      { id: 'none', ar: 'بدون ثلج', en: 'No ice', d: 0, k: 'NO ICE' }] },
    temp: { ar: 'التقديم', en: 'Serve', one: 1, opts: [
      { id: 'hot', ar: 'حار', en: 'Hot', d: 0, def: 1 },
      { id: 'iced', ar: 'بارد', en: 'Iced', d: 1, k: 'ICED' }] },
    origin: { ar: 'المحصول', en: 'Origin', one: 1, opts: [
      { id: 'eth', ar: 'إثيوبيا جوجي', en: 'Ethiopia Guji', d: 0, def: 1, k: 'ETHIOPIA' },
      { id: 'col', ar: 'كولومبيا هويلا', en: 'Colombia Huila', d: 0, k: 'COLOMBIA' },
      { id: 'ken', ar: 'كينيا نيري', en: 'Kenya Nyeri', d: 4, k: 'KENYA' }] },
  };
  // منيو العميل الحقيقي (DARJ_MENU) بيحل محل منيو الديمو
  if (window.DARJ_MENU) { const MN = window.DARJ_MENU; D.CATS = MN.cats; D.PRODUCTS = MN.products; Object.assign(D.MODS, MN.mods || {}); D.ALIAS = MN.aliases || {}; }
  D.defMods = (p) => {
    const m = {};
    p.mods.forEach((g) => { const G = D.MODS[g]; m[g] = G.one ? G.opts.find((o) => o.def).id : []; });
    return m;
  };
  const opt = (g, id) => D.MODS[g].opts.find((o) => o.id === id);
  D.modList = (line) => { // [{g, o}] المختار فعلًا
    const out = [];
    Object.entries(line.mods || {}).forEach(([g, v]) => {
      (Array.isArray(v) ? v : [v]).forEach((id) => { const o = opt(g, id); if (o) out.push({ g, o }); });
    });
    return out;
  };
  D.modText = (line, en) => D.modList(line).filter(({ o, g }) => !o.def || g === 'size').map(({ o }) => (en ? o.en : o.ar));

  /* ---------- ingredients & suppliers ---------- */
  D.ING = [
    { id: 'beans', ar: 'بن إسبريسو — هاوس بلند', unit: 'g', cost: .13, start: 9600, par: 3000, buy: 5000, sup: 's1' },
    { id: 'filter', ar: 'بن مختص للتقطير', unit: 'g', cost: .24, start: 2600, par: 1000, buy: 2000, sup: 's1' },
    { id: 'gahwa', ar: 'بن قهوة سعودية بالهيل', unit: 'g', cost: .11, start: 1500, par: 800, buy: 2000, sup: 's1' },
    { id: 'milk', ar: 'حليب طازج كامل الدسم', unit: 'ml', cost: .0065, start: 42000, par: 15000, buy: 30000, sup: 's2', exp: 2 },
    { id: 'oat', ar: 'حليب شوفان', unit: 'ml', cost: .017, start: 6200, par: 4000, buy: 12000, sup: 's2', exp: 40 },
    { id: 'almond', ar: 'حليب لوز', unit: 'ml', cost: .018, start: 5000, par: 3000, buy: 6000, sup: 's2', exp: 35 },
    { id: 'lf', ar: 'حليب خالي اللاكتوز', unit: 'ml', cost: .009, start: 6000, par: 3000, buy: 6000, sup: 's2', exp: 5 },
    { id: 'cond', ar: 'حليب مكثّف محلّى', unit: 'g', cost: .02, start: 5200, par: 2000, buy: 4000, sup: 's4' },
    { id: 'syrup', ar: 'سيروبات (فانيلا · كراميل · بندق)', unit: 'ml', cost: .045, start: 4200, par: 2000, buy: 3000, sup: 's4' },
    { id: 'choc', ar: 'صوص شوكولاتة', unit: 'g', cost: .04, start: 2600, par: 1500, buy: 2000, sup: 's4' },
    { id: 'matcha', ar: 'ماتشا', unit: 'g', cost: .55, start: 330, par: 250, buy: 500, sup: 's4' },
    { id: 'coldbrew', ar: 'مركّز كولد برو', unit: 'ml', cost: .03, start: 6200, par: 4000, buy: 6000, sup: 's1', exp: 3 },
    { id: 'karak', ar: 'خلطة كرك', unit: 'g', cost: .05, start: 1500, par: 800, buy: 1000, sup: 's4' },
    { id: 'tea', ar: 'شاي أحمر (أكياس)', unit: 'pc', cost: .25, start: 180, par: 100, buy: 200, sup: 's4' },
    { id: 'lemon', ar: 'ليمون ونعناع (حصة)', unit: 'pc', cost: 2.2, start: 40, par: 25, buy: 40, sup: 's5', exp: 2 },
    { id: 'water', ar: 'مياه 330مل', unit: 'pc', cost: .7, start: 96, par: 48, buy: 96, sup: 's3' },
    { id: 'cup8', ar: 'أكواب ورقية 8oz', unit: 'pc', cost: .32, start: 260, par: 300, buy: 1000, sup: 's3' },
    { id: 'cup12', ar: 'أكواب ورقية 12oz', unit: 'pc', cost: .38, start: 700, par: 400, buy: 1000, sup: 's3' },
    { id: 'cup16', ar: 'أكواب ورقية 16oz', unit: 'pc', cost: .45, start: 460, par: 300, buy: 1000, sup: 's3' },
    { id: 'icecup', ar: 'أكواب بلاستيك للبارد 16oz', unit: 'pc', cost: .52, start: 820, par: 400, buy: 1000, sup: 's3' },
    { id: 'lid', ar: 'أغطية', unit: 'pc', cost: .1, start: 1700, par: 800, buy: 2000, sup: 's3' },
    { id: 'sanseb', ar: 'سان سباستيان (قطعة)', unit: 'pc', cost: 8.5, start: 16, par: 8, buy: 12, sup: 's5', exp: 2 },
    { id: 'tira', ar: 'تيراميسو (قطعة)', unit: 'pc', cost: 7.5, start: 12, par: 6, buy: 12, sup: 's5', exp: 2 },
    { id: 'brownie', ar: 'براوني (قطعة)', unit: 'pc', cost: 3.8, start: 24, par: 10, buy: 24, sup: 's5', exp: 4 },
    { id: 'cookie', ar: 'كوكيز', unit: 'pc', cost: 2.6, start: 34, par: 15, buy: 30, sup: 's5', exp: 5 },
    { id: 'crois', ar: 'كرواسون زبدة', unit: 'pc', cost: 3.4, start: 14, par: 12, buy: 24, sup: 's5', exp: 1 },
    { id: 'datecake', ar: 'كيكة التمر (قطعة)', unit: 'pc', cost: 4.6, start: 14, par: 6, buy: 12, sup: 's5', exp: 3 },
    { id: 'bag-eth', ar: 'بن معبّى — إثيوبيا 250جم', unit: 'pc', cost: 39, start: 18, par: 10, buy: 20, sup: 's1' },
    { id: 'bag-col', ar: 'بن معبّى — كولومبيا 250جم', unit: 'pc', cost: 35, start: 7, par: 10, buy: 20, sup: 's1' },
    { id: 'bag-house', ar: 'بن معبّى — هاوس 1كجم', unit: 'pc', cost: 98, start: 6, par: 4, buy: 10, sup: 's1' },
  ];
  D.ing = (id) => D.ING.find((i) => i.id === id) || { id, ar: id, unit: 'pc', cost: 0, par: 0 };
  D.UNIT = { g: 'جم', ml: 'مل', pc: 'حبة' };
  D.SUP = [
    { id: 's1', ar: 'المحمصة — مورّد البن', who: 'أبو خالد', due: 3450, terms: 'آجل 30 يوم' },
    { id: 's2', ar: 'مورّد الألبان', who: 'مندوب التوزيع', due: 860, terms: 'كاش عند الاستلام' },
    { id: 's3', ar: 'مورّد التغليف (أكواب وأغطية)', who: 'خدمة العملاء', due: 0, terms: 'تحويل مقدّم' },
    { id: 's4', ar: 'مستلزمات الباريستا والسيروبات', who: 'المندوب', due: 420, terms: 'آجل 15 يوم' },
    { id: 's5', ar: 'المخبز — حلا ومخبوزات يومية', who: 'المخبز', due: 1240, terms: 'أسبوعي' },
  ];
  D.sup = (id) => D.SUP.find((s) => s.id === id) || { id, ar: id || '—', who: '', due: 0, terms: '' };

  D.PAY = {
    cash: { ar: 'كاش', en: 'Cash' },
    mada: { ar: 'مدى', en: 'mada' },
    apple: { ar: 'Apple Pay', en: 'Apple Pay' },
    stc: { ar: 'STC Pay', en: 'STC Pay' },
    online: { ar: 'مدفوع أونلاين', en: 'Paid online' },
    credit: { ar: 'رصيد استبدال', en: 'Exchange credit' },
    exchange: { ar: 'رصيد استبدال', en: 'Exchange credit' },
  };
  D.CH = {
    counter: { ar: 'الكاشير', en: 'Counter', ic: 'register' },
    table: { ar: 'QR الطاولة', en: 'Table QR', ic: 'qr' },
    pickup: { ar: 'استلام من الموقع', en: 'Web pickup', ic: 'bag' },
    kiosk: { ar: 'الكشك', en: 'Kiosk', ic: 'kiosk' },
  };
  D.TYPES = { takeaway: { ar: 'سفري', en: 'Takeaway' }, dinein: { ar: 'محلي', en: 'Dine-in' }, table: { ar: 'طاولة', en: 'Table' } };
  D.who = (o) => (o.ch === 'kiosk' && !o.staff ? { short: 'Kiosk', name: 'الكشك · دفع ذاتي' } : D.staff(o.staff));

  /* ---------- stations: كل صنف بيروح لمكان تحضيره لوحده (الباريستا أو المطبخ) ---------- */
  D.STATIONS = {
    bar: { en: 'Barista', ar: 'الباريستا', ic: 'cup' },
    kitchen: { en: 'Kitchen', ar: 'المطبخ', ic: 'flame' },
  };
  D.ROUTE = {
    bar: { en: 'Barista', ar: 'الباريستا', ic: 'cup' },
    kitchen: { en: 'Kitchen', ar: 'المطبخ', ic: 'flame' },
    both: { en: 'Both', ar: 'الاثنين', ic: 'swap' },
    none: { en: 'No prep', ar: 'بدون تحضير', ic: 'bag' },
  };
  // الافتراضي: المشروبات للباريستا، والأكل للمطبخ، والبن المعبّى والمويه من غير تحضير، والعرض اللي فيه مشروب وأكل للاتنين
  D.defRoute = (p) => p.station || (p.cat === 'beans' || p.id === 'water' ? 'none' : p.offer ? (p.drink ? 'both' : 'kitchen') : D.isDrink(p) ? 'bar' : 'kitchen');
  D.catDefRoute = (cat) => {
    const n = {};
    D.PRODUCTS.filter((p) => p.cat === cat).forEach((p) => { const r = D.defRoute(p); n[r] = (n[r] || 0) + 1; });
    return Object.keys(n).sort((a, b) => n[b] - n[a])[0] || 'bar';
  };
  // صاحب المكان بيغيّرها من الإعدادات: للقسم كله، أو لصنف واحد
  D.routeOf = (st, p) => {
    if (!p) return 'none';
    const R = (st && st.routes) || {};
    return (R.items && R.items[p.id]) || (R.cats && R.cats[p.cat]) || D.defRoute(p);
  };
  D.lineRoute = (st, l) => l.st || D.routeOf(st, D.prod(l.pid));
  D.liveQty = (o, i) => o.lines[i].qty - ((o.voided && o.voided[i]) || 0);
  D.lineIn = (st, l, at) => { const r = D.lineRoute(st, l); return at === 'all' ? r !== 'none' : r === at || (r === 'both' && at !== 'none'); };
  D.stationsOf = (st, o) => {
    const out = [];
    o.lines.forEach((l, i) => {
      if (D.liveQty(o, i) <= 0) return;
      const r = D.lineRoute(st, l);
      (r === 'both' ? ['bar', 'kitchen'] : r === 'none' ? [] : [r]).forEach((x) => { if (!out.includes(x)) out.push(x); });
    });
    return out;
  };
  D.forStation = (st, o, at) => (at === 'all' ? D.stationsOf(st, o).length > 0 : D.stationsOf(st, o).includes(at));
  // مرحلة الطلب عند كل شاشة: new لسه ما اتبدأش · make بيتعمل · ready نصيب الشاشة دي خلص
  D.stStage = (o, at, now) => {
    if (o.status === 'ready' || o.status === 'done') return 'ready';
    if (at === 'all') {
      const sts = D.stationsOf(D.state(), o).map((x) => D.stStage(o, x, now));
      return sts.length && sts.every((x) => x === 'ready') ? 'ready' : sts.some((x) => x !== 'new') ? 'make' : 'new';
    }
    const sp = (o.sp || {})[at] || {};
    if (sp.ready) return 'ready';
    if (sp.start || (o.started && !o.sp) || (o.sim && (now || Date.now()) - (o.tsAcc || o.ts) > 50000)) return 'make';
    return 'new';
  };

  /* ---------- utils ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  D.pad = pad;
  D.esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  D.r2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;
  D.fmt = (n, dec) => Number(n).toLocaleString('en-US', { minimumFractionDigits: dec ?? 2, maximumFractionDigits: dec ?? 2 });
  D.fmt0 = (n) => Number(Math.round(n)).toLocaleString('en-US');
  D.money = (n, dec) => `<span class="m"><span class="num">${D.fmt(n, dec)}</span><span class="cur">ر.س</span></span>`;
  D.invNo = (n) => 'INV-' + (D.LIVE ? String(n).padStart(6, '0') : n);
  D.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  function hash(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  D.rng = (s) => rng(hash(String(s)));
  const wpick = (R, arr, w) => { const tot = arr.reduce((a, x) => a + w(x), 0); let r = R() * tot; for (const x of arr) { r -= w(x); if (r <= 0) return x; } return arr[arr.length - 1]; };
  const chance = (R, p) => R() < p;

  /* ---------- time (Asia/Riyadh, UTC+3, no DST) ---------- */
  const OFF = 180 * 60000;
  D.ksa = (ts) => { const d = new Date((ts ?? Date.now()) + OFF); return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), s: d.getUTCSeconds(), wd: d.getUTCDay() }; };
  D.ksaTs = (y, mo, d, h, mi) => Date.UTC(y, mo, d, h, mi || 0) - OFF;
  D.OPEN_H = 6;
  D.bizStart = (now) => { const k = D.ksa(now); let t = D.ksaTs(k.y, k.mo, k.d, D.OPEN_H); if (k.h < D.OPEN_H) t -= 864e5; return t; };
  D.dayKey = (ts) => { const k = D.ksa(D.bizStart(ts)); return `${k.y}-${pad(k.mo + 1)}-${pad(k.d)}`; };
  D.at = (h, mi, now) => { // ساعة معيّنة في يوم الشغل الحالي (بعد نص الليل = اليوم اللي بعده)
    const k = D.ksa(D.bizStart(now));
    let t = D.ksaTs(k.y, k.mo, k.d, h, mi || 0);
    if (h < D.OPEN_H) t += 864e5;
    return t;
  };
  D.time = (ts, en) => { const k = D.ksa(ts); const h = k.h % 12 || 12; return en ? `${h}:${pad(k.mi)} ${k.h < 12 ? 'AM' : 'PM'}` : `${h}:${pad(k.mi)} ${k.h < 12 ? 'ص' : 'م'}`; };
  D.time24 = (ts) => { const k = D.ksa(ts); return `${pad(k.h)}:${pad(k.mi)}`; };
  const AR_DATE = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { timeZone: 'Asia/Riyadh', weekday: 'long', day: 'numeric', month: 'long' });
  const AR_DATE_S = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long' });
  const HIJRI = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-islamic-umalqura', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric' });
  D.dateAr = (ts) => AR_DATE.format(new Date(ts ?? Date.now()));
  D.dateArS = (ts) => AR_DATE_S.format(new Date(ts ?? Date.now()));
  D.hijri = (ts) => HIJRI.format(new Date(ts ?? Date.now()));
  D.dateNum = (ts) => { const k = D.ksa(ts); return `${k.y}-${pad(k.mo + 1)}-${pad(k.d)}`; };
  D.ago = (ts) => {
    const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
    if (m < 1) return 'الآن';
    if (m < 60) return m === 1 ? 'قبل دقيقة' : m === 2 ? 'قبل دقيقتين' : m <= 10 ? `قبل ${m} دقائق` : `قبل ${m} دقيقة`;
    const h = Math.floor(m / 60);
    return h === 1 ? 'قبل ساعة' : h === 2 ? 'قبل ساعتين' : h <= 10 ? `قبل ${h} ساعات` : `قبل ${h} ساعة`;
  };
  D.mmss = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${pad(s % 60)}`; };

  /* ---------- pricing & recipes ---------- */
  D.priceOf = (S, p) => (S && S.prices && S.prices[p.id] != null ? S.prices[p.id] : p.price);
  D.unitPrice = (S, line) => { if (line.fixed != null) return line.fixed; const p = D.prod(line.pid); return D.priceOf(S, p) + D.modList(line).reduce((a, { o }) => a + (o.d || 0), 0); };
  D.lineGross = (S, line) => D.r2(D.unitPrice(S, line) * line.qty);
  D.lineTotal = (S, line) => D.r2(D.lineGross(S, line) * (1 - (line.disc || 0) / 100));
  D.recipe = (line) => {
    const p = D.prod(line.pid);
    const r = Object.assign({}, p.r);
    const m = line.mods || {};
    const k = { s: .75, m: 1, l: 1.3 }[m.size || 'm'];
    ['milk', 'choc', 'matcha', 'cond'].forEach((x) => { if (r[x]) r[x] *= k; });
    if (r.cup) { const iced = p.iced || m.temp === 'iced'; r[iced ? 'icecup' : ({ s: 'cup8', m: 'cup12', l: 'cup16' }[m.size || 'm'] || 'cup12')] = 1; delete r.cup; }
    if (r.milk && m.milk && m.milk !== 'full' && m.milk !== 'skim') { r[m.milk] = r.milk; delete r.milk; }
    (m.extra || []).forEach((x) => { if (x === 'shot') r.beans = (r.beans || 0) + 9; if (['van', 'car', 'haz'].includes(x)) r.syrup = (r.syrup || 0) + 20; });
    Object.keys(r).forEach((x) => { r[x] *= line.qty; });
    return r;
  };
  D.recipeCost = (r) => Object.entries(r).reduce((a, [id, q]) => a + q * (D.ing(id) ? D.ing(id).cost : 0), 0);
  D.lineCost = (line) => D.r2(D.recipeCost(D.recipe(line)));
  D.calc = (S, lines, disc) => {
    const gross = D.r2(lines.reduce((a, l) => a + D.lineTotal(S, l), 0));
    let dv = 0;
    if (disc) dv = disc.type === 'pct' ? D.r2(gross * disc.v / 100) : Math.min(gross, disc.v);
    const total = D.r2(gross - dv);
    const vat = vatOnOf(S) ? D.r2(total * 15 / 115) : 0;
    const lineDisc = D.r2(lines.reduce((a, l) => a + D.lineGross(S, l) - D.lineTotal(S, l), 0));
    return { gross, disc: dv, lineDisc, total, vat, net: D.r2(total - vat) };
  };

  /* ---------- seeding: يوم شغل كامل لحد دلوقتي ---------- */
  const HOUR_W = { 6: .35, 7: .9, 8: 1.35, 9: 1.15, 10: .8, 11: .6, 12: .5, 13: .5, 14: .6, 15: .9, 16: 1.25, 17: 1.35, 18: 1.15, 19: 1.25, 20: 1.55, 21: 1.75, 22: 1.55, 23: 1.2, 0: .8, 1: .4, 2: .1, 3: .05, 4: .05, 5: .1 };
  D.HOUR_W = HOUR_W;
  const NAMES = ['عبدالله', 'محمد', 'فهد', 'سلطان', 'نايف', 'تركي', 'خالد', 'ريان', 'لمى', 'جود', 'رهف', 'شهد', 'غلا', 'دانة', 'عبدالعزيز', 'بندر', 'مشاعل', 'هيا'];
  const CUSTOMERS = [
    ['عبدالله السبيعي', 41, 'VIP'], ['لمى الدوسري', 33, 'VIP'], ['فهد المطيري', 27, ''], ['جود الزهراني', 22, ''], ['سلطان العنزي', 19, ''],
    ['رهف الغامدي', 16, ''], ['تركي الشمري', 14, ''], ['دانة القرني', 12, ''], ['نايف البقمي', 9, ''], ['شهد العمري', 8, ''],
    ['خالد الرشيدي', 6, ''], ['غلا الحربي', 5, ''], ['ريان المالكي', 4, ''], ['هيا السهلي', 3, ''], ['بندر الجهني', 2, 'جديد'], ['مشاعل الأحمدي', 1, 'جديد'],
  ];

  function genLine(R, S, stock, ch) {
    const pool = D.PRODUCTS.filter((p) => S.avail[p.id] !== false && canMake(stock, { pid: p.id, qty: 1, mods: D.defMods(p) }) && (ch === 'counter' || p.cat !== 'beans'));
    const p = wpick(R, pool, (x) => x.pop);
    const mods = D.defMods(p);
    if (mods.size) mods.size = wpick(R, ['s', 'm', 'l'], (x) => ({ s: 20, m: 55, l: 25 }[x]));
    if (mods.milk) mods.milk = wpick(R, ['full', 'oat', 'almond', 'lf', 'skim'], (x) => ({ full: 72, oat: 12, almond: 6, lf: 7, skim: 3 }[x]));
    if (mods.extra) { if (chance(R, .13)) mods.extra.push('shot'); if (chance(R, .1)) mods.extra.push(wpick(R, ['van', 'car', 'haz'], () => 1)); if (chance(R, .03)) mods.extra.push('decaf'); }
    if (mods.sugar) mods.sugar = wpick(R, ['none', 'light', 'normal', 'extra'], (x) => ({ none: 20, light: 25, normal: 45, extra: 10 }[x]));
    if (mods.ice) mods.ice = wpick(R, ['normal', 'less', 'none'], (x) => ({ normal: 78, less: 17, none: 5 }[x]));
    if (mods.temp) mods.temp = chance(R, p.id === 'drip' ? .2 : .45) ? 'iced' : 'hot';
    if (mods.origin) mods.origin = wpick(R, ['eth', 'col', 'ken'], (x) => ({ eth: 55, col: 30, ken: 15 }[x]));
    const line = { pid: p.id, qty: chance(R, .1) ? 2 : 1, mods };
    if (chance(R, .05)) line.note = wpick(R, ['بدون رغوة', 'الحليب حار جدًا', 'كوب إضافي فاضي', 'في كوب زجاج', 'رجّة خفيفة'], () => 1);
    return line;
  }
  function canMake(stock, line) { const r = D.recipe(line); return Object.entries(r).every(([id, q]) => (stock[id] ?? 0) >= q); }
  D.canMake = (S, line) => canMake(S.stock, line);
  function consume(stock, lines) { lines.forEach((l) => { Object.entries(D.recipe(l)).forEach(([id, q]) => { stock[id] = Math.max(0, D.r2((stock[id] ?? 0) - q)); }); }); }
  function restore(stock, lines) { lines.forEach((l) => { Object.entries(D.recipe(l)).forEach(([id, q]) => { stock[id] = D.r2((stock[id] ?? 0) + q); }); }); }

  function genOrder(R, S, t, opts) {
    const ch = opts.ch || wpick(R, ['counter', 'table', 'pickup', 'kiosk'], (x) => ({ counter: 62, table: 14, pickup: 10, kiosk: 14 }[x]));
    const n = wpick(R, [1, 2, 3, 4], (x) => ({ 1: 52, 2: 32, 3: 12, 4: 4 }[x]));
    const lines = [];
    for (let i = 0; i < n; i++) lines.push(genLine(R, S, S.stock, ch));
    let disc = null;
    if (ch === 'counter' && chance(R, .04)) disc = { type: 'pct', v: 10, reason: wpick(R, ['عميل دائم', 'موظف', 'تعويض تأخير'], () => 1) };
    const c = D.calc(S, lines, disc);
    let pays;
    if (ch === 'kiosk') pays = [{ m: chance(R, .62) ? 'mada' : 'apple', a: c.total }];
    else if (ch !== 'counter') pays = [{ m: 'online', a: c.total }];
    else {
      const m = wpick(R, ['mada', 'apple', 'cash', 'stc', 'split'], (x) => ({ mada: 50, apple: 24, cash: 15, stc: 8, split: 3 }[x]));
      if (m === 'split') { const a = Math.min(c.total, 20); pays = [{ m: 'cash', a }, { m: 'mada', a: D.r2(c.total - a) }]; } else pays = [{ m, a: c.total }];
    }
    const cust = chance(R, ch === 'counter' ? .3 : .55) ? wpick(R, S.customers, (x) => x.visits + 2) : null;
    const reg = opts.reg || 1;
    const o = {
      id: 'o' + D.uid() + Math.floor(R() * 1e3), no: ++S.seq.no, inv: D.invNo(++S.seq.inv), ts: t, day: D.dayKey(t), ch,
      type: ch === 'table' ? 'table' : ch === 'pickup' ? 'takeaway' : (chance(R, .45) ? 'dinein' : 'takeaway'),
      lines: lines.map((l) => Object.assign(l, { unit: D.unitPrice(S, l), total: D.lineTotal(S, l), cost: D.lineCost(l), st: D.routeOf(S, D.prod(l.pid)) })),
      disc, total: c.total, vat: c.vat, net: c.net, pays, staff: ch === 'kiosk' ? null : opts.staff, reg, shift: opts.shift, status: 'done', sim: 1, synced: true, consumed: true,
    };
    if (ch === 'table') o.table = 1 + Math.floor(R() * 14);
    o.name = cust ? cust.name.split(' ')[0] : (ch !== 'counter' || chance(R, .5) ? wpick(R, NAMES, () => 1) : '');
    if (cust) { o.cust = cust.id; earn(S, cust, o); }
    const cashPay = pays.find((p) => p.m === 'cash');
    if (cashPay) { const tend = Math.ceil(cashPay.a / 50) * 50; o.cash = { tendered: tend, change: D.r2(tend - cashPay.a) }; }
    consume(S.stock, o.lines);
    return o;
  }
  function earn(S, cust, o) {
    const cups = o.lines.reduce((a, l) => a + (D.isDrink(D.prod(l.pid)) && !l.reward ? l.qty : 0), 0);
    cust.visits += 1; cust.spend = D.r2(cust.spend + o.total); cust.last = o.ts; cust.fav = o.lines[0].pid;
    cust.stamps += cups;
    o.stamps = cups;
    while (cust.stamps >= S.settings.loyalNeed) { cust.stamps -= S.settings.loyalNeed; cust.rewards = (cust.rewards || 0) + 1; }
  }

  function seed(now) {
    const day = D.dayKey(now);
    const R = D.rng('darj:' + day);
    const bs = D.bizStart(now);
    const S = {
      v: 1, day, created: now, seq: { inv: 10400 + Math.floor(R() * 90), no: 100, cn: 31, z: 412, po: 88 },
      orders: [], holds: [], shifts: [], payouts: [], log: [], waste: [], receipts: [], counts: [], feed: [], pendingRemote: [],
      prices: {}, avail: {}, stock: {}, settings: { live: true, autoAccept: false, sound: true, offline: false, loyalNeed: 8, lang: 'ar', printer: true, vatOn: CFG.vatOn !== false },
      customers: CUSTOMERS.map(([name, visits, tag], i) => ({
        id: 'c' + (i + 1), name, phone: '05000' + String(10000 + Math.floor(R() * 89999)).slice(0, 5), visits, tag,
        stamps: Math.floor(R() * 7), spend: D.r2(visits * (24 + R() * 18)), last: bs - Math.floor(R() * 9 * 864e5), fav: wpick(R, D.PRODUCTS.filter((p) => D.isDrink(p)), (x) => x.pop).id,
      })),
    };
    D.ING.forEach((i) => { S.stock[i.id] = i.start; });
    // الورديات: كاشير 1 = صباحي 6–2 (فيصل)، ومسائي من 2 (ريم) · كاشير 2 = سارة من 7
    const t14 = D.at(14, 0, now);
    const sh1 = { id: 'sh1', reg: 1, user: 'u2', open: bs, float: 500, close: null };
    const sh2 = now > t14 ? { id: 'sh2', reg: 1, user: 'u3', open: t14 + 4 * 60000, float: 500, close: null } : null;
    const sh3 = { id: 'sh3', reg: 2, user: 'u5', open: D.at(7, 0, now), float: 300, close: null };
    S.shifts.push(sh1); if (sh2) S.shifts.push(sh2); if (now > sh3.open) S.shifts.push(sh3);
    const log = (ts, user, act, txt, appr, sev) => S.log.push({ ts, user, act, txt, appr, sev: sev || 'info' });
    log(bs - 4 * 60000, 'u2', 'login', 'تسجيل دخول — كاشير 1');
    log(bs - 3 * 60000, 'u2', 'shift', 'فتح وردية صباحية بعهدة 500.00 ر.س');
    // الطلبات
    let t = bs + 3 * 60000;
    while (true) {
      const h = D.ksa(t).h;
      const rate = 7.2 * (HOUR_W[h] ?? .5);
      t += (-Math.log(1 - R()) * 60 / rate) * 60000;
      if (t >= now - 20000) break;
      const reg2 = !!sh3 && t > sh3.open && chance(R, D.ksa(t).h >= 16 || D.ksa(t).h < 3 ? .4 : .2);
      const regShift = reg2 ? sh3 : (sh2 && t >= sh2.open ? sh2 : sh1);
      const o = genOrder(R, S, t, { reg: reg2 ? 2 : 1, staff: regShift.user, shift: regShift.id });
      const age = now - t;
      if (age < 9 * 60000) {
        o.status = age < 3.5 * 60000 ? 'prep' : 'ready';
        o.tsAcc = t + 10000;
        if (o.status === 'ready') o.tsReady = t + (3 + R() * .5) * 60000;
      } else { o.tsAcc = t + 10000; o.tsReady = t + (2.5 + R() * 3.5) * 60000; o.tsDone = o.tsReady + (.5 + R() * 2.5) * 60000; }
      S.orders.push(o);
    }
    // تقفيل الصباحي لو عدّى الساعة 2
    if (sh2) {
      const exp = expectedCash(S, sh1);
      sh1.close = t14; sh1.expected = exp; sh1.counted = D.r2(exp - 3.5); sh1.variance = -3.5; sh1.z = 'Z-' + (++S.seq.z); sh1.closedBy = 'u2';
      sh1.note = 'فرق فكّة — مسجّل';
      log(t14 - 2 * 60000, 'u2', 'shift', `إقفال الوردية الصباحية — عجز 3.50 ر.س (${sh1.z})`, null, 'warn');
      log(t14 + 3 * 60000, 'u3', 'login', 'تسجيل دخول — كاشير 1');
      log(t14 + 4 * 60000, 'u3', 'shift', 'فتح وردية مسائية بعهدة 500.00 ر.س');
    }
    // مصروفات من الدرج
    [[9, 20, 'ثلج للمحل', 18, 'u2'], [15, 40, 'أكياس قمامة ومنظفات', 32, 'u3'], [19, 10, 'أجرة مندوب توصيل', 15, 'u3']].forEach(([h, mi, why, a, u]) => {
      const ts = D.at(h, mi, now); if (ts >= now) return;
      const sh = S.shifts.find((s) => s.reg === 1 && s.open <= ts && (!s.close || s.close > ts));
      S.payouts.push({ id: 'PO-' + (++S.seq.po), ts, why, a, user: u, shift: sh && sh.id, appr: u === 'u3' ? 'u2' : null });
      log(ts, u, 'payout', `مصروف من الدرج: ${why} — ${D.fmt(a)} ر.س`, u === 'u3' ? 'u2' : null);
    });
    // حركات حساسة متسجلة
    const evs = [
      [8, 47, 'u2', 'nosale', 'فتح الدرج بدون بيع — السبب: فكّة لعميل', null, 'risk'],
      [10, 15, 'u2', 'avail', 'تغيير حالة صنف: كرواسون زبدة — متاح', null],
      [11, 32, 'u2', 'void', 'حذف صنف من السلة: سبانش لاتيه (وسط) — قبل الدفع', null, 'warn'],
      [13, 5, 'u1', 'price', 'تعديل سعر: آيس سبانش لاتيه من 19.00 إلى 20.00 ر.س', null, 'warn'],
      [16, 22, 'u3', 'disc', 'خصم 15% على الفاتورة — السبب: تعويض تأخير', 'u2', 'warn'],
      [17, 48, 'u3', 'void', 'حذف صنف من السلة: كوكيز ×2', 'u2', 'warn'],
      [20, 31, 'u3', 'nosale', 'فتح الدرج بدون بيع — السبب: تبديل فكّة', 'u2', 'risk'],
    ];
    evs.forEach(([h, mi, u, act, txt, appr, sev]) => { const ts = D.at(h, mi, now); if (ts < now && (u !== 'u3' || sh2)) log(ts, u, act, txt, appr, sev); });
    // الهالك
    [[7, 5, 'milk', 2000, 'حليب منتهي من أمس', 'u2'], [12, 40, 'span', 1, 'مشروب حُضّر بالخطأ (حليب بدل شوفان)', 'u2'], [18, 25, 'crois', 2, 'كرواسون بايت', 'u3']].forEach(([h, mi, id, q, why, u]) => {
      const ts = D.at(h, mi, now); if (ts >= now) return;
      if (!D.prod(id) && !D.ING.some((i) => i.id === id)) return;
      const p = D.prod(id);
      if (p) { const r = D.recipe({ pid: id, qty: q, mods: D.defMods(p) }); consume(S.stock, [{ pid: id, qty: q, mods: D.defMods(p) }]); S.waste.push({ ts, pid: id, q, why, user: u, cost: D.r2(D.recipeCost(r)) }); }
      else { S.stock[id] = Math.max(0, S.stock[id] - q); S.waste.push({ ts, ing: id, q, why, user: u, cost: D.r2(q * D.ing(id).cost) }); }
      log(ts, u, 'waste', `هالك: ${p ? p.ar + ' ×' + q : D.ing(id).ar + ' ' + D.fmt0(q) + ' ' + D.UNIT[D.ing(id).unit]} — ${why}`);
    });
    // مرتجع واحد
    const rf = S.orders.filter((o) => o.ch === 'counter' && o.status === 'done' && o.lines.length > 1)[3];
    if (rf) {
      const l = rf.lines[rf.lines.length - 1];
      const a = l.total;
      const ts = rf.tsDone + 4 * 60000;
      if (ts < now) {
        rf.refunds = [{ cn: 'CN-' + (++S.seq.cn), ts, a, lines: [{ i: rf.lines.length - 1, q: l.qty }], by: rf.staff, appr: 'u2', reason: 'المشروب غير مطابق للطلب', m: rf.pays[0].m }];
        rf.refunded = a;
        log(ts, rf.staff, 'refund', `مرتجع ${rf.refunds[0].cn} على ${rf.inv} — ${D.fmt(a)} ر.س`, rf.staff === 'u2' ? null : 'u2', 'warn');
      }
    }
    S.log.sort((a, b) => a.ts - b.ts);
    // آخر نشاط للجرس
    S.orders.slice(-6).forEach((o) => S.feed.push(feedFor(o)));
    S.cutoff = now;
    return S;
  }

  /* ---------- totals helpers ---------- */
  D.paid = (o, m) => o.pays.filter((p) => !m || p.m === m).reduce((a, p) => a + p.a, 0);
  D.netOf = (o) => D.r2(o.total - (o.refunded || 0));
  function expectedCash(S, sh) {
    let cash = sh.float;
    S.orders.forEach((o) => {
      if (o.shift === sh.id && o.status !== 'rejected') cash -= (o.creditBack || 0) - D.paid(o, 'cash');
      (o.refunds || []).forEach((r) => { if (r.shift === sh.id) cash -= D.refundCash(r); });
    });
    S.payouts.forEach((p) => { if (p.shift === sh.id) cash -= p.a; });
    return D.r2(cash);
  }
  D.expectedCash = expectedCash;
  D.shiftStats = (S, sh) => {
    const os = S.orders.filter((o) => o.shift === sh.id && o.status !== 'rejected');
    const by = { cash: 0, mada: 0, apple: 0, stc: 0, online: 0, credit: 0 };
    os.forEach((o) => o.pays.forEach((p) => { by[p.m] = D.r2(by[p.m] + p.a); }));
    const refunds = os.reduce((a, o) => a + (o.refunded || 0), 0);
    const disc = os.reduce((a, o) => a + D.calc(S, o.lines, o.disc).disc + D.calc(S, o.lines, null).lineDisc, 0);
    const total = os.reduce((a, o) => a + o.total, 0);
    const payouts = S.payouts.filter((p) => p.shift === sh.id).reduce((a, p) => a + p.a, 0);
    return { count: os.length, total: D.r2(total), vat: D.r2(os.reduce((a, o) => a + o.vat, 0)), by, refunds: D.r2(refunds), disc: D.r2(disc), payouts: D.r2(payouts), expected: expectedCash(S, sh) };
  };
  D.openShift = (S, reg) => S.shifts.find((s) => s.reg === (reg || 1) && !s.close);

  /* ---------- state ---------- */
  let S = null;
  const subs = new Set();
  D.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  const emit = (why) => subs.forEach((fn) => { try { fn(why); } catch (e) { console.error(e); } });
  function read() { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  let storageWarned = 0;
  function write(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { // التخزين ممكن يبقى مقفول — الديمو يكمل في الذاكرة، والنسخة الحقيقية لازم تنبّه
      if (D.REAL && D.toast && Date.now() - storageWarned > 60000) { storageWarned = Date.now(); D.toast('تعذّر حفظ البيانات على الجهاز', 'نزّل نسخة احتياطية من الإعدادات وراجع مساحة المتصفح', { warn: 1, ic: 'alert', ms: 9000 }); }
    }
  }
  function emptyLive(now) {
    return { v: 1, live: 1, day: D.dayKey(now), created: now, seq: { inv: 0, no: 0, cn: 0, z: 0, po: 0 },
      orders: [], holds: [], shifts: [], payouts: [], log: [], waste: [], receipts: [], counts: [], feed: [], pendingRemote: [],
      prices: {}, avail: {}, stock: {}, customers: [], staff: [], ingredients: [], recipes: {}, suppliers: [], store: {}, days: [], setup: false,
      settings: { live: false, autoAccept: false, sound: true, offline: false, loyalNeed: CFG.loyalNeed || 8, lang: 'ar', printer: true, vatOn: CFG.vatOn !== false } };
  }
  // في النسخة الحقيقية: الموظفين والمكوّنات والوصفات وبيانات المحل جايين من الحالة نفسها
  function bind() {
    if (!S || !D.REAL) return;
    D.STAFF = S.staff; D.ING = S.ingredients; D.SUP = S.suppliers || (S.suppliers = []);
    D.PRODUCTS.forEach((p) => { p.r = (S.recipes && S.recipes[p.id]) || {}; });
    Object.assign(D.STORE, S.store || {});
  }
  // الأرشيف في IndexedDB — كل يوم شغل بيتقفل ويتحفظ هناك، وملخصه بيفضل للتقارير
  const IDB = 'darj-archive:' + BASE;
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open(IDB, 1); r.onupgradeneeded = () => r.result.createObjectStore('days', { keyPath: 'day' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  D.archive = async (rec) => { const db = await idb(); return new Promise((res, rej) => { const tx = db.transaction('days', 'readwrite'); tx.objectStore('days').put(rec); tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error); }); };
  D.archiveAll = async () => { const db = await idb(); return new Promise((res, rej) => { const q = db.transaction('days').objectStore('days').getAll(); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); };
  D.summarize = (day, orders) => {
    const ok = orders.filter((o) => o.status !== 'rejected' && !o.unpaid);
    const sm = { day, total: 0, vat: 0, orders: ok.length, refunds: 0, cost: 0, by: {}, hours: Array(24).fill(0), items: {} };
    ok.forEach((o) => {
      sm.total += D.netOf(o); sm.vat += o.vat - (o.refunds || []).reduce((x, r) => x + (r.vat || 0), 0); sm.refunds += o.refunded || 0;
      o.pays.forEach((p) => { sm.by[p.m] = D.r2((sm.by[p.m] || 0) + p.a); });
      sm.hours[D.ksa(o.ts).h] = D.r2(sm.hours[D.ksa(o.ts).h] + o.total);
      o.lines.forEach((l) => { const it = sm.items[l.pid] = sm.items[l.pid] || { q: 0, v: 0 }; it.q += l.qty; it.v = D.r2(it.v + l.total); sm.cost += l.cost || 0; });
    });
    ['total', 'vat', 'refunds', 'cost'].forEach((k) => { sm[k] = D.r2(sm[k]); });
    return sm;
  };
  D.today = (st) => { st = st || S; return st.orders.filter((o) => !o.day || o.day === st.day); };
  const KEEP_DAYS = 3; // آخر 3 أيام بتفضل على الجهاز عشان المرتجعات
  function rollover(st, now) {
    const day = D.dayKey(now);
    if (st.day === day) return false;
    const prev = st.day;
    const open = new Set(st.shifts.filter((x) => !x.close).map((x) => x.id));
    const todays = st.orders.filter((o) => (o.day || prev) === prev);
    st.days = (st.days || []).filter((d) => d.day !== prev).concat([D.summarize(prev, todays)]).slice(-400);
    D.archive({ day: prev, orders: todays, shifts: st.shifts.filter((x) => x.close), payouts: st.payouts.filter((p) => !open.has(p.shift)), waste: st.waste, log: st.log, receipts: st.receipts, counts: st.counts }).catch(() => {});
    const recent = Array.from(new Set(st.orders.map((o) => o.day || prev))).sort().slice(-(KEEP_DAYS - 1));
    st.orders = st.orders.filter((o) => recent.includes(o.day || prev) || open.has(o.shift) || ['new', 'prep', 'ready'].includes(o.status) || o.unpaid);
    st.shifts = st.shifts.filter((x) => !x.close);
    st.payouts = st.payouts.filter((p) => open.has(p.shift));
    st.waste = []; st.receipts = []; st.counts = []; st.feed = []; st.log = [];
    st.seq.no = 0; st.day = day;
    return true;
  }
  /* شاشة مربوطة بكاشير على جهاز تاني (link.js بيحط D.SAT = true):
     الحالة جاية من الكاشير، ومفيش محاكاة ولا أرشفة ولا كتابة في التخزين المحلي — والأوامر بتروح للكاشير. */
  D.SAT = false;
  const blankSat = () => ({ v: 1, sat: 1, day: D.dayKey(Date.now()), rev: 0, seq: { no: 0, inv: 0 }, orders: [], holds: [], shifts: [], payouts: [], log: [], waste: [], receipts: [], counts: [], feed: [], pendingRemote: [], customers: [], prices: {}, avail: {}, stock: {}, routes: {}, settings: { sound: true, loyalNeed: CFG.loyalNeed || 8, vatOn: CFG.vatOn !== false }, tally: null });
  D.adopt = (snap, why) => { S = Object.assign(blankSat(), snap); if (snap.store) Object.assign(D.STORE, snap.store); D.TRAIN = !!snap.train; D.REMOTE_REAL = !!snap.real; emit(why || 'remote'); };
  D.load = () => {
    if (D.SAT) { if (!S) S = blankSat(); return S; }
    if (D.REAL) {
      const now = Date.now();
      const st = read();
      S = st && st.v === 1 ? st : emptyLive(now);
      if (rollover(S, now) || !st) write(S);
      bind();
      return S;
    }
    const now = Date.now();
    const s = read();
    if (s && s.v === 1 && s.day === D.dayKey(now)) { S = s; catchUp(); return S; }
    S = seed(now); write(S); return S;
  };
  D.state = () => S || D.load();
  D.vatOn = () => vatOnOf(S);
  D.orderVat = (o) => (o && o.total > 0 ? o.vat > 0 : D.vatOn());
  D.exVat = (p) => (D.vatOn() ? p / 1.15 : p);
  D.noteName = (o) => (D.orderVat(o) ? { ar: 'إشعار دائن', en: 'Credit note' } : { ar: 'إشعار مرتجع', en: 'Refund note' });
  D.mutate = (fn, why) => { if (!S) D.load(); if (D.SAT) { const r = fn(S); S.rev = (S.rev || 0) + 1; emit(why || 'local'); return r; } const fresh = read(); if (fresh && fresh.day === S.day) { S = fresh; bind(); } const r = fn(S); bind(); S.rev = (S.rev || 0) + 1; write(S); emit(why || 'local'); return r; };
  D.installState = (st) => { S = st; write(S); bind(); emit('reset'); };
  D.reset = () => { try { localStorage.removeItem(KEY); localStorage.removeItem(CART_KEY); } catch (e) { /* */ } S = D.REAL ? emptyLive(Date.now()) : seed(Date.now()); write(S); bind(); emit('reset'); };
  window.addEventListener('storage', (e) => {
    if (D.SAT) return;
    if (e.key === KEY && e.newValue) { try { const n = JSON.parse(e.newValue); const same = S && n.rev === S.rev && n.day === S.day; S = n; bind(); if (!same) emit('remote'); } catch (er) { /* */ } }
    if (e.key === CART_KEY) emit('cart');
  });
  // لو الصفحة اتقفلت شوية، نكمّل النشاط اللي فات بطلبات واقعية (من غير ما نزوّد الجرس)
  function catchUp() {
    const now = Date.now();
    const gap = now - (S.cutoff || now);
    if (gap < 90000) { S.cutoff = now; return; }
    const R = D.rng('catch:' + S.cutoff);
    let t = S.cutoff;
    const sh1 = D.openShift(S, 1); const sh3 = D.openShift(S, 2);
    while (sh1) {
      const rate = 7.2 * (HOUR_W[D.ksa(t).h] ?? .5);
      t += (-Math.log(1 - R()) * 60 / rate) * 60000;
      if (t >= now - 20000) break;
      const sh = sh3 && chance(R, .5) ? sh3 : sh1;
      const o = genOrder(R, S, t, { reg: sh.reg, staff: sh.user, shift: sh.id });
      o.tsAcc = t + 10000; o.tsReady = t + 4 * 60000; o.tsDone = t + 6 * 60000;
      if (now - t < 6 * 60000) { o.status = 'ready'; delete o.tsDone; }
      S.orders.push(o);
    }
    progress(now);
    S.cutoff = now;
    write(S);
  }

  /* ---------- activity feed ---------- */
  function feedFor(o) {
    const ch = D.CH[o.ch];
    if (o.ch === 'counter') return { ts: o.ts, ic: 'register', t: `فاتورة ${o.inv} — ${D.fmt(o.total)} ر.س`, s: `كاشير ${o.reg} · ${D.staff(o.staff).short} · ${o.pays.map((p) => D.PAY[p.m].ar).join(' + ')}` };
    return { ts: o.ts, ic: ch.ic, t: `طلب جديد من ${ch.ar}${o.table ? ' ' + o.table : ''} — #${o.no}`, s: `${o.name || 'عميل'} · ${D.fmt(o.total)} ر.س · ${o.unpaid ? 'الدفع عند الكاشير' : o.ch === 'kiosk' ? 'مدفوع على الكشك' : 'مدفوع أونلاين'}` };
  }
  D.kioskCfg = (st) => Object.assign({ on: true, card: true, counter: true }, ((st || S || {}).settings || {}).kiosk || {});
  // الدفع بالبطاقة على الكشك: في التدريب محاكاة، وفي التشغيل الحقيقي بيتفعّل لما يتربط بشركة دفع (DARJ_CONFIG.kiosk.card)
  D.kioskCard = () => { const real = D.SAT ? !!D.REMOTE_REAL : D.REAL; return !real || !!(CFG.kiosk && CFG.kiosk.card); };
  D.feedPush = (item) => { S.feed.push(item); if (S.feed.length > 40) S.feed.splice(0, S.feed.length - 40); };
  D.log = (user, act, txt, appr, sev) => { S.log.push({ ts: Date.now(), user, act, txt, appr: appr || null, sev: sev || 'info' }); };

  /* ---------- order actions ---------- */
  D.placeOrder = (draft) => D.mutate((s) => {
    const sh = D.openShift(s, 1);
    const c = D.calc(s, draft.lines, draft.disc);
    const o = {
      id: 'o' + D.uid(), no: ++s.seq.no, inv: D.invNo(++s.seq.inv), ts: Date.now(), day: s.day, ch: 'counter', type: draft.type, table: draft.table,
      lines: draft.lines.map((l) => ({ pid: l.pid, qty: l.qty, mods: l.mods, note: l.note, disc: l.disc, reward: l.reward ? 1 : undefined, unit: D.unitPrice(s, l), total: D.lineTotal(s, l), cost: D.lineCost(l), st: D.routeOf(s, D.prod(l.pid)) })),
      disc: draft.disc, total: c.total, vat: c.vat, net: c.net, pays: draft.pays, cash: draft.cash, creditBack: draft.creditBack || 0, credit: draft.credit || null, staff: draft.staff, reg: 1, shift: sh ? sh.id : null,
      status: 'prep', tsAcc: Date.now(), synced: !s.settings.offline, name: draft.name || '', consumed: true,
    };
    if (draft.cust) { const cu = s.customers.find((x) => x.id === draft.cust); if (cu) { o.cust = cu.id; o.name = o.name || cu.name.split(' ')[0]; earn(s, cu, o); if (draft.redeem) { cu.rewards = Math.max(0, (cu.rewards || 0) - 1); o.redeemed = 1; } } }
    if (!D.stationsOf(s, o).length) { o.status = 'done'; o.tsReady = o.tsDone = o.ts; }
    consume(s.stock, o.lines);
    s.orders.push(o);
    D.feedPush(feedFor(o));
    if (draft.disc && draft.disc.v) D.log(draft.staff, 'disc', `خصم ${draft.disc.type === 'pct' ? draft.disc.v + '%' : D.fmt(draft.disc.v) + ' ر.س'} على ${o.inv} — السبب: ${draft.disc.reason || '—'}`, draft.discAppr, draft.discAppr ? 'warn' : 'info');
    return o;
  }, 'order');

  D.setStatus = (id, st) => D.mutate((s) => {
    const o = s.orders.find((x) => x.id === id); if (!o) return;
    o.status = st;
    const now = Date.now();
    if (st === 'prep') o.tsAcc = now;
    if (st === 'ready') o.tsReady = now;
    if (st === 'done') { o.tsDone = now; if (!o.tsReady) o.tsReady = now; }
    if (st === 'rejected') { if (o.consumed !== false) restore(s.stock, o.lines); o.tsDone = now; o.cancelled = 1; }
    if (D.hooks.status && o.ext) D.hooks.status(o, st);
    return o;
  }, 'status');

  /* ---------- التحضير: كل شاشة بتحرّك نصيبها من الطلب ----------
     D.act(op, args) هي اللي بتستخدمها الشاشات. على الأجهزة المربوطة (link.js) الأمر بيتبعت للكاشير وهو اللي بينفّذ. */
  const findO = (s, id) => s.orders.find((x) => x.id === id);
  const sts = (s, o, at) => (at === 'all' || !at ? D.stationsOf(s, o) : [at]);
  D.ACT = {
    start: (a) => D.mutate((s) => {
      const o = findO(s, a.id); if (!o || !['prep', 'new'].includes(o.status)) return;
      const now = Date.now(); o.sp = o.sp || {};
      sts(s, o, a.st).forEach((x) => { o.sp[x] = Object.assign({}, o.sp[x]); if (!o.sp[x].start) o.sp[x].start = now; });
      o.started = o.started || now;
    }, 'kds'),
    ready: (a) => D.mutate((s) => {
      const o = findO(s, a.id); if (!o || o.status !== 'prep') return false;
      const now = Date.now(); o.sp = o.sp || {};
      sts(s, o, a.st).forEach((x) => { o.sp[x] = Object.assign({}, o.sp[x]); if (!o.sp[x].start) o.sp[x].start = now; o.sp[x].ready = now; });
      o.started = o.started || now;
      const all = D.stationsOf(s, o).every((x) => o.sp[x] && o.sp[x].ready);
      if (all) { o.status = 'ready'; o.tsReady = now; if (D.hooks.status && o.ext) D.hooks.status(o, 'ready'); }
      return all;
    }, 'kds'),
    back: (a) => D.mutate((s) => { // رجّع نصيب الشاشة لـ«بيتعمل» لو اتضغط جاهز بالغلط
      const o = findO(s, a.id); if (!o || !['prep', 'ready'].includes(o.status)) return;
      o.sp = o.sp || {};
      sts(s, o, a.st).forEach((x) => { if (o.sp[x]) delete o.sp[x].ready; });
      if (o.status === 'ready') { o.status = 'prep'; delete o.tsReady; if (D.hooks.status && o.ext) D.hooks.status(o, 'prep'); }
    }, 'kds'),
    pickup: (a) => D.setStatus(a.id, 'done'),
    line: (a) => D.mutate((s) => { const o = findO(s, a.id); if (!o) return; o.lineDone = (o.lineDone || []).filter((x) => x !== a.i); if (a.done) o.lineDone.push(a.i); }, 'kds'),
    kiosk: (a) => D.kioskOrder(a.draft),
  };
  D.act = (op, a) => (D.ACT[op] ? D.ACT[op](a || {}) : null);

  // طلب من الكشك (الدفع الذاتي): مدفوع بالبطاقة = للتحضير على طول · الدفع عند الكاشير = يستنى التحصيل
  D.kioskOrder = (d) => D.mutate((s) => {
    const dup = d.kid && s.orders.find((o) => o.kid === d.kid); if (dup) return dup;
    const now = Date.now();
    const lines = (d.lines || []).filter((l) => D.prod(l.pid) && l.qty > 0).map((l) => ({ pid: l.pid, qty: Math.min(20, l.qty), mods: l.mods || D.defMods(D.prod(l.pid)), note: l.note || '', unit: D.unitPrice(s, l), total: D.lineTotal(s, l), cost: D.lineCost(l), st: D.routeOf(s, D.prod(l.pid)) }));
    if (!lines.length) return null;
    const c = D.calc(s, lines, null);
    const paid = !!d.pay;
    const sh = D.openShift(s, 1);
    const o = { id: 'o' + D.uid(), kid: d.kid, no: ++s.seq.no, inv: paid ? D.invNo(++s.seq.inv) : null, ts: now, day: s.day, ch: 'kiosk', type: d.type === 'dinein' ? 'dinein' : 'takeaway', lines, disc: null,
      total: c.total, vat: c.vat, net: c.net, pays: paid ? [{ m: d.pay.m || 'mada', a: c.total, auth: d.pay.auth }] : [], unpaid: !paid, payFirst: !paid, staff: null, reg: 1, shift: paid && sh ? sh.id : null,
      status: paid ? 'prep' : 'new', tsAcc: paid ? now : null, synced: true, name: (d.name || '').slice(0, 30), consumed: paid };
    if (paid) { consume(s.stock, lines); if (!D.stationsOf(s, o).length) { o.status = 'done'; o.tsReady = o.tsDone = now; } }
    s.orders.push(o); D.feedPush(feedFor(o));
    D.log(null, 'kiosk', `طلب من الكشك #${o.no} — ${D.fmt(o.total)} ر.س — ${paid ? D.PAY[o.pays[0].m].ar + ' على الكشك' : 'الدفع عند الكاشير'}`);
    return o;
  }, 'kiosk');

  // أرقام كل شاشة النهارده (للهيدر): في الطابور · متوسط التحضير · اتسلّم
  D.kdsStats = (s, at) => {
    if (s.tally && s.tally[at]) return s.tally[at];
    const mine = D.today(s).filter((o) => D.forStation(s, o, at));
    const timed = mine.map((o) => { const sp = (o.sp || {})[at === 'all' ? D.stationsOf(s, o)[0] : at] || {}; const end = sp.ready || o.tsReady; const st0 = o.tsAcc || o.ts; return end && st0 ? end - st0 : 0; }).filter((x) => x > 0);
    return { open: mine.filter((o) => o.status === 'prep' && D.stStage(o, at) !== 'ready').length, avg: timed.length ? timed.reduce((a, x) => a + x, 0) / timed.length : 0, done: mine.filter((o) => o.status === 'done').length };
  };

  /* ---------- refunds: إلغاء كامل · مرتجع جزئي · استبدال ---------- */
  // الكمية اللي لسه ممكن ترجع من كل سطر
  D.refundable = (o) => {
    const done = {};
    (o.refunds || []).forEach((r) => (r.lines || []).forEach(({ i, q }) => { done[i] = (done[i] || 0) + q; }));
    return o.lines.map((l, i) => Math.max(0, l.qty - (done[i] || 0)));
  };
  D.canRefund = (o) => !!o && !['new', 'rejected', 'cancelled'].includes(o.status) && D.refundable(o).some((q) => q > 0);
  // مرحلة الطلب عند الباريستا: queued = لسه ما اتبدأش، فالمكوّنات ترجع للمخزون
  D.stage = (o) => {
    if (o.status === 'prep') return o.started || (o.sim && Date.now() - (o.tsAcc || o.ts) > 50000) ? 'making' : 'queued';
    return o.status;
  };
  // المبلغ بنسبة خصم الفاتورة (نسبة أو مبلغ)، ومقسوم على طرق الدفع الأصلية
  D.refundQuote = (o, pick, how) => {
    const sum = o.lines.reduce((a, l) => a + l.total, 0);
    const k = sum ? o.total / sum : 0;
    let a = 0;
    pick.forEach(({ i, q }) => { const l = o.lines[i]; if (l && q) a += l.total / l.qty * q * k; });
    a = D.r2(Math.min(D.r2(a), D.netOf(o)));
    let parts;
    if (how === 'cash') parts = [{ m: 'cash', a }];
    else if (how === 'exchange') parts = [{ m: 'exchange', a }];
    else {
      const paid = o.pays.reduce((x, p) => x + p.a, 0) || 1;
      parts = o.pays.map((p) => ({ m: p.m === 'credit' ? 'cash' : p.m, a: D.r2(a * p.a / paid) })).filter((p) => p.a > 0);
      const diff = D.r2(a - parts.reduce((x, p) => x + p.a, 0));
      if (parts.length) parts[parts.length - 1].a = D.r2(parts[parts.length - 1].a + diff);
      const merged = {}; parts.forEach((p) => { merged[p.m] = D.r2((merged[p.m] || 0) + p.a); });
      parts = Object.entries(merged).map(([m, v]) => ({ m, a: v }));
    }
    return { a, vat: D.orderVat(o) ? D.r2(a * 15 / 115) : 0, parts };
  };
  D.refundCash = (r) => (r.parts ? r.parts.filter((p) => p.m === 'cash').reduce((a, p) => a + p.a, 0) : r.m === 'cash' ? r.a : 0);
  D.refund = (id, pick, meta) => D.mutate((s) => {
    const o = s.orders.find((x) => x.id === id); if (!o) return null;
    const left = D.refundable(o);
    pick = pick.map(({ i, q }) => ({ i, q: Math.min(q, left[i] || 0) })).filter((p) => p.q > 0);
    if (!pick.length) return null;
    const qt = D.refundQuote(o, pick, meta.how);
    const stage = D.stage(o);
    const now = Date.now();
    const sh = D.openShift(s, 1);
    const r = { cn: 'CN-' + (++s.seq.cn), ts: now, a: qt.a, vat: qt.vat, parts: qt.parts, m: qt.parts.length === 1 ? qt.parts[0].m : 'split', lines: pick, by: meta.by, appr: meta.appr, reason: meta.reason, how: meta.how, shift: sh && sh.id, stage, synced: !s.settings.offline };
    // المخزون: قبل التحضير المكوّنات ترجع، بعده المشروب هالك، والبن المعبّى يرجع للرف
    const back = [], waste = [];
    pick.forEach(({ i, q }) => {
      const l = Object.assign({}, o.lines[i], { qty: q });
      const p = D.prod(l.pid);
      if (stage === 'queued' || (p.cat === 'beans' && meta.restockRetail !== false)) back.push(l); else waste.push(l);
    });
    restore(s.stock, back);
    waste.forEach((l) => { const c = D.r2(D.recipeCost(D.recipe(l))); s.waste.push({ ts: now, pid: l.pid, q: l.qty, why: `مرتجع ${r.cn} — ${meta.reason}`, user: meta.by, cost: c }); });
    r.back = back.length; r.waste = waste.length;
    // الباريستا: السطر اللي رجع كله بيتشطب، ولو الطلب كله رجع بيتلغي
    o.voided = o.voided || {};
    pick.forEach(({ i, q }) => { o.voided[i] = (o.voided[i] || 0) + q; });
    (o.refunds = o.refunds || []).push(r);
    o.refunded = D.r2((o.refunded || 0) + qt.a);
    const all = D.refundable(o).every((x) => x === 0);
    if (all && (o.status === 'prep' || o.status === 'ready')) { o.status = 'cancelled'; o.tsDone = now; if (D.hooks.status && o.ext) D.hooks.status(o, 'cancelled'); }
    if (all) o.cancelled = 1;
    // لو الجزء اللي رجع كان آخر حاجة الطلب مستنيها، الطلب مايفضلش واقف
    if (!all && o.status === 'prep') {
      const rest = D.stationsOf(s, o);
      if (!rest.length) { o.status = 'done'; o.tsReady = o.tsReady || now; o.tsDone = now; }
      else if (rest.every((x) => o.sp && o.sp[x] && o.sp[x].ready)) { o.status = 'ready'; o.tsReady = now; if (D.hooks.status && o.ext) D.hooks.status(o, 'ready'); }
    }
    // الولاء: الأختام بتتشال، والهدية بترجع لو المشروب الهدية رجع
    if (o.cust) {
      const cu = s.customers.find((x) => x.id === o.cust);
      if (cu) {
        let cups = 0;
        pick.forEach(({ i, q }) => { const l = o.lines[i]; if (l.reward) cu.rewards = (cu.rewards || 0) + q; else if (D.isDrink(D.prod(l.pid))) cups += q; });
        let st = cu.stamps - cups;
        while (st < 0 && cu.rewards > 0) { cu.rewards -= 1; st += s.settings.loyalNeed; }
        cu.stamps = Math.max(0, st);
        cu.spend = D.r2(Math.max(0, cu.spend - qt.a));
        r.stamps = cups;
      }
    }
    const what = pick.map(({ i, q }) => `${D.prod(o.lines[i].pid).ar} ×${q}`).join('، ');
    D.log(meta.by, 'refund', `${all ? 'إلغاء طلب كامل' : 'مرتجع جزئي'} ${r.cn} على ${o.inv} (${what}) — ${D.fmt(qt.a)} ر.س ${meta.how === 'exchange' ? 'رصيد استبدال' : qt.parts.map((p) => D.PAY[p.m].ar).join(' + ')} — السبب: ${meta.reason}`, meta.appr, 'warn');
    D.feedPush({ ts: now, ic: 'refund', t: `${all ? 'أُلغي طلب' : 'مرتجع على طلب'} #${o.no} — ${D.fmt(qt.a)} ر.س`, s: `${r.cn} · ${meta.reason}` });
    return r;
  }, 'refund');

  D.hooks = {}; // الربط مع المنيو الأونلاين بيسجّل هنا (connect.js)
  // طلب جاي من المنيو الأونلاين (QR الطاولة) — بيتحصّل عند الكاشير
  D.addOnline = (ext) => D.mutate((s) => {
    if (ext.ext && s.orders.some((o) => o.ext === ext.ext)) return null;
    const lines = ext.lines.map((l) => Object.assign({}, l, { unit: D.unitPrice(s, l), total: D.lineTotal(s, l), cost: D.lineCost(l), st: D.routeOf(s, D.prod(l.pid)) }));
    const c = D.calc(s, lines, null);
    const o = Object.assign({ id: 'o' + D.uid(), no: ++s.seq.no, inv: null, ts: Date.now(), day: s.day, ch: 'table', type: 'table', status: s.settings.autoAccept ? 'prep' : 'new', pays: [], unpaid: true, staff: null, reg: 1, shift: null, synced: true, consumed: false }, ext, { lines, total: c.total, vat: c.vat, net: c.net });
    if (o.status === 'prep') o.tsAcc = Date.now();
    s.orders.push(o); D.feedPush(feedFor(o));
    return o;
  }, 'online');
  // تحصيل طلب أونلاين: الفاتورة بتطلع وقت الدفع
  D.collect = (id, draft) => D.mutate((s) => {
    const o = s.orders.find((x) => x.id === id); if (!o) return null;
    const sh = D.openShift(s, 1);
    Object.assign(o, { pays: draft.pays, cash: draft.cash, unpaid: false, paidAt: Date.now(), staff: draft.staff, shift: sh ? sh.id : o.shift, reg: 1, synced: !s.settings.offline });
    if (!o.inv) o.inv = D.invNo(++s.seq.inv);
    if (o.consumed === false) { consume(s.stock, o.lines); o.consumed = true; }
    // طلب الكشك «الدفع عند الكاشير»: بعد التحصيل بيروح للتحضير على طول
    if (o.payFirst && o.status === 'new') { o.status = D.stationsOf(s, o).length ? 'prep' : 'done'; o.tsAcc = Date.now(); if (o.status === 'done') o.tsReady = o.tsDone = o.tsAcc; }
    D.log(draft.staff, 'collect', `تحصيل طلب #${o.no} (${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''}) — ${D.fmt(o.total)} ر.س`);
    return o;
  }, 'order');

  /* ---------- live simulation (تاب واحد بس بيشغّلها) ---------- */
  function isLeader() {
    let l = null; try { l = JSON.parse(localStorage.getItem(LEAD_KEY) || 'null'); } catch (e) { /* */ }
    const now = Date.now();
    if (!l || l.id === TAB || now - l.ts > 7000) { try { localStorage.setItem(LEAD_KEY, JSON.stringify({ id: TAB, ts: now })); } catch (e) { return true; } return true; }
    return false;
  }
  function progress(now) {
    S.orders.forEach((o) => {
      if (o.status === 'prep' && (o.sim ? now - (o.tsAcc || o.ts) > 3.6 * 60000 : now - (o.tsAcc || o.ts) > 9 * 60000)) { o.status = 'ready'; o.tsReady = now; }
      else if (o.status === 'ready' && now - o.tsReady > (o.sim ? 2.2 : 6) * 60000) { o.status = 'done'; o.tsDone = now; }
    });
  }
  let nextAt = Date.now() + 9000, lastWrite = 0;
  D.tick = () => {
    if (!S || D.SAT || !isLeader()) return;
    const now = Date.now();
    if (D.dayKey(now) !== S.day) { if (D.REAL) { S = read() || S; rollover(S, now); write(S); bind(); emit('day'); } else D.reset(); return; }
    const fresh = read(); if (fresh && fresh.day === S.day) { S = fresh; bind(); }
    const s = S;
    let changed = false;
    const before = s.orders.map((o) => o.status).join();
    if (!D.REAL) progress(now); // في الحقيقي الطلب بيتقفل بإيد الباريستا بس
    if (s.orders.map((o) => o.status).join() !== before) changed = 'tick';
    if (!D.LIVE && s.settings.live && now >= nextAt || D.TRAIN && s.settings.live && now >= nextAt) {
      nextAt = now + 24000 + Math.random() * 20000;
      const R = Math.random;
      const pending = s.orders.filter((o) => o.status === 'new').length;
      const sh1 = D.openShift(s, 1); const sh3 = D.openShift(s, 2);
      const roll = R();
      if (roll < .45 && pending < 3 && sh1 && !s.settings.offline) { // طلبات QR محتاجة نت
        const o = genOrder(R, s, now, { ch: R() < .55 ? 'table' : 'pickup', reg: 1, staff: sh1.user, shift: sh1.id });
        o.sim = 1; o.status = s.settings.autoAccept ? 'prep' : 'new'; o.tsAcc = s.settings.autoAccept ? now : null;
        s.orders.push(o); D.feedPush(feedFor(o)); changed = 'online';
      } else if (roll >= .45 && roll < .85 && sh3) {
        const o = genOrder(R, s, now, { ch: 'counter', reg: 2, staff: sh3.user, shift: sh3.id });
        o.sim = 1; o.status = o.lines.some((l) => D.isDrink(D.prod(l.pid))) ? 'prep' : 'done'; o.tsAcc = now;
        if (s.settings.offline) { o.synced = false; s.pendingRemote.push(o); changed = changed || 'tick'; }
        else { s.orders.push(o); D.feedPush(feedFor(o)); changed = changed || 'reg2'; }
      } else if (roll >= .85 && sh1 && !s.settings.offline && D.kioskCfg(s).on) { // طلب من الكشك مدفوع بالبطاقة
        const o = genOrder(R, s, now, { ch: 'kiosk', reg: 1, staff: null, shift: sh1.id });
        o.sim = 1; o.tsAcc = now; o.status = D.stationsOf(s, o).length ? 'prep' : 'done';
        s.orders.push(o); D.feedPush(feedFor(o)); changed = 'kiosk';
      }
    }
    s.cutoff = now;
    if (changed) { s.rev = (s.rev || 0) + 1; write(s); lastWrite = now; emit(changed); }
    else if (now - lastWrite > 60000) { write(s); lastWrite = now; } // بس عشان catchUp يعرف آخر مرة
  };
  D.goOffline = (on, user) => D.mutate((s) => {
    s.settings.offline = on;
    if (on) D.log(user, 'offline', 'انقطع الاتصال بالإنترنت — البيع مستمر محليًا', null, 'warn');
    else {
      const n = s.orders.filter((o) => !o.synced).length + s.pendingRemote.length;
      s.orders.forEach((o) => { o.synced = true; });
      s.pendingRemote.forEach((o) => { o.synced = true; s.orders.push(o); D.feedPush(feedFor(o)); });
      s.pendingRemote = [];
      s.orders.sort((a, b) => a.ts - b.ts);
      D.log(user, 'sync', `عاد الاتصال — تمت مزامنة ${n} فاتورة مع السحابة`);
      return n;
    }
    return 0;
  }, 'net');

  /* ---------- cart broadcast (لشاشة العميل) ---------- */
  D.pushCart = (c) => { const x = Object.assign({ ts: Date.now() }, c); try { localStorage.setItem(CART_KEY, JSON.stringify(x)); } catch (e) { /* */ } if (D.hooks && D.hooks.cart) D.hooks.cart(x); };
  D.readCart = () => { try { return JSON.parse(localStorage.getItem(CART_KEY) || 'null'); } catch (e) { return null; } };

  /* ---------- ZATCA QR (المرحلة الأولى: TLV → Base64) ---------- */
  D.tlv = (o) => {
    const iso = new Date(o.ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const fields = [[1, D.STORE.sellerAr], [2, D.STORE.vat], [3, iso], [4, D.fmt(o.total).replace(/,/g, '')], [5, D.fmt(o.vat).replace(/,/g, '')]];
    const enc = new TextEncoder();
    const bytes = [];
    fields.forEach(([tag, v]) => { const b = enc.encode(v); bytes.push(tag, b.length, ...b); });
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    return { b64: btoa(bin), fields: fields.map(([tag, v]) => ({ tag, v })) };
  };
  D.qrSVG = (text) => {
    if (typeof window.qrcode !== 'function') return '<div style="width:128px;height:128px;border:1px dashed #999;display:grid;place-items:center;font-size:10px;color:#777">QR</div>';
    const q = window.qrcode(0, 'M'); q.addData(text); q.make();
    return q.createSvgTag({ cellSize: 3, margin: 0, scalable: true });
  };

  /* ---------- receipts ---------- */
  D.receiptHTML = (o, opt) => {
    opt = opt || {};
    const s = D.state();
    const z = D.tlv(o);
    const c = D.calc(s, o.lines, o.disc);
    const vatOn = D.orderVat(o);
    const lines = o.lines.map((l) => {
      const p = D.prod(l.pid);
      const mods = D.modText(l).join(' · ');
      return `<div class="rc-line"><b>${l.qty} × ${D.esc(p.ar)}</b><span class="p">${D.fmt(l.total)}</span><small>${D.esc(p.en)}${mods ? ' — ' + D.esc(mods) : ''}${l.reward ? ' · هدية الولاء' : l.disc ? ` · خصم ${l.disc}%` : ''}</small></div>`;
    }).join('');
    const pays = o.pays.map((p) => `<div class="rc-kv"><span>${D.PAY[p.m].ar}</span><span>${D.fmt(p.a)}</span></div>`).join('');
    const st = o.cust ? s.customers.find((x) => x.id === o.cust) : null;
    return `<div class="receipt${opt.print ? ' print' : ''}">
      <div class="rc-logo rc-c"><b>${D.STORE.nameEn}</b><span>${D.STORE.sellerAr}</span><small>${D.STORE.addr}</small></div>
      ${D.TRAIN ? '<div class="rc-c rc-t">— تدريب · Training —</div>' : ''}
      <div class="rc-c">${vatOn && D.STORE.vat ? `<div>الرقم الضريبي: <span class="mono">${D.STORE.vat}</span></div>` : ''}${D.STORE.cr ? `<div>س.ت: <span class="mono">${D.STORE.cr}</span></div>` : ''}${D.STORE.phone ? `<div>هاتف: <span class="mono">${D.esc(D.STORE.phone)}</span></div>` : ''}</div>
      <hr class="rc-hr"><div class="rc-c rc-t">${vatOn ? 'فاتورة ضريبية مبسطة' : 'إيصال بيع'}<br><span class="mono" style="font-weight:500;font-size:11px">${vatOn ? 'Simplified Tax Invoice' : 'Sales Receipt'}</span></div><hr class="rc-hr">
      <div class="rc-kv"><span>رقم الفاتورة</span><span>${o.inv}</span></div>
      <div class="rc-kv"><span>التاريخ</span><span>${D.dateNum(o.ts)} ${D.time24(o.ts)}</span></div>
      <div class="rc-kv"><span>رقم الطلب</span><span>#${o.no}</span></div>
      <div class="rc-kv"><span>الكاشير</span><span style="font-family:var(--f)">${o.ch === 'kiosk' && !o.staff ? 'الكشك · دفع ذاتي' : `${D.esc(D.staff(o.staff).short)} · كاشير ${o.reg}`}</span></div>
      <div class="rc-kv"><span>نوع الطلب</span><span style="font-family:var(--f)">${o.ch !== 'counter' ? D.CH[o.ch].ar : D.TYPES[o.type].ar}${o.table ? ' ' + o.table : ''}</span></div>
      <hr class="rc-hr">${lines}<hr class="rc-hr">
      ${c.lineDisc ? `<div class="rc-kv"><span>خصم الأصناف</span><span>-${D.fmt(c.lineDisc)}</span></div>` : ''}
      ${c.disc ? `<div class="rc-kv"><span>خصم الفاتورة${o.disc.type === 'pct' ? ' ' + o.disc.v + '%' : ''}</span><span>-${D.fmt(c.disc)}</span></div>` : ''}
      ${vatOn ? `<div class="rc-kv"><span>الإجمالي قبل الضريبة</span><span>${D.fmt(o.net)}</span></div>
      <div class="rc-kv"><span>ضريبة القيمة المضافة 15%</span><span>${D.fmt(o.vat)}</span></div>` : ''}
      <div class="rc-kv rc-tot"><span>${vatOn ? 'الإجمالي شامل الضريبة' : 'الإجمالي'}</span><span>${D.fmt(o.total)}</span></div><div class="rc-c" style="font-size:10px;color:#666">المبالغ بالريال السعودي</div>
      <hr class="rc-hr">${pays}${o.cash ? `<div class="rc-kv"><span>المدفوع كاش</span><span>${D.fmt(o.cash.tendered)}</span></div><div class="rc-kv"><span>الباقي</span><span>${D.fmt(o.cash.change)}</span></div>` : ''}
      ${o.refunds && o.refunds.length ? `<hr class="rc-hr">${o.refunds.map((r) => `<div class="rc-kv"><span>${D.noteName(o).ar} ${r.cn}</span><span>-${D.fmt(r.a)}</span></div>`).join('')}` : ''}
      ${vatOn ? `<div class="rc-qr">${D.qrSVG(z.b64)}<small>امسح للتحقق — هيئة الزكاة والضريبة والجمارك</small></div>` : ''}
      ${st ? `<div class="rc-foot">${D.esc(st.name.split(' ')[0])}، رصيدك ${st.stamps} من ${s.settings.loyalNeed} أختام${st.rewards ? ` · لديك ${st.rewards} مشروب هدية` : ''}</div>` : ''}
      <div class="rc-foot">${D.esc(CFG.thanks || 'شكرًا لزيارتكم')} ${opt.copy ? '· <b>نسخة</b>' : ''}${CFG.poweredBy === false ? '' : '<br>Powered by <b>DARJ</b>'}</div>
    </div>`;
  };
  D.creditHTML = (o, r, opt) => {
    opt = opt || {};
    const s = D.state();
    const iso = new Date(r.ts).toISOString().replace(/\.\d{3}Z$/, 'Z');
    const vatOn = D.orderVat(o);
    const enc = new TextEncoder(); const bytes = [];
    [[1, D.STORE.sellerAr], [2, D.STORE.vat], [3, iso], [4, D.fmt(r.a).replace(/,/g, '')], [5, D.fmt(r.vat || r.a * 15 / 115).replace(/,/g, '')]].forEach(([t, v]) => { const b = enc.encode(v); bytes.push(t, b.length, ...b); });
    let bin = ''; bytes.forEach((b) => { bin += String.fromCharCode(b); });
    const rows = r.lines.map(({ i, q }) => { const l = o.lines[i]; const p = D.prod(l.pid); return `<div class="rc-line"><b>${q} × ${D.esc(p.ar)}</b><span class="p">${D.fmt(l.total / l.qty * q)}</span><small>${D.esc(p.en)}${l.reward ? ' · هدية الولاء' : ''}</small></div>`; }).join('');
    const kv = (a, b) => `<div class="rc-kv"><span>${a}</span><span>${b}</span></div>`;
    return `<div class="receipt${opt.print ? ' print' : ''}">
      <div class="rc-logo rc-c"><b>${D.STORE.nameEn}</b><span>${D.STORE.sellerAr}</span></div>
      ${vatOn && D.STORE.vat ? `<div class="rc-c">الرقم الضريبي: <span class="mono">${D.STORE.vat}</span></div>` : ''}
      <hr class="rc-hr"><div class="rc-c rc-t">${vatOn ? 'إشعار دائن' : 'إشعار مرتجع'}<br><span class="mono" style="font-weight:500;font-size:11px">${vatOn ? 'Credit Note' : 'Refund Note'}</span></div><hr class="rc-hr">
      ${kv('رقم الإشعار', r.cn)}${kv('مرجع الفاتورة', o.inv)}${kv('التاريخ', `${D.dateNum(r.ts)} ${D.time24(r.ts)}`)}${kv('السبب', `<span style="font-family:var(--f)">${D.esc(r.reason)}</span>`)}
      <hr class="rc-hr">${rows}<hr class="rc-hr">
      ${vatOn ? kv('المبلغ قبل الضريبة', D.fmt(r.a - (r.vat || 0))) + kv('ضريبة القيمة المضافة 15%', D.fmt(r.vat || 0)) : ''}
      <div class="rc-kv rc-tot"><span>إجمالي المرتجع</span><span>${D.fmt(r.a)}</span></div>
      <hr class="rc-hr">${(r.parts || [{ m: r.m, a: r.a }]).map((p) => kv(`يُعاد ${p.m === 'exchange' ? 'كرصيد استبدال' : 'عبر ' + D.PAY[p.m].ar}`, D.fmt(p.a))).join('')}
      ${kv('نفّذه', `<span style="font-family:var(--f)">${D.esc(D.staff(r.by).short)}${r.appr ? ' · وافق ' + D.esc(D.staff(r.appr).short) : ''}</span>`)}
      ${vatOn ? `<div class="rc-qr">${D.qrSVG(btoa(bin))}<small>إشعار دائن مرتبط بالفاتورة ${o.inv}</small></div>` : ''}
      ${CFG.poweredBy === false ? '' : '<div class="rc-foot">Powered by <b>DARJ</b></div>'}
    </div>`;
  };
  D.zHTML = (sh, st) => {
    const by = st.by;
    const row = (a, b) => `<div class="rc-kv"><span>${a}</span><span>${b}</span></div>`;
    return `<div class="receipt print">
      <div class="rc-logo rc-c"><b>${D.STORE.nameEn}</b><span>${D.STORE.sellerAr}</span></div>
      <hr class="rc-hr"><div class="rc-c rc-t">${sh.close ? 'تقرير Z — إقفال وردية' : 'تقرير X — منتصف الوردية'}<br><span class="mono" style="font-weight:500;font-size:11px">${sh.z || 'X-' + D.time24(Date.now()).replace(':', '')}</span></div><hr class="rc-hr">
      ${row('الكاشير', `<span style="font-family:var(--f)">${D.esc(D.staff(sh.user).short)} · كاشير ${sh.reg}</span>`)}
      ${row('من', `${D.dateNum(sh.open)} ${D.time24(sh.open)}`)}${row('إلى', sh.close ? `${D.dateNum(sh.close)} ${D.time24(sh.close)}` : 'مفتوحة')}
      <hr class="rc-hr">${row('عدد الفواتير', st.count)}${row('إجمالي المبيعات', D.fmt(st.total))}${D.vatOn() || st.vat ? row('منها ضريبة 15%', D.fmt(st.vat)) : ''}${row('الخصومات', D.fmt(st.disc))}${row('المرتجعات', D.fmt(st.refunds))}
      <hr class="rc-hr">${row('كاش', D.fmt(by.cash))}${row('مدى', D.fmt(by.mada))}${row('Apple Pay', D.fmt(by.apple))}${row('STC Pay', D.fmt(by.stc))}${row('أونلاين', D.fmt(by.online))}
      <hr class="rc-hr">${row('عهدة البداية', D.fmt(sh.float))}${row('مصروفات من الدرج', '-' + D.fmt(st.payouts))}
      ${sh.close ? `${row('المتوقع في الدرج', D.fmt(sh.expected))}${row('المعدود فعلًا', D.fmt(sh.counted))}<div class="rc-kv rc-tot"><span>${sh.variance < 0 ? 'عجز' : sh.variance > 0 ? 'زيادة' : 'مطابق'}</span><span>${D.fmt(Math.abs(sh.variance))}</span></div>` : ''}
      <div class="rc-foot">${sh.close ? 'أُقفلت بقفل أعمى — عدّ الكاشير الدرج دون رؤية المتوقع' : 'تقرير X لا يُصفّر العدادات'}${CFG.poweredBy === false ? '' : '<br>Powered by <b>DARJ</b>'}</div>
    </div>`;
  };

  /* ---------- icons ---------- */
  const P = {
    register: '<rect x="3" y="12" width="18" height="8" rx="2"/><path d="M6 12V6h8v6M9 9h2M17 12V8M7 16h2m4 0h4"/>',
    cup: '<path d="M5 8h12l-1.2 10.2A2 2 0 0 1 13.8 20H8.2a2 2 0 0 1-2-1.8L5 8Z"/><path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H16.5M8 4.5c0-1 1-1 1-2m3 2c0-1 1-1 1-2"/>',
    ice: '<path d="M6 7h12l-1.5 13h-9L6 7Z"/><path d="M5 7h14M13 7l2-4M9 12h2v2H9zM12 15h2v2h-2z"/>',
    drip: '<path d="M5 6h14l-5 7h-4L5 6Z"/><path d="M12 13v2M8 21h8M9 18h6"/>',
    leaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>',
    cake: '<path d="M4 20h16M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6M5 16c2 1.5 4-1.5 7 0s5-1.5 7 0M12 12V8M12 6c-.8-.8-.8-1.8 0-3 .8 1.2.8 2.2 0 3Z"/>',
    bag: '<path d="M6 8h12l-1 12H7L6 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
    kds: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4M7 8h4M7 11h6"/>',
    shift: '<rect x="3" y="10" width="18" height="10" rx="2"/><path d="M9 15h6M5 10V7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    stock: '<path d="M3 8l9-5 9 5v8l-9 5-9-5V8Z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a5 5 0 0 1 3.5 5"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shield: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z"/><path d="M9 12l2 2 4-4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    minus: '<path d="M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4l2-2ZM10 20a2 2 0 0 0 4 0"/>',
    wifi: '<path d="M2 9a15 15 0 0 1 20 0M5 12.5a10 10 0 0 1 14 0M8.5 16a5 5 0 0 1 7 0"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/>',
    wifioff: '<path d="M3 3l18 18M8.5 16a5 5 0 0 1 6.2-.6M5 12.5a10 10 0 0 1 4.2-2.3M2 9a15 15 0 0 1 4.6-2.8M12 4.5a15 15 0 0 1 10 4.5M17.8 12.3a10 10 0 0 1 1.2 .2"/><circle cx="12" cy="19.5" r=".8" fill="currentColor"/>',
    cloud: '<path d="M7 18h10a4 4 0 0 0 .6-7.95A6 6 0 0 0 6.1 9.6 4.2 4.2 0 0 0 7 18Z"/>',
    sync: '<path d="M20 11a8 8 0 0 0-14.3-4.9L4 8M4 4v4h4M4 13a8 8 0 0 0 14.3 4.9L20 16M20 20v-4h-4"/>',
    print: '<path d="M7 9V3h10v6M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2"/><path d="M7 14h10v7H7z"/>',
    drawer: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 12h18M10 16h4M10 8h4"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10h19M6 15h4"/>',
    cash: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.6"/><path d="M6 9.5v5M18 9.5v5"/>',
    phone: '<rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
    qr: '<path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2v2h-2zM18 14h2v2M14 18h2v2M18 18h2v2"/>',
    table: '<path d="M3 9h18M5 9v11M19 9v11M8 9l1-5h6l1 5"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    lock: '<rect x="4.5" y="10.5" width="15" height="10" rx="2"/><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4"/>',
    pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
    percent: '<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
    refund: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    chev: '<path d="M15 18l-6-6 6-6"/>',
    arrow: '<path d="M19 12H5M11 18l-6-6 6-6"/>',
    alert: '<path d="M12 3l9.5 17h-19L12 3Z"/><path d="M12 10v4M12 17h.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    gift: '<rect x="3" y="8" width="18" height="5" rx="1"/><path d="M5 13v8h14v-8M12 8v13M12 8c-1.5-3-5-4-5-1.5S10 8 12 8Zm0 0c1.5-3 5-4 5-1.5S14 8 12 8Z"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M16 9v6"/>',
    eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    eyeoff: '<path d="M3 3l18 18M10.6 5.1A10 10 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-3 3.9M6.6 6.6C3.7 8.4 2 12 2 12s3.5 7 10 7a9.6 9.6 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    send: '<path d="M21 3L10 14M21 3l-7 18-4-7-7-4 18-7Z"/>',
    truck: '<path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6.5" cy="17.5" r="1.8"/><circle cx="17.5" cy="17.5" r="1.8"/>',
    store: '<path d="M3 9l1.5-5h15L21 9M3 9v11h18V9M3 9h18M9 20v-6h6v6"/>',
    logout: '<path d="M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11"/>',
    download: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
    box: '<path d="M3 7h18v13H3zM3 7l2-4h14l2 4M9 11h6"/>',
    star: '<path d="M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9L12 3Z"/>',
    flame: '<path d="M12 21a7 7 0 0 1-7-7c0-4 3-6 4-10 2 2 3 4 3 6 1-1 2-2 2-4 2 2 5 5 5 8a7 7 0 0 1-7 7Z"/>',
    tag: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z"/><circle cx="8" cy="8" r="1.5"/>',
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z"/>',
    volume: '<path d="M4 9v6h4l5 4V5L8 9H4ZM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
    globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="M10 8.6v6.8l5.6-3.4L10 8.6Z" fill="currentColor"/>',
    swap: '<path d="M4 8h14l-3.5-3.5M20 16H6l3.5 3.5"/>',
    kiosk: '<rect x="5" y="2.5" width="14" height="13" rx="2"/><path d="M12 15.5V20M8 21h8M9 7h6M9 10.5h3.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    route: '<circle cx="5" cy="12" r="2.2"/><circle cx="19" cy="5.5" r="2.2"/><circle cx="19" cy="18.5" r="2.2"/><path d="M7.2 12H11c2 0 2.5-6.5 5.8-6.5M11 12c2 0 2.5 6.5 5.8 6.5"/>',
    tv: '<rect x="2.5" y="4" width="19" height="13" rx="2"/><path d="M8 21h8M12 17v4"/>',
  };
  D.icon = (n, cls) => `<svg class="ico${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true">${P[n] || P.cup}</svg>`;
  D.mark = (size) => `<svg class="brand__mark" ${size ? `style="width:${size}px;height:${size}px"` : ''} viewBox="0 0 32 32" aria-hidden="true"><rect x="9.5" y="1.5" width="13" height="9" rx="1.5" fill="#fff" stroke="#15130F" stroke-width="1.6"/><path d="M12.5 4.6h7M12.5 7.2h4.5" stroke="#15130F" stroke-width="1.4" stroke-linecap="round"/><rect x="2" y="9" width="28" height="21" rx="6.5" fill="#15130F"/><rect x="6" y="18.5" width="20" height="8" rx="3" fill="#0E7A55"/><rect x="12.5" y="21.6" width="7" height="1.9" rx=".95" fill="#fff"/><rect x="8" y="12.4" width="16" height="2" rx="1" fill="#fff" opacity=".28"/></svg>`;
  D.brand = (sub) => (CFG.brand ? `<span class="brand"><img class="brand__mark" src="${CFG.brand.mark}" alt=""><span class="brand__word">${CFG.brand.word}</span>${sub || CFG.brand.sub ? `<span class="brand__ar">${sub || CFG.brand.sub}</span>` : ''}</span>` : `<span class="brand">${D.mark()}<span class="brand__word">darj</span>${sub ? `<span class="brand__ar">${sub}</span>` : ''}</span>`);
  D.av = (u, cls) => { const s = typeof u === 'string' ? D.staff(u) : u; return `<span class="av${cls ? ' ' + cls : ''}" style="background:${s.c}">${D.esc(s.short.slice(0, 1))}</span>`; };
  D.payIcon = (m) => ({
    cash: '<svg viewBox="0 0 34 22"><rect x="1" y="2" width="32" height="18" rx="3" fill="#E3F1E9" stroke="#0E7A55" stroke-width="1.4"/><circle cx="17" cy="11" r="4" fill="none" stroke="#0E7A55" stroke-width="1.4"/></svg>',
    mada: '<svg viewBox="0 0 34 22"><rect x="1" y="1" width="32" height="20" rx="4" fill="#fff" stroke="#D9D2C4"/><rect x="5" y="7" width="10" height="3" rx="1" fill="#2BA8E0"/><rect x="5" y="12" width="10" height="3" rx="1" fill="#84B840"/><text x="24" y="15" font-family="Arial" font-weight="700" font-size="7" text-anchor="middle" fill="#15130F">mada</text></svg>',
    apple: '<svg viewBox="0 0 34 22"><rect x="1" y="1" width="32" height="20" rx="4" fill="#15130F"/><text x="17" y="14.5" font-family="-apple-system,Arial" font-weight="600" font-size="8" text-anchor="middle" fill="#fff">Pay</text><circle cx="9" cy="11.5" r="2.2" fill="#fff"/></svg>',
    stc: '<svg viewBox="0 0 34 22"><rect x="1" y="1" width="32" height="20" rx="4" fill="#4F008C"/><text x="17" y="14.5" font-family="Arial" font-weight="700" font-size="7.5" text-anchor="middle" fill="#fff">stc pay</text></svg>',
    online: '<svg viewBox="0 0 34 22"><rect x="1" y="1" width="32" height="20" rx="4" fill="#E5ECF7"/><path d="M11 11h12M17 6c2 1.5 2 8.5 0 10M17 6c-2 1.5-2 8.5 0 10" stroke="#2F5DA8" stroke-width="1.3" fill="none"/><circle cx="17" cy="11" r="5" stroke="#2F5DA8" stroke-width="1.3" fill="none"/></svg>',
  }[m] || '');

  /* ---------- UI helpers ---------- */
  function host() { let h = document.querySelector('.toasts'); if (!h) { h = document.createElement('div'); h.className = 'toasts'; document.body.appendChild(h); } return h; }
  D.toast = (t, s, o) => {
    o = o || {};
    const el = document.createElement('div');
    el.className = 'toast' + (o.warn ? ' warn' : '');
    el.innerHTML = `${D.icon(o.ic || (o.warn ? 'alert' : 'check'))}<div><b>${t}</b>${s ? `<small>${s}</small>` : ''}</div>`;
    host().appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 320); }, o.ms || 3400);
  };
  D.modal = (html, o) => {
    o = o || {};
    const ov = document.createElement('div');
    ov.className = 'ovl';
    ov.innerHTML = `<div class="modal ${o.cls || ''}" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(ov);
    const close = (v) => { if (!ov.isConnected) return; ov.classList.add('closing'); setTimeout(() => ov.remove(), 190); document.removeEventListener('keydown', esc); if (o.onClose) o.onClose(v); };
    const esc = (e) => { if (e.key === 'Escape' && document.querySelector('.ovl:last-of-type') === ov) close(); };
    document.addEventListener('keydown', esc);
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && !o.sticky) close(); });
    ov.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => close()));
    const m = ov.firstElementChild; m.close = close; m.ovl = ov;
    return m;
  };
  D.head = (t, s) => `<div class="modal__h"><div><h2>${t}</h2>${s ? `<p>${s}</p>` : ''}</div><button class="icon-btn" data-close aria-label="إغلاق">${D.icon('x')}</button></div>`;

  // موافقة مشرف/مدير بالـPIN — بترجع المستخدم اللي وافق أو null
  D.approve = (perm, why, current) => new Promise((resolve) => {
    if (D.can(current, perm) === 1) { resolve(D.staff(current)); return; }
    const p = D.PERMS.find((x) => x.id === perm);
    let pin = '';
    const m = D.modal(`${D.head('موافقة المشرف', `${p ? p.ar : ''}${why ? ' — ' + D.esc(why) : ''}`)}
      <div class="modal__b"><div class="blind">${D.icon('shield', 'sm')} هذه العملية تحتاج رمز PIN لمشرف أو مدير، وستُسجَّل في سجل الحركات باسمه.</div>
      <div class="pin__dots" style="margin-top:18px">${'<i></i>'.repeat(4)}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<button class="fn" data-n="c">مسح</button><button data-n="0">0</button><button class="fn" data-n="b">رجوع</button></div>
      ${D.REAL ? '' : '<p class="pin__hint">للتجربة: فيصل (مشرف) <b>2222</b> · نورة (مديرة) <b>9999</b></p>'}</div>`, { cls: 'modal--sm', onClose: () => resolve(null) });
    const dots = m.querySelector('.pin__dots');
    const paint = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const press = (n) => {
      if (n === 'c') pin = ''; else if (n === 'b') pin = pin.slice(0, -1); else if (pin.length < 4) pin += n;
      paint();
      if (pin.length === 4) {
        const u = D.STAFF.find((s) => s.pin === pin && D.can(s, perm) === 1);
        if (u) { setTimeout(() => { resolve(u); m.close('ok'); }, 140); }
        else { dots.classList.add('err'); setTimeout(() => { dots.classList.remove('err'); pin = ''; paint(); }, 420); }
      }
    };
    m.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => press(b.dataset.n)));
    const key = (e) => { if (!m.isConnected) { document.removeEventListener('keydown', key); return; } if (/^\d$/.test(e.key)) press(e.key); if (e.key === 'Backspace') press('b'); };
    document.addEventListener('keydown', key);
    const done = resolve; resolve = (v) => { document.removeEventListener('keydown', key); done(v); };
  });

  /* ---------- sound ---------- */
  let AC = null, OUT = null, bellBuf = null, bellP = null, playing = [], primed = false;
  const BELL_URL = 'assets/audio/order-up-bell.mp3';
  // نغمات الطلب الجديد — بتتغيّر من Settings، وكل نغمة ليها زرار تجربة
  D.TONES = [
    { id: 'bell', en: 'Order bell', ar: 'جرس الطلب', sub: 'نفس جرس المنيو — واضح وطويل', secs: 3.95 },
    { id: 'service', en: 'Counter bell', ar: 'جرس الكاونتر', sub: 'ضربتين حادتين', secs: 1.55 },
    { id: 'doorbell', en: 'Ding dong', ar: 'دينج دونج', sub: 'نغمتين طويلتين', secs: 2.3 },
    { id: 'chime', en: 'Soft chime', ar: 'نغمة هادية', sub: 'لطيفة وقصيرة', secs: .55 },
    { id: 'rise', en: 'Rising', ar: 'نغمة صاعدة', sub: 'أربع نغمات واضحة', secs: .98 },
    { id: 'triple', en: 'Triple beep', ar: 'ثلاث نبضات', sub: 'قوية وسريعة', secs: .85 },
    { id: 'ring', en: 'Long ring', ar: 'رنين طويل', sub: 'زي رنة التليفون', secs: 3.1 },
    { id: 'alarm', en: 'Loud alarm', ar: 'إنذار عالي', sub: 'للأماكن الصاخبة والزحمة', secs: 2.56 },
  ];
  D.TONE_VOLS = [[1, 'Normal', 'عادي'], [2, 'Loud', 'عالي'], [3, 'Max', 'أقصى صوت']];
  D.TONE_REPS = [[1, 'Once', 'مرة'], [2, 'Twice', 'مرتين'], [3, '3 times', '3 مرات'], [0, 'Until seen', 'لحد الرد']];
  const VOLS = { 1: .55, 2: 1, 3: 1.7 };
  const resume = () => { try { const p = AC.resume(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* */ } };
  const needAC = () => {
    if (AC) return AC;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { AC = null; return null; }
    // ضاغط صغير: بيرفع الأصوات الواطية من غير ما تقطّع
    const c = AC.createDynamicsCompressor(); c.threshold.value = -20; c.knee.value = 12; c.ratio.value = 10; c.attack.value = .003; c.release.value = .2;
    c.connect(AC.destination); OUT = c;
    return AC;
  };
  const loadBell = () => {
    if (bellBuf) return Promise.resolve(bellBuf);
    if (bellP) return bellP;
    if (!needAC()) return Promise.reject(new Error('audio'));
    bellP = fetch(BELL_URL).then((r) => { if (!r.ok) throw new Error('bell'); return r.arrayBuffer(); })
      .then((d) => new Promise((res, rej) => AC.decodeAudioData(d, res, rej)))
      .then((b) => { bellBuf = b; return b; })
      .catch((e) => { bellP = null; throw e; });
    return bellP;
  };
  const unlock = () => {
    if (!needAC()) return;
    if (AC.state !== 'running') resume();
    if (!primed) {
      primed = true;
      try { const s = AC.createBufferSource(); s.buffer = AC.createBuffer(1, 1, 22050); s.connect(AC.destination); s.start(0); } catch (e) { /* */ }
      loadBell().catch(() => {});
    }
  };
  ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, unlock, { passive: true }));
  // صوت كل شاشة على حدة (الباريستا ممكن يكتم شاشته من غير ما يكتم الكاشير)
  D.devMute = (on) => { try { if (on == null) return localStorage.getItem(BASE + ':mute:' + location.pathname.split('/').pop() + location.search) === '1'; localStorage.setItem(BASE + ':mute:' + location.pathname.split('/').pop() + location.search, on ? '1' : '0'); } catch (e) { /* */ } return !!on; };
  const osc = (out, t, f, dur, gain, type, at) => {
    const o = AC.createOscillator(); const g = AC.createGain();
    o.type = type || 'sine'; o.frequency.value = f;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(gain, t + (at || .006)); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + .02); playing.push(o);
  };
  const SYNTH = {
    service: (out, t) => [0, .42].forEach((d) => [[2093, .55, 1.1], [4190, .18, .7], [5780, .22, .5], [11300, .06, .25]].forEach(([f, g, len]) => osc(out, t + d, f, len, g))),
    doorbell: (out, t) => [[659.25, 0, 1.3], [523.25, .6, 1.7]].forEach(([f, d, len]) => { osc(out, t + d, f, len, .7, 'triangle'); osc(out, t + d, f * 2, len * .6, .18); }),
    chime: (out, t) => [[880, 0], [1320, .12]].forEach(([f, d]) => osc(out, t + d, f, .42, .4)),
    rise: (out, t) => [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => osc(out, t + i * .16, f, .5, .65, 'triangle')),
    triple: (out, t) => [0, .3, .6].forEach((d) => osc(out, t + d, 1046.5, .24, .6, 'square')),
    ring: (out, t) => [0, 1.7].forEach((d) => { for (let i = 0; i < 28; i++) osc(out, t + d + i * .05, i % 2 ? 1250 : 1000, .05, .55, 'square', .003); }),
    alarm: (out, t) => { for (let i = 0; i < 8; i++) osc(out, t + i * .32, i % 2 ? 770 : 960, .3, .7, 'sawtooth', .01); },
  };
  D.playTone = (id, vol, times) => {
    if (!needAC()) return;
    if (AC.state !== 'running') resume();
    playing.forEach((n) => { try { n.stop(); } catch (e) { /* */ } }); playing = [];
    const m = D.TONES.find((t) => t.id === id) || D.TONES[0];
    const n = Math.max(1, times || 1);
    const out = AC.createGain(); out.gain.value = VOLS[vol] || 1; out.connect(OUT);
    const at = (i) => AC.currentTime + .03 + i * (m.secs + .4);
    if (m.id === 'bell') {
      loadBell().then((b) => { for (let i = 0; i < n; i++) { const s = AC.createBufferSource(); s.buffer = b; s.connect(out); s.start(at(i)); playing.push(s); } })
        .catch(() => { for (let i = 0; i < n; i++) SYNTH.service(out, at(i)); });
      return;
    }
    for (let i = 0; i < n; i++) SYNTH[m.id](out, at(i));
  };
  D.sound = (kind) => {
    if (!AC || (S && S.settings && !S.settings.sound) || D.devMute()) return;
    if (AC.state !== 'running') resume();
    if (kind === 'new') { const st = (S && S.settings) || {}; D.playTone(st.orderTone || 'bell', st.orderVol || 2, st.orderRepeat == null ? 1 : st.orderRepeat || 1); return; }
    const notes = { ready: [[660, 0], [990, .1], [1320, .2]], beep: [[1900, 0]], ok: [[740, 0], [1110, .09]], err: [[220, 0]] }[kind] || [[880, 0]];
    notes.forEach(([f, d]) => {
      const o = AC.createOscillator(); const g = AC.createGain();
      o.type = kind === 'beep' ? 'square' : 'sine'; o.frequency.value = f;
      const t0 = AC.currentTime + d;
      g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(kind === 'beep' ? .05 : .16, t0 + .01); g.gain.exponentialRampToValueAtTime(.0001, t0 + (kind === 'beep' ? .09 : .35));
      o.connect(g); g.connect(AC.destination); o.start(t0); o.stop(t0 + .4);
    });
  };
  // «لحد الرد»: الصوت بيتعاد كل 15 ثانية طول ما فيه طلب مستني
  D.alertLoop = (pending) => setInterval(() => { const st = S && S.settings; if (st && st.orderRepeat === 0 && pending()) D.sound('new'); }, 15000);
  // المتصفح مش بيشغّل صوت قبل أول ضغطة، فشاشات المطبخ والباريستا لازم تتضغط مرة بعد الفتح
  function soundGate() {
    if (['kiosk', 'board', 'cart'].includes(window.DARJ_ROLE)) return;
    let el = null;
    const tick = () => {
      const want = !!(S && S.settings && S.settings.sound) && !D.devMute() && !(AC && AC.state === 'running');
      if (want && !el) { el = document.createElement('button'); el.type = 'button'; el.className = 'snd-gate'; el.innerHTML = `${D.icon('volume')}<span class="bi"><b>Tap to enable sound</b><small>اضغط هنا مرة عشان صوت الطلبات يشتغل</small></span>`; document.body.appendChild(el); }
      if (!want && el) { el.remove(); el = null; }
    };
    ['pointerdown', 'touchend', 'click', 'keydown'].forEach((ev) => window.addEventListener(ev, () => setTimeout(tick, 150), { passive: true }));
    setTimeout(tick, 1000); setInterval(tick, 4000);
  }
  D.drawerPop = (txt) => {
    const el = document.createElement('div');
    el.className = 'drawer-pop';
    el.innerHTML = `<svg viewBox="0 0 34 24"><rect x="1" y="1" width="32" height="14" rx="3" fill="#2E2A23"/><rect x="3" y="11" width="28" height="11" rx="2.5" fill="#0E7A55"><animate attributeName="y" from="9" to="13" dur=".35s" fill="freeze"/></rect><rect x="13" y="16" width="8" height="2" rx="1" fill="#fff"/></svg>${txt || 'فُتح الدرج'}`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2300);
  };
  D.print = (html) => {
    let root = document.querySelector('.print-root');
    if (!root) { root = document.createElement('div'); root.className = 'print-root'; document.body.appendChild(root); }
    root.innerHTML = html.replace('receipt print', 'receipt');
    setTimeout(() => window.print(), 60);
  };

  /* ---------- live loop ---------- */
  D.startLive = () => {
    D.load();
    soundGate();
    if (D.SAT) return;
    setInterval(D.tick, 3000); setTimeout(D.tick, 1500);
    if (D.REAL) {
      const sync = () => { const off = !navigator.onLine; if (!!D.state().settings.offline !== off) D.goOffline(off, null); };
      window.addEventListener('online', sync); window.addEventListener('offline', sync); setTimeout(sync, 800);
    }
  };
})();
