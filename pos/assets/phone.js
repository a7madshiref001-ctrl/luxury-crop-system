/* جوال المدير — شاشة مربوطة بالكاشير بـQR (زي الكشك والمطبخ). من غير بريد ولا كلمة سر: المفتاح في الكود نفسه.
   الكاشير بيبعت الملخّص كل ما يتغيّر حاجة (فاتورة، وردية، صنف موقوف) فبيظهر هنا في نفس اللحظة. */
(function () {
  'use strict';
  const D = window.DARJ, L = window.DARJ_LINK;
  const root = document.getElementById('ph');
  const esc = D.esc;
  const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  // الوقت والتاريخ بتوقيت المحل (الرياض)، مش توقيت الجوال
  const clock = (t) => (t ? (D.time ? D.time(t) : new Date(t).toLocaleTimeString('ar-SA-u-nu-latn', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Riyadh' })) : '—');
  const date = (t) => (t ? (D.dateAr ? D.dateAr(t) : new Date(t).toLocaleDateString('ar-SA-u-nu-latn-ca-gregory', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Riyadh' })) : '');
  const ROLE = { manager: 'مدير', supervisor: 'مشرف وردية', cashier: 'كاشير' };
  const PAY = { cash: 'كاش', mada: 'مدى', apple: 'Apple Pay', stc: 'STC Pay', online: 'مدفوع أونلاين', credit: 'رصيد استبدال' };
  const ST = { new: 'بانتظار الدفع', prep: 'قيد التحضير', ready: 'جاهز', done: 'تم التسليم', rejected: 'ملغي', cancelled: 'ملغي' };
  const STN = { bar: 'الباريستا', kitchen: 'المطبخ' };
  const open = {}; let all = false;
  const head = (stat) => `<div class="ph__h"><img src="assets/brand/logo-mark.png" alt=""><div><b>محصول فاخر</b><small>متابعة المدير</small></div><span class="ph__sp"></span>${stat}</div>${D.SAT ? '<a class="btn btn--ink btn--block" href="app.html"><span class="bi"><b>Open cashier</b><small>الكاشير الكامل — تحكّم في كل حاجة من الجوال</small></span></a>' : ''}`;
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
      const old = x.day && x.day !== st.day ? (D.dateArS ? D.dateArS(x.ts) : date(x.ts)) + ' · ' : '';
      return `<details data-id="${esc(x.id)}"${open[x.id] ? ' open' : ''}><summary><span><b class="n">${esc((x.inv || 'طلب') + ' · #' + x.no)}${tag}</b><small>${esc(old + clock(x.ts) + who + (pays ? ' · ' + pays : ''))}</small></span><span class="v">${money(x.total)}</span></summary>`
        + x.lines.map((l) => `<div class="ph__il"><span>${esc(l.q + '× ' + l.n)}${l.note ? ' · ' + esc(l.note) : ''}</span><b>${money(l.t)}</b></div>`).join('') + `<div class="ph__meta">${esc(meta)}</div></details>`;
    }).join('');
    const w = st.who;
    const who = !w ? '' : w.u
      ? `<div class="ph__r"><span>على الكاشير الآن<small>${esc(ROLE[w.role] || '')} · مسجّل من ${esc(date(w.since))} ${clock(w.since)}</small></span><b>${esc(w.name)}</b></div>`
      : '<div class="ph__r"><span>على الكاشير الآن<small>الكاشير مقفول — لا أحد مسجّل</small></span><b>—</b></div>';
    // كشف الوردية (لو الكاشير لسه على نسخة قديمة ومابيبعتش shiftRep: سطرين الوردية القديمين في «الوضع الحالي»)
    const R = st.shiftRep;
    const shift = R ? '' : (st.shift
      ? `<div class="ph__r"><span>الوردية مفتوحة<small>${esc(st.shift.by || '')} · من ${esc(date(st.shift.open))} ${clock(st.shift.open)}</small></span><b></b></div><div class="ph__r"><span>النقد المتوقع في الدرج<small>افتتاحي ${money(st.shift.float)} ر.س</small></span><b>${money(st.shift.expected)}</b></div>`
      : '<div class="ph__r"><span>الوردية<small>لا توجد وردية مفتوحة</small></span><b></b></div>');
    // On duty: الكاشير + الباريستا + المطبخ — حتى لو أكتر من موظف على نفس الشاشة
    const prep = (w && w.prep) || [];
    const dutyRow = (st) => {
      const xs = prep.filter((x) => x.st === st);
      return `<div class="ph__r"><span>${STN[st]} الآن<small>${xs.length ? xs.map((x) => esc(x.name) + ' من ' + clock(x.since)).join(' · ') : 'لا أحد مسجّل على الشاشة'}</small></span><b>${xs.length ? esc(xs.map((x) => x.name.split(' ')[0]).join('، ')) : '—'}</b></div>`;
    };
    const duty = !w ? '' : `<div class="ph__c"><h3>On duty · مين شغّال الآن</h3>${who}${w.prep ? dutyRow('bar') + dutyRow('kitchen') : ''}</div>`;
    const nowRows = shift;
    const sr = (a, b, sub, cls) => `<div class="ph__r${cls ? ' ' + cls : ''}"><span>${a}${sub ? `<small>${sub}</small>` : ''}</span><b>${b}</b></div>`;
    const shiftCard = !R ? '' : `<div class="ph__big ph__big--sh"><small>Shift report · كشف الوردية · ${R.close ? 'اتقفلت' + (R.z ? ' ' + esc(R.z) : '') : 'مفتوحة الآن'}${R.reg > 1 ? ' · كاشير ' + R.reg : ''}</small><b>${money(R.net)}</b>`
      + `<span>صافي مبيعات الوردية · ${esc(R.by || '—')} · من ${esc(date(R.open))} ${clock(R.open)}${R.close ? ' لحد ' + clock(R.close) : ''}</span>`
      + `<div class="ph__sr">${sr('فواتير الوردية', R.count)}${R.refunds ? sr('مرتجعات', money(R.refunds)) : ''}`
      + Object.keys(R.pays || {}).sort((a, b) => R.pays[b] - R.pays[a]).map((k) => sr(esc(PAY[k] || k), money(R.pays[k]))).join('')
      + `${R.payouts ? sr('مصروفات من الدرج', money(R.payouts)) : ''}${sr('العهدة الافتتاحية', money(R.float))}`
      + sr(R.close ? 'كان المتوقع في الدرج' : 'النقد المتوقع في الدرج', money(R.expected), R.close ? '' : 'العهدة + الكاش − المرتجعات والمصروفات', 'ph__r--k')
      + (R.close ? sr('المعدود فعلًا', money(R.counted), esc(R.closedBy ? 'قفلها ' + R.closedBy : '')) + sr(R.variance < 0 ? 'عجز' : R.variance > 0 ? 'زيادة' : 'مطابق', money(Math.abs(R.variance || 0)), '', R.variance ? 'ph__r--bad' : '') : '')
      + `</div>${R.close ? '<p class="ph__note">لا توجد وردية مفتوحة الآن — ده كشف آخر وردية اتقفلت.</p>' : ''}</div>`;
    const multi = st.inv.some((x) => x.day && x.day !== st.day);
    root.innerHTML = head(pill) + duty
      + `<div class="ph__big"><small>Day report · كشف اليوم · صافي المبيعات ر.س</small><b>${money(net)}</b><span>${st.from ? esc(date(st.from)) + ' · ' : ''}${esc(st.hours || '')}${st.hours ? '<br>' : ''}${s.count ? 'آخر فاتورة رقم ' + (st.lastInv || '—') : 'لا توجد فواتير اليوم بعد'}</span></div>`
      + `<div class="ph__g"><div><b>${s.count}</b><small>فواتير اليوم</small></div><div><b>${money(avg)}</b><small>متوسط الفاتورة</small></div><div><b>${money(s.refunds)}</b><small>مرتجعات</small></div></div>`
      + shiftCard
      + `<div class="ph__c"><h3>Invoices · ${multi ? 'آخر الفواتير' : 'فواتير اليوم'}</h3>${inv || '<div class="ph__e">لا توجد فواتير اليوم حتى الآن.</div>'}${st.inv.length > 12 ? `<button class="btn btn--ghost ph__more" id="phMore">${all ? 'آخر 12 فاتورة فقط' : 'اعرض كل الفواتير (' + st.inv.length + ')'}</button>` : ''}</div>`
      + `<div class="ph__c"><h3>Now · الوضع الحالي</h3>${nowRows}<div class="ph__r"><span>طلبات قيد التحضير</span><b>${s.open}</b></div>${s.unpaid ? `<div class="ph__r"><span>طلبات لم تُحصّل بعد</span><b>${s.unpaid}</b></div>` : ''}<div class="ph__r"><span>أصناف موقوفة</span><b>${st.soldOut}</b></div></div>`
      + `<div class="ph__c"><h3>Payments · مدفوعات اليوم</h3>${by.length ? by.map((k) => `<div class="ph__r"><span>${esc(PAY[k] || k)}</span><b>${money(s.by[k])}</b></div>`).join('') : '<div class="ph__e">لا توجد مدفوعات اليوم.</div>'}</div>`
      + `<div class="ph__c"><h3>Top items · الأكثر مبيعًا</h3>${st.top.length ? st.top.map((x) => `<div class="ph__r"><span>${esc(x.n)}</span><b>×${x.q}</b></div>`).join('') : '<div class="ph__e">لسه مفيش مبيعات اليوم.</div>'}</div>`
      + '<p class="ph__f"><span lang="en">Built by ATHR</span></p>';
  }
  root.addEventListener('click', (e) => { if (e.target.closest('#phMore')) { all = !all; paint(); } });
  root.addEventListener('toggle', (e) => { const el = e.target; if (el && el.dataset && el.dataset.id) open[el.dataset.id] = el.open; }, true);
  L.on(paint);
  setInterval(paint, 30000);
  paint();
})();
