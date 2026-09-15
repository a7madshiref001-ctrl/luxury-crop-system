import {
  $,
  esc,
  store,
  money,
  normalize,
  api,
  post,
  icon,
  toast,
  dialog,
  closeDialog,
  states,
  modes,
  optionName,
} from "./shared.js";
let M,
  items = [],
  lang = store.get("lang", "ar"),
  category = "all",
  favorites = store.get("favorites", []),
  onlyFavorites = false,
  cart = store.get("cart", []),
  selection = null,
  stars = 0,
  sending = false;
let refreshing = false;
if (!["ar", "en"].includes(lang)) lang = "ar";
if (!Array.isArray(favorites)) favorites = [];
if (!Array.isArray(cart)) cart = [];
let last = store.get("lastOrder", null),
  checkout = store.get("checkout", {
    mode: "table",
    table: new URLSearchParams(location.search).get("table") || "",
    name: "",
    phone: "",
    address: "",
    note: "",
    marketingConsent: false,
  });
if (
  !last ||
  typeof last.id !== "string" ||
  typeof last.token !== "string" ||
  !Array.isArray(last.lines)
)
  last = null;
if (!checkout || typeof checkout !== "object" || Array.isArray(checkout))
  checkout = {
    mode: "table",
    table: "",
    name: "",
    phone: "",
    address: "",
    note: "",
    marketingConsent: false,
  };
const tr = (ar, en) => (lang === "ar" ? ar : en);
for (const key of ["name", "phone", "address", "note", "couponCode"]) {
  if (typeof checkout[key] !== "string") checkout[key] = "";
}
const name = (i) => (lang === "ar" ? i.name_ar : i.name_en || i.name_ar);
const desc = (i) => (lang === "ar" ? i.desc_ar : i.desc_en || i.desc_ar);
const price = (c) => `${money(c, lang)} <small>${tr("ر.س", "SAR")}</small>`;
const activeOffer = () =>
  M.settings?.offer?.enabled &&
  Date.parse(M.settings.offer.startsAt) <= Date.now() &&
  Date.now() < Date.parse(M.settings.offer.endsAt);
const unit = (i) => {
  const o = M.settings?.offer;
  return activeOffer() && (!o.category || o.category === i.category.id)
    ? Math.round((Math.round(i.price * 100) * (100 - o.percent)) / 100)
    : Math.round(i.price * 100);
};
const getItem = (id) => items.find((i) => i.id === id);
const linePrice = (l) => {
  const i = getItem(l.id);
  return i ? unit(i) + (l.extra ? 400 : 0) : 0;
};
const subtotal = () => cart.reduce((s, l) => s + linePrice(l) * l.quantity, 0);
const couponDiscount = () => {
  const c = M.settings.coupon,
    code = (checkout.couponCode || "").trim().toUpperCase();
  return c?.enabled &&
    code === c.code &&
    Date.now() < Date.parse(c.endsAt) &&
    subtotal() >= c.minSubtotal * 100 &&
    !activeOffer()
    ? Math.round((subtotal() * c.percent) / 100)
    : 0;
};
const total = () =>
  subtotal() -
  couponDiscount() +
  (checkout.mode === "delivery" ? Math.round(M.settings.deliveryFee * 100) : 0);
const image = (i) =>
  `<img src="${esc(i.image || "assets/logo.png")}" alt="${esc(name(i))}" width="400" height="400" loading="lazy" decoding="async">`;
