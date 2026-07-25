# DESIGN.md — Dizayn tizimi

Disney Navoiy Hisob-Kitob ilovasining dizayn tili, tokenlari va komponent
inventari. Maqsad: bitta izchil, mobil-birinchi, dark-mode-first tizim.

> Bu hujjat **1-bosqich (poydevor)** natijasini hujjatlashtiradi. Keyingi
> bosqichlar (mobil qobiq, dashboard, tranzaksiya redizayni, hisobot, audit,
> P0 funksiyalar) shu tokenlar ustiga quriladi — `ROADMAP` bo'limiga qarang.

---

## 1. Ranglar — semantik tokenlar

Barcha ranglar CSS o'zgaruvchilari orqali (`globals.css` → `:root` va `.dark`),
Tailwind'da semantik nom bilan ochiladi. **Qattiq kodlangan `slate/emerald/rose`
klasslari ishlatilmaydi** — faqat semantik tokenlar.

### Asosiy qoida (o'zgarmas)
- **Kirim (income) = muvaffaqiyat rangi (yashil)**
- **Chiqim (expense) = xavf rangi (qizil)**
- Bu juftlik **hech qachon almashtirilmaydi** — raqamlar, grafik seriyalari,
  badge'lar, ikonkalar — hamma joyda bir xil.

### Token jadvali

| Token | Tailwind | Light | Dark | Ishlatilishi |
|---|---|---|---|---|
| `--bg-app` | `bg-app` | slate-50 | slate-950 | Sahifa foni |
| `--bg-surface` | `bg-surface` | white | slate-900 | Kartalar, formalar, jadval |
| `--bg-surface-2` | `bg-surface-2` | slate-100 | slate-800 | Jadval sarlavhasi, ikkilamchi sirt |
| `--border` | `border-line` | slate-200 | slate-700 | Chegaralar, ajratgichlar |
| `--fg` | `text-fg` | slate-900 | slate-100 | Asosiy matn |
| `--fg-muted` | `text-muted` | slate-500 | slate-400 | Ikkilamchi matn |
| `--fg-faint` | `text-faint` | slate-400 | slate-500 | Uchlamchi/placeholder |
| `--income` | `text-income` `bg-income` | emerald-600 | emerald-400 | Kirim summasi/seriyasi |
| `--income-soft` | `bg-income-soft` | emerald-100 | emerald-950 | Kirim badge foni |
| `--expense` | `text-expense` `bg-expense` | rose-600 | rose-400 | Chiqim summasi/seriyasi |
| `--expense-soft` | `bg-expense-soft` | rose-100 | rose-950 | Chiqim badge foni |
| `--brand` | `bg-brand` | emerald-600 | emerald-500 | Asosiy tugma, aksent |

### Dark mode
- `next-themes` o'rniga yengil, bog'liqliksiz yechim: `layout.tsx` ichidagi
  **inline skript** bo'yashdan oldin `dark` klassni qo'yadi → **FOUC yo'q**.
- `localStorage.theme` da saqlanadi; birinchi tashrifda `prefers-color-scheme`
  hurmat qilinadi. Almashtirish — `ThemeToggle` komponenti.

---

## 2. Tipografiya

