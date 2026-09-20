/* ============================================================
   أريبْ — واجهة العميل (منيو + سيستم طلبات)
   نفس روح منيو أريب الأول: سبلاش، بارالاكس، جلايدر، ريفيل، ريبل
   ============================================================ */
(function (w, d) {
  "use strict";

  var M = w.MENU, S = w.SALES, F = w.NS;
  var CUR = M.brand.currency || "ر.س";
  var $ = function (s) { return d.querySelector(s); };
  var $$ = function (s) { return [].slice.call(d.querySelectorAll(s)); };
  var esc = function (s) { return F.esc(s); };

  var cart = [], sel = null, offer = null, mode = null, fee = 0, stars = 0;
  var LOW_POWER = !!(
    matchMedia("(prefers-reduced-motion: reduce)").matches ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
    (navigator.deviceMemory && navigator.deviceMemory <= 4)
  );
  var IMAGE_MAP = {};
  (function indexImages() {
    var keys = [];
    M.sections.forEach(function (section) {
      (section.cats || []).forEach(function (cat) {
        (cat.items || []).forEach(function (item) { keys.push(item.k); });
      });
    });
    keys.forEach(function (key, index) {
      IMAGE_MAP[key] = {
        src: "assets/img/atlases/products-" + String(Math.floor(index / 6) + 1).padStart(2, "0") + ".webp",
        x: -(index % 3) * 100 + "%",
        y: -Math.floor(index % 6 / 3) * 100 + "%"
      };
    });
  })();
  if (LOW_POWER) d.documentElement.classList.add("low-power");

  /* ================= أيقونات ================= */
  var I = {
    hot: '<svg viewBox="0 0 24 24"><path d="M4.5 10.5h11.5v5.2a5.3 5.3 0 0 1-5.3 5.3h-.9a5.3 5.3 0 0 1-5.3-5.3z"/><path d="M16 12h1.5a2.5 2.5 0 0 1 0 5h-1.7"/><path d="M8.3 3.2c-1 1.4 1 2.3 0 3.7M12.2 3.2c-1 1.4 1 2.3 0 3.7"/></svg>',
    cold: '<svg viewBox="0 0 24 24"><path d="M6 8h12l-1.3 12.1a2.1 2.1 0 0 1-2.1 1.9H9.4a2.1 2.1 0 0 1-2.1-1.9z"/><path d="M13.6 8L16.2 2.4"/><rect x="9" y="11.2" width="3" height="3" rx=".7"/><rect x="12.6" y="14.8" width="3" height="3" rx=".7"/></svg>',
    v60: '<svg viewBox="0 0 24 24"><path d="M4.5 4.5h15l-5.2 8.2h-4.6z"/><path d="M9 7.6c2-1.4 4-1.4 6 0"/><path d="M12 15v1.4"/><path d="M12 18.4c1 1.2 1 2.4 0 2.4s-1-1.2 0-2.4z"/></svg>',
    sweet: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6"/><path d="M9.4 9.6h.01M14.2 8.5h.01M10.4 14.3h.01M14.9 13.3h.01M12.3 11.2h.01" stroke-width="2.6"/></svg>',
    dallah: '<svg viewBox="0 0 24 24"><path d="M9.6 20.8h4.8l1.2-3.7c.8-2.4.7-4.3-.4-6.1L16.4 7h-8.8l1.2 4c-1.1 1.8-1.2 3.7-.4 6.1z"/><path d="M9 7c1.4-2.7 4.6-2.7 6 0"/><path d="M12 2.8v1.4"/><path d="M7.6 8.2l-2.4 3c-.6.8-.1 1.7.9 1.5l1.7-.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" class="ic"><circle cx="11" cy="11" r="6.6"/><path d="M15.8 15.8L21 21"/></svg>'
  };
  var ic = function (p) { return '<svg viewBox="0 0 24 24" class="ic">' + p + '</svg>'; };
  var IC = {
    plus: ic('<path d="M12 5v14M5 12h14"/>'),
    minus: ic('<path d="M5 12h14"/>'),
    check: ic('<path d="M4.5 12.5l5 5L19.5 7"/>'),
    x: ic('<path d="M6 6l12 12M18 6L6 18"/>'),
    flame: ic('<path d="M12 3c3.4 3.4 5.6 5.8 5.6 9.4A5.6 5.6 0 0 1 12 18a5.6 5.6 0 0 1-5.6-5.6C6.4 8.8 8.6 6.4 12 3z"/>'),
    hand: ic('<path d="M7 11V5.6a1.6 1.6 0 0 1 3.2 0V11"/><path d="M10.2 10.4V4.4a1.6 1.6 0 0 1 3.2 0V11"/><path d="M13.4 11V6.2a1.6 1.6 0 0 1 3.2 0v7.6c0 4-2.4 6.6-5.8 6.6-3 0-4.6-1.8-5.6-4.4l-1-2.6a1.5 1.5 0 0 1 2.5-1.5L8 13.4"/>'),
    spark: ic('<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>'),
    star: ic('<path d="M12 3.6l2.6 5.4 5.9.8-4.3 4.1 1.1 5.9-5.3-2.9-5.3 2.9 1.1-5.9L3.5 9.8l5.9-.8z"/>'),
    cart: ic('<path d="M4 6h2.2l2.1 9.4a2 2 0 0 0 2 1.6h6.6a2 2 0 0 0 2-1.5L20.5 9H7"/><circle cx="10.5" cy="20" r="1.1"/><circle cx="17.5" cy="20" r="1.1"/>'),
    bag: ic('<path d="M6 8h12l1 12H5z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>'),
    table: ic('<path d="M3 8h18"/><path d="M5.5 8l1 12M18.5 8l-1 12"/><path d="M4 5.5h16"/>'),
    car: ic('<path d="M4 16v-3.4l2-4.6h12l2 4.6V16"/><path d="M4 16h16"/><circle cx="8" cy="17.6" r="1.6"/><circle cx="16" cy="17.6" r="1.6"/>'),
    note: ic('<path d="M6 4h9l4 4v12H6z"/><path d="M15 4v4h4"/><path d="M9.5 13h6M9.5 16.5h4"/>'),
    wa: ic('<path d="M20.5 11.6a8.5 8.5 0 0 1-12.6 7.5L3.5 20.5l1.5-4.3A8.5 8.5 0 1 1 20.5 11.6z"/><path d="M9 9.4c.3 3 2.6 5.3 5.6 5.6.7.1 1.3-.5 1.3-1.2v-.6l-1.9-.7-.9 1a6 6 0 0 1-2.6-2.6l1-.9-.7-1.9h-.6c-.7 0-1.3.6-1.2 1.3z"/>'),
    clock: ic('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>'),
    pin: ic('<path d="M12 21s6.5-5.6 6.5-10.2A6.5 6.5 0 0 0 5.5 10.8C5.5 15.4 12 21 12 21z"/><circle cx="12" cy="10.6" r="2.4"/>'),
    phone: ic('<path d="M6.5 3.5h3l1.5 4-2 1.4a12 12 0 0 0 6.1 6.1l1.4-2 4 1.5v3a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>'),
    ig: ic('<rect x="3" y="3" width="18" height="18" rx="5.4"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".9" fill="currentColor" stroke="none"/>'),
    stamp: ic('<path d="M6 20h12"/><path d="M8 17.4h8V15a4 4 0 0 0-1.4-3c-.8-.7-1-1.5-.6-2.5.5-1.3-.4-2.6-2-2.6s-2.5 1.3-2 2.6c.4 1 .2 1.8-.6 2.5A4 4 0 0 0 8 15z"/>'),
    empty: ic('<path d="M4.5 8.5h15l-1.4 11.2a2 2 0 0 1-2 1.8H7.9a2 2 0 0 1-2-1.8z"/><path d="M9 8.5V6.4a3 3 0 0 1 6 0v2.1"/>')
  };
  var SAR = '<svg class="sar" viewBox="0 0 24 24" aria-label="ريال"><path d="M16.8 2.8v10c0 2.9-2.1 4.6-4.8 5l-7 1.2"/><path d="M11.4 5.6v8.6"/><path d="M4.2 10.2l15.6 2.7"/><path d="M4.2 14.6l15.6 2.7"/></svg>';
  var price = function (v, cls) { return '<div class="price' + (cls ? " " + cls : "") + '"><span class="num">' + v + '</span>' + SAR + '</div>'; };

  /* ================= صور ================= */
  function photo(k, cls, alt, inner) {
    inner = inner || "";
    var image = IMAGE_MAP[k];
    if (!image) return '<div class="' + cls + ' noimg">' + inner + '</div>';
    return '<div class="' + cls + '"><span class="atlas-frame" style="--atlas-x:' + image.x + ';--atlas-y:' + image.y + '">' +
      '<img class="atlas-sheet" loading="lazy" decoding="async" width="1200" height="800" src="' + image.src + '" alt="' + esc(alt || "") +
      '" onerror="this.parentNode.parentNode.classList.add(\'noimg\');this.parentNode.remove()"></span>' + inner + '</div>';
  }
  function keyOf(name) { var r = F.byName(name); return r ? r.raw.k : ""; }

  /* ================= تهيئة ================= */
  function init() {
    /* المنيو بيفهرس الأصناف بس — بيانات العرض بتتولّد في اللوحة،
       عشان جوال العميل ما يشيلش ميجات في التخزين ولا يبطّأ أول فتح */
    F.buildIndex();
    theme(F.get(F.K.theme, "light"), true);
    offer = F.offerLive();

    renderPills();
    renderMenu();
    renderFeatured();
    renderCombos();
    renderOffer();
    renderFooter();
    restoreCart();

    F.track("visit", { ref: d.referrer || "" });
    splash(); beans(); scrollFx(); wire();

    F.onMsg(function (m) {
      if (m.type === "control") {
        offer = F.offerLive(); renderOffer(); renderMenu(); renderFeatured(); observeAll();
      }
    });
    setInterval(tickOffer, 1000);
  }

  /* ================= السبلاش ================= */
  function splash() {
    var el = $("#splash"), done = false;
    function bye() {
      if (done) return; done = true;
      el.classList.add("bye");
      d.body.classList.remove("lock");
      setTimeout(function () { d.body.classList.add("go"); }, 30);
      setTimeout(function () { el.remove(); }, 950);
    }
    el.addEventListener("click", bye);
    setTimeout(bye, matchMedia("(prefers-reduced-motion: reduce)").matches ? 250 : 2500);
  }

  /* ================= الثيم ================= */
  function theme(t, silent) {
    var r = d.documentElement;
    if (t === "dark") { r.dataset.theme = "dark"; r.setAttribute("data-t", "dark"); }
    else { delete r.dataset.theme; r.setAttribute("data-t", "light"); }
    $("#moonIco").style.display = t === "dark" ? "none" : "block";
    $("#sunIco").style.display = t === "dark" ? "block" : "none";
    var mt = $("#metaTheme"); if (mt) mt.content = t === "dark" ? "#161009" : "#F2ECDC";
    F.set(F.K.theme, t);
    if (!silent) F.track("theme", { t: t });
  }
  function toggleTheme() {
    var next = d.documentElement.dataset.theme === "dark" ? "light" : "dark";
    if (navigator.vibrate) navigator.vibrate(8);
    var btn = $("#themeBtn");
    if (d.startViewTransition) {
      var r = btn.getBoundingClientRect(),
        x = r.left + r.width / 2, y = r.top + r.height / 2,
        rad = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      var tr = d.startViewTransition(function () { theme(next); });
      tr.ready.then(function () {
        d.documentElement.animate(
          { clipPath: ["circle(0px at " + x + "px " + y + "px)", "circle(" + rad + "px at " + x + "px " + y + "px)"] },
          { duration: 650, easing: "cubic-bezier(.65,0,.35,1)", pseudoElement: "::view-transition-new(root)" });
      });
    } else theme(next);
  }

  /* ================= حبوب البن ================= */
  var beanEls = [];
  function beans() {
    var B = '<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 2.6c4.6 0 7.4 3.8 7.4 9.4s-2.8 9.4-7.4 9.4-7.4-3.8-7.4-9.4S7.4 2.6 12 2.6z"/><path d="M12 2.6c2.8 5.6-2.8 13.2 0 18.8"/></svg>';
    var positions = [[8, "6%"], [78, "12%"], [14, "34%"], [86, "46%"], [6, "64%"], [80, "78%"]];
    if (LOW_POWER) positions = [positions[0], positions[3], positions[5]];
    positions.forEach(function (p, i) {
      var el = d.createElement("div");
      el.className = "bean"; el.style.left = p[0] + "%"; el.style.top = p[1];
      el.style.setProperty("--t", (6 + i * 1.3) + "s");
      el.style.setProperty("--r", (i * 37 % 40 - 20) + "deg");
      el.innerHTML = B; el.dataset.speed = ((i % 3) + 1) * 0.03 * (i % 2 ? 1 : -1);
      d.body.appendChild(el); beanEls.push(el);
    });
  }

  /* ================= العرض ================= */
  function renderOffer() {
    var el = $("#offerBar");
    if (!offer || !offer.active) { el.classList.add("hide"); return; }
    el.classList.remove("hide");
    $("#offT").textContent = offer.title;
    $("#offB").textContent = offer.body;
    tickOffer();
  }
  function tickOffer() {
    if (!offer || !offer.active) return;
    var left = offer.endsAt - Date.now();
    if (left <= 0) { offer = F.offerLive(); renderOffer(); renderMenu(); return; }
    var h = Math.floor(left / 3600000), m = Math.floor(left % 3600000 / 60000), s = Math.floor(left % 60000 / 1000);
    $("#offCd").textContent = (h > 0 ? h + ":" : "") + String(m).padStart(2, "0") + ":" + String(s).padStart(2, "0");
  }
  function discounted(secId, p) {
    return (offer && offer.active && offer.section === secId) ? Math.round(p * (1 - offer.pct / 100)) : p;
  }

  /* ================= الشريط ================= */
  function renderPills() {
    var box = $("#pills");
    M.sections.forEach(function (s) {
      var b = d.createElement("button");
      b.className = "pill"; b.dataset.t = "sec-" + s.id; b.textContent = s.title;
      b.onclick = function () { go(s.id); };
      box.appendChild(b);
    });
  }

  /* ================= الأكثر طلبًا ================= */
  function renderFeatured() {
    if (!$("#featRail")) return;
    var c = F.control();
    var list = (S.badges.hot || []).filter(function (n) {
      return F.byName(n) && c.soldOut.indexOf(n) < 0;
    }).slice(0, 6);
    $("#featRail").innerHTML = list.map(function (n, i) {
      var r = F.byName(n), it = r.raw;
      var base = it.p != null ? it.p : (it.s || [0])[0];
      var p = discounted(r.sec, F.priceOf(n, base));
      return '<article class="fcard" style="--i:' + i + '" data-open="' + esc(n) + '">' +
        photo(it.k, "ph", n, '<span class="rank">' + (i + 1) + '</span>') +
        '<div class="bd"><b>' + esc(n) + '</b><div class="r">' + price(p, "sm") +
        '<button class="plus" data-add="' + esc(n) + '" aria-label="أضف ' + esc(n) + '">' + IC.plus + '</button>' +
        '</div></div></article>';
    }).join("");
  }

  /* ================= الكومبو ================= */
  function renderCombos() {
    $("#comboRail").innerHTML = (S.combos || []).map(function (c, i) {
      var k = keyOf((c.parts || [])[0]);
      return '<article class="ccard" style="--i:' + i + '">' +
        '<span class="save">وفّر ' + (c.was - c.p) + ' ' + CUR + '</span>' +
        photo(k, "ph", c.n) +
        '<div class="bd"><b>' + esc(c.n) + '</b><p>' + esc(c.d) + '</p><div class="r">' +
        '<div><div class="price sm"><span class="num">' + c.p + '</span>' + SAR +
        '<span class="was">' + c.was + '</span></div></div>' +
        '<button class="btn-mini" data-combo="' + c.id + '">' + IC.plus + ' أضفه</button>' +
        '</div></div></article>';
    }).join("");
  }

  /* ================= المنيو ================= */
  function renderMenu() {
    var c = F.control();
    $("#menu").innerHTML = M.sections.map(function (s) {
      var cats = (s.cats || []).map(function (cat) {
        var head = (s.cats.length > 1 || cat.isNew)
          ? '<div class="cat-h">' + esc(cat.title) + (cat.isNew ? ' <span class="tag new">جديد</span>' : "") + '</div>' : "";
        return head + '<div class="grid">' +
          (cat.items || []).map(function (it, i) { return card(it, s, c, i); }).join("") + '</div>';
      }).join("");
      return '<section class="sec" id="sec-' + s.id + '">' +
        '<div class="sec-head"><div class="sec-icon">' + (I[s.icon] || I.hot) + '</div>' +
        '<div><h2 class="sec-title">' + esc(s.title) + '</h2>' +
        '<div class="sec-sub">' + esc(s.desc || "") + '</div></div></div>' +
        '<div class="orn"></div>' + cats + '</section>';
    }).join("");
    observeAll();
  }

  function card(it, s, c, i) {
    var out = c.soldOut.indexOf(it.n) > -1;
    var base = it.p != null ? it.p : (it.s || [0])[0];
    var raw = F.priceOf(it.n, base), p = discounted(s.id, raw);
    var tags = "";
    if (out) tags += '<span class="tag out">خلص</span>';
    else {
      if (it.sig) tags += '<span class="tag sig">توقيع محصول فاخر</span>';
      if (S.badges.hot.indexOf(it.n) > -1) tags += '<span class="tag hot">الأكثر طلبًا</span>';
      else if (S.badges.chef.indexOf(it.n) > -1) tags += '<span class="tag chef">اختيار الباريستا</span>';
    }
    var pz = p !== raw
      ? '<div class="price sm"><s>' + raw + '</s><span class="num">' + p + '</span>' + SAR + '</div>'
      : price(p);
    return '<article class="card' + (out ? " out" : "") + '" style="--i:' + (i % 6) + '" data-open="' + esc(it.n) + '">' +
      photo(it.k, "thumb", it.n) +
      '<div class="txt"><h3>' + esc(it.n) + tags + '</h3>' +
      (it.d ? '<p>' + esc(it.d) + '</p>' : "") + '</div>' +
      '<div class="side">' + pz + (it.s ? '<span class="from">يبدأ من</span>' : "") +
      (out ? "" : '<button class="add" data-add="' + esc(it.n) + '" aria-label="أضف ' + esc(it.n) + '">' + IC.plus + '</button>') +
      '</div></article>';
  }

  /* ================= الفوتر ================= */
  function renderFooter() {
    var b = M.brand, h = "";
    if (b.phone) h += '<a href="tel:' + b.phone + '">' + IC.phone + ' اتصل فينا</a>';
    if (b.maps) h += '<a href="' + b.maps + '" target="_blank" rel="noopener">' + IC.pin + ' الموقع</a>';
    if (b.instagram) h += '<a href="' + b.instagram + '" target="_blank" rel="noopener">' + IC.ig + ' luxurycrop1</a>';
    $("#fLinks").innerHTML = h;
  }

  /* ================= الريفيل + السكرول ================= */
  var cardObs, secObs, railObs, spyObs;
  function observeAll() {
    if (!("IntersectionObserver" in w)) {
      $$(".card").forEach(function (e) { e.classList.add("in"); });
      $$("section.sec,.rail-sec").forEach(function (e) { e.classList.add("seen"); });
      return;
    }
    if (!cardObs) cardObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); cardObs.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -8% 0px", threshold: .05 });
    $$(".card:not(.in)").forEach(function (e) { cardObs.observe(e); });

    if (!secObs) secObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("seen");
        e.target.querySelectorAll(".sec-icon path,.sec-icon circle,.sec-icon rect").forEach(function (p, i) {
          try {
            var L = p.getTotalLength();
            p.style.strokeDasharray = L; p.style.strokeDashoffset = L;
            p.style.transition = "stroke-dashoffset 1s cubic-bezier(.65,0,.35,1) " + (i * 140) + "ms";
            requestAnimationFrame(function () { requestAnimationFrame(function () { p.style.strokeDashoffset = 0; }); });
          } catch (_) { }
        });
        secObs.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -12% 0px" });
    $$("section.sec:not(.seen)").forEach(function (e) { secObs.observe(e); });

    if (!railObs) railObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("seen"); railObs.unobserve(e.target); } });
    }, { rootMargin: "0px 0px -6% 0px" });
    $$(".rail-sec:not(.seen),.end-band:not(.seen)").forEach(function (e) { railObs.observe(e); });

    if (spyObs) spyObs.disconnect();
    spyObs = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) setActive("sec-" + e.target.id.replace("sec-", "")); });
    }, { rootMargin: "-45% 0px -50% 0px" });
    $$("section.sec").forEach(function (e) { spyObs.observe(e); });
  }

  var curPill = "";
  function setActive(id) {
    if (id === curPill) return; curPill = id;
    var pills = $("#pills"), glider = $("#glider");
    $$(".pill").forEach(function (b) {
      var on = b.dataset.t === id;
      b.classList.toggle("on", on);
      if (on) {
        glider.style.width = b.offsetWidth + "px";
        glider.style.left = b.offsetLeft + "px";
        var pr = pills.getBoundingClientRect(), br = b.getBoundingClientRect();
        pills.scrollBy({ left: (br.left + br.width / 2) - (pr.left + pr.width / 2), behavior: "smooth" });
      }
    });
  }

  function scrollFx() {
    var wm = $("#wm"), pg = $("#progress"), top = $("#toTop"), nav = $("#nav"),
      art = $(".hero-art"), ticking = false;
    addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () {
        var y = scrollY, h = d.documentElement.scrollHeight - innerHeight;
        pg.style.transform = "scaleX(" + (h > 0 ? Math.min(1, y / h) : 0) + ")";
        top.classList.toggle("show", y > 600);
        if (!LOW_POWER && y < innerHeight) {
          if (wm) { wm.style.transform = "translateY(" + y * .2 + "px)"; wm.style.opacity = Math.max(0, 1 - y / (innerHeight * .55)); }
          if (art) { art.style.transform = "translateY(" + y * -.06 + "px)"; art.style.opacity = Math.max(0, 1 - y / (innerHeight * .7)); }
        }
        if (!LOW_POWER) beanEls.forEach(function (b) { b.style.transform = "translate3d(0," + y * b.dataset.speed + "px,0)"; });
        ticking = false;
      });
    }, { passive: true });
    new IntersectionObserver(function (e) { nav.classList.toggle("stuck", !e[0].isIntersecting); },
      { rootMargin: "-1px 0px 0px 0px" }).observe($("#hero"));
    setTimeout(function () { setActive("sec-" + M.sections[0].id); }, 120);
    addEventListener("resize", function () { var on = $(".pill.on"); if (on) { curPill = ""; setActive(on.dataset.t); } });
  }

  function go(id) {
    var el = d.getElementById("sec-" + id); if (!el) return;
    closeSearch();
    setTimeout(function () { el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 20);
    F.track("section_view", { sec: id });
  }

  /* ================= البحث ================= */
  function openSearch() {
    var nav = $("#nav");
    nav.classList.add("searching");
    if (!nav.classList.contains("stuck")) scrollTo({ top: nav.offsetTop, behavior: "smooth" });
    setTimeout(function () { $("#q").focus(); }, 140);
  }
  function closeSearch() {
    $("#nav").classList.remove("searching");
    $("#q").value = ""; runSearch("");
  }
  function runSearch(v) {
    var menu = $("#menu"), res = $("#qres"),
      feat = $("#featured"), comb = $("#combos"), off = $("#offerBar");
    v = (v || "").trim();
    if (!v) {
      menu.classList.remove("hide"); if (feat) feat.classList.remove("hide"); if (comb) comb.classList.remove("hide");
      if (offer && offer.active) off.classList.remove("hide");
      res.classList.add("hide"); return;
    }
    menu.classList.add("hide"); if (feat) feat.classList.add("hide"); if (comb) comb.classList.add("hide"); off.classList.add("hide");
    res.classList.remove("hide");
    var c = F.control();
    var hits = F.items().filter(function (r) {
      return r.n.indexOf(v) > -1 || (r.raw.d || "").indexOf(v) > -1 || r.secTitle.indexOf(v) > -1;
    });
    res.innerHTML = '<section class="sec seen"><div class="sec-head">' +
      '<div class="sec-icon">' + I.v60 + '</div><div><h2 class="sec-title">' + hits.length + ' نتيجة</h2>' +
      '<div class="sec-sub">بحث عن «' + esc(v) + '»</div></div></div><div class="orn"></div>' +
      (hits.length
        ? '<div class="grid">' + hits.map(function (r, i) { return card(r.raw, F.section(r.sec), c, i); }).join("") + '</div>'
        : '<div class="empty">' + IC.empty + '<p>ما لقينا شي بهذا الاسم</p></div>') +
      '</section>';
    $$("#qres .card").forEach(function (e) { e.classList.add("in"); });
    if (v.length > 2) F.track("search", { q: v, hits: hits.length });
  }

  /* ================= شيت الصنف ================= */
  function openItem(name) {
    var r = F.byName(name); if (!r) return;
    var c = F.control();
    if (c.soldOut.indexOf(name) > -1) { toast("الصنف هذا خلص حاليًا"); return; }
    var s = F.section(r.sec);
    sel = { rec: r, sec: s, size: 0, qty: 1, addons: [], note: "", sug: null };
    F.track("item_view", { n: name, sec: r.sec, p: r.price });

    var pr = S.pairings[r.sec] || S.pairings._default;
    for (var i = 0; i < pr.length; i++) {
      var g = F.byName(pr[i]);
      if (g && g.n !== r.n && c.soldOut.indexOf(g.n) < 0) { sel.sug = g; break; }
    }
    $("#itemBody").innerHTML = itemSheet();
    openSheet("shItem");
    if (sel.sug) F.track("upsell_shown", { n: name });
  }

  function itemSheet() {
    var r = sel.rec, it = r.raw, s = sel.sec;
    var sizes = s.sizes || ["وسط", "كبير"];
    var addons = S.addons[r.sec] || S.addons._default;
    var base = it.s ? it.s[sel.size] : it.p;
    var unit = discounted(r.sec, F.priceOf(it.n, base));
    var h = "";

    h += photo(it.k, "sh-photo", it.n);
    h += '<div class="sh-top"><div><h3>' + esc(it.n) + '</h3>' +
      '<div class="dsc">' + esc(it.d || s.desc || "") + '</div></div>' + price(unit) + '</div>';

    if (it.s) {
      h += '<div class="sh-sec"><div class="lb">' + IC.cart + 'الحجم</div><div class="seg">' +
        it.s.map(function (p, i) {
          if (p == null) return "";
          return '<button data-size="' + i + '" class="' + (i === sel.size ? "on" : "") + '">' +
            esc(sizes[i] || ("حجم " + (i + 1))) + '<small>' + discounted(r.sec, F.priceOf(it.n, p)) + ' ' + CUR + '</small></button>';
        }).join("") + '</div></div>';
    }

    h += '<div class="sh-sec"><div class="lb">' + IC.plus + 'زده بإضافة</div><div class="adds">' +
      addons.map(function (a, i) {
        var on = sel.addons.indexOf(i) > -1;
        return '<div class="ad' + (on ? " on" : "") + '" data-addon="' + i + '">' +
          '<div class="bx">' + IC.check + '</div><div class="nm">' + esc(a.n) + '</div>' +
          '<div class="pp">+' + a.p + ' ' + CUR + '</div></div>';
      }).join("") + '</div></div>';

    h += '<div class="sh-sec"><div class="lb">' + IC.note + 'ملاحظة للباريستا</div>' +
      '<input class="fld" id="nt" placeholder="مثلاً: بدون سكر" value="' + esc(sel.note) + '"></div>';

    h += '<div class="sh-sec"><div class="lb">' + IC.bag + 'الكمية</div><div class="qty">' +
      '<button data-q="-1">' + IC.minus + '</button><b>' + sel.qty + '</b><button data-q="1">' + IC.plus + '</button></div></div>';

    if (sel.sug) {
      h += '<div class="sug"><div class="t">' + IC.spark + 'الناس تاخذه مع</div><div class="row">' +
        photo(sel.sug.raw.k, "thumb", sel.sug.n) +
        '<div style="flex:1"><b>' + esc(sel.sug.n) + '</b><span>' + esc(sel.sug.raw.d || "") + '</span></div>' +
        '<button class="btn-mini" data-sug="1">' + IC.plus + ' ' + sel.sug.price + ' ' + CUR + '</button></div></div>';
    }

    h += '<div class="cta-wrap"><button class="btn-main" data-act="add">أضف للطلب' +
      '<span style="opacity:.55">·</span>' + lineTotal() + SAR + '</button></div>';
    return h;
  }

  function lineTotal() {
    var r = sel.rec, it = r.raw;
    var base = it.s ? it.s[sel.size] : it.p;
    var p = discounted(r.sec, F.priceOf(it.n, base));
    var addons = S.addons[r.sec] || S.addons._default;
    sel.addons.forEach(function (i) { p += addons[i].p; });
    return p * sel.qty;
  }
  function refreshItem() {
    var nt = $("#nt"); if (nt) sel.note = nt.value;
    $("#itemBody").innerHTML = itemSheet();
  }

  /* ================= السلة ================= */
  function push(line, fromEl) {
    cart.push(line); saveCart(); syncBar(true);
    if (fromEl) fly(fromEl);
    if (navigator.vibrate) navigator.vibrate(9);
  }
  function quickAdd(name, el) {
    var r = F.byName(name); if (!r) return;
    var c = F.control();
    if (c.soldOut.indexOf(name) > -1) { toast("الصنف هذا خلص حاليًا"); return; }
    if (r.raw.s) { openItem(name); return; }               // فيه أحجام → افتح الشيت
    var p = discounted(r.sec, F.priceOf(name, r.raw.p));
    push({ n: name, k: r.raw.k, p: p, q: 1, sec: r.sec }, el);
    F.track("add_cart", { n: name, sec: r.sec, p: p });
    if (el) { el.classList.add("done"); el.innerHTML = IC.check; setTimeout(function () { el.classList.remove("done"); el.innerHTML = IC.plus; }, 900); }
    toast(name + " أُضيف لطلبك");
  }
  function addFromSheet() {
    var r = sel.rec, it = r.raw, s = sel.sec;
    var sizes = s.sizes || ["وسط", "كبير"];
    var base = it.s ? it.s[sel.size] : it.p;
    var p = discounted(r.sec, F.priceOf(it.n, base));
    var nt = $("#nt"); sel.note = nt ? nt.value.trim() : "";
    push({ n: it.n + (it.s ? " (" + sizes[sel.size] + ")" : ""), k: it.k, p: p, q: sel.qty, sec: r.sec, note: sel.note });
    F.track("add_cart", { n: it.n, sec: r.sec, p: p });
    var addons = S.addons[r.sec] || S.addons._default;
    sel.addons.forEach(function (i) {
      cart.push({ n: "إضافة " + addons[i].n, p: addons[i].p, q: sel.qty, sec: r.sec, addon: 1 });
      F.track("addon_add", { n: addons[i].n, p: addons[i].p });
    });
    saveCart(); syncBar(true);
    closeSheet("shItem");
    toast("أُضيف لطلبك");
  }
  function takeSug() {
    if (!sel || !sel.sug) return;
    push({ n: sel.sug.n, k: sel.sug.raw.k, p: sel.sug.price, q: 1, sec: sel.sug.sec, up: 1 });
    F.track("upsell_accept", { n: sel.sug.n, p: sel.sug.price });
    sel.sug = null; refreshItem(); toast("تمام، أضفناه");
  }
  function addCombo(id, el) {
    var c = (S.combos || []).filter(function (x) { return x.id === id; })[0];
    if (!c) return;
    push({ n: "كومبو " + c.n, k: keyOf((c.parts || [])[0]), p: c.p, q: 1, sec: "combo", combo: 1 }, el);
    F.track("add_cart", { n: "كومبو " + c.n, sec: "combo", p: c.p });
    F.track("combo_add", { n: c.n, p: c.p });
    toast("أُضيف الكومبو — وفّرت " + (c.was - c.p) + " " + CUR);
  }
  function saveCart() { F.set(F.K.cart, cart); }
  function restoreCart() { cart = F.get(F.K.cart, []) || []; syncBar(); }
  function sub() { return cart.reduce(function (a, l) { return a + l.p * l.q; }, 0); }
  function syncBar(bump) {
    var n = cart.reduce(function (a, l) { return a + l.q; }, 0);
    $("#barT").textContent = F.money(sub());
    $("#barN").textContent = n;
    var bar = $("#bar");
    bar.classList.toggle("on", n > 0);
    if (bump && n > 0) { bar.classList.remove("bump"); void bar.offsetWidth; bar.classList.add("bump"); }
  }
  /* الصورة تطير للشريط */
  function fly(el) {
    var img = el.closest(".card,.fcard,.ccard");
    img = img && img.querySelector(".atlas-frame,img");
    if (!img) return;
    var r = img.getBoundingClientRect(), bar = $(".bar-in").getBoundingClientRect();
    var c = img.cloneNode(true);
    c.classList.add("fly-copy");
    c.style.cssText += ";position:fixed;z-index:190;border-radius:16px;object-fit:cover;pointer-events:none;" +
      "left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px;height:" + r.height + "px;" +
      "transition:all .7s cubic-bezier(.5,-0.1,.3,1);opacity:.95;transform:none;overflow:hidden";
    d.body.appendChild(c);
    requestAnimationFrame(function () {
      c.style.left = (bar.left + bar.width / 2 - 14) + "px";
      c.style.top = (bar.top + 6) + "px";
      c.style.width = "28px"; c.style.height = "28px";
      c.style.opacity = "0"; c.style.borderRadius = "50%";
    });
    setTimeout(function () { c.remove(); }, 760);
  }

  /* ================= شيت الطلب ================= */
  function openCart() {
    if (!cart.length) { toast("طلبك فاضي — اختر شي أول"); return; }
    mode = null; fee = 0;
    $("#cartBody").innerHTML = cartSheet();
    openSheet("shCart");
    F.track("cart_open", { n: cart.length });
  }
  function cartSheet() {
    var t = sub(), h = '<h3>طلبك</h3><div class="dsc">راجعه قبل ما ترسله</div>';

    h += '<div class="sh-sec">' + cart.map(function (l, i) {
      return '<div class="ln">' + photo(l.k, "thumb", l.n) +
        '<div class="i"><b>' + esc(l.n) + '</b><span>' + l.q + ' × ' + l.p + ' ' + CUR +
        (l.note ? ' · ' + esc(l.note) : "") + '</span></div>' +
        '<div class="p">' + F.money(l.p * l.q) + '</div>' +
        '<button class="x" data-del="' + i + '" aria-label="حذف">' + IC.x + '</button></div>';
    }).join("") + '</div>';

    var miss = (S.badges.profit || []).filter(function (n) {
      return !cart.some(function (l) { return l.n.indexOf(n) > -1; });
    });
    if (miss.length) {
      var g = F.byName(miss[0]);
      if (g) {
        h += '<div class="sug"><div class="t">' + IC.spark + 'آخر فرصة تضيف</div><div class="row">' +
          photo(g.raw.k, "thumb", g.n) +
          '<div style="flex:1"><b>' + esc(g.n) + '</b><span>' + esc(g.raw.d || "") + '</span></div>' +
          '<button class="btn-mini" data-last="' + esc(g.n) + '">' + IC.plus + ' ' + g.price + ' ' + CUR + '</button></div></div>';
        F.track("upsell_shown", { n: g.n, where: "cart" });
      }
    }

    var ICM = [IC.table, IC.bag, IC.car];
    h += '<div class="sh-sec"><div class="lb">' + IC.pin + 'الطلب وين؟</div><div class="seg" id="modes">' +
      S.order.modes.map(function (m, i) {
        return '<button data-mode="' + esc(m) + '" class="' + (i === 0 ? "on" : "") + '">' + (ICM[i] || "") + esc(m) + '</button>';
      }).join("") + '</div></div>';

    h += '<div class="sh-sec" id="tblWrap"><div class="lb">' + IC.table + 'رقم الطاولة</div>' +
      '<input class="fld" id="tbl" type="number" inputmode="numeric" min="1" max="' + S.order.tables + '" placeholder="مثلاً 5"></div>';

    h += '<div class="sh-sec"><div class="lb">' + IC.phone + 'اسمك ورقمك</div>' +
      '<input class="fld" id="cn" placeholder="الاسم" style="margin-bottom:8px">' +
      '<input class="fld" id="cp" type="tel" inputmode="tel" placeholder="05xxxxxxxx"></div>';

    if (S.loyalty.on) {
      var L = F.get(F.K.loy, { n: 0 });
      h += '<div class="sh-sec"><div class="lb">' + IC.stamp + 'كارت الولاء — ' + L.n + '/' + S.loyalty.goal + '</div><div class="stamps">' +
        Array.apply(null, Array(S.loyalty.goal)).map(function (_, i) {
          return '<div class="st' + (i < L.n ? " on" : "") + '">' + (i < L.n ? IC.check : IC.cart) + '</div>';
        }).join("") + '</div><div class="note-l">كمّل ' + S.loyalty.goal + ' طلبات وخذ ' + esc(S.loyalty.reward) + '</div></div>';
    }

    h += '<div class="sh-sec">' +
      '<div class="tot"><span>الأصناف</span><b>' + F.money(t) + SAR + '</b></div>' +
      '<div class="tot hide" id="feeRow"><span>توصيل</span><b>' + S.order.deliveryFee + SAR + '</b></div>' +
      '<div class="tot big"><span>الإجمالي</span><b id="grand">' + F.money(t) + SAR + '</b></div></div>';

    h += '<div class="cta-wrap"><button class="btn-main" data-act="send">' + IC.wa + 'أرسل الطلب على واتساب</button>' +
      '<div class="note-l" style="text-align:center">بينفتح واتساب والطلب مكتوب — ترسله وخلاص</div></div>';
    return h;
  }
  function setMode(btn) {
    var m = btn.dataset.mode;
    [].forEach.call(btn.parentNode.children, function (b) { b.classList.remove("on"); });
    btn.classList.add("on"); mode = m;
    var isDel = m === "توصيل";
    fee = isDel ? S.order.deliveryFee : 0;
    $("#tblWrap").classList.toggle("hide", m !== "الطاولة");
    $("#feeRow").classList.toggle("hide", !isDel);
    $("#grand").innerHTML = F.money(sub() + fee) + SAR;
  }
  function del(i) {
    cart.splice(i, 1); saveCart(); syncBar();
    if (!cart.length) { closeSheet("shCart"); return; }
    $("#cartBody").innerHTML = cartSheet();
  }
  function lastChance(n) {
    var g = F.byName(n); if (!g) return;
    cart.push({ n: g.n, k: g.raw.k, p: g.price, q: 1, sec: g.sec, up: 1 });
    F.track("upsell_accept", { n: g.n, p: g.price, where: "cart" });
    saveCart(); syncBar(true);
    $("#cartBody").innerHTML = cartSheet();
    toast("أضفناه");
  }

  /* ================= إرسال ================= */
  function send() {
    var t = sub(), m = mode || S.order.modes[0];
    var tbl = $("#tbl") ? $("#tbl").value : "";
    var nm = $("#cn") ? $("#cn").value.trim() : "";
    var ph = $("#cp") ? $("#cp").value.trim() : "";
    if (m === "الطاولة" && !tbl) { toast("اكتب رقم الطاولة"); $("#tbl").focus(); return; }

    var total = t + fee;
    var up = cart.filter(function (l) { return l.up; }).reduce(function (a, l) { return a + l.p * l.q; }, 0);
    var ad = cart.filter(function (l) { return l.addon; }).reduce(function (a, l) { return a + l.p * l.q; }, 0);

    var txt = "طلب جديد من منيو " + M.brand.nameAr + "\n\n";
    cart.forEach(function (l) {
      txt += "• " + l.q + " × " + l.n + " — " + (l.p * l.q) + " " + CUR + (l.note ? " (" + l.note + ")" : "") + "\n";
    });
    txt += "\nالنوع: " + m;
    if (m === "الطاولة" && tbl) txt += "\nطاولة: " + tbl;
    if (fee) txt += "\nتوصيل: " + fee + " " + CUR;
    txt += "\nالإجمالي: " + total + " " + CUR;
    if (nm) txt += "\nالاسم: " + nm;
    if (ph) txt += "\nالجوال: " + ph;

    F.pushOrder({
      id: "R" + (Date.now() % 100000), t: Date.now(), lines: cart.slice(),
      total: total, up: up, addon: ad, mode: m, table: tbl ? +tbl : null, name: nm, phone: ph
    });
    if (ph) F.pushCustomer({ t: Date.now(), phone: ph, name: nm || "—", spent: total });
    if (S.loyalty.on) {
      var L = F.get(F.K.loy, { n: 0 });
      L.n = (L.n + 1) % (S.loyalty.goal + 1);
      F.set(F.K.loy, L);
    }
    w.open("https://wa.me/" + S.order.whatsapp + "?text=" + encodeURIComponent(txt), "_blank");
    cart = []; saveCart(); syncBar(); closeSheet("shCart");
    setTimeout(openReview, 1300);
  }

  /* ================= التقييم ================= */
  function openReview() {
    if (!S.review.on) return;
    stars = 0;
    $("#revBody").innerHTML = '<h3>كيف كانت تجربتك؟</h3><div class="dsc">رأيك يوصل لصاحب المكان على طول</div>' +
      '<div class="stars" id="stRow">' + [1, 2, 3, 4, 5].map(function (i) {
        return '<button data-star="' + i + '" aria-label="' + i + '">' + IC.star + '</button>';
      }).join("") + '</div><div id="revAfter"></div>';
    openSheet("shRev");
  }
  function star(n) {
    stars = n;
    [].forEach.call($("#stRow").children, function (b, i) { b.classList.toggle("on", i < n); });
    if (navigator.vibrate) navigator.vibrate(6);
    $("#revAfter").innerHTML = n >= S.review.threshold
      ? '<div style="text-align:center"><p class="dsc">تسلم! تحب تكتبها في قوقل؟ تفرق معنا وايد</p>' +
        '<div class="cta-wrap"><button class="btn-main" data-act="google">اكتب تقييم في قوقل</button></div></div>'
      : '<div><p class="dsc">آسفين — قل لنا وش صار ونصلحه</p>' +
        '<input class="fld" id="rvNote" placeholder="اكتب المشكلة…" style="margin-top:10px">' +
        '<div class="cta-wrap"><button class="btn-main" data-act="low">أرسلها للإدارة</button></div></div>';
  }
  function toGoogle() {
    F.pushReview({ t: Date.now(), stars: stars, note: "", sent: "google" });
    F.track("review", { stars: stars, sent: "google" });
    w.open(S.review.googleUrl, "_blank");
    closeSheet("shRev"); coupon();
  }
  function sendLow() {
    var n = $("#rvNote") ? $("#rvNote").value.trim() : "";
    F.pushReview({ t: Date.now(), stars: stars, note: n, sent: "owner" });
    F.track("review", { stars: stars, sent: "owner" });
    w.open("https://wa.me/" + S.review.ownerWhatsapp + "?text=" +
      encodeURIComponent("تقييم " + stars + "/5 من منيو " + M.brand.nameAr + ": " + n), "_blank");
    closeSheet("shRev"); coupon();
  }
  function coupon() {
    if (!S.coupon.on) return;
    setTimeout(function () { toast(S.coupon.text + " — كوبون: CROP" + S.coupon.pct); }, 800);
  }

  /* ================= الشيتات ================= */
  function openSheet(id) {
    $("#" + id).classList.add("on");
    d.body.classList.add("sheet-open");
  }
  function closeSheet(id) {
    $("#" + id).classList.remove("on");
    if (!$(".sheet.on")) d.body.classList.remove("sheet-open");
  }
  function toast(m) {
    var el = $("#toast"), t = $("#toastT");
    t.textContent = m; el.classList.add("on");
    clearTimeout(el._x);
    el._x = setTimeout(function () { el.classList.remove("on"); }, 2400);
  }

  /* ================= الأحداث ================= */
  function wire() {
    $("#themeBtn").onclick = toggleTheme;
    $("#searchBtn").onclick = openSearch;
    $("#searchClose").onclick = closeSearch;
    $("#q").addEventListener("input", function (e) { runSearch(e.target.value); });
    $("#toTop").onclick = function () { scrollTo({ top: 0, behavior: "smooth" }); };
    $("#barBtn").onclick = openCart;
    $("#heroOrder").onclick = function () { go(M.sections[0].id); };
    $$(".sheet .bk").forEach(function (b) { b.onclick = function () { closeSheet(b.parentNode.id); }; });
    addEventListener("keydown", function (e) {
      if (e.key === "Escape") { var s = $(".sheet.on"); if (s) closeSheet(s.id); else closeSearch(); }
    });

    d.addEventListener("click", function (e) {
      var el;
      if ((el = e.target.closest("[data-add]"))) { e.stopPropagation(); quickAdd(el.dataset.add, el); return; }
      if ((el = e.target.closest("[data-combo]"))) { addCombo(el.dataset.combo, el); return; }
      if ((el = e.target.closest("[data-open]"))) { openItem(el.dataset.open); return; }
      if ((el = e.target.closest("[data-size]"))) { sel.size = +el.dataset.size; refreshItem(); return; }
      if ((el = e.target.closest("[data-addon]"))) {
        var i = +el.dataset.addon, k = sel.addons.indexOf(i);
        if (k > -1) sel.addons.splice(k, 1); else sel.addons.push(i);
        refreshItem(); return;
      }
      if ((el = e.target.closest("[data-q]"))) { sel.qty = Math.max(1, sel.qty + (+el.dataset.q)); refreshItem(); return; }
      if (e.target.closest("[data-sug]")) { takeSug(); return; }
      if ((el = e.target.closest("[data-del]"))) { del(+el.dataset.del); return; }
      if ((el = e.target.closest("[data-last]"))) { lastChance(el.dataset.last); return; }
      if ((el = e.target.closest("[data-mode]"))) { setMode(el); return; }
      if ((el = e.target.closest("[data-star]"))) { star(+el.dataset.star); return; }
      if ((el = e.target.closest("[data-act]"))) {
        var a = el.dataset.act;
        if (a === "add") addFromSheet();
        else if (a === "send") send();
        else if (a === "google") toGoogle();
        else if (a === "low") sendLow();
      }
    });

    /* الريبل */
    d.addEventListener("pointerdown", function (e) {
      var c = e.target.closest(".card,.fcard,.ccard"); if (!c) return;
      var r = c.getBoundingClientRect(), s = Math.max(r.width, r.height);
      var sp = d.createElement("span");
      sp.className = "ripple";
      sp.style.width = sp.style.height = s + "px";
      sp.style.left = (e.clientX - r.left - s / 2) + "px";
      sp.style.top = (e.clientY - r.top - s / 2) + "px";
      c.appendChild(sp); setTimeout(function () { sp.remove(); }, 620);
    });
  }

  w.App = { open: openItem, cart: openCart };
  d.addEventListener("DOMContentLoaded", init);
})(window, document);
