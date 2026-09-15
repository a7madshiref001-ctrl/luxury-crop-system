/* icons.js — shared inline-SVG icon set for menu + admin.
   All icons are stroke-based on `currentColor` so they inherit text color.
   Exposed as a global `ICONS` (no modules → works from file:// with no build step).
   Allergen icons are keyed to the 14 SFDA/EU allergen keys used in menu.json. */
(function (global) {
  'use strict';
  var S = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

  // ---- UI icons ----
  var ui = {
    search: S + '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/></svg>',
    close: S + '<path d="M6 6l12 12M18 6 6 18"/></svg>',
    globe: S + '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 2.5 15.4 0 18M12 3c-2.5 2.6-2.5 15.4 0 18"/></svg>',
    pin: S + '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/></svg>',
    info: S + '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6h.01"/></svg>',
    star: S + '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9 6.8 19.7l1-5.8-4.3-4.1 5.9-.9L12 3.5Z"/></svg>',
    leaf: S + '<path d="M5 19c0-8 6-13 14-13 0 8-6 13-14 13Z"/><path d="M5 19c3-4 6-6 9-7"/></svg>',
    flame: S + '<path d="M12 3c1 3-2 4-2 7a2 2 0 0 0 4 .3C16 13 13 6 12 3Z"/><path d="M7.5 13a5.5 5.5 0 1 0 9 0c0-1-.4-2-1-2.8.2 2-1.4 3.2-2.6 3.4.7-1.7-.3-3.6-1.4-4.6C9.7 8.4 8 10.4 8 12.2c0 .3 0 .5-.5.8Z"/></svg>',
    bean: S + '<path d="M5 8c4-5 10-3 12 1s-1 9-6 9S2 13 5 8Z"/><path d="M9 6c3 3 3 9 1 11"/></svg>',
    salt: S + '<path d="M8 9h8l-.7 10.2a1 1 0 0 1-1 .8H9.7a1 1 0 0 1-1-.8L8 9Z"/><path d="M9.2 6.2A3 3 0 0 1 14.8 6.2"/><path d="M10.5 12.5h.01M13 14h.01M11.5 16h.01"/></svg>',
    chevron: S + '<path d="m9 6 6 6-6 6"/></svg>',
    up: S + '<path d="M12 19V5M6 11l6-6 6 6"/></svg>',
    instagram: S + '<rect x="4" y="4" width="16" height="16" rx="4.5"/><circle cx="12" cy="12" r="3.5"/><path d="M16.5 7.5h.01"/></svg>',
    tiktok: S + '<path d="M14 4c.4 2.6 2 4.2 4.5 4.4v3c-1.7 0-3.2-.5-4.5-1.4V15a5.5 5.5 0 1 1-5.5-5.5c.3 0 .7 0 1 .1v3.1a2.5 2.5 0 1 0 1.8 2.4V4H14Z"/></svg>',
    whatsapp: S + '<path d="M4 20l1.3-4A7.5 7.5 0 1 1 8 18.7L4 20Z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5.6 0 .9-.6.7-1.1l-.4-1c-.1-.3-.5-.5-.8-.3l-.8.4a4 4 0 0 1-2-2l.4-.8c.2-.3 0-.7-.3-.8l-1-.4c-.5-.2-1.1.1-1.1.7Z"/></svg>',
    phone: S + '<path d="M5 4h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5V18a2 2 0 0 1-2.2 2A15 15 0 0 1 4 6.2 2 2 0 0 1 5 4Z"/></svg>',
    clock: S + '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 1.8"/></svg>',
    filter: S + '<path d="M4 6h16M7 12h10M10 18h4"/></svg>',
    plus: S + '<path d="M12 5v14M5 12h14"/></svg>',
    trash: S + '<path d="M4 7h16M9 7V5h6v2M6 7l1 12.2a1 1 0 0 0 1 .8h8a1 1 0 0 0 1-.8L18 7"/></svg>',
    edit: S + '<path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17v3Z"/><path d="M14 6l4 4"/></svg>',
    drag: S + '<path d="M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01"/></svg>',
    download: S + '<path d="M12 4v10M8 11l4 4 4-4"/><path d="M5 19h14"/></svg>',
    upload: S + '<path d="M12 20V9M8 12l4-4 4 4"/><path d="M5 19h14"/></svg>',
    eye: S + '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.6"/></svg>',
    check: S + '<path d="M5 12.5 10 17l9-10"/></svg>',
    // Official new Saudi Riyal symbol (vector from the public glyph) — filled, inherits currentColor
    riyal: '<svg viewBox="0 0 260 291" fill="currentColor" aria-hidden="true"><g transform="translate(0,291) scale(0.1,-0.1)"><path d="M1130 2848 c-41 -28 -105 -82 -142 -119 l-68 -68 -2 -613 -3 -613 -339 -71 c-203 -43 -342 -78 -347 -86 -19 -28 -68 -197 -74 -255 -7 -57 -6 -61 11 -57 77 18 728 154 739 154 13 0 15 -31 15 -194 0 -146 -3 -195 -12 -198 -7 -2 -194 -42 -415 -89 l-403 -84 -19 -45 c-20 -46 -54 -172 -66 -242 -5 -32 -3 -38 12 -38 10 0 215 43 457 94 368 79 446 99 485 123 37 23 67 60 151 183 l105 155 3 202 c2 112 4 203 6 203 1 0 64 13 139 30 76 16 144 30 152 30 13 0 15 -44 15 -310 l0 -310 23 5 c12 3 225 48 472 100 248 52 460 99 472 105 16 7 29 32 52 102 28 89 56 216 49 224 -2 1 -22 -1 -43 -6 -92 -22 -699 -150 -712 -150 -10 0 -13 32 -13 154 l0 155 73 15 c39 9 193 42 341 74 l269 57 25 65 c25 68 66 249 58 257 -3 3 -168 -29 -368 -72 -200 -42 -370 -77 -378 -78 -13 -2 -16 68 -20 556 l-5 559 -65 -43 c-36 -24 -102 -79 -147 -123 l-83 -79 -2 -471 -3 -471 -125 -27 c-69 -14 -137 -29 -152 -32 l-28 -5 0 699 c0 385 -4 700 -8 700 -5 0 -42 -23 -82 -52z"/><path d="M2250 470 c-173 -37 -387 -83 -474 -102 l-160 -34 -27 -74 c-29 -81 -64 -238 -55 -247 7 -7 968 195 977 205 20 21 89 267 89 318 0 8 -44 0 -350 -66z"/></g></svg>'
  };

  // ---- allergen icons (14) ----
  var allergen = {
    gluten: S + '<path d="M12 3v18"/><path d="M12 7c-2-1.5-4-1-5 .5 1.7 1 3.3 1 5 .5Zm0 0c2-1.5 4-1 5 .5-1.7 1-3.3 1-5 .5Z"/><path d="M12 12c-2-1.5-4-1-5 .5 1.7 1 3.3 1 5 .5Zm0 0c2-1.5 4-1 5 .5-1.7 1-3.3 1-5 .5Z"/><path d="M12 17c-2-1.5-4-1-5 .5 1.7 1 3.3 1 5 .5Zm0 0c2-1.5 4-1 5 .5-1.7 1-3.3 1-5 .5Z"/></svg>',
    crustaceans: S + '<path d="M7 8c0-2 2-3.5 5-3.5S17 6 17 8c0 1.4-1 2.5-2.5 3"/><path d="M9 11c-2 1-3 3-3 5h12c0-2-1-4-3-5"/><path d="M12 11v9M9 7l-3-2M15 7l3-2"/></svg>',
    eggs: S + '<path d="M12 3c3.3 0 6 4.5 6 8.5a6 6 0 0 1-12 0C6 7.5 8.7 3 12 3Z"/></svg>',
    fish: S + '<path d="M3 12c3-4 8-5 12-3 2 1 4 2 6 3-2 1-4 2-6 3-4 2-9 1-12-3Z"/><path d="M15 9.5l3-3v11l-3-3"/><path d="M8 11.5h.01"/></svg>',
    peanuts: S + '<path d="M9 4c2 0 3 1.4 3 3.2 0 1 .5 1.6 1 2.3.8 1 1.4 2 1.4 3.5A4.4 4.4 0 0 1 5.6 13c0-1.5.6-2.5 1.4-3.5.5-.7 1-1.3 1-2.3C8 5.4 8 4 9 4Z"/><path d="M7 9.5h4M7.5 12.5h3"/></svg>',
    soy: S + '<path d="M6 5c6 0 12 4 12 11"/><circle cx="9" cy="11" r="1.6"/><circle cx="13.5" cy="14.5" r="1.6"/><circle cx="6.5" cy="16" r="1.6"/></svg>',
    milk: S + '<path d="M8 3h8v3l1.5 3v11a1 1 0 0 1-1 1H7.5a1 1 0 0 1-1-1V9L8 6V3Z"/><path d="M6.5 11h11"/></svg>',
    treenuts: S + '<path d="M12 4c3.5 1 5.5 4 5.5 8 0 4-2.5 8-5.5 8s-5.5-4-5.5-8c0-4 2-7 5.5-8Z"/><path d="M12 9v8M9 11.5c1.5 1 4.5 1 6 0"/></svg>',
    celery: S + '<path d="M9 21c-1-5-1-10 0-15M12 21c0-6 0-12 .5-17M15 21c1-5 1-9 0-13"/><path d="M7.5 6c3-1.5 6-1.5 9 0"/></svg>',
    mustard: S + '<path d="M10 3h4v2l1 1v3H9V6l1-1V3Z"/><path d="M9 9h6l.7 9.2a1.5 1.5 0 0 1-1.5 1.8H9.8a1.5 1.5 0 0 1-1.5-1.8L9 9Z"/></svg>',
    sesame: S + '<path d="M8 8c1.4-1 2.6-1 4 0M14 12c-1.4-1-2.6-1-4 0M8 16c1.4-1 2.6-1 4 0"/><path d="M12 8c1.4-1 2.6-1 4 0M10 12c-1.4-1-2.6-1-4 0M12 16c1.4-1 2.6-1 4 0"/></svg>',
    sulphites: S + '<path d="M12 3c3 4 5 6.5 5 9.5A5 5 0 0 1 7 12.5C7 9.5 9 7 12 3Z"/><path d="M13.5 11c-1.2 0-1.8.7-1.8 1.5s.6 1.5 1.8 1.5-1.8.7-1.8 1.5"/></svg>',
    lupin: S + '<path d="M12 13v8"/><path d="M12 13c-2 0-3-1.5-3-3.5S10 6 12 4c2 2 3 3.5 3 5.5S14 13 12 13Z"/><path d="M9.5 16.5c-1.6 0-2.5-1-2.5-2.5M14.5 16.5c1.6 0 2.5-1 2.5-2.5"/></svg>',
    molluscs: S + '<path d="M12 20C7 20 4 16 4 12 4 7 8 4 12 4c3.5 0 5 2 5 4.5S15 13 12 13"/><path d="M12 20c2.5-3 4.5-6 4.5-9"/><path d="M12 20c-1.5-2.5-2.8-5-3.5-8"/></svg>'
  };

  function svg(set, key, cls) {
    var raw = set[key];
    if (!raw) return '';
    return cls ? raw.replace('<svg ', '<svg class="' + cls + '" ') : raw;
  }

  global.ICONS = {
    ui: ui,
    allergen: allergen,
    get: function (name, cls) { return svg(ui, name, cls); },
    al: function (key, cls) { return svg(allergen, key, cls); }
  };
})(window);
