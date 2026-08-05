#!/usr/bin/env python3
"""Photo-grid stills, social images and the anchor favicon set."""
import os
import subprocess
from PIL import Image, ImageDraw

SRC = "/Users/dimitarmarenov/Desktop/Kotva"
SITE = "/Users/dimitarmarenov/Desktop/Kotva/kotva-website"
IMG = os.path.join(SITE, "assets/img")
os.makedirs(IMG, exist_ok=True)

ANCHOR = (168, 56, 43)
SUN = (227, 169, 60)
FOAM = (233, 245, 250)

# --- Photo-grid stills, 4:5 portrait, pulled straight from the 4K sources ---
STILLS = [
    ("photo-slides",     "IMG_9851.MOV",  1.4),
    ("photo-ship",       "YIFT8437.MP4",  2.0),
    ("photo-lagoon",     "KGKQ3418.MP4",  2.0),
    ("photo-poolbar",    "OWLB5878.MP4",  3.0),
    ("photo-buffet",     "FAJN7205.MP4",  8.0),
    ("photo-room",       "NXFD6302.MP4",  2.0),
    ("photo-playground", "IMG_4927.MOV",  2.0),
    ("photo-rocks",      "XOUB9762.MP4",  2.0),
]
for slot, src, ss in STILLS:
    path = os.path.join(SRC, src)
    if not os.path.exists(path):
        print("  MISSING", src)
        continue
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(ss), "-i", path,
                    "-frames:v", "1",
                    "-vf", "scale=1400:1750:force_original_aspect_ratio=increase:flags=lanczos,"
                           "crop=1400:1750",
                    "-q:v", "3", os.path.join(IMG, f"{slot}.jpg")], check=True)
    print("  still", slot)

# --- Social / OG images from the aquapark aerial (the most recognisable frame) ---
OG_SRC = os.path.join(SRC, "DTEH4422.MP4")
for name, w, h in (("og-16x9", 1200, 630), ("og-4x3", 1200, 900), ("og-1x1", 1200, 1200)):
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", "1.4", "-i", OG_SRC,
                    "-frames:v", "1",
                    "-vf", f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos,"
                           f"crop={w}:{h}",
                    "-q:v", "2", os.path.join(IMG, f"{name}.jpg")], check=True)
    print("  og", name)


def draw_anchor(size):
    """Kotva means 'anchor' — a white anchor on the brand red, with a gold ring."""
    S = size * 4                      # supersample, then downscale
    im = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([0, 0, S - 1, S - 1], fill=ANCHOR)
    w = S * 0.062                     # stroke width
    cx = S / 2
    top, bot = S * 0.20, S * 0.80

    # Shank
    d.line([(cx, top + S * 0.10), (cx, bot)], fill="white", width=int(w))
    # Ring at the top
    r = S * 0.075
    d.ellipse([cx - r, top - r * 0.55, cx + r, top + r * 1.45], outline="white", width=int(w * .8))
    # Stock (crossbar)
    d.line([(cx - S * 0.20, top + S * 0.175), (cx + S * 0.20, top + S * 0.175)],
           fill="white", width=int(w))
    # Arms: a wide arc sweeping up into the flukes
    d.arc([cx - S * 0.30, bot - S * 0.44, cx + S * 0.30, bot + S * 0.10],
          start=15, end=165, fill="white", width=int(w))
    # Fluke tips
    for sx in (-1, 1):
        x = cx + sx * S * 0.295
        d.polygon([(x - S * 0.055, bot - S * 0.235),
                   (x + S * 0.055, bot - S * 0.195),
                   (x + sx * S * 0.035, bot - S * 0.075)], fill="white")
    # Gold rim, echoing the logo's sunburst
    d.ellipse([w * .55, w * .55, S - 1 - w * .55, S - 1 - w * .55],
              outline=SUN, width=int(w * .75))
    return im.resize((size, size), Image.LANCZOS)


for px in (48, 192, 512):
    draw_anchor(px).save(os.path.join(IMG, f"favicon-{px}.png"))
    print("  favicon", px)

draw_anchor(180).convert("RGB").save(os.path.join(SITE, "apple-touch-icon.png"))
ico = draw_anchor(64)
ico.save(os.path.join(SITE, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48)])

SVG = f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Hotel Kotva">
  <circle cx="32" cy="32" r="32" fill="#A8382B"/>
  <circle cx="32" cy="32" r="29.2" fill="none" stroke="#E3A93C" stroke-width="1.8"/>
  <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round">
    <path d="M32 19v32"/>
    <path d="M20 23h24"/>
    <path d="M17 39c0 8.5 6.8 13.5 15 13.5S47 47.5 47 39"/>
  </g>
  <circle cx="32" cy="15.5" r="4.6" fill="none" stroke="#fff" stroke-width="3.2"/>
  <path d="M13.4 36.2 21 39l-6.4 4.2z" fill="#fff"/>
  <path d="M50.6 36.2 43 39l6.4 4.2z" fill="#fff"/>
</svg>
"""
open(os.path.join(IMG, "icon.svg"), "w").write(SVG)
print("  icon.svg")
print("DONE")
