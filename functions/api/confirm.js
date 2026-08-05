/* GET /api/confirm?token=… — the owner clicked "Confirm reservation" in the
   screenshot review email. Verifies the signed token and sends the guest
   their confirmation email in their language. */
import { sendEmail, verifyToken, confirmationEmail, esc } from "./_shared.js";

function page(title, body, status) {
  return new Response(
    `<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex">
<title>${esc(title)}</title>
<div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#1c2733">
<h1 style="font-size:22px">${esc(title)}</h1><p>${body}</p></div>`,
    { status: status || 200, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

export async function onRequestGet({ request, env }) {
  const token = new URL(request.url).searchParams.get("token");
  const b = await verifyToken(env, token);
  if (!b) {
    return page("Invalid or tampered link", "This confirmation link could not be verified.", 400);
  }
  const mail = confirmationEmail(b);
  await sendEmail(env, {
    to: [b.email],
    subject: mail.subject,
    html: mail.html,
    reply_to: env.OWNER_EMAIL,
  });
  return page(`✓ Reservation ${b.ref} confirmed`,
    `The confirmation email was sent to <strong>${esc(b.email)}</strong> (${esc(b.lang)}). ` +
    "Clicking this link again will send the guest another copy.");
}
