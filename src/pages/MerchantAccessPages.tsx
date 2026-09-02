import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlatformDeviceId, getPlatformMemberToken, merchantOrderingApi, savePlatformMemberToken } from "../qr-ordering-client";
import { downloadMerchantContractPdf } from "../merchant-contract-pdf";

const errorText = (error: unknown) => error instanceof Error ? error.message : "商家服務暫時無法使用，請稍後再試。";
const authHeaders = () => ({ "x-device-id": getPlatformDeviceId(), ...(getPlatformMemberToken() ? { authorization: `Bearer ${getPlatformMemberToken()}` } : {}) });

export function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(""), [consent, setConsent] = useState(false), [loading, setLoading] = useState(false), [result, setResult] = useState<any>(), [notice, setNotice] = useState(""), [seconds, setSeconds] = useState(3);
  useEffect(() => {
    if (!result) return;
    setSeconds(3);
    const redirect = window.setTimeout(() => navigate("/merchant/contract", { replace: true }), 3000);
    const countdown = window.setInterval(() => setSeconds((value) => Math.max(1, value - 1)), 1000);
    return () => { window.clearTimeout(redirect); window.clearInterval(countdown); };
  }, [navigate, result]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (loading) return; setLoading(true); setNotice("");
    try {
      const data: any = await merchantOrderingApi("/api/merchant/register", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone, privacy_consent: consent, consent_version: "merchant-registration-v1" }) });
      if (data.member_session?.token) savePlatformMemberToken(data.member_session.token);
      setResult(data);
    } catch (error: any) { setNotice(error?.code === "MERCHANT_ALREADY_REGISTERED" ? "此手機已有商家帳號，請前往商家登入。" : errorText(error)); }
    finally { setLoading(false); }
  };
  if (result) {
    return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card merchant-success-card"><div className="member-celebration">🎉</div><h1>商家註冊成功！</h1><ul><li>✓ 商家帳號已建立</li><li>✓ 創百業會員已建立</li><li>✓ 會員經營功能已連結</li></ul><p><strong>下一步：完成商家平台服務契約</strong></p><p aria-live="polite">{seconds} 秒後自動前往商家契約</p><div className="partner-workflow-actions"><Link className="btn btn-primary" to="/merchant/contract">立即前往簽約</Link><Link className="btn btn-outline" to="/member">前往會員中心</Link></div></section></main>;
  }
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><p className="partner-eyebrow">AI 智慧網站與百業數位升級平台</p><h1>商家註冊</h1><p>一支手機即可開始建立商家資料與後續服務流程。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="partner-consent"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />我已閱讀並同意會員服務、隱私權說明及商家平台相關條款。</label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "註冊處理中…" : "完成商家註冊"}</button></form><p className="partner-guidance-note">不用設定密碼，使用手機即可註冊與登入。</p>{notice && <div className="partner-message">{notice}{notice.includes("已有商家") && <><br /><Link to="/merchant/login">前往商家登入</Link></>}</div>}<Link to="/merchant/login">已有商家帳號？前往登入</Link></section></main>;
}

export function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState(""), [challenge, setChallenge] = useState<any>(), [code, setCode] = useState(""), [choices, setChoices] = useState<any[]>([]), [merchantId, setMerchantId] = useState(""), [loading, setLoading] = useState(false), [notice, setNotice] = useState("");
  const start = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/start", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone }) }); if (data.code === "SESSION_RESTORED") return navigate("/merchant", { replace: true }); setChallenge(data); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  const verify = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/verify", { method: "POST", headers: authHeaders(), body: JSON.stringify({ challenge_id: challenge.challenge_id, code, ...(merchantId ? { merchant_id: merchantId } : {}) }) }); if (data.code === "MERCHANT_SELECTION_REQUIRED") { setChoices(data.merchants); return; } navigate("/merchant", { replace: true }); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><h1>商家登入</h1>{!challenge ? <form onSubmit={start}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "驗證中…" : "繼續登入"}</button></form> : <form onSubmit={verify}><label>輸入驗證碼<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="_ _ _ _ _ _" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>{challenge.staging_otp && <p className="merchant-staging-otp">測試環境驗證碼：<strong>{challenge.staging_otp}</strong></p>}{choices.length > 0 && <label>選擇商家<select required value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">請選擇</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "登入處理中…" : "確認並登入"}</button><button type="button" className="btn btn-outline" disabled={loading} onClick={() => { setChallenge(undefined); setCode(""); }}>返回</button></form>}<p className="partner-guidance-note">不需要密碼，使用註冊時的手機登入。</p>{notice && <div className="partner-message">{notice}</div>}<Link to="/merchant/register">尚未註冊？手機一鍵註冊商家</Link></section></main>;
}

export function MerchantPortalPage() {
  const [session, setSession] = useState<any>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-auth/session").then(setSession).catch(() => setNotice("請先使用手機登入商家中心。")); }, []);
  const logout = async () => { try { await merchantOrderingApi("/api/merchant-auth/logout", { method: "POST", body: "{}" }); window.location.hash = "#/merchant/login"; } catch (error) { setNotice(errorText(error)); } };
  if (!session) return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><h1>商家中心</h1><p>{notice || "正在載入商家資料…"}</p>{notice && <Link className="btn btn-primary" to="/merchant/login">前往商家登入</Link>}</section></main>;
  const operationLocked = Boolean(session.merchant.operation_locked);
  const signed = session.contract_status === "signed" && session.contract_signature?.id;
  return <main className="partner-shell merchant-portal"><header><p className="partner-eyebrow">商家中心</p><h1>{session.merchant.name}</h1><p>{session.user.phone_masked || "商家 Owner"} · {session.assurance_level}</p></header><section className="merchant-portal-grid"><article><span>契約狀態</span><strong>{signed ? "商家平台服務契約已完成簽署" : "需完成商家平台服務契約"}</strong><p>{signed ? "商家平台服務契約已完成簽署" : "完成契約簽署後，即可啟用商家正式營運功能。"}</p>{signed ? <button className="btn btn-outline" onClick={() => void downloadMerchantContractPdf(session.contract_signature.id, session.contract_signature.public_id).catch((error) => setNotice(errorText(error)))}>下載契約檔案</button> : <Link className="btn btn-outline" to="/merchant/contract">立即前往簽約</Link>}</article><article><span>QR 手機點餐</span><strong>{operationLocked ? "完成契約後開放" : "依商家需求開通"}</strong><p>{operationLocked ? "接單、付款與其他正式營運功能目前鎖定。" : "已開通點餐權限的商家可進入營運看板。"}</p>{operationLocked ? <Link className="btn btn-outline" to="/merchant/contract">完成商家契約</Link> : <Link className="btn btn-outline" to="/merchant-admin/ordering">前往點餐管理</Link>}</article><article><span>平台會員</span><strong>已連結</strong><p>商家 Owner 與平台會員使用同一手機身份核心。</p><Link className="btn btn-outline" to="/member">查看會員與優惠券</Link></article></section><button className="btn btn-outline" onClick={() => void logout()}>登出商家中心</button>{notice && <div className="partner-message">{notice}</div>}</main>;
}
