# 香雲冷香館 V2.2・五支品牌短片工程

五支 24 秒直式影片（1080×1920／30fps），另有第一支 1920×1080 橫式版。H.264/yuv420p、AAC 原創環境音樂、faststart。影片有內嵌繁體中文字幕，另交 SRT/VTT；沒有 TTS 或人聲配音。

## 可重現流程

從 repository 根目錄執行。需要 Node.js >=22、Chrome、FFmpeg/FFprobe、Python 及 numpy==2.3.5。HyperFrames 鎖定 0.8.181，GSAP 3.14.2。下列工具安裝於被忽略的 data 資料夾，不修改網站的依賴：

```powershell
npm install --prefix data/lingstone/tooling/hyperframes hyperframes@0.8.181 --no-audit --no-fund
# 只在需要重新錄屏時安裝 Playwright；先設定 PLAYWRIGHT_MODULE 為其模組位置。
# node scripts/issue69-capture.cjs
node scripts/issue69-author.cjs
python scripts/issue69-music.py
node scripts/issue69-render.cjs
```

若 Chrome 不在 Windows 標準路徑，錄屏腳本可透過 CHROME_PATH 指定；HyperFrames 自動尋找系統或官方 bundled Chrome。錄屏來源為公開 Cloudflare 預覽站，沒有假 API。示範生日 1990-06-15 10:30 是合成測試資料，沒有登入顧客帳號、提交洽詢或保存出生資料。

`issue69-author.cjs` 產生分鏡、字幕及六個可編輯 HyperFrames HTML 版本。`issue69-render.cjs` 逐一將 variants 置入唯一 root index（最後還原第一支），執行 lint/runtime/layout/contrast check、渲染 MP4、合併原創音軌、ffprobe 檢查、完整解碼與三張抽幀。只有六支都成功時才產出公開 manifest 並開啟 PROMO_RELEASE_READY。不要平行執行兩個渲染腳本，以免共用 index 衝突。

`SHOW_VIDEO` 沿用既有入口，但改由此完成檢查旗標控制；畫廊只列出新的五支作品，不曝光原先未完成的十集。影片為點擊播放、延後載入、一次只播放一支；封面與按鈕介面支援繁／簡／英／日。成片與字幕語言只有繁中，並未宣稱四語配音。

## 素材與真實性

詳見 LICENSE-SOURCES.json、DESIGN.md 及 storyboards.json。十款圖是既有業主提供的 AI 概念素材；網站 3D 是模擬展示，不是實物掃描。現有東方情境圖為本專案先前原創生成素材。沒有把任何圖宣稱為已核實的原礦實拍、家族歷史照片或檢測證據。家族敘事僅沿用既有網站的口述與待核實定位，不展示模糊 XRF 數值、偽造 QR 或證書。

本次原創音軌由 script 合成正弦泛音、五聲音階與延遲效果，不採用第三方歌曲、旋律、人聲或錄音取樣。Noto 字型為 SIL OFL；GSAP 標準授權連結與檔頭保留。既有業主素材授權限於此品牌用途，不代表對外重新授權或獨占著作權。

## 發布邊界

只更新 baiye-lingstone-v1-preview Worker，正式 Worker、資料庫、商品價格、模型、會員與付款限制不變。業主驗收成片後才另行授權正式發布。可回滾到製作前預覽 Worker version fb4ee475-f26f-4539-9821-3067104a8d47。
