import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, CookingPot, DotsThree, FileText, Gear, Globe, House, LineSegments, NotePencil, Package, QrCode, Receipt, Storefront, UserCircle, UsersThree } from "@phosphor-icons/react";
import { merchantOrderingApi } from "../qr-ordering-client";
import { downloadMerchantContractPdf } from "../merchant-contract-pdf";
import { ContractSignatureCanvas, type SignatureValue } from "../components/ContractSignatureCanvas";

type Dashboard = any;
const money = (minor = 0) => `NT$${Math.round(Number(minor) / 100).toLocaleString("zh-TW")}`;
const message = (error: unknown) => error instanceof Error ? error.message : "商家管理服務暫時無法使用。";

function Shell({ children, title = "商家管理中心" }: { children: React.ReactNode; title?: string }) {
  const demo = import.meta.env.VITE_APP_VARIANT === "beef-noodle-demo";
  return <main className={`merchant-admin-shell ${demo ? "is-demo-merchant" : ""}`}><header className="merchant-admin-top"><div><p>{demo ? "百工牛肉麵" : "創百業智慧鏈"}</p><h1>{title}</h1>{demo && <span className="demo-environment-pill">Demo 試用環境</span>}</div><Link className="merchant-admin-account-link" to="/merchant/account"><UserCircle size={24} />管理者帳戶</Link></header>{children}{demo && <nav className="merchant-demo-bottom-nav" aria-label="商家管理導覽"><Link to="/merchant/dashboard"><House size={24} weight="duotone" />首頁</Link><Link to="/merchant-admin/ordering#ordering-menu"><Package size={24} weight="duotone" />商品</Link><Link to="/merchant-admin/ordering#ordering-orders"><Receipt size={24} weight="duotone" />訂單</Link><Link to="/merchant/members"><UsersThree size={24} weight="duotone" />會員</Link><Link to="/merchant/account"><DotsThree size={24} weight="duotone" />更多</Link></nav>}</main>;
}

