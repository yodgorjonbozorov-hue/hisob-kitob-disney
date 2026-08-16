/**
 * GURUH 4–8 — Ombor/Xarid (100–149), CRM/Qarz (150–179),
 * Hisobot (200–219), Bildirishnoma/AI (240–279), Profil/Global (280–319).
 */

import {
  ekran, ikona, pul, navLarge, navInline, navBiznes, ikonBtn, tabbar, scroll,
  bolim, qator, royxat, chip, tugma, segmented, qidiruv, maydon, bar, holat,
  banner, guruhSarlavha, stat, donut, grafik, sheet, alert,
} from "../lib.mjs";

const E = [];
const qosh = (id, fayl, nom, body, opt = {}) => E.push({ id, fayl, html: ekran({ id, nom, body, ...opt }) });

const TAB_OWNER = (a) => tabbar([
  { ikona: "home", yorliq: "Asosiy", aktiv: a === 0 },
  { ikona: "list", yorliq: "Yozuvlar", aktiv: a === 1 },
  { ikona: "qarz", yorliq: "Qarzlar", aktiv: a === 2, badge: "3" },
  { ikona: "dots", yorliq: "Yana", aktiv: a === 3 },
]);
const TAB_SELLER = (a) => tabbar([
  { ikona: "list", yorliq: "Yozuvlar", aktiv: a === 0 },
  { ikona: "settings", yorliq: "Profil", aktiv: a === 1 },
]);

