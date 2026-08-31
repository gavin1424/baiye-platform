const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");

export type OrderingPurpose =
  "member_order" | "member_only" | "dine_in" | "takeaway";
export type OrderingOrderType = "dine_in" | "takeaway";
export type OrderingOrderStatus =
  | "submitted"
  | "accepted"
  | "preparing"
  | "ready"
  | "served"
  | "completed"
  | "cancelled";
export type OrderingPaymentStatus = "unpaid" | "pending" | "paid" | "partially_refunded" | "refunded" | "failed";
export type CheckoutPaymentProvider = "manual_counter" | "line_pay_online" | "apple_pay_web";
export type CheckoutPaymentCapability = {
  provider: CheckoutPaymentProvider;
  enabled: boolean;
  configuration_status: "configuration_required" | "sandbox_ready" | "active" | "disabled";
  order_acceptance_policy: "accept_before_payment" | "accept_after_payment";
  availability_code: string;
  capabilities: { authorize: boolean; capture: boolean; refund: boolean; partial_refund: boolean; redirect: boolean; wallet: boolean; webhook: boolean };
};

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
  ordering_open: boolean;
  accepting_orders: boolean;
  temporary_closed_message: string;
  estimated_prep_minutes: number;
  show_sold_out_items: boolean;
  customer_cancel_before_accept: boolean;
  line: {
    configured: boolean;
    display_name: string;
    basic_id: string;
    add_friend_url: string;
    integration_mode: "add_friend_link" | "linked_line_login" | "future_multi_account_liff";
    capabilities: { addFriendLink: boolean; login: boolean; friendshipStatus: boolean; messaging: boolean };
    status: "configured" | "LINE_DEMO_NOT_CONFIGURED";
  };
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
  status: "active" | "sold_out" | "hidden" | "archived";
  allow_customer_note: boolean;
  daily_limit?: number | null;
};

export type OrderingOptionGroup = {
  id: string;
  name: string;
  selection_type: "single" | "multiple";
  required: boolean;
  min_select: number;
  max_select: number;
  sort_order: number;
  active: boolean;
};

export type OrderingOptionValue = {
  id: string;
  group_id: string;
  name: string;
  price_delta_minor: number;
  sort_order: number;
  active: boolean;
};

export type OrderingItemOptionGroup = {
  item_id: string;
  group_id: string;
  sort_order: number;
};

export type OrderingOrderItem = {
  name: string;
  unit_price_minor: number;
  quantity: number;
  line_total_minor: number;
  note?: string;
  options?: Array<{
    group_name: string;
    value_name: string;
    price_delta_minor: number;
  }>;
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
  pricing?: {
    gross_subtotal_minor: number;
    coupon_discount_minor: number;
    payable_total_minor: number;
    coupon_id?: string | null;
  };
  invoice?: { status: string; invoice_number?: string | null };
};
export type OrderingCoupon = {
  id: string;
  status:
    | "pending_verification"
    | "active"
    | "reserved"
    | "redeemed"
    | "expired"
    | "revoked";
  expires_at: string;
  name?: string;
  discount_value_minor: number;
  minimum_spend_minor: number;
  terms_version: string;
};
export type OrderingPaymentOption = {
  id: string;
  provider: "easywallet" | "easycard";
  mode: "easywallet_qr_manual" | "easycard_terminal_counter";
  display_name: string;
  official_qr_asset_key?: string;
  official_payment_url?: string;
};
export type OrderingDeliveryLink = {
  id: string;
  provider: "uber_eats" | "foodpanda" | "line" | "custom";
  display_name: string;
  order_url: string;
};

export type QrContextResponse = {
  context: OrderingContext;
  member: OrderingMember | null;
};

export type QrMenuResponse = QrContextResponse & {
  categories: OrderingCategory[];
  items: OrderingMenuItem[];
  option_groups: OrderingOptionGroup[];
  option_values: OrderingOptionValue[];
  item_option_groups: OrderingItemOptionGroup[];
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
  last_order_time?: string | null;
  timezone: string;
};

