# 香雲冷香館正式驗收報告

驗收日期：2026-10-10（Asia/Taipei）。

- 正式網址：https://baiyeconnect.com/tanxiang-stable/
- 正式程式碼 Commit：6a2421af97e937ed77844311a8e7b38fd6a03df7
- Git 分支：codex/xiangyun-pavilion-20261010（已推送）
- 備份 Tag：backup/tanxiang-pre-redesign-20261010（已推送）
- 最終 Cloudflare Pages 部署：37eb064a-0e7d-4d45-a664-449370236816，production / success。
- 固定版本網址：https://37eb064a.baiye-platform.pages.dev/tanxiang-stable/

## 完成內容

首頁改為深胡桃木、金色與東方收藏館風格，包含獨立品牌導覽、展示主題、原創玻璃展示櫃概念圖、五項特色、六張獨立微距概念圖、品牌故事、收藏檔案與文獻索引、原有香品及FAQ、聯絡區與手機快捷入口。

圖像、文字、導覽及控制項分開實作；沒有將使用者廣告整張設成背景，也沒有從該廣告切片冒充多個UI。展櫃含古銅支架、中央圓形平台、木雕底座、玻璃與暖光。主圖柔和亮度變化、圖像hover、捲動出場與按鈕回饋已實作，支援prefers-reduced-motion。

## 已通過驗收

| 項目 | 結果／證據 |
| --- | --- |
| 本機與正式瀏覽器 | 實際開啟、操作並截圖；未以HTTP成功代替視覺驗收 |
| 六尺寸 | 360、390、430、768、1366、1920px；scrollWidth=clientWidth，均無橫向溢出 |
| 主圖 | 手機完整原木與左右支架；圖像無變形，AI標示可見 |
| 六微距 | 6張卡片分別打開對應大圖；上一張／下一張、循環、Escape與關閉可用 |
| 放大及拖曳 | 100–400%控制、重設、實際拖曳平移；150%時確認transform縮放與平移 |
| 冷載入回歸 | 發布後發現未解碼圖片產生NaN界限，已修復、增加腳本版本、再次正式驗證150%正常 |
| 手機滑動 | 微距橫向區scrollLeft=306；燈箱原尺寸水平拖動切至2/6 |
| 導覽／FAQ | 錨點、手機選單開閉及收合、原FAQ展開正常 |
| 商品保留 | 四品項名稱、標籤、描述與NT$480／580／880／1,280逐欄比對；原圖位元組一致 |
| 聯絡保留 | service@tanxiang.com.tw、mailto與複製信箱正常；洽詢入口進入#contact |
| 圖片／Console | 已載入圖片無失效；正式站Console error/warn=[] |
| 字型／腳本 | 自託管字型狀態loaded，正式腳本pavilion.js?v=2 |
| 正式部署完整性 | 126個公開檔案均與發布包一致，另保留_headers；無不一致 |
| 其他站點 | 86個非tanxiang-stable檔案與原正式版本位元組一致；主站、/tanxiang/、/tanxiang-v2/皆HTTP200且原標題保留 |
| 建置與靜態檢查 | 本頁為buildless靜態頁；node --check、git diff --check、所有本機資產／錨點、冷載入回歸通過 |

未重新建置與部署其他平台程式、Worker、資料庫或DNS。原站本來沒有交易／付款／預約，這次沒有加入。

## 效能

主圖WebP約238 KiB；字型子集約214 KiB；JS約6 KiB、CSS約20 KiB。微距縮圖採lazy，1536px放大圖開啟燈箱才載入；無影片、3D引擎或大型前端套件。實際瀏覽器能正常開啟與操作。未執行Lighthouse、網路限速／實機效能或正式Core Web Vitals量測，不宣稱特定分數。

## 正式截圖

- 桌面1366×1000：../../evidence/xiangyun/production-desktop.jpg
- 手機390×844：../../evidence/xiangyun/production-mobile.jpg
- 正式微距燈箱：../../evidence/xiangyun/production-lightbox.jpg
- 六尺寸量測：../../evidence/xiangyun/responsive-production.json
- 正式部署收據：../../evidence/xiangyun/production-after.json
- 原版本備份與對照：RELEASE.md、../../evidence/xiangyun/baseline-integrity.json
- 視覺對照及修正歷程：../../design-qa.md

## 尚待確認

所有主圖與六微距明確標AI概念示意，非實物照片。真實多角度／3D、原木產地與品種、老料年限、重量稀有度、教授文獻與實體機構功能均待資料。詳MATERIALS-NEEDED.md。

手機測試為瀏覽器指定尺寸與指標操作，非iOS／Android實機或雙指手勢實機測試。減少動態設定經程式碼檢查，未切換使用者系統偏好。未發送真實郵件，因此收信能力未驗證。四商品沿用原站低解析度共用照片，後續可補個別實拍。
