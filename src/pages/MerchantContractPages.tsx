import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  getPlatformDeviceId,
  merchantOrderingApi,
  savePlatformMemberToken,
} from "../qr-ordering-client";
import {
  ContractSignatureCanvas,
  type SignatureValue,
} from "../components/ContractSignatureCanvas";
import { downloadMerchantContractPdf } from "../merchant-contract-pdf";
import { MerchantRegisterPage } from "./MerchantAccessPages";
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
const message = (error: unknown) => userFacingError(error, "契約服務暫時無法使用，請稍後再試。");
const roleLabel = (role: string) =>
  role === "authorized_representative" ? "受授權代表" : "法定代表人";
const signedAtLabel = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(date);
};

async function publicApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error("契約服務暫時無法使用。"), { status: response.status, code: data.code || "" });
  return data;
}

export function MerchantContractActivate() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState<any>();
  const [form, setForm] = useState({ phone: "", password: "", password_confirm: "", privacy_consent: false });
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState<any>();
  const [seconds, setSeconds] = useState(3);
  const idempotencyKey = useRef(crypto.randomUUID());

  useEffect(() => {
    if (!token) return;
    void publicApi("/api/merchant/contracts/invite/validate", {
      method: "POST",
      body: JSON.stringify({ token }),
    })
      .then(setInvite)
      .catch((error) => setNotice(message(error)));
  }, [token]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setNotice("");
    try {
      const result: any = await merchantOrderingApi(
        "/api/merchant/contracts/accept-invite",
        {
          method: "POST",
          headers: {
            "idempotency-key": idempotencyKey.current,
            "x-device-id": getPlatformDeviceId(),
          },
          body: JSON.stringify({
            token,
            ...form,
            consent_version: "merchant-registration-v1",
          }),
        },
      );
      if (result.member_session?.token)
        savePlatformMemberToken(result.member_session.token);
      setSuccess(result);
    } catch (error) {
      setNotice(message(error));
    }
  };
  useEffect(() => {
    if (!success) return;
    setSeconds(3);
    const redirect = window.setTimeout(() => {
      window.location.hash = "#/merchant/contract";
    }, 3000);
    const countdown = window.setInterval(
      () => setSeconds((value) => Math.max(1, value - 1)),
      1000,
    );
    return () => {
      window.clearTimeout(redirect);
      window.clearInterval(countdown);
    };
  }, [success]);
  if (!token) return <MerchantRegisterPage />;
  return (
    <main className="partner-shell contract-shell">
      <h1>商家註冊</h1>
      {invite && (
        <section className="contract-summary-card">
          <strong>{invite.merchant_name}</strong>
          <span>
            {invite.plan_name} · {money(invite.discount_price_minor)}
          </span>
        </section>
      )}
      {invite && !success && (
        <form className="partner-form" onSubmit={submit}>
          <label>
            手機號碼
            <input
              required
              type="tel"
              inputMode="tel"
              placeholder="09xxxxxxxx"
              value={form.phone}
              onChange={(event) =>
                setForm({ ...form, phone: event.target.value })
              }
            />
          </label>
          <label>
            設定 8 位數字密碼
            <input required type="password" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="new-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <label>
            再次確認密碼
            <input required type="password" inputMode="numeric" pattern="[0-9]{8}" minLength={8} maxLength={8} autoComplete="new-password" value={form.password_confirm} onChange={(event) => setForm({ ...form, password_confirm: event.target.value })} />
          </label>
          <label className="partner-consent">
            <input
              required
              type="checkbox"
              checked={form.privacy_consent}
              onChange={(event) =>
                setForm({ ...form, privacy_consent: event.target.checked })
              }
            />
            我已閱讀並同意會員服務、隱私權說明及商家平台相關條款。
          </label>
          <button className="btn btn-primary">完成商家註冊</button>
          <p className="partner-guidance-note">日後請使用此手機號碼與 8 位數字密碼登入。</p>
        </form>
      )}
      {success && (
        <section className="partner-status success">
          <strong>🎉 商家註冊成功！</strong>
          <span>✓ 商家帳號已建立</span>
          <span>✓ 創百業會員已建立</span>
          <span>✓ 會員經營功能已連結</span>
          <span>
            <strong>下一步：完成商家平台服務契約</strong>
          </span>
          <span>{seconds} 秒後自動前往商家契約</span>
          <Link className="btn btn-primary" to="/merchant/contract">
            立即前往簽約
          </Link>
        </section>
      )}
      {notice && <div className="partner-message">{notice}</div>}
      <Link to="/merchant">前往商家中心</Link>
    </main>
  );
}

