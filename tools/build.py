#!/usr/bin/env python3
"""
Generate the 12 static pages of the Hotel Kotva site.

Output is plain static HTML — there is no build step at serve time. This
script exists so the six languages can never drift apart structurally: every
page is rendered from the same templates, with the copy coming from
tools/lang/<code>.py. Run it after editing any copy:

    python3 tools/build.py

Everything it writes (index.html, bg/, ro/, ru/, uk/, de/, aquapark.html,
<lang>/aquapark.html, sitemap.xml) is committed as normal source.
"""
import html
import importlib
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

DOMAIN = "https://hotelkotva.eu"
LANGS = ["en", "bg", "ro", "ru", "uk", "de"]
LOCALE = {"en": "en_GB", "bg": "bg_BG", "ro": "ro_RO",
          "ru": "ru_RU", "uk": "uk_UA", "de": "de_DE"}
NATIVE = {"en": "EN", "bg": "BG", "ro": "RO", "ru": "RU", "uk": "UK", "de": "DE"}

# --------------------------------------------------------------------- reviews
# Real Booking.com reviews for Hotel Kotva. Metadata lives here once so it can
# never drift between languages; only the quote text is translated, in
# tools/lang/<code>.py under "reviews", keyed by id.
#
# Quotes are EXCERPTS of what the guest wrote — trimmed, never reworded. The
# headline score is Booking's own and is shown as-is: 7.9 from 95 reviews.
BOOKING_URL = "https://www.booking.com/hotel/bg/kotva.html"
BOOKING_SCORE = "7.9"
BOOKING_COUNT = 95

REVIEWS = [
    # id            name          flag  score party     published    original lang
    ("sarbu",      "Sarbu",       "🇷🇴", "10",  "family", "2023-08-28", "ro"),
    ("adriana",    "Adriana",     "🇷🇴", "10",  "family", "2025-08-07", "ro"),
    ("timea",      "Tímea",       "🇭🇺", "10",  "couple", "2023-09-16", "hu"),
    ("ella",       "Ella",        "🇮🇱", "9.0", "family", "2024-08-22", "ru"),
    ("grecu",      "Grecu",       "🇷🇴", "10",  "family", "2025-10-24", "ro"),
    ("konstantin", "Константин",  "🇵🇱", "10",  "family", "2023-09-08", "ru"),
    ("marina",     "Marina",      "🇧🇬", "10",  "couple", "2023-08-07", "bg"),
    ("margaryta",  "Margaryta",   "🇺🇦", "9.0", "family", "2024-07-22", "ru"),
    ("slowik",     "Słowik",      "🇵🇱", "10",  "family", "2023-08-08", "pl"),
    ("stoyanova",  "Стоянова",    "🇧🇬", "10",  "family", "2024-09-19", "bg"),
    ("andrea",     "Andrea",      "🇨🇿", "10",  "couple", "2024-07-21", "cs"),
    ("stoyanka",   "Stoyanka",    "🇧🇬", "10",  "group",  "2023-09-25", "bg"),
]

# Google reviews, all 5/5. Unlike Booking these carry NO date: Google shows
# relative ages ("a month ago") and pinning that to a real date would be
# inventing precision, so the cards and the schema simply omit it.
GOOGLE_URL = "https://www.google.com/maps/search/?api=1&query=Hotel+Kotva+Sunny+Beach"
GOOGLE_REVIEWS = [
    # id             name                    flag  original lang
    ("olha",        "Ольга Лаптева",         "🇺🇦", "uk"),
    ("paniflower",  "Pani Flower",           "🇵🇱", "pl"),
    ("maryana",     "Мар'яна Сабодашка",     "🇺🇦", "uk"),
    ("wojciech",    "Wojciech Kochanowski",  "🇵🇱", "pl"),
    ("elisaveta",   "Elisaveta Hristova",    "🇧🇬", "en"),
    ("cristina",    "Cristina Alexandru",    "🇷🇴", "ro"),
    ("tomasz",      "Tomasz Walczak",        "🇵🇱", "en"),
    ("antonin",     "Antonín Šípek",         "🇨🇿", "cs"),
]

PHONE = "+359 554 22422"
PHONE_HREF = "+35955422422"
PHONE_ALT = "+359 88 7973568"
GEO = (42.667139, 27.708333)
LASTMOD = "2026-08-04"

# ---------------------------------------------------------------- URL helpers


def home_path(lang):
    return "/" if lang == "en" else f"/{lang}/"


def aqua_path(lang):
    return "/aquapark" if lang == "en" else f"/{lang}/aquapark"


def home_file(lang):
    return "index.html" if lang == "en" else f"{lang}/index.html"


def aqua_file(lang):
    return "aquapark.html" if lang == "en" else f"{lang}/aquapark.html"


def e(s):
    return html.escape(str(s), quote=True)


# ------------------------------------------------------------------ fragments


def hreflang(page):
    """page: 'home' | 'aqua'. Full alternate set + x-default on every page."""
    path = home_path if page == "home" else aqua_path
    out = []
    for l in LANGS:
        out.append(f'<link rel="alternate" hreflang="{l}" href="{DOMAIN}{path(l)}">')
    out.append(f'<link rel="alternate" hreflang="x-default" href="{DOMAIN}{path("en")}">')
    return "\n".join(out)


def lang_redirect(lang, page):
    """Send a first-time visitor on the default page to their own language.
    An explicit pick in the selector (kotva-lang) always wins."""
    if lang != "en":
        return ""
    path = home_path if page == "home" else aqua_path
    m = ", ".join(f'{l}: "{path(l)}"' for l in LANGS)
    return f"""<script>
(function () {{
  try {{
    var map = {{ {m} }};
    var target = map[localStorage.getItem("kotva-lang")];
    if (!target) {{
      var langs = navigator.languages || [navigator.language || ""];
      for (var i = 0; i < langs.length; i++) {{
        var code = String(langs[i]).slice(0, 2).toLowerCase();
        if (map[code]) {{ target = map[code]; break; }}
      }}
    }}
    if (target && target !== "{path('en')}") {{
      window.location.replace(target + window.location.search + window.location.hash);
    }}
  }} catch (err) {{}}
}})();
</script>"""


