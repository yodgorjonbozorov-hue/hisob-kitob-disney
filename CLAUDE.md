# Balansa loyiha qoidalari

Bu fayl har sessiya boshida o'qiladi. Quyidagi qoidalar loyihaning
invariantlari — ular buzilsa mahsulot ishonchliligi yo'qoladi.

## Arxitektura invariantlari (BUZILMAYDI)

- Tenant izolyatsiyasi: oddiy route/sahifa kodida FAQAT `@/lib/prisma` (tenant-scoped).
  `rawPrisma` faqat quyidagi joylarda ruxsat etiladi:
  - `src/lib/auth/` — login, sessiya, superadmin tekshiruvi
  - `src/bot/` — bot foydalanuvchini aniqlash va suhbat holati (tizim darajasi)
  - `src/app/api/cron/` — barcha tenantlar bo'ylab aylanish
  - `src/app/api/superadmin/` va `src/lib/db/` — tizim amallari
  - `src/lib/billing/` — Payme/Click webhook (tenant konteksti yo'q)
  - `src/lib/backup/` — barcha tenantlar zaxirasi
  Boshqa har qanday joyda `rawPrisma` ishlatish — xato.
- Har API route `withTenant()` yoki `withSuperadmin()` bilan o'raladi.
- Yozish amallari zod bilan validatsiya qilinadi (`lib/validation/`).
- Pul har doim `Int` (so'm), hech qachon float.
- Sana: `"YYYY-MM-DD"` string ↔ UTC-midnight `Date` (`lib/date.ts` funksiyalari).

## Kod qoidalari

- Komponent maksimal 250 satr; oshsa fayllarga bo'linadi.
- `any` taqiqlangan (faqat `lib/db/` dagi mavjud 7 joydan tashqari).
- Barcha izohlar va UI matnlari o'zbek tilida (lotin). Kirill harflari kodda taqiqlangan.
- Har moliyaviy ko'p qadamli amal atomik bo'lishi shart. Buning yagona yo'li —
  `runBusinessTx(businessId, (tx) => ...)` (`src/lib/db/businessTx.ts`).
  Tranzaksiya ichida xom `tx` delegatlari ishlatiladi, shuning uchun HAR so'rovga
  `businessId` sharti QO'LDA yoziladi. Biznes egaligi tranzaksiyadan oldin bir
  marta tekshiriladi — bu tenant izolyatsiyasiga qo'yilgan yagona istisno.
- Har tranzaksiya so'rovida `deletedAt: null` (soft-delete filtri) — ataylab
  o'chirilganlarni ko'rsatadigan joylardan tashqari (`listDeletedTransactions`).
- Yangi model qo'shilsa:
  1. `src/lib/db/tenantDb.ts` dagi `BUSINESS_SCOPED` yoki `TENANT_DIRECT` to'plamiga
     qo'shiladi. **Bu FAIL-OPEN nuqta:** ro'yxatga tushmagan model so'rovi
     filtrsiz o'tadi va barcha tenantlarga ko'rinadi. Model ataylab
     tenantsiz bo'lsa — `TIZIM_MODELLAR` ga SABABI bilan yoziladi.
     (`tests/izolyatsiya-royxati.test.ts` buni majburlaydi.)
  2. `src/lib/backup/dump.ts` dagi `ZAXIRA_JADVALLARI` ro'yxatiga qo'shiladi —
     **bog'liqlik tartibida**: model o'zi FK bilan murojaat qiladigan barcha
     jadvallardan KEYIN turishi shart, aks holda zaxira tiklanmaydi.
  (Istisno: vaqtinchalik holat jadvallari — masalan `BotConversation` — zaxiraga kirmaydi.)

## Tekshirish

- Har o'zgarishdan keyin: `npm run build` o'tishi shart.
- Migratsiya: `prisma migrate dev --create-only` bilan yoziladi va qo'lda
  ko'rib chiqiladi. Qo'llash esa deploy paytida avtomatik bo'ladi
  (`scripts/db-migrate.mjs`).
- Zaxirasiz migratsiya bo'lmaydi. Build zanjirining birinchi halqasi —
  `scripts/deploy-zaxira.mjs`: kutayotgan migratsiya bo'lsa xom surat olib
  Telegram zaxira kanaliga yuboradi, yuborilmasa build TO'XTAYDI.
  Bu himoyani o'chirish faqat `ZAXIRASIZ_DAVOM=ha` bilan, bilib turib.
- Test: `npm run test:isolation` va tegishli test fayli ishga tushiriladi.

## Tegilmaydigan fayllar

- `prisma/dev.db` — lokal baza, tegilmaydi.
- `.env`, `.env.*` — o'qilmaydi va tahrir qilinmaydi.

## Merge huquqi

`main` ga merge oldin faqat loyiha egasiga ruxsat etilgan edi. Loyiha egasi
2026-08-06 da bu cheklovni BEKOR QILDI: agent tayyor ishni o'zi `main` ga
qo'sha oladi.

O'rniga qoladigan shart — merge qilishdan oldin `npm run build` va tegishli
testlar o'tgan bo'lishi. Cheklov olib tashlangani ishni tekshirmasdan
qo'shishga ruxsat bermaydi; u faqat kutish navbatini olib tashlaydi.

## Fazalar bo'yicha ish

Yo'l xaritasi va faza promptlari: `docs/CLAUDE-CODE-PROMPTLAR.md`.
Audit hisoboti (backlog manbai): `docs/AUDIT-2026-08.md`.
Agent progress jurnali: `PROGRESS-AGENT.md`.
