import { ArrowRight, ArrowUpRight, BookOpenText, CalendarBlank, CalendarCheck, ChartLineUp, CheckCircle, DeviceMobile, ForkKnife, GlobeHemisphereWest, Handshake, LineSegments, QrCode, Receipt, Robot, ShieldCheck, ShoppingCart, Storefront, User, X } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import heroScene from "../assets/baiye-multi-industry-isometric-hero.png";
import aiServiceTrainImage from "../assets/news/ai-service-train.png";
import cteeImage from "../assets/news/ctee.jpg";
import cultureImage from "../assets/news/culture.jpg";
import economicDailyImage from "../assets/news/economic-daily.jpg";
import taisoundsImage from "../assets/news/taisounds.jpg";
import yahooImage from "../assets/news/yahoo.webp";
import { Header, MobileBottomNav } from "../components";
import { BEEF_NOODLE_GUEST_ORDERING_URL } from "../config/orderingDemo";
import "../home-media.css";
import "../home-ordering-experience.css";

type Feature = { name: string; summary: string; audience: string; value: string; items: string[]; cta: string; to: string; icon: ComponentType<{ weight?: "duotone" | "fill" }> };

const features: Feature[] = [
  { name: "官網建置", icon: GlobeHemisphereWest, summary: "快速建立兼具品牌形象與商業轉換的數位門面。", audience: "餐飲、零售、美業、工作室與專業服務商家", value: "讓顧客從搜尋、理解服務到採取行動，都在一致的品牌體驗中完成。", items: ["RWD 響應式品牌網站", "商品與服務介紹", "聯絡表單與 SEO 基礎結構", "串接預約、點餐、會員與 LINE"], cta: "了解建置方案", to: "/pricing" },
  { name: "AI智能客服", icon: Robot, summary: "部署在網站與 LINE 的商家專屬 AI 客服助手。", audience: "常有重複詢問、需要延長服務時間的商家", value: "用一致內容回答常見問題，減少人工負擔並把顧客導向下一步。", items: ["常見問題自動回覆", "商品與服務介紹", "預約與流程說明", "固定問答與 LINE 導流"], cta: "了解 AI 服務", to: "/features" },
  { name: "LINE官方帳號", icon: LineSegments, summary: "協助商家建立、整合並經營自己的 LINE 官方帳號。", audience: "希望累積可持續互動顧客關係的實體商家", value: "把網站訪客與到店顧客導入商家可持續經營的溝通管道。", items: ["LINE OA 串接", "Rich Menu 與歡迎訊息", "加好友導流", "會員綁定與後續通知擴充"], cta: "洽詢 LINE 整合", to: "/contact" },
  { name: "會員回購", icon: User, summary: "用一致會員識別整理顧客關係、消費與回購歷程。", audience: "重視熟客、回訪率與長期留存的商家", value: "不靠短期促銷，從資料與互動建立長期會員經營能力。", items: ["會員資料管理", "消費與回購追蹤", "顧客標籤", "會員分級規劃與 LINE 再行銷導流"], cta: "了解會員經營", to: "/member-benefits" },
  { name: "預約管理", icon: CalendarCheck, summary: "讓顧客線上選時段，商家在同一後台管理預約。", audience: "美業、服務業、顧問、教室與個人工作室", value: "降低來回確認成本，讓時段、狀態與異動更清楚。", items: ["線上預約", "時段與狀態管理", "改期與取消", "行事曆式後台檢視"], cta: "了解預約功能", to: "/features" },
  { name: "免POS機點餐", icon: QrCode, summary: "免專用 POS 主機，顧客掃碼、商家用手機或平板接單。", audience: "餐廳、早餐店、攤販、小吃與外帶商家", value: "降低專用硬體門檻，串起菜單、訂單、出餐看板、庫存與財務。", items: ["QR 掃碼點餐", "手機／平板接單", "桌號、外帶、規格與加料", "出餐看板與訂單流程整合"], cta: "了解免 POS 機點餐", to: "/pos-ordering" },
  { name: "網站預約", icon: CalendarBlank, summary: "建立專屬線上預約頁面，顧客可直接透過網站選擇服務、日期與時間，快速完成預約。", audience: "美業、工作室、課程、顧問與各類預約型商家", value: "顧客直接透過網站完成線上預約，商家用手機即可查看紀錄與管理狀態。", items: ["線上選擇預約日期", "選擇預約時段", "選擇服務項目", "填寫顧客資料", "預約備註", "商家查看預約紀錄", "預約狀態管理", "手機即可操作", "不需另外下載 App"], cta: "了解網站預約", to: "/features?module=booking" },
  { name: "承攬 / 商家簽約", icon: Handshake, summary: "平台合作、商家加入與契約留存的一體化手機流程。", audience: "承攬夥伴、商家負責人與受授權代表", value: "從身分確認、閱讀到電子簽署與文件下載，都能安全留存。", items: ["承攬夥伴合作契約", "商家平台服務契約", "線上簽署與證據留存", "私人 PDF 契約下載"], cta: "查看合作入口", to: "/partner" },
];

