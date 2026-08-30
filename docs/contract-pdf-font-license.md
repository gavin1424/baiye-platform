# Contract PDF embedded font

- Font family: Noto Sans TC
- Font files: `NotoSansTC-Regular.ttf`, `NotoSansTC-Bold.ttf`, `NotoSansMono-Regular.ttf`
- Upstream project: Google Fonts / Noto Sans TC
- Upstream source: https://github.com/google/fonts/tree/main/ofl/notosanstc
- License: SIL Open Font License 1.1
- License source: https://github.com/google/fonts/blob/main/ofl/notosanstc/OFL.txt
- Source version: Google Fonts `NotoSansTC[wght].ttf`, retrieved 2026-08-30
- Static instance generation: weight 400 and 700 generated with FontTools `varLib.instancer`; naming records normalized without changing outlines
- Regular asset SHA-256: `8852d31b7b0cfeab998be117830576c93e14518e4020c11b71919df1e7bdb111`
- Bold asset SHA-256: `0b86423512b2398fde89fbff62009172ce44a62c8dfe27d4b356b11e03d11adb`
- Monospace asset SHA-256: `44cc404d8cea929c02a92900a646598bafc9ef726b7d881e7525296adc9fb8ac`
- Private R2 keys:
  - `contract-assets/fonts/NotoSansTC-Regular.ttf`
  - `contract-assets/fonts/NotoSansTC-Bold.ttf`
  - `contract-assets/fonts/NotoSansMono-Regular.ttf`

The fonts are loaded from private R2 and embedded in each generated PDF. They are not exposed through a public URL and are not encoded as JavaScript Base64. Full embedding is intentional: the currently pinned `pdf-lib`/`fontkit` combination produced invalid CJK glyph mapping when its runtime subsetter was enabled; Poppler and visual QA verify the full embedded TrueType programs.
