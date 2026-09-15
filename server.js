"use strict";
const http = require("node:http"),
  fs = require("node:fs"),
  path = require("node:path"),
  crypto = require("node:crypto");
const { DatabaseSync, backup } = require("node:sqlite");
const D = require("./lib/domain");
const ROOT = __dirname,
  RUNTIME = process.env.DATA_DIR || path.join(ROOT, ".runtime");
fs.mkdirSync(RUNTIME, { recursive: true });
const db = new DatabaseSync(path.join(RUNTIME, "luxury-crop.sqlite"));
db.exec(
  "PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS kv(key TEXT PRIMARY KEY, value TEXT NOT NULL); CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, idem TEXT UNIQUE NOT NULL, token TEXT NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS reviews(id TEXT PRIMARY KEY, data TEXT NOT NULL);",
);
const get = (key, fallback) => {
  const r = db.prepare("SELECT value FROM kv WHERE key=?").get(key);
  return r ? JSON.parse(r.value) : fallback;
};
const put = (key, v) =>
  db
    .prepare(
      "INSERT INTO kv(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
    )
    .run(key, JSON.stringify(v));
let menu = get("menu", null);
if (!menu) {
  menu = JSON.parse(fs.readFileSync(path.join(ROOT, "data/menu.json"), "utf8"));
  D.validateMenu(menu);
  put("menu", menu);
}
let settings = get("settings", D.defaultSettings),
  revision = get("revision", 1);
let password = process.env.ADMIN_PASSWORD;
if (!password) {
  const f = path.join(RUNTIME, "owner-access.txt");
  if (process.env.NODE_ENV === "production")
    throw new Error("ADMIN_PASSWORD is required in production");
  if (!fs.existsSync(f)) fs.writeFileSync(f, D.token(), { mode: 0o600 });
  password = fs.readFileSync(f, "utf8").trim();
}
if (password.length < 12)
  throw new Error("ADMIN_PASSWORD must have at least 12 characters");
const salt = crypto.randomBytes(16),
  passwordHash = crypto.scryptSync(password, salt, 32);
password = null;
const sessions = new Map(),
  limits = new Map();
const HOST = process.env.HOST || "127.0.0.1",
  PORT = Number(process.env.PORT || 5050);
const publicMenu = () => ({
  ...menu,
  brand: { ...menu.brand, whatsapp_admin: undefined },
  settings,
  revision,
  server: true,
});
function limit(req, key, max, period = 60000) {
  const k = req.socket.remoteAddress + key,
    now = Date.now(),
    r = limits.get(k);
  if (!r || now > r.until) {
    limits.set(k, { n: 1, until: now + period });
    return;
  }
  if (++r.n > max) D.fail("طلبات كثيرة، حاول بعد قليل", 429);
}
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of limits) if (v.until < now) limits.delete(k);
  for (const [k, v] of sessions) if (v < now) sessions.delete(k);
  db.prepare("DELETE FROM events WHERE at < ?").run(now - 90 * 86400000);
}, 60000).unref();
function session(req) {
  const t = (req.headers.cookie || "").match(
    /(?:^|; )lc_session=([a-f0-9]+)/,
  )?.[1];
  return t && sessions.get(t) > Date.now() ? t : null;
}
async function body(req) {
  if (!req.headers["content-type"]?.startsWith("application/json"))
    D.fail("JSON required", 415);
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    chunks.push(chunk);
    size += chunk.length;
    if (size > 2 * 1024 * 1024) D.fail("حجم الملف أكبر من المسموح", 413);
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      D.fail("JSON غير صالح");
    return parsed;
  } catch {
    D.fail("JSON غير صالح");
  }
}
const allOrders = () =>
  db
    .prepare("SELECT data FROM orders ORDER BY rowid DESC")
    .all()
    .map((r) => JSON.parse(r.data));
