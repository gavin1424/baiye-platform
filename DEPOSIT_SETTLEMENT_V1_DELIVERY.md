# 創百業智慧鏈｜訂金代收、月結對帳與 NT$18,000 銷售抵付模組 V1

狀態：`CODE_COMPLETE / PRODUCTION_NOT_DEPLOYED`

基準：`official-production-v2` (`e7bb3b5e959e053aa38d8ebb816e31aa9ff50700`)

開發分支：`feature/deposit-settlement-v1`

## 唯讀稽核

- `official-production-v2`、`origin/main` 與稽核時的正式前端版本一致。
- `https://baiyeconnect.com/` 與 Worker `/health` 均回傳 HTTP 200。
- Finance 使用 `cloudflare-worker/src/finance.js` 與 `FINANCE_DB`；本模組延用同一入口。
- Admin API 使用 `admin_users/admin_sessions`、HttpOnly Session、CSRF 與嚴格 Origin。
- 既有 Booking、Partner、AI、LINE、D1 migrations 0001～0009 及 R2 `CONTRACTS_BUCKET` 未被重建。
- PDF 僅規劃使用既有私人 bucket 的 `settlements/<merchant_id>/` 前綴，不改寫契約 PDF。

## Migration

完整檔案：`cloudflare-worker/migrations/0010_merchant_settlements.sql`

Rollback：`cloudflare-worker/migrations/rollback/0010_merchant_settlements.down.sql`

新增：

1. `platform_finance_settings`
2. `merchant_settlement_profiles`
3. `merchant_settlements`
4. `merchant_settlement_items`
5. `merchant_settlement_adjustments`
6. `merchant_settlement_events`

所有新金額欄位皆為 INTEGER minor units。Migration 包含 FK、CHECK、unique、index、跨商家複合 FK 與 locked immutable triggers。

## API

- `GET/PATCH /api/finance/settlement-settings/platform`
- `GET/PATCH /api/finance/settlement-profiles/:merchantId`
- `POST /api/finance/settlements/preview`
- `POST /api/finance/settlements`
- `GET /api/finance/settlements`
- `GET /api/finance/settlements/audit`
- `GET /api/finance/settlements/:id`
- `POST /api/finance/settlements/:id/lock`
- `POST /api/finance/settlements/:id/mark-paid`
- `POST /api/finance/settlements/:id/void`
- `POST /api/finance/settlements/:id/adjustments`
- `GET /api/finance/settlements/:id/pdf`
- `GET /api/finance/settlements/:id/csv`

所有 `/api/finance/*` 延用正式 server-side Admin Session；mutation 由 `requireAdmin` 驗證 CSRF。PDF/CSV 無公開 URL。

## 計算規則

- Basis points 分母：10,000。
- 四捨五入：整數 half-up，使用 BigInt 避免浮點累加。
- `deposit_collected = round(order_total × deposit_rate_bp / 10000)`。
- Provider actual processing fee 優先；沒有 actual 才依核准 estimated rate 計算。
- estimated processing fee 預設 basis 為 `deposit_collected`。
- `platform_service_fee = round(order_total × platform_fee_rate_bp / 10000)`，僅已啟用且有效契約期間適用。
- tax reserve、withholding 預設 disabled / 0。
- `merchant_payable = deposit - processing fee - charged platform fee - approved tax reserve - approved withholding +/- adjustments`。
- 每張 statement 保存 `calculation_version`、rules snapshot、statement hash 與 PDF hash。

## 防止重複收費與重複入帳

- 每商家只有一筆 profile；`payment_plan` 是單一 CHECK enum，因此兩種方案不能同時 active。
- `upfront_18000` 的 current/cumulative/remaining offset 全為 0。
- `sales_offset_18000` 才逐期抵付，超過目標的費用依 `continue_platform_fee_after_offset` 決定。
- settlement item 的 `(source_type, source_id)` 全域唯一，同一 order/payment/refund 不能進兩張對帳單。
- adjustment 使用唯一 idempotency key。
- locked trigger 禁止金額與來源項目更新／刪除；後續退款只能新增下一期 adjustment。

## 稅務安全

- tax reserve 與 withholding 預設停用。
- 非 disabled 設定要求 accounting review approved。
- 不因未提供發票自動扣 10%。
- 啟用服務要求 legal review approved、契約生效日，以及後台已確認的公司法律主體與統編。
- 對外文案明確說明不代表平台代收代繳營業稅。

## QA

- Migration up dry run：PASS（6 個 settlement/finance setting tables）。
- Migration rollback dry run：PASS（新表移除、既有 merchants 保存）。
- `npm run typecheck`：PASS。
- `npm run build`：PASS。
- `npm run test:worker`：39/39 PASS；新增 settlement 22/22 PASS。
- Desktop 1440：PASS，無水平溢位。
- Mobile 360/390/412/430：PASS，無水平溢位、輸入高度 ≥ 40px、CTA 可見。
- 未授權 `/admin/finance`：導向正式管理員登入。
- `/merchant/settlements`：在 Merchant Auth 未完成前拒絕存取。

## 尚未啟用

- Production D1 migration 0010。
- Production Worker deploy。
- `baiyeconnect.com` frontend deploy。
- 任何真實代收或 Payment Provider。
- 任何 Payment Secret 變更。
- 正式公司法律主體／統編／發票設定。
- 任一商家的 settlement profile enabled。
- Merchant Session 與商家對帳入口。

## Production 部署順序

1. 法務與記帳士確認服務規則及對外條款。
2. 備份 Production D1：`npx wrangler d1 export baiye-finance --remote --output <安全的非 Git 路徑>`。
3. 確認備份非 0 bytes，記錄 Worker version、frontend commit 與 R2 inventory。
4. 在 staging 套用 0010，重跑 typecheck/build/test:worker 與 API smoke tests。
5. 維護窗口執行 `npx wrangler d1 migrations apply baiye-finance --remote`。
6. 唯讀驗證六張新表、index、trigger；確認既有 payments/orders/refunds/expenses row count 未變。
7. Deploy Worker；驗證 `/health`、Admin 401、CSRF 401、Origin 403、preview no-write。
8. 管理員設定正式法律主體、統編與發票資料。
9. Deploy frontend，驗證公開說明頁及 Admin 七分頁。
10. 僅對已簽有效契約的指定商家建立 disabled profile，雙人覆核後才 enabled。
11. 完成小範圍 dry statement、lock、private PDF/CSV、mark-paid 與 adjustment QA。

## Rollback

1. 停止建立新 settlement，記錄當前 Worker/frontend release。
2. 若 0010 尚無任何正式資料：用 Wrangler 執行 `cloudflare-worker/migrations/rollback/0010_merchant_settlements.down.sql`。
3. 若已有正式 statement：不得直接 drop；先停用所有 profile、導出六張表與 `settlements/` R2 inventory，由負責人核准資料保存方案。
4. 回退 Worker 與 frontend 到部署前 commit；不要刪除 `contracts/` 或既有契約 PDF。
5. 若 schema 回退失敗，使用部署前 D1 export 在隔離 DB 驗證後才進行正式 restore。
6. 驗證 Finance、Booking、Partner、AI、LINE、Admin Auth 與既有資料筆數。

本輪沒有套用遠端 migration、沒有部署 Worker/Frontend、沒有修改正式 D1/R2/Secret/LINE/AI/Booking/Partner 資料。
