const API = "https://chuang-baiye-ai.baiye-platform.workers.dev";
let csrfToken = "";

type AdminUser = { email: string; name: string; role: "admin" | "super_admin" };

function requestTimeout(path: string, method: string) {
  if (/\/settlements\/[^/]+\/(lock|mark-paid|pdf)/.test(path)) return 60_000;
  if (path.endsWith("/settlements/preview")) return 30_000;
  if (method === "GET") return 8_000;
  return 15_000;
}

async function request(path: string, init: RequestInit = {}) {
  const method = String(init.method || "GET").toUpperCase();
  const headers: Record<string, string> = {
    ...(init.body ? { "content-type": "application/json" } : {}),
    ...(csrfToken && !["GET", "HEAD", "OPTIONS"].includes(method) ? { "x-csrf-token": csrfToken } : {}),
    ...((init.headers || {}) as Record<string, string>),
  };
  const controller = new AbortController();
  const timeoutMs = requestTimeout(path, method);
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  let response: Response;
  try {
    response = await Promise.race([
      fetch(`${API}${path}`, { ...init, credentials: "include", headers, signal: init.signal || controller.signal }),
      new Promise<Response>((_, reject) => window.setTimeout(() => reject(new Error("服務處理逾時，請查詢最新狀態後再決定是否重試。")), timeoutMs + 500)),
    ]);
  } finally {
    window.clearTimeout(timeout);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "驗證服務暫時無法使用。" );
  if (typeof data.csrf_token === "string") csrfToken = data.csrf_token;
  return data;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  try { const data = await request("/api/admin/auth/session"); return data.user; } catch { return null; }
}

export async function loginAdmin(email: string, password: string): Promise<AdminUser> {
  const data = await request("/api/admin/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
  return data.user;
}

export async function logoutAdmin() {
  try { await request("/api/admin/auth/logout", { method: "POST" }); } finally { csrfToken = ""; }
}

export async function adminApi(path: string, init: RequestInit = {}) { return request(path, init); }

export async function adminDownload(path: string) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 60_000);
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { credentials: "include", signal: controller.signal });
  } finally {
    window.clearTimeout(timeout);
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "檔案下載失敗。" );
  }
  return { blob: await response.blob(), filename: response.headers.get("content-disposition")?.match(/filename="([^"]+)"/)?.[1] || "download" };
}
