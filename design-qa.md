# 點餐靈 UI／UX V2 — Design QA

## Evidence

- Reference screenshots: user-provided `Photo 1.jpg` through `Photo 5.jpg` in the task attachments.
- Implementation screenshots: `artifacts/ui-ux-v2/final/`.
- Primary phone viewport: 393dp, font scale 1.0, light mode (1080 × 2400 px emulator capture at 440 dpi).
- Tablet viewport: 840 × 600dp, font scale 1.0, light mode (1680 × 1200 px at 320 dpi).
- Density normalization: references vary in pixel size and are problem evidence rather than a clone target. Comparisons therefore use content hierarchy, available-width behavior, safe areas, typography, and interaction affordance rather than pixel-for-pixel matching.

## Comparison history

### Iteration 1

- Home/reference: fixed-width horizontal KPI content clipped on phone; merchant identity was repeated; connection and order mode competed in one row.
- Reports/reference: fixed KPI row exposed only part of the average-order card.
- Menu/reference: title/action and product/action rows could squeeze names; list content competed with fixed bottom areas.
- POS/reference: permanently expanded cart reduced the product viewport; bottom cart/navigation regions risked overlap.
- Shared shell/reference: offline state was repeated at the top and bottom, system insets were applied inconsistently, and status/action styling was ambiguous.

Implemented responsive rows, a single app scaffold, explicit insets, one compact offline banner, separate status and action treatments, a phone cart sheet, and a tablet split layout.

### Iteration 2

- 320dp at 2.0 font scale exposed remaining pressure in title/action and product/action rows.
- Tablet showed a duplicate brand label in the navigation rail.

Moved actions below content when width/font scale requires it and removed the duplicate tablet brand.

### Final inspection

- Full-view comparisons completed for Home, Reports, Menu, POS, cart sheet, keyboard-open cart, offline state, dark mode, 320dp/2.0 font, and 840dp tablet POS.
- Focused checks: KPI boundaries, long merchant and item names, bottom-list reachability, cart/nav coexistence, IME avoidance, state/action distinction, and system-bar contrast.
- No actionable P0, P1, or P2 visual/usability defects remain in the requested scope.

## Result

passed
