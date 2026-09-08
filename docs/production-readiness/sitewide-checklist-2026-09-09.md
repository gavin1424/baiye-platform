# 創百業智慧鏈｜全站對外正式上線內部驗收紀錄

日期：2026-09-09（Asia/Taipei）  
Production 基準：`4f22b83f1491e4e964a5f981739f729ae83f12b9`  
範圍：`src/App.tsx` 中 100 個唯一 route、共用導覽／Footer／AI 客服，以及 Worker 對外 API。

> 本檔只存在原始碼倉庫，不會由 Vite 複製到公開網站。

## 頁面與使用者狀態檢查表

| 群組 | Routes／入口 | 使用者狀態 | 問題 | 修改後 | 證據 |
|---|---|---|---|---|---|
| 公開主站 | `/`, `/features`, `/pricing`, `/join`, `/how-it-works`, `/faq`, `/contact`, `/privacy`, `/terms`, `/pos-comparison`, `/services/deposit-settlement` | 未登入 | 技術環境、Gate、Provider、內部引擎用語；部分文字對比不足 | 改為客戶可理解的繁中狀態與服務條件；首頁／卡片／CTA 對比加強 | `src/pages/FeaturesPage.tsx`, `src/pages/CommercialV13Pages.tsx`, `src/styles.css`, 瀏覽器截圖 |
| 公開目錄與搜尋 | `/categories`, `/categories/:category`, `/businesses`, `/search`, `/business/:slug`, `/success-stories` | 未登入 | 空資料曾顯示 Production 技術說明 | 改為一般空資料訊息；維持真實商家資料來源 | `src/store.tsx`, `src/pages/VerifiedBusinessesPage.tsx` |
| 公開加入與帳戶 | `/merchant/register`, `/merchant/login`, `/member/join`, `/member/login`, `/partner/apply`, `/partner/activate`, `/partner/login`, `/merchant/activate` | 未登入／轉換帳號 | 原始 API error、舊邀請免密碼、工程名詞 | 共用繁中錯誤映射；手機＋8 位數字密碼；安全雜湊與通用錯誤 | `src/user-facing-error.ts`, `src/pages/MerchantContractPages.tsx`, `cloudflare-worker/tests/merchant-phone-auth.test.mjs` |
| 商家方案 | `/merchant/select-plan`, `/merchant/contract`, `/merchant/contracts`, `/merchant/content-change`, `/merchant/addons` | 新商家／已有方案／歷史契約 | 歷史簽署即永久鎖定；變更方案只有說明；公開 API 洩漏內部欄位 | 依有效期與狀態判斷；建立人工受理且可追蹤、冪等、不覆寫原方案的申請；價格由 D1 決定 | `cloudflare-worker/src/merchant-plan-catalog.js`, `0034_merchant_plan_change_requests.sql`, `unified-registration-contract-center.test.mjs` |
| 商家後台 | `/merchant`, `/merchant/dashboard`, `/merchant/inventory`, `/merchant/bookings`, `/merchant/members`, `/merchant/profile`, `/merchant/line`, `/merchant/account`, `/merchant/google-maps-booking`, `/merchant/payments`, `/merchant/invoice`, `/merchant/settlements` | 已登入商家 | Session／Provider／假資料等工程字樣、原始錯誤 | 改為登入裝置、服務申請與可執行下一步；錯誤採繁中安全映射 | `src/pages/MerchantAdminPages.tsx`, `src/pages/GoogleMapsBookingPages.tsx` |
| 點餐與預約 | `/q/:code`, `/scan`, `/join/:merchantSlug`, `/booking/:token`, `/booking/beef-noodle-demo`, `/merchant-admin/ordering`, `/merchant-admin/ordering/kitchen`, `/dashboard/qr-codes` | 訪客／會員／商家 | 原始錯誤、測試交易開發文案；需確認權限與金額 | 繁中錯誤；真實服務狀態；價格由 Worker 重算；跨商家隔離保留 | `src/pages/QrOrderingPage.tsx`, `src/pages/BeefNoodleBookingPage.tsx`, Worker ordering tests |
| 承攬夥伴 | `/partner/contract`, `/partner/contracts/:signatureId/view`, `/partner/dashboard`, `/partner/commissions` | 未登入／已登入夥伴 | 簽名正楷暗示、原始錯誤、返回流程風險 | 一般非空白手寫簽名；手機＋8 位密碼；不使用 OTP；私人 PDF 仍需授權 | `src/pages/PartnerPages.tsx`, partner/auth/contract tests |
| 共用會員與舊入口 | `/member`, `/member-benefits`, `/account`, `/login`, `/register`, `/forgot-password`, `/dashboard`, `/messages`, `/notifications`, `/collaborations*`, `/marketplace*`, `/shop*`, `/cart`, `/checkout`, `/payment/:result`, `/demo-sites*`, `/about`, `/partner` | 混合 | 空按鈕、過時入口與可能誤導 | 保留相容導向或明確未開放頁；Mobile Nav 改為可用的方案／加入入口 | `src/App.tsx`, `src/components.tsx`, homepage production tests |
| 文件驗證 | `/verify-contract/:publicId` | 公開 | 技術標籤與私人資料風險 | 僅顯示必要驗證結果；不回傳姓名、電話、IP、簽名或私人 PDF | contract privacy tests |
| 管理端 | `/admin/login`, `/admin`, `/admin/finance`, `/admin/bookings`, `/admin/ordering`, `/admin/financing`, `/admin/partners`, `/admin/contracts`, `/admin/addons`, `/admin/google-maps-booking` | 管理員 | 內部狀態需保留但不可公開 | 路由與 API 均維持管理 session／權限檢查；內部狀態留在管理與 Audit | admin auth/origin/CSRF tests |
| 例外與導向 | `*` 及相容 redirect | 全部 | 迴圈、返回方案遺失、載入中誤判 | 允許站內 returnTo；方案意向由 server/session 保存；載入狀態先呈現 | `src/App.tsx`, merchant/partner flow tests |

