import { ArrowClockwise, CookingPot } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { useCallback, useEffect, useState } from "react";
import { merchantOrderingApi, type OrderingAdminOverview, type OrderingOrder, type OrderingOrderStatus } from "../qr-ordering-client";

type MerchantSession = { user: { merchant_id: string }; permissions: string[] };
type KdsTab = "new" | "preparing" | "ready";

const tabs: Array<{ id: KdsTab; label: string; statuses: OrderingOrderStatus[] }> = [
  { id: "new", label: "新單", statuses: ["submitted"] },
  { id: "preparing", label: "製作中", statuses: ["accepted", "preparing"] },
  { id: "ready", label: "完成", statuses: ["ready"] },
];

function actionFor(order: OrderingOrder) {
  if (order.status === "submitted") return { status: "accepted" as const, label: "接單" };
  if (order.status === "accepted") return { status: "preparing" as const, label: "開始製作" };
  if (order.status === "preparing") return { status: "ready" as const, label: "完成製作" };
  if (order.status === "ready") return { status: "served" as const, label: "送桌／取餐完成" };
  return null;
}

export function MerchantKitchenDisplayPage() {
  const [session, setSession] = useState<MerchantSession | null>(null);
  const [overview, setOverview] = useState<OrderingAdminOverview | null>(null);
  const [tab, setTab] = useState<KdsTab>("new");
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try {
      const active = session || await merchantOrderingApi<MerchantSession>("/api/merchant-auth/session");
      setSession(active);
      if (!active.permissions.includes("ordering.read")) return;
      const data = await merchantOrderingApi<OrderingAdminOverview>("/api/merchant-admin/ordering/overview");
      setOverview(data);
    } catch {
      setSession(null);
    }
  }, [session]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, document.hidden ? 20_000 : 8_000);
    return () => window.clearInterval(timer);
  }, [load]);

  if (!session) return <main className="ordering-kds-page"><section className="ordering-center-card"><CookingPot size={48} /><h1>出餐看板需要商家登入</h1><p>請先從商家管理入口登入，再開啟出餐看板。</p><Link className="btn btn-primary" to="/merchant/login">前往商家登入</Link></section></main>;
  if (!session.permissions.includes("ordering.read")) return <main className="ordering-kds-page"><section className="ordering-center-card"><h1>權限不足</h1><p>此帳號沒有點餐看板權限。</p></section></main>;

  const current = tabs.find((item) => item.id === tab)!;
  const orders = (overview?.orders || []).filter((order) => current.statuses.includes(order.status));
  const advance = async (order: OrderingOrder) => {
    const action = actionFor(order);
    if (!action) return;
    try {
      await merchantOrderingApi(`/api/merchant-admin/ordering/orders/${encodeURIComponent(order.order_code)}/status`, { method: "PATCH", body: JSON.stringify({ status: action.status }) });
      setMessage(`${order.order_code} 已${action.label}。`);
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "訂單狀態更新失敗。"); }
  };

  return <main className="ordering-kds-page"><header className="ordering-kds-header"><div><p>百工牛肉麵</p><h1>出餐看板</h1></div><div><Link to="/merchant-admin/ordering">返回訂單管理</Link><button className="btn btn-outline" type="button" onClick={() => void load()}><ArrowClockwise /> 重新整理</button></div></header>{message && <p className="ordering-admin-message">{message}</p>}<nav className="ordering-kds-tabs" aria-label="出餐訂單分類">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>{item.label}（{(overview?.orders || []).filter((order) => item.statuses.includes(order.status)).length}）</button>)}</nav>{orders.length ? <section className="ordering-kds-grid">{orders.map((order) => { const action = actionFor(order); return <article className="ordering-kds-card" key={order.order_code}><header><div><span>{order.order_type === "dine_in" ? order.table_label : "外帶"}</span><h2>{order.order_code}</h2></div><time>{new Date(order.created_at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Taipei" })}</time></header><ul>{order.items.map((item, index) => <li key={`${order.order_code}-${index}`}>{item.name} × {item.quantity}{(item.options || []).map((option) => <small key={`${option.group_name}-${option.value_name}`}>{option.value_name}</small>)}{item.note && <small>備註：{item.note}</small>}</li>)}</ul>{order.customer_note && <strong>整單備註：{order.customer_note}</strong>}{action && <button type="button" onClick={() => void advance(order)}>{action.label}</button>}</article>; })}</section> : <section className="ordering-kds-empty">目前沒有「{current.label}」訂單。</section>}</main>;
}
