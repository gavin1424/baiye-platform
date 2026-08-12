# 百業共創｜百工百業合作平台

「每個行業，都值得擁有自己的網站。」

可在瀏覽器實際操作的 B2B／B2C 商業平台 MVP。商家、工作室、自由接案者、供應商與企業可建立公開網站、刊登商品服務、發布合作需求、提案、詢價、報價、私訊與管理營運資料；一般訪客也可在平台直營商城瀏覽、加入購物車並完成測試結帳。

## 本機啟動

```powershell
cd baiye-platform
npm install
npm run dev -- --host 127.0.0.1 --port 4173
```

開啟：<http://127.0.0.1:4173/>

正式建置與驗證：

```powershell
npm run typecheck
npm run test:commerce
npm run build
```

登入頁內建商家與管理員的示範登入流程；公開 README 不刊登測試密碼。

## 技術架構

- React 19、TypeScript 7、Vite 6
- React Router 7
- Phosphor Icons、`qrcode.react`
- 原生 CSS 設計系統與響應式斷點
- TypeScript mock data repository
- LocalStorage：登入狀態、收藏、詢價單、提案、訊息、通知、網站編輯器、商城購物車與測試訂單
- Vite SPA 與 Sites-ready Worker 輸出
- Node.js 原生 HTTP 付款 API 骨架：伺服器端金額重算、checkout idempotency、付款通知去重與退款草稿

資料層集中於 `src/data.ts` 與 `src/store.tsx`，可在正式版替換為 Supabase／PostgreSQL、真實認證、物件儲存與即時訂閱。

## 已完成頁面

1. 首頁
2. 所有行業分類
3. 商家搜尋結果
4. 商家公開網站
5. 商家列表
6. 合作需求廣場
7. 合作需求詳情
8. 發布合作需求
9. 商品服務市集
10. 商品詳情
11. 詢價單
12. 登入頁
13. 註冊頁
14. 忘記密碼
15. 會員後台
16. 我的網站編輯器
17. 商品管理
18. 合作需求管理
19. 私訊中心
20. 通知中心
21. 方案與價格
22. 關於平台
23. 如何運作
24. 成功案例
25. 常見問題
26. 聯絡我們
27. 隱私權政策
28. 使用條款
29. 檢舉頁面
30. 404 頁面
31. 管理員後台
32. 平台直營商城
33. 商城商品詳情
34. 購物車
35. 測試結帳
36. 付款成功、失敗與取消狀態頁
37. 管理員商城商品與訂單管理

另包含 26 個行業分類詳情路由，以及商家後台的資料、作品、提案、詢價、報價、訂單、收藏、評價、分析、方案與帳號設定頁。

## 已完成互動

- 商家關鍵字、分類、地區、服務方式、評價、發票與企業合作篩選
- 熱門度、評價、最新加入排序；卡片／列表切換；分頁
- 手機版篩選抽屜、固定底部導覽與無橫向溢位版面
- 商家收藏、追蹤、分享、聯絡表單與合作邀請
- 商品收藏、加入詢價單、三步驟詢價／模擬訂單流程
- 平台直營商城：搜尋、分類、價格排序、推薦商品、缺貨阻擋與響應式商品詳情
- 購物車加入、刪除、數量修改、庫存上限與重新整理後保留
- 宅配、店到店、數位商品／服務交付方式，以及成功、失敗、取消三種測試付款結果
- 管理員新增、修改、上架／下架商品、調整價格／庫存與更新訂單處理狀態
- 合作需求收藏、兩步驟提案流程與提案紀錄
- 模擬登入、註冊、忘記密碼與角色權限
- 站內私訊、附件入口、商品／報價／需求卡片與已讀狀態
- 通知中心、全部標示已讀
- 網站編輯器：品牌色、版型、字體、內容、區塊顯示／排序、裝置預覽、草稿與發布
- 會員後台圖表、營運指標、待辦與快速操作
- 管理員 14 個管理區塊、搜尋、停權／恢復、審核、下架與公告模擬
- 三方案價格介面與模擬升級流程
- Toast、Modal、空狀態、骨架載入、錯誤狀態、收藏動畫與自然 hover／press 回饋
- SEO metadata、Open Graph、robots.txt、sitemap.xml 與 LocalBusiness 結構化資料

