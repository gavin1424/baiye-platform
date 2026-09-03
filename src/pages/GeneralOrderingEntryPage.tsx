import { BowlFood, CheckCircle, ShoppingCart } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { PlatformLogo } from "../components";

const GENERAL_ORDERING_CODE =
  import.meta.env.VITE_BEEF_NOODLE_GENERAL_ORDERING_CODE ||
  "TlTgDC3Wh5xo61yT1WWbPnJK9GZt_o4y";

export function GeneralOrderingEntryPage() {
  return (
    <main className="ordering-scan-page ordering-order-entry-page">
      <header className="ordering-topbar"><PlatformLogo /><span>百工牛肉麵</span></header>
      <section className="ordering-scan-card ordering-order-entry-card">
        <span className="ordering-scan-icon ordering-order-entry-logo" aria-hidden="true"><BowlFood weight="fill" /></span>
        <p className="partner-eyebrow">百工牛肉麵</p>
        <h1>百工牛肉麵</h1>
        <strong className="ordering-order-entry-subtitle">手機點餐</strong>
        <p>線上查看菜單、選擇餐點並送出訂單</p>
        <Link className="btn btn-primary btn-lg ordering-order-entry-cta" to={`/q/${GENERAL_ORDERING_CODE}`}>
          <ShoppingCart weight="fill" />開始點餐
        </Link>
        <p className="ordering-order-entry-detail">點選後即可查看完整菜單並開始點餐。</p>
        <div className="ordering-scan-security"><CheckCircle weight="fill" /><span>不用下載 App</span></div>
        <Link className="ordering-scan-home" to="/">返回創百業首頁</Link>
      </section>
    </main>
  );
}
