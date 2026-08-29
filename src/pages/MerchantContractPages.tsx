import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { merchantOrderingApi } from "../qr-ordering-client";
import { ContractSignatureCanvas, type SignatureValue } from "../components/ContractSignatureCanvas";

const API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");
const money = (minor: number) => new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(Number(minor || 0) / 100);
const message = (error: unknown) => error instanceof Error ? error.message : "契約服務暫時無法使用。";

async function publicApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, { ...init, headers: { ...(init.body ? { "content-type": "application/json" } : {}), ...(init.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "契約服務暫時無法使用。");
  return data;
}

export function MerchantContractActivate() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState<any>();
  const [form, setForm] = useState({ display_name: "", password: "", password_confirm: "" });
  const [notice, setNotice] = useState("");
  useEffect(() => { void publicApi("/api/merchant/contracts/invite/validate", { method: "POST", body: JSON.stringify({ token }) }).then(setInvite).catch((error) => setNotice(message(error))); }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setNotice("");
    try {
      await publicApi("/api/merchant/contracts/accept-invite", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ token, ...form }) });
      setNotice("商家 Owner 帳號已建立。請使用商家後台登入後完成服務契約簽署。");
    } catch (error) { setNotice(message(error)); }
  };
  return <main className="partner-shell contract-shell"><h1>啟用商家 Owner 帳號</h1>{invite && <section className="contract-summary-card"><strong>{invite.merchant_name}</strong><span>{invite.email}</span><span>{invite.plan_name} · {money(invite.discount_price_minor)}</span></section>}<form className="partner-form" onSubmit={submit}><label>簽署人顯示名稱<input required value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} /></label><label>設定密碼（至少 12 字元）<input required type="password" minLength={12} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><label>再次確認密碼<input required type="password" minLength={12} autoComplete="new-password" value={form.password_confirm} onChange={(event) => setForm({ ...form, password_confirm: event.target.value })} /></label><button className="btn btn-primary">建立帳號</button></form>{notice && <div className="partner-message">{notice}</div>}<Link to="/merchant/contract">前往商家契約</Link></main>;
}

export function MerchantContractPage() {
  const [context, setContext] = useState<any>();
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<any>();
  const [form, setForm] = useState({ signatory_legal_name: "", signatory_role: "legal_representative", legal_representative_name: "", tax_id: "", authorization_confirmed: false, read: false, electronic: false, commercial_terms: false, authority: false, signature_evidence: false });
  const [signature, setSignature] = useState<SignatureValue>({ strokes: [] });
  const load = () => merchantOrderingApi<any>("/api/merchant/contracts/current").then(setContext).catch((error) => setNotice(message(error)));
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-auth/session").then(() => load()).catch(() => setNotice("請先登入商家後台，再進行契約簽署。")); }, []);
  const previewSign = async () => {
    setNotice("");
    try { setPreview(await merchantOrderingApi("/api/merchant/contracts/sign-preview", { method: "POST", body: JSON.stringify(form) })); }
    catch (error) { setNotice(message(error)); }
  };
  const sign = async () => {
    setNotice("");
    try {
      const result: any = await merchantOrderingApi("/api/merchant/contracts/sign", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ ...form, signature }) });
      setNotice(`商家平台服務契約已完成簽署。文件識別碼：${result.public_id}`); setPreview(undefined); await load();
    } catch (error) { setNotice(message(error)); }
  };
  if (!context) return <main className="partner-shell contract-shell"><h1>商家平台服務契約</h1><p>{notice || "正在驗證商家帳號與契約狀態…"}</p></main>;
  if (context.signed) return <main className="partner-shell contract-shell"><h1>商家平台服務契約已簽署</h1><p>版本 {context.contract.version} · {context.signature.signed_at}</p><Link className="btn btn-primary" to="/merchant/contracts">查看與下載歷史契約</Link></main>;
  return <main className="partner-shell contract-shell"><p className="partner-eyebrow">線上契約簽署</p><h1>創百業智慧鏈｜商家平台服務契約</h1><section className="contract-summary-grid"><article><span>商家</span><strong>{context.merchant.name}</strong></article><article><span>方案</span><strong>{context.terms.plan_name}</strong></article><article><span>總價</span><strong>{money(context.terms.discount_price_minor)}</strong></article><article><span>付款方式</span><strong>{context.terms.payment_plan === "upfront_18000" ? "一次付清方案" : "銷售抵付方案"}</strong></article><article><span>服務期間</span><strong>{context.terms.start_date} ～ {context.terms.service_period_end}</strong></article><article><span>契約版本</span><strong>{context.contract.version}</strong></article></section><article className="contract-document" dangerouslySetInnerHTML={{ __html: context.contract.content_html }} /><div className="contract-form-grid"><label>簽署人法定姓名<input required value={form.signatory_legal_name} onChange={(event) => setForm({ ...form, signatory_legal_name: event.target.value })} /></label><label>簽署身份<select value={form.signatory_role} onChange={(event) => setForm({ ...form, signatory_role: event.target.value })}><option value="legal_representative">法定代表人</option><option value="authorized_representative">受授權代表</option></select></label><label>法定代表人姓名<input required value={form.legal_representative_name} onChange={(event) => setForm({ ...form, legal_representative_name: event.target.value })} /></label><label>統編（如適用）<input value={form.tax_id} onChange={(event) => setForm({ ...form, tax_id: event.target.value })} /></label></div>{form.signatory_role === "authorized_representative" && <label className="partner-consent"><input type="checkbox" checked={form.authorization_confirmed} onChange={(event) => setForm({ ...form, authorization_confirmed: event.target.checked })} />本人確認已取得代表商家簽署本契約之合法授權。</label>}{[["read","本人已完整閱讀本契約及所有附件。"],["electronic","本人同意使用電子形式完成本次契約程序。"],["commercial_terms","本人確認上述商家資料與商業條件正確。"],["authority","本人為商家法定代表人，或已取得合法簽約授權。"],["signature_evidence","本人了解手寫簽名軌跡及系統簽署紀錄將作為本次線上契約之查驗證據。"]].map(([key,label]) => <label key={key} className="partner-consent"><input type="checkbox" checked={(form as any)[key]} onChange={(event) => setForm({ ...form, [key]: event.target.checked })} />{label}</label>)}<p><strong>手寫簽署證據</strong></p><ContractSignatureCanvas onChange={setSignature} /><button className="btn btn-primary" onClick={() => void previewSign()}>預覽最後確認</button>{preview && <div className="contract-confirm-dialog" role="dialog" aria-modal="true"><div><h2>簽署前最後確認</h2><dl><dt>契約版本</dt><dd>{preview.version}</dd><dt>商家</dt><dd>{preview.company_name}</dd><dt>簽署人</dt><dd>{preview.signatory}</dd><dt>身份</dt><dd>{preview.signatory_role}</dd><dt>方案</dt><dd>{preview.plan_name}</dd><dt>總價</dt><dd>{money(preview.total_minor)}</dd></dl><p>確認後將建立不可變 PDF 與私人 Evidence JSON。手寫軌跡屬線上簽署證據，不是憑證式數位簽章。</p><div className="partner-workflow-actions"><button className="btn btn-outline" onClick={() => setPreview(undefined)}>返回修改</button><button className="btn btn-primary" onClick={() => void sign()}>確認簽署</button></div></div></div>}{notice && <div className="partner-message">{notice}</div>}</main>;
}

