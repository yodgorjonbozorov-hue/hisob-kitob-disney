/**
 * GURUH 2–3 — Moliya (040–069) va Sotuv/POS (070–099).
 */

import {
  ekran, ikona, pul, navLarge, navInline, navBiznes, ikonBtn, tabbar, scroll,
  bolim, karta, stat, qator, royxat, chip, tugma, segmented, qidiruv, maydon,
  stepper, bar, holat, sheet, banner, guruhSarlavha, skelQator, alert, actionSheet,
} from "../lib.mjs";

const E = [];
const qosh = (id, fayl, nom, body, opt = {}) => E.push({ id, fayl, html: ekran({ id, nom, body, ...opt }) });

const TAB_OWNER = (a) => tabbar([
  { ikona: "home", yorliq: "Asosiy", aktiv: a === 0 },
  { ikona: "list", yorliq: "Yozuvlar", aktiv: a === 1 },
  { ikona: "qarz", yorliq: "Qarzlar", aktiv: a === 2, badge: "3" },
  { ikona: "dots", yorliq: "Yana", aktiv: a === 3 },
]);
const TAB_KASSIR = (a) => tabbar([
  { ikona: "cart", yorliq: "Sotuv", aktiv: a === 0 },
  { ikona: "list", yorliq: "Yozuvlar", aktiv: a === 1 },
  { ikona: "qarz", yorliq: "Qarzlar", aktiv: a === 2 },
  { ikona: "wallet", yorliq: "Kassam", aktiv: a === 3 },
]);

// ══════════════ BAL-040 · Yozuvlar ro'yxati ══════════════
qosh("BAL-040", "BAL-040-yozuvlar", "Yozuvlar", `
${navLarge("Yozuvlar", ikonBtn("search") + ikonBtn("filter"))}
${scroll(`
  ${segmented(["Hammasi", "Kirim", "Chiqim"], 0)}
  ${guruhSarlavha("Bugun · 16-avgust")}
  ${royxat([
    qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "Naqd · 14:20", ong: "+2 400 000", ongKlass: "c-income" }),
    qator({ ikona: "cart", tur: "income", sarlavha: "Coca-Cola 1L × 24", izoh: "Click · 13:05", ong: "+336 000", ongKlass: "c-income" }),
    qator({ ikona: "chiqim", tur: "expense", sarlavha: "Doʻkon ijarasi — avgust", izoh: "Naqd · 11:40", ong: "−4 500 000", ongKlass: "c-expense" }),
  ])}
  ${guruhSarlavha("Kecha · 15-avgust")}
  ${royxat([
    qator({ ikona: "kirim", tur: "income", sarlavha: "Kunlik tushum", izoh: "Naqd · 20:10", ong: "+3 180 000", ongKlass: "c-income" }),
    qator({ ikona: "chiqim", tur: "expense", sarlavha: "Nonvoyxonaga toʻlov", izoh: "Naqd · 09:15", ong: "−890 000", ongKlass: "c-expense" }),
    qator({ ikona: "chiqim", tur: "expense", sarlavha: "Salima — avans", izoh: "Naqd · 08:40", ong: "−500 000", ongKlass: "c-expense" }),
  ])}
`)}
${TAB_OWNER(1)}`);

// ══════════════ BAL-043 · Yangi yozuv (summa) ══════════════
qosh("BAL-043", "BAL-043-yangi-yozuv", "Yangi yozuv", `
${navBiznes("Chorsu Savdo", "Direktor")}
${scroll("")}
${TAB_OWNER(1)}
${sheet("Yangi yozuv", `
  ${segmented(["Kirim", "Chiqim"], 0, "income")}
  <div class="amount-input">
    <span class="amount-input__value amount-input__value--income">250 000</span><span class="amount-input__caret"></span>
    <span class="amount-input__unit">soʻm</span>
  </div>
  <div class="t-footnote c-2" style="margin-bottom:var(--sp-2)">Kategoriya</div>
  <div class="row gap-2" style="flex-wrap:wrap">
    ${chip("Sotuv", "selected", { tap: true })}${chip("Qarz toʻlovi", "", { tap: true })}${chip("Xizmat", "", { tap: true })}${chip("Boshqa", "", { tap: true })}
  </div>
  <div class="row gap-2 mt-4">
    ${chip("Naqd kassa", "accent")}${chip("Bugun", "")}
  </div>
`, { olcham: "large", foot: tugma("Saqlash", "primary") })}`);

