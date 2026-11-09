/* محصول فاخر — الربط مع سيرفر الموقع (Supabase بتاع luxurycrop.site)
   مقفول لحد ما المدير يدخل مرة واحدة من Settings. بعدها على جهاز الكاشير بس:
   1) طلبات المنيو بتنزل في Orders، والتحصيل عند الكاشير، والحالة بترجع للمنيو.
   2) الأسعار والأصناف الخالصة بتتسحب من المنيو.
   3) كل طلب بيتحفظ على السيرفر، ونسخة كاملة من الكاشير بتتحفظ كل دقيقتين وبتفضل 90 يوم.
   الأمان: مفيش كلمة سر ولا مفتاح إداري في الملفات. الصلاحيات كلها في قاعدة البيانات (RLS)،
   ولو جهاز تاني أو جهاز اتمسح حاول يكتب فوق النسخة، السيرفر بيرفض لحد ما المدير يختار. */
(function () {
  'use strict';
  const D = window.DARJ;
  const C = (D.CFG && D.CFG.connect) || {};
  const STORE = (D.CFG && D.CFG.key) || 'darj:v1';
  const BASE = STORE + ':cloud';
  const SIG_KEY = BASE + ':sig';
  const OUT_KEY = BASE + ':out';
  const VERSION = C.version || '';
  const STATE_EVERY = 2 * 60000;
  const TICK = 60000;
  const STATUS_OUT = { prep: 'preparing', ready: 'ready', done: 'completed', rejected: 'cancelled', cancelled: 'cancelled' };
  const esc = D.esc;
  const bi = (en, ar) => `<span class="bi"><b>${en}</b><small>${ar}</small></span>`;
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };

  function deviceId() {
    const k = STORE + ':dev';
    let v = '';
    try { v = localStorage.getItem(k) || ''; if (!v) { v = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(k, v); } } catch (e) { v = 'd' + Math.random().toString(36).slice(2, 10); }
    return v;
  }
  const DEV = deviceId();

  /* ---------- client ---------- */
  let client = null;
  function sdk() {
    return new Promise((res, rej) => {
      if (window.supabase) { res(window.supabase); return; }
      const sc = document.createElement('script');
      sc.src = 'assets/vendor/supabase-2.116.0.js';
      sc.onload = () => res(window.supabase); sc.onerror = () => rej(new Error('supabase sdk'));
      document.head.appendChild(sc);
    });
  }
  async function init() {
    if (client) return client;
    const lib = await sdk();
    client = lib.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'luxurycrop-pos-auth' } });
    return client;
  }
  async function access(c) {
    const r = await c.rpc('pos_access');
    return !r.error && r.data && r.data.member === true;
  }

  /* ---------- website orders ---------- */
  const SITE_ITEM = 'site_item'; // أي صنف مش موجود في منيو الكاشير بيوصل باسمه وسعره بدل ما الطلب يضيع
  function groupOf(optId) {
    const id = (D.ALIAS && D.ALIAS[optId]) || optId;
    for (const [g, G] of Object.entries(D.MODS)) if ((G.opts || []).some((o) => o.id === id)) return [g, id];
    return [null, id];
  }
  function mapOrder(o) {
    const lines = [];
    (o.order_items || []).forEach((it) => {
      const unit = Number(it.unit_price) || 0;
      const qty = Number(it.quantity) || 1;
      if (it.item_type === 'addon') {
        const last = lines[lines.length - 1];
        if (!last) { lines.push({ pid: SITE_ITEM, qty, mods: {}, note: String(it.item_name || ''), fixed: unit }); return; }
        last.fixed = D.r2(last.fixed + (unit * qty) / last.qty);
        const [g, id] = groupOf(it.item_id);
        if (g && D.prod(last.pid).mods.includes(g) && qty === last.qty) { last.mods[g] = (last.mods[g] || []).concat([id]); return; }
        last.note = [last.note, `إضافة: ${qty}× ${it.item_name}`].filter(Boolean).join(' · ');
        return;
      }
      const p = D.prod(it.item_id);
      if (p) lines.push({ pid: p.id, qty, mods: D.defMods(p), note: it.note || '', fixed: unit });
      else lines.push({ pid: SITE_ITEM, qty, mods: {}, note: [it.item_name, it.note].filter(Boolean).join(' · '), fixed: unit });
    });
    // إجمالي الكاشير لازم يطلع نفس اللي العميل شافه على الموقع بالظبط
    const sum = lines.reduce((a, l) => a + D.r2(l.fixed * l.qty), 0);
    const gap = D.r2(Number(o.total) - sum);
    if (gap && lines.length) { const l = lines[lines.length - 1]; l.fixed = (D.r2(l.fixed * l.qty) + gap) / l.qty; }
    return { ext: o.id, extNo: o.order_number, ch: 'table', type: 'table', table: o.table_no, ts: new Date(o.created_at).getTime(), name: o.customer_name || '', phone: o.customer_phone || '', label: o.service_label || '', lines };
  }
  async function pull() {
    const c = await init();
    const since = new Date(Date.now() - 6 * 3600e3).toISOString();
    const r = await c.from('orders')
      .select('id,order_number,table_no,service_label,customer_name,customer_phone,status,total,created_at,order_items(id,item_type,item_id,item_name,quantity,unit_price,note)')
      .in('status', ['new', 'preparing']).gte('created_at', since).order('created_at');
    if (r.error) throw r.error;
    const known = new Set(D.state().orders.map((x) => x.ext).filter(Boolean));
    r.data.filter((o) => !known.has(o.id)).forEach((o) => {
      o.order_items = (o.order_items || []).slice().sort((a, b) => a.id - b.id);
      const m = mapOrder(o);
      if (m.lines.length) D.addOnline(m);
    });
  }
  async function syncCatalog() {
    const c = await init();
    const r = await c.from('products').select('id,price,sold_out,is_active');
    if (r.error) return;
    D.mutate((s) => {
      let n = 0;
      r.data.forEach((p) => {
        const mine = D.prod(p.id); if (!mine) return;
        const price = Number(p.price);
        if (price && price !== mine.price && s.prices[p.id] !== price) { s.prices[p.id] = price; n++; }
        const on = !p.sold_out && p.is_active !== false;
        if ((s.avail[p.id] !== false) !== on) { s.avail[p.id] = on; n++; }
      });
      D.log(null, 'sync', `مزامنة المنيو الأونلاين — ${n} تحديث في الأسعار والتوفّر`);
    }, 'sync');
  }
  // حالة الطلب بتتحفظ محليًا وتتبعت لما النت يرجع
  function queueStatus(id, st) { const q = read(OUT_KEY, []); q.push({ id, st }); save(OUT_KEY, q); soon(); }
  async function flushStatus(c) {
    const q = read(OUT_KEY, []);
    while (q.length) {
      const r = await c.rpc('pos_set_order_status', { p_id: q[0].id, p_status: q[0].st });
      if (r.error) throw r.error;
      q.shift(); save(OUT_KEY, q);
    }
  }

  /* ---------- server copy ---------- */
  const cloud = { on: false, state: 'off', email: '', lastAt: read(BASE + ':last', 0), err: '', conflict: null };
  let timer = 0, soonT = 0, busy = false, fails = 0, paused = false, lastState = 0, lastRev = -1, lastDay = '', started = false, poll = 0, channel = null;
  let box = null, boxMe = null;
  const hash = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };
  function setCloud(p) { Object.assign(cloud, p); paint(); }
  function schedule(ms) { clearTimeout(timer); timer = setTimeout(pump, ms); }
  function soon() { if (!soonT) soonT = setTimeout(() => { soonT = 0; schedule(0); }, 3000); }

  async function flushSales(c) {
    const s = D.state();
    const sig = read(SIG_KEY, {});
    const dirty = [];
    s.orders.forEach((o) => { if (o.sim) return; const h = hash(JSON.stringify(o)); if (sig[o.id] !== h) dirty.push({ o, h }); });
    const batch = dirty.slice(0, 200);
    if (batch.length) {
      const now = new Date().toISOString();
      const rows = batch.map(({ o }) => ({ store_key: STORE, id: o.id, day: o.day || s.day, inv: o.inv || null, status: o.status, total: Number(o.total) || 0, refunded: Number(o.refunded) || 0, data: o, updated_at: now }));
      const r = await c.from('pos_sales').upsert(rows, { onConflict: 'store_key,id' });
      if (r.error) throw r.error;
      batch.forEach(({ o, h }) => { sig[o.id] = h; });
    }
    const ids = new Set(s.orders.map((o) => o.id));
    Object.keys(sig).forEach((k) => { if (!ids.has(k)) delete sig[k]; });
    save(SIG_KEY, sig);
    return dirty.length - batch.length;
  }
  async function flushState(c, force) {
    const s = D.state();
    if (!s.setup) return true;
    if (!force && s.rev === lastRev && s.day === lastDay) return true;
    const copy = Object.assign({}, s);
    delete copy.link;
    const r = await c.rpc('pos_save_state', { p_key: STORE, p_day: s.day, p_device: DEV, p_rev: s.rev || 0, p_state: copy, p_version: VERSION, p_force: !!force });
    if (r.error) throw r.error;
    if (!r.data || !r.data.ok) { paused = true; setCloud({ state: 'conflict', conflict: r.data || {} }); D.toast('النسخة على السيرفر محتاجة قرار المدير', 'افتح Settings ← الربط مع السيرفر', { warn: 1, ic: 'alert', ms: 9000 }); return false; }
    lastRev = s.rev; lastDay = s.day; lastState = Date.now();
    return true;
  }
  async function pump(force) {
    if (busy || !cloud.on) return;
    if (paused && !force) return;
    if (!navigator.onLine) { setCloud({ state: 'offline' }); schedule(15000); return; }
    busy = true;
    try {
      const c = await init();
      const st = D.state();
      const needState = force || !lastState || st.day !== lastDay || Date.now() - lastState > STATE_EVERY;
      if (needState && !(await flushState(c, force === 'take'))) return;
      const more = await flushSales(c);
      await flushStatus(c);
      fails = 0;
      const at = Date.now(); save(BASE + ':last', at);
      setCloud({ state: 'ok', lastAt: at, err: '', conflict: null });
      schedule(more ? 500 : TICK);
    } catch (e) {
      fails++;
      const auth = e && (e.code === '42501' || e.status === 401 || /jwt/i.test(e.message || ''));
      setCloud({ state: 'error', err: auth ? 'انتهت جلسة الدخول. سجّل الدخول تاني.' : 'تعذّر الحفظ، وهيعيد المحاولة لوحده.' });
      schedule(Math.min(300000, 15000 * Math.pow(2, fails)));
    } finally { busy = false; }
  }
  async function runSync(c, email) {
    setCloud({ on: true, state: 'saving', email });
    D.hooks.status = (o, st) => { const out = STATUS_OUT[st]; if (out && o.ext) queueStatus(o.ext, out); };
    D.on((why) => { if (why !== 'cart' && why !== 'link' && cloud.on) soon(); });
    window.addEventListener('online', () => { if (cloud.on) schedule(0); });
    await syncCatalog();
    await pull();
    channel = c.channel('pos-orders').on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, () => setTimeout(() => pull().catch(() => {}), 600)).subscribe();
    poll = setInterval(() => { if (navigator.onLine) pull().catch(() => {}); }, C.pollMs || 5000);
    pump();
  }
  async function start(email) {
    if (started) return; started = true;
    const c = await init();
    // تاب واحد بس على الجهاز هو اللي بيسحب الطلبات ويحفظ
    if (navigator.locks) navigator.locks.request('luxurycrop-pos-cloud', () => runSync(c, email).then(() => new Promise(() => {})));
    else runSync(c, email);
  }
  async function signOut() {
    try { const c = await init(); await c.auth.signOut({ scope: 'local' }); } catch (e) { /* */ }
    location.reload();
  }
  async function restore() {
    const c = await init();
    const r = await c.from('pos_state').select('day,rev,state,updated_at').eq('store_key', STORE).order('day', { ascending: false }).limit(1).maybeSingle();
    if (r.error || !r.data || !r.data.state || r.data.state.v !== 1) throw new Error('no copy');
    try { await D.archive({ day: 'before-restore-' + Date.now(), state: D.state() }); } catch (e) { /* */ }
    D.installState(r.data.state);
    save(SIG_KEY, {});
    const out = await c.rpc('pos_save_state', { p_key: STORE, p_day: r.data.state.day, p_device: DEV, p_rev: r.data.state.rev || 0, p_state: r.data.state, p_version: VERSION, p_force: true });
    if (out.error) throw out.error;
  }

  /* ---------- screens ---------- */
  function signIn() {
    const m = D.modal(`${D.head('Sign in · تسجيل الدخول', 'حساب الكاشير اللي على السيرفر. مرة واحدة على الجهاز ده')}
      <div class="modal__b grid" style="gap:12px"><label class="field"><span>البريد</span><input class="input mono" id="cxE" type="email" autocomplete="off" dir="ltr"></label>
      <label class="field"><span>كلمة المرور</span><input class="input mono" id="cxP" type="password" autocomplete="off" dir="ltr"></label><div id="cxErr"></div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--ink" id="cxGo">${bi('Sign in', 'دخول وربط')}</button></div>`, { cls: 'modal--sm' });
    const err = (t) => { m.querySelector('#cxErr').innerHTML = `<div class="blind" style="color:var(--red)">${t}</div>`; };
    m.querySelector('#cxGo').addEventListener('click', async () => {
      try {
        const c = await init();
        const out = await c.auth.signInWithPassword({ email: m.querySelector('#cxE').value.trim(), password: m.querySelector('#cxP').value });
        if (out.error) return err('البريد أو كلمة المرور غير صحيحة');
        if (!(await access(c))) { await c.auth.signOut({ scope: 'local' }); return err('الحساب ده مش مسموح له يشغّل الكاشير'); }
        D.mutate(() => D.log(boxMe, 'sync', 'تشغيل الربط مع السيرفر'), 'sync');
        m.close(); start(out.data.user.email);
      } catch (e) { err('تعذّر الاتصال. تأكد من الإنترنت'); }
    });
  }
  function confirmAct(title, word, note, go) {
    const m = D.modal(`${D.head(title, note)}<div class="modal__b"><div class="blind" style="color:var(--red)">اكتب كلمة «${word}» للتأكيد.</div><input class="input" id="cTxt" style="margin-top:12px"></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>إلغاء</button><button class="btn btn--danger" id="cGo">تأكيد</button></div>`, { cls: 'modal--sm' });
    m.querySelector('#cGo').addEventListener('click', async () => {
      if (m.querySelector('#cTxt').value.trim() !== word) { m.querySelector('#cTxt').focus(); return; }
      const u = await D.approve('settings', title, boxMe); if (!u) return;
      m.close(); go();
    });
  }
  function ago(t) { if (!t) return 'لسه'; const n = Math.round((Date.now() - t) / 60000); return n < 1 ? 'الآن' : n < 60 ? `من ${n} دقيقة` : new Date(t).toLocaleString('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'short', timeStyle: 'short' }); }
  function paint() {
    if (!box || !box.isConnected) return;
    if (!D.REAL) { box.innerHTML = '<p class="muted" style="font-size:12px;margin-top:8px">وضع التدريب مابيتحفظش على السيرفر.</p>'; return; }
    if (!cloud.on) {
      box.innerHTML = `<div class="set-row"><span><b>حفظ البيانات على السيرفر</b><small>مقفول. البيانات على الجهاز ده بس لحد ما تسجّل الدخول</small></span><span class="pill pill--amber">غير مربوط</span></div>
        <button class="btn btn--ink btn--block" data-cx="in">${bi('Sign in & connect', 'تسجيل الدخول وتشغيل الربط')}</button>`;
      return;
    }
    const pill = { ok: ['pill--go', 'محفوظ'], saving: ['', 'بيحفظ'], offline: ['pill--amber', 'مفيش نت'], error: ['pill--amber', 'متوقف'], conflict: ['pill--amber', 'محتاج قرار'] }[cloud.state] || ['', ''];
    const sub = cloud.state === 'offline' ? 'الكاشير شغال عادي، والحفظ هيكمل لما النت يرجع' : cloud.state === 'error' ? esc(cloud.err) : `آخر حفظ: ${ago(cloud.lastAt)} · ${esc(cloud.email)}`;
    let extra = '';
    if (cloud.state === 'conflict') {
      const why = cloud.conflict && cloud.conflict.reason === 'device' ? 'النسخة اللي على السيرفر جاية من جهاز تاني.' : 'النسخة اللي على السيرفر أحدث من بيانات الجهاز ده.';
      extra = `<div class="blind" style="margin-top:10px">${why} الحفظ واقف عشان مايتكتبش فوقها. اختار واحدة:</div>
        <div style="display:grid;gap:8px;margin-top:10px"><button class="btn btn--ink btn--block" data-cx="restore">${bi('Restore', 'استرجع نسخة السيرفر على الجهاز ده')}</button>
        <button class="btn btn--ghost btn--block" data-cx="take">${bi('Use this device', 'خلّي بيانات الجهاز ده هي الأساسية')}</button></div>`;
    }
    box.innerHTML = `<div class="set-row"><span><b>حفظ البيانات على السيرفر</b><small>${sub}</small></span><span class="pill ${pill[0]}">${pill[1]}</span></div>${extra}
      <div style="display:flex;gap:8px;margin-top:10px">${cloud.state === 'conflict' ? '' : `<button class="btn btn--ghost btn--sm" data-cx="now">${bi('Save now', 'احفظ الآن')}</button>`}<button class="btn btn--ghost btn--sm" data-cx="out">${bi('Sign out', 'خروج')}</button></div>`;
  }
  function onBox(e) {
    const b = e.target.closest('[data-cx]'); if (!b) return;
    const a = b.dataset.cx;
    if (a === 'in') signIn();
    else if (a === 'out') signOut();
    else if (a === 'now') { lastRev = -1; setCloud({ state: 'saving' }); pump(true); }
    else if (a === 'take') confirmAct('Use this device', 'تأكيد', 'بيانات الجهاز ده هتبقى النسخة الأساسية على السيرفر', () => { paused = false; lastRev = -1; setCloud({ state: 'saving', conflict: null }); pump('take'); });
    else if (a === 'restore') confirmAct('Restore', 'استرجاع', 'بيانات الجهاز ده هتتبدل بآخر نسخة على السيرفر', async () => {
      try { await restore(); location.reload(); } catch (err) { D.toast('تعذّر الاسترجاع', 'تأكد من الإنترنت وحاول تاني', { warn: 1, ic: 'alert' }); }
    });
  }

  window.DARJ_CONNECT = {
    enabled: !!C.enabled,
    panel(el, me) { box = el; boxMe = me; if (!el.dataset.cx) { el.dataset.cx = '1'; el.addEventListener('click', onBox); } paint(); },
    status: () => Object.assign({}, cloud),
    test: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? { mapOrder, flushSales, flushState, pump, start, restore, reset() { client = null; started = false; paused = false; lastRev = -1; lastDay = ''; lastState = 0; fails = 0; } } : null,
  };

  // لو فيه جلسة محفوظة، الربط بيرجع لوحده
  if (C.enabled && D.REAL) {
    init().then(async (c) => {
      const s = await c.auth.getSession();
      const u = s && s.data && s.data.session && s.data.session.user;
      if (u && await access(c)) start(u.email);
    }).catch(() => {});
  }
})();
