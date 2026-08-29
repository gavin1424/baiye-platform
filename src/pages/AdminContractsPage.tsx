import { useEffect, useState } from "react";
import { adminApi } from "../admin-auth-client";
import { AdminModuleNav } from "../components/AdminModuleNav";

const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
const plusMonths = (value: string, months: number) => { const date = new Date(`${value}T00:00:00+08:00`); date.setMonth(date.getMonth() + months); return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(date); };
const errorText = (error: unknown) => error instanceof Error ? error.message : "契約管理服務暫時無法使用。";

export function AdminContractsPage() {
  const [partnerVersions, setPartnerVersions] = useState<any[]>([]);
  const [merchantVersions, setMerchantVersions] = useState<any[]>([]);
  const [signatures, setSignatures] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  const [review, setReview] = useState({ versionId: "", party: "merchant", reference: "", confirmation: false, activate: false });
  const [terms, setTerms] = useState<any>({ merchant_id: "", payment_plan: "upfront_18000", list_price_minor: 3000000, discount_price_minor: 1800000, upfront_amount_minor: 1800000, offset_target_amount_minor: 0, contract_term_months: 24, start_date: today, service_period_end: plusMonths(today,24), renewal_terms: "第三年起續用條件依雙方正式約定與有效報價辦理。", included_services: ["AI 行銷推廣與平台上架","標準規格網站基礎建置","依核准清單啟用 LINE／AI／預約／CRM"], excluded_services: ["客製程式、額外版型及第三方服務另行報價"], attachments: { acceptance: "依正式交付清單逐項驗收", third_party: "依第三方業者核准、費率與服務條件" }, confirm_approved: false });
  const [invite, setInvite] = useState({ merchant_id: "", commercial_terms_id: "", email: "" });
  const [inviteUrl, setInviteUrl] = useState("");
  const load = async () => {
    try {
      const [p,m,s] = await Promise.all([adminApi("/api/admin/partner-contract-versions"), adminApi("/api/admin/merchant-contract-versions"), adminApi("/api/admin/merchant-contracts")]);
      setPartnerVersions(p.items || []); setMerchantVersions(m.items || []); setSignatures(s.items || []);
    } catch (error) { setNotice(errorText(error)); }
  };
  useEffect(() => { void load(); }, []);
  const approve = async () => {
    if (!review.confirmation) return setNotice("請先勾選正式法律審閱確認。");
    const path = review.party === "partner" ? `/api/admin/partner-contract-versions/${review.versionId}/legal-review` : `/api/admin/merchant-contract-versions/${review.versionId}/legal-review`;
    try { await adminApi(path, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify({ confirm_legal_review: true, legal_counsel_reference: review.reference, activate: review.activate }) }); setNotice("法律審閱核准紀錄已保存。"); await load(); }
    catch (error) { setNotice(errorText(error)); }
  };
  const saveTerms = async () => {
    try { const result = await adminApi(`/api/admin/merchants/${terms.merchant_id}/commercial-terms`, { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(terms) }); setInvite({ ...invite, merchant_id: terms.merchant_id, commercial_terms_id: result.id }); setNotice(`商業條件已建立：${result.id}`); }
    catch (error) { setNotice(errorText(error)); }
  };
  const createInvite = async () => {
    try { const result = await adminApi("/api/admin/merchant-contracts/invites", { method: "POST", headers: { "idempotency-key": crypto.randomUUID() }, body: JSON.stringify(invite) }); setInviteUrl(result.invite_url); setNotice("一次性商家啟用邀請已建立。請透過安全通知交付，不要貼入公開紀錄。"); }
    catch (error) { setNotice(errorText(error)); }
  };
  return <main className="admin-page contract-admin"><AdminModuleNav current="contracts" /><header><p>契約與簽署證據</p><h1>雙契約管理</h1><span>法律審閱、商業條件、邀請、簽署與私人文件</span></header>{notice && <div className="partner-message">{notice}</div>}<section className="admin-panel"><h2>Legal Review Gate</h2><p>只有實際取得律師審閱結果的授權管理員可以核准。核准時會鎖定 Content Hash 並寫入 Audit。</p><div className="contract-form-grid"><label>契約類型<select value={review.party} onChange={(e) => setReview({ ...review, party: e.target.value })}><option value="partner">承攬夥伴</option><option value="merchant">商家服務</option></select></label><label>版本 ID<input value={review.versionId} onChange={(e) => setReview({ ...review, versionId: e.target.value })} /></label><label className="contract-form-wide">律師審閱參考<input value={review.reference} onChange={(e) => setReview({ ...review, reference: e.target.value })} /></label><label className="partner-consent"><input type="checkbox" checked={review.confirmation} onChange={(e) => setReview({ ...review, confirmation: e.target.checked })} />我確認此版本已完成正式法律審閱</label><label className="partner-consent"><input type="checkbox" checked={review.activate} onChange={(e) => setReview({ ...review, activate: e.target.checked })} />核准後設為目前有效版本</label></div><button className="btn btn-primary" onClick={() => void approve()}>二次確認並核准</button></section><section className="admin-panel"><h2>版本狀態</h2><div className="contract-version-columns"><div><h3>承攬夥伴</h3>{partnerVersions.map((v) => <article key={v.id}><strong>{v.version} · {v.legal_review_status}</strong><span>{v.id}</span><small>{v.content_hash}</small></article>)}</div><div><h3>商家服務</h3>{merchantVersions.map((v) => <article key={v.id}><strong>{v.version} · {v.legal_review_status}</strong><span>{v.id}</span><small>{v.content_hash}</small></article>)}</div></div></section><section className="admin-panel"><h2>核准商業條件 Snapshot</h2><div className="contract-form-grid"><label>Merchant ID<input value={terms.merchant_id} onChange={(e) => setTerms({ ...terms, merchant_id: e.target.value })} /></label><label>付款方案<select value={terms.payment_plan} onChange={(e) => setTerms({ ...terms, payment_plan: e.target.value, upfront_amount_minor: e.target.value === "upfront_18000" ? 1800000 : 0, offset_target_amount_minor: e.target.value === "sales_offset_18000" ? 1800000 : 0 })}><option value="upfront_18000">一次付清方案</option><option value="sales_offset_18000">銷售抵付方案</option></select></label><label>開始日期<input type="date" value={terms.start_date} onChange={(e) => setTerms({ ...terms, start_date: e.target.value })} /></label><label>服務截止日<input type="date" value={terms.service_period_end} onChange={(e) => setTerms({ ...terms, service_period_end: e.target.value })} /></label><label className="partner-consent contract-form-wide"><input type="checkbox" checked={terms.confirm_approved} onChange={(e) => setTerms({ ...terms, confirm_approved: e.target.checked })} />我確認價格、付款方案、期間及附件內容正確且已核准</label></div><button className="btn btn-primary" onClick={() => void saveTerms()}>建立不可變商業條件</button></section><section className="admin-panel"><h2>商家一次性啟用邀請</h2><div className="contract-form-grid"><label>Merchant ID<input value={invite.merchant_id} onChange={(e) => setInvite({ ...invite, merchant_id: e.target.value })} /></label><label>Commercial Terms ID<input value={invite.commercial_terms_id} onChange={(e) => setInvite({ ...invite, commercial_terms_id: e.target.value })} /></label><label>Email<input type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} /></label></div><button className="btn btn-primary" onClick={() => void createInvite()}>建立 72 小時安全邀請</button>{inviteUrl && <div className="contract-invite-result"><input readOnly value={inviteUrl} /><button className="btn btn-outline" onClick={() => navigator.clipboard.writeText(inviteUrl)}>複製啟用網址</button></div>}</section><section className="admin-panel"><h2>已簽商家契約</h2>{signatures.length ? signatures.map((item) => <article className="contract-list-item" key={item.id}><strong>{item.merchant_name} · {item.version}</strong><span>{item.public_id} · {item.status} · {item.signed_at}</span></article>) : <p>尚無已簽商家契約。</p>}</section></main>;
}
