import { expect, test } from "@playwright/test";

const requiredPlans = [
  { id: "baiye_standard_18000_addons", name: "百工標準方案", price: "NT$18,000" },
  { id: "baiye_commerce_ai_45000", name: "AI 智慧商城完整版", price: "NT$45,000" },
  { id: "baiye_softpos_24000", name: "免 POS 機智慧點餐", price: "NT$24,000" },
] as const;

function catalogPlans() {
  return requiredPlans.map((plan, index) => ({
    plan_id: plan.id,
    name: plan.name,
    tagline: plan.name,
    price_minor: [1800000, 4500000, 2400000][index],
    currency: "TWD",
    term_months: 24,
    trial_months: plan.id === "baiye_softpos_24000" ? 3 : 0,
    activation_fee_minor: plan.id === "baiye_softpos_24000" ? 300000 : 0,
    deposit_minor: plan.id === "baiye_softpos_24000" ? 600000 : 0,
    cycle_fee_minor: [1800000, 4500000, 2400000][index],
    first_cycle_credit_minor: plan.id === "baiye_softpos_24000" ? 600000 : 0,
    first_cycle_balance_minor: plan.id === "baiye_softpos_24000" ? 1800000 : [1800000, 4500000][index],
    renewal_fee_minor: [1800000, 4500000, 2400000][index],
    installment_plan_requested: 24,
    payment_provider_ready: false,
  }));
}

test("Production 未登入訪客取得真實三方案並保留各自登入導向", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  const responsePromise = page.waitForResponse((response) => response.url().endsWith("/api/public/merchant-plans"));
  await page.goto("https://baiyeconnect.com/#/join", { waitUntil: "domcontentloaded" });
  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("application/json");
  const payload = await response.json();
  expect(payload.plans.map((plan: { plan_id: string }) => plan.plan_id)).toEqual(requiredPlans.map((plan) => plan.id));

  for (const plan of requiredPlans) {
    const card = page.locator(".join-plan-card").filter({ has: page.getByRole("heading", { name: plan.name }) });
    await expect(card).toBeVisible();
    await expect(card.locator(".join-plan-price")).toContainText(plan.price);
  }
  await expect(page.getByRole("button", { name: /方案簽署合約/ })).toHaveCount(3);

  for (const plan of requiredPlans) {
    await page.getByRole("button", { name: `${plan.name}：方案簽署合約` }).click();
    await expect(page).toHaveURL(new RegExp(`/merchant/login\\?plan=${plan.id}$`));
    await expect(page.getByText("登入後會返回您原本選擇的方案確認頁。", { exact: true })).toBeVisible();
    await page.goto("https://baiyeconnect.com/#/join", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: plan.name })).toBeVisible();
  }
  await page.screenshot({ path: "production-evidence/merchant-plans-mobile.png", fullPage: true });
  await context.close();
});

test("Production 過期商家 Cookie 不影響公開方案展示", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await context.addCookies([{
    name: "baiye_merchant_session",
    value: "expired-production-e2e-cookie",
    domain: "chuang-baiye-ai.baiye-platform.workers.dev",
    path: "/",
    httpOnly: true,
    secure: true,
    sameSite: "None",
  }]);
  const page = await context.newPage();
  await page.goto("https://baiyeconnect.com/#/join", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: /方案簽署合約/ })).toHaveCount(3);
  await context.close();
});

test("初次請求失敗後按重新載入可恢復三張方案卡", async ({ page }) => {
  let requests = 0;
  await page.route("**/api/public/merchant-plans", async (route) => {
    requests += 1;
    if (requests === 1) return route.fulfill({ status: 404, contentType: "application/json", body: JSON.stringify({ error: "Not found" }) });
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ plans: catalogPlans() }) });
  });
  await page.goto("http://127.0.0.1:4173/#/join");
  await expect(page.getByRole("button", { name: "重新載入" })).toBeVisible();
  await page.getByRole("button", { name: "重新載入" }).click();
  await expect(page.getByRole("button", { name: /方案簽署合約/ })).toHaveCount(3);
  expect(requests).toBe(2);
});

for (const scenario of [
  { name: "HTML", contentType: "text/html", body: "<!doctype html><title>fallback</title>" },
  { name: "缺少 plans", contentType: "application/json", body: JSON.stringify({ ok: true }) },
  { name: "空陣列", contentType: "application/json", body: JSON.stringify({ plans: [] }) },
  { name: "錯誤方案", contentType: "application/json", body: JSON.stringify({ plans: catalogPlans().slice(0, 2) }) },
]) {
  test(`不會把 ${scenario.name} 回應誤判為三方案恢復`, async ({ page }) => {
    await page.route("**/api/public/merchant-plans", (route) => route.fulfill({ status: 200, contentType: scenario.contentType, body: scenario.body }));
    await page.goto("http://127.0.0.1:4173/#/join");
    await expect(page.getByRole("button", { name: /方案簽署合約/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "重新載入" })).toBeVisible();
  });
}
