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
  // دخول المدير من صفحة Website كان بيتحفظ لوحده ومابيشغّلش الحفظ على السيرفر (فصفحة الجوال تفضل فاضية).
  // دلوقتي الدخول واحد: لو فيه جلسة إدارة قديمة محفوظة على الجهاز، بتتنقل لاتصال الكاشير مرة واحدة.
  const OLD_ADMIN = 'luxurycrop-pos-admin';
  async function adoptAdminSession(c) {
    let old = null;
    try { old = JSON.parse(localStorage.getItem(OLD_ADMIN) || 'null'); } catch (e) { /* */ }
    if (!old || !old.access_token || !old.refresh_token) return null;
    const out = await c.auth.setSession({ access_token: old.access_token, refresh_token: old.refresh_token });
    try { localStorage.removeItem(OLD_ADMIN); } catch (e) { /* */ }
    return out && !out.error && out.data && out.data.session ? out.data.session.user : null;
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
      const p = D.has(it.item_id) && it.item_id !== SITE_ITEM ? D.prod(it.item_id) : null;
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
    // أول مزامنة للصنف: الموقع هو المرجع. بعد كده بيتطبّق بس اللي اتغيّر في الموقع نفسه من آخر مرة،
    // فتعديل الكاشير (صنف خلص، سعر اتعدّل) مايترجعش لوحده، والسعر اللي رجع لأصله في الموقع بيرجع هنا كمان.
    const st = D.state();
    const seen = st.siteSeen || {};
    const next = {};
    const ch = [];
    r.data.forEach((p) => {
      if (p.id === SITE_ITEM || !D.has(p.id)) return;
      const mine = D.prod(p.id);
      const price = Number(p.price) || 0;
      const on = !p.sold_out && p.is_active !== false;
      const was = seen[p.id];
      const cur = st.prices[p.id] != null ? st.prices[p.id] : mine.price;
      if (!was) {
        if (price && price !== mine.price && cur !== price) ch.push(['price', p.id, price]);
        if ((st.avail[p.id] !== false) !== on) ch.push(['avail', p.id, on]);
      } else {
        if (price && price !== was[0] && cur !== price) ch.push(['price', p.id, price]);
        if (on !== !!was[1] && (st.avail[p.id] !== false) !== on) ch.push(['avail', p.id, on]);
      }
      next[p.id] = [price, on ? 1 : 0];
    });
    // صنف اتشال من الموقع نهائيًا: يتوقف في الكاشير
    const ids = new Set(r.data.map((p) => p.id));
    D.PRODUCTS.forEach((p) => { if (p._kept && !ids.has(p.id) && st.avail[p.id] !== false) ch.push(['avail', p.id, false]); });
    if (!ch.length && JSON.stringify(next) === JSON.stringify(seen)) return 0;
    D.mutate((s) => {
      ch.forEach(([k, id, v]) => {
        if (k === 'avail') s.avail[id] = v;
        else if (v === D.prod(id).price) delete s.prices[id];
        else s.prices[id] = v;
      });
      s.siteSeen = next;
      if (ch.length || !Object.keys(seen).length) D.log(null, 'sync', `مزامنة المنيو الأونلاين — ${ch.length} تحديث في الأسعار والتوفّر`);
    }, 'sync');
    return ch.length;
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
    setInterval(() => { if (navigator.onLine && cloud.on) syncCatalog().catch(() => {}); }, C.catalogMs || 5 * 60000); // أسعار وتوفّر الموقع طول اليوم، مش عند الفتح بس
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
        m.close(); hideNag(); start(out.data.user.email);
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
  // روابط لوحة الإدارة: الأصناف وإعدادات الموقع بتتعدّل من هناك، والكاشير بيتبعها لوحده
  const MOBILE = C.mobile || '';
  const LINKS = `<div class="set-row" style="margin-top:14px"><span><b>${bi('Menu & website', 'الأصناف وإعدادات الموقع')}</b><small>من صفحة Website في القائمة (للمدير فقط). أي تعديل هناك يظهر في الموقع والكاشير مع بعض</small></span></div>
      ${MOBILE ? `<div style="display:flex;gap:8px;flex-wrap:wrap"><a class="btn btn--ghost btn--sm" href="${esc(MOBILE)}" target="_blank" rel="noopener">${bi('Phone view', 'متابعة من الجوال')}</a></div>` : ''}`;
  function paint() {
    if (!box || !box.isConnected) return;
    if (!D.REAL) { box.innerHTML = '<p class="muted" style="font-size:12px;margin-top:8px">وضع التدريب مابيتحفظش على السيرفر.</p>'; return; }
    if (!cloud.on) {
      box.innerHTML = `<div class="set-row"><span><b>حفظ البيانات على السيرفر</b><small>مقفول. البيانات على الجهاز ده بس لحد ما تسجّل الدخول</small></span><span class="pill pill--amber">غير مربوط</span></div>
        <button class="btn btn--ink btn--block" data-cx="in">${bi('Sign in & connect', 'تسجيل الدخول وتشغيل الربط')}</button>${LINKS}`;
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
      <div style="display:flex;gap:8px;margin-top:10px">${cloud.state === 'conflict' ? '' : `<button class="btn btn--ghost btn--sm" data-cx="now">${bi('Save now', 'احفظ الآن')}</button>`}<button class="btn btn--ghost btn--sm" data-cx="out">${bi('Sign out', 'خروج')}</button></div>${LINKS}`;
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
    // صفحة Website دخلت بحساب الإدارة على اتصال الكاشير: الحفظ على السيرفر يبدأ بنفس الدخول
    begin: (email) => { if (!D.REAL || cloud.on) return; hideNag(); if (D.state().setup) { D.mutate(() => D.log(boxMe, 'sync', 'تشغيل الربط مع السيرفر'), 'sync'); start(email); } },
    signIn: () => signIn(),
    // لصفحة إدارة الموقع: نفس اتصال الكاشير، ومعرفة هل الحساب الحالي حساب إدارة
    client: init,
    access: async () => { const c = await init(); const r = await c.rpc('pos_access'); return r.error ? null : r.data; },
    resync: () => { if (cloud.on) syncCatalog().catch(() => {}); },
    test: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? { mapOrder, syncCatalog, flushSales, flushState, pump, start, restore, reset() { client = null; started = false; paused = false; lastRev = -1; lastDay = ''; lastState = 0; fails = 0; } } : null,
  };

  // منيو الموقع اتغيّر (صنف جديد، اسم، قسم): الشاشة تتحدّث من غير إعادة فتح
  window.addEventListener('darj:catalog', (e) => {
    try {
      if (!D.state().setup) return;
      D.mutate(() => {}, 'sync');
      D.toast('المنيو اتحدّث من الموقع', `${(e.detail && e.detail.changes) || 0} تعديل في الأصناف والأقسام`, { ms: 5000 });
    } catch (er) { /* */ }
  });

  /* ---------- جهاز أو تابة جديدة: دخول، وبعدها بيانات المحل تتحمّل من السيرفر ---------- */
  async function latestCopy(c) {
    const r = await c.from('pos_state').select('day,rev,state,updated_at').eq('store_key', STORE).order('day', { ascending: false }).limit(1).maybeSingle();
    if (r.error) throw r.error;
    const st = r.data && r.data.state;
    return st && st.v === 1 && st.setup ? r.data : null;
  }
  async function adoptCopy(c, copy, takeOver) {
    D.installState(copy.state, true);
    try { sessionStorage.removeItem('darj:me'); } catch (e) { /* */ }
    save(SIG_KEY, {});
    if (!D.saved()) throw new Error('storage');
    if (takeOver) {
      const out = await c.rpc('pos_save_state', { p_key: STORE, p_day: copy.state.day, p_device: DEV, p_rev: copy.state.rev || 0, p_state: copy.state, p_version: VERSION, p_force: true });
      if (out.error) throw out.error;
    }
    location.reload();
  }
  function welcome(c, email) {
    let el = document.getElementById('cxWelcome');
    if (!el) {
      el = document.createElement('div');
      el.id = 'cxWelcome'; el.className = 'lock'; el.style.zIndex = '90';
      document.body.appendChild(el);
    }
    const shell = (inner) => { el.innerHTML = `<div class="lock__in" style="max-width:440px;width:100%;text-align:right"><div style="text-align:center;margin-bottom:6px"><b style="font-size:20px">${esc((D.STORE && D.STORE.nameAr) || '')}</b></div>${inner}</div>`; };
    const skip = () => { el.remove(); };
    function login(msg) {
      shell(`<h2 style="text-align:center;margin:6px 0 4px">${bi('Sign in to load your data', 'سجّل الدخول لتحميل بيانات المحل')}</h2>
        <p class="muted" style="text-align:center;font-size:13px;margin:0 0 14px">الجهاز ده جديد. ادخل بحساب الكاشير وهنجيب آخر نسخة من السيرفر.</p>
        <div class="grid" style="gap:12px"><label class="field"><span>البريد</span><input class="input mono" id="wE" type="email" autocomplete="username" dir="ltr"></label>
        <label class="field"><span>كلمة المرور</span><input class="input mono" id="wP" type="password" autocomplete="current-password" dir="ltr"></label>
        <div id="wErr">${msg ? `<div class="blind" style="color:var(--red)">${msg}</div>` : ''}</div>
        <button class="btn btn--ink btn--block" id="wGo">${bi('Sign in', 'دخول وتحميل البيانات')}</button>
        <button class="btn btn--ghost btn--block" id="wSkip">${bi('Set up from scratch', 'ابدأ إعداد جديد من غير السيرفر')}</button></div>`);
      const err = (t) => { el.querySelector('#wErr').innerHTML = `<div class="blind" style="color:var(--red)">${t}</div>`; };
      el.querySelector('#wSkip').addEventListener('click', skip);
      const go = async () => {
        const btn = el.querySelector('#wGo'); btn.disabled = true;
        try {
          const cl = await init();
          const out = await cl.auth.signInWithPassword({ email: el.querySelector('#wE').value.trim(), password: el.querySelector('#wP').value });
          if (out.error) { btn.disabled = false; return err('البريد أو كلمة المرور غير صحيحة'); }
          if (!(await access(cl))) { await cl.auth.signOut({ scope: 'local' }); btn.disabled = false; return err('الحساب ده مش مسموح له يشغّل الكاشير'); }
          choose(cl, out.data.user.email);
        } catch (e) { btn.disabled = false; err('تعذّر الاتصال. تأكد من الإنترنت'); }
      };
      el.querySelector('#wGo').addEventListener('click', go);
      el.querySelector('#wP').addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); });
      el.querySelector('#wE').focus();
    }
    async function choose(cl, mail) {
      let copy = null;
      try { copy = await latestCopy(cl); } catch (e) { shell(`<div class="blind" style="color:var(--red)">تعذّر قراءة نسخة السيرفر. تأكد من الإنترنت وحاول تاني.</div><button class="btn btn--ghost btn--block" id="wRetry" style="margin-top:12px">إعادة المحاولة</button>`); el.querySelector('#wRetry').addEventListener('click', () => choose(cl, mail)); return; }
      if (!copy) { // مفيش نسخة لسه: كمّل الإعداد العادي، والحفظ هيبدأ لوحده بعده
        start(mail); skip(); D.toast('مفيش بيانات محفوظة على السيرفر لسه', 'كمّل الإعداد وهتتحفظ تلقائيًا', { ms: 6000 });
        return;
      }
      const st = copy.state;
      const row = (a, b) => `<div class="set-row"><span><b>${a}</b></span><span class="num">${b}</span></div>`;
      shell(`<h2 style="text-align:center;margin:6px 0 10px">${bi('Data found on the server', 'لقينا بيانات المحل على السيرفر')}</h2>
        ${row('آخر حفظ', ago(new Date(copy.updated_at).getTime()))}${row('يوم العمل', esc(copy.day))}${row('آخر فاتورة', st.seq && st.seq.inv ? D.invNo(st.seq.inv) : '—')}${row('الموظفون', (st.staff || []).length)}
        <div id="wErr"></div>
        <div style="display:grid;gap:10px;margin-top:14px">
          <button class="btn btn--ink btn--block" id="wTake">${bi('Continue here', 'كمّل من هنا (الجهاز ده يبقى الأساسي)')}</button>
          <button class="btn btn--ghost btn--block" id="wCopy">${bi('Open a copy', 'افتح نسخة بس (الحفظ يفضل من الجهاز الأساسي)')}</button>
        </div><p class="muted" style="font-size:12px;margin-top:10px">لو الكاشير شغّال على جهاز تاني دلوقتي، اختار «نسخة» عشان ماتخدش مكانه.</p>`);
      const doit = async (take) => {
        el.querySelectorAll('button').forEach((b) => { b.disabled = true; });
        try { await adoptCopy(cl, copy, take); } catch (e) { el.querySelectorAll('button').forEach((b) => { b.disabled = false; }); el.querySelector('#wErr').innerHTML = '<div class="blind" style="color:var(--red)">تعذّر تحميل البيانات على الجهاز ده. حاول تاني.</div>'; }
      };
      el.querySelector('#wTake').addEventListener('click', () => doit(true));
      el.querySelector('#wCopy').addEventListener('click', () => doit(false));
    }
    if (c && email) choose(c, email); else login('');
  }

  /* ---------- تنبيه «غير مربوط»: المحل شغال والبيانات على الجهاز بس ----------
     من غير الربط: مفيش نسخة احتياطية، وصفحة المتابعة من الجوال فاضية. التنبيه بيظهر للمدير بس لحد ما يسجّل الدخول مرة واحدة. */
  let nag = null, nagOff = false;
  function hideNag() { if (nag) { nag.remove(); nag = null; } }
  function drawNag() {
    let role = '';
    try { const id = sessionStorage.getItem('darj:me'); role = id ? D.staff(id).role : ''; } catch (e) { /* */ }
    const show = !cloud.on && !nagOff && D.REAL && D.state().setup && role === 'manager' && !document.querySelector('.lock');
    if (!show) { hideNag(); return; }
    if (nag && nag.isConnected) return;
    nag = document.createElement('div');
    nag.id = 'cxNag';
    nag.style.cssText = 'position:fixed;inset-inline:12px;bottom:12px;z-index:70;display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:12px 14px;border-radius:16px;background:#141414;color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.25);font-size:13px;max-width:720px;margin-inline:auto';
    nag.innerHTML = `<span style="flex:1;min-width:200px;line-height:1.6"><b style="display:block">Not connected · الكاشير غير مربوط بالسيرفر</b>البيانات على هذا الجهاز فقط: لا توجد نسخة احتياطية، وصفحة المتابعة من الجوال لن تعرض شيئًا. سجّل الدخول مرة واحدة.</span>
      <button class="btn btn--sm" data-nag="in" style="background:#fff;color:#141414">${bi('Connect', 'تسجيل الدخول والربط')}</button><button class="btn btn--sm" data-nag="x" style="color:#fff;border:1px solid rgba(255,255,255,.3)">لاحقًا</button>`;
    nag.addEventListener('click', (e) => { const b = e.target.closest('[data-nag]'); if (!b) return; if (b.dataset.nag === 'in') signIn(); else { nagOff = true; hideNag(); } });
    document.body.appendChild(nag);
  }

  // لو فيه جلسة محفوظة، الربط بيرجع لوحده. وجهاز من غير بيانات بيعرض تحميل نسخة السيرفر
  if (C.enabled && D.REAL) {
    const fresh = () => !D.state().setup;
    init().then(async (c) => {
      const s = await c.auth.getSession();
      let u = s && s.data && s.data.session && s.data.session.user;
      if (!u) u = await adoptAdminSession(c).catch(() => null);
      if (u && await access(c)) { if (fresh()) welcome(c, u.email); else start(u.email); }
      else if (fresh()) welcome();
      setInterval(drawNag, 4000); setTimeout(drawNag, 1500);
    }).catch(() => { if (fresh()) welcome(); setInterval(drawNag, 4000); });
  }
})();
