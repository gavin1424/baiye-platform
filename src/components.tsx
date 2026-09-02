import {
  ArrowRight,
  Bell,
  BookmarkSimple,
  Briefcase,
  Buildings,
  CalendarBlank,
  Camera,
  CaretDown,
  CaretRight,
  ChatCircleDots,
  Check,
  CirclesFour,
  Code,
  Envelope,
  FishSimple,
  Flower,
  ForkKnife,
  GraduationCap,
  GridFour,
  Hammer,
  Handshake,
  Heart,
  House,
  ListDashes,
  MagnifyingGlass,
  MapPin,
  Megaphone,
  Package,
  PaperPlaneTilt,
  PawPrint,
  Phone,
  Plus,
  Scales,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SignOut,
  SlidersHorizontal,
  Snowflake,
  Star,
  Storefront,
  Toolbox,
  Truck,
  UploadSimple,
  UserCircle,
  Wrench,
  X,
  type IconProps,
} from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAppStore } from "./store";
import type { Business, CollaborationNeed, Product } from "./types";

// Production V2 does not bundle the legacy showcase catalogue. Public merchant data
// is rendered only by the verified production directory.
const businesses: Business[] = [];

export function PlatformLogo({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="platform-logo" aria-label="創百業智慧鏈首頁">
      <img
        src={`${import.meta.env.BASE_URL}brand/chuang-baiye-header-logo.png`}
        alt="創百業智慧鏈藍金 AI 智慧鏈圖騰"
        className="brand-logo"
      />
      {!compact && (
        <span className="brand-copy">
          <strong>創百業智慧鏈</strong>
          <small>AI INDUSTRY SMART CHAIN</small>
        </span>
      )}
    </Link>
  );
}

const navItems = [
  ["找商家", "/businesses"],
  ["商家方案", "/pricing"],
  ["正式案例", "/businesses"],
  ["如何運作", "/how-it-works"],
];

export function Header() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { session, logout, inquiryCart, shopCart } = useAppStore();
  const shopCartCount = shopCart.reduce((sum, item) => sum + item.quantity, 0);
  const isBusiness = session.role === "business";
  const accountPath = session.role === "admin" ? "/admin" : isBusiness ? "/dashboard" : "/account";
  const accountLabel = session.role === "admin" ? "管理員後台" : isBusiness ? "商家後台" : "免費會員帳號";

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`site-header ${scrolled ? "is-scrolled" : ""}`}>
      <div className="header-inner">
        <PlatformLogo />
        <nav className="desktop-nav" aria-label="主要導覽">
          {navItems.map(([label, to]) => (
            <NavLink key={`${label}:${to}`} to={to}>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="header-actions">
          <Link to="/partner" className="btn btn-outline btn-sm header-partner-link">
            承攬夥伴
          </Link>
          {isBusiness && (
            <>
              <Link to="/inquiry-cart" className="header-icon" aria-label={`詢價單，${inquiryCart.length} 個項目`}>
                <ShoppingBag />
                {inquiryCart.length > 0 && <span className="count-badge">{inquiryCart.length}</span>}
              </Link>
              <Link to="/notifications" className="header-icon" aria-label="通知中心">
                <Bell />
                <span className="notification-dot" />
              </Link>
            </>
          )}
          {session.role === "guest" ? (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm header-login">
                管理員登入
              </Link>
              <Link to="/pricing" className="btn btn-primary btn-sm header-register">
                商家加入
              </Link>
            </>
          ) : (
            <div className="account-menu">
              <Link to={accountPath} className="account-chip">
                <span className="avatar avatar-sm">{session.name.slice(0, 1)}</span>
                <span>{session.name}</span>
                <CaretDown />
              </Link>
              <div className="account-popover">
                <Link to={accountPath}>
                  <UserCircle /> {accountLabel}
                </Link>
                {session.role === "member" && (
                  <Link to="/cart">
                    <ShoppingCart /> 購物車
                  </Link>
                )}
                <button type="button" onClick={logout}>
                  <SignOut /> 登出
                </button>
              </div>
            </div>
          )}
          <button
            type="button"
            className="mobile-menu-button"
            aria-label={menuOpen ? "關閉選單" : "開啟選單"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((value) => !value)}
          >
            {menuOpen ? <X /> : <ListDashes />}
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="mobile-menu">
          {navItems.map(([label, to]) => (
            <NavLink key={`${label}:${to}`} to={to}>
              {label}
              <CaretRight />
            </NavLink>
          ))}
          <NavLink to="/pricing">
            方案與價格
            <CaretRight />
          </NavLink>
          <NavLink to="/partner">
            承攬夥伴
            <CaretRight />
          </NavLink>
          {session.role === "guest" ? (
            <div className="mobile-menu-actions">
              <Link to="/login" className="btn btn-outline">
                管理員登入
              </Link>
              <Link to="/pricing" className="btn btn-primary">
                商家加入
              </Link>
            </div>
          ) : (
            <Link to={accountPath} className="btn btn-primary">
              {session.role === "member" ? "前往免費會員帳號" : `前往${session.role === "admin" ? "管理員" : "商家"}後台`}
            </Link>
          )}
        </div>
      )}
    </header>
  );
}

