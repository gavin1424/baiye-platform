import { ShieldCheck, Storefront } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { merchantOrderingApi, savePlatformMemberToken } from "../qr-ordering-client";

export function DemoMerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("0900000026");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setNotice("");
    try {
      const data = await merchantOrderingApi<any>("/api/production-demo/login", { method: "POST", body: JSON.stringify({ merchant_id: "demo_beef_noodle", phone, access_code: code }) });
      if (data.platform_session?.token) savePlatformMemberToken(data.platform_session.token);
      navigate(data.next_url || "/merchant/dashboard", { replace: true });
    } catch (error) { setNotice(error instanceof Error ? error.message : "目前無法完成試用驗證。"); }
    finally { setLoading(false); }
  };
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><div className="demo-environment-pill">百工官方示範</div><Storefront size={48} weight="duotone" /><p>百工牛肉麵｜完整功能試用店</p><h1>百工官方示範店試用驗證</h1><p>使用指定試用手機與一次性初始試用碼登入。身份會連結正式 Platform Member 與 Merchant Owner。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>試用驗證碼<input required type="password" autoComplete="one-time-code" minLength={12} value={code} onChange={(event) => setCode(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "安全驗證中…" : "登入完整商家系統"}</button></form><p className="partner-guidance-note"><ShieldCheck weight="fill" /> 驗證由伺服器綁定指定手機、商家與管理者身份；頁面不會顯示驗證碼。</p>{notice && <div className="partner-message">{notice}</div>}<Link className="btn btn-ghost" to="/demo/beef-noodle">返回百工牛肉麵</Link></section></main>;
}
