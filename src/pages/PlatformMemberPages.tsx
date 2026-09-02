import { FormEvent, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { DeviceMobile, ShieldCheck, UserCircle } from "@phosphor-icons/react";
import { getPlatformDeviceId, getPlatformMemberToken, savePlatformMemberToken } from "../qr-ordering-client";

const API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");

async function memberApi<T>(path: string, init: RequestInit = {}) {
  const token = getPlatformMemberToken();
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      "x-device-id": getPlatformDeviceId(),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "會員服務暫時無法使用。"), { code: data.code, status: response.status });
  return data as T;
}

export function PlatformMemberJoinPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const result = await memberApi<any>("/api/members/join", { method: "POST", body: JSON.stringify({ phone, privacy_consent: consent, consent_version: "platform-membership-privacy-v1", device_id: getPlatformDeviceId() }) });
      if (result.session?.token) savePlatformMemberToken(result.session.token);
      window.sessionStorage.setItem("baiye_member_welcome", JSON.stringify({ welcome: result.welcome, member: result.member }));
      navigate(result.new_member ? "/member/welcome" : "/member");
    } catch (error: any) { setMessage(error.message); }
    finally { setBusy(false); }
  }
  return <main className="member-shell"><section className="member-join-card"><div className="member-icon"><DeviceMobile weight="duotone" /></div><p className="partner-eyebrow">手機一鍵會員</p><h1>免費加入創百業會員</h1><p>不用設定密碼、不用下載 App，一支手機即可加入。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="09xxxxxxxx" /></label><label className="member-consent"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>我已閱讀並同意會員服務與<Link to="/privacy">隱私權說明</Link>。</span></label><button className="btn btn-primary btn-lg" disabled={busy}>{busy ? "正在建立會員…" : "免費加入會員"}</button></form>{message && <div className="partner-message">{message}</div>}<div className="member-join-benefits"><span><ShieldCheck />不需密碼</span><span><UserCircle />累積消費與回購紀錄</span></div></section></main>;
}

export function PlatformMemberWelcomePage() {
  const raw = window.sessionStorage.getItem("baiye_member_welcome");
  const data = raw ? JSON.parse(raw) : null;
  useEffect(() => { if (raw) void memberApi("/api/members/welcome/acknowledge", { method: "POST" }).catch(() => undefined); }, [raw]);
  return <main className="member-shell"><section className="member-welcome-card"><div className="member-celebration">🎉</div><h1>歡迎成為創百業會員！</h1><p>會員加入完成，您可以開始使用會員資料與回購服務。</p>{data?.member?.phone_masked && <p className="member-muted">會員手機：{data.member.phone_masked}</p>}<div className="partner-workflow-actions"><Link className="btn btn-primary" to="/member">前往會員中心</Link><Link className="btn btn-outline" to="/businesses">探索創百業商家</Link></div></section></main>;
}

export function PlatformMemberCenterPage() {
  const [data, setData] = useState<any>(null); const [message, setMessage] = useState("");
  useEffect(() => { memberApi<any>("/api/members/me").then((result) => setData(result.member)).catch((error) => setMessage(error.message)); }, []);
  if (message) return <main className="member-shell"><section className="member-join-card"><h1>我的會員</h1><p>{message}</p><Link className="btn btn-primary" to="/member/join">手機加入／驗證會員</Link></section></main>;
  if (!data) return <main className="member-shell"><p>會員資料載入中…</p></main>;
  return <main className="member-shell"><header className="member-center-header"><UserCircle weight="duotone" /><div><p className="partner-eyebrow">我的會員</p><h1>創百業會員中心</h1></div></header><section className="member-summary"><dl><dt>會員編號</dt><dd>{data.member_no}</dd><dt>手機</dt><dd>{data.phone_masked}</dd><dt>加入日期</dt><dd>{new Date(data.joined_at).toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" })}</dd><dt>會員狀態</dt><dd>正常</dd></dl></section><section className="member-links"><article><h3>我的商家會員</h3><p>查看您加入的商家會員與互動紀錄。</p></article><article><h3>我的消費紀錄</h3><p>從各商家 QR 點餐頁查看個人訂單與回購歷程。</p></article><article><h3>會員資料</h3><p>管理選填的暱稱與聯絡資料。</p></article></section></main>;
}
