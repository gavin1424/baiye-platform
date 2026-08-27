import { Storefront } from "@phosphor-icons/react";
import { useEffect, useState, type FormEvent } from "react";
import { merchantOrderingApi } from "../qr-ordering-client";
import { AdminQrOrderingPage } from "./AdminQrOrderingPage";

type MerchantSession = {
  user: { id: string; merchant_id: string; email: string; name: string };
  permissions: string[];
};

export function MerchantOrderingPage() {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ merchant_id: "", email: "", password: "" });

  useEffect(() => {
    void merchantOrderingApi<MerchantSession>("/api/merchant-auth/session")
      .then(setSession)
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setMessage("");
    try {
      const data = await merchantOrderingApi<MerchantSession>("/api/merchant-auth/login", { method: "POST", body: JSON.stringify(form) });
      const hydrated = await merchantOrderingApi<MerchantSession>("/api/merchant-auth/session");
      setSession({ ...hydrated, user: hydrated.user || data.user });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "登入失敗。");
    }
  };

  if (!ready) return <main className="ordering-page"><section className="ordering-loading"><span className="ordering-spinner" /><p>正在驗證商家權限…</p></section></main>;
  if (session) {
    if (!session.permissions.includes("ordering.read")) return <main className="ordering-page"><section className="ordering-center-card"><h1>權限不足</h1><p>此帳號沒有 QR 點餐管理權限，請聯絡商家擁有者。</p></section></main>;
    return <AdminQrOrderingPage merchantMode fixedMerchantId={session.user.merchant_id} />;
  }
  return <main className="ordering-page"><section className="ordering-center-card ordering-merchant-login"><Storefront size={48} /><h1>商家 QR 點餐管理</h1><p>使用商家管理帳號登入；商家識別碼與權限由伺服器 Session 驗證。</p>{message && <div className="ordering-message">{message}</div>}<form className="ordering-admin-form" onSubmit={login}><label>商家識別碼<input required autoComplete="organization" value={form.merchant_id} onChange={(event) => setForm({ ...form, merchant_id: event.target.value })} /></label><label>Email<input required type="email" autoComplete="username" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label><label className="ordering-admin-form-wide">密碼<input required type="password" minLength={12} autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></label><button className="btn btn-primary ordering-admin-form-wide" type="submit">登入商家點餐後台</button></form></section></main>;
}
