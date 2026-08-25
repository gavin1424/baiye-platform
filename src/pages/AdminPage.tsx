import {
  ArrowRight,
  Bell,
  Buildings,
  CalendarBlank,
  CaretDown,
  ChartBar,
  ChartLineUp,
  Check,
  CirclesFour,
  ClipboardText,
  DotsThree,
  Eye,
  FileText,
  Flag,
  Gear,
  Handshake,
  Image as ImageIcon,
  ListBullets,
  MagnifyingGlass,
  Megaphone,
  Package,
  PencilSimple,
  Receipt,
  SealCheck,
  ShieldCheck,
  Sidebar,
  SignOut,
  Star,
  Storefront,
  TrendDown,
  TrendUp,
  UserCircle,
  UserMinus,
  UserPlus,
  UsersThree,
  Warning,
  X,
  type IconProps,
} from "@phosphor-icons/react";
import { useEffect, useMemo, useState, type ComponentType, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BusinessLogo, IndustryIcon, Modal, PlatformLogo } from "../components";
import { businesses, categories, collaborationNeeds, products, reviews } from "../data";
import { useAppStore } from "../store";
import { AdminShopOrders, AdminShopProducts } from "./AdminCommerce";

const adminNav = [
  { id: "overview", label: "平台總覽", icon: ChartBar },
  { id: "members", label: "會員管理", icon: UsersThree },
  { id: "businesses", label: "商家管理", icon: Storefront },
  { id: "collaborations", label: "合作需求", icon: Handshake },
  { id: "shop-products", label: "商城商品", icon: Package },
  { id: "shop-orders", label: "商城訂單", icon: Receipt },
  { id: "products", label: "市集內容", icon: ClipboardText },
  { id: "reviews", label: "評價管理", icon: Star },
  { id: "reports", label: "檢舉管理", icon: Flag, badge: 8 },
  { id: "categories", label: "分類管理", icon: ListBullets },
  { id: "verification", label: "認證審核", icon: SealCheck, badge: 12 },
  { id: "plans", label: "方案管理", icon: Receipt },
  { id: "ads", label: "廣告版位", icon: ImageIcon },
  { id: "announcements", label: "平台通知", icon: Megaphone },
  { id: "analytics", label: "數據報表", icon: ChartLineUp },
  { id: "settings", label: "網站設定", icon: Gear },
];

type StatusMap = Record<number, "active" | "suspended">;

