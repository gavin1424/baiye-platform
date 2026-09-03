import {
  ArrowRight,
  Check,
  Receipt,
  ShieldCheck,
  Storefront,
  WarningCircle,
} from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout, SectionHeading } from "../components";
import "../pos-comparison.css";

const comparisonRows = [
  {
    item: "主要定位",
    pos: "高頻現場點餐、收銀、出單與餐廳營運管理",
    baiye: "品牌網站、LINE、AI、預約、會員、Web 訂單與數位營運入口",
  },
  {
    item: "使用裝置",
    pos: "以 iPad POS 為主，印表機、錢箱、掃碼器等依需求搭配",
    baiye: "支援的 Web 功能可由現有手機、平板或筆電開啟；專用週邊須另行整合",
  },
  {
    item: "離線收銀與現場出單",
    pos: "專業 POS 通常是核心功能",
    baiye: "目前不以完整離線 POS、錢箱或多工作站出單取代專業 POS",
  },
  {
    item: "品牌官網",
    pos: "部分方案提供線上菜單或點餐模組，實際依方案",
    baiye: "標準規格品牌網站基礎建置免費附贈，並可依導入範圍整合 LINE、AI 與預約",
  },
  {
    item: "會員與顧客經營",
    pos: "可整合消費紀錄、集點與會員分析",
    baiye: "商家隔離會員資料、網站／LINE 導流與 CRM 功能依正式開通範圍提供",
  },
  {
    item: "BOM／原料扣庫存",
    pos: "部分專業餐飲 POS 已提供 BOM 與成本管理",
    baiye: "完整 BOM 與進階庫存仍屬 Commerce 功能開發範圍，未列為目前正式標準交付",
  },
  {
    item: "電子發票、正式金流、物流",
    pos: "部分方案已整合，依服務商與合約開通",
    baiye: "已預留介面；正式 Provider 審核、憑證與 E2E 未通過前維持停用或另行評估",
  },
  {
    item: "適用產業",
    pos: "餐飲流程最佳化，部分品牌可延伸零售",
    baiye: "餐飲、零售、美容、課程、手作、服務業等多產業數位升級",
  },
];

const suitableForBaiye = [
  "想先用現有手機、平板或筆電管理 Web 功能",
  "需要品牌官網、LINE、AI 客服與線上預約",
  "需要掃碼會員、Web 菜單、詢問或輕量訂單入口",
  "希望降低初期系統訂閱負擔，功能依實際需求逐步導入",
];

const suitableForPos = [
  "尖峰時段需要快速連續結帳與多工作站出單",
  "需要斷網仍可營業、錢箱、廚房出單或出餐看板",
  "需要電子發票、外送接單、桌位與餐飲 BOM 立即完整上線",
  "需要現場硬體、安裝、教育訓練與即時技術支援",
];

