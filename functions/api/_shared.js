/* ==========================================================================
   Shared helpers for the booking email functions (Cloudflare Pages Functions).

   Env vars (set in Cloudflare Pages → Settings → Environment variables):
     RESEND_API_KEY  - API key from resend.com
     FROM_EMAIL      - verified sender, e.g. "Hotel Kotva <bookings@hotelkotva.eu>"
     OWNER_EMAIL     - where owner notifications go
     CONFIRM_SECRET  - long random string; signs the confirm-link tokens
     SITE_URL        - canonical origin, e.g. https://hotelkotva.eu
     REMINDER_HOURS  - optional, hours before the guest reminder fires (default 6)
   ========================================================================== */

const RESEND_API = "https://api.resend.com/emails";

/* Kotva has no downloadable welcome pack — the direct-booking benefits are
   real perks (free aquapark access, best-price guarantee, early check-in
   priority), so the confirmation email simply states them. */

function siteBase(env) {
  return String((env && env.SITE_URL) || "").replace(/\/+$/, "");
}

export function json(data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json" },
  });
}

export function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

export function fmt(str, map) {
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(map, k) ? map[k] : "");
}

export async function sendEmail(env, msg) {
  const res = await fetch(RESEND_API, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: env.FROM_EMAIL, ...msg }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return res.json();
}

export async function cancelEmail(env, id) {
  await fetch(`${RESEND_API}/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}` },
  });
}

/* ---- stateless signed tokens for the owner's confirm link ---- */

