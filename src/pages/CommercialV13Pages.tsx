import { Check, CheckCircle, Globe, ShieldCheck, Sparkle, Storefront, UsersThree } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PublicLayout, SectionHeading } from "../components";

export function PricingPageV13() {
  return <PublicLayout>
    <section className="pricing-hero"><div className="container"><span className="eyebrow"><Sparkle weight="fill" />AI 行銷推廣方案</span><h1>方案原價 NT$30,000<br />現階段推廣促銷價 NT$18,000</h1><p>響應政府推動 AI 應用及產業數位轉型政策，創百業智慧鏈由公司自主推出推廣促銷價。NT$18,000 為行銷推廣、平台上架及數位服務費；標準規格商家網站基礎建置免費附贈，網站建置費 NT$0。</p><p><strong>本促銷為創百業智慧鏈自主商業推廣，非政府補助、政府核准或政府保證。</strong></p></div></section>
    <section className="pricing-section"><div className="container"><div className="pricing-grid">
      <article className="pricing-card"><div className="pricing-card-top"><span className="plan-icon plan-free"><Storefront /></span><h2>免費會員</h2><p>一般消費者購物帳號。</p><div className="pricing-amount"><strong>NT$0</strong></div></div><Link to="/register?type=member" className="btn btn-outline btn-lg">免費註冊</Link><ul>{["瀏覽商城與商品","購物車","結帳","購物帳號功能"].map(x=><li key={x}><Check weight="bold" />{x}</li>)}</ul></article>
      <article className="pricing-card"><div className="pricing-card-top"><span className="plan-icon plan-merchant"><Sparkle /></span><h2>商家 AI 行銷推廣方案</h2><p><del>原價 NT$30,000</del>｜現階段推廣促銷價</p><div className="pricing-amount"><strong>NT$18,000</strong><span>行銷推廣／平台上架服務費</span></div></div><Link to="/register?type=merchant" className="btn btn-primary btn-lg">申請商家推廣上架</Link><ul>{[
        "標準規格商家網站基礎建置免費附贈（建置費 NT$0）",
        "建立商家資料與公開網站",
        "網站編輯與發布",
        "商品／服務與作品上架",
        "合作需求、提案與詢價／報價",
        "商家訂單、私訊與評價",
        "數據分析與完整商家後台",
        "前 2 年平台上架、網域及後台／網站維持納入方案",
      ].map(x=><li key={x}><Check weight="bold" />{x}</li>)}</ul></article>
    </div>
    <section className="pricing-comparison section"><SectionHeading title="第 3 年起續用費用" description="如商家選擇持續使用服務，自第 3 年起每年合計 NT$7,000。" /><div className="comparison-table" role="table" aria-label="第三年續用費"><div className="comparison-row comparison-head" role="row"><strong>項目</strong><span>年費</span><span>說明</span></div>{[["平台上架費","NT$3,000","維持平台商家上架與曝光"],["網域費","NT$1,000","網域續用"],["後台／網站維持費","NT$3,000","維持網站與商家後台使用"],["合計","NT$7,000／年","自第 3 年起，選擇續用時收取"]].map(row=><div className="comparison-row" role="row" key={row[0]}><strong>{row[0]}</strong><span>{row[1]}</span><span>{row[2]}</span></div>)}</div></section>
    <div className="pricing-trust-row">{[[ShieldCheck,"不收交易抽成"],[CheckCircle,"標準網站免費附贈"],[UsersThree,"真人客服支援"],[Globe,"超出標準規格另行報價"]].map(([Icon,label])=>{const I=Icon as typeof ShieldCheck;return <span key={String(label)}><I weight="duotone" />{String(label)}</span>})}</div>
    <section className="pricing-faq section"><SectionHeading title="額外功能怎麼計費？" /><div className="faq-grid"><article><h3>免費附贈網站包含什麼？</h3><p>以公司當期標準版型、頁面與既有功能為範圍完成基礎商家網站。這一部分網站建置費為 NT$0。</p></article><article><h3>什麼情況需要另外加收？</h3><p>新增頁面、重新設計、特殊視覺、額外功能、第三方 API／系統串接、客製流程、超出約定修改次數或其他原方案外工作，均須另行評估並報價。</p></article><article><h3>商家一直沒有交資料怎麼辦？</h3><p>依合作契約，若商家遲延或長期未交完整素材，公司得使用商家已提供資料及依法可使用之公開資訊，搭配標準版型完成基礎版網站交付，避免專案無限期延宕。</p></article><article><h3>NT$18,000 是網站建置費嗎？</h3><p>不是。NT$18,000 是行銷推廣、平台上架及數位服務的推廣促銷費用；標準規格網站基礎建置為免費附贈。</p></article></div></section>
    </div></section>
  </PublicLayout>;
}

