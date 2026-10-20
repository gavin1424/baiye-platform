# Issue #65 — Android 白模與材質就緒保護

此分支只更新香雲冷香館的 **Cloudflare 預覽**，不修改正式站路由、會員資料庫、金流或其他品牌。

## 確認的缺口與修正

- 舊版在 model-viewer `load` 事件就顯示模型；該事件不足以證明色彩貼圖已解碼及成功渲染。失敗時白色 baseColorFactor 可能被直接曝光。
- 新版從公開 GLB 取得內容，核對 SHA256 及 PNG 資料，再透過 model-viewer 官方 `createTexture` 的 TextureLoader／HTMLImageElement 路徑重建原始 PBR。原圖、GLB 幾何、三張 PBR 的原始位元組與顏色沒有重製。
- 色彩、法線及 ORM 都要存在、能解碼，且實際渲染畫面有礦石色彩及明暗對比，才移除照片遮罩並解鎖操作。否則保留商品圖、停用操作並提供重試。
- 控制 GPU 模型快取數為 1；切款、逾時、離頁及載入競態會取消過期工作與釋放臨時圖片 URL。WebGL context lost 時回到照片。
- 公開 `/tanxiang-stable/v1/diagnostics-3d` 可記錄真正部署的 HTTP／雜湊、WebGL、解碼路徑與材質，資料留在瀏覽器，不自動上傳。包括原始貼圖遺失後的恢復演練，以及無法驗證時保留照片的演練。

**Android 原始觸發原因仍需出現問題的實機確認。** 桌面有色不等同 Android 驗收通過，也不將模擬器或 viewport 錄影稱為實機。

## 可追蹤來源

GitHub：`gavin1424/baiye-platform`，預覽修復來源分支：`fix/issue65-android-preview`。

先前 `4b56acc...` 為未推送的本機提交，不是 GitHub 已存在的部署來源。此分支以 GitHub 原 HEAD 為父提交，只合併 `scripts/xiangyun-source-paths.json` 所列品牌程式及公開資產，不推送本機其他歷史。

`build-info.json` 在封裝時產生，記錄公開來源 commit、分支、材質 manifest 雜湊與 client build。指定 `XIANGYUN_SOURCE_COMMIT` 時，封裝器會核對 GitHub 分支及工作目錄來源，拒絕不一致版本。實際 Cloudflare ID 由 `CF_VERSION_METADATA` 回應為 `X-Xiangyun-Deployment`，來源另以 `X-Xiangyun-Source-Commit` 回應；不以本機 SHA 代替線上版本。

## 重建預覽

需求：Node.js 22.13+、npm、Git，以及由使用者自行登入的 Cloudflare Wrangler。沒有金鑰或資料庫快照存入 Git。

```powershell
git clone --branch fix/issue65-android-preview https://github.com/gavin1424/baiye-platform.git
cd baiye-platform
npm --prefix cloudflare-worker ci --ignore-scripts
node --test cloudflare-worker/tests/material-readiness-issue65.test.mjs
node scripts/xiangyun-preview-build.mjs
$env:XIANGYUN_SOURCE_COMMIT = git rev-parse HEAD
$env:XIANGYUN_SOURCE_BRANCH = 'fix/issue65-android-preview'
node scripts/lingstone-release-package.mjs
npx --prefix cloudflare-worker wrangler deploy --config cloudflare-worker/wrangler.lingstone-preview.jsonc --var "XIANGYUN_SOURCE_COMMIT:$env:XIANGYUN_SOURCE_COMMIT"
```

預覽 Worker：`baiye-lingstone-v1-preview`，routes 保持空陣列；獨立 Durable Object 與 R2 維持既有設定。正式 Worker 不在此次部署範圍。
