export type CommercialPlan = {
  plan_id: string;
  display_name: string;
  short_name: string;
  price_minor: number;
  list_price_minor: number;
  currency: "TWD";
  term_months: number;
  trial_months: number;
  activation_fee_minor: number;
  deposit_minor: number;
  first_cycle_balance_minor: number;
  contract_version: string;
  contract_review_status: string;
  merchant_content_editable: boolean;
  merchant_product_editable: boolean;
  cart_enabled: boolean;
  commerce_full: boolean;
  base_product_limit: number | null;
  badge: string;
  summary: string;
  features: string[];
  renewal_terms: string;
  addon_policy: string;
};

export type AddonPrice = {
  code: string;
  label: string;
  pricing_model: string;
  amount_minor?: number;
  minimum_minor?: number;
  display_price: string;
  admin_quote_required?: boolean;
};

export type CommercialCatalog = {
  version: string;
  currency: "TWD";
  server_authoritative: boolean;
  final_contract_amount_server_calculated: boolean;
  legal_gate_preserved: boolean;
  plans: CommercialPlan[];
  standard_addons: AddonPrice[];
  installment_disclosure: string;
};

const API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");

export async function fetchCommercialCatalog(signal?: AbortSignal): Promise<CommercialCatalog> {
  const response = await fetch(`${API}/api/public/commercial-catalog`, { credentials: "include", signal });
  if (!response.ok) throw new Error("方案資料暫時無法載入");
  const data = await response.json() as CommercialCatalog;
  if (!data.server_authoritative || data.plans?.length !== 3) throw new Error("方案資料格式不完整");
  return data;
}

export const formatTwd = (minor: number) => `NT$${Math.round(minor / 100).toLocaleString("zh-TW")}`;
