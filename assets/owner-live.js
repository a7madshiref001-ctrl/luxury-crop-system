(function (w, d) {
  "use strict";
  var B = w.Backend, M = w.MENU;
  var $ = function (id) { return d.getElementById(id); };
  var initialAuthHash = w.location.hash;
  var state = { orders: [], sections: [], products: [], offers: [], settings: null, edit: null, unsubscribe: null, poll: null, orderIds: {}, ordersReady: false };
  var soundOn = localStorage.getItem("luxurycrop.admin.sound") !== "off", audioUnlocked = false;
  var bellContext = null, bellBuffer = null, bellBufferPromise = null;
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
    return /(?:^|[&#])type=(?:invite|recovery)(?:&|$)/.test(initialAuthHash + "&" + w.location.hash + "&" + w.location.search);
  }
  function authLinkError() {
    var params = new URLSearchParams(String(initialAuthHash || "").replace(/^#/, ""));
    return { code: params.get("error_code") || "", description: params.get("error_description") || "" };
  }
  async function waitForInviteSession() {
    var session = await B.session();
    for (var i = 0; !session && i < 8; i++) {
      await new Promise(function (resolve) { w.setTimeout(resolve, 250); });
      session = await B.session();
    }
    return session;
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
    var linkError = authLinkError();
    if (linkError.code) {
      gate(linkError.code === "otp_expired" ? "رابط الدعوة انتهت صلاحيته أو تم استخدامه قبل كده. استخدم أحدث رسالة دعوة وصلتك." : "رابط التفعيل غير صالح. استخدم أحدث رسالة دعوة وصلتك.", false);
      return;
    }
    var session = isInviteLink() ? await waitForInviteSession() : await B.session();
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
    state.unsubscribe = B.subscribeOrders(function (payload) {
      refreshOrders(!!payload && payload.eventType === "INSERT");
    });
    clearInterval(state.poll);
    state.poll = setInterval(function () { refreshOrders(true); }, Number((w.BACKEND_CONFIG || {}).orderPollMs) || 10000);
  }
  async function refreshOrders(announce) {
    try {
      var next = await B.listOrders(300);
      var fresh = state.ordersReady ? next.filter(function (order) { return order.status === "new" && !state.orderIds[order.id]; }) : [];
      state.orders = next;
      state.orderIds = {};
      next.forEach(function (order) { state.orderIds[order.id] = true; });
      state.ordersReady = true;
      renderOrders();
      $("liveState").innerHTML = "<i></i> متصل مباشرة";
      if (announce && fresh.length) notifyNew(fresh[0], fresh.length);
    } catch (err) { $("liveState").textContent = "تعذّر التحديث — يعاد تلقائيًا"; }
  }
  function orderBell() {
    var bell = $("orderBellAudio");
    if (bell) bell.volume = .86;
    return bell;
  }
  function audioContext() {
    var AudioCtx = w.AudioContext || w.webkitAudioContext;
    if (!AudioCtx) return null;
    if (!bellContext) bellContext = new AudioCtx();
    return bellContext;
  }
  function loadBell() {
    if (bellBuffer) return Promise.resolve(bellBuffer);
    if (bellBufferPromise) return bellBufferPromise;
    var ctx = audioContext(), bell = orderBell();
    if (!ctx || !bell) return Promise.reject(new Error("audio_unavailable"));
    bellBufferPromise = fetch(bell.currentSrc || bell.src).then(function (response) {
      if (!response.ok) throw new Error("audio_load_failed");
      return response.arrayBuffer();
    }).then(function (data) { return ctx.decodeAudioData(data); }).then(function (buffer) {
      bellBuffer = buffer; return buffer;
    }).catch(function (err) { bellBufferPromise = null; throw err; });
    return bellBufferPromise;
  }
  function unlockAudio() {
    if (!soundOn || audioUnlocked) return;
    var ctx = audioContext(); if (!ctx) return;
    var resumed = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    resumed.then(function () { audioUnlocked = true; return loadBell(); }).catch(function () {});
  }
  function playOrderBell(count) {
    if (!soundOn) return;
    count = Math.max(1, Number(count) || 1);
    var ctx = audioContext(); if (!ctx) return;
    var resumed = ctx.state === "suspended" ? ctx.resume() : Promise.resolve();
    resumed.then(function () { return loadBell(); }).then(function (buffer) {
      var startAt = ctx.currentTime + .015;
      var volume = Math.min(.86, .96 / Math.sqrt(count));
      for (var i = 0; i < count; i++) {
        var source = ctx.createBufferSource(), gain = ctx.createGain();
        source.buffer = buffer; gain.gain.value = volume;
        source.connect(gain); gain.connect(ctx.destination);
        source.start(startAt + i * .045);
      }
    }).catch(function () {
      var bell = orderBell(); if (!bell) return;
      for (var i = 0; i < count; i++) {
        var copy = bell.cloneNode(true); copy.volume = Math.min(.86, .96 / Math.sqrt(count));
        setTimeout(function (node) { var started = node.play(); if (started && started.catch) started.catch(function () {}); }, i * 45, copy);
      }
    });
  }
  function showOrderArrival(order, count) {
    var el = $("orderArrival");
    if (!el) {
      el = d.createElement("div"); el.id = "orderArrival"; el.className = "order-arrival";
      el.setAttribute("role", "status"); el.setAttribute("aria-live", "assertive"); d.body.appendChild(el);
    }
    el.innerHTML = '<span class="bell" aria-hidden="true">🔔</span><span><b>' + (count > 1 ? count + ' طلبات جديدة' : 'طلب جديد #' + esc(order.order_number)) + '</b><span>طاولة ' + esc(order.table_no) + ' · ' + money(order.total) + ' ر.س</span></span>';
    el.classList.add("on"); clearTimeout(el._hide); el._hide = setTimeout(function () { el.classList.remove("on"); }, 5200);
  }
  function notifyNew(order, count) {
    $("bdgHome").textContent = state.orders.filter(function (o) { return o.status === "new"; }).length;
    $("bdgHome").classList.remove("hide");
    playOrderBell(count);
    showOrderArrival(order, count);
    if (navigator.vibrate) navigator.vibrate([120, 60, 120]);
  }
  function syncSoundButton() {
    var button = $("soundToggle");
    button.setAttribute("aria-pressed", String(soundOn));
    button.setAttribute("aria-label", soundOn ? "إيقاف صوت الطلبات" : "تشغيل صوت الطلبات");
    button.querySelector("span").textContent = soundOn ? "🔔" : "🔕";
  }
  function toggleSound() {
    soundOn = !soundOn;
    localStorage.setItem("luxurycrop.admin.sound", soundOn ? "on" : "off");
    syncSoundButton();
    if (soundOn) { unlockAudio(); playOrderBell(1); }
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
  function periodOrders() {
    var value=Number($("range")&&$("range").value)||30, now=new Date(), cutoff;
    if(value===1) cutoff=new Date(now.getFullYear(),now.getMonth(),now.getDate());
    else cutoff=new Date(now.getTime()-value*86400000);
    return state.orders.filter(function(o){return new Date(o.created_at)>=cutoff;});
  }
  function renderOrders() {
    var all = state.orders, report=periodOrders(), active = report.filter(function (x) { return x.status !== "cancelled"; });
    var revenue = active.reduce(function (a, x) { return a + Number(x.total); }, 0);
    var avg = active.length ? revenue / active.length : 0;
    $("ordersList").innerHTML = all.map(orderCard).join("") || '<div class="empty-live">لا توجد طلبات حتى الآن</div>';
    $("homeOrders").innerHTML = all.slice(0, 5).map(orderCard).join("") || '<div class="empty-live">أول طلب هيظهر هنا مباشرة</div>';
    $("oCount").textContent = report.length; $("oValue").textContent = money(revenue); $("oAvg").textContent = money(avg); $("oModes").textContent = report.length + " طاولة";
    $("hRev").textContent = money(revenue); $("kOrd").textContent = report.length; $("kAvg").textContent = money(avg);
    var fresh = all.filter(function (x) { return x.status === "new"; }).length;
    $("bdgHome").textContent = fresh; $("bdgHome").classList.toggle("hide", !fresh);
    $("demoChip").textContent = "● متصل مباشرة"; $("demoChip").classList.add("real");
    renderCustomers(report);
    renderItemStats(report);
  }
  function renderItemStats(report) {
    var byItem = {};
    (report||periodOrders()).filter(function(o){return o.status!=="cancelled";}).forEach(function(o){(o.order_items||[]).forEach(function(x){var r=byItem[x.item_name]||{name:x.item_name,qty:0,total:0};r.qty+=Number(x.quantity);r.total+=Number(x.line_total);byItem[x.item_name]=r;});});
    var rows=Object.values(byItem).sort(function(a,b){return b.total-a.total;});
    var html=rows.slice(0,8).map(function(x,i){return '<div class="rw"><div class="ix">'+(i+1)+'</div><div class="nm"><b>'+esc(x.name)+'</b><span>'+x.qty+' قطعة</span></div><div class="vl">'+money(x.total)+' ر.س</div></div>';}).join("")||'<div class="empty-live">تظهر النتائج بعد وصول الطلبات</div>';
    if($("homeTop"))$("homeTop").innerHTML=html;if($("topRev"))$("topRev").innerHTML=html;
    if($("sRev"))$("sRev").textContent=money((report||periodOrders()).filter(function(o){return o.status!=="cancelled";}).reduce(function(a,o){return a+Number(o.total);},0));
  }
  function renderCustomers(report) {
    var map = {};
    (report||periodOrders()).forEach(function (o) { if (!o.customer_phone) return; var x = map[o.customer_phone] || { name:o.customer_name, phone:o.customer_phone, spent:0, count:0 }; x.spent += Number(o.total); x.count++; map[o.customer_phone] = x; });
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
    state.sections = cat.sections; state.products = cat.products; state.offers = cat.offers; state.settings = cat.settings;
    $("liveTables").value = cat.settings.tables_count; $("liveOrdering").checked = cat.settings.ordering_open;
    renderProducts($("liveProductSearch").value); renderOffers(); renderSections();
  }
  function renderProducts(query) {
    query = String(query || "").trim();
    var list = state.products.filter(function(p){return !query || p.name.indexOf(query)>-1;});
    $("liveProductList").innerHTML = list.map(function(p){return '<div class="editor-row"><div><b>'+esc(p.name)+'</b><span>'+money(p.price)+' ر.س · '+(p.is_active?'ظاهر':'مخفي')+(p.sold_out?' · خلصان':'')+'</span></div><button class="btn btn-g btn-s" data-edit-product="'+esc(p.id)+'">تعديل</button></div>';}).join("") || '<div class="empty-live">لا توجد نتائج</div>';
  }
  function renderOffers() {
    $("liveOfferList").innerHTML = state.offers.map(function(o){return '<div class="editor-row"><div><b>'+esc(o.name)+'</b><span>'+money(o.price)+' بدل '+money(o.original_price)+' ر.س · '+(o.is_active?'ظاهر':'مخفي')+'</span></div><button class="btn btn-g btn-s" data-edit-offer="'+esc(o.id)+'">تعديل</button></div>';}).join("") || '<div class="empty-live">لا توجد عروض</div>';
  }
  function renderSections() {
    $("liveSectionList").innerHTML=state.sections.map(function(s){
      var count=state.products.filter(function(p){return p.section_id===s.id;}).length;
      return '<div class="editor-row"><div><b>'+esc(s.title)+'</b><span>'+count+' منتج · ترتيب '+Number(s.sort_order||0)+' · '+(s.is_active?'ظاهر':'مخفي')+'</span></div><button class="btn btn-g btn-s" data-edit-section="'+esc(s.id)+'">تعديل</button></div>';
    }).join("")||'<div class="empty-live">لا توجد أقسام</div>';
  }
  function field(label, name, value, type) { return '<label class="edit-field">'+label+'<input name="'+name+'" type="'+(type||"text")+'" value="'+esc(value)+'"></label>'; }
  function sectionOptions(selected) {
    var source=state.sections&&state.sections.length?state.sections:M.sections;
    return source.filter(function(s){return s.is_active!==false||s.id===selected;}).map(function(s){return '<option value="'+esc(s.id)+'" '+(s.id===selected?'selected':'')+'>'+esc(s.title)+'</option>';}).join("");
  }
  function openProduct(id) {
    var p = id ? state.products.find(function(x){return x.id===id;}) : null;
    if (!p) p={id:"p_"+(w.crypto&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):Date.now()),name:"",description:"",section_id:((state.sections[0]||M.sections[0])||{}).id||"hot",price:0,size_prices:null,image_url:"",is_active:true,sold_out:false,sort_order:(state.products.length+1)*10};
    state.edit={kind:"product",data:p,newItem:!id}; $("editorTitle").textContent=id?"تعديل المنتج":"إضافة منتج";
    $("editorSave").textContent=id?"حفظ التعديل":"إضافة المنتج";
    var preview=p.image_url?'<img class="product-preview" src="'+esc(p.image_url)+'" alt="صورة المنتج الحالية">':'<div class="product-preview empty">لا توجد صورة بعد</div>';
    $("editorFields").innerHTML=field("الاسم","name",p.name)+field("الوصف","description",p.description)+
      '<label class="edit-field">القسم<select name="section_id" required>'+sectionOptions(p.section_id)+'</select></label>'+
      field("السعر الأساسي","price",p.price,"number")+field("أسعار الأحجام مفصولة بفاصلة","sizes",Array.isArray(p.size_prices)?p.size_prices.join(", "):"")+field("الترتيب داخل القسم","sort_order",p.sort_order,"number")+
      '<label class="edit-field product-image-field">صورة المنتج (صورة واحدة)'+preview+'<input id="productImage" data-image-input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small>لو اخترت صورة جديدة هتستبدل الحالية تلقائيًا.</small></label>'+
      '<label class="check-line"><input name="active" type="checkbox" '+(p.is_active?'checked':'')+'> ظاهر في المنيو</label><label class="check-line"><input name="sold" type="checkbox" '+(p.sold_out?'checked':'')+'> غير متاح حاليًا</label>';
    $("editorFields").querySelector('input[name="name"]').required=true;$("editorFields").querySelector('input[name="price"]').min="0";$("editorFields").querySelector('input[name="price"]').step="0.01";
    $("editorDialog").showModal();
  }
  async function prepareImage(file) {
    if (!file) return null;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size > 8*1024*1024) throw new Error("invalid_image");
    var bitmap=await createImageBitmap(file), max=1200, scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
    var canvas=d.createElement("canvas"); canvas.width=Math.max(1,Math.round(bitmap.width*scale)); canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    canvas.getContext("2d",{alpha:false}).drawImage(bitmap,0,0,canvas.width,canvas.height); if(bitmap.close)bitmap.close();
    return new Promise(function(resolve,reject){canvas.toBlob(function(blob){blob?resolve(blob):reject(new Error("image_convert_failed"));},"image/webp",.86);});
  }
  function openOffer(id) {
    var o=id?state.offers.find(function(x){return x.id===id;}):null;
    if(!o)o={id:"offer_"+(w.crypto&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,""):Date.now()),name:"",description:"",image_url:"",price:0,original_price:0,parts:[],is_active:true,sort_order:(state.offers.length+1)*10};
    state.edit={kind:"offer",data:o,newItem:!id}; $("editorTitle").textContent=id?"تعديل العرض":"إضافة عرض";
    $("editorSave").textContent=id?"حفظ التعديل":"إضافة العرض";
    var preview=o.image_url?'<img class="product-preview" src="'+esc(o.image_url)+'" alt="صورة العرض الحالية">':'<div class="product-preview empty">لا توجد صورة بعد</div>';
    $("editorFields").innerHTML=field("اسم العرض","name",o.name)+field("الوصف","description",o.description)+field("السعر بعد الخصم","price",o.price,"number")+field("السعر الأصلي","original_price",o.original_price,"number")+field("محتويات العرض مفصولة بفاصلة","parts",(o.parts||[]).join(", "))+field("ترتيب العرض","sort_order",o.sort_order,"number")+'<label class="edit-field product-image-field">صورة العرض (صورة واحدة)'+preview+'<input id="offerImage" data-image-input name="image" type="file" accept="image/jpeg,image/png,image/webp"><small>الصورة الجديدة تستبدل الحالية تلقائيًا.</small></label><label class="check-line"><input name="active" type="checkbox" '+(o.is_active?'checked':'')+'> ظاهر في المنيو</label>';
    ["name","price","original_price","parts"].forEach(function(n){$("editorFields").querySelector('[name="'+n+'"]').required=true;});
    ["price","original_price"].forEach(function(n){var input=$("editorFields").querySelector('[name="'+n+'"]');input.min="0";input.step="0.01";});
    if(!id)$("offerImage").required=true;
    $("editorDialog").showModal();
  }
  function openSection(id) {
    var s=id?state.sections.find(function(x){return x.id===id;}):null;
    if(!s)s={id:"section_"+(w.crypto&&crypto.randomUUID?crypto.randomUUID().replace(/-/g,"").slice(0,16):Date.now()),title:"",description:"",icon:"hot",is_active:true,sort_order:(state.sections.length+1)*10};
    state.edit={kind:"section",data:s,newItem:!id};$("editorTitle").textContent=id?"تعديل القسم":"إضافة قسم";
    $("editorSave").textContent=id?"حفظ التعديل":"إضافة القسم";
    var icons='<option value="hot">مشروبات ساخنة</option><option value="cold">مشروبات باردة</option><option value="v60">V60 وتقطير</option><option value="sweet">حلويات ومخبوزات</option><option value="dallah">قهوة سعودية</option>';
    $("editorFields").innerHTML=field("اسم القسم","title",s.title)+field("وصف مختصر","description",s.description)+'<label class="edit-field">الأيقونة<select name="icon">'+icons+'</select></label>'+field("ترتيب القسم","sort_order",s.sort_order,"number")+'<label class="check-line"><input name="active" type="checkbox" '+(s.is_active?'checked':'')+'> ظاهر في المنيو</label>';
    $("editorFields").querySelector('input[name="title"]').required=true;$("editorFields").querySelector('select[name="icon"]').value=s.icon||"hot";$("editorDialog").showModal();
  }
  async function saveEditor(e) {
    e.preventDefault(); if(!state.edit)return;
    var f=new FormData(e.currentTarget), base=state.edit.data, save=$("editorSave"); save.disabled=true; save.textContent="جاري الحفظ…";
    try {
      if(state.edit.kind==="product") {
        var imageFile=f.get("image"), imageUrl=base.image_url||"";
        if(imageFile&&imageFile.size){save.textContent="جاري تجهيز الصورة…";imageUrl=await B.uploadProductImage(base.id,await prepareImage(imageFile));save.textContent="جاري الحفظ…";}
        await B.saveProduct(Object.assign({},base,{name:f.get("name"),description:f.get("description"),section_id:f.get("section_id"),image_url:imageUrl,price:Number(f.get("price")),size_prices:String(f.get("sizes")||"").trim()?String(f.get("sizes")).split(",").map(Number):null,sort_order:Number(f.get("sort_order")),is_active:!!f.get("active"),sold_out:!!f.get("sold")}));
      }
      else if(state.edit.kind==="offer"){
        if(Number(f.get("original_price"))<Number(f.get("price")))throw new Error("invalid_offer_price");
        var offerFile=f.get("image"),offerUrl=base.image_url||"";
        if(offerFile&&offerFile.size){save.textContent="جاري تجهيز الصورة…";offerUrl=await B.uploadOfferImage(base.id,await prepareImage(offerFile));save.textContent="جاري الحفظ…";}
        await B.saveOffer(Object.assign({},base,{name:f.get("name"),description:f.get("description"),price:Number(f.get("price")),original_price:Number(f.get("original_price")),image_url:offerUrl,parts:String(f.get("parts")||"").split(",").map(function(x){return x.trim();}).filter(Boolean),sort_order:Number(f.get("sort_order")),is_active:!!f.get("active")}));
      } else await B.saveSection(Object.assign({},base,{title:f.get("title"),description:f.get("description"),icon:f.get("icon"),sort_order:Number(f.get("sort_order")),is_active:!!f.get("active")}));
      $("editorDialog").close(); await refreshCatalog();
    } catch(err){var code=String(err&&err.message);alert(code==="invalid_image"?"الصورة لازم تكون JPG أو PNG أو WebP وبحد أقصى 8 ميجا.":code==="invalid_offer_price"?"السعر الأصلي لازم يكون مساويًا أو أكبر من سعر العرض.":"لم يتم الحفظ. راجع القيم وحاول مرة ثانية.");}
    finally{save.disabled=false;save.textContent=state.edit&&state.edit.newItem?"إضافة":"حفظ التعديل";}
  }
  function cancelEditor() {
    state.edit = null;
    $("editorForm").reset();
    $("editorDialog").close();
    var save=$("editorSave"); save.disabled=false; save.textContent="حفظ التعديل";
  }
  async function saveSettings() {
    var button=$("saveStoreSettings");button.disabled=true;
    try{await B.saveSettings({tables_count:Number($("liveTables").value),ordering_open:$("liveOrdering").checked});alert("تم حفظ إعدادات الطلبات ✅");}
    catch(err){alert("تعذّر حفظ الإعدادات");}finally{button.disabled=false;}
  }
  async function clearOrders() {
    if (!w.confirm("سيتم حذف كل الطلبات الحالية نهائيًا وإعادة العدّاد من رقم 1. هل أنت متأكد؟")) return;
    var button=$("clearOrders");button.disabled=true;button.textContent="جاري التصفير…";
    try{await B.clearAllOrders();await refreshOrders();alert("تم تصفير كل الطلبات التجريبية ✅");}
    catch(err){alert("تعذّر تصفير الطلبات. حاول مرة ثانية.");}
    finally{button.disabled=false;button.textContent="تصفير الطلبات التجريبية";}
  }
  function openPasswordDialog() {
    $("passwordForm").reset();
    $("passwordError").textContent = "";
    $("passwordDialog").showModal();
  }
  async function savePassword(e) {
    e.preventDefault();
    var password = $("newAdminPassword").value;
    var save = $("passwordSave");
    $("passwordError").textContent = "";
    if (password.length < 10) { $("passwordError").textContent = "استخدم 10 أحرف على الأقل."; return; }
    if (password !== $("confirmAdminPassword").value) { $("passwordError").textContent = "كلمتا المرور غير متطابقتين."; return; }
    save.disabled = true; save.textContent = "جاري الحفظ…";
    try {
      await B.updatePassword(password);
      $("passwordDialog").close();
      alert("تم تعيين كلمة المرور بنجاح ✅");
    } catch (err) { $("passwordError").textContent = errorText(err); }
    finally { save.disabled = false; save.textContent = "حفظ كلمة المرور"; }
  }
  function wire() {
    syncSoundButton();
    $("soundToggle").addEventListener("click",toggleSound);
    d.addEventListener("pointerdown",unlockAudio,{once:true});
    d.addEventListener("keydown",unlockAudio,{once:true});
    $("adminLogin").addEventListener("submit",login);
    $("invitePasswordBtn").addEventListener("click",finishInvite);
    $("adminLogout").addEventListener("click",async function(){await B.signOut();location.reload();});
    $("adminPasswordChange").addEventListener("click",openPasswordDialog);
    $("passwordClose").addEventListener("click",function(){$("passwordDialog").close();});
    $("passwordCancel").addEventListener("click",function(){$("passwordDialog").close();});
    $("passwordForm").addEventListener("submit",savePassword);
    $("liveProductSearch").addEventListener("input",function(){renderProducts(this.value);});
    $("addProduct").addEventListener("click",function(){openProduct("");});
    $("addOffer").addEventListener("click",function(){openOffer("");});
    $("addSection").addEventListener("click",function(){openSection("");});
    $("saveStoreSettings").addEventListener("click",saveSettings);
    $("clearOrders").addEventListener("click",clearOrders);
    $("editorForm").addEventListener("submit",saveEditor);
    d.querySelectorAll("[data-editor-cancel]").forEach(function(button){button.addEventListener("click",cancelEditor);});
    d.addEventListener("luxurycrop:range",renderOrders);
    $("editorFields").addEventListener("change",function(e){if(!e.target.matches("[data-image-input]")||!e.target.files[0])return;var p=$("editorFields").querySelector(".product-preview");if(p){var url=URL.createObjectURL(e.target.files[0]);if(p.tagName!=="IMG"){var img=d.createElement("img");img.className="product-preview";img.alt="معاينة الصورة الجديدة";p.replaceWith(img);p=img;}p.src=url;}});
    d.addEventListener("click",function(e){var x=e.target.closest("[data-order-status]");if(x){changeStatus(x);return;}x=e.target.closest("[data-edit-product]");if(x){openProduct(x.dataset.editProduct);return;}x=e.target.closest("[data-edit-offer]");if(x){openOffer(x.dataset.editOffer);return;}x=e.target.closest("[data-edit-section]");if(x){openSection(x.dataset.editSection);return;}if(e.target.closest(".nv[data-p]")){renderOrders();}});
  }
  d.addEventListener("DOMContentLoaded",function(){wire();authenticate().catch(function(){gate("تعذّر بدء لوحة الإدارة. حدّث الصفحة وحاول مرة ثانية.",false);});});
})(window,document);
