/* ============================================================
   أريبْ — لوحة صاحب المكان
   ============================================================ */
(function (w, d) {
  "use strict";

  var M = w.MENU, S = w.SALES, F = w.NS;
  var CUR = M.brand.currency || "ج";
  var $ = function (id) { return d.getElementById(id); };
  var esc = function (s) { return F.esc(s); };
  var money = function (v) { return F.money(v); };

  var days = 30, demo = true, page = "home", o = null, prev = null;

  var PAGES = {
    home:      ["الرئيسية", "أهم الأرقام والقرارات في مكان واحد"],
    sales:     ["المبيعات والزوار", "الاتجاه، الذروة، ورحلة العميل"],
    items:     ["أداء الأصناف", "مين يجيب فلوس ومين ياكل مساحة"],
    orders:    ["الطلبات", "كل طلب انرسل من المنيو"],
    customers: ["العملاء", "قاعدة أرقام تكبر لحالها"],
    reviews:   ["التقييمات", "الفلتر يحمي تقييمك في قوقل"],
    control:   ["تحكّم فوري", "غيّر المنيو وانت قاعد — بدون طباعة"],
    roi:       ["حاسبة العائد", "السيستم يرجّع فلوسه في كم يوم"],
    links:     ["الروابط والإعدادات", "لينك العميل، الـQR، والإعدادات السريعة"]
  };

  /* ---------------- تهيئة ---------------- */
  function init() {
    F.ensureSeed();
    var t = F.get(F.K.theme, "light");
    d.documentElement.setAttribute("data-t", t);
    demo = F.get(F.K.demo, true);
    $("bName").textContent = M.brand.nameAr;

    $("range").addEventListener("change", function () { days = +this.value; render(); });
    ["rOrd", "rAvg2", "rUp2", "rPrice"].forEach(function (id) {
      $(id).addEventListener("input", roi);
    });
    $("rOrd").value = S.roi.ordersPerDay;
    $("rAvg2").value = S.roi.avgTicket;
    $("rUp2").value = S.roi.upliftEGP;
    $("rPrice").value = S.roi.priceEGP;

    $("soSearch").addEventListener("input", function () { soldOutList(this.value); });
    $("prSearch").addEventListener("input", function () { priceList(this.value); });
    $("cSearch").addEventListener("input", function () { cusList(this.value); });

    F.onMsg(function () { render(); });
    render();
    roi();
    staticLists();
  }

  /* ---------------- التنقّل ---------------- */
  function go(p) {
    page = p;
    Array.prototype.forEach.call(d.querySelectorAll(".nv"), function (b) {
      b.classList.toggle("on", b.dataset.p === p);
    });
    Array.prototype.forEach.call(d.querySelectorAll(".pane"), function (e) {
      e.classList.toggle("on", e.id === "p-" + p);
    });
    $("pgTitle").textContent = PAGES[p][0];
    $("pgSub").textContent = PAGES[p][1];
    menu(0);
    w.scrollTo({ top: 0, behavior: "smooth" });
    render();
  }
  function menu(on) {
    $("side").classList.toggle("open", !!on);
    $("scrim").classList.toggle("on", !!on);
  }

  /* ---------------- الرسم الكامل ---------------- */
  function render() {
    o = F.agg(days, demo, 0);
    prev = F.agg(days, demo, 1);

    var chip = $("demoChip");
    chip.textContent = demo ? "● وضع العرض" : "● بياناتك الحقيقية";
    chip.classList.toggle("real", !demo);

    home(); sales(); items(); orders(); customers(); reviews(); control(); links();
  }

  function dt(cur, pv) {
    var v = F.delta(cur, pv);
    if (v == null || !isFinite(v)) return "";
    return '<span class="dt ' + (v >= 0 ? "up" : "dn") + '">' + (v >= 0 ? "▲ " : "▼ ") + Math.abs(v) + "٪</span> عن الفترة اللي قبلها";
  }

  /* ---------------- ١) الرئيسية ---------------- */
  function home() {
    /* الكارت الكبير = إجمالي المبيعات في الفترة المختارة،
       والسطر اللي تحته بيوضّح كام منها جابها السيستم لوحده */
    $("hLb").textContent = days === 30 ? "إجمالي المبيعات الشهرية"
      : "إجمالي المبيعات — آخر " + (days === 7 ? "٧ أيام" : "٦٠ يوم");
    $("hRev").textContent = money(o.revenue);
    var share = o.revenue ? Math.round(o.addedMoney / o.revenue * 100) : 0;
    $("hD").innerHTML = dt(o.revenue, prev.revenue) +
      '<br>منها <b>' + money(o.addedMoney) + ' ر.س</b> (' + share + '٪) من الاقتراحات والإضافات ' +
      'اللي المنيو عرضها لوحده على العميل — شي المنيو المطبوع ما يسويه.';
    $("kVis").textContent = money(o.visits);
    $("kVisD").innerHTML = dt(o.visits, prev.visits);
    $("kOrd").textContent = money(o.orders);
    $("kOrdD").innerHTML = dt(o.orders, prev.orders);
    $("kAvg").textContent = money(o.avgTicket);
    $("kAvgD").innerHTML = dt(o.avgTicket, prev.avgTicket);
    $("kUp").textContent = o.upRate;

    spark();

    // التنبيهات
    var al = F.alerts(o);
    $("alerts").innerHTML = al.map(function (a) {
      return '<div class="al ' + a.tone + '" onclick="Own.go(\'' + a.go + '\')">' +
        '<div class="e">' + a.icon + "</div>" +
        "<div style=\"flex:1\"><b>" + esc(a.t) + "</b><span>" + esc(a.d) + "</span></div>" +
        '<div class="go">←</div></div>';
    }).join("");
    var urgent = al.filter(function (a) { return a.tone !== "green"; }).length;
    $("bdgHome").textContent = urgent;
    $("bdgHome").classList.toggle("hide", !urgent);

    // أعلى ٦ أصناف بالإيراد
    var top = o.topRev.slice(0, 6), mx = top.length ? top[0].rev : 1;
    $("homeTop").innerHTML = top.map(function (r, i) {
      return '<div class="rw"><div class="ix">' + (i + 1) + "</div>" +
        '<div class="nm"><b>' + esc(r.n) + "</b><span>" + r.q + " طلب</span></div>" +
        '<div class="mtr"><i style="width:' + Math.round(r.rev / mx * 100) + '%"></i></div>' +
        '<div class="vl">' + money(r.rev) + "</div></div>";
    }).join("") || empty("لسه ما فيه مبيعات في الفترة هذي");

    $("homeOrders").innerHTML = o.orderList.slice(0, 5).map(ordRow).join("") || empty("لسه ما فيه طلبات");
  }

  function spark() {
    var BRAND = getComputedStyle(d.documentElement).getPropertyValue('--mint').trim() || '#8A5E33';
    var ser = F.series(o, 14);
    var mx = Math.max.apply(null, ser.map(function (r) { return r.rev; }).concat([1]));
    var W = 600, H = 100, n = ser.length;
    var pts = ser.map(function (r, i) {
      return [i * (W / (n - 1)), H - (r.rev / mx) * (H - 12) - 6];
    });
    // منحنى ناعم
    var pathD = pts.map(function (p, i) {
      if (!i) return "M" + p[0].toFixed(1) + "," + p[1].toFixed(1);
      var q = pts[i - 1], cx = (q[0] + p[0]) / 2;
      return "C" + cx.toFixed(1) + "," + q[1].toFixed(1) + " " + cx.toFixed(1) + "," + p[1].toFixed(1) + " " + p[0].toFixed(1) + "," + p[1].toFixed(1);
    }).join(" ");
    var area = pathD + " L" + W + "," + H + " L0," + H + " Z";

    $("spark").innerHTML =
      '<defs><linearGradient id="gs" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="' + BRAND + '" stop-opacity=".38"/>' +
      '<stop offset="100%" stop-color="' + BRAND + '" stop-opacity="0"/></linearGradient></defs>' +
      '<path d="' + area + '" fill="url(#gs)"/>' +
      '<path d="' + pathD + '" fill="none" stroke="' + BRAND + '" stroke-width="2.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/>' +
      pts.map(function (p, i) {
        return i === pts.length - 1
          ? '<circle cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="4" fill="' + BRAND + '"/>' : "";
      }).join("");

    $("sparkAxis").innerHTML = ser.map(function (r, i) {
      return "<span>" + (i % 2 === 0 ? r.d.getDate() : "") + "</span>";
    }).join("");
  }

  /* ---------------- ٢) المبيعات ---------------- */
  function sales() {
    $("sRev").textContent = money(o.revenue);
    $("sRevD").innerHTML = dt(o.revenue, prev.revenue);
    $("sUp").textContent = money(o.upRevenue);
    $("sAd").textContent = money(o.addonRevenue);
    $("sConv").textContent = o.convRate;

    bars("hourBars", "hourAxis", o.byHour, function (i) { return i % 3 === 0 ? i : ""; });
    var pk = o.byHour.indexOf(Math.max.apply(null, o.byHour));
    $("peakMsg").innerHTML = "أعلى ساعة عندك <b>" + pk + ":00</b> — " +
      "لو حطيت عرض قبلها بساعة، تزيد الطلبات في نفس الزحمة بدون تكلفة إعلان.";

    var DOW = ["الأحد", "الإتنين", "التلات", "الأربع", "الخميس", "الجمعة", "السبت"];
    bars("dowBars", "dowAxis", o.byDow, function (i) { return DOW[i].slice(0, 4); });
    var best = o.byDow.indexOf(Math.max.apply(null, o.byDow));
    var worst = o.byDow.indexOf(Math.min.apply(null, o.byDow));
    $("dowMsg").innerHTML = "أقوى يوم <b>" + DOW[best] + "</b> وأضعف يوم <b>" + DOW[worst] +
      "</b> — حط عرض " + DOW[worst] + " تحديدًا، مو على طول الأسبوع.";

    // القمع
    var st = [
      { t: "فتح المنيو", v: o.fVisits, e: "👀" },
      { t: "فتح صنف", v: o.fViewed, e: "🍽️" },
      { t: "ضاف للطلب", v: o.fCarted, e: "🛒" },
      { t: "أرسل الطلب", v: o.orders, e: "✅" }
    ];
    var top = st[0].v || 1;
    $("funnel").innerHTML = st.map(function (s, i) {
      var pc = Math.round(s.v / top * 100);
      var drop = i ? Math.round((st[i - 1].v - s.v) / (st[i - 1].v || 1) * 100) : 0;
      return '<div class="st"><div class="fill" style="width:' + pc + '%"></div>' +
        '<div class="tx"><span>' + s.e + "</span><b>" + s.t + "</b>" +
        (i ? '<span class="pc">−' + drop + "٪</span>" : "") +
        '<span class="n">' + money(s.v) + "</span></div></div>";
    }).join("");

    // الإيراد حسب القسم
    var secs = M.sections.map(function (s) {
      return { id: s.id, t: s.title, e: s.emoji || "●", v: o.revBySection[s.id] || 0 };
    }).sort(function (a, b) { return b.v - a.v; });
    var mx = secs.length ? (secs[0].v || 1) : 1;
    $("secRev").innerHTML = secs.map(function (s) {
      return '<div class="rw"><div class="ix">' + s.e + "</div>" +
        '<div class="nm"><b>' + esc(s.t) + "</b><span>" + (o.viewsBySection[s.id] || 0) + " مشاهدة</span></div>" +
        '<div class="mtr"><i style="width:' + Math.round(s.v / mx * 100) + '%"></i></div>' +
        '<div class="vl">' + money(s.v) + "</div></div>";
    }).join("");
  }

  function bars(barsId, axisId, arr, lbl) {
    var mx = Math.max.apply(null, arr.concat([1]));
    $(barsId).innerHTML = arr.map(function (v) {
      return '<i style="height:' + Math.max(3, Math.round(v / mx * 100)) + '%"' +
        (v === mx ? ' class="pk"' : "") + ' data-v="' + v + '"></i>';
    }).join("");
    $(axisId).innerHTML = arr.map(function (_, i) { return "<span>" + lbl(i) + "</span>"; }).join("");
  }

  /* ---------------- ٣) الأصناف ---------------- */
  function items() {
    var tv = o.top.slice(0, 10), mx = tv.length ? tv[0].views : 1;
    $("topViews").innerHTML = tv.map(function (r, i) {
      return '<div class="rw"><div class="ix">' + (i + 1) + "</div>" +
        '<div class="nm"><b>' + esc(r.n) + "</b><span>" + esc(r.sec) + " · " + r.orders + " طلب</span></div>" +
        '<div class="mtr"><i style="width:' + Math.round(r.views / mx * 100) + '%"></i></div>' +
        '<div class="vl">' + r.views + "</div></div>";
    }).join("") || empty("ما فيه بيانات");

    var tr = o.topRev.slice(0, 10), mr = tr.length ? tr[0].rev : 1;
    $("topRev").innerHTML = tr.map(function (r, i) {
      return '<div class="rw"><div class="ix">' + (i + 1) + "</div>" +
        '<div class="nm"><b>' + esc(r.n) + "</b><span>" + r.q + " طلب</span></div>" +
        '<div class="mtr"><i style="width:' + Math.round(r.rev / mr * 100) + '%"></i></div>' +
        '<div class="vl">' + money(r.rev) + "</div></div>";
    }).join("") || empty("ما فيه بيانات");

    $("leak").innerHTML = o.leak.map(function (r) {
      return '<div class="rw"><div class="ix">⚠️</div>' +
        '<div class="nm"><b>' + esc(r.n) + "</b><span>" + r.views + " مشاهدة · " + r.orders + " طلب بس · سعره " + r.price + " " + CUR + "</span></div>" +
        '<div class="vl" style="color:var(--red)">' + Math.round(r.orders / r.views * 100) + "٪</div></div>";
    }).join("") || empty("ما فيه صنف عنده المشكلة هذي — زين 👍");

    $("deadN").textContent = o.dead.length;
    $("deadList").innerHTML = o.dead.map(function (r) {
      return "<span>" + esc(r.n) + " <b>" + r.price + "</b></span>";
    }).join("") || empty("كل الأصناف انشافت — منيو صحّي 👌");
  }

  /* ---------------- ٤) الطلبات ---------------- */
  function ordRow(od) {
    var when = new Date(od.t);
    var up = (od.up || 0) + (od.addon || 0);
    return '<div class="ord"><div class="hd">' +
      '<span class="chip">' + esc(od.mode || "الطاولة") + (od.table ? " · طاولة " + od.table : "") + "</span>" +
      "<b>" + String(when.getHours()).padStart(2, "0") + ":" + String(when.getMinutes()).padStart(2, "0") +
      " · " + when.getDate() + "/" + (when.getMonth() + 1) + "</b>" +
      '<span class="vv">' + money(od.total) + " " + CUR + "</span></div>" +
      '<div class="ls">' + (od.lines || []).map(function (l) { return l.q + "× " + esc(l.n); }).join(" · ") +
      (up ? ' <span class="up">+' + money(up) + " " + CUR + " من الاقتراحات</span>" : "") +
      "</div></div>";
  }
  function orders() {
    $("oCount").textContent = money(o.orders);
    $("oValue").textContent = money(o.revenue);
    $("oAvg").textContent = money(o.avgTicket);
    var MODES = S.order.modes, m = {};
    MODES.forEach(function (k) { m[k] = 0; });
    o.orderList.forEach(function (x) { if (m[x.mode] != null) m[x.mode]++; });
    $("oModes").textContent = MODES.map(function (k) { return m[k]; }).join(" / ");
    $("ordersList").innerHTML = o.orderList.slice(0, 120).map(ordRow).join("") || empty("لسه ما فيه طلبات");
  }

  /* ---------------- ٥) العملاء ---------------- */
  function customers() {
    var c = o.customers;
    $("cCount").textContent = money(c.length);
    $("cAvg").textContent = c.length ? money(c.reduce(function (a, x) { return a + (x.spent || 0); }, 0) / c.length) : 0;
    var byPhone = {};
    c.forEach(function (x) { byPhone[x.phone] = (byPhone[x.phone] || 0) + 1; });
    $("cRep").textContent = Object.keys(byPhone).filter(function (k) { return byPhone[k] > 1; }).length;
    cusList("");
  }
  function cusList(q) {
    var c = (o.customers || []).slice().reverse();
    if (q) c = c.filter(function (x) { return (x.name || "").indexOf(q) > -1 || (x.phone || "").indexOf(q) > -1; });
    $("cusList").innerHTML = c.slice(0, 200).map(function (x) {
      return '<div class="rw"><div class="ix">👤</div>' +
        '<div class="nm"><b>' + esc(x.name || "—") + '</b><span class="mono">' + esc(x.phone) + "</span></div>" +
        '<a class="btn btn-g btn-s no-print" href="https://wa.me/966' + esc(x.phone).replace(/^0/, "") + '" target="_blank" rel="noopener">واتساب</a>' +
        '<div class="vl">' + money(x.spent || 0) + "</div></div>";
    }).join("") || empty("لسه ما فيه أرقام — تتجمّع لما العميل يرسل طلب");
  }

  /* ---------------- ٦) التقييمات ---------------- */
  function reviews() {
    var r = o.reviews;
    $("rAvg").textContent = o.stars || 0;
    $("rCount").textContent = r.length + " تقييم";
    var g = r.filter(function (x) { return x.sent === "google"; }).length;
    var ow = r.length - g;
    $("rGoogle").textContent = g;
    $("rOwner").textContent = ow;
    $("bdgRev").textContent = ow;
    $("bdgRev").classList.toggle("hide", !ow);

    $("revList").innerHTML = r.slice().reverse().slice(0, 100).map(function (x) {
      var hi = x.stars >= S.review.threshold;
      var dd = new Date(x.t);
      return '<div class="rv"><div class="sc ' + (hi ? "hi" : "lo") + '">' + x.stars + "</div>" +
        "<div class=\"bd\" style=\"flex:1\"><b>" + (hi ? "راح لقوقل ✅" : "انمسك ووصلك انت 🛡️") + "</b>" +
        "<span>" + (x.note ? esc(x.note) : "من غير تعليق") + " · " + dd.getDate() + "/" + (dd.getMonth() + 1) + "</span></div></div>";
    }).join("") || empty("لسه ما فيه تقييمات");
  }

  /* ---------------- ٧) تحكّم فوري ---------------- */
  function control() {
    var c = F.control();
    var on = c.offerOn == null ? S.offer.on : c.offerOn;
    $("swOffer").classList.toggle("on", !!on);
    if (!$("offT").value) $("offT").value = c.offerTitle || S.offer.title;
    if (!$("offB").value) $("offB").value = c.offerBody || S.offer.body;
    soldOutList($("soSearch").value);
    priceList($("prSearch").value);
  }
  function soldOutList(q) {
    var c = F.control();
    var list = F.items().filter(function (r) { return !q || r.n.indexOf(q) > -1; }).slice(0, 100);
    $("soList").innerHTML = list.map(function (r) {
      var off = c.soldOut.indexOf(r.n) > -1;
      return '<div class="ctl"><div class="nm"><b>' + esc(r.n) + "</b><span>" + esc(r.secTitle) + " · " + r.price + " " + CUR + "</span></div>" +
        '<div class="sw' + (off ? " on" : "") + '" onclick="Own.tglSold(\'' + esc(r.n).replace(/'/g, "\\'") + '\')"><i></i></div></div>';
    }).join("");
  }
  function priceList(q) {
    var c = F.control();
    var list = F.items().filter(function (r) { return !q || r.n.indexOf(q) > -1; }).slice(0, 100);
    $("prList").innerHTML = list.map(function (r) {
      var v = c.prices[r.n] != null ? c.prices[r.n] : r.price;
      return '<div class="ctl"><div class="nm"><b>' + esc(r.n) + "</b><span>الأصلي " + r.price + " " + CUR + "</span></div>" +
        '<input class="pin mono" type="number" value="' + v + '" onchange="Own.setPrice(\'' + esc(r.n).replace(/'/g, "\\'") + "',this.value)\"></div>";
    }).join("");
  }

  /* ---------------- ٨) العائد ---------------- */
  function roi() {
    var ord = +$("rOrd").value || 0, avg = +$("rAvg2").value || 0;
    var up = +$("rUp2").value || 0, pr = +$("rPrice").value || 1;
    var mo = ord * up * 30, yr = mo * 12;
    $("oMonth").textContent = money(mo);
    $("oYear").textContent = money(yr);
    $("oDays").textContent = mo ? Math.max(1, Math.ceil(pr / (mo / 30))) : "—";
    $("oRoi").textContent = pr ? (yr / pr).toFixed(1) : "—";
    $("oHalf").textContent = money(mo / 2);
    $("oHalfD").textContent = mo ? Math.max(1, Math.ceil(pr / (mo / 60))) : "—";
  }

  function staticLists() {
    var B = [["الأصناف الميتة", "مش معروفة"], ["أوقات الذروة", "بالإحساس"], ["الاقتراح للعميل", "على مزاج الكاشير"],
             ["أرقام العملاء", "صفر"], ["الشكوى", "تروح قوقل على طول"], ["تغيير سعر", "إعادة طباعة"]];
    var A = [["الأصناف الميتة", "بالاسم والرقم"], ["أوقات الذروة", "رسم بياني بالساعة"], ["الاقتراح للعميل", "تلقائي مع كل صنف"],
             ["أرقام العملاء", "قاعدة تكبر لحالها"], ["الشكوى", "توصلك انت أول"], ["تغيير سعر", "ثانية واحدة"]];
    var G = [["منيو QR كامل", "بهوية مكانك"], ["لوحة أرقام", "الصفحة اللي انت فيها"], ["محرّك اقتراحات", "أب-سيل + إضافات + كومبو"],
             ["استقبال الطلبات", "واتساب برقم الطاولة"], ["فلتر تقييمات", "يحمي تقييمك في قوقل"], ["ولاء وكوبونات", "ترجّع العميل"]];
    var row = function (a, color) {
      return '<div class="rw"><div class="nm"><b>' + a[0] + "</b></div>" +
        '<div class="vl" style="font-size:12px;font-weight:600' + (color ? ";color:var(--mint)" : ";color:var(--txt-3)") + '">' + a[1] + "</div></div>";
    };
    $("before").innerHTML = B.map(function (a) { return row(a, 0); }).join("");
    $("after").innerHTML = A.map(function (a) { return row(a, 1); }).join("");
    $("whatyouget").innerHTML = G.map(function (a) { return row(a, 0); }).join("");
  }

  /* ---------------- ٩) الروابط ---------------- */
  function links() {
    var base = location.href.replace(/owner\.html.*$/, "");
    var menuUrl = base + "index.html";
    $("links").innerHTML =
      linkRow("👥 منيو العميل", menuUrl, "ده اللي بيتحط على الترابيزة") +
      linkRow("🔐 لوحتك انت", base + "owner.html", "لا تحطه في أي مكان عام");
    $("qr").innerHTML =
      '<img alt="QR" style="width:190px;height:190px;border-radius:16px;background:#fff;padding:9px" ' +
      'src="https://api.qrserver.com/v1/create-qr-code/?size=380x380&data=' + encodeURIComponent(menuUrl) + '" ' +
      "onerror=\"this.parentNode.innerHTML='<div class=&quot;note&quot;>افتح الصفحة من سيرفر عشان الكود يظهر</div>'\">";

    $("settings").innerHTML =
      setRow("رقم استقبال الطلبات", S.order.whatsapp) +
      setRow("عدد الترابيزات", S.order.tables) +
      setRow("رسوم التوصيل", S.order.deliveryFee + " " + CUR) +
      setRow("هدف الولاء", S.loyalty.goal + " طلبات → " + S.loyalty.reward) +
      setRow("حد فلتر التقييم", S.review.threshold + " نجوم فأكتر تروح جوجل");
  }
  function linkRow(t, url, sub) {
    return '<div class="rw"><div class="nm"><b>' + t + "</b><span>" + sub + "</span></div>" +
      '<a class="btn btn-g btn-s no-print" href="' + esc(url) + '" target="_blank" rel="noopener">فتح</a>' +
      '<button class="btn btn-p btn-s no-print" onclick="Own.copy(\'' + esc(url) + '\')">نسخ</button></div>';
  }
  function setRow(t, v) {
    return '<div class="rw"><div class="nm"><b>' + t + "</b></div>" +
      '<div class="vl" style="font-size:12.5px;color:var(--txt-2)">' + esc(String(v)) + "</div></div>";
  }

  function empty(t) {
    return '<div style="padding:20px;text-align:center;color:var(--txt-3);font-size:12.5px">' + t + "</div>";
  }

  /* ---------------- أفعال ---------------- */
  w.Own = {
    go: go, menu: menu,
    theme: function () {
      var t = d.documentElement.getAttribute("data-t") === "dark" ? "light" : "dark";
      d.documentElement.setAttribute("data-t", t);
      F.set(F.K.theme, t);
    },
    tglDemo: function () { demo = !demo; F.set(F.K.demo, demo); render(); },
    tglSold: function (n) {
      var c = F.control(), i = c.soldOut.indexOf(n);
      if (i > -1) c.soldOut.splice(i, 1); else c.soldOut.push(n);
      F.saveControl(c); control(); home();
    },
    setPrice: function (n, v) {
      var c = F.control();
      var base = (F.byName(n) || {}).price;
      if (+v === base) delete c.prices[n]; else c.prices[n] = +v;
      F.saveControl(c);
    },
    tglOffer: function () {
      var c = F.control();
      var on = c.offerOn == null ? S.offer.on : c.offerOn;
      c.offerOn = !on;
      F.saveControl(c); control();
    },
    saveOffer: function () {
      var c = F.control();
      c.offerTitle = $("offT").value.trim();
      c.offerBody = $("offB").value.trim();
      c.offerOn = true;
      F.saveControl(c); control();
      alert("اتحدّث ✅ افتح تاب المنيو بتلاقي العرض تغيّر فورًا");
    },
    exportCsv: function () {
      var rows = [["الاسم", "التليفون", "أنفق", "التاريخ"]].concat(
        (o.customers || []).map(function (c) {
          return [c.name || "", c.phone || "", c.spent || 0, new Date(c.t).toLocaleDateString("ar-EG")];
        }));
      var csv = "﻿" + rows.map(function (r) { return r.join(","); }).join("\n");
      var a = d.createElement("a");
      a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
      a.download = "luxury-crop-customers.csv"; a.click();
    },
    blast: function () {
      var c = o.customers || [];
      if (!c.length) { alert("لسه ما فيه أرقام"); return; }
      alert("عندك " + c.length + " رقم.\nنزّل الـCSV وارفعه على أي أداة رسايل، أو أرسل لواحد واحد من القائمة.");
    },
    copy: function (t) {
      navigator.clipboard.writeText(t).then(function () { alert("انسخ ✅"); });
    },
    print: function () { w.print(); },
    reseed: function () {
      if (!confirm("بيتعاد توليد بيانات العرض (٩٠ يوم). تمام؟")) return;
      F.reset(); F.buildIndex(); F.seedDemo(62); render();
    },
    reset: function () {
      if (!confirm("بينمسح كل شي — الطلبات والتقييمات والأرقام. متأكد؟")) return;
      F.reset(); location.reload();
    }
  };

  d.addEventListener("DOMContentLoaded", init);
})(window, document);
