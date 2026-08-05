/* ==========================================================================
   KOTVA booking widget — one module drives every .booking-widget instance
   (hero + final CTA). Pricing is computed client-side from window.KOTVA_CONFIG;
   emails (owner notification, guest reminder + confirmation) go through the
   Pages Functions in functions/api/, and every backend call degrades
   silently if the API is unreachable. Strings are kept in STRINGS{en,bg,…}
   and picked by <html data-lang="…">.

   Flow (one step on screen at a time — each step replaces the previous):
   1. dates + guests → 2. price + bed preference + contact details →
   3a. paymentProvider "stripe": POST /api/checkout re-prices the stay
       server-side and redirects to Stripe-hosted Checkout for the deposit;
       /api/stripe-webhook sends every confirmation email after payment.
   3b. otherwise: IBAN payment details with a unique HB- reservation ID +
       optional transfer-screenshot upload (emailed to the owner for review).
   Back links let the guest return to an earlier step without losing input.
   ========================================================================== */
(function () {
  "use strict";

  var STRINGS = {
    en: {
      checkin: "Check-in",
      checkout: "Check-out",
      adults: "Adults",
      children: "Children",
      childAge: "Age",
      showPrice: "Book your stay",
      giftsBadge: "🎁 Best price + 3 gifts",
      gift1: "Free aquapark access for every guest, all day, every day",
      gift2: "Best price guarantee — better than any booking site",
      gift3: "Priority on an early check-in when a room is ready",
      nightWord: "night",
      nightWordPlural: "nights",
      adultWord: "adult",
      adultWordPlural: "adults",
      childWord: "child",
      childWordPlural: "children",
      roomWord: "room",
      roomWordPlural: "rooms",
      roomName: "Double Room",
      roomsLine: "Rooms",
      summaryRooms: "Rooms",
      multiRoomNotice: "One Double Room sleeps up to 2 adults + 2 children, so {guests} need {rooms}. The price below and your booking are for {rooms}.",
      total: "Total",
      unratedNotice: "Final price confirmed by the hotel — request below.",
      adultsLine: "Extra adults",
      standardPrice: "Standard price",
      discountLine: "Direct booking discount (−{pct}%)",
      termsText: "I understand that only the {pct}% deposit (€{deposit}) is charged now — not the full price — and I agree to the {terms}.",
      termsLinkText: "general terms and conditions",
      validationTerms: "Please tick the box to accept the terms and conditions.",
      childrenLine: "Children",
      bedsLabel: "Beds",
      roomInfo: "Room: Double Room, 18 m² — up to 2 adults + 2 children · balcony · air conditioning · free aquapark access",
      bedCombined: "1 large bed (twins combined)",
      bedTwin: "2 separate twin beds",
      guestName: "Full name",
      guestEmail: "Email",
      guestPhone: "Phone",
      guestRequests: "Special requests (optional)",
      confirmPay: "BOOK · PAY €{deposit} NOW",
      requestBooking: "REQUEST BOOKING",
      depositLine: "Due now ({pct}%)",
      balanceLine: "At reception on arrival",
      summaryDeposit: "Paid now ({pct}%)",
      summaryBalance: "Due at reception",
      payReassurance: "Confirmation by the hotel as soon as the transfer is received.",
      payUnderDev: "Payment is under development — if you want to book, leave your email here and we'll let you know when it's done.",
      payUnderDevBtn: "LEAVE MY EMAIL",
      payUnderDevThanks: "Thanks — we'll email you at {email} as soon as booking is ready.",
      validationDates: "Please choose a check-in and check-out date.",
      validationGuest: "Please fill in your name, email and phone.",
      validationSeason: "Online booking is open for stays until {lastDate}. For later dates, call us at {phone}.",
      validationGroup: "We book up to {rooms} online. For a larger group, call us at {phone} and we will arrange it for you.",
      payRedirect: "Opening secure payment…",
      payError: "We could not start the payment — please try again or call us at {phone}.",
      payReassuranceCard: "Secure card payment — Visa, Mastercard, Apple Pay, Google Pay. Instant confirmation by email.",
      editStay: "Change dates",
      editGuest: "Back to your details",
      refLabel: "Reservation ID",
      refNote: "Use {ref} as the note (reason) of your bank transfer — that is how the hotel matches your payment.",
      beneficiary: "Beneficiary",
      iban: "IBAN",
      bic: "BIC",
      bank: "Bank",
      amount: "Amount",
      reference: "Transfer note",
      copy: "Copy",
      copied: "Copied",
      payMicrocopy: "Complete the €{deposit} bank transfer within 24 hours to hold your room — the remaining €{balance} is paid at the reception when you arrive. Your booking is confirmed by email as soon as the transfer is received. Questions? Call {phone}.",
      payMicrocopyRequest: "Complete the bank transfer within 24 hours to hold your room. Your booking is confirmed by email as soon as the transfer is received. Questions? Call {phone}.",
      summaryTitle: "Your booking summary",
      summaryDates: "Dates",
      summaryGuests: "Guests",
      summaryBeds: "Beds",
      summaryTotal: "Total",
      summaryRef: "Reservation ID",
      shotTitle: "Already paid? Attach a screenshot for faster confirmation",
      shotHint: "Click, drop or paste (Ctrl+V) an image of the transfer here.",
      shotAttached: "Screenshot attached.",
      shotUploaded: "We received it — your confirmation will arrive by email shortly."
    },
    bg: {
      checkin: "Настаняване",
      checkout: "Напускане",
      adults: "Възрастни",
      children: "Деца",
      childAge: "Възраст",
      showPrice: "Резервирайте престоя си",
      giftsBadge: "🎁 Най-добра цена + 3 подаръка",
      gift1: "Безплатен достъп до аквапарка за всеки гост, цял ден, всеки ден",
      gift2: "Гарантирано най-добра цена — по-добра от всеки сайт за резервации",
      gift3: "Предимство при ранно настаняване, когато стаята е готова",
      nightWord: "нощувка",
      nightWordPlural: "нощувки",
      adultWord: "възрастен",
      adultWordPlural: "възрастни",
      childWord: "дете",
      childWordPlural: "деца",
      roomWord: "стая",
      roomWordPlural: "стаи",
      roomName: "Двойна стая",
      roomsLine: "Стаи",
      summaryRooms: "Стаи",
      multiRoomNotice: "В една двойна стая спят до 2 възрастни + 2 деца, затова за {guests} са нужни {rooms}. Цената по-долу и резервацията ви са за {rooms}.",
      total: "Обща сума",
      unratedNotice: "Крайната цена се потвърждава от хотела — заявете по-долу.",
      adultsLine: "Допълнителни възрастни",
      standardPrice: "Стандартна цена",
      discountLine: "Отстъпка за директна резервация (−{pct}%)",
      termsText: "Разбирам, че сега се заплаща само капаро от {pct}% (€{deposit}), а не цялата сума, и приемам {terms}.",
      termsLinkText: "общите условия",
      validationTerms: "Моля, отбележете полето, за да приемете общите условия.",
      childrenLine: "Деца",
      bedsLabel: "Легла",
      roomInfo: "Стая: Двойна стая, 18 м² — до 2 възрастни + 2 деца · балкон · климатик · безплатен достъп до аквапарка",
      bedCombined: "1 голямо легло (събрани единични)",
      bedTwin: "2 отделни единични легла",
      guestName: "Име и фамилия",
      guestEmail: "Имейл",
      guestPhone: "Телефон",
      guestRequests: "Специални изисквания (по избор)",
      confirmPay: "РЕЗЕРВИРАЙ · ПЛАТИ €{deposit} СЕГА",
      requestBooking: "ЗАЯВИ РЕЗЕРВАЦИЯ",
      depositLine: "Дължимо сега ({pct}%)",
      balanceLine: "На рецепция при настаняване",
      summaryDeposit: "Платено сега ({pct}%)",
      summaryBalance: "Дължимо на рецепция",
      payReassurance: "Потвърждение от хотела веднага след получаване на превода.",
      payUnderDev: "Онлайн плащането е в процес на разработка — ако искате да резервирате, оставете имейла си тук и ще ви уведомим, когато е готово.",
      payUnderDevBtn: "ОСТАВЕТЕ ИМЕЙЛ",
      payUnderDevThanks: "Благодарим — ще ви пишем на {email} веднага щом резервациите заработят.",
      validationDates: "Моля, изберете дата на настаняване и напускане.",
      validationGuest: "Моля, попълнете име, имейл и телефон.",
      validationSeason: "Онлайн резервации се приемат за престой до {lastDate}. За други дати ни се обадете на {phone}.",
      validationGroup: "Онлайн резервираме до {rooms}. За по-голяма група ни се обадете на {phone} и ще организираме всичко за вас.",
      payRedirect: "Отваряме сигурното плащане…",
      payError: "Плащането не можа да започне — опитайте отново или се обадете на {phone}.",
      payReassuranceCard: "Сигурно плащане с карта — Visa, Mastercard, Apple Pay, Google Pay. Незабавно потвърждение по имейл.",
      editStay: "Промени датите",
      editGuest: "Назад към данните",
      refLabel: "Номер на резервация",
      refNote: "Въведете {ref} като основание на банковия превод – така хотелът разпознава плащането ви.",
      beneficiary: "Бенефициент",
      iban: "IBAN",
      bic: "BIC",
      bank: "Банка",
      amount: "Сума",
      reference: "Основание за превода",
      copy: "Копирай",
      copied: "Копирано",
      payMicrocopy: "Преведете капарото от €{deposit} в рамките на 24 часа, за да запазите стаята си — остатъкът от €{balance} се заплаща на рецепцията при пристигане. Резервацията се потвърждава по имейл веднага след получаване на превода. Въпроси? Обадете се на {phone}.",
      payMicrocopyRequest: "Завършете банковия превод в рамките на 24 часа, за да запазите стаята си. Резервацията се потвърждава по имейл веднага след получаване на превода. Въпроси? Обадете се на {phone}.",
      summaryTitle: "Обобщение на резервацията",
      summaryDates: "Дати",
      summaryGuests: "Гости",
      summaryBeds: "Легла",
      summaryTotal: "Обща сума",
      summaryRef: "Номер на резервация",
      shotTitle: "Вече преведохте? Прикачете скрийншот за по-бързо потвърждение",
      shotHint: "Кликнете, пуснете или поставете (Ctrl+V) изображение на превода тук.",
      shotAttached: "Скрийншотът е прикачен.",
      shotUploaded: "Получихме го — потвърждението ще пристигне по имейл съвсем скоро."
    },
    ro: {
      checkin: "Check-in",
      checkout: "Check-out",
      adults: "Adulți",
      children: "Copii",
      childAge: "Vârsta",
      showPrice: "Rezervați sejurul",
      giftsBadge: "🎁 Cel mai bun preț + 3 cadouri",
      gift1: "Acces gratuit la aquapark pentru fiecare oaspete, toată ziua, în fiecare zi",
      gift2: "Garanția celui mai bun preț — mai bun decât pe orice site de rezervări",
      gift3: "Prioritate la check-in devreme, când camera este pregătită",
      nightWord: "noapte",
      nightWordPlural: "nopți",
      adultWord: "adult",
      adultWordPlural: "adulți",
      childWord: "copil",
      childWordPlural: "copii",
      roomWord: "cameră",
      roomWordPlural: "camere",
      roomName: "Cameră dublă",
      roomsLine: "Camere",
      summaryRooms: "Camere",
      multiRoomNotice: "O cameră dublă găzduiește până la 2 adulți + 2 copii, așa că pentru {guests} sunt necesare {rooms}. Prețul de mai jos și rezervarea sunt pentru {rooms}.",
      total: "Total",
      unratedNotice: "Prețul final este confirmat de hotel — trimiteți cererea mai jos.",
      adultsLine: "Adulți suplimentari",
      standardPrice: "Preț standard",
      discountLine: "Reducere pentru rezervare directă (−{pct}%)",
      termsText: "Înțeleg că acum se achită doar avansul de {pct}% (€{deposit}), nu prețul întreg, și sunt de acord cu {terms}.",
      termsLinkText: "termenii și condițiile generale",
      validationTerms: "Vă rugăm să bifați căsuța pentru a accepta termenii și condițiile.",
      childrenLine: "Copii",
      bedsLabel: "Paturi",
      roomInfo: "Cameră: Cameră dublă, 18 m² — până la 2 adulți + 2 copii · balcon · aer condiționat · acces gratuit la aquapark",
      bedCombined: "1 pat mare (paturi unite)",
      bedTwin: "2 paturi single separate",
      guestName: "Nume complet",
      guestEmail: "Email",
      guestPhone: "Telefon",
      guestRequests: "Cerințe speciale (opțional)",
      confirmPay: "REZERVĂ · PLĂTEȘTE €{deposit} ACUM",
      requestBooking: "SOLICITĂ REZERVARE",
      depositLine: "De plată acum ({pct}%)",
      balanceLine: "La recepție, la sosire",
      summaryDeposit: "Plătit acum ({pct}%)",
      summaryBalance: "De plată la recepție",
      payReassurance: "Confirmare din partea hotelului imediat ce transferul este primit.",
      payUnderDev: "Plata online este în curs de dezvoltare — dacă doriți să rezervați, lăsați-vă emailul aici și vă anunțăm când este gata.",
      payUnderDevBtn: "LĂSAȚI EMAILUL",
      payUnderDevThanks: "Mulțumim — vă scriem la {email} imediat ce rezervările sunt gata.",
      validationDates: "Vă rugăm să alegeți datele de check-in și check-out.",
      validationGuest: "Vă rugăm să completați numele, emailul și telefonul.",
      validationSeason: "Rezervările online sunt disponibile pentru sejururi până la {lastDate}. Pentru alte date, sunați la {phone}.",
      validationGroup: "Online rezervăm până la {rooms}. Pentru un grup mai mare, sunați la {phone} și ne ocupăm noi de tot.",
      payRedirect: "Deschidem plata securizată…",
      payError: "Plata nu a putut fi inițiată — încercați din nou sau sunați la {phone}.",
      payReassuranceCard: "Plată securizată cu cardul — Visa, Mastercard, Apple Pay, Google Pay. Confirmare imediată prin email.",
      editStay: "Modifică datele",
      editGuest: "Înapoi la detalii",
      refLabel: "Număr de rezervare",
      refNote: "Introduceți {ref} ca detalii ale transferului bancar – așa hotelul identifică plata dumneavoastră.",
      beneficiary: "Beneficiar",
      iban: "IBAN",
      bic: "BIC",
      bank: "Banca",
      amount: "Suma",
      reference: "Detalii transfer",
      copy: "Copiază",
      copied: "Copiat",
      payMicrocopy: "Finalizați transferul bancar de €{deposit} în 24 de ore pentru a păstra camera — restul de €{balance} se achită la recepție la sosire. Rezervarea este confirmată prin email imediat ce transferul este primit. Întrebări? Sunați la {phone}.",
      payMicrocopyRequest: "Finalizați transferul bancar în 24 de ore pentru a păstra camera. Rezervarea este confirmată prin email imediat ce transferul este primit. Întrebări? Sunați la {phone}.",
      summaryTitle: "Rezumatul rezervării",
      summaryDates: "Date",
      summaryGuests: "Oaspeți",
      summaryBeds: "Paturi",
      summaryTotal: "Total",
      summaryRef: "Număr de rezervare",
      shotTitle: "Ați plătit deja? Atașați o captură de ecran pentru o confirmare mai rapidă",
      shotHint: "Dați click, trageți sau lipiți (Ctrl+V) aici o imagine a transferului.",
      shotAttached: "Captura a fost atașată.",
      shotUploaded: "Am primit-o — confirmarea va sosi prin email în scurt timp."
    },
    de: {
      checkin: "Anreise",
      checkout: "Abreise",
      adults: "Erwachsene",
      children: "Kinder",
      childAge: "Alter",
      showPrice: "Ihren Aufenthalt buchen",
      giftsBadge: "🎁 Bestpreis + 3 Geschenke",
      gift1: "Freier Eintritt in den Aquapark für jeden Gast, den ganzen Tag, jeden Tag",
      gift2: "Bestpreis-Garantie — günstiger als auf jedem Buchungsportal",
      gift3: "Vorrang beim frühen Check-in, sobald ein Zimmer fertig ist",
      nightWord: "Nacht",
      nightWordPlural: "Nächte",
      adultWord: "Erwachsener",
      adultWordPlural: "Erwachsene",
      childWord: "Kind",
      childWordPlural: "Kinder",
      roomWord: "Zimmer",
      roomWordPlural: "Zimmer",
      roomName: "Doppelzimmer",
      roomsLine: "Zimmer",
      summaryRooms: "Zimmer",
      multiRoomNotice: "Ein Doppelzimmer bietet Platz für bis zu 2 Erwachsene + 2 Kinder, für {guests} werden also {rooms} benötigt. Der Preis unten und Ihre Buchung gelten für {rooms}.",
      total: "Gesamt",
      unratedNotice: "Der Endpreis wird vom Hotel bestätigt — unten anfragen.",
      adultsLine: "Zusätzliche Erwachsene",
      standardPrice: "Standardpreis",
      discountLine: "Direktbucher-Rabatt (−{pct}%)",
      termsText: "Ich verstehe, dass jetzt nur die Anzahlung von {pct}% (€{deposit}) berechnet wird — nicht der Gesamtpreis — und ich akzeptiere {terms}.",
      termsLinkText: "die Allgemeinen Geschäftsbedingungen",
      validationTerms: "Bitte setzen Sie das Häkchen, um die Bedingungen zu akzeptieren.",
      childrenLine: "Kinder",
      bedsLabel: "Betten",
      roomInfo: "Zimmer: Doppelzimmer, 18 m² — bis zu 2 Erwachsene + 2 Kinder · Balkon · Klimaanlage · freier Eintritt in den Aquapark",
      bedCombined: "1 großes Bett (zusammengestellt)",
      bedTwin: "2 getrennte Einzelbetten",
      guestName: "Vollständiger Name",
      guestEmail: "E-Mail",
      guestPhone: "Telefon",
      guestRequests: "Sonderwünsche (optional)",
      confirmPay: "BUCHEN · JETZT €{deposit} ZAHLEN",
      requestBooking: "BUCHUNG ANFRAGEN",
      depositLine: "Jetzt fällig ({pct}%)",
      balanceLine: "An der Rezeption bei Anreise",
      summaryDeposit: "Jetzt gezahlt ({pct}%)",
      summaryBalance: "An der Rezeption fällig",
      payReassurance: "Bestätigung durch das Hotel, sobald die Überweisung eingeht.",
      payUnderDev: "Die Online-Zahlung befindet sich noch in Entwicklung — wenn Sie buchen möchten, hinterlassen Sie hier Ihre E-Mail-Adresse und wir melden uns, sobald es so weit ist.",
      payUnderDevBtn: "E-MAIL HINTERLASSEN",
      payUnderDevThanks: "Danke — wir schreiben Ihnen an {email}, sobald die Buchung bereit ist.",
      validationDates: "Bitte wählen Sie ein An- und Abreisedatum.",
      validationGuest: "Bitte Name, E-Mail und Telefon ausfüllen.",
      validationSeason: "Online-Buchungen sind für Aufenthalte bis {lastDate} möglich. Für andere Termine rufen Sie {phone} an.",
      validationGroup: "Online buchen wir bis zu {rooms}. Für eine größere Gruppe rufen Sie {phone} an — wir organisieren alles für Sie.",
      payRedirect: "Sichere Zahlung wird geöffnet…",
      payError: "Die Zahlung konnte nicht gestartet werden — bitte versuchen Sie es erneut oder rufen Sie {phone} an.",
      payReassuranceCard: "Sichere Kartenzahlung — Visa, Mastercard, Apple Pay, Google Pay. Sofortige Bestätigung per E-Mail.",
      editStay: "Reisedaten ändern",
      editGuest: "Zurück zu den Angaben",
      refLabel: "Reservierungsnummer",
      refNote: "Geben Sie {ref} als Verwendungszweck der Überweisung an – so ordnet das Hotel Ihre Zahlung zu.",
      beneficiary: "Empfänger",
      iban: "IBAN",
      bic: "BIC",
      bank: "Bank",
      amount: "Betrag",
      reference: "Verwendungszweck",
      copy: "Kopieren",
      copied: "Kopiert",
      payMicrocopy: "Überweisen Sie die Anzahlung von €{deposit} innerhalb von 24 Stunden, um Ihr Zimmer zu sichern — die restlichen €{balance} zahlen Sie bei Anreise an der Rezeption. Ihre Buchung wird per E-Mail bestätigt, sobald die Überweisung eingeht. Fragen? Rufen Sie {phone} an.",
      payMicrocopyRequest: "Schließen Sie die Überweisung innerhalb von 24 Stunden ab, um Ihr Zimmer zu sichern. Ihre Buchung wird per E-Mail bestätigt, sobald die Überweisung eingeht. Fragen? Rufen Sie {phone} an.",
      summaryTitle: "Ihre Buchungsübersicht",
      summaryDates: "Reisedaten",
      summaryGuests: "Gäste",
      summaryBeds: "Betten",
      summaryTotal: "Gesamt",
      summaryRef: "Reservierungsnummer",
      shotTitle: "Schon überwiesen? Screenshot anhängen für eine schnellere Bestätigung",
      shotHint: "Klicken, ziehen oder fügen Sie (Strg+V) hier ein Bild der Überweisung ein.",
      shotAttached: "Screenshot angehängt.",
      shotUploaded: "Erhalten — Ihre Bestätigung kommt in Kürze per E-Mail."
    },
    ru: {
      checkin: "Заезд",
      checkout: "Выезд",
      adults: "Взрослые",
      children: "Дети",
      childAge: "Возраст",
      showPrice: "Забронировать проживание",
      giftsBadge: "🎁 Лучшая цена + 3 подарка",
      gift1: "Бесплатный доступ в аквапарк для каждого гостя, весь день, каждый день",
      gift2: "Гарантия лучшей цены — выгоднее, чем на любом сайте бронирования",
      gift3: "Приоритет на ранний заезд, когда номер готов",
      nightWord: "ночь",
      nightWordFew: "ночи",
      nightWordPlural: "ночей",
      adultWord: "взрослый",
      adultWordFew: "взрослых",
      adultWordPlural: "взрослых",
      childWord: "ребёнок",
      childWordFew: "ребёнка",
      childWordPlural: "детей",
      roomWord: "номер",
      roomWordFew: "номера",
      roomWordPlural: "номеров",
      roomName: "Двухместный номер",
      roomsLine: "Номера",
      summaryRooms: "Номера",
      multiRoomNotice: "В одном двухместном номере размещаются до 2 взрослых + 2 детей, поэтому для {guests} нужно {rooms}. Цена ниже и ваше бронирование — за {rooms}.",
      total: "Итого",
      unratedNotice: "Точную цену подтвердит отель — отправьте запрос ниже.",
      adultsLine: "Дополнительные взрослые",
      standardPrice: "Стандартная цена",
      discountLine: "Скидка за прямое бронирование (−{pct}%)",
      termsText: "Я понимаю, что сейчас списывается только депозит {pct}% (€{deposit}), а не вся сумма, и соглашаюсь с {terms}.",
      termsLinkText: "общими условиями",
      validationTerms: "Пожалуйста, отметьте поле, чтобы принять общие условия.",
      childrenLine: "Дети",
      bedsLabel: "Кровати",
      roomInfo: "Номер: двухместный, 18 м² — до 2 взрослых + 2 детей · балкон · кондиционер · бесплатный доступ в аквапарк",
      bedCombined: "1 большая кровать (сдвинутые)",
      bedTwin: "2 раздельные односпальные кровати",
      guestName: "Имя и фамилия",
      guestEmail: "Email",
      guestPhone: "Телефон",
      guestRequests: "Особые пожелания (необязательно)",
      confirmPay: "ЗАБРОНИРОВАТЬ · ОПЛАТИТЬ €{deposit} СЕЙЧАС",
      requestBooking: "ОТПРАВИТЬ ЗАПРОС",
      depositLine: "К оплате сейчас ({pct}%)",
      balanceLine: "На стойке регистрации при заезде",
      summaryDeposit: "Оплачено сейчас ({pct}%)",
      summaryBalance: "К оплате на рецепции",
      payReassurance: "Подтверждение от отеля сразу после получения перевода.",
      payUnderDev: "Онлайн-оплата находится в разработке — если вы хотите забронировать, оставьте здесь свой email, и мы сообщим вам, когда всё будет готово.",
      payUnderDevBtn: "ОСТАВИТЬ EMAIL",
      payUnderDevThanks: "Спасибо — мы напишем вам на {email}, как только бронирование заработает.",
      validationDates: "Пожалуйста, выберите даты заезда и выезда.",
      validationGuest: "Пожалуйста, укажите имя, email и телефон.",
      validationSeason: "Онлайн-бронирование доступно для проживания до {lastDate}. Для других дат позвоните {phone}.",
      validationGroup: "Онлайн мы бронируем до {rooms}. Для группы побольше позвоните {phone} — мы всё организуем.",
      payRedirect: "Открываем безопасную оплату…",
      payError: "Не удалось начать оплату — попробуйте ещё раз или позвоните {phone}.",
      payReassuranceCard: "Безопасная оплата картой — Visa, Mastercard, Apple Pay, Google Pay. Мгновенное подтверждение по email.",
      editStay: "Изменить даты",
      editGuest: "Назад к данным",
      refLabel: "Номер бронирования",
      refNote: "Укажите {ref} в назначении банковского перевода – так отель распознает ваш платёж.",
      beneficiary: "Получатель",
      iban: "IBAN",
      bic: "BIC",
      bank: "Банк",
      amount: "Сумма",
      reference: "Назначение платежа",
      copy: "Копировать",
      copied: "Скопировано",
      payMicrocopy: "Выполните банковский перевод €{deposit} в течение 24 часов, чтобы удержать номер — остаток €{balance} оплачивается на стойке регистрации при заезде. Бронирование подтверждается по email сразу после получения перевода. Вопросы? Звоните {phone}.",
      payMicrocopyRequest: "Выполните банковский перевод в течение 24 часов, чтобы удержать номер. Бронирование подтверждается по email сразу после получения перевода. Вопросы? Звоните {phone}.",
      summaryTitle: "Итог бронирования",
      summaryDates: "Даты",
      summaryGuests: "Гости",
      summaryBeds: "Кровати",
      summaryTotal: "Итого",
      summaryRef: "Номер бронирования",
      shotTitle: "Уже оплатили? Прикрепите скриншот для быстрого подтверждения",
      shotHint: "Нажмите, перетащите или вставьте (Ctrl+V) сюда изображение перевода.",
      shotAttached: "Скриншот прикреплён.",
      shotUploaded: "Мы получили его — подтверждение придёт на email в ближайшее время."
    },
    uk: {
      checkin: "Заїзд",
      checkout: "Виїзд",
      adults: "Дорослі",
      children: "Діти",
      childAge: "Вік",
      showPrice: "Забронювати відпочинок",
      giftsBadge: "🎁 Найкраща ціна + 3 подарунки",
      gift1: "Безкоштовний доступ до аквапарку для кожного гостя, цілий день, щодня",
      gift2: "Гарантія найкращої ціни — вигідніше, ніж на будь-якому сайті бронювання",
      gift3: "Пріоритет на ранній заїзд, щойно номер готовий",
      nightWord: "ніч",
      nightWordFew: "ночі",
      nightWordPlural: "ночей",
      adultWord: "дорослий",
      adultWordFew: "дорослих",
      adultWordPlural: "дорослих",
      childWord: "дитина",
      childWordFew: "дитини",
      childWordPlural: "дітей",
      roomWord: "номер",
      roomWordFew: "номери",
      roomWordPlural: "номерів",
      roomName: "Двомісний номер",
      roomsLine: "Номери",
      summaryRooms: "Номери",
      multiRoomNotice: "В одному двомісному номері розміщуються до 2 дорослих + 2 дітей, тож для {guests} потрібно {rooms}. Ціна нижче та ваше бронювання — за {rooms}.",
      total: "Разом",
      unratedNotice: "Остаточну ціну підтверджує готель — залиште запит нижче.",
      adultsLine: "Додаткові дорослі",
      standardPrice: "Стандартна ціна",
      discountLine: "Знижка за пряме бронювання (−{pct}%)",
      termsText: "Я розумію, що зараз списується лише депозит {pct}% (€{deposit}), а не повна вартість, і погоджуюся з {terms}.",
      termsLinkText: "загальними умовами",
      validationTerms: "Будь ласка, позначте поле, щоб прийняти умови.",
      childrenLine: "Діти",
      bedsLabel: "Ліжка",
      roomInfo: "Номер: двомісний, 18 м² — до 2 дорослих + 2 дітей · балкон · кондиціонер · безкоштовний доступ до аквапарку",
      bedCombined: "1 велике ліжко (з’єднані)",
      bedTwin: "2 окремі ліжка",
      guestName: "Повне ім’я",
      guestEmail: "Ел. пошта",
      guestPhone: "Телефон",
      guestRequests: "Особливі побажання (необов’язково)",
      confirmPay: "ЗАБРОНЮВАТИ · СПЛАТИТИ €{deposit}",
      requestBooking: "ЗАЛИШИТИ ЗАПИТ",
      depositLine: "До сплати зараз ({pct}%)",
      balanceLine: "На рецепції після заїзду",
      summaryDeposit: "Сплачено зараз ({pct}%)",
      summaryBalance: "До сплати на рецепції",
      payReassurance: "Готель підтвердить бронювання одразу після отримання переказу.",
      payUnderDev: "Оплата в розробці — якщо хочете забронювати, залиште тут свою пошту, і ми повідомимо, коли все буде готово.",
      payUnderDevBtn: "ЗАЛИШИТИ ПОШТУ",
      payUnderDevThanks: "Дякуємо — ми напишемо на {email}, щойно бронювання запрацює.",
      validationDates: "Будь ласка, оберіть дати заїзду та виїзду.",
      validationGuest: "Будь ласка, вкажіть ім’я, пошту та телефон.",
      validationSeason: "Онлайн-бронювання відкрите для проживання до {lastDate}. Для пізніших дат телефонуйте нам: {phone}.",
      validationGroup: "Онлайн ми бронюємо до {rooms}. Для більшої групи зателефонуйте нам: {phone}, і ми все організуємо.",
      payRedirect: "Відкриваємо захищену оплату…",
      payError: "Не вдалося розпочати оплату — спробуйте ще раз або зателефонуйте: {phone}.",
      payReassuranceCard: "Захищена оплата карткою — Visa, Mastercard, Apple Pay, Google Pay. Миттєве підтвердження на пошту.",
      editStay: "Змінити дати",
      editGuest: "Назад до ваших даних",
      refLabel: "Номер бронювання",
      refNote: "Вкажіть {ref} як призначення платежу — саме так готель знайде ваш переказ.",
      beneficiary: "Отримувач",
      iban: "IBAN",
      bic: "BIC",
      bank: "Банк",
      amount: "Сума",
      reference: "Призначення платежу",
      copy: "Копіювати",
      copied: "Скопійовано",
      payMicrocopy: "Здійсніть переказ на €{deposit} протягом 24 годин, щоб закріпити номер — решту €{balance} ви сплачуєте на рецепції після приїзду. Бронювання підтверджується на пошту одразу після отримання переказу. Питання? Телефонуйте {phone}.",
      payMicrocopyRequest: "Здійсніть переказ протягом 24 годин, щоб закріпити номер. Бронювання підтверджується на пошту одразу після отримання переказу. Питання? Телефонуйте {phone}.",
      summaryTitle: "Підсумок бронювання",
      summaryDates: "Дати",
      summaryGuests: "Гості",
      summaryBeds: "Ліжка",
      summaryTotal: "Разом",
      summaryRef: "Номер бронювання",
      shotTitle: "Вже сплатили? Додайте скриншот для швидшого підтвердження",
      shotHint: "Натисніть, перетягніть або вставте (Ctrl+V) зображення переказу сюди.",
      shotAttached: "Скриншот додано.",
      shotUploaded: "Ми його отримали — підтвердження надійде на пошту найближчим часом."
    }
  };

  function lang() {
    var l = document.documentElement.getAttribute("data-lang");
    return STRINGS[l] ? l : "en";
  }

  function t(key) {
    var L = lang();
    return (STRINGS[L] && STRINGS[L][key]) || (STRINGS.en[key] || key);
  }

  function fmt(str, map) {
    return str.replace(/\{(\w+)\}/g, function (_, k) {
      return map && Object.prototype.hasOwnProperty.call(map, k) ? map[k] : "";
    });
  }

  function fmtMoney(n) {
    return String(Math.round(n));
  }

  /* Hidden dev hook: visiting /?devpay=<DEV_PAY_KEY> forwards the key to
     /api/checkout, which — only on an exact server-side match — charges €1
     instead of the real deposit so the whole live pipeline (Stripe → webhook
     → emails) can be tested with a real card. Emails are marked [TEST]. */
  var DEV_PAY_KEY = (function () {
    var m = /[?&]devpay=([^&]+)/.exec(window.location.search);
    return m ? decodeURIComponent(m[1]) : null;
  })();

  /* Backend calls (Cloudflare Pages Functions). The site keeps working with
     no backend — every caller catches failures and falls back silently. */
  function apiPost(path, body) {
    return window.fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }

  /* Shrink big phone screenshots before upload; falls back to the original
     if canvas is unavailable or the image never decodes. */
  function downscaleImage(dataUrl, cb) {
    var done = false;
    function finish(u) { if (!done) { done = true; cb(u); } }
    setTimeout(function () { finish(dataUrl); }, 1500);
    try {
      var img = new Image();
      img.onload = function () {
        try {
          var max = 1600;
          var scale = Math.min(1, max / Math.max(img.width, img.height));
          if (scale === 1 && dataUrl.length < 2500000) { finish(dataUrl); return; }
          var c = document.createElement("canvas");
          c.width = Math.round(img.width * scale);
          c.height = Math.round(img.height * scale);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          finish(c.toDataURL("image/jpeg", 0.85));
        } catch (e) { finish(dataUrl); }
      };
      img.onerror = function () { finish(dataUrl); };
      img.src = dataUrl;
    } catch (e) { finish(dataUrl); }
  }

  function pad2(n) {
    return n < 10 ? "0" + n : "" + n;
  }

  function todayISO() {
    var d = new Date();
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function addDays(iso, days) {
    var d = new Date(iso + "T00:00:00");
    d.setDate(d.getDate() + days);
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function nightsBetween(a, b) {
    var d1 = new Date(a + "T00:00:00");
    var d2 = new Date(b + "T00:00:00");
    return Math.round((d2 - d1) / 86400000);
  }

  /* Hotel Kotva reservation ID, quoted by the guest as the transfer note. */
  function genRef(checkinISO) {
    var d = new Date(checkinISO + "T00:00:00");
    var yy = pad2(d.getFullYear() % 100);
    var mm = pad2(d.getMonth() + 1);
    var dd = pad2(d.getDate());
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    var rand = "";
    for (var i = 0; i < 3; i++) {
      rand += chars[Math.floor(Math.random() * chars.length)];
    }
    return "KTV-" + yy + mm + dd + "-" + rand;
  }

  function countWord(n, single, plural) {
    var L = lang();
    var word;
    if (L === "ru" || L === "uk") {
      /* Russian and Ukrainian share the 1 / 2–4 / 5+ rule
         (1 ночь, 2–4 ночи, 5+ ночей; 1 ніч, 2–4 ночі, 5+ ночей). */
      var m10 = n % 10, m100 = n % 100;
      if (m10 === 1 && m100 !== 11) {
        word = t(single);
      } else if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) {
        var few = STRINGS[L][single + "Few"];
        word = few || t(plural);
      } else {
        word = t(plural);
      }
    } else {
      word = n === 1 ? t(single) : t(plural);
    }
    /* Romanian: counts of 20+ take "de" (21 de nopți) */
    if (L === "ro" && n >= 20) {
      return n + " de " + word;
    }
    return n + " " + word;
  }

  /* How many rooms a party needs. One Deluxe Twin takes 2 adults + 1 child
     ("2+1"), so 3 adults, 2 adults + 2 children, etc. are automatically
     priced and booked as two rooms. Mirrors roomsNeeded() in
     functions/api/_rates.js, which recomputes it for the actual charge. */
  function roomsNeeded(cfg, adults, children) {
    var maxAdults = cfg.roomMaxAdults > 0 ? cfg.roomMaxAdults : 2;
    var maxGuests = cfg.roomMaxGuests > 0 ? cfg.roomMaxGuests : 3;
    var a = Math.max(1, adults || 0);
    var c = Math.max(0, children || 0);
    return Math.max(1, Math.ceil(a / maxAdults), Math.ceil((a + c) / maxGuests));
  }

  /* Rate band for the date of a given night, from the KOTVA_CONFIG.rates
     bands (both ends inclusive). null → that night can't be booked online.
     Display only — the amount charged is recomputed server-side from the
     identical table in functions/api/_rates.js. */
  function rateBand(cfg, iso) {
    var bands = cfg.rates || [];
    for (var i = 0; i < bands.length; i++) {
      if (iso >= bands[i].from && iso <= bands[i].to) return bands[i];
    }
    return null;
  }

  function lastRatedDate(cfg) {
    var bands = cfg.rates || [];
    var last = null;
    for (var i = 0; i < bands.length; i++) {
      if (!last || bands[i].to > last) last = bands[i].to;
    }
    return last;
  }

  /* Human-readable date for UI messages, in the page language. */
  function fmtDateLocal(iso) {
    var locales = { en: "en-GB", bg: "bg-BG", ro: "ro-RO", de: "de-DE", ru: "ru-RU", uk: "uk-UA" };
    try {
      /* bg/ru/uk render the year with a trailing marker ("2027 г.", "2027 р."),
         and the sentences that embed this already end in a full stop — strip it
         so the message never reads "…2027 г..". */
      return new Date(iso + "T00:00:00").toLocaleDateString(locales[lang()] || "en-GB",
        { day: "numeric", month: "long", year: "numeric" }).replace(/\.$/, "");
    } catch (e) {
      return iso;
    }
  }

  function buildWidget(root) {
    var cfg = window.KOTVA_CONFIG;
    var id = root.dataset.widget;

    /* The pickers run as far as the widget books on its own — up to
       cfg.maxRooms rooms of 2 adults + 1 child each. */
    var adultOptions = "";
    for (var a = 1; a <= (cfg.maxAdults || 3); a++) {
      adultOptions += '<option value="' + a + '"' + (a === 2 ? " selected" : "") + ">" + a + "</option>";
    }

    var childOptions = "";
    for (var c = 0; c <= (cfg.maxChildren || 3); c++) {
      childOptions += '<option value="' + c + '">' + c + "</option>";
    }

    root.innerHTML =
      '<form class="bw-form" novalidate>' +
        '<div class="bw-field">' +
          '<label for="ci-' + id + '">' + t("checkin") + "</label>" +
          '<input type="date" id="ci-' + id + '" name="checkin" required>' +
        "</div>" +
        '<div class="bw-field">' +
          '<label for="co-' + id + '">' + t("checkout") + "</label>" +
          '<input type="date" id="co-' + id + '" name="checkout" required>' +
        "</div>" +
        '<div class="bw-field bw-field-narrow">' +
          '<label for="ad-' + id + '">' + t("adults") + "</label>" +
          '<select id="ad-' + id + '" name="adults">' + adultOptions + "</select>" +
        "</div>" +
        '<div class="bw-field bw-field-narrow">' +
          '<label for="ch-' + id + '">' + t("children") + "</label>" +
          '<select id="ch-' + id + '" name="children">' + childOptions + "</select>" +
        "</div>" +
        '<div class="bw-child-ages" hidden></div>' +
        '<button type="submit" class="btn btn-primary bw-submit">' + t("showPrice") + "</button>" +
        '<details class="bw-gifts">' +
          '<summary class="bw-gifts-badge">' + t("giftsBadge") + "</summary>" +
          '<ul class="bw-gifts-list">' +
            "<li>" + t("gift1") + "</li>" +
            "<li>" + t("gift2") + "</li>" +
            "<li>" + t("gift3") + "</li>" +
          "</ul>" +
        "</details>" +
        '<p class="bw-msg" role="alert" hidden></p>' +
      "</form>" +
      '<div class="bw-price-panel" hidden>' +
        '<div class="bw-step-head">' +
          '<p class="bw-stay-line"></p>' +
          '<button type="button" class="bw-back bw-back-dates">' + t("editStay") + "</button>" +
        "</div>" +
        '<p class="bw-rooms-notice" hidden></p>' +
        '<div class="bw-lines"></div>' +
        '<div class="bw-total-row"><span>' + t("total") + '</span><span class="bw-total-amount">—</span></div>' +
        '<div class="bw-split" hidden>' +
          '<div class="bw-line"><span class="bw-deposit-label"></span><span class="bw-deposit-amount"></span></div>' +
          '<div class="bw-line"><span>' + t("balanceLine") + '</span><span class="bw-balance-amount"></span></div>' +
        "</div>" +
        '<p class="bw-room-info">' + t("roomInfo") + "</p>" +
        '<div class="bw-beds" role="radiogroup" aria-label="' + t("bedsLabel") + '">' +
          '<span class="bw-beds-label">' + t("bedsLabel") + "</span>" +
          '<label class="bw-bed"><input type="radio" name="beds-' + id + '" value="combined" checked><span>' + t("bedCombined") + "</span></label>" +
          '<label class="bw-bed"><input type="radio" name="beds-' + id + '" value="twin"><span>' + t("bedTwin") + "</span></label>" +
        "</div>" +
        '<div class="bw-guest-fields">' +
          '<div class="bw-field">' +
            '<label for="gn-' + id + '">' + t("guestName") + "</label>" +
            '<input type="text" id="gn-' + id + '" name="guestName" autocomplete="name" required>' +
          "</div>" +
          '<div class="bw-field">' +
            '<label for="ge-' + id + '">' + t("guestEmail") + "</label>" +
            '<input type="email" id="ge-' + id + '" name="guestEmail" autocomplete="email" required>' +
          "</div>" +
          '<div class="bw-field">' +
            '<label for="gp-' + id + '">' + t("guestPhone") + "</label>" +
            '<input type="tel" id="gp-' + id + '" name="guestPhone" autocomplete="tel" required>' +
          "</div>" +
          '<div class="bw-field bw-field-wide">' +
            '<label for="gr-' + id + '">' + t("guestRequests") + "</label>" +
            '<textarea id="gr-' + id + '" name="guestRequests" rows="2"></textarea>' +
          "</div>" +
        "</div>" +
        '<label class="bw-terms" hidden>' +
          '<input type="checkbox" class="bw-terms-check">' +
          '<span class="bw-terms-text"></span>' +
        "</label>" +
        '<p class="bw-msg bw-msg-guest" role="alert" hidden></p>' +
        '<button type="button" class="btn btn-primary bw-confirm"></button>' +
        '<p class="bw-reassurance">' + t(cfg.paymentProvider === "stripe" && !cfg.paymentUnderDevelopment ? "payReassuranceCard" : "payReassurance") + "</p>" +
      "</div>" +
      '<div class="bw-payment-step" hidden>' +
        '<div class="bw-step-head">' +
          '<button type="button" class="bw-back bw-back-details">' + t("editGuest") + "</button>" +
        "</div>" +
        '<div class="bw-ref"><span>' + t("refLabel") + '</span><strong class="bw-ref-value"></strong></div>' +
        '<p class="bw-ref-note"></p>' +
        '<div class="bw-underdev" hidden>' +
          '<p class="bw-underdev-msg">' + t("payUnderDev") + "</p>" +
          '<div class="bw-underdev-form">' +
            '<div class="bw-field"><input type="email" class="bw-underdev-email" autocomplete="email" required></div>' +
            '<button type="button" class="btn btn-primary bw-underdev-send">' + t("payUnderDevBtn") + "</button>" +
          "</div>" +
          '<p class="bw-underdev-thanks" hidden></p>' +
        "</div>" +
        '<dl class="bw-iban-block"></dl>' +
        '<p class="bw-pay-microcopy"></p>' +
        '<div class="bw-summary">' +
          '<h3>' + t("summaryTitle") + "</h3>" +
          '<dl class="bw-summary-list"></dl>' +
        "</div>" +
        '<div class="bw-shot">' +
          '<p class="bw-shot-title">' + t("shotTitle") + "</p>" +
          '<div class="bw-dropzone" tabindex="0" role="button">' +
            '<span class="bw-shot-hint">' + t("shotHint") + "</span>" +
            '<img class="bw-shot-preview" alt="" hidden>' +
          "</div>" +
          '<input type="file" class="bw-shot-input" accept="image/*" hidden>' +
          '<div class="bw-shot-actions" hidden>' +
            '<p class="bw-shot-status"></p>' +
          "</div>" +
        "</div>" +
      "</div>";

    wireWidget(root);
  }

  function wireWidget(root) {
    var cfg = window.KOTVA_CONFIG;
    var form = root.querySelector(".bw-form");
    var ciInput = form.querySelector('[name="checkin"]');
    var coInput = form.querySelector('[name="checkout"]');
    var adultsSel = form.querySelector('[name="adults"]');
    var childrenSel = form.querySelector('[name="children"]');
    var childAgesWrap = form.querySelector(".bw-child-ages");
    var msg = form.querySelector(".bw-msg");
    var pricePanel = root.querySelector(".bw-price-panel");
    var paymentStep = root.querySelector(".bw-payment-step");
    var stayLine = pricePanel.querySelector(".bw-stay-line");
    var linesWrap = pricePanel.querySelector(".bw-lines");
    var totalAmount = pricePanel.querySelector(".bw-total-amount");
    var confirmBtn = pricePanel.querySelector(".bw-confirm");
    var guestMsg = pricePanel.querySelector(".bw-msg-guest");
    var nameInput = pricePanel.querySelector('[name="guestName"]');
    var emailInput = pricePanel.querySelector('[name="guestEmail"]');
    var phoneInput = pricePanel.querySelector('[name="guestPhone"]');
    var requestsInput = pricePanel.querySelector('[name="guestRequests"]');

    var today = todayISO();
    ciInput.min = today;
    ciInput.value = today;
    coInput.min = addDays(today, cfg.minNights || 1);
    coInput.value = addDays(today, 2);

    /* Online booking closes with the season: cap the pickers at the last
       rated night (checkout can be the morning after it). */
    var lastNight = lastRatedDate(cfg);
    if (lastNight) {
      ciInput.max = lastNight;
      coInput.max = addDays(lastNight, 1);
    }

    ciInput.addEventListener("change", function () {
      var minCo = addDays(ciInput.value, cfg.minNights || 1);
      coInput.min = minCo;
      if (!coInput.value || coInput.value <= ciInput.value) {
        coInput.value = minCo;
      }
    });

    function renderChildAges() {
      var n = parseInt(childrenSel.value, 10) || 0;
      if (n <= 0) {
        childAgesWrap.hidden = true;
        childAgesWrap.innerHTML = "";
        return;
      }
      var html = "";
      for (var i = 0; i < n; i++) {
        html +=
          '<div class="bw-field bw-field-narrow">' +
            '<label>' + t("childAge") + " " + (i + 1) + "</label>" +
            '<select name="childAge' + i + '">' +
              [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17].map(function (age) {
                return '<option value="' + age + '">' + age + "</option>";
              }).join("") +
            "</select>" +
          "</div>";
      }
      childAgesWrap.innerHTML = html;
      childAgesWrap.hidden = false;
    }
    childrenSel.addEventListener("change", renderChildAges);

    var currentQuote = null;
    var currentBooking = null;   /* payload sent to the email backend */
    var reminderId = null;       /* scheduled guest-reminder email, cancellable */

    /* One step on screen at a time: hide the others, animate the shown one. */
    function showStep(step) {
      form.hidden = step !== "form";
      [
        [pricePanel, "price"],
        [paymentStep, "payment"]
      ].forEach(function (pair) {
        var panel = pair[0];
        if (step === pair[1]) {
          panel.hidden = false;
          requestAnimationFrame(function () {
            panel.classList.add("is-open");
            panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
          });
        } else {
          panel.hidden = true;
          panel.classList.remove("is-open");
        }
      });
    }

    function computeQuote() {
      var checkin = ciInput.value;
      var checkout = coInput.value;
      if (!checkin || !checkout || checkout <= checkin) {
        return null;
      }
      var nights = nightsBetween(checkin, checkout);
      var adults = parseInt(adultsSel.value, 10) || 1;
      var childrenCount = parseInt(childrenSel.value, 10) || 0;

      /* A party that doesn't fit the room's 2+1 occupancy takes several
         rooms, each charged the full nightly rate. `extraAdults` stays 0
         while a room caps at 2 adults — it only bites if that cap is raised. */
      var rooms = roomsNeeded(cfg, adults, childrenCount);
      var maxAdults = cfg.roomMaxAdults > 0 ? cfg.roomMaxAdults : 2;
      /* Beyond that it is a group booking: /api/checkout refuses to price it,
         so the widget hands the guest the phone instead of a dead end. */
      if (rooms > (cfg.maxRooms || 10)) return { overCapacity: true, rooms: rooms };

      /* Per-night rate from the config bands; a night with no band means
         the season is closed → the stay can't be booked online. */
      var hasRates = !!(cfg.rates && cfg.rates.length);
      var extraAdults = Math.max(0, adults - rooms * maxAdults);
      var roomTotal = 0;
      var adultsTotal = 0;
      if (hasRates) {
        for (var n = 0, night = checkin; n < nights; n++, night = addDays(night, 1)) {
          var band = rateBand(cfg, night);
          if (band == null) return { unpriced: true };
          roomTotal += rooms * band.rate;
          adultsTotal += extraAdults * (band.extraAdult != null ? band.extraAdult : (cfg.adultRate || 0));
        }
      }

      var childAges = [];
      for (var i = 0; i < childrenCount; i++) {
        var sel = childAgesWrap.querySelector('[name="childAge' + i + '"]');
        childAges.push(sel ? parseInt(sel.value, 10) : 0);
      }
      var billableChildren = childAges.filter(function (age) {
        return age >= (cfg.childFreeUnder || 0);
      }).length;
      var childNightly = billableChildren * (cfg.childRate || 0);

      var childrenTotal = childNightly * nights;
      /* Standard total first, then the direct-booking discount, then the
         split — same order and rounding as serverQuote() in
         functions/api/_rates.js so display and charge never diverge. */
      var standardTotal = Math.round(roomTotal + adultsTotal + childrenTotal);
      var discountRate = typeof cfg.directDiscount === "number" ? cfg.directDiscount : 0;
      var discount = Math.round(standardTotal * discountRate);
      var total = standardTotal - discount;

      /* Deposit paid by card now; the balance is settled at reception. */
      var depositRate = typeof cfg.depositRate === "number" ? cfg.depositRate : 1;
      var deposit = Math.round(total * depositRate);
      var balance = total - deposit;

      return {
        deposit: deposit,
        balance: balance,
        depositPct: Math.round(depositRate * 100),
        checkin: checkin,
        checkout: checkout,
        nights: nights,
        adults: adults,
        children: childrenCount,
        rooms: rooms,
        roomTotal: roomTotal,
        adultsTotal: adultsTotal,
        childrenTotal: childrenTotal,
        standardTotal: standardTotal,
        discount: discount,
        discountPct: Math.round(discountRate * 100),
        total: total,
        /* "We can't price this online yet" — either no rate bands at all, or
           bands whose rates are still 0 (the pre-launch state of config.js).
           Either way the widget must fall back to the request flow and never
           offer to charge a card €0. Mirrors the same guard in
           functions/api/_rates.js, which refuses a zero-value quote. */
        isZeroRate: !hasRates || !(total > 0) || !(deposit > 0)
      };
    }

    function showMsg(el, text) {
      el.textContent = text;
      el.hidden = false;
    }
    function hideMsg(el) {
      el.hidden = true;
      el.textContent = "";
    }

    function guestsLabel(q) {
      var s = countWord(q.adults, "adultWord", "adultWordPlural");
      if (q.children > 0) {
        s += ", " + countWord(q.children, "childWord", "childWordPlural");
      }
      return s;
    }

    /* "2 rooms" / "2 стаи" — shared by the multi-room notice and summaries. */
    function roomsLabel(rooms) {
      return countWord(rooms || 1, "roomWord", "roomWordPlural");
    }

    /* "2 × Deluxe Twin Room" — what the guest is actually booking. */
    function roomsValue(rooms) {
      return (rooms || 1) + " × " + t("roomName");
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      hideMsg(msg);
      var quote = computeQuote();
      if (!quote) {
        showMsg(msg, t("validationDates"));
        return;
      }
      if (quote.overCapacity) {
        showMsg(msg, fmt(t("validationGroup"), {
          rooms: roomsLabel(cfg.maxRooms || 10), phone: cfg.phone
        }));
        return;
      }
      if (quote.unpriced) {
        var last = lastRatedDate(cfg);
        showMsg(msg, fmt(t("validationSeason"), { lastDate: last ? fmtDateLocal(last) : "", phone: cfg.phone }));
        return;
      }
      currentQuote = quote;
      renderPricePanel(quote);
      showStep("price");
    });

    function renderPricePanel(q) {
      /* "2026-07-12 → 2026-07-14 · 2 нощувки, 2 възрастни · 2 стаи" */
      stayLine.textContent = q.checkin + " → " + q.checkout + " · " +
        countWord(q.nights, "nightWord", "nightWordPlural") + ", " + guestsLabel(q) +
        (q.rooms > 1 ? " · " + roomsLabel(q.rooms) : "");

      /* The party doesn't fit one 2+1 room: say so before the price, so the
         jump to two rooms is never a surprise at the payment step. */
      var roomsNotice = pricePanel.querySelector(".bw-rooms-notice");
      roomsNotice.hidden = !(q.rooms > 1);
      roomsNotice.textContent = q.rooms > 1
        ? fmt(t("multiRoomNotice"), { guests: guestsLabel(q), rooms: roomsLabel(q.rooms) })
        : "";

      var html = "";
      if (q.rooms > 1) {
        html += '<div class="bw-line"><span>' + t("roomsLine") + '</span><span>' + roomsValue(q.rooms) + "</span></div>";
      }
      if (q.isZeroRate) {
        html += '<p class="bw-notice">' + t("unratedNotice") + "</p>";
      } else {
        if (q.adultsTotal > 0) {
          html += '<div class="bw-line"><span>' + t("adultsLine") + '</span><span>€' + fmtMoney(q.adultsTotal) + "</span></div>";
        }
        if (q.childrenTotal > 0) {
          html += '<div class="bw-line"><span>' + t("childrenLine") + '</span><span>€' + fmtMoney(q.childrenTotal) + "</span></div>";
        }
        /* Golden-Dune-style visible saving: crossed-out standard price
           (Booking.com level) + the direct-booking discount in euros. */
        if (q.discount > 0) {
          html += '<div class="bw-line bw-line-standard"><span>' + t("standardPrice") + '</span><span class="bw-strike">€' + fmtMoney(q.standardTotal) + "</span></div>";
          html += '<div class="bw-line bw-line-discount"><span>' + fmt(t("discountLine"), { pct: q.discountPct }) + '</span><span>−€' + fmtMoney(q.discount) + "</span></div>";
        }
      }
      linesWrap.innerHTML = html;
      linesWrap.style.display = html ? "" : "none";
      totalAmount.textContent = q.isZeroRate ? "—" : "€ " + fmtMoney(q.total);

      var split = pricePanel.querySelector(".bw-split");
      var showSplit = !q.isZeroRate && q.balance > 0 && !cfg.paymentUnderDevelopment;
      split.hidden = !showSplit;
      if (showSplit) {
        split.querySelector(".bw-deposit-label").textContent = fmt(t("depositLine"), { pct: q.depositPct });
        split.querySelector(".bw-deposit-amount").textContent = "€ " + fmtMoney(q.deposit);
        split.querySelector(".bw-balance-amount").textContent = "€ " + fmtMoney(q.balance);
      }

      confirmBtn.textContent = (q.isZeroRate || cfg.paymentUnderDevelopment)
        ? t("requestBooking")
        : fmt(t("confirmPay"), { deposit: fmtMoney(q.deposit) });

      /* Deposit-consent checkbox (Golden Dune pattern): only when the
         confirm button actually charges a card deposit. Re-filled on every
         quote so the amount always matches; the tick itself is kept, the
         guest shouldn't re-accept after merely editing dates. */
      var termsWrap = pricePanel.querySelector(".bw-terms");
      var needsTerms = !q.isZeroRate && !cfg.paymentUnderDevelopment &&
        cfg.paymentProvider === "stripe" && q.deposit > 0;
      termsWrap.hidden = !needsTerms;
      if (needsTerms) {
        termsWrap.querySelector(".bw-terms-text").innerHTML = fmt(t("termsText"), {
          pct: q.depositPct,
          deposit: fmtMoney(q.deposit),
          terms: '<a href="/terms?lang=' + lang() + '" target="_blank" rel="noopener">' +
            t("termsLinkText") + "</a>"
        });
      }
    }

    confirmBtn.addEventListener("click", function () {
      hideMsg(guestMsg);
      var name = nameInput.value.trim();
      var email = emailInput.value.trim();
      var phone = phoneInput.value.trim();
      var emailOk = /\S+@\S+\.\S+/.test(email);
      if (!name || !emailOk || phone.replace(/\D/g, "").length < 6) {
        showMsg(guestMsg, t("validationGuest"));
        return;
      }
      var termsWrap = pricePanel.querySelector(".bw-terms");
      if (!termsWrap.hidden && !termsWrap.querySelector(".bw-terms-check").checked) {
        showMsg(guestMsg, t("validationTerms"));
        return;
      }
      var bedsInput = pricePanel.querySelector('.bw-beds input:checked');
      currentQuote.bedsCode = bedsInput && bedsInput.value === "twin" ? "twin" : "combined";
      currentQuote.beds = currentQuote.bedsCode === "twin" ? t("bedTwin") : t("bedCombined");
      currentQuote.requests = requestsInput.value.trim();
      if (cfg.paymentProvider === "stripe" && !cfg.paymentUnderDevelopment &&
          !currentQuote.isZeroRate) {
        startStripeCheckout(currentQuote, name, email, phone);
        return;
      }
      renderPaymentStep(currentQuote, name, email, phone);
      showStep("payment");
    });

    /* Back links — earlier inputs keep their values, nothing is re-rendered. */
    pricePanel.querySelector(".bw-back-dates").addEventListener("click", function () {
      /* Abandon any in-flight checkout call: its late response must neither
         redirect to a stale Stripe page nor leave the button disabled. */
      if (stripeBusy) {
        stripeSeq++;
        stripeBusy = false;
        confirmBtn.disabled = false;
      }
      showStep("form");
    });
    paymentStep.querySelector(".bw-back-details").addEventListener("click", function () {
      showStep("price");
    });

    /* HOTFIX (paymentUnderDevelopment): the guest's email already reached the
       owner via /api/booking when this step opened; the button lets them fix
       a typo (re-sent to the owner) and confirms we will be in touch. */
    paymentStep.querySelector(".bw-underdev-send").addEventListener("click", function () {
      var input = paymentStep.querySelector(".bw-underdev-email");
      var thanks = paymentStep.querySelector(".bw-underdev-thanks");
      var newEmail = input.value.trim();
      if (!/\S+@\S+\.\S+/.test(newEmail)) {
        if (input.reportValidity) input.reportValidity();
        input.focus();
        return;
      }
      if (currentBooking && newEmail !== currentBooking.email) {
        currentBooking.email = newEmail;
        if (window.fetch) {
          apiPost("/api/booking", { booking: currentBooking, previousReminderId: reminderId })
            .then(function (res) { reminderId = (res && res.reminderId) || null; })
            .catch(function () {});
        }
      }
      thanks.textContent = fmt(t("payUnderDevThanks"), { email: newEmail });
      thanks.hidden = false;
    });

    /* Stripe branch: /api/checkout re-prices the stay server-side (this page
       never sets the amount) and returns a Stripe-hosted Checkout URL; every
       confirmation email is sent by /api/stripe-webhook after payment. No
       card data ever touches this site. */
    var stripeBusy = false;
    var stripeSeq = 0; /* bumped when the guest navigates away mid-request */
    function startStripeCheckout(q, name, email, phone) {
      if (stripeBusy) return;
      var childAges = [];
      for (var i = 0; i < q.children; i++) {
        var sel = childAgesWrap.querySelector('[name="childAge' + i + '"]');
        childAges.push(sel ? parseInt(sel.value, 10) : 0);
      }
      var booking = {
        ref: genRef(q.checkin),
        lang: lang(),
        name: name,
        email: email,
        phone: phone,
        checkin: q.checkin,
        checkout: q.checkout,
        adults: q.adults,
        childAges: childAges,
        rooms: q.rooms,
        guests: guestsLabel(q),
        beds: q.beds,
        bedsCode: q.bedsCode,
        requests: q.requests
      };
      stripeBusy = true;
      var seq = ++stripeSeq;
      var original = confirmBtn.textContent;
      confirmBtn.disabled = true;
      confirmBtn.textContent = t("payRedirect");
      function restore() {
        stripeBusy = false;
        confirmBtn.disabled = false;
        confirmBtn.textContent = original;
      }
      function fail() {
        restore();
        showMsg(guestMsg, fmt(t("payError"), { phone: cfg.phone }));
      }
      apiPost("/api/checkout", { booking: booking, devKey: DEV_PAY_KEY }).then(function (res) {
        /* The guest went back and changed the stay meanwhile — this response
           belongs to abandoned dates and must not redirect anywhere. */
        if (seq !== stripeSeq) return;
        if (res && res.ok && res.url) {
          window.location.href = res.url;
          return;
        }
        if (res && res.enquiry) {
          /* Stripe isn't configured on the server yet — degrade to the
             leave-your-email request flow so no guest is turned away. */
          restore();
          renderPaymentStep(q, name, email, phone, true);
          showStep("payment");
          return;
        }
        fail();
      }).catch(function () {
        if (seq === stripeSeq) fail();
      });
    }

    function renderPaymentStep(q, name, email, phone, forceUnderDev) {
      var ref = genRef(q.checkin);
      var refTemplate = cfg.payment["reference_" + lang()] || cfg.payment.reference_en;
      var paymentReference = fmt(refTemplate, { ref: ref, name: name, checkin: q.checkin });
      var underDev = !!cfg.paymentUnderDevelopment || !!forceUnderDev;

      /* HOTFIX (paymentUnderDevelopment): swap the transfer instructions for
         the "leave your email" notice. Inline display (not [hidden]) so the
         CSS display rules on these blocks can't override it. */
      [".bw-ref", ".bw-ref-note", ".bw-iban-block", ".bw-pay-microcopy", ".bw-shot"].forEach(function (sel) {
        paymentStep.querySelector(sel).style.display = underDev ? "none" : "";
      });
      var underDevWrap = paymentStep.querySelector(".bw-underdev");
      underDevWrap.hidden = !underDev;
      underDevWrap.style.display = underDev ? "" : "none";
      if (underDev) {
        underDevWrap.querySelector(".bw-underdev-email").value = email;
        underDevWrap.querySelector(".bw-underdev-thanks").hidden = true;
      }

      paymentStep.querySelector(".bw-ref-value").textContent = ref;
      paymentStep.querySelector(".bw-ref-note").textContent = fmt(t("refNote"), { ref: ref });

      /* Tell the backend the guest reached the payment step: it notifies the
         owner and schedules the "did you pay?" reminder email to the guest. */
      currentBooking = {
        ref: ref,
        lang: lang(),
        name: name,
        email: email,
        phone: phone,
        checkin: q.checkin,
        checkout: q.checkout,
        nights: q.nights,
        rooms: q.rooms,
        guests: guestsLabel(q),
        beds: q.beds,
        requests: q.requests,
        total: q.isZeroRate ? null : Math.round(q.total),
        /* No deposit while payment is under development → the backend treats
           it as a request booking and schedules no "did you pay?" reminder. */
        deposit: (q.isZeroRate || underDev) ? null : q.deposit,
        balance: (q.isZeroRate || underDev) ? null : q.balance,
        reference: paymentReference,
        payment: {
          beneficiary: cfg.payment.beneficiary,
          iban: cfg.payment.iban,
          bic: cfg.payment.bic,
          bank: cfg.payment.bank
        }
      };
      if (window.fetch) {
        apiPost("/api/booking", { booking: currentBooking, previousReminderId: reminderId })
          .then(function (res) { reminderId = (res && res.reminderId) || null; })
          .catch(function () { reminderId = null; });
      }

      var rows = [
        [t("beneficiary"), cfg.payment.beneficiary],
        [t("iban"), cfg.payment.iban],
        [t("bic"), cfg.payment.bic],
        [t("bank"), cfg.payment.bank],
        [t("amount"), q.isZeroRate ? "—" : "€" + fmtMoney(q.deposit)],
        [t("reference"), paymentReference]
      ];

      var ibanHtml = rows.map(function (row) {
        return (
          '<div class="bw-iban-row">' +
            "<dt>" + row[0] + "</dt>" +
            '<dd><span class="bw-iban-value">' + row[1] + '</span>' +
            '<button type="button" class="bw-copy-btn" data-copy="' + escapeAttr(row[1]) + '" aria-label="' + t("copy") + '">📋</button>' +
            "</dd>" +
          "</div>"
        );
      }).join("");
      paymentStep.querySelector(".bw-iban-block").innerHTML = ibanHtml;

      var microcopy = q.isZeroRate
        ? fmt(t("payMicrocopyRequest"), { phone: cfg.phone })
        : fmt(t("payMicrocopy"), { deposit: fmtMoney(q.deposit), balance: fmtMoney(q.balance), phone: cfg.phone });
      paymentStep.querySelector(".bw-pay-microcopy").textContent = microcopy;

      var summaryRows = [
        [t("summaryDates"), q.checkin + " → " + q.checkout],
        [t("summaryGuests"), guestsLabel(q)],
        [t("summaryRooms"), roomsValue(q.rooms)],
        [t("summaryBeds"), q.beds],
        [t("summaryTotal"), q.isZeroRate ? "—" : "€ " + fmtMoney(q.total)],
        [t("summaryRef"), ref]
      ];
      if (!q.isZeroRate && q.balance > 0) {
        /* deposit + balance sit between the total and the reservation ID */
        summaryRows.splice(summaryRows.length - 1, 0,
          [fmt(t("summaryDeposit"), { pct: q.depositPct }), "€ " + fmtMoney(q.deposit)],
          [t("summaryBalance"), "€ " + fmtMoney(q.balance)]);
      }
      paymentStep.querySelector(".bw-summary-list").innerHTML = summaryRows.map(function (row) {
        return "<dt>" + row[0] + "</dt><dd>" + row[1] + "</dd>";
      }).join("");

      paymentStep.querySelectorAll(".bw-copy-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
          copyToClipboard(btn.getAttribute("data-copy"), btn);
        });
      });

      if (!underDev) wireScreenshot(ref);
    }

    /* ---- transfer screenshot: click / drop / paste, preview, hand-off ---- */
    var screenshotWired = false;
    function wireScreenshot(ref) {
      var zone = paymentStep.querySelector(".bw-dropzone");
      var input = paymentStep.querySelector(".bw-shot-input");
      var preview = paymentStep.querySelector(".bw-shot-preview");
      var hint = paymentStep.querySelector(".bw-shot-hint");
      var actions = paymentStep.querySelector(".bw-shot-actions");
      var status = paymentStep.querySelector(".bw-shot-status");
      /* Listeners bind once (the payment step is re-shown per booking). */
      if (screenshotWired) return;
      screenshotWired = true;

      function acceptFile(file) {
        if (!file || !/^image\//.test(file.type)) return;
        var reader = new FileReader();
        reader.onload = function () {
          preview.src = reader.result;
          preview.hidden = false;
          hint.hidden = true;
          zone.classList.add("has-image");
          status.textContent = t("shotAttached");
          actions.hidden = false;
          uploadScreenshot(reader.result);
        };
        reader.readAsDataURL(file);
      }

      /* Send the screenshot to the backend: cancels the guest's reminder and
         emails the owner for review. */
      function uploadScreenshot(dataUrl) {
        if (!window.fetch || !currentBooking) return;
        downscaleImage(dataUrl, function (image) {
          apiPost("/api/screenshot", {
            booking: currentBooking,
            image: image,
            reminderId: reminderId
          }).then(function () {
            reminderId = null;
            status.textContent = t("shotAttached") + " " + t("shotUploaded");
          }).catch(function () {});
        });
      }

      zone.addEventListener("click", function () { input.click(); });
      zone.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); }
      });
      input.addEventListener("change", function () { acceptFile(input.files[0]); });
      zone.addEventListener("dragover", function (e) { e.preventDefault(); zone.classList.add("is-drag"); });
      zone.addEventListener("dragleave", function () { zone.classList.remove("is-drag"); });
      zone.addEventListener("drop", function (e) {
        e.preventDefault();
        zone.classList.remove("is-drag");
        acceptFile(e.dataTransfer.files[0]);
      });
      paymentStep.addEventListener("paste", function (e) {
        var items = (e.clipboardData || {}).items || [];
        for (var i = 0; i < items.length; i++) {
          if (/^image\//.test(items[i].type)) {
            acceptFile(items[i].getAsFile());
            break;
          }
        }
      });
    }

    function escapeAttr(str) {
      return String(str).replace(/"/g, "&quot;");
    }

    function copyToClipboard(text, btn) {
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "✓";
        btn.classList.add("is-copied");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("is-copied");
        }, 1500);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, done);
      } else {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(ta);
        done();
      }
    }

    renderChildAges();
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (!window.KOTVA_CONFIG) return;
    document.querySelectorAll(".booking-widget").forEach(buildWidget);

    /* Returned from an abandoned Stripe Checkout: bring the widget back
       into view so the guest can retry. */
    if (/[?&]payment=cancelled\b/.test(window.location.search)) {
      var hero = document.querySelector('.booking-widget[data-widget="hero"]');
      if (hero) hero.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    document.querySelectorAll("[data-scroll-to-widget]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var hero = document.querySelector('.booking-widget[data-widget="hero"]');
        if (hero) hero.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
  });
})();
