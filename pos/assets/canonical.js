/* الكاشير ليه عنوان واحد عشان بيانات الجهاز ماتتقسمش بين عناوين مختلفة.
   مؤقتًا العنوان الأساسي هو github.io، ويرجع www.luxurycrop.site/pos/ لما قاعدة البيانات تتجهز */
(function (w) {
  'use strict';
  var HOST = 'a7madshiref001-ctrl.github.io';
  var BASE = '/luxury-crop-pos/';
  var h = String(w.location.hostname || '').toLowerCase();
  if (h === HOST || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return;
  var page = w.location.pathname.split('/').pop() || '';
  if (page && !/\.html$/.test(page)) page += '.html';
  w.location.replace('https://' + HOST + BASE + page + w.location.search + w.location.hash);
})(window);
