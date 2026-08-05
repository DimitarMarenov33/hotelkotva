# Booking backend (Cloudflare Pages Functions)

Endpoints under `/api/`, deployed automatically with the site — no separate
server. Email delivery via [Resend](https://resend.com); card payments via
Stripe-hosted Checkout.

## Card-payment flow (live — see ../STRIPE-SETUP.md)

1. **`POST /api/checkout`** — the widget's confirm button. Re-prices the stay
   server-side from `_rates.js` (the browser never sets the amount) and
   returns a Stripe-hosted Checkout URL for the 26% deposit. The whole
   booking rides in the session metadata — no database.
2. **`POST /api/stripe-webhook`** — Stripe calls it on
   `checkout.session.completed` (HMAC signature verified against the raw
   body). Sends the reservation details to `HOTEL_EMAIL` + `OWNER_EMAIL`
   in one email, and a localized confirmation (EN/BG/RO/DE/RU) with the
   welcome pack to the guest. Errors return non-2xx so Stripe retries —
   a paid booking is never dropped. Optional `BOOKINGS_KV` namespace
   binding dedupes retries.

## Legacy bank-transfer flow (kept as fallback)

1. **`POST /api/booking`** — fired when a guest reaches the IBAN payment step.
   Emails the owner ("new booking, €X deposit expected") and **schedules** a
   reminder email to the guest (default 6 h later): *"Did you complete your
   payment? … your dates are still available — but not for long"*, with the
   IBAN details repeated, in the guest's language.
2. **`POST /api/screenshot`** — fired when the guest attaches a payment
   screenshot. **Cancels the scheduled reminder** and emails the owner the
   image plus a signed one-click **Confirm** link. The guest is *not* auto-
   confirmed: a screenshot is not proof of payment.
3. **`GET /api/confirm?token=…`** — the owner clicks Confirm after checking
   the bank account. Sends the guest their confirmation email (localized:
   EN/BG/RO/DE/RU).

If the API is unreachable (e.g. previewing the HTML locally), the site works
exactly as before — the Viber/WhatsApp hand-off stays the visible fallback.

## Setup (once)

1. Create a free account at **resend.com** → verify the domain
   `hotelkotva.eu` (add the DNS records Resend shows — with DNS in Cloudflare
   this takes a minute) → create an API key.
2. In **Cloudflare Pages → project → Settings → Environment variables**, add
   (Production, and Preview if desired):

   | Variable | Example |
   |---|---|
   | `RESEND_API_KEY` | `re_…` |
   | `FROM_EMAIL` | `Hotel Kotva <bookings@hotelkotva.eu>` |
   | `OWNER_EMAIL` | `you@hotelboost.eu` |
   | `CONFIRM_SECRET` | long random string (`openssl rand -hex 32`) |
   | `SITE_URL` | `https://hotelkotva.eu` |
   | `REMINDER_HOURS` | `6` (optional, default 6) |
   | `STRIPE_SECRET_KEY` | `sk_live_…` (Stripe → Developers → API keys) |
   | `STRIPE_WEBHOOK_SECRET` | `whsec_…` (Stripe → Developers → Webhooks) |
   | `HOTEL_EMAIL` | `nuviaopal@gmail.com` (hotel inbox for reservations) |
   | `DEV_PAY_KEY` | random hex; `/?devpay=<key>` charges €1 for live testing (see ../STRIPE-SETUP.md) |

3. Redeploy. Test: make a booking on the live site with your own email,
   upload any image, click Confirm in the owner email.

Notes:
- Before verifying the domain in Resend you can test with
  `FROM_EMAIL=onboarding@resend.dev` (delivers only to your own address).
- Resend free tier: 3 000 emails/month, 100/day — ample for one hotel.
- The confirm link is HMAC-signed (`CONFIRM_SECRET`) and stateless; clicking
  it twice sends the guest a second copy, which is harmless.
- Future hardening: add Cloudflare Turnstile on the booking form to keep bots
  from triggering emails, and an AI vision pre-check that annotates the
  owner email with whether IBAN/amount/reference are visible in the image.
