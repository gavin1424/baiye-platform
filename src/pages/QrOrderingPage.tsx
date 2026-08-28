import {
  ArrowClockwise,
  Check,
  CookingPot,
  ForkKnife,
  Minus,
  Plus,
  QrCode,
  Receipt,
  ShoppingCart,
  Storefront,
  Users,
  X,
} from "@phosphor-icons/react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import { PlatformLogo } from "../components";
import {
  clearOrderingMemberToken,
  clearOrderingLastOrder,
  getOrderingLastOrder,
  getOrderingMemberToken,
  orderingPublicApi,
  saveOrderingMemberToken,
  saveOrderingLastOrder,
  type OrderingCategory,
  type OrderingContext,
  type OrderingCoupon,
  type OrderingDeliveryLink,
  type OrderingMember,
  type OrderingMenuItem,
  type OrderingOptionGroup,
  type OrderingOptionValue,
  type OrderingItemOptionGroup,
  type OrderingOrder,
  type OrderingPaymentOption,
  type OrderingOrderStatus,
  type OrderingOrderType,
  type OrderingPurpose,
  type QrContextResponse,
  type QrMenuResponse,
} from "../qr-ordering-client";

const IS_BEEF_NOODLE_DEMO = import.meta.env.VITE_APP_VARIANT === "beef-noodle-demo";

const orderStatusLabels: Record<OrderingOrderStatus, string> = {
  submitted: "已送出",
  accepted: "店家已接單",
  preparing: "製作中",
  ready: "可取餐",
  served: "已送餐",
  completed: "已完成",
  cancelled: "已取消",
};

const purposeLabels: Record<OrderingPurpose, string> = {
  member_order: "加入會員＋點餐",
  member_only: "加入會員",
  dine_in: "內用桌號點餐",
  takeaway: "外帶點餐",
};

function money(minor: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(Number(minor || 0) / 100);
}

function errorMessage(error: unknown, fallback = "操作失敗，請稍後再試。") {
  return error instanceof Error ? error.message : fallback;
}

function errorStatus(error: unknown) {
  return Number((error as { status?: number } | null)?.status || 0);
}

function statusTone(status: OrderingOrderStatus) {
  if (status === "cancelled") return "danger";
  if (status === "completed" || status === "served") return "success";
  if (status === "ready") return "accent";
  return "info";
}

function OrderingTopbar() {
  return (
    <header className="ordering-topbar">
      <PlatformLogo />
      <span>掃碼會員・手機點餐</span>
    </header>
  );
}

