import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Bell,
  BookmarkSimple,
  Briefcase,
  CaretDown,
  ChartBar,
  ChartLineUp,
  ChatCircleDots,
  Check,
  ClipboardText,
  Clock,
  CurrencyCircleDollar,
  DotsThree,
  Envelope,
  Eye,
  FileArrowUp,
  FileText,
  Gear,
  Globe,
  GridFour,
  Handshake,
  Heart,
  Image as ImageIcon,
  Info,
  ListDashes,
  MagnifyingGlass,
  Monitor,
  NotePencil,
  Package,
  PaperPlaneTilt,
  PencilSimple,
  Phone,
  Plus,
  Receipt,
  SealCheck,
  ShareNetwork,
  ShieldCheck,
  ShoppingBag,
  Sidebar,
  SignOut,
  SlidersHorizontal,
  Sparkle,
  Star,
  Storefront,
  Tag,
  Trash,
  TrendUp,
  UploadSimple,
  UserCircle,
  UsersThree,
  X,
  type IconProps,
} from "@phosphor-icons/react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ComponentType,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import {
  BusinessLogo,
  IndustryIcon,
  Modal,
  PlatformLogo,
  ProductCard,
  PublicLayout,
  Rating,
} from "../components";
import { businesses, collaborationNeeds, conversations, products, quoteRecords, reviews } from "../data";
import { useAppStore } from "../store";
import type { Conversation, Product, SiteSettings } from "../types";

const dashboardNav = [
  { label: "總覽", to: "/dashboard", icon: GridFour, exact: true },
  { label: "我的網站", to: "/dashboard/site-editor", icon: Globe },
  { label: "商家資料", to: "/dashboard/profile", icon: Storefront },
  { label: "商品與服務", to: "/dashboard/products", icon: Package },
  { label: "作品案例", to: "/dashboard/portfolio", icon: ImageIcon },
  { label: "合作需求", to: "/dashboard/collaborations", icon: Handshake },
  { label: "收到的提案", to: "/dashboard/received-proposals", icon: ClipboardText },
  { label: "我的提案", to: "/dashboard/my-proposals", icon: FileText },
  { label: "詢價管理", to: "/dashboard/inquiries", icon: ShoppingBag },
  { label: "報價管理", to: "/dashboard/quotes", icon: Receipt },
  { label: "訂單管理", to: "/dashboard/orders", icon: Package },
  { label: "私訊", to: "/messages", icon: ChatCircleDots, badge: 3 },
  { label: "收藏", to: "/dashboard/favorites", icon: Heart },
  { label: "評價", to: "/dashboard/reviews", icon: Star },
  { label: "通知", to: "/notifications", icon: Bell, badge: 5 },
  { label: "數據分析", to: "/dashboard/analytics", icon: ChartLineUp },
  { label: "方案管理", to: "/dashboard/plans", icon: Sparkle },
  { label: "帳號設定", to: "/dashboard/settings", icon: Gear },
];

export function DashboardLayout({
  children,
  title,
  description,
  actions,
  wide = false,
}: {
  children: ReactNode;
  title: string;
  description?: string;
  actions?: ReactNode;
  wide?: boolean;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, logout, membershipPlan } = useAppStore();
  const hasPublishingPlan = membershipPlan !== "free";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);

  useEffect(() => setSidebarOpen(false), [location.pathname]);
  useEffect(() => {
    const closeAccountMenu = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
    };
    document.addEventListener("pointerdown", closeAccountMenu);
    return () => document.removeEventListener("pointerdown", closeAccountMenu);
  }, []);

  return (
    <div className="dashboard-shell">
      <a className="skip-link" href="#dashboard-main">
        跳到主要內容
      </a>
      <aside className={`dashboard-sidebar ${sidebarOpen ? "open" : ""}`}>
        <div className="dashboard-brand">
          <PlatformLogo />
          <button type="button" onClick={() => setSidebarOpen(false)} aria-label="關閉選單">
            <X />
          </button>
        </div>
        <div className="dashboard-business-switcher">
          <BusinessLogo business={businesses[0]} size="sm" />
          <div>
            <strong>強哥水族</strong>
            <span>
              <span className="status-dot" /> {hasPublishingPlan ? "網站已發布" : "草稿可預覽"}
            </span>
          </div>
          <CaretDown />
        </div>
        <nav className="dashboard-nav" aria-label="會員後台導覽">
          {dashboardNav.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} className={active ? "active" : ""}>
                <Icon weight={active ? "fill" : "regular"} />
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </NavLink>
            );
          })}
        </nav>
        <div className="sidebar-plan-card">
          <span>
            <Sparkle weight="fill" />
          </span>
          <strong>
            {membershipPlan === "enterprise" ? "企業方案已啟用" : hasPublishingPlan ? "專業方案已啟用" : "免費會員方案"}
          </strong>
          <p>{hasPublishingPlan ? "已包含公開網站發布功能。" : "可編輯與預覽；正式發布需升級付費方案。"}</p>
          <i>
            <b />
          </i>
          <Link to="/pricing">查看升級方案</Link>
        </div>
      </aside>
      {sidebarOpen && <button className="dashboard-sidebar-backdrop" onClick={() => setSidebarOpen(false)} aria-label="關閉選單" />}
      <div className="dashboard-area">
        <header className="dashboard-topbar">
          <button type="button" className="dashboard-menu-button" onClick={() => setSidebarOpen(true)} aria-label="開啟選單">
            <Sidebar />
          </button>
          <div className="dashboard-crumbs">
            <Link to="/">平台首頁</Link>
            <span>/</span>
            <strong>{title}</strong>
          </div>
          <div className="dashboard-top-actions">
            <Link to="/business/qiang-ge-aquarium" className="btn btn-outline btn-sm">
              <Eye />
              {hasPublishingPlan ? "查看公開網站" : "預覽網站"}
            </Link>
            <Link to="/notifications" className="dashboard-icon-button" aria-label="通知">
              <Bell />
              <span />
            </Link>
            <div
              ref={accountRef}
              className={`dashboard-account ${accountOpen ? "open" : ""}`}
              role="button"
              tabIndex={0}
              aria-label="開啟帳號選單"
              aria-expanded={accountOpen}
              onClick={(event) => {
                if ((event.target as HTMLElement).closest(".dashboard-account-popover")) return;
                setAccountOpen((value) => !value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setAccountOpen((value) => !value);
                if (event.key === "Escape") setAccountOpen(false);
              }}
            >
              <span className="avatar">{session.name.slice(0, 1) || "強"}</span>
              <div>
                <strong>{session.name || "強哥水族"}</strong>
                <small>{session.role === "admin" ? "管理員" : "商家管理者"}</small>
              </div>
              <CaretDown />
              <div className="dashboard-account-popover">
                <Link to="/dashboard/settings">
                  <Gear /> 帳號設定
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    logout();
                    navigate("/");
                  }}
                >
                  <SignOut /> 登出
                </button>
              </div>
            </div>
          </div>
        </header>
        <main id="dashboard-main" className={`dashboard-main ${wide ? "dashboard-main-wide" : ""}`}>
          <div className="dashboard-page-heading">
            <div>
              <h1>{title}</h1>
              {description && <p>{description}</p>}
            </div>
            {actions && <div className="dashboard-heading-actions">{actions}</div>}
          </div>
          {children}
        </main>
      </div>
      <nav className="dashboard-mobile-nav" aria-label="後台手機導覽">
        {[
          ["總覽", "/dashboard", GridFour],
          ["需求", "/dashboard/collaborations", Handshake],
          ["發布", "/collaborations/new", Plus],
          ["私訊", "/messages", ChatCircleDots],
          ["我的", "/dashboard/settings", UserCircle],
        ].map(([label, to, Icon], index) => {
          const NavIcon = Icon as typeof GridFour;
          return (
            <NavLink key={String(label)} to={String(to)} className={index === 2 ? "primary" : ""}>
              <span>
                <NavIcon weight={index === 2 ? "bold" : "regular"} />
              </span>
              {String(label)}
            </NavLink>
          );
        })}
      </nav>
    </div>
  );
}