const requiredConsentKeys = [
  "read",
  "commercial_terms",
  "authority",
  "signature_evidence",
  "electronic",
] as const;

export function MerchantContractPage() {
  const navigate = useNavigate();
  const [context, setContext] = useState<any>();
  const [notice, setNotice] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [preview, setPreview] = useState<any>();
  const [, setMemberWelcome] = useState<any>();
  const [isSigning, setIsSigning] = useState(false);
  const [form, setForm] = useState({
    signatory_legal_name: "",
    signatory_role: "legal_representative",
    legal_representative_name: "",
    tax_id: "",
    authorization_confirmed: false,
    read: false,
    electronic: false,
    commercial_terms: false,
    authority: false,
    signature_evidence: false,
  });
  const [signature, setSignature] = useState<SignatureValue>({ strokes: [] });
  const signIdempotencyKey = useRef<string | null>(null);
  const load = async () => {
    try {
      setContext(
        await merchantOrderingApi<any>("/api/merchant/contracts/current"),
      );
    } catch (error: any) {
      setNotice(
        error?.code === "PLAN_SELECTION_REQUIRED"
          ? "請先選擇並確認商家服務方案。"
          : message(error),
      );
    }
  };

  useEffect(() => {
    void merchantOrderingApi<any>("/api/merchant-auth/session")
      .then(() => load())
      .catch(() => {
        setAuthRequired(true);
        setNotice("請先登入商家帳號後進行簽約。");
      });
  }, []);
  const validateBeforePreview = () => {
    if (!form.signatory_legal_name.trim()) return "請填寫簽署人法定姓名。";
    if (!form.legal_representative_name.trim()) return "請填寫法定代表人姓名。";
    if (
      form.signatory_role === "authorized_representative" &&
      !form.authorization_confirmed
    )
      return "受授權代表須確認已取得合法簽約授權。";
    if (!requiredConsentKeys.every((key) => form[key]))
      return "請完成全部 5 項契約確認。";
    const strokes = signature.strokes.filter((stroke) => stroke.length >= 2);
    const points = strokes.reduce((sum, stroke) => sum + stroke.length, 0);
    if (strokes.length < 2 || points < 12)
      return "請完成清楚且非空白的本人手寫簽名。";
    return "";
  };
  const previewSign = async () => {
    setNotice("");
    const problem = validateBeforePreview();
    if (problem) return setNotice(problem);
    try {
      setPreview(
        await merchantOrderingApi("/api/merchant/contracts/sign-preview", {
          method: "POST",
          body: JSON.stringify({ ...form, signature }),
        }),
      );
    } catch (error) {
      setNotice(message(error));
    }
  };
  const sign = async () => {
    if (isSigning) return;
    setNotice("");
    setIsSigning(true);
    const key = signIdempotencyKey.current || crypto.randomUUID();
    signIdempotencyKey.current = key;
    try {
      const result: any = await merchantOrderingApi(
        "/api/merchant/contracts/sign",
        {
          method: "POST",
          headers: { "idempotency-key": key },
          body: JSON.stringify({ ...form, signature }),
        },
      );
      if (!result.signature_id || !result.document_hash || !result.signed_at) {
        setNotice(
          "簽署結果尚未完整確認。為避免重複簽署，請聯絡平台協助查詢。",
        );
        return;
      }
      if (result.member_session?.token)
        savePlatformMemberToken(result.member_session.token);
      if (result.welcome?.show) setMemberWelcome(result.welcome);
      setPreview(undefined);
      setSignature({ strokes: [] });
      setNotice("簽署已完成，請繼續完成付款。");
      if (result.next_url) navigate(result.next_url, { replace: true });
      else await load();
    } catch (error) {
      signIdempotencyKey.current = null;
      setNotice(message(error));
    } finally {
      setIsSigning(false);
    }
  };

  if (!context)
    return (
      <main className="partner-shell contract-shell">
        <h1>商家平台服務契約</h1>
        <p>{notice || "正在驗證商家帳號與契約狀態…"}</p>
        {authRequired ? (
          <div className="partner-workflow-actions">
            <Link className="btn btn-primary" to="/merchant/login">
              商家登入
            </Link>
            <Link className="btn btn-outline" to="/merchant/register">
              尚未註冊
            </Link>
          </div>
        ) : (
          notice.includes("選擇") && (
            <Link className="btn btn-primary" to="/merchant/select-plan">
              選擇商家服務方案
            </Link>
          )
        )}
      </main>
    );
  const legalEntityMissing = !context.legal_entity?.configured;
  if (context.signed)
    return (
      <main className="partner-shell contract-shell">
        <h1>契約簽署完成</h1>
        <dl className="contract-completion-details">
          <div><dt>契約編號</dt><dd>{context.signature.public_id}</dd></div>
          <div><dt>簽署方案</dt><dd>{context.terms.plan_name}</dd></div>
          <div><dt>簽署時間</dt><dd>{signedAtLabel(context.signature.signed_at)}</dd></div>
        </dl>
        <div className="partner-workflow-actions">
          <button
            className="btn btn-primary"
            type="button"
            onClick={() =>
              void downloadMerchantContractPdf(
                context.signature.id,
                context.signature.public_id,
              ).catch((error) => setNotice(message(error)))
            }
          >
            合約下載
          </button>
        </div>
        {notice && <div className="partner-message">{notice}</div>}
      </main>
    );

  const consentLabels: Record<(typeof requiredConsentKeys)[number], string> =
    context.terms.plan_code === "baiye_softpos_24000"
      ? {
          read: "我已完整閱讀本契約及附件 A。",
          commercial_terms:
            "我確認本方案契約總額 NT$24,000，簽約首期款 NT$6,000。",
          authority:
            "我確認自服務啟用日起試用 3 個月，試用期屆滿後應支付尾款 NT$18,000。",
          signature_evidence:
            "我了解 24 期零利率仍須依實際金融／支付機構核准與當時提供條件為準。",
          electronic:
            "我同意以電子形式完成契約簽署，並保存 PDF、驗證值與簽署紀錄。",
        }
      : context.terms.plan_code === "baiye_commerce_ai_50000"
        ? {
            read: "我已完整閱讀本契約及附件 A。",
            commercial_terms: "我確認 AI 智慧商城完整版契約總額及簽約應付款均為 NT$50,000。",
            authority:
              "我確認服務期間為 24 個月，商城與管理功能依方案內容開通。",
            signature_evidence:
              "我了解金流與分期功能仍須依合作服務商審核及實際提供條件為準。",
            electronic:
              "我同意以電子形式完成契約簽署，並保存 PDF、驗證值與簽署紀錄。",
          }
        : {
            read: "我已完整閱讀本契約及附件 A。",
          commercial_terms: "我確認本方案總價為 NT$18,000。",
            authority: "我確認簽約時一次支付 NT$18,000，簽約後餘額為 NT$0。",
            signature_evidence: "我了解客製服務及第三方費用不包含於本方案。",
            electronic: "我同意使用電子形式完成本契約簽署。",
          };

  return (
    <main className="partner-shell contract-shell">
      <p className="partner-eyebrow">線上契約簽署</p>
      <h1>{context.contract.title}</h1>
      {context.staging && (
        <p className="contract-staging-notice">STAGING｜法律審閱測試版本</p>
      )}
      {context.plan ? (
        <>
          <section className="contract-summary-grid">
            <article>
              <span>契約總額</span>
              <strong>{money(context.terms.contract_total_amount_minor)}</strong>
            </article>
            <article>
              <span>簽約首期款</span>
              <strong>{money(context.terms.payment_due_at_signature_minor)}</strong>
            </article>
            <article>
              <span>試用期間</span>
              <strong>{context.terms.trial_period_months} 個月</strong>
            </article>
            <article>
              <span>試用期結束尾款</span>
              <strong>{money(context.terms.post_trial_payment_minor)}</strong>
            </article>
          </section>
          <section className="contract-summary-card">
            <strong>免專用 POS 主機</strong>
            <span>不等於完全零硬體；仍需商家自備營運所需裝置與網路。</span>
            <span>{context.plan.payment_provider.disclosure}</span>
            <span>{context.plan.payment_provider.ready ? "目前可受理分期申請。" : "分期方式須由合作銀行／金流服務商確認後提供。"}</span>
          </section>
        </>
      ) : (
        <section className="contract-summary-grid">
          <article>
            <span>商家</span>
            <strong>{context.merchant.name}</strong>
          </article>
          <article>
            <span>方案</span>
            <strong>{context.terms.plan_name}</strong>
          </article>
          <article>
            <span>總價</span>
            <strong>{money(context.terms.discount_price_minor)}</strong>
          </article>
          <article>
            <span>付款方式</span>
            <strong>
              {context.terms.payment_plan === "upfront_18000"
                ? "一次付清"
                : context.terms.payment_plan}
            </strong>
          </article>
          <article>
            <span>服務期間</span>
            <strong>{context.terms.contract_term_months} 個月</strong>
            <span>
              {context.terms.start_date} ～ {context.terms.service_period_end}
            </span>
          </article>
          <article>
            <span>契約版本</span>
            <strong>{context.contract.version}</strong>
          </article>
        </section>
      )}
      <section className="contract-summary-card">
        <strong>付款與生效</strong>
        <span>本契約完成電子簽署並經平台確認簽約應付款項入帳後正式生效。</span>
      </section>
      <section className="contract-summary-card">
        <strong>契約雙方</strong>
        {legalEntityMissing ? (
          <span>甲方資料設定尚未完成，簽署功能暫時鎖定。</span>
        ) : (
          <>
            <span>
              甲方：{context.legal_entity.entity.legal_name}（統編：
              {context.legal_entity.entity.tax_id}）
            </span>
            <span>乙方：{context.merchant.name}</span>
          </>
        )}
      </section>
      <section className="contract-summary-card" aria-label="付款生效條件">
        <strong>付款與生效條件</strong>
        <span>本契約於雙方完成簽署並經平台確認應付款項入帳後正式生效。</span>
        <span>完成簽署不等同服務已生效；簽署後將前往付款頁。</span>
      </section>
      <article
        className="contract-document"
        aria-label="商家平台服務契約正文"
        dangerouslySetInnerHTML={{ __html: context.contract.content_html }}
      />
      {(context.attachments || []).map((attachment: any) => (
        <article
          className="contract-document contract-attachment"
          key={attachment.title}
          dangerouslySetInnerHTML={{
            __html: attachment.contentHtml || attachment.content || "",
          }}
        />
      ))}
      {legalEntityMissing ? (
        <section className="partner-status warning">
          <strong>平台法律主體設定尚未完成</strong>
          <span>
            缺少：
            {(context.legal_entity?.missing_fields || [])
              .map((item: any) => item.label)
              .join("、") || "必要資料"}
            。請稍後再試或聯絡平台協助。
          </span>
        </section>
      ) : (
        <>
          {requiredConsentKeys.map((key) => (
            <label key={key} className="partner-consent">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={(event) =>
                  setForm({ ...form, [key]: event.target.checked })
                }
              />
              {consentLabels[key]}
            </label>
          ))}
          <div className="contract-form-grid">
            <label>
              簽署人法定姓名
              <input
                required
                value={form.signatory_legal_name}
                onChange={(event) =>
                  setForm({ ...form, signatory_legal_name: event.target.value })
                }
              />
            </label>
            <label>
              簽署身份
              <select
                value={form.signatory_role}
                onChange={(event) =>
                  setForm({ ...form, signatory_role: event.target.value })
                }
              >
                <option value="legal_representative">法定代表人</option>
                <option value="authorized_representative">受授權代表</option>
              </select>
            </label>
            <label>
              法定代表人姓名
              <input
                required
                value={form.legal_representative_name}
                onChange={(event) =>
                  setForm({
                    ...form,
                    legal_representative_name: event.target.value,
                  })
                }
              />
            </label>
            <label>
              統一編號（如適用）
              <input
                value={form.tax_id}
                onChange={(event) =>
                  setForm({ ...form, tax_id: event.target.value })
                }
              />
            </label>
          </div>
          {form.signatory_role === "authorized_representative" && (
            <label className="partner-consent">
              <input
                type="checkbox"
                checked={form.authorization_confirmed}
                onChange={(event) =>
                  setForm({
                    ...form,
                    authorization_confirmed: event.target.checked,
                  })
                }
              />
              本人確認已取得代表商家簽署本契約之合法授權。
            </label>
          )}
          <section className="merchant-signature-notice">
            <strong>本人手寫電子簽名</strong>
            <p>請由本人於下方簽名區完成一般手寫簽名。系統只檢查簽名是否為有效非空白筆跡，不進行筆跡辨識。</p>
            <p>簽署人：{form.signatory_legal_name || "您的完整姓名"}</p>
          </section>
          <ContractSignatureCanvas
            onChange={setSignature}
            minimumStrokes={2}
            minimumPoints={12}
            clearLabel="清除重寫"
          />
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => void previewSign()}
            disabled={isSigning}
          >
            預覽最後確認
          </button>
        </>
      )}
      {preview && (
        <div
          className="contract-confirm-dialog"
          role="dialog"
          aria-modal="true"
        >
          <div>
            <h2>簽署前最後確認</h2>
            <dl>
              <dt>商家名稱</dt>
              <dd>{preview.company_name}</dd>
              <dt>契約版本</dt>
              <dd>{preview.version}</dd>
              <dt>方案</dt>
              <dd>{preview.plan_name}</dd>
              <dt>{preview.plan ? "第一週期尚付" : "總價"}</dt>
              <dd>{money(preview.total_minor)}</dd>
              <dt>服務期間</dt>
              <dd>
                {preview.term_months} 個月（{preview.period.start} ～{" "}
                {preview.period.end}）
              </dd>
              <dt>付款條件</dt>
              <dd>
                {preview.plan
                  ? preview.plan.payment_provider.disclosure
                  : preview.payment_plan === "upfront_18000"
                    ? "一次付清"
                    : preview.payment_plan}
              </dd>
              <dt>簽署人</dt>
              <dd>{preview.signatory}</dd>
              <dt>簽署身份</dt>
              <dd>{roleLabel(preview.signatory_role)}</dd>
            </dl>
            <p>
              確認後將建立不可變更的 PDF 與私人簽署證據。手寫軌跡屬線上簽署證據，不是憑證式數位簽章。
            </p>
            <div className="partner-workflow-actions">
              <button
                className="btn btn-outline"
                disabled={isSigning}
                onClick={() => setPreview(undefined)}
              >
                返回修改
              </button>
              <button
                className="btn btn-primary"
                disabled={isSigning}
                onClick={() => void sign()}
              >
                {isSigning ? "簽署處理中…" : "確認簽署"}
              </button>
            </div>
          </div>
        </div>
      )}
      {notice && <div className="partner-message">{notice}</div>}
    </main>
  );
}

