#!/usr/bin/env python3
"""Build the approved Sunweaver Town Center v01 reference pack.

The source is an approved concept sheet. Coordinates are deliberately explicit and
recorded in provenance.json. This script never samples candidate renders and never
repaints source artwork.
"""
from __future__ import annotations

import hashlib
import json
from collections import deque
from pathlib import Path
from typing import Iterable, cast

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "references" / "sunweaver-town-center-reference.png"
PACK = ROOT / "references" / "Sunweaver_TownCenter_Reference_v01"
NEUTRAL = (128, 128, 128)
PALETTE = ["#F0E0B6", "#D9B26E", "#7AB591", "#1E3A6D", "#36C9FF"]

# (filename, source crop x1,y1,x2,y2, output role, direct/mirrored)
CROPS = [
    ("01_front_ortho_4096.png", (670, 82, 825, 355), "front orthographic", "direct"),
    ("02_right_ortho_4096.png", (866, 82, 1065, 355), "right orthographic", "direct"),
    ("03_back_ortho_4096.png", (1320, 82, 1505, 355), "back orthographic", "direct"),
    ("04_left_ortho_4096.png", (866, 82, 1065, 355), "left orthographic", "mirrored"),
    ("05_top_ortho_4096.png", (263, 430, 554, 680), "top orthographic", "direct"),
    ("06_front_three_quarter_4096.png", (440, 82, 620, 355), "front three-quarter", "direct"),
    ("07_rear_three_quarter_4096.png", (1087, 76, 1305, 365), "rear three-quarter", "direct"),
    ("08_entrance_detail_2048.png", (170, 735, 300, 878), "entrance detail", "direct"),
    ("09_crystal_crown_detail_2048.png", (35, 735, 150, 878), "crystal crown detail", "direct"),
    # Architectural-details row. These boxes stay inside the admitted panels and
    # stop above the captions and panel borders.
    ("10_buttress_tower_detail_2048.png", (478, 730, 618, 878), "buttress and tower detail", "direct"),
    ("11_banner_and_sigil_detail_2048.png", (333, 730, 458, 878), "banner and sigil detail", "direct"),
    ("13_scale_and_dimensions_2048.png", (790, 730, 1080, 945), "in-game scale reference", "direct"),
    ("14_stage_1_2048.png", (585, 500, 790, 681), "construction stage 1", "direct"),
    ("15_stage_2_2048.png", (825, 500, 1020, 681), "construction stage 2", "direct"),
    ("16_stage_3_2048.png", (1055, 500, 1250, 681), "construction stage 3", "direct"),
    ("17_stage_4_2048.png", (1285, 500, 1505, 681), "construction stage 4", "direct"),
]


def source_hash() -> str:
    return hashlib.sha256(SOURCE.read_bytes()).hexdigest()


