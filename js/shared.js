export const $ = (s) => document.querySelector(s);
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export const store = {
  get(k, d) {
    try {
      return JSON.parse(localStorage.getItem("lc.v2." + k)) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("lc.v2." + k, JSON.stringify(v));
    } catch {}
  },
};
export const money = (c, lang = "ar") =>
  new Intl.NumberFormat(lang === "ar" ? "ar-SA" : "en-SA", {
    maximumFractionDigits: 2,
  }).format(c / 100);
export const normalize = (s) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .trim();
export async function api(url, options = {}) {
  const r = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
    signal: options.signal || AbortSignal.timeout(12000),
  });
  const j = await r.json().catch(() => {
    throw Object.assign(new Error("خدمة النظام غير متاحة حاليًا"), {
      status: r.ok ? 502 : r.status,
    });
  });
  if (!r.ok) throw Object.assign(new Error(j.error), { status: r.status });
  return j;
}
export const post = (url, data, method = "POST") =>
  api(url, { method, body: JSON.stringify(data) });
let toastTimer;
export function toast(msg) {
  $("#toast").textContent = msg;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 4500);
}
export const icons = {
  search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
  bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M8 8V6a4 4 0 0 1 8 0v2"/>',
  arrow: '<path d="M19 12H5m6-6-6 6 6 6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  heart:
    '<path d="M20 5c-3-3-7-1-8 1-1-2-5-4-8-1-4 4 0 9 8 15 8-6 12-11 8-15Z"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  coffee:
    '<path d="M4 9h12v7a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Zm12 1h2a3 3 0 0 1 0 6h-2M7 2v3m5-3v3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  star: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z"/>',
};
export const icon = (name) =>
  `<svg viewBox="0 0 24 24" aria-hidden="true" class="icon">${icons[name] || icons.coffee}</svg>`;
export function dialog(content) {
  const el = $("#dialog");
  el.innerHTML = `<button class="icon-btn close" data-close aria-label="إغلاق / Close">${icon("close")}</button>${content}`;
  if (!el.open) el.showModal();
  el.scrollTop = 0;
  document.body.classList.add("modal-open");
}
export function closeDialog() {
  const el = $("#dialog");
  el.close();
  document.body.classList.remove("modal-open");
}
document.addEventListener("click", (e) => {
  if (e.target.closest("[data-close]")) closeDialog();
});
$("#dialog")?.addEventListener("click", (e) => {
  if (e.target === $("#dialog")) {
    const r = e.target.getBoundingClientRect();
    if (
      e.clientX < r.left ||
      e.clientX > r.right ||
      e.clientY < r.top ||
      e.clientY > r.bottom
    )
      closeDialog();
  }
});
$("#dialog")?.addEventListener("close", () =>
  document.body.classList.remove("modal-open"),
);
export const download = (name, content, type = "application/json") => {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};
export const states = {
  new: "جديد",
  preparing: "قيد التحضير",
  ready: "جاهز للاستلام",
  completed: "مكتمل",
  cancelled: "ملغي",
};
export const modes = {
  table: "على الطاولة",
  takeaway: "استلام من الفرع",
  delivery: "توصيل",
};
export const optionName = (value, lang = "ar") => {
  const options = {
    cow: ["حليب بقري", "Dairy milk"],
    soy: ["حليب صويا", "Soy milk"],
    coconut: ["حليب جوز الهند", "Coconut milk"],
    almond: ["حليب لوز", "Almond milk"],
    vanilla: ["فانيليا", "Vanilla"],
    caramel: ["كراميل", "Caramel"],
  };
  return options[value]?.[lang === "en" ? 1 : 0] || "";
};
document.addEventListener(
  "error",
  (e) => {
    if (e.target instanceof HTMLImageElement && !e.target.dataset.fallback) {
      e.target.dataset.fallback = "true";
      e.target.src = "assets/logo.png";
      e.target.style.objectFit = "contain";
    }
  },
  true,
);
