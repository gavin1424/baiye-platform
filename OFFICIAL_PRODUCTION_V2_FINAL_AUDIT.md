# 創百業智慧鏈 Production V2 最終上架稽核

稽核日期：2026-08-25  
正式網址：https://baiyeconnect.com/  
原則：只有正式後端可用功能標示 Production；未完成模組一律停用，不以展示資料替代。

| Feature | Status | Production / Disabled | Security | QA | Remaining risk |
|---|---|---|---|---|---|
| 公開首頁與價格 | READY | Production | 無管理資料 | typecheck/build PASS | 待正式部署後 Browser QA |
| 正式商家目錄 | READY | Production（僅美玲拼布） | 不載入 legacy catalogue | bundle scan PASS | 新商家須經確認後上架 |
| 合作需求 | SAFE | Disabled / empty state | 無假資料、無寫入 | route QA PASS | 正式後端完成後再開放 |
| 商城與 Checkout | SAFE | Disabled | 不顯示付款方式、不建立訂單 | bundle scan PASS | 正式 Provider E2E 後再開放 |
| 一般會員 | SAFE | Disabled | 無 LocalStorage 身份授權 | route QA PASS | 正式會員 DB/Auth 尚未開放 |
| 商家自助後台 | SAFE | Disabled | 無 LocalStorage 商家授權 | route QA PASS | 正式 Merchant Auth 尚未開放 |
| 正式 Admin Auth | CODE COMPLETE | Production candidate | PBKDF2-SHA256 310k、DB session、HttpOnly/Secure cookie、CSRF、rate limit、audit | automated test PASS | 尚需本人 bootstrap 第一位管理員 |
| Admin API | CODE COMPLETE | Production candidate | server session + role + CSRF | unauthorized/CSRF test PASS | 待 Worker deploy |
| 財務帳本 | READY | Production | Admin session；舊共用密碼入口停用 | existing API tests/build PASS | 待正式 Admin E2E |
| 預約 | READY | Production | Admin session、merchant scope、atomic collision protection | worker tests PASS | 商家自助帳號仍停用 |
| 承攬夥伴 | READY | Production | Hash password、invite expiry、secure session、CORS origin gate | contractor tests PASS | 2FA 尚未啟用 |
| 電子契約與 R2 PDF | READY | Production | 版本、Hash、私人授權下載 | existing flow retained | 法律內容仍應由台灣律師審閱 |
| AI／LINE | READY | Production | Secrets 位於 Worker、quota/rate controls、商家資料 scope | worker tests PASS | 平台 Chat 使用既有 Worker AI；美玲使用 OpenAI Responses API |
| CRM | SAFE | Disabled | 不展示假 CRM | route/bundle scan PASS | 正式資料與商家權限未完成 |
| Security headers | CODE COMPLETE | Production candidate | CSP、HSTS、nosniff、referrer、permissions、frame deny | build artifact contains `_headers` | 待正式 HTTP header QA |
| CORS | CODE COMPLETE | Production candidate | 僅正式主網域與美玲網站 | config audit PASS | 待 Worker deploy |
| Backup / rollback | READY | Production | D1 export、R2 inventory、annotated rollback tag | files verified non-zero | R2 為 inventory check；沒有刪除物件 |

## Public production bundle scan

Production bundle 不含：`admin@baiye.local`、`demo@baiye.local`、`Admin1234`、`Demo1234`、`Member1234`、測試付款、模擬訂單、木日木工、強哥水族、島嶼品牌設計、假平台 KPI。

## Data and migration

- Pre-V2 D1 backup: `C:\Users\wwwas\Desktop\網站\backups\PRE_OFFICIAL_PRODUCTION_V2_2026-08-25\baiye-finance.sql`
- R2 inventory: `C:\Users\wwwas\Desktop\網站\backups\PRE_OFFICIAL_PRODUCTION_V2_2026-08-25\baiye-contracts-bucket-info.txt`
- Rollback tag: `pre-official-production-v2-2026-08-25`
- Migration `0009_production_admin_auth.sql`: remote applied and validated.
- No existing merchant, partner, finance, booking, contract, D1 or R2 record was deleted.

## Release gate

`PRODUCTION_READY = FALSE` until the owner securely bootstraps the first `super_admin`, the Worker is deployed, and Production browser/mobile/API smoke tests pass. No password is stored in Git or this report.

## Post-launch P1

- Admin TOTP 2FA.
- Formal member and merchant self-service authentication (currently safely disabled).
- CRM production data model and merchant UI (currently safely disabled).
- Formal third-party payment Provider production E2E (checkout currently safely disabled).
