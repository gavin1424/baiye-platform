import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { SiteSettings } from "./types";
import { defaultShopProducts } from "./shop-data";
import type {
  CartOperationResult,
  FulfillmentType,
  OrderStatus,
  PaymentStatus,
  ShopCartItem,
  ShopCustomer,
  ShopOrder,
  ShopPaymentMethod,
  ShopProduct,
} from "./shop-types";

type Role = "guest" | "business" | "admin";
export type MembershipPlan = "free" | "pro" | "enterprise";

type Session = {
  role: Role;
  name: string;
  email: string;
};

type AppStoreValue = {
  session: Session;
  businessFavorites: number[];
  productFavorites: number[];
  needFavorites: number[];
  followedBusinesses: number[];
  inquiryCart: number[];
  proposals: number[];
  notificationsRead: number[];
  siteSettings: SiteSettings;
  membershipPlan: MembershipPlan;
  shopProducts: ShopProduct[];
  shopCart: ShopCartItem[];
  shopOrders: ShopOrder[];
  login: (email: string, password: string) => { ok: boolean; message: string };
  register: (name: string, email: string) => void;
  logout: () => void;
  toggleBusinessFavorite: (id: number) => void;
  toggleProductFavorite: (id: number) => void;
  toggleNeedFavorite: (id: number) => void;
  toggleFollow: (id: number) => void;
  addToInquiry: (id: number) => void;
  removeFromInquiry: (id: number) => void;
  submitProposal: (id: number) => void;
  markNotificationRead: (id: number) => void;
  markAllNotificationsRead: () => void;
  setSiteSettings: (settings: SiteSettings) => void;
  setMembershipPlan: (plan: MembershipPlan) => void;
  addToShopCart: (productId: number, quantity?: number) => CartOperationResult;
  updateShopCartQuantity: (productId: number, quantity: number) => CartOperationResult;
  removeFromShopCart: (productId: number) => void;
  clearShopCart: () => void;
  saveShopProduct: (product: ShopProduct) => void;
  toggleShopProductActive: (productId: number) => void;
  createShopOrder: (input: {
    customer: ShopCustomer;
    fulfillmentType: FulfillmentType;
    paymentMethod: ShopPaymentMethod;
  }) => ShopOrder | null;
  updateShopOrderPayment: (orderNumber: string, paymentStatus: PaymentStatus, providerReference?: string) => void;
  updateShopOrderStatus: (orderNumber: string, status: OrderStatus) => void;
  notify: (message: string, tone?: "success" | "info" | "warning") => void;
};

type Toast = {
  id: number;
  message: string;
  tone: "success" | "info" | "warning";
};

const defaultSiteSettings: SiteSettings = {
  name: "強哥水族",
  tagline: "專業水族造景・水族工程設計與維護",
  intro:
    "從空間評估、缸體規劃、魚種搭配到後續保養，提供一站式水族工程服務。",
  logo: "",
  cover: `${import.meta.env.BASE_URL}assets/business-aquarium-cover.jpg`,
  primaryColor: "#116b5d",
  template: "professional",
  fontStyle: "humanist",
  visibleSections: {
    about: true,
    services: true,
    portfolio: true,
    products: true,
    reviews: true,
    contact: true,
  },
  sectionOrder: ["about", "services", "portfolio", "products", "reviews", "contact"],
};

const defaultSession: Session = { role: "guest", name: "", email: "" };
const AppStoreContext = createContext<AppStoreValue | null>(null);

function loadValue<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(`baiye:${key}`);
    if (!value) return fallback;
    const parsed = JSON.parse(value) as T;
    if (
      parsed &&
      fallback &&
      typeof parsed === "object" &&
      typeof fallback === "object" &&
      !Array.isArray(parsed) &&
      !Array.isArray(fallback)
    ) {
      return { ...fallback, ...parsed };
    }
    return parsed;
  } catch {
    return fallback;
  }
}

