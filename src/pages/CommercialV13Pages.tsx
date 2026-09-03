import { Check, CheckCircle, Clock, Globe, ShieldCheck, ShoppingCart, UsersThree } from "@phosphor-icons/react";
import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { CTASection, MarketingHero, MarketingSection, PremiumCard, PublicLayout, SectionHeading } from "../components";
import { fetchCommercialCatalog, formatTwd, type CommercialCatalog, type CommercialPlan } from "../commercial-catalog";

function useCatalog() {
  const [catalog, setCatalog] = useState<CommercialCatalog>();
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    fetchCommercialCatalog(controller.signal).then((data) => { setCatalog(data); setError(""); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setError("方案資料暫時無法載入，請稍後重新整理。");
    });
    return () => controller.abort();
  }, []);
  return { catalog, error };
}

const planTone: Record<string, string> = { baiye_standard_18000_addons: "standard", baiye_commerce_ai_45000: "commerce", baiye_softpos_24000: "softpos" };

function PlanCard({ plan }: { plan: CommercialPlan }) {
  const tone = planTone[plan.plan_id];
  return <PremiumCard className={`pricing-v2-card pricing-v2-${tone}`}>
    <div className="pricing-v2-card-head"><span className="pricing-v2-badge">{plan.badge}</span><h2>{plan.display_name}</h2><p>{plan.summary}</p>{plan.list_price_minor > plan.price_minor && <del>原價 {formatTwd(plan.list_price_minor)}</del>}<div className="pricing-v2-amount"><strong>{formatTwd(plan.price_minor)}</strong><span>／{plan.term_months} 個月</span></div>{plan.trial_months > 0 && <p className="pricing-v2-trial"><Clock weight="fill" />前 {plan.trial_months} 個月系統服務費免費</p>}</div>
    <Link className="btn btn-primary btn-lg" to={`/merchant/register?plan=${plan.plan_id}`}>免費建立商家帳號</Link>
    <ul>{plan.features.map((feature) => <li key={feature}><Check weight="bold" />{feature}</li>)}</ul>
    {tone === "standard" && <p className="pricing-v2-note">網站主要內容由百工協助維護；不開放完整 CMS。基礎協助上架 {plan.base_product_limit} 項。</p>}
    {tone === "commerce" && <p className="pricing-v2-note">商家可自行管理商品、價格、圖片、分類、規格與上下架；真實金流仍依 Provider readiness。</p>}
    {tone === "softpos" && <div className="pricing-v2-fees"><span>開通費 <strong>{formatTwd(plan.activation_fee_minor)}</strong></span><span>首次保證金 <strong>{formatTwd(plan.deposit_minor)}</strong></span><span>首週期尚需 <strong>{formatTwd(plan.first_cycle_balance_minor)}</strong></span></div>}
  </PremiumCard>;
}

const comparisonRows = [
  ["網站", "品牌網站", "完整商城", "點餐入口"], ["AI 客服", "包含", "包含", "可依需求整合"], ["LINE", "包含", "可整合", "選配"], ["會員", "包含", "包含", "包含"], ["預約", "包含", "可整合", "可整合"], ["Google 地圖預約", "包含", "可整合", "可整合"], ["商品管理", "百工協助 20 項", "商家完整管理", "商家菜單管理"], ["商家自行修改", "不開放完整 CMS", "完整商品後台", "菜單與營運資料"], ["購物車", "加購", "包含", "點餐購物車"], ["訂單", "加購", "包含", "包含"], ["QR 點餐", "加購", "可整合", "包含"], ["庫存", "加購／依需求", "可整合", "包含"], ["出餐看板", "加購／依需求", "可整合", "包含"], ["標準金流串接能力", "加購", "包含建置能力", "依 readiness"], ["服務期間", "24 個月", "24 個月", "前 3 月免費＋24 個月"], ["加購方式", "附件 B／補充協議", "非標準需求另行確認", "第三方與設備另計"],
] as const;

