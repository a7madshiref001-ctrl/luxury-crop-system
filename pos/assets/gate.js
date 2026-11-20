/* DARJ Gate — دخول الموظفين بالاسم والـPIN على أي شاشة
   صفحة الدخول الواحدة (index) وشاشات التحضير (kds) بيستخدموا نفس الشاشة دي.
   - على جهاز الكاشير: الأسماء والـPIN من بيانات الكاشير على الجهاز.
   - على شاشة مربوطة (آيباد المطبخ مثلًا): الأسماء بتيجي من الكاشير من غير الـPIN، والـPIN بيتراجع عند الكاشير نفسه.
   الدخول بيتسجل في سجل الحركات باسم صاحبه، وبيفضل ساري لحد ما التابة تتقفل أو الموظف يخرج. */
(function () {
  'use strict';
  const D = window.DARJ;
  const G = (window.DARJ_GATE = {});
  const KEY = 'darj:me';
  const esc = D.esc;
  const bi = (en, ar) => `<span class="bi"><b>${en}</b><small>${ar}</small></span>`;
  const sid = () => { try { return sessionStorage.getItem(KEY) || ''; } catch (e) { return ''; } };
  // وقت دخول الموظف بيتحفظ مع اسمه، عشان الكاشير والجوال يعرضوا «شغال من الساعة كام»
  const put = (id) => { try { if (id) { if (sessionStorage.getItem(KEY) !== id || !sessionStorage.getItem(KEY + ':at')) sessionStorage.setItem(KEY + ':at', String(Date.now())); sessionStorage.setItem(KEY, id); } else { sessionStorage.removeItem(KEY); sessionStorage.removeItem(KEY + ':at'); } } catch (e) { /* */ } };
  const LBASE = (D.CFG && D.CFG.key) || 'darj:v1';
  const wasHub = () => { try { return !!localStorage.getItem(LBASE + ':linksec'); } catch (e) { return false; } };
  G.since = () => { try { return Number(sessionStorage.getItem(KEY + ':at')) || 0; } catch (e) { return 0; } };

  G.users = () => {
    if (D.SAT) return (D.STAFF || []).filter((u) => u && u.id);
    D.state(); // بيربط قائمة الموظفين الحقيقية
    return (D.STAFF || []).filter((u) => u && u.id && !u.off);
  };
  G.me = () => { const id = sid(); return id ? G.users().find((u) => u.id === id) || null : null; };
  G.out = (where) => { const id = sid(); put(''); if (id) { try { Promise.resolve(D.act('signout', { uid: id, where })).catch(() => {}); } catch (e) { /* */ } } };

  /* opt: where (اسم الشاشة في السجل) · title · sub · prefer (الدور اللي يتختار أولًا) · filter(u) · foot (HTML تحت الأسماء) · hint */
  G.open = (opt) => new Promise((resolve) => {
    opt = opt || {};
    const old = document.getElementById('gate'); if (old) old.remove();
    const el = document.createElement('div');
    el.className = 'lock'; el.id = 'gate';
    document.body.appendChild(el);
    let pick = '', pin = '', busy = false, sig = null, closed = false;
    const list = () => G.users().filter((u) => !opt.filter || opt.filter(u));
    const say = (t) => { const x = el.querySelector('#gMsg'); if (x) x.textContent = t || ''; };
    const dots = () => el.querySelector('.pin__dots');
    const paintPin = () => { const d = dots(); if (d) d.querySelectorAll('i').forEach((x, i) => x.classList.toggle('on', i < pin.length)); };
    function finish(u) {
      if (closed) return; closed = true;
      put(u.id); off(); document.removeEventListener('keydown', key); el.remove(); resolve(u);
    }
    function paint() {
      if (closed) return;
      const cur = G.me();
      if (cur && (!opt.filter || opt.filter(cur))) { finish(cur); return; }
      const users = list();
      const now = JSON.stringify(users.map((u) => [u.id, u.name, u.role])) + (D.SAT ? '|' + (window.DARJ_LINK && window.DARJ_LINK.hubOnline() ? 1 : 0) : '');
      if (now === sig) return; // نفس القائمة: مانمسحش الـPIN اللي بيتكتب
      sig = now;
      const head = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:26px">${D.brand(opt.brand || (D.LIVE ? '' : 'دَرج'))}${D.TRAIN ? '<span class="demo-tag">Training</span>' : ''}</div>
        <span class="label">${esc(opt.label || 'Staff sign-in')} · ${esc(D.STORE.nameEn || '')}</span>
        <h1>${opt.title || "Who's<br>working?"}</h1>
        <p>${opt.sub || 'كل موظف يدخل باسمه ورقمه الخاص، فيُسجَّل كل ما يفعله باسمه.'}</p>`;
      if (!users.length) {
        const sat = D.SAT;
        const setup = !sat && D.REAL && !D.state().setup;
        el.innerHTML = `<div class="lock__in"><div class="lock__side">${head}${opt.foot || ''}</div>
          <div class="pin" style="text-align:center;display:grid;gap:12px;justify-items:center">${D.icon(sat ? 'wifioff' : 'users')}
            <b>${sat ? 'بانتظار الكاشير' : setup ? 'النظام لم يُعدّ بعد' : 'لا يوجد موظفون لهذه الشاشة'}</b>
            <span class="muted" style="font-size:13px;line-height:1.7">${sat ? 'تظهر أسماء الموظفين هنا عند فتح الكاشير على جهازه واتصاله بالإنترنت.' : setup ? 'افتح الكاشير أولًا لإعداد المحل وإضافة الموظفين.' : 'أضف الموظفين وأدوارهم من الكاشير: Team ← Add staff.'}</span>
            ${sat && wasHub() ? `<button class="btn btn--ghost btn--block" id="gSelf">${bi('This is the shop cashier', 'ده جهاز الكاشير — افتح الكاشير هنا')}</button>` : sat ? '' : `<a class="btn btn--ink btn--block" href="app.html">${bi('Open cashier', 'افتح الكاشير')}</a>`}</div></div>`;
        // جهاز الكاشير اتربط بالغلط كشاشة (لينك ربط اتفتح عليه): نفك ربطه ويفتح الكاشير.
        // الزرار بيظهر بس على جهاز اشتغل قبل كده ككاشير المحل (عنده مفتاح ربط خاص بيه)، مش على جوال أو آيباد مربوط
        const self = el.querySelector('#gSelf');
        if (self) self.addEventListener('click', () => {
          if (!confirm('الجهاز ده هو كاشير المحل؟ هيتفك ربطه كشاشة ويفتح الكاشير عليه. على الجوال أو الآيباد اختار «إلغاء».')) return;
          try { localStorage.removeItem(LBASE + ':pair'); localStorage.removeItem(LBASE + ':snap'); } catch (e) { /* */ }
          location.href = 'app.html';
        });
        return;
      }
      if (!users.some((u) => u.id === pick)) { pick = (users.find((u) => u.role === opt.prefer) || users[0]).id; pin = ''; }
      el.innerHTML = `<div class="lock__in"><div class="lock__side">${head}
          <div class="who">${users.map((u) => `<button data-u="${esc(u.id)}" class="${u.id === pick ? 'on' : ''}">${D.av(u)}<span><b>${esc(u.name)}</b><small>${esc((D.ROLES[u.role] || {}).ar || '')}</small></span></button>`).join('')}</div>
          ${opt.foot || ''}</div>
        <div class="pin">
          <div style="text-align:center"><span class="label">Enter PIN</span><div id="gWho" style="font-weight:800;font-size:16px;margin-top:4px"></div></div>
          <div class="pin__dots">${'<i></i>'.repeat(4)}</div>
          <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-n="${n}">${n}</button>`).join('')}<button class="fn" data-n="c">مسح</button><button data-n="0">0</button><button class="fn" data-n="b">رجوع</button></div>
          <p class="pin__hint" id="gMsg" style="color:var(--red);min-height:16px"></p>
          ${opt.hint ? `<p class="pin__hint">${opt.hint}</p>` : ''}
        </div></div>`;
      who(); paintPin();
    }
    const who = () => { const x = el.querySelector('#gWho'); const u = list().find((y) => y.id === pick); if (x) x.textContent = u ? u.name : ''; };
    function press(n) {
      if (busy || closed || !dots()) return;
      say('');
      if (n === 'c') pin = ''; else if (n === 'b') pin = pin.slice(0, -1); else if (pin.length < 4) pin += n;
      paintPin();
      if (pin.length < 4) return;
      const u = list().find((y) => y.id === pick); if (!u) { pin = ''; paintPin(); return; }
      busy = true;
      let out;
      try { out = D.act('signin', { uid: u.id, pin, where: opt.where || 'شاشة' }); } catch (e) { out = null; }
      Promise.resolve(out).then((res) => {
        busy = false;
        if (res && res.ok) { if (D.sound) D.sound('ok'); finish(res.u || u); return; }
        const d = dots();
        if (d) { d.classList.add('err'); setTimeout(() => { d.classList.remove('err'); pin = ''; paintPin(); }, 420); } else pin = '';
        if (D.sound) D.sound('err');
        if (!res) say('الكاشير غير متصل الآن — افتحه على جهازه ثم أعد المحاولة');
        else if (res.wait) say(D.pinMsg(res.wait));
        else say('الرقم غير صحيح');
      });
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-u]');
      if (b) { pick = b.dataset.u; pin = ''; paintPin(); el.querySelectorAll('[data-u]').forEach((x) => x.classList.toggle('on', x === b)); who(); say('');
        // على الجوال لوحة الأرقام تحت الأسماء: بعد اختيار الاسم ننزل لها
        const pad = el.querySelector('.pin'); if (pad && window.matchMedia('(max-width:760px)').matches) pad.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return; }
      const n = e.target.closest('[data-n]'); if (n) press(n.dataset.n);
    });
    const key = (e) => { if (document.querySelector('.ovl')) return; if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') press('b'); };
    document.addEventListener('keydown', key);
    const offS = D.on(() => paint());
    const offL = window.DARJ_LINK && window.DARJ_LINK.on ? window.DARJ_LINK.on(() => paint()) : () => {};
    const off = () => { offS(); offL(); };
    paint();
  });
})();