export function Footer() {
  const { session } = useAppStore();
  const siteEditorPath =
    session.role === "business" ? "/dashboard/site-editor" : session.role === "admin" ? "/admin" : "/pricing";

  return (
    <footer className="site-footer">
      <div className="container footer-main">
        <div className="footer-brand">
          <PlatformLogo />
          <p>每個行業，都值得擁有自己的網站。</p>
          <span>展示專業、媒合合作、加速商業成長，讓全台百業在這裡被看見。</span>
        </div>
        <div className="footer-columns">
          <div>
            <strong>探索平台</strong>
            <Link to="/businesses">找商家</Link>
            <Link to="/collaborations">合作需求</Link>
            <Link to="/pricing">商家方案</Link>
          </div>
          <div>
            <strong>商家服務</strong>
            <Link to="/pricing">商家 AI 數位升級</Link>
            <Link to="/pricing">方案與價格</Link>
            <Link to="/how-it-works">如何運作</Link>
            <Link to="/services/deposit-settlement">訂金代收與月結對帳</Link>
            <Link to="/success-stories">成功案例</Link>
          </div>
          <div>
            <strong>承攬夥伴</strong>
            <Link to="/partner/apply">申請成為承攬夥伴</Link>
            <Link to="/partner/login">承攬夥伴登入</Link>
            <Link to="/partner">承攬夥伴中心</Link>
          </div>
          <div>
            <strong>關於我們</strong>
            <Link to="/about">關於平台</Link>
            <Link to="/faq">常見問題</Link>
            <Link to="/contact">聯絡我們</Link>
            <Link to="/report">檢舉內容</Link>
          </div>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 創百業智慧鏈｜AI 智慧網站與百業數位升級平台</span>
        <div>
          <Link to="/privacy">隱私權政策</Link>
          <Link to="/terms">使用條款</Link>
        </div>
      </div>
    </footer>
  );
}

export function MobileBottomNav() {
  const { session } = useAppStore();
  const items = [
    { label: "首頁", to: "/", icon: House },
    { label: "搜尋", to: "/businesses", icon: MagnifyingGlass },
    { label: "發布需求", to: "/collaborations/new", icon: Plus, primary: true },
    { label: "私訊", to: "/messages", icon: ChatCircleDots },
    {
      label: "我的",
      to: session.role === "admin" ? "/admin" : session.role === "business" ? "/dashboard" : "/login",
      icon: UserCircle,
    },
  ];
  return (
    <nav className="mobile-bottom-nav" aria-label="手機版主要導覽">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.label}
            to={item.to}
            className={({ isActive }) => [item.primary ? "bottom-primary" : "", isActive ? "active" : ""].filter(Boolean).join(" ")}
          >
            <span>
              <Icon weight={item.primary ? "bold" : "regular"} />
            </span>
            {item.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

export function PublicLayout({ children, hideFooter = false }: { children: ReactNode; hideFooter?: boolean }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        跳到主要內容
      </a>
      <Header />
      <main id="main-content">{children}</main>
      {!hideFooter && <Footer />}
      <MobileBottomNav />
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: { label: string; to: string };
}) {
  return (
    <div className="section-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {action && (
        <Link to={action.to} className="text-link">
          {action.label}
          <ArrowRight />
        </Link>
      )}
    </div>
  );
}

