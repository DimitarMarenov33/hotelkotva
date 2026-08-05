#!/usr/bin/env python3
"""
Encode the Kotva web clips + posters from the raw footage.

Every clip is trimmed to a short seamless-ish loop, stripped of audio and
capped at 30fps. Landscape clips render at 1280x720 (the drone proxies are
native 720p — there is no 4K aerial original), portrait clips at 720x1280,
and the two hero montages at 1280x720 / 1080x1920.
"""
import json
import os
import re
import subprocess
import sys

SRC = "/Users/dimitarmarenov/Desktop/Kotva"
SITE = "/Users/dimitarmarenov/Desktop/Kotva/kotva-website"
VID = os.path.join(SITE, "assets/video")
POS = os.path.join(SITE, "assets/poster")

for d in (VID, POS):
    os.makedirs(d, exist_ok=True)


def dur(path):
    out = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "csv=p=0", path], capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


# slot: (source file, start seconds, length seconds, orientation)
CLIPS = {
    # ---- aquapark: the reason this site exists ----
    "aqua-aerial":      ("DTEH4422.MP4", 0.8, 5.5, "land"),   # aerial over the slide complex
    "aqua-splash":      ("XNVN1118.MP4", 0.4, 4.6, "land"),   # 4K: slides + landing pool, guests
    "aqua-bowl":        ("UHXS7753.MP4", 1.0, 6.0, "land"),   # funnel/bowl slides from above
    "aqua-slides-wide": ("VGDO2734.MP4", 1.0, 6.5, "land"),   # slide run beside the road
    "aqua-tower":       ("IMG_9851.MOV", 0.3, 2.6, "port"),   # slide tower from the ground
    "aqua-tower2":      ("IMG_9850.MOV", 0.2, 2.2, "port"),   # red/green flumes close up
    "aqua-pov":         ("IMG_4920.MOV", 6.0, 5.5, "port"),   # POV riding the open flume
    "aqua-pov2":        ("IMG_4928.MOV", 0.6, 4.2, "port"),   # POV inside the tube
    "aqua-pov3":        ("IMG_4930.MOV", 8.0, 5.0, "port"),   # POV yellow slide
    "aqua-landing":     ("IMG_4922.MOV", 0.3, 2.8, "port"),   # slide exit into the pool
    "aqua-rocks":       ("XOUB9762.MP4", 1.0, 5.0, "port"),   # rock-formation slide channel

    # ---- kids ----
    "kids-ship":        ("FASX0682.MP4", 4.0, 6.0, "port"),   # pirate-ship kids pool
    "kids-ship2":       ("YIFT8437.MP4", 1.0, 5.0, "port"),   # pirate ship close
    "kids-playground":  ("IMG_4927.MOV", 1.0, 5.0, "port"),   # playground from above
    "kids-pool-aerial": ("ESYV0350.MP4", 0.8, 5.5, "land"),   # slides + playground aerial
    "kids-club":        ("AYVR4258.MP4", 0.8, 5.0, "port"),   # indoor kids club

    # ---- pools ----
    "pool-lagoon":      ("WDUM4644.MP4", 2.0, 6.5, "land"),   # main lagoon + hotel
    "pool-olympic":     ("PSVO4732.MP4", 2.0, 6.5, "land"),   # half-Olympic pool aerial
    "pool-relax":       ("NZND9145.MP4", 1.0, 5.0, "port"),   # rock pool at ground level
    "pool-swim":        ("KGKQ3418.MP4", 1.0, 5.0, "port"),   # swimming in the lagoon
    "pool-deck":        ("IMG_7962.MOV", 0.4, 3.0, "port"),   # empty deck, morning light

    # ---- food & drink ----
    "restaurant":       ("FAJN7205.MP4", 6.0, 6.0, "port"),   # buffet salad counter
    "buffet-grill":     ("PNFM4212.MP4", 1.0, 5.0, "port"),   # grill station
    "buffet-fruit":     ("IMG_7981.MOV", 1.0, 4.5, "port"),   # watermelon / fruit
    "buffet-sweets":    ("SSZU9704.MP4", 1.0, 5.0, "port"),   # dessert counter
    "poolbar":          ("OWLB5878.MP4", 1.0, 5.5, "port"),   # guest at the pool bar
    "poolbar-drinks":   ("TTCJ9201.MP4", 1.0, 5.0, "port"),   # cocktails lined up on the bar

    # ---- rooms ----
    "room-double":      ("AGNC5764.MP4", 0.4, 4.4, "port"),
    "room-twin":        ("LXAY3865.MP4", 1.0, 5.0, "port"),
    "room-suite":       ("DMES6134.MP4", 0.3, 4.8, "port"),
    "room-bath":        ("NOMS2193.MP4", 0.5, 5.0, "port"),
    "room-balcony":     ("VWIO0194.MP4", 1.0, 5.0, "port"),

    # ---- hotel life ----
    "gym":              ("NUPU1402.MP4", 1.0, 5.0, "port"),
    "games":            ("IMG_9886.MOV", 3.0, 5.0, "port"),
    # NOTE: the DJI filenames contain U+202F (narrow no-break space), not a plain
    # space — copying them out of Finder or a terminal listing silently breaks them.
    "lobby":            ("DJI_20260802_92404_362 AM_video.mp4", 3.0, 5.5, "port"),
    "reception":        ("DJI_20260802_94222_937 AM_video.mp4", 4.0, 5.5, "port"),
    "exterior":         ("OWQJ5634.MP4", 1.0, 5.0, "port"),
    "garden":           ("IMG_7977.MOV", 1.0, 5.0, "port"),

    # ---- section bands ----
    "cta":              ("WIRY9753.MP4", 1.0, 6.5, "land"),   # aerial for the final CTA band
    "location":         ("LRXY6159.MP4", 1.0, 6.0, "land"),   # aerial showing the road / setting
}

