import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { getPlatformDeviceId, getPlatformMemberToken, merchantOrderingApi, savePlatformMemberToken } from "../qr-ordering-client";

const errorText = (error: unknown) => error instanceof Error ? error.message : "商家服務暫時無法使用，請稍後再試。";
const authHeaders = () => ({ "x-device-id": getPlatformDeviceId(), ...(getPlatformMemberToken() ? { authorization: `Bearer ${getPlatformMemberToken()}` } : {}) });

export function MerchantRegisterPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [consent, setConsent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>();
  const [notice, setNotice] = useState("");
  const [seconds, setSeconds] = useState(3);
  useEffect(() => {
    if (!result) return;
    setSeconds(3);
    const redirect = window.setTimeout(() => navigate("/merchant/contract", { replace: true }), 3000);
    const countdown = window.setInterval(() => setSeconds((value) => Math.max(1, value - 1)), 1000);
    return () => { window.clearTimeout(redirect); window.clearInterval(countdown); };
  }, [navigate, result]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice("");
    try {
      const data: any = await merchantOrderingApi("/api/merchant/register", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone, privacy_consent: consent, consent_version: "merchant-registration-v1" }) });
      if (data.member_session?.token) savePlatformMemberToken(data.member_session.token);
      setResult(data);
    } catch (error: any) {
      setNotice(error?.code === "MERCHANT_ALREADY_REGISTERED" ? "此手機已有商家帳號，請前往商家登入。" : errorText(error));
    } finally { setLoading(false); }
  };
  if (result) return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card merchant-success-card"><div className="member-celebration">🎉</div><h1>商家註冊成功！</h1><ul><li>✓ 商家帳號已建立</li><li>✓ 創百業會員已建立</li><li>✓ 會員經營功能已連結</li></ul><p><strong>下一步：完成商家平台服務契約</strong></p><p aria-live="polite">{seconds} 秒後自動前往商家契約</p><Link className="btn btn-primary" to="/merchant/contract">立即前往簽約</Link></section></main>;
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><p className="partner-eyebrow">創百業智慧鏈</p><h1>商家註冊</h1><p>一支手機即可開始建立商家資料與後續服務流程。</p><form onSubmit={submit}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><label className="partner-consent"><input required type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />我已閱讀並同意會員服務、隱私權說明及商家平台相關條款。</label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "註冊處理中…" : "完成商家註冊"}</button></form><p className="partner-guidance-note">不用設定密碼，使用手機即可註冊與登入。</p>{notice && <div className="partner-message">{notice}{notice.includes("已有商家") && <><br /><Link to="/merchant/login">前往商家登入</Link></>}</div>}<Link to="/merchant/login">已有商家帳號？前往登入</Link></section></main>;
}

export function MerchantLoginPage() {
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<any>();
  const [code, setCode] = useState("");
  const [choices, setChoices] = useState<any[]>([]);
  const [merchantId, setMerchantId] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const start = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/start", { method: "POST", headers: authHeaders(), body: JSON.stringify({ phone }) }); if (data.code === "SESSION_RESTORED") return navigate("/merchant/contract", { replace: true }); setChallenge(data); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  const verify = async (event: React.FormEvent) => { event.preventDefault(); if (loading) return; setLoading(true); setNotice(""); try { const data: any = await merchantOrderingApi("/api/merchant-auth/login/verify", { method: "POST", headers: authHeaders(), body: JSON.stringify({ challenge_id: challenge.challenge_id, code, ...(merchantId ? { merchant_id: merchantId } : {}) }) }); if (data.code === "MERCHANT_SELECTION_REQUIRED") { setChoices(data.merchants); return; } navigate("/merchant/contract", { replace: true }); } catch (error) { setNotice(errorText(error)); } finally { setLoading(false); } };
  return <main className="partner-shell merchant-access-shell"><section className="merchant-access-card"><h1>商家登入</h1>{!challenge ? <form onSubmit={start}><label>手機號碼<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="09xxxxxxxx" value={phone} onChange={(event) => setPhone(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "驗證中…" : "繼續登入"}</button></form> : <form onSubmit={verify}><label>輸入驗證碼<input required inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="_ _ _ _ _ _" value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))} /></label>{challenge.staging_otp && <p className="merchant-staging-otp">測試環境驗證碼：<strong>{challenge.staging_otp}</strong></p>}{choices.length > 0 && <label>選擇商家<select required value={merchantId} onChange={(event) => setMerchantId(event.target.value)}><option value="">請選擇</option>{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}<button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "登入處理中…" : "確認並登入"}</button><button type="button" className="btn btn-outline" disabled={loading} onClick={() => { setChallenge(undefined); setCode(""); }}>返回</button></form>}<p className="partner-guidance-note">不需要密碼，使用註冊時的手機登入。</p>{notice && <div className="partner-message">{notice}</div>}<Link to="/merchant/register">尚未註冊？手機一鍵註冊商家</Link></section></main>;
}
