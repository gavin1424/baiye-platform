import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, ArrowUpRight, ChartBar, Check, ClipboardText, DeviceMobile, ForkKnife, Globe, ListChecks, MagicWand, QrCode, Storefront } from "@phosphor-icons/react";
import { initAdsTracking, submitLead, trackAdsEvent } from "../ads-service";
import "./AdsPage.css";

const base = import.meta.env.BASE_URL;
const lineUrl = "https://line.me/ti/p/~mii460627";
const phone = "tel:+886987353751";
type CatalogPlan = { plan_id: string; price_minor: number; term_months: number; trial_months: number; activation_fee_minor: number; deposit_minor: number; first_cycle_balance_minor: number };
const fallbackPlans: CatalogPlan[] = [
  { plan_id: "baiye_standard_18000_addons", price_minor: 1800000, term_months: 24, trial_months: 0, activation_fee_minor: 0, deposit_minor: 0, first_cycle_balance_minor: 1800000 },
  { plan_id: "baiye_commerce_ai_45000", price_minor: 5000000, term_months: 24, trial_months: 0, activation_fee_minor: 0, deposit_minor: 0, first_cycle_balance_minor: 5000000 },
  { plan_id: "baiye_softpos_24000", price_minor: 2400000, term_months: 24, trial_months: 3, activation_fee_minor: 300000, deposit_minor: 600000, first_cycle_balance_minor: 1800000 },
];
const money = (minor: number) => `NT$${(minor / 100).toLocaleString("zh-TW")}`;
function useCatalog() {
  const [plans, setPlans] = useState(fallbackPlans);
  useEffect(() => {
    const controller = new AbortController();
    fetch("https://chuang-baiye-ai.baiye-platform.workers.dev/api/public/commercial-catalog", { signal: controller.signal })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { if (Array.isArray(data.plans) && data.plans.length >= 3) setPlans(data.plans); })
      .catch(() => {});
    return () => controller.abort();
  }, []);
  return plans;
}
const features = [
  [DeviceMobile, "LINE 線上點餐", "顧客由店家提供的連結進入，不需額外下載 App。"],
  [QrCode, "QR Code 點餐", "掃描店內 QR Code，直接瀏覽店家頁面。"],
  [ListChecks, "訂單管理", "集中查看訂單與處理狀態，減少訊息散落。"],
  [ClipboardText, "商品／菜單管理", "自行更新餐點、服務內容與售價。"],
  [ChartBar, "營運分析", "查看訂單紀錄與基本營運數據。"],
  [MagicWand, "AI 數位工具", "協助整理內容、行銷素材與日常營運想法。"],
] as const;
const steps = [
  ["01", "掃碼", "顧客掃描店家 QR Code 或開啟專屬連結。"],
  ["02", "選擇商品／餐點", "在手機上查看菜單與品項。"],
  ["03", "送出訂單", "依店家設定選擇取餐、外送或預約時間。"],
  ["04", "店家收到通知", "店家從管理介面查看訂單；通知方式依實際啟用功能確認。"],
] as const;
const industries = [
  ["餐飲", "cafe"], ["咖啡店", "cafe"], ["飲料店", "cafe"], ["早餐店", "cafe"],
  ["零售", "retail"], ["美業", "beauty"], ["個人工作室", "workspace"],
  ["在地服務", "team"], ["電商", "retail"], ["接案工作者", "workspace"],
] as const;

function ActionLink({ href, children, event, light = false }: { href: string; children: React.ReactNode; event: "line_click" | "phone_click" | "pricing_click" | "contact_click" | "hero_cta_click"; light?: boolean }) {
  return <a className={`ads-button ${light ? "ads-button-light" : ""}`} href={href} onClick={() => trackAdsEvent(event)}>{children}<ArrowUpRight size={19} /></a>;
}

