import { Storefront } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { merchantOrderingApi } from "../qr-ordering-client";
import { AdminQrOrderingPage } from "./AdminQrOrderingPage";

type MerchantSession = {
  user: { id: string; merchant_id: string; email: string; name: string };
  permissions: string[];
};

export function MerchantOrderingPage() {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void merchantOrderingApi<MerchantSession>("/api/merchant-auth/session")
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <main className="ordering-page"><section className="ordering-loading"><span className="ordering-spinner" /><p>正在驗證商家權限…</p></section></main>;
  if (session) {
    if (!session.permissions.includes("ordering.read")) return <main className="ordering-page"><section className="ordering-center-card"><h1>權限不足</h1><p>此帳號沒有 QR 點餐管理權限，請聯絡商家管理者。</p></section></main>;
    return <AdminQrOrderingPage merchantMode fixedMerchantId={session.user.merchant_id} />;
  }
  return <main className="ordering-page"><section className="ordering-center-card ordering-merchant-login"><Storefront size={48} /><h1>商家 QR 點餐管理</h1><p>請先完成安全登入；商家身份與權限由伺服器 Session 驗證。</p><Link className="btn btn-primary" to="/merchant/login">前往商家登入</Link></section></main>;
}
