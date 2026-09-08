import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarCheck,
  Check,
  GoogleLogo,
  LineSegments,
  MapPin,
  Storefront,
  X,
} from "@phosphor-icons/react";
import { merchantOrderingApi } from "../qr-ordering-client";
import { adminApi } from "../admin-auth-client";
import { AdminModuleNav } from "../components/AdminModuleNav";

const API = (
  import.meta.env.VITE_PLATFORM_API_URL ||
  "https://chuang-baiye-ai.baiye-platform.workers.dev"
).replace(/\/$/, "");
const INDUSTRIES = [
  "美髮",
  "美甲",
  "美容",
  "按摩",
  "SPA",
  "診所／合法可預約服務",
  "攝影",
  "顧問",
  "教室",
  "工作室",
  "餐廳訂位",
  "其他預約制商家",
];
const STAGES = [
  ["UNDER_REVIEW", "資料審核中"],
  ["GOOGLE_PROFILE_VERIFYING", "Google 商家確認中"],
  ["BOOKING_PAGE_CONFIGURING", "預約頁設定中"],
  ["TESTING", "測試中"],
  ["ACTIVE", "已開通"],
] as const;
const STATUS_LABELS: Record<string, string> = Object.fromEntries([
  ["NOT_APPLIED", "尚未申請"],
  ...STAGES,
  ["NEEDS_INFO", "需補資料"],
  ["SUSPENDED", "暫停"],
]);
const CHECKLIST = [
  ["google_profile_exists", "Google 商家檔案存在"],
  ["merchant_name_matches", "商家名稱一致"],
  ["business_information_confirmed", "地址／營業資訊確認"],
  ["booking_page_complete", "百工 Booking Page 完成"],
  ["services_complete", "服務項目完成"],
  ["staff_hours_complete", "員工／時段完成"],
  ["google_booking_url_configured", "Google 預約 URL 設定"],
  ["physical_mobile_tested", "實際手機測試"],
  ["merchant_confirmed", "商家確認"],
  ["active_approved", "ACTIVE"],
] as const;

