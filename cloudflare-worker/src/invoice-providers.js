const allowedStatuses = new Set(["NOT_REQUIRED", "PENDING", "ISSUING", "ISSUED", "FAILED", "VOID_PENDING", "VOIDED", "ALLOWANCE_PENDING", "PARTIALLY_REFUNDED", "FULLY_REFUNDED"]);

export const INVOICE_PROVIDER_CAPABILITIES = Object.freeze({
  disabled: { issue: false, void: false, allowance: false, query: false },
  mock_for_automated_test_only: { issue: true, void: true, allowance: true, query: true },
  future_einvoice_provider: { issue: false, void: false, allowance: false, query: false },
  future_mof_turnkey: { issue: false, void: false, allowance: false, query: false },
});

const unavailable = (code) => ({ ok: false, code });
const testEnabled = (env) => env?.NODE_ENV === "test" && env?.INVOICE_TEST_MODE === "isolated";

// No browser-facing or staging path can obtain a mock invoice. It exists only
// to prove idempotency and refund workflow in isolated automated tests.
export function getInvoiceProviderAdapter(provider, env = {}) {
  const capabilities = INVOICE_PROVIDER_CAPABILITIES[provider] || INVOICE_PROVIDER_CAPABILITIES.disabled;
  if (provider === "mock_for_automated_test_only" && testEnabled(env)) return Object.freeze({
    getCapabilities: () => capabilities,
    isAvailable: () => ({ available: true, code: "TEST_PROVIDER_AVAILABLE" }),
    issueInvoice: async ({ request_id }) => ({ ok: true, provider_invoice_id: `test-provider-${request_id}`, invoice_number: `TEST-INV-${request_id.slice(-6).toUpperCase()}`, invoice_date: new Date().toISOString().slice(0, 10), random_number: "0000" }),
    voidInvoice: async ({ invoice_id }) => ({ ok: true, provider_invoice_id: `void-${invoice_id}` }),
    issueAllowance: async ({ invoice_id, amount_minor }) => ({ ok: true, provider_allowance_id: `allowance-${invoice_id}`, allowance_number: `TEST-ALW-${String(amount_minor)}` }),
    voidAllowance: async ({ allowance_id }) => ({ ok: true, provider_allowance_id: `void-${allowance_id}` }),
    queryInvoice: async () => ({ ok: true }),
  });
  const code = provider === "disabled" ? "INVOICE_PROVIDER_DISABLED" : provider === "mock_for_automated_test_only" ? "TEST_PROVIDER_FORBIDDEN_OUTSIDE_AUTOMATED_TESTS" : "INVOICE_PROVIDER_CONFIGURATION_REQUIRED";
  return Object.freeze({
    getCapabilities: () => capabilities,
    isAvailable: () => ({ available: false, code }),
    issueInvoice: async () => unavailable(code), voidInvoice: async () => unavailable(code), issueAllowance: async () => unavailable(code), voidAllowance: async () => unavailable(code), queryInvoice: async () => unavailable(code),
  });
}

export { allowedStatuses as invoiceStates };
