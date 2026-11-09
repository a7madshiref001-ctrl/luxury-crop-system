/* DARJ — شاشات التحضير (KDS): الباريستا والمطبخ
   kds.html?st=bar · kds.html?st=kitchen · وتاب «Stations» جوه الكاشير (فيه «الكل» كمان)
   كل شاشة بتشوف نصيبها بس من الطلب، وتحت منه سطر صغير بنصيب الشاشة التانية عشان التسليم يبقى مع بعض. */
(function () {
  'use strict';
  const D = window.DARJ;
  const K = (window.DARJ_KDS = {});
  const T = {
    ar: { new: 'جديد', make: 'قيد التحضير', ready: 'جاهز', start: 'ابدأ التحضير', done: 'جاهز', picked: 'تم التسليم', empty: 'لا توجد طلبات', allday: 'المطلوب الآن', wait: 'بانتظار', back: 'رجوع', with: 'مع الطلب', ok: 'جاهز', mk: 'قيد التحضير', q: 'لم يبدأ' },
    en: { new: 'New', make: 'Making', ready: 'Ready', start: 'Start', done: 'Ready', picked: 'Picked up', empty: 'Nothing here', allday: 'All-day', wait: 'Waiting for', back: 'Undo', with: 'With order', ok: 'ready', mk: 'making', q: 'queued' },
  };
  const stName = (st, lang) => (D.STATIONS[st] ? D.STATIONS[st][lang === 'en' ? 'en' : 'ar'] : '');
  const age = (o, at, now) => {
    const stage = D.stStage(o, at, now);
    const sp = (o.sp || {})[at] || {};
    return now - (stage === 'ready' ? (sp.ready || o.tsReady || now) : (o.tsAcc || o.ts));
  };
  const nm = (p, lang) => D.esc(lang === 'en' ? p.en : p.ar);
  const alt = (p, lang) => D.esc(lang === 'en' ? p.ar : p.en);

  function lineHTML(o, l, i, lang, tag) {
    const p = D.prod(l.pid); if (!p) return '';
    const chips = D.modList(l).filter(({ o: op }) => op.k).map(({ o: op, g }) => `<span class="${g === 'size' ? 'soft' : ''}">${op.k}</span>`).join('');
    const done = (o.lineDone || []).includes(i);
    const v = (o.voided && o.voided[i]) || 0;
    const left = l.qty - v;
    const tg = tag ? `<span class="kt__st kt__st--${D.lineRoute(D.state(), l)}">${D.esc(D.ROUTE[D.lineRoute(D.state(), l)][lang === 'en' ? 'en' : 'ar'])}</span>` : '';
    const desc = p.desc ? `<div class="ar">${D.esc(p.desc)}</div>` : `<div class="ar">${alt(p, lang)}</div>`;
    if (v) return `<div class="kt__l done void"><b>${left || l.qty}</b><div><div class="nm">${nm(p, lang)}${tg}</div><div class="mods"><span class="void">${lang === 'en' ? 'VOID' : 'ملغي'} −${v}</span></div></div></div>` + (left ? `<div class="kt__l" data-line="${i}" data-id="${o.id}" data-done="${done ? 1 : 0}"><b>${left}</b><div><div class="nm">${nm(p, lang)}${tg}</div>${chips ? `<div class="mods">${chips}</div>` : ''}</div></div>` : '');
    return `<div class="kt__l${done ? ' done' : ''}" data-line="${i}" data-id="${o.id}" data-done="${done ? 1 : 0}"><b>${l.qty}</b><div><div class="nm">${nm(p, lang)}${tg}</div>${desc}${chips ? `<div class="mods">${chips}</div>` : ''}${l.note ? `<div class="note">${D.esc(l.note)}</div>` : ''}</div></div>`;
  }

  function where(o, lang) {
    const en = lang === 'en';
    if (o.ch === 'table') return en ? `Table ${o.table}` : `طاولة ${o.table}`;
    if (o.ch === 'pickup') return en ? 'Web pickup' : 'استلام من الموقع';
    const ty = D.TYPES[o.type] || D.TYPES.takeaway;
    if (o.ch === 'kiosk') return `${en ? 'Kiosk' : 'الكشك'} · ${en ? ty.en : ty.ar}`;
    return en ? ty.en : ty.ar;
  }

  function ticket(o, at, now, lang) {
    const t = T[lang];
    const S = D.state();
    const col = D.stStage(o, at, now);
    const a = age(o, at, now);
    const cls = col === 'ready' ? 'ready' : a > 7 * 60000 ? 'late' : a > 4 * 60000 ? 'warn' : '';
    const ch = D.CH[o.ch] || D.CH.counter;
    const mine = o.lines.map((l, i) => (D.lineIn(S, l, at) ? lineHTML(o, l, i, lang, at === 'all') : '')).join('');
    // نصيب الشاشة التانية من نفس الطلب
    let others = '';
    if (at !== 'all') {
      const by = {};
      o.lines.forEach((l, i) => {
        if (D.lineIn(S, l, at) || D.liveQty(o, i) <= 0) return;
        const r = D.lineRoute(S, l); if (r === 'none') return;
        (by[r] = by[r] || []).push(`${D.liveQty(o, i)}× ${nm(D.prod(l.pid), lang)}`);
      });
      others = Object.entries(by).map(([r, xs]) => {
        const sg = r === 'both' ? '' : D.stStage(o, r, now);
        const pill = sg ? `<span class="kt__os kt__os--${sg}">${sg === 'ready' ? t.ok : sg === 'make' ? t.mk : t.q}</span>` : '';
        return `<div class="kt__other">${D.icon(D.ROUTE[r].ic, 'sm')}<span><b>${t.with} · ${D.esc(D.ROUTE[r][lang === 'en' ? 'en' : 'ar'])}</b> ${xs.join(' · ')}</span>${pill}</div>`;
      }).join('');
    }
    let foot;
    if (col === 'new') foot = `<button class="btn btn--ink btn--sm" data-op="start" data-id="${o.id}">${t.start}</button>`;
    else if (col === 'make') foot = `<button class="btn btn--go btn--sm" data-op="ready" data-id="${o.id}">${t.done}</button>`;
    else if (o.status === 'ready') foot = `<button class="btn btn--ghost btn--sm" data-op="pickup" data-id="${o.id}">${t.picked}</button><button class="btn btn--soft btn--sm kt__back" data-op="back" data-id="${o.id}" title="${t.back}">${D.icon('refund', 'sm')}</button>`;
    else {
      const wait = D.stationsOf(S, o).filter((x) => x !== at && D.stStage(o, x, now) !== 'ready').map((x) => stName(x, lang)).join(' · ');
      foot = `<span class="kt__wait">${D.icon('clock', 'sm')}${t.wait} ${D.esc(wait)}</span><button class="btn btn--soft btn--sm kt__back" data-op="back" data-id="${o.id}" title="${t.back}">${D.icon('refund', 'sm')}</button>`;
    }
    const primary = col === 'new' ? 'start' : col === 'make' ? 'ready' : o.status === 'ready' ? 'pickup' : '';
    return `<article class="kt ${cls}${o._in ? ' in' : ''}" data-id="${o.id}" data-col="${col}">
      <div class="kt__h" ${primary ? `data-op="${primary}" data-id="${o.id}"` : ''}><div><b>#${o.no}</b><span class="kt__ch">${D.icon(ch.ic, 'sm')}${D.esc(where(o, lang))}${o.name ? ' · ' + D.esc(o.name) : ''}</span></div><span class="kt__time" data-t="${o.id}">${D.mmss(a)}</span></div>
      <div class="kt__lines">${mine}${others}</div>
      <div class="kt__f">${foot}</div>
    </article>`;
  }

  K.mount = (el, opt) => {
    opt = opt || {};
    let lang = opt.lang || 'en';
    let at = opt.st || 'bar';
    let seen = new Set();
    let first = true;
    function draw() {
      const S = D.state();
      const now = Date.now();
      const t = T[lang];
      const act = S.orders.filter((o) => (o.status === 'prep' || o.status === 'ready') && D.forStation(S, o, at));
      const cols = { new: [], make: [], ready: [] };
      act.forEach((o) => { cols[D.stStage(o, at, now)].push(o); });
      cols.new.sort((a, b) => a.ts - b.ts); cols.make.sort((a, b) => a.ts - b.ts);
      cols.ready.sort((a, b) => ((((b.sp || {})[at] || {}).ready || b.tsReady || 0) - ((((a.sp || {})[at] || {}).ready) || a.tsReady || 0)));
      // صوت لما يوصل طلب جديد للشاشة دي
      let fresh = false;
      act.forEach((o) => { o._in = false; if (!seen.has(o.id)) { seen.add(o.id); if (!first) { fresh = true; o._in = true; } } });
      if (fresh && opt.sound !== false) D.sound('new');
      first = false;
      const allday = {};
      [...cols.new, ...cols.make].forEach((o) => o.lines.forEach((l, i) => { const n = D.liveQty(o, i); if (n > 0 && D.lineIn(S, l, at)) allday[l.pid] = (allday[l.pid] || 0) + n; }));
      const ad = Object.entries(allday).sort((a, b) => b[1] - a[1]).map(([id, n]) => `<span><b>${n}</b> ${nm(D.prod(id), lang)}</span>`).join('');
      const col = (k, title) => `<section class="kds__col"><div class="kds__h"><b>${title}</b><span>${cols[k].length}</span></div>${cols[k].map((o) => ticket(o, at, now, lang)).join('') || `<div class="empty">${D.icon(at === 'kitchen' ? 'flame' : 'cup')}<span>${t.empty}</span></div>`}</section>`;
      el.innerHTML = `${ad ? `<div class="allday"><span class="label" style="border:0;background:none;padding:0">${t.allday}</span>${ad}</div>` : ''}<div class="kds">${col('new', t.new)}${col('make', t.make)}${col('ready', t.ready)}</div>`;
    }
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-op]');
      const ln = e.target.closest('[data-line]');
      if (ln && !b) { D.act('line', { id: ln.dataset.id, i: +ln.dataset.line, done: ln.dataset.done !== '1' }); return; }
      if (!b) return;
      const op = b.dataset.op, id = b.dataset.id;
      const r = D.act(op, { id, st: at });
      if (op === 'ready') { const o = D.state().orders.find((x) => x.id === id); if (o && o.status === 'ready') D.sound('ready'); else D.sound('ok'); if (r && typeof r.then === 'function') r.then(() => {}); }
    });
    const off = D.on((why) => { if (why !== 'cart') draw(); });
    const timer = setInterval(() => {
      const now = Date.now(); const S = D.state();
      el.querySelectorAll('[data-t]').forEach((n) => { const o = S.orders.find((x) => x.id === n.dataset.t); if (o) n.textContent = D.mmss(age(o, at, now)); });
    }, 1000);
    const slow = setInterval(draw, 15000);
    const loop = opt.sound === false ? 0 : D.alertLoop(() => { const S = D.state(); const now = Date.now(); return S.orders.some((o) => o.status === 'prep' && D.forStation(S, o, at) && D.stStage(o, at, now) === 'new'); });
    draw();
    return {
      setLang(l) { lang = l; draw(); },
      setSt(s) { at = s; seen = new Set(); first = true; draw(); },
      get st() { return at; },
      destroy() { off(); clearInterval(timer); clearInterval(slow); clearInterval(loop); },
    };
  };
})();
