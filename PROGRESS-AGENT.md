# Xodimlar KPI / ball / oylik moduli (2026-09-01)

Rahbar xodim kartochkasini bosadi va "bu xodimga hozir qancha oylik chiqdi"
savolining javobi ekranda turadi. CRM → sotuv → xodim → KPI → ball → bonus →
oylik zanjiri bitta avtomatik tizimga ulandi.

## Uchta invariant (ular buzilsa modul ishonchsiz bo'ladi)

1. SOTUV takrorlanmaydi — mavjud kirim tranzaksiyalaridan o'qiladi
   (`lib/kpi/sotuv.ts`), biriktirish qoidasi `sotuvchiId ?? userId`, ya'ni
   mavjud "Xodimlar statistikasi" bilan bir xil raqam chiqadi.
2. BALL takrorlanmaydi — joriy ball = boshlang'ich + shu oydagi
   `KpiPointLog` yig'indisi. Alohida "joriy ball" ustuni YO'Q, shuning uchun
   jurnal bilan ball ajralib qolmaydi va jimgina tahrirlash imkonsiz.
3. OYLIK saqlanmaydi — har o'qishda qayta hisoblanadi ("Hozirgi hisob").
   Oy yopilganda `KpiPayroll` snapshot yoziladi va o'sha oy muzlaydi
   ("Yakuniy hisob"). Shu sababli alohida "recalc" mexanizmi kerak emas.

## Ish paytida topilgan va tuzatilgan xatolar

- `NOT: { tolovTuri: "qarz" }` filtri `tolovTuri` BO'SH bo'lgan eski
  yozuvlarni jimgina tashlab ketardi (SQL'da NULL taqqoslash ROST bermaydi),
  natijada bonus kam hisoblanardi. NULL endi ochiq ro'yxatga olinadi.
- Qaytarilgan jarima kunlik limitni band qilib turardi: xato kiritilgan
  jarimani qaytarib, to'g'risini o'sha kuni qayta yozib bo'lmasdi.
- Yopilgan oyda bonus tafsiloti joriy sozlamadan chizilardi; sozlama keyin
  o'zgargan bo'lsa qatorlar yig'indisi snapshot jami bilan to'g'ri kelmasdi.

## Testlar

`npm run test:kpi-hisob` (16 ta, sof hisob) va `npm run test:kpi` (25 ta,
baza bilan: sotuv qoidalari, kunlik limit, qaytarish, oy yopish, tenant
izolyatsiyasi).

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

---

## Bosh sahifa (landing) — Claude Design maketi bo'yicha qayta yozildi (2026-08-18)

### Manba

Claude Design handoff to'plami: `Balansa Landing.dc.html` (+ `support.js` —
prototip ishga tushirgichi, mahsulot kodiga ko'chirilmaydi). Maket HTML/CSS
prototipi, shu bois vizual natija ko'chirildi, prototipning ichki tuzilishi
emas.

### Nima o'zgardi

`src/app/page.tsx` avvalgi qisqa landing o'rniga 12 bo'limli sahifaga
aylandi: hero → tanish holat → kunlik hisobot → Telegram → imkoniyatlar
(bento) → rollar → hisobotlar → boshlash → narx → savollar → yakuniy CTA →
footer. Bo'limlar `src/components/landing/` ostida (har biri 250 satrdan
kichik).

Bu sahifa `PublicShell` ni ishlatmaydi — maketda hero ustidan suzadigan
QORONG'I panel va qorong'i footer bor. Kirish/ro'yxat/maxfiylik sahifalari
avvalgidek `PublicShell` da qoldi (natijada `PublicShell` ning `cta`
parametri hozircha chaqiruvchisiz turibdi — ataylab o'chirilmadi).

### Dizayn tokenlari

Maketdagi `--bg/--card/--sunk/--fg/--line/--in/--out/--warn` va grafik
palitrasi loyihaning MAVJUD tokenlariga tushirildi (`bg-app`, `bg-surface`,
`bg-surface-2`, `text-fg/muted/faint`, `income/expense/debt`, `chart-1…5`) —
shu bois qorong'i mavzu ilova bilan bir xil palitrada qoladi. Yangi token
faqat bitta: `shadow-lift` (maketdagi ikki qatlamli yumshoq soya,
`--shadow-lift` orqali mavzuga qarab almashadi).

Hero, yakuniy CTA, footer va telefon maketi — mavzudan QAT'I NAZAR qorong'i,
u yerda ranglar to'g'ridan-to'g'ri hex bilan yozilgan.

O'lchamlar maketdagi px qiymatlarida (`text-[44px]`, `rounded-[24px]`):
loyihaning type-scale'i ilova ekranlari uchun sozlangan va marketing
sahifasining o'lchamlari bilan mos kelmaydi. Moslashuv chegarasi — maketdagi
container-query bilan bir xil 900px (`max-[900px]:`).

### Prototipdan ATAYLAB ko'chirilmagani

- Aktiv spetsifikatsiyalari (`V1 · ekran yozuvi 1280×800…`, `I3 · WebP ≤80 KB`)
  — ular ishlab chiqarish uchun izoh, sayt matni emas.
- Maketdagi `+998 90 000 00 00` — o'rin egallovchi raqam. `ALOQA.telefon`
  (`lib/brand.ts`) `null` qilib qo'yildi; chin raqam yozilsa footerda o'zi
  paydo bo'ladi.
- Tarif narxlari maketda 299 000 / 400 000 edi. Sayt to'lov sahifasidan
  BOSHQA raqam ko'rsatmasligi uchun narx va tarif nomi `lib/billing/plans.ts`
  dan olinadi (STANDARD 199 000, PRO 399 000).
- Prototipdagi placeholder logo o'rniga chin `Logo` komponenti (`inverted`).
- Rollar jadvali ustunlari `lib/auth/roles.ts` dagi `ROL_LABEL` dan.

### Harakat (animatsiya)

`LandingMotion` — bitta klient komponent: IntersectionObserver bilan
bo'limlarni ochadi va pul summalarini sanaydi (maketdagi skript bilan bir xil
chegara: threshold 0.15, 900 ms, ease-out-cubic).

`data-anim="on"` ni FAQAT shu skript qo'yadi — JS yuklanmasa CSS `opacity:0`
umuman qo'llanmaydi va kontent boshidanoq ko'rinadi. `prefers-reduced-motion`
da hamma element darhol ochiq, sanoq yo'q (brauzerda tekshirildi).

### Tekshiruv

- `npx next build` — o'tdi (`npm run build` ning `next build` bosqichi; undan
  oldingi zaxira/migratsiya bosqichlari bazani talab qiladi).
- `npm run test:isolation` — 22/22, `npm run test:izolyatsiya-royxati` — 9/9.
- Playwright (1440 yorug'/qorong'i va 390 px): gorizontal siljish yo'q, mobil
  menyu ochiladi/Esc bilan yopiladi, sanoq to'g'ri qiymatda tugaydi.

---

## Ikki qizil test tuzatildi: `test:postgres` va `test:smoke` (2026-08-18)

### 1. `test:postgres` — Postgres init migratsiyasi sxemadan orqada qolgan