export function QrOrderingPage() {
  const { code = "" } = useParams();
  const [context, setContext] = useState<OrderingContext | null>(null);
  const [member, setMember] = useState<OrderingMember | null>(null);
  const [token, setToken] = useState("");
  const [categories, setCategories] = useState<OrderingCategory[]>([]);
  const [items, setItems] = useState<OrderingMenuItem[]>([]);
  const [optionGroups, setOptionGroups] = useState<OrderingOptionGroup[]>([]);
  const [optionValues, setOptionValues] = useState<OrderingOptionValue[]>([]);
  const [itemOptionGroups, setItemOptionGroups] = useState<
    OrderingItemOptionGroup[]
  >([]);
  const [coupons, setCoupons] = useState<OrderingCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  const [paymentOptions, setPaymentOptions] = useState<OrderingPaymentOption[]>(
    [],
  );
  const [deliveryLinks, setDeliveryLinks] = useState<OrderingDeliveryLink[]>(
    [],
  );
  const [cart, setCart] = useState<Record<string, number>>({});
  const [itemSelections, setItemSelections] = useState<
    Record<string, { option_value_ids: string[]; note: string }>
  >({});
  const [editingItem, setEditingItem] = useState<OrderingMenuItem | null>(null);
  const [draftSelection, setDraftSelection] = useState<{
    option_value_ids: string[];
    note: string;
  }>({ option_value_ids: [], note: "" });
  const [query, setQuery] = useState("");
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState<OrderingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [joinForm, setJoinForm] = useState({
    display_name: "",
    phone: "",
    email: "",
    consent: false,
  });
  const [orderType, setOrderType] = useState<OrderingOrderType>("dine_in");
  const [tableLabel, setTableLabel] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const pendingOrderKey = useRef("");

  const loadBenefits = useCallback(
    async (memberToken: string) => {
      if (!memberToken) return;
      const [couponData, paymentData, deliveryData] = await Promise.all([
        orderingPublicApi<{ items: OrderingCoupon[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/coupons`,
          {},
          memberToken,
        ),
        orderingPublicApi<{ items: OrderingPaymentOption[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/payment-options`,
        ),
        orderingPublicApi<{ items: OrderingDeliveryLink[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/delivery-links`,
        ),
      ]);
      setCoupons(couponData.items || []);
      setPaymentOptions(paymentData.items || []);
      setDeliveryLinks(deliveryData.items || []);
      const usable = (couponData.items || []).find(
        (c) => c.status === "active",
      );
      if (usable) setSelectedCoupon(usable.id);
    },
    [code],
  );

  const loadMenu = useCallback(
    async (ctx: OrderingContext, memberToken: string) => {
      if (!memberToken && ctx.require_member) return;
      const data = await orderingPublicApi<QrMenuResponse>(
        `/api/ordering/qr/${encodeURIComponent(code)}/menu`,
        {},
        memberToken,
      );
      setCategories(data.categories || []);
      setItems(data.items || []);
      setOptionGroups(data.option_groups || []);
      setOptionValues(data.option_values || []);
      setItemOptionGroups(data.item_option_groups || []);
      if (data.member) setMember(data.member);
    },
    [code],
  );

  const initialize = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setOrder(null);
    setCart({});
    try {
      const data = await orderingPublicApi<QrContextResponse>(
        `/api/ordering/qr/${encodeURIComponent(code)}`,
      );
      const ctx = data.context;
      setContext(ctx);
      setMember(data.member);
      setTableLabel(ctx.qr.table_label || "");
      if (ctx.qr.purpose === "takeaway") setOrderType("takeaway");
      else if (ctx.qr.purpose === "dine_in") setOrderType("dine_in");
      else if (!ctx.dine_in_enabled && ctx.takeaway_enabled)
        setOrderType("takeaway");

      const savedToken = getOrderingMemberToken(ctx.merchant_id);
      if (savedToken) {
        try {
          setToken(savedToken);
          await loadMenu(ctx, savedToken);
          await loadBenefits(savedToken);
          const lastOrderCode = getOrderingLastOrder(ctx.merchant_id);
          if (lastOrderCode) {
            try {
              const lastOrder = await orderingPublicApi<{
                order: OrderingOrder;
              }>(
                `/api/ordering/orders/${encodeURIComponent(lastOrderCode)}`,
                {},
                savedToken,
              );
              setOrder(lastOrder.order);
            } catch (error) {
              if (errorStatus(error) === 404)
                clearOrderingLastOrder(ctx.merchant_id);
              else throw error;
            }
          }
        } catch (error) {
          if (errorStatus(error) === 401) {
            clearOrderingMemberToken(ctx.merchant_id);
            setToken("");
            setMember(null);
          } else {
            throw error;
          }
        }
      }
    } catch (error) {
      setMessage(errorMessage(error, "此 QR Code 目前無法使用。"));
    } finally {
      setLoading(false);
    }
  }, [code, loadBenefits, loadMenu]);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    if (!order || !token || ["completed", "cancelled"].includes(order.status))
      return undefined;
    const timer = window.setInterval(() => {
      void orderingPublicApi<{ order: OrderingOrder }>(
        `/api/ordering/orders/${encodeURIComponent(order.order_code)}`,
        {},
        token,
      )
        .then((data) => setOrder(data.order))
        .catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [order, token]);

  const groupedItems = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("zh-TW");
    const visibleItems = normalizedQuery
      ? items.filter((item) =>
          `${item.name} ${item.description || ""}`
            .toLocaleLowerCase("zh-TW")
            .includes(normalizedQuery),
        )
      : items;
    const result = categories
      .map((category) => ({
        category,
        items: visibleItems.filter((item) => item.category_id === category.id),
      }))
      .filter((group) => group.items.length > 0);
    const known = new Set(categories.map((category) => category.id));
    const uncategorized = visibleItems.filter(
      (item) => !known.has(item.category_id),
    );
    if (uncategorized.length) {
      result.push({
        category: { id: "uncategorized", name: "其他", sort_order: 9999 },
        items: uncategorized,
      });
    }
    return result;
  }, [categories, items, query]);

  const cartLines = useMemo(
    () =>
      items
        .filter((item) => Number(cart[item.id] || 0) > 0)
        .map((item) => ({ ...item, quantity: Number(cart[item.id]) })),
    [cart, items],
  );
  const cartCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);
  const optionDelta = (itemId: string) =>
    (itemSelections[itemId]?.option_value_ids || []).reduce(
      (sum, valueId) =>
        sum +
        Number(
          optionValues.find((value) => value.id === valueId)
            ?.price_delta_minor || 0,
        ),
      0,
    );
  const subtotal = cartLines.reduce(
    (sum, item) =>
      sum + (item.price_minor + optionDelta(item.id)) * item.quantity,
    0,
  );

  const groupsForItem = (itemId: string) =>
    itemOptionGroups
      .filter((link) => link.item_id === itemId)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((link) => optionGroups.find((group) => group.id === link.group_id))
      .filter((group): group is OrderingOptionGroup => Boolean(group?.active));

  const openItem = (item: OrderingMenuItem) => {
    if (item.status === "sold_out" || item.available === false) return;
    setDraftSelection(
      itemSelections[item.id] || { option_value_ids: [], note: "" },
    );
    setEditingItem(item);
  };

  const confirmItem = () => {
    if (!editingItem) return;
    for (const group of groupsForItem(editingItem.id)) {
      const count = draftSelection.option_value_ids.filter((id) =>
        optionValues.some(
          (value) => value.id === id && value.group_id === group.id,
        ),
      ).length;
      if (count < group.min_select || count > group.max_select) {
        setMessage(
          `${group.name}需選擇 ${group.min_select}${group.max_select !== group.min_select ? `～${group.max_select}` : ""} 項。`,
        );
        return;
      }
    }
    setItemSelections((current) => ({
      ...current,
      [editingItem.id]: draftSelection,
    }));
    changeQuantity(editingItem.id, 1);
    setEditingItem(null);
  };

  const changeQuantity = (itemId: string, delta: number) => {
    setCart((current) => {
      const next = Math.max(
        0,
        Math.min(20, Number(current[itemId] || 0) + delta),
      );
      if (next === 0) {
        const copy = { ...current };
        delete copy[itemId];
        return copy;
      }
      return { ...current, [itemId]: next };
    });
  };

  const join = async (event: FormEvent) => {
    event.preventDefault();
    if (!context) return;
    setSubmitting(true);
    setMessage("");
    try {
      const data = await orderingPublicApi<{
        member: OrderingMember;
        session: { token: string; expires_at: string };
        message: string;
        coupon?: OrderingCoupon | null;
      }>(`/api/ordering/qr/${encodeURIComponent(code)}/join`, {
        method: "POST",
        body: JSON.stringify({
          display_name: joinForm.display_name,
          phone: joinForm.phone,
          email: joinForm.email,
          privacy_consent: joinForm.consent,
          consent_version: context.consent_version,
        }),
      });
      setMember(data.member);
      setToken(data.session.token);
      saveOrderingMemberToken(context.merchant_id, data.session.token);
      setMessage(data.message);
      if (data.coupon) setCoupons([data.coupon]);
      await loadBenefits(data.session.token);
      if (context.qr.purpose !== "member_only")
        await loadMenu(context, data.session.token);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitOrder = async () => {
    if (!context || !token || !cartLines.length) return;
    setSubmitting(true);
    setMessage("");
    if (!pendingOrderKey.current) {
      pendingOrderKey.current =
        crypto.randomUUID?.() ||
        `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    try {
      const data = await orderingPublicApi<{
        order: OrderingOrder;
        message: string;
      }>(
        `/api/ordering/qr/${encodeURIComponent(code)}/orders`,
        {
          method: "POST",
          headers: { "idempotency-key": pendingOrderKey.current },
          body: JSON.stringify({
            order_type: orderType,
            table_label: tableLabel,
            customer_note: customerNote,
            items: cartLines.map((item) => ({
              item_id: item.id,
              quantity: item.quantity,
              option_value_ids: itemSelections[item.id]?.option_value_ids || [],
              note: item.allow_customer_note
                ? itemSelections[item.id]?.note || ""
                : "",
            })),
            coupon_id: selectedCoupon || undefined,
          }),
        },
        token,
      );
      setOrder(data.order);
      saveOrderingLastOrder(context.merchant_id, data.order.order_code);
      setCart({});
      setCartOpen(false);
      setCustomerNote("");
      setMessage(data.message);
      pendingOrderKey.current = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (errorStatus(error) === 401 && context) {
        clearOrderingMemberToken(context.merchant_id);
        setToken("");
        setMember(null);
      }
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="ordering-page">
        <OrderingTopbar />
        <section className="ordering-loading">
          <span className="ordering-spinner" />
          <p>正在讀取商家與 QR Code…</p>
        </section>
      </main>
    );
  }

  if (!context) {
    return (
      <main className="ordering-page">
        <OrderingTopbar />
        <section className="ordering-center-card">
          <QrCode size={48} />
          <h1>QR Code 無法使用</h1>
          <p>{message || "此 QR Code 無效、已停用或已過期。"}</p>
          <Link className="btn btn-primary" to="/">
            返回創百業首頁
          </Link>
        </section>
      </main>
    );
  }

  if (!context.enabled) {
    return (
      <main className="ordering-page">
        <OrderingTopbar />
        <section className="ordering-center-card">
          <Storefront size={48} />
          <h1>{context.display_name}</h1>
          <p>此商家的掃碼會員與點餐服務尚未開放，請洽現場人員。</p>
        </section>
      </main>
    );
  }

  const showJoin = !member || !token;
  const showTableInput = orderType === "dine_in" && !context.qr.table_label;

  return (
    <main className="ordering-page">
      <OrderingTopbar />
      <section className="ordering-merchant-hero">
        <div>
          <span className="ordering-purpose">
            <QrCode weight="fill" /> {purposeLabels[context.qr.purpose]}
          </span>
          <h1>{context.display_name}</h1>
          <p>
            {context.qr.label}
            {context.qr.table_label ? `・${context.qr.table_label}` : ""}
          </p>
        </div>
        {member && (
          <div className="ordering-member-chip">
            <Check weight="bold" />
            <span>
              <strong>{member.display_name}</strong>
              <small>{member.membership_no}</small>
            </span>
          </div>
        )}
      </section>

      {message && (
        <div className="ordering-message" role="status">
          {message}
        </div>
      )}

      {order && (
        <section className="ordering-order-status-card">
          <div
            className={`ordering-status-icon tone-${statusTone(order.status)}`}
          >
            <Receipt weight="duotone" />
          </div>
          <div>
            <span>訂單編號</span>
            <h2>{order.order_code}</h2>
            <p
              className={`ordering-status-pill tone-${statusTone(order.status)}`}
            >
              {orderStatusLabels[order.status]}
            </p>
            <small>
              系統會自動更新處理狀態；需要協助時請向店家出示訂單編號。
            </small>
            <div className="ordering-status-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setOrder(null)}
              >
                再加點
              </button>
              {order.status === "submitted" &&
                context.customer_cancel_before_accept && (
                  <button
                    className="btn btn-ghost"
                    type="button"
                    onClick={async () => {
                      const reason = window.confirm(
                        "確定取消這筆尚未接單的訂單嗎？",
                      )
                        ? "顧客於店家接單前取消"
                        : "";
                      if (!reason) return;
                      setSubmitting(true);
                      try {
                        const data = await orderingPublicApi<{
                          order: OrderingOrder;
                        }>(
                          `/api/ordering/orders/${encodeURIComponent(order.order_code)}/cancel`,
                          { method: "POST", body: JSON.stringify({ reason }) },
                          token,
                        );
                        setOrder(data.order);
                        setMessage("訂單已取消。");
                      } catch (error) {
                        setMessage(errorMessage(error));
                      } finally {
                        setSubmitting(false);
                      }
                    }}
                  >
                    取消訂單
                  </button>
                )}
            </div>
          </div>
          <strong>
            {money(
              order.pricing?.payable_total_minor ?? order.total_minor,
              context.currency,
            )}
          </strong>
        </section>
      )}

      {showJoin ? (
        <section className="ordering-join-card">
          <div className="ordering-section-heading">
            <Users weight="duotone" />
            <div>
              <span>手機快速加入</span>
              <h2>加入會員後立即點餐</h2>
              <p>不用安裝 App，填寫基本資料即可在本手機使用。</p>
            </div>
          </div>
          {IS_BEEF_NOODLE_DEMO ? (
            <p className="ordering-demo-privacy-note">
              此為 Staging 功能示範環境。若不希望留下真實聯絡資料，請勿輸入真實敏感個資。
            </p>
          ) : null}
          <form onSubmit={join} className="ordering-form-grid">
            <label>
              姓名
              <input
                required
                autoComplete="name"
                value={joinForm.display_name}
                onChange={(event) =>
                  setJoinForm({ ...joinForm, display_name: event.target.value })
                }
                placeholder="請輸入姓名"
              />
            </label>
            <label>
              手機號碼
              <input
                required
                inputMode="tel"
                autoComplete="tel"
                value={joinForm.phone}
                onChange={(event) =>
                  setJoinForm({ ...joinForm, phone: event.target.value })
                }
                placeholder="09xxxxxxxx"
              />
            </label>
            <label className="ordering-form-wide">
              Email（選填）
              <input
                type="email"
                autoComplete="email"
                value={joinForm.email}
                onChange={(event) =>
                  setJoinForm({ ...joinForm, email: event.target.value })
                }
                placeholder="接收通知用，可不填"
              />
            </label>
            <label className="ordering-consent ordering-form-wide">
              <input
                type="checkbox"
                checked={joinForm.consent}
                onChange={(event) =>
                  setJoinForm({ ...joinForm, consent: event.target.checked })
                }
              />
              <span>
                我同意以本資料建立此商家的快速會員，並已閱讀
                <Link to="/privacy">隱私權政策</Link>
                。快速會員僅用於會員識別與點餐，不在此頁顯示完整手機資料。
              </span>
            </label>
            <button
              className="btn btn-primary btn-lg ordering-form-wide"
              type="submit"
              disabled={submitting}
            >
              {submitting ? "正在加入…" : "加入會員並開始點餐"}
            </button>
          </form>
        </section>
      ) : context.qr.purpose === "member_only" ? (
        <section className="ordering-center-card ordering-success-card">
          <Check size={52} weight="bold" />
          <h2>會員加入完成</h2>
          <p>
            {member.display_name}，您已成為「{context.display_name}」快速會員。
          </p>
          <small>手機：{member.phone_masked}</small>
        </section>
      ) : (
        <>
          <section className="ordering-controls-card">
            <div>
              <span>本次用餐方式</span>
              <strong>{orderType === "dine_in" ? "內用" : "外帶"}</strong>
              {context.qr.table_label && (
                <small>桌號：{context.qr.table_label}</small>
              )}
            </div>
            {context.qr.purpose === "member_order" &&
              context.dine_in_enabled &&
              context.takeaway_enabled && (
                <div className="ordering-segmented">
                  <button
                    type="button"
                    className={orderType === "dine_in" ? "active" : ""}
                    onClick={() => setOrderType("dine_in")}
                  >
                    內用
                  </button>
                  <button
                    type="button"
                    className={orderType === "takeaway" ? "active" : ""}
                    onClick={() => setOrderType("takeaway")}
                  >
                    外帶
                  </button>
                </div>
              )}
            {showTableInput && (
              <label>
                桌號
                <input
                  value={tableLabel}
                  onChange={(event) => setTableLabel(event.target.value)}
                  placeholder="例如 A3、12 桌"
                />
              </label>
            )}
          </section>
          {coupons.length > 0 && (
            <section className="ordering-controls-card">
              <div>
                <span>我的禮券</span>
                <strong>會員 NT$100 禮券</strong>
                <small>外送平台訂單預設不適用</small>
              </div>
              <div>
                {coupons.map((c) => (
                  <label key={c.id} className="ordering-consent">
                    <input
                      type="radio"
                      name="coupon"
                      checked={selectedCoupon === c.id}
                      disabled={c.status !== "active"}
                      onChange={() => setSelectedCoupon(c.id)}
                    />
                    <span>
                      {money(c.discount_value_minor, context.currency)}・
                      {c.status === "active"
                        ? "可使用"
                        : c.status === "pending_verification"
                          ? "待手機驗證"
                          : c.status}
                    </span>
                  </label>
                ))}
              </div>
            </section>
          )}
          {deliveryLinks.length > 0 && (
            <section className="ordering-controls-card">
              <div>
                <span>外送訂購</span>
                <strong>第三方與商家外送服務</strong>
                <small>商品、價格、優惠、付款及退款依外送平台頁面為準。</small>
              </div>
              <div className="ordering-qr-actions">
                {deliveryLinks.map((link) => (
                  <a
                    key={link.id}
                    className="btn btn-outline"
                    href={link.order_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {link.display_name}
                  </a>
                ))}
              </div>
            </section>
          )}

          <section className="ordering-menu-section">
            <div className="ordering-section-heading">
              <ForkKnife weight="duotone" />
              <div>
                <span>手機菜單</span>
                <h2>選擇餐點</h2>
                <p>價格與供應狀態以送單當下的店家資料為準。</p>
              </div>
            </div>
            {!context.accepting_orders && (
              <div className="ordering-closed-notice" role="status">
                <strong>店家目前暫停接單</strong>
                <span>
                  {context.temporary_closed_message ||
                    "您仍可查看菜單，恢復接單後即可送出。"}
                </span>
              </div>
            )}
            <label className="ordering-menu-search">
              搜尋餐點
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="輸入餐點名稱"
              />
            </label>
            <nav className="ordering-category-tabs" aria-label="菜單分類">
              {categories
                .filter((category) => category.active !== false)
                .map((category) => (
                  <a
                    key={category.id}
                    href={`#ordering-category-${category.id}`}
                  >
                    {category.name}
                  </a>
                ))}
            </nav>
            {groupedItems.length === 0 ? (
              <div className="ordering-empty">
                <CookingPot size={44} />
                <h3>店家尚未公布菜單</h3>
                <p>請洽現場人員，或稍後重新整理。</p>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={() =>
                    context && token && void loadMenu(context, token)
                  }
                >
                  <ArrowClockwise />
                  重新整理
                </button>
              </div>
            ) : (
              groupedItems.map(({ category, items: categoryItems }) => (
                <div
                  className="ordering-category"
                  id={`ordering-category-${category.id}`}
                  key={category.id}
                >
                  <div className="ordering-category-title">
                    <h3>{category.name}</h3>
                    {category.description && <p>{category.description}</p>}
                  </div>
                  <div className="ordering-menu-grid">
                    {categoryItems.map((item) => {
                      const quantity = Number(cart[item.id] || 0);
                      const soldOut =
                        item.status === "sold_out" || item.available === false;
                      return (
                        <article
                          className={`ordering-menu-item ${soldOut ? "is-sold-out" : ""}`}
                          key={item.id}
                        >
                          {item.image_url && (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              loading="lazy"
                            />
                          )}
                          <div className="ordering-menu-copy">
                            <h4>{item.name}</h4>
                            {item.description && <p>{item.description}</p>}
                            <strong>
                              {money(item.price_minor, context.currency)}
                            </strong>
                            {soldOut && (
                              <span className="ordering-soldout">今日售完</span>
                            )}
                          </div>
                          <div
                            className="ordering-quantity"
                            aria-label={`${item.name}數量`}
                          >
                            <button
                              type="button"
                              onClick={() => changeQuantity(item.id, -1)}
                              disabled={quantity === 0}
                              aria-label={`減少${item.name}`}
                            >
                              <Minus />
                            </button>
                            <span>{quantity}</span>
                            <button
                              type="button"
                              onClick={() =>
                                groupsForItem(item.id).length ||
                                item.allow_customer_note
                                  ? openItem(item)
                                  : changeQuantity(item.id, 1)
                              }
                              disabled={soldOut || quantity >= 20}
                              aria-label={`增加${item.name}`}
                            >
                              <Plus />
                            </button>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </section>
        </>
      )}

      {cartCount > 0 && !showJoin && (
        <button
          type="button"
          className="ordering-cart-bar"
          onClick={() => setCartOpen(true)}
        >
          <span>
            <ShoppingCart weight="fill" />
            <b>{cartCount}</b> 查看購物車
          </span>
          <strong>{money(subtotal, context.currency)}</strong>
        </button>
      )}

      {cartOpen && (
        <div
          className="ordering-modal-backdrop"
          role="presentation"
          onClick={() => setCartOpen(false)}
        >
          <section
            className="ordering-cart-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="購物車"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>確認餐點</span>
                <h2>購物車</h2>
              </div>
              <button
                type="button"
                onClick={() => setCartOpen(false)}
                aria-label="關閉購物車"
              >
                <X />
              </button>
            </header>
            <div className="ordering-cart-lines">
              {cartLines.map((item) => (
                <div className="ordering-cart-line" key={item.id}>
                  <div>
                    <strong>{item.name}</strong>
                    <small>
                      {money(
                        item.price_minor + optionDelta(item.id),
                        context.currency,
                      )}{" "}
                      × {item.quantity}
                    </small>
                    {(itemSelections[item.id]?.option_value_ids || []).map(
                      (id) => (
                        <small key={id}>
                          {optionValues.find((value) => value.id === id)?.name}
                        </small>
                      ),
                    )}
                  </div>
                  <div className="ordering-quantity">
                    <button
                      type="button"
                      onClick={() => changeQuantity(item.id, -1)}
                    >
                      <Minus />
                    </button>
                    <span>{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() =>
                        groupsForItem(item.id).length ||
                        item.allow_customer_note
                          ? openItem(item)
                          : changeQuantity(item.id, 1)
                      }
                    >
                      <Plus />
                    </button>
                  </div>
                  <b>
                    {money(
                      (item.price_minor + optionDelta(item.id)) * item.quantity,
                      context.currency,
                    )}
                  </b>
                </div>
              ))}
            </div>
            <button
              type="button"
              className="ordering-clear-cart"
              onClick={() => {
                setCart({});
                setCartOpen(false);
              }}
            >
              清空購物車
            </button>
            <label className="ordering-note">
              給店家的備註
              <textarea
                value={customerNote}
                onChange={(event) => setCustomerNote(event.target.value)}
                maxLength={500}
                placeholder="例如：不要辣、餐具需求（實際仍以店家可提供內容為準）"
              />
            </label>
            {showTableInput && (
              <label className="ordering-note">
                桌號
                <input
                  value={tableLabel}
                  onChange={(event) => setTableLabel(event.target.value)}
                  placeholder="請輸入桌號"
                />
              </label>
            )}
            <div className="ordering-cart-total">
              <span>合計</span>
              <strong>{money(subtotal, context.currency)}</strong>
            </div>
            {selectedCoupon && (
              <div className="ordering-cart-total">
                <span>會員禮券</span>
                <strong>
                  -{money(Math.min(10000, subtotal), context.currency)}
                </strong>
              </div>
            )}
            {selectedCoupon && (
              <div className="ordering-cart-total">
                <span>應付金額</span>
                <strong>
                  {money(Math.max(subtotal - 10000, 0), context.currency)}
                </strong>
              </div>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => void submitOrder()}
              disabled={
                submitting ||
                !context.accepting_orders ||
                (showTableInput && !tableLabel.trim())
              }
            >
              {submitting
                ? "正在送出…"
                : context.accepting_orders
                  ? "確認送出訂單"
                  : "店家目前暫停接單"}
            </button>
            <small>
              {paymentOptions.length
                ? "送單後可依商家開通狀態選擇：" +
                  paymentOptions.map((x) => x.display_name).join("、")
                : "目前由店家現場收款；送出前不會進行線上扣款。"}
            </small>
          </section>
        </div>
      )}

      {editingItem && (
        <div
          className="ordering-modal-backdrop"
          role="presentation"
          onClick={() => setEditingItem(null)}
        >
          <section
            className="ordering-cart-sheet ordering-option-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ordering-option-title"
            onClick={(event) => event.stopPropagation()}
          >
            <header>
              <div>
                <span>餐點客製</span>
                <h2 id="ordering-option-title">{editingItem.name}</h2>
              </div>
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                aria-label="關閉"
              >
                <X />
              </button>
            </header>
            {groupsForItem(editingItem.id).map((group) => {
              const values = optionValues.filter(
                (value) => value.group_id === group.id && value.active,
              );
              return (
                <fieldset className="ordering-option-group" key={group.id}>
                  <legend>
                    {group.name}
                    <small>
                      {group.required ? "必選" : "選填"}・最多{" "}
                      {group.max_select} 項
                    </small>
                  </legend>
                  {values.map((value) => {
                    const checked = draftSelection.option_value_ids.includes(
                      value.id,
                    );
                    return (
                      <label key={value.id}>
                        <input
                          type={
                            group.selection_type === "single"
                              ? "radio"
                              : "checkbox"
                          }
                          name={`option-${group.id}`}
                          checked={checked}
                          onChange={() =>
                            setDraftSelection((current) => {
                              const sameGroup = optionValues
                                .filter((item) => item.group_id === group.id)
                                .map((item) => item.id);
                              let next = current.option_value_ids.filter(
                                (id) =>
                                  group.selection_type !== "single" ||
                                  !sameGroup.includes(id),
                              );
                              if (checked)
                                next = next.filter((id) => id !== value.id);
                              else if (
                                group.selection_type === "single" ||
                                next.filter((id) => sameGroup.includes(id))
                                  .length < group.max_select
                              )
                                next.push(value.id);
                              return { ...current, option_value_ids: next };
                            })
                          }
                        />
                        <span>{value.name}</span>
                        <strong>
                          {value.price_delta_minor
                            ? `+${money(value.price_delta_minor, context.currency)}`
                            : "不加價"}
                        </strong>
                      </label>
                    );
                  })}
                </fieldset>
              );
            })}
            {editingItem.allow_customer_note && (
              <label className="ordering-note">
                品項備註
                <textarea
                  maxLength={200}
                  value={draftSelection.note}
                  onChange={(event) =>
                    setDraftSelection({
                      ...draftSelection,
                      note: event.target.value,
                    })
                  }
                  placeholder="例如少冰、不加蔥"
                />
              </label>
            )}
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={confirmItem}
            >
              加入購物車
            </button>
          </section>
        </div>
      )}
    </main>
  );
}
