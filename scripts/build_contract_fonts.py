from pathlib import Path
import argparse

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def contract_corpus_codepoints(root: Path) -> set[int]:
    codepoints: set[int] = set()
    required = "創百業智慧鏈商家服務合作契約承攬夥伴合作契約智慧商務智慧點餐免 POS三個月試用正式服務保證金抵約契約簽署法定姓名簽署時間電子簽名文件驗證資訊葉耀仁陳靈有限公司～"
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
        "cloudflare-worker/migrations/production_0032_unified_contract_center_approval.sql",
    ]
    for relative_path in relative_paths:
        path = root / relative_path
        codepoints.update(map(ord, path.read_text(encoding="utf-8", errors="ignore")))
    return codepoints


def build(source: Path, output: Path, weight: int, codepoints: set[int]) -> None:
    font = instantiateVariableFont(TTFont(source), {"wght": weight}, inplace=False)
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
    output.parent.mkdir(parents=True, exist_ok=True)
    font.save(output)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build immutable Traditional Chinese contract fonts.")
    parser.add_argument("source", type=Path, help="Noto Sans TC variable font")
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    args = parser.parse_args()
    fixtures = args.root / "cloudflare-worker" / "tests" / "fixtures"
    corpus = contract_corpus_codepoints(args.root)
    # Both faces are immutable, build-time contract fonts. The corpus is taken
    # from every Worker contract source/migration plus the explicit regression
    # names, so runtime PDF generation never performs CJK glyph collection.
    build(args.source, fixtures / "NotoSansTC-Regular.subset.ttf", 400, corpus)
    build(args.source, fixtures / "NotoSansTC-Bold.subset.ttf", 700, corpus)
