# PostgreSQL'ga ko'chish yo'riqnomasi (Faza 5.1)

Bu hujjat **bajarilmagan ish uchun tayyorgarlik**. Ko'chishning o'zi baza
ulangan muhitda, staging'da bajariladi — bu yerda sinab bo'lmaydi, shuning
uchun kod o'zgartirilmadi, faqat **nima o'zgarishi kerakligi** aniq
sanab chiqildi.

> **Oldindan shart:** 13 ta kutilayotgan migratsiya (`PROGRESS-AGENT.md`)
> SQLite'da apply qilingan va ishlab turgan bo'lishi kerak. Ular apply
> qilinmagan holda provayderni almashtirish — o'sha migratsiyalarni
> PostgreSQL sintaksisida qayta yozishni ham talab qiladi, ya'ni ikki karra
> ish va ikki karra xavf.

---

## 1. Ma'lumotni ko'chirish — alohida skript YOZILMADI

Faza prompti `scripts/migrate-to-postgres.ts` so'ragan edi. **Ataylab
yozilmadi**, chunki `scripts/restore.ts` allaqachon aynan shu ishni qiladi:

1. zaxira JSON'ini o'qiydi (`lib/backup/dump.ts` formati);
2. `ZAXIRA_JADVALLARI` **bog'liqlik tartibida** yozadi;
3. oxirida har jadval sonini zaxiradagi son bilan solishtiradi va mos
   kelmasa `exit 1` qiladi.

Provayderga bog'liq hech narsasi yo'q — `DATABASE_URL` PostgreSQL'ni
ko'rsatsa, o'sha yerga yozadi. Ikkinchi, deyarli bir xil skript yozish
faqat ikkita saqlanadigan joy hosil qilardi va biri eskirib qolardi.

**Ko'chirish tartibi:**

```bash
# 1) Eski (SQLite/Turso) muhitda
npm run backup                    # zaxira JSON hosil bo'ladi

# 2) Yangi Postgres bazasida sxemani qurish
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# 3) Ma'lumotni ko'chirish
DATABASE_URL="postgresql://..." npm run restore -- <fayl.json> --confirm

# 4) Skript o'zi har jadval sonini solishtiradi.
#    "❌ Yozuvlar soni mos kelmadi" chiqsa — bazani ISHLATMANG.
```

**⚠️ Unumdorlik ogohlantirishi:** `restoreDump` yozuvlarni **bittalab**
yozadi (`createMany` SQLite'da cheklangan edi). Uzoqdagi Postgres bilan har
`INSERT` tarmoq safari — 200 000 yozuv soatlab ketishi mumkin. Ko'chishdan
oldin `restoreDump` ni `createMany` ga o'tkazish kerak bo'ladi (Postgres uni
to'liq qo'llab-quvvatlaydi). Bu bir necha satrlik o'zgarish, lekin uni
**Postgres ulangandan keyin**, o'lchov bilan qilish to'g'ri.

### Tiklash tartibi haqida (muhim)

`ZAXIRA_JADVALLARI` — shunchaki ro'yxat emas, **bog'liqlik tartibi**. Har
jadval o'zi murojaat qiladigan jadvallardan keyin turishi shart.

Bu qoida bir marta buzilgan edi: MIJOZLAR moduli `Sale.contactId` va
`Debt.contactId` qo'shgach, `contact` ro'yxatda `sale` dan **keyin** qolib
ketdi. FK majburlanadi (tekshirildi), demak mijozga bog'langan sotuvi bor
har qanday zaxira `Foreign key constraint violated` bilan tiklanmasdi.

Tuzatildi va endi ikkita test qo'riqlaydi (`tests/backup.test.ts`):
- sxemadan chiqariladigan tartib testi — har `@relation(fields: ...)` uchun
  ro'yxatdagi o'rinni tekshiradi, ya'ni **kelajakdagi modellarga ham
  avtomatik tarqaladi**;
- FK'ga boy fiksturali round-trip testi (mijozga bog'langan sotuv va qarz,
  shartnoma, ilova, oylik) — boshqa bazaga haqiqatan tiklanishini sinaydi.

---

## 1.5 ✅ KODDA BAJARILGAN QISM

