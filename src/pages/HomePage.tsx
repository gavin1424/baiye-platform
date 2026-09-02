import { ArrowRight, CalendarCheck, ChartLineUp, CheckCircle, GlobeHemisphereWest, GoogleLogo, Handshake, LinkSimpleHorizontal, List, LineSegments, QrCode, Robot, ShieldCheck, User, X } from "@phosphor-icons/react";
import { useEffect, useState, type ComponentType } from "react";
import { Link } from "react-router-dom";
import { MobileBottomNav } from "../components";

type Feature = { name: string; summary: string; audience: string; value: string; items: string[]; cta: string; to: string; icon: ComponentType<{ weight?: "duotone" | "fill" }> };

const features: Feature[] = [
  { name: "官網建置", icon: GlobeHemisphereWest, summary: "快速建立兼具品牌形象與商業轉換的數位門面。", audience: "餐飲、零售、美業、工作室與專業服務商家", value: "讓顧客從搜尋、理解服務到採取行動，都在一致的品牌體驗中完成。", items: ["RWD 響應式品牌網站", "商品與服務介紹", "聯絡表單與 SEO 基礎結構", "串接預約、點餐、會員與 LINE"], cta: "了解建置方案", to: "/pricing" },
  { name: "AI智能客服", icon: Robot, summary: "部署在網站與 LINE 的商家專屬 AI 客服助手。", audience: "常有重複詢問、需要延長服務時間的商家", value: "用一致內容回答常見問題，減少人工負擔並把顧客導向下一步。", items: ["常見問題自動回覆", "商品與服務介紹", "預約與流程說明", "固定問答與 LINE 導流"], cta: "了解 AI 服務", to: "/features" },
  { name: "LINE官方帳號", icon: LineSegments, summary: "協助商家建立、整合並經營自己的 LINE 官方帳號。", audience: "希望累積可持續互動顧客關係的實體商家", value: "把網站訪客與到店顧客導入商家可持續經營的溝通管道。", items: ["LINE OA 串接", "Rich Menu 與歡迎訊息", "加好友導流", "會員綁定與後續通知擴充"], cta: "洽詢 LINE 整合", to: "/contact" },
  { name: "會員回購", icon: User, summary: "用一致會員識別整理顧客關係、消費與回購歷程。", audience: "重視熟客、回訪率與長期留存的商家", value: "不靠短期促銷，從資料與互動建立長期會員經營能力。", items: ["會員資料管理", "消費與回購追蹤", "顧客標籤", "會員分級規劃與 LINE 再行銷導流"], cta: "了解會員經營", to: "/member-benefits" },
  { name: "預約管理", icon: CalendarCheck, summary: "讓顧客線上選時段，商家在同一後台管理預約。", audience: "美業、服務業、顧問、教室與個人工作室", value: "降低來回確認成本，讓時段、狀態與異動更清楚。", items: ["線上預約", "時段與狀態管理", "改期與取消", "行事曆式後台檢視"], cta: "了解預約功能", to: "/features" },
  { name: "免POS機點餐", icon: QrCode, summary: "免專用 POS 主機，顧客掃碼、商家用手機或平板接單。", audience: "餐廳、早餐店、攤販、小吃與外帶商家", value: "降低專用硬體門檻，串起菜單、訂單、KDS、庫存與財務。", items: ["QR 掃碼點餐", "手機／平板接單", "桌號、外帶、規格與加料", "KDS 與訂單流程整合"], cta: "體驗掃碼點餐", to: "/pos-comparison" },
  { name: "Google地圖預約", icon: GoogleLogo, summary: "從 Google 商家資訊把在地搜尋流量導入預約流程。", audience: "美業、工作室與實體店家", value: "縮短顧客從找到商家到完成預約的距離，提高在地曝光轉換。", items: ["Google 地圖商家資訊導流", "快速進入預約頁", "網站預約資料整合", "在地曝光轉換規劃"], cta: "了解更多", to: "/google-maps-booking" },
  { name: "承攬 / 商家簽約", icon: Handshake, summary: "平台合作、商家加入與契約留存的一體化手機流程。", audience: "承攬夥伴、商家負責人與受授權代表", value: "從身分確認、閱讀到電子簽署與文件下載，都能安全留存。", items: ["商家免費註冊", "承攬夥伴合作契約", "三種商家服務方案", "私人 PDF 契約下載"], cta: "前往統一加入中心", to: "/join" },
];

