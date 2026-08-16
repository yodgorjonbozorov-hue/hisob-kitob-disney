/**
 * GURUH 1 — Auth, Onboarding, Home (BAL-000–039).
 *
 * Ma'lumot o'ylab topilgan, lekin realistik: "Chorsu Savdo" — Toshkentdagi
 * oziq-ovqat do'koni. Raqamlar o'zaro mos:
 *   47 250 000 − 34 770 000 = 12 480 000 ✓
 */

import {
  ekran, ikona, pul, navBiznes, navLarge, navInline, ikonBtn, tabbar, scroll,
  bolim, karta, stat, qator, royxat, chip, tugma, segmented, holat, sheet,
  grafik, donut, guruhSarlavha, maydon,
} from "../lib.mjs";

const E = [];
const qosh = (id, fayl, nom, body, opt = {}) => E.push({ id, fayl, html: ekran({ id, nom, body, ...opt }) });

/** Direktor tab bari — SCREEN-MAP A.1 */
const TAB_OWNER = (aktiv) => tabbar([
  { ikona: "home", yorliq: "Asosiy", aktiv: aktiv === 0 },
  { ikona: "list", yorliq: "Yozuvlar", aktiv: aktiv === 1 },
  { ikona: "qarz", yorliq: "Qarzlar", aktiv: aktiv === 2, badge: "3" },
  { ikona: "dots", yorliq: "Yana", aktiv: aktiv === 3 },
]);

// ══════════════════ BAL-001 · Kirish ══════════════════
qosh("BAL-001", "BAL-001-kirish", "Kirish", `
<div class="scroll" style="display:flex;flex-direction:column;justify-content:center">
  <div style="text-align:center;margin-bottom:var(--sp-8)">
    <div style="width:72px;height:72px;border-radius:20px;background:var(--accent);color:var(--accent-on);
                display:flex;align-items:center;justify-content:center;margin:0 auto var(--sp-4);
                font-family:var(--font-display);font-size:34px;font-weight:700">B</div>
    <div class="t-title-2 c-1">Balansa</div>
    <div class="t-subheadline c-2 mt-2">Biznesingiz balansda</div>
  </div>

  ${maydon("Telefon raqami", "+998 90 123 45 67", { placeholder: true })}
  ${maydon("Parol", "••••••••")}

  <div class="mt-4">${tugma("Kirish", "primary")}</div>
  <div class="mt-3" style="text-align:center">
    <span class="t-subheadline c-accent">Hisob yoʻqmi? Roʻyxatdan oʻting</span>
  </div>
</div>`);

// ══════════════════ BAL-004 · Onboarding: biznes turi ══════════════════
qosh("BAL-004", "BAL-004-onboarding-turi", "Biznes turi", `
${navInline("2 / 3", { orqaga: "Orqaga" })}
<div class="scroll">
  <div class="t-title-1 c-1 mt-2">Biznesingiz nima bilan shugʻullanadi?</div>
  <div class="t-subheadline c-2 mt-2">Buni keyin ham oʻzgartirasiz.</div>

  <div class="mt-5">
    ${royxat([
      qator({ ikona: "cart", tur: "accent", sarlavha: "Tovar sotaman", izoh: "Doʻkon, ulgurji, aptek — ombor yuritiladi", chevron: true }),
      qator({ ikona: "wallet", tur: "fill", sarlavha: "Xizmat koʻrsataman", izoh: "Salon, ustaxona, kafe — ombor kerak emas", chevron: true }),
      qator({ ikona: "truck", tur: "fill", sarlavha: "Avtomobil olib-sotaman", izoh: "Har mashina alohida hisoblanadi", chevron: true }),
    ])}
  </div>
</div>
<div style="padding:var(--sp-4)">${tugma("Davom etish", "primary", { disabled: true })}</div>`);

