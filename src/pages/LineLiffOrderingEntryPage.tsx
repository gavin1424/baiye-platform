import liff from "@line/liff";
import { CheckCircle, SpinnerGap, WarningCircle } from "@phosphor-icons/react";
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

function qrCodeFromLocation() {
  const direct = new URLSearchParams(window.location.search).get("qr") || "";
  if (/^[A-Za-z0-9_-]{8,64}$/.test(direct)) return direct;
  const state = new URLSearchParams(window.location.search).get("liff.state") || "";
  if (!state) return "";
  try {
    const nested = new URL(decodeURIComponent(state), window.location.origin);
    const code = nested.searchParams.get("qr") || "";
    return /^[A-Za-z0-9_-]{8,64}$/.test(code) ? code : "";
  } catch { return ""; }
}

function enterOrdering(code: string) {
  window.location.replace(`${window.location.origin}/#/q/${encodeURIComponent(code)}`);
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

export function LineLiffOrderingEntryPage() {
  const [phase, setPhase] = useState<"loading" | "friend" | "error">("loading");
  const [config, setConfig] = useState<LiffConfig | null>(null);
  const [message, setMessage] = useState("正在連接 LINE…");
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
      setConfig(next);
      await liff.init({ liffId: next.liff_id, withLoginOnExternalBrowser: true });
      if (!liff.isLoggedIn()) {
        liff.login({ redirectUri: window.location.href });
        return;
      }
      const friendship = await liff.getFriendship();
      if (friendship.friendFlag) {
        setMessage(`已加入好友，正在開啟 ${next.qr.table_label || "桌邊"} 菜單…`);
        await establishLineContext(next);
        enterOrdering(next.qr.code);
        return;
      }
      setPhase("friend");
      setMessage(`加入${next.display_name} LINE 官方帳號後即可直接點餐。`);
    } finally {
      running.current = false;
    }
  }, []);

  useEffect(() => {
    void initialize().catch((error) => {
      setPhase("error");
      setMessage(error instanceof Error ? error.message : "LINE 入口暫時無法使用。");
    });
  }, [initialize]);

  const requestFriendship = async () => {
    if (!config) return;
    setPhase("loading");
    setMessage("正在開啟 LINE 加好友確認…");
    try {
      await liff.requestFriendship();
      const friendship = await liff.getFriendship();
      if (!friendship.friendFlag) {
        setPhase("friend");
        setMessage("尚未完成加好友，請確認後再繼續。");
        return;
      }
      setMessage(`加好友完成，正在開啟 ${config.qr.table_label || "桌邊"} 菜單…`);
      await establishLineContext(config);
      enterOrdering(config.qr.code);
    } catch (error) {
      setPhase("friend");
      setMessage(error instanceof Error ? error.message : "無法開啟加好友視窗，請稍後再試。");
    }
  };

  return (
    <main className="line-liff-entry">
      <section className="line-liff-card" aria-live="polite">
        <span className="line-liff-brand">百工牛肉麵</span>
        {phase === "loading" && <SpinnerGap className="line-liff-spinner" weight="bold" />}
        {phase === "friend" && <CheckCircle className="line-liff-icon" weight="fill" />}
        {phase === "error" && <WarningCircle className="line-liff-icon line-liff-error" weight="fill" />}
        <h1>{phase === "friend" ? "加入好友後開始點餐" : phase === "error" ? "LINE 點餐尚未就緒" : "LINE 加好友點餐"}</h1>
        <p>{message}</p>
        {config?.qr.table_label && <strong>桌號 {config.qr.table_label}</strong>}
        {phase === "friend" && <button className="btn btn-primary btn-lg" type="button" onClick={() => void requestFriendship()}>加入好友並繼續</button>}
        {phase === "friend" && config?.add_friend_url && <a className="btn btn-outline" href={config.add_friend_url}>改用 LINE 官方帳號頁面加入</a>}
        {phase === "error" && <button className="btn btn-outline" type="button" onClick={() => { setPhase("loading"); setMessage("正在重新連接 LINE…"); void initialize().catch((error) => { setPhase("error"); setMessage(error instanceof Error ? error.message : "LINE 入口暫時無法使用。"); }); }}>重新整理</button>}
      </section>
    </main>
  );
}
