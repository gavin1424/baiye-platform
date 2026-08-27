const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");

export type OrderingPurpose = "member_order" | "member_only" | "dine_in" | "takeaway";
export type OrderingOrderType = "dine_in" | "takeaway";
export type OrderingOrderStatus = "submitted" | "accepted" | "preparing" | "ready" | "served" | "completed" | "cancelled";
export type OrderingPaymentStatus = "unpaid" | "paid" | "refunded";

export type OrderingContext = {
  merchant_id: string;
  display_name: string;
  enabled: boolean;
  currency: string;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
  require_member: boolean;
  consent_version: string;
  ordering_allowed: boolean;
  qr: {
    id: string;
    code: string;
    label: string;
    purpose: OrderingPurpose;
    table_label: string;
  };
};

export type OrderingMember = {
  membership_id: string;
  membership_no: string;
  display_name: string;
  phone_masked: string;
};

export type OrderingCategory = {
  id: string;
  name: string;
  description?: string | null;
  sort_order: number;
  active?: boolean;
};

export type OrderingMenuItem = {
  id: string;
  category_id: string;
  sku?: string | null;
  name: string;
  description?: string | null;
  price_minor: number;
  image_url?: string | null;
  sort_order: number;
  available?: boolean;
};

export type OrderingOrderItem = {
  name: string;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  note?: string;
};

export type OrderingOrder = {
  order_code: string;
  merchant_id: string;
  table_label: string;
  order_type: OrderingOrderType;
  status: OrderingOrderStatus;
  payment_status: OrderingPaymentStatus;
  payment_method: string;
  subtotal_minor: number;
  total_minor: number;
  customer_note: string;
  created_at: string;
  updated_at: string;
  items: OrderingOrderItem[];
  customer_name?: string;
  phone_masked?: string;
  pricing?: { gross_subtotal_minor: number; coupon_discount_minor: number; payable_total_minor: number; coupon_id?: string | null };
};
export type OrderingCoupon={id:string;status:"pending_verification"|"active"|"reserved"|"redeemed"|"expired"|"revoked";expires_at:string;name?:string;discount_value_minor:number;minimum_spend_minor:number;terms_version:string};
export type OrderingPaymentOption={id:string;provider:"easywallet"|"easycard";mode:"easywallet_qr_manual"|"easycard_terminal_counter";display_name:string;official_qr_asset_key?:string;official_payment_url?:string};
export type OrderingDeliveryLink={id:string;provider:"uber_eats"|"foodpanda"|"line"|"custom";display_name:string;order_url:string};

export type QrContextResponse = {
  context: OrderingContext;
  member: OrderingMember | null;
};

export type QrMenuResponse = QrContextResponse & {
  categories: OrderingCategory[];
  items: OrderingMenuItem[];
};

export type OrderingQrAdmin = {
  id: string;
  merchant_id: string;
  code: string;
  label: string;
  purpose: OrderingPurpose;
  table_label?: string | null;
  active: boolean;
  expires_at?: string | null;
  created_at?: string;
};

export type OrderingSettingsAdmin = {
  merchant_id: string;
  display_name: string;
  enabled: boolean;
  currency: string;
  dine_in_enabled: boolean;
  takeaway_enabled: boolean;
  require_member: boolean;
  consent_version: string;
};

export type OrderingAdminOverview = {
  merchant_id: string;
  settings: OrderingSettingsAdmin | null;
  qrs: OrderingQrAdmin[];
  categories: OrderingCategory[];
  items: OrderingMenuItem[];
  orders: OrderingOrder[];
  summary: {
    active_members: number;
    open_orders: number;
    total_orders: number;
  };
};

function memberTokenKey(merchantId: string) {
  return `baiye:ordering-member:${merchantId}`;
}

export function getOrderingMemberToken(merchantId: string) {
  try {
    return window.localStorage.getItem(memberTokenKey(merchantId)) || "";
  } catch {
    return "";
  }
}

export function saveOrderingMemberToken(merchantId: string, token: string) {
  try {
    window.localStorage.setItem(memberTokenKey(merchantId), token);
  } catch {
    // The member can still order in the current page even if private browsing blocks storage.
  }
}

export function clearOrderingMemberToken(merchantId: string) {
  try {
    window.localStorage.removeItem(memberTokenKey(merchantId));
  } catch {
    // Ignore storage failures.
  }
}

export async function orderingPublicApi<T>(
  path: string,
  init: RequestInit = {},
  token = "",
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const headers: Record<string, string> = {
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(token ? { authorization: `Bearer ${token}` } : {}),
    ...((init.headers || {}) as Record<string, string>),
  };
  try {
    const response = await fetch(`${API}${path}`, {
      ...init,
      headers,
      signal: init.signal || controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || "掃碼點餐服務暫時無法使用。");
      Object.assign(error, { status: response.status, code: data.code || "" });
      throw error;
    }
    return data as T;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("連線逾時，請確認網路後再試一次。");
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}

export function publicOrderingUrl(code: string) {
  const site = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://baiyeconnect.com").replace(/\/$/, "");
  return `${site}/#/q/${encodeURIComponent(code)}`;
}
