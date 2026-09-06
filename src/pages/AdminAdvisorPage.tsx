import { useEffect, useState } from "react";
import { advisorApi } from "../advisor-client";
import { AdminModuleNav } from "../components/AdminModuleNav";

export function AdminAdvisorPage({ section }: { section: string }) {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const endpoint = section === "advisors" ? "/api/admin/advisors" : `/api/admin/advisor-${section}`;
    advisorApi(endpoint).then(setData).catch((reason) => setError(reason.message));
  }, [section]);
  return <main className="admin-page advisor-admin-page">
    <AdminModuleNav current="overview" />
    <header><span className="status-badge status-warning">STAGING ONLY</span><h1>顧問聯盟管理｜{section}</h1><p>申請、內容、預約、評價、契約、分潤與結算皆維持法律及付款 Gate。</p></header>
    {error && <p role="alert">{error}</p>}
    {section === "policies" && data ? <AdvisorPolicyPanel data={data} /> : <pre>{data ? JSON.stringify(data, null, 2) : !error ? "載入中…" : ""}</pre>}
  </main>;
}

function AdvisorPolicyPanel({ data }: { data: any }) {
  const commercial = data.commercial_policies?.[0];
  const commission = data.commission_policies?.find((item: any) => item.version === "advisor_commission_policy_v1_0");
  const cancellation = data.cancellation_policies?.[0];
  const settlement = data.settlement_policies?.[0];
  const contract = data.contract_versions?.find((item: any) => item.version === "advisor_partner_v1_1_draft");
  const terms = data.consumer_terms_versions?.find((item: any) => item.version === "advisor_consumer_service_terms_v1_1_draft");
  const rows = [
    ["Commercial Policy", commercial?.version, commercial?.status, commercial?.legal_review_status, commercial?.finance_review_status, commercial?.accounting_review_status],
    ["Commission Policy", commission?.version, commission?.status, commission?.legal_review_status, commission?.finance_review_status, "pending_review"],
    ["Cancellation Policy", cancellation?.version, cancellation?.status, cancellation?.legal_review_status, "pending_review", "pending_review"],
    ["Settlement Policy", settlement?.version, settlement?.status, settlement?.legal_review_status, settlement?.finance_review_status, settlement?.accounting_review_status],
    ["Provider Fee Policy", commercial?.provider_fee_policy, "DRAFT", "pending_review", "pending_review", "pending_review"],
    ["Tax Policy", `${commercial?.tax_mode} / ${commercial?.withholding_mode}`, "DRAFT", "pending_review", "pending_review", "ACCOUNTING_REVIEW_REQUIRED"],
    ["Customer Relationship Policy", "LEGAL_POLICY_REQUIRED", "DRAFT", "pending_review", "pending_review", "pending_review"],
    ["Contract Version", contract?.version, contract?.is_active ? "ACTIVE" : "DRAFT", contract?.legal_review_status, "pending_review", "pending_review"],
    ["Consumer Terms Version", terms?.version, terms?.is_active ? "ACTIVE" : "DRAFT", terms?.legal_review_status, "pending_review", "pending_review"],
  ];
  return <section className="advisor-policy-admin"><p className="status-badge status-warning">Approval actions disabled in this Staging draft.</p><div className="advisor-policy-grid">{rows.map(([name, version, status, legal, finance, accounting]) => <article key={name}><h2>{name}</h2><strong>{version || "尚未建立"}</strong><dl><div><dt>Status</dt><dd>{status}</dd></div><div><dt>Legal</dt><dd>{legal}</dd></div><div><dt>Finance</dt><dd>{finance}</dd></div><div><dt>Accounting</dt><dd>{accounting}</dd></div></dl></article>)}</div></section>;
}