const values = [[QrCode, "多業態整合", "一站式管理"], [ChartLineUp, "智慧經營", "數據驅動決策"], [ShieldCheck, "安全穩定", "企業級防護"], [Handshake, "專業服務", "陪伴成長"]] as const;

type NewsItem = { source: string; title: string; summary: string; href: string; image: string };

const newsItems: NewsItem[] = [
  {
    source: "太報 TaiSounds",
    title: "加速建構百工百業AI化生態鏈　工研院院士提5招",
    summary: "工研院提出臺灣產業生成式 AI 發展倡議，從技術、治理、資料環境、人才與國際合作等面向，加速產業應用。",
    href: "https://share.google/sbx5xEldEEMhspHsL",
    image: taisoundsImage,
  },
  {
    source: "Yahoo新聞",
    title: "加速建構百工百業AI化生態鏈　工研院院士提AI發展倡議五大策略",
    summary: "工研院院士會議聚焦生成式 AI 產業落地，提出五大策略，推進 AI 產業在地化與百工百業應用。",
    href: "https://share.google/sxpKdrbUBGUurFXgF",
    image: yahooImage,
  },
  {
    source: "百工百業AI服務列車",
    title: "百工百業AI館－找AI解決方案",
    summary: "中華軟體公會整合多領域技術與場域資源，推動 AI 導入、跨域交流與產業數位轉型。",
    href: "https://share.google/hJqcRz9WL6aLe50lj",
    image: aiServiceTrainImage,
  },
  {
    source: "工商時報",
    title: "2026智慧創新大賞　加速AI落地百工百業",
    summary: "經濟部啟動 2026 智慧創新大賞，以 AI 應用與 IC 設計競賽促進創新成果落地產業。",
    href: "https://share.google/urLFDsMZ8zbw1H1s4",
    image: cteeImage,
  },
  {
    source: "經濟日報",
    title: "國發會推百工百業AI落地　TIE秀智慧應用",
    summary: "國發會於臺灣創新技術博覽會呈現百工百業智慧應用等政策成果，推動 AI 走進產業與生活場域。",
    href: "https://share.google/xm7bzdac9XYYlm9J1",
    image: economicDailyImage,
  },
  {
    source: "中華新台文化協會",
    title: "「布」可思「藝」的巧手～陳美玲",
    summary: "介紹百變布玩工作室負責人陳美玲，以及她投入布藝與專業手作發展的歷程。",
    href: "https://share.google/o2lrvea5iSsBrRmOD",
    image: cultureImage,
  },
];

