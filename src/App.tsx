import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAppStore } from "./store";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/AuthPages";
import { AdminFinancePage } from "./pages/AdminFinance";
import { AdminBookings } from "./pages/AdminBookings";
import { AdminPartners, PartnerActivate, PartnerApply, PartnerContract, PartnerDashboard, PartnerLanding, PartnerLogin, PartnerReferralJoin } from "./pages/PartnerPages";
import { AiChatWidget } from "./components/AiChatWidget";
import { FaqPageV13, HowItWorksPageV13, PricingPageV13, TermsPageV13 } from "./pages/CommercialV13Pages";
import { AccountUnavailablePage, CatalogUnavailablePage, EmptyCollaborationPage, MerchantAccessUnavailablePage, ProductionContactPage, ProductionNotFoundPage, ProductionPrivacyPage, VerifiedBusinessesPage } from "./pages/ProductionPublicPages";
import { ProductionAdminOverview } from "./pages/ProductionAdminOverview";

const PLATFORM_BRAND = "創百業智慧鏈";
const PAGE_TITLES: Record<string, string> = {
  "/": `${PLATFORM_BRAND}｜AI 智慧網站與百業數位升級平台`,
  "/categories": "行業分類｜創百業智慧鏈",
  "/businesses": "找服務、找商家｜創百業智慧鏈",
  "/search": "商家搜尋結果｜創百業智慧鏈",
  "/collaborations": "合作需求廣場｜創百業智慧鏈",
  "/collaborations/new": "發布合作需求｜創百業智慧鏈",
  "/marketplace": "商品與服務市集｜創百業智慧鏈",
  "/inquiry-cart": "企業詢價單｜創百業智慧鏈",
  "/shop": "百業商城｜創百業智慧鏈",
  "/cart": "購物車｜創百業智慧鏈",
  "/checkout": "測試結帳｜創百業智慧鏈",
  "/login": "會員登入｜創百業智慧鏈",
  "/register": "會員註冊｜創百業智慧鏈",
  "/forgot-password": "忘記密碼｜創百業智慧鏈",
  "/account": "免費會員帳號｜創百業智慧鏈",
  "/dashboard": "商家後台總覽｜創百業智慧鏈",
  "/dashboard/site-editor": "我的網站編輯器｜創百業智慧鏈",
  "/dashboard/products": "商品與服務管理｜創百業智慧鏈",
  "/dashboard/collaborations": "合作需求管理｜創百業智慧鏈",
  "/messages": "私訊中心｜創百業智慧鏈",
  "/notifications": "通知中心｜創百業智慧鏈",
  "/pricing": "AI 行銷推廣方案｜創百業智慧鏈",
  "/demo-sites": "五大產業示範網站｜創百業智慧鏈",
  "/about": "關於平台｜創百業智慧鏈",
  "/how-it-works": "AI 行銷推廣如何運作｜創百業智慧鏈",
  "/success-stories": "成功合作案例｜創百業智慧鏈",
  "/faq": "方案常見問題｜創百業智慧鏈",
  "/contact": "聯絡我們｜創百業智慧鏈",
  "/privacy": "隱私權政策｜創百業智慧鏈",
  "/terms": "使用條款｜創百業智慧鏈",
  "/report": "檢舉內容｜創百業智慧鏈",
  "/admin": "平台管理員後台｜創百業智慧鏈",
  "/admin/finance": "財務管理｜創百業智慧鏈",
  "/admin/bookings": "預約管理｜創百業智慧鏈",
  "/partner": "承攬夥伴中心｜創百業智慧鏈",
  "/partner/apply": "承攬夥伴合作申請｜創百業智慧鏈",
  "/partner/activate": "啟用承攬夥伴帳號｜創百業智慧鏈",
  "/partner/login": "承攬夥伴登入｜創百業智慧鏈",
  "/partner/dashboard": "承攬夥伴儀表板｜創百業智慧鏈",
  "/partner/contract": "線上承攬夥伴合作契約｜創百業智慧鏈",
  "/admin/partners": "承攬夥伴管理｜創百業智慧鏈",
};

function ScrollAndMetadata() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const path = location.pathname;
    const title =
      PAGE_TITLES[path] ||
      (path.startsWith("/business/")
        ? "商家專屬網站｜創百業智慧鏈"
        : path.startsWith("/demo-sites/")
          ? "產業示範網站｜創百業智慧鏈"
          : path.startsWith("/collaborations/")
            ? "合作需求詳情｜創百業智慧鏈"
            : path.startsWith("/marketplace/")
              ? "商品服務詳情｜創百業智慧鏈"
              : path.startsWith("/shop/")
                ? "商城商品詳情｜創百業智慧鏈"
                : path.startsWith("/payment/")
                  ? "付款結果｜創百業智慧鏈"
                  : path.startsWith("/categories/")
                    ? "行業分類｜創百業智慧鏈"
                    : path.startsWith("/dashboard/")
                      ? "商家後台｜創百業智慧鏈"
                      : "找不到頁面｜創百業智慧鏈");
    document.title = title;
    const description =
      "創百業智慧鏈提供 AI 行銷推廣、平台上架與商家數位營運服務，現階段推廣促銷價 NT$18,000，標準規格網站基礎建置免費附贈。";
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", title);
    document.querySelector('meta[property="og:description"]')?.setAttribute("content", description);
  }, [location.pathname]);

  return null;
}

