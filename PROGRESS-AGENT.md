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
| 3 | Xavfsizlik + audit | `faza-3-xavfsizlik` | ✅ tugadi |
| 4 | Kassa to'liqligi | `faza-4-kassa` | ✅ tugadi |
| 5 | PostgreSQL + masshtab | `faza-5-cron` | 🔄 5.2 (cron) ✅ · 5.1 (Postgres) bazani kutmoqda |
| 6 | ERP modullari | `faza-6-*` | ✅ 6/6 modul tugadi |

## ⚠️ MIGRATSIYA KUTILMOQDA (qo'lda apply qilinadi)

Migratsiyalar `--create-only` uslubida yozildi, **apply QILINMADI**.
Bu muhitda baza ulanmagan (`DATABASE_URL` yo'q), shuning uchun qo'llash
production/staging'da qo'lda bajariladi. **Avval zaxira oling.**

| # | Papka | Nima qiladi | Xavf |
|---|---|---|---|
| 1 | `20260804090000_bot_suhbat_holati` | `BotConversation` jadvalini yaratadi | Past — faqat CREATE TABLE |
| 2 | `20260804091000_ondelete_siyosati` | 23 ta jadvalni FK siyosati bilan qayta quradi | **O'rta** — jadval qayta qurish |
| 3 | `20260804100000_kompozit_indekslar` | Indekslarni almashtiradi, `Payment.externalId` ni UNIQUE qiladi | **O'rta** — dublikat bo'lsa to'xtaydi |
| 4 | `20260804110000_audit_tenant` | `AuditLog.tenantId` ustuni + eski yozuvlarni to'ldirish | Past |
| 5 | `20260804120000_ai_suhbat` | `AiConversation` jadvalini yaratadi | Past — faqat CREATE TABLE |
| 6 | `20260804130000_kassa_hisob_raqamlar` | `Account`, `AccountTransfer`, `Transaction.accountId` | O'rta — Transaction qayta quriladi |
| 7 | `20260804140000_sotuv_sana_bekor` | `Sale.sana` (NOT NULL), `deletedAt`, `cancelledBy`, `cancelReason` | O'rta — Sale qayta quriladi |
| 8 | `20260804150000_sku_inventarizatsiya` | `Product.sku/birlik/minQoldiq`, `StockAdjustment` | O'rta — Product qayta quriladi |
| 9 | `20260804160000_xarid_moduli` | `Supplier`, `PurchaseOrder`, `PurchaseOrderItem` | Past — faqat CREATE TABLE |
| 10 | `20260804170000_tasdiqlash_moduli` | `ApprovalRule`, `ApprovalRequest` | Past — faqat CREATE TABLE |
| 11 | `20260804180000_mijozlar_moduli` | `Contact.qarzLimit`, `Sale.contactId`, `Debt.contactId` | O'rta — Sale va Debt qayta quriladi |
| 12 | `20260804190000_hr_moduli` | `Employee`, `Attendance`, `Payroll`, `PayrollAdvance` | Past — faqat CREATE TABLE |
| 13 | `20260804200000_hujjatlar_moduli` | `Contract`, `Attachment` | Past — faqat CREATE TABLE |

**⚠️ 6-migratsiyadan KEYIN majburiy:** `npm run kassa:migratsiya` — har biznesga
default "Naqd kassa" ochadi va `accountId`siz eski tranzaksiyalarni bog'laydi.
Skriptsiz kassa qoldig'i haqiqiy pulni ko'rsatmaydi. Skript idempotent.

**7-migratsiya haqida:** `Sale.sana` NOT NULL, shuning uchun eski yozuvlar
uchun u `createdAt` dan to'ldiriladi (UTC yarim tuniga keltirilib). Hisobotlar
avvalgidek qoladi.

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

### 2026-08-04 — Faza 3, Prompt 3.1 (tugadi)

**VAZIFA 1 — auditni avtomatlashtirish (H-2)**
- Yangi: `src/lib/db/auditWriter.ts`. Audit endi `lib/db/tenantDb.ts`
  extension'ida: har `create/createMany/update/updateMany/upsert/delete/
  deleteMany` avtomatik ushlanadi. Ya'ni yangi route yozganda "audit
  qo'shishni unutish" TEXNIK JIHATDAN imkonsiz.
- `before` qiymati qo'shimcha so'rovsiz olinadi: extension IDOR himoyasi
  uchun baribir `findFirst` qilardi — undan `select: {id}` olib tashlandi.
- `deletedAt` qo'yilishi `delete`, olib tashlanishi `restore` deb yoziladi.
- **Parol hash va boshqa sirlar jurnalga tushmaydi** (`YASHIRIN_MAYDONLAR`).
- `AuditLog`ning o'zi va o'qish amallari audit qilinmaydi (cheksiz sikl yo'q).
- Audit yozish xatosi asosiy amalni BUZMAYDI (try/catch + console.error).
- Aktor `AsyncLocalStorage`ga qo'shildi: `runWithTenant(tenantId, fn, aktor)`.
  `withTenant` uni sessiyadan (userId, ism, IP) to'ldiradi.
  ⚠️ Prisma promise'i dangasa — so'rov `runWithTenant` ICHIDA await qilinishi
  shart, aks holda aktor konteksti yo'qoladi. Bu `tenantContext.ts` da izohlangan.
- `AuditLog.tenantId` ustuni qo'shildi (migratsiya). Ilgari biznesga
  bog'lanmagan yozuvlar (`businessId: null`) tenant filtridan o'tmay
  **hech kimga ko'rinmasdi**. Endi o'qish `tenantId` YOKI `business.tenantId`
  bo'yicha filtrlanadi.
- 7 ta route'dagi qo'lda `logAudit` olib tashlandi (takror bo'lmasin).
  Qolgani: `bulk-move` (maxsus semantika: qaysi biznesdan qaysi biznesga) va
  superadmin jurnali (`logSuperadminAction` — platforma darajasi).
- `shift-close` dagi `entity: "sale"` xatosi yo'qoldi — extension endi model
  nomini o'zi yozadi (`shiftClose`).
- `runBusinessTx` xom `tx` delegatlarini ishlatgani uchun extension'dan
  o'tmaydi. Shuning uchun `inventory.ts` dagi 7 ta servis biznes hodisasini
  o'zi yozadi: sotuv, qarz, qarz to'lovi, mashina, mashina xarajati
  (yaratish va o'chirish), ombor kirimi.

**VAZIFA 2 — rate limit bazaga (H-4, S-3)**
- `lib/rateLimit.ts` xotiradagi `Map`dan `AppSetting` jadvaliga ko'chdi.
  Vercel'da har lambda alohida xotiraga ega edi — parallel so'rov yuborgan
  hujumchi uchun brute-force amalda cheklanmasdi.
- Kalit ichida vaqt oynasi: `rl:{key}:{windowMs}:{oyna}` — oyna o'tishi bilan
  hisoblagich o'z-o'zidan nolga qaytadi.
- **ATOMIKLIK:** `UPDATE ... value + 1 RETURNING value`. `RETURNING` shart —
  alohida `SELECT` bilan parallel so'rovlar HAMMASI oxirgi yig'ilgan qiymatni
  o'qib qolardi (test: 10 parallel so'rovdan aynan 4 tasi o'tishi kerak).
- Ulangan joylar: login (IP va login bo'yicha), signup, `/api/search`
  (20/daqiqa), telegram kod so'rash (10/soat), botdagi kod tekshirish
  (chatId bo'yicha 5 urinish/10 daqiqa).
- Eskirgan hisoblagichlar cron'da tozalanadi.

**VAZIFA 3 — xavfsizlik header'lari (H-15)**
- `next.config.mjs` da `headers()`: `X-Frame-Options: DENY`,
  `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`,
  CSP **report-only** (recharts/Next inline style buzilmasin — avval
  buzilishlarni ko'ramiz, keyin majburlaymiz), HSTS faqat production'da.

**VAZIFA 4 — mayda xavfsizlik**
- Telegram bog'lash kodi: `Math.random` → `crypto.randomInt`
  (`Math.random` kriptografik emas — kod bashorat qilinishi mumkin edi).
- AI suhbat tarixi **serverda** (`AiConversation` jadvali, `lib/ai/suhbat.ts`).
  Ilgari tarix mijozdan kelardi — soxta `assistant` xabari bilan modelni
  chalg'itish mumkin edi (prompt injection). Mijoz endi faqat savol yuboradi.
- `aiLimitTekshir` atomik qilindi (`RETURNING` bilan) — parallel so'rovlar
  kunlik limitdan oshib ketmaydi.

**Test:** `tests/audit.test.ts` (12). `tests/isolation.test.ts` ga avtomatik
audit testi qo'shildi (22 ta bo'ldi).

**Fayllar:** `src/lib/db/auditWriter.ts`, `src/lib/db/tenantDb.ts`,
`src/lib/db/tenantContext.ts`, `src/lib/auth/tenant.ts`,
`src/lib/services/audit.ts`, `src/lib/services/inventory.ts`,
`src/lib/rateLimit.ts`, `src/lib/ai/limit.ts`, `src/lib/ai/suhbat.ts`,
`src/app/api/ai/chat/route.ts`, `src/app/app/ai/AiClient.tsx`,
`src/app/api/search/route.ts`, `src/app/api/me/telegram-link-code/route.ts`,
`src/app/api/auth/login/route.ts`, `src/app/api/auth/signup/route.ts`,
`src/bot/auth.ts`, `src/bot/bot.ts`, `next.config.mjs`,
`prisma/schema.prisma`, 2 ta migratsiya, `src/lib/backup/dump.ts`,
7 ta route'dan qo'lda `logAudit` olib tashlandi

---

## FAZA 3 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` o'tadi
- [x] 19 test to'plami, jami **210 test**, 0 xato
- [x] Kategoriya/foydalanuvchi/tranzaksiya yaratish, tahrirlash va o'chirish
      jurnalga tushadi; `before`/`after` to'g'ri (`test:audit`)
- [x] Sotuv va mashina xarajati (tranzaksiya ichidagi amallar) ham jurnalda
- [x] Parol hash jurnalga TUSHMAYDI (`test:audit`)
- [x] Audit yozuvida tenantId, businessId, userId, ism va IP bor
- [x] Rate limit 10 parallel so'rovdan aynan 4 tasini o'tkazadi (`test:audit`)
- [x] AI suhbat tarixi serverda saqlanadi va cheklanadi (`test:audit`)
- [x] Tenant izolyatsiyasi audit o'qishda ham saqlanadi (`test:isolation`)

**Sizdan kutiladi (real muhitda)**
- [ ] `20260804110000_audit_tenant` va `20260804120000_ai_suhbat` migratsiyalari
- [ ] Har qanday yozuv/tahrir/o'chirish audit sahifasida ko'rinadi
      (sotuv, qarz, foydalanuvchi, kategoriya, modul)
- [ ] Login'ga 10 marta noto'g'ri parol → 429 (ikkita brauzer/qurilmadan ham)
- [ ] `securityheaders.com` da A baho (CSP report-only bo'lgani uchun
      "A" bo'lishi mumkin, "A+" uchun CSP majburlanishi kerak)
- [ ] Brauzer konsolida CSP report-only ogohlantirishlarini ko'rib chiqing —
      toza bo'lsa `Content-Security-Policy` ga o'tkazing
- [ ] AI suhbatida "Yangi suhbat" oqimi ishlaydi

### 2026-08-04 — Faza 4, Prompt 4.1 (tugadi)

**Kassa va hisob-raqamlar**
- Ilgari hamma pul bitta "qop"da edi: naqd sotuv, plastik to'lov va bankdagi
  pul bir joyda ko'rinardi — direktor "kassada qancha naqd bor?" degan eng
  oddiy savolga javob ololmasdi.
- Yangi `Account` (naqd/plastik/bank) va `AccountTransfer`;
  `Transaction.accountId` (nullable — eski yozuvlar uchun).
- **Muhim qaror:** pul ko'chirish `Transaction` YOZMAYDI. Bu kirim ham,
  chiqim ham emas — pul biznes ichida joyini o'zgartirdi. Tranzaksiya
  yozilsa kunlik aylanma sun'iy oshib ketardi. Test buni tekshiradi.
- `/app/kassa` sahifasi: har kassa qoldig'i (kirim − chiqim ± transferlar),
  kassa CRUD, pul ko'chirish modali. Dashboardga "Kassa qoldig'i" kartasi.
- `TransactionForm` va bot oqimida kassa tanlash — **bitta kassali biznesda
  bu qadam umuman ko'rsatilmaydi** (ortiqcha bosish yo'q).
- Himoya: yozuvi bor kassa o'chirilmaydi (nofaol qilinadi), oxirgi faol kassa
  nofaol qilinmaydi, nofaol kassa bilan pul ko'chirilmaydi.
- `scripts/kassa-migratsiya.ts` — mavjud bizneslar uchun (idempotent).
- Yo'l-yo'lakay: `deleteEmptyTenant` kassalarni ham o'chiradi, `tenantsWithData`
  transferlarni ham hisobga oladi (aks holda FK cheklovi ishga tushardi).

**Test:** `tests/kassa.test.ts` (11)

### 2026-08-04 — Faza 4, Prompt 4.2 (tugadi)

**Sotuv sanasi (B-5)**
- `Sale`da faqat `createdAt` bor edi — kechagi sotuvni bugun kiritsangiz u
  kechagi hisobotga tushmasdi. Endi alohida `sana` maydoni.
- Naqd sotuvning kirim tranzaksiyasi ham O'SHA sanaga yoziladi — aks holda
  sotuv iyunda, pul iyulda ko'rinardi.
- Hisobotlar va ro'yxatlar `createdAt` emas, `sana` bo'yicha ishlaydi.

**Sotuvni bekor qilish (B-4)**
- Ilgari bu umuman mumkin emas edi: kassir xato sotuv kiritsa omborda tovar
  kam, kassada pul ko'p bo'lib qolardi. `DELETE /api/sales/[id]` — faqat
  manager, sabab majburiy. Bitta atomik amalda: Sale soft-delete, bog'langan
  kirim soft-delete, qarz o'chirish (to'lovi bo'lmasa), qoldiq qaytarish.
- Bekor qilingan sotuv foydalilik hisobiga ham, oylik hisobotga ham kirmaydi;
  ro'yxatda chizilgan holda sabab bilan qoladi.

**Narx buzilishi (H-1)**
- Kelishilgan narx katalogni buzardi: 500 dona tovardan bittasini chegirma
  bilan sotsangiz butun katalog narxi o'zgarib, keyingi barcha sotuvlar
  chegirma narxida ketardi. Endi kartochka narxi faqat AVTO rejimida
  yangilanadi (u yerda 1 yozuv = 1 mashina).

**Test:** `tests/sotuv-bekor.test.ts` (11)

### 2026-08-04 — Faza 4, Prompt 4.3 (tugadi)

**SKU, birlik, minimal qoldiq**
- `Product`: `sku` (artikul), `birlik` (dona/kg/litr/metr/quti/paket), `minQoldiq`.
- "Kam qoldi" ogohlantirishi ilgari butun tizim uchun bitta sobit chegara
  (5 dona) edi — tuxum sotuvchiga ham, avtomobil sotuvchiga ham bir xil.
  Endi har mahsulotning o'z chegarasi (0 = ogohlantirish yo'q).

