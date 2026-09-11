import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { merchantOrderingApi } from "../qr-ordering-client";
import { adminApi } from "../admin-auth-client";
import { AdminModuleNav } from "../components/AdminModuleNav";
import { userFacingError } from "../user-facing-error";

const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");
const money = (minor: number) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(minor || 0) / 100);

export function MerchantContractPaymentPage() {
  const { paymentRequestId = "" } = useParams();
  const navigate = useNavigate();
  const [payment, setPayment] = useState<any>();
  const [notice, setNotice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    payment_at: "",
    transaction_reference: "",
    note: "",
  });
  const [evidence, setEvidence] = useState<File | null>(null);
  const load = async () => {
    try {
      const data: any = await merchantOrderingApi(
        `/api/merchant/contract-payments/${paymentRequestId}`,
      );
      setPayment(data.payment);
    } catch (error) {
      setNotice(userFacingError(error, "目前無法載入付款資料，請稍後再試。"));
    }
  };
  useEffect(() => {
    void load();
  }, [paymentRequestId]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setNotice("");
    try {
      const body = new FormData();
      body.set("payment_at", form.payment_at);
      body.set("transaction_reference", form.transaction_reference);
      body.set("note", form.note);
      if (evidence) body.set("evidence", evidence);
      const data: any = await merchantOrderingApi(
        `/api/merchant/contract-payments/${paymentRequestId}/submit`,
        { method: "POST", body },
      );
      setPayment(data.payment);
      setNotice(data.message || "付款資料已送出，待平台確認入帳。");
    } catch (error) {
      setNotice(userFacingError(error, "付款回報尚未完成，請再試一次。"));
    } finally {
      setSubmitting(false);
    }
  };
  if (!payment)
    return (
      <main className="page-shell">
        <section className="contract-summary-card">
          <h1>完成付款即可啟用商家服務</h1>
          <p>{notice || "付款資料載入中…"}</p>
        </section>
      </main>
    );
  const submitted = ["submitted", "confirmed"].includes(payment.status);
  return (
    <main className="page-shell merchant-payment-page">
      <header className="page-header">
        <p>創百業智慧鏈</p>
        <h1>完成付款即可啟用商家服務</h1>
      </header>
      {notice && (
        <div className="partner-message" role="status">
          {notice}
        </div>
      )}
      <section className="contract-summary-card payment-preview">
        <h2>付款 Preview</h2>
        <dl>
          <dt>方案名稱</dt>
          <dd>{payment.plan_name}</dd>
          <dt>契約版本</dt>
          <dd>{payment.contract_version}</dd>
          <dt>商家名稱</dt>
          <dd>{payment.merchant_name}</dd>
          <dt>契約編號</dt>
          <dd>{payment.contract_number}</dd>
          <dt>付款編號</dt>
          <dd>{payment.payment_reference}</dd>
          <dt>契約總額</dt>
          <dd>{money(payment.contract_total_amount_minor)}</dd>
          <dt>本次應付</dt>
          <dd>{money(payment.amount_due_minor)}</dd>
          <dt>簽約後餘額</dt>
          <dd>{money(payment.remaining_amount_minor)}</dd>
        </dl>
        {payment.trial_period_months > 0 && (
          <p>
            試用期間 {payment.trial_period_months} 個月；試用期結束尾款{" "}
            {money(payment.post_trial_payment_minor)}。
          </p>
        )}
      </section>
      <section className="contract-summary-card payment-provider-card">
        <h2>付款方式：{payment.payment_method_name}</h2>
        <p>收款對象：{payment.recipient_display_name}</p>
        {payment.qr_available ? (
          <img
            className="payment-qr"
            src={`${API}/api/merchant/contract-payments/${payment.id}/qr`}
            alt="街口支付收款 QR Code"
          />
        ) : (
          <p>付款 QR Code 尚未完成設定，請聯絡客服取得付款方式。</p>
        )}
        {payment.payment_deep_link && (
          <a className="btn btn-primary" href={payment.payment_deep_link}>
            開啟街口支付
          </a>
        )}
      </section>
      {!submitted ? (
        <form
          className="contract-summary-card payment-report-form"
          onSubmit={submit}
        >
          <h2>我已完成付款</h2>
          <label>
            付款時間
            <input
              type="datetime-local"
              value={form.payment_at}
              onChange={(e) => setForm({ ...form, payment_at: e.target.value })}
            />
          </label>
          <label>
            街口交易編號（若可取得）
            <input
              value={form.transaction_reference}
              onChange={(e) =>
                setForm({ ...form, transaction_reference: e.target.value })
              }
            />
          </label>
          <label>
            付款備註
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <label>
            付款證明圖片（JPEG、PNG、WebP，最多 5MB）
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(e) => setEvidence(e.target.files?.[0] || null)}
            />
          </label>
          <button className="btn btn-primary btn-lg" disabled={submitting}>
            {submitting ? "送出中…" : "我已完成付款"}
          </button>
        </form>
      ) : (
        <section className="contract-summary-card">
          <h2>
            {payment.status === "confirmed"
              ? "付款已確認，服務已啟用"
              : "付款資料已送出，待平台確認入帳。"}
          </h2>
        </section>
      )}
      <div className="payment-secondary-actions">
        <button
          className="btn btn-outline"
          onClick={() => navigate("/merchant/contracts")}
        >
          稍後付款
        </button>
      </div>
    </main>
  );
}