// ══════════════ BAL-050 · Kassalar ══════════════
qosh("BAL-050", "BAL-050-kassalar", "Kassalar", `
${navInline("Kassalar", { ong: ikonBtn("plus", { accent: true }) })}
${scroll(`
  <div class="card mt-2">
    <div class="t-footnote c-2">Jami qoldiq</div>
    <div class="amount amount--lg c-1 mt-1">${pul(8930000)}</div>
  </div>
  <div class="mt-4">
  ${royxat([
    qator({ ikona: "cash", tur: "accent", sarlavha: "Naqd kassa", izoh: "Asosiy", ong: pul(3450000), chevron: true }),
    qator({ ikona: "card", tur: "fill", sarlavha: "Click terminal", izoh: "Karta", ong: pul(4180000), chevron: true }),
    qator({ ikona: "wallet", tur: "fill", sarlavha: "Salima (kassir)", izoh: "Shaxsiy kassa", ong: pul(1300000), chevron: true }),
  ])}
  </div>
  <div class="mt-4">${tugma("Kassalar aro oʻtkazma", "secondary", { ikonaNomi: "transfer" })}</div>
`)}
${TAB_OWNER(3)}`);

// ══════════════ BAL-056 · Smena yopish ══════════════
qosh("BAL-056", "BAL-056-smena-sanash", "Smena yopish — naqd sanash", `
${navInline("Smena yakuni", { orqaga: "Bekor" })}
${scroll(`
  <div class="card mt-2">
    <div class="row-between">
      <span class="t-footnote c-2">Kutilgan naqd</span>
      ${chip("09:00 dan beri", "")}
    </div>
    <div class="amount amount--lg c-1 mt-1">${pul(3450000)}</div>
    <div class="t-caption-1 c-3 mt-2">Boshlangʻich 1 200 000 + tushum 3 950 000 − chiqim 1 700 000</div>
  </div>

  <div class="mt-5">
    <div class="t-footnote c-2" style="text-align:center">Sanalgan naqd</div>
    <div class="amount-input" style="padding-top:var(--sp-3)">
      <span class="amount-input__value c-1">3 420 000</span><span class="amount-input__caret"></span>
      <span class="amount-input__unit">soʻm</span>
    </div>
  </div>

  <div class="card mt-2" style="background:var(--debt-soft);border-color:transparent;box-shadow:none">
    <div class="row gap-2">
      <span class="c-debt">${ikona("warning", 18)}</span>
      <div class="grow">
        <div class="t-callout" style="color:var(--debt-on);font-weight:620">Farq: −30 000 soʻm</div>
        <div class="t-caption-1" style="color:var(--debt-on);opacity:.85">Kam chiqdi. Sababini yozing.</div>
      </div>
    </div>
  </div>
  ${maydon("Izoh", "Masalan: mijozga qaytim kam berildi", { placeholder: true })}
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Topshirish", "primary")}</div>`);

// ══════════════ BAL-067 · Yozuvlar — bo'sh ══════════════
qosh("BAL-067", "BAL-067-yozuvlar-empty", "Yozuvlar — boʻsh", `
${navLarge("Yozuvlar", ikonBtn("search") + ikonBtn("filter"))}
${holat("list", "Bu oyda hali yozuv yoʻq", "Birinchi kirim yoki chiqimni qoʻshing — hisobot oʻzi shakllanadi.", { tur: "accent", cta: tugma("Yozuv qoʻshish", "primary") })}
${TAB_OWNER(1)}`);

// ══════════════ BAL-040-loading ══════════════
qosh("BAL-040L", "BAL-040-yozuvlar-loading", "Yozuvlar — yuklanmoqda", `
${navLarge("Yozuvlar", ikonBtn("search") + ikonBtn("filter"))}
${scroll(`
  ${segmented(["Hammasi", "Kirim", "Chiqim"], 0)}
  ${guruhSarlavha("Bugun · 16-avgust")}
  <div class="list">${skelQator()}${skelQator()}${skelQator()}</div>
  ${guruhSarlavha("Kecha · 15-avgust")}
  <div class="list">${skelQator()}${skelQator()}</div>
`)}
${TAB_OWNER(1)}`);

// ══════════════ BAL-070 · Sotuv — mahsulot tanlash ══════════════
qosh("BAL-070", "BAL-070-sotuv", "Sotuv — mahsulot tanlash", `
${navLarge("Sotuv", ikonBtn("scan", { accent: true }))}
${scroll(`
  ${qidiruv("Mahsulot nomi yoki kodi")}
  <div class="row gap-2 mt-3" style="flex-wrap:wrap">
    ${chip("Hammasi", "selected", { tap: true })}${chip("Ichimlik", "", { tap: true })}${chip("Non", "", { tap: true })}${chip("Sut", "", { tap: true })}
  </div>
  <div class="mt-3">
  ${royxat([
    qator({ ikona: "box", tur: "fill", sarlavha: "Coca-Cola 1L", izoh: "Qoldiq: 48 dona", ong: pul(14000), ongIzoh: "soʻm" }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Guruch (Loser)", izoh: "Qoldiq: 120 kg", ong: pul(18000), ongIzoh: "kg" }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Non (patir)", izoh: "Qoldiq: 24 dona", ong: pul(5000), ongIzoh: "soʻm" }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Sut 1L (Nestle)", izoh: "Qoldiq: 6 dona", ong: pul(12500), ongIzoh: "soʻm" }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Yogʻ (Oleyna) 1L", izoh: "Qoldiq: 3 dona", ong: pul(28000), ongIzoh: "kam" }),
  ])}
  </div>
