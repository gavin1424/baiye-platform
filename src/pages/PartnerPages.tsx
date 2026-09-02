import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AdminModuleNav } from "../components/AdminModuleNav";
import { adminApi as secureAdminApi } from "../admin-auth-client";
import { ContractSignatureCanvas, type SignatureValue } from "../components/ContractSignatureCanvas";
import { savePlatformMemberToken } from "../qr-ordering-client";
import {
  downloadContractPdf,
  fetchContractPdfBlob,
  openContractPdf,
  PartnerContractPdfError,
} from "../lib/partner-contract-pdf";

const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "—";
const formatDateOnly = (value?: string | null) => value ? value.replaceAll("-", "/") : "—";
const money = (value: unknown) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
function errorText(value: unknown) {
  return value instanceof Error && value.message
    ? value.message
    : "系統暫時無法完成此操作，請稍後再試。";
}
class ApiError extends Error {
  data: any;
  constructor(data: any) {
    super(data?.error || "系統暫時無法完成此操作，請稍後再試。");
    this.data = data;
  }
}
async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    credentials: "include",
    ...init,
    headers: { "content-type": "application/json", ...init.headers },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data);
  return data;
}
function copyText(value: string) {
  return navigator.clipboard?.writeText(value);
}
type Workflow = {
  code?: string;
  state?: string;
  message?: string;
  has_valid_invite?: boolean;
  activation_url?: string;
};
const workflowFromError = (error: unknown): Workflow =>
  error instanceof ApiError ? error.data : { message: errorText(error) };

function WorkflowActions({
  workflow,
}: {
  workflow: Workflow;
}) {
  return (
    <div className="partner-workflow-actions">
      {["active", "contract_required"].includes(workflow.state || "") && (
        <Link className="btn btn-primary btn-sm" to="/partner/login">
          {workflow.state === "contract_required" ? "登入後繼續簽署契約" : "前往承攬夥伴登入"}
        </Link>
      )}
      {["pending_activation", "invite_expired"].includes(
        workflow.state || "",
      ) && (
        <a
          className="btn btn-primary btn-sm"
          href={workflow.activation_url || "#/partner/apply"}
        >
          {workflow.activation_url ? "立即繼續" : "取得新的啟用通知"}
        </a>
      )}
      <Link className="btn btn-outline btn-sm" to="/partner">
        承攬夥伴中心
      </Link>
    </div>
  );
}

function PartnerStatusLookup() {
  const [phone, setPhone] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>();
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setNotice("");
    try {
      setWorkflow(
        await api("/api/partner/status", {
          method: "POST",
          body: JSON.stringify({ phone }),
        }),
      );
    } catch (error) {
      setWorkflow(workflowFromError(error));
    } finally {
      setLoading(false);
    }
  };
  return (
    <section
      className="partner-status-lookup"
      aria-labelledby="partner-status-title"
    >
      <div>
        <p className="partner-eyebrow">已申請或需要繼續？</p>
        <h2 id="partner-status-title">查詢承攬夥伴狀態</h2>
        <p>使用申請時登記的手機查詢；畫面不會公開姓名、完整手機、編號或管理資料。</p>
      </div>
      <form onSubmit={submit}>
        <label>
          手機號碼
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="09xxxxxxxx"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "查詢中…" : "查詢／繼續"}
        </button>
      </form>
      {workflow?.message && (
        <div
          className={`partner-workflow-card state-${workflow.state || "error"}`}
        >
          <strong>{workflow.message}</strong>
          <WorkflowActions workflow={workflow} />
        </div>
      )}
      {notice && <p className="partner-message">{notice}</p>}
    </section>
  );
}

export function PartnerLanding() {
  return (
    <main className="partner-shell">
      <section className="partner-hero">
        <p className="partner-eyebrow">創百業智慧鏈｜承攬夥伴中心</p>
        <h1>以成果承攬合作，共創百業數位升級</h1>
        <p className="partner-lead">
          推薦新商家、累積有效成交，依承攬夥伴等級取得推廣獎勵。
        </p>
        <p>
          本計畫採獨立承攬／居間合作性質，不設打卡、固定工時、排班或工作地點管理。
        </p>
        <div className="partner-hero-actions">
          <Link className="btn btn-primary" to="/partner/apply">
            申請成為承攬夥伴
          </Link>
          <Link className="btn btn-outline" to="/partner/login">
            承攬夥伴登入
          </Link>
        </div>
      </section>
      <PartnerStatusLookup />
      <section
        className="partner-commission-summary"
        aria-labelledby="partner-commission-title"
      >
        <div>
          <p className="partner-eyebrow">承攬夥伴分級獎勵</p>
          <h2 id="partner-commission-title">歷史累計成交決定身份等級</h2>
          <p>
            升級採非追溯式；前一完整曆月是否符合合作資格維持條件，會影響次月單件獎勵級距。
          </p>
        </div>
        <ul>
          <li>
            <span>初階｜1～10 件｜每月 1 件</span>
            <strong>NT$1,000／件</strong>
          </li>
          <li>
            <span>進階｜11～30 件｜每月 1 件</span>
            <strong>NT$1,500／件</strong>
          </li>
          <li>
            <span>中階｜31～70 件｜每月 2 件</span>
            <strong>NT$2,000／件</strong>
          </li>
          <li>
            <span>高階｜71～120 件｜每月 3 件</span>
            <strong>NT$2,500／件</strong>
          </li>
          <li>
            <span>資深｜121 件以上｜每月 4 件</span>
            <strong>NT$3,000／件</strong>
          </li>
        </ul>
        <p className="partner-guidance-note">
          初階承攬夥伴自啟用後第一個完整曆月起，如連續 2
          個完整曆月均未達每月至少 1 件有效成交，依契約終止承攬合作關係。
        </p>
      </section>
      <section className="partner-commission-summary">
        <div>
          <p className="partner-eyebrow">VIP 百萬推廣大獎</p>
          <h2>每 3 年一個獨立獎勵週期</h2>
          <p>
            單一週期累計達 1,000 家有效新商家，經查核後可獲一次性 NT$1,000,000
            VIP 推廣大獎（稅前）。下一個三年週期重新自 0 計算。
          </p>
        </div>
        <p className="partner-guidance-note">
          商家續約、第三年起上架／網域／後台網站維持費、重複付款、退款、取消、虛假或拆單案件均不計入
          1,000 家門檻。
        </p>
      </section>
    </main>
  );
}