def flood_background_mask(image: Image.Image) -> Image.Image:
    """Keep the target and remove connected concept-sheet background.

    The crop rectangles leave a margin around the target. A border flood fill uses
    the sampled paper tone, so interior target pixels are retained even when they
    are light stone. The result is intentionally conservative: no generative fill.
    """
    rgb = image.convert("RGB")
    w, h = rgb.size
    px = rgb.load()
    border = [px[x, 0] for x in range(w)] + [px[x, h - 1] for x in range(w)]
    border += [px[0, y] for y in range(h)] + [px[w - 1, y] for y in range(h)]
    bg = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))
    # The paper is bright and low-chroma. Use a deliberately tight flood rule:
    # a pixel must be close to the sampled border tone AND be bright/neutral.
    # This prevents pale ivory stone from being classified as paper. The flood
    # remains border-connected, so enclosed dark material is always retained.
    threshold = 40
    def close_to_bg(x: int, y: int) -> bool:
        p = cast(tuple[int, int, int], px[x, y])
        distance = sum((p[i] - bg[i]) ** 2 for i in range(3)) ** 0.5
        luminance = sum(p) / 3
        chroma = max(p) - min(p)
        return distance <= threshold and luminance >= 225 and chroma <= 22
    seen = bytearray(w * h)
    q: deque[tuple[int, int]] = deque()
    for x in range(w):
        q.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        q.extend(((0, y), (w - 1, y)))
    while q:
        x, y = q.popleft()
        idx = y * w + x
        if seen[idx] or not close_to_bg(x, y):
            continue
        seen[idx] = 1
        if x:
            q.append((x - 1, y))
        if x + 1 < w:
            q.append((x + 1, y))
        if y:
            q.append((x, y - 1))
        if y + 1 < h:
            q.append((x, y + 1))
    alpha = Image.new("L", (w, h), 255)
    ap = alpha.load()
    for i, value in enumerate(seen):
        if value:
            ap[i % w, i // w] = 0
    return alpha


def fit_target(crop: Image.Image, alpha: Image.Image, size: int, mirror: bool) -> tuple[Image.Image, Image.Image]:
    bbox = alpha.getbbox()
    if bbox is None:
        raise RuntimeError("empty target mask")
    pad = max(8, round(min(crop.size) * 0.04))
    x1 = max(0, bbox[0] - pad)
    y1 = max(0, bbox[1] - pad)
    x2 = min(crop.width, bbox[2] + pad)
    y2 = min(crop.height, bbox[3] + pad)
    crop = crop.crop((x1, y1, x2, y2))
    alpha = alpha.crop((x1, y1, x2, y2))
    if mirror:
        crop = crop.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        alpha = alpha.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    scale = min((size * 0.88) / crop.width, (size * 0.88) / crop.height)
    dims = (max(1, round(crop.width * scale)), max(1, round(crop.height * scale)))
    crop = crop.resize(dims, Image.Resampling.LANCZOS)
    alpha = alpha.resize(dims, Image.Resampling.LANCZOS)
    target = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    xy = ((size - dims[0]) // 2, (size - dims[1]) // 2)
    target.paste(crop.convert("RGBA"), xy, alpha)
    placed_alpha = Image.new("L", (size, size), 0)
    placed_alpha.paste(alpha, xy)
    return target, placed_alpha


def emit_variants(filename: str, target: Image.Image, alpha: Image.Image) -> None:
    size = target.width
    neutral = Image.new("RGBA", (size, size), (*NEUTRAL, 255))
    neutral.alpha_composite(target)
    # Base is byte-identical to neutral by contract.
    neutral.convert("RGB").save(PACK / filename, format="PNG", optimize=False)
    neutral.convert("RGB").save(PACK / filename.replace(".png", "_neutral.png"), format="PNG", optimize=False)
    target.putalpha(alpha)
    target.save(PACK / filename.replace(".png", "_alpha.png"), format="PNG", optimize=False)


def materials_board() -> Image.Image:
    image = Image.new("RGB", (2048, 2048), NEUTRAL)
    draw = ImageDraw.Draw(image)
    margin, gap = 128, 32
    width = (2048 - 2 * margin - 4 * gap) // 5
    for i, color in enumerate(PALETTE):
        x = margin + i * (width + gap)
        draw.rectangle((x, 256, x + width, 1792), fill=color)
    return image


def emit_material_variants() -> None:
    target = materials_board().convert("RGBA")
    alpha = Image.new("L", target.size, 0)
    draw = ImageDraw.Draw(alpha)
    margin, gap = 128, 32
    width = (2048 - 2 * margin - 4 * gap) // 5
    for i in range(5):
        x = margin + i * (width + gap)
        draw.rectangle((x, 256, x + width, 1792), fill=255)
    emit_variants("12_materials_2048.png", target, alpha)


def make_contact_sheet() -> None:
    names = [name for name, *_ in CROPS] + ["12_materials_2048.png"]
    thumb = 384
    sheet = Image.new("RGB", (thumb * 4, thumb * 5), NEUTRAL)
    draw = ImageDraw.Draw(sheet)
    for i, name in enumerate(names):
        with Image.open(PACK / name) as im:
            im = im.convert("RGB")
            im.thumbnail((thumb - 20, thumb - 36), Image.Resampling.LANCZOS)
            x = (i % 4) * thumb + (thumb - im.width) // 2
            y = (i // 4) * thumb + 24 + (thumb - 36 - im.height) // 2
            sheet.paste(im, (x, y))
            draw.text(((i % 4) * thumb + 8, (i // 4) * thumb + 5), name.split(".")[0], fill=(240, 240, 240))
    sheet.save(PACK / "contact_sheet.png", format="PNG", optimize=False)


def verify_pack() -> dict:
    required = [name for name, *_ in CROPS] + ["12_materials_2048.png"]
    files = []
    failures = []
    coverage_by_file = {}
    for name in required:
        size = 4096 if "4096" in name else 2048
        for variant in ("", "_neutral", "_alpha"):
            path = PACK / name.replace(".png", f"{variant}.png")
            if not path.exists():
                failures.append(f"missing:{path.name}")
                continue
            with Image.open(path) as im:
                dims_ok = im.size == (size, size)
                if not dims_ok:
                    failures.append(f"dimensions:{path.name}:{im.size}")
                alpha = im.getchannel("A") if "A" in im.getbands() else None
                has_transparency = alpha is not None and alpha.getextrema()[0] < 255
                if variant == "_alpha" and not has_transparency:
                    failures.append(f"alpha-opaque:{path.name}")
                coverage = None
                if variant == "_alpha":
                    histogram = alpha.histogram()
                    opaque = sum(histogram[9:])
                    coverage = opaque / (size * size)
                    coverage_by_file[path.name] = coverage
                    # Every isolated detail must retain a substantial target,
                    # but must not become an opaque square. The materials board
                    # is a constructed swatch board and uses the same bounds.
                    if not 0.20 <= coverage <= 0.95:
                        failures.append(f"coverage-range:{path.name}:{coverage:.6f}")
                if variant != "_alpha" and im.mode in ("RGBA", "LA"):
                    failures.append(f"unexpected-alpha:{path.name}")
            entry = {"file": path.name, "dimensions": {"width": size, "height": size}, "exists": True}
            if variant == "_alpha":
                entry["nonTransparentCoverage"] = coverage
                entry["acceptedCoverageRange"] = {"min": 0.20, "max": 0.95}
            files.append(entry)
        base = Image.open(PACK / name.replace(".png", ".png"))
        neutral = Image.open(PACK / name.replace(".png", "_neutral.png"))
        if base.tobytes() != neutral.tobytes():
            failures.append(f"base-not-neutral:{name}")
        base.close(); neutral.close()
    alpha_values = list(coverage_by_file.values())
    return {"schemaVersion": 2, "passed": not failures, "requiredBaseFiles": required,
            "checkedFiles": files,
            "nonTransparentCoverage": {
                "acceptedRange": {"min": 0.20, "max": 0.95},
                "observedRange": {"min": min(alpha_values), "max": max(alpha_values)} if alpha_values else None,
                "byFile": coverage_by_file,
            },
            "failures": failures}


def main() -> None:
    PACK.mkdir(parents=True, exist_ok=True)
    source = Image.open(SOURCE).convert("RGB")
    provenance = {
        "schemaVersion": 1,
        "source": str(SOURCE.relative_to(ROOT)),
        "sourceSha256": source_hash(),
        "sourceDimensions": {"width": source.width, "height": source.height},
        "neutralBackground": "#808080",
        "palette": PALETTE,
        "outputs": [],
    }
    for filename, box, role, status in CROPS:
        crop = source.crop(box)
        alpha = flood_background_mask(crop)
        size = 4096 if "4096" in filename else 2048
        target, placed_alpha = fit_target(crop, alpha, size, status == "mirrored")
        emit_variants(filename, target, placed_alpha)
        provenance["outputs"].append({
            "file": filename,
            "role": role,
            "sourceCrop": {"x": box[0], "y": box[1], "width": box[2] - box[0], "height": box[3] - box[1]},
            "status": status,
            "sourceObserved": status == "direct",
            "humanFigureDirectlyObserved": filename == "13_scale_and_dimensions_2048.png",
            "inferenceNote": "Mirrored from admitted right-side crop; left side is not directly observed." if status == "mirrored" else None,
            "dimensions": {"width": size, "height": size},
            "variants": {"baseEqualsNeutral": True, "neutralOpaque": True, "alphaHasTransparency": True},
        })
    emit_material_variants()
    provenance["outputs"].append({
        "file": "12_materials_2048.png", "role": "approved five-swatch material board",
        "sourceCrop": None, "status": "constructed-from-approved-palette", "sourceObserved": False,
        "inferenceNote": "Clean board generated from exact palette in 00_spec.json; no source text or candidate art used.",
        "dimensions": {"width": 2048, "height": 2048},
        "variants": {"baseEqualsNeutral": True, "neutralOpaque": True, "alphaHasTransparency": True},
    })
    provenance["outputs"].sort(key=lambda item: item["file"])
    (PACK / "provenance.json").write_text(json.dumps(provenance, indent=2) + "\n")
    make_contact_sheet()
    report = verify_pack()
    (PACK / "qa" / "reference_pack_verification.json").parent.mkdir(parents=True, exist_ok=True)
    (PACK / "qa" / "reference_pack_verification.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps({"pack": str(PACK), "sourceSha256": provenance["sourceSha256"], "outputs": len(provenance["outputs"]), "contactSheet": "contact_sheet.png", "verification": report}, indent=2))
    if not report["passed"]:
        raise SystemExit("reference pack verification failed")


if __name__ == "__main__":
    main()
