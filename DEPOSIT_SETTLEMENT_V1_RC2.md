# 創百業智慧鏈｜訂金代收與月結對帳 V1 RC2

狀態：`RC2_CODE_COMPLETE / PRODUCTION_NOT_DEPLOYED`

基準：`13585d9a48e0fab29ced4f5ec3b943845a52069e`

分支：`feature/deposit-settlement-v1`

## 範圍與 Production Lock

本次只修正部署前阻斷問題。沒有套用遠端 D1 migration、沒有部署 Worker 或前端、沒有啟用 settlement profile 或金流 Provider，也沒有變更 LINE、AI、Booking、Partner、電子契約、Secret 或任何正式資料。

## Schema 與來源資格

Migration `0010_merchant_settlements.sql` 在尚未進 Production 的前提下升級為 RC2。新增／更新九張表：平台財務設定、商家規則、來源資格、對帳單、明細、調整、事件、文件版本及冪等操作。

舊付款不回填、不猜測用途。只有經管理員覆核、具同商家訂單快照，且 `collection_role=platform_deposit`、`settlement_eligible=1` 的來源可以進入對帳。人工付款預設 `manual_unclassified`；商家直收、尾款、測試付款一律排除。來源先被同一草稿原子保留，資料庫 trigger 才允許建立明細。

## 計算規則

所有金額使用 INTEGER minor units，basis points 使用 BigInt half-up：

- `expected_deposit = round(order_total × deposit_rate_bp / 10000)`
- `actual_deposit_collected = eligible captured deposits - related completed refunds`
- `deposit_variance = actual_deposit_collected - expected_deposit`
- `merchant_payable = actual_deposit_collected - processing_fee - platform_service_fee - tax_reserve - withholding +/- adjustments`

差異非零時預設禁止鎖定；必須提供正式原因並由管理員覆核，後端鎖定時重新計算。一次付清方案不建立 NT$18,000 抵付；只有銷售抵付方案累計，超額部分依契約規則處理。

## Asia/Taipei 邊界

前端與 Worker 共用語意一致的日期工具。對帳期間以台灣日期輸入，查詢轉為 `[start_utc, end_exclusive_utc)`，不使用 `BETWEEN`、SQLite `date(timestamp)` 或瀏覽器 UTC 日期切片。PDF、CSV、匯款日與 Audit 明確以 `Asia/Taipei` 呈現。

## 手續費、退款與回沖

金流手續費逐筆決定：actual 優先；`actual_or_estimated` 只估缺少 actual 的個別付款；`actual_only` 任一筆缺 actual 即禁止鎖定；`estimated` 全部估算。對帳單分別保存 actual、estimated 與 missing 數量。

退款政策為 enum：`pro_rata_reverse`、`no_reverse`、`manual_review`。鎖定前重新計算；鎖定／付款後不改原單，產生下一期 adjustment，分開保存 deposit reversal、platform fee reversal、offset reversal 與 provider fee retained。

## 狀態、作廢與文件

狀態流為 `draft → review → locked → paid`。draft/review 可作廢並在同一 batch 釋放來源；partial unique index 允許同期間建立替代草稿。locked/paid 不可作廢，只能 adjustment/reversal。

鎖定與付款 PDF 使用不可變 Key：

- `settlements/{merchant_id}/{statement_no}/locked-{pdf_hash}.pdf`
- `settlements/{merchant_id}/{statement_no}/paid-{pdf_hash}.pdf`

每版存入 `settlement_document_versions`。先寫版本化 R2，再更新 D1；D1 未提交時清理孤兒 object，已提交後不刪歷史文件。重要 mutation 使用 Idempotency-Key 並回放第一次結果。

## 舊財務回歸

Admin Finance 保留財務總覽、付款方式統計、商家應收摘要、人工付款 paid/pending、付款淨額／來源欄位與 UTF-8 BOM CSV。CSV 包含日期、商家、訂單、付款方式、Provider、實收、手續費、淨額、狀態、交易編號及來源。

## 部署步驟（本輪未執行）

1. 確認 feature branch CI 全綠並完成法務／會計審查。
2. 匯出 Production D1，驗證備份非空且可還原。
3. 在隔離資料庫執行 0001～0010、schema validation 與 rollback rehearsal。
4. 經人工核准後套用 Production migration 0010。
5. 部署 Worker，驗證 health、Admin Auth、CSRF、Origin、來源資格與 preview。
6. 部署前端，執行 Desktop／Mobile／權限 smoke test。
7. profile 保持 disabled，待個別有效契約與會計覆核後逐店啟用。

## Rollback

若 migration 尚未套用：回退 RC2 commit 即可。若未來已套用但尚無正式 settlement 資料，先備份並執行 `migrations/rollback/0010_merchant_settlements.down.sql`。若已有正式對帳資料，不直接 drop；停止新寫入、保留 R2 版本，部署前一 Worker／前端版本，另建向前修復 migration。任何情況都不覆寫或刪除既有契約 PDF。