export function PartnerApply() {
  const [form, setForm] = useState<any>({
    legal_name: "",
    id_number: "",
    email: "",
    phone: "",
    company_name: "",
    tax_id: "",
    note: "",
    consent: false,
  });
  const [message, setMessage] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>();
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState<any>();
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setWorkflow(undefined);
    setNotice("");
    setSuccess(undefined);
    try {
      const result = await api("/api/partner/apply", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setSuccess(result);
    } catch (error) {
      const result = workflowFromError(error);
      if (result.state) setWorkflow(result);
      else setMessage(result.message || errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>承攬夥伴合作申請</h1>
      <p>完成基本資料驗證後，系統會立即核准並提供安全啟用連結。</p>
      <form onSubmit={submit}>
        {[
          ["legal_name", "法定姓名"],
          ["id_number", "身分證字號"],
          ["email", "Email"],
          ["phone", "手機"],
          ["company_name", "公司／行號（選填）"],
          ["tax_id", "統編（選填）"],
          ["note", "承攬／推廣經驗與備註（選填）"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={key === "email" ? "email" : key === "phone" ? "tel" : "text"}
              placeholder={key === "id_number" ? "A123456789" : undefined}
              required={
                !key.includes("company") &&
                !key.includes("tax") &&
                !key.includes("note")
              }
              value={form[key]}
              onChange={(event) => setForm({ ...form, [key]: key === "id_number" ? event.target.value.toUpperCase() : event.target.value })}
            />
          </label>
        ))}
        <label className="partner-consent">
          <input
            type="checkbox"
            required
            checked={form.consent}
            onChange={(event) =>
              setForm({ ...form, consent: event.target.checked })
            }
          />
          我了解本合作屬獨立承攬／居間合作、非甲方僱員，並同意會員服務與隱私權說明。
        </label>
        <button className="btn btn-primary">送出申請</button>
        <small className="partner-auto-approval-note">送出後將立即完成承攬夥伴資格核准，無須等待人工審核。</small>
      </form>
      {workflow?.message && (
        <section className={`partner-workflow-card state-${workflow.state}`}>
          <strong>{workflow.message}</strong>
          <WorkflowActions workflow={workflow} />
        </section>
      )}
      {message && (
        <section className="partner-message">
          <p>{message}</p>
        </section>
      )}
      {success && (
        <section className="partner-auto-approved-card" aria-live="polite">
          <div className="member-celebration" aria-hidden="true">🎉</div>
          <p className="partner-eyebrow">申請成功</p>
          <h2>恭喜您已通過創百業承攬夥伴申請。</h2>
          <p className="partner-approved-code">承攬夥伴編號：<strong>{success.partner_code}</strong></p>
          {success.id_number_masked && <p>身分證字號：{success.id_number_masked}</p>}
          <ul>
            <li>✓ 承攬夥伴申請已核准</li>
            <li>✓ 創百業會員已建立</li>
            <li>✓ 會員經營功能已連結</li>
          </ul>
          {success.activation_url && <a className="btn btn-primary btn-lg" href={success.activation_url}>立即進入承攬夥伴中心</a>}
          {success.contract?.signing_available === false && <p className="partner-guidance-note">您的承攬夥伴資格已核准。正式合作契約目前尚待平台法律版本開放，開放後即可完成簽署。</p>}
        </section>
      )}
      {notice && <p className="partner-message">{notice}</p>}
    </main>
  );
}

export function PartnerActivate() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [profile, setProfile] = useState<any>();
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!token) {
      setMessage("缺少啟用連結。請向管理員索取新的啟用通知。");
      setLoading(false);
      return;
    }
    api("/api/partner/invite/validate", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(setProfile)
      .catch((error) => setMessage(errorText(error)))
      .finally(() => setLoading(false));
  }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      const result = await api("/api/partner/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token }),
      });
      window.location.hash = `#${result.next_url || "/partner/contract"}`;
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>啟用承攬夥伴帳號</h1>
      {loading && <p>正在驗證啟用連結…</p>}
      {profile && (
        <>
          <section className="partner-info">
            <strong>{profile.display_name}</strong>
            <span>
              {profile.legal_name} · {profile.email}
            </span>
            <small>此連結有效至 {formatDate(profile.expires_at)}</small>
          </section>
          <form onSubmit={submit}>
            <p>安全啟用連結驗證完成後，系統會直接建立承攬夥伴 Session；不需要設定密碼。</p>
            <button className="btn btn-primary">立即進入承攬夥伴中心</button>
          </form>
        </>
      )}
      {message && (
        <section className="partner-message">
          <p>{message}</p>
        </section>
      )}
    </main>
  );
}