export type OrderingAdminOverview = {
  merchant_id: string;
  settings: OrderingSettingsAdmin | null;
  line_integration: OrderingContext["line"];
  invoice_integration?: {
    provider: string;
    readiness_status: string;
    enabled: boolean;
    credential_status: string;
  };
  qrs: OrderingQrAdmin[];
  categories: OrderingCategory[];
  items: OrderingMenuItem[];
  option_groups: OrderingOptionGroup[];
  option_values: OrderingOptionValue[];
  item_option_groups: OrderingItemOptionGroup[];
  dining_sessions: Array<{
    id: string;
    table_label: string;
    status: "open" | "closed";
    opened_at: string;
    last_order_at?: string | null;
  }>;
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

function lastOrderKey(merchantId: string) {
  return `baiye:ordering-last-order:${merchantId}`;
}

let merchantCsrfToken = "";

export async function merchantOrderingApi<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const method = String(init.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(merchantCsrfToken && !["GET", "HEAD", "OPTIONS"].includes(method)
      ? { "x-csrf-token": merchantCsrfToken }
      : {}),
    ...((init.headers || {}) as Record<string, string>),
  };
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "商家點餐管理服務暫時無法使用。");
    Object.assign(error, { status: response.status, code: data.code || "" });
    throw error;
  }
  if (typeof data.csrf_token === "string") merchantCsrfToken = data.csrf_token;
  return data as T;
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

function orderingCartKey(code: string) { return `baiye:ordering-cart:${code}`; }
function orderingLineClickKey(code: string) { return `baiye:ordering-line-click:${code}`; }

export type PersistedOrderingCart = {
  cart: Record<string, number>;
  itemSelections: Record<string, { option_value_ids: string[]; note: string }>;
  customerNote: string;
  orderType: OrderingOrderType;
  tableLabel: string;
};

export function getPersistedOrderingCart(code: string): PersistedOrderingCart | null {
  try { const raw = window.localStorage.getItem(orderingCartKey(code)); return raw ? JSON.parse(raw) as PersistedOrderingCart : null; } catch { return null; }
}
export function savePersistedOrderingCart(code: string, value: PersistedOrderingCart) {
  try { window.localStorage.setItem(orderingCartKey(code), JSON.stringify(value)); } catch { /* Private browsing can still use the in-memory cart. */ }
}
export function clearPersistedOrderingCart(code: string) { try { window.localStorage.removeItem(orderingCartKey(code)); } catch { /* ignore */ } }
export function getOrderingLineClicked(code: string) { try { return window.localStorage.getItem(orderingLineClickKey(code)) === "1"; } catch { return false; } }
export function saveOrderingLineClicked(code: string) { try { window.localStorage.setItem(orderingLineClickKey(code), "1"); } catch { /* ignore */ } }

const PLATFORM_MEMBER_TOKEN_KEY = "baiye_platform_member_token";
const PLATFORM_DEVICE_KEY = "baiye_platform_device_id";

export function getPlatformMemberToken() {
  try { return window.localStorage.getItem(PLATFORM_MEMBER_TOKEN_KEY) || ""; } catch { return ""; }
}

export function savePlatformMemberToken(token: string) {
  try { window.localStorage.setItem(PLATFORM_MEMBER_TOKEN_KEY, token); } catch { /* Current page still holds the token. */ }
}

export function getPlatformDeviceId() {
  try {
    let id = window.localStorage.getItem(PLATFORM_DEVICE_KEY) || "";
    if (!id) {
      id = crypto.randomUUID();
      window.localStorage.setItem(PLATFORM_DEVICE_KEY, id);
    }
    return id;
  } catch { return crypto.randomUUID(); }
}

export function getOrderingLastOrder(merchantId: string) {
  try {
    return window.localStorage.getItem(lastOrderKey(merchantId)) || "";
  } catch {
    return "";
  }
}

export function saveOrderingLastOrder(merchantId: string, orderCode: string) {
  try {
    window.localStorage.setItem(lastOrderKey(merchantId), orderCode);
  } catch {
    // Status remains available for the current page when storage is unavailable.
  }
}

export function clearOrderingLastOrder(merchantId: string) {
  try {
    window.localStorage.removeItem(lastOrderKey(merchantId));
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
  const site = (
    import.meta.env.VITE_PUBLIC_SITE_URL || "https://baiyeconnect.com"
  ).replace(/\/$/, "");
  return `${site}/#/q/${encodeURIComponent(code)}`;
}
