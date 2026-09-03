import { ShieldCheck, Storefront } from "@phosphor-icons/react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { merchantOrderingApi } from "../qr-ordering-client";

type MerchantChoice = { id: string; name: string };
type LoginResponse = { next_url?: string; merchant_resolution?: { requires_selection?: boolean; selection_token?: string; merchants?: MerchantChoice[] } };
const errorText = (error: unknown) => error instanceof Error ? error.message : "目前無法完成商家登入。";

export function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(""), [password, setPassword] = useState("");
  const [choices, setChoices] = useState<MerchantChoice[]>([]), [selectionToken, setSelectionToken] = useState("");
  const [notice, setNotice] = useState(""), [loading, setLoading] = useState(false), [forgot, setForgot] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setNotice("");
    try {
      const data = await merchantOrderingApi<LoginResponse>("/api/merchant-auth/login", { method: "POST", body: JSON.stringify({ phone, password }) });
      if (data.merchant_resolution?.requires_selection) { setChoices(data.merchant_resolution.merchants || []); setSelectionToken(data.merchant_resolution.selection_token || ""); return; }
      navigate(data.next_url || "/merchant/dashboard", { replace: true });
    } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); }
  };
  const choose = async (merchantId: string) => {
    setLoading(true); setNotice("");
    try { const data = await merchantOrderingApi<LoginResponse>("/api/merchant-auth/select", { method: "POST", body: JSON.stringify({ selection_token: selectionToken, merchant_id: merchantId }) }); navigate(data.next_url || "/merchant/dashboard", { replace: true }); }
    catch (error) { setNotice(errorText(error)); } finally { setLoading(false); }
  };
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><Storefront size={48} weight="duotone" /><p>創百業智慧鏈</p><h1>商家管理者登入</h1><p>使用管理者手機號碼與商家登入密碼。系統會依管理者權限安全連結可管理的商家。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>8 位數字密碼<input required type="password" inputMode="numeric" autoComplete="current-password" pattern="[0-9]{8}" minLength={8} maxLength={8} value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "安全登入中…" : "登入商家管理中心"}</button></form><p className="partner-guidance-note"><ShieldCheck weight="fill" /> 密碼只用於商家管理中心，並由伺服器以安全雜湊驗證。</p><button className="btn btn-ghost" type="button" onClick={() => setForgot(true)}>忘記密碼</button>{forgot && <p className="partner-message">請聯絡創百業客服協助完成身分確認後重設密碼。</p>}{choices.length > 0 && <section aria-label="選擇管理商家"><h2>選擇管理商家</h2>{choices.map((merchant) => <button className="btn btn-outline" disabled={loading} key={merchant.id} type="button" onClick={() => void choose(merchant.id)}>{merchant.name}</button>)}</section>}{notice && <div className="partner-message">{notice}</div>}<Link className="btn btn-outline" to="/merchant/register">商家免費註冊</Link><Link className="btn btn-ghost" to="/">返回首頁</Link></section></main>;
}

export function MerchantRegisterPage() {
  const [phone, setPhone] = useState(""), [password, setPassword] = useState(""), [confirm, setConfirm] = useState("");
  const [privacy, setPrivacy] = useState(false), [terms, setTerms] = useState(false), [notice, setNotice] = useState(""), [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setNotice(""); try { const data = await merchantOrderingApi<{ message?: string }>("/api/merchant-auth/register", { method: "POST", body: JSON.stringify({ phone, password, password_confirm: confirm, privacy_consent: privacy, terms_consent: terms }) }); setNotice(data.message || "商家註冊資料已送出。"); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  const numeric = (value: string) => value.replace(/\D/g, "").slice(0, 8);
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><Storefront size={48} weight="duotone" /><h1>商家免費註冊</h1><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label>設定 8 位數字密碼<input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{8}" minLength={8} maxLength={8} value={password} onChange={(event) => setPassword(numeric(event.target.value))} /></label><label>再次確認 8 位數字密碼<input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{8}" minLength={8} maxLength={8} value={confirm} onChange={(event) => setConfirm(numeric(event.target.value))} /></label><label><input required type="checkbox" checked={privacy} onChange={(event) => setPrivacy(event.target.checked)} /> 我同意<Link to="/privacy">隱私權政策</Link></label><label><input required type="checkbox" checked={terms} onChange={(event) => setTerms(event.target.checked)} /> 我同意<Link to="/terms">服務條款</Link></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "送出中…" : "完成商家註冊"}</button></form><p>送出後仍須完成身分、方案、契約與啟用流程，才會取得商家管理權限。</p>{notice && <p className="partner-message">{notice}</p>}<Link className="btn btn-ghost" to="/merchant/login">返回商家登入</Link></section></main>;
}

export function MerchantPasswordSetupPage() {
  const navigate = useNavigate(), [params] = useSearchParams();
  const [password, setPassword] = useState(""), [confirm, setConfirm] = useState(""), [notice, setNotice] = useState(""), [loading, setLoading] = useState(false);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setLoading(true); setNotice(""); try { await merchantOrderingApi("/api/merchant-auth/password/setup", { method: "POST", body: JSON.stringify({ token: params.get("token") || "", password, password_confirm: confirm }) }); navigate("/merchant/login", { replace: true }); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><ShieldCheck size={48} weight="duotone" /><h1>設定商家登入密碼</h1><p>請設定您自己的 8 位數字密碼；連結完成使用後立即失效。</p><form onSubmit={submit}><label>8 位數字密碼<input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{8}" minLength={8} maxLength={8} value={password} onChange={(event) => setPassword(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label><label>再次確認 8 位數字密碼<input required type="password" inputMode="numeric" autoComplete="new-password" pattern="[0-9]{8}" minLength={8} maxLength={8} value={confirm} onChange={(event) => setConfirm(event.target.value.replace(/\D/g, "").slice(0, 8))} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "設定中…" : "設定登入密碼"}</button></form>{notice && <p className="partner-message">{notice}</p>}</section></main>;
}
