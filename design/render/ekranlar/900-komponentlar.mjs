/**
 * BAL-900 — KOMPONENT KUTUBXONASI (spesifikatsiya varag'i).
 *
 * Bu EKRAN EMAS — barcha komponentlar bitta uzun sahifada, holatlari bilan.
 * `<body data-tall>` → shot.mjs uni to'liq sahifa qilib oladi.
 */

import {
  ikona, pul, navLarge, navInline, navBiznes, ikonBtn, tabbar, bolim, karta,
  stat, qator, royxat, chip, tugma, segmented, qidiruv, maydon, stepper, bar,
  holat, banner, toast, grafik, donut, skelQator, statusbar, homebar,
} from "../lib.mjs";

const guruh = (nom, izoh, ichki) => `
<section class="bal-sec">
  <div class="bal-sec__head">
    <h2 class="bal-sec__title">${nom}</h2>
    ${izoh ? `<p class="bal-sec__note">${izoh}</p>` : ""}
  </div>
  <div class="bal-sec__body">${ichki}</div>
</section>`;

const qatorlik = (ichki) => `<div class="bal-row">${ichki}</div>`;

const body = `
${guruh("1 · Navigation bar", "Katta sarlavha → skrollda inline'ga o'tadi", `
  <div class="bal-frame">${navLarge("Yozuvlar", ikonBtn("search") + ikonBtn("filter"))}</div>
  <div class="bal-frame">${navInline("Yozuv tafsiloti", { ong: ikonBtn("edit", { accent: true }) })}</div>
  <div class="bal-frame">${navBiznes("Chorsu Savdo", "Direktor")}</div>
`)}

${guruh("2 · Tab bar", "Rolga qarab quriladi. O'rtada FAB — bosh barmoq zonasining markazi.", `
  <div class="bal-frame">${tabbar([
    { ikona: "home", yorliq: "Asosiy", aktiv: true },
    { ikona: "list", yorliq: "Yozuvlar" },
    { ikona: "qarz", yorliq: "Qarzlar", badge: "3" },
    { ikona: "dots", yorliq: "Yana" },
  ])}</div>
  <div class="bal-frame">${tabbar([
    { ikona: "list", yorliq: "Yozuvlar", aktiv: true },
    { ikona: "settings", yorliq: "Profil" },
  ])}</div>
`)}

${guruh("3 · Tugmalar", "Barcha holat: default · pressed · disabled · loading", `
  ${qatorlik(tugma("Saqlash", "primary", { block: false }) + tugma("Saqlash", "primary", { block: false }).replace("btn--primary", "btn--primary is-pressed") + tugma("Saqlash", "primary", { block: false, disabled: true }))}
  ${qatorlik(`<div class="btn btn--primary"><span class="btn__spinner"></span></div>` + tugma("Bekor qilish", "secondary", { block: false }) + tugma("Batafsil", "tertiary", { block: false }))}
  ${qatorlik(tugma("Oʻchirish", "destructive", { block: false }) + tugma("Sotuvni bekor qilish", "destructive-soft", { block: false }))}
`)}

${guruh("4 · Kartalar va statistika", "Rangga tayanmaydi — ikona va ishora ham bor", `
  <div class="bal-frame bal-frame--pad">
    <div class="row gap-2">
      ${stat("Kirdi", pul(47250000), "income", "kirim")}
      ${stat("Chiqdi", pul(34770000), "expense", "chiqim")}
    </div>
    <div class="row gap-2 mt-2">
      ${stat("Ochiq qarz", pul(18400000), "debt", "qarz")}
      ${stat("Kassa", pul(3450000), "accent", "wallet")}
    </div>
  </div>
`)}

${guruh("5 · Ro'yxat qatori", "Ajratkich matndan boshlanadi (iOS naqshi). Swipe amallari o'ngda.", `
  <div class="bal-frame bal-frame--pad">
    ${royxat([
      qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "Naqd · 14:20", ong: "+2 400 000", ongKlass: "c-income" }),
      qator({ ikona: "cart", tur: "income", sarlavha: "Coca-Cola 1L × 24", izoh: "Click · 13:05", ong: "+336 000", ongKlass: "c-income" }),
      qator({ ikona: "chiqim", tur: "expense", sarlavha: "Doʻkon ijarasi — avgust", izoh: "Naqd · 11:40", ong: "−4 500 000", ongKlass: "c-expense" }),
      qator({ avatar: "D", sarlavha: "Dilshod aka", izoh: "3 ta ochiq qarz", ong: "1 850 000", ongKlass: "c-debt", chevron: true }),
    ])}
  </div>
  <div class="bal-frame bal-frame--pad">
    <div class="list" style="position:relative">
      ${qator({ ikona: "kirim", tur: "income", sarlavha: "Chapga surilgan qator", izoh: "swipe amallari", ong: "+120 000", ongKlass: "c-income" })}
      <div class="swipe">
        <div class="swipe__act swipe__act--edit">${ikona("edit", 18)}Tahrir</div>
        <div class="swipe__act swipe__act--delete">${ikona("trash", 18)}Oʻchirish</div>
      </div>
    </div>
  </div>
