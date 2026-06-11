#!/usr/bin/env python3
"""Generate responsive WebP assets and low-res blurred placeholders from source PNG files.

Usage examples:
  python scripts/optimize-images.py
  python scripts/optimize-images.py --force
  python scripts/optimize-images.py assets/original/madonna-grazie.png assets/original/fratticciola.png

The script reads PNG files, creates:
  assets/optimized/<name>-480.webp
  assets/optimized/<name>-768.webp
  ...
  assets/optimized/<name>-placeholder.png
  data/image-assets.json

Transparency is preserved automatically: PNG files with an alpha channel
(or palette transparency) are converted to RGBA and saved as WebP with alpha,
so layered parallax assets do not get flattened on a solid background.

It intentionally ignores already generated placeholders and derived files.
"""
from __future__ import annotations

import argparse
import json
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
DEFAULT_SOURCE_DIR = Path("assets/original")
DEFAULT_OUTPUT_DIR = Path("assets/optimized")
DEFAULT_MANIFEST_PATH = Path("data/image-assets.json")


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


def image_has_transparency(image: Image.Image) -> bool:
    """Return True when the source has real transparent/semi-transparent pixels."""
    if image.mode in {"RGBA", "LA"}:
        alpha = image.getchannel("A")
        return alpha.getextrema()[0] < 255
    if image.mode == "P" and "transparency" in image.info:
        return True
    return "transparency" in image.info


def normalize_source(image: Image.Image) -> tuple[Image.Image, bool]:
    has_alpha = image_has_transparency(image)
    if has_alpha:
        return image.convert("RGBA"), True
    return image.convert("RGB"), False


def save_webp(image: Image.Image, output: Path, quality: int, has_alpha: bool) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    if has_alpha:
        # Keep RGBA all the way to WebP: this preserves the alpha mask for
        # layered artwork without flattening it against black/white.
        image.save(output, format="WEBP", quality=max(quality, 90), method=4)
    else:
        image.save(output, format="WEBP", quality=quality, method=6)


def save_placeholder(image: Image.Image, output: Path, source: Path, force: bool, size: int) -> None:
    if not should_write(output, source, force):
        return
    placeholder = ImageOps.contain(image.copy(), (size, size), method=Image.Resampling.LANCZOS)
    output.parent.mkdir(parents=True, exist_ok=True)
    placeholder.save(output, format="PNG", optimize=True)


def convert_one(
    path: Path,
    output_dir: Path,
    widths: tuple[int, ...],
    quality: int,
    placeholder_size: int,
    force: bool,
) -> dict[str, object]:
    key = path.stem
    with Image.open(path) as img:
        img = ImageOps.exif_transpose(img)
        source, has_alpha = normalize_source(img)
        original_width, original_height = source.size
        generated_widths = output_widths(original_width, widths)

        placeholder_path = output_dir / f"{key}-placeholder.png"
        save_placeholder(source, placeholder_path, path, force, placeholder_size)

        for width in generated_widths:
            ratio = width / original_width
            height = max(1, round(original_height * ratio))
            output = output_dir / f"{key}-{width}.webp"
            if not should_write(output, path, force):
                continue
            resized = source.resize((width, height), Image.Resampling.LANCZOS)
            save_webp(resized, output, quality, has_alpha)

    return {
        "key": key,
        "source": path.as_posix(),
        "basePath": (output_dir / key).as_posix(),
        "format": "webp",
        "placeholder": placeholder_path.as_posix(),
        "widths": generated_widths,
        "width": original_width,
        "height": original_height,
        "transparent": has_alpha,
    }


def collect_sources(args: argparse.Namespace) -> list[Path]:
    if args.files:
        return [Path(item) for item in args.files if is_source_png(Path(item))]
    source_dir = Path(args.source_dir)
    return sorted(path for path in source_dir.glob("*.png") if is_source_png(path))


def load_manifest_assets(path: Path) -> dict[str, object]:
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    assets = data.get("assets") if isinstance(data, dict) else None
    return assets if isinstance(assets, dict) else {}


def write_manifest(path: Path, assets: dict[str, object]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    ordered_assets = {key: assets[key] for key in sorted(assets)}
    payload = {
        "version": 1,
        "assets": ordered_assets,
    }
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description="Ottimizza PNG in WebP responsive con placeholder low-res.")
    parser.add_argument("files", nargs="*", help="PNG specifici da convertire. Se omessi, converte assets/original/*.png")
    parser.add_argument(
        "--source-dir",
        "--assets-dir",
        dest="source_dir",
        default=str(DEFAULT_SOURCE_DIR),
        help="Cartella PNG sorgenti da scandire quando non passi file espliciti",
    )
    parser.add_argument("--output-dir", default=str(DEFAULT_OUTPUT_DIR), help="Cartella per WebP e placeholder generati")
    parser.add_argument("--manifest", default=str(DEFAULT_MANIFEST_PATH), help="Manifest JSON da aggiornare")
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

    output_dir = Path(args.output_dir)
    manifest_path = Path(args.manifest)
    manifest_assets = load_manifest_assets(manifest_path) if args.files else {}

    for source in sources:
        if not source.exists():
            print(f"Salto file inesistente: {source}", file=sys.stderr)
            continue
        result = convert_one(source, output_dir, args.widths, args.quality, args.placeholder_size, args.force)
        manifest_assets[str(result["key"])] = result
        widths = ", ".join(str(width) for width in result["widths"])
        alpha_note = " trasparenza preservata" if result.get("transparent") else ""
        print(f"{source}: {result['width']}x{result['height']} -> {result['basePath']}-*.webp [{widths}] + placeholder{alpha_note}")
        print(f"  revealImage: {{ \"key\": \"{result['key']}\" }}")

    write_manifest(manifest_path, manifest_assets)
    print(f"Manifest aggiornato: {manifest_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
