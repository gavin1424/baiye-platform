import {
  AppleLogo,
  ArrowLeft,
  ArrowRight,
  CaretRight,
  ChatCircleDots,
  Check,
  CheckCircle,
  CreditCard,
  Envelope,
  LockKey,
  MagnifyingGlass,
  Minus,
  NotePencil,
  Package,
  Phone,
  Plus,
  ShieldCheck,
  ShoppingCart,
  Storefront,
  Tag,
  Trash,
  Truck,
  User,
  WarningCircle,
  XCircle,
} from "@phosphor-icons/react";
import { useMemo, useState, type FormEvent, type SyntheticEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { EmptyState, PublicLayout, SectionHeading } from "../components";
import { formatPrice, fulfillmentLabels, shopCategories } from "../shop-data";
import { processPayment } from "../payment-client";
import type {
  FulfillmentType,
  ShopCustomer,
  ShopPaymentMethod,
  ShopProduct,
} from "../shop-types";
import { useAppStore } from "../store";

const fallbackImage = `${import.meta.env.BASE_URL}assets/hero-industry-collage.jpg`;

function handleImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.src.endsWith("hero-industry-collage.jpg")) return;
  image.src = fallbackImage;
}

function ShopBreadcrumb({ items }: { items: Array<{ label: string; to?: string }> }) {
  return (
    <nav className="shop-breadcrumb" aria-label="麵包屑">
      <Link to="/">首頁</Link>
      <CaretRight />
      <Link to="/shop">商城</Link>
      {items.map((item) => (
        <span key={item.label}>
          <CaretRight />
          {item.to ? <Link to={item.to}>{item.label}</Link> : <strong>{item.label}</strong>}
        </span>
      ))}
    </nav>
  );
}

function ExampleBadge() {
  return <span className="shop-example-badge">範例商品</span>;
}

function ShopProductCard({ product }: { product: ShopProduct }) {
  const { addToShopCart } = useAppStore();
  const soldOut = product.stock < 1;

  return (
    <article className="shop-product-card" data-testid={`product-card-${product.id}`}>
      <Link to={`/shop/${product.slug}`} className="shop-product-image">
        <img
          src={product.image}
          alt={`${product.name}範例商品示意圖`}
          loading="lazy"
          onError={handleImageError}
        />
        <ExampleBadge />
        {soldOut && <span className="shop-sold-out">暫時缺貨</span>}
      </Link>
      <div className="shop-product-card-body">
        <div className="shop-product-meta">
          <span>{product.category}</span>
          <span>{product.industry}</span>
        </div>
        <Link to={`/shop/${product.slug}`}>
          <h3>{product.name}</h3>
        </Link>
        <p>{product.shortDescription}</p>
        <div className="shop-product-price-row">
          <div>
            <strong>{formatPrice(product.price)}</strong>
            <del>{formatPrice(product.originalPrice)}</del>
          </div>
          <small>{soldOut ? "缺貨" : `庫存 ${product.stock}`}</small>
        </div>
        <div className="shop-product-actions">
          <Link to={`/shop/${product.slug}`} className="btn btn-outline btn-sm">
            查看商品
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={soldOut}
            onClick={() => addToShopCart(product.id)}
            data-testid={`add-cart-${product.id}`}
          >
            <ShoppingCart />
            {soldOut ? "無法購買" : "加入購物車"}
          </button>
        </div>
      </div>
    </article>
  );
}