export function MerchantContractsPage() {
  const [items, setItems] = useState<any[]>([]);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void merchantOrderingApi<any>("/api/merchant/contracts")
      .then((data) => setItems(data.items || []))
      .catch((error) => setNotice(message(error)));
  }, []);
  return (
    <main className="partner-shell contract-shell">
      <h1>我的商家服務契約</h1>
      {items.length ? (
        items.map((item) => (
          <article className="contract-list-item" key={item.id}>
            <div>
              <strong>
                {item.title} {item.version}
              </strong>
              <span>
                {item.public_id} · {item.signed_at} · {item.status}
              </span>
            </div>
            <button
              className="btn btn-outline btn-sm"
              onClick={() =>
                void downloadMerchantContractPdf(item.id, item.public_id).catch(
                  (error) => setNotice(message(error)),
                )
              }
            >
              下載契約檔案
            </button>
          </article>
        ))
      ) : (
        <p>{notice || "尚無已簽契約。"}</p>
      )}
    </main>
  );
}

export function VerifyContractPage() {
  const { publicId = "" } = useParams();
  const [data, setData] = useState<any>();
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void publicApi(`/api/contract-verification/${encodeURIComponent(publicId)}`)
      .then(setData)
      .catch((error) => setNotice(message(error)));
  }, [publicId]);
  const statusClass = useMemo(
    () => (data?.status === "VALID" ? "success" : "warning"),
    [data],
  );
  return (
    <main className="partner-shell contract-shell">
      <h1>契約文件驗證</h1>
      {data ? (
        <section className={`partner-status ${statusClass}`}>
          <strong>{data.status}</strong>
          <dl>
            <dt>文件識別碼</dt>
            <dd>{data.document_id}</dd>
            <dt>契約類型</dt>
            <dd>{data.contract_type}</dd>
            <dt>版本</dt>
            <dd>{data.version}</dd>
            <dt>簽署日期</dt>
            <dd>{data.signed_at}</dd>
            <dt>文件雜湊值</dt>
            <dd className="contract-hash">{data.document_hash}</dd>
          </dl>
          <p>公開驗證頁不顯示姓名、電話、Email、地址、IP、簽名圖或商業條件。</p>
        </section>
      ) : (
        <p>{notice || "驗證中…"}</p>
      )}
    </main>
  );
}
