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
  const ROLE = window.DARJ_ROLE || (D.REMOTE ? 'remote' : 'hub'); // hub · kds · board · cart · kiosk · phone · remote (الكاشير الكامل من الجوال)
  const PKEY = BASE + ':pair';
  const TAB = Math.random().toString(36).slice(2, 9);
  const L = (window.DARJ_LINK = { role: ROLE, ok: !!(C.url && C.key && CFG.link !== false && window.crypto && crypto.subtle), status: 'off', peers: [], last: 0, st: '', name: '' });
  const subs = new Set();
  L.on = (fn) => { subs.add(fn); return () => subs.delete(fn); };
  const fire = () => subs.forEach((fn) => { try { fn(L); } catch (e) { console.error(e); } });
  let DEV = '';
  try { DEV = localStorage.getItem(BASE + ':dev') || ''; if (!DEV) { DEV = 'd' + Math.random().toString(36).slice(2, 10); localStorage.setItem(BASE + ':dev', DEV); } } catch (e) { DEV = 'd' + TAB; }
  DEV += ROLE === 'hub' ? '' : ROLE === 'remote' ? '-remote' : '-' + ROLE + '-' + TAB;
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
  let pair = ROLE !== 'hub' ? readPair() : null;
  // لينك الربط اتفتح على جهاز الكاشير نفسه (بنفس مفتاحه): الجهاز ده هو الكاشير مش شاشة مربوطة،
  // وإلا صفحة الدخول تفضل «بانتظار الكاشير» والكاشير مايفتحش
  if (pair && pair.s) {
    let own = '';
    try { own = localStorage.getItem(BASE + ':linksec') || ''; } catch (e) { /* */ }
    if (pair.s === own) { try { localStorage.removeItem(PKEY); localStorage.removeItem(BASE + ':snap'); } catch (e) { /* */ } pair = null; }
  }
  if (pair && L.ok) { D.SAT = true; L.paired = true; D.STAFF = []; } // أسماء الموظفين بتيجي من الكاشير مع أول تحديث
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
  async function sealStr(b) { return { b, s: b64u(await crypto.subtle.sign('HMAC', key, te.encode(b))) }; }
  /* رسايل كبيرة (نسخة المحل الكاملة للجوال): بتتضغط وتتقسم أجزاء، وكل جزء متوقّع لوحده */
  const CHUNK = 48000;
  const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';
  async function gzip(str) { const st = new Blob([str]).stream().pipeThrough(new CompressionStream('gzip')); return b64u(await new Response(st).arrayBuffer()); }
  async function gunzip(z) { const bin = Uint8Array.from(atob(z.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)); const st = new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip')); return new Response(st).text(); }
  const bigs = new Map();
  async function joinBig(m) {
    let b = bigs.get(m.id);
    if (!b) { b = { n: m.n, parts: [], got: 0, at: Date.now() }; bigs.set(m.id, b); }
    if (b.parts[m.i] == null) { b.parts[m.i] = m.p; b.got++; }
    bigs.forEach((x, k) => { if (Date.now() - x.at > 60000) bigs.delete(k); });
    if (b.got < b.n) return null;
    bigs.delete(m.id);
    try { const txt = m.g ? await gunzip(b.parts.join('')) : b.parts.join(''); return JSON.parse(txt); } catch (e) { return null; }
  }
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
    ch.on('broadcast', { event: 'm' }, async ({ payload }) => {
      const m = payload && payload.b ? await open(payload) : null;
      if (!m || m.from === DEV) return;
      if (m.t === 'big') { const whole = await joinBig(m); if (whole && whole.from !== DEV) onMsg(whole); } else onMsg(m);
    });
    ch.on('presence', { event: 'sync' }, () => {
      const st = ch.presenceState();
      L.peers = Object.keys(st).map((k) => Object.assign({ dev: k }, (st[k] || [])[0])).filter((p) => p.dev !== DEV);
      fire();
    });
    ch.subscribe((s) => {
      if (s === 'SUBSCRIBED') {
        L.status = 'on';
        ch.track(presence());
        if (ROLE === 'hub') snapNow(); else send({ t: 'hello' });
      } else if (s === 'CHANNEL_ERROR' || s === 'TIMED_OUT') L.status = 'err';
      else if (s === 'CLOSED') L.status = 'off';
      fire();
    });
  }
  async function raw(sealed) { try { const r = await ch.send({ type: 'broadcast', event: 'm', payload: sealed }); return r === 'ok'; } catch (e) { return false; } }
  async function send(obj) {
    if (!ch || L.status !== 'on') return false;
    obj.from = DEV; obj.ts = Date.now() + skew;
    const body = JSON.stringify(obj);
    if (body.length <= CHUNK) return raw(await sealStr(body));
    const g = canZip ? 1 : 0;
    const z = g ? await gzip(body) : body;
    const id = 'b' + Math.random().toString(36).slice(2, 10), n = Math.ceil(z.length / CHUNK);
    let ok = true;
    for (let i = 0; i < n; i++) {
      if (!ch || L.status !== 'on') return false;
      ok = (await raw(await sealStr(JSON.stringify({ t: 'big', id, i, n, g, p: z.slice(i * CHUNK, (i + 1) * CHUNK), from: DEV, ts: obj.ts })))) && ok;
    }
    return ok;
  }

  /* ---------- مقارنة نسختين من حالة الكاشير (للجوال) ----------
     الفرق بيتبعت بدل النسخة كلها: مفتاح اتغيّر، أو طلب/موظف/عميل اتغيّر بالـid، أو سطر في السجل اتضاف.
     التطبيق بيتعمل مرتين بنفس النتيجة (idempotent)، فلو نفس التعديل وصل تاني مابيتكررش. */
  const MASK = '••••';
  const SKIPK = new Set(['rev', 'link', 'unarchived', 'sat', 'tally']);
  const STRICT = new Set(['seq', 'day', 'setup', 'v', 'live']); // لو اتغيّرت على الكاشير في نفس اللحظة: التعديل من الجوال يترفض ويتعاد
  const J = (x) => JSON.stringify(x);
  const clone = (x) => JSON.parse(J(x));
  const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
  const hasIds = (arr) => arr.every((x) => isObj(x) && x.id != null);
  const fnv = (s) => { let h = 0x811c9dc5; s = String(s); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); } return (h >>> 0).toString(36) + ':' + s.length; };
  function diffState(A, B) {
    const d = {}; let n = 0;
    new Set([...Object.keys(A || {}), ...Object.keys(B || {})]).forEach((k) => {
      if (SKIPK.has(k)) return;
      const a = A[k], b = B[k];
      if (b === undefined) { if (a !== undefined) { d[k] = { del: 1 }; n++; } return; }
      const ja = J(a);
      if (ja === J(b)) return;
      n++;
      if (k === 'orders' && Array.isArray(a) && Array.isArray(b)) {
        const old = new Map(a.map((o) => [o.id, J(o)])); const ids = new Set();
        const up = []; b.forEach((o) => { ids.add(o.id); const j = J(o), was = old.get(o.id); if (was !== j) up.push({ x: o, h: was == null ? null : fnv(was) }); });
        d[k] = { ord: 1, up, rm: a.filter((o) => !ids.has(o.id)).map((o) => ({ id: o.id, h: fnv(old.get(o.id)) })) };
      } else if (STRICT.has(k) || !a || !b || typeof a !== 'object' || typeof b !== 'object' || Array.isArray(a) !== Array.isArray(b)) {
        d[k] = { whole: 1, set: b, old: ja };
      } else if (Array.isArray(a)) {
        if (hasIds(a) && hasIds(b)) {
          const old = new Map(a.map((x) => [x.id, J(x)])); const ids = new Set(b.map((x) => x.id));
          d[k] = { ids: 1, up: b.map((x, i) => ({ x, f: i === 0 && b.length > 1 })).filter((u) => old.get(u.x.id) !== J(u.x)), rm: a.filter((x) => !ids.has(x.id)).map((x) => x.id) };
        } else {
          const oa = a.map(J), ob = b.map(J); const sa = new Set(oa), sb = new Set(ob);
          d[k] = { js: 1, add: b.map((x, i) => ({ x, f: i === 0 && b.length > 1, j: ob[i] })).filter((u) => !sa.has(u.j)).map((u) => ({ x: u.x, f: u.f })), rm: oa.filter((j) => !sb.has(j)) };
        }
      } else {
        const put = {}, drop = [];
        Object.keys(b).forEach((sk) => { if (J(a[sk]) !== J(b[sk])) put[sk] = b[sk]; });
        Object.keys(a).forEach((sk) => { if (!(sk in b)) drop.push(sk); });
        d[k] = { obj: 1, put, drop };
      }
    });
    return n ? d : null;
  }
  // hub = true: تطبيق على الكاشير الأصلي — الـPIN المخفي ('••••') بيفضل زي ما هو
  const pinFix = (old, nx) => { if (nx && nx.pin === MASK) nx.pin = old && old.pin ? old.pin : ''; return nx; };
  function applyDiff(st, d, hub) {
    Object.keys(d || {}).forEach((k) => {
      const x = d[k];
      if (x.del === 1) { if (!hub) delete st[k]; return; } // الجوال مايقدرش يمسح قسم كامل من بيانات المحل
      if (x.ord) {
        const arr = Array.isArray(st[k]) ? st[k] : (st[k] = []);
        x.rm.forEach((r) => { const i = arr.findIndex((o) => o && o.id === r.id); if (i >= 0) arr.splice(i, 1); });
        x.up.forEach((u) => { const i = arr.findIndex((o) => o && o.id === u.x.id); if (i >= 0) arr[i] = u.x; else arr.push(u.x); });
        return;
      }
      if (x.whole) {
        if (hub && k === 'staff' && Array.isArray(x.set)) { const was = new Map((st.staff || []).map((u) => [u.id, u])); x.set.forEach((u) => pinFix(was.get(u.id), u)); }
        st[k] = x.set; return;
      }
      if (x.ids) {
        const arr = Array.isArray(st[k]) ? st[k] : (st[k] = []);
        x.rm.forEach((id) => { const i = arr.findIndex((y) => y && y.id === id); if (i >= 0) arr.splice(i, 1); });
        x.up.forEach((u) => { const i = arr.findIndex((y) => y && y.id === u.x.id); const nx = hub && k === 'staff' ? pinFix(i >= 0 ? arr[i] : null, u.x) : u.x; if (i >= 0) arr[i] = nx; else if (u.f) arr.unshift(nx); else arr.push(nx); });
        return;
      }
      if (x.js) {
        const arr = Array.isArray(st[k]) ? st[k] : (st[k] = []);
        let js = arr.map(J);
        x.rm.forEach((j) => { const i = js.indexOf(j); if (i >= 0) { arr.splice(i, 1); js.splice(i, 1); } });
        x.add.forEach((u) => { const j = J(u.x); if (js.includes(j)) return; if (u.f) { arr.unshift(u.x); js.unshift(j); } else { arr.push(u.x); js.push(j); } });
        return;
      }
      if (x.obj) { const o = isObj(st[k]) ? st[k] : (st[k] = {}); Object.assign(o, x.put); (x.drop || []).forEach((sk) => { delete o[sk]; }); }
    });
  }
  function conflictOf(s, d) {
    for (const k of Object.keys(d || {})) {
      const x = d[k];
      if (STRICT.has(k) && x.whole && J(s[k]) !== x.old) return k;
      if (x.ord) {
        const cur = new Map((s.orders || []).map((o) => [o.id, o]));
        for (const u of x.up) { const c = cur.get(u.x.id); if (u.h == null ? !!c : (!c || fnv(J(c)) !== u.h)) return 'order'; }
        for (const r of x.rm) { const c = cur.get(r.id); if (c && fnv(J(c)) !== r.h) return 'order'; }
      }
    }
    return '';
  }
  function presence() { return { role: ROLE, st: L.st, name: L.name, uid: L.uid || '', since: L.since || 0, at: Date.now() }; }
  L.track = (meta) => { Object.assign(L, meta); if (ch && L.status === 'on') ch.track(presence()); beat(); };

  /* ---------- مين شغّال على شاشات التحضير (الباريستا والمطبخ) ----------
     الشاشة اللي عليها موظف داخل باسمه بتعلن عنه: على جهاز مربوط عن طريق الـpresence في القناة،
     وعلى نفس جهاز الكاشير عن طريق نبضة في التخزين المحلي كل 10 ثواني. والكاشير بيجمعهم ويبعتهم مع «مين على الكاشير». */
  const DUTY = BASE + ':duty:';
  let dutyT = 0;
  function beat() {
    if (ROLE !== 'kds') return;
    try { if (L.uid && !D.SAT) localStorage.setItem(DUTY + TAB, J({ uid: L.uid, st: L.st, since: L.since || 0, at: Date.now() })); else localStorage.removeItem(DUTY + TAB); } catch (e) { /* */ }
  }
  L.duty = (uid, since) => {
    L.uid = uid || ''; L.since = uid ? since || Date.now() : 0;
    L.track({});
    if (!dutyT && ROLE === 'kds') {
      dutyT = setInterval(beat, 10000);
      window.addEventListener('pagehide', () => { try { localStorage.removeItem(DUTY + TAB); } catch (e) { /* */ } });
    }
  };

  /* =====================================================================
     HUB — جوه الكاشير (تاب واحد بس في الجهاز بيبقى المركز)
     ===================================================================== */
  const SLIM = ['doneBy', 'id', 'no', 'ts', 'day', 'ch', 'type', 'table', 'label', 'name', 'voided', 'lineDone', 'sp', 'started', 'status', 'tsAcc', 'tsReady', 'tsDone', 'unpaid', 'payFirst', 'total', 'sim', 'kid', 'cancelled', 'inv'];
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
      prices: s.prices || {}, avail: s.avail || {}, routes: s.routes || {}, tally, staff: D.pubStaff(), orders: live.map(slim), who: hubWho(),
    };
  }
  /* شاشات التحضير اللي عليها موظف دلوقتي: [{ u, name, role, st, since, far }] — far = على جهاز مربوط */
  function onDuty() {
    const out = [], seen = new Set();
    const add = (p, far) => {
      const u = (D.STAFF || []).find((y) => y && y.id === p.uid && !y.off);
      if (!u || !D.STATIONS[p.st]) return;
      const k = u.id + '|' + p.st; if (seen.has(k)) return; seen.add(k);
      out.push({ u: u.id, name: u.name, short: u.short || '', role: u.role, st: p.st, since: Number(p.since) || 0, far: far ? 1 : 0 });
    };
    L.peers.forEach((p) => { if (p && p.role === 'kds' && p.uid) add(p, 1); });
    try {
      const keys = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(DUTY) === 0) keys.push(k); }
      keys.forEach((k) => { let x = null; try { x = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { /* */ } if (x && x.uid && Date.now() - (x.at || 0) < 35000) add(x, 0); else localStorage.removeItem(k); });
    } catch (e) { /* */ }
    return out.sort((a, b) => (a.st === b.st ? a.since - b.since : a.st === 'bar' ? -1 : 1));
  }
  L.onDuty = onDuty;
  /* مين شغّال على كاشير المحل دلوقتي — بيروح مع كل نبضة للجوال (الكاشير الكامل وملخص اليوم) */
  let whoNow = { u: '', since: 0 };
  function hubWho() {
    let u = ''; try { u = sessionStorage.getItem('darj:me') || ''; } catch (e) { /* */ }
    const x = u ? (D.STAFF || []).find((y) => y && y.id === u && !y.off) : null;
    if (!x) u = '';
    if (u !== whoNow.u) {
      // أول مرة بعد فتح الصفحة: وقت الدخول من سجل الحركات، وإلا من دلوقتي
      const lg = u ? ((D.state().log || []).filter((l) => l.user === u && l.act === 'login' && /تسجيل دخول/.test(l.txt || '') && !/شاشة|جوال/.test(l.txt || '')).pop()) : null;
      whoNow = { u, since: u ? (whoNow.u === '' && lg ? lg.ts : Date.now()) : Date.now() };
    }
    const s = D.state(); const sh = (s.shifts || []).find((y) => !y.close && (y.reg || 1) === 1);
    return { u, name: x ? x.name : '', role: x ? x.role : '', since: whoNow.since, reg: 1,
      shift: sh ? { open: sh.open, by: (D.staff(sh.user) || {}).name || '' } : null, prep: onDuty() };
  }
  let snapT = 0, lastSnapAt = 0;
  const hasPeers = () => L.peers.some((p) => p.role && p.role !== 'hub');
  /* ملخّص اليوم لجوال المدير (role = phone): الأرقام محسوبة هنا عند الكاشير، وآخر 80 فاتورة بتفاصيلها */
  function phoneStats() {
    const s = D.state(); const all = s.orders.filter((o) => !o.sim);
    const sum = { count: 0, gross: 0, refunds: 0, by: {}, open: 0, unpaid: 0 }; const items = {};
    const today = new Set(D.today(s));
    all.forEach((o) => {
      if (o.unpaid && o.status !== 'rejected' && o.status !== 'cancelled') sum.unpaid++;
      if (['new', 'prep', 'ready'].includes(o.status)) sum.open++;
      if (o.status === 'rejected' || o.unpaid || !today.has(o)) return; // كشف اليوم = فواتير يوم الشغل الحالي بس (الجهاز بيحتفظ بآخر يومين عشان المرتجعات)
      sum.count++; sum.gross += o.total || 0; sum.refunds += o.refunded || 0;
      (o.pays || []).forEach((p) => { sum.by[p.m] = (sum.by[p.m] || 0) + (p.a || 0); });
      (o.lines || []).forEach((l) => { if (!l || !l.pid) return; const it = items[l.pid] || (items[l.pid] = { n: (D.prod(l.pid) || {}).ar || l.note || 'صنف', q: 0 }); it.q += l.qty || 0; });
    });
    sum.gross = D.r2(sum.gross); sum.refunds = D.r2(sum.refunds); Object.keys(sum.by).forEach((k) => { sum.by[k] = D.r2(sum.by[k]); });
    const inv = all.filter((o) => o.inv || o.status !== 'new').sort((a, b) => (b.ts || 0) - (a.ts || 0)).slice(0, 80).map((o) => {
      const sp = {}; Object.keys(o.sp || {}).forEach((k) => { const x = o.sp[k] || {}; if (x.by || x.rby) sp[k] = x.rby || x.by; });
      return { id: o.id, no: o.no, inv: o.inv, ts: o.ts, day: o.day || s.day, total: o.total, refunded: o.refunded || 0, status: o.status, unpaid: !!o.unpaid, cancelled: !!o.cancelled, ch: o.ch, name: o.name || '', staff: o.staff || '', doneBy: o.doneBy || '', sp,
        pays: (o.pays || []).map((p) => ({ m: p.m, a: p.a })), lines: (o.lines || []).map((l) => ({ n: (D.prod(l.pid) || {}).ar || l.note || 'صنف', q: l.qty, t: l.total, note: l.pid === 'site_item' ? '' : l.note || '' })) };
    });
    const sh = (s.shifts || []).find((x) => !x.close); const names = {}; (s.staff || []).forEach((u) => { if (u && u.id) names[u.id] = u.name; });
    // كشف الوردية: الوردية المفتوحة، ولو مفيش فآخر وردية اتقفلت النهارده
    const rep = sh || (s.shifts || []).filter((x) => x.close).sort((a, b) => b.close - a.close)[0];
    let shiftRep = null;
    if (rep) {
      const t = D.shiftStats(s, rep); const by = {}; Object.keys(t.by).forEach((k) => { if (t.by[k]) by[k] = t.by[k]; });
      shiftRep = { id: rep.id, reg: rep.reg || 1, by: names[rep.user] || '', open: rep.open, close: rep.close || 0, z: rep.z || '', float: rep.float, count: t.count, total: t.total, refunds: t.refunds, net: D.r2(t.total - t.refunds), pays: by, payouts: t.payouts,
        expected: rep.close ? rep.expected : t.expected, counted: rep.close ? rep.counted : null, variance: rep.close ? rep.variance : null, closedBy: rep.closedBy ? names[rep.closedBy] || '' : '' };
    }
    return { v: 1, day: s.day, at: Date.now(), store: D.STORE.nameAr, sum, from: D.bizStart(Date.now()), hours: D.dayHours(), shiftRep, top: Object.values(items).sort((a, b) => b.q - a.q).slice(0, 6), inv, names, who: hubWho(),
      shift: sh ? { by: names[sh.user] || '', open: sh.open, float: sh.float, expected: D.expectedCash(s, sh) } : null, soldOut: Object.keys(s.avail || {}).filter((k) => s.avail[k] === false).length, lastInv: s.seq.inv || 0 };
  }
  L.phoneStats = phoneStats;
  L.hubWho = hubWho; // للاختبار ولأي شاشة محتاجة نفس الملخّص
  function snapNow() {
    clearTimeout(snapT); snapT = 0; if (!hasPeers()) return; lastSnapAt = Date.now(); send({ t: 'snap', snap: snapshot() });
    if (L.peers.some((p) => p.role === 'phone')) { try { send({ t: 'stats', stats: phoneStats() }); } catch (e) { console.error(e); } }
    try { sendDelta(); } catch (e) { console.error(e); }
  }
  function snapSoon() { if (!snapT) snapT = setTimeout(snapNow, 140); }
  const done = new Map(); // الأمر اللي اتنفّذ قبل كده مايتنفّذش تاني (لو الشاشة بعتته مرتين)
  function exec(m) {
    if (Math.abs(Date.now() - (m.ts || 0)) > 10 * 60000) { send({ t: 'ack', to: m.from, cid: m.cid, res: { ok: 0, err: 'clock' } }); return; } // أمر قديم أو ساعة الجهاز غلط: الشاشة تتبلّغ بدل ما تفضل مستنية
    let res = done.get(m.cid);
    if (!res) {
      let r = null;
      try { r = D.ACT[m.op] ? D.ACT[m.op](m.a || {}) : null; } catch (e) { console.error(e); }
      res = m.op === 'kiosk' ? (r ? { ok: 1, no: r.no, id: r.id, total: r.total, status: r.status, inv: r.inv } : { ok: 0 }) : m.op === 'signin' || m.op === 'signout' || m.op === 'pincheck' ? (r || { ok: 0 }) : { ok: 1 };
      if (m.op === 'signin' && r && r.ok && r.u && !(D.PREP_ROLES || {})[r.u.role]) authSet(m.from, { uid: r.u.id, at: Date.now() });
      if (m.op === 'signout') authSet(m.from, null);
      done.set(m.cid, res); if (done.size > 400) done.delete(done.keys().next().value);
    }
    send({ t: 'ack', to: m.from, cid: m.cid, res });
    snapSoon();
  }
  /* ---------- الكاشير من الجوال (role = remote) ----------
     الجهاز اللي دخل بموظف (مش باريستا/شيف) بياخد نسخة كاملة من المحل (من غير أرقام PIN ولا مفتاح الربط)،
     وبعدها بيوصله الفرق بس مع كل تغيير، وتعديلاته بتتطبق هنا وتتحفظ هنا. */
  const AUTHK = BASE + ':rauth', AUTH_MS = 20 * 3600000;
  const devOf = (from) => String(from || '').split('-')[0];
  function auths() { try { return JSON.parse(localStorage.getItem(AUTHK) || '{}') || {}; } catch (e) { return {}; } }
  function authSet(from, v) {
    const a = auths(); const k = devOf(from);
    if (v) a[k] = v; else delete a[k];
    Object.keys(a).forEach((x) => { if (!a[x] || Date.now() - a[x].at > AUTH_MS) delete a[x]; });
    try { localStorage.setItem(AUTHK, JSON.stringify(a)); } catch (e) { /* */ }
  }
  const authed = (from) => { const x = auths()[devOf(from)]; return !!(x && Date.now() - x.at < AUTH_MS && (D.STAFF || []).some((u) => u.id === x.uid && !u.off)); };
  function masked(s) { const o = {}; Object.keys(s).forEach((k) => { if (!SKIPK.has(k)) o[k] = s[k]; }); o.staff = (s.staff || []).map((u) => Object.assign({}, u, { pin: u.pin ? MASK : '' })); return o; }
  let cacheObj = null, cacheRev = -1;
  function sendFull(to) { const s = D.state(); const st = masked(s); cacheObj = clone(st); cacheRev = s.rev || 0; send({ t: 'full', to, rev: cacheRev, train: !!D.TRAIN, who: hubWho(), st }); }
  function sendDelta() {
    if (!cacheObj || !L.peers.some((p) => p.role === 'remote')) return;
    const s = D.state(); if ((s.rev || 0) === cacheRev) return;
    const st = masked(s); const d = diffState(cacheObj, st);
    const base = cacheRev; cacheObj = clone(st); cacheRev = s.rev || 0;
    send({ t: 'delta', base, rev: cacheRev, train: !!D.TRAIN, d });
  }
  function applyPut(m) {
    const reply = (res) => { done.set(m.cid, res); if (done.size > 400) done.delete(done.keys().next().value); send({ t: 'ack', to: m.from, cid: m.cid, res }); };
    if (done.has(m.cid)) { send({ t: 'ack', to: m.from, cid: m.cid, res: done.get(m.cid) }); return; }
    if (!authed(m.from)) { reply({ ok: 0, err: 'auth' }); return; }
    const bad = conflictOf(D.state(), m.d);
    if (bad) { reply({ ok: 0, err: 'conflict', k: bad }); return; }
    D.mutate((st) => applyDiff(st, m.d, true), 'remote');
    reply({ ok: 1, rev: D.state().rev || 0 });
    snapSoon();
  }
  function onHub(m) {
    if (m.t === 'hello') snapSoon();
    else if (m.t === 'cmd') exec(m);
    else if (m.t === 'full?') { if (authed(m.from)) sendFull(m.from); else send({ t: 'nofull', to: m.from }); }
    else if (m.t === 'put') applyPut(m);
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
    if (ROLE !== 'hub') { if (D.toast) D.toast('غير متاح من الجوال', 'إلغاء ربط الأجهزة من جهاز الكاشير نفسه', { warn: 1, ic: 'lock' }); return; }
    await hubDown();
    setSecret(rand());
    D.mutate(() => D.log(null, 'settings', 'إلغاء ربط كل الشاشات — مفتاح ربط جديد'), 'set');
    hubUp();
  };
  // أي تغيير في شاشات التحضير (حد دخل أو خرج أو الشاشة اتقفلت): الجوال يتحدّث على طول، والكاشير يرسم من جديد
  let dutySig = '';
  function dutyCheck() { const j = J(onDuty()); if (j === dutySig) return; dutySig = j; if (running && hasPeers()) snapSoon(); fire(); }
  function startHub() {
    setInterval(dutyCheck, 5000);
    window.addEventListener('storage', (e) => { if (e.key == null || e.key.indexOf(DUTY) === 0) setTimeout(dutyCheck, 50); });
    if (!L.ok) { L.status = 'off'; return; }
    D.hooks.cart = (c) => { if (running && hasPeers()) send({ t: 'cart', c }); }; // شاشة العميل على تابلت تاني
    D.on((why) => {
      if (!running) return;
      if (why === 'cart') { if (hasPeers()) send({ t: 'cart', c: D.readCart() }); return; }
      if (why === 'link') return;
      snapSoon();
    });
    L.on(() => { dutyCheck(); if (running && hasPeers() && Date.now() - lastSnapAt > 4000) snapSoon(); });
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
  const setWho = (w) => { if (!w) return; const changed = J(w) !== L.hubJ; L.hubJ = J(w); L.hub = w; if (changed) fire(); };
  function onSat(m) {
    if (m.t === 'snap' && m.snap && m.snap.who) setWho(m.snap.who);
    else if (m.t === 'stats' && m.stats && m.stats.who) setWho(m.stats.who);
    else if (m.t === 'full' && m.who) setWho(m.who);
    if (ROLE === 'remote' && remoteMsg(m)) return;
    if (m.t === 'snap' && m.snap) {
      L.last = Date.now();
      const was = L.live; L.live = true;
      skew = (m.ts || Date.now()) - Date.now(); D.skew = skew;
      lastSnap = JSON.stringify(m.snap); // نسخة نص: الحركة المتفائلة بتعدّل نفس الكائنات، فالرجوع لازم يبقى من نسخة منفصلة
      D.adopt(m.snap, 'remote');
      try { localStorage.setItem(SNAP, lastSnap); } catch (e) { /* */ }
      if (!was) fire();
    } else if (m.t === 'stats' && m.stats) {
      L.last = Date.now(); L.live = true; L.stats = m.stats; try { localStorage.setItem(BASE + ':stats', JSON.stringify(m.stats)); } catch (e) { /* */ } fire();
    } else if (m.t === 'cart') { L.last = Date.now(); remoteCart = m.c; D.adopt(D.state(), 'cart'); }
    else if (m.t === 'ack' && m.to === DEV) { const p = pending.get(m.cid); if (p) { pending.delete(m.cid); p(m.res); } }
  }
  function callT(msg) {
    const cid = 'c' + D.uid();
    return new Promise((res) => {
      pending.set(cid, res);
      let n = 0;
      const go = () => { if (!pending.has(cid)) return; if (n++ >= 6) { pending.delete(cid); res(null); return; } send(Object.assign({}, msg, { cid })); setTimeout(go, 2500); };
      go();
    });
  }
  const call = (op, a) => callT({ t: 'cmd', op, a });
  function startSat() {
    try { const c = JSON.parse(localStorage.getItem(SNAP) || 'null'); if (c && c.day === D.dayKey(Date.now())) { lastSnap = JSON.stringify(c); D.adopt(c, 'remote'); } } catch (e) { /* */ }
    D.readCart = () => remoteCart;
    const warn = (t, s) => { if (D.toast) D.toast(t, s, { warn: 1, ic: 'wifioff', ms: 5000 }); if (D.sound) D.sound('err'); };
    D.act = (op, a) => {
      a = a || {};
      if (op === 'kiosk') return call(op, a);
      if (op === 'signin' || op === 'signout') return L.hubOnline() ? call(op, a) : Promise.resolve(null); // الـPIN بيتراجع عند الكاشير
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

  /* =====================================================================
     REMOTE — الكاشير الكامل من الجوال (app.html على جهاز مربوط)
     ===================================================================== */
  let H = null, hR = -1, inflight = false, waitRev = -1, flushT = 0, askT = 0, denied = false, booted = false;
  function installR(pend) { const st = clone(H); if (pend) applyDiff(st, pend); st.rev = hR; D.satSet(st, 'remote'); if (pend) flushSoon(); }
  function askFull() { if (Date.now() - askT < 3000) return; askT = Date.now(); send({ t: 'full?' }); }
  function noAuth() {
    H = null; denied = true;
    try { sessionStorage.removeItem('darj:me'); } catch (e) { /* */ }
    if (booted) location.reload();
  }
  function remoteMsg(m) {
    if (m.t === 'full' && m.st) {
      if (H && m.rev === hR) return true;
      const pend = H ? diffState(H, D.state()) : null;
      H = m.st; hR = m.rev; D.TRAIN = !!m.train; D.REMOTE_REAL = !m.train;
      L.last = Date.now(); L.live = true;
      installR(pend); fire(); return true;
    }
    if (m.t === 'nofull') { if (m.to === DEV) noAuth(); return true; }
    if (m.t === 'delta') {
      if (!H) return true;
      L.last = Date.now(); L.live = true;
      if (m.base !== hR) { askFull(); return true; }
      const pend = diffState(H, D.state());
      if (m.d) applyDiff(H, m.d);
      hR = m.rev; D.TRAIN = !!m.train;
      installR(pend); return true;
    }
    if (H && (m.t === 'snap' || m.t === 'cart')) { // بعد النسخة الكاملة: اللقطة الصغيرة للشاشات التانية = نبضة بس
      L.last = Date.now(); const was = L.live; L.live = true;
      if (m.ts) { skew = m.ts - Date.now(); D.skew = skew; }
      if (!was) fire();
      return true;
    }
    return false;
  }
  function flushSoon() { if (!flushT) flushT = setTimeout(flush, 60); }
  function revert(t, s) {
    if (!H) return;
    const st = clone(H); st.rev = hR; D.satSet(st, 'remote');
    if (D.toast) D.toast(t, s, { warn: 1, ic: 'alert', ms: 7000 });
    if (D.sound) D.sound('err');
  }
  function flush() {
    flushT = 0;
    if (!H || inflight || hR < waitRev) return;
    const d = diffState(H, D.state());
    if (!d) return;
    if (!L.hubOnline()) { revert('الكاشير غير متصل الآن', 'لم يُحفظ التغيير — أعده بعد عودة الاتصال بكاشير المحل'); return; }
    inflight = true;
    callT({ t: 'put', d }).then((res) => {
      inflight = false;
      if (res && res.ok) {
        waitRev = res.rev;
        if (hR >= waitRev) flushSoon(); else setTimeout(() => { if (hR < waitRev) askFull(); }, 4000);
        return;
      }
      if (res && res.err === 'auth') { noAuth(); return; }
      revert(res && res.err === 'conflict' ? 'نفس البيانات اتغيّرت على الكاشير الآن' : 'لم يصل التغيير لكاشير المحل', 'البيانات اتحدّثت — أعد العملية');
      askFull();
    });
  }
  function waitBox() {
    const el = document.createElement('div');
    el.className = 'lock'; el.id = 'rmWait'; el.hidden = true;
    el.innerHTML = '<div class="lock__in" style="grid-template-columns:1fr;max-width:460px"><div class="lock__side" style="text-align:center;display:grid;gap:12px;justify-items:center"><div class="spin-dot"></div><b id="rmT" style="font-size:18px"></b><span id="rmS" class="muted" style="font-size:13px;line-height:1.8"></span></div></div>';
    document.body.appendChild(el);
    return {
      show: (t, s) => { el.hidden = false; el.querySelector('#rmT').textContent = t || ''; el.querySelector('#rmS').textContent = s || ''; },
      hide: () => { el.hidden = true; },
      done: () => el.remove(),
    };
  }
  function waitFull(ms) {
    return new Promise((res) => {
      const t0 = Date.now();
      const tick = () => { if (H) { res(true); return; } if (denied) { res(false); return; } if (ms && Date.now() - t0 > ms) { res(false); return; } askFull(); setTimeout(tick, 400); };
      tick();
    });
  }
  async function remoteFlow() {
    const G = window.DARJ_GATE;
    const ov = waitBox();
    const foot = CFG.phone ? `<a class="btn btn--ghost btn--sm" href="phone.html" style="margin-top:16px">${D.icon('chart', 'sm')}<span class="bi"><b>Today summary</b><small>ملخص اليوم فقط</small></span></a>` : '';
    for (;;) {
      ov.hide(); denied = false;
      await G.open({ where: 'الكاشير من الجوال', brand: 'Remote', label: 'Remote cashier', title: "Who's<br>managing?", foot,
        sub: 'ادخل باسمك ورقمك. أي حاجة تعملها هنا بتتنفّذ على كاشير المحل في نفس اللحظة، وبتتسجّل باسمك.',
        filter: (u) => !(D.PREP_ROLES || {})[u.role] });
      ov.show('جارٍ تحميل بيانات المحل…', 'من كاشير المحل مباشرة');
      if (await waitFull(15000)) break;
      if (denied) continue; // الدخول القديم انتهى: يدخل تاني
      ov.show('الكاشير غير متصل الآن', 'افتح الكاشير على جهاز المحل وتأكد من الإنترنت. الصفحة هتكمل لوحدها أول ما يتصل.');
      if (await waitFull(0)) break;
    }
    ov.done(); booted = true;
    if (window.DARJ_REMOTE_BOOT) window.DARJ_REMOTE_BOOT(); // حالة الربط ظاهرة في شريط الكاشير فوق
  }
  function startRemote() {
    startSat();
    const satMut = D.mutate;
    D.mutate = (fn, why) => { const r = satMut(fn, why); if (H) flushSoon(); return r; };
    D.act = (op, a) => {
      a = a || {};
      if (op === 'signin' || op === 'signout' || op === 'pincheck' || op === 'kiosk') return L.hubOnline() ? call(op, a) : Promise.resolve(null);
      return D.ACT[op] ? D.ACT[op](a) : null; // بيتنفّذ على النسخة هنا، والفرق بيروح للكاشير
    };
    if (window.DARJ_GATE) remoteFlow(); else document.addEventListener('DOMContentLoaded', remoteFlow);
  }

  if (ROLE === 'hub') setTimeout(startHub, 300);
  else if (ROLE === 'remote' && D.SAT) startRemote();
  else if (D.SAT) startSat();
})();
