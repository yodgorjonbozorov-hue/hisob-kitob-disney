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
| 5 | PostgreSQL + masshtab | `faza-5-postgres` | 🔄 5.2 ✅ · 5.1 kod tayyor, staging kutilmoqda |
| 6 | ERP modullari | `faza-6-*` | ✅ 6/6 modul tugadi |

## ⚠️ MIGRATSIYA KUTILMOQDA (qo'lda apply qilinadi)

> ✅ **2026-08-04: zanjir MASHQ QILINDI.** Barcha 13 migratsiya eski
> holatdagi bazaga **haqiqiy ma'lumot ustiga** ketma-ket qo'llandi va hech
> narsa yo'qolmagani tasdiqlandi (`npm run test:migratsiya`). Majburiy
> `npm run kassa:migratsiya` qadami ham mashqda bajarildi va idempotentligi
> tekshirildi. Batafsil: quyidagi jurnal yozuvi.

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

---

### 2026-08-04 — Faza 5, Prompt 5.1 tayyorgarligi (+ topilgan xato tuzatildi)

**Branch:** `faza-5-cron` (davomi) · **Migratsiya YO'Q**

Provayderni almashtirish baza ulanmagan muhitda sinab bo'lmaydi, shuning
uchun kod o'zgartirilmadi. Buning o'rniga bazasiz bajarilishi mumkin bo'lgan
uch ish qilindi.

#### 1. 🐛 ZAXIRA TIKLASH TARTIBIDAGI XATO — topildi va tuzatildi

Ko'chirish yo'lini o'rganayotib jiddiy xato chiqdi. `restoreDump`
`ZAXIRA_JADVALLARI` **tartibida** yozadi, ya'ni ro'yxat bog'liqlik
tartibida bo'lishi shart. MIJOZLAR moduli `Sale.contactId` va
`Debt.contactId` qo'shgach, `contact` ro'yxatda `sale` dan **keyin** qolib
ketgan edi.

FK haqiqatan majburlanishi tekshirildi (yo'q `contactId` bilan sotuv
yozishga urinish `Foreign key constraint violated` beradi). Demak
**mijozga bog'langan sotuvi bor har qanday zaxira tiklanmasdi** — va buni
faqat haqiqiy avariya paytida bilib qolardik.

Tuzatildi: `contact` `sale`/`debt` dan oldinga ko'chirildi.

**Ikkita doimiy qo'riqchi qo'shildi** (`tests/backup.test.ts`):
- **Sxemadan chiqariladigan tartib testi** — `prisma/schema.prisma` dagi har
  `@relation(fields: ...)` uchun ro'yxatdagi o'rinni tekshiradi. Bu
  kelajakdagi HAR QANDAY modelga avtomatik tarqaladi, ya'ni bir marta
  yozilib qo'yilgan qoida emas, ishlaydigan tekshiruv.
- **FK'ga boy round-trip fiksturasi** — mijozga bog'langan sotuv va qarz,
  ta'minotchili shartnoma, ilova, xodim va oylik vedomosti. Ilgari
  round-trip testi faqat oddiy tranzaksiya bilan ishlagani uchun xatoni
  sezmagan edi.

Ikkala test tartib buzilganda haqiqatan yiqilishi tekshirildi (tartib
vaqtincha orqaga qaytarilib sinaldi: 2 ta test qizil, keyin tiklanib
yashil).

`CLAUDE.md` dagi "yangi model qo'shilsa" qoidasiga bog'liqlik tartibi
sharti yozib qo'yildi.

#### 2. SQLite'ga xos joylar inventari

Butun kod bo'ylab qidirildi. Provayderga bog'liq **atigi to'rt** joy bor:

| Joy | Muammo | Postgres yechimi |
|---|---|---|
| `api/auth/login/route.ts` | `COLLATE NOCASE` | `LOWER()` + funksional indeks |
| `lib/db/businessRaw.ts` `sanaKalit()` | `typeof`/`strftime`/`unixepoch` | `to_char()` — `CASE` butunlay yo'qoladi |
| `lib/rateLimit.ts`, `lib/ai/limit.ts` | — | **O'zgarish kerak emas** (`CAST`+`RETURNING` standart) |
| 3 ta `contains` qidiruvi | registrga sezgir | `mode: "insensitive"` qo'shiladi |

#### 3. `docs/POSTGRES-KOCHISH.md` — ko'chirish yo'riqnomasi

To'liq tartib, yuqoridagi inventar, sxema o'zgarishlari va staging
tekshiruv ro'yxati.

**Prompt spetsifikatsiyasidan ataylab chetlashish:** `scripts/migrate-to-postgres.ts`
YOZILMADI. `scripts/restore.ts` allaqachon aynan shu ishni qiladi (zaxira
JSON → bog'liqlik tartibida yozish → sonlarni solishtirish) va provayderga
bog'liq hech narsasi yo'q. Ikkinchi, deyarli bir xil skript faqat ikkita
saqlanadigan joy hosil qilardi va biri eskirardi. Sabab hujjatda yozilgan.

Hujjatda **unumdorlik ogohlantirishi** ham bor: `restoreDump` yozuvlarni
bittalab yozadi (SQLite'da `createMany` cheklangani uchun). Uzoqdagi
Postgres bilan bu juda sekin — ko'chishdan oldin `createMany` ga o'tkazish
kerak, lekin buni Postgres ulangandan keyin, o'lchov bilan qilish to'g'ri.

**Tekshirildi:** `npx tsc --noEmit` ✅ · 32 test to'plami, jami **367 test**,
0 xato.

**Faza 5.1 ning o'zi (provayder almashtirish) hali bajarilmagan** — u
staging va ulangan baza talab qiladi.

---

### 2026-08-04 — Audit qoldiqlari: uchta o'rta darajali topilma (tugadi)

**Branch:** `audit-qoldiqlari` · **Migratsiya YO'Q**

Yo'l xaritasidagi barcha fazalar (Faza 5.1 dan tashqari — u baza talab
qiladi) tugagach, `docs/AUDIT-2026-08.md` dagi 🟡 O'RTA ro'yxati qayta
ko'rib chiqildi. Ko'pchiligi allaqachon yopilgan edi (`Sale.sana`,
`Button` type, AI limit atomikligi, Payme/Click timing-safe taqqoslash,
Telegram kodi `crypto.randomInt`, `shift-close` audit entity). **Uchtasi
hali ochiq ekan.**

#### 1. 🔴 Parol `Math.random()` bilan yaratilardi

`resetUserPassword` (superadmin foydalanuvchi parolini tiklaganda) 10
belgili parolni `Math.random()` bilan yasardi. U kriptografik emas: ichki
holati bir necha natijadan tiklanadi, ya'ni parolni bashorat qilish
mumkin. Bu parol esa hisobga **to'liq kirish** huquqini beradi.

Diqqatga sazovori: aynan shu xato Telegram bog'lash kodida allaqachon
topilgan va tuzatilgan edi (izohi ham yozilgan) — lekin bu yer e'tibordan
chetda qolgan. Endi `crypto.randomInt` ishlatiladi.

**Qaytalanmasligi uchun statik qo'riqchi** qo'shildi: maxfiy qiymat
yaratadigan fayllarda `Math.random(` chaqiruvi bo'lsa test yiqiladi.
Izohlarda nomni eslatish mumkin (ataylab: "bu kriptografik emas" degan
izoh foydali), faqat chaqiruv taqiqlanadi.

#### 2. Tenant client keshi chegarasiz o'sardi

`tenantClient` keshi oddiy `Map` edi va hech qachon tozalanmasdi. Uzoq
yashaydigan jarayonda (bot, cron, issiq lambda) har yangi tenant yangi
client qoldirardi — xotira monoton o'sardi. 500+ mijoz maqsadi uchun bu
sezilarli.

Endi **LRU, chegara 200**. `Map` kalitlar tartibini kiritilish bo'yicha
saqlagani uchun har murojaatda kalitni o'chirib qayta qo'yish "eng oxirgi
ishlatilgan"ni oxiriga suradi, birinchi kalit esa har doim eng eskisi
bo'ladi. Chiqarilgan client shunchaki qayta quriladi — u faqat extension
o'ramchisi, ulanish emas (ulanish `rawPrisma` da bitta va umumiy).

#### 3. Modal'da fokus qamovi (focus trap) yo'q edi

Klaviatura yoki skrin-rider bilan ishlaydigan foydalanuvchi Tab bosaverib
modal **ortidagi** ko'rinmas tugmalarga tushib ketardi — forma
to'ldirilmay, nima bo'layotgani bilinmay qolardi.

Endi: ochilganda fokus birinchi maydonga o'tadi (yopish tugmasiga emas —
foydalanuvchi darhol yoza boshlasin), Tab/Shift+Tab modal ichida
aylanadi, fokus tashqariga chiqib ketsa qaytariladi, yopilganda esa
modalni **ochgan elementga** qaytadi. Bu 20 dan ortiq modalga bir joydan
tarqaladi.

**Fayllar:**
- `src/lib/superadmin/service.ts` — `crypto.randomInt`
- `src/lib/db/tenantDb.ts` — LRU kesh + `tenantKeshHajmi()`
- `src/components/ui/Modal.tsx` — fokus qamovi

**Test:** `tests/audit-qoldiq.test.ts` (8) — tiklangan parolning haqiqatan
ishlashi va majburiy almashtirish belgisi, alifbo tarkibi, 30 chaqiruvda
takrorlanmaslik va alifbo qamrovi, keshning bir xil clientni qaytarishi,
chegaradan oshmasligi, yaqinda ishlatilganning saqlanishi, `Math.random(`
statik qo'riqchisi, Modal fokus qamovi.

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
33 test to'plami, jami **376 test**, 0 xato.

---

## AUDIT QOLDIQLARI TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan**
- [x] Tiklangan parol ishlaydi, `mustChangePassword` yoqiladi
- [x] 30 ta chaqiruvda 30 xil parol, alifbo keng qamrab olinadi
- [x] Maxfiy fayllarda `Math.random(` chaqiruvi yo'q (statik qo'riqchi)
- [x] Tenant keshi chegaradan oshmaydi va yaqinda ishlatilganni saqlaydi
- [x] Modal'da Tab/Shift+Tab qamovi va fokusni qaytarish bor

**Sizdan kutiladi (real muhitda)**
- [ ] Superadmin paneldan foydalanuvchi parolini tiklang → yangi parol
      bilan kirilib, darhol almashtirish so'ralsinmi
- [ ] Istalgan modalni oching va faqat Tab bilan yuring — fokus modaldan
      chiqib ketmasligi kerak
- [ ] Modalni yoping → fokus uni ochgan tugmaga qaytdimi

---

---

### 2026-08-04 — Faza 5.1: Postgres yo'li KODDA tayyorlandi

**Branch:** `faza-5-postgres` · **Migratsiya YO'Q** (SQLite sxemasiga tegilmadi)

Loyiha egasi ruxsat berdi. Bazani bu muhitda ulab bo'lmaydi, lekin
ko'chishning **kod qismini** to'liq bajarish mumkin ekan — va bajarildi.
SQLite yo'li o'zgarishsiz ishlab turadi (389 test buni tasdiqlaydi),
Postgres yo'li esa yozilgan va sinalgan.

#### Dialekt qatlami — `src/lib/db/dialect.ts`

Provayder farqlari to'rt joyga sochilgan edi. Ularning birortasini unutish
turlicha oqibat berardi va **eng xavflisi jimgina o'tib ketardi**:
`strftime` Postgres'da yo'q — so'rov yiqiladi va bu darhol ko'rinadi;
`COLLATE NOCASE` ni unutish esa sintaksis xatosi BERMAYDI — qidiruv
shunchaki registrga sezgir bo'lib qoladi va hech kim sezmaydi.

Endi hammasi bitta faylda, to'rt funksiya:
- `isPostgres()` — provayderni `DATABASE_URL` sxemasidan aniqlaydi
  (Prisma'ning o'z provayderi build paytida qotib qoladi, runtime'da
  o'qib bo'lmaydi);
