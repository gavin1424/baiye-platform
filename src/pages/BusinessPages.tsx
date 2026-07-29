import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Buildings,
  CalendarBlank,
  CaretDown,
  Certificate,
  ChatCircleDots,
  Check,
  Clock,
  Envelope,
  Eye,
  Funnel,
  Globe,
  Handshake,
  Heart,
  Image as ImageIcon,
  InstagramLogo,
  LinkSimple,
  MagnifyingGlass,
  MapPin,
  PaperPlaneTilt,
  Phone,
  PlayCircle,
  SealCheck,
  ShieldCheck,
  Star,
  Storefront,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import {
  BusinessCard,
  BusinessLogo,
  EmptyState,
  FavoriteButton,
  FilterDrawerButton,
  IndustryIcon,
  Modal,
  Pagination,
  ProductCard,
  PublicLayout,
  Rating,
  SearchBar,
  SectionHeading,
  ShareButton,
  SkeletonCards,
  TrustBadges,
  ViewToggle,
} from "../components";
import { businesses, categories, products, reviews } from "../data";
import { useAppStore } from "../store";

const locations = ["台北市", "新北市", "桃園市", "新竹市", "台中市", "台南市", "高雄市"];
const serviceModes = ["到府服務", "線上服務", "實體店面", "企業合作"];

