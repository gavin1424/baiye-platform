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
  getOrderingMemberToken,
  orderingPublicApi,
  saveOrderingMemberToken,
  type OrderingCategory,
  type OrderingContext,
  type OrderingCoupon,
  type OrderingDeliveryLink,
  type OrderingMember,
  type OrderingMenuItem,
  type OrderingOrder,
  type OrderingPaymentOption,
  type OrderingOrderStatus,
  type OrderingOrderType,
  type OrderingPurpose,
  type QrContextResponse,
  type QrMenuResponse,
} from "../qr-ordering-client";

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
  const [coupons, setCoupons] = useState<OrderingCoupon[]>([]);
  const [selectedCoupon, setSelectedCoupon] = useState("");
  const [paymentOptions, setPaymentOptions] = useState<OrderingPaymentOption[]>([]);
  const [deliveryLinks, setDeliveryLinks] = useState<OrderingDeliveryLink[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [order, setOrder] = useState<OrderingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [joinForm, setJoinForm] = useState({ display_name: "", phone: "", email: "", consent: false });
  const [orderType, setOrderType] = useState<OrderingOrderType>("dine_in");
  const [tableLabel, setTableLabel] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const pendingOrderKey = useRef("");

  const loadBenefits = useCallback(async (memberToken: string) => {
    if (!memberToken) return;
    const [couponData, paymentData, deliveryData] = await Promise.all([
      orderingPublicApi<{items:OrderingCoupon[]}>(`/api/ordering/qr/${encodeURIComponent(code)}/coupons`,{},memberToken),
      orderingPublicApi<{items:OrderingPaymentOption[]}>(`/api/ordering/qr/${encodeURIComponent(code)}/payment-options`),
      orderingPublicApi<{items:OrderingDeliveryLink[]}>(`/api/ordering/qr/${encodeURIComponent(code)}/delivery-links`),
    ]);
    setCoupons(couponData.items||[]);setPaymentOptions(paymentData.items||[]);setDeliveryLinks(deliveryData.items||[]);
    const usable=(couponData.items||[]).find(c=>c.status==="active");if(usable)setSelectedCoupon(usable.id);
  },[code]);

  const loadMenu = useCallback(async (ctx: OrderingContext, memberToken: string) => {
    if (!memberToken && ctx.require_member) return;
    const data = await orderingPublicApi<QrMenuResponse>(
      `/api/ordering/qr/${encodeURIComponent(code)}/menu`,
      {},
      memberToken,
    );
    setCategories(data.categories || []);
    setItems(data.items || []);
    if (data.member) setMember(data.member);
  }, [code]);

  const initialize = useCallback(async () => {
    setLoading(true);
    setMessage("");
    setOrder(null);
    setCart({});
    try {
      const data = await orderingPublicApi<QrContextResponse>(`/api/ordering/qr/${encodeURIComponent(code)}`);
      const ctx = data.context;
      setContext(ctx);
      setMember(data.member);
      setTableLabel(ctx.qr.table_label || "");
      if (ctx.qr.purpose === "takeaway") setOrderType("takeaway");
      else if (ctx.qr.purpose === "dine_in") setOrderType("dine_in");
      else if (!ctx.dine_in_enabled && ctx.takeaway_enabled) setOrderType("takeaway");

      const savedToken = getOrderingMemberToken(ctx.merchant_id);
      if (savedToken) {
        try {
          setToken(savedToken);
          await loadMenu(ctx, savedToken);
          await loadBenefits(savedToken);
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
    if (!order || !token || ["completed", "cancelled"].includes(order.status)) return undefined;
    const timer = window.setInterval(() => {
      void orderingPublicApi<{ order: OrderingOrder }>(
        `/api/ordering/orders/${encodeURIComponent(order.order_code)}`,
        {},
        token,
      ).then((data) => setOrder(data.order)).catch(() => undefined);
    }, 12_000);
    return () => window.clearInterval(timer);
  }, [order, token]);

  const groupedItems = useMemo(() => {
    const result = categories.map((category) => ({
      category,
      items: items.filter((item) => item.category_id === category.id),
    })).filter((group) => group.items.length > 0);
    const known = new Set(categories.map((category) => category.id));
    const uncategorized = items.filter((item) => !known.has(item.category_id));
    if (uncategorized.length) {
      result.push({
        category: { id: "uncategorized", name: "其他", sort_order: 9999 },
        items: uncategorized,
      });
    }
    return result;
  }, [categories, items]);

  const cartLines = useMemo(() => items
    .filter((item) => Number(cart[item.id] || 0) > 0)
    .map((item) => ({ ...item, quantity: Number(cart[item.id]) })), [cart, items]);
  const cartCount = cartLines.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cartLines.reduce((sum, item) => sum + item.price_minor * item.quantity, 0);

  const changeQuantity = (itemId: string, delta: number) => {
    setCart((current) => {
      const next = Math.max(0, Math.min(20, Number(current[itemId] || 0) + delta));
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
      if(data.coupon)setCoupons([data.coupon]);
      await loadBenefits(data.session.token);
      if (context.qr.purpose !== "member_only") await loadMenu(context, data.session.token);
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
      pendingOrderKey.current = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
    try {
      const data = await orderingPublicApi<{ order: OrderingOrder; message: string }>(
        `/api/ordering/qr/${encodeURIComponent(code)}/orders`,
        {
          method: "POST",
          headers: { "idempotency-key": pendingOrderKey.current },
          body: JSON.stringify({
            order_type: orderType,
            table_label: tableLabel,
            customer_note: customerNote,
            items: cartLines.map((item) => ({ item_id: item.id, quantity: item.quantity })),
            coupon_id: selectedCoupon || undefined,
          }),
        },
        token,
      );
      setOrder(data.order);
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
    return <main className="ordering-page"><OrderingTopbar /><section className="ordering-loading"><span className="ordering-spinner"/><p>正在讀取商家與 QR Code…</p></section></main>;
  }

  if (!context) {
    return <main className="ordering-page"><OrderingTopbar /><section className="ordering-center-card"><QrCode size={48}/><h1>QR Code 無法使用</h1><p>{message || "此 QR Code 無效、已停用或已過期。"}</p><Link className="btn btn-primary" to="/">返回創百業首頁</Link></section></main>;
  }

  if (!context.enabled) {
    return <main className="ordering-page"><OrderingTopbar /><section className="ordering-center-card"><Storefront size={48}/><h1>{context.display_name}</h1><p>此商家的掃碼會員與點餐服務尚未開放，請洽現場人員。</p></section></main>;
  }

  const showJoin = !member || !token;
  const showTableInput = orderType === "dine_in" && !context.qr.table_label;

  return (
    <main className="ordering-page">
      <OrderingTopbar />
      <section className="ordering-merchant-hero">
        <div>
          <span className="ordering-purpose"><QrCode weight="fill"/> {purposeLabels[context.qr.purpose]}</span>
          <h1>{context.display_name}</h1>
          <p>{context.qr.label}{context.qr.table_label ? `・${context.qr.table_label}` : ""}</p>
        </div>
        {member && <div className="ordering-member-chip"><Check weight="bold"/><span><strong>{member.display_name}</strong><small>{member.membership_no}</small></span></div>}
      </section>

      {message && <div className="ordering-message" role="status">{message}</div>}

      {order && (
        <section className="ordering-order-status-card">
          <div className={`ordering-status-icon tone-${statusTone(order.status)}`}><Receipt weight="duotone"/></div>
          <div>
            <span>訂單編號</span>
            <h2>{order.order_code}</h2>
            <p className={`ordering-status-pill tone-${statusTone(order.status)}`}>{orderStatusLabels[order.status]}</p>
            <small>系統會自動更新處理狀態；需要協助時請向店家出示訂單編號。</small>
          </div>
          <strong>{money(order.pricing?.payable_total_minor??order.total_minor, context.currency)}</strong>
        </section>
      )}

      {showJoin ? (
        <section className="ordering-join-card">
          <div className="ordering-section-heading"><Users weight="duotone"/><div><span>手機快速加入</span><h2>加入會員後立即點餐</h2><p>不用安裝 App，填寫基本資料即可在本手機使用。</p></div></div>
          <form onSubmit={join} className="ordering-form-grid">
            <label>姓名<input required autoComplete="name" value={joinForm.display_name} onChange={(event) => setJoinForm({ ...joinForm, display_name: event.target.value })} placeholder="請輸入姓名"/></label>
            <label>手機號碼<input required inputMode="tel" autoComplete="tel" value={joinForm.phone} onChange={(event) => setJoinForm({ ...joinForm, phone: event.target.value })} placeholder="09xxxxxxxx"/></label>
            <label className="ordering-form-wide">Email（選填）<input type="email" autoComplete="email" value={joinForm.email} onChange={(event) => setJoinForm({ ...joinForm, email: event.target.value })} placeholder="接收通知用，可不填"/></label>
            <label className="ordering-consent ordering-form-wide"><input type="checkbox" checked={joinForm.consent} onChange={(event) => setJoinForm({ ...joinForm, consent: event.target.checked })}/><span>我同意以本資料建立此商家的快速會員，並已閱讀<Link to="/privacy">隱私權政策</Link>。快速會員僅用於會員識別與點餐，不在此頁顯示完整手機資料。</span></label>
            <button className="btn btn-primary btn-lg ordering-form-wide" type="submit" disabled={submitting}>{submitting ? "正在加入…" : "加入會員並開始點餐"}</button>
          </form>
        </section>
      ) : context.qr.purpose === "member_only" ? (
        <section className="ordering-center-card ordering-success-card"><Check size={52} weight="bold"/><h2>會員加入完成</h2><p>{member.display_name}，您已成為「{context.display_name}」快速會員。</p><small>手機：{member.phone_masked}</small></section>
      ) : (
        <>
          <section className="ordering-controls-card">
            <div><span>本次用餐方式</span><strong>{orderType === "dine_in" ? "內用" : "外帶"}</strong>{context.qr.table_label && <small>桌號：{context.qr.table_label}</small>}</div>
            {context.qr.purpose === "member_order" && context.dine_in_enabled && context.takeaway_enabled && (
              <div className="ordering-segmented"><button type="button" className={orderType === "dine_in" ? "active" : ""} onClick={() => setOrderType("dine_in")}>內用</button><button type="button" className={orderType === "takeaway" ? "active" : ""} onClick={() => setOrderType("takeaway")}>外帶</button></div>
            )}
            {showTableInput && <label>桌號<input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="例如 A3、12 桌"/></label>}
          </section>
          {coupons.length>0&&<section className="ordering-controls-card"><div><span>我的禮券</span><strong>會員 NT$100 禮券</strong><small>外送平台訂單預設不適用</small></div><div>{coupons.map(c=><label key={c.id} className="ordering-consent"><input type="radio" name="coupon" checked={selectedCoupon===c.id} disabled={c.status!=="active"} onChange={()=>setSelectedCoupon(c.id)}/><span>{money(c.discount_value_minor,context.currency)}・{c.status==="active"?"可使用":c.status==="pending_verification"?"待手機驗證":c.status}</span></label>)}</div></section>}
          {deliveryLinks.length>0&&<section className="ordering-controls-card"><div><span>外送訂購</span><strong>第三方與商家外送服務</strong><small>商品、價格、優惠、付款及退款依外送平台頁面為準。</small></div><div className="ordering-qr-actions">{deliveryLinks.map(link=><a key={link.id} className="btn btn-outline" href={link.order_url} target="_blank" rel="noopener noreferrer">{link.display_name}</a>)}</div></section>}

          <section className="ordering-menu-section">
            <div className="ordering-section-heading"><ForkKnife weight="duotone"/><div><span>手機菜單</span><h2>選擇餐點</h2><p>價格與供應狀態以送單當下的店家資料為準。</p></div></div>
            {groupedItems.length === 0 ? (
              <div className="ordering-empty"><CookingPot size={44}/><h3>店家尚未公布菜單</h3><p>請洽現場人員，或稍後重新整理。</p><button type="button" className="btn btn-outline" onClick={() => context && token && void loadMenu(context, token)}><ArrowClockwise/>重新整理</button></div>
            ) : groupedItems.map(({ category, items: categoryItems }) => (
              <div className="ordering-category" key={category.id}>
                <div className="ordering-category-title"><h3>{category.name}</h3>{category.description && <p>{category.description}</p>}</div>
                <div className="ordering-menu-grid">
                  {categoryItems.map((item) => {
                    const quantity = Number(cart[item.id] || 0);
                    return <article className="ordering-menu-item" key={item.id}>
                      {item.image_url && <img src={item.image_url} alt={item.name} loading="lazy"/>}
                      <div className="ordering-menu-copy"><h4>{item.name}</h4>{item.description && <p>{item.description}</p>}<strong>{money(item.price_minor, context.currency)}</strong></div>
                      <div className="ordering-quantity" aria-label={`${item.name}數量`}><button type="button" onClick={() => changeQuantity(item.id, -1)} disabled={quantity === 0} aria-label={`減少${item.name}`}><Minus/></button><span>{quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)} disabled={quantity >= 20} aria-label={`增加${item.name}`}><Plus/></button></div>
                    </article>;
                  })}
                </div>
              </div>
            ))}
          </section>
        </>
      )}

      {cartCount > 0 && !showJoin && (
        <button type="button" className="ordering-cart-bar" onClick={() => setCartOpen(true)}><span><ShoppingCart weight="fill"/><b>{cartCount}</b> 查看購物車</span><strong>{money(subtotal, context.currency)}</strong></button>
      )}

      {cartOpen && (
        <div className="ordering-modal-backdrop" role="presentation" onClick={() => setCartOpen(false)}>
          <section className="ordering-cart-sheet" role="dialog" aria-modal="true" aria-label="購物車" onClick={(event) => event.stopPropagation()}>
            <header><div><span>確認餐點</span><h2>購物車</h2></div><button type="button" onClick={() => setCartOpen(false)} aria-label="關閉購物車"><X/></button></header>
            <div className="ordering-cart-lines">{cartLines.map((item) => <div className="ordering-cart-line" key={item.id}><div><strong>{item.name}</strong><small>{money(item.price_minor, context.currency)} × {item.quantity}</small></div><div className="ordering-quantity"><button type="button" onClick={() => changeQuantity(item.id, -1)}><Minus/></button><span>{item.quantity}</span><button type="button" onClick={() => changeQuantity(item.id, 1)}><Plus/></button></div><b>{money(item.price_minor * item.quantity, context.currency)}</b></div>)}</div>
            <label className="ordering-note">給店家的備註<textarea value={customerNote} onChange={(event) => setCustomerNote(event.target.value)} maxLength={500} placeholder="例如：不要辣、餐具需求（實際仍以店家可提供內容為準）"/></label>
            {showTableInput && <label className="ordering-note">桌號<input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="請輸入桌號"/></label>}
            <div className="ordering-cart-total"><span>合計</span><strong>{money(subtotal, context.currency)}</strong></div>
            {selectedCoupon&&<div className="ordering-cart-total"><span>會員禮券</span><strong>-{money(Math.min(10000,subtotal),context.currency)}</strong></div>}
            {selectedCoupon&&<div className="ordering-cart-total"><span>應付金額</span><strong>{money(Math.max(subtotal-10000,0),context.currency)}</strong></div>}
            <button type="button" className="btn btn-primary btn-lg" onClick={() => void submitOrder()} disabled={submitting || (showTableInput && !tableLabel.trim())}>{submitting ? "正在送出…" : "確認送出訂單"}</button>
            <small>{paymentOptions.length?"送單後可依商家開通狀態選擇："+paymentOptions.map(x=>x.display_name).join("、"):"目前由店家現場收款；送出前不會進行線上扣款。"}</small>
          </section>
        </div>
      )}
    </main>
  );
}
