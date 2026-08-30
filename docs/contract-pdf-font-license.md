# Contract PDF embedded font

- Font family: Noto Sans TC
- Font files: `NotoSansTC-Regular-ContractSubset.ttf`, `NotoSansTC-Bold-ContractSubset.ttf`, `NotoSansMono-Regular.ttf`
- Upstream project: Google Fonts / Noto Sans TC
- Upstream source: https://github.com/google/fonts/tree/main/ofl/notosanstc
- License: SIL Open Font License 1.1
- License source: https://github.com/google/fonts/blob/main/ofl/notosanstc/OFL.txt
- Source version: Google Fonts `NotoSansTC[wght].ttf`, retrieved 2026-08-30
- Static instance generation: weight 400 and 700 generated with FontTools `varLib.instancer`; naming records normalized without changing outlines
- Regular asset preparation: the Regular static instance is subset offline with FontTools from the Traditional Chinese Big5 repertoire plus repository contract text, renderer labels, and punctuation regression corpus (13,808 Unicode characters).
- Bold asset preparation: the Bold static instance is subset offline with FontTools from the repository's contract versions, renderer headings, labels, and regression corpus (608 Unicode characters). A contract text change must regenerate both deployed assets and update their integrity hashes before release.
- Regular asset SHA-256: `6f228a0415ada99b413bca4e9ee44c89851a1e7ff7c831f5f55731db4a8f7cf6`
- Bold asset SHA-256: `b2219c4e23f99230a90ecef0624c877129f36e3187b926529e51207dc71ed1ff`
- Monospace asset SHA-256: `44cc404d8cea929c02a92900a646598bafc9ef726b7d881e7525296adc9fb8ac`
- Private R2 keys:
  - `contract-assets/fonts/NotoSansTC-Regular-ContractSubset.ttf`
  - `contract-assets/fonts/NotoSansTC-Bold-ContractSubset.ttf`
  - `contract-assets/fonts/NotoSansMono-Regular.ttf`

The fonts are loaded from private R2 and embedded in each generated PDF. They are not exposed through a public URL and are not encoded as JavaScript Base64. Runtime full embedding of the pre-subset assets is intentional: the currently pinned `pdf-lib`/`fontkit` combination produced invalid CJK glyph mapping when its runtime subsetter was enabled. FontTools performs deterministic offline subsetting, while `pdf-lib` embeds the validated font programs without runtime remapping. Poppler extraction and visual QA verify all embedded TrueType programs.
