(function (w) {
  "use strict";

  var cfg = w.BACKEND_CONFIG || {};
  var client = null;
  var orderClient = null;
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

  function orderApi() {
    if (!configured()) return null;
    if (!w.supabase || !w.supabase.createClient) throw new Error("تعذّر تحميل عميل قاعدة البيانات");
    if (!orderClient) {
      orderClient = w.supabase.createClient(cfg.url, cfg.publishableKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { headers: { "X-Client-Info": "luxury-crop-orders/1.0" } }
      });
    }
    return orderClient;
  }

  function cleanText(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max);
  }

  async function loadCatalog() {
    var c = init();
    if (!c) return null;
    var res = await Promise.all([
      c.from("menu_sections").select("id,title,description,icon,is_active,sort_order").order("sort_order"),
      c.from("products").select("id,name,description,section_id,image_url,price,size_prices,is_active,sold_out,sort_order").order("sort_order"),
      c.from("offers").select("id,name,description,image_url,price,original_price,parts,is_active,sort_order").order("sort_order"),
      c.from("addons").select("id,section_id,name,price,is_active,sort_order").order("sort_order"),
      c.from("store_settings").select("tables_count,ordering_open").eq("id", 1).maybeSingle()
    ]);
    res.forEach(function (r) { if (r.error) throw r.error; });
    return { sections:res[0].data||[], products: res[1].data || [], offers: res[2].data || [], addons: res[3].data || [], settings: res[4].data || null };
  }

  function applyCatalog(menu, sales, data) {
    if (!data) return;
    if (data.sections && data.sections.length) {
      var existingSections={}; (menu.sections||[]).forEach(function(s){existingSections[s.id]=s;});
      menu.sections=(data.sections||[]).filter(function(s){return s.is_active!==false;}).map(function(s){
        var current=existingSections[s.id]||{id:s.id,cats:[{id:s.id+"-a",title:s.title,items:[]}]};
        current.title=cleanText(s.title,80); current.desc=cleanText(s.description,240); current.icon=cleanText(s.icon,20)||"hot";
        if(!current.cats||!current.cats.length)current.cats=[{id:s.id+"-a",title:s.title,items:[]}];
        current.cats[0].title=current.title; return current;
      });
    }
    var byId = {}, seen = {};
    (data.products || []).forEach(function (p) { byId[p.id] = p; });
    (menu.sections || []).forEach(function (section) {
      (section.cats || []).forEach(function (cat) {
        cat.items = (cat.items || []).filter(function (item) {
          var p = byId[item.k];
          if (!p) return true;
          seen[item.k] = true;
          item.n = cleanText(p.name, 120) || item.n;
          item.d = cleanText(p.description, 500);
          item._remoteSoldOut = !!p.sold_out;
          item._dbId = p.id;
          item._remoteImage = cleanText(p.image_url, 500);
          if (Array.isArray(p.size_prices) && p.size_prices.length) item.s = p.size_prices.map(Number);
          else item.p = Number(p.price);
          return p.is_active !== false;
        });
      });
    });
    (data.products || []).filter(function (p) { return p.is_active !== false && !seen[p.id]; }).forEach(function (p) {
      var section = (menu.sections || []).find(function (x) { return x.id === p.section_id; });
      if (!section || !section.cats || !section.cats.length) return;
      section.cats[0].items.push({ k:p.id, n:cleanText(p.name,120), d:cleanText(p.description,500), p:Number(p.price),
        s:Array.isArray(p.size_prices)&&p.size_prices.length?p.size_prices.map(Number):undefined,
        _dbId:p.id, _remoteImage:cleanText(p.image_url,500), _remoteSoldOut:!!p.sold_out });
    });
    (menu.sections || []).forEach(function (section) {
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
    var c = orderApi();
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
      image_url: cleanText(product.image_url, 500),
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
      c.from("menu_sections").select("*").order("sort_order"),
      c.from("products").select("*").order("sort_order"),
      c.from("offers").select("*").order("sort_order"),
      c.from("store_settings").select("*").eq("id", 1).single()
    ]);
    res.forEach(function (r) { if (r.error) throw r.error; });
    return { sections:res[0].data||[], products: res[1].data || [], offers: res[2].data || [], settings: res[3].data };
  }

  async function saveSection(section) {
    var data={id:cleanText(section.id,50),title:cleanText(section.title,80),description:cleanText(section.description,240),
      icon:cleanText(section.icon,20)||"hot",is_active:section.is_active!==false,sort_order:Number(section.sort_order)||0,updated_at:new Date().toISOString()};
    var out=await init().from("menu_sections").upsert(data).select().single();
    if(out.error)throw out.error; return out.data;
  }

  async function saveSettings(settings) {
    var data = { tables_count: Number(settings.tables_count), ordering_open: !!settings.ordering_open, updated_at: new Date().toISOString() };
    var out = await init().from("store_settings").update(data).eq("id", 1).select().single();
    if (out.error) throw out.error;
    return out.data;
  }

  async function uploadProductImage(productId, file) {
    var path = cleanText(productId, 80) + "/cover.webp";
    var bucket = init().storage.from("product-images");
    var out = await bucket.upload(path, file, { upsert:true, contentType:"image/webp", cacheControl:"3600" });
    if (out.error) throw out.error;
    var url = bucket.getPublicUrl(path).data.publicUrl;
    return url + "?v=" + Date.now();
  }

  async function uploadOfferImage(offerId, file) {
    var path=cleanText(offerId,80)+"/cover.webp",bucket=init().storage.from("offer-images");
    var out=await bucket.upload(path,file,{upsert:true,contentType:"image/webp",cacheControl:"3600"});
    if(out.error)throw out.error;
    return bucket.getPublicUrl(path).data.publicUrl+"?v="+Date.now();
  }

  async function clearAllOrders() {
    var out = await init().rpc("clear_all_orders");
    if (out.error) throw out.error;
    return out.data;
  }

  w.Backend = { configured: configured, init: init, loadCatalog: loadCatalog, applyCatalog: applyCatalog,
    placeOrder: placeOrder, signIn: signIn, signOut: signOut, session: session, updatePassword: updatePassword,
    listOrders: listOrders, updateOrderStatus: updateOrderStatus, subscribeOrders: subscribeOrders,
    saveProduct: saveProduct, saveOffer: saveOffer, adminCatalog: adminCatalog, saveSettings: saveSettings,
    saveSection:saveSection, uploadProductImage: uploadProductImage, uploadOfferImage:uploadOfferImage, clearAllOrders: clearAllOrders };
})(window);
