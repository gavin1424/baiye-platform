import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useAppStore } from "./store";
import { HomePage } from "./pages/HomePage";
import { LoginPage } from "./pages/AuthPages";
import { AdminFinancePage } from "./pages/AdminFinance";
import { AdminBookings } from "./pages/AdminBookings";
import { AdminPartners, PartnerActivate, PartnerApply, PartnerContract, PartnerContractPdfViewer, PartnerDashboard, PartnerLanding, PartnerLogin, PartnerReferralJoin } from "./pages/PartnerPages";
import { AiChatWidget } from "./components/AiChatWidget";
import { FaqPageV13, HowItWorksPageV13, PricingPageV13, TermsPageV13 } from "./pages/CommercialV13Pages";
import { AccountUnavailablePage, CatalogUnavailablePage, EmptyCollaborationPage, MerchantAccessUnavailablePage, ProductionContactPage, ProductionNotFoundPage, ProductionPrivacyPage, VerifiedBusinessesPage } from "./pages/ProductionPublicPages";
import { ProductionAdminOverview } from "./pages/ProductionAdminOverview";
import { DepositSettlementPage, MerchantSettlementsUnavailablePage } from "./pages/DepositSettlementPage";
import { PosComparisonPage } from "./pages/PosComparisonPage";
import { FeaturesPage } from "./pages/FeaturesPage";
import { QrOrderingPage } from "./pages/QrOrderingPage";
import { AdminQrOrderingPage } from "./pages/AdminQrOrderingPage";
import { MerchantOrderingPage } from "./pages/MerchantOrderingPage";
import { AdminFinancingPage, BusinessFinancingPage, MemberBenefitsPage } from "./pages/GrowthIntegrationPages";
import { BeefNoodleDemoPage } from "./pages/BeefNoodleDemoPage";
import { MerchantContractActivate, MerchantContractPage, MerchantContractsPage, VerifyContractPage } from "./pages/MerchantContractPages";
import { MerchantLoginPage, MerchantPortalPage, MerchantRegisterPage } from "./pages/MerchantAccessPages";
import { AdminContractsPage } from "./pages/AdminContractsPage";
import { PlatformMemberCenterPage, PlatformMemberJoinPage, PlatformMemberWelcomePage } from "./pages/PlatformMemberPages";
import { MemberLoginCompatibility, MerchantQrCodesCompatibility, QrMembershipJoinCompatibility } from "./pages/QrMembershipCompatibilityPages";

const IS_BEEF_NOODLE_DEMO = import.meta.env.VITE_APP_VARIANT === "beef-noodle-demo";
const IS_STAGING = import.meta.env.VITE_APP_MODE === "staging";

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
  "/features": "全部功能總覽｜創百業智慧鏈",
  "/pos-comparison": "Web-POS 效益與成本比較｜創百業智慧鏈",
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
  "/admin/ordering": "掃碼會員與手機點餐｜創百業智慧鏈",
  "/merchant-admin/ordering": "商家 QR 點餐管理｜創百業智慧鏈",
  "/member-benefits": "會員回購｜創百業智慧鏈",
  "/member/login": "手機會員登入｜創百業智慧鏈",
  "/dashboard/qr-codes": "商家 QR 管理｜創百業智慧鏈",
  "/business-financing": "商家融資合作專區｜創百業智慧鏈",
  "/admin/financing": "商家融資合作管理｜創百業智慧鏈",
  "/services/deposit-settlement": "訂金代收與月結對帳服務｜創百業智慧鏈",
  "/merchant/settlements": "商家月結對帳｜創百業智慧鏈",
  "/partner": "加入創百業智慧鏈",
  "/partner/apply": "承攬夥伴合作申請｜創百業智慧鏈",
  "/partner/activate": "啟用承攬夥伴帳號｜創百業智慧鏈",
  "/partner/login": "承攬夥伴登入｜創百業智慧鏈",
  "/partner/dashboard": "承攬夥伴儀表板｜創百業智慧鏈",
  "/partner/contract": "線上承攬夥伴合作契約｜創百業智慧鏈",
  "/admin/partners": "承攬夥伴管理｜創百業智慧鏈",
  "/admin/contracts": "契約管理｜創百業智慧鏈",
  "/merchant/register": "商家註冊｜創百業智慧鏈",
  "/merchant/login": "商家登入｜創百業智慧鏈",
  "/merchant/activate": "商家註冊｜創百業智慧鏈",
  "/merchant": "商家中心｜創百業智慧鏈",
  "/merchant/contract": "商家平台服務契約｜創百業智慧鏈",
  "/merchant/contracts": "我的商家服務契約｜創百業智慧鏈",
  "/member/join": "手機一鍵加入會員｜創百業智慧鏈",
  "/member/welcome": "歡迎成為創百業會員｜創百業智慧鏈",
  "/member": "我的會員｜創百業智慧鏈",
};

