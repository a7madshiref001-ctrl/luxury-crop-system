(function (w) {
  "use strict";

  var KEY = "luxurycrop.language.v1";
  var params = new URLSearchParams(w.location.search);
  var requested = params.get("lang");
  var saved = "";
  try { saved = localStorage.getItem(KEY) || ""; } catch (_) {}
  var lang = requested === "en" || requested === "ar" ? requested : (saved === "en" ? "en" : "ar");

  var en = {
    "قهوة مختصة": "Specialty Coffee",
    "المس الشاشة للدخول": "Tap to enter",
    "اطلب من الطاولة": "Order from your table",
    "المنيو": "Menu",
    "بحث": "Search",
    "إغلاق البحث": "Close search",
    "دوّر على صنف…": "Search the menu…",
    "اختيارات خاصة بسعر أفضل": "Curated pairings at a better price",
    "شوف طلبك": "View your order",
    "ريال سعودي": "Saudi riyal",
    "ر.س": "SAR",
    "العودة لأعلى": "Back to top",
    "إغلاق": "Close",
    "فعّل الجافاسكربت لعرض المنيو.": "Enable JavaScript to view the menu.",
    "صُنع بحب لعشّاق القهوة المختصة": "Crafted with care for specialty coffee lovers",
    "الموقع": "Location",
    "اتصل فينا": "Call us",
    "خلص": "Sold out",
    "توقيع محصول فاخر": "Luxury Crop signature",
    "الأكثر طلبًا": "Bestseller",
    "اختيار الباريستا": "Barista's choice",
    "يبدأ من": "From",
    "جديد": "New",
    "الحجم": "Size",
    "زده بإضافة": "Make it yours",
    "ملاحظة للباريستا": "Note for the barista",
    "مثلاً: بدون سكر": "e.g. no sugar",
    "الكمية": "Quantity",
    "الناس تاخذه مع": "Pairs well with",
    "أضف للطلب": "Add to order",
    "طلبك": "Your order",
    "راجعه قبل ما ترسله": "Review it before sending",
    "آخر فرصة تضيف": "One last addition",
    "مكان استلام الطلب": "Pickup location",
    "طلب الفندق": "Hotel order",
    "طلب الصالة": "Dine-in order",
    "تم التعرّف تلقائيًا من الـQR": "Recognized automatically from the QR code",
    "تعذّر تحديد مكانك": "We couldn't identify your location",
    "امسح كود الـQR الموجود على طاولتك أو في غرفتك، وبعدها افتح الطلب مرة ثانية.": "Scan the QR code on your table or in your room, then open your order again.",
    "الطلب وين؟": "Where is your order?",
    "رقم الطاولة": "Table number",
    "اسمك ورقمك": "Your name and number",
    "الاسم (اختياري)": "Name (optional)",
    "بياناتك اختيارية وتُستخدم لتأكيد الطلب وخدمتك.": "Your details are optional and are only used to confirm and serve your order.",
    "كارت الولاء": "Loyalty card",
    "الأصناف": "Items",
    "توصيل": "Delivery",
    "الإجمالي": "Total",
    "تأكيد وإرسال الطلب": "Confirm and send order",
    "نظام الطلبات قيد التجهيز": "Ordering is being prepared",
    "يوصل طلبك للإدارة مباشرة ويظهر رقم الطلب هنا": "Your order goes directly to the team and its number will appear here",
    "سيتم فتح الطلبات فور اكتمال الربط الآمن.": "Ordering will open as soon as the secure connection is ready.",
    "كيف كانت تجربتك؟": "How was your experience?",
    "رأيك يوصل لصاحب المكان على طول": "Your feedback goes directly to the owner",
    "تسلم! تحب تكتبها في قوقل؟ تفرق معنا وايد": "Thank you! Would you share it on Google? It means a lot to us.",
    "اكتب تقييم في قوقل": "Write a Google review",
    "آسفين — قل لنا وش صار ونصلحه": "We're sorry — tell us what happened and we'll make it right",
    "اكتب المشكلة…": "Tell us what happened…",
    "أرسلها للإدارة": "Send to management",
    "وسط": "Medium",
    "كبير": "Large",
    "الطاولة": "Table",
    "سفري": "Takeaway",
    "توصيل": "Delivery",

    "مشروبات ماتشا": "Matcha Drinks",
    "ماتشا يابانية مختصة": "Premium Japanese matcha",
    "المشروبات الباردة": "Iced Drinks",
    "مشروبات قهوة مثلّجة": "Iced coffee and refreshing drinks",
    "كركديه": "Hibiscus",
    "كركديه طائفي منعش": "Refreshing Taif-style hibiscus",
    "موهيتو": "Mojitos",
    "موهيتو منعش بنكهات": "Refreshing flavored mojitos",
    "المشروبات الساخنة": "Hot Drinks",
    "إسبريسو ومشروبات حليب ساخنة": "Espresso and hot milk drinks",
    "V60  بارد": "Iced V60",
    "V60 بارد": "Iced V60",
    "V60 حار": "Hot V60",
    "قهوة مختصة محضّرة بالتقطير - حار": "Specialty pour-over coffee — hot",
    "الإسبريسو": "Espresso",
    "حبوب مختصة فاخرة": "Premium specialty coffee beans",
    "المخبوزات والحلا": "Pastries & Desserts",
    "حلويات وكيك طازج": "Fresh cakes and desserts",

    "ماتشا بِنك": "Pink Matcha",
    "ماتشا لافندر": "Lavender Matcha",
    "ماتشا فراولة": "Strawberry Matcha",
    "ماتشا توت": "Berry Matcha",
    "ماتشا كوكنت": "Coconut Matcha",
    "ماتشا فانيليا": "Vanilla Matcha",
    "ماتشا كلاسيك": "Classic Matcha",
    "أجود أنواع الماتشا اليابانية بنكهة الورد مع حليب الصويا.": "Premium Japanese matcha with rose and soy milk.",
    "أجود أنواع الماتشا اليابانية مع نكهة اللافندر و حليب الكوكنت .": "Premium Japanese matcha with lavender and coconut milk.",
    "ماتشا يابانية ونكهة الفراولة الطبيعية بطعم منعش": "Japanese matcha with a bright, natural strawberry flavor.",
    "أجود أنواع الماتشا اليابانية بنكهة التوت وحليب الصويا ويتم تزيينها بقطع التوت المجفف بالتبريد.": "Premium Japanese matcha with berries and soy milk, finished with freeze-dried berries.",
    "توازن مثالي بين الماتشا اليابانية وجوز الهند الكريمي": "A smooth balance of Japanese matcha and creamy coconut.",
    "توازن مثالي بين الماتشا اليابانية الفاخرة والفانيليا الطبيعية": "A refined balance of premium Japanese matcha and natural vanilla.",
    "أجود أنواع الماتشا اليابانية بدون إضافات إختيارات الحليب ( صويا، كوكنت، لوز، حليب بقري ) إختيارات إضافية: (فانيليا، كارميل ) 4 SR": "Pure premium Japanese matcha. Choose soy, coconut, almond, or dairy milk. Add vanilla or caramel for SAR 4.",

    "آيس لاتيه بالعسل": "Iced Honey Latte",
    "آيس لاتيه كراميل": "Iced Caramel Latte",
    "سبانش لاتيه بارد": "Iced Spanish Latte",
    "آيس أمريكانو": "Iced Americano",
    "آيس تي": "Iced Tea",
    "لاتيه بارد": "Iced Latte",
    "آيس شوكلت": "Iced Chocolate",
    "فريدو": "Freddo",
    "الفريدو": "Freddo",
    "حليب فراولة": "Strawberry Milk",
    "حليب فراولة (أطفال)": "Strawberry Milk (Kids)",
    "حليب روز": "Rose Milk",
    "آيس لاتيه بنكهة العسل": "Iced latte sweetened with honey.",
    "إسبريسو وحليب بنكهة الكراميل": "Espresso and milk with caramel.",
    "دبل اسبريسو مع وصفة الاسبانيش الخاصة": "Double espresso with our signature Spanish latte recipe.",
    "قهوة سوداء": "Black coffee.",
    "شاي مثلج منعش": "Refreshing iced tea.",
    "دبل اسبريسو مع حليب": "Double espresso with milk.",
    "حليب بالشوكلاته البلجيكية": "Milk with Belgian chocolate.",
    "إسبريسو مبرد ومخفوق": "Chilled, shaken espresso.",
    "مشروب أطفال بالحليب والفراولة": "A kid-friendly milk drink with strawberry.",
    "مشروب أطفال بالحليب ونكهة الروز": "A kid-friendly milk drink with rose flavor.",

    "كركديه روز": "Rose Hibiscus",
    "كركديه توت": "Berry Hibiscus",
    "كركديه كلاسيك": "Classic Hibiscus",
    "كركديه فراولة": "Strawberry Hibiscus",
    "كركديه بطعم الورد الطائفي": "Hibiscus with fragrant Taif rose.",
    "كركديه بنكهة التوت": "Hibiscus with berry flavor.",
    "كركديه طبيعي منعش": "Naturally refreshing hibiscus.",
    "كركديه مع طعم فراولة طبيعية ومنعشة": "Hibiscus with a fresh, natural strawberry flavor.",

    "موهيتو توت أزرق": "Blueberry Mojito",
    "موهيتو خوخ": "Peach Mojito",
    "موهيتو بنكهة التوت الأزرق والكوكنت": "Mojito with blueberry and coconut.",
    "موهيتو بنكهة الخوخ وزهرة البرتقال": "Mojito with peach and orange blossom.",

    "لاتيه كراميل": "Caramel Latte",
    "سبانش لاتيه حار": "Hot Spanish Latte",
    "لاتيه حار": "Hot Latte",
    "كابتشينو": "Cappuccino",
    "فلات وايت": "Flat White",
    "كورتادو": "Cortado",
    "ماكياتو": "Macchiato",
    "قهوة سعودية": "Saudi Coffee",
    "قهوة تركية": "Turkish Coffee",
    "قهوة اليوم محصول إثيوبي": "Ethiopian Coffee of the Day",
    "أمريكانو حار": "Hot Americano",
    "حليب - دبل اسبريسو - نكهة الكراميل": "Milk, double espresso, and caramel.",
    "دبل اسبريسو - وصفة الاسبانيش الخاصة": "Double espresso with our signature Spanish latte recipe.",
    "دبل اسبريسو - حليب": "Double espresso and milk.",
    "دبل اسبريسو - فوم": "Double espresso with milk foam.",
    "قهوة سعودية تقليدية": "Traditional Saudi coffee.",
    "قهوة تركية غنية": "Rich Turkish coffee.",
    "قهوة اليوم محضرة من محصول إثيوبي": "Today's coffee, brewed with Ethiopian beans.",

    "كولد برو": "Cold Brew",
    "سادو اثيوبيا بارد": "Sado Ethiopia — Iced",
    "بينسا اثيوبيا بارد": "Bensa Ethiopia — Iced",
    "بيرياس بيرو بارد": "Birias Peru — Iced",
    "لاهرموسا كولومبيا بارد": "La Hermosa Colombia — Iced",
    "وهاج اثيوبيا بارد": "Wahaj Ethiopia — Iced",
    "سادو اثيوبيا حار": "Sado Ethiopia — Hot",
    "بينسا اثيوبيا حار": "Bensa Ethiopia — Hot",
    "بيرياس بيرو حار": "Birias Peru — Hot",
    "لاهرموسا كولومبيا حار": "La Hermosa Colombia — Hot",
    "وهاج اثيوبيا حار": "Wahaj Ethiopia — Hot",
    "قهوة مقطّرة على البارد بتركيز عالي": "Concentrated slow-steeped cold brew.",
    "اثيوبيا من منطقة سيدامو بسلالة هيرلوم إيحاءات فاكهية (التوت الأزرق- الفراولة- العنب) معالجة مجففة - الارتفاع 2000 متر": "Sidamo, Ethiopia — heirloom varietal with blueberry, strawberry, and grape notes; natural process, grown at 2,000 m.",
    "قهوة اثيوبية": "Ethiopian specialty coffee.",
    "قهوة مختصة من بيرو": "Specialty coffee from Peru.",
    "قهوة مختصة كولومبية": "Colombian specialty coffee.",
    "قهوة مختصة إثيوبية": "Ethiopian specialty coffee.",

    "إسبريسو": "Espresso",
    "إسبريسو من حبوب مختصة فاخرة": "Espresso made with premium specialty beans.",

    "ماتيلدا كيك شوكلاته": "Matilda Chocolate Cake",
    "كوكنت مانجو": "Coconut Mango Cake",
    "تشيز توت أزرق": "Blueberry Cheesecake",
    "تشيز توت أحمر": "Red Berry Cheesecake",
    "تراميسو": "Tiramisu",
    "سينابون كلاسيك": "Classic Cinnamon Roll",
    "تشيز كيك مانجو": "Mango Cheesecake",
    "كوكيز فانيليا": "Vanilla Cookie",
    "كوكيز شوكلت": "Chocolate Cookie",
    "ماتيلدا كيك شوكلاته بلجيكية": "Matilda cake made with Belgian chocolate.",
    "كيك مع صوص المانجو وجوز الهند": "Cake with mango sauce and coconut.",
    "مكونات التشيز كيك مضاف إليها طبقة صوص التوت": "Creamy cheesecake topped with blueberry sauce.",
    "تشيز كيك بطبقة صوص التوت الأحمر": "Cheesecake topped with red berry sauce.",
    "طبقة بسكوت فاخرة (ليدي فنجر) مشربة بالقهوة ومضاف إليها كريمة وطبقة من بودرة الكاكاو": "Coffee-soaked ladyfingers layered with cream and finished with cocoa.",
    "لفائف القرفة": "Soft cinnamon rolls.",
    "مكونات التشيز كيك مضاف إليها طبقة صوص المانجو": "Creamy cheesecake topped with mango sauce.",
    "كوكيز مع رقائق الشوكلاته البلجيكية الفاخرة": "Cookie with premium Belgian chocolate chips.",
    "كوكيز Dark شوكلاته بلجيكية": "Dark cookie made with Belgian chocolate.",

    "شوت إسبريسو زيادة": "Extra espresso shot",
    "حليب نباتي (لوز/شوفان)": "Plant-based milk (almond/oat)",
    "سيرب (كراميل/فانيليا)": "Syrup (caramel/vanilla)",
    "كوكيز فانيليا جنب القهوة": "Vanilla cookie on the side",
    "ماء فوار جانبي": "Sparkling water on the side",
    "صوص شوكولاتة": "Chocolate sauce",
    "كريمة": "Cream",

    "بداية اليوم": "Morning Start",
    "بريك الشغل": "Work Break",
    "تجربة المختصة": "Specialty Experience",
    "قعدة اثنين": "Coffee for Two",
    "لاتيه حار + كوكيز فانيليا": "Hot latte + vanilla cookie",
    "سبانش لاتيه بارد + كوكيز شوكلت": "Iced Spanish latte + chocolate cookie",
    "سادو اثيوبيا حار + ماتيلدا كيك شوكلاته": "Hot Sado Ethiopia + Matilda chocolate cake",
    "٢ سبانش لاتيه حار + تراميسو": "2 hot Spanish lattes + tiramisu",
    "وقت الهدوء": "Quiet Hours",
    "خصم ٢٠٪ على القهوة الساخنة": "20% off hot coffee",
    "مشروب ساخن على حسابنا 🎁": "A hot drink on us",
    "خصم ١٠٪ على طلبك القادم": "10% off your next order"
  };

  function t(value) {
    if (value == null) return "";
    var text = String(value);
    return lang === "en" && en[text] ? en[text] : text;
  }

  function productName(value) {
    var text = String(value || "");
    if (lang !== "en") return text;
    if (en[text]) return en[text];
    Object.keys(en).sort(function (a, b) { return b.length - a.length; }).some(function (ar) {
      if (text.indexOf(ar) === -1) return false;
      text = text.replace(ar, en[ar]);
      return true;
    });
    return text
      .replace(/^إضافة\s+/, "Add-on: ")
      .replace(/^كومبو\s+/, "Combo: ")
      .replace("(وسط)", "(Medium)")
      .replace("(كبير)", "(Large)");
  }

  function set(next) {
    lang = next === "en" ? "en" : "ar";
    try { localStorage.setItem(KEY, lang); } catch (_) {}
    return lang;
  }

  w.LC_I18N = {
    get lang() { return lang; },
    get isEn() { return lang === "en"; },
    set: set,
    toggle: function () { return set(lang === "ar" ? "en" : "ar"); },
    t: t,
    name: productName,
    currency: function () { return lang === "en" ? "SAR" : "ر.س"; },
    sar: function () { return '<span class="sar" role="img" aria-label="' + (lang === "en" ? "Saudi riyal" : "ريال سعودي") + '"></span>'; },
    catalog: en
  };

  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
})(window);