const track = (kind, itemId = "") => {
  if (M.server) post("api/events", { kind, itemId }).catch(() => {});
};
function index() {
  items = M.categories.flatMap((c) =>
    c.items.map((i) => ({ ...i, category: c })),
  );
}
async function load() {
  try {
    M = await api("api/menu");
  } catch {
    M = await api("data/menu.json");
    M.server = false;
    M.settings = {
      acceptingOrders: false,
      modes: ["table"],
      tables: 30,
      deliveryFee: 0,
      offer: { enabled: false },
      loyalty: { enabled: false },
    };
  }
  index();
  const pending = store.get("pending", null);
  if (
    pending &&
    Array.isArray(pending.lines) &&
    typeof pending.idempotencyKey === "string"
  ) {
    checkout = { ...checkout, ...pending };
    cart = pending.lines;
  } else if (pending) store.set("pending", null);
  cart = cart.filter(
    (l) =>
      l &&
      getItem(l.id) &&
      Number.isInteger(l.quantity) &&
      l.quantity > 0 &&
      l.quantity <= 20,
  );
  if (!M.settings.modes.includes(checkout.mode))
    checkout.mode = M.settings.modes[0];
  const scannedTable = new URLSearchParams(location.search).get("table");
  if (!pending && scannedTable && M.settings.modes.includes("table")) {
    checkout.mode = "table";
    checkout.table =
      /^\d+$/.test(scannedTable) &&
      Number(scannedTable) >= 1 &&
      Number(scannedTable) <= M.settings.tables
        ? scannedTable
        : "";
    store.set("checkout", checkout);
  }
  renderShell();
  renderProducts();
  saveCart();
  track("visit");
  if (last) $("#track").hidden = false;
  previousOfferState = !!activeOffer();
}
function renderShell() {
  if (!M) return;
  const savedSort = $("#sort").value || "menu";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  $("#lang").textContent = lang === "ar" ? "EN" : "عربي";
  $("#theme").innerHTML = icon("sun");
  $("#track").innerHTML = icon("bag");
  $("#searchIcon").innerHTML = icon("search");
  $("#heroTitle").innerHTML = tr(
    "مزاجك يبدأ<br>بـ<span>محصول فاخر.</span>",
    "Your daily ritual.<br><span>Grown finer.</span>",
  );
  $("#heroDesc").innerHTML = tr(
    "محاصيل نختارها بعناية، وقهوة نحضّرها بشغف.<br>خذ لحظتك، والباقي علينا.",
    "Carefully selected crops. Thoughtfully crafted coffee.<br>Take a moment. Make it yours.",
  );
  $("#explore").innerHTML = tr(
    "اكتشف المنيو <span>↙</span>",
    "Explore the menu <span>↘</span>",
  );
  $("#topNote").textContent = tr(
    "قهوة مختصة · الطائف",
    "Specialty coffee · Taif",
  );
  $("#heroFoot").textContent = tr(
    "من أول رشفة… إلى آخر لقمة.",
    "From the first sip to the last bite.",
  );
  $("#photoCaption").textContent = tr(
    "تفاصيل صغيرة. مذاق يستاهل.",
    "Little details. A taste to remember.",
  );
  $("#menuTitle").textContent = tr("على ذوقك.", "Find your favorite.");
  $("#menuCount").textContent = tr(
    `${items.length} صنف · ${M.categories.length} أقسام`,
    `${items.length} items · ${M.categories.length} categories`,
  );
  $("#search").placeholder = tr(
    "قهوة، ماتشا، أو شيء حلو؟",
    "Coffee, matcha, or something sweet?",
  );
  $("#favFilter").innerHTML = tr("المفضلة", "Favorites") + " ♡";
  $("#sort").innerHTML = [
    ["menu", "ترتيب المنيو", "Menu order"],
    ["low", "السعر: الأقل أولًا", "Price: low to high"],
    ["high", "السعر: الأعلى أولًا", "Price: high to low"],
  ]
    .map(([v, a, e]) => `<option value="${v}">${tr(a, e)}</option>`)
    .join("");
  $("#sort").value = savedSort;
  $("#endTitle").innerHTML = tr(
    "المذاق يحلّي يومك.<br>ورأيك يحلّي تجربتنا.",
    "Good taste makes your day.<br>Your feedback makes ours.",
  );
  $("#reviewBtn").textContent = tr("شاركنا رأيك", "Share your experience");
  $("#menuNote").textContent = tr(
    "الصور مولّدة للتوضيح؛ قد يختلف التقديم الفعلي. معلومات التغذية غير المعتمدة مخفية، واسأل فريقنا عن مسببات الحساسية.",
    "AI-created illustrative photos; actual presentation may vary. Unverified nutrition is hidden. Please ask our team about allergens.",
  );
  $("#footerText").textContent = tr(
    "صُنع للحظاتك الحلوة · محصول فاخر",
    "Made for your good moments · Luxury Crop",
  );
  $("#footerLinks").innerHTML =
    `<a href="${esc(M.brand.maps)}" target="_blank" rel="noopener">${tr("موقعنا في الطائف", "Find us in Taif")} ↗</a><a href="${esc(M.brand.instagram)}" target="_blank" rel="noopener">Instagram ↗</a>`;
  $("#cartLabel").textContent = tr("راجع طلبك", "Review your order");
  renderCategories();
  renderOffer();
  if (!M.settings.acceptingOrders) {
    $("#serviceNotice").hidden = false;
    $("#serviceNotice").textContent = tr(
      M.server
        ? "استقبال الطلبات متوقف مؤقتًا. تصفح المنيو واختَر مفضلاتك."
        : "المنيو متاح للتصفح. اطلب مباشرة من فريق المقهى؛ استقبال الطلبات الإلكتروني غير متصل.",
      "Ordering is currently unavailable. Browse the menu and order with our team.",
    );
  } else $("#serviceNotice").hidden = true;
}
function renderOffer() {
  const el = $("#offer");
  el.hidden = !activeOffer();
  if (activeOffer())
    el.innerHTML = `<strong>${esc(M.settings.offer.title)} · ${M.settings.offer.percent}%</strong><span class="offers-end">${tr("ينتهي", "Ends")} ${new Date(M.settings.offer.endsAt).toLocaleString(lang === "ar" ? "ar-SA" : "en-GB", { timeZone: "Asia/Riyadh", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>`;
}
function renderCategories() {
  $("#categories").innerHTML =
    `<button data-category="all" class="${category === "all" ? "on" : ""}">${tr("الكل", "All")} <small>${items.length}</small></button>` +
    M.categories
      .map(
        (c) =>
          `<button data-category="${esc(c.id)}" class="${category === c.id ? "on" : ""}">${esc(name(c))} <small>${c.items.length}</small></button>`,
      )
      .join("");
}
function renderProducts() {
  if (!M) return;
  const q = normalize($("#search").value),
    sort = $("#sort").value;
  let found = items.filter(
    (i) =>
      (category === "all" || category === i.category.id) &&
      (!onlyFavorites || favorites.includes(i.id)) &&
      (!q ||
        normalize(
          [
            i.name_ar,
            i.name_en,
            i.desc_ar,
            i.desc_en,
            i.category.name_ar,
            i.category.name_en,
          ].join(" "),
        ).includes(q)),
  );
  if (sort !== "menu")
    found.sort((a, b) =>
      sort === "low" ? unit(a) - unit(b) : unit(b) - unit(a),
    );
  const c = M.categories.find((c) => c.id === category);
  $("#categoryTitle").textContent = onlyFavorites
    ? tr("اختياراتك المفضلة", "Your favorites")
    : q
      ? tr("نتائج البحث", "Search results")
      : c
        ? name(c)
        : tr("كل اللي تحبه، هنا.", "All the good things.");
  $("#categoryDesc").textContent = c
    ? lang === "ar"
      ? c.sub_ar
      : c.sub_en
    : tr(
        "اختَر مشروبك، وخلّ للحلا مكان.",
        "Pick your drink. Leave room for dessert.",
      );
  $("#resultCount").textContent = `${found.length} ${tr("صنف", "items")}`;
  $("#products").innerHTML = found.length
    ? found
        .map(
          (i) =>
            `<article class="product ${i.available ? "" : "out"}"><div class="product-photo"><button data-item="${i.id}" aria-label="${esc(name(i))}">${image(i)}</button><button class="icon-btn favorite ${favorites.includes(i.id) ? "on" : ""}" data-favorite="${i.id}" aria-label="${tr("حفظ في المفضلة", "Save favorite")} ${esc(name(i))}" aria-pressed="${favorites.includes(i.id)}">${icon("heart")}</button>${!i.available ? `<span class="badge">${tr("غير متوفر", "Unavailable")}</span>` : ""}</div><div class="product-meta"><span class="category-label">${esc(name(i.category))}</span><h3><button data-item="${i.id}">${esc(name(i))}</button></h3><p class="desc">${esc(desc(i))}</p><div class="product-bottom"><div class="price">${unit(i) !== Math.round(i.price * 100) ? `<s class="strike">${money(i.price * 100, lang)}</s>` : ""}${price(unit(i))}</div><button class="add" data-quick="${i.id}" aria-label="${tr("أضف", "Add")} ${esc(name(i))}" ${!i.available || !M.settings.acceptingOrders ? "disabled" : ""}>${icon("plus")}</button></div></div></article>`,
        )
        .join("")
    : `<div class="empty">${icon("search")}<h3>${tr("ما لقينا أصناف مطابقة", "No matching items")}</h3><button class="btn secondary" data-clear>${tr("عرض كل الأصناف", "Show all items")}</button></div>`;
}
function details(id) {
  const i = getItem(id);
  if (!i) return;
  selection = {
    id,
    quantity: 1,
    note: "",
    extra: "",
    milk: i.id === "170300" ? "cow" : "",
  };
  track("item_view", id);
  const nutrition = !i.nutrition_estimated
    ? `<div class="nutrition">${i.kcal !== null ? `<span class="badge">${i.kcal} ${tr("سعرة", "kcal")}</span>` : ""}${i.caffeine_mg !== null ? `<span class="badge">${i.caffeine_mg} mg ${tr("كافيين", "caffeine")}</span>` : ""}</div>`
    : "";
  const allergens = (i.allergens || [])
    .map((k) => M.allergen_ref.find((a) => a.key === k))
    .filter(Boolean)
    .map((a) => (lang === "ar" ? a.ar : a.en))
    .join("، ");
  const sug = items.find(
    (x) =>
      x.available &&
      x.category.slug === (i.category.slug === "bakery" ? "hot" : "bakery") &&
      !cart.some((l) => l.id === x.id),
  );
  dialog(
    `${image(i).replace("<img", '<img class="detail-image"')}<span class="eyebrow">${esc(name(i.category))}</span><div class="row between"><h2>${esc(name(i))}</h2><div class="price">${price(unit(i))}</div></div><p class="detail-desc">${esc(desc(i))}</p>${nutrition}<div class="notice">${allergens ? tr(i.allergens_confirmed ? "يحتوي على: " : "قد يحتوي على: ", i.allergens_confirmed ? "Contains: " : "May contain: ") + esc(allergens) + ". " : ""}${tr("اسأل فريقنا عن المكونات والتلوث التبادلي قبل الطلب.", "Ask our team about ingredients and cross-contact before ordering.")}</div>${i.id === "170300" ? `<label class="field">${tr("اختيار الحليب", "Milk choice")}<select id="itemMilk" class="input"><option value="cow">${tr("حليب بقري", "Dairy milk")}</option><option value="soy">${tr("صويا", "Soy")}</option><option value="coconut">${tr("كوكنت", "Coconut")}</option><option value="almond">${tr("لوز", "Almond")}</option></select></label><label class="field">${tr("إضافة نكهة", "Flavor")}<select id="itemExtra" class="input"><option value="">${tr("بدون إضافة", "None")}</option><option value="vanilla">${tr("فانيليا +٤ ر.س", "Vanilla +4 SAR")}</option><option value="caramel">${tr("كراميل +٤ ر.س", "Caramel +4 SAR")}</option></select></label>` : ""}<label class="field">${tr("ملاحظة للباريستا", "Note for the barista")}<textarea id="itemNote" class="input" maxlength="250" placeholder="${tr("مثلاً: بدون سكر", "For example: no sugar")}"></textarea></label>${sug ? `<div class="suggestion">${image(sug)}<div><small>${tr("يكمل طلبك", "A good pairing")}</small><b>${esc(name(sug))}</b><small>${price(unit(sug))}</small></div><button class="icon-btn" data-suggest="${sug.id}" aria-label="${tr("أضف الاقتراح", "Add suggestion")}" ${!M.settings.acceptingOrders ? "disabled" : ""}>${icon("plus")}</button></div>` : ""}<div class="dialog-footer row"><div class="quantity"><button data-qty="-1" aria-label="تقليل">${icon("minus")}</button><strong id="itemQty">1</strong><button data-qty="1" aria-label="زيادة">${icon("plus")}</button></div><button class="btn red full" id="addSelected" ${!i.available || !M.settings.acceptingOrders ? "disabled" : ""}>${tr("أضف للطلب", "Add to order")} · <span id="itemTotal">${price(unit(i))}</span></button></div>`,
  );
}
function add(id, detail = {}, suggested = false) {
  if (store.get("pending", null)) {
    toast(
      tr(
        "راجع نتيجة طلبك السابق من السلة أولًا",
        "Resolve your previous order in the bag first",
      ),
    );
    return false;
  }
  const i = getItem(id);
  if (!i?.available || !M.settings.acceptingOrders) return false;
  const quantity = detail.quantity || 1;
  if (
    cart.filter((l) => l.id === id).reduce((n, l) => n + l.quantity, 0) +
      quantity >
    20
  ) {
    toast(tr("الحد الأقصى ٢٠ من الصنف", "Maximum 20 of each item"));
    return false;
  }
  const line = {
    id,
    quantity,
    note: detail.note || "",
    extra: detail.extra || "",
    milk: detail.milk || "",
    suggested,
  };
  const match = cart.find(
    (l) =>
      l.id === id &&
      l.note === line.note &&
      l.extra === line.extra &&
      l.milk === line.milk &&
      l.suggested === suggested,
  );
  if (match) match.quantity += quantity;
  else cart.push(line);
  saveCart(true);
  track("add_cart", id);
  if (suggested) track("suggestion", id);
  toast(tr("أضفناه لطلبك", "Added to your order"));
  return true;
}
function saveCart(changed = false) {
  if (!M) return;
  store.set("cart", cart);
  if (changed) store.set("pending", null);
  $("#cartDock").hidden = !cart.length;
  $("#cartCount").textContent = cart.reduce((n, l) => n + l.quantity, 0);
  $("#cartTotal").innerHTML = price(total());
}
function cartDialog() {
  if (!M) return;
  const unavailable = cart.some((l) => !getItem(l.id)?.available);
  dialog(
    `<h2>${tr("طلبك، على ذوقك.", "Your order, your way.")}</h2><p class="muted">${tr("راجع اختياراتك قبل الإرسال", "Review your choices before sending")}</p>${
      cart.length
        ? cart
            .map((l, k) => {
              const i = getItem(l.id);
              return `<div class="cart-line">${image(i)}<div><h3>${esc(name(i))}</h3><p>${esc(name(i.category))} ${!i.available ? tr("· غير متوفر، احذفه للمتابعة", "· Unavailable, remove to continue") : ""}</p>${l.note ? `<p>${esc(l.note)}</p>` : ""}${l.extra || l.milk ? `<p>${esc(optionName(l.milk, lang))} ${esc(optionName(l.extra, lang))}</p>` : ""}<div class="quantity"><button data-line="${k}" data-delta="-1" aria-label="تقليل">−</button><strong>${l.quantity}</strong><button data-line="${k}" data-delta="1" aria-label="زيادة">+</button></div></div><div><span class="price">${price(linePrice(l) * l.quantity)}</span><button class="icon-btn" data-remove="${k}" aria-label="حذف">${icon("close")}</button></div></div>`;
            })
            .join("")
        : `<div class="empty">${tr("سلتك فاضية… اختَر شيء تحبه.", "Your bag is empty. Find something you love.")}</div>`
    }${cart.length ? `<form id="checkout"><label class="field">${tr("طريقة الاستلام", "Order type")}<select id="orderMode" name="mode" class="input">${M.settings.modes.map((m) => `<option value="${m}" ${checkout.mode === m ? "selected" : ""}>${tr(modes[m], { table: "At your table", takeaway: "Pickup", delivery: "Delivery" }[m])}</option>`).join("")}</select></label><div class="split"><label class="field" ${checkout.mode !== "table" ? "hidden" : ""}>${tr("رقم الطاولة", "Table number")}<input class="input" name="table" type="number" min="1" max="${M.settings.tables}" step="1" value="${esc(checkout.table)}" ${checkout.mode === "table" ? "required" : "disabled"}></label><label class="field">${tr("الاسم", "Name")}<input class="input" name="name" autocomplete="given-name" maxlength="80" value="${esc(checkout.name)}" ${checkout.mode !== "table" ? "required" : ""}></label><label class="field">${tr(checkout.mode === "table" ? "الجوال (اختياري)" : "الجوال", "Mobile" + (checkout.mode === "table" ? " (optional)" : ""))}<input class="input" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="05xxxxxxxx" value="${esc(checkout.phone)}" ${checkout.mode !== "table" ? "required" : ""}></label></div>${checkout.mode === "delivery" ? `<label class="field">${tr("عنوان التوصيل", "Delivery address")}<textarea name="address" class="input" required minlength="8" maxlength="300">${esc(checkout.address)}</textarea></label>` : ""}<label class="field">${tr("ملاحظة على الطلب", "Order note")}<textarea name="note" class="input" maxlength="500">${esc(checkout.note)}</textarea></label><label class="check"><input type="checkbox" name="marketingConsent" ${checkout.marketingConsent ? "checked" : ""}>${tr("أوافق على استقبال عروض المقهى على جوالي (اختياري)", "I agree to receive cafe offers on my phone (optional)")}</label><p class="muted" style="font-size:11px">${tr("نستخدم بياناتك لتنفيذ الطلب. الدفع عند الاستلام.", "We use your details to fulfill your order. Pay on collection.")}</p>${checkout.mode === "delivery" ? `<div class="total-row"><span>${tr("رسوم التوصيل", "Delivery fee")}</span><span>${price(M.settings.deliveryFee * 100)}</span></div>` : ""}<label class="field">${tr("كود خصم (اختياري)", "Discount code (optional)")}<div class="row"><input class="input" name="couponCode" maxlength="24" value="${esc(checkout.couponCode || "")}" dir="ltr"><button class="btn secondary" id="applyCoupon" type="button">${tr("تطبيق", "Apply")}</button></div></label>${couponDiscount() ? `<div class="total-row"><span>${tr("خصم الكوبون", "Coupon discount")}</span><span>− ${price(couponDiscount())}</span></div>` : ""}<div class="total-row grand"><span>${tr("الإجمالي", "Total")}</span><span>${price(total())}</span></div><div class="dialog-footer"><button class="btn red full" type="submit" ${unavailable || !M.settings.acceptingOrders || !M.server ? "disabled" : ""}>${tr("إرسال الطلب للمقهى", "Send order to cafe")} ${icon("arrow")}</button></div></form>` : ""}`,
  );
  const pending = store.get("pending", null);
  if (pending && $("#checkout")) {
    const notice = document.createElement("p");
    notice.className = "notice";
    notice.textContent = tr(
      "لم نتأكد من نتيجة الإرسال السابق. اضغط إعادة التحقق بنفس الطلب لتجنب تكراره قبل تعديل السلة.",
      "The previous submission is unconfirmed. Retry the same order before editing to avoid duplicates.",
    );
    $("#checkout").prepend(notice);
    $("#dialog")
      .querySelectorAll(
        "input, select, textarea, [data-line], [data-remove], #applyCoupon",
      )
      .forEach((el) => (el.disabled = true));
    $("#checkout [type=submit]").textContent = tr(
      "إعادة التحقق من الطلب",
      "Retry this order safely",
    );
  }
}
function readCheckout() {
  const f = $("#checkout");
  if (!f) return;
  if (store.get("pending", null)) return;
  const data = Object.fromEntries(new FormData(f));
  checkout = {
    ...checkout,
    ...data,
    marketingConsent: f.elements.marketingConsent.checked,
  };
  store.set("checkout", checkout);
}
async function submitOrder(e) {
  e.preventDefault();
  if (sending) return;
  readCheckout();
  sending = true;
  const button = e.target.querySelector("[type=submit]");
  button.disabled = true;
  button.textContent = tr("جارٍ إرسال الطلب…", "Sending your order…");
  let pending = store.get("pending", null);
  if (!pending) {
    pending = {
      ...checkout,
      table: checkout.mode === "table" ? Number(checkout.table) : null,
      lines: cart,
      expectedTotal: total(),
      idempotencyKey: crypto.randomUUID(),
    };
    store.set("pending", pending);
  }
  $("#dialog")
    .querySelectorAll("button, input, select, textarea")
    .forEach((el) => (el.disabled = true));
  try {
    last = await post("api/orders", pending);
    store.set("lastOrder", last);
    store.set("pending", null);
    cart = [];
    saveCart();
    $("#track").hidden = false;
    showOrder();
  } catch (err) {
    if (err.status && err.status < 500 && err.status !== 429)
      store.set("pending", null);
    if (err.status === 409) {
      store.set("pending", null);
      await refreshMenu(true);
    }
    toast(
      err.message ||
        tr(
          "تعذر الإرسال. طلبك محفوظ، حاول مجددًا.",
          "Could not send. Your bag is saved; please retry.",
        ),
    );
    if ($("#checkout")) cartDialog();
  } finally {
    sending = false;
  }
}
async function showOrder() {
  if (!last) return;
  renderOrder();
  const view = $("#dialog .tracking");
  try {
    const fresh = await api(
      `api/order/${last.id}?token=${encodeURIComponent(last.token)}`,
    );
    last = { ...last, ...fresh };
    store.set("lastOrder", last);
    if ($("#dialog").open && $("#dialog .tracking") === view) renderOrder();
  } catch {
    if ($("#dialog").open && $("#dialog .tracking") === view) {
      const notice = document.createElement("p");
      notice.className = "notice";
      notice.textContent = tr(
        "تعذر تحديث الحالة؛ المعروض آخر حالة محفوظة.",
        "Could not refresh. Showing the last saved status.",
      );
      view.prepend(notice);
    }
  }
}
function renderOrder() {
  const seq = ["new", "preparing", "ready", "completed"];
  dialog(
    `<div class="tracking"><span class="eyebrow">YOUR LITTLE MOMENT</span><h2>${tr("طلبك عندنا", "We have your order")}</h2><div class="order-number">#${String(last.number).padStart(3, "0")}</div><span class="badge ${last.status === "cancelled" ? "red" : "green"}">${tr(states[last.status], { new: "Received", preparing: "Preparing", ready: "Ready", completed: "Completed", cancelled: "Cancelled" }[last.status])}</span><div class="steps">${seq.map((s, i) => `<div class="step ${seq.indexOf(last.status) >= i ? "done" : ""}">${tr(states[s], { new: "Received", preparing: "Preparing", ready: "Ready", completed: "Completed" }[s])}</div>`).join("")}</div><p class="muted">${tr("الدفع عند الاستلام. تابع حالة طلبك من هنا.", "Pay on collection. Track your order here.")}</p><hr class="divider">${last.lines.map((l) => `<div class="total-row"><span>${l.quantity} × ${esc(lang === "ar" ? l.name : l.name_en || l.name)}</span><span>${price(l.quantity * l.unit)}</span></div>`).join("")}${last.discount ? `<div class="total-row"><span>${tr("خصم الكوبون", "Coupon discount")}</span><span>− ${price(last.discount)}</span></div>` : ""}${last.fee ? `<div class="total-row"><span>${tr("رسوم التوصيل", "Delivery fee")}</span><span>${price(last.fee)}</span></div>` : ""}<div class="total-row grand"><span>${tr("الإجمالي", "Total")}</span><span>${price(last.total)}</span></div><button class="btn secondary full" id="refreshOrder">${tr("تحديث حالة الطلب", "Refresh status")}</button>${M.settings.whatsapp ? `<a class="btn outline full" style="margin-top:10px" href="https://wa.me/${M.settings.whatsapp}?text=${encodeURIComponent("استفسار عن طلب محصول فاخر رقم " + last.number)}" target="_blank" rel="noopener">${tr("استفسار على واتساب", "Ask on WhatsApp")}</a>` : ""}</div>`,
  );
}
function review() {
  if (!M) {
    toast(tr("جارٍ تحميل المنيو…", "Loading the menu…"));
    return;
  }
  stars = 0;
  dialog(
    `<h2>${tr("كيف كانت تجربتك؟", "How was your visit?")}</h2><p class="muted">${tr("كل رأي يهمنا، ويساعدنا نقدم الأفضل.", "Every experience matters. Help us make it better.")}</p><div class="stars">${[1, 2, 3, 4, 5].map((n) => `<button data-star="${n}" aria-label="${n} نجوم" aria-pressed="false">${icon("star")}</button>`).join("")}</div><label class="field">${tr("احكِ لنا", "Tell us more")}<textarea class="input" id="reviewNote" maxlength="1000"></textarea></label><button class="btn full red" id="sendReview" ${M.server ? "" : "disabled"}>${tr("أرسل رأيك للإدارة", "Send feedback")}</button><a class="btn outline full" style="margin-top:12px" href="${esc(M.brand.maps)}" target="_blank" rel="noopener">${tr("تقييمنا على Google", "Review us on Google")} ↗</a>`,
  );
}
async function refreshMenu(force = false) {
  if (refreshing || (sending && !force)) return;
  refreshing = true;
  try {
    const updated = await api("api/menu");
    if (!M.server || updated.revision !== M.revision) {
      const savedSort = $("#sort").value;
      if ($("#checkout")) readCheckout();
      M = updated;
      index();
      if (selection && $("#itemQty")) {
        const selected = getItem(selection.id);
        if (!selected || !selected.available || !M.settings.acceptingOrders) {
          closeDialog();
          selection = null;
          toast(
            tr(
              "تغير توفر الصنف؛ راجع المنيو.",
              "Availability changed; please check the menu.",
            ),
          );
        }
      }
      if (!M.settings.modes.includes(checkout.mode))
        checkout.mode = M.settings.modes[0];
      if (category !== "all" && !M.categories.some((c) => c.id === category))
        category = "all";
      const previousCount = cart.length;
      cart = cart.filter((l) => getItem(l.id));
      if (cart.length !== previousCount)
        toast(
          tr(
            "صنف أُزيل من المنيو؛ حدّثنا السلة.",
            "An item was removed from the menu; your bag is updated.",
          ),
        );
      renderShell();
      $("#sort").value = savedSort;
      renderProducts();
      saveCart();
      if (selection && $("#itemTotal")) {
        const current = getItem(selection.id);
        if (current) {
          $("#itemTotal").innerHTML = price(
            (unit(current) + ($("#itemExtra")?.value ? 400 : 0)) *
              selection.quantity,
          );
          $("#dialog .row.between .price").innerHTML = price(unit(current));
        }
      }
      if ($("#checkout")) {
        cartDialog();
      }
    }
  } catch {
  } finally {
    refreshing = false;
  }
}
$("#lang").addEventListener("click", () => {
  lang = lang === "ar" ? "en" : "ar";
  store.set("lang", lang);
  closeDialog();
  renderShell();
  renderProducts();
  saveCart();
});
document.documentElement.dataset.theme = store.get("theme", "light");
$("#theme").addEventListener("click", () => {
  const t =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = t;
  store.set("theme", t);
});
$("#search").addEventListener("input", renderProducts);
$("#sort").addEventListener("change", renderProducts);
$("#favFilter").addEventListener("click", () => {
  onlyFavorites = !onlyFavorites;
  $("#favFilter").classList.toggle("on", onlyFavorites);
  renderProducts();
});
$("#openCart").addEventListener("click", cartDialog);
$("#track").addEventListener("click", showOrder);
$("#reviewBtn").addEventListener("click", review);
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  const d = b.dataset;
  if (d.category) {
    category = d.category;
    renderCategories();
    renderProducts();
  }
  if (d.item) details(d.item);
  if (d.quick) {
    if (d.quick === "170300") details(d.quick);
    else add(d.quick);
  }
  if (d.favorite) {
    favorites = favorites.includes(d.favorite)
      ? favorites.filter((x) => x !== d.favorite)
      : [...favorites, d.favorite];
    store.set("favorites", favorites);
    renderProducts();
  }
  if ("clear" in d) {
    category = "all";
    onlyFavorites = false;
    $("#favFilter").classList.remove("on");
    $("#search").value = "";
    renderCategories();
    renderProducts();
  }
  if (d.qty) {
    if (!selection || !getItem(selection.id)) return;
    selection.quantity = Math.min(
      20,
      Math.max(1, selection.quantity + Number(d.qty)),
    );
    $("#itemQty").textContent = selection.quantity;
    $("#itemTotal").innerHTML = price(
      (unit(getItem(selection.id)) + ($("#itemExtra")?.value ? 400 : 0)) *
        selection.quantity,
    );
  }
  if (b.id === "addSelected") {
    selection.note = $("#itemNote").value;
    selection.extra = $("#itemExtra")?.value || "";
    selection.milk = $("#itemMilk")?.value || "";
    if (add(selection.id, selection)) closeDialog();
  }
  if (d.suggest) {
    add(d.suggest, {}, true);
    b.disabled = true;
  }
  if ("line" in d) {
    readCheckout();
    const l = cart[Number(d.line)],
      next = l.quantity + Number(d.delta);
    if (
      Number(d.delta) > 0 &&
      cart
        .filter((row) => row.id === l.id)
        .reduce((n, row) => n + row.quantity, 0) >= 20
    ) {
      toast(tr("الحد الأقصى ٢٠ من الصنف", "Maximum 20 of each item"));
      return;
    }
    l.quantity = next;
    if (next === 0) cart.splice(Number(d.line), 1);
    saveCart(true);
    cartDialog();
  }
  if ("remove" in d) {
    readCheckout();
    cart.splice(Number(d.remove), 1);
    saveCart(true);
    cartDialog();
  }
  if (d.star) {
    stars = Number(d.star);
    document.querySelectorAll("[data-star]").forEach((el) => {
      el.classList.toggle("on", Number(el.dataset.star) <= stars);
      el.setAttribute(
        "aria-pressed",
        String(Number(el.dataset.star) === stars),
      );
    });
  }
  if (b.id === "sendReview") {
    if (!stars) {
      toast(tr("اختر التقييم أولًا", "Choose a rating first"));
      return;
    }
    b.disabled = true;
    try {
      await post("api/reviews", { stars, note: $("#reviewNote").value });
      closeDialog();
      toast(tr("شكرًا! رأيك وصل للإدارة", "Thank you! Feedback received"));
    } catch (err) {
      toast(err.message);
      b.disabled = false;
    }
  }
  if (b.id === "refreshOrder") showOrder();
  if (b.id === "applyCoupon") {
    readCheckout();
    if (checkout.couponCode && !couponDiscount())
      toast(
        tr(
          "الكوبون غير صالح أو لا يجمع مع العرض",
          "Invalid coupon, or another offer is active",
        ),
      );
    cartDialog();
    saveCart();
  }
});
document.addEventListener("change", (e) => {
  if (e.target.id === "orderMode") {
    readCheckout();
    store.set("pending", null);
    saveCart();
    cartDialog();
  }
  if (e.target.id === "itemExtra")
    $("#itemTotal").innerHTML = price(
      (unit(getItem(selection.id)) + (e.target.value ? 400 : 0)) *
        selection.quantity,
    );
});
document.addEventListener("input", (e) => {
  if (e.target.closest("#checkout")) {
    readCheckout();
    store.set("pending", null);
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id === "checkout") submitOrder(e);
});
let previousOfferState = false;
let previousCheckoutTotal = null;
setInterval(() => {
  if (M && !document.hidden) {
    refreshMenu();
    if ($("#refreshOrder")) showOrder();
    renderOffer();
    const offerState = !!activeOffer();
    if (offerState !== previousOfferState && !sending) {
      previousOfferState = offerState;
      renderProducts();
      if ($("#checkout")) {
        readCheckout();
        cartDialog();
      }
    }
    saveCart();
    if ($("#checkout") && !sending && total() !== previousCheckoutTotal) {
      readCheckout();
      previousCheckoutTotal = total();
      cartDialog();
    }
  }
}, 15000);
window.addEventListener("online", () => {
  if (M) refreshMenu();
});
document.addEventListener("visibilitychange", () => {
  if (M && !document.hidden) refreshMenu();
});
load().catch(() => {
  $("#products").innerHTML =
    '<div class="empty">تعذر تحميل المنيو. حدّث الصفحة للمحاولة مجددًا.</div>';
});
