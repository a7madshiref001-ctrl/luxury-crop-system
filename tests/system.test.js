const { test, before, after } = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs"),
  os = require("node:os"),
  path = require("node:path"),
  { spawn } = require("node:child_process");
const D = require("../lib/domain"),
  menu = JSON.parse(
    fs.readFileSync(path.join(__dirname, "../data/menu.json"), "utf8"),
  );
const settings = () => structuredClone(D.defaultSettings);
const base = () => ({
  mode: "table",
  table: 1,
  lines: [{ id: "170283", quantity: 1 }],
  expectedTotal: 1700,
  idempotencyKey: crypto.randomUUID(),
});
test("all original 64 IDs remain unique across 10 categories", () => {
  assert.equal(menu.categories.length, 10);
  const ids = menu.categories.flatMap((c) => c.items.map((i) => i.id));
  assert.equal(ids.length, 64);
  assert.equal(new Set(ids).size, 64);
  D.validateMenu(menu);
});
test("same-name hot/cold items retain separate IDs and categories", () => {
  const b = base();
  b.lines = [
    { id: "170283", quantity: 1 },
    { id: "170293", quantity: 2 },
  ];
  const q = D.quoteOrder(b, menu, settings());
  assert.equal(q.total, 5100);
  assert.notEqual(q.lines[0].category, q.lines[1].category);
});
test("server ignores tampered client prices and total", () => {
  const b = base();
  b.lines[0].price = 0.01;
  b.total = 1;
  assert.equal(D.quoteOrder(b, menu, settings()).total, 1700);
});
test("negative, fractional, excessive and aggregate quantities fail", () => {
  for (const q of [-1, 0, 1.5, 21, NaN]) {
    const b = base();
    b.lines[0].quantity = q;
    assert.throws(() => D.quoteOrder(b, menu, settings()));
  }
  const b = base();
  b.lines = [
    { id: "170283", quantity: 15 },
    { id: "170283", quantity: 15 },
  ];
  assert.throws(() => D.quoteOrder(b, menu, settings()));
});
test("unavailable and unknown items rejected", () => {
  const m = structuredClone(menu);
  m.categories
    .flatMap((c) => c.items)
    .find((i) => i.id === "170283").available = false;
  assert.throws(() => D.quoteOrder(base(), m, settings()));
  const b = base();
  b.lines[0].id = "missing";
  assert.throws(() => D.quoteOrder(b, menu, settings()));
});
test("table range and delivery contact/address are validated", () => {
  const b = base();
  b.table = 500;
  assert.throws(() => D.quoteOrder(b, menu, settings()));
  b.mode = "delivery";
  const s = settings();
  s.modes.push("delivery");
  assert.throws(() => D.quoteOrder(b, menu, s));
  Object.assign(b, {
    phone: "٠٥٠١٢٣٤٥٦٧",
    name: "ضيف",
    address: "الطائف شارع رئيسي",
  });
  s.deliveryFee = 8;
  assert.equal(D.quoteOrder(b, menu, s).total, 2500);
  assert.equal(D.quoteOrder(b, menu, s).phone, "0501234567");
});
test("only documented matcha options are sold", () => {
  const b = base();
  b.lines[0] = { id: "170300", quantity: 2, milk: "almond", extra: "vanilla" };
  assert.equal(D.quoteOrder(b, menu, settings()).total, 5200);
  b.lines[0].id = "170283";
  assert.throws(() => D.quoteOrder(b, menu, settings()));
});
test("offers obey start/end and category and preserve cents", () => {
  const s = settings(),
    i = menu.categories.flatMap((c) => c.items).find((i) => i.id === "170283"),
    cat = menu.categories.find((c) => c.items.some((x) => x.id === i.id)).id;
  s.offer = {
    enabled: true,
    title: "اختبار",
    percent: 15,
    category: cat,
    startsAt: new Date(1000).toISOString(),
    endsAt: new Date(3000).toISOString(),
  };
  assert.equal(D.unitPrice(i, cat, s, 999), 1700);
  assert.equal(D.unitPrice(i, cat, s, 1000), 1445);
  assert.equal(D.unitPrice(i, "other", s, 2000), 1700);
  assert.equal(D.unitPrice(i, cat, s, 3000), 1700);
});
test("empty menu, duplicate IDs and negative prices rejected on import", () => {
  assert.throws(() => D.validateMenu({ categories: [] }));
  const m = structuredClone(menu);
  m.categories[0].items[0].price = -1;
  assert.throws(() => D.validateMenu(m));
  m.categories[0].items[0].price = 18;
  m.categories[0].items.push(m.categories[0].items[0]);
  assert.throws(() => D.validateMenu(m));
});
test("unsafe image paths are discarded, allergen keys preserved", () => {
  const m = structuredClone(menu);
  m.categories[0].items[0].image = "assets/../.runtime/owner-access.txt";
  m.categories[0].items[0].allergens = ["treenuts", "evil"];
  const i = D.validateMenu(m).categories[0].items[0];
  assert.equal(i.image, null);
  assert.deepEqual(i.allergens, ["treenuts"]);
});
test("only completed paid orders affect revenue", () => {
  const q = D.quoteOrder(base(), menu, settings());
  const now = Date.now();
  const orders = ["new", "preparing", "ready", "cancelled", "completed"].map(
    (status) => ({ ...q, status, createdAt: now, completedAt: now }),
  );
  assert.equal(D.summary(orders, [], []).revenue, 1700);
  assert.equal(D.summary(orders, [], []).completed, 1);
});
test("state transitions cannot complete twice or revive cancelled orders", () => {
  assert.throws(() => D.changeStatus({ status: "new" }, "completed"));
  assert.throws(() => D.changeStatus({ status: "completed" }, "completed"));
  assert.throws(() => D.changeStatus({ status: "cancelled" }, "new"));
  assert.equal(
    D.changeStatus({ status: "ready" }, "completed").status,
    "completed",
  );
});
test("analytics handles arbitrary event IDs without prototype pollution", () => {
  assert.doesNotThrow(() =>
    D.summary(
      [],
      [{ kind: "item_view", itemId: "__proto__", at: Date.now() }],
      [],
    ),
  );
});
test("public order response omits customer PII and private token", () => {
  const o = {
    ...D.quoteOrder(base(), menu, settings()),
    phone: "0501234567",
    address: "secret",
    token: "secret",
    id: "1",
  };
  assert.equal(D.publicOrder(o).phone, undefined);
  assert.equal(D.publicOrder(o).token, undefined);
});
test("coupons validate expiry, minimum and non-stacking, and distribute exact cents", () => {
  const s = settings(),
    b = base();
  s.coupon = {
    enabled: true,
    code: "CROP10",
    percent: 10,
    minSubtotal: 10,
    endsAt: new Date(Date.now() + 3600000).toISOString(),
  };
  b.couponCode = "crop10";
  b.lines.push({ id: "170309", quantity: 1 });
  const q = D.quoteOrder(b, menu, s);
  assert.equal(q.total, 2430);
  assert.equal(q.discount, 270);
  assert.equal(
    q.lines.reduce((n, l) => n + l.discount, 0),
    270,
  );
  s.coupon.minSubtotal = 100;
  assert.throws(() => D.quoteOrder(b, menu, s));
  s.coupon.minSubtotal = 0;
  s.coupon.endsAt = new Date(Date.now() - 1000).toISOString();
  assert.throws(() => D.quoteOrder(b, menu, s));
  s.coupon.endsAt = new Date(Date.now() + 3600000).toISOString();
  s.offer = {
    enabled: true,
    percent: 20,
    startsAt: new Date(Date.now() - 1000).toISOString(),
    endsAt: new Date(Date.now() + 3600000).toISOString(),
  };
  assert.throws(() => D.quoteOrder(b, menu, s));
});
test("zero-priced lines produce finite totals and discount allocation", () => {
  const m = structuredClone(menu);
  for (const i of m.categories.flatMap((c) => c.items)) i.price = 0;
  const b = base();
  b.lines.push({ id: "170309", quantity: 1 });
  const q = D.quoteOrder(b, m, settings());
  assert.equal(q.total, 0);
  assert.ok(q.lines.every((l) => l.discount === 0));
});
test("coupon-discounted product revenue reconciles with order totals", () => {
  const s = settings(),
    b = base();
  s.coupon = {
    enabled: true,
    code: "CROP10",
    percent: 10,
    minSubtotal: 0,
    endsAt: new Date(Date.now() + 10000).toISOString(),
  };
  b.couponCode = "CROP10";
  const q = D.quoteOrder(b, menu, s),
    a = D.summary(
      [
        {
          ...q,
          status: "completed",
          createdAt: Date.now(),
          completedAt: Date.now(),
        },
      ],
      [],
      [],
    );
  assert.equal(a.revenue, 1530);
  assert.equal(a.products[0].revenue, 1530);
});
let proc, dir, cookie;
const origin = "http://127.0.0.1:5151";
async function req(p, body, method, auth = false) {
  const r = await fetch(origin + p, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "Content-Type": "application/json",
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { r, j: await r.json() };
}
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "lc-tests-"));
  proc = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "5151",
      DATA_DIR: dir,
      ADMIN_PASSWORD: "test-password-not-production",
      NODE_ENV: "test",
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(origin + "/api/menu");
      if (r.ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  throw Error("Test server did not start");
});
after(async () => {
  if (proc) {
    proc.kill();
    await new Promise((r) => proc.once("exit", r));
  }
  if (
    dir &&
    path.dirname(dir) === os.tmpdir() &&
    path.basename(dir).startsWith("lc-tests-")
  )
    fs.rmSync(dir, { recursive: true, force: true });
});
test("API auth, private file protection, CSRF, idempotency, tracking and revision conflict", async () => {
  assert.equal((await req("/api/admin/state")).r.status, 401);
  for (const p of [
    "/server.js",
    "/.runtime/owner-access.txt",
    "/.git/config",
    "/lib/domain.js",
  ])
    assert.equal((await fetch(origin + p)).status, 404);
  const login = await req("/api/login", {
    password: "test-password-not-production",
  });
  assert.equal(login.r.status, 200);
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  assert.match(login.r.headers.get("set-cookie"), /HttpOnly/);
  const csrf = await fetch(origin + "/api/admin/settings", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Cookie: cookie,
      Origin: "https://evil.invalid",
    },
    body: "{}",
  });
  assert.equal(csrf.status, 403);
  const bad = base();
  bad.expectedTotal = 1;
  assert.equal((await req("/api/orders", bad)).r.status, 409);
  const b = base(),
    first = await req("/api/orders", b),
    second = await req("/api/orders", b);
  assert.equal(first.r.status, 201);
  assert.equal(second.j.id, first.j.id);
  const [parallel1, parallel2] = await Promise.all([
    req("/api/orders", b),
    req("/api/orders", b),
  ]);
  assert.equal(parallel1.j.id, parallel2.j.id);
  assert.equal((await req("/api/order/" + first.j.id)).r.status, 404);
  assert.equal(
    (await req("/api/order/" + first.j.id + "?token=" + first.j.token)).j
      .status,
    "new",
  );
  const st = (await req("/api/admin/state", null, null, true)).j;
  assert.equal(st.orders.length, 1);
  assert.equal(st.summary.revenue, 0);
  for (const status of ["preparing", "ready", "completed"])
    assert.equal(
      (await req("/api/admin/order/" + first.j.id, { status }, "PATCH", true)).r
        .status,
      200,
    );
  assert.equal(
    (await req("/api/admin/state", null, null, true)).j.summary.revenue,
    1700,
  );
  assert.equal(
    (
      await req(
        "/api/admin/order/" + first.j.id,
        { status: "completed" },
        "PATCH",
        true,
      )
    ).r.status,
    409,
  );
  const updated = await req(
    "/api/admin/menu",
    { menu: st.menu, revision: st.revision },
    "PUT",
    true,
  );
  assert.equal(updated.r.status, 200);
  assert.equal(
    (
      await req(
        "/api/admin/menu",
        { menu: st.menu, revision: st.revision },
        "PUT",
        true,
      )
    ).r.status,
    409,
  );
  assert.equal(
    (await req("/api/reviews", { stars: 1, note: "feedback" })).r.status,
    201,
  );
  assert.equal(
    (await req("/api/admin/state", null, null, true)).j.reviews.length,
    1,
  );
  await req("/api/logout", {}, "POST", true);
  assert.equal((await req("/api/admin/state", null, null, true)).r.status, 401);
});

