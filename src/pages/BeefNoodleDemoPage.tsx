import { ArrowDown, ArrowRight, BowlFood, CheckCircle, Clock, CookingPot, DeviceMobile, MagnifyingGlass, QrCode, ShieldCheck, ShoppingCart, Sparkle, Storefront, Users } from "@phosphor-icons/react";
import { QRCodeSVG } from "qrcode.react";
import { Link } from "react-router-dom";
import "../beef-noodle-demo.css";

const A1_CODE = import.meta.env.VITE_BEEF_NOODLE_A1_CODE || "myJghWaqQbCwMInWWsBUf2xRwsR02saT";
const SITE_URL = (import.meta.env.VITE_PUBLIC_SITE_URL || "https://baiye-beef-noodle-demo.pages.dev").replace(/\/$/, "");
const A1_URL = `${SITE_URL}/#/q/${A1_CODE}`;

const highlights = [
  { icon: CookingPot, title: "慢燉牛骨湯", text: "用溫暖層次呈現招牌紅燒風味。" },
  { icon: BowlFood, title: "厚切牛腱", text: "示範品項規格、加料與價格快照。" },
  { icon: Sparkle, title: "每日現煮", text: "菜單可即時停售、售完與恢復供應。" },
  { icon: DeviceMobile, title: "手機桌邊點餐", text: "不用下載 App，掃碼即可開始。" },
];

const menu = [
  { name: "招牌紅燒牛肉麵", price: 180, image: "assets/demo-beef-noodle/braised-bowl.svg" },
  { name: "半筋半肉牛肉麵", price: 220, image: "assets/demo-beef-noodle/tendon-bowl.svg" },
  { name: "紅油牛肉乾拌麵", price: 160, image: "assets/demo-beef-noodle/dry-noodle.svg" },
  { name: "牛肚拼盤", price: 100, image: "assets/demo-beef-noodle/side-dish.svg" },
];

const steps = ["掃描桌上 QR", "快速加入會員", "選餐與加料", "送出訂單", "查看製作進度"];