const te = new TextEncoder();

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const s = atob(str.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

async function hmacKey(env) {
  return crypto.subtle.importKey("raw", te.encode(env.CONFIRM_SECRET),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}

export async function signToken(env, payload) {
  const body = te.encode(JSON.stringify(payload));
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(env), body);
  return b64url(new Uint8Array(body)) + "." + b64url(new Uint8Array(sig));
}

export async function verifyToken(env, token) {
  const [body, sig] = String(token || "").split(".");
  if (!body || !sig) return null;
  try {
    const bodyBytes = b64urlDecode(body);
    const ok = await crypto.subtle.verify("HMAC", await hmacKey(env),
      b64urlDecode(sig), bodyBytes);
    return ok ? JSON.parse(new TextDecoder().decode(bodyBytes)) : null;
  } catch {
    return null;
  }
}

/* ---- guest-facing email templates, keyed by the page language ---- */

const GUEST = {
  en: {
    remSubject: "Did you complete your payment? Your Hotel Kotva dates are still available — but not for long",
    remHello: "Hello {name},",
    remP1: "Your reservation {ref} at Hotel Kotva ({checkin} → {checkout}) is waiting for its €{deposit} deposit.",
    remPaid: "Already paid? Reply to this email with a screenshot of the transfer and we will confirm your booking right away.",
    remNotYet: "Not yet? Here are the transfer details again:",
    remUrgency: "Your dates are still available, but not for long — unconfirmed reservations are released.",
    cfSubject: "Reservation {ref} confirmed — Hotel Kotva",
    cfHello: "Hello {name},",
    cfBody: "Your payment has been received — your reservation is confirmed. We look forward to welcoming you!",
    cfFooter: "Show your reservation ID at check-in. Southern Sunny Beach, 8240 Sunny Beach · +359 554 22422",
    packIntro: "What your direct booking includes:",
    packMap: "Free aquapark access — 22 slides, every day of your stay",
    packGuide: "Best price guarantee, better than any booking site",
    packEbook: "Priority on early check-in as soon as a room is ready",
    labels: { dates: "Dates", rooms: "Rooms", guests: "Guests", beds: "Beds", deposit: "Deposit paid", balance: "Due at reception", ref: "Reservation ID", beneficiary: "Beneficiary", bank: "Bank", amount: "Amount", reference: "Transfer note" },
  },
  bg: {
    remSubject: "Завършихте ли плащането? Датите ви в хотел Котва са все още свободни — но не задълго",
    remHello: "Здравейте, {name},",
    remP1: "Резервация {ref} в Хотел Котва ({checkin} → {checkout}) очаква капаро от €{deposit}.",
    remPaid: "Вече преведохте? Отговорете на този имейл със скрийншот от превода и ще потвърдим резервацията веднага.",
    remNotYet: "Все още не? Ето отново данните за превода:",
    remUrgency: "Датите ви са все още свободни, но не задълго — непотвърдените резервации се освобождават.",
    cfSubject: "Резервация {ref} е потвърдена — Хотел Котва",
    cfHello: "Здравейте, {name},",
    cfBody: "Плащането ви е получено — резервацията е потвърдена. Очакваме ви!",
    cfFooter: "Покажете номера на резервацията при настаняване. Южен Слънчев бряг, 8240 Слънчев бряг · +359 554 22422",
    packIntro: "Какво включва вашата директна резервация:",
    packMap: "Безплатен достъп до аквапарка — 22 пързалки, всеки ден от престоя",
    packGuide: "Гарантирано най-добра цена, по-добра от всеки сайт за резервации",
    packEbook: "Предимство при ранно настаняване, щом стаята е готова",
    labels: { dates: "Дати", rooms: "Стаи", guests: "Гости", beds: "Легла", deposit: "Платено капаро", balance: "Дължимо на рецепция", ref: "Номер на резервация", beneficiary: "Бенефициент", bank: "Банка", amount: "Сума", reference: "Основание" },
  },
  ro: {
    remSubject: "Ați finalizat plata? Datele dvs. la Hotel Kotva sunt încă disponibile — dar nu pentru mult timp",
    remHello: "Bună ziua, {name},",
    remP1: "Rezervarea {ref} la Hotel Kotva ({checkin} → {checkout}) așteaptă avansul de €{deposit}.",
    remPaid: "Ați plătit deja? Răspundeți la acest email cu o captură de ecran a transferului și confirmăm rezervarea imediat.",
    remNotYet: "Încă nu? Iată din nou detaliile transferului:",
    remUrgency: "Datele dvs. sunt încă disponibile, dar nu pentru mult timp — rezervările neconfirmate se eliberează.",
    cfSubject: "Rezervarea {ref} este confirmată — Hotel Kotva",
    cfHello: "Bună ziua, {name},",
    cfBody: "Plata a fost primită — rezervarea dvs. este confirmată. Vă așteptăm cu drag!",
    cfFooter: "Prezentați numărul rezervării la check-in. Sunny Beach de sud, 8240 Sunny Beach · +359 554 22422",
    packIntro: "Ce include rezervarea dvs. directă:",
    packMap: "Acces gratuit la aquapark — 22 de tobogane, în fiecare zi a sejurului",
    packGuide: "Garanția celui mai bun preț, mai bun decât pe orice site de rezervări",
    packEbook: "Prioritate la check-in devreme, imediat ce camera este pregătită",
    labels: { dates: "Date", rooms: "Camere", guests: "Oaspeți", beds: "Paturi", deposit: "Avans plătit", balance: "De plată la recepție", ref: "Număr de rezervare", beneficiary: "Beneficiar", bank: "Banca", amount: "Suma", reference: "Detalii transfer" },
  },
  de: {
    remSubject: "Haben Sie Ihre Zahlung abgeschlossen? Ihre Termine im Hotel Kotva sind noch frei — aber nicht mehr lange",
    remHello: "Hallo {name},",
    remP1: "Ihre Reservierung {ref} im Hotel Kotva ({checkin} → {checkout}) wartet auf die Anzahlung von €{deposit}.",
    remPaid: "Schon überwiesen? Antworten Sie auf diese E-Mail mit einem Screenshot der Überweisung und wir bestätigen Ihre Buchung sofort.",
    remNotYet: "Noch nicht? Hier noch einmal die Überweisungsdaten:",
    remUrgency: "Ihre Termine sind noch frei, aber nicht mehr lange — unbestätigte Reservierungen werden freigegeben.",
    cfSubject: "Reservierung {ref} bestätigt — Hotel Kotva",
    cfHello: "Hallo {name},",
    cfBody: "Ihre Zahlung ist eingegangen — Ihre Reservierung ist bestätigt. Wir freuen uns auf Sie!",
    cfFooter: "Zeigen Sie Ihre Reservierungsnummer beim Check-in. Südlicher Sonnenstrand, 8240 Sonnenstrand · +359 554 22422",
    packIntro: "Was Ihre Direktbuchung enthält:",
    packMap: "Freier Eintritt in den Aquapark — 22 Rutschen, an jedem Tag Ihres Aufenthalts",
    packGuide: "Bestpreis-Garantie, günstiger als auf jedem Buchungsportal",
    packEbook: "Vorrang beim frühen Check-in, sobald ein Zimmer fertig ist",
    labels: { dates: "Reisedaten", rooms: "Zimmer", guests: "Gäste", beds: "Betten", deposit: "Gezahlte Anzahlung", balance: "An der Rezeption fällig", ref: "Reservierungsnummer", beneficiary: "Empfänger", bank: "Bank", amount: "Betrag", reference: "Verwendungszweck" },
  },
  ru: {
    remSubject: "Вы завершили оплату? Ваши даты в отеле Котва ещё свободны — но ненадолго",
    remHello: "Здравствуйте, {name}!",
    remP1: "Бронирование {ref} в бутик-отеле Котва ({checkin} → {checkout}) ожидает депозит €{deposit}.",
    remPaid: "Уже оплатили? Ответьте на это письмо со скриншотом перевода, и мы сразу подтвердим бронирование.",
    remNotYet: "Ещё нет? Вот реквизиты для перевода ещё раз:",
    remUrgency: "Ваши даты пока свободны, но ненадолго — неподтверждённые брони освобождаются.",
    cfSubject: "Бронирование {ref} подтверждено — Отель Котва",
    cfHello: "Здравствуйте, {name}!",
    cfBody: "Оплата получена — ваше бронирование подтверждено. Ждём вас!",
    cfFooter: "Назовите номер бронирования при заселении. Южный Солнечный Берег, 8240 Солнечный Берег · +359 554 22422",
    packIntro: "Что включает ваше прямое бронирование:",
    packMap: "Бесплатный доступ в аквапарк — 22 горки, каждый день проживания",
    packGuide: "Гарантия лучшей цены, выгоднее любого сайта бронирования",
    packEbook: "Приоритет на ранний заезд, как только номер готов",
    labels: { dates: "Даты", rooms: "Номера", guests: "Гости", beds: "Кровати", deposit: "Оплаченный депозит", balance: "К оплате на рецепции", ref: "Номер бронирования", beneficiary: "Получатель", bank: "Банк", amount: "Сумма", reference: "Назначение платежа" },
  },
  uk: {
    remSubject: "Ви завершили оплату? Ваші дати в готелі Котва ще вільні — але ненадовго",
    remHello: "Вітаємо, {name}!",
    remP1: "Бронювання {ref} у готелі Котва ({checkin} → {checkout}) очікує депозит €{deposit}.",
    remPaid: "Вже сплатили? Дайте відповідь на цей лист зі скриншотом переказу, і ми одразу підтвердимо бронювання.",
    remNotYet: "Ще ні? Ось реквізити для переказу ще раз:",
    remUrgency: "Ваші дати поки вільні, але ненадовго — непідтверджені бронювання звільняються.",
    cfSubject: "Бронювання {ref} підтверджено — Готель Котва",
    cfHello: "Вітаємо, {name}!",
    cfBody: "Оплату отримано — ваше бронювання підтверджено. Чекаємо на вас!",
    cfFooter: "Назвіть номер бронювання під час заїзду. Південний Сонячний Берег, 8240 Сонячний Берег · +359 554 22422",
    packIntro: "Що включає ваше пряме бронювання:",
    packMap: "Безкоштовний доступ до аквапарку — 22 гірки, щодня протягом усього відпочинку",
    packGuide: "Гарантія найкращої ціни, вигідніше за будь-який сайт бронювання",
    packEbook: "Пріоритет на ранній заїзд, щойно номер готовий",
    labels: { dates: "Дати", rooms: "Номери", guests: "Гості", beds: "Ліжка", deposit: "Сплачений депозит", balance: "До сплати на рецепції", ref: "Номер бронювання", beneficiary: "Отримувач", bank: "Банк", amount: "Сума", reference: "Призначення платежу" },
  },
};

export function guestLang(lang) {
  return GUEST[lang] ? lang : "en";
}

function wrap(inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c2733;max-width:560px;margin:0 auto;padding:8px">
${inner}
<p style="color:#8a97a5;font-size:12px;margin-top:28px">Hotel Kotva · Sunny Beach, Bulgaria · +359 554 22422</p>
</div>`;
}

function rowsTable(rows) {
  return `<table style="border-collapse:collapse;margin:14px 0">${rows
    .filter(([, v]) => v)
    .map(([k, v]) =>
      `<tr><td style="padding:3px 14px 3px 0;color:#5f6b78">${esc(k)}</td><td style="padding:3px 0"><strong>${esc(v)}</strong></td></tr>`)
    .join("")}</table>`;
}

export function reminderEmail(b) {
  const L = GUEST[guestLang(b.lang)];
  const m = { name: esc(b.name), ref: esc(b.ref), checkin: esc(b.checkin), checkout: esc(b.checkout), deposit: esc(b.deposit) };
  const pay = b.payment || {};
  return {
    subject: fmt(L.remSubject, m),
    html: wrap(
      `<p>${fmt(L.remHello, m)}</p>
<p>${fmt(L.remP1, m)}</p>
<p><strong>${L.remPaid}</strong></p>
<p>${L.remNotYet}</p>` +
      rowsTable([
        [L.labels.beneficiary, pay.beneficiary],
        ["IBAN", pay.iban],
        ["BIC", pay.bic],
        [L.labels.bank, pay.bank],
        [L.labels.amount, b.deposit ? "€" + b.deposit : ""],
        [L.labels.reference, b.reference],
      ]) +
      `<p style="color:#9a6b00"><strong>${L.remUrgency}</strong></p>`),
  };
}

export function confirmationEmail(b) {
  const L = GUEST[guestLang(b.lang)];
  const m = { name: esc(b.name), ref: esc(b.ref) };
  /* Only for a party that needed more than one room — a single-room guest
     already knows what they booked, so the row is left out (rowsTable
     drops empty values). */
  const roomsN = Math.max(1, Math.round(Number(b.rooms)) || 1);
  return {
    subject: fmt(L.cfSubject, m),
    html: wrap(
      `<p>${fmt(L.cfHello, m)}</p>
<p style="font-size:17px"><strong>${L.cfBody}</strong></p>` +
      rowsTable([
        [L.labels.dates, `${b.checkin} → ${b.checkout}`],
        [L.labels.rooms, roomsN > 1 ? `${roomsN} × Double Room` : ""],
        [L.labels.guests, b.guests],
        [L.labels.beds, b.beds],
        [L.labels.deposit, b.deposit ? "€" + b.deposit : ""],
        [L.labels.balance, b.balance ? "€" + b.balance : ""],
        [L.labels.ref, b.ref],
      ]) +
      `<div style="margin:22px 0;padding:14px 16px;background:#eef7fb;border-radius:8px">
<p style="margin:0 0 8px"><strong>${L.packIntro}</strong></p>
<p style="margin:6px 0">&#127754;&nbsp; ${L.packMap}</p>
<p style="margin:6px 0">&#127942;&nbsp; ${L.packGuide}</p>
<p style="margin:6px 0">&#128337;&nbsp; ${L.packEbook}</p>
</div>` +
      `<p>${L.cfFooter}</p>`),
  };
}

/* ---- owner-facing emails (English) ---- */

export function ownerBookingEmail(b) {
  const isRequest = !b.deposit;
  const roomsN = Math.max(1, Math.round(Number(b.rooms)) || 1);
  return {
    subject: (isRequest
      ? `Booking request ${b.ref} — ${b.name}`
      : `New booking ${b.ref} — €${b.deposit} deposit expected`) +
      (roomsN > 1 ? ` · ${roomsN} ROOMS` : ""),
    html: wrap(
      `<p><strong>${isRequest ? "New booking request" : "New booking — guest is at the payment step"}.</strong></p>` +
      rowsTable([
        ["Reservation", b.ref],
        ["Guest", b.name],
        ["Email", b.email],
        ["Phone", b.phone],
        ["Dates", `${b.checkin} → ${b.checkout}`],
        ["Rooms", `${roomsN} × Double Room`],
        ["Guests", b.guests],
        ["Beds", b.beds],
        ["Total", b.total ? "€" + b.total : "—"],
        ["Deposit (26%)", b.deposit ? "€" + b.deposit : "—"],
        ["Requests", b.requests],
        ["Transfer note", b.reference],
      ]) +
      (isRequest ? "" : `<p>The guest has the IBAN details. You will get another email if they upload a payment screenshot; a reminder goes to them automatically if they don't.</p>`)),
  };
}