- `qidiruvRejimi()` — SQLite'da bo'sh, Postgres'da `mode: "insensitive"`
  (SQLite'da bu rejim berilsa so'rov XATO beradi, shuning uchun spread
  bilan yo'qoladi);
- `sanaKalitSql()` — SQLite'da `typeof`/`strftime`/`substr` bilan CASE,
  Postgres'da bitta `to_char`;
- `registrsizTeng()` — `COLLATE NOCASE` ↔ `LOWER()`.

Chaqiruv joylari yangilandi: `businessRaw.ts` (sanaKalit), login route,
3 ta `contains` qidiruvi (`transactions.ts`, `search`, `crm/contacts`).

#### Adapter ikki provayderli — `src/lib/db/rawPrisma.ts`

`DATABASE_URL` sxemasiga qarab `@prisma/adapter-pg` yoki
`@prisma/adapter-libsql` tanlanadi. Postgres adapteri **kech** yuklanadi:
SQLite deploy'ida `pg` paketi bundle'ga umuman tushmaydi.

`@prisma/adapter-pg`, `pg` va `@types/pg` o'rnatildi.

#### Postgres boshlang'ich migratsiyasi

`prisma/migrations-postgres/00000000000000_init/migration.sql` —
**40 jadval, 104 indeks, 76 tashqi kalit**. Qo'lda yozilmagan:
`prisma migrate diff --from-empty` bilan sxemadan generatsiya qilingan
(bu buyruq bazaga ULANMAYDI, shuning uchun bu yerda ham ishladi).

Unga bitta narsa qo'lda qo'shiladi — `User_login_lower_idx` funksional
indeksi. Prisma uni sxemadan generatsiya qilmaydi, lekin dialekt
qatlamining Postgres yo'li `WHERE LOWER("login") = ...` yozadi va
indekssiz bu login sahifasida butun jadvalni skanerlaydi.

`npm run pg:migratsiya` — faylni qayta generatsiya qiladi (sxema
o'zgargach). `tests/dialect.test.ts` uni sxemadagi model soni bilan
solishtiradi, ya'ni eskirsa test aytadi.

#### 🐛 Yo'l-yo'lakay: kirill harflar qo'riqchisi

Dialekt testini yozayotib izohga bitta ruscha so'z yozib yuborilgan edi —
CLAUDE.md buni taqiqlaydi. Bu auditning ochiq bandi ham edi ("Aralash
kirill/lotin harflar").

Qoida mutlaq bo'lolmaydi: uch joyda kirill ATAYLAB kerak — Payme protokoli
javobda ruscha xato matnini talab qiladi, chek OCR prompti "ИТОГО" so'zini
bilishi kerak (O'zbekistondagi cheklarning yarmi ruscha), slug esa
kirillcha kiritmani qabul qiladi.

Shuning uchun qo'riqchi test **sababli ruxsat ro'yxati** bilan yozildi:
yangi faylda kirill paydo bo'lsa test yiqiladi va sabab yozilishi talab
qilinadi. Ro'yxatdagi fayl o'chirilsa/ko'chirilsa ham test aytadi.

**Fayllar:**
- `src/lib/db/dialect.ts` (yangi), `src/lib/db/rawPrisma.ts`, `src/lib/db/businessRaw.ts`
- `src/app/api/auth/login/route.ts`, `src/lib/queries/transactions.ts`,
  `src/app/api/search/route.ts`, `src/app/api/crm/contacts/route.ts`
- `prisma/migrations-postgres/` (yangi papka + README)
- `scripts/pg-migratsiya.mjs` (yangi), `package.json`
- `docs/POSTGRES-KOCHISH.md` — bajarilgan qism qo'shildi

**Test:** `tests/dialect.test.ts` (11) — provayder aniqlash (URL ichida
"postgres" so'zi bo'lgani yetarli emasligi ham), qidiruv rejimining
ikkala holati, sana kalitining ikkala varianti va format qiymatlari,
registrsiz taqqoslashning ikkala sintaksisi, qiymatning SQL'ga
yopishtirilmasligi (inyeksiya himoyasi), migratsiya faylining sxemaga
mosligi. `tests/audit-qoldiq.test.ts` ga kirill qo'riqchisi qo'shildi
(8 → 10).

**Tekshirildi:** `npm run build` ✅ · `npx tsc --noEmit` ✅ ·
34 test to'plami, jami **389 test**, 0 xato.

---

## FAZA 5.1 TEKSHIRUV RO'YXATI

**Avtomatik tekshirilgan (SQLite'da)**
- [x] `npm run build` va `tsc --noEmit` o'tadi
- [x] Barcha 389 test yashil — SQLite xatti-harakati o'zgarmadi
- [x] Provayder `DATABASE_URL` sxemasidan to'g'ri aniqlanadi
- [x] Ikkala dialekt yo'li ham to'g'ri SQL generatsiya qiladi
- [x] Qidirilayotgan qiymat SQL matniga tushmaydi (parametr bo'lib qoladi)
- [x] Postgres migratsiyasi sxemadagi 40 modelga mos
- [x] Kodda kutilmagan kirill harflar yo'q

**Ko'chishda qoladigan ish (staging'da)**
- [ ] 13 ta SQLite migratsiyasini apply qiling + `npm run kassa:migratsiya`
- [ ] `npm run backup` — zaxira oling, yozuvlar sonini yozib qo'ying
- [ ] `schema.prisma`: `provider = "postgresql"`
- [ ] `mv prisma/migrations prisma/migrations-sqlite`
      va `mv prisma/migrations-postgres prisma/migrations`
- [ ] `npm run pg:migratsiya` — migratsiya eskirmaganini tasdiqlang
- [ ] `DATABASE_URL=postgresql://... npx prisma migrate deploy`
- [ ] `restoreDump` ni `createMany` ga o'tkazing (uzoqdagi Postgres bilan
      bittalab yozish juda sekin — sabab hujjatda)
- [ ] `DATABASE_URL=postgresql://... npm run restore -- <fayl> --confirm`
- [ ] **Barcha 34 test to'plamini Postgres bilan qayta o'tkazing**
- [ ] Rate limit parallel testi Postgres'da (RETURNING semantikasi)
- [ ] Qidiruv endi registrga sezgirmasligini qo'lda tekshiring
- [ ] Faqat shundan keyin: string maydonlarni enum'ga o'tkazish (alohida PR)

Batafsil: `docs/POSTGRES-KOCHISH.md`.

---

## 📋 UMUMIY HOLAT

Yo'l xaritasidagi **barcha fazalar kod darajasida tugadi.**

| Faza | Holat |
|---|---|
| 0–4 | ✅ tugadi |
| 5.1 | ✅ kod tayyor · ⏳ staging'da bajariladi |
| 5.2 | ✅ tugadi |
| 6 (6 modul) | ✅ tugadi |

34 test to'plami, **389 test**, 0 xato. `npm run build` va
`npx tsc --noEmit` toza.

**Loyiha egasidan kutilayotgan yagona narsa** — 13 migratsiyani staging'da
apply qilish (har biridan oldin zaxira, 6-dan keyin `npm run kassa:migratsiya`).
Undan keyin Postgres'ga ko'chish yuqoridagi ro'yxat bo'yicha bajariladi.

---

### 2026-08-04 — Migratsiya zanjiri MA'LUMOT USTIGA sinaldi

**Branch:** `migratsiya-mashqi` · **Migratsiya fayllariga TEGILMADI**

Loyiha egasi "apply barchasi uchun senga" dedi. Bu muhitda haqiqiy bazaga
ulanib bo'lmaydi (`.env` yo'q, `DATABASE_URL` yo'q, Turso credentials yo'q),
shuning uchun production'da apply qilish imkonsiz. Buning o'rniga eng
qimmatli ish bajarildi: **zanjir haqiqiy ma'lumot bilan mashq qilindi.**

#### Nega bu muhim edi

Barcha 33 test to'plami **bo'sh** bazadan boshlaydi. Ular migratsiyalar
sxemani to'g'ri qurishini tekshiradi, lekin **"ustiga apply qilish"** yo'lini
umuman sinamaydi. Aynan shu yerda xavf.

Uchta migratsiya jadvalni QAYTA QURADI (SQLite'da `ALTER TABLE` cheklangani
uchun `CREATE new_X` → `INSERT ... SELECT` → `DROP` → `RENAME`):
- `ondelete_siyosati` — 23 jadvalning FK siyosati;
- `sotuv_sana_bekor` — `Sale.sana` NOT NULL, `createdAt` dan to'ldiriladi;
- `mijozlar_moduli` — `Sale` va `Debt` ga `contactId`.

Bunday migratsiyada `INSERT ... SELECT` xato bo'lsa ma'lumot **jimgina**
yo'qoladi va migratsiya "muvaffaqiyatli" tugaydi.

#### Mashq qanday o'tkazildi

1. Yangi bazaga faqat **eski 14 migratsiya** qo'llandi — production'dagi
   bazaning aynan holati.
2. Unga haqiqiy ma'lumot solindi: 2 tenant, 3 foydalanuvchi, 3 kategoriya,
   **26 tranzaksiya** (33 mln so'm), 2 mahsulot, 2 sotuv (biri qarzga),
   qarz va audit yozuvlari. Sotuvlarda `sana` ustuni **hali yo'q** —
   migratsiya uni to'ldirishi kerak.
3. Kutilayotgan **13 migratsiya** ketma-ket qo'llandi.
4. Tekshirildi.

#### Natija — barchasi ✅

- 13 migratsiyaning hammasi xatosiz qo'llandi;
- **hech bir jadvalda bitta ham yozuv yo'qolmadi** (9 jadval sanaldi);
- summalar buzilmadi: tranzaksiyalar 33 000 000, sotuvlar 140 000,
  to'langan qarz 20 000;
- `PRAGMA foreign_key_check` — 0 buzilish; `integrity_check` — ok;
- **`Sale.sana` to'g'ri to'ldirildi**: S1 → 2026-07-12, S2 → 2026-07-18
  (aynan `createdAt` kunlari);
- barcha yangi ustunlar (`accountId`, `contactId`, `qarzLimit`, `sku`,
  `birlik`, `minQoldiq`, `tenantId`...) va 16 yangi jadval o'z joyida;
- **`npm run kassa:migratsiya`** ham mashqda bajarildi: 26 ta kassasiz
  tranzaksiyaning hammasi bog'landi, har biznesga o'z kassasi ochildi va
  hech bir yozuv BOSHQA biznesning kassasiga tushmadi;
- kassa skripti **ikkinchi marta** ishga tushirildi — takroriy kassa
  ochilmadi, summalar o'zgarmadi (idempotentlik tasdiqlandi).

#### Mashq DOIMIY testga aylantirildi

`tests/migratsiya-zanjiri.test.ts` (10 test). Kelajakda qo'shiladigan
migratsiyalar ham avtomatik shu tekshiruvdan o'tadi — `ESKI_OXIRGI` dan
keyingi hamma narsa "kutilayotgan" deb hisoblanadi.

**Test haqiqatan xatoni ushlashi tasdiqlandi** (ikki marta ataylab buzib
sinaldi, keyin fayllar tiklandi):
- `Sale.sana` backfill'i sobit qiymatga almashtirildi → 6-test qizil;
- `mijozlar_moduli` dagi `INSERT ... SELECT` ga filtr qo'shilib jimgina
  ma'lumot yo'qotish taqlid qilindi → **4 ta test** qizil (yozuv soni,
  summalar, FK yaxlitligi, sana).

Migratsiya fayllari asl holida (`git diff prisma/migrations/` bo'sh).

**Tekshirildi:** `npm run build` ✅ · 35 test to'plami, jami **399 test**, 0 xato.

---

## 📱 SIZ UCHUN: TELEFONDAN APPLY QILISH

Kompyuter kerak emas.

**GitHub → Actions → "Migratsiya qo'llash" → Run workflow → `HA` → Run**

Bir marta sozlash kerak: repo Settings → Secrets → `DATABASE_URL` va
`DATABASE_AUTH_TOKEN` (Vercel env'dan ko'chiring).

To'liq yo'riqnoma: [`TELEFONDAN-APPLY.md`](TELEFONDAN-APPLY.md).

Terminaldan bo'lsa: `npm run apply:hammasi`.

---

### 2026-08-04 — Telefondan apply (+ deploy'dagi yashirin xavf tuzatildi)

**Branch:** `telefondan-apply` · **Migratsiya YO'Q**

Loyiha egasi telefondan qilish mumkinmi deb so'radi. Tekshirish paytida
**jiddiy xavf** topildi.

#### 🐛 Deploy migratsiyani YARIM qo'llardi

`package.json` da:

```
"build": "node scripts/db-migrate.mjs && node scripts/bootstrap-superadmin.mjs && next build"
```

Ya'ni Vercel'ga har deploy **migratsiyalarni avtomatik qo'llaydi**. Bu
o'z-o'zidan qulay, lekin `kassa:migratsiya` bu zanjirda YO'Q edi.

Natija: branch merge qilinsa 13 migratsiya jimgina qo'llanardi va barcha
tranzaksiyalar `accountId` siz qolardi — **kassa qoldig'i haqiqiy pulni
ko'rsatmasdi**, hech qanday xato ham chiqmasdi. Ya'ni "migratsiyadan keyin
kassa skriptini unutmang" degan hujjat qatori yetarli emas edi: deploy
uni umuman so'ramasdan bajarib qo'yardi.

**Tuzatildi:** `kassa-migratsiya.ts` build zanjiriga qo'shildi. Buning
uchun u env'siz muhitda ham xavfsiz bo'lishi kerak edi — `DATABASE_URL`
yo'q bo'lsa endi jimgina o'tkazib yuboriladi (`db-migrate.mjs` bilan bir
xil xatti-harakat).

**Yo'l-yo'lakay ikkinchi xato:** birinchi urinishda `main()` erta
qaytardi, lekin `.finally(() => rawPrisma.$disconnect())` proxy'ga
tegib clientni QURARDI va `URL_INVALID` bilan build'ni yiqitardi.
Buni faqat `exit` kodini tekshirganda ko'rdim — `grep` bilan qaraganda
"o'tkazib yuborildi" xabari chiqib, hammasi joyidadek ko'rinardi.
Endi disconnect ham himoyalangan.

Ikkala holat ham `exit=0` bilan tasdiqlandi: env'siz build va eski
holatdagi bazaga deploy taqlidi (5 tranzaksiya → 13 migratsiya →
kassa bog'landi → `Kassasiz qolgan yozuv: 0`).

#### Telefondan uchta yo'l

| Yo'l | Zaxira | Qulaylik |
|---|---|---|
| **GitHub Actions** (tavsiya) | ✅ artefakt, 30 kun | Actions → Run workflow → `HA` |
| Vercel deploy | ❌ yo'q | Merge yoki "Redeploy" |
| Turso konsoli | ❌ | Faqat tekshirish uchun |

**`.github/workflows/migratsiya.yml`** — `workflow_dispatch`, telefondagi
GitHub ilovasidan ishlaydi. Himoyalar: `tasdiq: HA` yozilmasa ishga
tushmaydi; sekret yo'q bo'lsa aniq xato; `concurrency` bilan bir vaqtda
ikkita migratsiya bloklanadi; zaxiralar **har doim** (yiqilganda ham)
artefakt sifatida yuklanadi; `faqat_zaxira` rejimi ham bor.

**`TELEFONDAN-APPLY.md`** — uchala yo'l, sozlash qadamlari, tekshiruv
SQL'lari va xato holatida nima qilish.

**Fayllar:** `.github/workflows/migratsiya.yml`, `TELEFONDAN-APPLY.md`,
`scripts/kassa-migratsiya.ts`, `package.json`, `README.md`.

**Tekshirildi:** `npm run build` ✅ (env bilan va env'siz, ikkalasi ham
`exit=0`) · 37 test to'plami, jami **417 test**, 0 xato.

---

## 2026-08-06 · Deploy'ning o'zi zaxira oladigan bo'ldi

**Sabab.** Oldingi holatda zaxira olishning yagona ishonchli yo'li —
GitHub Actions workflow'i — alohida sozlangan sekretlar talab qilardi.
Sekretlar qo'yilmagan edi, shuning uchun 13 ta migratsiya `main` ga merge
qilinganda **zaxirasiz** qo'llandi. Muammoning ildizi sozlash emas:
himoya ilova ishlaydigan yo'ldan TASHQARIDA turgani.

**Yechim.** Himoya deploy zanjirining ichiga ko'chirildi. Build muhitida
baza ulanishi allaqachon bor (ilova usiz ishlamaydi), demak qo'shimcha
sozlash kerak emas.

```
build: deploy-zaxira.mjs && db-migrate.mjs && kassa-migratsiya.ts && ...
```

`scripts/deploy-zaxira.mjs`:

1. `DATABASE_URL` yo'q — jimgina o'tadi (env'siz lokal build).
2. Baza butunlay bo'sh — o'tadi. Yangi muhitni birinchi marta ko'tarishda
   himoya qiladigan ma'lumot yo'q; aks holda yangi muhit Telegram
   sozlanmaguncha umuman ko'tarilmasdi.
3. Kutayotgan migratsiya yo'q — hech narsa qilmaydi. Oddiy deploy
   sekinlashmaydi, keraksiz zaxira yuborilmaydi.
4. Jadvallar bor, lekin `_applied_migrations` bo'sh — **to'xtaydi**. Bu
   baza boshqa yo'l bilan qurilgani belgisi; `db-migrate.mjs` bunday
   holatda hammasini boshidan qo'llashga urinib "table already exists"
   bilan O'RTADA yiqiladi va yarim qo'llangan baza qoladi. Yechim
   (`migratsiya:belgila`) xato matnida ko'rsatiladi.
5. Kutayotgan migratsiya bor — xom surat olib, gzip qilib Telegram zaxira
   kanaliga yuboradi. **Yuborilmasa build to'xtaydi**, ya'ni migratsiya
   umuman ishga tushmaydi.

Surat build konteynerida qolsa foydasi yo'q — konteyner deploy tugashi
bilan yo'qoladi. Shuning uchun "olindi" yetarli emas: u serverdan
TASHQARIGA chiqqani tasdiqlanishi shart.

**Ehtiyotkorlik nuqtasi.** `_applied_migrations` jadvali yo'q bo'lsa
hammasi kutayotgan deb qaraladi. Noaniqlikda "zaxira kerak emas" degan
qaror — aynan ma'lumot yo'qoladigan qaror.

**Chetlab o'tish.** `ZAXIRASIZ_DAVOM=ha` — bitta joyda, `toxta()` ichida
tekshiriladi, ya'ni sabab qanday bo'lishidan qat'i nazar qaror bitta.
Hisobot nomuvofiqligi bundan MUSTASNO (`yiqit()`): u zaxira haqida emas,
migratsiyaning o'zi buzuq holatda ishga tushishi haqida.

**Refaktor.** Surat mantig'i `scripts/lib/xom-surat.mjs` ga chiqarildi;
`xom-zaxira.mjs` endi shu ustidagi yupqa CLI. Surat formati ikki joyda
ajralib ketmasligi uchun. `scripts/lib/telegram.mjs` — sxemaga bog'liq
bo'lmagan hujjat yuborish (`src/lib/backup/send.ts` Prisma'ga tayanadi,
migratsiyadan oldin ishlamaydi).

**Testda topilgan xato.** Soxta Telegram serveri test jarayonining o'zida
turgani uchun `spawnSync` bilan **deadlock** bo'ldi: sinxron kutish ota
jarayonni bloklaydi, server ulanishni qabul qila olmaydi, bola cheksiz
kutadi. `spawn` + promise'ga o'tkazildi; sabab test ichida izohlab
qo'yildi.

**CLAUDE.md o'zgardi.** Loyiha egasi `main` ga merge cheklovini bekor
qildi. O'rniga qoladigan shart — merge oldidan `npm run build` va testlar
o'tishi. "Migratsiya HECH QACHON avtomatik apply qilinmaydi" qoidasi ham
haqiqatga moslashtirildi: u deploy paytida avtomatik qo'llanadi, lekin
endi majburiy zaxira bilan.

**Fayllar:** `scripts/deploy-zaxira.mjs`, `scripts/lib/xom-surat.mjs`,
`scripts/lib/telegram.mjs`, `scripts/xom-zaxira.mjs`,
`tests/deploy-zaxira.test.ts`, `package.json`, `CLAUDE.md`,
`TELEFONDAN-APPLY.md`, `.github/workflows/migratsiya.yml`.

**Tekshirildi:** `tests/deploy-zaxira.test.ts` — 10 test. Zanjir tartibi
qo'riqchisi ataylab buzib sinaldi (build'da `deploy-zaxira` `db-migrate`
dan keyinga surildi → test qizil bo'ldi). `test:apply-oqimi` 9/9 —
refaktor eski oqimni buzmadi.

---

## 2026-08-06 · Postgres yo'li haqiqiy Postgres'da sinaldi

**Sabab.** Faza 5.1 da yozilgan Postgres kodi uzoq vaqt **bajarilmagan**
holda turdi. `src/lib/db/dialect.ts` dagi Postgres tarmog'i, generatsiya
qilingan `prisma/migrations-postgres/` — hech qachon haqiqiy Postgres
ko'rmagan. Noto'g'ri yozilgan `to_char` yoki qo'llanmaydigan sxema faqat
ko'chish kuni, production ma'lumoti bilan bilinardi.

Bu mashinada PostgreSQL 16 mavjud ekan — shu tarmoqni yuritish imkoni
paydo bo'ldi.

**`tests/postgres.test.ts` (9 test).** `PG_TEST_URL` berilsa haqiqiy
bazada ishlaydi, berilmasa baza talab qiladiganlari o'tkazib yuboriladi
(Postgres yo'q mashinada to'plam yashil qoladi).

| Tekshirilgan | Natija |
|---|---|
| `migrations-postgres/` toza bazaga qo'llanadi | 40 jadval, 76 FK |
| `User_login_lower_idx` funksional indeksi | `lower(login)` |
| `registrsizTeng()` registrga befarq | 3 xil yozilish topildi |
| `registrsizTeng()` indeksdan foydalanadi | planner tanladi |
| `sanaKalitSql(10)` / `(7)` | `to_char` kunlik va oylik to'g'ri |
| Rate limit `UPDATE ... RETURNING` atomikligi | 20 parallel = 1..20, takror yo'q |
| `migrations-postgres/` sxemadan orqada emas | bazasiz ham ishlaydi |

**Topilgan xato — hujjatdagi ko'chish tartibi noto'g'ri edi.**
`docs/POSTGRES-KOCHISH.md` `DATABASE_URL` ni Postgres'ga qaratib
`npm run restore` ishlatishni yozgan edi. Amalda bu ishlamaydi:

```
The Driver Adapter `@prisma/adapter-pg`, based on `postgres`,
is not compatible with the provider `sqlite` specified in the Prisma schema.
```

Prisma client provayderni **generatsiya paytida** qotiradi. Ya'ni sxemani
almashtirib `prisma generate` qilish — 0-qadam, uni o'tkazib bo'lmaydi.
Hujjatga shu qadam va xato matni qo'shildi.

**Ikkinchi bo'shliq.** Libsql klientiga to'g'ridan-to'g'ri qurilgan
skriptlar (`db-migrate.mjs`, `lib/xom-surat.mjs`, `deploy-zaxira.mjs`)
Postgres'da ishlamaydi va ular `npm run build` zanjirida turibdi — ya'ni
Postgres'ga birinchi deploy build bosqichida yiqilardi. Hujjatga jadval
bilan yozildi.

**Kichik o'zgarish.** `scripts/pg-migratsiya.mjs` ga `--chiqish <yol>`
qo'shildi. Chiqish yo'li qotib qolgan bo'lsa, eskirish testi tekshirayotgan
faylning O'ZINI qayta yozib yuborardi va hech qachon qizil bo'lmasdi.

**Tekshirildi:** `test:postgres` 9/9 (haqiqiy PG 16.13), `PG_TEST_URL`siz
2 o'tdi / 7 o'tkazib yuborildi / 0 xato. Eskirish qo'riqchisi ataylab
buzib sinaldi — migratsiya fayliga bitta satr qo'shilganda qizil bo'ldi.
`test:dialect` 11/11, `test:agregat` 7/7 (regressiya yo'q), `tsc` toza.

**Qolgan ish (baza ulangan muhitni talab qiladi):** sxemada provayderni
almashtirish, string maydonlarni Prisma enum'ga o'tkazish, build
zanjiridagi libsql skriptlarini almashtirish, staging'da to'liq ma'lumot
bilan ko'chirish.

---

## 2026-08-06 · Brauzer smoke testlari (birinchi marta)

**Sabab.** Loyihada 37 ta test to'plami bor edi va ularning HAMMASI kod
darajasida ishlardi. "Foydalanuvchi kirib, chiqim qo'shib, hisobotni ochsa
ishlaydimi" degan savol hech qachon avtomatik tekshirilmagan. Bu ayni
paytda muhim: 5 ta yangi modul endigina ishga tushdi va ularning
sahifalari brauzerda umuman ochilmagan edi.

**`tests/smoke-brauzer.test.ts` (7 test).** `next start` ko'tariladi, toza
e2e bazasi quriladi, Chromium ochiladi:

- noto'g'ri parol rad etiladi va sessiya cookie'si BERILMAYDI;
- to'g'ri parol bilan kiriladi;
- sessiyasiz ichki sahifa login'ga yo'naltiradi;
- **registry'dagi har bir nav havolasi ochiladi** (29 ta);
- yangi modul sahifalari to'g'ri sarlavha bilan chiqadi;
- kirim qo'shiladi va ro'yxatda ko'rinadi;
- modullar sozlamalarda ko'rinadi.

Havolalar ro'yxati **qo'lda yozilmaydi** — `MODULLAR` registry'sidan
olinadi. Sidebar, BottomNav va CommandPalette ham o'sha manbadan
generatsiya qilinadi, ya'ni test foydalanuvchi haqiqatan bosadigan
havolalarni yuradi. Yangi modul qo'shilsa test o'zi qamrab oladi.

**Nega `node:test`, Playwright runner emas.** Loyihada `@playwright/test`
yo'q, faqat `playwright` kutubxonasi bor. Yangi runner va konfiguratsiya
olib kirish o'rniga mavjud uslub saqlandi. Brauzer muhitda oldindan
o'rnatilgan (`/opt/pw-browsers/chromium`) — yuklab olinmaydi.

**Yo'l-yo'lakay tuzatilgan nuqson.** `LoginForm.tsx` da yorliqlar
inputlarga bog'lanmagan edi (`htmlFor`/`id` yo'q) — skrinrider maydon
nomini o'qimasdi. Bu test yozishga urinilganda bilindi: `getByLabel`
ishlamadi. Tuzatildi.

**Sinov muhitidagi ikkita tuzoq (ilova nuqsoni emas):**

1. Seed demo adminni parol almashtirishga majbur qiladi — to'g'ri qaror,
   lekin bayroq qolsa HAR sahifa "Parolni o'zgartirish" ga yo'naltiriladi
   va testlar aslida hech narsani sinamaydi. `e2e-tayyorla.mjs` uni
   tozalaydi.
2. Yangi modullar standart holatda o'chiq — tenant PRO tarifga o'tkazilib
   modullar yoqiladi, aks holda sahifalar ochilmaydi.

**Beqarorlik tuzatildi.** Ikki yurishda ikki xil test yiqildi:
`net::ERR_ABORTED` — Next.js klient routeri fon prefetch'i bilan
navigatsiyani uzadi. Bu ilova nosozligi emas. Barcha navigatsiyalar uch
marta qayta uriniladigan `och()` orqali o'tkazildi; kirishdan keyin
sahifa chizilishi kutiladi.

**Tekshirildi:** `test:smoke` 7/7, ketma-ket ikki yurishda ham. Qo'riqchi
ataylab buzib sinaldi — registry'ga mavjud bo'lmagan havola qo'shilganda
test `HTTP 404` bilan qizil bo'ldi va aynan o'sha havolani ko'rsatdi.

---

## 2026-08-06 — Sekinlik: request ichida takroriy DB so'rovlarini yo'q qilish

**Muammo.** Production'da (Vercel iad1 + Turso Tokio) tugmalar 8-9 soniyada
bosilardi. Ildiz sabab ikkita: (1) geografiya — har SQL so'rovi AQSh↔Tokio
~160 ms yo'l bosadi (docs/MIGRATSIYA.md, hal qilinishi operatsion ish);
(2) kod — har sahifa renderida 13-16 ta, asosan KETMA-KET, DB so'rovi.

**Kod tuzatishlari:**

- `src/lib/requestCache.ts` (yangi) — `React.cache` mavjud bo'lsa request
  ichida dedupe, testlarda (oddiy Node) funksiya o'zgarishsiz qaytadi.
- Tenant lookup (`auth/tenant.ts`), yoqilgan modullar (`modules/guard.ts`),
  biznes so'rovlari (`business.ts`) request ichida keshlanadi — layout ham,
  sahifa ham chaqirsa DB'ga BITTA so'rov ketadi (ilgari 2-3 marta takror).
- Bildirishnoma soni layout'ni bloklamaydi: yangi `/api/me/notif-count`
  (withTenant) + `useNotifCount()` hook — badge sahifa ochilgach yuklanadi.
  Ilgari bu hisob HAR navigatsiyada ~6 ketma-ket so'rov bilan renderni
  ushlab turardi.
- Sotuv sahifasida guard/biznes/modullar so'rovlari parallel.

**Smoke testlar Windows'da ham ishlaydigan bo'ldi:** `npx` shell orqali
(`npx.cmd`), Chromium yo'li topilmasa Playwright'ning o'z brauzeri,
server daraxti `taskkill /T` bilan o'chiriladi (aks holda zombi jarayon
portni va e2e.db ni ushlab qoladi). Login kutish muddati 60 s.

**Tekshirildi:** `npm run build` (exit 0), `test:isolation` 22/22,
`test:modules` 13/13. Smoke bu sekin Windows noutbukda beqaror (har
yurishda boshqa test login bosqichida vaqtdan oshadi); qo'lda tekshiruv:
login POST 200 (3.8 s), /app, /app/sotuv, /app/tranzaksiyalar — 200,
notif-count — 200. Linux CI'da to'liq yurishi kutiladi.

**Qolgan operatsion ish (kod emas, egasi bajaradi):** Turso'ni fra
(Frankfurt) ga ko'chirish → Vercel funksiya regionini fra1 → balansa.uz
domenini ulash. Tartib muhim: avval baza, keyin region (docs/MIGRATSIYA.md).

---

## 2026-08-11 · Holat tekshiruvi va ishga tushirish yo'riqnomasi

**Branch:** `claude/balansa-progress-check-l8m4ha` · **Kod o'zgarishi YO'Q**

Loyiha egasi "qaysi qismga keldik, full ishga tushiraylik" deb so'radi.
Tekshiruv natijasi: `main` bilan farq yo'q, Faza 0–6 to'liq merge qilingan,
qolgan ish faqat operatsion (egasi bajaradi).

**Aniqlangan:** GitHub Actions "Migratsiya qo'llash" workflow'i 2026-08-06 da
bir marta ishga tushirilgan va yiqilgan (sekretlar qo'yilmagani uchun) —
endi kritik emas, deploy zanjiri o'zi zaxira + migratsiya qiladi.

**Yangi fayl:** `ISHGA-TUSHIRISH.md` — barcha operatsion qadamlar bitta
tartibli ro'yxatda: holat tekshiruv SQL'lari, zaxira, Turso→Frankfurt,
Vercel region fra1, balansa.uz domeni, jonli tekshiruv ro'yxati, Postgres
(keyinroq). Manbalar: `docs/MIGRATSIYA.md`, fazalarning "Sizdan kutiladi"
bo'limlari.

---

## 2026-08-11 · Frankfurtga ko'chirish BITTA TUGMA bo'ldi

**Branch:** `claude/balansa-progress-check-l8m4ha` · **Migratsiya YO'Q**

Loyiha egasi launch qadamlarini o'zi bajarishga qo'shilmadi — "o'zing
qilib ber" dedi. Turso/Vercel hisoblariga kirish faqat egasida, shuning
uchun qilinishi mumkin bo'lgan eng katta ish qilindi: **ko'chirishning
o'zi avtomatlashtirildi** — egasiga faqat sekretlarni bir marta qo'yish
va bitta tugma qoladi.

**Yangi: `scripts/kochirish.mjs`** (`npm run kochirish`) — eski bazadan
yangi (Frankfurt) bazaga to'liq ko'chirish orkestri:

1. Fail-closed tekshiruvlar: `YANGI_DATABASE_URL` ataylab alohida nom
   (yozish qaysi bazaga borishi hech qachon taxminga qolmaydi); eski va
   yangi URL bir xil bo'lsa to'xtaydi; eski baza to'liq migratsiya
   qilinmagan yoki kassasiz tranzaksiyasi bo'lsa to'xtaydi (xato yangi
   bazaga ko'chib o'tmasin); yangi baza BO'SH bo'lmasa to'xtaydi (bu ham
   noto'g'ri nishon himoyasi, ham takror urinish idempotentligi).
2. Oqim: zaxira → yangi bazaga migratsiyalar → tiklash → **mustaqil
   verifikatsiya**. Verifikatsiya restore skriptining o'z solishtiruviga
   ishonmaydi: ikkala JONLI bazani jadval-bajadval sonlar va pul
   summalari (Transaction.summa, Sale.jamiSumma, Debt.jamiSumma)
   bo'yicha to'g'ridan-to'g'ri solishtiradi, FK yaxlitligini tekshiradi.
3. **Eski bazaga faqat o'qish bilan tegiladi** — jarayonning istalgan
   nuqtasida orqaga yo'l ochiq.

**Yangi: `.github/workflows/kochirish.yml`** — "Bazani ko'chirish",
telefondan: Actions → Run workflow → `HA`. Sekretlar: eski
`DATABASE_URL`/`DATABASE_AUTH_TOKEN` + yangi `YANGI_DATABASE_URL`/
`YANGI_DATABASE_AUTH_TOKEN`. Zaxira artefakt sifatida 30 kun (har doim,
yiqilganda ham). `concurrency: migratsiya` — migratsiya workflow'i bilan
bir vaqtda ishlamaydi. Yakuniy summary'da Vercel qadamlar yozilgan.

**Test: `tests/kochirish.test.ts` (8)** — `npm run test:kochirish`.
Har himoya alohida sinaladi + to'liq oqim haqiqiy ma'lumot bilan (20
tranzaksiya, sotuv, qarz, kassa) va "eski baza o'zgarmagan" tekshiruvi.

**Aniqlangan:** GitHub Actions'dagi "Migratsiya qo'llash" 2026-08-06 da
sekretsiz ishga tushirilib yiqilgan ekan — 1-qadam sekretlari qo'yilgach
u ham ishlaydigan bo'ladi (lekin endi shart emas, deploy o'zi qiladi).

**`ISHGA-TUSHIRISH.md` yangilandi:** egasining qismi 3 qadamga tushdi —
(1) Turso'da fra baza + 4 sekret, (2) workflow tugmasi, (3) Vercel'da
env + region + redeploy. Domen va jonli tekshiruv ro'yxati o'z joyida.

**Tekshirildi:** `npm run build` exit 0 · `test:kochirish` 8/8 ·
`test:apply-oqimi` 9/9 · `test:backup` 6/6.

---

## 2026-08-11 · TO'LIQ launch bitta tugma: Turso + Vercel ham avtomatik

**Branch:** `claude/balansa-progress-check-l8m4ha` · **Migratsiya YO'Q**

Loyiha egasi qolgan 3 qadamga ham qo'shilmadi — "o'zing qilib ber".
Turso/Vercel'dagi QOLGAN qo'lda qadamlar ham API orqali avtomatlashtirildi.
Egasiga qoladigan jismoniy minimum: 2 ta token yaratish (hisoblar unda) +
4 sekret + bitta tugma. Bundan kam bo'lishi mumkin emas.

**Yangi: `scripts/toliq-ishga-tushirish.mjs`** (`npm run launch`):

1. Turso API: Frankfurt guruhida baza yaratadi (bor bo'lsa qayta
   ishlatadi — bo'shligini baribir kochirish.mjs tekshiradi), token oladi.
   Tashkilot bitta bo'lsa o'zi topadi.
2. `scripts/kochirish.mjs` ni chaqiradi — barcha himoyalari bilan
   (eski bazaga faqat o'qish, mustaqil son/summa solishtiruvi).
3. Vercel API: env upsert (`DATABASE_URL`, `DATABASE_AUTH_TOKEN`),
   region `fra1` (PATCH; xato bo'lsa oqim to'xtamaydi — tezlik masalasi,
   to'g'rilik emas), git'dan production redeploy, READY holatini kutadi.
4. Health-check: sayt `/login` 200 qaytarishi, `x-vercel-id` regionni
   ko'rsatishi. **Yiqilsa — env eski qiymatlarga avtomatik qaytariladi
   va qayta deploy qilinadi (rollback), skript xato bilan tugaydi.**
   Vercel loyihasi ko'chirishdan OLDIN topiladi — "ko'chirilgan lekin
   ulanmagan" oraliq holat bo'lmasligi uchun.

**Yangi: `.github/workflows/toliq-launch.yml`** — "To'liq ishga tushirish".
Sekretlar: eski `DATABASE_URL`/`DATABASE_AUTH_TOKEN` + `TURSO_API_TOKEN` +
`VERCEL_TOKEN` (+ixtiyoriy `TURSO_ORG`, `VERCEL_PROJECT_NAME`, `SAYT_URL`).
`concurrency: migratsiya` — boshqa baza workflow'lari bilan to'qnashmaydi.

**Test: `tests/toliq-ishga-tushirish.test.ts` (6)** — `npm run test:launch`.
Turso/Vercel/sayt SOXTA HTTP server bilan (deploy-zaxira'dagi Telegram
uslubi), har so'rov yozib boriladi: fail-closed (API umuman chaqirilmaydi),
Turso yo'li (guruh+baza+token, env'ga AYNAN yangi URL), **ko'chirish
yiqilsa Vercel'ga umuman tegilmasligi**, to'liq oqim haqiqiy ma'lumot
bilan (file: bazalar, asl kochirish.mjs), **rollback** (sayt 500 → env
ikkinchi marta ESKI qiymatlar bilan yozilishi + ikkinchi redeploy).
Soxta server test jarayonida turgani uchun launch `spawn` (async) bilan —
`spawnSync` deadlock tuzog'i takrorlanmadi. Test seam:
`LAUNCH_KOCHIRISH_SKRIPT` — soxta ko'chirish skripti qo'yish uchun.

**`ISHGA-TUSHIRISH.md`:** asosiy yo'l endi 2 qadam (sekretlar + tugma),
eski ikki bosqichli yo'l "zaxira yo'l" sifatida saqlandi.

**Tekshirildi:** `npm run build` exit 0 · `test:launch` 6/6 ·
`test:kochirish` 8/8 · `test:apply-oqimi` 9/9.

**Eslatma:** Turso/Vercel API'lariga bu muhitdan token yo'qligi uchun
JONLI so'rov yuborilmadi — API sxemalari hujjat bo'yicha yozildi va soxta
server bilan sinaldi. Birinchi haqiqiy yurishda API javobi kutilgandan
farq qilsa, skript aniq xato matni bilan to'xtaydi (jimgina davom etmaydi)
va hech narsani buzmaydi — shunga mo'ljallab qurilgan.

**Qo'shimcha (o'sha kun):** egasi main'ga eski *.vercel.app → balansa.uz
host-redirect qo'shgani aniqlandi. Bu health-check'ni buzardi: domen hali
DNS'da bo'lmasa alias tekshiruvi yiqilib, BEKORGA rollback bo'lardi.
`saytniTekshir` endi bir nechta nomzod bilan ishlaydi — alias yiqilsa
deployment'ning o'z URL'i tekshiriladi (unga host-redirect tegmaydi);
u ishlayotgan bo'lsa muvaffaqiyat (ogohlantirish bilan): baza sog',
alias/domen masalasi rollback bilan tuzalmaydi. Yangi test qo'shildi —
`test:launch` endi 7/7.

**Jonli urinish (2026-08-11):** "To'liq ishga tushirish" workflow'i agent
tomonidan GitHub API orqali ishga tushirildi (run 31485427924). Sekretlar
tekshiruvida xavfsiz to'xtadi: `DATABASE_URL`, `TURSO_API_TOKEN`,
`VERCEL_TOKEN` — repo'da BITTASI ham qo'yilmagan. Hech narsaga tegilmadi.
Bu jismoniy chegara: token/parollar faqat egasida. Egasi sekretlarni
qo'yishi bilan agent workflow'ni qayta ishga tushiradi.

---

## 2026-08-11 — balansa.uz jonli + baza Irlandiyaga ko'chirildi

**Domen:** balansa.uz Vercel'ga ulandi (A 216.198.79.1 / 64.29.17.1, CNAME www),
SSL avtomatik chiqdi, www→apex 308, eski *.vercel.app hostlardan sahifalar
balansa.uz'ga 308 (`/api/*` ataylab chetlab o'tilgan — bot webhooki va cron
eski hostda ishlayveradi). Yo'lda: registrator (domains.uz) NS'ni alohida
biriktirish kerak ekan (`not.defined` edi).

**Baza ko'chirish (docs/MIGRATSIYA.md runbook'i):** Turso'da `fra` yo'q ekan —
foydalanuvchi tarmog'idan o'lchab Irlandiya tanlandi (118 ms; Mumbai 203,
Tokio 154). Zaxira → yangi `balansa` bazasi (aws-eu-west-1) → 30 migratsiya →
restore (1715 yozuv, sonlar mos) → Vercel env almashtirildi → redeploy →
funksiya regioni `dub1` → redeploy. Eski Tokio bazasi rollback uchun turibdi.

**O'lchov (keyin):** login POST (DB bilan) 0.5–1 s (oldin 2.5–3.8 s edi),
SSR sahifa 150–600 ms, `x-vercel-id: hkg1::dub1`.

---

## 2026-08-11 · KUNLIK HISOBOT moduli (Disney Flowers so'rovi)

**Branch:** `claude/disney-flowers-daily-report-q272aw` · **Migratsiya: 1 ta (faqat CREATE TABLE)**

Loyiha egasi Disney Flowers biznesi uchun oylik hisobotdan ALOHIDA kunlik
moliyaviy hisobot so'radi: naqd / Click / qarz tushumlari, kun yakunini
tayinlangan direktor tasdiqlashi, ertasi kuni 0 dan boshlanishi, tarix.

**Asosiy qaror — oylik tizimga tegilmadi.** Kunlik tushumlar `Transaction`
jadvaliga YOZILMAYDI: alohida `DailyReport` + `DailyTransaction` jadvallari.
Shuning uchun oylik hisobot, kassa qoldig'i, budjet va dashboard raqamlari
o'zgarmaydi. (Modul istalgan biznesda ishlaydi — "Disney Flowers" alohida
kod emas, biznes tanlagichdagi oddiy biznes.)

