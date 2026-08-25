# 創百業智慧鏈正式上架版 V2 稽核

- 稽核日期：2026-08-25（Asia/Taipei）
- 稽核基準：`main` / `d6b7a1b32d8753e67b962fe931227e1169f816a2`
- 正式網址：<https://baiyeconnect.com/>
- 原則：本文件只盤點，不修改 Production、Worker、D1、R2、LINE Webhook 或 DNS。

## A. 已可正式保留

| 功能 | 程式證據 | 判定 |
|---|---|---|
| React/Vite/HashRouter 前端與 RWD Design System | `src/App.tsx`, `src/styles.css`, `vite.config.mjs` | 保留並漸進改善 |
| 公開品牌、商家搜尋、分類、方案、承攬制度頁 | `src/pages/HomePage.tsx`, `BusinessPages.tsx`, `CommercialV13Pages.tsx`, `PartnerPages.tsx` | 可保留內容與路由 |
| Cloudflare Worker、D1、R2 綁定架構 | `cloudflare-worker/src`, `cloudflare-worker/migrations`, `cloudflare-worker/wrangler.jsonc` | 保留；正式憑證不得進 Git |
| 承攬夥伴後端、邀請、密碼 Hash、契約簽署、Audit、R2 PDF | `cloudflare-worker/src/partner.js`, migrations `0002`–`0006` | 核心可保留，需完成整體資安驗收 |
| 財務帳本後端與稽核 | `cloudflare-worker/src/finance.js` | 核心可保留，前端登入方式需強化 |
| 多商家預約 schema、API、提醒與 Audit | `cloudflare-worker/src/booking.js`, migration `0008_merchant_booking_engine.sql` | 核心可保留，Admin UI 尚需通用化 |
| LINE / AI 配額、去重、Rate Limit 與固定回覆 | `cloudflare-worker/src/index.js`, `meiling-ai.js`, migrations `0007` | 保留；需補完整營運監控與回歸測試 |

## B. 需要改善

| Priority | 項目 | 現況 / 下一步 |
|---|---|---|
| P1 | 首頁商業定位與轉換漏斗 | 聚焦 NT$18,000 方案、商家加入、LINE/AI/預約成果與明確 CTA。 |
| P1 | 商家 onboarding | 將資料蒐集、方案權益、付款、開通、網站交付與驗收串成可追蹤流程。 |
| P1 | Booking Admin 通用化 | `src/pages/AdminBookings.tsx` 目前固定 `meiling_patchwork`，改由後端 session/權限決定 merchant scope。 |
| P1 | 手機管理體驗 | 財務、預約、承攬表格與簽名區做真機回歸。 |
| P1 | SEO | 逐頁 canonical/OG/Schema/sitemap，管理與登入頁 noindex。 |
| P2 | 儀表板資訊架構 | 依真實 API 統一狀態、空狀態與錯誤狀態。 |

## C. 仍是 Mock

| Priority | 項目 | 程式證據 |
|---|---|---|
| P0 | 一般會員、商家、平台管理員登入 | `src/store.tsx` 以 LocalStorage 與前端帳密判斷角色。 |
| P0 | 公開測試帳號與快速填入 | `src/pages/AuthPages.tsx` 含 `demo@baiye.local`, `admin@baiye.local`, `Demo1234`, `Admin1234`。 |
| P0 | Admin KPI、審核清單與部分管理操作 | `src/pages/AdminPage.tsx` 為固定陣列與前端狀態。 |
| P0 | 商家 Dashboard 指標與部分商家功能 | `src/pages/DashboardPages.tsx` 使用示範資料。 |
| P0 | 商城結帳、付款與訂單 | `src/payment-client.ts` 可回傳 `LOCAL-TEST-*`；`ShopPages.tsx` 明示測試結帳。 |
| P0 | 合作需求與部分內容異動 | `src/pages/CollaborationPages.tsx` 寫入 LocalStorage。 |
| P1 | 公開商家、商品、合作資料 | `src/data.ts` 及頁面靜態資料，尚非正式多租戶內容 API。 |

## D. 有安全風險

