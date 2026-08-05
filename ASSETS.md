# Asset manifest — all encoded and ready to use, do NOT re-encode

Cut from ~9.6 GB of Hotel Kotva footage shot in **August 2026**, sitting in the
parent folder (`../*.MP4`, `../*.MOV`, `../*.HEIC`). Videos live in
`assets/video/`, matching posters (same basename) in `assets/poster/`, stills
and icons in `assets/img/`.

## Encoding

* **Landscape** clips render at 1280×720, **portrait** at 720×1280, hero
  montages at 1280×720 (desktop) and 1080×1920 (mobile).
* H.264 high profile, `crf 25` (`24` desktop hero, `26` mobile hero),
  `maxrate` 2.8M landscape / 2.2M portrait, 30 fps cap, **no audio**,
  `+faststart`, cover-cropped with lanczos — never letterboxed.
  crf 25 measured 30% smaller than crf 23 for a 0.6% SSIM drop against the
  lossless source: not visible on short muted loops.
* **Colour is normalised.** Much of the phone and drone footage arrives tagged
  full-range (`yuvj420p`), which browsers honour inconsistently — the symptom is
  washed-out or crushed playback. Every clip is converted with
  `scale=…:in_range=auto:out_range=tv` and tagged bt709, so all 42 are uniformly
  `yuv420p` / `tv` / `bt709`.
* H.264 only — no WebM/VP9 or AV1 twin. With ~40 clips autoplaying on one page,
  universal *hardware* decode matters more than the ~25% bytes another codec
  would save; VP9 would push decode into software on a lot of Safari/older
  hardware and cost battery.
* Posters are **WebP** (q82), pulled from the original 4K source rather than the
  compressed copy, and carried in `data-poster` — a real `poster` attribute is
  fetched on layout, so all 42 would land on first paint whether or not the user
  scrolled. `js/main.js` promotes them ~400 px before the tile enters view.
* Total video weight **60.5 MB**; a first view costs **4.8 MB desktop /
  5.0 MB mobile**, essentially the hero alone. Everything else is
  `preload="none"` + `data-src`, loaded by the IntersectionObserver.
* Data saver or a 2G `effectiveType` drops to posters only.

### Source limitation, worth knowing

All the aerial footage is **1280×720** — those files are DJI Fly cache proxies,
and no 4K aerial original exists in the folder. Everything shot on the ground is
native 4K but **portrait**; there is exactly one native-4K landscape clip in the
whole set (`XNVN1118.MP4`, the slide complex with guests in the landing pool),
which is why it opens the desktop hero montage.

That means the desktop hero is capped at 720p and looks slightly soft
full-screen. To fix it properly you need the drone's 4K originals off the SD
card. The mobile hero has no such problem — it is built entirely from native 4K
portrait footage.

## Hero montages

| slot | shots (source → in-point) |
|---|---|
| `hero` (desktop, 1280×720, 13.3s, 4.4 MB) | XNVN1118 @0.4s · DTEH4422 @1.0s · UHXS7753 @1.2s · WDUM4644 @3.0s |
| `hero-mobile` (portrait, 1080×1920, 11.5s, 3.9 MB) | IMG_4922 @0.2s · IMG_4920 @15.6s · IMG_4930 @20.6s · FASX0682 @3.0s |

The homepage picks between them by viewport **before** the fetch starts (inline
script under the hero `<video>`), so exactly one file downloads.

The mobile cut is **all aquapark** — wide flumes against the sky, a POV ride
into the splash, surfacing beside the orange bowl slide, then the children's
pirate ship. It is built entirely from native-4K vertical footage, so unlike the
desktop montage it is not limited by the 720p drone proxies. Phones are where
most family-holiday traffic lands, so this is the cut that matters.

## Clips