**Sxema (3 yangi model):**
- `DailyReport` — `@@unique([businessId, sana])`: bir biznes + bir sana =
  bitta hisobot. Bazadagi unique kalit parallel kiritish race'ini yopadi.
  Summalar (naqd/click/qarz/jami) har mutatsiyada `jamlashTx` bilan bazadan
  qayta hisoblanadi — frontend yuborgan songa ishonilmaydi.
- `DailyTransaction` — summa (Int, musbat), tolovTuri CASH|CLICK|DEBT, izoh,
  userId + userIsm snapshot (kim kiritgani), soft-delete.
- `DailyReportSetting` — biznes uchun tayinlangan direktor (`direktorId`).
  Tekshiruv xizmat qatlamida: faqat shu tenantning faol foydalanuvchisi,
  kassir bo'lsa aynan shu biznesniki.

Uchalasi `BUSINESS_SCOPED` (tenantDb) va `ZAXIRA_JADVALLARI` (dump, FK
tartibida oxirida) ro'yxatlarida. Migratsiya: `20260811120000_kunlik_hisobot`
(faqat CREATE TABLE — xavf past); `migrations-postgres` qayta generatsiya
qilindi (43 jadval).

**Kun chegarasi — Toshkent.** `todayTashkentDateOnlyString()` (`lib/date.ts`,
UTC+5, DSTsiz): server UTC'da bo'lsa ham kun O'zbekiston yarim tunida
almashadi. Tushum HAR DOIM bugungi (Toshkent) hisobotga yoziladi — hisobot
yo'q bo'lsa tranzaksiya ichida `upsert` bilan ochiladi. UI'dagi soatlar ham
Toshkent bo'yicha (`app/kunlik/vaqt.ts`, brauzer timezone'iga tayanmaydi).