# Hero montages: list of (source, start, length)
HERO_DESKTOP = [
    ("XNVN1118.MP4", 0.4, 3.4),   # sharp 4K: the slide complex, guests in the landing pool
    ("DTEH4422.MP4", 1.0, 3.2),   # aerial straight over the coloured flumes
    ("UHXS7753.MP4", 1.2, 3.2),   # the bowl slides
    ("WDUM4644.MP4", 3.0, 3.4),   # lagoon pool + the hotel behind it
]
# Phones get an all-aquapark cut: the vertical footage is native 4K and the
# waterpark is the whole pitch, so nothing here is spent on the pool bar.
# Wide slides -> POV ride -> splashdown -> the kids' pirate ship.
HERO_MOBILE = [
    ("IMG_4922.MOV",  0.2, 2.6),   # green + red flumes against the sky, ground level
    ("IMG_4920.MOV", 15.6, 3.2),   # POV down the open flume into the splash
    ("IMG_4930.MOV", 20.6, 2.8),   # surfacing beside the orange slide, guests in the pool
    ("FASX0682.MP4",  3.0, 2.6),   # pirate ship, children in the shallow pool
]

SIZES = {"land": (1280, 720), "port": (720, 1280)}

# Bitrate ceilings. crf 25 measured 30% smaller than crf 23 for a 0.6% SSIM
# drop against the lossless source — invisible on short muted background loops,
# and it is the difference between a 90 MB and a 60 MB page of media.
CRF = 25
CRF_HERO = 24                      # the one clip everybody sees, so a little richer
# The mobile hero is 1080x1920 — far more detail than a phone screen resolves,
# and it is the single biggest thing a phone downloads. crf 26 measured 19%
# smaller at SSIM 0.978, which is not visible at that pixel density.
CRF_HERO_MOBILE = 26
MAXRATE = {"land": "2800k", "port": "2200k"}

# Colour: much of the phone/drone footage is tagged full-range (yuvj420p).
# Browsers disagree about honouring that flag, which shows up as washed-out or
# crushed footage, so everything is converted to limited range and tagged bt709.
COLOUR = ["-color_range", "tv", "-colorspace", "bt709",
          "-color_primaries", "bt709", "-color_trc", "bt709"]


def vf_for(w, h):
    """Cover-fit to WxH with lanczos, never letterboxed, converted to TV range."""
    return (f"scale={w}:{h}:force_original_aspect_ratio=increase:flags=lanczos:"
            f"in_range=auto:out_range=tv,"
            f"crop={w}:{h},format=yuv420p")


