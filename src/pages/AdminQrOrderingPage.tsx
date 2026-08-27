import {
  ArrowClockwise,
  ClipboardText,
  CookingPot,
  DownloadSimple,
  ForkKnife,
  Printer,
  QrCode,
  Receipt,
  Storefront,
  Users,
} from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { adminApi } from "../admin-auth-client";
import { AdminModuleNav } from "../components/AdminModuleNav";
import {
  publicOrderingUrl,
  type OrderingAdminOverview,
  type OrderingOrderStatus,
  type OrderingPurpose,
} from "../qr-ordering-client";

const orderStatusLabels: Record<OrderingOrderStatus, string> = {
  submitted: "已送出",
  accepted: "店家已接單",
  preparing: "製作中",
  ready: "可取餐",
  served: "已送餐",
  completed: "已完成",
  cancelled: "已取消",
};

const purposeLabels: Record<OrderingPurpose, string> = {
  member_order: "加入會員＋點餐",
  member_only: "加入會員",
  dine_in: "內用桌號點餐",
  takeaway: "外帶點餐",
};

function money(minor: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor || 0) / 100);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character] || character));
}

function errorMessage(error: unknown, fallback = "操作失敗，請稍後再試。") {
  return error instanceof Error ? error.message : fallback;
}

function statusTone(status: OrderingOrderStatus) {
  if (status === "cancelled") return "danger";
  if (status === "completed" || status === "served") return "success";
  if (status === "ready") return "accent";
  return "info";
}

type MerchantOption = { id: string; name: string; merchant_code?: string };
type AdminSettingsForm = {
  display_name: string;
  enabled: boolean;
  currency: string;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
  require_member: boolean;
  consent_version: string;
};

const emptySettings: AdminSettingsForm = {
  display_name: "",
  enabled: false,
  currency: "TWD",
  dine_in_enabled: true,
  takeaway_enabled: true,
  require_member: true,
  consent_version: "2026-08-27",
};

function nextOrderActions(status: OrderingOrderStatus) {
  const actions: Record<OrderingOrderStatus, OrderingOrderStatus[]> = {
    submitted: ["accepted", "cancelled"],
    accepted: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served", "completed", "cancelled"],
    served: ["completed"],
    completed: [],
    cancelled: [],
  };
  return actions[status];
}

