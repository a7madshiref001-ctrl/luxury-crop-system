/* لوحة الإدارة القديمة اتلغت: إدارة الموقع بقت جوّه الكاشير (صفحة Website، للمدير فقط).
   الصفحة دي فضلت لغرض واحد: روابط تفعيل الحساب واستعادة كلمة المرور اللي بتيجي على البريد.
   أي فتح عادي بيتحوّل للكاشير، ولو التفعيل خلص بيتحوّل برضه. */
(function (w, d) {
  "use strict";
  var host = String(w.location.hostname || "").toLowerCase();
  var local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  var target = local ? "pos/app.html#site" : "/pos/app#site";
  var auth = /(?:^|[&#?])(?:type=(?:invite|recovery|signup|magiclink)|access_token=|error_code=|code=)/.test(String(w.location.hash || "") + "&" + String(w.location.search || ""));
  if (!auth) { w.location.replace(target); return; }
  d.addEventListener("DOMContentLoaded", function () {
    new MutationObserver(function () { if (d.body.classList.contains("live-admin")) w.location.replace(target); })
      .observe(d.body, { attributes: true, attributeFilter: ["class"] });
  });
})(window, document);
