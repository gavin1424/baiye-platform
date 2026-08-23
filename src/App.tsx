import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAppStore } from "./store";
import { HomePage } from "./pages/HomePage";
import {
  BusinessPage,
  BusinessesPage,
  CategoriesPage,
  CategoryDetailPage,
} from "./pages/BusinessPages";
import {
  CollaborationDetailPage,
  CollaborationsPage,
  NewCollaborationPage,
} from "./pages/CollaborationPages";
import {
  InquiryCartPage,
  MarketplacePage,
  ProductDetailPage,
} from "./pages/MarketplacePages";
import {
  CheckoutPage,
  PaymentResultPage,
  ShopCartPage,
  ShopHomePage,
  ShopProductPage,
} from "./pages/ShopPages";
import { ForgotPasswordPage, LoginPage, MemberAccountPage, RegisterPage } from "./pages/AuthPages";
import {
  CollaborationManagementPage,
  DashboardOverviewPage,
  GenericDashboardPage,
  MessagesPage,
  NotificationsPage,
  ProductManagementPage,
  SiteEditorPage,
} from "./pages/DashboardPages";
import { AdminPage } from "./pages/AdminPage";
import { AdminFinancePage } from "./pages/AdminFinance";
import { AdminPartners, PartnerActivate, PartnerApply, PartnerContract, PartnerDashboard, PartnerLanding, PartnerLogin, PartnerReferralJoin } from "./pages/PartnerPages";
import { AiChatWidget } from "./components/AiChatWidget";
import { DemoSitesPage, IndustryDemoSitePage } from "./pages/IndustryDemoSites";
import {
  AboutPage,
  ContactPage,
  FaqPage,
  HowItWorksPage,
  NotFoundPage,
  PricingPage,
  PrivacyPage,
  ReportPage,
  SuccessStoriesPage,
  TermsPage,
} from "./pages/StaticPages";

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
  "/pricing": "方案與價格｜創百業智慧鏈",
  "/demo-sites": "五大產業示範網站｜創百業智慧鏈",
  "/about": "關於平台｜創百業智慧鏈",
  "/how-it-works": "如何運作｜創百業智慧鏈",
  "/success-stories": "成功合作案例｜創百業智慧鏈",
  "/faq": "常見問題｜創百業智慧鏈",
  "/contact": "聯絡我們｜創百業智慧鏈",
  "/privacy": "隱私權政策｜創百業智慧鏈",
  "/terms": "使用條款｜創百業智慧鏈",
  "/report": "檢舉內容｜創百業智慧鏈",
  "/admin": "平台管理員後台｜創百業智慧鏈",
  "/admin/finance": "財務管理｜創百業智慧鏈",
  "/partner": "夥伴中心｜創百業智慧鏈",
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
      "創百業智慧鏈整合 AI 智慧網站、LINE 預約、會員 CRM、數位行銷與商家營運工具，協助各行各業快速完成數位升級。";
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
      notify("商家上架功能需完成 NT$18,000 一次性商家上架註冊。", "warning");
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
  const { session } = useAppStore();
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
        <Route path="/categories" element={<CategoriesPage />} />
        <Route path="/categories/:category" element={<CategoryDetailPage />} />
        <Route path="/businesses" element={<BusinessesPage />} />
        <Route path="/search" element={<BusinessesPage searchTitle />} />
        <Route path="/business/:slug" element={<BusinessPage />} />
        <Route path="/demo-sites" element={<DemoSitesPage />} />
        <Route path="/demo-sites/:slug" element={<IndustryDemoSitePage />} />
        <Route path="/collaborations" element={<CollaborationsPage />} />
        <Route
          path="/collaborations/new"
          element={
            <MerchantRoute>
              <NewCollaborationPage />
            </MerchantRoute>
          }
        />
        <Route path="/collaborations/:id" element={<CollaborationDetailPage />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/marketplace/:slug" element={<ProductDetailPage />} />
        <Route
          path="/inquiry-cart"
          element={
            <MerchantRoute>
              <InquiryCartPage />
            </MerchantRoute>
          }
        />
        <Route path="/shop" element={<ShopHomePage />} />
        <Route path="/shop/:slug" element={<ShopProductPage />} />
        <Route path="/cart" element={<ShopCartPage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/payment/:result" element={<PaymentResultPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route
          path="/account"
          element={
            <MemberRoute>
              <MemberAccountPage />
            </MemberRoute>
          }
        />
        <Route
          path="/dashboard"
          element={
            <MerchantRoute>
              <DashboardOverviewPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/dashboard/site-editor"
          element={
            <MerchantRoute>
              <SiteEditorPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/dashboard/products"
          element={
            <MerchantRoute>
              <ProductManagementPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/dashboard/collaborations"
          element={
            <MerchantRoute>
              <CollaborationManagementPage />
            </MerchantRoute>
          }
        />
        {[
          "profile",
          "portfolio",
          "received-proposals",
          "my-proposals",
          "inquiries",
          "quotes",
          "orders",
          "favorites",
          "reviews",
          "analytics",
          "plans",
          "settings",
        ].map((section) => (
          <Route
            key={section}
            path={`/dashboard/${section}`}
            element={
              <MerchantRoute>
                <GenericDashboardPage section={section} />
              </MerchantRoute>
            }
          />
        ))}
        <Route
          path="/messages"
          element={
            <MerchantRoute>
              <MessagesPage />
            </MerchantRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <MerchantRoute>
              <NotificationsPage />
            </MerchantRoute>
          }
        />
        <Route path="/pricing" element={<PricingPage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/how-it-works" element={<HowItWorksPage />} />
        <Route path="/success-stories" element={<SuccessStoriesPage />} />
        <Route path="/faq" element={<FaqPage />} />
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/report" element={<ReportPage />} />
        <Route path="/partner" element={<PartnerLanding />} />
        <Route path="/partner/apply" element={<PartnerApply />} />
        <Route path="/partner/activate" element={<PartnerActivate />} />
        <Route path="/partner/login" element={<PartnerLogin />} />
        <Route path="/partner/contract" element={<PartnerContract />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/partner/commissions" element={<PartnerDashboard />} />
        <Route path="/join" element={<PartnerReferralJoin />} />
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route
          path="/admin/finance"
          element={
            <AdminRoute>
              <AdminFinancePage />
            </AdminRoute>
          }
        />
        <Route path="/admin/partners" element={<AdminRoute><AdminPartners /></AdminRoute>} />
        <Route path="/not-found-demo" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <AiChatWidget />
    </>
  );
}
