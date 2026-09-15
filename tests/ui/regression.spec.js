const { test, expect } = require("@playwright/test");
let ownerCookies;
async function owner(page) {
  if (!ownerCookies) {
    const r = await page.request.post("/api/login", {
      data: { password: "ui-test-password-local-only" },
    });
    expect(r.ok()).toBeTruthy();
    ownerCookies = (await page.request.storageState()).cookies;
  }
  await page.context().addCookies(ownerCookies);
  await page.goto("/owner.html");
  await expect(page.locator("#dashboard")).toBeVisible();
}
async function state(page) {
  return (await page.request.get("/api/admin/state")).json();
}
async function settings(page, transform) {
  const s = await state(page);
  transform(s.settings);
  const r = await page.request.put("/api/admin/settings", {
    data: { settings: s.settings, revision: s.revision },
  });
  expect(r.ok()).toBeTruthy();
  return s;
}
async function go(page, name, info) {
  if (info.project.name === "mobile")
    await page.locator("#sidebarToggle").click();
  await page.locator(`#ownerNav [data-page=${name}]`).click();
}

test("every product image and detail opens without errors, mobile overflow or broken controls", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(64);
  const ids = await page
    .locator(".product-photo [data-item]")
    .evaluateAll((es) => es.map((e) => e.dataset.item));
  for (const id of ids) {
    await page.locator(`.product-photo [data-item="${id}"]`).click();
    await expect(page.locator("#dialog h2")).not.toBeEmpty();
    await expect
      .poll(() =>
        page
          .locator("#dialog img")
          .first()
          .evaluate((e) => e.complete && e.naturalWidth > 0),
      )
      .toBeTruthy();
    expect(
      await page
        .locator("#dialog")
        .evaluate((e) => e.scrollWidth <= e.clientWidth + 1),
    ).toBeTruthy();
    await page.keyboard.press("Escape");
  }
  expect(errors).toEqual([]);
});

test("language keeps sorting and dark mode persists; corrupt saved data does not crash", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem("lc.v2.lastOrder", "{}");
    localStorage.setItem(
      "lc.v2.checkout",
      JSON.stringify({ couponCode: 123, mode: "wrong" }),
    );
    localStorage.setItem(
      "lc.v2.cart",
      JSON.stringify([null, { id: "gone", quantity: 1 }]),
    );
  });
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(64);
  await page.locator("#sort").selectOption("high");
  await page.locator("#lang").click();
  await expect(page.locator("#sort")).toHaveValue("high");
  await page.locator("#theme").click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("#track")).toBeHidden();
  expect(errors).toEqual([]);
});

test("cart quantity limit counts all variants together", async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "lc.v2.cart",
      JSON.stringify([
        { id: "170283", quantity: 10, note: "A", extra: "", milk: "" },
        { id: "170283", quantity: 10, note: "B", extra: "", milk: "" },
      ]),
    ),
  );
  await page.goto("/");
  await page.locator("#openCart").click();
  await page.locator('[data-line="0"][data-delta="1"]').click();
  await expect(page.locator("#toast")).toContainText("٢٠");
  expect(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("lc.v2.cart")).reduce(
        (n, l) => n + l.quantity,
        0,
      ),
    ),
  ).toBe(20);
});

test("menu recovers when the backend returns without a page reload", async ({
  page,
}) => {
  let offline = true;
  await page.route("**/api/menu", (r) =>
    offline ? r.fulfill({ status: 404, body: "{}" }) : r.continue(),
  );
  await page.goto("/");
  await expect(page.locator('[data-quick="170283"]')).toBeDisabled();
  offline = false;
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect(page.locator('[data-quick="170283"]')).toBeEnabled();
  await expect(page.locator("#serviceNotice")).toBeHidden();
});

test("an accepted order with lost response retries without duplicate and locks uncertain edits", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await owner(admin);
  const before = (await state(admin)).orders.length;
  let first = true;
  await page.route("**/api/orders", async (r) => {
    if (first) {
      first = false;
      await r.fetch();
      await r.abort("failed");
    } else await r.continue();
  });
  await page.goto("/?table=4");
  await page.locator('[data-quick="170283"]').click();
  await page.locator("#openCart").click();
  await page.locator("#checkout [type=submit]").click();
  await expect(page.locator("#checkout [type=submit]")).toHaveText(
    "إعادة التحقق من الطلب",
  );
  await expect(page.locator("[name=table]")).toBeDisabled();
  await expect(page.locator("[data-remove]")).toBeDisabled();
  await page.locator("#checkout [type=submit]").click();
  await expect(page.locator("#refreshOrder")).toBeVisible();
  expect((await state(admin)).orders.length).toBe(before + 1);
  await admin.close();
});

