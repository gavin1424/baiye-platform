# Production 首頁 Mobile Safe Area 驗收

日期：2026-09-20  
正式網址：https://baiyeconnect.com/  
Deployment ID：`50574e41-6e93-46e8-b161-f73b83ca38ba`  
程式 Commit：`5aa800410795a7105fd28ad82406d7737e323647`

## Root Cause

- `.mobile-bottom-nav` 使用 `position: fixed; bottom: 0`，Production 實際高度為 69px。
- `.ai-chat-launcher` 使用 fixed positioning；原本 `bottom: 80px`，和 Bottom Nav 只剩 11px 間距，且 113.42px 寬的文字型按鈕直接壓住新聞標題與卡片。
- 首頁 `.immersive-home` 沒有底部安全距離；舊的 92px body padding 只考慮 Bottom Nav，沒有把 AI launcher 高度與 overlay 間距納入同一套 safe-area layout。
- `#media-news` 本身確認在正常 document flow，問題不是 absolute/fixed section，而是 fixed overlays 沒有被 page container 的安全區納入。

## 修正

- Bottom Nav token：69px。
- AI launcher：44 × 44px；`right: calc(16px + env(safe-area-inset-right))`。
- AI bottom：`calc(69px + env(safe-area-inset-bottom) + 16px)`；safe-area 為 0 時是 85px。
- 首頁 page container padding-bottom：`calc(69px + env(safe-area-inset-bottom) + 44px + 32px)`；safe-area 為 0 時是 145px。
- `#media-news`：`position: relative; z-index: auto; padding-block: 32px`。
- AI panel 同步避開 Bottom Nav，並使用左右 safe area；430px 測試的 panel 為 383px 寬、左右各 16px、與 Bottom Nav 相距 72px。
- Hero 高度未更動。

## Production 矩陣

| Viewport | Nav | AI | AI / Nav gap | Page safe bottom | 新聞 | Horizontal overflow | 結果 |
|---|---:|---:|---:|---:|---:|---:|---|
| 360 × 800 | 69px | 44px | 16px | 145px | 6 | 0 | PASS |
| 390 × 844 | 69px | 44px | 16px | 145px | 6 | 0 | PASS |
| 412 × 915 | 69px | 44px | 16px | 145px | 6 | 0 | PASS |
| 430 × 932 | 69px | 44px | 16px | 145px | 6 | 0 | PASS |

390 × 844 額外碰撞量測：

- 完整第一張新聞卡片：top 88.72px / bottom 558.31px。
- 第一張新聞卡與 AI overlap：0px²。
- 第一張新聞卡與 Bottom Nav overlap：0px²。
- 頁面最底部：Footer bottom 699.23px；AI top 715px，間距 15.77px。
- Footer 與 AI overlap：0px²；Footer 與 Bottom Nav overlap：0px²。

## 驗證

- TypeScript：PASS
- Production build：PASS
- Commerce tests：12/12 PASS
- Contractor tests：5/5 PASS
- Worker tests：484/484 PASS
- Production 資產：`index-9YHromHs.css`、`index-DfQM_282.js`
- Chrome responsive viewport：360 / 390 / 412 / 430 全 PASS
- Samsung Android 尺寸與 safe-area layout：PASS；本次由正式站 Chrome 精準 viewport 驗證，未遠端操作使用者的實體 Samsung 裝置。

## 視覺證據

- Before：`before/01-production-390-overlap.png`
- Screenshot A：`after/01-production-390-hero-media-transition.png`
- Screenshot B：`after/02-production-390-first-news-card.png`
- Screenshot C：`after/03-production-390-footer-safe-area.png`
