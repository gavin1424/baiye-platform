# 創百業智慧鏈｜訂金代收與月結對帳 RC3

狀態：`RC3_CODE_COMPLETE / PRODUCTION_NOT_DEPLOYED`

基準：`2fb1cace81a9b9322e9781b779cefd953dbe1583`

## 最終帳務規則

- 同一商家訂單只能有一筆經覆核的合格平台訂金；DB partial unique index、來源 API 409 與計算引擎三層防護。
- 訂單總額、預期訂金及平台費按 `order_id` 一次計算；金流手續費維持逐付款計算。
- NT$18,000 抵付以 `merchant_offset_ledger` posted entries 的 SUM 為權威餘額，不再取歷史 statement MAX。
- 抵付增加、退款回沖與更正只能新增 Ledger entry，不刪除歷史；唯一 idempotency key 與 DB balance trigger 保證 0 至商家目標範圍。
- 跨月退款即使原對帳單仍為 draft/review，也依退款台灣日期建立唯一 Adjustment；Adjustment 只能套用在 `period_end >= effective_date` 的期間。
- 平台費、抵付及 Provider 手續費退款政策獨立。Provider fee 只有實際退費或管理員確認後才可回沖。
- `net_settlement_minor` 可為負數；對外拆成應撥店家、店家待返還平台及下期承接餘額。
- Refund API 要求 Idempotency-Key；DB trigger 原子防止 pending/refunded 累計超過付款，Provider refund id 非空唯一。
- pending 付款轉 paid 會保存第一次 `paid_at`；Settlement 來源只使用 paid_at，不以 created_at 猜月份。
- 保留中的來源不可修改關鍵欄位；locked/paid 永久只能 Adjustment。PDF 文件版本禁止 UPDATE/DELETE。

## Migration 與 Rollback

`0010_merchant_settlements.sql` 最終新增 11 張表。本機記憶體資料庫依序套用既有 0001、0002、0009、0010 後完成 rollback，既有 merchants、payments、orders、refunds、partners 均保留。

## 操作一致性

Operation 唯一範圍包含 merchant、statement scope、operation type 與 key。Create Draft 也使用 Idempotency-Key。Lock／mark-paid 將狀態、文件指標、Ledger、Adjustment、Event、Audit 與 operation result 放入同一 D1 batch；若 Worker 在提交後中斷，重試會依 statement 最終狀態 reconciliation 並回放結果。

## 驗證

- Typecheck、Production build、Worker tests、git diff check 必須全綠。
- Migration／rollback dry run 必須 PASS。
- GitHub RC validation 不使用 Production Secrets。
- 本輪沒有連線、修改或部署任何 Production 資料與服務。