test("loyalty redemption, database backup and durable restart", async () => {
  let login = await req("/api/login", {
    password: "test-password-not-production",
  });
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  let st = (await req("/api/admin/state", null, null, true)).j;
  st.settings.loyalty = { enabled: true, goal: 2, reward: "مكافأة اختبار" };
  const saved = await req(
    "/api/admin/settings",
    { settings: st.settings, revision: st.revision },
    "PUT",
    true,
  );
  assert.equal(saved.r.status, 200);
  for (let i = 0; i < 2; i++) {
    const b = { ...base(), phone: "0501111111", name: "عميل اختبار" };
    const r = await req("/api/orders", b);
    assert.equal(r.r.status, 201);
    for (const status of ["preparing", "ready", "completed"])
      assert.equal(
        (await req("/api/admin/order/" + r.j.id, { status }, "PATCH", true)).r
          .status,
        200,
      );
  }
  assert.equal(
    (await req("/api/admin/redeem", { phone: "0501111111" }, "POST", true)).r
      .status,
    201,
  );
  assert.equal(
    (await req("/api/admin/redeem", { phone: "0501111111" }, "POST", true)).r
      .status,
    409,
  );
  const unauth = await fetch(origin + "/api/admin/database");
  assert.equal(unauth.status, 401);
  const snapshot = await fetch(origin + "/api/admin/database", {
    headers: { Cookie: cookie },
  });
  assert.equal(snapshot.status, 200);
  const bytes = Buffer.from(await snapshot.arrayBuffer());
  assert.equal(bytes.subarray(0, 15).toString(), "SQLite format 3");
  const backupPath = path.join(dir, "verified-backup.sqlite");
  fs.writeFileSync(backupPath, bytes);
  const { DatabaseSync } = require("node:sqlite");
  const copy = new DatabaseSync(backupPath, { readOnly: true });
  assert.equal(copy.prepare("SELECT COUNT(*) n FROM orders").get().n, 3);
  copy.close();
  await new Promise((resolve) => {
    proc.once("exit", resolve);
    proc.kill();
  });
  proc = spawn(process.execPath, ["server.js"], {
    cwd: path.join(__dirname, ".."),
    env: {
      ...process.env,
      PORT: "5151",
      DATA_DIR: dir,
      ADMIN_PASSWORD: "test-password-not-production",
      NODE_ENV: "test",
    },
    stdio: "pipe",
  });
  for (let i = 0; i < 80; i++) {
    try {
      if ((await fetch(origin + "/api/menu")).ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 100));
  }
  login = await req("/api/login", { password: "test-password-not-production" });
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  st = (await req("/api/admin/state", null, null, true)).j;
  assert.equal(st.orders.length, 3);
  assert.equal(st.redemptions.length, 1);
  assert.equal(st.settings.loyalty.enabled, true);
  const bad = await fetch(origin + "/api/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "null",
  });
  assert.equal(bad.status, 400);
});

