import { ArrowRight, Buildings, Handshake, LockKey, Storefront } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout } from "../components";

export function VerifiedBusinessesPage() {
  return <PublicLayout><section className="section"><div className="container"><div className="section-heading"><div><span className="eyebrow">正式商家</span><h1>尋找商家與服務</h1><p>平台只公開經確認的真實合作商家；資料完成驗證後才會上架。</p></div></div><div className="website-cases-grid"><article className="website-case-card"><img src="https://meilingpatchwork.com/wp-content/themes/meiling-patchwork/assets/images/home/patchwork-hero-poster.webp" alt="美玲拼布正式網站" loading="lazy"/><div className="website-case-content"><p className="website-case-category">手作・拼布・文創</p><h2>美玲拼布</h2><p>拼布作品、課程教學、AI 客服與線上預約整合的正式合作案例。</p><span className="status-badge status-success">已確認正式案例</span><a className="text-link" href="https://meilingpatchwork.com/" target="_blank" rel="noreferrer">查看正式網站 <ArrowRight/></a></div></article></div></div></section></PublicLayout>;
}

export function EmptyCollaborationPage() {
  return <PublicLayout><section className="section"><div className="container empty-state"><span><Handshake/></span><h1>目前尚無公開合作需求</h1><p>合作需求經平台確認後才會公開。商家加入與發布功能將於正式帳號審核完成後開放。</p><Link className="btn btn-primary" to="/pricing">商家加入創百業</Link></div></section></PublicLayout>;
}

export function CatalogUnavailablePage() {
  return <PublicLayout><section className="section"><div className="container empty-state"><span><Storefront/></span><h1>商品與服務展示準備中</h1><p>正式金流與商品資料尚未完成上架，目前不接受線上付款。需要服務請先瀏覽已確認商家或聯絡平台。</p><div className="hero-actions"><Link className="btn btn-primary" to="/businesses">尋找商家</Link><Link className="btn btn-outline" to="/contact">聯絡平台</Link></div></div></section></PublicLayout>;
}

export function AccountUnavailablePage() {
  return <PublicLayout><section className="section"><div className="container empty-state"><span><LockKey/></span><h1>會員帳號功能準備中</h1><p>正式會員後端尚未開放，因此目前不提供公開註冊或一般會員登入。管理員與承攬夥伴請使用各自的安全登入入口。</p><div className="hero-actions"><Link className="btn btn-primary" to="/partner/login">承攬夥伴登入</Link><Link className="btn btn-outline" to="/contact">聯絡平台</Link></div></div></section></PublicLayout>;
}

export function MerchantAccessUnavailablePage() {
  return <PublicLayout><section className="section"><div className="container empty-state"><span><Buildings/></span><h1>商家後台採審核開通</h1><p>商家申請需經方案確認、付款／合約與平台審核後才會建立正式帳號。公開測試後台已停用。</p><Link className="btn btn-primary" to="/pricing">了解商家 AI 數位升級方案</Link></div></section></PublicLayout>;
}

export function ProductionContactPage() {
  return <PublicLayout><section className="section"><div className="container"><div className="section-heading"><div><span className="eyebrow">聯絡平台</span><h1>商家導入與平台服務諮詢</h1><p>請透過創百業智慧鏈官方聯絡管道提出需求；平台不會在此頁進行測試送出或蒐集未必要的個資。</p></div></div><div className="partner-card"><h2>諮詢內容</h2><p>商家 AI 數位升級、品牌網站、LINE、AI 客服、預約與承攬夥伴合作。</p><Link className="btn btn-primary" to="/pricing">先了解商家方案</Link></div></div></section></PublicLayout>;
}

export function ProductionPrivacyPage() {
  return <PublicLayout><section className="section legal-page"><div className="container narrow"><span className="eyebrow">隱私與個資保護</span><h1>隱私權政策暨個人資料蒐集告知</h1><p>更新日期：2026 年 8 月 25 日</p><h2>蒐集目的與範圍</h2><p>我們僅在承攬夥伴申請、商家導入、預約、契約、付款與客服所必要的範圍內，蒐集姓名、聯絡方式、帳號識別資訊及您主動提供的資料。</p><h2>利用方式與期間</h2><p>資料用於身份驗證、服務履行、通知、帳務、稽核及法令遵循，並依契約期間、法定保存期限或目的消失前保存。</p><h2>資料安全與第三方</h2><p>重要資料受後端權限、租戶隔離及存取稽核保護；我們不會將個資公開展示或任意出售。因提供服務而使用的雲端、LINE、AI 或儲存服務，僅在必要範圍處理資料。</p><h2>您的權利</h2><p>您可依法請求查詢、閱覽、複製、補充、更正、停止利用或刪除；但依法或履行契約仍須保存者除外。</p><h2>聯絡與申訴</h2><p>若有隱私或個資問題，請由平台正式聯絡頁提出，我們會進行身份確認後處理。</p><p><Link className="text-link" to="/contact">聯絡平台 <ArrowRight/></Link></p></div></section></PublicLayout>;
}

export function ProductionNotFoundPage() {
  return <PublicLayout><section className="section"><div className="container empty-state"><span><LockKey/></span><h1>找不到此頁面</h1><p>此功能可能尚未正式開放，或網址已更新。</p><Link className="btn btn-primary" to="/">返回首頁</Link></div></section></PublicLayout>;
}
