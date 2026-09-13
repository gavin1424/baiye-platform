import liff from "@line/liff";
import { SpinnerGap, WarningCircle } from "@phosphor-icons/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { orderingPublicApi, saveLineOrderingContext } from "../qr-ordering-client";

const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");

type LiffConfig = {
  merchant_id: string;
  display_name: string;
  qr: { code: string; table_label: string };
  liff_id: string;
  add_friend_url: string;
};

type LineOrderingSession = {
  context_id: string;
  merchant_id: string;
  qr_id: string;
  table_no: string;
  line_user_verified: boolean;
  expires_at: string;
};

const PENDING_QR_KEY = "baiye_line_ordering_pending_qr_v1";
const AUTH_RETRY_KEY = "baiye_line_ordering_auth_retry_v1";
const PENDING_QR_MAX_AGE_MS = 10 * 60 * 1000;

function validQrCode(value: string) {
  return /^[A-Za-z0-9_-]{8,64}$/.test(value);
}

function rememberQrCode(code: string) {
  try {
    window.sessionStorage.setItem(PENDING_QR_KEY, JSON.stringify({ code, saved_at: Date.now() }));
  } catch {
    // LIFF can still continue when storage is unavailable; the signed QR is
    // validated again by the Backend before an ordering context is issued.
  }
  return code;
}

function rememberedQrCode() {
  try {
    const pending = JSON.parse(window.sessionStorage.getItem(PENDING_QR_KEY) || "{}") as {
      code?: string;
      saved_at?: number;
    };
    if (
      validQrCode(pending.code || "") &&
      Number.isFinite(pending.saved_at) &&
      Date.now() - Number(pending.saved_at) <= PENDING_QR_MAX_AGE_MS
    ) return pending.code || "";
    window.sessionStorage.removeItem(PENDING_QR_KEY);
  } catch {
    window.sessionStorage.removeItem(PENDING_QR_KEY);
  }
  return "";
}

function qrCodeFromLocation() {
  const direct = new URLSearchParams(window.location.search).get("qr") || "";
  if (validQrCode(direct)) return rememberQrCode(direct);
  const state = new URLSearchParams(window.location.search).get("liff.state") || "";
  if (state) {
    try {
      const nested = new URL(decodeURIComponent(state), window.location.origin);
      const code = nested.searchParams.get("qr") || "";
      if (validQrCode(code)) return rememberQrCode(code);
    } catch {
      // Fall through to the short-lived value saved before LINE Login.
    }
  }
  return rememberedQrCode();
}

function enterOrdering(code: string) {
  try {
    window.sessionStorage.removeItem(PENDING_QR_KEY);
    window.sessionStorage.removeItem(AUTH_RETRY_KEY);
  } catch { /* no-op */ }
  window.location.replace(`${window.location.origin}/#/q/${encodeURIComponent(code)}`);
}

function retryLineLoginOnce(code: string, error: unknown) {
  const typed = error as { code?: string };
  if (typed?.code !== "LINE_ID_TOKEN_INVALID") return false;
  try {
    if (window.sessionStorage.getItem(AUTH_RETRY_KEY) === code) return false;
    window.sessionStorage.setItem(AUTH_RETRY_KEY, code);
  } catch {
    return false;
  }
  rememberQrCode(code);
  liff.logout();
  liff.login({ redirectUri: `${window.location.origin}/liff-ordering?qr=${encodeURIComponent(code)}` });
  return true;
}

async function establishLineContext(config: LiffConfig) {
  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("無法取得 LINE Login 授權，請重新開啟桌上 QR。");
  const session = await orderingPublicApi<LineOrderingSession>("/api/ordering/liff/session", {
    method: "POST",
    body: JSON.stringify({ qr: config.qr.code, id_token: idToken }),
  });
  if (!session.line_user_verified || session.merchant_id !== config.merchant_id || session.table_no !== config.qr.table_label) {
    throw new Error("LINE 桌號驗證不一致，請重新掃描桌上 QR。");
  }
  saveLineOrderingContext(config.qr.code, session.context_id);
}

async function enterOrderingWithOptionalLineIdentity(config: LiffConfig) {
  try {
    await establishLineContext(config);
  } catch (error) {
    if (retryLineLoginOnce(config.qr.code, error)) return;
    // LINE identity enriches the order when available, but a verified secure
    // table QR remains sufficient for guest ordering.
  }
  enterOrdering(config.qr.code);
}

export function LineLiffOrderingEntryPage() {
  const [phase, setPhase] = useState<"loading" | "error">("loading");
  const running = useRef(false);

  const initialize = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const qr = qrCodeFromLocation();
      if (!qr) throw new Error("桌號安全 QR 參數遺失，請重新掃描桌上 QR Code。");
      const response = await fetch(`${API}/api/ordering/liff/config?qr=${encodeURIComponent(qr)}`, {
        credentials: "include",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const error = new Error(data.error || "LINE LIFF 尚未完成設定。") as Error & { code?: string };
        error.code = data.code;
        throw error;
      }
      const next = data as LiffConfig;
      await liff.init({ liffId: next.liff_id, withLoginOnExternalBrowser: true });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      await enterOrderingWithOptionalLineIdentity(next);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    void initialize().catch((error) => {
      setPhase("error");
      console.error("Ordering entry initialization failed", error);
    });
  }, [initialize]);

  return (
    <main className="line-liff-entry">
      <section className="line-liff-card" aria-live="polite">
        <span className="line-liff-brand">百工牛肉麵</span>
        {phase === "loading" && <SpinnerGap className="line-liff-spinner" weight="bold" />}
        {phase === "error" && <WarningCircle className="line-liff-icon line-liff-error" weight="fill" />}
        <h1>{phase === "error" ? "點餐暫時無法開啟" : "正在開啟點餐"}</h1>
        <p>{phase === "error" ? "請重新掃描桌上 QR 或稍後再試。" : "正在載入菜單…"}</p>
        {phase === "error" && <button className="btn btn-outline" type="button" onClick={() => { setPhase("loading"); void initialize().catch((error) => { console.error("Ordering entry retry failed", error); setPhase("error"); }); }}>重新整理</button>}
      </section>
    </main>
  );
}
