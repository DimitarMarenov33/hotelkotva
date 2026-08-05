# Hotel Kotva — direct booking site

Static, multilingual direct-reservation site for **Hotel Kotva 4★, Sunny Beach**,
built to the same pattern as the HotelOpal and goldendune projects: vanilla
HTML/CSS/JS served as static files, with Cloudflare Pages Functions behind
`/api/*` for pricing, Stripe checkout and transactional email.

The site's SEO target is the **aquapark** keyword cluster in six languages —
"hotel with aquapark", "aquapark Sunny Beach", "waterslides Nessebar" and their
Bulgarian, Romanian, Russian, Ukrainian and German equivalents.

---

## 1. What is here

```
index.html                 EN home            /
aquapark.html              EN aquapark page   /aquapark
bg|ro|ru|uk|de/index.html  home per language  /bg/ …
bg|ro|ru|uk|de/aquapark.html                  /bg/aquapark …
terms.html                 general terms (6 languages, ?lang=xx)
booking-confirmed.html     Stripe success page (6 languages, ?lang=xx)

css/main.css               the whole design system
js/config.js               EDIT ME — rates, occupancy, deposit, phone
js/booking.js              booking widget (6 languages)
js/main.js                 header, nav, reveal, lazy video

functions/api/             Cloudflare Pages Functions (see §5)
assets/video/  42 clips (60 MB)   assets/poster/  42 WebP posters   assets/img/  WebP stills, JPEG OG images, icons

tools/build.py             regenerates the 12 pages + sitemap.xml
tools/check.py             validates structure, SEO, i18n and assets
tools/lang/<code>.py       ALL page copy, one file per language
robots.txt  sitemap.xml  llms.txt  _headers
```

### The 12 pages are generated

Do **not** hand-edit `index.html`, `aquapark.html` or the `<lang>/` pages —
they are rendered from `tools/lang/*.py` and will be overwritten. Edit the copy
file, then:

```bash
python3 tools/build.py     # rewrite the 12 pages + sitemap.xml
python3 tools/check.py     # validate before committing
```

`check.py` fails the build on unbalanced HTML, a missing or duplicated `<h1>`,
missing hreflang or canonical, invalid JSON-LD, missing schema types, broken
internal links, missing asset files, images without `alt`, stray CJK characters
(a real hazard when hand-authoring Cyrillic) and leftover placeholder text.
It currently reports **0 errors, 0 warnings**.

Everything the generator writes is committed as ordinary source — there is no
build step at serve time and the site works as plain static files.

---

## 2. Going live — the short list

| # | Task | Where |
|---|------|-------|
| 1 | **Enter the real nightly rates** | `js/config.js` **and** `functions/api/_rates.js` — identical numbers |
| 2 | Set Stripe + email env vars | Cloudflare Pages → Settings → Environment variables (§5) |
| 3 | Point `hotelkotva.eu` at the Pages project | Cloudflare |
| 4 | Have the hotel/legal check `terms.html` | §6 |
| 5 | Submit `sitemap.xml` to Google Search Console | all 6 languages |

### ⚠️ Rates are not set — the site is in REQUEST mode

Every rate band in `js/config.js` and `functions/api/_rates.js` is `rate: 0`,
because Hotel Kotva's rate card was not available when this was built. That is
a deliberate, safe default rather than a broken state:

* the widget shows *"Final price confirmed by the hotel"* instead of a number;
* the button becomes **REQUEST BOOKING** instead of *BOOK · PAY €…*;
* `/api/checkout` is never called, so **Stripe can never be asked to charge €0**;
* the booking still reaches the hotel as an enquiry email via `/api/booking`.

`serverQuote()` in `_rates.js` also refuses any stay that prices to zero, so
this holds even if the client is bypassed.

Fill in the real rates in **both** files — they must match, because the browser
displays the price from `config.js` while the amount Stripe charges is
recomputed server-side from `_rates.js`. Card payment then switches on by
itself; no other change is needed.

---

## 3. Room model

One bookable category, matching Hotel Kotva's own room sheet:

* **Double Room, 18 m², up to 2 adults + 2 children** (`ROOM_MAX_ADULTS = 2`,
  `ROOM_MAX_GUESTS = 4`).
* A party that does not fit is automatically priced and booked as several
  rooms — the widget says so before payment.