const values = [[QrCode, "多業態整合", "一站式管理"], [ChartLineUp, "智慧經營", "數據驅動決策"], [ShieldCheck, "安全穩定", "企業級防護"], [Handshake, "專業服務", "陪伴成長"]] as const;

export function HomePage() {
  const [selected, setSelected] = useState<Feature | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    if (!selected) return;
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setSelected(null); };
    document.body.classList.add("home-detail-open"); window.addEventListener("keydown", close);
    return () => { document.body.classList.remove("home-detail-open"); window.removeEventListener("keydown", close); };
  }, [selected]);
  return <>
    <main className="immersive-home">
    <section className="immersive-home-hero">
      <header className="immersive-home-header">
        <Link className="immersive-home-brand" to="/" aria-label="創百業智慧鏈首頁"><span><LinkSimpleHorizontal weight="duotone" /></span><div><strong>創百業智慧鏈</strong><small>baiyeconnect</small></div></Link>
        <button type="button" className="immersive-menu-button" aria-label={menuOpen ? "關閉選單" : "開啟選單"} aria-expanded={menuOpen} onClick={() => setMenuOpen((value) => !value)}>{menuOpen ? <X /> : <List />}</button>
        {menuOpen && <nav className="immersive-menu" aria-label="首頁選單"><Link to="/features">平台功能</Link><Link to="/pricing">商家方案</Link><Link to="/join">加入／方案中心</Link><Link to="/contact">聯絡我們</Link></nav>}
      </header>

      <div className="immersive-home-heading"><h1>全業態數位升級，<em>一站完成</em></h1><p>餐飲 × 美業 × 零售，多產業整合的智慧經營平台</p></div>

      <div className="immersive-showcase" aria-label="餐飲、美業與零售智慧經營場景">
        <img src={`${import.meta.env.BASE_URL}assets/baiye-multi-industry-isometric-hero.png`} alt="餐飲、美業與零售整合的智慧經營場景" />
        <div className="immersive-feature-overlay" aria-label="百工八大功能">
          {features.map((feature, index) => <FeatureButton key={feature.name} feature={feature} index={index + 1} onClick={() => setSelected(feature)} />)}
        </div>
      </div>

      <section className="immersive-values" aria-label="品牌價值">{values.map(([Icon, title, text]) => <article key={title}><Icon weight="duotone" /><strong>{title}</strong><span>{text}</span></article>)}</section>
    </section>

    {selected && <div className="home-feature-detail" role="dialog" aria-modal="true" aria-labelledby="home-feature-title"><button type="button" className="home-feature-backdrop" aria-label="關閉功能介紹" onClick={() => setSelected(null)} /><article className="home-feature-panel"><button type="button" className="home-feature-close" aria-label="關閉" onClick={() => setSelected(null)}><X /></button><span className="home-feature-panel-icon"><selected.icon weight="duotone" /></span><p className="home-feature-label">百工數位服務</p><h2 id="home-feature-title">{selected.name}</h2><p className="home-feature-summary">{selected.summary}</p><dl><dt>適用對象</dt><dd>{selected.audience}</dd><dt>核心價值</dt><dd>{selected.value}</dd></dl><h3>主要功能</h3><ul>{selected.items.map((item) => <li key={item}><CheckCircle weight="fill" />{item}</li>)}</ul><Link className="btn btn-primary btn-lg" to={selected.to}>{selected.cta} <ArrowRight /></Link></article></div>}
    </main>
    <MobileBottomNav />
  </>;
}

function FeatureButton({ feature, index, onClick }: { feature: Feature; index: number; onClick: () => void }) { const Icon = feature.icon; return <button className={`immersive-feature feature-${index}`} type="button" onClick={onClick} aria-haspopup="dialog"><span><Icon weight="duotone" /></span><strong>{feature.name}</strong></button>; }