// ══════════════ BAL-100 · Ombor ══════════════
qosh("BAL-100", "BAL-100-ombor", "Ombor", `
${navLarge("Ombor", ikonBtn("search") + ikonBtn("plus", { accent: true }))}
${scroll(`
  <div class="row gap-2">
    ${stat("Ombor qiymati", pul(24800000), "accent", "box")}
    ${stat("Kam qolgan", "3", "debt", "warning")}
  </div>
  ${bolim("Mahsulotlar", "Saralash")}
  ${royxat([
    qator({ ikona: "box", tur: "fill", sarlavha: "Coca-Cola 1L", izoh: "14 000 soʻm · dona", ong: "48", ongIzoh: "qoldiq", chevron: true }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Guruch (Loser)", izoh: "18 000 soʻm · kg", ong: "120", ongIzoh: "qoldiq", chevron: true }),
    qator({ ikona: "box", tur: "fill", sarlavha: "Non (patir)", izoh: "5 000 soʻm · dona", ong: "24", ongIzoh: "qoldiq", chevron: true }),
    qator({ ikona: "warning", tur: "debt", sarlavha: "Sut 1L (Nestle)", izoh: "12 500 soʻm · dona", ong: "6", ongIzoh: "kam", ongKlass: "c-debt", chevron: true }),
    qator({ ikona: "warning", tur: "debt", sarlavha: "Yogʻ (Oleyna) 1L", izoh: "28 000 soʻm · dona", ong: "3", ongIzoh: "kam", ongKlass: "c-debt", chevron: true }),
  ])}
`)}
${TAB_OWNER(3)}`);

// ══════════════ BAL-104 · Ombor kirimi ══════════════
qosh("BAL-104", "BAL-104-ombor-kirim", "Ombor kirimi", `
${navInline("Ombor kirimi", { orqaga: "Bekor" })}
${scroll(`
  <div class="card mt-2">
    <div class="row gap-3">
      <div class="list-row__icon list-row__icon--fill">${ikona("box", 16)}</div>
      <div class="grow">
        <div class="t-callout c-1" style="font-weight:550">Coca-Cola 1L</div>
        <div class="t-caption-1 c-3">Hozirgi qoldiq: 48 dona</div>
      </div>
    </div>
  </div>
  ${maydon("Kelgan miqdor", "120")}
  ${maydon("Tannarx (birlik)", "11 500")}
  ${maydon("Taʼminotchi", "Toshkent Ichimlik MCHJ")}
  <div class="card card--accent mt-3">
    <div class="row-between">
      <span class="t-headline c-1">Yangi qoldiq</span>
      <span class="amount amount--lg c-1">168</span>
    </div>
    <div class="t-caption-1 c-2 mt-1">Xarid summasi: 1 380 000 soʻm</div>
  </div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Kirim qilish", "primary")}</div>`);

// ══════════════ BAL-130 · Xarid buyurtmalari ══════════════
qosh("BAL-130", "BAL-130-xarid", "Xarid buyurtmalari", `
${navLarge("Xarid", ikonBtn("plus", { accent: true }))}
${scroll(`
  ${segmented(["Yoʻlda", "Qabul qilingan", "Hammasi"], 0)}
  <div class="mt-3">
  ${royxat([
    qator({ ikona: "truck", tur: "accent", sarlavha: "Toshkent Ichimlik MCHJ", izoh: "8 satr · 14-avgust", ong: pul(12400000), ongIzoh: "yoʻlda", chevron: true }),
    qator({ ikona: "truck", tur: "accent", sarlavha: "Loser Guruch", izoh: "3 satr · 12-avgust", ong: pul(5600000), ongIzoh: "yoʻlda", chevron: true }),
  ])}
  </div>
  ${bolim("Qabul qilingan")}
  ${royxat([
    qator({ ikona: "check", tur: "income", sarlavha: "Nestle Uzbekistan", izoh: "5 satr · 10-avgust", ong: pul(3200000), ongIzoh: "toʻliq toʻlangan" }),
    qator({ ikona: "check", tur: "debt", sarlavha: "Oleyna Distribyutor", izoh: "2 satr · 08-avgust", ong: pul(1800000), ongIzoh: "qisman", ongKlass: "c-debt" }),
  ])}
`)}
${TAB_OWNER(3)}`);

// ══════════════ BAL-150 · Qarzlar dashboard ══════════════
qosh("BAL-150", "BAL-150-qarzlar", "Qarzlar", `
${navLarge("Qarzlar", ikonBtn("plus", { accent: true }))}
${scroll(`
  <div class="card">
    <div class="t-footnote c-2">Ochiq qarz</div>
    <div class="amount amount--lg c-1 mt-1">${pul(18400000)}</div>
    <div class="mt-3">${bar([
      { ulush: 34, rang: "income" },
      { ulush: 28, rang: "debt" },
      { ulush: 22, rang: "warning" },
      { ulush: 16, rang: "expense" },
    ])}</div>
    <div class="aging-legend">
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--income)"></span>1–7 kun</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--debt)"></span>7–30</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--warning)"></span>30–60</span>
      <span class="aging-legend__item"><span class="aging-legend__dot" style="background:var(--expense)"></span>60+</span>
    </div>
  </div>

  <div class="row gap-2 mt-3">
    ${stat("Kechikkan", pul(6200000), "expense", "warning")}
    ${stat("Bu oy tushdi", pul(9800000), "income", "kirim")}
  </div>

  ${bolim("Eng eski qarzlar", "Hammasi")}
  ${royxat([
    qator({ avatar: "D", sarlavha: "Dilshod aka", izoh: "68 kun · muddat oʻtgan", ong: pul(2100000), ongKlass: "c-expense", chevron: true }),
    qator({ avatar: "K", sarlavha: "Karim aka (Chorsu)", izoh: "42 kun", ong: pul(1850000), ongKlass: "c-debt", chevron: true }),
    qator({ avatar: "S", sarlavha: "Sardor (Yunusobod)", izoh: "18 kun", ong: pul(940000), ongKlass: "c-debt", chevron: true }),
    qator({ avatar: "N", sarlavha: "Nodir aka", izoh: "5 kun", ong: pul(620000), chevron: true }),
  ])}
`)}
${TAB_OWNER(2)}`);

// ══════════════ BAL-152 · Qarz tafsiloti ══════════════
qosh("BAL-152", "BAL-152-qarz-tafsilot", "Qarz tafsiloti", `
${navInline("Dilshod aka", { orqaga: "Qarzlar", ong: ikonBtn("phone", { accent: true }) })}
${scroll(`
  <div class="card mt-2" style="background:var(--expense-soft);border-color:transparent;box-shadow:none">
    <div class="t-footnote" style="color:var(--expense-on)">Qolgan qarz</div>
    <div class="amount amount--lg mt-1" style="color:var(--expense-on)">${pul(2100000)}</div>
    <div class="t-caption-1 mt-2" style="color:var(--expense-on)">68 kun · muddat 20-iyunda oʻtgan</div>
  </div>

  <div class="card mt-3">
    <div class="row-between">
      <span class="t-footnote c-2">Boshlangʻich summa</span>
      <span class="t-callout c-1">${pul(3500000)}</span>
    </div>
    <div class="row-between mt-2">
      <span class="t-footnote c-2">Toʻlangan</span>
      <span class="t-callout c-income">${pul(1400000)}</span>
    </div>
    <div class="mt-3">${bar([{ ulush: 40, rang: "income" }], { thin: true })}</div>
  </div>

  ${bolim("Toʻlov tarixi")}
  ${royxat([
    qator({ ikona: "kirim", tur: "income", sarlavha: "Naqd toʻlov", izoh: "28-iyul", ong: "+800 000", ongKlass: "c-income" }),
    qator({ ikona: "kirim", tur: "income", sarlavha: "Naqd toʻlov", izoh: "12-iyul", ong: "+600 000", ongKlass: "c-income" }),
    qator({ ikona: "qarz", tur: "debt", sarlavha: "Qarzga sotuv", izoh: "10-iyun · Guruch 100 kg", ong: pul(3500000), ongKlass: "c-debt" }),
  ])}
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)" class="col gap-2">
  ${tugma("Toʻlov qabul qilish", "primary")}
  ${tugma("Qoʻngʻiroq qilish", "secondary", { ikonaNomi: "phone" })}
