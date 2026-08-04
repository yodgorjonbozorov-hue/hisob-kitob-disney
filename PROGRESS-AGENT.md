# PROGRESS-AGENT.md — avtonom tuzatish agenti jurnali

Bu fayl agent sessiyalari o'rtasidagi yagona xotira. Sessiya uzilsa —
agent shu fayldan qayerda qolganini o'qib davom etadi.

**Manbalar:** `CLAUDE.md`, `docs/AUDIT-2026-08.md`, `docs/CLAUDE-CODE-PROMPTLAR.md`

## Fazalar holati

| Faza | Nomi | Branch | Holat |
|---|---|---|---|
| 0 | CLAUDE.md yaratish | `faza-0-claude-md` | ✅ tugadi |
| 1 | Kritik tuzatishlar | `faza-1-kritik` | ✅ tugadi |
| 2 | Unumdorlik + UX | `faza-2-perf` | ✅ tugadi |
| 3 | Xavfsizlik + audit | `faza-3-xavfsizlik` | ⏳ boshlanmagan |
| 4 | Kassa to'liqligi | `faza-4-kassa` | ⏳ boshlanmagan |
| 5 | PostgreSQL + masshtab | `faza-5-postgres` | 🔓 ruxsat berildi (2026-08-04) |
| 6 | ERP modullari | `faza-6-*` | ⏳ boshlanmagan |

## ⚠️ MIGRATSIYA KUTILMOQDA (qo'lda apply qilinadi)