**Inventarizatsiya va hisobdan chiqarish**
- `StockAdjustment`: "inventarizatsiya" (farq ±) va "chiqarish" (faqat kamaytiradi).
- Ilgari qoldiqni to'g'rilashning yagona yo'li mahsulotni qo'lda tahrirlash
  edi — kim, qachon va NEGA o'zgartirgani hech qayerda qolmasdi. Endi sabab
  majburiy, har to'g'rilash audit jurnaliga tushadi.
- Ataylab pul tranzaksiyasi yozilmaydi: bu tovar hodisasi, yo'qotishning
  moliyaviy ta'siri tannarx orqali allaqachon hisobga olingan.
- `POST /api/stock/adjust` — faqat manager (kassir kamomadni o'zi "tuzatib"
  qo'ymasligi kerak).

**Test:** `tests/inventarizatsiya.test.ts` (11)

### 2026-08-04 — Faza 4, Prompt 4.4 (tugadi)

**Sotuv cheki (PDF)**
- `lib/pdf/ReceiptDocument.tsx` — 80 mm termal printer formati (226.77 pt,
  balandlik kontentga moslashadi). Biznes nomi, sana, chek raqami, kassir,
  mahsulot × narx, jami, to'lov turi, qarzga bo'lsa qolgan summa.
- `GET /api/sales/[id]/receipt` → PDF. Sotuvlar ro'yxatida "Chek" havolasi.

**CSV import**
- `POST /api/transactions/import` — ikki bosqichli: avval `tekshirish: true`
  bilan tahlil qilinadi (nechta to'g'ri, nechta xato, ilk 10 qator ko'rsatiladi),
  foydalanuvchi ko'rgandan keyingina yoziladi. 200 qatorni ko'r-ko'rona
  yozib yuborish xavfi yo'q.
- Har qator alohida tekshiriladi (xato sabab va qator raqami bilan qaytadi),
  to'g'ri qatorlar esa BITTA tranzaksiyada yoziladi — yarim import bo'lmaydi.
- Qo'shtirnoq ichidagi vergul hurmat qilinadi ("Iyul, avans bilan"),
  "1 250 000" / "1,250,000" / "1250000.00" — hammasi tushuniladi.
- Kategoriya nom+tur bo'yicha topiladi yoki yaratiladi (`upsert`).
- UI: tranzaksiyalar sahifasida "CSV import" — namuna fayl yuklab olish,
  oldindan ko'rish, xatolar ro'yxati.

**Test:** `tests/csv-import.test.ts` (13)

---

## FAZA 4 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` o'tadi
- [x] 25 test to'plami, jami **256 test**, 0 xato
- [x] Ikki kassali biznesda plastik sotuv plastik kassaga tushadi (`test:kassa`)
- [x] Pul ko'chirish qoldiqlarni ko'chiradi, LEKIN kirim/chiqimga ta'sir qilmaydi
- [x] Sotuvni bekor qilganda ombor qoldig'i qaytadi, kirim yo'qoladi (`test:sotuv-bekor`)
- [x] Qarzi to'langan sotuv bekor qilinmaydi (tranzaksiya orqaga qaytadi)
- [x] Kechagi sanada sotuv kechagi hisobotga tushadi
- [x] Ombor rejimida chegirma katalog narxini buzmaydi, avtoda esa saqlanadi
- [x] Inventarizatsiya/chiqarish sabab bilan yoziladi va audit qilinadi
- [x] 505 qatorli CSV — 500 tasi olinadi, ortig'i xato sifatida qaytadi
- [x] Xato qatorlar aniq sabab va qator raqami bilan ajratiladi

**Sizdan kutiladi (real muhitda)**
- [ ] 6, 7, 8-migratsiyalarni apply qiling (zaxiradan keyin)
- [ ] **`npm run kassa:migratsiya`** — bu qadamsiz kassa qoldig'i noto'g'ri
- [ ] Ikki kassali biznes: plastik sotuv plastik kassaga, qoldiqlar to'g'ri
- [ ] Sotuvni bekor qiling → ombor qoldig'i qaytdi, kirim yo'qoldi, hisobot to'g'ri
- [ ] Kechagi sanada sotuv kiriting → kechagi hisobotda ko'rinadi
- [ ] 200 qatorli CSV import muvaffaqiyatli
- [ ] Chekni 80 mm termal printerda chop etib ko'ring (o'lchov mos keladimi)
- [ ] Botda `/kirim` da ikki kassali biznesda kassa tanlash qadami chiqadi

**Keyingi qadam:** Faza 5 (`faza-5-postgres`) — PostgreSQL'ga ko'chish va
cron'ni bo'lish. Loyiha egasi ruxsat bergan (2026-08-04), lekin bu **eng
xatarli faza**: avval staging'da to'liq sinash kerak. Undan keyin Faza 6
(ERP modullari: XARID → TASDIQLASH → HUJJATLAR → MIJOZLAR → HR-LITE → AI OCR).

---

### 2026-08-04 — Faza 5 haqida qaror (kechiktirildi)

Loyiha egasi ruxsat berdi, lekin faza **boshlanmadi** — sabab texnik, xohish emas:

- Bu muhitda baza umuman ulanmagan: `.env` yo'q, `DATABASE_URL` yo'q,
  `prisma/dev.db` tegilmaydigan fayl. PostgreSQL'ga ko'chirishni **sinab
  bo'lmaydi** — faqat yozib qo'yish mumkin edi, bu esa "ishlaydi" degan
  yolg'on tuyg'u beradi.
- Undan ham muhimi: **9 ta migratsiya hali apply qilinmagan.** SQLite sxemasi
  bilan haqiqiy baza sxemasi hozir bir xil emas. Shu holatda provayderni
  almashtirish — apply qilinmagan migratsiyalarni PostgreSQL sintaksisida
  qayta yozishni ham talab qiladi, ya'ni ikki karra ish va ikki karra xavf.
- To'g'ri tartib: (1) egasi 9 ta migratsiyani staging'da apply qiladi,
  (2) `npm run kassa:migratsiya` ishga tushadi, (3) shundan keyin
  `faza-5-postgres` ochiladi va staging'da to'liq sinaladi.

Shuning uchun Faza 6 (ERP modullari) boshlandi — u sxemaga qo'shimcha
qiladi, mavjudini buzmaydi, va SQLite'da to'liq sinaladi.

---

### 2026-08-04 — Faza 6, Modul 1: XARID (tugadi)

**Branch:** `faza-6-xarid`

**Muammo:** tovar omborga faqat qo'lda "kirim" bilan tushardi. Kimdan
olingani, qancha turgani, to'landimi yoki qarzga olindimi — hech qayerda
yozilmasdi. Ta'minotchi bilan hisob-kitob daftar yoki xotirada qolardi.

**Yechim — uch bosqichli oqim:** `qoralama → tasdiqlangan → qabul_qilingan`
(yoki `bekor`). Reja bilan haqiqat ataylab ajratilgan: qoralama va
tasdiqlangan buyurtma ombor qoldig'iga ham, pulga ham **tegmaydi**. Faqat
"Qabul qilish" haqiqiy voqea hisoblanadi.

**Qabul qilish — bitta `runBusinessTx` ichida:**
1. har satr uchun `StockEntry` (qoldiq oshadi, tannarx snapshot saqlanadi);
2. `Product.miqdor` += miqdor, `Product.kelganNarx` = yangi xarid narxi;
3. **naqd** bo'lsa — "Tovar xaridi" kategoriyasiga chiqim tranzaksiya;
   **qarzga** bo'lsa — `beriladigan` turdagi qarz (pul chiqimi to'lov
   paytida yoziladi, ikki marta emas).

