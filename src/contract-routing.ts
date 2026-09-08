export const PLAN_CONTRACT_SLUGS = [
  "standard-digital-18000",
  "ai-commerce-45000",
  "softpos-24000",
] as const;

const PLAN_CONTRACT_SLUG_SET = new Set<string>(PLAN_CONTRACT_SLUGS);

export function planContractPath(planSlug: string) {
  return `/plans/${encodeURIComponent(planSlug)}/contract`;
}

export function sanitizePlanContractReturnTo(value: string | null | undefined) {
  if (!value || value.startsWith("//") || value.includes("\\")) return "";
  const match = value.match(/^\/plans\/([^/?#]+)\/contract$/);
  if (!match) return "";
  let slug = "";
  try { slug = decodeURIComponent(match[1]); } catch { return ""; }
  return PLAN_CONTRACT_SLUG_SET.has(slug) ? planContractPath(slug) : "";
}

export function merchantLoginPathForContract(planSlug: string) {
  const returnTo = planContractPath(planSlug);
  return `/merchant/login?returnTo=${encodeURIComponent(returnTo)}`;
}
