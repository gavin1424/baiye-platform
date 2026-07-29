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

type Role = "guest" | "business" | "admin";

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
      setSession,
      setBusinessFavorites,
      setProductFavorites,
      setNeedFavorites,
      setFollowedBusinesses,
      setInquiryCart,
      setProposals,
      setNotificationsRead,
      setSiteSettings,
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
