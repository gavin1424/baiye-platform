# Production Payment Promotion Drift Audit — 2026-09-11

This is an internal deployment record. It is not shipped as public website content.

## Read-only production snapshot

- `official-production-v2`: `daf7f0369fecfb0d8e96ca97fccb2201fa2de0d0`
- actual Pages deployment: `7f0e67a2-8bbe-4f3e-8ba3-39da4d792d13`
- actual Pages source: `930d544ca2926dbbbcfb390daa4e3927750b67be`
- actual Worker deployment: `9f1a6bda-ce72-4739-b20b-bca563ffde46`
- actual Worker version: `ef401515-2443-412f-b1c7-bbfa0acff8fd`
- Worker script etag: `d1bb85e9672e5fdd692e1015f1e1ec51977b7da575a99d8d1394fa61afa98884`
- Production D1: `baiye-finance` (`1662c6ab-57d7-4df7-8056-935fbead2d8c`)
- Production private contract R2 binding: `CONTRACTS_BUCKET` → `baiye-contracts`
- Production merchant asset R2 binding: `MERCHANT_ASSETS` → `baiye-merchant-assets`
- Production migration `0035_merchant_contract_payment_activation_v1.sql`: pending, not applied
- Production historical snapshot: 32 merchant signatures and 64 merchant contract artifacts

## Actual-production drift incorporated

The promotion branch retains the Common Contract Engine and payment work from
`ac25e513ba9b61439824719ced8db3f2ecafc032`, then ports the actual deployed
production behavior instead of replacing it with either divergent branch:

- Pages `930d544`: separate merchant-plan and partner-contract actions on the home signing card.
- Worker/ordering production line represented by `b7457b9`: XPrinter queue,
  ordering sync fixes, merchant storefront routing, menu price rendering, and
  guarded LINE LIFF ordering integration.
- Existing Production migration filenames `0027_xprinter_android_app_v1.sql`,
  `0028_ordering_spirit_operations_v1.sql`, and
  `0032_merchant_storefront_url_v1.sql` are retained because Production has
  already recorded them. They are not renamed or replayed.
- `0033_beef_noodle_line_liff_ordering_v1.sql` remains additive and guarded; it
  had not been applied in the read-only Production snapshot.

Shared-file conflict policy:

- Common Contract Engine, numeric-password auth, payment-required 423 gate,
  server-authoritative amounts, and historical evidence behavior remain from
  the payment branch.
- Deployed printer, storefront, and guarded LINE behavior are added without
  restoring the alternate plan-contract engine.
- Production environment bindings and coupon-disabled flag are retained.

## Legal approval targets

Approval is intentionally not performed by migration or deployment automation.
An authenticated platform administrator must open `/admin/contracts`, select
the merchant version, provide a real legal-counsel review reference, check the
explicit confirmation, and choose activation only after review.

| Contract version | Content hash | Current status | Approval audit action |
| --- | --- | --- | --- |
| `merchant_service_v1_3_18000_payment` | `fwnfNY8ugEVM88gnBj5ysjNb7m_jw6ZCALPvccF5N0U` | `pending_review` | `merchant_contract_legal_review_approved` |
| `merchant_commerce_ai_v1_1_50000` | `eIyetnwARQTc6fldFnS4NQJktKGJ_OzACpYVUYrX6r0` | `pending_review` | `merchant_contract_legal_review_approved` |
| `merchant_softpos_v1_1_24000_payment` | `D_jCMCLkfs_bnEDyrUumImJPKjZpWLCZlvWtAyRX2_0` | `pending_review` | `merchant_contract_legal_review_approved` |

The approval API pins `approved_content_hash` to the reviewed `content_hash`,
records `reviewed_by`, `reviewed_at`, and `legal_counsel_reference`, and writes
an audit record. Any content-hash change invalidates the deployment gate.

## JKOPAY production asset candidate

- supplied file: `1-Photo-1.jpg`
- format: JPEG, 854 × 1280, 24-bit RGB
- file SHA-256: `77A9C634A6836724481839D5DA1A283B7E0BF7F74FBDCD7C3E9595A556CD3379`
- QR decoding: successful; TWQRP scheme
- displayed recipient: `百工百業`
- displayed JKOPAY code/account: `396` / `901053614`
- decoded payload contains the displayed account and code

The image is a candidate until an authorized administrator confirms the
recipient and registers it through `/admin/merchant-payments`. The existing
upload endpoint validates MIME and magic bytes, stores the object in private
`CONTRACTS_BUCKET` under
`platform-payment-assets/jkopay_manual_qr/official-<content-hash>.jpg`, enables
the provider configuration, and writes `PAYMENT_PROVIDER_CONFIGURED` audit.
No deep link is derived from the QR payload.

## Stop conditions

Production migration and deployment remain blocked until:

1. all three exact content hashes receive genuine legal approval;
2. the supplied JKOPAY recipient is confirmed and the asset is registered by an authorized admin;
3. the integrated baseline is redeployed and fully retested on Staging;
4. historical PDF and artifact hashes remain unchanged.

## Drift-integrated Staging verification

- integrated baseline: `9b49f2e693fa423b7c9c066840b3088389c81ae1`
- Staging Worker version: `6e01c8cc-c3e2-40a0-a91e-98628ee410ab`
- Staging Pages deployment: `749ba7e0-4745-443d-a539-c4797bb66ef8`
- Staging Pages source: `9b49f2e`
- private QR asset key: `platform-payment-assets/jkopay_manual_qr/official-d6nGNKaDZyRIGDnV2hooO34L9_dPvc18PpWVpVbNM3k.jpg`
- R2 upload/download SHA-256: `77A9C634A6836724481839D5DA1A283B7E0BF7F74FBDCD7C3E9595A556CD3379` (exact match)
- provider status: enabled in Staging; deep link absent and not inferred
- three-plan live smoke: passed through signed/pending-payment, QR retrieval,
  evidence/PDF generation, and payment-evidence submission
- live signature dues: standard `1800000`, commerce AI `5000000`, SoftPOS `600000`
- SoftPOS remaining after three-month trial: `1800000`
- drift-integrated PDF hashes:
  - standard: `0pfGcRw7xb5Ek2nNa2EhEbfYdX0u171EP4MtZNzAOMc`
  - commerce AI: `HRFjkanLLFUUni6fhm0XKuZP43qFzZhfiwLePHD3D-M`
  - SoftPOS: `dAOUoPFtNDKHQ82ajrJ6TLexnIa_hx4CcF405NPRTtw`
- visual PDF review: every generated page was rasterized; titles, bold Traditional
  Chinese, payment schedules, signature pages, and verification sections rendered correctly
- automated checks: typecheck and production build passed; Worker 699 passed,
  1 skipped, 0 failed; contractor policy 5/5; commerce 11/11; ordering UI 1/1

This verification does not satisfy the genuine legal-approval requirement and
does not authorize a Production migration or deployment.
