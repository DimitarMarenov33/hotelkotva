/* POST /api/screenshot — the guest attached a payment screenshot.
   Cancels the scheduled reminder and emails the owner the image with a
   signed one-click confirm link. The guest's confirmation email is sent
   only when the owner clicks that link (see confirm.js) — a screenshot
   alone is never treated as proof of payment. */
import {
  json, sendEmail, cancelEmail, validBooking, signToken, ownerScreenshotEmail,
} from "./_shared.js";

const MAX_IMAGE_CHARS = 8_000_000; // ~6 MB decoded

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const b = body.booking;
  const image = String(body.image || "");
  if (!validBooking(b)) return json({ error: "invalid booking" }, 400);
  const m = image.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=]+)$/);
  if (!m) return json({ error: "invalid image" }, 400);
  if (image.length > MAX_IMAGE_CHARS) return json({ error: "image too large" }, 413);

  if (body.reminderId) {
    await cancelEmail(env, body.reminderId).catch(() => {});
  }

  const token = await signToken(env, {
    ref: b.ref, name: b.name, email: b.email, lang: b.lang,
    checkin: b.checkin, checkout: b.checkout, guests: b.guests,
    beds: b.beds, deposit: b.deposit, balance: b.balance,
  });
  const confirmUrl = `${(env.SITE_URL || "").replace(/\/$/, "")}/api/confirm?token=${token}`;

  const owner = ownerScreenshotEmail(b, confirmUrl);
  await sendEmail(env, {
    to: [env.OWNER_EMAIL],
    subject: owner.subject,
    html: owner.html,
    reply_to: b.email,
    attachments: [{
      filename: `${b.ref}.${m[1] === "png" ? "png" : m[1] === "webp" ? "webp" : "jpg"}`,
      content: m[2],
    }],
  });

  return json({ ok: true });
}
