/*
 * إعداد الربط الآمن بقاعدة البيانات.
 * مفتاح Supabase publishable/anon مصمم للواجهة العامة؛ الحماية الفعلية في RLS.
 * لا تضع مفتاحًا بصلاحيات إدارية أو كلمة مرور هنا مطلقًا.
 */
window.BACKEND_CONFIG = {
  url: "",
  publishableKey: "",
  orderPollMs: 2500
};
