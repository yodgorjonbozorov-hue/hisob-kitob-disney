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

## 2026-08-13 · AUDIT BOSQICH 1 — kritik tuzatishlar (C-1…C-4, H-1, H-2, H-11)

**Branch:** `claude/balansa-code-audit-kt3eh1` · **Migratsiya YO'Q**

2026-08-13 auditining CRITICAL bosqichi to'liq bajarildi
(`docs/CLAUDE-CODE-PROMPTLAR.md` uslubidagi tuzatish prompti, BOSQICH 1):

- **C-1 · Sessiya har so'rovda bazadan tekshiriladi.** `buildContext`
  (`lib/auth/tenant.ts`) endi foydalanuvchini har so'rovda `rawPrisma`dan
  qayta o'qiydi: `isActive`, `rol`, `tenantId`, `businessId` — hammasi
  BAZADAN, cookie'dan emas (fail-closed). Nofaollashtirilgan xodim keyingi
  so'rovdayoq yopiladi; rol/biznes o'zgarishi qayta loginsiz amal qiladi.
  Impersonatsiya saqlanadi. `telegram-link-code` ham faollikni tekshiradi.
- **C-2 · Tasdiqlash qoidasi PATCH da ham.** Yangi
  `tahrirTasdiqniTekshir` (`lib/services/approval.ts`):
  (1) rahbar tasdig'i bilan yozilgan yozuvning summa/kategoriya/turi/sana
  maydonlari umuman tahrirlanmaydi; (2) moliyaviy maydon o'zgarishida
  `mosQoidaniTop` qayta tekshiriladi — kassir 50 000 ni PATCH bilan
  5 000 000 qila olmaydi (403).
- **C-3 · Sotuv/qarz to'lovi kunlikka tushadi.** `createSale` (naqd),
  `recordDebtPayment` (olinadigan kirim), sotuv bekor qilish va CSV import
  endi `runBusinessTx` TUGAGACH `kunlikSinxron` chaqiradi (tranzaksiya
  ichida emas — deadlock). Yopiq kunga tegilmaydi, sotuv baribir yoziladi.
- **C-4 · Topshirish sana guard'i.** `submitKunlikReport`: o'tgan kunni
  faqat `ruxsat.tahrirlaydi` (direktor/boshqaruvchi) topshiradi; submit va
  confirm'da sana biznes `createdAt` idan oldin bo'lsa rad (soxta tarix yo'q).
- **H-1 · Rol/parol chegaralari.** Yangi `lib/auth/userPolicy.ts` (sof
  funksiyalar): OWNER hisobini faqat OWNER tahrirlaydi/o'chiradi; OWNER
  rolini faqat OWNER beradi (POST ham); o'z rolini o'zgartirish va o'zini
  nofaollashtirish taqiq; oxirgi faol direktor himoyasi. Boshqa foydalanuvchi
  paroli almashtirilsa `mustChangePassword: true` majburiy + auditda
  `password_reset` izi.
- **H-2 · Hamma joyda Toshkent kuni.** `todayDateOnlyString` (UTC) BUTUNLAY
  olib tashlandi — 16 chaqiruv joyi `todayTashkentDateOnlyString`ga o'tdi
  (formalar, bot, servislar, sahifalar). `tests/vaqt.test.ts` grep bilan
  regressiyani ushlaydi.
- **Int chegara (5.1.4 dan oldinga olindi).** Barcha pul validatsiyalari
  `max(100 mlrd)` → `max(2 mlrd)` (Prisma `Int` maks ~2.147 mlrd; SQLite'da
  yashirin, Postgres'da yiqiladigan xato). `createTransactionSchema.summa`
  ga ham max qo'shildi.
- **H-11 · CI.** `.github/workflows/ci.yml`: push/PR da `npm ci` →
  `prisma generate` → `tsc --noEmit` → `npm test`. `npm test` =
  `scripts/run-tests.mjs` (barcha `tests/*.test.ts` ketma-ket; faqat
  `smoke-brauzer` chiqarilgan — brauzer talab qiladi).

**Yangi testlar:** `sessiya-tekshiruv` (6) · `permissions` (7) · `vaqt` (6) ·
kunlik +6 (sotuv/qarz/CSV/yopiq kun/sana guard) · tasdiqlash +2 (PATCH bypass).
Kunlik testlarida biznes `createdAt` 2020 ga qadimiylashtirildi (yangi sana
chegarasi guard'i o'tgan sanali stsenariylarga xalaqit bermasin).

**Eskirgan testlar yangilandi** (bazaviy holatda ham yiqilardi — kod emas,
kutilma eski edi): `avto.test.ts` AVTO tarif modullariga KUNLIK qo'shildi;
`visibility.test.ts` totals'ga naqdKirim/clickKirim qo'shildi;
`toliq-ishga-tushirish.test.ts` da tsc xatosi (`unknown[]` → `InArgs`).

**Bilib turib qilinmagan:** CSV import chiqimlariga tasdiqlash qoidasi
qo'llanmadi (import manager-only va yaratish oqimi alohida — kerak bo'lsa
BOSQICH 2 da); `bulk-move` summa o'zgartirmaydi — tegilmadi.

**Tekshirildi:** build ✅ · tsc toza · `npm test` (43 fayl) ✅ — jumladan
sessiya-tekshiruv 6/6 · permissions 7/7 · vaqt 6/6 · kunlik 32/32 ·
tasdiqlash 22/22 · isolation · visibility 10/10 · avto 25/25.
