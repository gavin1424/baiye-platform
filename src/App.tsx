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

const titles: Record<string, string> = {
  "/": "百業共創｜百工百業合作平台",
  "/categories": "百工百業分類｜百業共創",
  "/businesses": "找服務、找商家｜百業共創",
  "/search": "商家搜尋結果｜百業共創",
  "/collaborations": "合作需求廣場｜百業共創",
  "/collaborations/new": "發布合作需求｜百業共創",
  "/marketplace": "商品與服務市集｜百業共創",
  "/inquiry-cart": "企業詢價單｜百業共創",
  "/shop": "百業商城｜百業共創",
  "/cart": "購物車｜百業共創",
  "/checkout": "測試結帳｜百業共創",
  "/login": "會員登入｜百業共創",
  "/register": "會員註冊｜百業共創",
  "/forgot-password": "忘記密碼｜百業共創",
  "/account": "免費會員帳號｜百業共創",
  "/dashboard": "商家後台總覽｜百業共創",
  "/dashboard/site-editor": "我的網站編輯器｜百業共創",
  "/dashboard/products": "商品與服務管理｜百業共創",
  "/dashboard/collaborations": "合作需求管理｜百業共創",
  "/messages": "私訊中心｜百業共創",
  "/notifications": "通知中心｜百業共創",
  "/pricing": "方案與價格｜百業共創",
  "/about": "關於平台｜百業共創",
  "/how-it-works": "如何運作｜百業共創",
  "/success-stories": "成功合作案例｜百業共創",
  "/faq": "常見問題｜百業共創",
  "/contact": "聯絡我們｜百業共創",
  "/privacy": "隱私權政策｜百業共創",
  "/terms": "使用條款｜百業共創",
  "/report": "檢舉內容｜百業共創",
  "/admin": "平台管理員後台｜百業共創",
};

function ScrollAndMetadata() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const path = location.pathname;
    const title =
      titles[path] ||
      (path.startsWith("/business/")
        ? "商家專屬網站｜百業共創"
        : path.startsWith("/collaborations/")
          ? "合作需求詳情｜百業共創"
          : path.startsWith("/marketplace/")
            ? "商品服務詳情｜百業共創"
            : path.startsWith("/shop/")
              ? "商城商品詳情｜百業共創"
              : path.startsWith("/payment/")
                ? "付款結果｜百業共創"
            : path.startsWith("/categories/")
              ? "行業分類｜百業共創"
              : path.startsWith("/dashboard/")
                ? "商家後台｜百業共創"
                : "找不到頁面｜百業共創");
    document.title = title;
    const description =
      "建立自己的商家網站、展示服務與作品，找到客戶、供應商與跨業合作夥伴。";
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
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          }
        />
        <Route path="/not-found-demo" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