function useStoredState<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => loadValue(key, fallback));

  useEffect(() => {
    window.localStorage.setItem(`baiye:${key}`, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}

function toggleId(list: number[], id: number) {
  return list.includes(id) ? list.filter((item) => item !== id) : [...list, id];
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useStoredState<Session>("session", defaultSession);
  const [businessFavorites, setBusinessFavorites] = useStoredState<number[]>("favorite-businesses", []);
  const [productFavorites, setProductFavorites] = useStoredState<number[]>("favorite-products", []);
  const [needFavorites, setNeedFavorites] = useStoredState<number[]>("favorite-needs", []);
  const [followedBusinesses, setFollowedBusinesses] = useStoredState<number[]>("followed-businesses", []);
  const [inquiryCart, setInquiryCart] = useStoredState<number[]>("inquiry-cart", []);
  const [proposals, setProposals] = useStoredState<number[]>("proposals", []);
  const [notificationsRead, setNotificationsRead] = useStoredState<number[]>("notifications-read", []);
  const [siteSettings, setSiteSettings] = useStoredState<SiteSettings>("site-settings", defaultSiteSettings);
  const [membershipPlan, setMembershipPlan] = useStoredState<MembershipPlan>("membership-plan", "free");
  const [shopProducts, setShopProducts] = useStoredState<ShopProduct[]>("shop-products", defaultShopProducts);
  const [shopCart, setShopCart] = useStoredState<ShopCartItem[]>("shop-cart", []);
  const [shopOrders, setShopOrders] = useStoredState<ShopOrder[]>("shop-orders", []);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const notify = useCallback((message: string, tone: Toast["tone"] = "success") => {
    const id = Date.now() + Math.random();
    setToasts((items) => [...items, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((items) => items.filter((item) => item.id !== id));
    }, 3200);
  }, []);

  const value = useMemo<AppStoreValue>(
    () => ({
      session,
      businessFavorites,
      productFavorites,
      needFavorites,
      followedBusinesses,
      inquiryCart,
      proposals,
      notificationsRead,
      siteSettings,
      membershipPlan,
      shopProducts,
      shopCart,
      shopOrders,
      login: (email, password) => {
        if (email === "demo@baiye.local" && password === "Demo1234") {
          setSession({ role: "business", name: "強哥水族", email });
          notify("登入成功，歡迎回來！");
          return { ok: true, message: "登入成功" };
        }
        if (email === "admin@baiye.local" && password === "Admin1234") {
          setSession({ role: "admin", name: "平台管理員", email });
          notify("管理員登入成功");
          return { ok: true, message: "登入成功" };
        }
        return { ok: false, message: "Email 或密碼不正確，請使用頁面上的測試帳號。" };
      },
      register: (name, email) => {
        setSession({ role: "business", name, email });
        setMembershipPlan("free");
        notify("註冊完成，商家網站草稿已建立");
      },
      logout: () => {
        setSession(defaultSession);
        notify("已安全登出", "info");
      },
      toggleBusinessFavorite: (id) => {
        const isFavorite = businessFavorites.includes(id);
        setBusinessFavorites((list) => toggleId(list, id));
        notify(isFavorite ? "已取消收藏商家" : "已收藏商家");
      },
      toggleProductFavorite: (id) => {
        const isFavorite = productFavorites.includes(id);
        setProductFavorites((list) => toggleId(list, id));
        notify(isFavorite ? "已取消收藏商品" : "已收藏商品");
      },
      toggleNeedFavorite: (id) => {
        const isFavorite = needFavorites.includes(id);
        setNeedFavorites((list) => toggleId(list, id));
        notify(isFavorite ? "已取消追蹤需求" : "已追蹤合作需求");
      },
      toggleFollow: (id) => {
        const isFollowing = followedBusinesses.includes(id);
        setFollowedBusinesses((list) => toggleId(list, id));
        notify(isFollowing ? "已取消追蹤" : "追蹤成功");
      },
      addToInquiry: (id) => {
        setInquiryCart((list) => (list.includes(id) ? list : [...list, id]));
        notify("已加入詢價單");
      },
      removeFromInquiry: (id) => {
        setInquiryCart((list) => list.filter((item) => item !== id));
        notify("已移出詢價單", "info");
      },
      submitProposal: (id) => {
        setProposals((list) => (list.includes(id) ? list : [...list, id]));
        notify("提案已送出，對方會收到通知");
      },
      markNotificationRead: (id) =>
        setNotificationsRead((list) => (list.includes(id) ? list : [...list, id])),
      markAllNotificationsRead: () => {
        setNotificationsRead([1, 2, 3, 4, 5, 6]);
        notify("所有通知已標示為已讀");
      },
      setSiteSettings,
      setMembershipPlan,
      addToShopCart: (productId, quantity = 1) => {
        const product = shopProducts.find((item) => item.id === productId && item.active);
        if (!product) return { ok: false, message: "此商品目前未上架" };
        if (product.stock < 1) {
          notify("此商品目前缺貨，暫時無法加入購物車", "warning");
          return { ok: false, message: "商品缺貨" };
        }
        const currentQuantity = shopCart.find((item) => item.productId === productId)?.quantity || 0;
        const nextQuantity = currentQuantity + Math.max(1, quantity);
        if (nextQuantity > product.stock) {
          notify(`庫存僅剩 ${product.stock} 件，已達可購買上限`, "warning");
          return { ok: false, message: "庫存不足" };
        }
        setShopCart((items) => {
          const existing = items.find((item) => item.productId === productId);
          if (existing) {
            return items.map((item) =>
              item.productId === productId ? { ...item, quantity: item.quantity + Math.max(1, quantity) } : item,
            );
          }
          return [...items, { productId, quantity: Math.max(1, quantity) }];
        });
        notify(`已將「${product.name}」加入購物車`);
        return { ok: true, message: "已加入購物車" };
      },
      updateShopCartQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          setShopCart((items) => items.filter((item) => item.productId !== productId));
          notify("商品已從購物車移除", "info");
          return { ok: true, message: "商品已移除" };
        }
        const product = shopProducts.find((item) => item.id === productId && item.active);
        if (!product || product.stock < quantity) {
          notify(product ? `庫存僅剩 ${product.stock} 件` : "此商品目前未上架", "warning");
          return { ok: false, message: product ? "庫存不足" : "商品未上架" };
        }
        setShopCart((items) =>
          items.map((item) => (item.productId === productId ? { ...item, quantity } : item)),
        );
        return { ok: true, message: "數量已更新" };
      },
      removeFromShopCart: (productId) => {
        setShopCart((items) => items.filter((item) => item.productId !== productId));
        notify("商品已從購物車移除", "info");
      },
      clearShopCart: () => setShopCart([]),
      saveShopProduct: (product) => {
        setShopProducts((items) => {
          const exists = items.some((item) => item.id === product.id);
          return exists ? items.map((item) => (item.id === product.id ? product : item)) : [product, ...items];
        });
        notify(`「${product.name}」已儲存`);
      },
      toggleShopProductActive: (productId) => {
        const product = shopProducts.find((item) => item.id === productId);
        setShopProducts((items) =>
          items.map((item) => (item.id === productId ? { ...item, active: !item.active } : item)),
        );
        if (product) notify(`「${product.name}」已${product.active ? "下架" : "上架"}`, "info");
      },
      createShopOrder: ({ customer, fulfillmentType, paymentMethod }) => {
        if (shopCart.length === 0) {
          notify("購物車目前沒有商品", "warning");
          return null;
        }
        const items = shopCart.flatMap((cartItem) => {
          const product = shopProducts.find((item) => item.id === cartItem.productId && item.active);
          if (!product || product.stock < cartItem.quantity) return [];
          return [{
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: product.price,
            quantity: cartItem.quantity,
          }];
        });
        if (items.length !== shopCart.length) {
          notify("部分商品庫存或上架狀態已變更，請重新確認購物車", "warning");
          return null;
        }
        const now = new Date();
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const shippingFee = fulfillmentType === "delivery" ? 120 : fulfillmentType === "store-pickup" ? 60 : 0;
        const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
        const orderNumber = `BY${datePart}${String(now.getTime()).slice(-6)}`;
        const order: ShopOrder = {
          id: crypto.randomUUID?.() || `${now.getTime()}-${Math.random().toString(16).slice(2)}`,
          orderNumber,
          items,
          customer,
          fulfillmentType,
          paymentMethod,
          paymentStatus: "pending",
          status: "processing",
          subtotal,
          shippingFee,
          total: subtotal + shippingFee,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
        };
        setShopOrders((orders) => [order, ...orders.filter((item) => item.orderNumber !== orderNumber)]);
        return order;
      },
      updateShopOrderPayment: (orderNumber, paymentStatus, providerReference) => {
        setShopOrders((orders) =>
          orders.map((order) => {
            if (order.orderNumber !== orderNumber) return order;
            const status: OrderStatus =
              paymentStatus === "paid"
                ? "paid"
                : paymentStatus === "cancelled"
                  ? "cancelled"
                  : order.status;
            return {
              ...order,
              paymentStatus,
              status,
              providerReference: providerReference || order.providerReference,
              updatedAt: new Date().toISOString(),
            };
          }),
        );
      },
      updateShopOrderStatus: (orderNumber, status) => {
        setShopOrders((orders) =>
          orders.map((order) =>
            order.orderNumber === orderNumber
              ? {
                  ...order,
                  status,
                  paymentStatus: status === "paid" && order.paymentStatus === "pending" ? "paid" : order.paymentStatus,
                  updatedAt: new Date().toISOString(),
                }
              : order,
          ),
        );
        notify(`訂單 ${orderNumber} 狀態已更新`);
      },
      notify,
    }),
    [
      session,
      businessFavorites,
      productFavorites,
      needFavorites,
      followedBusinesses,
      inquiryCart,
      proposals,
      notificationsRead,
      siteSettings,
      membershipPlan,
      shopProducts,
      shopCart,
      shopOrders,
      setSession,
      setBusinessFavorites,
      setProductFavorites,
      setNeedFavorites,
      setFollowedBusinesses,
      setInquiryCart,
      setProposals,
      setNotificationsRead,
      setSiteSettings,
      setMembershipPlan,
      setShopProducts,
      setShopCart,
      setShopOrders,
      notify,
    ],
  );

  return (
    <AppStoreContext.Provider value={value}>
      {children}
      <div className="toast-stack" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className={`toast toast-${toast.tone}`}>
            <span className="toast-dot" />
            {toast.message}
          </div>
        ))}
      </div>
    </AppStoreContext.Provider>
  );
}

export function useAppStore() {
  const store = useContext(AppStoreContext);
  if (!store) throw new Error("useAppStore must be used inside AppStoreProvider");
  return store;
}