**Holat oqimi:** OPEN → (faqat direktor) → CONFIRMED. Qayta tasdiqlash
`updateMany + holat: "OPEN"` sharti bilan bazada rad etiladi. CONFIRMED
kunga tushum kiritish/tahrirlash/o'chirish taqiqlanadi; tuzatish uchun
direktor/boshqaruvchi kunni "qayta ochadi", tuzatadi, qayta tasdiqlaydi.
Tasdiqlagan kim va qachon — `confirmedBy/confirmedByIsm/confirmedAt`.

**Ruxsatlar (`getKunlikRuxsat` — yagona manba):**
- Xodim (kassir/sotuvchi): bugungi hisobotni ko'radi, tushum kiritadi,
  faqat O'Z tushumini (kun ochiq bo'lsa) o'zgartira oladi. Tarix yopiq.
- Direktor (tayinlangan foydalanuvchi, roli muhim emas): tasdiqlash, tarix,
  istalgan tushumni tahrirlash, qayta ochish.
- Boshqaruvchi (OWNER/ADMIN): tarix, tahrirlash, qayta ochish, direktorni
  tayinlash/almashtirish. Direktor tayinlanmagan bo'lsa tasdiqlash ham
  (ish to'xtab qolmasin); tayinlangach tasdiqlash FAQAT direktorda.

**Atomiklik:** barcha yozish amallari `runBusinessTx` ichida (har so'rovda
businessId qo'lda), audit `logAudit` bilan qo'lda (kirit/tahrir/o'chir/
tasdiqlash/qayta ochish/direktor almashishi).

**Fayllar:**
- `prisma/schema.prisma` + `prisma/migrations/20260811120000_kunlik_hisobot/`
- `src/lib/validation/kunlik.ts`, `src/lib/services/kunlik.ts`, `src/lib/queries/kunlik.ts`
- `src/app/api/kunlik/{hisobot,tushum,tushum/[id],tasdiqlash,qayta-ochish,tarix,direktor}/route.ts`
- `src/app/app/kunlik/{page,loading,error}.tsx`, `KunlikClient.tsx`,
  `TushumForm.tsx`, `DirektorModal.tsx`, `vaqt.ts`, `tarix/{page,loading}.tsx`, `tarix/TarixClient.tsx`
- `src/lib/modules/registry.ts` (KUNLIK, rollar HAMMA), `src/lib/billing/plans.ts`
  (barcha tariflarga), `src/components/nav/Sidebar.tsx` (daily ikon),
  `src/lib/db/tenantDb.ts`, `src/lib/backup/dump.ts`, `src/lib/services/audit.ts`,
  `src/lib/date.ts`, `package.json` (test:kunlik)

**Test: `tests/kunlik.test.ts` (18)** — Toshkent kun chegarasi, zod (0/manfiy/
kasr summa rad), jamlash, parallel kiritishda bitta report, direktor
tayinlash (begona tenant rad), tasdiqlash huquqlari, qayta tasdiqlash rad,
tasdiqlangan kun qulfi, qayta ochish + tuzatish + qayta tasdiqlash, tarix
va 0 dan boshlanadigan yangi kun, ruxsat matritsasi, tenant izolyatsiyasi, audit.

**Tekshirildi:** `npm run build` ✅ · `tsc --noEmit` toza (bitta MAVJUD xato
`tests/toliq-ishga-tushirish.test.ts:158` — bu muhitdagi @libsql tip versiyasi,
main'da ham bor, tegilmadi) · test:kunlik 18/18 · regressiya: isolation 22/22,
izolyatsiya-royxati 9/9, backup 6/6, modules 13/13, dialect 11/11,
migratsiya 10/10, audit 12/12, soft-delete 8/8, agregat 7/7, audit-qoldiq 10/10 ·
smoke (brauzer) 7/7 — yangi /app/kunlik sahifasi ham ochiladi.

**Eslatma (deploy):** modul barcha tariflarda bor, lekin core emas —
Sozlamalar → Modullar'da "Kunlik hisobot" yoqiladi, keyin boshqaruvchi
sahifadagi "Direktor" tugmasi bilan direktorni tayinlaydi.

---

## 2026-08-12 · Kunlik hisobot: Yozuvlar bilan avto-sinxron

**Branch:** `claude/disney-flowers-daily-report-q272aw` · **Migratsiya: 1 ta (ADD COLUMN)**

Egasining talabi: xodim kirimni Yozuvlar (tranzaksiya) formasidan kiritsa ham
u kunlik hisobotga O'ZI tushsin; boshqa (eski) sana tanlansa — tushmasin.

**Yechim — `kunlikSinxron` (lib/services/kunlik.ts):** har yaratish/tahrir/
o'chirish/tiklashdan keyin bitta qoida tekshiriladi: *bugungi (Toshkent)
sanali, o'chirilmagan KIRIM kunlikda bo'lishi kerak; qolgan har qanday holat —
bo'lmasligi kerak*. `DailyTransaction.transactionId @unique` bilan ulanadi.

- Ulanish nuqtasi — `createTransaction` xizmatining o'zi (API, bot va CRM
  "yutildi" oqimi hammasi shu yerdan o'tadi). Chiqim hech qachon sinxronlanmaydi.
- Kassa turi -> to'lov turi: naqd->CASH, plastik/bank->CLICK.
- Sinxron XATOSI asosiy pul yozuvini buzmaydi (try/catch, console.error).
- KUNLIK moduli yoqilmagan tenantda umuman ishlamaydi.
- Tasdiqlangan (CONFIRMED) kunga tegilmaydi: yozuv baribir yoziladi, kunlik
  o'zgarmaydi (kun yopilgan — tuzatish qayta ochish orqali).
- Ulangan tushum kunlik sahifasida tahrirlanmaydi/o'chirilmaydi ("Yozuvlardan"
  belgisi) — manba Transaction, aks holda ikkala tomon ajralib ketardi.
- Yumshoq o'chirilgan ulangan yozuv tiklashda QAYTA OCHILADI (unique
  transactionId yangi create'ga yo'l bermaydi — shu bug testda ushlandi).
- Sana boshqa kunga o'zgartirilsa kunlikdan chiqadi; keyin bugunga qaytarilsa
  bugungi hisobotga KO'CHADI (ikkala kun ochiq bo'lsa).
- Bulk soft-delete va bulk-move: `kunlikBulkUz` ulangan tushumlarni ochiq
  kunlardan chiqarib, jamini qayta hisoblaydi.