</div>`);

// ══════════════ BAL-153 · To'lov qabul qilish ══════════════
qosh("BAL-153", "BAL-153-qarz-tolov", "Qarz toʻlovi", `
${navInline("Dilshod aka", { orqaga: "Orqaga" })}
${scroll("")}
${sheet("Toʻlov qabul qilish", `
  <div class="t-footnote c-2" style="text-align:center">Qolgan qarz: 2 100 000 soʻm</div>
  <div class="amount-input">
    <span class="amount-input__value amount-input__value--income">2 100 000</span><span class="amount-input__caret"></span>
    <span class="amount-input__unit">soʻm</span>
  </div>
  <div class="row gap-2" style="justify-content:center">
    ${chip("Toʻliq", "selected", { tap: true })}${chip("Yarim", "", { tap: true })}${chip("Boshqa", "", { tap: true })}
  </div>
  <div class="t-footnote c-2 mt-4" style="margin-bottom:var(--sp-2)">Qaysi kassaga</div>
  <div class="pay-grid">
    <div class="pay-opt pay-opt--selected">${ikona("cash", 22)}<span class="t-subheadline">Naqd</span></div>
    <div class="pay-opt">${ikona("card", 22)}<span class="t-subheadline">Click</span></div>
  </div>
`, { olcham: "large", foot: tugma("Qabul qilish", "primary") })}`);

// ══════════════ BAL-201 · Oylik hisobot ══════════════
qosh("BAL-201", "BAL-201-hisobot", "Oylik hisobot", `
${navInline("Avgust 2026", { orqaga: "Hisobot", ong: ikonBtn("share", { accent: true }) })}
${scroll(`
  <div class="card mt-2">
    <div class="t-footnote c-2">Sof foyda</div>
    <div class="amount amount--lg c-1 mt-1">${pul(12480000)}</div>
    <div class="row gap-1 mt-2">${chip("↑ 18,4%", "income")}<span class="t-caption-1 c-3">iyulga nisbatan</span></div>
  </div>

  <div class="row gap-2 mt-3">
    ${stat("Kirdi", pul(47250000), "income", "kirim")}
    ${stat("Chiqdi", pul(34770000), "expense", "chiqim")}
  </div>

  <div class="card mt-3">
    <div class="t-headline c-1">Chiqim taqsimoti</div>
    <div class="row gap-4 mt-3">
      ${donut([
        { ulush: 38, rang: "chart-1" },
        { ulush: 26, rang: "chart-2" },
        { ulush: 18, rang: "chart-3" },
        { ulush: 18, rang: "chart-4" },
      ], pul(34770000), "Jami")}
      <div class="grow col gap-2">
        <span class="t-footnote c-2">Tovar · 38%</span>
        <span class="t-footnote c-2">Ijara · 26%</span>
        <span class="t-footnote c-2">Maosh · 18%</span>
        <span class="t-footnote c-2">Boshqa · 18%</span>
      </div>
    </div>
  </div>

  <div class="card mt-3">
    <div class="t-headline c-1">Qarz harakati</div>
    <div class="row-between mt-3">
      <span class="t-footnote c-2">Qarzga berildi</span>
      <span class="t-callout c-debt">${pul(7400000)}</span>
    </div>
    <div class="row-between mt-2">
      <span class="t-footnote c-2">Qarzdan tushdi</span>
      <span class="t-callout c-income">${pul(9800000)}</span>
    </div>
    <div class="row-between mt-2" style="padding-top:var(--sp-2);border-top:1px solid var(--separator)">
      <span class="t-footnote c-2">Ochiq qoldiq</span>
      <span class="t-callout c-1" style="font-weight:620">${pul(18400000)}</span>
    </div>
    <div class="t-caption-1 c-3 mt-2">Qarz sof foydaga qoʻshilmaydi</div>
  </div>
`)}
${TAB_OWNER(3)}`);

// ══════════════ BAL-242 · Tasdiqlash ══════════════
qosh("BAL-242", "BAL-242-tasdiqlash", "Tasdiqlash", `
${navLarge("Tasdiqlash")}
${scroll(`
  ${segmented(["Kutilmoqda", "Tarix"], 0)}
  <div class="mt-3">
  ${royxat([
    qator({ avatar: "S", sarlavha: "Salima — chiqim", izoh: "Ijara · bugun 09:20", ong: pul(4500000), ongKlass: "c-expense", chevron: true }),
    qator({ avatar: "A", sarlavha: "Aziz — qarzga sotuv", izoh: "Limit oshdi · kecha", ong: pul(1200000), ongKlass: "c-debt", chevron: true }),
  ])}
  </div>
`)}
${TAB_OWNER(3)}`);

// ══════════════ BAL-260 · AI yordamchi ══════════════
qosh("BAL-260", "BAL-260-ai", "AI yordamchi", `
${navInline("AI yordamchi", { orqaga: "Yana" })}
${scroll(`
  <div style="text-align:center;padding:var(--sp-8) 0 var(--sp-4)">
    <div style="width:64px;height:64px;border-radius:20px;background:var(--accent-wash);color:var(--accent);
                display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-3)">
      ${ikona("ai", 30)}
    </div>
    <div class="t-title-3 c-1">Biznesingiz haqida soʻrang</div>
    <div class="t-subheadline c-2 mt-2">Raqamlarni oʻzim topib beraman</div>
  </div>

  <div class="col gap-2">
    ${royxat([
      qator({ ikona: "chart", tur: "accent", sarlavha: "Bugun qancha foyda?", chevron: true }),
      qator({ ikona: "qarz", tur: "accent", sarlavha: "Kim koʻp qarzdor?", chevron: true }),
      qator({ ikona: "report", tur: "accent", sarlavha: "Oʻtgan oyga nisbatan qanday?", chevron: true }),
      qator({ ikona: "box", tur: "accent", sarlavha: "Qaysi mahsulot koʻp sotildi?", chevron: true }),
    ])}
  </div>
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">
  <div class="input"><span class="input__placeholder">Savolingizni yozing…</span></div>
</div>`);

// ══════════════ BAL-280 · Profil (sotuvchi) ══════════════
qosh("BAL-280", "BAL-280-profil", "Profil — sotuvchi", `
${navLarge("Profil")}
${scroll(`
  <div class="card">
    <div class="row gap-3">
      <div class="avatar" style="width:52px;height:52px;font-size:20px">A</div>
      <div class="grow">
        <div class="t-title-3 c-1">Aziz</div>
        <div class="t-footnote c-2">Sotuvchi · Chorsu Savdo</div>
      </div>
    </div>
  </div>

  ${bolim("Xavfsizlik")}
  ${royxat([
    qator({ ikona: "faceid", tur: "accent", sarlavha: "Ilova qulfi", izoh: "Face ID bilan ochish", ong: "Yoqilgan", ongKlass: "c-accent" }),
    qator({ ikona: "lock", tur: "fill", sarlavha: "Parolni oʻzgartirish", chevron: true }),
  ])}

  ${bolim("Ilova")}
  ${royxat([
    qator({ ikona: "bell", tur: "fill", sarlavha: "Bildirishnomalar", chevron: true }),
    qator({ ikona: "info", tur: "fill", sarlavha: "Maxfiylik siyosati", chevron: true }),
    qator({ ikona: "doc", tur: "fill", sarlavha: "Versiya", ong: "2.0.0" }),
  ])}

  <div class="mt-4">${tugma("Hisobdan chiqish", "destructive-soft")}</div>
`)}
${TAB_SELLER(1)}`);

// ══════════════ BAL-283 · Face ID qulf ══════════════
qosh("BAL-283", "BAL-283-qulf", "Ilova qulflangan", `
<div class="screen" style="align-items:center;justify-content:center;text-align:center;padding:0 var(--sp-8)">
  <div style="width:76px;height:76px;border-radius:24px;background:var(--accent-wash);color:var(--accent);
              display:flex;align-items:center;justify-content:center;margin-bottom:var(--sp-5)">
    ${ikona("faceid", 38)}
  </div>
  <div class="t-title-3 c-1">Balansa qulflangan</div>
  <div class="t-subheadline c-2 mt-2" style="max-width:250px">Davom etish uchun Face ID yoki qurilma parolingiz bilan tasdiqlang.</div>
  <div style="margin-top:var(--sp-6);width:100%;max-width:240px">${tugma("Tasdiqlash", "primary")}</div>
  <div class="t-caption-1 c-3" style="margin-top:var(--sp-4)">Boshqa hisob bilan kirish</div>
</div>`);

// ══════════════ BAL-290 · Hisobni o'chirish ══════════════
qosh("BAL-290", "BAL-290-hisob-ochirish", "Hisobni oʻchirish", `
${navInline("Hisobni oʻchirish", { orqaga: "Sozlamalar" })}
${scroll(`
  <div class="card mt-2" style="border-color:var(--expense)">
    <div class="row gap-3">
      <div class="list-row__icon list-row__icon--expense">${ikona("warning", 18)}</div>
      <div class="grow">
        <div class="t-headline c-1">Chorsu Savdo</div>
        <div class="t-footnote c-2 mt-1">Kompaniya va unga tegishli barcha maʼlumot — yozuvlar, ombor, qarzlar, hisobotlar va xodimlar hisoblari — butunlay oʻchiriladi.</div>
      </div>
    </div>
  </div>

  <div class="card mt-3" style="background:var(--expense-soft);border-color:transparent;box-shadow:none">
    <div class="t-footnote" style="color:var(--expense-on)">
      Oʻchirish soʻralgandan keyin ilovaga kirish darhol yopiladi. Maʼlumotlar
      <b>30 kun</b> saqlanadi — shu muddat ichida bekor qilish mumkin.
      30 kundan keyin hamma narsa butunlay oʻchadi va tiklab boʻlmaydi.
    </div>
  </div>

  ${maydon("Tasdiqlash uchun kompaniya nomini yozing", "Chorsu Savdo", { placeholder: true })}
`)}
<div style="padding:var(--sp-3) var(--sp-4) var(--sp-4)">${tugma("Butunlay oʻchirish", "destructive", { disabled: true })}</div>`);

// ══════════════ BAL-302 · Offline ══════════════
qosh("BAL-302", "BAL-302-offline", "Offline rejim", `
${navLarge("Yozuvlar", ikonBtn("search") + ikonBtn("filter"))}
${banner("offline", "Internet yoʻq · 3 ta yozuv navbatda", `<span class="t-caption-1" style="font-weight:620">Koʻrish</span>`)}
${scroll(`
  ${guruhSarlavha("Bugun · 16-avgust")}
  ${royxat([
    qator({ ikona: "sync", tur: "debt", sarlavha: "Non (patir) × 4", izoh: "Navbatda · yuborilmadi", ong: "+20 000", ongKlass: "c-debt" }),
    qator({ ikona: "sync", tur: "debt", sarlavha: "Sut 1L × 2", izoh: "Navbatda · yuborilmadi", ong: "+25 000", ongKlass: "c-debt" }),
    qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "Naqd · 14:20", ong: "+2 400 000", ongKlass: "c-income" }),
  ])}
  <div class="card mt-4" style="background:var(--fill);border-color:transparent;box-shadow:none">
    <div class="t-footnote c-2"><b>Hozir ishlamaydi:</b> sotuv, smena yopish, kun tasdiqlash.
    Ular ombor qoldigʻi va kassa hisobini serverda tekshiradi.</div>
  </div>
`)}
${TAB_OWNER(1)}`);

// ══════════════ BAL-300 · Global qidiruv ══════════════
qosh("BAL-300", "BAL-300-qidiruv", "Global qidiruv", `
${navInline("Qidiruv", { orqaga: "Bekor" })}
<div style="padding:0 var(--sp-4) var(--sp-2)">${qidiruv("karim")}</div>
${scroll(`
  ${guruhSarlavha("Mijozlar")}
  ${royxat([
    qator({ avatar: "K", sarlavha: "Karim aka (Chorsu)", izoh: "+998 90 123 45 67", ong: pul(4200000), ongIzoh: "qarz", ongKlass: "c-debt", chevron: true }),
  ])}
  ${guruhSarlavha("Yozuvlar")}
  ${royxat([
    qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "Bugun 14:20", ong: "+2 400 000", ongKlass: "c-income" }),
    qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "28-iyul", ong: "+800 000", ongKlass: "c-income" }),
  ])}
`)}`);

export const EKRANLAR = E;
