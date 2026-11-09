/* لو النت قطع والصفحة اتفتحت من جديد، الكاشير يفتح من آخر نسخة على الجهاز */
if ('serviceWorker' in navigator && /\/(pos|luxury-crop-pos)\//.test(location.pathname)) {
  window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
}
