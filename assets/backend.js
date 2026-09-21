(function (w) {
  "use strict";

  var cfg = w.BACKEND_CONFIG || {};
  var client = null;
  var channel = null;

  function configured() {
    return /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(String(cfg.url || "")) &&
      String(cfg.publishableKey || "").length > 40;
  }

  function init() {
    if (!configured()) return null;
    if (!w.supabase || !w.supabase.createClient) throw new Error("تعذّر تحميل عميل قاعدة البيانات");
    if (!client) {
      client = w.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
        global: { headers: { "X-Client-Info": "luxury-crop-web/1.0" } }
      });
    }
    return client;
  }

  function cleanText(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  async function loadCatalog() {
    var c = init();
    if (!c) return null;
    var res = await Promise.all([
      c.from("products").select("id,name,description,price,size_prices,is_active,sold_out,sort_order").order("sort_order"),
      c.from("offers").select("id,name,description,image_url,price,original_price,parts,is_active,sort_order").order("sort_order"),
      c.from("addons").select("id,section_id,name,price,is_active,sort_order").order("sort_order"),
      c.from("store_settings").select("tables_count,ordering_open").eq("id", 1).maybeSingle()
    ]);
    res.forEach(function (r) { if (r.error) throw r.error; });
    return { products: res[0].data || [], offers: res[1].data || [], addons: res[2].data || [], settings: res[3].data || null };
  }

  function applyCatalog(menu, sales, data) {
    if (!data) return;
    var byId = {};
    (data.products || []).forEach(function (p) { byId[p.id] = p; });
    (menu.sections || []).forEach(function (section) {
      (section.cats || []).forEach(function (cat) {
        cat.items = (cat.items || []).filter(function (item) {
          var p = byId[item.k];
          if (!p) return true;
          item.n = cleanText(p.name, 120) || item.n;
          item.d = cleanText(p.description, 500);
          item._remoteSoldOut = !!p.sold_out;
          item._dbId = p.id;
          if (Array.isArray(p.size_prices) && p.size_prices.length) item.s = p.size_prices.map(Number);
          else item.p = Number(p.price);
          return p.is_active !== false;
        });
      });
      section.cats = (section.cats || []).filter(function (cat) { return cat.items.length; });
    });
    menu.sections = (menu.sections || []).filter(function (section) { return section.cats.length; });
    if (data.offers && data.offers.length) {
      sales.combos = data.offers.filter(function (x) { return x.is_active !== false; }).map(function (x) {
        return { id: x.id, n: x.name, d: x.description, img: x.image_url, p: Number(x.price),
          was: Number(x.original_price), parts: Array.isArray(x.parts) ? x.parts : [] };
      });
    }
    if (data.addons && data.addons.length) {
      sales.addons = {};
      data.addons.filter(function (x) { return x.is_active !== false; }).forEach(function (x) {
        if (!sales.addons[x.section_id]) sales.addons[x.section_id] = [];
        sales.addons[x.section_id].push({ id: x.id, n: x.name, p: Number(x.price) });
      });
    }
    if (data.settings) {
      sales.order.tables = Number(data.settings.tables_count) || sales.order.tables;
      sales.order.open = data.settings.ordering_open !== false;
    }
  }

  async function placeOrder(payload) {
    var c = init();
    if (!c) throw new Error("نظام الطلبات قيد التجهيز");
    var safe = {
      table_no: Number(payload.table_no),
      customer_name: cleanText(payload.customer_name, 60),
      customer_phone: cleanText(payload.customer_phone, 20),
      idempotency_key: cleanText(payload.idempotency_key, 80),
      client_id: cleanText(payload.client_id, 80),
      lines: (payload.lines || []).slice(0, 40).map(function (line) {
        return { kind: cleanText(line.kind, 12), id: cleanText(line.id, 80), qty: Number(line.qty),
          size_index: line.size_index == null ? null : Number(line.size_index), note: cleanText(line.note, 120) };
      })
    };
    var out = await c.rpc("place_order", { p_order: safe });
    if (out.error) throw out.error;
    return out.data;
  }

  async function signIn(email, password) {
    var c = init();
    if (!c) throw new Error("أكمل إعداد قاعدة البيانات أولًا");
    var out = await c.auth.signInWithPassword({ email: cleanText(email, 180), password: String(password || "") });
    if (out.error) throw out.error;
    var allowed = await c.from("admin_users").select("user_id,display_name").eq("user_id", out.data.user.id).maybeSingle();
    if (allowed.error || !allowed.data) {
      await c.auth.signOut();
      throw new Error("هذا الحساب غير مصرح له بإدارة المتجر");
    }
    return { session: out.data.session, profile: allowed.data };
  }

  async function session() {
    var c = init();
    if (!c) return null;
    var out = await c.auth.getSession();
    return out.data && out.data.session || null;
  }

  async function signOut() { var c = init(); if (c) await c.auth.signOut(); }

  async function updatePassword(password) {
    var c = init();
    if (!c) throw new Error("أكمل إعداد قاعدة البيانات أولًا");
    var value = String(password || "");
    if (value.length < 10) throw new Error("كلمة المرور لازم تكون 10 أحرف على الأقل");
    var out = await c.auth.updateUser({ password: value });
    if (out.error) throw out.error;
    return out.data.user;
  }

  async function listOrders(limit) {
    var c = init();
    var out = await c.from("orders").select("id,order_number,table_no,customer_name,customer_phone,status,subtotal,total,created_at,updated_at,order_items(id,item_type,item_id,item_name,quantity,unit_price,line_total,note)")
      .order("created_at", { ascending: false }).limit(Math.min(Number(limit) || 150, 500));
    if (out.error) throw out.error;
    return out.data || [];
  }

  async function updateOrderStatus(id, status) {
    var allowed = ["new", "preparing", "ready", "completed", "cancelled"];
    if (allowed.indexOf(status) < 0) throw new Error("حالة الطلب غير صالحة");
    var out = await init().from("orders").update({ status: status, updated_at: new Date().toISOString() }).eq("id", id).select("id,status").single();
    if (out.error) throw out.error;
    return out.data;
  }

  function subscribeOrders(onChange) {
    var c = init();
    if (!c) return function () {};
    if (channel) c.removeChannel(channel);
    channel = c.channel("admin-orders").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, onChange).subscribe();
    return function () { if (channel) c.removeChannel(channel); channel = null; };
  }

  async function saveProduct(product) {
    var data = {
      id: cleanText(product.id, 80), name: cleanText(product.name, 120),
      description: cleanText(product.description, 500), section_id: cleanText(product.section_id, 50), price: Number(product.price),
      size_prices: Array.isArray(product.size_prices) ? product.size_prices.map(Number) : null,
      is_active: product.is_active !== false, sold_out: !!product.sold_out,
      sort_order: Number(product.sort_order) || 0, updated_at: new Date().toISOString()
    };
    var out = await init().from("products").upsert(data).select().single();
    if (out.error) throw out.error;
    return out.data;
  }

  async function saveOffer(offer) {
    var data = {
      id: cleanText(offer.id, 80), name: cleanText(offer.name, 120), description: cleanText(offer.description, 300),
      image_url: cleanText(offer.image_url, 500), price: Number(offer.price), original_price: Number(offer.original_price),
      parts: Array.isArray(offer.parts) ? offer.parts.slice(0, 10).map(function (x) { return cleanText(x, 80); }) : [],
      is_active: offer.is_active !== false, sort_order: Number(offer.sort_order) || 0, updated_at: new Date().toISOString()
    };
    var out = await init().from("offers").upsert(data).select().single();
    if (out.error) throw out.error;
    return out.data;
  }

  async function adminCatalog() {
    var c = init();
    var res = await Promise.all([
      c.from("products").select("*").order("sort_order"),
      c.from("offers").select("*").order("sort_order"),
      c.from("store_settings").select("*").eq("id", 1).single()
    ]);
    res.forEach(function (r) { if (r.error) throw r.error; });
    return { products: res[0].data || [], offers: res[1].data || [], settings: res[2].data };
  }

  async function saveSettings(settings) {
    var data = { tables_count: Number(settings.tables_count), ordering_open: !!settings.ordering_open, updated_at: new Date().toISOString() };
    var out = await init().from("store_settings").update(data).eq("id", 1).select().single();
    if (out.error) throw out.error;
    return out.data;
  }

  w.Backend = { configured: configured, init: init, loadCatalog: loadCatalog, applyCatalog: applyCatalog,
    placeOrder: placeOrder, signIn: signIn, signOut: signOut, session: session, updatePassword: updatePassword,
    listOrders: listOrders, updateOrderStatus: updateOrderStatus, subscribeOrders: subscribeOrders,
    saveProduct: saveProduct, saveOffer: saveOffer, adminCatalog: adminCatalog, saveSettings: saveSettings };
})(window);