export function LeadForm() {
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    if (values.website === "") delete values.website;
    setState("loading");
    try {
      await submitLead(values);
      trackAdsEvent("lead_form_submit");
      setState("success");
      form.reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "資料暫時無法送出，請稍後再試。");
      setState("error");
    }
  }
  return <form className="ads-form" onSubmit={onSubmit}>
    {state === "success" ? <div className="ads-form-success" role="status"><Check size={36} /><h3>資料已收到，我們將與您聯絡。</h3><p>若需要立即討論，也可以使用 LINE 諮詢。</p></div> : <>
      <div className="ads-form-grid">
        <label>姓名 *<input name="name" required maxLength={80} autoComplete="name" /></label>
        <label>店家名稱<input name="shopName" maxLength={100} /></label>
        <label>手機 *<input name="phone" type="tel" required inputMode="tel" maxLength={20} autoComplete="tel" /></label>
        <label>LINE ID<input name="lineId" maxLength={80} /></label>
        <label>Email<input name="email" type="email" autoComplete="email" /></label>
        <label>產業 *<select name="industry" required defaultValue=""><option value="" disabled>請選擇</option>{industries.map(([name]) => <option key={name}>{name}</option>)}</select></label>
        <label>是否已有網站<select name="hasWebsite" defaultValue=""><option value="">請選擇</option><option>有</option><option>沒有</option></select></label>
        <label>是否已有點餐系統<select name="hasOrdering" defaultValue=""><option value="">請選擇</option><option>有</option><option>沒有</option></select></label>
      </div>
      <label>想了解的功能<textarea name="interests" rows={3} maxLength={1500} placeholder="例如：線上點餐、預約、網站或 AI 工具" /></label>
      <label className="ads-honeypot" aria-hidden="true">網站<input name="website" tabIndex={-1} autoComplete="off" /></label>
      <label className="ads-consent"><input type="checkbox" name="consent" value="yes" required /> 我同意依<a href="/privacy" target="_blank">隱私權政策</a>蒐集聯絡資料，僅供方案諮詢使用。</label>
      {state === "error" && <p className="ads-error" role="alert">{error}</p>}
      <button className="ads-button" type="submit" disabled={state === "loading"}>{state === "loading" ? "傳送中…" : "送出諮詢"}<ArrowRight size={19} /></button>
    </>}
  </form>;
}

