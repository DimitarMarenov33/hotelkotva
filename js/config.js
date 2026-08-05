/* ==========================================================================
   KOTVA_CONFIG — everything the hotel will edit.

   Card payments run through Stripe: the widget asks /api/checkout for a
   Stripe-hosted payment page and every confirmation email is sent by
   /api/stripe-webhook after the deposit is paid.

   ⚠️  RATES ARE NOT SET YET. Every band below is `rate: 0`, so the widget
   runs in REQUEST mode: it shows "Final price confirmed by the hotel", the
   button reads REQUEST BOOKING, and the booking arrives as an enquiry email
   instead of a card payment. Fill in Hotel Kotva's real nightly rates here
   AND in functions/api/_rates.js — identical numbers — and card payment
   turns itself on. See README.md → "Going live".
   ========================================================================== */
window.KOTVA_CONFIG = {
  currency: "EUR",

  /* Occupancy of ONE Double Room (18 m²) — at most 2 adults and 4 people in
     total, i.e. "2+2". A party that does not fit is automatically priced and
     booked as several rooms:
     rooms = max(ceil(adults / roomMaxAdults), ceil(guests / roomMaxGuests)).
     KEEP IN SYNC with ROOM_MAX_ADULTS / ROOM_MAX_GUESTS in
     functions/api/_rates.js — the server recomputes both. */
  roomMaxAdults: 2,
  roomMaxGuests: 4,

  /* How far the guest pickers go, and the ceiling on what the widget books
     on its own. A party larger than this is told to call the hotel.
     KEEP IN SYNC with MAX_ADULTS / MAX_CHILDREN / MAX_ROOMS in
     functions/api/_rates.js, which refuses to price anything larger. */
  maxAdults: 10,
  maxChildren: 10,
  maxRooms: 10,

  /* Nightly STANDARD rates per date band: `rate` is the double room
     (2 adults, All Inclusive) — the price of ONE room, multiplied by the
     number of rooms the party needs. `extraAdult` is the €/night supplement
     for an adult above `roomMaxAdults` in a room; while the cap is 2 it is
     never charged (a 3rd adult books a second room instead).
     Each band covers the DATE OF THE NIGHT, both ends inclusive; a night
     with no band cannot be booked online (season closed).
     The guest pays standard minus `directDiscount`, shown in the widget as a
     crossed-out standard price plus a visible direct-booking discount line.
     DISPLAY ONLY: the amount Stripe charges is computed server-side from the
     identical table in functions/api/_rates.js — EDIT BOTH TOGETHER. */
  rates: [
    /* --- rest of the 2026 season --- */
    { from: "2026-08-05", to: "2026-08-24", rate: 0, extraAdult: 0 }, // high
    { from: "2026-08-25", to: "2026-09-07", rate: 0, extraAdult: 0 }, // shoulder
    { from: "2026-09-08", to: "2026-10-05", rate: 0, extraAdult: 0 }, // low

    /* --- 2027 season --- */
    { from: "2027-05-01", to: "2027-06-14", rate: 0, extraAdult: 0 }, // low
    { from: "2027-06-15", to: "2027-07-05", rate: 0, extraAdult: 0 }, // shoulder
    { from: "2027-07-06", to: "2027-08-24", rate: 0, extraAdult: 0 }, // high
    { from: "2027-08-25", to: "2027-09-12", rate: 0, extraAdult: 0 }, // shoulder
    { from: "2027-09-13", to: "2027-10-10", rate: 0, extraAdult: 0 }  // low
  ],

  /* Share taken off the standard price when booking direct (the whole
     total: room + supplements). 0 hides the discount lines entirely.
     KEEP IN SYNC with DIRECT_DISCOUNT in functions/api/_rates.js. */
  directDiscount: 0.08,

  adultRate: 0,        // fallback €/night per adult above the room cap when a band has no extraAdult (sync _rates.js)
  childRate: 0,        // extra €/night per billable child (sync _rates.js)
  childFreeUnder: 3,   // age (exclusive) under which a child stays free

  minNights: 1,

  /* Share of the total paid by card now to confirm the booking;
     the remainder is paid at reception on arrival.
     KEEP IN SYNC with DEPOSIT_RATE in functions/api/_rates.js. */
  depositRate: 0.26,

  /* "stripe": card deposit via Stripe Checkout (/api/checkout). If the
     server has no Stripe key yet — or the rates above are still 0 — the
     widget degrades to the leave-your-details request flow on its own.
     Any other value restores the IBAN bank-transfer instructions below. */
  paymentProvider: "stripe",

  /* Legacy switch for the bank-transfer flow; leave false with Stripe. */
  paymentUnderDevelopment: false,

  /* Bank details — only shown when paymentProvider is not "stripe".
     ⚠️  SET THESE before switching to the bank-transfer flow. */
  payment: {
    beneficiary: "SET BENEFICIARY NAME",
    iban: "BGXX XXXX XXXX XXXX XXXX XX",
    bic: "SET BIC",
    bank: "SET BANK NAME",
    reference_en: "Hotel Kotva booking {ref} — {name} — {checkin}",
    reference_bg: "Резервация Хотел Котва {ref} — {name} — {checkin}",
    reference_ro: "Rezervare Hotel Kotva {ref} — {name} — {checkin}",
    reference_de: "Hotel-Kotva-Buchung {ref} — {name} — {checkin}",
    reference_ru: "Бронирование Отель Котва {ref} — {name} — {checkin}",
    reference_uk: "Бронювання Готель Котва {ref} — {name} — {checkin}"
  },

  phone: "+359 554 22422"
};
