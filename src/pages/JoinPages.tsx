import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Handshake, SignIn, Storefront, UserPlus } from "@phosphor-icons/react";
import { merchantOrderingApi } from "../qr-ordering-client";
import { userFacingError } from "../user-facing-error";

type Plan = {
  plan_id: string;
  name: string;
  tagline: string;
  price_minor: number;
  currency: string;
  term_months: number;
  trial_months: number;
  contract_version?: string;
  features?: Record<string, boolean | number>;
  installment_plan_requested: number | null;
  payment_provider_ready: boolean;
  contract_total_amount_minor: number;
  payment_due_at_signature_minor: number;
  remaining_amount_minor: number;
  trial_period_months: number;
  post_trial_payment_minor: number;
  payment_schedule_type: string;
};

const money = (minor = 0) =>
  `NT$${Math.trunc(Number(minor) / 100).toLocaleString("zh-TW")}`;
const errorText = (error: unknown) =>
  userFacingError(error, "目前無法載入方案，請重新整理或稍後再試。");

function PlanCard({
  plan,
  onChoose,
  busy,
}: {
  plan: Plan;
  onChoose: (plan: Plan) => void;
  busy?: boolean;
}) {
  const softpos = plan.plan_id === "baiye_softpos_24000";
  const description =
    plan.plan_id === "baiye_standard_18000_addons"
      ? "適合需要品牌官網、LINE、AI 客服、會員、預約及基本數位營運服務的商家。"
      : plan.plan_id === "baiye_commerce_ai_50000"
        ? "完整商城＋AI＋商品管理後台＋購物車＋訂單管理＋標準金流串接能力。"
        : "免專用 POS 主機，以 QR 掃碼點餐管理菜單、點餐、出餐看板與訂單。";
  return (
    <article className={`join-plan-card ${softpos ? "join-plan-softpos" : ""}`}>
      <span className="join-plan-tag">
        {softpos ? "3 個月試用" : plan.tagline}
      </span>
      <h2>{plan.name}</h2>
      <p className="join-plan-price">
        {money(plan.price_minor)}
        {softpos ? <small>／24 個月</small> : null}
      </p>
      {!softpos && (
        <p className="join-plan-term">服務期間 {plan.term_months} 個月</p>
      )}
      <p>{description}</p>
      {softpos && (
        <dl className="join-softpos-terms">
          <div>
            <dt>契約總額</dt>
            <dd>{money(plan.contract_total_amount_minor)}</dd>
          </div>
          <div>
            <dt>簽約首期款</dt>
            <dd>{money(plan.payment_due_at_signature_minor)}</dd>
          </div>
          <div>
            <dt>試用期間</dt>
            <dd>{plan.trial_period_months} 個月</dd>
          </div>
          <div className="join-softpos-balance">
            <dt>試用期結束尾款</dt>
            <dd>{money(plan.post_trial_payment_minor)}</dd>
          </div>
        </dl>
      )}
      <p className="join-installment-note">
        可申請信用卡 24
        期零利率。實際分期方案仍依合作銀行／金流服務商審核及實際提供條件為準。
      </p>
      <button
        className="btn btn-primary"
        type="button"
        aria-label={`${plan.name}：方案簽署合約`}
        disabled={busy}
        onClick={() => onChoose(plan)}
      >
        方案簽署合約
      </button>
    </article>
  );
}

