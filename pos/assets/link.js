/* DARJ Link — ربط شاشات المحل ببعض أونلاين
   الكاشير (app.html) هو المركز: عنده كل الأرقام، وبيبعت للشاشات التانية (الباريستا، المطبخ، شاشة الطلبات، شاشة العميل، الكشك)
   كل تغيير لحظة بلحظة. والشاشات بتبعت للكاشير الأوامر بس (ابدأ، جاهز، تم التسليم، طلب من الكشك)، والكاشير هو اللي بينفّذ ويسجّل.
   - النقل: Supabase Realtime (broadcast) على نفس مشروع المنيو. من غير جداول، ومن غير ما نكتب أي حاجة في قاعدة البيانات.
   - الأمان: كل جهاز بيتربط مرة واحدة بلينك/QR فيه مفتاح سري من إعدادات الكاشير. اسم القناة متشتق من المفتاح،
     وكل رسالة متوقّعة HMAC-SHA256 بنفس المفتاح، فاللي معاهوش المفتاح ميقدرش يقرا ولا يبعت. «فك ربط الكل» بيغيّر المفتاح.
   - على نفس جهاز الكاشير: الشاشات بتشتغل من غير ربط (التابات بتتزامن من التخزين المحلي). */
(function () {
  'use strict';
  const D = window.DARJ;
  const CFG = D.CFG || {};
  const C = CFG.connect || {};
  const BASE = CFG.key || 'darj:v1';
  const ROLE = window.DARJ_ROLE || 'hub'; // hub · kds · board · cart · kiosk
  const PKEY = BASE + ':pair';
  const TAB = Math.random().toString(36).slice(2, 9);
  const L = (window.DARJ_LINK = { role: ROLE, ok: !!(C.url && C.key && CFG.link !== false && window.crypto && crypto.subtle), status: 'off', peers: [], last: 0, st: '', name: '' });
  const subs = new Set();
  L.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  const fire = () => subs.forEach((fn) => { try { fn(L); } catch (e) { console.error(e); } });
  let DEV = '';
  try { DEV = localStorage.getItem(BASE + ':dev') || ''; if (!DEV) { DEV = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(BASE + ':dev', DEV); } } catch (e) { DEV = 'd' + TAB; }
  DEV += ROLE === 'hub' ? '' : '-' + ROLE + '-' + TAB;
  L.dev = DEV;

  /* ---------- pairing (الشاشات) ---------- */
  const readPair = () => { try { return JSON.parse(localStorage.getItem(PKEY) || 'null'); } catch (e) { return null; } };
  if (ROLE !== 'hub') {
    const m = /[#&]pair=([A-Za-z0-9_-]{16,64})/.exec(location.hash);
    if (m) {
      try { localStorage.setItem(PKEY, JSON.stringify({ s: m[1], at: Date.now() })); } catch (e) { /* */ }
      history.replaceState(null, '', location.pathname + location.search);
    }
  }
  const pair = ROLE !== 'hub' ? readPair() : null;
  if (pair && L.ok) { D.SAT = true; L.paired = true; }
  L.unpair = () => { try { localStorage.removeItem(PKEY); localStorage.removeItem(BASE + ':snap'); } catch (e) { /* */ } location.reload(); };

  /* ---------- crypto ---------- */
  const te = new TextEncoder();
  const b64u = (buf) => { let s = ''; new Uint8Array(buf).forEach((b) => { s += String.fromCharCode(b); }); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const rand = () => { const a = new Uint8Array(18); crypto.getRandomValues(a); return b64u(a); };
  let key = null, chName = '';
  async function useSecret(sec) {
    key = await crypto.subtle.importKey('raw', te.encode(sec), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    chName = 'pos-' + b64u(await crypto.subtle.digest('SHA-256', te.encode('darj-link:' + sec))).slice(0, 24);
  }
  async function seal(obj) { const b = JSON.stringify(obj); return { b, s: b64u(await crypto.subtle.sign('HMAC', key, te.encode(b))) }; }
  async function open(p) {
    try {
      const sig = Uint8Array.from(atob(p.s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
      if (!(await crypto.subtle.verify('HMAC', key, sig, te.encode(p.b)))) return null;
      return JSON.parse(p.b);
    } catch (e) { return null; }
  }

  /* ---------- transport ---------- */
  function sdk() {
    return new Promise((res, rej) => {
      if (window.supabase && window.supabase.createClient) { res(window.supabase); return; }
      const sc = document.createElement('script');
      sc.src = 'assets/vendor/supabase-2.116.0.js';
      sc.onload = () => res(window.supabase); sc.onerror = () => rej(new Error('sdk'));
      document.head.appendChild(sc);
    });
  }
  let client = null, ch = null;
  let skew = 0; // فرق ساعة الجهاز ده عن ساعة الكاشير (الشاشات بس) — عشان جهاز ساعته غلط مايترفضش
  async function connect(onMsg) {
    const lib = await sdk();
    client = client || lib.createClient(C.url, C.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'darj-link-' + BASE } });
    if (ch) { try { await client.removeChannel(ch); } catch (e) { /* */ } }
    ch = client.channel(chName, { config: { broadcast: { self: false, ack: false }, presence: { key: DEV } } });
    ch.on('broadcast', { event: 'm' }, async ({ payload }) => { const m = payload && payload.b ? await open(payload) : null; if (m && m.from !== DEV) onMsg(m); });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      L.peers = Object.keys(st).map((k) => Object.assign({ dev: k }, (st[k] || [])[0])).filter((p) => p.dev !== DEV);
      fire();
    });
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        L.status = 'on';
        ch.track({ role: ROLE, st: L.st, name: L.name, at: Date.now() });
        if (ROLE === 'hub') snapNow(); else send({ t: 'hello' });
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') L.status = 'err';
      else if (s === 'CLOSED') L.status = 'off';
      fire();
    });
  }
  async function send(obj) {
    if (!ch || L.status !== 'on') return false;
    obj.from = DEV; obj.ts = Date.now() + skew;
    try { const r = await ch.send({ type: 'broadcast', event: 'm', payload: await seal(obj) }); return r === 'ok'; } catch (e) { return false; }
  }
  L.track = (meta) => { Object.assign(L, meta); if (ch && L.status === 'on') ch.track({ role: ROLE, st: L.st, name: L.name, at: Date.now() }); };

  /* =====================================================================
     HUB — جوه الكاشير (تاب واحد بس في الجهاز بيبقى المركز)
     ===================================================================== */
  const SLIM = ['id', 'no', 'ts', 'day', 'ch', 'type', 'table', 'label', 'name', 'voided', 'lineDone', 'sp', 'started', 'status', 'tsAcc', 'tsReady', 'tsDone', 'unpaid', 'payFirst', 'total', 'sim', 'kid', 'cancelled', 'inv'];
  function slim(o) {
    const x = {}; SLIM.forEach((k) => { if (o[k] != null) x[k] = o[k]; });
    x.lines = o.lines.map((l) => ({ pid: l.pid, qty: l.qty, mods: l.mods, note: l.note, st: l.st, total: l.total, reward: l.reward }));
    return x;
  }
  function snapshot() {
    const s = D.state(); const now = Date.now();
    const live = s.orders.filter((o) => ['new', 'prep', 'ready'].includes(o.status) || (o.tsDone && now - o.tsDone < 3 * 60000));
    const tally = {}; ['bar', 'kitchen', 'all'].forEach((x) => { tally[x] = D.kdsStats(Object.assign({}, s, { tally: null }), x); });
    return {
      v: 1, rev: s.rev || 0, day: s.day, train: !!D.TRAIN, real: !!D.REAL, seq: { no: s.seq.no },
      store: { nameAr: D.STORE.nameAr, nameEn: D.STORE.nameEn, branchAr: D.STORE.branchAr, branchEn: D.STORE.branchEn, tagEn: D.STORE.tagEn, addr: D.STORE.addr },
      settings: { sound: s.settings.sound, orderTone: s.settings.orderTone, orderVol: s.settings.orderVol, orderRepeat: s.settings.orderRepeat, loyalNeed: s.settings.loyalNeed, vatOn: s.settings.vatOn, offline: s.settings.offline, kiosk: s.settings.kiosk || null },
      prices: s.prices || {}, avail: s.avail || {}, routes: s.routes || {}, tally, orders: live.map(slim),
    };
  }
  let snapT = 0, lastSnapAt = 0;
  const hasPeers = () => L.peers.some((p) => p.role && p.role !== 'hub');
  function snapNow() { clearTimeout(snapT); snapT = 0; if (!hasPeers()) return; lastSnapAt = Date.now(); send({ t: 'snap', snap: snapshot() }); }
  function snapSoon() { if (!snapT) snapT = setTimeout(snapNow, 140); }
  const done = new Map(); // الأمر اللي اتنفّذ قبل كده مايتنفّذش تاني (لو الشاشة بعتته مرتين)
  function exec(m) {
    if (Math.abs(Date.now() - (m.ts || 0)) > 10 * 60000) { send({ t: 'ack', to: m.from, cid: m.cid, res: { ok: 0, err: 'clock' } }); return; } // أمر قديم أو ساعة الجهاز غلط: الشاشة تتبلّغ بدل ما تفضل مستنية
    let res = done.get(m.cid);
    if (!res) {
      let r = null;
      try { r = D.ACT[m.op] ? D.ACT[m.op](m.a || {}) : null; } catch (e) { console.error(e); }
      res = m.op === 'kiosk' ? (r ? { ok: 1, no: r.no, id: r.id, total: r.total, status: r.status, inv: r.inv } : { ok: 0 }) : { ok: 1 };
      done.set(m.cid, res); if (done.size > 400) done.delete(done.keys().next().value);
    }
    send({ t: 'ack', to: m.from, cid: m.cid, res });
    snapSoon();
  }
  function onHub(m) {
    if (m.t === 'hello') snapSoon();
    else if (m.t === 'cmd') exec(m);
  }
  // الربط يشتغل في تاب واحد بس من الكاشير على نفس الجهاز
  const LEAD = BASE + ':hub';
  function lead() {
    let l = null; try { l = JSON.parse(localStorage.getItem(LEAD) || 'null'); } catch (e) { /* */ }
    const now = Date.now();
    if (!l || l.id === TAB || now - l.ts > 9000) { try { localStorage.setItem(LEAD, JSON.stringify({ id: TAB, ts: now })); } catch (e) { /* */ } return true; }
    return false;
  }
  // مفتاح الربط بتاع جهاز الكاشير نفسه — نفس المفتاح في التدريب والتشغيل، فالشاشات بتمشي ورا الكاشير في الوضعين
  const SKEY = BASE + ':linksec';
  L.secret = () => { let v = ''; try { v = localStorage.getItem(SKEY) || ''; } catch (e) { /* */ } if (!v) { const s = D.state(); v = (s.link && s.link.secret) || ''; } return v; };
  const setSecret = (v) => { try { localStorage.setItem(SKEY, v); } catch (e) { /* */ } };
  L.pairUrl = (page) => {
    const dir = location.href.replace(/[#?].*$/, '').replace(/[^/]*$/, '');
    return `${dir}${page}#pair=${L.secret()}`;
  };
  let running = false;
  async function hubUp() {
    if (running) return; running = true;
    if (!L.secret()) setSecret(rand()); else setSecret(L.secret());
    await useSecret(L.secret());
    L.status = 'connecting'; fire();
    await connect(onHub);
  }
  async function hubDown() { running = false; if (ch && client) { try { await client.removeChannel(ch); } catch (e) { /* */ } } ch = null; L.status = 'off'; L.peers = []; fire(); }
  L.rotate = async () => { // فك ربط كل الأجهزة: مفتاح جديد
    await hubDown();
    setSecret(rand());
    D.mutate(() => D.log(null, 'settings', 'إلغاء ربط كل الشاشات — مفتاح ربط جديد'), 'set');
    hubUp();
  };
  function startHub() {
    if (!L.ok) { L.status = 'off'; return; }
    D.hooks.cart = (c) => { if (running && hasPeers()) send({ t: 'cart', c }); }; // شاشة العميل على تابلت تاني
    D.on((why) => {
      if (!running) return;
      if (why === 'cart') { if (hasPeers()) send({ t: 'cart', c: D.readCart() }); return; }
      if (why === 'link') return;
      snapSoon();
    });
    L.on(() => { if (running && hasPeers() && Date.now() - lastSnapAt > 4000) snapSoon(); });
    const check = () => { if (lead()) { if (!running) hubUp().catch(() => { running = false; L.status = 'err'; fire(); }); } else if (running) hubDown(); };
    check(); setInterval(check, 4000);
    setInterval(() => { if (running && Date.now() - lastSnapAt > 20000) snapNow(); }, 5000); // نبضة عشان الشاشات تعرف إن الكاشير شغال
    window.addEventListener('beforeunload', () => { try { const l = JSON.parse(localStorage.getItem(LEAD) || 'null'); if (l && l.id === TAB) localStorage.removeItem(LEAD); } catch (e) { /* */ } });
  }

  /* =====================================================================
     SATELLITE — الشاشات المربوطة على أجهزة تانية
     ===================================================================== */
  const pending = new Map();
  let remoteCart = null, lastSnap = null;
  const SNAP = BASE + ':snap';
  function onSat(m) {
    if (m.t === 'snap' && m.snap) {
      L.last = Date.now();
      const was = L.live; L.live = true;
      skew = (m.ts || Date.now()) - Date.now(); D.skew = skew;
      lastSnap = JSON.stringify(m.snap); // نسخة نص: الحركة المتفائلة بتعدّل نفس الكائنات، فالرجوع لازم يبقى من نسخة منفصلة
      D.adopt(m.snap, 'remote');
      try { localStorage.setItem(SNAP, lastSnap); } catch (e) { /* */ }
      if (!was) fire();
    } else if (m.t === 'cart') { L.last = Date.now(); remoteCart = m.c; D.adopt(D.state(), 'cart'); }
    else if (m.t === 'ack' && m.to === DEV) { const p = pending.get(m.cid); if (p) { pending.delete(m.cid); p(m.res); } }
  }
  function call(op, a) {
    const cid = 'c' + D.uid();
    return new Promise((res) => {
      pending.set(cid, res);
      let n = 0;
      const go = () => { if (!pending.has(cid)) return; if (n++ >= 6) { pending.delete(cid); res(null); return; } send({ t: 'cmd', cid, op, a }); setTimeout(go, 2500); };
      go();
    });
  }
  function startSat() {
    try { const c = JSON.parse(localStorage.getItem(SNAP) || 'null'); if (c && c.day === D.dayKey(Date.now())) { lastSnap = JSON.stringify(c); D.adopt(c, 'remote'); } } catch (e) { /* */ }
    D.readCart = () => remoteCart;
    const warn = (t, s) => { if (D.toast) D.toast(t, s, { warn: 1, ic: 'wifioff', ms: 5000 }); if (D.sound) D.sound('err'); };
    D.act = (op, a) => {
      a = a || {};
      if (op === 'kiosk') return call(op, a);
      // الكاشير مش متصل: الحركة ماتتسجلش، فماتبانش كأنها اتنفذت
      if (!L.hubOnline()) { warn('الكاشير غير متصل الآن', 'لم تُسجَّل الحركة — أعدها بعد عودة الاتصال بالكاشير'); return Promise.resolve(null); }
      if (D.ACT[op]) { try { D.ACT[op](a); } catch (e) { /* */ } } // بتبان على طول، والكاشير بيأكّد
      return call(op, a).then((res) => {
        if (!res || res.ok === 0) { // ما وصلتش: الشاشة ترجع لآخر حالة من الكاشير وتنبّه
          if (lastSnap) { try { D.adopt(JSON.parse(lastSnap), 'remote'); } catch (e) { /* */ } }
          if (res && res.err === 'clock') warn('ساعة هذا الجهاز غير مضبوطة', 'اضبط التاريخ والوقت على الجهاز ثم أعد المحاولة');
          else warn('لم تصل الحركة للكاشير', 'أعد المحاولة — تأكد أن الكاشير مفتوح ومتصل بالإنترنت');
        }
        return res;
      });
    };
    useSecret(pair.s).then(() => { L.status = 'connecting'; fire(); return connect(onSat); }).catch(() => { L.status = 'err'; fire(); });
    setInterval(() => { const on = L.status === 'on' && Date.now() - L.last < 45000; if (on !== !!L.live) { L.live = on; fire(); } if (L.status === 'on' && !on) send({ t: 'hello' }); }, 5000);
  }
  // هل الكاشير شايف الشاشة دي دلوقتي؟
  L.hubOnline = () => (D.SAT ? !!L.live : true);
  L.pill = () => {
    if (ROLE === 'hub') return '';
    if (!D.SAT) return `<span class="lnk lnk--local" title="تعمل على نفس جهاز الكاشير">${D.icon('link', 'sm')}<span>Local · نفس الجهاز</span></span>`;
    const on = L.hubOnline();
    return `<button class="lnk ${on ? 'lnk--on' : 'lnk--wait'}" data-lnk>${on ? '<i class="dot pulse"></i>' : D.icon('wifioff', 'sm')}<span>${on ? 'Linked · مربوطة بالكاشير' : 'Waiting · بانتظار الكاشير'}</span></button>`;
  };
  L.menu = () => D.modal(`${D.head('ربط الشاشة', D.SAT ? 'هذه الشاشة مربوطة بالكاشير أونلاين' : 'هذه الشاشة تعمل على نفس جهاز الكاشير')}
    <div class="modal__b"><div class="blind">${D.icon('link', 'sm')}<span>${D.SAT ? (L.hubOnline() ? 'الكاشير متصل — كل طلب يصل هنا لحظة بلحظة.' : 'الكاشير غير متصل الآن. بمجرد فتحه على جهاز الكاشير وعودة الإنترنت، ستتحدّث الشاشة تلقائيًا.') : 'لتشغيلها على جهاز آخر: من الكاشير افتح Settings ← Devices وامسح QR هذه الشاشة من الجهاز الآخر.'}</span></div></div>
    <div class="modal__f"><button class="btn btn--ghost" data-close>حسنًا</button>${D.SAT ? '<button class="btn btn--danger" id="unp">إلغاء الربط</button>' : ''}</div>`, { cls: 'modal--sm' });
  document.addEventListener('click', (e) => { if (e.target.closest('[data-lnk]')) { const m = L.menu(); const u = m.querySelector('#unp'); if (u) u.addEventListener('click', L.unpair); } });

  if (ROLE === 'hub') setTimeout(startHub, 300);
  else if (D.SAT) startSat();
})();
