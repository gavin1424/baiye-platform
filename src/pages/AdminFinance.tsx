import { useEffect, useMemo, useState } from "react";
import { AdminModuleNav } from "../components/AdminModuleNav";
import { adminApi, adminDownload } from "../admin-auth-client";
import {
  getTaipeiMonthEnd,
  getTaipeiMonthStart,
  getTaipeiToday,
} from "../lib/taipei-date";

const paymentLabels: Record<string, string> = {
  card: "信用卡 / 金融卡",
  atm: "ATM",
  virtual_account: "虛擬帳號",
  bank_transfer: "銀行轉帳",
  line_pay: "LINE Pay",
  apple_pay: "Apple Pay",
  google_pay: "Google Pay",
  e_wallet: "電子支付",
  convenience_store: "超商付款",
  cash: "現金",
  cheque: "支票",
  other: "其他",
};
const planLabels: Record<string, string> = {
  upfront_18000: "一次付清方案",
  sales_offset_18000: "銷售抵付方案",
};
const moneyMajor = (value: unknown) =>
  new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
const moneyMinor = (value: unknown) => moneyMajor(Number(value || 0) / 100);
const csvValue = (value: unknown) =>
  `"${String(value ?? "").replaceAll('"', '""')}"`;
const idempotencyKey = (action: string, id: string) =>
  `${action}-${id}-${crypto.randomUUID()}`;

type Tab =
  | "overview"
  | "payments"
  | "deposits"
  | "statements"
  | "offset"
  | "rules"
  | "audit";
type Merchant = { id: string; name: string; merchant_code?: string };
type Payment = Record<string, string | number | null>;
type Statement = Record<string, string | number | null> & {
  id: string;
  statement_no: string;
  merchant_id: string;
  merchant_name: string;
  status: string;
};
type Summary = {
  month_gross: number;
  month_refunds: number;
  month_fees: number;
  month_net: number;
  pending: number;
  expenses: number;
  profit: number;
  payment_count: number;
  methods: Array<{ payment_method: string; total: number }>;
  merchants: Array<{
    id: string;
    merchant_code: string;
    name: string;
    amount_due: number;
    amount_paid: number;
  }>;
};
type DialogState = null | {
  action: "mark-paid" | "void" | "adjustments" | "source" | "variance-lock";
  item: Statement | Payment;
};