def head(lang, page, c, title, desc, canonical, og_img="og-16x9"):
    alts = "\n".join(
        f'<meta property="og:locale:alternate" content="{LOCALE[l]}">'
        for l in LANGS if l != lang)
    return f"""<!DOCTYPE html>
<html lang="{lang}" data-lang="{lang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)}</title>
<meta name="description" content="{e(desc)}">

{hreflang(page)}
<link rel="canonical" href="{DOMAIN}{canonical}">

{lang_redirect(lang, page)}

<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{DOMAIN}/assets/img/{og_img}.jpg">
<meta property="og:type" content="website">
<meta property="og:locale" content="{LOCALE[lang]}">
{alts}
<meta property="og:url" content="{DOMAIN}{canonical}">
<meta property="og:site_name" content="Hotel Kotva">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{DOMAIN}/assets/img/{og_img}.jpg">
<meta name="theme-color" content="#A8382B">

<link rel="icon" href="/favicon.ico" sizes="48x48 32x32 16x16">
<link rel="icon" type="image/png" href="/assets/img/favicon-48.png" sizes="48x48">
<link rel="icon" type="image/png" href="/assets/img/favicon-192.png" sizes="192x192">
<link rel="icon" type="image/svg+xml" href="/assets/img/icon.svg">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">

<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@500;600;700;800&amp;family=Manrope:wght@400;500;600;700&amp;display=swap" rel="stylesheet">
<link rel="stylesheet" href="/css/main.css?v=20260804">
"""


LOGO_MARK = """<svg class="logo-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <circle cx="32" cy="32" r="32" fill="#A8382B"/>
        <circle cx="32" cy="32" r="29.2" fill="none" stroke="#E3A93C" stroke-width="1.8"/>
        <g fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round">
          <path d="M32 19v32"/><path d="M20 23h24"/>
          <path d="M17 39c0 8.5 6.8 13.5 15 13.5S47 47.5 47 39"/>
        </g>
        <circle cx="32" cy="15.5" r="4.6" fill="none" stroke="#fff" stroke-width="3.2"/>
        <path d="M13.4 36.2 21 39l-6.4 4.2z" fill="#fff"/>
        <path d="M50.6 36.2 43 39l6.4 4.2z" fill="#fff"/>
      </svg>"""


def logo(lang, c, home=True):
    href = home_path(lang)
    return f"""<a class="logo" href="{href}" aria-label="{e(c['hotel_name'])}">
      {LOGO_MARK}
      <span class="logo-text">
        <span class="logo-word">Kotva</span>
        <span class="logo-sub">{e(c['logo_sub'])} <span class="stars">★★★★</span></span>
      </span>
    </a>"""


def nav_links(lang, c, current):
    """Cross-links the aquapark page from every homepage and vice versa —
    the aquapark page is the main internal link target on the site."""
    items = []
    if current == "home":
        items.append((f"#aquapark", c["nav_aquapark"]))
        items.append((f"#pools", c["nav_pools"]))
        items.append((f"#allinclusive", c["nav_allinclusive"]))
        items.append((f"#rooms", c["nav_rooms"]))
        items.append((f"#location", c["nav_location"]))
        items.append((aqua_path(lang), c["nav_aquapark_page"]))
    else:
        items.append((home_path(lang), c["nav_home"]))
        items.append(("#slides", c["nav_slides"]))
        items.append(("#kids", c["nav_kids"]))
        items.append(("#practical", c["nav_practical"]))
        items.append(("#faq", c["nav_faq"]))
    return items


def lang_select(lang, page):
    path = home_path if page == "home" else aqua_path
    opts = "".join(
        f'<option value="{path(l)}" data-code="{l}"'
        f'{" selected" if l == lang else ""}>{NATIVE[l]}</option>'
        for l in LANGS)
    return f'<select class="lang-select" aria-label="Language">{opts}</select>'


def header(lang, c, page):
    links = "".join(f'<a href="{h}">{e(t)}</a>' for h, t in nav_links(lang, c, page))
    mob = "".join(f'<a href="{h}">{e(t)}</a>' for h, t in nav_links(lang, c, page))
    return f"""<a class="skip-link" href="#main">{e(c['skip'])}</a>

<header class="site-header is-transparent">
  <div class="container">
    {logo(lang, c)}
    <nav class="main-nav" aria-label="{e(c['nav_primary'])}">{links}</nav>
    <div class="header-right">
      {lang_select(lang, page)}
      <a class="phone-link" href="tel:{PHONE_HREF}">{PHONE}</a>
      <button class="btn btn-primary" data-scroll-to-widget type="button">{e(c['cta_book'])}</button>
      <button class="nav-toggle" aria-label="{e(c['open_menu'])}" aria-expanded="false">☰</button>
    </div>
  </div>
</header>

<div class="mobile-menu" aria-hidden="true">
  <button class="mobile-menu-close" aria-label="{e(c['close_menu'])}">✕</button>
  {mob}
  <a class="phone-link" href="tel:{PHONE_HREF}">{PHONE}</a>
  <button class="btn btn-primary" data-scroll-to-widget type="button">{e(c['cta_book'])}</button>
</div>
"""


def footer(lang, c):
    return f"""<div class="mobile-cta-bar">
  <button class="btn btn-primary" data-scroll-to-widget type="button">{e(c['cta_book'])}</button>
  <a class="phone-icon-link" href="tel:{PHONE_HREF}" aria-label="{e(c['call_hotel'])}">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/></svg>
  </a>
</div>

<footer class="site-footer">
  <div class="container">
    <div class="footer-grid">
      <div class="footer-col">
        {logo(lang, c)}
        <p>{e(c['footer_address'])}</p>
        <p><a href="tel:{PHONE_HREF}">{PHONE}</a> · <a href="tel:+359887973568">{PHONE_ALT}</a></p>
        <p>{e(c['footer_reception'])}</p>
      </div>
      <div class="footer-col">
        <p class="footer-title">{e(c['footer_explore'])}</p>
        <a href="{home_path(lang)}">{e(c['nav_home'])}</a>
        <a href="{aqua_path(lang)}">{e(c['nav_aquapark_page'])}</a>
        <a href="{home_path(lang)}#rooms">{e(c['nav_rooms'])}</a>
        <a href="{home_path(lang)}#location">{e(c['nav_location'])}</a>
      </div>
      <div class="footer-col">
        <p class="footer-title">{e(c['footer_languages'])}</p>
        {"".join(f'<a href="{home_path(l)}" hreflang="{l}">{e(c["lang_names"][l])}</a>' for l in LANGS)}
      </div>
    </div>
    <p class="footer-bottom">{e(c['footer_bottom'])}</p>
    <p class="footer-credit">{"Сайт и снимки:" if lang == "bg" else "Website and photos:"} <a href="https://hotelboost.eu/" rel="noopener" class="hb-credit"><img src="/hotelboost-mark.svg" alt="" width="20" height="20" loading="lazy" decoding="async"> HotelBoost</a></p>
  </div>
</footer>

<script src="/js/config.js?v=20260804" defer></script>
<script src="/js/booking.js?v=20260804" defer></script>
<script src="/js/main.js?v=20260804" defer></script>
</body>
</html>
"""


