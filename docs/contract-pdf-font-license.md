# Contract PDF embedded font

- Font family: Noto Sans TC
- Font files: `NotoSansTC-Regular-ContractSubset.ttf`, `NotoSansTC-Bold-ContractSubset.ttf`, `NotoSansMono-Regular.ttf`
- Upstream project: Google Fonts / Noto Sans TC
- Upstream source: https://github.com/google/fonts/tree/main/ofl/notosanstc
- License: SIL Open Font License 1.1
- License source: https://github.com/google/fonts/blob/main/ofl/notosanstc/OFL.txt
- Source version: Google Fonts `NotoSansTC[wght].ttf`, retrieved 2026-09-02
- Static instance generation: weight 400 and 700 generated with FontTools `varLib.instancer`; naming records normalized without changing outlines
- Regular asset preparation: the Regular static instance is subset offline with FontTools from the Traditional Chinese Big5 repertoire plus repository contract text, renderer labels, and punctuation regression corpus (13,808 Unicode characters).
- Bold asset preparation: the Bold static instance is subset offline with FontTools from the Traditional Chinese Big5 repertoire plus repository contract text, renderer labels, and punctuation regression corpus (13,808 Unicode characters). A contract text change must regenerate both deployed assets and update their integrity hashes before release.
- Regular asset SHA-256: `3cfa5b78cf780a7e7cf8d64cc7a6c22f6c39bd5fdab2c3cc6e8874b409c23a65`
- Bold asset SHA-256: `0ef5af4ec41b6f50d784e193c662cdc8f971fc7691ea5d9394d6e133a4834dac`
- Monospace asset SHA-256: `b4563af6f013732c8f40d206a05ff2ffc4eaeac0020d39393e59d0cf8a3ffeed`
- Private R2 keys:
  - `contract-assets/fonts/NotoSansTC-Regular-ContractSubset.ttf`
  - `contract-assets/fonts/NotoSansTC-Bold-ContractSubset.ttf`
  - `contract-assets/fonts/NotoSansMono-Regular.ttf`
- Add-on V2 agreements use a smaller mechanical subset of the same OFL-licensed Noto Sans TC source so PDF generation stays within the Worker CPU budget:
  - Regular SHA-256: `862584925bb6ff916a1efa76d88b293182d6893c74b57f7f69424a570b4e9172`
  - Bold SHA-256: `1dcb7de1dbfffc0f85a0ba16f5567a9f8cf36a1f3afa0ab2ba0e70fd136e12af`
  - `contract-assets/fonts/NotoSansTC-Regular-AddonV2.ttf`
  - `contract-assets/fonts/NotoSansTC-Bold-AddonV2.ttf`

The fonts are loaded from private R2 and embedded in each generated PDF. They are not exposed through a public URL and are not encoded as JavaScript Base64. Runtime full embedding of the pre-subset assets is intentional: the currently pinned `pdf-lib`/`fontkit` combination produced invalid CJK glyph mapping when its runtime subsetter was enabled. FontTools performs deterministic offline subsetting, while `pdf-lib` embeds the validated font programs without runtime remapping. Poppler extraction and visual QA verify all embedded TrueType programs.
