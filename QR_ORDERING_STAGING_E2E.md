# QR 手機點餐 Production V1｜隔離 Staging E2E

- 執行日期：2026-08-28（Asia/Taipei）
- Worker：`chuang-baiye-ordering-staging`
- D1：`baiye-ordering-staging`
- Pages：`https://baiye-platform-ordering-staging.pages.dev`
- 測試商家：`staging_ordering_merchant`
- Production：未部署、未讀寫

## 35 項流程

| # | 驗收項目 | 結果 | 證據層 |
|---:|---|---|---|
| 1 | 商家登入 | PASS | Browser + server session |
| 2 | 建立／讀取商家設定 | PASS | UI + API + D1 |
| 3 | 建立 10 桌 QR | PASS | API + D1（A1～A10） |
| 4 | QR 下載／列印入口 | PASS | UI + SVG/print renderer |
| 5 | 手機開啟 A1 QR | PASS | Browser 390px |
| 6 | 快速加入會員 | PASS | Browser + D1 |
| 7 | 開啟菜單 | PASS | Browser |
| 8 | 分類切換 | PASS | Browser |
| 9 | 加入商品 | PASS | Browser |
| 10 | 必選甜度 | PASS | Browser + Worker validation |
| 11 | 加價加料 | PASS | Browser + Worker price recomputation |
| 12 | 購物車 | PASS | Browser |
| 13 | 送出訂單 | PASS | Browser + D1 |
| 14 | 後台出現新單 | PASS | Browser |
| 15 | 通知聲授權／測試 | PASS | Browser user gesture |
| 16 | 店家接單 | PASS | Browser + Audit |
| 17 | 製作中 | PASS | Browser + Audit |
| 18 | 完成製作／可取餐 | PASS | Browser + Audit |
| 19 | 已送餐 | PASS | Browser + Audit |
| 20 | 完成 | PASS | Browser + D1 |
| 21 | 顧客狀態 API／最近訂單恢復 | PASS | API + session authorization |
| 22 | 再加點 | PASS | Browser，建立第二單 |
| 23 | 同桌 Session 群組 | PASS | D1，兩單同 session |
| 24 | 商品售完／恢復 | PASS | Merchant API + D1 |
| 25 | 售完送單重驗 | PASS | Worker behavior test |
| 26 | submitted 顧客取消 | PASS | Staging API + D1 |
| 27 | accepted 後禁止顧客取消 | PASS | Worker behavior test |
| 28 | 現場付款確認 | PASS | Browser + D1 + Audit |
| 29 | 清桌 | PASS | Merchant API + D1 |
| 30 | 下一桌建立新 Session | PASS | Staging API + D1 |
| 31 | Merchant isolation | PASS | API + D1 behavior test |
| 32 | Permission | PASS | Server session + six ordering permissions |
| 33 | CSRF | PASS | Worker regression test |
| 34 | Origin | PASS | Staging allowlist + regression test |
| 35 | Idempotency | PASS | API + D1 behavior test |

## Browser QA

- Chromium responsive：360／390／412／430／768／1440，全數無水平溢位。
- 顧客流程與商家營運看板：無 blocking console error。
- Android Chrome：以 Chromium 手機 viewport 驗證 PASS。
- iPhone Safari：`PHYSICAL_IPHONE_NOT_VERIFIED`（已完成 390／430px responsive QA）。
- LINE 內建瀏覽器：`PHYSICAL_LINE_APP_NOT_VERIFIED`（HTTPS、Mobile layout 與標準 WebView 流程已驗證）。

## 隔離與鎖定

- 無 Production D1、R2、LINE、AI、Payment Provider binding。
- `REAL_EASYWALLET_DISABLED`
- `REAL_PAYMENT_PROVIDER_DISABLED`
- `PRODUCTION_NOT_DEPLOYED`
