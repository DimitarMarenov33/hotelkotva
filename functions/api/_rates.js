/* ==========================================================================
   Authoritative nightly rates for server-side pricing.

   KEEP IN SYNC with the `rates` table in js/config.js — the widget displays
   prices from there, but the amount Stripe actually charges is computed HERE
   (/api/checkout never trusts a price sent by the browser).

   Each band covers the DATE OF THE NIGHT, both ends inclusive. A night with
   no band cannot be booked online (season closed).

   ⚠️  RATES ARE NOT SET YET — every band below is `rate: 0`.
   While a rate is 0 the site is fully functional but runs in REQUEST mode:
   the widget shows "Final price confirmed by the hotel", the button becomes
   REQUEST BOOKING, and /api/checkout is never called — so Stripe cannot be
   asked to charge nothing. Enter Hotel Kotva's real nightly rates here AND in
   js/config.js (identical numbers) and card payment switches on by itself.

   `rate` is the STANDARD price of ONE double room (2 adults, All Inclusive),
   multiplied by the number of rooms the party needs (see ROOM_MAX_* below);
   `extraAdult` is the €/night supplement for an adult above the per-room cap,
   which is never charged while that cap is 2 — a 3rd adult books a second
   room. The guest pays standard minus DIRECT_DISCOUNT.
   ========================================================================== */

export const RATES = [
  /* --- rest of the 2026 season --- */
  { from: "2026-08-05", to: "2026-08-24", rate: 0, extraAdult: 0 }, // high
  { from: "2026-08-25", to: "2026-09-07", rate: 0, extraAdult: 0 }, // shoulder
  { from: "2026-09-08", to: "2026-10-05", rate: 0, extraAdult: 0 }, // low

  /* --- 2027 season --- */
  { from: "2027-05-01", to: "2027-06-14", rate: 0, extraAdult: 0 }, // low
  { from: "2027-06-15", to: "2027-07-05", rate: 0, extraAdult: 0 }, // shoulder
  { from: "2027-07-06", to: "2027-08-24", rate: 0, extraAdult: 0 }, // high
  { from: "2027-08-25", to: "2027-09-12", rate: 0, extraAdult: 0 }, // shoulder
  { from: "2027-09-13", to: "2027-10-10", rate: 0, extraAdult: 0 }, // low
];

export const DIRECT_DISCOUNT = 0.08; // share off the standard total when booking direct (sync js/config.js)
export const ADULT_RATE = 0;       // fallback €/night per adult above the room cap when a band has no extraAdult
export const CHILD_RATE = 0;       // €/night per billable child
export const CHILD_FREE_UNDER = 3; // age (exclusive) under which a child stays free
export const DEPOSIT_RATE = 0.26;  // share of the total charged now by card

/* Occupancy of one Double Room (18 m²): max 2 adults, max 4 people, i.e.
   2 adults + 2 children. Hotel Kotva's own room sheet lists this category as
   sleeping 1–4. Suites (38 m², up to 5) are not bookable online yet — see
   README, "Adding room categories".
   KEEP IN SYNC with roomMaxAdults / roomMaxGuests in js/config.js. */
export const ROOM_MAX_ADULTS = 2;
export const ROOM_MAX_GUESTS = 4;

/* How large a party the widget books on its own: at most MAX_ADULTS adults
   and MAX_CHILDREN children, and never more than MAX_ROOMS rooms. Bigger
   groups are a phone call — the widget says so and this file refuses to
   price them.
   KEEP IN SYNC with maxAdults / maxChildren / maxRooms in js/config.js. */
export const MAX_ADULTS = 10;
export const MAX_CHILDREN = 10;
export const MAX_ROOMS = 10;

const DAY = 86400000;

/* How many rooms a party needs. A 3rd adult, a 3rd child next to 2 adults,
   etc. do not fit in one room, so the stay is priced and booked as several.
   Mirrors roomsNeeded() in js/booking.js. */
export function roomsNeeded(adults, children) {
  const a = Math.max(1, Number(adults) || 0);
  const c = Math.max(0, Number(children) || 0);
  return Math.max(
    1,
    Math.ceil(a / ROOM_MAX_ADULTS),
    Math.ceil((a + c) / ROOM_MAX_GUESTS)
  );
}

function parseISO(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s || ""))) return null;
  const t = Date.parse(s + "T00:00:00Z");
  return Number.isNaN(t) ? null : t;
}

function isoAt(t) {
  return new Date(t).toISOString().slice(0, 10);
}

function rateBand(iso) {
  for (const band of RATES) {
    if (iso >= band.from && iso <= band.to) return band;
  }
  return null;
}

/* Recompute the quote from raw stay parameters. Mirrors computeQuote() in
   js/booking.js. Returns null when the stay is invalid, any night has no
   published rate, or the stay prices to nothing. */
export function serverQuote(req) {
  const ci = parseISO(req.checkin);
  const co = parseISO(req.checkout);
  if (ci == null || co == null || co <= ci) return null;
  const nights = Math.round((co - ci) / DAY);
  /* Sanity bound only — must exceed the longest possible full-season stay. */
  if (nights < 1 || nights > 90) return null;

  const adults = Math.min(MAX_ADULTS, Math.max(1, Number(req.adults) || 2));
  const childAges = Array.isArray(req.childAges)
    ? req.childAges.slice(0, MAX_CHILDREN).map((a) => Math.max(0, Math.min(17, Number(a) || 0)))
    : [];

  /* The party is spread over as many rooms as its occupancy needs; every
     room is charged the full nightly rate. `extraAdults` can only be > 0 if
     ROOM_MAX_ADULTS is raised above the adults a room's beds can take. */
  const rooms = roomsNeeded(adults, childAges.length);
  if (rooms > MAX_ROOMS) return null; /* group booking — handled by phone */
  const extraAdults = Math.max(0, adults - rooms * ROOM_MAX_ADULTS);
  let roomTotal = 0;
  let adultsTotal = 0;
  for (let t = ci; t < co; t += DAY) {
    const band = rateBand(isoAt(t));
    if (band == null) return null;
    roomTotal += rooms * band.rate;
    adultsTotal += extraAdults * (band.extraAdult ?? ADULT_RATE);
  }

  const billableChildren = childAges.filter((a) => a >= CHILD_FREE_UNDER).length;
  /* Standard total first, then the direct-booking discount, then the split —
     the SAME order and rounding as computeQuote() in js/booking.js, so the
     displayed price and the charged price never diverge. */
  const standardTotal = Math.round(
    roomTotal + adultsTotal + billableChildren * CHILD_RATE * nights
  );
  const discount = Math.round(standardTotal * DIRECT_DISCOUNT);
  const total = standardTotal - discount;
  const deposit = Math.round(total * DEPOSIT_RATE);

  /* While RATES are still 0 the stay prices to nothing. The widget already
     routes those stays to the request flow, but refuse here as well so that
     no code path can ever open a Stripe session for €0. */
  if (!(total > 0) || !(deposit > 0)) return null;

  return {
    nights,
    adults,
    childAges,
    rooms,
    standardTotal,
    discount,
    discountPct: Math.round(DIRECT_DISCOUNT * 100),
    total,
    deposit,
    balance: total - deposit,
    depositPct: Math.round(DEPOSIT_RATE * 100),
  };
}
