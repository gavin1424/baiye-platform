# Owner Admin Cloudflare Production 設定

Cloudflare Pages 專案為 `baiye-platform`。Custom Domain `admin.baiyeconnect.com`、Proxied DNS 與 Cloudflare Access Self-hosted Application 已完成正式設定。

## 1. DNS / Custom Domain（已完成）

1. Cloudflare Dashboard → Workers & Pages → `baiye-platform` → Custom domains。
2. 確認 `admin.baiyeconnect.com` 已存在；不要重複新增。
3. Cloudflare Dashboard → `baiyeconnect.com` → DNS → Records。
4. CNAME：Name `admin`，Target `baiye-platform.pages.dev`，Proxy status `Proxied`。不得切回 DNS-only，否則流量會繞過 Access。
5. 回到 Pages Custom domains，等待狀態成為 `Active` 且 SSL certificate 為 Active。
6. 驗證 `https://admin.baiyeconnect.com/` 直接顯示 Owner Login；`https://baiyeconnect.com/` 仍顯示公開首頁。

## 2. Cloudflare Access（已完成）

1. Cloudflare Zero Trust → Access → Applications → Add an application。
2. 選 `Self-hosted`，名稱 `創百業 Owner Admin`。
3. Application domain 為 `admin.baiyeconnect.com`，空白 Path 代表保護所有路徑。
4. Session duration 為 `30 minutes`（符合最多 4 小時要求）。
5. 建立 Allow policy，Include 僅選 `Emails`，值為 `www.asdfg14@gmail.com`。
6. 不可加入 Everyone、Email domain、Bypass 或 Service Auth public policy。
7. 此帳戶目前沒有可供 Access policy 選取的獨立 MFA method，因此未建立空白或無效的 MFA override。應用程式本身的 Google Authenticator TOTP 必須保留並強制執行。

## 3. 驗證

- 無痕視窗使用非允許 Email：必須停在 Cloudflare Access。
- 使用 `www.asdfg14@gmail.com`：通過 Access 後到 Owner Login。
- 完整鏈：Cloudflare Access → Owner Login → TOTP → `OWNER_ADMIN` Role Guard。
