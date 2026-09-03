import { ShieldCheck, Storefront } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { merchantOrderingApi, savePlatformMemberToken } from "../qr-ordering-client";

type MerchantChoice = { id: string; name: string };
type LoginResponse = {
  next_url?: string;
  platform_session?: { token?: string };
  merchant_resolution?: {
    requires_selection?: boolean;
    merchants?: MerchantChoice[];
  };
};

export function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [choices, setChoices] = useState<MerchantChoice[]>([]);
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice("");
    try {
      const data = await merchantOrderingApi<LoginResponse>("/api/merchant-auth/phone-login", {
        method: "POST",
        body: JSON.stringify({ phone, verification_code: verificationCode }),
      });
      if (data.platform_session?.token) savePlatformMemberToken(data.platform_session.token);
      if (data.merchant_resolution?.requires_selection) {
        setChoices(data.merchant_resolution.merchants || []);
        return;
      }
      navigate(data.next_url || "/merchant/dashboard", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "目前無法完成管理者驗證。");
    } finally {
      setLoading(false);
    }
  };

  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><Storefront size={48} weight="duotone" /><p>創百業智慧鏈</p><h1>商家管理者登入</h1><p>使用管理者手機與驗證碼登入。系統會依 Merchant Owner 權限自動連結可管理的商家。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>管理者驗證碼<input required type="password" autoComplete="one-time-code" minLength={6} value={verificationCode} onChange={(event) => setVerificationCode(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "安全驗證中…" : "登入商家管理中心"}</button></form><p className="partner-guidance-note"><ShieldCheck weight="fill" /> 驗證由伺服器綁定手機與管理者身份；頁面不會顯示驗證碼。正式簡訊服務尚未啟用時，僅已核准的管理者可使用平台提供的安全驗證碼。</p>{choices.length > 0 && <section aria-label="選擇管理商家"><h2>選擇管理商家</h2>{choices.map((merchant) => <button className="btn btn-outline" key={merchant.id} type="button">{merchant.name}</button>)}</section>}{notice && <div className="partner-message">{notice}</div>}<Link className="btn btn-ghost" to="/">返回首頁</Link></section></main>;
}