`)}
${TAB_KASSIR(0)}`);

// ══════════════ BAL-071 · Sotuv — miqdor ══════════════
qosh("BAL-071", "BAL-071-sotuv-miqdor", "Sotuv — miqdor va narx", `
${navInline("Coca-Cola 1L", { orqaga: "Sotuv" })}
${scroll(`
  <div class="card mt-2">
    <div class="row-between">
      <span class="t-footnote c-2">Ombordagi qoldiq</span>
      <span class="t-callout c-1" style="font-weight:620">48 dona</span>
    </div>
  </div>

  <div class="card mt-3">
    <div class="t-footnote c-2">Miqdor</div>
    <div class="row-between mt-2">
      ${stepper("3", "dona")}
      <span class="t-caption-1 c-3">Maks 48</span>
    </div>
  </div>

  <div class="card mt-3">
    <div class="row-between">
      <span class="t-footnote c-2">Birlik narxi</span>
      <span class="t-caption-1 c-3">rejadagi narx</span>
    </div>
    <div class="row-between mt-1">
      <span class="amount amount--md c-1">${pul(14000)}</span>
      <span class="t-subheadline c-accent">Oʻzgartirish</span>
    </div>
  </div>

  <div class="card card--accent mt-4">
    <div class="row-between">
      <span class="t-headline c-1">Jami</span>
      <span class="amount amount--lg c-1">${pul(42000)}</span>
    </div>
  </div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Davom etish", "primary")}</div>`);

// ══════════════ BAL-072 · Sotuv — to'lov turi ══════════════
qosh("BAL-072", "BAL-072-sotuv-tolov", "Sotuv — toʻlov turi", `
${navInline("Toʻlov", { orqaga: "Orqaga" })}
${scroll(`
  <div class="card card--accent mt-2">
    <div class="row-between">
      <span class="t-headline c-1">Toʻlanadi</span>
      <span class="amount amount--lg c-1">${pul(42000)}</span>
    </div>
    <div class="t-caption-1 c-2 mt-1">Coca-Cola 1L × 3</div>
  </div>

  <div class="t-footnote c-2 mt-5" style="margin-bottom:var(--sp-2)">Toʻlov usuli</div>
  <div class="pay-grid">
    <div class="pay-opt pay-opt--selected">${ikona("cash", 22)}<span class="t-subheadline">Naqd</span></div>
    <div class="pay-opt">${ikona("card", 22)}<span class="t-subheadline">Click</span></div>
    <div class="pay-opt">${ikona("qarz", 22)}<span class="t-subheadline">Qarz</span></div>
    <div class="pay-opt" style="opacity:.4">${ikona("transfer", 22)}<span class="t-subheadline">Aralash</span></div>
  </div>
  <div class="t-caption-1 c-3 mt-2">Aralash toʻlov hozircha mavjud emas</div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Yakunlash", "primary")}</div>`);

// ══════════════ BAL-073 · Sotuv — qarz uchun mijoz ══════════════
qosh("BAL-073", "BAL-073-sotuv-mijoz", "Qarzga sotish — mijoz", `
${navInline("Mijoz tanlash", { orqaga: "Orqaga" })}
${scroll(`
  ${qidiruv("Ism yoki telefon")}
  <div class="mt-3">
  ${royxat([
    qator({ avatar: "K", sarlavha: "Karim aka (Chorsu)", izoh: "+998 90 123 45 67", ong: pul(4200000), ongIzoh: "ochiq qarz", ongKlass: "c-debt", chevron: true }),
    qator({ avatar: "D", sarlavha: "Dilshod aka", izoh: "+998 93 555 12 00", ong: pul(1850000), ongIzoh: "ochiq qarz", ongKlass: "c-debt", chevron: true }),
    qator({ avatar: "S", sarlavha: "Sardor (Yunusobod)", izoh: "+998 91 200 30 40", ong: "0", ongIzoh: "qarzi yoʻq", chevron: true }),
  ])}
  </div>

  <div class="card mt-4" style="background:var(--debt-soft);border-color:transparent;box-shadow:none">
    <div class="row-between">
      <span class="t-callout" style="color:var(--debt-on);font-weight:620">Karim akaning qarz limiti</span>
      <span class="t-caption-1" style="color:var(--debt-on)">84%</span>
    </div>
    <div class="mt-2">${bar([{ ulush: 84, rang: "debt" }], { thin: true })}</div>
    <div class="t-caption-1 mt-2" style="color:var(--debt-on)">4 200 000 / 5 000 000 · yana 800 000 mumkin</div>
  </div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Qarzga berish", "primary")}</div>`);

// ══════════════ BAL-074 · Chek ══════════════
qosh("BAL-074", "BAL-074-chek", "Sotuv yakunlandi", `
${navInline("Chek", { orqaga: "Yopish", ong: ikonBtn("share", { accent: true }) })}
${scroll(`
  <div style="text-align:center;padding:var(--sp-6) 0 var(--sp-4)">
    <div style="width:72px;height:72px;border-radius:50%;background:var(--income-soft);color:var(--income-on);
                display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-3)">
      ${ikona("check", 34)}
    </div>
    <div class="t-title-2 c-1">Sotuv yakunlandi</div>
    <div class="amount amount--lg c-income mt-2">${pul(42000)}</div>
  </div>

  <div class="card">
    ${royxat([
      qator({ sarlavha: "Coca-Cola 1L", izoh: "14 000 × 3", ong: pul(42000) }),
    ], { plain: true }).replace('class="list"', 'class="list list--plain" style="box-shadow:none;border:0"')}
    <div class="row-between" style="padding-top:var(--sp-3);border-top:1px solid var(--separator);margin-top:var(--sp-2)">
      <span class="t-footnote c-2">Toʻlov</span>
      <span class="t-callout c-1">Naqd</span>
    </div>
    <div class="row-between mt-2">
      <span class="t-footnote c-2">Kassir</span>
      <span class="t-callout c-1">Salima</span>
    </div>
    <div class="row-between mt-2">
      <span class="t-footnote c-2">Vaqt</span>
      <span class="t-callout c-1">16-avgust, 14:32</span>
    </div>
  </div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)" class="col gap-2">
  ${tugma("Yangi sotuv", "primary")}
  ${tugma("Chekni ulashish", "secondary", { ikonaNomi: "share" })}
</div>`);

// ══════════════ BAL-080 · Savat (MISSING) ══════════════
qosh("BAL-080", "BAL-080-savat", "Savat — MISSING", `
${navInline("Savat · 3 ta", { orqaga: "Sotuv" })}
${scroll(`
  <div class="banner banner--offline" style="border-radius:var(--r-md);margin-top:var(--sp-2)">
    ${ikona("warning", 15)}<span class="grow">Backend'da yoʻq — bu maqsadli dizayn</span>
  </div>
  <div class="list card--flush mt-3">
    <div class="cart-row">
      <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
      <div class="grow col" style="gap:2px">
        <span class="t-callout c-1" style="font-weight:550">Coca-Cola 1L</span>
        <span class="t-caption-1 c-3">14 000 × 3 = 42 000</span>
      </div>
      ${stepper("3", "dona")}
    </div>
    <div class="cart-row">
      <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
      <div class="grow col" style="gap:2px">
        <span class="t-callout c-1" style="font-weight:550">Guruch (Loser)</span>
        <span class="t-caption-1 c-3">18 000 × 1.5 = 27 000</span>
      </div>
      ${stepper("1.5", "kg")}
    </div>
    <div class="cart-row">
      <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
      <div class="grow col" style="gap:2px">
        <span class="t-callout c-1" style="font-weight:550">Non (patir)</span>
        <span class="t-caption-1 c-3">5 000 × 4 = 20 000</span>
      </div>
      ${stepper("4", "dona")}
    </div>
    <div class="cart-total">
      <span class="t-headline c-1">Jami</span>
      <span class="amount amount--lg c-1">${pul(89000)}</span>
    </div>
  </div>
  <div class="mt-3">${tugma("Chegirma qoʻshish", "tertiary")}</div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Toʻlovga · 89 000 soʻm", "primary")}</div>`);

// ══════════════ BAL-085 · Ombor yetarli emas ══════════════
qosh("BAL-085", "BAL-085-ombor-yetmadi", "Ombor yetarli emas", `
${navInline("Yogʻ (Oleyna) 1L", { orqaga: "Sotuv" })}
${scroll(`
  <div class="card mt-2">
    <div class="row-between">
      <span class="t-footnote c-2">Ombordagi qoldiq</span>
      <span class="t-callout c-expense" style="font-weight:620">3 dona</span>
    </div>
  </div>
  <div class="card mt-3">
    <div class="t-footnote c-2">Miqdor</div>
    <div class="row-between mt-2">
      ${stepper("5", "dona")}
      <span class="t-caption-1 c-expense">Maks 3</span>
    </div>
  </div>
`)}
${alert("Omborda yetarli emas", "Yogʻ (Oleyna) 1L — omborda 3 dona qoldi, siz 5 dona sotmoqchisiz.", [
  { matn: "Qoldiqni tekshirish" },
  { matn: "3 ta sotish" },
])}`);

export const EKRANLAR = E;
