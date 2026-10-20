# 一石一碼與白話檢測：預覽來源

本次只部署 `baiye-lingstone-v1-preview`，正式 Worker `baiye-lingstone-v1` 保持已驗收 V1.9.4。付款與未完成影片維持關閉。不共用其他品牌服務。

## 來源與重建

GitHub `gavin1424/baiye-platform`，發布來源分支 `fix/issue67-preview`。先前已驗收來源為 `c463db11f9b9ee1aeb1e66fedbf6fb92cd069a0c`。新分支只更新來源清單 `scripts/xiangyun-source-paths.json` 中的品牌程式與測試，不推送本機其他專案歷史。建置前先安裝 Node22.13+，執行：

```powershell
npm --prefix cloudflare-worker ci --ignore-scripts
node --test cloudflare-worker/tests/stone-passport-v20.test.mjs cloudflare-worker/tests/material-readiness-issue65.test.mjs cloudflare-worker/tests/xiangyun.test.mjs cloudflare-worker/tests/collection-v17.test.mjs cloudflare-worker/tests/catalog-v4.test.mjs cloudflare-worker/tests/models-v19.test.mjs
node scripts/xiangyun-preview-build.mjs
$env:XIANGYUN_SOURCE_COMMIT = git rev-parse HEAD
$env:XIANGYUN_SOURCE_BRANCH = 'fix/issue67-preview'
node scripts/lingstone-release-package.mjs
npx --prefix cloudflare-worker wrangler deploy --config cloudflare-worker/wrangler.lingstone-preview.jsonc --var "XIANGYUN_SOURCE_COMMIT:$env:XIANGYUN_SOURCE_COMMIT"
```

封裝器核對遠端 commit 與工作來源。每次封裝先將舊 build 原封改名備份，再從目前 public 原始檔建立新包，避免已退場檔案因增量拷貝殘留。不要執行歷史模型產生器覆蓋已驗收紋理。

## 舊編碼退場

- 商品資料庫主鍵、舊 `serial` 與歷史 `catalog_sku` 不刪除；僅 server-only `identity-v20.js`、`legacy-designs-v17.js`、舊匯入資料保留相容用途。
- 公開設計 ID 改為 opaque `art-…`。API 進出邊界轉換 ID；舊商品深連結308導向同一款，舊瀏覽器洽詢選擇會向伺服器解析後轉換。歷史會員、收藏與洽詢仍連原始資料列。
- 這些 art ID 是程式內部關聯識別，不作對外典藏編號。概念卡／詳情／3D顯示「實物編號待建檔」；十款不冒充十顆實物。
- 公開 JS/JSON/HTML、下載內容與GLB中繼資料沒有舊展示碼。十顆GLB僅移除舊編碼中繼資料，幾何及PBR的BIN chunk逐位元組一致，PNG與原照片不變；因此整檔SHA及URL有更新。

## 資料模型與安全

DO內 `xy_schema=4` 自動執行新增 migration；[SQL審閱副本](../../../cloudflare-worker/migrations/0042_xiangyun_stone_passports.sql) **只供品牌DO使用，不要套用平台D1**。

- 新增系列計數器、實物、照片、文件、檢測、測量位置、元素讀值、操作紀錄與冪等請求資料表。
- `transactionSync` 原子配置每系列編號；最少3位，999後接1000。資料庫觸發器禁止改號、刪除實物、倒退或刪除計數器。
- 更改文化主題使用獨立 `cultural_theme` 欄位與版次稽核，永久編號不變。CSV先預檢，不配置號碼；匯入整批單一交易，失敗不留部分登錄。
- 單件有自己的真實重量、尺寸、價格、狀態與可選款式外鍵；沒有資料維持null，不繼承概念圖價格作實物證明。
- 管理API沿用 `requireBrandAdmin`、品牌session/CSRF及速率限制。沒有增加公開管理密鑰或驗證繞過。
- 照片經瀏覽器重編碼WebP移除位置中繼資料，伺服器核對格式；文件上傳需明確確認公開內容不含私密資料。R2原始key、審核人員、客戶、訂單與精確礦脈不出現在公開API。
- 真實履歷公開須有經人工確認的本顆正面實拍；草稿404，撤回後410且保留號碼。證書與媒體no-store，撤回即停公開。
- 個別檢測必須綁定本石的已確認公開原始文件；跨石文件／照片拒絕，歷史 `ls_xrf` 不自動帶入。多測量位置要求照片與座標，不生成全石金屬熱度圖。

## 預覽測試資料

只有同時設定 `XIANGYUN_STONE_TEST_MODE=1`、`XIANGYUN_DEPLOYMENT_CHANNEL=preview` 且非production store時，才建立六筆合成預覽資料：MET-001（未測量）、MET-002（單點）、WOD-001（雙點），另有WAT/FIR/EAR示例。它們不連結十張概念圖，不是真實原石、不發正式藏卡。圖卡、PDF與頁面皆明示測試；未知尺寸／重量不填造。

`/certificate/{code}` 可首次直接開啟，無登入；QR只含該頁HTTPS URL。SVG/PNG下載、列印履歷與QR標籤可用。QR可被複製，不保證實物真偽。此為本館自行登錄履歷，不是第三方鑑定。

## Migration備份與回滾

套用schema4前，DO如支援會取得SQLite PITR bookmark，與套用時間寫入私有KV `registry_v20_migration`，僅管理員 `/admin/stones/migration` 可讀。這不是公開備份連結。

預覽回滾版本：`31b0e620-b073-4ead-aa3f-19dc0279f661`：

```powershell
npx --prefix cloudflare-worker wrangler rollback 31b0e620-b073-4ead-aa3f-19dc0279f661 --config cloudflare-worker/wrangler.lingstone-preview.jsonc --yes --message "Preview incident rollback"
```

一般回滾只退Worker／資產，**不DROP新表、不重設計數器、不整庫還原**。新號碼與操作紀錄永久保留；舊UI暫不支援新履歷，恢復新版後仍對應原石。PITR只供事故復原評估，需保留所有已發號碼後再處理，不能讓編號重新配置。

Android相機掃碼／實機錄影需要已連接實體裝置；桌面390/430px與QR解碼工具不能代替該項驗收。實際公開預覽測試與截圖在交付報告另列，不以本機單元測試代替線上通過。
