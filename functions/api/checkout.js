/* POST /api/checkout — the Stripe branch of the booking widget.
   Re-prices the stay server-side from functions/api/_rates.js (the browser
   never sets the amount), then creates a Stripe-hosted Checkout Session for
   the deposit and returns its URL. Fulfilment — all confirmation emails —
   happens in /api/stripe-webhook once Stripe reports the payment.

   With no STRIPE_SECRET_KEY configured the endpoint answers
   { ok, enquiry: true } and the widget degrades to the request-booking flow. */
import { json, validBooking } from "./_shared.js";
import { serverQuote } from "./_rates.js";
import { createCheckoutSession, stripeLocale } from "./_stripe.js";

const PAGE = { en: "/", bg: "/bg/", de: "/de/", ro: "/ro/", ru: "/ru/", uk: "/uk/" };

function clip(s, n) {
  return String(s == null ? "" : s).slice(0, n);
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const b = body && body.booking;
  if (!validBooking(b) || String(b.phone || "").replace(/\D/g, "").length < 6) {
    return json({ error: "invalid booking" }, 400);
  }

  const quote = serverQuote(b);
  if (!quote) return json({ error: "unpriced dates" }, 400);

  if (!env.STRIPE_SECRET_KEY) return json({ ok: true, enquiry: true });

  /* Hidden dev hook (see js/booking.js): with the exact server-side
     DEV_PAY_KEY the charge is overridden to €1 so the live pipeline can be
     tested end-to-end with a real card. The session is labelled [TEST] and
     the webhook marks every resulting email accordingly. */
  const isTest = !!(body.devKey && env.DEV_PAY_KEY && body.devKey === env.DEV_PAY_KEY);

  const lang = PAGE[b.lang] ? b.lang : "en";
  const base = String(env.SITE_URL || new URL(request.url).origin).replace(/\/+$/, "");

  /* The metadata is the whole booking record — Stripe caps values at 500
     chars, hence the clipping. The webhook rebuilds the booking from this. */
  const metadata = {
    ref: b.ref,
    lang,
    name: clip(b.name, 120),
    email: clip(b.email, 200),
    phone: clip(b.phone, 40),
    checkin: b.checkin,
    checkout: b.checkout,
    nights: String(quote.nights),
    adults: String(quote.adults),
    childAges: quote.childAges.join(","),
    rooms: String(quote.rooms),
    guests: clip(b.guests, 120),
    beds: clip(b.beds, 60),
    bedsCode: clip(b.bedsCode, 10),
    requests: clip(b.requests, 450),
    total: String(quote.total),
    deposit: String(quote.deposit),
    balance: String(quote.balance),
  };
  if (isTest) metadata.test = "1";

  let session;
  try {
    session = await createCheckoutSession(env.STRIPE_SECRET_KEY, {
      amountEur: isTest ? 1 : quote.deposit,
      email: b.email,
      productName: (isTest ? "[TEST] " : "") +
        `Hotel Kotva — booking deposit (${quote.depositPct}%)`,
      productDesc:
        `${quote.rooms} × Double Room · ` +
        `${quote.nights} night(s), ${b.checkin} → ${b.checkout} · ` +
        (quote.discount > 0 ? `Direct discount −€${quote.discount} (−${quote.discountPct}%) · ` : "") +
        `Stay total €${quote.total} · Balance €${quote.balance} at reception`,
      successUrl:
        `${base}/booking-confirmed?lang=${lang}` +
        `&ref=${encodeURIComponent(b.ref)}&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${base}${PAGE[lang]}?payment=cancelled`,
      locale: stripeLocale(lang),
      metadata,
    });
  } catch (e) {
    console.error("[checkout] Stripe session failed:", e);
    return json({ error: "stripe unavailable" }, 502);
  }

  return json({ ok: true, url: session.url });
}
