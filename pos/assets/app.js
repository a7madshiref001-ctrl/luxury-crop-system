/* DARJ — the cashier app (one page, hash routes)
   sell · orders · barista · shift · menu · stock · customers · reports · team · settings */
(function () {
  'use strict';
  const D = window.DARJ;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => [...(r || document).querySelectorAll(s)];
  const I = D.icon, esc = D.esc, money = D.money, fmt = D.fmt;
  const S = () => D.state();

  /* ---------- session ---------- */
  let me = null;
  try { me = sessionStorage.getItem('darj:me'); } catch (e) { /* */ }
  const can = (perm) => (me ? D.can(me, perm) : 0);
  const approverId = (u) => (u && u.id !== me ? u.id : null);
  let lang = 'ar';
  const tr = (ar, en) => (lang === 'en' ? en : ar);
  // اسم الحاجة بالإنجليزي وتحته العربي — الإنجليزي بيرسم الخريطة، والعربي بيشرح
  const bi = (en, ar) => `<span class="bi"><b>${en}</b><small>${ar}</small></span>`;
  const stepper = (list, cur) => `<div class="steps">${list.map(([en, ar], i) => `${i ? `<span class="bar${i <= cur ? ' done' : ''}"></span>` : ''}<span class="st${i < cur ? ' done' : i === cur ? ' on' : ''}"><i>${i < cur ? I('check') : i + 1}</i>${bi(en, ar)}</span>`).join('')}</div>`;
  const check = (cls) => `<svg class="chk${cls ? ' ' + cls : ''}" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34"/><path d="M22 37l9 9 19-20"/></svg>`;

  /* ---------- routes ---------- */
  const ROUTES = [
    { id: 'sell', en: 'Sell', ar: 'البيع', ic: 'register', perm: 'sell' },
    { id: 'orders', en: 'Orders', ar: 'الطلبات', ic: 'orders', perm: 'sell' },
    { id: 'kds', en: 'Stations', ar: 'الباريستا والمطبخ', ic: 'cup', perm: 'kds' },
    { id: 'shift', en: 'Shift', ar: 'الوردية', ic: 'shift', perm: 'close' },
    { id: 'menu', en: 'Menu', ar: 'المنيو', ic: 'menu', perm: 'avail' },
    { id: 'stock', en: 'Stock', ar: 'المخزون', ic: 'stock', perm: 'stock' },
    { id: 'customers', en: 'Customers', ar: 'العملاء', ic: 'users', perm: 'sell' },
    { id: 'reports', en: 'Reports', ar: 'التقارير', ic: 'chart', perm: 'reports' },
    { id: 'team', en: 'Team', ar: 'الفريق', ic: 'shield', perm: 'team' },
    { id: 'settings', en: 'Settings', ar: 'الإعدادات', ic: 'gear', perm: 'settings' },
  ];
  let route = (location.hash || '#sell').slice(1).split('?')[0] || 'sell';
  const wantGuide = route === 'guide'; // app.html#guide بيفتح الجولات بعد الدخول
  if (!ROUTES.some((r) => r.id === route)) route = 'sell';

  /* ---------- shell ---------- */
  function shell() {
    document.body.innerHTML = `<div class="app">
      <header class="top">
        <div class="top__brand">${D.brand()}${D.REAL ? '' : `<span class="demo-tag">${D.TRAIN ? 'Training' : 'Demo'}</span>`}</div>
        <div class="top__store">${I('store', 'sm')}${esc(D.STORE.nameAr)} · ${esc(D.STORE.branchAr)} <small>· كاشير 1</small></div>
        <div class="top__sp"></div>
        <div class="top__right">
          ${D.REAL ? '' : `<button class="guide-btn" id="guide" title="جولة تفاعلية">${I('play')}<span>Guide · جولة</span></button>`}
          <button class="net" id="net" title="حالة الاتصال"></button>
          <button class="icon-btn" id="bell" aria-label="النشاط">${I('bell')}<span class="badge" id="bellN" hidden></span></button>
          <button class="me" id="me"></button>
        </div>
      </header>
      <nav class="rail" id="rail"></nav>
      <main class="main" id="main"></main>
    </div>`;
    $('#net').addEventListener('click', toggleNet);
    if ($('#guide')) $('#guide').addEventListener('click', openGuide);
    $('#bell').addEventListener('click', openFeed);
    $('#me').addEventListener('click', openMe);
    $('#rail').addEventListener('click', (e) => {
      if (e.target.closest('[data-more]')) { e.preventDefault(); moreRoutes(); return; }
      const a = e.target.closest('a[data-r]'); if (!a) return;
      e.preventDefault();
      const r = ROUTES.find((x) => x.id === a.dataset.r);
      if (!can(r.perm)) { lockedRoute(r); return; }
      go(r.id);
    });
  }
  function chrome() {
    const s = S();
    const user = D.staff(me);
    const newCount = s.orders.filter((o) => o.status === 'new').length;
    const low = D.ING.filter((i) => s.stock[i.id] < i.par).length;
    $('#rail').innerHTML = ROUTES.map((r, i) => {
      const badge = r.id === 'orders' && newCount ? `<span class="badge">${newCount}</span>` : r.id === 'stock' && low && can('stock') ? `<span class="badge" style="background:var(--amber)">${low}</span>` : '';
      return `${i === 7 ? '<div class="rail__sp"></div>' : ''}<a href="#${r.id}" data-r="${r.id}" class="${route === r.id ? 'on' : ''}${i > 3 ? ' x' : ''}" ${can(r.perm) ? '' : 'style="opacity:.45"'}>${I(r.ic)}${bi(r.en, r.ar)}${badge}</a>`;
    }).join('') + `<a href="#more" class="more${ROUTES.findIndex((r) => r.id === route) > 3 ? ' on' : ''}" data-more>${I('menu')}${bi('More', 'المزيد')}</a>`;
    const pend = s.orders.filter((o) => !o.synced).length + s.pendingRemote.length;
    const net = $('#net');
    if (!net.classList.contains('sync')) {
      net.className = 'net' + (s.settings.offline ? ' off' : '');
      net.innerHTML = s.settings.offline ? `${I('wifioff', 'sm')}<span>Offline · ${pend} بانتظار المزامنة</span>` : `<i class="dot pulse"></i><span>Live · متصل</span>`;
    }
    const unread = s.feed.filter((f) => f.ts > feedSeen).length;
    $('#bellN').hidden = !unread; $('#bellN').textContent = unread;
    $('#me').innerHTML = `${D.av(user)}<span class="me__txt"><b>${esc(user.short)}</b><small>${D.ROLES[user.role].ar}</small></span>`;
    drawInbox();
  }
  // الطلبات المستنية موافقة الكاشير (الموقع) أو تحصيل (الكشك): كارت ثابت في أي صفحة
  let inboxMin = false;
  function drawInbox() {
    let box = $('#inbox');
    const s = S();
    const list = me && can('sell') === 1 ? s.orders.filter((o) => o.status === 'new').sort((a, b) => a.ts - b.ts) : [];
    const hide = !list.length || (route === 'orders' && otab === 'online') || document.querySelector('.lock');
    if (hide) { if (box) box.remove(); return; }
    if (!box) { box = document.createElement('div'); box.id = 'inbox'; box.className = 'inbox'; document.body.appendChild(box); box.addEventListener('click', inboxClick); }
    const o = list[0];
    const src = o.ch === 'kiosk' ? `الكشك · ${D.TYPES[o.type].ar}` : `${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''}${o.label ? ' · ' + esc(o.label) : ''}`;
    const items = o.lines.map((l) => `${l.qty}× ${D.prod(l.pid).ar}`).join('، ');
    const sts = D.stationsOf(s, o).map((x) => D.STATIONS[x].ar).join(' + ');
    box.className = 'inbox' + (inboxMin ? ' min' : '');
    box.innerHTML = `<div class="inbox__h"><span><i class="dot pulse"></i>${bi('Incoming · ' + list.length, o.payFirst ? 'بانتظار الدفع عند الكاشير' : 'بانتظار موافقتك')}</span><button class="icon-btn" data-ib="min" aria-label="تصغير">${I(inboxMin ? 'plus' : 'minus', 'sm')}</button></div>
      ${inboxMin ? '' : `<div class="inbox__o"><span class="ocard__no"><b>#${o.no}</b><small>${D.ago(o.ts)}</small></span><div style="min-width:0"><b>${esc(o.name || 'عميل')} · ${src}</b><p>${esc(items)}</p><small>${money(o.total)} · ${o.payFirst ? 'يدفع عند الكاشير' : o.unpaid ? 'الدفع عند الكاشير' : 'مدفوع'}${sts ? ' · يذهب إلى ' + sts : ''}</small></div></div>
      <div class="inbox__a">${o.payFirst ? `<button class="btn btn--ghost btn--sm" data-ib="kcancel" data-id="${o.id}">${bi('Cancel', 'إلغاء')}</button><button class="btn btn--go btn--sm" data-ib="collect" data-id="${o.id}">${I('cash', 'sm')}${bi('Collect', 'تحصيل')}</button>` : `<button class="btn btn--ghost btn--sm" data-ib="reject" data-id="${o.id}">${bi('Reject', 'رفض')}</button><button class="btn btn--go btn--sm" data-ib="accept" data-id="${o.id}">${I('check', 'sm')}${bi('Accept', 'اقبل وأرسل للتحضير')}</button>`}${list.length > 1 ? `<button class="btn btn--soft btn--sm" data-ib="all">${bi('All · ' + list.length, 'الكل')}</button>` : ''}</div>`}`;
  }
  function inboxClick(e) {
    const b = e.target.closest('[data-ib]'); if (!b) return;
    const a = b.dataset.ib, id = b.dataset.id;
    if (a === 'min') { inboxMin = !inboxMin; drawInbox(); return; }
    if (a === 'all') { otab = 'online'; go('orders'); return; }
    if (a === 'accept') acceptOrder(id);
    if (a === 'reject') rejectOnline(id);
    if (a === 'kcancel') cancelKiosk(id);
    if (a === 'collect') openPay(S().orders.find((x) => x.id === id));
  }
  function moreRoutes() {
    const m = D.modal(`${D.head(bi('All pages', 'كل الصفحات'))}<div class="modal__b"><div class="grid g2" style="gap:8px">${ROUTES.slice(4).map((r) => `<button class="dev" data-go="${r.id}" style="padding:12px;border:1px solid var(--line);border-radius:14px;${can(r.perm) ? '' : 'opacity:.5'}"><span class="dev__i">${I(r.ic)}</span><span class="dev__b">${bi(r.en, r.ar)}<small>${can(r.perm) ? '' : 'غير متاحة لدورك'}</small></span></button>`).join('')}</div></div>`, { cls: 'modal--sm' });
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-go]'); if (!b) return; m.close(); const r = ROUTES.find((x) => x.id === b.dataset.go); if (!can(r.perm)) lockedRoute(r); else go(r.id); });
  }
  function go(r) { route = r; history.replaceState(null, '', '#' + r); render(); }
  function lockedRoute(r) {
    const m = D.modal(`${D.head('هذه الصفحة غير متاحة لدورك', `${r.ar} متاحة لـ ${['manager', 'supervisor'].filter((x) => D.can({ role: x }, r.perm) === 1).map((x) => D.ROLES[x].ar).join(' و')} فقط`)}
      <div class="modal__b"><div class="blind">${I('lock', 'sm')} هذا جزء من الصلاحيات: الكاشير يبيع فقط، ولا يرى التكلفة أو الأرباح، ولا يستطيع تغيير الأسعار.</div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>تمام</button><button class="btn btn--ink" id="sw">الدخول بحساب آخر</button></div>`, { cls: 'modal--sm' });
    $('#sw', m).addEventListener('click', () => { m.close(); lockScreen(r.id); });
  }

  /* ---------- lock / PIN ---------- */
  function lockScreen(after) {
    if (D.REAL && !S().setup) { setupWizard(); return; }
    const users = D.REAL ? D.STAFF.filter((u) => !u.off) : D.STAFF;
    let pick = D.REAL ? (users.find((u) => u.role === 'cashier') || users[0] || {}).id : 'u3', pin = '';
    const el = document.createElement('div');
    el.className = 'lock';
    el.innerHTML = `<div class="lock__in">
      <div class="lock__side">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:26px">${D.brand(D.LIVE ? '' : 'دَرج')}${D.REAL ? '' : `<span class="demo-tag">${D.TRAIN ? 'Training' : 'Demo'}</span>`}</div>
        <span class="label">Cashier 1 · ${esc(D.STORE.nameEn)} — ${esc(D.STORE.branchEn)}</span>
        <h1>Who's on<br>the drawer?</h1>
        <p>${D.REAL ? 'كل موظف يدخل برمز PIN الخاص به، فتُسجَّل كل فاتورة وكل فتحة درج وكل خصم باسمه.' : 'كل موظف يدخل برمز PIN الخاص به، فتُسجَّل كل فاتورة وكل فتحة درج وكل خصم باسمه. اختر موظفًا وجرّب الصلاحيات بنفسك.'}</p>
        <div class="who">${users.map((u) => `<button data-u="${u.id}" class="${u.id === pick ? 'on' : ''}">${D.av(u)}<span><b>${esc(u.name)}</b><small>${D.ROLES[u.role].ar}</small></span></button>`).join('')}</div>
        ${D.LIVE ? `<button class="btn btn--ghost btn--sm" id="trainSw" style="margin-top:16px">${I('play', 'sm')}${D.TRAIN ? bi('Back to live', 'رجوع للتشغيل الحقيقي') : bi('Training mode', 'وضع التدريب للموظفين الجدد')}</button>` : ''}
      </div>
      <div class="pin">
        <div style="text-align:center"><span class="label">Enter PIN</span><div id="pinWho" style="font-weight:800;font-size:16px;margin-top:4px"></div></div>
        <div class="pin__dots">${'<i></i>'.repeat(4)}</div>
        <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<button class="fn" data-n="c">مسح</button><button data-n="0">0</button><button class="fn" data-n="b">رجوع</button></div>
        ${D.REAL ? '' : '<p class="pin__hint">PIN التجربة: ريم <b>1111</b> · فيصل <b>2222</b> · Joseph <b>3333</b> · سارة <b>4444</b> · نورة <b>9999</b></p>'}
      </div></div>`;
    document.body.appendChild(el);
    const who = () => { $('#pinWho', el).textContent = D.staff(pick).name; };
    const dots = $('.pin__dots', el);
    const paint = () => $$('i', dots).forEach((d, i) => d.classList.toggle('on', i < pin.length));
    who();
    el.addEventListener('click', (e) => {
      if (e.target.closest('#trainSw')) { D.setTraining(!D.TRAIN); return; }
      const u = e.target.closest('[data-u]');
      if (u) { pick = u.dataset.u; pin = ''; paint(); $$('[data-u]', el).forEach((b) => b.classList.toggle('on', b === u)); who(); return; }
      const n = e.target.closest('[data-n]'); if (n) press(n.dataset.n);
    });
    const key = (e) => { if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('b'); };
    document.addEventListener('keydown', key);
    function press(n) {
      if (n === 'c') pin = ''; else if (n === 'b') pin = pin.slice(0, -1); else if (pin.length < 4) pin += n;
      paint();
      if (pin.length < 4) return;
      const u = D.staff(pick);
      if (!u.pin || pin !== u.pin) { dots.classList.add('err'); D.sound('err'); setTimeout(() => { dots.classList.remove('err'); pin = ''; paint(); }, 420); return; }
      me = u.id; try { sessionStorage.setItem('darj:me', me); } catch (er) { /* */ }
      document.removeEventListener('keydown', key);
      D.mutate(() => D.log(me, 'login', `تسجيل دخول — كاشير 1 (${D.ROLES[u.role].ar})`), 'login');
      el.remove();
      const target = after && D.can(me, ROUTES.find((r) => r.id === after).perm) ? after : (u.role === 'barista' ? 'kds' : can(ROUTES.find((r) => r.id === route).perm) ? route : 'sell');
      go(target);
      D.toast(`أهلًا ${u.short}`, `تم الدخول كـ${D.ROLES[u.role].ar}`, { ic: 'user' });
      if (!D.REAL) setTimeout(wantGuide ? openGuide : nudge, 900);
      else if (!D.openShift(S(), 1) && can('close') === 1) setTimeout(() => { go('shift'); D.toast('افتح الوردية للبدء', 'اكتب العهدة اللي في الدرج', { ic: 'drawer' }); }, 400);
    }
  }
  // أول تشغيل في النسخة الحقيقية: بيانات المحل، الضريبة، والمدير
  function setupWizard() {
    const st0 = S();
    const f = { nameAr: D.STORE.nameAr || '', nameEn: D.STORE.nameEn || '', branchAr: D.STORE.branchAr || 'الفرع الرئيسي', addr: D.STORE.addr || '', phone: D.STORE.phone || '', vatOn: st0.settings.vatOn !== false, vat: '', cr: '', owner: '', pin: '', pin2: '' };
    let step = 0;
    const el = document.createElement('div');
    el.className = 'lock';
    document.body.appendChild(el);
    const STEPS = [['Store', 'المحل'], ['Tax', 'الضريبة'], ['Manager', 'المدير'], ['Ready', 'جاهز']];
    const inp = (id, label, val, extra) => `<label class="field"><span>${label}</span><input class="input${extra && extra.mono ? ' mono' : ''}" id="${id}" value="${esc(val)}" ${extra && extra.attrs ? extra.attrs : ''}></label>`;
    function paint(err) {
      let body = '';
      if (step === 0) body = `<div class="grid g2">${inp('fNameAr', 'اسم المحل (عربي)', f.nameAr)}${inp('fNameEn', 'Store name (English)', f.nameEn)}${inp('fBranch', 'الفرع', f.branchAr)}${inp('fPhone', 'رقم المحل (يظهر على الفاتورة)', f.phone, { mono: 1, attrs: 'inputmode="tel"' })}</div><div style="margin-top:12px">${inp('fAddr', 'العنوان', f.addr)}</div>`;
      if (step === 1) body = `<div class="picks two" id="vatPick"><button class="pickc${f.vatOn ? ' on' : ''}" data-vat="1">${I('orders')}${bi('VAT registered', 'مسجّل في ضريبة القيمة المضافة')}<span class="sub">فاتورة ضريبية مبسطة + QR</span></button><button class="pickc${f.vatOn ? '' : ' on'}" data-vat="0">${I('register')}${bi('Not registered', 'غير مسجّل')}<span class="sub">إيصال بيع بدون ضريبة</span></button></div>
        ${f.vatOn ? `<div class="grid g2" style="margin-top:14px">${inp('fVat', 'الرقم الضريبي (15 رقم)', f.vat, { mono: 1, attrs: 'inputmode="numeric" maxlength="15"' })}${inp('fCr', 'السجل التجاري (اختياري)', f.cr, { mono: 1, attrs: 'inputmode="numeric"' })}</div>` : `<div style="margin-top:14px">${inp('fCr', 'السجل التجاري (اختياري)', f.cr, { mono: 1, attrs: 'inputmode="numeric"' })}</div>`}
        <div class="blind" style="margin-top:12px">${I('shield', 'sm')}<span>يمكن تغييرها لاحقًا من الإعدادات.${f.vatOn ? ' الأسعار في المنيو شاملة الضريبة.' : ''}</span></div>`;
      if (step === 2) body = `<div class="grid" style="gap:12px">${inp('fOwner', 'اسم المدير', f.owner)}<div class="grid g2">${inp('fPin', 'PIN من 4 أرقام', f.pin, { mono: 1, attrs: 'inputmode="numeric" maxlength="4" type="password"' })}${inp('fPin2', 'أكّد الـPIN', f.pin2, { mono: 1, attrs: 'inputmode="numeric" maxlength="4" type="password"' })}</div>
        <div class="blind">${I('lock', 'sm')}<span>المدير يضيف باقي الموظفين ويحدد صلاحياتهم من صفحة Team.</span></div></div>`;
      if (step === 3) body = `<div class="done-ok">${check()}<b style="font-size:18px">${bi('Ready to open', 'النظام جاهز')}</b><span class="muted">${esc(f.nameAr)} · ${esc(f.branchAr)} · ${f.vatOn ? 'فاتورة ضريبية' : 'إيصال بدون ضريبة'}</span></div>
        <div class="blind">${I('drawer', 'sm')}<span>الخطوة الجاية: افتح أول وردية بالعهدة اللي في الدرج، وابدأ البيع. كل الأرقام تبدأ من الصفر.</span></div>`;
      el.innerHTML = `<div class="pin" style="width:min(640px,100%)">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:14px">${D.brand()}<span style="display:flex;align-items:center;gap:8px"><button class="btn btn--soft btn--sm" id="sTrain" title="جرّب النظام ببيانات تجريبية أولًا">${I('play', 'sm')}${bi('Training', 'جرّب أولًا')}</button><span class="label">First-time setup</span></span></div>
        ${stepper(STEPS, step)}
        <div class="wz">${body}</div>
        ${err ? `<div class="blind" style="margin-top:12px;color:var(--red)">${I('alert', 'sm')}<span>${err}</span></div>` : ''}
        <div style="display:flex;gap:10px;margin-top:18px">${step && step < 3 ? `<button class="btn btn--ghost" id="sBack" style="flex:0 0 auto">${bi('Back', 'السابق')}</button>` : ''}<button class="btn btn--ink btn--lg btn--block" id="sNext">${step < 3 ? bi('Next', 'التالي') : bi('Start', 'ابدأ')}</button></div></div>`;
      const v = (id) => ($('#' + id, el) ? $('#' + id, el).value.trim() : '');
      const grab = () => {
        if (step === 0) Object.assign(f, { nameAr: v('fNameAr'), nameEn: v('fNameEn'), branchAr: v('fBranch'), phone: v('fPhone'), addr: v('fAddr') });
        if (step === 1) { if ($('#fVat', el)) f.vat = v('fVat'); f.cr = v('fCr'); }
        if (step === 2) Object.assign(f, { owner: v('fOwner'), pin: v('fPin'), pin2: v('fPin2') });
      };
      $$('[data-vat]', el).forEach((b) => b.addEventListener('click', () => { grab(); f.vatOn = b.dataset.vat === '1'; paint(); }));
      $('#sTrain', el).addEventListener('click', () => D.setTraining(true));
      if ($('#sBack', el)) $('#sBack', el).addEventListener('click', () => { grab(); step -= 1; paint(); });
      $('#sNext', el).addEventListener('click', () => {
        grab();
        if (step === 0 && !f.nameAr) return paint('اكتب اسم المحل');
        if (step === 1 && f.vatOn && !/^3\d{13}3$/.test(f.vat)) return paint('الرقم الضريبي 15 رقم، يبدأ وينتهي بـ3');
        if (step === 2 && !f.owner) return paint('اكتب اسم المدير');
        if (step === 2 && !/^\d{4}$/.test(f.pin)) return paint('الـPIN لازم يكون 4 أرقام');
        if (step === 2 && f.pin !== f.pin2) return paint('الـPIN غير متطابق');
        if (step < 3) { step += 1; paint(); return; }
        const id = 'm' + D.uid();
        D.mutate((st) => {
          st.store = { nameAr: f.nameAr, sellerAr: f.nameAr, nameEn: f.nameEn || D.STORE.nameEn, branchAr: f.branchAr, addr: f.addr, phone: f.phone, vat: f.vatOn ? f.vat : '', cr: f.cr };
          st.settings.vatOn = f.vatOn;
          st.staff = [{ id, name: f.owner, short: f.owner.split(' ')[0], role: 'manager', pin: f.pin, c: '#141414' }];
          st.setup = true; st.setupAt = Date.now();
          D.log(id, 'settings', `تشغيل النظام لأول مرة — ${f.nameAr}`);
        }, 'setup');
        me = id; try { sessionStorage.setItem('darj:me', me); } catch (er) { /* */ }
        el.remove(); go('shift'); setTimeout(openShiftFlow, 300);
      });
    }
    paint();
  }

  /* ---------- feed / me menus ---------- */
  let feedSeen = Date.now();
  function closePops() { $$('.pop').forEach((p) => p.remove()); }
  function openFeed(e) {
    e.stopPropagation();
    if ($('.pop.feedpop')) { closePops(); return; }
    closePops();
    const s = S();
    feedSeen = Date.now();
    const el = document.createElement('div');
    el.className = 'pop feedpop';
    el.innerHTML = `<div class="pop__h"><b>النشاط في الفرع</b><span class="pill pill--go"><i class="dot pulse"></i> Live</span></div><div class="feed">${s.feed.slice().reverse().slice(0, 14).map((f) => `<div><span class="fi">${I(f.ic)}</span><span><b>${esc(f.t)}</b><small>${esc(f.s)} · ${D.ago(f.ts)}</small></span></div>`).join('')}</div>`;
    document.body.appendChild(el);
    chrome();
  }
  function openMe(e) {
    e.stopPropagation();
    if ($('.pop.mepop')) { closePops(); return; }
    closePops();
    const u = D.staff(me);
    const el = document.createElement('div');
    el.className = 'pop mepop';
    el.style.width = '280px';
    el.innerHTML = `<div class="pop__h" style="gap:10px;justify-content:flex-start">${D.av(u)}<span><b>${esc(u.name)}</b><br><small class="muted">${D.ROLES[u.role].ar} · كاشير 1</small></span></div>
      <div class="feed"><div style="cursor:pointer" data-a="switch"><span class="fi">${I('users')}</span><span><b>تبديل المستخدم</b><small>دخول موظف آخر برمز PIN</small></span></div>
      <div style="cursor:pointer" data-a="lock"><span class="fi">${I('lock')}</span><span><b>قفل الشاشة</b><small>لما تسيب الكاشير</small></span></div>
      <div style="cursor:pointer" data-a="screens"><span class="fi">${I('kds')}</span><span><b>الشاشات الأخرى</b><small>الباريستا والمطبخ والكشك وشاشة الطلبات</small></span></div></div>`;
    document.body.appendChild(el);
    el.addEventListener('click', (ev) => {
      const a = ev.target.closest('[data-a]'); if (!a) return;
      closePops();
      if (a.dataset.a === 'screens') { openScreens(); return; }
      D.mutate(() => D.log(me, 'login', 'تسجيل خروج'), 'logout');
      me = null; try { sessionStorage.removeItem('darj:me'); } catch (er) { /* */ }
      lockScreen();
    });
  }
  document.addEventListener('click', (e) => { if (!e.target.closest('.pop')) closePops(); });
  function openScreens() {
    const m = D.modal(`${D.head(bi('Screens', 'الشاشات المربوطة بالكاشير'), 'افتح أي شاشة هنا، أو اربطها بجهاز آخر عبر QR')}<div class="modal__b">${devicesCard()}</div>`, { cls: 'modal--wide' });
    m.querySelectorAll('[data-pair]').forEach((b) => b.addEventListener('click', () => pairModal(b.dataset.pair)));
    const rot = m.querySelector('#lnkRot'); if (rot) rot.remove();
  }
  // eslint-disable-next-line no-unused-vars
  function openScreensOld() {
    D.modal(`${D.head('الشاشات المربوطة بالكاشير', 'افتح كل شاشة في تبويب أو جهاز مستقل — جميعها تتحدّث لحظة بلحظة')}
      <div class="modal__b"><div class="dev"><span class="dev__i">${I('cup')}</span><span class="dev__b"><b>شاشة الباريستا</b><small>تصلها الطلبات فور إتمام الدفع، بالإضافات والملاحظات</small></span><a class="btn btn--ghost btn--sm" href="kds.html" target="_blank">افتح</a></div>
      <div class="dev"><span class="dev__i">${I('kds')}</span><span class="dev__b"><b>شاشة «طلبك جاهز»</b><small>للعملاء: الطلبات قيد التحضير والجاهزة</small></span><a class="btn btn--ghost btn--sm" href="screen.html" target="_blank">افتح</a></div>
      <div class="dev"><span class="dev__i">${I('user')}</span><span class="dev__b"><b>شاشة العميل عند الكاشير</b><small>العميل يرى طلبه والإجمالي وأختامه أثناء الدفع</small></span><a class="btn btn--ghost btn--sm" href="screen.html?mode=cart" target="_blank">افتح</a></div></div>`);
  }

  /* ---------- net (offline test) ---------- */
  function toggleNet() {
    const s = S();
    if (D.REAL) {
      D.modal(`${D.head(bi(s.settings.offline ? 'Offline' : 'Online', s.settings.offline ? 'لا يوجد إنترنت' : 'متصل بالإنترنت'), 'الحالة تتحدّث تلقائيًا من الجهاز')}<div class="modal__b"><div class="blind">${I('drawer', 'sm')}<span>البيع والطباعة شغالين في الحالتين. كل الفواتير محفوظة على هذا الجهاز، وتُؤرشف آخر كل يوم، ونسخة احتياطية من الإعدادات.</span></div></div>`, { cls: 'modal--sm' });
      return;
    }
    if (!s.settings.offline) {
      const m = D.modal(`${D.head('جرّب انقطاع الإنترنت', 'سينقطع الاتصال هنا فقط (تجربة) — لن يتأثر أي شيء حقيقي')}
        <div class="modal__b"><div class="grid" style="gap:10px">
        <div class="blind">${I('check', 'sm')} البيع والدفع نقدًا وبالشبكة والطباعة تعمل بشكل طبيعي.</div>
        <div class="blind">${I('cloud', 'sm')} الفواتير تُحفظ على الجهاز، وتُرفع تلقائيًا فور عودة الاتصال.</div>
        <div class="blind">${I('qr', 'sm')} طلبات QR والموقع تنتظر حتى يعود الاتصال.</div></div></div>
        <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--ink" id="cut">${I('wifioff', 'sm')} اقطع الاتصال</button></div>`, { cls: 'modal--sm' });
      $('#cut', m).addEventListener('click', () => { m.close(); D.goOffline(true, me); D.toast('انقطع الاتصال', 'واصل البيع بشكل طبيعي — الفواتير تُحفظ على الجهاز', { warn: 1, ic: 'wifioff' }); render(); });
      return;
    }
    const net = $('#net');
    net.className = 'net sync'; net.innerHTML = `${I('sync', 'sm')}<span>جارٍ المزامنة…</span>`;
    setTimeout(() => {
      const n = D.goOffline(false, me);
      net.className = 'net';
      D.toast('عاد الاتصال', `تمت مزامنة ${n} فاتورة مع السحابة`, { ic: 'cloud' });
      D.sound('ok');
      render();
    }, 1800);
  }

  /* ---------- render ---------- */
  let unmount = null;
  function render() {
    if (unmount) { unmount(); unmount = null; }
    chrome();
    const main = $('#main');
    const s = S();
    const v = VIEWS[route];
    const trainBar = D.TRAIN ? `<div class="banner banner--blue">${I('play', 'sm')} <b>Training · وضع التدريب</b> — الأرقام هنا للتدريب فقط ولا تدخل في حسابات المحل <button class="btn btn--sm btn--ink" id="toLive">${bi('Back to live', 'رجوع للتشغيل')}</button></div>` : '';
    const offBar = s.settings.offline ? (D.REAL ? `<div class="banner">${I('wifioff', 'sm')} لا يوجد إنترنت — البيع يعمل بشكل طبيعي، والفواتير محفوظة على هذا الجهاز</div>` : `<div class="banner">${I('wifioff', 'sm')} غير متصل — البيع يعمل بشكل طبيعي، و${s.orders.filter((o) => !o.synced).length} فاتورة محفوظة على الجهاز حتى يعود الاتصال <button class="btn btn--sm btn--ink" id="back">أعِد الاتصال</button></div>`) : '';
    main.innerHTML = trainBar + offBar + '<div id="view"></div>';
    if ($('#toLive', main)) $('#toLive', main).addEventListener('click', () => D.setTraining(false));
    if ($('#back', main)) $('#back', main).addEventListener('click', toggleNet);
    const view = $('#view', main);
    if (route === 'sell' || route === 'kds') view.style.height = `calc(100% - ${(trainBar ? 45 : 0) + (offBar ? 45 : 0)}px)`;
    unmount = v.render(view) || null;
    main.scrollTop = 0;
  }

  /* =====================================================================
     SELL
     ===================================================================== */
  const cart = { lines: [], disc: null, discAppr: null, type: 'takeaway', table: null, cust: null, name: '' };
  let cat = 'all', q = '';
  const totals = () => D.calc(S(), cart.lines, cart.disc);
  function cartBroadcast(stage, extra) {
    const s = S(); const c = totals();
    const cu = cart.cust ? s.customers.find((x) => x.id === cart.cust) : null;
    D.pushCart(Object.assign({ stage: stage || (cart.lines.length ? 'cart' : 'idle'), lines: cart.lines.map((l) => ({ ar: D.prod(l.pid).ar, en: D.prod(l.pid).en, qty: l.qty, mods: D.modText(l), total: D.lineTotal(s, l), reward: l.reward })), c, cust: cu ? { name: cu.name.split(' ')[0], stamps: cu.stamps, need: s.settings.loyalNeed, rewards: cu.rewards || 0 } : null }, extra || {}));
  }

  function itemCard(p) {
    const s = S();
    const out = s.avail[p.id] === false || !D.canMake(s, { pid: p.id, qty: 1, mods: D.defMods(p) });
    const inCart = cart.lines.filter((l) => l.pid === p.id).reduce((a, l) => a + l.qty, 0);
    const img = D.img(p);
    const c = D.CATS.find((x) => x.id === p.cat);
    return `<button class="item${out ? ' out' : ''}" data-p="${p.id}">${inCart ? `<span class="item__qty">${inCart}</span>` : ''}
      <span class="item__img" ${img ? `style="background-image:url('${img}')"` : ''}>${img ? '' : `<span class="item__ph">${I(c.ic)}</span>`}</span>
      <span class="item__b"><b>${esc(lang === 'en' ? p.en : p.ar)}</b><small>${esc(lang === 'en' ? p.ar : p.en)}</small><span class="item__p">${fmt(D.priceOf(s, p))}</span></span></button>`;
  }
  function filtered() {
    const k = q.trim().toLowerCase();
    return D.PRODUCTS.filter((p) => (cat === 'all' || p.cat === cat) && (!k || p.ar.includes(k) || p.en.toLowerCase().includes(k) || (p.code && p.code.includes(k))));
  }
  function drawItems() { const el = $('#items'); if (el) el.innerHTML = filtered().map(itemCard).join('') || `<div class="empty" style="grid-column:1/-1">${I('search')}<span>لا يوجد صنف بهذا الاسم</span></div>`; }

  function renderSell(view) {
    view.className = 'view--full';
    view.innerHTML = `<div class="sell">
      <div class="sell__left">
        <div class="sell__bar">
          <label class="search"><span>${I('search')}</span><input class="input" id="q" placeholder="${tr('ابحث بالاسم أو امسح الباركود', 'Search or scan')}" value="${esc(q)}" autocomplete="off"><kbd>F2</kbd></label>
          ${D.LIVE ? '' : `<button class="btn btn--ghost btn--icon" id="scan" title="امسح باركود (تجربة)">${I('scan')}</button>`}
          <div class="seg" id="lang"><button data-l="ar" class="${lang === 'ar' ? 'on' : ''}">ع</button><button data-l="en" class="${lang === 'en' ? 'on' : ''}">EN</button></div>
          <button class="btn btn--ghost" id="rfnd" title="مرتجع أو إلغاء طلب">${I('refund', 'sm')}${bi('Refund', 'مرتجع')}</button>
          <button class="btn btn--ghost btn--icon" id="more" title="أوامر الكاشير">${I('drawer')}</button>
        </div>
        <div class="cats" id="cats"><button class="chip ${cat === 'all' ? 'on' : ''}" data-c="all">${bi('All', 'الكل')}</button>${D.CATS.map((c) => `<button class="chip ${cat === c.id ? 'on' : ''}" data-c="${c.id}">${bi(c.en, c.ar)}</button>`).join('')}</div>
        <div class="items" id="items"></div>
        <button class="cart-fab" id="fab"></button>
      </div>
      <aside class="cart" id="cart"></aside>
    </div>`;
    drawItems(); drawCart();
    const qi = $('#q');
    qi.addEventListener('input', () => { q = qi.value; drawItems(); });
    qi.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const v = qi.value.trim();
      const byCode = D.PRODUCTS.find((p) => p.code && p.code === v);
      if (byCode) { scanned(byCode); qi.value = ''; q = ''; drawItems(); return; }
      const list = filtered(); if (list.length === 1) { pick(list[0].id); qi.value = ''; q = ''; drawItems(); }
    });
    $('#cats').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cat = b.dataset.c; $$('#cats .chip').forEach((x) => x.classList.toggle('on', x === b)); drawItems(); });
    $('#items').addEventListener('click', (e) => { const b = e.target.closest('[data-p]'); if (b) pick(b.dataset.p, b); });
    $('#lang').addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; lang = b.dataset.l; renderSell(view); });
    if ($('#scan')) $('#scan').addEventListener('click', () => { const beans = D.PRODUCTS.filter((p) => p.code); if (beans.length) scanned(beans[Math.floor(Math.random() * beans.length)]); });
    $('#more').addEventListener('click', moreMenu);
    $('#rfnd').addEventListener('click', openFindOrder);
    $('#fab').addEventListener('click', () => openCartSheet(true));
    const keys = (e) => {
      if (document.querySelector('.ovl, .lock')) return;
      if (e.key === 'F2') { e.preventDefault(); qi.focus(); qi.select(); }
      if (e.key === 'F4') { e.preventDefault(); holdCart(); }
      if (e.key === 'F8') { e.preventDefault(); openPay(); }
    };
    document.addEventListener('keydown', keys);
    // قارئ الباركود بيكتب أرقام بسرعة وبعدين Enter
    let buf = '', last = 0;
    const wedge = (e) => {
      if ((e.target.matches && e.target.matches('input, textarea')) || document.querySelector('.ovl, .lock')) return;
      const now = Date.now();
      if (now - last > 80) buf = '';
      last = now;
      if (/^\d$/.test(e.key)) buf += e.key;
      else if (e.key === 'Enter' && buf.length >= 8) { const p = D.PRODUCTS.find((x) => x.code === buf); if (p) scanned(p); buf = ''; }
    };
    document.addEventListener('keydown', wedge);
    return () => { document.removeEventListener('keydown', keys); document.removeEventListener('keydown', wedge); };
  }
  function scanned(p) {
    D.sound('beep');
    addLine({ pid: p.id, qty: 1, mods: {} });
    D.toast('تمت قراءة الباركود', `${p.code} · ${p.ar}`, { ic: 'scan', ms: 2200 });
  }
  function pick(pid, el) {
    const s = S(); const p = D.prod(pid);
    if (s.avail[p.id] === false) { D.toast(`${p.ar} متوقف`, 'تم إيقافه من المنيو — يمكن إعادته من صفحة المنيو', { warn: 1 }); return; }
    if (!D.canMake(s, { pid, qty: 1, mods: D.defMods(p) })) { D.toast(`${p.ar} نفد`, 'نفد أحد مكوّناته من المخزون، فتوقف تلقائيًا', { warn: 1, ic: 'box' }); return; }
    if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    if (p.mods.length) openMods(p); else addLine({ pid, qty: 1, mods: {} });
  }
  const sameLine = (a, b) => a.pid === b.pid && JSON.stringify(a.mods) === JSON.stringify(b.mods) && (a.note || '') === (b.note || '') && !a.disc && !b.disc && !a.reward && !b.reward;
  function addLine(line) {
    const ex = cart.lines.find((l) => sameLine(l, line));
    if (ex) ex.qty += line.qty; else cart.lines.push(Object.assign({ key: D.uid(), at: Date.now() }, line));
    cart.fresh = ex ? ex.key : cart.lines[cart.lines.length - 1].key;
    drawCart(); drawItems();
  }

  function drawCart() {
    const el = $('#cart'); if (!el) return;
    const s = S(); const c = totals();
    const cr = cart.credit ? cart.credit.a : 0;
    const due = D.r2(Math.max(0, c.total - cr));
    const cu = cart.cust ? s.customers.find((x) => x.id === cart.cust) : null;
    const holds = s.holds.filter((h) => h.reg === 1);
    const count = cart.lines.reduce((a, l) => a + l.qty, 0);
    const TYPES = { takeaway: ['Takeaway', 'سفري'], dinein: ['Dine-in', 'محلي'], table: ['Table', 'طاولة'] };
    el.innerHTML = `<div class="cart__h">
        <div class="cart__row"><div class="cart__title"><b class="en">Order #${s.seq.no + 1}</b><span class="muted" style="font-size:12px">${count ? count + ' صنف' : ''}</span></div>
        <button class="icon-btn" id="closeCart" style="display:none">${I('x')}</button>
        <div class="seg" id="type">${Object.entries(TYPES).map(([t, [en, ar]]) => `<button data-t="${t}" class="${cart.type === t ? 'on' : ''}">${bi(en + (t === 'table' && cart.table ? ' ' + cart.table : ''), ar)}</button>`).join('')}</div></div>
        ${cart.credit ? `<div class="credit">${I('swap', 'sm')}${bi('Exchange credit', 'رصيد استبدال من ' + cart.credit.inv)}<span class="num">${fmt(cr)}</span><button class="icon-btn" id="crX" style="width:26px;height:26px;color:inherit" title="رجّعه كاش">${I('x', 'sm')}</button></div>` : ''}
        ${cu ? `<div class="cart__cust">${I('user', 'sm')}<span><b>${esc(cu.name)}</b><span class="muted">${cu.rewards ? `لديه ${cu.rewards} مشروب هدية` : `${cu.visits} زيارة`}</span></span><span class="stamps">${Array.from({ length: s.settings.loyalNeed }, (_, i) => `<i class="${i < cu.stamps ? 'on' : ''}"></i>`).join('')}</span><button class="icon-btn" id="custX" style="width:28px;height:28px">${I('x', 'sm')}</button></div>
        ${cu.rewards && !cart.lines.some((l) => l.reward) && cart.lines.some((l) => D.isDrink(D.prod(l.pid))) ? `<button class="btn btn--soft btn--sm" id="redeem">${I('gift', 'sm')}${bi('Use free drink', 'استخدم المشروب الهدية')}</button>` : ''}`
        : `<button class="btn btn--ghost btn--sm" id="cust" style="justify-content:flex-start;height:42px">${I('user', 'sm')}${bi('Add customer', 'رقم الجوال · أختام الولاء')}<span class="stamps" style="margin-inline-start:auto">${'<i></i>'.repeat(4)}</span></button>`}
        ${holds.length ? `<div class="cart__holds">${holds.map((h) => `<button class="chip" data-hold="${h.id}">${I('pause', 'sm')}${esc(h.name || 'معلّق')} <span class="n">${h.lines.length}</span></button>`).join('')}</div>` : ''}
      </div>
      <div class="cart__lines" id="lines">${cart.lines.length ? cart.lines.map((l, i) => lineRow(s, l, i)).join('') : emptyHow()}</div>
      <div class="cart__f">
        <div class="sums">
          <div><span>${bi('Subtotal', 'المجموع')}</span>${money(c.gross)}</div>
          ${c.disc ? `<div class="up"><span>${bi('Discount' + (cart.disc.type === 'pct' ? ' ' + cart.disc.v + '%' : ''), 'خصم · ' + esc(cart.disc.reason || ''))}</span><span>-${money(c.disc)}</span></div>` : ''}
          ${c.vat ? `<div><span>${bi('VAT 15%', 'منها ضريبة القيمة المضافة')}</span>${money(c.vat)}</div>` : ''}
          ${cr ? `<div style="color:var(--blue)"><span>${bi('Exchange credit', 'رصيد الاستبدال')}</span><span>-${money(Math.min(cr, c.total))}</span></div>` : ''}
          <div class="tot"><span>${bi(cr ? 'To pay' : 'Total', cr ? 'المطلوب' : 'الإجمالي')}</span>${money(due)}</div>
          ${cr > c.total && cart.lines.length ? `<div style="color:var(--blue);font-weight:700"><span>${bi('Cash back', 'الفرق يرجع كاش')}</span>${money(cr - c.total)}</div>` : ''}
        </div>
        <div class="cart__btns">
          <button class="btn btn--soft" id="hold" ${cart.lines.length ? '' : 'disabled'}>${I('pause')}${bi('Hold', 'تعليق')}</button>
          <button class="btn btn--soft" id="disc" ${cart.lines.length ? '' : 'disabled'}>${I('percent')}${bi('Discount', 'خصم')}</button>
          <button class="btn btn--go" id="pay" ${cart.lines.length ? '' : 'disabled'}>${bi('Charge' + (cart.lines.length ? ' ' + fmt(due) : ''), 'الدفع')} <kbd style="color:#fff">F8</kbd></button>
        </div>
      </div>`;
    const fab = $('#fab');
    if (fab) { fab.hidden = !cart.lines.length; fab.innerHTML = `<span>${bi(count + ' items · View order', 'عرض الطلب')}</span><span class="num">${fmt(due)}</span>`; }
    if (window.matchMedia('(max-width:900px)').matches) $('#closeCart').style.display = 'grid';
    $('#closeCart').addEventListener('click', () => openCartSheet(false));
    $('#type').addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; if (b.dataset.t === 'table') pickTable(); else { cart.type = b.dataset.t; cart.table = null; drawCart(); } });
    if ($('#cust')) $('#cust').addEventListener('click', openCustomerPick);
    if ($('#custX')) $('#custX').addEventListener('click', () => { cart.cust = null; cart.lines = cart.lines.filter((l) => !l.reward); drawCart(); });
    if ($('#redeem')) $('#redeem').addEventListener('click', redeem);
    if ($('#crX')) $('#crX').addEventListener('click', dropCredit);
    $('#hold').addEventListener('click', holdCart);
    $('#disc').addEventListener('click', openDisc);
    $('#pay').addEventListener('click', openPay);
    $$('[data-hold]', el).forEach((b) => b.addEventListener('click', () => resume(b.dataset.hold)));
    $('#lines').addEventListener('click', (e) => {
      const st = e.target.closest('[data-q]');
      const row = e.target.closest('[data-i]');
      if (!row) return;
      const i = +row.dataset.i;
      if (st) { e.stopPropagation(); qtyStep(i, +st.dataset.q); return; }
      openLine(i);
    });
    cart.fresh = null;
    cartBroadcast();
  }
  const emptyHow = () => `<div class="cart__empty">${I('cup')}<b style="color:var(--ink-2)">${bi('Start an order', 'ابدأ الطلب')}</b>
    <div class="how"><div><i>1</i>${bi('Pick', 'اختر الصنف من الصور')}</div><div><i>2</i>${bi('Customize', 'الحجم والحليب والإضافات')}</div><div><i>3</i>${bi('Charge', 'ادفع بأي طريقة')}</div></div></div>`;
  function dropCredit() {
    const cr = cart.credit; if (!cr) return;
    const m = D.modal(`${D.head(bi('Exchange credit', 'رصيد الاستبدال'), `${fmt(cr.a)} ر.س من ${cr.inv} · ${cr.cn}`)}<div class="modal__b"><div class="blind">${I('swap', 'sm')} العميل لم يختر بديلًا؟ يرجع له الرصيد كاش من الدرج، ويُسجَّل على نفس الإشعار.</div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Keep credit', 'احتفظ بالرصيد')}</button><button class="btn btn--ink" id="ok">${I('cash', 'sm')}${bi('Cash back', 'رجّعه كاش')}</button></div>`, { cls: 'modal--sm' });
    $('#ok', m).addEventListener('click', () => {
      if (!D.openShift(S(), 1)) { D.toast('لا توجد وردية مفتوحة', 'افتح وردية أولًا لصرف الكاش', { warn: 1 }); return; }
      D.mutate((s) => { s.orders.forEach((o) => (o.refunds || []).forEach((r) => { if (r.cn === cr.cn) { const sh = D.openShift(s, 1); r.parts = [{ m: 'cash', a: r.a }]; r.m = 'cash'; r.how = 'cash'; r.shift = sh && sh.id; } })); D.log(me, 'refund', `تحويل رصيد الاستبدال ${cr.cn} إلى كاش — ${fmt(cr.a)} ر.س`); }, 'refund');
      cart.credit = null; m.close(); D.drawerPop('فُتح الدرج — رجع الرصيد كاش'); drawCart();
    });
  }
  function lineRow(s, l, i) {
    const p = D.prod(l.pid);
    const mods = D.modText(l, lang === 'en');
    const gross = D.lineGross(s, l), tot = D.lineTotal(s, l);
    return `<div class="line${cart.fresh === l.key ? ' new' : ''}" data-i="${i}">
      <span class="line__name">${esc(lang === 'en' ? p.en : p.ar)}</span>
      <span class="line__price"><b>${fmt(tot)}</b>${gross !== tot ? `<s>${fmt(gross)}</s>` : ''}<span class="qty"><button data-q="-1">${I('minus', 'sm')}</button><span>${l.qty}</span><button data-q="1">${I('plus', 'sm')}</button></span></span>
      <span class="line__mods">${mods.map((m) => `<span>${esc(m)}</span>`).join('')}${l.reward ? '<span class="disc">هدية الولاء</span>' : l.disc ? `<span class="disc">خصم ${l.disc}%</span>` : ''}${l.note ? `<span class="note">${esc(l.note)}</span>` : ''}</span>
    </div>`;
  }
  function openCartSheet(open) {
    const c = $('#cart'); if (!c) return;
    c.classList.toggle('open', open);
    let sc = $('.cart-scrim');
    if (open && !sc) { sc = document.createElement('div'); sc.className = 'cart-scrim'; sc.addEventListener('click', () => openCartSheet(false)); document.body.appendChild(sc); }
    if (!open && sc) sc.remove();
  }
  async function qtyStep(i, d) {
    const l = cart.lines[i]; if (!l) return;
    if (d > 0) { if (l.reward) return; l.qty += 1; drawCart(); drawItems(); return; }
    if (l.qty > 1) { l.qty -= 1; drawCart(); drawItems(); return; }
    await voidLine(i);
  }
  async function voidLine(i) {
    const l = cart.lines[i]; const p = D.prod(l.pid);
    if (l.reward) { cart.lines.splice(i, 1); drawCart(); return true; }
    const u = await D.approve('void', `حذف ${p.ar} من السلة`, me);
    if (!u) return false;
    cart.lines.splice(i, 1);
    D.mutate(() => D.log(me, 'void', `حذف صنف من السلة: ${p.ar} ×${l.qty} — قبل الدفع`, approverId(u), 'warn'), 'void');
    drawCart(); drawItems();
    return true;
  }

  /* ---------- modifiers / line editor ---------- */
  // رسومات صغيرة للخيارات: حجم الكوب، لون الحليب، عدد مكعبات السكر والثلج
  function optArt(g, id) {
    const sv = (inner) => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;
    if (g === 'size') { const k = { s: .62, m: .8, l: 1 }[id]; return sv(`<g transform="translate(12 21) scale(${k}) translate(-12 -21)"><path d="M6 7h12l-1.3 13H7.3L6 7Z"/><path d="M5 7h14"/></g>`); }
    if (g === 'milk') { const c = { full: '#F5EDE0', oat: '#DDBE8E', almond: '#C99B6C', lf: '#C9DCEB', skim: '#EEF1F3' }[id]; return sv(`<path d="M12 3c3 4 6 7.5 6 11a6 6 0 0 1-12 0c0-3.5 3-7 6-11Z" fill="${c}"/>`); }
    if (g === 'sugar' || g === 'ice') {
      const n = { none: 0, light: 1, less: 1, normal: g === 'ice' ? 3 : 2, extra: 3 }[id];
      if (!n) return sv('<circle cx="12" cy="12" r="8"/><path d="M6.5 17.5l11-11"/>');
      const pos = [[4, 13], [13, 13], [8.5, 5]].slice(0, n);
      return sv(pos.map(([x, y]) => `<rect class="f" x="${x}" y="${y}" width="7" height="7" rx="1.6" fill="${g === 'ice' ? '#D8ECF5' : '#fff'}"/>`).join(''));
    }
    if (g === 'temp') return id === 'iced' ? sv('<path d="M12 3v18M4.5 7.5l15 9M19.5 7.5l-15 9"/>') : sv('<path d="M12 21a6 6 0 0 1-6-6c0-3.5 2.5-5 3.5-8.5C11 8 12 9.5 12 11c1-1 1.6-2.3 1.6-4C16 9 18 11.6 18 15a6 6 0 0 1-6 6Z"/>');
    if (g === 'origin') return sv('<ellipse cx="12" cy="12" rx="6" ry="8.5" transform="rotate(25 12 12)"/><path d="M9.5 5.5c2.5 3.5-1 9.5 2 13"/>');
    if (g === 'extra') return sv({ shot: '<path d="M7 9h9v5a4 4 0 0 1-4 4h-1a4 4 0 0 1-4-4V9Z"/><path d="M16 10h1.5a2 2 0 0 1 0 4H16"/>', van: '<path d="M10 3h4v3l2 3v11H8V9l2-3V3Z"/><path d="M8 13h8"/>', car: '<path d="M10 3h4v3l2 3v11H8V9l2-3V3Z"/><path d="M8 13h8"/>', haz: '<path d="M10 3h4v3l2 3v11H8V9l2-3V3Z"/><path d="M8 13h8"/>', decaf: '<path d="M5 19c0-8 5-13 14-14 0 9-5 14-13 14"/><path d="M5 19l7-7"/>', xhot: '<path d="M12 21a6 6 0 0 1-6-6c0-3.5 2.5-5 3.5-8.5C11 8 12 9.5 12 11c1-1 1.6-2.3 1.6-4C16 9 18 11.6 18 15a6 6 0 0 1-6 6Z"/>' }[id] || '');
    return '';
  }
  function openMods(p, idx) {
    const s = S();
    const edit = idx != null ? cart.lines[idx] : null;
    const line = edit ? JSON.parse(JSON.stringify(edit)) : { pid: p.id, qty: 1, mods: D.defMods(p), note: '' };
    const img = D.img(p); const c = D.CATS.find((x) => x.id === p.cat);
    const groups = () => p.mods.map((g) => {
      const G = D.MODS[g];
      return `<div class="mg"><div class="mg__h">${bi(G.en, G.ar)}<small>${G.one ? 'اختيار واحد' : 'اختياري — أكثر من خيار'}</small></div>
        <div class="opts">${G.opts.map((o) => { const on = G.one ? line.mods[g] === o.id : line.mods[g].includes(o.id); return `<button class="opt${on ? ' on' : ''}" data-g="${g}" data-o="${o.id}">${optArt(g, o.id)}${bi(o.en, o.ar)}${o.d ? `<small class="pr">+${o.d}</small>` : ''}</button>`; }).join('')}</div></div>`;
    }).join('');
    const m = D.modal(`<div class="modal__h"><div class="mod-hero"><span class="thumb" ${img ? `style="background-image:url('${img}')"` : ''}>${img ? '' : I(c.ic, 'lg')}</span><span><b>${esc(lang === 'en' ? p.en : p.ar)}</b><small>${esc(lang === 'en' ? p.ar : p.en)} · ${fmt(D.priceOf(s, p))} ر.س</small></span></div><button class="icon-btn" data-close>${I('x')}</button></div>
      <div class="modal__b"><div id="groups">${groups()}</div>
        <div class="mg"><div class="mg__h">${bi('Note', 'ملاحظة للباريستا')}</div><input class="input" id="note" placeholder="${tr('مثلًا: بدون رغوة', 'e.g. no foam')}" value="${esc(line.note || '')}"></div>
        ${edit ? `<div class="mg"><div class="mg__h">${bi('Item discount', 'خصم على الصنف')}<small>أكثر من 10% يحتاج موافقة</small></div><div class="opts" id="ld">${[0, 5, 10, 15, 20, 50].map((v) => `<button class="opt${(line.disc || 0) === v ? ' on' : ''}" data-d="${v}">${v ? v + '%' : 'بدون'}</button>`).join('')}</div></div>` : ''}
      </div>
      <div class="modal__f">${edit ? `<button class="btn btn--danger" id="del" style="flex:0 0 auto">${I('trash', 'sm')} حذف</button>` : ''}<span class="qty" style="height:54px;padding:0 6px"><button id="qm">${I('minus')}</button><span id="qv" style="font-size:17px;min-width:30px">${line.qty}</span><button id="qp">${I('plus')}</button></span><button class="btn btn--go btn--lg" id="add"></button></div>`);
    const paint = () => { $('#groups', m).innerHTML = groups(); $('#qv', m).textContent = line.qty; $('#add', m).innerHTML = `${bi((edit ? 'Save' : 'Add') + ' · ' + fmt(D.lineTotal(s, line)), edit ? 'حفظ التعديل' : 'أضف للطلب')} <kbd style="color:#fff">Enter</kbd>`; };
    paint();
    m.addEventListener('click', (e) => {
      const b = e.target.closest('[data-g]');
      if (b) { const G = D.MODS[b.dataset.g]; if (G.one) line.mods[b.dataset.g] = b.dataset.o; else { const arr = line.mods[b.dataset.g]; const k = arr.indexOf(b.dataset.o); if (k >= 0) arr.splice(k, 1); else arr.push(b.dataset.o); } paint(); }
    });
    $('#qm', m).addEventListener('click', () => { if (line.qty > 1) { line.qty -= 1; paint(); } });
    $('#qp', m).addEventListener('click', () => { line.qty += 1; paint(); });
    if (edit) {
      $('#ld', m).addEventListener('click', async (e) => {
        const b = e.target.closest('[data-d]'); if (!b) return;
        const v = +b.dataset.d;
        if (v > 10) { const u = await D.approve('discBig', `خصم ${v}% على ${p.ar}`, me); if (!u) return; D.mutate(() => D.log(me, 'disc', `خصم ${v}% على صنف: ${p.ar}`, approverId(u), 'warn'), 'disc'); }
        line.disc = v; $$('#ld .opt', m).forEach((x) => x.classList.toggle('on', x === b)); paint();
      });
      $('#del', m).addEventListener('click', async () => { m.close(); await voidLine(idx); });
    }
    const save = () => {
      line.note = $('#note', m).value.trim();
      if (edit) { Object.assign(cart.lines[idx], line); cart.fresh = cart.lines[idx].key; drawCart(); drawItems(); } else addLine(line);
      m.close();
    };
    $('#add', m).addEventListener('click', save);
    m.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id !== 'note') { e.preventDefault(); save(); } });
    $('#note', m).addEventListener('keydown', (e) => { if (e.key === 'Enter') save(); });
    setTimeout(() => $('#add', m).focus(), 50);
  }
  function openLine(i) { const l = cart.lines[i]; if (!l || l.reward) return; openMods(D.prod(l.pid), i); }

  function pickTable() {
    const m = D.modal(`${D.head('رقم الطاولة')}<div class="modal__b"><div class="quick" style="grid-template-columns:repeat(5,1fr)">${Array.from({ length: 15 }, (_, i) => `<button data-tb="${i + 1}">${i + 1}</button>`).join('')}</div></div>`, { cls: 'modal--sm' });
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-tb]'); if (!b) return; cart.type = 'table'; cart.table = +b.dataset.tb; m.close(); drawCart(); });
  }

  /* ---------- customer ---------- */
  function openCustomerPick() {
    const s = S();
    const m = D.modal(`${D.head('العميل', 'ابحث برقم الجوال أو الاسم — الأختام تُحسب تلقائيًا مع كل مشروب')}
      <div class="modal__b"><label class="search"><span>${I('phone')}</span><input class="input mono" id="cq" placeholder="05xxxxxxxx" inputmode="tel"></label><div id="cres" class="grid" style="gap:6px;margin-top:12px"></div></div>`);
    const draw = () => {
      const k = $('#cq', m).value.trim();
      const list = s.customers.filter((c) => !k || c.phone.includes(k) || c.name.includes(k)).sort((a, b) => b.visits - a.visits).slice(0, 7);
      $('#cres', m).innerHTML = list.map((c) => `<button class="dev" data-c="${c.id}" style="text-align:start;padding:10px;border-radius:12px;border:1px solid var(--line)"><span class="dev__i">${I('user')}</span><span class="dev__b"><b>${esc(c.name)} ${c.tag ? `<span class="pill ${c.tag === 'VIP' ? 'pill--ink' : 'pill--blue'}">${c.tag}</span>` : ''}</b><small class="mono" style="direction:ltr;display:inline-block">${c.phone.slice(0, 3)}•••${c.phone.slice(-4)}</small><small> · ${c.visits} زيارة · ${c.stamps}/${s.settings.loyalNeed} أختام${c.rewards ? ` · ${c.rewards} هدية` : ''}</small></span>${I('chev', 'sm')}</button>`).join('')
        + (/^05\d{8}$/.test(k) && !list.length ? `<div class="grid" style="gap:8px"><input class="input" id="cname" placeholder="اسم العميل (اختياري)"><button class="btn btn--ink" id="newc">${I('plus', 'sm')} ${bi('New customer · ' + k, 'تسجيل عميل جديد')}</button></div>` : '');
      if ($('#newc', m)) $('#newc', m).addEventListener('click', () => { const nm = (($('#cname', m) || {}).value || '').trim() || 'عميل'; const id = 'c' + D.uid(); D.mutate((st) => { st.customers.push({ id, name: nm, phone: k, visits: 0, stamps: 0, spend: 0, tag: 'جديد', last: Date.now(), fav: 'span' }); }, 'cust'); cart.cust = id; m.close(); drawCart(); });
    };
    draw();
    $('#cq', m).addEventListener('input', draw);
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; cart.cust = b.dataset.c; m.close(); drawCart(); D.sound('ok'); });
    setTimeout(() => $('#cq', m).focus(), 60);
  }
  function redeem() {
    const s = S();
    let best = -1, price = 1e9;
    cart.lines.forEach((l, i) => { if (D.isDrink(D.prod(l.pid)) && !l.reward) { const u = D.unitPrice(s, l); if (u < price) { price = u; best = i; } } });
    if (best < 0) return;
    const l = cart.lines[best];
    if (l.qty > 1) { l.qty -= 1; cart.lines.splice(best + 1, 0, Object.assign({}, JSON.parse(JSON.stringify(l)), { key: D.uid(), qty: 1, disc: 100, reward: 1 })); }
    else { l.disc = 100; l.reward = 1; }
    cart.redeem = 1;
    drawCart();
    D.toast('تم تطبيق الهدية', `${D.prod(l.pid).ar} مجانًا من رصيد الأختام`, { ic: 'gift' });
  }

  /* ---------- discount ---------- */
  function openDisc() {
    if (!cart.lines.length) return;
    const st = { type: cart.disc ? cart.disc.type : 'pct', v: cart.disc ? cart.disc.v : 10, reason: cart.disc ? cart.disc.reason : 'عميل دائم' };
    const m = D.modal(`${D.head('خصم على الفاتورة', 'الكاشير يملك حتى 10% — ما يزيد عن ذلك يحتاج موافقة المشرف')}
      <div class="modal__b grid" style="gap:14px">
        <div class="seg" id="dt"><button data-t="pct" class="${st.type === 'pct' ? 'on' : ''}">نسبة %</button><button data-t="amt" class="${st.type === 'amt' ? 'on' : ''}">مبلغ ر.س</button></div>
        <div class="quick" id="dq"></div>
        <label class="field"><span>القيمة</span><input class="input amount-in" id="dv" inputmode="decimal" value="${st.v}"></label>
        <label class="field"><span>السبب (يُسجَّل في السجل)</span><select class="select" id="dr">${['عميل دائم', 'موظف', 'تعويض تأخير', 'عرض اليوم', 'أخرى'].map((r) => `<option ${r === st.reason ? 'selected' : ''}>${r}</option>`).join('')}</select></label>
      </div>
      <div class="modal__f">${cart.disc ? '<button class="btn btn--danger" id="dx" style="flex:0 0 auto">إزالة الخصم</button>' : ''}<button class="btn btn--ink btn--lg" id="dok">طبّق الخصم</button></div>`, { cls: 'modal--sm' });
    const quick = () => { $('#dq', m).innerHTML = (st.type === 'pct' ? [5, 10, 15, 20] : [5, 10, 20, 50]).map((v) => `<button data-v="${v}">${v}${st.type === 'pct' ? '%' : ''}</button>`).join(''); };
    quick();
    $('#dt', m).addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; st.type = b.dataset.t; $$('#dt button', m).forEach((x) => x.classList.toggle('on', x === b)); quick(); });
    $('#dq', m).addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) $('#dv', m).value = b.dataset.v; });
    if ($('#dx', m)) $('#dx', m).addEventListener('click', () => { cart.disc = null; m.close(); drawCart(); });
    $('#dok', m).addEventListener('click', async () => {
      const v = Math.max(0, parseFloat($('#dv', m).value) || 0);
      const gross = D.calc(S(), cart.lines, null).total;
      const pct = st.type === 'pct' ? v : (v / gross) * 100;
      let appr = null;
      if (pct > 10) { const u = await D.approve('discBig', `خصم ${st.type === 'pct' ? v + '%' : fmt(v) + ' ر.س'}`, me); if (!u) return; appr = approverId(u); }
      cart.disc = v ? { type: st.type, v: Math.min(v, st.type === 'pct' ? 100 : gross), reason: $('#dr', m).value } : null;
      cart.discAppr = appr;
      m.close(); drawCart();
    });
  }

  /* ---------- hold / resume ---------- */
  function holdCart() {
    if (!cart.lines.length) return;
    const s = S();
    const cu = cart.cust ? s.customers.find((x) => x.id === cart.cust) : null;
    const name = cart.name || (cu ? cu.name.split(' ')[0] : cart.table ? `طاولة ${cart.table}` : `عميل ${s.holds.length + 1}`);
    D.mutate((st) => { st.holds.push({ id: 'h' + D.uid(), reg: 1, ts: Date.now(), name, staff: me, cart: JSON.parse(JSON.stringify(cart)), lines: cart.lines }); }, 'hold');
    clearCart();
    D.toast('تم تعليق الطلب', `«${name}» — يمكنك الرجوع له من أعلى السلة`, { ic: 'pause' });
  }
  function resume(id) {
    const s = S(); const h = s.holds.find((x) => x.id === id); if (!h) return;
    if (cart.lines.length) holdCart();
    D.mutate((st) => { st.holds = st.holds.filter((x) => x.id !== id); }, 'hold');
    Object.assign(cart, JSON.parse(JSON.stringify(h.cart)));
    drawCart(); drawItems();
  }
  function clearCart() { Object.assign(cart, { lines: [], disc: null, discAppr: null, type: 'takeaway', table: null, cust: null, name: '', redeem: 0, credit: null }); drawCart(); drawItems(); }

  function moreMenu() {
    const m = D.modal(`${D.head(bi('Cashier tools', 'أوامر الكاشير'))}
      <div class="modal__b">
        <div class="dev"><span class="dev__i">${I('refund')}</span><span class="dev__b">${bi('Refund / Cancel', 'مرتجع أو إلغاء طلب مدفوع')}</span><button class="btn btn--ghost btn--sm" data-a="refund">${bi('Find', 'ابحث')}</button></div>
        <div class="dev"><span class="dev__i">${I('drawer')}</span><span class="dev__b"><b>فتح الدرج بدون بيع</b><small>يحتاج موافقة، ويُسجَّل باسمك مع السبب</small></span><button class="btn btn--ghost btn--sm" data-a="nosale">افتح</button></div>
        <div class="dev"><span class="dev__i">${I('print')}</span><span class="dev__b"><b>إعادة طباعة آخر فاتورة</b><small>تُطبع وعليها كلمة «نسخة»</small></span><button class="btn btn--ghost btn--sm" data-a="last">اطبع</button></div>
        <div class="dev"><span class="dev__i">${I('cash')}</span><span class="dev__b"><b>مصروف من الدرج</b><small>ثلج، توصيل، مشتريات بسيطة</small></span><button class="btn btn--ghost btn--sm" data-a="payout">سجّل</button></div>
        <div class="dev"><span class="dev__i">${I('trash')}</span><span class="dev__b"><b>إلغاء الطلب الحالي</b><small>كل صنف يُسجَّل في سجل الحذف</small></span><button class="btn btn--danger btn--sm" data-a="clear" ${cart.lines.length ? '' : 'disabled'}>إلغاء</button></div>
      </div>`, { cls: 'modal--sm' });
    m.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      const a = b.dataset.a; m.close();
      if (a === 'nosale') noSale();
      if (a === 'refund') openFindOrder();
      if (a === 'last') { const o = S().orders.filter((x) => x.reg === 1).slice(-1)[0]; if (o) showReceipt(o, true); }
      if (a === 'payout') openPayout();
      if (a === 'clear') {
        const u = await D.approve('void', 'إلغاء الطلب كله', me); if (!u) return;
        D.mutate(() => D.log(me, 'void', `إلغاء طلب قبل الدفع: ${cart.lines.map((l) => D.prod(l.pid).ar + ' ×' + l.qty).join('، ')}`, approverId(u), 'warn'), 'void');
        clearCart();
      }
    });
  }
  function noSale() {
    const m = D.modal(`${D.head('فتح الدرج بدون بيع', 'من أكثر الحركات التي يحدث فيها تلاعب، لذلك تُسجَّل')}
      <div class="modal__b"><label class="field"><span>السبب</span><select class="select" id="ns">${['فكّة لعميل', 'تبديل فكّة', 'تصحيح خطأ', 'أخرى'].map((r) => `<option>${r}</option>`).join('')}</select></label></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--ink" id="ok">افتح الدرج</button></div>`, { cls: 'modal--sm' });
    $('#ok', m).addEventListener('click', async () => {
      const why = $('#ns', m).value; m.close();
      const u = await D.approve('nosale', why, me); if (!u) return;
      D.mutate(() => D.log(me, 'nosale', `فتح الدرج بدون بيع — السبب: ${why}`, approverId(u), 'risk'), 'nosale');
      D.drawerPop('فُتح الدرج — وسُجّلت الحركة'); D.sound('ok');
    });
  }

  /* ---------- payment ---------- */
  function openPay(ord) {
    if (!ord || !ord.lines) ord = null; // من زرار الدفع بيوصل event
    if (!ord && !cart.lines.length) return;
    if (!D.openShift(S(), 1)) { D.toast('لا توجد وردية مفتوحة', 'افتح وردية أولًا من صفحة الوردية', { warn: 1 }); go('shift'); return; }
    const c = ord ? { total: ord.total, vat: ord.vat } : totals();
    const pays = [];
    const crA = !ord && cart.credit ? D.r2(Math.min(cart.credit.a, c.total)) : 0;
    if (crA) pays.push({ m: 'credit', a: crA });
    let method = 'mada', busy = false;
    const paidSum = () => D.r2(pays.reduce((a, p) => a + p.a, 0));
    const remaining = () => D.r2(c.total - paidSum());
    let amount = remaining();
    const TEN = { mada: ['mada', 'مدى'], apple: ['Apple Pay', 'الجوال'], cash: ['Cash', 'كاش'], stc: ['STC Pay', 'المحفظة'] };
    const STEPS = [['Tender', 'طريقة الدفع'], ['Confirm', 'التأكيد'], ['Receipt', 'الفاتورة']];
    if (!ord) cartBroadcast('pay');
    const m = D.modal(`${D.head(bi(ord ? 'Collect' : 'Charge', ord ? (ord.ch === 'kiosk' ? 'تحصيل طلب الكشك' : 'تحصيل طلب المنيو') : 'الدفع'), ord ? `طلب #${ord.no} · ${esc(ord.name || '')} · ${D.CH[ord.ch].ar}${ord.table ? ' ' + ord.table : ''}` : `طلب #${S().seq.no + 1} · ${cart.lines.reduce((a, l) => a + l.qty, 0)} صنف`)}<div class="modal__b"><div id="pst"></div><div id="pb"></div></div>`, { cls: 'modal--wide', sticky: true, onClose: (v) => { if (v !== 'paid') cartBroadcast(); } });
    const takeLabel = () => {
      const x = fmt(Math.min(amount, remaining()) || 0);
      if (D.LIVE && method !== 'cash') return `${I(method === 'stc' ? 'qr' : 'card')}${bi('Confirm ' + x + ' paid', method === 'stc' ? 'بعد تأكيد العميل من التطبيق اضغط هنا' : 'اكتب المبلغ على الجهاز، وبعد الموافقة اضغط هنا')}`;
      return method === 'cash' ? `${I('cash')}${bi('Take ' + x + ' cash', 'استلام كاش')}` : method === 'stc' ? `${I('qr')}${bi('Send ' + x + ' to STC Pay', 'العميل يؤكد من التطبيق')}` : `${I('card')}${bi('Send ' + x + ' to terminal', 'المبلغ يُرسل لجهاز الشبكة')}`;
    };
    function paint() {
      const rem = remaining();
      $('#pst', m).innerHTML = stepper(STEPS, 0);
      if (rem <= 0.009) {
        const back = D.r2(cart.credit.a - c.total);
        $('#pb', m).innerHTML = `<div class="done-ok wz">${check('blue')}<b style="font-size:17px">${bi('Covered by exchange credit', 'رصيد الاستبدال يغطي الطلب')}</b>${back > 0 ? `<span class="muted">الفرق للعميل كاش</span><span class="change">${fmt(back)} ر.س</span>` : ''}<button class="btn btn--go btn--lg" id="fin" style="margin-top:8px">${bi('Complete', 'إتمام الطلب')}</button></div>`;
        $('#fin', m).addEventListener('click', finish);
        return;
      }
      const cashGiven = method === 'cash' ? amount : 0;
      $('#pb', m).innerHTML = `<div class="pay wz">
        <div class="grid" style="gap:12px;align-content:start">
          <div class="pay__due"><span class="label">${pays.length ? 'Remaining · المتبقي' : 'Amount due · المطلوب'}</span><span>${money(rem)}</span><span class="rem">الإجمالي ${fmt(c.total)} ر.س${c.vat ? ` · منها ضريبة ${fmt(c.vat)}` : ''}</span></div>
          ${pays.length ? `<div class="paid-list">${pays.map((p) => `<div><span>${D.PAY[p.m].en} · ${D.PAY[p.m].ar}${p.auth ? ` · ${p.auth}` : ''}</span><span class="num">${fmt(p.a)}</span></div>`).join('')}</div>` : ''}
          <div class="blind">${I('drawer', 'sm')} ${bi('Split', 'تقسيم الفاتورة')} — اكتب جزء من المبلغ واستلمه، والمتبقي يُدفع بطريقة أخرى.</div>
        </div>
        <div class="grid" style="gap:12px;align-content:start">
          <div class="tenders">${['mada', 'apple', 'cash', 'stc'].map((t) => `<button class="tender${method === t ? ' on' : ''}" data-m="${t}">${D.payIcon(t)}${bi(TEN[t][0], TEN[t][1])}</button>`).join('')}</div>
          <label class="field"><span>${method === 'cash' ? 'Received · المبلغ المستلم من العميل' : 'Amount · المبلغ على ' + D.PAY[method].ar}</span><input class="input amount-in" id="amt" inputmode="decimal" value="${fmt(amount).replace(/,/g, '')}"></label>
          ${method === 'cash' ? `<div class="quick">${[rem, Math.ceil(rem / 10) * 10, Math.ceil(rem / 50) * 50, Math.ceil(rem / 100) * 100].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).map((v, i) => `<button data-a="${v}">${i === 0 ? 'Exact' : fmt(v, 0)}</button>`).join('')}</div>
            <div class="pay__due" style="padding:12px 16px;background:var(--go-50)"><span class="label">Change · الباقي للعميل</span><span class="change">${fmt(Math.max(0, cashGiven - rem))}</span></div>` : ''}
          <button class="btn btn--go btn--lg btn--block" id="take">${takeLabel()}</button>
        </div></div>`;
      $$('[data-m]', m).forEach((b) => b.addEventListener('click', () => { if (busy) return; method = b.dataset.m; amount = remaining(); paint(); }));
      $$('[data-a]', m).forEach((b) => b.addEventListener('click', () => { amount = +b.dataset.a; paint(); }));
      const ai = $('#amt', m);
      ai.addEventListener('input', () => { amount = parseFloat(ai.value) || 0; const r = remaining(); if (method === 'cash') { const ch = m.querySelector('.change'); if (ch) ch.textContent = fmt(Math.max(0, amount - r)); } $('#take', m).innerHTML = takeLabel(); });
      ai.addEventListener('keydown', (e) => { if (e.key === 'Enter') take(); });
      $('#take', m).addEventListener('click', take);
    }
    function take() {
      if (busy) return;
      const rem = remaining();
      const a = D.r2(Math.min(amount, rem));
      if (a <= 0) return;
      if (method === 'cash') {
        pays.push({ m: 'cash', a, tendered: Math.max(amount, a) });
        D.drawerPop(); D.sound('ok');
        next();
        return;
      }
      if (D.LIVE) { pays.push({ m: method, a }); D.sound('ok'); next(); return; }
      busy = true;
      $('#pst', m).innerHTML = stepper(STEPS, 1);
      $('#pb', m).innerHTML = `<div class="term wait"><div style="position:relative"><svg class="term__waves" width="60" height="26" viewBox="0 0 60 26" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 20a17 17 0 0 1 24 0M10 13a28 28 0 0 1 40 0M25 25a8 8 0 0 1 10 0"/></svg><div class="term__dev"><i>${fmt(a)}</i></div></div>
        <b style="font-size:16px">${method === 'stc' ? 'العميل يؤكّد الدفع من تطبيق STC Pay…' : 'قرّب البطاقة أو الجوال من جهاز الشبكة…'}</b><span class="muted">Sent to terminal · أُرسل المبلغ للجهاز تلقائيًا · ${D.PAY[method].ar}</span></div>`;
      setTimeout(() => {
        const auth = String(100000 + Math.floor(Math.random() * 899999));
        pays.push({ m: method, a, auth });
        D.sound('ok');
        busy = false;
        next();
      }, 1700);
    }
    function next() {
      if (remaining() > 0.009) { method = method === 'cash' ? 'mada' : 'cash'; amount = remaining(); paint(); return; }
      finish();
    }
    function finish() {
      const cash = pays.filter((p) => p.m === 'cash');
      const tendered = cash.reduce((a, p) => a + (p.tendered || p.a), 0);
      const cashA = cash.reduce((a, p) => a + p.a, 0);
      if (ord) {
        const o2 = D.collect(ord.id, { pays: pays.map((p) => ({ m: p.m, a: p.a, auth: p.auth })), cash: cash.length ? { tendered: D.r2(tendered), change: D.r2(tendered - cashA) } : null, staff: me });
        m.close('paid'); showReceipt(o2, false, true); return;
      }
      const creditBack = cart.credit ? D.r2(Math.max(0, cart.credit.a - c.total)) : 0;
      const o = D.placeOrder({ lines: cart.lines, disc: cart.disc, discAppr: cart.discAppr, type: cart.type, table: cart.table, cust: cart.cust, redeem: cart.redeem, name: cart.name, staff: me,
        pays: pays.map((p) => ({ m: p.m, a: p.a, auth: p.auth })), cash: cash.length ? { tendered: D.r2(tendered), change: D.r2(tendered - cashA) } : null,
        credit: cart.credit ? { cn: cart.credit.cn, inv: cart.credit.inv, a: cart.credit.a } : null, creditBack });
      if (creditBack) D.drawerPop('فُتح الدرج — الفرق كاش للعميل');
      const change = (o.cash ? o.cash.change : 0) + creditBack;
      cartBroadcast('done', { no: o.no, change, total: o.total });
      m.close('paid');
      clearCart();
      openCartSheet(false);
      showReceipt(o, false, true);
      setTimeout(() => cartBroadcast('idle'), 9000);
    }
    paint();
  }
  function showReceipt(o, copy, fresh) {
    const s = S();
    const z = D.tlv(o);
    const sts = D.stationsOf(s, o).map((x) => D.STATIONS[x].ar);
    const m = D.modal(`${D.head(fresh ? bi('Paid', 'تم الدفع') : bi('Invoice ' + o.inv, 'الفاتورة'), fresh ? `طلب #${o.no}${sts.length ? ' · وصل لـ' + sts.join(' و') : ''}` : `${D.dateArS(o.ts)} · ${D.time(o.ts)}`)}
      <div class="modal__b">
        ${fresh ? stepper([['Tender', 'طريقة الدفع'], ['Confirm', 'التأكيد'], ['Receipt', 'الفاتورة']], 3) : ''}
        ${fresh ? `<div class="done-ok">${check()}${o.cash && o.cash.change ? `<span class="muted">Change · الباقي للعميل</span><span class="change">${fmt(o.cash.change)} ر.س</span>` : `<b>${fmt(o.total)} ر.س · ${o.pays.map((p) => D.PAY[p.m].ar).join(' + ')}</b>`}${o.creditBack ? `<span class="muted">فرق الاستبدال للعميل كاش: ${fmt(o.creditBack)} ر.س</span>` : ''}</div>` : ''}
        <div class="rc-stage">${D.receiptHTML(o, { print: fresh && s.settings.printer, copy })}</div>
        ${D.orderVat(o) ? `<details class="tlv"><summary style="cursor:pointer;font-weight:800">${bi('ZATCA QR', 'ماذا يحتوي QR الفاتورة؟ — المرحلة الأولى')}</summary>
          <div style="margin-top:8px">${z.fields.map((f) => `<div><code>${f.tag}</code><span>${['', 'اسم البائع', 'الرقم الضريبي', 'وقت الفاتورة', 'الإجمالي مع الضريبة', 'مبلغ الضريبة'][f.tag]}</span><code>${esc(f.v)}</code></div>`).join('')}</div>
          <p class="muted" style="margin-top:8px;font-size:11.5px">هذه الحقول مرمّزة بصيغة TLV ثم Base64 كما تطلب الهيئة. الربط مع منصة «فاتورة» (المرحلة الثانية) يُفعَّل عند التشغيل الفعلي.</p></details>` : ''}
      </div>
      <div class="modal__f">${fresh && D.canRefund(o) ? `<button class="btn btn--danger" id="cx" style="flex:0 0 auto">${I('refund', 'sm')}${bi('Cancel', 'إلغاء الطلب')}</button>` : ''}<button class="btn btn--ghost" id="pr">${I('print', 'sm')}${bi('Print', 'اطبع')}</button>${D.LIVE ? '' : `<button class="btn btn--ghost" id="wa">${I('send', 'sm')}${bi('Send', 'للعميل')}</button>`}${fresh ? `<button class="btn btn--ink" data-close>${bi('New order', 'طلب جديد')}</button>` : ''}</div>`);
    $('#pr', m).addEventListener('click', () => D.print(D.receiptHTML(o, { copy: !fresh })));
    if ($('#wa', m)) $('#wa', m).addEventListener('click', () => D.toast('أُرسلت الفاتورة (تجربة)', 'في التشغيل الفعلي تُرسل للعميل برسالة SMS أو واتساب مع رابط الفاتورة', { ic: 'send' }));
    if ($('#cx', m)) $('#cx', m).addEventListener('click', () => { m.close(); openRefund(o.id, { all: true, reason: 'mind' }); });
  }

  /* =====================================================================
     ORDERS
     ===================================================================== */
  let otab = 'online', oq = '';
  const shownCards = new Set();
  function renderOrders(view) {
    view.className = 'view';
    const s = S();
    const online = s.orders.filter((o) => o.status === 'new');
    const active = s.orders.filter((o) => o.status === 'prep' || o.status === 'ready').sort((a, b) => b.ts - a.ts);
    view.innerHTML = `<div class="vh"><div><span class="label">Orders · ${D.dateAr()}</span><h1>Orders</h1><p>طلبات الموقع (QR الطاولة) والكشك تصل هنا مباشرة، مع كل فواتير اليوم والبحث والمرتجعات.</p></div>
      <button class="btn btn--danger" id="ofind">${I('refund', 'sm')}${bi('Refund', 'مرتجع أو إلغاء')}</button>
      <div class="seg" id="ot"><button data-t="online" class="${otab === 'online' ? 'on' : ''}">${bi('Incoming' + (online.length ? ' · ' + online.length : ''), 'الموقع والكشك')}</button><button data-t="active" class="${otab === 'active' ? 'on' : ''}">${bi('Active · ' + active.length, 'قيد التحضير')}</button><button data-t="all" class="${otab === 'all' ? 'on' : ''}">${bi('All invoices · ' + s.orders.length, 'كل الفواتير')}</button></div></div>
      <div id="ob"></div>`;
    $('#ot', view).addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; otab = b.dataset.t; renderOrders(view); });
    $('#ofind', view).addEventListener('click', openFindOrder);
    const ob = $('#ob', view);
    if (otab === 'online') {
      ob.innerHTML = `<div class="set-row card" style="margin-bottom:14px;padding:12px 18px"><span><b>قبول تلقائي لطلبات الموقع</b><small>عند الإيقاف: يراجع الكاشير الطلب ويقبله، ثم ينتقل للباريستا أو المطبخ مباشرة</small></span><button class="switch ${s.settings.autoAccept ? 'on' : ''}" id="aa" aria-label="قبول تلقائي"></button></div>
        <div class="ord-list">${online.length ? online.map((o) => ocard(o, true)).join('') : `<div class="card empty">${I('qr')}<b style="color:var(--ink-2)">لا توجد طلبات بانتظار موافقتك</b><span>عندما يطلب عميل من QR الطاولة أو من الموقع، أو يختار «الدفع عند الكاشير» في الكشك، سيظهر الطلب هنا مع تنبيه صوتي.</span></div>`}</div>
        <h3 style="margin:22px 0 10px;font-size:14px">آخر الطلبات الأونلاين اليوم</h3>
        <div class="ord-list">${s.orders.filter((o) => o.ch !== 'counter' && o.status !== 'new').slice(-5).reverse().map((o) => ocard(o)).join('')}</div>`;
      $('#aa', ob).addEventListener('click', () => { D.mutate((st) => { st.settings.autoAccept = !st.settings.autoAccept; }, 'set'); renderOrders(view); });
    } else if (otab === 'active') {
      ob.innerHTML = `<div class="ord-list">${active.map((o) => ocard(o)).join('') || `<div class="card empty">${I('cup')}<span>لا توجد طلبات قيد التحضير الآن</span></div>`}</div>`;
    } else {
      const k = oq.trim();
      const list = D.today(s).filter((o) => !k || (o.inv || '').includes(k) || String(o.no) === k.replace('#', '') || (o.name || '').includes(k) || (o.cust && (s.customers.find((c) => c.id === o.cust) || {}).phone?.includes(k))).slice().reverse();
      ob.innerHTML = `<div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap"><label class="search" style="flex:1;min-width:220px"><span>${I('search')}</span><input class="input" id="oq" placeholder="رقم الفاتورة INV-… أو رقم الطلب أو اسم العميل" value="${esc(oq)}"></label></div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوقت</th><th>الطلب</th><th>الفاتورة</th><th>المصدر</th><th>الأصناف</th><th>الدفع</th><th>الكاشير</th><th class="r">الإجمالي</th><th>الحالة</th></tr></thead>
        <tbody>${list.slice(0, 120).map((o) => `<tr class="click" data-o="${o.id}"><td class="nw en">${D.time(o.ts)}</td><td class="en"><b>#${o.no}</b></td><td class="mono nw" style="font-size:12px">${o.inv || '—'}</td><td class="nw">${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''}</td><td>${o.lines.reduce((a, l) => a + l.qty, 0)}</td><td class="nw">${o.pays.map((p) => `<span class="pill">${D.PAY[p.m].ar}</span>`).join(' ')}</td><td class="nw">${esc(D.who(o).short)}${o.ch === 'kiosk' && !o.staff ? '' : ' · ' + o.reg}</td><td class="r nw">${money(o.total)}</td><td class="nw">${statusPill(o)}</td></tr>`).join('')}</tbody></table></div>`;
      const oi = $('#oq', ob);
      oi.addEventListener('input', () => { oq = oi.value; const pos = oi.selectionStart; renderOrders(view); const n = $('#oq', view); n.focus(); n.setSelectionRange(pos, pos); });
    }
    ob.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]');
      if (a) {
        const id = a.dataset.id;
        if (a.dataset.act === 'accept') acceptOrder(id);
        if (a.dataset.act === 'reject') rejectOnline(id);
        if (a.dataset.act === 'kcancel') cancelKiosk(id);
        if (a.dataset.act === 'collect') openPay(S().orders.find((x) => x.id === id));
        if (a.dataset.act === 'ready') { D.setStatus(id, 'ready'); D.sound('ready'); }
        if (a.dataset.act === 'done') D.setStatus(id, 'done');
        return;
      }
      const row = e.target.closest('[data-o]');
      if (row) orderDetail(row.dataset.o);
    });
  }
  function statusPill(o) {
    if (o.status === 'rejected') return `<span class="pill pill--red">${o.payFirst ? 'Cancelled · ملغي' : 'Rejected · مرفوض'}</span>`;
    if (o.status === 'new' && o.payFirst) return '<span class="pill pill--amber"><i class="dot pulse"></i>Pay at counter · يدفع عند الكاشير</span>';
    if (o.cancelled || o.status === 'cancelled') return '<span class="pill pill--red">Cancelled · ملغي</span>';
    if (o.unpaid && o.status !== 'new') return '<span class="pill pill--amber">Unpaid · بانتظار الدفع</span>';
    if (o.refunded) return '<span class="pill pill--red">Partial refund · مرتجع جزئي</span>';
    return { new: '<span class="pill pill--red"><i class="dot pulse"></i>New · جديد</span>', prep: '<span class="pill pill--amber">Preparing · قيد التحضير</span>', ready: '<span class="pill pill--go">Ready · جاهز</span>', done: '<span class="pill">Picked up · تم التسليم</span>' }[o.status] + (o.synced === false ? ' <span class="pill pill--amber">Offline · على الجهاز</span>' : '');
  }
  function ocard(o, isNew) {
    const items = o.lines.map((l) => `${l.qty}× ${D.prod(l.pid).ar}`).join('، ');
    const collect = o.unpaid && !o.payFirst && o.status !== 'new' && o.status !== 'rejected' && !o.cancelled ? `<button class="btn btn--go btn--sm" data-act="collect" data-id="${o.id}">${I('cash', 'sm')}${bi('Collect ' + fmt(o.total), 'تحصيل')}</button>` : '';
    const acts = isNew && o.payFirst ? `<button class="btn btn--ghost btn--sm" data-act="kcancel" data-id="${o.id}">${bi('Cancel', 'إلغاء')}</button><button class="btn btn--go btn--sm" data-act="collect" data-id="${o.id}">${I('cash', 'sm')}${bi('Collect ' + fmt(o.total), 'تحصيل وإرسال للتحضير')}</button>`
      : isNew ? `<button class="btn btn--ghost btn--sm" data-act="reject" data-id="${o.id}">${bi('Reject', 'رفض')}</button><button class="btn btn--go btn--sm" data-act="accept" data-id="${o.id}">${I('check', 'sm')}${bi('Accept', 'اقبل وأرسل للتحضير')}</button>`
      : o.status === 'prep' ? `<button class="btn btn--ghost btn--sm" data-act="ready" data-id="${o.id}">${bi('Ready', 'جاهز')}</button>` : o.status === 'ready' ? `<button class="btn btn--ghost btn--sm" data-act="done" data-id="${o.id}">${bi('Picked up', 'تم التسليم')}</button>` : `<button class="btn btn--soft btn--sm" data-o="${o.id}">${bi('Details', 'التفاصيل')}</button>`;
    const first = !shownCards.has(o.id); shownCards.add(o.id);
    return `<div class="ocard${isNew ? ' new' : ''}${first && booted ? ' in' : ''}" ${isNew ? '' : `data-o="${o.id}"`} style="${isNew ? '' : 'cursor:pointer'}">
      <span class="ocard__no"><b>#${o.no}</b><small>${D.time(o.ts)}</small></span>
      <div class="ocard__b"><b>${esc(o.name || 'عميل')} · ${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''}</b><p>${esc(items)}</p>
        <div class="ocard__meta">${statusPill(o)}<span class="pill pill--blue">${o.unpaid ? 'الدفع عند الكاشير' : o.pays.map((p) => D.PAY[p.m].ar).join(' + ')}</span><span class="pill">${money(o.total)}</span>${isNew ? `<span class="pill">${D.ago(o.ts)}</span>` : ''}</div></div>
      <div class="ocard__act">${collect}${acts}</div></div>`;
  }
  // قبول طلب الموقع: يروح لشاشة الباريستا أو المطبخ (أو الاتنين) حسب الأصناف
  function acceptOrder(id) {
    D.setStatus(id, 'prep');
    const s = S(); const o = s.orders.find((x) => x.id === id); if (!o) return;
    const sts = D.stationsOf(s, o).map((x) => D.STATIONS[x].ar);
    D.toast(`تم قبول الطلب #${o.no}`, sts.length ? 'وصل لـ' + sts.join(' و') : 'لا توجد أصناف تحتاج تحضير', { ic: 'cup' });
  }
  function cancelKiosk(id) {
    const o = S().orders.find((x) => x.id === id); if (!o) return;
    const m = D.modal(`${D.head(bi('Cancel kiosk order', 'إلغاء طلب الكشك'), `طلب #${o.no} — العميل لم يدفع، فلا يوجد مبلغ للاسترجاع`)}<div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Back', 'رجوع')}</button><button class="btn btn--danger" id="ok">${bi('Cancel order', 'إلغاء الطلب')}</button></div>`, { cls: 'modal--sm' });
    $('#ok', m).addEventListener('click', () => { D.setStatus(id, 'rejected'); D.mutate(() => D.log(me, 'void', `إلغاء طلب كشك غير مدفوع #${o.no} — ${fmt(o.total)} ر.س`, null, 'warn'), 'reject'); m.close(); D.toast('تم إلغاء الطلب', `#${o.no}`, { ic: 'x' }); });
  }
  function rejectOnline(id) {
    const o0 = S().orders.find((x) => x.id === id); const unpaid0 = !!(o0 && o0.unpaid);
    const m = D.modal(`${D.head(bi('Reject order', 'رفض الطلب'), unpaid0 ? 'العميل لم يدفع بعد، فلا يوجد مبلغ للاسترجاع' : 'يُعاد المبلغ للعميل أونلاين تلقائيًا، ويصله إشعار بذلك')}
      <div class="modal__b"><div class="picks">${[['Sold out', 'صنف نفد', 'box'], ['Too busy', 'الفرع مزدحم', 'clock'], ['Duplicate', 'طلب مكرر', 'orders']].map(([en, ar, ic], i) => `<button class="pickc${i ? '' : ' on'}" data-rr="${ar}">${I(ic)}${bi(en, ar)}</button>`).join('')}</div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Back', 'رجوع')}</button><button class="btn btn--danger" id="ok">${unpaid0 ? bi('Reject order', 'رفض الطلب') : bi('Reject & refund', 'رفض واسترجاع المبلغ')}</button></div>`, { cls: 'modal--sm' });
    let why = 'صنف نفد';
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-rr]'); if (!b) return; why = b.dataset.rr; $$('[data-rr]', m).forEach((x) => x.classList.toggle('on', x === b)); });
    $('#ok', m).addEventListener('click', () => { if (unpaid0) { D.setStatus(id, 'rejected'); D.mutate(() => D.log(me, 'void', `رفض طلب غير مدفوع #${o0.no} — ${why}`, null, 'warn'), 'reject'); m.close(); D.toast('تم رفض الطلب', 'لم يدفع العميل، فلا يوجد استرجاع', { ic: 'x' }); return; } D.setStatus(id, 'rejected'); D.mutate((s) => { const o = s.orders.find((x) => x.id === id); o.refunded = o.total; o.refunds = [{ cn: 'CN-' + (++s.seq.cn), ts: Date.now(), a: o.total, vat: o.vat, parts: [{ m: 'online', a: o.total }], m: 'online', lines: o.lines.map((l, i) => ({ i, q: l.qty })), by: me, reason: why }]; D.log(me, 'refund', `رفض طلب أونلاين #${o.no} — ${why} — استرجاع ${fmt(o.total)} ر.س`, null, 'warn'); }, 'reject'); m.close(); D.toast('تم رفض الطلب', 'المبلغ يرجع للعميل أونلاين', { ic: 'refund' }); });
  }
  function orderDetail(id) {
    const s = S(); const o = s.orders.find((x) => x.id === id); if (!o) return;
    const step = (label, ts, on) => `<div class="${on ? '' : 'off'}"><span>${label}</span><small>${ts ? D.time(ts) : '—'}</small></div>`;
    const cu = o.cust ? s.customers.find((c) => c.id === o.cust) : null;
    const m = D.modal(`${D.head(bi('Invoice ' + o.inv, 'فاتورة · طلب #' + o.no), `${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''} · ${esc(D.who(o).name)}${o.ch === 'kiosk' && !o.staff ? '' : ' · كاشير ' + o.reg}${cu ? ' · ' + esc(cu.name) : ''}`)}
      <div class="modal__b"><div class="grid g2" style="align-items:start">
        <div class="grid" style="gap:12px">
          ${D.canRefund(o) ? `<button class="btn btn--danger btn--lg btn--block" id="rf">${I('refund')}${bi('Refund / Cancel', 'صنف واحد أو الطلب كله')}</button>` : `<div class="blind">${statusPill(o)} <span>${o.status === 'new' ? 'الطلب لم يُقبل بعد — اقبله أو ارفضه من تبويب Online' : 'لا يوجد ما يمكن إرجاعه من هذا الطلب'}</span></div>`}
          <div class="card" style="padding:14px"><span class="label">Timeline · المراحل</span><div class="tl">${step('Order · تسجيل الطلب', o.ts, 1)}${step('Barista · وصل للباريستا', o.tsAcc, o.tsAcc)}${o.cancelled ? step('Cancelled · أُلغي', o.tsDone, 1) : step('Ready · جاهز', o.tsReady, o.tsReady) + step('Picked up · تم التسليم', o.tsDone, o.tsDone)}</div></div>
          <div class="card" style="padding:14px"><span class="label">Payment · الدفع</span>${o.pays.map((p) => `<div class="set-row" style="padding:8px 0"><span><b>${D.PAY[p.m].en} · ${D.PAY[p.m].ar}</b>${p.auth ? `<small class="mono">AUTH ${p.auth}</small>` : ''}</span>${money(p.a)}</div>`).join('')}
            ${(o.refunds || []).map((r, k) => `<div class="set-row" style="padding:8px 0"><span><b class="down">${D.noteName(o).en} · ${r.cn}</b><small>${esc(r.reason)} · ${D.time(r.ts)}${r.appr ? ' · وافق ' + esc(D.staff(r.appr).short) : ''}${r.parts ? ' · ' + r.parts.map((p) => D.PAY[p.m].ar).join(' + ') : ''}</small></span><span style="display:grid;justify-items:end;gap:4px"><span class="down">-${money(r.a)}</span>${r.lines ? `<button class="btn btn--soft btn--sm" data-cn="${k}">${bi('View', 'الإشعار')}</button>` : ''}</span></div>`).join('')}</div>
        </div>
        <div class="rc-stage" style="padding:0">${D.receiptHTML(o, { copy: 1 })}</div>
      </div></div>`, { cls: 'modal--wide' });
    if ($('#rf', m)) $('#rf', m).addEventListener('click', () => { m.close(); openRefund(o.id); });
    $$('[data-cn]', m).forEach((b) => b.addEventListener('click', () => showCredit(o.id, +b.dataset.cn)));
  }
  function showCredit(oid, k) {
    const o = S().orders.find((x) => x.id === oid); const r = o.refunds[k];
    const m = D.modal(`${D.head(bi(D.noteName(o).en + ' ' + r.cn, D.noteName(o).ar), `مرتبط بالفاتورة ${o.inv}`)}<div class="modal__b"><div class="rc-stage">${D.creditHTML(o, r)}</div></div><div class="modal__f"><button class="btn btn--ghost" id="pc">${I('print', 'sm')}${bi('Print', 'اطبع')}</button><button class="btn btn--ink" data-close>${bi('Close', 'إغلاق')}</button></div>`, { cls: 'modal--sm' });
    $('#pc', m).addEventListener('click', () => D.print(D.creditHTML(o, r)));
  }
  const REASONS = [
    { id: 'wrong', en: 'Wrong item', ar: 'غير مطابق للطلب', ic: 'cup' },
    { id: 'mind', en: 'Changed mind', ar: 'العميل غيّر رأيه', ic: 'refund' },
    { id: 'quality', en: 'Quality', ar: 'مشكلة في الجودة', ic: 'star' },
    { id: 'missing', en: 'Missing item', ar: 'صنف لم يُسلَّم', ic: 'box' },
    { id: 'mistake', en: 'Entry mistake', ar: 'خطأ في الإدخال', ic: 'edit' },
    { id: 'late', en: 'Too slow', ar: 'تأخر الطلب', ic: 'clock' },
  ];
  function openFindOrder() {
    const m = D.modal(`${D.head(bi('Refund', 'مرتجع — ابحث عن الطلب'), D.LIVE ? 'برقم الفاتورة أو رقم الطلب أو جوال العميل' : 'برقم الفاتورة أو رقم الطلب أو جوال العميل، أو امسح QR الفاتورة')}
      <div class="modal__b"><div style="display:flex;gap:8px"><label class="search" style="flex:1;min-width:0"><span>${I('search')}</span><input class="input" id="fq" placeholder="INV-… · #… · 05…" autocomplete="off"></label>${D.LIVE ? '' : `<button class="btn btn--ghost" id="fscan">${I('scan', 'sm')}${bi('Scan', 'امسح')}</button>`}</div>
      <div class="wz-h" style="margin-top:14px"><span class="term-en">Recent</span><span class="muted">آخر الطلبات</span></div><div id="fl" class="grid" style="gap:8px"></div></div>`);
    const draw = () => {
      const k = $('#fq', m).value.trim().replace('#', '');
      const s = S();
      const list = s.orders.filter((o) => o.status !== 'new' && o.status !== 'rejected' && !o.unpaid && (!k || (o.inv || '').includes(k) || String(o.no) === k || (o.name || '').includes(k) || (o.cust && ((s.customers.find((c) => c.id === o.cust) || {}).phone || '').includes(k)))).slice(-60).reverse().slice(0, k ? 12 : 8);
      $('#fl', m).innerHTML = list.map((o) => `<button class="ocard" data-fo="${o.id}" style="text-align:start;padding:10px 12px;cursor:pointer"><span class="ocard__no"><b>#${o.no}</b><small>${D.time(o.ts)}</small></span><span class="ocard__b"><b>${esc(o.lines.map((l) => `${l.qty}× ${D.prod(l.pid).ar}`).join('، '))}</b><p class="mono" style="font-size:11.5px">${o.inv} · ${o.pays.map((p) => D.PAY[p.m].ar).join(' + ')}</p></span><span style="display:grid;justify-items:end;gap:4px">${money(o.total)}${D.canRefund(o) ? (o.refunded ? statusPill(o) : '') : statusPill(o)}</span></button>`).join('') || `<div class="empty">${I('search')}<span>لا يوجد طلب بهذا الرقم</span></div>`;
    };
    draw();
    $('#fq', m).addEventListener('input', draw);
    if ($('#fscan', m)) $('#fscan', m).addEventListener('click', () => { const o = S().orders.filter((x) => x.reg === 1 && D.canRefund(x)).slice(-1)[0]; if (!o) return; D.sound('beep'); D.toast('تمت قراءة QR الفاتورة', o.inv, { ic: 'scan', ms: 2000 }); m.close(); openRefund(o.id); });
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-fo]'); if (!b) return; const o = S().orders.find((x) => x.id === b.dataset.fo); if (!D.canRefund(o)) { D.toast('لا يوجد ما يُرجع من هذا الطلب', `${o.inv} — مرتجع بالكامل`, { warn: 1 }); return; } m.close(); openRefund(o.id); });
    setTimeout(() => $('#fq', m).focus(), 60);
  }
  function openRefund(id, preset) {
    preset = preset || {};
    const o0 = S().orders.find((x) => x.id === id); if (!o0) return;
    if (!D.canRefund(o0)) { D.toast('لا يوجد ما يُرجع من هذا الطلب', o0.inv, { warn: 1 }); return; }
    const left = D.refundable(o0);
    const pick = o0.lines.map((l, i) => ({ i, q: preset.all ? left[i] : 0 }));
    let step = 0, reason = preset.reason || null, how = 'original', retail = true, busy = false;
    const online = o0.ch !== 'counter';
    const STEPS = [['Items', 'الأصناف'], ['Reason', 'السبب'], ['Refund to', 'الاسترجاع'], ['Done', 'تم']];
    const m = D.modal(`${D.head(bi('Refund', 'مرتجع · ' + o0.inv), `طلب #${o0.no} · ${D.time(o0.ts)} · ${esc(D.staff(o0.staff).short)} · كاشير ${o0.reg}`)}<div class="modal__b"><div id="wst"></div><div id="wb"></div></div><div class="modal__f" id="wf"></div>`, { cls: 'modal--wide' });
    const sel = () => pick.filter((p) => p.q > 0);
    const ord = () => S().orders.find((x) => x.id === id);
    function paint() {
      const o = ord(); const stage = D.stage(o);
      const q = D.refundQuote(o, sel(), how);
      $('#wst', m).innerHTML = stepper(STEPS, step);
      const sumBox = `<div class="refund-sum"><span>${bi('Refund total', 'إجمالي المرتجع')}<small>${sel().reduce((a, p) => a + p.q, 0)} صنف${q.vat ? ` · منها ضريبة ${fmt(q.vat)}` : ''}</small></span>${money(q.a)}</div>`;
      let body = '', foot = '';
      if (step === 0) {
        body = `<div class="ord-head"><span class="ocard__no"><b>#${o.no}</b><small>${D.time(o.ts)}</small></span><div style="flex:1;min-width:0"><b>${o.inv} · ${fmt(o.total)} ر.س</b><small>${o.pays.map((p) => D.PAY[p.m].ar + ' ' + fmt(p.a)).join(' + ')}${o.refunded ? ' · سبق إرجاع ' + fmt(o.refunded) : ''}</small></div>${statusPill(o)}</div>
          <div class="stage-note ${stage === 'queued' ? 'q' : 'm'}">${I(stage === 'queued' ? 'stock' : 'cup', 'sm')}<span>${stage === 'queued' ? 'Not started · الباريستا لم يبدأ — المكوّنات ترجع للمخزون' : stage === 'making' ? 'Being made · قيد التحضير — المرتجع يُشطب عند الباريستا ويُحسب هالكًا' : 'Already made · تم تجهيزه — المشروب المرتجع يُحسب هالكًا'}</span></div>
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px"><span class="wz-h" style="margin:0"><span class="term-en">Items</span><span class="muted">اضغط الصنف المرتجع</span></span><button class="chip ${pick.every((p, i) => p.q === left[i]) ? 'on' : ''}" id="all">${bi('Whole order', 'الطلب كله')}</button></div>
          <div class="rl">${o.lines.map((l, i) => { const p = D.prod(l.pid); const img = D.img(p); return `<div class="rl-item${pick[i].q ? ' on' : ''}${left[i] ? '' : ' off'}" data-ri="${i}" style="cursor:pointer"><span class="thumb" ${img ? `style="background-image:url('${img}')"` : ''}></span><span><b>${esc(p.ar)} <span class="muted en" style="font-weight:400;font-size:12px">${esc(p.en)}</span></b><small>${esc(D.modText(l).join(' · '))}${l.reward ? ' · هدية الولاء' : ''} · ${fmt(l.total / l.qty)} للواحد${left[i] < l.qty ? ` · أُرجع منه ${l.qty - left[i]}` : ''}</small></span>${left[i] ? `<span class="qty"><button data-r="${i}" data-d="-1">${I('minus', 'sm')}</button><span>${pick[i].q}/${left[i]}</span><button data-r="${i}" data-d="1">${I('plus', 'sm')}</button></span>` : '<span class="pill">أُرجع بالكامل</span>'}</div>`; }).join('')}</div>${sumBox}`;
        foot = `<button class="btn btn--ghost" data-x>${bi('Close', 'إغلاق')}</button><button class="btn btn--ink btn--lg" id="wzNext" ${sel().length ? '' : 'disabled'}>${bi('Next', 'التالي')}</button>`;
      } else if (step === 1) {
        const back = [], waste = [];
        sel().forEach(({ i, q: n }) => { const p = D.prod(o.lines[i].pid); (stage === 'queued' || (p.cat === 'beans' && retail) ? back : waste).push(`${p.ar} ×${n}`); });
        const hasBeans = sel().some(({ i }) => D.prod(o.lines[i].pid).cat === 'beans');
        body = `<div class="wz-h"><span class="term-en">Reason</span><span class="muted">السبب يُسجَّل في السجل وفي الإشعار</span></div>
          <div class="picks">${REASONS.map((r) => `<button class="pickc${reason === r.id ? ' on' : ''}" data-reason="${r.id}">${I(r.ic)}${bi(r.en, r.ar)}</button>`).join('')}</div>
          <div class="wz-h" style="margin-top:16px"><span class="term-en">Stock</span><span class="muted">يحدث تلقائيًا</span></div>
          <div class="outc">${back.length ? `<div class="back">${I('stock', 'sm')}<span><b>Back to stock · يرجع للمخزون</b><br>${esc(back.join('، '))}</span></div>` : ''}${waste.length ? `<div class="waste">${I('trash', 'sm')}<span><b>Waste · يُحسب هالكًا</b><br>${esc(waste.join('، '))}</span></div>` : ''}</div>
          ${hasBeans && stage !== 'queued' ? `<div class="set-row"><span><b>Sealed bag? · الكيس مغلق؟</b><small>المغلق يرجع للرف، والمفتوح يُحسب هالكًا</small></span><button class="switch ${retail ? 'on' : ''}" id="retail" aria-label="الكيس مغلق"></button></div>` : ''}${sumBox}`;
        foot = `<button class="btn btn--ghost" id="wzBack">${bi('Back', 'السابق')}</button><button class="btn btn--ink btn--lg" id="wzNext" ${reason ? '' : 'disabled'}>${bi('Next', 'التالي')}</button>`;
      } else if (step === 2) {
        const orig = D.refundQuote(o, sel(), 'original');
        const opts = [
          { id: 'original', en: 'Original payment', ar: 'نفس طريقة الدفع', ic: 'card', sub: orig.parts.map((p) => D.PAY[p.m].ar + ' ' + fmt(p.a)).join(' + ') },
          { id: 'cash', en: 'Cash', ar: 'كاش من الدرج', ic: 'cash', sub: 'الدرج يفتح', off: online },
          { id: 'exchange', en: 'Exchange', ar: 'استبدال بصنف آخر', ic: 'swap', sub: 'رصيد للطلب الجديد', off: online },
        ];
        body = `<div class="wz-h"><span class="term-en">Refund to</span><span class="muted">${online ? 'طلب أونلاين — المبلغ يرجع لبطاقة العميل' : 'كيف ترجع الفلوس للعميل؟'}</span></div>
          <div class="picks">${opts.map((x) => `<button class="pickc${how === x.id ? ' on' : ''}" data-how="${x.id}" ${x.off ? 'disabled' : ''}>${I(x.ic)}${bi(x.en, x.ar)}<span class="sub">${esc(x.sub)}</span></button>`).join('')}</div>
          ${sumBox}
          <div class="blind" style="margin-top:12px">${I('shield', 'sm')}<span>${D.can(me, 'refund') === 1 ? 'لديك صلاحية المرتجع — يُسجَّل باسمك.' : (D.REAL ? 'المرتجع يحتاج PIN المشرف أو المدير.' : 'المرتجع يحتاج PIN المشرف أو المدير (للتجربة: 2222).')} ويصدر ${D.noteName().ar} برقم تسلسلي.</span></div>`;
        foot = `<button class="btn btn--ghost" id="wzBack">${bi('Back', 'السابق')}</button><button class="btn btn--danger btn--lg" id="wzGo">${I('refund', 'sm')}${bi('Refund ' + fmt(q.a), 'تنفيذ المرتجع')}</button>`;
      }
      $('#wb', m).innerHTML = `<div class="wz">${body}</div>`;
      $('#wf', m).innerHTML = foot;
      wire();
    }
    function wire() {
      const on = (s, fn) => { const el = $(s, m); if (el) el.addEventListener('click', fn); };
      on('[data-x]', () => m.close());
      on('#all', () => { const full = pick.every((p, i) => p.q === left[i]); pick.forEach((p, i) => { p.q = full ? 0 : left[i]; }); paint(); });
      $$('[data-ri]', m).forEach((row) => row.addEventListener('click', (e) => {
        const i = +row.dataset.ri; if (!left[i]) return;
        const b = e.target.closest('[data-r]');
        if (b) pick[i].q = Math.max(0, Math.min(left[i], pick[i].q + +b.dataset.d));
        else pick[i].q = pick[i].q ? 0 : left[i];
        paint();
      }));
      $$('[data-reason]', m).forEach((b) => b.addEventListener('click', () => { reason = b.dataset.reason; paint(); }));
      $$('[data-how]', m).forEach((b) => b.addEventListener('click', () => { how = b.dataset.how; paint(); }));
      on('#retail', () => { retail = !retail; paint(); });
      on('#wzNext', () => { step += 1; paint(); });
      on('#wzBack', () => { step -= 1; paint(); });
      on('#wzGo', submit);
    }
    async function submit() {
      if (busy) return;
      const R = REASONS.find((x) => x.id === reason);
      if ((how === 'cash' || how === 'original') && D.refundQuote(ord(), sel(), how).parts.some((p) => p.m === 'cash') && !D.openShift(S(), 1)) { D.toast('لا توجد وردية مفتوحة', 'افتح وردية أولًا لصرف الكاش من الدرج', { warn: 1 }); return; }
      busy = true;
      const u = await D.approve('refund', `${o0.inv} — ${R.ar}`, me);
      if (!u) { busy = false; return; }
      const r = D.refund(id, sel().map(({ i, q }) => ({ i, q })), { by: me, appr: approverId(u), reason: R.ar, how, restockRetail: retail });
      busy = false;
      if (!r) return;
      if (D.refundCash(r) > 0) D.drawerPop('فُتح الدرج — صرف المرتجع');
      D.sound('ok');
      done(r);
    }
    function done(r) {
      step = 3;
      const o = ord();
      $('#wst', m).innerHTML = stepper(STEPS, 4);
      const ex = how === 'exchange';
      $('#wb', m).innerHTML = `<div class="wz"><div class="done-ok">${check(ex ? 'blue' : 'red')}<b style="font-size:18px">${bi(ex ? 'Credit ready' : o.cancelled ? 'Order cancelled' : 'Refunded', ex ? 'الرصيد جاهز للطلب الجديد' : o.cancelled ? 'أُلغي الطلب بالكامل' : 'تم المرتجع')}</b><span class="change">${fmt(r.a)} ر.س</span><span class="muted">${r.cn} · ${ex ? 'رصيد استبدال' : r.parts.map((p) => D.PAY[p.m].ar + ' ' + fmt(p.a)).join(' + ')}${r.back ? ' · عاد للمخزون' : ''}${r.waste ? ' · سُجّل هالك' : ''}${r.stamps ? ' · أُزيل ' + r.stamps + ' ختم' : ''}</span></div>
        <div class="rc-stage">${D.creditHTML(o, r, { print: true })}</div></div>`;
      $('#wf', m).innerHTML = `<button class="btn btn--ghost" id="pc">${I('print', 'sm')}${bi('Print', 'اطبع الإشعار')}</button>${ex ? `<button class="btn btn--go btn--lg" id="pickNew">${I('swap', 'sm')}${bi('Pick the new item', 'اختر البديل')}</button>` : `<button class="btn btn--ink" data-x>${bi('Done', 'تم')}</button>`}`;
      $('#pc', m).addEventListener('click', () => D.print(D.creditHTML(o, r)));
      if ($('[data-x]', m)) $('[data-x]', m).addEventListener('click', () => m.close());
      if ($('#pickNew', m)) $('#pickNew', m).addEventListener('click', () => {
        if (cart.lines.length) holdCart();
        cart.credit = { a: r.a, cn: r.cn, inv: o.inv };
        m.close();
        if (route === 'sell') drawCart(); else go('sell');
        D.toast('رصيد الاستبدال في السلة', `${fmt(r.a)} ر.س — اختر الصنف الجديد`, { ic: 'swap' });
      });
    }
    paint();
  }

  /* =====================================================================
     BARISTA (inside the app)
     ===================================================================== */
  let kdsLang = 'en', kdsSt = 'all';
  function renderKDS(view) {
    view.className = 'view--full';
    const title = { all: ['Stations', 'الباريستا والمطبخ معًا'], bar: ['Barista', 'المشروبات'], kitchen: ['Kitchen', 'الطعام والحلا'] };
    const page = kdsSt === 'all' ? 'kds.html?st=bar' : 'kds.html?st=' + kdsSt;
    view.innerHTML = `<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:14px 16px 0;flex-wrap:wrap"><div><span class="label">Stations · KDS</span><div class="h-en" style="font-size:28px" id="kT">${title[kdsSt][0]}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><div class="seg" id="kst">${[['all', 'All', 'الكل', 'kds'], ['bar', 'Barista', 'الباريستا', 'cup'], ['kitchen', 'Kitchen', 'المطبخ', 'flame']].map(([k, en, ar, ic]) => `<button data-st="${k}" class="${kdsSt === k ? 'on' : ''}" title="${ar}">${I(ic, 'sm')} ${en}</button>`).join('')}</div>
      <div class="seg" id="kl"><button data-l="ar" class="${kdsLang === 'ar' ? 'on' : ''}">ع</button><button data-l="en" class="${kdsLang === 'en' ? 'on' : ''}">EN</button></div><a class="btn btn--ghost btn--sm" id="kOpen" href="${page}" target="_blank">${I('kds', 'sm')} شاشة مستقلة</a></div></div><div id="kdsm"></div>`;
    const k = window.DARJ_KDS.mount($('#kdsm', view), { lang: kdsLang, sound: false, st: kdsSt });
    $('#kl', view).addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (!b) return; kdsLang = b.dataset.l; $$('#kl button', view).forEach((x) => x.classList.toggle('on', x === b)); k.setLang(kdsLang); });
    $('#kst', view).addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b) return; kdsSt = b.dataset.st; $$('#kst button', view).forEach((x) => x.classList.toggle('on', x === b)); k.setSt(kdsSt); $('#kT', view).textContent = title[kdsSt][0]; $('#kOpen', view).href = kdsSt === 'all' ? 'kds.html?st=bar' : 'kds.html?st=' + kdsSt; });
    return () => k.destroy();
  }

  /* =====================================================================
     SHIFT
     ===================================================================== */
  function renderShift(view) {
    view.className = 'view';
    const s = S();
    const sh = D.openShift(s, 1);
    const seeExp = can('expected') === 1;
    const st = sh ? D.shiftStats(s, sh) : null;
    const reg2 = D.openShift(s, 2);
    const st2 = reg2 ? D.shiftStats(s, reg2) : null;
    const hist = s.shifts.slice().reverse();
    view.innerHTML = `<div class="vh"><div><span class="label">Shift · Cashier 1</span><h1>The drawer</h1><p>العهدة والمصروفات وإقفال الوردية بالقفل الأعمى: الكاشير يعدّ الدرج دون أن يعرف المبلغ المتوقع.</p></div>
      <div class="vh__act">${sh ? `<button class="btn btn--ghost" id="x">${I('print', 'sm')}${bi('X report', 'تقرير منتصف الوردية')}</button><button class="btn btn--ghost" id="po">${I('cash', 'sm')}${bi('Paid-out', 'مصروف من الدرج')}</button><button class="btn btn--ink" id="close">${I('lock', 'sm')}${bi('Close shift', 'إقفال الوردية')}</button>` : `<button class="btn btn--go" id="open">${I('drawer', 'sm')}${bi('Open shift', 'فتح وردية جديدة')}</button>`}</div></div>
      ${sh ? `<div class="grid g4 kpi-row">
        <div class="kpi"><span class="label">Opened</span><b>${D.time(sh.open)}</b><small>${esc(D.staff(sh.user).name)} · عهدة ${fmt(sh.float)} ر.س</small></div>
        <div class="kpi"><span class="label">Invoices</span><b>${st.count}</b><small>فاتورة في هذه الوردية</small></div>
        <div class="kpi"><span class="label">Sales</span><b>${fmt(st.total)}</b><small>ر.س${st.vat ? ` · منها ضريبة ${fmt(st.vat)}` : ''}</small></div>
        <div class="kpi"><span class="label">Expected cash</span><b>${seeExp ? fmt(st.expected) : '••••'}</b><small>${seeExp ? 'العهدة + الكاش − المصروفات' : 'مخفي — قفل أعمى (يظهر للمدير فقط)'}</small></div>
      </div>
      <div class="grid g2" style="margin-top:14px;align-items:start">
        <div class="card"><div class="card__h"><h3><span class="label">By tender</span>المبيعات حسب طريقة الدفع</h3></div>
          <div class="mix">${['mada', 'apple', 'stc', 'online', 'cash'].map((k) => { const v = st.by[k]; const hide = k === 'cash' && !seeExp; return `<div class="mix__row"><span>${D.PAY[k].ar}</span><span class="bar"><i style="width:${hide ? 0 : (v / (st.total || 1) * 100).toFixed(1)}%"></i></span><span class="num">${hide ? 'مخفي' : fmt(v)}</span></div>`; }).join('')}</div>
          <p class="muted" style="font-size:12px;margin-top:12px">مدى وApple Pay وSTC Pay تُقفل من تسوية جهاز الشبكة، فلا تحتاج عدًّا يدويًا.</p></div>
        <div class="card"><div class="card__h"><h3><span class="label">Paid-outs</span>مصروفات من الدرج</h3><span class="pill">${fmt(st.payouts)} ر.س</span></div>
          ${s.payouts.filter((p) => p.shift === sh.id).map((p) => `<div class="set-row"><span><b>${esc(p.why)}</b><small>${p.id} · ${D.time(p.ts)} · ${esc(D.staff(p.user).short)}${p.appr ? ' · وافق ' + esc(D.staff(p.appr).short) : ''}</small></span>${money(p.a)}</div>`).join('') || '<div class="empty" style="padding:20px">لا توجد مصروفات في هذه الوردية</div>'}</div>
      </div>` : `<div class="card empty">${I('drawer')}<b style="color:var(--ink-2)">الكاشير 1 مقفول</b><span>افتح وردية جديدة بعهدة البداية لتبدأ البيع.</span></div>`}
      ${reg2 ? `<div class="card" style="margin-top:14px"><div class="card__h"><h3><span class="label">Cashier 2 · live</span>${esc(D.staff(reg2.user).name)} — كاشير 2</h3><span class="pill pill--go"><i class="dot pulse"></i> يعمل الآن</span></div><div class="grid g3"><div><span class="muted">من</span><div class="num" style="font-size:18px">${D.time(reg2.open)}</div></div><div><span class="muted">الفواتير</span><div class="num" style="font-size:18px">${st2.count}</div></div><div><span class="muted">المبيعات</span><div style="font-size:18px">${money(st2.total)}</div></div></div></div>` : ''}
      <h3 style="margin:24px 0 10px;font-size:15px">سجل ورديات اليوم</h3>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الوردية</th><th>الكاشير</th><th>من</th><th>إلى</th><th class="r">المبيعات</th><th class="r">الفرق</th><th></th></tr></thead><tbody>
      ${hist.map((h) => { const t = D.shiftStats(s, h); return `<tr><td class="mono">${h.z || (h.close ? '' : 'مفتوحة')}</td><td>${esc(D.staff(h.user).short)} · كاشير ${h.reg}</td><td class="en nw">${D.time(h.open)}</td><td class="en nw">${h.close ? D.time(h.close) : '—'}</td><td class="r">${money(t.total)}</td><td class="r">${h.close ? `<span class="pill ${h.variance < 0 ? 'pill--red' : h.variance > 0 ? 'pill--amber' : 'pill--go'}">${h.variance < 0 ? 'عجز ' : h.variance > 0 ? 'زيادة ' : 'مطابق '}${h.variance ? fmt(Math.abs(h.variance)) : ''}</span>` : '—'}</td><td>${h.close ? `<button class="btn btn--soft btn--sm" data-z="${h.id}">Z</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
    if ($('#x', view)) $('#x', view).addEventListener('click', () => zModal(sh, false));
    if ($('#po', view)) $('#po', view).addEventListener('click', openPayout);
    if ($('#close', view)) $('#close', view).addEventListener('click', closeShift);
    if ($('#open', view)) $('#open', view).addEventListener('click', openShiftFlow);
    $$('[data-z]', view).forEach((b) => b.addEventListener('click', () => zModal(S().shifts.find((x) => x.id === b.dataset.z), true)));
  }
  function zModal(sh, isZ) {
    const s = S(); const st = D.shiftStats(s, sh);
    const m = D.modal(`${D.head(isZ ? `تقرير ${sh.z}` : 'تقرير X', isZ ? 'إقفال الوردية — مطبوع ومحفوظ' : 'لقطة من منتصف الوردية — لا تُصفّر العدادات')}<div class="modal__b"><div class="rc-stage">${D.zHTML(sh, st)}</div></div><div class="modal__f"><button class="btn btn--ghost" id="pz">${I('print', 'sm')} اطبع</button><button class="btn btn--ink" data-close>تمام</button></div>`, { cls: 'modal--sm' });
    $('#pz', m).addEventListener('click', () => D.print(D.zHTML(sh, st)));
  }
  function openPayout() {
    const m = D.modal(`${D.head('مصروف من الدرج', 'يُخصم من المتوقع في الدرج ويُسجَّل برقم إيصال')}
      <div class="modal__b grid" style="gap:12px"><label class="field"><span>المبلغ</span><input class="input amount-in" id="pa" inputmode="decimal" placeholder="0.00"></label>
      <label class="field"><span>البند</span><select class="select" id="pw"><option>ثلج للمحل</option><option>مشتريات صغيرة (حليب طوارئ)</option><option>أجرة مندوب توصيل</option><option>صيانة بسيطة</option><option>أخرى</option></select></label></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--ink" id="ok">سجّل وافتح الدرج</button></div>`, { cls: 'modal--sm' });
    $('#ok', m).addEventListener('click', async () => {
      const a = parseFloat($('#pa', m).value) || 0; if (a <= 0) { $('#pa', m).focus(); return; }
      const why = $('#pw', m).value; m.close();
      const u = await D.approve('payout', `${why} — ${fmt(a)} ر.س`, me); if (!u) return;
      D.mutate((s) => { const sh = D.openShift(s, 1); s.payouts.push({ id: 'PO-' + (++s.seq.po), ts: Date.now(), why, a, user: me, shift: sh && sh.id, appr: approverId(u) }); D.log(me, 'payout', `مصروف من الدرج: ${why} — ${fmt(a)} ر.س`, approverId(u)); }, 'payout');
      D.drawerPop('فُتح الدرج — وسُجّل المصروف'); render();
    });
  }
  const DENOMS = [500, 200, 100, 50, 20, 10, 5, 1, .5, .25];
  const NOTE = { 500: '#2E5E9E', 200: '#7A7436', 100: '#A8322B', 50: '#2C7A55', 20: '#2A8C8C', 10: '#7A5236', 5: '#6E4A8E' };
  function closeShift() {
    const s = S(); const sh = D.openShift(s, 1); const st = D.shiftStats(s, sh);
    const cnt = {};
    const m = D.modal(`${D.head(bi('Close shift', 'إقفال الوردية'), 'عدّ النقد الموجود في الدرج — لن يظهر المبلغ المتوقع إلا بعد انتهاء العدّ')}
      <div class="modal__b" id="cb"></div>`, { cls: 'modal--wide', sticky: true });
    const counted = () => D.r2(DENOMS.reduce((a, d) => a + d * (cnt[d] || 0), 0));
    function step1() {
      $('#cb', m).innerHTML = `${stepper([['Count', 'العدّ'], ['Compare', 'المقارنة'], ['Z report', 'التقرير']], 0)}<div class="blind" style="margin-bottom:12px">${I('eyeoff', 'sm')} <b>Blind close · قفل أعمى:</b> اكتب عدد كل فئة. المبلغ المتوقع مخفي ليكون العدّ حقيقيًا.</div>
        <div class="denoms">${DENOMS.map((d) => `<label class="denom${cnt[d] ? ' has' : ''}">${d >= 5 ? `<span class="note-art" style="background:${NOTE[d]}">${d}</span>` : `<span class="coin-art">${d >= 1 ? d : d === .5 ? '½' : '¼'}</span>`}<input inputmode="numeric" data-d="${d}" value="${cnt[d] || ''}" placeholder="0" aria-label="عدد فئة ${d}"></label>`).join('')}</div>
        <div class="grid g2" style="margin-top:14px;align-items:center"><div class="pay__due"><span class="label">Counted cash</span><span id="ct">${money(counted())}</span></div>
        <div class="blind">${I('card', 'sm')} مدى وApple Pay وSTC Pay: <b>${fmt(st.by.mada + st.by.apple + st.by.stc)} ر.س</b> — ${D.LIVE ? 'طابقها مع تسوية جهاز الشبكة' : 'من تسوية جهاز الشبكة تلقائيًا'}</div></div>
        <div class="modal__f" style="padding:16px 0 0;position:static"><button class="btn btn--ghost" data-x>إلغاء</button><button class="btn btn--ink btn--lg" id="c1">${bi('Confirm count', 'تأكيد العدّ')}</button></div>`;
      $$('[data-d]', m).forEach((i) => i.addEventListener('input', () => { cnt[i.dataset.d] = parseInt(i.value, 10) || 0; i.parentElement.classList.toggle('has', !!cnt[i.dataset.d]); $('#ct', m).innerHTML = money(counted()); }));
      $('[data-x]', m).addEventListener('click', () => m.close());
      $('#c1', m).addEventListener('click', step2);
      setTimeout(() => $('[data-d]', m).focus(), 60);
    }
    function step2() {
      const c = counted(); const exp = st.expected; const v = D.r2(c - exp);
      const cls = Math.abs(v) < .01 ? 'ok' : v < 0 ? 'short' : 'over';
      $('#cb', m).innerHTML = `${stepper([['Count', 'العدّ'], ['Compare', 'المقارنة'], ['Z report', 'التقرير']], 1)}<div class="grid g3 wz" style="align-items:stretch">
        <div class="pay__due"><span class="label">Counted</span><span>${money(c)}</span><span class="rem">المبلغ المعدود</span></div>
        <div class="pay__due"><span class="label">Expected</span><span>${money(exp)}</span><span class="rem">العهدة ${fmt(sh.float)} + كاش ${fmt(st.by.cash)} − مصروفات ${fmt(st.payouts)}</span></div>
        <div class="var-box ${cls}"><span class="label" style="color:inherit">${cls === 'ok' ? 'Balanced' : cls === 'short' ? 'Short' : 'Over'}</span><b>${fmt(Math.abs(v))}</b><span>${cls === 'ok' ? 'الدرج مطابق' : cls === 'short' ? 'عجز في الدرج' : 'زيادة في الدرج'}</span></div></div>
        ${cls !== 'ok' ? `<label class="field" style="margin-top:14px"><span>ملاحظة على الفرق (تظهر للمدير)</span><input class="input" id="vn" placeholder="مثلًا: خطأ في صرف الفكّة"></label>` : ''}
        <div class="modal__f" style="padding:16px 0 0;position:static"><button class="btn btn--ghost" id="back">رجوع للعدّ</button><button class="btn btn--go btn--lg" id="c2">${I('print', 'sm')}${bi('Approve & print Z', 'اعتماد وطباعة التقرير')}</button></div>`;
      $('#back', m).addEventListener('click', step1);
      $('#c2', m).addEventListener('click', () => {
        const note = $('#vn', m) ? $('#vn', m).value.trim() : '';
        let closed;
        D.mutate((s2) => { const x = D.openShift(s2, 1); x.close = Date.now(); x.expected = exp; x.counted = c; x.variance = v; x.z = 'Z-' + (++s2.seq.z); x.closedBy = me; x.note = note; closed = x; D.log(me, 'shift', `قفل الوردية — ${cls === 'ok' ? 'مطابق' : (v < 0 ? 'عجز ' : 'زيادة ') + fmt(Math.abs(v)) + ' ر.س'} (${x.z})`, null, cls === 'ok' ? 'info' : 'warn'); }, 'shift');
        m.close();
        zModal(closed, true);
        render();
      });
    }
    step1();
  }
  function openShiftFlow() {
    const m = D.modal(`${D.head('فتح وردية جديدة', `${esc(D.staff(me).name)} · كاشير 1`)}
      <div class="modal__b"><label class="field"><span>عهدة البداية (الفكّة في الدرج)</span><input class="input amount-in" id="fl" inputmode="decimal" value="500"></label></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--go" id="ok">افتح الوردية</button></div>`, { cls: 'modal--sm' });
    $('#ok', m).addEventListener('click', () => {
      const f = parseFloat($('#fl', m).value) || 0;
      D.mutate((s) => { s.shifts.push({ id: 'sh' + D.uid(), reg: 1, user: me, open: Date.now(), float: f, close: null }); D.log(me, 'shift', `فتح وردية بعهدة ${fmt(f)} ر.س`); }, 'shift');
      m.close(); D.drawerPop('فُتح الدرج — ضع العهدة'); render();
    });
  }

  /* =====================================================================
     MENU
     ===================================================================== */
  let mcat = 'all';
  function renderMenu(view) {
    view.className = 'view';
    const s = S();
    const seeCost = can('cost') === 1, editPrice = can('price') === 1;
    const list = D.PRODUCTS.filter((p) => mcat === 'all' || p.cat === mcat);
    view.innerHTML = `<div class="vh"><div><span class="label">Menu · ${D.PRODUCTS.length} items</span><h1>Menu</h1><p>الأسعار والتوفّر. أي تعديل يصل للكاشير ولمنيو QR في نفس اللحظة، ويُسجَّل اسم من عدّله.</p></div>
      ${editPrice ? '' : `<span class="pill">${I('lock', 'sm')} تعديل الأسعار للمدير فقط</span>`}</div>
      <div class="cats" style="padding:0 0 14px" id="mc"><button class="chip ${mcat === 'all' ? 'on' : ''}" data-c="all">${bi('All', 'الكل')}</button>${D.CATS.map((c) => `<button class="chip ${mcat === c.id ? 'on' : ''}" data-c="${c.id}">${bi(c.en, c.ar)}</button>`).join('')}</div>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>القسم</th><th>${D.vatOn() ? 'السعر شامل الضريبة' : 'السعر'}</th>${seeCost ? '<th class="r">تكلفة الكوب</th><th class="r">هامش الربح</th>' : ''}<th>متاح</th></tr></thead><tbody>
      ${list.map((p) => {
        const line = { pid: p.id, qty: 1, mods: D.defMods(p) };
        const cost = D.lineCost(line), price = D.unitPrice(s, line);
        const auto = !D.canMake(s, line);
        const on = s.avail[p.id] !== false;
        const img = D.img(p);
        const netP = D.exVat(price), mg = (netP - cost) / netP * 100;
        return `<tr><td><div class="cell-item"><span class="thumb" ${img ? `style="background-image:url('${img}')"` : ''}>${img ? '' : I(D.CATS.find((c) => c.id === p.cat).ic, 'sm')}</span><span><b>${esc(p.ar)}</b><br><small class="muted en">${esc(p.en)}${p.code ? ` · <span class="mono">${p.code}</span>` : ''}</small></span></div></td>
          <td class="nw">${D.CATS.find((c) => c.id === p.cat).ar}</td>
          <td>${editPrice ? `<input class="input mono" style="width:100px;height:36px" data-price="${p.id}" value="${fmt(D.priceOf(s, p)).replace(/,/g, '')}">` : money(D.priceOf(s, p))}${p.mods.includes('size') ? '<small class="muted"> · وسط +3 · كبير +6</small>' : ''}${p.was ? `<small class="muted"> · بدل ${p.was}</small>` : ''}</td>
          ${seeCost ? `<td class="r nw">${money(cost)}</td><td class="r nw"><span class="pill ${mg > 70 ? 'pill--go' : mg > 55 ? '' : 'pill--amber'}">${mg.toFixed(0)}%</span></td>` : ''}
          <td class="nw">${auto ? '<span class="pill pill--red">متوقف تلقائيًا — نفد المكوّن</span>' : `<button class="switch ${on ? 'on' : ''}" data-av="${p.id}" aria-label="متاح"></button>`}${D.REAL && can('stock') === 1 ? ` <button class="btn btn--soft btn--sm" data-rec="${p.id}">${bi('Recipe', Object.keys(p.r || {}).length ? 'الوصفة' : 'أضف وصفة')}</button>` : ''}</td></tr>`;
      }).join('')}</tbody></table></div>`;
    $('#mc', view).addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (!b) return; mcat = b.dataset.c; renderMenu(view); });
    $$('[data-rec]', view).forEach((b) => b.addEventListener('click', () => recipeForm(b.dataset.rec, () => renderMenu(view))));
    $$('[data-av]', view).forEach((b) => b.addEventListener('click', () => {
      const id = b.dataset.av; const p = D.prod(id);
      D.mutate((st) => { const on = st.avail[id] !== false; st.avail[id] = !on; D.log(me, 'avail', `تغيير حالة صنف: ${p.ar} — ${on ? 'نفد (متوقف)' : 'متاح'}`); }, 'avail');
      D.toast(S().avail[id] === false ? `تم إيقاف ${p.ar}` : `${p.ar} متاح من جديد`, 'تحدّث في الكاشير ومنيو QR', { ic: 'menu' });
      renderMenu(view);
    }));
    $$('[data-price]', view).forEach((inp) => {
      const commit = () => {
        const id = inp.dataset.price; const p = D.prod(id); const s2 = S();
        const v = D.r2(parseFloat(inp.value)); const old = D.priceOf(s2, p);
        if (!v || v === old) { inp.value = fmt(old).replace(/,/g, ''); return; }
        D.mutate((st) => { st.prices[id] = v; D.log(me, 'price', `تعديل سعر: ${p.ar} من ${fmt(old)} إلى ${fmt(v)} ر.س`, null, 'warn'); }, 'price');
        D.toast('تم تعديل السعر', `${p.ar}: ${fmt(old)} ← ${fmt(v)} ر.س — وسُجّل في السجل`, { ic: 'tag' });
      };
      inp.addEventListener('change', commit);
      inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') inp.blur(); });
    });
  }

  /* =====================================================================
     STOCK
     ===================================================================== */
  let stab = 'stock';
  const qtyTxt = (id, v) => { const i = D.ing(id); if (i.unit === 'g' && v >= 1000) return `${D.fmt(v / 1000, 1)} كجم`; if (i.unit === 'ml' && v >= 1000) return `${D.fmt(v / 1000, 1)} لتر`; return `${D.fmt0(v)} ${D.UNIT[i.unit]}`; };
  function ingForm(id, done) {
    const s = S();
    const i = id ? D.ing(id) : { ar: '', unit: 'g', par: 0, cost: 0, sup: '' };
    const m = D.modal(`${D.head(bi(id ? 'Edit ingredient' : 'Add ingredient', id ? 'تعديل مكوّن' : 'إضافة مكوّن'), 'الكمية تقل تلقائيًا مع كل بيع حسب وصفة المشروب')}
      <div class="modal__b grid" style="gap:12px"><label class="field"><span>الاسم</span><input class="input" id="iName" value="${esc(i.ar)}" placeholder="مثلًا: بن إسبريسو، حليب كامل الدسم، أكواب 12oz"></label>
        <div class="seg" id="iUnit">${[['g', 'جرام'], ['ml', 'مل'], ['pc', 'حبة']].map(([u, l]) => `<button data-u="${u}" class="${i.unit === u ? 'on' : ''}">${l}</button>`).join('')}</div>
        <div class="grid g2">${id ? '' : '<label class="field"><span>الكمية الموجودة الآن</span><input class="input mono" id="iQty" inputmode="decimal" value="0"></label>'}<label class="field"><span>حد الطلب (التنبيه)</span><input class="input mono" id="iPar" inputmode="decimal" value="${i.par || 0}"></label>
        <label class="field"><span>تكلفة الوحدة (ر.س)</span><input class="input mono" id="iCost" inputmode="decimal" value="${i.cost || 0}"></label><label class="field"><span>المورّد</span><input class="input" id="iSup" list="supList" value="${esc(i.sup ? D.sup(i.sup).ar : '')}"><datalist id="supList">${D.SUP.map((x) => `<option value="${esc(x.ar)}">`).join('')}</datalist></label></div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--ink" id="iSave">${bi('Save', 'حفظ')}</button></div>`, { cls: 'modal--sm' });
    let unit = i.unit;
    $('#iUnit', m).addEventListener('click', (e) => { const b = e.target.closest('[data-u]'); if (!b) return; unit = b.dataset.u; $$('#iUnit button', m).forEach((x) => x.classList.toggle('on', x === b)); });
    $('#iSave', m).addEventListener('click', () => {
      const ar = $('#iName', m).value.trim(); if (!ar) { $('#iName', m).focus(); return; }
      const par = parseFloat($('#iPar', m).value) || 0, cost = parseFloat($('#iCost', m).value) || 0, supName = $('#iSup', m).value.trim();
      D.mutate((st) => {
        let sid = '';
        if (supName) { let sp = st.suppliers.find((x) => x.ar === supName); if (!sp) { sp = { id: 's' + D.uid(), ar: supName, who: '', due: 0, terms: '' }; st.suppliers.push(sp); } sid = sp.id; }
        if (id) { const x = st.ingredients.find((y) => y.id === id); Object.assign(x, { ar, unit, par, cost, sup: sid }); D.log(me, 'stock', `تعديل مكوّن: ${ar}`); }
        else { const nid = 'i' + D.uid(); st.ingredients.push({ id: nid, ar, unit, par, cost, sup: sid, buy: par }); st.stock[nid] = parseFloat($('#iQty', m).value) || 0; D.log(me, 'stock', `إضافة مكوّن: ${ar} — ${st.stock[nid]} ${D.UNIT[unit]}`); }
      }, 'stock');
      m.close(); done && done();
    });
  }
  function recipeForm(pid, done) {
    const p = D.prod(pid);
    const rows = Object.entries(p.r || {}).map(([id, q]) => ({ id, q }));
    const m = D.modal(`${D.head(bi('Recipe', 'وصفة · ' + esc(p.ar)), 'كمية كل مكوّن في الصنف الواحد — تُخصم تلقائيًا مع كل بيع')}<div class="modal__b"><div id="rr" class="grid" style="gap:8px"></div>
      <button class="btn btn--ghost btn--sm" id="rAdd" style="margin-top:10px">${I('plus', 'sm')}${bi('Add ingredient', 'إضافة مكوّن للوصفة')}</button>${D.ING.length ? '' : '<div class="blind" style="margin-top:10px">أضف المكوّنات أولًا من صفحة Stock.</div>'}</div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--ink" id="rSave">${bi('Save recipe', 'حفظ الوصفة')}</button></div>`, { cls: 'modal--sm' });
    const draw = () => {
      $('#rr', m).innerHTML = rows.map((r, k) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) 96px auto;gap:8px;align-items:center"><select class="select" data-ri="${k}">${D.ING.map((i) => `<option value="${i.id}" ${i.id === r.id ? 'selected' : ''}>${esc(i.ar)} (${D.UNIT[i.unit]})</option>`).join('')}</select><input class="input mono" data-rq="${k}" inputmode="decimal" value="${r.q || ''}"><button class="icon-btn" data-rx="${k}">${I('trash', 'sm')}</button></div>`).join('') || '<div class="empty" style="padding:14px">لا توجد مكوّنات في الوصفة</div>';
      $$('[data-ri]', m).forEach((x) => x.addEventListener('change', () => { rows[+x.dataset.ri].id = x.value; }));
      $$('[data-rq]', m).forEach((x) => x.addEventListener('input', () => { rows[+x.dataset.rq].q = parseFloat(x.value) || 0; }));
      $$('[data-rx]', m).forEach((x) => x.addEventListener('click', () => { rows.splice(+x.dataset.rx, 1); draw(); }));
    };
    draw();
    $('#rAdd', m).addEventListener('click', () => { if (!D.ING.length) return; rows.push({ id: D.ING[0].id, q: 0 }); draw(); });
    $('#rSave', m).addEventListener('click', () => {
      const r = {}; rows.forEach((x) => { if (x.id && x.q > 0) r[x.id] = (r[x.id] || 0) + x.q; });
      D.mutate((st) => { st.recipes[pid] = r; D.log(me, 'stock', `تعديل وصفة: ${p.ar}`); }, 'recipe');
      m.close(); done && done();
    });
  }
  function renderStock(view) {
    view.className = 'view';
    const s = S();
    if (D.REAL && !D.ING.length) {
      view.innerHTML = `<div class="vh"><div><span class="label">Stock</span><h1>Stock by the gram</h1><p>المخزون يبدأ من الصفر. أضف المكوّنات (البن، الحليب، الأكواب…) وبعدها وصفة كل مشروب من صفحة Menu، فيبدأ الخصم التلقائي مع كل بيع.</p></div></div>
        <div class="card empty">${I('stock')}<b style="color:var(--ink-2)">${bi('No ingredients yet', 'لم تُضف مكوّنات بعد')}</b><span>البيع شغال عادي بدون مخزون. المخزون اختياري ويتفعّل لما تضيف أول مكوّن.</span>${can('stock') === 1 ? `<button class="btn btn--ink" id="addIng" style="margin-top:8px">${I('plus', 'sm')}${bi('Add ingredient', 'إضافة مكوّن')}</button>` : ''}</div>`;
      if ($('#addIng', view)) $('#addIng', view).addEventListener('click', () => ingForm(null, () => renderStock(view)));
      return;
    }
    const low = D.ING.filter((i) => s.stock[i.id] < i.par);
    const value = D.ING.reduce((a, i) => a + s.stock[i.id] * i.cost, 0);
    const exp = D.ING.filter((i) => i.exp && i.exp <= 2);
    const wasteV = s.waste.reduce((a, w) => a + w.cost, 0);
    const tabs = [['stock', 'Stock', 'المخزون'], ['recipes', 'Recipes', 'الوصفات والتكلفة'], ['receive', 'Receive', 'استلام بضاعة'], ['count', 'Count', 'الجرد'], ['waste', 'Waste', 'الهالك'], ['sup', 'Suppliers', 'الموردين']];
    view.innerHTML = `<div class="vh"><div><span class="label">Stock · live</span><h1>Stock by the gram</h1><p>كل كوب يُباع يخصم مكوّناته بالجرام والمل: البن والحليب والكوب والغطاء. والتنبيه يظهر قبل نفاد الصنف.</p></div>
      <div class="vh__act">${D.REAL ? `<button class="btn btn--ghost" id="addIng">${I('plus', 'sm')}${bi('Add ingredient', 'إضافة مكوّن')}</button>` : ''}<button class="btn btn--ink" id="po">${I('send', 'sm')}${bi('Reorder' + (low.length ? ' · ' + low.length : ''), 'اقتراح طلب شراء')}</button></div></div>
      <div class="grid g4 kpi-row" style="margin-bottom:14px">
        <div class="kpi"><span class="label">Low stock</span><b class="${low.length ? 'down' : ''}">${low.length}</b><small>صنف تحت حد الطلب</small></div>
        <div class="kpi"><span class="label">Stock value</span><b>${D.fmt0(value)}</b><small>ر.س بسعر التكلفة</small></div>
        <div class="kpi"><span class="label">Expiring</span><b>${exp.length}</b><small>ينتهي خلال يومين</small></div>
        <div class="kpi"><span class="label">Waste today</span><b>${fmt(wasteV)}</b><small>ر.س هالك اليوم</small></div></div>
      <div class="seg" id="st" style="margin-bottom:14px;flex-wrap:wrap">${tabs.map(([k, en, l]) => `<button data-t="${k}" class="${stab === k ? 'on' : ''}">${bi(en, l)}</button>`).join('')}</div><div id="sb"></div>`;
    $('#st', view).addEventListener('click', (e) => { const b = e.target.closest('[data-t]'); if (!b) return; stab = b.dataset.t; renderStock(view); });
    $('#po', view).addEventListener('click', purchaseSuggest);
    if ($('#addIng', view)) $('#addIng', view).addEventListener('click', () => ingForm(null, () => renderStock(view)));
    if (D.REAL) $$('[data-ing]', view).forEach((r) => r.addEventListener('click', () => ingForm(r.dataset.ing, () => renderStock(view))));
    const sb = $('#sb', view);
    if (stab === 'stock') {
      sb.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المكوّن</th><th>الموجود</th><th>حد الطلب</th><th style="width:22%">المستوى</th><th>الحالة</th><th>الصلاحية</th><th>المورّد</th></tr></thead><tbody>
        ${D.ING.slice().sort((a, b) => s.stock[a.id] / a.par - s.stock[b.id] / b.par).map((i) => { const v = s.stock[i.id]; const r = v / (i.par * 2.5); const lvl = v <= 0 ? 'red' : v < i.par ? 'amber' : ''; return `<tr ${D.REAL ? `class="click" data-ing="${i.id}"` : ''}><td><b>${esc(i.ar)}</b></td><td class="nw num">${qtyTxt(i.id, v)}</td><td class="nw muted">${qtyTxt(i.id, i.par)}</td><td><span class="bar ${lvl}"><i style="width:${Math.min(100, r * 100).toFixed(0)}%"></i></span></td><td class="nw">${v <= 0 ? '<span class="pill pill--red">نفد</span>' : v < i.par ? '<span class="pill pill--amber">قارب على النفاد</span>' : '<span class="pill pill--go">جيد</span>'}</td><td class="nw">${i.exp ? `<span class="pill ${i.exp <= 1 ? 'pill--red' : i.exp <= 2 ? 'pill--amber' : ''}">${i.exp === 1 ? 'غدًا' : i.exp === 2 ? 'بعد يومين' : `بعد ${i.exp} يوم`}</span>` : '<span class="muted">—</span>'}</td><td class="nw muted">${esc(D.sup(i.sup).ar)}</td></tr>`; }).join('')}</tbody></table></div>`;
    } else if (stab === 'recipes') {
      if (can('cost') !== 1) { sb.innerHTML = `<div class="card empty">${I('lock')}<b style="color:var(--ink-2)">التكلفة والأرباح للمدير فقط</b><span>المشرف يرى المخزون ويستلم ويجرد، أما تكلفة الكوب وهامش الربح فتظهر للمدير فقط.</span></div>`; return; }
      const withR = D.PRODUCTS.filter((p) => D.isDrink(p) && (!D.REAL || Object.keys(p.r || {}).length));
      if (!withR.length) { sb.innerHTML = `<div class="card empty">${I('menu')}<b style="color:var(--ink-2)">${bi('No recipes yet', 'لا توجد وصفات بعد')}</b><span>من صفحة Menu اضغط «أضف وصفة» جنب أي صنف، واكتب كمية كل مكوّن.</span></div>`; return; }
      sb.innerHTML = `<div class="grid g3">${withR.map((p) => { const l = { pid: p.id, qty: 1, mods: D.defMods(p) }; const r = D.recipe(l); const cost = D.recipeCost(r); const price = D.unitPrice(s, l); const net = D.exVat(price); return `<div class="card" style="padding:16px"><div class="card__h" style="margin-bottom:8px"><h3>${esc(p.ar)}<br><small class="muted en" style="font-weight:400">${esc(p.en)}${p.mods.includes('size') ? ' · Medium' : ''}</small></h3><span class="pill ${(net - cost) / net > .7 ? 'pill--go' : 'pill--amber'}">${((net - cost) / net * 100).toFixed(0)}%</span></div>
        ${Object.entries(r).map(([id, qq]) => `<div class="rc-kv" style="font-size:12.5px;padding:2px 0"><span>${esc(D.ing(id).ar)}</span><span class="num" style="font-weight:500">${D.fmt(qq, qq % 1 ? 1 : 0)} ${D.UNIT[D.ing(id).unit]} · ${fmt(qq * D.ing(id).cost)}</span></div>`).join('')}
        <hr class="rc-hr"><div class="rc-kv"><span><b>تكلفة الكوب</b></span><b class="num">${fmt(cost)} ر.س</b></div><div class="rc-kv muted" style="font-size:12px"><span>${D.vatOn() ? 'السعر بدون ضريبة' : 'السعر'}</span><span class="num">${fmt(net)}</span></div></div>`; }).join('')}</div>`;
    } else if (stab === 'receive') {
      sb.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card"><div class="card__h"><h3><span class="label">Goods received</span>استلام فاتورة مورّد</h3></div>
        <div class="grid" style="gap:12px"><label class="field"><span>المورّد</span><select class="select" id="rsup">${D.SUP.map((x) => `<option value="${x.id}">${esc(x.ar)}</option>`).join('')}</select></label>
        <label class="field"><span>الصنف</span><select class="select" id="ring"></select></label>
        <div class="grid g2"><label class="field"><span>الكمية</span><input class="input mono" id="rq"></label><label class="field"><span>سعر الوحدة (ر.س)</span><input class="input mono" id="rc"></label></div>
        <button class="btn btn--go" id="rok">${I('box', 'sm')} استلام وإضافة للمخزون</button></div></div>
        <div class="card"><div class="card__h"><h3><span class="label">Recent</span>آخر استلامات</h3></div>${s.receipts.slice().reverse().map((r) => `<div class="set-row"><span><b>${esc(D.ing(r.ing).ar)} · ${qtyTxt(r.ing, r.q)}</b><small>${esc(D.sup(r.sup).ar)} · ${D.time(r.ts)} · ${esc(D.staff(r.user).short)}</small></span>${money(r.total)}</div>`).join('') || '<div class="empty" style="padding:24px">لا توجد استلامات اليوم حتى الآن</div>'}</div></div>`;
      const fill = () => { const sid = $('#rsup', sb).value; $('#ring', sb).innerHTML = D.ING.filter((i) => i.sup === sid).map((i) => `<option value="${i.id}">${esc(i.ar)}</option>`).join(''); setDef(); };
      const setDef = () => { const i = D.ing($('#ring', sb).value); $('#rq', sb).value = i.buy; $('#rc', sb).value = i.unit === 'pc' ? i.cost.toFixed(2) : i.cost.toFixed(4); };
      $('#rsup', sb).addEventListener('change', fill); $('#ring', sb).addEventListener('change', setDef); fill();
      $('#rok', sb).addEventListener('click', () => {
        const id = $('#ring', sb).value, qq = parseFloat($('#rq', sb).value) || 0, uc = parseFloat($('#rc', sb).value) || 0, sid = $('#rsup', sb).value;
        if (qq <= 0) return;
        D.mutate((st) => { st.stock[id] = D.r2(st.stock[id] + qq); st.receipts.push({ ts: Date.now(), ing: id, q: qq, sup: sid, total: D.r2(qq * uc), user: me }); D.log(me, 'stock', `استلام: ${D.ing(id).ar} ${qtyTxt(id, qq)} من ${D.sup(sid).ar} — ${fmt(qq * uc)} ر.س`); }, 'stock');
        D.toast('أُضيف للمخزون', `${D.ing(id).ar} + ${qtyTxt(id, qq)}`, { ic: 'box' }); renderStock(view);
      });
    } else if (stab === 'count') {
      const ids = D.REAL ? D.ING.map((i) => i.id) : ['milk', 'oat', 'beans', 'cup12', 'cup16', 'icecup', 'sanseb', 'crois', 'cookie', 'bag-eth'];
      sb.innerHTML = `<div class="lockline">${I('box', 'sm')} اكتب الكمية الفعلية على الرف — يحسب النظام العجز أو الزيادة بقيمتها، وتُسجَّل التسوية في السجل.</div>
        <div class="tbl-wrap"><table class="tbl"><thead><tr><th>الصنف</th><th>في النظام</th><th>الفعلي</th><th class="r">الفرق</th><th class="r">القيمة</th></tr></thead><tbody>
        ${ids.map((id) => `<tr><td><b>${esc(D.ing(id).ar)}</b></td><td class="num nw">${qtyTxt(id, s.stock[id])}</td><td><input class="input mono" style="width:120px;height:36px" data-cnt="${id}" placeholder="${D.fmt0(s.stock[id])}"></td><td class="r num nw" data-dv="${id}">—</td><td class="r nw" data-vv="${id}">—</td></tr>`).join('')}</tbody></table></div>
        <div style="display:flex;justify-content:flex-end;margin-top:12px"><button class="btn btn--ink" id="cok">اعتماد الجرد وتسوية المخزون</button></div>`;
      $$('[data-cnt]', sb).forEach((inp) => inp.addEventListener('input', () => { const id = inp.dataset.cnt; const v = parseFloat(inp.value); const d = isNaN(v) ? null : D.r2(v - s.stock[id]); $(`[data-dv="${id}"]`, sb).innerHTML = d == null ? '—' : `<span class="${d < 0 ? 'down' : d > 0 ? 'up' : ''}">${d > 0 ? '+' : ''}${D.fmt0(d)} ${D.UNIT[D.ing(id).unit]}</span>`; $(`[data-vv="${id}"]`, sb).innerHTML = d == null ? '—' : money(d * D.ing(id).cost); }));
      $('#cok', sb).addEventListener('click', () => {
        let n = 0, val = 0;
        D.mutate((st) => { $$('[data-cnt]', sb).forEach((inp) => { const v = parseFloat(inp.value); if (isNaN(v)) return; const id = inp.dataset.cnt; const d = v - st.stock[id]; if (!d) return; n++; val += d * D.ing(id).cost; st.stock[id] = v; D.log(me, 'stock', `تسوية جرد: ${D.ing(id).ar} ${d > 0 ? '+' : ''}${D.fmt0(d)} ${D.UNIT[D.ing(id).unit]} (${fmt(d * D.ing(id).cost)} ر.س)`, null, d < 0 ? 'warn' : 'info'); }); st.counts.push({ ts: Date.now(), n, val, user: me }); }, 'count');
        D.toast('تم اعتماد الجرد', n ? `تمت تسوية ${n} صنف · ${val < 0 ? 'عجز' : 'زيادة'} ${fmt(Math.abs(val))} ر.س` : 'لا توجد فروقات', { ic: 'box' }); renderStock(view);
      });
    } else if (stab === 'waste') {
      sb.innerHTML = `<div class="grid g2" style="align-items:start"><div class="card"><div class="card__h"><h3><span class="label">Log waste</span>تسجيل هالك</h3></div><div class="grid" style="gap:12px">
        <label class="field"><span>الصنف</span><select class="select" id="wp">${D.PRODUCTS.filter((p) => p.cat !== 'beans').map((p) => `<option value="p:${p.id}">${esc(p.ar)}</option>`).join('')}${D.ING.filter((i) => i.exp).map((i) => `<option value="i:${i.id}">${esc(i.ar)} (خام)</option>`).join('')}</select></label>
        <div class="grid g2"><label class="field"><span>الكمية</span><input class="input mono" id="wq" value="1"></label><label class="field"><span>السبب</span><select class="select" id="ww"><option>مشروب حُضّر بالخطأ</option><option>منتهي الصلاحية</option><option>انكسر / سقط</option><option>تذوّق وتجربة</option></select></label></div>
        <button class="btn btn--ink" id="wok">تسجيل الهالك</button></div></div>
        <div class="card"><div class="card__h"><h3><span class="label">Today</span>هالك اليوم</h3><span class="pill pill--amber">${fmt(wasteV)} ر.س</span></div>${s.waste.slice().reverse().map((w) => `<div class="set-row"><span><b>${w.pid ? esc(D.prod(w.pid).ar) + ' ×' + w.q : esc(D.ing(w.ing).ar) + ' · ' + qtyTxt(w.ing, w.q)}</b><small>${esc(w.why)} · ${D.time(w.ts)} · ${esc(D.staff(w.user).short)}</small></span>${money(w.cost)}</div>`).join('')}</div></div>`;
      $('#wok', sb).addEventListener('click', () => {
        const [t, id] = $('#wp', sb).value.split(':'); const qq = parseFloat($('#wq', sb).value) || 0; const why = $('#ww', sb).value;
        if (qq <= 0) return;
        D.mutate((st) => {
          let cost;
          if (t === 'p') { const l = { pid: id, qty: qq, mods: D.defMods(D.prod(id)) }; const r = D.recipe(l); cost = D.recipeCost(r); Object.entries(r).forEach(([k, v]) => { st.stock[k] = Math.max(0, st.stock[k] - v); }); st.waste.push({ ts: Date.now(), pid: id, q: qq, why, user: me, cost: D.r2(cost) }); }
          else { cost = qq * D.ing(id).cost; st.stock[id] = Math.max(0, st.stock[id] - qq); st.waste.push({ ts: Date.now(), ing: id, q: qq, why, user: me, cost: D.r2(cost) }); }
          D.log(me, 'waste', `هالك: ${t === 'p' ? D.prod(id).ar + ' ×' + qq : D.ing(id).ar + ' ' + qq} — ${why}`);
        }, 'waste');
        renderStock(view);
      });
    } else {
      sb.innerHTML = `<div class="tbl-wrap"><table class="tbl"><thead><tr><th>المورّد</th><th>التواصل</th><th>شروط الدفع</th><th>الأصناف</th><th class="r">المستحق عليك</th></tr></thead><tbody>${D.SUP.map((x) => `<tr><td><b>${esc(x.ar)}</b></td><td class="muted">${esc(x.who)}</td><td class="nw">${esc(x.terms)}</td><td>${D.ING.filter((i) => i.sup === x.id).length}</td><td class="r nw">${x.due ? money(x.due + s.receipts.filter((r) => r.sup === x.id).reduce((a, r) => a + r.total, 0)) : '<span class="pill pill--go">مسدّد</span>'}</td></tr>`).join('')}</tbody></table></div>
        <p class="muted" style="margin-top:10px;font-size:12.5px">كشف حساب كل مورّد: الاستلامات والمدفوع والمتبقي، ويتحدّث مع كل فاتورة استلام.</p>`;
    }
  }
  function purchaseSuggest() {
    const s = S();
    const low = D.ING.filter((i) => s.stock[i.id] < i.par);
    const by = {};
    low.forEach((i) => { (by[i.sup] = by[i.sup] || []).push(i); });
    const m = D.modal(`${D.head('اقتراح طلب شراء', 'محسوب من حد الطلب لكل صنف ومعدّل الاستهلاك')}
      <div class="modal__b">${Object.keys(by).length ? Object.entries(by).map(([sid, items]) => `<div class="card" style="padding:14px;margin-bottom:10px"><div class="card__h" style="margin-bottom:6px"><h3>${esc(D.sup(sid).ar)}</h3><span class="pill">${esc(D.sup(sid).terms)}</span></div>
        ${items.map((i) => `<div class="rc-kv" style="padding:4px 0"><span>${esc(i.ar)} <small class="muted">(موجود ${qtyTxt(i.id, s.stock[i.id])})</small></span><b class="num">${qtyTxt(i.id, i.buy)} · ${fmt(i.buy * i.cost)}</b></div>`).join('')}</div>`).join('') : '<div class="empty">كل الأصناف أعلى من حد الطلب</div>'}</div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إغلاق</button>${Object.keys(by).length && !D.LIVE ? `<button class="btn btn--ink" id="snd">${I('send', 'sm')} إرسال للموردين</button>` : ''}</div>`);
    if ($('#snd', m)) $('#snd', m).addEventListener('click', () => { m.close(); D.toast('تم تجهيز طلبات الشراء (تجربة)', 'في التشغيل الفعلي تُرسل لكل مورّد عبر واتساب أو البريد', { ic: 'send' }); });
  }

  /* =====================================================================
     CUSTOMERS
     ===================================================================== */
  let cq = '';
  function renderCustomers(view) {
    view.className = 'view';
    const s = S();
    const list = s.customers.filter((c) => !cq || c.name.includes(cq) || c.phone.includes(cq)).sort((a, b) => b.visits - a.visits);
    const totalStamps = s.orders.reduce((a, o) => a + (o.stamps || 0), 0);
    view.innerHTML = `<div class="vh"><div><span class="label">Customers · loyalty</span><h1>Regulars</h1><p>يُسجَّل العميل برقم جواله فقط، وكل ${s.settings.loyalNeed} مشروبات له مشروب هدية — بدون بطاقات ورقية.</p></div></div>
      <div class="grid g4 kpi-row" style="margin-bottom:14px"><div class="kpi"><span class="label">Members</span><b>${s.customers.length}</b><small>عميل مسجّل</small></div>
      <div class="kpi"><span class="label">Today</span><b>${D.today(s).filter((o) => o.cust).length}</b><small>فاتورة باسم عميل</small></div>
      <div class="kpi"><span class="label">Stamps</span><b>${totalStamps}</b><small>ختم أُضيف اليوم</small></div>
      <div class="kpi"><span class="label">Rewards</span><b>${s.customers.reduce((a, c) => a + (c.rewards || 0), 0)}</b><small>مشروب هدية مستني</small></div></div>
      <label class="search" style="display:block;margin-bottom:12px"><span>${I('search')}</span><input class="input" id="cq" placeholder="ابحث بالاسم أو الجوال" value="${esc(cq)}"></label>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>العميل</th><th>الجوال</th><th>الزيارات</th><th>الأختام</th><th>المفضّل</th><th class="r">إجمالي الصرف</th><th>آخر زيارة</th></tr></thead><tbody>
      ${list.map((c) => `<tr class="click" data-c="${c.id}"><td><b>${esc(c.name)}</b> ${c.tag ? `<span class="pill ${c.tag === 'VIP' ? 'pill--ink' : 'pill--blue'}">${c.tag}</span>` : ''}</td><td class="mono nw" style="direction:ltr;text-align:right">${c.phone.slice(0, 3)}•••${c.phone.slice(-4)}</td><td class="num">${c.visits}</td><td class="nw"><span class="stamps">${Array.from({ length: s.settings.loyalNeed }, (_, i) => `<i class="${i < c.stamps ? 'on' : ''}"></i>`).join('')}</span>${c.rewards ? ` <span class="pill pill--go">${I('gift', 'sm')} ${c.rewards}</span>` : ''}</td><td class="nw">${esc(D.prod(c.fav).ar)}</td><td class="r nw">${money(c.spend)}</td><td class="nw muted">${D.ago(c.last)}</td></tr>`).join('')}</tbody></table></div>`;
    const ci = $('#cq', view);
    ci.addEventListener('input', () => { cq = ci.value.trim(); const pos = ci.selectionStart; renderCustomers(view); const n = $('#cq', view); n.focus(); n.setSelectionRange(pos, pos); });
    $$('[data-c]', view).forEach((r) => r.addEventListener('click', () => customerCard(r.dataset.c)));
  }
  function customerCard(id) {
    const s = S(); const c = s.customers.find((x) => x.id === id);
    const os = s.orders.filter((o) => o.cust === id).slice().reverse();
    const m = D.modal(`${D.head(esc(c.name), `${c.visits} زيارة · عميل من ${Math.max(2, Math.round(c.visits / 3))} شهور`)}
      <div class="modal__b"><div class="card" style="text-align:center;padding:18px"><span class="label">Loyalty card</span><div style="margin:10px 0"><span class="stamps lg">${Array.from({ length: s.settings.loyalNeed }, (_, i) => `<i class="${i < c.stamps ? 'on' : ''}"></i>`).join('')}</span></div><b>${c.stamps} من ${s.settings.loyalNeed}</b>${c.rewards ? `<div class="pill pill--go" style="margin-top:8px">${I('gift', 'sm')} لديه ${c.rewards} مشروب هدية</div>` : `<div class="muted" style="font-size:12.5px">متبقٍ ${s.settings.loyalNeed - c.stamps} مشروبات على الهدية</div>`}</div>
        <div class="grid g3" style="margin:12px 0"><div class="kpi" style="padding:12px"><span class="label">Spend</span><b style="font-size:20px">${D.fmt0(c.spend)}</b></div><div class="kpi" style="padding:12px"><span class="label">Avg</span><b style="font-size:20px">${D.fmt0(c.spend / Math.max(1, c.visits))}</b></div><div class="kpi" style="padding:12px"><span class="label">Favorite</span><b style="font-size:15px">${esc(D.prod(c.fav).ar)}</b></div></div>
        ${os.length ? `<h4 style="font-size:13px;margin-bottom:6px">طلبات اليوم</h4>${os.map((o) => `<div class="set-row"><span><b>#${o.no} · ${esc(o.lines.map((l) => D.prod(l.pid).ar).join('، '))}</b><small>${D.time(o.ts)}</small></span>${money(o.total)}</div>`).join('')}` : ''}</div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إغلاق</button><button class="btn btn--go" id="use">${I('register', 'sm')} ابدأ طلبًا باسمه</button></div>`);
    $('#use', m).addEventListener('click', () => { cart.cust = id; m.close(); go('sell'); });
  }

  /* =====================================================================
     REPORTS
     ===================================================================== */
  let rng = 'today';
  const W_SUM = Object.values(D.HOUR_W).reduce((a, b) => a + b, 0);
  function synthDay(dayOffset) { // أيام قبل النهارده — أرقام ثابتة لكل يوم
    const bs = D.bizStart(Date.now()) - dayOffset * 864e5;
    const R = D.rng('day:' + D.dayKey(bs + 3600e3));
    const wd = D.ksa(bs).wd;
    const base = 4650 * (wd === 4 || wd === 5 ? 1.22 : wd === 6 ? 1.08 : 1) * (0.86 + R() * 0.28);
    const orders = Math.round(base / (34 + R() * 6));
    return { ts: bs, total: D.r2(base), orders, vat: D.vatOn() ? D.r2(base * 15 / 115) : 0, mix: { mada: .49 + R() * .04, apple: .22 + R() * .04, cash: .14 + R() * .03, stc: .07, online: .08 }, R };
  }
  const elapsedShare = () => { const now = Date.now(); const bs = D.bizStart(now); let acc = 0, all = 0; for (let h = 0; h < 24; h++) { const hh = (D.OPEN_H + h) % 24; const w = D.HOUR_W[hh]; all += w; const st = bs + h * 3600e3; if (now >= st + 3600e3) acc += w; else if (now > st) acc += w * (now - st) / 3600e3; } return acc / all; };
  function renderReportsLive(view) {
    view.className = 'view';
    const s = S();
    const vatOn = s.settings.vatOn !== false;
    const seeCost = can('cost') === 1 && D.PRODUCTS.some((p) => Object.keys(p.r || {}).length);
    const today = D.summarize(s.day, D.today(s));
    const days = (s.days || []).slice();
    const pick = rng === 'today' ? [today] : rng === 'yday' ? days.slice(-1) : rng === 'week' ? days.slice(-6).concat([today]) : days.slice(-29).concat([today]);
    const agg = { total: 0, vat: 0, orders: 0, cost: 0, refunds: 0, by: {}, items: {}, hours: Array(24).fill(0) };
    pick.forEach((d) => {
      ['total', 'vat', 'orders', 'cost', 'refunds'].forEach((k) => { agg[k] += d[k] || 0; });
      Object.entries(d.by || {}).forEach(([k, v]) => { agg.by[k] = (agg.by[k] || 0) + v; });
      Object.entries(d.items || {}).forEach(([k, v]) => { const it = agg.items[k] = agg.items[k] || { q: 0, v: 0 }; it.q += v.q; it.v += v.v; });
      (d.hours || []).forEach((h, i) => { agg.hours[i] += h; });
    });
    const yd = days.slice(-1)[0];
    const seg = `<div class="seg" id="rg">${[['today', 'Today', 'اليوم'], ['yday', 'Yesterday', 'أمس'], ['week', '7 days', 'أسبوع'], ['month', '30 days', 'شهر']].map(([k, en, l]) => `<button data-r="${k}" class="${rng === k ? 'on' : ''}">${bi(en, l)}</button>`).join('')}</div>`;
    const head = `<div class="vh"><div><span class="label">Reports · ${D.dateAr()}</span><h1>The numbers</h1><p>من فواتير المحل الحقيقية فقط. كل يوم يُقفل ويُؤرشف تلقائيًا الساعة ${D.OPEN_H} صباحًا.</p></div><div class="vh__act">${seg}</div></div>`;
    if (!agg.orders) {
      view.innerHTML = head + `<div class="card empty">${I('chart')}<b style="color:var(--ink-2)">${bi('No sales yet', 'لا توجد مبيعات في هذه الفترة بعد')}</b><span>${rng === 'today' ? 'أول فاتورة اليوم ستظهر هنا مباشرة.' : 'الأيام السابقة تظهر هنا بعد أول يوم تشغيل كامل.'}</span></div>`;
    } else {
      const mixTot = Object.values(agg.by).reduce((a, b) => a + b, 0) || 1;
      const top = Object.entries(agg.items).map(([id, v]) => ({ id, ...v })).filter((t) => D.prod(t.id)).sort((a, b) => b.v - a.v);
      const sold = new Set(top.map((t) => t.id));
      const unsold = D.PRODUCTS.filter((p) => !sold.has(p.id) && !p.offer).slice(0, 6);
      const rows = rng === 'today' || rng === 'yday'
        ? Array.from({ length: 24 }, (_, h) => { const hh = (D.OPEN_H + h) % 24; return { h: hh, v: agg.hours[hh], y: rng === 'today' && yd ? (yd.hours || [])[hh] || 0 : 0 }; })
        : pick.map((d) => ({ h: d.day.slice(8), v: d.total, y: 0, day: 1 }));
      const staff = {}; if (rng === 'today') D.today(s).filter((o) => !o.unpaid && o.status !== 'rejected').forEach((o) => { const x = staff[o.staff] = staff[o.staff] || { n: 0, v: 0 }; x.n++; x.v += D.netOf(o); });
      view.innerHTML = head + `<div class="grid g4 kpi-row">
          <div class="kpi"><span class="label">${vatOn ? 'Sales incl. VAT' : 'Sales'}</span><b>${fmt(agg.total)}</b><small>ر.س${agg.refunds ? ` · بعد مرتجعات ${fmt(agg.refunds)}` : ''}</small></div>
          <div class="kpi"><span class="label">Invoices</span><b>${D.fmt0(agg.orders)}</b><small>فاتورة</small></div>
          <div class="kpi"><span class="label">Avg ticket</span><b>${fmt(agg.total / agg.orders)}</b><small>ر.س متوسط الفاتورة</small></div>
          <div class="kpi"><span class="label">${vatOn ? 'VAT collected' : seeCost ? 'Gross profit' : 'Refunds'}</span><b>${vatOn ? fmt(agg.vat) : seeCost ? fmt(agg.total - agg.cost) : fmt(agg.refunds)}</b><small>${vatOn ? 'ر.س ضريبة القيمة المضافة 15%' : 'ر.س'}</small></div></div>
        <div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin-top:14px" id="r2">
          <div class="card"><div class="card__h"><h3><span class="label">Sales</span>${rows[0] && rows[0].day ? 'المبيعات باليوم' : 'المبيعات بالساعة'}</h3>${rng === 'today' && yd ? '<div class="legend"><span><i style="background:var(--ink)"></i>اليوم</span><span><i style="background:var(--go)"></i>أمس</span></div>' : ''}</div>${chart(rows)}</div>
          <div class="card"><div class="card__h"><h3><span class="label">Tenders</span>طرق الدفع</h3></div><div class="mix">${Object.entries(agg.by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="mix__row"><span>${D.PAY[k] ? D.PAY[k].ar : k}</span><span class="bar"><i style="width:${(v / mixTot * 100).toFixed(1)}%"></i></span><span class="num">${(v / mixTot * 100).toFixed(0)}% · ${D.fmt0(v)}</span></div>`).join('')}</div></div></div>
        <div class="grid g2" style="margin-top:14px;align-items:start">
          <div class="card"><div class="card__h"><h3><span class="label">Best sellers</span>الأكثر مبيعًا</h3></div><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>الصنف</th><th class="r">الكمية</th><th class="r">المبيعات</th></tr></thead><tbody>${top.slice(0, 10).map((t) => `<tr><td><b>${esc(D.prod(t.id).ar)}</b></td><td class="r num">${t.q}</td><td class="r nw">${money(t.v)}</td></tr>`).join('')}</tbody></table></div></div>
          <div class="grid" style="gap:14px">
            <div class="card"><div class="card__h"><h3><span class="label">Not sold</span>لم يُطلب في الفترة</h3></div>${unsold.map((p) => `<div class="set-row"><span><b>${esc(p.ar)}</b><small>${esc(p.en)}</small></span><span class="pill">0</span></div>`).join('') || '<div class="empty" style="padding:16px">كل الأصناف اتباعت</div>'}</div>
            ${vatOn ? `<div class="card"><div class="card__h"><h3><span class="label">VAT · ZATCA</span>ملخص الضريبة</h3></div><div class="set-row"><span><b>المبيعات قبل الضريبة</b></span>${money(agg.total - agg.vat)}</div><div class="set-row"><span><b>ضريبة القيمة المضافة 15%</b></span>${money(agg.vat)}</div></div>` : ''}
          </div></div>
        ${Object.keys(staff).length ? `<div class="card" style="margin-top:14px"><div class="card__h"><h3><span class="label">Team</span>المبيعات حسب الموظف اليوم</h3></div><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>الموظف</th><th class="r">الفواتير</th><th class="r">المبيعات</th></tr></thead><tbody>${Object.entries(staff).map(([u, x]) => `<tr><td><b>${esc(D.staff(u).name)}</b></td><td class="r num">${x.n}</td><td class="r nw">${money(x.v)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
      if (window.matchMedia('(max-width:900px)').matches) $('#r2', view).style.gridTemplateColumns = 'minmax(0,1fr)';
    }
    $('#rg', view).addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; rng = b.dataset.r; renderReports(view); });
  }
  function renderReports(view) {
    if (D.REAL) { renderReportsLive(view); return; }
    view.className = 'view';
    const s = S();
    const seeCost = can('cost') === 1;
    const valid = s.orders.filter((o) => o.status !== 'rejected');
    const todayTot = D.r2(valid.reduce((a, o) => a + D.netOf(o), 0));
    const y = synthDay(1);
    const share = elapsedShare();
    const ySame = D.r2(y.total * share);
    const dlt = (a, b) => { const p = b ? (a - b) / b * 100 : 0; return `<span class="${p >= 0 ? 'up' : 'down'}">${p >= 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(1)}%</span>`; };
    let kp, hourly, mix, top, chartNote;
    if (rng === 'today') {
      const cost = valid.reduce((a, o) => a + o.lines.reduce((b, l) => b + (l.cost || 0), 0), 0);
      const net = valid.reduce((a, o) => a + o.net, 0);
      kp = { total: todayTot, orders: valid.length, avg: todayTot / (valid.length || 1), vat: valid.reduce((a, o) => a + o.vat, 0), profit: net - cost, cmp: ySame, cmpO: Math.round(y.orders * share), lbl: 'عن أمس في نفس الوقت' };
      hourly = Array.from({ length: 24 }, (_, h) => { const hh = (D.OPEN_H + h) % 24; const st = D.bizStart(Date.now()) + h * 3600e3; return { h: hh, v: valid.filter((o) => o.ts >= st && o.ts < st + 3600e3).reduce((a, o) => a + o.total, 0), y: y.total * D.HOUR_W[hh] / W_SUM * (.9 + y.R() * .2), future: st > Date.now() }; });
      mix = {}; valid.forEach((o) => o.pays.forEach((p) => { mix[p.m] = (mix[p.m] || 0) + p.a; }));
      const by = {}; valid.forEach((o) => o.lines.forEach((l) => { const b = by[l.pid] = by[l.pid] || { q: 0, v: 0, c: 0 }; b.q += l.qty; b.v += l.total; b.c += l.cost || 0; }));
      top = Object.entries(by).map(([id, b]) => ({ id, ...b }));
      chartNote = 'المبيعات بالساعة · اليوم مقابل أمس';
    } else {
      const days = rng === 'yday' ? [1] : rng === 'week' ? [0, 1, 2, 3, 4, 5, 6] : Array.from({ length: 30 }, (_, i) => i);
      const ds = days.map((d) => (d === 0 ? { ts: Date.now(), total: todayTot, orders: valid.length, vat: valid.reduce((a, o) => a + o.vat, 0), mix: null } : synthDay(d)));
      const total = ds.reduce((a, d) => a + d.total, 0), orders = ds.reduce((a, d) => a + d.orders, 0);
      const prev = days.map((d) => synthDay(d + days.length));
      const ptot = prev.reduce((a, d) => a + d.total, 0);
      kp = { total, orders, avg: total / orders, vat: D.vatOn() ? total * 15 / 115 : 0, profit: D.exVat(total) * .71, cmp: ptot, cmpO: prev.reduce((a, d) => a + d.orders, 0), lbl: rng === 'yday' ? 'عن اليوم السابق' : 'عن الفترة السابقة' };
      hourly = rng === 'yday' ? Array.from({ length: 24 }, (_, h) => { const hh = (D.OPEN_H + h) % 24; return { h: hh, v: y.total * D.HOUR_W[hh] / W_SUM, y: 0 }; }) : ds.slice().reverse().map((d) => ({ h: D.dateArS(d.ts).split(' ')[0], v: d.total, y: 0, day: 1 }));
      mix = { mada: total * .5, apple: total * .23, cash: total * .15, stc: total * .07, online: total * .05 };
      const R = D.rng('top:' + rng);
      top = D.PRODUCTS.map((p) => { const q = Math.round(p.pop * orders * .32 * (.8 + R() * .4)); const l = { pid: p.id, qty: 1, mods: D.defMods(p) }; return { id: p.id, q, v: q * D.unitPrice(s, l), c: q * D.lineCost(l) }; });
      chartNote = rng === 'yday' ? 'المبيعات بالساعة · أمس' : 'المبيعات باليوم';
    }
    top.sort((a, b) => b.v - a.v);
    const slow = D.PRODUCTS.filter((p) => p.cat !== 'beans' && p.id !== 'water').map((p) => ({ p, q: (top.find((t) => t.id === p.id) || { q: 0 }).q })).sort((a, b) => a.q - b.q).slice(0, 4);
    const mixTot = Object.values(mix).reduce((a, b) => a + b, 0) || 1;
    const chM = {}; if (rng === 'today') valid.forEach((o) => { chM[o.ch] = (chM[o.ch] || 0) + o.total; });
    const staff = {}; if (rng === 'today') valid.forEach((o) => { const x = staff[o.staff] = staff[o.staff] || { n: 0, v: 0 }; x.n++; x.v += o.total; });
    const risk = (u, act) => s.log.filter((l) => l.user === u && l.act === act).length;
    view.innerHTML = `<div class="vh"><div><span class="label">Reports · ${D.dateAr()}</span><h1>The numbers</h1><p>كل الأرقام تتحدّث مع كل فاتورة، من الكاشيرين والطلبات الأونلاين.</p></div>
      <div class="vh__act"><div class="seg" id="rg">${[['today', 'Today', 'اليوم'], ['yday', 'Yesterday', 'أمس'], ['week', '7 days', 'أسبوع'], ['month', '30 days', 'شهر']].map(([k, en, l]) => `<button data-r="${k}" class="${rng === k ? 'on' : ''}">${bi(en, l)}</button>`).join('')}</div><button class="btn btn--ghost btn--sm" id="csv">${I('download', 'sm')} Excel</button></div></div>
      <div class="grid g4 kpi-row">
        <div class="kpi"><span class="label">${D.vatOn() ? 'Sales incl. VAT' : 'Sales'}</span><b>${D.fmt0(kp.total)}</b><small>ر.س · ${dlt(kp.total, kp.cmp)} ${kp.lbl}</small></div>
        <div class="kpi"><span class="label">Invoices</span><b>${D.fmt0(kp.orders)}</b><small>${dlt(kp.orders, kp.cmpO)} ${kp.lbl}</small></div>
        <div class="kpi"><span class="label">Avg ticket</span><b>${fmt(kp.avg)}</b><small>ر.س متوسط الفاتورة</small></div>
        <div class="kpi"><span class="label">${seeCost ? 'Gross profit' : D.vatOn() ? 'VAT collected' : 'Refunds'}</span><b>${seeCost ? D.fmt0(kp.profit) : D.vatOn() ? D.fmt0(kp.vat) : D.fmt0(s.orders.reduce((a, o) => a + (o.refunded || 0), 0))}</b><small>${seeCost ? (D.vatOn() ? 'ر.س بعد تكلفة المكوّنات وقبل الضريبة' : 'ر.س بعد تكلفة المكوّنات') : D.vatOn() ? 'ر.س ضريبة القيمة المضافة 15%' : 'ر.س مرتجعات اليوم'}</small></div></div>
      <div class="grid" style="grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);margin-top:14px" id="r2">
        <div class="card"><div class="card__h"><h3><span class="label">Sales</span>${chartNote}</h3>${rng === 'today' ? '<div class="legend"><span><i style="background:var(--ink)"></i>اليوم</span><span><i style="background:var(--go)"></i>أمس</span></div>' : ''}</div>${chart(hourly)}</div>
        <div class="card"><div class="card__h"><h3><span class="label">Tenders</span>طرق الدفع</h3></div><div class="mix">${Object.entries(mix).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="mix__row"><span>${D.PAY[k].ar}</span><span class="bar"><i style="width:${(v / mixTot * 100).toFixed(1)}%"></i></span><span class="num">${(v / mixTot * 100).toFixed(0)}% · ${D.fmt0(v)}</span></div>`).join('')}</div>
          ${rng === 'today' ? `<div class="card__h" style="margin:18px 0 10px"><h3><span class="label">Channels</span>مصدر الطلب</h3></div><div class="mix">${Object.entries(chM).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<div class="mix__row"><span>${D.CH[k].ar}</span><span class="bar"><i style="width:${(v / todayTot * 100).toFixed(1)}%;background:var(--blue)"></i></span><span class="num">${(v / todayTot * 100).toFixed(0)}%</span></div>`).join('')}</div>` : ''}</div>
      </div>
      <div class="grid g2" style="margin-top:14px;align-items:start">
        <div class="card"><div class="card__h"><h3><span class="label">Best sellers</span>الأكثر مبيعًا</h3></div><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>الصنف</th><th class="r">الكمية</th><th class="r">المبيعات</th>${seeCost ? '<th class="r">الهامش</th>' : ''}</tr></thead><tbody>${top.slice(0, 8).map((t) => `<tr><td><b>${esc(D.prod(t.id).ar)}</b></td><td class="r num">${t.q}</td><td class="r nw">${money(t.v, 0)}</td>${seeCost ? `<td class="r"><span class="pill pill--go">${((D.exVat(t.v) - t.c) / (D.exVat(t.v) || 1) * 100).toFixed(0)}%</span></td>` : ''}</tr>`).join('')}</tbody></table></div></div>
        <div class="grid" style="gap:14px">
          <div class="card"><div class="card__h"><h3><span class="label">Slow movers</span>الأصناف الراكدة</h3></div>${slow.map((x) => `<div class="set-row"><span><b>${esc(x.p.ar)}</b><small>${x.q} فقط ${rng === 'today' ? 'اليوم' : 'في الفترة'}</small></span><span class="pill pill--amber">راجع السعر أو العرض</span></div>`).join('')}</div>
          ${D.vatOn() ? `<div class="card"><div class="card__h"><h3><span class="label">VAT · ZATCA</span>ملخص الضريبة</h3></div><div class="set-row"><span><b>المبيعات الخاضعة (قبل الضريبة)</b></span>${money(kp.total / 1.15)}</div><div class="set-row"><span><b>ضريبة القيمة المضافة 15%</b></span>${money(kp.vat)}</div><div class="set-row"><span><b>إشعارات دائنة (مرتجعات)</b><small>${s.orders.reduce((a, o) => a + (o.refunds || []).length, 0)} إشعار اليوم</small></span><span class="down">-${money(s.orders.reduce((a, o) => a + (o.refunded || 0), 0) * 15 / 115)}</span></div></div>` : ''}
        </div></div>
      ${rng === 'today' ? `<div class="card" style="margin-top:14px"><div class="card__h"><h3><span class="label">Team</span>أداء الكاشيرين اليوم</h3></div><div class="tbl-wrap" style="border:0"><table class="tbl"><thead><tr><th>الموظف</th><th class="r">الفواتير</th><th class="r">المبيعات</th><th class="r">متوسط الفاتورة</th><th class="r">حذف أصناف</th><th class="r">فتح درج بدون بيع</th><th class="r">خصومات</th></tr></thead><tbody>${Object.entries(staff).map(([u, x]) => `<tr><td><div style="display:flex;align-items:center;gap:8px">${D.av(u)}<span><b>${esc(D.staff(u).name)}</b><br><small class="muted">${D.ROLES[D.staff(u).role].ar} · كاشير ${u === 'u5' ? 2 : 1}</small></span></div></td><td class="r num">${x.n}</td><td class="r nw">${money(x.v, 0)}</td><td class="r">${fmt(x.v / x.n)}</td><td class="r">${risk(u, 'void') ? `<span class="pill pill--amber">${risk(u, 'void')}</span>` : '0'}</td><td class="r">${risk(u, 'nosale') ? `<span class="pill pill--red">${risk(u, 'nosale')}</span>` : '0'}</td><td class="r">${risk(u, 'disc')}</td></tr>`).join('')}</tbody></table></div></div>` : ''}`;
    $('#rg', view).addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (!b) return; rng = b.dataset.r; renderReports(view); });
    $('#csv', view).addEventListener('click', () => {
      const tx = D.vatOn(); const rows = [['invoice', 'order', 'time', 'channel', 'total', ...(tx ? ['vat'] : []), 'payment', 'cashier']].concat(valid.map((o) => [o.inv, o.no, D.time24(o.ts), o.ch, o.total, ...(tx ? [o.vat] : []), o.pays.map((p) => p.m).join('+'), D.staff(o.staff).short]));
      const blob = new Blob(['﻿' + rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `darj-sales-${S().day}.csv`; a.click();
    });
    if (window.matchMedia('(max-width:900px)').matches) $('#r2', view).style.gridTemplateColumns = 'minmax(0,1fr)';
  }
  function chart(rows) {
    const W = 640, H = 220, pl = 6, pr = 6, pt = 10, pb = 22;
    const max = Math.max(1, ...rows.map((r) => Math.max(r.v, r.y || 0))) * 1.1;
    const bw = (W - pl - pr) / rows.length;
    const yv = (v) => pt + (H - pt - pb) * (1 - v / max);
    const bars = rows.map((r, i) => r.future ? '' : `<rect x="${(pl + i * bw + bw * .18).toFixed(1)}" y="${yv(r.v).toFixed(1)}" width="${(bw * .64).toFixed(1)}" height="${(H - pb - yv(r.v)).toFixed(1)}" rx="3" fill="var(--ink)"><title>${r.h}: ${D.fmt0(r.v)} ر.س</title></rect>`).join('');
    const line = rows.some((r) => r.y) ? `<polyline fill="none" stroke="var(--go)" stroke-width="2" stroke-linejoin="round" points="${rows.map((r, i) => `${(pl + i * bw + bw / 2).toFixed(1)},${yv(r.y).toFixed(1)}`).join(' ')}"/>` : '';
    const lbls = rows.map((r, i) => (rows.length > 12 ? i % 3 === 0 : true) ? `<text x="${(pl + i * bw + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${r.day ? r.h : (r.h % 12 || 12) + (r.h < 12 ? 'a' : 'p')}</text>` : '').join('');
    return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" style="direction:ltr">${[.25, .5, .75].map((k) => `<line x1="0" x2="${W}" y1="${yv(max * k)}" y2="${yv(max * k)}" stroke="var(--line-2)"/>`).join('')}${bars}${line}${lbls}</svg>`;
  }

  /* =====================================================================
     TEAM & AUDIT LOG
     ===================================================================== */
  let lf = 'all';
  function staffForm(id, done) {
    const u = id ? D.staff(id) : { name: '', role: 'cashier', pin: '' };
    const m = D.modal(`${D.head(bi(id ? 'Edit staff' : 'Add staff', id ? 'تعديل موظف' : 'إضافة موظف'), 'كل موظف يدخل برمز PIN خاص، وكل حركة تُسجَّل باسمه')}
      <div class="modal__b grid" style="gap:12px"><label class="field"><span>الاسم</span><input class="input" id="sName" value="${esc(u.name)}"></label>
        <div class="picks" id="sRole">${['cashier', 'supervisor', 'manager', 'barista'].map((r) => `<button class="pickc${u.role === r ? ' on' : ''}" data-role="${r}">${bi(D.ROLES[r].en, D.ROLES[r].ar)}</button>`).join('')}</div>
        <label class="field"><span>PIN من 4 أرقام ${id ? '(اتركه فارغًا لو مش هتغيّره)' : ''}</span><input class="input mono" id="sPin" inputmode="numeric" maxlength="4" type="password"></label>
        ${id ? `<div class="set-row"><span><b>${u.off ? 'موقوف' : 'نشط'}</b><small>الموظف الموقوف لا يظهر في شاشة الدخول، وتبقى حركاته في السجل</small></span><button class="switch ${u.off ? '' : 'on'}" id="sOn"></button></div>` : ''}
        <div id="sErr"></div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--ink" id="sSave">${bi('Save', 'حفظ')}</button></div>`, { cls: 'modal--sm' });
    let role = u.role, off = !!u.off;
    $('#sRole', m).addEventListener('click', (e) => { const b = e.target.closest('[data-role]'); if (!b) return; role = b.dataset.role; $$('[data-role]', m).forEach((x) => x.classList.toggle('on', x === b)); });
    if ($('#sOn', m)) $('#sOn', m).addEventListener('click', (e) => { off = !off; e.currentTarget.classList.toggle('on', !off); });
    $('#sSave', m).addEventListener('click', () => {
      const name = $('#sName', m).value.trim(), pin = $('#sPin', m).value.trim();
      const err = (t) => { $('#sErr', m).innerHTML = `<div class="blind" style="color:var(--red)">${I('alert', 'sm')}<span>${t}</span></div>`; };
      if (!name) return err('اكتب اسم الموظف');
      if ((!id || pin) && !/^\d{4}$/.test(pin)) return err('الـPIN لازم يكون 4 أرقام');
      if (pin && D.STAFF.some((x) => x.id !== id && !x.off && x.pin === pin)) return err('الـPIN ده مستخدم لموظف تاني');
      const managers = D.STAFF.filter((x) => x.role === 'manager' && !x.off && x.id !== id).length;
      if (id && u.role === 'manager' && (role !== 'manager' || off) && !managers) return err('لازم يفضل مدير واحد على الأقل');
      const colors = ['#141414', '#2F5DA8', '#B8730F', '#8A4FA0', '#0E7A55', '#C2412D'];
      D.mutate((st) => {
        if (id) { const x = st.staff.find((y) => y.id === id); Object.assign(x, { name, short: name.split(' ')[0], role, off }); if (pin) x.pin = pin; D.log(me, 'team', `تعديل موظف: ${name} — ${D.ROLES[role].ar}${off ? ' (موقوف)' : ''}`, null, 'warn'); }
        else { st.staff.push({ id: 'u' + D.uid(), name, short: name.split(' ')[0], role, pin, c: colors[st.staff.length % colors.length] }); D.log(me, 'team', `إضافة موظف: ${name} — ${D.ROLES[role].ar}`, null, 'warn'); }
      }, 'team');
      m.close(); done && done();
    });
  }
  function renderTeam(view) {
    view.className = 'view';
    const s = S();
    const acts = { all: ['All', 'الكل'], risk: ['Sensitive', 'حساس'], void: ['Voids', 'حذف'], disc: ['Discounts', 'خصومات'], refund: ['Refunds', 'مرتجعات'], nosale: ['No sale', 'فتح الدرج'], price: ['Prices', 'أسعار'], shift: ['Shifts', 'ورديات'], stock: ['Stock', 'مخزون'] };
    const logs = s.log.filter((l) => lf === 'all' || (lf === 'risk' ? l.sev !== 'info' : l.act === lf)).slice().reverse();
    const sevPill = (l) => `<span class="pill ${l.sev === 'risk' ? 'pill--red' : l.sev === 'warn' ? 'pill--amber' : ''}">${{ login: 'دخول', shift: 'وردية', payout: 'مصروف', nosale: 'فتح درج', avail: 'توفّر', void: 'حذف', price: 'سعر', disc: 'خصم', refund: 'مرتجع', waste: 'هالك', stock: 'مخزون', offline: 'اتصال', sync: 'مزامنة', team: 'فريق', collect: 'تحصيل', settings: 'إعدادات' }[l.act] || l.act}</span>`;
    view.innerHTML = `<div class="vh"><div><span class="label">Team · permissions · audit log</span><h1>Who did what</h1><p>كل موظف بصلاحيات دوره، وكل حركة حساسة تُسجَّل في سجل لا يمكن حذفه.</p></div></div>
      ${D.REAL ? `<div style="display:flex;justify-content:flex-end;margin:-6px 0 12px"><button class="btn btn--ink" id="addStaff">${I('plus', 'sm')}${bi('Add staff', 'إضافة موظف')}</button></div>` : ''}
      <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(220px,1fr));margin-bottom:16px">${D.STAFF.map((u) => { const sh = s.shifts.find((x) => x.user === u.id && !x.close); return `<div class="card" ${D.REAL ? `data-staff="${u.id}" style="padding:14px;display:flex;gap:12px;align-items:center;cursor:pointer;${u.off ? 'opacity:.5' : ''}"` : 'style="padding:14px;display:flex;gap:12px;align-items:center"'}>${D.av(u, 'lg')}<span><b>${esc(u.name)}</b><br><small class="muted">${D.ROLES[u.role].ar} · PIN ••••</small><br>${u.id === me ? '<span class="pill pill--go"><i class="dot"></i> على الكاشير الآن</span>' : sh ? `<span class="pill pill--blue">وردية مفتوحة · كاشير ${sh.reg}</span>` : u.role === 'barista' ? '<span class="pill">على البار</span>' : '<span class="pill">خارج الوردية</span>'}</span></div>`; }).join('')}</div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);align-items:start" id="tg">
        <div class="card"><div class="card__h"><h3><span class="label">Permissions</span>الصلاحيات حسب الدور</h3></div><div class="tbl-wrap" style="border:0"><table class="tbl perm"><thead><tr><th>الصلاحية</th><th>كاشير</th><th>مشرف</th><th>مدير</th></tr></thead><tbody>
          ${D.PERMS.map((p) => `<tr><td>${esc(p.ar)}</td>${['cashier', 'supervisor', 'manager'].map((r) => `<td>${p[r] === 1 ? `<span class="yes">${I('check', 'sm')}</span>` : p[r] === 'ask' ? '<span class="pill pill--amber" style="height:20px">بموافقة</span>' : `<span class="no">${I('x', 'sm')}</span>`}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>
        <div class="card"><div class="card__h"><h3><span class="label">Audit log</span>سجل الحركات — اليوم</h3><span class="pill">${s.log.length} حركة</span></div>
          <div class="lockline">${I('lock', 'sm')} السجل للقراءة فقط: لا أحد يستطيع حذفه أو تعديله، حتى المدير.</div>
          <div class="cats" style="padding:0 0 10px" id="lf">${Object.entries(acts).map(([k, [en, l]]) => `<button class="chip ${lf === k ? 'on' : ''}" data-f="${k}">${bi(en, l)}</button>`).join('')}</div>
          <div class="tbl-wrap" style="max-height:520px;overflow:auto"><table class="tbl"><thead><tr><th>الوقت</th><th>الموظف</th><th>الحركة</th><th>التفاصيل</th></tr></thead><tbody>
          ${logs.map((l) => `<tr class="log-row"><td>${D.time(l.ts)}</td><td class="nw">${esc(D.staff(l.user).short)}</td><td>${sevPill(l)}</td><td>${esc(l.txt)}${l.appr ? `<br><small class="muted">وافق: ${esc(D.staff(l.appr).name)}</small>` : ''}</td></tr>`).join('')}</tbody></table></div></div></div>`;
    $('#lf', view).addEventListener('click', (e) => { const b = e.target.closest('[data-f]'); if (!b) return; lf = b.dataset.f; renderTeam(view); });
    if ($('#addStaff', view)) $('#addStaff', view).addEventListener('click', () => staffForm(null, () => renderTeam(view)));
    $$('[data-staff]', view).forEach((c) => c.addEventListener('click', () => staffForm(c.dataset.staff, () => renderTeam(view))));
    if (window.matchMedia('(max-width:1100px)').matches) $('#tg', view).style.gridTemplateColumns = 'minmax(0,1fr)';
  }

  /* =====================================================================
     SETTINGS
     ===================================================================== */
  function renderSettingsLive(view) {
    view.className = 'view';
    const s = S();
    const vatOn = s.settings.vatOn !== false;
    const sw = (k, on) => `<button class="switch ${on ? 'on' : ''}" data-sw="${k}"></button>`;
    const cn = D.CFG.connect || {};
    const days = (s.days || []).length;
    view.innerHTML = `<div class="vh"><div><span class="label">Settings · ${esc(D.STORE.branchEn || '')}</span><h1>Setup</h1><p>بيانات المحل والضريبة والتشغيل والبيانات.</p></div></div>
      <div class="grid g2" style="align-items:start">
        <div class="card"><div class="card__h"><h3><span class="label">Store · Tax</span>المحل والفاتورة</h3><button class="btn btn--ghost btn--sm" id="editStore">${bi('Edit', 'تعديل')}</button></div>
          <div class="set-row"><span><b>${esc(D.STORE.nameAr)}</b><small>${esc(D.STORE.nameEn || '')} · ${esc(D.STORE.branchAr || '')}${D.STORE.addr ? ' · ' + esc(D.STORE.addr) : ''}</small></span></div>
          <div class="set-row"><span><b>${vatOn ? 'مسجّل في ضريبة القيمة المضافة' : 'غير مسجّل في الضريبة'}</b><small>${vatOn ? 'الرقم الضريبي: <span class="mono">' + esc(D.STORE.vat || '—') + '</span>' : 'يصدر إيصال بيع بدون ضريبة ولا QR'}</small></span><span class="pill ${vatOn ? 'pill--go' : ''}">${vatOn ? 'فاتورة ضريبية + QR' : 'إيصال'}</span></div>
          ${vatOn ? `<div class="set-row"><span><b>الربط مع منصة «فاتورة» — المرحلة الثانية</b><small>تسجيل الجهاز والختم التشفيري والإبلاغ خلال 24 ساعة — يُنفَّذ مع مزوّد معتمد قبل موعد الموجة</small></span><span class="pill pill--amber">غير مفعّل</span></div>` : ''}
          <div class="set-row"><span><b>${D.noteName().ar} لكل مرتجع</b><small>برقم تسلسلي ومرتبط بالفاتورة الأصلية</small></span><span class="pill pill--go">${I('check', 'sm')}</span></div></div>
        <div class="card"><div class="card__h"><h3><span class="label">Online menu</span>الربط مع المنيو الأونلاين</h3><span class="pill ${cn.enabled ? 'pill--go' : 'pill--amber'}">${cn.enabled ? 'مفعّل' : 'جاهز — غير مربوط'}</span></div>
          <div class="set-row"><span><b>نفس أكواد الأصناف</b><small>${D.PRODUCTS.filter((p) => !p.offer).length} صنف و${D.PRODUCTS.filter((p) => p.offer).length} عروض بنفس الأكواد الموجودة في المنيو الحالي</small></span><span class="pill pill--go">${I('check', 'sm')}</span></div>
          <div class="set-row"><span><b>طلبات الطاولة تنزل هنا</b><small>بتظهر في Orders، والتحصيل عند الكاشير، وحالتها بتتحدّث في المنيو</small></span><span class="pill">${cn.enabled ? 'يعمل' : 'بعد الربط'}</span></div>
          ${cn.enabled ? '<div id="cloudBox"></div>' : '<p class="muted" style="font-size:12px;margin-top:8px">الربط متوقف عن قصد. يتفعّل يوم التشغيل بخطوة واحدة في ملف الإعدادات.</p>'}</div>
        <div class="card"><div class="card__h"><h3><span class="label">Operations</span>طريقة التشغيل</h3></div>
          <div class="set-row"><span><b>قبول تلقائي لطلبات المنيو</b><small>تصل للباريستا مباشرة</small></span>${sw('autoAccept', s.settings.autoAccept)}</div>
          <div class="set-row"><span><b>صوت التنبيهات</b><small>طلب جديد، طلب جاهز، قارئ الباركود</small></span>${sw('sound', s.settings.sound)}</div>
          <div class="set-row"><span><b>طباعة الفاتورة تلقائيًا</b><small>من نافذة الطباعة على الطابعة الحرارية 80مم</small></span>${sw('printer', s.settings.printer)}</div>
          <div class="set-row"><span><b>كارت الولاء</b><small>عدد المشروبات مقابل مشروب هدية</small></span><div class="seg" id="ln">${[5, 6, 8, 10].map((n) => `<button data-n="${n}" class="${s.settings.loyalNeed === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <div class="set-row"><span><b>حد خصم الكاشير</b><small>ما يزيد عن ذلك يحتاج موافقة المشرف</small></span><span class="pill">10%</span></div></div>
        <div class="card"><div class="card__h"><h3><span class="label">Hardware</span>الأجهزة</h3></div>
          ${[['print', 'طابعة الفواتير', 'أي طابعة حرارية 80مم معرّفة على الجهاز — الطباعة من نافذة الطباعة', 'test-print'], ['drawer', 'درج الكاش', 'يفتح مع الطابعة (إعداد «فتح الدرج» في تعريف الطابعة)', ''], ['card', 'جهاز الشبكة (مدى)', 'جهاز منفصل — المبلغ يُكتب على الجهاز', ''], ['scan', 'قارئ الباركود', 'يعمل مباشرة كلوحة مفاتيح', ''], ['user', 'شاشة العميل', 'شاشة ثانية على نفس الجهاز أو تابلت مربوط (Devices)', 'test-screen']].map(([ic, t, d, a]) => `<div class="dev"><span class="dev__i">${I(ic)}</span><span class="dev__b"><b>${t}</b><small>${d}</small></span>${a ? `<button class="btn btn--soft btn--sm" data-test="${a}">${a === 'test-print' ? 'اطبع تجربة' : 'افتح'}</button>` : ''}</div>`).join('')}</div>
        <div class="card"><div class="card__h"><h3><span class="label">Data</span>البيانات</h3></div>
          <div class="set-row"><span><b>نسخة احتياطية</b><small>ملف فيه الإعدادات والموظفين والعملاء والمخزون وكل الأيام المؤرشفة (${days} يوم)</small></span><button class="btn btn--ghost btn--sm" id="backup">${I('download', 'sm')}${bi('Download', 'تنزيل')}</button></div>
          <div class="set-row"><span><b>وضع التدريب</b><small>نسخة منفصلة بطلبات تجريبية وجولات تفاعلية — لا تلمس أرقام المحل</small></span><button class="btn btn--ghost btn--sm" id="train">${I('play', 'sm')}${bi('Open', 'افتح')}</button></div>
          <div class="set-row"><span><b>مسح كل البيانات</b><small>يرجع النظام لأول تشغيل — للمدير فقط</small></span><button class="btn btn--danger btn--sm" id="wipe">${bi('Reset', 'مسح')}</button></div></div>
        ${prepCards()}
      </div>
      <p class="muted" style="font-size:12px;margin-top:18px;text-align:center"><a href="https://a7madshiref001-ctrl.github.io/athr/" target="_blank" rel="noopener" lang="en">Built by ATHR</a></p>`;
    $$('[data-sw]', view).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.sw; D.mutate((st) => { st.settings[k] = !st.settings[k]; D.log(me, 'settings', `إعداد: ${k} — ${st.settings[k] ? 'تشغيل' : 'إيقاف'}`); }, 'set'); renderSettingsLive(view); }));
    $('#ln', view).addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; D.mutate((st) => { st.settings.loyalNeed = +b.dataset.n; D.log(me, 'settings', `كارت الولاء: كل ${b.dataset.n} مشروبات`); }, 'set'); renderSettingsLive(view); });
    $('#editStore', view).addEventListener('click', () => storeForm(() => renderSettingsLive(view)));
    $('#backup', view).addEventListener('click', backup);
    $('#train', view).addEventListener('click', () => D.setTraining(true));
    $('#wipe', view).addEventListener('click', wipeAll);
    if ($('#cloudBox', view) && window.DARJ_CONNECT) window.DARJ_CONNECT.panel($('#cloudBox', view), me);
    wirePrep(view, () => renderSettingsLive(view));
    $$('[data-test]', view).forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.test === 'test-print') { const o = D.today(S()).filter((x) => x.inv).slice(-1)[0]; if (o) D.print(D.receiptHTML(o, { copy: 1 })); else D.toast('لا توجد فواتير بعد', 'اطبع بعد أول عملية بيع', { warn: 1 }); }
      if (b.dataset.test === 'test-screen') window.open('screen.html?mode=cart', '_blank');
    }));
  }
  function storeForm(done) {
    const s = S();
    const vatOn0 = s.settings.vatOn !== false;
    const m = D.modal(`${D.head(bi('Store & tax', 'بيانات المحل والضريبة'), 'تظهر على كل فاتورة')}
      <div class="modal__b grid" style="gap:12px"><div class="grid g2"><label class="field"><span>اسم المحل (عربي)</span><input class="input" id="eAr" value="${esc(D.STORE.nameAr)}"></label><label class="field"><span>Store name</span><input class="input" id="eEn" value="${esc(D.STORE.nameEn || '')}"></label>
        <label class="field"><span>الفرع</span><input class="input" id="eBr" value="${esc(D.STORE.branchAr || '')}"></label><label class="field"><span>الهاتف</span><input class="input mono" id="ePh" value="${esc(D.STORE.phone || '')}"></label></div>
        <label class="field"><span>العنوان</span><input class="input" id="eAd" value="${esc(D.STORE.addr || '')}"></label>
        <div class="set-row"><span><b>مسجّل في ضريبة القيمة المضافة</b><small>لو مقفول يصدر إيصال بيع بدون ضريبة</small></span><button class="switch ${vatOn0 ? 'on' : ''}" id="eVatOn"></button></div>
        <div class="grid g2"><label class="field"><span>الرقم الضريبي</span><input class="input mono" id="eVat" maxlength="15" value="${esc(D.STORE.vat || '')}"></label><label class="field"><span>السجل التجاري</span><input class="input mono" id="eCr" value="${esc(D.STORE.cr || '')}"></label></div><div id="eErr"></div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--ink" id="eSave">${bi('Save', 'حفظ')}</button></div>`);
    let vatOn = vatOn0;
    $('#eVatOn', m).addEventListener('click', (e) => { vatOn = !vatOn; e.currentTarget.classList.toggle('on', vatOn); });
    $('#eSave', m).addEventListener('click', async () => {
      const g = (id) => $('#' + id, m).value.trim();
      if (vatOn && !/^3\d{13}3$/.test(g('eVat'))) { $('#eErr', m).innerHTML = `<div class="blind" style="color:var(--red)">${I('alert', 'sm')}<span>الرقم الضريبي 15 رقم، يبدأ وينتهي بـ3</span></div>`; return; }
      const u = await D.approve('settings', 'تعديل بيانات الفاتورة', me); if (!u) return;
      D.mutate((st) => { st.store = Object.assign({}, st.store, { nameAr: g('eAr'), sellerAr: g('eAr'), nameEn: g('eEn'), branchAr: g('eBr'), phone: g('ePh'), addr: g('eAd'), vat: vatOn ? g('eVat') : '', cr: g('eCr') }); st.settings.vatOn = vatOn; D.log(me, 'settings', 'تعديل بيانات المحل والضريبة', approverId(u), 'warn'); }, 'set');
      m.close(); done && done();
    });
  }
  async function backup() {
    let archive = [];
    try { archive = await D.archiveAll(); } catch (e) { /* */ }
    const data = { app: 'DARJ', store: D.STORE.nameEn, exportedAt: new Date().toISOString(), state: S(), archive };
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `backup-${(D.STORE.nameEn || 'store').replace(/\s+/g, '-').toLowerCase()}-${S().day}.json`; a.click();
    D.mutate(() => D.log(me, 'settings', `تنزيل نسخة احتياطية (${archive.length} يوم مؤرشف)`), 'set');
  }
  function wipeAll() {
    const m = D.modal(`${D.head(bi('Reset everything', 'مسح كل البيانات'), 'الفواتير والموظفين والعملاء والمخزون — لا يمكن التراجع')}
      <div class="modal__b"><div class="blind" style="color:var(--red)">${I('alert', 'sm')}<span>نزّل نسخة احتياطية الأول. اكتب كلمة «مسح» للتأكيد.</span></div><input class="input" id="wTxt" style="margin-top:12px"></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--danger" id="wGo">${bi('Reset', 'مسح نهائي')}</button></div>`, { cls: 'modal--sm' });
    $('#wGo', m).addEventListener('click', async () => {
      if ($('#wTxt', m).value.trim() !== 'مسح') { $('#wTxt', m).focus(); return; }
      const u = await D.approve('settings', 'مسح كل البيانات', me); if (!u) return;
      m.close(); D.reset(); try { sessionStorage.removeItem('darj:me'); } catch (e) { /* */ } location.reload();
    });
  }
  function renderSettings(view) {
    if (D.REAL) { renderSettingsLive(view); return; }
    view.className = 'view';
    const s = S();
    const sw = (k, on) => `<button class="switch ${on ? 'on' : ''}" data-sw="${k}"></button>`;
    view.innerHTML = `<div class="vh"><div><span class="label">Settings · ${esc(D.STORE.branchEn)}</span><h1>Setup</h1><p>بيانات المنشأة والضريبة والأجهزة وطريقة التشغيل.</p></div></div>
      <div class="grid g2" style="align-items:start">
        <div class="card"><div class="card__h"><h3><span class="label">${D.vatOn() ? 'Tax · ZATCA' : 'Business'}</span>${D.vatOn() ? 'المنشأة والفوترة الإلكترونية' : 'بيانات المنشأة'}</h3></div>
          <div class="set-row"><span><b>اسم المنشأة على الفاتورة</b><small>${esc(D.STORE.sellerAr)}</small></span></div>
          ${D.vatOn() ? `<div class="set-row"><span><b>الرقم الضريبي</b><small class="mono">${D.STORE.vat}</small></span><span class="pill">رقم تجريبي</span></div>` : `<div class="set-row"><span><b>غير مسجّل في الضريبة</b><small>يصدر إيصال بيع بدون ضريبة ولا QR</small></span><span class="pill">إيصال</span></div>`}
          ${D.vatOn() ? `<div class="set-row"><span><b>فاتورة ضريبية مبسطة + QR</b><small>المرحلة الأولى (الإصدار): اسم البائع، الرقم الضريبي، الوقت، الإجمالي، الضريبة</small></span><span class="pill pill--go">${I('check', 'sm')} مفعّل</span></div>` : ''}
          ${D.vatOn() ? `<div class="set-row"><span><b>الربط مع منصة «فاتورة» — المرحلة الثانية</b><small>تسجيل الجهاز (CSID)، الختم التشفيري، والإبلاغ عن الفواتير المبسطة خلال 24 ساعة</small></span><span class="pill pill--amber">يتفعّل عند التشغيل</span></div>` : ''}
          <div class="set-row"><span><b>${D.noteName().ar} لكل مرتجع</b><small>برقم تسلسلي ومرتبط بالفاتورة الأصلية</small></span><span class="pill pill--go">${I('check', 'sm')}</span></div>
        </div>
        <div class="card"><div class="card__h"><h3><span class="label">Hardware</span>الأجهزة</h3></div>
          ${[['print', 'طابعة الفواتير 80مم', 'حرارية — متصلة بالشبكة', 'test-print'], ['cup', 'طابعة تذاكر الباريستا', 'تذكرة لكل مشروب بالإضافات', 'test-kds'], ['drawer', 'درج الكاش', 'يفتح تلقائيًا مع الدفع النقدي', 'test-drawer'], ['card', 'جهاز الشبكة (مدى)', D.LIVE ? 'جهاز منفصل — المبلغ يُكتب على الجهاز' : 'يُرسل المبلغ للجهاز دون إدخال يدوي', 'test-card'], ['scan', 'قارئ الباركود', 'للبن المعبّى والمنتجات', 'test-scan'], ['user', 'شاشة العميل', 'الطلب والإجمالي والأختام', 'test-screen']].map(([ic, t, d, a]) => `<div class="dev"><span class="dev__i">${I(ic)}</span><span class="dev__b"><b>${t}</b><small>${d}</small></span><span class="pill pill--go"><i class="dot"></i> متصل</span><button class="btn btn--soft btn--sm" data-test="${a}">اختبار</button></div>`).join('')}
          <p class="muted" style="font-size:12px;margin-top:8px">الأجهزة في النسخة التجريبية محاكاة، وفي التشغيل الفعلي تُربط حسب أجهزة المحل.</p></div>
        <div class="card"><div class="card__h"><h3><span class="label">Operations</span>طريقة التشغيل</h3></div>
          <div class="set-row"><span><b>نشاط لايف في الديمو</b><small>طلبات QR والكاشير 2 تصل تلقائيًا كل فترة</small></span>${sw('live', s.settings.live)}</div>
          <div class="set-row"><span><b>قبول تلقائي لطلبات QR والموقع</b><small>تصل للباريستا مباشرة</small></span>${sw('autoAccept', s.settings.autoAccept)}</div>
          <div class="set-row"><span><b>صوت التنبيهات</b><small>طلب جديد، طلب جاهز، قارئ الباركود</small></span>${sw('sound', s.settings.sound)}</div>
          <div class="set-row"><span><b>طباعة الفاتورة تلقائيًا</b><small>بعد كل عملية دفع</small></span>${sw('printer', s.settings.printer)}</div>
          <div class="set-row"><span><b>كارت الولاء</b><small>عدد المشروبات مقابل مشروب هدية</small></span><div class="seg" id="ln">${[6, 8, 10].map((n) => `<button data-n="${n}" class="${s.settings.loyalNeed === n ? 'on' : ''}">${n}</button>`).join('')}</div></div>
          <div class="set-row"><span><b>حد خصم الكاشير</b><small>ما يزيد عن ذلك يحتاج موافقة المشرف</small></span><span class="pill">10%</span></div>
        </div>
        <div class="card"><div class="card__h"><h3><span class="label">Demo</span>بيانات العرض</h3></div>
          <div class="set-row"><span><b>جرّب انقطاع الإنترنت</b><small>البيع يستمر بدون اتصال ويتزامن عند عودته</small></span><button class="btn btn--ghost btn--sm" id="off">${I(s.settings.offline ? 'wifi' : 'wifioff', 'sm')} ${s.settings.offline ? 'أعِد الاتصال' : 'اقطع الاتصال'}</button></div>
          <div class="set-row"><span><b>ابدأ يوم جديد</b><small>يعيد البيانات لحالتها الأولى (طلبات اليوم من الصباح حتى الآن)</small></span><button class="btn btn--danger btn--sm" id="reset">إعادة ضبط</button></div>
          <p class="muted" style="font-size:12px;margin-top:8px">كل الأسماء والأرقام والطلبات هنا وهمية، ولا تخرج أي بيانات من الجهاز.</p></div>
        ${prepCards()}
      </div>`;
    $$('[data-sw]', view).forEach((b) => b.addEventListener('click', () => { const k = b.dataset.sw; D.mutate((st) => { st.settings[k] = !st.settings[k]; D.log(me, 'settings', `إعداد: ${k} — ${st.settings[k] ? 'تشغيل' : 'إيقاف'}`); }, 'set'); renderSettings(view); }));
    $('#ln', view).addEventListener('click', (e) => { const b = e.target.closest('[data-n]'); if (!b) return; D.mutate((st) => { st.settings.loyalNeed = +b.dataset.n; }, 'set'); renderSettings(view); });
    $('#off', view).addEventListener('click', toggleNet);
    wirePrep(view, () => renderSettings(view));
    $('#reset', view).addEventListener('click', () => { D.reset(); clearCart(); D.toast('بدأ يوم جديد', 'عادت البيانات لحالتها الأولى', { ic: 'sync' }); render(); });
    $$('[data-test]', view).forEach((b) => b.addEventListener('click', () => {
      const t = b.dataset.test;
      if (t === 'test-print') { const o = S().orders.slice(-1)[0]; if (o) showReceipt(o, true); }
      if (t === 'test-drawer') { D.drawerPop('اختبار الدرج — فُتح'); D.sound('ok'); }
      if (t === 'test-scan') { D.sound('beep'); D.toast('القارئ يعمل', 'جرّب: اكتب 6287001200014 في البحث واضغط Enter', { ic: 'scan' }); }
      if (t === 'test-card') D.toast(D.LIVE ? 'جهاز الشبكة منفصل' : 'جهاز الشبكة متصل', D.LIVE ? 'المبلغ يُكتب على الجهاز' : 'آخر تسوية: اليوم 2:00 م', { ic: 'card' });
      if (t === 'test-kds') D.toast('طُبعت تذكرة اختبار', 'على طابعة البار', { ic: 'print' });
      if (t === 'test-screen') window.open('screen.html?mode=cart', '_blank');
    }));
  }


  /* =====================================================================
     STATIONS · KIOSK · DEVICES — توجيه الأصناف، والكشك، وربط الشاشات (جوه الإعدادات)
     ===================================================================== */
  const LNK = () => window.DARJ_LINK || { ok: false, peers: [], status: 'off', on: () => () => {} };
  const SCREENS = [
    { id: 'bar', page: 'kds.html?st=bar', ic: 'cup', en: 'Barista screen', ar: 'شاشة الباريستا', sub: 'المشروبات فقط — تابلت بجانب المكينة', role: 'kds', st: 'bar' },
    { id: 'kitchen', page: 'kds.html?st=kitchen', ic: 'flame', en: 'Kitchen screen', ar: 'شاشة المطبخ', sub: 'الطعام والحلا فقط — تابلت داخل المطبخ', role: 'kds', st: 'kitchen' },
    { id: 'board', page: 'screen.html', ic: 'tv', en: 'Order status board', ar: 'شاشة حالة الطلبات', sub: 'للعملاء: في الانتظار · قيد التحضير · جاهز', role: 'board' },
    { id: 'cart', page: 'screen.html?mode=cart', ic: 'user', en: 'Customer display', ar: 'شاشة العميل عند الكاشير', sub: 'الطلب والإجمالي وقت الدفع', role: 'cart' },
    { id: 'kiosk', page: 'kiosk.html', ic: 'kiosk', en: 'Self-order kiosk', ar: 'كشك الطلب والدفع الذاتي', sub: 'آيباد في المحل — العميل يطلب ويدفع بنفسه', role: 'kiosk' },
  ];
  const peersOf = (sc) => LNK().peers.filter((p) => p.role === sc.role && (!sc.st || p.st === sc.st));
  function routeSeg(cur, attr, def) {
    return `<div class="seg rt-seg">${def ? `<button data-${attr}="" class="${!cur ? 'on' : ''}" title="مثل القسم">${I('link', 'sm')}<span>Section</span></button>` : ''}${Object.entries(D.ROUTE).map(([k, r]) => `<button data-${attr}="${k}" class="${cur === k ? 'on' : ''}" title="${r.ar}">${I(r.ic, 'sm')}<span>${r.en}</span></button>`).join('')}</div>`;
  }
  let rtOpen = '';
  function routesCard() {
    const s = S(); const R = s.routes || {};
    const n = { bar: 0, kitchen: 0, both: 0, none: 0 };
    D.PRODUCTS.forEach((p) => { n[D.routeOf(s, p)]++; });
    const cats = D.CATS.filter((c) => D.PRODUCTS.some((p) => p.cat === c.id));
    return `<div class="card card--wide" id="rtCard"><div class="card__h"><h3><span class="label">Stations · Routing</span>أين يُحضَّر كل صنف؟</h3><span class="pill">${n.bar + n.both} للباريستا · ${n.kitchen + n.both} للمطبخ</span></div>
      <div class="rt-hero">
        <div class="rt-hero__o">${I('orders')}${bi('Order', 'طلب واحد')}<small>2× سبانش لاتيه · 1× كوكيز</small></div>
        <svg class="rt-hero__arr" viewBox="0 0 120 80" aria-hidden="true"><path d="M8 40 C46 40 52 14 104 14"/><path d="M8 40 C46 40 52 66 104 66"/><path d="M96 8l9 6-9 6M96 60l9 6-9 6"/></svg>
        <div class="rt-hero__s"><div>${I('cup')}<span>${bi('Barista', 'الباريستا')}<small>2× سبانش لاتيه</small></span></div><div>${I('flame')}<span>${bi('Kitchen', 'المطبخ')}<small>1× كوكيز</small></span></div></div>
        <p>الطلب ينقسم تلقائيًا: كل شاشة ترى نصيبها فقط، وتحته سطر صغير بنصيب الشاشة الأخرى. ويظهر الطلب للعميل <b>«جاهز»</b> عندما تنتهي الشاشتان. اختر لكل قسم مكان تحضيره، وإذا كان صنف معيّن مختلفًا افتح القسم وغيّره وحده.</p>
      </div>
      <div class="rt-list">${cats.map((c) => {
        const items = D.PRODUCTS.filter((p) => p.cat === c.id);
        const cur = (R.cats && R.cats[c.id]) || D.catDefRoute(c.id);
        const own = items.filter((p) => R.items && R.items[p.id]).length;
        const mixed = new Set(items.map((p) => D.routeOf(s, p))).size > 1;
        return `<div class="rt-row${rtOpen === c.id ? ' open' : ''}"><button class="rt-cat" data-rto="${c.id}">${I(c.ic || 'cup')}${bi(esc(c.en), `${esc(c.ar)} · ${items.length} صنف${own ? ` · ${own} مختلف` : mixed ? ' · مختلط' : ''}`)}${I('chev', 'sm rt-chev')}</button><div data-rtcat="${c.id}">${routeSeg(cur, 'rc')}</div></div>
          ${rtOpen === c.id ? `<div class="rt-items">${items.map((p) => `<div class="rt-item"><span class="thumb" ${D.img(p) ? `style="background-image:url('${D.img(p)}')"` : ''}></span><span class="rt-item__n"><b>${esc(p.ar)}</b><small>${esc(p.en)}${R.items && R.items[p.id] ? '' : ` · مثل القسم (${D.ROUTE[D.routeOf(s, p)].ar})`}</small></span><div data-rtitem="${p.id}">${routeSeg(R.items && R.items[p.id], 'ri', true)}</div></div>`).join('')}</div>` : ''}`;
      }).join('')}</div></div>`;
  }
  function kioskCard() {
    const s = S(); const k = D.kioskCfg(s); const card = D.kioskCard();
    const sw = (key, on) => `<button class="switch ${on ? 'on' : ''}" data-ksw="${key}"></button>`;
    return `<div class="card"><div class="card__h"><h3><span class="label">Kiosk · Self-order</span>الكشك — طلب ودفع ذاتي</h3><span class="pill ${k.on ? 'pill--go' : ''}">${k.on ? 'يعمل' : 'متوقف'}</span></div>
      <div class="set-row"><span><b>تشغيل الكشك</b><small>الآيباد في المحل يعرض المنيو، والعميل يطلب دون الرجوع للكاشير</small></span>${sw('on', k.on)}</div>
      <div class="set-row"><span><b>الدفع بالبطاقة على الكشك</b><small>${card ? (D.REAL ? 'مربوط بشركة الدفع' : 'في التدريب الدفع محاكاة — والطلب ينتقل للتحضير فور الدفع') : 'يتفعّل بعد الربط مع شركة دفع (جهاز مدى أو بوابة دفع). حتى ذلك الحين: الدفع عند الكاشير'}</small></span>${card ? sw('card', k.card) : '<span class="pill pill--amber">بعد الربط</span>'}</div>
      <div class="set-row"><span><b>الدفع عند الكاشير</b><small>الطلب يصل هنا في Orders، وبعد التحصيل ينتقل للتحضير تلقائيًا</small></span>${sw('counter', k.counter)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><a class="btn btn--ghost btn--sm" href="kiosk.html" target="_blank">${I('kiosk', 'sm')}${bi('Open kiosk', 'افتح الكشك هنا')}</a>${LNK().ok ? `<button class="btn btn--ink btn--sm" data-pair="kiosk">${I('qr', 'sm')}${bi('Pair an iPad', 'اربط آيباد')}</button>` : ''}</div></div>`;
  }
  function devicesCard() {
    const L = LNK();
    const stTxt = !L.ok ? ['', 'على نفس الجهاز فقط'] : L.status === 'on' ? ['go', 'Live · الربط يعمل'] : L.status === 'err' ? ['red', 'لا يوجد اتصال'] : ['amber', 'جارٍ الاتصال…'];
    return `<div class="card card--wide" id="devCard"><div class="card__h"><h3><span class="label">Devices · Link</span>الشاشات والأجهزة المربوطة</h3><span class="pill${stTxt[0] ? ' pill--' + stTxt[0] : ''}" id="lnkSt">${L.status === 'on' ? '<i class="dot pulse"></i>' : ''}${stTxt[1]}</span></div>
      <div class="blind" style="margin-bottom:12px">${I('link', 'sm')}<span>${L.ok ? 'كل شاشة تُربط مرة واحدة: اضغط <b>Pair</b> وامسح الكود من الجهاز الآخر (آيباد أو تابلت أو شاشة). بعدها يصلها كل طلب لحظة بلحظة، ما دام الكاشير مفتوحًا والإنترنت متصلًا.' : 'الشاشات تعمل كتبويبات على نفس جهاز الكاشير. الربط بين أجهزة مختلفة يتفعّل مع إعداد الربط (connect).'}</span></div>
      <div class="devs">${SCREENS.map((sc) => { const on = peersOf(sc).length; return `<div class="devx${on ? ' on' : ''}"><span class="dev__i">${I(sc.ic)}</span><span class="devx__b">${bi(sc.en, sc.ar)}<small>${sc.sub}</small><span class="devx__st">${on ? `<i class="dot pulse"></i> ${on === 1 ? 'جهاز واحد متصل' : on + ' أجهزة متصلة'}` : L.ok ? 'غير متصلة' : ''}</span></span><span class="devx__a"><a class="btn btn--ghost btn--sm" href="${sc.page}" target="_blank">${bi('Open', 'هنا')}</a>${L.ok ? `<button class="btn btn--ink btn--sm" data-pair="${sc.id}">${I('qr', 'sm')}${bi('Pair', 'ربط جهاز')}</button>` : ''}</span></div>`; }).join('')}</div>
      ${L.ok ? `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:12px;flex-wrap:wrap"><small class="muted">إذا ضاع جهاز أو تغيّر: «إلغاء ربط الكل» يغيّر المفتاح، وتحتاج كل الشاشات إلى ربط من جديد.</small><button class="btn btn--danger btn--sm" id="lnkRot">${bi('Unlink all', 'إلغاء ربط الكل')}</button></div>` : ''}</div>`;
  }
  function pairModal(id) {
    const sc = SCREENS.find((x) => x.id === id); const L = LNK();
    if (!L.ok || !L.secret || !L.secret()) { D.toast('الربط غير جاهز', 'انتظر ثوانٍ حتى يتصل الكاشير', { warn: 1 }); return; }
    const url = L.pairUrl(sc.page);
    const m = D.modal(`${D.head(bi('Pair · ' + sc.en, sc.ar), 'امسح الكود من الجهاز الذي سيصبح هذه الشاشة')}
      <div class="modal__b"><div class="pairq"><div class="pairq__qr">${D.qrSVG(url)}</div>
        <ol class="pairq__steps"><li><b>افتح الكاميرا</b> على الآيباد أو التابلت، وامسح الكود.</li><li><b>ستفتح الشاشة وتُربط تلقائيًا</b> — وتبقى مربوطة حتى لو أُغلقت.</li><li><b>من Safari:</b> مشاركة ← «إضافة إلى الشاشة الرئيسية» لتفتح بملء الشاشة.</li></ol></div>
        <div class="blind" style="margin-top:12px">${I('lock', 'sm')}<span>هذا الكود يحتوي على مفتاح المحل — لا ترسله لأحد خارج المحل.</span></div></div>
      <div class="modal__f"><button class="btn btn--ghost" id="cp">${I('link', 'sm')}${bi('Copy link', 'انسخ الرابط')}</button><button class="btn btn--ink" data-close>${bi('Done', 'تم')}</button></div>`, { cls: 'modal--sm' });
    $('#cp', m).addEventListener('click', () => { try { navigator.clipboard.writeText(url); D.toast('تم نسخ الرابط', 'افتحه على الجهاز الآخر', { ic: 'link' }); } catch (e) { /* */ } });
    const before = peersOf(sc).map((p) => p.dev);
    const off = L.on(() => { if (!m.isConnected) { off(); return; } if (peersOf(sc).some((p) => !before.includes(p.dev))) { off(); D.sound('ok'); D.toast(`تم ربط ${sc.ar}`, 'ستصلها الطلبات لحظة بلحظة', { ic: 'link' }); m.close(); } });
  }
  function soundCard() {
    const st = S().settings; const cur = st.orderTone || 'bell', vol = st.orderVol || 2, rep = st.orderRepeat == null ? 1 : st.orderRepeat;
    return `<div class="card"><div class="card__h"><h3><span class="label">Order sound</span>صوت الطلبات الجديدة</h3></div>
      <div class="tones">${D.TONES.map((t) => `<div class="tone${t.id === cur ? ' on' : ''}"><button class="tone__pick" data-tone="${t.id}">${I(t.id === cur ? 'check' : 'bell', 'sm')}<span class="bi"><b>${t.en}</b><small>${t.ar}</small></span><small class="t">${t.sub}</small></button><button class="tone__play" data-play="${t.id}" aria-label="جرّب ${t.ar}" title="جرّب">${I('play', 'sm')}</button></div>`).join('')}</div>
      <div class="set-row"><span><b>علو الصوت</b><small>لو لسه واطي، ارفع صوت الجهاز نفسه كمان</small></span><div class="seg" id="tvol">${D.TONE_VOLS.map(([v, en, ar]) => `<button data-v="${v}" class="${vol === v ? 'on' : ''}">${bi(en, ar)}</button>`).join('')}</div></div>
      <div class="set-row"><span><b>عدد المرات</b><small>«لحد الرد» بيعيد الصوت كل 15 ثانية لحد ما الطلب يتقبل أو يبدأ تحضيره</small></span><div class="seg" id="trep">${D.TONE_REPS.map(([v, en, ar]) => `<button data-v="${v}" class="${rep === v ? 'on' : ''}">${bi(en, ar)}</button>`).join('')}</div></div>
      <button class="btn btn--ghost btn--block" id="ttest" style="margin-top:10px">${I('volume', 'sm')}${bi('Test new-order sound', 'جرّب صوت طلب جديد')}</button></div>`;
  }
  const prepCards = () => soundCard() + routesCard() + kioskCard() + devicesCard();
  function wireDevices(root) {
    root.querySelectorAll('#devCard [data-pair], [data-pair="kiosk"]').forEach((b) => { if (b._w) return; b._w = 1; b.addEventListener('click', () => pairModal(b.dataset.pair)); });
    const rot = root.querySelector('#lnkRot');
    if (rot && !rot._w) { rot._w = 1; rot.addEventListener('click', async () => { const u = await D.approve('settings', 'إلغاء ربط كل الشاشات', me); if (!u) return; LNK().rotate(); D.toast('تم إلغاء ربط كل الشاشات', 'اربط كل شاشة من جديد عبر Pair', { ic: 'link' }); }); }
  }
  function wirePrep(view, again) {
    const setSnd = (k, v, msg) => { D.mutate((st) => { st.settings[k] = v; D.log(me, 'settings', msg); }, 'set'); };
    const previewNow = () => { const st = S().settings; D.playTone(st.orderTone || 'bell', st.orderVol || 2, 1); };
    view.querySelectorAll('[data-tone]').forEach((b) => b.addEventListener('click', () => { const t = D.TONES.find((x) => x.id === b.dataset.tone); setSnd('orderTone', t.id, `صوت الطلبات: ${t.ar}`); previewNow(); again(); }));
    view.querySelectorAll('[data-play]').forEach((b) => b.addEventListener('click', () => D.playTone(b.dataset.play, S().settings.orderVol || 2, 1)));
    const tv = view.querySelector('#tvol'); if (tv) tv.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; setSnd('orderVol', +b.dataset.v, `علو صوت الطلبات: ${b.innerText.replace(/\s+/g, ' ')}`); previewNow(); again(); });
    const tr = view.querySelector('#trep'); if (tr) tr.addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (!b) return; setSnd('orderRepeat', +b.dataset.v, `تكرار صوت الطلبات: ${b.innerText.replace(/\s+/g, ' ')}`); again(); });
    const tt = view.querySelector('#ttest'); if (tt) tt.addEventListener('click', () => { const st = S().settings; D.playTone(st.orderTone || 'bell', st.orderVol || 2, st.orderRepeat || 1); });
    view.querySelectorAll('[data-rto]').forEach((b) => b.addEventListener('click', () => { rtOpen = rtOpen === b.dataset.rto ? '' : b.dataset.rto; again(); }));
    view.querySelectorAll('[data-rtcat] [data-rc]').forEach((b) => b.addEventListener('click', () => {
      const cat = b.closest('[data-rtcat]').dataset.rtcat; const r = b.dataset.rc;
      D.mutate((st) => { st.routes = st.routes || {}; st.routes.cats = Object.assign({}, st.routes.cats, { [cat]: r }); D.log(me, 'settings', `توجيه قسم «${(D.CATS.find((c) => c.id === cat) || {}).ar}» ← ${D.ROUTE[r].ar}`); }, 'set');
      again();
    }));
    view.querySelectorAll('[data-rtitem] [data-ri]').forEach((b) => b.addEventListener('click', () => {
      const pid = b.closest('[data-rtitem]').dataset.rtitem; const r = b.dataset.ri;
      D.mutate((st) => { st.routes = st.routes || {}; st.routes.items = Object.assign({}, st.routes.items); if (r) st.routes.items[pid] = r; else delete st.routes.items[pid]; D.log(me, 'settings', `توجيه صنف «${D.prod(pid).ar}» ← ${r ? D.ROUTE[r].ar : 'مثل القسم'}`); }, 'set');
      again();
    }));
    view.querySelectorAll('[data-ksw]').forEach((b) => b.addEventListener('click', () => {
      const k = b.dataset.ksw;
      D.mutate((st) => { const cur = D.kioskCfg(st); cur[k] = !cur[k]; if (k !== 'on' && !cur.card && !cur.counter) cur[k === 'card' ? 'counter' : 'card'] = true; st.settings.kiosk = cur; D.log(me, 'settings', `الكشك: ${k} — ${cur[k] ? 'تشغيل' : 'إيقاف'}`); }, 'set');
      again();
    }));
    wireDevices(view);
    // حالة الأجهزة بتتحدّث لوحدها من غير ما الصفحة تتعاد
    const L = LNK(); if (!L.on) return;
    const off = L.on(() => {
      const c = view.querySelector('#devCard'); if (!c || !c.isConnected) { off(); return; }
      const tmp = document.createElement('div'); tmp.innerHTML = devicesCard(); c.replaceWith(tmp.firstElementChild); wireDevices(view);
    });
  }

  /* =====================================================================
     GUIDE — جولات تفاعلية: النظام بينوّر المكان اللي تضغطه، وبيمشي معاك خطوة بخطوة
     ===================================================================== */
  const has = (sel) => !!$(sel);
  const TP = Object.assign({ drink: 'span', drink2: 'latte', food: 'cookie', food2: 'brownie', dessert: 'sanseb', mod: 'oat', drinkName: 'سبانش لاتيه', foodName: 'كوكيز', modName: 'حليب الشوفان' }, D.CFG.tour || {});
  const toSell = () => { cat = 'all'; q = ''; go('sell'); };
  const ensureShift = () => { if (!D.openShift(S(), 1)) D.mutate((st) => { st.shifts.push({ id: 'sh' + D.uid(), reg: 1, user: me, open: Date.now(), float: 500, close: null }); D.log(me, 'shift', 'فتح وردية بعهدة 500.00 ر.س'); }, 'shift'); };
  const freshCart = () => { if (cart.lines.length) holdCart(); cart.credit = null; };
  const addQuick = (pid) => { cart.lines.push({ key: D.uid(), at: Date.now(), pid, qty: 1, mods: D.defMods(D.prod(pid)) }); };
  const demoOrder = (name) => {
    ensureShift();
    const lines = [{ pid: TP.drink, qty: 1, mods: D.defMods(D.prod(TP.drink)) }, { pid: TP.food, qty: 1, mods: D.defMods(D.prod(TP.food)) }];
    const c = D.calc(S(), lines, null);
    return D.placeOrder({ lines, type: 'takeaway', staff: me, pays: [{ m: 'mada', a: c.total, auth: String(100000 + Math.floor(Math.random() * 899999)) }], name: name || 'فهد' });
  };
  const ensureOrder = () => {
    const o = S().orders.filter((x) => x.reg === 1 && x.ch === 'counter' && D.canRefund(x) && !x.refunded && x.lines.length >= 2).slice(-1)[0];
    return o && Date.now() - o.ts < 30 * 60000 ? o : demoOrder();
  };
  const cols = (c) => $$(`.kt[data-col="${c}"]`).length;
  const TOURS = [
    { id: 'sell', en: 'Sell a coffee', ar: 'اطلب قهوة وادفع بالبطاقة', ic: 'cup', min: 1,
      setup() { ensureShift(); freshCart(); toSell(); },
      steps: [
        { sel: `[data-p="${TP.drink}"]`, en: 'Pick', ar: `اضغط على «${TP.drinkName}» — كل صنف بصورته وسعره.`, wait: () => has('.modal .mod-hero') },
        { sel: `.modal [data-o="${TP.mod}"]`, en: 'Customize', ar: `اختر ${TP.modName}، والسعر يتحدّث تلقائيًا.`, wait: () => has(`.modal [data-o="${TP.mod}"].on`) },
        { sel: '.modal #add', en: 'Add', ar: 'أضف الصنف للطلب.', wait: () => !has('.ovl') && cart.lines.length > 0 },
        { sel: '#pay', en: 'Charge', ar: 'اضغط Charge للدفع.', wait: () => has('.modal .tenders') },
        { sel: '.modal #take', en: D.LIVE ? 'Confirm paid' : 'Send to terminal', ar: D.LIVE ? 'اكتب المبلغ على جهاز مدى، وبعد الموافقة اضغط هنا.' : 'المبلغ يُرسل لجهاز مدى تلقائيًا، بدون كتابة يدوية.', wait: () => has('.modal .rc-stage') },
        { sel: '.modal .rc-stage .receipt', en: 'Receipt', ar: D.vatOn() ? 'الفاتورة الضريبية بـQR هيئة الزكاة، والطلب وصل لشاشة الباريستا.' : 'الإيصال جاهز، والطلب وصل لشاشة الباريستا.', next: 1 },
      ] },
    { id: 'split', en: 'Split the bill', ar: 'جزء بالبطاقة والباقي كاش', ic: 'card', min: 1,
      setup() { ensureShift(); freshCart(); addQuick(TP.drink); addQuick(TP.dessert); toSell(); },
      steps: [
        { sel: '#pay', en: 'Charge', ar: 'افتح شاشة الدفع.', wait: () => has('.modal .tenders') },
        { sel: '.modal #amt', en: 'Part on card', ar: 'اكتب 20 — هذا الجزء على مدى، ثم اضغط Next.', next: 1 },
        { sel: '.modal #take', en: D.LIVE ? 'Confirm' : 'Send', ar: D.LIVE ? 'بعد دفع الجزء الأول على الجهاز، اضغط هنا.' : 'أرسل الجزء الأول للجهاز.', wait: () => has('.modal .paid-list') },
        { sel: '.modal #take', en: 'Rest in cash', ar: 'النظام انتقل للكاش تلقائيًا — استلم الباقي والدرج يفتح.', wait: () => has('.modal .rc-stage') },
        { sel: '.modal .rc-stage .receipt', en: 'Two tenders', ar: 'الفاتورة فيها الطريقتين، والباقي للعميل ظاهر.', next: 1 },
      ] },
    { id: 'refund', en: 'Refund an order', ar: 'رجّع صنف أو الطلب كله', ic: 'refund', min: 1,
      setup() { ensureOrder(); toSell(); },
      steps: [
        { sel: '#rfnd', en: 'Refund', ar: 'زر Refund موجود دائمًا في شاشة البيع.', wait: () => has('.modal [data-fo]') },
        { sel: '.modal [data-fo]', en: 'Find the order', ar: 'اختر الطلب — أو ابحث برقم الفاتورة أو امسح QR الفاتورة.', wait: () => has('.modal .rl') },
        { sel: '.modal .rl-item', en: 'Pick items', ar: 'اضغط الصنف المرتجع، أو «Whole order» للطلب كله.', wait: () => has('.modal .rl-item.on') },
        { sel: '.modal #wzNext', en: 'Next', ar: 'التالي.', wait: () => has('.modal [data-reason]') },
        { sel: '.modal .picks', en: 'Reason', ar: 'اختر السبب — وتحته يظهر ماذا يحدث للمخزون تلقائيًا.', wait: () => has('.modal [data-reason].on') },
        { sel: '.modal #wzNext', en: 'Next', ar: 'التالي.', wait: () => has('.modal [data-how]') },
        { sel: '.modal .picks', en: 'Refund to', ar: 'نفس طريقة الدفع، أو كاش، أو استبدال بصنف آخر. ثم Next.', next: 1 },
        { sel: '.modal #wzGo', en: 'Approve', ar: 'نفّذ المرتجع. الكاشير يحتاج PIN المشرف.', wait: () => has('.modal .chk') },
        { sel: '.modal .rc-stage .receipt', en: 'Credit note', ar: D.noteName().ar + ' مرتبط بالفاتورة، والصنف شُطب عند الباريستا.', next: 1 },
      ] },
    { id: 'exchange', en: 'Exchange a drink', ar: 'رجّع مشروب وخذ بديله', ic: 'swap', min: 2,
      setup() { ensureOrder(); toSell(); },
      steps: [
        { sel: '#rfnd', en: 'Refund', ar: 'الاستبدال يبدأ من زر Refund.', wait: () => has('.modal [data-fo]') },
        { sel: '.modal [data-fo]', en: 'Find the order', ar: 'اختر الطلب.', wait: () => has('.modal .rl') },
        { sel: '.modal .rl-item', en: 'Pick the drink', ar: 'اختر المشروب المراد استبداله.', wait: () => has('.modal .rl-item.on') },
        { sel: '.modal #wzNext', en: 'Next', ar: 'التالي.', wait: () => has('.modal [data-reason]') },
        { sel: '.modal [data-reason="wrong"]', en: 'Reason', ar: 'السبب: غير مطابق للطلب.', wait: () => has('.modal [data-reason].on') },
        { sel: '.modal #wzNext', en: 'Next', ar: 'التالي.', wait: () => has('.modal [data-how]') },
        { sel: '.modal [data-how="exchange"]', en: 'Exchange', ar: 'اختر Exchange — المبلغ يتحول لرصيد للطلب الجديد.', wait: () => has('.modal [data-how="exchange"].on') },
        { sel: '.modal #wzGo', en: 'Approve', ar: 'نفّذ.', wait: () => has('.modal #pickNew') },
        { sel: '.modal #pickNew', en: 'Pick the new item', ar: 'ارجع لشاشة البيع والرصيد معك.', wait: () => !has('.ovl') && !!cart.credit },
        { sel: '.credit', en: 'Credit in cart', ar: 'الرصيد ظاهر في السلة. اختر المشروب الجديد.', wait: () => cart.lines.length > 0 && !has('.ovl') },
        { sel: '#pay', en: 'Charge', ar: 'الرصيد يُخصم أولًا، والفرق يُدفع أو يرجع كاش.', wait: () => has('.modal .pay__due') || has('.modal #fin') },
        { sel: '.modal .modal__b', en: 'Done', ar: 'كمّل الدفع — الاستبدال تم ومسجّل على نفس الإشعار.', next: 1 },
      ] },
    { id: 'hold', en: 'Hold & resume', ar: 'علّق طلب وارجع له', ic: 'pause', min: 1,
      setup() { ensureShift(); freshCart(); addQuick(TP.drink2); toSell(); },
      steps: [
        { sel: '#hold', en: 'Hold', ar: 'العميل ما زال يختار؟ علّق طلبه وخدّم من بعده.', wait: () => has('[data-hold]') && !cart.lines.length },
        { sel: '[data-hold]', en: 'Resume', ar: 'الطلب المعلّق هنا — ارجع له بضغطة.', wait: () => cart.lines.length > 0 },
        { sel: '#lines', en: 'Back in cart', ar: 'رجع الطلب كما هو بإضافاته.', next: 1 },
      ] },
    { id: 'loyalty', en: 'Loyalty reward', ar: 'العميل برقم جواله وهديته', ic: 'gift', min: 1,
      setup() { ensureShift(); freshCart(); D.mutate((st) => { const c = st.customers.slice().sort((a, b) => b.visits - a.visits)[0]; c.rewards = Math.max(1, c.rewards || 0); }, 'cust'); addQuick(TP.drink); toSell(); },
      steps: [
        { sel: '#cust', en: 'Add customer', ar: 'أضف العميل برقم جواله.', wait: () => has('.modal [data-c]') },
        { sel: '.modal [data-c]', en: 'Pick', ar: 'اختر عبدالله — لديه مشروب هدية.', wait: () => !!cart.cust },
        { sel: '#redeem', en: 'Use free drink', ar: 'استخدم الهدية — المشروب الأرخص يصبح مجانًا.', wait: () => cart.lines.some((l) => l.reward) },
        { sel: '.cart__cust', en: 'Stamps', ar: 'كل مشروب = ختم، والهدية تُحسب تلقائيًا بدون بطاقات ورقية.', next: 1 },
      ] },
    { id: 'approve', en: 'Supervisor approval', ar: 'حذف صنف يحتاج PIN', ic: 'shield', min: 1,
      setup() { ensureShift(); freshCart(); addQuick(TP.food); addQuick(TP.food2); toSell(); },
      steps: [
        { sel: '.line[data-i="1"] [data-q="-1"]', en: 'Delete an item', ar: 'احذف صنفًا من السلة.', wait: () => has('.pin__dots') || cart.lines.length < 2 },
        { sel: '.ovl .pad', en: 'Supervisor PIN', ar: 'المشرف يكتب 2222 — والحركة تُسجَّل باسمه في سجل الحركات.', wait: () => !has('.pin__dots') },
        { sel: '#lines', en: 'Logged', ar: 'الحذف تم ومسجّل: من طلب، ومن وافق، ومتى.', next: 1 },
      ] },
    { id: 'offline', en: 'Internet cut', ar: 'البيع مستمر بدون إنترنت', ic: 'wifioff', min: 2,
      setup() { ensureShift(); freshCart(); if (S().settings.offline) D.goOffline(false, me); toSell(); },
      steps: [
        { sel: '#net', en: 'Connection', ar: 'اضغط مؤشر الاتصال لتجربة الانقطاع.', wait: () => has('.modal #cut') },
        { sel: '.modal #cut', en: 'Cut', ar: 'اقطع الاتصال.', wait: () => S().settings.offline },
        { sel: `[data-p="${TP.food}"]`, en: 'Keep selling', ar: `بِع عادي — اضغط «${TP.foodName}».`, wait: () => cart.lines.length > 0 },
        { sel: '#pay', en: 'Charge', ar: 'ادفع.', wait: () => has('.modal .tenders') },
        { sel: '.modal [data-m="cash"]', en: 'Cash', ar: 'اختر كاش.', wait: () => has('.modal [data-m="cash"].on') },
        { sel: '.modal #take', en: 'Take', ar: 'استلم — الفاتورة تُحفظ على الجهاز.', wait: () => has('.modal .rc-stage') },
        { sel: '.modal [data-close]', en: 'Close', ar: 'أغلق الفاتورة.', wait: () => !has('.ovl') },
        { sel: '#net', en: 'Back online', ar: 'اضغط هنا لعودة الاتصال — الفواتير تتزامن تلقائيًا.', wait: () => !S().settings.offline },
      ] },
    { id: 'shift', en: 'Close the shift', ar: 'قفل أعمى وتقرير Z', ic: 'lock', min: 2,
      setup() { ensureShift(); go('shift'); },
      steps: [
        { sel: '#close', en: 'Close shift', ar: 'آخر الوردية: اضغط Close shift.', wait: () => has('.modal .denoms') },
        { sel: '.modal .denoms', en: 'Blind count', ar: 'اكتب عدد كل فئة — المبلغ المتوقع مخفي حتى تنتهي.', next: 1 },
        { sel: '.modal #c1', en: 'Confirm', ar: 'أكّد العدّ.', wait: () => has('.modal .var-box') },
        { sel: '.modal .var-box', en: 'Over / short', ar: 'الآن فقط يظهر العجز أو الزيادة.', next: 1 },
        { sel: '.modal #c2', en: 'Z report', ar: 'اعتمد واطبع تقرير Z.', wait: () => !has('.modal .var-box') && has('.modal .receipt') },
        { sel: '.modal .receipt', en: 'Z report', ar: 'تقرير الإقفال: المبيعات بكل طريقة دفع، والعجز أو الزيادة.', next: 1 },
        { sel: '.modal [data-close]', en: 'Close', ar: 'أغلق التقرير.', wait: () => !has('.ovl') },
        { sel: '#open', en: 'Open shift', ar: 'افتح الوردية الجديدة بالعهدة.', wait: () => has('.modal #fl') },
        { sel: '.modal #ok', en: 'Float', ar: 'العهدة 500 — افتح.', wait: () => !!D.openShift(S(), 1) },
      ] },
    { id: 'barista', en: 'Barista screen', ar: 'الطلب من التحضير للتسليم', ic: 'kds', min: 1,
      setup() { demoOrder('ريان'); go('kds'); },
      steps: [
        { sel: '.kds__col:nth-child(1) .kt', en: 'New order', ar: 'كل طلب بإضافاته وملاحظاته، ومؤقت يتحول للأحمر لو تأخر.', next: 1 },
        { sel: '.kds__col:nth-child(1) .kt .kt__f .btn', en: 'Start', ar: 'اضغط Start لبدء التحضير.', wait: () => cols('make') > tour.base.make },
        { sel: '.kds__col:nth-child(2) .kt .kt__f .btn', en: 'Ready', ar: 'اضغط Ready — الرقم يظهر على شاشة «طلبك جاهز» بصوت.', wait: () => cols('ready') > tour.base.ready },
        { sel: '.allday', en: 'All-day', ar: 'إجمالي المطلوب من كل مشروب — الباريستا يحضّر بالجملة.', next: 1 },
      ] },
  ];
  function openGuide() {
    const m = D.modal(`${D.head(bi('Guide', 'جولات تفاعلية'), 'اختر سيناريو — النظام ينوّر لك مكان كل ضغطة خطوة بخطوة')}<div class="modal__b"><div class="scen">${TOURS.map((t) => `<button data-tour="${t.id}"><span class="art">${I(t.ic)}</span>${bi(t.en, t.ar)}<p>${t.steps.length} خطوات · حوالي ${t.min} دقيقة</p></button>`).join('')}</div></div>`, { cls: 'modal--wide' });
    m.addEventListener('click', (e) => { const b = e.target.closest('[data-tour]'); if (!b) return; m.close(); setTimeout(() => startTour(b.dataset.tour), 230); });
  }
  let tour = null;
  function startTour(id) {
    const T = TOURS.find((x) => x.id === id); if (!T) return;
    endTour();
    $$('.ovl').forEach((o) => o.remove());
    closePops();
    T.setup();
    const el = document.createElement('div');
    el.className = 'tour center';
    el.innerHTML = '<div class="tour__hole"></div><div class="tour__tip" role="dialog" aria-live="polite"></div>';
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-tn]')) advance(); else if (e.target.closest('[data-tx]')) endTour(); });
    tour = { T, i: 0, el, t: setInterval(tick, 250) };
    showStep();
  }
  function endTour() { if (!tour) return; clearInterval(tour.t); tour.el.remove(); tour = null; }
  function showStep() {
    const st = tour.T.steps[tour.i];
    const last = tour.i === tour.T.steps.length - 1;
    tour.shown = Date.now(); tour.scrolled = false;
    tour.base = { make: cols('make'), ready: cols('ready') };
    $('.tour__tip', tour.el).innerHTML = `<div class="k"><b>${st.en}</b><div class="tour__dots">${tour.T.steps.map((_, k) => `<i class="${k < tour.i ? 'done' : k === tour.i ? 'on' : ''}"></i>`).join('')}</div></div><p>${st.ar}</p>
      <div class="f">${st.next || last ? `<button class="btn btn--go btn--sm" data-tn>${bi(last ? 'Finish' : 'Next', last ? 'إنهاء' : 'التالي')}</button>` : `<span class="muted" style="font-size:12px;flex:1">اضغط على المكان المضيء</span>`}<button class="btn btn--ghost btn--sm" data-tx>${bi('Exit', 'خروج')}</button></div>`;
    tick();
  }
  function advance() {
    if (!tour) return;
    if (tour.i >= tour.T.steps.length - 1) { const T = tour.T; endTour(); D.toast(`${T.en} ✓`, 'انتهت الجولة — جرّب سيناريو آخر من زر Guide', { ic: 'check' }); D.sound('ok'); return; }
    tour.i += 1; showStep();
  }
  function tick() {
    if (!tour) return;
    const st = tour.T.steps[tour.i];
    const pin = $('.pin__dots');
    let target = st.sel ? $(st.sel) : null;
    const pinModal = pin && pin.closest('.modal');
    if (pinModal && !(target && pinModal.contains(target))) target = pinModal; // موافقة المشرف تظهر فوق أي خطوة
    // على الموبايل السلة شيت: نفتحها لو الخطوة جوّاها، ونقفلها لو الخطوة برّه
    const c = $('#cart');
    if (c && target && window.matchMedia('(max-width:900px)').matches && !target.closest('.ovl')) {
      const inCart = !!target.closest('#cart');
      if (inCart !== c.classList.contains('open')) { openCartSheet(inCart); return; }
    }
    place(target, !!pinModal);
    if (st.wait && Date.now() - tour.shown > 350) { let ok = false; try { ok = st.wait(); } catch (e) { ok = false; } if (ok) advance(); }
  }
  function place(target, pinNote) {
    const hole = $('.tour__hole', tour.el), tip = $('.tour__tip', tour.el);
    const note = tip.querySelector('.pinnote');
    if (pinNote && !note) tip.querySelector('p').insertAdjacentHTML('afterend', '<p class="pinnote" style="color:var(--amber);font-weight:700;margin-top:6px">PIN المشرف للتجربة: 2222 · المدير: 9999</p>');
    if (!pinNote && note) note.remove();
    const r = target && target.getBoundingClientRect();
    if (!r || !r.width || !r.height || (tour.scrolled && (r.top > innerHeight || r.bottom < 0))) {
      tour.el.classList.add('center');
      tip.style.top = Math.max(12, innerHeight / 2 - tip.offsetHeight / 2) + 'px';
      tip.style.left = Math.max(12, innerWidth / 2 - tip.offsetWidth / 2) + 'px';
      return;
    }
    if (!tour.scrolled) { tour.scrolled = true; if (r.top < 0 || r.bottom > innerHeight) { target.scrollIntoView({ block: 'center', behavior: 'smooth' }); return; } }
    tour.el.classList.remove('center');
    const p = 6;
    Object.assign(hole.style, { left: r.left - p + 'px', top: r.top - p + 'px', width: r.width + p * 2 + 'px', height: r.height + p * 2 + 'px' });
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let top = r.bottom + 14;
    if (top + th > innerHeight - 10) top = r.top - th - 14;
    if (top < 10) top = Math.max(10, innerHeight - th - 12);
    const left = Math.max(12, Math.min(innerWidth - tw - 12, r.left + r.width / 2 - tw / 2));
    tip.style.top = top + 'px'; tip.style.left = left + 'px';
  }
  function nudge() {
    try { if (sessionStorage.getItem('darj:nudged')) return; sessionStorage.setItem('darj:nudged', '1'); } catch (e) { /* */ }
    const el = document.createElement('div');
    el.className = 'nudge';
    el.innerHTML = `${I('play')}${bi('New here? Take a guided tour', `${TOURS.length} سيناريوهات تريك أين تضغط`)}<button class="btn btn--sm" data-g>${bi('Start', 'ابدأ')}</button><button class="icon-btn x" data-x aria-label="إغلاق">${I('x', 'sm')}</button>`;
    document.body.appendChild(el);
    el.addEventListener('click', (e) => { if (e.target.closest('[data-g]')) { el.remove(); openGuide(); } else if (e.target.closest('[data-x]')) el.remove(); });
    setTimeout(() => el.remove(), 15000);
  }

  /* ---------- views table ---------- */
  const VIEWS = {
    sell: { render: renderSell },
    orders: { render: renderOrders, live: 1 },
    kds: { render: renderKDS },
    shift: { render: renderShift, live: 1 },
    menu: { render: renderMenu },
    stock: { render: renderStock },
    customers: { render: renderCustomers },
    reports: { render: renderReports, live: 1 },
    team: { render: renderTeam, live: 1 },
    settings: { render: renderSettings },
  };

  /* ---------- live wiring ---------- */
  const seenNew = new Set();
  let booted = false;
  function onChange(why) {
    if (!me || why === 'cart') return;
    const s = S();
    let fresh = 0;
    s.orders.forEach((o) => { if (o.status === 'new' && !seenNew.has(o.id)) { seenNew.add(o.id); if (booted) { fresh++; D.toast(`طلب جديد من ${D.CH[o.ch].ar}${o.table ? ' ' + o.table : ''}`, `#${o.no} · ${esc(o.name || 'عميل')} · ${fmt(o.total)} ر.س · ${o.unpaid ? 'الدفع عند الكاشير' : 'مدفوع'}`, { ic: D.CH[o.ch].ic, ms: 5000 }); } } });
    booted = true;
    if (fresh) D.sound('new');
    chrome();
    const v = VIEWS[route];
    if (v.live && !document.querySelector('.ovl') && !(document.activeElement && document.activeElement.matches('#view input'))) {
      const view = $('#view'); const top = $('#main').scrollTop;
      if (unmount) { unmount(); unmount = null; }
      unmount = v.render(view) || null; $('#main').scrollTop = top;
    } else if (route === 'sell' && why !== 'local' && why !== 'order') drawItems();
  }

  /* ---------- boot ---------- */
  function boot() {
    D.startLive();
    D.state().orders.forEach((o) => { if (o.status === 'new') seenNew.add(o.id); });
    // الصلاحيات لازم تتراجع حتى لو الصفحة اتفتحت على لينك مباشر
    if (!VIEWS[route] || !ROUTES.some((x) => x.id === route)) route = 'sell';
    if (me && D.STAFF.some((u) => u.id === me) && !can(ROUTES.find((x) => x.id === route).perm)) route = D.staff(me).role === 'barista' ? 'kds' : 'sell';
    shell();
    D.on(onChange);
    setInterval(() => { if (me) chrome(); }, 30000);
    D.alertLoop(() => !!me && S().orders.some((o) => o.status === 'new'));
    if (!me || (D.REAL && !S().setup) || (me && !D.STAFF.some((u) => u.id === me))) { me = null; render(); lockScreen(); } else { render(); if (wantGuide && !D.REAL) setTimeout(openGuide, 700); }
    window.addEventListener('hashchange', () => { const r = location.hash.slice(1); if (r !== route && VIEWS[r]) { const rr = ROUTES.find((x) => x.id === r); if (can(rr.perm)) { route = r; render(); } } });
  }
  window.DARJ_APP = { go };
  boot();
})();
