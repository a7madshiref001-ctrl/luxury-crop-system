/* محصول فاخر — إعدادات الكاشير (النسخة الحقيقية)
   - mode: 'live' = أرقام حقيقية من الصفر، من غير أي بيانات تجريبية. وضع التدريب منفصل تمامًا.
   - بيانات الفاتورة (الرقم الضريبي، السجل، الهاتف) بتتكتب أول تشغيل من شاشة الإعداد، ومش محفوظة هنا.
   - connect.enabled = false مؤقتًا: لا حفظ على السيرفر ولا طلبات موقع لحد ما قاعدة البيانات تتجهز. ربط الأجهزة (الكشك والمطبخ) شغال بنفس url وkey. */
window.DARJ_CONFIG = {
  mode: 'live',
  key: 'luxurycrop:pos:v1',
  store: {
    nameAr: 'محصول فاخر', sellerAr: 'محصول فاخر', nameEn: 'LUXURY CROP', tagEn: 'Specialty Coffee',
    branchAr: 'الفرع الرئيسي', branchEn: 'Main branch', addr: 'الطائف', phone: '', vat: '', cr: '',
  },
  brand: { mark: 'assets/brand/logo-mark.png', word: 'LUXURY CROP', sub: 'Cashier' },
  loyalNeed: 6,
  welcome: 'أهلًا بك في محصول فاخر — كل 6 طلبات، مشروب ساخن على حسابنا.',
  thanks: 'شكرًا لزيارتكم — محصول فاخر',
  poweredBy: false,
  vatOn: false, // غير مسجل في الضريبة: إيصال بيع من غير ضريبة ولا QR. يتغيّر من الإعدادات لو اتسجل.
  board: false, // مفيش شاشة حالة طلبات للزبون دلوقتي: الكشك بيقول «سننادي على رقمك»
  // أصناف الجولات في وضع التدريب
  tour: { drink: '170284', drink2: '170283', food: '170309', food2: '193000', dessert: '170313', mod: 'addon_hot_1', drinkName: 'سبانش لاتيه', foodName: 'كوكيز فانيليا', modName: 'الحليب النباتي' },
  connect: {
    enabled: false,
    version: '6',
    url: 'https://qckjfyupxwctfizqdbxe.supabase.co',
    key: 'sb_publishable_zN4rosy4qTS9Nbyx1iFxYw_Azx-lYnc', // مفتاح عام (نفس اللي في الموقع) — الحماية في RLS
    pollMs: 5000,
  },
};