Qabul qilingan buyurtma qulflanadi: qayta qabul qilib ham, tahrirlab ham,
bekor qilib ham bo'lmaydi — ombor va pul yozuvlari allaqachon ketgan.

**Sxema (yangi modellar):** `Supplier`, `PurchaseOrder`, `PurchaseOrderItem`.
Uchalasi `tenantDb.ts` dagi `BUSINESS_SCOPED` va `dump.ts` dagi
`ZAXIRA_JADVALLARI` ro'yxatiga qo'shildi.

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260804160000_xarid_moduli/`
- `src/lib/validation/xarid.ts` — zod sxemalari, holatlar ro'yxati
- `src/lib/services/xarid.ts` — ta'minotchi CRUD, buyurtma, `qabulQilish`
- `src/lib/queries/xarid.ts` — ro'yxatlar (2 ta `groupBy`, N+1 yo'q) + statistika
- `src/app/api/xarid/suppliers/route.ts`, `.../[id]/route.ts`
- `src/app/api/xarid/orders/route.ts`, `.../[id]/route.ts`
- `src/app/app/xarid/{page,loading,error}.tsx`, `XaridClient.tsx`, `BuyurtmaModal.tsx`
- `src/app/app/xarid/taminotchilar/{page,loading}.tsx`, `TaminotchilarClient.tsx`
- `src/lib/modules/registry.ts` (XARID moduli), `src/lib/billing/plans.ts` (PRO)
- `src/lib/db/tenantDb.ts`, `src/lib/backup/dump.ts`

**Ruxsat:** modul faqat BOSHQARUVCHILAR uchun (kassir ko'rmaydi), PRO tarifda.
Har route `withTenant(..., { module: "XARID" })` + `requireManager`.

**Test:** `tests/xarid.test.ts` (13) — ta'minotchi CRUD, qoralama hech
narsaga tegmasligi, naqd qabul (StockEntry + tannarx + chiqim), qarzga
qabul (qarz yoziladi, tranzaksiya yozilmaydi), qayta qabulning rad etilishi,
begona tenant/mahsulot izolyatsiyasi, statistika.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
26 test to'plami, jami **269 test**, 0 xato.

**Keyingi qadam:** Faza 6, Modul 2 — TASDIQLASH (katta summali chiqimlarga
rahbar tasdig'i).

---

## FAZA 6 / MODUL 1 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Qoralama va tasdiqlangan buyurtma ombor qoldig'ini o'zgartirmaydi
- [x] Naqd qabul: qoldiq oshdi, tannarx yangilandi, chiqim yozildi, qarz yozilmadi
- [x] Qarzga qabul: qoldiq oshdi, `beriladigan` qarz yozildi, tranzaksiya yozilmadi
- [x] Qayta qabul qilish rad etiladi va qoldiqni ikki marta oshirmaydi
- [x] Qabul qilingan buyurtma tahrirlanmaydi va bekor qilinmaydi
- [x] Ochiq buyurtmasi bor ta'minotchi o'chirilmaydi; o'chirilgani yumshoq
- [x] Begona tenant ta'minotchi/buyurtmalarni ko'rmaydi va tahrirlay olmaydi
- [x] Begona biznes mahsuloti bilan buyurtma yaratib bo'lmaydi

**Sizdan kutiladi (real muhitda)**
- [ ] 9-migratsiyani apply qiling
- [ ] PRO tarifdagi biznesda menyuda "Xarid" ko'rinishini tekshiring
- [ ] Kassir hisobida "Xarid" **ko'rinmasligini** tekshiring
- [ ] Ta'minotchi qo'shing → buyurtma yarating → qabul qiling →
      ombor qoldig'i va tranzaksiyalar ro'yxatini solishtiring
- [ ] Qarzga xarid qiling → "Qarzlar" bo'limida `beriladigan` qarz paydo bo'ldimi
- [ ] Ombor tizimi o'chirilgan biznesda sahifa ogohlantirish ko'rsatadimi

---

### 2026-08-04 — Faza 6, Modul 2: TASDIQLASH (tugadi)

**Branch:** `faza-6-tasdiqlash`

**Muammo:** kassir yoki sotuvchi istalgan summani chiqim qilib yozib
yuborardi. Direktor buni ko'pincha faqat oy oxirida — hisobotda — ko'rardi.
Pul allaqachon ketgan, yozuv allaqachon hisobotga kirgan bo'lardi.

**Yechim:** `ApprovalRule` — biznes o'zi belgilaydigan chegara. Chegaradan
**KATTA** chiqim darhol yozilmaydi: `ApprovalRequest` yaratiladi va
tasdiqlovchilarga Telegramga inline tugmali xabar ketadi.

**Asosiy invariant:** tasdiq kutayotgan so'rov — pul EMAS. U `Transaction`
emas, alohida jadval; shuning uchun hisobotga, kassa qoldig'iga va budjetga
umuman ta'sir qilmaydi. Haqiqiy yozuv faqat tasdiqlangan paytda, bitta
`runBusinessTx` ichida tug'iladi va so'rovga `transactionId` bilan
bog'lanadi — kim so'ragani va kim tasdiqlagani tarixda qoladi.

**Qoidalar mantiqi:**
- Kategoriyasiz qoida — barcha chiqimlarga; kategoriyali qoida — o'shanga.
- Bir nechta qoida mos kelsa **eng qattig'i** (chegarasi eng pasti) ishlaydi.
- Rol ierarxiyasi: OWNER(3) > ADMIN(2) > CASHIER/SELLER(1). So'rovchining
  darajasi tasdiqlovchi darajasidan past bo'lmasa qoida qo'llanmaydi —
  direktor o'z chiqimini o'zi tasdiqlab o'tirmaydi.
- O'z so'rovini o'zi tasdiqlash ataylab taqiqlangan (ADMIN ham).
- Rad etishda **sabab majburiy** — xodim nima uchun rad etilganini bilishi kerak.
- Qoidani o'chirish yumshoq: shu qoida bo'yicha yaratilgan so'rovlar
  "nega tasdiq so'ralgan edi?" degan savolsiz qolmasligi kerak.

**Telegram:** `tsd:ok:<id>` / `tsd:no:<id>` inline tugmalari. Tasdiqlash bir
bosishda; rad etishda bot sababni so'raydi (`tasdiq_rad` oqimi). Xabarnoma
ataylab "best-effort" — Telegram ishlamasa ham so'rov bazada turadi va
veb-saytda ko'rinadi, chiqim kiritish jarayoni buzilmaydi.

**Yangi modellar:** `ApprovalRule`, `ApprovalRequest` — ikkalasi
`BUSINESS_SCOPED` va `ZAXIRA_JADVALLARI` ro'yxatlarida.

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260804170000_tasdiqlash_moduli/`
- `src/lib/validation/approval.ts`, `src/lib/services/approval.ts`, `src/lib/queries/approval.ts`
- `src/app/api/tasdiqlash/qoidalar/route.ts`, `.../[id]/route.ts`
- `src/app/api/tasdiqlash/sorovlar/[id]/route.ts`
- `src/app/api/transactions/route.ts` — chiqim endi `chiqimYubor` orqali (202 javob)
- `src/app/app/tasdiqlash/{page,loading,error}.tsx`, `TasdiqlashClient.tsx`, `RadModal.tsx`
- `src/app/app/tasdiqlash/qoidalar/{page,loading}.tsx`, `QoidalarClient.tsx`
- `src/bot/approvalFlow.ts` (yangi), `src/bot/bot.ts`, `src/bot/transactionFlow.ts`
- `src/lib/modules/registry.ts`, `src/lib/billing/plans.ts`, `src/lib/services/audit.ts`
- `src/lib/db/tenantDb.ts`, `src/lib/backup/dump.ts`, `src/components/nav/Sidebar.tsx`