export function PartnerReferralJoin() {
  const [params] = useSearchParams(),
    referral = params.get("ref") || "";
  const [form, setForm] = useState({
    lead_name: "",
    lead_email: "",
    lead_phone: "",
  });
  const [message, setMessage] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      await api("/api/partner/attribution", {
        method: "POST",
        body: JSON.stringify({ ...form, referral_code: referral }),
      });
      setMessage("已收到您的需求，專屬承攬夥伴將協助您確認。");
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>開始您的 AI 數位推廣</h1>
      <p>留下聯絡方式後，我們會由專屬承攬夥伴協助了解需求。</p>
      <form onSubmit={submit}>
        <label>
          姓名
          <input
            required
            value={form.lead_name}
            onChange={(event) =>
              setForm({ ...form, lead_name: event.target.value })
            }
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.lead_email}
            onChange={(event) =>
              setForm({ ...form, lead_email: event.target.value })
            }
          />
        </label>
        <label>
          手機
          <input
            value={form.lead_phone}
            onChange={(event) =>
              setForm({ ...form, lead_phone: event.target.value })
            }
          />
        </label>
        <button className="btn btn-primary">送出需求</button>
      </form>
      {message && <p className="partner-message">{message}</p>}
    </main>
  );
}

export function PartnerLogin() {
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<any>();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [workflow, setWorkflow] = useState<Workflow>();
  const [notice, setNotice] = useState("");
  const startLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkflow(undefined);
    setNotice("");
    setBusy(true);
    try {
      const result = await api("/api/partner/login/start", {
        method: "POST",
        body: JSON.stringify({ phone }),
      });
      if (result.code === "SESSION_RESTORED") {
        window.location.hash = `#${result.next_url || "/partner/dashboard"}`;
        return;
      }
      if (result.activation_url) {
        setWorkflow(result);
        return;
      }
      setChallenge(result);
      setNotice(result.message || "請完成一次性手機驗證。");
    } catch (error) {
      setWorkflow(workflowFromError(error));
    } finally {
      setBusy(false);
    }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkflow(undefined);
    setBusy(true);
    try {
      const result = await api("/api/partner/login/verify", {
        method: "POST",
        body: JSON.stringify({ challenge_id: challenge.challenge_id, code }),
      });
      window.location.hash = `#${result.next_url || "/partner/dashboard"}`;
    } catch (error) {
      setWorkflow(workflowFromError(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>承攬夥伴登入</h1>
      {!challenge && <form onSubmit={startLogin}>
        <label>
          手機號碼
          <input type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} required />
        </label>
        <button className="btn btn-primary" disabled={busy}>{busy ? "處理中…" : "繼續登入"}</button>
        <small>不需要密碼，使用申請時登記的手機即可登入。</small>
      </form>}
      {challenge && <form onSubmit={verify}>
        <label>
          輸入驗證碼
          <input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} placeholder="_ _ _ _ _ _" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
        </label>
        {challenge.verification_method === "staging_otp" && <p className="partner-message"><strong>測試環境驗證碼：{challenge.staging_code}</strong></p>}
        {!challenge.verification_available && <p className="partner-message">正式手機驗證服務尚未開放；新裝置不會繞過驗證。</p>}
        <button className="btn btn-primary" disabled={busy || !challenge.verification_available}>{busy ? "驗證中…" : "確認並登入"}</button>
        <button className="btn btn-outline" type="button" disabled={busy} onClick={() => { setChallenge(undefined); setCode(""); setNotice(""); }}>重新發送</button>
      </form>}
      {workflow?.message && (
        <section
          className={`partner-workflow-card state-${workflow.state || "error"}`}
        >
          <strong>{workflow.message}</strong>
          <WorkflowActions workflow={workflow} />
          <Link to="/partner/apply">尚未申請？前往承攬夥伴合作申請</Link>
        </section>
      )}
      {notice && <p className="partner-message">{notice}</p>}
    </main>
  );
}

