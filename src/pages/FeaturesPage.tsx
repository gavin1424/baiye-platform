import {
  ArrowRight,
  Bell,
  CalendarCheck,
  CheckCircle,
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
import { CTASection, MarketingHero, MarketingSection, PublicLayout, SectionHeading } from "../components";
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
  live: { label: "現已提供", hint: "符合方案與帳號資格後即可使用。" },
  ready: { label: "依方案開通", hint: "依商家方案、權限與服務設定個別開通。" },
  development: { label: "規劃服務", hint: "尚未列入現行標準服務，請先洽詢需求。" },
  provider: { label: "依合作條件提供", hint: "須符合合作服務商的申請與使用條件。" },
};

const groups: FeatureGroup[] = [
  {
    icon: GlobeHemisphereWest,
    title: "品牌網站與內容",
    description: "從品牌門面到未來商家自助編輯，讓網站不只是名片，而是營運入口。",
    items: [
      { name: "標準規格品牌網站", description: "RWD、品牌介紹、服務／商品、聯絡、SEO 基礎與行動裝置優化。", status: "live" },
      { name: "自有網域與網站維持", description: "正式網域、網站維持與後續年度服務依合作方案辦理。", status: "live" },
      { name: "商家網站內容管理", description: "依方案提供頁面、圖片、導覽及搜尋資訊管理。", status: "development" },
      { name: "頁面版本管理", description: "保留頁面版本，支援預覽、發布與回復舊版本。", status: "development" },
    ],
  },
  {
    icon: Robot,
    title: "AI 智能客服",
    description: "把商家的品牌知識、常見問題與真實營運資料接到網站與 LINE。",
    items: [
      { name: "網站 AI Chat", description: "網站右下角 AI 客服，依商家知識內容回答問題。", status: "live" },
      { name: "LINE AI 客服", description: "LINE 串接 AI，與網站共用商家知識與服務額度。", status: "live" },
      { name: "固定關鍵字回覆", description: "高頻問題走固定回答，不消耗 AI 成功回覆額度。", status: "live" },
      { name: "AI 安全轉真人", description: "退款、法律、賠償、特殊付款等高風險情境不由 AI 自行承諾。", status: "live" },
      { name: "AI 協助預約", description: "AI 查詢可預約時段後，協助顧客進入預約流程。", status: "development" },
    ],
  },
  {
    icon: CalendarCheck,
    title: "線上預約",
    description: "適合美容、課程、顧問、手作、服務業及需要排班的商家。",
    items: [
      { name: "服務／員工／營業時間", description: "服務項目、工作人員、每週營業時間與特殊休息日。", status: "live" },
      { name: "可預約時段查詢", description: "依服務時間、工作人員、休息日與既有預約計算可用時段。", status: "live" },
      { name: "防撞單", description: "使用安全寫入機制避免同一時段被重複搶占。", status: "live" },
      { name: "查詢／改期／取消", description: "顧客可安全查詢，並依規則進行改期與取消。", status: "live" },
      { name: "日／週／月管理行事曆", description: "商家後台查看預約與處理狀態。", status: "live" },
      { name: "LINE 預約通知", description: "預約提醒與狀態通知依商家 LINE 設定及訊息服務條件提供。", status: "development" },
    ],
  },
  {
    icon: UserCircle,
    title: "會員與顧客經營",
    description: "把一次到訪轉成可持續經營的會員與 CRM 關係。",
    items: [
      { name: "商家會員資料保護", description: "不同商家的會員資料分開保存，避免跨商家存取。", status: "development" },
      { name: "掃碼加入會員", description: "顧客可用 QR Code 快速加入會員並安全維持登入狀態。", status: "development" },
      { name: "會員回購追蹤", description: "整合會員關係、消費歷程與回購追蹤。", status: "development" },
      { name: "顧客分類與互動紀錄", description: "顧客分類、互動紀錄、回購與服務追蹤。", status: "development" },
      { name: "會員分級與會員價", description: "依消費、訂單等條件建立會員等級、會員專屬價格與商品。", status: "development" },
      { name: "購物金紀錄", description: "記錄購物金發送、到期、折抵與退款返還。", status: "development" },
    ],
  },
  {
    icon: ShoppingCart,
    title: "Web 點餐與電商",
    description: "從手機點餐延伸到多商家商品、購物車、結帳與訂單管理。",
    items: [
      { name: "QR 手機點餐", description: "掃碼辨識商家／桌號、菜單、購物車、送單與訂單狀態。", status: "development" },
      { name: "商品與規格管理", description: "多規格商品、品項編號、圖片、上下架與商品狀態管理。", status: "development" },
      { name: "庫存管理", description: "庫存異動、保留、釋放與避免超賣。", status: "development" },
      { name: "訪客／會員購物車", description: "結帳時重新確認價格，並避免重複建立訂單。", status: "development" },
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
      { name: "訂金代收與月結對帳", description: "依商家資格與約定內容個別申請開通。", status: "ready" },
      { name: "NT$18,000 銷售抵付紀錄", description: "依契約逐期記錄抵付，並保留退款返還紀錄。", status: "ready" },
      { name: "私人 PDF／CSV 對帳", description: "對帳文件以私人方式提供，並保留版本及操作紀錄。", status: "ready" },
      { name: "稅務預留／扣繳設定", description: "預設關閉，需依記帳士或稅務專業人員確認後個別啟用。", status: "ready" },
      { name: "AI 會計與 OCR 憑證", description: "自動分類、財務摘要、異常提醒與對帳建議。", status: "development" },
    ],
  },
  {
    icon: Receipt,
    title: "付款與電子發票",
    description: "付款與發票依商家申請資格、合作服務商審核及實際提供條件開通。",
    items: [
      { name: "悠遊付 QR／悠遊卡到店感應", description: "目前未提供線上啟用；須依合作服務商申請條件辦理。", status: "provider" },
      { name: "綠界／藍新／LINE Pay／Stripe", description: "須完成商家審核、付款、退款與對帳設定後才可啟用。", status: "provider" },
      { name: "電子發票", description: "正式開立須符合第三方發票服務的申請資格與使用條件。", status: "provider" },
      { name: "避免重複付款通知", description: "付款流程需驗證通知來源，並避免重複建立交易紀錄。", status: "development" },
    ],
  },
  {
    icon: Truck,
    title: "外送、物流與取貨",
    description: "支援外部平台導流，物流服務依合作服務商條件提供。",
    items: [
      { name: "Uber Eats／foodpanda 連結", description: "商家可設定官方 HTTPS 外送連結與匿名點擊統計。", status: "development" },
      { name: "LINE／自有外送連結", description: "可設定商家自己的 LINE 或 HTTPS 外送入口。", status: "development" },
      { name: "Uber Direct", description: "取得正式服務資格前不提供啟用。", status: "provider" },
      { name: "宅配／超取／取貨付款", description: "物流、運費、出貨與追蹤服務依方案及合作條件提供。", status: "development" },
    ],
  },
  {
    icon: Megaphone,
    title: "行銷、促銷與數據",
    description: "把會員、促銷、訊息與成效分析串成可追蹤的營運流程。",
    items: [
      { name: "會員標籤與分級", description: "依顧客互動與消費歷程建立會員經營工具。", status: "development" },
      { name: "滿額折扣／滿額贈／免運／加購", description: "促銷規則、條件、優先順序與可否併用。", status: "development" },
      { name: "棄單／補貨／生日提醒", description: "依設定條件建立提醒並保存發送紀錄。", status: "development" },
      { name: "LINE／Email／SMS 訊息中心", description: "範本、排程、分眾與發送紀錄；真實外部發送需權限。", status: "provider" },
      { name: "營運分析與漏斗", description: "頁面瀏覽、點擊、加入購物車、結帳、購買、退款等事件分析。", status: "development" },
      { name: "內容成效測試", description: "比較不同圖片、按鈕與內容區塊的使用成效。", status: "development" },
      { name: "GA4／Meta／Google Ads", description: "依商家個別帳號、同意設定與廣告平台條件串接。", status: "provider" },
    ],
  },
  {
    icon: Handshake,
    title: "承攬夥伴與電子契約",
    description: "從申請、審核、啟用、簽約到成交與獎勵都有正式流程。",
    items: [
      { name: "承攬夥伴申請／審核／啟用", description: "申請通過後設定密碼、登入並查看合作狀態。", status: "live" },
      { name: "電子簽署契約", description: "提供契約閱讀、手寫簽名、簽署時間、文件驗證與私人 PDF。", status: "live" },
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
      { name: "融資聯絡資料保護", description: "聯絡資料以安全方式保存，並避免重複送出。", status: "development" },
      { name: "逐家個資分享同意", description: "使用者明確選擇合作機構及分享資料範圍。", status: "development" },
      { name: "正式轉介", description: "合作契約與受理方式確認完成後才提供申請。", status: "provider" },
      { name: "不受理私人放款", description: "平台不提供個人對個人或來源不明的放款服務。", status: "development" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "帳號安全與資料保護",
    description: "以權限、資料隔離、操作紀錄與復原機制保護平台使用者。",
    items: [
      { name: "帳號與角色權限", description: "保護登入狀態、限制異常嘗試，並依角色提供適當權限。", status: "live" },
      { name: "私人文件與操作紀錄", description: "契約與文件採私人存取，重要操作保留可追查紀錄。", status: "live" },
      { name: "備份與版本復原", description: "重要更新保留版本與回復方式，降低服務中斷風險。", status: "live" },
      { name: "商家資料隔離", description: "商家登入後僅能存取自己有權查看的資料。", status: "development" },
      { name: "系統串接服務", description: "依合作需求提供授權範圍、流量限制與通知驗證。", status: "development" },
      { name: "第三方服務資格檢查", description: "未符合正式資格與使用條件的服務不會開啟。", status: "live" },
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
      <MarketingHero eyebrow="創百業智慧鏈｜功能總覽" title="從網站、AI、LINE 到商城與智慧點餐" description="依目前可提供、需個別開通、規劃中與合作服務條件清楚說明。" primary={{ label: "比較三種商家方案", to: "/pricing" }} secondary={{ label: "詢問適合功能", to: "/contact" }}>
          <aside className="features-summary-card premium-card">
            <CheckCircle size={44} weight="duotone" />
            <strong>{allItems.length} 項功能與能力</strong>
            <p>清楚標示目前提供方式，尚未開放的服務不會包裝成已可使用。</p>
          </aside>
      </MarketingHero>

      <MarketingSection className="features-status-section">
          <SectionHeading
            eyebrow="狀態怎麼看"
            title="先看功能，再看現在能不能正式用"
            description="相同功能在不同商家可能因契約、權限或第三方資格而有不同啟用狀態。"
          />
          <div className="features-status-grid">
            {statusCounts.map(({ status, count, label, hint }) => (
              <article className={`features-status-card premium-card card-stagger status-${status}`} key={status}>
                <span>{label}</span>
                <strong>{count}</strong>
                <p>{hint}</p>
              </article>
            ))}
          </div>
      </MarketingSection>

      <MarketingSection className="features-groups-section">
          <SectionHeading
            eyebrow="全部功能"
            title="依商家營運流程整理"
            description="從被看見、接待客戶、成交、收款、回購到後台管理，逐步形成完整數位營運鏈。"
          />
          <div className="features-groups-grid">
            {groups.map(({ icon: Icon, title, description, items }) => (
              <article className="features-group-card premium-card card-stagger" key={title}>
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
      </MarketingSection>

      <MarketingSection className="features-principles-section">
          <SectionHeading
            eyebrow="正式站原則"
            title="使用者看得到的功能，就必須真的能使用"
          />
          <div className="features-principles-grid">
            <article className="premium-card">
              <ShieldCheck size={34} weight="duotone" />
              <h3>沒有正式資格就不開</h3>
              <p>金流、物流、電子發票、簡訊與融資等第三方服務，須符合合作服務商的申請及使用條件。</p>
            </article>
            <article className="premium-card">
              <ShieldCheck size={34} weight="duotone" />
              <h3>變更前先確認</h3>
              <p>重要服務更新先完成測試與復原準備，再提供給使用者。</p>
            </article>
            <article className="premium-card">
              <Bell size={34} weight="duotone" />
              <h3>不使用假資料製造成績</h3>
              <p>正式網站不展示假商家、假成交、假會員或未確認的合作數字。</p>
            </article>
          </div>
      </MarketingSection>

      <CTASection eyebrow="依需求導入" title="選真正會用到的功能" description="先看既有網站、LINE、預約、會員、銷售與營運流程，再決定優先導入哪些模組。" primary={{ label: "查看方案", to: "/pricing" }} secondary={{ label: "比較 Web 與 POS", to: "/pos-comparison" }} />
    </PublicLayout>
  );
}
