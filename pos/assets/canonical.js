/* الكاشير ليه عنوان واحد عشان بيانات الجهاز ماتتقسمش بين عناوين مختلفة.
   العنوان الأساسي: www.luxurycrop.site/pos/ — أي عنوان تاني (github.io القديم) بيحوّل عليه. */
(function (w) {
  'use strict';
  var HOST = 'www.luxurycrop.site';
  var BASE = '/pos/';
  var h = String(w.location.hostname || '').toLowerCase();
  if (h === HOST || h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return;
  var page = w.location.pathname.split('/').pop() || '';
  if (page && !/\.html$/.test(page)) page += '.html';
  w.location.replace('https://' + HOST + BASE + page + w.location.search + w.location.hash);
})(window);
