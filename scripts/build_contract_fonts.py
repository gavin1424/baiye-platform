from pathlib import Path
import argparse

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont


def repository_codepoints(root: Path, baseline: Path) -> set[int]:
    baseline_font = TTFont(baseline)
    codepoints = set(baseline_font.getBestCmap())
    baseline_font.close()
    required = "創百業智慧鏈商家服務合作契約承攬夥伴合作契約智慧商務智慧點餐免 POS三個月試用正式服務保證金抵約契約簽署法定姓名簽署時間電子簽名文件驗證資訊葉耀仁陳靈有限公司～"
    codepoints.update(map(ord, required))
    for directory in (root / "cloudflare-worker" / "migrations", root / "cloudflare-worker" / "src"):
        for path in directory.rglob("*"):
            if path.suffix.lower() not in {".sql", ".js", ".json", ".html"}:
                continue
            codepoints.update(map(ord, path.read_text(encoding="utf-8", errors="ignore")))
    return codepoints


def build(source: Path, output: Path, weight: int, codepoints: set[int]) -> None:
    font = instantiateVariableFont(TTFont(source), {"wght": weight}, inplace=False)
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
    codepoints = repository_codepoints(args.root, fixtures / "NotoSansTC-Regular.subset.ttf")
    build(args.source, fixtures / "NotoSansTC-Regular.subset.ttf", 400, codepoints)
    build(args.source, fixtures / "NotoSansTC-Bold.subset.ttf", 700, codepoints)
