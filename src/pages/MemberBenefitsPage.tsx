import {
  ArrowDown,
  ArrowRight,
  BellRinging,
  Cake,
  CalendarBlank,
  CalendarCheck,
  ChartBar,
  ChatCircleDots,
  CheckCircle,
  ClockCounterClockwise,
  Crown,
  Database,
  ForkKnife,
  Gift,
  Globe,
  GraduationCap,
  Heart,
  LineSegments,
  MagnifyingGlass,
  NotePencil,
  Phone,
  QrCode,
  Receipt,
  Robot,
  ShoppingBag,
  Sparkle,
  Storefront,
  Tag,
  TrendUp,
  UserCircle,
  UserPlus,
  Users,
} from "@phosphor-icons/react";
import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components";
import "../member-benefits.css";

type Icon = ComponentType<{ size?: number | string; weight?: "regular" | "bold" | "duotone" | "fill" }>;

const memberFields: Array<[Icon, string, string]> = [
  [UserCircle, "會員基本資料", "基本識別與會員狀態"],
  [Phone, "聯絡方式", "依權限顯示並保護個資"],
  [CalendarBlank, "加入日期", "掌握會員關係起點"],
  [Receipt, "消費次數", "由點餐訂單逐步累積"],
  [ChartBar, "消費金額", "可依交易紀錄規劃彙整"],
  [ClockCounterClockwise, "最近消費時間", "可作為回訪判斷依據"],
  [ShoppingBag, "購買商品或服務", "由訂單與預約紀錄整理"],
  [NotePencil, "顧客備註", "規劃中的商家管理欄位"],
  [Heart, "顧客喜好", "可依互動與消費逐步理解"],
  [TrendUp, "回購紀錄", "從歷次互動觀察回訪"],
];

const scenarios: Array<[Icon, string, string]> = [
  [Sparkle, "美容店", "知道顧客上次做過什麼療程，作為下次服務建議的參考。"],
  [ForkKnife, "餐廳", "查看會員過往訂購紀錄，理解常點品項與消費習慣。"],
  [GraduationCap, "課程業者", "知道會員參加過哪些課程，協助規劃後續學習。"],
  [ShoppingBag, "零售商家", "掌握會員經常購買的商品類型，讓推薦更貼近需求。"],
];

const tiers = [
  [UserCircle, "一般會員", "剛加入或首次消費的顧客。", "已支援會員關係建立"],
  [Users, "熟客會員", "已有多次消費紀錄。", "可依紀錄規劃分級"],
  [Crown, "VIP 會員", "高消費、高頻率的核心顧客。", "規劃功能"],
  [ClockCounterClockwise, "待喚回會員", "曾經消費，但已有一段時間沒有再次回來。", "規劃功能"],
] as const;

const offerItems = ["會員專屬價格", "會員折扣", "滿額優惠", "回購折價", "指定商品優惠", "指定服務優惠", "限時活動", "新會員優惠", "老會員專屬活動"];
const couponItems = ["新會員券", "回購券", "滿額券", "生日券", "節慶券", "限時券", "指定商品券"];
const festivals = ["新年", "母親節", "父親節", "情人節", "中秋節", "聖誕節", "店慶"];
const lineItems = ["查看商家最新消息", "接收優惠活動", "取得回購資訊", "進入網站", "進入線上預約", "進入線上點餐", "聯絡商家", "使用會員相關服務"];

function StatusBadge({ children, ready = false }: { children: string; ready?: boolean }) {
  return <span className={`mb-status ${ready ? "is-ready" : ""}`}>{ready ? <CheckCircle weight="fill" /> : <Sparkle weight="fill" />}{children}</span>;
}

