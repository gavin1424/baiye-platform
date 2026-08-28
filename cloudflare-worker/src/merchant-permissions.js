const READ = "READ";
const MUTATION = "MUTATION";

const ORDERING_PERMISSION_MAP = Object.freeze([
  [/^\/api\/merchant-admin\/ordering\/overview$/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/settings$/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/settings$/, MUTATION, "ordering.settings"],
  [/^\/api\/merchant-admin\/ordering\/qrs(?:\/|$)/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/qrs(?:\/|$)/, MUTATION, "ordering.qr.manage"],
  [/^\/api\/merchant-admin\/ordering\/(?:categories|items|option-groups)(?:\/|$)/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/(?:categories|items|option-groups)(?:\/|$)/, MUTATION, "ordering.menu.manage"],
  [/^\/api\/merchant-admin\/ordering\/orders\/[^/]+\/payment$/, MUTATION, "ordering.payments.manage"],
  [/^\/api\/merchant-admin\/ordering\/(?:orders|dining-sessions)(?:\/|$)/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/(?:orders|dining-sessions)(?:\/|$)/, MUTATION, "ordering.orders.manage"],
  [/^\/api\/merchant-admin\/ordering\/payments(?:\/|$)/, READ, "ordering.read"],
  [/^\/api\/merchant-admin\/ordering\/payments(?:\/|$)/, MUTATION, "ordering.payments.manage"],
]);

export function permissionForOrderingRequest(pathname, method) {
  const kind = ["GET", "HEAD"].includes(method) ? READ : MUTATION;
  for (const [pattern, operation, permission] of ORDERING_PERMISSION_MAP) {
    if (pattern.test(pathname) && operation === kind) return permission;
  }
  return "ordering.read";
}