| Priority | 風險 | 必要處理 |
|---|---|---|
| P0 | `AdminRoute`、`MerchantRoute` 信任前端 LocalStorage role | 改為 Server-side session + 每次 API authorization；前端 guard 只做 UX。 |
| P0 | 公開硬編碼 Admin/商家測試帳密 | Production build 移除測試帳號、密碼、快速登入與對應判斷。 |
| P0 | 財務/預約/承攬 Admin token 放 `sessionStorage` | 改為 Secure、HttpOnly、SameSite Cookie 或等效安全 session，搭配 CSRF。 |
| P0 | 尚未完成全 API RBAC / tenant isolation 證據 | 建立 guest/member/business/admin/partner 權限矩陣與跨商家負向測試。 |
| P0 | Production 安全基線尚未形成可重跑 Gate | 補 CORS allowlist、CSRF、rate limit、登入鎖定、session expiry、headers、secret scan、dependency scan。 |
| P1 | 前端錯誤與個資 Log 尚未集中稽核 | 建立 request id、敏感欄位遮罩、保留期限與告警。 |

## E. 尚未串接

| Priority | 項目 | 缺口 |
|---|---|---|
| P0 | 正式會員 / 商家 / Admin 身分服務 | 缺正式 user DB、password reset、email verification、server session 與 RBAC。 |
| P0 | 正式商城訂單與每商家金流 | 目前為測試付款；需正式 provider credential、webhook 驗簽、冪等、退款與對帳。 |
| P0 | 正式商家資料與平台管理 API | 多數公開商家與 Admin 內容仍為靜態/Mock。 |
| P1 | 通用 Booking merchant context | 後台前端仍固定單一 merchant；需由 session 推導，禁止信任 query merchant_id。 |
| P1 | 統一通知中心 | LINE、Email、站內通知需事件化、重試、去重與稽核。 |
| P2 | GA4 / Search Console 正式營運 SOP | 上線後依同意與隱私規則啟用。 |

## F. 上架前必須完成（P0，共 12 項）

1. 建立正式 users/admins/merchant_users 資料與 migration，保存必要身分且可回滾。
2. 將會員、商家、平台管理員登入改為 Server-side session；密碼採合格雜湊。
3. 從 Production 移除所有硬編碼測試帳密、快速登入按鈕與測試登入文案。
4. 以後端 RBAC 保護 `/admin`、商家後台及所有對應 API；前端 role 不得成為授權依據。
5. 完成 Multi-Tenant 負向測試：A 商家不得讀、改、核銷或列舉 B 商家資料。
6. 將 Admin 固定 KPI、審核資料與操作改接正式 API/Audit；未串接項目不得顯示假數字。
7. 將商家 Dashboard 與商家資料異動從 Mock/LocalStorage 搬到正式 tenant-scoped DB/API。
8. 將商城訂單、付款、退款、Webhook、冪等與對帳改為正式模式；隔離測試付款。
9. 建立 Production CSRF、CORS、secure cookie、session expiry、登入限速/鎖定與 HTTP headers Gate。
10. 完成 D1/R2 備份、還原演練、監控、告警與部署 rollback 證據。
11. 完成 Desktop、Android、iPhone/Safari、LINE 內瀏覽器與核心角色 E2E，包含負向權限與失敗流程。
12. 完成正式資料/個資清冊、隱私告知、Log 遮罩、保留政策與上線前安全稽核簽核。

## G. 上架後可逐步完成

| Priority | 項目 |
|---|---|
| P1 | AI 行銷內容工作流、每商家用量視覺化、可觀測性與成本告警。 |
| P1 | LINE Login/LIFF 更完整的會員與預約體驗。 |
| P1 | Merchant onboarding 自動化、文件缺件追蹤與交付驗收。 |
| P2 | 進階報表、跨店導流、推薦活動與自動行銷。 |
| P2 | 自訂網域、自助 SEO 與進階版型管理。 |

## 分支與上線 Gate

- `demo-snapshot-2026-08-25`：只作展示站來源，不合併後續 V2 改動。
- `official-production-v2`：正式上架版改良分支。
- `main` / `baiyeconnect.com`：V2 的 12 個 P0 與正式 QA 未完成前保持現況。
- V2 只有在 P0 全數完成、Build/Test/E2E/安全驗收通過後，才可由非 force merge 發布。
