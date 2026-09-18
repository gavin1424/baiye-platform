import {
  ArrowRight,
  Check,
  ClipboardText,
  CookingPot,
  DeviceMobile,
  ForkKnife,
  ListChecks,
  NotePencil,
  Printer,
  QrCode,
  ShoppingCart,
  Storefront,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components";
import "../softpos-pages.css";

export const SOFTPOS_DEMO_URL = "https://baiye-beef-noodle-demo.pages.dev/";

const benefits = [
  "不需要購買傳統 POS 主機",
  "降低硬體設備成本",
  "顧客掃 QR Code 即可點餐",
  "不需下載 App",
  "商家可使用手機／平板接單",
  "支援內用、外帶、桌號",
  "支援餐點規格、加料、備註",
  "菜單可以即時修改",
  "減少人工抄單及點錯餐",
  "可搭配出餐看板",
  "可搭配列印機自動出單",
  "商品、庫存及訂單集中管理",
];

const quickSteps = [
  ["01", "建立店家菜單", "新增分類、餐點、價格、圖片與可選規格，先把現場菜單搬到線上。"],
  ["02", "產生點餐 QR Code", "依內用桌號或一般點餐情境產生 QR Code，下載後即可放在桌面或店外。"],
  ["03", "顧客掃碼點餐", "顧客使用手機相機掃描，不必下載 App，就能直接開啟菜單。"],
  ["04", "選擇餐點／規格／加料", "顧客選擇份量、口味、加料並填寫備註，再加入購物車。"],
  ["05", "店家收到訂單", "店家用手機或平板查看新訂單、桌號、外帶資訊與餐點明細。"],
  ["06", "出餐／完成訂單", "依流程更新製作與出餐狀態，完成後保留訂單紀錄方便管理。"],
] as const;

const managementGuides = [
  ["新增餐點", "在商品管理新增名稱、分類、價格、圖片與規格，確認後即可上架。"],
  ["修改價格", "開啟餐點編輯，調整售價並儲存；新價格會套用到後續訂單。"],
  ["更換圖片", "在餐點資料中重新上傳圖片，建議使用清楚、比例一致的餐點照片。"],
  ["商品停售", "臨時售完時可將商品設為停售，恢復供應後再重新上架。"],
  ["修改庫存", "依當日備料更新可售數量，避免顧客送出已售完的品項。"],
  ["查看訂單", "在訂單管理查看新訂單、餐點明細、備註、桌號與目前狀態。"],
  ["內用／外帶操作", "確認訂單的用餐方式；內用依桌號出餐，外帶依取餐資訊處理。"],
  ["列印機設定與使用", "依支援的印表機與瀏覽器列印設定完成配對，再用測試單確認格式與出紙。"],
  ["QR Code 管理", "依桌號或用途建立、下載、停用與重新啟用 QR Code。"],
] as const;

function ProductNav({ active }: { active: "intro" | "guide" | "experience" }) {
  return (
    <nav className="softpos-subnav" aria-label="免 POS 機點餐內容導覽">
      <div className="container">
        <Link className={active === "intro" ? "is-active" : ""} to="/pos-ordering">產品介紹</Link>
        <Link className={active === "guide" ? "is-active" : ""} to="/pos-ordering/guide">操作教學</Link>
        <Link className={active === "experience" ? "is-active" : ""} to="/pos-ordering/experience">體驗點餐</Link>
      </div>
    </nav>
  );
}

export function SoftPosIntroPage() {
  return (
    <PublicLayout>
      <ProductNav active="intro" />
      <main className="softpos-page">
        <section className="softpos-hero softpos-intro-hero">
          <div className="container softpos-hero-grid">
            <div className="softpos-hero-copy">
              <span className="softpos-kicker">免 POS 機智慧點餐</span>
              <h1>不用買 POS 主機，<br /><em>一支手機就能開始接單</em></h1>
              <p>顧客掃 QR Code 開啟菜單，店家直接用現有手機或平板接單。從菜單、庫存到訂單，建立更輕量的數位點餐流程。</p>
              <div className="softpos-actions">
                <Link className="btn btn-primary btn-lg" to="/pos-ordering/experience">立即體驗點餐 <ArrowRight /></Link>
                <Link className="btn btn-outline btn-lg" to="/pos-ordering/guide">查看操作教學</Link>
              </div>
            </div>
            <div className="softpos-device-story" aria-label="顧客掃碼、店家接單、廚房出餐的流程示意">
              <article><span><QrCode weight="duotone" /></span><strong>顧客掃碼</strong><small>免下載 App</small></article>
              <ArrowRight aria-hidden="true" />
              <article><span><DeviceMobile weight="duotone" /></span><strong>手機接單</strong><small>掌握訂單狀態</small></article>
              <ArrowRight aria-hidden="true" />
              <article><span><CookingPot weight="duotone" /></span><strong>出餐完成</strong><small>流程清楚不漏單</small></article>
            </div>
          </div>
        </section>

        <section className="softpos-section">
          <div className="container">
            <div className="softpos-heading"><span>產品優勢</span><h2>把傳統點餐流程，放進現有裝置</h2><p>免除一開始就採購專用主機的門檻，也保留餐飲現場需要的接單與管理彈性。</p></div>
            <div className="softpos-benefit-grid">
              {benefits.map((benefit) => <div key={benefit}><Check weight="bold" /><span>{benefit}</span></div>)}
            </div>
            <p className="softpos-audience"><ForkKnife weight="duotone" /><span><strong>適合：</strong>餐廳、早餐店、攤販、小吃店、飲料店與外帶店</span></p>
          </div>
        </section>

        <section className="softpos-section softpos-why-section">
          <div className="container softpos-why-grid">
            <div><span className="softpos-kicker">為什麼選擇免 POS 機智慧點餐</span><h2>先用手邊的設備，建立真正能運作的數位流程</h2></div>
            <div><p>不需要先購買昂貴的 POS 設備。只要利用現有手機、平板與網路，就能開始建立菜單、接收訂單，並依店內需求搭配出餐看板或列印機。</p><p>商品、庫存與訂單集中管理，菜單異動也能即時更新，減少人工抄單、溝通與點錯餐的成本。</p></div>
          </div>
        </section>

        <section className="softpos-final-cta">
          <div className="container"><div><span>下一步</span><h2>先看操作方式，或直接完成一次點餐</h2></div><div className="softpos-actions"><Link className="btn btn-outline btn-lg" to="/pos-ordering/guide">查看操作教學</Link><Link className="btn btn-primary btn-lg" to="/pos-ordering/experience">立即體驗點餐 <ArrowRight /></Link></div></div>
        </section>
      </main>
    </PublicLayout>
  );
}

export function SoftPosGuidePage() {
  return (
    <PublicLayout>
      <ProductNav active="guide" />
      <main className="softpos-page">
        <section className="softpos-hero softpos-guide-hero">
          <div className="container"><span className="softpos-kicker">店家操作教學</span><h1>從建立菜單到完成出餐，<em>六個步驟就上手</em></h1><p>按照流程完成基礎設定，顧客就能掃碼點餐，店家也能直接在手機或平板處理訂單。</p></div>
        </section>
        <section className="softpos-section">
          <div className="container">
            <div className="softpos-heading"><span>快速開始</span><h2>免 POS 機點餐 Step 流程</h2></div>
            <ol className="softpos-step-grid">
              {quickSteps.map(([number, title, text]) => <li key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></li>)}
            </ol>
          </div>
        </section>
        <section className="softpos-section softpos-management-section">
          <div className="container">
            <div className="softpos-heading"><span>日常管理教學</span><h2>常用操作，需要時展開查看</h2><p>每個項目都可獨立閱讀，手機上也能快速找到當下需要的操作。</p></div>
            <div className="softpos-accordion">
              {managementGuides.map(([title, text], index) => <details key={title} open={index === 0}><summary><span><NotePencil weight="duotone" />{title}</span><strong aria-hidden="true">＋</strong></summary><p>{text}</p></details>)}
            </div>
          </div>
        </section>
        <section className="softpos-final-cta"><div className="container"><div><span>看懂流程了嗎？</span><h2>用顧客的角度實際操作一次</h2></div><a className="btn btn-primary btn-lg" href={SOFTPOS_DEMO_URL}>立即體驗點餐 <ArrowRight /></a></div></section>
      </main>
    </PublicLayout>
  );
}

const experienceSteps = [
  [ForkKnife, "選擇餐點"],
  [ShoppingCart, "加入購物車"],
  [ClipboardText, "填寫訂購資訊"],
  [ListChecks, "送出訂單"],
] as const;

export function SoftPosExperiencePage() {
  return (
    <PublicLayout>
      <ProductNav active="experience" />
      <main className="softpos-page softpos-experience-page">
        <section className="softpos-experience">
          <div className="container">
            <span className="softpos-experience-icon"><Storefront weight="duotone" /></span>
            <span className="softpos-kicker">線上 Demo</span>
            <h1>親自體驗一次免 POS 機點餐</h1>
            <p>不用下載 App，現在就用顧客的角度完成一次掃碼點餐。</p>
            <ol>{experienceSteps.map(([Icon, label], index) => <li key={label}><span><Icon weight="duotone" /></span><strong>{label}</strong>{index < experienceSteps.length - 1 && <ArrowRight aria-hidden="true" />}</li>)}</ol>
            <a className="btn btn-primary btn-lg softpos-experience-cta" href={SOFTPOS_DEMO_URL}>立即體驗點餐 <ArrowRight /></a>
            <small>將前往目前正式運作的「百工牛肉麵」點餐示範流程；示範資料不會產生真實交易。</small>
          </div>
        </section>
      </main>
    </PublicLayout>
  );
}
