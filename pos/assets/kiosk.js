/* DARJ — كشك الطلب والدفع الذاتي (kiosk.html)
   آيباد في المكان: العميل يختار محلي/سفري، يطلب، ويدفع بالبطاقة على الكشك أو عند الكاشير.
   بعد الدفع الطلب بيروح لوحده للباريستا أو المطبخ (حسب توجيه الأصناف في الإعدادات)، ورقمه يظهر على شاشة الطلبات. */
(function () {
  'use strict';
  const D = window.DARJ;
  const L = window.DARJ_LINK || { pill: () => '', hubOnline: () => true, on: () => () => {}, track: () => {} };
  const $ = (s, r) => (r || document).querySelector(s);
  const I = D.icon, esc = D.esc, fmt = D.fmt;
  const bi = (en, ar) => `<span class="bi"><b>${en}</b><small>${ar}</small></span>`;
  const root = $('#kx');
  const S = () => D.state();
  let screen = 'hello', type = 'takeaway', cat = null, lines = [], name = '', busy = false, result = null, last = Date.now(), idleT = null, doneT = null, openCart = false;

  const priceOf = (p) => D.priceOf(S(), p);
  const avail = (p) => S().avail[p.id] !== false;
  const cats = () => {
    const cs = D.CATS.filter((c) => D.PRODUCTS.some((p) => p.cat === c.id));
    const off = cs.filter((c) => c.id === 'offers');
    return off.concat(cs.filter((c) => c.id !== 'offers'));
  };
  const total = () => D.r2(lines.reduce((a, l) => a + D.lineTotal(S(), l), 0));
  const count = () => lines.reduce((a, l) => a + l.qty, 0);
  const cfg = () => D.kioskCfg(S());
  const cardOk = () => cfg().card && D.kioskCard();
  const online = () => L.hubOnline();
  const hasBoard = () => !(D.CFG && D.CFG.board === false); // شاشة حالة الطلبات شغالة في المكان؟

  /* ---------- screens ---------- */
  function hello() {
    const pics = D.PRODUCTS.filter((p) => D.img(p) && avail(p)).slice(0, 40);
    const pick = [0, 7, 15, 24, 31, 38].map((i) => pics[i % (pics.length || 1)]).filter(Boolean);
    const closed = !cfg().on;
    root.innerHTML = `<div class="kh">
      <div class="kh__l">
        <div class="kh__brand">${D.brand('Self-order')}</div>
        <span class="label">Order here · اطلب من هنا</span>
        <h1>${closed ? 'Closed<br>for now.' : 'Order<br>&amp; pay here.'}</h1>
        <p>${closed ? 'الكشك مغلق حاليًا — تفضّل بالطلب من الكاشير.' : 'اختر مشروبك وطلبك وادفع من هنا. بعد الدفع يصل طلبك للباريستا والمطبخ مباشرة' + (hasBoard() ? '، ويظهر رقمك على الشاشة.' : '، وسننادي على رقمك لما يجهز.')}</p>
        ${closed ? '' : `<div class="kh__go">
          <button class="kh__opt" data-type="dinein">${I('table')}${bi('Dine in', 'محلي — هنا في الكافيه')}</button>
          <button class="kh__opt" data-type="takeaway">${I('bag')}${bi('Takeaway', 'سفري — للخارج')}</button></div>`}
        <div class="kh__foot">${L.pill()}${D.TRAIN || (!D.SAT && !D.REAL) ? '<span class="demo-tag">Training</span>' : ''}</div>
      </div>
      <div class="kh__r">${pick.map((p, i) => `<span class="kh__pic kh__pic--${i}" style="background-image:url('${D.img(p)}')"></span>`).join('')}</div>
    </div>`;
  }
  function menu() {
    const cs = cats();
    if (!cat || !cs.some((c) => c.id === cat)) cat = cs[0] && cs[0].id;
    const items = D.PRODUCTS.filter((p) => p.cat === cat);
    const c0 = cs.find((c) => c.id === cat) || {};
    root.innerHTML = `<div class="km${openCart ? ' cart-open' : ''}">
      <header class="km__top">${D.brand('Self-order')}<div class="seg" id="ty"><button data-ty="dinein" class="${type === 'dinein' ? 'on' : ''}">${I('table', 'sm')} Dine in · محلي</button><button data-ty="takeaway" class="${type === 'takeaway' ? 'on' : ''}">${I('bag', 'sm')} Takeaway · سفري</button></div><span class="km__sp"></span>${L.pill()}<button class="btn btn--ghost btn--sm" data-a="restart">${I('refund', 'sm')} ${bi('Start over', 'ابدأ من جديد')}</button></header>
      <nav class="km__cats">${cs.map((c) => `<button data-cat="${c.id}" class="${c.id === cat ? 'on' : ''}">${I(c.ic || 'cup')}${bi(esc(c.en), esc(c.ar))}</button>`).join('')}</nav>
      <main class="km__grid"><div class="km__h"><span class="label">${esc(c0.en || '')}</span><h2>${esc(c0.ar || '')}</h2></div>
        <div class="km__items">${items.map(card).join('')}</div></main>
      <aside class="km__cart">${cartHTML()}</aside>
      <button class="km__bar" data-a="cart" ${count() ? '' : 'hidden'}><span class="km__n">${count()}</span>${bi('Your order', 'طلبك')}<span class="km__t">${D.money(total())}</span>${I('chev', 'sm')}</button>
    </div>`;
  }
  function card(p) {
    const off = !avail(p);
    const n = lines.filter((l) => l.pid === p.id).reduce((a, l) => a + l.qty, 0);
    return `<button class="kp${off ? ' off' : ''}" data-p="${p.id}" ${off ? 'disabled' : ''}>
      <span class="kp__img" ${D.img(p) ? `style="background-image:url('${D.img(p)}')"` : ''}>${n ? `<i class="kp__n">${n}</i>` : ''}${off ? '<i class="kp__off">Sold out · نفد</i>' : ''}</span>
      <span class="kp__b"><b>${esc(p.ar)}</b><small>${esc(p.desc || p.en)}</small></span>
      <span class="kp__p">${p.was ? `<s>${fmt(p.was, 0)}</s>` : ''}${D.money(priceOf(p), priceOf(p) % 1 ? 2 : 0)}</span></button>`;
  }
  function cartHTML() {
    if (!lines.length) return `<div class="kc__empty">${I('cup')}<b>${bi('Your order', 'طلبك')}</b><span>اضغط على أي صنف لإضافته</span></div>`;
    return `<div class="kc__h">${bi('Your order', 'طلبك')}<span class="muted">${count()} صنف</span><button class="icon-btn kc__x" data-a="cart" aria-label="إغلاق">${I('x', 'sm')}</button></div>
      <div class="kc__lines">${lines.map((l, i) => { const p = D.prod(l.pid); const mods = D.modText(l).join(' · '); return `<div class="kc__l"><span class="kc__img" ${D.img(p) ? `style="background-image:url('${D.img(p)}')"` : ''}></span><span class="kc__n"><b>${esc(p.ar)}</b><small>${esc(mods || p.en)}</small><span class="kc__q"><button data-q="${i}" data-d="-1" aria-label="أقل">${I('minus', 'sm')}</button><span>${l.qty}</span><button data-q="${i}" data-d="1" aria-label="أكثر">${I('plus', 'sm')}</button></span></span><span class="kc__p">${fmt(D.lineTotal(S(), l))}</span></div>`; }).join('')}</div>
      <div class="kc__f"><div class="kc__tot"><span>${bi('Total', 'الإجمالي')}</span>${D.money(total())}</div>
        ${online() ? `<button class="btn btn--go btn--lg btn--block" data-a="checkout">${bi('Checkout', 'متابعة الدفع')}${I('chev', 'sm')}</button>` : `<div class="kc__off">${I('wifioff', 'sm')}<span>الكشك غير متصل بالكاشير الآن — تفضّل بالطلب من الكاشير</span></div>`}</div>`;
  }
  function pay() {
    const k = cfg(); const card = cardOk(); const counter = k.counter || !card;
    root.innerHTML = `<div class="kpay">
      <header class="km__top">${D.brand('Self-order')}<span class="km__sp"></span><button class="btn btn--ghost btn--sm" data-a="back">${I('arrow', 'sm')} ${bi('Back', 'رجوع للطلب')}</button></header>
      <div class="kpay__in">
        <div class="kpay__sum"><span class="label">Review · مراجعة الطلب</span>
          ${lines.map((l) => { const p = D.prod(l.pid); return `<div class="kpay__l"><b>${l.qty}×</b><span>${esc(p.ar)}<small>${esc(D.modText(l).join(' · ') || p.en)}</small></span><span>${fmt(D.lineTotal(S(), l))}</span></div>`; }).join('')}
          <div class="kpay__tot"><span>${bi('Total', 'الإجمالي')}</span>${D.money(total())}</div>
          <label class="field"><span>اسمك — لننادي عليك (اختياري)</span><input class="input" id="kName" maxlength="20" value="${esc(name)}" autocomplete="off"></label>
        </div>
        <div class="kpay__how"><span class="label">How to pay · طريقة الدفع</span><h2>كيف تحب تدفع؟</h2>
          ${card ? `<button class="kpay__opt" data-pay="card"><span class="kpay__ic">${['mada', 'apple', 'stc'].map((m) => `<span>${D.payIcon(m)}</span>`).join('')}</span>${bi('Pay here by card', 'بطاقة مدى أو Apple Pay — هنا على الكشك')}<small>يبدأ تحضير طلبك مباشرة بعد الدفع</small></button>` : ''}
          ${counter ? `<button class="kpay__opt" data-pay="counter"><span class="kpay__ic">${I('register')}</span>${bi('Pay at the counter', 'ادفع عند الكاشير')}<small>أخبر الكاشير برقم طلبك، ويبدأ التحضير بعد الدفع</small></button>` : ''}
        </div>
      </div></div>`;
    const ni = $('#kName'); if (ni) ni.addEventListener('input', () => { name = ni.value.trim(); });
  }
  function charging(a) {
    root.innerHTML = `<div class="kmsg"><div class="term wait"><div style="position:relative"><svg class="term__waves" width="60" height="26" viewBox="0 0 60 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 20a17 17 0 0 1 24 0M10 13a28 28 0 0 1 40 0M25 25a8 8 0 0 1 10 0"/></svg><div class="term__dev"><i>${fmt(a)}</i></div></div>
      <h2>قرّب البطاقة أو الجوال</h2><p>Tap your card or phone · ${fmt(a)} ر.س</p>${D.REAL && !D.SAT ? '' : '<span class="demo-tag">Training · دفع تجريبي</span>'}</div></div>`;
  }
  function sending() { root.innerHTML = `<div class="kmsg"><div class="kspin"></div><h2>جارٍ إرسال طلبك…</h2><p>Sending your order</p></div>`; }
  function done() {
    const r = result; const paid = !!r.paid;
    const sts = r.sts || [];
    root.innerHTML = `<div class="kdone">
      <span class="label">${paid ? 'Paid · تم الدفع' : 'Order placed · تم تسجيل طلبك'}</span>
      <div class="kdone__no"><small>رقم طلبك</small><b>#${r.no}</b></div>
      <h2>${paid ? (sts.length ? `وصل طلبك ${sts.map((x) => (x === 'bar' ? 'للباريستا' : 'للمطبخ')).join(' و')} — جارٍ تجهيزه الآن` : 'طلبك جاهز — استلمه من الكاشير') : 'تفضّل للكاشير وأخبره برقمك، ويبدأ التحضير بعد الدفع'}</h2>
      <div class="kdone__steps"><span class="on">${I('check', 'sm')}${bi('Received', 'استلمنا')}</span><i></i><span class="${paid ? 'on' : ''}">${I(paid ? 'check' : 'cash', 'sm')}${bi('Paid', paid ? 'تم الدفع' : 'عند الكاشير')}</span><i></i><span>${I('cup', 'sm')}${bi('Preparing', 'قيد التحضير')}</span><i></i><span>${I('bell', 'sm')}${bi('Ready', 'جاهز')}</span></div>
      <p>${hasBoard() ? `تابع رقمك على شاشة الطلبات${r.name ? `، وسننادي عليك يا <b>${esc(r.name)}</b>` : ''}` : r.name ? `سننادي عليك يا <b>${esc(r.name)}</b> لما يجهز طلبك` : 'احتفظ برقمك، وسننادي عليه لما يجهز طلبك'}.${paid ? ` · ${fmt(r.total)} ر.س` : ` · المطلوب ${fmt(r.total)} ر.س`}</p>
      <button class="btn btn--ink btn--lg" data-a="new">${bi('New order', 'طلب جديد')} <span class="muted" id="cd"></span></button>
    </div>`;
    let n = 15;
    clearInterval(doneT);
    doneT = setInterval(() => { n -= 1; const c = $('#cd'); if (c) c.textContent = n + 's'; if (n <= 0) { clearInterval(doneT); reset(); } }, 1000);
  }
  function fail(msg) {
    root.innerHTML = `<div class="kmsg">${I('alert')}<h2>${msg}</h2><p>تفضّل بمراجعة الكاشير — سيساعدك فورًا.</p><button class="btn btn--ink btn--lg" data-a="pay">${bi('Try again', 'حاول مرة أخرى')}</button><button class="btn btn--ghost" data-a="restart">${bi('Start over', 'ابدأ من جديد')}</button></div>`;
  }

  /* ---------- item sheet ---------- */
  function sheet(pid) {
    const p = D.prod(pid);
    const line = { key: D.uid(), pid, qty: 1, mods: D.defMods(p), note: '' };
    const ov = document.createElement('div');
    ov.className = 'ksheet';
    document.body.appendChild(ov);
    const unit = () => D.unitPrice(S(), line);
    function paint() {
      ov.innerHTML = `<div class="ksheet__in" role="dialog" aria-modal="true">
        <button class="icon-btn ksheet__x" data-x aria-label="إغلاق">${I('x')}</button>
        <div class="ksheet__img" ${D.img(p) ? `style="background-image:url('${D.img(p)}')"` : ''}></div>
        <div class="ksheet__b"><span class="label">${esc(p.en)}</span><h2>${esc(p.ar)}</h2>${p.desc ? `<p>${esc(p.desc)}</p>` : ''}
          ${p.mods.map((g) => { const G = D.MODS[g]; if (!G) return ''; return `<div class="ksheet__g"><div class="ksheet__gh">${bi(esc(G.en), esc(G.ar))}<small>${G.one ? 'اختر واحدًا' : 'اختياري'}</small></div><div class="ksheet__opts">${G.opts.map((o) => { const on = G.one ? line.mods[g] === o.id : (line.mods[g] || []).includes(o.id); return `<button class="ko${on ? ' on' : ''}" data-g="${g}" data-o="${o.id}"><span>${esc(o.ar)}</span>${o.d ? `<small>+${fmt(o.d, o.d % 1 ? 2 : 0)}</small>` : ''}</button>`; }).join('')}</div></div>`; }).join('')}
        </div>
        <div class="ksheet__f"><span class="kc__q lg"><button data-qd="-1" aria-label="أقل">${I('minus')}</button><span>${line.qty}</span><button data-qd="1" aria-label="أكثر">${I('plus')}</button></span>
          <button class="btn btn--go btn--lg" data-add>${bi('Add to order', 'أضف للطلب')} · ${fmt(unit() * line.qty)}</button></div></div>`;
    }
    paint();
    const close = () => { ov.classList.add('out'); setTimeout(() => ov.remove(), 200); };
    ov.addEventListener('click', (e) => {
      if (e.target === ov || e.target.closest('[data-x]')) { close(); return; }
      const o = e.target.closest('[data-o]');
      if (o) { const g = o.dataset.g, id = o.dataset.o; const G = D.MODS[g]; if (G.one) line.mods[g] = id; else { const cur = line.mods[g] || []; line.mods[g] = cur.includes(id) ? cur.filter((x) => x !== id) : cur.concat(id); } paint(); return; }
      const q = e.target.closest('[data-qd]');
      if (q) { line.qty = Math.max(1, Math.min(20, line.qty + +q.dataset.qd)); paint(); return; }
      if (e.target.closest('[data-add]')) {
        const same = lines.find((l) => l.pid === line.pid && JSON.stringify(l.mods) === JSON.stringify(line.mods));
        if (same) same.qty = Math.min(20, same.qty + line.qty); else lines.push(line);
        D.sound('ok');
        close(); render();
        const fab = $('.km__bar'); if (fab) { fab.classList.remove('pop'); void fab.offsetWidth; fab.classList.add('pop'); }
      }
    });
  }

  /* ---------- flow ---------- */
  function render() { ({ hello, menu, pay }[screen] || hello)(); }
  function reset() {
    clearInterval(doneT); lines = []; name = ''; cat = null; result = null; busy = false; openCart = false; screen = 'hello';
    document.querySelectorAll('.ksheet,.kidle').forEach((x) => x.remove());
    render();
  }
  async function place(method) {
    if (busy || !lines.length) return;
    if (!online()) { fail('الكشك غير متصل بالكاشير الآن'); return; }
    busy = true;
    const amount = total();
    let payInfo = null;
    if (method === 'card') {
      charging(amount);
      await new Promise((r) => setTimeout(r, 2300));
      payInfo = { m: Math.random() < .6 ? 'mada' : 'apple', auth: String(100000 + Math.floor(Math.random() * 899999)) };
      D.sound('ok');
    }
    sending();
    const draft = { kid: 'k' + D.uid(), type, name, lines: lines.map((l) => ({ pid: l.pid, qty: l.qty, mods: l.mods, note: l.note || '' })), pay: payInfo };
    let r = null;
    try { r = await Promise.resolve(D.act('kiosk', { draft })); } catch (e) { r = null; }
    busy = false;
    if (!r || !r.no) { fail(method === 'card' ? `تم دفع ${fmt(amount)} ر.س لكن الطلب لم يصل — رقم العملية ${payInfo.auth}` : 'لم يصل الطلب للكاشير'); return; }
    const sts = D.stationsOf(S(), { lines: draft.lines.map((l) => Object.assign({}, l, { st: D.routeOf(S(), D.prod(l.pid)) })), voided: {} });
    result = { no: r.no, total: r.total != null ? r.total : amount, paid: !!payInfo, name, sts };
    screen = 'done';
    D.sound('ready');
    done();
  }
  root.addEventListener('click', (e) => {
    last = Date.now();
    const t = e.target.closest('[data-type]');
    if (t) { type = t.dataset.type; screen = 'menu'; render(); return; }
    const ty = e.target.closest('[data-ty]');
    if (ty) { type = ty.dataset.ty; render(); return; }
    const c = e.target.closest('[data-cat]');
    if (c) { cat = c.dataset.cat; render(); const g = $('.km__grid'); if (g) g.scrollTop = 0; return; }
    const p = e.target.closest('[data-p]');
    if (p) { sheet(p.dataset.p); return; }
    const q = e.target.closest('[data-q]');
    if (q) { const i = +q.dataset.q; lines[i].qty = Math.min(20, lines[i].qty + +q.dataset.d); if (lines[i].qty <= 0) lines.splice(i, 1); if (!lines.length) openCart = false; render(); return; }
    const py = e.target.closest('[data-pay]');
    if (py) { place(py.dataset.pay); return; }
    const a = e.target.closest('[data-a]');
    if (!a) return;
    const act = a.dataset.a;
    if (act === 'restart') reset();
    if (act === 'cart') { openCart = !openCart; render(); }
    if (act === 'checkout') {
      const gone = lines.filter((l) => S().avail[l.pid] === false);
      if (gone.length) { // صنف نفد وهو في السلة
        lines = lines.filter((l) => S().avail[l.pid] !== false);
        D.toast('نفد صنف من طلبك', gone.map((l) => D.prod(l.pid).ar).join('، ') + ' — تمت إزالته', { warn: 1, ic: 'alert', ms: 5000 });
        if (!lines.length) openCart = false;
        render(); return;
      }
      screen = 'pay'; openCart = false; render();
    }
    if (act === 'back') { screen = 'menu'; render(); }
    if (act === 'pay') { screen = 'pay'; render(); }
    if (act === 'new') reset();
  });
  // لو العميل سابه: سؤال «لسه معانا؟» وبعدين يرجع للبداية
  ['pointerdown', 'keydown'].forEach((ev) => document.addEventListener(ev, () => { last = Date.now(); }, { passive: true }));
  setInterval(() => {
    if (screen === 'hello' || screen === 'done' || busy || document.querySelector('.kidle')) return;
    if (Date.now() - last < 75000) return;
    const el = document.createElement('div');
    el.className = 'kidle';
    let n = 12;
    const paint = () => { el.innerHTML = `<div class="kidle__in"><h2>هل ما زلت هنا؟</h2><p>Still there? · سنبدأ من جديد بعد <b>${n}</b> ثانية</p><button class="btn btn--ink btn--lg" data-stay>${bi('Continue', 'نعم، أكمل')}</button></div>`; };
    paint(); document.body.appendChild(el);
    const t = setInterval(() => { n -= 1; if (!el.isConnected) { clearInterval(t); return; } if (n <= 0) { clearInterval(t); reset(); return; } paint(); }, 1000);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-stay]')) { clearInterval(t); el.remove(); last = Date.now(); } });
  }, 4000);
  // الأسعار والأصناف الخالصة بتتحدّث من الكاشير
  // (بس لو حاجة تخص الكشك اتغيّرت، عشان السكرول ميرجعش لفوق مع كل طلب في المحل)
  const sig = () => JSON.stringify([S().avail, S().prices, cfg(), online(), D.TRAIN]);
  let lastSig = '';
  const maybe = () => { const s = sig(); if (s === lastSig || busy) return; lastSig = s; if (!cfg().on && (screen === 'menu' || screen === 'pay')) { reset(); return; } if (screen === 'menu' || screen === 'hello') render(); else if (screen === 'pay' && !online()) render(); };
  D.on((why) => { if (why !== 'cart') maybe(); });
  L.on(maybe);
  lastSig = sig();
  L.track({ name: 'الكشك' });
  render();
})();
