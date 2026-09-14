import {
  ArrowRight,
  CalendarCheck,
  ChartLineUp,
  CheckCircle,
  FileText,
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

type FeatureItem = {
  name: string;
  description: string;
  href?: string;
};

type FeatureGroup = {
  icon: typeof Storefront;
  title: string;
  description: string;
  items: FeatureItem[];
};

const groups: FeatureGroup[] = [
  {
    icon: GlobeHemisphereWest,
    title: "品牌官網與內容管理",
    description: "把品牌介紹、商品服務、聯絡入口與搜尋曝光整合成真正能帶來客人的數位門面。",
    items: [
      { name: "專屬品牌官網", description: "依商家品牌打造 RWD 官網，手機、平板與電腦都能清楚瀏覽。" },
      { name: "自有網域", description: "建立商家自己的正式網址，累積長期品牌資產與搜尋能見度。" },
      { name: "商品與服務展示", description: "呈現商品、服務、價格、圖片、特色、營業資訊與聯絡方式。" },
      { name: "SEO 搜尋優化", description: "建置搜尋引擎友善的標題、描述、內容結構與基礎 SEO。" },
      { name: "網站內容管理", description: "可依營運需求更新文字、圖片、活動、商品與頁面內容。" },
    ],
  },
  {
    icon: Robot,
    title: "LINE 官方帳號 × AI 智能客服",
    description: "把官網、LINE 與 AI 串成同一套顧客服務入口，讓顧客更快得到答案，也更容易完成下一步。",
    items: [
      { name: "LINE 官方帳號整合", description: "將品牌 LINE OA、Rich Menu、官網、預約、會員與點餐入口整合在同一個顧客介面。" },
      { name: "網站 AI 客服", description: "顧客可直接在網站詢問商品、服務、營業資訊與常見問題。" },
      { name: "LINE AI 客服", description: "顧客在 LINE 中即可詢問商家資訊，降低重複人工回覆。" },
      { name: "商家知識庫", description: "依商家自己的服務內容、FAQ、價格與規則建立專屬 AI 回答基礎。" },
      { name: "AI 轉真人服務", description: "需要人工協助的問題可導向店家處理，保留服務彈性。" },
    ],
  },
  {
    icon: CalendarCheck,
    title: "線上預約與行程管理",
    description: "從顧客選擇服務到商家安排人員與時段，讓預約流程更簡單、更清楚。",
    items: [
      { name: "24 小時線上預約", description: "顧客可從官網或 LINE 查看服務並送出預約，不受營業時間限制。" },
      { name: "服務與人員設定", description: "設定服務項目、服務時間、人員、營業時段與休息日。" },
      { name: "可預約時段管理", description: "依既有行程與營業規則呈現可選時段，減少人工來回確認。" },
      { name: "預約查詢／改期／取消", description: "顧客可依規則管理自己的預約，商家後台同步掌握狀態。" },
      { name: "預約提醒與通知", description: "可結合 LINE 等通知渠道，降低忘記到店與人工提醒負擔。" },
      { name: "日／週／月行事曆", description: "商家用日曆方式查看預約、服務人員與處理進度。" },
    ],
  },
  {
    icon: UserCircle,
    title: "會員 CRM 與顧客經營",
    description: "不只完成一次交易，更把每一次消費與互動沉澱成可持續經營的會員資產。",
    items: [
      { name: "快速加入會員", description: "透過 QR Code、LINE 或商家入口建立會員資料，降低加入門檻。" },
      { name: "會員基本資料", description: "集中管理顧客資料、聯絡方式、消費與互動紀錄。" },
      { name: "會員標籤與分類", description: "依新客、熟客、VIP、興趣、消費習慣等條件進行分群。" },
      { name: "會員分級與會員價", description: "依商家規則建立會員等級、優惠與專屬商品價格。" },
      { name: "消費與回購紀錄", description: "掌握顧客來店、訂單、服務與回購狀況，找出值得持續經營的客群。" },
      { name: "顧客互動 Timeline", description: "把預約、訂單、會員與服務紀錄集中在同一條顧客歷程。" },
    ],
  },
  {
    icon: ShoppingCart,
    title: "免 POS 機智慧點餐",
    description: "不一定需要傳統大型 POS 主機，顧客用手機點、店家用手機或行動裝置接，依店型選擇紙本出單或無紙化管理。",
    items: [
      { name: "LINE／QR Code 手機點餐", description: "顧客掃碼或從 LINE 進入菜單，直接選餐、選規格、加購並送出訂單。" },
      { name: "桌號與外帶辨識", description: "依店家情境辨識桌號、內用、外帶或不同點餐入口。" },
      { name: "餐點規格與加料", description: "支援大小、口味、辣度、加料、套餐與各類客製選項。" },
      { name: "即時訂單接收", description: "訂單送出後直接進入商家端，減少人工抄單與重複輸入。" },
      { name: "列印機出單模式", description: "適合需要紙本點單的店家，可搭配出單設備形成熟悉的廚房流程。" },
      { name: "行動裝置無紙化模式", description: "適合不需要紙張的店家，以手機、平板或商家後台查看與處理訂單。" },
    ],
  },
  {
    icon: Package,
    title: "菜單、商品與庫存管理",
    description: "商家可集中管理菜單、商品、圖片、價格、規格與庫存，讓前台顯示與後台營運一致。",
    items: [
      { name: "菜單／商品新增與編輯", description: "新增名稱、價格、說明、分類、圖片、規格與加購項目。" },
      { name: "圖片快速更換", description: "可依新品、季節或活動快速更新商品與菜單圖片。" },
      { name: "上下架管理", description: "商品可依營業狀態、缺貨或活動需求調整前台顯示。" },
      { name: "多規格與 SKU", description: "管理不同尺寸、版本、組合與庫存單位，適用餐飲與零售商品。" },
      { name: "庫存數量紀錄", description: "記錄進貨、銷售、保留、調整與剩餘庫存，降低超賣與缺貨風險。" },
      { name: "庫存異動追蹤", description: "保留庫存異動歷程，方便店家追蹤商品流向與補貨需求。" },
    ],
  },
  {
    icon: Receipt,
    title: "訂單、出單與營運管理",
    description: "把訂單從建立、製作、完成到售後集中管理，讓前場與後場都看得到同一份資訊。",
    items: [
      { name: "訂單狀態管理", description: "掌握新訂單、處理中、完成、取消與其他營運狀態。" },
      { name: "廚房／工作區顯示", description: "可依餐飲或服務流程建立清楚的製作與處理畫面。" },
      { name: "訂單明細與備註", description: "顯示品項、數量、規格、加購、桌號與顧客備註，降低溝通錯誤。" },
      { name: "退換貨與退款管理", description: "依商家流程處理取消、退貨、部分退款與全額退款。" },
      { name: "訂單查詢", description: "依日期、顧客、狀態或訂單資訊快速查找交易紀錄。" },
    ],
  },
  {
    icon: Receipt,
    title: "付款、對帳與電子發票整合",
    description: "依商家使用情境整合付款、帳務與發票服務，讓交易流程從下單一路延伸到對帳。",
    items: [
      { name: "多元付款整合", description: "可依方案與商家資格串接適合的線上或到店付款服務。" },
      { name: "付款狀態追蹤", description: "將訂單與付款狀態整合，方便商家確認已付款、待付款與退款。" },
      { name: "電子發票整合", description: "依商家採用的服務商與資格串接電子發票開立流程。" },
      { name: "訂金與月結對帳", description: "適用需要訂金、代收、月結或多筆交易彙整的營運模式。" },
      { name: "PDF／CSV 對帳資料", description: "可將營運與帳務資料整理成報表，方便內部管理與後續核對。" },
    ],
  },
  {
    icon: Truck,
    title: "外送、物流與取貨",
    description: "把店內、外帶、外送與電商出貨整合在同一個數位營運架構中。",
    items: [
      { name: "Uber Eats／foodpanda 導流", description: "可在商家入口整合外送平台連結，讓顧客快速前往下單。" },
      { name: "自有外送／LINE 導流", description: "可串接商家自己的外送、LINE 或其他訂購入口。" },
      { name: "宅配與超商取貨", description: "適用電商商品的宅配、超取與取貨流程規劃。" },
      { name: "運費與取貨規則", description: "依配送方式、區域、金額或商品條件設定對應規則。" },
      { name: "物流服務串接", description: "可依商家需求與物流服務商資格進行系統整合。" },
    ],
  },
  {
    icon: Megaphone,
    title: "行銷、優惠與自動化",
    description: "用會員資料與消費行為做分眾溝通，讓促銷不只是打折，而是有目的地帶動回購。",
    items: [
      { name: "優惠活動", description: "可規劃滿額折扣、滿額贈、免運、加購、會員優惠與活動價格。" },
      { name: "生日與回購提醒", description: "依會員資料與消費週期安排再次接觸顧客的時機。" },
      { name: "補貨與商品提醒", description: "依商品與顧客條件推送適合的提醒與再行銷訊息。" },
      { name: "LINE／Email／SMS 行銷", description: "可依商家採用的通訊服務進行分眾通知、活動訊息與顧客關係經營。" },
      { name: "團購與分享分潤", description: "支援團購、分享來源、推廣歸因與分潤型商業模式。" },
    ],
  },
  {
    icon: ChartLineUp,
    title: "營運數據與財務報表",
    description: "把每天發生的訂單、會員、預約、庫存與收入整理成店家真正看得懂的營運資訊。",
    items: [
      { name: "營收與訂單統計", description: "查看交易金額、訂單數、客單與不同期間的營運變化。" },
      { name: "商品銷售分析", description: "掌握熱銷商品、品項表現與銷售組合，協助調整菜單與備貨。" },
      { name: "會員與回購分析", description: "觀察新客、熟客、會員回購與顧客經營成效。" },
      { name: "庫存與成本紀錄", description: "將庫存異動與營運資料整合，協助掌握備貨與成本狀況。" },
      { name: "財務帳本與報表", description: "整理收款、退款、費用、支出與淨額，提供營運管理與對帳依據。" },
      { name: "AI 財務整理", description: "可運用 AI 協助分類、摘要、找出異常並整理日常財務資訊。" },
    ],
  },
  {
    icon: Handshake,
    title: "電子契約與合作夥伴管理",
    description: "從合作申請、簽署、成交到獎勵紀錄，讓商務合作也能數位化管理。",
    items: [
      { name: "線上電子簽署", description: "支援線上閱讀契約、簽名與文件留存，降低紙本往返成本。" },
      { name: "合作夥伴帳號", description: "提供合作夥伴專屬登入與案件管理入口。" },
      { name: "成交與獎勵紀錄", description: "依合作規則紀錄成交、資格與獎勵資訊。" },
      { name: "商務轉介", description: "可依正式合作關係延伸商家服務、資源與合作機構轉介。" },
    ],
  },
  {
    icon: ShieldCheck,
    title: "商家後台、安全與系統整合",
    description: "所有前台功能背後，都由商家後台、權限管理與資料保護機制支撐，讓日常營運更集中。",
    items: [
      { name: "商家專屬後台", description: "集中管理網站、預約、會員、菜單、訂單、庫存、報表與營運設定。" },
      { name: "角色與權限", description: "可依老闆、店長、員工等角色規劃不同操作權限。" },
      { name: "商家資料隔離", description: "不同商家的會員、訂單與營運資料分開管理。" },
      { name: "操作與資料紀錄", description: "重要操作與營運資料保留紀錄，方便後續追蹤與管理。" },
      { name: "API／Webhook 整合", description: "可依實際需求串接外部系統、服務商、設備與自動化流程。" },
      { name: "備份與版本管理", description: "重要資料與系統更新採取備份與版本管理機制，降低營運風險。" },
    ],
  },
];

const allItems = groups.flatMap((group) => group.items);

const valuePoints = [
  {
    icon: GlobeHemisphereWest,
    title: "讓客戶找得到你",
    description: "品牌官網、SEO、LINE 官方帳號與數位入口，建立自己的線上門面。",
  },
  {
    icon: ShoppingCart,
    title: "讓客戶直接完成交易",
    description: "預約、點餐、購物、付款與會員流程都能從手機開始。",
  },
  {
    icon: UserCircle,
    title: "把一次消費變成長期會員",
    description: "會員 CRM、標籤、回購紀錄與行銷工具，幫助店家持續經營熟客。",
  },
];

export function FeaturesPage() {
  return (
    <PublicLayout>
      <MarketingHero
        eyebrow="創百業智慧鏈｜商家數位營運平台"
        title="一套平台，把官網、LINE、AI、預約、會員、點餐與營運管理串在一起"
        description="從客戶第一次看到你的品牌，到加入 LINE、預約、點餐、消費、成為會員，再到店家後台管理訂單、庫存與營運數據，創百業協助商家建立一套真正屬於自己的數位營運系統。"
        primary={{ label: "查看商家方案", to: "/pricing" }}
        secondary={{ label: "聯絡我們", to: "/contact" }}
      >
        <aside className="features-summary-card premium-card">
          <CheckCircle size={44} weight="duotone" />
          <strong>{groups.length} 大功能模組</strong>
          <p>{allItems.length} 項商家數位能力，依產業與營運方式彈性導入。</p>
        </aside>
      </MarketingHero>

      <MarketingSection className="features-status-section">
        <SectionHeading
          eyebrow="一套系統，串起整個生意流程"
          title="不是多裝幾個工具，而是把顧客與店家流程真正連起來"
          description="創百業從品牌曝光、顧客服務、成交、回購到後台管理，協助店家把分散的數位工具整理成同一套營運流程。"
        />
        <div className="features-status-grid">
          {valuePoints.map(({ icon: Icon, title, description }) => (
            <article className="features-status-card premium-card card-stagger status-live" key={title}>
              <Icon size={34} weight="duotone" />
              <strong>{title}</strong>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="features-groups-section">
        <SectionHeading
          eyebrow="完整功能介紹"
          title="商家日常會用到的功能，都放在同一個營運架構裡"
          description="可依餐飲、零售、美容、課程、顧問、工作室與各類服務業的實際需求，選擇適合的模組與串接方式。"
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
                      {item.href ? (
                        <a className="features-demo-link" href={item.href} target="_blank" rel="noreferrer">
                          查看示範 <ArrowRight />
                        </a>
                      ) : null}
                    </div>
                    <CheckCircle className="features-customer-check" size={22} weight="fill" aria-hidden="true" />
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </MarketingSection>

      <MarketingSection className="features-principles-section">
        <SectionHeading
          eyebrow="適合哪些商家"
          title="依你的生意模式，組合真正會用到的數位工具"
          description="不論你現在只有 LINE、只有實體店，或已經有網站與既有系統，都可以從最需要的環節開始導入。"
        />
        <div className="features-principles-grid">
          <article className="premium-card">
            <ShoppingCart size={34} weight="duotone" />
            <h3>餐飲與門市</h3>
            <p>LINE／QR 點餐、菜單管理、列印或無紙化接單、會員、庫存與營運報表。</p>
          </article>
          <article className="premium-card">
            <CalendarCheck size={34} weight="duotone" />
            <h3>美容、課程與服務業</h3>
            <p>品牌官網、LINE AI 客服、線上預約、會員 CRM、提醒通知與回購經營。</p>
          </article>
          <article className="premium-card">
            <Storefront size={34} weight="duotone" />
            <h3>零售、工作室與電商</h3>
            <p>商品展示、購物流程、會員、庫存、物流、優惠活動與多通路顧客經營。</p>
          </article>
        </div>
      </MarketingSection>

      <MarketingSection className="features-principles-section">
        <SectionHeading
          eyebrow="導入方式"
          title="從現在的營運方式開始，不必一次全部重來"
          description="我們先了解店家目前使用的 LINE、網站、預約、點餐與後台流程，再安排最適合的導入順序。"
        />
        <div className="features-principles-grid">
          <article className="premium-card">
            <FileText size={34} weight="duotone" />
            <h3>1. 了解店家需求</h3>
            <p>確認產業、現有工具、客戶流程與店內實際操作方式。</p>
          </article>
          <article className="premium-card">
            <Package size={34} weight="duotone" />
            <h3>2. 組合適合模組</h3>
            <p>從官網、LINE、AI、預約、會員、點餐、庫存與報表中選擇適合的配置。</p>
          </article>
          <article className="premium-card">
            <Handshake size={34} weight="duotone" />
            <h3>3. 上線並持續營運</h3>
            <p>依方案完成設定與串接，後續可再依店家成長持續擴充功能。</p>
          </article>
        </div>
        <p className="features-availability-note">
          實際可啟用項目、第三方服務、付款、發票、物流與設備串接，依所選方案、商家資格及合作服務商條件辦理。
        </p>
      </MarketingSection>

      <CTASection
        eyebrow="讓店家少一點系統，多一套真正能營運的流程"
        title="從你現在最需要解決的問題開始"
        description="告訴我們你的店型與目前做法，我們會依網站、LINE、預約、會員、點餐與營運需求，安排適合的導入方式。"
        primary={{ label: "查看方案", to: "/pricing" }}
        secondary={{ label: "比較免 POS 機點餐方式", to: "/pos-comparison" }}
      />
    </PublicLayout>
  );
}
