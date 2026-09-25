(function (w) {
  "use strict";

  function finalMenuUrl(locationToken) {
    var config = w.SITE_CONFIG || {};
    var url = new URL(config.menuUrl || "https://luxury-crop-system.pages.dev/");
    url.pathname = "/";
    url.search = "";
    url.hash = "";
    if (locationToken) url.searchParams.set("loc", String(locationToken));
    return url.href;
  }

  function assertFinalUrl(value) {
    var expected = String((w.SITE_CONFIG || {}).canonicalHost || "luxury-crop-system.pages.dev").toLowerCase();
    var url = new URL(value);
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== expected) {
      throw new Error("QR links must use the final production host");
    }
    return url.href;
  }

  function svg(value, cellSize) {
    if (typeof w.qrcode !== "function") throw new Error("QR library is unavailable");
    var url = assertFinalUrl(value);
    var code = w.qrcode(0, "M");
    code.addData(url, "Byte");
    code.make();
    return code.createSvgTag({ cellSize: cellSize || 7, margin: 4, scalable: true });
  }

  function render(element, value, label) {
    if (!element) return;
    var url = assertFinalUrl(value);
    element.innerHTML = '<div class="qr-local" role="img" aria-label="' + String(label || "QR للرابط النهائي") + '">' +
      svg(url, 7) + '</div><code class="qr-url" dir="ltr"></code>';
    element.querySelector(".qr-url").textContent = url;
    element.dataset.qrUrl = url;
  }

  w.LuxuryQR = Object.freeze({ finalMenuUrl: finalMenuUrl, render: render, svg: svg });
})(window);
