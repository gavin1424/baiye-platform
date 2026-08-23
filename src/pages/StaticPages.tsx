import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle,
  CirclesFour,
  Envelope,
  Flag,
  Globe,
  Handshake,
  Heart,
  Lightbulb,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Phone,
  Plus,
  SealCheck,
  ShieldCheck,
  Sparkle,
  Storefront,
  UsersThree,
  Warning,
} from "@phosphor-icons/react";
import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { BusinessLogo, PublicLayout, Rating, SectionHeading } from "../components";
import { businesses, faqs, pageDirectory } from "../data";
import { useAppStore } from "../store";

const plans = [
  {
    id: "free",
    name: "免費會員",
    price: 0,
    billingLabel: "",
    description: "一般消費者購物帳號，免費註冊後即可開始使用商城。",
    features: ["免費註冊", "瀏覽商城與商品", "購物車", "結帳", "購物帳號功能"],
    cta: "免費註冊",
    to: "/register?type=member",
  },
  {
    id: "merchant",
    name: "商家 AI 行銷推廣方案",
    price: 18000,
    billingLabel: "推廣優惠價（原價 NT$30,000）",
    description: "現階段推廣優惠價 NT$18,000，屬行銷推廣、平台上架及數位服務費；標準網站免費附贈。",
    features: [
      "建立商家資料與公開網站",
      "網站編輯與發布",
      "商品／服務與作品上架",
      "合作需求、提案與詢價／報價",
      "商家訂單、私訊與評價",
      "數據分析與完整商家後台",
    ],
    cta: "申請商家上架",
    to: "/register?type=merchant",
  },
];

