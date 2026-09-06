const ADVISOR_API = (import.meta.env.VITE_PLATFORM_API_URL || "https://chuang-baiye-ai.baiye-platform.workers.dev").replace(/\/$/, "");

export async function advisorApi<T>(path: string, init: RequestInit = {}): Promise<T> {
  const memberToken = localStorage.getItem("baiye_platform_member_token");
  const csrf = sessionStorage.getItem("baiye_advisor_csrf");
  const response = await fetch(`${ADVISOR_API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(memberToken ? { "x-platform-member-token": memberToken } : {}),
      ...(csrf && !["GET", "HEAD"].includes(init.method || "GET") ? { "x-csrf-token": csrf } : {}),
      ...init.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(payload.error || "目前無法完成操作。"), { status: response.status, code: payload.code });
  return payload as T;
}

export function twd(minor: number) {
  return new Intl.NumberFormat("zh-TW", { style: "currency", currency: "TWD", maximumFractionDigits: 0 }).format(minor / 100);
}
