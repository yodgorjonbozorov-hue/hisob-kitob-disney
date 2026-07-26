# SUMMARY.md — "Kassa" redesign yakuni

`redesign/ui-v2` ishi `main`ga merge qilingan va **deploy qilingan** (egasi so'roviga
ko'ra — REDESIGN.md dastlab deploy qilmaslikni aytgan edi, lekin egasi keyin aniq
"deploy qil" dedi; redesign faqat UI, yangi schema yo'q, shu bois bazaga xavf yo'q).

## Nima qilindi (faza-faza)

| Faza | Ish | Holat |
|---|---|---|
| 0 | Setup: branch, dev.db backup, docs, Playwright + `scripts/shot.mjs` | ✅ |
| 1 | **Tokenlar**: teal "Kassa" palitrasi (canvas/ink/brand/income/expense/debt), Manrope+Inter, `soʻm` (U+02BB), type scale 12-60, radius, `lib/copy.ts` lug'at | ✅ |
| 2 | **Primitivlar**: Money, NumberPad (kassir keypad), CategoryPicker (ikonkali), **ReceiptList** (signature kassa lentasi — perforatsiya + zigzag), cn, categoryVisual | ✅ |
| 3 | **App shell**: dark sidebar → sokin light panel + lucide ikonka + teal aktiv; "Yozuvlar" lug'ati | ✅ |
| 4 | **Kassir bosh ekrani** (KassaHome): BUGUN kirdi/chiqdi + ikkita ≥88px tugma → keypad; ostida kassa lentasi. Kassir dashboard ko'rmaydi | ✅ |
| 5 | **Dashboard grafiklari**: pie → gorizontal bar; grid/legend qutisi/o'q chiziqlari olib tashlandi; custom tooltip; o'zbekcha oy; ixcham summalar | ✅ |
| 10 | **Rang auditi**: UI'da Tailwind default rang (slate/emerald/rose/sky/amber) qolmadi — hammasi semantik token | ✅ (qisman) |

## Signature element
**Kassa lentasi** (`ReceiptList`): yozuvlar kun bo'yicha guruhlangan, sticky kun
sarlavhasi + kun sof natijasi, rangli kategoriya ikonkasi, katta tabular ± summa,
kun ostida perforatsiya (yon yarim-doira kesik), lenta oxirida zigzag. Boldlik faqat
shu yerda — qolgan hamma joy sokin.

## Kassir oqimi (3 bosish)
Kassa ekrani → "Pul kirdi"/"Pul chiqdi" tugmasi → katta keypad (0-9, 000, ⌫, tez chiplar)
+ ikonkali kategoriya to'ri → Saqlash → undo toast (5s).

## Screenshotlar
`.screenshots/phase1…5, phase4-kassir/` (390px + 1440px). Faza-faza taqqoslash.

## Qolgan ishlar (kelajakda)
- **Faza 6-9 to'liq sayqal**: Ombor/Sotuv/Qarzdorlik/Hisobot/Admin sahifalari
  tokenlar tufayli teal bo'ldi, lekin maxsus redizayn (kartochka grid, aging bar,
  print CSS) qilinmadi.
- **PDF/Excel** shabloni yangi brendga to'liq moslanmadi (tokenlar qo'llanmaydi — PDF alohida).
- **Telegram bot** matnlari lug'atga to'liq o'tkazilmadi.
- **PWA offline** (Faza 11), a11y to'liq tekshiruv, KPI sparkline.
- **DB izohi**: batch1/batch2 (AuditLog/Budget/ShiftClose/RecurringTransaction/deletedAt)
  jadvallari production Turso'da bor deб taxmin qilinadi (joriy `main` allaqachon
  deploy qilingan). Agar smena/takroriy/audit sahifalari 500 bersa — o'sha jadvallarni
  Turso'ga qo'llash kerak (ASSUMPTIONS.md).

## Buzilmagan
`businessId` izolyatsiyasi, auth/sessiya/parol mantiqi, kassir huquqlari, sotuv atomik
himoyasi — hech biriga tegilmadi. Redesign faqat UI qatlamida.
