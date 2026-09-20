# Production 首頁媒體報導可見性審核

日期：2026-09-20  
正式網址：https://baiyeconnect.com/  
Production Deployment：`18440a3f-ec24-4e7e-8f8f-bf3ecf649d56`

## 審核範圍與使用者目標

確認手機使用者打開首頁後，能在首屏辨識頁面可繼續往下閱讀，並可在一次捲動內看到緊接 Hero 的「媒體報導」與新聞卡片；同時維持 Header、Hero、既有八項功能、固定底部導覽與 Desktop 首頁。

## Root Cause

Production 原頁面並非完全不能捲動。改版前 390 × 844 的實測資料為：`document.scrollingElement = HTML`、`scrollHeight = 5306px`、`clientHeight = 844px`，因此 document scroll 存在。

實際造成「看起來只有 Hero、沒有新聞」的是以下組合問題：

1. Mobile Hero 由 451px 高主視覺、106px 品牌價值列、上下 padding 與標題自然撐到約 765px；加上 68px Header 後，新聞起點位於約 833px。
2. 固定 Bottom Nav 佔用畫面底部約 69px（775–844px），剛好蓋住 Hero 與新聞的唯一交界，首屏沒有可見的下一區提示。
3. 整個 3136px 高的新聞 section 先被設為 `opacity: 0`，需通過 `IntersectionObserver threshold: 0.08` 才顯示；長 section 必須約 251px 進入視窗才觸發，首屏露出的約 11px 不足以觸發。
4. 新聞 section 沒有 `id="media-news"`，Hero 也沒有往下提示。
5. `main.immersive-home` 原本計算為 `overflow: hidden`，雖未鎖住 HTML document scroll，仍會裁切跨區塊內容；已改為 `overflow: visible`，只在 Hero 本身以 `overflow: clip` 收斂裝飾動畫的水平溢出。
6. Body 原本只保留固定導覽高度，沒有額外 24px 安全距離。

## 修改結果

- Mobile Hero 固定為 `70dvh`，不再使用整頁 `100vh`／`100dvh`。
- `#media-news` 緊接 Hero，6 則新聞一律直接 render，不再以整區 opacity 與 IntersectionObserver 隱藏。
- Hero 底部新增「媒體報導⌄」按鈕，使用 `scrollIntoView`；不用 hash anchor，避免 React Hash Router 將 `#media-news` 誤判為路由。
- 新增正式 Footer；固定 Bottom Nav 保留。
- Body 底部空間調整為 `68px + safe-area-inset-bottom + 24px`。
- Mobile Hero 裝飾內容在 Hero 內裁切，四個尺寸均無水平溢出。

## Production 實測

| Viewport | Hero | 媒體標題進入首屏 | Scroll cue | 水平溢出 | 新聞數 | 結果 |
| --- | ---: | --- | --- | ---: | ---: | --- |
| 360 × 800 | 560px / 70dvh | 是（top 660px） | 是 | 0px | 6 | PASS |
| 390 × 844 | 590.8px / 70dvh | 是（top 690.8px） | 是 | 0px | 6 | PASS |
| 412 × 915 | 640.5px / 70dvh | 是（top 740.5px） | 是 | 0px | 6 | PASS |
| 430 × 932 | 652.4px / 70dvh | 是（top 752.4px） | 是 | 0px | 6 | PASS |

Bottom Nav：頁尾到底後 Footer 底部位於 nav 上方約 23px，且 body padding-bottom 計算值為 92px。  
返回首頁：由「搜尋」返回首頁後 `#media-news`、6 則新聞與 document scroll 均存在。  
Refresh：重新整理後 `#media-news`、提示按鈕、6 則新聞與 document scroll 均存在。  
新聞連結：6/6 均有有效 HTTPS href、可點區域、`target="_blank"` 與 `rel="noopener noreferrer"`。

## 視覺審核步驟

1. 改版前 390px 首屏 — **FAIL**：Hero 填滿可見高度，下一區與提示完全不可見。
2. 改版後 Production 390px 首屏 — **PASS**：Hero、往下提示與 Media & News／媒體報導同時出現在首屏。
3. 點擊提示後的新聞區 — **PASS**：停留同一路由，標題與第一則新聞直接可見。
4. Desktop Hero／新聞交界 — **PASS**：兩區在同一條自然 document flow 中連續呈現。
5. 返回首頁、Refresh、頁尾與 Bottom Nav — **PASS**：內容可捲動，Footer 不被底欄覆蓋。

## 證據

- 改版前：`before/01-mobile-390-first-screen.png`
- 改版後 390px 首屏：`after/01-production-mobile-390-first-screen.png`
- 改版後 390px 新聞區：`after/02-production-mobile-390-media-news.png`
- 改版後 Desktop 交界：`after/03-production-desktop-1440-transition.png`

## 證據限制

本次使用連線的 Chrome 以指定 CSS viewport 對正式網址逐尺寸驗證，並非遠端操控一台實體 Samsung 裝置；螢幕截圖與 DOM 尺寸可證明響應式排版、捲動、導覽遮擋與連結結構，但不等同完整的實體裝置觸控／瀏覽器廠牌相容性認證。