`)}

${guruh("6 · Maydonlar", "Tegish maydoni 44pt. Xato maydon ostida, qizil chegara bilan.", `
  <div class="bal-frame bal-frame--pad">
    ${maydon("Izoh", "Masalan: ijara toʻlovi", { placeholder: true })}
    ${maydon("Mijoz", "Karim aka", { holat: "focus" })}
    <div class="field">
      <span class="field__label">Summa</span>
      <div class="input input--error"><span>0</span></div>
      <div class="field__error">Summa 0 dan katta boʻlishi kerak</div>
    </div>
    ${qidiruv("Mahsulot yoki mijoz")}
  </div>
`)}

${guruh("7 · Summa kiritish", "Ekranning bosh elementi — 40px, tabular, rang segmentga bog'liq", `
  <div class="bal-frame bal-frame--pad">
    ${segmented(["Kirim", "Chiqim"], 0, "income")}
    <div class="amount-input">
      <span class="amount-input__value amount-input__value--income">250 000</span><span class="amount-input__caret"></span>
      <span class="amount-input__unit">soʻm</span>
    </div>
  </div>
  <div class="bal-frame bal-frame--pad">
    ${segmented(["Kirim", "Chiqim"], 1, "expense")}
    <div class="amount-input">
      <span class="amount-input__value amount-input__value--expense">4 500 000</span>
      <span class="amount-input__unit">soʻm</span>
    </div>
  </div>
`)}

${guruh("8 · Stepper (kasr qo'llab-quvvatlaydi)", "1.5 kg — MISSING backend'da, lekin komponent tayyor", `
  ${qatorlik(stepper("3", "dona") + stepper("1.5", "kg") + stepper("0.75", "litr"))}
`)}

${guruh("9 · Segmented va chiplar", "", `
  <div class="bal-frame bal-frame--pad">
    ${segmented(["Hammasi", "Kirim", "Chiqim"], 0)}
    <div class="row gap-2 mt-3" style="flex-wrap:wrap">
      ${chip("Bu oy", "accent")}${chip("Kirim", "income")}${chip("Chiqim", "expense")}${chip("Qarz", "debt")}${chip("Naqd")}${chip("Tanlangan", "selected")}
    </div>
    <div class="row gap-2 mt-3" style="flex-wrap:wrap">
      ${chip("Ijara", "", { tap: true })}${chip("Maosh", "", { tap: true })}${chip("Tovar", "", { tap: true })}
    </div>
  </div>
`)}

${guruh("10 · Progress va aging", "Qarz yoshi — 4 pog'ona (backend PARTIAL)", `
  <div class="bal-frame bal-frame--pad">
    ${bar([
      { ulush: 34, rang: "income" },
      { ulush: 28, rang: "debt" },
      { ulush: 22, rang: "warning" },
      { ulush: 16, rang: "expense" },
    ])}
    <div class="aging-legend">
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--income)"></span>1–7 kun</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--debt)"></span>7–30</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--warning)"></span>30–60</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--expense)"></span>60+</span>
    </div>
    <div class="mt-4">${bar([{ ulush: 84, rang: "debt" }], { thin: true })}</div>
    <div class="t-caption-1 c-3 mt-2">Qarz limiti: 4 200 000 / 5 000 000 (84%)</div>
  </div>
`)}

${guruh("11 · Grafiklar", "Kategoriya rangi doimiy biriktiriladi (chart-1…5)", `
  <div class="bal-frame bal-frame--pad">
    ${grafik([0.42, 0.55, 0.38, 0.71, 0.62, 0.88], ["Mar", "Apr", "May", "Iyn", "Iyl", "Avg"], 5)}
  </div>
  <div class="bal-frame bal-frame--pad">
    <div class="row gap-4">
      ${donut([
        { ulush: 38, rang: "chart-1" },
        { ulush: 26, rang: "chart-2" },
        { ulush: 18, rang: "chart-3" },
        { ulush: 18, rang: "chart-4" },
      ], pul(34770000), "Chiqim")}
      <div class="grow col gap-2">
        <span class="t-footnote c-2">Tovar · 38%</span>
        <span class="t-footnote c-2">Ijara · 26%</span>
        <span class="t-footnote c-2">Maosh · 18%</span>
        <span class="t-footnote c-2">Boshqa · 18%</span>
      </div>
    </div>
  </div>
`)}

${guruh("12 · Yuklanmoqda (skeleton)", "Spinner EMAS: ro'yxat shakli oldindan ko'rinadi — sakrash bo'lmaydi", `
  <div class="bal-frame bal-frame--pad">
    <div class="list">${skelQator()}${skelQator()}${skelQator()}</div>
  </div>
