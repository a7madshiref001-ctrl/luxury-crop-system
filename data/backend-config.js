/*
 * إعداد الربط الآمن بقاعدة البيانات.
 * مفتاح Supabase publishable/anon مصمم للواجهة العامة؛ الحماية الفعلية في RLS.
 * لا تضع مفتاحًا بصلاحيات إدارية أو كلمة مرور هنا مطلقًا.
 */
window.BACKEND_CONFIG = {
  url: "https://qckjfyupxwctfizqdbxe.supabase.co",
  publishableKey: "sb_publishable_zN4rosy4qTS9Nbyx1iFxYw_Azx-lYnc",
  orderPollMs: 2500
};

/* المصدر الوحيد لكل الروابط العامة والـQR. لا تُولّد رابطًا من location.href. */
window.SITE_CONFIG = Object.freeze({
  menuUrl: "https://www.luxurycrop.site/",
  adminUrl: "https://www.luxurycrop.site/owner",
  canonicalHost: "www.luxurycrop.site"
});

/* قفل متصفح مساعد؛ الحماية الأساسية تظل في Supabase Auth وحدود الـIP. */
window.ADMIN_SECURITY = Object.freeze({
  maxFailedAttempts: 5,
  attemptWindowMs: 15 * 60 * 1000,
  lockoutMs: 15 * 60 * 1000
});
