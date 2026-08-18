import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  FishSimple,
  HandbagSimple,
  MapPin,
  Package,
  ShoppingBag,
  Sparkle,
  Storefront,
} from "@phosphor-icons/react";
import { Navigate, Link, useParams } from "react-router-dom";
import type { CSSProperties, ReactNode } from "react";
import { PublicLayout, SectionHeading } from "../components";

type DemoSite = {
  slug: string;
  industry: string;
  brand: string;
  english: string;
  kicker: string;
  tagline: string;
  intro: string;
  location: string;
  accent: string;
  accentDeep: string;
  background: string;
  ink: string;
  hero: string;
  gallery: string[];
  stats: [string, string][];
  services: { title: string; text: string }[];
  highlights: { title: string; meta: string; price: string }[];
  storyTitle: string;
  story: string;
  proof: string[];
  cta: string;
  icon: (props: { size?: number; weight?: "regular" | "duotone" | "fill" | "bold" }) => ReactNode;
};

const img = (id: string, width = 1600) =>
  `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=86`;

export const demoSites: DemoSite[] = [
  {
    slug: "beauty-muyan",
    industry: "美妝保養",
    brand: "沐妍研所",
    english: "MUYAN LAB",
    kicker: "SKIN FIRST · BEAUTY SECOND",
    tagline: "讓保養回到肌膚真正需要的節奏",
    intro: "從肌膚檢測、客製臉部管理到居家保養選物，沐妍用更安靜、更透明的方式，陪你找回穩定又自然的好膚況。",
    location: "台北・大安",
    accent: "#c77879",
    accentDeep: "#7d4549",
    background: "#fff9f6",
    ink: "#37292b",
    hero: img("photo-1596462502278-27bfdc403348"),
    gallery: [
      img("photo-1522335789203-aabd1fc54bc9"),
      img("photo-1570172619644-dfd03ed5d881"),
      img("photo-1598440947619-2c35fc9aa908"),
    ],
    stats: [["4.9 / 5", "顧客評分"], ["1,280+", "肌膚管理紀錄"], ["92%", "三個月回訪率"]],
    services: [
      { title: "肌膚檢測與顧問", text: "先看膚況與生活習慣，再決定真正需要的保養步驟。" },
      { title: "客製臉部管理", text: "依敏弱、乾燥、粉刺與膚色需求調整療程，不做制式套餐。" },
      { title: "保養選物", text: "只留下成分、使用感與來源都經過篩選的日常保養品。" },
    ],
    highlights: [
      { title: "透亮平衡護理", meta: "90 min · 初次肌膚檢測包含", price: "NT$2,680" },
      { title: "敏弱舒緩管理", meta: "75 min · 低刺激修護", price: "NT$2,280" },
      { title: "居家保養諮詢", meta: "30 min · 可線上", price: "NT$680" },
    ],
    storyTitle: "我們不追求立刻變白，而是讓肌膚慢慢變穩定。",
    story: "沐妍研所從一間兩床的小工作室開始，把每次膚況、使用產品與生活變化留下紀錄。所有服務都從『今天的肌膚需要什麼』出發，不推銷不必要的療程，也讓顧客知道每一個步驟的理由。",
    proof: ["一對一預約制", "療程與產品價格透明", "敏弱肌友善流程", "完整護理紀錄"],
    cta: "預約第一次肌膚檢測",
    icon: (props) => <Sparkle {...props} />,
  },
  {
    slug: "fashion-forme",
    industry: "服飾時尚",
    brand: "FORME 日常版型",
    english: "FORME STUDIO",
    kicker: "EVERYDAY FORM / 2026",
    tagline: "把每天都穿的衣服，做得更有版型",
    intro: "不追短暫流行，專注俐落比例、好搭配色系與可以重複穿很多次的材質。從通勤到週末，一套衣櫥就能完成。",
    location: "台中・西區",
    accent: "#151515",
    accentDeep: "#000000",
    background: "#f3f0ea",
    ink: "#111111",
    hero: img("photo-1483985988355-763728e1935b"),
    gallery: [
      img("photo-1496747611176-843222e1e57c"),
      img("photo-1515886657613-9f3515b0c78f"),
      img("photo-1445205170230-053b83016050"),
    ],
    stats: [["48H", "新品快速出貨"], ["36", "本季核心單品"], ["4.8 / 5", "版型滿意度"]],
    services: [
      { title: "本季女裝選品", text: "以版型、材質與搭配性篩選，每件都提供實穿比例與尺寸建議。" },
      { title: "一對一穿搭顧問", text: "依工作場景、身形與既有衣櫥，整理真正會穿到的搭配。" },
      { title: "品牌團購與企業制服", text: "提供團隊配色、尺寸統整、小量訂製與企業禮贈方案。" },
    ],
    highlights: [
      { title: "CUT 01 西裝外套", meta: "Coal / Oat · XS–L", price: "NT$3,980" },
      { title: "LINE 08 垂墜寬褲", meta: "Black / Stone · XS–XL", price: "NT$2,280" },
      { title: "BASE 03 重磅短袖", meta: "4 colors · unisex", price: "NT$1,280" },
    ],
    storyTitle: "少一點衣服，多一點真的會穿的選擇。",
    story: "FORME 把服飾網站做成一本會更新的型錄：清楚的尺寸、材質、搭配照與實穿說明，比大量促銷更重要。我們希望每一件被買回家的衣服，都能進入日常，而不是只存在衣櫃裡。",
    proof: ["實穿尺寸建議", "七日鑑賞退換", "每週兩次新品", "企業團購支援"],
    cta: "看本週 NEW FORM",
    icon: (props) => <HandbagSimple {...props} />,
  },
  {
    slug: "fishery-hailine",
    industry: "漁業水產",
    brand: "海線鮮研",
    english: "HAILINE SEAFOOD",
    kicker: "FROM HARBOR TO TABLE",
    tagline: "今天捕撈、今天處理，讓餐桌知道魚從哪裡來",
    intro: "東港與高雄港口合作團隊，提供當日鮮魚、餐飲規格分切、急速冷凍與批發供應。每批貨都有來源、處理時間與冷鏈紀錄。",
    location: "屏東・東港",
    accent: "#26c6da",
    accentDeep: "#073c55",
    background: "#eaf7f8",
    ink: "#073448",
    hero: img("photo-1535591273668-578e31182c4f"),
    gallery: [
      img("photo-1544943910-4c1dc44aab44"),
      img("photo-1544551763-46a013bb70d5"),
      img("photo-1574781330855-d0db8cc6a79c"),
    ],
    stats: [["05:30", "每日第一批進港"], ["0–4°C", "全程冷鏈"], ["72 家", "固定餐飲客戶"]],
    services: [
      { title: "當日鮮魚直送", text: "依漁獲與規格每日更新，餐廳、家庭皆可預訂產地直送。" },
      { title: "餐飲規格分切", text: "去鱗、去骨、定重、真空與標示一次完成，直接進廚房流程。" },
      { title: "長期批發供應", text: "依餐廳菜單與需求量建立週期供貨、替代魚種與價格機制。" },
    ],
    highlights: [
      { title: "東港當日鮮魚箱", meta: "3–4 種漁獲 · 約 3kg", price: "NT$2,680 起" },
      { title: "生食級規格包", meta: "真空分裝 · 批次追溯", price: "批發詢價" },
      { title: "餐廳週配方案", meta: "每週 2–6 次配送", price: "企業報價" },
    ],
    storyTitle: "新鮮不是一句廣告，是每一箱貨都說得出時間。",
    story: "海線鮮研把傳統魚貨交易裡最難說清楚的來源、規格與冷鏈做成透明資訊。餐廳知道今天收到什麼、哪裡來、什麼時間處理；家庭客也能看懂魚種、保存與料理方式。",
    proof: ["漁獲批次追溯", "0–4°C 冷鏈配送", "餐飲規格客製", "異常批次主動回報"],
    cta: "查看今日漁獲",
    icon: (props) => <FishSimple {...props} />,
  },
  {
    slug: "food-zaori",
    industry: "餐飲美食",
    brand: "灶日食堂",
    english: "ZAO RI KITCHEN",
    kicker: "TAIWANESE DAILY TABLE",
    tagline: "把熟悉的台灣味，煮成你會想再來一次的日常",
    intro: "以當季食材、家常火候與每日現做為核心的小食堂。午餐是一份剛好的定食，晚餐則適合幾個人坐下來，好好吃一桌菜。",
    location: "台北・中山",
    accent: "#c94b32",
    accentDeep: "#7e2f22",
    background: "#fff8eb",
    ink: "#40251e",
    hero: img("photo-1504674900247-0877df9cc836"),
    gallery: [
      img("photo-1540189549336-e6e99c3679fe"),
      img("photo-1515003197210-e0cd71810b5f"),
      img("photo-1569058242253-92a9c755a0ec"),
    ],
    stats: [["11:30", "每日午餐開灶"], ["12 道", "每季輪替菜色"], ["4.9 / 5", "熟客評分"]],
    services: [
      { title: "午間定食", text: "主菜、三樣小菜、湯與米飯，依季節每天保留一點變化。" },
      { title: "晚間合菜", text: "2–8 人共享菜單，可依忌口、聚餐與預算提前安排。" },
      { title: "企業餐盒與外燴", text: "會議、活動與品牌聚會皆可客製菜色、包裝與配送。" },
    ],
    highlights: [
      { title: "醬燒午仔魚定食", meta: "本週人氣 · 每日限量", price: "NT$360" },
      { title: "三杯杏鮑菇雞", meta: "晚餐共享菜", price: "NT$420" },
      { title: "企業季節餐盒", meta: "20 份起訂", price: "NT$280 起" },
    ],
    storyTitle: "我們想做的不是打卡名店，是一間你想到晚餐就會回來的店。",
    story: "灶日每天從市場、供應商與熟客的口味開始決定菜單。保留台灣家常菜熟悉的味道，再把油、鹹度與份量整理得更適合現在的日常。網站也像菜單一樣，直接、溫暖、看得到今天值得吃什麼。",
    proof: ["每日現做", "當季食材", "團體訂位", "企業餐盒配送"],
    cta: "看今天的菜單",
    icon: (props) => <Storefront {...props} />,
  },
  {
    slug: "retail-dailypicks",
    industry: "零售選物",
    brand: "好日選物",
    english: "DAILY PICKS",
    kicker: "THINGS FOR BETTER DAYS",
    tagline: "好用、耐看、剛剛好的生活選物",
    intro: "從餐桌、收納、香氣到日常小工具，我們挑選不需要太多說明、拿回家就會一直使用的東西，也與台灣小品牌一起做季節限定企劃。",
    location: "新北・板橋",
    accent: "#45705a",
    accentDeep: "#294737",
    background: "#f7f3e9",
    ink: "#24352d",
    hero: img("photo-1441986300917-64674bd600d8"),
    gallery: [
      img("photo-1472851294608-062f824d29cc"),
      img("photo-1528698827591-e19ccd7bc23d"),
      img("photo-1512436991641-6745cdb1723f"),
    ],
    stats: [["120+", "常態選物"], ["24", "台灣合作品牌"], ["48H", "現貨快速出貨"]],
    services: [
      { title: "生活選物零售", text: "器皿、收納、香氛與小家電，以耐用與好搭配為第一篩選。" },
      { title: "禮物與企業禮贈", text: "依預算、節日與品牌調性搭配禮盒，可小量客製卡片與包裝。" },
      { title: "品牌快閃合作", text: "提供店內陳列、線上曝光與聯名企劃，讓新品牌先被一群對的人看見。" },
    ],
    highlights: [
      { title: "日常早餐器皿組", meta: "陶器 3 件 · 台灣製", price: "NT$1,480" },
      { title: "木質收納托盤", meta: "Oak / Walnut", price: "NT$980" },
      { title: "企業季節禮盒", meta: "30 組起 · 可客製", price: "NT$1,200 起" },
    ],
    storyTitle: "選物不是把東西放在一起，而是替生活先做一次篩選。",
    story: "好日選物相信零售網站不只要能賣，也要讓顧客快速理解『為什麼值得買』。我們把材質、尺寸、使用情境與品牌故事放在價格旁邊，讓每件商品都有清楚的位置，而不是淹沒在無止盡的商品牆。",
    proof: ["現貨 48 小時出貨", "台灣品牌優先", "企業禮贈客製", "門市取貨"],
    cta: "逛本週好物",
    icon: (props) => <ShoppingBag {...props} />,
  },
];