`)}

${guruh("13 · Bo'sh va xato holatlar", "Har biri: ikona + sarlavha + izoh + amal", `
  <div class="bal-frame" style="height:300px;display:flex">
    ${holat("list", "Bu oyda hali yozuv yoʻq", "Birinchi kirim yoki chiqimni qoʻshing — hisobot oʻzi shakllanadi.", { tur: "accent", cta: tugma("Yozuv qoʻshish", "primary") })}
  </div>
  <div class="bal-frame" style="height:300px;display:flex">
    ${holat("offline", "Internet yoʻq", "Yozuvlaringiz navbatda saqlanmoqda va ulanish tiklanishi bilan yuboriladi.", { tur: "" })}
  </div>
  <div class="bal-frame" style="height:300px;display:flex">
    ${holat("warning", "Nimadir notoʻgʻri ketdi", "Serverga ulanib boʻlmadi. Bir ozdan keyin qayta urinib koʻring.", { tur: "expense", cta: tugma("Qayta urinish", "secondary") })}
  </div>
`)}

${guruh("14 · Bannerlar va toast", "", `
  <div class="bal-frame">${banner("offline", "Internet yoʻq · 3 ta yozuv navbatda")}</div>
  <div class="bal-frame">${banner("sync", "Sinxronlanmoqda · 2 / 3")}</div>
  <div class="bal-frame">${banner("readonly", "Obuna muddati tugagan — faqat oʻqish mumkin")}</div>
  <div class="bal-frame" style="height:90px;position:relative">
    <div style="position:absolute;left:16px;right:16px;bottom:16px">${toast("Yozuv saqlandi").replace('class="toast"', 'class="toast" style="position:static;left:auto;right:auto;bottom:auto"')}</div>
  </div>
`)}

${guruh("15 · To'lov usuli", "Aralash to'lov — MISSING backend'da", `
  <div class="bal-frame bal-frame--pad">
    <div class="pay-grid">
      <div class="pay-opt pay-opt--selected">${ikona("cash", 22)}<span class="t-subheadline">Naqd</span></div>
      <div class="pay-opt">${ikona("card", 22)}<span class="t-subheadline">Karta</span></div>
      <div class="pay-opt">${ikona("qarz", 22)}<span class="t-subheadline">Qarz</span></div>
      <div class="pay-opt">${ikona("transfer", 22)}<span class="t-subheadline">Aralash</span></div>
    </div>
  </div>
`)}

${guruh("16 · Savat qatori (POS)", "MISSING — backend bitta mahsulot saqlaydi", `
  <div class="bal-frame bal-frame--pad">
    <div class="list card--flush">
      <div class="cart-row">
        <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
        <div class="grow col" style="gap:2px">
          <span class="t-callout c-1" style="font-weight:550">Coca-Cola 1L</span>
          <span class="t-caption-1 c-3">14 000 × 3</span>
        </div>
        ${stepper("3", "dona")}
      </div>
      <div class="cart-row">
        <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
        <div class="grow col" style="gap:2px">
          <span class="t-callout c-1" style="font-weight:550">Guruch (Loser)</span>
          <span class="t-caption-1 c-3">18 000 × 1.5</span>
        </div>
        ${stepper("1.5", "kg")}
      </div>
      <div class="cart-total">
        <span class="t-headline c-1">Jami</span>
        <span class="amount amount--lg c-1">69 000</span>
      </div>
    </div>
  </div>
`)}
`;

const html = `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>BAL-900 — Komponent kutubxonasi</title>
<link rel="stylesheet" href="../tokens.css">
<link rel="stylesheet" href="../base.css">
<link rel="stylesheet" href="../components.css">
<style>
  /* Faqat SHU spesifikatsiya varag'i uchun — ekranlarda ishlatilmaydi. */
  html, body { height: auto; overflow: visible; }
  body { background: var(--bg-base); padding-bottom: var(--sp-10); }
  .bal-head { padding: var(--sp-6) var(--sp-4) var(--sp-2); }
  .bal-head h1 { font-family: var(--font-display); font-size: 28px; font-weight: 700; color: var(--label-1); }
  .bal-head p { font-size: var(--t-footnote); color: var(--label-2); margin-top: 4px; }
  .bal-sec { padding: var(--sp-5) 0 var(--sp-2); }
  .bal-sec__head { padding: 0 var(--sp-4) var(--sp-3); }
  .bal-sec__title { font-size: var(--t-headline); font-weight: 620; color: var(--label-1); }
  .bal-sec__note { font-size: var(--t-caption-1); color: var(--label-3); margin-top: 2px; }
  .bal-frame { background: var(--bg-base); border-top: 1px solid var(--separator);
               border-bottom: 1px solid var(--separator); margin-bottom: var(--sp-3); }
  .bal-frame--pad { padding: var(--sp-4); }
  .bal-row { display: flex; flex-wrap: wrap; gap: var(--sp-2); padding: var(--sp-3) var(--sp-4); align-items: center; }
</style>
</head>
<body data-tall>
  <div class="bal-head">
    <h1>Balansa iOS — komponentlar</h1>
    <p>BAL-900 · 16 guruh · barcha holat · light va dark</p>
  </div>
  ${body}
</body>
</html>
`;

export const EKRANLAR = [{ id: "BAL-900", fayl: "BAL-900-komponentlar", html }];