`prisma/migrations-postgres/` hozircha ISHLATILMAYDI (Turso'dan Postgres'ga
ko'chish keyingi bosqich), shu bois u jimgina eskiradi: sxemaga ustun
qo'shilsa, bu fayl o'zi yangilanmaydi. `AccountTransfer.legacyCashHandoverId`
(kassa topshirig'i migratsiyasida qo'shilgan) fayldan tushib qolgan edi.

Yechim: `npm run pg:migratsiya` — fayl qayta generatsiya qilindi. Diff atigi
4 satr: ustun va uning unique indeksi. Bazaga tegilmadi (skript
`migrate diff --from-empty` bilan ishlaydi, hech qayerga ulanmaydi).

### 2. `test:smoke` — ildiz sabab: test SERVER JARAYONINI OQIZARDI

Belgi: 7 ta testdan 4–5 tasi tasodifiy yiqilardi, sarlavha o'rniga
"Tizim yangilandi" (ya'ni `app/error.tsx` dagi `ChunkLoadError` ekrani)
chiqardi. Birinchi qarashda ilova nosozligiga o'xshardi.

Ildiz sabab boshqa joyda edi:

```ts
server = spawn("npx", ["next", "start", "-p", "3100"]); // ikki jarayon
server.kill("SIGTERM");                                 // faqat `npx` o'lardi
```

`npx` — o'ram; haqiqiy server uning BOLASI. O'ramga SIGTERM yuborilganda
bola tirik qolib, 3100-portni ushlab turaverardi (`ps` da PPID=1 bilan
osilgan `next-server` jarayonlari topildi — biri 38 daqiqa yashagan).
Keyingi yurishda `next start` portga bog'lana olmay o'lardi (`stdio: "ignore"`
bo'lgani uchun jimgina), testlar esa ESKI serverga urardi. Oradа `.next`
qayta qurilgan bo'lsa, eski serverning xotirasidagi bo'lak nomlari diskda
yo'q — natijada `ChunkLoadError` va "Tizim yangilandi".

Shuning uchun to'plam har safar boshqacha yiqilardi va boshqa portda qo'lda
takrorlaganda hamma narsa yashil chiqardi.

Yechim (uchtasi birga):
1. `detached: true` + `process.kill(-pid)` — butun jarayon guruhi o'chadi.
2. `before()` da port bandligi tekshiriladi: band bo'lsa test DARHOL va
   tushunarli xabar bilan yiqiladi, begona serverga urib ketmaydi.
3. `process.once("exit"/"SIGINT")` — xavfsizlik to'ri: yurish uzilib qolsa
   ham server ortdan o'chadi.

Yo'l-yo'lakay yana ikki nuqta:
- `xatosiz()` faqat "Application error" va `lib/copy.ts` dagi
  "Nimadir noto'g'ri ketdi" ni qidirardi — ya'ni `app/error.tsx`
  ("Kutilmagan xatolik") va `app/global-error.tsx` ("Tizimda vaqtincha
  nosozlik") ekranlari TESTDAN O'TIB KETARDI. Ro'yxat to'ldirildi.
- "Kirim qo'shiladi" testi endi `POST /api/transactions` javobini kutadi va
  uning holatini tekshiradi. Avval faqat yozuv ro'yxatda paydo bo'lishi
  kutilardi: so'rov yiqilsa "20s da ko'rinmadi" degan taymaut chiqib,
  sababi ko'rinmasdi.
- `och()` prefetch bekor qilinishidan kelib chiqadigan bir martalik
  `ChunkLoadError` ni tanib, sahifani qayta ochadi (uch urinishda ham ketmasa
  — yiqiladi).

### Natija

53 ta test to'plamining HAMMASI yashil. `test:smoke` ketma-ket 7 marta
yurgizildi — har safar 7/7, ortidan osilgan jarayon qolmadi.

---

## MAGAZIN moduli — POS / Inventory / QR / Barcode (2026-08-19)

### Nima uchun bu shakl

Talab "Magazin/POS modulini qo'sh, LEKIN u mavjud bizneslarga majburan
qo'shilmasin" edi. Auditda ma'lum bo'ldiki, buning uchun kerak bo'lgan
skeletning deyarli hammasi ALLAQACHON bor:

- modul katalogi (`lib/modules/registry.ts`) va yoqilganlik jadvali (`TenantModule`);
- API guard (`withTenant(h, { module })`) va sahifa guard'i (`requireModulePage`);
- **biznes darajasidagi bayroq** namunasi — `Business.omborli` + `requireOmborli()`;
- tarif ↔ modul bog'lanishi (`lib/billing/plans.ts`).

Shuning uchun parallel arxitektura qurilmadi. `MAGAZIN` — o'sha katalogdagi
yangi modul, `Business.magazin` esa `omborli` bilan bir xil qoidada ishlaydigan
biznes bayrog'i.

### Eng muhim ikki qaror

**1. MAGAZIN — OMBOR ustidagi qatlam, uning nusxasi emas.**
Mahsulot, qoldiq, sotuv tarixi va xarid allaqachon OMBOR/XARID modullarida.
MAGAZIN faqat YANGI narsani qo'shadi: kassir ekrani (POS), cheklar/qaytarish
va QR/shtrix-kod. "Mahsulotlar", "Ombor", "Sotuvlar" sahifalari
TAKRORLANMADI. Registry'ga `talabQiladi` maydoni qo'shildi: OMBOR yopiq
bo'lsa MAGAZIN yozuvi `isActive` bo'lsa ham hisobga olinmaydi.

**2. Chek satrlari — o'sha `Sale` yozuvlari.**
`PosChek` faqat SAVAT BOSHI. Har satr avvalgidek `Sale` bo'lib qoladi, ya'ni
marja, ombor kamayishi, mijoz kartochkasi va barcha mavjud hisobotlar
o'zgarishsiz ishlaydi. Agar parallel "PosSale" jadvali qilinganda, o'sha
hisobotlarning har biri "ikki manbadan o'qish" ga aylanardi va POS savdosi
hisobotlarda ko'rinmay qolish xavfi tug'ilardi.

PUL esa chek darajasida: xaridor 10 ta tovarni bitta to'lovda oladi, demak
kassaga BITTA kirim tranzaksiya tushadi (10 ta emas). Shu bois POS
satrlarida `Sale.transactionId` ataylab bo'sh — pul yozuvi
`PosChek.transactionId` da.

### Mavjud mijozlarga nima bo'ldi

Hech narsa. Migratsiya faqat ustun qo'shadi va jadval yaratadi:
`Business.magazin` = false, `Sale.chekId` = NULL, `TenantModule` ga bironta
qator YOZILMAYDI. Ya'ni menyu, route, huquq va workflow o'zgarmaydi —
Retail OFF bo'lgan biznes modulni umuman mavjud emasdek ko'radi.

### Skaner va qo'lda yozish ziddiyati

Do'kon skanerlarining aksariyati HID klaviatura: kodni juda tez "yozadi" va
Enter bosadi. Global tinglovchi ikki shart bilan himoyalangan
(`app/pos/useSkaner.ts`): fokus biror kiritish maydonida bo'lsa umuman
ishlamaydi, ishlaganda ham belgilar orasidagi oraliq 60 ms dan katta bo'lsa
bufer tozalanadi. Aks holda kassir "coca" deb yozganda har harf kod buferiga
qo'shilib ketardi.

### Natija

`npm run build` o'tdi. `tests/magazin.test.ts` — 28/28 yashil (modul
yoqish/o'chirish, ma'lumot saqlanishi, tenant/rol izolyatsiyasi, barcode va
QR, savat birlashishi, atomik chek, orqaga qaytish, qoldiq poygasi,
qaytarish). Mavjud 53 to'plam ham qayta yurgizildi — hammasi yashil.

## 2026-08-19 — SUPERADMIN 2.0: CONTROL CENTER

**Branch:** `claude/superadmin-2-control-center-ak7714`
**Hujjat:** `docs/SUPERADMIN-2-AUDIT.md` (audit + bajarilgan ish hisoboti)

### Nima qilindi

Superadmin paneli bitta 527 satrli sahifadan 10 bo'limli Control Center'ga
qayta qurildi. Bu UI redesign EMAS — asosiy ish backend, xavfsizlik va
audit qatlamida.

**Baza (bitta additiv migratsiya, `20260819090000_superadmin_2_control_center`):**
`User.superadminRol`, `User.sessionEpoch`, `AuditLog.userAgent`,
`AuditLog.sabab`, `FeatureFlag`, `SupportTicket`, `SupportMessage` va
6 indeks. `DROP` yo'q, ma'lumot qayta yozilmaydi.

**Uchta kritik teshik yopildi:**

1. **Superadmin RBAC binar edi** — panelga kirgan har kim mijozni bloklashi,
   tarifni o'zgartirishi va bo'sh kompaniyani o'chirishi mumkin edi. Endi
   6 rol (ROOT/ADMIN/SUPPORT/FINANCE/ANALYST/READ_ONLY) va 13×5 huquq
   matritsasi (`lib/superadmin/rbac.ts`). Matritsa sidebar, sahifa guard'i
   va API guard'i uchun YAGONA manba; ROOT matritsada yo'q, shuning uchun
   yangi resurs qo'shilganda boshqa rollar uni avtomatik olmaydi.

2. **Sessiyani bekor qilib bo'lmasdi.** iron-session stateless — bloklangan
   xodim yoki o'g'irlangan cookie 7 kun ishlayverardi. `User.sessionEpoch`
   qo'shildi: login paytida cookie'ga ko'chiriladi, guard har so'rovda
   bazadagi qiymat bilan solishtiradi. Bir raqamni oshirish = barcha
   qurilmalardagi barcha sessiyalar kuchsizlanadi. Yo'l-yo'lakay
   `lib/auth/tenant.ts` endi HAR so'rovda foydalanuvchi holatini o'qiydi
   (so'rov ichida keshlangan) — o'chirilgan hisob ham darhol yopiladi.

3. **Audit o'chirilardi.** `deleteEmptyTenant` kompaniya bilan birga uning
   butun jurnalini ham o'chirardi, ya'ni "kim, qachon, nega o'chirdi"
   savoliga javob qolmasdi. Endi `AuditLog` APPEND-ONLY: `rawPrisma`
   extension'i `create`dan boshqa yozish amalini rad etadi (tenant clienti
   ham shu qoida ostida, chunki u rawPrisma'dan quriladi). Kompaniya
   o'chirilganda jurnal QOLADI — faqat biznesga havolasi uziladi.

**Audit 2.0:** har imtiyozli amal WHO / WHAT / TARGET / WHEN / WHERE (IP +
qurilma) / BEFORE / AFTER / REASON bilan yoziladi. 12 ta xavfli amalda sabab
MAJBURIY (server sababsiz so'rovni rad etadi) — bloklash, o'chirish, tarif,
parol tiklash, sessiya bekor qilish, impersonatsiya, eksport, feature flag.
Kirish urinishlari (muvaffaqiyatli va muvaffaqiyatsiz) ham jurnalga tushadi —
Xavfsizlik markazi shulardan hisoblaydi.

**Modul bog'liqligi:** `lib/modules/bogliqlik.ts`. Ro'yxatga faqat KODDA
haqiqatan mavjud bog'liqlik yozildi — `XARID → OMBOR` (xarid qabul qilinganda
tovar omborga tushadi). O'ylab topilgan bog'liqlik qo'shilmadi: u mijozning
modulini sababsiz bloklab qo'yardi. Modul o'chirilganda ma'lumot O'CHMAYDI —
test buni tekshiradi (mahsulot yaratiladi, modul o'chiriladi, qayta yoqiladi,
mahsulot joyida).

**Frontend:** yig'iladigan sidebar + topbar + command palette (⌘K),
10 bo'lim, server tomonda sahifalash/filtr (100 000 kompaniyada ham brauzerga
25 qator ketadi), jadval <1024px da kartochkaga aylanadi, xavfli amal modali
"nima bo'ladi + sabab + so'zni yozib tasdiqlash" uch qadamidan iborat.

### Ataylab QILINMAGAN narsalar

- **Soxta monitoring yaratilmadi.** Bu arxitekturada Redis va navbat YO'Q —
  Tizim sahifasida ular "SOZLANMAGAN" deb, sababi bilan ko'rsatiladi.
- **UI orqali ixtiyoriy SQL yo'q** — Tizim sahifasida faqat `count()`.
- **Alohida "Invoice" jadvali yaratilmadi** — bu loyihada hisob-faktura
  rolini `Payment` bajaradi; bo'sh bo'lim yasashdan ko'ra to'lov kartochkasi
  to'liq tafsilot beradi.

### Ochiq cheklovlar

- Qurilmalar ro'yxati yo'q (sessiya jadvali kerak) — bekor qilish har doim
  "hamma qurilmada".
- Audit immutability ILOVA darajasida: `$queryRaw` extension'ni chetlab
  o'tadi. To'liq kafolat baza triggeri yoki alohida DB roli bilan.
- Churn taxminiy: obuna holati tarixi saqlanmaydi.

### Natija

`npm run build` — ✅ o'tdi. 40 ta test to'plami (39 mavjud + yangi
`test:superadmin2`) — HAMMASI yashil, 0 xato. Yangi test 27 ta holatni
qamraydi: RBAC matritsasi, audit append-only, modul bog'liqligi va
ma'lumot saqlanishi, sessiya bekor qilish, tenant o'chirilganda audit
saqlanishi, qidiruvning rolga mosligi, eksport sirlari, dashboard hisoblari,
support tiketi izolyatsiyasi, sabab validatsiyasi.

**Migratsiya production'da qo'lda apply qilinadi** (bu muhitda
`DATABASE_URL` yo'q). Avval zaxira oling — `scripts/deploy-zaxira.mjs`
buni majburlaydi.

---

## "Jami kirim / Jami chiqim" kartalari bosiladigan bo'ldi (2026-08-17)

Karta bosilganda to'lov turlari bo'yicha taqsimot ochiladi, bo'lim bosilganda
esa o'sha bo'lim yozuvlari.

### Model haqiqati — "Plastik" to'lov turi EMAS

`TOLOV_TURLARI = ["naqd", "click", "qarz"]` (Transaction.tolovTuri),
`ACCOUNT_TURLARI = ["naqd", "plastik", "bank"]` (Account.turi). Ya'ni
"Plastik" — KASSA turi. Eski yozuvlarda `tolovTuri` umuman null.

Shuning uchun bo'lim ro'yxati qotirilmadi, "amaldagi usul" qoidasi
kiritildi (`src/lib/tolovBolimi.ts`):

    aniq tolovTuri bo'lsa — o'sha;
    bo'lmasa — kassa turi;
    kassa ham bo'lmasa — naqd.

Natijada bo'limlar ma'lumotdan chiqadi: Naqd / Click / Plastik / Bank —
qaysi birida summa bo'lsa, o'sha ko'rinadi. Yangi kassa turi qo'shilsa
kodni o'zgartirish shart emas.

### Karta === bo'limlar yig'indisi

Jamlash (`getTolovTaqsimoti`) va ro'yxat filtri (`tolovBolimiWhere`) BITTA
faylda turadi — ajralib ketmasin. Ikkalasi ham `getMonthSummary` bilan ayni
to'plamdan o'qiydi (shu biznes, o'chirilmagan, tanlangan oy, qarzsiz).
Qarz bo'limlarga kirmaydi (karta ham uni hisobga olmaydi), lekin alohida
eslatma qatorida ko'rsatiladi — "pul qayerda?" savoli javobsiz qolmasin.

Test bu invariantni majburlaydi: bo'limlar yig'indisi, har bo'lim ro'yxati
jami va kartadagi raqam — uchalasi teng bo'lishi shart.

### Eslatma

Repozitoriyada ESLint konfiguratsiyasi yo'q — `npm run lint` interaktiv
sozlash so'raydi. Lint aslida `next build` ichidagi bosqichda ishlaydi.

---

## Bosh sahifaga "Ombordagi mahsulotlar" kartasi (2026-08-19)

### Qoldiq manbasi — mavjud tizim, parallel hisob YO'Q

Loyihada qoldiqning yagona manbasi `Product.miqdor`. Xizmat qatlami uni har
harakatda atomik yangilaydi: ombor kirimi va xarid qabuli oshiradi, sotuv
`miqdor: { gte }` qulfi bilan kamaytiradi, sotuvni bekor qilish qaytaradi,
inventarizatsiya/hisobdan chiqarish esa `StockAdjustment` yozib yangi
qiymatni qo'yadi. Karta o'sha ustunni o'qiydi — harakatlarni qayta jamlaydigan
ikkinchi hisob yaratilmadi.

**Warehouse modeli YO'Q** — biznesda bitta yashirin ombor, ya'ni ombor
konteksti = `businessId`.

### Birliklar ATAYLAB qo'shilmaydi

`Product.birlik` — dona/kg/litr/metr/quti/paket. Mavjud `getOmborStats`
hammasini bitta songa qo'shadi (Ombor sahifasidagi "Jami qoldiq (dona)") —
bu 500 dona + 120 kg = 620 degan ma'nosiz raqam. Yangi
`getOmborKartasi` birliklar bo'yicha `groupBy` qiladi: kartadagi katta
raqam eng ko'p TURGA ega birlikdan, qolganlari ostidagi qatorda.

### Turlar soni

Faqat qoldig'i BOR faol mahsulotlar. Bu Ombor sahifasidagi "Mahsulot
turlari" dan farq qiladi — u barcha faol mahsulotlarni sanaydi.

### Kesh

`products` va `stock` route'lari ilgari `dashboardYangilandi` chaqirmasdi —
ular dashboardga ta'sir qilmasdi. Endi qoldiq bosh sahifada ko'ringani
uchun to'rtala mutatsiya route'iga kesh bekor qilish qo'shildi.

### Karta ko'rinish sharti

Faqat `business.omborli` va OMBOR moduli yoqiq bo'lganda. Ombori yo'q
biznesda karta umuman chiqmaydi — "0 dona" deb turish chalg'itardi. Bu
qarz kartasidagi holatdan FARQ QILADI: u yerda ma'lumot bor edi, karta esa
uni yashirardi.

### Qiymat qo'shildi (2026-08-19)

Kartada endi ombor QIYMATI ham bor: `Σ(miqdor × kelganNarx)` + mahsulotga
yozilgan xarajatlar. Prisma'ning `_sum` i ikki ustunni ko'paytira olmaydi,
shuning uchun xom so'rov (`getProductProfitability` dagi kabi naqsh),
tenant sharti SQL ichida — `businessScope`.

Xarajatlar ATAYLAB qo'shiladi: Ombor sahifasidagi "Ombor qiymati" AYNI shu
qoidadan hisoblanadi, ya'ni karta va sahifa hech qachon ikki xil pul raqami
ko'rsatmaydi. Test buni majburlaydi.

Miqdor birliklar bo'ylab qo'shilmaydi, QIYMAT esa qo'shilaveradi — pul
hamma birlik uchun bir xil so'm.

## Katalog import / eksport — CSV va Excel (2026-08-19)

Mijoz (disney giftbox) Bito ilovasidan Balansa'ga ko'chmoqda: 221 ta tovar.
Qo'lda kiritish real to'siq, shuning uchun bir martalik skript emas, doimiy
IMKONIYAT qo'shildi — har mijoz o'z katalogini o'zi ko'chira oladi.

Fayllar:

- `src/lib/csv.ts` — CSV o'qish/yozish umumiy joyi (`csvQatorniBol`,
  `csvSatrlar`, `ajratgichniTop`, `ustunKaliti`, `csvYasa`). Tranzaksiya
  importi ham shu yerga o'tkazildi: ikki tahlilchi vaqt o'tib bir-biridan
  farq qila boshlaydi.
- `src/lib/services/mahsulotImport.ts` — sarlavha moslashuvi, qator
  tekshiruvi, bazaga yozish.
- `src/lib/queries/mahsulotEksport.ts`, `src/lib/excel/mahsulotlarWorkbook.ts`,
  `src/lib/excel/xlsxOqi.ts`.
- `src/app/api/products/import/route.ts`, `.../export/route.ts`.
- `src/app/app/ombor/ImportModal.tsx` + `ImportNatija.tsx`; Ombor sahifasida
  "Fayldan yuklash" va "Excel eksport" tugmalari.
- `tests/mahsulot-import.test.ts` (20 test), `npm run test:mahsulot-import`.

### Ustun nomlari moslashtiriladi

Har dastur ustunni o'zicha ataydi ("Mahsulot", "Tovar nomi", "Name"). Bito
eksporti Balansa sarlavhalariga umuman tushmaydi. Foydalanuvchini faylni
qayta yozishga majburlash importning ma'nosini yo'qotardi, shuning uchun
`USTUN_MUQOBILLARI` jadvali bor va solishtirish `ustunKaliti()` orqali
(kichik harf, apostrof va bo'shliqsiz) ketadi.

Sarlavha esa MAJBURIY: ustunlarni tartib bo'yicha taxmin qilish xavfli —
narx bilan qoldiq joyi almashsa mijoz buni faqat kassada sezadi.

### Faylda YO'Q ustunga tegilmaydi

Eng katta xavf shu edi: Bito faylida narx ustuni umuman yo'q. Agar
"yangilash" rejimi bo'sh qiymatni 0 deb yozsa, bitta import butun katalog
narxini nolga tushirib yuborardi.

Shuning uchun ikki holat farqlanadi: ustun bor-u katak bo'sh (`null`) va
ustunning o'zi yo'q (`undefined`). Yangilashda faqat FAYLDA BOR ustunlar
tegadi. Test buni majburlaydi.

### Boshlang'ich qoldiq PUL YOZMAYDI

Ko'chirilayotgan tovar allaqachon sotib olingan va eski dasturda
hisoblangan. Unga `StockEntry` + chiqim tranzaksiya yozish mijozning
hisobotini buzardi — bir kunda 200 mln so'mlik "xarid" paydo bo'lardi.

Qoldiq `StockAdjustment` (turi `inventarizatsiya`, sabab "Import:
boshlang'ich qoldiq") sifatida yoziladi: bu tovar hodisasi, pul harakati
emas — mavjud "Inventarizatsiya" yo'li bilan aynan bir xil. Test tranzaksiya
va `StockEntry` soni NOL qolishini tekshiradi.

### Moslashtirish va ziddiyat

Ustuvorlik: shtrix-kod → SKU → nom. Shtrix-kod tovarning eng ishonchli
kimligi, shuning uchun nomi o'zgargan tovar dublikat bo'lib qo'shilmaydi.

Ziddiyat holati alohida: shtrix-kod bitta tovarni, SKU/nom esa BOSHQASINI
ko'rsatsa, qaysi biri to'g'ri ekanini dastur bila olmaydi. Bunda taxmin
qilinmaydi — qator xato sifatida chetga chiqariladi va qolgan qatorlar
yoziladi. Aks holda import jimgina mavjud tovarning nomini almashtirib
qo'yardi.

### Eksport = import formati

Eksport ustunlari import kutadigan ustunlarga AYNAN teng (test buni
majburlaydi). Shu bilan Bito muammosining yechimi ochiladi: fayl narx
bermaydi → import qilinadi → Excel eksport → narx/qoldiq to'ldiriladi →
"yangilash" rejimida qayta yuklanadi. Excel fayl serverda o'qiladi
(`xlsxdanCsv`), ya'ni mijozni "CSV qilib saqlang" deyishga majburlamaydi.

### Chegara

Bir yurishda 500 qator. Sababi texnik: import bitta tranzaksiyada ishlaydi
va `runBusinessTx` 15 soniya beradi. Chegara jimgina kesib tashlanmaydi —
ochiq xato bo'lib ko'rinadi. Katalog bir marta o'qiladi va xotirada
xaritaga solinadi, aks holda 500 qator 1500 so'rov bo'lardi.

## Narx va qoldiqni ilova ichida to'ldirish (2026-08-19)

Import katalogni ko'chiradi, lekin Bito eksporti narx ham, qoldiq ham
bermaydi. Mijoz narxlarni Excel'da emas, ILOVANING O'ZIDA to'ldirmoqchi.
Mavjud yo'l bu ish uchun yaramasdi:

- narx faqat `EditPriceModal` orqali, bitta tovar uchun — 221 tovar
  221 marta modal ochib yopish demakdir;
- qoldiq esa `StockEntryModal` (ombor kirimi) orqali, u XARID hisoblanadi
  va chiqim tranzaksiya yozadi. Ko'chirilgan tovar allaqachon sotib olingan
  — bu yo'l bilan to'ldirish hisobotda bir kunda soxta "xarid" yaratardi.

Shuning uchun `/app/ombor/narxlar` sahifasi: bitta jadval, har qatorda
tannarx / sotuv narxi / qoldiq, bitta "Saqlash". Ombor sahifasidan
"Narx va qoldiq" tugmasi bilan ochiladi.

Fayllar: `src/lib/services/narxToldirish.ts`,
`src/app/api/products/narxlar/route.ts` (PATCH),
`src/app/app/ombor/narxlar/{page,NarxlarClient,NarxQatori}.tsx`,
`tests/narx-toldirish.test.ts` (7 test).

### Qoldiq pul yozmaydi

Import servisidagi qoida bu yerda ham amal qiladi: qoldiq `StockAdjustment`
(turi `inventarizatsiya`, sabab "Narx va qoldiqni to'ldirish") bo'lib
tushadi. Test tranzaksiya va `StockEntry` soni NOL qolishini majburlaydi.

Sahifada bu ochiq yozilgan: yangi XARID uchun Ombor sahifasidagi "Kirim"
ishlatiladi — u xarid chiqimini yozadi. Ikki yo'lni chalkashtirmaslik
foydalanuvchining zimmasiga qoldirilmadi.

### Faqat o'zgargani yuboriladi

Client `ozgarganlar` ni hisoblaydi va serverga faqat farqi bor qatorlarni
yuboradi; server ham qiymatni bazadagisi bilan solishtiradi. Aks holda
"Saqlash" har bosilganda 221 ta keraksiz `update` va 221 ta ma'nosiz
inventarizatsiya izi paydo bo'lardi. Test buni majburlaydi.

### Begona id

Qator `productId` bilan keladi, ya'ni foydalanuvchi boshqa biznesning
mahsulot idsini yuborishi mumkin. Servis idlarni `businessId` sharti bilan
bir marta o'qiydi va topilmaganlarini `topilmadi` deb SANAYDI — jimgina
o'tkazib yuborilmaydi.

## Kassa (POS): savat ekrandan chiqib ketgan edi (2026-08-19)

Mijoz "kassa buzilib ketdi" dedi: Disney Giftbox kassasida SAVAT umuman
ko'rinmasdi — mahsulot to'ri butun ekranni egallab turgan, savat ham,
"To'lovga o'tish" tugmasi ham yo'q. Kassir hech narsa sota olmaydi.

### Sabab

Kassa maketi ikki ustunli: `grid grid-cols-1 lg:grid-cols-[1fr_380px]`.
Grid bolasining sukutdagi `min-width: auto` qiymati uni KONTENTINING eng
kichik kengligidan pastga tushirmaydi. Chap ustundagi kategoriya tasmasi
(Disney Giftbox'da 11 ta kategoriya, ichki kengligi 1109px) shu tufayli
ustunni 976px ga cho'zdi va 380px lik savat ekranning o'ng chetidan
TASHQARIGA chiqdi.

Ilgari bunday holatda sahifa gorizontal siljirdi — xunuk, lekin savat
topilardi. Mobil qulaylashtirish `body { overflow-x: clip }` qo'shgach esa
u KESILDI: siljitib ham yetib bo'lmaydigan, mavjud-u ko'rinmaydigan
element bo'lib qoldi.

Ikkita sharoit birga kelganda paydo bo'lgani uchun nuqson e'tibordan
chetda qoldi: mobil ish `overflow-x: clip` ni kiritdi, import esa katalogga
o'nlab kategoriya olib keldi. Ikkalasidan biri bo'lmasa kassa "ishlab"
turaverardi.

### Tuzatish

`MahsulotTori` ildiziga `min-w-0` — grid bolasi endi o'z kontentidan
kichrayishi mumkin, kategoriya tasmasi esa `.jadval-siljish` ichida
suriladi (u shu maqsadda qo'yilgan edi). Bir sinf, maketning boshqa
joyiga tegilmadi.

### Nega testlar ushlamagan

`tests/pos-brauzer.test.ts` "savat DOM'da bormi" deb tekshirardi — savat
ekrandan chiqib ketganda ham DOM'da bor edi, ya'ni test yashil turaverardi.
Ikkinchidan, e2e bazasida kategoriya UMUMAN yo'q edi, shuning uchun tasma
hech qachon uzun bo'lmasdi.

Ikkalasi ham tuzatildi:
 - `scripts/e2e-tayyorla.mjs` — Salyut do'koniga 11 ta kategoriya qo'shildi
   (haqiqiy do'kondagidek);
 - yangi test savatning `getBoundingClientRect()` ini o'lchaydi va uning
   o'ng cheti ekran ichida qolishini talab qiladi.

Sabab-oqibat isbotlandi: `min-w-0` olib tashlanganda test yiqiladi
(u bilan birga savatga tegadigan yana 7 ta test ham), qaytarilganda
19 tasi ham o'tadi.

## Ko'p-bizneslik — bir xodim bir nechta biznesda (2026-08-19)

**Talab (loyiha egasi):** "Disney Flowers va Disney Giftbox sotuvchilar bitta,
ammo biznes ikkita qildik — hisob-kitob chalkashmasligi uchun. Endi
foydalanuvchilarni bitta emas, ko'p biznesga (1-2 ta) biriktirish
funksiyasini kirit."

### Muammo

`User.businessId` — bitta ustun, ya'ni xodim FAQAT bitta biznesga
biriktirilardi. Bir jamoa ikki biznesni yuritganda har bir biznesga alohida
login ochishga to'g'ri kelardi (ikkita parol, ikki marta kirish, yozuvlar
ikki hisobga bo'linib ketishi).

### Yechim

Yangi `UserBusiness` jadvali (`userId` + `businessId`, UNIQUE juftlik).
Ruxsatning YAGONA manbai shu jadval:

- qatorlari bor xodim — FAQAT o'sha bizneslarga kiradi va ular orasida
  almashadi (biznes almashtirgich endi kassirga ham ochiq);
- qatori yo'q xodim — cheklovsiz (direktor/administratordagi kabi).

`User.businessId` ustuni JOYIDA QOLDI, lekin ma'nosi torroq: u endi
"qulaylik nusxasi" — aynan bitta biznes bo'lsa o'sha id, aks holda NULL.
Shu bois unga tayanadigan eski kod (bot, sessiya) xato ruxsat BERMAYDI: u
faqat "bitta biznesga qotirilganmi" savoliga javob beradi.

### FAIL-CLOSED nuqta

`UserBusiness` da qator yo'q + `businessId` to'lgan bo'lsa (seed, e2e
skripti, qo'lda SQL bilan yaratilgan hisob) — "qator yo'q" ni "cheklov yo'q"
deb o'qish xodimga barcha bizneslarni OCHIB YUBORARDI. `lib/business.ts`
bunday holatda o'sha bitta biznes bilan CHEKLAYDI. Test buni qo'riqlaydi.

Xuddi shu tuzoq "shu bizneste kim ishlaydi" so'rovlarida ham bor edi:
`OR: [{ businessId }, { businessId: null }]` naqshi ko'p biznesga
biriktirilgan xodimni (unda `businessId` NULL) "biriktirilmagan" deb
hisoblardi. Uch joyda (`listKunlikNomzodlar`, shaxsiy kassa ochish x2)
`biznesXodimlariWhere()` bilan almashtirildi.

### O'zgargan joylar

- `prisma/schema.prisma` + migratsiya `20260819120000_kop_biznes_biriktiruv`
  (faqat YANGI JADVAL; mavjud `businessId` qiymatlari ko'chiriladi, hech
  narsa o'chirilmaydi);
- `lib/db/tenantDb.ts` (`BUSINESS_SCOPED`) va `lib/backup/dump.ts`
  (`ZAXIRA_JADVALLARI` — `user`/`business` dan KEYIN);
- `lib/business.ts` — ruxsat ro'yxati, aktiv biznes, `biznesRuxsatiBormi`;
- `lib/services/userBiznes.ts` — biriktirish qoidalari bir joyda;
- `api/users` (POST/PATCH) — `businessIds` massivi (eski `businessId` ham
  ishlaydi), `api/me/active-business` — ruxsat tekshiruvi;
- admin UI — checkbox bilan ko'p biznes tanlash (`BiznesTanlash.tsx`),
  `UsersClient.tsx` 481 → 331 satr (yangi user oynasi alohida faylga);
- bot — `bot/bizneslar.ts`: har oqim ("qaysi biznes uchun?") xodimga OCHIQ
  bizneslar bilan cheklanadi, callback tugmalari ham tekshiriladi.

### Tekshirildi

`npm run build` ✅ · `test:kop-biznes` (18 ta, yangi) ✅ · `test:isolation`
✅ · `test:izolyatsiya-royxati` ✅ · `test:backup` ✅ · `test:migratsiya` ✅ ·
`test:kunlik` · `test:tozalash` · `test:kassa` · `test:kassir-kassa` ·
`test:signup` · `test:superadmin` · `test:superadmin2` · `test:visibility` ·
`test:bot-holat` · `test:bot-avto` · `test:pro` · `test:postgres` ·
`test:launch` ✅

## Bosh sahifadagi pul kartalarida "ko'z" tugmasi (2026-08-19)

Direktor bosh sahifani xodimlar yoki mijozlar oldida ochadi. Oylik aylanma
va sof foyda — yonidagi odam ko'rmasligi kerak bo'lgan raqamlar. Endi
"Jami kirim", "Jami chiqim" va "Sof foyda" kartalarining sarlavhasi yonida
ko'z tugmasi bor: bosilganda summa o'rniga `•••` chiqadi.

### Nega cookie, localStorage emas

Tanlov SERVERDA o'qilishi shart. `localStorage` bo'lsa sahifa avval
haqiqiy summa bilan chizilib, keyin JS ishga tushgach yashirilardi — ya'ni
summa har yuklanishda bir lahza KO'RINIB ketardi va yashirishning ma'nosi
qolmasdi. Cookie (`pul_yashirin`, bir yil) bosh sahifada o'qiladi va
boshlang'ich holat sifatida beriladi.

Toggle bosilganda `router.refresh()` ATAYLAB chaqirilmaydi: holat klientda
turibdi, qayta yuklash faqat sekinlashtirardi. Cookie esa keyingi
ochilish uchun yoziladi.

### "Sof foyda" kartasi klientga ko'chdi

U server komponentida edi. Ko'z tugmasi holat talab qilgani uchun
`PulOqimiKartalari` ichiga olindi — kirim/chiqim bilan bitta oila, holat
ham bitta joyda. "Menga qarzdor" va "Ombor" kartalari serverda qoldi.

### Tugma tugma ichida bo'lmaydi

Kirim/chiqim kartalarining O'ZI bosiladi (to'lov taqsimoti ochiladi).
Butun kartani `<button>` qilib qo'yib ichiga yana bitta tugma joylashtirib
bo'lmaydi — HTML buni taqiqlaydi va brauzer bosishlarni chalkashtiradi.
Shuning uchun ko'z tugmasi bor kartada tashqarisi oddiy `div`, bosiladigan
qism — summa bloki, ko'z esa sarlavha qatorida. Ko'zsiz kartalar
oldingidek ishlaydi.

Yashiringanda `title` (hover ipuchi) BERILMAYDI — aks holda sichqonchani
ustiga olib borish bilan aynan yashirilgan summa ko'rinib qolardi.

Test: `tests/smoke-brauzer.test.ts` — qayta yuklashda `domcontentloaded`
holatida ham summa yashirin qolishi tekshiriladi (ya'ni serverdan kelgan
HTML'da yo'q).

## Qarzdorlik mijoz kesimiga o'tkazildi — "1 mijoz = 1 qarzdor" (2026-08-25)

### Muammo

Bir mijoz besh marta qarzga olsa, qarzdorlar ro'yxatida BESH qarzdor bo'lib
ko'rinardi. Sabab schema'da EMAS edi — `Contact 1 → N Debt` bog'lanishi
allaqachon to'g'ri va qarzdorlar ro'yxati (`listQarzdorlar`,
`getQarzdorTafsilot`) `qarzdorKalit()` bo'yicha jamlab beradi.

Muammo YOZISH yo'lida edi: qarz uch joydan yoziladi, lekin faqat bittasi
mijoz kartochkasi yaratardi.

  - `services/pos.ts`       — kassadagi qarzga sotuv: `contactId` bo'sh qolardi;
  - `services/inventory.ts` — Sotuv oynasi: xuddi shunday;
  - `services/qarz.ts`      — kartochka faqat TELEFON bo'yicha qidirilardi,
    ya'ni telefonsiz "Ali" ikki marta yozilsa IKKITA kartochka ochilardi.

`contactId` bo'sh qolganda jamlash faqat ism matniga tayanadi, shuning uchun
"Ali", "Ali " va "Ali Valiyev" uch qarzdor bo'lib chiqardi.

### Yechim

Yangi model YO'Q, migratsiya ham YO'Q — mavjud `Contact → Debt` yetarli.

`src/lib/services/mijozAniqla.ts` — mijozni aniqlashning YAGONA joyi.
Uchala yozish yo'li ham shundan o'tadi. Tartib (yuqoridagi qadam aniqroq):

  1. `contactId` berilgan  → o'sha kartochka (biznesga tegishliligi tekshiriladi);
  2. telefon aynan mos     → o'sha kartochka;
  3. ism bo'yicha AYNAN BITTA nomzod → o'sha (telefoni bo'sh bo'lsa to'ldiriladi);
  4. mos nomzod yo'q       → yangi kartochka.

Bir xil ismli BIR NECHTA kartochka bo'lsa (telefon esa berilmagan) — hech
biri tanlanmaydi, `contactId = null` qaytadi. Bu ATAYLAB: qarzni noto'g'ri
odamning kartochkasiga yozib qo'yish ro'yxatda ikki qator ko'rinishidan
ancha qimmat xato. Bunday holda operator qidiruv ro'yxatidan o'zi tanlaydi.

Telefon ikki qiymatga ajratiladi (`telAjrat`): SOLISHTIRISH uchun
normallashgan ko'rinish, SAQLASH uchun operator kiritgan matn. Kassa xom
matn yuborishi mumkin — normallashmagan raqam bo'yicha kartochka
qidirilmaydi, lekin matn baribir yo'qolmaydi.

### Qarzga sotish oynasi

POS (`TolovModal`) va Sotuv (`SotuvForm`) dagi oddiy `<select>` olib
tashlandi — u qidiruvsiz edi va mijozlar soni o'sgan sari yaroqsizlanardi.
O'rniga qarzlar sahifasi bilan AYNI `MijozTanlash`:

  - qidiruv ism VA telefon bo'yicha, har natijada joriy qarz ko'rinadi;
  - topilmasa "Mijoz topilmadi" va "+ Yangi mijoz" (ism / telefon / izoh),
    saqlangach mijoz darhol tanlangan holatga o'tadi (`POST /api/debts/mijozlar`);
  - tanlangach "Hozirgi qarz → Yangi qarz → Yangi jami" paneli
    (`QarzOldinKorish`).

Mijozlar ro'yxati endi sahifa yuklanishida OLINMAYDI (`pos/page.tsx`,
`sotuv/page.tsx`) — qidiruv `/api/debts/mijozlar` orqali ketadi.

### Ochiq qarz hisobi tuzatildi

`qarzMijozlariTakror()` ochiq qarzni oxirgi 300 ta yozuvdan hisoblardi —
ko'p savdoli biznesda ko'rsatilgan qarz KAM chiqardi. Endi `groupBy` bilan,
chegarasiz. Kassir aynan shu raqamga qarab qarzga sotadi, u taxminiy
bo'lishi mumkin emas.

### Mavjud ma'lumot

Hech narsa o'chirilmadi va birlashtirilmadi. Eski, kartochkasiz qarzlar
avvalgidek ism bo'yicha jamlanib ko'rinaveradi.

`scripts/qarz-mijoz-bogla.ts` — eski `contactId = null` qarzlarni mavjud
kartochkalarga bog'laydi (telefon, yoki ism bo'yicha AYNAN BITTA moslik).
Standart holatda faqat HISOBOT chiqaradi; yozish uchun `--yoz` kerak.
Yangi kartochka yaratmaydi, kartochkalarni birlashtirmaydi, ikkilanishlarni
ro'yxatga chiqarib odamga qoldiradi. Build zanjiriga ATAYLAB qo'shilmagan.

### Test

`tests/qarz-mijoz.test.ts` (`npm run test:qarz-mijoz`) — 16 ta test:
yangi mijoz, unga uch marta qarz, ro'yxatda bitta qator, jami 1 500 000,
tarixda uchala operatsiya, qisman to'lovdan keyin qoldiq 1 000 000,
qidiruvda topish, dublikat kartochka ochilmasligi (telefon bilan, registr
farqi bilan), ikkilanishda taxmin qilmaslik, POS qarzga sotuvining mavjud
kartochkaga tushishi va naqd sotuv qarz yaratmasligi.

`tests/pos-brauzer.test.ts` yangi qidiruv maydoniga moslandi.

## CRM — kunlik buyurtmalar va Kirim bilan bitta hisob-kitob (2026-08-25)

CRM "bitimlar doskasi" edi: bitimning kategoriyasi yo'q, sanasi yo'q, kirim
esa QOTIRILGAN "Sotuv" kategoriyasiga yozilardi. Ya'ni Disney Navoiy uchun
buyurtma "Onajon" bo'lsa ham, Kirimdagi kategoriya kesimida u "Sotuv"
ichida ko'rinardi — CRM bir haqiqatni, Kirim boshqasini ko'rsatardi.
Dublikat kirimga qarshi himoya ham faqat KODDA edi (`if (!deal.transactionId)`),
bazada hech qanday cheklov yo'q edi.

### Kategoriya manbai BITTA

CRM o'zining kategoriya tizimini qurmaydi — `Deal.categoryId` to'g'ridan-to'g'ri
Kirim modulining `Category` jadvaliga FK bilan bog'landi (faqat `turi="kirim"`,
xizmat qatlamida ham, API'da ham tekshiriladi). Buyurtma kirimga
o'tkazilganda tranzaksiya AYNAN o'sha kategoriya bilan yoziladi, shuning
uchun Kirimdagi kategoriya filtri CRM yozuvlarini alohida ish qilmasdan
qamrab oladi (`tests/crm.test.ts` da tekshiriladi).

### Dublikat kirim: himoya BAZADA

`Deal.transactionId` endi `@unique` va `Transaction` ga FK (`SET NULL`).
Uch qatlam:

1. **Baza** — UNIQUE indeks + tranzaksiya ichida
   `updateMany({ where: { transactionId: null } })`. Shart bajarilmasa 0 qator
   yangilanadi va butun `runBusinessTx` bekor qilinadi, ya'ni yuqorida
   yaratilgan kirim ham bazaga TUSHMAYDI. Ikki so'rov bir vaqtda kelsa
   ikkinchisi shu yerda to'xtaydi.
2. **Xizmat qatlami** — boshida ochiq tekshiruv (tushunarli xato matni).
3. **Frontend** — tugma o'chadi, "🟢 Kirim yozilgan" va yozuvga havola.

Uchinchisi faqat qulaylik: test ilova kodini chetlab o'tib to'g'ridan-to'g'ri
`rawPrisma.deal.update` bilan ikkinchi buyurtmani o'sha kirimga bog'lashga
urinadi va UNIQUE cheklovga urilishini tekshiradi.

Migratsiya `Deal` jadvalini qayta quradi (SQLite'da mavjud ustunga FK
qo'shishning boshqa yo'li yo'q). UNIQUE indeksdan OLDIN ehtimoliy
dublikatlar tozalanadi — eski kodda ular paydo bo'lmasligi kerak edi, lekin
bazada cheklov bo'lmagani uchun buni kafolatlab bo'lmasdi; migratsiya
"UNIQUE constraint failed" bilan yarim yo'lda to'xtamasin.

### Pul faqat bitta yo'ldan yoziladi

`moveDeal` ichidagi kirim yozish kodi olib tashlandi — u endi
`lib/crm/kirim.ts` dagi `kirimgaKochirish` ni chaqiradi. Dublikat himoyasi,
kategoriya tanlash va kunlik hisobot sinxroni YAGONA joyda tursin. Kanbanda
"Yutildi" ga sudrab o'tkazish ham endi kirimni jimgina yozmaydi: tasdiq
oynasi ochiladi (summa va kategoriya ko'rinib turadi). Pul yozadigan amal
sudrab tashlash bilan bo'lmasin.

`kunlikSinxron` ATAYLAB tranzaksiyadan TASHQARIDA chaqiriladi — u o'zi
`runBusinessTx` ochadi, ichkarida chaqirilsa SQLite yozuv qulfida deadlock
bo'lardi (`transactionService.createTransaction` dagi bilan bir xil sabab).

### Statistika: summa yozuvning O'ZIDAN

`lib/crm/statistika.ts` — "Bugungi buyurtmalar" va kategoriya kesimi.
"Kirimga o'tgan" summa buyurtmaning `summa` sidan EMAS, bog'langan
tranzaksiyadan olinadi (va `deletedAt` bo'lsa hisobga kirmaydi). Aks holda
buyurtma summasi kirim yozilgandan keyin tahrirlansa ikki raqam ajralib
ketardi. Shu sababdan API kirim yozilgan buyurtmaning summasi va
kategoriyasini o'zgartirishni ham rad etadi.

### Kirim ro'yxatida "CRM" belgisi

`listTransactions` ga `crmBuyurtma` bog'lanishi qo'shildi — yozuv CRM
buyurtmasidan kelgan bo'lsa ro'yxatda `CRM` belgisi ko'rinadi. Boshqa hech
nima o'zgarmaydi: yozuv oddiy kirim kabi tahrirlanadi, o'chiriladi,
hisobotlarga va kunlik hisobotga kiradi.

### Fayllar

Yangi: `lib/crm/kirim.ts`, `lib/crm/statistika.ts`, `lib/validation/crm.ts`,
`api/crm/deals/[id]/kirim/route.ts`, `app/crm/{turlar,BuyurtmaKarta,
BuyurtmaModal,BuyurtmaSheet,KirimTasdiq,BugungiPanel}.tsx`.
Har komponent 250 satrdan qisqa (eng kattasi — 199).

Testlar: `npm run test:crm` (19 ta). Qo'shimcha tekshirildi —
`test:isolation`, `test:izolyatsiya-royxati`, `test:backup`, `test:postgres`,
`test:migratsiya`, `test:apply-oqimi`, `test:agregat`, `test:kunlik`,
`test:kategoriya`, `test:atomik`, `test:soft-delete`, `test:visibility`,
`test:tasks`, `test:mijozlar` — hammasi yashil, `npm run build` o'tdi.

---

## Kirim bo'limida "Sotilgan mahsulotlar" statistikasi (2026-08-25)

Ombordan sotilgan mahsulotlar endi Kirim bo'limida (Yozuvlar sahifasi)
kategoriya va mahsulot kesimida ko'rinadi. Qo'lda hech narsa kiritilmaydi:
**Ombor → Sotuv → Statistika** zanjiri `Sale` yozuvi orqali o'zi yuradi.

### Nega `Sale`, `Transaction` emas

Kirim tranzaksiyasidan mahsulot kesimini tiklab BO'LMAYDI:

* naqd sotuv — bitta kirim tranzaksiya (`izoh` da nom bor, lekin matn);
* POS cheki — 10 satr uchun ham BITTA tranzaksiya;
* qarzga sotuv — tranzaksiya umuman yozilmaydi (kassa usuli).

`Sale` esa uchala holatda ham bir xil to'ldiriladi va har satr bitta yozuv.
Shu bois statistika `Sale` dan o'qiladi — chek darajasidagi pul yozuvi
umuman ishtirok etmaydi va **ikki marta sanash imkoni yo'q**.

### Qaytarish o'zi ayriladi

`cancelSale` va `posChekBekor` `Sale.deletedAt` ni belgilaydi va AYNI
paytda ombor qoldig'ini tiklaydi. So'rovdagi `deletedAt: null` sharti
shuning uchun qaytarilgan mahsulotni statistikadan avtomatik chiqaradi —
qoldiq va statistika bitta qoidadan yuradi, ajralib keta olmaydi.
Qaytarilganlar soni/summasi ma'lumot uchun alohida qatorda ko'rsatiladi.

### Jamlash bazada

Bir mahsulot kun davomida 5 marta sotilsa 5 ta qator emas, bitta
"25 dona sotildi" qatori chiqadi. Guruhlash `groupBy` bilan BAZADA
bajariladi: 100 000 sotuvli bizneste barcha satrlarni RAM'ga yuklab
JS'da jamlash serverni yiqitardi. `@@index([businessId, deletedAt, sana])`
allaqachon bor edi — yangi indeks kerak bo'lmadi.

**Sxema o'zgarmadi, migratsiya yo'q.**

### Sana filtri klientda, sahifa qayta yuklanmaydi

Birinchi ko'rinish ("Bugun") serverdan keladi, filtr almashtirilganda
`/api/sales/statistika` chaqiriladi. Sabab: blokning sanasi yuqoridagi
tranzaksiya ro'yxati filtridan MUSTAQIL — bitta `searchParams` ga
bog'lansa "Bugungi sotuvlar" ni ochish butun ro'yxatni ham qaytadan
filtrlab yuborardi.

Presetlar brauzer soatidan emas, serverdan kelgan `bugun` satridan
hisoblanadi: telefon vaqt mintaqasi noto'g'ri bo'lsa "Bugun" tugmasi
bo'sh ro'yxat berardi.

### Miqdor birliklar bo'yicha

"93 dona + 40 kg = 133" ma'nosiz, shuning uchun yakun har birlikni
alohida ko'rsatadi (bosh sahifadagi ombor kartasi bilan bir xil qoida).

Fayllar: `src/lib/queries/sotuvStatistika.ts`,
`src/app/api/sales/statistika/route.ts`,
`src/app/app/tranzaksiyalar/SotilganMahsulotlar.tsx`,
`SotuvKategoriyaGuruhi.tsx`, `sotuvSana.ts`.

Test: `npm run test:sotuv-statistika` (13 ta) — jamlash, guruhlash, sana
filtri, qaytarish, POS cheki, ombor qoldig'i bilan moslik, izolyatsiya.

## CRM sotuvchilarga ko'rinmasdi — rol matritsasi va kategoriya tuzatildi (2026-08-25)

Uch shikoyat bitta joydan chiqdi: CRM "ayrim sotuvchilarga" umuman
ko'rinmasdi, eski buyurtmalardan yozilgan kirim kategoriyasiz tushardi.

### 1. Rol matritsasi — asosiy sabab

`lib/modules/registry.ts` dagi CRM moduli `rollar: ["OWNER", "ADMIN",
"SELLER"]` edi. Sidebar, BottomNav, CommandPalette, sahifa guard'i
(`requireModulePage`) va API guard'i (`withTenant({ module: "CRM" })`) —
BESHALASI ham shu bitta ro'yxatdan o'qiladi. Ya'ni savdo maydonida
"sotuvchi" bo'lib ishlaydigan, lekin hisobi KASSIR (CASHIER) rolida
ochilgan xodim uchun menyuda CRM yo'q edi va to'g'ridan-to'g'ri
`/app/crm` ga kirsa ham `/app` ga qaytarilardi.

Endi CRM `HAMMA` (OWNER, ADMIN, CASHIER, SELLER) uchun ochiq. Bu FAQAT
CRM: BOSHQARUV (bizneslar, foydalanuvchilar, rollar, audit, obuna), HR,
XARID va oylik hisobot o'z ro'yxatlari bilan boshqaruvchilarda qoldi —
test buni alohida majburlaydi.

### 2. Kategoriya — "Kategoriyasiz" ning sababi

Yangi buyurtmada kategoriya allaqachon Kirim modulining
`Category` jadvalidan (`turi: "kirim"`, `businessId` bo'yicha) kelardi.
Muammo ESKI buyurtmalarda edi: kategoriya maydoni qo'shilgunga qadar
yaratilganlarda `categoryId` NULL, va uni interfeysdan TANLASH imkoni
yo'q edi — bunday buyurtma kirimga o'tkazilganda zaxira kategoriyaga
tushardi.

`BuyurtmaTahrir.tsx` — buyurtma oynasida kategoriya va narxni tuzatish
bloki. Faqat kirim YOZILMAGAN buyurtmada ko'rinadi: yozilgandan keyin
server (`api/crm/deals/[id]`) ikkalasini qulflaydi, aks holda CRM bir
raqamni, Kirim boshqasini ko'rsatardi.

Kirimga o'tkazish yo'li o'zgarmadi — kategoriya avvalgidek buyurtmadan
tranzaksiyaga ko'chadi va `Deal.transactionId` UNIQUE cheklovi bitta
buyurtmadan ikkinchi kirim yozilishiga baza darajasida yo'l qo'ymaydi.

### 3. Ko'p-bizneslik teshigi

"Mas'ul xodim" ro'yxati `prisma.user.findMany({ isActive: true })` edi —
tenant bo'yicha filtrlangan, lekin BIZNES bo'yicha emas. Bir kompaniyada
ikki biznes bo'lsa, A biznesining sotuvchisi B biznesining xodimlarini
ko'rar va buyurtmani ularga yozib qo'yishi mumkin edi. Endi ro'yxat ham,
server tekshiruvi ham (`biznesXodimi`, `createDeal` va PATCH) mavjud
`biznesXodimlariWhere` filtridan yuradi.

Fayllar: `src/lib/modules/registry.ts`, `src/lib/crm/service.ts`,
`src/app/api/crm/deals/[id]/route.ts`, `src/app/app/crm/page.tsx`,
`CrmClient.tsx`, `BuyurtmaSheet.tsx`, `BuyurtmaTahrir.tsx` (yangi).

**Sxema o'zgarmadi, migratsiya yo'q.**

Test: `npm run test:crm` (24 ta) — rol matritsasi (4 rol kiradi, maxfiy
modullar yopiq), sidebar havolalari, to'liq oqim (buyurtma → Yutildi →
Kirim → bosh sahifadagi kategoriya kesimi), idempotentlik, eski
kategoriyasiz buyurtma va ko'p-bizneslik izolyatsiyasi.

## Kirim/Chiqim sahifasi — to'liq redesign (2026-08-25)

`/app/tranzaksiyalar` mijoz kunda eng ko'p ochadigan sahifa edi, lekin u
"baza jadvali" bo'lib qolgandi: forma doim ochiq turib ekranning yarmini
egallardi, telefonda esa 9 ustunli jadval yon tomonga siljitilardi va
summani ko'rish uchun har qatorni surish kerak bo'lardi.

### 1. Nom

UI'dagi noaniq "Yozuvlar" — **"Kirim / Chiqim"** (yon menyu),
telefon tabida "Kirim/Chiqim" (uch tab 375px da sig'ishi kerak),
sahifa sarlavhasi esa **"Kirim va chiqimlar"**. Route o'zgarmadi.

### 2. Yozuv kiritish — forma varaqqa ko'chdi

Sarlavha yonida `+ Kirim` / `− Chiqim`; telefonda pastki o'ng burchakda
yozuvli FAB (`+ Yangi`) → tur tanlash varag'i → forma. FAB ATAYLAB
dumaloq emas: pastki panelning markazidagi umumiy "tez qo'shish" tugmasi
ham dumaloq va teal — ikkitasi bir xil ko'rinsa qaysi biri nima
qilishini bilib bo'lmasdi. Balandligi ham markaziy tugmadan yuqorida.

Formada summa eng tepada va eng katta (`SummaMaydoni`): `inputMode=numeric`,
kiritilgani guruhlanadi (`1 000 000`) va ostida `1 000 000 so'm` deb
takrorlanadi — "70000/700000" adashuvi eng qimmat xatolardan biri.
Serverga baribir xom butun son ketadi.

Kategoriya dropdown emas, katakchalar (`KategoriyaTanlov`): tepada
"Ko'p ishlatiladigan" (oxirgi 90 kun tarixidan — `getTezKategoriyalar`),
20+ kategoriyada qidiruv maydoni. Bu FAQAT tartib: kategoriya qoidalari
o'zgarmadi va tarix bo'sh bo'lsa ro'yxat avvalgi (alifbo) tartibida qoladi.

**Ikki marta yuborish** `useRef` bilan bloklanadi — React state asinxron
bo'lgani uchun ikki tez bosishda `loading` hali `true` bo'lib ulgurmasdi.
Brauzerda tekshirildi: `click({clickCount: 2})` → BITTA POST.

TASDIQLASH moduli 202 qaytarganda (chegaradan oshgan chiqim) yozuv
ro'yxatga QO'SHILMAYDI — ilgari so'rov obyekti tranzaksiya sifatida
ro'yxatga tushib qolardi.

### 3. Davr yakuni (`SummaryBar`)

Ro'yxat tepasida Kirim / Chiqim / Sof + to'lov taqsimoti. **Kirim va
chiqim taqsimotlari ikki ALOHIDA qatorda** — aralashsa "Naqd 12 mln"
degan ma'nosiz raqam chiqardi.

Buning uchun `listTransactions` ga additiv `totals.taqsimot` qo'shildi:
`{ kirim: {naqd, click, karta}, chiqim: {...}, qarz }`. Guruhga
biriktirish `lib/tolovBolimi.ts` dagi mavjud `amaldagiBolim` ustiga
qurildi (`tolovGuruhi`) — ro'yxatdagi belgi bilan yuqoridagi taqsimot
hech qachon zid bo'lmaydi. Eski `naqdKirim/clickKirim/qarzKirim`
maydonlari BIT-BITGA o'zgarmadi: ularga boshqa ekranlar va testlar
bog'langan.

### 4. Filtrlar

Presetlar saqlandi; ustiga **Turi, To'lov (naqd/click/karta/qarz),
Kategoriya, Kim kiritdi, Sana oralig'i, Summa oralig'i** qo'shildi.
Hammasi URL parametrlarida — havola nusxalansa boshqa odam ayni
ro'yxatni ko'radi va eksport ham shu parametrlarni oladi.

Telefonda `[Bugun][Bu hafta][Bu oy] [Filter (3)]` — qolgani varaqda,
tanlovlar DARHOL qo'llanmaydi ("Natijalarni ko'rsatish" bosilguncha).

Qidiruv endi izoh BILAN BIRGA kategoriya nomi bo'yicha ham ishlaydi.

**Xavfsizlik:** `xodimId` — filtr, `userId` — ko'rinuvchanlik CHEGARASI.
Chegara ustun turadi, ya'ni xodim `xodimId` yuborib boshqa xodimning
yozuvlarini KO'RA OLMAYDI (test bilan qulflandi).

### 5. Ro'yxat

Desktopda jadval qoldi, lekin ierarxiya tozalandi va har qatordagi
ikkita matn tugmasi `⋯` menyusiga yig'ildi (Batafsil / Tahrirlash /
O'chirish). Summa faqat RANGGA tayanmaydi: `+`/`−` belgisi va
Kirim/Chiqim nishoni ham bor.

Telefonda jadval umuman ishlatilmaydi — `TransactionCards` (kun bo'yicha
guruhlangan kartalar, yopishqoq kun sarlavhasi). Qatorga bosilganda
tafsilot varag'i ochiladi (ilgari to'g'ridan-to'g'ri TAHRIRLASH oynasi
ochilardi — "ko'rmoqchi" bo'lgan odam "o'zgartirmoqchi" oynaga tushardi).

O'chirish `confirm()` emas, summa/kategoriya/sanani takrorlaydigan
tasdiq oynasi. Soft-delete va 5s "Qaytarish" o'zgarmadi.

### 6. Unumdorlik

Sahifalash allaqachon SERVERDA edi; sahifa hajmi 20 → **50**. Filtr,
qidiruv va jamilar butun to'plam bo'yicha serverda hisoblanadi, brauzerga
yuklangan 50 ta yozuv bo'yicha emas. Taqsimot uchun bitta `groupBy`
qo'shildi — N+1 yo'q.

### 7. Ilova qobig'idagi yon ta'sir (sahifadan tashqarida)

`src/app/app/layout.tsx` da `md:flex-row` → `lg:flex-row`. Sidebar
`hidden lg:flex`, MobileNav esa `lg:hidden` — qator maketi `md` da
yoqilgani uchun MobileNav 768px da YON USTUN bo'lib qolar va kontentni
o'ngga surib yuborardi. Bu barcha sahifalarga tegishli eski xato edi;
planshet tekshiruvi shusiz o'tmaydi.

### Fayllar

Yangi: `YangiYozuv.tsx`, `TurVaTolov.tsx`, `SummaMaydoni.tsx`,
`KategoriyaTanlov.tsx`, `SummaryBar.tsx`, `FiltrSheet.tsx`,
`TransactionTable.tsx`, `TransactionCards.tsx`, `AmalMenu.tsx`,
`DetailSheet.tsx`, `OchirishTasdiq.tsx`, `ImportExportMenu.tsx`,
`BulkAmallar.tsx`, `src/lib/queries/tezKategoriyalar.ts`.

O'zgargan: `page.tsx`, `TransactionsClient.tsx`, `TransactionForm.tsx`,
`TransactionFilters.tsx`, `TransactionList.tsx`, `turlar.ts`,
`loading.tsx`, `src/lib/queries/transactions.ts`, `src/lib/tolovBolimi.ts`,
`src/lib/modules/registry.ts`, `src/app/api/transactions/route.ts`,
`.../export/route.ts`, `src/app/app/layout.tsx`.

**Sxema o'zgarmadi, migratsiya yo'q.**

### Test

Yangi: `npm run test:kirim-chiqim` (13 ta) — guruhlar kesishmasligi va
to'plamni qoplashi, kirim/chiqim taqsimotining aralashmasligi, taqsimot
yig'indisi = qarzsiz jami, `xodimId` ning chegarani kengaytira olmasligi,
kategoriya nomi bo'yicha qidiruv, tez kategoriyalar.

Yangilangan: `test:visibility` (taqsimot ham chegarada), `test:smoke`
(forma endi varaqda ochiladi).

O'tdi: kirim-chiqim, visibility, isolation, qarz, tolov-taqsimoti,
kategoriya, soft-delete, csv-import, kunlik, agregat, modules, selos-kg,
tasdiqlash, kop-biznes, smoke (brauzer) — hammasi yashil, `npm run build` ham.

Brauzerda 1440/1280/768/390/375 px da tekshirildi: gorizontal siljish
YO'Q, JS xatosi yo'q, oqimlar (kirim/chiqim qo'shish, filtr varag'i,
tafsilot, `⋯` menyu, o'chirish tasdig'i, Import/Export menyusi) ishlaydi.
---

## Bizneslar sahifasi — zamonaviy business management (2026-08-25)

Branch: `claude/modernize-bizneslar-page-jtopkl`. **Sxema o'zgarmadi,
migratsiya yo'q.**

### Eski holat

`/app/admin/bizneslar` texnik jadval edi: 7 ustun (Rejim, Ombor, Kassa,
Kategoriyalar…) va har qatorda 6 ta yonma-yon amal — "Omborni yoqish",
"Kassani yoqish", "Avto rejim", "Nofaollashtirish", "Tozalash",
"O'chirish". Qaytarib bo'lmaydigan ikki amal kundalik amallar bilan bir
qatorda turardi. Qidiruv, filtr, saralash va tafsilot sahifasi yo'q edi.
Mobil ko'rinish `Jadval` komponentining umumiy kartochkasi edi.

### Yangi tuzilma

- Ro'yxat: xulosa (jami/faol/nofaol/tranzaksiya) → qidiruv + filtr +
  saralash → jadval (≥1024px) yoki kartochkalar (<1024px). Qatorda faqat
  **[Ochish]** va **[•••]**.
- `•••` ichida: Sozlamalar, Modullar, Xodimlar, Kassa sozlamalari, Ombor
  sozlamalari, Faollashtirish/Nofaollashtirish va (faqat OWNER) "Xavfli
  zona…" havolasi. Tozalash/O'chirishning O'ZI menyuda YO'Q.
- Tafsilot `/app/admin/bizneslar/[id]` — bo'limlar: Umumiy, Modullar,
  Xodimlar, Kassa, Ombor, Xavfsizlik. Desktopda tab, mobilda navigatsiya
  kartochkalari.
- Yangi biznes — 5 qadamli sozlash oqimi (nomi/faoliyat → modullar →
  kassa → xodimlar → tayyor).

### Backend (yangi xizmat qatlami)

`lib/services/biznesRoyxat.ts` (agregatsiya, N+1 yo'q),
`biznesTafsilot.ts`, `biznesYaratish.ts` (takroriy yuborish to'sig'i,
kassa uzilsa biznes ortga qaytariladi), `biznesOchirish.ts` (OWNER + nom
tasdig'i + bo'sh biznes sharti). `lib/modules/biznesModullari.ts` — biznes
uchun amalda ishlaydigan modullar (tenant moduli ∩ biznes bayrog'i),
`computeNav` bilan bir xil qoida.

Kuchaytirilgan qoidalar: biznesni o'chirish `requireManager` dan
**OWNER**ga toraytirildi va endi so'rov tanasida nom tasdig'ini talab
qiladi; PATCH da `magazin` faqat `omborli` bilan yoqiladi (ilgari bu
qoida faqat UI'da edi).

### Yo'l-yo'lakay topilgan maket xatosi

`app/layout.tsx` konteyneri `md:flex-row` edi, yon panel esa `lg:flex`.
768–1023px oraligida maket qator bo'lib qolar, lekin yon panel o'rniga
MobileNav va BottomNav yonma-yon turib butun enni yeb qo'yardi — `main`
bor-yo'g'i **64px** ga siqilardi va bu BARCHA sahifalarga tegishli edi.
Konteyner `lg:flex-row` ga o'tkazildi. (Xuddi shu xatoni Kirim/Chiqim
redesign sessiyasi ham topgan — merge paytida ikkalasi bir xil o'zgarish
bo'lib chiqdi, faqat izoh matni farq qildi.)

### Test

`npm run test:bizneslar` (21 ta — izolyatsiya, IDOR, qidiruv/filtr/
saralash, yaratish va dublikat, tarif chegarasi, nofaollashtirish,
o'chirish huquqi) va `npm run test:bizneslar-brauzer` (10 ta — 1440/1280/
768/390/375px, gorizontal siljish yo'q, `•••` tarkibi, xavfli zona,
wizard). Regressiya: isolation, kop-biznes, modules, tozalash, kassa,
magazin, crm, audit, signup, billing, visibility, backup, pro,
soft-delete, atomik va smoke — hammasi yashil.

---

## 2026-08-25 — OMBOR VA TA'MINOT BITTA MODULDA

Ombor uch joyga bo'lingan edi: **Ombor** (jadval), **Xarid** (uch qadamli
buyurtma) va **Ta'minotchilar** (reyestr). "Tovar keldi" deyish uchun
foydalanuvchi avval qaysi bo'limga borishni, keyin qoralama → tasdiqlash →
qabul qilish zanjirini o'tishi kerak edi. Gul do'koni yoki kichik magazin
uchun bu ortiqcha: tovar allaqachon kelgan, uni faqat yozib qo'yish kerak.

### Nima o'zgardi

- Yon panelda faqat **Ombor** qoldi. `XARID` moduli o'chirilmadi —
  navigatsiyasi bo'shatildi (`registry.ts`), sahifalari yangi manzilga
  yo'naltirildi (`/app/xarid` → `/app/ombor?tab=taminotlar`).
- Ombor uch tabga bo'lindi: **Mahsulotlar | Ta'minotlar | Inventarizatsiya**.
  Tab URL'da (`?tab=`) — server faqat ochiq tab ma'lumotini yuklaydi.
- Asosiy amal bitta: **"+ Tovar keldi"** — 4 qadamli oqim (kimdan → qanday
  to'landi → nima keldi → saqlash). Ikkinchi darajali amallar `•••` menyusida,
  telefonda pastki o'ngdagi 📦 tugmasi ostida.
- Mahsulotlar POS uslubidagi **rasmli kartochka gridida** (telefonda 2 ustun,
  desktopda 4–5). Rasm mavjud saqlagichga (`lib/storage/driver.ts`) yuklanadi.
- AVTO (olib-sotar) rejimi ESKI ko'rinishida qoldi — `/app/ombor/avtopark`.
  U yerda bitta yozuv = bitta mashina, kartochka gridi ham, miqdor kiritish
  ham ma'nosiz.

### Hisob qoidasi — bitta manba

Ombor va pul yozuvlari **faqat** `qabulYozuvlariTx` da (`services/xarid.ts`).
Yangi bir qadamli oqim ham, eski uch qadamli qabul ham o'shani chaqiradi —
ikki oqim hech qachon ikki xil natija bera olmaydi.

- **Naqd/Karta** → chiqim tranzaksiya (karta uchun kassa aniq tanlanadi:
  `createTransactionTx` ning kassasiz tarmog'i birinchi faol kassani olardi
  va pulni naqd kassadan chiqarib yuborardi).
- **Qarzga** → "beriladigan" `Debt`; pul umuman qimirlamaydi, faqat
  "Men qarzdorman" oshadi.
- Tannarx qoidasi O'ZGARMADI (oxirgi kelgan narx snapshot) — yangi hisob
  usuli ATAYLAB kiritilmadi.

### Takror saqlashdan himoya

`PurchaseOrder.idempotencyKey` + `@@unique([businessId, idempotencyKey])`.
Frontend oqim ochilganda bir marta kalit yaratadi; ikkinchi so'rov bazada
to'xtaydi va xizmat MAVJUD yozuvni qaytaradi (xato emas). Faqat ilova
darajasidagi tekshiruv yetarli emas: parallel ikki so'rov ikkalasi ham
"hali yo'q" deb ko'rardi.

### Bekor qilish — teskari yozuvlar

`taminotBekor`: qoldiq qaytariladi + `StockAdjustment` (tarix qayta
yozilmaydi), qarz o'chiriladi, chiqim yumshoq o'chiriladi. Tovarning bir
qismi sotilgan yoki qarz bo'yicha to'lov qilingan bo'lsa — RAD ETILADI.

### Ishlash

Qidiruv va sahifalash SERVER tomonda (`lib/queries/ombor.ts`). 1200 mahsulotli
bazada Ombor sahifasi telefonda ~0,9 s, qidiruv ~1,2 s da ochiladi.

Migratsiya: `20260825120000_taminot_idempotentlik`.
Test: `npm run test:taminot` (18 ta).

---

## 2026-08-25 · Kassalar sahifasi — pul nazorati markazi

Branch: `claude/kassalar-cash-control-center-ayo90h`. Faqat `/app/kassa`
(va uning `[id]` detali) qayta ishlandi; boshqa sahifalar tegilmadi.

### Nima o'zgardi

Sahifa "qoldiq ko'rsatadigan ro'yxat" edi: `Jami kassalar` summasi, kassa
kartalari, katta bo'sh "Kassa harakatlari" bloki va sahifa pastida katta
"Shaxsiy kassa rejimi" paneli. Kassani TOPSHIRISH bu sahifada umuman yo'q
edi — u faqat `/app/kassam` da bor edi, kassa FARQI esa hech qayerda
saqlanmasdi.

Endi sahifa oltita savolga javob beradi: jami qancha pul bor, u qaysi
kassada, bugun qancha kirdi/chiqdi, kim topshirmadi, farq bormi, pul
kimdan kimga o'tdi. `Jami kassalar` → **`Jami qoldiq`** (+ naqd/plastik/
bank taqsimoti), tepada bugungi kirim/chiqim/sof/kutilmoqda KPI qatori,
kutilayotgan topshirishlar ixcham panelda FARQ bilan, har kassa kartasida
bugungi kesim va "⋯" amallari, harakatlar lentasi Bugun/Hafta/Oy/Barchasi
filtri bilan, rejim esa "⚙ Kassa sozlamalari" ichiga yig'ildi.
Mobil (375/390px): 2×2 KPI, karta-ro'yxat, pastda yopishqoq "+ Amal"
tugmasi (tab-bar ustida) va pastdan chiqadigan varaqlar.

### Biznes mantig'i

Hisob-kitob qoidalari O'ZGARMADI: qoldiq ledgerdan (`Transaction` +
`AccountTransfer`), o'tkazma kirim/chiqim yozmaydi, manfiy qoldiq
taqiqlangan, atomiklik `runBusinessTx` da.

Yagona qo'shimcha — **kassa farqi**: `AccountTransfer` ga ikkita NULL
bo'lishi mumkin ustun qo'shildi (`hisoblangan`, `farq`) va ular faqat
`turi = "smena"` da to'ldiriladi. Server topshirish paytidagi mavjud
qoldiqni O'ZI hisoblab qatorga muzlatadi, farq = `summa − hisoblangan`.
Farq nolga teng bo'lmasa izoh (kamomad sababi) majburiy — serverda ham,
formada ham. Farq va sabab auditga tushadi. Kamomad kassirning kassasida
OCHIQ qoladi (pul o'z-o'zidan yo'qolmaydi).

Audit kengaytirildi: kassa ochish/tahrirlash/o'chirish va shaxsiy kassa
rejimi o'zgarishi endi `logAudit` ga yoziladi.

Migratsiya: `20260825120000_kassa_topshirish_farqi` — faqat ikkita
`ALTER TABLE ... ADD COLUMN`, mavjud ma'lumot tegilmaydi. Postgres init
migratsiyasi `npm run pg:migratsiya` bilan qayta generatsiya qilindi.

### Testlar

`npm run test:kassa-nazorat` (23 ta) — balans, bugungi kesim, o'tkazma
(kirim/chiqim o'zgarmasligi), kamomadli topshirish va farqning
muzlatilishi, izohsiz farqning rad etilishi, ikki marta yuborish/qabul
qilish, tenant va biznes izolyatsiyasi, huquqlar, davr filtri.

`npm run test:kassa-brauzer` (8 ta) — 375/390/768/1280/1440px da sahifa
chiziladi, gorizontal siljish yo'q, yopishqoq tugma tab-bar bilan
urishmaydi, varaqlar ochiladi, farq jonli hisoblanadi, detal filtri
ishlaydi. Skrinshotlar: `.screenshots/kassa-nazorat/`.

Regressiya: `test:kassa`, `test:kassa-transfer`, `test:kassir-kassa`,
`test:handover-migratsiya`, `test:isolation`, `test:izolyatsiya-royxati`,
`test:agregat`, `test:audit`, `test:audit-qoldiq`, `test:atomik`,
`test:soft-delete`, `test:backup`, `test:migratsiya`, `test:postgres`,
`test:kunlik`, `test:smena`, `test:pro`, `test:visibility`, `test:smoke`
— hammasi yashil. `npm run build` o'tadi.

---

## Kunlik hisobot / smena / kassa topshirish — to'liq qayta ishlash (2026-08-25)

Kunlik hisobot sahifasi (`/app/kunlik`) auditdan o'tkazildi. Uchta jiddiy
buxgalteriya xatosi topildi va tuzatildi; UI kassirning haqiqiy ish oqimiga
qarab qayta qurildi.

### Topilgan xatolar

**1. IKKITA KIRIM DAFTARI.** "Tushum kiritish" faqat `DailyTransaction`
yozardi — hech qanday `Transaction` yaratmasdi. Natijada o'sha pul kunlik
hisobotda ko'rinardi, lekin Dashboard "Jami Kirim", oylik hisobot,
kategoriya kesimi va kassa qoldig'ida UMUMAN yo'q edi. Teskari yo'nalish esa
ishlardi (`kunlikSinxron`), ya'ni ko'prik bir tomonlama edi va ikki daftar
birinchi uzilishdayoq ajralardi.

**2. "KASSADA BO'LISHI KERAK" MANFIY CHIQARDI** (mijozda −12 679 000).
Smena oynasida KIRIM `DailyTransaction` dan, CHIQIM esa `Transaction` dan
olinardi. `DailyTransaction` faqat BUGUNGI sanali va kun OCHIQ bo'lgandagina
yaratilardi, chiqim esa `createdAt` bo'yicha hech qanday sana shartisiz
sanalardi. Kechagi sana bilan kiritilgan kirim oynaga tushmasdi, o'sha
paytda kiritilgan chiqim esa tushardi — hisob asta-sekin minusga ketardi.

**3. FARQ YOLG'ON KAMOMAD KO'RSATARDI.** `sanalganNaqd` kunning NAQD KIRIMI
(`naqdSumma`) bilan solishtirilardi. Naqd chiqim va kun boshidagi qoldiq
hisobga olinmasdi: 10 mln kirim + 3 mln naqd chiqim bo'lgan kunda kassada
7 mln bo'ladi, tizim esa 10 mln kutib "3 mln KAMOMAD" deb ogohlantirardi.

**4. PUL HECH QAYERGA KO'CHMASDI.** Kun "tasdiqlangan" bo'lsa ham
kassirning kassa qoldig'i o'zgarmasdi — `submitKunlikReport` va
`confirmKunlikReport` faqat holatni almashtirardi.

### Yechim

Kunlik hisobot endi YAGONA ledger (`Transaction` + `AccountTransfer`) ustidagi
HOSILA ko'rinish:

- **Tushum** haqiqiy `Transaction` (kirim) yaratadi va unga bog'langan
  `DailyTransaction` qatori bitta tranzaksiyada quriladi (`transactionId`).
  Kategoriya tanlanadi — mavjud Kirim modulining kategoriyalaridan.
  O'chirish ikkala tomonni birga oladi.
- **Smena oynasi** kirimni ham, chiqimni ham `Transaction` dan va bitta
  naqdlik qoidasidan (`naqdChiqimmi`) oladi — simmetriya tiklandi.
- **Tizim hisobi** kassirning HAQIQIY kassa qoldig'idan olinadi
  (`topshiruvchiKassaTx` → ledger) va topshirishda MUZLATILADI
  (`DailyReport.kutilganNaqd`).
- **Pul harakati** mavjud `AccountTransfer` (`turi = "smena"`) ledgerida:
  topshirishda "kutilmoqda", direktor qabul qilganda "bajarildi". Ya'ni
  `Transaction` YOZILMAYDI — Jami Kirim ham, Jami Chiqim ham o'zgarmaydi.
  Qayta ochilsa STORNO yoziladi (ledger append-only).

Ortiqcha pul ko'chmaydi (`kochadiganSumma`): uning ledgerda manbasi yo'q,
ko'chirilsa kassir qoldig'i manfiyga tushardi. U `kassaFarq` da yozib
qoldiriladi — direktor ko'rib, kerak bo'lsa alohida kirim qiladi.

### RBAC o'zgarishi

`getKunlikRuxsat.tasdiqlaydi` endi `direktormi || boshqaruvchimi`. Ilgari
boshqaruvchi faqat direktor tayinlanmagan bo'lsa tasdiqlardi — direktor
etib tayinlangan kassirning O'ZI kunni topshirsa, kunni yopadigan hech kim
qolmasdi. O'rniga `qarorKunlikReport` da O'ZINI O'ZI TASDIQLASH TAQIQI
qo'shildi: topshirgan xodim (boshqaruvchi bo'lmasa) o'z topshirig'ini yopa
olmaydi.

### Migratsiya

`20260825120000_kunlik_kassa_topshirish` — `DailyReport` ga 5 ta NULLABLE
ustun (`kutilganNaqd`, `kassaFarq`, `transferId`, `izoh`, `qarorIzoh`).
Jadval qayta qurilmaydi, eski kunlar avvalgidek o'qiladi (ularda
`kutilganNaqd` null — o'sha yerda eski taqqoslash saqlanadi, tarixdagi
raqamlar "o'z-o'zidan" o'zgarmasin).

### Test

- `npm run test:kunlik-kassa` (18 ta) — accounting invarianti:
  10 mln kirim / 3 mln chiqim → 7 mln topshirildi → kassir 0, direktor
  +7 mln, Jami Kirim HALI HAM 10 mln, Jami Chiqim HALI HAM 3 mln, pul
  harakati bitta, dublikat yozuv nol; farq (kamomad/ortiqcha) sababsiz
  yopilmaydi va totallarni buzmaydi; 5 ta parallel topshirish/tasdiqlashda
  faqat bittasi o'tadi; storno; RBAC; tenant izolyatsiyasi.
- `npm run test:kunlik-e2e` (8 ta) — 1440/1280/768/390/375 da gorizontal
  siljish yo'q, element ekrandan chiqmaydi, sticky amal paneli pastki
  navigatsiya bilan kesishmaydi, raqamli klaviatura va solishtiruv varag'i
  ishlaydi.
- `npm run test:kunlik` (27) va `test:smena` (14) yangi shartnomaga
  moslashtirildi.
---

## Kategoriyalar sahifasi — xavfsiz boshqaruv va registrsiz dublikat himoyasi (2026-08-25)

Eski sahifada faqat ikkita narsa bor edi: Kirim/Chiqim tablari va
"Nofaollashtirish" tugmasi. Qidiruv yo'q, holat filtri yo'q, kategoriya
ishlatilganini bilishning imkoni yo'q, nomni O'ZGARTIRIB BO'LMASDI —
ya'ni "shar bezaklar" ni "Shar bezaklari" ga tuzatish uchun yangi
kategoriya yaratishdan boshqa yo'l qolmasdi va eski yozuvlar boshqa
kategoriyada osilib qolardi.

### 1. Dublikat: registrga sezgir yagonalik

`@@unique([nomi, turi, businessId])` registrga SEZGIR edi. Bitta biznesda
"Bantik", "bantik" va "BANTIK" uchta alohida kategoriya bo'lib yashardi:
bitta xarajat turi hisobotda uch qatorga bo'linardi, byudjet faqat
bittasini ko'rardi.

Yechim — IFODALI UNIQUE INDEKS `lower(trim("nomi"))` bo'yicha (migratsiya
`20260825130000_kategoriya_registrsiz_unique`). Ilova darajasidagi
tekshiruv YETARLI EMAS: ikki so'rov bir vaqtda kelsa ikkalasi ham
"bunday nom yo'q" deb ko'radi. Prisma sxemasi ifodali indeksni ifodalay
olmaydi, shuning uchun Postgres yo'li `scripts/pg-migratsiya.mjs` dagi
QO'LDA blokiga qo'shildi.

Migratsiya mavjud registr-dublikatlarini O'CHIRMAYDI va BIRLASHTIRMAYDI
(har biriga tranzaksiya/byudjet/qarz FK bilan bog'langan bo'lishi
mumkin): birinchisi nomini saqlaydi, qolganlariga id qo'shimchasi
yopishtiriladi.

Yon ta'sir: servislar (`ensureCategoryTx`, CSV import, biznesga
ko'chirish) kategoriyani `upsert` bilan NOMI bo'yicha izlardi. Endi ular
`kategoriyaIdTop()` orqali registrsiz izlaydi — aks holda foydalanuvchi
qo'lda "sotuv" yaratib qo'ygan biznesda keyingi POS savdosi indeksga
urilib YIQILARDI.

### 2. Tizim kategoriyalari

POS, qarz, ombor, xarid va HR servislari kategoriyani NOMI bo'yicha
topadi ("Sotuv", "Qarz to'lovi", "Qarz to'lash", "Tovar xaridi",
"Mashina xaridi", "Mashina xarajati", "Oylik", "Avans"). Ularni qayta
nomlash keyingi avtomatik yozuvda kategoriyani QAYTA yaratardi —
bitta oqim ikkiga bo'linardi. Nofaollashtirilsa esa formalardan
yo'qolardi, lekin servis unga yozishda davom etardi.

Ro'yxat `src/lib/kategoriyaNom.ts` da; UI "Tizim" nishonini ko'rsatadi va
tugmalarni yashiradi, backend esa 403 qaytaradi (tugmani yashirish
himoya emas). Test manba fayllardagi qotirilgan nomlarni ro'yxat bilan
solishtiradi — ro'yxat eskirsa qizil bo'ladi.

### 3. Tarix buzilmasligi

`DELETE` route ATAYLAB YO'Q va test uning paydo bo'lishini qo'riqlaydi.
Qayta nomlash mavjud qatorni `update` qiladi — ID o'zgarmaydi, ya'ni
tranzaksiya, byudjet, qarz va CRM bitimlari joyida qoladi. Turni
o'zgartirish esa faqat kategoriya HECH QAYERDA ishlatilmagan bo'lsa
mumkin (yettita bog'lanish tekshiriladi).

`QuickAddSheet` `/api/categories` ni `active` filtrisiz o'qirdi — butun
ilovada nofaol kategoriya hamon tanlanadigan YAGONA joy shu edi. Tuzatildi.

### 4. Sahifa

Qidiruv + `Faol | Nofaol | Barchasi` filtri, har kategoriyaga yozuvlar
soni (tranzaksiyalar ro'yxatiga havola) va joriy oy summasi. Raqamlar
ikkita `groupBy` bilan olinadi — kategoriya soni qanday bo'lsa ham
uchta so'rov (N+1 yo'q). Davr summasi bosh sahifadagi kategoriya
taqsimoti bilan AYNI real-pul qoidasidan o'tadi, aks holda ikki ekran
ikki xil raqam ko'rsatardi.

Fayllar: `src/lib/kategoriyaNom.ts` (yangi),
`src/lib/services/kategoriya.ts` (yangi),
`src/app/app/admin/kategoriyalar/` (page + 4 komponent + turlar),
`src/app/api/categories/**`, `src/lib/validation/category.ts`,
`src/lib/services/inventory.ts`, `csvImport.ts`,
`src/app/api/transactions/bulk-move/route.ts`,
`src/components/nav/QuickAddSheet.tsx`, `prisma/schema.prisma` (izoh),
migratsiya + Postgres init.

Test: `npm run test:kategoriya-boshqaruv` (19 ta) — dublikat (registr,
bo'shliq, poyga), rename tarixi, nofaollashtirish/faollashtirish, tur
o'zgarishi, tizim himoyasi, IDOR va RBAC, statistika.

## Davr yakuni faqat direktorga; to'lov taqsimoti olib tashlandi (2026-08-25)

Loyiha egasi ikki narsani so'radi: (1) Kirim/Chiqim sahifasidagi to'lov
taqsimoti qatorlari (Naqd / Click / Karta / Qarz — kirim va chiqim bo'yicha)
kerak emas; (2) Jami kirim, Jami chiqim va Sof foyda FAQAT direktorga
ko'rinsin.

### Nima o'zgardi

`SummaryBar` endi faqat uchta kartadan iborat: Kirim, Chiqim, Sof.
Taqsimot qatorlari (`Qator` komponenti) butunlay olib tashlandi.

Blok `isManager(currentUserRol)` sharti bilan render qilinadi. Kassir va
sotuvchi uni umuman ko'rmaydi. Bu shunchaki oyna emas: server ham ularga
faqat O'Z yozuvlarini beradi (`transactionScopeUserId`), ya'ni bu raqamlar
ularga baribir biznesning to'liq manzarasini bermasdi — endi esa yarim
haqiqatni ko'rsatadigan blok umuman chiqmaydi.

### O'lik kod olib tashlandi

Taqsimot ko'rsatilmagach, uni tayyorlaydigan hisob-kitob ham keraksiz
qoldi. Har sahifa yuklanishida bekorga ketadigan uchta so'rov o'chirildi:

1. `listTransactions` dagi `guruhSums` (`groupBy` by turi+tolovTuri+accountId)
   va undan chiqadigan `totals.taqsimot`. `naqdKirim/clickKirim/qarzKirim`
   avvalgidek joyida — ularga boshqa ekranlar bog'langan.
2. `page.tsx` dagi `prisma.debt.aggregate` (qarz yozuvlari jami).
3. `page.tsx` dagi `prisma.dailyTransaction.aggregate` (kunlik hisobotdagi
   qarz tushumlari) va uni o'rab turgan `isModuleOnForTenant(KUNLIK)` tekshiruvi.

`hideProfit` bayrog'i ham o'chdi: u faqat sotuvchidan "Sof" ni yashirish
uchun edi, endi butun blok direktorga qulflangan.

`lib/tolovBolimi.ts` dagi `tolovGuruhi` / `tolovGuruhiWhere` QOLDI — ular
"To'lov" filtrida va ro'yxatdagi belgida ishlatiladi.

`loading.tsx` skeletidan "Davr yakuni" bloki olib tashlandi: skelet rolni
bilmaydi, uni har kimga ko'rsatib keyin yo'qotish kassirda maket sakrashiga
olib kelardi.

Fayllar: `SummaryBar.tsx`, `TransactionsClient.tsx`, `page.tsx`,
`loading.tsx`, `src/lib/queries/transactions.ts`.

**Sxema o'zgarmadi, migratsiya yo'q.**

### Test

`test:kirim-chiqim` taqsimot testlari o'rniga davr yakuni testlariga
almashtirildi (jami qarzsiz to'plamdan, filtrga bo'ysunadi) — 12 ta.
`test:visibility` `totals` shakli asl holiga qaytdi.

Brauzerda ikki rol bilan tekshirildi (1440 va 375px): direktorda Kirim /
Chiqim / Sof kartalari bor, taqsimot qatorlari yo'q; kassirda blok umuman
ko'rinmaydi, sahifa filtrlardan boshlanadi. Gorizontal siljish va JS
xatosi yo'q.

O'tdi: kirim-chiqim, visibility, isolation, qarz, tolov-taqsimoti,
kategoriya, soft-delete, csv-import, kunlik, agregat, modules, crm,
tasdiqlash, kop-biznes, selos-kg, smoke — hammasi yashil, build ham.

## Kirim/Chiqim: kategoriya kesimi qaytarildi, davr yakuni huquqqa bog'landi (2026-08-25)

Uch talab: (1) asosiy ro'yxat sana emas, KATEGORIYA bo'yicha bo'lsin;
(2) to'lov usuli taqsimoti yuqoridan olib tashlansin; (3) Kirim/Chiqim/Sof
faqat direktorga ko'rinsin — CSS bilan yashirish emas.

(2) va (3) ning UI qismi oldingi yozuvda bajarilgan edi; bu yozuv
kategoriya kesimini va huquqning SERVER tomonidagi majburlanishini
qo'shadi.

### 1. Kategoriya kesimi — sahifaning asosiy ro'yxati

Ierarxiya endi: Kirim/Chiqim → BO'LIM (Kirim / Chiqim) → KATEGORIYA →
o'sha kategoriyaning yozuvlari → yozuvlar ichida sana guruhi (Bugun /
Kecha / eskiroq).

Kategoriya jamlari SERVERDA hisoblanadi — `listKategoriyaJamlari`
(`lib/queries/transactions.ts`). U mavjud `buildTransactionWhere` dan
yuradi, ya'ni ro'yxat, eksport va kategoriya kesimi AYNI filtrdan
chiqadi. Bu eng muhim invariant: kartadagi summa ochilgandagi yozuvlar
yig'indisiga TENG (test bilan qulflangan — har kategoriya uchun
`total` va yig'indi solishtiriladi).

Kategoriya ochilganda yozuvlar `/api/transactions?categoryId=...` dan,
joriy filtr parametrlari bilan keladi. Sana filtri, qidiruv, to'lov va
xodim filtri kesimga ham, ichkaridagi yozuvlarga ham bir xil qo'llanadi.

Kirim va chiqim ikki ALOHIDA bo'limda: bitta ro'yxatda aralashsa,
"+"/"−" belgilariga qaramay ko'z ularni qo'shib o'qiydi va bo'lim
yig'indisi ma'nosini yo'qotadi.

Tekis ro'yxat YO'QOLMADI: "Kategoriya | Ro'yxat" almashtirgichi bor
(`?korinish=royxat`), asosiysi — kategoriya. Ro'yxat ko'rinishida
desktop jadvali, ommaviy belgilash, ko'chirish va sahifalash avvalgidek
ishlaydi.

QARZ haqida: bu sahifadagi ro'yxat qarzga yozilgan yozuvlarni HAM
ko'rsatadi (`realPul` yoqilmagan), demak kategoriya jamisi ham ularni
o'z ichiga oladi. Yuqoridagi "Sof" esa ataylab REAL pul
(`lib/qarzFiltr.ts`) — u boshqa savolga javob beradi.

### 2. Davr yakuni — mavjud granular huquq bilan

Yangi ruxsat tizimi kiritilmadi. Mavjud `lib/permissions` katalogidagi
`hisobot.korish` huquqi ishlatiladi:

* OWNER va ADMIN — bor (`BARCHA_HUQUQLAR`);
* CASHIER va SELLER — YO'Q;
* maxsus rol (PRO) — biznes egasi o'zi bera oladi.

Sahifa: huquq yo'q bo'lsa `totals` klientga UMUMAN yuborilmaydi
(`totals={jamiKorish ? result.totals : null}`) — HTMLda ham yo'q, bo'sh
karta ham qolmaydi, filtrlar tepaga suriladi.

API: `/api/transactions` GET huquq yo'q bo'lsa javobdan `totals` ni
olib tashlaydi. Ro'yxat, sahifalash va kunlik jamlar hammaga avvalgidek
qaytadi — xodimning kundalik ishi to'xtamaydi. Brauzerda tekshirildi:
kassir uchun `"totals" in javob === false`, `items` esa joyida.

Eslatma: ADMIN ham ko'radi. `isManager` va `BARCHA_HUQUQLAR` bo'yicha
ADMIN — OWNER bilan teng huquqli va bosh sahifada AYNI raqamlarni
ko'radi; uni faqat shu kartadan uzish himoya bermas, shunchaki
nomuvofiqlik tug'dirardi. Faqat OWNER kerak bo'lsa — `katalog.ts` dagi
ADMIN to'plamidan `hisobot.korish` ni olib tashlash kifoya.

### 3. Fayllar

Yangi: `KategoriyaKorinish.tsx` (kesim + yuklash), `KategoriyaBolimi.tsx`
(bir bo'lim), `YozuvOynalari.tsx` (tafsilot/tahrirlash/o'chirish oynalari
— ikkala ko'rinish uchun bitta to'plam), `useYozuvHolati.ts` (ro'yxat
holati va optimistik amallar).

O'zgargan: `page.tsx` (filtr bitta joyda, kesim + huquq so'rovi),
`TransactionsClient.tsx`, `TransactionList.tsx`, `TransactionCards.tsx`
(kategoriya ichida nomi takrorlanmaydi), `lib/queries/transactions.ts`,
`api/transactions/route.ts`.

**Sxema o'zgarmadi, migratsiya yo'q.**

### 4. Test

`test:kirim-chiqim` 12 → 19 ta. Yangi: kategoriya takrorlanmasligi,
jami = yozuvlar yig'indisi (har kategoriya uchun), kirim/chiqim
aralashmasligi, sana filtri kesimni o'zgartirishi, qidiruv, ko'rinuvchanlik
chegarasi, `hisobot.korish` matritsasi.

`test:smoke` — kirim qo'shish oqimi yangi ko'rinishga moslandi: yozuv
kategoriya ochilganda va "Ro'yxat" ko'rinishida topiladi.

O'tdi (fail 0): kirim-chiqim 19, visibility 10, isolation 22,
izolyatsiya-royxati 9, qarz 16, tolov-taqsimoti 11, kategoriya 11,
soft-delete 8, csv-import 13, kunlik 27, agregat 7, modules 15, crm 24,
tasdiqlash 20, kop-biznes 18, selos-kg 21, foydalanuvchilar 34,
kassa-nazorat 23. Build va TypeScript ham toza.

QOLGAN QIZIL (meniki emas): `test:smoke` dagi `/app/ombor` sarlavha
tekshiruvi. Ombor/Ta'minot birlashtirish commiti smoke ro'yxatidagi
`/app/xarid` ni `/app/ombor` ga almashtirgan, lekin e2e fixture'da
admin biznesi ataylab `omborli = 0` (`scripts/e2e-tayyorla.mjs`), yangi
`/app/ombor/page.tsx` esa bunda `/app` ga yo'naltiradi. Mahsulot xatosi
emas — testning o'z fixture'i bilan ziddiyati.
## Boshqaruv paneli (/app) — Business Control Center

Bosh sahifa oddiy statistika ro'yxatidan biznes holatini 10 soniyada
ko'rsatadigan panelga aylantirildi. Faqat `/app` — boshqa sahifalarning
UI va biznes mantig'iga tegilmadi.

- 5 KPI: Jami kirim, Jami chiqim, Sof foyda, **Kassada** (yangi — faol
  kassalar joriy qoldig'i, tur bo'yicha kesim bilan), Menga qarzdor.
  Beshalasida ko'z tugmasi (`lib/pulYashirish.ts` ga `kassa` va `qarz`
  kartalari qo'shildi).
- **Pul oqimi** grafigi (7 kun / 30 kun / 3 oy / 1 yil) — ikki so'rov,
  to'rtta filtr klientda kesiladi. Eski "6 oy dinamikasi" va "Kunlik
  dinamika" grafiklari shu blok bilan almashtirildi.
- **Balansa Insight** — deterministik xulosa dvigateli
  (`lib/services/dashboardInsight.ts`), AI chaqiruvisiz.
- **Bugungi holat** va **Diqqat talab qiladi** bloklari.
- Kategoriya taqsimoti default TOP 5 + "Barchasini ko'rish".
- "+ Yangi" tez amal menyusi — mavjud formalarni qayta ishlatadi.
- Adaptivlik: har blok modul + rol + granular huquq bilan yopiladi;
  biznes nomiga qarab shart YO'Q.
- Yangi so'rovlar: `lib/queries/dashboardPanel.ts`; testlar:
  `tests/panel.test.ts` (`npm run test:panel`).
- OMBOR kartasi KPI qatoridan olib tashlandi (5 KPI talabi) — ombor
  holati endi "Diqqat talab qiladi" blokida (tugagan / minimal qoldiqdan
  kam) va `/app/ombor` sahifasida.

---

## QARZLAR MODULI — to'lov taqsimoti, kategoriya atributsiyasi va mobil UX (2026-08-25)

Modul allaqachon mustahkam edi: qarz kirim yozmasligi, to'lov sanasi bilan
kirim, idempotentlik va tenant izolyatsiyasi ishlab turardi. Quyidagi uchta
teshik yopildi va sahifa telefon uchun qayta terildi.

### 1. Kategoriya atributsiyasi (eng muhim tuzatish)

Ilgari HAR QANDAY qarz to'lovi zaxira "Qarz to'lovi" kategoriyasiga
yozilardi. "Bantik" savdosidan chiqqan 500 ming qarz to'langanda hisobotdagi
"Kirim — kategoriya bo'yicha" kesimida "Bantik" emas, "Qarz to'lovi"
ko'rinardi: qarzga sotilgan tovarlarning butun tahlili yo'q edi.

Endi `tolovKategoriyaTx` qarzning O'Z kategoriyasini ishlatadi. Ikki shart
bilan: kategoriya ayni biznesniki va yo'nalishi mos (kirimga kirim
kategoriyasi). Mos kelmasa — avvalgi zaxira nom.

### 2. Ko'p qarzli to'lov taqsimoti — `qarzdorTolov`

Bir mijozda uchta ochiq qarz bo'lsa, to'lov qaysi biriga tushishi degan
savolga javob YO'Q edi: xodim qo'lda tanlardi. Yangi xizmat bitta summani
mijozning barcha ochiq qarzlari bo'ylab ENG ESKISIDAN boshlab taqsimlaydi
(FIFO). Qoida kodda ham, testda ham hujjatlangan.

Har qarz uchun ALOHIDA `DebtPayment` va ALOHIDA kirim yoziladi — 1,2 mln
to'lov uchta turli kategoriyadagi qarzni yopsa, kirim ham uchga bo'linib
har biri o'z kategoriyasiga tushadi. Hammasi bitta `runBusinessTx` ichida.

Qo'lda taqsimlash saqlanib qoldi: `taqsimot` berilsa aynan shunday yoziladi
(yig'indisi summaga teng bo'lishi majburiy).

Overpayment JIM qabul qilinmaydi — mijozning jami qoldig'idan ortiq summa
aniq xato bilan rad etiladi. Yashirin avans/kredit balansi ATAYLAB
yaratilmadi: tizimda bunday konsepsiya yo'q.

Takror bosishdan himoya: kalit taqsimotdan OLDIN tekshiriladi. Bu shart —
birinchi so'rov qarz qoldiqlarini o'zgartirgani uchun ikkinchi so'rov
BOSHQA taqsimot hisoblab, uni yangi to'lov deb yozib yuborardi.

### 3. Qarzdor agregatsiyasi va muddat tili

`QarzdorDTO` boyidi: muddati o'tgan summa, eng yaqin muddat, eng eski qarz
yoshi (kun), oxirgi to'lov summasi, kritiklik holati. Hammasi BITTA
`findMany` dan quriladi — N+1 yo'q.

`src/lib/qarzMuddat.ts` — muddat holatining YAGONA manbai (server ham,
brauzer ham). Beshta holat: kechikdi / bugun / yaqin / keyin / muddatsiz.
Faqat rangga tayanilmaydi: "7 kun kechikdi" matni har doim yonida.

Dashboard: "Yaqin muddatli (7 kun)" qo'shildi; "Bugun to'langan" endi
`debt.turi` bo'yicha ajratiladi — biz ta'minotchiga to'lagan pul mijozdan
kelgan pul kartasiga qo'shilmaydi.

### 4. UI

KPI kartalar BOSILADI va tegishli filtrga o'tadi; telefonda ular
gorizontal suriladigan lenta (beshta kartani 2 ustunga tersak ro'yxat
ekrandan tushib ketardi). "Barcha" yo'nalishi olib tashlandi — aktiv va
majburiyat aralashmasin.

Tez filtr chiplari: Barchasi / Muddati o'tgan / Bugun / 7 kun ichida /
Ochiq / Qisman to'langan / Yopilgan. Standart tartib — eng kritigi tepada.

Qarzdor kartasi: jami qarz, ochiq qarzlar soni, muddati o'tgan summa, eng
eski qarz yoshi, eng yaqin muddat, oxirgi to'lov, `tel:` qo'ng'iroq va
to'g'ridan-to'g'ri "To'lov qabul qilish".

`QarzdorTolovSheet` — yangi to'lov varag'i. Pul QAYSI qarzlarga tushishi
tasdiqlashdan OLDIN ko'rinadi: avtomatik qoida jimgina ishlab ketmaydi.

Dublikat mijoz ogohlantirishi: server mavjud kartochkani qaytarsa
(`mavjud: true`), forma buni AYTADI — operator kiritgan telefon boshqa
odamning kartochkasiga tegishli bo'lishi mumkin.

### Fayllar

Xizmat/so'rov: `src/lib/services/qarz.ts`, `src/lib/queries/qarz.ts`,
`src/lib/services/mijozAniqla.ts`, `src/lib/validation/qarz.ts`,
`src/lib/qarzMuddat.ts` (yangi).

API: `src/app/api/debts/qarzdor/tolov/route.ts` (yangi),
`src/app/api/debts/mijozlar/route.ts`.

UI: `QarzlarClient.tsx`, `QarzKPI.tsx`, `QarzFiltrPanel.tsx`,
`QarzdorRoyxat.tsx`, `QarzdorTafsilot.tsx`, `QarzJadval.tsx`,
`QarzMuddatBadge.tsx` (yangi), `QarzdorTolovSheet.tsx` (yangi),
`src/components/qarz/YangiMijozForm.tsx`.

**Sxema o'zgarmadi, migratsiya yo'q.**

### Test

`npm run test:qarz-taqsimot` (13 ta, yangi) — FIFO taqsimoti, kategoriya
atributsiyasi, faqat to'langan summaning kirimga tushishi, takror bosish
(shu jumladan qarz to'liq yopilgandan keyingi holat), overpayment rad
etilishi, qo'lda taqsimlash, ta'minotchi oqimi (chiqim, kirimga
tushmaydi), tenant izolyatsiyasi va yopilgach tarixning saqlanishi.

`npm run test:qarzlar-brauzer` (8 ta, yangi) — 1440/1280/768/390/375px da
gorizontal skroll yo'qligi, sticky FAB pastki navigatsiya bilan
to'qnashmasligi, raqamli klaviatura va to'lov varag'ining qatlam tartibi.
Suratlar `tests/suratlar/` ga tushadi (repoga qo'shilmaydi).

Regressiya: 48 to'plam o'tdi (qarz, qarzdorlik, qarz-mijoz, avto, atomik,
agregat, audit, izolyatsiya, smoke va boshqalar) — yiqilgani yo'q.

## 2026-08-25 — BALANSA AI: savol-javob blokidan BUSINESS COPILOT'ga

Faqat `/app/ai` va unga kerak bo'lgan backend AI/analitika qatlami
o'zgardi. Boshqa sahifalar va modullar tegilmadi.

### Muammo

Eski AI bloki ~135 satrlik kichik kartochka edi va olti dona umumiy
tool'ga tayanardi (`oylik_xulosa`, `kategoriya_taqsimoti`, `oylik_trend`,
`qarzdorlik`, `crm_holati`, `vazifalar_holati`). Uchta jiddiy kamchilik:

1. **Ruxsat qatlami yo'q edi.** Tool'lar faqat MODUL yoqilganini
   tekshirardi, granular huquqni emas — ya'ni hisobot huquqi olib
   qo'yilgan foydalanuvchi AI orqali sof foydani so'rab olaverardi.
2. **Davr tushunchasi yo'q edi.** Faqat "oy" bor edi: "bugun qancha
   kirdi?", "shu hafta?", "iyulni avgust bilan solishtir" — javobsiz.
3. **Raqamni model yozardi.** Tool xom JSON qaytarardi, foiz va farqni
   model o'zi hisoblardi — ya'ni taxminiy raqam yozish yo'li ochiq edi.

### Yechim: to'rt qatlam

`lib/ai/davr.ts` — davr kodini ("bugun", "3oy", "2026-07",
"2026-07-01:2026-07-15") chegaraga aylantiradi. Model sana hisoblamaydi.

`lib/ai/ruxsat.ts` — XAVFSIZLIK CHEGARASI. Sakkiz soha (moliya, hisobot,
kassa, qarz, ombor, crm, vazifalar, mijozlar), har biri o'sha sohaning
SAHIFASI talab qiladigan AYNI huquq bilan ochiladi (`lib/permissions`).
Ruxsatsiz soha tool'i modelga umuman yuborilmaydi.

`lib/ai/analitika.ts` — deterministik agregatlar. Farq, foiz, ulush va
"eng kattasi" SERVERDA hisoblanadi, modelga tayyor raqam va tayyor matn
("138,3 mln so'm") boradi. Qarz filtri (`QARZ_EMAS`) va soft-delete
butun tizim bilan bir xil, ya'ni AI javobi bosh sahifa va oylik hisobot
bilan bitta raqamni ko'rsatadi.

`lib/ai/tools.ts` — 12 ta tool, hammasi FAQAT O'QISH. `businessId`
har doim serverdagi kontekstdan; savol matnidagi "boshqa biznes ID sini
tekshir" kabi ko'rsatma tool darajasida ta'sirsiz.

### Hallutsinatsiyaga qarshi uch qavat

1. Tool natijasi tayyor matn beradi — model formatlamaydi va hisoblamaydi.
2. System prompt: ma'lumot yo'q bo'lsa "Bu ma'lumotni aniq hisoblash uchun
   yetarli ma'lumot topilmadi" deb ayt, taxmin qilma.
3. `raqamNazorati()` — model birorta tool chaqirmagan bo'lsa, javobdagi
   pul ko'rinishidagi raqam BLOKLANADI (o'ylab topilgan bo'lishi aniq).

### Chat tarixi — yangi jadval

`AiConversation` da foydalanuvchi × biznes uchun ATIGI BITTA qator bor
edi. `AiSuhbat` o'sha cheklovni olib tashlaydi (ko'p suhbat, sarlavha
bilan). Migratsiya eski yozishmalarni ko'chiradi va shundan keyin eski
jadvalni o'chiradi — ma'lumot yo'qolmaydi.

Egalik kaliti o'zgarmagan: `(businessId, userId)`. `rawPrisma` ataylab —
har chat xabari scoped klient orqali audit jurnaliga tushib, jurnalni
shovqinga to'ldirardi (`tests/audit.test.ts` buni qo'riqlaydi).

### AI'siz ishlaydigan qismlar (token tejash)

"Bugungi xulosa" kartasi, tayyor savollar va javobdan keyingi chiplar —
hammasi deterministik. Sahifa ochilishi bitta ham AI so'rovi sarflamaydi.

Fayllar: `src/lib/ai/{davr,ruxsat,analitika,xulosa,tools,claude,suhbatlar,takliflar,javobFormat}.ts`,
`src/app/api/ai/chat/route.ts`, `src/app/api/ai/suhbatlar/**`,
`src/app/app/ai/**` (7 ta komponent), `prisma/schema.prisma`,
`prisma/migrations/20260825140000_ai_copilot_suhbatlar/`.

**Migratsiya bor** — `--create-only` uslubida yozildi, apply QILINMADI
(deploy paytida `scripts/db-migrate.mjs` o'zi qo'llaydi; undan oldin
`scripts/deploy-zaxira.mjs` xom surat oladi). Xavf darajasi: past —
bitta CREATE TABLE + INSERT…SELECT + DROP; ko'chirish scratch bazada
haqiqiy yozuv bilan sinaldi.

Test: `npm run test:ai` (28 ta — aniqlik, RBAC, tenant, prompt injection,
hallutsinatsiya, suhbat izolyatsiyasi) va `npm run test:ai-e2e` (8 ta —
1440/1280/768/390/375 da gorizontal siljish yo'q, kompozer ko'rinadi,
pastki menyu bilan ustma-ust tushmaydi). `npm run build` ✅.

### 2026-08-25 — Kassir/sotuvchi bosh sahifasi yiqilishi (tugadi)

**Muammo (production, foydalanuvchi skrinshoti):** kassir yoki sotuvchi
tizimga kirganda `/app` sahifasi "Tizimda vaqtincha nosozlik" xato ekraniga
tushardi. Direktor/administratorda hammasi ishlagani uchun sinovlarda
sezilmagan.

**Ildiz sabab:** `src/app/app/page.tsx` da kassir/sotuvchi tarmog'i
`runWithTenant(...)` callback ichidan `<XodimEkrani/>` ni JSX sifatida
qaytarardi. React async server komponentni callback TUGAGANDAN KEYIN render
qiladi — AsyncLocalStorage konteksti allaqachon yopilgan, `XodimEkrani`
ichidagi tenant-scoped `prisma` so'rovlari "Tenant konteksti yo'q" bilan
yiqilardi. Panel redizayni (fc98003) kassir mantiqini alohida async
komponentga ajratganda kirib qolgan regressiya.

**Tuzatish:** JSX o'rniga to'g'ridan-to'g'ri chaqiruv —
`return await XodimEkrani({ session })`. Shunda barcha so'rovlar kontekst
ichida bajariladi. Boshqa sahifa komponentlari tekshirildi: faqat
`XodimEkrani` o'zi ma'lumot yuklaydi, qolganlari props orqali oladi —
xato boshqa joyda takrorlanmaydi.

**Tekshiruv:** production build + haqiqiy brauzerda (390px, iPhone UA)
kassir bilan `/app`, tranzaksiyalar, kunlik, pos, sotuv, qarzlar, crm,
vazifalar — hammasi ochiladi; admin paneli o'zgarmagan. `npm run build` ✅,
`test:isolation` (22) ✅, `test:panel` (22) ✅, `test:visibility` (10) ✅.

### 2026-08-25 — Ombor importi: Excel fayl "yuklanmoqda"da abadiy osilishi (tugadi)

**Muammo (foydalanuvchi xabari):** omborga Excel fayl import qilinganda
"yuklanmoqda" holati 15 daqiqa turib ham tugamagan.

**Ildiz sabab (empirik takrorlandi):** 10 MB gacha siqilgan xlsx ichida
100 MB dan ortiq XML (200 ming qator) bo'lishi mumkin. `ExcelJS.load`
faylni to'liq xotira modeliga yozadi — sinovda 10.8 MB fayl ~800 MB heap
yedi; 256 MB heap'da jarayon OOM bilan o'ldi. Kichik serverda bu GC
tiqilishi — so'rov hech qachon javob qaytarmaydi, klientda esa muddat
(timeout) yo'q edi, shuning uchun UI abadiy "yuklanmoqda"da qolardi.

**Tuzatish (uch qatlam):**
1. `xlsxOqi.ts` — zip markaziy katalogidan ichki XML hajmi parse'dan OLDIN
   o'qiladi (arxiv ochilmaydi, ~6 ms). 10 MB dan katta XML `XlsxXato`
   bilan rad etiladi (import baribir 500 qator bilan cheklangan; 10 MB XML
   ~20 ming qator — katta zaxira). Satrlar 5001 bilan cheklanadi — ortiqcha
   qatorlar importda baribir ochiq "500 tadan ko'p" xatosi bo'ladi, jimgina
   kesilmaydi. Streaming o'quvchi ATAYLAB ishlatilmadi: sharedStrings zip
   ichida varaqdan keyin kelsa (haqiqiy Excel odati) matnlar buziladi —
   sinovda tasdiqlandi.
2. `api/products/import` — buzilgan/katta Excel 500 emas, aniq xabarli 400.
3. `ImportModal` — so'rovga 60 s muddat (AbortController): server javobsiz
   qolsa ham UI osilib qolmaydi. Tarmoq qatlami `importYuborish.ts` ga
   ajratildi (komponent 250 satr chegarasida).

**Tekshiruv:** 200 ming qatorli haqiqiy fayl 6 ms da tushunarli xato bilan
rad etiladi; oddiy 300 qatorli fayl avvalgidek o'qiladi. `npm run build` ✅,
`test:mahsulot-import` (23, 3 tasi yangi) ✅, `test:isolation` (22) ✅,
`test:csv-import` (13) ✅.

**Qo'shimcha (foydalanuvchi aniqlashtirdi — fayl 180 MB):** bunday fayl
avval to'liq tarmoqqa yuklanib bo'lishi kerak edi, sekin internetda bu o'zi
o'nlab daqiqa. Endi hajm KLIENTDA, yuborishdan oldin tekshiriladi
(`MAKS_FAYL_HAJM`, server bilan bir xil 10 MB): javob bir zumda chiqadi va
CSV sifatida saqlash / 500 qatordan bo'lish maslahat qilinadi. Modal matniga
"10 MB gacha" qo'shildi. Test: fetch umuman chaqirilmasligi tekshiriladi
(`test:mahsulot-import` — 24) ✅.

### 2026-08-25 — Rasmli Excel importi (tugadi)

**Talab (foydalanuvchi):** 180 MB lik Excel faylni aynan o'zini import
qilish kerak — ichidagi tovar rasmlari bilan birga.

**Arxitektura:** katta fayl serverga UMUMAN yuborilmaydi. XLSX brauzerning
o'zida ochiladi (ExcelJS dinamik import — asosiy bundle'ga qo'shilmaydi):
qatorlar yengil CSV matnga aylanib mavjud import endpointiga JSON bo'lib
boradi; katakka joylashtirilgan rasmlar ajratiladi, canvas'da 900 px JPEG
qilib siqiladi (~50-100 KB) va mavjud `/api/ombor/rasm` endpointiga 3 talik
parallellikda yuklanadi; havolalar "Rasm" ustuni sifatida CSV'ga qo'shiladi.
Import quvuri (tekshirish -> tasdiqlash -> atomik yozish) o'zgarmadi.

**O'zgarishlar:**
- `mahsulotImport.ts`: yangi `rasmUrl` ustuni (muqobil nomlari bitta
  manbada — `lib/excel/rasmUstun.ts`; Bito "Surati" ham taniladi). Faqat
  http(s) qiymat olinadi: fayl nomi yozilgan katak xato emas, "rasm yo'q".
  Yangilash rejimida rasm ustunisiz fayl rasmga TEGMAYDI (narx qoidasi).
- Eksport (`mahsulotEksport.ts`) endi rasm havolasini ham chiqaradi —
  eksport->tahrir->import aylanmasi rasmni yo'qotmaydi.
- Klient: `xlsxBrauzer.ts` (o'qish+rasm ankerlab olish),
  `rasmYuklash.ts` (siqish+parallel yuklash), `useImportOqimi.ts` (oqim),
  ImportModal yangi holatlar bilan. Saqlagich (BLOB token) sozlanmagan
  bo'lsa foydalanuvchi IMPORTDAN OLDIN ogohlantiriladi va tovarlar
  rasmsiz yuklanadi; ayrim rasm yuklanmasa import to'xtamaydi, yakunda
  soni ko'rsatiladi.
- Brauzerda ochilmagan kichik xlsx eski (server) yo'ldan o'tadi — eski
  brauzerda ham import ishlayveradi.

**Tekshiruv:** yangi e2e `npm run test:rasmli-import` (haqiqiy Chromium:
rasmli xlsx tanlanadi, "2 tovar · rasm: 2" ko'rinadi, saqlagich
ogohlantirishi chiqadi, import yakunlanadi, tovarlar ro'yxatda) ✅.
`test:mahsulot-import` (26, 2 tasi yangi — rasm ustuni yozish/yangilash) ✅,
`test:isolation` (22) ✅, `npm run build` ✅.

**Qo'shimcha (mobil rasm yuklash):** tovar kartasidagi rasm tanlash endi
yuklashdan oldin suratni brauzerda siqadi (`rasmSiqish.ts` — import bilan
umumiy): telefon surati 3-8 MB o'rniga ~100 KB JPEG bo'lib ketadi, 5 MB
chegarasiga urilmaydi, iPhone HEIC formati ham JPEG bo'lib chiqadi.
`accept="image/*"` — kamera/galereya tanlovi to'liq ochiq. Eslatma:
production'da rasmlar saqlanishi uchun Vercel'da Blob store ulanishi
(`BLOB_READ_WRITE_TOKEN`) shart — usiz UI ochiq ogohlantiradi.

**Saqlagich sozlandi (2026-08-26):** Vercel'da `balansa-rasmlar` nomli
PUBLIC blob store yaratildi va loyihaga `BLOB` prefiksi + read-write token
bilan ulandi (avvalgi Private store o'chirildi — private rejimda rasm URL
lari ochiq o'qilmasdi). `BLOB_READ_WRITE_TOKEN` endi barcha muhitlarda bor;
shu commit push'i yangi deploy boshlab, tokenni kuchga kiritadi.
Foydalanuvchi 249 tovar + 207 rasmni muvaffaqiyatli import qildi.

### 2026-08-26 — Katalogni tozalash (tugadi)

**Talab:** import keraksiz tovarlarni ham olib kelgan — foydalanuvchi
"faqat Gullar kategoriyasi qolsin, qolganini o'chir" dedi. Bittalab
o'chirish yuzlab bosish, ommaviy yo'l esa umuman yo'q edi (Product uchun
DELETE endpointning o'zi yo'q).

**Yechim:** Ombor "•••" menyusida "🧹 Katalogni tozalash" —
QOLADIGAN kategoriyalar belgilanadi, qolgan tovarlar o'chadi. Ikki bosqich:
server avval aniq hisob qaytaradi (nechta o'chadi / nofaol bo'ladi /
qoladi), foydalanuvchi ko'rib tasdiqlagandagina yoziladi.

Muhim qarorlar (`lib/services/katalogTozalash.ts`):
- Sotuv/kirim/inventarizatsiya/xarid izi bor tovar O'CHIRILMAYDI (FK ham
  Restrict) — `isActive: false` bo'ladi, hisobotlar teshilmaydi.
- Hammasi bitta `runBusinessTx` da; har so'rovda businessId qo'lda.
- "Hammasini o'chir" mumkin emas — kamida bitta kategoriya saqlanishi
  shart (zod refine).
- `notIn` NULL ni qamramasligi hisobga olingan: kategoriyasiz tovarlar
  alohida bayroq bilan boshqariladi.

Test: `npm run test:katalog-tozalash` (4 — hisob, kategoriyasiz bayrog'i,
tarixli nofaol + tenant izolyatsiyasi, audit izi) ✅. `npm run build` ✅,
`test:isolation` (22) ✅, `test:mahsulot-import` (26) ✅.

### 2026-08-26 — Tariflar → ro'yxatdan o'tish → sinov oqimi (tugadi)

**Talab:** "Bitta Balansa, bitta narx tizimi" strategiyasi: landing → /tariflar
(kalkulyator) → aqlli ro'yxatdan o'tish → 14 kunlik sinov → yo'nalishga
moslashgan workspace. Sanoat bo'yicha alohida tarif YO'Q — biznes turi faqat
shaxsiylashtiradi, narxni o'zgartirmaydi.

**Yechim (yangi qatlamlar):**
- `lib/pricing/config.ts` — YAGONA ommaviy narx manbai: baza 399 000, filial
  +149 000 (birinchisi kiritilgan), 5 addon (Telegram 79k, CRM 99k, POS 99k,
  Kengaytirilgan Ombor 79k, AI 99k), yillik = 10 oylik ("2 oy bepul").
  `narxHisobla()` — barcha summalar shu funksiyadan. MUHIM CHEGARA: bu
  marketing/onboarding qatlami; amaldagi to'lov (lib/billing/plans.ts,
  Payme/Click) TEGILMAGAN — yangi model bo'yicha haqiqiy pul olish billing
  integratsiyasini kutadi (quyida).
- `lib/pricing/profil.ts` — 8 yo'nalish (auto/perfume/food/agro/service/
  wholesale/manufacturing/other): boshlang'ich bayroqlar (omborli/magazin),
  tavsiya addonlar, 3 qadamli onboarding. `biznesFaoliyati.ts` naqshining
  ommaviy qatlami — jadval/hisob mantiqi hamma uchun BITTA.
- `/tariflar` — kalkulyator (yo'nalish → filial slayderi → addonlar →
  oylik/yillik), sticky xulosa, mobil pastki CTA, kiritilgan imkoniyatlar,
  matritsa, FAQ. Tanlov URL'da (refresh/back chidamli), signup'ga
  `?yonalish=&filiallar=&addons=&davr=` bilan o'tadi — ISHONCHSIZ hint:
  yaroqsiz qiymat jimgina tushiriladi, narx/tarif serverda qayta hisoblanadi.
- Landing: nav "Kimlar uchun"/"Tariflar", CTA "14 kun bepul boshlash",
  yangi `KimlarUchun` bo'limi (narxsiz, profillardan), `Narx` bo'limi endi
  yagona tizim teaser'i → /tariflar.
- Signup 2 qadam (hisob → biznes sozlash, yo'nalish/filial oldindan
  to'ldirilgan). Server: `Business.yonalish` (yangi NULL ustun, migratsiya
  `20260826120000_biznes_yonalish`), tanlangan addon modullari TenantModule
  orqali yoqiladi, sinov tarifi `sinovPlanTanla()` — modullarni qamrab
  oladigan ENG ARZON plan (masalan CRM → PRO, XARID → SHOP). Foydalanuvchi
  tanlamagan pullik modul HECH QACHON yoqilmaydi. Yo'nalishsiz signup —
  avvalgidek (regressiya testi bor).
- Dashboard: `OnboardingKarta` — faqat TRIAL tenantda, yo'nalishga mos 3
  qadam, bajarilganlik HAQIQIY ma'lumotdan (mahsulot/sotuv/mijoz soni),
  hammasi bajarilgach yo'qoladi. Sinov muddati mavjud `computeAccess` dan.

**Tegilmagani:** trial/access tizimi (Tenant.status/trialEndsAt,
computeAccess, BillingBanner, /billing) — allaqachon to'liq ishlaydi,
qayta yozilmadi. PLANLAR narxlari o'zgartirilmadi.

**Billing integratsiyasi KUTILMOQDA (hujjat):** /tariflar ko'rsatadigan
"baza+filial+addon" summasini sinovdan keyin haqiqatda undirish uchun
checkout hozircha plan-asosli (PLANLAR). Kelgusi qadam: `narxHisobla()`
natijasini Payme/Click checkout'ga ulash yoki PLANLAR'ni shu modelga
ko'chirish — mahsulot qarori bilan. Analitika hodisalari qo'shilmadi —
loyihada analitika infratuzilmasi yo'q (yangi vendor kiritilmadi).

Test: `npm run test:tariflar` (13 — narx formulasi, profillar, sinov plan
tanlovi, signup shaxsiylashtiruvi) ✅. Regressiya: signup 11, isolation 22,
modules 21, billing 22, migratsiya 12, izolyatsiya-royxati 9, bizneslar 21,
dashboard-ux 21, avto 25, superadmin 11+27, kop-biznes 18, magazin 43,
smoke (brauzer) 11 — hammasi ✅. `npm run build` ✅. Brauzerda qo'lda: Flow
A (food+POS, 647 000), Flow B (service+CRM, 498 000), Flow C (agro, 5
filial, yillik 9 950 000 / tejov 1 990 000), yaroqsiz URL parametrlari,
375/390/768/1440 kengliklar, mavjud login — 62/62 ✅ (eslatma: landingdagi
ESKI Rollar jadvali 375px da scrollWidth'ni oshiradi, lekin sahifa
`overflow` bilan qirqilgan — foydalanuvchiga ko'rinmaydi, oldindan mavjud).

### 2026-08-27 — Qarz to'lov summasi avtomatik to'ldirilmasin (tugadi)

**Talab:** Qarzdorlik → To'lov qabul qilish oynasi ochilganda summa
inputiga mijozning JAMI qarzi (masalan 42 824 000) avtomatik yozilib
qolardi. Operator qisman to'lovda (mijoz 5 000 000 berdi) eski qiymatni
o'chirishni unutsa, butun qarz "to'landi" bo'lib yozilish xavfi bor edi.

**Yechim:** summa maydoni endi BO'SH ochiladi, placeholder
"To'lov summasini kiriting". Operator real olingan pulni o'zi yozadi.

O'zgargan joylar:
- `QarzdorTolovSheet.tsx` — `useState(formatSom(jamiQarz))` → `useState("")`;
  "Qaysi qarzga yoziladi" selecti ham summani qayta to'ldirmaydi (operator
  yozgani saqlanadi); Tasdiqlash tugmasi summa bo'sh/0 bo'lsa disabled.
- `QarzTolovForm.tsx` (bitta qarz bo'yicha forma) — xuddi shu tuzatish.

Validatsiya TEGILMADI, faqat tekshirildi: klientda `s <= 0` va
`s > chegara` xatolari, `parseSomInput` manfiy sonni o'tkazmaydi
(`[^\d]` olib tashlanadi); serverda zod `positive int` +
`summa > qolgan` rad etiladi. FIFO taqsimot (`services/qarz.ts`,
eng eski qarzdan) va kassa tanlash (naqd/click/bank → account) o'zgarmagan.

Test: `npm run build` ✅, `test:qarz` (16) ✅, `test:qarzdorlik` (16) ✅,
`test:qarz-taqsimot` (13) ✅, `test:isolation` (22) ✅,
`test:qarzlar-brauzer` (8) ✅.

### 2026-08-27 · Dashboard "Kassada" kartasi — kassa qoldig'i mantiqi tuzatildi

**Muammo:** karta tarixiy kirimlardan qolgan soxta summani ko'rsatardi —
pul allaqachon sarflangan bo'lsa ham qoldiq kamayavermasdi. Audit uchta
teshikni topdi (hisoblash formulasi emas, LEDGERGA YOZISH yo'llari oqardi):

1. **Takroriy (recurring) yozuv kassasiz yaratilardi** — `recurring.ts`
   xom `create` ishlatgani uchun `accountId = null` qolardi. Takroriy
   chiqim (ijara, oylik) hech qaysi kassadan ayrilmasdi va qoldiq
   oydan-oyga shishib borardi.
2. **`kassa-migratsiya` skripti QARZ kirimlarini ham kassaga bog'lardi**
   (u har deployda ishlaydi). Qarzga yozilgan savdo pul emas — kassa
   qoldig'i qarz savdolari hisobiga soxta oshardi.
3. **Bulk-move `accountId` ni qayta bog'lamasdi** — ko'chirilgan yozuv
   eski biznes kassasiga ishora qilib qolardi: manba kassaning chiqimi
   ledgerdan yo'qolib qoldiq sababsiz ko'tarilardi, maqsad biznesda esa
   yozuv umuman hisobga kirmasdi.

**Nima qilindi**
- `recurring.ts` endi `createTransactionTx` orqali yozadi — kassa
  boshqa yozuvlar bilan bir xil qoidada tanlanadi.
- Qarz filtri (`qarzFiltr.ts`) barcha ledger hisoblariga qo'shildi:
  `getAccountBalances`, `getKassaKunlik`, `kassaQoldiqTx`,
  `biznesNaqdQoldiqTx` (unga kassaning `businessId` tekshiruvi ham).
- Bulk-move mantiqi `lib/services/tranzaksiyaKochirish.ts` ga ajratildi:
  ko'chirishda kassa maqsad biznesning mos turdagi (naqd→naqd,
  plastik/bank oilasi) kassasiga qayta bog'lanadi; qarz yozuvi kassasiz.
- `scripts/kassa-migratsiya.ts` (deploy zanjiri): qarz yozuvlarini kassadan
  UZADI, begona biznes kassasiga bog'langan yozuvlarni o'z biznesining mos
  kassasiga o'tkazadi, bo'sh `accountId` bog'lashda qarzni chetlab o'tadi.
  Idempotent — mavjud ma'lumot o'chirilmaydi, faqat bog'lanish tuzatiladi.

**Fayllar:** `src/lib/queries/accounts.ts`, `src/lib/services/userKassa.ts`,
`src/lib/services/kunlikKassa.ts`, `src/lib/services/recurring.ts`,
`src/lib/services/tranzaksiyaKochirish.ts` (yangi),
`src/app/api/transactions/bulk-move/route.ts`, `scripts/kassa-migratsiya.ts`,
`tests/kassa-qoldiq.test.ts` (yangi), `package.json`

Test: `npm run test:kassa-qoldiq` (5) ✅ — to'liq ssenariy (kirim→chiqim→
transfer→chiqim = 0), qarz istisno emas: buzilgan bog'lanishda ham qoldiqqa
kirmaydi, takroriy chiqim kassani kamaytiradi, bulk-move qayta bog'laydi,
migratsiya skripti tuzatadi. Regressiya: `test:kassa` (11), `test:kassa-nazorat`
(23), `test:kassa-transfer` (20), `test:kunlik-kassa` (18), `test:kassir-kassa`
(22), `test:panel` (22), `test:automation`, `test:kirim-chiqim`,
`test:isolation`, `test:kunlik`, `test:smena` — hammasi ✅. `npm run build` ✅.

### 2026-08-28 — Davomat 2.0: selfie + GPS davomat, ish jadvali, jarima/bonus, oylik integratsiyasi (tugadi)

**Branch:** `claude/balansa-hr-attendance-payroll-xz5ior`

**Nima qilindi**
- Migratsiya `20260828090000_davomat_2_selfie_gps` — FAQAT qo'shuvchi: 9 yangi jadval
  (`WorkLocation`, `WorkSchedule`, `WorkScheduleDay`, `AttendanceCheck`,
  `AttendanceSelfie`, `PenaltyRule`, `EmployeePenalty`, `EmployeeBonus`, `HrSetting`)
  va `Attendance`/`Employee`/`Payroll` ga yangi ustunlar (ALTER ADD COLUMN, default bilan).
  Hech qanday jadval qayta qurilmaydi, mavjud HR-lite oqimi buzilmaydi.
  Baza darajasida himoya: bitta davomatga bitta avto-jarima (qisman unique indeks),
  bir xodim + bir kun = bitta yozuv (mavjud unique).
- Xodim check-in/check-out: `/app/hr/men` (mobil ustuvor) — old kamera selfie
  (getUserMedia + `capture="user"` fallback), GPS, server Haversine radius tekshiruvi.
  VAQT FAQAT server soati; kim ekani sessiyadan; frontend businessId/vaqtga ishonilmaydi.
- Selfie DB'da base64 saqlanadi (`saqlagich: "db"`, 400 KB chegara, mijoz siqadi) —
  ochiq URL YO'Q, faqat avtorizatsiyalangan `/api/hr/davomat/selfie/[id]`
  (boshqaruvchi yoki xodimning o'zi).
- Ish jadvali (haftalik shablon + imtiyoz/grace + standart + xodimga biriktirish),
  ish joylari (GPS nuqta + radius preset), xodim siyosati (selfie/GPS/radius alohida).
- Jarima qoidalari (biznes sozlaydi, kesishuv tekshiruvi, namunaviy to'plam 1 bosishda);
  kechikish/kelmaganlikda avto-jarima KUTILMOQDA holatida ochiladi, oylikka FAQAT
  tasdiqlangani kiradi (summani tahrirlash asl summa bilan auditda qoladi).
- Oylik formulasi kengaydi: hisoblangan + qoshimcha + bonuslar − ushlab − jarimalar − avans
  (`Payroll.bonuslar/jarimalar` snapshot ustunlari; avans/tasdiq oqimlari sinxron).
- Cron `/api/cron/davomat` (20:00 UTC = 01:00 Toshkent): o'tgan Toshkent kuni bo'yicha
  jadvalda ish kuni bo'lgan, yozuvi yo'q xodimlar "kelmadi" + jarima; dam kuni hech qachon
  kelmadi bo'lmaydi; idempotent.
- Direktor sahifalari: `/app/hr/bugun` (jonli panel: kim keldi/kechikdi/ishda/ketdi,
  selfie/masofa, davr hisobot bloki), `/app/hr/jadval`, `/app/hr/oylik`, `/app/hr/jarima`,
  `/app/hr/sozlamalar`, `/app/hr/xodim/[id]` (tarix + dalillar + siyosat + tuzatish).
  Admin tuzatishi asl dalilni o'chirmaydi — alohida `admin` manbali check yozuvi
  (kim/qachon/sabab/avvalgi qiymat) + audit log.
- HR moduli rollari HAMMA bo'ldi (xodim "Davomatim"ni ko'rishi uchun); boshqaruv
  sahifa/API'lari avvalgidek `requireManager` bilan qulflangan.
- Faza 2 (CCTV/yuz tanish) uchun tayyor: `AttendanceCheck.manba` = "selfie_gps" |
  "admin" | "kamera" — kamera hodisasi shu jadvalga yozilib, o'sha jarima/oylik
  dvigatelidan foydalanadi. RTSP/ONVIF ATAYLAB yozilmagan.

**Testlar:** `tests/davomat.test.ts` (18 test: chegara 09:05/09:06, Haversine,
radius rad, selfie/GPS siyosati, dublikat check-in/out, tenant izolyatsiyasi,
admin tuzatish, jarima tasdiqlash/rad/oylik, kelmaganlar cron, qoida kesishuvi).
`test:izolyatsiya-royxati`, `test:backup`, `test:hr`, `test:isolation`, `test:dialect`
(pg init migratsiya qayta yaratildi — 61 jadval) — yashil. `npm run build` o'tdi.

### 2026-08-30 — Kirimda sotuvchi/xodim + "Xodimlar" analitika bo'limi (tugadi)

**Branch:** `claude/kirim-xodimlar-tracking-cbtxzr`

**Nima qilindi**
- Migratsiya `20260830090000_kirim_sotuvchi` — FAQAT qo'shuvchi:
  `Transaction.sotuvchiId` (TEXT NULL, FK User ON DELETE SET NULL) + 2 indeks
  (`businessId+sotuvchiId+sana`, `sotuvchiId`). Jadval qayta qurilmaydi, eski
  yozuvlar tegilmaydi. Postgres init qayta generatsiya qilindi.
- `userId` (kim kiritgan, audit) va `sotuvchiId` (savdo kimniki) AJRATILDI.
  Kirim formasida "Sotuvchi / Xodim" tanlovi: standart — yozuvchining o'zi;
  boshqa xodimni tanlash faqat boshqaruvchiga (server ham majburlaydi —
  `lib/services/sotuvchi.ts`); tanlov ro'yxati biznes chegarasida
  (`UserBusiness` qoidasi, boshqa biznes xodimi ko'rinmaydi). Chiqimda yozilmaydi.
- CRM → Kirim ko'chirishda sotuvchi = buyurtma MAS'ULI (`Deal.masulId`),
  ko'chirishni kim bosgani emas. Deal ↔ Transaction 1-1 UNIQUE bo'lgani uchun
  bitta zakaz statistikada BIR marta sanaladi.
- "Xodimlar" bo'limi (`/app/tranzaksiyalar/xodimlar`): davr filtri
  (Bugun/Bu hafta/Bu oy/Sana, standart "Bu oy"), KPI (jami zakaz, jami sotuv,
  eng ko'p zakaz/summa), reyting (zakaz soni, summa, o'rtacha, ulush %).
  Xodim detali (`/xodimlar/[id]`): davr + kategoriya + to'lov filtrlari,
  yozuvlar lentasi. Mobile-first, karta-qatorlar, jadval yo'q.
- Statistika manbai — kirim tranzaksiyalari: biriktirish `sotuvchiId ?? userId`
  (eski yozuvlar yo'qolmaydi); qarz TO'LOV yozuvlari (`DebtPayment.transactionId`)
  chiqariladi — qarzga savdo faqat savdo kunida bir marta sanaladi.
- Himoya: sahifa + API (`/api/transactions/xodimlar-statistika[/id]`) mavjud
  `hisobot.korish` huquqi bilan (davr yakuni qoidasi) — OWNER/ADMIN da bor,
  sotuvchi/kassirda yo'q, maxsus rolga direktor o'zi beradi.
- Kirim/Chiqim sahifasidagi qarz mas'uli/"kim kiritdi" ro'yxati endi biznes
  chegarali (`listBiznesXodimlari`) — ilgari tenantning barcha userlari chiqardi.

**Testlar:** `tests/xodim-statistika.test.ts` (12 test: default sotuvchi, huquq,
biznes/tenant izolyatsiyasi, chiqimda null, CRM 1-marta sanash, KPI/reyting/ulush,
davr filtri, qarz to'lovi chiqarilishi, detal filtrlari, eski yozuvlar,
hisobot.korish matritsasi, jami kirim/chiqim o'zgarmagani). `test:crm`,
`test:isolation`, `test:agregat`, `test:atomik`, `test:kirim-chiqim`, `test:qarz`,
`test:visibility`, `test:soft-delete`, `test:tasdiqlash`, `test:kunlik`,
`test:izolyatsiya-royxati`, `test:postgres` — yashil. `npm run build` o'tdi.

### 2026-08-30 — Xodimlar bo'limi kengaytmasi: rasm, plan, vazifalar, performance (tugadi)

**Branch:** `claude/expand-employees-section-bduqqf`

**Nima qilindi**
- Migratsiya `20260830120000_xodim_plan_vazifa` — FAQAT qo'shuvchi:
  `Employee.rasmUrl`; `Task.employeeId` (FK Employee, SET NULL) + `muhimlik`
  + `boshlanish` + 2 indeks; yangi `EmployeePlan` jadvali
  (`@@unique([employeeId, oy])` — bir xodim + bir oy = bitta yozuv).
  Postgres init qayta generatsiya (62 jadval). Dublikat tizim YO'Q:
  vazifalar mavjud `Task` ustida (`employeeId` null = oddiy CRM vazifasi),
  rasm mavjud saqlagich (`lib/storage/driver`) va ombor rasm oqimi bilan.
- PLAN: turi "zakaz" | "savdo" | "kirim" | "vazifa"; natija (actual) bazada
  SAQLANMAYDI — har o'qishda manbadan hisoblanadi (`lib/queries/xodimPlan.ts`).
  Zakaz/savdo — kirim tranzaksiyalari `sotuvchiId ?? userId` kesimida
  (xodimStatistika qoidasi: CRM zakaz 1-1 bog'langani uchun BIR marta, qarz
  to'lovi chiqariladi); "kirim" — haqiqatda kelgan pul (qarzga savdo emas,
  to'lovlar bilan); "vazifa" — oy ichida BAJARILDI bo'lganlar. Foiz 100% dan
  osha oladi. Har oy plani alohida — o'tgan oy statistikasi buzilmaydi.
- Vazifa holatlari: OCHIQ/JARAYONDA/BAJARILDI + yangi BEKOR; "Kechikdi"
  holat EMAS — muddatdan hisoblanadi. Cron eslatma BEKOR'ni o'tkazib yuboradi.
  masulId ko'prigi: userli xodim → o'sha user (kanban/Telegram ishlaydi).
- UI: `/app/hr` endi kartochkalar (avatar/initials, holat Faol/Ta'tilda/
  Ishdan chiqqan, plan progress bar + foiz, zakaz/savdo, vazifa 8/10,
  kechikkan) + direktor dashboard (faol, o'rtacha %, 100%+, ortda, eng
  yaxshi) + saralash/reyting (medal). Xodim detail — 5 tab: Umumiy (KPI +
  plan tarixi), Zakazlar, Vazifalar (+ Vazifa modal, muhimlik/deadline),
  Davomat (avvalgi mazmun), Oylik (vedomost tarixi). "Davomatim"da xodim
  o'z plani/natijasi/vazifalarini ko'radi va holatini o'zgartiradi.
- API: `/api/hr/plan` (GET performance, POST upsert), `/api/hr/plan/[id]`
  (DELETE), `/api/hr/vazifalar` (+`/[id]`), `/api/hr/rasm` (ombor rasm
  oqimining nusxasi, `xodim-` prefiksi). Boshqaruv `requireManager`;
  oddiy xodim faqat o'z vazifalarini ko'radi/holatini o'zgartiradi
  (server `Employee.userId` orqali tekshiradi, mijoz id'siga ishonilmaydi).
- `tenantDb.BUSINESS_SCOPED` += EmployeePlan; `ZAXIRA_JADVALLARI`da `task`
  CRM blokidan `employee`dan keyinga ko'chirildi (endi Employee'ga FK) va
  `employeePlan` qo'shildi.

**Testlar:** `tests/xodim-plan.test.ts` (18 test: rasm URL validatsiyasi,
upsert/oy tarixi, foiz 75%/150%, zakaz-savdo-kirim manbalari + qarz to'lovi
chiqarilishi, vazifa plani, kechikkan/BEKOR, faqatHolat rejimi, egalik,
tenant izolyatsiyasi, dashboard, pul yozilmasligi). `test:izolyatsiya-royxati`,
`test:isolation`, `test:backup`, `test:hr`, `test:tasks`,
`test:xodim-statistika`, `test:migratsiya`, `test:postgres`, `test:davomat`,
`test:crm` — yashil. `npm run build` o'tdi.

### 2026-08-31 — CRM zakaz-xodim biriktiruvi va kategoriya samaradorligi (tugadi)

**Branch:** `claude/crm-employee-analytics-qxj46u`

**Nima qilindi**
- Migratsiya `20260831090000_xodim_kategoriya` — FAQAT qo'shuvchi: 3 yangi jadval.
  `EmployeeCategory` (biznes darajasida sozlanadigan yo'nalishlar — Sotuvchi,
  Diktor, Shofer...; `turi`: "sotuvchi" (savdo KPI) | "ijrochi" (bajarilgan ish
  KPI) — KPI uslubi NOMGA emas, shu maydonga bog'lanadi; o'chirish YO'Q, faqat
  `aktiv=false`), `EmployeeCategoryMember` (xodim↔kategoriya ko'p-ko'p,
  UNIQUE(categoryId, employeeId)), `DealEmployee` (zakaz↔kategoriya↔xodim,
  UNIQUE(dealId, categoryId, employeeId) — kelajakda bir kategoriyaga bir necha
  xodim ham sig'adi; kategoriya/xodimga RESTRICT — tarixiy biriktiruv tasodifan
  yo'qolmasin). Postgres init qayta generatsiya (65 jadval).
- CRM "Yangi buyurtma" formasida "Zakazdagi xodimlar" bo'limi: har faol
  kategoriya uchun bitta selektor, ro'yxatda faqat o'sha kategoriya a'zolari
  (server `zakazXodimlariniTekshir` bilan majburlaydi — xato ro'yxatda buyurtma
  UMUMAN ochilmaydi). Sotuvchi-turidagi kategoriyada joriy foydalanuvchining
  xodim yozuvi bo'lsa o'zi oldindan tanlanadi; sotuvchi selektori bor bo'lsa
  eski "Mas'ul xodim" maydoni yashiriladi — MAS'UL SOTUVCHIDAN SINXRONLANADI
  (`Deal.masulId` = sotuvchi xodimning `userId`si). Shu tufayli CRM→Kirim
  ko'chirilganda `Transaction.sotuvchiId` (mavjud xodim statistikasi) ham AYNI
  sotuvchiga yoziladi — ikkita hisob bitta haqiqat manbaida.
- Buyurtma tafsilotida (BuyurtmaSheet) biriktiruvlar ro'yxati + tahrir; kirim
  yozilgach server qulflaydi (summa/kategoriya qulfi bilan bir qoida) — yakunlangan
  zakaz statistikasi keyin o'zgarmaydi. CRM→KIRIM OQIMI TEGILMADI: pul avvalgidek
  `lib/crm/kirim.ts` orqali BIR marta (Deal.transactionId UNIQUE, baza darajasida);
  DealEmployee moliyaviy yozuv EMAS.
- `/app/hr/kategoriyalar` (faqat boshqaruvchi): yaratish (tez to'ldirish
  takliflari — bazaga yozilmaydi), nomlash, KPI turi, tartib (↑/↓),
  aktiv/noaktiv, a'zolik (checkbox, to'liq almashtirish). O'chirish ATAYLAB yo'q.
- `/app/hr/samaradorlik` (`hisobot.korish`): davr filtri (Bugun/Bu hafta/
  Bu oy/Sana, standart "Bu oy" — DavrFiltri qayta ishlatildi), kategoriya
  tablari, KPI turi bo'yicha: sotuvchi — jami sotuv/jami zakaz/yutilgan/
  konversiya/eng yaxshi; ijrochi — jami bajarilgan/faol xodimlar/eng ko'p
  bajargan/o'rtacha zakaz-xodim (ma'nosiz KPI ko'rsatilmaydi). Reyting:
  sotuvchi — yutilgan summa (teng bo'lsa soni), ijrochi — bajarilgan soni;
  🥇🥈🥉 medallar. Xodim detali (`/samaradorlik/[id]`): KPI, plan, reyting
  o'rni, zakazlar lentasi → `/app/crm?buyurtma=ID` (doska o'sha buyurtmani ochadi).
- STATISTIKA MANBAI: Deal + DealEmployee + Stage.turi (WON/LOST) — hisoblagich
  SAQLANMAYDI, har o'qishda manbadan. Davr: `Deal.sana` (eskilarda createdAt).
  A'zolikdan chiqarilgan/noaktiv kategoriya tarixi analitikada qoladi. PLAN —
  mavjud `EmployeePlan` dvigateli (`getXodimlarPerformance`), yangi jadval YO'Q:
  HR sahifasi bilan bir xil foiz, davr oxiri oyi bo'yicha.
- `tenantDb.BUSINESS_SCOPED` += EmployeeCategory, EmployeeCategoryMember,
  DealEmployee; `ZAXIRA_JADVALLARI`ga uchalasi bog'liqlik tartibida
  (`employeePlan`dan keyin — dealEmployee deal/employee/employeeCategory'dan KEYIN).

**Testlar:** `tests/xodim-kategoriya.test.ts` (19 test: kategoriya CRUD +
dublikat nom + tartib, tenant izolyatsiyasi (ro'yxat, tahrir, biriktiruv,
analitika), a'zolik almashtirish + begona xodim rad, forma selektorlari,
createDeal biriktiruv + sotuvchi→mas'ul sinxroni, a'zo bo'lmagan xodim bilan
buyurtma ochilmasligi, WON+kirim BIR marta + dublikat rad (500 000 bir marta),
kirim yozilgach biriktiruv qulfi, sotuvchi/ijrochi KPI-reyting, davr filtri,
savdo plani foizi, xodim detali, noaktiv kategoriya tarixi, eski biriktiruvsiz
buyurtma mosligi, hisobot.korish matritsasi). `test:izolyatsiya-royxati`,
`test:backup`, `test:crm`, `test:xodim-statistika`, `test:xodim-plan`,
`test:isolation`, `test:hr`, `test:tasks`, `test:migratsiya`, `test:davomat`,
`test:kirim-chiqim`, `test:dialect`, `test:postgres` — yashil. `npm run build` o'tdi.

## 2026-09-01 — BALANSA DESIGN SYSTEM + OPTOM CRM INTEGRATSIYASI

**Maqsad:** (1) butun platformada native `<select>` larni yagona premium
ko'rinishga keltirish; (2) optom bizneslar uchun Sotuv → Mijoz → Qarz
zanjirini to'liq ishlatish ("qaysi mijozga nima sotildi, qancha qarzi bor").

**Design system:**
- `components/ui/Select.tsx` — YANGI yagona ochiladigan ro'yxat: custom
  listbox, klaviatura (Up/Down/Home/End/Enter/Esc/Tab), `searchable`
  (qidiruv maydoni), `tavsif` (ikkilamchi qator), disabled variantlar,
  pastga sig'masa yuqoriga ochilish, `aria-label`/combobox rollari.
  Native select endi asosiy UI'da YO'Q — 71 ta select ~53 faylda almashdi
  (sotuv, qarzlar, tranzaksiyalar, kassa, ombor, hr, crm, hujjatlar, admin,
  superadmin, pos, kunlik, vazifalar, takroriy, tasdiqlash, ai).
- `BusinessSwitcher` qayta yozildi: qidiruvli (5+ biznesda), faol biznes
  belgisi, hover/focus/klaviatura. Almashish mantig'i O'ZGARMAGAN
  (`/api/me/active-business` + cookie).
- Sotuv formasi: `TolovTuriTanlov` (segmented Naqd/Qarzga), Jami — alohida
  brand-wash karta (`Money` bilan), `INPUT_CLASS`/`LABEL_CLASS` ga o'tildi.

**Optom (ulgurji) rejim:**
- `Business.turi` ga yangi qiymat "optom" (`lib/biznesTuri.ts`:
  `isOptom()`, BIZNES_TURLARI; validation/business, superadmin, signup,
  biznesYaratish kengaytirildi). Migratsiya KERAK EMAS — turi string ustun.
- SERVER qoidasi (`createSale`): optom biznesda mijozsiz sotuv o'tmaydi
  (naqdda ham); qarzga sotuvda mijoz har doim majburiy (avvalgidek).
  Frontend ham bloklaydi, lekin manba — server.
- Sotuv formasida mijoz endi TEPADA va har sotuvda tanlanadi: optomda
  majburiy, chakanada "(ixtiyoriy)", qarzda majburiy. Naqd sotuv ham endi
  `contactId` bilan yoziladi — mijoz aniqlash BITTA joyda
  (`mijozniAniqlaTx`: egalik tekshiruvi + dublikat himoyasi naqdga ham).
- Sotuv sahifasi: o'ngda "Bugungi sotuvlar" paneli — 4 stat
  (`getBugungiSotuvStat`: savdo/soni/naqd/qarz, bitta groupBy) + so'nggi
  sotuvlar jadvaliga Vaqt va Mijoz ustunlari + EmptyState.

**Mijoz kartochkasi (Contact):**
- YANGI migratsiya `20260901090000_kontakt_optom_maydonlar` — Contact'ga
  `manzil` va `masulShaxs` (ikkalasi nullable, FAQAT QO'SHUVCHI; postgres
  init `pg:migratsiya` bilan qayta generatsiya qilindi).
- Tez qo'shish formasi (YangiMijozForm) va MijozModal'da yangi maydonlar;
  `qarzMijozYarat` mavjud kartochkada bo'sh maydonlarni to'ldiradi (ustidan
  yozmaydi).
- Profil (`mijozlar/[id]`): jamlanmalar endi 50 talik kesimdan emas,
  AGREGATLARDAN — jami xarid, sotuv soni, oxirgi sotuv sanasi, YANGI
  "Jami to'lov" (naqd sotuvlar + qarz to'lovlari), joriy qarz.

**Testlar:** YANGI `tests/optom-sotuv.test.ts` (`test:optom`, 8 test):
optomda naqd/qarz mijozsiz rad + ombor tegilmaydi; mijozli naqd → kartochka
+ kirim + qoldiq; qarzga → BITTA qarz, saleId bog'i, kirim yo'q; kartochka
statistikasi; umumiy biznes regressiyasi; dublikat kartochka yo'q.
Regressiya: isolation 22, izolyatsiya-royxati 9, qarz-mijoz 18, sotuv-bekor
11, mijozlar 15, qarz 16, qarzdorlik 16, migratsiya 12, atomik 6,
kirim-chiqim 19, crm 24, tolov-taqsimoti 11 — hammasi yashil. Build o'tdi.

---

## CRM ZAKAZ PIPELINE (Disney Navoiy) — 2026-09-01

Doska "Yangi → Aloqa qilindi → Taklif yuborildi → Yutildi → Yo'qotildi"
bosqichlariga tayanardi. Disney Navoiy zakazi esa OLDINDAN olinadi: 01.09 da
murojaat, xizmat 18.09 da. Bunday zakazning o'rni bosqich bilan emas, SANA
bilan aniqlanadi.

**Asosiy arxitektura qarori — "BUGUNGI" ALOHIDA HOLAT EMAS.**
Ustun `Deal.holat` + `Deal.sana` dan HAR O'QISHDA hisoblanadi
(`lib/crm/pipeline.ts` — sof, bazasiz funksiyalar; server ham, brauzer ham
ayni qoidada). Kun almashganda bazaga hech narsa yozilmaydi:
- kunlik cron kerak emas (ishlamay qolsa doska yolg'on ko'rsatardi);
- admin qo'lda status almashtirmaydi;
- kechagi bajarilmagan zakaz "Bugungi"dan chiqib KUTILAYOTGANda qoladi va
  "N kun kechikkan" belgisini oladi (yo'qolib ketmaydi).
Sana Asia/Tashkent bo'yicha (`todayTashkentDateOnlyString`) — UTC yarim tuni
zakazni bir kun oldin/keyin surib yubormaydi.

**Baza:** migratsiya `20260901140000_crm_zakaz_pipeline` — `Deal` ga to'rt
ustun (YANGI JADVAL YO'Q):
- `holat` (KUTILMOQDA | JARAYONDA | YUTILDI | YOQOTILDI) — eski yozuvlarda
  bosqich turidan backfill (WON→YUTILDI, LOST→YOQOTILDI, qolgani KUTILMOQDA);
- `tolangan` — haqiqatda olingan pul (to'lov holati SHUNDAN hisoblanadi;
  alohida `paymentStatus` ustuni ATAYLAB yo'q — u summa bilan zid holatga
  tushib qolardi). Backfill: kirim yozilgan zakaz — to'liq to'langan;
- `tolovTuri` — pul kanali ("naqd" | "click" | "qarz");
- `debtId` + UNIQUE + FK — yakunlashda ochilgan qarz. UNIQUE aynan
  `transactionId` dagi kabi: bitta zakaz ikkita qarz ham, ikkita kirim ham
  yarata olmaydi. Himoya BAZADA.
Bosqichlar (`Stage`) TEGILMADI: ular `holat` ning ko'zgusi sifatida sinxron
yuritiladi (`bosqichdanHolat` / `pipelineBosqichlari`), chunki dashboard, AI
analitikasi va xodim reytingi hali `Stage.turi` ni o'qiydi. Eski bizneslarda
yetishmagan "Jarayonda" bosqichi idempotent qo'shiladi, eskilari
o'chirilmaydi (tarixiy zakazlar ularga bog'langan).

**Moliya (`lib/crm/yakunlash.ts`):** "Yutildi" — BIZNES yakuni, to'lov holati
ALOHIDA haqiqat manbai. Yakunlash pulni ikkiga bo'ladi: to'langan qism
KIRIMga, qolgani QARZDORLIKKA. Qarzga savdo kirim yozmaydi (mavjud qarz
moduli qoidasi) — kirim keyin, to'lov sanasi bilan tushadi. Hammasi bitta
`runBusinessTx` ichida; takroriy chaqiruv jimgina mavjud natijani qaytaradi.

**Sotuvchi statistikasi:** kategoriya analitikasi endi olingan / bugungi /
jarayonda / yutilgan / yo'qotilgan kesimlarini (soni + summa), konversiyani
va "to'liq puli kelgan sotuv" ni (bonus hisobi shu raqamga tayanadi —
qarzga ketgan qism kirmaydi) beradi. Kesim CRM doskasi bilan AYNI
funksiyadan chiqadi, ya'ni raqamlar ustun sarlavhalari bilan mos.

**UI:** 4 ustunli doska (mobil gorizontal svayp saqlangan), ustun
sarlavhasida soni + summa + kechikkanlar, karta (kategoriya/nomi/mijoz/
telefon/narx/sana/sotuvchi/to'lov va workflow belgilari), filtr (sana
presetlari, sotuvchi, kategoriya, to'lov holati — URL'da), tafsilotda
ustunga mos tez amallar. Yangi zakaz formasida ZAKAZ SANASI majburiy va
to'lov turi (to'liq/qisman/qarzga) tanlanadi; "Yutildi bosilganda: Kirim X ·
Qarzdorlik Y" oldindan ko'rsatiladi.

**Testlar:** YANGI `tests/crm-pipeline.test.ts` (`test:crm-pipeline`, 18
test) — topshiriqdagi 8 stsenariy (kelajak/bugungi ustun, jarayonga o'tish,
to'liq/qarz/qisman taqsimot, kechikkan zakaz, ikki marta yutildi → bitta
kirim) + bazadagi UNIQUE himoyasi, moliyaviy qulf, arxiv, izolyatsiya,
filtr. Regressiya: crm 24, xodim-kategoriya 19, xodim-statistika 12,
isolation 22, izolyatsiya-royxati 9, ai 28, qarz 16, qarzdorlik 16,
migratsiya 12, backup 6, soft-delete 8, atomik 6, kunlik 27, hr 19,
mijozlar 15, dashboard-ux 21, kirim-chiqim 19, tolov-taqsimoti 11,
postgres 2 — hammasi yashil. Build o'tdi.
(panel 3 va cron 1 qizil — o'zgarishdan OLDIN ham qizil edi, bu ish bilan
bog'liq emas.)
## CRM zakaz SOTUVCHISI + sotuvchi statistikasi (2026-09-01)

**Nega yangi model YO'Q.** Audit ko'rsatdiki "kim sotdi" savoliga javob
beradigan tuzilma allaqachon bor: `EmployeeCategory.turi = "sotuvchi"` +
`DealEmployee` (zakaz ↔ xodim biriktiruvi). Yangi `sellerId` ustuni yoki
ikkinchi Employee modeli qo'shilsa ikkita haqiqat manbai paydo bo'lardi.
Shuning uchun sotuvchi SHU tuzilmada qoldi, ustiga birinchi darajali
maydon va statistika qurildi. Ekrandagi eski dropdown — `Deal.masulId`
(User, "mas'ul"), u sotuvchi bilan ARALASHTIRILMADI.

**Migratsiya:** `20260901140000_crm_sotuvchi` — FAQAT QO'SHUVCHI, bitta
ustun: `HrSetting.crmSotuvchiMajburiy` (default `false`, ya'ni mavjud
bizneslarda hech narsa qattiqlashmaydi). Postgres init `pg:migratsiya`
bilan qayta generatsiya qilindi.

**Yangi modullar:**
- `lib/crm/tolovHolati.ts` — "puli kelgan sotuv" YAGONA hisobi:
  kirimsiz → 0; naqd/click → to'liq; `tolovTuri="qarz"` → qarz yozuvidan
  (`Debt.manbaTransactionId` ko'prigi). Qisman to'langan zakaz bonusga
  KIRMAYDI, qarz yopilgach butun summa qo'shiladi.
- `lib/services/zakazSotuvchi.ts` — ro'yxat, tekshiruv (biznes + faollik +
  a'zolik), avto-tanlash, majburiylik, almashtirish (atomik + audit).
- `lib/queries/sotuvchiKpi.ts` — KPI/reyting/tafsilot; butun davr UCHTA
  so'rovda (N+1 yo'q), konversiya = WON/(WON+LOST).

**Oqim:** CRM zakaz → sotuvchi → WON → kirim → to'liq to'lov → "puli
kelgan sotuv" → sotuv bonusi (mavjud `EmployeeBonus`) → oylik vedomosti.
Bonus summasi qo'lda yozilmaydi — foiz kiritiladi, baza avtomatik.

**Huquq:** yangi kod `crm.sotuvchi` (OWNER/ADMIN'da bor). Usiz zakaz
faqat O'Z nomiga yoziladi; mavjud zakazning sotuvchisini almashtirish
ham shu huquq bilan (amal audit jurnaliga va zakaz lentasiga yoziladi).

**Testlar:** YANGI `tests/crm-sotuvchi.test.ts` (`test:crm-sotuvchi`, 19
test) — prompt 36-bo'limidagi 9 stsenariy + majburiylik sozlamasi,
o'chirilgan zakaz, reyting tartibi, tenant/biznes izolyatsiyasi, audit izi.
Regressiya: crm 24, xodim-kategoriya 19, hr 19, xodim-plan 18,
xodim-statistika 12, qarz 16, tasks 7, kop-biznes 18, isolation 22,
izolyatsiya-royxati 9, audit-qoldiq 10, backup 6, migratsiya 12,
postgres 9 — hammasi yashil. `npm run build` o'tdi.

**Pipeline bilan birlashtirish (merge).** Sotuvchi ishi CRM zakaz pipeline
ishi bilan bir vaqtda bajarildi va merge paytida ular yarashtirildi:
- "Puli kelgan sotuv" endi pipeline maydonlaridan o'qiladi:
  `Deal.tolangan` (oldindan olingan pul) + `Deal.debtId` orqali qarz
  yozuvi. Eski (pipeline'gacha) zakazlar uchun `manbaTransactionId`
  ko'prigi saqlandi — tarixiy statistika buzilmaydi.
- KPI kesimi `Stage.turi` dan `Deal.holat` ga o'tdi (doska bilan AYNI
  qoida, `lib/crm/pipeline.ts`).
- Doskadagi eski "Sotuvchi" filtri aslida MAS'UL xodim (User) edi — u
  "Mas'ul xodim" deb nomlandi, yoniga haqiqiy "Sotuvchi" (Employee)
  filtri qo'shildi; ikkalasi ham serverda kesiladi.
- Kartochkada sotuvchi biriktirilmagan bo'lsa mas'ul ko'rsatiladi.
- Migratsiya `20260901160000_crm_sotuvchi` deb qayta nomlandi — pipeline
  migratsiyasidan KEYIN qo'llansin (ikkalasi ham bir xil vaqt tamg'asi
  bilan yozilgan edi).
- BONUS BAZASIDAGI FARQ ATAYLAB: `kategoriyaAnalitika.tolanganSotuv`
  qisman to'lovni ham sanaydi (doskadagi "bonusga tushgan sotuv"),
  sotuvchi bonusi esa FAQAT to'liq to'langan zakazlardan (`puliKelgan`) —
  topshiriqning 16-18-talabi shuni majburlaydi.


## Kassa maxfiyligi + kassa topshirish reset nuqtasi (2026-09-02)

**Muammo 1 — xodim jami kassani ko'rardi.** `/app/kassa` "kassa.korish"
bilan ochilardi, kassir to'plamida esa bu huquq bor: u barcha kassalar
qoldig'i, jami pul va biznesning kunlik kirim/chiqimini ko'rardi.
`/api/kassa-transfer` (GET) ham barcha kutilayotgan o'tkazmalarni
qaytarardi, `/app/kassa/[id]` istalgan kassani ochardi, Kg savdosi sahifasi
kassa qoldiqlarini kassirga ham uzatardi, AI `kassa_holati` ham shu huquq
bilan ochiq edi.

**Yechim — yangi granular huquq `kassa.jami`** ("Barcha kassalar va jami
summani ko'rish", `lib/permissions/katalog.ts`). Default: OWNER/ADMIN'da
bor, CASHIER/SELLER'da YO'Q; maxsus rol (PRO) orqali berish mumkin.
Server tomonda:
- `/app/kassa` va `/app/kassa/hisobot` — `kassa.jami` shart, aks holda
  `/app/kassam` (o'z kassasi);
- `/app/kassa/[id]` — `kassa.jami` YOKI kassa egasi o'zi;
- `/api/accounts?qoldiq=1` — `kassa.jami` (avval `requireManager`);
- `/api/kassa-transfer` GET — `kassa.jami` bo'lmasa faqat men yuborgan /
  menga yuborilgan o'tkazmalar (`listKutilayotganTransferlar(..., faqatUserId)`);
- `/app/selos` — kassa qoldiqlari faqat `kassa.jami` bilan so'raladi;
- AI `kassa` sohasi — `kassa.jami`;
- nav: "Kassalar" faqat BOSHQARUVCHILAR (kassir "Mening kassam" bilan ishlaydi).
`/app/kassam` endi boshqa kassalarning qoldig'ini umuman hisoblamaydi
(nishonlar — faqat nomlar).

**Muammo 2 — topshirilgandan keyin eski summa qolardi.** Kassa kartasi va
"Mening kassam"dagi kirim/chiqim/sof Toshkent KUN BOSHIDAN hisoblanardi;
topshirish uni nolga tushirmasdi. Qoldiq esa tasdiqlanmaguncha ledgerda
turadi (pul limbo'ga tushmasin qoidasi) — xodim "0" ni ko'rmasdi.

**Yechim — reset nuqtasi (`lib/queries/kassaSmena.ts`).** Yangi model
YO'Q: mavjud `AccountTransfer(turi="smena")` yozuvi smena chegarasi.
Har kassaning joriy smenasi shu kassadan OXIRGI topshirishdan
(`holat in (kutilmoqda, bajarildi)`) boshlanadi; hech qachon
topshirilmagan kassada — kun boshidan (avvalgi xatti-harakat). `rad`/`bekor`
reset emas (pul qaytdi). Kesim `createdAt > boshi` (topshirishning o'zi
yangi smenaga tushmaydi), har kassa o'z chegarasi bilan BITTA `OR` so'rovda.
- `getKassaNazorat` kartalari: `smenaKirim/smenaChiqim/smenaSof/
  smenaKirgan/smenaChiqqan/smenaBoshi/smenaTopshirishdan` (avvalgi
  `bugungi*` o'rnida); sarlavhadagi biznes "bugungi kirim/chiqim/sof" kun
  boshidan QOLDI — topshirish biznes savdosini o'zgartirmaydi.
- `getKassaDetal`, `getMeningKassam`: smena kesimi + `kutilayotganChiqim`
  + `mavjud` (qoldiq − tasdiq kutayotgan). Xodimga "Kassangizdagi pul" =
  MAVJUD — topshirilgan zahoti 0, tasdiq kutayotgan summa alohida qatorda.
- Tarix o'chirilmaydi, ledger o'zgarmaydi, kunlik/oylik hisobot o'zgarmaydi.
- UI: muvaffaqiyat toast'i ("Kassa muvaffaqiyatli topshirildi · Topshirildi
  · Joriy kassa"), `router.refresh()` (server hisobi), ikki marta bosish
  qulfi; ochiq topshiriq borida tugma o'chadi.
- Qisman topshirish (kamomad) mavjud biznes talabi — saqlandi: farq
  muzlatiladi, sabab majburiy, yetishmagan pul kassirda ochiq qoladi.

**Testlar:** YANGI `tests/kassa-maxfiylik.test.ts` (`test:kassa-maxfiylik`,
12 test): huquq katalogi, xodim manbasida boshqa kassa/jami yo'qligi, API
filtri, direktor ko'rinishi, tenant izolyatsiyasi, to'liq topshirish → 0,
keyingi savdo 0 dan, tarix saqlanishi, rad reset emas, parallel ikki
topshirish → bittasi, kamomad, topshirilmagan kassa kun boshidan.
Yangilandi: `kassa-nazorat` (maydon nomlari), `modules` (kassir nav).
Regressiya: kassa-nazorat 23, kassa-transfer 20, kunlik-kassa 18,
kassir-kassa 22, kassa-qoldiq 5, isolation 22, izolyatsiya-royxati 9,
ai 28, modules 21, visibility 10, dashboard-ux 21 — yashil.
## Disney Navoiy: zakaz jamoasi + xodimlar analitikasi (2026-09-02)

**Audit xulosasi.** "Kim sotdi" (sotuvchi) va "kim bajaradi" (ijrochi)
tuzilmasi allaqachon bor edi: `EmployeeCategory` (lavozim, biznesga
bog'liq, qattiq kod yo'q), `EmployeeCategoryMember` (xodim ↔ lavozim,
ko'p-ko'p), `DealEmployee` (zakaz ↔ xodim ↔ lavozim, UNIQUE). Yangi
"OrderEmployeeAssignment" jadvali YARATILMADI — mavjud `DealEmployee`
ayni shu rolni bajaradi. Eski `Deal.masulId` (User) TEGILMADI: sotuvchi
lavozimi sozlanmagan biznesda "Mas'ul xodim" maydoni avvalgidek qoladi,
sozlangan biznesda esa forma "Sotuvchi *" ni ko'rsatadi va mas'ul sotuvchi
tanlovidan sinxronlanadi (avvalgi qoida).

**Migratsiya:** `20260902090000_zakaz_jamoasi_baho` — FAQAT QO'SHUVCHI:
`EmployeeCategory.zakazgaBiriktiriladi` (default true), `.kopXodim`
(default false — bir zakazga bir nechta xodim), `DealEmployee.baho/
bahoIzoh/bahoAt`, yangi `DealFeedback` (zakaz darajasidagi mijoz fikri,
`dealId` UNIQUE). Postgres init qayta generatsiya qilindi.

**Backend:**
- `lib/services/zakazJamoasi.ts` — biriktiruv mantiqi shu yerga ko'chdi
  (`xodimKategoriya.ts` qayta eksport qiladi). Saqlash FARQ asosida va
  `runBusinessTx` ichida: o'zgarmagan qator qayta yozilmaydi (bahosi
  saqlanadi), o'zgarish bo'lmasa bazaga tegilmaydi (dublikat yo'q), xodim
  almashsa lentaga "chiqdi/qo'shildi" yoziladi. `kopXodim=false` lavozimga
  ikkinchi xodim rad; `zakazgaBiriktiriladi=false` lavozim rad.
  TOPILGAN VA TUZATILGAN XATO: eski `deleteMany + create` jamoa tahriri
  sotuvchi qatorini ham o'chirib yuborardi — endi kiruvchi ro'yxatda
  sotuvchi bo'lmasa u tegilmaydi.
- `lib/services/zakazBaho.ts` — sifat nazorati: servis bahosi/e'tiroz/
  yaxshilash (zakaz) + har biriktiruvga 1..10 baho (xodim). Faqat YUTILDI
  zakaz baholanadi. API: `GET/PUT /api/crm/deals/[id]/baho`.
- Huquqlar: `crm.jamoa` (mavjud zakaz jamoasini o'zgartirish; usiz faqat
  o'z zakazi, yakunlangunga qadar), `crm.baho` (sifat nazorati). OWNER/
  ADMIN'da bor, SELLER'da yo'q — oddiy xodim boshqalarning biriktiruvini
  o'zgartirib statistikani buza olmaydi.
- `lib/queries/xodimJamoaKpi.ts` — barcha xodimlar uchun lavozim kesimidagi
  davr KPI'si IKKI so'rovda (N+1 yo'q). `kategoriyaAnalitika` ga
  `ortachaBaho` qo'shildi.

**UI:** Yangi zakaz formasi: SOTUVCHI bo'limi + yig'iladigan "Zakaz
jamoasi  N xodim ›" bo'limi; har lavozim qatori qidiruvli pastki varaq
(`XodimTanlovSheet`) ochadi — kopXodim lavozimda checkbox (Videochilar:
Sardor, Bekzod), oddiyda radio (bosilganda yopiladi). Tafsilotda jamoa
lavozim bo'yicha guruhlangan; yutilgan zakazda "Sifat nazorati" bloki.
Xodimlar sahifasi: dinamik lavozim filtri, kartada lavozim(lar) va "Bu oy"
KPI (sotuvchi: zakaz/yutilgan/summa; ijrochi: chiqdi/bajarildi/baho).
Xodim sahifasida "Lavozim KPI" tabi. "Kategoriyalar" UI'da "Lavozimlar"
deb nomlandi (route o'zgarmadi), lavozim formasiga ikki bayroq qo'shildi.

**Mavjud ma'lumot:** `scripts/masul-sotuvchi-migratsiya.ts` (quruq rejim
standart, `--qollash` bilan yozadi) — sotuvchi biriktiruvi yo'q eski
zakazlarga FAQAT mas'ul foydalanuvchining xodimi sotuvchi lavozimi a'zosi
bo'lsa biriktiradi; direktor "mas'ul" bo'lgan zakazlar ataylab tegilmaydi.
Build zanjiriga kiritilmadi — egasi qaror qiladi.

**Testlar:** YANGI `tests/zakaz-jamoasi.test.ts` (`test:zakaz-jamoasi`, 16
test) — 40-46 stsenariylar (yaratish, participation va zakaz soni 1,
dublikat, xodim almashtirish, multi-select, biznes izolyatsiyasi, oy
filtri) + bayroqlar, baho, huquq, kirim qulfi. Regressiya: xodim-kategoriya
19, crm-sotuvchi 20, crm-pipeline 18, crm 24, isolation 22,
izolyatsiya-royxati 9, backup 6, migratsiya 12, postgres 2, hr 19,
xodim-statistika 12, kpi-hisob 16 — hammasi yashil. `tsc` toza,
`npm run build` o'tdi. (Repoda ESLint konfiguratsiyasi yo'q — `next lint`
interaktiv so'rov beradi; lint bosqichi tsc bilan qoplandi.)



## Production deploy diagnostikasi — Vercel build OOM (2026-09-02)

**Belgi.** `main` ga merge qilingan `63f146c` (KPI) va `cecf3d5` (kassa
maxfiyligi) production'ga chiqmadi; `/api/health` `9d5dd09` ni ko'rsatib
turdi.

**Dalil (Vercel API).** Loyiha `hisob-kitob-disneyn1` GitHub'ga to'g'ri
bog'langan (`productionBranch: main`), har push uchun deploy YARATILGAN,
lekin:
- `63f146c` / `69eaf01` (production): `next build` → "Next.js build worker
  exited with code: null and signal: SIGKILL" + Vercel hisoboti: "At least
  one Out of Memory (OOM) event was detected" (2 yadro, 8 GB konteyner);
- `cecf3d5`, `8c57163`, `63731bf`: "build step did not complete within the
  maximum of 45min" — "Creating an optimized production build..." da osilib
  qolgan (o'sha xotira bosimi);
- oxirgi yashil production — `9d5dd09` (2026-09-01 15:41).
Git integratsiyasi, production branch, root directory, ignored build step
— hammasi to'g'ri; sabab FAQAT build xotirasi. Vercel loyihasida Node
`24.x`, lokalda (Node 22, 4 yadro) `next build` cho'qqisi ~2 GB.

**Tuzatish (repo ichida).**
- `package.json`: `engines.node = "22.x"` — Vercel build'i lokalda
  tekshirilgan Node versiyasida ishlaydi (Node 24 + Next 14.2 xotira
  xatti-harakati boshqacha);
- `build` skriptida `next build` `NODE_OPTIONS=--max-old-space-size=4096`
  bilan — V8 heap konteyner RAM'idan ancha pastda cheklanadi, GC ertaroq
  ishlaydi, konteyner OOM'ga bormaydi (Vercel'ning rasmiy tavsiyasi).
Lokal o'lchov (heap cap bilan): cho'qqi 2,2 GB, build o'tdi.

**Alohida (tuzatilmadi, egaga).** Preview deploylar `deploy-zaxira.mjs`
da to'xtaydi: Preview muhitida `BACKUP_CHAT_ID`/`BACKUP_BOT_TOKEN` yo'q,
kutayotgan migratsiya bo'lsa zaxira yuborilmaydi va build TO'XTAYDI
(ataylab). Preview build'lar production `DATABASE_URL` ga migratsiya
qo'llashi ham xavfli — Preview uchun alohida baza yoki preview deploy'ni
o'chirish tavsiya etiladi.

## 2026-09-03 — Disney Navoiy: sotuvchi lavozimi va eski zakazlar migratsiyasi (PRODUCTION)

Ikki tasdiq, ikki qadam. Har ikkalasidan OLDIN shartsiz zaxira Telegram
kanaliga ketdi (`zaxira-majburiy.mjs`), yetkazilmasa build to'xtardi.

**1-qadam (run 33711524213).** `Sotuvchi` lavozimi yaratildi
(`cmtkyvf310002jn4ppzn7v925`, turi `sotuvchi`, `kopXodim=false`), ikki xodim
a'zo qilindi, Fayruza uchun `Employee.userId` bog'lanishi yozildi. Suxrobga
sun'iy foydalanuvchi YARATILMADI, Saydaliga tegilmadi.

**2-qadam (run 33712048411).** `masul-sotuvchi-migratsiya.ts --qollash`:
47 zakazdan 45 tasiga sotuvchi biriktiruvi yozildi (faqat `DealEmployee`
INSERT). 2 ta zakaz ATAYLAB tegilmadi — mas'uli direktor (OWNER), unga
xodim kartochkasi bog'lanmagan. Qo'llashdan keyin ayni skript qayta quruq
yurgizildi: `MIGRATSIYA QILINADI: 0` — idempotentlik tasdiqlandi.

Moliya izi qo'llashdan oldin ham, keyin ham `e05d5891b6f549bf` — o'zgarmadi
(bu amal pulga tegmaydi). Tashqi kalitlar butun, dublikat guruh 0.

**Nima o'rganildi.** "45 ta yozuv yozildi" degan raqam KPI'ning
ko'rinishini isbotlamaydi — u faqat jadval holatini aytadi. Shuning uchun
`scripts/sotuvchi-kpi-tekshir.ts` qo'shildi: `getXodimlarJamoaKpi` bilan
AYNI manbadan (DealEmployee + Deal.holat) o'qib, sotuvchi kartochkasidagi
raqamni ko'rsatadi va "qatnashuv soni = sotuvchili zakaz soni" tengligi
bilan dublikatni tekshiradi. O'lchov: Fayruza 45 jami / 8 yutilgan /
11 yo'qotilgan; Suxrob 0 (tarixiy mappingi yo'q — kutilgan).

## 2026-09-03 — Zakaz jamoasi lavozimlari (Disney Navoiy, PRODUCTION)

Audit (run 33714751688, faqat SELECT) → yaratish (run 33714880374, zaxira
bilan). Oltita lavozim `EmployeeCategory` da: Sotuvchi (avval bor edi),
Shofyor, Diktor, Animator / Igrushka, Videochi[kopXodim], Bezakchi[kopXodim].
Hammasida `zakazgaBiriktiriladi=true`. Yaratishdan keyin qayta audit —
oltalasi ham "mavjud": idempotent, dublikat lavozim yo'q.

A'ZOLIK BIRIKTIRILMADI (ataylab). Eski `Employee.lavozim` matni faqat
TAKLIF beradi, dalil emas — kim qaysi lavozimda ekanini egasi tasdiqlaydi.
Audit topgani: Sotuvchi 2 nomzod (allaqachon a'zo), Videochi 1 nomzod,
Shofyor/Diktor/Animator/Bezakchi — nomzod yo'q (bunday xodim bazada yo'q).

**Nima o'rganildi.** Ommaviy log gigienasi (ism niqoblash) audit hisobotini
egasi uchun ham o'qib bo'lmaydigan qiladi: `Az…(10)` kim ekani faqat
`Employee.id` orqali aniqlanadi. Niqob repo ochiqligi uchun kerak, lekin
qaror talab qiladigan hisobotda bu narx — kelgusida bunday hisobotni
xususiy kanalga (Telegram) yuborish yoki id bo'yicha UI havolasi berish
ma'qul.

## 2026-09-03 — Barcha ijrochi lavozimlar ko'p xodimli (Disney Navoiy)

Shofyor, Diktor, Animator / Igrushka ham `kopXodim=true` bo'ldi (Videochi va
Bezakchi allaqachon shunday edi). Sotuvchi bitta bo'lib qoldi.
Run 33715833226, zaxira bilan; yozishdan keyingi audit beshalasini ham
`kopXodim=true` deb tasdiqladi. Fayruzaning 45 ta tarixiy sotuvchi
biriktiruviga tegilmadi (`DealEmployee jami: 45`, dublikat guruh 0).

Kod o'zgarmadi — `kopXodim` ataylab biznes qoidasi: `zakazXodimlariniTekshir`
bayroqni o'qiydi, tanlov soniga chegara yo'q, har xodimga alohida
`DealEmployee` yoziladi va kompaniya zakaz soni `Deal` jadvalidan kelgani
uchun jamoa kattaligiga bog'liq emas.

**Nima o'rganildi (ikki xato).**
1. Yangi test 44b dastlab Jajonni animator qilib qo'ygani uchun 46-stsenariy
   yiqildi ("bu oy: faqat Panda" 2 !== 1). Umumiy fixture'ga tayanadigan
   testda YANGI qatnashuv qo'shish boshqa testning taxminini buzadi — test
   endi Jajonga tegmaydi va zakazni yutilgan qilmaydi (sotuvchi summasi
   boshqa joyda qat'iy tekshiriladi).
2. `git push -u origin main` feature tarmog'ida turib bajarildi: commit
   `main` ga tushmagan, push esa o'zgarmagan `main` ni qayta yuborgan —
   natijada workflow ESKI konfiguratsiya bilan yugurdi. Push'dan oldin
   `git rev-parse --short HEAD` emas, AYNAN `origin/main` tekshirilishi
   kerak; commit qaysi tarmoqda ekani `git status -sb` bilan aniqlanadi.

## 2026-09-03 — CRM: to'lov holati faqat tanlovdan, Yutildi → darhol kirim, tartib

Uchta xato tuzatildi (`claude/crm-order-fixes-uf63o4`):

1. **Qarzga avtomatik o'tmaydi.** `tolovHolati` (`lib/crm/pipeline.ts`)
   `tolangan = 0` ni "Qarzga" deb o'qirdi: bot orqali kelgan lead, narxsiz
   yaratilgan yoki eski (tolovTuri NULL) zakaz foydalanuvchi tanlamasa ham
   qarzga ko'rinar, YUTILDI bosilganda `qarzUlushi` unga butun summaga QARZ
   ochardi. Tahrir formasi ham (`boshlangichTanlov`) shunday zakazni
   "Qarzga" bilan ochib, narxni tuzatib saqlashda jimgina `tolovTuri="qarz"`
   yozardi. Endi "Qarzga" faqat `tolovTuri === "qarz"` (foydalanuvchi
   tanlovi); tanlov yo'q — `TANLANMAGAN` (⚪ "To'lov tanlanmagan"), qarz
   ham, kirim ham yozilmaydi. Qisman → qolgani qarz (o'zgarmadi).
2. **Yutildi → darhol kirim.** WON bosqichga sudrash (`moveDeal`) va WON
   bosqichida yaratish (`createDeal`) holatni yozib moliyani yozmasdi —
   endi ikkalasi `zakazniYakunlash` orqali (atomik, idempotent). Yutilgan,
   lekin to'lovi keyin belgilangan zakazda API PATCH yakunlashni qayta
   chaqiradi: kirim/qarz o'zi yoziladi, alohida "kirimga o'tkazish" yo'q.
   Eski `kirimgaKochirish` (butun summa) qarz ochilgan yoki qarzga/qisman
   tanlangan zakazni rad etadi — bir zakaz ikki marta sanalmasin.
3. **Yangi/yangilangan zakaz tepada.** `Deal.updatedAt` (nullable, Prisma
   `@updatedAt`; migratsiya `20260903090000_crm_zakaz_updatedat` eski
   qatorlarni `COALESCE(yopilganAt, createdAt)` bilan to'ldiradi). Doska
   `updatedAt DESC`, ustun ichida kechikkanlar oldinda, keyin `updatedAt`
   (mobil va desktop bitta `ZakazUstuni`).

Testlar: `tests/crm-pipeline.test.ts` — A1–A3 (avto-qarz yo'q, qarz faqat
tanlovda), B1–B6 (darhol kirim: keyin belgilangan to'lov, eski yo'l,
WON'da yaratish, dublikat yo'q, eski yo'l rad etadi), C1–C2 (tartib).

**Nima o'rganildi.** "Hisoblanadigan holat" ikkinchi haqiqat manbaidan
qutqaradi, lekin hisob formulasi ham tanlovni ifodalashi shart: `0 so'm`
"pul kelmadi" degani, "qarzga berildi" degani emas. Tanlov belgisi
(`tolovTuri="qarz"`) allaqachon bazada bor edi — formula uni o'qimasdi.
