/* محصول فاخر — قراءة بيانات الكاشير من السيرفر (للوحة الإدارة وصفحة الجوال)
   قراءة فقط: الملف ده مابيكتبش ولا بيعدّل أي حاجة. الصلاحية من RLS (حساب إدارة أو حساب كاشير). */
(function (w) {
  "use strict";
  var STORE = "luxurycrop:pos:v1";
  var PAY = { cash: "كاش", mada: "مدى", apple: "Apple Pay", stc: "STC Pay", online: "مدفوع أونلاين", credit: "رصيد استبدال", exchange: "رصيد استبدال" };
  var r2 = function (n) { return Math.round((Number(n) || 0) * 100) / 100; };

  function client() {
    var B = w.Backend;
    if (!B || !B.configured()) throw new Error("not configured");
    return B.init();
  }
  // يوم العمل بتوقيت السعودية: بيتصفّر الساعة 4 الفجر (نفس حساب الكاشير — dayResetH في إعداداته)
  var RESET_H = 4;
  function dayKey(ts) {
    var d = new Date((ts == null ? Date.now() : ts) + 3 * 3600000 - RESET_H * 3600000);
    var p = function (n) { return n < 10 ? "0" + n : "" + n; };
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }
  function addDays(key, n) {
    var t = Date.UTC(Number(key.slice(0, 4)), Number(key.slice(5, 7)) - 1, Number(key.slice(8, 10))) + n * 86400000;
    var d = new Date(t), p = function (x) { return x < 10 ? "0" + x : "" + x; };
    return d.getUTCFullYear() + "-" + p(d.getUTCMonth() + 1) + "-" + p(d.getUTCDate());
  }
  function refundCash(r) {
    if (r && Array.isArray(r.parts)) return r.parts.filter(function (p) { return p.m === "cash"; }).reduce(function (a, p) { return a + (Number(p.a) || 0); }, 0);
    return r && r.m === "cash" ? Number(r.a) || 0 : 0;
  }
  var counted = function (o) { return o && o.status !== "rejected" && !o.unpaid && !o.sim; };

  // ملخّص يوم من فواتير الكاشير
  function summarize(orders) {
    var out = { count: 0, gross: 0, refunds: 0, net: 0, by: {}, items: {}, channels: {}, open: 0, unpaid: 0 };
    (orders || []).forEach(function (o) {
      if (!o) return;
      if (o.unpaid && o.status !== "rejected" && o.status !== "cancelled") out.unpaid++;
      if (o.status === "new" || o.status === "prep" || o.status === "ready") out.open++;
      if (!counted(o)) return;
      out.count++;
      out.gross = r2(out.gross + (Number(o.total) || 0));
      out.refunds = r2(out.refunds + (Number(o.refunded) || 0));
      (o.pays || []).forEach(function (p) { out.by[p.m] = r2((out.by[p.m] || 0) + (Number(p.a) || 0)); });
      var ch = o.ch || "counter"; out.channels[ch] = (out.channels[ch] || 0) + 1;
      (o.lines || []).forEach(function (l) {
        if (!l || !l.pid) return;
        var it = out.items[l.pid] || (out.items[l.pid] = { pid: l.pid, qty: 0, note: "" });
        it.qty += Number(l.qty) || 0;
        if (l.pid === "site_item" && l.note) it.note = l.note;
      });
    });
    out.net = r2(out.gross - out.refunds);
    out.avg = out.count ? r2(out.net / out.count) : 0;
    return out;
  }
  // النقد المتوقع في الدرج للوردية المفتوحة (نفس معادلة الكاشير)
  function expectedCash(shift, orders, payouts) {
    var cash = Number(shift.float) || 0;
    (orders || []).forEach(function (o) {
      if (!o) return;
      if (o.shift === shift.id && o.status !== "rejected") {
        cash -= (Number(o.creditBack) || 0);
        (o.pays || []).forEach(function (p) { if (p.m === "cash") cash += Number(p.a) || 0; });
      }
      (o.refunds || []).forEach(function (r) { if (r.shift === shift.id) cash -= refundCash(r); });
    });
    (payouts || []).forEach(function (p) { if (p.shift === shift.id) cash -= Number(p.a) || 0; });
    return r2(cash);
  }

  // كشف الوردية: فواتير الوردية دي بس (حتى لو بدأت قبل تصفير اليوم)
  function shiftReport(sh, orders, payouts, who) {
    var s = summarize(orders);
    var pay = (payouts || []).filter(function (p) { return p && p.shift === sh.id; }).reduce(function (a, p) { return a + (Number(p.a) || 0); }, 0);
    return { id: sh.id, by: who(sh.user), open: sh.open, close: sh.close || 0, z: sh.z || "", float: Number(sh.float) || 0, count: s.count, net: s.net, refunds: s.refunds, pays: s.by, payouts: r2(pay),
      expected: sh.close ? Number(sh.expected) || 0 : expectedCash(sh, orders, payouts), counted: sh.close ? Number(sh.counted) || 0 : null, variance: sh.close ? Number(sh.variance) || 0 : null, closedBy: sh.closedBy ? who(sh.closedBy) : "" };
  }

  /* آخر نسخة من حالة الكاشير (من غير قائمة الطلبات الكاملة — دي بتيجي من pos_sales) */
  async function head() {
    var c = client();
    var cols = "day,rev,device,app_version,updated_at,shifts:state->shifts,payouts:state->payouts,staff:state->staff,settings:state->settings,store:state->store,avail:state->avail,prices:state->prices,seq:state->seq";
    var r = await c.from("pos_state").select(cols).eq("store_key", STORE).order("day", { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw r.error;
    return r.data || null;
  }
  async function salesOf(day) {
    var c = client();
    var r = await c.from("pos_sales").select("id,day,inv,status,total,refunded,data,updated_at").eq("store_key", STORE).eq("day", day).order("updated_at", { ascending: false }).limit(1000);
    if (r.error) throw r.error;
    return (r.data || []).map(function (x) { return x.data || {}; });
  }
  async function daysFrom(day, n) {
    var c = client();
    var from = addDays(day, -(n - 1));
    var r = await c.from("pos_sales").select("day,status,total,refunded,unpaid:data->unpaid").eq("store_key", STORE).gte("day", from).lte("day", day).limit(5000);
    if (r.error) throw r.error;
    var map = {};
    for (var i = 0; i < n; i++) map[addDays(from, i)] = { day: addDays(from, i), net: 0, count: 0 };
    (r.data || []).forEach(function (x) {
      if (x.status === "rejected" || x.unpaid === true || !map[x.day]) return;
      map[x.day].net = r2(map[x.day].net + (Number(x.total) || 0) - (Number(x.refunded) || 0));
      map[x.day].count++;
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }

  /* كل اللي صفحة المتابعة محتاجاه في نداء واحد */
  async function overview(days) {
    var h = await head();
    var day = (h && h.day) || dayKey();
    var res = await Promise.all([salesOf(day), daysFrom(day, days || 7)]);
    var orders = res[0];
    var shifts = (h && Array.isArray(h.shifts)) ? h.shifts : [];
    var staff = (h && Array.isArray(h.staff)) ? h.staff : [];
    var open = shifts.filter(function (s) { return s && !s.close; })[0] || null;
    var last = shifts.filter(function (s) { return s && s.close; }).sort(function (a, b) { return b.close - a.close; })[0] || null;
    var rep = open || last, shOrders = [];
    if (rep) {
      shOrders = orders.filter(function (o) { return o && o.shift === rep.id; });
      if (dayKey(rep.open) !== day) { try { shOrders = shOrders.concat((await salesOf(dayKey(rep.open))).filter(function (o) { return o && o.shift === rep.id; })); } catch (e) { /* الكشف يطلع من فواتير النهارده بس */ } }
    }
    var who = function (id) { var u = staff.filter(function (x) { return x.id === id; })[0]; return u ? u.name : ""; };
    return {
      hasCopy: !!h, day: day, today: day === dayKey(), savedAt: h ? new Date(h.updated_at).getTime() : 0,
      device: h ? h.device : "", version: h ? h.app_version : "", rev: h ? h.rev : 0,
      store: (h && h.store) || {}, settings: (h && h.settings) || {}, staffCount: staff.filter(function (u) { return !u.off; }).length,
      soldOut: h && h.avail ? Object.keys(h.avail).filter(function (k) { return h.avail[k] === false; }) : [],
      lastInvoice: h && h.seq ? h.seq.inv || 0 : 0,
      onduty: h && h.onduty ? h.onduty : null,
      shift: open ? { id: open.id, by: who(open.user), openedAt: open.open, float: Number(open.float) || 0, expected: expectedCash(open, shOrders, h.payouts) } : null,
      lastClosed: last,
      shiftRep: rep ? shiftReport(rep, shOrders, h.payouts, who) : null,
      sum: summarize(orders), orders: orders, days: res[1],
      staffNames: staff.reduce(function (m, u) { if (u && u.id) m[u.id] = u.name || ""; return m; }, {})
    };
  }

  w.PosData = { STORE: STORE, PAY: PAY, dayKey: dayKey, addDays: addDays, summarize: summarize, expectedCash: expectedCash, head: head, salesOf: salesOf, daysFrom: daysFrom, overview: overview };
})(window);