def hero_video(responsive=True):
    """The hero block: video wrap plus, on the homepage, the inline picker that
    chooses desktop or mobile footage BEFORE the browser starts fetching, so
    exactly one file (the right one) is ever downloaded."""
    if not responsive:
        return """<div class="hero-video-wrap">
      <video class="hero-video" autoplay muted loop playsinline preload="auto"
             poster="/assets/poster/aqua-slides-wide.webp" aria-hidden="true">
        <source src="/assets/video/aqua-slides-wide.mp4" type="video/mp4">
      </video>
    </div>"""
    return """<div class="hero-video-wrap">
      <video class="hero-video" autoplay muted loop playsinline preload="auto" poster="/assets/poster/hero.webp" aria-hidden="true"
             data-desktop-src="/assets/video/hero.mp4" data-desktop-poster="/assets/poster/hero.webp"
             data-mobile-src="/assets/video/hero-mobile.mp4" data-mobile-poster="/assets/poster/hero-mobile.webp"></video>
    </div>
    <script>
    /* Phones get the vertical cut, everything else the landscape montage.
       Chosen before the fetch so only one file downloads. Reduced-motion and
       no-JS both fall back to the poster set above. */
    (function () {
      var v = document.querySelector(".hero-video");
      if (!v) return;
      var mobile = window.matchMedia("(max-width: 767px)").matches;
      if (mobile) v.poster = v.dataset.mobilePoster;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
      var s = document.createElement("source");
      s.src = mobile ? v.dataset.mobileSrc : v.dataset.desktopSrc;
      s.type = "video/mp4";
      v.appendChild(s);
      v.load();
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
    })();
    </script>"""


def vid(slot, cls="", extra=""):
    """A lazy tile. The poster is `data-poster`, not `poster`: a real poster
    attribute is fetched as soon as the element lays out, so all ~40 of them
    would land on first paint whether or not the user ever scrolls. js/main.js
    promotes it to a real poster just before the tile enters the viewport."""
    return (f'<video {cls}muted loop playsinline preload="none" '
            f'data-poster="/assets/poster/{slot}.webp" data-src="/assets/video/{slot}.mp4" '
            f'{extra}aria-hidden="true"><source type="video/mp4"></video>')


def review_card(lang, c, rid, name, flag, score, party, published, orig, hidden=False):
    quote = c["reviews"].get(rid)
    if not quote:
        return ""
    y, m, _d = published.split("-")
    meta = f'{c["review_party"][party]} · {c["review_months"][int(m) - 1]} {y}'
    tag = "" if orig == lang else f'<p class="brev-lang">{e(c["review_translated"])}</p>'
    # The duplicated marquee track is decorative: keep it out of the tab order.
    tabindex = ' tabindex="-1"' if hidden else ""
    return (
        f'<a class="brev-card" href="{BOOKING_URL}" target="_blank" rel="noopener nofollow"'
        f'{tabindex}>'
        f'<div class="brev-top"><span class="brev-score">{score}</span>'
        f'<span class="brev-meta">{e(meta)}</span></div>'
        f'<p class="brev-quote">“{e(quote)}”</p>{tag}'
        f'<p class="brev-attr"><span class="brev-flag">{flag}</span>{e(name)} · '
        f'<span class="bdc-logo">Booking<span>.com</span></span> ↗</p></a>')


def review_strip(lang, c):
    """Auto-scrolling strip. The track is duplicated and slides by exactly one
    copy, so it loops seamlessly; the copy is aria-hidden so screen readers and
    the tab order only ever meet each review once."""
    track = "".join(review_card(lang, c, *r) for r in REVIEWS)
    dupe = "".join(review_card(lang, c, *r, hidden=True) for r in REVIEWS)
    return (f'<div class="review-marquee-wrap reveal"><div class="review-marquee">'
            f'<div class="brev-track">{track}</div>'
            f'<div class="brev-track" aria-hidden="true">{dupe}</div>'
            f'</div></div>')


G_ICON = ('<svg class="g-icon" viewBox="0 0 48 48" aria-hidden="true">'
          '<path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>'
          '<path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>'
          '<path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>'
          '<path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>')


def google_grid(lang, c):
    cards = []
    for rid, name, flag, orig in GOOGLE_REVIEWS:
        quote = c["google_reviews"].get(rid)
        if not quote:
            continue
        tag = "" if orig == lang else f'<p class="brev-lang">{e(c["review_translated"])}</p>'
        cards.append(
            f'<a class="review-card reveal" href="{GOOGLE_URL}" target="_blank" rel="noopener nofollow">'
            f'<div class="review-stars" aria-label="5/5">★★★★★</div>'
            f'<p class="review-quote">“{e(quote)}”</p>{tag}'
            f'<p class="review-attr">{G_ICON}<span><span class="brev-flag">{flag}</span> '
            f'{e(name)} · Google ↗</span></p></a>')
    return f'<div class="reviews-grid">{"".join(cards)}</div>'