function DemoStyles() {
  return (
    <style>{`
      .demo-directory-hero{padding:72px 0 44px;background:linear-gradient(135deg,#f2f7f5,#fff8ef)}
      .demo-directory-hero h1{max-width:760px;font-size:clamp(2.4rem,5vw,4.8rem);line-height:1.02;margin:14px 0 18px;letter-spacing:-.05em}
      .demo-directory-hero p{max-width:720px;font-size:1.08rem;color:#5d6b65}
      .demo-site-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:18px}
      .demo-site-card{display:flex;flex-direction:column;background:#fff;border:1px solid #e8ebe9;border-radius:24px;overflow:hidden;box-shadow:0 14px 40px rgba(26,55,42,.07);transition:.25s ease;color:#203229}
      .demo-site-card:hover{transform:translateY(-5px);box-shadow:0 20px 55px rgba(26,55,42,.12)}
      .demo-site-card img{width:100%;aspect-ratio:4/5;object-fit:cover}
      .demo-site-card-copy{padding:20px;display:flex;flex-direction:column;gap:8px;min-height:210px}
      .demo-site-card-copy small{font-weight:800;letter-spacing:.08em;color:#6b7b73}
      .demo-site-card-copy h3{font-size:1.35rem;margin:0}
      .demo-site-card-copy p{font-size:.92rem;line-height:1.6;color:#63716b;margin:0;flex:1}
      .demo-site-card-copy span{display:flex;align-items:center;gap:6px;font-weight:800}
      .demo-site-shell{--demo-accent:#356;--demo-deep:#234;--demo-bg:#fafafa;--demo-ink:#222;min-height:100vh;background:var(--demo-bg);color:var(--demo-ink);font-family:Inter,"Noto Sans TC",system-ui,sans-serif}
      .demo-site-shell *{box-sizing:border-box}
      .demo-platform-bar{height:42px;padding:0 5vw;display:flex;align-items:center;justify-content:space-between;background:#10231b;color:#fff;font-size:.82rem;letter-spacing:.04em}
      .demo-platform-bar a{color:#fff;display:flex;align-items:center;gap:7px;font-weight:800}
      .demo-brand-nav{height:78px;padding:0 5vw;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid color-mix(in srgb,var(--demo-ink) 13%,transparent);background:color-mix(in srgb,var(--demo-bg) 94%,white);position:sticky;top:0;z-index:8;backdrop-filter:blur(12px)}
      .demo-brand-lockup{display:flex;align-items:center;gap:14px}
      .demo-brand-lockup span{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:var(--demo-accent);color:#fff}
      .demo-brand-lockup strong{display:block;font-size:1.08rem;letter-spacing:.03em}
      .demo-brand-lockup small{display:block;font-size:.68rem;letter-spacing:.18em;margin-top:2px;opacity:.65}
      .demo-brand-nav nav{display:flex;align-items:center;gap:28px;font-size:.88rem;font-weight:700}
      .demo-brand-nav nav a{color:var(--demo-ink)}
      .demo-brand-nav .demo-nav-cta{padding:11px 17px;border-radius:999px;background:var(--demo-deep);color:#fff}
      .demo-hero{min-height:680px;display:grid;grid-template-columns:1.02fr .98fr;align-items:stretch}
      .demo-hero-copy{padding:9vw 7vw 7vw 8vw;display:flex;flex-direction:column;justify-content:center;align-items:flex-start}
      .demo-kicker{font-size:.75rem;letter-spacing:.2em;font-weight:900;color:var(--demo-accent);margin-bottom:24px}
      .demo-hero h1{font-size:clamp(3rem,6.2vw,6.8rem);line-height:.94;letter-spacing:-.055em;margin:0 0 28px;max-width:850px}
      .demo-hero-copy>p{max-width:650px;font-size:1.05rem;line-height:1.85;opacity:.78;margin:0}
      .demo-hero-actions{display:flex;gap:12px;flex-wrap:wrap;margin-top:34px}
      .demo-primary-btn,.demo-secondary-btn{display:inline-flex;align-items:center;gap:8px;padding:14px 20px;border-radius:999px;font-weight:850;border:1px solid var(--demo-deep)}
      .demo-primary-btn{background:var(--demo-deep);color:#fff}
      .demo-secondary-btn{color:var(--demo-deep);background:transparent}
      .demo-hero-media{position:relative;min-height:560px;overflow:hidden}
      .demo-hero-media img{width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
      .demo-hero-badge{position:absolute;right:28px;bottom:28px;max-width:230px;padding:18px 20px;border-radius:18px;background:rgba(255,255,255,.9);color:#1c2823;backdrop-filter:blur(14px);box-shadow:0 18px 48px rgba(0,0,0,.15)}
      .demo-hero-badge strong{display:block;margin-bottom:5px}
      .demo-hero-badge span{font-size:.82rem;color:#5b6862}
      .demo-stats{display:grid;grid-template-columns:repeat(3,1fr);padding:0 7vw;background:var(--demo-deep);color:#fff}
      .demo-stat{padding:32px;border-right:1px solid rgba(255,255,255,.15)}
      .demo-stat:last-child{border-right:0}.demo-stat strong{display:block;font-size:2rem}.demo-stat span{font-size:.8rem;opacity:.7}
      .demo-section{padding:100px 7vw}.demo-section-head{display:flex;justify-content:space-between;gap:30px;align-items:end;margin-bottom:42px}
      .demo-section-head small{font-weight:900;letter-spacing:.15em;color:var(--demo-accent)}
      .demo-section-head h2{font-size:clamp(2.2rem,4vw,4.5rem);line-height:1;letter-spacing:-.045em;margin:8px 0 0;max-width:760px}
      .demo-section-head p{max-width:460px;line-height:1.8;opacity:.7}
      .demo-service-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px}
      .demo-service{padding:30px;border:1px solid color-mix(in srgb,var(--demo-ink) 13%,transparent);background:color-mix(in srgb,var(--demo-bg) 87%,white);border-radius:22px;min-height:230px}
      .demo-service b{display:block;font-size:.75rem;letter-spacing:.14em;color:var(--demo-accent);margin-bottom:30px}.demo-service h3{font-size:1.4rem;margin:0 0 12px}.demo-service p{line-height:1.75;opacity:.68;margin:0}
      .demo-highlight-grid{display:grid;grid-template-columns:1.15fr .85fr .85fr;gap:14px}
      .demo-highlight{position:relative;min-height:440px;overflow:hidden;border-radius:26px;background:#ddd;color:#fff}
      .demo-highlight img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.demo-highlight:after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,rgba(0,0,0,.72),rgba(0,0,0,.02) 70%)}
      .demo-highlight-copy{position:absolute;z-index:2;left:24px;right:24px;bottom:22px}.demo-highlight-copy small{opacity:.8}.demo-highlight-copy h3{font-size:1.4rem;margin:4px 0 6px}.demo-highlight-copy strong{font-size:1rem}
      .demo-story{display:grid;grid-template-columns:.9fr 1.1fr;gap:70px;align-items:center;background:var(--demo-deep);color:#fff;padding:110px 8vw}
      .demo-story-gallery{display:grid;grid-template-columns:1fr 1fr;gap:12px}.demo-story-gallery img{width:100%;height:260px;object-fit:cover;border-radius:18px}.demo-story-gallery img:first-child{grid-column:1/3;height:330px}
      .demo-story-copy small{letter-spacing:.15em;font-weight:900;color:var(--demo-accent)}.demo-story-copy h2{font-size:clamp(2.4rem,4.5vw,5rem);line-height:1;letter-spacing:-.05em;margin:16px 0 26px}.demo-story-copy p{line-height:1.9;opacity:.78;font-size:1.02rem}
      .demo-proof-list{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:30px}.demo-proof-list span{display:flex;align-items:center;gap:8px;font-weight:700;font-size:.88rem}
      .demo-contact{padding:100px 7vw;text-align:center}.demo-contact small{font-weight:900;letter-spacing:.15em;color:var(--demo-accent)}.demo-contact h2{font-size:clamp(2.6rem,5vw,5.5rem);line-height:.98;letter-spacing:-.05em;max-width:850px;margin:16px auto 28px}.demo-contact p{max-width:650px;margin:0 auto 32px;line-height:1.8;opacity:.68}
      .demo-mini-footer{padding:32px 7vw;display:flex;justify-content:space-between;gap:20px;border-top:1px solid color-mix(in srgb,var(--demo-ink) 12%,transparent);font-size:.8rem;opacity:.75}
      .demo-fashion .demo-brand-nav,.demo-fashion .demo-service,.demo-fashion .demo-highlight,.demo-fashion .demo-story-gallery img{border-radius:0}.demo-fashion .demo-hero{grid-template-columns:.8fr 1.2fr}.demo-fashion .demo-hero h1{text-transform:uppercase;font-weight:900}.demo-fashion .demo-primary-btn,.demo-fashion .demo-secondary-btn{border-radius:0}
      .demo-fishery .demo-hero-copy{background:#062f43;color:#fff}.demo-fishery .demo-kicker{color:#66d9e8}.demo-fishery .demo-secondary-btn{border-color:#fff;color:#fff}.demo-fishery .demo-primary-btn{background:#31bfd1;border-color:#31bfd1;color:#062f43}.demo-fishery .demo-hero-badge{border-radius:8px}.demo-fishery .demo-service{border-radius:10px}
      .demo-food h1,.demo-food h2{font-family:Georgia,"Noto Serif TC",serif;font-weight:700}.demo-food .demo-hero{grid-template-columns:1fr 1fr}.demo-food .demo-service,.demo-food .demo-highlight,.demo-food .demo-story-gallery img{border-radius:8px}
      .demo-retail .demo-hero{grid-template-columns:1.15fr .85fr}.demo-retail .demo-hero-media{margin:36px 5vw 36px 0;border-radius:30px}.demo-retail .demo-service{background:#fff}
      @media(max-width:1100px){.demo-site-grid{grid-template-columns:repeat(2,1fr)}.demo-brand-nav nav a:not(.demo-nav-cta){display:none}.demo-hero{grid-template-columns:1fr}.demo-hero-copy{padding:90px 7vw 70px}.demo-hero-media{min-height:520px}.demo-service-grid,.demo-highlight-grid{grid-template-columns:1fr 1fr}.demo-highlight:first-child{grid-column:1/3}.demo-story{grid-template-columns:1fr;gap:50px}.demo-fashion .demo-hero,.demo-food .demo-hero,.demo-retail .demo-hero{grid-template-columns:1fr}.demo-retail .demo-hero-media{margin:0}}
      @media(max-width:680px){.demo-site-grid{grid-template-columns:1fr}.demo-directory-hero{padding-top:48px}.demo-brand-nav{height:68px}.demo-brand-nav nav{gap:0}.demo-brand-lockup span{width:36px;height:36px}.demo-hero{min-height:auto}.demo-hero-copy{padding:70px 22px 54px}.demo-hero h1{font-size:clamp(2.7rem,15vw,4.6rem)}.demo-hero-media{min-height:430px}.demo-hero-badge{left:18px;right:18px;bottom:18px;max-width:none}.demo-stats{grid-template-columns:1fr;padding:0 22px}.demo-stat{border-right:0;border-bottom:1px solid rgba(255,255,255,.15);padding:24px 4px}.demo-section{padding:72px 22px}.demo-section-head{display:block}.demo-service-grid,.demo-highlight-grid{grid-template-columns:1fr}.demo-highlight:first-child{grid-column:auto}.demo-highlight{min-height:390px}.demo-story{padding:72px 22px}.demo-story-gallery img,.demo-story-gallery img:first-child{height:220px}.demo-contact{padding:72px 22px}.demo-proof-list{grid-template-columns:1fr}.demo-mini-footer{padding:26px 22px;display:block}.demo-mini-footer span{display:block;margin-top:8px}}
    `}</style>
  );
}

