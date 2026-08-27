const disabled = (provider, capability) => ({
  provider,
  capability,
  enabled: false,
  productionReady: false,
  status: "disabled",
});

export const PAYMENT_PROVIDERS = Object.freeze([
  "ecpay", "newebpay", "newebpay_embedded", "line_pay", "tappay", "gmo",
  "paypal", "easywallet", "easycard_terminal", "bank_transfer", "cash", "custom",
].map((provider) => disabled(provider, "payment")));

export const SHIPPING_PROVIDERS = Object.freeze([
  "chunghwa_post", "black_cat", "ecpay_cvs", "ecpay_cvs_cod",
  "seven_eleven_b2c_frozen", "paynow", "ezship", "custom_shipping", "merchant_pickup",
].map((provider) => disabled(provider, "shipping")));

export const INVOICE_PROVIDERS = Object.freeze([
  "ezpay_invoice", "ecpay_invoice", "custom_invoice",
].map((provider) => disabled(provider, "invoice")));

export const OPTIONAL_ADAPTERS = Object.freeze({
  shopeeImport: disabled("shopee", "catalog_import"),
  merchantTwoFactor: disabled("unconfigured", "merchant_2fa"),
  email: disabled("unconfigured", "email"),
  sms: disabled("unconfigured", "sms"),
  lineBroadcast: disabled("line", "broadcast"),
});

export function assertProviderEnabled(provider) {
  if (!provider?.enabled || !provider?.productionReady || provider.status !== "active") {
    const error = new Error("PROVIDER_NOT_READY");
    error.status = 409;
    throw error;
  }
}
