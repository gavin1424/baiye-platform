# 創百業商家出單 App Android v1

## Architecture

Android v1 直接延伸現有 Production 掃碼點餐架構，不新建 merchant 或 order 系統。正式資料流程為：

`Customer QR → merchant_food_orders → print_jobs → Android claim → LAN ESC/POS → printed ACK`

新訂單仍由 `qr-ordering.js` 建立。訂單、品項、選項、庫存異動、audit 與列印任務放在同一個 D1 `batch` 內執行；D1 batch 失敗時全批失敗。Worker 也保留 migration 剛部署時的相容保護：若 `printers` 尚未存在，不影響舊 QR 下單。正式部署順序仍必須是 migration 先、Worker 後。

列印機只由 Android App 在商家 LAN 內操作，瀏覽器與 Worker 不連線印表機 IP。

## Backend API

所有 `/api/merchant-app/*` 都使用現有商家帳密、HttpOnly merchant session、CSRF 與 merchant permission；merchant_id 來自 server-side session，不接受 App 指定。

- `POST /api/merchant-app/auth/login`
- `GET /api/merchant-app/auth/session`
- `GET|POST /api/merchant-app/printers`
- `PUT /api/merchant-app/printers/:id`
- `GET /api/merchant-app/print-jobs/pending`
- `GET /api/merchant-app/print-jobs/history`
- `POST /api/merchant-app/print-jobs/:id/claim`
- `POST /api/merchant-app/print-jobs/:id/printing`
- `POST /api/merchant-app/print-jobs/:id/printed`
- `POST /api/merchant-app/print-jobs/:id/failed`
- `POST /api/merchant-app/print-jobs/:id/reprint`
- `GET /api/merchant-app/ordering/overview`
- `PATCH /api/merchant-app/ordering/orders/:code/status`

App ordering alias 內部仍交給既有 `handleOrderingAdminRequest`，所以狀態只能按 `submitted → accepted → preparing → ready → served → completed` 流程前進。

## Database

Migration：`0027_xprinter_android_app_v1.sql`

- `printers`：商家私有 LAN 設定，Port 為 1–65535 可調整，沒有寫死實機 port。
- `print_jobs`：列印 snapshot、lease、token hash、delivery outcome 與 reprint metadata。
- `print_job_attempts`：每次 claim/printing/result 軌跡。

原始任務由 partial unique index 限制 `(merchant_id, order_code, printer_id, print_type)` 只有一筆。補印必須產生新 job，並保存 `reprint_of_job_id` / `reprint_reason` / `reprint_operator` / `reprint_requested_at` / `reprint_sequence`。每個 API retry 另有 merchant-scoped idempotency key。

架構不寫死單印表機：每個 order 可有多個 printer/print_type job，v1 UI 先設定一台 Kitchen Printer。

## Android

- Kotlin + Jetpack Compose
- package: `com.baiye.merchantprinter` (`.debug` suffix for debug APK)
- SQLite durable store（Room 同等級 Android SQLiteOpenHelper）儲存 printer config、claimed jobs、attempt state、session token、last sync 與 device_id
- Foreground Service 每 3 秒 polling
- WorkManager + `BOOT_COMPLETED` 在 Auto Print 已開啟時恢復服務
- 通知文案：「創百業出單服務運作中」

通知權限在商家開啟 Auto Print 時才要求。Android 重開後由 WorkManager 合規啟動 Foreground Service。

## ESC/POS and Chinese rendering

`PrinterDriver` 有 `LanEscPosPrinter` 與 `MockPrinter`，socket code 不存在 UI。`EscPosRenderer` 支援 initialize、alignment、bold、字體大小、line feed、separator、GS v 0 raster 與 cut。

v1 預設使用 576 dots（72 mm at 203 DPI）點陣圖。Android 字型先將繁體中文排版成黑白 bitmap，再送 ESC/POS raster image，避免 Big5/codepage 不相容造成 `????`。另保留 `NATIVE_BIG5_EXPERIMENTAL`，僅能在 XP-N160II 實機確認 codepage 後啟用。

桌號 76sp、品項 38sp、備註 34sp bold；每個 Unicode 字元依實際測量寬度換行，長品名與長備註不截斷。補印 payload 會列出「【補印】」。

## Print lifecycle and recovery

1. App 取得 pending job。
2. App 先持久化 `claim_request_id`；claim 回傳一次性 raw token，Backend 只保存 hash，lease 10 分鐘。如 claim response 在網路中遺失，同一裝置可用同一 request id 取回相同 token，不產生第二次 claim。
3. App 先持久化 claim token 與 `CLAIMED_DURABLE`。
4. Backend 進入 `printing`，lease 延長 30 分鐘。
5. App 在實體 I/O 前持久化 `PRINTING_INTENT`。
6. socket 寫入成功後持久化 `WRITE_COMPLETED_AWAITING_ACK`。
7. ACK 成功後記錄 `PRINTED_ACKED`。

ACK 失敗只重送 ACK，絕不重印。若 App 在 `PRINTING_INTENT` 中被 kill/reboot，恢復時將 job 標為 `ambiguous`，顯示「可能已列印，請確認後補印」，不會自動重印。Backend 也不會因 lease timeout 自動重派 ambiguous job。

明確發生在 connect 前的 safe failure 使用 5 / 15 / 30 / 60 秒 backoff，最多四次。寫入失敗視為可能 partial write，一律 ambiguous。

## Printer status

v1 僅區分 `UNKNOWN` / `NETWORK_REACHABLE` / `OFFLINE` / `ERROR`。TCP connect 成功只顯示 `Network reachable`，不聲稱紙張、上蓋、切刀或印頭正常。未實機確認 XP-N160II bidirectional status 前不實作虛假 sensor 狀態。

## Build, QA and deployment

Windows 建置：

```powershell
cd android
./gradlew.bat assembleDebug testDebugUnitTest
./gradlew.bat connectedDebugAndroidTest
```

因 repository 上層路徑含中文，`android.overridePathCheck=true` 已開啟。若舊版 Windows toolchain 仍有 classpath 問題，可建立 ASCII junction 後建置。

QA 覆蓋 D1 migration、原始任務防重、tenant FK、retry bound、ambiguous 不回佇列、中文 payload、長品名、長備註、多選項、20 份、外帶、Android local recovery state、APK build 與 emulator 六個畫面。MockPrinter 將 fixture 儲存在 App private `files/mock-printer/*.escpos`。

正式部署前：

1. 備份 D1，先套用 `0027` migration。
2. 在 Staging 以虛擬 merchant/order 驗證 queue，不使用 Production 客戶資料。
3. 部署 Worker，確認 Web regression。
4. 在商家手機安裝正式簽章 APK，再完成 XP-N160II 實機驗證。

本次未部署 Production，也未生成或假裝 Production signing key。

## Troubleshooting

- `Network unreachable/refused`：確認手機與印表機同 LAN、IP 無變動、Port 來自印表機網路設定。
- TCP 可連但沒有紙：只能以實體紙本確認，v1 不假造印表機 ACK。
- 中文亂碼：確認使用 `BITMAP` 模式；不要開啟 experimental Big5。
- 任務 ambiguous：先看紙本；沒有出紙才點「補印」並二次確認。
- 手機重開後未恢復：確認 Auto Print 與通知權限已開啟，且系統沒有將 App 設為受限電池模式。

## Merchant onboarding

使用現有商家手機號碼與 8 位數字密碼登入，輸入實機 IP/Port，先測試連線，再測試列印，人工確認繁中、切紙、寬度與不重印，最後才開 Auto Print。
