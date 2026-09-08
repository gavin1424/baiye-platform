# 點餐靈 Android v2

點餐靈是「創百業智慧餐飲管理系統」的商家主 App。它直接延伸 `baiye-platform` 正式 ordering domain，不另建商家、會員、菜單或訂單資料庫。Android `applicationId` 保留 `com.baiye.merchantprinter`，確保既有安裝可覆蓋升級並保留 Session、印表機設定與本機工作狀態。

## 架構

顧客 QR／LINE／Web 與櫃台 POS 最終都寫入 `merchant_food_orders`。來源與預約／外送 metadata 放在一對一延伸表 `merchant_order_fulfillment`。訂單建立成功後，既有 `print_jobs` 以 D1 batch 產生；Android 才能透過區域網路把 ESC/POS bytes 送到印表機，瀏覽器不接觸硬體。

Android 使用 Material 3。手機為五項 Bottom Navigation，寬度 720dp 以上切換成 NavigationRail；支援亮／暗色、直向與橫向。首頁、訂單、櫃台開單、菜單、桌位 QR、KDS、會員、報表、店舖設定、印表機、優惠狀態、叫號、員工與整合服務均為原生 Compose 畫面。

## Authentication 與隔離

- Production base：`https://chuang-baiye-ai.baiye-platform.workers.dev`
- Login：`POST /api/merchant-auth/login`
- JSON body：`phone`、`password`
- Android 對 Merchant Auth/Admin request 帶 `Origin: https://baiyeconnect.com`。
- `PersistentCookieJar` 保存 `baiye_merchant_session`，重啟後由 `/api/merchant-auth/session` 驗證並更新 CSRF token。
- 多商家 owner 在登入 response 要求選店時使用既有 `/api/merchant-auth/select`；不接受 Android 提供任意 `merchant_id`。
- 所有 Merchant Admin、ordering 與 printer API 皆從 server session 取得 merchant，D1 查詢再以 merchant_id scope。

## 資料庫

Migration `0028_ordering_spirit_operations_v1.sql` 只新增：

- `merchant_order_fulfillment`：來源、scheduled order、pickup number、delivery metadata。
- `printer_assignments`：kitchen／drink／side_dish／counter 分站預留。
- operations 權限碼。

既有 `printers`、`print_jobs`、`print_job_attempts`、menu、inventory、membership、coupon、payment 與角色表均直接沿用。Migration 為 forward-only、`IF NOT EXISTS`／`INSERT OR IGNORE`，已由 Wrangler 全新本機 D1 完整套用測試。

## Backend API

App 直接使用既有 `/api/merchant-admin/ordering/*` 與 `/api/merchant-app/*`，並新增最小相容資源：

- `POST /api/merchant-admin/ordering/orders`：櫃台 POS，Idempotency-Key 必填，server 驗證商品、選項、庫存與價格後寫入 canonical order。
- `GET /api/merchant-admin/operations/reports`：今天、昨天、7 日、30 日與日期區間的 server aggregate。
- `GET /api/merchant-admin/operations/promotions`
- `GET /api/merchant-admin/members/:id`
- `GET /api/merchant-admin/operations/staff`
- `GET /api/merchant-admin/operations/integrations`

COUNTER 訂單與明細、pricing、inventory movement、audit、fulfillment、print job 在同一 D1 batch 內提交。相同 Idempotency-Key 只回放第一次結果。

## Offline 與恢復

SQLite durable store 保存 cache、printer config、print jobs、attempts、device id、已通知 order code 與 pending mutations。訂單狀態和櫃台開單在斷線時標示待同步；恢復網路後按 idempotency key 重送，不會假裝 server 已完成。

列印仍遵守 claim token／lease、print intent durable record、完成 ACK 與 ambiguous outcome 隔離。寫入可能成功但 ACK 失敗時不得自動補印，商家須確認後以有 reason/operator/timestamp 的 reprint 執行。

## XP-N160II

第一版只使用 LAN TCP，IP 與 Port 由商家設定，常見的 9100 僅為可修改預設值。連線成功只能顯示 `Network reachable`，不得宣稱紙張、上蓋或切刀正常。繁體中文預設 raster bitmap，native Big5 僅為實驗模式。MockPrinter 會把完整 ESC/POS fixture 保存於 App files 目錄。

## Debug / Demo

Demo Mode 僅在 Android 本機產生 20 商品、10 訂單、10 會員與報表，不呼叫寫入 Production。正式支付、電子發票、Uber Eats、foodpanda 與第三方物流在沒有 credentials／授權時只顯示未設定或尚未支援。

## 驗證與建置

```text
npm run typecheck
npm run build
npm run test:worker
cd android
gradlew.bat testDebugUnitTest assembleDebug assembleDebugAndroidTest
gradlew.bat connectedDebugAndroidTest
```

模擬器 QA 包含手機直向、平板直向、平板橫向及暗色模式。實機仍需驗證 XP-N160II 的實際 Port、中文紙面、切紙、長單、斷線與疑義列印人工恢復。

## Deployment

本次未自動修改 Production D1 或部署 Worker。部署前先備份、在 staging 套用 `0028`、跑 smoke test，再執行正式 D1 migration 與 Worker deploy。沒有正式 Android signing key 時只交付 debug APK；不得自行產生金鑰冒充 release。