**Ruxsat:** modul PRO tarifda. So'rovlar sahifasi HAMMA uchun ochiq (xodim
faqat O'Z so'rovlarini ko'radi — tranzaksiyalardagi qoida bilan bir xil),
qaror va qoidalar sahifasi faqat BOSHQARUVCHILAR uchun.

**Test:** `tests/tasdiqlash.test.ts` (20) — qoida CRUD, chegaraning aynan
"kattasi" ishlashi, qattiqroq qoidaning ustunligi, modul o'chiq holat,
kirimning tegilmasligi, tasdiq → tranzaksiya, rad → tranzaksiyasiz,
qayta qaror, o'z so'rovini tasdiqlash, past rolning qaror chiqara olmasligi,
ko'rinuvchanlik va tenant izolyatsiyasi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
27 test to'plami, jami **289 test**, 0 xato.

**Keyingi qadam:** Faza 6, Modul 3 — HUJJATLAR (fayl ilova qilish). Diqqat:
u tashqi fayl saqlagich (Vercel Blob yoki S3) talab qiladi — bu muhitda
sinab bo'lmaydi, shuning uchun avval MIJOZLAR moduliga o'tish oqilonaroq.

---

## FAZA 6 / MODUL 2 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Chegaradan past va chegaraga TENG summa darhol yoziladi
- [x] Chegaradan katta summa yozilmaydi — so'rov yaratiladi
- [x] Direktorning o'z chiqimi tasdiq talab qilmaydi
- [x] Kirim hech qachon tasdiq talab qilmaydi
- [x] Kategoriyaga atalgan qattiqroq qoida umumiysidan ustun
- [x] Tasdiqlash chiqim yozuvini yaratadi, yozuv SO'RAGAN xodim nomida
- [x] Rad etish pul yozuvi yaratmaydi, sabab saqlanadi
- [x] Qayta tasdiqlash/rad etish rad qilinadi
- [x] O'z so'rovini o'zi tasdiqlay olmaydi
- [x] Kassir qaror chiqara olmaydi
- [x] Xodim faqat o'z so'rovlarini ko'radi
- [x] Begona tenant so'rov va qoidalarni ko'rmaydi