const industryIcons: Record<string, ComponentType<IconProps>> = {
  居家修繕: Toolbox,
  工程營造: Buildings,
  水電冷氣: Snowflake,
  木工鐵工: Hammer,
  設計裝潢: Flower,
  攝影錄影: Camera,
  影音剪輯: Camera,
  廣告行銷: Megaphone,
  網站與程式: Code,
  餐飲美食: ForkKnife,
  食品供應: Package,
  農漁畜牧: Flower,
  批發零售: ShoppingBag,
  電商服務: ShoppingBag,
  美容美髮: Flower,
  健康健身: Heart,
  教育顧問: GraduationCap,
  法律會計: Scales,
  婚禮活動: Heart,
  物流運輸: Truck,
  汽機車服務: Wrench,
  寵物服務: PawPrint,
  文創手作: Flower,
  印刷包裝: Package,
  清潔除蟲: ShieldCheck,
  其他專業服務: Briefcase,
};

export function IndustryIcon({
  category,
  size = 22,
  weight = "regular",
}: {
  category: string;
  size?: number;
  weight?: IconProps["weight"];
}) {
  const Icon = industryIcons[category] || Briefcase;
  return <Icon size={size} weight={weight} />;
}

export function BusinessLogo({ business, size = "md" }: { business: Business; size?: "sm" | "md" | "lg" }) {
  return (
    <span
      className={`business-logo logo-${size}`}
      style={{ "--logo-color": business.accent } as CSSProperties}
      aria-label={`${business.name} Logo`}
    >
      <IndustryIcon category={business.category} size={size === "lg" ? 34 : size === "md" ? 25 : 20} weight="duotone" />
      <small>{business.shortName}</small>
    </span>
  );
}

export function Rating({ value, count, compact = false }: { value: number; count?: number; compact?: boolean }) {
  return (
    <span className={`rating ${compact ? "rating-compact" : ""}`} aria-label={`${value} 顆星`}>
      <Star weight="fill" />
      <strong>{value.toFixed(1)}</strong>
      {count !== undefined && <span>({count})</span>}
    </span>
  );
}

export function TrustBadges({ business, compact = false }: { business: Business; compact?: boolean }) {
  const badges = [
    business.verified && { label: "商業認證", icon: SealCheck },
    business.invoice && { label: "可開發票", icon: Check },
    business.enterprise && { label: "企業合作", icon: Handshake },
    business.recommended && { label: "平台推薦", icon: Star },
  ].filter(Boolean) as { label: string; icon: ComponentType<IconProps> }[];
  return (
    <div className={`trust-badges ${compact ? "compact" : ""}`}>
      {badges.slice(0, compact ? 2 : 4).map((badge) => {
        const Icon = badge.icon;
        return (
          <span key={badge.label}>
            <Icon weight="fill" />
            {badge.label}
          </span>
        );
      })}
    </div>
  );
}

export function FavoriteButton({
  active,
  onClick,
  label = "收藏",
  iconOnly = false,
}: {
  active: boolean;
  onClick: () => void;
  label?: string;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={`favorite-button ${active ? "is-active" : ""} ${iconOnly ? "icon-only" : ""}`}
      onClick={onClick}
      aria-pressed={active}
      aria-label={active ? `取消${label}` : label}
    >
      <Heart weight={active ? "fill" : "regular"} />
      {!iconOnly && (active ? `已${label}` : label)}
    </button>
  );
}

export function BusinessCard({ business, view = "card" }: { business: Business; view?: "card" | "list" }) {
  const { businessFavorites, toggleBusinessFavorite } = useAppStore();
  return (
    <article className={`business-card business-card-${view}`}>
      <Link to={`/business/${business.slug}`} className="business-cover-link" aria-label={`查看 ${business.name}`}>
        <img src={business.cover} alt={`${business.name} 服務環境與作品封面`} loading="lazy" />
        <span className="cover-location">
          <MapPin weight="fill" />
          {business.location}
        </span>
      </Link>
      <div className="business-card-body">
        <div className="business-card-top">
          <BusinessLogo business={business} size={view === "list" ? "md" : "sm"} />
          <FavoriteButton
            active={businessFavorites.includes(business.id)}
            onClick={() => toggleBusinessFavorite(business.id)}
            iconOnly
            label="收藏商家"
          />
        </div>
        <div className="business-card-title">
          <Link to={`/business/${business.slug}`}>{business.name}</Link>
          {business.verified && <SealCheck weight="fill" aria-label="已認證商家" />}
        </div>
        <p>{business.tagline}</p>
        <div className="business-meta">
          <Rating value={business.rating} count={business.reviewCount} compact />
          <span>{business.category}</span>
        </div>
        <TrustBadges business={business} compact />
        <div className="business-card-actions">
          <Link to={`/messages?business=${business.id}`} className="btn btn-outline btn-sm">
            立即詢問
          </Link>
          <Link to={`/business/${business.slug}`} className="btn btn-primary btn-sm">
            查看商家
          </Link>
        </div>
      </div>
    </article>
  );
}