## 修改前後文案對照

| 修改前 | 修改後 |
|---|---|
| 使用同一套商家契約簽署流程 | 免費註冊帳號後，再確認方案內容並完成契約簽署 |
| 伺服器方案目錄／法律審閱 Gate／readiness | 方案內容／申請條件／可使用狀態 |
| 您目前已有有效方案＋大型技術警告 | 您目前已有有效方案＋「變更方案」 |
| Plan Change／Upgrade／Addendum | 變更方案／方案調整申請／補充協議（僅在客戶確實需要時） |
| Provider 尚未啟用、不會產生假交易 | 申請方式及實際可提供的付款／發票條件 |
| Merchant Session／Platform Member | 商家帳號的安全登入／平台會員 |
| 原始 `error.message` | 可理解的繁中訊息與下一步；診斷留在受控紀錄 |

## 測試與視覺證據

- 四份 PDF：`tmp/pdfs/{18k,45k,24k,partner-v1.5}.pdf`
- PDF 逐頁轉圖：`tmp/pdf-render/*.png`；已人工檢查標題、正文與簽署頁。
- PDF 產生器：`scripts/generate-contract-pdf-qa.mjs`，使用 Production 核准後正文與正式顯示標題。
- 自動測試：Worker 676（675 pass、1 skip、0 fail）；Commerce 11/11；Contractor 5/5；typecheck/build 通過。
- 實機限制：桌面 Chrome 已檢查；360/390/412/430 為瀏覽器 viewport 驗證；實體 LINE／Messenger 內建瀏覽器未實測時不得標示 PASS。

## 資料保全與回復

- 部署前只讀基準：Merchant Signature 29、Merchant Artifact 58、Partner Signature 6、Audit 190。
- Migration 0034 僅新增方案變更申請與稽核資料；不修改或刪除歷史契約、簽名、Artifact、Evidence、Hash。
- 回復程式碼基準：`4f22b83f1491e4e964a5f981739f729ae83f12b9`。
- 回復 Pages：deployment `5c9af1f0-a9e2-4257-a2e5-9b502390e35f`。
- 回復 Worker：version `8013c7ab-d741-459b-a8f1-f32cd6eb2b76`。
- 0034 為向後相容新增表，不需 destructive rollback；舊 Worker 不會讀寫此表。

## 尚未實測／限制

- 不冒用正式使用者、不代簽、不付款、不寄送通知，因此正式站簽署寫入與交易只做既有自動測試及非破壞性 API／權限驗證。
- 實體 LINE Browser、Messenger Browser 與多款 Android 實機需由持有裝置者另行驗收；本次不以模擬 viewport 冒充實機。
