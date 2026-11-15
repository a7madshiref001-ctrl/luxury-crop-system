/* محصول فاخر — صفحة المتابعة من الجوال
   قراءة فقط، ما عدا مفتاح «استقبال طلبات الموقع» اللي بيتغيّر لما صاحب المحل يضغطه بنفسه. */
(function (w, d) {
  "use strict";
  var B = w.Backend, P = w.PosData;
  var $ = function (id) { return d.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var money = function (v) { return Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); };
  var STATUS = { new: "جديد", preparing: "قيد التحضير", ready: "جاهز", completed: "مكتمل", cancelled: "ملغي" };
  var busy = false, timer = null, loadedAt = 0, names = {}, settings = null, unsub = null;
  var invAll = false, invOpen = {}, lastPos = null;
  var POS_STATUS = { new: "بانتظار الدفع", prep: "قيد التحضير", ready: "جاهز", done: "تم التسليم", rejected: "ملغي", cancelled: "ملغي" };
  var STATION = { bar: "الباريستا", kitchen: "المطبخ" };

  function ago(t) {
    if (!t) return "—";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return "من " + m + " دقيقة";
    if (m < 24 * 60) return "من " + Math.round(m / 60) + " ساعة";
    return new Date(t).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" });
  }
  function clock(t) { return t ? new Date(t).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" }) : "—"; }
  function row(name, sub, value, extra) {
    return '<div class="lv-row"><div class="n"><b>' + esc(name) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + "</div>" + (extra || "") + (value == null ? "" : '<div class="v">' + value + "</div>") + "</div>";
  }
  function empty(text) { return '<div class="lv-empty">' + esc(text) + "</div>"; }
  function status(text, kind) { var el = $("lvStatus"); el.textContent = text; el.className = "lv-status" + (kind ? " " + kind : ""); }

  function gate(msg) {
    d.body.classList.add("lv-pending");
    $("lvApp").hidden = true; $("lvGate").hidden = false;
    $("lvLoginError").textContent = msg || "";
  }
  function open() {
    d.body.classList.remove("lv-pending");
    $("lvGate").hidden = true; $("lvApp").hidden = false;
  }

  // فواتير اليوم كاملة، الأحدث فوق. الضغط على الفاتورة يفتح أصنافها وطريقة الدفع ومين حضّرها
  function paintInvoices(o) {
    var who = o.staffNames || {};
    var list = (o.orders || []).filter(function (x) { return x && x.id && !x.sim && (x.inv || x.status !== "new"); })
      .sort(function (a, b) { return (b.ts || 0) - (a.ts || 0); });
    var box = $("lvInv"), more = $("lvInvMore");
    if (!list.length) { box.innerHTML = empty(o.hasCopy ? "لا توجد فواتير اليوم حتى الآن. أول فاتورة تظهر هنا خلال دقيقة من تسجيلها." : "تظهر الفواتير هنا بعد ربط الكاشير بالسيرفر."); more.hidden = true; return; }
    var shown = invAll ? list : list.slice(0, 12);
    box.innerHTML = shown.map(function (x) {
      var bad = x.status === "rejected" || x.cancelled;
      var pays = (x.pays || []).map(function (p) { return P.PAY[p.m] || p.m; }).join(" + ");
      var sub = clock(x.ts) + (who[x.staff] ? " · " + who[x.staff] : x.ch === "kiosk" ? " · الكشك" : x.ch === "table" || x.ch === "pickup" ? " · الموقع" : "") + (pays ? " · " + pays : x.unpaid ? " · لم تُدفع" : "");
      var pill = bad ? '<span class="lv-pill">ملغي</span>' : x.refunded ? '<span class="lv-pill new">مرتجع ' + money(x.refunded) + "</span>" : x.unpaid ? '<span class="lv-pill new">لم تُدفع</span>' : "";
      var lines = (x.lines || []).map(function (l) {
        var nm = l.pid === "site_item" ? (l.note || "صنف من الموقع") : (names[l.pid] || "صنف");
        return '<div class="lv-il"><span>' + esc((l.qty || 1) + "× " + nm) + (l.note && l.pid !== "site_item" ? "<small>" + esc(l.note) + "</small>" : "") + "</span><b>" + money(l.total) + "</b></div>";
      }).join("");
      var made = Object.keys(x.sp || {}).map(function (st) { var s = x.sp[st] || {}, by = s.rby || s.by; return by ? (STATION[st] || st) + ": " + (who[by] || "—") : ""; }).filter(Boolean);
      var meta = [POS_STATUS[x.status] || x.status, made.length ? "حضّره — " + made.join(" · ") : "", x.doneBy && who[x.doneBy] ? "سلّمه " + who[x.doneBy] : "", x.name ? "العميل: " + x.name : ""].filter(Boolean).join(" · ");
      return '<details class="lv-inv"' + (invOpen[x.id] ? " open" : "") + ' data-id="' + esc(x.id) + '"><summary class="lv-row"><div class="n"><b>' + esc((x.inv || "طلب") + " · #" + x.no) + "</b><span>" + esc(sub) + "</span></div>" + pill + '<div class="v">' + money(x.total) + "</div></summary>"
        + '<div class="lv-inv__b">' + lines + '<div class="lv-il lv-il--meta"><span>' + esc(meta) + "</span></div></div></details>";
    }).join("");
    more.hidden = list.length <= 12;
    more.textContent = invAll ? "آخر 12 فاتورة فقط" : "اعرض كل فواتير اليوم (" + list.length + ")";
  }

  function paintPos(o) {
    lastPos = o;
    paintInvoices(o);
    $("lvDay").textContent = "يوم العمل ⁦" + o.day + "⁩";
    if (!o.hasCopy) status("الكاشير غير مربوط بالسيرفر بعد. افتح الكاشير على جهاز المحل بحساب المدير واضغط «تسجيل الدخول والربط» في الشريط الأسود أسفل الشاشة (مرة واحدة فقط)، وبعدها تظهر الأرقام هنا تلقائيًا.", "warn");
    else {
      var stale = Date.now() - o.savedAt > 15 * 60000;
      status((stale ? "آخر حفظ من الكاشير " : "الكاشير متصل · آخر حفظ ") + ago(o.savedAt) + (o.today ? "" : " · آخر يوم عمل مسجّل " + o.day), stale ? "warn" : "ok");
    }
    var s = o.sum;
    $("lvNet").textContent = money(s.net);
    $("lvNetD").textContent = s.count ? "آخر فاتورة رقم " + (o.lastInvoice || "—") : "لا توجد فواتير محفوظة لهذا اليوم بعد";
    $("lvCount").textContent = s.count;
    $("lvAvg").textContent = money(s.avg);
    $("lvRefunds").textContent = money(s.refunds);

    var max = Math.max.apply(null, o.days.map(function (x) { return x.net; }).concat([1]));
    $("lvWeek").innerHTML = o.days.map(function (x) {
      return '<div class="' + (x.day === o.day ? "on" : "") + '" title="' + esc(x.day + " · " + money(x.net)) + '"><i style="height:' + Math.max(3, Math.round(100 * x.net / max)) + '%"></i><span>' + esc(x.day.slice(8)) + "</span></div>";
    }).join("");

    var now = [];
    if (o.shift) {
      now.push(row("الوردية مفتوحة", (o.shift.by || "") + " · من " + clock(o.shift.openedAt), null, '<span class="lv-pill ready">مفتوحة</span>'));
      now.push(row("النقد المتوقع في الدرج", "افتتاحي " + money(o.shift.float) + " ر.س", money(o.shift.expected)));
    } else {
      now.push(row("الوردية", o.lastClosed ? "آخر إقفال " + ago(o.lastClosed.close) : "لا توجد وردية مفتوحة", null, '<span class="lv-pill">مقفولة</span>'));
    }
    now.push(row("طلبات قيد التحضير في الكاشير", "", String(s.open)));
    if (s.unpaid) now.push(row("طلبات لم تُحصّل بعد", "من الكشك أو الموقع", String(s.unpaid)));
    now.push(row("أصناف موقوفة في الكاشير", "", String(o.soldOut.length)));
    $("lvNow").innerHTML = now.join("");

    var keys = Object.keys(s.by).sort(function (a, b) { return s.by[b] - s.by[a]; });
    var top = keys.length ? s.by[keys[0]] || 1 : 1;
    $("lvPays").innerHTML = keys.length ? keys.map(function (k) {
      return row(P.PAY[k] || k, "", money(s.by[k]), '<div class="m"><i style="width:' + Math.max(4, Math.round(100 * s.by[k] / top)) + '%"></i></div>');
    }).join("") : empty("لا توجد مدفوعات مسجّلة اليوم.");

    var items = Object.keys(s.items).map(function (k) { return s.items[k]; }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 6);
    var best = items.length ? items[0].qty || 1 : 1;
    $("lvTop").innerHTML = items.length ? items.map(function (it) {
      return row(names[it.pid] || it.note || "صنف من الموقع", "", "×" + it.qty, '<div class="m"><i style="width:' + Math.max(4, Math.round(100 * it.qty / best)) + '%"></i></div>');
    }).join("") : empty("لسه مفيش مبيعات اليوم.");
  }

  function paintSite(orders, day) {
    var today = orders.filter(function (x) { return P.dayKey(new Date(x.created_at).getTime()) === day; });
    var c = { new: 0, preparing: 0, ready: 0, completed: 0, cancelled: 0 }, value = 0;
    today.forEach(function (x) { c[x.status] = (c[x.status] || 0) + 1; if (x.status !== "cancelled") value += Number(x.total) || 0; });
    $("lvSiteCounts").innerHTML = [
      '<span class="lv-pill' + (c.new ? " new" : "") + '">جديد ' + c.new + "</span>",
      '<span class="lv-pill">قيد التحضير ' + c.preparing + "</span>",
      '<span class="lv-pill' + (c.ready ? " ready" : "") + '">جاهز ' + c.ready + "</span>",
      '<span class="lv-pill">مكتمل ' + c.completed + "</span>",
      '<span class="lv-pill">القيمة ' + money(value) + " ر.س</span>"
    ].join("");
    var list = orders.slice(0, 8);
    $("lvSite").innerHTML = list.length ? list.map(function (x) {
      var where = x.service_label || (x.table_no ? "طاولة " + x.table_no : "استلام");
      return row("#" + x.order_number + " · " + where, (x.customer_name || "عميل") + " · " + ago(new Date(x.created_at).getTime()), money(x.total),
        '<span class="lv-pill ' + (x.status === "new" ? "new" : x.status === "ready" ? "ready" : "") + '">' + esc(STATUS[x.status] || x.status) + "</span>");
    }).join("") : empty("لا توجد طلبات من الموقع حتى الآن.");
  }
  function paintOrdering() {
    var box = $("lvOrdering");
    box.disabled = !settings;
    if (!settings) { $("lvOrderingNote").textContent = "—"; return; }
    box.checked = settings.ordering_open !== false;
    $("lvOrderingNote").textContent = box.checked ? "الموقع يستقبل طلبات الآن" : "استقبال الطلبات مقفول";
  }

  async function loadNames() {
    try {
      var c = B.init();
      var res = await Promise.all([c.from("products").select("id,name"), c.from("offers").select("id,name")]);
      res.forEach(function (r) { (r.data || []).forEach(function (x) { names[x.id] = x.name; }); });
    } catch (_) { }
  }
  async function load() {
    if (busy) return;
    busy = true; $("lvRefresh").classList.add("spin");
    try {
      if (!Object.keys(names).length) await loadNames();
      var res = await Promise.all([
        P.overview(7),
        B.listOrders(40).catch(function () { return []; }),
        B.init().from("store_settings").select("tables_count,ordering_open,smart_locations_required").eq("id", 1).maybeSingle()
      ]);
      settings = res[2] && !res[2].error ? res[2].data : null;
      paintPos(res[0]); paintSite(res[1], res[0].day); paintOrdering();
      loadedAt = Date.now();
    } catch (e) {
      var denied = e && (e.code === "42501" || /permission|jwt|not authorized/i.test(String(e.message || "")));
      status(denied ? "الحساب الحالي غير مصرّح له بقراءة البيانات." : "تعذّر تحميل البيانات. تأكد من الإنترنت وحاول مرة ثانية.", "warn");
    } finally { busy = false; $("lvRefresh").classList.remove("spin"); }
  }
  async function toggleOrdering() {
    var box = $("lvOrdering");
    if (!settings) { box.checked = !box.checked; return; }
    var want = box.checked;
    box.disabled = true;
    try {
      settings = await B.saveSettings({ tables_count: settings.tables_count, ordering_open: want, smart_locations_required: settings.smart_locations_required });
    } catch (_) { status("تعذّر تغيير استقبال الطلبات. حاول مرة ثانية.", "warn"); }
    paintOrdering();
  }

  async function start() {
    open();
    await load();
    if (unsub) unsub();
    unsub = B.subscribeOrders(function () { w.setTimeout(load, 500); });
    clearInterval(timer);
    timer = setInterval(function () { if (!d.hidden && Date.now() - loadedAt > 14000) load(); }, 5000);
  }
  async function login(e) {
    e.preventDefault();
    var btn = $("lvLoginBtn"); btn.disabled = true; $("lvLoginError").textContent = "";
    try { await B.signIn($("lvEmail").value, $("lvPassword").value); $("lvPassword").value = ""; await start(); }
    catch (err) {
      var msg = String(err && err.message || "");
      $("lvLoginError").textContent = /invalid login/i.test(msg) ? "البريد أو كلمة المرور غير صحيحة" : /غير مصرح|not authorized|permission/i.test(msg) ? "الحساب غير مصرّح له بإدارة المحل" : /rate|too many/i.test(msg) ? "محاولات كثيرة. جرّب بعد قليل" : "تعذّر الاتصال. تأكد من الإنترنت";
    } finally { btn.disabled = false; }
  }

  d.addEventListener("DOMContentLoaded", async function () {
    $("lvLogin").addEventListener("submit", login);
    $("lvRefresh").addEventListener("click", load);
    $("lvInvMore").addEventListener("click", function () { invAll = !invAll; if (lastPos) paintInvoices(lastPos); });
    $("lvInv").addEventListener("toggle", function (e) { var el = e.target; if (el && el.dataset && el.dataset.id) invOpen[el.dataset.id] = el.open; }, true);
    $("lvOrdering").addEventListener("change", toggleOrdering);
    $("lvLogout").addEventListener("click", async function () { try { await B.signOut(); } catch (_) { } w.location.reload(); });
    d.addEventListener("visibilitychange", function () { if (!d.hidden && !$("lvApp").hidden && Date.now() - loadedAt > 15000) load(); });
    if (!B || !B.configured() || !P) { gate("الصفحة غير مربوطة بقاعدة البيانات."); return; }
    try {
      var session = await B.session();
      if (!session) { gate(""); return; }
      var ok = await B.init().from("admin_users").select("user_id").eq("user_id", session.user.id).maybeSingle();
      if (ok.error || !ok.data) { gate("الحساب غير مصرّح له بإدارة المحل"); return; }
      await start();
    } catch (_) { gate(""); }
  });
})(window, document);
