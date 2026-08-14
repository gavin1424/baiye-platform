import {
  ArrowLeft,
  ArrowRight,
  Buildings,
  CaretDown,
  Check,
  Clock,
  CurrencyCircleDollar,
  Envelope,
  FileText,
  Heart,
  Info,
  MagnifyingGlass,
  MapPin,
  Package,
  PaperPlaneTilt,
  Phone,
  SealCheck,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Storefront,
  Truck,
  X,
} from "@phosphor-icons/react";
import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  BusinessLogo,
  EmptyState,
  FavoriteButton,
  Modal,
  Pagination,
  ProductCard,
  PublicLayout,
  Rating,
  SectionHeading,
  ShareButton,
  TrustBadges,
} from "../components";
import { businesses, categories, products, reviews } from "../data";
import { useAppStore } from "../store";

const marketTypes = [
  "實體商品",
  "專業服務",
  "批發商品",
  "原物料",
  "設備租借",
  "場地出租",
  "顧問服務",
  "線上服務",
  "客製化服務",
];

export function MarketplacePage() {
  const [params] = useSearchParams();
  const [keyword, setKeyword] = useState(params.get("q") || "");
  const [type, setType] = useState("");
  const [category, setCategory] = useState("");
  const [price, setPrice] = useState("");
  const [sort, setSort] = useState("recommended");
  const [page, setPage] = useState(1);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const filtered = useMemo(() => {
    const term = keyword.toLowerCase();
    return products
      .filter(
        (product) =>
          (!term ||
            product.name.toLowerCase().includes(term) ||
            product.description.toLowerCase().includes(term) ||
            businesses.find((business) => business.id === product.businessId)?.name.toLowerCase().includes(term)) &&
          (!type || product.type === type) &&
          (!category || product.category === category) &&
          (!price ||
            (price === "under5000"
              ? product.price < 5000
              : price === "5000to50000"
                ? product.price >= 5000 && product.price <= 50000
                : product.price > 50000)),
      )
      .sort((a, b) => {
        if (sort === "priceLow") return a.price - b.price;
        if (sort === "priceHigh") return b.price - a.price;
        if (sort === "rating") return b.rating - a.rating;
        if (sort === "newest") return b.id - a.id;
        return b.reviewCount - a.reviewCount;
      });
  }, [keyword, type, category, price, sort]);

  const filterContent = (
    <>
      <label>
        <span>商品類型</span>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">全部類型</option>
          {marketTypes.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        <span>產業分類</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">全部分類</option>
          {categories.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </label>
      <label>
        <span>價格範圍</span>
        <select value={price} onChange={(event) => setPrice(event.target.value)}>
          <option value="">不限價格</option>
          <option value="under5000">NT$ 5,000 以下</option>
          <option value="5000to50000">NT$ 5,000－50,000</option>
          <option value="above50000">NT$ 50,000 以上</option>
        </select>
      </label>
    </>
  );

  return (
    <PublicLayout>
      <section className="market-hero">
        <div className="container market-hero-inner">
          <div>
            <span className="eyebrow">
              <ShoppingBag weight="fill" />
              商品與服務市集
            </span>
            <h1>找到商品，也找到能長期合作的供應商</h1>
            <p>實體商品、專業服務、原物料與企業批發，一次比較與詢價。</p>
          </div>
          <div className="market-feature-pills">
            <span>
              <ShieldCheck weight="fill" />
              供應商認證
            </span>
            <span>
              <FileText weight="fill" />
              正式詢價單
            </span>
            <span>
              <Buildings weight="fill" />
              企業批發
            </span>
          </div>
        </div>
      </section>
      <section className="market-directory">
        <div className="container">
          <div className="market-searchbar">
            <div>
              <MagnifyingGlass />
              <input
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
                placeholder="搜尋商品、服務或供應商"
              />
              <button type="button" className="btn btn-primary">
                搜尋
              </button>
            </div>
            <Link to="/dashboard/products" className="btn btn-outline">
              <Package />
              上架商品或服務
            </Link>
          </div>
          <div className="market-category-strip">
            {marketTypes.slice(0, 7).map((item) => (
              <button type="button" key={item} className={type === item ? "active" : ""} onClick={() => setType(type === item ? "" : item)}>
                <Package weight={type === item ? "fill" : "duotone"} />
                {item}
              </button>
            ))}
          </div>
          <div className="market-toolbar">
            <div className="market-filters desktop-market-filters">{filterContent}</div>
            <button type="button" className="btn btn-outline mobile-market-filter" onClick={() => setDrawerOpen(true)}>
              <SlidersHorizontal />
              篩選
            </button>
            <div className="market-sort">
              <span>共 {filtered.length} 項</span>
              <label>
                <select value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="recommended">推薦排序</option>
                  <option value="newest">最新上架</option>
                  <option value="rating">評價最高</option>
                  <option value="priceLow">價格由低到高</option>
                  <option value="priceHigh">價格由高到低</option>
                </select>
                <CaretDown />
              </label>
            </div>
          </div>
          {filtered.length ? (
            <>
              <div className="product-grid marketplace-grid">
                {filtered.slice((page - 1) * 12, page * 12).map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
              <Pagination page={page} pages={Math.max(1, Math.ceil(filtered.length / 12))} onChange={setPage} />
            </>
          ) : (
            <EmptyState
              title="沒有符合條件的商品或服務"
              description="移除價格或分類條件，再重新搜尋看看。"
              action={{
                label: "清除篩選",
                onClick: () => {
                  setType("");
                  setCategory("");
                  setPrice("");
                  setKeyword("");
                },
              }}
            />
          )}
        </div>
      </section>
      {drawerOpen && (
        <div className="filter-drawer-backdrop" onMouseDown={() => setDrawerOpen(false)}>
          <aside className="market-filter-drawer" onMouseDown={(event) => event.stopPropagation()}>
            <div className="mobile-filter-head">
              <strong>篩選市集內容</strong>
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="關閉篩選">
                <X />
              </button>
            </div>
            {filterContent}
            <button type="button" className="btn btn-primary" onClick={() => setDrawerOpen(false)}>
              顯示 {filtered.length} 項結果
            </button>
          </aside>
        </div>
      )}
    </PublicLayout>
  );
}

export function ProductDetailPage() {
  const navigate = useNavigate();
  const { slug } = useParams();
  const product = products.find((item) => item.slug === slug) || products[0];
  const supplier = businesses.find((business) => business.id === product.businessId) || businesses[0];
  const { session, productFavorites, toggleProductFavorite, addToInquiry, inquiryCart, notify } = useAppStore();
  const [contactOpen, setContactOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const gallery = [
    product.image,
    businesses[(supplier.id + 2) % businesses.length].cover,
    businesses[(supplier.id + 6) % businesses.length].cover,
  ];
  const related = products.filter((item) => item.id !== product.id && item.category === product.category).slice(0, 4);
  const productReviews = reviews.slice(product.id % 10, product.id % 10 + 3);

  const submitContact = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setContactOpen(false);
    notify("詢問已送給商家");
  };

  const requireMerchant = (action: () => void) => {
    if (session.role === "business" || session.role === "admin") {
      action();
      return;
    }
    notify("商家詢價功能需完成 NT$18,000 一次性商家上架註冊。", "warning");
    navigate(session.role === "guest" ? "/login" : "/pricing");
  };

  return (
    <PublicLayout>
      <section className="detail-page-header">
        <div className="container">
          <nav className="breadcrumb" aria-label="麵包屑">
            <Link to="/">首頁</Link>
            <span>/</span>
            <Link to="/marketplace">商品市集</Link>
            <span>/</span>
            <span>{product.name}</span>
          </nav>
          <Link to="/marketplace" className="back-link">
            <ArrowLeft /> 回到市集
          </Link>
        </div>
      </section>
      <section className="product-detail-page">
        <div className="container">
          <div className="product-detail-hero">
            <div className="product-gallery">
              <div className="product-main-image">
                <img src={gallery[selectedImage]} alt={`${product.name} 展示照片 ${selectedImage + 1}`} />
                <span>{product.type}</span>
              </div>
              <div className="gallery-thumbnails">
                {gallery.map((image, index) => (
                  <button
                    type="button"
                    key={image}
                    className={selectedImage === index ? "active" : ""}
                    onClick={() => setSelectedImage(index)}
                  >
                    <img src={image} alt={`${product.name} 縮圖 ${index + 1}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="product-detail-info">
              <span className="product-detail-category">{product.category}</span>
              <h1>{product.name}</h1>
              <div className="product-detail-rating">
                <Rating value={product.rating} count={product.reviewCount} />
                <span>已完成 38 次詢價</span>
              </div>
              <p className="product-description">{product.description}</p>
              <div className="product-pricing-box">
                <div>
                  <small>參考價格</small>
                  <strong>NT$ {product.price.toLocaleString("zh-TW")}</strong>
                </div>
                <div>
                  <small>企業批發價</small>
                  <strong>NT$ {product.wholesalePrice.toLocaleString("zh-TW")} 起</strong>
                </div>
                <div>
                  <small>最低採購量</small>
                  <strong>{product.moq} 件</strong>
                </div>
              </div>
              <div className="product-spec-tags">
                {product.specs.map((spec) => (
                  <span key={spec}>
                    <Check /> {spec}
                  </span>
                ))}
              </div>
              <div className="product-detail-actions">
                <button
                  type="button"
                  className={`btn btn-lg ${inquiryCart.includes(product.id) ? "btn-success" : "btn-primary"}`}
                  onClick={() => requireMerchant(() => addToInquiry(product.id))}
                >
                  {inquiryCart.includes(product.id) ? (
                    <>
                      <Check /> 已加入詢價單
                    </>
                  ) : (
                    <>
                      <ShoppingBag /> 加入詢價單
                    </>
                  )}
                </button>
                <button type="button" className="btn btn-outline btn-lg" onClick={() => requireMerchant(() => setContactOpen(true))}>
                  <PaperPlaneTilt />
                  聯絡商家
                </button>
                <FavoriteButton
                  active={productFavorites.includes(product.id)}
                  onClick={() => toggleProductFavorite(product.id)}
                  label="收藏"
                />
                <ShareButton title={product.name} />
              </div>
              <div className="product-service-note">
                <ShieldCheck weight="duotone" />
                <div>
                  <strong>平台保障提醒</strong>
                  <span>確認規格、正式報價與交期後再進行合作。</span>
                </div>
              </div>
            </div>
          </div>

          <div className="product-detail-layout">
            <div className="product-detail-content">
              <section className="detail-card">
                <h2>商品／服務介紹</h2>
                <p>{product.description}</p>
                <p>
                  方案內容會依實際需求、數量與地區調整。送出詢價單後，供應商將確認規格並提供正式報價、付款方式與預計交期。
                </p>
                <div className="service-process">
                  {["送出需求", "確認規格", "商家報價", "模擬下單", "完成合作"].map((step, index) => (
                    <div key={step}>
                      <span>{index + 1}</span>
                      <strong>{step}</strong>
                    </div>
                  ))}
                </div>
              </section>
              <section className="detail-card">
                <h2>規格與交付</h2>
                <dl className="spec-table">
                  <div>
                    <dt>服務類型</dt>
                    <dd>{product.type}</dd>
                  </div>
                  <div>
                    <dt>最低採購量</dt>
                    <dd>{product.moq} 件</dd>
                  </div>
                  <div>
                    <dt>交付方式</dt>
                    <dd>宅配／到場服務／線上交付，依需求確認</dd>
                  </div>
                  <div>
                    <dt>報價效期</dt>
                    <dd>正式報價後 14 天</dd>
                  </div>
                </dl>
              </section>
              <section className="detail-card">
                <div className="detail-section-title-row">
                  <h2>客戶評價</h2>
                  <Rating value={product.rating} count={product.reviewCount} />
                </div>
                <div className="review-list">
                  {productReviews.map((review) => (
                    <article key={review.id}>
                      <span className="avatar">{review.author.slice(0, 1)}</span>
                      <div>
                        <div className="review-head">
                          <strong>{review.author}</strong>
                          <Rating value={review.rating} compact />
                          <time>{review.date}</time>
                        </div>
                        <p>{review.content}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            </div>
            <aside className="product-supplier-card">
              <span className="supplier-label">供應商</span>
              <div className="supplier-heading">
                <BusinessLogo business={supplier} size="md" />
                <div>
                  <Link to={`/business/${supplier.slug}`}>{supplier.name}</Link>
                  <Rating value={supplier.rating} count={supplier.reviewCount} compact />
                </div>
              </div>
              <TrustBadges business={supplier} />
              <p>{supplier.intro.slice(0, 86)}…</p>
              <dl>
                <div>
                  <dt>所在地</dt>
                  <dd>
                    {supplier.location} {supplier.district}
                  </dd>
                </div>
                <div>
                  <dt>回覆率</dt>
                  <dd>{supplier.responseRate}%</dd>
                </div>
                <div>
                  <dt>平均回覆</dt>
                  <dd>{supplier.responseTime}</dd>
                </div>
              </dl>
              <Link to={`/business/${supplier.slug}`} className="btn btn-outline">
                <Storefront /> 查看商家
              </Link>
              <button type="button" className="btn btn-primary" onClick={() => requireMerchant(() => setContactOpen(true))}>
                <Envelope /> 聯絡供應商
              </button>
            </aside>
          </div>

          <section className="related-products section">
            <SectionHeading
              title="相關商品與服務"
              description="其他適合一起比較的選項"
              action={{ label: "查看完整市集", to: "/marketplace" }}
            />
            <div className="product-grid">
              {(related.length >= 4 ? related : products.filter((item) => item.id !== product.id).slice(0, 4)).map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        </div>
      </section>
      <Modal open={contactOpen} title={`詢問 ${supplier.name}`} onClose={() => setContactOpen(false)}>
        <form className="form-stack" onSubmit={submitContact}>
          <label className="field">
            <span>詢問商品／服務</span>
            <input value={product.name} readOnly />
          </label>
          <div className="form-grid-two">
            <label className="field">
              <span>預計數量 *</span>
              <input required type="number" min={product.moq} defaultValue={product.moq} />
            </label>
            <label className="field">
              <span>希望交期 *</span>
              <input required type="date" />
            </label>
          </div>
          <label className="field">
            <span>需求說明 *</span>
            <textarea required rows={5} placeholder="規格、配送地點、是否需要客製或其他問題" />
          </label>
          <button type="submit" className="btn btn-primary">
            <PaperPlaneTilt /> 送出詢問
          </button>
        </form>
      </Modal>
    </PublicLayout>
  );
}

export function InquiryCartPage() {
  const { inquiryCart, removeFromInquiry, notify } = useAppStore();
  const cartProducts = products.filter((product) => inquiryCart.includes(product.id));
  const [quantities, setQuantities] = useState<Record<number, number>>(() =>
    Object.fromEntries(cartProducts.map((product) => [product.id, product.moq])),
  );
  const [step, setStep] = useState(1);
  const [complete, setComplete] = useState(false);

  const subtotal = cartProducts.reduce(
    (sum, product) => sum + product.wholesalePrice * (quantities[product.id] || product.moq),
    0,
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      setStep((value) => value + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    setComplete(true);
    notify("詢價單已送出，等待商家報價");
  };

  if (cartProducts.length === 0 && !complete) {
    return (
      <PublicLayout>
        <section className="cart-page empty-cart-page">
          <div className="container">
            <h1 className="sr-only">企業詢價單</h1>
            <EmptyState
              title="詢價單目前是空的"
              description="將想比較的商品或服務加入詢價單，就能一次整理需求。"
            />
            <Link to="/marketplace" className="btn btn-primary">
              前往商品市集
            </Link>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <section className="cart-page">
        <div className="container">
          <div className="cart-page-header">
            <span className="eyebrow">企業詢價單</span>
            <h1>整理需求，一次向商家詢價</h1>
            <p>目前為模擬流程，不會產生真實付款或訂單。</p>
          </div>
          <div className="cart-stepper">
            {[
              ["1", "確認項目"],
              ["2", "填寫需求"],
              ["3", "確認送出"],
            ].map(([number, label], index) => (
              <div key={number} className={step >= index + 1 ? "active" : ""}>
                <span>{step > index + 1 ? <Check weight="bold" /> : number}</span>
                <strong>{label}</strong>
              </div>
            ))}
          </div>
          {complete ? (
            <div className="order-success">
              <span>
                <Check weight="bold" />
              </span>
              <h2>詢價單已送出</h2>
              <p>詢價編號：BIQ-20260729-018。商家回覆報價後，你會在通知與詢價管理看到更新。</p>
              <div className="order-status-timeline">
                <div className="done">
                  <span />
                  <strong>詢價已送出</strong>
                  <small>2026/07/29 22:48</small>
                </div>
                <div>
                  <span />
                  <strong>等待商家報價</strong>
                  <small>預計 1 個工作天內</small>
                </div>
                <div>
                  <span />
                  <strong>確認模擬訂單</strong>
                  <small>尚未進行</small>
                </div>
              </div>
              <div>
                <Link to="/dashboard" className="btn btn-primary">
                  查看詢價管理
                </Link>
                <Link to="/marketplace" className="btn btn-outline">
                  繼續瀏覽市集
                </Link>
              </div>
            </div>
          ) : (
            <form className="cart-layout" onSubmit={submit}>
              <div className="cart-main">
                {step === 1 && (
                  <section className="detail-card">
                    <div className="cart-section-heading">
                      <div>
                        <h2>詢價項目</h2>
                        <p>確認商品、數量與供應商。</p>
                      </div>
                      <span>{cartProducts.length} 項</span>
                    </div>
                    <div className="cart-items">
                      {cartProducts.map((product) => {
                        const supplier = businesses.find((business) => business.id === product.businessId)!;
                        return (
                          <article key={product.id}>
                            <img src={product.image} alt={`${product.name} 縮圖`} />
                            <div className="cart-item-copy">
                              <span>{supplier.name}</span>
                              <Link to={`/marketplace/${product.slug}`}>{product.name}</Link>
                              <small>最低採購量 {product.moq} 件・企業參考價 NT$ {product.wholesalePrice.toLocaleString("zh-TW")}</small>
                            </div>
                            <label>
                              <span>數量</span>
                              <input
                                type="number"
                                min={product.moq}
                                value={quantities[product.id] || product.moq}
                                onChange={(event) =>
                                  setQuantities((current) => ({
                                    ...current,
                                    [product.id]: Number(event.target.value),
                                  }))
                                }
                              />
                            </label>
                            <button type="button" className="remove-cart-item" onClick={() => removeFromInquiry(product.id)}>
                              移除
                            </button>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                )}
                {step === 2 && (
                  <section className="detail-card">
                    <div className="cart-section-heading">
                      <div>
                        <h2>聯絡與需求資料</h2>
                        <p>商家會依這些資訊提供正式報價。</p>
                      </div>
                    </div>
                    <div className="form-grid-two">
                      <label className="field">
                        <span>聯絡人 *</span>
                        <input required defaultValue="王大明" />
                      </label>
                      <label className="field">
                        <span>公司／商家名稱 *</span>
                        <input required defaultValue="強哥水族" />
                      </label>
                    </div>
                    <div className="form-grid-two">
                      <label className="field">
                        <span>Email *</span>
                        <input required type="email" defaultValue="demo@baiye.local" />
                      </label>
                      <label className="field">
                        <span>電話 *</span>
                        <input required inputMode="tel" defaultValue="0912-345-678" />
                      </label>
                    </div>
                    <label className="field">
                      <span>希望交付地點 *</span>
                      <input required placeholder="縣市、區域或完整地址" />
                    </label>
                    <label className="field">
                      <span>希望交期 *</span>
                      <input required type="date" />
                    </label>
                    <label className="field">
                      <span>詢價需求說明 *</span>
                      <textarea required rows={6} placeholder="請說明規格、使用情境、預算與其他條件" />
                    </label>
                  </section>
                )}
                {step === 3 && (
                  <section className="detail-card">
                    <div className="cart-section-heading">
                      <div>
                        <h2>確認詢價資料</h2>
                        <p>送出後將分別通知 {new Set(cartProducts.map((product) => product.businessId)).size} 家供應商。</p>
                      </div>
                    </div>
                    <div className="cart-review-list">
                      {cartProducts.map((product) => {
                        const supplier = businesses.find((business) => business.id === product.businessId)!;
                        return (
                          <div key={product.id}>
                            <img src={product.image} alt={`${product.name} 確認縮圖`} />
                            <div>
                              <strong>{product.name}</strong>
                              <span>
                                {supplier.name}・數量 {quantities[product.id] || product.moq}
                              </span>
                            </div>
                            <small>等待正式報價</small>
                          </div>
                        );
                      })}
                    </div>
                    <label className="consent-row">
                      <input type="checkbox" required />
                      <span>我確認需求資料正確，並同意將聯絡資訊提供給上述供應商。</span>
                    </label>
                  </section>
                )}
              </div>
              <aside className="cart-summary">
                <h2>詢價摘要</h2>
                <dl>
                  <div>
                    <dt>項目數</dt>
                    <dd>{cartProducts.length} 項</dd>
                  </div>
                  <div>
                    <dt>供應商</dt>
                    <dd>{new Set(cartProducts.map((product) => product.businessId)).size} 家</dd>
                  </div>
                  <div>
                    <dt>參考總額</dt>
                    <dd>NT$ {subtotal.toLocaleString("zh-TW")}</dd>
                  </div>
                </dl>
                <p>
                  <Info /> 實際金額以供應商正式報價為準。
                </p>
                <button type="submit" className="btn btn-primary btn-lg">
                  {step === 3 ? "送出詢價單" : "繼續下一步"}
                  <ArrowRight />
                </button>
                {step > 1 && (
                  <button type="button" className="btn btn-ghost" onClick={() => setStep((value) => value - 1)}>
                    回上一步
                  </button>
                )}
                <div className="secure-note">
                  <ShieldCheck weight="fill" />
                  你的資料只會提供給本次詢價商家
                </div>
              </aside>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