export function BeefNoodleDemoPage() {
  return (
    <div className="beef-demo-site">
      <header className="beef-demo-header">
        <a className="beef-demo-brand" href="#top" aria-label="百工牛肉麵示範店首頁">
          <span className="beef-demo-brand-mark"><BowlFood weight="fill" /></span>
          <span><strong>百工牛肉麵</strong><small>QR ORDERING DEMO</small></span>
        </a>
        <nav aria-label="示範店導覽">
          <a href="#signature">招牌菜單</a><a href="#experience">點餐體驗</a><a href="#faq">FAQ</a>
        </nav>
        <Link className="beef-demo-btn beef-demo-btn-small" to={`/q/${A1_CODE}`}>立即點餐</Link>
      </header>

      <main id="top">
        <section className="beef-demo-hero">
          <div className="beef-demo-hero-copy">
            <span className="beef-demo-kicker">創百業智慧鏈 QR 點餐示範店</span>
            <h1>百工牛肉麵</h1>
            <p className="beef-demo-tagline">一碗慢熬的好味道，一支手機就能點餐</p>
            <p>紅燒慢燉、牛肉厚切。掃碼加入會員，直接用手機完成桌邊點餐。</p>
            <div className="beef-demo-actions">
              <Link className="beef-demo-btn" to={`/q/${A1_CODE}`}>立即手機點餐 <ArrowRight /></Link>
              <a className="beef-demo-btn beef-demo-btn-outline" href="#signature">看看完整菜單 <ArrowDown /></a>
            </div>
            <div className="beef-demo-notice"><ShieldCheck weight="fill" /><span><strong>此為功能展示環境，非實際營業店家。</strong> 請勿輸入真實敏感個資，也不會發生真實扣款。</span></div>
          </div>
          <div className="beef-demo-hero-art" role="img" aria-label="熱騰騰的紅燒牛肉麵插畫">
            <div className="beef-demo-steam steam-one" /><div className="beef-demo-steam steam-two" /><div className="beef-demo-steam steam-three" />
            <div className="beef-demo-bowl"><span className="beef-demo-noodle" /><span className="beef-demo-beef beef-one" /><span className="beef-demo-beef beef-two" /><span className="beef-demo-greens" /></div>
            <span className="beef-demo-chopsticks" />
          </div>
        </section>

        <section className="beef-demo-section beef-demo-highlights" aria-label="招牌特色">
          {highlights.map(({ icon: Icon, title, text }) => <article key={title}><Icon weight="duotone" /><h2>{title}</h2><p>{text}</p></article>)}
        </section>

        <section id="signature" className="beef-demo-section">
          <div className="beef-demo-section-heading"><span>招牌菜單</span><h2>先看幾道，完整菜單在手機裡</h2><p>每個價格與加料金額都由後端重新計算，送單後保留當下價格快照。</p></div>
          <div className="beef-demo-menu-grid">
            {menu.map((item) => <article key={item.name}><img src={`${SITE_URL}/${item.image}`} alt={`${item.name}示意插畫`} loading="lazy"/><div><h3>{item.name}</h3><strong>NT${item.price}</strong></div></article>)}
          </div>
          <div className="beef-demo-center"><Link className="beef-demo-btn" to={`/q/${A1_CODE}`}><MagnifyingGlass /> 查看 17 項完整菜單</Link></div>
        </section>

        <section id="experience" className="beef-demo-section beef-demo-experience">
          <div className="beef-demo-section-heading"><span>QR 點餐體驗</span><h2>五個步驟，完成桌邊點餐</h2></div>
          <ol>{steps.map((step, index) => <li key={step}><span>{index + 1}</span><strong>{step}</strong></li>)}</ol>
          <div className="beef-demo-qr-card">
            <div><span className="beef-demo-kicker">A1 桌示範 QR</span><h2>拿手機掃描，或直接開啟</h2><p>Demo 訂單只會寫入隔離的 Staging 資料庫，不會進入正式營運資料。</p><Link className="beef-demo-btn" to={`/q/${A1_CODE}`}>直接開啟 A1 桌手機點餐 <ArrowRight /></Link></div>
            <div className="beef-demo-qr"><QRCodeSVG value={A1_URL} size={220} level="H" marginSize={2} title="百工牛肉麵 A1 桌示範 QR"/><strong>A1 桌</strong></div>
          </div>
        </section>

        <section className="beef-demo-section beef-demo-operations">
          <div className="beef-demo-section-heading"><span>完整流程</span><h2>顧客看進度，店家管出餐</h2></div>
          <div className="beef-demo-operation-grid">
            <article><ShoppingCart weight="duotone"/><h3>顧客手機</h3><p>選規格、加料、備註、送單、查看狀態與再次加點。</p></article>
            <article><Storefront weight="duotone"/><h3>商家接單</h3><p>接單、製作、待出餐、完成、售完品項與現場付款確認。</p></article>
            <article><Users weight="duotone"/><h3>桌位 Session</h3><p>同桌加點自動歸組，清桌後下一組客人不會看到前桌資料。</p></article>
            <article><Clock weight="duotone"/><h3>即時進度</h3><p>送出後可查看訂單編號與製作狀態，無需下載 App。</p></article>
          </div>
        </section>

        <section id="faq" className="beef-demo-section beef-demo-faq">
          <div className="beef-demo-section-heading"><span>FAQ</span><h2>體驗前先知道</h2></div>
          <details open><summary>要下載 App 嗎？</summary><p>不用，使用手機瀏覽器即可完成。</p></details>
          <details><summary>可以再加點嗎？</summary><p>可以，第一筆送出後購物車會清空，桌號與會員 Session 保留。</p></details>
          <details><summary>店家會收到訂單嗎？</summary><p>會，示範後台可以接單並更新製作與出餐狀態。</p></details>
          <details><summary>付款是真的嗎？</summary><p>不是。本 Demo 只測試現場付款確認流程，不會實際扣款。</p></details>
        </section>
      </main>

      <footer className="beef-demo-footer"><div><strong>百工牛肉麵</strong><p>創百業 QR 點餐功能示範環境</p></div><div><CheckCircle weight="fill"/> 創百業智慧鏈 QR 手機點餐示範<br/><small>非實際營業店家</small></div></footer>
    </div>
  );
}
