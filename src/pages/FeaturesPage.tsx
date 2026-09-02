import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle,
  Code,
  GlobeHemisphereWest,
  Handshake,
  Megaphone,
  Package,
  Receipt,
  Robot,
  ShieldCheck,
  ShoppingCart,
  Storefront,
  Truck,
  UserCircle,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout, SectionHeading } from "../components";
import "../features-page.css";

type FeatureStatus = "live" | "ready" | "development" | "provider";

type FeatureItem = {
  name: string;
  description: string;
  status: FeatureStatus;
  href?: string;
};

type FeatureGroup = {
  icon: typeof Storefront;
  title: string;
  description: string;
  items: FeatureItem[];
};

const statusMeta: Record<FeatureStatus, { label: string; hint: string }> = {
  live: { label: "已正式上線", hint: "目前正式環境已有可使用功能。" },
  ready: { label: "已完成・需個別開通", hint: "程式已進正式環境或已完成驗證，但需依商家契約、權限或設定個別啟用。" },
  development: { label: "開發／驗證中", hint: "已進入開發或 Staging 驗證，尚未列為正式標準交付。" },
  provider: { label: "需第三方核准", hint: "須取得外部服務商的正式資格、憑證或 E2E 驗證後才可開通。" },
};

const groups: FeatureGroup[] = [
  {
    icon: GlobeHemisphereWest,
    title: "品牌網站與內容",
    description: "從品牌門面到未來商家自助編輯，讓網站不只是名片，而是營運入口。",
    items: [
      { name: "標準規格品牌網站", description: "RWD、品牌介紹、服務／商品、聯絡、SEO 基礎與行動裝置優化。", status: "live" },
      { name: "自有網域與網站維持", description: "正式網域、網站維持與後續年度服務依合作方案辦理。", status: "live" },
      { name: "商家網站 CMS／一頁式頁面", description: "頁面建立、草稿、預覽、發布、版本、導航、媒體與 SEO 自助管理。", status: "development" },
      { name: "頁面版本與 Rollback", description: "保留頁面版本，支援預覽、發布與回復舊版本。", status: "development" },
    ],
  },
  {
    icon: Robot,
    title: "AI 智能客服",
    description: "把商家的品牌知識、常見問題與真實營運資料接到網站與 LINE。",
    items: [
      { name: "網站 AI Chat", description: "網站右下角 AI 客服，依商家知識內容回答問題。", status: "live" },
      { name: "LINE AI 客服", description: "LINE Messaging API 串接 AI，與網站共用商家知識與額度。", status: "live" },
      { name: "固定關鍵字回覆", description: "高頻問題走固定回答，不消耗 AI 成功回覆額度。", status: "live" },
      { name: "AI 安全轉真人", description: "退款、法律、賠償、特殊付款等高風險情境不由 AI 自行承諾。", status: "live" },
      { name: "AI 預約 Tool Calling", description: "AI 先查真實 Availability，再回答可預約時段或協助建立預約。", status: "development" },
    ],
  },
  {
    icon: CalendarCheck,
    title: "線上預約",
    description: "適合美容、課程、顧問、手作、服務業及需要排班的商家。",
    items: [
      { name: "服務／員工／營業時間", description: "服務項目、工作人員、每週營業時間與特殊休息日。", status: "live" },
      { name: "Availability API", description: "依服務時間、員工、黑名單日期與既有預約計算真實空檔。", status: "live" },
      { name: "防撞單", description: "使用安全寫入機制避免同一時段被重複搶占。", status: "live" },
      { name: "查詢／改期／取消", description: "顧客可安全查詢，並依規則進行改期與取消。", status: "live" },
      { name: "日／週／月管理行事曆", description: "商家後台查看預約與處理狀態。", status: "live" },
      { name: "LINE 預約通知 E2E", description: "預約提醒與狀態通知架構已預留，正式大量推送仍需完整驗證。", status: "development" },
    ],
  },
  {
    icon: UserCircle,
    title: "會員與顧客經營",
    description: "把一次到訪轉成可持續經營的會員與 CRM 關係。",
    items: [
      { name: "商家會員資料隔離", description: "以 merchant_id 隔離商家會員，不讓不同商家互相讀取。", status: "development" },
      { name: "掃碼加入會員", description: "QR Code 加入快速會員，使用雜湊 Session Token 保護登入狀態。", status: "development" },
      { name: "會員回購追蹤", description: "整合會員關係、消費歷程與回購追蹤。", status: "development" },
      { name: "CRM／標籤／Timeline", description: "顧客分類、互動紀錄、回購與服務追蹤。", status: "development" },
      { name: "會員分級與會員價", description: "依消費、訂單等條件建立會員等級、會員專屬價格與商品。", status: "development" },
      { name: "購物金 Ledger", description: "不可變購物金流水、發送、到期、折抵與退款回沖。", status: "development" },
    ],
  },
  {
    icon: ShoppingCart,
    title: "Web 點餐與電商",
    description: "從手機點餐延伸到多商家商品、購物車、結帳與訂單管理。",
    items: [
      { name: "QR 手機點餐", description: "掃碼辨識商家／桌號、菜單、購物車、送單與訂單狀態。", status: "development" },
      { name: "百工牛肉麵互動示範", description: "功能示範：掃碼加入會員、選餐加料、送單與查看狀態；非正式合作案例。", status: "ready", href: "https://baiye-beef-noodle-demo.pages.dev/" },
      { name: "商品／規格／SKU", description: "多規格商品、SKU、圖片、上下架與商品狀態管理。", status: "development" },
      { name: "庫存與 Reservation", description: "庫存流水、保留、消耗、釋放及並發防超賣。", status: "development" },
      { name: "訪客／會員購物車", description: "後端重新計價、Token 保護、冪等結帳與價格快照。", status: "development" },
      { name: "訂單／退換貨／退款", description: "訂單狀態、拆分出貨、退貨、部分退款及全額退款。", status: "development" },
      { name: "團購與 KOL 分潤", description: "級距團購、分享、歸因、佣金與退款回沖。", status: "development" },
    ],
  },
  {
    icon: Receipt,
    title: "財務、訂金與月結",
    description: "把平台收款、費用、退款、應撥與稽核集中到同一套財務底座。",
    items: [
      { name: "財務帳本", description: "收款、人工付款、退款、手續費、淨額、支出、損益與 CSV。", status: "live" },
      { name: "訂金代收與月結對帳", description: "Settlement V1 程式已部署正式環境；目前所有商家 Profile 維持停用。", status: "ready" },
      { name: "NT$18,000 銷售抵付 Ledger", description: "依正式契約逐期抵付，支援退款回沖與不可變 Ledger。", status: "ready" },
      { name: "私人 PDF／CSV 對帳", description: "鎖定後產生版本化文件與 Audit，不使用公開檔案 URL。", status: "ready" },
      { name: "稅務預留／扣繳設定", description: "預設關閉，需依記帳士或稅務專業人員確認後個別啟用。", status: "ready" },
      { name: "AI 會計與 OCR 憑證", description: "自動分類、財務摘要、異常提醒與對帳建議。", status: "development" },
    ],
  },
  {
    icon: Receipt,
    title: "付款與電子發票",
    description: "採 Provider Adapter 架構，只有正式審核、憑證與 E2E 通過後才開啟真實交易。",
    items: [
      { name: "悠遊付 QR／悠遊卡到店感應", description: "Payment Intent 與店家確認架構已開發，真實支付仍維持停用。", status: "provider" },
      { name: "ECPay／NewebPay／LINE Pay／Stripe", description: "介面預留；正式 Merchant 審核、Webhook、付款、退款與對帳通過後才可啟用。", status: "provider" },
      { name: "電子發票", description: "Provider Adapter 與資料架構規劃中，正式開立需第三方服務資格。", status: "provider" },
      { name: "付款冪等與 Webhook 防重送", description: "正式交易設計要求簽章驗證、Idempotency 與 reconciliation。", status: "development" },
    ],
  },
  {
    icon: Truck,
    title: "外送、物流與取貨",
    description: "支援外部平台導流與未來正式物流 Provider 串接。",
    items: [
      { name: "Uber Eats／foodpanda 連結", description: "商家可設定官方 HTTPS 外送連結與匿名點擊統計。", status: "development" },
      { name: "LINE／自有外送連結", description: "可設定商家自己的 LINE 或 HTTPS 外送入口。", status: "development" },
      { name: "Uber Direct Adapter", description: "Adapter 已預留，正式 API 權限取得前保持 Disabled。", status: "provider" },
      { name: "宅配／超取／取貨付款", description: "物流 Provider、運費規則、出貨與追蹤為 Commerce 開發範圍。", status: "development" },
    ],
  },
  {
    icon: Megaphone,
    title: "行銷、促銷與數據",
    description: "把會員、促銷、訊息與成效分析串成可追蹤的營運流程。",
    items: [
      { name: "會員標籤與分級", description: "依顧客互動與消費歷程建立會員經營工具。", status: "development" },
      { name: "滿額折扣／滿額贈／免運／加購", description: "促銷規則、條件、優先順序與可否併用。", status: "development" },
      { name: "棄單／補貨／生日提醒", description: "行銷自動化 Queue、條件與通知歷程。", status: "development" },
      { name: "LINE／Email／SMS 訊息中心", description: "範本、排程、分眾與發送紀錄；真實外部發送需權限。", status: "provider" },
      { name: "營運分析與漏斗", description: "頁面瀏覽、點擊、加入購物車、結帳、購買、退款等事件分析。", status: "development" },
      { name: "A/B Test", description: "圖片、CTA、區塊與轉換實驗架構。", status: "development" },
      { name: "GA4／Meta／Google Ads", description: "商家個別 Integration、Consent 與 Server-side Event 架構。", status: "provider" },
    ],
  },
  {
    icon: Handshake,
    title: "承攬夥伴與電子契約",
    description: "從申請、審核、啟用、簽約到成交與獎勵都有正式流程。",
    items: [
      { name: "承攬夥伴申請／審核／啟用", description: "安全 Invite、設定密碼、登入與狀態管理。", status: "live" },
      { name: "電子簽署契約", description: "契約閱讀、手寫簽名、Hash、Timestamp、DB 與私人 R2 PDF。", status: "live" },
      { name: "成交與分級獎勵", description: "依有效成交分級、非追溯升級及每月資格規則管理。", status: "live" },
      { name: "VIP 百萬推廣獎勵規則", description: "依三年週期與有效新商家數計算，排除退款、測試與重複付款。", status: "live" },
    ],
  },
  {
    icon: Storefront,
    title: "商家融資合作",
    description: "定位為合作機構資訊展示與申請轉介，不由創百業自行核貸或放款。",
    items: [
      { name: "合作機構與產品資訊", description: "驗證、法務核准、有效期限與官方網址皆通過才公開。", status: "development" },
      { name: "融資 Lead 加密", description: "AES-GCM 加密聯絡資料，SHA-256 用於搜尋去重。", status: "development" },
      { name: "逐家個資分享同意", description: "使用者明確選擇合作機構及分享資料範圍。", status: "development" },
      { name: "正式轉介", description: "真實合作契約、法務與合作機構串接完成前保持 Disabled。", status: "provider" },
      { name: "P2P／私人放款阻擋", description: "不開放 private_lender、unknown、P2P 或 peer-to-peer 類型。", status: "development" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "平台後台、安全與 API",
    description: "正式商用 SaaS 的核心不是只有畫面，而是權限、隔離、稽核與可回復性。",
    items: [
      { name: "Admin Server-side Auth", description: "HttpOnly Session、CSRF、Origin、Rate Limit、Session Expiry 與角色權限。", status: "live" },
      { name: "D1／R2／Audit", description: "正式 D1 資料庫、私人 R2 文件與操作稽核紀錄。", status: "live" },
      { name: "Backup／Migration／Rollback", description: "重要 Production 變更採 Backup → Test → Build → Deploy → QA。", status: "live" },
      { name: "Merchant Auth／Permission Matrix", description: "商家登入、角色權限與商家隔離已進 Commerce Staging 驗證。", status: "development" },
      { name: "Open API／Webhook", description: "API Key Hash、Scope、Rate Limit、HMAC Webhook 與 Retry。", status: "development" },
      { name: "第三方 Provider Gate", description: "未取得正式憑證、核准與 E2E 的功能一律 Disabled。", status: "live" },
    ],
  },
];

const allItems = groups.flatMap((group) => group.items);
const statusCounts = (Object.keys(statusMeta) as FeatureStatus[]).map((status) => ({
  status,
  count: allItems.filter((item) => item.status === status).length,
  ...statusMeta[status],
}));

export function FeaturesPage() {
  return (
    <PublicLayout>
      <section className="features-hero">
        <div className="container features-hero-grid">
          <div>
            <span className="eyebrow">創百業智慧鏈｜功能總覽</span>
            <h1>從網站、AI、LINE 到預約、財務與電商，一頁看懂全部功能</h1>
            <p>
              我們把功能依「正式上線、個別開通、開發驗證、第三方核准」清楚分開。你看到的每一項，都標示目前真實狀態，不用 Demo 或假功能撐畫面。
            </p>
            <div className="features-hero-actions">
              <Link to="/pricing" className="btn btn-primary btn-lg">
                查看 NT$18,000 方案 <ArrowRight />
              </Link>
              <Link to="/contact" className="btn btn-outline btn-lg">
                詢問適合我的功能
              </Link>
            </div>
          </div>
          <aside className="features-summary-card">
            <CheckCircle size={44} weight="duotone" />
            <strong>{allItems.length} 項功能與能力</strong>
            <p>依目前正式站與開發狀態整理，未正式啟用的功能不會包裝成已可交易。</p>
          </aside>
        </div>
      </section>

      <section className="section features-status-section">
        <div className="container">
          <SectionHeading
            eyebrow="狀態怎麼看"
            title="先看功能，再看現在能不能正式用"
            description="相同功能在不同商家可能因契約、權限或第三方資格而有不同啟用狀態。"
          />
          <div className="features-status-grid">
            {statusCounts.map(({ status, count, label, hint }) => (
              <article className={`features-status-card status-${status}`} key={status}>
                <span>{label}</span>
                <strong>{count}</strong>
                <p>{hint}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section features-groups-section">
        <div className="container">
          <SectionHeading
            eyebrow="全部功能"
            title="依商家營運流程整理"
            description="從被看見、接待客戶、成交、收款、回購到後台管理，逐步形成完整數位營運鏈。"
          />
          <div className="features-groups-grid">
            {groups.map(({ icon: Icon, title, description, items }) => (
              <article className="features-group-card" key={title}>
                <div className="features-group-heading">
                  <span className="features-group-icon"><Icon weight="duotone" /></span>
                  <div>
                    <h2>{title}</h2>
                    <p>{description}</p>
                  </div>
                </div>
                <div className="features-items-list">
                  {items.map((item) => (
                    <div className="features-item" key={item.name}>
                      <div>
                        <strong>{item.name}</strong>
                        <p>{item.description}</p>
                        {item.href ? <a className="features-demo-link" href={item.href} target="_blank" rel="noreferrer">查看牛肉麵互動示範 <ArrowRight/></a> : null}
                      </div>
                      <span className={`features-status-badge status-${item.status}`}>
                        {statusMeta[item.status].label}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section features-principles-section">
        <div className="container">
          <SectionHeading
            eyebrow="正式站原則"
            title="使用者看得到的功能，就必須真的能使用"
          />
          <div className="features-principles-grid">
            <article>
              <ShieldCheck size={34} weight="duotone" />
              <h3>沒有正式資格就不開</h3>
              <p>金流、物流、電子發票、簡訊、融資等第三方服務，在正式核准與 E2E 完成前保持 Disabled。</p>
            </article>
            <article>
              <Code size={34} weight="duotone" />
              <h3>先 Staging，再 Production</h3>
              <p>大型新功能先在隔離 Staging 完成測試，再依 Backup、Migration、Deploy、QA 流程進正式環境。</p>
            </article>
            <article>
              <Bell size={34} weight="duotone" />
              <h3>不使用假資料製造成績</h3>
              <p>正式網站不展示假商家、假成交、假會員或未確認的合作數字。</p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-cta features-cta">
        <div className="container">
          <div>
            <span>不需要一次把所有功能都裝上。</span>
            <h2>依你的行業，選真正會用到的功能</h2>
            <p>我們會先看既有網站、LINE、預約、會員、銷售與營運流程，再決定哪些模組適合優先導入。</p>
          </div>
          <div className="home-cta-actions">
            <Link to="/pricing" className="btn btn-accent btn-lg">
              查看方案 <ArrowRight />
            </Link>
            <Link to="/pos-comparison" className="btn btn-light btn-lg">
              比較 Web 與 POS
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
