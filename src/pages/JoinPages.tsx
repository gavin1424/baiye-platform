import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Handshake, SignIn, Storefront, UserPlus } from "@phosphor-icons/react";
import { merchantOrderingApi } from "../qr-ordering-client";

type Plan = {
  plan_id: string;
  name: string;
  tagline: string;
  price_minor: number;
  currency: string;
  term_months: number;
  trial_months: number;
  activation_fee_minor: number;
  deposit_minor: number;
  cycle_fee_minor: number;
  first_cycle_credit_minor: number;
  first_cycle_balance_minor: number;
  renewal_fee_minor: number;
  contract_version: string;
  features: Record<string, boolean | number>;
  installment_plan_requested: number | null;
  payment_provider_ready: boolean;
};

const money = (minor = 0) => `NT$${Math.trunc(Number(minor) / 100).toLocaleString("zh-TW")}`;
const errorText = (error: any) => error?.message || "方案服務暫時無法使用，請稍後再試。";

function PlanCard({ plan, onChoose, busy }: { plan: Plan; onChoose: (plan: Plan) => void; busy?: boolean }) {
  const softpos = plan.plan_id === "baiye_softpos_24000";
  const description = plan.plan_id === "baiye_standard_18000_addons"
    ? "適合需要品牌官網、LINE、AI 客服、會員、預約及基本數位營運服務的商家。"
    : plan.plan_id === "baiye_commerce_ai_45000"
      ? "完整商城＋AI＋商品管理後台＋購物車＋訂單管理＋標準金流串接能力。"
      : "免專用 POS 主機，沿用既有 QR Ordering Core 管理菜單、點餐、KDS 與訂單。";
  return <article className={`join-plan-card ${softpos ? "join-plan-softpos" : ""}`}>
    <span className="join-plan-tag">{softpos ? "前 3 個月免費" : plan.tagline}</span>
    <h2>{plan.name}</h2>
    <p className="join-plan-price">{money(plan.price_minor)}{softpos ? <small>／24 個月</small> : null}</p>
    {!softpos && <p className="join-plan-term">服務期間 {plan.term_months} 個月</p>}
    <p>{description}</p>
    {softpos && <dl className="join-softpos-terms">
      <div><dt>首次開通費</dt><dd>{money(plan.activation_fee_minor)}</dd></div>
      <div><dt>首次保證金</dt><dd>{money(plan.deposit_minor)}</dd></div>
      <div><dt>前三個月</dt><dd>系統服務費 NT$0</dd></div>
      <div><dt>第一正式週期</dt><dd>{money(plan.cycle_fee_minor)}／24 個月</dd></div>
      <div><dt>保證金抵扣</dt><dd>－{money(plan.first_cycle_credit_minor)}</dd></div>
      <div className="join-softpos-balance"><dt>第一週期實際尚需</dt><dd>{money(plan.first_cycle_balance_minor)}</dd></div>
      <div><dt>後續每 24 個月</dt><dd>{money(plan.renewal_fee_minor)}</dd></div>
      <div><dt>平均概念</dt><dd>NT$1,000／月</dd></div>
    </dl>}
    <p className="join-installment-note">可申請信用卡 24 期零利率。實際分期方案仍依合作銀行／金流服務商審核及實際提供條件為準。</p>
    <button className="btn btn-primary" type="button" disabled={busy} onClick={() => onChoose(plan)}>
      {plan.plan_id === "baiye_standard_18000_addons" ? "選擇 NT$18,000 方案" : plan.plan_id === "baiye_commerce_ai_45000" ? "選擇 NT$45,000 商城" : "申請免 POS 機方案"}
    </button>
  </article>;
}

export function JoinPage() {
  const navigate = useNavigate();
  const [plans, setPlans] = useState<Plan[]>([]), [notice, setNotice] = useState(""), [busy, setBusy] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/public/merchant-plans").then((data) => setPlans(data.plans || [])).catch((error) => setNotice(errorText(error))); }, []);
  const choose = async (plan: Plan) => {
    setBusy(plan.plan_id); setNotice("");
    try {
      await merchantOrderingApi("/api/merchant-auth/session");
      navigate(`/merchant/select-plan?plan=${encodeURIComponent(plan.plan_id)}`);
    } catch (error: any) {
      if (error?.status === 401 || error?.code === "UNAUTHENTICATED") navigate(`/merchant/register?plan=${encodeURIComponent(plan.plan_id)}`);
      else setNotice(errorText(error));
    } finally { setBusy(""); }
  };
  return <main className="join-center-shell">
    <header className="join-center-hero"><p className="partner-eyebrow">統一加入／簽約中心</p><h1>加入創百業智慧鏈</h1><p>免費建立商家帳號，或選擇適合您的服務方案</p></header>
    <section className="join-identity-grid" aria-label="免費註冊與承攬夥伴">
      <article className="join-identity-card join-free-card"><UserPlus size={34} weight="duotone" /><span>NT$0</span><h2>商家免費註冊</h2><p>先免費建立商家帳號，確認適合的服務方案後再完成簽約。</p><Link className="btn btn-primary" to="/merchant/register">免費註冊商家</Link></article>
      <article className="join-identity-card"><Handshake size={34} weight="duotone" /><h2>承攬夥伴簽約</h2><p>加入創百業承攬合作，完成資料與承攬合作契約後即可開始合作。</p><Link className="btn btn-primary" to="/partner/apply">成為承攬夥伴</Link></article>
    </section>
    <section className="join-plan-section"><div className="join-section-heading"><Storefront size={30} weight="duotone" /><div><h2>商家服務方案</h2><p>免費註冊帳號後，再確認付費方案並使用同一套商家契約簽署流程。</p></div></div><div className="join-plan-grid">{plans.map((plan) => <PlanCard key={plan.plan_id} plan={plan} onChoose={choose} busy={busy === plan.plan_id} />)}</div>{!plans.length && <p className="join-loading">{notice || "正在載入正式方案設定…"}</p>}</section>
    <footer className="join-login-footer"><h2>已經有帳號？</h2><div><Link className="btn btn-outline" to="/merchant/login"><SignIn />商家登入</Link><Link className="btn btn-outline" to="/partner/login"><SignIn />承攬夥伴登入</Link></div></footer>
    {notice && plans.length > 0 && <p className="partner-message">{notice}</p>}
  </main>;
}