function send(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(data));
}
const staticAllowed =
  /^(?:index\.html|admin\.html|owner\.html|(?:assets|css|js)\/[a-zA-Z0-9_./-]+|data\/menu\.json)$/;
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const server = http.createServer(async (req, res) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  try {
    const u = new URL(req.url, "http://localhost"),
      p = u.pathname;
    if (p.startsWith("/api/")) {
      limit(req, "all", 500);
      if (!["GET", "HEAD"].includes(req.method)) {
        const expected =
          process.env.PUBLIC_ORIGIN || `http://${req.headers.host}`;
        if (req.headers.origin && req.headers.origin !== expected)
          D.fail("طلب من مصدر غير مسموح", 403);
        if (req.headers["sec-fetch-site"] === "cross-site")
          D.fail("طلب من مصدر غير مسموح", 403);
      }
      if (p === "/api/menu" && req.method === "GET")
        return send(res, 200, publicMenu());
      if (p === "/api/login" && req.method === "POST") {
        limit(req, "login", 8, 15 * 60000);
        const b = await body(req),
          candidate = crypto.scryptSync(D.text(b.password, 300), salt, 32);
        if (!crypto.timingSafeEqual(candidate, passwordHash))
          D.fail("بيانات الدخول غير صحيحة", 401);
        const t = D.token();
        sessions.set(t, Date.now() + 8 * 3600000);
        res.setHeader(
          "Set-Cookie",
          `lc_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${process.env.NODE_ENV === "production" ? "; Secure" : ""}`,
        );
        return send(res, 200, { ok: true });
      }
      if (p === "/api/logout" && req.method === "POST") {
        const t = session(req);
        sessions.delete(t);
        res.setHeader(
          "Set-Cookie",
          "lc_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        );
        return send(res, 200, { ok: true });
      }
      if (p === "/api/orders" && req.method === "POST") {
        limit(req, "order", 20, 60000);
        const b = await body(req),
          idem = D.cleanId(b.idempotencyKey);
        if (idem.length < 24) D.fail("مفتاح الطلب غير صالح");
        const old = db
          .prepare("SELECT data,token FROM orders WHERE idem=?")
          .get(idem);
        if (old)
          return send(res, 200, {
            ...D.publicOrder(JSON.parse(old.data)),
            token: old.token,
          });
        const quote = D.quoteOrder(b, menu, settings);
        if (b.expectedTotal !== quote.total)
          D.fail("تغير السعر، راجع السلة وأعد الإرسال", 409);
        const id = crypto.randomUUID(),
          token = D.token(),
          number =
            Number(db.prepare("SELECT COUNT(*) n FROM orders").get().n) + 1;
        const order = {
          ...quote,
          id,
          number,
          status: "new",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        db.prepare(
          "INSERT INTO orders(id,idem,token,data) VALUES(?,?,?,?)",
        ).run(id, idem, token, JSON.stringify(order));
        return send(res, 201, { ...D.publicOrder(order), token });
      }
      if (p.startsWith("/api/order/") && req.method === "GET") {
        const row = db
          .prepare("SELECT data,token FROM orders WHERE id=?")
          .get(p.split("/").pop());
        if (!row || u.searchParams.get("token") !== row.token)
          D.fail("الطلب غير موجود", 404);
        return send(res, 200, D.publicOrder(JSON.parse(row.data)));
      }
      if (p === "/api/events" && req.method === "POST") {
        limit(req, "events", 100);
        const b = await body(req);
        if (!["visit", "item_view", "add_cart", "suggestion"].includes(b.kind))
          D.fail("حدث غير صالح");
        const ev = {
          kind: b.kind,
          itemId: D.text(b.itemId, 80),
          at: Date.now(),
        };
        db.prepare("INSERT INTO events(at,data) VALUES(?,?)").run(
          ev.at,
          JSON.stringify(ev),
        );
        return send(res, 201, { ok: true });
      }
      if (p === "/api/reviews" && req.method === "POST") {
        limit(req, "review", 4, 3600000);
        const b = await body(req),
          stars = D.num(b.stars, 1, 5);
        if (!Number.isInteger(stars)) D.fail("تقييم غير صحيح");
        const r = {
          id: crypto.randomUUID(),
          stars,
          note: D.text(b.note, 1000),
          at: Date.now(),
        };
        db.prepare("INSERT INTO reviews(id,data) VALUES(?,?)").run(
          r.id,
          JSON.stringify(r),
        );
        return send(res, 201, { ok: true });
      }
      if (p.startsWith("/api/admin/")) {
        if (!session(req)) D.fail("سجل الدخول أولًا", 401);
        if (p === "/api/admin/state" && req.method === "GET") {
          const orders = allOrders(),
            events = db
              .prepare("SELECT data FROM events")
              .all()
              .map((r) => JSON.parse(r.data)),
            reviews = db
              .prepare("SELECT data FROM reviews ORDER BY rowid DESC")
              .all()
              .map((r) => JSON.parse(r.data));
          return send(res, 200, {
            menu,
            settings,
            revision,
            orders,
            reviews,
            redemptions: get("redemptions", []),
            summary: D.summary(
              orders,
              events,
              reviews,
              Math.min(
                90,
                Math.max(1, Number(u.searchParams.get("days")) || 30),
              ),
            ),
          });
        }
        if (p === "/api/admin/menu" && req.method === "PUT") {
          const b = await body(req);
          if (b.revision !== revision)
            D.fail("تم تعديل المنيو من جهاز آخر؛ حدّث الصفحة أولًا", 409);
          const clean = D.validateMenu(b.menu);
          const nextMenu = { ...menu, ...clean };
          const nextRevision = revision + 1;
          db.exec("BEGIN");
          try {
            put("menu", nextMenu);
            put("revision", nextRevision);
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          menu = nextMenu;
          revision = nextRevision;
          return send(res, 200, { revision, menu });
        }
        if (p === "/api/admin/settings" && req.method === "PUT") {
          const b = await body(req);
          if (b.revision !== revision)
            D.fail("تم تعديل الإعدادات من جهاز آخر؛ حدّث الصفحة", 409);
          const next = D.validateSettings(b.settings);
          if (
            next.offer.category &&
            !menu.categories.some((c) => c.id === next.offer.category)
          )
            D.fail("قسم العرض غير موجود");
          db.exec("BEGIN");
          try {
            put("settings", next);
            put("revision", revision + 1);
            db.exec("COMMIT");
          } catch (e) {
            db.exec("ROLLBACK");
            throw e;
          }
          settings = next;
          revision++;
          return send(res, 200, { settings, revision });
        }
        if (p.startsWith("/api/admin/order/") && req.method === "PATCH") {
          const b = await body(req);
          const id = p.split("/").pop(),
            r = db.prepare("SELECT data FROM orders WHERE id=?").get(id);
          if (!r) D.fail("الطلب غير موجود", 404);
          const o = D.changeStatus(JSON.parse(r.data), b.status);
          db.prepare("UPDATE orders SET data=? WHERE id=?").run(
            JSON.stringify(o),
            id,
          );
          return send(res, 200, o);
        }
        if (p === "/api/admin/redeem" && req.method === "POST") {
          const b = await body(req),
            phone = D.text(b.phone, 20),
            l = settings.loyalty,
            ledger = get("redemptions", []);
          if (!l.enabled) D.fail("برنامج الولاء غير مفعّل");
          const count = allOrders().filter(
            (o) => o.status === "completed" && o.phone === phone,
          ).length;
          const used = ledger
            .filter((r) => r.phone === phone)
            .reduce((n, r) => n + r.stamps, 0);
          if (count - used < l.goal) D.fail("لا توجد أختام كافية", 409);
          const row = {
            id: crypto.randomUUID(),
            phone,
            stamps: l.goal,
            reward: l.reward,
            at: Date.now(),
          };
          ledger.push(row);
          put("redemptions", ledger);
          return send(res, 201, row);
        }
        if (p === "/api/admin/database" && req.method === "GET") {
          limit(req, "backup", 3);
          const filename = path.join(
            RUNTIME,
            "snapshot-" + crypto.randomUUID() + ".sqlite",
          );
          try {
            await backup(db, filename);
            const bytes = await fs.promises.readFile(filename);
            res.writeHead(200, {
              "Content-Type": "application/vnd.sqlite3",
              "Cache-Control": "no-store",
              "Content-Disposition":
                'attachment; filename="luxury-crop.sqlite"',
            });
            return res.end(bytes);
          } finally {
            await fs.promises.unlink(filename).catch(() => {});
          }
        }
        if (p === "/api/admin/backup" && req.method === "GET")
          return send(res, 200, {
            version: 2,
            exportedAt: new Date().toISOString(),
            menu,
            settings,
            redemptions: get("redemptions", []),
            orders: allOrders(),
            reviews: db
              .prepare("SELECT data FROM reviews")
              .all()
              .map((r) => JSON.parse(r.data)),
          });
        if (p === "/api/admin/qr" && req.method === "GET") {
          const target = u.searchParams.get("url");
          if (!target || target.length > 1000 || !/^https?:\/\//.test(target))
            D.fail("رابط غير صحيح");
          const svg = await require("qrcode").toString(target, {
            type: "svg",
            margin: 3,
            width: 320,
          });
          res.writeHead(200, { "Content-Type": "image/svg+xml" });
          return res.end(svg);
        }
      }
      D.fail("المسار غير موجود", 404);
    }
    if (req.method !== "GET" && req.method !== "HEAD")
      D.fail("طريقة غير مدعومة", 405);
    const rel = decodeURIComponent(p === "/" ? "/index.html" : p).slice(1);
    if (!staticAllowed.test(rel) || rel.includes("..") || rel.includes("\\"))
      D.fail("غير موجود", 404);
    const fp = path.resolve(ROOT, rel);
    if (!fp.startsWith(ROOT + path.sep)) D.fail("غير موجود", 404);
    const buf = await fs.promises
      .readFile(fp)
      .catch(() => D.fail("غير موجود", 404));
    res.writeHead(200, {
      "Content-Type": mime[path.extname(fp)] || "application/octet-stream",
      "Cache-Control": /\.(webp|png|woff2)$/.test(fp)
        ? "public, max-age=86400"
        : "no-cache",
    });
    res.end(req.method === "HEAD" ? undefined : buf);
  } catch (e) {
    send(res, e.status || 500, {
      error: e.status ? e.message : "تعذر إتمام العملية. حاول مجددًا.",
    });
    if (!e.status) console.error(e.message);
  }
});
server.listen(PORT, HOST, () =>
  console.log(
    `Luxury Crop: http://${HOST}:${PORT} — owner: /owner.html. Local access key: .runtime/owner-access.txt`,
  ),
);
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () =>
    server.close(() => {
      db.close();
      process.exit(0);
    }),
  );
