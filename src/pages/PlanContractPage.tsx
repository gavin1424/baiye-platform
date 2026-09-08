import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ContractSignatureCanvas, hasUsableSignature, type SignatureValue } from "../components/ContractSignatureCanvas";
import { merchantLoginPathForContract } from "../contract-routing";
import { merchantOrderingApi, merchantProtectedResourceState } from "../qr-ordering-client";

const API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");
const errorText = (error: unknown) => error instanceof Error ? error.message : "方案契約服務暫時無法使用。";

async function publicContract(slug: string) {
  const response = await fetch(`${API}/api/public/plan-contracts/${encodeURIComponent(slug)}`, { credentials: "include" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.error || "找不到此方案契約。"), { status: response.status, code: data.code || "" });
  return data;
}

export function PlanContractPage() {
  const { planSlug = "" } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>();
  const [signed, setSigned] = useState<any>();
  const [invalidPlan, setInvalidPlan] = useState(false);
  const [legalName, setLegalName] = useState("");
  const [consents, setConsents] = useState({ read: false, plan_details: false, electronic: false });
  const [signature, setSignature] = useState<SignatureValue>();
  const [preview, setPreview] = useState<any>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const intentKey = `service_plan_contract_intent:${planSlug}`;
  const signingIntent = useRef(sessionStorage.getItem(intentKey) || crypto.randomUUID());
  useEffect(() => {
    sessionStorage.setItem(intentKey, signingIntent.current);
    let active = true;
    setContract(undefined); setSigned(undefined); setInvalidPlan(false); setNotice("");
    void (async () => {
      try {
        await publicContract(planSlug);
        try { await merchantOrderingApi<any>("/api/merchant-auth/session"); }
        catch (error) {
          if (merchantProtectedResourceState(error) === "unauthenticated") {
            if (active) navigate(merchantLoginPathForContract(planSlug), { replace: true });
            return;
          }
          throw error;
        }
        const current = await merchantOrderingApi<any>(`/api/merchant/plan-contracts/${encodeURIComponent(planSlug)}`);
        if (!active) return;
        setContract(current);
        setSigned(current.signature);
      } catch (error) {
        if (!active) return;
        if (Number((error as { status?: number })?.status) === 404) setInvalidPlan(true);
        setNotice(errorText(error));
      }
    })();
    return () => { active = false; };
  }, [navigate, planSlug]);
  const ready = useMemo(() => Boolean(legalName.trim()) && Object.values(consents).every(Boolean) && hasUsableSignature(signature), [consents, legalName, signature]);
  const payload = { ...consents, legal_name: legalName, signature, plan_id: contract?.plan_id, plan_slug: contract?.plan_slug, contract_template_id: contract?.contract_template_id };
  const openPreview = async () => {
    if (!ready || busy) return;
    setBusy(true); setNotice("");
    try { setPreview(await merchantOrderingApi(`/api/merchant/plan-contracts/${encodeURIComponent(planSlug)}/sign-preview`, { method: "POST", body: JSON.stringify(payload) })); }
    catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  };
  const sign = async () => {
    if (!preview || busy) return;
    setBusy(true); setNotice("");
    try {
      const result: any = await merchantOrderingApi(`/api/merchant/plan-contracts/${encodeURIComponent(planSlug)}/sign`, { method: "POST", headers: { "idempotency-key": signingIntent.current }, body: JSON.stringify({ ...payload, final_confirmed: true }) });
      setSigned(result); setPreview(undefined); setNotice("方案合約簽署完成");
    } catch (error) { setNotice(errorText(error)); }
    finally { setBusy(false); }
  };
  const openPdf = async (download: boolean) => {
    const signatureId = signed?.signature_id || signed?.id;
    if (!signatureId) return;
    const viewer = download ? null : window.open("about:blank", "_blank", "noopener");
    setBusy(true);
    try {
      const response = await fetch(`${API}/api/merchant/plan-contracts/signatures/${encodeURIComponent(signatureId)}/pdf?view=${download ? "0" : "1"}`, { credentials: "include" });
      if (!response.ok) throw new Error("無法讀取正式方案契約 PDF。");
      const url = URL.createObjectURL(await response.blob());
      if (viewer) viewer.location.href = url;
      else { const anchor = document.createElement("a"); anchor.href = url; anchor.download = `創百業智慧鏈-${contract.plan.plan_name}-方案合約-${signed.contract_id || signed.public_id}.pdf`; anchor.click(); }
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) { viewer?.close(); setNotice(errorText(error)); }
    finally { setBusy(false); }
  };
  if (!contract) return <main className="partner-shell partner-contract plan-contract-page"><p className="partner-eyebrow">創百業智慧鏈</p><h1>{invalidPlan ? "找不到此方案契約" : "正在載入方案合約"}</h1><p>{notice || "正在確認登入狀態與正式契約…"}</p>{invalidPlan && <Link className="btn btn-primary" to="/pricing">返回方案</Link>}</main>;
  const plan = contract.plan;
  return <main className="partner-shell partner-contract plan-contract-page">
    <style>{"body:has(.partner-contract) .ai-chat{display:none}"}</style>
    <p className="partner-eyebrow">創百業智慧鏈</p>
    <h1>{plan.plan_name} 合作契約</h1>
    <section className="contract-summary-grid plan-contract-summary">
      <article><span>方案費用</span><strong>{plan.plan_price_display}</strong></article>
      <article><span>契約版本</span><strong>{contract.contract_version}</strong></article>
    </section>
    <article className="contract-document" dangerouslySetInnerHTML={{ __html: contract.contract_snapshot }} />
    {signed ? <section className="partner-status success contract-signed-actions"><strong>方案合約簽署完成</strong><span>契約編號：{signed.contract_id || signed.public_id}</span><span>已簽署方案：{plan.plan_name} · {signed.signed_at}</span><div className="partner-workflow-actions"><button className="btn btn-primary" disabled={busy} onClick={() => void openPdf(false)}>查看正式契約</button><button className="btn btn-outline" disabled={busy} onClick={() => void openPdf(true)}>下載已簽署 PDF</button><Link className="btn btn-primary" to={signed.continue_url || `/contact?plan=${encodeURIComponent(contract.plan_id)}`}>繼續完成方案申請</Link></div></section>
      : <section className="plan-contract-signing"><label>法定姓名<input required value={legalName} onChange={(event) => setLegalName(event.target.value)} /></label>{[
        ["read", "本人已閱讀並理解本方案合作契約全部內容。"],
        ["plan_details", "本人確認所選方案、服務內容及費用資訊正確。"],
        ["electronic", "本人同意以電子方式簽署本契約。"],
      ].map(([key,label]) => <label className="partner-consent" key={key}><input type="checkbox" checked={(consents as any)[key]} onChange={(event) => setConsents({ ...consents, [key]: event.target.checked })} />{label}</label>)}<p><strong>手寫電子簽名</strong></p><ContractSignatureCanvas onChange={setSignature} /><button className="btn btn-primary" disabled={!ready || busy} onClick={() => void openPreview()}>{busy ? "處理中…" : "進行最終確認"}</button></section>}
    {preview && <div className="contract-confirm-dialog" role="dialog" aria-modal="true"><div><h2>您即將簽署</h2><dl><dt>方案名稱</dt><dd>{preview.plan_name}</dd><dt>方案費用</dt><dd>{preview.plan_price}</dd><dt>契約版本</dt><dd>{preview.contract_version}</dd><dt>法定姓名</dt><dd>{preview.legal_name}</dd></dl><div className="partner-workflow-actions"><button className="btn btn-outline" disabled={busy} onClick={() => setPreview(undefined)}>返回修改</button><button className="btn btn-primary" disabled={busy} onClick={() => void sign()}>{busy ? "正式簽署中…" : "確認並正式簽署"}</button></div></div></div>}
    {notice && <p className="partner-message">{notice}</p>}
  </main>;
}