test("coupon penny allocation never makes a free line negative", () => {
  const m = structuredClone(menu);
  const rows = m.categories.flatMap((c) => c.items).slice(0, 3);
  rows[0].price = 0.01;
  rows[1].price = 0.01;
  rows[2].price = 0;
  const s = settings();
  s.coupon = {
    enabled: true,
    code: "PENNY",
    percent: 50,
    minSubtotal: 0,
    endsAt: new Date(Date.now() + 60000).toISOString(),
  };
  const q = D.quoteOrder(
    {
      ...base(),
      couponCode: "PENNY",
      lines: rows.map((i) => ({ id: i.id, quantity: 1 })),
    },
    m,
    s,
  );
  assert.equal(q.discount, 1);
  assert.equal(
    q.lines.reduce((n, l) => n + l.discount, 0),
    1,
  );
  assert(q.lines.every((l) => l.discount <= l.total && l.discount >= 0));
  assert.equal(q.lines[2].discount, 0);
});

test("invalid saved dates are rejected even when a promotion is disabled", () => {
  const s = settings();
  s.offer.startsAt = "not-a-date";
  assert.throws(() => D.validateSettings(s));
});

test("chunked Arabic JSON remains intact across UTF-8 byte boundaries", async () => {
  const http = require("node:http");
  const payload = Buffer.from(
    JSON.stringify({ ...base(), name: "عميل عربي", note: "ملاحظة بدون سكر" }),
  );
  const result = await new Promise((resolve, reject) => {
    const request = http.request(
      origin + "/api/orders",
      { method: "POST", headers: { "Content-Type": "application/json" } },
      (response) => {
        let value = "";
        response.on("data", (c) => (value += c));
        response.on("end", () =>
          resolve({ status: response.statusCode, value: JSON.parse(value) }),
        );
      },
    );
    request.on("error", reject);
    let offset = 0;
    const write = () => {
      if (offset < payload.length) {
        request.write(payload.subarray(offset, ++offset));
        setImmediate(write);
      } else request.end();
    };
    write();
  });
  assert.equal(result.status, 201);
  const login = await req("/api/login", {
    password: "test-password-not-production",
  });
  cookie = login.r.headers.get("set-cookie").split(";")[0];
  const state = (await req("/api/admin/state", null, null, true)).j;
  const order = state.orders.find((o) => o.id === result.value.id);
  assert.equal(order.name, "عميل عربي");
  assert.equal(order.note, "ملاحظة بدون سكر");
});