export function PosComparisonPage() {
  return (
    <PublicLayout>
      <section className="pos-compare-hero">
        <div className="container pos-compare-hero-grid">
          <div>
            <span className="eyebrow">Web 數位營運與專業 POS 比較</span>
            <h1>
              不一定每家店，
              <br />
              一開始都需要專用 POS 硬體
            </h1>
            <p>
              創百業智慧鏈適合希望先建立品牌官網、LINE、AI、預約、會員與 Web
              訂單入口的商家；若需要離線收銀、多台出單、出餐看板、電子發票即時開立等高強度現場流程，專業 POS 仍有不可取代的價值。
            </p>
            <div className="pos-compare-actions">
              <Link to="/pricing" className="btn btn-primary btn-lg">
                查看 NT$18,000 方案 <ArrowRight />
              </Link>
              <Link to="/contact" className="btn btn-outline btn-lg">
                申請需求評估
              </Link>
            </div>
          </div>
          <aside className="pos-compare-hero-card">
            <Storefront size={44} weight="duotone" />
            <strong>先選對工具，再談省多少</strong>
            <p>
              本頁不是宣稱創百業已完整取代專業 POS，而是協助店家依現階段需求比較功能範圍與三年平台費用。
            </p>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="定位先說清楚"
            title="兩種系統解決的問題不同"
            description="專業餐飲 POS 著重現場營運；創百業著重品牌、顧客入口與跨產業數位升級。"
          />
          <div className="pos-position-grid">
            <article className="pos-position-card">
              <Receipt size={38} weight="duotone" />
              <h2>專業餐飲 POS</h2>
              <p>
                適合需要現場收銀、桌位、出單、離線備援、電子發票、外送接單與餐飲成本管理的店家。
              </p>
              <strong>公開價格例：iCHEF 標準方案</strong>
              <span>NT$1,950／月＋一次性開通費 NT$990</span>
            </article>
            <article className="pos-position-card pos-position-card-featured">
              <Storefront size={38} weight="duotone" />
              <h2>創百業 Web 數位營運</h2>
              <p>
                適合需要品牌網站、LINE、AI、預約、會員、線上導流與跨產業營運工具的中小商家。
              </p>
              <strong>現階段推廣方案</strong>
              <span>NT$18,000；前 2 年納入方案，第 3 年續用 NT$7,000</span>
            </article>
          </div>
          <div className="pos-compare-note">
            <WarningCircle weight="fill" />
            肚肚 dudoo 官網目前未公開固定方案價格，本頁不使用未經官方確認的數字進行金額比較。
          </div>
        </div>
      </section>

      <section className="section pos-compare-table-section">
        <div className="container">
          <SectionHeading
            eyebrow="功能比較"
            title="不是誰一定比較好，而是是否符合你的營運方式"
          />
          <div className="pos-compare-table" role="table" aria-label="創百業與專業 POS 功能比較">
            <div className="pos-compare-row pos-compare-head" role="row">
              <strong>比較項目</strong>
              <span>專業餐飲 POS</span>
              <span>創百業智慧鏈</span>
            </div>
            {comparisonRows.map((row) => (
              <div className="pos-compare-row" role="row" key={row.item}>
                <strong>{row.item}</strong>
                <span>{row.pos}</span>
                <span>{row.baiye}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="三年費用試算"
            title="以可查證的公開價格與創百業正式費用計算"
            description="以下是平台／軟體費用差額，不代表兩套產品功能完全相同。"
          />
          <div className="pos-cost-grid">
            <article className="pos-cost-card">
              <span>iCHEF 標準方案公開價格</span>
              <strong>NT$71,190</strong>
              <p>NT$1,950 × 36 個月＋開通費 NT$990</p>
              <small>不含選配硬體、加購模組、金流手續費或其他客製費用。</small>
            </article>
            <article className="pos-cost-card pos-cost-card-featured">
              <span>創百業正式費用規則</span>
              <strong>NT$25,000</strong>
              <p>前 2 年方案 NT$18,000＋第 3 年續用 NT$7,000</p>
              <small>標準規格網站基礎建置免費附贈；客製功能與第三方費用另計。</small>
            </article>
            <article className="pos-cost-card pos-cost-card-difference">
              <span>三年平台費用差額</span>
              <strong>NT$46,190</strong>
              <p>約為上述 iCHEF 標準軟體費用的 64.9%</p>
              <small>此為費用比較，不得解讀為功能、硬體或服務內容完全相同。</small>
            </article>
          </div>
          <div className="pos-source-note">
            <ShieldCheck weight="duotone" />
            <div>
              <strong>資料基準與比較原則</strong>
              <p>
                市場資料更新日：2026 年 8 月 27 日。iCHEF 價格取自官方公開方案頁；競品價格、功能與活動可能隨時變更，實際仍以各業者最新正式報價與契約為準。
              </p>
              <a
                href="https://www.ichefpos.com/zh-tw/pricing/"
                target="_blank"
                rel="noreferrer"
              >
                查看 iCHEF 官方價格來源
              </a>
            </div>
          </div>
        </div>
      </section>

      <section className="section pos-fit-section">
        <div className="container">
          <SectionHeading
            eyebrow="怎麼選"
            title="依店家的真正需求決定"
          />
          <div className="pos-fit-grid">
            <article>
              <h2>較適合先導入創百業</h2>
              <ul>
                {suitableForBaiye.map((item) => (
                  <li key={item}>
                    <Check weight="bold" /> {item}
                  </li>
                ))}
              </ul>
            </article>
            <article>
              <h2>較適合直接導入專業 POS</h2>
              <ul>
                {suitableForPos.map((item) => (
                  <li key={item}>
                    <Check weight="bold" /> {item}
                  </li>
                ))}
              </ul>
            </article>
            <article className="pos-fit-hybrid">
              <h2>也可以採混合方案</h2>
              <p>
                以創百業作為官網、LINE、AI、會員與行銷入口，再讓既有或新導入的專業 POS 處理現場收銀、出單、電子發票與廚房流程。第三方 API 串接須另行評估。
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="home-cta pos-compare-cta">
        <div className="container">
          <div>
            <span>先看營運需求，再選最合適的系統。</span>
            <h2>NT$18,000，建立商家的數位營運入口</h2>
            <p>
              標準規格網站免費附贈；LINE、AI、預約與其他功能依正式導入範圍設定。分期、金流、物流及客製系統以核准條件與個別報價為準。
            </p>
          </div>
          <div className="home-cta-actions">
            <Link to="/pricing" className="btn btn-accent btn-lg">
              查看方案 <ArrowRight />
            </Link>
            <Link to="/contact" className="btn btn-light btn-lg">
              聯絡平台
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