function AdminLayout({
  children,
  activeTab,
  setActiveTab,
}: {
  children: ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const { session, logout } = useAppStore();
  const navigate = useNavigate();

  return (
    <div className="admin-shell">
      <aside className={`admin-sidebar ${open ? "open" : ""}`}>
        <div className="admin-brand">
          <PlatformLogo />
          <span>ADMIN</span>
          <button type="button" onClick={() => setOpen(false)} aria-label="關閉管理選單">
            <X />
          </button>
        </div>
        <nav aria-label="管理員導覽">
          {adminNav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                type="button"
                key={item.id}
                className={activeTab === item.id ? "active" : ""}
                onClick={() => {
                  setActiveTab(item.id);
                  setOpen(false);
                }}
              >
                <Icon weight={activeTab === item.id ? "fill" : "regular"} />
                <span>{item.label}</span>
                {item.badge && <small>{item.badge}</small>}
              </button>
            );
          })}
        </nav>
        <div className="admin-operations-nav" aria-label="營運工具">
          <strong>營運工具</strong>
          <Link to="/admin/finance" onClick={() => setOpen(false)}>
            <Receipt /> <span>金流與記帳</span>
          </Link>
          <Link to="/admin/bookings" onClick={() => setOpen(false)}>
            <CalendarBlank /> <span>預約管理</span>
          </Link>
          <Link to="/admin/partners" onClick={() => setOpen(false)}>
            <Handshake /> <span>承攬夥伴管理</span>
          </Link>
        </div>
        <div className="admin-sidebar-footer">
          <div>
            <span className="avatar">管</span>
            <div>
              <strong>{session.name || "平台管理員"}</strong>
              <small>{session.email || "admin@baiye.local"}</small>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              logout();
              navigate("/");
            }}
            aria-label="登出"
          >
            <SignOut />
          </button>
        </div>
      </aside>
      {open && <button type="button" className="admin-sidebar-backdrop" onClick={() => setOpen(false)} aria-label="關閉選單" />}
      <div className="admin-area">
        <header className="admin-topbar">
          <button type="button" className="admin-menu-button" onClick={() => setOpen(true)} aria-label="開啟管理選單">
            <Sidebar />
          </button>
          <div className="admin-search">
            <MagnifyingGlass />
            <input placeholder="搜尋會員、商家、內容或編號" />
            <kbd>⌘ K</kbd>
          </div>
          <div className="admin-top-actions">
            <div className="admin-top-shortcuts" aria-label="管理快捷入口">
              <Link to="/admin" className="btn btn-outline btn-sm">
                <ChartBar /> 平台總覽
              </Link>
              <Link to="/admin/finance" className="btn btn-outline btn-sm">
                <Receipt /> 金流與記帳
              </Link>
              <Link to="/admin/bookings" className="btn btn-outline btn-sm">
                <CalendarBlank /> 預約管理
              </Link>
              <Link to="/admin/partners" className="btn btn-outline btn-sm">
                <Handshake /> 承攬夥伴
              </Link>
            </div>
            <Link to="/" className="btn btn-outline btn-sm">
              <Eye /> 查看平台
            </Link>
            <button type="button" aria-label="通知">
              <Bell />
              <span />
            </button>
          </div>
        </header>
        <main className="admin-main">{children}</main>
      </div>
    </div>
  );
}

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const tabParam = params.get("tab") || "overview";
  const [activeTab, setActiveTabState] = useState(tabParam);
  const [memberStatus, setMemberStatus] = useState<StatusMap>({});
  const [announcementOpen, setAnnouncementOpen] = useState(false);
  const [actionTarget, setActionTarget] = useState<{ type: string; id: number; name: string } | null>(null);
  const { notify } = useAppStore();

  const setActiveTab = (tab: string) => {
    setActiveTabState(tab);
    setParams(tab === "overview" ? {} : { tab });
  };

  useEffect(() => setActiveTabState(tabParam), [tabParam]);

  const activeInfo = adminNav.find((item) => item.id === activeTab) || adminNav[0];
  const ActiveIcon = activeInfo.icon;

  const confirmAction = () => {
    if (!actionTarget) return;
    if (actionTarget.type === "member") {
      setMemberStatus((current) => ({
        ...current,
        [actionTarget.id]: current[actionTarget.id] === "suspended" ? "active" : "suspended",
      }));
      notify(memberStatus[actionTarget.id] === "suspended" ? "會員帳號已恢復" : "會員帳號已停權", "warning");
    } else {
      notify(`「${actionTarget.name}」已完成處理`);
    }
    setActionTarget(null);
  };

  return (
    <AdminLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="admin-page-heading">
        <div>
          <span className="admin-heading-icon">
            <ActiveIcon weight="duotone" />
          </span>
          <div>
            <h1>{activeInfo.label}</h1>
            <p>{activeTab === "overview" ? "掌握平台營運、內容安全與商業成長。" : `搜尋、篩選並管理平台的${activeInfo.label.replace("管理", "")}資料。`}</p>
          </div>
        </div>
        {(activeTab === "announcements" || activeTab === "overview") && (
          <button type="button" className="btn btn-primary" onClick={() => setAnnouncementOpen(true)}>
            <Megaphone /> 發送平台公告
          </button>
        )}
      </div>

      {activeTab === "overview" && (
        <AdminOverview
          onTab={setActiveTab}
          onAction={(target) => setActionTarget(target)}
        />
      )}
      {activeTab === "shop-products" && <AdminShopProducts />}
      {activeTab === "shop-orders" && <AdminShopOrders />}
      {activeTab !== "overview" && activeTab !== "shop-products" && activeTab !== "shop-orders" && (
        <AdminDataSection
          tab={activeTab}
          memberStatus={memberStatus}
          onAction={(target) => setActionTarget(target)}
          onAnnouncement={() => setAnnouncementOpen(true)}
        />
      )}

      <Modal
        open={Boolean(actionTarget)}
        title={actionTarget?.type === "member" ? "確認帳號狀態變更" : "確認執行管理操作"}
        onClose={() => setActionTarget(null)}
        size="sm"
      >
        <div className="admin-confirm">
          <span>
            <Warning weight="duotone" />
          </span>
          <h3>{actionTarget?.name}</h3>
          <p>
            {actionTarget?.type === "member"
              ? memberStatus[actionTarget.id] === "suspended"
                ? "恢復後，此會員可以重新登入並使用平台功能。"
                : "停權後，此會員將無法登入或發布內容，但既有資料仍會保留。"
              : "此操作會更新內容狀態，並記錄於管理員稽核紀錄。"}
          </p>
          <div>
            <button type="button" className="btn btn-outline" onClick={() => setActionTarget(null)}>
              取消
            </button>
            <button type="button" className="btn btn-danger" onClick={confirmAction}>
              確認執行
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={announcementOpen} title="發送平台公告" onClose={() => setAnnouncementOpen(false)} size="lg">
        <form
          className="form-stack"
          onSubmit={(event) => {
            event.preventDefault();
            setAnnouncementOpen(false);
            notify("平台公告已發送");
          }}
        >
          <div className="form-grid-two">
            <label className="field">
              <span>發送對象 *</span>
              <select required>
                <option>全部會員</option>
                <option>免費會員</option>
                <option>商家上架會員</option>
              </select>
            </label>
            <label className="field">
              <span>通知管道</span>
              <select>
                <option>站內通知＋Email</option>
                <option>僅站內通知</option>
                <option>僅 Email</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span>公告標題 *</span>
            <input required placeholder="例如：八月平台功能更新通知" />
          </label>
          <label className="field">
            <span>公告內容 *</span>
            <textarea required rows={7} placeholder="請輸入公告內容" />
          </label>
          <label className="consent-row">
            <input type="checkbox" required />
            <span>我已確認發送對象與內容無誤。</span>
          </label>
          <button type="submit" className="btn btn-primary">
            <Megaphone /> 確認發送
          </button>
        </form>
      </Modal>
    </AdminLayout>
  );
}

