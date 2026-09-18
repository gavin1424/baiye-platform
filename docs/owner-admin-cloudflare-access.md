# Owner Admin Cloudflare Production 設定

目前 Cloudflare Pages 專案為 `baiye-platform`。Custom Domain `admin.baiyeconnect.com` 已加入專案，但目前 Wrangler OAuth 沒有 DNS 或 Cloudflare Access 寫入權限。

## 1. 完成 DNS / Custom Domain

1. Cloudflare Dashboard → Workers & Pages → `baiye-platform` → Custom domains。
2. 確認 `admin.baiyeconnect.com` 已存在；不要重複新增。
3. Cloudflare Dashboard → `baiyeconnect.com` → DNS → Records。
4. 新增 CNAME：Name `admin`，Target `baiye-platform.pages.dev`，Proxy status `Proxied`。
5. 回到 Pages Custom domains，等待狀態成為 `Active` 且 SSL certificate 為 Active。
6. 驗證 `https://admin.baiyeconnect.com/` 直接顯示 Owner Login；`https://baiyeconnect.com/` 仍顯示公開首頁。

## 2. 建立 Cloudflare Access

1. Cloudflare Zero Trust → Access → Applications → Add an application。
2. 選 `Self-hosted`，名稱 `創百業 Owner Admin`。
3. Application domain 設為 `admin.baiyeconnect.com`，Path 設為 `/*`。
4. Session duration 設為 `4 hours`（不可更長）。
5. 建立 Allow policy，Include 僅選 `Emails`，值為 `www.asdfg14@gmail.com`。
6. 不可加入 Everyone、Email domain、Bypass 或 Service Auth public policy。
7. Identity provider 啟用可用 MFA；應用程式本身的 Google Authenticator TOTP 必須保留。

## 3. 驗證

- 無痕視窗使用非允許 Email：必須停在 Cloudflare Access。
- 使用 `www.asdfg14@gmail.com`：通過 Access 後到 Owner Login。
- 完整鏈：Cloudflare Access → Owner Login → TOTP → `OWNER_ADMIN` Role Guard。