export function HomePage() {
  const [selected, setSelected] = useState<Feature | null>(null);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.body.classList.add("home-detail-open"); window.addEventListener("keydown", close);
    return () => { document.body.classList.remove("home-detail-open"); window.removeEventListener("keydown", close); };
  }, [selected]);
  useEffect(() => {
    const section = document.querySelector<HTMLElement>(".home-media-section");
    if (!section) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
      section.classList.add("is-visible");
      return;
    }
    section.classList.add("is-entering");
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      section.classList.add("is-visible");
      observer.disconnect();
    }, { threshold: 0.08 });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  return <div className="app-shell"><a className="skip-link" href="#home-content">跳到主要內容</a><Header />
    <main className="immersive-home" id="home-content">
    <section className="immersive-home-hero">
      <div className="immersive-home-heading"><span className="eyebrow hero-enter hero-enter-1">百工數位營運平台</span><h1 className="hero-enter hero-enter-2">全業態數位升級，<em>一站完成</em></h1><p className="hero-enter hero-enter-3">餐飲 × 美業 × 零售，多產業整合的智慧經營平台</p></div>

      <div className="immersive-showcase hero-enter hero-enter-4" aria-label="餐飲、美業與零售智慧經營場景">
        <img src={heroScene} alt="餐飲、美業與零售整合的智慧經營場景" />
        <div className="immersive-feature-overlay" aria-label="百工八大功能">
          {features.map((feature, index) => <FeatureButton key={feature.name} feature={feature} index={index + 1} onClick={() => setSelected(feature)} />)}
        </div>
      </div>

      <section className="immersive-values baiye-reveal is-visible" aria-label="品牌價值">{values.map(([Icon, title, text]) => <article className="premium-card" key={title}><Icon weight="duotone" /><strong>{title}</strong><span>{text}</span></article>)}</section>
    </section>

    <section className="home-media-section" aria-labelledby="home-media-title">
      <div className="home-media-inner">
        <header className="home-media-heading">
          <p>Media &amp; News</p>
          <h2 id="home-media-title">媒體報導</h2>
          <span>從專業技藝、文化傳承到 AI 創新應用，持續受到各界媒體與平台關注。</span>
        </header>
        <div className="home-media-grid">
          {newsItems.map((item) => <NewsCard item={item} key={`${item.source}-${item.title}`} />)}
        </div>
      </div>
    </section>

    <section className="home-ordering-experience" aria-labelledby="home-ordering-title">
      <div className="home-ordering-inner">
        <a className="home-ordering-poster" href={BEEF_NOODLE_GUEST_ORDERING_URL} aria-label="立即前往百工牛肉麵免 POS 機智慧點餐體驗頁">
          <div className="home-ordering-copy">
            <span className="home-ordering-kicker"><QrCode weight="duotone" /> 免 POS 機智慧點餐</span>
            <h2 id="home-ordering-title">體驗點餐</h2>
            <p className="home-ordering-lead">掃碼即可點餐，快速體驗免 POS 機智慧點餐流程</p>
            <p className="home-ordering-detail">提供門市掃碼點餐、線上訂單管理，協助提升營運效率、降低人力負擔。</p>
            <div className="home-ordering-benefits" aria-label="智慧點餐重點功能">
              <span><QrCode weight="duotone" />掃碼點餐</span>
              <span><Receipt weight="duotone" />線上訂單</span>
              <span><ChartLineUp weight="duotone" />提升效率</span>
              <span><DeviceMobile weight="duotone" />手機接單</span>
            </div>
            <span className="home-ordering-cta">立即體驗點餐 <ArrowRight weight="bold" /></span>
          </div>

          <div className="home-ordering-visual" aria-label="百工牛肉麵手機點餐畫面與體驗 QR Code">
            <div className="home-ordering-qr-card">
              <QRCodeSVG value={BEEF_NOODLE_GUEST_ORDERING_URL} size={126} level="M" bgColor="#ffffff" fgColor="#08263d" title="掃碼立即體驗點餐" />
              <strong>掃碼立即體驗</strong>
              <small>免下載 App</small>
            </div>
            <div className="home-ordering-phone">
              <div className="home-ordering-phone-bar"><span>9:41</span><i /><span>5G</span></div>
              <div className="home-ordering-phone-head"><span><ForkKnife weight="fill" /></span><div><small>手機菜單</small><strong>百工牛肉麵</strong></div></div>
              <div className="home-ordering-phone-tabs"><span className="is-active">招牌牛肉麵</span><span>乾麵</span><span>小菜</span></div>
              <article className="home-ordering-menu-item">
                <img src="/assets/demo-beef-noodle/braised-bowl.svg" alt="招牌紅燒牛肉麵示意圖" width="214" height="150" />
                <div><strong>招牌紅燒牛肉麵</strong><small>慢燉紅燒湯頭・厚切牛腱</small><b>NT$180</b></div>
                <span>＋</span>
              </article>
              <article className="home-ordering-menu-item is-small">
                <img src="/assets/demo-beef-noodle/tendon-bowl.svg" alt="半筋半肉牛肉麵示意圖" width="214" height="150" />
                <div><strong>半筋半肉牛肉麵</strong><small>牛腱與牛筋雙重口感</small><b>NT$220</b></div>
                <span>＋</span>
              </article>
              <div className="home-ordering-cart"><ShoppingCart weight="fill" /><span>查看購物車</span><strong>1</strong></div>
            </div>
            <span className="home-ordering-float-badge"><ChartLineUp weight="duotone" />訂單即時掌握</span>
          </div>
        </a>
      </div>
    </section>

    {selected && <div className="home-feature-detail" role="dialog" aria-modal="true" aria-labelledby="home-feature-title"><button type="button" className="home-feature-backdrop" aria-label="關閉功能介紹" onClick={() => setSelected(null)} /><article className={`home-feature-panel ${selected.name === "免POS機點餐" ? "softpos-feature-panel" : ""}`}><button type="button" className="home-feature-close" aria-label="關閉" onClick={() => setSelected(null)}><X /></button><span className="home-feature-panel-icon"><selected.icon weight="duotone" /></span><p className="home-feature-label">百工數位服務</p><h2 id="home-feature-title">{selected.name}</h2><p className="home-feature-summary">{selected.summary}</p>{selected.name === "免POS機點餐" ? <><div className="softpos-entry-grid"><Link to="/pos-ordering"><span><Storefront weight="duotone" /></span>免POS機點餐介紹<ArrowRight /></Link><Link to="/pos-ordering/guide"><span><BookOpenText weight="duotone" /></span>免POS機點餐教學<ArrowRight /></Link><Link to="/pos-ordering/experience"><span><ShoppingCart weight="duotone" /></span>體驗點餐<ArrowRight /></Link></div><small>選擇要了解的內容，或直接進入目前正式運作的 Demo 點餐流程。</small></> : <><dl><dt>適用對象</dt><dd>{selected.audience}</dd><dt>核心價值</dt><dd>{selected.value}</dd></dl><h3>主要功能</h3><ul>{selected.items.map((item) => <li key={item}><CheckCircle weight="fill" />{item}</li>)}</ul>{selected.name === "承攬 / 商家簽約" ? <div className="home-feature-contract-actions"><Link className="btn btn-primary btn-lg" to="/join?mode=merchant">商家方案簽約 <ArrowRight /></Link><Link className="btn btn-outline btn-lg" to="/partner/apply">承攬夥伴簽約 <ArrowRight /></Link></div> : <Link className="btn btn-primary btn-lg" to={selected.to}>{selected.cta} <ArrowRight /></Link>}</>}</article></div>}
    </main><MobileBottomNav />
  </div>;
}

function FeatureButton({ feature, index, onClick }: { feature: Feature; index: number; onClick: () => void }) { const Icon = feature.icon; return <button className={`immersive-feature feature-${index}`} type="button" onClick={onClick} aria-haspopup="dialog"><span><Icon weight="duotone" /></span><strong>{feature.name}</strong></button>; }

function NewsCard({ item }: { item: NewsItem }) {
  return <article className="home-media-card">
    <a href={item.href} target="_blank" rel="noopener noreferrer" aria-label={`閱讀${item.source}報導：${item.title}（另開新視窗）`}>
      <div className="home-media-image">
        <img src={item.image} alt={`${item.source}報導：${item.title}`} width="1200" height="675" loading="lazy" decoding="async" />
      </div>
      <div className="home-media-content">
        <span className="home-media-source">{item.source}</span>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <span className="home-media-read">閱讀完整報導 <ArrowUpRight weight="bold" aria-hidden="true" /></span>
      </div>
    </a>
  </article>;
}