export function PricingPage() {
  return (
    <PublicLayout>
      <section className="pricing-hero">
        <div className="container">
          <span className="eyebrow">
            <Sparkle weight="fill" />
            方案與價格
          </span>
          <h1>免費購物，商家一次完成上架註冊</h1>
          <p>免費會員只用於商城購物；建立商家頁面與使用商家後台，需完成商家 AI 行銷推廣方案，現階段推廣優惠價 NT$18,000。</p>
        </div>
      </section>
      <section className="pricing-section">
        <div className="container">
          <div className="pricing-grid">
            {plans.map((plan) => (
                <article key={plan.id} className="pricing-card">
                  <div className="pricing-card-top">
                    <span className={`plan-icon plan-${plan.id}`}>
                      {plan.id === "free" ? <Storefront /> : <Sparkle />}
                    </span>
                    <h2>{plan.name}</h2>
                    <p>{plan.description}</p>
                    <div className="pricing-amount">
                      <strong>NT${plan.price.toLocaleString("zh-TW")}</strong>
                      {plan.billingLabel && <span>{plan.billingLabel}</span>}
                    </div>
                  </div>
                  <Link to={plan.to} className={`btn ${plan.id === "merchant" ? "btn-primary" : "btn-outline"} btn-lg`}>
                    {plan.cta}
                  </Link>
                  <ul>
                    {plan.features.map((feature) => (
                      <li key={feature}>
                        <Check weight="bold" />
                        {feature}
                      </li>
                    ))}
                  </ul>
                </article>
            ))}
          </div>
          <div className="pricing-trust-row">
            {[
              [ShieldCheck, "不收交易抽成"],
              [CheckCircle, "一次性清楚開通"],
              [UsersThree, "真人客服支援"],
              [Globe, "未來支援自訂網域"],
            ].map(([Icon, label]) => {
              const TrustIcon = Icon as typeof ShieldCheck;
              return (
                <span key={String(label)}>
                  <TrustIcon weight="duotone" />
                  {String(label)}
                </span>
              );
            })}
          </div>
        </div>
      </section>
      <section className="pricing-comparison section">
        <div className="container">
          <SectionHeading title="功能比較" description="免費會員專注購物，商家上架後才開通完整商家功能。" />
          <div className="comparison-table" role="table" aria-label="方案功能比較">
            <div className="comparison-row comparison-head" role="row">
              <strong>功能</strong>
              <span>免費會員</span>
              <span>商家上架</span>
            </div>
            {[
              ["商城購物", "包含", "包含"],
              ["商家公開頁", "—", "包含"],
              ["商家網站", "—", "包含"],
              ["商品／服務上架", "—", "包含"],
              ["作品案例", "—", "包含"],
              ["合作需求", "—", "包含"],
              ["詢價／報價", "—", "包含"],
              ["商家後台", "—", "包含"],
              ["數據分析", "—", "包含"],
            ].map((row) => (
              <div className="comparison-row" role="row" key={row[0]}>
                <strong>{row[0]}</strong>
                <span>{row[1]}</span>
                <span>{row[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="pricing-faq section">
        <div className="container">
          <SectionHeading title="方案常見問題" />
          <div className="faq-grid">
            {faqs.slice(0, 4).map((item) => (
              <article key={item.q}>
                <h3>{item.q}</h3>
                <p>{item.a}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function AboutPage() {
  return (
    <PublicLayout>
      <InfoHero
        eyebrow="關於創百業智慧鏈"
        title="讓專業被理解，讓在地產業更容易合作"
        description="我們相信，從一人工作室到成熟企業，每個行業都值得有清楚可信的線上門面。"
      />
      <section className="section about-mission">
        <div className="container about-mission-grid">
          <div>
            <span className="eyebrow">我們看見的問題</span>
            <h2>好手藝不該因為不熟網站，就被藏在搜尋結果之外</h2>
            <p>
              許多地方店家、老師傅與專業接案者，擁有多年經驗與穩定口碑，卻缺少一個能完整介紹服務、展示案例與累積信任的地方。
            </p>
            <p>創百業智慧鏈把網站、商家目錄、合作需求與詢價工具放在同一個平台，降低開始成本，也讓跨業合作更自然。</p>
          </div>
          <div
            className="mission-visual"
            style={
              {
                "--mission-visual-image": `url("${import.meta.env.BASE_URL}assets/success-collaboration.jpg")`,
              } as CSSProperties
            }
          >
            {[
              [Storefront, "建立專業門面", "讓訪客快速理解你能做什麼"],
              [SealCheck, "累積可信訊號", "認證、評價與合作紀錄"],
              [Handshake, "促成實際合作", "從詢問、提案到長期夥伴"],
            ].map(([Icon, title, text]) => {
              const ItemIcon = Icon as typeof Storefront;
              return (
                <div key={String(title)}>
                  <span>
                    <ItemIcon weight="duotone" />
                  </span>
                  <div>
                    <strong>{String(title)}</strong>
                    <p>{String(text)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section about-values">
        <div className="container">
          <SectionHeading eyebrow="平台原則" title="我們如何做選擇" />
          <div className="value-grid">
            {[
              ["在地且實用", "功能從台灣中小商家真實工作流程出發，不堆疊用不到的複雜工具。"],
              ["透明與可信", "清楚揭露方案、認證與評價機制，重要合作資訊留有紀錄。"],
              ["專業不設門檻", "不因產業新舊、規模大小或數位能力，限制被看見的機會。"],
              ["合作而非競價", "鼓勵說明價值、需求與長期配合，而不是只用最低價格決定。"],
            ].map(([title, text], index) => (
              <article key={title}>
                <span>0{index + 1}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <SimpleCta />
    </PublicLayout>
  );
}

export function HowItWorksPage() {
  return (
    <PublicLayout>
      <InfoHero
        eyebrow="如何運作"
        title="從建立網站，到完成第一次合作"
        description="不論你是提供服務、尋找供應商，或需要一次性專案支援，都能用清楚的流程開始。"
      />
      <section className="section how-paths">
        <div className="container">
          <div className="path-tabs">
            <span className="active">我是商家／工作者</span>
            <span>我要找服務</span>
            <span>我是企業採購</span>
          </div>
          <div className="path-steps">
            {[
              [Storefront, "完成 AI 行銷推廣方案", "原價 NT$30,000，現階段推廣優惠價 NT$18,000；標準網站免費附贈。", "/pricing"],
              [SealCheck, "完成信任認證", "驗證手機、Email、商業登記或專業證照。", "/dashboard/profile"],
              [Globe, "發布並開始曝光", "分享網址，也在平台搜尋與分類頁被看見。", "/dashboard/site-editor"],
              [Handshake, "接收並管理合作", "集中回覆私訊、詢價、提案與合作邀請。", "/dashboard"],
            ].map(([Icon, title, text, to], index) => {
              const StepIcon = Icon as typeof Storefront;
              return (
                <article key={String(title)}>
                  <span className="path-number">{index + 1}</span>
                  <span className="path-icon">
                    <StepIcon weight="duotone" />
                  </span>
                  <h2>{String(title)}</h2>
                  <p>{String(text)}</p>
                  <Link to={String(to)}>
                    查看功能 <ArrowRight />
                  </Link>
                </article>
              );
            })}
          </div>
        </div>
      </section>
      <section className="section workflow-section">
        <div className="container">
          <SectionHeading eyebrow="完整合作流程" title="每一步都有紀錄，也有下一個動作" />
          <div className="workflow-track">
            {["搜尋／發布需求", "私訊確認", "詢價或提案", "商家報價", "模擬訂單", "完成與評價"].map((item, index) => (
              <div key={item}>
                <span>{index + 1}</span>
                <strong>{item}</strong>
              </div>
            ))}
          </div>
        </div>
      </section>
      <SimpleCta />
    </PublicLayout>
  );
}

export function SuccessStoriesPage() {
  const stories = [
    { business: businesses[2], partner: businesses[7], title: "從店面陳列案，走成長期品牌家具夥伴", metric: "半年 6 次合作" },
    { business: businesses[3], partner: businesses[11], title: "甜點工作室用企業茶會，打開婚禮合作通路", metric: "企業詢問 +58%" },
    { business: businesses[9], partner: businesses[6], title: "在地農產與食品供應商，共同穩定餐飲採購", metric: "月供應 2.4 噸" },
    { business: businesses[14], partner: businesses[5], title: "品牌網站與商業攝影一次整合，準時上線", metric: "詢價轉換 12.8%" },
  ];
  return (
    <PublicLayout>
      <InfoHero
        eyebrow="成功合作案例"
        title="一個被看見的專業，能帶來一段長期合作"
        description="看不同產業如何透過公開網站、合作需求與站內溝通，找到彼此。"
      />
      <section className="section stories-featured">
        <div className="container">
          <article className="story-featured">
            <img
              src={`${import.meta.env.BASE_URL}assets/success-collaboration.jpg`}
              alt="木作工作室與品牌設計師合作討論材料"
            />
            <div>
              <span className="eyebrow">本月精選案例</span>
              <h2>{stories[0].title}</h2>
              <p>木日木工原本只想找一次性的識別與陳列設計，卻在合作過程中找到可以共同開發產品的長期夥伴。</p>
              <div className="story-business-pair">
                <div>
                  <BusinessLogo business={stories[0].business} size="sm" />
                  <strong>{stories[0].business.name}</strong>
                </div>
                <Handshake weight="duotone" />
                <div>
                  <BusinessLogo business={stories[0].partner} size="sm" />
                  <strong>{stories[0].partner.name}</strong>
                </div>
              </div>
              <blockquote>「平台讓我們先看見彼此的作品與合作方式，第一次開會就能直接談真正的問題。」</blockquote>
              <span className="story-metric">{stories[0].metric}</span>
            </div>
          </article>
        </div>
      </section>
      <section className="section stories-grid-section">
        <div className="container">
          <SectionHeading title="更多合作故事" description="跨產業、跨地區，也能從清楚的專業頁面開始。" />
          <div className="stories-grid">
            {stories.slice(1).map((story, index) => (
              <article key={story.title}>
                <img src={story.business.cover} alt={`${story.business.name} 與 ${story.partner.name} 合作案例`} />
                <div>
                  <span>{story.metric}</span>
                  <h3>{story.title}</h3>
                  <div>
                    <BusinessLogo business={story.business} size="sm" />
                    <strong>{story.business.name}</strong>
                    <Handshake />
                    <strong>{story.partner.name}</strong>
                  </div>
                  <p>{index === 0 ? "透過活動合作需求，先從小量測試開始，後續成為固定供應夥伴。" : "從作品與評價快速建立信任，縮短來回確認時間。"}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
      <SimpleCta />
    </PublicLayout>
  );
}

export function FaqPage() {
  const [open, setOpen] = useState<number[]>([0]);
  const extended = [
    ...faqs,
    {
      q: "免費會員可以使用哪些功能？",
      a: "免費會員是純消費者購物帳號，可瀏覽商城、使用購物車並完成結帳，不包含任何商家功能。",
    },
    { q: "商家如何建立公開頁與網站？", a: "需完成商家 AI 行銷推廣方案，現階段推廣優惠價 NT$18,000；完成後即可使用商家頁、網站編輯器與發布功能。" },
    { q: "平台如何處理不實內容或糾紛？", a: "可透過檢舉頁提交資料，管理員會依內容規範審查、下架或限制帳號。合作前仍建議簽訂正式合約。" },
    { q: "商家上架後可以使用合作功能嗎？", a: "可以。商家上架會員可使用合作需求、提案、詢價、報價、私訊與商家後台等既有功能。" },
  ];
  return (
    <PublicLayout>
      <InfoHero eyebrow="常見問題" title="找到你的問題，快速開始使用" description="關於網站、合作、方案、認證與帳號安全的常見解答。" />
      <section className="section faq-page-section">
        <div className="container faq-page-layout">
          <aside>
            <strong>問題分類</strong>
            {["開始使用", "商家網站", "合作與詢價", "方案與費用", "認證與安全"].map((item, index) => (
              <button type="button" key={item} className={index === 0 ? "active" : ""}>
                {item}
              </button>
            ))}
          </aside>
          <div>
            <div className="faq-search">
              <MagnifyingGlass />
              <input placeholder="搜尋問題關鍵字" />
            </div>
            <div className="faq-list">
              {extended.map((item, index) => (
                <div key={item.q} className={`faq-item ${open.includes(index) ? "open" : ""}`}>
                  <button
                    type="button"
                    onClick={() =>
                      setOpen((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]))
                    }
                  >
                    <span>{item.q}</span>
                    <Plus />
                  </button>
                  {open.includes(index) && <p>{item.a}</p>}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ContactPage() {
  const [sent, setSent] = useState(false);
  const { notify } = useAppStore();
  return (
    <PublicLayout>
      <InfoHero eyebrow="聯絡我們" title="告訴我們，你想解決什麼問題" description="帳號、方案、合作或企業導入，我們會由合適的夥伴回覆。" />
      <section className="section contact-section">
        <div className="container contact-layout">
          <div className="contact-details">
            <span className="eyebrow">平台團隊</span>
            <h2>我們重視每一次真實使用回饋</h2>
            <p>這是 MVP 示範專案，聯絡表單會模擬送出，但不會真的寄送 Email。</p>
            <div>
              <span>
                <Envelope weight="duotone" />
                <div>
                  <small>Email</small>
                  <strong>hello@baiye.local</strong>
                </div>
              </span>
              <span>
                <Phone weight="duotone" />
                <div>
                  <small>服務時間</small>
                  <strong>週一至週五 09:30－18:00</strong>
                </div>
              </span>
              <span>
                <MapPin weight="duotone" />
                <div>
                  <small>服務地區</small>
                  <strong>全台線上服務</strong>
                </div>
              </span>
            </div>
          </div>
          <div className="contact-form-card">
            {sent ? (
              <div className="form-success">
                <span>
                  <Check weight="bold" />
                </span>
                <h2>訊息已送出</h2>
                <p>我們已建立聯絡紀錄，通常會在一個工作天內回覆。</p>
                <button type="button" className="btn btn-outline" onClick={() => setSent(false)}>
                  再送一則訊息
                </button>
              </div>
            ) : (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSent(true);
                  notify("聯絡表單已送出");
                }}
              >
                <div className="form-grid-two">
                  <label className="field">
                    <span>姓名 *</span>
                    <input required />
                  </label>
                  <label className="field">
                    <span>公司／商家</span>
                    <input />
                  </label>
                </div>
                <div className="form-grid-two">
                  <label className="field">
                    <span>Email *</span>
                    <input required type="email" />
                  </label>
                  <label className="field">
                    <span>問題類型 *</span>
                    <select required>
                      <option>帳號與登入</option>
                      <option>商家網站</option>
                      <option>方案與價格</option>
                      <option>企業合作</option>
                      <option>內容檢舉</option>
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>主旨 *</span>
                  <input required />
                </label>
                <label className="field">
                  <span>訊息 *</span>
                  <textarea required rows={7} />
                </label>
                <button type="submit" className="btn btn-primary">
                  <PaperPlaneTilt /> 送出訊息
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ReportPage() {
  const [sent, setSent] = useState(false);
  const { notify } = useAppStore();
  return (
    <PublicLayout>
      <InfoHero eyebrow="檢舉內容" title="一起維護可信任的合作環境" description="若你發現不實資訊、詐騙、侵權或不當內容，請提供完整資料協助審查。" />
      <section className="section report-section">
        <div className="container report-layout">
          <aside>
            <ShieldCheck weight="duotone" />
            <h2>檢舉會如何處理？</h2>
            <ol>
              <li>
                <span>1</span>
                平台收到資料並建立案件編號
              </li>
              <li>
                <span>2</span>
                依規範與證據進行內容審查
              </li>
              <li>
                <span>3</span>
                必要時限制內容或帳號並通知雙方
              </li>
            </ol>
            <p>
              <Warning /> 緊急人身安全或刑事事件，請直接聯絡當地執法單位。
            </p>
          </aside>
          <div className="report-form-card">
            {sent ? (
              <div className="form-success">
                <span>
                  <Check weight="bold" />
                </span>
                <h2>檢舉已提交</h2>
                <p>案件編號：RP-20260729-018。管理團隊會依優先級進行審查。</p>
                <Link to="/" className="btn btn-primary">
                  回到首頁
                </Link>
              </div>
            ) : (
              <form
                className="form-stack"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSent(true);
                  notify("檢舉案件已建立", "warning");
                }}
              >
                <label className="field">
                  <span>檢舉對象 *</span>
                  <select required>
                    <option value="">請選擇</option>
                    <option>商家／會員</option>
                    <option>商品或服務</option>
                    <option>合作需求</option>
                    <option>私訊內容</option>
                    <option>評價內容</option>
                  </select>
                </label>
                <label className="field">
                  <span>內容網址或編號 *</span>
                  <input required placeholder="貼上頁面網址、會員名稱或內容編號" />
                </label>
                <label className="field">
                  <span>檢舉原因 *</span>
                  <select required>
                    <option value="">請選擇</option>
                    <option>不實或誤導資訊</option>
                    <option>疑似詐騙</option>
                    <option>侵權內容</option>
                    <option>騷擾或不當言論</option>
                    <option>重複或垃圾內容</option>
                  </select>
                </label>
                <label className="field">
                  <span>詳細說明 *</span>
                  <textarea required rows={7} placeholder="請說明事件經過與你認為違反規範的地方" />
                </label>
                <label className="upload-zone">
                  <Flag weight="duotone" />
                  <strong>上傳證明附件</strong>
                  <span>截圖、PDF 或其他相關資料，最多 5 個檔案</span>
                  <input type="file" multiple />
                </label>
                <label className="field">
                  <span>聯絡 Email *</span>
                  <input required type="email" />
                </label>
                <button type="submit" className="btn btn-danger">
                  <Flag /> 提交檢舉
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="隱私權政策"
      updated="最後更新：2026 年 7 月 29 日"
      sections={[
        ["我們蒐集的資料", "當你註冊、建立商家頁、發布需求、詢價或聯絡客服時，我們可能蒐集帳號資料、商家資訊、聯絡紀錄、使用行為與你主動上傳的內容。MVP 僅將示範資料儲存在本機瀏覽器。"],
        ["資料使用目的", "我們使用資料來提供帳號、搜尋、網站編輯、合作媒合、訊息與安全功能，也用於改善服務品質、處理檢舉與防止濫用。"],
        ["資料分享", "除你選擇公開的商家資料，或為完成詢價與合作而主動提供的聯絡資訊外，我們不會任意出售個人資料。正式版串接第三方服務前會更新揭露。"],
        ["Cookies 與本機儲存", "本 MVP 使用 LocalStorage 保存登入狀態、收藏、詢價單、提案與網站草稿，方便重新整理後繼續操作。清除瀏覽器資料會移除這些紀錄。"],
        ["你的權利", "你可以要求查看、更正或刪除帳號資料，並調整通知與公開範圍。正式服務將提供完整資料匯出與刪除流程。"],
        ["聯絡方式", "若有隱私相關問題，請使用聯絡頁面或寄信至 privacy@baiye.local。"],
      ]}
    />
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="使用條款"
      updated="最後更新：2026 年 7 月 29 日"
      sections={[
        ["服務性質", "創百業智慧鏈提供商家網站、內容刊登、搜尋、合作媒合、詢價與溝通工具。本 MVP 不處理真實付款，也不代表平台為任何合作提供保證或僱傭關係。"],
        ["帳號責任", "你應提供真實且可驗證的資料，妥善保管登入資訊，並對帳號下發布的內容與行為負責。不得冒用他人身份或提供誤導資訊。"],
        ["內容規範", "不得發布詐騙、侵權、歧視、騷擾、違法商品、垃圾訊息或其他傷害平台安全與信任的內容。平台得依規範審查、限制、下架或保留稽核紀錄。"],
        ["合作與交易", "會員應自行確認合作對象、服務範圍、報價、交付、付款與合約。重要約定應以可保存的書面形式確認。"],
        [
          "方案與費用",
          "免費會員為 NT$0 的消費者購物帳號，不包含商家功能。商家建立公開頁、網站與使用商家後台，需完成商家 AI 行銷推廣方案；現階段推廣優惠價 NT$18,000，標準網站基礎建置免費附贈。正式版付款與退款規則將於啟用前另行公告。",
        ],
        ["責任限制", "平台會合理維護服務與內容安全，但不對會員間合作結果、間接損失或不可控制的中斷承擔超出法律規定的責任。"],
      ]}
    />
  );
}

function LegalPage({ title, updated, sections }: { title: string; updated: string; sections: string[][] }) {
  return (
    <PublicLayout>
      <section className="legal-header">
        <div className="container">
          <span className="eyebrow">平台規範</span>
          <h1>{title}</h1>
          <p>{updated}</p>
        </div>
      </section>
      <section className="legal-section">
        <div className="container legal-layout">
          <aside>
            <strong>本頁內容</strong>
            {sections.map(([heading], index) => (
              <a key={heading} href={`#legal-${index + 1}`}>
                {index + 1}. {heading}
              </a>
            ))}
          </aside>
          <article>
            <div className="legal-notice">
              <ShieldCheck weight="duotone" />
              <p>此內容為 MVP 示範用途，正式上線前需由法律與隱私專業人員依實際資料流程審閱。</p>
            </div>
            {sections.map(([heading, text], index) => (
              <section id={`legal-${index + 1}`} key={heading}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h2>{heading}</h2>
                  <p>{text}</p>
                </div>
              </section>
            ))}
          </article>
        </div>
      </section>
    </PublicLayout>
  );
}

export function NotFoundPage() {
  return (
    <PublicLayout>
      <section className="not-found-page">
        <div className="container">
          <div className="not-found-visual">
            <span>4</span>
            <CirclesFour weight="duotone" />
            <span>4</span>
          </div>
          <span className="eyebrow">這個頁面暫時不在這裡</span>
          <h1>可能已移動，或網址輸入錯誤</h1>
          <p>別擔心，你仍可以回首頁、搜尋商家，或瀏覽最新合作需求。</p>
          <div>
            <Link to="/" className="btn btn-primary btn-lg">
              回到首頁
            </Link>
            <Link to="/businesses" className="btn btn-outline btn-lg">
              找服務
            </Link>
          </div>
          <div className="not-found-links">
            <Link to="/collaborations">合作需求廣場</Link>
            <Link to="/marketplace">商品市集</Link>
            <Link to="/faq">常見問題</Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

function InfoHero({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <section className="info-hero">
      <div className="container">
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
    </section>
  );
}

function SimpleCta() {
  const { session } = useAppStore();
  const siteEditorPath =
    session.role === "business" ? "/dashboard/site-editor" : session.role === "admin" ? "/admin" : "/pricing";

  return (
    <section className="simple-cta">
      <div className="container">
        <div>
          <span>每個行業，都值得擁有自己的網站。</span>
          <h2>準備好讓專業被更多人看見了嗎？</h2>
        </div>
        <Link to={siteEditorPath} className="btn btn-accent btn-lg">
          {session.role === "business" ? "管理商家網站" : "申請商家上架"}
          <ArrowRight />
        </Link>
      </div>
    </section>
  );
}
