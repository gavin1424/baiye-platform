# 發布與回復

- Git repository: https://github.com/gavin1424/baiye-platform.git
- 原來源基準: bea5465a0adc928e0c061551e4bc3063ab098677
- 改版分支: codex/xiangyun-pavilion-20261010
- 備份 Tag: backup/tanxiang-pre-redesign-20261010
- 原正式 Cloudflare Pages: baiye-platform / 0f211f06-25a7-4c5a-ad17-456ac413f37b
- 原部署 metadata標記141dfe7/main/dirty；因此沒有盲目重建整站。已將現行正式部署87個公開檔案逐一與既有dist/client比對，全部內容一致；_headers另保留原檔。
- 部署基礎備份: C:/Users/wwwas/Desktop/網站/production-backups/xiangyun-20261010/baseline-client/
- 發布包: dist/xiangyun-release，以上述正式包加上public/tanxiang-stable，86個非目標檔案位元組相同。沒有部署Worker、DB、DNS或其他網站原始碼。
- Cloudflare production分支參數main僅用於選擇既有正式環境，Git仍在獨立改版分支，不合併／重設本機main。

## 回復

若需回復，可透過Cloudflare Pages選擇原部署0f211f06執行回復，或將上列baseline-client重新發布到相同專案。回復整個Pages部署前需確認之後沒有他人新的正式更新，避免回退其他人的工作。

## 本次範圍

獨立靜態頁使用外部CSS／JS及自託管圖像、字型，符合原正式CSP。原有#top、#products、#story、#features、#faq、#contact錨點保留；四商品所有原有名稱、標籤、描述、價格、原圖及客服信箱保留。

真實收信、實體機構、香氣、品種、產地及學術資料不在已驗證範圍。參見MATERIALS-NEEDED.md。