export function DemoSitesPage() {
  return (
    <PublicLayout>
      <DemoStyles />
      <section className="demo-directory-hero">
        <div className="container">
          <span className="eyebrow">五大產業示範網站</span>
          <h1>不是同一個模板換照片，而是讓每個行業長得像自己的生意。</h1>
          <p>美妝、服飾、漁業、美食與零售五種商業情境，示範創百業智慧鏈如何把品牌、服務、商品與信任資訊整理成真正能拿去接客的網站。</p>
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHeading
            eyebrow="INDUSTRY SHOWCASE"
            title="挑一個最接近你的行業看看"
            description="每個示範站都有獨立品牌、內容架構與視覺風格，手機與桌機都可瀏覽。"
          />
          <div className="demo-site-grid">
            {demoSites.map((site) => (
              <Link key={site.slug} to={`/demo-sites/${site.slug}`} className="demo-site-card">
                <img src={site.hero} alt={`${site.brand} ${site.industry}示範網站`} loading="lazy" />
                <div className="demo-site-card-copy">
                  <small>{site.industry}</small>
                  <h3>{site.brand}</h3>
                  <p>{site.tagline}</p>
                  <span>進入示範站 <ArrowRight /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function IndustryDemoSitePage() {
  const { slug } = useParams();
  const site = demoSites.find((item) => item.slug === slug);
  if (!site) return <Navigate to="/demo-sites" replace />;
  const SiteIcon = site.icon;
  const themeClass =
    site.slug.includes("fashion")
      ? "demo-fashion"
      : site.slug.includes("fishery")
        ? "demo-fishery"
        : site.slug.includes("food")
          ? "demo-food"
          : site.slug.includes("retail")
            ? "demo-retail"
            : "demo-beauty";
  const vars = {
    "--demo-accent": site.accent,
    "--demo-deep": site.accentDeep,
    "--demo-bg": site.background,
    "--demo-ink": site.ink,
  } as CSSProperties;

  return (
    <div className={`demo-site-shell ${themeClass}`} style={vars}>
      <DemoStyles />
      <div className="demo-platform-bar">
        <span>創百業智慧鏈 · 產業示範網站</span>
        <Link to="/demo-sites"><ArrowLeft /> 返回五大示範</Link>
      </div>
      <header className="demo-brand-nav">
        <Link to={`/demo-sites/${site.slug}`} className="demo-brand-lockup">
          <span>{SiteIcon({ size: 22, weight: "duotone" })}</span>
          <div>
            <strong>{site.brand}</strong>
            <small>{site.english}</small>
          </div>
        </Link>
        <nav>
          <a href="#services">服務</a>
          <a href="#featured">精選</a>
          <a href="#story">品牌故事</a>
          <a href="#contact" className="demo-nav-cta">聯絡我們</a>
        </nav>
      </header>

      <main>
        <section className="demo-hero">
          <div className="demo-hero-copy">
            <span className="demo-kicker">{site.kicker}</span>
            <h1>{site.tagline}</h1>
            <p>{site.intro}</p>
            <div className="demo-hero-actions">
              <a href="#featured" className="demo-primary-btn">{site.cta}<ArrowRight /></a>
              <a href="#story" className="demo-secondary-btn">認識品牌</a>
            </div>
          </div>
          <div className="demo-hero-media">
            <img src={site.hero} alt={`${site.brand} 品牌主視覺`} />
            <div className="demo-hero-badge">
              <strong>{site.industry}示範站</strong>
              <span><MapPin /> {site.location} · 創百業智慧鏈商家網站範例</span>
            </div>
          </div>
        </section>

        <section className="demo-stats" aria-label="品牌重點數據">
          {site.stats.map(([value, label]) => (
            <div key={label} className="demo-stat">
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>

        <section id="services" className="demo-section">
          <div className="demo-section-head">
            <div>
              <small>WHAT WE DO</small>
              <h2>{site.industry}不是只有介紹，更要讓客人知道下一步能買什麼、怎麼合作。</h2>
            </div>
            <p>把最常被問的服務、適合對象與合作方式直接放在網站上，減少來回說明，也讓專業更容易被理解。</p>
          </div>
          <div className="demo-service-grid">
            {site.services.map((service, index) => (
              <article className="demo-service" key={service.title}>
                <b>0{index + 1}</b>
                <h3>{service.title}</h3>
                <p>{service.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="featured" className="demo-section">
          <div className="demo-section-head">
            <div>
              <small>FEATURED</small>
              <h2>把最值得成交的商品與服務放到第一眼。</h2>
            </div>
            <p>示範站使用不同情境圖、價格與資訊層級，讓訪客不用猜，也能快速理解主打內容。</p>
          </div>
          <div className="demo-highlight-grid">
            {site.highlights.map((item, index) => (
              <article className="demo-highlight" key={item.title}>
                <img src={site.gallery[index]} alt={item.title} loading="lazy" />
                <div className="demo-highlight-copy">
                  <small>{item.meta}</small>
                  <h3>{item.title}</h3>
                  <strong>{item.price}</strong>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="story" className="demo-story">
          <div className="demo-story-gallery">
            {site.gallery.map((image, index) => (
              <img src={image} alt={`${site.brand} 品牌情境 ${index + 1}`} key={image} loading="lazy" />
            ))}
          </div>
          <div className="demo-story-copy">
            <small>OUR STORY</small>
            <h2>{site.storyTitle}</h2>
            <p>{site.story}</p>
            <div className="demo-proof-list">
              {site.proof.map((item) => (
                <span key={item}><CheckCircle weight="fill" /> {item}</span>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="demo-contact">
          <small>READY TO START</small>
        <h2>如果你的商家也想長成這樣，創百業智慧鏈可以直接從行業需求開始。</h2>
          <p>這是一個可實際點開的商家示範網站。正式商家上架後，可再替換品牌名稱、圖片、商品、聯絡方式與內容。</p>
          <Link to="/pricing" className="demo-primary-btn">商家上架 NT$18,000 <ArrowRight /></Link>
        </section>
      </main>

      <footer className="demo-mini-footer">
        <strong>{site.brand} · {site.english}</strong>
        <span>創百業智慧鏈產業示範網站 · 此頁為展示用虛構品牌</span>
      </footer>
    </div>
  );
}