| slot | size | duration | weight |
|---|---|---|---|
| `aqua-aerial` | 1280×720 | 5.5s | 1.4 MB |
| `aqua-bowl` | 1280×720 | 6.0s | 1.9 MB |
| `aqua-landing` | 720×1280 | 2.9s | 0.8 MB |
| `aqua-pov` | 720×1280 | 5.6s | 1.7 MB |
| `aqua-pov2` | 720×1280 | 4.3s | 0.8 MB |
| `aqua-pov3` | 720×1280 | 5.1s | 1.3 MB |
| `aqua-rocks` | 720×1280 | 4.8s | 1.3 MB |
| `aqua-slides-wide` | 1280×720 | 6.5s | 1.7 MB |
| `aqua-splash` | 1280×720 | 4.4s | 1.6 MB |
| `aqua-tower` | 720×1280 | 2.6s | 0.8 MB |
| `aqua-tower2` | 720×1280 | 2.2s | 0.6 MB |
| `buffet-fruit` | 720×1280 | 4.5s | 1.2 MB |
| `buffet-grill` | 720×1280 | 5.1s | 1.0 MB |
| `buffet-sweets` | 720×1280 | 4.7s | 1.1 MB |
| `cta` | 1280×720 | 6.5s | 1.9 MB |
| `exterior` | 720×1280 | 5.1s | 1.5 MB |
| `games` | 720×1280 | 5.0s | 1.1 MB |
| `garden` | 720×1280 | 5.0s | 1.3 MB |
| `gym` | 720×1280 | 5.1s | 0.8 MB |
| `kids-club` | 720×1280 | 5.1s | 0.8 MB |
| `kids-playground` | 720×1280 | 5.1s | 1.3 MB |
| `kids-pool-aerial` | 1280×720 | 5.5s | 1.2 MB |
| `kids-ship` | 720×1280 | 6.1s | 1.8 MB |
| `kids-ship2` | 720×1280 | 5.1s | 1.6 MB |
| `lobby` | 720×1280 | 5.6s | 1.8 MB |
| `location` | 1280×720 | 6.0s | 2.2 MB |
| `pool-deck` | 720×1280 | 3.0s | 0.9 MB |
| `pool-lagoon` | 1280×720 | 6.5s | 2.1 MB |
| `pool-olympic` | 1280×720 | 6.5s | 1.4 MB |
| `pool-relax` | 720×1280 | 5.1s | 1.6 MB |
| `pool-swim` | 720×1280 | 5.1s | 1.6 MB |
| `poolbar-drinks` | 720×1280 | 5.1s | 1.3 MB |
| `poolbar` | 720×1280 | 5.6s | 1.4 MB |
| `reception` | 720×1280 | 5.6s | 1.8 MB |
| `restaurant` | 720×1280 | 6.1s | 1.4 MB |
| `room-balcony` | 720×1280 | 5.1s | 0.9 MB |
| `room-bath` | 720×1280 | 3.1s | 0.4 MB |
| `room-double` | 720×1280 | 4.2s | 0.6 MB |
| `room-suite` | 720×1280 | 4.7s | 0.4 MB |
| `room-twin` | 720×1280 | 5.1s | 0.6 MB |

## Where each clip is used

* **Homepage** — hero · aqua-aerial, aqua-pov, aqua-tower, aqua-bowl,
  aqua-splash (aquapark) · aqua-splash, pool-lagoon, pool-olympic, kids-ship
  (pools) · kids-ship (kids) · restaurant, poolbar, buffet-grill,
  buffet-sweets, poolbar-drinks (All Inclusive) · room-double, room-suite,
  room-twin, room-bath (rooms) · exterior, lobby, reception, gym, games,
  garden (life strip) · cta (final band).
* **Aquapark page** — aqua-slides-wide (hero + intro) · aqua-bowl,
  aqua-aerial, aqua-pov2, aqua-pov, aqua-tower, aqua-landing (slide cards) ·
  kids-ship2, kids-pool-aerial, kids-playground, aqua-rocks (kids zone) ·
  pool-olympic (swimming) · aqua-bowl (final band).
* **Currently unused spares** — `aqua-pov3`, `aqua-tower2`, `buffet-fruit`,
  `kids-club`, `location`, `pool-deck`, `pool-relax`, `pool-swim`,
  `room-balcony`. All encoded and ready if a section needs different media.

## Stills and icons (`assets/img/`)

* `photo-slides`, `photo-ship`, `photo-lagoon`, `photo-poolbar`,
  `photo-buffet`, `photo-room`, `photo-playground`, `photo-rocks` — 1400×1750
  (4:5) **WebP**, pulled from the 4K sources, used in the homepage photo grid.
* `og-16x9` (1200×630), `og-4x3`, `og-1x1` — social / schema.org images, all
  framed on the aquapark slide complex. **Deliberately still JPEG**: several
  link-preview scrapers (WhatsApp, LinkedIn, some chat clients) still handle
  WebP badly, and these are the share images.
* `icon.svg`, `favicon-48/192/512.png`, `../favicon.ico`,
  `../apple-touch-icon.png` — the anchor mark ("kotva" is Bulgarian for
  *anchor*): a white anchor on the brand red with a gold rim, echoing the
  logo's red anchor, gold sunburst and four stars.

## Regenerating

The two scripts that produced all of this are in `tools/media/`. They read
from the 9.6 GB source folder next to this one, so they only run where that
footage is present: `encode.py` (clips + WebP posters), `stills.py` (photo grid,
OG images, favicons) and `towebp.py` (one-off JPEG→WebP conversion, already
applied — `encode.py` now writes WebP directly). The `CLIPS` table at the top of `encode.py` is the single
source of truth for in-points — if a clip needs recutting, change the
`(source, start, length, orientation)` tuple there and re-run that one slot.

One gotcha: the DJI filenames contain **U+202F** (narrow no-break space), not a
plain space — copying them out of Finder or a terminal listing silently breaks
the path. Resolve them with a glob instead.
