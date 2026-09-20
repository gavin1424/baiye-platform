# 百工牛肉麵圖片稽核

稽核日期：2026-09-20  
範圍：正式 QR 點餐菜單、品牌首頁 Hero、招牌推薦卡片  
驗收規格：菜名相符、無浮水印、無他牌 Logo、無拉伸、主體清楚、手機卡片可安全裁切為 4:3。

## 結果摘要

| 指標 | 改版前 | 改版後 |
|---|---:|---:|
| 公開商品圖片指派 | 22 | 20 |
| 唯一來源檔 | 7（3 JPEG、4 SVG） | 20 WebP |
| PASS | 0 | 20 |
| REPLACE | 20 | 0 |
| MISSING | 0 | 0 |
| DUPLICATE 指派 | 19（4 張 SVG 重複套用） | 0 |
| WRONG_DISH / 非餐點實拍 | 20 | 0 |
| 非正式菜單商品 | 2 | 0 |

> 改版前的「招牌紅燒牛肉麵」上傳檔實際為店內鏡面自拍，不是餐點照，因此依 `WRONG_DISH` 處理。兩個非正式菜單品項「飯類」「雞腿便當」已自公開菜單封存，未拿其他料理圖冒充。

## 逐品項稽核

| 分類 | 商品 | 改版前 | 判定 | 改版後圖片 | 尺寸／比例 | 最終 |
|---|---|---|---|---|---|---|
| 牛肉麵 | 招牌紅燒牛肉麵 | 店內鏡面自拍 JPEG | WRONG_DISH | `signature-braised-beef-noodles.webp` | 1448×1086 / 4:3 | PASS |
| 牛肉麵 | 半筋半肉牛肉麵 | `tendon-bowl.svg` | DUPLICATE, REPLACE | `half-tendon-beef-noodles.webp` | 1200×900 / 4:3 | PASS |
| 牛肉麵 | 滿滿牛肉麵 | `braised-bowl.svg` | DUPLICATE, REPLACE | `extra-beef-noodles.webp` | 1200×900 / 4:3 | PASS |
| 牛肉麵 | 清燉牛肉麵 | `tendon-bowl.svg` | DUPLICATE, REPLACE | `clear-broth-beef-noodles.webp` | 1200×900 / 4:3 | PASS |
| 牛肉麵 | 牛筋麵 | `tendon-bowl.svg` | DUPLICATE, REPLACE | `beef-tendon-noodles.webp` | 1200×900 / 4:3 | PASS |
| 乾麵／拌麵 | 紅油牛肉乾拌麵 | `dry-noodle.svg` | DUPLICATE, REPLACE | `chili-beef-dry-noodles.webp` | 1200×900 / 4:3 | PASS |
| 乾麵／拌麵 | 麻醬麵 | `dry-noodle.svg` | DUPLICATE, REPLACE | `sesame-noodles.webp` | 1200×900 / 4:3 | PASS |
| 乾麵／拌麵 | 紅燒牛肉燴飯 | `braised-bowl.svg` | WRONG_DISH, DUPLICATE | `braised-beef-rice.webp` | 1200×900 / 4:3 | PASS |
| 小菜 | 滷蛋 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `braised-egg.webp` | 1200×900 / 4:3 | PASS |
| 小菜 | 燙青菜 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `blanched-greens.webp` | 1200×900 / 4:3 | PASS |
| 小菜 | 滷豆干 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `braised-tofu.webp` | 1200×900 / 4:3 | PASS |
| 小菜 | 涼拌小黃瓜 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `cucumber-salad.webp` | 1200×900 / 4:3 | PASS |
| 小菜 | 牛肚拼盤 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `beef-tripe-platter.webp` | 1200×900 / 4:3 | PASS |
| 湯品 | 牛肉湯 | `braised-bowl.svg` | WRONG_DISH, DUPLICATE | `beef-soup.webp` | 1200×900 / 4:3 | PASS |
| 湯品 | 貢丸湯 | `braised-bowl.svg` | WRONG_DISH, DUPLICATE | `meatball-soup.webp` | 1200×900 / 4:3 | PASS |
| 湯品 | 酸辣湯 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `hot-sour-soup.webp` | 1200×900 / 4:3 | PASS |
| 飲品 | 古早味紅茶 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `black-tea.webp` | 1200×900 / 4:3 | PASS |
| 飲品 | 冬瓜茶 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `winter-melon-tea.webp` | 1200×900 / 4:3 | PASS |
| 飲品 | 無糖茶 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `unsweetened-tea.webp` | 1200×900 / 4:3 | PASS |
| 飲品 | 梅子冰茶 | `side-dish.svg` | WRONG_DISH, DUPLICATE | `plum-iced-tea.webp` | 1200×900 / 4:3 | PASS |
| 測試分類 | 飯類 | 使用者上傳直式 JPEG | 非正式菜單 | 已封存，不公開 | — | REMOVED |
| 測試分類 | 雞腿便當 | 使用者上傳直式 JPEG | 非正式菜單 | 已封存，不公開 | — | REMOVED |

## 自動檢查

- 20 張正式菜單圖皆為 4:3、WebP，19 張為 1200×900，Hero 為 1448×1086。
- 圖片使用 `object-fit: cover`，不做非等比拉伸。
- SHA-256 逐檔檢查不得重複。
- 頁面以商品名稱作為 `alt`，無浮水印、文字或其他店家 Logo。
- 手機 360 / 390 / 412 / 430 px 皆以單欄全寬圖片卡驗證；圖片顯示寬度為容器可用寬度。

## 檔案位置

正式圖片：`public/assets/beef-noodle-menu/`  
改版前截圖：`design-audit/before/`  
改版後截圖：`design-audit/after/`
