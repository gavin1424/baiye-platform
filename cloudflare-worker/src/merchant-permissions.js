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

const POS_PERMISSION_MAP = Object.freeze([
  [/^\/api\/merchant-pos\/(?:overview|catalog|orders)(?:\/|$)/, READ, "pos.read"],
  [/^\/api\/merchant-pos\/orders\/[^/]+\/status$/, MUTATION, "pos.order.manage"],
  [/^\/api\/merchant-pos\/orders(?:\/|$)/, MUTATION, "pos.order.create"],
  [/^\/api\/merchant-pos\/cash(?:\/|$)/, READ, "pos.read"],
  [/^\/api\/merchant-pos\/cash(?:\/|$)/, MUTATION, "pos.cash.manage"],
  [/^\/api\/merchant-pos\/inventory(?:\/|$)/, READ, "pos.inventory.read"],
  [/^\/api\/merchant-pos\/inventory(?:\/|$)/, MUTATION, "pos.inventory.manage"],
]);

export function permissionForPosRequest(pathname, method) {
  const kind = ["GET", "HEAD"].includes(method) ? READ : MUTATION;
  for (const [pattern, operation, permission] of POS_PERMISSION_MAP) if (pattern.test(pathname) && operation === kind) return permission;
  return "pos.read";
}