export function PartnerDashboard() {
  const [data, setData] = useState<any>();
  const [message, setMessage] = useState("");
  const load = () =>
    api("/api/partner/dashboard")
      .then(setData)
      .catch((error) => setMessage(errorText(error)));
  useEffect(() => {
    void load();
  }, []);
  const download = async () => {
    if (!data?.contract?.signature_id) return;
    try {
      await downloadContractPdf(
        data.contract.signature_id,
        `創百業智慧鏈_承攬夥伴合作契約_${data.contract.version || "已簽署"}.pdf`,
      );
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  if (message && !data)
    return (
      <main className="partner-shell">
        <section className="partner-message">
          <p>{message}</p>
          <Link className="btn btn-primary" to="/partner/login">
            前往承攬夥伴登入
          </Link>
        </section>
      </main>
    );
  if (!data) return <main className="partner-shell">載入中…</main>;
  const referral = `https://baiyeconnect.com/#/join?ref=${data.partner.referral_code}`;
  const vipPercent = data.vip
    ? Math.min(
        100,
        Math.round(
          (Number(data.vip.valid_new_merchants || 0) /
            Number(data.vip.target_merchants || 1000)) *
            100,
        ),
      )
    : 0;
  return (
    <main className="partner-shell">
      <h1>{data.partner.display_name} 的承攬夥伴儀表板</h1>
      {data.contract?.signed ? (
        <section className="partner-status success">
          <strong>承攬夥伴合作契約已簽署</strong>
          <span>
            {data.contract.version} · {formatDate(data.contract.signed_at)}
          </span>
          {data.contract.period && <span>目前契約期間：{formatDateOnly(data.contract.period.period_start)} ～ {formatDateOnly(data.contract.period.period_end)}（三個月一期）</span>}
          {data.contract.period && <span>狀態：{data.contract.period.status === "active" ? "有效" : data.contract.period.status === "expiring" ? "即將到期" : data.contract.period.status === "renewal_required" ? "待續約" : "已到期"} · 剩餘 {Math.max(0, Number(data.contract.period.remaining_days || 0))} 天</span>}
          <button className="btn btn-outline btn-sm" onClick={download}>
            下載契約檔案
          </button>
        </section>
      ) : (
        <section className="partner-status warning">
          <strong>您尚未完成目前有效的承攬夥伴合作契約簽署</strong>
          <span>完成簽署後，您可保留完整且可查驗的電子契約與 PDF。</span>
          <Link className="btn btn-primary btn-sm" to="/partner/contract">
            立即簽署承攬夥伴合作契約
          </Link>
        </section>
      )}
      {data.operation_locked && (
        <section className="partner-status warning">
          <strong>承攬營運功能已鎖定</strong>
          <span>{data.operation_lock_code === "PARTNER_CONTRACT_RENEWAL_REQUIRED" ? "本期契約已到期；完成下一期契約後，才可建立新的推薦歸因、成交獎勵與 Payout 申請。" : "完成目前有效且已通過法律審閱之契約簽署後，才可建立正式推薦歸因、成交獎勵與結算。"}</span>
        </section>
      )}
      {data.partner.identity_completion_required && <section className="partner-status warning"><strong>新版契約身分資料待補充</strong><span>請補充身分證字號以完成新版契約資料；您仍可查看 Dashboard 與既有歷史資料。</span><Link className="btn btn-primary btn-sm" to="/partner/contract">前往補充資料</Link></section>}
      {data.partner.id_number_masked && <section className="partner-status"><strong>承攬夥伴身分資料</strong><span>身分證字號：{data.partner.id_number_masked}</span></section>}
      <section className="partner-cards">
        {[
          ["累計有效成交", data.partner.total_valid_sales],
          ["歷史身份等級", data.identity_level],
          ["本月單件獎勵", money(data.current_tier)],
          ["每月資格條件", `${data.monthly_requirement} 件`],
          ["可結算獎勵", money(data.commissions.payable)],
        ].map(([label, value]) => (
          <article key={String(label)}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      {data.previous_month_qualification && (
        <section className="partner-status">
          <strong>
            前一完整曆月資格：
            {data.previous_month_qualification.result === "met"
              ? "已達成"
              : data.previous_month_qualification.result === "grace"
                ? "寬限期／尚未開始完整月考核"
                : "未達成"}
          </strong>
          <span>
            實際 {data.previous_month_qualification.actual_sales} 件／最低{" "}
            {data.previous_month_qualification.required_sales}{" "}
            件。進階以上未達時，本月單件獎勵暫降一階；身份等級不變。
          </span>
        </section>
      )}
      {data.vip && (
        <section className="partner-status">
          <strong>VIP 百萬推廣大獎｜第 {data.vip.cycle_no} 個三年週期</strong>
          <span>
            {formatDate(data.vip.cycle_start)} ～{" "}
            {formatDate(data.vip.cycle_end)} · 有效新商家{" "}
            {data.vip.valid_new_merchants}／{data.vip.target_merchants}（
            {vipPercent}%）· 獎勵 {money(data.vip.reward_amount)}
          </span>
        </section>
      )}
      {!data.operation_locked && <section className="partner-detail">
        <div>
          <h2>專屬推薦連結</h2>
          <input readOnly value={referral} />
          <button
            className="btn btn-outline"
            onClick={() => void copyText(referral)}
          >
            複製
          </button>
        </div>
        <QRCodeSVG value={referral} size={150} />
      </section>}
      {message && <p className="partner-message">{message}</p>}
    </main>
  );
}

export function PartnerContractPdfViewer() {
  const { signatureId = "" } = useParams();
  const [pdfUrl, setPdfUrl] = useState("");
  const [errorCode, setErrorCode] = useState<"UNAUTHORIZED" | "NOT_FOUND" | "LOAD_FAILED" | "">("");
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let active = true;
    let objectUrl = "";
    setBusy(true);
    setErrorCode("");
    fetchContractPdfBlob(signatureId)
      .then((blob) => {
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setPdfUrl(objectUrl);
      })
      .catch((error) => {
        if (!active) return;
        setErrorCode(error instanceof PartnerContractPdfError ? error.code : "LOAD_FAILED");
      })
      .finally(() => active && setBusy(false));
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [signatureId]);

  const message = errorCode === "UNAUTHORIZED"
    ? "登入已失效，請重新登入承攬夥伴中心。"
    : errorCode === "NOT_FOUND"
      ? "找不到此已簽契約 PDF。"
      : "PDF 暫時無法載入，請稍後再試。";

  return (
    <main className="partner-shell partner-pdf-viewer">
      <div className="partner-pdf-viewer-header">
        <div><p className="partner-eyebrow">私人契約文件</p><h1>契約檔案預覽</h1></div>
        <Link className="btn btn-outline" to="/partner/contract">返回契約頁</Link>
      </div>
      {busy && <section className="partner-status">正在安全載入已簽契約 PDF…</section>}
      {!busy && errorCode && <section className="partner-status warning"><strong>{message}</strong>{errorCode === "UNAUTHORIZED" && <Link className="btn btn-primary btn-sm" to="/partner/login">重新登入</Link>}</section>}
      {pdfUrl && <>
        <object className="partner-pdf-object" data={pdfUrl} type="application/pdf" aria-label="已簽承攬夥伴合作契約 PDF">
          <div className="partner-status warning"><strong>此瀏覽器無法直接預覽 PDF</strong><span>您仍可在新頁面開啟或下載私人文件。</span></div>
        </object>
        <div className="partner-workflow-actions partner-pdf-actions">
          <button className="btn btn-primary" onClick={() => void openContractPdf(signatureId)}>在新頁面開啟</button>
          <button className="btn btn-outline" onClick={() => void downloadContractPdf(signatureId, `創百業智慧鏈_承攬夥伴合作契約_${signatureId}.pdf`)}>下載契約檔案</button>
        </div>
        <p className="partner-guidance-note">若 Android 或 LINE 內建瀏覽器無法直接預覽，請使用上方按鈕開啟已驗證取得的私人 PDF。</p>
      </>}
    </main>
  );
}

export function PartnerContract() {
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>();
  const [name, setName] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [checks, setChecks] = useState([false, false, false, false, false]);
  const [message, setMessage] = useState("");
  const [signature, setSignature] = useState<SignatureValue>({ strokes: [] });
  const [preview, setPreview] = useState<any>();
  const [signed, setSigned] = useState(false);
  const [signing, setSigning] = useState(false);
  const [signSuccess, setSignSuccess] = useState<any>();
  const [redirectSeconds, setRedirectSeconds] = useState(3);
  const signIdempotencyKey = useRef(crypto.randomUUID());
  const identitySectionRef = useRef<HTMLElement>(null);
  const nameSectionRef = useRef<HTMLLabelElement>(null);
  const consentsSectionRef = useRef<HTMLDivElement>(null);
  const signatureSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    api("/api/partner/contract/current")
      .then((result) => {
        setContract(result);
        setName(result?.partner_legal_name || "");
        setSigned(Boolean(result?.signature?.signature_id));
      })
      .catch((error) => setMessage(errorText(error)));
  }, []);

  useEffect(() => {
    if (!signSuccess) return;
    setRedirectSeconds(3);
    const countdown = window.setInterval(
      () => setRedirectSeconds((value) => Math.max(0, value - 1)),
      1000,
    );
    const redirect = window.setTimeout(
      () => navigate("/partner/dashboard", { replace: true }),
      3000,
    );
    return () => {
      window.clearInterval(countdown);
      window.clearTimeout(redirect);
    };
  }, [navigate, signSuccess]);

  const completeIdentity = async () => {
    setMessage("");
    try {
      await api("/api/partner/identity", { method: "POST", body: JSON.stringify({ id_number: identityNumber }) });
      const updated = await api("/api/partner/contract/current");
      if (updated?.identity_completion_required) {
        throw new Error("身分資料尚未完成確認，請重新檢查後再試。");
      }
      setContract(updated);
      setName(updated?.partner_legal_name || name);
      setIdentityNumber("");
      setMessage("身分證字號已安全保存，現在可以繼續新版契約程序。");
    } catch (error) { setMessage(errorText(error)); }
  };

  const signaturePointCount = signature.strokes.reduce(
    (total, stroke) => total + stroke.length,
    0,
  );
  const signatureStrokeCount = signature.strokes.filter(
    (stroke) => stroke.length >= 2,
  ).length;
  const legalNameConfirmed = Boolean(
    name.trim() && name.trim() === contract?.partner_legal_name,
  );
  const signatureReady = signatureStrokeCount >= 2 && signaturePointCount >= 12;

  const showValidation = (text: string, target: { current: HTMLElement | null }) => {
    setMessage(text);
    target.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const validatePartnerContractForm = () => {
    if (contract?.identity_completion_required) {
      showValidation("請先完成身分資料，再進行契約預覽。", identitySectionRef);
      return false;
    }
    if (!legalNameConfirmed) {
      showValidation("請重新輸入與申請資料一致的法定姓名。", nameSectionRef);
      return false;
    }
    if (!checks.every(Boolean)) {
      showValidation(`請完成全部契約確認（目前 ${checks.filter(Boolean).length}/5）。`, consentsSectionRef);
      return false;
    }
    if (!signatureReady) {
      showValidation("請以正楷完成至少 2 筆、共 12 點以上的本人手寫簽名。", signatureSectionRef);
      return false;
    }
    return true;
  };

  const openPreview = async () => {
    setMessage("");
    if (!validatePartnerContractForm()) return;
    try {
      setPreview(await api("/api/partner/contract/sign-preview", { method: "POST", body: JSON.stringify({ legal_name: name, read: checks[0], electronic: checks[1], independent: checks[2], identity: checks[3], block_letter_signature: checks[4], signature }) }));
    } catch (error) { setMessage(errorText(error)); }
  };
  const sign = async () => {
    if (signing || signed) return;
    setMessage("");
    setSigning(true);
    try {
      const result = await api("/api/partner/contract/sign", {
        method: "POST",
        headers: { "idempotency-key": signIdempotencyKey.current },
        body: JSON.stringify({
          legal_name: name,
          read: checks[0],
          electronic: checks[1],
          independent: checks[2],
          identity: checks[3],
          block_letter_signature: checks[4],
          signature,
        }),
      });
      if (!result.signature_id || !result.document_hash || !result.signed_at) {
        setMessage("SIGN_RESULT_INCOMPLETE：簽署結果尚未完整確認，請勿重複簽署並稍後重試。");
        return;
      }
      if (result.member_session?.token) savePlatformMemberToken(result.member_session.token);
      setPreview(undefined);
      setSignature({ strokes: [] });
      setChecks([false, false, false, false, false]);
      setSigned(true);
      setSignSuccess(result);
      signIdempotencyKey.current = crypto.randomUUID();
    } catch (error) {
      setMessage(errorText(error));
      if (error instanceof ApiError) signIdempotencyKey.current = crypto.randomUUID();
    } finally {
      setSigning(false);
    }
  };
  return (
    <main className="partner-shell partner-contract">
      <h1>線上承攬夥伴合作契約</h1>
      {contract && (
        <>
          {contract.legal_review_status !== "approved" && (
            <section className="partner-status warning"><strong>契約法律審閱 Gate 已鎖定</strong><span>此版本目前為 {contract.legal_review_status || "pending_review"}；Production 不可簽署。僅隔離 Staging 可標示測試簽署。</span></section>
          )}
          {signed && !signSuccess ? (
            <section className="partner-status success">
              <strong>此版本已完成簽署</strong>
              <span>契約版本：{contract.signature?.version || contract.version} · 簽署時間：{formatDate(contract.signature?.signed_at)}</span>
              <div className="partner-workflow-actions">
                {contract.signature?.signature_id && <button className="btn btn-outline" type="button" onClick={() => void downloadContractPdf(contract.signature.signature_id, `創百業智慧鏈_承攬夥伴合作契約_${contract.signature.version || contract.version}.pdf`).catch((error) => setMessage(error instanceof PartnerContractPdfError && error.code === "UNAUTHORIZED" ? "登入已失效，請重新登入承攬夥伴中心。" : error instanceof PartnerContractPdfError && error.code === "NOT_FOUND" ? "找不到此已簽契約 PDF。" : "PDF 暫時無法載入，請稍後再試。"))}>下載契約檔案</button>}
                <Link className="btn btn-primary" to="/partner/dashboard">返回承攬夥伴中心</Link>
              </div>
            </section>
          ) : !signed && <>
          <article dangerouslySetInnerHTML={{ __html: contract.content_html }} />
          {contract.identity_completion_required && <section ref={identitySectionRef} className="partner-status warning"><strong>請補充身分證字號以完成新版契約資料</strong><label>身分證字號<input type="text" inputMode="text" autoComplete="off" placeholder="A123456789" value={identityNumber} onChange={(event) => setIdentityNumber(event.target.value.toUpperCase())} /></label><button type="button" className="btn btn-primary" onClick={() => void completeIdentity()}>安全保存身分資料</button><span>完整資料會加密保存；一般畫面、Audit 與公開驗證頁不顯示明文。</span></section>}
          <label ref={nameSectionRef}>
            重新輸入法定姓名
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <div ref={consentsSectionRef}>{[
            "本人已閱讀並理解本承攬夥伴合作契約全部內容。",
            "本人同意使用電子形式完成本契約程序。",
            "本人了解本合作為獨立承攬／居間合作，非僱傭關係。",
            "本人確認以上姓名及身分證字號均為本人真實資料。",
            "本人確認手寫簽名係由本人親自以正楷完成。",
          ].map((text, index) => (
            <label className="partner-consent" key={text}>
              <input
                type="checkbox"
                checked={checks[index]}
                onChange={(event) =>
                  setChecks(
                    checks.map((value, itemIndex) =>
                      itemIndex === index ? event.target.checked : value,
                    ),
                  )
                }
              />
              {text}
            </label>
          ))}</div>
          <section ref={signatureSectionRef} className="partner-block-letter-signature"><h2>本人正楷手寫簽名</h2><p><strong>請以正楷清楚簽寫本人完整姓名，請勿草寫、潦草書寫、只寫英文縮寫、符號或隨意畫記。</strong></p><p>簽署姓名須與上方填寫之法定姓名一致。</p><p className="signature-copy-line">請正楷簽寫：<strong>{contract.partner_legal_name}</strong></p></section>
          <ContractSignatureCanvas onChange={setSignature} minimumPoints={12} minimumStrokes={2} clearLabel="清除重寫" />
          <p className="partner-guidance-note">手寫簽名軌跡與系統紀錄作為線上契約查驗證據；系統不進行筆跡生物辨識，也不宣稱為憑證式數位簽章或政府認證電子簽章。</p>
          <section className="partner-status" aria-label="簽署前確認">
            <strong>簽署前確認</strong>
            <span>{!contract.identity_completion_required ? "✓" : "○"} 身分資料已完成</span>
            <span>{legalNameConfirmed ? "✓" : "○"} 法定姓名已確認</span>
            <span>{checks.every(Boolean) ? "✓" : "○"} 契約確認 {checks.filter(Boolean).length}/5</span>
            <span>{signatureReady ? "✓" : "○"} 手寫簽名已記錄</span>
          </section>
          <button className="btn btn-primary" disabled={signing} onClick={() => void openPreview()}>
            預覽最後確認
          </button>
          {preview && <div className="contract-confirm-dialog" role="dialog" aria-modal="true"><div><h2>簽署前最後確認</h2><dl><dt>契約版本</dt><dd>{preview.version}</dd><dt>甲方</dt><dd>{preview.party_a}</dd><dt>乙方</dt><dd>{preview.party_b}</dd><dt>身分證字號</dt><dd>{preview.id_number_masked}</dd><dt>簽署姓名</dt><dd>{preview.signatory}</dd><dt>合作身份</dt><dd>{preview.relationship}</dd><dt>契約期間</dt><dd>{preview.contract_period?.period_start} ～ {preview.contract_period?.period_end}（三個月一期）</dd><dt>簽署時間</dt><dd>{formatDate(preview.signed_at)}</dd></dl><h3>重要條款摘要</h3><ul>{preview.important_terms?.map((item: string) => <li key={item}>{item}</li>)}</ul><div className="partner-workflow-actions"><button className="btn btn-outline" disabled={signing} onClick={() => setPreview(undefined)}>返回修改</button><button className="btn btn-primary" disabled={signing} onClick={() => void sign()}>{signing ? "簽署處理中…" : "確認簽署"}</button></div></div></div>}
          </>}
          {signSuccess && <div className="contract-confirm-dialog member-welcome-modal" role="dialog" aria-modal="true"><div><div className="member-celebration">🎉</div><h2>契約簽署成功！</h2><p>您的承攬夥伴合作契約已完成線上簽署並保存。</p>{signSuccess.welcome?.show ? <><h3>歡迎成為創百業會員！</h3><p>您的會員資格已建立，可前往會員中心查看資料與消費歷程。</p></> : <p>您的創百業會員資格已連結。</p>}<div className="partner-workflow-actions"><Link className="btn btn-primary" to="/member">前往會員中心</Link><Link className="btn btn-outline" to="/partner/dashboard">返回承攬夥伴中心</Link></div><p className="partner-guidance-note">{redirectSeconds} 秒後自動返回承攬夥伴中心</p></div></div>}
        </>
      )}
      {message && (
        <section className="partner-message">
          <p>{message}</p>
          {message.includes("已簽署") && (
            <Link className="btn btn-primary btn-sm" to="/partner/dashboard">
              返回承攬夥伴儀表板
            </Link>
          )}
        </section>
      )}
    </main>
  );
}

type Partner = {
  id: string;
  partner_code: string;
  legal_name: string;
  display_name: string;
  email: string;
  phone: string;
  company_name?: string;
  tax_id?: string;
  status: string;
  approved_at?: string;
  activated_at?: string;
  contract_status: string;
  contract_signed_at?: string;
  total_valid_sales: number;
  total_sales_amount: number;
  terminated_for_inactivity_at?: string;
  activation_requested_at?: string;
  created_at: string;
};
type VipReward = {
  id: string;
  partner_code: string;
  display_name: string;
  cycle_no: number;
  cycle_start: string;
  cycle_end: string;
  valid_new_merchants: number;
  target_merchants: number;
  reward_amount: number;
  status: string;
  qualified_at?: string;
  approved_at?: string;
  paid_at?: string;
};
const statusLabel = (partner: Partner) =>
  partner.status === "pending_contract"
    ? partner.approved_at
      ? "已核准，等待啟用"
      : "歷史待轉換"
    : {
        active: "已啟用",
        suspended: "已暫停",
        terminated: "已終止",
        rejected: "已拒絕",
      }[partner.status] || partner.status;
export function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [vipRewards, setVipRewards] = useState<VipReward[]>([]);
  const [message, setMessage] = useState("");
  const [showBatchApproval, setShowBatchApproval] = useState(false);
  const [batchInvites, setBatchInvites] = useState<Array<{partner_code:string;activation_url:string;activation_expires_at:string}>>([]);
  const [invite, setInvite] = useState<{
    name: string;
    url: string;
    expires_at: string;
  } | null>(null);
  const load = async () => {
    try {
      const [partnerResult, vipResult] = await Promise.all([
        secureAdminApi("/api/admin/partners"),
        secureAdminApi("/api/admin/vip-rewards"),
      ]);
      setPartners(partnerResult.items);
      setVipRewards(vipResult.items);
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const action = async (partner: Partner, name: string) => {
    setMessage("");
    try {
      const result = await secureAdminApi(
        `/api/admin/partners/${partner.id}`,
        { method: "PATCH", body: JSON.stringify({ action: name }) },
      );
      setMessage(
        `${partner.display_name}：${statusLabel({ ...partner, status: result.status, approved_at: result.approved_at || partner.approved_at })}`,
      );
      await load();
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  const createInvite = async (partner: Partner) => {
    setMessage("");
    try {
      const result = await secureAdminApi(
        `/api/admin/partners/${partner.id}/invite`,
        { method: "POST" },
      );
      setInvite({
        name: partner.display_name,
        url: result.invite_url,
        expires_at: result.expires_at,
      });
      await load();
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  const approveHistorical = async () => {
    setMessage("");
    try {
      const result = await secureAdminApi("/api/admin/partners/auto-approve-pending", { method: "POST", body: JSON.stringify({ confirm: "AUTO_APPROVE_EXISTING_PENDING_APPLICATIONS" }) });
      setBatchInvites(result.approved || []);
      setMessage(`歷史申請轉換完成：${result.approved.length} 筆成功，${result.failed.length} 筆需人工查核。`);
      setShowBatchApproval(false);
      await load();
    } catch (error) { setMessage(errorText(error)); }
  };
  const updateVipReward = async (
    reward: VipReward,
    status: "approved" | "paid" | "cancelled",
  ) => {
    setMessage("");
    try {
      await secureAdminApi(`/api/admin/vip-rewards/${reward.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setMessage(
        `${reward.display_name} 的 VIP 推廣大獎已更新為：${status === "approved" ? "已核准" : status === "paid" ? "已發放" : "已取消"}。`,
      );
      await load();
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-admin">
      <AdminModuleNav current="partners" />
      <header>
        <div>
          <h1>承攬夥伴管理</h1>
          <p>新申請由系統自動核准；啟用、契約、有效成交與終止狀態均保留後端稽核紀錄。</p>
        </div>
      </header>
      {partners.some((partner) => partner.status === "pending_contract" && !partner.approved_at) && (
        <section className="partner-historical-batch">
          <strong>偵測到舊版待轉換申請</strong>
          {!showBatchApproval ? <button className="btn btn-outline btn-sm" onClick={() => setShowBatchApproval(true)}>批次核准歷史待審申請</button> : <div><p>此操作會核准最多 100 筆舊版申請並產生短效啟用邀請，請再次確認。</p><button className="btn btn-primary btn-sm" onClick={() => void approveHistorical()}>確認批次核准</button><button className="btn btn-ghost btn-sm" onClick={() => setShowBatchApproval(false)}>取消</button></div>}
        </section>
      )}
      {message && <p className="partner-message">{message}</p>}
      {invite && (
        <section className="partner-invite">
          <strong>{invite.name} 的啟用邀請已建立</strong>
          <span>有效至 {formatDate(invite.expires_at)}</span>
          <input readOnly value={invite.url} />
          <button
            className="btn btn-primary btn-sm"
            onClick={() => void copyText(invite.url)}
          >
            複製完整啟用網址
          </button>
        </section>
      )}
      {batchInvites.length > 0 && <section className="partner-invite"><strong>歷史申請啟用網址（僅本次顯示）</strong>{batchInvites.map((item) => <div key={item.partner_code}><span>{item.partner_code} · 有效至 {formatDate(item.activation_expires_at)}</span><input readOnly value={item.activation_url} /><button className="btn btn-outline btn-sm" onClick={() => void copyText(item.activation_url)}>複製</button></div>)}</section>}
      <div className="partner-table">
        <div className="partner-table-head">
          <span>承攬夥伴</span>
          <span>聯絡／公司</span>
          <span>申請／狀態</span>
          <span>契約／成交</span>
          <span>操作</span>
        </div>
        {partners.map((partner) => (
          <article key={partner.id}>
            <div>
              <strong>{partner.display_name}</strong>
              <small>
                {partner.partner_code} · 法定姓名：{partner.legal_name}
              </small>
              <small>
                {partner.email} · {partner.phone}
              </small>
            </div>
            <div>
              <span>{partner.company_name || "—"}</span>
              <small>統編：{partner.tax_id || "—"}</small>
            </div>
            <div>
              <span>{formatDate(partner.created_at)}</span>
              <b className={`partner-badge status-${partner.status}`}>
                {statusLabel(partner)}
              </b>
              {partner.activation_requested_at &&
                partner.status === "pending_contract" && (
                  <small className="partner-attention">
                    已要求新的啟用通知：
                    {formatDate(partner.activation_requested_at)}
                  </small>
                )}
              {partner.terminated_for_inactivity_at && (
                <small>
                  資格維持自動終止：
                  {formatDate(partner.terminated_for_inactivity_at)}
                </small>
              )}
            </div>
            <div>
              <span>
                {partner.contract_status === "signed"
                  ? "契約已簽署"
                  : "尚未簽署"}
              </span>
              <small>
                {formatDate(partner.contract_signed_at)} · 有效成交{" "}
                {partner.total_valid_sales} ·{" "}
                {money(partner.total_sales_amount)}
              </small>
            </div>
            <div className="partner-actions">
              {partner.status === "pending_contract" && partner.approved_at && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void createInvite(partner)}
                >
                  產生啟用邀請
                </button>
              )}
              {partner.status === "active" && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => void action(partner, "suspended")}
                >
                  暫停
                </button>
              )}
              {["pending_contract", "active", "suspended"].includes(
                partner.status,
              ) && (
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => void action(partner, "terminated")}
                >
                  終止承攬合作
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      <section className="partner-table">
        <div className="partner-table-head">
          <span>VIP 推廣大獎</span>
          <span>三年週期</span>
          <span>有效新商家</span>
          <span>獎勵／狀態</span>
          <span>審核操作</span>
        </div>
        {vipRewards.map((reward) => (
          <article key={reward.id}>
            <div>
              <strong>{reward.display_name}</strong>
              <small>
                {reward.partner_code} · 第 {reward.cycle_no} 週期
              </small>
            </div>
            <div>
              <span>
                {formatDate(reward.cycle_start)} ～{" "}
                {formatDate(reward.cycle_end)}
              </span>
            </div>
            <div>
              <strong>
                {reward.valid_new_merchants}／{reward.target_merchants}
              </strong>
              <small>僅計入已歸因、全額付款且已核可的有效新商家</small>
            </div>
            <div>
              <strong>{money(reward.reward_amount)}</strong>
              <b className={`partner-badge status-${reward.status}`}>
                {{
                  tracking: "追蹤中",
                  pending_review: "待人工審核",
                  approved: "已核准",
                  paid: "已發放",
                  cancelled: "已取消",
                }[reward.status] || reward.status}
              </b>
            </div>
            <div className="partner-actions">
              {reward.status === "pending_review" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void updateVipReward(reward, "approved")}
                >
                  核准大獎
                </button>
              )}
              {reward.status === "approved" && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void updateVipReward(reward, "paid")}
                >
                  標記已發放
                </button>
              )}
              {["tracking", "pending_review", "approved"].includes(
                reward.status,
              ) && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => void updateVipReward(reward, "cancelled")}
                >
                  取消資格
                </button>
              )}
            </div>
          </article>
        ))}
        {vipRewards.length === 0 && (
          <article>
            <div>
              <strong>目前尚無 VIP 週期紀錄</strong>
              <small>
                承攬夥伴啟用並產生有效成交後，系統會建立三年週期追蹤。
              </small>
            </div>
          </article>
        )}
      </section>
    </main>
  );
}
