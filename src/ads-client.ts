import { initAdsTracking, submitLead, trackAdsEvent } from "./ads-service";
import "./ads-reset.css";
import "./pages/AdsPage.css";

initAdsTracking();

document.addEventListener("click", (event) => {
  const anchor = (event.target as HTMLElement).closest("a");
  if (!anchor) return;
  const href = anchor.getAttribute("href") || "";
  if (href.includes("line.me")) trackAdsEvent("line_click");
  else if (href.startsWith("tel:")) trackAdsEvent("phone_click");
  else if (href === "#pricing" || anchor.closest("#pricing")) trackAdsEvent("pricing_click");
  else if (href === "#consult" && (anchor.closest(".ads-hero") || anchor.closest(".ads-mobile-actions"))) trackAdsEvent("hero_cta_click");
  else if (href === "#consult" || href === "/contact") trackAdsEvent("contact_click");
});

for (const form of document.querySelectorAll<HTMLFormElement>(".ads-form")) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (button) { button.disabled = true; button.textContent = "傳送中…"; }
    form.querySelector(".ads-error")?.remove();
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      if (values.website === "") delete values.website;
      await submitLead(values);
      trackAdsEvent("lead_form_submit");
      const success = document.createElement("div");
      success.className = "ads-form-success";
      success.setAttribute("role", "status");
      const heading = document.createElement("h3");
      heading.textContent = "資料已收到，我們將與您聯絡。";
      const note = document.createElement("p");
      note.textContent = "若需要立即討論，也可以使用 LINE 諮詢。";
      success.append(heading, note);
      form.replaceWith(success);
    } catch (error) {
      const alert = document.createElement("p");
      alert.className = "ads-error";
      alert.setAttribute("role", "alert");
      alert.textContent = error instanceof Error ? error.message : "資料暫時無法送出，請稍後再試。";
      form.append(alert);
      if (button) { button.disabled = false; button.textContent = "送出諮詢"; }
    }
  });
}

const money = (minor: number) => `NT$${(minor / 100).toLocaleString("zh-TW")}`;
type Plan = { plan_id: string; price_minor: number; term_months: number; trial_months: number; activation_fee_minor: number; deposit_minor: number; first_cycle_balance_minor: number };
fetch("https://chuang-baiye-ai.baiye-platform.workers.dev/api/public/commercial-catalog")
  .then((response) => response.ok ? response.json() : Promise.reject())
  .then((catalog: { plans: Plan[] }) => {
    if (!Array.isArray(catalog.plans)) return;
    const byId = (id: string) => catalog.plans.find((plan) => plan.plan_id === id);
    const standard = byId("baiye_standard_18000_addons");
    const commerce = byId("baiye_commerce_ai_45000");
    const ordering = byId("baiye_softpos_24000");
    if (!standard || !commerce || !ordering) return;
    const intro = document.querySelector("#pricing .ads-pricing-grid > div:first-child > p");
    if (intro) intro.textContent = `依正式方案目錄：百工標準方案 ${money(standard.price_minor)}／${standard.term_months} 個月；AI 智慧商城完整版 ${money(commerce.price_minor)}／${commerce.term_months} 個月。額外設備、第三方服務與客製項目依正式報價確認。`;
    const price = document.querySelector("#pricing .ads-price");
    if (price) price.textContent = money(ordering.price_minor);
    const period = document.querySelector("#pricing .ads-price-card > strong");
    if (period) period.textContent = `每 ${ordering.term_months} 個月`;
    const detail = document.querySelector("#pricing .ads-price-card > p");
    if (detail) detail.textContent = `前 ${ordering.trial_months} 個月系統服務費 NT$0。首次開通費 ${money(ordering.activation_fee_minor)}、保證金 ${money(ordering.deposit_minor)}；保證金可抵首個 ${ordering.term_months} 個月週期費用，該週期尚需 ${money(ordering.first_cycle_balance_minor)}。活動起算與適用條件以正式契約為準。`;
    if (location.pathname.startsWith("/pricing")) {
      document.querySelectorAll(".ads-info-points > div").forEach((node, index) => {
        const plan = [standard, commerce, ordering][index];
        if (!plan) return;
        const label = ["百工標準方案", "AI 智慧商城完整版", "免 POS 機智慧點餐"][index];
        node.textContent = `${label}：${money(plan.price_minor)}／${plan.term_months} 個月${plan.trial_months ? `；前 ${plan.trial_months} 個月系統服務費 NT$0，另有開通費與保證金` : ""}`;
      });
    }
  })
  .catch(() => {});
