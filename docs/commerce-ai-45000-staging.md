# AI 智慧商城完整版 NT$45,000｜Staging 驗證紀錄

- 環境：STAGING ONLY
- Plan ID：`baiye_commerce_ai_45000`
- Contract Version：`merchant_commerce_ai_v1_0_45000`
- Migration：`0023_contract_commerce_ai_45000.sql`
- 固定總價：NT$45,000（`4500000` TWD minor units）
- 法務狀態：`pending_review`
- Staging 簽署：啟用
- Production 啟用：鎖定（`is_active = 0`）

## 能力 Audit

已確認現有 Core 具備商家隔離的商品、分類、價格、圖片、規格／選項、上下架、每日限量、訂單、購物車式點餐流程、Merchant Admin、AI、LINE、Membership，以及 Common Contract Engine 的 Checkbox、簽署人、Signature Canvas、Preview、Idempotency、PDF v2、Private R2、Hash 與 Evidence JSON。

現有 Core 未提供可宣稱為完整通用庫存扣減的能力，因此契約只承諾既有 Core 支援範圍內的每日限量等能力。第三方支付使用 Provider readiness gate；未取得 credentials、帳號審核與 Production E2E 前，不會被標示為已啟用或已付款。

## Staging E2E

2026-09-02 測試商家：`staging_commerce_ai_45000_mtk1x3v1_5cdd6f`

- Render / Preview：`4500000`，附件 A 一份，無細項拆價
- Signature：`mcsig_4de273a0-e4d1-4aed-a943-38abdff62ec8`
- Public ID：`BYMC-6729DB7967C1467D`
- Idempotency replay：同一 Signature
- PDF：6,627,463 bytes
- PDF hash：`jSl5ritcA_ATyOURWgLWcv-ienOqPPMDAR8dPRtykGw`
- Merchant Admin：ACTIVE
- Product Edit：HTTP 200
- Cart / Order：`BY-20260902-XSAUZJ`
- Order payment status：`unpaid`
- Payment Production enabled：`false`

Staging Worker version：`44e9cb84-349e-4838-9270-11c1f55ca788`

Staging Pages deployment：<https://93ad6866.baiye-platform-contract-signing-staging.pages.dev>

Production Worker、Production Pages、Production D1 與 Production 法務 Gate 均未修改或部署。
