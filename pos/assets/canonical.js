/* الكاشير ليه دومين واحد عشان بيانات الجهاز ماتتقسمش بين عناوين مختلفة */
(function (w) {
  'use strict';
  var FINAL = 'www.luxurycrop.site';
  var h = String(w.location.hostname || '').toLowerCase();
  if (h === FINAL || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return;
  w.location.replace('https://' + FINAL + '/pos/' + (w.location.pathname.split('/').pop() || '') + w.location.search + w.location.hash);
})(window);