Uchala migratsiya `--create-only` uslubida yozildi, **apply QILINMADI**.
Bu muhitda baza ulanmagan (`DATABASE_URL` yo'q), shuning uchun qo'llash
production/staging'da qo'lda bajariladi. **Avval zaxira oling.**

| # | Papka | Nima qiladi | Xavf |
|---|---|---|---|
| 1 | `20260804090000_bot_suhbat_holati` | `BotConversation` jadvalini yaratadi | Past — faqat CREATE TABLE |
| 2 | `20260804091000_ondelete_siyosati` | 23 ta jadvalni FK siyosati bilan qayta quradi | **O'rta** — jadval qayta qurish |
| 3 | `20260804100000_kompozit_indekslar` | Indekslarni almashtiradi, `Payment.externalId` ni UNIQUE qiladi | **O'rta** — dublikat bo'lsa to'xtaydi |

Qo'llash: `npm run db:apply` (yoki `node scripts/db-migrate.mjs`).

**2-migratsiya:** SQLite'da FK o'zgartirish jadvalni qayta qurishni talab
qiladi. SQL har jadvalni `INSERT ... SELECT` bilan to'liq ko'chiradi.
Scratch bazada ma'lumot bilan sinaldi: barcha yozuvlar saqlandi,
`PRAGMA foreign_key_check` toza, `ON DELETE RESTRICT` o'rnida.
Keyin diqqat: endi moliyaviy yozuvi bor biznesni o'chirish FK bilan **rad
etiladi** (ataylab; ilova darajasidagi tekshiruv allaqachon bor, FK — ikkinchi qatlam).

**3-migratsiya:** `Payment.externalId` UNIQUE bo'ladi. Bazada takroriy
qiymat bo'lsa migratsiya "UNIQUE constraint failed" bilan **to'xtaydi**
(ma'lumot buzilmaydi). Avval tekshiring:

```sql
SELECT externalId, COUNT(*) c FROM "Payment"
WHERE externalId IS NOT NULL GROUP BY externalId HAVING c > 1;
```

---

## Jurnal

### 2026-08-04 — Faza 0 (tugadi)

**Nima qilindi**
- `CLAUDE.md`: arxitektura invariantlari (tenant izolyatsiyasi, `rawPrisma`
  ruxsat etilgan joylar ro'yxati, zod, pul = Int, sana konvensiyasi), kod
  qoidalari (250 satr, `any` taqiqi, o'zbek lotin, atomik amallar,
  `deletedAt: null`, yangi model → BUSINESS_SCOPED + ZAXIRA_JADVALLARI),
  tekshirish qoidalari, tegilmaydigan fayllar.
- `docs/AUDIT-2026-08.md`, `docs/CLAUDE-CODE-PROMPTLAR.md` — manba hujjatlar repoga.

**Fayllar:** `CLAUDE.md`, `docs/AUDIT-2026-08.md`, `docs/CLAUDE-CODE-PROMPTLAR.md`, `PROGRESS-AGENT.md`

### 2026-08-04 — Faza 1, Prompt 1.1 (tugadi)

**VAZIFA 1 — soft-delete filtri (C-1)**
- `src/lib/queries/dashboard.ts`: `sumByType`, `getCategoryBreakdown`,
  `getDailyDynamics` — uchalasiga `deletedAt: null` qo'shildi.
  Shu bilan `getMonthSummary`, `getTrend`, oylik hisobot, PDF, Excel va AI
  xulosalari ham to'g'rilandi (hammasi shu uch funksiyadan oziqlanadi).
- Butun `src/` grep qilindi. Qolgan joylarda filtr allaqachon bor edi
  (`queries/transactions.ts`, `queries/shift.ts`, `queries/budget.ts`,
  `reports/dailyDigest.ts`, `api/search`, `api/transactions/bulk*`).
- ATAYLAB tegilmagan: `listDeletedTransactions` (savat — o'chirilganlarni
  ko'rsatishi kerak) va `/api/businesses/[id]`, `/api/users/[id]` dagi
  `count` tekshiruvlari (u yerda soft-delete qilingan yozuv ham FK'ni
  to'sadi, shuning uchun hisoblanishi to'g'ri).

**VAZIFA 2 — atomik moliyaviy amallar (C-2)**
- Yangi: `src/lib/db/businessTx.ts` — `runBusinessTx(businessId, fn)`.
  Tenant extension interaktiv tranzaksiya bilan mos kelmaydi (`rawPrisma`
  bilan qo'shimcha `findFirst` qiladi → SQLite yozuv qulfi bilan deadlock
  xavfi). Shuning uchun: egalik tranzaksiyadan OLDIN bir marta tekshiriladi,
  ichkarida xom `tx` delegatlari ishlatiladi va har so'rovda `businessId`
  sharti qo'lda yoziladi. Bu istisno `CLAUDE.md` da qayd etilgan.
- `src/lib/services/transactionService.ts`: `createTransactionTx` qo'shildi.
- `src/lib/services/inventory.ts` — `runBusinessTx` ichiga olindi:
  `createSale`, `recordDebtPayment`, `createAvtoMashina`, `addProductExpense`,
  `deleteProductExpense`, `createDebt`, `createStockEntry`.
- `ensureCategoryTx`: `findFirst → create` race'i `upsert` bilan almashtirildi
  (`@@unique([nomi, turi, businessId])` — ilgari parallel sotuvda 500 xato).
- `recordDebtPayment`da optimistik qulf: `tolangan` biz o'qigan qiymatda
  qolgan bo'lsagina yoziladi — parallel to'lov jimgina yo'qolmaydi.

**Testlar (yangi)**
- `tests/soft-delete.test.ts` (8) — `npm run test:soft-delete`
- `tests/atomik.test.ts` (6) — `npm run test:atomik`.
  Rollback FK xatosi orqali haqiqatan tekshiriladi (mavjud bo'lmagan userId).

**Fayllar:** `src/lib/queries/dashboard.ts`, `src/lib/db/businessTx.ts`,
`src/lib/services/transactionService.ts`, `src/lib/services/inventory.ts`,
`tests/soft-delete.test.ts`, `tests/atomik.test.ts`, `package.json`, `CLAUDE.md`

### 2026-08-04 — Faza 1, Prompt 1.2 (tugadi)

**VAZIFA 1 — bot holati bazaga (C-3)**
- Yangi model `BotConversation { chatId @id, flow, state (JSON), updatedAt }`.
- Yangi: `src/bot/conversationStore.ts` — `flowStore<T>(flow)` `Map` bilan bir
  xil interfeys beradi (`get/set/delete`), lekin `rawPrisma` orqali bazaga
  yozadi. `clearAllFlows`, `cleanupOldConversations` ham shu yerda.
- `src/bot/state.ts`, `leadFlow.ts`, `avtoFlow.ts` — xotiradagi uchala `Map`
  almashtirildi, barcha chaqiruv joylari `await` ga o'tkazildi.
- `src/bot/bot.ts`: `/bekor` endi `clearAllFlows` chaqiradi (uchta alohida emas).
- Cron oxirida `cleanupOldConversations()` — 24 soatdan eski holatlar tozalanadi.
- `BotConversation` zaxiraga ATAYLAB kirmaydi: `dump.ts` ga
  `ZAXIRASIZ_JADVALLAR` ro'yxati qo'shildi, `tests/backup.test.ts` shu
  ro'yxatni hisobga oladi (yangi model baribir ikkitadan biriga tushishi shart).

**VAZIFA 2 — fail-open secretlar (C-5, C-6)**
- Yangi: `src/lib/security/compare.ts` — `secretlarTeng` (timing-safe),
  `bearerTogri` (fail-closed).
- `api/cron/monthly-report`: `CRON_SECRET` yo'q → **503**, taqqoslash umuman
  bajarilmaydi. Ilgari `"Bearer undefined"` mos kelib ketardi.
- `api/telegram/webhook`: `TELEGRAM_WEBHOOK_SECRET` yo'q → **503**; grammy'ga
  `undefined` uzatilmaydi (u tekshiruvni butunlay o'tkazib yuborardi).
- `paymeAuthOk` va Click imzo taqqoslashlari `crypto.timingSafeEqual` ga o'tdi.

**VAZIFA 3 — onDelete siyosati (C-8)**
- `prisma/schema.prisma`: 38 ta relatsiyaning hammasiga aniq siyosat.
  - `Restrict` — moliyaviy/tarixiy: Transaction, Sale, Debt, DebtPayment,
    StockEntry, ProductExpense, Product, ShiftClose, Payment, Subscription,
    Tenant → Business/User/TenantModule, Deal.stageId.
  - `Cascade` — biznesga xos sozlama va CRM: Category, Budget,
    RecurringTransaction, Contact, Stage, Deal, Task, Activity.
  - `SetNull` — ixtiyoriy bog'lanish: Deal.contactId, Task.dealId,
    Debt.productId, Activity.contactId/dealId, User.businessId,
    AuditLog.businessId (audit izi biznes o'chsa ham qoladi).

**Testlar (yangi)**
- `tests/bot-holat.test.ts` (9) — `npm run test:bot-holat`

**Fayllar:** `prisma/schema.prisma`, `prisma/migrations/20260804090000_bot_suhbat_holati/`,
`prisma/migrations/20260804091000_ondelete_siyosati/`, `src/bot/conversationStore.ts`,
`src/bot/state.ts`, `src/bot/leadFlow.ts`, `src/bot/avtoFlow.ts`, `src/bot/bot.ts`,
`src/lib/security/compare.ts`, `src/lib/billing/payme.ts`, `src/lib/billing/click.ts`,
`src/app/api/cron/monthly-report/route.ts`, `src/app/api/telegram/webhook/route.ts`,
`src/lib/backup/dump.ts`, `tests/backup.test.ts`, `tests/bot-holat.test.ts`, `package.json`

---

## FAZA 1 TEKSHIRUV RO'YXATI (loyiha egasi o'zi sinaydi)

Kod tomondan bajarilgani `[x]`, sizdan real ma'lumot bilan sinash kutilayotgani `[ ]`.

**Avtomatik tekshirilgan**
- [x] `npm run build` o'tadi
- [x] 17 ta test to'plami, jami **189 test**, 0 xato
- [x] O'chirilgan yozuv dashboard/trend/kunlik dinamika/kategoriya taqsimoti/
      oylik hisobot/budjet/smena summasiga kirmaydi (`test:soft-delete`)
- [x] Dashboard summasi yozuvlar ro'yxati summasi bilan bir xil (`test:soft-delete`)
- [x] Sotuv/mashina/qarz to'lovi o'rtada uzilsa hammasi orqaga qaytadi
      (`test:atomik` — mavjud bo'lmagan userId bilan FK xatosi)
- [x] Parallel sotuvda kategoriya dublikati yaratilmaydi (`test:atomik`)
- [x] Bot holati bazada saqlanadi, boshqa oqim bilan aralashmaydi,
      24 soatdan keyin tozalanadi (`test:bot-holat`)
- [x] `CRON_SECRET` yo'q muhitda `bearerTogri` har doim false (`test:bot-holat`)
- [x] onDelete migratsiyasi ma'lumotni saqlaydi, FK buzilishi yo'q (scratch bazada)

**Sizdan kutiladi (real muhitda)**
- [ ] Ikkala migratsiyani zaxiradan keyin apply qiling (yuqoridagi jadval)
- [ ] Yozuv o'chir → dashboard va ro'yxat BIR XIL summa ko'rsatadi
- [ ] Oylik hisobot / PDF / Excel o'chirilgan yozuvni hisoblamaydi
- [ ] Botda `/kirim` oqimi boshidan oxirigacha ishlaydi (production webhook'da ham)
- [ ] Botda `/mashina` va `/sotish` oqimlari uzilmaydi
- [ ] `CRON_SECRET`siz muhitda cron 503 qaytaradi; secret bilan 200
- [ ] Telegram webhook secret bilan ishlaydi (Vercel env tekshiring)
- [ ] Sotuv paytida serverni to'xtatib (dev'da throw qo'shib) tekshiring: qoldiq qaytadi

### 2026-08-04 — Faza 2, Prompt 2.1 (tugadi)

**VAZIFA 1 — kompozit indekslar (H-5, H-10)**
- `Transaction`: 6 ta bitta-ustunli indeks o'rniga
  `[businessId, deletedAt, sana]`, `[businessId, turi, deletedAt, sana]`,
  `[businessId, categoryId, sana]`, `[businessId, userId, sana]`.
  `[categoryId]` va `[userId]` FILTR uchun emas, `onDelete: Restrict`
  tekshiruvi uchun saqlab qolindi (aks holda har o'chirishda to'liq skanerlash).
- `Sale [businessId, createdAt]`, `Debt [businessId, isYopilgan, turi]`,
  `AuditLog [businessId, createdAt]`, `Payment.externalId @unique`.
- `EXPLAIN QUERY PLAN` bilan tekshirildi — barcha asosiy so'rovlar yangi
  indekslarni ishlatadi, yozuvlar ro'yxati endi `ORDER BY` uchun temp
  b-tree qurmaydi.

**VAZIFA 2 — agregat so'rovlar (6.1, 6.3)**
- Yangi: `src/lib/db/businessRaw.ts`. Xom SQL tenant extension'idan
  O'TMAYDI, shuning uchun tenant sharti SQL'ning o'ziga `JOIN "Business"`
  orqali kiritiladi — qo'shimcha so'rovsiz, himoya baza darajasida.
  `sanaKalit()` ikkala DateTime saqlash formatini (ISO matn / ms INTEGER)
  qo'llab-quvvatlaydi.
- `getMonthSummary`: 4 aggregate → **1** (joriy + oldingi oy bitta oraliqda).
- `getTrend(6)`: 12 aggregate → **1**.
- `getDailyDynamics`: butun oyni RAM'ga yuklash → SQL `GROUP BY`.
- `getProductProfitability`: BARCHA sotuvlarni RAM'ga yuklash → SQL
  `GROUP BY` (`SUM(tannarx * miqdor)` — Prisma bunga qodir emas).
- Dashboard sahifasi: ~21 so'rov → **7**.

**VAZIFA 3 — N+1 va tozalash (6.2, B-3)**
- `bulk-move`: har yozuvga alohida `update` (500 tagacha ketma-ket) →
  maqsad kategoriyasi bo'yicha guruhlab `updateMany`. Kategoriya `upsert`.
  Fayldagi **NUL bayt** olib tashlandi (`"nomi::turi"`).
- `recurring.ts`: takroriy yozuv endi O'SHA biznes boshqaruvchisiga
  yoziladi (ilgari tenantdagi ixtiyoriy boshqaruvchiga); yaratish +
  `lastGenerated` belgilash atomik; oy o'rtasida qo'shilgan andoza
  o'tib ketgan kun uchun darhol yozuv yaratmaydi.
- Kirill harflar tuzatildi: `biznesда`, `tenantда`, `mantiqи`.
  (Payme'ning `ru` xabarlari va signup slug regexidagi kirill — ataylab, protokol talabi.)

**Test:** `tests/agregat.test.ts` (7) — natijalar to'g'riligi + **xom SQL
tenant izolyatsiyasi** (boshqa tenant kontekstida nol qaytishi).

**Fayllar:** `prisma/schema.prisma`, `prisma/migrations/20260804100000_kompozit_indekslar/`,
`src/lib/db/businessRaw.ts`, `src/lib/queries/dashboard.ts`, `src/lib/queries/inventory.ts`,
`src/app/api/transactions/bulk-move/route.ts`, `src/lib/services/recurring.ts`,
`src/lib/billing/payme.ts`, `tests/agregat.test.ts`, `package.json`

### 2026-08-04 — Faza 2, Prompt 2.2 (tugadi)

**VAZIFA 1 — `loading.tsx` (U-1)**
- 18 ta `loading.tsx` (ilgari 26 sahifada 0 ta edi): `/app`, tranzaksiyalar,
  hisobot, ombor, sotuv, qarzlar, crm, crm/kontaktlar, vazifalar, byudjet,
  ai, smena, takroriy, bildirishnomalar, admin (umumiy), sozlamalar,
  billing, superadmin.
- `Skeleton.tsx` ga sahifa bloklari qo'shildi: `SkeletonHeader`,
  `SkeletonStats`, `SkeletonChart`, `SkeletonTable`, `SkeletonFilters`,
  `SkeletonBoard`. Har `loading.tsx` sahifaning haqiqiy tuzilishini
  takrorlaydi — generik spinner emas, yuklangach sahifa sakramaydi.

**VAZIFA 2 — `error.tsx` (U-2)**
- 9 ta modulga: ombor, crm, hisobot, qarzlar, sotuv, vazifalar, byudjet,
  ai, admin. Umumiy `components/ui/ModuleError.tsx` — "Qayta urinish" va
  "Bosh sahifa" tugmalari. Xato butun kabinetni emas, faqat bo'limni almashtiradi.

**VAZIFA 3 — kesh (H-8)**
- Yangi: `src/lib/cache.ts` — `keshlangan()` yordamchisi, `revalidate: 60`,
  teg `dashboard:{businessId}`.
  **Tenant xavfsizligi:** `unstable_cache` callback'i so'rov kontekstidan
  tashqarida chaqilishi mumkin, shuning uchun `tenantId` kesh kalitiga
  ANIQ kiritiladi va callback ichida `runWithTenant` QAYTA chaqiriladi.
- `src/lib/queries/dashboardCached.ts` — keshlangan variantlar; sahifa
  shulardan foydalanadi. `queries/dashboard.ts` keshsiz qoladi (test, bot,
  cron va hisobot har doim eng yangi raqamni oladi).
- 13 ta mutatsiya nuqtasida `dashboardYangilandi(businessId)` — foydalanuvchi
  yozuv qo'shgach 60 soniya kutmaydi (tranzaksiya CRUD, bulk, bulk-move,
  restore, sotuv, qarz to'lovi, avto mashina/xarajat).

**VAZIFA 4 — `Button` turi**
- `type="button"` default qilindi. HTML'da default `"submit"` — forma
  ichidagi har qanday tugma (masalan "Bekor qilish") formani yuborib
  yuborardi. 23 ta formaning hammasi tekshirildi: yuboruvchi tugmalarda
  `type="submit"` allaqachon aniq yozilgan edi, ya'ni regressiya yo'q.
- Qo'shimcha: `focus-visible:ring` (audit U-4 — klaviatura navigatsiyasi).

**Fayllar:** 18 ta `loading.tsx`, 9 ta `error.tsx`,
`src/components/ui/Skeleton.tsx`, `src/components/ui/ModuleError.tsx`,
`src/components/ui/Button.tsx`, `src/lib/cache.ts`,
`src/lib/queries/dashboardCached.ts`, `src/app/app/page.tsx`,
13 ta `src/app/api/**/route.ts`

---

## FAZA 2 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` o'tadi
- [x] 18 test to'plami, jami **196 test**, 0 xato
- [x] `EXPLAIN QUERY PLAN`: oylik agregat, yozuvlar ro'yxati, tur bo'yicha
      yig'indi va qarzlar so'rovi — hammasi yangi kompozit indeksni ishlatadi
- [x] Dashboard so'rovlari soni ~21 → 7 (kesh bilan takroriy yuklashda 0)
- [x] Agregat natijalari eski mantiq bilan bir xil (`test:agregat`)
- [x] Xom SQL boshqa tenant ma'lumotini ko'rsatmaydi (`test:agregat`)
- [x] Tenant konteksti yo'q bo'lsa agregat so'rov xato beradi (`test:agregat`)

**Sizdan kutiladi (real muhitda)**
- [ ] `20260804100000_kompozit_indekslar` migratsiyasini apply qiling
      (avval yuqoridagi dublikat `externalId` so'rovini bajaring)
- [ ] Dashboard birinchi yuklanish < 1 s (Turso bilan)
- [ ] Navigatsiyada darhol skeleton ko'rinadi (oq ekran yo'q)
- [ ] Yozuv qo'shgach dashboard DARHOL yangilanadi (revalidateTag ishlaydi)
- [ ] Ombor/CRM sahifalarida ataylab xato chiqarib `error.tsx` ni ko'ring

**Keyingi qadam:** Faza 3 (`faza-3-xavfsizlik`) — audit jurnalini
`tenantDb.ts` extension darajasiga ko'chirish (8/66 → 100%), rate limit'ni
bazaga, xavfsizlik header'lari, AI suhbat tarixini serverga.
