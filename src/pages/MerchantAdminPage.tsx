import { useEffect, useMemo, useState, type FormEvent } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { MerchantCmsSection } from "./MerchantCmsPages";

const API_BASE = String(import.meta.env.VITE_PLATFORM_API_URL || "").replace(/\/$/, "");
if (!API_BASE) throw new Error("VITE_PLATFORM_API_URL is required");

const sections = [
  ["dashboard", "營運總覽"], ["site", "網站管理"], ["pages", "頁面"],
  ["navigation", "導覽"], ["media", "媒體"],
  ["domains", "網域與 SEO"], ["security", "帳號與安全"],
] as const;

type Session = { user: { name: string; email: string }; merchant: { id: string; name: string }; permissions: string[]; csrf_token?: string };
type Dashboard = { orders: number; revenue_minor: number; customers: number; products: number; modules?: Record<string, boolean> };

async function api(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init, headers: { "Content-Type": "application/json", ...(init.headers || {}) } });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "REQUEST_FAILED");
  return payload;
}

function money(value = 0) { return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(value / 100); }

export function MerchantAdminPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const section = location.pathname.split("/")[2] || "dashboard";
  const [session, setSession] = useState<Session | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [csrf, setCsrf] = useState("");

  useEffect(() => {
    let live = true;
    api("/api/merchant-auth/session").then((data) => {
      if (!live) return;
      setSession(data);
      setCsrf(data.csrf_token || "");
      return api("/api/commerce/dashboard");
    }).then((data) => live && data && setDashboard(data)).catch(() => live && setSession(null)).finally(() => live && setLoading(false));
    return () => { live = false; };
  }, []);

  const activeLabel = useMemo(() => sections.find(([key]) => key === section)?.[1] || "營運後台", [section]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSubmitting(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const loginResult = await api("/api/merchant-auth/login", { method: "POST", body: JSON.stringify({ merchant_id: data.get("merchant_id"), email: data.get("email"), password: data.get("password") }) });
      const result = await api("/api/merchant-auth/session");
      setSession(result); setCsrf(result.csrf_token || loginResult.csrf_token || "");
      setDashboard(await api("/api/commerce/dashboard"));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "登入失敗"); }
    finally { setSubmitting(false); }
  }

  async function logout() {
    await api("/api/merchant-auth/logout", { method: "POST", headers: { "x-csrf-token": csrf } }).catch(() => undefined);
    setSession(null); setDashboard(null); navigate("/merchant-admin");
  }

  if (loading) return <main className="merchant-admin-shell merchant-state"><span className="merchant-spinner" />正在驗證商家權限...</main>;
  if (!session) return <main className="merchant-login-page"><section className="merchant-login-card"><p className="merchant-eyebrow">創百業智慧鏈</p><h1>商家營運中心</h1><p>使用商家管理帳號登入。權限與資料均由後端驗證。</p><form onSubmit={login}><label>商家代碼<input name="merchant_id" autoComplete="organization" required /></label><label>Email<input name="email" type="email" autoComplete="username" required /></label><label>密碼<input name="password" type="password" autoComplete="current-password" required /></label>{error && <p className="merchant-error" role="alert">{error}</p>}<button disabled={submitting}>{submitting ? "登入中..." : "安全登入"}</button></form><small>忘記密碼或尚未開通，請聯絡平台管理員。</small></section></main>;

  return <main className="merchant-admin-shell">
    <aside className="merchant-admin-nav" aria-label="商家後台導覽"><div className="merchant-brand"><strong>創百業智慧鏈</strong><span>{session.merchant.name}</span></div><nav>{sections.map(([key, label]) => <NavLink key={key} to={`/merchant-admin/${key}`} className={section === key ? "active" : ""}>{label}</NavLink>)}</nav></aside>
    <section className="merchant-admin-main"><header className="merchant-admin-header"><div><p className="merchant-eyebrow">MERCHANT COMMERCE</p><h1>{activeLabel}</h1></div><div className="merchant-user"><span>{session.user.name}</span><button type="button" onClick={logout}>登出</button></div></header>
      {section === "dashboard"
        ? <DashboardView data={dashboard} />
        : ["site","pages","navigation","media","domains"].includes(section)
          ? <MerchantCmsSection section={section} csrf={csrf} permissions={session.permissions||[]} />
          : section === "security"
            ? <MerchantSecurityView session={session} onLogout={logout} />
            : <MerchantCmsSection section="pages" csrf={csrf} permissions={session.permissions||[]} />}
    </section>
  </main>;
}

function DashboardView({ data }: { data: Dashboard | null }) {
  const cards = [["今日訂單", data?.orders || 0], ["本月營收", money(data?.revenue_minor)], ["顧客總數", data?.customers || 0], ["上架商品", data?.products || 0]];
  return <><section className="merchant-kpis">{cards.map(([label, value]) => <article key={label}><span>{label}</span><strong>{value}</strong><small>正式資料即時統計</small></article>)}</section><section className="merchant-panel"><div><p className="merchant-eyebrow">今日重點</p><h2>從商品到履約，一站掌握</h2></div><p>付款、庫存、優惠與訂單由 Worker 統一計算。未取得正式憑證的 Provider 維持停用，不會顯示假交易。</p></section></>;
}

function MerchantSecurityView({ session, onLogout }: { session: Session; onLogout: () => Promise<void> }) {
  return <section className="merchant-panel">
    <p className="merchant-eyebrow">ACCOUNT SECURITY</p>
    <h2>帳號與安全</h2>
    <p>登入 Session、角色與權限均由 Worker 後端驗證；瀏覽器不保存密碼或可偽造的角色資料。</p>
    <dl className="merchant-security-list">
      <div><dt>登入帳號</dt><dd>{session.user.email}</dd></div>
      <div><dt>商家</dt><dd>{session.merchant.name}</dd></div>
      <div><dt>目前權限數</dt><dd>{session.permissions.length}</dd></div>
    </dl>
    <p className="merchant-hint">若需重設密碼或撤銷其他裝置 Session，請聯絡平台管理員進行安全驗證。</p>
    <button type="button" className="merchant-primary" onClick={() => void onLogout()}>登出此裝置</button>
  </section>;
}
