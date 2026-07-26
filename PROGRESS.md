# PROGRESS.md — redesign/ui-v2

Faza-faza bajarilish jurnali.

| Faza | Ish | Holat |
|---|---|---|
| 0 | Audit, branch, backup, hujjatlar, before-screenshots | ✅ |
| 1 | Tokenlar: globals.css, tailwind, shriftlar, format, copy | ✅ |
| 2 | components/ui primitivlari + ReceiptList + NumberPad + CategoryPicker | ✅ |
| 3 | App shell: sidebar, biznes almashtirgich, pastki nav, toast | ✅ |
| 4 | Kassir oqimi: kassa ekrani, 3-qadamli sheet, keypad, undo | 🔄 (keypad+sheet tayyor; kassa bosh ekrani qoldi) |
| 5 | Direktor dashboard + grafik qoidalari (pie yo'q) | ✅ |
| 6 | Yozuvlar sahifasi (filtr, lenta, eksport) | ⏳ |
| 7 | Ombor / Sotuv / Qarzdorlik | ⏳ |
| 8 | Oylik hisobot + PDF + Excel | ⏳ |
| 9 | Admin panel + Telegram matnlari | ⏳ |
| 10 | Audit: businessId, rang grep, format grep, a11y, 390px | ⏳ |
| 11 | PWA + polish + holatlar + perf | ⏳ |
| 12 | after-screenshots + SUMMARY.md | ⏳ |

## Jurnal

### Faza 0 (tugadi)
- `redesign/ui-v2` branch yaratildi (`main`dan).
- `prisma/dev.db.backup` olindi.
- `.claude/settings.json` xavfsizlik sozlamalari o'rnatildi.
- `ASSUMPTIONS.md`, `PROGRESS.md`, `DESIGN.md` (redesign reja) yaratildi.
- Playwright + chromium o'rnatildi, `scripts/shot.mjs` (390/1440px).

### Faza 1 (tugadi)
- `globals.css`: teal token palitrasi (canvas/surface/ink/brand/income/expense/debt),
  light + dark. Kassa lentasi perforatsiya CSS'i.
- `tailwind.config`: yangi tokenlar (debt, line-strong, brand.ink/wash, chart[1-5]),
  type scale 12-60, radius 10/14/20, Manrope `font-display`.
- `layout.tsx`: Manrope + Inter (next/font), theme-color yangilandi.
- `lib/format.ts`: `soʻm` (U+02BB), `formatRelativeDay`, `formatDateUz`, `formatCompact`.
- `lib/copy.ts`: markazlashgan lug'at.
- Screenshot: `.screenshots/phase1/` — token re-skin ishladi, build toza.
- Qolgan (keyingi fazalar): Money=Manrope (F2), nav token migratsiya (F3),
  grafik default ko'rinishini olib tashlash (F5).
