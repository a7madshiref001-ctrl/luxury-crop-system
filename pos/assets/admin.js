/* محصول فاخر — إدارة الموقع من جوّه الكاشير (صفحة Website)
   للمدير فقط (صلاحية الإعدادات). كل تعديل هنا بيتكتب في قاعدة بيانات الموقع مباشرة، فيظهر في منيو العملاء وفي الكاشير.
   الأمان: الكتابة مسموحة لحساب الإدارة بس (RLS). لو جهاز الكاشير داخل بحساب كاشير، المدير بيدخل حساب الإدارة هنا مرة واحدة
   والدخول بيفضل محفوظ على الجهاز (بطلب صاحب المحل) لحد ما يضغط «خروج». الصفحة نفسها بتفتح بـPIN المدير بس، وكلمة المرور نفسها مابتتحفظش. */
(function () {
  'use strict';
  const D = window.DARJ;
  const CFG = window.DARJ_CONFIG || {};
  const C = CFG.connect || {};
  if (!D || !C.url || !C.key || !C.enabled) return;
  const esc = D.esc;
  const I = (n, c) => D.icon(n, c);
  const bi = (en, ar) => `<span class="bi"><b>${en}</b><small>${ar}</small></span>`;
  const SITE = String(C.site || 'https://www.luxurycrop.site').replace(/\/+$/, '');
  const HOST = String(C.url).replace(/\/+$/, '');
  const money = (v) => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
  const clean = (v, max) => String(v == null ? '' : v).trim().slice(0, max);
  const uid = () => (window.crypto && crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : String(Date.now()) + Math.random().toString(16).slice(2, 10));
  const ICONS = [['hot', 'مشروبات ساخنة'], ['cold', 'مشروبات باردة'], ['v60', 'V60 وتقطير'], ['sweet', 'حلويات ومخبوزات'], ['dallah', 'قهوة سعودية']];
  const TABS = [
    { id: 'items', ic: 'cup', en: 'Items', ar: 'الأصناف' },
    { id: 'offers', ic: 'gift', en: 'Offers', ar: 'العروض' },
    { id: 'sections', ic: 'menu', en: 'Sections', ar: 'أقسام المنيو' },
    { id: 'ordering', ic: 'orders', en: 'Ordering', ar: 'استقبال الطلبات' },
    { id: 'qr', ic: 'qr', en: 'QR points', ar: 'الطاولات والـQR' },
    { id: 'links', ic: 'link', en: 'Links', ar: 'الروابط' },
    { id: 'account', ic: 'lock', en: 'Account', ar: 'حساب الإدارة' },
  ];

  let tab = 'items', view = null, ctx = null;
  let adm = null, admEmail = '', own = false; // own = جلسة إدارة في الذاكرة (مش جلسة الجهاز)
  let gate = 'checking'; // checking | login | ready | error
  let data = null, busy = false, secFilter = '', query = '';

  /* ---------- الدخول ---------- */
  async function resolve() {
    if (adm) return adm;
    // connect.js بيتحمّل بعد الكاشير: لو الصفحة اتفتحت أول ما الكاشير اشتغل، استنى لحد ما الاتصال يجهز
    for (let i = 0; i < 40 && !(window.DARJ_CONNECT && window.DARJ_CONNECT.client); i++) await new Promise((r) => setTimeout(r, 100));
    const X = window.DARJ_CONNECT;
    if (!X || !X.client) throw new Error('connect');
    const c = await X.client();
    const a = await X.access();
    if (a && a.admin) { adm = c; own = false; const s = await c.auth.getSession(); admEmail = (s.data && s.data.session && s.data.session.user.email) || ''; return adm; }
    // دخول إدارة محفوظ على الجهاز من مرة سابقة
    const k = adminClient();
    const got = await k.auth.getSession();
    const u = got && got.data && got.data.session && got.data.session.user;
    if (!u) return null;
    const ok = await k.from('admin_users').select('user_id').eq('user_id', u.id).maybeSingle();
    if (ok.error) throw ok.error;
    if (!ok.data) { try { await k.auth.signOut({ scope: 'local' }); } catch (e) { /* */ } return null; }
    adm = k; own = true; admEmail = u.email || '';
    return adm;
  }
  let saved = null;
  function adminClient() {
    if (!saved) saved = window.supabase.createClient(C.url, C.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'luxurycrop-pos-admin' } });
    return saved;
  }
  async function signIn(email, password) {
    const c = adminClient();
    const out = await c.auth.signInWithPassword({ email: clean(email, 180), password: String(password || '') });
    if (out.error) throw new Error('bad');
    const ok = await c.from('admin_users').select('user_id').eq('user_id', out.data.user.id).maybeSingle();
    if (ok.error || !ok.data) { try { await c.auth.signOut({ scope: 'local' }); } catch (e) { /* */ } throw new Error('denied'); }
    adm = c; own = true; admEmail = out.data.user.email || '';
  }

  /* ---------- البيانات ---------- */
  async function load() {
    const res = await Promise.all([
      adm.from('menu_sections').select('*').order('sort_order'),
      adm.from('products').select('*').order('sort_order'),
      adm.from('offers').select('*').order('sort_order'),
      adm.from('service_points').select('*').order('sort_order'),
      adm.from('store_settings').select('*').eq('id', 1).single(),
    ]);
    res.forEach((r) => { if (r.error) throw r.error; });
    data = { sections: res[0].data || [], products: res[1].data || [], offers: res[2].data || [], points: res[3].data || [], settings: res[4].data || {} };
  }
  const now = () => new Date().toISOString();
  async function saveProduct(p) {
    const row = { id: clean(p.id, 80), name: clean(p.name, 120), description: clean(p.description, 500), section_id: clean(p.section_id, 50), price: Number(p.price),
      image_url: clean(p.image_url, 500), size_prices: Array.isArray(p.size_prices) && p.size_prices.length ? p.size_prices.map(Number) : null,
      is_active: p.is_active !== false, sold_out: !!p.sold_out, sort_order: Number(p.sort_order) || 0, updated_at: now() };
    const out = await adm.from('products').upsert(row).select().single();
    if (out.error) throw out.error;
    return out.data;
  }
  async function saveOffer(o) {
    const row = { id: clean(o.id, 80), name: clean(o.name, 120), description: clean(o.description, 300), image_url: clean(o.image_url, 500), price: Number(o.price),
      original_price: Number(o.original_price), parts: (o.parts || []).slice(0, 10).map((x) => clean(x, 80)), is_active: o.is_active !== false, sort_order: Number(o.sort_order) || 0, updated_at: now() };
    const out = await adm.from('offers').upsert(row).select().single();
    if (out.error) throw out.error;
    return out.data;
  }
  async function saveSection(s) {
    const row = { id: clean(s.id, 50), title: clean(s.title, 80), description: clean(s.description, 240), icon: clean(s.icon, 20) || 'hot', is_active: s.is_active !== false, sort_order: Number(s.sort_order) || 0, updated_at: now() };
    const out = await adm.from('menu_sections').upsert(row).select().single();
    if (out.error) throw out.error;
    return out.data;
  }
  async function saveSettings(patch) {
    const s = Object.assign({}, data.settings, patch);
    const row = { tables_count: Number(s.tables_count), ordering_open: !!s.ordering_open, smart_locations_required: !!s.smart_locations_required, updated_at: now() };
    const out = await adm.from('store_settings').update(row).eq('id', 1).select().single();
    if (out.error) throw out.error;
    data.settings = out.data;
  }
  async function savePoint(p) {
    const row = { kind: clean(p.kind, 12), label: clean(p.label, 80), reference_no: clean(p.reference_no, 40), is_active: p.is_active !== false, sort_order: Number(p.sort_order) || 0, updated_at: now() };
    if (p.id) row.id = p.id;
    const out = await adm.from('service_points').upsert(row).select().single();
    if (out.error) throw out.error;
    return out.data;
  }
  async function renewPoint(id) {
    const token = crypto.randomUUID();
    const out = await adm.from('service_points').update({ token, updated_at: now() }).eq('id', id).select().single();
    if (out.error) throw out.error;
  }
  async function reorder(table, ids) {
    const at = now();
    const res = await Promise.all(ids.map((id, i) => adm.from(table).update({ sort_order: (i + 1) * 10, updated_at: at }).eq('id', id)));
    res.forEach((r) => { if (r.error) throw r.error; });
  }
  async function prepareImage(file) {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 8 * 1024 * 1024) throw new Error('invalid_image');
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(bmp.width * scale)); cv.height = Math.max(1, Math.round(bmp.height * scale));
    cv.getContext('2d', { alpha: false }).drawImage(bmp, 0, 0, cv.width, cv.height);
    if (bmp.close) bmp.close();
    return new Promise((ok, no) => cv.toBlob((b) => (b ? ok(b) : no(new Error('image_convert_failed'))), 'image/webp', 0.86));
  }
  async function upload(bucket, id, file) {
    const path = clean(id, 80) + '/cover.webp';
    const b = adm.storage.from(bucket);
    const out = await b.upload(path, await prepareImage(file), { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
    if (out.error) throw out.error;
    return b.getPublicUrl(path).data.publicUrl + '?v=' + Date.now();
  }
  // بعد أي تعديل: الكاشير يسحب الكتالوج الجديد على طول بدل ما يستنى الدورة الجاية
  function ripple(text) {
    try { if (window.DARJ_LIVEMENU) window.DARJ_LIVEMENU.refresh(); } catch (e) { /* */ }
    try { if (window.DARJ_CONNECT && window.DARJ_CONNECT.resync) window.DARJ_CONNECT.resync(); } catch (e) { /* */ }
    try { if (text && ctx) D.mutate(() => D.log(ctx.me(), 'settings', 'الموقع — ' + text), 'log'); } catch (e) { /* */ }
  }

  /* ---------- أدوات العرض ---------- */
  function pic(url, id) {
    url = String(url || '');
    if (url.indexOf(HOST + '/storage/v1/object/public/') === 0) return url;
    if (url && !/^[a-z]+:/i.test(url) && url.indexOf('//') !== 0) return SITE + '/' + url.replace(/^\/+/, '');
    try { if (id && D.has(id) && id !== 'site_item') return D.img(D.prod(id)) || ''; } catch (e) { /* */ }
    return '';
  }
  const thumb = (url, id) => { const u = pic(url, id); return `<span class="thumb adm-thumb"${u ? ` style="background-image:url('${esc(u)}')"` : ''}></span>`; };
  const sw = (key, on, label) => `<button class="switch${on ? ' on' : ''}" data-sw="${esc(key)}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(label || '')}"></button>`;
  const secName = (id) => { const s = data.sections.find((x) => x.id === id); return s ? s.title : '—'; };
  const fail = (e) => {
    const code = String((e && e.message) || '');
    const denied = e && (e.code === '42501' || /permission|row-level|jwt/i.test(code));
    D.toast(code === 'invalid_image' ? 'الصورة غير مناسبة' : denied ? 'الحساب غير مصرّح له بالتعديل' : 'لم يتم الحفظ',
      code === 'invalid_image' ? 'JPG أو PNG أو WebP وبحد أقصى 8 ميجا' : denied ? 'ادخل بحساب الإدارة من Account' : 'تأكد من الإنترنت وحاول مرة ثانية', { warn: 1, ic: 'alert', ms: 6000 });
  };
  async function act(fn, done, logText) {
    if (busy) return false;
    busy = true;
    try { await fn(); await load(); if (done) D.toast(done, logText ? 'ظهر في الموقع، والكاشير بيتحدّث الآن' : '', { ic: 'check', ms: 3500 }); if (logText) ripple(logText); paint(); return true; }
    catch (e) { fail(e); return false; }
    finally { busy = false; }
  }
  function qrSvg(url) {
    if (typeof window.qrcode !== 'function') return '';
    const q = window.qrcode(0, 'M'); q.addData(url, 'Byte'); q.make();
    return q.createSvgTag({ cellSize: 6, margin: 4, scalable: true });
  }
  function qrModal(title, url) {
    const m = D.modal(`${D.head(esc(title), 'امسح الكود أو انسخ الرابط')}
      <div class="modal__b"><div class="adm-qr">${qrSvg(url)}</div><div class="adm-url mono" dir="ltr">${esc(url)}</div></div>
      <div class="modal__f"><button class="btn btn--ghost" data-copy>${bi('Copy link', 'نسخ الرابط')}</button><button class="btn btn--ink" data-close>${bi('Done', 'تم')}</button></div>`, { cls: 'modal--sm' });
    m.querySelector('[data-copy]').addEventListener('click', () => copy(url));
  }
  function copy(text) {
    if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => D.toast('تم نسخ الرابط', text, { ic: 'check', ms: 2500 })).catch(() => D.toast('الرابط', text, { ms: 8000 }));
    else D.toast('الرابط', text, { ms: 8000 });
  }
  const pointUrl = (p) => SITE + '/?loc=' + encodeURIComponent(p.token);
  const field = (label, name, value, o) => `<label class="field"><span>${label}</span><input class="input${o && o.mono ? ' mono' : ''}" name="${name}" value="${esc(value == null ? '' : value)}" ${(o && o.attrs) || ''}></label>`;

  /* ---------- المحرّرات ---------- */
  function editor(title, sub, body, onSave, saveLabel) {
    const m = D.modal(`${D.head(title, sub || '')}
      <form class="adm-form" novalidate><div class="modal__b grid" style="gap:12px">${body}<div class="adm-err" data-err></div></div>
      <div class="modal__f"><button class="btn btn--ghost" type="button" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--ink" type="submit">${saveLabel || bi('Save', 'حفظ')}</button></div></form>`, { sticky: 1 });
    const form = m.querySelector('form');
    const err = (t) => { m.querySelector('[data-err]').innerHTML = t ? `<div class="blind" style="color:var(--red)">${esc(t)}</div>` : ''; };
    m.querySelectorAll('.switch[data-f]').forEach((b) => b.addEventListener('click', () => { b.classList.toggle('on'); b.setAttribute('aria-checked', b.classList.contains('on') ? 'true' : 'false'); }));
    const file = m.querySelector('input[type=file]');
    if (file) file.addEventListener('change', () => { const f = file.files[0]; const box = m.querySelector('.adm-preview'); if (f && box) { box.style.backgroundImage = `url('${URL.createObjectURL(f)}')`; box.textContent = ''; } });
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const v = {};
      new FormData(form).forEach((val, key) => { v[key] = val; });
      m.querySelectorAll('.switch[data-f]').forEach((b) => { v[b.dataset.f] = b.classList.contains('on'); });
      const btn = form.querySelector('[type=submit]');
      err('');
      let problem = '';
      try { problem = onSave.check ? onSave.check(v) : ''; } catch (x) { problem = 'راجع القيم'; }
      if (problem) { err(problem); return; }
      btn.disabled = true;
      const ok = await act(() => onSave.run(v, file && file.files[0]), onSave.done, onSave.log && onSave.log(v));
      btn.disabled = false;
      if (ok) m.close();
    });
    const first = m.querySelector('input.input'); if (first) setTimeout(() => first.focus(), 60);
    return m;
  }
  const imageField = (label, url, id) => { const u = pic(url, id); return `<label class="field"><span>${label}</span><div class="adm-image"><span class="adm-preview"${u ? ` style="background-image:url('${esc(u)}')"` : ''}>${u ? '' : 'لا توجد صورة'}</span><input class="adm-file" name="image" type="file" accept="image/jpeg,image/png,image/webp"></div><small class="muted">صورة واحدة. الجديدة تستبدل الحالية.</small></label>`; };
  const toggleRow = (key, on, title, sub) => `<div class="set-row"><span><b>${title}</b><small>${sub}</small></span><button type="button" class="switch${on ? ' on' : ''}" data-f="${key}" role="switch" aria-checked="${on ? 'true' : 'false'}" aria-label="${esc(title)}"></button></div>`;
  const price = (v) => { const n = Number(v); return v !== '' && isFinite(n) && n >= 0 && n <= 10000; };

  function editProduct(id) {
    const cur = id ? data.products.find((x) => x.id === id) : null;
    const p = cur || { id: 'p_' + uid(), name: '', description: '', section_id: secFilter || (data.sections[0] || {}).id || '', price: '', size_prices: null, image_url: '', is_active: true, sold_out: false, sort_order: (data.products.length + 1) * 10 };
    const opts = data.sections.filter((s) => s.is_active !== false || s.id === p.section_id).map((s) => `<option value="${esc(s.id)}"${s.id === p.section_id ? ' selected' : ''}>${esc(s.title)}</option>`).join('');
    editor(cur ? bi('Edit item', 'تعديل الصنف') : bi('New item', 'صنف جديد'), 'يظهر في منيو الموقع وفي الكاشير',
      `${field('الاسم', 'name', p.name, { attrs: 'maxlength="120" required' })}${field('الوصف (اختياري)', 'description', p.description, { attrs: 'maxlength="500"' })}
       <div class="grid g2"><label class="field"><span>القسم</span><select class="select" name="section_id">${opts}</select></label>${field('السعر (ر.س)', 'price', p.price, { mono: 1, attrs: 'type="number" inputmode="decimal" min="0" max="10000" step="0.01" required' })}</div>
       ${imageField('صورة الصنف', p.image_url, cur ? p.id : '')}
       ${toggleRow('is_active', p.is_active !== false, 'ظاهر في المنيو', 'اقفله عشان تخفي الصنف من الموقع والكاشير')}${toggleRow('sold_out', !!p.sold_out, 'خلص مؤقتًا', 'يظهر للعميل «غير متاح» لحد ما ترجّعه')}`,
      { check: (v) => (!clean(v.name, 120) ? 'اكتب اسم الصنف' : !v.section_id ? 'اختر القسم' : !price(v.price) ? 'السعر لازم يكون رقم من 0 إلى 10000' : ''),
        run: async (v, file) => { let url = p.image_url || ''; if (file && file.size) url = await upload('product-images', p.id, file); await saveProduct(Object.assign({}, p, { name: v.name, description: v.description, section_id: v.section_id, price: Number(v.price), image_url: url, is_active: v.is_active, sold_out: v.sold_out })); },
        done: cur ? 'تم حفظ الصنف' : 'تمت إضافة الصنف', log: (v) => (cur ? 'تعديل صنف: ' : 'صنف جديد: ') + clean(v.name, 60) + ' — ' + money(v.price) + ' ر.س' });
  }
  function editOffer(id) {
    const cur = id ? data.offers.find((x) => x.id === id) : null;
    const o = cur || { id: 'offer_' + uid(), name: '', description: '', image_url: '', price: '', original_price: '', parts: [], is_active: true, sort_order: (data.offers.length + 1) * 10 };
    editor(cur ? bi('Edit offer', 'تعديل العرض') : bi('New offer', 'عرض جديد'), 'يظهر في قسم العروض في الموقع والكاشير',
      `${field('اسم العرض', 'name', o.name, { attrs: 'maxlength="120" required' })}${field('الوصف', 'description', o.description, { attrs: 'maxlength="300"' })}
       <div class="grid g2">${field('سعر العرض (ر.س)', 'price', o.price, { mono: 1, attrs: 'type="number" inputmode="decimal" min="0" step="0.01" required' })}${field('السعر الأصلي (ر.س)', 'original_price', o.original_price, { mono: 1, attrs: 'type="number" inputmode="decimal" min="0" step="0.01" required' })}</div>
       ${field('محتويات العرض، بينها فاصلة', 'parts', (o.parts || []).join('، '), { attrs: 'maxlength="400" placeholder="لاتيه حار، كوكيز فانيليا"' })}
       ${imageField('صورة العرض', o.image_url, cur ? o.id : '')}${toggleRow('is_active', o.is_active !== false, 'ظاهر في المنيو', 'اقفله عشان توقف العرض')}`,
      { check: (v) => (!clean(v.name, 120) ? 'اكتب اسم العرض' : !price(v.price) || !price(v.original_price) ? 'اكتب السعرين بأرقام صحيحة' : Number(v.original_price) < Number(v.price) ? 'السعر الأصلي لازم يكون مساويًا أو أكبر من سعر العرض' : !String(v.parts || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean).length ? 'اكتب محتويات العرض' : ''),
        run: async (v, file) => { let url = o.image_url || ''; if (file && file.size) url = await upload('offer-images', o.id, file); await saveOffer(Object.assign({}, o, { name: v.name, description: v.description, price: Number(v.price), original_price: Number(v.original_price), image_url: url, parts: String(v.parts || '').split(/[,،]/).map((x) => x.trim()).filter(Boolean), is_active: v.is_active })); },
        done: cur ? 'تم حفظ العرض' : 'تمت إضافة العرض', log: (v) => (cur ? 'تعديل عرض: ' : 'عرض جديد: ') + clean(v.name, 60) });
  }
  function editSection(id) {
    const cur = id ? data.sections.find((x) => x.id === id) : null;
    const s = cur || { id: 'section_' + uid().slice(0, 16), title: '', description: '', icon: 'hot', is_active: true, sort_order: (data.sections.length + 1) * 10 };
    editor(cur ? bi('Edit section', 'تعديل القسم') : bi('New section', 'قسم جديد'), 'الأقسام بتظهر بنفس الترتيب في الموقع والكاشير',
      `${field('اسم القسم', 'title', s.title, { attrs: 'maxlength="80" required' })}${field('وصف مختصر (اختياري)', 'description', s.description, { attrs: 'maxlength="240"' })}
       <label class="field"><span>الأيقونة في الموقع</span><select class="select" name="icon">${ICONS.map(([k, t]) => `<option value="${k}"${k === (s.icon || 'hot') ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
       ${toggleRow('is_active', s.is_active !== false, 'ظاهر في المنيو', 'اقفله عشان تخفي القسم كله')}`,
      { check: (v) => (!clean(v.title, 80) ? 'اكتب اسم القسم' : ''),
        run: (v) => saveSection(Object.assign({}, s, { title: v.title, description: v.description, icon: v.icon, is_active: v.is_active })),
        done: cur ? 'تم حفظ القسم' : 'تمت إضافة القسم', log: (v) => (cur ? 'تعديل قسم: ' : 'قسم جديد: ') + clean(v.title, 60) });
  }
  function editPoint(id) {
    const cur = id ? data.points.find((x) => x.id === id) : null;
    const p = cur || { kind: 'hall', label: '', reference_no: '', is_active: true, sort_order: (data.points.length + 1) * 10 };
    editor(cur ? bi('Edit point', 'تعديل نقطة الخدمة') : bi('New point', 'نقطة خدمة جديدة'), 'كود عام للمكان، أو كود خاص لكل طاولة أو غرفة',
      `<label class="field"><span>المكان</span><select class="select" name="kind"><option value="hall"${p.kind === 'hall' ? ' selected' : ''}>الكافيه / الصالة</option><option value="hotel"${p.kind === 'hotel' ? ' selected' : ''}>الفندق</option></select></label>
       ${field('الاسم الظاهر للعميل', 'label', p.label, { attrs: 'maxlength="80" placeholder="طاولة 4" required' })}${field('الرقم أو المرجع (اختياري)', 'reference_no', p.reference_no, { mono: 1, attrs: 'maxlength="40" placeholder="4"' })}
       ${toggleRow('is_active', p.is_active !== false, 'النقطة نشطة', 'اقفلها عشان الكود يتوقف عن استقبال الطلبات')}`,
      { check: (v) => (!clean(v.label, 80) ? 'اكتب اسم النقطة' : ''),
        run: (v) => savePoint(Object.assign({}, p, { kind: v.kind, label: v.label, reference_no: v.reference_no, is_active: v.is_active })),
        done: cur ? 'تم حفظ النقطة' : 'تمت إضافة النقطة', log: (v) => 'نقطة خدمة: ' + clean(v.label, 60) });
  }
  function confirmWord(title, note, word, go) {
    const m = D.modal(`${D.head(title, note)}<div class="modal__b"><div class="blind" style="color:var(--red)">اكتب كلمة «${word}» للتأكيد.</div><input class="input" data-w style="margin-top:12px"></div>
      <div class="modal__f"><button class="btn btn--ghost" data-close>${bi('Cancel', 'إلغاء')}</button><button class="btn btn--danger" data-go>${bi('Confirm', 'تأكيد')}</button></div>`, { cls: 'modal--sm' });
    m.querySelector('[data-go]').addEventListener('click', () => { if (m.querySelector('[data-w]').value.trim() !== word) { m.querySelector('[data-w]').focus(); return; } m.close(); go(); });
  }

  /* ---------- التابات ---------- */
  const rowBtns = (kind, id, i, n) => `<span class="adm-move"><button class="icon-btn" data-up="${kind}:${esc(id)}" ${i === 0 ? 'disabled' : ''} aria-label="أعلى">↑</button><button class="icon-btn" data-down="${kind}:${esc(id)}" ${i === n - 1 ? 'disabled' : ''} aria-label="أسفل">↓</button></span>`;
  const empty = (t) => `<div class="adm-empty">${t}</div>`;
  function tabItems() {
    const q = query.trim().toLowerCase();
    const rank = {}; data.sections.forEach((s, i) => { rank[s.id] = i; });
    const list = data.products.filter((p) => (!secFilter || p.section_id === secFilter) && (!q || String(p.name).toLowerCase().includes(q)))
      .sort((x, y) => ((rank[x.section_id] == null ? 999 : rank[x.section_id]) - (rank[y.section_id] == null ? 999 : rank[y.section_id])) || ((x.sort_order || 0) - (y.sort_order || 0)));
    const hidden = data.products.filter((p) => p.is_active === false).length, out = data.products.filter((p) => p.sold_out).length;
    return `<div class="card"><div class="card__h"><h3><span class="label">Items</span>${data.products.length} صنف · ${out} خلص · ${hidden} مخفي</h3><button class="btn btn--ink btn--sm" data-add="product">${I('plus', 'sm')}${bi('Add item', 'صنف جديد')}</button></div>
      <div class="adm-tools"><select class="select" data-sec aria-label="القسم"><option value="">كل الأقسام</option>${data.sections.map((s) => `<option value="${esc(s.id)}"${s.id === secFilter ? ' selected' : ''}>${esc(s.title)}</option>`).join('')}</select>
        <input class="input" data-q type="search" placeholder="ابحث باسم الصنف…" value="${esc(query)}" autocomplete="off"></div>
      <div class="adm-list">${list.length ? list.map((p, i) => `<div class="adm-row${p.is_active === false ? ' off' : ''}">${thumb(p.image_url, p.id)}
          <span class="adm-n"><b>${esc(p.name)}</b><small>${esc(secName(p.section_id))} · <span class="mono">${money(p.price)}</span> ر.س${p.is_active === false ? ' · مخفي' : ''}</small></span>
          <span class="adm-a">${secFilter && !q ? rowBtns('products', p.id, i, list.length) : ''}<span class="adm-sw"><small>${p.sold_out ? 'خلص' : 'متاح'}</small>${sw('avail:' + p.id, !p.sold_out, 'متاح: ' + p.name)}</span><button class="btn btn--ghost btn--sm" data-edit="product:${esc(p.id)}">${bi('Edit', 'تعديل')}</button></span></div>`).join('') : empty('لا توجد أصناف بهذا البحث.')}</div>
      ${secFilter ? '' : '<p class="muted adm-hint">اختر قسمًا عشان ترتّب الأصناف داخله بالأسهم.</p>'}</div>`;
  }
  function tabOffers() {
    return `<div class="card"><div class="card__h"><h3><span class="label">Offers</span>${data.offers.length} عرض</h3><button class="btn btn--ink btn--sm" data-add="offer">${I('plus', 'sm')}${bi('Add offer', 'عرض جديد')}</button></div>
      <div class="adm-list">${data.offers.length ? data.offers.map((o, i) => `<div class="adm-row${o.is_active === false ? ' off' : ''}">${thumb(o.image_url, o.id)}
          <span class="adm-n"><b>${esc(o.name)}</b><small><span class="mono">${money(o.price)}</span> ر.س بدل <span class="mono">${money(o.original_price)}</span> · ${esc((o.parts || []).join(' + '))}</small></span>
          <span class="adm-a">${rowBtns('offers', o.id, i, data.offers.length)}<span class="adm-sw"><small>${o.is_active === false ? 'متوقف' : 'شغّال'}</small>${sw('offer:' + o.id, o.is_active !== false, 'تشغيل العرض: ' + o.name)}</span><button class="btn btn--ghost btn--sm" data-edit="offer:${esc(o.id)}">${bi('Edit', 'تعديل')}</button></span></div>`).join('') : empty('لا توجد عروض بعد.')}</div></div>`;
  }
  function tabSections() {
    return `<div class="card"><div class="card__h"><h3><span class="label">Sections</span>${data.sections.length} قسم</h3><button class="btn btn--ink btn--sm" data-add="section">${I('plus', 'sm')}${bi('Add section', 'قسم جديد')}</button></div>
      <div class="adm-list">${data.sections.map((s, i) => { const n = data.products.filter((p) => p.section_id === s.id).length; return `<div class="adm-row${s.is_active === false ? ' off' : ''}">
          <span class="adm-n"><b>${esc(s.title)}</b><small>${n} صنف${s.is_active === false ? ' · مخفي' : ''}${s.description ? ' · ' + esc(s.description) : ''}</small></span>
          <span class="adm-a">${rowBtns('menu_sections', s.id, i, data.sections.length)}<button class="btn btn--ghost btn--sm" data-edit="section:${esc(s.id)}">${bi('Edit', 'تعديل')}</button></span></div>`; }).join('')}</div>
      <p class="muted adm-hint">أول قسم هنا هو أول قسم يشوفه العميل، وبنفس الترتيب في الكاشير.</p></div>`;
  }
  function tabOrdering() {
    const s = data.settings;
    return `<div class="card" style="max-width:720px"><div class="card__h"><h3><span class="label">Ordering</span>استقبال طلبات الموقع</h3><span class="pill ${s.ordering_open !== false ? 'pill--go' : 'pill--amber'}">${s.ordering_open !== false ? 'مفتوح' : 'مقفول'}</span></div>
      <div class="set-row"><span><b>${bi('Accept orders', 'استقبال الطلبات')}</b><small>اقفله لو المحل مقفول أو مزحوم؛ المنيو يفضل ظاهر من غير زر الطلب</small></span>${sw('set:ordering_open', s.ordering_open !== false, 'استقبال الطلبات')}</div>
      <div class="set-row"><span><b>${bi('QR only', 'الطلب من QR فقط')}</b><small>العميل لازم يمسح كود الطاولة. فعّله بعد طباعة الأكواد</small></span>${sw('set:smart_locations_required', !!s.smart_locations_required, 'الطلب من QR فقط')}</div>
      <div class="set-row"><span><b>${bi('Tables', 'عدد الطاولات')}</b><small>يظهر للعميل لما يختار رقم الطاولة</small></span><span class="adm-inline"><input class="input mono" data-tables type="number" inputmode="numeric" min="1" max="500" value="${esc(s.tables_count)}" aria-label="عدد الطاولات"><button class="btn btn--ghost btn--sm" data-save-tables>${bi('Save', 'حفظ')}</button></span></div></div>`;
  }
  function tabQr() {
    const group = (kind, title) => { const list = data.points.filter((p) => p.kind === kind); return `<div class="card"><div class="card__h"><h3><span class="label">${kind === 'hall' ? 'Hall' : 'Hotel'}</span>${title} · ${list.length}</h3></div>
      <div class="adm-list">${list.length ? list.map((p) => `<div class="adm-row${p.is_active === false ? ' off' : ''}"><span class="adm-n"><b>${esc(p.label)}</b><small>${p.reference_no ? 'مرجع ' + esc(p.reference_no) : 'كود عام'}${p.is_active === false ? ' · متوقف' : ''}</small></span>
        <span class="adm-a"><button class="btn btn--ghost btn--sm" data-qr="${esc(p.id)}">${I('qr', 'sm')}QR</button><button class="btn btn--ghost btn--sm" data-edit="point:${esc(p.id)}">${bi('Edit', 'تعديل')}</button><button class="icon-btn" data-renew="${esc(p.id)}" aria-label="تجديد الكود" title="تجديد الكود">${I('sync', 'sm')}</button></span></div>`).join('') : empty('لا توجد نقاط بعد.')}</div></div>`; };
    return `<div class="adm-bar"><p class="muted">كل نقطة لها كود خاص. الطلب اللي يجي منها يوصل باسمها في الكاشير.</p><button class="btn btn--ink btn--sm" data-add="point">${I('plus', 'sm')}${bi('Add point', 'نقطة جديدة')}</button></div>
      <div class="grid g2" style="align-items:start">${group('hall', 'طاولات الصالة')}${group('hotel', 'الفندق')}</div>`;
  }
  function tabLinks() {
    const links = [['Menu', 'منيو العملاء', SITE + '/'], ['Phone view', 'المتابعة من الجوال', C.mobile || SITE + '/live'], ['Cashier', 'الكاشير', SITE + '/pos/'], ['Kiosk', 'الكشك', SITE + '/pos/kiosk']];
    return `<div class="card" style="max-width:720px"><div class="card__h"><h3><span class="label">Links</span>روابط النظام</h3></div>
      ${links.map(([en, ar, url], i) => `<div class="set-row"><span><b>${bi(en, ar)}</b><small class="mono" dir="ltr">${esc(url.replace(/^https?:\/\//, ''))}</small></span><span class="adm-a"><button class="btn btn--ghost btn--sm" data-link-qr="${i}">${I('qr', 'sm')}QR</button><button class="btn btn--ghost btn--sm" data-link-copy="${i}">${bi('Copy', 'نسخ')}</button></span></div>`).join('')}
      <p class="muted adm-hint">أكواد الطاولات والفندق من تابة QR points.</p></div>`;
  }
  function tabAccount() {
    return `<div class="card" style="max-width:720px"><div class="card__h"><h3><span class="label">Account</span>حساب الإدارة</h3><span class="pill pill--go">${I('check', 'sm')}داخل</span></div>
      <div class="set-row"><span><b class="mono" dir="ltr">${esc(admEmail)}</b><small>${own ? 'الدخول محفوظ على هذا الجهاز. اضغط خروج لو الجهاز هيتغيّر' : 'نفس حساب ربط الكاشير بالسيرفر'}</small></span>${own ? `<button class="btn btn--ghost btn--sm" data-adm-out>${bi('Sign out', 'خروج')}</button>` : ''}</div>
      <div class="set-row"><span><b>${bi('Change password', 'تغيير كلمة المرور')}</b><small>12 حرفًا على الأقل: كبيرة وصغيرة ورقم ورمز</small></span><button class="btn btn--ghost btn--sm" data-pass>${bi('Change', 'تغيير')}</button></div></div>`;
  }
  function changePassword() {
    editor(bi('Change password', 'تغيير كلمة مرور الإدارة'), 'تُرسل مباشرة للسيرفر ولا تُحفظ على الجهاز',
      `${field('كلمة المرور الجديدة', 'p1', '', { mono: 1, attrs: 'type="password" autocomplete="new-password" minlength="12" maxlength="128"' })}${field('تأكيد كلمة المرور', 'p2', '', { mono: 1, attrs: 'type="password" autocomplete="new-password" minlength="12" maxlength="128"' })}`,
      { check: (v) => { const p = String(v.p1 || ''); return p.length < 12 ? 'استخدم 12 حرفًا على الأقل' : ![/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].every((r) => r.test(p)) ? 'لازم تشمل حروفًا كبيرة وصغيرة ورقمًا ورمزًا' : p !== v.p2 ? 'كلمتا المرور غير متطابقتين' : ''; },
        run: async (v) => { const out = await adm.auth.updateUser({ password: String(v.p1) }); if (out.error) throw out.error; }, done: 'تم تغيير كلمة المرور', log: () => 'تغيير كلمة مرور الإدارة' });
  }

  /* ---------- الرسم ---------- */
  function frame(body, withTabs) {
    view.className = 'view';
    view.innerHTML = `<div data-admroot hidden></div><div class="vh"><div><span class="label">Website · ${esc(SITE.replace(/^https?:\/\//, ''))}</span><h1>Website</h1><p>الأصناف وإعدادات الموقع من مكان واحد. أي تعديل هنا يظهر في منيو العملاء وفي الكاشير.</p></div>${withTabs ? `<button class="btn btn--ghost btn--sm" data-reload>${I('sync', 'sm')}${bi('Refresh', 'تحديث')}</button>` : ''}</div>
      ${withTabs ? `<div class="sets"><nav class="sets__nav" aria-label="أقسام إدارة الموقع"><div class="sets__list">${TABS.map((t) => `<button class="sets__i${t.id === tab ? ' on' : ''}" data-tab="${t.id}">${I(t.ic, 'sm')}${bi(t.en, t.ar)}${I('chev', 'sm sets__c')}</button>`).join('')}</div></nav>
        <div class="sets__body"><div class="sets__t"><h2>${TABS.find((t) => t.id === tab).en}</h2><span>${TABS.find((t) => t.id === tab).ar}</span></div>${body}</div></div>` : body}`;
  }
  function paint() {
    if (!view || !view.isConnected) return;
    if (!D.REAL) { frame(`<div class="card" style="max-width:560px"><div class="blind">${I('lock', 'sm')}<span>وضع التدريب لا يعدّل الموقع. اخرج من التدريب عشان تفتح إدارة الموقع.</span></div></div>`); return; }
    if (gate === 'checking') { frame(`<div class="card" style="max-width:560px"><div class="blind">${I('sync', 'sm')}<span>جاري فتح إدارة الموقع…</span></div></div>`); return; }
    if (gate === 'error') { frame(`<div class="card" style="max-width:560px"><div class="blind" style="color:var(--red)">${I('alert', 'sm')}<span>تعذّر الاتصال بالسيرفر. تأكد من الإنترنت.</span></div><button class="btn btn--ink btn--block" data-retry style="margin-top:12px">${bi('Try again', 'إعادة المحاولة')}</button></div>`); view.querySelector('[data-retry]').addEventListener('click', open); return; }
    if (gate === 'login') {
      frame(`<form class="card adm-login" novalidate><div class="card__h"><h3><span class="label">Admin</span>دخول الإدارة</h3>${I('lock')}</div>
        <p class="muted" style="margin-bottom:12px">ادخل حساب الإدارة مرة واحدة على هذا الجهاز. بعدها الصفحة تفتح للمدير مباشرة.</p>
        <div class="grid" style="gap:12px"><label class="field"><span>البريد</span><input class="input mono" name="email" type="email" autocomplete="username" dir="ltr" required></label>
        <label class="field"><span>كلمة المرور</span><input class="input mono" name="password" type="password" autocomplete="current-password" dir="ltr" required></label>
        <div data-err></div><button class="btn btn--ink btn--block" type="submit">${bi('Sign in', 'دخول')}</button></div></form>`);
      const form = view.querySelector('form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = form.querySelector('[type=submit]'); btn.disabled = true;
        const err = (t) => { form.querySelector('[data-err]').innerHTML = `<div class="blind" style="color:var(--red)">${t}</div>`; };
        try { await signIn(form.email.value, form.password.value); form.password.value = ''; gate = 'checking'; paint(); await load(); gate = 'ready'; D.mutate(() => D.log(ctx.me(), 'settings', 'دخول إدارة الموقع'), 'log'); paint(); }
        catch (x) { btn.disabled = false; const c = String(x && x.message); if (gate !== 'login') { gate = 'error'; paint(); return; } err(c === 'bad' ? 'البريد أو كلمة المرور غير صحيحة' : c === 'denied' ? 'الحساب ده مش حساب إدارة' : 'تعذّر الاتصال. تأكد من الإنترنت'); }
      });
      return;
    }
    const body = { items: tabItems, offers: tabOffers, sections: tabSections, ordering: tabOrdering, qr: tabQr, links: tabLinks, account: tabAccount }[tab]();
    const keep = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-q]');
    frame(body, true);
    if (keep) { const q = view.querySelector('[data-q]'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } }
    const list = view.querySelector('.sets__list'), on = view.querySelector('.sets__i.on');
    if (on && list && list.scrollWidth > list.clientWidth) list.scrollLeft += on.getBoundingClientRect().left - list.getBoundingClientRect().left - (list.clientWidth - on.offsetWidth) / 2;
  }
  async function move(table, id, dir) {
    const list = table === 'products' ? data.products.filter((p) => p.section_id === secFilter) : table === 'offers' ? data.offers : data.sections;
    const ids = list.map((x) => x.id), i = ids.indexOf(id), j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    ids.splice(j, 0, ids.splice(i, 1)[0]);
    await act(() => reorder(table, ids), '', 'تغيير ترتيب المنيو');
  }
  function onClick(e) {
    const t = e.target;
    let b;
    if ((b = t.closest('[data-tab]'))) { if (b.dataset.tab !== tab) { tab = b.dataset.tab; paint(); } return; }
    if (gate !== 'ready' || busy) return;
    if (t.closest('[data-reload]')) { act(async () => {}, 'تم تحديث البيانات', ''); return; }
    if ((b = t.closest('[data-add]'))) { ({ product: editProduct, offer: editOffer, section: editSection, point: editPoint })[b.dataset.add](''); return; }
    if ((b = t.closest('[data-edit]'))) { const [k, id] = b.dataset.edit.split(/:(.*)/); ({ product: editProduct, offer: editOffer, section: editSection, point: editPoint })[k](id); return; }
    if ((b = t.closest('[data-up]'))) { const [k, id] = b.dataset.up.split(/:(.*)/); move(k, id, -1); return; }
    if ((b = t.closest('[data-down]'))) { const [k, id] = b.dataset.down.split(/:(.*)/); move(k, id, 1); return; }
    if ((b = t.closest('[data-sw]'))) {
      const [k, id] = b.dataset.sw.split(/:(.*)/);
      if (k === 'avail') { const p = data.products.find((x) => x.id === id); if (p) act(() => saveProduct(Object.assign({}, p, { sold_out: !p.sold_out })), p.sold_out ? 'رجع متاح' : 'اتقفل: خلص', (p.sold_out ? 'صنف رجع متاح: ' : 'صنف خلص: ') + p.name); }
      else if (k === 'offer') { const o = data.offers.find((x) => x.id === id); if (o) act(() => saveOffer(Object.assign({}, o, { is_active: o.is_active === false })), o.is_active === false ? 'العرض اشتغل' : 'العرض اتوقف', 'عرض: ' + o.name); }
      else if (k === 'set') { const cur = id === 'ordering_open' ? data.settings.ordering_open !== false : !!data.settings[id]; act(() => saveSettings({ [id]: !cur }), 'تم الحفظ', (id === 'ordering_open' ? 'استقبال الطلبات: ' : 'الطلب من QR فقط: ') + (!cur ? 'مفعّل' : 'مقفول')); }
      return;
    }
    if (t.closest('[data-save-tables]')) { const n = Number(view.querySelector('[data-tables]').value); if (!(n >= 1 && n <= 500) || n !== Math.round(n)) { D.toast('عدد الطاولات غير صحيح', 'رقم من 1 إلى 500', { warn: 1, ic: 'alert' }); return; } act(() => saveSettings({ tables_count: n }), 'تم حفظ عدد الطاولات', 'عدد الطاولات: ' + n); return; }
    if ((b = t.closest('[data-qr]'))) { const p = data.points.find((x) => x.id === b.dataset.qr); if (p) qrModal('QR · ' + p.label, pointUrl(p)); return; }
    if ((b = t.closest('[data-renew]'))) { const p = data.points.find((x) => x.id === b.dataset.renew); if (p) confirmWord(bi('Renew code', 'تجديد كود ' + esc(p.label)), 'الكود المطبوع القديم يتوقف فورًا ولازم تطبع الجديد', 'تجديد', () => act(() => renewPoint(p.id), 'تم إنشاء كود جديد', 'تجديد كود: ' + p.label)); return; }
    const links = [SITE + '/', C.mobile || SITE + '/live', SITE + '/pos/', SITE + '/pos/kiosk'];
    if ((b = t.closest('[data-link-qr]'))) { qrModal('QR', links[Number(b.dataset.linkQr)]); return; }
    if ((b = t.closest('[data-link-copy]'))) { copy(links[Number(b.dataset.linkCopy)]); return; }
    if (t.closest('[data-pass]')) { changePassword(); return; }
    if (t.closest('[data-adm-out]')) { const c = adm; adm = null; own = false; admEmail = ''; data = null; gate = 'login'; try { c.auth.signOut({ scope: 'local' }); } catch (x) { /* */ } paint(); }
  }
  function onInput(e) {
    if (e.target.matches('[data-q]')) { query = e.target.value; paint(); }
  }
  function onChange(e) {
    if (e.target.matches('[data-sec]')) { secFilter = e.target.value; paint(); }
  }
  async function open() {
    gate = 'checking'; paint();
    try {
      const c = await resolve();
      if (!c) { gate = 'login'; paint(); return; }
      await load();
      gate = 'ready';
    } catch (e) {
      const denied = e && (e.code === '42501' || /permission|jwt/i.test(String(e.message || '')));
      if (adm && denied) adm = null;
      gate = denied || (!adm && navigator.onLine !== false && String(e && e.message) !== 'connect') ? 'login' : 'error';
    }
    paint();
  }
  function render(el, c) {
    ctx = c;
    if (view !== el) {
      view = el;
      if (!el.dataset.adm) { el.dataset.adm = '1'; const mine = () => view === el && !!el.querySelector('[data-admroot]'); el.addEventListener('click', (e) => { if (mine()) onClick(e); }); el.addEventListener('input', (e) => { if (mine()) onInput(e); }); el.addEventListener('change', (e) => { if (mine()) onChange(e); }); }
    }
    if (!D.REAL) { paint(); return; }
    if (gate === 'ready' && data) { paint(); act(async () => {}, '', ''); return; }
    open();
  }

  window.DARJ_PAGES = (window.DARJ_PAGES || []).concat([{ id: 'site', en: 'Website', ar: 'الموقع والأصناف', ic: 'globe', perm: 'settings', render }]);
  window.DARJ_ADMIN = { test: /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? { state: () => ({ gate, tab, own, email: admEmail, data }), reset() { adm = null; saved = null; own = false; data = null; gate = 'checking'; } } : null };
})();