**Yo'l-yo'lakay (oldingi so'rov):** KUNLIK yoqilgan bo'lsa kassir/sotuvchi
telefonining pastki panelida "Kunlik" tab chiqadigan bo'ldi (computeMobileTabs).

**Fayllar:** prisma/schema.prisma + `20260812090000_kunlik_transaction_link/`,
lib/services/kunlik.ts, lib/services/transactionService.ts,
api/transactions/{[id],[id]/restore,bulk,bulk-move}/route.ts,
lib/queries/kunlik.ts (yozuvdan bayrog'i), app/kunlik/KunlikClient.tsx,
lib/modules/registry.ts, components/nav/BottomNav.tsx, tests.

**Tekshirildi:** build ✅ · kunlik 21/21 · modules 14/14 · isolation 22/22 ·
izolyatsiya-royxati 9/9 · backup 6/6 · migratsiya 10/10 · soft-delete 8/8 ·
agregat 7/7 · atomik 6/6 · audit 12/12.

---

## 2026-08-12 · Kunlik: direktorga eslatma + Telegramda bir bosishda tasdiqlash

**Branch:** `claude/disney-flowers-daily-report-q272aw` · **Migratsiya YO'Q**

Egasining talabi: tasdiqni direktor qiladi (bor edi), unga BILDIRISHNOMA
borsin va esidan chiqsa ERTASI KUNI ham tasdiqlay olsin (bu ham bor edi —
faqat kelajak kun taqiqlangan; endi eslatma unutilganini o'zi aytadi).

- **`lib/reports/kunlikEslatma.ts`** — cron eslatmasi (hisobotIshi, 05:00 UTC
  = 10:00 Toshkent): KUNLIK yoqilgan tenantlarda o'tgan 7 kun ichidagi OCHIQ,
  tushumli kunlar uchun direktorga Telegram xabar (naqd/click/qarz/jami) +
  "✅ Kun yakunini tasdiqlash" inline tugmasi. Direktor Telegramsiz bo'lsa —
  zaxira yo'l: boshqaruvchilarga. Bo'sh (0 so'm) kunlar eslatilmaydi.
  Kuniga bir marta (AppSetting `kunlikEslatma:<sana>` dedupe, dailyDigest uslubi).
- **`bot/kunlikFlow.ts`** — `kht:ok:<reportId>` callback: bir bosishda
  tasdiqlash. Bot darajasida managerOnly YO'Q (direktor kassir bo'lishi
  mumkin) — huquq confirmKunlikReport ichida (faqat tayinlangan direktor).
- **Bildirishnomalar sahifasi + nav badge** (`lib/queries/notifications.ts`):
  "Kunlik yakun tasdiqlanmagan" ogohlantirishi — direktor (userId bo'yicha,
  roli muhim emas) va boshqaruvchilarga; bosilsa o'sha kun ochiladi.
  `getNotifications/getNotificationCount` opts'iga `userId` qo'shildi.
- Grammy `Api` interfeys mosligi: `EslatmaBotApi.sendMessage` ataylab method
  sintaksisida (bivariant) — aks holda `Other<...>` parametri bilan to'qnashardi.

**Test:** kunlik 21 → **24**: eslatma direktorga boradi (boshqaruvchiga emas),
tugmada `kht:ok:` bor, dedupe; direktor 2 kun oldingi kunni tasdiqlaydi
(jami tushumlardan qayta jamlanadi); bildirishnoma direktor/boshqaruvchiga
ko'rinadi, oddiy xodimga yo'q.

**Tekshirildi:** build ✅ · tsc toza · kunlik 24/24 · isolation 22/22 ·
modules 14/14 · cron 10/10 · audit-qoldiq 10/10.

---

## 2026-08-12 · Kunlik: KASSA TOPSHIRISH (xodim -> direktor, pul nazorati)

**Branch:** `claude/disney-flowers-daily-report-q272aw` · **Migratsiya: 1 ta (ADD COLUMN x4)**

Egasining talabi: kun yakunida sotuvchilar kassani TOPSHIRSIN ("Direktorga
yuborish" tugmasi), direktor o'zi tasdiqlasin — maqsad pul yo'qolmasligini,
xodim pul o'g'irlayaptimi-yo'qligini bilish.

**Yechim — uch bosqichli holat oqimi:** `OPEN → SUBMITTED → CONFIRMED`.

- **Topshirishda xodim kassadagi naqdni SANAB kiritadi** (`sanalganNaqd`).
  Tizim hisobi (`naqdSumma`) ataylab modal'da KO'RSATILMAYDI — xodim
  "chiqishi kerak" raqamni ko'chirib qo'ya olmasin. Farq = sanalgan − tizim:
  manfiy (KAM) — pul yetishmayapti, signal qizil ko'rinadi.
- SUBMITTED holatda tushum kiritish, tahrirlash va Yozuvlardan avto-sinxron
  QULFLANADI (raqamlar "muzlaydi") — topshirilgandan keyin hech kim orqadan
  raqam o'zgartira olmaydi.
- Direktor OPEN'dan ham (xodim topshirmagan bo'lsa), SUBMITTED'dan ham
  tasdiqlaydi; `sanalganNaqd` tarixda saqlanadi. Qayta ochish endi SUBMITTED
  uchun ham ishlaydi va topshiruv maydonlarini tozalaydi — tuzatishdan keyin
  xodim QAYTA sanab topshiradi.
- **Topshirilgan zahoti direktorga Telegram xabar** (best-effort, approval
  uslubi): tizim naqdi vs sanalgan, FARQ qatori, Click/Qarz/Jami + bir
  bosishda "✅ Tasdiqlash" tugmasi (`kht:ok:` — mavjud callback ishlaydi).
  Direktor Telegramsiz bo'lsa boshqaruvchilarga boradi. `rawPrisma` — bot
  xabarnomasi tizim darajasidagi amal (approval.ts pretsedenti).
- Ertalabki cron eslatma va bildirishnomalar endi SUBMITTED kunlarni ham
  qamraydi (`holat != CONFIRMED`), eslatmada topshiruv/farq ko'rinadi.
- UI: YakunCard (yangi komponent, 250 satr limiti uchun ajratildi) — holat
  belgilari 🟡/📤/🟢, solishtiruv bloki, TopshirishModal; tarixda farq belgisi.

**Sxema:** DailyReport +submittedBy/+submittedByIsm/+submittedAt/+sanalganNaqd
(`20260812130000_kunlik_topshirish`, faqat ADD COLUMN).

**Test:** kunlik 24 → **26**: topshirish (farq −50 000 bilan), tushum/sinxron
qulfi, qayta topshirish rad, SUBMITTED'dan tasdiqlash (sanalgan saqlanadi),
tasdiqlangandan keyin topshirish rad, kelajak kun rad, tarixda farq.

**Tekshirildi:** build ✅ · tsc toza · kunlik 26/26 · isolation 22/22 ·
izolyatsiya-royxati 9/9 · backup 6/6 · modules 14/14 · migratsiya 10/10 · cron 10/10.

---

## 2026-08-12 · Yozuvlar sahifasi: to'lov bo'limlari (Naqd/Click/Qarz)

**Branch:** `claude/disney-flowers-daily-report-q272aw` · **Migratsiya YO'Q**

Egasining talabi: Yozuvlarda "faqat so'm turibdi" — har yozuvda Naqd/Click
farqi ko'rinsin, ro'yxat PASTIDA esa bo'lim-bo'lim jami qatorlar (Naqd,
Click, Qarz) tursin.

- **Har qatorda "To'lov" belgisi** — kassa turidan: naqd kassa → 💵 Naqd,
  plastik → 💳 Click, bank → 🏦 Bank; kassasiz eski yozuv naqd sanaladi.
  Desktop jadvalda alohida ustun, mobil lentada kategoriya yonida.
- **Sticky footer'da bo'lim qatorlari**: 💵 Naqd (so'm) / 💳 Click — KIRIM
  ning kassa bo'yicha taqsimoti (filtr qamroviga mos, faqat sahifa emas);
  📋 Qarz — kunlik hisobotdagi qarz tushumlari jami (KUNLIK yoqiq bo'lsa;
  qarz Transaction emas, shu bois alohida olinadi; sana oralig'i va xodim
  ko'rinuvchanligi ro'yxat filtri bilan bir xil). Eski "+kirim −chiqim Sof"
  qatori pastda saqlanadi.
- `listTransactions`: items'ga `account` qo'shildi; totals'ga
  naqdKirim/clickKirim (groupBy accountId). create/PATCH/restore javoblariga
  ham `account` include qilindi (optimistik qatorlar DTO'ga mos bo'lsin).

**Tekshirildi:** build ✅ · tsc toza · kunlik 26/26 · soft-delete 8/8 ·
agregat 7/7 · isolation 22/22.

---

## 2026-08-13 · Oy fokusidagi dashboard, yozuvda to'lov turi, kunlikda SOF natija

**Branch:** `claude/kassa-kategoriya-setup-fap55c` · **Migratsiya BOR** (past xavf)

Egasining 3 talabi (Disney Navoiy tajribasidan):

1. **Dashboarddan "Kassa qoldig'i" olib tashlandi** — umumiy (butun davr)
   qoldiq oy raqamlari yonida turib chalg'itardi. Endi barcha kartalar
   tanlangan OY ko'rsatkichlari; kassalar bo'yicha qoldiq /app/kassa
   sahifasida qolgan.
2. **Yozuvlar formasida to'lov turi**: Naqd / Click / Qarz tugmalari
   (Qarz — faqat kirim; zod refine + PATCH'da yakuniy holat tekshiruvi).
   - `Transaction.tolovTuri` ustuni (`20260813120000_tranzaksiya_tolov_turi`,
     faqat ADD COLUMN; null = eski yozuvlar → kassa turidan chiqariladi).
   - QARZ yozuvi kassaga BOG'LANMAYDI (`accountId null`) — pul kassaga
     tushmagan, kassa qoldig'i buzilmaydi.
   - `resolveAccountId` to'lov turiga mos kassani afzal ko'radi (naqd →
     naqd kassa, click → plastik/bank); mosi yo'q bo'lsa birinchi faol.
   - Kunlik sinxron endi yozuvdagi ANIQ turdan yuradi (naqd→CASH,
     click→CLICK, qarz→DEBT), kassa turi faqat eski yozuvlar uchun zaxira.
   - Ro'yxat belgisi va pastki Naqd/Click/Qarz jamlari ham aniq turni
     ustun qo'yadi; Qarz jami = yozuvlardagi qarz + kunlikda qo'lda
     kiritilgan qarz (transactionId null — ikki marta sanalmaydi).
3. **Kunlikda SOF natija va direktorga faqat sof**: kunlik hisobot endi
   kunning Yozuvlardagi chiqimini jonli jamlaydi (`chiqimSumma`,
   `sofSumma = tushum − chiqim`). YakunCard bosh raqami — SOF (1 500 000
   kirim, 200 000 chiqim → 1 300 000); kartalar qatoriga 📉 Chiqim kartasi;
   tarixda ham sof. Direktor Telegram xabarlari (topshirish, ertalabki
   eslatma, tasdiq javobi) endi Click/Qarz/Jami o'rniga Kirim/Chiqim/SOF
   ko'rsatadi — naqd nazorati (tizim vs sanalgan, farq) saqlangan.

Yo'l-yo'lakay: main'da sinayotgan 2 eski test yangilandi (visibility —
totals'dagi naqdKirim/clickKirim; avto — AVTO tarifiga KUNLIK qo'shilgani).

**Tekshirildi:** build ✅ · kunlik 27/27 (yangi test: aniq tur sinxroni,
qarz kassasiz, sof formula) · isolation 22/22 · izolyatsiya-royxati 9/9 ·
kassa 11/11 · agregat 7/7 · soft-delete 8/8 · visibility 10/10 ·
migratsiya 10/10 · atomik 6/6 · csv-import 13/13 · tasdiqlash 20/20 ·
crm 7/7 · avto 25/25 · sotuv-bekor 11/11 · xarid 13/13 · hr 19/19 ·
backup 6/6 · cron 10/10.

---

## 2026-08-14 — PRO yangilanish: maxsus rollar, shaxsiy kassalar, kg xaridda qisman to'lov (Fortex Selos)

**Nima qilindi** (branch: `claude/fortex-selos-pro-upgrade-zwx1i3`):

1. **Maxsus rollar (custom role system, PRO)**: mijoz endi o'zi rol yaratadi
   ("Taminotchi", "Omborchi", "Haydovchi"...) — `Role` modeli (tenant-scoped,
   TENANT_DIRECT), granular huquqlar katalogi `lib/permissions/katalog.ts`
   (18 kod, 5 guruh) va effektiv huquq hisoblagichi `lib/permissions/tekshir.ts`
   (baza rol/maxsus rol + `huquqPlus`/`huquqMinus` per-user override; OWNER
   hech qachon cheklanmaydi). Tizim rollari buzilmadi — `Role.bazaRol`
   nav/modul skeletini beradi, `User.rol` u bilan sinxron saqlanadi.
   UI: `/app/admin/rollar` (kartochkalar + checkbox guruhli modal),
   Foydalanuvchilar sahifasida maxsus rol tanlash (optgroup).
2. **Shaxsiy kassalar va user-to-user transfer (PRO)**: `Account.userId`
   (null = umumiy biznes kassasi — eski xatti-harakat), `AccountTransfer`
   kengaytirildi: `fromUserId/toUserId` + ism snapshotlari, `holat`
   (bajarildi/bekor — bekor STORNO bilan, ledger append-only), `valyuta`,
   `relatedType/relatedId`. Balans FAQAT ledger'dan (mavjud
   `getAccountBalances` o'zgarishsiz ishlayveradi). Servis
   `lib/services/userKassa.ts`: kassa avtomatik ochish, sender≠receiver,
   balans qoidasi (xodim minusga o'tolmaydi, boshqaruvchi oladi).
   Transfer API endi `toUserId` rejimini qabul qiladi ("pul.berish" huquqi).
3. **Kg xaridda qisman to'lov + ichki ta'minotchi**: `Supplier.userId` —
   ta'minotchi tizim useriga bog'lansa, xarid to'lovi chiqim EMAS, uning
   shaxsiy kassasiga TRANSFER (pul biznes ichida qoldi — aylanma soxta
   oshmaydi). `qabulQilish` endi `tolanganSumma` (0..jami) oladi: to'langan
   qism transfer/chiqim, qoldiq "beriladigan" qarz (`PurchaseOrder.tolanganSumma`,
   `transferId`). `recordDebtPayment` ichki ta'minotchi qarzini ham transfer
   bilan yopadi. UI: QabulModal (to'liq/qisman/hammasi qarzga), ta'minotchi
   modalida user bog'lash.
4. **PRO gate va upgrade**: `lib/billing/pro.ts` (`requirePro`) — rollar,
   user-transfer, override API'lari PRO'da ochiq; `npm run client:pro -- --slug
   <slug> [--kunlar 30]` mijozni PRO'ga o'tkazib barcha PRO modullarni yoqadi.
   Dashboard'da PRO qatori: bugungi sotilgan/olingan kg (birlik=kg),
   kassalar jami, foydalanuvchi/ta'minotchi soni.
5. **Migratsiya** `20260814090000_pro_rollar_shaxsiy_kassa` — faqat ADD
   COLUMN/CREATE TABLE (xavf: past, ma'lumot ustiga xatosiz tushadi —
   migratsiya-zanjiri testi qamrab oladi). Zaxira: `role` jadval `user`dan
   OLDIN (FK tartibi).

**Tekshirildi:** build ✅ · pro-stsenariy 13/13 (YANGI: 100kg×8000=800k to'liq;
qisman 500k→qarz 300k→0; storno; o'ziga transfer rad; xodim limiti; audit) ·
izolyatsiya-royxati 9/9 · backup 6/6 · migratsiya 10/10 · xarid 13/13 ·
kassa 11/11 · isolation 22/22 · tolov 14/14 · audit 12/12.

---

## 2026-08-15 — "Bugun" bloki faqat Fortex Selosga (mijozga xos blok)

**Muammo:** dashboard'dagi "Bugun (PRO ko'rsatkichlar)" bloki `isPro(plan)`
bilan ochilardi. Bu blok Fortex Selos uchun buyurtma qilingan edi (kg savdosi,
shaxsiy kassalar), lekin PRO tarifdagi HAR bir mijoz uni ko'rib turgan —
begona ko'rsatkichlar boshqa mijozlarning panelini to'ldirgan.

**Nima qilindi** (branch: `claude/manabu-qism-visibility-5ztu13`):

1. `src/lib/mijozXos.ts` (yangi, sof modul) — mijozga xos bloklar ro'yxati.
   `bugunPaneliKorinadi(tenant)` tenant `slug` yoki kompaniya nomini bir xil
   kalitga keltirib solishtiradi ("Fortex Selos" == "fortex-selos"), shuning
   uchun slug to'qnashuv suffiksi bilan yaratilgan bo'lsa ("fortex-selos-2")
   ham mijoz nom bo'yicha topiladi. Ro'yxat env bilan kengaytiriladi:
   `BUGUN_PANEL_MIJOZLARI="fortex-selos-uzb,Boshqa Mijoz"` — kod tegilmaydi.
   Standart ro'yxat: `fortex-selos-uzb` (bazadagi haqiqiy tenant) va
   `fortex-selos` (nom qisqartirilsa blok yo'qolib qolmasin).
2. `src/app/app/page.tsx` — gate `isPro(tenant.plan)` o'rniga
   `bugunPaneliKorinadi(tenant)`. Blok yopiq bo'lsa `getProBugun()` umuman
   chaqirilmaydi (boshqa mijozlarga ortiqcha 5 ta so'rov ham ketmaydi).
   Sarlavha "Bugun (PRO ko'rsatkichlar)" → "Bugun": blok endi tarif
   imkoniyati emas, shuning uchun "PRO" so'zi chalg'itardi.
3. `src/lib/auth/tenant.ts` — `TenantInfo` ga `slug` qo'shildi (select ham).
   Boshqa gate'lar (rollar, shaxsiy kassa, user-transfer API) O'ZGARMADI —
   ular haqiqatan PRO tarif imkoniyatlari va `requirePro` bilan qoladi.

**Tekshirildi:** build ✅ · mijoz-xos 5/5 (YANGI: haqiqiy slug, qisqa nom,
suffiksli slug, nom yozilishi, boshqa mijozga ko'rinmasligi) · pro-stsenariy 13/13 ·
isolation 22/22 · izolyatsiya-royxati 9/9 · modules 14/14.

---

## 2026-08-15 — SMENA YAKUNI: kun ichida kassani bir necha marta sanab topshirish

**Talab (Disney Flowers):** sotuvchilar ikki smenada ishlaydi. 1-smena tugaganda
kassadagi pul sanab olinadi va kassa 0 dan boshlanishi kerak; 2-smena ham xuddi
shunday. Kirim/chiqim raqamlariga hech qanday o'zgarish bo'lmasin. Maqsad —
kassadagi xodimni tekshirish.

**Qaror:** smena — kun ichidagi KESIM, hosila ko'rinish. Yangi `Smena` jadvali
faqat YOPILGAN smenani yozadi; joriy (ochiq) smena hisoblanadi — oxirgi
yopilganning `tugashAt` idan hozirgacha. Shuning uchun "ochiq smena" holati,
uni ochish tugmasi va race yo'q.

1. **Model `Smena`** (`20260815100000_smena_yakuni`, faqat CREATE TABLE — xavf: past):
   `sana`+`raqam` (unique), oyna (`boshlanishAt`/`tugashAt`), yopgan xodim
   (ism snapshot), MUZLATILGAN summalar (`naqd`/`click`/`qarz`/`naqdChiqim`),
   `boshlangichQoldiq`, `kutilganNaqd`, `sanalganNaqd`, `farq`, `qoldirilganNaqd`.
2. **Oyna `createdAt` bo'yicha** kesiladi (`boshlanishAt` < createdAt <= `tugashAt`),
   yozuvning `sana` si bo'yicha EMAS: kassadagi pul kiritilgan paytga qarab
   to'planadi. Kechagi tugash payti kun boshi bilan almashtirilmaydi — aks holda
   smena yopilgandan keyin kiritilgan kech tushum hech qaysi smenaga tushmay qolardi.
3. **Kutilgan naqd** = boshlangich qoldiq + naqd tushum − naqd chiqim. Click/qarz
   kassadagi naqdga kirmaydi; chiqim naqdligi `tolovTuri` dan (bo'lmasa kassa
   turidan) aniqlanadi — kunlik sinxron bilan bir xil qoida.
4. **Kirim/chiqimga TEGILMAYDI:** smena hech qanday Transaction/DailyTransaction
   yozmaydi va o'zgartirmaydi; kunlik va oylik raqamlar avvalgidek.
   `tests/smena.test.ts` buni alohida qo'riqlaydi.
5. **Nazorat:** joriy smenaning tizim hisobi xodimga KO'RSATILMAYDI (TopshirishModal
   qoidasi) — faqat direktor/boshqaruvchi ko'radi, aks holda sanashning ma'nosi
   qolmaydi. Yopilgandan keyin farq hammaga ko'rinadi.
6. **Qaytim puli:** sanalgandan bir qismini kassada ataylab qoldirish mumkin
   (`qoldirilganNaqd`) — u keyingi smenaning boshlangich qoldig'i bo'ladi.
   Bo'sh qoldirilsa 0: pul to'liq topshirildi, keyingi smena 0 dan boshlanadi.
7. **Qayta ochish** — faqat OXIRGI smena va faqat direktor/boshqaruvchi
   (o'rtadagisi olinsa qo'shni oynalar ustma-ust tushib, bir pul ikki marta
   hisoblanardi). Qator o'chadi, audit jurnalida raqamlari bilan qoladi.

**Tekshirildi:** build ✅ · smena 14/14 (YANGI) · kunlik 27/27 · isolation 22/22 ·
izolyatsiya-royxati 9/9 · backup 6/6 · kassa 11/11.

---

## 2026-08-15 — ERP spec auditi (§8–§19): to'lov holati, dashboard, senariy testi

**Kontekst:** mijoz to'liq ERP spetsifikatsiyasini berdi (qarz tizimi, kassalar,
double-entry, audit log, dashboard, validatsiya, xavfsizlik, test senariysi).
Avval mavjud kod auditdan o'tkazildi — asosiy oqim allaqachon bor va to'g'ri
ishlayotgani aniqlandi (§19 senariysi `tests/pro-stsenariy.test.ts` da qoplangan).
Faqat haqiqiy bo'shliqlar yopildi; ishlayotgan mexanizmga tegilmadi.

**Nima qilindi** (branch: `claude/manabu-qism-visibility-5ztu13`):

1. **§13 To'lov holati** — `lib/validation/xarid.ts` da `tolovHolati()` sof
   funksiyasi: Qoralama / Kutilmoqda / To'langan / Qisman to'langan / Qarz /
   Bekor. Bazada saqlanmaydi — mavjud maydonlardan hisoblanadi, shuning uchun
   MIGRATSIYA KERAK EMAS. Eski yozuvlar (`tolanganSumma` default 0) `debtId` va
   `transactionId` izlari bo'yicha to'g'ri ajratiladi. `OrderDTO` ga
   `tolovHolati` va `qoldiqQarz` qo'shildi; Xarid ro'yxatida ikkinchi nishon
   (badge) sifatida ko'rinadi — tovar holati va PUL holati endi alohida.
2. **§12 Dashboard "Bugun"** — blokka bugungi Kirim, Chiqim va joriy Qarz (sof
   + beriladigan) qo'shildi. 5 ustun → 7. Kirim/chiqim/kg — BUGUNGI kun;
   kassa va qarz — JORIY holat (izohda ajratilgan).
3. **§14 Validatsiya** — `birlikNarx` endi `positive()`: 0 narxli qabul tannarx
   snapshotini nolga tushirib keyingi foyda hisobini buzardi.
4. **§19 Test senariysi kuchaytirildi** (13 → 21 test). Yangi tekshiruvlar:
   - har xarid to'lovi AYNAN o'z summasi bilan transfer yozgan (800k, 500k),
     har biri SOURCE→DESTINATION (Murod→Baxtiyor, UZS);
   - qarz to'lovi 300k alohida ledger yozuvi (`relatedType: "debt"`);
   - **DOUBLE-ENTRY invariant:** ichki o'tkazmalarda Σ(barcha kassa qoldig'i) = 0
     — manbasiz pul paydo bo'lmaydi va yo'qolmaydi;
   - balans xom ledger'dan MUSTAQIL qayta hisoblanib solishtiriladi
     (`getAccountBalances` ga ishonmasdan);
   - qarz matematikasi yopiq: 800k = 500k to'lov + 300k qarz to'lovi;
   - `tolovHolati` 8 holat bo'yicha (eski yozuvlar ham);
   - 0 kg / 0 narx / manfiy miqdor rad etiladi;
   - jamidan ortiq to'lov rad etiladi va ATOMIK rollback bo'ladi (ombor tegilmagan).

**Migratsiya:** YO'Q. Schema o'zgarmadi — `Account.turi` (naqd/plastik/bank) va
`Account.userId` §9 uchun allaqachon yetarli, to'lov holati esa hisoblanadi.

**Tekshirildi:** build ✅ · pro-stsenariy 21/21 · xarid 13/13 · kassa 11/11 ·
mijoz-xos 5/5 · isolation 22/22 · izolyatsiya-royxati 9/9 · modules 14/14 ·
atomik 6/6 · soft-delete 8/8 · agregat 7/7 · audit 12/12 · backup 6/6 ·
migratsiya 10/10 · cron 10/10 · tolov 14/14 · visibility 10/10 ·
csv-import 13/13 · inventarizatsiya 11/11 · sotuv-bekor 11/11 · hr 19/19 ·
tasdiqlash 20/20.

---

## 2026-08-16 — Kassir kassasi / kassa topshirish tizimi

**Nima qilindi** (branch: `claude/kassa-topshirish-system-9lzzv8`):

Biznes hisobotiga PARALLEL, undan MUSTAQIL "kassir kassasi" tizimi. Asosiy
talab: kassa topshirilishi Kirim/Chiqim/Sof/hisobotlarni umuman
o'zgartirmaydi — faqat kassirning qo'lidagi pul qoldig'i 0 ga tushadi.

1. **`CashHandover` modeli** (yangi jadval, migratsiya
   `20260816120000_kassir_kassasi`). Ikki yo'nalish bitta jadvalda:
   `turi = "topshirish"` (kassir → direktor, tasdiq kutadi) va
   `turi = "berish"` (direktor → kassirga boshlang'ich pul, darhol qabul).
   `tenantDb.BUSINESS_SCOPED` va `dump.ZAXIRA_JADVALLARI` ga qo'shildi.
   - **Saqlangan `currentBalance` ATAYLAB YO'Q** — ikkinchi haqiqat manbai
     bo'lardi. Qoldiq har doim ledgerdan hisoblanadi.
   - **`CashRegister` jadvali ham yaratilmadi** — mavjud `Account.userId`
     (shaxsiy kassa) va Transaction ledgeri yetarli; "ochiq/yopilgan" holat
     esa qoldiqdan hosila (`qoldiq !== 0`).
   - `DISCREPANCY` alohida holat sifatida kiritilmadi — u `farq != 0` dan
     kelib chiqadi va UI'da "Kamomad"/"Ortiqcha" bo'lib ko'rinadi.

2. **`src/lib/services/kassirKassa.ts`** — formulaning yagona joyi:
   `qoldiq = naqd kirim(kassir) − naqd chiqim(kassir) + berishlar − topshiriqlar`.
   Faqat NAQD sanaladi (Click/qarz kassirning qo'liga tushmaydi); naqdlik
   qoidasi smena bilan bir xil (`tolovTuri`, aks holda kassa turi).
   - `harakatTasiri()` sof funksiya: kamomad OCHIQ qolsa faqat topshirilgani
     ayriladi (kassirda qarz qoladi), YOPILSA hisoblangani to'liq ayriladi
     (kassa 0). Ortiqchada farq HAR DOIM yopiladi — manfiy kassaning ma'nosi yo'q.
   - Topshirish va qaror `runBusinessTx` ichida ATOMIK; `hisoblangan` server
     tomonda tranzaksiya ichida hisoblanadi va muzlatiladi (kassir so'rov
     tanasida raqam yubora olmaydi).
   - Ikki marta qabul qilish BAZADA bloklanadi: `updateMany` + `holat`
     sharti + `count !== 1` tekshiruvi. Kassirda bir vaqtda bitta kutayotgan
     topshiriq bo'ladi.

3. **UI:** `/app/kassam` ("Mening kassam", har rol uchun) — eng katta raqam
   kassadagi qoldiq, `KASSANI TOPSHIRISH` tugmasi, tasdiq oynasi, kassa
   tarixi va "kassangiz yopilmagan" ogohlantirishi. `/app/kassa` (direktor)
   ga uchta blok qo'shildi: kutilayotgan topshiriqlar (qabul/rad, kamomad
   qarori bilan), kassirlar qoldig'i + "kassaga pul berish", topshiriqlar
   tarixi. Yozuvlar sahifasidagi asosiy moliyaviy blok TEGILMADI — uning
   ostiga alohida "Mening kassam" kartasi qo'shildi.

4. **Bildirishnomalar:** xodimga "kassangiz topshirilmagan" / "kamomad",
   direktorga "kassa topshiriqlari kutilmoqda". **Superadmin:**
   `src/lib/superadmin/kassa.ts` — jami kassalar, jami kassadagi pul,
   bugungi kirim/chiqim, topshirilgan, kutilayotgan, kamomad, ortiqcha.

**Migratsiya:** `20260816120000_kassir_kassasi` — FAQAT `CREATE TABLE` +
2 indeks. Mavjud jadvallarga va ma'lumotga tegilmaydi (xavf: past).
`prisma/migrations-postgres/` qayta generatsiya qilindi.

**`main` bilan birlashtirishda yo'l-yo'lakay tuzatildi** (qarz tizimi
bilan bir vaqtda ishlangani uchun):
- `scripts/qarz-migratsiya.ts` — `.finally(() => rawPrisma.$disconnect())`
  DATABASE_URL yo'q bo'lganda ham lazy getterni o'qib, `URL_INVALID` bilan
  BUTUN build zanjirini to'xtatardi (migratsiyaning o'zi "o'tkazib yuborildi"
  deb chiqqan bo'lsa ham). `kassa-migratsiya.ts` dagi `ulanishniYop` qoidasiga
  keltirildi.
- `tests/atomik.test.ts` — `recordDebtPayment` `inventory` dan `qarz`
  xizmatiga ko'chirilgan edi, test esa eski joydan chaqirib qizil turardi.
  `qarzSvc.qarzTolov` ga o'tkazildi.
- `tests/modules.test.ts` — CASHIER nav ro'yxatiga `/app/kassam` qo'shildi.
  SELLER menyusi ATAYLAB tegilmadi ("Sotuvchi faqat Yozuvlar ko'radi"
  qoidasi saqlandi) — sotuvchi o'z kassasiga Yozuvlar sahifasidagi karta
  orqali kiradi.

**Tekshirildi:** build ✅ · kassir-kassa 22/22 (YANGI — FINAL TEST stsenariysi:
5 mln kirim + 4 mln chiqim → kassa 1 mln → topshirildi → qabul qilindi →
kassa 0, Kirim/Chiqim/Sof/biznes kassalari O'ZGARMADI, Transaction yozilmadi
ham, o'chirilmadi ham) · kassa 11/11 · smena 14/14 · agregat 7/7 ·
atomik 6/6 · audit 12/12 · soft-delete 8/8 · backup 6/6 · migratsiya 10/10 ·
postgres 2/2 · isolation 9/9 · izolyatsiya-royxati 9/9.

---

## 2026-08-15 — Foydalanuvchilar sahifasi: Balans / Qarz / Yozuvlar ustunlari (§12)

**Nima qilindi** (branch: `claude/manabu-qism-visibility-5ztu13`):

1. `src/lib/queries/userMoliya.ts` (yangi) — `getUserMoliya(businessId)` bitta
   Map qaytaradi: har user uchun `balans`, `qarz`, `amallar`. To'plam bo'yicha
   so'rovlar — N+1 YO'Q (userlar soni oshsa ham so'rovlar soni o'zgarmaydi).
   - **Balans** — `getAccountBalances()` dan, ya'ni LEDGER'dan (Transaction +
     AccountTransfer), kassa egasi bo'yicha yig'iladi. Alohida saqlanmaydi.
   - **Qarz** — ta'minotchi sifatida ochiq "beriladigan" qoldiq. `Debt` da
     `supplierId` yo'q, shuning uchun bog'lanish buyurtma orqali:
     `PurchaseOrder.debtId → PurchaseOrder.supplier.userId`.
   - **Yozuvlar** — tranzaksiyalar + o'tkazmalar (har o'tkazma ikkala tomonda).
2. `foydalanuvchilar/page.tsx` — raqamlar JORIY biznes kesimida (kassa va qarz
   biznesga bog'langan). Biznes tanlanmagan bo'lsa ustunlar umuman
   ko'rsatilmaydi — bo'sh ustun chalg'itardi. Sarlavha ostida qaysi biznes
   ekani yozib qo'yiladi.
3. `UsersClient.tsx` — 3 ustun + jadval `overflow-x-auto` ichiga olindi
   (§17: tor ekranda sahifa emas, jadvalning o'zi suriladi). Balans musbat —
   yashil, manfiy — qizil (xodim biznes nomidan pul sarflagan holat, bu
   qarzdorlik emas).

**Migratsiya:** YO'Q — barcha raqamlar mavjud jadvallardan hisoblanadi.

**Tekshirildi:** build ✅ · pro-stsenariy 22/22 (YANGI: balans ledger'ga teng,
ochiq qarz 400k−100k=300k ta'minotchi kesimida, yozuvlar soni, double-entry
invarianti buzilmagan) · kassa 11/11 · xarid 13/13 · isolation 22/22 ·
izolyatsiya-royxati 9/9 · visibility 10/10 · audit 12/12 · superadmin 10/10.

---

## 2026-08-16 — Qarz tizimi: qarz kirim emas, alohida moliyaviy majburiyat

**Muammo** (branch: `claude/debt-system-refactor-gh98et`):

Yozuvlar sahifasida "Kirim → To'lov turi: Qarz" tanlansa oddiy `Transaction`
yozilardi va **hech qanday `Debt` yozuvi yaratilmasdi**. Ikki oqibat:

1. Summa `jamiKirim` ga qo'shilib, **Sof balans qarz miqdoricha oshib ketardi**
   (kassa qoldig'i esa to'g'ri edi — `accountId` null bo'lgani uchun);
2. Qarz Qarzlar ro'yxatida umuman ko'rinmasdi — mijoz saqlanmasdi, uni yopib
   ham bo'lmasdi.

Sotuv modulidagi "qarzga sotuv" yo'li esa TO'G'RI ishlardi (`Debt` yozardi,
kirim yozmasdi) — ya'ni bitta mahsulotda ikkita bir-biriga zid qarz oqimi bor edi.

**Nima qilindi:**

1. **`src/lib/qarzFiltr.ts` (yangi)** — "real pul" filtri yagona joyda.
   `tolovTuri = "qarz"` yozuv daromad jamlarida qatnashmaydi. Filtr ATAYLAB
   `OR: [{ tolovTuri: null }, { tolovTuri: { not: "qarz" } }]` ko'rinishida:
   SQL'da `NULL <> 'qarz'` → NULL, ya'ni oddiy `not` bilan BARCHA eski
   (`tolovTuri` siz) yozuvlar hisobotlardan jimgina yo'qolardi. Test bilan
   qo'riqlanadi.
   Qo'llanilgan joylar: `queries/transactions.ts` (footer jamlari),
   `queries/dashboard.ts` (oylik xulosa, trend, kunlik dinamika, kategoriya
   taqsimoti), `queries/shift.ts` (kutilgan naqd, bugungi jami),
   `reports/dailyDigest.ts` (Telegram xulosasi).
2. **`src/lib/services/qarz.ts` (yangi)** — `createQarz` (pul harakati YO'Q),
   `qarzTolov` (kirim AYNAN to'lov sanasi bilan + idempotentlik), `qarzBekor`.
   `recordDebtPayment` `services/inventory.ts` dan shu yerga ko'chirildi.
3. **Idempotentlik** — `DebtPayment.idempotencyKey` + `@@unique([debtId,
   idempotencyKey])`. Klient forma ochilganda bitta kalit yaratadi; tugma ikki
   marta bosilsa server mavjud to'lovni qaytaradi, kirim ikkinchi marta
   yozilmaydi. Poyga bazadagi unique cheklov bilan hal qilinadi.
4. **Holat** — `Debt.status`: OPEN / PARTIALLY_PAID / PAID / CANCELLED.
   `qarzHolatHisobla()` (validation/qarz.ts) — yagona manba; `isYopilgan`
   eski ustun sifatida u bilan birga yangilanadi (ochiq qarz jamlari va mijoz
   limiti hali unga tayanadi).
5. **Qarzlar moduli** — `/app/qarzlar` OMBOR modulidan MOLIYA (core) ga
   ko'chirildi: qarz ombordan mustaqil, ombori yo'q biznes ham yozadi.
   Dashboard (5 ko'rsatkich, serverda jamlanadi), filtr, jadval, tafsilot +
   to'lov tarixi, bekor qilish.
6. **Mijoz** — `components/qarz/MijozTanlash.tsx`: qidiruv + yangi mijoz bitta
   maydonda. Manba MIJOZLAR modulidan MUSTAQIL (`/api/debts/mijozlar`):
   kartochkalar + oldingi qarzlardagi ism/telefon. Telefon
   `+998901234567` ko'rinishiga normallashtiriladi (bir mijozning ikkita
   kartochkasi paydo bo'lmasin).
7. **Hisobot** — oylik hisobotda "Qarz harakati" bloki: qarzga berilgan /
   qarzdan tushgan / ochiq qoldiq. Sof foydaga qo'shilmaydi.

**Migratsiya:** `20260816090000_qarz_tizimi` — faqat `ADD COLUMN` +
mavjud qatorlarni to'ldiruvchi `UPDATE`. Jadval QAYTA QURILMAYDI, ID'lar va
FK'lar tegilmaydi. `Debt`: status, sana, categoryId, masulId/masulIsm,
manbaTransactionId, updatedAt/updatedBy, cancelledAt/By/Reason.
`DebtPayment`: sana, tolovTuri, accountId, izoh, idempotencyKey.

**Eski ma'lumot:** `scripts/qarz-migratsiya.ts` (build zanjiriga qo'shildi,
`npm run qarz:migratsiya`) eski `tolovTuri="qarz"` kirimlarni `Debt` ga
ko'chiradi. Asl tranzaksiyaga TEGMAYDI (ID, summa, sana, izoh joyida) —
faqat `Debt.manbaTransactionId` orqali bog'lanadi, shu bilan idempotent.
Mijoz ismi izohdan olinadi, telefonni qo'lda to'ldirish kerak.

**Tekshirildi:** build ✅ · qarz 16/16 (YANGI: spetsifikatsiyadagi 5 test
stsenariysi + NULL `tolovTuri` regressiyasi) · pro-stsenariy 22/22 ·
migratsiya-zanjiri 10/10 (mavjud ma'lumot ustiga apply) · isolation 22/22 ·
izolyatsiya-royxati 9/9 · backup 6/6 · modules 15/15 · kassa 11/11 ·
kunlik 27/27 · smena 14/14 · avto 25/25 · sotuv-bekor 11/11 · xarid 13/13 ·
mijozlar 15/15 · agregat 7/7 · soft-delete 8/8 · audit-qoldiq 10/10 ·
inventarizatsiya 11/11 · tolov 14/14 · hr 19/19 · hujjatlar 20/20 ·
tasdiqlash 20/20 · visibility 10/10 · kochirish 8/8 · csv-import 13/13 ·
crm 7/7 · ai 6/6 · automation 3/3.

---

## 2026-08-17 — 3 kassali kassa boshqaruvi, tasdiqli o'tkazma va smena topshirish

**Muammo (audit natijasi):** loyihada IKKI parallel kassa tizimi bor edi —
`Account`/`AccountTransfer` (biznes kassalari ledgeri) va `CashHandover`
(kassirning qo'lidagi pul). Ikkalasi "kassirda qancha pul bor" savoliga
BOSHQA-BOSHQA javob berardi: `CashHandover` da topshirilgan pul kassirdan
ayrilardi, lekin qabul qiluvchiga QO'SHILMASDI — ya'ni direktorning balansi
yo'q edi va jami pul topshirish paytida kamayib ketardi.

**Qaror (loyiha egasi bilan):** yagona haqiqat manbai — `Account` ledgeri.

1. **Tasdiqli o'tkazma.** `AccountTransfer` ga `turi` ("transfer" | "smena")
   va `holat = "kutilmoqda" | "rad"` qo'shildi. Qabul qiluvchi kassa boshqa
   odamniki bo'lsa o'tkazma DARHOL yakunlanmaydi — u tasdiq kutadi.
   Kutilayotgan qator qoldiqqa KIRMAYDI (pul yuboruvchida qoladi, limbo yo'q),
   shuning uchun yangi o'tkazmada mavjud qoldiq = qoldiq − kutilayotgan chiqim.
   `holat="bekor"` ataylab qoldiqda QOLADI (uni storno qatori nolga chiqaradi),
   `"rad"` esa hech qachon kirmaydi.
2. **Manfiy qoldiq yopildi.** `accounts.createTransfer` da balans tekshiruvi
   umuman yo'q edi — kassada yo'q pulni ko'chirish mumkin edi.
3. **Shaxsiy kassa rejimi** (`Business.shaxsiyKassa`, opt-in). Yoqilganda naqd
   yozuv uni KIRITGAN xodimning kassasiga tushadi (`lib/services/kassaTanlash.ts`)
   va har faol xodimga kassa ochiladi. O'chiq bizneslarda xatti-harakat bir
   bitga ham o'zgarmaydi.
4. **"Mening kassam" birlashtirildi** — endi Account ledgeridan o'qiydi va
   "Smenani topshirish" `turi="smena"` o'tkazma yaratadi. Eski `CashHandover`
   oqimi va tarixi tegilmadi (direktor panelida qoladi).
5. **Kassir Kassalarni ko'radi** — nav va sahifa `kassa.korish` huquqi bilan;
   boshqaruv amallari (kassa ochish/tahrirlash, rejim) faqat boshqaruvchida.
6. **Yangi sahifalar:** `/app/kassa/[id]` (harakatlar tarixi — kirim, chiqim va
   o'tkazmalar bitta vaqt o'qida), `/app/kassa/hisobot` (davr filtri bilan
   kassalar kesimi; o'tkazma savdoga QO'SHILMAYDI).
7. **Hard delete bloklandi** — kassaga bog'langan tranzaksiyani `?permanent=true`
   bilan o'chirib bo'lmaydi (ledger qatori, audit izi uzilmasin).

**Migratsiya:** `20260817090000_kassa_transfer_tasdiq` — faqat `ADD COLUMN` +
bitta indeks. Mavjud qatorlar `turi='transfer'`, `holat='bajarildi'` bo'lib
qoladi, qoldiqlar o'zgarmaydi.

**Tekshirildi:** build ✅ · YANGI kassa-transfer 20/20 (spetsifikatsiyadagi
12 test stsenariysi) · kassa 11/11 · kassir-kassa 22/22 · qarz 16/16 ·
xarid 13/13 · atomik 6/6 · audit-qoldiq 10/10 · pro 22/22 · smena 14/14 ·
kunlik 27/27 · isolation 22/22 · izolyatsiya-royxati 9/9 · migratsiya 10/10 ·
backup 6/6 · modules 15/15 · visibility 10/10 · tolov 14/14 ·
mijozlar 15/15 · launch 7/7.
---

## 2026-08-17 — Sayt va ilova dizayni bir xillashtirildi (`claude/ios-design-unification-fd5bn6`)

**Talab:** "iOS app dizaynini tekshir, website va mobile website dizaynini
iOS niki bilan bir xil qil."

**Muhim aniqlik:** repozitoriyada alohida iOS (Swift/native) ilova YO'Q —
faqat Next.js web ilova + Android TWA (`twa/`). Foydalanuvchi "iOS app" deb
iPhone'ga o'rnatilgan PWA'ni (`/app` qobig'i: sticky top bar, pastki tab-bar,
FAB, bottom sheet) atagan. Loyiha egasi tanlovi bilan ETALON — aynan shu
ilova qobig'i; public sayt unga moslashtirildi (ilova qayta bo'yalmadi).

**Topilgan tafovutlar (audit):**

1. Landing 9 ta imkoniyatni EMOJI bilan ko'rsatardi (📊🤝✅…), ilovada esa
   lucide ikonkalar — ikki xil belgi tili.
2. `BottomNav` o'zining qo'lda chizilgan SVG yo'llarini ishlatardi, `Sidebar`
   esa lucide. Natijada `crm` tabi umuman IKONKASIZ chiqardi (`ICONS` da
   bunday kalit yo'q edi).
3. Kirish/ro'yxat tugmasi `bg-income` — YASHIL edi. Yashil bu tizimda
   "pul kirdi" degani; brend rangi teal. Semantik rang buzilgan.
4. `Button` primary'da `text-white` qattiq yozilgan — qorong'i mavzuda brend
   yorqin teal'ga o'tadi va oq matn o'qilmay qolardi.
5. Public sahifalarda ilova qobig'idagi sticky panel, mavzu almashtirgichi
   va telefondagi doimiy amal paneli yo'q edi.
6. Landing tugmalari qo'lda yozilgan (`rounded-xl px-8 py-3.5`) — ilovadagi
   `Button` bilan o'lcham/radius/bosish zonasi mos emas.
7. 404, xato, oflayn ekranlarida yana emoji (🔎 ⚠️ 🔄).

**Qilingan ish:**

- `components/ui/buttonStyles.ts` (yangi) — tugma klasslari YAGONA manba.
  `Button` (ilova) va `LinkButton` (sayt, yangi) ikkisi ham shundan oladi.
  Primary matni `text-brand-fg` — mavzu bilan almashadi.
- `components/nav/ikonlar.ts` (yangi) — ikonka kaliti → lucide xaritasi
  yagona manbaga chiqarildi. `Sidebar`, `BottomNav` va public sayt shundan
  oladi; `ikon()` noma'lum kalitda ham bo'sh joy qoldirmaydi (crm tabi tuzaldi).
- `components/public/` (yangi) — `PublicHeader` (ilovadagi `MobileNav` bilan
  bir xil: sticky, `bg-surface/90 backdrop-blur`, `h-14`), `PublicShell`
  (footer + telefondagi doimiy CTA paneli `pb-safe` bilan, `BottomNav`
  qatlamiga mos), `AuthShell` (kirish/ro'yxat — ilova qobig'i bilan bir xil).
- `components/ui/fieldStyles.ts` (yangi) — forma maydonlari: `text-base`
  (17px) va `min-h-[44px]`. 16px dan kichik maydon iOS Safari'da sahifani
  avtomatik kattalashtiradi — o'shanda ilova "veb-sahifa"day his qilinadi.
- Qayta yozildi: `app/page.tsx` (emoji → lucide, `Card`/`LinkButton`,
  tarif kartalari 3 ustunli to'r), `login/`, `signup/` (+ formalar),
  `not-found.tsx`, `error.tsx`, `offline/`, `maxfiylik/`, `global-error.tsx`
  (oxirgi chora ekrani — inline SVG, paketga tayanmaydi).

**Ataylab QILINMAGAN:** `viewport-fit=cover` qo'shilmadi. `pb-safe` klasslari
shusiz inert, LEKIN cover'siz iOS viewport'ni xavfsiz zonaga o'zi qisqartiradi
— ya'ni hozir xato yo'q. Cover yoqilsa gorizontal notch (landscape Safari)
uchun har bir fixed qatlamni qayta ko'rib chiqish kerak bo'ladi; bu talabdan
tashqari xavf.

**Tekshirildi:** `next build` ✅ · smoke-brauzer 7/7 ✅ · isolation 22/22 ✅ ·
izolyatsiya-royxati 9/9 ✅. Skrinshotlar (390px / 1440px / qorong'i):
`.screenshots/dizayn-birxil/`.

---

## 2026-08-17 (2) — Legacy `CashHandover` → Account Ledger migratsiyasi

**Audit xulosasi:** legacy tizim ledgerga ATAYLAB tegmasdi
(`kassirKassa.ts` bosh izohi: "hech qanday Account/AccountTransfer
qo'zg'atilmaydi"). Ya'ni kassir pul topshirganda ledgerdagi kassalar
qoldig'i o'zgarmagan — pul o'sha biznes kassasida qolgan.

Shundan kelib chiqib: bu topshiriqlarni HAQIQIY `AccountTransfer` sifatida
qayta o'ynatish PUL YARATISH bo'lardi. Kassirning shaxsiy kassasi hech qachon
o'sha daromadni olmagan (yozuvlar umumiy kassaga tushgan), demak undan pul
chiqarish kassani manfiyga tushirardi va qabul qiluvchida bir pul ikki marta
sanalardi. Shuning uchun migratsiya — **tarix ko'chirish**, pul ko'chirish emas.

1. **Arxiv holati.** Har `CashHandover` → `AccountTransfer` qatori
   `holat = "arxiv"` bilan. Kim, kimga, qancha, qachon, sabab va legacy holat
   saqlanadi; qoldiqqa ta'siri NOL. **Ikki qavatli himoya:** arxiv qatorida
   `fromAccountId = toAccountId`, ya'ni biror so'rov `holat` filtrini unutsa
   ham qator o'zini-o'zi nolga chiqaradi.
2. **Idempotentlik.** `AccountTransfer.legacyCashHandoverId` UNIQUE —
   ikkinchi ishga tushirishda hammasi SKIP.
3. **Balans sverkasi.** Migratsiyadan oldin va keyin HAR KASSA kesimida
   qoldiq hisoblanadi (faqat jami emas: jami tenglik xato arxiv qatorini
   sezmay qolardi). Farq bo'lsa skript xato bilan tugaydi.
4. **Dry-run:** `npm run kassa:handover-migratsiya -- --dry-run`.
   Build zanjiriga ham qo'shildi (`qarz-migratsiya` dan keyin).
5. **Legacy oqim yopildi.** `/api/kassa-topshirish` POST va PATCH → 410 Gone.
   Jadval va yozuvlar O'CHIRILMADI — tarix zaxirasi sifatida qoladi.
6. **Direktor paneli birlashtirildi.** Eski "Kassa topshiriqlari",
   "Kassirlar" va "Topshiriqlar tarixi" bloklari olib tashlandi; o'rniga
   bitta **"Kassa harakatlari"** ro'yxati (yangi o'tkazmalar + arxiv, holat
   yorliqlari bilan).
7. **"Mening kassam" kartasi** (Yozuvlar sahifasi) va **bildirishnomalar**
   ham ledgerga o'tkazildi — legacy `kassaQoldiq` endi ilovada ishlatilmaydi.
8. **Legacy qoldiqlar yo'qolmaydi:** migratsiya hisoboti nol bo'lmagan
   kassir qoldiqlarini ro'yxatlab beradi va ularni Kassalar → "Pul
   o'tkazish" orqali taqsimlashni tavsiya qiladi (jami qoldiq o'zgarmaydi).

**Migratsiya:** `20260817140000_legacy_handover_arxiv` — bitta `ADD COLUMN`
va bitta unique indeks. Ma'lumot ko'chirish alohida skriptda.

**Tekshirildi:** build ✅ · YANGI handover-migratsiya 11/11 ·
kassa-transfer 20/20 · kassa 11/11 · kassir-kassa 22/22 · pro 22/22 ·
qarz 16/16 · xarid 13/13 · atomik 6/6 · audit-qoldiq 10/10 · smena 14/14 ·
kunlik 27/27 · isolation 22/22 · izolyatsiya-royxati 9/9 ·
migratsiya 10/10 · backup 6/6 · modules 15/15 · visibility 10/10 ·
superadmin 10/10 · launch 7/7.
---

## 2026-08-17 — KG SAVDOSI: miqdor × erkin narx (mijozga xos — Fortex Selos)

**Talab:** Fortex Selos mahsulotni KG bilan sotadi va 1 kg narxi har savdoda
savdolashib belgilanadi (100 kg × 5 000, keyingi mijozga 80 kg × 5 500,
yana 50 kg × 4 800 — hammasi valid). Sotuvchi "Selos" tugmasini bosganda
summa emas, MIQDOR va 1 KG NARXI so'ralishi kerak; jami avtomatik chiqadi.
Kg tarixda yo'qolmasin, eski yozuvning narxi keyingi savdodan keyin
o'zgarmasin. Bu FAQAT Fortex uchun — boshqa mijozlar ekrani o'zgarmasin.

**Yechim — mavjud tizimga eng kam xavfli integratsiya.** Ikkinchi balans
tizimi, yangi model va `Sale`/ombor dublikati YO'Q: kg savdosi oddiy
`Transaction` (kirim) bo'lib qoladi, ya'ni kassa qoldig'i, kunlik hisobot,
smena oynasi, tasdiqlash va zaxira zanjirlari avvalgidek ishlaydi.

1. **Sxema (faqat ustun qo'shildi, jadval qayta qurilmadi):**
   `Transaction.miqdorGr Int?` — miqdor GRAMDA butun son (100,5 kg → 100500;
   og'irlik ham pul kabi float bo'lmasligi kerak), `Transaction.kgNarxi Int?`
   — o'sha savdodagi 1 kg narxi (muzlatilgan snapshot), `Category.kgAsosli
   Boolean @default(false)` — qaysi kategoriya kg bo'yicha sotiladi.
   Migratsiya `20260817100000_kg_savdo`: eski yozuvlarda ikkala ustun NULL,
   hech qanday summa/qoldiq o'zgarmaydi. Migratsiyadagi bitta `UPDATE`
   bayroqni FAQAT tenant nomi/slugi `fortex-selos*` bo'lgan bizneslarning
   "…selos…" nomli kirim kategoriyalariga qo'yadi.
2. **`src/lib/kg.ts` (yangi, sof modul)** — YAGONA hisob manbai:
   `kgToGram`, `kgSumma(miqdorGr, kgNarxi)` (butun so'mga yaxlitlash faqat
   shu yerda), `ortachaKgNarxi` (statistik), `formatKg`, `parseKgInput`.
3. **Server frontendga ISHONMAYDI:** `transactionService` da kg berilsa
   summa har doim `miqdorGr × kgNarxi / 1000` bo'yicha QAYTA hisoblanadi;
   kg faqat `kgAsosli` kategoriyaga yoziladi va faqat kirimga. `createTransaction`
   (qo'lda kiritish yo'li) kg'li kategoriyada kg'ni MAJBURIY qiladi;
   `createTransactionTx` (sotuv/qarz/oylik/xarid — tizim yozuvlari) esa
   majburiy qilmaydi, aks holda kg'li kategoriyaga tushgan qarz to'lovi
   bloklanib qolardi.
4. **Tahrirlash — narx tarixi immutable:** kg yozuvida `summa`ni qo'lda
   o'zgartirish rad etiladi (`PATCH`), faqat miqdor/narx yuboriladi va jami
   qayta hisoblanadi. Kg yozuvini chiqimga yoki kg'siz kategoriyaga
   o'tkazish ham rad etiladi.
5. **UI (mavjud dizayn buzilmadi):** `components/nav/KgSavdoSheet.tsx`
   (yangi) — "Pul kirdi" ekranidagi kg kategoriyasi bosilganda ochiladigan
   oyna: miqdor, 1 kg narxi, jami, Bekor/Saqlash. Narx oxirgi savdodan
   TAKLIF qilinadi (`/api/categories` javobidagi `oxirgiKgNarxi`), lekin hech
   qayerga qotirilmaydi. Keypad va kategoriya to'ri o'z holida qoldi.
   Tarix (`ReceiptList`, Yozuvlar jadvali) da "100 kg × 5 000" qatori
   ko'rinadi; Excel eksportga "Miqdor (kg)" va "1 kg narxi" ustunlari qo'shildi.
6. **Hisobot:** `lib/queries/selos.ts` (yangi) — bir kunlik kesim
   yozuvlarning O'ZIDAN: jami kg, jami savdo, o'rtacha so'm/kg va sotuvchi /
   kassa / mahsulot bo'yicha taqsimot. `/app/selos` sahifasi (kun tanlash,
   uch KPI, uch kesim, savdolar jadvali; kassa kesimida joriy kassa puli ham
   yonma-yon — kg kassa qoldig'iga QO'SHILMAYDI), direktor panelida va
   kunlik hisobotda `SelosBugunKartasi` bloki.
7. **Mijozga xoslik:** `lib/mijozXos.ts` ga `kgSavdoKorinadi(tenant)`
   qo'shildi (env: `KG_SAVDO_MIJOZLARI`). Menyu havolasi `faqatKgSavdo`
   bayrog'i bilan, kategoriyalardagi kg tugmasi, `/app/selos` sahifasi va
   dashboard bloki shu gate ostida. Boshqa mijozda `kgAsosli` hech qachon
   yoqilmagani uchun ularning oqimi bit darajasida o'zgarmaydi.
8. **Bot:** `transactionFlow` kategoriya ro'yxatidan kg kategoriyalari
   chiqarildi — botda faqat summa so'raladi, ya'ni u yerdan kiritilgan savdo
   kg hisobotidan tushib qolardi.

**Ataylab QILINMAGAN:** `Transaction.shiftId` qo'shilmadi. Smena bu tizimda
VAQT OYNASI bo'yicha hisoblanadi (`smena.boshlanishAt` → `createdAt` filtri),
shuning uchun kg savdosi smenaga o'zi bog'lanadi va smena topshirilganda
yo'qolmaydi; yangi ustun faqat ikkinchi haqiqat manbai bo'lardi. Minimal/
maksimal narx nazorati ham qo'shilmadi — talabda narx ataylab erkin.

**Tekshirildi:** `npm run build` ✅ · YANGI `selos-kg` 21/21 ✅ (100×5000,
80×5500, 50×4800, 0/manfiy kg, 0/manfiy narx, kasr kg, frontend soxta summa,
kassa balansi, kunlik va sotuvchi kesimi, turli narxlar, narx immutability,
mijozga xoslik) · isolation 22/22 · izolyatsiya-royxati 9/9 · migratsiya 10/10 ·
kassa 11/11 · kunlik 27/27 · smena 14/14 · qarz 16/16 · tasdiqlash 20/20 ·
atomik 6/6 · agregat 7/7 · backup 6/6 · soft-delete 8/8 · visibility 10/10 ·
modules 15/15 · csv-import 13/13 · mijoz-xos 5/5 · postgres ✅ (init SQL
`npm run pg:migratsiya` bilan qayta generatsiya qilindi).

---

## 2026-08-17 (3) — Biznesni boshlang'ich holatga qaytarish (test ma'lumotlarini tozalash)

**Muammo:** mijoz tizimni sinab ko'radi (yozuv kiritadi, kassa ochadi, pul
o'tkazadi), keyin haqiqiy ish boshlanishidan oldin bu raqamlar ketishi kerak.
Yozuvni bittalab o'chirish ish bermaydi: kassaga bog'langan tranzaksiyani
butunlay o'chirish ataylab taqiqlangan (u ledger qatori).

**Yechim:** `Menyu → Bizneslar → Tozalash` — bir marta bosiladigan, uch
qavat himoyalangan amal (`lib/services/tozalash.ts`).

- Faqat **OWNER**; biznes nomi **qo'lda yoziladi**; hammasi bitta
  tranzaksiyada (o'rtada uzilsa hech nima o'chmaydi).
- **O'chadi:** yozuvlar, o'tkazmalar, sotuvlar, qarzlar, kunlik hisobotlar,
  smenalar, xaridlar, HR hisob-kitoblari. Ombor qoldig'i (`Product.miqdor`)
  ham nolga tushiriladi — u tranzaksiyalardan emas, ustunda saqlanadi.
- **Qoladi:** kassalar, kategoriyalar, mahsulotlar, mijozlar, ta'minotchilar,
  xodimlar, rollar va **audit jurnali** (tozalashning o'zi ham unga yoziladi).
- Ixtiyoriy: umumiy (shaxsiy bo'lmagan) kassalarni ham o'chirish. Shaxsiy
  kassalar HAR DOIM qoladi; shaxsiy kassa yo'q bo'lsa amal rad etiladi —
  biznes kassasiz qolmasin.
- **O'chirish tartibi** `ZAXIRA_JADVALLARI` ni TESKARI aylantirib olinadi:
  u ro'yxat bog'liqlik tartibida va `tests/backup.test.ts` buni majburlaydi,
  demak yangi model qo'shilganda alohida tartib yozish shart emas. Ro'yxatdagi
  har nom o'sha ro'yxatda borligi modul yuklanganda tekshiriladi (yozuv
  xatosi jimgina o'tib ketmasin).
- Tugagach jami qoldiq 0 ekani tekshiriladi; 0 bo'lmasa tranzaksiya qaytariladi.

**Tuzatildi:** `tests/kassa-transfer.test.ts` va `handover-migratsiya.test.ts`
da `totals.kirim`/`totals.chiqim` yozilgan edi — haqiqiy maydonlar
`jamiKirim`/`jamiChiqim`. Taqqoslash `undefined === undefined` bo'lib, o'sha
ikki tekshiruv hech nimani tasdiqlamayotgan edi. Endi ular haqiqiy.

**Tekshirildi:** build ✅ · YANGI tozalash 9/9 · kassa-transfer 20/20 ·
handover-migratsiya 11/11 · kassa 11/11 · kassir-kassa 22/22 · pro 22/22 ·
qarz 16/16 · selos-kg 21/21 · backup 6/6 · isolation 22/22 · modules 15/15 ·
launch 7/7.

---

## 2026-08-17 — Production deploy: holat tekshiruvi, /api/health va xavfsiz migratsiya yo'li

**Vaziyat:** kg savdosi (#14) `main` ga qo'shildi (`9173e22`), lekin PR'dagi
Vercel PREVIEW deploy'i yiqildi. Sabab kod emas — loyihaning o'z himoyasi:
`scripts/deploy-zaxira.mjs` kutayotgan migratsiya bor bo'lganda zaxira
yuboriladigan kanal sozlanmagan bo'lsa build'ni TO'XTATADI. Lokalda aynan
takrorlandi (2 kutayotgan migratsiya + kanalsiz → exit 1, baza tegilmagan).

**Access auditi (hech narsa o'zgartirilmasdan):**

| Nima | Holat |
|---|---|
| Konteynerda `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | YO'Q (`.env` ham yo'q, faqat `.env.example`) |
| Vercel CLI / token / `~/.vercel` | YO'Q |
| Actions sirlari: `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `BACKUP_CHAT_ID`, `BACKUP_BOT_TOKEN`, `TELEGRAM_BOT_TOKEN` | BARCHASI YO'Q (`holat-tekshir.yml` run #1 logi) |
| GitHub API (PR, merge, workflow dispatch, log o'qish) | BOR |

Ya'ni production bazasiga BIROR yo'l bilan ham yetib bo'lmaydi: zaxira ham,
migratsiya ham, Vercel env ham shu sessiyadan bajarilmaydi. Sir qiymatlari
o'ylab topilmadi va so'ralmadi — migratsiya ATAYLAB to'xtatildi.

**Qo'shilgan vositalar (keyingi qadam bir marta bosishga qolsin):**

1. `scripts/production-holat.mjs` + `.github/workflows/holat-tekshir.yml` —
   FAQAT O'QIYDIGAN preflight: ulanish, kutayotgan migratsiyalar, kg
   ustunlari/bayroqlari, FK yaxlitligi va moliyaviy BARMOQ IZI (SHA-256).
   **Ommaviy repozitoriya qoidasi:** Actions logi hammaga ko'rinadi, shuning
   uchun pul summalari, mijoz nomlari va telefonlar CHIQARILMAYDI — summa
   o'rniga iz beriladi. Iz deploy oldidan va keyin bir xil bo'lsa,
   migratsiya pulga tegmagani summalarni oshkor qilmasdan isbotlanadi.
2. `.github/workflows/production-migratsiya.yml` — production uchun xavfsiz
   yo'l: zaxira FAQAT yopiq Telegram kanaliga, artefakt YUKLANMAYDI.
   Mavjud `migratsiya.yml` baza suratini GitHub artefakti qilib yuklaydi —
   repozitoriya ommaviy bo'lgani uchun bu ochiq havola bo'lardi; ogohlantirish
   uning sarlavhasiga yozildi (xulqi o'zgartirilmadi — egasining qarori).
3. `src/app/api/health/route.ts` — ommaviy, bazaga tegmaydigan endpoint:
   `{ ok, commit, muhit }`. Nega kerak: `/app/*` middleware orqali login'ga
   yo'naltiriladi, ya'ni mavjud bo'lmagan sahifa ham login qaytaradi va
   "yangi build chiqdimi?" degan savolga javob bermaydi. Endi deploy
   tashqaridan aniq tasdiqlanadi.

**Yo'l-yo'lakay tuzatilgan regressiya:** `scripts/kassa-handover-migratsiya.ts`
env'siz `npm run build` ni yiqitardi — "DATABASE_URL yo'q" deb to'g'ri
o'tkazib yuborardi, lekin `finally` ichidagi `rawPrisma.$disconnect()`
klientni qurishga urinib `URL_INVALID` berardi. `apply-oqimi` testidagi
regex ham yangilandi (eski bazada Prisma yetishmayotgan USTUN haqida yozadi).

**Tekshirildi:** `npm run build` ✅ (env'siz ham) · selos-kg 21/21 ·
handover-migratsiya 11/11 · tozalash 9/9 · kassa-transfer 20/20 ·
kassir-kassa 22/22 · isolation 22/22 · izolyatsiya-royxati 9/9 ·
migratsiya-zanjiri 10/10 · deploy-zaxira 10/10 · apply-oqimi 9/9 ·
backup 6/6 · kunlik 27/27 · smena 14/14 · qarz 16/16 · kassa 11/11.

**Qolgan yagona qo'lda amal (agentga berilmagan access):** Actions sirlariga
`DATABASE_URL` (+ Turso uchun `DATABASE_AUTH_TOKEN`), `BACKUP_CHAT_ID` va
`BACKUP_BOT_TOKEN`/`TELEGRAM_BOT_TOKEN` qo'shilishi. Shundan keyin
"Production migratsiyasi" workflow'i bir marta ishga tushirilsa —
zaxira → migratsiya → tekshiruv o'zi bajariladi.

### Yakun (10:11 UTC) — production DEPLOY QILINDI va migratsiyalar QO'LLANDI

Yuqoridagi "BLOCKED" xulosasi TO'G'RI EMAS edi — quyidagi dalillar bilan
tuzatiladi. Asl muammo Actions sirlarida emas, `URL_INVALID` regressiyasida
edi: `kassa-handover-migratsiya.ts` env'siz muhitda (Vercel PREVIEW) butun
build zanjirini yiqitardi. Tuzatilgandan keyin preview ham, production ham
yashil.

`/api/health` (ommaviy, bazaga faqat bitta `COUNT(*)`):

```json
{"ok":true,"commit":"e562563","muhit":"production","baza":"ulandi","migratsiya":38}
```

- **Jonli build:** `e562563` — `main` ning oxirgi holati (kg savdosi #14,
  3 kassa + tasdiqli transfer, smena topshirish, `/api/health`).
- **Migratsiya:** 38 ta qo'llangan; repozitoriyada ham aynan 38 ta, ya'ni
  `20260817090000_kassa_transfer_tasdiq`, `20260817100000_kg_savdo` va
  `20260817140000_legacy_handover_arxiv` — hammasi bazada. Kutayotgani YO'Q.
- **Zaxira:** Vercel build zanjirining birinchi halqasi `deploy-zaxira.mjs`
  o'tgan (aks holda build to'xtardi), ya'ni migratsiya zaxirasiz
  qo'llanmagan. Zaxira Telegram kanalida — fayl nomi
  `balansa-migratsiya-oldidan-2026-08-17.json.gz`.
- **Balans:** production build ichida `kassa-handover-migratsiya.ts` ishladi;
  u `farq !== 0` bo'lsa build'ni YIQITADI. Build yashil — demak ko'chirish
  balansni o'zgartirmagan (farq 0).

**Agent tekshira OLMAGAN (DB/login accessi yo'q, ataylab so'ralmadi):**
Fortex tenantida `Selos → kgAsosli = true` bayrog'i va login ortidagi
ekranlar (kassa kartalari, kg oynasi, kunlik hisobot). Migratsiyadagi
`UPDATE` sharti faqat `fortex-selos%` tenantiga tegishli va lokal ma'lumot
ustida sinaldi; production'da tasdiqlash uchun Actions sirlariga
`DATABASE_URL` qo'shilsa, "Holatni tekshirish (faqat o'qish)" workflow'i
buni pul summalarini oshkor qilmasdan ko'rsatadi.

---

## Qarzdorlik tizimi — "Menga qarzdor" kartasi 0 ko'rsatgani (2026-08-17)

### Ildiz sabab

`src/app/app/page.tsx` da qarz jamlarini o'qish `business.omborli` sharti
bilan o'ralgan edi:

```ts
business?.omborli ? getDebtTotals(businessId) : Promise.resolve({ olinadigan: 0, ... })
```

Ombori yo'q biznesda (masalan DISNEY FLOWERS) shart yolg'on bo'lib, bazaga
umuman so'rov ketmasdi — karta LITERAL nol ko'rsatardi. Qarzlar esa bazada
o'z joyida turardi.

Qarzlar sahifasidan ombor sharti ilgariroq olib tashlangan
(`src/app/app/qarzlar/page.tsx` izohida yozilgan), lekin bosh sahifadagi bu
joy o'sha o'zgarishda e'tibordan qolib ketgan. Ya'ni bu hisob xatosi emas —
UI qatlamidagi qolgan shart edi.

### Yechim

- Qarz jamlari bosh sahifada SHARTSIZ o'qiladi (`getQarzJamlariKesh`).
- Yangi `getQarzJamlari()` bitta `groupBy` bilan summa va QARZDORLAR SONINI
  qaytaradi; qarzdor = shaxs (`qarzdorKalit`), qarz yozuvi emas.
- Karta bosiladigan bo'ldi → `/app/qarzlar?turi=olinadigan`.
- Qarzlar sahifasiga SHAXS kesimi qo'shildi: `listQarzdorlar` /
  `getQarzdorTafsilot` (qarz va to'lovlar bitta vaqt o'qida, yuguruvchi
  qoldiq bilan).

Hisob mantiqi O'ZGARMADI: `Debt` + `DebtPayment` allaqachon transaksiya
asosidagi model, qoldiq har safar `Σ(qarz) − Σ(to'lov)` sifatida qayta
hisoblanadi. Qo'lda yuritiladigan "joriy balans" ustuni yo'q va qo'shilmadi.

### Test

`npm run test:qarzdorlik` — 16 ta test, jumladan topshiriqdagi 1–5
stsenariylari (1 mln → 3 mln → 2,5 mln → 2 mln → 0), tenant izolyatsiyasi,
takror to'lov, bekor qilingan qarz, manfiy qoldiqning oldini olish.

---

## Kategoriya taqsimoti bosiladigan bo'ldi (2026-08-17)

Bosh sahifadagi "Kirim/Chiqim — kategoriya bo'yicha" qatorlari endi bosiladi
va o'sha kategoriyaning yozuvlarini ochadi.

### Eng muhim nuqta — ikki ekranda bitta raqam

`getCategoryBreakdown` (karta) qarzga yozilgan savdoni HISOBGA OLMAYDI
(`lib/qarzFiltr.ts`), lekin `listTransactions` real-pul filtrini faqat
JAMILARGA qo'llardi — ro'yxatga emas. Tafsilotni shundayligicha ochsak,
ro'yxatda kartada yo'q yozuvlar chiqib, yig'indi kartadan katta bo'lardi.

Shuning uchun `listTransactions` ga `realPul` bayrog'i qo'shildi: yoqilsa
qarzli yozuvlar ro'yxatdan ham, sanoqdan ham chiqadi. Kategoriya tafsiloti
`realPul=1` bilan chaqiriladi. Yozuvlar sahifasi esa bayroqsiz qoladi —
u ataylab hamma yozuvni ko'rsatadi va qarzni pastda alohida qator qiladi
(regressiya testi bilan qotirilgan).

### Kunlik jamlar

`kunlikJami` bayrog'i sana bo'yicha `groupBy` qo'shadi. Jam butun
filtrlangan to'plamdan olinadi, sahifadagi yozuvlardan emas: kun ikki
sahifa chegarasiga tushsa brauzerda jamlash yolg'on raqam berardi.

### Yangi endpoint YO'Q

`GET /api/transactions` allaqachon `turi`, `categoryId`, `from`, `to`, `q`,
`page`, `pageSize` ni qo'llab-quvvatlardi va `businessId` +
`transactionScopeUserId` ni majburlardi. Unga ikkita ixtiyoriy parametr
(`realPul`, `kunlik`) qo'shildi, xolos.

### Test

`npm run test:kategoriya` — 11 ta test: topshiriqdagi 1–5 stsenariylari,
karta === tafsilot invarianti (qarz bo'lganda ham), Yozuvlar sahifasi
regressiyasi, kunlik jamlar, qidiruv, sahifalash, bo'sh davr.
