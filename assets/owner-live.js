(function (w, d) {
  "use strict";
  var B = w.Backend;
  var $ = function (id) { return d.getElementById(id); };
  var state = { orders: [], products: [], offers: [], settings: null, edit: null, unsubscribe: null, poll: null };
  var STATUS = { new: "جديد", preparing: "قيد التحضير", ready: "جاهز", completed: "مكتمل", cancelled: "ملغي" };
  var esc = function (v) { return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) { return ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]; }); };
  var money = function (v) { return Number(v || 0).toLocaleString("ar-SA", { maximumFractionDigits: 2 }); };

  function gate(message, setup) {
    d.body.classList.add("auth-pending");
    $("adminGate").hidden = false;
    $("adminLogin").classList.toggle("setup", !!setup);
    $("loginHelp").textContent = message;
    ["adminEmail", "adminPassword", "loginBtn"].forEach(function (id) { $(id).hidden = !!setup; });
    $("inviteSetup").hidden = true;
  }
  function inviteGate() {
    d.body.classList.add("auth-pending");
    $("adminGate").hidden = false;
    $("loginTitle").textContent = "تفعيل حساب الإدارة";
    $("loginHelp").textContent = "اختار كلمة مرور قوية لحسابك، وبعدها هتفتح لوحة الإدارة مباشرة.";
    ["adminEmail", "adminPassword", "loginBtn"].forEach(function (id) { $(id).hidden = true; });
    $("inviteSetup").hidden = false;
  }
  function isInviteLink() {
    return /(?:^|[&#])type=(?:invite|recovery)(?:&|$)/.test(w.location.hash + "&" + w.location.search);
  }
  function openApp() {
    $("adminGate").hidden = true;
    d.body.classList.remove("auth-pending");
    d.body.classList.add("live-admin");
    $("demoChip").textContent = "● متصل مباشرة";
    $("demoChip").classList.add("real");
  }
  function errorText(err) {
    var msg = String(err && err.message || "");
    if (/invalid login/i.test(msg)) return "البريد أو كلمة المرور غير صحيحة";
    if (/not authorized|permission|row-level/i.test(msg)) return "الحساب غير مصرح له بإدارة المتجر";
    return "تعذّر الاتصال. تأكد من الإنترنت وحاول مرة ثانية.";
  }
  async function authenticate() {
    if (!B || !B.configured()) {
      gate("اللوحة جاهزة، ويتبقى ربط مشروع قاعدة البيانات لتفعيل الدخول والطلبات المباشرة.", true);
      return;
    }
    var session = await B.session();
    if (isInviteLink()) {
      if (!session) { gate("رابط التفعيل غير صالح أو انتهت مدته. اطلب دعوة جديدة.", false); return; }
      inviteGate();
      return;
    }
    if (!session) { gate("ادخل بالحساب المصرّح له لإدارة الطلبات والمنيو.", false); return; }
    try {
      await B.adminCatalog();
      openApp();
      await start();
    } catch (err) {
      await B.signOut();
      gate("هذا الحساب غير مصرح له بإدارة المتجر.", false);
    }
  }
  async function login(e) {
    e.preventDefault();
    var button = $("loginBtn");
    $("loginError").textContent = "";
    button.disabled = true; button.textContent = "جاري التحقق…";
    try {
      await B.signIn($("adminEmail").value, $("adminPassword").value);
      openApp(); await start();
    } catch (err) { $("loginError").textContent = errorText(err); }
    finally { button.disabled = false; button.textContent = "دخول آمن"; }
  }

  async function finishInvite() {
    var button = $("invitePasswordBtn");
    var password = $("invitePassword").value;
    $("loginError").textContent = "";
    if (password.length < 10) { $("loginError").textContent = "استخدم 10 أحرف على الأقل."; return; }
    if (password !== $("invitePasswordConfirm").value) { $("loginError").textContent = "كلمتا المرور غير متطابقتين."; return; }
    button.disabled = true; button.textContent = "جاري تفعيل الحساب…";
    try {
      await B.updatePassword(password);
      await B.adminCatalog();
      w.history.replaceState({}, d.title, w.location.pathname + w.location.search);
      openApp(); await start();
    } catch (err) { $("loginError").textContent = errorText(err); }
    finally { button.disabled = false; button.textContent = "حفظ وفتح لوحة الإدارة"; }
  }

  async function start() {
    await Promise.all([refreshOrders(), refreshCatalog()]);
    if (state.unsubscribe) state.unsubscribe();
    state.unsubscribe = B.subscribeOrders(function () { refreshOrders(true); });
    clearInterval(state.poll);
    state.poll = setInterval(refreshOrders, Number((w.BACKEND_CONFIG || {}).orderPollMs) || 10000);
  }
  async function refreshOrders(announce) {
    try {
      var before = state.orders.length ? state.orders[0].id : null;
      state.orders = await B.listOrders(300);
      renderOrders();
      $("liveState").innerHTML = "<i></i> متصل مباشرة";
      if (announce && before && state.orders[0] && state.orders[0].id !== before) notifyNew();
    } catch (err) { $("liveState").textContent = "تعذّر التحديث — يعاد تلقائيًا"; }
  }
  function notifyNew() {
    $("bdgHome").textContent = state.orders.filter(function (o) { return o.status === "new"; }).length;
    $("bdgHome").classList.remove("hide");
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }
  function orderCard(o) {
    var items = (o.order_items || []).map(function (x) { return x.quantity + "× " + esc(x.item_name) + (x.note ? " — " + esc(x.note) : ""); }).join(" · ");
    var buttons = ["new","preparing","ready","completed","cancelled"].map(function (s) {
      return '<button class="status-btn' + (o.status === s ? " on" : "") + '" data-order-status="' + s + '" data-order-id="' + esc(o.id) + '">' + STATUS[s] + '</button>';
    }).join("");
    return '<article class="ord live-order status-' + esc(o.status) + '"><div class="hd"><span class="chip">طلب #' + o.order_number + ' · طاولة ' + o.table_no + '</span><b>' + new Date(o.created_at).toLocaleString("ar-SA", { hour:"2-digit", minute:"2-digit", day:"numeric", month:"numeric" }) + '</b><span class="vv">' + money(o.total) + ' ر.س</span></div>' +
      '<div class="ls">' + items + '</div>' +
      ((o.customer_name || o.customer_phone) ? '<div class="order-customer">' + esc(o.customer_name || "بدون اسم") + (o.customer_phone ? ' · <span dir="ltr">' + esc(o.customer_phone) + '</span>' : '') + '</div>' : '') +
      '<div class="status-row" role="group" aria-label="حالة الطلب">' + buttons + '</div></article>';
  }
  function renderOrders() {
    var all = state.orders, active = all.filter(function (x) { return x.status !== "cancelled"; });
    var revenue = active.reduce(function (a, x) { return a + Number(x.total); }, 0);
    var avg = active.length ? revenue / active.length : 0;
    $("ordersList").innerHTML = all.map(orderCard).join("") || '<div class="empty-live">لا توجد طلبات حتى الآن</div>';
    $("homeOrders").innerHTML = all.slice(0, 5).map(orderCard).join("") || '<div class="empty-live">أول طلب هيظهر هنا مباشرة</div>';
    $("oCount").textContent = all.length; $("oValue").textContent = money(revenue); $("oAvg").textContent = money(avg); $("oModes").textContent = all.length + " طاولة";
    $("hRev").textContent = money(revenue); $("kOrd").textContent = all.length; $("kAvg").textContent = money(avg);
    var fresh = all.filter(function (x) { return x.status === "new"; }).length;
    $("bdgHome").textContent = fresh; $("bdgHome").classList.toggle("hide", !fresh);
    $("demoChip").textContent = "● متصل مباشرة"; $("demoChip").classList.add("real");
    renderCustomers();
    renderItemStats();
  }
  function renderItemStats() {
    var byItem = {};
    state.orders.filter(function(o){return o.status!=="cancelled";}).forEach(function(o){(o.order_items||[]).forEach(function(x){var r=byItem[x.item_name]||{name:x.item_name,qty:0,total:0};r.qty+=Number(x.quantity);r.total+=Number(x.line_total);byItem[x.item_name]=r;});});
    var rows=Object.values(byItem).sort(function(a,b){return b.total-a.total;});
    var html=rows.slice(0,8).map(function(x,i){return '<div class="rw"><div class="ix">'+(i+1)+'</div><div class="nm"><b>'+esc(x.name)+'</b><span>'+x.qty+' قطعة</span></div><div class="vl">'+money(x.total)+' ر.س</div></div>';}).join("")||'<div class="empty-live">تظهر النتائج بعد وصول الطلبات</div>';
    if($("homeTop"))$("homeTop").innerHTML=html;if($("topRev"))$("topRev").innerHTML=html;
    if($("sRev"))$("sRev").textContent=money(state.orders.filter(function(o){return o.status!=="cancelled";}).reduce(function(a,o){return a+Number(o.total);},0));
  }
  function renderCustomers() {
    var map = {};
    state.orders.forEach(function (o) { if (!o.customer_phone) return; var x = map[o.customer_phone] || { name:o.customer_name, phone:o.customer_phone, spent:0, count:0 }; x.spent += Number(o.total); x.count++; map[o.customer_phone] = x; });
    var rows = Object.values(map);
    $("cCount").textContent = rows.length;
    $("cAvg").textContent = money(rows.length ? rows.reduce(function(a,x){return a+x.spent;},0)/rows.length : 0);
    $("cRep").textContent = rows.filter(function(x){return x.count>1;}).length;
    $("cusList").innerHTML = rows.map(function(x){ return '<div class="rw"><div class="ix">👤</div><div class="nm"><b>'+esc(x.name||"—")+'</b><span dir="ltr">'+esc(x.phone)+'</span></div><div class="vl">'+money(x.spent)+' ر.س</div></div>'; }).join("") || '<div class="empty-live">لا توجد بيانات عملاء حتى الآن</div>';
  }
  async function changeStatus(button) {
    button.disabled = true;
    try { await B.updateOrderStatus(button.dataset.orderId, button.dataset.orderStatus); await refreshOrders(); }
    catch (err) { alert("تعذّر تحديث الطلب. حاول مرة ثانية."); button.disabled = false; }
  }

  async function refreshCatalog() {
    var cat = await B.adminCatalog();
    state.products = cat.products; state.offers = cat.offers; state.settings = cat.settings;
    $("liveTables").value = cat.settings.tables_count; $("liveOrdering").checked = cat.settings.ordering_open;
    renderProducts($("liveProductSearch").value); renderOffers();
  }
  function renderProducts(query) {
    query = String(query || "").trim();
    var list = state.products.filter(function(p){return !query || p.name.indexOf(query)>-1;});
    $("liveProductList").innerHTML = list.map(function(p){return '<div class="editor-row"><div><b>'+esc(p.name)+'</b><span>'+money(p.price)+' ر.س · '+(p.is_active?'ظاهر':'مخفي')+(p.sold_out?' · خلصان':'')+'</span></div><button class="btn btn-g btn-s" data-edit-product="'+esc(p.id)+'">تعديل</button></div>';}).join("") || '<div class="empty-live">لا توجد نتائج</div>';
  }
  function renderOffers() {
    $("liveOfferList").innerHTML = state.offers.map(function(o){return '<div class="editor-row"><div><b>'+esc(o.name)+'</b><span>'+money(o.price)+' بدل '+money(o.original_price)+' ر.س · '+(o.is_active?'ظاهر':'مخفي')+'</span></div><button class="btn btn-g btn-s" data-edit-offer="'+esc(o.id)+'">تعديل</button></div>';}).join("") || '<div class="empty-live">لا توجد عروض</div>';
  }
  function field(label, name, value, type) { return '<label class="edit-field">'+label+'<input name="'+name+'" type="'+(type||"text")+'" value="'+esc(value)+'"></label>'; }
  function openProduct(id) {
    var p = state.products.find(function(x){return x.id===id;}); if(!p)return;
    state.edit={kind:"product",data:p}; $("editorTitle").textContent="تعديل المنتج";
    $("editorFields").innerHTML=field("الاسم","name",p.name)+field("الوصف","description",p.description)+field("السعر الأساسي","price",p.price,"number")+field("أسعار الأحجام مفصولة بفاصلة","sizes",Array.isArray(p.size_prices)?p.size_prices.join(", "):"")+ '<label class="check-line"><input name="active" type="checkbox" '+(p.is_active?'checked':'')+'> ظاهر في المنيو</label><label class="check-line"><input name="sold" type="checkbox" '+(p.sold_out?'checked':'')+'> غير متاح حاليًا</label>';
    $("editorDialog").showModal();
  }
  function openOffer(id) {
    var o=state.offers.find(function(x){return x.id===id;}); if(!o)return;
    state.edit={kind:"offer",data:o}; $("editorTitle").textContent="تعديل العرض";
    $("editorFields").innerHTML=field("اسم العرض","name",o.name)+field("الوصف","description",o.description)+field("السعر بعد الخصم","price",o.price,"number")+field("السعر الأصلي","original_price",o.original_price,"number")+field("مسار الصورة","image_url",o.image_url)+field("محتويات العرض مفصولة بفاصلة","parts",(o.parts||[]).join(", "))+'<label class="check-line"><input name="active" type="checkbox" '+(o.is_active?'checked':'')+'> ظاهر في المنيو</label>';
    $("editorDialog").showModal();
  }
  async function saveEditor(e) {
    e.preventDefault(); if(!state.edit)return;
    var f=new FormData(e.currentTarget), base=state.edit.data, save=$("editorSave"); save.disabled=true; save.textContent="جاري الحفظ…";
    try {
      if(state.edit.kind==="product") await B.saveProduct(Object.assign({},base,{name:f.get("name"),description:f.get("description"),price:Number(f.get("price")),size_prices:String(f.get("sizes")||"").trim()?String(f.get("sizes")).split(",").map(Number):null,is_active:!!f.get("active"),sold_out:!!f.get("sold")}));
      else await B.saveOffer(Object.assign({},base,{name:f.get("name"),description:f.get("description"),price:Number(f.get("price")),original_price:Number(f.get("original_price")),image_url:f.get("image_url"),parts:String(f.get("parts")||"").split(",").map(function(x){return x.trim();}).filter(Boolean),is_active:!!f.get("active")}));
      $("editorDialog").close(); await refreshCatalog();
    } catch(err){alert("لم يتم الحفظ. راجع القيم وحاول مرة ثانية.");}
    finally{save.disabled=false;save.textContent="حفظ التعديل";}
  }
  async function saveSettings() {
    var button=$("saveStoreSettings");button.disabled=true;
    try{await B.saveSettings({tables_count:Number($("liveTables").value),ordering_open:$("liveOrdering").checked});alert("تم حفظ إعدادات الطلبات ✅");}
    catch(err){alert("تعذّر حفظ الإعدادات");}finally{button.disabled=false;}
  }
  function wire() {
    $("adminLogin").addEventListener("submit",login);
    $("invitePasswordBtn").addEventListener("click",finishInvite);
    $("adminLogout").addEventListener("click",async function(){await B.signOut();location.reload();});
    $("liveProductSearch").addEventListener("input",function(){renderProducts(this.value);});
    $("saveStoreSettings").addEventListener("click",saveSettings);
    $("editorForm").addEventListener("submit",saveEditor);
    d.addEventListener("click",function(e){var x=e.target.closest("[data-order-status]");if(x){changeStatus(x);return;}x=e.target.closest("[data-edit-product]");if(x){openProduct(x.dataset.editProduct);return;}x=e.target.closest("[data-edit-offer]");if(x){openOffer(x.dataset.editOffer);return;}if(e.target.closest(".nv[data-p]")){renderOrders();}});
  }
  d.addEventListener("DOMContentLoaded",function(){wire();authenticate().catch(function(){gate("تعذّر بدء لوحة الإدارة. حدّث الصفحة وحاول مرة ثانية.",false);});});
})(window,document);