export function CategoriesPage() {
  return (
    <PublicLayout>
      <section className="page-hero compact-page-hero">
        <div className="container">
          <span className="eyebrow">百工百業分類</span>
          <h1>從 26 個產業，找到最適合的專業</h1>
          <p>依服務類型探索職人、工作室、供應商與企業團隊。</p>
          <SearchBar variant="compact" />
        </div>
      </section>
      <section className="section categories-directory">
        <div className="container">
          <div className="category-directory-grid">
            {categories.map((category, index) => {
              const count = 320 + ((index * 173) % 1400);
              const sample = businesses.filter((business) => business.category === category);
              return (
                <Link
                  key={category}
                  to={`/categories/${encodeURIComponent(category)}`}
                  className="category-directory-card"
                >
                  <span className="category-index">{String(index + 1).padStart(2, "0")}</span>
                  <span className="category-directory-icon">
                    <IndustryIcon category={category} size={29} weight="duotone" />
                  </span>
                  <div>
                    <strong>{category}</strong>
                    <small>{count.toLocaleString("zh-TW")} 位業者</small>
                  </div>
                  <ArrowRight />
                  {sample.length > 0 && (
                    <div className="category-samples">
                      {sample.slice(0, 2).map((business) => business.name).join("・")}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

export function CategoryDetailPage() {
  const { category = "" } = useParams();
  const decoded = decodeURIComponent(category);
  const matching = businesses.filter((business) => business.category === decoded);
  const fallback = matching.length ? matching : businesses.filter((business) => business.services.some((service) => service.includes(decoded.slice(0, 2))));

  return (
    <PublicLayout>
      <section className="category-detail-hero">
        <div className="container">
          <nav className="breadcrumb" aria-label="麵包屑">
            <Link to="/">首頁</Link>
            <span>/</span>
            <Link to="/categories">所有分類</Link>
            <span>/</span>
            <span>{decoded}</span>
          </nav>
          <div className="category-detail-title">
            <span>
              <IndustryIcon category={decoded} size={38} weight="duotone" />
            </span>
            <div>
              <h1>{decoded}</h1>
              <p>比較業者服務、案例、評價與認證，找到值得信賴的合作夥伴。</p>
            </div>
          </div>
          <SearchBar initialCategory={decoded} variant="compact" />
        </div>
      </section>
      <section className="section">
        <div className="container">
          <SectionHeading
            title={`${decoded}推薦業者`}
            description={`共找到 ${Math.max(36, fallback.length * 18)} 位可合作的專業業者`}
            action={{ label: "進階篩選", to: `/businesses?category=${encodeURIComponent(decoded)}` }}
          />
          <div className="business-grid">
            {(fallback.length ? fallback : businesses.slice(0, 6)).slice(0, 6).map((business) => (
              <BusinessCard key={business.id} business={business} />
            ))}
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}

type FilterState = {
  keyword: string;
  category: string;
  location: string;
  mode: string[];
  minRating: number;
  invoice: boolean;
  enterprise: boolean;
};

function FilterPanel({
  filters,
  setFilters,
  resultCount,
  onClose,
}: {
  filters: FilterState;
  setFilters: Dispatch<SetStateAction<FilterState>>;
  resultCount: number;
  onClose?: () => void;
}) {
  const clear = () =>
    setFilters({
      keyword: "",
      category: "",
      location: "",
      mode: [],
      minRating: 0,
      invoice: false,
      enterprise: false,
    });
  return (
    <aside className="filter-panel">
      <div className="filter-panel-title">
        <div>
          <Funnel />
          <strong>篩選條件</strong>
        </div>
        <button type="button" onClick={clear}>
          清除全部
        </button>
        {onClose && (
          <button type="button" className="drawer-close" onClick={onClose} aria-label="關閉篩選">
            <X />
          </button>
        )}
      </div>
      <label className="field">
        <span>關鍵字</span>
        <div className="input-with-icon">
          <MagnifyingGlass />
          <input
            value={filters.keyword}
            onChange={(event) => setFilters((value) => ({ ...value, keyword: event.target.value }))}
            placeholder="服務或商家名稱"
          />
        </div>
      </label>
      <label className="field">
        <span>產業分類</span>
        <select
          value={filters.category}
          onChange={(event) => setFilters((value) => ({ ...value, category: event.target.value }))}
        >
          <option value="">全部分類</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>所在地區</span>
        <select
          value={filters.location}
          onChange={(event) => setFilters((value) => ({ ...value, location: event.target.value }))}
        >
          <option value="">全部地區</option>
          {locations.map((location) => (
            <option key={location}>{location}</option>
          ))}
        </select>
      </label>
      <fieldset className="filter-group">
        <legend>服務方式</legend>
        {serviceModes.map((mode) => (
          <label key={mode} className="check-row">
            <input
              type="checkbox"
              checked={filters.mode.includes(mode)}
              onChange={() =>
                setFilters((value) => ({
                  ...value,
                  mode: value.mode.includes(mode) ? value.mode.filter((item) => item !== mode) : [...value.mode, mode],
                }))
              }
            />
            <span>{mode}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>最低評分</legend>
        {[4.8, 4.5, 4].map((rating) => (
          <label key={rating} className="radio-row">
            <input
              type="radio"
              name="rating"
              checked={filters.minRating === rating}
              onChange={() => setFilters((value) => ({ ...value, minRating: rating }))}
            />
            <span className="stars">★★★★★</span>
            <small>{rating} 以上</small>
          </label>
        ))}
      </fieldset>
      <fieldset className="filter-group">
        <legend>合作條件</legend>
        <label className="check-row">
          <input
            type="checkbox"
            checked={filters.invoice}
            onChange={() => setFilters((value) => ({ ...value, invoice: !value.invoice }))}
          />
          <span>可開發票</span>
        </label>
        <label className="check-row">
          <input
            type="checkbox"
            checked={filters.enterprise}
            onChange={() => setFilters((value) => ({ ...value, enterprise: !value.enterprise }))}
          />
          <span>接受企業合作</span>
        </label>
      </fieldset>
      <button type="button" className="btn btn-primary filter-submit" onClick={onClose}>
        顯示 {resultCount} 筆結果
      </button>
    </aside>
  );
}

export function BusinessesPage({ searchTitle = false }: { searchTitle?: boolean }) {
  const [params] = useSearchParams();
  const initialKeyword = params.get("q") || "";
  const initialCategory = params.get("category") || "";
  const initialLocation = params.get("location") || "";
  const [filters, setFilters] = useState<FilterState>({
    keyword: initialKeyword,
    category: initialCategory,
    location: initialLocation,
    mode: [],
    minRating: 0,
    invoice: false,
    enterprise: false,
  });
  const [sort, setSort] = useState("recommended");
  const [view, setView] = useState<"card" | "list">("list");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 520);
    return () => window.clearTimeout(timer);
  }, []);

  const filtered = useMemo(() => {
    const search = filters.keyword.trim().toLowerCase();
    const result = businesses.filter((business) => {
      const matchesKeyword =
        !search ||
        business.name.toLowerCase().includes(search) ||
        business.tagline.toLowerCase().includes(search) ||
        business.services.some((service) => service.toLowerCase().includes(search));
      const matchesCategory = !filters.category || business.category === filters.category;
      const matchesLocation = !filters.location || business.location === filters.location;
      const matchesMode =
        filters.mode.length === 0 || filters.mode.some((mode) => business.serviceMode.join("").includes(mode.slice(0, 2)));
      return (
        matchesKeyword &&
        matchesCategory &&
        matchesLocation &&
        matchesMode &&
        business.rating >= filters.minRating &&
        (!filters.invoice || business.invoice) &&
        (!filters.enterprise || business.enterprise)
      );
    });
    return [...result].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "popular") return b.reviewCount - a.reviewCount;
      if (sort === "newest") return b.id - a.id;
      return Number(b.recommended) - Number(a.recommended) || b.rating - a.rating;
    });
  }, [filters, sort]);

  const activeFilters = [
    filters.keyword && `關鍵字：${filters.keyword}`,
    filters.category,
    filters.location,
    ...filters.mode,
    filters.minRating > 0 && `${filters.minRating} 星以上`,
    filters.invoice && "可開發票",
    filters.enterprise && "企業合作",
  ].filter(Boolean) as string[];

  const removeTag = (tag: string) => {
    if (tag.startsWith("關鍵字：")) setFilters((value) => ({ ...value, keyword: "" }));
    else if (tag === filters.category) setFilters((value) => ({ ...value, category: "" }));
    else if (tag === filters.location) setFilters((value) => ({ ...value, location: "" }));
    else if (tag.endsWith("星以上")) setFilters((value) => ({ ...value, minRating: 0 }));
    else if (tag === "可開發票") setFilters((value) => ({ ...value, invoice: false }));
    else if (tag === "企業合作") setFilters((value) => ({ ...value, enterprise: false }));
    else setFilters((value) => ({ ...value, mode: value.mode.filter((mode) => mode !== tag) }));
  };

  return (
    <PublicLayout>
      <section className="directory-header">
        <div className="container">
          <nav className="breadcrumb" aria-label="麵包屑">
            <Link to="/">首頁</Link>
            <span>/</span>
            <span>{searchTitle ? "搜尋結果" : "找服務"}</span>
          </nav>
          <div className="directory-title-row">
            <div>
              <span className="eyebrow">{searchTitle ? "商家搜尋結果" : "專業服務目錄"}</span>
              <h1>{searchTitle && initialKeyword ? `「${initialKeyword}」的搜尋結果` : "找服務、找商家"}</h1>
              <p>依需求篩選認證業者，比較服務、案例與真實評價。</p>
            </div>
            <SearchBar
              initialKeyword={initialKeyword}
              initialCategory={initialCategory}
              initialLocation={initialLocation}
              variant="compact"
            />
          </div>
        </div>
      </section>
      <section className="directory-section">
        <div className="container directory-layout">
          <div className="desktop-filter">
            <FilterPanel filters={filters} setFilters={setFilters} resultCount={filtered.length} />
          </div>
          <div className="directory-results">
            <div className="results-toolbar">
              <div>
                <FilterDrawerButton onClick={() => setDrawerOpen(true)} />
                <span>
                  找到 <strong>{filtered.length || 0}</strong> 間業者
                </span>
              </div>
              <div>
                <label>
                  <span>排序：</span>
                  <select value={sort} onChange={(event) => setSort(event.target.value)}>
                    <option value="recommended">推薦排序</option>
                    <option value="rating">評價最高</option>
                    <option value="popular">熱門度</option>
                    <option value="newest">最新加入</option>
                  </select>
                </label>
                <ViewToggle view={view} onChange={setView} />
              </div>
            </div>
            {activeFilters.length > 0 && (
              <div className="active-filter-tags">
                <span>已選：</span>
                {activeFilters.map((tag) => (
                  <button type="button" key={tag} onClick={() => removeTag(tag)}>
                    {tag}
                    <X />
                  </button>
                ))}
              </div>
            )}
            {loading ? (
              <SkeletonCards count={4} />
            ) : filtered.length ? (
              <>
                <div className={`business-results business-results-${view}`}>
                  {filtered.slice((page - 1) * 8, page * 8).map((business) => (
                    <BusinessCard key={business.id} business={business} view={view} />
                  ))}
                </div>
                <Pagination page={page} pages={Math.max(1, Math.ceil(filtered.length / 8))} onChange={setPage} />
              </>
            ) : (
              <EmptyState
                title="目前找不到符合條件的業者"
                description="試著移除部分條件，或換一個關鍵字搜尋。"
                action={{
                  label: "清除篩選",
                  onClick: () =>
                    setFilters({
                      keyword: "",
                      category: "",
                      location: "",
                      mode: [],
                      minRating: 0,
                      invoice: false,
                      enterprise: false,
                    }),
                }}
              />
            )}
          </div>
        </div>
      </section>
      {drawerOpen && (
        <div className="filter-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <div className="filter-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <FilterPanel
              filters={filters}
              setFilters={setFilters}
              resultCount={filtered.length}
              onClose={() => setDrawerOpen(false)}
            />
          </div>
        </div>
      )}
    </PublicLayout>
  );
}

export function BusinessPage() {
  const { slug } = useParams();
  const { businessFavorites, toggleBusinessFavorite, followedBusinesses, toggleFollow, notify, siteSettings } =
    useAppStore();
  const sourceBusiness = businesses.find((item) => item.slug === slug) || businesses[0];
  const business =
    sourceBusiness.id === businesses[0].id
      ? {
          ...sourceBusiness,
          name: siteSettings.name,
          tagline: siteSettings.tagline,
          intro: siteSettings.intro,
          cover: siteSettings.cover || sourceBusiness.cover,
        }
      : sourceBusiness;
  const businessProducts = products.filter((product) => product.businessId === business.id);
  const relatedProducts =
    businessProducts.length >= 3
      ? businessProducts.slice(0, 3)
      : [...businessProducts, ...products.filter((product) => product.businessId !== business.id)].slice(0, 3);
  const businessReviews = reviews.filter((review) => review.businessId === business.id);
  const relevantReviews =
    businessReviews.length >= 3
      ? businessReviews
      : [...businessReviews, ...reviews.filter((review) => review.businessId !== business.id)].slice(0, 4);
  const [contactOpen, setContactOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("about");

  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactOpen(false);
    notify("訊息已送出，商家會收到通知");
  };

  const submitInvite = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setInviteOpen(false);
    notify("合作邀請已送出");
  };

  const tabs = [
    ["about", "關於我們"],
    ["services", "服務項目"],
    ["portfolio", "作品案例"],
    ["products", "商品服務"],
    ["reviews", `顧客評價 (${business.reviewCount})`],
    ["contact", "聯絡資訊"],
  ];

  return (
    <PublicLayout>
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "LocalBusiness",
          name: business.name,
          description: business.intro,
          address: business.address,
          telephone: business.phone,
          aggregateRating: { "@type": "AggregateRating", ratingValue: business.rating, reviewCount: business.reviewCount },
        })}
      </script>
      <section className="business-profile">
        <div className="container">
          <nav className="breadcrumb business-breadcrumb" aria-label="麵包屑">
            <Link to="/">首頁</Link>
            <span>/</span>
            <Link to="/businesses">找商家</Link>
            <span>/</span>
            <span>{business.name}</span>
          </nav>
          <div className="business-hero-cover">
            <img src={business.cover} alt={`${business.name} 的商家封面與服務環境`} />
            <span className="business-cover-shade" />
            <div className="cover-status">
              <span>
                <span className="online-dot" /> 最近上線：{business.lastOnline}
              </span>
            </div>
          </div>
          <div className="business-profile-card">
            <div className="business-profile-main">
              {sourceBusiness.id === businesses[0].id && siteSettings.logo ? (
                <img className="public-custom-logo" src={siteSettings.logo} alt={`${business.name} Logo`} />
              ) : (
                <BusinessLogo business={business} size="lg" />
              )}
              <div className="business-profile-copy">
                <div className="business-name-line">
                  <h1>{business.name}</h1>
                  <span className="verified-label">
                    <SealCheck weight="fill" />
                    已驗證商家
                  </span>
                </div>
                <p>{business.tagline}</p>
                <div className="business-profile-meta">
                  <Rating value={business.rating} count={business.reviewCount} />
                  <span>
                    <MapPin weight="fill" />
                    {business.location} {business.district}
                  </span>
                  <span>
                    <Storefront />
                    加入於 {business.joinedAt}
                  </span>
                </div>
                <TrustBadges business={business} />
              </div>
            </div>
            <div className="business-profile-actions">
              <button type="button" className="btn btn-primary btn-lg" onClick={() => setContactOpen(true)}>
                <Phone weight="fill" />
                聯絡商家
              </button>
              <button type="button" className="btn btn-accent btn-lg" onClick={() => setInviteOpen(true)}>
                <Handshake />
                合作邀請
              </button>
              <FavoriteButton
                active={businessFavorites.includes(business.id)}
                onClick={() => toggleBusinessFavorite(business.id)}
                label="收藏商家"
              />
              <ShareButton title={business.name} />
            </div>
          </div>
          <div className="business-trust-stats">
            {[
              [Storefront, `${business.years} 年+`, "服務年資"],
              [UsersThree, `${Math.round(business.completed * 0.67)}+`, "服務客戶"],
              [Handshake, `${business.completed}+`, "完成合作"],
              [Star, `${business.rating} / 5`, "好評分數"],
              [ChatCircleDots, `${business.responseRate}%`, "回覆率"],
              [Clock, business.responseTime, "平均回覆"],
            ].map(([Icon, value, label]) => {
              const StatIcon = Icon as typeof Storefront;
              return (
                <div key={String(label)}>
                  <StatIcon weight="duotone" />
                  <strong>{String(value)}</strong>
                  <span>{String(label)}</span>
                </div>
              );
            })}
          </div>
          <nav className="business-tabs" aria-label="商家頁區塊">
            {tabs.map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={activeTab === id ? "active" : ""}
                onClick={() => {
                  setActiveTab(id);
                  document.getElementById(`section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="business-content-grid">
            <div className="business-main-column">
              <section id="section-about" className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <Storefront />
                    </span>
                    <h2>關於我們</h2>
                  </div>
                  <span className="business-category-label">
                    <IndustryIcon category={business.category} />
                    {business.category}
                  </span>
                </div>
                <p className="business-intro">{business.intro}</p>
                <div className="about-checklist">
                  {business.services.map((service) => (
                    <span key={service}>
                      <Check weight="bold" />
                      {service}
                    </span>
                  ))}
                </div>
              </section>

              <section id="section-services" className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <Briefcase />
                    </span>
                    <h2>服務項目</h2>
                  </div>
                  <span className="price-range">價格區間 {business.priceRange}</span>
                </div>
                <div className="service-detail-grid">
                  {business.services.map((service, index) => (
                    <div key={service}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <h3>{service}</h3>
                        <p>依現場或需求評估提供規劃、正式報價與交付說明。</p>
                      </div>
                      <ArrowRight />
                    </div>
                  ))}
                </div>
              </section>

              <section id="section-portfolio" className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <ImageIcon />
                    </span>
                    <h2>精選作品案例</h2>
                  </div>
                  <button type="button" className="text-button">
                    查看全部 12 件
                    <ArrowRight />
                  </button>
                </div>
                <div className="portfolio-grid">
                  {[business, businesses[(business.id + 1) % businesses.length], businesses[(business.id + 4) % businesses.length]]
                    .slice(0, 3)
                    .map((item, index) => (
                      <figure key={`${item.id}-${index}`} className={index === 0 ? "portfolio-featured" : ""}>
                        <img src={item.cover} alt={`${business.name} 的作品案例 ${index + 1}`} loading="lazy" />
                        <figcaption>
                          <strong>{business.services[index % business.services.length]}</strong>
                          <span>{index === 0 ? "企業空間完整規劃" : "客戶實景紀錄"}</span>
                        </figcaption>
                        {index === 2 && (
                          <button type="button" aria-label="播放案例影片">
                            <PlayCircle weight="fill" />
                          </button>
                        )}
                      </figure>
                    ))}
                </div>
              </section>

              <section id="section-products" className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <Storefront />
                    </span>
                    <h2>商品與服務</h2>
                  </div>
                  <Link to={`/marketplace?business=${business.id}`} className="text-link">
                    前往商店
                    <ArrowRight />
                  </Link>
                </div>
                <div className="product-grid product-grid-three">
                  {relatedProducts.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </section>

              <section id="section-reviews" className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <Star />
                    </span>
                    <h2>客戶評價</h2>
                  </div>
                  <Rating value={business.rating} count={business.reviewCount} />
                </div>
                <div className="reviews-summary">
                  <div className="review-score">
                    <strong>{business.rating}</strong>
                    <span>★★★★★</span>
                    <small>來自 {business.reviewCount} 則評價</small>
                  </div>
                  <div className="review-bars">
                    {[5, 4, 3].map((score, index) => (
                      <div key={score}>
                        <span>{score} 星</span>
                        <i>
                          <b style={{ width: `${index === 0 ? 92 : index === 1 ? 7 : 1}%` }} />
                        </i>
                        <small>{index === 0 ? "92%" : index === 1 ? "7%" : "1%"}</small>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="review-list">
                  {relevantReviews.slice(0, 4).map((review) => (
                    <article key={review.id}>
                      <span className="avatar">{review.author.slice(0, 1)}</span>
                      <div>
                        <div className="review-head">
                          <strong>{review.author}</strong>
                          <Rating value={review.rating} compact />
                          <time>{review.date}</time>
                        </div>
                        <span className="review-project">{review.project}</span>
                        <p>{review.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>

              <section className="profile-section">
                <div className="profile-section-heading">
                  <div>
                    <span className="section-mini-icon">
                      <CalendarBlank />
                    </span>
                    <h2>最新消息</h2>
                  </div>
                </div>
                <div className="news-list">
                  <button
                    type="button"
                    onClick={() => notify("最新消息已開啟｜八月企業合作檔期開放預約")}
                  >
                    <time>2026.07.26</time>
                    <strong>八月企業合作檔期開放預約</strong>
                    <ArrowRight />
                  </button>
                  <button
                    type="button"
                    onClick={() => notify("最新消息已開啟｜完成年度設備與服務流程升級")}
                  >
                    <time>2026.07.08</time>
                    <strong>完成年度設備與服務流程升級</strong>
                    <ArrowRight />
                  </button>
                </div>
              </section>
            </div>

            <aside id="section-contact" className="business-sidebar">
              <section className="contact-card">
                <div className="contact-card-title">
                  <span>
                    <ChatCircleDots weight="duotone" />
                  </span>
                  <div>
                    <h2>聯絡資訊</h2>
                    <p>通常在 {business.responseTime} 回覆</p>
                  </div>
                </div>
                <ul>
                  <li>
                    <Phone />
                    <div>
                      <small>聯絡電話</small>
                      <strong>{business.phone}</strong>
                    </div>
                  </li>
                  <li>
                    <Clock />
                    <div>
                      <small>營業時間</small>
                      <strong>{business.hours}</strong>
                    </div>
                  </li>
                  <li>
                    <MapPin />
                    <div>
                      <small>地址</small>
                      <strong>{business.address}</strong>
                    </div>
                  </li>
                  <li>
                    <Envelope />
                    <div>
                      <small>Email</small>
                      <strong>{business.email}</strong>
                    </div>
                  </li>
                </ul>
                <button type="button" className="btn btn-primary" onClick={() => setContactOpen(true)}>
                  <PaperPlaneTilt />
                  送出聯絡表單
                </button>
                <div className="social-buttons">
                  <button type="button">
                    <ChatCircleDots /> LINE
                  </button>
                  <button type="button">
                    <InstagramLogo /> 社群
                  </button>
                  <button type="button">
                    <Globe /> 網站
                  </button>
                </div>
              </section>

              <section className="sidebar-card">
                <h3>
                  <Certificate />
                  專業證照與認證
                </h3>
                <ul className="certificate-list">
                  {business.certificates.map((certificate) => (
                    <li key={certificate}>
                      <ShieldCheck weight="fill" />
                      {certificate}
                    </li>
                  ))}
                </ul>
              </section>

              <section className="sidebar-card">
                <h3>
                  <Buildings />
                  合作品牌
                </h3>
                <div className="partner-list">
                  {business.partners.map((partner) => (
                    <span key={partner}>{partner}</span>
                  ))}
                </div>
              </section>

              <section className="sidebar-card qr-card">
                <QRCodeSVG
                  value={`${window.location.origin}${import.meta.env.BASE_URL}#/business/${business.slug}`}
                  size={108}
                />
                <div>
                  <strong>手機查看商家頁</strong>
                  <p>掃描 QR Code 分享聯絡資料與作品。</p>
                </div>
              </section>

              <section className="sidebar-card follow-card">
                <span>
                  <Heart weight="duotone" />
                </span>
                <h3>追蹤最新服務與作品</h3>
                <p>商家發布新消息時會通知你。</p>
                <button
                  type="button"
                  className={`btn ${followedBusinesses.includes(business.id) ? "btn-success" : "btn-outline"}`}
                  onClick={() => toggleFollow(business.id)}
                >
                  {followedBusinesses.includes(business.id) ? "追蹤中" : "追蹤商家"}
                </button>
              </section>
            </aside>
          </div>
        </div>
      </section>

      <Modal open={contactOpen} title={`聯絡 ${business.name}`} onClose={() => setContactOpen(false)}>
        <form className="form-stack" onSubmit={submitContact}>
          <div className="form-grid-two">
            <label className="field">
              <span>姓名 *</span>
              <input required placeholder="請輸入姓名" />
            </label>
            <label className="field">
              <span>聯絡電話 *</span>
              <input required inputMode="tel" placeholder="09xx-xxx-xxx" />
            </label>
          </div>
          <label className="field">
            <span>Email</span>
            <input type="email" placeholder="name@example.com" />
          </label>
          <label className="field">
            <span>想詢問的服務 *</span>
            <select required defaultValue="">
              <option value="" disabled>
                請選擇服務
              </option>
              {business.services.map((service) => (
                <option key={service}>{service}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>需求內容 *</span>
            <textarea required rows={5} placeholder="請說明需求、地點、預算與希望完成時間" />
          </label>
          <button type="submit" className="btn btn-primary">
            <PaperPlaneTilt /> 送出訊息
          </button>
        </form>
      </Modal>

      <Modal open={inviteOpen} title="發送合作邀請" onClose={() => setInviteOpen(false)} size="lg">
        <form className="form-stack" onSubmit={submitInvite}>
          <div className="form-grid-two">
            <label className="field">
              <span>合作類型 *</span>
              <select required>
                <option>異業合作</option>
                <option>供應合作</option>
                <option>專案外包</option>
                <option>長期夥伴</option>
              </select>
            </label>
            <label className="field">
              <span>預算範圍</span>
              <select>
                <option>NT$ 10,000 以下</option>
                <option>NT$ 10,000－50,000</option>
                <option>NT$ 50,000－200,000</option>
                <option>NT$ 200,000 以上</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>合作主旨 *</span>
            <input required placeholder="例如：企業空間長期維護合作" />
          </label>
          <label className="field">
            <span>合作內容 *</span>
            <textarea required rows={6} placeholder="介紹你的團隊與希望討論的合作方式" />
          </label>
          <button type="submit" className="btn btn-primary">
            <Handshake /> 發送合作邀請
          </button>
        </form>
      </Modal>
    </PublicLayout>
  );
}