export function MerchantAdminDashboardPage() {
  const [data, setData] = useState<Dashboard>(), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<Dashboard>("/api/merchant-admin/dashboard").then(setData).catch((error: any) => { if (error?.status === 401) window.location.hash = "#/merchant/login"; else setNotice(message(error)); }); }, []);
  if (!data) return <Shell><section className="merchant-admin-state"><p>{notice || "正在載入管理者資料…"}</p></section></Shell>;
  const locked = data.operation_locked;
  const demo = data.demo_environment === true;
  const standardModules = [
    { icon: Storefront, name: "商家基本資料", text: "品牌、介紹、聯絡與營業資訊", to: "/merchant/profile", ready: true },
    { icon: Globe, name: "網站內容", text: "管理公告與一般網站內容資料", to: "/merchant/profile", ready: true },
    { icon: Package, name: "商城商品", text: "商品、分類、價格、圖片、規格與上下架", to: "/merchant-admin/ordering", ready: data.entitlements?.merchant_product_editable === true },
    { icon: FileText, name: "訂單與購物車", text: "查看購物車建立的訂單並處理履約狀態", to: "/merchant-admin/ordering", ready: data.entitlements?.cart === true },
    { icon: NotePencil, name: "申請內容修改", text: "提交網站文字、圖片、商品建檔與版型需求，由百工協助處理", to: "/merchant/content-change", ready: true },
    { icon: FileText, name: "加購與補充協議", text: "查看報價、附件 B、接受加購並簽署補充協議", to: "/merchant/addons", ready: true },
    { icon: CalendarCheck, name: "預約管理", text: "查看、確認與取消預約", to: "/merchant/bookings", ready: true },
    { icon: UsersThree, name: "會員管理", text: "只顯示與本商家有關的會員", to: "/merchant/members", ready: true },
    { icon: Globe, name: "Google 地圖預約", text: "申請、補件與查看開通狀態", to: "/merchant/google-maps-booking", ready: true },
    { icon: LineSegments, name: "LINE 官方帳號", text: "查看 LINE OA 連結狀態", to: "/merchant/line", ready: true },
    { icon: FileText, name: "契約", text: "查看方案及下載已簽契約", to: "/merchant/contracts", ready: true },
    { icon: Gear, name: "商家設定", text: "帳戶與管理者 Session", to: "/merchant/account", ready: true },
  ];
  const demoModules = [
    { icon: Package, name: "商品／菜單", text: "商品、分類、價格、圖片、規格、加料與售完", to: "/merchant-admin/ordering#ordering-menu", ready: true },
    { icon: Receipt, name: "訂單管理", text: "接單、製作、Ready、送桌與完成", to: "/merchant-admin/ordering#ordering-orders", ready: true },
    { icon: CookingPot, name: "KDS 廚房看板", text: "手機與平板全螢幕廚房看板", to: "/merchant-admin/ordering/kitchen", ready: true },
    { icon: CalendarCheck, name: "預約管理", text: "沿用 Booking Core 管理試用預約", to: "/merchant/bookings", ready: true },
    { icon: UsersThree, name: "會員管理", text: "只顯示百工牛肉麵的遮罩會員資料", to: "/merchant/members", ready: true },
    { icon: Globe, name: "Google 地圖預約", text: "Booking Link 申請、狀態與來源", to: "/merchant/google-maps-booking", ready: true },
    { icon: LineSegments, name: "LINE 官方帳號", text: "查看 Demo Merchant LINE readiness", to: "/merchant/line", ready: true },
    { icon: Package, name: "庫存", text: "日庫存、售完與補庫存試用", to: "/merchant/inventory", ready: true },
    { icon: Receipt, name: "付款", text: "現場付款可測；LINE Pay／Apple Pay 依 readiness", to: "/merchant/payments", ready: true },
    { icon: FileText, name: "電子發票", text: "Invoice Request 可測；正式 Provider 尚未啟用", to: "/merchant/invoice", ready: true },
    { icon: Storefront, name: "商家資料", text: "品牌、介紹、電話、地址與營業時間", to: "/merchant/profile", ready: true },
    { icon: FileText, name: "契約", text: "Demo 免簽；正式 Merchant Contract Gate 不受影響", to: "/merchant/contracts", ready: true },
    { icon: Gear, name: "帳戶", text: "管理者 Session、登出與登出所有裝置", to: "/merchant/account", ready: true },
  ];
  const modules = demo ? demoModules : standardModules;
  const resetDemo = async () => {
    if (!window.confirm("確定將百工牛肉麵恢復為初始試用狀態？")) return;
    if (!window.confirm("再次確認：商品、價格、庫存、Demo 訂單、預約、付款與發票試用資料將被重置。")) return;
    try { await merchantOrderingApi("/api/merchant-admin/demo/reset", { method: "POST", body: "{}" }); setNotice("牛肉麵 Demo 已恢復 Golden Data。"); }
    catch (error) { setNotice(message(error)); }
  };
  return <Shell><section className="merchant-admin-summary"><div><span>店家名稱</span><strong>{data.merchant.name}</strong></div><div><span>身份</span><strong>管理者</strong></div><div><span>帳戶狀態</span><strong>{data.account_status}</strong></div><div><span>契約狀態</span><strong>{demo ? "Demo 試用免簽" : data.contract.status === "signed" ? "已完成簽署" : "待簽約"}</strong></div><div><span>方案</span><strong>{data.plan.plan_name}</strong>{!demo && <small>{money(data.plan.discount_price_minor)} 固定完整方案</small>}</div><div><span>正式 Provider</span><strong>{data.payment_readiness?.production_payment_enabled ? "已就緒" : "尚未啟用正式服務"}</strong></div></section>{demo && <section className="merchant-demo-quick"><div><p>開始試用</p><h2>百工牛肉麵商家管理中心</h2><span>你所做的菜單修改會立即同步到顧客點餐頁。</span></div><div className="merchant-demo-quick-actions"><Link className="btn btn-primary" to="/merchant-admin/ordering#ordering-menu"><Package size={20} />修改菜單</Link><a className="btn btn-outline" href="#/q/myJghWaqQbCwMInWWsBUf2xRwsR02saT"><Storefront size={20} />查看前台</a><a className="btn btn-outline" href="#/q/myJghWaqQbCwMInWWsBUf2xRwsR02saT"><QrCode size={20} />建立測試訂單</a><Link className="btn btn-outline" to="/merchant-admin/ordering/kitchen"><CookingPot size={20} />開啟 KDS</Link><Link className="btn btn-outline" to="/merchant/members"><UsersThree size={20} />查看會員</Link><button className="btn btn-ghost danger" onClick={() => void resetDemo()}>重置試用</button></div></section>}{locked && <section className="merchant-admin-gate"><h2>管理者權限待啟用</h2><p>完成商家平台服務契約與啟用流程後，才可修改商品、預約、會員與營運設定。</p><Link className="btn btn-primary" to="/merchant/contract">完成商家契約</Link></section>}<section className={`merchant-admin-modules ${locked ? "is-locked" : ""}`}>{modules.map(({ icon: Icon, ...item }) => <article key={item.name}><Icon size={30} weight="duotone" /><h2>{item.name}</h2><p>{item.text}</p>{locked && !["契約","商家設定"].includes(item.name) ? <span className="merchant-module-disabled">完成啟用後開放</span> : item.ready ? <Link className="btn btn-outline" to={item.to}>進入管理</Link> : <span>此功能尚未開放</span>}</article>)}</section>{notice && <p className="partner-message">{notice}</p>}</Shell>;
}

