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
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { adminApi } from "../admin-auth-client";
import { AdminModuleNav } from "../components/AdminModuleNav";
import {
  publicOrderingUrl,
  merchantOrderingApi,
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
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] || character,
  );
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

function MerchantMenuItemEditor({ item, categories, onSave }: { item: any; categories: any[]; onSave: (payload: Record<string, unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState({ category_id: item.category_id || "", name: item.name || "", price: String(Number(item.price_minor || 0) / 100), description: item.description || "", image_url: item.image_url || "", sku: item.sku || "", status: item.status || "active" });
  const [imageFile, setImageFile] = useState<File>();
  const [imagePreview, setImagePreview] = useState(item.image_url || "");
  const [uploadNotice, setUploadNotice] = useState("");
  useEffect(() => () => { if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); }, [imagePreview]);
  const chooseImage = (file?: File) => { setUploadNotice(""); if (!file) return; if (!["image/jpeg","image/png","image/webp"].includes(file.type)) return setUploadNotice("只允許 JPEG、PNG 或 WebP 圖片。"); if (file.size > 5 * 1024 * 1024) return setUploadNotice("圖片大小不可超過 5 MB。"); if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); setImageFile(file); setImagePreview(URL.createObjectURL(file)); };
  const submit = async (event: FormEvent) => { event.preventDefault(); const amount = Number(draft.price); if (!Number.isFinite(amount) || amount < 0) return; setUploadNotice(""); try { let imageUrl = draft.image_url; if (imageFile) { const body = new FormData(); body.append("image", imageFile); const uploaded = await merchantOrderingApi<{ image_url: string }>(`/api/merchant-admin/products/${encodeURIComponent(item.id)}/image`, { method: "POST", body }); imageUrl = uploaded.image_url; setImageFile(undefined); setImagePreview(imageUrl); } await onSave({ ...draft, image_url: imageUrl, price_minor: Math.round(amount * 100) }); setDraft((current) => ({ ...current, image_url: imageUrl })); } catch (error) { setUploadNotice(errorMessage(error)); } };
  return <details className="ordering-item-editor"><summary>編輯商品資料與圖片</summary><form className="ordering-admin-form" onSubmit={submit}><label>分類<select value={draft.category_id} onChange={(event) => setDraft({ ...draft, category_id: event.target.value })}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>商品名稱<input required value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label><label>售價（NT$）<input required min="0" step="1" inputMode="numeric" value={draft.price} onChange={(event) => setDraft({ ...draft, price: event.target.value })} /></label><label>SKU<input value={draft.sku} onChange={(event) => setDraft({ ...draft, sku: event.target.value })} /></label><label className="ordering-admin-form-wide">商品介紹<textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></label><div className="ordering-admin-form-wide ordering-product-image-picker"><strong>商品圖片</strong>{imagePreview ? <img src={imagePreview} alt={`${item.name} 圖片預覽`} /> : <div className="ordering-product-image-empty">尚未設定圖片</div>}<div><label className="btn btn-outline">上傳／更換圖片<input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => chooseImage(event.target.files?.[0])} /></label>{imagePreview && <button type="button" className="btn btn-ghost" onClick={() => { if (imagePreview.startsWith("blob:")) URL.revokeObjectURL(imagePreview); setImageFile(undefined); setImagePreview(""); setDraft((current) => ({ ...current, image_url: "" })); }}>移除</button>}</div><small>手機可選相簿或相機。選取後先預覽，按「儲存商品」才會上傳並同步前台；最大 5 MB。</small>{uploadNotice && <span role="alert">{uploadNotice}</span>}</div><label>銷售狀態<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="active">上架</option><option value="sold_out">售完</option><option value="hidden">下架</option></select></label><button className="btn btn-primary ordering-admin-form-wide">儲存商品</button></form></details>;
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
  ordering_open: boolean;
  accepting_orders: boolean;
  temporary_closed_message: string;
  auto_accept_orders: boolean;
  order_number_prefix: string;
  max_items_per_order: number;
  customer_cancel_before_accept: boolean;
  estimated_prep_minutes: number;
  new_order_sound_enabled: boolean;
  table_session_enabled: boolean;
  show_sold_out_items: boolean;
  last_order_time: string;
  timezone: string;
};

const emptySettings: AdminSettingsForm = {
  display_name: "",
  enabled: false,
  currency: "TWD",
  dine_in_enabled: true,
  takeaway_enabled: true,
  require_member: true,
  consent_version: "2026-08-27",
  ordering_open: true,
  accepting_orders: true,
  temporary_closed_message: "店家目前暫停接單",
  auto_accept_orders: false,
  order_number_prefix: "BY",
  max_items_per_order: 50,
  customer_cancel_before_accept: true,
  estimated_prep_minutes: 20,
  new_order_sound_enabled: true,
  table_session_enabled: true,
  show_sold_out_items: true,
  last_order_time: "",
  timezone: "Asia/Taipei",
};

function nextOrderActions(status: OrderingOrderStatus) {
  const actions: Record<OrderingOrderStatus, OrderingOrderStatus[]> = {
    submitted: ["accepted", "cancelled"],
    accepted: ["preparing", "cancelled"],
    preparing: ["ready", "cancelled"],
    ready: ["served", "cancelled"],
    served: ["completed"],
    completed: [],
    cancelled: [],
  };
  return actions[status];
}