export function JoinPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const plansRef = useRef<HTMLElement>(null);
  const merchantMode = search.get("mode") === "merchant";
  const [plans, setPlans] = useState<Plan[]>([]),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState("");
  useEffect(() => {
    void merchantOrderingApi<any>("/api/public/merchant-plans")
      .then((data) => setPlans(data.plans || []))
      .catch((error) => setNotice(errorText(error)));
  }, []);
  useEffect(() => {
    if (merchantMode && plans.length)
      plansRef.current?.scrollIntoView({ behavior: "auto", block: "start" });
  }, [merchantMode, plans.length]);
  const choose = async (plan: Plan) => {
    setBusy(plan.plan_id);
    setNotice("");
    try {
      await merchantOrderingApi("/api/merchant-auth/session");
      navigate(
        `/merchant/select-plan?plan=${encodeURIComponent(plan.plan_id)}`,
      );
    } catch (error: any) {
      if (error?.status === 401 || error?.code === "UNAUTHENTICATED")
        navigate(`/merchant/login?plan=${encodeURIComponent(plan.plan_id)}`);
      else setNotice(errorText(error));
    } finally {
      setBusy("");
    }
  };
  return (
    <main className="join-center-shell">
      <header className="join-center-hero">
        <p className="partner-eyebrow">統一加入／簽約中心</p>
        <h1>加入創百業智慧鏈</h1>
        <p>選擇您的身分或需要的服務方案</p>
      </header>
      <section className="join-identity-grid" aria-label="免費註冊與承攬夥伴">
        <article className="join-identity-card join-free-card">
          <UserPlus size={34} weight="duotone" />
          <span>NT$0</span>
          <h2>商家免費註冊</h2>
          <p>先免費建立商家帳號，確認適合的服務方案後再完成簽約。</p>
          <Link className="btn btn-primary" to="/merchant/register">
            免費註冊商家
          </Link>
        </article>
        <article className="join-identity-card">
          <Handshake size={34} weight="duotone" />
          <h2>承攬夥伴簽約</h2>
          <p>加入創百業承攬合作，完成資料與承攬合作契約後即可開始合作。</p>
          <Link className="btn btn-primary" to="/partner/apply">
            成為承攬夥伴
          </Link>
        </article>
      </section>
      <section className="join-plan-section" ref={plansRef}>
        <div className="join-section-heading">
          <Storefront size={30} weight="duotone" />
          <div>
            <h2>商家服務方案</h2>
            <p>免費註冊帳號後，再確認方案內容並完成契約簽署。</p>
          </div>
        </div>
        <div className="join-plan-grid">
          {plans.map((plan) => (
            <PlanCard
              key={plan.plan_id}
              plan={plan}
              onChoose={choose}
              busy={busy === plan.plan_id}
            />
          ))}
        </div>
        {!plans.length && (
          <p className="join-loading">{notice || "正在載入方案…"}</p>
        )}
      </section>
      <footer className="join-login-footer">
        <h2>已經有帳號？</h2>
        <div>
          <Link className="btn btn-outline" to="/merchant/login">
            <SignIn />
            商家登入
          </Link>
          <Link className="btn btn-outline" to="/partner/login">
            <SignIn />
            承攬夥伴登入
          </Link>
        </div>
      </footer>
      {notice && plans.length > 0 && (
        <p className="partner-message">{notice}</p>
      )}
    </main>
  );
}

