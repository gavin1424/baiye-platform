import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { getPlatformDeviceId, getPlatformMemberToken, merchantOrderingApi, savePlatformMemberToken } from "../qr-ordering-client";
import { downloadMerchantContractPdf } from "../merchant-contract-pdf";

const errorText = (error: unknown) => {
  if (error instanceof TypeError || (error instanceof Error && error.message === "Failed to fetch")) {
    return "目前無法連線至商家註冊服務，請稍後再試。";
  }
  return error instanceof Error ? error.message : "商家服務暫時無法使用，請稍後再試。";
};
const authHeaders = () => ({ "x-device-id": getPlatformDeviceId(), ...(getPlatformMemberToken() ? { authorization: `Bearer ${getPlatformMemberToken()}` } : {}) });

export function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [search] = useSearchParams();
  const intendedPlan = search.get("plan") || "";
  const [phone, setPhone] = useState(""), [consent, setConsent] = useState(false), [loading, setLoading] = useState(false), [result, setResult] = useState<any>(), [notice, setNotice] = useState(""), [seconds, setSeconds] = useState(3);
  useEffect(() => {
    if (!result) return;
    setSeconds(3);
    const redirect = window.setTimeout(() => navigate("/merchant/select-plan", { replace: true }), 3000);
    const countdown = window.setInterval(() => setSeconds((value) => Math.max(1, value - 1)), 1000);
    return () => { window.clearTimeout(redirect); window.clearInterval(countdown); };
  }, [navigate, result]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setNotice("");
    try {
      const data: any = await merchantOrderingApi("/api/merchant/register", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone, privacy_consent: consent, consent_version: "merchant-registration-v1", ...(intendedPlan ? { intended_plan: intendedPlan } : {}) }) });
      if (data.member_session?.token) savePlatformMemberToken(data.member_session.token);
      setResult(data);
    } catch (error: any) { setNotice(error?.code === "MERCHANT_ALREADY_REGISTERED" ? "此手機已有商家帳號，請前往商家登入。" : errorText(error)); }
    finally { setLoading(false); }
  };
  if (result) {
    return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card merchant-success-card"><div className="member-celebration">🎉</div><h1>商家註冊成功！</h1><ul><li>✓ 商家帳號已建立（NT$0）</li><li>✓ 創百業平台會員已建立</li><li>✓ Merchant Session 已建立</li></ul><p><strong>下一步：選擇商家服務方案</strong></p><p aria-live="polite">{seconds} 秒後自動前往方案選擇</p><div className="partner-workflow-actions"><Link className="btn btn-primary" to="/merchant/select-plan">選擇商家服務方案</Link><Link className="btn btn-outline" to="/member">前往會員中心</Link></div></section></main>;
  }
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><p className="partner-eyebrow">商家帳號免費建立</p><h1>商家免費註冊</h1><p>註冊費用 NT$0。先建立商家帳號與平台會員，註冊成功後再選擇適合的服務方案並確認契約。</p>{intendedPlan && <p className="merchant-intended-plan">已保留您從加入中心選擇的方案意向；最終方案與價格仍由伺服器驗證並由您再次確認。</p>}<form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="partner-consent"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />我已閱讀並同意會員服務、隱私權說明及商家平台相關條款。</label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "註冊處理中…" : "免費註冊商家"}</button></form><p className="partner-guidance-note">不用設定密碼，使用手機即可註冊與登入；不會因註冊自動簽署或收取方案費用。</p>{notice && <div className="partner-message">{notice}{notice.includes("已有商家") && <><br /><Link to="/merchant/login">前往商家登入</Link></>}</div>}<Link to="/merchant/login">已有商家帳號？前往登入</Link></section></main>;
}

