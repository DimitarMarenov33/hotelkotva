/* POST /api/stripe-webhook — Stripe calls this on checkout.session.completed.
   Verifies the signature against the raw body, then fulfils the booking with
   THREE separate emails: the hotel (HOTEL_EMAIL) gets the reservation with a
   "reply OK to confirm availability" ask whose reply_to is the OWNER — so the
   hotel's reply never reaches the guest; the owner (OWNER_EMAIL) gets their
   own copy with reply_to set to the guest; the guest gets a localized
   confirmation with the welcome pack. The emails ARE the booking record —
   there is no database; reception finalises the booking from its email.

   A non-2xx response makes Stripe retry (up to ~3 days), so the handler
   only errors while fulfilment is still recoverable. An optional
   BOOKINGS_KV namespace binding dedupes those retries; without it a retry
   can at worst duplicate an email — never drop a paid booking. */
import { esc, sendEmail, confirmationEmail, ownerPaidEmail, hotelPaidEmail } from "./_shared.js";
import { verifyStripeSignature } from "./_stripe.js";

async function claimOnce(kv, key) {
  if (!kv) return true;
  try {
    if (await kv.get(key)) return false;
    await kv.put(key, "1", { expirationTtl: 60 * 60 * 24 * 30 });
    return true;
  } catch {
    return true; /* fail open — a paid booking must never be dropped */
  }
}

async function releaseClaim(kv, key) {
  try {
    if (kv) await kv.delete(key);
  } catch {
    /* best-effort — a stuck claim only suppresses a retry email */
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not set.");
    return new Response("Webhook not configured", { status: 500 });
  }

  /* Verify against the raw body — read text, not json. */
  const payload = await request.text();
  const sig = request.headers.get("stripe-signature");
  if (!(await verifyStripeSignature(payload, sig, env.STRIPE_WEBHOOK_SECRET))) {
    return new Response("Invalid signature", { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return new Response("ok (ignored)", { status: 200 });
  }

  const session = event.data && event.data.object;
  if (!session || !session.id ||
      !(session.payment_status === "paid" || session.status === "complete")) {
    return new Response("ok (not paid)", { status: 200 });
  }

  const kv = env.BOOKINGS_KV;
  const claimKey = `fulfill:${session.id}`;
  if (!(await claimOnce(kv, claimKey))) {
    return new Response("ok (already processed)", { status: 200 });
  }

  if (!env.RESEND_API_KEY) {
    console.error("[stripe-webhook] RESEND_API_KEY is not set; cannot fulfil", session.id);
    await releaseClaim(kv, claimKey);
    return new Response("Email not configured", { status: 500 });
  }

  /* Rebuild the booking from the session metadata; the amount Stripe
     actually captured is authoritative for the deposit. */
  const m = session.metadata || {};
  const isTest = m.test === "1"; /* €1 dev payment — mark every email loudly */
  const total = Math.round(Number(m.total)) || 0;
  const depositPaid = session.amount_total != null
    ? Math.round(session.amount_total / 100)
    : Math.round(Number(m.deposit) || 0);
  const b = {
    ref: m.ref,
    lang: m.lang,
    name: m.name,
    email: m.email,
    phone: m.phone,
    checkin: m.checkin,
    checkout: m.checkout,
    nights: m.nights,
    adults: m.adults,
    childAges: m.childAges,
    /* Pre-update sessions carry no room count — they were single-room only. */
    rooms: Math.max(1, Math.round(Number(m.rooms)) || 1),
    guests: m.guests,
    beds: m.beds,
    bedsCode: m.bedsCode,
    requests: m.requests,
    total,
    deposit: depositPaid,
    balance: Math.max(0, total - depositPaid),
  };

  const hotelTo = env.HOTEL_EMAIL;
  const ownerTo = env.OWNER_EMAIL;
  if (!hotelTo && !ownerTo) {
    console.error("[stripe-webhook] No HOTEL_EMAIL/OWNER_EMAIL configured; cannot fulfil", session.id);
    await releaseClaim(kv, claimKey);
    return new Response("Recipients not configured", { status: 500 });
  }

  const testBanner =
    '<p style="background:#b00020;color:#ffffff;padding:12px 16px;border-radius:8px;font-weight:bold">' +
    "ТЕСТОВО ПЛАЩАНЕ — НЕ Е РЕАЛНА РЕЗЕРВАЦИЯ, не я въвеждайте в системата. " +
    "Това е тест на онлайн плащанията. / " +
    "TEST PAYMENT — NOT A REAL BOOKING, do not enter this reservation. " +
    "This is a live end-to-end test of the online payment system: a real €1 " +
    `was charged under reservation ${esc(b.ref)}. You can verify it right now ` +
    "in the Stripe dashboard (Payments — the Stripe reference is in the table " +
    "below); it reaches the bank account with the next regular Stripe payout.</p>";
  const branded = (mail) => ({
    subject: (isTest ? "[TEST — not a real booking] " : "") + mail.subject,
    html: isTest ? testBanner + mail.html : mail.html,
  });

  /* Hotel copy first — it is how the booking is finalised, so a failure
     here must make Stripe retry. Its reply_to is the OWNER: the hotel's
     availability "OK" (or decline) goes to HotelBoost, never the guest. */
  let internalSent = false;
  if (hotelTo) {
    try {
      const mail = branded(hotelPaidEmail(b, session.id, env));
      await sendEmail(env, {
        to: [hotelTo],
        subject: mail.subject,
        html: mail.html,
        reply_to: ownerTo || undefined,
      });
      internalSent = true;
    } catch (e) {
      console.error("[stripe-webhook] Hotel notification failed:", e);
      await releaseClaim(kv, claimKey);
      return new Response("Fulfilment error", { status: 500 });
    }
  }

  /* Owner copy — reply_to is the guest for one-click follow-up. Only
     critical when there was no hotel email to carry the booking. */
  if (ownerTo) {
    try {
      const mail = branded(ownerPaidEmail(b, session.id));
      await sendEmail(env, {
        to: [ownerTo],
        subject: mail.subject,
        html: mail.html,
        reply_to: b.email,
      });
    } catch (e) {
      if (!internalSent) {
        console.error("[stripe-webhook] Owner notification failed:", e);
        await releaseClaim(kv, claimKey);
        return new Response("Fulfilment error", { status: 500 });
      }
      /* Non-fatal: the hotel already has the booking. */
      console.error("[stripe-webhook] Owner copy failed:", e);
    }
  }

  if (/^\S+@\S+\.\S+$/.test(b.email || "")) {
    try {
      const mail = confirmationEmail(b);
      await sendEmail(env, {
        to: [b.email],
        subject: (isTest ? "[TEST] " : "") + mail.subject,
        html: mail.html,
        reply_to: env.HOTEL_EMAIL || env.OWNER_EMAIL,
      });
    } catch (e) {
      /* Non-fatal: the hotel already has the booking and can follow up. */
      console.error("[stripe-webhook] Guest confirmation failed:", e);
    }
  }

  return new Response("ok", { status: 200 });
}