const weekTraffic = [52, 76, 61, 89, 72, 100, 82];

export function DashboardOverviewPage() {
  const { notify } = useAppStore();
  const metrics = [
    { label: "網站瀏覽次數", value: "8,456", change: "+12.0%", icon: Eye, tone: "green" },
    { label: "本月詢價數", value: "56", change: "+16.5%", icon: ChatCircleDots, tone: "blue" },
    { label: "合作邀請", value: "23", change: "+9.2%", icon: Handshake, tone: "orange" },
    { label: "商品瀏覽量", value: "12,689", change: "+18.3%", icon: ShoppingBag, tone: "violet" },
    { label: "收藏數", value: "34", change: "+13.4%", icon: Heart, tone: "rose" },
    { label: "未讀訊息", value: "18", change: "+20.0%", icon: Envelope, tone: "teal" },
  ];

  return (
    <DashboardLayout
      title="總覽"
      description="歡迎回來，強哥水族。以下是今天的營運概況。"
      actions={
        <>
          <label className="dashboard-date-filter">
            <CalendarBlankIcon />
            <span>近 7 天</span>
            <CaretDown />
          </label>
          <button type="button" className="btn btn-primary" onClick={() => notify("報表已匯出（模擬）")}>
            <FileArrowUp /> 匯出報表
          </button>
        </>
      }
    >
      <section className="metric-grid">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <article key={metric.label} className={`metric-card metric-${metric.tone}`}>
              <div>
                <span>{metric.label}</span>
                <strong>{metric.value}</strong>
                <small>
                  <TrendUp weight="bold" />
                  {metric.change} <em>較前 7 天</em>
                </small>
              </div>
              <span className="metric-icon">
                <Icon weight="duotone" />
              </span>
            </article>
          );
        })}
      </section>
      <section className="dashboard-primary-grid">
        <article className="dashboard-card traffic-card">
          <div className="dashboard-card-header">
            <div>
              <h2>網站瀏覽次數趨勢</h2>
              <p>訪客在週五最活躍，比上週成長 18.4%</p>
            </div>
            <span className="dashboard-kpi">
              <TrendUp /> 本週 8,456
            </span>
          </div>
          <div className="traffic-chart" aria-label="最近七天網站流量長條圖">
            <div className="chart-guides">
              <span>2,000</span>
              <span>1,500</span>
              <span>1,000</span>
              <span>500</span>
              <span>0</span>
            </div>
            <div className="chart-bars">
              {weekTraffic.map((value, index) => (
                <div key={index} className="bar-group">
                  <span className="bar-value">{Math.round(value * 18.4).toLocaleString("zh-TW")}</span>
                  <i style={{ height: `${value}%` }}>
                    <b />
                  </i>
                  <small>{["一", "二", "三", "四", "五", "六", "日"][index]}</small>
                </div>
              ))}
            </div>
          </div>
          <div className="chart-legend">
            <span>
              <i className="current" /> 本週瀏覽
            </span>
            <span>
              <i className="previous" /> 前週平均
            </span>
          </div>
        </article>
        <article className="dashboard-card recent-messages-card">
          <div className="dashboard-card-header">
            <div>
              <h2>最新訊息</h2>
              <p>3 則訊息等待回覆</p>
            </div>
            <Link to="/messages">查看全部</Link>
          </div>
          <div className="overview-message-list">
            {conversations.slice(0, 4).map((conversation) => {
              const business = businesses.find((item) => item.id === conversation.businessId)!;
              return (
                <Link key={conversation.id} to={`/messages?conversation=${conversation.id}`}>
                  <BusinessLogo business={business} size="sm" />
                  <div>
                    <strong>{conversation.name}</strong>
                    <span>{conversation.preview}</span>
                  </div>
                  <time>{conversation.time}</time>
                  {conversation.unread > 0 && <small>{conversation.unread}</small>}
                </Link>
              );
            })}
          </div>
        </article>
      </section>
      <section className="dashboard-secondary-grid">
        <article className="dashboard-card task-card">
          <div className="dashboard-card-header">
            <div>
              <h2>待辦事項</h2>
              <p>完成後能提升曝光與回覆效率</p>
            </div>
            <span>4 項</span>
          </div>
          <div className="task-list">
            {[
              ["回覆合作詢問", "尚有 3 則未回覆訊息", "/messages", "高"],
              ["更新暑期服務", "「水族生態缸」即將下架", "/dashboard/products", "中"],
              ["完成商家資料", "目前完整度 80%", "/dashboard/profile", "中"],
              ["邀請合作夥伴", "分享專屬網站累積曝光", "/business/qiang-ge-aquarium", "低"],
            ].map(([title, text, to, priority]) => (
              <Link to={to} key={title}>
                <span className={`task-priority priority-${priority}`}>{priority}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{text}</small>
                </div>
                <ArrowRight />
              </Link>
            ))}
          </div>
        </article>
        <article className="dashboard-card ranking-card">
          <div className="dashboard-card-header">
            <div>
              <h2>熱門服務 TOP 5</h2>
              <p>近 7 天瀏覽排名</p>
            </div>
            <Link to="/dashboard/analytics">完整分析</Link>
          </div>
          <ol>
            {businesses[0].services.concat(["水族缸搬遷"]).map((service, index) => (
              <li key={service}>
                <span>{index + 1}</span>
                <div>
                  <strong>{service}</strong>
                  <i>
                    <b style={{ width: `${100 - index * 13}%` }} />
                  </i>
                </div>
                <small>{1256 - index * 177}</small>
              </li>
            ))}
          </ol>
        </article>
        <article className="dashboard-card quick-actions-card">
          <div className="dashboard-card-header">
            <div>
              <h2>快速操作</h2>
              <p>常用管理功能</p>
            </div>
          </div>
          <div>
            {[
              [Plus, "新增商品", "/dashboard/products?new=1"],
              [Handshake, "發布需求", "/collaborations/new"],
              [Tag, "優惠活動", "/dashboard/products"],
              [ChatCircleDots, "訊息中心", "/messages"],
              [Receipt, "查看訂單", "/dashboard/orders"],
              [ChartLineUp, "數據分析", "/dashboard/analytics"],
            ].map(([Icon, label, to]) => {
              const ActionIcon = Icon as typeof Plus;
              return (
                <Link key={String(label)} to={String(to)}>
                  <ActionIcon weight="duotone" />
                  <span>{String(label)}</span>
                </Link>
              );
            })}
          </div>
        </article>
      </section>
      <section className="dashboard-bottom-grid">
        <article className="dashboard-card latest-review-card">
          <div className="dashboard-card-header">
            <div>
              <h2>最新評論</h2>
              <p>本月新增 8 則五星評價</p>
            </div>
            <Link to="/dashboard/reviews">查看全部</Link>
          </div>
          <div className="latest-review">
            <span className="avatar">林</span>
            <div>
              <strong>林小姐</strong>
              <Rating value={5} compact />
              <p>回覆很快，規劃完整，師傅施工後也把現場整理得很乾淨。</p>
            </div>
            <time>2 小時前</time>
          </div>
        </article>
        <article className="dashboard-card profile-progress-card">
          <div>
            <strong>網站資料完整度</strong>
            <span>80%</span>
          </div>
          <i>
            <b />
          </i>
          <p>再上傳 2 張作品與一項專業證照，預計提升 12% 搜尋曝光。</p>
          <Link to="/dashboard/site-editor" className="btn btn-outline btn-sm">
            繼續完善網站
          </Link>
        </article>
      </section>
    </DashboardLayout>
  );
}