**Sizdan kutiladi (real muhitda)**
- [ ] 10-migratsiyani apply qiling
- [ ] Sozlamalar → Modullar bo'limida "Tasdiqlash" ni yoqing (PRO)
- [ ] Qoida qo'ying (masalan 1 000 000 so'm, tasdiqlovchi — Direktor)
- [ ] Kassir hisobidan 2 000 000 so'mlik chiqim kiriting → "tasdiq kutilmoqda"
      xabari chiqadimi, hisobotda ko'rinmayotganini tekshiring
- [ ] Direktor Telegramida tugmali xabar keldimi; "Tasdiqlash" bosilganda
      chiqim yozuvi paydo bo'ladimi
- [ ] "Rad etish" bosing → bot sabab so'raydi, sabab yozilgach so'rov rad etiladi
- [ ] Botdagi /chiqim orqali ham chegaradan oshiring — xuddi shunday ishlaydimi

---

### 2026-08-04 — Faza 6, Modul 3: MIJOZLAR (tugadi)

**Branch:** `faza-6-mijozlar`

**Muammo:** sotuv va qarzda mijoz faqat ERKIN MATN edi — "Akmal",
"akmal aka", "Akmal 90-...". Tizim bularning bitta odam ekanini bilmasdi,
shuning uchun "bu odam bizga qancha qarz?" degan savolga javob yo'q edi.
Qarz esa hech qanday chegarasiz o'saverardi.

**Yechim:** `Sale.contactId` va `Debt.contactId` — sotuv va qarz mijoz
kartochkasiga bog'lanadi. `Contact.qarzLimit` — ochiq qarz chegarasi.

**Qarz limiti mantiqi:**
- `null` — chegara yo'q (avvalgi xatti-harakat, eski yozuvlar buzilmaydi).
- `0` — mijozga umuman qarzga sotilmaydi (faqat naqd).
- Chegaraga **teng** qarz o'tadi, undan **oshadigani** rad etiladi.
- Faqat `olinadigan` va yopilmagan qarzlar hisobga olinadi; to'langan qism
  qoldiqdan chiqadi, ya'ni to'lov qilingach limitda joy bo'shaydi.
- Naqd sotuvga limit ta'sir qilmaydi.

**Nega tekshiruv tranzaksiya ichida:** limit tekshiruvi bilan qarz yozuvi
orasida boshqa sotuv o'tib ketsa, ikkalasi ham "limit yetadi" deb qaror
qilardi va mijoz chegaradan oshib ketardi. `qarzLimitTekshirTx` sotuv
tranzaksiyasi ichida, qoldiq kamaytirilishidan OLDIN chaqiriladi — rad
etilgan sotuv ombordan tovar ham olmaydi.

**Kartochka sahifasi** (`/app/mijozlar/[id]`): jami sotuv, ochiq qarz va
limit yakunlari + uch bo'lim (sotuvlar, qarzlar, CRM bitimlari). Ro'yxat
sahifasida qidiruv va limit to'lganlar belgisi.