export function AdminQrOrderingPage({
  merchantMode = false,
  fixedMerchantId = "",
}: {
  merchantMode?: boolean;
  fixedMerchantId?: string;
}) {
  const [merchantId, setMerchantId] = useState(
    fixedMerchantId || "meiling_patchwork",
  );
  const [merchants, setMerchants] = useState<MerchantOption[]>([]);
  const [overview, setOverview] = useState<OrderingAdminOverview | null>(null);
  const [settings, setSettings] = useState<AdminSettingsForm>(emptySettings);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [qrForm, setQrForm] = useState<{
    label: string;
    purpose: OrderingPurpose;
    table_label: string;
  }>({ label: "", purpose: "member_order", table_label: "" });
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [itemForm, setItemForm] = useState({
    category_id: "",
    name: "",
    price: "",
    description: "",
    image_url: "",
    sku: "",
  });
  const [batchForm, setBatchForm] = useState({
    prefix: "A",
    start: 1,
    end: 10,
    suffix: "",
  });
  const [optionForm, setOptionForm] = useState({
    name: "",
    selection_type: "single",
    required: true,
    min_select: 1,
    max_select: 1,
  });
  const [optionValueDraft, setOptionValueDraft] = useState<
    Record<string, { name: string; price: string }>
  >({});
  const [itemGroupDraft, setItemGroupDraft] = useState<
    Record<string, string[]>
  >({});
  const [lineForm, setLineForm] = useState({ enabled: false, display_name: "", basic_id: "", add_friend_url: "", integration_mode: "add_friend_link" });
  const knownOrders = useRef(new Set<string>());

  const request = useCallback(
    async <T,>(path: string, init: RequestInit = {}) => {
      if (merchantMode) {
        const merchantPath = path.replace(
          "/api/admin/ordering",
          "/api/merchant-admin/ordering",
        );
        return merchantOrderingApi<T>(merchantPath, init);
      }
      const join = path.includes("?") ? "&" : "?";
      return adminApi(
        `${path}${join}merchant_id=${encodeURIComponent(merchantId)}`,
        init,
      ) as Promise<T>;
    },
    [merchantId, merchantMode],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const data = await request<OrderingAdminOverview>(
        "/api/admin/ordering/overview",
      );
      setOverview(data);
      setLineForm({
        enabled: Boolean(data.line_integration?.configured),
        display_name: data.line_integration?.display_name || "",
        basic_id: data.line_integration?.basic_id || "",
        add_friend_url: data.line_integration?.add_friend_url || "",
        integration_mode: data.line_integration?.integration_mode || "add_friend_link",
      });
      setSettings(
        data.settings
          ? {
              display_name: data.settings.display_name,
              enabled: data.settings.enabled,
              currency: data.settings.currency,
              dine_in_enabled: data.settings.dine_in_enabled,
              takeaway_enabled: data.settings.takeaway_enabled,
              require_member: true,
              consent_version: data.settings.consent_version,
              ordering_open: data.settings.ordering_open,
              accepting_orders: data.settings.accepting_orders,
              temporary_closed_message: data.settings.temporary_closed_message,
              auto_accept_orders: data.settings.auto_accept_orders,
              order_number_prefix: data.settings.order_number_prefix,
              max_items_per_order: data.settings.max_items_per_order,
              customer_cancel_before_accept:
                data.settings.customer_cancel_before_accept,
              estimated_prep_minutes: data.settings.estimated_prep_minutes,
              new_order_sound_enabled: data.settings.new_order_sound_enabled,
              table_session_enabled: data.settings.table_session_enabled,
              show_sold_out_items: data.settings.show_sold_out_items,
              last_order_time: data.settings.last_order_time || "",
              timezone: data.settings.timezone,
            }
          : {
              ...emptySettings,
              display_name:
                merchants.find((item) => item.id === merchantId)?.name || "",
            },
      );
      setItemForm((current) =>
        current.category_id || !data.categories[0]
          ? current
          : { ...current, category_id: data.categories[0].id },
      );
    } catch (error) {
      setMessage(errorMessage(error, "讀取掃碼系統失敗。"));
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [merchantId, merchants, request]);

  useEffect(() => {
    if (merchantMode) return;
    void adminApi("/api/finance/merchants")
      .then((data) => setMerchants(data.items || []))
      .catch(() => undefined);
  }, [merchantMode]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () => {
      if (!document.hidden) void load();
    };
    const timer = window.setInterval(refresh, document.hidden ? 20_000 : 8_000);
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    const submitted = (overview?.orders || []).filter(
      (item) => item.status === "submitted",
    );
    const fresh = submitted.filter(
      (item) => !knownOrders.current.has(item.order_code),
    );
    submitted.forEach((item) => knownOrders.current.add(item.order_code));
    if (
      fresh.length &&
      settings.new_order_sound_enabled &&
      knownOrders.current.size > fresh.length
    ) {
      const audio = new Audio(
        "data:audio/wav;base64,UklGRl9vT19teleVQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUQAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICA",
      );
      void audio.play().catch(() => undefined);
    }
  }, [overview?.orders, settings.new_order_sound_enabled]);

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
    await mutate(
      "/api/admin/ordering/settings",
      { method: "PATCH", body: JSON.stringify(settings) },
      "掃碼會員與點餐設定已儲存。",
    );
  };

  const saveLineIntegration = async (event: FormEvent) => {
    event.preventDefault();
    await mutate("/api/admin/ordering/line-integration", { method: "PUT", body: JSON.stringify(lineForm) }, "LINE 官方帳號設定已儲存。加好友連結不代表使用者已加入好友。");
  };

  const createQr = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(
      "/api/admin/ordering/qrs",
      { method: "POST", body: JSON.stringify(qrForm) },
      "QR Code 已建立。",
    );
    if (ok) setQrForm({ label: "", purpose: "member_order", table_label: "" });
  };

  const createQrBatch = async (event: FormEvent) => {
    event.preventDefault();
    await mutate(
      "/api/admin/ordering/qrs/batch",
      { method: "POST", body: JSON.stringify(batchForm) },
      "桌號 QR 已批次建立。",
    );
  };

  const createOptionGroup = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(
      "/api/admin/ordering/option-groups",
      { method: "POST", body: JSON.stringify(optionForm) },
      "加料選項群組已建立。",
    );
    if (ok)
      setOptionForm({
        name: "",
        selection_type: "single",
        required: true,
        min_select: 1,
        max_select: 1,
      });
  };

  const createOptionValue = async (groupId: string) => {
    const draft = optionValueDraft[groupId] || { name: "", price: "" };
    const price = Number(draft.price || 0);
    if (!draft.name.trim() || !Number.isFinite(price) || price < 0) {
      setMessage("請輸入正確的選項名稱與加價。");
      return;
    }
    const ok = await mutate(
      `/api/admin/ordering/option-groups/${groupId}/values`,
      {
        method: "POST",
        body: JSON.stringify({
          name: draft.name,
          price_delta_minor: Math.round(price * 100),
        }),
      },
      "選項值已建立。",
    );
    if (ok)
      setOptionValueDraft((current) => ({
        ...current,
        [groupId]: { name: "", price: "" },
      }));
  };

  const saveItemGroups = async (itemId: string) => {
    await mutate(
      `/api/admin/ordering/items/${itemId}/option-groups`,
      {
        method: "PUT",
        body: JSON.stringify({ group_ids: itemGroupDraft[itemId] || [] }),
      },
      "品項加料選項已更新。",
    );
  };

  const testSound = () => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.frequency.value = 880;
    gain.gain.value = 0.08;
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    setMessage("通知聲已播放；瀏覽器已取得聲音播放授權。");
  };

  const printOrder = (orderCode: string, kitchenOnly = false) => {
    const order = orders.find((item) => item.order_code === orderCode);
    if (!order) return;
    const popup = window.open("", "_blank", "width=520,height=720");
    if (!popup) return setMessage("瀏覽器已阻擋列印視窗。");
    const lines = order.items
      .map(
        (item) =>
          `<li>${escapeHtml(item.name)} × ${item.quantity}${kitchenOnly ? "" : `<b>${money(item.line_total_minor)}</b>`}${(item.options || []).map((option) => `<small>${escapeHtml(option.group_name)}：${escapeHtml(option.value_name)}</small>`).join("")}${item.note ? `<small>品項備註：${escapeHtml(item.note)}</small>` : ""}</li>`,
      )
      .join("");
    popup.document.write(
      `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${escapeHtml(order.order_code)}</title><style>body{font-family:system-ui;padding:24px}h1{font-size:24px}li{display:grid;grid-template-columns:1fr auto;padding:8px 0;border-bottom:1px dashed #aaa}small{grid-column:1/-1}</style></head><body><h1>${escapeHtml(settings.display_name)}</h1><h2>${kitchenOnly ? "廚房單" : "訂單明細"}</h2><p>${escapeHtml(order.order_code)}｜${order.order_type === "dine_in" ? escapeHtml(order.table_label) : "外帶"}</p><ul>${lines}</ul>${kitchenOnly ? "" : `<h2>總額 ${money(order.total_minor)}</h2>`}${order.customer_note ? `<p>備註：${escapeHtml(order.customer_note)}</p>` : ""}<script>onload=()=>print()<\/script></body></html>`,
    );
    popup.document.close();
  };

  const createCategory = async (event: FormEvent) => {
    event.preventDefault();
    const ok = await mutate(
      "/api/admin/ordering/categories",
      { method: "POST", body: JSON.stringify(categoryForm) },
      "菜單分類已建立。",
    );
    if (ok) setCategoryForm({ name: "", description: "" });
  };

  const createItem = async (event: FormEvent) => {
    event.preventDefault();
    const price = Number(itemForm.price);
    if (!Number.isFinite(price) || price < 0) {
      setMessage("請輸入正確的售價。");
      return;
    }
    const ok = await mutate(
      "/api/admin/ordering/items",
      {
        method: "POST",
        body: JSON.stringify({
          ...itemForm,
          price_minor: Math.round(price * 100),
        }),
      },
      "菜單品項已建立。",
    );
    if (ok)
      setItemForm((current) => ({
        ...current,
        name: "",
        price: "",
        description: "",
        image_url: "",
        sku: "",
      }));
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
    popup.document.write(
      `<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>${safeLabel}</title><style>body{font-family:system-ui;text-align:center;padding:40px}svg{width:360px;height:360px}h1{font-size:28px}p{overflow-wrap:anywhere}</style></head><body><h1>${safeLabel}</h1>${source}<p>掃碼加入會員並點餐</p><p>${safeUrl}</p><script>window.onload=()=>window.print()<\/script></body></html>`,
    );
    popup.document.close();
  };

  const printAllQrs = () => {
    if (!qrs.length) return;
    const popup = window.open("", "_blank", "width=1000,height=800");
    if (!popup) return setMessage("瀏覽器已阻擋列印視窗。");
    const cards = qrs.filter((qr) => qr.active).map((qr) => {
      const svg = document.getElementById(`ordering-qr-${qr.id}`);
      if (!(svg instanceof SVGElement)) return "";
      return `<article><h2>${escapeHtml(settings.display_name)}</h2><h3>${escapeHtml(qr.table_label || qr.label)}</h3>${new XMLSerializer().serializeToString(svg)}<p>掃碼加入會員並點餐</p></article>`;
    }).join("");
    popup.document.write(`<!doctype html><html lang="zh-Hant"><head><meta charset="utf-8"><title>QR 批次列印</title><style>body{font-family:system-ui;display:grid;grid-template-columns:repeat(2,1fr);gap:16px}article{text-align:center;page-break-inside:avoid;border:1px solid #bbb;padding:14px}svg{width:220px;height:220px}@media print{body{margin:0}}</style></head><body>${cards}<script>onload=()=>print()<\/script></body></html>`);
    popup.document.close();
  };

  const categories = overview?.categories || [];
  const menuItems = overview?.items || [];
  const qrs = overview?.qrs || [];
  const orders = overview?.orders || [];

  return (
    <main className="finance-shell ordering-admin-page">
      {!merchantMode && <AdminModuleNav current="ordering" />}
      <header className="finance-hero ordering-admin-hero">
        <div>
          <span className="eyebrow">
            <QrCode weight="fill" />
            掃碼會員與手機點餐
          </span>
          <h1>QR 點餐營運中心</h1>
          <p>
            建立商家專屬
            QR、桌號、快速會員、菜單與訂單看板。正式上線前請先在測試商家完成驗收。
          </p>
        </div>
        <div className="ordering-admin-merchant">
          {!merchantMode && (
            <>
              <label>
                merchant_id
                <input
                  list="ordering-merchant-options"
                  value={merchantId}
                  onChange={(event) => setMerchantId(event.target.value.trim())}
                />
              </label>
              <datalist id="ordering-merchant-options">
                {merchants.map((merchant) => (
                  <option key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </datalist>
            </>
          )}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => void load()}
            disabled={loading}
          >
            <ArrowClockwise />
            重新整理
          </button>
          <button type="button" className="btn btn-outline" onClick={testSound}>
            測試通知聲
          </button>
        </div>
      </header>

      <nav className="container ordering-admin-tabs" aria-label="QR 點餐管理分頁">
        <a href="#ordering-overview">總覽</a><a href="#ordering-orders">即時訂單</a><a href="#ordering-qrs">桌號 QR</a><a href="#ordering-menu">菜單</a><a href="#ordering-options">加料選項</a><a href="#ordering-members">會員</a><a href="#ordering-orders">付款</a><a href="#ordering-settings">設定</a><a href="#ordering-invoice">電子發票</a>
      </nav>

      {message && (
        <div className="container ordering-admin-message" role="status">
          {message}
        </div>
      )}
      {loading && (
        <div className="container ordering-admin-loading">
          <span className="ordering-spinner" />
          處理中…
        </div>
      )}

      <section id="ordering-overview" className="container ordering-admin-summary">
        <article>
          <Users />
          <span>有效會員</span>
          <strong>{overview?.summary.active_members || 0}</strong>
        </article>
        <article>
          <CookingPot />
          <span>處理中訂單</span>
          <strong>{overview?.summary.open_orders || 0}</strong>
        </article>
        <article>
          <Receipt />
          <span>最近訂單</span>
          <strong>{overview?.summary.total_orders || 0}</strong>
        </article>
        <article>
          <QrCode />
          <span>QR Code</span>
          <strong>{qrs.length}</strong>
        </article>
      </section>

      <section className="container ordering-admin-grid">
        <article id="ordering-settings" className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <Storefront />
            <div>
              <span>第一步</span>
              <h2>商家系統設定</h2>
            </div>
          </div>
          <form className="ordering-admin-form" onSubmit={saveSettings}>
            <label>
              商家顯示名稱
              <input
                required
                value={settings.display_name}
                onChange={(event) =>
                  setSettings({ ...settings, display_name: event.target.value })
                }
                placeholder="顧客掃碼後看到的名稱"
              />
            </label>
            <label>
              同意書版本
              <input
                required
                value={settings.consent_version}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    consent_version: event.target.value,
                  })
                }
              />
            </label>
            <label>
              訂單編號前綴
              <input
                required
                maxLength={10}
                value={settings.order_number_prefix}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    order_number_prefix: event.target.value,
                  })
                }
              />
            </label>
            <label>
              預估製作分鐘
              <input
                type="number"
                min="1"
                max="480"
                value={settings.estimated_prep_minutes}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    estimated_prep_minutes: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              單筆最多品項
              <input
                type="number"
                min="1"
                max="200"
                value={settings.max_items_per_order}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    max_items_per_order: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              最後接單時間（選填）
              <input
                type="time"
                value={settings.last_order_time}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    last_order_time: event.target.value,
                  })
                }
              />
            </label>
            <label className="ordering-admin-form-wide">
              暫停接單訊息
              <input
                value={settings.temporary_closed_message}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    temporary_closed_message: event.target.value,
                  })
                }
              />
            </label>
            <div className="ordering-admin-checks">
              <label>
                <input
                  type="checkbox"
                  checked={settings.enabled}
                  onChange={(event) =>
                    setSettings({ ...settings, enabled: event.target.checked })
                  }
                />
                啟用 QR 系統
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.ordering_open}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      ordering_open: event.target.checked,
                    })
                  }
                />
                開放菜單
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.accepting_orders}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      accepting_orders: event.target.checked,
                    })
                  }
                />
                接受新訂單
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.dine_in_enabled}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      dine_in_enabled: event.target.checked,
                    })
                  }
                />
                開放內用
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.takeaway_enabled}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      takeaway_enabled: event.target.checked,
                    })
                  }
                />
                開放外帶
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.customer_cancel_before_accept}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      customer_cancel_before_accept: event.target.checked,
                    })
                  }
                />
                接單前顧客可取消
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.table_session_enabled}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      table_session_enabled: event.target.checked,
                    })
                  }
                />
                啟用桌位 Session
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.show_sold_out_items}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      show_sold_out_items: event.target.checked,
                    })
                  }
                />
                顯示售完品項
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.new_order_sound_enabled}
                  onChange={(event) =>
                    setSettings({
                      ...settings,
                      new_order_sound_enabled: event.target.checked,
                    })
                  }
                />
                新訂單通知聲
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={settings.require_member}
                  disabled
                />
                點餐前須加入會員
              </label>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading}
            >
              儲存設定
            </button>
          </form>
        </article>

        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><Storefront /><div><span>商家整合</span><h2>LINE 官方帳號</h2></div></div>
          <p>僅接受商家自己的 LINE 官方加好友網址；顧客點擊連結不等同已加入好友。</p>
          <form className="ordering-admin-form" onSubmit={saveLineIntegration}>
            <label>LINE OA 名稱<input value={lineForm.display_name} onChange={(event) => setLineForm({ ...lineForm, display_name: event.target.value })} placeholder="例如：百工牛肉麵 LINE" /></label>
            <label>LINE Basic ID<input value={lineForm.basic_id} onChange={(event) => setLineForm({ ...lineForm, basic_id: event.target.value })} placeholder="@xxxxxxx" /></label>
            <label className="ordering-admin-form-wide">LINE 加好友網址<input type="url" value={lineForm.add_friend_url} onChange={(event) => setLineForm({ ...lineForm, add_friend_url: event.target.value })} placeholder="https://lin.ee/..." /></label>
            <label><span>整合模式</span><select value={lineForm.integration_mode} onChange={(event) => setLineForm({ ...lineForm, integration_mode: event.target.value })}><option value="add_friend_link">加好友連結</option><option value="linked_line_login">LINE Login（需完成商家關聯）</option><option value="future_multi_account_liff">多帳號 LIFF（預留）</option></select></label>
            <label className="ordering-consent"><input type="checkbox" checked={lineForm.enabled} onChange={(event) => setLineForm({ ...lineForm, enabled: event.target.checked })} /><span>啟用加好友導流（未設定有效 LINE URL 不會啟用）</span></label>
            <button className="btn btn-primary" type="submit" disabled={loading}>儲存 LINE 設定</button>
          </form>
        </article>

        <article id="ordering-invoice" className="ordering-admin-panel">
          <div className="ordering-admin-panel-title"><Storefront /><div><span>商家整合</span><h2>電子發票設定</h2></div></div>
          <p>
            目前狀態：<strong>{overview?.invoice_integration?.enabled ? "電子發票服務已啟用" : "尚未完成商業／發票服務設定"}</strong>
          </p>
          <p className="muted">此處只顯示啟用準備狀態；不會因填寫資料而自動取得電子發票資格或開立正式發票。</p>
          <ul className="ordering-admin-list">
            <li>□ 商家／公司登記</li>
            <li>□ 統一編號</li>
            <li>□ 電子發票服務商</li>
            <li>□ 發票字軌／相關授權</li>
            <li>□ Provider Credential</li>
            <li>□ 測試驗證</li>
          </ul>
          <p className="muted">Readiness：{overview?.invoice_integration?.readiness_status || "NOT_CONFIGURED"}</p>
        </article>

        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <QrCode />
            <div>
              <span>第二步</span>
              <h2>建立專屬 QR</h2>
            </div>
          </div>
          <form className="ordering-admin-form" onSubmit={createQr}>
            <label>
              QR 名稱
              <input
                required
                value={qrForm.label}
                onChange={(event) =>
                  setQrForm({ ...qrForm, label: event.target.value })
                }
                placeholder="例如：入口會員點餐、A1桌"
              />
            </label>
            <label>
              用途
              <select
                value={qrForm.purpose}
                onChange={(event) =>
                  setQrForm({
                    ...qrForm,
                    purpose: event.target.value as OrderingPurpose,
                  })
                }
              >
                <option value="member_order">加入會員＋點餐</option>
                <option value="dine_in">內用桌號點餐</option>
                <option value="takeaway">外帶點餐</option>
                <option value="member_only">只加入會員</option>
              </select>
            </label>
            {qrForm.purpose === "dine_in" && (
              <label>
                桌號
                <input
                  required
                  value={qrForm.table_label}
                  onChange={(event) =>
                    setQrForm({ ...qrForm, table_label: event.target.value })
                  }
                  placeholder="例如 A1、12桌"
                />
              </label>
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !overview?.settings}
            >
              建立 QR Code
            </button>
          </form>
        </article>
      </section>

      <section id="ordering-qrs" className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title">
          <QrCode />
          <div>
            <span>批次管理</span>
            <h2>一次建立多桌 QR</h2>
          </div>
          {qrs.length > 0 && <button type="button" className="btn btn-outline" onClick={printAllQrs}><Printer />批次列印</button>}
        </div>
        <form className="ordering-admin-form" onSubmit={createQrBatch}>
          <label>
            前綴
            <input
              value={batchForm.prefix}
              onChange={(event) =>
                setBatchForm({ ...batchForm, prefix: event.target.value })
              }
              placeholder="A 或 第"
            />
          </label>
          <label>
            後綴
            <input
              value={batchForm.suffix}
              onChange={(event) =>
                setBatchForm({ ...batchForm, suffix: event.target.value })
              }
              placeholder="桌（可不填）"
            />
          </label>
          <label>
            起始號碼
            <input
              type="number"
              min="1"
              value={batchForm.start}
              onChange={(event) =>
                setBatchForm({
                  ...batchForm,
                  start: Number(event.target.value),
                })
              }
            />
          </label>
          <label>
            結束號碼
            <input
              type="number"
              min="1"
              value={batchForm.end}
              onChange={(event) =>
                setBatchForm({ ...batchForm, end: Number(event.target.value) })
              }
            />
          </label>
          <button
            className="btn btn-primary ordering-admin-form-wide"
            type="submit"
            disabled={loading}
          >
            批次建立桌號 QR
          </button>
        </form>
      </section>

      <section className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title">
          <QrCode />
          <div>
            <span>已建立</span>
            <h2>QR Code 列表</h2>
          </div>
        </div>
        {qrs.length === 0 ? (
          <div className="ordering-admin-empty">
            尚未建立 QR Code。先儲存商家設定，再建立入口或桌號 QR。
          </div>
        ) : (
          <div className="ordering-qr-grid">
            {qrs.map((qr) => {
              const url = publicOrderingUrl(qr.code);
              return (
                <article
                  className={`ordering-qr-card ${qr.active ? "" : "is-inactive"}`}
                  key={qr.id}
                >
                  <div className="ordering-qr-canvas">
                    <QRCodeSVG
                      id={`ordering-qr-${qr.id}`}
                      value={url}
                      size={220}
                      level="H"
                      includeMargin
                      title={qr.label}
                    />
                  </div>
                  <div className="ordering-qr-card-copy">
                    <span>{purposeLabels[qr.purpose]}</span>
                    <h3>{qr.label}</h3>
                    {qr.table_label && <strong>{qr.table_label}</strong>}
                    <p>{url}</p>
                    <div className="ordering-qr-actions">
                      <button type="button" onClick={() => void copyText(url)}>
                        <ClipboardText />
                        複製
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadQr(qr.id, qr.label)}
                      >
                        <DownloadSimple />
                        下載
                      </button>
                      <button
                        type="button"
                        onClick={() => printQr(qr.id, qr.label, url)}
                      >
                        <Printer />
                        列印
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          void mutate(
                            `/api/admin/ordering/qrs/${qr.id}`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({ active: !qr.active }),
                            },
                            qr.active ? "QR 已停用。" : "QR 已啟用。",
                          )
                        }
                      >
                        {qr.active ? "停用" : "啟用"}
                      </button>
                      <button type="button" onClick={() => window.confirm("重新產生後，舊 QR 連結會立即失效。確定繼續？") && void mutate(`/api/admin/ordering/qrs/${qr.id}/regenerate`, { method: "POST" }, "QR Code 已重新產生，舊連結已失效。")}>重新產生</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="ordering-menu" className="container ordering-admin-grid ordering-admin-menu-forms">
        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <ForkKnife />
            <div>
              <span>第三步</span>
              <h2>新增菜單分類</h2>
            </div>
          </div>
          <form className="ordering-admin-form" onSubmit={createCategory}>
            <label>
              分類名稱
              <input
                required
                value={categoryForm.name}
                onChange={(event) =>
                  setCategoryForm({ ...categoryForm, name: event.target.value })
                }
                placeholder="例如：主餐、飲料"
              />
            </label>
            <label>
              說明
              <textarea
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm({
                    ...categoryForm,
                    description: event.target.value,
                  })
                }
              />
            </label>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={loading || !overview?.settings}
            >
              新增分類
            </button>
          </form>
          <div className="ordering-admin-mini-list">
            {categories.map((category) => (
              <div key={category.id}>
                <span>{category.name}</span>
                <button
                  type="button"
                  onClick={() =>
                    void mutate(
                      `/api/admin/ordering/categories/${category.id}`,
                      {
                        method: "PATCH",
                        body: JSON.stringify({ active: !category.active }),
                      },
                      "分類狀態已更新。",
                    )
                  }
                >
                  {category.active ? "停用" : "啟用"}
                </button>
              </div>
            ))}
          </div>
        </article>

        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <CookingPot />
            <div>
              <span>第四步</span>
              <h2>新增菜單品項</h2>
            </div>
          </div>
          <form className="ordering-admin-form" onSubmit={createItem}>
            <label>
              分類
              <select
                required
                value={itemForm.category_id}
                onChange={(event) =>
                  setItemForm({ ...itemForm, category_id: event.target.value })
                }
              >
                <option value="">請選擇</option>
                {categories
                  .filter((category) => category.active !== false)
                  .map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              品項名稱
              <input
                required
                value={itemForm.name}
                onChange={(event) =>
                  setItemForm({ ...itemForm, name: event.target.value })
                }
              />
            </label>
            <label>
              售價（NT$）
              <input
                required
                min="0"
                step="1"
                inputMode="numeric"
                value={itemForm.price}
                onChange={(event) =>
                  setItemForm({ ...itemForm, price: event.target.value })
                }
              />
            </label>
            <label>
              SKU（選填）
              <input
                value={itemForm.sku}
                onChange={(event) =>
                  setItemForm({ ...itemForm, sku: event.target.value })
                }
              />
            </label>
            <label className="ordering-admin-form-wide">
              品項說明
              <textarea
                value={itemForm.description}
                onChange={(event) =>
                  setItemForm({ ...itemForm, description: event.target.value })
                }
              />
            </label>
            <p className="ordering-admin-form-wide ordering-image-create-note">建立商品後，可在下方「編輯商品資料與圖片」直接從手機相簿或相機上傳圖片。</p>
            <button
              className="btn btn-primary ordering-admin-form-wide"
              type="submit"
              disabled={loading || categories.length === 0}
            >
              新增品項
            </button>
          </form>
        </article>
      </section>

      <section className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title">
          <ForkKnife />
          <div>
            <span>菜單管理</span>
            <h2>目前品項</h2>
          </div>
        </div>
        {menuItems.length === 0 ? (
          <div className="ordering-admin-empty">尚未建立菜單品項。</div>
        ) : (
          <div className="ordering-admin-item-list">
            {menuItems.map((item) => (
              <article key={item.id}>
                {item.image_url ? (
                  <img src={item.image_url} alt="" loading="lazy" />
                ) : (
                  <span className="ordering-admin-item-placeholder">
                    <ForkKnife />
                  </span>
                )}
                <div>
                  <span>
                    {categories.find(
                      (category) => category.id === item.category_id,
                    )?.name || "未分類"}
                  </span>
                  <h3>{item.name}</h3>
                  <p>{item.description}</p>
                </div>
                <strong>{money(item.price_minor)}</strong>
                <div className="ordering-qr-actions">
                  <button
                    type="button"
                    className={item.status === "sold_out" ? "is-inactive" : ""}
                    onClick={() =>
                      void mutate(
                        `/api/admin/ordering/items/${item.id}`,
                        {
                          method: "PATCH",
                          body: JSON.stringify({
                            status:
                              item.status === "sold_out"
                                ? "active"
                                : "sold_out",
                          }),
                        },
                        item.status === "sold_out"
                          ? "品項已恢復供應。"
                          : "品項已標記今日售完。",
                      )
                    }
                  >
                    {item.status === "sold_out" ? "恢復供應" : "售完"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void mutate(
                        `/api/admin/ordering/items/${item.id}/duplicate`,
                        { method: "POST" },
                        "品項副本已建立並設為隱藏。",
                      )
                    }
                  >
                    複製
                  </button>
                </div>
                <MerchantMenuItemEditor item={item} categories={categories} onSave={async (payload) => { await mutate(`/api/admin/ordering/items/${item.id}`, { method: "PATCH", body: JSON.stringify(payload) }, "商品資料已儲存並同步前台。"); }} />
                <div className="ordering-item-inventory-status"><span>庫存狀態：{item.inventory_exists ? `目前 ${item.stock_on_hand} 份${item.inventory_enabled ? "" : "（未啟用控制）"}` : "未建立庫存"}</span><a className="btn btn-outline" href="#/merchant/inventory">管理庫存</a></div>
                <button type="button" className="ordering-item-archive" onClick={() => window.confirm("確定將此商品下架並封存？歷史訂單不會被刪除。") && void mutate(`/api/admin/ordering/items/${item.id}`, { method: "PATCH", body: JSON.stringify({ status: "archived" }) }, "商品已安全封存。")}>
                  刪除／封存商品
                </button>
                <details className="ordering-item-option-links">
                  <summary>設定此品項的加料選項</summary>
                  {(overview?.option_groups || []).map((group) => {
                    const initial = (overview?.item_option_groups || []).filter((link) => link.item_id === item.id).map((link) => link.group_id);
                    const selected = itemGroupDraft[item.id] || initial;
                    return <label key={group.id}><input type="checkbox" checked={selected.includes(group.id)} onChange={(event) => setItemGroupDraft((current) => ({ ...current, [item.id]: event.target.checked ? [...selected, group.id] : selected.filter((id) => id !== group.id) }))}/><span>{group.name}</span></label>;
                  })}
                  <button type="button" onClick={() => void saveItemGroups(item.id)}>儲存品項選項</button>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="ordering-options" className="container ordering-admin-grid">
        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <ForkKnife />
            <div>
              <span>餐點客製</span>
              <h2>加料與選項群組</h2>
            </div>
          </div>
          <form className="ordering-admin-form" onSubmit={createOptionGroup}>
            <label>
              群組名稱
              <input
                required
                value={optionForm.name}
                onChange={(event) =>
                  setOptionForm({ ...optionForm, name: event.target.value })
                }
                placeholder="甜度、冰量、加料"
              />
            </label>
            <label>
              選擇方式
              <select
                value={optionForm.selection_type}
                onChange={(event) =>
                  setOptionForm({
                    ...optionForm,
                    selection_type: event.target.value,
                  })
                }
              >
                <option value="single">單選</option>
                <option value="multiple">複選</option>
              </select>
            </label>
            <label>
              最少選擇
              <input
                type="number"
                min="0"
                value={optionForm.min_select}
                onChange={(event) =>
                  setOptionForm({
                    ...optionForm,
                    min_select: Number(event.target.value),
                  })
                }
              />
            </label>
            <label>
              最多選擇
              <input
                type="number"
                min="1"
                value={optionForm.max_select}
                onChange={(event) =>
                  setOptionForm({
                    ...optionForm,
                    max_select: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="ordering-consent ordering-admin-form-wide">
              <input
                type="checkbox"
                checked={optionForm.required}
                onChange={(event) =>
                  setOptionForm({
                    ...optionForm,
                    required: event.target.checked,
                  })
                }
              />
              <span>顧客必須選擇</span>
            </label>
            <button
              className="btn btn-primary ordering-admin-form-wide"
              type="submit"
            >
              建立選項群組
            </button>
          </form>
        </article>
        <article className="ordering-admin-panel">
          <div className="ordering-admin-panel-title">
            <ForkKnife />
            <div>
              <span>已建立</span>
              <h2>選項群組</h2>
            </div>
          </div>
          {(overview?.option_groups || []).length === 0 ? (
            <div className="ordering-admin-empty">
              尚未建立甜度、冰量或加料選項。
            </div>
          ) : (
            <div className="ordering-admin-mini-list">
              {overview?.option_groups.map((group) => (
                <div className="ordering-option-admin-card" key={group.id}>
                  <header><span><strong>{group.name}</strong>・{group.required ? "必選" : "選填"}・{group.min_select}～{group.max_select} 項</span><button type="button" onClick={() => void mutate(`/api/admin/ordering/option-groups/${group.id}`, { method: "PATCH", body: JSON.stringify({ active: !group.active }) }, "選項群組狀態已更新。")}>{group.active ? "停用" : "啟用"}</button></header>
                  <ul>{(overview?.option_values || []).filter((value) => value.group_id === group.id).map((value) => <li key={value.id}><span>{value.name}</span><strong>{value.price_delta_minor ? `+${money(value.price_delta_minor)}` : "不加價"}</strong></li>)}</ul>
                  <div className="ordering-option-value-form"><input aria-label={`${group.name}選項名稱`} value={optionValueDraft[group.id]?.name || ""} onChange={(event) => setOptionValueDraft((current) => ({ ...current, [group.id]: { name: event.target.value, price: current[group.id]?.price || "" } }))} placeholder="例如：珍珠"/><input aria-label={`${group.name}加價`} inputMode="decimal" value={optionValueDraft[group.id]?.price || ""} onChange={(event) => setOptionValueDraft((current) => ({ ...current, [group.id]: { name: current[group.id]?.name || "", price: event.target.value } }))} placeholder="加價 NT$"/><button type="button" onClick={() => void createOptionValue(group.id)}>新增</button></div>
                </div>
              ))}
            </div>
          )}
        </article>
      </section>

      {(overview?.dining_sessions || []).some((session) => session.status === "open") && <section className="container ordering-admin-panel ordering-admin-wide"><div className="ordering-admin-panel-title"><Storefront /><div><span>桌位管理</span><h2>使用中的桌位</h2></div></div><div className="ordering-admin-mini-list">{overview?.dining_sessions.filter((session) => session.status === "open").map((session) => <div key={session.id}><span><strong>{session.table_label}</strong>・{session.opened_at ? new Date(session.opened_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" }) : ""}</span><button type="button" onClick={() => window.confirm(`確定清桌 ${session.table_label}？`) && void mutate(`/api/admin/ordering/dining-sessions/${session.id}/close`, { method: "POST" }, `${session.table_label} 已清桌。`)}>清桌</button></div>)}</div></section>}

      <section id="ordering-orders" className="container ordering-admin-panel ordering-admin-wide">
        <div className="ordering-admin-panel-title">
          <Receipt />
          <div>
            <span>即時營運</span>
            <h2>訂單看板</h2>
          </div>
        </div>
        {orders.length === 0 ? (
          <div className="ordering-admin-empty">
            目前尚無訂單。顧客掃碼加入會員並送單後會顯示在這裡。
          </div>
        ) : (
          <div className="ordering-orders-board">
            {orders.map((order) => (
              <article
                className={`ordering-order-admin-card tone-${statusTone(order.status)}`}
                key={order.order_code}
              >
                <header>
                  <div>
                    <span>
                      {order.order_type === "dine_in"
                        ? `內用 ${order.table_label}`
                        : "外帶"}
                    </span>
                    <h3>{order.order_code}</h3>
                    <small>
                      {new Date(order.created_at).toLocaleString("zh-TW", {
                        timeZone: "Asia/Taipei",
                      })}
                    </small>
                  </div>
                  <div>
                    <strong>{money(order.total_minor)}</strong>
                    <span>
                      {order.payment_status === "paid"
                        ? "已付款"
                        : order.payment_status === "refunded"
                          ? "已退款"
                          : "未付款"}
                    </span>
                  </div>
                </header>
                <div className="ordering-order-customer">
                  <Users /> {order.customer_name}・{order.phone_masked}
                </div>
                <ul>
                  {order.items.map((item, index) => (
                    <li key={`${order.order_code}-${index}`}>
                      <span>
                        {item.name} × {item.quantity}
                        {(item.options || []).map((option) => (
                          <small
                            key={`${option.group_name}-${option.value_name}`}
                          >
                            {option.group_name}：{option.value_name}
                          </small>
                        ))}
                        {item.note && <small>品項備註：{item.note}</small>}
                      </span>
                      <strong>{money(item.line_total_minor)}</strong>
                    </li>
                  ))}
                </ul>
                {order.customer_note && (
                  <p className="ordering-order-note">
                    備註：{order.customer_note}
                  </p>
                )}
                <footer>
                  <span
                    className={`ordering-status-pill tone-${statusTone(order.status)}`}
                  >
                    {orderStatusLabels[order.status]}
                  </span>
                  <div>
                    <button
                      type="button"
                      onClick={() => printOrder(order.order_code)}
                    >
                      <Printer />
                      列印此單
                    </button>
                    <button
                      type="button"
                      onClick={() => printOrder(order.order_code, true)}
                    >
                      <Printer />
                      列印廚房單
                    </button>
                    {nextOrderActions(order.status).map((status) => (
                      <button
                        type="button"
                        key={status}
                        onClick={() =>
                          void mutate(
                            `/api/admin/ordering/orders/${order.order_code}/status`,
                            {
                              method: "PATCH",
                              body: JSON.stringify({
                                status,
                                ...(status === "cancelled"
                                  ? { cancel_reason: "店家取消訂單" }
                                  : {}),
                              }),
                            },
                            `訂單已更新為「${orderStatusLabels[status]}」。`,
                          )
                        }
                      >
                        {orderStatusLabels[status]}
                      </button>
                    ))}
                    {order.payment_status === "unpaid" && (
                      <button
                        type="button"
                        onClick={() =>
                          void mutate(
                            `/api/admin/ordering/orders/${order.order_code}/payment`,
                            {
                              method: "POST",
                              headers: {
                                "idempotency-key": crypto.randomUUID(),
                              },
                              body: JSON.stringify({
                                action: "confirm",
                                payment_method: "counter",
                              }),
                            },
                            "訂單已由店家確認付款。",
                          )
                        }
                      >
                        標記已付款
                      </button>
                    )}
                  </div>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
