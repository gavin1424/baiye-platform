const READ = "GET";

export const MERCHANT_PERMISSION_MAP = Object.freeze([
  [/^\/api\/commerce\/dashboard$/, READ, "analytics.read"],
  [/^\/api\/commerce\/pages(?:\/|$)/, READ, "site.read"],
  [/^\/api\/commerce\/pages(?:\/|$)/, "MUTATION", "site.write"],
  [/^\/api\/commerce\/pages\/[^/]+\/publish$/, "MUTATION", "site.publish"],
  [/^\/api\/commerce\/(?:site|navigation|media|redirects|domains|seo|cms-audit)(?:\/|$)/, READ, "site.read"],
  [/^\/api\/commerce\/(?:site|navigation|media|redirects|domains|seo)(?:\/|$)/, "MUTATION", "site.write"],
  [/^\/api\/commerce\/products(?:\/|$)/, READ, "catalog.read"],
  [/^\/api\/commerce\/products(?:\/|$)/, "MUTATION", "catalog.write"],
  [/^\/api\/commerce\/inventory(?:\/|$)/, READ, "inventory.read"],
  [/^\/api\/commerce\/inventory(?:\/|$)/, "MUTATION", "inventory.adjust"],
  [/^\/api\/commerce\/orders(?:\/|$)/, READ, "orders.read"],
  [/^\/api\/commerce\/orders(?:\/|$)/, "MUTATION", "orders.manage"],
  [/^\/api\/commerce\/customers(?:\/|$)/, READ, "customers.read"],
  [/^\/api\/commerce\/customers(?:\/|$)/, "MUTATION", "customers.write"],
  [/^\/api\/commerce\/promotions(?:\/|$)/, READ, "promotions.read"],
  [/^\/api\/commerce\/promotions(?:\/|$)/, "MUTATION", "promotions.write"],
  [/^\/api\/commerce\/analytics(?:\/|$)/, READ, "analytics.read"],
  [/^\/api\/commerce\/integrations(?:\/|$)/, READ, "integrations.read"],
  [/^\/api\/commerce\/integrations(?:\/|$)/, "MUTATION", "integrations.write"],
  [/^\/api\/commerce\/api(?:\/|$)/, READ, "api.read"],
  [/^\/api\/commerce\/api(?:\/|$)/, "MUTATION", "api.manage"],
]);

export const ROLE_PERMISSIONS = Object.freeze({
  owner: ["*"],
  administrator: ["site.read","site.write","site.publish","catalog.read","catalog.write","catalog.import","inventory.read","inventory.adjust","orders.read","orders.manage","orders.refund","customers.read","customers.write","customers.export","promotions.read","promotions.write","finance.read","analytics.read","integrations.read","integrations.write","api.read","api.manage","users.read","users.manage"],
  website_editor: ["site.read","site.write","site.publish","catalog.read"],
  order_manager: ["catalog.read","inventory.read","inventory.adjust","orders.read","orders.manage","customers.read"],
  marketing_manager: ["site.read","catalog.read","customers.read","promotions.read","promotions.write","analytics.read"],
  finance_viewer: ["orders.read","finance.read","analytics.read"],
  read_only: ["site.read","catalog.read","inventory.read","orders.read","customers.read","promotions.read","finance.read","analytics.read","integrations.read","api.read"],
});

export function permissionForRequest(pathname, method) {
  const kind = method === "GET" || method === "HEAD" ? READ : "MUTATION";
  let result = "";
  for (const [pattern, operation, permission] of MERCHANT_PERMISSION_MAP) {
    if (pattern.test(pathname) && operation === kind) result = permission;
  }
  return result;
}
