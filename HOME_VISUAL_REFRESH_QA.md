# 首頁視覺更新與瀏覽器驗收

驗收日期：2026-10-03。正式站：[baiyeconnect.com](https://baiyeconnect.com/)。最後發布版本：[0f211f06](https://0f211f06.baiye-platform.pages.dev)。正式網域已實際載入 `index-aIGHZBlQ.js` / `index-DLOBuQ-8.css`。

修改以原正式站來源 commit `141dfe7` 為基準，分支 `codex/home-visual-refresh-20261003`。原部署：[8eaedda9](https://8eaedda9.baiye-platform.pages.dev)。中途預覽：[dd2965cc](https://dd2965cc.baiye-platform.pages.dev)，此預覽早於最後的卡片字級與客服 CTA 避讓微調；交付截圖取自最後正式版本。對話中未收到可讀取的使用者截圖附件，因此「修改前」使用工作開始時實際開啟的正式站畫面。

## 已完成的視覺調整

- 手機 Header 68px，保留 Logo 與品牌名稱，44px 透明選單按鈕。
- Hero 採上方橫向文案與 CTA、下方完整商業場景；四張一致風格的無文字 3D 圖片，細小輪播控制、淡入、播放／暫停與 reduced-motion 支援。
- 四個快速入口、八項既有平台功能彈窗、商家網站入口、點餐體驗、媒體卡片、最後 CTA 與 Footer。
- 媒體預設三篇、展開可看既有六篇。保留原資料及連結，未虛構新聞、日期或平台受到報導的事實。
- 統一 navy / gold / warm tokens；手機 H1 34–40px、H2 28px、主要正文 15px。
- 手機 AI 44px icon，操作後展開標籤；捲動時避讓文字與 CTA，對話窗高於底部導覽。
- Bottom Navigation 60px、統一線性圖示、金色 active 與中央發布入口，加入 safe-area 與正文底部空間。

## 最後正式站尺寸測量

以實際 Chromium 瀏覽器 viewport 測試，非 Photoshop 或 HTML 假畫面。瀏覽器含 15px 捲軸，因此正文 clientWidth 小於 viewport；每個尺寸的 scrollWidth 均等於 clientWidth，沒有橫向捲動。

| 視窗 | Header | Hero | H1 | 底部導覽 | 橫向捲動 |
| --- | ---: | ---: | ---: | ---: | --- |
| 360 × 800 | 68px | 572px | 34px | 60px | 無 |
| 390 × 844 | 68px | 595px | 35.88px | 60px | 無 |
| 412 × 915 | 68px | 614px | 37.9px | 60px | 無 |
| 480 × 1040 直式尺寸代理 | 68px | 620px | 40px | 60px | 無 |
| 768 × 1024 Tablet | 72px | 783px | 40px | 60px | 無 |
| 1440 × 1000 Desktop | 72px | 580px | 57.6px | 隱藏 | 無 |

H1 在手機維持正常兩行閱讀。場景使用 `object-fit: contain`，視覺檢查主要人物與商店完整，無窄欄直排或異常裁切。Hero 與文字分離，Desktop、Tablet、Mobile 各自有排版與尺寸處理。

480 × 1040 是額外的 Samsung S25 Ultra 直式尺寸代理，**不是 Samsung 實機測試**，也未模擬 Samsung UA 或 DPR。此環境無可連線實機。`env(safe-area-inset-bottom)` 已加入 viewport-fit=cover 與相關 padding，但目前 Chromium safe-area 為 0，尚未驗證非零 inset 的實機畫面。

## 實際互動驗證與保留範圍

- 正式站手機 Menu 開啟／關閉正常。
- Hero「立即了解」抵達既有 `/features`，「探索服務」抵達既有 `/businesses`。
- 正式站五個 Bottom Navigation 入口均可抵達原頁面；搜尋仍連到原商家目錄，我的仍抵達商家登入頁。
- 預覽站八項既有功能彈窗逐一開啟與關閉，原 CTA route 保留，包括三個 POS 入口、網站預約 query、商家與夥伴簽約入口。
- 四個場景手動切換、播放／暫停與自動換頁均有實際驗證。手動選擇場景會暫停播放，使用者可再按播放。
- 媒體三篇／六篇展開與收合正常；原六個資料與網址保留。
- 正式站 AI 客服實際取得 LINE 整合服務回覆，原對話歷史保留。預覽網域曾顯示 AI 請求失敗，未確認其原因；正式網域刷新前後均可取得回覆。
- 最後正式版本於 390 × 844 全文捲動 14 個位置，DOM 文字矩形與 CTA 矩形均未與 AI launcher 相交；launcher 始終高於 Bottom Navigation。載入完全文後沒有失效圖片。數據見 `evidence/production-scroll-checks.json`。
- 核對 125 個路由、資料、store、API、登入與後端相關原始檔，內容均與正式基準相同，見 `evidence/source-integrity.json`。修改的 AI 元件僅 launcher 呈現／定位；API、history、sendMessage 與 session 邏輯保留。
- 商家網站本身、Worker、資料庫、DNS 與驗證邏輯未部署修改。既有靜態商家路徑仍由原 build script 輸出。

驗收範圍不含登入後會員／商家管理的完整操作、付款或建立真實需求等資料寫入流程；本輪未取得登入憑證。不能將路由與原始碼保留宣稱為所有商業流程均經端到端測試。

原正式站 `/collaborations/new` 就是 `EmptyCollaborationPage`，顯示「目前尚無公開合作需求」。本輪遵守保留功能限制，未重新開放發布表單。原 `/businesses` 是商家目錄，未新增搜尋功能。

## 建置與回歸檢查

`npm run typecheck` 與 `npm run build` 通過。既有大型 bundle 警告仍在，本輪未調整網站架構。

執行 `node --test scripts/public-login-routing.test.mjs scripts/hashrouter-ordering-sections.test.mjs scripts/customer-qr-scanner.test.mjs`：10 項，8 通過、2 失敗。在**未修改的正式基準**重跑也得到相同兩項失敗，並非這次 UI 修改引入：

1. general ordering 測試仍預期舊 `GENERAL_ORDERING_CODE`，基準已使用 `BEEF_NOODLE_GUEST_ORDERING_URL`。
2. merchant session 測試仍預期舊 navigate 語法，基準已有條件式商家權限路由。

詳見 `evidence/regression-tests.txt` 與 `evidence/baseline-regression-tests.txt`。

## 交付畫面

- [手機首屏](evidence/production-mobile-390.jpg)
- [手機完整原始長截圖](evidence/production-mobile-full.jpg)
- [完整長截圖分段總覽，左至右閱讀](evidence/mobile-full-contact-sheet.jpg)
- [Desktop 首屏](evidence/production-desktop.jpg)
- [Desktop 完整畫面](evidence/production-desktop-full.jpg)
- [手機前後比較：左原版／右新版](evidence/mobile-before-after.jpg)
- [Desktop 前後比較：左原版／右新版](evidence/desktop-before-after.jpg)
- `evidence/production-mobile-360.jpg`、`production-mobile-412.jpg`、`production-s25-ultra-portrait-proxy.jpg`、`production-tablet.jpg`。
- [生成視覺素材與提示詞規格](docs/home-hero-assets.md)

原始 screenshot 保留，前後比較僅等比例縮放與拼接。Full-page capture 中固定導覽通常只在第一個 viewport 位置出現一次，是否遮擋內容以實際逐段捲動畫面及幾何檢查為準。

## 原版備份

原正式建置備份於 `C:/Users/wwwas/Desktop/網站/production-backups/home-visual-refresh-20261003/baseline-client`。舊部署 `8eaedda9` 保留可供比對與恢復。