def write_poster(src, ss, w, h, slot):
    """Poster straight from the 4K source, saved as WebP (this ffmpeg has no
    libwebp, so the frame goes out as PNG and PIL does the encode)."""
    from PIL import Image
    tmp = f"/tmp/kotva-poster-{slot}.png"
    subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", f"{ss}",
                    "-i", src, "-frames:v", "1", "-vf", vf_for(w, h), tmp], check=True)
    Image.open(tmp).convert("RGB").save(
        os.path.join(POS, f"{slot}.webp"), "WEBP", quality=82, method=6)
    os.remove(tmp)


def resolve(src):
    """DJI filenames contain U+202F (narrow no-break space); a literal name
    typed or pasted from a listing will not match, so fall back to a glob."""
    path = os.path.join(SRC, src)
    if os.path.exists(path):
        return path
    import glob
    hits = glob.glob(os.path.join(SRC, re.sub(r"\s+", "*", src)))
    return hits[0] if hits else path


def encode(slot, src, ss, length, orient):
    path = resolve(src)
    if not os.path.exists(path):
        print(f"  !! MISSING SOURCE {src} for {slot}", file=sys.stderr)
        return False
    d = dur(path)
    if ss + length > d:                      # clamp to what the clip actually has
        ss = max(0.0, d - length)
        if ss + length > d:
            length = max(1.0, d - ss)
    w, h = SIZES[orient]
    out = os.path.join(VID, f"{slot}.mp4")
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-y",
        "-ss", f"{ss}", "-t", f"{length}", "-i", path,
        "-an", "-r", "30", "-vf", vf_for(w, h),
        "-c:v", "libx264", "-preset", "slow", "-crf", str(CRF),
        "-maxrate", MAXRATE[orient], "-bufsize", "5600k",
        *COLOUR,
        "-profile:v", "high", "-movflags", "+faststart",
        out], check=True)
    # Poster from the SOURCE (not the compressed copy) so it stays sharp.
    write_poster(path, ss + min(0.5, length / 3), w, h, slot)
    return True


def montage(slot, shots, w, h, crf=CRF_HERO, maxrate="3200k"):
    """Concat trimmed shots into one clip via the concat demuxer."""
    parts = []
    tmpdir = "/tmp/kotva-montage"
    os.makedirs(tmpdir, exist_ok=True)
    for i, (src, ss, length) in enumerate(shots):
        path = resolve(src)
        if not os.path.exists(path):
            print(f"  !! MISSING {src}", file=sys.stderr)
            continue
        d = dur(path)
        if ss + length > d:
            ss = max(0.0, d - length)
            length = min(length, max(1.0, d - ss))
        part = os.path.join(tmpdir, f"{slot}-{i}.mp4")
        subprocess.run([
            "ffmpeg", "-nostdin", "-v", "error", "-y",
            "-ss", f"{ss}", "-t", f"{length}", "-i", path,
            "-an", "-r", "30", "-vf", vf_for(w, h),
            "-c:v", "libx264", "-preset", "slow", "-crf", str(crf - 1),
            *COLOUR, "-profile:v", "high", part], check=True)
        parts.append(part)
    listfile = os.path.join(tmpdir, f"{slot}.txt")
    with open(listfile, "w") as fh:
        for p in parts:
            fh.write(f"file '{p}'\n")
    out = os.path.join(VID, f"{slot}.mp4")
    subprocess.run([
        "ffmpeg", "-nostdin", "-v", "error", "-y", "-f", "concat", "-safe", "0",
        "-i", listfile, "-c:v", "libx264", "-preset", "slow", "-crf", str(crf),
        "-maxrate", maxrate, "-bufsize", "6400k", "-r", "30",
        *COLOUR, "-profile:v", "high", "-pix_fmt", "yuv420p",
        "-movflags", "+faststart", out], check=True)
    # Poster from the first shot's source, at full quality.
    src, ss, _ = shots[0]
    write_poster(resolve(src), ss + 0.5, w, h, slot)


if __name__ == "__main__":
    print("== hero montages ==", flush=True)
    montage("hero", HERO_DESKTOP, 1280, 720)
    montage("hero-mobile", HERO_MOBILE, 1080, 1920, crf=CRF_HERO_MOBILE, maxrate="2600k")
    print("== clips ==", flush=True)
    ok = 0
    for slot, (src, ss, length, orient) in CLIPS.items():
        if encode(slot, src, ss, length, orient):
            ok += 1
            print(f"  {slot:<18} <- {src}", flush=True)
    print(f"\nDONE: {ok}/{len(CLIPS)} clips + 2 heroes")
