# 創百業智慧鏈｜掃碼加入會員與手機點餐 V1

狀態：`CODE_COMPLETE / PRODUCTION_NOT_DEPLOYED`

開發分支：`feature/qr-membership-ordering-v1`

正式網站：`https://baiyeconnect.com/`

## 目標

讓商家建立專屬 QR Code。顧客以手機掃碼後，可在同一頁完成：

1. 辨識商家、入口用途與桌號。
2. 填寫姓名、台灣手機與隱私同意，建立該商家的快速會員。
3. 同一手機保存不含個資的會員 Session Token，再次掃碼可直接進入菜單。
4. 選擇內用／外帶、加入購物車、輸入桌號或備註並送出訂單。
5. 查看訂單編號與店家接單、製作、可取餐、完成或取消狀態。

管理員可建立商家設定、QR、菜單分類、品項，並在訂單看板更新處理與付款狀態。

## 正式網址格式

本專案使用 `HashRouter`，QR 必須編碼下列格式：

```text
https://baiyeconnect.com/#/q/<opaque_code>
```

QR 只包含不可猜測且可停用的短碼，不直接暴露 `merchant_id`、會員 ID 或資料庫主鍵。

## 新增路由

### 顧客端

- `/#/q/:code`：掃碼加入會員與手機點餐。

### 管理端

- `/#/admin/ordering`：QR、菜單、會員數與訂單看板。

## API

### 公開端

- `GET /api/ordering/qr/:code`
- `POST /api/ordering/qr/:code/join`
- `GET /api/ordering/qr/:code/menu`
- `POST /api/ordering/qr/:code/orders`
- `GET /api/ordering/orders/:orderCode`

### 管理端

- `GET /api/admin/ordering/overview?merchant_id=...`
- `PATCH /api/admin/ordering/settings?merchant_id=...`
- `POST /api/admin/ordering/qrs?merchant_id=...`
- `PATCH /api/admin/ordering/qrs/:id?merchant_id=...`
- `POST /api/admin/ordering/categories?merchant_id=...`
- `PATCH /api/admin/ordering/categories/:id?merchant_id=...`
- `POST /api/admin/ordering/items?merchant_id=...`
- `PATCH /api/admin/ordering/items/:id?merchant_id=...`
- `PATCH /api/admin/ordering/orders/:orderCode/status?merchant_id=...`

管理端沿用正式 Admin HttpOnly Session、Origin 驗證與 CSRF；顧客端使用隨機 Bearer Session Token。

## 資料庫

Migration：`cloudflare-worker/migrations/0011_qr_membership_ordering.sql`

Rollback：`cloudflare-worker/migrations/rollback/0011_qr_membership_ordering.down.sql`

新增資料表：

1. `merchant_ordering_settings`
2. `merchant_ordering_qr_codes`
3. `ordering_customers`
4. `merchant_ordering_memberships`（與既有 CRM 會員資料隔離）
5. `merchant_member_sessions`
6. `merchant_menu_categories`
7. `merchant_menu_items`
8. `merchant_food_orders`
9. `merchant_food_order_items`
10. `merchant_ordering_audit_logs`

Migration 不放入假商家、假會員、假菜單或假訂單。新商家必須由管理員正式建立資料後才可啟用。

## 安全與正確性

- 會員 Session 原始 Token 只回傳一次；D1 僅保存 SHA-256 雜湊。
- QR Code 使用隨機短碼，可個別停用或設定到期時間。
- 手機號碼正規化為台灣 `09xxxxxxxx`；快速會員 V1 不把手機標記為已驗證。
- 顧客訂單價格完全由 Worker 依目前上架菜單重新計算，不接受前端傳入價格。
- 每筆訂單要求 `Idempotency-Key`，重送不會重複建立訂單。
- 已送出訂單的商家、會員、QR、桌號、品項與金額快照由 D1 Trigger 鎖定。
- API 使用參數化 SQL、限制品項數與數量，且不在 Log 寫入完整手機或會員 Token。
- V1 只建立訂單與現場收款狀態，不會啟動正式線上扣款。

## 管理操作順序

1. 管理員登入 `/#/admin`。
2. 進入「掃碼會員與手機點餐」。
3. 輸入正式 `merchant_id` 與商家顯示名稱，先保持「正式開放掃碼」關閉並儲存。
4. 建立菜單分類與品項。
5. 建立入口、外帶或各桌專屬 QR。
6. 下載／列印 QR，在測試環境以手機掃碼驗證。
7. 確認加入會員、再次掃碼、桌號、購物車、重送冪等、訂單狀態與手機版無溢位。
8. 通過驗收後才開啟商家設定的 `enabled`。

## 部署順序

1. 備份 Production D1，確認備份非 0 bytes。
2. 在 staging 套用 migration 0011。
3. 執行：

```powershell
npm ci
npm run typecheck
npm run build
npm run test:worker
```

4. 在 staging 建立專用測試商家，不使用正式顧客資料，完成手機 E2E。
5. 驗證既有 Finance、Booking、Partner、AI、LINE、Admin Auth 回歸測試。
6. 維護窗口套用 Production migration 0011。
7. Deploy Worker，再 Deploy Frontend。
8. 先建立正式商家但保持 `enabled=0`，現場 QR 測試通過後才啟用。

## Rollback

- 若 0011 尚無正式會員或訂單資料，可執行 rollback SQL，並回退 Worker／Frontend。
- 若已有正式會員或訂單，禁止直接 Drop：先停用所有 QR 與商家 ordering settings，匯出新增十張表，由負責人核准資料保存後再決定 schema 回退。
- 回退後必須驗證既有金流、預約、承攬夥伴、AI、LINE 與管理員登入皆正常。

本分支沒有套用遠端 D1 migration、沒有部署 Worker／Frontend、沒有建立正式商家 QR，也沒有修改 Production Secret、LINE、AI、Booking、Partner、Finance 或既有正式資料。