export function MerchantProfilePage() {
  const [data, setData] = useState<any>(), [form, setForm] = useState<any>({}), [notice, setNotice] = useState("");
  useEffect(() => { void merchantOrderingApi<any>("/api/merchant-admin/profile").then((value) => { setData(value); setForm(value.profile || {}); }).catch((error) => setNotice(message(error))); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); setNotice(""); try { await merchantOrderingApi("/api/merchant-admin/profile", { method: "PATCH", body: JSON.stringify(form) }); setNotice("商家基本資料已儲存。"); } catch (error) { setNotice(message(error)); } };
  const field = (key: string, label: string, type = "text") => <label>{label}{type === "textarea" ? <textarea value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} /> : <input type={type} value={form[key] || ""} onChange={(event) => setForm({ ...form, [key]: event.target.value })} />}</label>;
  if (!data?.entitlements?.merchant_content_editable) { const p = data?.profile; return <Shell title="商家基本營運資料"><section className="merchant-admin-account"><p className="merchant-admin-lock-note">本方案 merchant_content_editable = false。網站主要內容、商品主要建檔與網站版型由百工協助修改，不提供完整 CMS Editor。</p>{p && <dl><dt>品牌名稱</dt><dd>{p.brand_name || p.name || "未設定"}</dd><dt>客服電話</dt><dd>{p.support_phone || p.phone || "未設定"}</dd><dt>客服 Email</dt><dd>{p.support_email || p.email || "未設定"}</dd><dt>營業地址</dt><dd>{p.business_address || "未設定"}</dd><dt>營業時間</dt><dd>{p.business_hours || "未設定"}</dd></dl>}<Link className="btn btn-primary" to="/merchant/content-change">申請內容修改</Link>{notice && <p>{notice}</p>}</section></Shell>; }
  return <Shell title="商家基本資料"><form className="merchant-admin-form" onSubmit={submit}><p className="merchant-admin-lock-note">此方案已啟用 merchant_content_editable；法定名稱、統一編號與契約簽署人仍須走正式變更流程。</p>{field("brand_name","品牌名稱")}{field("business_description","商家介紹","textarea")}{field("support_phone","客服電話","tel")}{field("support_email","客服 Email","email")}{field("business_address","營業地址")}{field("business_hours","營業時間","textarea")}{field("transportation_info","交通資訊","textarea")}{field("homepage_notice","首頁公告","textarea")}<button className="btn btn-primary">儲存資料</button>{notice && <p className="partner-message">{notice}</p>}</form></Shell>;
}

export function MerchantContentChangePage() {
  const [items, setItems] = useState(""), [text, setText] = useState(""), [images, setImages] = useState(""), [rows, setRows] = useState<any[]>([]), [notice, setNotice] = useState("");
  const load = () => merchantOrderingApi<any>("/api/merchant-admin/content-change-requests").then((data) => setRows(data.items || [])).catch((error) => setNotice(message(error)));
  useEffect(() => { void load(); }, []);
  const submit = async (event: React.FormEvent) => { event.preventDefault(); try { await merchantOrderingApi("/api/merchant-admin/content-change-requests", { method: "POST", body: JSON.stringify({ items, text, images: images.split("\n").map((v) => v.trim()).filter(Boolean) }) }); setItems(""); setText(""); setImages(""); setNotice("修改申請已送出，百工將進行審查；保固事項可為 NT$0，額外人工服務會另行報價。"); await load(); } catch (error) { setNotice(message(error)); } };
  return <Shell title="申請內容修改"><form className="merchant-admin-form" onSubmit={submit}><p className="merchant-admin-lock-note">請提交修改項目、圖片與文字需求。這不是完整網站編輯器或商品 CMS。</p><label>修改項目<textarea required value={items} onChange={(e) => setItems(e.target.value)} placeholder="例如：首頁營業時間、替換商品圖片、上架 3 項新品" /></label><label>指定文字<textarea value={text} onChange={(e) => setText(e.target.value)} /></label><label>圖片連結（每行一個）<textarea value={images} onChange={(e) => setImages(e.target.value)} /></label><button className="btn btn-primary">送出申請</button>{notice && <p className="partner-message">{notice}</p>}</form><section className="merchant-admin-list">{rows.map((row) => <article key={row.id}><div><strong>{row.items_text}</strong><p>{row.status} · {new Date(row.created_at).toLocaleString("zh-TW")}</p></div></article>)}</section></Shell>;
}

