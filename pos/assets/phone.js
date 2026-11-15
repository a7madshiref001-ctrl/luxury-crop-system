/* جوال المدير — شاشة مربوطة بالكاشير بـQR (زي الكشك والمطبخ). من غير بريد ولا كلمة سر: المفتاح في الكود نفسه.
   الكاشير بيبعت الملخّص كل ما يتغيّر حاجة (فاتورة، وردية، صنف موقوف) فبيظهر هنا في نفس اللحظة. */
(function () {
  'use strict';
  const D = window.DARJ, L = window.DARJ_LINK;
  const root = document.getElementById('ph');
  const esc = D.esc;
  const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const clock = (t) => (t ? new Date(t).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit' }) : '—');
  const PAY = { cash: 'كاش', mada: 'مدى', apple: 'Apple Pay', stc: 'STC Pay', online: 'مدفوع أونلاين', credit: 'رصيد استبدال' };
  const ST = { new: 'بانتظار الدفع', prep: 'قيد التحضير', ready: 'جاهز', done: 'تم التسليم', rejected: 'ملغي', cancelled: 'ملغي' };
  const STN = { bar: 'الباريستا', kitchen: 'المطبخ' };
  const open = {}; let all = false;
  const head = (stat) => `<div class="ph__h"><img src="assets/brand/logo-mark.png" alt=""><div><b>محصول فاخر</b><small>متابعة المدير</small></div><span class="ph__sp"></span>${stat}</div>`;
  const ago = (t) => { const m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'الآن' : m < 60 ? 'من ' + m + ' دقيقة' : 'من ' + Math.round(m / 60) + ' ساعة'; };

  function cached() { try { return JSON.parse(localStorage.getItem((D.CFG.key || 'darj:v1') + ':stats') || 'null'); } catch (e) { return null; } }

  function paint() {
    if (!D.SAT) {
      root.innerHTML = head('') + '<div class="ph__c ph__empty"><b>الجوال غير مربوط بعد</b>افتح الكاشير على جهاز المحل ← Settings ← Devices، واضغط «ربط جهاز» عند «متابعة المدير من الجوال»، وامسح الكود بكاميرا هذا الجوال. مرة واحدة وتفضل مربوطة.</div>';
      return;
    }
    const st = L.stats || cached();
    const on = L.hubOnline();
    const pill = on ? '<span class="ph__st on"><i class="dot"></i>مباشر</span>' : `<span class="ph__st wait">بانتظار الكاشير${st ? ' · آخر نسخة ' + ago(st.at) : ''}</span>`;
    if (!st) { root.innerHTML = head(pill) + '<div class="ph__c ph__empty"><b>بانتظار الكاشير</b>أول ما يكون الكاشير مفتوحًا ومتصلًا بالإنترنت تظهر الأرقام هنا لحظيًا.</div>'; return; }
    const s = st.sum, net = D.r2(s.gross - s.refunds), avg = s.count ? D.r2(net / s.count) : 0, nm = st.names || {};
    const by = Object.keys(s.by).sort((a, b) => s.by[b] - s.by[a]);
    const shown = all ? st.inv : st.inv.slice(0, 12);
    const inv = shown.map((x) => {
      const bad = x.status === 'rejected' || x.cancelled;
      const pays = x.pays.map((p) => PAY[p.m] || p.m).join(' + ');
      const who = nm[x.staff] ? ' · ' + nm[x.staff] : x.ch === 'kiosk' ? ' · الكشك' : x.ch === 'table' || x.ch === 'pickup' ? ' · الموقع' : '';
      const tag = bad ? '<span class="ph__tag">ملغي</span>' : x.refunded ? `<span class="ph__tag">مرتجع ${money(x.refunded)}</span>` : x.unpaid ? '<span class="ph__tag">لم تُدفع</span>' : '';
      const made = Object.keys(x.sp || {}).map((k) => (STN[k] || k) + ': ' + (nm[x.sp[k]] || '—'));
      const meta = [ST[x.status] || x.status, made.length ? 'حضّره — ' + made.join(' · ') : '', x.doneBy && nm[x.doneBy] ? 'سلّمه ' + nm[x.doneBy] : '', x.name ? 'العميل: ' + x.name : ''].filter(Boolean).join(' · ');
      return `<details data-id="${esc(x.id)}"${open[x.id] ? ' open' : ''}><summary><span><b class="n">${esc((x.inv || 'طلب') + ' · #' + x.no)}${tag}</b><small>${esc(clock(x.ts) + who + (pays ? ' · ' + pays : ''))}</small></span><span class="v">${money(x.total)}</span></summary>`
        + x.lines.map((l) => `<div class="ph__il"><span>${esc(l.q + '× ' + l.n)}${l.note ? ' · ' + esc(l.note) : ''}</span><b>${money(l.t)}</b></div>`).join('') + `<div class="ph__meta">${esc(meta)}</div></details>`;
    }).join('');
    const shift = st.shift
      ? `<div class="ph__r"><span>الوردية مفتوحة<small>${esc(st.shift.by || '')} · من ${clock(st.shift.open)}</small></span><b></b></div><div class="ph__r"><span>النقد المتوقع في الدرج<small>افتتاحي ${money(st.shift.float)} ر.س</small></span><b>${money(st.shift.expected)}</b></div>`
      : '<div class="ph__r"><span>الوردية<small>لا توجد وردية مفتوحة</small></span><b></b></div>';
    root.innerHTML = head(pill)
      + `<div class="ph__big"><small>صافي مبيعات اليوم · ر.س</small><b>${money(net)}</b><span>${s.count ? 'آخر فاتورة رقم ' + (st.lastInv || '—') : 'لا توجد فواتير اليوم بعد'}</span></div>`
      + `<div class="ph__g"><div><b>${s.count}</b><small>فواتير</small></div><div><b>${money(avg)}</b><small>متوسط الفاتورة</small></div><div><b>${money(s.refunds)}</b><small>مرتجعات</small></div></div>`
      + `<div class="ph__c"><h3>Invoices · فواتير اليوم</h3>${inv || '<div class="ph__e">لا توجد فواتير اليوم حتى الآن.</div>'}${st.inv.length > 12 ? `<button class="btn btn--ghost ph__more" id="phMore">${all ? 'آخر 12 فاتورة فقط' : 'اعرض كل الفواتير (' + st.inv.length + ')'}</button>` : ''}</div>`
      + `<div class="ph__c"><h3>Now · الوضع الحالي</h3>${shift}<div class="ph__r"><span>طلبات قيد التحضير</span><b>${s.open}</b></div>${s.unpaid ? `<div class="ph__r"><span>طلبات لم تُحصّل بعد</span><b>${s.unpaid}</b></div>` : ''}<div class="ph__r"><span>أصناف موقوفة</span><b>${st.soldOut}</b></div></div>`
      + `<div class="ph__c"><h3>Payments · المدفوعات</h3>${by.length ? by.map((k) => `<div class="ph__r"><span>${esc(PAY[k] || k)}</span><b>${money(s.by[k])}</b></div>`).join('') : '<div class="ph__e">لا توجد مدفوعات اليوم.</div>'}</div>`
      + `<div class="ph__c"><h3>Top items · الأكثر مبيعًا</h3>${st.top.length ? st.top.map((x) => `<div class="ph__r"><span>${esc(x.n)}</span><b>×${x.q}</b></div>`).join('') : '<div class="ph__e">لسه مفيش مبيعات اليوم.</div>'}</div>`
      + '<p class="ph__f"><span lang="en">Built by ATHR</span></p>';
  }
  root.addEventListener('click', (e) => { if (e.target.closest('#phMore')) { all = !all; paint(); } });
  root.addEventListener('toggle', (e) => { const el = e.target; if (el && el.dataset && el.dataset.id) open[el.dataset.id] = el.open; }, true);
  L.on(paint);
  setInterval(paint, 30000);
  paint();
})();