export function AdminMerchantPaymentsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  const [qr, setQr] = useState<File | null>(null);
  const [deepLink, setDeepLink] = useState("");
  const load = async () => {
    try {
      const data = await adminApi("/api/admin/merchant-payments");
      setItems(data.items || []);
    } catch (error) {
      setNotice(userFacingError(error, "付款審核資料載入失敗。"));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const configure = async () => {
    try {
      const body = new FormData();
      if (qr) body.set("qr_asset", qr);
      body.set("payment_deep_link", deepLink);
      await adminApi("/api/admin/merchant-payments/config/jkopay_manual_qr", {
        method: "POST",
        body,
      });
      setNotice("街口支付設定已更新。");
    } catch (error) {
      setNotice(userFacingError(error, "街口支付設定未完成。"));
    }
  };
  const act = async (item: any, action: "confirm" | "reject") => {
    const reason = action === "reject" ? window.prompt("請填寫退回原因") : "";
    if (action === "reject" && !reason) return;
    try {
      await adminApi(`/api/admin/merchant-payments/${item.id}/${action}`, {
        method: "POST",
        body: JSON.stringify(action === "reject" ? { reason } : {}),
      });
      setNotice(
        action === "confirm" ? "已確認收款並啟用服務。" : "付款確認已退回。",
      );
      await load();
    } catch (error) {
      setNotice(userFacingError(error, "付款審核操作未完成。"));
    }
  };
  return (
    <main className="admin-page">
      <AdminModuleNav current="contracts" />
      <header>
        <p>契約付款</p>
        <h1>商家付款確認</h1>
      </header>
      {notice && <div className="partner-message">{notice}</div>}
      <section className="admin-panel">
        <h2>街口支付設定</h2>
        <label>
          正式收款 QR Code
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => setQr(e.target.files?.[0] || null)}
          />
        </label>
        <label>
          正式付款 Deep Link（選填）
          <input
            value={deepLink}
            onChange={(e) => setDeepLink(e.target.value)}
          />
        </label>
        <button className="btn btn-primary" onClick={() => void configure()}>
          儲存付款設定
        </button>
      </section>
      <section className="admin-panel">
        <h2>付款回報</h2>
        {items.length ? (
          items.map((item) => (
            <article className="contract-list-item" key={item.id}>
              <strong>
                {item.merchant_name} · {item.plan_id}
              </strong>
              <span>
                {item.payment_reference} · {money(item.amount_due_minor)} ·{" "}
                {item.status}
              </span>
              <small>簽署時間：{item.signed_at}</small>
              {item.evidence_object_key && (
                <a
                  href={`${API}/api/admin/merchant-payments/${item.id}/evidence`}
                  target="_blank"
                  rel="noreferrer"
                >
                  查看付款證明
                </a>
              )}
              {item.status === "submitted" && (
                <div>
                  <button
                    className="btn btn-primary"
                    onClick={() => void act(item, "confirm")}
                  >
                    確認收款
                  </button>
                  <button
                    className="btn btn-outline"
                    onClick={() => void act(item, "reject")}
                  >
                    退回確認
                  </button>
                </div>
              )}
            </article>
          ))
        ) : (
          <p>目前沒有付款回報。</p>
        )}
      </section>
      <Link to="/admin/contracts">返回契約管理</Link>
    </main>
  );
}