test("removing an open product on another device closes stale details safely", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await owner(admin);
  const original = (await state(admin)).menu;
  await page.goto("/");
  await page.locator('.product-photo [data-item="170283"]').click();
  try {
    const s = await state(admin);
    s.menu.categories.forEach(
      (c) => (c.items = c.items.filter((i) => i.id !== "170283")),
    );
    expect(
      (
        await admin.request.put("/api/admin/menu", {
          data: { menu: s.menu, revision: s.revision },
        })
      ).ok(),
    ).toBeTruthy();
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
    await expect(page.locator("#dialog")).not.toBeVisible();
    await expect(page.locator('[data-quick="170283"]')).toHaveCount(0);
  } finally {
    const s = await state(admin);
    await admin.request.put("/api/admin/menu", {
      data: { menu: original, revision: s.revision },
    });
    await admin.close();
  }
});

test("late tracking response cannot reopen a dismissed dialog over feedback", async ({
  page,
}) => {
  await page.goto("/?table=4");
  await page.locator('[data-quick="170283"]').click();
  await page.locator("#openCart").click();
  await page.locator("#checkout [type=submit]").click();
  await expect(page.locator("#refreshOrder")).toBeVisible();
  await page.keyboard.press("Escape");
  let release;
  const gate = new Promise((r) => (release = r));
  let seen;
  const intercepted = new Promise((r) => (seen = r));
  await page.route("**/api/order/**", async (r) => {
    seen();
    await gate;
    await r.continue();
  });
  await page.locator("#track").click();
  await intercepted;
  await page.keyboard.press("Escape");
  await page.locator("#reviewBtn").click();
  release();
  await page.waitForResponse((r) => r.url().includes("/api/order/"));
  await expect(page.locator("#sendReview")).toBeVisible();
  await expect(page.locator("#refreshOrder")).toHaveCount(0);
});

test("pickup ignores hidden stale table validation and delivery includes its fee", async ({
  page,
  browser,
}) => {
  const admin = await browser.newPage();
  await owner(admin);
  const original = (await state(admin)).settings;
  await settings(admin, (s) => {
    s.modes = ["table", "takeaway", "delivery"];
    s.deliveryFee = 8;
  });
  try {
    await page.goto("/");
    await page.locator('[data-quick="170283"]').click();
    await page.locator("#openCart").click();
    await page.locator("[name=table]").fill("999");
    await page.locator("#orderMode").selectOption("takeaway");
    await expect(page.locator("[name=table]")).toBeDisabled();
    await page.locator("[name=name]").fill("عميل اختبار");
    await page.locator("[name=phone]").fill("٠٥٠١٢٣٤٥٦٧");
    await page.locator("#checkout [type=submit]").click();
    await expect(page.locator("#refreshOrder")).toBeVisible();
    await page.keyboard.press("Escape");
    await page.locator('[data-quick="170283"]').click();
    await page.locator("#openCart").click();
    await page.locator("#orderMode").selectOption("delivery");
    await page.locator("[name=address]").fill("الطائف شارع اختبار مبنى 10");
    await page.locator("#checkout [type=submit]").click();
    await expect(page.locator("#refreshOrder")).toBeVisible();
    const order = (await state(admin)).orders[0];
    expect(order.total).toBe(2500);
    expect(order.fee).toBe(800);
    expect(order.phone).toBe("0501234567");
  } finally {
    await settings(admin, (s) => Object.assign(s, original));
    await admin.close();
  }
});