**Sotuv formasi:** MIJOZLAR moduli yoqiq bo'lsa qarzga sotuvda kartochka
tanlash select'i chiqadi. Limit to'lgan mijoz select'da o'chirilgan
(`disabled`) — xato server javobini kutmasdan ko'rinadi.

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260804180000_mijozlar_moduli/`
- `src/lib/validation/mijoz.ts`, `src/lib/services/mijoz.ts`, `src/lib/queries/mijoz.ts`
- `src/app/api/mijozlar/route.ts`, `.../[id]/route.ts`
- `src/app/app/mijozlar/{page,loading,error}.tsx`, `MijozlarClient.tsx`, `MijozModal.tsx`
- `src/app/app/mijozlar/[id]/{page,loading}.tsx`, `KartochkaClient.tsx`
- `src/lib/services/inventory.ts` — `createSale` endi `contactId` qabul qiladi
- `src/lib/validation/inventory.ts`, `src/app/api/sales/route.ts`
- `src/app/app/sotuv/page.tsx`, `SotuvClient.tsx` — mijoz tanlash
- `src/lib/modules/registry.ts`, `src/lib/billing/plans.ts`, `src/lib/services/audit.ts`
- `src/components/nav/Sidebar.tsx`

**Yangi model yo'q** — `Contact` allaqachon `BUSINESS_SCOPED` va
`ZAXIRA_JADVALLARI` ro'yxatlarida, shuning uchun ro'yxatlar o'zgarmadi.

**Ruxsat:** modul PRO tarifda, HAMMA rol uchun ochiq. Qarz limitini
o'zgartirish va mijozni o'chirish — faqat boshqaruvchilar.

**Test:** `tests/mijozlar.test.ts` (15) — kartochka CRUD, naqd sotuvning
kartochkaga bog'lanishi, limitdan past/teng/oshgan qarz, rad etilgan
sotuvning ombordan tovar olmasligi, to'lovdan keyin joy bo'shashi,
limitsiz va limit=0 holatlari, kartochkasiz sotuvning avvalgidek ishlashi,
yopilmagan qarzli mijozning o'chirilmasligi, tenant izolyatsiyasi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
28 test to'plami, jami **304 test**, 0 xato.

**Keyingi qadam:** Faza 6 ning qolgan modullari — HUJJATLAR (tashqi fayl
saqlagich kerak: Vercel Blob yoki S3), HR-LITE, AI OCR.

---

## FAZA 6 / MODUL 3 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Naqd sotuv kartochkaga bog'lanadi, jami sotuvga qo'shiladi
- [x] Limitdan past va limitga TENG qarz o'tadi
- [x] Limitdan oshadigan qarz rad etiladi va ombordan tovar olinmaydi
- [x] Limit to'lgach eng kichik qarz ham o'tmaydi
- [x] Naqd sotuvga limit ta'sir qilmaydi
- [x] To'lov qilingach limitda joy bo'shaydi
- [x] Limitsiz (null) va limit=0 holatlari to'g'ri ishlaydi
- [x] Kartochkasiz qarzga sotuv avvalgidek ishlaydi (eski xatti-harakat)
- [x] Yopilmagan qarzi bor mijoz o'chirilmaydi; o'chirilganda tarix qoladi
- [x] Begona tenant kartochkani ko'rmaydi

**Sizdan kutiladi (real muhitda)**
- [ ] 11-migratsiyani apply qiling (Sale va Debt qayta quriladi — ZAXIRA OLING)
- [ ] Sozlamalar → Modullar bo'limida "Mijozlar" ni yoqing (PRO)
- [ ] Mijoz qo'shing, qarz limiti belgilang
- [ ] Sotuv sahifasida qarzga sotishda mijoz select'i chiqadimi
- [ ] Limitdan oshiring — xato xabari aniq va tushunarli chiqadimi
- [ ] Mijoz kartochkasida sotuv/qarz/bitim bo'limlari to'g'ri to'ladimi
- [ ] Qarz to'lovi kiritilgach kartochkadagi "ochiq qarz" kamaydimi

---

### 2026-08-04 — Faza 6, Modul 4: HR-LITE (tugadi)

**Branch:** `faza-6-hr`

**Muammo:** oylik daftar yoki Excelda yuritilardi. Kimga qancha avans
berilgani esa umuman yozilmasdi — oy oxirida "men senga 500 ming bergan
edim" degan bahs boshlanardi. Chiqim tranzaksiyalari ichida oylik alohida
ko'rinmasdi.

**Nega `Employee` va `User` alohida:** `User` — tizimga KIRADIGAN hisob.
Xodimlarning ko'pchiligi tizimga umuman kirmaydi (yuk tashuvchi, oshpaz,
farrosh), lekin ularga oylik to'lanadi. Ikkalasini bitta jadvalga tiqish
"loginsiz foydalanuvchi" degan g'alati yozuvlarni tug'dirardi.
`Employee.userId` — ixtiyoriy ko'prik.

**Uch bosqichli pul oqimi:**
1. **Hisoblash** (`qoralama`) — PUL EMAS. Hisobotga, kassa qoldig'iga va
   budjetga umuman ta'sir qilmaydi.
2. **Avans** — pul DARHOL chiqadi (chiqim tranzaksiya + `PayrollAdvance`
   bitta atomik amalda). Qoralama vedomost ham darhol qayta hisoblanadi.
3. **To'lash** — `tolanadigan` summa bitta chiqim tranzaksiyasiga aylanadi.
   Avans allaqachon chiqim bo'lgani uchun undan **chegirilgan** — bir xil
   pul ikki marta chiqim bo'lib ko'rinmaydi. (Test buni aniq tekshiradi:
   avans 1 mln + oylik 4.3 mln = jami 5.3 mln, 6.3 mln emas.)

**Stavka mantiqi:**
- `oylik` — asos to'liq stavka. Avtomatik proporsiya ataylab yo'q: o'zbek
  amaliyotida oylik ishchi kunlar soniga qarab o'zgarmaydi, kam ishlagani
  `ushlab` bilan qo'lda hisobga olinadi.
- `kunlik` — asos davomatdan: `stavka × kunlar`. Yarim kunni kasr bilan
  saqlamaslik uchun `Payroll.yarimKunlar` ikkilangan sonda yuritiladi
  (1 kun = 2, yarim kun = 1) — pul har doim `Int` qoidasi buzilmaydi.
- `tolanadigan = max(0, hisoblangan + qoshimcha − ushlab − avans)` —
  manfiy oylik yozilmaydi.

**Davomat:** bir xodim, bir kun, bitta yozuv (qayta belgilansa ustiga
yoziladi). Jadval xodim × kun ko'rinishida, katakni bosish bilan
belgilanadi (optimistik ko'rinish, xato bo'lsa orqaga qaytadi).

**Qulflar:** to'langan oylikni qayta to'lab ham, qayta hisoblab ham
bo'lmaydi; to'langan oyga avans yozilmaydi; to'lanmagan vedomosti bor
xodim o'chirilmaydi.

**Yangi modellar:** `Employee`, `Attendance`, `Payroll`, `PayrollAdvance`
— to'rttasi `BUSINESS_SCOPED` va `ZAXIRA_JADVALLARI` ro'yxatlarida.

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260804190000_hr_moduli/`
- `src/lib/validation/hr.ts`, `src/lib/services/hr.ts`, `src/lib/queries/hr.ts`
- `src/app/api/hr/xodimlar/route.ts`, `.../[id]/route.ts`
- `src/app/api/hr/davomat/route.ts`, `src/app/api/hr/avans/route.ts`
- `src/app/api/hr/oylik/route.ts`, `.../[id]/route.ts`
- `src/app/app/hr/{page,loading,error}.tsx`, `HrClient.tsx`, `XodimModal.tsx`, `OylikModal.tsx`
- `src/app/app/hr/davomat/{page,loading}.tsx`, `DavomatClient.tsx`
- `src/lib/modules/registry.ts`, `src/lib/billing/plans.ts`, `src/lib/services/audit.ts`
- `src/lib/db/tenantDb.ts`, `src/lib/backup/dump.ts`, `src/components/nav/Sidebar.tsx`

