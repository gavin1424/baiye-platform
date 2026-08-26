import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { AdminModuleNav } from "../components/AdminModuleNav";
import { adminApi as secureAdminApi } from "../admin-auth-client";

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
};
const workflowFromError = (error: unknown): Workflow =>
  error instanceof ApiError ? error.data : { message: errorText(error) };

function WorkflowActions({
  workflow,
  email,
  onRequested,
}: {
  workflow: Workflow;
  email: string;
  onRequested?: (message: string) => void;
}) {
  const requestActivation = async () => {
    try {
      const result = await api("/api/partner/activation/request", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      onRequested?.(result.message);
    } catch (error) {
      onRequested?.(errorText(error));
    }
  };
  return (
    <div className="partner-workflow-actions">
      {workflow.state === "active" && (
        <Link className="btn btn-primary btn-sm" to="/partner/login">
          前往承攬夥伴登入
        </Link>
      )}
      {["pending_activation", "invite_expired"].includes(
        workflow.state || "",
      ) && (
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={() => void requestActivation()}
        >
          {workflow.has_valid_invite ? "重新取得啟用通知" : "取得新的啟用通知"}
        </button>
      )}
      {workflow.state === "pending_review" ? (
        <Link className="btn btn-primary btn-sm" to="/partner">
          返回承攬夥伴中心
        </Link>
      ) : (
        <Link className="btn btn-outline btn-sm" to="/partner">
          承攬夥伴中心
        </Link>
      )}
    </div>
  );
}

function PartnerStatusLookup() {
  const [email, setEmail] = useState("");
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
          body: JSON.stringify({ email }),
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
        <p className="partner-eyebrow">已送出申請？</p>
        <h2 id="partner-status-title">查詢申請狀態</h2>
        <p>只顯示申請流程狀態，不會公開姓名、電話、編號或管理資料。</p>
      </div>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? "查詢中…" : "查詢申請狀態"}
        </button>
      </form>
      {workflow?.message && (
        <div
          className={`partner-workflow-card state-${workflow.state || "error"}`}
        >
          <strong>{workflow.message}</strong>
          <WorkflowActions
            workflow={workflow}
            email={email}
            onRequested={setNotice}
          />
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
    display_name: "",
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
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");
    setWorkflow(undefined);
    setNotice("");
    try {
      const result = await api("/api/partner/apply", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setMessage(
        `申請已送出，承攬夥伴編號 ${result.partner_code}。我們會在完成審核後通知您。`,
      );
    } catch (error) {
      const result = workflowFromError(error);
      if (result.state) setWorkflow(result);
      else setMessage(result.message || errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>承攬夥伴合作申請</h1>
      <p>送出後由平台管理員審核；核准後會收到安全啟用連結。</p>
      <form onSubmit={submit}>
        {[
          ["legal_name", "法定姓名"],
          ["display_name", "顯示名稱"],
          ["email", "Email"],
          ["phone", "手機"],
          ["company_name", "公司／行號（選填）"],
          ["tax_id", "統編（選填）"],
          ["note", "承攬／推廣經驗與備註（選填）"],
        ].map(([key, label]) => (
          <label key={key}>
            {label}
            <input
              type={key === "email" ? "email" : "text"}
              required={
                !key.includes("company") &&
                !key.includes("tax") &&
                !key.includes("note")
              }
              value={form[key]}
              onChange={(event) =>
                setForm({ ...form, [key]: event.target.value })
              }
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
          我了解本合作屬獨立承攬／居間合作，非甲方僱員。
        </label>
        <button className="btn btn-primary">送出申請</button>
      </form>
      {workflow?.message && (
        <section className={`partner-workflow-card state-${workflow.state}`}>
          <strong>{workflow.message}</strong>
          <WorkflowActions
            workflow={workflow}
            email={form.email}
            onRequested={setNotice}
          />
        </section>
      )}
      {message && (
        <section className="partner-message">
          <p>{message}</p>
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
    if (password.length < 12) return setMessage("密碼至少需要 12 個字元。");
    if (password !== confirm) return setMessage("兩次輸入的密碼不一致。");
    try {
      await api("/api/partner/accept-invite", {
        method: "POST",
        body: JSON.stringify({ token, password }),
      });
      setMessage(
        "承攬夥伴帳號已成功啟用。請使用您的 Email 與新密碼登入承攬夥伴中心。",
      );
      setProfile(undefined);
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
            <label>
              設定密碼
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
            <label>
              再次確認密碼
              <input
                type="password"
                minLength={12}
                autoComplete="new-password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
              />
            </label>
            <small>密碼至少 12 個字元，請勿與其他服務共用。</small>
            <button className="btn btn-primary">完成啟用</button>
          </form>
        </>
      )}
      {message && (
        <section className="partner-message">
          <p>{message}</p>
          {!profile && message.includes("成功啟用") && (
            <Link className="btn btn-primary btn-sm" to="/partner/login">
              前往承攬夥伴登入
            </Link>
          )}
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [workflow, setWorkflow] = useState<Workflow>();
  const [notice, setNotice] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setWorkflow(undefined);
    setNotice("");
    try {
      await api("/api/partner/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      window.location.hash = "#/partner/dashboard";
    } catch (error) {
      setWorkflow(workflowFromError(error));
    }
  };
  return (
    <main className="partner-shell partner-form">
      <h1>承攬夥伴登入</h1>
      <form onSubmit={submit}>
        <label>
          Email
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>
        <label>
          密碼
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </label>
        <button className="btn btn-primary">登入承攬夥伴中心</button>
      </form>
      {workflow?.message && (
        <section
          className={`partner-workflow-card state-${workflow.state || "error"}`}
        >
          <strong>{workflow.message}</strong>
          <WorkflowActions
            workflow={workflow}
            email={email}
            onRequested={setNotice}
          />
          {workflow.code === "INVALID_CREDENTIALS" && (
            <Link to="/partner/apply">尚未申請？前往承攬夥伴合作申請</Link>
          )}
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
      const response = await fetch(
        `${API}/api/partner/contracts/${data.contract.signature_id}/pdf`,
        { credentials: "include" },
      );
      if (!response.ok) throw new Error((await response.json()).error);
      const url = URL.createObjectURL(await response.blob());
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `已簽承攬夥伴合作契約-${data.contract.version || ""}.pdf`;
      anchor.click();
      URL.revokeObjectURL(url);
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
          <button className="btn btn-outline btn-sm" onClick={download}>
            下載我的已簽契約 PDF
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
      <section className="partner-detail">
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
      </section>
      {message && <p className="partner-message">{message}</p>}
    </main>
  );
}

export function PartnerContract() {
  const [contract, setContract] = useState<any>();
  const [name, setName] = useState("");
  const [checks, setChecks] = useState([false, false, false]);
  const [message, setMessage] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<number[][][]>([]);
  const drawing = useRef(false);
  useEffect(() => {
    api("/api/partner/contract/current")
      .then(setContract)
      .catch((error) => setMessage(errorText(error)));
  }, []);
  const point = (event: React.PointerEvent<HTMLCanvasElement>) => [
    Math.round(event.nativeEvent.offsetX),
    Math.round(event.nativeEvent.offsetY),
  ];
  const sign = async () => {
    setMessage("");
    try {
      const result = await api("/api/partner/contract/sign", {
        method: "POST",
        body: JSON.stringify({
          legal_name: name,
          read: checks[0],
          electronic: checks[1],
          independent: checks[2],
          signature: JSON.stringify({ strokes: strokes.current }),
        }),
      });
      setMessage(
        `承攬夥伴合作契約已簽署並保存私有 PDF。文件雜湊：${result.document_hash}`,
      );
    } catch (error) {
      setMessage(errorText(error));
    }
  };
  return (
    <main className="partner-shell partner-contract">
      <h1>線上承攬夥伴合作契約</h1>
      {contract && (
        <>
          <article
            dangerouslySetInnerHTML={{ __html: contract.content_html }}
          />
          <label>
            重新輸入法定姓名
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {[
            "本人已閱讀並理解本承攬夥伴合作契約全部內容。",
            "本人同意以電子方式簽署本契約。",
            "本人了解本合作為獨立承攬／居間合作，非僱傭關係。",
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
          ))}
          <p>手寫簽名</p>
          <canvas
            ref={canvas}
            width="420"
            height="140"
            onPointerDown={(event) => {
              drawing.current = true;
              strokes.current.push([point(event)]);
              canvas.current?.setPointerCapture(event.pointerId);
            }}
            onPointerMove={(event) => {
              if (!drawing.current) return;
              const current = point(event),
                stroke = strokes.current.at(-1);
              stroke?.push(current);
              const context = canvas.current?.getContext("2d");
              if (stroke && stroke.length > 1) {
                const previous = stroke.at(-2)!;
                context?.beginPath();
                context?.moveTo(previous[0], previous[1]);
                context?.lineTo(current[0], current[1]);
                context?.stroke();
              }
            }}
            onPointerUp={() => {
              drawing.current = false;
            }}
            onPointerCancel={() => {
              drawing.current = false;
            }}
          />
          <button className="btn btn-primary" onClick={sign}>
            確認電子簽署
          </button>
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
      : "待審核"
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
          <p>審核、啟用、契約、有效成交與終止狀態均保留後端稽核紀錄。</p>
        </div>
      </header>
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
              {partner.status === "pending_contract" &&
                !partner.approved_at && (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => void action(partner, "approve")}
                  >
                    核准
                  </button>
                )}
              {partner.status === "pending_contract" && partner.approved_at && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => void createInvite(partner)}
                >
                  產生啟用邀請
                </button>
              )}
              {partner.status === "pending_contract" && (
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => void action(partner, "reject")}
                >
                  拒絕
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