def review_schema(lang, c):
    """aggregateRating + individual Review nodes, matching what is on the page.
    NOTE: Google does not render star snippets for reviews a business hosts
    about itself, but answer engines do read this — see README §7."""
    out = [f'''      "aggregateRating": {{
        "@type": "AggregateRating",
        "ratingValue": "{BOOKING_SCORE}",
        "bestRating": "10",
        "worstRating": "1",
        "reviewCount": {BOOKING_COUNT}
      }},
      "review": [''']
    nodes = []
    for rid, name, _flag, score, _party, published, _orig in REVIEWS:
        quote = c["reviews"].get(rid)
        if not quote:
            continue
        nodes.append(f'''        {{
          "@type": "Review",
          "author": {{ "@type": "Person", "name": {jstr(name)} }},
          "datePublished": "{published}",
          "reviewRating": {{ "@type": "Rating", "ratingValue": "{score}", "bestRating": "10", "worstRating": "1" }},
          "reviewBody": {jstr(quote)},
          "publisher": {{ "@type": "Organization", "name": "Booking.com" }}
        }}''')
    for rid, name, _flag, _orig in GOOGLE_REVIEWS:
        quote = c["google_reviews"].get(rid)
        if not quote:
            continue
        nodes.append(f'''        {{
          "@type": "Review",
          "author": {{ "@type": "Person", "name": {jstr(name)} }},
          "reviewRating": {{ "@type": "Rating", "ratingValue": "5", "bestRating": "5", "worstRating": "1" }},
          "reviewBody": {jstr(quote)},
          "publisher": {{ "@type": "Organization", "name": "Google" }}
        }}''')
    out.append(",\n".join(nodes))
    out.append("      ],")
    return "\n".join(out)


def faq_block(items):
    out = []
    for q, a in items:
        out.append(
            f'        <details class="reveal">\n'
            f'          <summary>{e(q)} <span class="faq-icon">+</span></summary>\n'
            f'          <p>{a}</p>\n'
            f'        </details>')
    return "\n".join(out)


def faq_schema(items, lang, url):
    ents = ",\n".join(
        '        {\n'
        '          "@type": "Question",\n'
        f'          "name": {jstr(q)},\n'
        '          "acceptedAnswer": { "@type": "Answer", "text": ' + jstr(strip_tags(a)) + ' }\n'
        '        }' for q, a in items)
    return ('    {\n'
            '      "@type": "FAQPage",\n'
            f'      "@id": "{url}#faq",\n'
            f'      "inLanguage": "{lang}",\n'
            '      "mainEntity": [\n' + ents + '\n      ]\n'
            '    }')


def strip_tags(s):
    import re
    return re.sub(r"<[^>]+>", "", s)


def jstr(s):
    import json
    return json.dumps(str(s), ensure_ascii=False)


# ------------------------------------------------------------------- schema
def hotel_schema(lang, c):
    """One Hotel entity, referenced by every page in every language, plus the
    aquapark as a TouristAttraction owned by it — that pairing is what ties
    'hotel' and 'aquapark' together for search engines."""
    amen = ",\n".join(
        '        { "@type": "LocationFeatureSpecification", "name": %s, "value": true }' % jstr(a)
        for a in c["schema_amenities"])
    alt = ", ".join(jstr(a) for a in c["schema_alt_names"])
    REVIEW_SCHEMA = review_schema(lang, c)
    return f"""    {{
      "@type": "Hotel",
      "@id": "{DOMAIN}/#hotel",
      "name": "Hotel Kotva",
      "alternateName": [{alt}],
      "description": {jstr(c['schema_desc'])},
      "url": "{DOMAIN}{home_path(lang)}",
      "image": [
        "{DOMAIN}/assets/img/og-1x1.jpg",
        "{DOMAIN}/assets/img/og-4x3.jpg",
        "{DOMAIN}/assets/img/og-16x9.jpg"
      ],
      "telephone": "{PHONE_HREF}",
      "priceRange": "€€",
      "currenciesAccepted": "EUR",
      "numberOfRooms": 471,
      "starRating": {{ "@type": "Rating", "ratingValue": "4", "bestRating": "5" }},
      "address": {{
        "@type": "PostalAddress",
        "streetAddress": {jstr(c['schema_street'])},
        "addressLocality": {jstr(c['schema_locality'])},
        "addressRegion": "Burgas",
        "postalCode": "8240",
        "addressCountry": "BG"
      }},
      "geo": {{ "@type": "GeoCoordinates", "latitude": {GEO[0]}, "longitude": {GEO[1]} }},
      "checkinTime": "15:00",
      "checkoutTime": "11:00",
      "petsAllowed": true,
      "knowsLanguage": ["bg", "en", "de", "ru"],
{REVIEW_SCHEMA}
      "amenityFeature": [
{amen}
      ],
      "containsPlace": {{ "@id": "{DOMAIN}/#aquapark" }}
    }},
    {{
      "@type": "TouristAttraction",
      "@id": "{DOMAIN}/#aquapark",
      "name": {jstr(c['schema_aqua_name'])},
      "description": {jstr(c['schema_aqua_desc'])},
      "url": "{DOMAIN}{aqua_path(lang)}",
      "image": "{DOMAIN}/assets/img/og-16x9.jpg",
      "isAccessibleForFree": true,
      "publicAccess": false,
      "geo": {{ "@type": "GeoCoordinates", "latitude": {GEO[0]}, "longitude": {GEO[1]} }},
      "containedInPlace": {{ "@id": "{DOMAIN}/#hotel" }}
    }}"""


def page_schema(lang, c, url, name, kind, faq_items, breadcrumb=None):
    parts = [hotel_schema(lang, c)]
    parts.append(f"""    {{
      "@type": "WebSite",
      "@id": "{DOMAIN}/#website",
      "url": "{DOMAIN}/",
      "name": "Hotel Kotva",
      "inLanguage": "{lang}",
      "publisher": {{ "@id": "{DOMAIN}/#hotel" }}
    }}""")
    parts.append(f"""    {{
      "@type": "{kind}",
      "@id": "{url}#webpage",
      "url": "{url}",
      "name": {jstr(name)},
      "inLanguage": "{lang}",
      "isPartOf": {{ "@id": "{DOMAIN}/#website" }},
      "about": {{ "@id": "{DOMAIN}/#{'aquapark' if kind != 'WebPage' or breadcrumb else 'hotel'}" }}
    }}""")
    if breadcrumb:
        crumbs = ",\n".join(
            '        { "@type": "ListItem", "position": %d, "name": %s, "item": "%s" }'
            % (i + 1, jstr(n), u) for i, (n, u) in enumerate(breadcrumb))
        parts.append(f"""    {{
      "@type": "BreadcrumbList",
      "@id": "{url}#breadcrumb",
      "itemListElement": [
{crumbs}
      ]
    }}""")
    parts.append(faq_schema(faq_items, lang, url))
    return ('<script type="application/ld+json">\n{\n  "@context": "https://schema.org",\n'
            '  "@graph": [\n' + ",\n".join(parts) + "\n  ]\n}\n</script>")


