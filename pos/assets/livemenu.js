/* محصول فاخر — منيو الكاشير بيتبع منيو الموقع
   الأصناف بتتعدّل من مكان واحد (لوحة الإدارة على الموقع). الملف ده بيتحمّل بعد menu.js وقبل darj.js:
   1) بيطبّق آخر نسخة محفوظة على الجهاز من كتالوج الموقع قبل ما الكاشير يقرا المنيو (شغال من غير نت).
   2) بيسحب الكتالوج العام من السيرفر (قراءة بس، بالمفتاح العام) ولو اتغيّر بيطبّقه على طول.
   قراءة فقط: الملف ده مابيكتبش أي حاجة على السيرفر. الأسعار والتوفّر للأصناف الموجودة فضلوا مسؤولية connect.js. */
(function (w) {
  'use strict';
  var M = w.DARJ_MENU, CFG = w.DARJ_CONFIG || {}, C = CFG.connect || {};
  if (!M || !C.url || !C.key || CFG.mode !== 'live') return;
  var KEY = (CFG.key || 'darj:v1') + ':catalog';
  var EVERY = C.catalogMs || 5 * 60000;
  var HOST = String(C.url).replace(/\/+$/, '');
  var clean = function (v, max) { return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max || 120); };
  var num = function (v) { var n = Number(v); return isFinite(n) && n >= 0 ? n : 0; };
  var DRINK = /قهو|مشروب|شاي|عصير|ماتشا|لاتيه|موهيتو|كركديه|اسبريسو|إسبريسو|v60|drink|coffee|tea|juice/i;

  function read() { try { var v = JSON.parse(w.localStorage.getItem(KEY) || 'null'); return v && v.v === 1 ? v : null; } catch (e) { return null; } }
  function write(v) { try { w.localStorage.setItem(KEY, JSON.stringify(v)); return true; } catch (e) { return false; } }
  // الصور المقبولة: من مخزن صور المشروع نفسه بس (نفس اللي سياسة الحماية سامحة بيه)
  function img(url) { url = String(url || ''); return url.indexOf(HOST + '/storage/v1/object/public/') === 0 ? url : ''; }
  function optOf(id) {
    id = (M.aliases && M.aliases[id]) || id;
    var hit = null;
    Object.keys(M.mods || {}).forEach(function (g) { (M.mods[g].opts || []).forEach(function (o) { if (o.id === id) hit = o; }); });
    return hit;
  }

  function apply(cat) {
    if (!cat || !Array.isArray(cat.products) || !cat.products.length) return 0;
    var n = 0, D = w.DARJ;
    var cats = M.cats, prods = M.products;
    var catOf = {}; cats.forEach(function (c) { catOf[c.id] = c; });
    var byId = {}; prods.forEach(function (p) { byId[p.id] = p; });
    var secs = (cat.sections || []).filter(function (s) { return s && s.id && s.is_active !== false; });
    var secOf = {}; secs.forEach(function (s) { secOf[s.id] = s; });
    // مجموعة الإضافات ونوع الصنف (مشروب/أكل) لكل قسم: من أول صنف أصلي فيه
    var like = {};
    prods.forEach(function (p) { if (!p.offer && !p._site && !like[p.cat]) like[p.cat] = p; });

    // الأقسام: الجديد يتضاف، والاسم والترتيب زي الموقع (قسم العروض آخر حاجة)
    secs.forEach(function (s) {
      var title = clean(s.title, 80); if (!title) return;
      var c = catOf[s.id];
      if (!c) { c = { id: s.id, ar: title, en: title, ic: 'cup', _site: 1 }; cats.push(c); catOf[s.id] = c; n++; }
      else if (clean(c.ar, 80) !== title) { c.ar = title; if (c._site) c.en = title; n++; }
    });
    var order = {}; secs.forEach(function (s, i) { order[s.id] = i; });
    var sorted = cats.slice().sort(function (a, b) {
      var x = a.id === 'offers' ? 1e6 : order[a.id] != null ? order[a.id] : 1e5;
      var y = b.id === 'offers' ? 1e6 : order[b.id] != null ? order[b.id] : 1e5;
      return x - y;
    });
    if (sorted.some(function (c, i) { return c !== cats[i]; })) { cats.length = 0; sorted.forEach(function (c) { cats.push(c); }); n++; }

    // إضافات الموقع: الاسم والسعر يتحدّثوا، والجديد يتضاف لمجموعة قسمه
    var extraGroup = {};
    (cat.addons || []).forEach(function (a) {
      if (!a || !a.id || a.is_active === false) return;
      var name = clean(a.name, 80), price = num(a.price), o = optOf(a.id);
      if (o) {
        if (name && o._n !== name && o.ar !== name) { o.ar = name; n++; }
        if (o.d !== price) { o.d = price; n++; }
        o._n = name;
        return;
      }
      var base = like[a.section_id], gid = base && base.mods && base.mods[0];
      if (!gid || gid === 'lcDefault') { gid = 'site_' + a.section_id; extraGroup[a.section_id] = gid; }
      if (!M.mods[gid]) { M.mods[gid] = { en: 'Extras', ar: 'الإضافات', one: 0, opts: [] }; if (D && D.MODS) D.MODS[gid] = M.mods[gid]; }
      M.mods[gid].opts.push({ id: a.id, ar: name, en: name, d: price, k: name, _n: name });
      n++;
    });
    function groupFor(sectionId) {
      if (extraGroup[sectionId]) return [extraGroup[sectionId]];
      var base = like[sectionId];
      return base && base.mods && base.mods.length ? base.mods.slice() : (M.mods.lcDefault ? ['lcDefault'] : []);
    }
    function drinkFor(sectionId) {
      var base = like[sectionId];
      if (base) return !!base.drink;
      var s = secOf[sectionId];
      return DRINK.test((s && s.title) || '');
    }

    // الأصناف (ومعاها اللي اتشالت من الموقع بعد ما اتباعت هنا، عشان فواتير اليوم تفضل باسمها)
    var live = {}; cat.products.forEach(function (r) { if (r && r.id) live[r.id] = 1; });
    (cat.kept || []).filter(function (r) { return r && r.id && !live[r.id]; }).concat(cat.products).forEach(function (r) {
      if (!r || !r.id || r.is_active === false) return;
      var name = clean(r.name, 120); if (!name) return;
      var p = byId[r.id];
      if (!p) {
        if (!catOf[r.section_id]) return;
        p = { id: r.id, cat: r.section_id, ar: name, online: name, en: name, desc: clean(r.description, 300), price: num(r.price),
          img: img(r.image_url), drink: drinkFor(r.section_id), mods: groupFor(r.section_id), r: {}, _site: 1 };
        if (!live[r.id]) p._kept = 1;
        prods.push(p); byId[r.id] = p; n++;
        return;
      }
      if (p.offer) return;
      if (clean(p.online, 120) !== name) { p.online = name; p.ar = name; if (p._site) p.en = name; n++; }
      if (catOf[r.section_id] && p.cat !== r.section_id) { p.cat = r.section_id; p.mods = groupFor(r.section_id); p.drink = drinkFor(r.section_id); n++; }
      if (p._site) {
        var price = num(r.price), pic = img(r.image_url), desc = clean(r.description, 300);
        if (p.price !== price) { p.price = price; n++; }
        if (pic && p.img !== pic) { p.img = pic; n++; }
        if (p.desc !== desc) { p.desc = desc; n++; }
      }
    });

    // العروض
    (cat.offers || []).forEach(function (r) {
      if (!r || !r.id || r.is_active === false) return;
      var name = clean(r.name, 120); if (!name) return;
      var p = byId[r.id], desc = clean(r.description, 300), price = num(r.price), was = num(r.original_price);
      if (!p) {
        if (!catOf.offers) return;
        prods.push({ id: r.id, cat: 'offers', ar: name, online: name, en: name, desc: desc, price: price, was: was || undefined,
          img: img(r.image_url), drink: true, mods: [], r: {}, offer: 1, _site: 1 });
        byId[r.id] = prods[prods.length - 1]; n++;
        return;
      }
      if (!p.offer) return;
      if (clean(p.online, 120) !== name) { p.online = name; p.ar = name; if (p._site) p.en = name; n++; }
      if (p.desc !== desc) { p.desc = desc; n++; }
      if (was && p.was !== was) { p.was = was; n++; }
      if (p._site && p.price !== price) { p.price = price; n++; }
    });
    return n;
  }

  function get(table, cols) {
    return w.fetch(HOST + '/rest/v1/' + table + '?select=' + cols + '&order=sort_order', { headers: { apikey: C.key }, cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error(table + ' ' + r.status); return r.json(); })
      .then(function (rows) { if (!Array.isArray(rows)) throw new Error(table); return rows; });
  }
  var busy = false;
  function refresh() {
    if (busy || (w.navigator && w.navigator.onLine === false)) return Promise.resolve(0);
    busy = true;
    return Promise.all([
      get('menu_sections', 'id,title,is_active,sort_order'),
      get('products', 'id,name,description,section_id,image_url,price,is_active,sort_order'),
      get('offers', 'id,name,description,image_url,price,original_price,is_active,sort_order'),
      get('addons', 'id,section_id,name,price,is_active,sort_order')
    ]).then(function (res) {
      // كتالوج ناقص (شبكة مقطوعة في النص، أو رد فاضي) مايتطبّقش أبدًا
      if (!res[0].length || !res[1].length) return 0;
      var next = { v: 1, sections: res[0], products: res[1], offers: res[2], addons: res[3] };
      var prev = read();
      var same = prev && JSON.stringify([prev.sections, prev.products, prev.offers, prev.addons]) === JSON.stringify([next.sections, next.products, next.offers, next.addons]);
      if (same) return 0;
      // صنف كان في الموقع واتشال: يفضل معروف للكاشير (موقوف) بدل ما فواتيره تظهر «صنف محذوف»
      var now = {}; next.products.forEach(function (r) { now[r.id] = 1; });
      var kept = {};
      ((prev && prev.kept) || []).concat((prev && prev.products) || []).forEach(function (r) { if (r && r.id && !now[r.id]) kept[r.id] = r; });
      next.kept = Object.keys(kept).slice(-150).map(function (k) { return kept[k]; });
      next.at = Date.now();
      write(next);
      var n = apply(next);
      if (n) {
        var D = w.DARJ;
        try { if (D && D.state && D.PRODUCTS) D.PRODUCTS.forEach(function (p) { if (!p.r) p.r = {}; }); } catch (e) { /* */ }
        try { w.dispatchEvent(new w.CustomEvent('darj:catalog', { detail: { changes: n } })); } catch (e) { /* */ }
      }
      return n;
    }).catch(function () { return 0; }).then(function (n) { busy = false; return n; });
  }

  var first = apply(read());
  w.DARJ_LIVEMENU = { refresh: refresh, apply: apply, cached: read, applied: first };
  w.setTimeout(refresh, 1200);
  w.setInterval(refresh, EVERY);
  w.addEventListener('online', function () { w.setTimeout(refresh, 800); });
})(window);
