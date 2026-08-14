import {
  ArrowRight,
  Buildings,
  ChartLineUp,
  Check,
  CirclesFour,
  GlobeHemisphereWest,
  Handshake,
  Lightning,
  MagnifyingGlass,
  Palette,
  Plus,
  SealCheck,
  Storefront,
  UsersThree,
} from "@phosphor-icons/react";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  BusinessCard,
  IndustryIcon,
  NeedCard,
  ProductCard,
  PublicLayout,
  SearchBar,
  SectionHeading,
} from "../components";
import { businesses, categories, collaborationNeeds, faqs, platformStats, products } from "../data";
import { useAppStore } from "../store";

const popularCategories = [
  ["居家修繕", "1,280+ 位專家"],
  ["工程營造", "860+ 家團隊"],
  ["水電冷氣", "1,540+ 位師傅"],
  ["設計裝潢", "1,120+ 家工作室"],
  ["網站與程式", "980+ 位夥伴"],
  ["餐飲美食", "2,360+ 家商家"],
  ["食品供應", "740+ 家供應商"],
  ["攝影錄影", "630+ 位創作者"],
];

export function HomePage() {
  const [openFaq, setOpenFaq] = useState(0);
  const { session } = useAppStore();
  const siteEditorPath =
    session.role === "guest" ? "/register" : session.role === "admin" ? "/admin" : "/dashboard/site-editor";

  return (
    <PublicLayout>
      <section className="hero-section">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow hero-eyebrow">
              <CirclesFour weight="fill" />
              全台百工百業的合作起點
            </span>
            <h1>
              讓你的專業，
              <br />
              <em>被更多人看見</em>
            </h1>
            <p>建立自己的商家網站、展示服務與作品，找到客戶、供應商與跨業合作夥伴。</p>
            <div className="hero-actions">
              <Link to={siteEditorPath} className="btn btn-primary btn-lg">
                建立我的網站
                <ArrowRight />
              </Link>
              <Link to="/businesses" className="btn btn-outline btn-lg">
                尋找合作夥伴
              </Link>
            </div>
            <div className="hero-proof">
              <div className="avatar-stack" aria-label="平台商家社群">
                {businesses.slice(1, 5).map((business) => (
                  <span key={business.id} style={{ background: business.accent }}>
                    {business.name.slice(0, 1)}
                  </span>
                ))}
              </div>
              <div>
                <strong>本週新增 286 家商家</strong>
                <span>
                  <SealCheck weight="fill" /> 資料驗證・真人服務
                </span>
              </div>
            </div>
          </div>
          <div className="hero-visual">
            <img
              src={`${import.meta.env.BASE_URL}assets/hero-industry-collage.jpg`}
              alt="木工、甜點、水電冷氣、攝影設計與食品物流等台灣在地產業工作者"
              fetchPriority="high"
            />
            <div className="floating-business-card">
              <span>
                <Storefront weight="duotone" />
              </span>
              <div>
                <small>剛剛發布網站</small>
                <strong>木日木工工作室</strong>
              </div>
              <SealCheck weight="fill" />
            </div>
            <div className="floating-match-card">
              <Handshake weight="duotone" />
              <div>
                <strong>媒合成功</strong>
                <span>食品供應 × 連鎖餐飲</span>
              </div>
            </div>
          </div>
        </div>
        <div className="container hero-search-wrap">
          <SearchBar />
          <div className="trending-searches">
            <span>熱門搜尋：</span>
            {["冷氣清洗", "品牌設計", "食品批發", "商業攝影", "網站製作"].map((item) => (
              <Link key={item} to={`/businesses?q=${encodeURIComponent(item)}`}>
                {item}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="platform-stats-section" aria-label="平台數據">
        <div className="container stats-ribbon">
          {platformStats.map((stat, index) => {
            const icons = [Storefront, CirclesFour, Handshake, Lightning];
            const Icon = icons[index];
            return (
              <div key={stat.label}>
                <span>
                  <Icon weight="duotone" />
                </span>
                <strong>{stat.value}</strong>
                <small>{stat.label}</small>
              </div>
            );
          })}
        </div>
      </section>

      <section className="section section-categories">
        <div className="container">
          <SectionHeading
            eyebrow="探索專業"
            title="從行業出發，找到對的人"
            description="從在地職人到企業供應商，依產業與服務方式快速探索。"
            action={{ label: "查看全部 26 類", to: "/categories" }}
          />
          <div className="category-grid">
            {popularCategories.map(([category, count]) => (
              <Link key={category} to={`/businesses?category=${category}`} className="category-tile">
                <span>
                  <IndustryIcon category={category} size={27} weight="duotone" />
                </span>
                <strong>{category}</strong>
                <small>{count}</small>
                <ArrowRight />
              </Link>
            ))}
          </div>
          <div className="category-marquee" aria-label="更多分類">
            {categories.slice(8).map((category) => (
              <Link key={category} to={`/businesses?category=${category}`}>
                {category}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section section-featured-businesses">
        <div className="container">
          <SectionHeading
            eyebrow="本週精選"
            title="值得認識的專業商家"
            description="通過資料驗證、回覆積極，並持續累積真實合作評價。"
            action={{ label: "探索更多商家", to: "/businesses" }}
          />
          <div className="featured-business-layout">
            <BusinessCard business={businesses[0]} view="card" />
            <div className="business-side-list">
              {businesses.slice(1, 4).map((business) => (
                <BusinessCard key={business.id} business={business} view="list" />
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="section section-needs">
        <div className="container">
          <div className="needs-intro">
            <span className="eyebrow">合作需求廣場</span>
            <h2>商機正在發生，下一個合作就是你</h2>
            <p>企業採購、專案外包、通路合作與短期支援，每一則需求都能直接提案。</p>
            <Link to="/collaborations" className="btn btn-light btn-lg">
              瀏覽所有合作需求
              <ArrowRight />
            </Link>
          </div>
          <div className="needs-stack">
            {collaborationNeeds.slice(0, 3).map((need) => (
              <NeedCard key={need.id} need={need} compact />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-marketplace">
        <div className="container">
          <SectionHeading
            eyebrow="商品與服務市集"
            title="從一項服務，到長期供應"
            description="比較規格、價格與供應商評價，加入詢價單後一次提出需求。"
            action={{ label: "逛完整市集", to: "/marketplace" }}
          />
          <div className="product-grid home-product-grid">
            {products.slice(0, 4).map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-success">
        <div className="container success-story-card">
          <div className="success-image">
            <img
              src={`${import.meta.env.BASE_URL}assets/success-collaboration.jpg`}
              alt="木作工作室老闆與品牌設計師討論材料與包裝的合作現場"
              loading="lazy"
            />
            <span className="success-badge">
              <Check weight="bold" />
              合作完成
            </span>
          </div>
          <div className="success-copy">
            <span className="eyebrow">真實合作案例</span>
            <blockquote>「一個專業頁面，讓我們從被搜尋，到成為長期合作夥伴。」</blockquote>
            <p>
              木日木工在平台上遇見島嶼品牌設計，從單次店面陳列案開始，進一步共同開發品牌家具系列，半年內完成 6
              次跨業合作。
            </p>
            <div className="success-metrics">
              <div>
                <strong>6 次</strong>
                <span>持續合作</span>
              </div>
              <div>
                <strong>+42%</strong>
                <span>企業詢問</span>
              </div>
              <div>
                <strong>18 天</strong>
                <span>首次媒合</span>
              </div>
            </div>
            <Link to="/success-stories" className="text-link">
              閱讀更多合作故事
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-how">
        <div className="container">
          <SectionHeading
            eyebrow="三步開始"
            title="把專業帶上線，今天就能開始"
            description="不需要懂程式，跟著步驟完成網站，接著開始曝光與合作。"
          />
          <div className="steps-grid">
            {[
              {
                number: "01",
                icon: Storefront,
                title: "建立專屬網站",
                text: "選擇版型，填入介紹、服務、作品與聯絡方式。",
              },
              {
                number: "02",
                icon: GlobeHemisphereWest,
                title: "發布並累積信任",
                text: "完成認證、分享網址，讓搜尋者快速理解你的專業。",
              },
              {
                number: "03",
                icon: Handshake,
                title: "開始媒合合作",
                text: "接收詢價、回覆需求，與客戶和跨業夥伴展開合作。",
              },
            ].map((step) => {
              const Icon = step.icon;
              return (
                <div className="step-card" key={step.number}>
                  <span className="step-number">{step.number}</span>
                  <span className="step-icon">
                    <Icon weight="duotone" />
                  </span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="section section-pricing-preview">
        <div className="container pricing-preview-shell">
          <div className="pricing-preview-copy">
            <span className="eyebrow">彈性成長方案</span>
            <h2>先建立商家資料，需要公開網站時再升級</h2>
            <p>免費會員可建立商家資料、編輯與預覽網站；正式發布公開網站或綁定網址需升級專業或企業方案。</p>
            <Link to="/pricing" className="btn btn-outline">
              比較完整方案
              <ArrowRight />
            </Link>
          </div>
          <div className="price-spotlight">
            <div className="price-label">
              <span>最多商家選擇</span>
              專業方案
            </div>
            <div className="price">
              <strong>NT$18,000</strong>
              <span>一次性開通</span>
            </div>
            <ul>
              <li>
                <Check /> 完整多區塊商家網站
              </li>
              <li>
                <Check /> 30 個商品或服務
              </li>
              <li>
                <Check /> 訪客數據與提升曝光
              </li>
            </ul>
            <Link to="/pricing" className="btn btn-primary">
              選擇專業方案
            </Link>
          </div>
        </div>
      </section>

      <section className="section section-faq">
        <div className="container faq-layout">
          <div className="faq-intro">
            <span className="eyebrow">常見問題</span>
            <h2>開始前，你可能想知道</h2>
            <p>還有其他問題？我們很樂意協助你找到適合的開始方式。</p>
            <Link to="/contact" className="text-link">
              聯絡平台團隊
              <ArrowRight />
            </Link>
          </div>
          <div className="faq-list">
            {faqs.slice(0, 4).map((item, index) => (
              <div className={`faq-item ${openFaq === index ? "open" : ""}`} key={item.q}>
                <button type="button" onClick={() => setOpenFaq(openFaq === index ? -1 : index)}>
                  <span>{item.q}</span>
                  <Plus weight="bold" />
                </button>
                {openFaq === index && <p>{item.a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="container">
          <div>
            <span>每個行業，都值得擁有自己的網站。</span>
            <h2>今天，讓你的專業正式被看見</h2>
            <p>建立商家資料、編輯網站內容，加入全台百工百業的合作網絡。</p>
          </div>
          <div className="home-cta-actions">
            <Link to={siteEditorPath} className="btn btn-accent btn-lg">
              建立我的網站
              <ArrowRight />
            </Link>
            <span>可先編輯與預覽・正式發布需升級方案</span>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
