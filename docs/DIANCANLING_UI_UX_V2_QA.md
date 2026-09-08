# 點餐靈 UI／UX 全面修正 V2

## Scope

This release changes Android presentation and interaction layout only. It preserves the existing application ID, merchant authentication/session, merchant permissions, ordering domain, menu data, Room data, cart behavior, printer settings, and print queue.

## Root causes and corrections

1. Fixed-width horizontal KPI rows were replaced with available-width responsive rows: 2 × 2 on normal phones, one column for narrow/large-font layouts, and wider grids only when space allows.
2. Reports use the same responsive KPI layout, so revenue, order count, and average order value are fully visible.
3. Order mode is a separate responsive status/control region and moves as a whole when needed; its characters are never compressed vertically.
4. Merchant identity appears once in the shared header; Dashboard no longer repeats it as a large hero title.
5. The merchant-name row owns its width and truncates safely without pushing refresh/network actions away; tapping it opens the full name.
6. Page, surface, semantic status, radius, spacing, type, and dark-mode tokens are centralized in `DiningSpiritTheme.kt`.
7. Menu and POS product lists are the primary bounded lazy content and retain usable vertical space.
8. Phone POS uses a compact cart summary; the editable cart opens as a modal bottom sheet. Tablet POS uses split panes only from 720dp available width.
9. Offline state appears once below the app header. Bottom navigation applies its safe area once.
10. Light/dark system bar contrast is explicit and edge-to-edge content is inset by the shared scaffold.
11. Lazy content has bottom spacing and is not covered by fixed cart/navigation regions; instrumentation scrolls to the last menu item.
12. Status uses badges/semantic containers; actions use buttons or clearly tappable text with at least 48dp targets.

## Visual evidence

- Phone Home: `artifacts/ui-ux-v2/final/phone-393-font100/01-home.png`
- Phone Reports: `artifacts/ui-ux-v2/final/phone-393-font100/02-reports.png`
- Phone Menu: `artifacts/ui-ux-v2/final/phone-393-font100/03-menu.png`
- Phone Counter POS: `artifacts/ui-ux-v2/final/phone-393-font100/04-pos.png`
- Cart sheet: `artifacts/ui-ux-v2/final/phone-393-font100/05-cart-sheet.png`
- Keyboard open: `artifacts/ui-ux-v2/final/phone-393-keyboard/05b-cart-keyboard.png`
- Tablet split POS: `artifacts/ui-ux-v2/final/tablet-840x600-font100/06-pos-tablet.png`
- Offline: `artifacts/ui-ux-v2/final/states/07-offline.png`
- Dark mode: `artifacts/ui-ux-v2/final/phone-393-dark/01-home.png`
- 320dp / 2.0 font: `artifacts/ui-ux-v2/final/phone-320-font200/01-home.png`

## Responsive matrix

| Available width | Font scale | Result |
| --- | ---: | --- |
| 320dp | 2.0 | PASS — single-column KPI, merchant/action wrapping, menu action stacking |
| 360dp | 1.5 | PASS — phone navigation and product/cart layout |
| 393dp | 1.0 | PASS — all four primary screens, cart, keyboard, light/dark/offline |
| 412dp | 1.3 | PASS — all four primary screens and cart |
| 600dp | 1.5 | PASS — expanded single-pane layout |
| 840dp | 1.0 | PASS — navigation rail and POS two-column layout |

Loading, empty, offline, and retry copy uses explicit Traditional Chinese states. Demo screenshots are visibly marked `示範模式` and never write to Production.

## Verification

- Android unit tests, lint, and 11 emulator instrumentation tests: PASS.
- Login request/cookie regression: PASS through MockWebServer (`baiye_merchant_session` persistence asserted); no real merchant credentials were used.
- Order/menu navigation and mutations wiring: PASS in instrumentation/compile regression; no Production order was submitted.
- Mock printer output and printer settings navigation: PASS; XP-N160II physical printing remains pending.
- Cloudflare Worker suite: 430/430 PASS.
- TypeScript typecheck: PASS.
- Existing Web production build: PASS when run from the canonical worktree path.

## Package

- Version: `2.1.0-debug` (`versionCode 4`)
- Package: `com.baiye.merchantprinter.debug` (base application ID unchanged)
- Previous/new debug signing certificate SHA-256: `60de1edbae1de5be8cc69b2ca44aad509e1b492bfa1c4b22ecdb5017b404e4d7`
- APK SHA-256: `49F5D813666E15ADD462CA18D00BE42CB7E3F7841D98B9F255598E22B3D4CAB8`
