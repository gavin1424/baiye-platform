const API = "https://chuang-baiye-ai.baiye-platform.workers.dev";
let csrfToken = "";

type AdminUser = { email: string; name: string; role: "admin" | "super_admin" };

async function request(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: { "content-type": "application/json", ...(csrfToken ? { "x-csrf-token": csrfToken } : {}), ...init.headers },
  });
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
