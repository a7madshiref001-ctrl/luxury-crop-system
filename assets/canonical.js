(function (w) {
  "use strict";

  var FINAL_ORIGIN = "https://www.luxurycrop.site";
  var host = String(w.location.hostname || "").toLowerCase();
  var local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
  if (local || host === "www.luxurycrop.site") return;

  var owner = /(?:^|\/)owner(?:\.html)?\/?$/i.test(w.location.pathname || "");
  var target = FINAL_ORIGIN + (owner ? "/owner" : "/") + (w.location.search || "");
  w.location.replace(target);
})(window);
