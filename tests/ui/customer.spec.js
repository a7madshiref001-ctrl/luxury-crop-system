const { test, expect } = require("@playwright/test");
test("menu, bilingual search, keyboard dialog, favorites, persistence and order flow", async ({
  page,
  context,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(64);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({
    path: `docs/menu-${info.project.name}.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator("#search").fill("ماتشا");
  await expect(page.locator(".product")).toHaveCount(7);
  await page.locator("#search").fill("كولومبيا");
  await expect(page.locator(".product").first()).toBeVisible();
  await page.locator("#search").fill("nonsense-no-result");
  await expect(page.locator("[data-clear]")).toBeVisible();
  await page.locator("[data-clear]").click();
  await page.locator('[data-favorite="170283"]').click();
  await page.locator("#favFilter").click();
  await expect(page.locator(".product")).toHaveCount(1);
  await page.locator("#favFilter").click();
  await page.locator("#lang").click();
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator("#search").fill("Iced Latte");
  await expect(page.locator(".product")).toHaveCount(1);
  await page.locator("#lang").click();
  await page.locator("#search").fill("");
  await page.locator('[data-item="170300"]').first().click();
  await expect(page.locator("#dialog")).toBeVisible();
  await page.locator("#itemExtra").selectOption("vanilla");
  await page.locator("#itemMilk").selectOption("almond");
  await page.locator("#itemNote").fill("بدون سكر");
  await page.locator("#addSelected").click();
  await page.reload();
  await expect(page.locator("#cartDock")).toBeVisible();
  await page.locator("#openCart").click();
  await page.locator("[name=table]").fill("2");
  await page.locator("#checkout [type=submit]").click();
  await expect(page.locator("#refreshOrder")).toBeVisible();
  const n = await page.locator(".order-number").textContent();
  expect(n).toMatch(/#/);
  await page.keyboard.press("Escape");
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#reviewBtn").click();
  await page.locator('[data-star="1"]').click();
  await expect(page.locator('#dialog a[href*="maps"]')).toBeVisible();
  await page.keyboard.press("Escape");
  const owner = await context.newPage();
  await owner.goto("/owner.html");
  await owner.locator("#password").fill("ui-test-password-local-only");
  await owner.locator("#loginForm button").click();
  await expect(owner.locator("#dashboard")).toBeVisible();
  if (info.project.name === "mobile")
    await owner.locator("#sidebarToggle").click();
  await owner.locator("[data-page=orders]").first().click();
  await expect(owner.locator(".order-card").first()).toBeVisible();
  await owner.screenshot({
    path: `docs/orders-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("two independent browsers observe availability updates and stale cart is rejected", async ({
  browser,
  page,
}) => {
  await page.goto("/");
  await page.locator('[data-quick="170283"]').click();
  const ownerContext = await browser.newContext();
  const owner = await ownerContext.newPage();
  await owner.goto("/owner.html");
  await owner.locator("#password").fill("ui-test-password-local-only");
  await owner.locator("#loginForm button").click();
  await expect(owner.locator("#dashboard")).toBeVisible();
  const state = await owner.evaluate(async () =>
    (await fetch("/api/admin/state")).json(),
  );
  const item = state.menu.categories
    .flatMap((c) => c.items)
    .find((i) => i.id === "170283");
  item.available = false;
  await owner.evaluate(async (s) => {
    await fetch("/api/admin/menu", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ menu: s.menu, revision: s.revision }),
    });
  }, state);
  await page.locator("#openCart").click();
  await page.locator("[name=table]").fill("3");
  await page.locator("#checkout [type=submit]").click();
  await expect(page.locator("#toast")).toContainText("غير متاح");
  await expect(page.locator("#checkout [type=submit]")).toBeDisabled();
  const changed = await owner.evaluate(async () =>
    (await fetch("/api/admin/state")).json(),
  );
  changed.menu.categories
    .flatMap((c) => c.items)
    .find((i) => i.id === "170283").available = true;
  await owner.evaluate(
    async (s) =>
      fetch("/api/admin/menu", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menu: s.menu, revision: s.revision }),
      }),
    changed,
  );
  await ownerContext.close();
});