Quyidagilar **allaqachon yozilgan va SQLite'da sinalgan**. Ko'chishda ularga
tegish shart emas:

| Nima | Qayerda |
|---|---|
| Dialekt qatlami (barcha farqlar bitta joyda) | `src/lib/db/dialect.ts` |
| Adapter `DATABASE_URL` sxemasiga qarab tanlanadi | `src/lib/db/rawPrisma.ts` |
| `@prisma/adapter-pg` va `pg` o'rnatilgan | `package.json` |
| Postgres boshlang'ich migratsiyasi (40 jadval, 104 indeks, 76 FK) | `prisma/migrations-postgres/` |
| Migratsiyani qayta generatsiya qilish | `npm run pg:migratsiya` |
| Dialekt testlari (ikkala yo'l ham) | `tests/dialect.test.ts` (11 ta) |

Dialekt qatlami provayderni `DATABASE_URL` sxemasidan aniqlaydi
(`postgresql://` yoki `postgres://`), chunki Prisma'ning o'z provayderi build
paytida qotib qoladi va runtime'da o'qib bo'lmaydi. Postgres adapteri KECH
yuklanadi — SQLite deploy'ida `pg` paketi bundle'ga umuman tushmaydi.

**Ya'ni ko'chishda qoladigan ish:** sxemada bitta satrni almashtirish,
migratsiya papkalarini almashtirish, ma'lumotni ko'chirish va staging'da
sinash. Kod tayyor.

---

## 2. SQLite'ga xos joylar — to'liq ro'yxat

Kod bo'ylab qidirildi (`$queryRaw`, `COLLATE`, `strftime`, `julianday`,
`datetime(`, `NOCASE`). Faqat **to'rt** joy provayderga bog'liq edi —
**to'rttasi ham `lib/db/dialect.ts` ga ko'chirildi va ikkala yo'l yozildi.**
Quyidagi tavsiflar endi tarixiy ma'lumot: nima uchun shunday qilinganini
tushuntiradi.

### 2.1 `src/app/api/auth/login/route.ts` — `COLLATE NOCASE`

```sql
SELECT "id" FROM "User" WHERE "login" = ${login} COLLATE NOCASE LIMIT 2
```

`COLLATE NOCASE` — SQLite'ga xos. PostgreSQL'da:

```sql
SELECT "id" FROM "User" WHERE LOWER("login") = LOWER(${login}) LIMIT 2
```

va migratsiyada funksional indeks:

```sql
CREATE INDEX "User_login_lower_idx" ON "User" (LOWER("login"));
```