export function ProductCard({ product }: { product: Product }) {
  const { productFavorites, toggleProductFavorite, addToInquiry } = useAppStore();
  const supplier = businesses.find((business) => business.id === product.businessId)!;
  return (
    <article className="product-card">
      <div className="product-image">
        <Link to={`/marketplace/${product.slug}`} aria-label={`查看 ${product.name}`}>
          <img src={product.image} alt={`${product.name} 商品或服務照片`} loading="lazy" />
        </Link>
        <span className="product-type">{product.type}</span>
        <FavoriteButton
          active={productFavorites.includes(product.id)}
          onClick={() => toggleProductFavorite(product.id)}
          iconOnly
          label="收藏商品"
        />
      </div>
      <div className="product-body">
        <span className="product-supplier">{supplier.name}</span>
        <Link className="product-name" to={`/marketplace/${product.slug}`}>
          {product.name}
        </Link>
        <Rating value={product.rating} count={product.reviewCount} compact />
        <div className="product-price">
          <div>
            <small>參考價格</small>
            <strong>NT$ {product.price.toLocaleString("zh-TW")}</strong>
          </div>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => addToInquiry(product.id)}>
            詢價
          </button>
        </div>
      </div>
    </article>
  );
}

export function NeedCard({ need, compact = false }: { need: CollaborationNeed; compact?: boolean }) {
  const { needFavorites, toggleNeedFavorite, proposals } = useAppStore();
  const publisher = businesses.find((business) => business.id === need.publisherId)!;
  return (
    <article className={`need-card ${compact ? "need-card-compact" : ""}`}>
      <div className="need-icon" style={{ "--need-accent": publisher.accent } as CSSProperties}>
        <IndustryIcon category={need.category} size={compact ? 23 : 28} weight="duotone" />
      </div>
      <div className="need-content">
        <div className="need-heading">
          <div>
            <div className="tag-row">
              {need.urgent && <span className="tag tag-danger">急件</span>}
              <span className="tag">{need.type}</span>
              <span className="tag tag-muted">{need.category}</span>
            </div>
            <Link to={`/collaborations/${need.id}`}>{need.title}</Link>
          </div>
          <FavoriteButton
            active={needFavorites.includes(need.id)}
            onClick={() => toggleNeedFavorite(need.id)}
            iconOnly
            label="追蹤需求"
          />
        </div>
        {!compact && <p>{need.description}</p>}
        <div className="need-meta-grid">
          <span>
            <Briefcase />
            <small>預算</small>
            {need.budget}
          </span>
          <span>
            <MapPin />
            <small>地區</small>
            {need.location}
          </span>
          <span>
            <CalendarBlank />
            <small>截止</small>
            {need.deadline}
          </span>
          <span>
            <UserCircle />
            <small>提案</small>
            {need.proposals} 份
          </span>
        </div>
      </div>
      <div className="need-action">
        <span>{publisher.name}</span>
        <Link to={`/collaborations/${need.id}`} className={`btn ${proposals.includes(need.id) ? "btn-success" : "btn-outline"} btn-sm`}>
          {proposals.includes(need.id) ? "已提案" : "立即提案"}
        </Link>
      </div>
    </article>
  );
}