- **Shrift:** Inter (`next/font/google`), `latin` + `latin-ext` + `cyrillic`
  subsetlari (o'zbek lotin: `oʻ`, `gʻ`, `'`).
- **Tabular raqamlar:** `.tnum` yordamchisi va `table`/`.kpi` avtomatik
  `font-variant-numeric: tabular-nums` — ustunlar sakramaydi.
- **Shkala:** 12 / 13 / 14 / 16 / 20 / 24 / 32 (`text-2xs … text-2xl`).
  Body: desktop 14px, mobil 15px.
- **Og'irliklar:** 400 / 500 / 600 (display raqamlardan tashqari 700+ yo'q).

---

## 3. Pul va sana formatlash — yagona manba (`lib/format.ts`)

Kod bazasida `.toLocaleString()` ishlatilmaydi. Pul **butun son (so'm)** sifatida
saqlanadi (schema'da `Int` — float emas, yaxlitlash xatosi yo'q).

| Funksiya | Natija |
|---|---|
| `formatMoney(12450000)` | `12 450 000 so'm` |
| `formatMoneyCompact(12450000)` | `12,4 mln` |
| `formatSom(1250000)` | `1 250 000` |
| `formatDate(d)` | `24 Iyul 2026` |
| `formatDateUZ(d)` | `24.07.2026` |
| `formatRelative(d)` | `bugun` / `kecha` / `3 kun oldin` |
| `formatPercent(12.5)` | `+12.5%` |

---

## 4. Komponent inventari (`components/ui`)

| Komponent | Holati | Izoh |
|---|---|---|
| `Button` | ✅ | primary/secondary/danger/ghost · sm/md/lg · loading · ≥44px |
| `Card` | ✅ | surface + shadow-card + border-line |
| `Badge` | ✅ | kirim/chiqim/neutral/warning/info (dark-aware) |
| `Modal` | ✅ | desktop dialog / mobil bottom-sheet · ESC · scroll-lock |
| `StatCard` | ✅ | KPI: qiymat + Δ (yaxshi/yomon rangli) |
| `EmptyState` | ✅ | ikonka + izoh + CTA |
| `Skeleton` / `SkeletonRows` | ✅ | yuklanish holati (spinner emas) |
| `Segmented` | ✅ | segmentli tanlov |
| `ThemeToggle` | ✅ | yorug'/qorong'i almashtirish |
| `Input`/`Select`/`MoneyInput`/`Sheet`/`Tabs`/`Toast`/`Tooltip` | ⏳ | ROADMAP |

Holat qoidasi: har bir ma'lumot sirti `loading` (skelet) · `empty` · `error`
(qayta urinish) · `success` holatlarini ko'rsatishi kerak.

---

## 5. Before / After — asosli o'zgarishlar

| Oldin | Keyin | Sabab |
|---|---|---|
| Faqat light, qattiq `slate/emerald/rose` | Semantik CSS-var tokenlar + dark mode | Kassirlar telefonda, dark mode kutiladi |
| `Segoe UI` tizim shrifti | Inter (`next/font`, cyrillic subset) | O'zbek lotin glyphlari, izchil tipografiya |
| Har joyda `formatSom` + `so'm` | `formatMoney`/`Compact` yagona manba | Bir xil formatlash, KPI uchun ixcham |
| Oddiy raqamlar (sakraydi) | `tabular-nums` hamma joyda | Ustunlar tekis turadi |
| Modal faqat desktop markazda | Mobil bottom-sheet + ESC + scroll-lock | Mobil-birinchi |

---

## 6. Bajarilgan (barchasi jonli — hisob-kitob-disneyn1.vercel.app)

- ✅ Dizayn tokenlari, dark mode, Inter, tabular-nums, `lib/format.ts`
- ✅ Mobil qobiq: pastki tab-bar + FAB + quick-add sheet
- ✅ Dashboard: 4 StatCard (+ Qarzdorlik), Δ taqqoslash, onboarding
- ✅ Tranzaksiyalar: sticky jami footer, mobil kartochka, sana presetlari +
  summa oralig'i + URL filtrlar, ommaviy tanlash/o'chirish, Excel eksport
- ✅ Qarzlar: aging (0-30/31-60/61-90/90+), eslatma; Ombor: foydalilik
- ✅ Soft-delete + 5s undo + admin savati; AuditLog + admin ko'ruvchi
- ✅ Sotuvchi roli (Doston); admin rol o'zgartirish
- ✅ Xavfsizlik: login rate-limit, lastLogin, majburiy parol almashtirish
- ✅ Budjetlar (kategoriya oylik limit, progress)
- ✅ Command palette (⌘K) + global qidiruv
- ✅ Bildirishnomalar markazi (budjet/ombor/qarz)
- ✅ Kun yakuni (smena) + takroriy tranzaksiyalar (cron)
- ✅ PDF cyrillic-safe apostrof

### Migratsiya strategiyasi
Schema o'zgarishlari `prisma/migrations/*` da; Turso'ga xom-libsql migratsiya
endpoint orqali (bir martalik, keyin olib tashlanadi) yoki
`DATABASE_URL=... npm run db:apply` bilan qo'llanadi. Faqat additive (backward-
compatible) o'zgarishlar.

### Kelajakda (hali qilinmagan)
CSV import, kvitansiya biriktirish (R2/S3), ko'p-valyuta, naqd oqim prognozi,
maxsus hisobot konstruktori, rejalashtirilgan hisobotlar, URL-asosidagi biznes
yo'nalishi (`/b/[biznes]`), PWA offline sync, Vitest/Playwright testlar.