* Suites (38 m², up to 5) and Economy doubles (16 m²) are presented on the
  homepage but are **not bookable online**; guests are directed to phone or to
  the special-requests field.

**Adding room categories** later means changing four places together:
`js/config.js` (a `rooms` array + a selector in `buildWidget`),
`js/booking.js` (`computeQuote`, the summary and the payload),
`functions/api/_rates.js` (per-category rates in `serverQuote`) and
`functions/api/checkout.js` (the Stripe product description). Keep the client
and server pricing identical or the displayed and charged prices will diverge.

---

## 4. Languages

Six: `en` (default, at `/`), `bg`, `ro`, `ru`, `uk`, `de`.

* Copy lives in `tools/lang/<code>.py`. Every file must define the same keys —
  `check.py` will fail loudly if a page comes out structurally different.
* The booking widget's own strings are in `STRINGS` in `js/booking.js`; all six
  language blocks carry an identical key set (`ru` and `uk` additionally carry
  the `…Few` forms for the Slavic 1 / 2–4 / 5+ plural rule).
* Emails are translated in `functions/api/_shared.js` (`GUEST`).
* `terms.html` and `booking-confirmed.html` carry their own inline `STRINGS`
  and switch on `?lang=xx`.
* Stripe Checkout has no Ukrainian locale, so `uk` falls back to English on
  the payment page only (`functions/api/_stripe.js`).
* A first-time visitor landing on `/` is redirected to their browser language;
  an explicit pick in the selector is stored as `kotva-lang` and always wins.

---

## 5. Backend (Cloudflare Pages Functions)

| Route | Purpose |
|-------|---------|
| `POST /api/checkout` | Re-prices the stay server-side, opens a Stripe Checkout session for the deposit |
| `POST /api/stripe-webhook` | On payment: guest confirmation, owner copy, hotel copy (Bulgarian) |
| `POST /api/booking` | Enquiry / reminder email when there is no card payment |
| `POST /api/screenshot` | Optional bank-transfer screenshot upload |
| `GET  /api/confirm` | Signed one-click confirm link for the owner |

Environment variables:

```
STRIPE_SECRET_KEY      Stripe secret key
STRIPE_WEBHOOK_SECRET  signing secret for /api/stripe-webhook
RESEND_API_KEY         resend.com API key
FROM_EMAIL             e.g. "Hotel Kotva <bookings@hotelkotva.eu>"
OWNER_EMAIL            where owner notifications go
HOTEL_EMAIL            reception's address (Bulgarian booking copy)
CONFIRM_SECRET         long random string, signs the confirm-link tokens
SITE_URL               https://hotelkotva.eu
DEV_PAY_KEY            optional; /?devpay=<key> charges €1 for live testing
```

With no `STRIPE_SECRET_KEY` the checkout endpoint answers
`{ ok, enquiry: true }` and the widget degrades to the request flow, so the
site is safe to deploy before Stripe is configured.

---

## 6. Terms and conditions

`terms.html` describes the mechanics of *this booking system* accurately —
direct booking, EUR pricing, the 26% card deposit, the balance at reception,
availability subject to hotel confirmation, refund if the hotel cannot honour
a reservation. Cancellation terms deliberately defer to a phone call, because
Hotel Kotva's actual cancellation policy was not supplied.

**Have the hotel confirm this document before launch**, in particular the
cancellation and refund wording, and add the operating company's legal name,
registration number and VAT number.

---

## 7. Guest reviews

Two platforms, on every homepage, in all six languages:

* **Booking.com** — 12 reviews in an auto-scrolling strip, headed by the score
  exactly as Booking gives it: **7.9 from 95 reviews**. Each card carries the
  guest's real score (10 / 9.0), party type and month.
* **Google** — 8 reviews, all 5/5, in a static grid below the strip.

Together they span ten countries (RO, BG, PL, HU, CZ, IL, UA, plus English
originals), which is deliberate: it puts native guest wording about the
aquapark into every page language rather than only English.

### How the data is organised

* Metadata (name, country flag, score, party, date, original language) lives
  once in `REVIEWS` / `GOOGLE_REVIEWS` in `tools/build.py`, so it can never
  drift between languages. Only the quote text is translated, in
  `tools/lang/<code>.py` under `reviews` and `google_reviews`, keyed by id.
* `check.py` fails if any language is missing any quote.
* Quotes are **excerpts** — trimmed, never reworded. A "translated" tag appears
  whenever the page language differs from the original, and every card links to
  the review at its source.