/* Sent by /api/stripe-webhook once Stripe reports the deposit as paid —
   the OWNER's copy (reply_to is the guest for one-click follow-up). The
   hotel gets its own separate hotelPaidEmail below, so the hotel's
   availability reply never reaches the guest. */
export function ownerPaidEmail(b, sessionId) {
  const roomsN = Math.max(1, Math.round(Number(b.rooms)) || 1);
  return {
    subject: `✅ PAID booking ${b.ref} — ${b.name} · ${b.checkin} → ${b.checkout}` +
      (roomsN > 1 ? ` · ${roomsN} ROOMS` : ""),
    html: wrap(
      `<p style="font-size:17px"><strong>✅ New PAID booking${roomsN > 1 ? ` for ${roomsN} rooms` : ""} — the €${esc(b.deposit)} deposit was received by card (Stripe).</strong></p>` +
      rowsTable([
        ["Reservation", b.ref],
        ["Guest", b.name],
        ["Email", b.email],
        ["Phone", b.phone],
        ["Dates", `${b.checkin} → ${b.checkout}`],
        ["Nights", b.nights],
        ["Rooms", `${roomsN} × Double Room`],
        ["Guests", b.guests],
        ["Beds", b.beds],
        ["Stay total", b.total ? "€" + b.total : "—"],
        ["Deposit PAID", b.deposit ? "€" + b.deposit : "—"],
        ["Balance due at reception", b.balance != null ? "€" + b.balance : "—"],
        ["Special requests", b.requests],
        ["Stripe reference", sessionId],
      ]) +
      `<p><strong>The deposit is paid — this reservation is final.</strong> Please enter it into the hotel system and keep ${roomsN > 1 ? `all ${roomsN} rooms` : "the dates"} blocked. The guest has already received a confirmation email in their language; reply to this email to reach them directly.</p>`),
  };
}