**Ruxsat:** modul PRO tarifda, faqat BOSHQARUVCHILAR (oylik — pul va
shaxsiy ma'lumot).

**Test:** `tests/hr.test.ts` (19) — xodim CRUD, davomatning ustiga
yozilishi, kunlik/oylik stavka hisobi, ustama va ushlab qolish, avansning
darhol chiqim yozishi va oylikdan chegirilishi, qayta hisoblashda avansning
yo'qolmasligi, manfiy oylikning bo'lmasligi, to'lovdagi qulflar, vedomost
ro'yxati va statistika, yumshoq o'chirish, tenant izolyatsiyasi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
29 test to'plami, jami **323 test**, 0 xato.

**Keyingi qadam:** Faza 6 ning qolgani — AI OCR (chek rasmi → chiqim
taklifi) va HUJJATLAR (tashqi fayl saqlagich kerak).

---

## FAZA 6 / MODUL 4 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Oylik hisoblash pul yozuvi YARATMAYDI
- [x] Kunlik stavkada oylik davomatdan to'g'ri hisoblanadi (yarim kun ham)
- [x] Oylik stavkada asos to'liq stavka bo'ladi
- [x] Ustama qo'shadi, ushlab qolish kamaytiradi
- [x] Avans darhol chiqim yozadi va qoralama vedomostni yangilaydi
- [x] Qayta hisoblash avansni va berilmagan qiymatlarni yo'qotmaydi
- [x] To'lanadigan hech qachon manfiy bo'lmaydi
- [x] To'lashda avans chegirilgan summa yoziladi (ikki marta hisoblanmaydi)
- [x] To'langan oylik qayta to'lanmaydi, qayta hisoblanmaydi, avans qabul qilmaydi
- [x] To'lanmagan vedomosti bor xodim o'chirilmaydi
- [x] Begona tenant xodim va vedomostlarni ko'rmaydi

**Sizdan kutiladi (real muhitda)**
- [ ] 12-migratsiyani apply qiling
- [ ] Sozlamalar → Modullar bo'limida "Xodimlar (HR-lite)" ni yoqing (PRO)
- [ ] Oylik va kunlik stavkali ikki xodim qo'shing
- [ ] Davomat jadvalida bir necha kun belgilang → oylik to'g'ri hisoblandimi
- [ ] Avans bering → Yozuvlar ro'yxatida "Avans" chiqimi paydo bo'ldimi
- [ ] Oylikni to'lang → "Oylik" chiqimi avans chegirilgan summada yozildimi
- [ ] Kassa qoldig'i ikkala to'lovdan keyin to'g'ri kamaydimi

---

### 2026-08-04 — Faza 6, Modul 5: AI OCR (chek rasmi) (tugadi)

**Branch:** `faza-6-ocr` · **Migratsiya YO'Q** — yangi jadval qo'shilmadi.

**Muammo:** chek qo'lda kiritilardi. Xodim summani noto'g'ri yozardi yoki
umuman kiritmasdan qo'yardi — oy oxirida "bu pul qayerga ketdi?" degan
savol qolardi.

**Yechim:** Telegramga chek rasmini tashlash yetarli. Claude vision chekni
o'qiydi, bot TAKLIF ko'rsatadi, foydalanuvchi kategoriyani tanlab
tasdiqlaydi — shundagina chiqim yoziladi.

**Ataylab avtomatik YOZMAYDI.** Model xato o'qishi mumkin, shuning uchun
oxirgi so'z har doim odamda qoladi. Yana ikki himoya:
- `chekNatijasiniAjrat` qat'iy: summa yo'q, nol yoki manfiy bo'lsa,
  JSON buzilgan bo'lsa — natija `null` va bot "o'qiy olmadim, qo'lda
  kiriting" deydi. Noto'g'ri raqamni jimgina yozib qo'yishdan ko'ra
  o'qimaganini tan olish xavfsizroq.
- `ishonch: "past"` bo'lsa foydalanuvchi ogohlantiriladi.

**TASDIQLASH bilan bog'lanish:** yozuv `chiqimYubor` orqali ketadi, ya'ni
chek orqali kiritilgan katta summa ham rahbar tasdig'ini kutadi. AI
yo'lakchasi tekshiruvni chetlab o'tmaydi.

**Cheklovlar:** AI moduli yoqilgan bo'lishi shart, kunlik AI limiti
(`aiLimitTekshir`) qo'llanadi, rasm 5 MB dan oshmasligi kerak.

**Fayllar:**
- `src/lib/ai/chekOcr.ts` — vision chaqiruvi va javobni ajratish
- `src/bot/chekFlow.ts` — rasm → taklif → kategoriya → yozuv oqimi
- `src/bot/bot.ts` — `message:photo` handleri, `chk:` va `chbekor` callback'lari

**Test:** `tests/chek-ocr.test.ts` (14) — toza JSON, markdown blok ichidagi
JSON, summasiz/nol/manfiy/buzilgan javobning rad etilishi, kasr summaning
yaxlitlanishi, noto'g'ri sana va noma'lum ishonch qiymatining tozalanishi,
API kaliti yo'qligi, format tekshiruvi, API xatosining yashirilmasligi,
kategoriyalar ro'yxatining so'rovga qo'shilishi. Tarmoqqa chiqmaydi —
soxta `fetch` ishlatiladi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
30 test to'plami, jami **337 test**, 0 xato.

---

## FAZA 6 / MODUL 5 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Model javobi markdown blok ichida bo'lsa ham o'qiladi
- [x] Summasiz, nol, manfiy yoki buzilgan javob RAD etiladi (chiqim yozilmaydi)
- [x] Kasrli summa butun songa yaxlitlanadi (pul har doim Int)
- [x] Noto'g'ri sana va noma'lum ishonch qiymati tozalanadi
- [x] API kaliti yo'q bo'lsa aniq xato, API xatosi yashirilmaydi

**Sizdan kutiladi (real muhitda)**
- [ ] `ANTHROPIC_API_KEY` production'da borligini tekshiring
- [ ] AI modulini yoqing (PRO tarif)
- [ ] Botga haqiqiy chek rasmini yuboring → summa to'g'ri o'qildimi
- [ ] Kategoriya tanlang → chiqim yozuvi paydo bo'ldimi
- [ ] Xira/qiyshiq rasm yuboring → "o'qiy olmadim" deb to'xtadimi
- [ ] TASDIQLASH yoqiq bo'lsa: chegaradan katta chekda tasdiq so'raldimi

---

### 2026-08-04 — Faza 6, Modul 6: HUJJATLAR (tugadi)

**Branch:** `faza-6-hujjatlar`

**Muammo:** shartnomalar papkada yotardi. Muddati o'tib ketgani faqat
kimdir eslaganda ma'lum bo'lardi. Chek va hujjat skanlari esa Telegram
suhbatlarida yo'qolib ketardi — "o'sha to'lovning hujjati qani?" degan
savolga javob yo'q edi.

**Yechim ikki qismdan iborat:**

1. **Shartnomalar reyestri** — raqam, kontragent, summa, boshlanish/tugash
   va `eslatmaKun`. Muddatga `eslatmaKun` qolganda (yoki o'tib ketganda)
   bildirishnomalar ro'yxatida ogohlantirish chiqadi. Kontragent uch xil
   bo'lishi mumkin: mijoz kartochkasi, ta'minotchi kartochkasi yoki oddiy
   matn (bir martalik tomon uchun).

2. **Fayl ilovalari** — `Transaction`, `Debt`, `Deal`, `Task` va
   `Contract` ga hujjat biriktirish.

**Saqlagichga bog'liqlik ataylab yumshoq.** Ilova ikki rejimda bo'ladi:
- **havola** — tashqi manzil (Google Drive, Telegram, korporativ portal).
  Hech qanday sozlash talab qilmaydi va HAR DOIM ishlaydi. Ko'p kichik
  biznes uchun shu yetarli.
- **blob** — Vercel Blob'ga yuklash, `BLOB_READ_WRITE_TOKEN` bo'lganda.
  Token yo'q bo'lsa aniq xato beriladi; jimgina "havola" ga tushib qolish
  foydalanuvchini chalg'itardi (fayl saqlanmagan bo'lardi).

Shu qaror tufayli modul bu muhitda ham to'liq ishlaydi va sinaladi.

**Xavfsizlik qarorlari:**
- Havolada faqat `http(s)` — `javascript:` va `data:` sxemalari saqlangan
  havola bosilganda XSS yo'liga aylanardi.
- Yuklashda faqat oq ro'yxatdagi MIME turlar (ijro etiladigan fayllar yo'q),
  10 MB chegara.
- Fayl nomidan yo'l belgilari VA `..` ketma-ketligi olib tashlanadi
  (bitta `/` almashtirish yetmasligi testda aniqlandi va tuzatildi).
- Ilova polimorf bog'lanadi (FK yo'q, bitta jadval besh xil yozuvga ilova
  bo'ladi), shuning uchun **egalik xizmat qatlamida tekshiriladi** — begona
  yozuvga ilova osib bo'lmaydi.
- Ilovani o'chirish yumshoq va saqlagichdagi fayl o'chirilmaydi: yozuv
  tasodifan o'chirilsa havola tiklanishi kerak, va bir fayl bir necha
  yozuvga biriktirilgan bo'lishi mumkin.