test("owner edits, coupon checkout, QR download and stored XSS stay safe", async ({
  page,
  browser,
}, info) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/owner.html");
  await page.locator("#password").fill("ui-test-password-local-only");
  await page.locator("#loginForm button").click();
  await expect(page.locator("#dashboard")).toBeVisible();
  async function go(p) {
    if (info.project.name === "mobile")
      await page.locator("#sidebarToggle").click();
    await page.locator(`#ownerNav [data-page=${p}]`).click();
  }
  await go("settings");
  await page.locator("[name=couponEnabled]").check();
  await page.locator("[name=couponCode]").fill("CROP10");
  await page.locator("[name=couponPercent]").fill("10");
  await page.locator("[name=couponMinimum]").fill("0");
  const expiry = new Date(Date.now() + 86400000);
  const local = new Date(expiry.getTime() - expiry.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  await page.locator("[name=couponEnds]").fill(local);
  await page.locator("#settingsForm [type=submit]").click();
  await expect(page.locator("#toast")).toContainText("تم حفظ");
  await page.locator("#qrTable").fill("2");
  await page.locator("#makeQr").click();
  await expect(page.locator(".qr-view img")).toBeVisible();
  await expect(page.locator("#dialog a[download]")).toBeVisible();
  await page.keyboard.press("Escape");
  const customerContext = await browser.newContext();
  const customer = await customerContext.newPage();
  await customer.goto("/");
  await customer.locator('[data-quick="170283"]').click();
  await customer.locator("#openCart").click();
  await customer.locator("[name=table]").fill("5");
  await customer.locator("[name=couponCode]").fill("CROP10");
  await customer.locator("#applyCoupon").click();
  await expect(customer.locator("#dialog")).toContainText("خصم الكوبون");
  await customer.locator("#checkout [type=submit]").click();
  await expect(customer.locator("#refreshOrder")).toBeVisible();
  await expect(customer.locator("#dialog")).toContainText("خصم الكوبون");
  await customerContext.close();
  await go("menu");
  await page.locator("#newCategory").click();
  await page
    .locator("#categoryForm [name=name_ar]")
    .fill("قسم اختبار " + info.project.name);
  await page.locator("#categoryForm [name=name_en]").fill("UI test");
  await page.locator("#categoryForm [type=submit]").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await page.locator("#newItem").click();
  await page
    .locator("#itemForm [name=name_ar]")
    .fill("<img src=x onerror=alert(1)>");
  await page.locator("#itemForm [name=price]").fill("5.50");
  await page.locator("#itemForm [type=submit]").click();
  await expect(page.locator(".manage-row h3")).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(page.locator(".manage-row h3 img")).toHaveCount(0);
  await page.locator("[data-edit]").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("#deleteItem").click();
  await expect(page.locator(".manage-row")).toHaveCount(0);
  await page.locator("#editCategory").click();
  page.once("dialog", (d) => d.accept());
  await page.locator("#deleteCategory").click();
  await expect(page.locator("#dialog")).not.toBeVisible();
  await go("settings");
  await page.locator("[name=couponEnabled]").uncheck();
  await page.locator("#settingsForm [type=submit]").click();
  await expect(page.locator("#toast")).toContainText("تم حفظ");
  expect(errors).toEqual([]);
});

test("a new table QR overrides the previous saved table", async ({ page }) => {
  await page.goto("/?table=2");
  await page.locator('[data-quick="170283"]').click();
  await page.locator("#openCart").click();
  await expect(page.locator("[name=table]")).toHaveValue("2");
  await page.keyboard.press("Escape");
  await page.goto("/?table=7");
  await page.locator("#openCart").click();
  await expect(page.locator("[name=table]")).toHaveValue("7");
});

test("static hosting falls back to browsing without pretending to accept orders", async ({
  page,
}) => {
  await page.route("**/api/menu", (r) =>
    r.fulfill({ status: 404, contentType: "application/json", body: "{}" }),
  );
  await page.goto("/");
  await expect(page.locator(".product")).toHaveCount(64);
  await expect(page.locator("#serviceNotice")).toContainText("غير متصل");
  await expect(page.locator('[data-quick="170283"]')).toBeDisabled();
});