* JSON-LD carries `aggregateRating` (Booking's 7.9 / 95) plus 20 `Review`
  nodes, matching the visible text exactly and attributed to the right
  publisher.

### Three judgement calls

**Google reviews carry no date.** Google shows relative ages ("a month ago");
turning that into a real date would be inventing precision, so the cards and
the schema omit it. Booking reviews, which have exact dates, keep them.

**No Google aggregate is claimed.** The overall Google rating and review count
were not available, so nothing is asserted — only Booking's 7.9 / 95, which is
verified.

**Booking's category breakdown is not shown.** It reads Location 8.2,
Facilities 8.2, Staff 7.7, Comfort 7.7, Value 7.6, Cleanliness 7.5 — and
**free Wi-Fi 5.0**. Showing only the flattering ones would be cherry-picking;
showing all of them puts a 5.0 on the page. The overall score alone is the
honest headline. That Wi-Fi number is worth passing to the hotel — it is cheap
to fix and it drags the average down.

**One caveat on rich results:** Google does not render star snippets for
reviews a business hosts about itself, so do not expect stars in the SERP from
this markup. Its value here is GEO — answer engines do read it — plus the
on-page conversion lift.

To change the set: edit `REVIEWS` / `GOOGLE_REVIEWS` in `tools/build.py`, add
the matching quotes in all six language files, rebuild, run `check.py`.

## 8. Facts used on the site

Everything factual comes from Hotel Kotva's own site (kotva-bg.com) and its
listings, and from the August 2026 footage:

4★ · 320 rooms + 151 apartments · 4 outdoor pools · 3 aquapark pools with
**22 waterslides** · half-Olympic pool 25 m × 12.5 m · children's pool with a
pirate ship · aquapark free for guests · All Inclusive from arrival-day lunch
(after 10:30) to departure-day breakfast · buffet restaurant, Bistro "Black
Pearl", pool bar, lobby bar · fitness, massage (extra), games room (extra),
doctor's office, animation, free Wi-Fi, 24/7 reception, playground · beach
250 m, Nessebar 1.5 km, resort centre ~3 km, Burgas Airport ~30 km ·
check-in 15:00 / check-out 11:00 · parking €12/day · pets to 7 kg €10/day ·
phone +359 554 22422 · 42.667139, 27.708333.

**Deliberately not claimed anywhere:** aquapark opening hours, slide height or
age limits, lifeguard cover, and any star/review score. The aquapark page tells
guests to confirm hours and slide access at reception on the day. If the hotel
supplies these, they are worth adding — opening hours in particular are a
common search query.

---

## 9. Media and performance

42 clips and 42 posters, cut from ~9.6 GB of August 2026 footage in the parent
folder. Slot map and encoding notes: **`ASSETS.md`**.

Measured in Chrome against the local dev server:

| | first view (no scroll) | whole page scrolled |
|---|---|---|
| Desktop 1440×900 | **4.8 MB**, FCP ~270 ms | 46 MB |
| Mobile 390×844 | **4.4 MB**, FCP ~260 ms | — |

Almost all of the first view is the hero clip itself, which streams
progressively (`+faststart`) and does not block paint — the poster renders
first. What keeps the number down:

* posters are WebP and held in `data-poster` until the tile is ~400 px from view
  (a real `poster` attribute downloads on layout, which cost 2.6 MB of nothing);
* every non-hero clip is `preload="none"` + `data-src`, loaded and played by an
  IntersectionObserver and paused when it leaves;
* the phone gets its own hero file, chosen before the fetch begins;
* `navigator.connection.saveData` or a 2G `effectiveType` drops the whole page
  to posters only.

### Phone layout

There is a dedicated phone pass at the end of `css/main.css`, tuned against
real viewports rather than left to the generic breakpoints. The thing it is
measured by: **the hero's booking button must be above the fold on a 360×780
screen.** At desktop proportions it was 111 px below it. Getting it there meant
a smaller headline, tighter hero spacing, and pairing the adults/children
pickers on one row (dates stay full width — a native date input needs the
room). Verified visible on 360×780, 390×844 and 414×896.

Also in that pass: pool cards go one-up (two-up left ~3 words per line), the
body gets bottom padding so the sticky CTA bar never covers the footer, and
every interactive target clears ~32 px. Checked for horizontal overflow at
360 px and 390 px — none.