export function PricingPageV13() {
  const { catalog, error } = useCatalog(); const plans = catalog?.plans || [];
  return <PublicLayout>
    <MarketingHero eyebrow="商家數位升級方案" title="從品牌官網，到完整商城與智慧點餐" description="依商家營運需求，選擇適合的數位升級方案。所有金額、期間與契約版本皆由伺服器方案目錄提供。" primary={{ label: "免費建立商家帳號", to: "/merchant/register" }} secondary={{ label: "比較方案", to: "/pricing?compare=1" }} className="pricing-v2-hero"><div className="pricing-hero-chips">{plans.length ? plans.map((plan) => <span key={plan.plan_id}><strong>{formatTwd(plan.price_minor)}{plan.plan_id.includes("softpos") ? "／24個月" : ""}</strong><small>{plan.short_name}</small></span>) : <span><strong>3 種商家方案</strong><small>載入正式價格中</small></span>}</div></MarketingHero>
    <nav className="pricing-mobile-selector" aria-label="快速選擇方案">{plans.map((plan) => <button type="button" key={plan.plan_id} onClick={() => document.getElementById(`plan-${planTone[plan.plan_id]}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>{plan.price_minor === 2400000 ? "24k" : `${plan.price_minor / 100000}k`}</button>)}</nav>
    <MarketingSection className="pricing-v2-plans" id="plans"><SectionHeading eyebrow="三種正式方案" title="選擇符合現在營運階段的方案" description="免費商家帳號是進入方案流程的起點，不與付費方案混列。正式簽約金額由伺服器端依契約版本確認。" />{error && <div className="catalog-error" role="alert">{error}</div>}<div className="pricing-v2-grid">{plans.map((plan, index) => <div id={`plan-${planTone[plan.plan_id]}`} className="card-stagger" style={{ "--stagger": `${index * 80}ms` } as CSSProperties} key={plan.plan_id}><PlanCard plan={plan} /></div>)}</div>{!plans.length && !error && <div className="catalog-loading">正在讀取正式方案目錄…</div>}</MarketingSection>
    <MarketingSection className="pricing-v2-comparison" id="comparison"><SectionHeading eyebrow="方案比較" title="功能、權限與服務期間，一次看清楚" description="桌面使用完整表格；手機可逐項閱讀，不需要左右拖曳超寬表格。" /><div className="pricing-comparison-desktop" role="table" aria-label="三種商家方案比較"><div className="pricing-comparison-row pricing-comparison-head" role="row"><strong>比較項目</strong><span>18k 標準</span><span>45k 商城</span><span>24k 點餐</span></div>{comparisonRows.map((row) => <div className="pricing-comparison-row" role="row" key={row[0]}><strong>{row[0]}</strong>{row.slice(1).map((value) => <span key={value}>{value}</span>)}</div>)}</div><div className="pricing-comparison-mobile">{comparisonRows.map((row) => <PremiumCard key={row[0]}><h3>{row[0]}</h3><dl><dt>18k 標準</dt><dd>{row[1]}</dd><dt>45k 商城</dt><dd>{row[2]}</dd><dt>24k 點餐</dt><dd>{row[3]}</dd></dl></PremiumCard>)}</div></MarketingSection>
    {catalog && <MarketingSection className="pricing-v2-addons"><SectionHeading eyebrow="標準方案加購服務" title="超出 20 項或特殊功能，以正式加購處理" description="價格讀取同一份 Platform Add-on Pricing Config；標示「起」的項目必須由百工 Admin 確認 Quote，前端不會自行計算最終契約金額。" /><div className="addon-grid">{catalog.standard_addons.map((addon, index) => <PremiumCard className="card-stagger" key={addon.code}><span>{String(index + 1).padStart(2, "0")}</span><h3>{addon.label}</h3><strong>{addon.display_price}</strong>{addon.admin_quote_required && <small>須人工確認最終報價</small>}</PremiumCard>)}</div></MarketingSection>}
    <MarketingSection className="pricing-v2-terms"><div className="pricing-trust-row">{[[ShieldCheck, "價格由伺服器方案目錄提供"], [CheckCircle, "契約法律審閱 Gate 保留"], [UsersThree, "真人協助導入"], [Globe, "第三方能力依 readiness"]].map(([Icon, label]) => { const I = Icon as typeof ShieldCheck; return <span key={String(label)}><I weight="duotone" />{String(label)}</span>; })}</div><div className="softpos-disclosure"><ShoppingCart weight="duotone" /><p><strong>SoftPOS 商業條件：</strong>首次開通費 NT$3,000；保證金 NT$6,000 可抵第一個 24 個月週期，尚需 NT$18,000；後續每 24 個月 NT$24,000（平均 NT$1,000／月）。{catalog?.installment_disclosure}</p></div></MarketingSection>
    <CTASection eyebrow="先從帳號開始" title="先免費建立商家帳號，再選擇適合方案" description="建立帳號不代表已簽約或已啟用第三方金流；方案、契約與開通會依正式流程逐步確認。" primary={{ label: "商家免費註冊", to: "/merchant/register" }} secondary={{ label: "聯絡我們", to: "/contact" }} />
  </PublicLayout>;
}

export function MerchantPlanSelectPage() {
  const { catalog, error } = useCatalog();
  const plans = catalog?.plans || [];
  return <PublicLayout>
    <MarketingHero eyebrow="選擇商家方案" title="選擇符合營運需求的方案" description="此處只保存方案意向，不會由前端建立契約金額。百工確認需求後，會以正式契約版本與伺服器端商業條件完成後續流程。" secondary={{ label: "返回方案比較", to: "/pricing" }} />
    <MarketingSection className="pricing-v2-plans"><div className="pricing-v2-grid">{plans.map((plan) => <PremiumCard className={`pricing-v2-card pricing-v2-${planTone[plan.plan_id]}`} key={plan.plan_id}><span className="pricing-v2-badge">{plan.badge}</span><h2>{plan.display_name}</h2><div className="pricing-v2-amount"><strong>{formatTwd(plan.price_minor)}</strong><span>／{plan.term_months} 個月</span></div><p>{plan.summary}</p><Link className="btn btn-primary" to={`/contact?plan=${plan.plan_id}`}>選擇此方案並聯絡百工</Link></PremiumCard>)}</div>{error && <div className="catalog-error" role="alert">{error}</div>}{!plans.length && !error && <div className="catalog-loading">正在讀取正式方案目錄…</div>}</MarketingSection>
  </PublicLayout>;
}

export function HowItWorksPageV13() {
  return <PublicLayout><MarketingHero eyebrow="如何運作" title="從免費帳號，到簽約與正式營運" description="先確認商家需求，再選擇 18k 標準、45k 完整商城或 24k 免 POS 點餐方案；每一步都有清楚的契約與啟用狀態。" primary={{ label: "免費建立商家帳號", to: "/merchant/register" }} secondary={{ label: "比較三種方案", to: "/pricing" }} /><MarketingSection className="how-v2"><SectionHeading eyebrow="導入流程" title="五個步驟，讓權限與服務範圍不混淆" /><div className="path-steps">{[["1", "免費建立商家帳號", "使用手機與 8 位數字密碼建立商家申請。"], ["2", "選擇適合方案", "依品牌網站、完整商城或智慧點餐需求選擇方案。"], ["3", "確認契約與商業條件", "價格、期間、Trial、保證金與加購均以伺服器端正式版本為準。"], ["4", "完成簽約與啟用", "法律審閱 Gate、電子簽署與付款狀態完成後，才開啟對應權限。"], ["5", "進入商家管理中心", "依方案管理商品、訂單、會員、預約、庫存或出餐流程。"]].map(([n, t, d]) => <PremiumCard className="card-stagger" key={n}><span className="path-number">{n}</span><h2>{t}</h2><p>{d}</p></PremiumCard>)}</div></MarketingSection><CTASection title="先比較方案，再決定導入節奏" description="不需要把所有功能一次裝上；我們會依商家現況確認最合適的服務範圍。" primary={{ label: "查看商家方案", to: "/pricing" }} secondary={{ label: "聯絡平台", to: "/contact" }} /></PublicLayout>;
}

export function FaqPageV13() {
  const items = [["目前有哪些商家方案？", "共有百工標準方案 NT$18,000／24 個月、AI 智慧商城完整版 NT$45,000，以及免 POS 機智慧點餐 NT$24,000／24 個月。"], ["18k 標準方案可以自己改完整網站嗎？", "不開放完整 CMS；網站主要內容與基礎 20 項商品／服務由百工協助建立與維護。超出範圍以加購報價和補充協議辦理。"], ["45k 完整商城包含什麼？", "固定完整方案包含 AI、完整商城、商品管理後台、購物車、訂單管理、商家管理者與標準金流串接能力；實際付款 Provider 仍須完成審核與 readiness。"], ["免 POS 點餐的前三個月與保證金怎麼算？", "前 3 個月系統服務費免費；首次開通費 NT$3,000、保證金 NT$6,000。保證金可抵第一個 24 個月週期，因此首週期尚需 NT$18,000；後續每 24 個月 NT$24,000。"], ["24 期零利率一定可以使用嗎？", "不一定。實際分期方案依合作銀行／金流服務商核准及當時可用條件為準，平台不會假稱 Provider 已啟用。"], ["標準方案加購如何計價？", "加購價格由 Platform Add-on Pricing Config 提供；正式金流 API 等「起」價項目須由百工 Admin 確認 Quote，前端不會自行決定契約總額。"], ["第三年續用費如何計算？", "18k 標準方案如沿用目前契約條件，第 3 年起選擇續用時為平台上架 NT$3,000、網域 NT$1,000、後台／網站維持 NT$3,000，合計 NT$7,000／年。"]];
  return <PublicLayout><MarketingHero eyebrow="常見問題" title="三種商家方案，關鍵條件一次說清楚" description="價格、內容權限、智慧點餐 Trial、保證金、加購與第三方服務限制，都以清楚白話呈現。" primary={{ label: "比較方案", to: "/pricing" }} secondary={{ label: "聯絡我們", to: "/contact" }} /><MarketingSection><div className="faq-grid faq-v2">{items.map(([q, a]) => <PremiumCard key={q}><h3>{q}</h3><p>{a}</p></PremiumCard>)}</div></MarketingSection></PublicLayout>;
}

export function TermsPageV13() {
  const sections = [["服務性質", "創百業智慧鏈提供商家數位升級、平台上架、品牌網站、商城、智慧點餐、內容刊登與營運工具。"], ["方案與商業條件", "公開價格由伺服器權威方案目錄提供；實際交易仍以雙方簽署之有效商家服務契約、商業條件 Snapshot 及補充協議為準。"], ["第三方服務", "金流、分期、電子發票、LINE、簡訊、物流與其他 Provider，僅於完成正式資格、憑證與 Production 驗證後啟用。"], ["額外需求", "原方案外新增頁面、特殊設計、第三方 API、客製流程或人工內容修改，須另行評估、報價與確認。"], ["付款、退款與契約優先", "付款、退款、修改、交付、驗收、智慧財產、資料使用與終止條件，以雙方實際簽署之有效契約為準。"]];
  return <PublicLayout><MarketingHero eyebrow="平台規範" title="使用條款與商家商業方案" description="公開資訊協助比較；具有法律效果的權利義務，以完成審閱並正式簽署的契約版本為準。" /><MarketingSection className="legal-page-v2"><article>{sections.map(([h, t], i) => <section id={`v13-${i}`} key={h}><span>{String(i + 1).padStart(2, "0")}</span><div><h2>{h}</h2><p>{t}</p></div></section>)}</article></MarketingSection></PublicLayout>;
}