export function AdsPage() {
  useEffect(() => { initAdsTracking(); }, []);
  const plans = useCatalog();
  const standard = plans.find((plan) => plan.plan_id === "baiye_standard_18000_addons") || fallbackPlans[0];
  const commerce = plans.find((plan) => plan.plan_id === "baiye_commerce_ai_45000") || fallbackPlans[1];
  const ordering = plans.find((plan) => plan.plan_id === "baiye_softpos_24000") || fallbackPlans[2];
  return <div className="ads-page">
    <header className="ads-header"><div className="ads-shell ads-nav"><a href="/" className="ads-brand"><img src={`${base}brand/chuang-baiye-smart-chain-logo.png`} alt="創百業智慧鏈標誌" /><span><strong>創百業智慧鏈</strong><small>CHUANG BAIYE SMART CHAIN</small></span></a><nav aria-label="主要導覽"><a href="#features">服務功能</a><a href="#how">使用流程</a><a href="#pricing" onClick={() => trackAdsEvent("pricing_click")}>方案價格</a><a href="#faq">常見問題</a></nav><a className="ads-nav-cta" href="#consult" onClick={() => trackAdsEvent("contact_click")}>免費了解方案 <ArrowUpRight /></a></div></header>
    <main>
      <section className="ads-hero"><div className="ads-shell ads-hero-grid"><div className="ads-hero-content"><div className="ads-kicker"><span /> 百工百業大平台 · 專業 × 資源 × 機會</div><h1>讓店家更簡單<br /><em>開始數位經營</em></h1><p>網站、LINE 線上點餐、訂單管理與 AI 數位工具，一站整合。</p><div className="ads-actions"><ActionLink href="#consult" event="hero_cta_click">免費了解方案</ActionLink><ActionLink href={lineUrl} event="line_click" light>LINE 諮詢</ActionLink></div><div className="ads-hero-note"><Check size={17} /> 免另外購買傳統大型 POS 硬體 <span>·</span> 手機、平板、電腦皆可使用</div></div><div className="ads-hero-photo"><picture><source media="(max-width: 700px)" srcSet={`${base}assets/ads/cafe-small.webp`} /><img src={`${base}assets/ads/cafe.webp`} width="900" height="600" alt="店家經營現場" fetchPriority="high" /></picture><div className="ads-photo-card"><span className="ads-photo-icon"><Storefront size={22} /></span><div><strong>從日常營運開始</strong><small>把接單、管理與顧客聯繫整理得更清楚</small></div></div></div></div></section>
      <section className="ads-section ads-problems"><div className="ads-shell"><div className="ads-section-intro"><span className="ads-overline">THE CHALLENGE</span><h2>店家忙的，不該是切換一堆工具</h2><p>電話、訊息、紙本和不同後台同時進來，容易讓接單與管理變得零碎。</p></div><div className="ads-problem-grid"><article><span>01</span><h3>訊息分散</h3><p>顧客從不同管道詢問，整理訂單耗費時間。</p></article><article><span>02</span><h3>菜單更新麻煩</h3><p>價格與品項一變，處處都需要重新修改。</p></article><article><span>03</span><h3>數位門檻高</h3><p>想開始線上經營，卻不知網站、點餐和管理工具如何搭配。</p></article></div></div></section>
      <section id="features" className="ads-section"><div className="ads-shell"><div className="ads-section-intro"><span className="ads-overline">WHAT WE OFFER</span><h2>依你的營運需求，整理合適的工具</h2><p>從顧客下單到店家管理，先釐清流程，再選擇需要的功能。</p></div><div className="ads-features">{features.map(([Icon, title, detail]) => <article key={title}><div className="ads-feature-icon"><Icon size={28} weight="duotone" /></div><h3>{title}</h3><p>{detail}</p></article>)}</div></div></section>
      <section className="ads-section ads-detail"><div className="ads-shell ads-split"><div><span className="ads-overline">ORDERING, MADE CLEAR</span><h2>顧客好點，<br />店家好管理</h2><p>以店家專屬頁面展示商品或餐點，搭配掃碼入口。取餐、外送與預約時間可依實際營運流程規劃，訂單集中查看。</p><ul><li><Check /> 商品與菜單更新</li><li><Check /> 訂單狀態整理</li><li><Check /> 取餐、外送與預約設定</li><li><Check /> 基本營運數據查看</li></ul></div><div className="ads-mockup" aria-label="點餐流程示意"><div className="ads-mockup-top">店家菜單 <span>● ● ●</span></div><div className="ads-mockup-card"><img src={`${base}assets/ads/cafe.webp`} loading="lazy" alt="餐飲店商品展示示意" /><div><strong>今日精選</strong><small>手機瀏覽・選擇品項・送出需求</small></div></div><div className="ads-mockup-row"><span>選擇取餐方式</span><strong>到店取餐 ▾</strong></div><div className="ads-mockup-row"><span>預約時間</span><strong>由店家設定 ▾</strong></div><div className="ads-mockup-btn">查看訂單</div><small>畫面為流程示意，實際功能以啟用方案為準。</small></div></div></section>
      <section id="how" className="ads-section"><div className="ads-shell"><div className="ads-section-intro"><span className="ads-overline">FOUR SIMPLE STEPS</span><h2>從掃碼到接單，四步完成</h2></div><div className="ads-steps">{steps.map(([number, title, detail]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{detail}</p></article>)}</div></div></section>
      <section className="ads-section ads-ecosystem"><div className="ads-shell ads-split"><div className="ads-ecosystem-image"><img src={`${base}assets/ads/team.webp`} loading="lazy" width="900" height="600" alt="團隊討論店家數位營運" /></div><div><span className="ads-overline">BEYOND ORDERING</span><h2>不只點餐，也照顧長期經營</h2><p>網站與商城幫助展示品牌與商品；顧客資料管理與 AI 工具可依實際需求規劃。各功能與串接範圍，會在諮詢時清楚說明。</p><div className="ads-tags"><span>品牌網站</span><span>線上商城</span><span>顧客資料管理</span><span>AI 內容輔助</span></div><a href="#consult" className="ads-text-link" onClick={() => trackAdsEvent("contact_click")}>討論你的需求 <ArrowRight /></a></div></div></section>
      <section className="ads-section"><div className="ads-shell"><div className="ads-section-intro"><span className="ads-overline">WHO IT'S FOR</span><h2>從街角店家到專業工作室</h2><p>服務可依不同產業流程討論，以下是常見的使用情境。</p></div><div className="ads-industries">{industries.map(([name, image]) => <div key={name}><img src={`${base}assets/ads/${image}-small.webp`} loading="lazy" width="400" height="267" alt={`${name}店家工作情境`} /><strong>{name}</strong></div>)}</div></div></section>
      <section id="pricing" className="ads-section ads-pricing"><div className="ads-shell ads-pricing-grid"><div><span className="ads-overline">CLEAR PRICING</span><h2>價格與服務範圍，<br />先講清楚</h2><p>依正式方案目錄：百工標準方案 {money(standard.price_minor)}／{standard.term_months} 個月；AI 智慧商城完整版 {money(commerce.price_minor)}／{commerce.term_months} 個月。額外設備、第三方服務與客製項目依正式報價確認。</p><a className="ads-text-link" href="#consult" onClick={() => trackAdsEvent("pricing_click")}>索取完整方案說明 <ArrowRight /></a></div><div className="ads-price-card"><span>線上點餐方案</span><h3>免購置傳統大型 POS 硬體</h3><div className="ads-price">{money(ordering.price_minor)}</div><strong>每 {ordering.term_months} 個月</strong><p>前 {ordering.trial_months} 個月系統服務費 NT$0。首次開通費 {money(ordering.activation_fee_minor)}、保證金 {money(ordering.deposit_minor)}；保證金可抵首個 {ordering.term_months} 個月週期費用，該週期尚需 {money(ordering.first_cycle_balance_minor)}。活動起算與適用條件以正式契約為準。</p><a href="#consult" className="ads-button" onClick={() => trackAdsEvent("pricing_click")}>了解適用方案 <ArrowRight /></a></div></div></section>
      <section id="faq" className="ads-section"><div className="ads-shell"><div className="ads-section-intro"><span className="ads-overline">FAQ</span><h2>常見問題</h2></div><div className="ads-faq">{[
        ["需要購買 POS 機嗎？", "本頁所說的免購置，是指可先討論不另外購買傳統大型 POS 硬體的使用方式。店家仍需要可用的手機、平板或電腦及管理系統。"],
        ["LINE 線上點餐需要下載 App 嗎？", "顧客可透過店家提供的連結或 QR Code 開啟頁面。實際 LINE 功能與通知方式，依正式啟用項目確認。"],
        ["能設定取餐、外送和預約時間嗎？", "可依店家流程討論這些設定；確切可用功能會在方案說明中逐項列明。"],
        ["三個月免費體驗如何計算？", "點餐方案在體驗期間的系統服務費為 NT$0；開通費、保證金及首個正式週期的金額請查看本頁價格區，起算與適用條件以正式契約為準。"],
        ["會直接串接外送平台嗎？", "目前沒有在此宣稱任何外送平台 API 已完成串接。若有需求，可在諮詢時討論可行性。"],
      ].map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></div></section>
      <section id="consult" className="ads-section ads-consult"><div className="ads-shell ads-consult-grid"><div><span className="ads-overline">LET'S TALK</span><h2>告訴我們你的店家需求</h2><p>留下聯絡方式與想了解的功能。我們會依你的營運情況，說明合適的方案與確切費用。</p><div className="ads-contact-links"><ActionLink href={lineUrl} event="line_click" light>LINE 諮詢</ActionLink><a href={phone} onClick={() => trackAdsEvent("phone_click")}>電話聯絡：0987-353-751</a></div></div><LeadForm /></div></section>
      <section className="ads-company"><div className="ads-shell"><h2>平台聯絡資訊</h2><p>創百業智慧鏈｜百工百業大平台</p><p>聯絡人：陳美玲　電話：0987-353-751　Email：<a href="mailto:mii460627@gmail.com">mii460627@gmail.com</a></p><p>LINE ID：mii460627</p></div></section>
    </main>
    <footer className="ads-footer"><div className="ads-shell"><span>© {new Date().getFullYear()} 創百業智慧鏈</span><nav><a href="/privacy">隱私權政策</a><a href="/terms">使用條款</a><a href="/refund">退款／取消政策</a><a href="/contact">聯絡我們</a></nav></div></footer>
    <div className="ads-mobile-actions"><a href={lineUrl} onClick={() => trackAdsEvent("line_click")}>LINE 諮詢</a><a href="#consult" onClick={() => trackAdsEvent("hero_cta_click")}>免費了解方案</a></div>
  </div>;
}

const info: Record<string, [string, string, string[]]> = {
  merchant: ["店家數位經營方案", "從品牌展示到接單管理，依店家現況規劃合適的工具。", ["商家公開頁面與網站", "商品、服務與菜單管理", "訂單與顧客聯繫流程"]],
  ordering: ["LINE／線上點餐", "讓顧客用手機瀏覽商品並送出訂單，店家集中處理。", ["QR Code 入口", "取餐與預約流程", "實際 LINE 通知功能依方案確認"]],
  ai: ["AI 商家工具", "用數位工具協助整理內容與日常營運想法。", ["商品文案草稿", "常見問答整理", "行銷內容構思"]],
  platform: ["百工百業大平台", "連結各行各業的專業、資源與合作機會。", ["展示商家與服務", "尋找合作機會", "建立自己的數位經營能力"]],
  refund: ["退款／取消政策", "正式交易前，請以個別方案契約與付款頁公告為準。", ["取消或退款申請請透過聯絡頁提出", "請提供訂單與付款資料以便核對", "確認後依契約約定及適用法規處理"]],
  contact: ["聯絡我們", "告訴我們你的店家需求，或直接透過 LINE 與電話聯絡。", ["方案與費用諮詢", "網站與點餐需求", "帳號及服務問題"]],
  pricing: ["方案與價格", "價格與條件讀取正式方案目錄。實際付款與服務範圍以簽署的契約及報價為準。", []],
  about: ["關於創百業智慧鏈", "我們致力協助台灣店家與專業工作者運用網站、LINE 和數位工具，建立自己的數位經營能力。", ["專業 × 資源 × 機會", "降低中小企業數位化門檻", "連結百工百業的服務與需求"]],
  faq: ["常見問題", "關於店家方案、硬體、點餐流程與價格，先從最常見的問題開始。", ["免另外購買傳統大型 POS 硬體", "顧客可透過 QR Code 開啟店家頁面", "實際功能及費用以正式報價為準"]],
};
export function AdsInfoPage({ topic }: { topic: keyof typeof info }) {
  const [title, intro, points] = info[topic];
  const plans = useCatalog();
  const visiblePoints = topic === "pricing" ? plans.map((plan) => `${plan.plan_id === "baiye_standard_18000_addons" ? "百工標準方案" : plan.plan_id === "baiye_commerce_ai_45000" ? "AI 智慧商城完整版" : "免 POS 機智慧點餐"}：${money(plan.price_minor)}／${plan.term_months} 個月${plan.trial_months ? `；前 ${plan.trial_months} 個月系統服務費 NT$0，另有開通費與保證金` : ""}`) : points;
  return <div className="ads-page ads-info"><header className="ads-header"><div className="ads-shell ads-nav"><a href="/" className="ads-brand"><img src={`${base}brand/chuang-baiye-smart-chain-logo.png`} alt="創百業智慧鏈標誌" /><strong>創百業智慧鏈</strong></a><a href="/google-ads" className="ads-nav-cta">了解店家方案 <ArrowRight /></a></div></header><main className="ads-shell"><span className="ads-overline">創百業智慧鏈</span><h1>{title}</h1><p>{intro}</p><div className="ads-info-points">{visiblePoints.map((point) => <div key={point}><Check />{point}</div>)}</div>{topic === "contact" ? <div className="ads-consult-grid"><div><p>電話：<a href={phone}>0987-353-751</a><br />Email：<a href="mailto:mii460627@gmail.com">mii460627@gmail.com</a><br />LINE ID：mii460627</p><ActionLink href={lineUrl} event="line_click">LINE 諮詢</ActionLink></div><LeadForm /></div> : <a href="/google-ads#consult" className="ads-button">免費了解方案 <ArrowRight /></a>}</main><footer className="ads-footer"><div className="ads-shell"><a href="/privacy">隱私權政策</a><a href="/terms">使用條款</a><a href="/contact">聯絡我們</a></div></footer></div>;
}

const legal: Record<string, [string, [string, string][]]> = {
  privacy: ["隱私權政策", [
    ["蒐集資料與用途", "當你提交諮詢表單，我們蒐集姓名、店家名稱、手機、LINE ID、Email、產業、需求及來源參數，用於回覆諮詢、提供方案與確認服務需求。必要欄位為姓名、手機及產業。"],
    ["資料保存與安全", "表單資料存於 Cloudflare D1 資料庫，僅授權管理人員可存取。我們採取合理的權限控管與安全措施，並於達成蒐集目的或不再需要時刪除。"],
    ["第三方服務與追蹤", "網站使用 Cloudflare 提供網站與資料儲存服務。只有設定正式 Google Ads ID 後才載入 Google tag，用於衡量表單和聯絡點擊；網址中的 UTM 與 gclid 會隨表單保留。"],
    ["你的權利", "你可要求查詢、更正、停止使用或刪除個人資料。請透過聯絡頁或 mii460627@gmail.com 提出，我們會核對身分後處理。"],
  ]],
  terms: ["使用條款", [
    ["服務內容", "創百業智慧鏈提供商家展示、線上服務與數位工具。各功能、交付範圍與使用期間以個別方案及正式契約為準。"],
    ["帳號與內容", "使用者應提供正確資訊，不得發布違法、侵權或誤導內容，並應妥善保管帳號。"],
    ["價格與付款", "方案價格與期間以正式方案目錄及個別有效契約為準。點餐方案如有開通費、保證金或體驗優惠，將於方案頁及簽約前揭露；付款方式與起算依正式契約。"],
    ["服務變更與責任", "我們會合理維護服務安全與可用性；功能調整或中斷將依契約與適用法規處理。商業成果會因個別營運情況而異。"],
  ]],
};
export function AdsLegalPage({ topic }: { topic: "privacy" | "terms" }) {
  const [title, sections] = legal[topic];
  return <div className="ads-page ads-info"><header className="ads-header"><div className="ads-shell ads-nav"><a href="/" className="ads-brand"><img src={`${base}brand/chuang-baiye-smart-chain-logo.png`} alt="創百業智慧鏈標誌" /><strong>創百業智慧鏈</strong></a><a href="/contact" className="ads-nav-cta">聯絡我們 <ArrowRight /></a></div></header><main className="ads-shell ads-legal"><span className="ads-overline">網站政策</span><h1>{title}</h1><p>最後更新：2026 年 9 月 29 日</p>{sections.map(([heading, body]) => <section key={heading}><h2>{heading}</h2><p>{body}</p></section>)}</main><footer className="ads-footer"><div className="ads-shell"><a href="/privacy">隱私權政策</a><a href="/terms">使用條款</a><a href="/refund">退款／取消政策</a></div></footer></div>;
}
