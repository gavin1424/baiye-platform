import { Handshake, SignIn, Storefront, UserPlus } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { fetchCommercialCatalog, formatTwd, type CommercialPlan } from "../commercial-catalog";
import { merchantLoginPathForContract, planContractPath } from "../contract-routing";
import { PartnerReferralJoin } from "./PartnerPages";
import { merchantOrderingApi, merchantProtectedResourceState } from "../qr-ordering-client";

function JoinPlanCard({ plan }: { plan: CommercialPlan }) {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(false);
  const contractPath = planContractPath(plan.plan_slug);
  const openContract = async () => {
    if (checking) return;
    setChecking(true);
    try {
      await merchantOrderingApi("/api/merchant-auth/session");
      navigate(contractPath);
    } catch (error) {
      navigate(merchantProtectedResourceState(error) === "unauthenticated" ? merchantLoginPathForContract(plan.plan_slug) : contractPath);
    } finally {
      setChecking(false);
    }
  };
  return <article className={`join-plan-card ${plan.plan_id.includes("softpos") ? "join-plan-softpos" : ""}`}>
    <h2>{plan.display_name}</h2>
    <p className="join-plan-price">{formatTwd(plan.price_minor)}{plan.plan_id.includes("softpos") && <small>／24 個月</small>}</p>
    <button className="btn btn-primary" type="button" onClick={() => void openContract()} disabled={checking}>{checking ? "正在確認登入…" : "方案簽署合約"}</button>
  </article>;
}

/** Referral links retain the existing attribution form; /join is the public join hub. */
export function JoinPage() {
  const [params] = useSearchParams();
  const plansRef = useRef<HTMLElement>(null);
  const [plans, setPlans] = useState<CommercialPlan[]>([]);
  const [notice, setNotice] = useState("");
  const merchantMode = params.get("mode") === "merchant";
  const referral = params.get("ref");
  useEffect(() => {
    if (referral) return;
    const controller = new AbortController();
    fetchCommercialCatalog(controller.signal).then((catalog) => { setPlans(catalog.plans); setNotice(""); }).catch((reason: unknown) => {
      if (reason instanceof DOMException && reason.name === "AbortError") return;
      setNotice("方案資料暫時無法載入，請稍後重新整理。");
    });
    return () => controller.abort();
  }, [referral]);
  useEffect(() => {
    if (merchantMode && plans.length) plansRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [merchantMode, plans.length]);
  if (referral) return <PartnerReferralJoin />;
  return <main className="join-center-shell">
    <header className="join-center-hero"><p className="partner-eyebrow">統一加入／簽約中心</p><h1>加入創百業智慧鏈</h1><p>選擇商家免費註冊、承攬夥伴合作，或直接簽署適合的商家服務方案。</p></header>
    <section className="join-identity-grid" aria-label="加入身分選擇">
      <article className="join-identity-card join-free-card"><UserPlus size={34} weight="duotone" /><span>NT$0</span><h2>商家免費註冊</h2><p>先建立商家帳號；免費註冊不等於簽署付費方案。</p><Link className="btn btn-outline" to="/merchant/register">免費註冊商家</Link></article>
      <article className="join-identity-card"><Handshake size={34} weight="duotone" /><h2>承攬夥伴簽約</h2><p>進入承攬夥伴申請與合作契約流程。</p><Link className="btn btn-outline" to="/partner/apply">承攬夥伴簽約</Link></article>
    </section>
    <section className="join-plan-section" ref={plansRef} aria-labelledby="merchant-plan-heading">
      <div className="join-section-heading"><Storefront size={30} weight="duotone" /><div><h2 id="merchant-plan-heading">商家服務方案</h2><p>選定方案後，直接進入該方案的正式契約簽署流程。</p></div></div>
      <div className="join-plan-grid">{plans.map((plan) => <JoinPlanCard key={plan.plan_id} plan={plan} />)}</div>
      {!plans.length && <p className="join-loading" role={notice ? "alert" : undefined}>{notice || "正在載入正式商家方案…"}</p>}
    </section>
    <footer className="join-login-footer"><h2>已經有帳號？</h2><div><Link className="btn btn-outline" to="/merchant/login"><SignIn />商家登入</Link><Link className="btn btn-outline" to="/partner/login"><SignIn />承攬夥伴登入</Link></div></footer>
  </main>;
}
