import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, FileText, Gear, Globe, LineSegments, Package, Storefront, UserCircle, UsersThree } from "@phosphor-icons/react";
import { merchantOrderingApi } from "../qr-ordering-client";
import { downloadMerchantContractPdf } from "../merchant-contract-pdf";

type Dashboard = any;
const money = (minor = 0) => `NT$${Math.round(Number(minor) / 100).toLocaleString("zh-TW")}`;
const message = (error: unknown) => error instanceof Error ? error.message : "商家管理服務暫時無法使用。";

function Shell({ children, title = "商家管理中心" }: { children: React.ReactNode; title?: string }) {
  return <main className="merchant-admin-shell"><header className="merchant-admin-top"><div><p>創百業智慧鏈</p><h1>{title}</h1></div><Link className="merchant-admin-account-link" to="/merchant/account"><UserCircle size={24} />管理者帳戶</Link></header>{children}</main>;
}

export function MerchantAdminDashboardPage() {
  const [data, setData] = useState<Dashboard>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<Dashboard>("/api/merchant-admin/dashboard").then(setData).catch((error: any) => { if (error?.status === 401) window.location.hash = "#/merchant/login"; else setNotice(message(error)); }); }, []);
  if (!data) return <Shell><section className="merchant-admin-state"><p>{notice || "正在載入管理者資料…"}</p></section></Shell>;
  const locked = data.operation_locked;
  const modules = [
    { icon: Storefront, name: "商家基本資料", text: "品牌、介紹、聯絡與營業資訊", to: "/merchant/profile", ready: true },
    { icon: Globe, name: "網站內容", text: "管理公告與一般網站內容資料", to: "/merchant/profile", ready: true },
    { icon: Package, name: "商城商品", text: "商品、分類、價格、圖片、規格與上下架", to: "/merchant-admin/ordering", ready: data.entitlements?.merchant_product_editable === true },
    { icon: FileText, name: "訂單與購物車", text: "查看購物車建立的訂單並處理履約狀態", to: "/merchant-admin/ordering", ready: data.entitlements?.cart === true },
    { icon: CalendarCheck, name: "預約管理", text: "查看、確認與取消預約", to: "/merchant/bookings", ready: true },
    { icon: UsersThree, name: "會員管理", text: "只顯示與本商家有關的會員", to: "/merchant/members", ready: true },
    { icon: Globe, name: "Google 地圖預約", text: "申請、補件與查看開通狀態", to: "/merchant/google-maps-booking", ready: true },
    { icon: LineSegments, name: "LINE 官方帳號", text: "查看 LINE OA 連結狀態", to: "/merchant/line", ready: true },
    { icon: FileText, name: "契約", text: "查看方案及下載已簽契約", to: "/merchant/contracts", ready: true },
    { icon: Gear, name: "商家設定", text: "帳戶與管理者 Session", to: "/merchant/account", ready: true },
  ];
  return <Shell><section className="merchant-admin-summary"><div><span>店家名稱</span><strong>{data.merchant.name}</strong></div><div><span>管理者</span><strong>{data.administrator.phone_masked || "手機已驗證"}</strong></div><div><span>帳戶狀態</span><strong>{data.account_status}</strong></div><div><span>契約狀態</span><strong>{data.contract.status === "signed" ? "已完成簽署" : "待簽約"}</strong></div><div><span>方案</span><strong>{data.plan.plan_name}</strong><small>{money(data.plan.discount_price_minor)} 固定完整方案</small></div><div><span>支付狀態</span><strong>{data.payment_readiness?.production_payment_enabled ? "Provider 已就緒" : "待 Provider 審核／技術啟用"}</strong></div></section>{locked && <section className="merchant-admin-gate"><h2>管理者權限待啟用</h2><p>完成商家平台服務契約與啟用流程後，才可修改商品、預約、會員與營運設定。</p><Link className="btn btn-primary" to="/merchant/contract">完成商家契約</Link></section>}<section className={`merchant-admin-modules ${locked ? "is-locked" : ""}`}>{modules.map(({ icon: Icon, ...item }) => <article key={item.name}><Icon size={30} weight="duotone" /><h2>{item.name}</h2><p>{item.text}</p>{locked && !["契約","商家設定"].includes(item.name) ? <span className="merchant-module-disabled">完成啟用後開放</span> : item.ready ? <Link className="btn btn-outline" to={item.to}>進入管理</Link> : <span>此方案未啟用</span>}</article>)}</section></Shell>;
}