function AdminOverview({
  onTab,
  onAction,
}: {
  onTab: (tab: string) => void;
  onAction: (target: { type: string; id: number; name: string }) => void;
}) {
  const metrics = [
    ["總會員數", "50,286", "+8.4%", UsersThree, "blue"],
    ["活躍商家", "12,845", "+12.7%", Storefront, "green"],
    ["本月合作需求", "3,286", "+18.2%", Handshake, "orange"],
    ["市集商品", "28,642", "+9.6%", Package, "violet"],
    ["待審核內容", "126", "-6.1%", ClipboardText, "yellow"],
    ["待處理檢舉", "8", "+2", Flag, "red"],
  ];
  const growth = [44, 58, 51, 69, 64, 82, 76, 92, 87, 100, 93, 112];

  return (
    <>
      <section className="admin-metric-grid">
        {metrics.map(([label, value, change, Icon, tone]) => {
          const MetricIcon = Icon as typeof UsersThree;
          return (
            <article key={String(label)} className={`admin-metric admin-metric-${tone}`}>
              <span>
                <MetricIcon weight="duotone" />
              </span>
              <div>
                <small>{String(label)}</small>
                <strong>{String(value)}</strong>
                <em className={String(change).startsWith("-") ? "down" : ""}>
                  {String(change).startsWith("-") ? <TrendDown /> : <TrendUp />}
                  {String(change)}
                </em>
              </div>
            </article>
          );
        })}
      </section>
      <section className="admin-operations-center" aria-labelledby="admin-operations-title">
        <div className="admin-operations-heading">
          <div>
            <span>營運管理</span>
            <h2 id="admin-operations-title">營運控制中心</h2>
          </div>
          <p>從同一處快速進入平台的核心管理功能。</p>
        </div>
        <div className="admin-operations-grid">
          <article>
            <span className="admin-operation-icon"><Receipt weight="duotone" /></span>
            <small>● 正式後端</small>
            <h3>金流與記帳</h3>
            <p>管理收款、退款、手續費、淨收入、待收款、支出與營運損益。</p>
            <Link to="/admin/finance">進入財務管理 <ArrowRight /></Link>
          </article>
          <article>
            <span className="admin-operation-icon"><CalendarBlank weight="duotone" /></span>
            <small>● Production</small>
            <h3>預約管理</h3>
            <p>管理服務、營業時間、可預約時段、預約、改期、取消與行事曆。</p>
            <Link to="/admin/bookings">進入預約管理 <ArrowRight /></Link>
          </article>
          <article>
            <span className="admin-operation-icon"><Handshake weight="duotone" /></span>
            <small>● 線上簽約</small>
            <h3>承攬夥伴管理</h3>
            <p>管理承攬申請、審核、啟用、成交、獎勵、VIP 與契約狀態。</p>
            <Link to="/admin/partners">管理承攬夥伴 <ArrowRight /></Link>
          </article>
          <article>
            <span className="admin-operation-icon"><ChartBar weight="duotone" /></span>
            <small>● 管理中心</small>
            <h3>平台管理</h3>
            <p>管理會員、商家、商城、內容、分類、審核與平台設定。</p>
            <button type="button" onClick={() => onTab("overview")}>平台管理 <ArrowRight /></button>
          </article>
        </div>
      </section>
      <section className="admin-overview-grid">
        <article className="admin-card admin-growth-card">
          <div className="admin-card-header">
            <div>
              <h2>平台成長趨勢</h2>
              <p>近 12 個月會員與合作媒合成長</p>
            </div>
            <select>
              <option>近 12 個月</option>
              <option>近 30 天</option>
              <option>今年</option>
            </select>
          </div>
          <div className="admin-growth-chart" aria-label="平台成長趨勢長條圖">
            {growth.map((value, index) => (
              <div key={index}>
                <i style={{ height: `${Math.min(100, value - 22)}%` }} />
                <b style={{ height: `${Math.min(100, value - 38)}%` }} />
                <small>{index + 1}月</small>
              </div>
            ))}
          </div>
          <div className="admin-chart-legend">
            <span>
              <i className="members" /> 新增會員
            </span>
            <span>
              <i className="matches" /> 完成媒合
            </span>
          </div>
        </article>
        <article className="admin-card admin-health-card">
          <div className="admin-card-header">
            <div>
              <h2>平台健康度</h2>
              <p>核心服務品質指標</p>
            </div>
          </div>
          {[
            ["內容合規率", 97, "良好"],
            ["平均回覆率", 92, "良好"],
            ["需求媒合率", 86, "穩定"],
            ["檢舉處理率", 75, "需關注"],
          ].map(([label, value, status]) => (
            <div className="health-row" key={String(label)}>
              <div>
                <span>{String(label)}</span>
                <strong>{String(value)}%</strong>
              </div>
              <i>
                <b style={{ width: `${value}%` }} />
              </i>
              <small className={status === "需關注" ? "warning" : ""}>{String(status)}</small>
            </div>
          ))}
        </article>
      </section>
      <section className="admin-table-grid">
        <article className="admin-card admin-review-queue">
          <div className="admin-card-header">
            <div>
              <h2>待審核商家</h2>
              <p>需確認資料與認證文件</p>
            </div>
            <button type="button" onClick={() => onTab("verification")}>
              查看全部 <ArrowRight />
            </button>
          </div>
          <div className="admin-mini-table">
            {businesses.slice(4, 9).map((business, index) => (
              <div key={business.id}>
                <BusinessLogo business={business} size="sm" />
                <div>
                  <strong>{business.name}</strong>
                  <small>
                    {business.category}・{business.location}
                  </small>
                </div>
                <span>{index % 2 ? "證照認證" : "商業登記"}</span>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => onAction({ type: "approve", id: business.id, name: business.name })}
                >
                  審核
                </button>
              </div>
            ))}
          </div>
        </article>
        <article className="admin-card admin-reports-card">
          <div className="admin-card-header">
            <div>
              <h2>最新檢舉</h2>
              <p>8 件待處理，2 件逾時</p>
            </div>
            <button type="button" onClick={() => onTab("reports")}>
              查看全部 <ArrowRight />
            </button>
          </div>
          <div className="admin-report-list">
            {[
              ["不實商品資訊", "商品：超低價品牌官網", "高", "12 分鐘前"],
              ["疑似詐騙邀請", "會員：專案媒合有限公司", "高", "48 分鐘前"],
              ["不當評價內容", "評價編號：RV-2607-1882", "中", "2 小時前"],
              ["服務分類錯誤", "商家：快速到府清潔", "低", "5 小時前"],
            ].map(([title, subject, priority, time], index) => (
              <button type="button" key={title} onClick={() => onAction({ type: "report", id: index, name: title })}>
                <span className={`report-priority priority-${priority}`}>{priority}</span>
                <div>
                  <strong>{title}</strong>
                  <small>{subject}</small>
                </div>
                <time>{time}</time>
                <ArrowRight />
              </button>
            ))}
          </div>
        </article>
      </section>
      <section className="admin-card admin-activity-card">
        <div className="admin-card-header">
          <div>
            <h2>管理操作紀錄</h2>
            <p>最近的內容與帳號異動</p>
          </div>
          <button type="button">匯出紀錄</button>
        </div>
        <div className="activity-timeline">
          {[
            ["平台管理員", "通過「安心居家清潔」的商業登記認證", "10 分鐘前"],
            ["內容審核員 A", "下架商品「超低價品牌官網」並通知發布者", "42 分鐘前"],
            ["平台管理員", "恢復會員「王大明」的帳號使用權", "1 小時前"],
            ["系統", "自動封鎖 3 則疑似垃圾私訊", "2 小時前"],
          ].map(([user, action, time]) => (
            <div key={`${user}-${time}`}>
              <span />
              <strong>{user}</strong>
              <p>{action}</p>
              <time>{time}</time>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function AdminDataSection({
  tab,
  memberStatus,
  onAction,
  onAnnouncement,
}: {
  tab: string;
  memberStatus: StatusMap;
  onAction: (target: { type: string; id: number; name: string }) => void;
  onAnnouncement: () => void;
}) {
  const { notify } = useAppStore();
  const [search, setSearch] = useState("");
  const [categoryItems, setCategoryItems] = useState(categories);

  const data = useMemo(() => {
    if (tab === "members")
      return businesses.map((business) => ({
        id: business.id,
        title: `${business.name} 管理者`,
        subtitle: `${business.name}・member${business.id}@baiye.local`,
        meta: business.joinedAt,
        status: memberStatus[business.id] === "suspended" ? "已停權" : "使用中",
        image: business,
      }));
    if (tab === "businesses")
      return businesses.map((business) => ({
        id: business.id,
        title: business.name,
        subtitle: `${business.category}・${business.location}`,
        meta: `評價 ${business.rating}・完成 ${business.completed}`,
        status: business.verified ? "已認證" : "待審核",
        image: business,
      }));
    if (tab === "collaborations")
      return collaborationNeeds.map((need) => ({
        id: need.id,
        title: need.title,
        subtitle: `${need.type}・${need.budget}`,
        meta: `${need.location}・${need.proposals} 份提案`,
        status: need.urgent ? "優先審查" : "刊登中",
      }));
    if (tab === "products")
      return products.map((product) => ({
        id: product.id,
        title: product.name,
        subtitle: `${product.type}・NT$ ${product.price.toLocaleString("zh-TW")}`,
        meta: businesses.find((business) => business.id === product.businessId)?.name || "",
        status: "已上架",
      }));
    if (tab === "reviews")
      return reviews.map((review) => ({
        id: review.id,
        title: `${review.author}・${review.rating} 星`,
        subtitle: review.content,
        meta: `${review.project}・${review.date}`,
        status: review.id % 7 === 0 ? "待審查" : "正常",
      }));
    if (tab === "reports")
      return Array.from({ length: 8 }, (_, index) => ({
        id: index + 1,
        title: ["不實商品資訊", "疑似詐騙邀請", "不當評價內容", "服務分類錯誤"][index % 4],
        subtitle: `檢舉編號 RP-2607-${String(index + 1).padStart(3, "0")}・由會員提交`,
        meta: `${index + 1} 小時前`,
        status: index < 2 ? "高優先" : index < 5 ? "待處理" : "調查中",
      }));
    if (tab === "verification")
      return businesses.slice(4, 16).map((business, index) => ({
        id: business.id,
        title: business.name,
        subtitle: `${index % 2 ? "專業證照認證" : "商業登記認證"}・${business.category}`,
        meta: `送審於 ${index + 1} 小時前`,
        status: "待審核",
        image: business,
      }));
    if (tab === "plans")
      return [
        ["免費會員", "32,680 位會員・NT$0・一般購物會員", "公開中"],
        ["商家 AI 行銷推廣方案", "17,606 位會員・原價 NT$30,000・推廣優惠價 NT$18,000", "公開中"],
      ].map((item, index) => ({ id: index + 1, title: item[0], subtitle: item[1], meta: "資格正常", status: item[2] }));
    if (tab === "ads")
      return [
        ["首頁 Hero 下方橫幅", "桌機 1200×160・手機 360×120", "使用中"],
        ["商家列表推薦位", "每頁 2 個原生推薦卡", "使用中"],
        ["合作廣場置頂需求", "每分類最多 3 筆", "可預約"],
        ["市集分類頁橫幅", "桌機 1200×220・手機 360×160", "維護中"],
      ].map((item, index) => ({ id: index + 1, title: item[0], subtitle: item[1], meta: "版位管理", status: item[2] }));
    if (tab === "announcements")
      return [
        ["八月平台功能更新", "全部會員・站內通知＋Email", "已排程"],
        ["商家上架功能更新", "商家上架會員・站內通知", "已發送"],
        ["內容審核規範更新", "商家會員・Email", "草稿"],
      ].map((item, index) => ({ id: index + 1, title: item[0], subtitle: item[1], meta: `2026/07/${28 - index}`, status: item[2] }));
    if (tab === "analytics")
      return [
        ["會員成長報表", "本月新增 3,862 位・成長 8.4%", "可下載"],
        ["合作媒合報表", "本月完成 1,246 筆・成功率 86%", "可下載"],
        ["市集詢價報表", "本月 8,624 張詢價單・回覆率 92%", "可下載"],
        ["內容安全報表", "本月處理 186 件・平均 3.2 小時", "可下載"],
      ].map((item, index) => ({ id: index + 1, title: item[0], subtitle: item[1], meta: "更新於今日 08:00", status: item[2] }));
    if (tab === "settings")
      return [
        ["網站基本設定", "平台名稱、標語、SEO 與聯絡資訊", "已設定"],
        ["會員與權限", "角色、登入規則與團隊權限", "已設定"],
        ["內容審核規則", "敏感詞、上架規範與自動檢查", "需檢查"],
        ["系統通知", "Email 範本與事件通知", "已設定"],
        ["維護模式", "目前平台正常開放", "關閉"],
      ].map((item, index) => ({ id: index + 1, title: item[0], subtitle: item[1], meta: "平台設定", status: item[2] }));
    return [];
  }, [tab, memberStatus]);

  if (tab === "categories") {
    return (
      <section className="admin-card admin-category-manager">
        <div className="admin-card-header">
          <div>
            <h2>行業分類</h2>
            <p>拖曳排序、編輯名稱或控制公開狀態。</p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              const name = `新分類 ${categoryItems.length + 1}`;
              setCategoryItems((items) => [...items, name]);
              notify(`已新增「${name}」`);
            }}
          >
            <UserPlus /> 新增分類
          </button>
        </div>
        <div className="admin-category-grid">
          {categoryItems.map((category, index) => (
            <article key={`${category}-${index}`}>
              <span className="drag-handle">⋮⋮</span>
              <span className="category-admin-icon">
                <IndustryIcon category={category} weight="duotone" />
              </span>
              <div>
                <strong>{category}</strong>
                <small>{320 + ((index * 173) % 1400)} 位業者</small>
              </div>
              <span className="status-badge status-success">公開</span>
              <button type="button" aria-label="編輯分類" onClick={() => notify(`正在編輯「${category}」（MVP 模擬）`, "info")}>
                <PencilSimple />
              </button>
            </article>
          ))}
        </div>
      </section>
    );
  }

  const filtered = data.filter((item) => item.title.includes(search) || item.subtitle.includes(search));

  return (
    <>
      <section className="admin-section-stats">
        {[
          ["資料總數", data.length.toLocaleString("zh-TW"), CirclesFour],
          ["今日新增", String(Math.max(3, Math.round(data.length * 0.16))), TrendUp],
          ["待處理", String(Math.max(1, Math.round(data.length * 0.08))), ClipboardText],
          ["本月完成", String(Math.max(12, data.length * 4)), Check],
        ].map(([label, value, Icon]) => {
          const StatIcon = Icon as typeof CirclesFour;
          return (
            <div key={String(label)}>
              <span>
                <StatIcon weight="duotone" />
              </span>
              <small>{String(label)}</small>
              <strong>{String(value)}</strong>
            </div>
          );
        })}
      </section>
      <section className="admin-card admin-data-card">
        <div className="admin-data-toolbar">
          <div className="input-with-icon">
            <MagnifyingGlass />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={`搜尋${adminNav.find((item) => item.id === tab)?.label}`} />
          </div>
          <select>
            <option>全部狀態</option>
            <option>待處理</option>
            <option>已完成</option>
          </select>
          {tab === "announcements" && (
            <button type="button" className="btn btn-primary btn-sm" onClick={onAnnouncement}>
              <Megaphone /> 新增公告
            </button>
          )}
        </div>
        <div className="admin-data-table">
          <div className="table-head">
            <span>名稱／項目</span>
            <span>詳細資料</span>
            <span>更新／時間</span>
            <span>狀態</span>
            <span>操作</span>
          </div>
          {filtered.slice(0, 20).map((item) => (
            <div className="table-row" key={item.id}>
              <div className="admin-item-title">
                {"image" in item && item.image ? (
                  <BusinessLogo business={item.image as (typeof businesses)[number]} size="sm" />
                ) : (
                  <span className="admin-row-placeholder">
                    {tab === "members" ? <UserCircle /> : tab === "reports" ? <Flag /> : <FileText />}
                  </span>
                )}
                <strong>{item.title}</strong>
              </div>
              <span>{item.subtitle}</span>
              <span>{item.meta}</span>
              <span
                className={`status-badge ${
                  item.status.includes("待") || item.status.includes("高") || item.status.includes("需")
                    ? "status-warning"
                    : item.status.includes("停權") || item.status.includes("維護")
                      ? "status-danger"
                      : "status-success"
                }`}
              >
                {item.status}
              </span>
              <div className="admin-row-actions">
                <button type="button" onClick={() => notify(`已開啟「${item.title}」詳細資料`, "info")} aria-label="查看">
                  <Eye />
                </button>
                {tab === "members" && (
                  <button
                    type="button"
                    onClick={() => onAction({ type: "member", id: item.id, name: item.title })}
                    aria-label={memberStatus[item.id] === "suspended" ? "恢復會員" : "停權會員"}
                  >
                    {memberStatus[item.id] === "suspended" ? <UserPlus /> : <UserMinus />}
                  </button>
                )}
                {["businesses", "verification", "reports", "products", "reviews", "collaborations"].includes(tab) && (
                  <button type="button" onClick={() => onAction({ type: tab, id: item.id, name: item.title })} aria-label="執行管理操作">
                    {tab === "verification" ? <Check /> : tab === "reports" ? <ShieldCheck /> : <DotsThree />}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
