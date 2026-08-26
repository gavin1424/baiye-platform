import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Calculator, CheckCircle, Receipt, ShieldCheck, Wallet } from "@phosphor-icons/react";
import { PublicLayout, SectionHeading } from "../components";

const money = (minor: number) => `NT$${new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 }).format(minor / 100)}`;
const bpAmount = (amount: number, bp: number) => Number((BigInt(amount) * BigInt(bp) + 5000n) / 10000n);

export function DepositSettlementPage() {
  const [total, setTotal] = useState("10000");
  const [depositRate, setDepositRate] = useState("30");
  const [platformRate, setPlatformRate] = useState("2");
  const [processingRate, setProcessingRate] = useState("2.75");
  const estimate = useMemo(() => {
    const order = Math.max(0, Math.round(Number(total || 0) * 100));
    const depositBp = Math.max(0, Math.min(10000, Math.round(Number(depositRate || 0) * 100)));
    const platformBp = Math.max(0, Math.min(10000, Math.round(Number(platformRate || 0) * 100)));
    const processingBp = Math.max(0, Math.min(10000, Math.round(Number(processingRate || 0) * 100)));
    const deposit = bpAmount(order, depositBp), processing = bpAmount(deposit, processingBp), platform = bpAmount(order, platformBp);
    return { order, deposit, processing, platform, payable: Math.max(0, deposit - processing - platform) };
  }, [depositRate, platformRate, processingRate, total]);
  const faqs = [
    ["所有商家都會收平台作業服務費嗎？", "不會。本服務為選配；一般商家方案不按交易金額抽成。只有另行申請、完成審核且有效契約載明的商家，才依個別契約計費。"],
    ["NT$18,000 會不會重複收取？", "不會。已一次支付 NT$18,000 的 upfront_18000 商家不建立銷售抵付進度；sales_offset_18000 才按有效契約逐期抵付。兩種方案不能同時啟用。"],
    ["會自動扣營業稅或 10% 嗎？", "不會。稅務預留與扣繳預設均為停用，只有經記帳士／稅務專業人員確認並由管理員核准設定後才會列入。"],
    ["已經能刷卡或使用 LINE Pay 嗎？", "本頁不代表任何金流 Provider 已正式開通。實際可用方式、手續費與代收安排以商家完成審核後的正式設定及對帳單為準。"],
  ];
  return <PublicLayout>
    <section className="deposit-hero"><div className="container deposit-hero-grid"><div><span className="eyebrow">選配數位營運服務</span><h1>訂金代收與月結對帳服務</h1><p>依商家個別契約整合訂金代收、費用拆分、月結對帳與 NT$18,000 銷售抵付進度，讓每筆應收、費用與應撥款都有可追溯紀錄。</p><div className="hero-actions"><Link className="btn btn-primary" to="/contact">申請服務評估 <ArrowRight /></Link><Link className="btn btn-outline" to="/contact">聯絡平台</Link></div></div><aside><ShieldCheck weight="duotone"/><strong>不預設啟用、不重複收費</strong><p>每家商家須先完成契約、法務與必要的會計確認，平台才會建立專屬規則。</p></aside></div></section>
    <section className="section"><div className="container"><SectionHeading eyebrow="服務流程" title="從訂金到撥款，每一步都有正式對帳"/><div className="steps-grid">{[
      [Wallet,"客戶支付訂金","預設說明比例為訂單總額 30%；實際比例依個別契約與正式設定。"],
      [CheckCircle,"尾款直付店家","尾款由客戶依店家約定直接支付，不在本模組中假裝完成代收。"],
      [Receipt,"產生月結對帳","彙整訂單、代收訂金、實際金流費、平台作業費、退款與調整。"],
      [ShieldCheck,"鎖定後不可竄改","鎖定對帳單保存規則快照與 Hash；後續差額只能進入下一期調整。"],
    ].map(([Icon,title,text])=>{const I=Icon as typeof Wallet;return <article className="step-card" key={String(title)}><span className="step-icon"><I weight="duotone"/></span><h3>{String(title)}</h3><p>{String(text)}</p></article>})}</div></div></section>
    <section className="section deposit-offset"><div className="container deposit-offset-grid"><div><span className="eyebrow">兩種方案明確分流</span><h2>NT$18,000 不會重複計算</h2><article><strong>upfront_18000</strong><p>已依一般方案一次支付 NT$18,000，不建立銷售抵付進度。</p></article><article><strong>sales_offset_18000</strong><p>依個別有效契約，以每期平台作業服務費逐期抵付 NT$18,000；完成後是否繼續收費，以契約設定為準。</p></article></div><div><h3>月結內容</h3><ul><li>交易與訂金彙整</li><li>Provider 實際／估算金流費清楚標示</li><li>平台作業服務費與抵付進度</li><li>退款、差額與下一期調整</li><li>私人 PDF、Excel 相容 CSV 與稽核紀錄</li></ul></div></div></section>
    <section className="section"><div className="container"><SectionHeading eyebrow="估算工具" title="訂金代收試算器" description="所有欄位可依評估情境調整；此試算不會建立交易或寫入正式資料。"/><div className="deposit-calculator"><form><label>訂單總額（NT$）<input inputMode="decimal" min="0" value={total} onChange={e=>setTotal(e.target.value)}/></label><label>訂金比例（%）<input inputMode="decimal" min="0" max="100" value={depositRate} onChange={e=>setDepositRate(e.target.value)}/></label><label>平台服務費率（%）<input inputMode="decimal" min="0" max="100" value={platformRate} onChange={e=>setPlatformRate(e.target.value)}/></label><label>預估金流費率（%）<input inputMode="decimal" min="0" max="100" value={processingRate} onChange={e=>setProcessingRate(e.target.value)}/></label></form><div className="deposit-results"><Calculator weight="duotone"/><p><span>預估代收訂金</span><strong>{money(estimate.deposit)}</strong></p><p><span>預估金流費</span><strong>{money(estimate.processing)}</strong></p><p><span>預估平台服務費</span><strong>{money(estimate.platform)}</strong></p><p className="deposit-payable"><span>預估應撥店家金額</span><strong>{money(estimate.payable)}</strong></p></div></div><p className="legal-hint">本試算僅供說明，正式金額依實際交易、金流 Provider 費用、退款、個別契約及月結對帳單為準。</p></div></section>
    <section className="section section-muted"><div className="container"><SectionHeading title="風險與稅務揭露"/><div className="faq-grid"><article><h3>稅務預留</h3><p>預設停用。不得解讀為平台依法代收代繳營業稅；只有依記帳士或稅務專業人員確認結果設定。</p></article><article><h3>扣繳</h3><p>預設停用。平台不會因商家未提供發票就自動扣 10%；實際處理依身分類別、所得性質、有效契約與適用法令。</p></article><article><h3>金流與退款</h3><p>優先採 Provider 實際費用；未取得時才使用清楚標示的估算值。鎖定後退款與差額須在下一期調整。</p></article></div></div></section>
    <section className="section"><div className="container"><SectionHeading title="常見問題"/><div className="faq-grid">{faqs.map(([q,a])=><article key={q}><h3>{q}</h3><p>{a}</p></article>)}</div><div className="deposit-cta"><h2>先確認商業流程，再決定是否啟用</h2><p>平台會依商家身分、交易方式與契約需求進行服務評估。</p><Link className="btn btn-primary" to="/contact">申請服務評估</Link></div></div></section>
  </PublicLayout>;
}

export function MerchantSettlementsUnavailablePage() {
  return <main className="route-loading"><ShieldCheck size={40} weight="duotone"/><h1>商家月結對帳尚未開放</h1><p>此頁需要正式 server-side Merchant Session。現階段不接受 LocalStorage 或網址參數授權。</p><Link className="btn btn-primary" to="/contact">聯絡平台</Link></main>;
}