/* The hotel's copy of a paid booking — entirely in BULGARIAN for reception,
   with every detail they may need. Sent SEPARATELY from the owner's copy so
   the hotel's availability reply never reaches the guest: the webhook sets
   this email's reply_to to the OWNER, and the hotel is asked to reply "OK"
   (or decline) to confirm the room. */
const BG_MONTHS = ["януари", "февруари", "март", "април", "май", "юни", "юли", "август", "септември", "октомври", "ноември", "декември"];
const BG_DAYS = ["неделя", "понеделник", "вторник", "сряда", "четвъртък", "петък", "събота"];
const BG_LANGS = { en: "английски", bg: "български", ro: "румънски", de: "немски", ru: "руски", uk: "украински" };

/* "2026-08-02" → "2 август 2026 (неделя) · 2026-08-02" — readable for
   reception, ISO kept alongside for typing into the hotel system. */
function bgDate(iso) {
  const t = Date.parse(String(iso || "") + "T00:00:00Z");
  if (Number.isNaN(t)) return String(iso || "");
  const d = new Date(t);
  return `${d.getUTCDate()} ${BG_MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()} (${BG_DAYS[d.getUTCDay()]}) · ${iso}`;
}

export function hotelPaidEmail(b, sessionId, env) {
  const termsUrl = `${siteBase(env)}/terms?lang=bg`;
  const ages = String(b.childAges || "").split(",").map((s) => s.trim()).filter((s) => s !== "");
  const adultsN = Number(b.adults) || 0;
  const guestsBg =
    `${adultsN} ${adultsN === 1 ? "възрастен" : "възрастни"}` +
    (ages.length ? ` + ${ages.length} ${ages.length === 1 ? "дете" : "деца"}` : "");
  /* A party over the 2+1 occupancy of one Double Room books several rooms —
     reception must block them all, so it is stated in the subject too. */
  const roomsN = Math.max(1, Math.round(Number(b.rooms)) || 1);
  const roomsBg = `${roomsN} × Double Room` +
    (roomsN > 1 ? ` (${roomsN} ${roomsN === 1 ? "стая" : "стаи"})` : "");
  const childrenBg = ages.length
    ? `${ages.length} ${ages.length === 1 ? "дете" : "деца"} — на ${ages.join(", ")} г.`
    : "няма";
  /* bedsCode is the raw widget value ("combined"/"twin"; "double" only from
     pre-update cached widgets); b.beds (free text in the guest's language)
     is the fallback for bookings made before the code existed. */
  const bedsBg = b.bedsCode === "twin" ? "Две отделни единични легла"
    : b.bedsCode === "combined" ? "Едно голямо легло (събрани единични)"
    : b.bedsCode === "double" ? "Едно голямо легло"
    : (b.beds || "");
  return {
    subject: `✅ ПЛАТЕНА резервация ${b.ref} — ${b.name} · ${b.checkin} → ${b.checkout}` +
      (roomsN > 1 ? ` · ${roomsN} СТАИ` : "") + " · ОТГОВОРЕТЕ С OK",
    html: wrap(
      `<p style="font-size:17px"><strong>✅ Нова ПЛАТЕНА резервация${roomsN > 1 ? ` за ${roomsN} стаи` : ""} — капаро от €${esc(b.deposit)} е получено с карта (Stripe).</strong></p>` +
      rowsTable([
        ["Номер на резервация", b.ref],
        ["Име на госта", b.name],
        ["Имейл", b.email],
        ["Телефон", b.phone],
        ["Настаняване", bgDate(b.checkin)],
        ["Напускане", bgDate(b.checkout)],
        ["Нощувки", b.nights],
        ["Брой стаи", roomsBg],
        ["Гости", guestsBg],
        ["Деца и възраст", childrenBg],
        ["Легла", bedsBg],
        ["Език на госта", BG_LANGS[b.lang] || b.lang],
        ["Обща сума за престоя", b.total ? "€" + b.total : "—"],
        ["ПЛАТЕНО капаро", b.deposit ? "€" + b.deposit : "—"],
        ["Остатък — плаща се на рецепция", b.balance != null ? "€" + b.balance : "—"],
        ["Специални изисквания", b.requests],
        ["Stripe референция", sessionId],
      ]) +
      `<div style="margin:18px 0;padding:14px 16px;background:#fdf2f0;border:1px solid #A8382B;border-radius:8px">
<p style="margin:0"><strong>Моля, отговорете „OK“ на този имейл</strong>, за да потвърдите, че хотелът има ${roomsN > 1 ? `${roomsN} свободни стаи` : "свободна стая"} за тези дати. Отговорът отива при HotelBoost, не при госта. Ако хотелът е пълен и резервацията не може да бъде приета, отговорете възможно най-бързо — капарото на госта ще бъде възстановено изцяло и с приоритет ще му бъдат предложени най-близките свободни дати (<a href="${termsUrl}">общи условия</a>).</p>
</div>` +
      `<p>Моля, въведете резервацията в системата на хотела и запазете ${roomsN > 1 ? `${roomsN} стаи` : "стаята"} за тези дати. Гостът вече получи имейл с потвърждение на своя език.</p>`),
  };
}

