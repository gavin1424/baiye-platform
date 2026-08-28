import { CalendarBlank, Handshake, QrCode, Receipt, ShieldCheck } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { AdminModuleNav } from "../components/AdminModuleNav";
import { useAppStore } from "../store";

export function ProductionAdminOverview() {
  const { session, logout } = useAppStore();
  const modules = [
    { icon: Receipt, title: "金流與記帳", text: "正式收款、退款、手續費、淨收入與營運帳本。", to: "/admin/finance", badge: "正式後端" },
    { icon: CalendarBlank, title: "預約管理", text: "管理正式商家的服務、營業時間、預約、改期與取消。", to: "/admin/bookings", badge: "Production" },
    { icon: QrCode, title: "掃碼會員與手機點餐", text: "建立專屬 QR、快速會員、桌號、菜單與即時訂單看板。", to: "/admin/ordering", badge: "V1" },
    { icon: Handshake, title: "承攬夥伴", text: "申請審核、啟用、契約、成交、獎勵與 VIP 狀態。", to: "/admin/partners", badge: "線上簽約" },
  ];
  return <main className="finance-shell"><AdminModuleNav current="overview"/><header className="finance-hero"><div><span className="eyebrow">營運控制中心</span><h1>平台管理總覽</h1><p>已登入：{session.name}（{session.email}）。只顯示已連接正式後端的管理模組。</p></div><button className="btn btn-outline" onClick={logout}>安全登出</button></header><section className="container section"><div className="steps-grid">{modules.map(({icon:Icon,title,text,to,badge})=><article className="step-card" key={to}><span className="step-icon"><Icon weight="duotone"/></span><span className="status-badge status-success">{badge}</span><h2>{title}</h2><p>{text}</p><Link className="btn btn-primary" to={to}>進入管理</Link></article>)}<article className="step-card"><span className="step-icon"><ShieldCheck weight="duotone"/></span><span className="status-badge">受保護</span><h2>其他管理模組</h2><p>完整商家自行登入、CRM 分眾與正式線上金流仍維持 Production Lock，未接妥前不公開假資料介面。</p></article></div></section></main>;
}
