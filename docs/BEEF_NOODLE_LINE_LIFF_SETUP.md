# 百工牛肉麵 LINE LIFF 正式設定

正式商家固定為 `demo_beef_noodle`，A1 secure code 固定為
`y6KGFA0pQkEKLjf41zNBS6Nb1u1hCHUR`。不得建立第二個 merchant 或重建 QR token。

## 目前稽核結果

Production `merchant_line_integrations` 目前只有舊的停用佔位資料；Messaging API
Channel ID、LINE Login Channel ID、LIFF ID、Basic ID 與加好友網址皆尚未設定。因此
Production A1 QR 會繼續使用既有品牌點餐 URL，直到以下設定全部完成並驗證，避免發出
無法開啟的 LIFF QR。

## LINE Developers Console 人工設定

1. 在百工牛肉麵 LINE OA 所屬的同一個 Provider 建立或確認 Messaging API Channel。
2. 在同一個 Provider 建立 LINE Login Channel（Web app）。不要另建 LINE OA。
3. 在 LINE Login Channel 的 Linked OA 設定選取現有百工牛肉麵 OA。
4. 在該 LINE Login Channel 新增 LIFF app：
   - Endpoint URL：`https://baiye-beef-noodle-demo.pages.dev/liff-ordering`
   - Size：Full
   - Scope：`openid`、`profile`
   - Add friend option：Aggressive
5. 在 Messaging API Channel 設定：
   - Webhook URL：`https://chuang-baiye-ai.baiye-platform.workers.dev/webhooks/line/demo_beef_noodle`
   - 按 Verify，然後開啟 Use webhook。
6. 將 Messaging API Channel Secret 設為 Worker secret
   `LINE_BEEF_NOODLE_CHANNEL_SECRET`。Secret 不可存入 D1、前端或紀錄檔。
7. 用正式 follow 與 unfollow 事件各驗證一次 webhook；系統只保存 LINE user ID 的
   SHA-256 雜湊。
8. 以商家後台填入正式 Messaging API Channel ID、LINE Login Channel ID、LIFF ID、
   Basic ID 與 `https://lin.ee/...` 加好友網址，勾選已連結、webhook 與事件驗證狀態，
   最後才啟用 LIFF QR。

啟用後 overview 會自動將 A1 QR 回傳為：

`https://liff.line.me/<LIFF_ID>/?qr=y6KGFA0pQkEKLjf41zNBS6Nb1u1hCHUR`

## 正式驗收

1. 點餐靈「桌位與 QR」確認顯示上述 LIFF URL。
2. 在 LINE 掃 A1 QR，完成 LINE Login。
3. 非好友應顯示加入好友確認；完成後直接進入 A1 `QrOrderingPage`。
4. 選品、購物車並以原有 `POST /api/ordering/qr/:code/orders` 送單。
5. 確認 Customer 與點餐靈訂單中心的 `order_code` 完全相同。

LIFF 登入後，前端會將 LINE ID token 交由 Worker 向 LINE 驗證；前端傳入的 userId
不會被信任。D1 只保存 LINE userId 的不可逆雜湊，以及綁定 merchant、QR、桌號、
訂單的短效 context。A1 context 無法用於 A2 訂單。

桌號 QR 是正式營運入口，只允許 `https://liff.line.me/...`。LIFF 尚未完成時，商家後台
與點餐靈會停用桌號 QR 的顯示、分享、下載與列印；一般網站點餐 URL 仍保留供開發測試。
