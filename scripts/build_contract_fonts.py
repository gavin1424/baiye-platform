from pathlib import Path
import argparse

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def contract_corpus_codepoints(root: Path) -> set[int]:
    codepoints: set[int] = set()
    required = "創百業智慧鏈商家服務合作契約承攬夥伴合作契約智慧商務智慧點餐免 POS三個月試用正式服務保證金抵約契約簽署法定姓名簽署時間電子簽名文件驗證資訊葉耀仁陳靈有限公司104臺北市中山區江山里民生東路三段57號～"
    codepoints.update(map(ord, required))
    relative_paths = [
        "cloudflare-worker/src/contract-pdf-v2.js",
        "cloudflare-worker/src/commerce-ai-contract.js",
        "cloudflare-worker/src/commercial-catalog.js",
        "cloudflare-worker/src/merchant-contracts.js",
        "cloudflare-worker/src/merchant-softpos-plan.js",
        "cloudflare-worker/src/merchant-standard-terms.js",
        "cloudflare-worker/src/partner.js",
        "cloudflare-worker/migrations/0018_partner_contract_v15_identity_term.sql",
        "cloudflare-worker/migrations/0023_contract_commerce_ai_45000.sql",
        "cloudflare-worker/migrations/0024_contract_softpos_24000.sql",
        "cloudflare-worker/migrations/0025_contract_standard_addons.sql",
        "cloudflare-worker/migrations/0026_unified_registration_contract_center.sql",
        "cloudflare-worker/migrations/0035_merchant_contract_payment_activation_v1.sql",
        "cloudflare-worker/migrations/production_0032_unified_contract_center_approval.sql",
    ]
    for relative_path in relative_paths:
        path = root / relative_path
        codepoints.update(map(ord, path.read_text(encoding="utf-8", errors="ignore")))
    return codepoints


def build(source: Path, output: Path, weight: int, codepoints: set[int]) -> None:
    font = instantiateVariableFont(TTFont(source, recalcTimestamp=False), {"wght": weight}, inplace=False)
    style = "Bold" if weight >= 700 else "Regular"
    family = "Noto Sans TC Contract"
    postscript = f"NotoSansTCContract-{style}"
    for name_id, value in ((1, family), (2, style), (4, f"{family} {style}"), (6, postscript)):
        font["name"].setName(value, name_id, 3, 1, 0x409)
        font["name"].setName(value, name_id, 1, 0, 0)
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_legacy = True
    options.name_languages = [0x409, 0x404]
    options.notdef_outline = True
    options.recommended_glyphs = True
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font["head"].created = 3786912000
    font["head"].modified = 3786912000
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build immutable Traditional Chinese contract fonts.")
    parser.add_argument("source", type=Path, help="Noto Sans TC variable font")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--common-output-dir", type=Path, help="Also emit a static Regular face covering CP950 level-one common ideographs.")
    args = parser.parse_args()
    fixtures = args.root / "cloudflare-worker" / "tests" / "fixtures"
    corpus = contract_corpus_codepoints(args.root)
    # Both faces are immutable, build-time contract fonts. The corpus is taken
    # from every Worker contract source/migration plus the explicit regression
    # names, so runtime PDF generation never performs CJK glyph collection.
    build(args.source, fixtures / "NotoSansTC-Regular.subset.ttf", 400, corpus)
    build(args.source, fixtures / "NotoSansTC-Bold.subset.ttf", 700, corpus)
    if args.common_output_dir:
        common_codepoints = set(corpus)
        for lead in range(0xA4, 0xC7):
            for trail in (*range(0x40, 0x7F), *range(0xA1, 0xFF)):
                try:
                    decoded = bytes((lead, trail)).decode("cp950")
                    common_codepoints.update(map(ord, decoded))
                except UnicodeDecodeError:
                    pass
        build(args.source, args.common_output_dir / "NotoSansTC-Regular-Common-v3.ttf", 400, common_codepoints)