export function MerchantContractsPage() {
  const [items, setItems] = useState<any[]>([]); const [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant/contracts").then((data) => setItems(data.items || [])).catch((error) => setNotice(message(error))); }, []);
  const download = async (id: string, publicId: string) => { const response = await fetch(`${API}/api/merchant/contracts/${id}/pdf`, { credentials: "include" }); if (!response.ok) return setNotice("契約下載失敗。"); const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = `商家平台服務契約-${publicId}.pdf`; a.click(); URL.revokeObjectURL(url); };
  return <main className="partner-shell contract-shell"><h1>我的商家服務契約</h1>{items.length ? items.map((item) => <article className="contract-list-item" key={item.id}><div><strong>{item.title} {item.version}</strong><span>{item.public_id} · {item.signed_at} · {item.status}</span></div><button className="btn btn-outline btn-sm" onClick={() => void download(item.id,item.public_id)}>下載私人 PDF</button></article>) : <p>{notice || "尚無已簽契約。"}</p>}</main>;
}

export function VerifyContractPage() {
  const { publicId = "" } = useParams(); const [data, setData] = useState<any>(); const [notice, setNotice] = useState("");
  useEffect(() => { void publicApi(`/api/contract-verification/${encodeURIComponent(publicId)}`).then(setData).catch((error) => setNotice(message(error))); }, [publicId]);
  const statusClass = useMemo(() => data?.status === "VALID" ? "success" : "warning", [data]);
  return <main className="partner-shell contract-shell"><h1>契約文件驗證</h1>{data ? <section className={`partner-status ${statusClass}`}><strong>{data.status}</strong><dl><dt>文件識別碼</dt><dd>{data.document_id}</dd><dt>契約類型</dt><dd>{data.contract_type}</dd><dt>版本</dt><dd>{data.version}</dd><dt>簽署日期</dt><dd>{data.signed_at}</dd><dt>Document Hash</dt><dd className="contract-hash">{data.document_hash}</dd></dl><p>公開驗證頁不顯示姓名、電話、Email、地址、IP、簽名圖或商業條件。</p></section> : <p>{notice || "驗證中…"}</p>}</main>;
}