**Yangi modellar:** `Contract`, `Attachment` — ikkalasi `BUSINESS_SCOPED`
va `ZAXIRA_JADVALLARI` ro'yxatlarida.

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260804200000_hujjatlar_moduli/`
- `src/lib/storage/driver.ts` (yangi) — saqlagich drayveri
- `src/lib/validation/hujjat.ts`, `src/lib/services/hujjat.ts`, `src/lib/queries/hujjat.ts`
- `src/app/api/hujjatlar/shartnomalar/route.ts`, `.../[id]/route.ts`
- `src/app/api/hujjatlar/ilova/route.ts`, `.../[id]/route.ts`
- `src/app/app/hujjatlar/{page,loading,error}.tsx`, `HujjatlarClient.tsx`,
  `ShartnomaModal.tsx`, `IlovaModal.tsx`
- `src/lib/queries/notifications.ts` — shartnoma muddati ogohlantirishi
- `src/lib/modules/registry.ts`, `src/lib/billing/plans.ts`, `src/lib/services/audit.ts`

**Test:** `tests/hujjatlar.test.ts` (20) — shartnoma CRUD, takroriy raqam,
teskari sana, begona kontragent, muddat hisobining to'rt holati (oynada,
oynadan uzoq, o'tib ketgan, muddatsiz), yopilgan shartnomaning
eslatmasligi, statistika, havola biriktirish, xavfli havolalarning rad
etilishi, begona yozuvga ilova osib bo'lmasligi, yumshoq o'chirish,
saqlagich sozlanmagan holati, ruxsatsiz fayl turi va hajm, fayl nomining
tozalanishi, tenant izolyatsiyasi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
31 test to'plami, jami **357 test**, 0 xato.

---

## FAZA 6 / MODUL 6 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Muddat hisobi to'rt holatda ham to'g'ri (oynada / uzoq / o'tgan / muddatsiz)
- [x] Yopilgan (tugagan/bekor) shartnoma ogohlantirmaydi
- [x] `javascript:` va `data:` havolalari rad etiladi
- [x] Begona yozuvga va begona kontragentga bog'lab bo'lmaydi
- [x] Saqlagich sozlanmagan bo'lsa aniq xato, havola rejimi baribir ishlaydi
- [x] Ruxsatsiz fayl turi va 10 MB dan katta fayl rad etiladi
- [x] Fayl nomidan `..` va yo'l belgilari olib tashlanadi
- [x] Ilova yumshoq o'chiriladi; shartnoma o'chirilsa hujjatlari qoladi

**Sizdan kutiladi (real muhitda)**
- [ ] 13-migratsiyani apply qiling
- [ ] Sozlamalar → Modullar bo'limida "Hujjatlar" ni yoqing (PRO)
- [ ] Shartnoma qo'shing, tugash sanasini yaqin qilib qo'ying →
      bildirishnomalar ro'yxatida ogohlantirish chiqdimi
- [ ] Havola biriktiring → ro'yxatda ochilyaptimi
- [ ] Fayl yuklashni sinamoqchi bo'lsangiz: Vercel'da Blob store yarating
      va `BLOB_READ_WRITE_TOKEN` ni env'ga qo'ying

---

## 🏁 FAZA 6 YAKUNI

Oltala modul tugadi va yig'ma branchga qo'shildi:

| # | Modul | Branch | Migratsiya | Test |
|---|---|---|---|---|
| 1 | XARID | `faza-6-xarid` | 9 | 13 |
| 2 | TASDIQLASH | `faza-6-tasdiqlash` | 10 | 20 |
| 3 | MIJOZLAR | `faza-6-mijozlar` | 11 | 15 |
| 4 | HR-LITE | `faza-6-hr` | 12 | 19 |
| 5 | AI OCR | `faza-6-ocr` | — | 14 |
| 6 | HUJJATLAR | `faza-6-hujjatlar` | 13 | 20 |

**Umumiy holat:** 31 test to'plami, **357 test**, 0 xato. `npm run build`
va `npx tsc --noEmit` toza.

**Qolgan yagona faza — Faza 5 (PostgreSQL).** U ataylab oxirига qoldirildi:
bu muhitda baza ulanmagan, va 13 ta migratsiya apply qilinmagan holda
provayder almashtirish ularni PostgreSQL sintaksisida qayta yozishni talab
qilardi. To'g'ri tartib:

1. Staging'da 13 ta migratsiyani ketma-ket apply qiling (har biridan oldin zaxira);
2. 6-migratsiyadan keyin **majburiy**: `npm run kassa:migratsiya`;
3. Har modulning tekshiruv ro'yxatidan o'ting;
4. Shundan keyin `faza-5-postgres` ochiladi va staging'da to'liq sinaladi.

---

### 2026-08-04 — Faza 5, Prompt 5.2: cron'ni bo'lish (tugadi)

**Branch:** `faza-5-cron` · **Migratsiya YO'Q** — bazaga tegilmadi.

Faza 5 ning bu qismi PostgreSQL'ga umuman bog'liq emas, shuning uchun
migratsiyalarni kutmasdan bajarildi. Audit'dagi **H-12** shu bilan yopiladi.

**Muammo:** bitta cron route'da ketma-ket sakkizta ish bajarilardi — zaxira,
obuna statuslari, oylik hisobot, takroriylar, eslatmalar, kunlik xulosa va
ikkita tozalash. 50+ tenantda bu 60 soniyalik limitga urilardi va oxirgi
qadamlar **jimgina** bajarilmay qolardi. Hech kim buni sezmasdi: javob
baribir "OK" edi yoki funksiya timeout bo'lib log'da yo'qolardi.

**Yechim — to'rt alohida cron:**

| Vaqt | Route | Ish |
|---|---|---|
| 03:00 | `/api/cron/backup` | Zaxira + bot suhbatlari va rate limit tozalash |
| 04:00 | `/api/cron/billing` | Obuna statuslari + muddat eslatmalari |
| 05:00 | `/api/cron/reports` | Oylik hisobot + kunlik xulosa |
| 06:00 | `/api/cron/tasks` | Takroriy tranzaksiyalar + vazifa eslatmalari |

**Tartib tasodifiy emas:**
- zaxira eng birinchi — keyingi qadamlardan biri yiqilsa ham kunlik nusxa
  olingan bo'ladi;
- obuna statuslari zaxiradan keyin — status o'zgarishi ma'lumotga ta'sir
  qiladi, undan oldingi holat nusxada qolishi kerak;
- takroriylar (har tenant ustidan aylanadigan eng uzun ish) oxirida — u
  timeout bo'lsa ham qolgan uchtasi allaqachon bajarilgan.

**Ishlar route'dan ajratildi** (`src/lib/cron/ishlar.ts`): `zaxiraIshi`,
`billingIshi`, `hisobotIshi`, `vazifaIshi`. Shu bois ular testda HTTP'siz
chaqiriladi. Har qadam `xavfsiz()` bilan o'raladi — bitta qadamdagi xato
guruhning qolganini yiqitmaydi.

**`tenantlarBoylab()`** — har tenantni alohida qo'riqlaydi. Ilgari bitta
tenantdagi buzuq ma'lumot butun aylanishni to'xtatardi va undan keyingi
barcha mijozlar xizmatsiz qolardi.

**`cronGuard()`** — barcha cron route'lari uchun yagona fail-closed
tekshiruv (C-5 dagi tuzatish endi bitta joyda va yangi route'larga ham
avtomatik tarqaladi).

**Eski route saqlandi.** `/api/cron/monthly-report` o'chirilmadi: kimdir
tashqi rejalashtiruvchidan chaqirayotgan bo'lishi mumkin. U avvalgidek
to'rtala ishni ketma-ket bajaradi (timeout xavfi ham avvalgidek) va log'ga
eskirgani haqida ogohlantirish yozadi.

**Fayllar:**
- `src/lib/cron/guard.ts`, `src/lib/cron/ishlar.ts` (yangi)
- `src/app/api/cron/{backup,billing,reports,tasks}/route.ts` (yangi)
- `src/app/api/cron/monthly-report/route.ts` (moslik uchun qayta yozildi)
- `vercel.json` — 4 ta cron
- `README.md` — deploy bo'limida jadval va tartib izohi

**Test:** `tests/cron.test.ts` (10) — guard'ning sirsiz holatda 503
qaytarishi (`"Bearer undefined"` ham o'tmasligi), noto'g'ri/yo'q sarlavhada
401, prefiks mos kelgani yetmasligi, har tenantning o'z kontekstida
ishlashi, bitta tenantdagi xatoning qolganlarini to'xtatmasligi, hamma
yiqilganda ham funksiyaning xato otmasligi, `vercel.json` dagi to'rt
cron'ning mavjudligi va vaqtlari ustma-ust tushmasligi, har yo'l uchun
route faylining guard va `maxDuration` bilan borligi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
32 test to'plami, jami **367 test**, 0 xato.

---

## FAZA 5 / PROMPT 5.2 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] `CRON_SECRET` yo'q bo'lsa 503 (fail-closed), `"Bearer undefined"` o'tmaydi
- [x] Noto'g'ri sir va prefiksi mos keluvchi uzun satr 401
- [x] Har tenant o'z kontekstida ishlaydi
- [x] Bitta tenantdagi xato aylanishni to'xtatmaydi
- [x] `vercel.json` da 4 ta cron, vaqtlari ustma-ust tushmaydi
- [x] Har route'da guard va `maxDuration = 60` bor

**Sizdan kutiladi (real muhitda)**
- [ ] Vercel'da deploy qilgach "Cron Jobs" bo'limida 4 ta yozuv ko'rinsin
- [ ] Har birini qo'lda bir marta chaqirib javobini tekshiring
      (`curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/backup`)
- [ ] `/api/cron/backup` dan keyin Telegram kanalida zaxira fayli paydo bo'ldimi
- [ ] Ertasi kuni 03:00–06:00 oralig'ida to'rtala log'ni ko'rib chiqing
- [ ] Tashqi rejalashtiruvchi ishlatayotgan bo'lsangiz, eski
      `/api/cron/monthly-report` manzilini yangi to'rttaga almashtiring