# --------------------------------------------------------------- home page
def render_home(lang, c):
    url = DOMAIN + home_path(lang)
    stats = "\n".join(
        f"""        <div class="stat-tile reveal">
          <p class="stat-num">{e(n)}</p>
          <p class="stat-label">{e(l)}</p>
          <p class="stat-note">{e(note)}</p>
        </div>""" for n, l, note in c["stats"])

    chips = "".join(f"<li><span class=\"chip-check\">✓</span> {e(t)}</li>" for t in c["trust"])
    aqua_ticks = "".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in c["aqua_ticks"])

    pools = "\n".join(
        f"""        <article class="slide-card reveal">
          <div class="slide-card-media{' is-portrait' if p['portrait'] else ''}">{vid(p['slot'])}</div>
          <div class="slide-card-body">
            <span class="slide-card-tag">{e(p['tag'])}</span>
            <h3>{e(p['title'])}</h3>
            <p>{e(p['text'])}</p>
          </div>
        </article>""" for p in c["pools"])

    kids = "\n".join(
        f"""          <div class="kids-block reveal">
            <h3>{e(k['h'])}</h3>
            <p>{e(k['p'])}</p>
          </div>""" for k in c["kids_blocks"])

    ai_ticks = "".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in c["ai_ticks"])

    rooms = "\n".join(
        f"""        <article class="room-card reveal">
          <div class="room-media">{vid(r['slot'])}</div>
          <div class="room-body">
            <h3>{e(r['name'])}</h3>
            <ul class="room-meta">{"".join(f"<li>{e(m)}</li>" for m in r["meta"])}</ul>
            <p>{e(r['text'])}</p>
            <button class="btn btn-ghost" data-scroll-to-widget type="button">{e(c['cta_check'])}</button>
          </div>
        </article>""" for r in c["rooms"])

    amenities = "".join(f"<li>{e(a)}</li>" for a in c["room_amenities"])

    ICONS = {
        "restaurant": '<path d="M7 2v6a2 2 0 0 0 4 0V2"/><path d="M9 8v14"/><path d="M17 2c-1.4 1-2 3-2 5s.8 3.5 2 4v11"/>',
        "bar": '<path d="M4 4h16l-8 9-8-9Z"/><path d="M12 13v7"/><path d="M8 20h8"/>',
        "pool": '<path d="M2 9c1.5 1.3 3 1.3 4.5 0S9 7.7 10.5 9s3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/><path d="M2 15c1.5 1.3 3 1.3 4.5 0s3-1.3 4.5 0 3 1.3 4.5 0 3-1.3 4.5 0 3 1.3 4.5 0"/>',
        "slide": '<path d="M4 20c6 0 6-14 12-14"/><path d="M16 6h4v4"/><path d="M2 20h20"/>',
        "kids": '<circle cx="12" cy="12" r="9"/><path d="M12 3c3 3 3 15 0 18M3 12c3-3 15-3 18 0"/>',
        "gym": '<path d="M4 9v6M2 10v4M20 9v6M22 10v4M7 12h10"/><path d="M7 8v8M17 8v8"/>',
        "wifi": '<path d="M2 9c5.5-5.3 14.5-5.3 20 0"/><path d="M5.5 13c3.6-3.4 9.4-3.4 13 0"/><path d="M9 17c1.8-1.7 4.2-1.7 6 0"/><circle cx="12" cy="20" r="0.6" fill="currentColor" stroke="none"/>',
        "parking": '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/>',
        "reception": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
        "games": '<rect x="2" y="7" width="20" height="12" rx="4"/><path d="M7 11v4M5 13h4M16 12h.01M18.5 14.5h.01"/>',
        "spa": '<path d="M12 21c0-5 3-9 8-10-1 5-4 9-8 10z"/><path d="M12 21c0-5-3-9-8-10 1 5 4 9 8 10z"/><path d="M12 21v-6"/>',
        "beach": '<path d="M3 20h18"/><path d="M12 20V9"/><path d="M4 9a8 8 0 0 1 16 0z"/>',
        "doctor": '<path d="M9 3h6v4h4v6h-4v4H9v-4H5V7h4z"/>',
        "animation": '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><path d="M9 9h.01M15 9h.01"/>',
    }
    roof = "\n".join(
        f"""        <div class="roof-item reveal">
          <svg class="roof-icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">{ICONS.get(f['icon'], ICONS['pool'])}</svg>
          <span>{e(f['label'])}</span>
          {f'<small>{e(f["note"])}</small>' if f.get("note") else ''}
        </div>""" for f in c["facilities"])

    stack = "\n".join(
        f"""        <div class="stack-card reveal">
          <div class="stack-num">0{i + 1}</div>
          <p>{s}</p>
        </div>""" for i, s in enumerate(c["stack"]))

    life = "\n".join(
        f"""        <figure class="life-tile reveal">
          {vid(t['slot'])}
          <figcaption>{e(t['cap'])}</figcaption>
        </figure>""" for t in c["life"])

    photos = "\n".join(
        f'        <figure><img src="/assets/img/{p["file"]}.webp" alt="{e(p["alt"])}" loading="lazy" width="1400" height="1750"></figure>'
        for p in c["photos"])

    loc = "".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in c["location_facts"])

    return head(lang, "home", c, c["title"], c["description"], home_path(lang)) + \
        page_schema(lang, c, url, c["title"], "WebPage", c["faq"]) + f"""
</head>
<body>
{header(lang, c, 'home')}
<main id="main">

  <!-- ============ HERO ============ -->
  <section class="hero" id="top">
    {hero_video()}
    <div class="hero-overlay"></div>
    <div class="hero-content container">
      <h1><span class="hero-kicker">{e(c['hero_kicker'])}</span>{e(c['h1'])}</h1>
      <p class="hero-sub">{e(c['hero_sub'])}</p>
      <div class="booking-widget" data-widget="hero"></div>
      <p class="hero-microcopy">{e(c['hero_microcopy'])}</p>
    </div>
  </section>

  <!-- ============ TRUST BAND ============ -->
  <section class="hero-follow">
    <div class="container">
      <div class="trust-marquee">
        <ul class="trust-chips">{chips}</ul>
        <ul class="trust-chips" aria-hidden="true">{chips}</ul>
      </div>
    </div>
  </section>

  <!-- ============ THE AQUAPARK (primary keyword section) ============ -->
  <section class="section" id="aquapark">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(c['aqua_overline'])}</p>
        <h2>{e(c['aqua_h2'])}</h2>
        <p class="lead">{e(c['aqua_lead'])}</p>
      </div>

      <div class="stat-band reveal-stagger">
{stats}
      </div>

      <div class="split" style="margin-top:clamp(2.6rem,5vw,4rem)">
        <div class="split-text reveal">
          <h3 style="font-size:clamp(1.4rem,2.4vw,1.9rem)">{e(c['aqua_h3'])}</h3>
          <p class="lead">{e(c['aqua_p1'])}</p>
          <p class="lead">{e(c['aqua_p2'])}</p>
          <ul class="tick-list">{aqua_ticks}</ul>
          <div class="split-actions">
            <a class="btn btn-primary" href="{aqua_path(lang)}">{e(c['aqua_cta'])}</a>
            <button class="btn btn-ghost" data-scroll-to-widget type="button">{e(c['cta_check'])}</button>
          </div>
        </div>
        <div class="split-media is-wide reveal">
          {vid('aqua-aerial')}
          <span class="split-badge">{e(c['aqua_badge'])}</span>
        </div>
      </div>

      <div class="mosaic reveal-stagger">
        <div class="mosaic-tile is-portrait reveal">{vid('aqua-pov')}<span class="mosaic-cap">{e(c['cap_pov'])}</span></div>
        <div class="mosaic-tile is-portrait reveal">{vid('aqua-tower')}<span class="mosaic-cap">{e(c['cap_tower'])}</span></div>
        <div class="mosaic-tile is-landscape reveal">{vid('aqua-bowl')}<span class="mosaic-cap">{e(c['cap_bowl'])}</span></div>
        <div class="mosaic-tile is-landscape reveal">{vid('aqua-splash')}<span class="mosaic-cap">{e(c['cap_splash'])}</span></div>
      </div>
      <p class="media-caption reveal">{e(c['aqua_caption'])}</p>
    </div>
  </section>

  <!-- ============ POOLS ============ -->
  <section class="section section-alt" id="pools">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(c['pools_overline'])}</p>
        <h2>{e(c['pools_h2'])}</h2>
        <p class="lead">{e(c['pools_lead'])}</p>
      </div>
      <div class="slide-grid reveal-stagger">
{pools}
      </div>
    </div>
  </section>

  <!-- ============ KIDS ============ -->
  <section class="section" id="kids">
    <div class="container">
      <div class="section-head reveal">
        <p class="overline">{e(c['kids_overline'])}</p>
        <h2>{e(c['kids_h2'])}</h2>
        <p class="lead">{e(c['kids_lead'])}</p>
      </div>
      <div class="split">
        <div class="split-media reveal">{vid('kids-ship')}</div>
        <div class="split-text">
{kids}
        </div>
      </div>
    </div>
  </section>

  <!-- ============ ALL INCLUSIVE ============ -->
  <section class="section section-alt" id="allinclusive">
    <div class="container split">
      <div class="split-text reveal">
        <p class="overline">{e(c['ai_overline'])}</p>
        <h2>{e(c['ai_h2'])}</h2>
        <p class="lead">{e(c['ai_lead'])}</p>
        <ul class="tick-list">{ai_ticks}</ul>
      </div>
      <div class="split-media reveal">{vid('restaurant')}</div>
    </div>
    <div class="container mosaic reveal-stagger" style="margin-top:2.4rem">
      <div class="mosaic-tile is-portrait reveal">{vid('poolbar')}<span class="mosaic-cap">{e(c['cap_poolbar'])}</span></div>
      <div class="mosaic-tile is-portrait reveal">{vid('buffet-grill')}<span class="mosaic-cap">{e(c['cap_grill'])}</span></div>
      <div class="mosaic-tile is-landscape reveal">{vid('buffet-sweets')}<span class="mosaic-cap">{e(c['cap_sweets'])}</span></div>
      <div class="mosaic-tile is-landscape reveal">{vid('poolbar-drinks')}<span class="mosaic-cap">{e(c['cap_drinks'])}</span></div>
    </div>
  </section>

  <!-- ============ ROOMS ============ -->
  <section class="section" id="rooms">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(c['rooms_overline'])}</p>
        <h2>{e(c['rooms_h2'])}</h2>
        <p class="lead">{e(c['rooms_lead'])}</p>
      </div>
      <div class="room-grid reveal-stagger">
{rooms}
      </div>
      <div class="split" style="margin-top:clamp(2.6rem,5vw,4rem)">
        <div class="split-media reveal">{vid('room-bath')}</div>
        <div class="split-text reveal">
          <h3>{e(c['rooms_detail_h3'])}</h3>
          <p class="lead">{e(c['rooms_detail_p'])}</p>
          <p class="amenity-title" style="margin-top:1.6rem">{e(c['rooms_amenity_title'])}</p>
          <ul class="amenity-list">{amenities}</ul>
        </div>
      </div>
      <p class="rooms-microcopy reveal">{e(c['rooms_microcopy'])}</p>
    </div>
  </section>

  <!-- ============ FACILITIES ============ -->
  <section class="section section-alt" id="facilities">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <h2>{e(c['roof_h2'])}</h2>
      </div>
      <div class="roof-grid reveal-stagger">
{roof}
      </div>
    </div>
  </section>

  <!-- ============ BOOK DIRECT ============ -->
  <section class="section" id="direct">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(c['stack_overline'])}</p>
        <h2>{e(c['stack_h2'])}</h2>
        <p class="lead">{e(c['stack_lead'])}</p>
      </div>
      <div class="stack-grid reveal-stagger">
{stack}
      </div>
      <p class="stack-closer reveal">{e(c['stack_closer'])}</p>
    </div>
  </section>

  <!-- ============ REVIEWS ============ -->
  <section class="section section-alt" id="reviews">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(c['rev_overline'])}</p>
        <h2>{e(c['rev_h2'])}</h2>
        <p class="lead">{e(c['rev_lead'])}</p>
        <a class="brev-chip" href="{BOOKING_URL}" target="_blank" rel="noopener nofollow">
          <span class="brev-score">{BOOKING_SCORE}</span>
          <span class="brev-chip-text"><strong>{e(c['rev_score_label'])}</strong>{e(c['rev_count'])}</span>
        </a>
      </div>
    </div>

    {review_strip(lang, c)}
    <p class="brev-caption reveal">{e(c['rev_caption'])}</p>

    <div class="container">
      <h3 class="reviews-subhead reveal">{e(c['rev_google_title'])}</h3>
      {google_grid(lang, c)}
      <div class="review-links reveal">
        <a class="review-link" href="https://www.booking.com/hotel/bg/kotva.html" target="_blank" rel="noopener nofollow">Booking.com ↗</a>
        <a class="review-link" href="https://www.tripadvisor.com/Hotel_Review-g499086-d647910-Reviews-Hotel_Kotva-Sunny_Beach_Burgas_Province.html" target="_blank" rel="noopener nofollow">Tripadvisor ↗</a>
        <a class="review-link" href="https://www.google.com/maps/search/?api=1&amp;query=Hotel+Kotva+Sunny+Beach" target="_blank" rel="noopener nofollow">
          <svg class="g-icon" viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
          <span>Google ↗</span>
        </a>
      </div>
    </div>
  </section>

  <!-- ============ FAQ ============ -->
  <section class="section" id="faq">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <h2>{e(c['faq_h2'])}</h2>
      </div>
      <div class="faq-list">
{faq_block(c['faq'])}
      </div>
    </div>
  </section>

  <!-- ============ GALLERY ============ -->
  <section class="section section-alt" id="gallery">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <h2>{e(c['gal_h2'])}</h2>
      </div>
      <div class="life-strip reveal-stagger">
{life}
      </div>
      <div class="photo-grid reveal-stagger">
{photos}
      </div>
      <p class="media-caption reveal">{e(c['gal_caption'])}</p>
    </div>
  </section>

  <!-- ============ LOCATION ============ -->
  <section class="section" id="location">
    <div class="container">
      <div class="section-head reveal">
        <p class="overline">{e(c['loc_overline'])}</p>
        <h2>{e(c['loc_h2'])}</h2>
        <p class="lead">{e(c['loc_lead'])}</p>
      </div>
      <ul class="location-checklist reveal">{loc}</ul>
      <div class="location-map reveal">
        <div class="map-embed">
          <iframe src="https://www.google.com/maps?q=Hotel+Kotva,+Sunny+Beach,+Bulgaria&amp;output=embed" loading="lazy" title="{e(c['map_title'])}" referrerpolicy="no-referrer-when-downgrade"></iframe>
          <span class="map-badge">{e(c['map_badge'])}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ FINAL CTA ============ -->
  <section class="final-cta" id="book">
    <div class="final-cta-video-wrap">{vid('cta')}</div>
    <div class="final-cta-overlay"></div>
    <div class="container">
      <p class="overline">{e(c['cta_overline'])}</p>
      <h2>{e(c['cta_h2'])}</h2>
      <p class="lead">{e(c['cta_lead'])}</p>
      <div class="booking-widget" data-widget="footer"></div>
    </div>
  </section>

</main>
{footer(lang, c)}"""


