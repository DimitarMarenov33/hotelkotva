/* POST /api/booking — fired when a guest reaches the payment step.
   Notifies the owner and schedules the guest's "did you pay?" reminder,
   which /api/screenshot cancels if a screenshot arrives first. */
import {
  json, sendEmail, cancelEmail, validBooking,
  ownerBookingEmail, reminderEmail,
} from "./_shared.js";

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid json" }, 400);
  }
  const b = body.booking;
  if (!validBooking(b)) return json({ error: "invalid booking" }, 400);

  /* Guest re-booked in the same session: drop the previous reminder. */
  if (body.previousReminderId) {
    await cancelEmail(env, body.previousReminderId).catch(() => {});
  }

  const owner = ownerBookingEmail(b);
  await sendEmail(env, {
    to: [env.OWNER_EMAIL],
    subject: owner.subject,
    html: owner.html,
    reply_to: b.email,
  });

  /* No reminder for zero-rate "request booking" flows — no payment is due yet. */
  let reminderId = null;
  if (b.deposit) {
    const hours = Number(env.REMINDER_HOURS) > 0 ? Number(env.REMINDER_HOURS) : 6;
    const rem = reminderEmail(b);
    const scheduled = await sendEmail(env, {
      to: [b.email],
      subject: rem.subject,
      html: rem.html,
      reply_to: env.OWNER_EMAIL,
      scheduled_at: new Date(Date.now() + hours * 3600e3).toISOString(),
    });
    reminderId = scheduled.id || null;
  }

  return json({ ok: true, reminderId });
}
