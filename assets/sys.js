/* ============================================================
   أريبْ — محرّك السيستم
   تتبّع + تخزين + تجميع أرقام + تحكّم الأونر + بيانات عرض
   شغّال من غير سيرفر (localStorage). لو حطيت endpoint بيبعت هناك كمان.
   ============================================================ */
(function (w) {
  "use strict";

  var K = {
    ev: "areeb.events.v1",
    ord: "areeb.orders.v1",
    rev: "areeb.reviews.v1",
    cus: "areeb.customers.v1",
    loy: "areeb.loyalty.v1",
    ctl: "areeb.control.v1",
    seed: "areeb.seeded.v2",
    cart: "areeb.cart.v1",
    cid: "areeb.cid.v1",
    theme: "areeb.theme.v1",
    demo: "areeb.demomode.v1"
  };

  /* ---------------- تخزين ---------------- */
  function get(k, d) {
    try { var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }
    catch (e) { return d; }
  }
  function set(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  /* ---------------- بث لحظي بين التابات ---------------- */
  var chan = null;
  try { chan = new BroadcastChannel("areebsys"); } catch (e) { }
  function emit(type, data) {
    if (chan) { try { chan.postMessage({ type: type, data: data }); } catch (e) { } }
  }
  function onMsg(fn) {
    if (chan) chan.onmessage = function (e) { fn(e.data || {}); };
    w.addEventListener("storage", function (e) {
      if (e.key === K.ev || e.key === K.ord || e.key === K.ctl) fn({ type: "sync" });
    });
  }

  /* ---------------- فهرسة المنيو ---------------- */
  var ITEMS = [], BYNAME = {}, SECS = {};
  function buildIndex() {
    ITEMS = []; BYNAME = {}; SECS = {};
    (w.MENU.sections || []).forEach(function (s) {
      SECS[s.id] = s;
      (s.cats || []).forEach(function (c) {
        (c.items || []).forEach(function (it) {
          var price = it.p != null ? it.p
            : (it.s || []).filter(function (x) { return x != null; })[0] || 0;
          var rec = {
            n: it.n, price: price, raw: it,
            sec: s.id, secTitle: s.title, secEmoji: s.emoji,
            cat: c.id, catTitle: c.title,
            sized: !!s.sized && !!it.s, isNew: !!c.isNew
          };
          ITEMS.push(rec);
          if (!BYNAME[it.n]) BYNAME[it.n] = rec;
        });
      });
    });
  }

  /* ---------------- عشوائية ثابتة (نفس الأرقام كل مرة) ---------------- */
  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function rngFrom(seed) {
    var s = seed >>> 0;
    return function () { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------------- وزن الشعبية (بيخلق long-tail حقيقي) ---------------- */
  function weightOf(rec) {
    var S = w.SALES.badges;
    var base = (hash(rec.n) % 1000) / 1000;
    var starred = S.hot.indexOf(rec.n) > -1 || S.chef.indexOf(rec.n) > -1 || S.profit.indexOf(rec.n) > -1;
    // الأصناف الميتة: لو محدّدة بالاسم في badges.slow نستخدمها،
    // وإلا بنسيب أضعف شريحة في المنيو تطلع ميتة لوحدها
    if (S.slow && S.slow.length) {
      if (S.slow.indexOf(rec.n) > -1) return 0;
    } else if (!starred && !rec.isNew && base < 0.14) return 0;
    var W = Math.pow(base, 3) * 12 + 0.05;
    if (S.hot.indexOf(rec.n) > -1) W += 9;
    if (S.chef.indexOf(rec.n) > -1) W += 4;
    if (S.profit.indexOf(rec.n) > -1) W += 2;
    if (rec.isNew) W += 1.2;
    if (rec.sec === "hot") W *= 1.6;         // كافيه — القهوة هي الأساس
    if (rec.sec === "cold") W *= 1.3;
    if (rec.sec === "more") W *= 0.55;
    if (rec.price > 18) W *= 0.6;
    return W;
  }
  function pickWeighted(rnd, pool, totalW) {
    var r = rnd() * totalW, acc = 0;
    for (var i = 0; i < pool.length; i++) {
      acc += pool[i].w;
      if (r <= acc) return pool[i];
    }
    return pool[pool.length - 1];
  }

  /* ---------------- توليد بيانات عرض ----------------
     كافيه شغّال: ~٨٥ فتحة منيو/يوم، ~٣٢ طلب/يوم، متوسط فاتورة ~٧٠ ر.س
     (الطلب بييجي من الطاولة كلها مش من شخص، عشان كده الفاتورة كبيرة).
     الأحداث المخزّنة اتقلّلت لأقل حاجة الداشبورد بتقراها — عشان ما نكسرش
     حدّ الـlocalStorage (٥ ميجا) وإحنا بنكبّر الأرقام.
     ------------------------------------------------- */
  var HOUR_W = [.05,.03,.02,.02,.02,.03,.15,.5,1.4,2.6,3.4,3.1,2.6,2.4,2.2,2.3,2.8,3.6,4.4,4.8,4.2,3.1,1.6,.5];
  var DOW_W  = [1, .82, .84, .9, 1.1, 1.5, 1.4];   // الأحد..السبت

  function seedDemo(days) {
    days = days || 62;
    var pool = ITEMS.map(function (r) { return { r: r, w: weightOf(r) }; });
    var totalW = pool.reduce(function (a, b) { return a + b.w; }, 0);
    var rnd = rngFrom(20260722);
    var evs = [], orders = [], reviews = [], customers = [];
    var now = new Date(); now.setMinutes(0, 0, 0);
    var addonsOf = function (sec) { return w.SALES.addons[sec] || w.SALES.addons._default; };
    var NAMES = ["عبدالله","محمد","فهد","خالد","سعود","تركي","بدر","عبدالعزيز","نورة","ريم","سارة","مها","لمى","هيا"];

    // بركة عملاء ثابتة — عشان يبان إن في ناس بترجع تاني (عملاء متكررين)
    var PEOPLE = [];
    for (var pi = 0; pi < 42; pi++) {
      PEOPLE.push({
        name: NAMES[Math.floor(rnd() * NAMES.length)],
        phone: "05" + [0, 3, 5, 6][Math.floor(rnd() * 4)] + String(Math.floor(rnd() * 10000000)).padStart(7, "0")
      });
    }

    var vc = 0;                                        // عدّاد قصير للزيارة
    for (var d = days - 1; d >= 0; d--) {
      var day = new Date(now.getTime() - d * 86400000);
      var dowW = DOW_W[day.getDay()];
      // نمو خفيف مع الوقت (الأسابيع الأخيرة أعلى) — بيدّي إحساس بالاتجاه
      var growth = 0.85 + (days - d) / days * 0.3;
      var visits = Math.round((70 + rnd() * 30) * dowW * growth);

      for (var v = 0; v < visits; v++) {
        var hTot = HOUR_W.reduce(function (a, b) { return a + b; }, 0);
        var hr = 0, acc = 0, rr = rnd() * hTot;
        for (var i = 0; i < 24; i++) { acc += HOUR_W[i]; if (rr <= acc) { hr = i; break; } }
        var t = new Date(day); t.setHours(hr, Math.floor(rnd() * 60), 0, 0);
        if (t > now) continue;
        var ts = t.getTime();
        var vid = "v" + (vc++).toString(36);

        evs.push({ t: ts, e: "visit", vid: vid, demo: 1 });
        if (rnd() < 0.15) continue;                    // فتح وخرج

        var views = 1 + Math.floor(rnd() * 3), seen = [];
        for (var k = 0; k < views; k++) {
          var pick = pickWeighted(rnd, pool, totalW).r;
          seen.push(pick);
          evs.push({ t: ts + k * 40000, e: "item_view", vid: vid, n: pick.n, sec: pick.sec, demo: 1 });
        }

        if (rnd() < 0.55 && seen.length) {
          /* الطلب بييجي من الطاولة كلها: ٢–٥ أصناف + حلا أحيانًا */
          var lines = [], nMain = 2 + Math.floor(rnd() * 4), main = null;
          for (var mi = 0; mi < nMain; mi++) {
            var it = mi === 0 ? seen[Math.floor(rnd() * seen.length)]
                              : pickWeighted(rnd, pool, totalW).r;
            if (mi === 0) main = it;
            var q = (mi === 0 && rnd() < 0.28) ? 2 : 1;
            lines.push({ n: it.n, p: it.price, q: q, sec: it.sec });
          }
          evs.push({ t: ts + 200000, e: "add_cart", vid: vid, demo: 1 });
          evs.push({ t: ts + 205000, e: "upsell_shown", vid: vid, demo: 1 });

          var upRev = 0;
          if (rnd() < 0.46) {
            var pr = (w.SALES.pairings[main.sec] || w.SALES.pairings._default);
            var sug = BYNAME[pr[Math.floor(rnd() * pr.length)]];
            if (sug) {
              lines.push({ n: sug.n, p: sug.price, q: 1, sec: sug.sec, up: 1 });
              upRev += sug.price;
              evs.push({ t: ts + 210000, e: "upsell_accept", vid: vid, demo: 1 });
            }
          }
          var adRev = 0;
          if (rnd() < 0.38) {
            var ads = addonsOf(main.sec);
            var ad = ads[Math.floor(rnd() * ads.length)];
            adRev += ad.p;
            lines.push({ n: "إضافة " + ad.n, p: ad.p, q: 1, sec: main.sec, addon: 1 });
          }

          if (rnd() < 0.8) {
            var total = lines.reduce(function (a, l) { return a + l.p * l.q; }, 0);
            orders.push({
              id: "D" + (ts % 100000), t: ts + 260000, lines: lines, total: total,
              up: upRev, addon: adRev,
              mode: w.SALES.order.modes[rnd() < .62 ? 0 : (rnd() < .62 ? 1 : 2)],
              table: 1 + Math.floor(rnd() * w.SALES.order.tables),
              demo: 1
            });

            if (rnd() < 0.24) {
              var st = rnd() < 0.76 ? 5 : (rnd() < 0.62 ? 4 : (rnd() < .6 ? 3 : 2));
              reviews.push({
                t: ts + 900000, stars: st, demo: 1,
                note: st <= 3 ? ["الطلب تأخر شوي", "القهوة بردت", "الصوت عالي في الصالة"][Math.floor(rnd() * 3)] : "",
                sent: st >= w.SALES.review.threshold ? "google" : "owner"
              });
            }
            if (rnd() < 0.19) {
              // ٦٠٪ من مرة تانية لواحد من العملاء القدام — الباقي عميل جديد
              var pp = rnd() < 0.6
                ? PEOPLE[Math.floor(rnd() * PEOPLE.length)]
                : { name: NAMES[Math.floor(rnd() * NAMES.length)],
                    phone: "05" + [0, 3, 5, 6][Math.floor(rnd() * 4)] + String(Math.floor(rnd() * 10000000)).padStart(7, "0") };
              customers.push({ t: ts + 300000, demo: 1, phone: pp.phone, name: pp.name, spent: total });
            }
          }
        }
      }
    }
    evs.sort(function (a, b) { return a.t - b.t; });

    /* نفضّي القديم الأول عشان ما نزاحمش الحد، وبعدين نكتب.
       لو المتصفح رفض (الحد ٥ ميجا) بنقص من أقدم الأحداث ونعيد. */
    [K.ev, K.ord, K.rev, K.cus].forEach(function (k) {
      try { localStorage.removeItem(k); } catch (e) { }
    });
    set(K.ord, orders); set(K.rev, reviews); set(K.cus, customers);
    for (var tries = 0; tries < 5; tries++) {
      if (set(K.ev, evs)) break;
      evs = evs.slice(Math.floor(evs.length * 0.3));   // اقطع أقدم ٣٠٪
    }
    set(K.seed, { at: Date.now(), days: days });
  }

  /* ---------------- تتبّع حقيقي ---------------- */
  function cid() {
    var c = null;
    try { c = sessionStorage.getItem(K.cid); } catch (e) { }
    if (!c) {
      c = "s" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      try { sessionStorage.setItem(K.cid, c); } catch (e) { }
    }
    return c;
  }
  function track(e, payload) {
    var row = Object.assign({ t: Date.now(), e: e, vid: cid() }, payload || {});
    var evs = get(K.ev, []);
    evs.push(row);
    if (evs.length > 30000) evs = evs.slice(-30000);
    set(K.ev, evs);
    emit("event", row);
    var url = w.SALES.endpoint;
    if (url) {
      try {
        var b = new Blob([JSON.stringify(row)], { type: "text/plain;charset=UTF-8" });
        navigator.sendBeacon(url, b);
      } catch (err) { }
    }
    return row;
  }
  function pushOrder(order) {
    var o = get(K.ord, []); o.push(order); set(K.ord, o);
    track("order", { v: order.total, up: order.up, ad: order.addon });
    emit("order", order);
  }
  function pushReview(r) { var a = get(K.rev, []); a.push(r); set(K.rev, a); emit("review", r); }
  function pushCustomer(c) { var a = get(K.cus, []); a.push(c); set(K.cus, a); emit("customer", c); }

  /* ---------------- تحكّم الأونر ---------------- */
  function control() {
    return Object.assign({
      soldOut: [], prices: {}, pinned: [],
      offerOn: null, offerTitle: "", offerBody: "",
      hidden: []
    }, get(K.ctl, {}));
  }
  function saveControl(c) { set(K.ctl, c); emit("control", c); }

  /* ---------------- التجميع ---------------- */
  /* days = طول الفترة · back = ارجع كام فترة لورا (1 = الفترة السابقة للمقارنة) */
  function agg(days, includeDemo, back) {
    days = days || 30; back = back || 0;
    var end = Date.now() - back * days * 86400000;
    var since = end - days * 86400000;
    var inRange = function (r) { return r.t >= since && r.t < end && (includeDemo || !r.demo); };

    var evs = get(K.ev, []).filter(inRange);
    var ords = get(K.ord, []).filter(inRange);
    var revs = get(K.rev, []).filter(inRange);
    var cus = get(K.cus, []).filter(inRange);

    var o = {
      days: days, since: since, end: end, events: evs.length,
      visits: 0, itemViews: 0, addCart: 0, orders: ords.length,
      revenue: 0, upRevenue: 0, addonRevenue: 0,
      upShown: 0, upAccept: 0,
      byHour: new Array(24).fill(0), byDow: new Array(7).fill(0), byDay: {},
      revByDay: {},
      viewsByItem: {}, ordersByItem: {}, revByItem: {},
      viewsBySection: {}, revBySection: {},
      reviews: revs, customers: cus, orderList: ords.slice().sort(function (a, b) { return b.t - a.t; })
    };
    var vViewed = {}, vCarted = {}, vAll = {};

    evs.forEach(function (r) {
      if (r.vid) {
        vAll[r.vid] = 1;
        if (r.e === "item_view") vViewed[r.vid] = 1;
        if (r.e === "add_cart") vCarted[r.vid] = 1;
      }
      var d = new Date(r.t);
      if (r.e === "visit") {
        o.visits++; o.byHour[d.getHours()]++; o.byDow[d.getDay()]++;
        var key = dayKey(d);
        o.byDay[key] = (o.byDay[key] || 0) + 1;
      }
      else if (r.e === "item_view") {
        o.itemViews++;
        o.viewsByItem[r.n] = (o.viewsByItem[r.n] || 0) + 1;
        if (r.sec) o.viewsBySection[r.sec] = (o.viewsBySection[r.sec] || 0) + 1;
      }
      else if (r.e === "add_cart") o.addCart++;
      else if (r.e === "upsell_shown") o.upShown++;
      else if (r.e === "upsell_accept") o.upAccept++;
    });

    ords.forEach(function (od) {
      o.revenue += od.total || 0;
      o.upRevenue += od.up || 0;
      o.addonRevenue += od.addon || 0;
      var dk = dayKey(new Date(od.t));
      o.revByDay[dk] = (o.revByDay[dk] || 0) + (od.total || 0);
      (od.lines || []).forEach(function (l) {
        o.ordersByItem[l.n] = (o.ordersByItem[l.n] || 0) + (l.q || 1);
        o.revByItem[l.n] = (o.revByItem[l.n] || 0) + (l.p * (l.q || 1));
        if (l.sec) o.revBySection[l.sec] = (o.revBySection[l.sec] || 0) + (l.p * (l.q || 1));
      });
    });

    o.fVisits = Math.max(o.visits, Object.keys(vAll).length);
    o.fViewed = Object.keys(vViewed).length;
    o.fCarted = Object.keys(vCarted).length;

    o.addedMoney = o.upRevenue + o.addonRevenue;
    o.avgTicket = o.orders ? Math.round(o.revenue / o.orders) : 0;
    o.upRate = o.upShown ? Math.round(o.upAccept / o.upShown * 100) : 0;
    o.convRate = o.visits ? Math.round(o.orders / o.visits * 100) : 0;
    o.perDayVisits = Math.round(o.visits / days);
    o.perDayRevenue = Math.round(o.revenue / days);
    o.stars = revs.length
      ? Math.round(revs.reduce(function (a, r) { return a + r.stars; }, 0) / revs.length * 10) / 10 : 0;

    o.top = Object.keys(o.viewsByItem).map(function (n) {
      return {
        n: n, views: o.viewsByItem[n],
        orders: o.ordersByItem[n] || 0,
        rev: o.revByItem[n] || 0,
        price: (BYNAME[n] && BYNAME[n].price) || 0,
        sec: (BYNAME[n] && BYNAME[n].secTitle) || ""
      };
    }).sort(function (a, b) { return b.views - a.views; });

    o.dead = ITEMS.filter(function (r) {
      return !o.viewsByItem[r.n] && !o.ordersByItem[r.n];
    }).map(function (r) {
      return { n: r.n, price: r.price, sec: r.secTitle, cat: r.catTitle };
    });

    o.leak = o.top.filter(function (r) { return r.views >= 8 && r.orders / r.views < 0.06; })
      .sort(function (a, b) { return b.views - a.views; }).slice(0, 8);

    o.topRev = Object.keys(o.revByItem).map(function (n) {
      return { n: n, rev: o.revByItem[n], q: o.ordersByItem[n] || 0 };
    }).sort(function (a, b) { return b.rev - a.rev; });

    return o;
  }

  /* اليوم بالتوقيت المحلي (مش UTC) عشان الرسم ما يزحلقش يوم */
  function dayKey(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  /* آخر N يوم كسلسلة مرتّبة للرسم */
  function series(o, n) {
    var out = [], now = new Date(o.end);
    for (var i = n - 1; i >= 0; i--) {
      var d = new Date(now.getTime() - i * 86400000);
      var k = dayKey(d);
      out.push({ k: k, d: d, visits: o.byDay[k] || 0, rev: o.revByDay[k] || 0 });
    }
    return out;
  }

  /* نسبة التغيّر بين فترتين */
  function delta(cur, prev) {
    if (!prev) return null;
    return Math.round((cur - prev) / prev * 100);
  }

  /* ---------------- التنبيهات: أهم ٣–٥ حاجات محتاجة قرار ---------------- */
  function alerts(o) {
    var a = [], c = control();
    if (o.dead.length) a.push({
      k: "dead", icon: "🪦", tone: "red",
      t: o.dead.length + " صنف ما فتحه أحد نهائيًا",
      d: "ياكل مخزون ومساحة في المنيو — أول قرار: شيل نصهم",
      go: "items"
    });
    if (o.leak.length) a.push({
      k: "leak", icon: "⚠️", tone: "amber",
      t: o.leak.length + " صنف ينشاف كثير وما أحد يطلبه",
      d: "أعلاهم «" + o.leak[0].n + "» — يعني السعر أو الوصف فيه مشكلة",
      go: "items"
    });
    var low = (o.reviews || []).filter(function (r) { return r.stars < w.SALES.review.threshold; });
    if (low.length) a.push({
      k: "low", icon: "⭐", tone: "amber",
      t: low.length + " تقييم منخفض وصلك انت قبل ما ينزل قوقل",
      d: "الفلتر منع نزولهم — ردّ عليهم وتقلبهم زباين دايمين",
      go: "reviews"
    });
    if (o.upRate < 35 && o.upShown > 20) a.push({
      k: "up", icon: "📉", tone: "amber",
      t: "قبول الاقتراحات " + o.upRate + "٪ بس",
      d: "غيّر الأصناف المقترحة في «يمشي مع» لأصناف أرخص شوي",
      go: "items"
    });
    if (c.soldOut.length) a.push({
      k: "so", icon: "🔴", tone: "red",
      t: c.soldOut.length + " صنف مقفول حاليًا",
      d: "متأكد إنهم لسه خالصين؟ افتحهم مرة ثانية لما يتوفرون",
      go: "control"
    });
    if (!a.length) a.push({
      k: "ok", icon: "✅", tone: "green",
      t: "ما فيه شي يحتاج قرار حاليًا",
      d: "الأرقام كلها في مكانها — كمّل شغل",
      go: "sales"
    });
    return a;
  }

  /* ---------------- مساعدات ---------------- */
  function money(v) { return Math.round(v).toLocaleString("en-US"); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function offerLive() {
    var c = control(), s = w.SALES.offer;
    var on = c.offerOn == null ? s.on : c.offerOn;
    if (!on) return null;
    var h = new Date().getHours();
    var active = s.from <= s.to ? (h >= s.from && h < s.to) : (h >= s.from || h < s.to);
    var end = new Date(); end.setHours(s.to, 0, 0, 0);
    if (end < new Date()) end = new Date(end.getTime() + 86400000);
    return {
      active: active, title: c.offerTitle || s.title, body: c.offerBody || s.body,
      endsAt: end.getTime(), from: s.from, to: s.to, pct: s.pct, section: s.applyTo && s.applyTo.section
    };
  }
  /* السعر النهائي بعد تحكّم الأونر */
  function priceOf(name, base) {
    var c = control();
    return c.prices[name] != null ? c.prices[name] : base;
  }

  w.NS = w.FS = {
    K: K, get: get, set: set, emit: emit, onMsg: onMsg,
    items: function () { return ITEMS; },
    byName: function (n) { return BYNAME[n]; },
    section: function (id) { return SECS[id]; },
    buildIndex: buildIndex, seedDemo: seedDemo, track: track,
    pushOrder: pushOrder, pushReview: pushReview, pushCustomer: pushCustomer,
    control: control, saveControl: saveControl,
    agg: agg, series: series, delta: delta, alerts: alerts, dayKey: dayKey,
    money: money, esc: esc, offerLive: offerLive, priceOf: priceOf, cid: cid,
    ensureSeed: function () {
      buildIndex();
      if (!get(K.seed, null)) seedDemo(62);
    },
    reset: function () {
      Object.keys(K).forEach(function (k) { if (k !== "theme") localStorage.removeItem(K[k]); });
    }
  };
})(window);