function SectionTitle({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) {
  return <header className="mb-section-title"><span>{eyebrow}</span><h2>{title}</h2>{description && <p>{description}</p>}</header>;
}

function IconCard({ icon: IconComponent, title, text, status }: { icon: Icon; title: string; text: string; status?: string }) {
  return <article className="mb-icon-card"><div className="mb-icon"><IconComponent weight="duotone" /></div><h3>{title}</h3><p>{text}</p>{status && <small>{status}</small>}</article>;
}

export function MemberBenefitsPage() {
  return <PublicLayout>
    <div className="member-benefits-page">
      <section className="mb-hero">
        <div className="container mb-hero-grid">
          <div className="mb-hero-copy">
            <span className="mb-eyebrow">MEMBERS POWER BUSINESS</span>
            <h1>會員不是名單，<br />而是商家最重要的<span>回購資產</span></h1>
            <p className="mb-hero-lead">從會員資料、消費紀錄、優惠券、LINE 互動到顧客喚回，建立屬於商家自己的熟客經營系統。</p>
            <p className="mb-hero-note">第一次消費只是開始。創百業會員回購系統協助商家建立顧客資料、消費紀錄與會員經營基礎，讓每一次消費都能成為下一次回購的機會。</p>
            <div className="mb-industry-tags" aria-label="適用產業">{["餐飲", "美容", "美甲", "零售", "工作室", "課程", "服務業"].map((item) => <span key={item}>{item}</span>)}</div>
            <div className="mb-hero-actions"><button type="button" className="btn mb-btn-gold btn-lg" onClick={() => document.getElementById("member-assets")?.scrollIntoView({ behavior: "smooth", block: "start" })}>了解會員回購功能 <ArrowDown /></button><Link className="btn mb-btn-line btn-lg" to="/pricing">申請商家服務 <ArrowRight /></Link></div>
          </div>
          <div className="mb-hero-dashboard" aria-label="會員經營功能介面示意">
            <div className="mb-dashboard-head"><div><span className="mb-logo-mark">∞</span><strong>創百業會員經營</strong></div><StatusBadge ready>功能示意</StatusBadge></div>
            <article className="mb-profile-card"><div className="mb-avatar"><UserCircle weight="duotone" /></div><div><small>會員關係</small><strong>熟客經營檔案</strong><span>消費與互動紀錄整合</span></div><Crown weight="duotone" /></article>
            <div className="mb-dashboard-metrics"><article><Users weight="duotone" /><span>會員總數</span><strong>—</strong></article><article><UserPlus weight="duotone" /><span>本月新增</span><strong>—</strong></article><article><TrendUp weight="duotone" /><span>回購會員</span><strong>—</strong></article><article><BellRinging weight="duotone" /><span>待喚回</span><strong>—</strong></article></div>
            <div className="mb-dashboard-foot"><span><Receipt />消費紀錄</span><span><CalendarCheck />預約紀錄</span><span><LineSegments />LINE 串接</span></div>
          </div>
        </div>
      </section>

      <section className="mb-section" id="member-assets"><div className="container"><SectionTitle eyebrow="CUSTOMER ASSETS" title="從新客變熟客，建立自己的顧客資產" description="很多商家每天都有客人上門，但客人離開後，就很難再次聯絡。透過會員系統，可以逐步建立自己的顧客資料庫，不再只能依靠平台或廣告重新找客人。" /><div className="mb-field-grid">{memberFields.map(([IconComponent, title, text], index) => <IconCard key={title} icon={IconComponent} title={title} text={text} status={index === 7 ? "規劃欄位" : undefined} />)}</div><div className="mb-callout"><strong>商家可以更清楚知道</strong><div>{["誰是第一次消費？", "誰是常客？", "誰很久沒有回來？", "誰是高消費顧客？"].map((item) => <span key={item}><MagnifyingGlass />{item}</span>)}</div></div></div></section>

      <section className="mb-section mb-soft"><div className="container"><SectionTitle eyebrow="PURCHASE HISTORY" title="每一次消費，都可以成為下一次行銷的依據" description="透過消費與預約紀錄，商家可以了解會員過去購買過什麼商品、使用過什麼服務，以及多久沒有再次消費。" /><div className="mb-scenario-grid">{scenarios.map(([IconComponent, title, text]) => <IconCard key={title} icon={IconComponent} title={title} text={text} />)}</div><p className="mb-section-closing">讓商家的推薦不再只是大量發送，而是更貼近顧客需求。</p></div></section>

      <section className="mb-section"><div className="container"><SectionTitle eyebrow="MEMBERSHIP TIERS" title="不同的顧客，用不同的方式經營" description="可依消費次數、累積消費金額、加入時間、最近消費日期與活躍程度，規劃適合的會員分級。" /><div className="mb-tier-grid">{tiers.map(([IconComponent, title, text, status], index) => <article className={`mb-tier-card mb-tier-${index + 1}`} key={title}><div className="mb-icon"><IconComponent weight="duotone" /></div><h3>{title}</h3><p>{text}</p><StatusBadge ready={index === 0}>{status}</StatusBadge></article>)}</div></div></section>

      <section className="mb-section mb-dark"><div className="container mb-split"><div><SectionTitle eyebrow="MEMBER OFFERS" title="讓會員感受到「加入會員真的有差」" description="會員優惠可依商家活動與方案逐步搭配，讓熟客感受到專屬價值。" /><StatusBadge>優惠管理規劃中</StatusBadge></div><div className="mb-chip-cloud">{offerItems.map((item) => <span key={item}><Tag weight="duotone" />{item}</span>)}</div></div><p className="mb-section-closing">透過會員優惠，提高下一次消費的誘因。</p></section>

      <section className="mb-section"><div className="container"><SectionTitle eyebrow="MEMBER COUPONS" title="消費完成，不只是說「謝謝光臨」" description="未來可搭配下一次使用的回購優惠，讓顧客有明確的「再回來理由」。優惠券目前尚未在正式環境開放。" /><div className="mb-coupon-layout"><div className="mb-coupon-examples"><article><Gift weight="duotone" /><small>回購優惠示意</small><strong>本次消費完成，<br />下次消費折抵優惠</strong><span>規劃功能</span></article><article><CalendarCheck weight="duotone" /><small>預約回訪示意</small><strong>30 天內再次預約，<br />可享會員專屬優惠</strong><span>規劃功能</span></article></div><div><StatusBadge>Production 尚未開放</StatusBadge><div className="mb-chip-cloud mb-chip-light">{couponItems.map((item) => <span key={item}>{item}</span>)}</div></div></div></div></section>

      <section className="mb-section mb-soft"><div className="container"><SectionTitle eyebrow="MOMENT MARKETING" title="在對的時間，再次與顧客建立連結" description="生日與節慶活動可作為會員經營規劃；目前前台不會假設系統已自動發送。" /><div className="mb-moment-grid"><article><div className="mb-icon"><Cake weight="duotone" /></div><h3>生日經營</h3><ul>{["生日優惠", "生日禮", "生日折扣券", "生日專屬服務"].map((item) => <li key={item}><CheckCircle />{item}</li>)}</ul><StatusBadge>規劃功能</StatusBadge></article><article><div className="mb-icon"><CalendarBlank weight="duotone" /></div><h3>節慶活動</h3><div className="mb-chip-cloud mb-chip-light">{festivals.map((item) => <span key={item}>{item}</span>)}</div><StatusBadge>可搭配活動規劃</StatusBadge></article></div></div></section>

      <section className="mb-section"><div className="container mb-line-section"><div><SectionTitle eyebrow="LINE INTEGRATION" title="不用再要求顧客下載另一個 App" description="會員經營可與 LINE 官方帳號及商家網站服務搭配，讓顧客從熟悉的入口繼續互動。" /><StatusBadge ready>支援 LINE 官方帳號設定</StatusBadge></div><div className="mb-line-card"><div className="mb-line-bubble"><ChatCircleDots weight="fill" /><span>把網站、LINE、會員與商家服務串在一起</span></div><div className="mb-line-grid">{lineItems.map((item) => <span key={item}><CheckCircle weight="fill" />{item}</span>)}</div><small>訊息推播與活動發送能力依商家 LINE 設定、權限與實際開通項目為準。</small></div></div></section>

      <section className="mb-section mb-soft"><div className="container"><SectionTitle eyebrow="CUSTOMER WIN-BACK" title="找回那些曾經消費，卻很久沒有回來的顧客" description="可依最近互動與消費時間規劃喚回名單；自動分群與自動訊息發送尚未正式開放。" /><div className="mb-recall-grid">{["30 天未消費", "60 天未消費", "90 天未消費", "長期未回購會員"].map((item, index) => <article key={item}><ClockCounterClockwise weight="duotone" /><strong>{item}</strong><span>{index < 3 ? "依最近紀錄規劃判斷" : "另行安排喚回策略"}</span></article>)}</div><div className="mb-message-examples"><ChatCircleDots weight="duotone" /><div><strong>「好久不見，歡迎回來」</strong><span>「本月回店享會員專屬優惠」</span></div><StatusBadge>訊息情境示意</StatusBadge></div><p className="mb-section-closing">讓沉睡的顧客重新回到店裡。</p></div></section>

      <section className="mb-section"><div className="container"><SectionTitle eyebrow="SMART SEGMENTS" title="不是所有會員都收到一模一樣的內容" description="未來進行活動時，可依實際可用資料針對適合的客群進行經營。" /><div className="mb-segment-grid">{[[UserPlus,"新會員","第一次加入的顧客。"],[Crown,"高消費會員","累積消費金額較高。"],[TrendUp,"高頻會員","經常消費的熟客。"],[ShoppingBag,"特定商品會員","曾購買某類商品。"],[Sparkle,"特定服務會員","曾使用某項服務。"],[ClockCounterClockwise,"沉睡會員","長時間沒有再次消費。"]].map(([IconComponent,title,text]) => <IconCard key={String(title)} icon={IconComponent as Icon} title={String(title)} text={String(text)} status="分類規劃" />)}</div></div></section>

      <section className="mb-section mb-dark"><div className="container mb-booking-layout"><div><SectionTitle eyebrow="BOOKING & RETENTION" title="服務完成後，直接引導下一次預約" description="熟客不需要每次重新私訊詢問時間。創百業已支援網站預約流程，服務完成後也可再引導顧客安排下一次服務。" /><div className="mb-industry-tags mb-industry-tags-light">{["美容", "美甲", "按摩", "課程", "工作室", "服務業"].map((item) => <span key={item}>{item}</span>)}</div><StatusBadge ready>網站預約已支援</StatusBadge></div><div className="mb-horizontal-flow">{[[Globe,"查看服務"],[CalendarBlank,"選擇日期"],[ClockCounterClockwise,"選擇時間"],[CalendarCheck,"完成預約"]].map(([IconComponent,label], index) => <div key={String(label)}><article><IconComponent weight="duotone" /><strong>{label as string}</strong></article>{index < 3 && <ArrowRight aria-hidden="true" />}</div>)}</div></div></section>

      <section className="mb-section"><div className="container"><SectionTitle eyebrow="ORDERING & MEMBERS" title="讓一次掃碼點餐，也能成為會員經營的開始" description="搭配創百業「免 POS 機智慧點餐」，商家可以逐步累積會員的訂購與消費紀錄。" /><div className="mb-order-flow">{[[QrCode,"掃碼"],[ForkKnife,"點餐"],[Receipt,"完成訂單"],[Database,"累積會員消費紀錄"]].map(([IconComponent,label], index) => <div key={String(label)}><span>{String(index + 1).padStart(2,"0")}</span><IconComponent weight="duotone" /><strong>{label as string}</strong>{index < 3 && <ArrowRight />}</div>)}</div><StatusBadge ready>掃碼會員與點餐已支援</StatusBadge></div></section>

      <section className="mb-section mb-soft"><div className="container mb-data-layout"><div><SectionTitle eyebrow="DATA INSIGHTS" title="會員經營，不再只靠感覺" description="正式系統已能記錄會員關係、互動與訂單；更完整的回購分類與金額分析將依商家資料與功能開通狀態逐步提供。" /><ul className="mb-check-list">{["會員總數", "新增會員數", "活躍會員", "回購會員", "長期未消費會員", "消費次數", "累積消費金額", "最近消費時間"].map((item) => <li key={item}><CheckCircle weight="fill" />{item}</li>)}</ul></div><div className="mb-data-dashboard"><header><strong>會員經營摘要</strong><StatusBadge ready>功能示意</StatusBadge></header><div className="mb-dashboard-metrics"><article><Users /><span>會員總數</span><strong>—</strong></article><article><UserPlus /><span>本月新增</span><strong>—</strong></article><article><TrendUp /><span>回購會員</span><strong>—</strong></article><article><BellRinging /><span>待喚回</span><strong>—</strong></article></div><div className="mb-data-bars" aria-label="不含真實營運數字的圖表示意"><span style={{height:"42%"}} /><span style={{height:"64%"}} /><span style={{height:"54%"}} /><span style={{height:"78%"}} /><span style={{height:"72%"}} /><span style={{height:"88%"}} /></div><small>畫面僅為功能示意，不代表任何商家的真實營運數字。</small></div></div></section>

      <section className="mb-section"><div className="container"><SectionTitle eyebrow="AI INSIGHTS" title="讓 AI 幫助商家看懂會員資料" description="AI 會員分析屬規劃方向，未宣稱已自動執行。未來可搭配可用、合規的會員資料，協助商家理解經營機會。" /><div className="mb-ai-grid">{["哪些會員最近沒有回購？","哪些會員屬於高價值顧客？","哪些會員適合發送優惠？","哪些會員可能需要再次預約？","哪些商品適合推薦給既有會員？"].map((question, index) => <article key={question}><span>{String(index + 1).padStart(2,"0")}</span><Robot weight="duotone" /><h3>{question}</h3><small>AI 可協助分析規劃</small></article>)}</div><p className="mb-section-closing">讓會員資料不只是放在資料庫裡，而是真正可以拿來協助商家經營。</p></div></section>

      <section className="mb-section mb-journey-section"><div className="container"><SectionTitle eyebrow="RETENTION JOURNEY" title="一套系統，串起整個回購流程" description="從被看見、建立關係，到再次消費，讓每個環節都有清楚的下一步。" /><div className="mb-journey">{[[Globe,"官網","讓更多人認識你"],[LineSegments,"加入 LINE／加入會員","建立長期聯繫"],[ShoppingBag,"預約／點餐／購買","開始第一次消費"],[Receipt,"留下消費紀錄","累積顧客行為"],[Users,"會員分類","依資料規劃經營"],[Tag,"優惠／活動／回購提醒","規劃合適的互動"],[CalendarCheck,"再次預約或再次消費","讓顧客再次回來"],[Crown,"成為熟客","建立長期關係"]].map(([IconComponent,title,text], index) => <div className="mb-journey-step" key={String(title)}><span>{String(index + 1).padStart(2,"0")}</span><div className="mb-icon"><IconComponent weight="duotone" /></div><div><strong>{title as string}</strong><small>{text as string}</small></div>{index < 7 && <ArrowDown className="mb-journey-arrow" />}</div>)}</div></div></section>

      <section className="mb-final-cta"><div className="container"><div><span className="mb-eyebrow">MORE THAN A SALE</span><h2>把一次生意，<br />變成<span>長期顧客關係</span></h2><p>開發一位新客戶需要成本。但曾經消費過、認識你的顧客，往往更有機會再次回來。</p><p>創百業會員回購系統的核心，不只是「建立會員」，而是幫助商家留下顧客、了解顧客、持續互動，創造再次消費的機會。</p><div className="mb-final-values"><span><Users />留下顧客</span><span><MagnifyingGlass />了解顧客</span><span><ChatCircleDots />持續互動</span><span><TrendUp />創造回購</span></div></div><div className="mb-final-actions"><Link className="btn mb-btn-gold btn-lg" to="/pricing">申請商家服務 <ArrowRight /></Link><Link className="btn mb-btn-line btn-lg" to="/features">返回功能介紹</Link><small>讓每一位曾經來過的顧客，都有機會成為長期熟客。</small></div></div></section>
    </div>
  </PublicLayout>;
}
