import { ArrowClockwise, Storefront } from "@phosphor-icons/react";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { merchantOrderingApi, merchantProtectedResourceState, type MerchantProtectedResourceState, type OrderingAdminOverview } from "../qr-ordering-client";
import { AdminQrOrderingPage } from "./AdminQrOrderingPage";

type GateState = "loading" | "ready" | MerchantProtectedResourceState;

function OrderingGateCard({ state, retry }: { state: Exclude<GateState, "loading" | "ready">; retry: () => void }) {
  if (state === "unauthenticated") return <main className="ordering-page"><section className="ordering-center-card ordering-merchant-login"><Storefront size={48} /><h1>商家 QR 點餐管理</h1><p>請先登入商家管理中心。</p><Link className="btn btn-primary" to="/merchant/login">前往商家登入</Link></section></main>;
  const copy = state === "permission_denied"
    ? { title: "權限不足", detail: "此帳號沒有 QR 點餐管理權限，請聯絡商家管理者。" }
    : state === "activation_required"
      ? { title: "商家尚未啟用", detail: "請先完成商家契約與啟用流程。" }
      : state === "rate_limited"
        ? { title: "請稍後再試", detail: "操作較為頻繁，請稍候再重新整理。" }
        : { title: "點餐管理暫時無法載入", detail: "點餐管理目前暫時無法載入，請重新整理。" };
  return <main className="ordering-page"><section className="ordering-center-card"><Storefront size={48} /><h1>{copy.title}</h1><p>{copy.detail}</p><button className="btn btn-primary" type="button" onClick={retry}><ArrowClockwise />重新整理</button></section></main>;
}

export function MerchantOrderingPage() {
  const [overview, setOverview] = useState<OrderingAdminOverview | null>(null);
  const [gate, setGate] = useState<GateState>("loading");

  const load = useCallback(async () => {
    setGate("loading");
    try {
      const data = await merchantOrderingApi<OrderingAdminOverview>("/api/merchant-admin/ordering/overview");
      setOverview(data);
      setGate("ready");
    } catch (error) {
      setOverview(null);
      setGate(merchantProtectedResourceState(error));
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleChildError = useCallback((error: unknown) => {
    setOverview(null);
    setGate(merchantProtectedResourceState(error));
    return true;
  }, []);

  if (gate === "loading") return <main className="ordering-page"><section className="ordering-loading"><span className="ordering-spinner" /><p>正在載入點餐管理…</p></section></main>;
  if (gate !== "ready" || !overview) return <OrderingGateCard state={gate === "ready" ? "unavailable" : gate} retry={() => void load()} />;
  return <AdminQrOrderingPage merchantMode fixedMerchantId={overview.merchant_id} onResourceError={handleChildError} />;
}