export function MerchantPlanSelectorPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requested = search.get("plan") || "";
  const [data, setData] = useState<any>(), [selected, setSelected] = useState(requested), [confirming, setConfirming] = useState(false), [notice, setNotice] = useState("");
  useEffect(() => {
    void merchantOrderingApi<any>("/api/merchant-auth/session").then(() => merchantOrderingApi<any>("/api/merchant/plans")).then((result) => {
      setData(result);
      setSelected((value) => value || result.intended_plan_id || result.selected_plan?.plan_id || "");
    }).catch((error: any) => {
      if (error?.status === 401) navigate(`/merchant/register${requested ? `?plan=${encodeURIComponent(requested)}` : ""}`, { replace: true });
      else setNotice(errorText(error));
    });
  }, [navigate, requested]);
  const plan: Plan | undefined = data?.plans?.find((item: Plan) => item.plan_id === selected);
  const assign = async () => {
    if (!plan || confirming) return;
    setConfirming(true); setNotice("");
    try {
      const result: any = await merchantOrderingApi("/api/merchant/plans/select", { method: "POST", body: JSON.stringify({ plan_id: plan.plan_id, installment_plan_requested: 24 }) });
      navigate(result.next_url || "/merchant/contract", { replace: true });
    } catch (error: any) { setNotice(error?.code === "ACTIVE_PLAN_EXISTS" ? "您目前已有有效方案。如需升級，請走 Plan Change／Upgrade／Addendum；原已簽契約不會被覆寫。" : errorText(error)); }
    finally { setConfirming(false); }
  };
  if (!data) return <main className="join-center-shell"><header className="join-center-hero"><h1>選擇商家服務方案</h1><p>{notice || "正在驗證商家帳號與正式方案設定…"}</p></header></main>;
  return <main className="join-center-shell merchant-plan-selector"><header className="join-center-hero"><p className="partner-eyebrow">商家註冊下一步</p><h1>選擇商家服務方案</h1><p>方案價格、期間、試用與契約版本均由伺服器正式設定；前端數字不會成為最終契約金額。</p></header>
    {data.signed_contract && <section className="partner-status warning"><strong>您目前已有有效方案。</strong><span>若需要升級，請走 Plan Change／Upgrade／Addendum；系統不會直接覆寫舊 Signed Contract。</span></section>}
    <section className="join-plan-grid">{data.plans.map((item: Plan) => <label key={item.plan_id} className={`join-plan-card join-selector-card ${selected === item.plan_id ? "is-selected" : ""}`}><input type="radio" name="merchant-plan" value={item.plan_id} checked={selected === item.plan_id} onChange={() => setSelected(item.plan_id)} /><span className="join-plan-tag">{item.trial_months ? "前 3 個月免費" : item.tagline}</span><h2>{item.name}</h2><p className="join-plan-price">{money(item.price_minor)}{item.plan_id === "baiye_softpos_24000" ? <small>／24 個月</small> : null}</p><p>契約版本：{item.contract_version}</p></label>)}</section>
    {plan && <section className="merchant-plan-confirm"><h2>確認方案</h2><p><strong>{plan.name}</strong>｜{money(plan.price_minor)}｜{plan.term_months} 個月{plan.trial_months ? `，另有 ${plan.trial_months} 個月免費試用（不計入正式週期）` : ""}</p>{plan.plan_id === "baiye_softpos_24000" && <p>首次開通費 {money(plan.activation_fee_minor)} ＋ 保證金 {money(plan.deposit_minor)}；第一正式週期 {money(plan.cycle_fee_minor)} 抵扣 {money(plan.first_cycle_credit_minor)} 後尚需 {money(plan.first_cycle_balance_minor)}。</p>}<p>可申請信用卡 24 期零利率；實際仍依合作銀行／金流服務商審核及提供條件為準。目前不會建立假 24 期交易。</p><button className="btn btn-primary btn-lg" type="button" disabled={confirming || Boolean(data.signed_contract)} onClick={() => void assign()}>{confirming ? "伺服器確認中…" : "確認方案並前往契約"}</button></section>}
    {notice && <p className="partner-message">{notice}</p>}
  </main>;
}
