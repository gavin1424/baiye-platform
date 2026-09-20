import { ArrowRight, BowlFood, Clock, MapPin, QrCode, Storefront } from "@phosphor-icons/react";
import "../beef-noodle-demo.css";

const ORDERING_CODE = "TlTgDC3Wh5xo61yT1WWbPnJK9GZt_o4y";
const ORDERING_URL = `https://baiyeconnect.com/#/q/${ORDERING_CODE}`;
const SIGNATURE_BEEF_NOODLE_PHOTO = "/assets/beef-noodle-menu/signature-braised-beef-noodles.webp";

const signatureMenu = [
  { name: "招牌紅燒牛肉麵", note: "紅燒湯頭・牛肉", price: 180, image: SIGNATURE_BEEF_NOODLE_PHOTO },
  { name: "半筋半肉牛肉麵", note: "牛筋與牛肉一次滿足", price: 220, image: "/assets/beef-noodle-menu/half-tendon-beef-noodles.webp" },
  { name: "清燉牛肉麵", note: "清爽湯頭・牛肉", price: 190, image: "/assets/beef-noodle-menu/clear-broth-beef-noodles.webp" },
  { name: "紅油牛肉乾拌麵", note: "香辣紅油・牛肉", price: 160, image: "/assets/beef-noodle-menu/chili-beef-dry-noodles.webp" },
  { name: "滷蛋", note: "香滷入味", price: 20, image: "/assets/beef-noodle-menu/braised-egg.webp" },
  { name: "燙青菜", note: "清爽時蔬", price: 50, image: "/assets/beef-noodle-menu/blanched-greens.webp" },
];

const menuGroups = [
  { title: "牛肉麵", items: "招牌紅燒・半筋半肉・滿滿牛肉・清燉・牛筋" },
  { title: "乾麵／拌麵", items: "紅油牛肉乾拌麵・麻醬麵・紅燒牛肉燴飯" },
  { title: "小菜", items: "滷蛋・燙青菜・滷豆干・涼拌小黃瓜・牛肚拼盤" },
  { title: "湯品", items: "牛肉湯・貢丸湯・酸辣湯" },
  { title: "飲品", items: "古早味紅茶・冬瓜茶・無糖茶・梅子冰茶" },
];

export function BeefNoodleDemoPage() {
  return (
    <div className="beef-site">
      <header className="beef-header">
        <a className="beef-brand" href="#top" aria-label="百工牛肉麵首頁">
          <span className="beef-brand-mark"><BowlFood weight="fill" /></span>
          <span><strong>百工牛肉麵</strong><small>牛肉麵・小菜・湯品</small></span>
        </a>
        <nav aria-label="網站導覽"><a href="#signature">招牌推薦</a><a href="#about">關於我們</a><a href="#menu">完整菜單</a></nav>
        <a className="beef-button beef-button-small" href={ORDERING_URL}>立即點餐</a>
      </header>

      <main id="top">
        <section className="beef-hero">
          <img src={SIGNATURE_BEEF_NOODLE_PHOTO} alt="百工牛肉麵招牌紅燒牛肉麵" fetchPriority="high" />
          <div className="beef-hero-overlay" />
          <div className="beef-hero-copy"><span>百工牛肉麵</span><h1>一碗好麵，<br />簡單上桌。</h1><p>牛肉麵・乾麵・拌麵・小菜・湯品・飲品</p><a className="beef-button" href={ORDERING_URL}>立即點餐 <ArrowRight /></a></div>
        </section>

        <section id="signature" className="beef-section">
          <div className="beef-heading"><span>招牌推薦</span><h2>今天，想吃哪一碗？</h2><p>暖湯、好麵，再配一份喜歡的小菜。</p></div>
          <div className="beef-menu-grid">{signatureMenu.map((item) => <article key={item.name}><img src={item.image} alt={item.name} loading="lazy" /><div><h3>{item.name}</h3><p>{item.note}</p><strong>NT${item.price}</strong></div></article>)}</div>
          <div className="beef-center"><a className="beef-button" href={ORDERING_URL}>查看完整菜單 <ArrowRight /></a></div>
        </section>

        <section className="beef-order-callout"><div><QrCode weight="duotone" /><span>手機線上點餐</span><h2>選好餐點，輕鬆送出訂單</h2><p>不用下載 App，手機開啟菜單即可點餐。</p></div><a className="beef-button beef-button-light" href={ORDERING_URL}>開始點餐 <ArrowRight /></a></section>

        <section id="about" className="beef-section beef-about">
          <div className="beef-about-photo"><img src="/assets/beef-noodle-menu/extra-beef-noodles.webp" alt="滿滿牛肉麵" loading="lazy" /></div>
          <div><span className="beef-eyebrow">關於百工牛肉麵</span><h2>一頓踏實的台灣麵食</h2><p>百工牛肉麵提供牛肉麵、乾麵與拌麵，搭配小菜、湯品和飲品。現在也能直接使用手機查看菜單與線上點餐。</p><div className="beef-facts"><span><Storefront /> 多樣麵食與小菜</span><span><QrCode /> 手機線上點餐</span></div></div>
        </section>

        <section id="menu" className="beef-section beef-full-menu">
          <div className="beef-heading"><span>完整菜單</span><h2>從招牌牛肉麵到清爽小菜</h2></div>
          <div className="beef-menu-groups">{menuGroups.map((group) => <article key={group.title}><h3>{group.title}</h3><p>{group.items}</p></article>)}</div>
          <div className="beef-center"><a className="beef-button" href={ORDERING_URL}>看價格並點餐 <ArrowRight /></a></div>
        </section>

        <section className="beef-info"><div><Clock weight="duotone" /><h2>供應資訊</h2><p>品項供應狀態以線上菜單與現場公告為準。</p></div><div><MapPin weight="duotone" /><h2>點餐方式</h2><p>掃描店內 QR Code，或直接開啟線上菜單。</p></div></section>
      </main>

      <footer className="beef-footer"><div><strong>百工牛肉麵</strong><p>牛肉麵・乾麵・拌麵・小菜・湯品・飲品</p></div><small>Powered by 創百業智慧鏈</small></footer>
    </div>
  );
}
