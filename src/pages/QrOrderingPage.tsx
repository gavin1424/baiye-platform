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
  merchantOrderingApi,
  saveOrderingMemberToken,
  getPlatformMemberToken,
  savePlatformMemberToken,
  getPlatformDeviceId,
  saveOrderingLastOrder,
  clearPersistedOrderingCart,
  getOrderingLineClicked,
  getPersistedOrderingCart,
  saveOrderingLineClicked,
  savePersistedOrderingCart,
  type OrderingCategory,
  type OrderingContext,
  type OrderingDeliveryLink,
  type OrderingMember,
  type OrderingMenuItem,
  type OrderingOptionGroup,
  type OrderingOptionValue,
  type OrderingItemOptionGroup,
  type OrderingOrder,
  type OrderingPaymentOption,
  type CheckoutPaymentCapability,
  type CheckoutPaymentProvider,
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
  if (IS_BEEF_NOODLE_DEMO) return null;
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
  const [paymentOptions, setPaymentOptions] = useState<OrderingPaymentOption[]>(
    [],
  );
  const [checkoutPaymentOptions, setCheckoutPaymentOptions] = useState<CheckoutPaymentCapability[]>([]);
  const [checkoutPaymentProvider, setCheckoutPaymentProvider] = useState<CheckoutPaymentProvider>("manual_counter");
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
    phone: "",
    consent: false,
  });
  const [orderType, setOrderType] = useState<OrderingOrderType>("dine_in");
  const [tableLabel, setTableLabel] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [demoInvoiceMethod, setDemoInvoiceMethod] = useState<"individual" | "mobile_barcode" | "business_tax_id" | "donation">("individual");
  const [invoiceCarrier, setInvoiceCarrier] = useState("");
  const [invoiceTaxId, setInvoiceTaxId] = useState("");
  const [invoiceBuyerName, setInvoiceBuyerName] = useState("");
  const [invoiceDonationCode, setInvoiceDonationCode] = useState("");
  const [lineClicked, setLineClicked] = useState(false);
  const [lineCheckoutSkipped, setLineCheckoutSkipped] = useState(false);
  const [demoAdministrator, setDemoAdministrator] = useState(false);
  const pendingOrderKey = useRef("");
  const joinRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!IS_BEEF_NOODLE_DEMO) return;
    void merchantOrderingApi("/api/merchant-auth/session").then(() => setDemoAdministrator(true)).catch(() => setDemoAdministrator(false));
  }, []);

  const loadBenefits = useCallback(
    async (memberToken: string) => {
      if (!memberToken) return;
      const [paymentData, deliveryData, checkoutPayments] = await Promise.all([
        orderingPublicApi<{ items: OrderingPaymentOption[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/payment-options`,
        ),
        orderingPublicApi<{ items: OrderingDeliveryLink[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/delivery-links`,
        ),
        orderingPublicApi<{ items: CheckoutPaymentCapability[] }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/payment-capabilities`,
        ),
      ]);
      setPaymentOptions(paymentData.items || []);
      setDeliveryLinks(deliveryData.items || []);
      setCheckoutPaymentOptions(checkoutPayments.items || []);
    },
    [code],
  );

  const loadMenu = useCallback(
    async (ctx: OrderingContext, memberToken: string) => {
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
      const persisted = getPersistedOrderingCart(code);
      if (persisted) {
        setCart(persisted.cart || {});
        setItemSelections(persisted.itemSelections || {});
        setCustomerNote(persisted.customerNote || "");
        if (!ctx.qr.table_label) setTableLabel(persisted.tableLabel || "");
        if (ctx.qr.purpose === "member_order") setOrderType(persisted.orderType || "dine_in");
      }
      setLineClicked(getOrderingLineClicked(code));

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
      } else {
        await loadMenu(ctx, "");
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
    if (!context || loading || order) return;
    savePersistedOrderingCart(code, { cart, itemSelections, customerNote, orderType, tableLabel });
  }, [cart, code, context, customerNote, itemSelections, loading, order, orderType, tableLabel]);

  useEffect(() => {
    if (!context?.line.configured) return;
    const key = `baiye:ordering-line-impression:${code}:menu_banner`;
    if (window.sessionStorage.getItem(key)) return;
    window.sessionStorage.setItem(key, "1");
    void orderingPublicApi(`/api/ordering/qr/${encodeURIComponent(code)}/line-events`, { method: "POST", body: JSON.stringify({ event_type: "impression", source: "menu_banner" }) }).catch(() => undefined);
  }, [code, context?.line.configured]);

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
    if (item.status === "sold_out" || item.available === false || (item.inventory_enabled && Number(item.stock_on_hand) === 0)) return;
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
    const item = items.find((candidate) => candidate.id === itemId);
    const maximum = item?.inventory_enabled ? Math.min(20, Number(item.stock_on_hand || 0)) : 20;
    setCart((current) => {
      const next = Math.max(
        0,
        Math.min(maximum, Number(current[itemId] || 0) + delta),
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
        platform_session?: { token: string; expires_at: string } | null;
        welcome?: { show: boolean; title?: string; message?: string };
      }>(`/api/ordering/qr/${encodeURIComponent(code)}/join`, {
        method: "POST",
        headers: {
          "x-platform-member-token": getPlatformMemberToken(),
          "x-device-id": getPlatformDeviceId(),
        },
        body: JSON.stringify({
          phone: joinForm.phone,
          privacy_consent: joinForm.consent,
          consent_version: context.consent_version,
          device_id: getPlatformDeviceId(),
        }),
      });
      setMember(data.member);
      setToken(data.session.token);
      saveOrderingMemberToken(context.merchant_id, data.session.token);
      if (data.platform_session?.token) savePlatformMemberToken(data.platform_session.token);
      setMessage(data.welcome?.show ? `${data.welcome.title} ${data.welcome.message}` : data.message);
      await loadBenefits(data.session.token);
      if (context.qr.purpose !== "member_only")
        await loadMenu(context, data.session.token);
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const recordLineClick = (source: "menu_banner" | "checkout_reminder" | "order_success") => {
    if (!context?.line.configured) return;
    saveOrderingLineClicked(code);
    setLineClicked(true);
    void orderingPublicApi(`/api/ordering/qr/${encodeURIComponent(code)}/line-events`, {
      method: "POST",
      body: JSON.stringify({ event_type: "click", source }),
    }).catch(() => undefined);
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
            // QR V1 remains merchant-confirmed collection. The Worker keeps the
            // authoritative default (`counter`) and never trusts a customer-paid flag.
            payment_method: "counter",
            invoice: {
              type: demoInvoiceMethod,
              carrier_value: invoiceCarrier,
              buyer_identifier: invoiceTaxId,
              buyer_name: invoiceBuyerName,
              donation_code: invoiceDonationCode,
            },
            items: cartLines.map((item) => ({
              item_id: item.id,
              quantity: item.quantity,
              option_value_ids: itemSelections[item.id]?.option_value_ids || [],
              note: item.allow_customer_note
                ? itemSelections[item.id]?.note || ""
                : "",
            })),
          }),
        },
        token,
      );
      setOrder(data.order);
      saveOrderingLastOrder(context.merchant_id, data.order.order_code);
      setCart({});
      setItemSelections({});
      clearPersistedOrderingCart(code);
      setCartOpen(false);
      setCustomerNote("");
      setMessage(data.message);
      if (checkoutPaymentProvider !== "manual_counter") {
        const paymentKey = `${pendingOrderKey.current || crypto.randomUUID()}:payment`;
        const payment = await orderingPublicApi<{ redirect_url?: string; intent: { status: string } }>(
          `/api/ordering/qr/${encodeURIComponent(code)}/payments`,
          {
            method: "POST",
            headers: { "idempotency-key": paymentKey },
            body: JSON.stringify({ order_code: data.order.order_code, provider: checkoutPaymentProvider }),
          },
          token,
        );
        if (payment.redirect_url) {
          window.location.assign(payment.redirect_url);
          return;
        }
      }
      pendingOrderKey.current = "";
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      if (errorStatus(error) === 401 && context) {
        clearOrderingMemberToken(context.merchant_id);
        setToken("");
        setMember(null);
      }
      if (errorStatus(error) === 409 && (error as { code?: string })?.code === "INVENTORY_INSUFFICIENT") await loadMenu(context, token).catch(() => undefined);
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
  const demoDirectMenu =
    IS_BEEF_NOODLE_DEMO && context.qr.purpose !== "member_only";
  const officialProductionDemo = context.merchant_id === "demo_beef_noodle";
  const storefrontName = IS_BEEF_NOODLE_DEMO
    ? context.display_name.split("｜")[0]
    : context.display_name;
  const serviceLabel =
    context.qr.purpose === "takeaway"
      ? "外帶｜自取"
      : `${context.qr.table_label || context.qr.label}｜內用`;

  return (
    <main className="ordering-page">
      <OrderingTopbar />
      <section className={`ordering-merchant-hero ${IS_BEEF_NOODLE_DEMO ? "ordering-storefront-hero" : ""}`}>
        <div className="ordering-storefront-brand">
          {IS_BEEF_NOODLE_DEMO && <span className="ordering-storefront-logo" aria-hidden="true"><CookingPot weight="fill" /></span>}
          <div>
            {!IS_BEEF_NOODLE_DEMO && (
              <span className="ordering-purpose">
                <QrCode weight="fill" /> {purposeLabels[context.qr.purpose]}
              </span>
            )}
            <h1>{storefrontName}</h1>
            {IS_BEEF_NOODLE_DEMO ? (
              <p className="ordering-storefront-meta"><span>營業中</span>{serviceLabel}</p>
            ) : (
              <p>{context.qr.label}{context.qr.table_label ? `・${context.qr.table_label}` : ""}</p>
            )}
          </div>
        </div>
        {member && (
          <div className={`ordering-member-chip ${IS_BEEF_NOODLE_DEMO ? "ordering-member-chip-compact" : ""}`}>
            <Check weight="bold" />
            <span>
              <strong>{IS_BEEF_NOODLE_DEMO ? "會員" : member.display_name}</strong>
              {!IS_BEEF_NOODLE_DEMO && <small>{member.membership_no}</small>}
            </span>
          </div>
        )}
        {IS_BEEF_NOODLE_DEMO && demoAdministrator && <Link className="btn btn-outline ordering-admin-return" to="/merchant/dashboard">返回管理中心</Link>}
      </section>

      {officialProductionDemo && <div className="ordering-demo-privacy-note"><strong>百工官方示範店</strong>｜示範資料／不進行真實交易。正式付款 Provider 尚未啟用。</div>}

      {IS_BEEF_NOODLE_DEMO && (
        context.line.configured ? (
          <section className="ordering-line-banner" aria-label="店家 LINE 官方帳號">
            <div><strong>加入{context.line.display_name || "百工牛肉麵 LINE"}</strong><span>加入後方便接收優惠與店家消息</span></div>
            <a className="btn btn-outline" href={context.line.add_friend_url} target="_blank" rel="noopener noreferrer" onClick={() => recordLineClick("menu_banner")}>加入 LINE</a>
          </section>
        ) : (
          <p className="ordering-line-unconfigured">LINE 官方帳號尚未設定</p>
        )
      )}

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
              系統會自動更新處理狀態；需要協助時請向店家出示訂單編號。現場付款將由店家確認。
            </small>
            <div className="ordering-invoice-status"><strong>發票</strong>{order.invoice?.status === "ISSUED" ? <span>電子發票已開立：{order.invoice.invoice_number}</span> : <span>電子發票服務尚未啟用</span>}</div>
            <div className="ordering-status-actions">
              <button
                className="btn btn-outline"
                type="button"
                onClick={() => setOrder(null)}
              >
                再加點
              </button>
              {IS_BEEF_NOODLE_DEMO && context.line.configured && !lineClicked && (
                <a className="btn btn-outline" href={context.line.add_friend_url} target="_blank" rel="noopener noreferrer" onClick={() => recordLineClick("order_success")}>加入店家 LINE</a>
              )}
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

      {showJoin && !demoDirectMenu ? (
        <section className="ordering-join-card">
          <div className="ordering-section-heading">
            <Users weight="duotone" />
            <div>
              <span>手機快速加入</span>
              <h2>加入會員後立即點餐</h2>
              <p>不用安裝 App、不用密碼，只需手機號碼即可加入。</p>
            </div>
          </div>
          {officialProductionDemo ? (
            <p className="ordering-demo-privacy-note">
              此頁使用正式 Platform Member canonical identity；請僅在同意會員資料處理時輸入手機號碼。
            </p>
          ) : null}
          <form onSubmit={join} className="ordering-form-grid">
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
            <label className="ordering-consent ordering-form-wide">
              <input
                type="checkbox"
                checked={joinForm.consent}
                onChange={(event) =>
                  setJoinForm({ ...joinForm, consent: event.target.checked })
                }
              />
              <span>
                我已閱讀並同意會員服務與
                <Link to="/privacy">隱私權政策</Link>
                。手機僅用於會員識別，不會在公開頁面顯示。
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
            {member?.display_name || "您"}，您已成為「{context.display_name}」快速會員。
          </p>
          <small>手機：{member?.phone_masked || ""}</small>
        </section>
      ) : (
        <>
          {!IS_BEEF_NOODLE_DEMO && <section className="ordering-controls-card">
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
          </section>}
          {!IS_BEEF_NOODLE_DEMO && deliveryLinks.length > 0 && (
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
            {!IS_BEEF_NOODLE_DEMO && <div className="ordering-section-heading">
              <ForkKnife weight="duotone" />
              <div>
                <span>手機菜單</span>
                <h2>選擇餐點</h2>
                <p>價格與供應狀態以送單當下的店家資料為準。</p>
              </div>
            </div>}
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
                    context && void loadMenu(context, token)
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
                      const soldOut = item.status === "sold_out" || item.available === false || (item.inventory_enabled && Number(item.stock_on_hand) === 0);
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
                              <span className="ordering-soldout">售完</span>
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
                              disabled={soldOut || quantity >= (item.inventory_enabled ? Math.min(20, Number(item.stock_on_hand || 0)) : 20)}
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
          {showJoin && demoDirectMenu && (
            <section className="ordering-join-card ordering-join-after-menu" ref={joinRef}>
              <div className="ordering-section-heading">
                <Users weight="duotone" />
                <div>
                  <span>準備結帳</span>
                  <h2>用手機加入後送出訂單</h2>
                  <p>先看菜單、選好餐點；送單前只需留下手機號碼。</p>
                </div>
              </div>
              <form onSubmit={join} className="ordering-form-grid">
                <label>
                  手機號碼
                  <input required inputMode="tel" autoComplete="tel" value={joinForm.phone} onChange={(event) => setJoinForm({ ...joinForm, phone: event.target.value })} placeholder="09xxxxxxxx" />
                </label>
                <label className="ordering-consent ordering-form-wide">
                  <input type="checkbox" checked={joinForm.consent} onChange={(event) => setJoinForm({ ...joinForm, consent: event.target.checked })} />
                  <span>我已閱讀並同意會員服務與<Link to="/privacy">隱私權政策</Link>。</span>
                </label>
                <button className="btn btn-primary btn-lg ordering-form-wide" type="submit" disabled={submitting}>{submitting ? "正在加入…" : "加入會員並繼續結帳"}</button>
              </form>
            </section>
          )}
        </>
      )}

      {cartCount > 0 && (!showJoin || demoDirectMenu) && (
        <button
          type="button"
          className="ordering-cart-bar"
          onClick={() => {
            if (showJoin) joinRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
            else setCartOpen(true);
          }}
        >
          <span>
            <ShoppingCart weight="fill" />
            <b>{cartCount}</b> {showJoin ? "加入會員後結帳" : "查看購物車"}
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
                      disabled={item.inventory_enabled && item.quantity >= Number(item.stock_on_hand || 0)}
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
            {IS_BEEF_NOODLE_DEMO && (
              <section className="ordering-demo-checkout" aria-label="牛肉麵 Demo 結帳方式">
                <div>
                  <span>付款方式</span>
                  <strong>{checkoutPaymentProvider === "manual_counter" ? "現場付款" : checkoutPaymentProvider === "line_pay_online" ? "LINE Pay（Sandbox）" : "Apple Pay"}</strong>
                  <small>{checkoutPaymentProvider === "manual_counter" ? "送單後由店家於現場確認收款，不會進行線上扣款。" : "金額由系統重新核算後才會建立付款流程。"}</small>
                </div>
                <label className="ordering-demo-payment-active">
                  <input type="radio" checked={checkoutPaymentProvider === "manual_counter"} onChange={() => setCheckoutPaymentProvider("manual_counter")} name="demo-payment" />
                  現場付款（可使用現金、刷卡或櫃檯確認）
                </label>
                <div className="ordering-demo-disabled-options" aria-label="後續付款功能預留">
                  {(["line_pay_online", "apple_pay_web"] as const).map((provider) => {
                    const option = checkoutPaymentOptions.find((item) => item.provider === provider);
                    const label = provider === "line_pay_online" ? "LINE Pay" : "Apple Pay";
                    const unavailable = provider === "line_pay_online" ? "LINE Pay 測試環境尚未設定" : "Apple Pay 測試設定尚未完成";
                    return <label key={provider} className={option?.enabled ? "ordering-demo-payment-active" : "ordering-demo-payment-disabled"}>
                      <input type="radio" name="demo-payment" checked={checkoutPaymentProvider === provider} disabled={!option?.enabled} onChange={() => setCheckoutPaymentProvider(provider)} />
                      {label}・{option?.enabled ? "Sandbox 可用" : unavailable}
                    </label>;
                  })}
                </div>
                <fieldset className="ordering-invoice-options">
                  <legend>發票方式</legend>
                  <label><input type="radio" name="invoice-method" checked={demoInvoiceMethod === "individual"} onChange={() => setDemoInvoiceMethod("individual")} />個人電子發票</label>
                  <label><input type="radio" name="invoice-method" checked={demoInvoiceMethod === "mobile_barcode"} onChange={() => setDemoInvoiceMethod("mobile_barcode")} />手機條碼載具</label>
                  <label><input type="radio" name="invoice-method" checked={demoInvoiceMethod === "business_tax_id"} onChange={() => setDemoInvoiceMethod("business_tax_id")} />公司統編</label>
                  <label><input type="radio" name="invoice-method" checked={demoInvoiceMethod === "donation"} onChange={() => setDemoInvoiceMethod("donation")} />捐贈</label>
                </fieldset>
                {demoInvoiceMethod === "mobile_barcode" && <label>手機條碼載具<input value={invoiceCarrier} placeholder="/ABC1234" maxLength={8} onChange={(event) => setInvoiceCarrier(event.target.value.toUpperCase())} /><small>僅檢查格式；尚未向財政部驗證。</small></label>}
                {demoInvoiceMethod === "business_tax_id" && <><label>統一編號<input inputMode="numeric" value={invoiceTaxId} placeholder="12345678" maxLength={8} onChange={(event) => setInvoiceTaxId(event.target.value.replace(/\D/g, ""))} /></label><label>公司抬頭（選填）<input value={invoiceBuyerName} maxLength={160} onChange={(event) => setInvoiceBuyerName(event.target.value)} /></label></>}
                {demoInvoiceMethod === "donation" && <label>捐贈碼<input value={invoiceDonationCode} maxLength={40} onChange={(event) => setInvoiceDonationCode(event.target.value)} /><small>正式驗證待電子發票服務啟用。</small></label>}
                <p>電子發票服務尚未啟用（INVOICE_PROVIDER_DISABLED）。Demo 訂單不會產生正式發票。</p>
                {context.line.configured && !lineClicked && !lineCheckoutSkipped && (
                  <div className="ordering-line-checkout-reminder">
                    <strong>加入{context.line.display_name || "店家 LINE"}</strong>
                    <span>加入後可接收店家優惠與最新消息，不加入也能繼續結帳。</span>
                    <div>
                      <a className="btn btn-outline" href={context.line.add_friend_url} target="_blank" rel="noopener noreferrer" onClick={() => recordLineClick("checkout_reminder")}>加入 LINE</a>
                      <button type="button" className="btn btn-ghost" onClick={() => setLineCheckoutSkipped(true)}>先不用，繼續結帳</button>
                    </div>
                  </div>
                )}
                {!context.line.configured && <p>LINE 官方帳號尚未設定；本 Demo 不會偽造加入好友結果。</p>}
              </section>
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
      {IS_BEEF_NOODLE_DEMO && <footer className="ordering-powered">Powered by 創百業智慧鏈</footer>}
    </main>
  );
}