function ScrollAndMetadata() {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
    const path = location.pathname;
    const title =
      PAGE_TITLES[path] ||
      (path.startsWith("/partner/contracts/") && path.endsWith("/view")
        ? "查看已簽承攬夥伴契約｜創百業智慧鏈"
        : path.startsWith("/q/")
        ? "掃碼加入會員與手機點餐｜創百業智慧鏈"
        : path.startsWith("/verify-contract/")
          ? "契約文件驗證｜創百業智慧鏈"
        : path.startsWith("/business/")
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
    const demoTitle = path.startsWith("/q/")
      ? "百工牛肉麵手機點餐｜創百業智慧鏈 QR 點餐示範"
      : "QR 手機點餐示範｜百工牛肉麵｜創百業智慧鏈";
    const activeTitle = IS_BEEF_NOODLE_DEMO ? demoTitle : title;
    document.title = activeTitle;
    const description = IS_BEEF_NOODLE_DEMO
      ? "體驗創百業智慧鏈 QR 手機點餐：掃碼加入會員、查看菜單、選擇加料、桌邊送單與即時訂單狀態。"
      : "創百業智慧鏈提供 AI 行銷推廣、平台上架與商家數位營運服務，現階段推廣促銷價 NT$18,000，標準規格網站基礎建置免費附贈。";
    document.querySelector('meta[name="description"]')?.setAttribute("content", description);
    document.querySelector('meta[name="robots"]')?.setAttribute("content", IS_BEEF_NOODLE_DEMO || IS_STAGING ? "noindex,nofollow" : "index,follow");
    document.querySelector('meta[property="og:title"]')?.setAttribute("content", activeTitle);
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
  if (!authReady) return <Navigate to="/login" replace />;
  if (session.role === "guest") return <Navigate to="/login" replace />;
  if (session.role === "member") return <Navigate to="/pricing" replace />;
  if (session.role === "business") return <Navigate to="/dashboard" replace />;
  return children;
}

function ContextualAiChatWidget() {
  const location = useLocation();
  if (location.pathname.startsWith("/q/")) return null;
  return <AiChatWidget />;
}

export function App() {
  if (IS_BEEF_NOODLE_DEMO) {
    return (
      <>
        <ScrollAndMetadata />
        <div className="beef-demo-env-banner" role="status">
          創百業智慧鏈 QR 點餐示範店｜此為功能展示環境，非實際營業店家
        </div>
        <Routes>
          <Route path="/" element={<BeefNoodleDemoPage />} />
          <Route path="/q/:code" element={<QrOrderingPage />} />
          <Route path="/merchant-admin/ordering" element={<MerchantOrderingPage />} />
          <Route path="/privacy" element={<ProductionPrivacyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </>
    );
  }

  return (
    <>
      <ScrollAndMetadata />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/q/:code" element={<QrOrderingPage />} />
        <Route path="/merchant-admin/ordering" element={<MerchantOrderingPage />} />
        <Route path="/member-benefits" element={<MemberBenefitsPage />} />
        <Route path="/member/join" element={<PlatformMemberJoinPage />} />
        <Route path="/member/welcome" element={<PlatformMemberWelcomePage />} />
        <Route path="/member" element={<PlatformMemberCenterPage />} />
        <Route path="/member/login" element={<MemberLoginCompatibility />} />
        <Route path="/join/:merchantSlug" element={<QrMembershipJoinCompatibility />} />
        <Route path="/dashboard/qr-codes" element={<MerchantQrCodesCompatibility />} />
        <Route path="/business-financing" element={<BusinessFinancingPage />} />
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
        <Route path="/features" element={<FeaturesPage />} />
        <Route path="/pos-comparison" element={<PosComparisonPage />} />
        <Route path="/services/deposit-settlement" element={<DepositSettlementPage />} />
        <Route path="/merchant/settlements" element={<MerchantSettlementsUnavailablePage />} />
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
        <Route path="/partner/contracts/:signatureId/view" element={<PartnerContractPdfViewer />} />
        <Route path="/partner/dashboard" element={<PartnerDashboard />} />
        <Route path="/partner/commissions" element={<PartnerDashboard />} />
        <Route path="/merchant/activate" element={<MerchantContractActivate />} />
        <Route path="/merchant/register" element={<MerchantRegisterPage />} />
        <Route path="/merchant/login" element={<MerchantLoginPage />} />
        <Route path="/merchant" element={<MerchantPortalPage />} />
        <Route path="/merchant/contract" element={<MerchantContractPage />} />
        <Route path="/merchant/contracts" element={<MerchantContractsPage />} />
        <Route path="/verify-contract/:publicId" element={<VerifyContractPage />} />
        <Route path="/join" element={<PartnerReferralJoin />} />
        <Route path="/admin" element={<AdminRoute><ProductionAdminOverview /></AdminRoute>} />
        <Route path="/admin/finance" element={<AdminRoute><AdminFinancePage /></AdminRoute>} />
        <Route path="/admin/bookings" element={<AdminRoute><AdminBookings /></AdminRoute>} />
        <Route path="/admin/ordering" element={<AdminRoute><AdminQrOrderingPage /></AdminRoute>} />
        <Route path="/admin/financing" element={<AdminRoute><AdminFinancingPage /></AdminRoute>} />
        <Route path="/admin/partners" element={<AdminRoute><AdminPartners /></AdminRoute>} />
        <Route path="/admin/contracts" element={<AdminRoute><AdminContractsPage /></AdminRoute>} />
        <Route path="*" element={<ProductionNotFoundPage />} />
      </Routes>
      <ContextualAiChatWidget />
    </>
  );
}