const tabs: Array<[Tab, string]> = [
  ["overview", "財務總覽"],
  ["payments", "付款紀錄"],
  ["deposits", "訂金代收"],
  ["statements", "月結對帳單"],
  ["offset", "NT$18,000 抵付進度"],
  ["rules", "規則設定"],
  ["audit", "Audit"],
];

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function LegacyOverview({ summary }: { summary: Summary | null }) {
  const metrics = summary
    ? [
        ["本月總收款", summary.month_gross],
        ["本月退款", summary.month_refunds],
        ["本月手續費", summary.month_fees],
        ["本月淨收入", summary.month_net],
        ["待收款", summary.pending],
        ["本月支出", summary.expenses],
        ["本月損益", summary.profit],
        ["付款筆數", summary.payment_count],
      ]
    : [];
  return (
    <>
      <section className="finance-grid">
        {metrics.map(([name, value]) => (
          <article className="finance-metric" key={String(name)}>
            <span>{name}</span>
            <strong>{name === "付款筆數" ? value : moneyMajor(value)}</strong>
          </article>
        ))}
      </section>
      <div className="finance-layout">
        <article className="finance-panel">
          <h2>付款方式統計</h2>
          <table className="finance-table">
            <tbody>
              {summary?.methods.length ? (
                summary.methods.map((item) => (
                  <tr key={item.payment_method}>
                    <td>
                      {paymentLabels[item.payment_method] ||
                        item.payment_method}
                    </td>
                    <td>{moneyMajor(item.total)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td>目前沒有付款資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
        <article className="finance-panel">
          <h2>商家應收摘要</h2>
          <table className="finance-table">
            <thead>
              <tr>
                <th>商家</th>
                <th>應收</th>
                <th>已收</th>
              </tr>
            </thead>
            <tbody>
              {summary?.merchants.length ? (
                summary.merchants.map((item) => (
                  <tr key={item.id}>
                    <td>
                      {item.name}
                      <br />
                      <small>{item.merchant_code}</small>
                    </td>
                    <td>{moneyMajor(item.amount_due)}</td>
                    <td>{moneyMajor(item.amount_paid)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3}>目前沒有商家應收資料</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      </div>
    </>
  );
}

function PaymentLedger({
  payments,
  merchants,
  onSaved,
}: {
  payments: Payment[];
  merchants: Merchant[];
  onSaved: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    merchant_id: merchants[0]?.id || "",
    amount: "",
    payment_method: "bank_transfer",
    note: "",
    status: "paid",
  });
  useEffect(() => {
    if (!form.merchant_id && merchants[0])
      setForm((value) => ({ ...value, merchant_id: merchants[0].id }));
  }, [merchants, form.merchant_id]);
  const exportCsv = () => {
    const rows = [
      [
        "日期",
        "商家",
        "訂單",
        "付款方式",
        "Payment Provider",
        "實收金額",
        "手續費",
        "淨額",
        "狀態",
        "交易編號",
        "來源",
      ],
      ...payments.map((item) => [
        item.paid_at || item.created_at,
        item.merchant_name,
        item.order_no,
        paymentLabels[String(item.payment_method)] || item.payment_method,
        item.payment_provider,
        item.gross_amount,
        item.fee_amount,
        item.net_amount,
        item.status,
        item.provider_trade_no || item.payment_no,
        item.source === "manual" ? "人工確認" : "自動入帳",
      ]),
    ];
    downloadBlob(
      new Blob(
        [
          "\uFEFF" +
            rows.map((row) => row.map(csvValue).join(",")).join("\r\n"),
        ],
        { type: "text/csv;charset=utf-8" },
      ),
      "baiye-finance-payments.csv",
    );
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    await adminApi("/api/finance/payments/manual", {
      method: "POST",
      body: JSON.stringify({ ...form, amount: Number(form.amount) }),
    });
    setForm((value) => ({ ...value, amount: "", note: "" }));
    await onSaved("人工付款已寫入統一帳本。");
  };
  return (
    <div className="finance-layout">
      <article className="finance-panel">
        <div className="finance-panel-heading">
          <h2>付款紀錄</h2>
          <button type="button" onClick={exportCsv}>
            匯出付款明細 CSV
          </button>
        </div>
        <div className="finance-table-scroll">
          <table className="finance-table">
            <thead>
              <tr>
                <th>日期</th>
                <th>商家 / 訂單</th>
                <th>付款方式</th>
                <th>Provider</th>
                <th>實收</th>
                <th>手續費</th>
                <th>淨額</th>
                <th>狀態</th>
                <th>交易編號</th>
                <th>來源</th>
              </tr>
            </thead>
            <tbody>
              {payments.length ? (
                payments.map((item) => (
                  <tr key={String(item.id)}>
                    <td>
                      {String(item.paid_at || item.created_at || "").slice(
                        0,
                        10,
                      )}
                    </td>
                    <td>
                      {String(item.merchant_name || "")}
                      <br />
                      <small>{String(item.order_no || "—")}</small>
                    </td>
                    <td>
                      {paymentLabels[String(item.payment_method)] ||
                        String(item.payment_method || "")}
                    </td>
                    <td>{String(item.payment_provider || "—")}</td>
                    <td>{moneyMajor(item.gross_amount)}</td>
                    <td>{moneyMajor(item.fee_amount)}</td>
                    <td>{moneyMajor(item.net_amount)}</td>
                    <td>{String(item.status)}</td>
                    <td>
                      {String(item.provider_trade_no || item.payment_no || "—")}
                    </td>
                    <td>
                      {item.source === "manual" ? "人工確認" : "自動入帳"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10}>目前沒有付款紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </article>
      <aside>
        <article className="finance-panel">
          <h2>新增人工付款</h2>
          <p className="finance-note">
            人工付款預設不具 Settlement 資格，須另行分類及覆核。
          </p>
          <form className="finance-form" onSubmit={submit}>
            <label>
              商家
              <select
                value={form.merchant_id}
                onChange={(event) =>
                  setForm({ ...form, merchant_id: event.target.value })
                }
              >
                {merchants.map((merchant) => (
                  <option value={merchant.id} key={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              收款金額
              <input
                inputMode="decimal"
                value={form.amount}
                onChange={(event) =>
                  setForm({ ...form, amount: event.target.value })
                }
                required
              />
            </label>
            <label>
              付款方式
              <select
                value={form.payment_method}
                onChange={(event) =>
                  setForm({ ...form, payment_method: event.target.value })
                }
              >
                {Object.entries(paymentLabels).map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              狀態
              <select
                value={form.status}
                onChange={(event) =>
                  setForm({ ...form, status: event.target.value })
                }
              >
                <option value="paid">paid</option>
                <option value="pending">pending</option>
              </select>
            </label>
            <label>
              備註
              <textarea
                value={form.note}
                onChange={(event) =>
                  setForm({ ...form, note: event.target.value })
                }
              />
            </label>
            <button type="submit">新增付款</button>
          </form>
        </article>
      </aside>
    </div>
  );
}

function ActionDialog({
  dialog,
  busy,
  onClose,
  onSubmit,
}: {
  dialog: Exclude<DialogState, null>;
  busy: boolean;
  onClose: () => void;
  onSubmit: (data: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, string>>({
    transfer_date: getTaipeiToday(),
    transfer_reference: "",
    reason: "",
    amount: "",
    collection_role: "manual_unclassified",
    order_total: "",
    actual_collected: "",
    variance_reason: "",
    effective_date: getTaipeiToday(),
  });
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (dialog.action === "mark-paid")
      onSubmit({
        transfer_date: form.transfer_date,
        transfer_reference: form.transfer_reference,
        transfer_amount_minor: Number(dialog.item.merchant_payable_minor),
      });
    if (dialog.action === "void") onSubmit({ reason: form.reason });
    if (dialog.action === "adjustments")
      onSubmit({
        reason: form.reason,
        amount_minor: Math.round(Number(form.amount) * 100),
        adjustment_type: Number(form.amount) < 0 ? "refund" : "correction",
        effective_date: form.effective_date,
        confirm_review: true,
      });
    if (dialog.action === "variance-lock")
      onSubmit({
        deposit_variance_reason: form.variance_reason,
        confirm_variance_review: true,
      });
    if (dialog.action === "source")
      onSubmit({
        collection_role: form.collection_role,
        settlement_eligible: form.collection_role === "platform_deposit",
        order_total_amount_minor: Math.round(Number(form.order_total) * 100),
        actual_collected_amount_minor: Math.round(
          Number(form.actual_collected) * 100,
        ),
        confirm_source_review: true,
      });
  };
  return (
    <div className="finance-dialog-backdrop" role="presentation">
      <section
        className="finance-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finance-dialog-title"
      >
        <h2 id="finance-dialog-title">
          {dialog.action === "mark-paid"
            ? "標記已匯款"
            : dialog.action === "void"
              ? "作廢草稿"
              : dialog.action === "adjustments"
                ? "建立下一期調整"
                : dialog.action === "source"
                  ? "覆核付款來源"
                  : "覆核訂金差異"}
        </h2>
        <form className="finance-form" onSubmit={submit}>
          {dialog.action === "mark-paid" && (
            <>
              <label>
                匯款日期（Asia/Taipei）
                <input
                  type="date"
                  value={form.transfer_date}
                  onChange={(event) =>
                    setForm({ ...form, transfer_date: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                匯款 reference
                <input
                  value={form.transfer_reference}
                  onChange={(event) =>
                    setForm({ ...form, transfer_reference: event.target.value })
                  }
                  required
                />
              </label>
            </>
          )}
          {dialog.action === "void" && (
            <label>
              作廢原因
              <textarea
                value={form.reason}
                onChange={(event) =>
                  setForm({ ...form, reason: event.target.value })
                }
                required
              />
            </label>
          )}
          {dialog.action === "adjustments" && (
            <>
              <label>
                調整金額（元；退款輸入負數）
                <input
                  inputMode="decimal"
                  value={form.amount}
                  onChange={(event) =>
                    setForm({ ...form, amount: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                生效日期（Asia/Taipei）
                <input
                  type="date"
                  value={form.effective_date}
                  onChange={(event) =>
                    setForm({ ...form, effective_date: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                正式原因
                <textarea
                  value={form.reason}
                  onChange={(event) =>
                    setForm({ ...form, reason: event.target.value })
                  }
                  required
                />
              </label>
            </>
          )}
          {dialog.action === "variance-lock" && (
            <label>
              訂金差異原因
              <textarea
                value={form.variance_reason}
                onChange={(event) =>
                  setForm({ ...form, variance_reason: event.target.value })
                }
                required
              />
            </label>
          )}
          {dialog.action === "source" && (
            <>
              <label>
                代收角色
                <select
                  value={form.collection_role}
                  onChange={(event) =>
                    setForm({ ...form, collection_role: event.target.value })
                  }
                >
                  <option value="manual_unclassified">人工未分類</option>
                  <option value="platform_deposit">平台代收訂金</option>
                  <option value="merchant_direct">店家直接收款</option>
                  <option value="order_balance">訂單尾款</option>
                  <option value="full_payment">全額付款</option>
                  <option value="test">測試付款</option>
                </select>
              </label>
              <label>
                核准訂單總額（元）
                <input
                  inputMode="decimal"
                  value={form.order_total}
                  onChange={(event) =>
                    setForm({ ...form, order_total: event.target.value })
                  }
                  required
                />
              </label>
              <label>
                實際代收金額（元）
                <input
                  inputMode="decimal"
                  value={form.actual_collected}
                  onChange={(event) =>
                    setForm({ ...form, actual_collected: event.target.value })
                  }
                  required
                />
              </label>
            </>
          )}
          <div className="finance-dialog-actions">
            <button type="button" onClick={onClose} disabled={busy}>
              取消
            </button>
            <button type="submit" disabled={busy}>
              {busy ? "處理中…" : "確認送出"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function StatementDetail({ value }: { value: Record<string, unknown> }) {
  const items = (value.items as Payment[] | undefined) || [];
  const adjustments = (value.adjustments as Payment[] | undefined) || [];
  const events = (value.events as Payment[] | undefined) || [];
  const documents = (value.documents as Payment[] | undefined) || [];
  return (
    <article className="finance-panel finance-detail">
      <h2>對帳單明細</h2>
      <dl>
        <dt>編號</dt>
        <dd>{String(value.statement_no)}</dd>
        <dt>預期訂金</dt>
        <dd>{moneyMinor(value.expected_deposit_amount_minor)}</dd>
        <dt>實際訂金</dt>
        <dd>{moneyMinor(value.actual_deposit_collected_minor)}</dd>
        <dt>差異</dt>
        <dd>{moneyMinor(value.deposit_variance_minor)}</dd>
        <dt>實際手續費</dt>
        <dd>{moneyMinor(value.actual_fee_total_minor)}</dd>
        <dt>估算手續費</dt>
        <dd>{moneyMinor(value.estimated_fee_total_minor)}</dd>
      </dl>
      <h3>來源交易</h3>
      <div className="finance-table-scroll">
        <table className="finance-table">
          <thead>
            <tr>
              <th>付款</th>
              <th>訂單總額</th>
              <th>預期／實際訂金</th>
              <th>手續費</th>
              <th>來源</th>
              <th>時間</th>
            </tr>
          </thead>
          <tbody>
            {items.length ? (
              items.map((item) => (
                <tr key={String(item.id)}>
                  <td>{String(item.payment_id || item.source_id)}</td>
                  <td>{moneyMinor(item.order_total_amount_minor)}</td>
                  <td>
                    {moneyMinor(item.expected_deposit_amount_minor)} /{" "}
                    {moneyMinor(item.actual_deposit_amount_minor)}
                  </td>
                  <td>{moneyMinor(item.processing_fee_minor)}</td>
                  <td>{String(item.processing_fee_source)}</td>
                  <td>{String(item.occurred_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>沒有來源交易</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3>調整</h3>
      <div className="finance-table-scroll">
        <table className="finance-table">
          <thead>
            <tr>
              <th>類型</th>
              <th>金額</th>
              <th>訂金／平台費／抵付回沖</th>
              <th>原因</th>
              <th>狀態</th>
            </tr>
          </thead>
          <tbody>
            {adjustments.length ? (
              adjustments.map((item) => (
                <tr key={String(item.id)}>
                  <td>{String(item.adjustment_type)}</td>
                  <td>{moneyMinor(item.amount_minor)}</td>
                  <td>
                    {moneyMinor(item.deposit_reversal_minor)} /{" "}
                    {moneyMinor(item.platform_fee_reversal_minor)} /{" "}
                    {moneyMinor(item.offset_reversal_minor)}
                  </td>
                  <td>{String(item.reason)}</td>
                  <td>{String(item.status)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>沒有調整</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3>Audit</h3>
      <div className="finance-table-scroll">
        <table className="finance-table">
          <thead>
            <tr>
              <th>時間</th>
              <th>事件</th>
              <th>狀態</th>
              <th>操作者</th>
            </tr>
          </thead>
          <tbody>
            {events.length ? (
              events.map((item) => (
                <tr key={String(item.id)}>
                  <td>{String(item.created_at)}</td>
                  <td>{String(item.event_type)}</td>
                  <td>
                    {String(item.from_status || "—")} →{" "}
                    {String(item.to_status || "—")}
                  </td>
                  <td>{String(item.actor_id || "system")}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>沒有 Audit</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <h3>PDF 版本</h3>
      <div className="finance-table-scroll">
        <table className="finance-table">
          <thead>
            <tr>
              <th>版本</th>
              <th>狀態</th>
              <th>Hash</th>
              <th>建立時間</th>
            </tr>
          </thead>
          <tbody>
            {documents.length ? (
              documents.map((item) => (
                <tr key={String(item.pdf_version)}>
                  <td>v{String(item.pdf_version)}</td>
                  <td>{String(item.pdf_status)}</td>
                  <td>
                    <code>{String(item.pdf_hash)}</code>
                  </td>
                  <td>{String(item.created_at)}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>尚無 PDF</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function AdminFinancePage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [sources, setSources] = useState<Payment[]>([]);
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [statements, setStatements] = useState<Statement[]>([]);
  const [auditEvents, setAuditEvents] = useState<Payment[]>([]);
  const [selected, setSelected] = useState<Record<string, unknown> | null>(
    null,
  );
  const [dialog, setDialog] = useState<DialogState>(null);
  const [filters, setFilters] = useState({
    q: "",
    merchant_id: "",
    month: getTaipeiMonthStart().slice(0, 7),
    status: "",
  });
  const [period, setPeriod] = useState({
    merchant_id: "",
    period_start: getTaipeiMonthStart(),
    period_end: getTaipeiMonthEnd(),
  });
  const [preview, setPreview] = useState<Record<string, number> | null>(null);
  const [draftIdempotencyKey, setDraftIdempotencyKey] = useState("");
  const [transactionCount, setTransactionCount] = useState(0);
  const request = (path: string, init: RequestInit = {}) =>
    adminApi(`/api/finance${path}`, init);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [
        summaryData,
        paymentData,
        merchantData,
        statementData,
        auditData,
        sourceData,
      ] = await Promise.all([
        request("/summary"),
        request("/payments"),
        request("/merchants"),
        request("/settlements?limit=100"),
        request("/settlements/audit"),
        request("/settlement-sources"),
      ]);
      setSummary(summaryData);
      setPayments(paymentData.items || []);
      setMerchants(merchantData.items || []);
      setStatements(statementData.items || []);
      setAuditEvents(auditData.items || []);
      setSources(sourceData.items || []);
      const first = merchantData.items?.[0]?.id || "";
      setPeriod((value) => ({
        ...value,
        merchant_id: value.merchant_id || first,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "讀取失敗");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const refresh = async (message: string) => {
    setNotice(message);
    setError("");
    await load();
  };
  const previewSettlement = async () => {
    setBusy(true);
    try {
      const data = await request("/settlements/preview", {
        method: "POST",
        body: JSON.stringify(period),
      });
      setPreview(data.preview);
      setDraftIdempotencyKey(
        idempotencyKey(
          "create",
          `${period.merchant_id}-${period.period_start}-${period.period_end}`,
        ),
      );
      setTransactionCount(data.transaction_count);
      setNotice("預覽已依 Asia/Taipei 重新計算，尚未寫入資料。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "預覽失敗");
    } finally {
      setBusy(false);
    }
  };
  const createDraft = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      const data = await request("/settlements", {
        method: "POST",
        headers: { "idempotency-key": draftIdempotencyKey },
        body: JSON.stringify({
          ...period,
          idempotency_key: draftIdempotencyKey,
        }),
      });
      setPreview(null);
      setTab("statements");
      await refresh(`已建立草稿 ${data.statement_no}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "建立草稿失敗");
    } finally {
      setBusy(false);
    }
  };
  const mutate = async (
    item: Statement,
    action: string,
    body: Record<string, unknown> = {},
  ) => {
    setBusy(true);
    const key = idempotencyKey(action, item.id);
    try {
      await request(`/settlements/${item.id}/${action}`, {
        method: "POST",
        headers: { "idempotency-key": key },
        body: JSON.stringify({ ...body, idempotency_key: key }),
      });
      setDialog(null);
      await refresh("對帳單狀態已更新並記錄 Audit。");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失敗");
    } finally {
      setBusy(false);
    }
  };
  const openStatement = async (id: string) => {
    try {
      setSelected(await request(`/settlements/${id}`));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "讀取明細失敗");
    }
  };
  const download = async (item: Statement, kind: "pdf" | "csv") => {
    try {
      const file = await adminDownload(
        `/api/finance/settlements/${item.id}/${kind}`,
      );
      downloadBlob(file.blob, file.filename);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "下載失敗");
    }
  };

  const filteredStatements = statements.filter(
    (item) =>
      (!filters.q ||
        item.statement_no.includes(filters.q) ||
        item.merchant_name.includes(filters.q)) &&
      (!filters.merchant_id || item.merchant_id === filters.merchant_id) &&
      (!filters.month || String(item.period_start).startsWith(filters.month)) &&
      (!filters.status || item.status === filters.status),
  );
  const offsetRows = useMemo(() => {
    const map = new Map<string, Statement>();
    statements
      .filter(
        (item) =>
          item.payment_plan === "sales_offset_18000" &&
          ["locked", "paid"].includes(item.status),
      )
      .forEach((item) => {
        const current = map.get(item.merchant_id);
        if (
          !current ||
          Number(item.cumulative_offset_amount_minor) >
            Number(current.cumulative_offset_amount_minor)
        )
          map.set(item.merchant_id, item);
      });
    return [...map.values()];
  }, [statements]);

  return (
    <main className="finance-shell">
      <AdminModuleNav current="finance" />
      <header className="finance-hero">
        <div>
          <h1>財務管理 / 金流帳本</h1>
          <p>既有付款帳本與選配的訂金代收月結服務分開管理。</p>
        </div>
      </header>
      <nav className="finance-tabs" aria-label="財務分頁">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </nav>
      {loading && <p className="finance-note">正在讀取正式資料…</p>}
      {error && (
        <p className="finance-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="finance-success" role="status">
          {notice}
        </p>
      )}
      {!loading && tab === "overview" && <LegacyOverview summary={summary} />}
      {!loading && tab === "payments" && (
        <PaymentLedger
          payments={payments}
          merchants={merchants}
          onSaved={refresh}
        />
      )}
      {!loading && tab === "deposits" && (
        <article className="finance-panel">
          <h2>付款來源資格</h2>
          <p className="finance-note">
            只有覆核為「平台代收訂金」且符合資格的付款才會進入月結；舊付款及人工付款預設不納入。
          </p>
          <div className="finance-table-scroll">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>付款</th>
                  <th>商家</th>
                  <th>訂單</th>
                  <th>來源</th>
                  <th>角色</th>
                  <th>資格</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {sources.length ? (
                  sources.map((item) => (
                    <tr key={String(item.payment_id)}>
                      <td>{String(item.payment_no)}</td>
                      <td>{String(item.merchant_name)}</td>
                      <td>{String(item.order_no || "未連結")}</td>
                      <td>
                        {item.source === "manual" ? "人工確認" : "自動入帳"}
                      </td>
                      <td>{String(item.collection_role || "尚未分類")}</td>
                      <td>
                        {Number(item.settlement_eligible)
                          ? "可納入"
                          : "不可納入"}
                      </td>
                      <td>
                        <button
                          onClick={() => setDialog({ action: "source", item })}
                        >
                          覆核
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>目前沒有付款來源</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
      {!loading && tab === "statements" && (
        <>
          <article className="finance-panel">
            <h2>月結對帳單</h2>
            <div className="finance-filters">
              <input
                aria-label="搜尋對帳單"
                placeholder="對帳單編號或商家"
                value={filters.q}
                onChange={(event) =>
                  setFilters({ ...filters, q: event.target.value })
                }
              />
              <select
                aria-label="商家篩選"
                value={filters.merchant_id}
                onChange={(event) =>
                  setFilters({ ...filters, merchant_id: event.target.value })
                }
              >
                <option value="">全部商家</option>
                {merchants.map((merchant) => (
                  <option value={merchant.id} key={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
              <input
                aria-label="月份篩選"
                type="month"
                value={filters.month}
                onChange={(event) =>
                  setFilters({ ...filters, month: event.target.value })
                }
              />
              <select
                aria-label="狀態篩選"
                value={filters.status}
                onChange={(event) =>
                  setFilters({ ...filters, status: event.target.value })
                }
              >
                <option value="">全部狀態</option>
                {["draft", "review", "locked", "paid", "void"].map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>
            <div className="finance-table-scroll">
              <table className="finance-table">
                <thead>
                  <tr>
                    <th>編號</th>
                    <th>商家</th>
                    <th>期間</th>
                    <th>預期／實際訂金</th>
                    <th>手續費</th>
                    <th>應撥</th>
                    <th>待返還平台</th>
                    <th>下期承接</th>
                    <th>狀態</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatements.length ? (
                    filteredStatements.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <button
                            className="finance-link"
                            onClick={() => void openStatement(item.id)}
                          >
                            {item.statement_no}
                          </button>
                        </td>
                        <td>{item.merchant_name}</td>
                        <td>
                          {String(item.period_start)}～{String(item.period_end)}
                        </td>
                        <td>
                          {moneyMinor(item.expected_deposit_amount_minor)} /{" "}
                          {moneyMinor(item.actual_deposit_collected_minor)}
                          {Number(item.deposit_variance_minor) !== 0 && (
                            <strong className="finance-warning">
                              {" "}
                              差異 {moneyMinor(item.deposit_variance_minor)}
                            </strong>
                          )}
                        </td>
                        <td>
                          實際 {moneyMinor(item.actual_fee_total_minor)}
                          <br />
                          估算 {moneyMinor(item.estimated_fee_total_minor)}
                        </td>
                        <td>{moneyMinor(item.merchant_payable_minor)}</td>
                        <td>{moneyMinor(item.merchant_due_to_platform_minor)}</td>
                        <td>{moneyMinor(item.carry_forward_balance_minor)}</td>
                        <td>{item.status}</td>
                        <td className="finance-row-actions">
                          {item.status === "draft" && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void mutate(item, "submit-review")
                                }
                              >
                                送審
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setDialog({ action: "void", item })
                                }
                              >
                                作廢
                              </button>
                            </>
                          )}
                          {item.status === "review" && (
                            <>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  void mutate(item, "return-draft")
                                }
                              >
                                退回
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  Number(item.deposit_variance_minor)
                                    ? setDialog({
                                        action: "variance-lock",
                                        item,
                                      })
                                    : void mutate(item, "lock")
                                }
                              >
                                鎖定
                              </button>
                              <button
                                disabled={busy}
                                onClick={() =>
                                  setDialog({ action: "void", item })
                                }
                              >
                                作廢
                              </button>
                            </>
                          )}
                          {item.status === "locked" && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                setDialog({ action: "mark-paid", item })
                              }
                            >
                              標記匯款
                            </button>
                          )}
                          {["locked", "paid"].includes(item.status) && (
                            <button
                              disabled={busy}
                              onClick={() =>
                                setDialog({ action: "adjustments", item })
                              }
                            >
                              建立調整
                            </button>
                          )}
                          {["locked", "paid"].includes(item.status) && (
                            <>
                              <button
                                onClick={() => void download(item, "pdf")}
                              >
                                PDF
                              </button>
                              <button
                                onClick={() => void download(item, "csv")}
                              >
                                CSV
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={8}>沒有符合篩選條件的對帳單</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </article>
          {selected && <StatementDetail value={selected} />}
        </>
      )}
      {!loading && tab === "offset" && (
        <article className="finance-panel">
          <h2>NT$18,000 抵付進度（依商家彙總）</h2>
          <div className="finance-table-scroll">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>商家</th>
                  <th>付款方案</th>
                  <th>目標</th>
                  <th>累計</th>
                  <th>剩餘</th>
                  <th>進度</th>
                  <th>最近一期</th>
                  <th>完成日</th>
                  <th>抵付後平台費</th>
                </tr>
              </thead>
              <tbody>
                {offsetRows.length ? (
                  offsetRows.map((item) => {
                    const target = Number(
                      item.offset_target_amount_minor || 1_800_000,
                    );
                    const complete =
                      Number(item.remaining_offset_amount_minor) === 0;
                    return (
                      <tr key={item.merchant_id}>
                        <td>{item.merchant_name}</td>
                        <td>{planLabels[String(item.payment_plan)]}</td>
                        <td>{moneyMinor(target)}</td>
                        <td>
                          {moneyMinor(item.cumulative_offset_amount_minor)}
                        </td>
                        <td>
                          {moneyMinor(item.remaining_offset_amount_minor)}
                        </td>
                        <td>
                          {Math.min(
                            100,
                            Math.round(
                              (Number(item.cumulative_offset_amount_minor) /
                                target) *
                                100,
                            ),
                          )}
                          %
                        </td>
                        <td>{moneyMinor(item.current_offset_amount_minor)}</td>
                        <td>
                          {complete
                            ? String(item.paid_at || item.locked_at || "完成")
                            : "—"}
                        </td>
                        <td>
                          {Number(item.continue_platform_fee_after_offset)
                            ? "依契約持續計費"
                            : "停止"}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9}>目前沒有銷售抵付方案資料</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </article>
      )}
      {!loading && tab === "rules" && (
        <>
          <RulesPanel
            merchants={merchants}
            request={request}
            onSaved={refresh}
          />
          <PlatformIdentityPanel request={request} onSaved={refresh} />
        </>
      )}
      {!loading && tab === "audit" && (
        <article className="finance-panel">
          <h2>Settlement Audit</h2>
          <table className="finance-table">
            <thead>
              <tr>
                <th>時間</th>
                <th>商家</th>
                <th>對帳單</th>
                <th>事件</th>
                <th>狀態</th>
              </tr>
            </thead>
            <tbody>
              {auditEvents.length ? (
                auditEvents.map((item) => (
                  <tr key={String(item.id)}>
                    <td>{String(item.created_at)}</td>
                    <td>{String(item.merchant_name)}</td>
                    <td>{String(item.statement_no || "—")}</td>
                    <td>{String(item.event_type)}</td>
                    <td>
                      {String(item.from_status || "—")} →{" "}
                      {String(item.to_status || "—")}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5}>目前沒有 Audit 紀錄</td>
                </tr>
              )}
            </tbody>
          </table>
        </article>
      )}
      {!loading && tab === "deposits" && (
        <article className="finance-panel">
          <h2>建立對帳預覽</h2>
          <div className="finance-filters">
            <select
              value={period.merchant_id}
              onChange={(event) =>
                setPeriod({ ...period, merchant_id: event.target.value })
              }
            >
              {merchants.map((merchant) => (
                <option value={merchant.id} key={merchant.id}>
                  {merchant.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={period.period_start}
              onChange={(event) =>
                setPeriod({ ...period, period_start: event.target.value })
              }
            />
            <input
              type="date"
              value={period.period_end}
              onChange={(event) =>
                setPeriod({ ...period, period_end: event.target.value })
              }
            />
            <button disabled={busy} onClick={() => void previewSettlement()}>
              產生預覽
            </button>
          </div>
          {preview && (
            <div className="finance-preview">
              <p>交易筆數：{transactionCount}</p>
              <p>訂單總額：{moneyMinor(preview.total_order_amount_minor)}</p>
              <p>
                預期訂金：{moneyMinor(preview.expected_deposit_amount_minor)}
              </p>
              <p>
                實際訂金：{moneyMinor(preview.actual_deposit_collected_minor)}
              </p>
              <p>差異：{moneyMinor(preview.deposit_variance_minor)}</p>
              <p>
                實際／估算手續費：{moneyMinor(preview.actual_fee_total_minor)} /{" "}
                {moneyMinor(preview.estimated_fee_total_minor)}
              </p>
              <p>
                平台服務費：{moneyMinor(preview.platform_service_fee_minor)}
              </p>
              <p>應撥款：{moneyMinor(preview.merchant_payable_minor)}</p>
              <p>
                店家待返還平台：
                {moneyMinor(preview.merchant_due_to_platform_minor)}
              </p>
              <p>
                下期承接餘額：{moneyMinor(preview.carry_forward_balance_minor)}
              </p>
              <button disabled={busy} onClick={() => void createDraft()}>
                建立草稿
              </button>
            </div>
          )}
        </article>
      )}
      {dialog && (
        <ActionDialog
          dialog={dialog}
          busy={busy}
          onClose={() => setDialog(null)}
          onSubmit={(data) => {
            if (dialog.action === "source") {
              const item = dialog.item as Payment;
              setBusy(true);
              request(
                `/settlement-sources/${encodeURIComponent(String(item.payment_id))}`,
                { method: "PATCH", body: JSON.stringify(data) },
              )
                .then(() => refresh("付款來源資格已覆核。"))
                .catch((cause) =>
                  setError(cause instanceof Error ? cause.message : "覆核失敗"),
                )
                .finally(() => {
                  setBusy(false);
                  setDialog(null);
                });
            } else {
              const item = dialog.item as Statement;
              const action =
                dialog.action === "variance-lock" ? "lock" : dialog.action;
              void mutate(item, action, data);
            }
          }}
        />
      )}
    </main>
  );
}

function RulesPanel({
  merchants,
  request,
  onSaved,
}: {
  merchants: Merchant[];
  request: (path: string, init?: RequestInit) => Promise<any>;
  onSaved: (message: string) => Promise<void>;
}) {
  const [merchantId, setMerchantId] = useState(merchants[0]?.id || "");
  const [form, setForm] = useState({
    enabled: false,
    payment_plan: "upfront_18000",
    deposit_rate_bp: 3000,
    platform_fee_rate_bp: 200,
    processing_fee_mode: "actual_or_estimated",
    processing_fee_basis: "deposit_collected",
    estimated_processing_fee_rate_bp: 0,
    tax_reserve_mode: "disabled",
    tax_reserve_rate_bp: 0,
    withholding_mode: "disabled",
    withholding_rate_bp: 0,
    refund_platform_fee_policy: "pro_rata_reverse",
    refund_offset_policy: "pro_rata_reverse",
    provider_fee_refund_policy: "no_reverse",
    offset_target_amount_minor: 1_800_000,
    continue_platform_fee_after_offset: false,
    settlement_day: 10,
    legal_review_status: "pending",
    accounting_review_status: "pending",
    effective_from: "",
    effective_to: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  const load = async (id: string) => {
    setMerchantId(id);
    try {
      const data = await request(
        `/settlement-profiles/${encodeURIComponent(id)}`,
      );
      setForm({
        ...form,
        ...data,
        enabled: Boolean(data.enabled),
        continue_platform_fee_after_offset: Boolean(
          data.continue_platform_fee_after_offset,
        ),
      });
    } catch {
      /* New profile retains safe defaults. */
    }
  };
  useEffect(() => {
    if (merchantId) void load(merchantId);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    await request(`/settlement-profiles/${encodeURIComponent(merchantId)}`, {
      method: "PATCH",
      body: JSON.stringify({ ...form, confirm_high_risk: true }),
    });
    await onSaved("規則已保存並寫入 Audit；不會自動啟用金流 Provider。");
  };
  return (
    <article className="finance-panel">
      <h2>規則設定</h2>
      <p className="finance-warning">
        稅務預留與扣繳須依記帳士／稅務專業人員確認結果設定。
      </p>
      <form className="finance-form finance-rule-grid" onSubmit={submit}>
        <label>
          商家
          <select
            value={merchantId}
            onChange={(event) => void load(event.target.value)}
          >
            {merchants.map((merchant) => (
              <option value={merchant.id} key={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          付款方案
          <select
            value={form.payment_plan}
            onChange={(event) =>
              setForm({ ...form, payment_plan: event.target.value })
            }
          >
            <option value="upfront_18000">一次付清方案</option>
            <option value="sales_offset_18000">銷售抵付方案</option>
          </select>
        </label>
        <label>
          手續費模式
          <select
            value={form.processing_fee_mode}
            onChange={(event) =>
              setForm({ ...form, processing_fee_mode: event.target.value })
            }
          >
            <option value="actual_or_estimated">逐筆實際或估算</option>
            <option value="actual_only">僅實際費用</option>
            <option value="estimated">全數估算</option>
          </select>
        </label>
        <label>
          訂金比例（basis points）
          <input
            type="number"
            min="0"
            max="10000"
            value={form.deposit_rate_bp}
            onChange={(event) =>
              setForm({ ...form, deposit_rate_bp: Number(event.target.value) })
            }
          />
        </label>
        <label>
          平台服務費率（basis points）
          <input
            type="number"
            min="0"
            max="10000"
            value={form.platform_fee_rate_bp}
            onChange={(event) =>
              setForm({
                ...form,
                platform_fee_rate_bp: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          預估金流費率（basis points）
          <input
            type="number"
            min="0"
            max="10000"
            value={form.estimated_processing_fee_rate_bp}
            onChange={(event) =>
              setForm({
                ...form,
                estimated_processing_fee_rate_bp: Number(event.target.value),
              })
            }
          />
        </label>
        <label>
          稅務預留模式
          <select
            value={form.tax_reserve_mode}
            onChange={(event) =>
              setForm({ ...form, tax_reserve_mode: event.target.value })
            }
          >
            <option value="disabled">停用</option>
            <option value="manual">人工金額</option>
            <option value="percentage">核准比例</option>
          </select>
        </label>
        <label>
          扣繳模式
          <select
            value={form.withholding_mode}
            onChange={(event) =>
              setForm({ ...form, withholding_mode: event.target.value })
            }
          >
            <option value="disabled">停用</option>
            <option value="manual">人工金額</option>
            <option value="percentage">核准比例</option>
          </select>
        </label>
        <label>
          法務審核
          <select
            value={form.legal_review_status}
            onChange={(event) =>
              setForm({ ...form, legal_review_status: event.target.value })
            }
          >
            <option value="pending">待審</option>
            <option value="approved">已核准</option>
            <option value="rejected">拒絕</option>
          </select>
        </label>
        <label>
          會計／稅務審核
          <select
            value={form.accounting_review_status}
            onChange={(event) =>
              setForm({ ...form, accounting_review_status: event.target.value })
            }
          >
            <option value="pending">待審</option>
            <option value="approved">已核准</option>
            <option value="rejected">拒絕</option>
          </select>
        </label>
        <label>
          平台費退款政策
          <select
            value={form.refund_platform_fee_policy}
            onChange={(event) =>
              setForm({
                ...form,
                refund_platform_fee_policy: event.target.value,
              })
            }
          >
            <option value="pro_rata_reverse">按比例回沖</option>
            <option value="no_reverse">不回沖</option>
            <option value="manual_review">人工覆核</option>
          </select>
        </label>
        <label>
          抵付退款政策
          <select
            value={form.refund_offset_policy}
            onChange={(event) =>
              setForm({ ...form, refund_offset_policy: event.target.value })
            }
          >
            <option value="pro_rata_reverse">按比例回沖</option>
            <option value="no_reverse">不回沖</option>
            <option value="manual_review">人工覆核</option>
          </select>
        </label>
        <label>
          Provider 費用退款政策
          <select
            value={form.provider_fee_refund_policy}
            onChange={(event) =>
              setForm({
                ...form,
                provider_fee_refund_policy: event.target.value,
              })
            }
          >
            <option value="no_reverse">保留實際費用</option>
            <option value="pro_rata_reverse">按比例回沖</option>
            <option value="manual_review">人工覆核</option>
          </select>
        </label>
        <label>
          生效日
          <input
            type="date"
            value={form.effective_from || ""}
            onChange={(event) =>
              setForm({ ...form, effective_from: event.target.value })
            }
          />
        </label>
        <label>
          <input
            type="checkbox"
            checked={form.enabled}
            onChange={(event) =>
              setForm({ ...form, enabled: event.target.checked })
            }
          />
          啟用選配服務
        </label>
        <label className="finance-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          我已核對有效契約、法律主體及記帳士／稅務專業意見
        </label>
        <button type="submit" disabled={!confirmed}>
          保存高風險設定
        </button>
      </form>
    </article>
  );
}

function PlatformIdentityPanel({
  request,
  onSaved,
}: {
  request: (path: string, init?: RequestInit) => Promise<any>;
  onSaved: (message: string) => Promise<void>;
}) {
  const [form, setForm] = useState({
    brand_name: "創百業智慧鏈",
    legal_entity_name: "",
    tax_id: "",
    invoice_title: "",
    invoice_address: "",
  });
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    request("/settlement-settings/platform")
      .then((data) => setForm({ ...form, ...(data.settings || {}) }))
      .catch(() => undefined);
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!confirmed) return;
    await request("/settlement-settings/platform", {
      method: "PATCH",
      body: JSON.stringify({ ...form, confirm_legal_identity: true }),
    });
    await onSaved("公司法律主體與發票設定已保存並寫入 Audit。");
  };
  return (
    <article className="finance-panel">
      <h2>平台法律主體與發票設定</h2>
      <p className="finance-note">
        資料必須依後台正式設定讀取，不在程式內硬編公司名稱或統編。
      </p>
      <form className="finance-form finance-rule-grid" onSubmit={submit}>
        <label>
          品牌名稱
          <input
            value={form.brand_name}
            onChange={(event) =>
              setForm({ ...form, brand_name: event.target.value })
            }
          />
        </label>
        <label>
          公司法律主體
          <input
            value={form.legal_entity_name || ""}
            onChange={(event) =>
              setForm({ ...form, legal_entity_name: event.target.value })
            }
            required
          />
        </label>
        <label>
          統編
          <input
            value={form.tax_id || ""}
            onChange={(event) =>
              setForm({ ...form, tax_id: event.target.value })
            }
            required
          />
        </label>
        <label>
          發票抬頭
          <input
            value={form.invoice_title || ""}
            onChange={(event) =>
              setForm({ ...form, invoice_title: event.target.value })
            }
          />
        </label>
        <label>
          發票地址
          <input
            value={form.invoice_address || ""}
            onChange={(event) =>
              setForm({ ...form, invoice_address: event.target.value })
            }
          />
        </label>
        <label className="finance-confirm">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(event) => setConfirmed(event.target.checked)}
          />
          我已核對正式公司法律主體、統編與發票資料
        </label>
        <button type="submit" disabled={!confirmed}>
          保存平台資料
        </button>
      </form>
    </article>
  );
}
