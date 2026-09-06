import { useEffect, useState } from "react";
import { advisorApi } from "../advisor-client";
import { AdminModuleNav } from "../components/AdminModuleNav";

export function AdminAdvisorPage({ section }: { section: string }) {
  const [data, setData] = useState<unknown>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const endpoint = section === "advisors" ? "/api/admin/advisors" : `/api/admin/advisor-${section}`;
    advisorApi(endpoint).then(setData).catch((reason) => setError(reason.message));
  }, [section]);
  return <main className="admin-page advisor-admin-page">
    <AdminModuleNav current="overview" />
    <header><span className="status-badge status-warning">STAGING ONLY</span><h1>顧問聯盟管理｜{section}</h1><p>申請、內容、預約、評價、契約、分潤與結算皆維持法律及付款 Gate。</p></header>
    {error && <p role="alert">{error}</p>}
    <pre>{data ? JSON.stringify(data, null, 2) : !error ? "載入中…" : ""}</pre>
  </main>;
}
