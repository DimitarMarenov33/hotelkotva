#!/usr/bin/env python3
"""Validation pass over the generated site: structure, SEO, i18n and assets."""
import html.parser
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build  # noqa: E402

PAGES = [build.home_file(l) for l in build.LANGS] + [build.aqua_file(l) for l in build.LANGS]
VOID = {"meta", "link", "img", "br", "hr", "input", "source", "path", "circle",
        "rect", "use", "polygon", "ellipse", "line", "area", "col", "embed"}
errors, warnings = [], []


class Balance(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.stack, self.bad = [], []

    def handle_starttag(self, tag, attrs):
        if tag not in VOID:
            self.stack.append(tag)

    def handle_endtag(self, tag):
        if self.stack and self.stack[-1] == tag:
            self.stack.pop()
        elif tag in self.stack:
            self.bad.append(f"</{tag}> while {self.stack[-1]} open")
            while self.stack and self.stack.pop() != tag:
                pass


def check(path):
    p = os.path.join(ROOT, path)
    s = open(p, encoding="utf-8").read()
    tag = path

    b = Balance()
    b.feed(s)
    if b.stack:
        errors.append(f"{tag}: unclosed {b.stack[:4]}")
    if b.bad:
        errors.append(f"{tag}: {b.bad[:3]}")

    # --- one H1, real title/description ---
    h1s = re.findall(r"<h1[ >]", s)
    if len(h1s) != 1:
        errors.append(f"{tag}: {len(h1s)} <h1> (expected 1)")
    title = re.search(r"<title>(.*?)</title>", s, re.S)
    desc = re.search(r'<meta name="description" content="(.*?)">', s, re.S)
    if not title or not title.group(1).strip():
        errors.append(f"{tag}: empty <title>")
    elif len(title.group(1)) > 95:
        warnings.append(f"{tag}: title {len(title.group(1))} chars (>95 may truncate in SERPs)")
    if not desc or not desc.group(1).strip():
        errors.append(f"{tag}: empty description")
    elif not 80 <= len(desc.group(1)) <= 185:
        warnings.append(f"{tag}: description {len(desc.group(1))} chars (aim 120–160)")

    # --- hreflang: full reciprocal set + x-default ---
    hl = dict(re.findall(r'<link rel="alternate" hreflang="([\w-]+)" href="([^"]+)">', s))
    missing = [l for l in build.LANGS if l not in hl]
    if missing:
        errors.append(f"{tag}: hreflang missing {missing}")
    if "x-default" not in hl:
        errors.append(f"{tag}: no x-default hreflang")

    canon = re.search(r'<link rel="canonical" href="([^"]+)">', s)
    if not canon:
        errors.append(f"{tag}: no canonical")

    # --- lang attribute matches the directory ---
    lang = re.search(r'<html lang="(\w+)" data-lang="(\w+)">', s)
    expected = "en" if "/" not in path else path.split("/")[0]
    if not lang:
        errors.append(f"{tag}: no lang attribute")
    elif lang.group(1) != expected or lang.group(2) != expected:
        errors.append(f"{tag}: lang={lang.group(1)}/{lang.group(2)} expected {expected}")

    # --- JSON-LD parses, and the canonical matches the WebPage node ---
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            data = json.loads(m.group(1))
        except json.JSONDecodeError as ex:
            errors.append(f"{tag}: JSON-LD invalid: {ex}")
            continue
        types = [n.get("@type") for n in data.get("@graph", [])]
        for need in ("Hotel", "WebSite", "WebPage", "FAQPage", "TouristAttraction"):
            if need not in types:
                errors.append(f"{tag}: JSON-LD missing {need}")
        for node in data.get("@graph", []):
            if node.get("@type") == "FAQPage" and len(node.get("mainEntity", [])) < 4:
                warnings.append(f"{tag}: only {len(node.get('mainEntity', []))} FAQ entries")

    # --- every referenced local asset exists ---
    for url in set(re.findall(r'(?:src|href|data-src|poster|data-poster|data-desktop-poster|data-mobile-poster)="(/[^"]+)"', s)):
        url = url.split("?")[0]
        if url.startswith("/assets/") or url in ("/favicon.ico", "/apple-touch-icon.png"):
            if not os.path.exists(os.path.join(ROOT, url.lstrip("/"))):
                errors.append(f"{tag}: missing asset {url}")

    # --- internal links resolve to a generated page ---
    valid = {build.home_path(l) for l in build.LANGS} | {build.aqua_path(l) for l in build.LANGS}
    for href in set(re.findall(r'href="(/[^"#?]*)"', s)):
        if href.startswith(("/assets", "/css", "/js")) or href in ("/favicon.ico", "/apple-touch-icon.png"):
            continue
        if href not in valid:
            errors.append(f"{tag}: internal link to nothing: {href}")

    # --- images need alt text and explicit dimensions ---
    for img in re.findall(r"<img [^>]+>", s):
        if 'alt="' not in img:
            errors.append(f"{tag}: <img> without alt")
        if "loading=" not in img:
            warnings.append(f"{tag}: <img> without loading attr")

    # --- stray CJK: a real hazard when authoring Cyrillic by hand ---
    for ch in s:
        if "一" <= ch <= "鿿" or "぀" <= ch <= "ヿ":
            errors.append(f"{tag}: stray CJK character {ch!r}")
            break

    # --- placeholder text must never ship ---
    for bad in ("SET ME", "TODO", "REPLACE-ME", "Lorem ipsum", "hotelopal", "Opal"):
        if bad in s:
            errors.append(f"{tag}: contains placeholder/leftover {bad!r}")


# --- every language must translate every review, or a card silently vanishes ---
import importlib  # noqa: E402
ids = {r[0] for r in build.REVIEWS}
for l in build.LANGS:
    c = importlib.import_module(f"lang.{l}").PAGE
    got = set(c.get("reviews", {}))
    if got != ids:
        errors.append(f"lang/{l}: reviews missing {sorted(ids - got)} extra {sorted(got - ids)}")
    if len(c.get("review_months", [])) != 12:
        errors.append(f"lang/{l}: review_months must have 12 entries")
    if set(c.get("review_party", {})) != {"family", "couple", "group", "solo"}:
        errors.append(f"lang/{l}: review_party keys wrong")
    gids = {r[0] for r in build.GOOGLE_REVIEWS}
    ggot = set(c.get("google_reviews", {}))
    if ggot != gids:
        errors.append(f"lang/{l}: google_reviews missing {sorted(gids - ggot)} extra {sorted(ggot - gids)}")


for page in PAGES:
    check(page)

# --- sitemap covers exactly the generated pages ---
sm = open(os.path.join(ROOT, "sitemap.xml"), encoding="utf-8").read()
locs = set(re.findall(r"<loc>(.*?)</loc>", sm))
expect = {build.DOMAIN + build.home_path(l) for l in build.LANGS} | \
         {build.DOMAIN + build.aqua_path(l) for l in build.LANGS}
if locs != expect:
    errors.append(f"sitemap mismatch: missing {expect - locs}, extra {locs - expect}")

print(f"checked {len(PAGES)} pages\n")
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors:
        print("  ✗", e)
else:
    print("✓ no errors")
if warnings:
    print(f"\nWARNINGS ({len(warnings)}):")
    for w in warnings:
        print("  !", w)
sys.exit(1 if errors else 0)