export function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(""), [challenge, setChallenge] = useState<any>(), [code, setCode] = useState(""), [choices, setChoices] = useState<any[]>([]), [merchantId, setMerchantId] = useState(""), [loading, setLoading] = useState(false), [notice, setNotice] = useState("");
  const start = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/start", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone }) }); if (data.code === "SESSION_RESTORED") return navigate(data.next_url || "/merchant/dashboard", { replace: true }); if (data.code === "MERCHANT_NOT_FOUND" || !data.challenge_id) { setNotice(data.error || "此手機尚未取得商家管理者權限。"); return; } setChallenge(data); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  const verify = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/verify", { method: "POST", headers: authHeaders(), body: JSON.stringify({ challenge_id: challenge.challenge_id, code, ...(merchantId ? { merchant_id: merchantId } : {}) }) }); if (data.code === "MERCHANT_SELECTION_REQUIRED") { setChoices(data.merchants); return; } if (data.platform_session?.token) savePlatformMemberToken(data.platform_session.token); navigate(data.next_url || "/merchant/dashboard", { replace: true }); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  const beefDemo = import.meta.env.VITE_APP_VARIANT === "beef-noodle-demo";
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card">{beefDemo && <div className="demo-environment-pill">Demo 試用環境</div>}<h1>{beefDemo ? "百工牛肉麵｜手機登入" : "商家登入"}</h1><p>{beefDemo ? "完成 Staging 驗證碼驗證後，將使用正式 Platform Member 與商家管理者權限登入。" : "使用管理者手機完成安全驗證。"}</p>{!challenge ? <form onSubmit={start}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "驗證中…" : "取得驗證碼"}</button></form> : <form onSubmit={verify}><label>輸入驗證碼<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="_ _ _ _ _ _" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>{challenge.staging_otp && <p className="merchant-staging-otp">Staging 驗證碼：<strong>{challenge.staging_otp}</strong></p>}{choices.length > 0 && <label>選擇商家<select required value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">請選擇</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "登入處理中…" : "確認並登入"}</button><button type="button" className="btn btn-outline" disabled={loading} onClick={() => { setChallenge(undefined); setCode(""); }}>返回</button></form>}<p className="partner-guidance-note">不需要密碼；管理權限由已驗證的 Platform Member 與 server-side Merchant Owner Link 決定。</p>{notice && <div className="partner-message">{notice}</div>}{!beefDemo && <Link to="/merchant/register">尚未註冊？手機一鍵註冊商家</Link>}</section></main>;
}

export function MerchantPortalPage() {
  const [session, setSession] = useState<any>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-auth/session").then(setSession).catch(() => setNotice("請先使用手機登入商家中心。")); }, []);
  const logout = async () => { try { await merchantOrderingApi("/api/merchant-auth/logout", { method: "POST", body: "{}" }); window.location.hash = "#/merchant/login"; } catch (error) { setNotice(errorText(error)); } };
  if (!session) return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><h1>商家中心</h1><p>{notice || "正在載入商家資料…"}</p>{notice && <Link className="btn btn-primary" to="/merchant/login">前往商家登入</Link>}</section></main>;
  const operationLocked = Boolean(session.merchant.operation_locked);
  const signed = session.contract_status === "signed" && session.contract_signature?.id;
  const planRequired = session.contract_status === "plan_selection_required";
  return <main className="partner-shell merchant-portal"><header><p className="partner-eyebrow">商家管理中心</p><h1>{session.merchant.name}</h1><p>{session.user.phone_masked || "管理者"} · 管理者</p></header><section className="merchant-portal-grid"><article><span>契約狀態</span><strong>{signed ? "商家平台服務契約已完成簽署" : planRequired ? "尚未選擇商家方案" : "需完成商家平台服務契約"}</strong><p>{signed ? "商家平台服務契約已完成簽署" : planRequired ? "請先確認適合的方案；系統才會建立對應商業條件與待簽契約。" : "完成契約簽署後，即可啟用商家正式營運功能。"}</p>{signed ? <button className="btn btn-outline" onClick={() => void downloadMerchantContractPdf(session.contract_signature.id, session.contract_signature.public_id).catch((error) => setNotice(errorText(error)))}>下載契約檔案</button> : <Link className="btn btn-outline" to={planRequired ? "/merchant/select-plan" : "/merchant/contract"}>{planRequired ? "選擇商家服務方案" : "立即前往簽約"}</Link>}</article><article><span>管理者權限</span><strong>{operationLocked ? "待啟用" : "已啟用"}</strong><p>{operationLocked ? "契約完成前僅能查看狀態與完成簽署。" : "可管理本商家的營運資料。"}</p><Link className="btn btn-outline" to="/merchant/dashboard">進入商家管理中心</Link></article><article><span>平台會員</span><strong>已連結</strong><p>商家管理者與平台會員使用同一手機身份核心。</p><Link className="btn btn-outline" to="/member">查看會員資料</Link></article></section><button className="btn btn-outline" onClick={() => void logout()}>登出商家中心</button>{notice && <div className="partner-message">{notice}</div>}</main>;
}
