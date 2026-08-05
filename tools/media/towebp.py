#!/usr/bin/env python3
"""
Convert the video posters and photo-grid stills to WebP.

goldendune gets WebP for free because Astro transcodes at build time; this site
has no bundler, so it is done here once and the .webp files are committed.

Deliberately NOT converted:
  * assets/img/og-*.jpg — social scrapers (WhatsApp, LinkedIn, some chat
    unfurlers) still handle WebP badly, and these are the share images.
    They are also what schema.org `image` points at.
  * favicons — PNG/SVG, where WebP buys nothing and support is patchier.

Posters are the important ones: a <video poster> is fetched as soon as the
element lays out, so all 42 land on the page whether or not the clip plays.
There is no <picture>-style fallback for a poster attribute, so this is
WebP-only — fine at ~97% browser support (Safari 14+, 2020).

    python3 tools/media/towebp.py [--dry-run]
"""
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
QUALITY = 82
DRY = "--dry-run" in sys.argv

targets = []
for d in ("assets/poster", "assets/img"):
    full = os.path.join(ROOT, d)
    for fn in sorted(os.listdir(full)):
        if not fn.endswith(".jpg"):
            continue
        if fn.startswith("og-"):          # keep social images as JPEG
            continue
        targets.append(os.path.join(full, fn))

before = after = 0
for src in targets:
    dst = src[:-4] + ".webp"
    im = Image.open(src).convert("RGB")
    if not DRY:
        im.save(dst, "WEBP", quality=QUALITY, method=6)
    a = os.path.getsize(src)
    b = os.path.getsize(dst) if os.path.exists(dst) else a
    before += a
    after += b
    if not DRY:
        os.remove(src)                    # nothing references the JPEG any more

print(f"{len(targets)} images: {before/1e6:.2f} MB -> {after/1e6:.2f} MB "
      f"({100 - 100 * after / before:.0f}% smaller){' [dry run]' if DRY else ''}")