export function SearchBar({
  initialKeyword = "",
  initialCategory = "",
  initialLocation = "",
  variant = "hero",
}: {
  initialKeyword?: string;
  initialCategory?: string;
  initialLocation?: string;
  variant?: "hero" | "compact";
}) {
  const [keyword, setKeyword] = useState(initialKeyword);
  const [category, setCategory] = useState(initialCategory);
  const [location, setLocation] = useState(initialLocation);
  const navigate = useNavigate();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const params = new URLSearchParams();
    if (keyword) params.set("q", keyword);
    if (category) params.set("category", category);
    if (location) params.set("location", location);
    navigate(`/businesses?${params.toString()}`);
  };

  return (
    <form className={`search-bar search-bar-${variant}`} onSubmit={submit} role="search">
      <label className="search-keyword">
        <MagnifyingGlass />
        <span className="sr-only">關鍵字</span>
        <input
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="搜尋行業、服務、商品或商家名稱"
        />
      </label>
      <label>
        <span className="sr-only">行業分類</span>
        <select value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="">所有行業</option>
          <option value="水電冷氣">水電冷氣</option>
          <option value="設計裝潢">設計裝潢</option>
          <option value="食品供應">食品供應</option>
          <option value="網站與程式">網站與程式</option>
          <option value="攝影錄影">攝影錄影</option>
        </select>
      </label>
      <label>
        <MapPin />
        <span className="sr-only">地區</span>
        <select value={location} onChange={(event) => setLocation(event.target.value)}>
          <option value="">全台地區</option>
          <option>台北市</option>
          <option>新北市</option>
          <option>桃園市</option>
          <option>台中市</option>
          <option>台南市</option>
          <option>高雄市</option>
        </select>
      </label>
      <button type="submit" className="btn btn-primary">
        <MagnifyingGlass />
        搜尋
      </button>
    </form>
  );
}

export function Modal({
  open,
  title,
  children,
  onClose,
  actions,
  size = "md",
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  useEffect(() => {
    if (!open) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", close);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", close);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button type="button" className="icon-button" onClick={onClose} aria-label="關閉">
            <X />
          </button>
        </header>
        <div className="modal-content">{children}</div>
        {actions && <footer>{actions}</footer>}
      </section>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="empty-state">
      <span>
        <MagnifyingGlass />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action && (
        <button type="button" className="btn btn-primary" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}

export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="skeleton-grid" aria-label="載入中" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <div className="skeleton-card" key={index}>
          <span className="skeleton skeleton-image" />
          <span className="skeleton skeleton-line lg" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line sm" />
        </div>
      ))}
    </div>
  );
}

export function ShareButton({ title }: { title: string }) {
  const { notify } = useAppStore();
  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title, url: window.location.href });
      return;
    }
    await navigator.clipboard.writeText(window.location.href);
    notify("連結已複製");
  };
  return (
    <button type="button" className="btn btn-outline" onClick={share}>
      <ShareNetwork />
      分享
    </button>
  );
}

export function FilterDrawerButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="btn btn-outline mobile-filter-button" onClick={onClick}>
      <SlidersHorizontal />
      篩選
    </button>
  );
}

export function ViewToggle({
  view,
  onChange,
}: {
  view: "card" | "list";
  onChange: (view: "card" | "list") => void;
}) {
  return (
    <div className="view-toggle" aria-label="顯示模式">
      <button type="button" className={view === "card" ? "active" : ""} onClick={() => onChange("card")} aria-label="卡片模式">
        <GridFour weight="fill" />
      </button>
      <button type="button" className={view === "list" ? "active" : ""} onClick={() => onChange("list")} aria-label="列表模式">
        <ListDashes />
      </button>
    </div>
  );
}

export function Pagination({ page, pages, onChange }: { page: number; pages: number; onChange: (page: number) => void }) {
  const visible = useMemo(() => Array.from({ length: Math.min(pages, 5) }, (_, index) => index + 1), [pages]);
  return (
    <nav className="pagination" aria-label="分頁">
      <button type="button" disabled={page === 1} onClick={() => onChange(page - 1)}>
        ‹
      </button>
      {visible.map((item) => (
        <button type="button" key={item} className={page === item ? "active" : ""} onClick={() => onChange(item)}>
          {item}
        </button>
      ))}
      {pages > 5 && <span>…</span>}
      <button type="button" disabled={page === pages} onClick={() => onChange(page + 1)}>
        ›
      </button>
    </nav>
  );
}

export {
  Bell,
  BookmarkSimple,
  Briefcase,
  CalendarBlank,
  Camera,
  CaretDown,
  ChatCircleDots,
  Check,
  Envelope,
  FishSimple,
  GridFour,
  Handshake,
  Heart,
  House,
  MagnifyingGlass,
  MapPin,
  Package,
  PaperPlaneTilt,
  Phone,
  Plus,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Star,
  Storefront,
  UploadSimple,
  UserCircle,
};
