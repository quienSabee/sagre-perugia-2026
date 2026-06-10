#!/usr/bin/env python3
"""Generate responsive WebP assets and low-res blurred placeholders from PNG files.

Usage examples:
  python scripts/optimize-images.py
  python scripts/optimize-images.py --force
  python scripts/optimize-images.py assets/madonna-grazie.png assets/fratticciola.png

The script reads PNG files, creates:
  assets/<name>-480.webp
  assets/<name>-768.webp
  ...
  assets/<name>-placeholder.png

It intentionally ignores already generated placeholders and derived files.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image, ImageOps
except ImportError:  # pragma: no cover
    print(
        "Pillow non è installato. Installa la dipendenza con:\n"
        "  python -m pip install Pillow",
        file=sys.stderr,
    )
    raise SystemExit(1)

DEFAULT_WIDTHS = (480, 768, 1024, 1366, 1672)
DEFAULT_ASSETS_DIR = Path("assets")


def parse_widths(value: str) -> tuple[int, ...]:
    widths: list[int] = []
    for item in value.split(","):
        item = item.strip()
        if not item:
            continue
        try:
            width = int(item)
        except ValueError as exc:
            raise argparse.ArgumentTypeError(f"'{item}' non è una larghezza valida") from exc
        if width <= 0:
            raise argparse.ArgumentTypeError("Le larghezze devono essere positive")
        widths.append(width)
    if not widths:
        raise argparse.ArgumentTypeError("Specifica almeno una larghezza")
    return tuple(sorted(set(widths)))


def is_source_png(path: Path) -> bool:
    name = path.name.lower()
    if path.suffix.lower() != ".png":
        return False
    if name.endswith("-placeholder.png"):
        return False
    # Evita di usare eventuali file intermedi creati manualmente con suffisso numerico.
    if path.stem.rsplit("-", 1)[-1].isdigit():
        return False
    return True


def output_widths(original_width: int, requested: tuple[int, ...]) -> list[int]:
    widths = [width for width in requested if width <= original_width]
    if original_width not in widths:
        widths.append(original_width)
    return sorted(set(widths))


def should_write(output: Path, source: Path, force: bool) -> bool:
    if force or not output.exists():
        return True
    return source.stat().st_mtime > output.stat().st_mtime


def save_placeholder(image: Image.Image, output: Path, source: Path, force: bool, size: int) -> None:
    if not should_write(output, source, force):
        return
    placeholder = ImageOps.contain(image.copy(), (size, size), method=Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    placeholder.save(output, format="PNG", optimize=True)


def convert_one(path: Path, widths: tuple[int, ...], quality: int, placeholder_size: int, force: bool) -> dict[str, object]:
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        source = img.convert("RGBA") if img.mode in {"P", "LA"} or "transparency" in img.info else img.convert("RGB")
        original_width, original_height = source.size
        generated_widths = output_widths(original_width, widths)

        placeholder_path = path.with_name(f"{path.stem}-placeholder.png")
        save_placeholder(source, placeholder_path, path, force, placeholder_size)

        for width in generated_widths:
            ratio = width / original_width
            height = max(1, round(original_height * ratio))
            output = path.with_name(f"{path.stem}-{width}.webp")
            if not should_write(output, path, force):
                continue
            resized = source.resize((width, height), Image.Resampling.LANCZOS)
            output.parent.mkdir(parents=True, exist_ok=True)
            resized.save(output, format="WEBP", quality=quality, method=6)

    return {
        "key": path.stem,
        "width": original_width,
        "height": original_height,
        "widths": generated_widths,
        "placeholder": placeholder_path.as_posix(),
    }


def collect_sources(args: argparse.Namespace) -> list[Path]:
    if args.files:
        return [Path(item) for item in args.files if is_source_png(Path(item))]
    assets_dir = Path(args.assets_dir)
    return sorted(path for path in assets_dir.glob("*.png") if is_source_png(path))


def main() -> int:
    parser = argparse.ArgumentParser(description="Ottimizza PNG in WebP responsive con placeholder low-res.")
    parser.add_argument("files", nargs="*", help="PNG specifici da convertire. Se omessi, converte assets/*.png")
    parser.add_argument("--assets-dir", default=str(DEFAULT_ASSETS_DIR), help="Cartella asset da scandire quando non passi file espliciti")
    parser.add_argument("--widths", type=parse_widths, default=DEFAULT_WIDTHS, help="Larghezze responsive separate da virgole")
    parser.add_argument("--quality", type=int, default=82, help="Qualità WebP, 1-100")
    parser.add_argument("--placeholder-size", type=int, default=32, help="Lato massimo del placeholder PNG")
    parser.add_argument("--force", action="store_true", help="Rigenera anche output già aggiornati")
    args = parser.parse_args()

    if not 1 <= args.quality <= 100:
        parser.error("--quality deve essere tra 1 e 100")
    if args.placeholder_size <= 0:
        parser.error("--placeholder-size deve essere positivo")

    sources = collect_sources(args)
    if not sources:
        print("Nessun PNG sorgente trovato.")
        return 0

    for source in sources:
        if not source.exists():
            print(f"Salto file inesistente: {source}", file=sys.stderr)
            continue
        result = convert_one(source, args.widths, args.quality, args.placeholder_size, args.force)
        widths = ", ".join(str(width) for width in result["widths"])
        print(f"{source}: {result['width']}x{result['height']} -> WebP [{widths}] + placeholder")
        print(
            "  revealImage: "
            f"{{ \"key\": \"{result['key']}\", \"widths\": [{widths}], "
            f"\"width\": {result['width']}, \"height\": {result['height']} }}"
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