export function MerchantProfilePage() {
  const [data, setData] = useState<any>(), [form, setForm] = useState<any>({}), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-admin/profile").then((value) => { setData(value); setForm(value.profile || {}); }).catch((error) => setNotice(message(error))); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setNotice(""); try { await merchantOrderingApi("/api/merchant-admin/profile", { method: "PATCH", body: JSON.stringify(form) }); setNotice("商家基本資料已儲存。"); } catch (error) { setNotice(message(error)); } };
  const field = (key: string, label: string, type = "text") => <label>{label}{type === "textarea" ? <textarea value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /> : <input type={type} value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />}</label>;
  return <Shell title="商家基本資料"><form className="merchant-admin-form" onSubmit={submit}><p className="merchant-admin-lock-note">{data?.legal_fields_locked ? "公司法定名稱、統一編號、契約簽署人等法定資料已鎖定；請聯絡百工辦理正式變更。" : "此頁管理一般商家內容，不包含法定契約資料。"}</p>{field("brand_name","品牌名稱")}{field("business_description","商家介紹","textarea")}{field("support_phone","客服電話","tel")}{field("support_email","客服 Email","email")}{field("business_address","營業地址")}{field("business_hours","營業時間","textarea")}{field("transportation_info","交通資訊","textarea")}{field("homepage_notice","首頁公告","textarea")}<button className="btn btn-primary">儲存資料</button>{notice && <p className="partner-message">{notice}</p>}</form></Shell>;
}

export function MerchantBookingsPage() {
  const [rows, setRows] = useState<any[]>([]), [notice, setNotice] = useState("");
  const load = () => merchantOrderingApi<any>("/api/merchant-admin/bookings").then((data) => setRows(data.bookings)).catch((error) => setNotice(message(error)));
  useEffect(() => { void load(); }, []);
  const update = async (id: string, status: string) => { if (status === "cancelled" && !window.confirm("確定取消此預約？此操作會留下稽核紀錄。")) return; try { await merchantOrderingApi(`/api/merchant-admin/bookings/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify({ status, confirm: status === "cancelled" }) }); await load(); } catch (error) { setNotice(message(error)); } };
  return <Shell title="預約管理"><section className="merchant-admin-list">{rows.map((row) => <article key={row.id}><div><strong>{row.customer_name}｜{row.service_name}</strong><p>{new Date(row.start_at).toLocaleString("zh-TW")} · {row.phone_masked} · {row.booking_source}</p></div><div className="merchant-admin-actions"><button onClick={() => void update(row.id,"confirmed")}>確認</button><button onClick={() => void update(row.id,"completed")}>完成</button><button className="danger" onClick={() => void update(row.id,"cancelled")}>取消</button></div></article>)}{!rows.length && <p>{notice || "目前沒有預約紀錄。"}</p>}</section></Shell>;
}

export function MerchantMembersPage() {
  const [rows, setRows] = useState<any[]>([]), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-admin/members").then((data) => setRows(data.members)).catch((error) => setNotice(message(error))); }, []);
  return <Shell title="會員管理"><p className="merchant-admin-lock-note">僅顯示與本商家有關的會員 relationship；手機預設遮罩。</p><section className="merchant-admin-list">{rows.map((row) => <article key={row.id}><div><strong>{row.display_name || "會員"}</strong><p>{row.phone_masked} · 預約 {row.booking_count || 0} · 互動 {row.visit_count || 0}</p></div><span>{row.status}</span></article>)}{!rows.length && <p>{notice || "目前沒有商家會員紀錄。"}</p>}</section></Shell>;
}

export function MerchantLinePage() {
  const [data, setData] = useState<any>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-admin/line").then(setData).catch((error) => setNotice(message(error))); }, []);
  return <Shell title="LINE 官方帳號"><section className="merchant-admin-state"><h2>{data?.integration?.enabled ? "已連結" : "尚未連結"}</h2>{data?.integration ? <><p>名稱：{data.integration.display_name || "未設定"}</p><p>Basic ID：{data.integration.basic_id || "未設定"}</p><p>模式：{data.integration.integration_mode}</p></> : <p>{notice || "目前尚未設定 LINE OA。"}</p>}<p>Channel Secret、Access Token 與 Webhook Secret 永遠不會顯示在商家端。</p></section></Shell>;
}

export function MerchantAccountPage() {
  const navigate = useNavigate(); const [data, setData] = useState<any>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-admin/account").then(setData).catch((error) => setNotice(message(error))); }, []);
  const logout = async (all = false) => { if (all && !window.confirm("確定登出所有裝置？")) return; try { await merchantOrderingApi(all ? "/api/merchant-admin/logout-all" : "/api/merchant-auth/logout", { method: "POST", body: "{}" }); navigate("/merchant/login", { replace: true }); } catch (error) { setNotice(message(error)); } };
  return <Shell title="管理者帳戶"><section className="merchant-admin-account">{data && <><dl><dt>身份</dt><dd>管理者</dd><dt>手機</dt><dd>{data.phone_masked}</dd><dt>商家</dt><dd>{data.merchant.name}</dd><dt>帳戶狀態</dt><dd>{data.status === "ACTIVE" ? "啟用" : "待啟用"}</dd></dl><h2>登入裝置／Session</h2><p>目前有效 Session：{data.sessions.length}</p></>}<div className="merchant-admin-actions"><button className="btn btn-outline" onClick={() => void logout(false)}>登出</button><button className="btn btn-outline danger" onClick={() => void logout(true)}>登出所有裝置</button></div>{notice && <p>{notice}</p>}</section></Shell>;
}
