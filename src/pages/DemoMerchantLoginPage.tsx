import { LockKey, Storefront, UserCircle } from "@phosphor-icons/react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { merchantOrderingApi } from "../qr-ordering-client";

export function DemoMerchantLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState("");
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setNotice("");
    try {
      const result = await merchantOrderingApi<{ next_url: string }>("/api/merchant-demo/login", {
        method: "POST",
        body: JSON.stringify({ username, password }),
        headers: { "x-device-id": "beef-noodle-demo-admin" },
      });
      navigate(result.next_url || "/merchant/dashboard", { replace: true });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "試用登入暫時無法使用。");
    } finally {
      setLoading(false);
    }
  };
  return <main className="demo-merchant-login"><section className="demo-merchant-login-card"><div className="demo-environment-pill">Demo 試用環境</div><Storefront size={48} weight="duotone" /><p>百工牛肉麵</p><h1>商家管理中心</h1><p>使用專屬試用帳號登入。正式商家仍使用手機驗證，不受此入口影響。</p><form onSubmit={submit}><label><span><UserCircle size={20} />試用帳號</span><input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} /></label><label><span><LockKey size={20} />試用密碼</span><input autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} /></label><button className="btn btn-primary btn-lg" disabled={loading}>{loading ? "登入中…" : "登入管理中心"}</button></form>{notice && <p className="partner-message" role="alert">{notice}</p>}<a className="btn btn-ghost" href="#/q/myJghWaqQbCwMInWWsBUf2xRwsR02saT">先查看顧客點餐頁</a></section></main>;
}
