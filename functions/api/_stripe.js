/* ==========================================================================
   Stripe over the REST API (no SDK) — Cloudflare Workers friendly.

   We use Stripe-hosted Checkout: card + Apple Pay + Google Pay with zero
   card handling on our side (PCI SAQ-A) and — because the payment page is
   Stripe-hosted — no Apple Pay domain verification to set up. The whole
   booking rides in the session metadata so /api/stripe-webhook can fulfil
   it without a database.
   ========================================================================== */

const STRIPE_API = "https://api.stripe.com/v1";

export async function createCheckoutSession(secretKey, p) {
  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", p.successUrl);
  body.set("cancel_url", p.cancelUrl);
  body.set("customer_email", p.email);
  body.set("locale", p.locale);
  body.set("line_items[0][quantity]", "1");
  body.set("line_items[0][price_data][currency]", "eur");
  body.set("line_items[0][price_data][unit_amount]", String(Math.round(p.amountEur * 100)));
  body.set("line_items[0][price_data][product_data][name]", p.productName);
  if (p.productDesc) {
    body.set("line_items[0][price_data][product_data][description]", p.productDesc);
  }
  /* Carry the booking on the session AND the resulting payment intent, so
     the webhook can reconstruct and fulfil it with no datastore. */
  for (const [k, v] of Object.entries(p.metadata)) {
    body.set(`metadata[${k}]`, v);
    body.set(`payment_intent_data[metadata][${k}]`, v);
  }

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!res.ok) {
    throw new Error(`Stripe checkout session failed (HTTP ${res.status}): ${await res.text()}`);
  }
  const json = await res.json();
  return { id: json.id, url: json.url };
}

const STRIPE_LOCALES = { en: "en", bg: "bg", ru: "ru", de: "de", ro: "ro",
  /* Stripe Checkout has no uk locale — English is the safe fallback. */
  uk: "en" };

export function stripeLocale(lang) {
  return STRIPE_LOCALES[lang] || "auto";
}

/* ---- webhook signature verification (Web Crypto, constant-time) ---- */

export async function verifyStripeSignature(payload, sigHeader, secret, toleranceSec = 300) {
  if (!sigHeader || !secret) return false;

  const parts = {};
  for (const kv of sigHeader.split(",")) {
    const i = kv.indexOf("=");
    if (i > 0) parts[kv.slice(0, i).trim()] = kv.slice(i + 1).trim();
  }
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const mac = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const expected = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");

  if (!timingSafeEqual(expected, v1)) return false;

  /* Reject stale timestamps to limit replay. */
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(t)) > toleranceSec) return false;

  return true;
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
