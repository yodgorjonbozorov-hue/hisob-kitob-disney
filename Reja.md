# Reja — yaxshilashlar ro'yxati

Manba: `docs/AUDIT-2026-08.md` bandlari hozirgi kod bilan solishtirildi (2026-11-21).
Auditdagi bandlarning katta qismi allaqachon yopilgan; quyida faqat OCHIQ qolganlari.

## ✅ Allaqachon tuzatilgan (qayta ishlash shart emas)

- Dashboard `deletedAt` filtri, kompozit indekslar, `onDelete` (163 ta), `Payment.externalId @unique`
- `Sale.sana`, sotuvni bekor qilish (soft-delete), moliyaviy amallar `runBusinessTx` ichida
- `CRON_SECRET` / webhook sir fail-closed, rate limit bazada, timing-safe imzo, kriptografik bog'lash kodi
- Bot suhbat holati bazada, AI tarixi serverda
- 45 ta `loading.tsx`, 32 ta `error.tsx`, Modal focus trap, `Button` default `type="button"`
- Ta'minotchi/xarid, hisoblar, inventarizatsiya, shtrix-kod/SKU, HR/oylik, davomat, tasdiqlash oqimi, shartnoma/fayl ilova, KPI

## 🔴 Xavfsizlik va to'lov (birinchi navbat)

- [ ] **1. Payme 12 soatlik timeout (S-6).** `CreateTransaction`dan 12 soat o'tgan tranzaksiya
      `-31008` bilan bekor qilinishi kerak — kodda yo'q. Payme sandbox testidan o'tmaydi.
- [ ] **2. Payme `PerformTransaction` qayta so'rovda xato.** `src/lib/billing/payme.ts`:
      `confirmPayment()` dan keyin `providerState` alohida yoziladi. Ikkinchi qadam uzilsa,
      Payme qayta so'raganda `confirmPayment` "allaqachon tasdiqlangan" xatosini tashlaydi —
      to'lov hech qachon "bajarildi" holatiga o'tmaydi. Ikkalasini bitta atomik qadamga birlashtirish.
- [ ] **3. Zaxira shifrlanmagan (S-2).** `src/lib/backup/send.ts` va `scripts/deploy-zaxira.mjs`
      butun bazani (parol hash'lari, telefonlar, moliya) faqat gzip qilib Telegramga yuboradi.
      AES-256-GCM shifrlash + tiklash skriptini moslash.
- [ ] **4. Paket zaifliklari.** `npm audit`: 1 kritik (`next@14.2.35`), 5 yuqori, 3 o'rta.
      Xavfsiz qismi: `brace-expansion`, `nanoid`, `source-map-js`. `next` 16 / `zod` 4 — major,
      alohida va ehtiyotkorlik bilan.
- [ ] **5. CSRF — Origin tekshiruvi yo'q (S-4).** Faqat `sameSite: lax`. Middleware'da
      POST/PATCH/DELETE uchun `Origin` tekshiruvi.
- [ ] **6. CSP faqat `Report-Only`.** Bloklamaydi; brauzerda sinab, keyin majburiy qilish.

## 🟠 Ishonchlilik va kod sifati

- [ ] **7.** Test fayllarida 1000+ TypeScript xatosi (testlar o'tadi, lekin tip himoyasi yo'q).
- [ ] **8.** 15 ta komponent 250 satr qoidasidan oshgan; eng kattasi
      `src/app/app/ombor/avtopark/AvtoparkClient.tsx` (1110 satr).
- [ ] **9.** AI model nomi kodda qattiq yozilgan (`claude-sonnet-5` — `src/lib/ai/claude.ts`,
      `src/lib/ai/chekOcr.ts`). Env sozlamasiga chiqarish va yangi modelga (`claude-sonnet-5-5`) o'tish.
- [ ] **10.** `engines: node 22.x`, lokal muhitda Node 24 — `engines` ni kengaytirish.
- [ ] **10a.** `tests/dialect.test.ts` main'da QIZIL: Postgres boshlang'ich migratsiyasi
      eskirgan (sxemada 79 model, migratsiyada 78 jadval). `npm run pg:migratsiya` bilan
      yangilash kerak (2026-11-21 da aniqlandi).
- [ ] **10b.** Eski telefon-loginlar (`998...`, `9 raqam`) bazada E.164 ga ko'chirilmagan —
      kirish ularni topadi (`lib/auth/loginTop.ts`), lekin ixtiyoriy migratsiya skripti
      (dublikatlarni ko'rsatadigan DRY RUN bilan) bazani bir xil formatga keltiradi.

## 🟡 Unumdorlik

- [ ] **11.** 357 ta `findMany`, ko'pida `take` limiti yo'q — katta biznesda xotira xavfi.
- [ ] **12.** 139 ta `router.refresh()`, kesh deyarli yo'q (`revalidateTag` 5 joyda).

## 🔵 Yangi funksiya g'oyalari

- [ ] 2FA
- [ ] ADMIN va OWNER huquqlarini to'liqroq ajratish
- [ ] Ko'p valyuta (maydon bor, faqat UZS) va QQS hisobi

## Ish tartibi

Har band alohida branch'da; `npm run build` va tegishli testlar o'tgandan keyingina `main`ga.
