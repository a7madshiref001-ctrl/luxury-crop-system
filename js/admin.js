import {
  $,
  esc,
  api,
  post,
  icon,
  toast,
  dialog,
  closeDialog,
  download,
  normalize,
  money,
  states,
  modes,
  optionName,
} from "./shared.js";
let S,
  page = "home",
  cat = "",
  query = "",
  busy = false,
  editing = null;
let dirty = false,
  sessionEpoch = 0,
  refreshing = false,
  refreshVersion = 0;
const discardChanges = () =>
  !dirty || confirm("عندك تعديلات لم تُحفظ. تركها والمتابعة؟");
const saveError = (err) =>
  err.status === 409
    ? "تغيرت البيانات من جهاز آخر. انسخ تعديلاتك ثم اضغط تحديث وأعد المحاولة."
    : err.message || "تعذر تنفيذ العملية";
const title = {
  home: "نظرة عامة",
  orders: "الطلبات",
  menu: "المنيو والأصناف",
  customers: "العملاء والولاء",
  reviews: "آراء العملاء",
  settings: "الإعدادات والعروض",
};
const cash = (c) => `${money(c)} <small>ر.س</small>`;
const date = (t) =>
  new Date(t).toLocaleString("ar-SA", {
    timeZone: "Asia/Riyadh",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const items = () =>
  S.menu.categories.flatMap((c) => c.items.map((i) => ({ ...i, category: c })));
const empty = (t) =>
  `<div class="empty">${icon("coffee")}<p>${esc(t)}</p></div>`;
async function refresh(render = true) {
  refreshing = true;
  const epoch = sessionEpoch;
  const version = ++refreshVersion;
  try {
    const next = await api(`api/admin/state?days=${$("#period").value}`);
    if (epoch !== sessionEpoch || version !== refreshVersion) return;
    S = next;
    $("#loginUnavailable")?.remove();
    $("#loginForm")
      .querySelectorAll("input,button,label")
      .forEach((el) => (el.hidden = false));
    $("#loginScreen").hidden = true;
    $("#dashboard").hidden = false;
    $("#syncStatus").innerHTML = '<i class="alert-dot"></i> متصل';
    $("#newCount").textContent =
      S.orders.filter((o) => o.status === "new").length || "";
    if (render) draw();
  } catch (e) {
    if (epoch !== sessionEpoch || version !== refreshVersion) return;
    if (e.status === 401) {
      closeDialog();
      S = null;
      $("#loginScreen").hidden = false;
      $("#dashboard").hidden = true;
    } else {
      if (!S) {
        $("#loginForm")
          .querySelectorAll("input,button,label")
          .forEach((el) => (el.hidden = true));
        if (!$("#loginUnavailable")) {
          const note = document.createElement("div");
          note.id = "loginUnavailable";
          note.className = "notice";
          note.textContent =
            "هذه النسخة تعرض المنيو على GitHub Pages. لوحة الإدارة والطلبات تحتاج تشغيل السيرفر؛ لا يوجد تسجيل دخول للإدارة على الاستضافة الحالية. افتح نسخة الإدارة المحلية بعد تشغيل النظام على جهازك.";
          $("#loginError").before(note);
        }
      }
      $("#syncStatus").textContent = "انقطع الاتصال";
      toast(e.message || "تعذر الاتصال");
    }
  } finally {
    if (version === refreshVersion) refreshing = false;
  }
}
function go(p) {
  $("#sidebar").classList.remove("open");
  if (!discardChanges()) return;
  dirty = false;
  page = p;
  query = "";
  $("#sidebar").classList.remove("open");
  document
    .querySelectorAll("[data-page]")
    .forEach((b) => b.classList.toggle("on", b.dataset.page === p));
  draw();
  window.scrollTo(0, 0);
}
function draw() {
  $("#pageTitle").textContent = title[page];
  $("#ownerContent").innerHTML = {
    home,
    orders,
    menu,
    customers,
    reviews,
    settings,
  }[page]();
}
function kpi(label, value, sub) {
  return `<div class="kpi"><span class="label">${label}</span><div class="value">${value}</div><p class="muted">${sub}</p></div>`;
}
function chart() {
  const entries = [];
  for (let d = 13; d >= 0; d--) {
    const dt = new Date(Date.now() - d * 86400000),
      key = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Riyadh",
      }).format(dt);
    entries.push({
      label: dt.toLocaleDateString("ar-SA", {
        timeZone: "Asia/Riyadh",
        day: "numeric",
      }),
      v: S.summary.byDay[key] || 0,
    });
  }
  const max = Math.max(1, ...entries.map((e) => e.v));
  return `<div class="chart">${entries.map((e) => `<div class="chart-col"><span class="v">${money(e.v)}</span><div class="chart-bar" style="height:${(e.v / max) * 130}px" title="${money(e.v)} ر.س"></div><small>${e.label}</small></div>`).join("")}</div>`;
}
function peakHours() {
  const values = S.summary.hours,
    max = Math.max(1, ...values);
  return `<section class="panel"><h2>متى يزيد الشغل؟</h2><p class="sub">عدد الطلبات المكتملة حسب ساعة التسليم · بتوقيت السعودية</p><div class="chart">${values.map((v, h) => `<div class="chart-col"><span class="v">${v || ""}</span><div class="chart-bar" style="height:${(v / max) * 120}px" title="${h}:00 — ${v} طلب"></div><small>${h % 3 === 0 ? h : ""}</small></div>`).join("")}</div></section>`;
}
function home() {
  const a = S.summary,
    out = items().filter((i) => !i.available),
    pending = S.orders.filter(
      (o) => !["completed", "cancelled"].includes(o.status),
    );
  return `<div class="kpis">${kpi("المبيعات المكتملة", cash(a.revenue), "بعد اكتمال الطلب · خلال الفترة المختارة")}${kpi("طلبات مكتملة", a.completed, "لا تشمل الملغية أو قيد التحضير")}${kpi("متوسط الطلب", cash(a.average), "قيمة المبيعات ÷ الطلبات المكتملة")}${kpi("بانتظار فريقك", pending.length, "طلبات حالية من كل الفترات")}</div><div class="owner-grid"><section class="panel"><h2>المبيعات، يومًا بيوم.</h2><p class="sub">آخر ١٤ يوم داخل الفترة المحددة · بتوقيت السعودية</p>${chart()}</section><section class="panel"><h2>يحتاج انتباهك</h2><p class="sub">خطوات واضحة ليوم أهدأ.</p><div class="insight"><b>${pending.length} طلب في قائمة التشغيل</b><small>استقبل الطلبات الجديدة وانقلها للتحضير.</small><button class="btn small secondary" data-page="orders">افتح الطلبات ←</button></div><div class="insight"><b>${out.length} صنف غير متوفر</b><small>${
    out.length
      ? esc(
          out
            .slice(0, 3)
            .map((i) => i.name_ar)
            .join("، "),
        )
      : "كل أصنافك متاحة حاليًا."
  }</small></div><div class="insight"><b>${S.reviews.filter((r) => r.stars <= 3).length} ملاحظة بتقييم منخفض</b><small>راجع التجربة والملاحظات لتحسين الخدمة.</small></div></section></div><div class="owner-grid"><section class="panel"><h2>أداء الأصناف</h2><p class="sub">ترتيب حسب إيراد الطلبات المكتملة؛ الساخن والبارد منفصلان.</p>${performance()}</section><section class="panel"><h2>رحلة العميل</h2><p class="sub">بيانات الزيارات المسجلة؛ ليست عدد أشخاص فريدين.</p>${[
    ["فتحات المنيو", a.visits],
    ["إضافات للسلة", a.added],
    ["طلبات مكتملة", a.completed],
    ["إيراد الاقتراحات", cash(a.upsell)],
    ["طلبات ملغية", a.cancelled],
  ]
    .map(
      ([n, v]) =>
        `<div class="receipt-line"><span>${n}</span><strong>${v}</strong></div>`,
    )
    .join(
      "",
    )}<div class="notice">الأرقام تبدأ من استخدام العملاء الفعلي؛ لا توجد مبيعات تجريبية.</div></section></div>${peakHours()}`;
}
function performance() {
  const all = items();
  return S.summary.products.length
    ? `<div class="table-wrap"><table><thead><tr><th>الصنف</th><th>المشاهدات</th><th>الكمية</th><th>الإيراد</th></tr></thead><tbody>${S.summary.products
        .slice(0, 12)
        .map((p) => {
          const i = all.find((i) => i.id === p.id);
          return `<tr><td>${esc(i?.name_ar || p.name || p.id)}<br><small>${esc(i?.category.name_ar || p.category || "")}</small></td><td>${p.views}</td><td>${p.quantity}</td><td>${cash(p.revenue)}</td></tr>`;
        })
        .join("")}</tbody></table></div>`
    : empty("هنبدأ نشوف الأداء بعد أول زيارة وطلب.");
}
function orderCard(o) {
  const next = { new: "preparing", preparing: "ready", ready: "completed" }[
      o.status
    ],
    labels = {
      new: "بدء التحضير",
      preparing: "الطلب جاهز",
      ready: "تم التسليم والدفع",
    };
  return `<article class="order-card"><div class="row between"><h3>#${String(o.number).padStart(3, "0")}</h3><span class="badge">${esc(modes[o.mode])}${o.table ? " · " + o.table : ""}</span></div><small class="muted">${date(o.createdAt)}${o.name ? " · " + esc(o.name) : ""}</small><div class="order-lines">${o.lines.map((l) => `<p><b>${l.quantity} × ${esc(l.name)}</b><br><small>${esc(l.categoryName)}${l.note ? " · " + esc(l.note) : ""}${l.extra ? " · " + esc(optionName(l.extra)) : ""}${l.milk ? " · " + esc(optionName(l.milk)) : ""}</small></p>`).join("")}</div>${o.note ? `<div class="notice">${esc(o.note)}</div>` : ""}<div class="row between"><strong>${cash(o.total)}</strong><button class="btn small outline" data-receipt="${o.id}">التفاصيل</button></div>${next ? `<div class="order-actions"><button class="btn red" data-status="${next}" data-order="${o.id}">${labels[o.status]}</button><button class="btn outline" data-status="cancelled" data-order="${o.id}">إلغاء</button></div>` : ""}</article>`;
}
function orders() {
  const list = S.orders.filter(
    (o) =>
      !query ||
      normalize([o.number, o.name, o.phone, o.table].join(" ")).includes(
        normalize(query),
      ),
  );
  return `<div class="toolbar"><h2>من الطلب… لأول رشفة.</h2><input class="input" id="orderSearch" placeholder="رقم الطلب، الطاولة أو العميل" value="${esc(query)}"><button class="btn outline small" id="exportOrders">تصدير الطلبات</button></div><div class="order-board">${[
    "new",
    "preparing",
    "ready",
  ]
    .map((s) => {
      const arr = list.filter((o) => o.status === s);
      return `<section class="order-column"><h2>${states[s]} <span>${arr.length}</span></h2>${arr.map(orderCard).join("") || empty("لا توجد طلبات هنا")}</section>`;
    })
    .join(
      "",
    )}</div><section class="panel" style="margin-top:25px"><h2>سجل الطلبات</h2><p class="sub">الطلبات المكتملة والملغية · أحدث ١٠٠ طلب</p><div class="table-wrap"><table><thead><tr><th>الطلب</th><th>العميل</th><th>الحالة</th><th>الإجمالي</th><th>الوقت</th><th></th></tr></thead><tbody>${list
    .filter((o) => ["completed", "cancelled"].includes(o.status))
    .slice(0, 100)
    .map(
      (o) =>
        `<tr><td>#${o.number}</td><td>${esc(o.name || "ضيف")}</td><td><span class="badge ${o.status === "cancelled" ? "red" : "green"}">${states[o.status]}</span></td><td>${cash(o.total)}</td><td>${date(o.createdAt)}</td><td><button class="btn outline small" data-receipt="${o.id}">عرض</button></td></tr>`,
    )
    .join("")}</tbody></table></div></section>`;
}
function menu() {
  if (!S.menu.categories.some((c) => c.id === cat))
    cat = S.menu.categories[0].id;
  const c = S.menu.categories.find((c) => c.id === cat);
  return `<div class="toolbar"><h2>${items().length} صنف · ${S.menu.categories.length} أقسام</h2><button class="btn red small" id="newItem">+ صنف جديد</button><button class="btn outline small" id="newCategory">+ قسم</button><button class="btn outline small" id="exportMenu">تصدير المنيو</button><label class="btn outline small">استيراد<input id="importMenu" type="file" accept="application/json" hidden></label></div><div class="menu-manager"><nav class="category-list">${S.menu.categories.map((c) => `<button data-cat="${c.id}" class="${c.id === cat ? "on" : ""}">${esc(c.name_ar)} <small>(${c.items.length})</small></button>`).join("")}</nav><section class="panel"><div class="toolbar"><h2>${esc(c.name_ar)}</h2><button class="btn outline small" id="editCategory">تعديل القسم</button><button class="btn outline small" id="moveCategory">رفع القسم ↑</button></div><input class="input" id="menuSearch" placeholder="ابحث عن صنف داخل القسم" value="${esc(query)}">${c.items
    .filter(
      (i) =>
        !query ||
        normalize(i.name_ar + " " + i.name_en).includes(normalize(query)),
    )
    .map(
      (i) =>
        `<div class="manage-row"><img src="${esc(i.image || "assets/logo.png")}" alt=""><div class="item-info"><h3>${esc(i.name_ar)}</h3><small>${cash(i.price * 100)} · ${i.available ? "متاح" : "غير متوفر"}</small></div><div class="actions"><button class="btn small ${i.available ? "secondary" : "outline"}" data-toggle="${i.id}" aria-pressed="${i.available}">${i.available ? "إيقاف الصنف" : "إتاحة الصنف"}</button><button class="btn outline small" data-edit="${i.id}">تعديل</button><button class="icon-btn" data-up="${i.id}" aria-label="رفع الصنف">↑</button></div></div>`,
    )
    .join("")}</section></div>`;
}
function customerRows() {
  const map = new Map();
  for (const o of S.orders.filter((o) => o.status === "completed" && o.phone)) {
    const c = map.get(o.phone) || {
      name: o.name,
      phone: o.phone,
      count: 0,
      spent: 0,
      last: 0,
      consent: false,
    };
    c.count++;
    c.spent += o.total;
    if (o.createdAt > c.last) {
      c.last = o.createdAt;
      c.name = o.name || c.name;
      c.consent = o.marketingConsent;
    }
    map.set(o.phone, c);
  }
  return [...map.values()]
    .map((c) => ({
      ...c,
      stamps:
        c.count -
        (S.redemptions || [])
          .filter((r) => r.phone === c.phone)
          .reduce((n, r) => n + r.stamps, 0),
    }))
    .sort((a, b) => b.spent - a.spent);
}
function customers() {
  const rows = customerRows(),
    l = S.settings.loyalty;
  return `<div class="toolbar"><h2>علاقات تبدأ بكوب.</h2><button class="btn outline small" id="exportCustomers">تصدير العملاء CSV</button></div><div class="kpis">${kpi("عملاء بطلبات مكتملة", rows.length, "الجوال يُجمع عند الطلب فقط")}${kpi("عملاء متكررون", rows.filter((c) => c.count > 1).length, "أكثر من طلب مكتمل")}${kpi("موافقون على العروض", rows.filter((c) => c.consent).length, "موافقة اختيارية صريحة")}${kpi("برنامج الولاء", l.enabled ? "مفعّل" : "متوقف", l.enabled ? esc(l.reward) : "يمكن تفعيله من الإعدادات")}</div><section class="panel" style="margin-top:22px"><p class="sub">الولاء محسوب من الطلبات المسلّمة والمدفوعة فقط. تُراجع المكافآت مع الإدارة.</p><div class="table-wrap"><table><thead><tr><th>العميل</th><th>الجوال</th><th>الطلبات</th><th>الإنفاق</th><th>آخر زيارة</th><th>العروض</th><th>الولاء</th></tr></thead><tbody>${rows.map((c) => `<tr><td>${esc(c.name || "ضيف")}</td><td dir="ltr">${esc(c.phone)}</td><td>${c.count}</td><td>${cash(c.spent)}</td><td>${date(c.last)}</td><td>${c.consent ? "موافق" : "غير مشترك"}</td><td>${l.enabled ? `${c.stamps} / ${l.goal}<div class="loyalty-bar"><span style="width:${Math.min(100, (c.stamps / l.goal) * 100)}%"></span></div>${c.stamps >= l.goal ? `<button class="btn small secondary" data-redeem="${esc(c.phone)}">تسليم المكافأة</button>` : ""}` : "—"}</td></tr>`).join("")}</tbody></table></div>${!rows.length ? empty("عملاؤك يظهرون بعد أول طلب مكتمل برقم جوال.") : ""}</section>`;
}
function reviews() {
  return `<section class="panel"><h2>نسمعك… ونتحسن.</h2><p class="sub">كل التقييمات لها نفس خيارات الإرسال للإدارة والانتقال إلى Google.</p>${S.reviews.length ? S.reviews.map((r) => `<article class="review-card"><div class="row between"><span class="rating">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span><small>${date(r.at)}</small></div><p>${esc(r.note || "بدون تعليق")}</p></article>`).join("") : empty("لا توجد آراء حتى الآن.")}</section>`;
}
function settings() {
  const s = S.settings,
    o = s.offer,
    l = s.loyalty,
    cp = s.coupon || {
      enabled: false,
      code: "",
      percent: 0,
      minSubtotal: 0,
      endsAt: "",
    };
  return `<form id="settingsForm"><div class="toolbar"><h2>ظبّط التفاصيل مرة، وارتاح.</h2><button class="btn red" type="submit">حفظ الإعدادات</button></div><div class="settings-grid"><section class="panel"><h2>استقبال الطلبات</h2><label class="check"><input type="checkbox" name="acceptingOrders" ${s.acceptingOrders ? "checked" : ""}>استقبال الطلبات الآن</label><label class="field">عدد الطاولات<input class="input" type="number" name="tables" min="1" max="300" value="${s.tables}" required></label>${Object.entries(
    modes,
    optionName,
  )
    .map(
      ([v, t]) =>
        `<label class="check"><input type="checkbox" name="mode" value="${v}" ${s.modes.includes(v) ? "checked" : ""}>${t}</label>`,
    )
    .join(
      "",
    )}<label class="field">رسوم التوصيل (ر.س)<input class="input" type="number" name="deliveryFee" min="0" max="500" step=".01" value="${s.deliveryFee}" required></label><label class="field">واتساب المقهى للاستفسارات (دولي)<input class="input" type="tel" name="whatsapp" value="${esc(s.whatsapp)}" placeholder="9665xxxxxxxx"></label><p class="muted">يظل التواصل مخفيًا حتى تضيف رقم المقهى الصحيح.</p></section><section class="panel"><h2>عرض بمدة محددة</h2><label class="check"><input type="checkbox" name="offerEnabled" ${o.enabled ? "checked" : ""}>تفعيل العرض</label><label class="field">عنوان العرض<input class="input" name="offerTitle" maxlength="200" value="${esc(o.title)}"></label><label class="field">نسبة الخصم<input class="input" type="number" name="percent" min="0" max="80" step="1" value="${o.percent}" required></label><label class="field">القسم<select name="offerCategory" class="input"><option value="">كل المنيو</option>${S.menu.categories.map((c) => `<option value="${c.id}" ${o.category === c.id ? "selected" : ""}>${esc(c.name_ar)}</option>`).join("")}</select></label><label class="field">البداية (توقيت هذا الجهاز)<input class="input" type="datetime-local" name="startsAt" value="${localDate(o.startsAt)}"></label><label class="field">النهاية (توقيت هذا الجهاز)<input class="input" type="datetime-local" name="endsAt" value="${localDate(o.endsAt)}"></label><p class="muted">الخصم يُحسب بالسيرفر وينتهي في الموعد المحدد.</p></section><section class="panel"><h2>كوبون الخصم</h2><label class="check"><input type="checkbox" name="couponEnabled" ${cp.enabled ? "checked" : ""}>تفعيل الكوبون</label><label class="field">الكود (حروف إنجليزية كبيرة وأرقام)<input class="input" name="couponCode" value="${esc(cp.code)}" maxlength="24"></label><label class="field">الخصم ٪<input class="input" type="number" name="couponPercent" value="${cp.percent}" min="0" max="80" required></label><label class="field">أقل قيمة طلب (ر.س)<input class="input" type="number" name="couponMinimum" value="${cp.minSubtotal}" min="0" max="10000" required></label><label class="field">انتهاء الكوبون<input class="input" type="datetime-local" name="couponEnds" value="${localDate(cp.endsAt)}"></label><p class="muted">لا يجمع الكوبون مع عرض نشط. يمكن استخدامه في أكثر من طلب.</p><hr class="divider"><h2>برنامج الولاء</h2><label class="check"><input type="checkbox" name="loyaltyEnabled" ${l.enabled ? "checked" : ""}>تشغيل برنامج الولاء</label><label class="field">عدد الطلبات للمكافأة<input class="input" type="number" name="goal" min="2" max="100" value="${l.goal}" required></label><label class="field">وصف المكافأة<input class="input" name="reward" maxlength="200" value="${esc(l.reward)}" placeholder="اكتب مكافأة يعتمدها المقهى"></label></section><section class="panel"><h2>النسخ والروابط</h2><p class="sub">نسخة تشمل المنيو والإعدادات والطلبات والتقييمات.</p><button class="btn outline full" type="button" id="backup">تنزيل نسخة JSON</button><a class="btn outline full" style="margin-top:10px" href="api/admin/database" download="luxury-crop.sqlite">تنزيل قاعدة البيانات للاستعادة</a><hr class="divider"><label class="field">رابط المنيو لرمز QR<input id="qrUrl" class="input" type="url" value="${esc(new URL("./", location.href).href)}"></label><label class="field">رقم الطاولة (اختياري)<input id="qrTable" class="input" type="number" min="1" max="${s.tables}"></label><button type="button" class="btn secondary full" id="makeQr">تجهيز رمز الطاولة</button></section></div></form><section class="panel" style="margin-top:20px"><h2>حاسبة أثر المبيعات</h2><p class="sub">تقدير تخطيطي قابل للتعديل، وليس نتيجة مضمونة.</p><div class="split"><label class="field">طلبات يومية<input class="input" id="roiOrders" type="number" min="0" value="0"></label><label class="field">زيادة متوقعة في متوسط الطلب (ر.س)<input class="input" id="roiUplift" type="number" min="0" step=".1" value="0"></label></div><p>زيادة مبيعات شهرية متوقعة: <strong id="roiResult">٠ ر.س</strong></p></section>`;
}
function localDate(v) {
  if (!v) return "";
  const d = new Date(v);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
}
async function saveMenu(next) {
  const r = await post(
    "api/admin/menu",
    { menu: next, revision: S.revision },
    "PUT",
  );
  S.menu = r.menu;
  S.revision = r.revision;
  dirty = false;
  toast("تم حفظ المنيو لكل الأجهزة");
  draw();
}
function editItem(id) {
  const i = items().find((i) => i.id === id);
  editing = {
    type: "item",
    id: id || crypto.randomUUID(),
    category: i?.category.id || cat,
    isNew: !i,
  };
  const v = i || {
    name_ar: "",
    name_en: "",
    desc_ar: "",
    desc_en: "",
    price: 0,
    available: true,
    allergens: [],
    nutrition_estimated: true,
    allergens_confirmed: false,
    kcal: null,
    caffeine_mg: null,
    image: null,
  };
  dialog(
    `<h2>${i ? "تعديل الصنف" : "صنف جديد"}</h2><form id="itemForm"><div class="split"><label class="field">الاسم بالعربي<input class="input" name="name_ar" value="${esc(v.name_ar)}" required maxlength="100"></label><label class="field">الاسم بالإنجليزي<input class="input" name="name_en" value="${esc(v.name_en)}" maxlength="100"></label></div><label class="field">الوصف بالعربي<textarea class="input" name="desc_ar" maxlength="1200">${esc(v.desc_ar)}</textarea></label><label class="field">الوصف بالإنجليزي<textarea class="input" name="desc_en" maxlength="1200">${esc(v.desc_en)}</textarea></label><div class="split"><label class="field">السعر (ر.س)<input class="input" name="price" type="number" min="0" max="10000" step=".01" value="${v.price}" required></label><label class="field">القسم<select class="input" name="category">${S.menu.categories.map((c) => `<option value="${c.id}" ${c.id === editing.category ? "selected" : ""}>${esc(c.name_ar)}</option>`).join("")}</select></label></div><label class="field">مسار الصورة داخل assets<input class="input" name="image" value="${esc(v.image || "")}" placeholder="assets/products/item.webp"></label><label class="check"><input type="checkbox" name="available" ${v.available ? "checked" : ""}>متاح للطلب</label><h3>بيانات التغذية</h3><p class="muted">اترك المعلومة غير المعروفة فارغة. لن تظهر القيم قبل اعتمادها.</p><div class="split"><label class="field">السعرات<input class="input" name="kcal" type="number" min="0" max="10000" value="${v.kcal ?? ""}"></label><label class="field">الكافيين (mg)<input class="input" name="caffeine_mg" type="number" min="0" max="2000" value="${v.caffeine_mg ?? ""}"></label></div><label class="check"><input type="checkbox" name="nutritionConfirmed" ${!v.nutrition_estimated ? "checked" : ""}>تم اعتماد بيانات التغذية من المقهى</label><div class="split">${S.menu.allergen_ref.map((a) => `<label class="check"><input type="checkbox" name="allergen" value="${a.key}" ${v.allergens.includes(a.key) ? "checked" : ""}>${esc(a.ar)}</label>`).join("")}</div><label class="check"><input type="checkbox" name="allergens_confirmed" ${v.allergens_confirmed ? "checked" : ""}>تم اعتماد مسببات الحساسية</label><label class="check"><input type="checkbox" name="high_sodium" ${v.high_sodium ? "checked" : ""}>صوديوم مرتفع</label><div class="row"><button class="btn red full" type="submit">حفظ الصنف</button>${i ? '<button class="btn outline" type="button" id="deleteItem">حذف</button>' : ""}</div></form>`,
  );
}
function editCategory(isNew) {
  const c = isNew
    ? { name_ar: "", name_en: "", sub_ar: "", sub_en: "" }
    : S.menu.categories.find((c) => c.id === cat);
  editing = { type: "category", isNew, id: isNew ? crypto.randomUUID() : cat };
  dialog(
    `<h2>${isNew ? "قسم جديد" : "تعديل القسم"}</h2><form id="categoryForm">${[
      ["name_ar", "اسم القسم بالعربي"],
      ["name_en", "اسم القسم بالإنجليزي"],
      ["sub_ar", "وصف بالعربي"],
      ["sub_en", "وصف بالإنجليزي"],
    ]
      .map(
        ([key, label]) =>
          `<label class="field">${label}<input class="input" name="${key}" value="${esc(c[key])}" ${key === "name_ar" ? "required" : ""} maxlength="200"></label>`,
      )
      .join(
        "",
      )}<button class="btn red full" type="submit">حفظ القسم</button>${!isNew ? '<button class="btn outline full" id="deleteCategory" type="button" style="margin-top:10px">حذف القسم الفارغ</button>' : ""}</form>`,
  );
}
function receipt(id) {
  const o = S.orders.find((o) => o.id === id);
  dialog(
    `<div id="receipt"><img class="logo" src="assets/logo.png" alt="Luxury Crop"><h2 style="margin-top:20px">طلب #${o.number}</h2><p class="muted">${date(o.createdAt)} · ${states[o.status]}</p><div class="notice">ملخص طلب · الدفع عند الاستلام</div><p>${esc(modes[o.mode])}${o.table ? " · طاولة " + o.table : ""}</p><p>${esc(o.name)} ${esc(o.phone)}</p>${o.address ? `<p>${esc(o.address)}</p>` : ""}${o.lines.map((l) => `<div class="receipt-line"><div>${l.quantity} × ${esc(l.name)}<br><small>${esc(l.categoryName)} ${esc(l.note)} ${esc(optionName(l.milk))} ${esc(optionName(l.extra))}</small></div><strong>${cash(l.total)}</strong></div>`).join("")}<p>${esc(o.note)}</p><div class="receipt-line"><span>رسوم التوصيل</span><b>${cash(o.fee)}</b></div>${o.discount ? `<div class="receipt-line"><span>خصم الكوبون</span><b>− ${cash(o.discount)}</b></div>` : ""}<div class="receipt-line"><b>الإجمالي</b><b>${cash(o.total)}</b></div></div><button class="btn full red" id="printReceipt" style="margin-top:20px">طباعة ملخص الطلب</button>`,
  );
}
const csv = (rows) =>
  "\uFEFF" +
  rows
    .map((r) =>
      r
        .map(
          (v) =>
            '"' +
            String(v ?? "")
              .replace(/^[=+@-]/, "'$&")
              .replace(/"/g, '""') +
            '"',
        )
        .join(","),
    )
    .join("\r\n");
$("#loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const b = e.target.querySelector("button");
  b.disabled = true;
  $("#loginError").textContent = "";
  try {
    await post("api/login", { password: $("#password").value });
    $("#password").value = "";
    await refresh();
  } catch (err) {
    $("#loginError").textContent = err.message || "تعذر الاتصال بالسيرفر";
  } finally {
    b.disabled = false;
  }
});
$("#logout").addEventListener("click", async () => {
  if (!discardChanges()) return;
  try {
    await post("api/logout", {});
    sessionEpoch++;
    dirty = false;
    closeDialog();
    S = null;
    $("#dashboard").hidden = true;
    $("#loginScreen").hidden = false;
  } catch {
    toast("تعذر تسجيل الخروج. تحقق من الاتصال وحاول مجددًا.");
  }
});
$("#sidebarToggle").addEventListener("click", () =>
  $("#sidebar").classList.toggle("open"),
);
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") $("#sidebar").classList.remove("open");
});
document.addEventListener("click", (e) => {
  if (!e.target.closest("#sidebar, #sidebarToggle"))
    $("#sidebar").classList.remove("open");
});
const manualRefresh = () => {
  if (discardChanges()) {
    dirty = false;
    closeDialog();
    refresh();
  }
};
$("#refresh").addEventListener("click", manualRefresh);
$("#period").addEventListener("change", () => {
  if (["home", "orders"].includes(page)) refresh();
});
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  try {
    if (d.page) {
      go(d.page);
      return;
    }
    if (d.cat) {
      if (!discardChanges()) return;
      dirty = false;
      cat = d.cat;
      query = "";
      draw();
      return;
    }
    if (d.edit) {
      editItem(d.edit);
      return;
    }
    if (d.receipt) {
      receipt(d.receipt);
      return;
    }
    if (d.redeem) {
      if (confirm("تأكيد تسليم المكافأة للعميل؟ سيتم خصم الأختام المستخدمة.")) {
        await post("api/admin/redeem", { phone: d.redeem });
        await refresh();
        toast("تم تسجيل تسليم المكافأة");
      }
      return;
    }
    if (d.status) {
      if (
        d.status === "cancelled" &&
        !confirm("إلغاء هذا الطلب؟ لن يحتسب في المبيعات.")
      )
        return;
      const buttons = b.closest(".order-card").querySelectorAll("button");
      buttons.forEach((el) => (el.disabled = true));
      busy = true;
      try {
        await post(`api/admin/order/${d.order}`, { status: d.status }, "PATCH");
        await refresh();
      } finally {
        buttons.forEach((el) => (el.disabled = false));
        busy = false;
      }
      return;
    }
    if (d.toggle) {
      b.disabled = true;
      const next = structuredClone(S.menu);
      for (const c of next.categories) {
        const i = c.items.find((i) => i.id === d.toggle);
        if (i) i.available = !i.available;
      }
      await saveMenu(next);
      return;
    }
    if (d.up) {
      const next = structuredClone(S.menu),
        c = next.categories.find((c) => c.id === cat),
        idx = c.items.findIndex((i) => i.id === d.up);
      if (idx > 0) {
        [c.items[idx - 1], c.items[idx]] = [c.items[idx], c.items[idx - 1]];
        await saveMenu(next);
      }
      return;
    }
    switch (b.id) {
      case "newItem":
        editItem();
        break;
      case "newCategory":
        editCategory(true);
        break;
      case "editCategory":
        editCategory(false);
        break;
      case "moveCategory": {
        const next = structuredClone(S.menu),
          idx = next.categories.findIndex((c) => c.id === cat);
        if (idx > 0) {
          [next.categories[idx - 1], next.categories[idx]] = [
            next.categories[idx],
            next.categories[idx - 1],
          ];
          await saveMenu(next);
        }
        break;
      }
      case "deleteItem":
        if (confirm("حذف الصنف من المنيو؟ الطلبات القديمة ستبقى محفوظة.")) {
          const next = structuredClone(S.menu);
          next.categories.forEach(
            (c) => (c.items = c.items.filter((i) => i.id !== editing.id)),
          );
          await saveMenu(next);
          closeDialog();
        }
        break;
      case "deleteCategory": {
        const c = S.menu.categories.find((c) => c.id === editing.id);
        if (c.items.length) {
          toast("انقل الأصناف إلى قسم آخر أولًا");
          break;
        }
        if (S.menu.categories.length === 1) {
          toast("يجب الاحتفاظ بقسم واحد");
          break;
        }
        if (confirm("حذف القسم الفارغ؟")) {
          const next = structuredClone(S.menu);
          next.categories = next.categories.filter((c) => c.id !== editing.id);
          await saveMenu(next);
          closeDialog();
        }
        break;
      }
      case "exportMenu":
        download("luxury-crop-menu.json", JSON.stringify(S.menu, null, 2));
        break;
      case "backup": {
        const data = await api("api/admin/backup");
        download(
          "luxury-crop-backup-" +
            new Date().toISOString().slice(0, 10) +
            ".json",
          JSON.stringify(data, null, 2),
        );
        break;
      }
      case "exportCustomers":
        download(
          "luxury-crop-customers.csv",
          csv([
            ["الاسم", "الجوال", "عدد الطلبات", "الإنفاق ر.س", "موافقة تسويقية"],
            ...customerRows().map((c) => [
              c.name,
              c.phone,
              c.count,
              c.spent / 100,
              c.consent ? "نعم" : "لا",
            ]),
          ]),
          "text/csv;charset=utf-8",
        );
        break;
      case "exportOrders":
        download(
          "luxury-crop-orders.csv",
          csv([
            ["الطلب", "الحالة", "التاريخ", "النوع", "الإجمالي ر.س"],
            ...S.orders.map((o) => [
              o.number,
              states[o.status],
              date(o.createdAt),
              modes[o.mode],
              o.total / 100,
            ]),
          ]),
          "text/csv;charset=utf-8",
        );
        break;
      case "printReceipt":
        window.print();
        break;
      case "makeQr": {
        const url = new URL($("#qrUrl").value);
        if (!["http:", "https:"].includes(url.protocol))
          throw Error("رابط غير صحيح");
        const tableValue = $("#qrTable").value;
        const table = tableValue === "" ? null : Number(tableValue);
        if (table !== null) {
          if (
            !Number.isInteger(table) ||
            table < 1 ||
            table > S.settings.tables
          )
            throw Error("رقم الطاولة غير صحيح");
          url.searchParams.set("table", table);
        } else url.searchParams.delete("table");
        const qr = await fetch(
          "api/admin/qr?url=" + encodeURIComponent(url.href),
        );
        if (!qr.ok) throw Error("تعذر تجهيز الرمز");
        const svg = await qr.text();
        const blob = URL.createObjectURL(
          new Blob([svg], { type: "image/svg+xml" }),
        );
        dialog(
          `<h2>رمز ${table ? "طاولة " + table : "المنيو"}</h2><div class="qr-view"><img src="${blob}" alt="QR"></div><p class="muted">${esc(url.href)}</p><div class="notice">الرابط المحلي يعمل على هذا الجهاز فقط. للطاولات استخدم رابط السيرفر العام.</div><a class="btn red full" href="${blob}" download="luxury-crop-table-${table || "menu"}.svg">تنزيل الرمز SVG</a>`,
        );
        break;
      }
    }
  } catch (err) {
    toast(saveError(err));
    b.disabled = false;
  }
});
document.addEventListener("submit", async (e) => {
  if (!["itemForm", "categoryForm", "settingsForm"].includes(e.target.id))
    return;
  e.preventDefault();
  if (busy) return;
  busy = true;
  const form = e.target,
    b = form.querySelector("[type=submit]");
  b.disabled = true;
  try {
    const f = new FormData(form),
      v = Object.fromEntries(f);
    if (form.id === "itemForm") {
      const next = structuredClone(S.menu);
      const old = items().find((i) => i.id === editing.id) || {};
      const item = {
        ...old,
        id: editing.id,
        name_ar: v.name_ar,
        name_en: v.name_en,
        desc_ar: v.desc_ar,
        desc_en: v.desc_en,
        price: Number(v.price),
        image: v.image || null,
        available: f.has("available"),
        allergens: f.getAll("allergen"),
        allergens_confirmed: f.has("allergens_confirmed"),
        nutrition_estimated: !f.has("nutritionConfirmed"),
        high_sodium: f.has("high_sodium"),
        kcal: v.kcal === "" ? null : Number(v.kcal),
        caffeine_mg: v.caffeine_mg === "" ? null : Number(v.caffeine_mg),
        currency: "SAR",
      };
      delete item.category;
      const original = next.categories.find((c) => c.id === editing.category),
        position = original.items.findIndex((i) => i.id === editing.id);
      next.categories.forEach(
        (c) => (c.items = c.items.filter((i) => i.id !== editing.id)),
      );
      const target = next.categories.find((c) => c.id === v.category);
      target.items.splice(
        v.category === editing.category && position >= 0
          ? position
          : target.items.length,
        0,
        item,
      );
      await saveMenu(next);
      closeDialog();
    } else if (form.id === "categoryForm") {
      const next = structuredClone(S.menu);
      if (editing.isNew) {
        next.categories.push({
          id: editing.id,
          slug: editing.id,
          ...v,
          items: [],
        });
        cat = editing.id;
      } else
        Object.assign(
          next.categories.find((c) => c.id === editing.id),
          v,
        );
      await saveMenu(next);
      closeDialog();
    } else {
      const settings = {
        acceptingOrders: f.has("acceptingOrders"),
        tables: Number(v.tables),
        modes: f.getAll("mode"),
        deliveryFee: Number(v.deliveryFee),
        whatsapp: v.whatsapp,
        offer: {
          enabled: f.has("offerEnabled"),
          title: v.offerTitle,
          percent: Number(v.percent),
          category: v.offerCategory,
          startsAt: v.startsAt ? new Date(v.startsAt).toISOString() : "",
          endsAt: v.endsAt ? new Date(v.endsAt).toISOString() : "",
        },
        coupon: {
          enabled: f.has("couponEnabled"),
          code: v.couponCode.trim().toUpperCase(),
          percent: Number(v.couponPercent),
          minSubtotal: Number(v.couponMinimum),
          endsAt: v.couponEnds ? new Date(v.couponEnds).toISOString() : "",
        },
        loyalty: {
          enabled: f.has("loyaltyEnabled"),
          goal: Number(v.goal),
          reward: v.reward,
        },
      };
      const r = await post(
        "api/admin/settings",
        { settings, revision: S.revision },
        "PUT",
      );
      S.settings = r.settings;
      S.revision = r.revision;
      dirty = false;
      toast("تم حفظ الإعدادات");
      draw();
    }
  } catch (err) {
    toast(saveError(err));
  } finally {
    busy = false;
    b.disabled = false;
  }
});
document.addEventListener("input", (e) => {
  if (
    e.target.closest("#settingsForm, #itemForm, #categoryForm") &&
    !["qrUrl", "qrTable"].includes(e.target.id)
  )
    dirty = true;
  if (["orderSearch", "menuSearch"].includes(e.target.id)) {
    query = e.target.value;
    const id = e.target.id,
      start = e.target.selectionStart;
    draw();
    $("#" + id).focus();
    $("#" + id).setSelectionRange(start, start);
  }
  if (["roiOrders", "roiUplift"].includes(e.target.id))
    $("#roiResult").innerHTML = cash(
      Math.max(0, Number($("#roiOrders").value) || 0) *
        Math.max(0, Number($("#roiUplift").value) || 0) *
        30 *
        100,
    );
});
document.addEventListener("change", async (e) => {
  if (e.target.id === "importMenu" && e.target.files[0]) {
    try {
      const file = e.target.files[0];
      if (file.size > 2 * 1024 * 1024) throw Error("الملف أكبر من ٢ ميجابايت");
      const next = JSON.parse(await file.text());
      if (confirm("استبدال المنيو بالملف المستورد؟ يُفضّل تنزيل نسخة أولًا."))
        await saveMenu(next);
    } catch (err) {
      toast(err.message || "ملف غير صالح");
    }
  }
});
setInterval(() => {
  if (
    S &&
    !document.hidden &&
    !$("#dialog").open &&
    !busy &&
    !refreshing &&
    ["home", "orders"].includes(page) &&
    !query
  )
    refresh();
}, 10000);
refresh();

window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
const confirmEditorClose = () =>
  !$("#dialog").querySelector("#itemForm, #categoryForm") || discardChanges();
document.addEventListener(
  "click",
  (e) => {
    if (e.target.closest("[data-close]") && !confirmEditorClose()) {
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  },
  true,
);
$("#dialog").addEventListener("cancel", (e) => {
  if (!confirmEditorClose()) e.preventDefault();
});
$("#dialog").addEventListener("close", () => {
  if ($("#dialog").querySelector("#itemForm, #categoryForm")) dirty = false;
});
