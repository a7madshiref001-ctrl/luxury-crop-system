/* محصول فاخر — تابة «الكاشير والمتابعة» في لوحة الإدارة (قراءة فقط من السيرفر) */
(function (w, d) {
  "use strict";
  var P = w.PosData;
  var $ = function (id) { return d.getElementById(id); };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]; }); };
  var money = function (v) { return Number(v || 0).toLocaleString("en-US", { maximumFractionDigits: 2 }); };
  var busy = false, timer = null, loadedAt = 0;
  var MOBILE = ((w.SITE_CONFIG && w.SITE_CONFIG.menuUrl) || "https://www.luxurycrop.site/").replace(/\/+$/, "") + "/live";

  function ago(t) {
    if (!t) return "—";
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "الآن";
    if (m < 60) return "من " + m + " دقيقة";
    if (m < 24 * 60) return "من " + Math.round(m / 60) + " ساعة";
    return new Date(t).toLocaleString("ar-SA-u-ca-gregory-nu-latn", { dateStyle: "medium", timeStyle: "short" });
  }
  function clock(t) { return t ? new Date(t).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit" }) : "—"; }
  function row(name, sub, value) {
    return '<div class="rw"><div class="nm"><b>' + esc(name) + "</b>" + (sub ? "<span>" + esc(sub) + "</span>" : "") + '</div><div class="vl">' + value + "</div></div>";
  }
  function state(text, kind) { var el = $("posState"); el.textContent = text; el.className = "pos-state" + (kind ? " " + kind : ""); }
  function onOff(v) { return v ? "مفعّل" : "مقفول"; }

  function paint(o) {
    if (!o.hasCopy) {
      state("الكاشير لسه ما حفظش أول نسخة على السيرفر. افتح الكاشير على جهاز المحل وسجّل الدخول من Settings ← Online، وبعد دقيقتين البيانات هتظهر هنا.", "warn");
    } else {
      var stale = Date.now() - o.savedAt > 15 * 60000;
      state((stale ? "آخر حفظ من الكاشير " : "الكاشير متصل · آخر حفظ ") + ago(o.savedAt) + (o.today ? "" : " · آخر يوم عمل مسجّل " + o.day), stale ? "warn" : "ok");
    }
    var s = o.sum;
    $("posNet").textContent = money(s.net);
    $("posNetD").textContent = s.refunds ? "بعد مرتجعات " + money(s.refunds) + " ر.س" : "يوم العمل " + o.day;
    $("posCount").textContent = s.count;
    $("posCountD").textContent = s.open ? s.open + " طلب قيد التحضير" : (s.unpaid ? s.unpaid + " طلب لم يُحصّل" : "");
    $("posAvg").textContent = money(s.avg);
    $("posAvgD").textContent = o.lastInvoice ? "آخر فاتورة رقم " + o.lastInvoice : "";
    $("posCash").textContent = o.shift ? money(o.shift.expected) : "—";
    $("posCashD").textContent = o.shift ? "وردية " + (o.shift.by || "") + " من " + clock(o.shift.openedAt) : "لا توجد وردية مفتوحة";

    var keys = Object.keys(s.by).sort(function (a, b) { return s.by[b] - s.by[a]; });
    var top = keys.length ? s.by[keys[0]] || 1 : 1;
    $("posPays").innerHTML = keys.length ? keys.map(function (k) {
      return '<div class="rw"><div class="nm"><b>' + esc(P.PAY[k] || k) + '</b></div><div class="mtr"><i style="width:' + Math.max(4, Math.round(100 * s.by[k] / top)) + '%"></i></div><div class="vl">' + money(s.by[k]) + "</div></div>";
    }).join("") : '<div class="note">لا توجد فواتير محفوظة لهذا اليوم بعد.</div>';

    var max = Math.max.apply(null, o.days.map(function (x) { return x.net; }).concat([1]));
    $("posDays").innerHTML = o.days.slice().reverse().map(function (x) {
      return '<div class="rw"><div class="nm"><b class="mono">' + esc(x.day) + "</b><span>" + x.count + ' فاتورة</span></div><div class="mtr"><i style="width:' + Math.round(100 * x.net / max) + '%"></i></div><div class="vl">' + money(x.net) + "</div></div>";
    }).join("");

    $("posInfo").innerHTML = o.hasCopy ? [
      row("آخر حفظ على السيرفر", "نسخة كاملة كل دقيقتين", esc(ago(o.savedAt))),
      row("يوم العمل", "", '<span class="mono">' + esc(o.day) + "</span>"),
      row("الوردية", o.shift ? "افتتاحي " + money(o.shift.float) + " ر.س" : "", o.shift ? esc((o.shift.by || "مفتوحة") + " · " + clock(o.shift.openedAt)) : "مقفولة"),
      row("الموظفون", "", String(o.staffCount)),
      row("أصناف موقوفة في الكاشير", "", String(o.soldOut.length)),
      row("إصدار الكاشير", "جهاز " + (o.device || ""), '<span class="mono">v' + esc(o.version || "—") + "</span>")
    ].join("") : '<div class="note">لا توجد نسخة محفوظة بعد.</div>';

    var st = o.settings || {}, store = o.store || {};
    $("posSettings").innerHTML = o.hasCopy ? [
      row("اسم المحل على الفاتورة", store.branchAr || "", esc(store.nameAr || "—")),
      row("رقم المحل", "", '<span class="mono">' + esc(store.phone || "—") + "</span>"),
      row("الضريبة", store.vat ? "الرقم الضريبي " + store.vat : "", st.vatOn ? "فاتورة ضريبية" : "إيصال بدون ضريبة"),
      row("قبول طلبات الموقع تلقائيًا", "", onOff(st.autoAccept)),
      row("صوت التنبيه", "", onOff(st.sound !== false)),
      row("الطباعة التلقائية", "", onOff(st.printer !== false)),
      row("القفل التلقائي", "", st.autoLock ? st.autoLock + " دقيقة" : "مقفول"),
      row("نقاط الولاء", "طلبات لكل مشروب مجاني", String(st.loyalNeed || "—"))
    ].join("") : '<div class="note">الإعدادات تظهر بعد أول حفظ من الكاشير.</div>';
    loadedAt = Date.now();
  }

  async function load() {
    if (busy || !P) return;
    busy = true;
    try { paint(await P.overview(7)); }
    catch (e) {
      var denied = e && (e.code === "42501" || /permission|jwt|not authorized/i.test(String(e.message || "")));
      state(denied ? "الحساب الحالي غير مصرّح له بقراءة بيانات الكاشير." : "تعذّر قراءة بيانات الكاشير. تأكد من الإنترنت وحاول مرة ثانية.", "warn");
    } finally { busy = false; }
  }
  function visible() { var pane = $("p-pos"); return !!pane && pane.classList.contains("on") && !d.body.classList.contains("auth-pending"); }
  function mobileCard() {
    var link = $("posMobileLink"); if (!link) return;
    link.href = MOBILE; link.textContent = MOBILE.replace(/^https?:\/\//, "");
    try { if (w.LuxuryQR && w.LuxuryQR.render) w.LuxuryQR.render($("posQr"), MOBILE, "QR المتابعة من الجوال"); } catch (_) { }
  }

  d.addEventListener("DOMContentLoaded", function () {
    if (!$("p-pos")) return;
    mobileCard();
    d.addEventListener("click", function (e) {
      if (e.target.closest('.nv[data-p="pos"]')) { w.setTimeout(load, 0); return; }
      if (e.target.closest("#posRefresh")) { load(); return; }
      var copy = e.target.closest("#posCopy");
      if (copy && navigator.clipboard) navigator.clipboard.writeText(MOBILE).then(function () { copy.textContent = "تم النسخ ✓"; w.setTimeout(function () { copy.textContent = "نسخ الرابط"; }, 1600); }).catch(function () { });
    });
    clearInterval(timer);
    timer = setInterval(function () { if (visible() && !d.hidden && Date.now() - loadedAt > 55000) load(); }, 20000);
  });
})(window, document);