# ----------------------------------------------------------- aquapark page
def render_aqua(lang, c):
    a = c["aqua"]
    url = DOMAIN + aqua_path(lang)
    stats = "\n".join(
        f"""        <div class="stat-tile reveal">
          <p class="stat-num">{e(n)}</p>
          <p class="stat-label">{e(l)}</p>
          <p class="stat-note">{e(note)}</p>
        </div>""" for n, l, note in a["stats"])

    slides = "\n".join(
        f"""        <article class="slide-card reveal">
          <div class="slide-card-media{' is-portrait' if s['portrait'] else ''}">{vid(s['slot'])}</div>
          <div class="slide-card-body">
            <span class="slide-card-tag">{e(s['tag'])}</span>
            <h3>{e(s['title'])}</h3>
            <p>{e(s['text'])}</p>
          </div>
        </article>""" for s in a["slides"])

    kids = "\n".join(
        f"""          <div class="kids-block reveal">
            <h3>{e(k['h'])}</h3>
            <p>{e(k['p'])}</p>
          </div>""" for k in a["kids"])

    prac = "".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in a["practical"])
    olympic = "".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in a["olympic_ticks"])

    crumbs = [(c["nav_home"], DOMAIN + home_path(lang)), (a["crumb"], url)]

    return head(lang, "aqua", c, a["title"], a["description"], aqua_path(lang)) + \
        page_schema(lang, c, url, a["title"], "WebPage", a["faq"], breadcrumb=crumbs) + f"""
</head>
<body>
{header(lang, c, 'aqua')}
<main id="main">

  <!-- ============ HERO ============ -->
  <section class="hero hero-compact" id="top">
    {hero_video(responsive=False)}
    <div class="hero-overlay"></div>
    <div class="hero-content container">
      <nav class="breadcrumb" aria-label="Breadcrumb">
        <a href="{home_path(lang)}">{e(c['nav_home'])}</a> ›
        <span aria-current="page">{e(a['crumb'])}</span>
      </nav>
      <h1><span class="hero-kicker">{e(a['hero_kicker'])}</span>{e(a['h1'])}</h1>
      <p class="hero-sub">{e(a['hero_sub'])}</p>
      <div class="split-actions" style="justify-content:center;margin-top:1.8rem">
        <button class="btn btn-primary" data-scroll-to-widget type="button">{e(c['cta_book'])}</button>
        <a class="btn btn-ghost" href="#slides">{e(a['hero_cta2'])}</a>
      </div>
    </div>
  </section>

  <section class="hero-follow">
    <div class="container">
      <div class="trust-marquee">
        <ul class="trust-chips">{"".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in a["trust"])}</ul>
        <ul class="trust-chips" aria-hidden="true">{"".join(f'<li><span class="chip-check">✓</span> {e(t)}</li>' for t in a["trust"])}</ul>
      </div>
    </div>
  </section>

  <!-- ============ NUMBERS ============ -->
  <section class="section">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(a['intro_overline'])}</p>
        <h2>{e(a['intro_h2'])}</h2>
        <p class="lead">{e(a['intro_lead'])}</p>
      </div>
      <div class="stat-band reveal-stagger">
{stats}
      </div>
      <div class="split" style="margin-top:clamp(2.6rem,5vw,4rem)">
        <div class="split-text reveal">
          <h3 style="font-size:clamp(1.4rem,2.4vw,1.9rem)">{e(a['intro_h3'])}</h3>
          <p class="lead">{e(a['intro_p1'])}</p>
          <p class="lead">{e(a['intro_p2'])}</p>
        </div>
        <div class="split-media is-wide reveal">
          {vid('aqua-slides-wide')}
          <span class="split-badge">{e(a['intro_badge'])}</span>
        </div>
      </div>
    </div>
  </section>

  <!-- ============ THE SLIDES ============ -->
  <section class="section section-alt" id="slides">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(a['slides_overline'])}</p>
        <h2>{e(a['slides_h2'])}</h2>
        <p class="lead">{e(a['slides_lead'])}</p>
      </div>
      <div class="slide-grid reveal-stagger">
{slides}
      </div>
      <p class="media-caption reveal">{e(a['slides_caption'])}</p>
    </div>
  </section>

  <!-- ============ KIDS ZONE ============ -->
  <section class="section" id="kids">
    <div class="container">
      <div class="section-head reveal">
        <p class="overline">{e(a['kids_overline'])}</p>
        <h2>{e(a['kids_h2'])}</h2>
        <p class="lead">{e(a['kids_lead'])}</p>
      </div>
      <div class="split">
        <div class="split-media reveal">{vid('kids-ship2')}</div>
        <div class="split-text">
{kids}
        </div>
      </div>
      <div class="mosaic reveal-stagger" style="margin-top:2.4rem">
        <div class="mosaic-tile is-landscape reveal">{vid('kids-pool-aerial')}<span class="mosaic-cap">{e(a['cap_kids_aerial'])}</span></div>
        <div class="mosaic-tile is-portrait reveal">{vid('kids-playground')}<span class="mosaic-cap">{e(a['cap_playground'])}</span></div>
        <div class="mosaic-tile is-portrait reveal">{vid('aqua-rocks')}<span class="mosaic-cap">{e(a['cap_rocks'])}</span></div>
      </div>
    </div>
  </section>

  <!-- ============ OLYMPIC POOL ============ -->
  <section class="section section-alt">
    <div class="container split">
      <div class="split-media is-wide reveal">{vid('pool-olympic')}</div>
      <div class="split-text reveal">
        <p class="overline">{e(a['olympic_overline'])}</p>
        <h2>{e(a['olympic_h2'])}</h2>
        <p class="lead">{e(a['olympic_lead'])}</p>
        <ul class="tick-list">{olympic}</ul>
      </div>
    </div>
  </section>

  <!-- ============ PRACTICAL ============ -->
  <section class="section" id="practical">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <p class="overline">{e(a['practical_overline'])}</p>
        <h2>{e(a['practical_h2'])}</h2>
        <p class="lead">{e(a['practical_lead'])}</p>
      </div>
      <ul class="location-checklist reveal" style="margin-left:auto;margin-right:auto">{prac}</ul>
      <p class="media-caption reveal">{e(a['practical_note'])}</p>
    </div>
  </section>

  <!-- ============ FAQ ============ -->
  <section class="section section-alt" id="faq">
    <div class="container">
      <div class="section-head section-head-center reveal">
        <h2>{e(a['faq_h2'])}</h2>
      </div>
      <div class="faq-list">
{faq_block(a['faq'])}
      </div>
    </div>
  </section>

  <!-- ============ FINAL CTA ============ -->
  <section class="final-cta" id="book">
    <div class="final-cta-video-wrap">{vid('aqua-bowl')}</div>
    <div class="final-cta-overlay"></div>
    <div class="container">
      <p class="overline">{e(c['cta_overline'])}</p>
      <h2>{e(a['cta_h2'])}</h2>
      <p class="lead">{e(a['cta_lead'])}</p>
      <div class="booking-widget" data-widget="footer"></div>
    </div>
  </section>

</main>
{footer(lang, c)}"""