(`citext` kengaytmasi ham variant, lekin `LOWER()` + indeks — bitta
kengaytmaga kam bog'liq.)

Mantiqqa tegilmaydi: registrsiz moslik faqat **bitta** foydalanuvchi
topilgandagina qabul qilinadi — "Admin"/"admin" ikkalasi bo'lsa hech biri
tanlanmaydi.

### 2.2 `src/lib/db/businessRaw.ts` — `sanaKalit()`

```sql
CASE WHEN typeof(col) = 'text' THEN substr(col, 1, 7)
     ELSE strftime('%Y-%m', col / 1000, 'unixepoch') END
```

`typeof()`, `strftime()`, `'unixepoch'` — SQLite'ga xos. Bu murakkablik
libsql adapteri DateTime'ni ISO **matn**, Prisma'ning o'z SQLite konnektori
esa millisekund **INTEGER** sifatida saqlagani uchun paydo bo'lgan edi.

PostgreSQL'da bunday ikkilanish **yo'q** — ustun haqiqiy `timestamp`:

```sql
to_char(col, 'YYYY-MM')      -- uzunlik 7
to_char(col, 'YYYY-MM-DD')   -- uzunlik 10
```

Ya'ni funksiya soddalashadi, `CASE` butunlay olib tashlanadi.
`tests/agregat.test.ts` bu funksiyaga tayanadi — o'zgartirishdan keyin
o'sha test yashil bo'lishi shart.

### 2.3 `src/lib/rateLimit.ts` va `src/lib/ai/limit.ts` — atomik hisoblagich

```sql
UPDATE "AppSetting" SET "value" = CAST(CAST("value" AS INTEGER) + 1 AS TEXT)
WHERE "key" = ${kalit}
RETURNING "value"
```

`CAST` va `RETURNING` — ikkalasi ham standart SQL, PostgreSQL to'liq
qo'llab-quvvatlaydi. **O'zgartirish kerak emas.**

Lekin sinash shart: `RETURNING` ning butun ma'nosi — parallel so'rovlarning
har biri **o'z** oshirilgan qiymatini olishi. Alohida `SELECT` bilan
hammasi bir xil (yig'ilgan) qiymatni o'qib, 10 tadan faqat 1 tasi
o'tardi — bu xato bir marta bo'lgan va tuzatilgan. Postgres'da parallel
test qayta o'tkazilsin.

### 2.4 `contains` qidiruvi — 3 fayl

`src/app/api/search/route.ts`, `src/lib/queries/transactions.ts`,
`src/app/api/crm/contacts/route.ts`.

SQLite'da Prisma `mode: "insensitive"` ni **qo'llab-quvvatlamaydi**,
shuning uchun hozir qidiruv registrga sezgir. PostgreSQL'da qo'shiladi:

```ts
{ nomi: { contains: q, mode: "insensitive" } }
```

Bu **funksional yaxshilanish** — "Akmal" va "akmal" bir xil topiladi.

---

## 3. Sxema o'zgarishlari

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

`driverAdapters` saqlanadi, lekin adapter almashadi:
`@prisma/adapter-libsql` → `@prisma/adapter-neon` (yoki to'g'ridan-to'g'ri
`pg`). Ta'sir qiladigan fayllar: `src/lib/db/rawPrisma.ts` va
`scripts/db-migrate.mjs` (u libsql klientiga qurilgan).

**String maydonlarni enum'ga o'tkazish** (prompt talabi): `rol`, `turi`,
`status`, `holat` va h.k. Bu **alohida qadam sifatida, ko'chishdan KEYIN**
qilinishi kerak — ikkalasini bir vaqtda qilish xatoni qidirishni
imkonsiz qiladi. Har enum uchun zod sxemasi allaqachon bor
(`lib/validation/`), ya'ni qiymatlar ro'yxati tayyor va ular manba
bo'lib xizmat qiladi.

**Migratsiyalar papkasi:** mavjud 13 migratsiya SQLite SQL'ida yozilgan va
PostgreSQL'da ishlamaydi. Postgres uchun boshlang'ich migratsiya
**allaqachon generatsiya qilingan**: `prisma/migrations-postgres/`.
Ko'chishda papkalar almashtiriladi:

```bash
mv prisma/migrations prisma/migrations-sqlite      # arxiv
mv prisma/migrations-postgres prisma/migrations
```

Ma'lumot baribir zaxira JSON orqali ko'chadi, migratsiya tarixi emas.

⚠️ Sxemaga yangi model qo'shilsa bu fayl avtomatik yangilanmaydi — shuning
uchun `tests/dialect.test.ts` uni sxemadagi model soni bilan solishtiradi va
eskirsa test yiqiladi. Yangilash: `npm run pg:migratsiya`.

---

## 4. Tekshiruv ro'yxati (staging)

- [ ] 13 ta SQLite migratsiyasi apply qilingan, ilova ishlayapti
- [ ] `npm run backup` — zaxira olindi, yozuvlar soni yozib olindi
- [ ] Postgres bazasi yaratildi, `prisma migrate deploy` o'tdi
- [ ] `restoreDump` `createMany` ga o'tkazildi (unumdorlik uchun)
- [ ] `npm run restore` — barcha jadval sonlari mos
- [x] ~~2.1 va 2.2 dagi raw SQL Postgres variantiga o'tkazildi~~ (bajarildi)
- [x] ~~`contains` qidiruvlariga `mode: "insensitive"` qo'shildi~~ (bajarildi)
- [ ] **Barcha 32 test to'plami Postgres'da yashil**
- [ ] Rate limit parallel testi Postgres'da qayta o'tkazildi
- [ ] Qidiruv registrga sezgirmasligi qo'lda tekshirildi
- [ ] 4 cron Postgres bilan ishlaydi (`Faza 5.2` da bo'lingan)
- [ ] Faqat shundan keyin: string maydonlarni enum'ga o'tkazish (alohida PR)