// ══════════════════ BAL-020 · Asosiy (direktor) ══════════════════
qosh("BAL-020", "BAL-020-asosiy", "Asosiy — direktor", `
${navBiznes("Chorsu Savdo", "Direktor")}
${scroll(`
  <div class="row-between" style="padding:var(--sp-1) var(--sp-1) 0">
    <span class="t-footnote c-2">Avgust 2026</span>
    ${chip("Bu oy", "accent")}
  </div>

  <div style="padding:var(--sp-1) var(--sp-1) 0">
    <div class="t-footnote c-2">Sof foyda</div>
    <div class="row gap-2" style="align-items:baseline;margin-top:2px">
      <span class="amount amount--xl c-1">${pul(12480000)}</span>
      <span class="t-callout c-3">soʻm</span>
    </div>
    <div class="row gap-1 mt-2">
      ${chip("↑ 18,4%", "income")}
      <span class="t-caption-1 c-3">oʻtgan oyga nisbatan</span>
    </div>
  </div>

  <div class="row gap-2 mt-4">
    ${stat("Kirdi", pul(47250000), "income", "kirim")}
    ${stat("Chiqdi", pul(34770000), "expense", "chiqim")}
  </div>

  <div class="card mt-3">
    <div class="row-between">
      <span class="t-headline c-1">Soʻnggi 6 oy</span>
      <span class="t-caption-1 c-3">sof foyda</span>
    </div>
    <div class="mt-2">${grafik([0.42, 0.55, 0.38, 0.71, 0.62, 0.88], ["Mar", "Apr", "May", "Iyn", "Iyl", "Avg"], 5)}</div>
  </div>

  ${bolim("Soʻnggi yozuvlar", "Barchasi")}
  ${royxat([
    qator({ ikona: "kirim", tur: "income", sarlavha: "Karim aka — qarz toʻlovi", izoh: "Naqd · 14:20", ong: "+2 400 000", ongKlass: "c-income" }),
    qator({ ikona: "cart", tur: "income", sarlavha: "Coca-Cola 1L × 24", izoh: "Click · 13:05", ong: "+336 000", ongKlass: "c-income" }),
    qator({ ikona: "chiqim", tur: "expense", sarlavha: "Doʻkon ijarasi — avgust", izoh: "Naqd · 11:40", ong: "−4 500 000", ongKlass: "c-expense" }),
    qator({ ikona: "qarz", tur: "debt", sarlavha: "Dilshod aka — nasiya", izoh: "Muddat: 25-avgust", ong: "1 850 000", ongKlass: "c-debt" }),
  ])}
`)}
${TAB_OWNER(0)}`);

// ══════════════════ BAL-024 · Asosiy — bo'sh holat ══════════════════
qosh("BAL-024", "BAL-024-asosiy-empty", "Asosiy — boʻsh", `
${navBiznes("Yangi Biznes", "Direktor", { nuqta: false })}
<div class="screen" style="flex:1;display:flex;flex-direction:column">
  ${holat("chart", "Bu oyda hali yozuv yoʻq", "Birinchi kirim yoki chiqimni qoʻshing — hisobot va grafiklar oʻzi shakllanadi.", { tur: "accent", cta: tugma("Birinchi yozuvni qoʻshish", "primary") })}
</div>
${TAB_OWNER(0)}`);

// ══════════════════ BAL-025 · Biznes almashtirgich (sheet) ══════════════════
qosh("BAL-025", "BAL-025-biznes-tanlash", "Biznes tanlash", `
${navBiznes("Chorsu Savdo", "Direktor")}
${scroll(`
  <div class="row gap-2 mt-4">
    ${stat("Kirdi", pul(47250000), "income", "kirim")}
    ${stat("Chiqdi", pul(34770000), "expense", "chiqim")}
  </div>
`)}
${TAB_OWNER(0)}
${sheet("Biznes tanlash", royxat([
  qator({ avatar: "C", sarlavha: "Chorsu Savdo", izoh: "Oziq-ovqat · omborli", ong: "", chevron: false, tur: "accent" }),
  qator({ avatar: "Y", sarlavha: "Yunusobod filiali", izoh: "Oziq-ovqat · omborli", chevron: false }),
  qator({ avatar: "A", sarlavha: "Avto savdo", izoh: "Avtomobil · avtopark", chevron: false }),
]), { olcham: "medium" })}`);

export const EKRANLAR = E;