export function ShopHomePage() {
  const { shopProducts, shopCart } = useAppStore();
  const [params, setParams] = useSearchParams();
  const [draftKeyword, setDraftKeyword] = useState(params.get("q") || "");
  const keyword = params.get("q") || "";
  const category = params.get("category") || "全部商品";
  const sort = params.get("sort") || "recommended";

  const visibleProducts = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLowerCase();
    const filtered = shopProducts.filter(
      (product) =>
        product.active &&
        (category === "全部商品" || product.category === category) &&
        (!normalizedKeyword ||
          [product.name, product.shortDescription, product.category, product.industry, product.brandName || ""]
            .join(" ")
            .toLowerCase()
            .includes(normalizedKeyword)),
    );
    return [...filtered].sort((a, b) => {
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      if (sort === "newest") return Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return Number(b.featured) - Number(a.featured) || a.id - b.id;
    });
  }, [category, keyword, shopProducts, sort]);

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (!value || (key === "category" && value === "全部商品") || (key === "sort" && value === "recommended")) {
      next.delete(key);
    } else {
      next.set(key, value);
    }
    setParams(next);
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setFilter("q", draftKeyword.trim());
  };

  return (
    <PublicLayout>
      <section className="shop-hero">
        <div className="container shop-hero-grid">
          <div className="shop-hero-copy">
            <span className="eyebrow"><Storefront weight="duotone" /> 創百業智慧鏈平台直營商城</span>
            <h1>精選在地好物與專業服務，<br />一次安心選購</h1>
            <p>商品由創百業智慧鏈平台統一上架與管理。一般訪客即可直接選購，不需申請商家帳號。</p>
            <form className="shop-hero-search" onSubmit={submitSearch} role="search">
              <MagnifyingGlass />
              <input
                value={draftKeyword}
                onChange={(event) => setDraftKeyword(event.target.value)}
                placeholder="搜尋商品、服務或所屬行業"
                aria-label="搜尋商城商品"
                data-testid="shop-search"
              />
              <button className="btn btn-accent" type="submit">搜尋商城</button>
            </form>
            <div className="shop-hero-points">
              <span><Check /> 平台統一管理</span>
              <span><Check /> 安全測試結帳</span>
              <span><Check /> 實體與服務商品</span>
            </div>
          </div>
          <div className="shop-hero-visual" aria-label="商城推薦商品預覽">
            {shopProducts.filter((product) => product.featured && product.active).slice(0, 3).map((product, index) => (
              <Link to={`/shop/${product.slug}`} className={`shop-hero-product shop-hero-product-${index + 1}`} key={product.id}>
                <img src={product.image} alt={`${product.name}推薦商品示意圖`} onError={handleImageError} />
                <span>
                  <small>{product.category}</small>
                  <strong>{product.name}</strong>
                  <b>{formatPrice(product.price)}</b>
                </span>
              </Link>
            ))}
            <Link to="/cart" className="shop-floating-cart" aria-label={`前往購物車，共 ${shopCart.reduce((sum, item) => sum + item.quantity, 0)} 件`}>
              <ShoppingCart weight="fill" />
              <span>{shopCart.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="shop-trust-strip">
        <div className="container">
          <div><Package weight="duotone" /><span><strong>12 項</strong><small>平台範例商品</small></span></div>
          <div><ShieldCheck weight="duotone" /><span><strong>測試付款</strong><small>目前不產生真實扣款</small></span></div>
          <div><Truck weight="duotone" /><span><strong>多元交付</strong><small>宅配、店到店與數位服務</small></span></div>
          <div><CreditCard weight="duotone" /><span><strong>TapPay 預留</strong><small>信用卡、Apple Pay、LINE Pay</small></span></div>
        </div>
      </section>

      <section className="section shop-catalog-section">
        <div className="container">
          <SectionHeading
            eyebrow="PLATFORM PICKS"
            title="推薦商品與服務"
            description="所有內容皆標示為範例商品，未來可由平台管理員直接替換正式資料與圖片。"
          />
          <div className="shop-category-chips" aria-label="商品分類">
            {shopCategories.map((item) => (
              <button
                type="button"
                className={category === item ? "active" : ""}
                onClick={() => setFilter("category", item)}
                key={item}
              >
                {item}
              </button>
            ))}
          </div>
          <div className="shop-catalog-toolbar">
            <div>
              <strong>找到 {visibleProducts.length} 項商品</strong>
              {(keyword || category !== "全部商品") && (
                <button
                  type="button"
                  className="text-button"
                  onClick={() => {
                    setDraftKeyword("");
                    setParams({});
                  }}
                >
                  清除篩選
                </button>
              )}
            </div>
            <label>
              <span>分類</span>
              <select
                value={category}
                onChange={(event) => setFilter("category", event.target.value)}
                data-testid="shop-category"
              >
                {shopCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>排序</span>
              <select value={sort} onChange={(event) => setFilter("sort", event.target.value)} data-testid="shop-sort">
                <option value="recommended">推薦排序</option>
                <option value="price-low">價格低至高</option>
                <option value="price-high">價格高至低</option>
                <option value="newest">最新上架</option>
              </select>
            </label>
          </div>
          {visibleProducts.length > 0 ? (
            <div className="shop-product-grid">
              {visibleProducts.map((product) => <ShopProductCard product={product} key={product.id} />)}
            </div>
          ) : (
            <EmptyState
              title="找不到符合條件的商品"
              description="請調整搜尋關鍵字或切換其他商品分類。"
              action={{ label: "查看全部商品", onClick: () => { setDraftKeyword(""); setParams({}); } }}
            />
          )}
        </div>
      </section>

      <section className="shop-test-notice">
        <div className="container">
          <span><LockKey weight="duotone" /></span>
          <div>
            <strong>目前為金流測試模式</strong>
            <p>付款流程可完整操作，但不會傳送或儲存完整卡號、安全碼，也不會產生真實扣款。</p>
          </div>
          <Link to="/faq" className="text-link">了解測試環境 <ArrowRight /></Link>
        </div>
      </section>
    </PublicLayout>
  );
}

export function ShopProductPage() {
  const { slug } = useParams();
  const { shopProducts, addToShopCart } = useAppStore();
  const [quantity, setQuantity] = useState(1);
  const product = shopProducts.find((item) => item.slug === slug && item.active);

  if (!product) {
    return (
      <PublicLayout>
        <div className="container shop-not-found">
          <EmptyState title="商品不存在或已下架" description="請回商城查看目前可購買的商品。" />
          <Link to="/shop" className="btn btn-primary"><ArrowLeft /> 返回商城</Link>
        </div>
      </PublicLayout>
    );
  }

  const soldOut = product.stock < 1;
  const related = shopProducts.filter((item) => item.active && item.id !== product.id && item.category === product.category).slice(0, 3);

  return (
    <PublicLayout>
      <div className="container shop-detail-page">
        <ShopBreadcrumb items={[{ label: product.name }]} />
        <section className="shop-detail-grid">
          <div className="shop-detail-media">
            <img src={product.image} alt={`${product.name}範例商品主圖`} onError={handleImageError} />
            <ExampleBadge />
            {soldOut && <span className="shop-sold-out">暫時缺貨</span>}
          </div>
          <div className="shop-detail-content">
            <div className="shop-product-meta"><span>{product.category}</span><span>{product.industry}</span></div>
            <h1>{product.name}</h1>
            <p className="shop-detail-lead">{product.shortDescription}</p>
            <div className="shop-detail-price"><strong>{formatPrice(product.price)}</strong><del>{formatPrice(product.originalPrice)}</del></div>
            <div className={`shop-stock-line ${soldOut ? "sold-out" : ""}`}>
              {soldOut ? <XCircle weight="fill" /> : <CheckCircle weight="fill" />}
              {soldOut ? "目前缺貨，無法加入購物車" : `尚有庫存 ${product.stock} 件`}
            </div>
            <div className="shop-fulfillment-list">
              {product.fulfillmentTypes.map((type) => (
                <span key={type}>{type === "delivery" ? <Truck /> : type === "store-pickup" ? <Storefront /> : <Envelope />}{fulfillmentLabels[type]}</span>
              ))}
            </div>
            <div className="shop-detail-purchase">
              <label>
                <span>數量</span>
                <div className="quantity-control">
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="減少數量"><Minus /></button>
                  <input
                    type="number"
                    min="1"
                    max={Math.max(1, product.stock)}
                    value={quantity}
                    onChange={(event) => setQuantity(Math.max(1, Math.min(product.stock || 1, Number(event.target.value) || 1)))}
                    aria-label="購買數量"
                  />
                  <button type="button" onClick={() => setQuantity((value) => Math.min(product.stock || 1, value + 1))} aria-label="增加數量"><Plus /></button>
                </div>
              </label>
              <button
                type="button"
                className="btn btn-primary btn-lg"
                disabled={soldOut}
                onClick={() => addToShopCart(product.id, quantity)}
                data-testid="detail-add-cart"
              >
                <ShoppingCart /> {soldOut ? "商品缺貨" : "加入購物車"}
              </button>
              <Link to="/cart" className="btn btn-outline btn-lg">查看購物車</Link>
            </div>
            <div className="shop-secure-note"><ShieldCheck weight="duotone" /><span><strong>平台統一管理</strong><small>本頁為範例商品，正式供應資訊上線前將由平台審核。</small></span></div>
          </div>
        </section>

        <section className="shop-detail-info-grid">
          <article>
            <span className="eyebrow">PRODUCT STORY</span>
            <h2>商品說明</h2>
            <p>{product.description}</p>
          </article>
          <article>
            <span className="eyebrow">DETAILS</span>
            <h2>商品特色</h2>
            <ul>{product.features.map((feature) => <li key={feature}><Check /> {feature}</li>)}</ul>
          </article>
          <aside>
            <h3>商品資訊</h3>
            <dl>
              <div><dt>商品編號</dt><dd>{product.sku}</dd></div>
              <div><dt>品牌欄位</dt><dd>{product.brandName}</dd></div>
              <div><dt>管理單位</dt><dd>{product.sellerName}</dd></div>
              <div><dt>資料來源</dt><dd>{product.sourceName}</dd></div>
            </dl>
          </aside>
        </section>

        {related.length > 0 && (
          <section className="shop-related-section">
            <SectionHeading title="你可能也會喜歡" description="同分類的其他平台精選範例商品。" />
            <div className="shop-product-grid">{related.map((item) => <ShopProductCard product={item} key={item.id} />)}</div>
          </section>
        )}
      </div>
    </PublicLayout>
  );
}

function useCartDetails() {
  const { shopCart, shopProducts } = useAppStore();
  const items = shopCart.flatMap((cartItem) => {
    const product = shopProducts.find((item) => item.id === cartItem.productId);
    return product ? [{ product, quantity: cartItem.quantity }] : [];
  });
  const subtotal = items.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  return { items, subtotal };
}

export function ShopCartPage() {
  const { updateShopCartQuantity, removeFromShopCart } = useAppStore();
  const { items, subtotal } = useCartDetails();

  return (
    <PublicLayout>
      <div className="container shop-flow-page" data-testid="cart-page">
        <ShopBreadcrumb items={[{ label: "購物車" }]} />
        <div className="shop-flow-heading">
          <div><span className="eyebrow">YOUR CART</span><h1>購物車</h1><p>確認商品數量與庫存，再前往測試結帳。</p></div>
          <Link to="/shop" className="btn btn-outline"><ArrowLeft /> 繼續選購</Link>
        </div>
        {items.length === 0 ? (
          <div className="shop-cart-empty">
            <ShoppingCart weight="duotone" />
            <h2>購物車還沒有商品</h2>
            <p>逛逛平台精選商品與專業服務，找到適合你的選擇。</p>
            <Link to="/shop" className="btn btn-primary">前往商城</Link>
          </div>
        ) : (
          <div className="shop-cart-layout">
            <section className="shop-cart-items" aria-label="購物車商品">
              {items.map(({ product, quantity }) => {
                const unavailable = !product.active || product.stock < quantity;
                return (
                  <article className={unavailable ? "unavailable" : ""} key={product.id} data-testid={`cart-item-${product.id}`}>
                    <Link to={`/shop/${product.slug}`}><img src={product.image} alt={`${product.name}購物車縮圖`} onError={handleImageError} /></Link>
                    <div className="shop-cart-item-info">
                      <span>{product.category} · {product.industry}</span>
                      <Link to={`/shop/${product.slug}`}><h2>{product.name}</h2></Link>
                      <small>{product.isExample ? "範例商品" : product.sku}</small>
                      {unavailable && <p><WarningCircle /> 庫存或上架狀態已變更</p>}
                    </div>
                    <div className="shop-cart-item-quantity">
                      <span>數量</span>
                      <div className="quantity-control">
                        <button type="button" onClick={() => updateShopCartQuantity(product.id, quantity - 1)} aria-label={`減少 ${product.name} 數量`}><Minus /></button>
                        <input
                          type="number"
                          min="1"
                          max={Math.max(1, product.stock)}
                          value={quantity}
                          onChange={(event) => updateShopCartQuantity(product.id, Number(event.target.value) || 1)}
                          aria-label={`${product.name}數量`}
                          data-testid={`cart-quantity-${product.id}`}
                        />
                        <button type="button" onClick={() => updateShopCartQuantity(product.id, quantity + 1)} aria-label={`增加 ${product.name} 數量`}><Plus /></button>
                      </div>
                    </div>
                    <strong className="shop-cart-line-total">{formatPrice(product.price * quantity)}</strong>
                    <button type="button" className="shop-cart-remove" onClick={() => removeFromShopCart(product.id)} aria-label={`移除 ${product.name}`} data-testid={`remove-cart-${product.id}`}><Trash /></button>
                  </article>
                );
              })}
            </section>
            <aside className="shop-order-summary">
              <h2>訂單摘要</h2>
              <dl>
                <div><dt>商品小計</dt><dd data-testid="cart-subtotal">{formatPrice(subtotal)}</dd></div>
                <div><dt>運費</dt><dd>結帳時計算</dd></div>
              </dl>
              <div className="shop-summary-total"><span>預估合計</span><strong>{formatPrice(subtotal)}</strong></div>
              <Link to="/checkout" className="btn btn-primary btn-lg">前往結帳 <ArrowRight /></Link>
              <p><LockKey /> 目前為測試付款，不會產生真實扣款。</p>
            </aside>
          </div>
        )}
      </div>
    </PublicLayout>
  );
}

type CheckoutErrors = Partial<Record<keyof ShopCustomer, string>>;

export function CheckoutPage() {
  const navigate = useNavigate();
  const { session, createShopOrder, updateShopOrderPayment, clearShopCart } = useAppStore();
  const { items, subtotal } = useCartDetails();
  const hasPhysical = items.some(({ product }) => product.fulfillmentTypes.some((type) => type !== "digital-service"));
  const hasDigital = items.some(({ product }) => product.fulfillmentTypes.includes("digital-service"));
  const [customer, setCustomer] = useState<ShopCustomer>({
    name: session.role === "guest" ? "" : session.name,
    phone: "",
    email: session.role === "guest" ? "" : session.email,
    address: "",
    note: "",
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [fulfillmentType, setFulfillmentType] = useState<FulfillmentType>(hasPhysical ? "delivery" : "digital-service");
  const [paymentMethod, setPaymentMethod] = useState<ShopPaymentMethod>("card");
  const [testOutcome, setTestOutcome] = useState<"success" | "failure" | "cancelled">("success");
  const [submitting, setSubmitting] = useState(false);
  const [applePayAvailable] = useState(() => {
    const appleWindow = window as typeof window & { ApplePaySession?: { canMakePayments: () => boolean } };
    try {
      return Boolean(appleWindow.ApplePaySession?.canMakePayments());
    } catch {
      return false;
    }
  });
  const shippingFee = fulfillmentType === "delivery" ? 120 : fulfillmentType === "store-pickup" ? 60 : 0;

  if (items.length === 0) {
    return (
      <PublicLayout>
        <div className="container shop-not-found">
          <EmptyState title="購物車沒有可結帳商品" description="請先加入商品，再回到結帳流程。" />
          <Link to="/shop" className="btn btn-primary">前往商城</Link>
        </div>
      </PublicLayout>
    );
  }

  const updateCustomer = (key: keyof ShopCustomer, value: string) => {
    setCustomer((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const validate = () => {
    const nextErrors: CheckoutErrors = {};
    if (customer.name.trim().length < 2) nextErrors.name = "請輸入至少 2 個字的姓名";
    if (!/^0[2-9]\d{7,8}$|^09\d{8}$/.test(customer.phone.replace(/[\s-]/g, ""))) nextErrors.phone = "請輸入有效的台灣電話號碼";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) nextErrors.email = "請輸入有效的 Email";
    if (fulfillmentType !== "digital-service" && customer.address.trim().length < 6) nextErrors.address = "請輸入完整收件地址或取貨門市資訊";
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    const order = createShopOrder({ customer, fulfillmentType, paymentMethod });
    if (!order) {
      setSubmitting(false);
      return;
    }
    try {
      const payment = await processPayment({
        checkoutId: order.orderNumber,
        items: order.items,
        customer,
        fulfillmentType,
        paymentMethod,
        testOutcome,
      });
      updateShopOrderPayment(order.orderNumber, payment.status, payment.providerReference);
      if (payment.status === "paid") {
        clearShopCart();
      }
      const routeResult = payment.status === "paid" ? "success" : payment.status === "cancelled" ? "cancelled" : "failure";
      navigate(`/payment/${routeResult}?order=${encodeURIComponent(order.orderNumber)}`);
    } catch {
      updateShopOrderPayment(order.orderNumber, "failed");
      navigate(`/payment/failure?order=${encodeURIComponent(order.orderNumber)}`);
    }
  };

  return (
    <PublicLayout>
      <div className="container shop-flow-page shop-checkout-page" data-testid="checkout-page">
        <ShopBreadcrumb items={[{ label: "購物車", to: "/cart" }, { label: "結帳" }]} />
        <div className="shop-flow-heading">
          <div><span className="eyebrow">SECURE CHECKOUT</span><h1>完成訂購資料</h1><p>此為 TapPay 串接前的測試結帳流程，不會產生真實扣款。</p></div>
          <span className="shop-test-pill"><LockKey /> 測試付款</span>
        </div>
        <form className="shop-checkout-layout" onSubmit={submit} noValidate>
          <div className="shop-checkout-sections">
            <section className="shop-checkout-card">
              <header><span>1</span><div><h2>顧客資料</h2><p>訂單通知與交付聯繫使用。</p></div></header>
              <div className="shop-form-grid">
                <label className={errors.name ? "has-error" : ""}><span><User /> 顧客姓名 *</span><input value={customer.name} onChange={(event) => updateCustomer("name", event.target.value)} autoComplete="name" data-testid="checkout-name" />{errors.name && <small>{errors.name}</small>}</label>
                <label className={errors.phone ? "has-error" : ""}><span><Phone /> 聯絡電話 *</span><input value={customer.phone} onChange={(event) => updateCustomer("phone", event.target.value)} inputMode="tel" autoComplete="tel" placeholder="0912345678" data-testid="checkout-phone" />{errors.phone && <small>{errors.phone}</small>}</label>
                <label className={`full ${errors.email ? "has-error" : ""}`}><span><Envelope /> Email *</span><input type="email" value={customer.email} onChange={(event) => updateCustomer("email", event.target.value)} autoComplete="email" data-testid="checkout-email" />{errors.email && <small>{errors.email}</small>}</label>
                <label className={`full ${errors.address ? "has-error" : ""}`}><span><Truck /> 地址／取貨門市{fulfillmentType !== "digital-service" ? " *" : ""}</span><input value={customer.address} onChange={(event) => updateCustomer("address", event.target.value)} autoComplete="street-address" placeholder={fulfillmentType === "digital-service" ? "數位商品可不填" : fulfillmentType === "store-pickup" ? "請填寫取貨門市名稱與店號" : "請填寫完整收件地址"} data-testid="checkout-address" />{errors.address && <small>{errors.address}</small>}</label>
                <label className="full"><span><NotePencil /> 訂單備註</span><textarea rows={3} value={customer.note} onChange={(event) => updateCustomer("note", event.target.value)} placeholder="例如：方便聯繫時段、服務需求或送禮備註" data-testid="checkout-note" /></label>
              </div>
            </section>

            <section className="shop-checkout-card">
              <header><span>2</span><div><h2>訂單交付方式</h2><p>{hasPhysical && hasDigital ? "實體商品依選擇配送，數位服務將以 Email 聯繫。" : "依商品類型選擇適用的交付方式。"}</p></div></header>
              <div className="shop-option-grid fulfillment-options">
                {hasPhysical && (
                  <>
                    <label className={fulfillmentType === "delivery" ? "selected" : ""}><input type="radio" name="fulfillment" value="delivery" checked={fulfillmentType === "delivery"} onChange={() => setFulfillmentType("delivery")} /><Truck /><span><strong>宅配</strong><small>運費 {formatPrice(120)}</small></span></label>
                    <label className={fulfillmentType === "store-pickup" ? "selected" : ""}><input type="radio" name="fulfillment" value="store-pickup" checked={fulfillmentType === "store-pickup"} onChange={() => setFulfillmentType("store-pickup")} /><Storefront /><span><strong>店到店</strong><small>運費 {formatPrice(60)}</small></span></label>
                  </>
                )}
                {!hasPhysical && (
                  <label className="selected"><input type="radio" name="fulfillment" checked readOnly /><Envelope /><span><strong>數位商品／服務</strong><small>付款後由平台 Email 聯繫</small></span></label>
                )}
              </div>
            </section>

            <section className="shop-checkout-card">
              <header><span>3</span><div><h2>付款方式</h2><p>正式版預計由 TapPay 統一處理，網站不接觸完整卡號與安全碼。</p></div></header>
              <div className="shop-payment-test-banner"><WarningCircle weight="fill" /><div><strong>測試付款</strong><p>目前未載入正式金流金鑰，所有結果皆為模擬，不會扣款。</p></div></div>
              <div className="shop-payment-options">
                <label className={paymentMethod === "card" ? "selected" : ""}>
                  <input type="radio" name="payment" value="card" checked={paymentMethod === "card"} onChange={() => setPaymentMethod("card")} />
                  <CreditCard /><span><strong>Visa／Mastercard 信用卡</strong><small>正式版使用 TapPay Fields 取得一次性 Prime，不由本網站儲存卡號或安全碼。</small></span>
                </label>
                {applePayAvailable && (
                  <label className={paymentMethod === "apple-pay" ? "selected" : ""} data-testid="apple-pay-option">
                    <input type="radio" name="payment" value="apple-pay" checked={paymentMethod === "apple-pay"} onChange={() => setPaymentMethod("apple-pay")} />
                    <AppleLogo weight="fill" /><span><strong>Apple Pay</strong><small>僅在支援且具有有效付款卡片的裝置顯示。</small></span>
                  </label>
                )}
                <label className={paymentMethod === "line-pay" ? "selected" : ""}>
                  <input type="radio" name="payment" value="line-pay" checked={paymentMethod === "line-pay"} onChange={() => setPaymentMethod("line-pay")} />
                  <ChatCircleDots weight="fill" /><span><strong>LINE Pay</strong><small>正式版將導向 LINE Pay 授權並返回訂單結果。</small></span>
                </label>
              </div>
              <label className="shop-test-outcome"><span>測試付款結果</span><select value={testOutcome} onChange={(event) => setTestOutcome(event.target.value as typeof testOutcome)} data-testid="test-payment-outcome"><option value="success">模擬付款成功</option><option value="failure">模擬付款失敗</option><option value="cancelled">模擬使用者取消</option></select><small>測試用：可驗證成功、失敗與取消三種狀態頁。</small></label>
            </section>
          </div>

          <aside className="shop-order-summary checkout-summary">
            <h2>訂單摘要</h2>
            <div className="checkout-summary-items">
              {items.map(({ product, quantity }) => (
                <div key={product.id}><img src={product.image} alt="" onError={handleImageError} /><span><strong>{product.name}</strong><small>{quantity} × {formatPrice(product.price)}</small></span><b>{formatPrice(product.price * quantity)}</b></div>
              ))}
            </div>
            <dl>
              <div><dt>商品小計</dt><dd>{formatPrice(subtotal)}</dd></div>
              <div><dt>運費</dt><dd>{shippingFee ? formatPrice(shippingFee) : "免運費"}</dd></div>
            </dl>
            <div className="shop-summary-total"><span>訂單總額</span><strong data-testid="checkout-total">{formatPrice(subtotal + shippingFee)}</strong></div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting} data-testid="submit-test-payment">{submitting ? "建立測試訂單中…" : "送出測試付款"} <ArrowRight /></button>
            <p><ShieldCheck /> 送出即表示同意平台使用條款與隱私權政策。</p>
          </aside>
        </form>
      </div>
    </PublicLayout>
  );
}

export function PaymentResultPage() {
  const { result } = useParams();
  const [params] = useSearchParams();
  const orderNumber = params.get("order") || "";
  const { shopOrders } = useAppStore();
  const order = shopOrders.find((item) => item.orderNumber === orderNumber);
  const state = result === "success" ? "success" : result === "failure" ? "failure" : "cancelled";
  const content = {
    success: {
      icon: <CheckCircle weight="fill" />,
      eyebrow: "PAYMENT SUCCESS",
      title: "測試付款成功，訂單已成立",
      description: "這是測試交易，不會產生真實扣款。訂單已儲存在本機，管理員可於訂單管理查看。",
    },
    failure: {
      icon: <XCircle weight="fill" />,
      eyebrow: "PAYMENT FAILED",
      title: "測試付款失敗",
      description: "本次模擬付款未完成，購物車內容仍保留，可返回結帳重新測試。",
    },
    cancelled: {
      icon: <WarningCircle weight="fill" />,
      eyebrow: "PAYMENT CANCELLED",
      title: "已取消測試付款",
      description: "本次付款流程由使用者取消，沒有產生任何扣款，購物車內容仍保留。",
    },
  }[state];

  return (
    <PublicLayout>
      <div className={`container shop-payment-result result-${state}`} data-testid={`payment-${state}`}>
        <div className="shop-result-icon">{content.icon}</div>
        <span className="eyebrow">{content.eyebrow}</span>
        <h1>{content.title}</h1>
        <p>{content.description}</p>
        {order && (
          <section className="shop-result-order">
            <div><span>訂單編號</span><strong data-testid="order-number">{order.orderNumber}</strong></div>
            <div><span>訂單金額</span><strong>{formatPrice(order.total)}</strong></div>
            <div><span>付款狀態</span><strong>{order.paymentStatus === "paid" ? "測試已付款" : order.paymentStatus === "failed" ? "付款失敗" : "已取消"}</strong></div>
            <div><span>訂單類型</span><strong>{fulfillmentLabels[order.fulfillmentType]}</strong></div>
          </section>
        )}
        <div className="shop-result-actions">
          {state === "success" ? <Link to="/shop" className="btn btn-primary">繼續逛商城</Link> : <Link to="/checkout" className="btn btn-primary">返回結帳重試</Link>}
          <Link to="/" className="btn btn-outline">回到平台首頁</Link>
        </div>
        <small><LockKey /> 測試模式：此頁不代表真實收款或金流授權結果。</small>
      </div>
    </PublicLayout>
  );
}