function CalendarBlankIcon() {
  return <Clock />;
}

const sectionLabels: Record<string, string> = {
  about: "關於我們",
  services: "服務項目",
  portfolio: "作品案例",
  products: "商品服務",
  reviews: "客戶評價",
  contact: "聯絡資訊",
};

export function SiteEditorPage() {
  const { siteSettings, setSiteSettings, membershipPlan, notify } = useAppStore();
  const [draft, setDraft] = useState<SiteSettings>(siteSettings);
  const [device, setDevice] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [publishOpen, setPublishOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [activePanel, setActivePanel] = useState("content");

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const updateImage = (event: ChangeEvent<HTMLInputElement>, key: "logo" | "cover") => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify("圖片請小於 2 MB", "warning");
      event.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      update(key, String(reader.result));
      notify(key === "logo" ? "Logo 已更新至即時預覽" : "封面已更新至即時預覽", "info");
    };
    reader.readAsDataURL(file);
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const next = [...draft.sectionOrder];
    const target = index + direction;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    update("sectionOrder", next);
  };

  const save = () => {
    setSiteSettings(draft);
    notify("草稿已儲存");
  };

  const publish = () => {
    setSiteSettings(draft);
    if (membershipPlan === "free") {
      setUpgradeOpen(true);
      notify("草稿已儲存；發布公開網站需要付費方案", "info");
      return;
    }
    setPublishOpen(true);
    notify("網站發布成功");
  };

  return (
    <DashboardLayout
      title="我的網站編輯器"
      description="調整內容與外觀，右側會即時顯示訪客看到的網站。"
      wide
      actions={
        <>
          <button type="button" className="btn btn-outline" onClick={save}>
            儲存草稿
          </button>
          <button type="button" className="btn btn-primary" onClick={publish}>
            <Globe /> 發布網站
          </button>
        </>
      }
    >
      <div className="site-editor">
        <aside className="editor-settings">
          <div className="editor-tabs">
            {[
              ["content", NotePencil, "內容"],
              ["style", SlidersHorizontal, "樣式"],
              ["sections", ListDashes, "區塊"],
            ].map(([id, Icon, label]) => {
              const TabIcon = Icon as typeof NotePencil;
              return (
                <button
                  type="button"
                  key={String(id)}
                  className={activePanel === id ? "active" : ""}
                  onClick={() => setActivePanel(String(id))}
                >
                  <TabIcon />
                  {String(label)}
                </button>
              );
            })}
          </div>
          <div className="editor-panel-content">
            {activePanel === "content" && (
              <>
                <div className="editor-panel-heading">
                  <h2>基本內容</h2>
                  <p>這些資料會顯示在網站主視覺。</p>
                </div>
                <label className="field">
                  <span>網站名稱</span>
                  <input value={draft.name} onChange={(event) => update("name", event.target.value)} />
                </label>
                <label className="field">
                  <span>商家標語</span>
                  <input value={draft.tagline} onChange={(event) => update("tagline", event.target.value)} />
                </label>
                <label className="field">
                  <span>關於我們</span>
                  <textarea rows={7} value={draft.intro} onChange={(event) => update("intro", event.target.value)} />
                </label>
                <div className="asset-upload-row">
                  <div>
                    <span>Logo</span>
                    {draft.logo ? (
                      <img className="editor-custom-logo" src={draft.logo} alt={`${draft.name} Logo 預覽`} />
                    ) : (
                      <BusinessLogo business={businesses[0]} size="md" />
                    )}
                  </div>
                  <label className="btn btn-outline btn-sm">
                    <UploadSimple /> 更換 Logo
                    <input type="file" accept="image/*" onChange={(event) => updateImage(event, "logo")} />
                  </label>
                </div>
                <div className="cover-editor">
                  <span>封面圖片</span>
                  <img src={draft.cover || businesses[0].cover} alt="目前網站封面預覽" />
                  <label className="btn btn-outline btn-sm">
                    <ImageIcon /> 更換封面
                    <input type="file" accept="image/*" onChange={(event) => updateImage(event, "cover")} />
                  </label>
                </div>
                <div className="editor-shortcuts">
                  {["服務項目", "作品案例", "商品", "聯絡資料", "社群連結"].map((item) => (
                    <button type="button" key={item} onClick={() => notify(`已開啟「${item}」編輯（MVP 示範）`, "info")}>
                      <PencilSimple />
                      {item}
                      <ArrowRight />
                    </button>
                  ))}
                </div>
              </>
            )}
            {activePanel === "style" && (
              <>
                <div className="editor-panel-heading">
                  <h2>品牌樣式</h2>
                  <p>選擇版型、主色與字體風格。</p>
                </div>
                <fieldset className="template-options">
                  <legend>網站版型</legend>
                  {[
                    ["professional", "專業企業型", "清楚資訊與信任數據"],
                    ["portfolio", "圖片作品型", "以案例視覺為主"],
                    ["commerce", "商品服務型", "強調詢價與商品"],
                  ].map(([id, title, text]) => (
                    <label key={id} className={draft.template === id ? "selected" : ""}>
                      <input
                        type="radio"
                        name="template"
                        checked={draft.template === id}
                        onChange={() => update("template", id as SiteSettings["template"])}
                      />
                      <span className={`template-thumb template-${id}`}>
                        <i />
                        <i />
                        <i />
                      </span>
                      <div>
                        <strong>{title}</strong>
                        <small>{text}</small>
                      </div>
                      <span className="radio-check">{draft.template === id && <Check weight="bold" />}</span>
                    </label>
                  ))}
                </fieldset>
                <label className="field color-field">
                  <span>品牌主色</span>
                  <div>
                    <input
                      type="color"
                      value={draft.primaryColor}
                      onChange={(event) => update("primaryColor", event.target.value)}
                    />
                    <input
                      value={draft.primaryColor}
                      onChange={(event) => update("primaryColor", event.target.value)}
                      pattern="^#[0-9A-Fa-f]{6}$"
                    />
                  </div>
                </label>
                <fieldset className="font-options">
                  <legend>字體風格</legend>
                  {[
                    ["modern", "現代俐落", "Aa 百業共創"],
                    ["humanist", "親和專業", "Aa 百業共創"],
                    ["classic", "穩重經典", "Aa 百業共創"],
                  ].map(([id, title, sample]) => (
                    <label key={id} className={draft.fontStyle === id ? "selected" : ""}>
                      <input
                        type="radio"
                        name="font"
                        checked={draft.fontStyle === id}
                        onChange={() => update("fontStyle", id as SiteSettings["fontStyle"])}
                      />
                      <span className={`font-${id}`}>{sample}</span>
                      <small>{title}</small>
                    </label>
                  ))}
                </fieldset>
              </>
            )}
            {activePanel === "sections" && (
              <>
                <div className="editor-panel-heading">
                  <h2>區塊順序</h2>
                  <p>切換顯示狀態，並用箭頭調整前後順序。</p>
                </div>
                <div className="section-order-list">
                  {draft.sectionOrder.map((section, index) => (
                    <div key={section}>
                      <span className="drag-handle">⋮⋮</span>
                      <strong>{sectionLabels[section]}</strong>
                      <label className="switch">
                        <input
                          type="checkbox"
                          checked={draft.visibleSections[section]}
                          onChange={() =>
                            update("visibleSections", {
                              ...draft.visibleSections,
                              [section]: !draft.visibleSections[section],
                            })
                          }
                        />
                        <span />
                      </label>
                      <button type="button" disabled={index === 0} onClick={() => moveSection(index, -1)} aria-label="向上移">
                        <ArrowUp />
                      </button>
                      <button
                        type="button"
                        disabled={index === draft.sectionOrder.length - 1}
                        onClick={() => moveSection(index, 1)}
                        aria-label="向下移"
                      >
                        <ArrowDown />
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </aside>
        <section className="editor-preview-area">
          <div className="preview-toolbar">
            <div>
              <span className="status-dot" />
              即時預覽
              <small>尚未發布的變更</small>
            </div>
            <div className="device-switcher">
              <button type="button" className={device === "desktop" ? "active" : ""} onClick={() => setDevice("desktop")} aria-label="電腦預覽">
                <Monitor />
              </button>
              <button type="button" className={device === "tablet" ? "active" : ""} onClick={() => setDevice("tablet")} aria-label="平板預覽">
                <Sidebar />
              </button>
              <button type="button" className={device === "mobile" ? "active" : ""} onClick={() => setDevice("mobile")} aria-label="手機預覽">
                <Phone />
              </button>
            </div>
            <Link to="/business/qiang-ge-aquarium" target="_blank">
              在新視窗開啟 <ArrowRight />
            </Link>
          </div>
          <div className={`preview-stage preview-${device}`}>
            <div
              className={`site-preview template-${draft.template} font-${draft.fontStyle}`}
              style={{ "--preview-primary": draft.primaryColor } as CSSProperties}
            >
              <header className="preview-site-header">
                <div>
                  {draft.logo ? (
                    <img className="preview-custom-logo" src={draft.logo} alt={`${draft.name} Logo`} />
                  ) : (
                    <BusinessLogo business={{ ...businesses[0], name: draft.name }} size="sm" />
                  )}
                  <strong>{draft.name}</strong>
                </div>
                <nav>
                  <span>關於</span>
                  <span>服務</span>
                  <span>作品</span>
                  <span>聯絡</span>
                </nav>
                <button type="button">聯絡我們</button>
              </header>
              <section className="preview-hero">
                <img src={draft.cover || businesses[0].cover} alt={`${draft.name} 即時預覽封面`} />
                <div>
                  {draft.logo ? (
                    <img className="preview-custom-logo preview-custom-logo-lg" src={draft.logo} alt={`${draft.name} Logo`} />
                  ) : (
                    <BusinessLogo business={{ ...businesses[0], name: draft.name }} size="lg" />
                  )}
                  <div>
                    <span>已驗證商家</span>
                    <h2>{draft.name}</h2>
                    <p>{draft.tagline}</p>
                    <button type="button">立即聯絡</button>
                  </div>
                </div>
              </section>
              <section className="preview-trust-row">
                {[
                  [`${businesses[0].years} 年+`, "服務年資"],
                  [`${businesses[0].completed}+`, "完成合作"],
                  [`${businesses[0].rating}`, "客戶評價"],
                ].map(([value, label]) => (
                  <div key={label}>
                    <strong>{value}</strong>
                    <small>{label}</small>
                  </div>
                ))}
              </section>
              {draft.sectionOrder.map((section) => {
                if (!draft.visibleSections[section]) return null;
                if (section === "about")
                  return (
                    <section className="preview-section preview-about" key={section}>
                      <span className="preview-section-label">關於我們</span>
                      <h3>專業規劃，讓每一座水景長久健康</h3>
                      <p>{draft.intro}</p>
                    </section>
                  );
                if (section === "services")
                  return (
                    <section className="preview-section" key={section}>
                      <span className="preview-section-label">服務項目</span>
                      <div className="preview-service-grid">
                        {businesses[0].services.slice(0, 3).map((service, index) => (
                          <div key={service}>
                            <span>0{index + 1}</span>
                            <strong>{service}</strong>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                if (section === "portfolio")
                  return (
                    <section className="preview-section" key={section}>
                      <span className="preview-section-label">作品案例</span>
                      <div className="preview-portfolio">
                        {[businesses[0].cover, businesses[17].cover, businesses[5].cover].map((image, index) => (
                          <img key={image} src={image} alt={`${draft.name} 預覽作品 ${index + 1}`} />
                        ))}
                      </div>
                    </section>
                  );
                if (section === "products")
                  return (
                    <section className="preview-section" key={section}>
                      <span className="preview-section-label">商品服務</span>
                      <div className="preview-product-row">
                        {products.slice(0, 2).map((product) => (
                          <div key={product.id}>
                            <img src={product.image} alt={product.name} />
                            <strong>{product.name}</strong>
                            <span>NT$ {product.price.toLocaleString("zh-TW")}</span>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                if (section === "reviews")
                  return (
                    <section className="preview-section preview-review" key={section}>
                      <span>★★★★★</span>
                      <p>「溝通清楚、規劃完整，作品比預期更有質感。」</p>
                      <small>— 林小姐，居家造景專案</small>
                    </section>
                  );
                return (
                  <section className="preview-section preview-contact" key={section}>
                    <div>
                      <span className="preview-section-label">聯絡我們</span>
                      <h3>一起討論你的水族空間</h3>
                    </div>
                    <button type="button">送出需求</button>
                  </section>
                );
              })}
            </div>
          </div>
        </section>
      </div>
      <Modal open={publishOpen} title="網站發布成功" onClose={() => setPublishOpen(false)} size="sm">
        <div className="publish-success">
          <span>
            <Check weight="bold" />
          </span>
          <h3>你的網站已更新</h3>
          <p>所有變更都已發布，訪客現在可以看到最新內容。</p>
          <div className="published-url">
            <Globe />
            <span>/business/qiang-ge-aquarium</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(
                  `${window.location.origin}${import.meta.env.BASE_URL}#/business/qiang-ge-aquarium`,
                );
                notify("網址已複製");
              }}
            >
              複製
            </button>
          </div>
          <div>
            <Link to="/business/qiang-ge-aquarium" className="btn btn-primary">
              查看網站
            </Link>
            <button type="button" className="btn btn-outline" onClick={() => setPublishOpen(false)}>
              繼續編輯
            </button>
          </div>
        </div>
      </Modal>
      <Modal
        open={upgradeOpen}
        title="發布公開網站需要付費方案"
        onClose={() => setUpgradeOpen(false)}
        size="sm"
      >
        <div className="upgrade-confirm">
          <span className="upgrade-icon">
            <ShieldCheck weight="duotone" />
          </span>
          <h3>網站草稿已儲存</h3>
          <p>免費會員可以編輯商家資料、調整網站並使用即時預覽；正式發布公開網站或綁定網址，需要升級付費方案。</p>
          <div className="upgrade-summary">
            <div>
              <span>目前方案</span>
              <strong>免費會員方案</strong>
            </div>
            <div>
              <span>編輯與預覽</span>
              <strong>可使用</strong>
            </div>
            <div>
              <span>公開發布</span>
              <strong>需升級</strong>
            </div>
          </div>
          <div className="form-actions">
            <Link to="/pricing" className="btn btn-primary">
              查看升級方案
            </Link>
            <button type="button" className="btn btn-outline" onClick={() => setUpgradeOpen(false)}>
              繼續編輯
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export function ProductManagementPage() {
  const { notify } = useAppStore();
  const [items, setItems] = useState<Product[]>(products.slice(0, 8));
  const [keyword, setKeyword] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const filtered = items.filter((product) => product.name.includes(keyword));

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const name = String(data.get("name"));
    const price = Number(data.get("price"));
    if (editing) {
      setItems((current) => current.map((item) => (item.id === editing.id ? { ...item, name, price } : item)));
      notify("商品資料已更新");
    } else {
      setItems((current) => [
        {
          ...products[0],
          id: Date.now(),
          slug: `custom-${Date.now()}`,
          name,
          price,
          type: String(data.get("type")),
          description: String(data.get("description")),
        },
        ...current,
      ]);
      notify("商品已新增");
    }
    setModalOpen(false);
    setEditing(null);
  };

  return (
    <DashboardLayout
      title="商品與服務"
      description="管理上架內容、價格、庫存狀態與曝光表現。"
      actions={
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
        >
          <Plus /> 新增商品或服務
        </button>
      }
    >
      <section className="management-stats">
        {[
          ["已上架", String(items.length), Package],
          ["本月瀏覽", "12,689", Eye],
          ["收到詢價", "56", ShoppingBag],
          ["收藏次數", "34", Heart],
        ].map(([label, value, Icon]) => {
          const ItemIcon = Icon as typeof Package;
          return (
            <div key={String(label)}>
              <span>
                <ItemIcon weight="duotone" />
              </span>
              <div>
                <small>{String(label)}</small>
                <strong>{String(value)}</strong>
              </div>
            </div>
          );
        })}
      </section>
      <section className="management-card">
        <div className="management-toolbar">
          <div className="input-with-icon">
            <MagnifyingGlass />
            <input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="搜尋商品或服務" />
          </div>
          <div>
            <select>
              <option>全部狀態</option>
              <option>已上架</option>
              <option>草稿</option>
              <option>已下架</option>
            </select>
            <button type="button" className="btn btn-outline btn-sm">
              <SlidersHorizontal /> 篩選
            </button>
          </div>
        </div>
        <div className="management-table product-management-table">
          <div className="table-head">
            <span>商品／服務</span>
            <span>類型</span>
            <span>價格</span>
            <span>曝光</span>
            <span>狀態</span>
            <span>操作</span>
          </div>
          {filtered.map((product) => (
            <div className="table-row" key={product.id}>
              <div className="table-product">
                <img src={product.image} alt={`${product.name} 管理縮圖`} />
                <div>
                  <strong>{product.name}</strong>
                  <small>編號 PRD-{String(product.id).padStart(4, "0")}</small>
                </div>
              </div>
              <span>{product.type}</span>
              <strong>NT$ {product.price.toLocaleString("zh-TW")}</strong>
              <span>{420 + product.id * 37} 次</span>
              <span className="status-badge status-success">
                <span /> 已上架
              </span>
              <div className="table-actions">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(product);
                    setModalOpen(true);
                  }}
                  aria-label="編輯"
                >
                  <PencilSimple />
                </button>
                <Link to={`/marketplace/${product.slug}`} aria-label="查看">
                  <Eye />
                </Link>
                <button type="button" onClick={() => setDeleteId(product.id)} aria-label="刪除">
                  <Trash />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Modal
        open={modalOpen}
        title={editing ? "編輯商品或服務" : "新增商品或服務"}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        size="lg"
      >
        <form className="form-stack" onSubmit={submit}>
          <label className="field">
            <span>名稱 *</span>
            <input name="name" required defaultValue={editing?.name} placeholder="例如：商用水族缸年度保養" />
          </label>
          <div className="form-grid-two">
            <label className="field">
              <span>類型 *</span>
              <select name="type" required defaultValue={editing?.type || "專業服務"}>
                {["實體商品", "專業服務", "批發商品", "原物料", "設備租借", "顧問服務", "線上服務", "客製化服務"].map(
                  (type) => (
                    <option key={type}>{type}</option>
                  ),
                )}
              </select>
            </label>
            <label className="field">
              <span>參考價格 *</span>
              <input name="price" type="number" min="0" required defaultValue={editing?.price} />
            </label>
          </div>
          <label className="field">
            <span>介紹 *</span>
            <textarea name="description" required rows={5} defaultValue={editing?.description} />
          </label>
          <label className="upload-zone">
            <UploadSimple weight="duotone" />
            <strong>上傳商品圖片</strong>
            <span>建議 4:3，JPG 或 PNG，單檔 8MB 以內</span>
            <input type="file" accept="image/*" multiple />
          </label>
          <div className="form-actions">
            <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>
              取消
            </button>
            <button type="submit" className="btn btn-primary">
              {editing ? "儲存變更" : "新增並上架"}
            </button>
          </div>
        </form>
      </Modal>
      <Modal open={deleteId !== null} title="確定刪除這個項目？" onClose={() => setDeleteId(null)} size="sm">
        <div className="danger-confirm">
          <span>
            <Trash />
          </span>
          <p>刪除後將無法復原，既有詢價紀錄不會受影響。</p>
          <div>
            <button type="button" className="btn btn-outline" onClick={() => setDeleteId(null)}>
              取消
            </button>
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                setItems((current) => current.filter((item) => item.id !== deleteId));
                setDeleteId(null);
                notify("商品已刪除", "info");
              }}
            >
              確定刪除
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}

export function CollaborationManagementPage() {
  const { notify } = useAppStore();
  const [status, setStatus] = useState<Record<number, string>>({
    1: "招募中",
    4: "招募中",
    6: "已截止",
    10: "草稿",
  });
  const userNeeds = [collaborationNeeds[0], collaborationNeeds[3], collaborationNeeds[5], collaborationNeeds[9]];

  return (
    <DashboardLayout
      title="合作需求管理"
      description="追蹤發布狀態、查看提案並管理合作進度。"
      actions={
        <Link to="/collaborations/new" className="btn btn-primary">
          <Plus /> 發布合作需求
        </Link>
      }
    >
      <section className="management-stats">
        {[
          ["招募中", "2", Handshake],
          ["收到提案", "54", ClipboardText],
          ["待回覆", "8", ChatCircleDots],
          ["已完成合作", "12", Check],
        ].map(([label, value, Icon]) => {
          const ItemIcon = Icon as typeof Handshake;
          return (
            <div key={String(label)}>
              <span>
                <ItemIcon weight="duotone" />
              </span>
              <div>
                <small>{String(label)}</small>
                <strong>{String(value)}</strong>
              </div>
            </div>
          );
        })}
      </section>
      <section className="management-card">
        <div className="management-toolbar">
          <div className="input-with-icon">
            <MagnifyingGlass />
            <input placeholder="搜尋合作需求" />
          </div>
          <select>
            <option>全部狀態</option>
            <option>招募中</option>
            <option>已截止</option>
            <option>草稿</option>
          </select>
        </div>
        <div className="collab-management-list">
          {userNeeds.map((need) => (
            <article key={need.id}>
              <span className="collab-management-icon">
                <IndustryIcon category={need.category} weight="duotone" />
              </span>
              <div className="collab-management-copy">
                <div className="tag-row">
                  <span className="tag">{need.type}</span>
                  <span className="tag tag-muted">{need.category}</span>
                </div>
                <Link to={`/collaborations/${need.id}`}>{need.title}</Link>
                <div>
                  <span>{need.budget}</span>
                  <span>截止 {need.deadline}</span>
                  <span>發布 {need.createdAt}</span>
                </div>
              </div>
              <div className="proposal-count">
                <strong>{need.proposals}</strong>
                <span>收到提案</span>
              </div>
              <span className={`status-badge status-${status[need.id] === "招募中" ? "success" : status[need.id] === "草稿" ? "muted" : "warning"}`}>
                <span /> {status[need.id]}
              </span>
              <div className="collab-management-actions">
                <Link to={`/collaborations/${need.id}`} className="btn btn-outline btn-sm">
                  查看
                </Link>
                <button type="button" className="icon-button" aria-label="更多操作">
                  <DotsThree />
                </button>
                <div className="row-popover">
                  <button type="button" onClick={() => notify("已複製需求，並建立草稿")}>
                    複製需求
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStatus((current) => ({ ...current, [need.id]: status[need.id] === "招募中" ? "已截止" : "招募中" }));
                      notify(status[need.id] === "招募中" ? "需求已關閉" : "需求已重新開啟");
                    }}
                  >
                    {status[need.id] === "招募中" ? "關閉需求" : "重新開啟"}
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}

export function MessagesPage() {
  const [params] = useSearchParams();
  const initialBusiness = Number(params.get("business"));
  const initialConversation = Number(params.get("conversation"));
  const firstId =
    initialConversation ||
    conversations.find((conversation) => conversation.businessId === initialBusiness)?.id ||
    conversations[0].id;
  const [activeId, setActiveId] = useState(firstId);
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [localConversations, setLocalConversations] = useState<Conversation[]>(conversations);
  const { notify } = useAppStore();
  const active = localConversations.find((conversation) => conversation.id === activeId) || localConversations[0];
  const activeBusiness = businesses.find((business) => business.id === active.businessId)!;
  const filtered = localConversations.filter((conversation) => conversation.name.includes(search));

  const send = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!message.trim()) return;
    setLocalConversations((current) =>
      current.map((conversation) =>
        conversation.id === activeId
          ? {
              ...conversation,
              preview: message,
              time: "剛剛",
              messages: [
                ...conversation.messages,
                {
                  id: Date.now(),
                  from: "me",
                  text: message,
                  time: new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" }),
                  read: true,
                },
              ],
            }
          : conversation,
      ),
    );
    setMessage("");
  };

  return (
    <DashboardLayout title="私訊中心" description="集中管理商家詢問、合作邀請與報價討論。" wide>
      <div className="messages-shell">
        <aside className={`conversation-list ${activeId ? "has-active" : ""}`}>
          <div className="conversation-search">
            <MagnifyingGlass />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="搜尋對話" />
          </div>
          <div className="conversation-filter-row">
            <button type="button" className="active">
              全部
            </button>
            <button type="button">未讀</button>
            <button type="button">合作</button>
          </div>
          <div className="conversation-items">
            {filtered.map((conversation) => {
              const business = businesses.find((item) => item.id === conversation.businessId)!;
              return (
                <button
                  type="button"
                  key={conversation.id}
                  className={activeId === conversation.id ? "active" : ""}
                  onClick={() => setActiveId(conversation.id)}
                >
                  <BusinessLogo business={business} size="sm" />
                  <div>
                    <strong>{conversation.name}</strong>
                    <span>{conversation.preview}</span>
                  </div>
                  <time>{conversation.time}</time>
                  {conversation.unread > 0 && <small>{conversation.unread}</small>}
                </button>
              );
            })}
          </div>
        </aside>
        <section className="chat-panel">
          <header className="chat-header">
            <button type="button" className="chat-back" onClick={() => setActiveId(0)} aria-label="返回對話列表">
              <ArrowLeft />
            </button>
            <BusinessLogo business={activeBusiness} size="sm" />
            <div>
              <Link to={`/business/${activeBusiness.slug}`}>{active.name}</Link>
              <span>
                <span className="status-dot" /> 線上・通常 {activeBusiness.responseTime} 回覆
              </span>
            </div>
            <button type="button" onClick={() => notify("語音通話為正式版預留功能", "info")} aria-label="撥打電話">
              <Phone />
            </button>
            <button type="button" aria-label="更多">
              <DotsThree />
            </button>
          </header>
          <div className="chat-body">
            <div className="chat-date">今天</div>
            {active.messages.map((item) => (
              <div key={item.id} className={`message-bubble-row ${item.from === "me" ? "from-me" : "from-them"}`}>
                {item.from === "them" && <BusinessLogo business={activeBusiness} size="sm" />}
                <div className="message-bubble">
                  <p>{item.text}</p>
                  {item.card && (
                    <div className={`chat-rich-card card-${item.card.type}`}>
                      <span>
                        {item.card.type === "quote" ? <Receipt /> : item.card.type === "product" ? <Package /> : <Handshake />}
                      </span>
                      <div>
                        <small>{item.card.type === "quote" ? "報價卡片" : item.card.type === "product" ? "商品卡片" : "合作需求"}</small>
                        <strong>{item.card.title}</strong>
                        <p>{item.card.meta}</p>
                      </div>
                      <ArrowRight />
                    </div>
                  )}
                  <span>
                    {item.time}
                    {item.from === "me" && (item.read ? "・已讀" : "・已送出")}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <form className="chat-composer" onSubmit={send}>
            <div className="chat-attachment-actions">
              <label aria-label="上傳圖片">
                <ImageIcon />
                <input type="file" accept="image/*" onChange={() => notify("圖片附件已加入（模擬）")} />
              </label>
              <label aria-label="上傳檔案">
                <FileArrowUp />
                <input type="file" onChange={() => notify("檔案附件已加入（模擬）")} />
              </label>
              <button type="button" onClick={() => notify("報價卡片已插入輸入區", "info")} aria-label="插入報價卡片">
                <Receipt />
              </button>
              <button type="button" onClick={() => notify("商品卡片已插入輸入區", "info")} aria-label="插入商品卡片">
                <Package />
              </button>
            </div>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }
              }}
              placeholder="輸入訊息，Enter 送出，Shift + Enter 換行"
              rows={2}
            />
            <button type="submit" className="send-button" aria-label="送出訊息">
              <PaperPlaneTilt weight="fill" />
            </button>
          </form>
        </section>
        <aside className="chat-info-panel">
          <BusinessLogo business={activeBusiness} size="lg" />
          <h2>{activeBusiness.name}</h2>
          <Rating value={activeBusiness.rating} count={activeBusiness.reviewCount} compact />
          <div className="chat-trust">
            <span>
              <SealCheck weight="fill" /> 商業登記認證
            </span>
            <span>
              <ShieldCheck weight="fill" /> 交易紀錄良好
            </span>
          </div>
          <dl>
            <div>
              <dt>行業</dt>
              <dd>{activeBusiness.category}</dd>
            </div>
            <div>
              <dt>地區</dt>
              <dd>{activeBusiness.location}</dd>
            </div>
            <div>
              <dt>完成合作</dt>
              <dd>{activeBusiness.completed} 次</dd>
            </div>
          </dl>
          <Link to={`/business/${activeBusiness.slug}`} className="btn btn-outline">
            查看商家網站
          </Link>
          <button type="button" className="text-button danger-text" onClick={() => notify("已封鎖此帳號（MVP 模擬）", "warning")}>
            封鎖此帳號
          </button>
          <Link to="/report" className="text-button">
            檢舉此對話
          </Link>
        </aside>
      </div>
    </DashboardLayout>
  );
}

const notificationSeed = [
  { id: 1, type: "proposal", title: "收到新的合作提案", text: "木日木工工作室回覆了你的「企業水族牆長期維護」需求。", time: "5 分鐘前" },
  { id: 2, type: "message", title: "你有 2 則新訊息", text: "阿誠水電工程詢問商用水族造景合作細節。", time: "23 分鐘前" },
  { id: 3, type: "quote", title: "商家已更新報價", text: "全通物流更新了詢價單 BIQ-20260728-012 的配送報價。", time: "1 小時前" },
  { id: 4, type: "review", title: "收到一則五星評價", text: "林小姐完成合作評價：「規劃完整，維護說明很清楚。」", time: "3 小時前" },
  { id: 5, type: "system", title: "商業登記認證已通過", text: "你的商業登記資料已完成審核，認證標章已顯示。", time: "昨天" },
  { id: 6, type: "follow", title: "新的商家追蹤者", text: "本週新增 18 位使用者追蹤強哥水族。", time: "2 天前" },
];

export function NotificationsPage() {
  const { notificationsRead, markNotificationRead, markAllNotificationsRead } = useAppStore();
  const [filter, setFilter] = useState("all");
  const visible =
    filter === "unread"
      ? notificationSeed.filter((item) => !notificationsRead.includes(item.id))
      : filter === "system"
        ? notificationSeed.filter((item) => item.type === "system")
        : notificationSeed;

  return (
    <DashboardLayout
      title="通知中心"
      description="掌握合作、詢價、訊息與帳號安全更新。"
      actions={
        <button type="button" className="btn btn-outline" onClick={markAllNotificationsRead}>
          <Check /> 全部標示已讀
        </button>
      }
    >
      <section className="notification-card">
        <div className="notification-tabs">
          {[
            ["all", "全部"],
            ["unread", "未讀"],
            ["system", "系統通知"],
          ].map(([id, label]) => (
            <button type="button" key={id} className={filter === id ? "active" : ""} onClick={() => setFilter(id)}>
              {label}
              {id === "unread" && <span>{notificationSeed.length - notificationsRead.length}</span>}
            </button>
          ))}
        </div>
        <div className="notification-list">
          {visible.map((notification) => {
            const unread = !notificationsRead.includes(notification.id);
            const icons: Record<string, ComponentType<IconProps>> = {
              proposal: Handshake,
              message: ChatCircleDots,
              quote: Receipt,
              review: Star,
              system: ShieldCheck,
              follow: Heart,
            };
            const Icon = icons[notification.type];
            return (
              <button
                type="button"
                key={notification.id}
                className={unread ? "unread" : ""}
                onClick={() => markNotificationRead(notification.id)}
              >
                <span className={`notification-icon notification-${notification.type}`}>
                  <Icon weight="duotone" />
                </span>
                <div>
                  <strong>{notification.title}</strong>
                  <p>{notification.text}</p>
                  <time>{notification.time}</time>
                </div>
                {unread && <span className="unread-dot" />}
                <ArrowRight />
              </button>
            );
          })}
        </div>
      </section>
    </DashboardLayout>
  );
}

const genericConfig: Record<
  string,
  { title: string; description: string; icon: ComponentType<IconProps>; rows?: string[][]; action?: string }
> = {
  profile: {
    title: "商家資料",
    description: "管理公司資訊、聯絡方式、營業時間與認證資料。",
    icon: Storefront,
    rows: [
      ["基本資料", "強哥水族・其他專業服務", "已完成"],
      ["聯絡資訊", "電話、Email、LINE 與地址", "已完成"],
      ["服務範圍", "台北市、新北市、基隆市", "已完成"],
      ["商業登記認證", "統一編號與證明文件", "已通過"],
      ["專業證照", "目前已上傳 2 份", "待補充"],
    ],
  },
  portfolio: {
    title: "作品案例",
    description: "用照片、影片與成果說明累積專業信任。",
    icon: ImageIcon,
    action: "新增作品",
    rows: businesses.slice(0, 5).map((business, index) => [
      business.services[index % business.services.length],
      `${12 + index * 7} 張照片・${index % 2 ? "含影片" : "純照片"}`,
      index === 4 ? "草稿" : "已發布",
    ]),
  },
  "received-proposals": {
    title: "收到的提案",
    description: "比較合作方案、報價與交付時程。",
    icon: ClipboardText,
    rows: collaborationNeeds.slice(0, 6).map((need, index) => [
      businesses[(index + 2) % businesses.length].name,
      `${need.title}・${need.budget}`,
      ["待審閱", "已聯絡", "洽談中"][index % 3],
    ]),
  },
  "my-proposals": {
    title: "我的提案",
    description: "追蹤你送出的合作提案與對方回覆。",
    icon: FileText,
    rows: collaborationNeeds.slice(4, 9).map((need, index) => [
      need.title,
      `${need.publisher}・${need.location}`,
      ["已送出", "對方已讀", "洽談中"][index % 3],
    ]),
  },
  inquiries: {
    title: "詢價管理",
    description: "集中處理客戶需求、規格確認與回覆進度。",
    icon: ShoppingBag,
    rows: quoteRecords
      .filter((record) => record.kind === "詢價")
      .map((record) => [record.id, `${record.customer}・${record.subject}`, record.status]),
  },
  quotes: {
    title: "報價管理",
    description: "建立、修改與追蹤正式報價單。",
    icon: Receipt,
    action: "建立報價",
    rows: quoteRecords
      .filter((record) => record.kind === "報價")
      .map((record) => [record.id, `${record.customer}・${record.amount}`, record.status]),
  },
  orders: {
    title: "訂單管理",
    description: "查看模擬訂單狀態與合作交付進度。",
    icon: Package,
    rows: [
      ["BO-2607-028", "企業水族牆設計・NT$ 186,000", "執行中"],
      ["BO-2607-019", "定期維護半年約・NT$ 42,000", "待確認"],
      ["BO-2606-118", "居家生態缸・NT$ 68,000", "已完成"],
      ["BO-2606-095", "水族設備升級・NT$ 23,600", "已完成"],
    ],
  },
  favorites: {
    title: "我的收藏",
    description: "管理收藏的商家、商品與合作需求。",
    icon: Heart,
    rows: businesses.slice(1, 6).map((business, index) => [
      business.name,
      `${business.category}・${business.location}`,
      index % 2 ? "商家" : "商品",
    ]),
  },
  reviews: {
    title: "評價管理",
    description: "回覆客戶評價並追蹤服務品質。",
    icon: Star,
    rows: reviews.slice(0, 6).map((review) => [
      `${review.author}・${review.rating} 星`,
      `${review.project}・${review.content.slice(0, 28)}…`,
      review.id % 2 ? "待回覆" : "已回覆",
    ]),
  },
  analytics: {
    title: "數據分析",
    description: "查看網站曝光、訪客來源與轉換表現。",
    icon: ChartLineUp,
    rows: [
      ["自然搜尋", "4,286 次造訪", "+18.3%"],
      ["平台分類頁", "2,140 次造訪", "+9.5%"],
      ["商家分享連結", "1,486 次造訪", "+24.1%"],
      ["合作需求", "544 次造訪", "+6.8%"],
    ],
  },
  plans: {
    title: "方案管理",
    description: "查看目前方案、使用量與升級選項。",
    icon: Sparkle,
    rows: [
      ["目前方案", "專業方案・試用至 2026/08/10", "試用中"],
      ["商品額度", "已使用 8 / 30", "正常"],
      ["作品額度", "已使用 18 / 50", "正常"],
      ["合作需求", "本月已使用 3 / 10", "正常"],
    ],
  },
  settings: {
    title: "帳號設定",
    description: "管理登入、安全、通知與團隊成員。",
    icon: Gear,
    rows: [
      ["登入 Email", "demo@baiye.local", "已驗證"],
      ["手機號碼", "0912-***-678", "已驗證"],
      ["兩步驟驗證", "提高帳號安全性", "未啟用"],
      ["通知偏好", "Email、站內與 LINE", "已設定"],
      ["封鎖名單", "目前沒有封鎖的帳號", "0"],
    ],
  },
};

export function GenericDashboardPage({ section }: { section: string }) {
  const config = genericConfig[section] || genericConfig.profile;
  const Icon = config.icon;
  const { notify } = useAppStore();
  return (
    <DashboardLayout
      title={config.title}
      description={config.description}
      actions={
        config.action ? (
          <button type="button" className="btn btn-primary" onClick={() => notify(`${config.action}表單已開啟（MVP 模擬）`)}>
            <Plus /> {config.action}
          </button>
        ) : undefined
      }
    >
      <section className="generic-dashboard-hero">
        <span>
          <Icon weight="duotone" />
        </span>
        <div>
          <small>{config.title}</small>
          <strong>{config.rows?.length || 0} 筆資料</strong>
        </div>
        <i>
          <b />
        </i>
        <span>資料同步正常</span>
      </section>
      <section className="management-card generic-dashboard-card">
        <div className="management-toolbar">
          <div className="input-with-icon">
            <MagnifyingGlass />
            <input placeholder={`搜尋${config.title}`} />
          </div>
          <button type="button" className="btn btn-outline btn-sm">
            <SlidersHorizontal /> 篩選
          </button>
        </div>
        <div className="generic-rows">
          {config.rows?.map((row, index) => (
            <article key={`${row[0]}-${index}`}>
              <span className="generic-row-icon">
                <Icon weight="duotone" />
              </span>
              <div>
                <strong>{row[0]}</strong>
                <span>{row[1]}</span>
              </div>
              <span className={`status-badge ${row[2].includes("待") || row[2].includes("未") ? "status-warning" : "status-success"}`}>
                {row[2]}
              </span>
              <button type="button" className="icon-button" aria-label="查看詳情" onClick={() => notify("詳細資料已開啟（MVP 模擬）", "info")}>
                <ArrowRight />
              </button>
            </article>
          ))}
        </div>
      </section>
    </DashboardLayout>
  );
}
