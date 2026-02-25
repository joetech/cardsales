#!/usr/bin/env python3
import argparse
import os
import shutil
from pathlib import Path

from PIL import Image

SRC_DIR = Path("./scanned")

def rotate_and_overwrite(path: Path, degrees: int) -> None:
    # PIL rotates counter-clockwise for positive angles
    # so clockwise 90 == -90
    with Image.open(path) as im:
        im = im.convert("RGB")
        im = im.crop((0, 100, im.width, im.height))
        rotated = im.rotate(degrees, expand=True)
        rotated.save(path, format="PNG")

def simple_orientation_score(im: Image.Image) -> float:
    """
    Heuristic: favor images with stronger horizontal edges than vertical edges.
    This is not perfect, but can work for text-heavy scans.
    """
    try:
        import numpy as np
    except ImportError:
        raise RuntimeError("simple mode requires numpy. Install with: pip install numpy")

    # Downscale for speed
    g = im.convert("L").resize((600, int(600 * im.height / im.width)))
    arr = np.asarray(g, dtype=np.float32)

    # Sobel-ish gradients (very lightweight)
    gx = arr[:, 2:] - arr[:, :-2]  # vertical edges respond strongly in gx
    gy = arr[2:, :] - arr[:-2, :]  # horizontal edges respond strongly in gy

    # Mean absolute gradients
    vx = float(abs(gx).mean())
    hy = float(abs(gy).mean())

    # If hy > vx, more horizontal structure (good for upright text lines)
    return hy - vx

def choose_rotation_simple(im: Image.Image) -> int:
    # Compare -90 (clockwise) vs +90 (counter-clockwise)
    cw = im.rotate(-90, expand=True)
    ccw = im.rotate(90, expand=True)
    return -90 if simple_orientation_score(cw) >= simple_orientation_score(ccw) else 90

def ocr_text_score(im: Image.Image) -> float:
    """
    OCR score: compare amount of recognized text weighted by average confidence.
    Requires: tesseract-ocr installed + pytesseract pip package.
    """
    import pytesseract

    # Downscale for speed; convert to grayscale and increase contrast a bit
    w = 800
    h = int(w * im.height / im.width)
    img = im.convert("L").resize((w, h))

    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)
    texts = data.get("text", [])
    confs = data.get("conf", [])

    total_chars = 0
    conf_sum = 0.0
    conf_count = 0

    for t, c in zip(texts, confs):
        t = (t or "").strip()
        if not t:
            continue
        try:
            c_val = float(c)
        except Exception:
            continue
        if c_val < 0:
            continue
        total_chars += len(t)
        conf_sum += c_val
        conf_count += 1

    avg_conf = (conf_sum / conf_count) if conf_count else 0.0
    return total_chars * (avg_conf / 100.0)

def choose_rotation_ocr(im: Image.Image) -> int:
    cw = im.rotate(-90, expand=True)
    ccw = im.rotate(90, expand=True)
    return -90 if ocr_text_score(cw) >= ocr_text_score(ccw) else 90

def resolve_dest(save_dir_name: str) -> Path:
    p = Path(save_dir_name).expanduser()
    if p.is_absolute():
        return p
    return SRC_DIR / save_dir_name

def main() -> int:
    ap = argparse.ArgumentParser(description="Rotate and move PNG card scans.")
    ap.add_argument("save_dir", help="Destination directory name or absolute path.")
    ap.add_argument("--auto", choices=["simple", "ocr"], default="ocr",
                    help="How to decide clockwise vs counter-clockwise (default: ocr).")
    ap.add_argument("--dry-run", action="store_true", help="Print actions without modifying files.")
    args = ap.parse_args()

    if not SRC_DIR.exists():
        raise SystemExit(f"Source directory not found: {SRC_DIR}")

    dest_dir = resolve_dest(args.save_dir)

    pngs = sorted(SRC_DIR.glob("*.png"))
    if not pngs:
        print(f"No PNG files found in {SRC_DIR}")
        return 0

    if not args.dry_run:
        dest_dir.mkdir(parents=True, exist_ok=True)

    for path in pngs:
        with Image.open(path) as im:
            if args.auto == "ocr":
                degrees = choose_rotation_ocr(im)
            else:
                degrees = choose_rotation_simple(im)

        if args.dry_run:
            print(f"[DRY] rotate {degrees} degrees and overwrite: {path.name}")
        else:
            rotate_and_overwrite(path, degrees)

        target = dest_dir / path.name
        if args.dry_run:
            print(f"[DRY] move: {path} -> {target}")
        else:
            shutil.move(str(path), str(target))

    return 0

if __name__ == "__main__":
    raise SystemExit(main())