export function MerchantAddonsPage() {
  const [quotes, setQuotes] = useState<any[]>([]), [signing, setSigning] = useState<string>(), [name, setName] = useState(""), [signature, setSignature] = useState<SignatureValue>({ strokes: [] }), [notice, setNotice] = useState("");
  const load = () => merchantOrderingApi<any>("/api/merchant-admin/addon-quotes").then((data) => setQuotes(data.items || [])).catch((error) => setNotice(message(error)));
  useEffect(() => { void load(); }, []);
  const accept = async (id: string) => { if (!window.confirm("確認接受此加購報價？接受後會建立新的附件 B／補充協議，原已簽 PDF 不會修改。")) return; try { const result = await merchantOrderingApi<any>(`/api/merchant-admin/addon-quotes/${id}/accept`, { method: "POST", body: "{}" }); setSigning(result.addendum_id); await load(); } catch (error) { setNotice(message(error)); } };
  const sign = async (event: React.FormEvent) => { event.preventDefault(); if (!signing) return; try { await merchantOrderingApi(`/api/merchant-admin/addenda/${signing}/sign`, { method: "POST", body: JSON.stringify({ signatory_legal_name: name, signatory_role: "legal_representative", signature, read: true, electronic: true, commercial_terms: true, authority: true, signature_evidence: true }) }); setSigning(undefined); setNotice("補充協議已完成簽署，PDF 與 Evidence 已獨立保存。"); await load(); } catch (error) { setNotice(message(error)); } };
  return <Shell title="加購與附件 B"><section className="merchant-admin-state"><p>主方案固定 NT$18,000。附件 B 只在有加購時顯示；顯示金額皆由伺服器計算。</p></section><section className="merchant-admin-list">{quotes.map((q) => <article key={q.id}><div><strong>{q.quote_no}｜總額 {money(q.contract_total_minor)}</strong><p>主方案 {money(q.base_amount_minor)} ＋ 加購 {money(q.addon_amount_minor)} · {q.status}</p>{q.annex_b && <ul>{q.items.map((item: any) => <li key={item.pricing_code}>{item.label}：{money(item.amount_minor)}</li>)}</ul>}</div>{q.status === "ISSUED" && <button className="btn btn-primary" onClick={() => void accept(q.id)}>接受報價</button>}{q.addendum_status === "AWAITING_SIGNATURE" && <button className="btn btn-primary" onClick={() => setSigning(q.addendum_id)}>簽署補充協議</button>}{q.addendum_status === "SIGNED" && <button className="btn btn-outline" onClick={() => window.open(`/api/merchant-admin/addenda/${q.addendum_id}/pdf`, "_blank")}>下載 PDF</button>}</article>)}</section>{signing && <form className="merchant-admin-form" onSubmit={sign}><h2>簽署加購補充協議</h2><label>法定簽署姓名<input required value={name} onChange={(e) => setName(e.target.value)} /></label><ContractSignatureCanvas onChange={setSignature} /><label className="partner-consent"><input required type="checkbox" />我已閱讀並同意附件 B、總金額與電子簽署證據保存。</label><button className="btn btn-primary">完成簽署</button></form>}{notice && <p className="partner-message">{notice}</p>}</Shell>;
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
  const logout = async (all = false) => { if (all && !window.confirm("確定登出所有裝置？")) return; try { await merchantOrderingApi(all ? "/api/merchant-admin/logout-all" : "/api/merchant-auth/logout", { method: "POST", body: "{}" }); navigate(import.meta.env.VITE_APP_VARIANT === "beef-noodle-demo" ? "/merchant/demo-login" : "/merchant/login", { replace: true }); } catch (error) { setNotice(message(error)); } };
  return <Shell title="管理者帳戶"><section className="merchant-admin-account">{data && <><dl><dt>身份</dt><dd>管理者</dd><dt>手機</dt><dd>{data.phone_masked}</dd><dt>商家</dt><dd>{data.merchant.name}</dd><dt>帳戶狀態</dt><dd>{data.status === "ACTIVE" ? "啟用" : "待啟用"}</dd></dl><h2>登入裝置／Session</h2><p>目前有效 Session：{data.sessions.length}</p></>}<div className="merchant-admin-actions"><button className="btn btn-outline" onClick={() => void logout(false)}>登出</button><button className="btn btn-outline danger" onClick={() => void logout(true)}>登出所有裝置</button></div>{notice && <p>{notice}</p>}</section></Shell>;
}