export function AdminQrOrderingPage() {
  const [merchantId, setMerchantId] = useState("meiling_patchwork");
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [overview, setOverview] = useState<OrderingAdminOverview | null>(null);
  const [settings, setSettings] = useState<AdminSettingsForm>(emptySettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [qrForm, setQrForm] = useState<{ label: string; purpose: OrderingPurpose; table_label: string }>({ label: "", purpose: "member_order", table_label: "" });
  const [categoryForm, setCategoryForm] = useState({ name: "", description: "" });
  const [itemForm, setItemForm] = useState({ category_id: "", name: "", price: "", description: "", image_url: "", sku: "" });

  const request = useCallback(async <T,>(path: string, init: RequestInit = {}) => {
    const join = path.includes("?") ? "&" : "?";
    return adminApi(`${path}${join}merchant_id=${encodeURIComponent(merchantId)}`, init) as Promise<T>;
  }, [merchantId]);

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await request<OrderingAdminOverview>("/api/admin/ordering/overview");
      setOverview(data);
      setSettings(data.settings ? {
        display_name: data.settings.display_name,
        enabled: data.settings.enabled,
        currency: data.settings.currency,
        dine_in_enabled: data.settings.dine_in_enabled,
        takeaway_enabled: data.settings.takeaway_enabled,
        require_member: true,
        consent_version: data.settings.consent_version,
      } : { ...emptySettings, display_name: merchants.find((item) => item.id === merchantId)?.name || "" });
      setItemForm((current) => current.category_id || !data.categories[0] ? current : ({ ...current, category_id: data.categories[0].id }));
    } catch (error) {
      setMessage(errorMessage(error, "讀取掃碼系統失敗。"));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [merchantId, merchants, request]);

  useEffect(() => {
    void adminApi("/api/finance/merchants").then((data) => setMerchants(data.items || [])).catch(() => undefined);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const mutate = async (path: string, init: RequestInit, success: string) => {
    setLoading(true);
    setMessage("");
    try {
      await request(path, init);
      setMessage(success);
      await load();
      return true;
    } catch (error) {
      setMessage(errorMessage(error));
      setLoading(false);
      return false;
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    await mutate("/api/admin/ordering/settings", { method: "PATCH", body: JSON.stringify(settings) }, "掃碼會員與點餐設定已儲存。");
  };

  const createQr = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate("/api/admin/ordering/qrs", { method: "POST", body: JSON.stringify(qrForm) }, "QR Code 已建立。");
    if (ok) setQrForm({ label: "", purpose: "member_order", table_label: "" });
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate("/api/admin/ordering/categories", { method: "POST", body: JSON.stringify(categoryForm) }, "菜單分類已建立。");
    if (ok) setCategoryForm({ name: "", description: "" });
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    const price = Number(itemForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setMessage("請輸入正確的售價。");
      return;
    }
    const ok = await mutate("/api/admin/ordering/items", {
      method: "POST",
      body: JSON.stringify({
        ...itemForm,
        price_minor: Math.round(price * 100),
      }),
    }, "菜單品項已建立。");
    if (ok) setItemForm((current) => ({ ...current, name: "", price: "", description: "", image_url: "", sku: "" }));
  };

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setMessage("掃碼連結已複製。");
    } catch {
      setMessage("瀏覽器無法自動複製，請長按連結複製。");
    }
  };

  const downloadQr = (id: string, label: string) => {
    const element = document.getElementById(`ordering-qr-${id}`);
    if (!(element instanceof SVGElement)) return;
    const source = new XMLSerializer().serializeToString(element);
    const blob = new Blob([source], { type: "image/svg+xml;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${label.replace(/[^\p{L}\p{N}_-]+/gu, "-") || "baiye-qr"}.svg`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  };

  const printQr = (id: string, label: string, url: string) => {
    const element = document.getElementById(`ordering-qr-${id}`);
    if (!(element instanceof SVGElement)) return;
    const popup = window.open("", "_blank", "width=640,height=760");
    if (!popup) {
      setMessage("瀏覽器已阻擋列印視窗，請允許彈出式視窗後重試。");
      return;
    }
    const source = new XMLSerializer().serializeToString(element);
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    popup.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${safeLabel}</title><style>body{font-family:system-ui;text-align:center;padding:40px}svg{width:360px;height:360px}h1{font-size:28px}p{overflow-wrap:anywhere}</style></head><body><h1>${safeLabel}</h1>${source}<p>掃碼加入會員並點餐</p><p>${safeUrl}</p><script>window.onload=()=>window.print()<\/script></body></html>`);
    popup.document.close();
  };

  const categories = overview?.categories || [];
  const menuItems = overview?.items || [];
  const qrs = overview?.qrs || [];
  const orders = overview?.orders || [];

  return (
    <main className="finance-shell ordering-admin-page">
      <AdminModuleNav current="ordering" />
      <header className="finance-hero ordering-admin-hero">
        <div><span className="eyebrow"><QrCode weight="fill"/>掃碼會員與手機點餐</span><h1>QR 點餐營運中心</h1><p>建立商家專屬 QR、桌號、快速會員、菜單與訂單看板。正式上線前請先在測試商家完成驗收。</p></div>
        <div className="ordering-admin-merchant"><label>merchant_id<input list="ordering-merchant-options" value={merchantId} onChange={(event) => setMerchantId(event.target.value.trim())}/></label><datalist id="ordering-merchant-options">{merchants.map((merchant) => <option key={merchant.id} value={merchant.id}>{merchant.name}</option>)}</datalist><button type="button" className="btn btn-outline" onClick={() => void load()} disabled={loading}><ArrowClockwise/>重新整理</button></div>
      </header>

      {message && <div className="container ordering-admin-message" role="status">{message}</div>}
      {loading && <div className="container ordering-admin-loading"><span className="ordering-spinner"/>處理中…</div>}

      <section className="container ordering-admin-summary">
        <article><Users/><span>有效會員</span><strong>{overview?.summary.active_members || 0}</strong></article>
        <article><CookingPot/><span>處理中訂單</span><strong>{overview?.summary.open_orders || 0}</strong></article>
        <article><Receipt/><span>最近訂單</span><strong>{overview?.summary.total_orders || 0}</strong></article>
        <article><QrCode/><span>QR Code</span><strong>{qrs.length}</strong></article>
      </section>

      <section className="container ordering-admin-grid">
        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><Storefront/><div><span>第一步</span><h2>商家系統設定</h2></div></div>
          <form className="ordering-admin-form" onSubmit={saveSettings}>
            <label>商家顯示名稱<input required value={settings.display_name} onChange={(event) => setSettings({ ...settings, display_name: event.target.value })} placeholder="顧客掃碼後看到的名稱"/></label>
            <label>同意書版本<input required value={settings.consent_version} onChange={(event) => setSettings({ ...settings, consent_version: event.target.value })}/></label>
            <div className="ordering-admin-checks"><label><input type="checkbox" checked={settings.enabled} onChange={(event) => setSettings({ ...settings, enabled: event.target.checked })}/>正式開放掃碼</label><label><input type="checkbox" checked={settings.dine_in_enabled} onChange={(event) => setSettings({ ...settings, dine_in_enabled: event.target.checked })}/>開放內用</label><label><input type="checkbox" checked={settings.takeaway_enabled} onChange={(event) => setSettings({ ...settings, takeaway_enabled: event.target.checked })}/>開放外帶</label><label><input type="checkbox" checked={settings.require_member} disabled/>點餐前須加入會員</label></div>
            <button className="btn btn-primary" type="submit" disabled={loading}>儲存設定</button>
          </form>
        </article>

        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><QrCode/><div><span>第二步</span><h2>建立專屬 QR</h2></div></div>
          <form className="ordering-admin-form" onSubmit={createQr}>
            <label>QR 名稱<input required value={qrForm.label} onChange={(event) => setQrForm({ ...qrForm, label: event.target.value })} placeholder="例如：入口會員點餐、A1桌"/></label>
            <label>用途<select value={qrForm.purpose} onChange={(event) => setQrForm({ ...qrForm, purpose: event.target.value as OrderingPurpose })}><option value="member_order">加入會員＋點餐</option><option value="dine_in">內用桌號點餐</option><option value="takeaway">外帶點餐</option><option value="member_only">只加入會員</option></select></label>
            {qrForm.purpose === "dine_in" && <label>桌號<input required value={qrForm.table_label} onChange={(event) => setQrForm({ ...qrForm, table_label: event.target.value })} placeholder="例如 A1、12桌"/></label>}
            <button className="btn btn-primary" type="submit" disabled={loading || !overview?.settings}>建立 QR Code</button>
          </form>
        </article>
      </section>

      <section className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title"><QrCode/><div><span>已建立</span><h2>QR Code 列表</h2></div></div>
        {qrs.length === 0 ? <div className="ordering-admin-empty">尚未建立 QR Code。先儲存商家設定，再建立入口或桌號 QR。</div> : <div className="ordering-qr-grid">{qrs.map((qr) => {
          const url = publicOrderingUrl(qr.code);
          return <article className={`ordering-qr-card ${qr.active ? "" : "is-inactive"}`} key={qr.id}><div className="ordering-qr-canvas"><QRCodeSVG id={`ordering-qr-${qr.id}`} value={url} size={220} level="H" includeMargin title={qr.label}/></div><div className="ordering-qr-card-copy"><span>{purposeLabels[qr.purpose]}</span><h3>{qr.label}</h3>{qr.table_label && <strong>{qr.table_label}</strong>}<p>{url}</p><div className="ordering-qr-actions"><button type="button" onClick={() => void copyText(url)}><ClipboardText/>複製</button><button type="button" onClick={() => downloadQr(qr.id, qr.label)}><DownloadSimple/>下載</button><button type="button" onClick={() => printQr(qr.id, qr.label, url)}><Printer/>列印</button><button type="button" onClick={() => void mutate(`/api/admin/ordering/qrs/${qr.id}`, { method: "PATCH", body: JSON.stringify({ active: !qr.active }) }, qr.active ? "QR 已停用。" : "QR 已啟用。")}>{qr.active ? "停用" : "啟用"}</button></div></div></article>;
        })}</div>}
      </section>

      <section className="container ordering-admin-grid ordering-admin-menu-forms">
        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><ForkKnife/><div><span>第三步</span><h2>新增菜單分類</h2></div></div>
          <form className="ordering-admin-form" onSubmit={createCategory}><label>分類名稱<input required value={categoryForm.name} onChange={(event) => setCategoryForm({ ...categoryForm, name: event.target.value })} placeholder="例如：主餐、飲料"/></label><label>說明<textarea value={categoryForm.description} onChange={(event) => setCategoryForm({ ...categoryForm, description: event.target.value })}/></label><button className="btn btn-primary" type="submit" disabled={loading || !overview?.settings}>新增分類</button></form>
          <div className="ordering-admin-mini-list">{categories.map((category) => <div key={category.id}><span>{category.name}</span><button type="button" onClick={() => void mutate(`/api/admin/ordering/categories/${category.id}`, { method: "PATCH", body: JSON.stringify({ active: !category.active }) }, "分類狀態已更新。")}>{category.active ? "停用" : "啟用"}</button></div>)}</div>
        </article>

        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><CookingPot/><div><span>第四步</span><h2>新增菜單品項</h2></div></div>
          <form className="ordering-admin-form" onSubmit={createItem}><label>分類<select required value={itemForm.category_id} onChange={(event) => setItemForm({ ...itemForm, category_id: event.target.value })}><option value="">請選擇</option>{categories.filter((category) => category.active !== false).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>品項名稱<input required value={itemForm.name} onChange={(event) => setItemForm({ ...itemForm, name: event.target.value })}/></label><label>售價（NT$）<input required min="0" step="1" inputMode="numeric" value={itemForm.price} onChange={(event) => setItemForm({ ...itemForm, price: event.target.value })}/></label><label>SKU（選填）<input value={itemForm.sku} onChange={(event) => setItemForm({ ...itemForm, sku: event.target.value })}/></label><label className="ordering-admin-form-wide">品項說明<textarea value={itemForm.description} onChange={(event) => setItemForm({ ...itemForm, description: event.target.value })}/></label><label className="ordering-admin-form-wide">圖片網址（選填）<input type="url" value={itemForm.image_url} onChange={(event) => setItemForm({ ...itemForm, image_url: event.target.value })}/></label><button className="btn btn-primary ordering-admin-form-wide" type="submit" disabled={loading || categories.length === 0}>新增品項</button></form>
        </article>
      </section>

      <section className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title"><ForkKnife/><div><span>菜單管理</span><h2>目前品項</h2></div></div>
        {menuItems.length === 0 ? <div className="ordering-admin-empty">尚未建立菜單品項。</div> : <div className="ordering-admin-item-list">{menuItems.map((item) => <article key={item.id}>{item.image_url ? <img src={item.image_url} alt="" loading="lazy"/> : <span className="ordering-admin-item-placeholder"><ForkKnife/></span>}<div><span>{categories.find((category) => category.id === item.category_id)?.name || "未分類"}</span><h3>{item.name}</h3><p>{item.description}</p></div><strong>{money(item.price_minor)}</strong><button type="button" className={item.available ? "" : "is-inactive"} onClick={() => void mutate(`/api/admin/ordering/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ available: !item.available }) }, item.available ? "品項已暫停供應。" : "品項已恢復供應。")}>{item.available ? "供應中" : "已停售"}</button></article>)}</div>}
      </section>

      <section className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title"><Receipt/><div><span>即時營運</span><h2>訂單看板</h2></div></div>
        {orders.length === 0 ? <div className="ordering-admin-empty">目前尚無訂單。顧客掃碼加入會員並送單後會顯示在這裡。</div> : <div className="ordering-orders-board">{orders.map((order) => <article className={`ordering-order-admin-card tone-${statusTone(order.status)}`} key={order.order_code}><header><div><span>{order.order_type === "dine_in" ? `內用 ${order.table_label}` : "外帶"}</span><h3>{order.order_code}</h3><small>{new Date(order.created_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}</small></div><div><strong>{money(order.total_minor)}</strong><span>{order.payment_status === "paid" ? "已付款" : "未付款"}</span></div></header><div className="ordering-order-customer"><Users/> {order.customer_name}・{order.phone_masked}</div><ul>{order.items.map((item, index) => <li key={`${order.order_code}-${index}`}><span>{item.name} × {item.quantity}</span><strong>{money(item.line_total_minor)}</strong></li>)}</ul>{order.customer_note && <p className="ordering-order-note">備註：{order.customer_note}</p>}<footer><span className={`ordering-status-pill tone-${statusTone(order.status)}`}>{orderStatusLabels[order.status]}</span><div>{nextOrderActions(order.status).map((status) => <button type="button" key={status} onClick={() => void mutate(`/api/admin/ordering/orders/${order.order_code}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, `訂單已更新為「${orderStatusLabels[status]}」。`)}>{orderStatusLabels[status]}</button>)}{order.payment_status === "unpaid" && <button type="button" onClick={() => void mutate(`/api/admin/ordering/orders/${order.order_code}/status`, { method: "PATCH", body: JSON.stringify({ status: order.status, payment_status: "paid" }) }, "訂單已標記為已付款。")}>標記已付款</button>}</div></footer></article>)}</div>}
      </section>
    </main>
  );
}