function MerchantRoute({ children }: { children: ReactNode }) {
  const { session, notify } = useAppStore();
  const location = useLocation();

  useEffect(() => {
    if (session.role === "member") {
      notify("商家完整功能需完成 AI 行銷推廣方案；原價 NT$30,000，現階段推廣促銷價 NT$18,000，標準規格網站基礎建置免費附贈。", "warning");
    }
  }, [location.pathname, notify, session.role]);

  if (session.role === "guest") return <Navigate to="/login" replace />;
  if (session.role === "member") return <Navigate to="/pricing" replace />;
  return children;
}

function MemberRoute({ children }: { children: ReactNode }) {
  const { session } = useAppStore();
  if (session.role === "guest") return <Navigate to="/login" replace />;
  if (session.role === "business") return <Navigate to="/dashboard" replace />;
  if (session.role === "admin") return <Navigate to="/admin" replace />;
  return children;
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { session, authReady } = useAppStore();
  if (!authReady) return <main className="route-loading" aria-busy="true">正在驗證管理員權限…</main>;
  if (session.role === "guest") return <Navigate to="/login" replace />;
  if (session.role === "member") return <Navigate to="/pricing" replace />;
  if (session.role === "business") return <Navigate to="/dashboard" replace />;
  return children;
}

export function App() {
  return (
    <>
      <ScrollAndMetadata />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/categories" element={<VerifiedBusinessesPage />} />
        <Route path="/categories/:category" element={<VerifiedBusinessesPage />} />
        <Route path="/businesses" element={<VerifiedBusinessesPage />} />
        <Route path="/search" element={<VerifiedBusinessesPage />} />
        <Route path="/business/:slug" element={<VerifiedBusinessesPage />} />
        <Route path="/demo-sites" element={<Navigate to="/" replace />} />
        <Route path="/demo-sites/:slug" element={<Navigate to="/" replace />} />
        <Route path="/collaborations" element={<EmptyCollaborationPage />} />
        <Route path="/collaborations/new" element={<EmptyCollaborationPage />} />
        <Route path="/collaborations/:id" element={<EmptyCollaborationPage />} />
        <Route path="/marketplace" element={<CatalogUnavailablePage />} />
        <Route path="/marketplace/:slug" element={<CatalogUnavailablePage />} />
        <Route path="/inquiry-cart" element={<CatalogUnavailablePage />} />
        <Route path="/shop" element={<CatalogUnavailablePage />} />
        <Route path="/shop/:slug" element={<CatalogUnavailablePage />} />
        <Route path="/cart" element={<CatalogUnavailablePage />} />
        <Route path="/checkout" element={<CatalogUnavailablePage />} />
        <Route path="/payment/:result" element={<CatalogUnavailablePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<AccountUnavailablePage />} />
        <Route path="/forgot-password" element={<AccountUnavailablePage />} />
        <Route path="/account" element={<AccountUnavailablePage />} />
        <Route path="/dashboard" element={<MerchantAccessUnavailablePage />} />
        <Route path="/dashboard/site-editor" element={<MerchantAccessUnavailablePage />} />
        <Route path="/dashboard/products" element={<MerchantAccessUnavailablePage />} />
        <Route path="/dashboard/collaborations" element={<MerchantAccessUnavailablePage />} />
        {["profile","portfolio","received-proposals","my-proposals","inquiries","quotes","orders","favorites","reviews","analytics","plans","settings"].map((section) => (
          <Route key={section} path={`/dashboard/${section}`} element={<MerchantAccessUnavailablePage />} />
        ))}
        <Route path="/messages" element={<MerchantAccessUnavailablePage />} />
        <Route path="/notifications" element={<MerchantAccessUnavailablePage />} />
        <Route path="/pricing" element={<PricingPageV13 />} />
        <Route path="/about" element={<Navigate to="/" replace />} />
        <Route path="/how-it-works" element={<HowItWorksPageV13 />} />
        <Route path="/success-stories" element={<VerifiedBusinessesPage />} />
        <Route path="/faq" element={<FaqPageV13 />} />
        <Route path="/contact" element={<ProductionContactPage />} />
        <Route path="/privacy" element={<ProductionPrivacyPage />} />
        <Route path="/terms" element={<TermsPageV13 />} />
        <Route path="/report" element={<ProductionContactPage />} />
        <Route path="/partner" element={<PartnerLanding />} />
        <Route path="/partner/apply" element={<PartnerApply />} />
        <Route path="/partner/activate" element={<PartnerActivate />} />
        <Route path="/partner/login" element={<PartnerLogin />} />
        <Route path="/partner/contract" element={<PartnerContract />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/partner/commissions" element={<PartnerDashboard />} />
        <Route path="/join" element={<PartnerReferralJoin />} />
        <Route path="/admin" element={<AdminRoute><ProductionAdminOverview /></AdminRoute>} />
        <Route path="/admin/finance" element={<AdminRoute><AdminFinancePage /></AdminRoute>} />
        <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
        <Route path="/admin/partners" element={<AdminRoute><AdminPartners /></AdminRoute>} />
        <Route path="*" element={<ProductionNotFoundPage />} />
      </Routes>
      <AiChatWidget />
    </>
  );
}
