import { ArrowRight, CalendarCheck, Check, CirclesFour, GlobeHemisphereWest, Handshake, Receipt, Robot, Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout, SectionHeading } from "../components";

const capabilities = [
  { icon: GlobeHemisphereWest, title: "品牌官網", text: "建立可長期經營、手機優先的品牌數位門面。" },
  { icon: Robot, title: "AI 智能客服", text: "以商家專屬知識回覆網站與 LINE 顧客問題。" },
  { icon: CalendarCheck, title: "線上預約", text: "服務、時段、防撞單、改期與取消整合管理。" },
  { icon: Storefront, title: "數位營運", text: "商家資料、顧客互動與營運工具逐步整合。" },
  { icon: Receipt, title: "訂金代收與月結對帳", text: "依商家契約整合訂金代收、費用拆分、月結對帳與抵付進度。" },
];

export function HomePage() {
  return <PublicLayout>
    <section className="hero-section"><div className="container hero-grid"><div className="hero-copy"><span className="eyebrow hero-eyebrow"><CirclesFour weight="fill"/> AI 智慧網站與百業數位升級平台</span><h1>讓商家的專業，<br/><em>真正被看見與找到</em></h1><p>把品牌官網、LINE、AI 客服、線上預約與數位營運串成一套可持續使用的商業入口。</p><div className="hero-actions"><Link to="/businesses" className="btn btn-primary btn-lg">我要找商家 <ArrowRight/></Link><Link to="/pricing" className="btn btn-outline btn-lg">商家加入創百業</Link><Link to="/partner" className="btn btn-ghost btn-lg">承攬夥伴</Link></div><p className="contractor-partner-contract-note">平台只公開已確認的正式商家與真實內容，不以測試數據製造營運成果。</p></div><div className="hero-visual"><img src={`${import.meta.env.BASE_URL}assets/hero-industry-collage.jpg`} alt="台灣各行業商家與專業工作者" fetchPriority="high"/></div></div></section>

    <section className="section"><div className="container"><SectionHeading eyebrow="商家 AI 數位升級" title="不只是做網站，而是建立可營運的數位入口" description="從品牌內容到客戶互動，依商家實際需求導入可驗證的功能。" action={{label:"查看全部功能",to:"/features"}}/><div className="steps-grid">{capabilities.map(({icon:Icon,title,text})=><article className="step-card" key={title}><span className="step-icon"><Icon weight="duotone"/></span><h3>{title}</h3><p>{text}</p></article>)}</div></div></section>

    <section className="section section-pricing-preview"><div className="container pricing-preview-shell"><div className="pricing-preview-copy"><span className="eyebrow">商家 AI 數位升級</span><h2>方案定價 NT$30,000</h2><p>響應 AI 應用及產業數位轉型趨勢，現階段推廣優惠 NT$18,000。</p><Link to="/pricing" className="btn btn-primary">了解 NT$18,000 推廣方案 <ArrowRight/></Link><Link to="/features" className="text-link">查看創百業全部功能 <ArrowRight/></Link><Link to="/services/deposit-settlement" className="text-link">了解訂金代收與月結對帳選配服務 <ArrowRight/></Link><Link to="/pos-comparison" className="text-link">比較 Web 數位營運與專業 POS 成本 <ArrowRight/></Link></div><div className="price-spotlight"><div className="price-label"><span>現階段推廣優惠</span>標準規格網站免費附贈</div><div className="price"><strong>NT$18,000</strong><span>AI 行銷推廣、平台上架及數位服務優惠費用</span></div><ul><li><Check/>標準網站基礎建置費 NT$0</li><li><Check/>LINE、AI 與預約依正式導入範圍設定</li><li><Check/>原方案外客製功能另行評估報價</li><li><Check/>第 3 年起續用合計 NT$7,000／年</li></ul><small>本優惠為陳靈有限公司／創百業智慧鏈自主商業促銷，不代表政府補助、核准、背書或保證。</small></div></div></section>

    <section id="official-case" className="section section-website-cases"><div className="container"><SectionHeading eyebrow="正式案例" title="已上線的商家數位服務" description="只展示已確認的正式合作內容。"/><div className="website-cases-grid"><article className="website-case-card"><img src="https://meilingpatchwork.com/wp-content/themes/meiling-patchwork/assets/images/home/patchwork-hero-poster.webp" alt="美玲拼布正式網站" loading="lazy"/><div className="website-case-content"><p className="website-case-category">手作・拼布・文創</p><h3>美玲拼布</h3><p>品牌網站、LINE、AI 智能客服與線上預約整合。</p><span className="website-case-status status-badge status-success">正式合作案例</span><a href="https://meilingpatchwork.com/" className="text-link" target="_blank" rel="noreferrer">查看正式網站 <ArrowRight/></a></div></article></div></div></section>

    <section className="section contractor-partner-section"><div className="container contractor-partner-shell"><div className="contractor-partner-copy"><span className="eyebrow"><Handshake weight="fill"/>承攬夥伴專區</span><h2>推薦商家，共創推廣成果</h2><p>以獨立承攬／居間合作形式，線上申請、啟用帳號、簽署契約，並查看成交與獎勵進度。</p><p className="contractor-partner-contract-note">已通過審核的承攬夥伴，可登入後閱讀、簽署並下載承攬夥伴合作契約 PDF。</p></div><div className="contractor-partner-actions"><Link to="/partner" className="btn btn-primary btn-lg">了解承攬合作 <ArrowRight/></Link><Link to="/partner/apply" className="btn btn-outline btn-lg">申請成為承攬夥伴</Link><Link to="/partner/login" className="btn btn-ghost btn-lg">承攬夥伴登入</Link></div></div></section>

    <section className="home-cta"><div className="container"><div><span>每個行業，都值得擁有自己的數位入口。</span><h2>準備好讓商家正式上線？</h2><p>先了解方案範圍，再由平台協助確認導入內容。</p></div><div className="home-cta-actions"><Link to="/pricing" className="btn btn-accent btn-lg">商家加入創百業 <ArrowRight/></Link><Link to="/contact" className="btn btn-light btn-lg">聯絡平台</Link></div></div></section>
  </PublicLayout>;
}