export function HowItWorksPageV13() {
  return <PublicLayout><section className="info-hero"><div className="container"><span className="eyebrow">如何運作</span><h1>從 AI 行銷推廣，到免費附贈網站上線</h1><p>現行商家方案原價 NT$30,000，推廣促銷價 NT$18,000；標準規格網站基礎建置免費附贈。</p></div></section><section className="section how-paths"><div className="container"><div className="path-steps">{[
    ["1","確認推廣方案","確認 NT$18,000 行銷推廣／平台上架服務內容與免費附贈網站範圍。"],
    ["2","簽約與付款","完成商家服務合作契約、付款及必要建置資料提供。"],
    ["3","免費基礎網站建置","依標準規格完成商家網站；如商家長期未交完整素材，依契約使用現有及合法公開資料完成基礎版交付。"],
    ["4","上線與營運","網站、商家公開頁與後台上線；原方案以外之新增頁面、功能或串接另行報價。"],
  ].map(([n,t,d])=><article key={n}><span className="path-number">{n}</span><h2>{t}</h2><p>{d}</p></article>)}</div></div></section><section className="section"><div className="container"><SectionHeading title="續用費用" description="前 2 年納入方案；第 3 年起選擇續用時每年 NT$7,000。" /><div className="comparison-table"><div className="comparison-row comparison-head"><strong>平台上架</strong><span>網域</span><span>後台／網站維持</span></div><div className="comparison-row"><strong>NT$3,000／年</strong><span>NT$1,000／年</span><span>NT$3,000／年</span></div></div></div></section></PublicLayout>;
}

export function FaqPageV13() {
  const items = [
    ["現在方案多少錢？","商家 AI 行銷推廣方案原價 NT$30,000，現階段響應政府推動 AI 應用及產業數位轉型政策，由創百業智慧鏈自主推出推廣促銷價 NT$18,000。此促銷非政府補助、核准或保證。"],
    ["NT$18,000 是網站製作費嗎？","不是。NT$18,000 為行銷推廣、平台上架及數位服務費。標準規格商家網站基礎建置免費附贈，建置費 NT$0。"],
    ["可以要求增加任何功能嗎？","可以提出需求，但原方案以外之新增頁面、重新設計、客製功能、第三方 API／系統串接、特殊流程或超出修改範圍之工作，需要另外評估與報價。"],
    ["如果我沒有準時交網站資料？","為避免專案無限期延誤，公司可依契約使用你已提供的素材及依法可使用之公開商業資訊，搭配標準版型完成基礎版網站並交付。之後如需大量重做或新增功能，可能另行計費。"],
    ["第三年還要付費嗎？","前 2 年平台上架、網域及後台／網站維持納入方案。第 3 年起如選擇持續使用，每年合計 NT$7,000：上架費 3,000、網域費 1,000、後台／網站維持費 3,000。"],
    ["免費會員和商家方案有什麼不同？","免費會員是一般消費者購物帳號；商家 AI 行銷推廣方案才包含商家上架、公開頁、商家後台與免費附贈標準網站建置。"],
  ];
  return <PublicLayout><section className="info-hero"><div className="container"><span className="eyebrow">常見問題</span><h1>商家 AI 行銷推廣方案常見問題</h1><p>價格、免費附贈網站、額外功能與第三年續用費一次說清楚。</p></div></section><section className="section"><div className="container faq-grid">{items.map(([q,a])=><article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div></section></PublicLayout>;
}

export function TermsPageV13() {
  const sections = [
    ["服務性質","創百業智慧鏈提供商家行銷推廣、平台上架、商家公開頁、網站、內容刊登、搜尋、合作媒合、詢價與溝通工具。"],
    ["商家方案與促銷價格","現行商家 AI 行銷推廣方案原價 NT$30,000，現階段響應政府推動 AI 應用及產業數位轉型政策，由本公司自主提供推廣促銷價 NT$18,000。本促銷非政府補助、政府核准或政府保證。實際交易仍以雙方簽署之商家服務合作契約為準。"],
    ["免費附贈網站","NT$18,000 為行銷推廣、平台上架及數位服務費。標準規格網站基礎建置免費附贈，建置費 NT$0。免費附贈範圍以當期標準版型、頁面及既有功能為限。"],
    ["額外需求","新增頁面、重新設計、特殊視覺、客製功能、第三方 API／系統串接、額外程式功能、客製流程或超出約定修改範圍之工作，另行評估並報價，未經雙方確認不視為原方案義務。"],
    ["資料遲延與基礎版交付","商家應依約提供必要資料。若商家遲延、未完整提供或長期未回覆，公司得依契約使用已取得資料及依法可使用之公開商業資訊，搭配標準版型完成基礎版網站交付。"],
    ["續用費用","前 2 年平台上架、網域及後台／網站維持納入方案；第 3 年起商家如選擇續用，每年合計 NT$7,000，包括平台上架費 NT$3,000、網域費 NT$1,000、後台／網站維持費 NT$3,000。"],
    ["付款、退款與契約優先","付款、退款、修改、交付、驗收、智慧財產、資料使用與終止條件，以雙方實際簽署之有效商家服務合作契約及當期正式公告為準。"],
  ];
  return <PublicLayout><section className="legal-header"><div className="container"><span className="eyebrow">平台規範</span><h1>使用條款｜商家商業方案 V1.3</h1><p>最後更新：2026 年 8 月 23 日</p></div></section><section className="legal-section"><div className="container legal-layout"><aside><strong>本頁內容</strong>{sections.map(([h],i)=><a key={h} href={`#v13-${i}`}>{i+1}. {h}</a>)}</aside><article><div className="legal-notice"><ShieldCheck weight="duotone" /><p>正式簽約權利義務以雙方有效契約為準；涉及法律效果之契約版本仍應完成專業法律審閱。</p></div>{sections.map(([h,t],i)=><section id={`v13-${i}`} key={h}><span>{String(i+1).padStart(2,"0")}</span><div><h2>{h}</h2><p>{t}</p></div></section>)}</article></div></section></PublicLayout>;
}
