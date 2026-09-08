type ErrorLike = { status?: number; code?: string } | null | undefined;

const CODE_MESSAGES: Record<string, string> = {
  UNAUTHENTICATED: "登入已逾時，請重新登入。",
  SESSION_EXPIRED: "登入已逾時，請重新登入。",
  PERMISSION_DENIED: "您目前沒有執行這項操作的權限。",
  PLAN_NOT_SELECTABLE: "此方案目前無法選擇，請重新整理後再試。",
  ACTIVE_PLAN_EXISTS: "您目前已有有效方案。",
  PLAN_CHANGE_ALREADY_SUBMITTED: "此方案的變更申請已送出，請勿重複提交。",
  NETWORK_TIMEOUT: "連線逾時，請重新整理或稍後再試。",
  RATE_LIMITED: "操作次數過多，請稍後再試。",
  INVALID_PHONE: "請輸入手機號碼。",
  INVALID_PASSWORD: "請輸入 8 位數字密碼。",
  PASSWORD_INVALID: "請輸入 8 位數字密碼。",
  INVALID_CREDENTIALS: "手機號碼或密碼錯誤。",
  MEMBER_CREDENTIAL_INVALID: "手機號碼或密碼錯誤。",
};

export function userFacingError(
  error: unknown,
  fallback = "這項操作尚未完成，請重新整理或稍後再試。",
) {
  const detail = error as ErrorLike;
  const code = String(detail?.code || "");
  const status = Number(detail?.status || 0);
  if (CODE_MESSAGES[code]) return CODE_MESSAGES[code];
  if (status === 401) return CODE_MESSAGES.UNAUTHENTICATED;
  if (status === 403) return CODE_MESSAGES.PERMISSION_DENIED;
  if (status === 404) return "找不到您要查看的內容，請返回上一頁重新操作。";
  if (status === 409) return "這項操作尚未完成，請確認目前狀態後再試。";
  if (status === 429) return CODE_MESSAGES.RATE_LIMITED;
  return fallback;
}
