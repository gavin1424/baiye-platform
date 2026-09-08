import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
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
const message = (error: unknown) =>
  error instanceof Error ? error.message : "契約服務暫時無法使用。";
const roleLabel = (role: string) =>
  role === "authorized_representative" ? "受授權代表" : "法定代表人";

async function publicApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "契約服務暫時無法使用。");
  return data;
}

export function MerchantContractActivate() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [invite, setInvite] = useState<any>();
  const [form, setForm] = useState({ phone: "", privacy_consent: false });
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
          <p className="partner-guidance-note">
            不用設定密碼，使用手機即可註冊與登入。
          </p>
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
  const [context, setContext] = useState<any>();
  const [notice, setNotice] = useState("");
  const [authRequired, setAuthRequired] = useState(false);
  const [preview, setPreview] = useState<any>();
  const [memberWelcome, setMemberWelcome] = useState<any>();
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
      return "請以正楷完成至少 2 筆、共 12 點以上的手寫簽名。";
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
          "SIGN_RESULT_INCOMPLETE：簽署結果不完整，請勿重新送出並聯絡平台協助。",
        );
        return;
      }
      if (result.member_session?.token)
        savePlatformMemberToken(result.member_session.token);
      if (result.welcome?.show) setMemberWelcome(result.welcome);
      setPreview(undefined);
      setSignature({ strokes: [] });
      setNotice(`商家平台服務契約已完成簽署。文件識別碼：${result.public_id}`);
      await load();
    } catch (error) {
      signIdempotencyKey.current = null;
      setNotice(message(error));
    } finally {
      setIsSigning(false);
    }
  };

  const decideRenewal = async (continueService: boolean) => {
    setNotice("");
    try {
      const result: any = await merchantOrderingApi(
        continueService
          ? "/api/merchant/contracts/renewal/prepare"
          : "/api/merchant/contracts/renewal/decline",
        {
          method: "POST",
          body: JSON.stringify({ continue_service: continueService }),
        },
      );
      setNotice(
        continueService
          ? `第 ${result.cycle.cycle_number} 週期待付金額：${money(result.cycle.balance_due_minor)}。${result.payment_provider.disclosure}`
          : `已選擇不續用。${result.data_retention}`,
      );
      await load();
    } catch (error) {
      setNotice(message(error));
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
        <h1>商家平台服務契約已完成簽署</h1>
        <p>
          版本 {context.contract.version} · {context.signature.signed_at}
        </p>
        {context.renewal && (
          <section className="contract-summary-card">
            <strong>
              {context.renewal.subscription.renewal_state === "RENEWAL_REQUIRED"
                ? "是否續用免 POS 機智慧點餐系統"
                : `服務狀態：${context.renewal.subscription.renewal_state}`}
            </strong>
            <span>
              免費試用：{context.renewal.subscription.trial_started_at} ～{" "}
              {context.renewal.subscription.trial_ends_at}
            </span>
            {context.renewal.subscription.renewal_state ===
              "RENEWAL_REQUIRED" && (
              <>
                <span>
                  第一週期尚應支付 {money(context.plan.first_cycle_balance)}
                  ；不續用將停止正式服務功能並依契約保留資料。
                </span>
                <div className="partner-workflow-actions">
                  <button
                    className="btn btn-primary"
                    type="button"
                    onClick={() => void decideRenewal(true)}
                  >
                    續用，建立第一週期
                  </button>
                  <button
                    className="btn btn-outline"
                    type="button"
                    onClick={() => void decideRenewal(false)}
                  >
                    不續用
                  </button>
                </div>
              </>
            )}
          </section>
        )}
        <div className="partner-workflow-actions">
          <button
            className="btn btn-primary"
            onClick={() =>
              void downloadMerchantContractPdf(
                context.signature.id,
                context.signature.public_id,
              ).catch((error) => setNotice(message(error)))
            }
          >
            下載契約檔案
          </button>
          <Link className="btn btn-outline" to="/merchant">
            返回商家中心
          </Link>
        </div>
        {notice && <div className="partner-message">{notice}</div>}
        {memberWelcome && (
          <div
            className="contract-confirm-dialog member-welcome-modal"
            role="dialog"
            aria-modal="true"
          >
            <div>
              <div className="member-celebration">🎉</div>
              <h2>{memberWelcome.title}</h2>
              <p>您的創百業會員資格也已建立。</p>
              <div className="partner-workflow-actions">
                <Link className="btn btn-primary" to="/member">
                  前往會員中心
                </Link>
                <Link className="btn btn-outline" to="/merchant">
                  返回商家中心
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>
    );

  const consentLabels: Record<(typeof requiredConsentKeys)[number], string> =
    context.plan
      ? {
          read: "我已完整閱讀本契約及附件 A。",
          commercial_terms:
            "我確認開通費 NT$3,000、保證金 NT$6,000，第一週期抵充後尚付 NT$18,000。",
          authority:
            "我確認免費試用 3 個月，正式計價為 NT$24,000／24 個月，非逐月短約。",
          signature_evidence:
            "我了解 24 期零利率仍須依實際金融／支付機構核准與 Provider 可用能力為準。",
          electronic:
            "我同意使用電子形式完成契約簽署並保存 Evidence、PDF、Hash 與 Audit。",
        }
      : context.terms.plan_code === "baiye_commerce_ai_45000"
        ? {
            read: "我已完整閱讀本契約及附件 A。",
            commercial_terms: "我確認 AI 智慧商城完整版固定總價為 NT$45,000。",
            authority:
              "我確認服務期間為 24 個月，商城與管理權限依現有真實功能 Gate 啟用。",
            signature_evidence:
              "我了解金流實際啟用及分期仍依 Provider 審核與真實 readiness 為準。",
            electronic:
              "我同意使用電子形式完成契約簽署並保存 Evidence、PDF、Hash 與 Audit。",
          }
        : {
            read: "我已完整閱讀本契約及附件 A。",
            commercial_terms: "我確認本方案總價為 NT$18,000。",
            authority: "我確認服務期間為 24 個月。",
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
              <span>開通費</span>
              <strong>{money(context.plan.activation_fee)}</strong>
            </article>
            <article>
              <span>保證金</span>
              <strong>{money(context.plan.deposit)}</strong>
            </article>
            <article>
              <span>前三個月</span>
              <strong>免費</strong>
            </article>
            <article>
              <span>正式方案</span>
              <strong>{money(context.plan.cycle_fee)}／24 個月</strong>
            </article>
            <article>
              <span>第一週期抵充後</span>
              <strong>尚需 {money(context.plan.first_cycle_balance)}</strong>
            </article>
            <article>
              <span>後續週期</span>
              <strong>{money(context.plan.renewal_fee)}／24 個月</strong>
            </article>
          </section>
          <section className="contract-summary-card">
            <strong>免專用 POS 主機</strong>
            <span>不等於完全零硬體；仍需商家自備營運所需裝置與網路。</span>
            <span>{context.plan.payment_provider.disclosure}</span>
            <span>
              Provider 實際 24 期能力：
              {context.plan.payment_provider.ready
                ? "已驗證"
                : "尚未驗證，不會產生假交易"}
            </span>
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
            。Staging 不會填入假公司資料。
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
            <strong>本人正楷手寫簽名</strong>
            <p>
              請以正楷清楚簽寫本人完整姓名，簽署姓名須與上方填寫之簽署人姓名一致。
            </p>
            <p>請正楷簽寫：{form.signatory_legal_name || "您的完整姓名"}</p>
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
              確認後將建立不可變 PDF 與私人 Evidence
              JSON。手寫軌跡屬線上簽署證據，不是憑證式數位簽章。
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
            <dt>Document Hash</dt>
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