# ------------------------------------------------------------------- outputs
def sitemap():
    urls = []
    for page, path in (("home", home_path), ("aqua", aqua_path)):
        for l in LANGS:
            alts = "\n".join(
                f'    <xhtml:link rel="alternate" hreflang="{x}" href="{DOMAIN}{path(x)}"/>'
                for x in LANGS)
            urls.append(
                f"""  <url>
    <loc>{DOMAIN}{path(l)}</loc>
    <lastmod>{LASTMOD}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{'1.0' if page == 'home' and l == 'en' else '0.9' if page == 'home' else '0.8'}</priority>
{alts}
    <xhtml:link rel="alternate" hreflang="x-default" href="{DOMAIN}{path('en')}"/>
  </url>""")
    return ('<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" '
            'xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' +
            "\n".join(urls) + "\n</urlset>\n")


def main():
    written = []
    for lang in LANGS:
        c = importlib.import_module(f"lang.{lang}").PAGE
        for renderer, filename in ((render_home, home_file(lang)),
                                   (render_aqua, aqua_file(lang))):
            path = os.path.join(ROOT, filename)
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                fh.write(renderer(lang, c))
            written.append(filename)
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as fh:
        fh.write(sitemap())
    written.append("sitemap.xml")
    for w in written:
        print("  wrote", w)
    print(f"\n{len(written)} files")


if __name__ == "__main__":
    main()