test("admin preserves unsaved settings, explains revision conflicts, validates QR and exports backup", async ({
  page,
}, info) => {
  await owner(page);
  await go(page, "settings", info);
  await page.locator("[name=whatsapp]").fill("966501234567");
  page.once("dialog", (d) => d.dismiss());
  await go(page, "menu", info);
  await expect(page.locator("[name=whatsapp]")).toHaveValue("966501234567");
  await settings(page, (s) => (s.tables = s.tables));
  await page.locator("#settingsForm [type=submit]").click();
  await expect(page.locator("#toast")).toContainText("جهاز آخر");
  page.once("dialog", (d) => d.accept());
  await page.locator("#refresh").click();
  await expect(page.locator("[name=whatsapp]")).toHaveValue("");
  await page.locator("#qrTable").fill("0");
  await page.locator("#makeQr").click();
  await expect(page.locator("#toast")).toContainText("رقم الطاولة غير صحيح");
  await page.locator("#qrUrl").fill("https://example.com/menu/?table=7");
  await page.locator("#qrTable").fill("");
  await page.locator("#makeQr").click();
  await expect(page.locator("#dialog .muted")).toHaveText(
    "https://example.com/menu/",
  );
  await page.keyboard.press("Escape");
  const download = page.waitForEvent("download");
  await page.locator("#backup").click();
  const file = await download;
  expect(file.suggestedFilename()).toContain("backup");
});

test("all order stages, receipt, customer ledger, reviews and logout work", async ({
  page,
  browser,
}, info) => {
  await owner(page);
  const created = await page.request.post("/api/orders", {
    data: {
      mode: "takeaway",
      name: "عميل مراحل",
      phone: "0502222222",
      marketingConsent: true,
      lines: [{ id: "170283", quantity: 1 }],
      expectedTotal: 1700,
      idempotencyKey: crypto.randomUUID(),
    },
  });
  expect(created.ok()).toBeTruthy();
  const order = await created.json();
  await page.locator("#refresh").click();
  await go(page, "orders", info);
  for (const status of ["preparing", "ready", "completed"])
    await page
      .locator(`[data-order="${order.id}"][data-status="${status}"]`)
      .click();
  await page.locator(`[data-receipt="${order.id}"]`).click();
  await expect(page.locator("#receipt")).toContainText("مكتمل");
  await expect(page.locator("#receipt")).toContainText("0502222222");
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#receipt")).toBeVisible();
  await page.emulateMedia({ media: "screen" });
  await page.keyboard.press("Escape");
  await go(page, "customers", info);
  await expect(page.locator("#ownerContent")).toContainText("0502222222");
  const dl = page.waitForEvent("download");
  await page.locator("#exportCustomers").click();
  expect((await dl).suggestedFilename()).toContain("customers");
  await go(page, "reviews", info);
  await expect(page.locator("#ownerContent")).toContainText("نسمعك");
});

test("static admin explains the hosting limitation instead of a broken login", async ({
  page,
}) => {
  await page.route("**/api/admin/state*", (r) =>
    r.fulfill({
      status: 404,
      contentType: "text/html",
      body: "<h1>Not found</h1>",
    }),
  );
  await page.goto("/owner.html");
  await expect(page.locator("#loginUnavailable")).toContainText("GitHub Pages");
  await expect(page.locator("#password")).toBeHidden();
});

test("slow initial loading accepts language and search without JavaScript errors", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route("**/api/menu", async (r) => {
    await gate;
    await r.continue();
  });
  await page.goto("/");
  await page.locator("#lang").click();
  await page.locator("#search").fill("latte");
  await page.locator("#reviewBtn").click();
  release();
  await expect(page.locator(".product").first()).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  expect(errors).toEqual([]);
});

test("feedback reaches the owner and failed logout remains retryable", async ({
  page,
  browser,
}, info) => {
  await owner(page);
  const customer = await browser.newPage();
  await customer.goto("/");
  await customer.locator("#reviewBtn").click();
  await customer.locator('[data-star="2"]').click();
  await customer
    .locator("#reviewNote")
    .fill("اختبار وصول الملاحظات " + info.project.name);
  await customer.locator("#sendReview").click();
  await expect(customer.locator("#toast")).toContainText("وصل");
  await page.locator("#refresh").click();
  await go(page, "reviews", info);
  await expect(page.locator("#ownerContent")).toContainText(
    "اختبار وصول الملاحظات " + info.project.name,
  );
  let fail = true;
  await page.route("**/api/logout", (r) =>
    fail ? r.abort("failed") : r.continue(),
  );
  if (info.project.name === "mobile")
    await page.locator("#sidebarToggle").click();
  await page.locator("#logout").click();
  await expect(page.locator("#toast")).toContainText("تعذر تسجيل الخروج");
  await expect(page.locator("#dashboard")).toBeVisible();
  fail = false;
  await page.locator("#logout").click();
  await expect(page.locator("#loginScreen")).toBeVisible();
  expect((await page.request.get("/api/admin/state")).status()).toBe(401);
  await customer.close();
});
