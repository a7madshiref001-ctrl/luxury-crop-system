"use strict";
const crypto = require("node:crypto");
const fail = (message, status = 400) => {
  throw Object.assign(new Error(message), { status });
};
const text = (v, max = 200) =>
  String(v ?? "")
    .trim()
    .slice(0, max);
const num = (v, min, max) => {
  if (typeof v !== "number" || !Number.isFinite(v) || v < min || v > max)
    fail("قيمة رقمية غير صحيحة");
  return v;
};
const cents = (v) => Math.round(v * 100);
const cleanId = (v) => {
  v = text(v, 80);
  if (!/^[a-zA-Z0-9_-]+$/.test(v)) fail("معرّف غير صحيح");
  return v;
};
const safeImage = (v) =>
  /^assets\/[a-zA-Z0-9_./-]+\.(webp|png|jpe?g)$/.test(v || "") &&
  !v.includes("..")
    ? v
    : null;
function validateMenu(input) {
  if (
    !input ||
    !Array.isArray(input.categories) ||
    !input.categories.length ||
    input.categories.length > 40
  )
    fail("ملف المنيو غير صالح");
  const ids = new Set(),
    cats = new Set();
  const categories = input.categories.map((c) => {
    if (!c || typeof c !== "object") fail("قسم غير صالح");
    const id = cleanId(c.id);
    if (cats.has(id)) fail("قسم مكرر");
    cats.add(id);
    if (!Array.isArray(c.items) || c.items.length > 300 || !text(c.name_ar))
      fail("قسم غير صالح");
    return {
      id,
      slug: cleanId(c.slug || id),
      name_ar: text(c.name_ar, 100),
      name_en: text(c.name_en, 100),
      sub_ar: text(c.sub_ar),
      sub_en: text(c.sub_en),
      items: c.items.map((i) => {
        if (!i || typeof i !== "object") fail("صنف غير صالح");
        const itemId = cleanId(i.id);
        if (ids.has(itemId)) fail("رقم صنف مكرر");
        ids.add(itemId);
        if (!text(i.name_ar)) fail("اسم الصنف مطلوب");
        return {
          id: itemId,
          name_ar: text(i.name_ar, 100),
          name_en: text(i.name_en, 100),
          desc_ar: text(i.desc_ar, 1200),
          desc_en: text(i.desc_en, 1200),
          price: num(i.price, 0, 10000),
          currency: "SAR",
          image: safeImage(i.image),
          available: i.available !== false,
          allergens: Array.isArray(i.allergens)
            ? i.allergens.filter((a) =>
                [
                  "gluten",
                  "crustaceans",
                  "eggs",
                  "fish",
                  "peanuts",
                  "soy",
                  "milk",
                  "treenuts",
                  "celery",
                  "mustard",
                  "sesame",
                  "sulphites",
                  "lupin",
                  "molluscs",
                ].includes(a),
              )
            : [],
          allergens_confirmed: i.allergens_confirmed === true,
          nutrition_estimated: i.nutrition_estimated !== false,
          kcal: i.kcal == null ? null : num(i.kcal, 0, 10000),
          caffeine_mg:
            i.caffeine_mg == null ? null : num(i.caffeine_mg, 0, 2000),
          high_sodium: i.high_sodium === true,
        };
      }),
    };
  });
  return { categories };
}
const defaultSettings = {
  acceptingOrders: true,
  tables: 30,
  modes: ["table", "takeaway"],
  deliveryFee: 0,
  whatsapp: "",
  offer: {
    enabled: false,
    title: "",
    percent: 0,
    category: "",
    startsAt: "",
    endsAt: "",
  },
  coupon: { enabled: false, code: "", percent: 0, minSubtotal: 0, endsAt: "" },
  loyalty: { enabled: false, goal: 6, reward: "" },
};
function validateSettings(s) {
  if (
    !s ||
    !Array.isArray(s.modes) ||
    !s.modes.length ||
    s.modes.some((m) => !["table", "takeaway", "delivery"].includes(m))
  )
    fail("اختر طرق الاستلام");
  const o = s.offer || {},
    l = s.loyalty || {},
    cp = s.coupon || {
      enabled: false,
      code: "",
      percent: 0,
      minSubtotal: 0,
      endsAt: "",
    };
  for (const value of [o.startsAt, o.endsAt, cp.endsAt]) {
    if (value && !Number.isFinite(Date.parse(value))) fail("التاريخ غير صحيح");
  }
  if (
    cp.enabled &&
    (!/^[A-Z0-9_-]{3,24}$/.test(cp.code) ||
      !Number.isFinite(Date.parse(cp.endsAt)))
  )
    fail("بيانات الكوبون غير صحيحة");
  if (
    o.enabled &&
    (!text(o.title) ||
      !Number.isFinite(Date.parse(o.startsAt)) ||
      !Number.isFinite(Date.parse(o.endsAt)) ||
      Date.parse(o.endsAt) <= Date.parse(o.startsAt))
  )
    fail("حدد بداية العرض ونهايته");
  const whatsapp = text(s.whatsapp, 20).replace(/\D/g, "");
  if (whatsapp && !/^\d{10,15}$/.test(whatsapp)) fail("رقم واتساب غير صحيح");
  if (l.enabled && !text(l.reward)) fail("اكتب مكافأة الولاء");
  return {
    acceptingOrders: s.acceptingOrders === true,
    tables: Math.floor(num(s.tables, 1, 300)),
    modes: [...new Set(s.modes)],
    deliveryFee: num(s.deliveryFee, 0, 500),
    whatsapp,
    offer: {
      enabled: o.enabled === true,
      title: text(o.title),
      percent: num(o.percent, 0, 80),
      category: text(o.category, 80),
      startsAt: text(o.startsAt, 40),
      endsAt: text(o.endsAt, 40),
    },
    coupon: {
      enabled: cp.enabled === true,
      code: text(cp.code, 24).toUpperCase(),
      percent: num(cp.percent, 0, 80),
      minSubtotal: num(cp.minSubtotal, 0, 10000),
      endsAt: text(cp.endsAt, 40),
    },
    loyalty: {
      enabled: l.enabled === true,
      goal: Math.floor(num(l.goal, 2, 100)),
      reward: text(l.reward),
    },
  };
}
function offerActive(settings, now = Date.now()) {
  const o = settings.offer;
  return (
    o.enabled && Date.parse(o.startsAt) <= now && now < Date.parse(o.endsAt)
  );
}
function unitPrice(item, categoryId, settings, now = Date.now()) {
  return offerActive(settings, now) &&
    (!settings.offer.category || settings.offer.category === categoryId)
    ? Math.round((cents(item.price) * (100 - settings.offer.percent)) / 100)
    : cents(item.price);
}
function quoteOrder(body, menu, settings, now = Date.now()) {
  if (!settings.acceptingOrders) fail("استقبال الطلبات متوقف مؤقتًا", 409);
  if (
    !Array.isArray(body.lines) ||
    !body.lines.length ||
    body.lines.length > 60
  )
    fail("السلة فارغة أو أكبر من الحد");
  if (!settings.modes.includes(body.mode)) fail("طريقة استلام غير متاحة");
  let table = null;
  if (body.mode === "table") {
    table = num(body.table, 1, settings.tables);
    if (!Number.isInteger(table)) fail("رقم الطاولة غير صحيح");
  }
  const phone = text(body.phone, 25)
    .replace(/[٠-٩]/g, (d) => "٠١٢٣٤٥٦٧٨٩".indexOf(d))
    .replace(/[\s()-]/g, "");
  if (phone && !/^(05\d{8}|(?:\+?966)5\d{8})$/.test(phone))
    fail("اكتب رقم جوال سعودي صحيح");
  const name = text(body.name, 80),
    address = text(body.address, 300);
  if (body.mode !== "table" && (!name || !phone))
    fail("الاسم والجوال مطلوبان للاستلام والتوصيل");
  if (body.mode === "delivery" && address.length < 8)
    fail("اكتب عنوان التوصيل بالتفصيل");
  const index = new Map(
    menu.categories.flatMap((c) =>
      c.items.map((i) => [
        i.id,
        { ...i, category: c.id, categoryName: c.name_ar },
      ]),
    ),
  );
  const counts = new Map();
  const lines = body.lines.map((l) => {
    if (!l || typeof l !== "object") fail("سطر طلب غير صالح");
    const i = index.get(l.id);
    if (!i || !i.available) fail("صنف غير متاح، راجع السلة", 409);
    const quantity = num(l.quantity, 1, 20);
    if (!Number.isInteger(quantity)) fail("الكمية غير صحيحة");
    counts.set(i.id, (counts.get(i.id) || 0) + quantity);
    if (counts.get(i.id) > 20) fail("الحد الأقصى ٢٠ من الصنف");
    const extra = l.extra || "";
    if (extra && (i.id !== "170300" || !["vanilla", "caramel"].includes(extra)))
      fail("إضافة غير متاحة");
    const milk = l.milk || "";
    if (
      milk &&
      (i.id !== "170300" || !["cow", "soy", "coconut", "almond"].includes(milk))
    )
      fail("اختيار حليب غير صالح");
    const unit = unitPrice(i, i.category, settings, now) + (extra ? 400 : 0);
    return {
      id: i.id,
      name: i.name_ar,
      name_en: i.name_en,
      category: i.category,
      categoryName: i.categoryName,
      quantity,
      unit,
      base: cents(i.price),
      extra,
      milk,
      note: text(l.note, 250),
      suggested: l.suggested === true,
      total: unit * quantity,
    };
  });
  const subtotal = lines.reduce((s, l) => s + l.total, 0),
    fee = body.mode === "delivery" ? cents(settings.deliveryFee) : 0;
  const code = text(body.couponCode, 24).toUpperCase(),
    cp = settings.coupon;
  let discount = 0;
  if (code) {
    if (
      !cp?.enabled ||
      code !== cp.code ||
      now >= Date.parse(cp.endsAt) ||
      subtotal < cents(cp.minSubtotal) ||
      offerActive(settings, now)
    )
      fail("الكوبون غير صالح أو لا يجمع مع العرض");
    discount = Math.round((subtotal * cp.percent) / 100);
  }
  let remaining = discount;
  const allocations = lines
    .map((line, index) => {
      const share = subtotal ? (discount * line.total) / subtotal : 0;
      line.discount = Math.floor(share);
      remaining -= line.discount;
      return { index, fraction: share - line.discount };
    })
    .sort((a, b) => b.fraction - a.fraction);
  for (const { index } of allocations) {
    if (remaining > 0 && lines[index].discount < lines[index].total) {
      lines[index].discount++;
      remaining--;
    }
  }
  return {
    lines,
    subtotal,
    fee,
    discount,
    couponCode: code,
    total: subtotal + fee - discount,
    mode: body.mode,
    table,
    name,
    phone: phone.replace(/^\+?966/, "0"),
    address,
    note: text(body.note, 500),
    marketingConsent: body.marketingConsent === true,
  };
}
const transitions = {
  new: ["preparing", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
function changeStatus(order, next) {
  if (!transitions[order.status]?.includes(next))
    fail("لا يمكن تغيير حالة الطلب بهذه الطريقة", 409);
  return {
    ...order,
    status: next,
    updatedAt: Date.now(),
    ...(next === "completed" ? { completedAt: Date.now() } : {}),
  };
}
function publicOrder(o) {
  return {
    id: o.id,
    number: o.number,
    status: o.status,
    total: o.total,
    fee: o.fee,
    discount: o.discount || 0,
    mode: o.mode,
    table: o.table,
    createdAt: o.createdAt,
    lines: o.lines.map(
      ({ name, name_en, quantity, unit, extra, milk, note }) => ({
        name,
        name_en,
        quantity,
        unit,
        extra,
        milk,
        note,
      }),
    ),
  };
}
function summary(orders, events, reviews, days = 30) {
  const since = Date.now() - days * 86400000,
    recent = orders.filter((o) => o.createdAt >= since),
    paid = orders.filter(
      (o) => o.status === "completed" && o.completedAt >= since,
    );
  const ev = events.filter((e) => e.at >= since),
    product = Object.create(null),
    byDay = Object.create(null),
    hours = Array(24).fill(0);
  paid.forEach((o) => {
    const d = new Date(o.completedAt);
    const key = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Riyadh",
    }).format(d);
    byDay[key] = (byDay[key] || 0) + o.total;
    const h = Number(
      new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Riyadh",
        hour: "2-digit",
        hourCycle: "h23",
      }).format(d),
    );
    hours[h]++;
    o.lines.forEach((l) => {
      const p = (product[l.id] ||= {
        id: l.id,
        name: l.name,
        category: l.categoryName,
        quantity: 0,
        revenue: 0,
        views: 0,
      });
      p.quantity += l.quantity;
      p.revenue += l.total - (l.discount || 0);
    });
  });
  ev.filter((e) => e.kind === "item_view").forEach((e) => {
    const p = (product[e.itemId] ||= {
      id: e.itemId,
      quantity: 0,
      revenue: 0,
      views: 0,
    });
    p.views++;
  });
  const revenue = paid.reduce((s, o) => s + o.total, 0);
  return {
    revenue,
    completed: paid.length,
    pending: recent.filter(
      (o) => !["completed", "cancelled"].includes(o.status),
    ).length,
    cancelled: recent.filter((o) => o.status === "cancelled").length,
    average: paid.length ? Math.round(revenue / paid.length) : 0,
    visits: ev.filter((e) => e.kind === "visit").length,
    added: ev.filter((e) => e.kind === "add_cart").length,
    byDay,
    hours,
    products: Object.values(product).sort((a, b) => b.revenue - a.revenue),
    upsell: paid.reduce(
      (s, o) =>
        s +
        o.lines
          .filter((l) => l.suggested)
          .reduce((a, l) => a + l.total - (l.discount || 0), 0),
      0,
    ),
    reviews: reviews.filter((r) => r.at >= since).length,
  };
}
module.exports = {
  fail,
  text,
  num,
  cleanId,
  validateMenu,
  validateSettings,
  defaultSettings,
  quoteOrder,
  unitPrice,
  offerActive,
  changeStatus,
  publicOrder,
  summary,
  token: () => crypto.randomBytes(24).toString("hex"),
};
