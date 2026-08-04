BALANSA — 5.05 dan 9.5+ ga: CLAUDE CODE PROMPTLAR TO'PLAMI

Qanday ishlatish kerak (MUHIM — avval o'qing)

1.

Har fazani ALOHIDA sessiyada bering.

 Bitta gigant prompt emas. Claude Code uzun sessiyada kontekst yo'qotadi.

2.

Har fazadan oldin git branch oching:

git checkout -b faza-1-kritik

3.

Har fazadan keyin:

npm run build

 o'tishi shart + tekshiruv ro'yxatini o'zingiz sinang + real ma'lumot bilan test qiling. Keyin merge.

4.

Fazani o'tkazib yubormang.

 Faza 4 faza 1 siz ishlamaydi (tranzaksiyalar kerak).

5.

Loyiha ildizida

CLAUDE.md

 fayl yarating (quyida 0-faza) — Claude Code har sessiyada uni o'qiydi va loyiha qoidalarini eslab qoladi.

FAZA 0 — CLAUDE.md yaratish (birinchi sessiya, 10 daqiqa)

Claude Code'ga bering:

Loyiha ildizida CLAUDE.md fayl yarat. Ichiga quyidagi qoidalarni yoz:

# Balansa loyiha qoidalari

## Arxitektura invariantlari (BUZILMAYDI)

- Tenant izolyatsiyasi: oddiy route/sahifa kodida FAQAT `@/lib/prisma` (tenant-scoped).

  `rawPrisma` faqat: auth, bot foydalanuvchi aniqlash, cron, superadmin, billing webhook.

- Har API route `withTenant()` yoki `withSuperadmin()` bilan o'raladi.

- Yozish amallari zod bilan validatsiya qilinadi (`lib/validation/`).

- Pul har doim Int (so'm), hech qachon float.

- Sana: "YYYY-MM-DD" string ↔ UTC-midnight Date (`lib/date.ts` funksiyalari).

## Kod qoidalari

- Komponent maksimal 250 satr; oshsa fayllarga bo'linadi.

- `any` taqiqlangan (faqat lib/db/ dagi mavjud 7 joydan tashqari).

- Barcha izohlar va UI matnlari o'zbek tilida (lotin). Kirill harflari kodda taqiqlangan.

- Har moliyaviy ko'p qadamli amal `prisma.$transaction` ichida.

- Har tranzaksiya so'rovida `deletedAt: null` (soft-delete filtri).

- Yangi model qo'shilsa: `lib/db/tenantDb.ts` dagi BUSINESS_SCOPED yoki TENANT_DIRECT

  to'plamiga VA `lib/backup/dump.ts` dagi ZAXIRA_JADVALLARI ro'yxatiga qo'shiladi.

## Tekshirish

- Har o'zgarishdan keyin: `npm run build` o'tishi shart.

- Migratsiya: `prisma migrate dev --create-only` bilan, qo'lda ko'rib chiqiladi.

- Test: `npm run test:isolation` va tegishli test fayli ishga tushiriladi.

FAZA 1 — KRITIK TUZATISHLAR (maqsad: ma'lumot to'g'riligi)

Branch:

faza-1-kritik

 ·

Kutilgan vaqt:

 2-3 sessiya

Prompt 1.1 — deletedAt + tranzaksiyalar

Bu loyiha — Balansa, ko'p-tenantli moliya SaaS. CLAUDE.md ni o'qi.

VAZIFA 1: soft-delete filtri xatosini tuzat.

`src/lib/queries/dashboard.ts` da uchta joyda (sumByType ~23-qator,

getCategoryBreakdown ~79, getDailyDynamics ~143) transaction so'rovlarida

`deletedAt: null` filtri YO'Q — o'chirilgan yozuvlar dashboard, oylik hisobot,

PDF, Excel va AI xulosalariga kirib ketmoqda.

- Uchala joyga `deletedAt: null` qo'sh.

- Keyin butun src/ bo'ylab grep qilib, transaction jadvaliga

  aggregate/groupBy/findMany/count qiladigan BARCHA joylarni top va

  deletedAt: null yo'q joylarni tuzat (listDeletedTransactions kabi ataylab

  o'chirilganlarni ko'rsatadigan joylardan tashqari).

- `tests/` uslubida yangi test yoz: o'chirilgan tranzaksiya dashboard

  summasiga kirmasligini tekshirsin.

VAZIFA 2: moliyaviy amallarni atomik qil.

`src/lib/services/inventory.ts` dagi quyidagi funksiyalar ko'p qadamli, lekin

`$transaction`siz — o'rtada uzilsa ma'lumot buziladi:

- createSale (qoldiq kamaytirish → Sale → Transaction → Sale.transactionId → Debt)

- recordDebtPayment (Transaction → DebtPayment → Debt yangilash)

- createAvtoMashina (Product → StockEntry → Transaction/Debt)

- addProductExpense (Transaction/Debt → ProductExpense)

- deleteProductExpense (Debt o'chirish → Transaction soft-delete → Expense o'chirish)

Hammasini `prisma.$transaction(async (tx) => ...)` ichiga o'ra. MUHIM:

- Tenant-scoped extension bilan $transaction qanday ishlashini tekshir —

  tx delegatlari ham tenant filtridan o'tishi kerak. Agar extension

  interaktiv tranzaksiya bilan mos kelmasa, tranzaksiya boshida businessId

  egaligini bir marta tekshirib, ichkarida tx (raw) delegatlarini ishlatishga

  ruxsat beriladi — lekin har so'rovda businessId sharti qo'lda yozilsin.

- Atomik qoldiq kamaytirish (updateMany + miqdor gte) mantig'i saqlansin.

- ensureCategory dagi findFirst→create race'ni upsert bilan almashtir

  (@@unique([nomi, turi, businessId]) bor).

Yakunda: npm run build o'tsin, tests/avto.test.ts va tests/tolov.test.ts ishlasin.

Prompt 1.2 — bot holati + secretlar

CLAUDE.md ni o'qi.

VAZIFA 1: Telegram bot holatini bazaga ko'chir.

`src/bot/state.ts`, `src/bot/leadFlow.ts`, `src/bot/avtoFlow.ts` da suhbat

holati xotiradagi Map'da — production webhook serverless'da ishlaydi,

har so'rov boshqa instansiyaga tushishi mumkin, oqim uziladi.

- Yangi Prisma model: BotConversation { chatId String @id, flow String,

  state String (JSON), updatedAt DateTime @updatedAt }.

- Uchala flow'ning get/set/clear funksiyalarini shu jadvalga o'tkaz

  (rawPrisma bilan — bot tizim darajasida ishlaydi).

- 24 soatdan eski holatlarni cron'da tozalash qo'sh.

- Migratsiya yarat (--create-only, ko'rib chiqaman).

- Yangi modelni lib/backup/dump.ts ro'yxatiga QO'SHMA (vaqtinchalik holat).

VAZIFA 2: fail-open secretlarni yop.

- `src/app/api/cron/monthly-report/route.ts`: CRON_SECRET env yo'q yoki bo'sh

  bo'lsa route 503 qaytarsin ("Cron sozlanmagan"), taqqoslash o'tmasin.

- `src/app/api/telegram/webhook/route.ts`: TELEGRAM_WEBHOOK_SECRET yo'q bo'lsa

  503; grammy'ga undefined uzatilmasin.

- Payme paymeAuthOk va Click clickSign taqqoslashlarini

  crypto.timingSafeEqual bilan timing-safe qil (uzunlik farqini oldin tekshir).

VAZIFA 3: onDelete siyosati.

prisma/schema.prisma da birorta onDelete yo'q. Har relatsiyaga aniq siyosat yoz:

- Moliyaviy yozuvlar (Transaction→Category/User, Sale, Debt, DebtPayment,

  StockEntry, ProductExpense, Payment, Subscription): onDelete: Restrict.

- Ixtiyoriy bog'lanishlar (Deal.contactId, Task.dealId, Debt.productId,

  Debt.saleId, Activity.contactId/dealId): onDelete: SetNull.

- Tenant→Business/User/TenantModule: Restrict (tenant o'chirish alohida oqim).

Migratsiya yarat (--create-only). SQLite'da bu jadval qayta qurishni talab

qiladi — migratsiya SQL'ini diqqat bilan yoz, ma'lumot yo'qolmasin.

Yakunda npm run build + barcha testlar.

Faza 1 tekshiruv (o'zingiz sinang)

[ ] Yozuv o'chir → dashboard va ro'yxat BIR XIL summa ko'rsatadi

[ ] Oylik hisobot/PDF/Excel o'chirilgan yozuvni hisoblamaydi

[ ] Botda /kirim oqimi boshidan oxirigacha ishlaydi (production'da ham)

[ ] CRON_SECRET'siz muhitda cron 503 qaytaradi

[ ] Sotuv paytida serverni to'xtatib (dev'da throw qo'shib) tekshir: qoldiq qaytadi

FAZA 2 — UNUMDORLIK + UX (maqsad: 4 soniya → 400 ms)

Branch:

faza-2-perf

Prompt 2.1 — indekslar + so'rovlar

CLAUDE.md ni o'qi.

VAZIFA 1: kompozit indekslar.

prisma/schema.prisma, Transaction modelida 6 ta bitta-ustunli indeks bor —

SQLite bitta so'rovda bittasini ishlatadi. Almashtir:

  @@index([businessId, deletedAt, sana])

  @@index([businessId, turi, deletedAt, sana])

  @@index([businessId, categoryId, sana])

  @@index([businessId, userId, sana])

Qo'shimcha: Sale @@index([businessId, createdAt]),

Debt @@index([businessId, isYopilgan, turi]),

AuditLog @@index([businessId, createdAt]),

Payment.externalId ni @unique qil (provider bo'yicha takror bo'lmasin —

avval mavjud ma'lumotda dublikat yo'qligini migratsiyada tekshir).

Migratsiya --create-only.

VAZIFA 2: dashboard so'rovlarini yig'ish.

src/lib/queries/dashboard.ts:

- getTrend hozir N oy × 2 tur = 12+ aggregate. Bitta $queryRaw bilan almashtir:

  SELECT strftime('%Y-%m', datetime(sana/1000,'unixepoch')) oy, turi, SUM(summa)

  ... GROUP BY oy, turi. (Prisma SQLite sana saqlash formatini tekshirib,

  to'g'ri konversiya yoz. deletedAt IS NULL sharti bilan.)

- getMonthSummary: 4 aggregate → 1 groupBy(['turi']) joriy oy + 1 oldingi oy.

- getDailyDynamics: findMany + JS guruhlash → SQL GROUP BY date.

- getProductProfitability (lib/queries/inventory.ts): barcha sotuvlarni RAM'ga

  yuklaydi — SQL GROUP BY productId bilan almashtir.

Natijalar avvalgi interfeys (tiplar) bilan bir xil qolsin — chaqiruvchilar buzilmasin.

VAZIFA 3: N+1 tuzatish.

- src/app/api/transactions/bulk-move/route.ts: har yozuvga alohida update —

  kategoriya bo'yicha guruhlab updateMany qil. Fayldagi NUL baytni ham

  ("nomi\u0000turi" o'rniga "nomi::turi") almashtir.

- lib/services/recurring.ts: audit va update'larni tranzaksiya ichida guruhlashtir;

  admin tanlashda r.businessId ga tegishli user birinchi qidirilsin

  (business.users orqali), topilmasa tenant boshqaruvchisi.

npm run build + testlar.

Prompt 2.2 — loading, kesh, refresh

CLAUDE.md ni o'qi.

VAZIFA 1: loading.tsx hamma joyda.

src/components/ui/Skeleton.tsx mavjud. Har asosiy route uchun loading.tsx yarat:

/app, /app/tranzaksiyalar, /app/hisobot, /app/ombor, /app/sotuv, /app/qarzlar,

/app/crm, /app/vazifalar, /app/byudjet, /app/ai, /app/admin/* (bitta umumiy),

/billing, /superadmin. Har biri sahifa strukturasiga mos skeleton

(stat kartalar, jadval qatorlari) ko'rsatsin — generik spinner emas.

VAZIFA 2: error.tsx modullar uchun.

/app/ombor, /app/crm, /app/hisobot, /app/qarzlar uchun error.tsx —

mavjud src/app/app/error.tsx uslubida, "Qayta urinish" tugmasi bilan.

VAZIFA 3: kesh.

Dashboard so'rovlarini (getMonthSummary, getTrend, getCategoryBreakdown,

getDailyDynamics) unstable_cache bilan o'ra: revalidate 60,

tags: ['dashboard:' + businessId]. MUHIM: unstable_cache tenant kontekstidan

TASHQARIDA ishlaydi — kesh kaliti ichiga businessId + tenantId kirsin va

funksiya ichida runWithTenant qayta chaqirilsin (izolyatsiya buzilmasin).

Tranzaksiya yaratish/tahrirlash/o'chirish route'larida revalidateTag chaqir.

VAZIFA 4: Button type.

src/components/ui/Button.tsx ga type="button" default qo'sh (submit forma

tugmalarida aniq type="submit" yozilishini tekshirib chiq — grep bilan barcha

<Button ishlatilgan formalarni ko'r va kerakli joyga type="submit" qo'y).

npm run build. Har sahifani dev'da ochib skeleton ko'rinishini tekshir.

Faza 2 tekshiruv

[ ] Dashboard birinchi yuklanish < 1 s (Turso bilan), navigatsiyada darhol skeleton

[ ]

EXPLAIN QUERY PLAN

 bilan asosiy so'rovlar indeks ishlatayotganini ko'r

[ ] Yozuv qo'shgach dashboard 60 s ichida yangilanadi (revalidateTag ishlaydi)

FAZA 3 — XAVFSIZLIK + AUDIT (maqsad: audit 8/66 → 100%)

Branch:

faza-3-xavfsizlik

Prompt 3.1

CLAUDE.md ni o'qi.

VAZIFA 1: audit'ni avtomatlashtir.

Hozir logAudit 66 route'dan faqat 8 tasida. Route'larga qo'shib chiqish o'rniga

src/lib/db/tenantDb.ts extension'iga avtomatik audit qo'sh:

- create/update/delete/updateMany/deleteMany amallarida (BUSINESS_SCOPED

  modellarda) AuditLog yozuvi yaratilsin: model nomi, entityId, before

  (update/delete'da avvalgi yozuv — extension baribir findFirst qiladi,

  o'shani ishlat), after (data), userId — buni AsyncLocalStorage kontekstiga

  qo'sh (runWithTenant → runWithTenant(tenantId, userId, ism)).

- AuditLog'ning o'zi va o'qish amallari audit qilinmasin (cheksiz sikl bo'lmasin).

- Audit yozish xato bersa asosiy amal buzilmasin (try/catch, console.error).

- AuditLog modeliga tenantId ustuni qo'sh (migratsiya), superadmin yozuvlari

  uchun nullable qoldi.

- Route'lardagi mavjud qo'lda logAudit chaqiruvlarini olib tashla (takror bo'lmasin),

  faqat maxsus semantikali joylar (bulk-move, superadmin) qolsin.

- shift-close route'dagi entity: "sale" xatosini "shift" ga tuzat (AuditEntity

  tipiga "shift" qo'sh).

VAZIFA 2: rate limit'ni barqaror qil.

lib/rateLimit.ts xotirada — serverless'da samarasiz. AppSetting jadvalidan

foydalanib atomik variant yoz: kalit "rl:{key}:{window}", qiymat hisoblagich,

raw SQL UPDATE ... SET value = value+1 WHERE ... yoki upsert + tekshiruv.

Login, signup, telegram-link-code, search route'lariga ula.

Eski xotira varianti dev fallback sifatida qolsin (env DATABASE_URL file: bo'lsa).

VAZIFA 3: xavfsizlik header'lari.

next.config.mjs ga headers() qo'sh: HSTS (production), X-Frame-Options DENY,

X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin,

Permissions-Policy minimal. CSP hozircha report-only rejimda (recharts/inline

style buzilmasin).

VAZIFA 4: mayda xavfsizlik.

- telegram-link-code: Math.random → crypto.randomInt; kod tekshirishga

  rate limit (bot linkByCode — chatId bo'yicha 5 urinish/10 daqiqa,

  AppSetting bilan).

- /api/search ga rate limit (20 so'rov/daqiqa).

- api/ai/chat: tarixni mijozdan olishni to'xtat — AiConversation jadvali yarat

  (tenantId, businessId, userId, xabarlar JSON), suhbat serverda saqlansin,

  mijoz faqat savol yuborsin. aiLimitTekshir'ni atomik qil (raw UPDATE).

npm run build + testlar. tests/superadmin.test.ts ishlashini tekshir.

Faza 3 tekshiruv

[ ] Har qanday yozuv/tahrir/o'chirish audit jurnalida ko'rinadi (sotuv, qarz, user, kategoriya)

[ ] Login'ga 10 marta noto'g'ri parol → 429 (ikkita brauzer/qurilmadan ham)

[ ] securityheaders.com da A baho

FAZA 4 — KASSA TO'LIQLIGI (maqsad: haqiqiy kassa dasturi)

Branch:

faza-4-kassa

 · Bu eng katta faza — 4 ta promptga bo'lingan.

Prompt 4.1 — kassa/hisob-raqamlar

CLAUDE.md ni o'qi. Yangi funksiya: pul manbalari (kassa/hisob-raqam).

- Yangi model Account { id, businessId, nomi, turi: "naqd"|"plastik"|"bank",

  isActive, tartib, createdAt }. BUSINESS_SCOPED va zaxira ro'yxatiga qo'sh.

- Transaction'ga accountId (nullable — eski yozuvlar uchun) qo'sh.

- Yangi model AccountTransfer { fromAccountId, toAccountId, summa, sana, izoh,

  userId } — pul ko'chirish; ikkita Transaction yozmaydi, alohida hisoblanadi.

- Signup'da har yangi biznesga default "Naqd kassa" yaratilsin; mavjud

  bizneslar uchun migratsiya skripti (scripts/) — default account yaratib,

  accountId'siz tranzaksiyalar shunga bog'lansin.

- TransactionForm va bot oqimiga account tanlash qo'sh (bitta account bo'lsa

  qadam yashirin).

- Yangi sahifa /app/kassa: har account qoldig'i (kirim−chiqim±transferlar),

  ko'chirish modali. lib/modules/registry.ts MOLIYA nav'iga qo'sh.

- Dashboard'ga "Kassa qoldig'i" kartasi.

- API: /api/accounts CRUD (manager), /api/accounts/transfer.

- Test: tests/accounts.test.ts — qoldiq hisobi va transfer to'g'riligi.

Prompt 4.2 — sotuvni bekor qilish + sana

CLAUDE.md ni o'qi.

VAZIFA 1: Sale'ga sana va soft-delete.

- Sale modeliga: sana DateTime (default createdAt'dan migratsiyada to'ldiriladi),

  deletedAt DateTime?, cancelledBy String?, cancelReason String?.

- Hisobotlar (getAvtoOylikYakun, listRecentSales, marja) createdAt emas,

  sana bo'yicha ishlasin va deletedAt: null filtrlasin.

- createSale'ga ixtiyoriy sana parametri (UI'da sana tanlash, default bugun).

VAZIFA 2: sotuvni bekor qilish oqimi.

Yangi endpoint DELETE /api/sales/[id] (faqat manager):

$transaction ichida: Sale soft-delete; bog'langan Transaction soft-delete;

bog'langan Debt bo'lsa — to'lovi bo'lmagan taqdirda o'chir, to'lovi bo'lsa

xato qaytar ("Avval to'lovlarni bekor qiling"); Product.miqdor increment

(qoldiq qaytadi). Audit avtomatik yoziladi (extension).

UI: SotuvClient sotuvlar ro'yxatiga "Bekor qilish" (sabab so'raladi, manager'gagina).

VAZIFA 3: narx buzilishini tuzat.

services/inventory.ts createSale'da kelishilgan narx product.sotuvNarx'ni

faqat avto rejimida (business.turi === "avto") yangilasin — oddiy omborda

katalog narxi o'zgarmasin.

Test: tests/sale-cancel.test.ts.

Prompt 4.3 — inventarizatsiya + hisobdan chiqarish + SKU

CLAUDE.md ni o'qi.

- Product'ga: sku String?, birlik String default "dona", minQoldiq Int default 0.

  @@index([businessId, sku]).

- Yangi model StockAdjustment { businessId, productId, turi:

  "inventarizatsiya"|"chiqarish", eskiMiqdor, yangiMiqdor, farq, sabab, userId,

  createdAt } — miqdorni to'g'rilaydi.

- API /api/stock/adjust: $transaction'da Product.miqdor yangilash + yozuv.

- OmborClient'ga: SKU/birlik maydonlari, "Inventarizatsiya" modali (joriy vs

  sanalgan, farq avtomatik), "Hisobdan chiqarish" modali (sabab majburiy).

- Bildirishnomalarda LOW_STOCK o'rniga har mahsulotning minQoldiq'i ishlatilsin.

- Zaxira ro'yxatiga StockAdjustment qo'sh. Test yoz.

Prompt 4.4 — chek + CSV import

CLAUDE.md ni o'qi.

VAZIFA 1: sotuv cheki (PDF).

lib/pdf/ ga ReceiptDocument qo'sh (@react-pdf, 80mm format): biznes nomi,

sana, mahsulot, miqdor, narx, jami, qarz bo'lsa qolgan summa.

GET /api/sales/[id]/receipt — PDF qaytaradi. SotuvClient'da "Chek" tugma.

VAZIFA 2: CSV import.

POST /api/transactions/import: CSV (sana,turi,kategoriya,summa,izoh) qabul

qiladi, zod bilan har qatorni tekshiradi, kategoriya nomi bo'yicha

topadi/yaratadi, $transaction'da 500 tagacha yozadi, xato qatorlar ro'yxati

bilan javob qaytaradi. UI: tranzaksiyalar sahifasida "Import" modali —

fayl tanlash, oldindan ko'rish (birinchi 10 qator), tasdiqlash.

Namuna CSV yuklab olish havolasi.

Faza 4 tekshiruv

[ ] Ikki kassali biznes: plastik sotuv plastik kassaga, qoldiqlar to'g'ri

[ ] Sotuvni bekor qil → ombor qoldig'i qaytdi, kirim yo'qoldi, hisobot to'g'ri

[ ] Kechagi sanada sotuv kirit → kechagi hisobotda ko'rinadi

[ ] 200 qatorli CSV import muvaffaqiyatli

FAZA 5 — POSTGRESQL + MASSHTAB (500+ mijoz uchun)

Branch:

faza-5-postgres

 · ⚠ Eng xatarli faza. Staging'da to'liq sinab keyin production.

Prompt 5.1

CLAUDE.md ni o'qi. Loyihani SQLite/Turso'dan PostgreSQL'ga (Neon yoki Supabase)

ko'chirish.

1. schema.prisma: provider "postgresql", driverAdapters saqlanadi

   (@prisma/adapter-neon yoki to'g'ridan-to'g'ri). String rol/turi/status

   maydonlarini haqiqiy Prisma enum'larga o'tkaz (Rol, TuriKirimChiqim,

   TenantStatus, PaymentStatus, ...) — zod sxemalar bilan moslashtir.

2. SQLite'ga xos joylarni top va tuzat:

   - login route'dagi COLLATE NOCASE $queryRaw → Postgres'da citext yoki

     LOWER() index bilan;

   - faza 2'da yozilgan strftime raw SQL'lar → to_char/date_trunc;

   - contains qidiruv → mode: "insensitive" (endi ishlaydi — search va

     listTransactions'ga qo'sh).

3. Migratsiya skripti scripts/migrate-to-postgres.ts: mavjud zaxira JSON'ini

   (lib/backup/dump.ts formati) Postgres'ga bog'liqlik tartibida yozadi,

   yakunda har jadval sonini solishtiradi.

4. .env.example, README deploy bo'limi, scripts/db-migrate.mjs yangilansin.

5. rate limit va AI limit endi Postgres atomik UPDATE bilan ishlashini tekshir.

6. Barcha testlar Postgres bilan o'tsin.

Prompt 5.2 — cron'ni bo'lish

CLAUDE.md ni o'qi. Cron 60 soniyada barcha ishlarni ketma-ket qiladi —

50+ tenantda timeout. Bo'l:

vercel.json'da 4 alohida cron: /api/cron/backup (03:00),

/api/cron/billing (04:00 — statuslar + eslatmalar),

/api/cron/reports (05:00 — oylik hisobot + kunlik digest),

/api/cron/tasks (06:00 — takroriy + vazifa eslatmalari).

Har biri CRON_SECRET bilan (faza 1 uslubida, fail-closed), maxDuration 60.

Har tenant ishini Promise.allSettled bilan 5 talik guruhlarda parallel qil.

Mavjud monthly-report route'i eski manzil sifatida yangilarga yo'naltirsin.

Faza 5 tekshiruv

[ ] Staging'da to'liq ma'lumot ko'chdi, sonlar mos

[ ] Barcha testlar Postgres'da yashil

[ ] Qidiruv endi registrga sezgirmas

[ ] 4 cron alohida ishlaydi

FAZA 6 — ERP MODULLARI (modul-modul, har biri alohida sessiya)

Har modul uchun shu shablondan foydalaning:

CLAUDE.md ni o'qi. Yangi modul: [NOMI].

Talablar:

- lib/modules/registry.ts ga yangi modul yozuvi (kod, nav, rollar) —

  PRO tarifga lib/billing/plans.ts da qo'shiladi.

- Prisma modellari: [ro'yxat]. BUSINESS_SCOPED + zaxira ro'yxatiga qo'shiladi.

- API route'lar withTenant + module: "[KOD]" bilan.

- Sahifalar /app/[yo'l] — mavjud sahifalar uslubida (server component +

  Client komponent, loading.tsx, EmptyState).

- Test fayli tests/[nomi].test.ts.

Modul tafsiloti: [pastdagi bo'limdan nusxa oling]

Tavsiya etilgan tartib (biznes qiymati bo'yicha):

1.

XARID

 — Supplier (ta'minotchi), PurchaseOrder (buyurtma: qoralama→tasdiqlangan→qabul qilingan), qabul qilishda StockEntry +

chiqim/qarz avtomatik. Ta'minotchi bilan hisob-kitob sahifasi.

2.

TASDIQLASH

 — ApprovalRule (kategoriya + limit + tasdiqlovchi rol), limitdan oshgan chiqim "kutilmoqda" holatida yaratiladi, direktor

Telegram'da inline tugma bilan tasdiqlaydi/rad etadi.

3.

HUJJATLAR

 — fayl ilova qilish (Vercel Blob yoki S3): Transaction, Debt, Deal, Task'ga attachments relatsiya. Shartnomalar reyestri

(kontragent, summa, muddat, eslatma).

4.

MIJOZLAR

 — Contact'ni kengaytirish: mijoz kartochkasi (barcha sotuvlar, qarzlar, CRM tarixi bitta sahifada), qarz limitlari.

5.

HR-LITE

 — Employee (User'dan ajratilgan xodim kartochkasi), oddiy oylik (stavka, avans, ushlab qolish → chiqim tranzaksiya), davomat.

6.

AI OCR

 — Telegram'ga chek rasmi → Claude vision → chiqim yozuv taklifi → tasdiqlash tugmasi. (ANTHROPIC_API_KEY allaqachon bor.)

MUHIM ESLATMALAR

1.

Har sessiya boshida:

 "CLAUDE.md ni o'qi" — bu invariantlarni saqlaydi.

2.

Migratsiyalarni har doim

--create-only

 bilan

 — SQL'ni o'zingiz ko'rib keyin apply qiling. Production bazada avval zaxira!

3.

Claude Code xato qilsa

 — "npm run build xatosini ko'r va tuzat" deb qaytaring; katta refaktorda "diff'ni ko'rsat, hali yozma" deng.

4.

Vaqt kutuvi:

 Faza 1-3 = 2-3 hafta (siz test qilishingiz bilan). Faza 4 = 3-4 hafta. Faza 5 = 2 hafta + staging. Faza 6 = har modul 1-2

hafta.

5.

10/10 haqida:

 Faza 1-5 dan keyin real baho ~8.5-9.0. Qolgan 1-1.5 ball — bu kod emas: mijozlar bilan ishlash, hujjatlar, qo'llab-

quvvatlash, uptime tarixi. Uni faqat vaqt beradi.