async function publicApi(path: string, init: RequestInit = {}) {
  const response = await fetch(`${API}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok)
    throw Object.assign(new Error(data.error || "服務暫時無法使用。"), {
      status: response.status,
      code: data.code,
    });
  return data;
}

export function GoogleMapsBookingLandingPage() {
  const navigate = useNavigate();
  const [choice, setChoice] = useState<"auth" | "contract" | null>(null);
  const start = async () => {
    try {
      const session = await merchantOrderingApi<any>(
        "/api/merchant-auth/session",
      );
      if (session.contract_status !== "signed") setChoice("contract");
      else navigate("/merchant/google-maps-booking");
    } catch {
      setChoice("auth");
    }
  };
  const steps = [
    ["01", "Google 搜尋你的店", "顧客從 Google 搜尋或 Google 地圖找到商家。"],
    ["02", "點擊預約", "顧客從商家資訊快速進入專屬預約頁。"],
    ["03", "選服務與時間", "選擇服務項目、服務人員、日期與可用時段。"],
    ["04", "預約自動進後台", "訂單同步進百工預約管理，商家不用人工抄寫。"],
  ];
  return (
    <main className="google-booking-sales">
      <section className="google-booking-hero">
        <div>
          <p className="google-kicker">
            <GoogleLogo weight="duotone" /> Google Maps Booking Link
          </p>
          <h1>
            讓正在 Google 找你的客人，
            <br />
            直接變成預約
          </h1>
          <p>不用電話來回確認，從 Google 找到你的店，直接進入線上預約流程。</p>
          <div className="google-booking-actions">
            <button
              className="btn btn-primary btn-lg"
              onClick={() => void start()}
            >
              立即申請 Google 地圖預約 <ArrowRight />
            </button>
            <a className="btn btn-outline btn-lg" href="#how-it-works">
              查看運作方式
            </a>
          </div>
        </div>
        <div className="google-booking-map-visual">
          <MapPin weight="duotone" />
          <strong>Google 搜尋</strong>
          <span>→ 百工預約頁 → Booking Core</span>
        </div>
      </section>
      <section id="how-it-works" className="google-booking-section">
        <p className="google-kicker">導流流程</p>
        <h2>四步驟，把搜尋需求接進預約後台</h2>
        <div className="google-steps">
          {steps.map(([no, title, text]) => (
            <article key={no}>
              <span>{no}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="google-booking-section google-difference">
        <div>
          <p className="google-kicker">整合價值</p>
          <h2>不只是一個 Google 預約連結</h2>
          <p>從被搜尋到，到店、回購，都在同一套商家系統完成。</p>
        </div>
        <div className="google-integration-cloud">
          {[
            "Google 地圖導流",
            "預約管理",
            "LINE 官方帳號",
            "會員回購",
            "AI 智能客服",
            "品牌官網",
          ].map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
      </section>
      <section className="google-booking-section">
        <h2>適用產業</h2>
        <div className="google-industries">
          {INDUSTRIES.map((x) => (
            <span key={x}>{x}</span>
          ))}
        </div>
        <p className="google-compliance-note">
          醫療及其他受管制服務仍須符合適用法規、執業資格與 Google 平台政策。
        </p>
      </section>
      <section className="google-booking-section google-price-card">
        <div>
          <p className="google-kicker">百工標準方案</p>
          <h2>Google 地圖預約導流設定</h2>
          <strong>標準導流設定費 NT$0</strong>
          <p>包含於 NT$18,000 標準方案內，不另外建立固定月費。</p>
          <small>
            第三方 Google
            平台政策、外部排程服務或額外廣告費用若日後產生，不包含於百工標準方案內。
          </small>
        </div>
        <button className="btn btn-primary btn-lg" onClick={() => void start()}>
          立即申請
        </button>
      </section>
      <footer className="google-booking-disclaimer">
        Google 商家資訊、Google 地圖及相關功能仍依 Google
        平台政策、資格與功能可用性為準。
        <br />
        本功能目前提供 Google 商家資訊至百工預約頁的預約導流服務；不是 Reserve
        with Google 原生預訂，也不宣稱為 Google 官方合作夥伴。
      </footer>
      {choice && (
        <div className="google-auth-dialog" role="dialog" aria-modal="true">
          <button
            aria-label="關閉"
            className="google-dialog-backdrop"
            onClick={() => setChoice(null)}
          />
          <section>
            <button
              className="google-dialog-close"
              aria-label="關閉"
              onClick={() => setChoice(null)}
            >
              <X />
            </button>
            <h2>
              {choice === "auth"
                ? "請先登入或註冊商家帳號"
                : "請先完成商家平台服務契約"}
            </h2>
            <p>
              {choice === "auth"
                ? "系統會以安全 Merchant Session 綁定您的申請。"
                : "完成契約簽署後，才能送出 Google 地圖預約開通申請。"}
            </p>
            <div>
              {choice === "auth" ? (
                <>
                  <Link className="btn btn-primary" to="/merchant/login">
                    商家登入
                  </Link>
                  <Link className="btn btn-outline" to="/merchant/register">
                    商家註冊
                  </Link>
                </>
              ) : (
                <Link className="btn btn-primary" to="/merchant/select-plan">
                  前往商家方案中心
                </Link>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

function StatusTimeline({ status }: { status: string }) {
  const current = STAGES.findIndex(([key]) => key === status),
    special = ["NEEDS_INFO", "SUSPENDED"].includes(status);
  return (
    <ol className="google-status-timeline">
      <li className="done">
        <Check />
        已送出申請
      </li>
      {STAGES.map(([key, label], index) => (
        <li
          key={key}
          className={
            special
              ? ""
              : index < current
                ? "done"
                : index === current
                  ? "current"
                  : ""
          }
        >
          {index < current ? <Check /> : <span />}
          {label}
        </li>
      ))}
    </ol>
  );
}

export function MerchantGoogleMapsBookingPage() {
  const [context, setContext] = useState<any>();
  const [stats, setStats] = useState<Record<string, number>>({});
  const [notice, setNotice] = useState("");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    merchant_name: "",
    google_maps_url: "",
    google_business_profile_url: "",
    contact_name: "",
    contact_phone: "",
    merchant_type: "美髮",
    services: "",
    has_staff_schedule: false,
    business_hours: "",
    has_google_profile: false,
    has_booking_system: false,
    note: "",
  });
  const load = () =>
    merchantOrderingApi<any>("/api/merchant/google-maps-booking")
      .then((data) => {
        setContext(data);
        setForm((value) => ({ ...value, merchant_name: data.merchant.name }));
      })
      .catch(() => setNotice("請先登入或註冊商家帳號。"));
  useEffect(() => {
    void load();
    void merchantOrderingApi<any>("/api/merchant/google-maps-booking/stats")
      .then((data) => setStats(data.sources || {}))
      .catch(() => setStats({}));
  }, []);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true);
    setNotice("");
    try {
      await merchantOrderingApi("/api/merchant/google-maps-booking", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          services: form.services
            .split(/[,，\n]/)
            .map((x) => x.trim())
            .filter(Boolean),
          business_hours: { description: form.business_hours },
        }),
      });
      setNotice("申請已送出，百工營運人員將依流程協助設定。");
      await load();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "申請送出失敗。");
    } finally {
      setSending(false);
    }
  };
  if (!context)
    return (
      <main className="google-merchant-page">
        <h1>Google 地圖預約開通申請</h1>
        <p>{notice || "正在確認商家帳號…"}</p>
        {notice && (
          <div className="google-booking-actions">
            <Link className="btn btn-primary" to="/merchant/login">
              商家登入
            </Link>
            <Link className="btn btn-outline" to="/merchant/register">
              商家註冊
            </Link>
          </div>
        )}
      </main>
    );
  if (!context.contract_signed)
    return (
      <main className="google-merchant-page">
        <p className="google-kicker">Contract Gate</p>
        <h1>請先完成商家平台服務契約</h1>
        <p>完成 NT$18,000 商家平台服務契約後，即可申請 Google 地圖預約導流。</p>
        <Link className="btn btn-primary" to="/merchant/select-plan">
          前往商家方案中心
        </Link>
      </main>
    );
  const application = context.application;
  return (
    <main className="google-merchant-page">
      <header>
        <p className="google-kicker">Google Maps Booking Link</p>
        <h1>Google 地圖預約開通申請</h1>
        <p>提交商家 Google 資料後，百工將協助完成預約導流設定。</p>
      </header>
      {notice && <div className="partner-message">{notice}</div>}
      {application.status !== "NOT_APPLIED" &&
      application.status !== "NEEDS_INFO" ? (
        <>
          <section className="google-application-status">
            <span className="status-badge">
              {STATUS_LABELS[application.status]}
            </span>
            <h2>{application.merchant_name}</h2>
            <StatusTimeline status={application.status} />
            {application.booking_url && (
              <a className="btn btn-primary" href={application.booking_url}>
                查看專屬預約頁
              </a>
            )}
          </section>
          <section className="google-source-stats" aria-label="本月預約來源">
            <h2>本月預約來源</h2>
            {[
              ["google_maps", "Google 地圖"],
              ["line", "LINE"],
              ["website", "官網"],
              ["manual", "人工"],
            ].map(([key, label]) => (
              <div key={key}>
                <span>{label}</span>
                <strong>{stats[key] || 0}</strong>
              </div>
            ))}
          </section>
        </>
      ) : (
        <form className="google-application-form" onSubmit={submit}>
          <label>
            商家名稱
            <input
              required
              value={form.merchant_name}
              onChange={(e) =>
                setForm({ ...form, merchant_name: e.target.value })
              }
            />
          </label>
          <label>
            Google Maps URL
            <input
              type="url"
              required
              placeholder="https://www.google.com/maps/..."
              value={form.google_maps_url}
              onChange={(e) =>
                setForm({ ...form, google_maps_url: e.target.value })
              }
            />
          </label>
          <label>
            Google Business Profile URL（若不同）
            <input
              type="url"
              value={form.google_business_profile_url}
              onChange={(e) =>
                setForm({
                  ...form,
                  google_business_profile_url: e.target.value,
                })
              }
            />
          </label>
          <label>
            聯絡人
            <input
              required
              value={form.contact_name}
              onChange={(e) =>
                setForm({ ...form, contact_name: e.target.value })
              }
            />
          </label>
          <label>
            手機
            <input
              required
              inputMode="tel"
              placeholder="09xxxxxxxx"
              value={form.contact_phone}
              onChange={(e) =>
                setForm({ ...form, contact_phone: e.target.value })
              }
            />
          </label>
          <label>
            商家類型
            <select
              value={form.merchant_type}
              onChange={(e) =>
                setForm({ ...form, merchant_type: e.target.value })
              }
            >
              {INDUSTRIES.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label className="wide">
            服務項目
            <textarea
              required
              placeholder="剪髮、美甲、課程諮詢"
              value={form.services}
              onChange={(e) => setForm({ ...form, services: e.target.value })}
            />
          </label>
          <label className="wide">
            營業時間
            <textarea
              required
              placeholder="週一至週六 10:00–19:00"
              value={form.business_hours}
              onChange={(e) =>
                setForm({ ...form, business_hours: e.target.value })
              }
            />
          </label>
          <label className="google-check">
            <input
              type="checkbox"
              checked={form.has_staff_schedule}
              onChange={(e) =>
                setForm({ ...form, has_staff_schedule: e.target.checked })
              }
            />
            有人員排班
          </label>
          <label className="google-check">
            <input
              type="checkbox"
              checked={form.has_google_profile}
              onChange={(e) =>
                setForm({ ...form, has_google_profile: e.target.checked })
              }
            />
            已有 Google 商家檔案
          </label>
          <label className="google-check">
            <input
              type="checkbox"
              checked={form.has_booking_system}
              onChange={(e) =>
                setForm({ ...form, has_booking_system: e.target.checked })
              }
            />
            已有預約系統
          </label>
          <label className="wide">
            備註
            <textarea
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </label>
          <button className="btn btn-primary btn-lg wide" disabled={sending}>
            {sending ? "送出中…" : "送出開通申請"}
          </button>
        </form>
      )}
      <p className="google-compliance-note">
        商家只需提供資料，不需要自行建立 API、Google Developer Key、OAuth 或修改
        DNS。
      </p>
    </main>
  );
}

export function AdminGoogleMapsBookingPage() {
  const [items, setItems] = useState<any[]>([]),
    [notice, setNotice] = useState("");
  const [drafts, setDrafts] = useState<Record<string, any>>({});
  const load = () =>
    adminApi("/api/admin/google-maps-booking")
      .then((data) => {
        setItems(data.items || []);
        setDrafts(
          Object.fromEntries(
            (data.items || []).map((x: any) => [
              x.id,
              {
                status: x.status,
                checklist: x.checklist || {},
                missing_info_note: x.missing_info_note || "",
                internal_note: x.internal_note || "",
              },
            ]),
          ),
        );
      })
      .catch((e) => setNotice(e.message));
  useEffect(() => {
    void load();
  }, []);
  const update = async (id: string) => {
    try {
      await adminApi(`/api/admin/google-maps-booking/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(drafts[id]),
      });
      setNotice("狀態與 Audit 已更新。");
      await load();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "更新失敗");
    }
  };
  return (
    <main className="admin-page google-admin-page">
      <AdminModuleNav current="google-booking" />
      <header>
        <p>Google Maps Booking Link</p>
        <h1>Google 地圖預約開通管理</h1>
        <span>營運人員審核、設定、測試與啟用；商家不能自行改成 ACTIVE。</span>
      </header>
      {notice && <div className="partner-message">{notice}</div>}
      <section className="google-admin-list">
        {items.length === 0 ? (
          <p>尚無申請。</p>
        ) : (
          items.map((item) => {
            const draft = drafts[item.id] || {};
            return (
              <article key={item.id}>
                <div>
                  <span className="status-badge">
                    {STATUS_LABELS[item.status]}
                  </span>
                  <h2>{item.current_merchant_name}</h2>
                  <a
                    href={item.google_maps_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    查看 Google Maps URL
                  </a>
                  {item.booking_url && (
                    <a href={item.booking_url}>查看 Booking Page</a>
                  )}
                </div>
                <label>
                  狀態
                  <select
                    value={draft.status || item.status}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [item.id]: { ...draft, status: e.target.value },
                      })
                    }
                  >
                    {[
                      ...STAGES.map(([key]) => key),
                      "NEEDS_INFO",
                      "SUSPENDED",
                    ].map((x) => (
                      <option key={x} value={x}>
                        {STATUS_LABELS[x]}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="google-admin-checklist">
                  {CHECKLIST.map(([key, label]) => (
                    <label key={key}>
                      <input
                        type="checkbox"
                        checked={Boolean(draft.checklist?.[key])}
                        onChange={(e) =>
                          setDrafts({
                            ...drafts,
                            [item.id]: {
                              ...draft,
                              checklist: {
                                ...draft.checklist,
                                [key]: e.target.checked,
                              },
                            },
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <label>
                  需補資料說明
                  <textarea
                    value={draft.missing_info_note || ""}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [item.id]: {
                          ...draft,
                          missing_info_note: e.target.value,
                        },
                      })
                    }
                  />
                </label>
                <label>
                  內部備註
                  <textarea
                    value={draft.internal_note || ""}
                    onChange={(e) =>
                      setDrafts({
                        ...drafts,
                        [item.id]: { ...draft, internal_note: e.target.value },
                      })
                    }
                  />
                </label>
                <button
                  className="btn btn-primary"
                  onClick={() => void update(item.id)}
                >
                  儲存狀態
                </button>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}

export function GoogleMapsBookingPage() {
  const { token = "" } = useParams();
  const [context, setContext] = useState<any>(),
    [slots, setSlots] = useState<any[]>([]),
    [success, setSuccess] = useState<any>(),
    [notice, setNotice] = useState("");
  const idempotency = useRef(crypto.randomUUID());
  const [form, setForm] = useState({
    service_id: "",
    staff_id: "",
    date: "",
    time: "",
    customer_name: "",
    customer_phone: "",
    note: "",
    privacy_consent: false,
  });
  useEffect(() => {
    void publicApi(
      `/api/merchant/${encodeURIComponent(token)}/booking/services`,
    )
      .then((data) => {
        setContext(data);
        const first = data.items?.[0];
        if (first)
          setForm((value) => ({
            ...value,
            service_id: first.id,
            staff_id: first.staff_id,
          }));
      })
      .catch((e) => setNotice(e.message));
  }, [token]);
  const uniqueServices = useMemo(
    () =>
      Array.from(
        new Map((context?.items || []).map((x: any) => [x.id, x])).values(),
      ) as any[],
    [context],
  );
  const staff = useMemo(
    () => (context?.items || []).filter((x: any) => x.id === form.service_id),
    [context, form.service_id],
  );
  const loadSlots = async () => {
    if (!form.service_id || !form.date) return;
    try {
      const data = await publicApi(
        `/api/merchant/${encodeURIComponent(token)}/booking/availability?service_id=${encodeURIComponent(form.service_id)}&staff_id=${encodeURIComponent(form.staff_id)}&date=${form.date}`,
      );
      setSlots(data.items || []);
      setNotice(data.message || "");
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "無法取得時段");
    }
  };
  useEffect(() => {
    void loadSlots();
  }, [form.service_id, form.staff_id, form.date]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setNotice("");
    try {
      const data = await publicApi(
        `/api/merchant/${encodeURIComponent(token)}/booking`,
        {
          method: "POST",
          headers: { "idempotency-key": idempotency.current },
          body: JSON.stringify({
            ...form,
            party_size: 1,
            consent_version: "google-maps-booking-v1",
          }),
        },
      );
      setSuccess(data);
      idempotency.current = crypto.randomUUID();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "預約送出失敗");
    }
  };
  if (success)
    return (
      <main className="google-customer-booking">
        <section className="google-booking-success">
          <Check weight="bold" />
          <h1>預約已送出</h1>
          <p>預約編號：{success.booking.booking_code}</p>
          <p>
            {success.booking.service_name} ·{" "}
            {new Date(success.booking.start_at).toLocaleString("zh-TW")}
          </p>
          {context?.line_add_friend_url && (
            <a
              className="btn btn-outline"
              href={context.line_add_friend_url}
              target="_blank"
              rel="noreferrer"
            >
              <LineSegments />
              加入店家 LINE
            </a>
          )}
          <small>加入 LINE 為選填，不影響預約成立。</small>
        </section>
      </main>
    );
  if (!context)
    return (
      <main className="google-customer-booking">
        <p>{notice || "正在載入商家預約頁…"}</p>
      </main>
    );
  return (
    <main className="google-customer-booking">
      <header>
        <span className="google-store-logo">
          <Storefront />
        </span>
        <div>
          <p>Google 地圖預約</p>
          <h1>{context.merchant.name}</h1>
          <span>線上選擇服務與可用時段</span>
        </div>
      </header>
      <form onSubmit={submit}>
        <label>
          服務項目
          <select
            value={form.service_id}
            onChange={(e) => {
              const found = context.items.find(
                (x: any) => x.id === e.target.value,
              );
              setForm({
                ...form,
                service_id: e.target.value,
                staff_id: found?.staff_id || "",
                time: "",
              });
            }}
          >
            {uniqueServices.map((x: any) => (
              <option key={x.id} value={x.id}>
                {x.name}
                {x.price_text ? `｜${x.price_text}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label>
          服務人員
          <select
            value={form.staff_id}
            onChange={(e) =>
              setForm({ ...form, staff_id: e.target.value, time: "" })
            }
          >
            {staff.map((x: any) => (
              <option key={x.staff_id} value={x.staff_id}>
                {x.staff_name}
              </option>
            ))}
          </select>
        </label>
        <label>
          日期
          <input
            type="date"
            required
            min={new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Taipei" })}
            value={form.date}
            onChange={(e) =>
              setForm({ ...form, date: e.target.value, time: "" })
            }
          />
        </label>
        <fieldset>
          <legend>可用時段</legend>
          <div className="google-slot-grid">
            {slots.map((slot) => (
              <button
                type="button"
                className={form.time === slot.time ? "selected" : ""}
                onClick={() => setForm({ ...form, time: slot.time })}
                key={`${slot.staff_id}-${slot.time}`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </fieldset>
        <label>
          姓名
          <input
            required
            value={form.customer_name}
            onChange={(e) =>
              setForm({ ...form, customer_name: e.target.value })
            }
          />
        </label>
        <label>
          手機
          <input
            required
            inputMode="tel"
            placeholder="09xxxxxxxx"
            value={form.customer_phone}
            onChange={(e) =>
              setForm({ ...form, customer_phone: e.target.value })
            }
          />
        </label>
        <label>
          備註（選填）
          <textarea
            value={form.note}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
          />
        </label>
        <label className="google-check">
          <input
            type="checkbox"
            required
            checked={form.privacy_consent}
            onChange={(e) =>
              setForm({ ...form, privacy_consent: e.target.checked })
            }
          />
          我同意為完成本次預約使用必要資料。
        </label>
        {notice && <p className="partner-message">{notice}</p>}
        <button className="btn btn-primary btn-lg" disabled={!form.time}>
          確認預約
        </button>
      </form>
      <footer>Powered by 創百業智慧鏈</footer>
    </main>
  );
}
