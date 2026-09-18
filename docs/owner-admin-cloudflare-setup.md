# Owner Admin Cloudflare production setup

Status: `MANUAL_CLOUDFLARE_ACCESS_REQUIRED`

The application and Owner API are implemented, but Cloudflare Access and MFA enrollment require an account owner to finish these steps in the Cloudflare dashboard. Never paste API tokens into this repository.

## 1. DNS

Create `admin.baiyeconnect.com` in the `baiyeconnect.com` zone. Point it at the same GitHub Pages origin used by `baiyeconnect.com`, with Cloudflare proxy enabled when supported by the current Pages/custom-domain arrangement.

## 2. Custom domain

Add `admin.baiyeconnect.com` as a verified custom domain for the deployed frontend. Confirm TLS is active before enabling the Access policy. The frontend automatically routes this hostname to `#/owner-admin`.

## 3. Cloudflare Access application

In Zero Trust → Access → Applications, add a self-hosted application for `admin.baiyeconnect.com/*`.

## 4. Allow policy

Create one Allow policy containing only the designated Owner email. Do not add broad email-domain, Everyone, Bypass, service-token, or public rules.

## 5. Admin email

The Production D1 owner mapping currently targets the existing authorized platform owner account. Verify the Access policy email exactly matches that account before enabling the application.

## 6. Session duration

Set the Access session duration to four hours or less. The internal Owner session also expires after four hours.

## 7. MFA

Require MFA in the Access identity policy. Separately generate a standard Base32 TOTP secret, enroll it in the Owner's authenticator, and save it on the dedicated `baiye-owner-admin-api` Worker as the secret `OWNER_ADMIN_TOTP_SECRET` using Cloudflare's secret management UI or `wrangler secret put`. Never store or commit the TOTP secret in source, D1, a normal environment variable file, screenshots, or tickets.

After setup, validate:

- an unauthenticated request to `https://admin.baiyeconnect.com` is stopped by Access;
- only the designated email passes Access;
- the internal login requires the Owner password plus current six-digit TOTP;
- merchant and customer sessions receive 403 from `/api/owner/*`;
- `robots` is `noindex,nofollow` and the Owner routes are absent from all public navigation.