export function ownerScreenshotEmail(b, confirmUrl) {
  return {
    subject: `Payment screenshot for ${b.ref} — review & confirm`,
    html: wrap(
      `<p><strong>${esc(b.name)}</strong> uploaded a payment screenshot for reservation <strong>${esc(b.ref)}</strong> (attached).</p>` +
      rowsTable([
        ["Dates", `${b.checkin} → ${b.checkout}`],
        ["Deposit expected", b.deposit ? "€" + b.deposit : "—"],
        ["Transfer note", b.reference],
        ["Guest email", b.email],
        ["Guest phone", b.phone],
      ]) +
      `<p>Check the screenshot (amount, IBAN, note) and, when the money shows in the bank account, click:</p>
<p style="margin:22px 0"><a href="${esc(confirmUrl)}" style="background:#A8382B;color:#0E2E4B;text-decoration:none;font-weight:bold;padding:12px 22px;border-radius:8px">✓ Confirm reservation ${esc(b.ref)}</a></p>
<p style="color:#5f6b78;font-size:13px">This sends the guest their confirmation email (in their language). A screenshot alone is not proof of payment — verify against the account before confirming.</p>`),
  };
}

/* ---- request validation ---- */

export function validBooking(b) {
  return b && typeof b === "object" &&
    /^KTV-\d{6}-[A-Z0-9]{3}$/.test(b.ref || "") &&
    /^\S+@\S+\.\S+$/.test(b.email || "") &&
    typeof b.name === "string" && b.name.length >= 2 && b.name.length <= 120;
}