export function MerchantPlanSelectorPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const requested = search.get("plan") || "";
  const [data, setData] = useState<any>(),
    [selected, setSelected] = useState(requested),
    [confirming, setConfirming] = useState(false),
    [notice, setNotice] = useState(""),
    [changeMode, setChangeMode] = useState(false);
  useEffect(() => {
    void merchantOrderingApi<any>("/api/merchant-auth/session")
      .then(() => merchantOrderingApi<any>("/api/merchant/plans"))
      .then((result) => {
        setData(result);
        setSelected(
          (value) =>
            value ||
            result.intended_plan_id ||
            result.selected_plan?.plan_id ||
            "",
        );
      })
      .catch((error: any) => {
        if (error?.status === 401)
          navigate(
            `/merchant/login${requested ? `?plan=${encodeURIComponent(requested)}` : ""}`,
            { replace: true },
          );
        else setNotice(errorText(error));
      });
  }, [navigate, requested]);
  const plan: Plan | undefined = data?.plans?.find(
    (item: Plan) => item.plan_id === selected,
  );
  const assign = async () => {
    if (!plan || confirming) return;
    setConfirming(true);
    setNotice("");
    try {
      const result: any = await merchantOrderingApi(
        "/api/merchant/plans/select",
        {
          method: "POST",
          body: JSON.stringify({
            plan_id: plan.plan_id,
            installment_plan_requested: 24,
          }),
        },
      );
      navigate(result.next_url || "/merchant/contract", { replace: true });
    } catch (error: any) {
      setNotice(errorText(error));
    } finally {
      setConfirming(false);
    }
  };
  const requestChange = async () => {
    if (!plan || confirming) return;
    setConfirming(true);
    setNotice("");
    try {
      const key = crypto.randomUUID();
      const result: any = await merchantOrderingApi(
        "/api/merchant/plans/change-requests",
        {
          method: "POST",
          headers: { "idempotency-key": key },
          body: JSON.stringify({ plan_id: plan.plan_id }),
        },
      );
      setNotice(
        result.code === "PLAN_CHANGE_ALREADY_SUBMITTED"
          ? "此方案的變更申請已送出，請勿重複提交。"
          : "申請已送出。原方案會維持不變，待確認費用與生效條件後再通知您。",
      );
      setData((current: any) => ({
        ...current,
        pending_plan_change: result.request,
      }));
      setChangeMode(false);
    } catch (error) {
      setNotice(errorText(error));
    } finally {
      setConfirming(false);
    }
  };
  if (!data)
    return (
      <main className="join-center-shell">
        <header className="join-center-hero">
          <h1>選擇商家服務方案</h1>
          <p>{notice || "正在載入您的方案…"}</p>
        </header>
      </main>
    );
  const description = (item: Plan) =>
    item.plan_id === "baiye_standard_18000_addons"
      ? "品牌官網、LINE、AI 客服、會員與預約。"
      : item.plan_id === "baiye_commerce_ai_50000"
        ? "完整 AI 商城、商品後台、購物車與訂單。"
        : "QR 點餐、菜單、KDS 與訂單管理。";
  const hasEffectivePlan = Boolean(data.has_effective_plan);
  const selectablePlans: Plan[] =
    hasEffectivePlan && changeMode
      ? data.plans.filter(
          (item: Plan) => item.plan_id !== data.active_plan?.plan_id,
        )
      : data.plans;
  return (
    <main className="join-center-shell merchant-plan-selector">
      <header className="join-center-hero">
        {!hasEffectivePlan && <p className="partner-eyebrow">商家服務</p>}
        <h1>{hasEffectivePlan ? "您的商家方案" : "選擇商家服務方案"}</h1>
        <p>
          {hasEffectivePlan
            ? "查看目前方案，或提出方案變更申請。"
            : "選擇適合的服務方案，再進入契約簽署。"}
        </p>
      </header>
      {hasEffectivePlan && !changeMode && (
        <section className="merchant-active-plan">
          <strong>您目前已有有效方案</strong>
          <button
            className="btn btn-outline"
            type="button"
            onClick={() => {
              setSelected("");
              setNotice("");
              setChangeMode(true);
            }}
          >
            變更方案
          </button>
        </section>
      )}
      {hasEffectivePlan && changeMode && (
        <section className="merchant-change-intro">
          <h2>選擇新方案</h2>
          <p>
            送出後由專人確認適用費用與生效條件；申請完成前，您目前的方案與既有契約不會變更。
          </p>
          <button
            className="btn btn-ghost"
            type="button"
            onClick={() => {
              setChangeMode(false);
              setSelected("");
            }}
          >
            返回目前方案
          </button>
        </section>
      )}
      {(!hasEffectivePlan || changeMode) && (
        <section className="join-plan-grid">
          {selectablePlans.map((item: Plan) => (
            <article
              key={item.plan_id}
              className={`join-plan-card join-selector-card ${selected === item.plan_id ? "is-selected" : ""}`}
            >
              <span className="join-plan-tag">
                {item.trial_months ? "3 個月試用" : item.tagline}
              </span>
              <h2>{item.name}</h2>
              <p className="join-plan-price">
                {money(item.price_minor)}
                {item.plan_id === "baiye_softpos_24000" ? (
                  <small>／24 個月</small>
                ) : null}
              </p>
              <p>{description(item)}</p>
              <button
                className="btn btn-primary"
                type="button"
                aria-pressed={selected === item.plan_id}
                onClick={() => setSelected(item.plan_id)}
              >
                {changeMode ? "選擇此方案" : "方案簽署合約"}
              </button>
            </article>
          ))}
        </section>
      )}
      {plan && (!hasEffectivePlan || changeMode) && (
        <section className="merchant-plan-confirm">
          <h2>{changeMode ? "確認變更申請" : "確認方案"}</h2>
          <p>
            <strong>{plan.name}</strong>｜契約總額{" "}
            {money(plan.contract_total_amount_minor)}｜{plan.term_months} 個月
          </p>
          <p>
            簽約時應付 {money(plan.payment_due_at_signature_minor)}；簽約後餘額{" "}
            {money(plan.remaining_amount_minor)}。
          </p>
          {plan.plan_id === "baiye_softpos_24000" && (
            <p>
              自服務啟用日起試用 {plan.trial_period_months} 個月；試用期結束尾款{" "}
              {money(plan.post_trial_payment_minor)}。第一次付款只收簽約首期款{" "}
              {money(plan.payment_due_at_signature_minor)}。
            </p>
          )}
          <p>契約完成簽署並經平台確認本次應付款入帳後才正式生效。</p>
          {changeMode && (
            <p>
              方案變更的差額、退款、補款及生效日期，將依您的現況確認後另行通知；此申請不會立即取代目前方案。
            </p>
          )}
          <button
            className="btn btn-primary btn-lg"
            type="button"
            disabled={
              confirming || Boolean(changeMode && data.pending_plan_change)
            }
            onClick={() => void (changeMode ? requestChange() : assign())}
          >
            {confirming
              ? "送出中…"
              : changeMode
                ? "送出變更申請"
                : "確認方案並前往契約"}
          </button>
        </section>
      )}
      {notice && <p className="partner-message">{notice}</p>}
    </main>
  );
}
