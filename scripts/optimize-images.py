#!/usr/bin/env python3
"""
Turn raw generated art in design/assets-src/ into web-ready files in public/img/.

Drop new generations into design/assets-src/ using the filenames from
design/prompts.md, then run:  python3 scripts/optimize-images.py

Generators hand back 1-1.5 MB PNGs at whatever aspect they feel like. This
trims the dead transparent margin, resizes to what the page actually displays,
and writes WebP. Anything not listed in TARGETS is copied through untouched.
"""

import pathlib
import sys

try:
    from PIL import Image
except ImportError:
    sys.exit("Pillow is required:  pip3 install pillow")

SRC = pathlib.Path("design/assets-src")
OUT = pathlib.Path("public/img")

# stem -> (max_width, max_height, keep_alpha, quality)
# Sizes are ~2x the largest on-screen render, which covers retina.
TARGETS = {
    "hero-plate":        (2400, 1350, False, 80),
    "hero-plate-mobile": (1080, 1920, False, 80),
    "hero-card":         (1200, 1200, True,  85),
    "about-backdrop":    (1920, 1080, False, 78),
    "card-texture":      (1000, 1400, False, 78),
    "streak":            (2400,  400, True,  82),
    "particles":         (1600, 1600, True,  82),
    "podium":            (1800,  650, True,  85),
    # Four-tier replacement, staged until the Prizes grid grows a fourth card.
    "podium-4tier":      (1800,  650, True,  85),
    "newera-mark":       ( 512,  512, True,  90),
    "trophy-1":          ( 720,  720, True,  88),
    "trophy-2":          ( 640,  640, True,  88),
    "trophy-3":          ( 640,  640, True,  88),
    "trophy-4":          ( 640,  640, True,  88),
    "icon-dates":        ( 360,  360, True,  90),
    "icon-capital":      ( 360,  360, True,  90),
    "icon-win":          ( 360,  360, True,  90),
    # Admin panel. The plate and the rail are pure atmosphere, so they take a
    # lower quality than the hero without anyone noticing.
    "admin-plate":       (2000, 1150, False, 74),
    "data-texture":      (1000,  700, False, 74),
    "admin-rail":        ( 700, 1600, False, 76),
    "login-plate":       (1400, 2100, False, 80),
    # League screen. The arena is the only full-bleed plate of the three, so
    # it takes the hero's budget; the gate is cropped to a short band and the
    # lanes sit at 16% opacity, which is why both can go lower.
    "league-arena":      (2400, 1350, False, 80),
    "league-plinth":     (1200, 1200, True,  85),
    "league-gate":       (2400,  800, False, 78),
    "league-lanes":      (1800, 1050, False, 74),
    "empty-state":       ( 900,  700, True,  88),
}

# Open Graph must be exactly 1200x630 and opaque, so it gets cropped to fill
# rather than fitted inside.
OG = ("og", 1200, 630)


def trim_alpha(im: Image.Image) -> Image.Image:
    """Crop away fully transparent margin so the subject fills the frame."""
    if im.mode != "RGBA":
        return im
    box = im.getchannel("A").point(lambda v: 255 if v > 8 else 0).getbbox()
    return im.crop(box) if box else im


def cover(im: Image.Image, w: int, h: int) -> Image.Image:
    """Scale to fill w x h, cropping the overflow, centred."""
    scale = max(w / im.width, h / im.height)
    im = im.resize((round(im.width * scale), round(im.height * scale)), Image.LANCZOS)
    left = (im.width - w) // 2
    top = (im.height - h) // 2
    return im.crop((left, top, left + w, top + h))


def main() -> None:
    if not SRC.is_dir():
        sys.exit(f"No {SRC}/ directory. Put your generated files there first.")
    OUT.mkdir(parents=True, exist_ok=True)

    saved = 0
    for path in sorted(SRC.iterdir()):
        if path.is_dir() or path.name.startswith("."):
            continue

        stem = path.stem
        before = path.stat().st_size
        im = Image.open(path)

        if stem == OG[0]:
            # JPEG, not PNG or WebP: every social scraper reads JPEG, and a
            # photographic plate costs ~6x as much as PNG for no visible gain.
            im = cover(im.convert("RGB"), OG[1], OG[2])
            dest = OUT / "og.jpg"
            im.save(dest, "JPEG", quality=84, optimize=True, progressive=True)
        elif stem in TARGETS:
            w, h, keep_alpha, q = TARGETS[stem]
            if keep_alpha:
                im = trim_alpha(im.convert("RGBA"))
            else:
                im = im.convert("RGB")
            im.thumbnail((w, h), Image.LANCZOS)
            dest = OUT / f"{stem}.webp"
            im.save(dest, "WEBP", quality=q, method=6)
        else:
            dest = OUT / path.name
            dest.write_bytes(path.read_bytes())
            print(f"  passthrough  {path.name}")
            continue

        after = dest.stat().st_size
        saved += before - after
        print(
            f"  {dest.name:24} {im.size[0]:>5}x{im.size[1]:<5} "
            f"{before // 1024:>6}kB -> {after // 1024:>5}kB"
        )

    print(f"\nSaved {saved / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    main()