## 範例資料

- 20 家跨產業商家
- 20 則合作需求
- 30 個商品或服務
- 30 則評價
- 10 組私訊
- 8 筆詢價／報價紀錄
- 8 種信任與認證標章
- 12 項平台直營範例商品（圖片集中於 `data/shop-products.json`，方便正式替換）

## 商城付款測試

正式站預設使用瀏覽器本機測試模式，結帳頁會明確顯示「測試付款」，不會產生真實扣款。可於結帳頁選擇模擬成功、失敗或取消；建立的測試訂單會保存在同一瀏覽器的 LocalStorage，管理員登入後可在「商城訂單」查看。

付款 API 骨架使用 Node.js 內建模組，不接收也不儲存完整卡號或安全碼。啟動本機 mock API：

```powershell
Copy-Item .env.example .env
npm run payment:server
```

前端若要呼叫 API，只需在本機 `.env` 設定公開的 `VITE_PAYMENT_API_URL=http://127.0.0.1:8787`；TapPay App ID／App Key、Partner Key、Merchant ID 與 webhook secret 目前都只列於伺服器環境變數範例，不會被寫進 React 原始碼。`.env` 已被 Git 忽略。正式導入 TapPay Fields 時，仍須依 TapPay 對前端識別參數的官方規格與平台資安政策完成最小揭露設計。

安全結構包含：

- 依伺服器端權威商品目錄重算價格、運費與庫存
- `checkoutId` 冪等控制，相同請求不重複建立訂單
- HMAC 簽章的標準化付款通知入口與事件去重
- 退款草稿與人工核准狀態，不會直接執行正式退款
- `PAYMENT_MODE=production` 與 `ALLOW_LIVE_PAYMENTS=true` 雙重正式扣款安全鎖
- Apple Pay 驗證檔預留於 `public/.well-known/`

TapPay 正式串接應依官方的 [Web 前端](https://docs.tappaysdk.com/tutorial/en/web/front.html)、[Pay by Prime 後端](https://docs.tappaysdk.com/tutorial/en/back.html) 與 [Apple Pay 網域設定](https://docs.tappaysdk.com/apple-pay/en/portal.html) 文件完成商家審核與驗證。

## 目前未串接

MVP 不會傳送真實交易或個資；以下服務保留串接介面但尚未啟用：

- Supabase／PostgreSQL
- 真實會員認證、Email／SMS 驗證與企業 SSO
- TapPay 正式商家金鑰、正式付款後端託管、Apple Pay 商家與網域驗證、LINE Pay 商家審核
- 電子發票、正式退款執行與退款通知
- 雲端圖片／附件儲存與病毒掃描
- WebSocket 即時聊天、推播與郵件通知
- 自訂網域、DNS 與 SSL 自動化
- 真實訂單、物流、合約電子簽署
- 第三方地圖、地址與商業登記驗證

## 專案結構

```text
src/
  pages/             主要頁面與流程
  App.tsx            路由、權限與 metadata
  components.tsx     共用導覽、卡片、Modal、Toast 等
  data.ts            mock repository
  store.tsx          LocalStorage 狀態與商業互動
  styles.css         設計系統與響應式規則
data/
  shop-products.json 平台直營商品權威範例目錄
server/
  payment-api.mjs    安全付款 API 骨架
  payment-core.mjs   金額、付款、通知與退款核心
public/
  assets/            專案視覺資產
  .well-known/       Apple Pay 網域驗證檔預留路徑
  robots.txt
  sitemap.xml
```
