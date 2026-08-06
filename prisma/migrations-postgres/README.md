# PostgreSQL migratsiyalari

Bu papka **ishlatilmaydi** — `prisma/migrations/` (SQLite) hozirgi manba.
U PostgreSQL'ga ko'chish uchun oldindan tayyorlangan.

## Nima uchun alohida papka

Mavjud 13 migratsiya SQLite SQL'ida yozilgan (`PRAGMA`, jadvalni qayta
qurish orqali FK o'zgartirish va h.k.) va PostgreSQL'da ishlamaydi. Ularni
qayta yozishning ma'nosi yo'q: ma'lumot migratsiya tarixi orqali emas,
**zaxira JSON** orqali ko'chadi (`docs/POSTGRES-KOCHISH.md`).

Shuning uchun Postgres uchun bitta **boshlang'ich** migratsiya yetarli —
u sxemaning hozirgi to'liq holatini quradi.

## Tarkibi

`00000000000000_init/migration.sql` — 40 jadval, 103 indeks, 76 tashqi kalit
+ qo'lda qo'shilgan `User_login_lower_idx` funksional indeksi.

Fayl `prisma migrate diff --from-empty` bilan generatsiya qilingan, ya'ni
sxemadan kelib chiqqan — qo'lda yozilmagan.

## Ko'chishda nima qilinadi

```bash
# 1) Sxemada provayder almashtiriladi
#    datasource db { provider = "postgresql" }

# 2) Bu papka asosiy papkaga aylanadi
mv prisma/migrations prisma/migrations-sqlite       # arxiv
mv prisma/migrations-postgres prisma/migrations

# 3) Bo'sh Postgres bazasida sxema quriladi
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# 4) Ma'lumot zaxiradan ko'chiriladi (sonlar solishtiriladi)
DATABASE_URL="postgresql://..." npm run restore -- <fayl.json> --confirm
```

Batafsil tartib va tekshiruv ro'yxati: `docs/POSTGRES-KOCHISH.md`.

## Muhim: bu fayl eskirishi mumkin

Sxemaga yangi model qo'shilsa, bu fayl **avtomatik yangilanmaydi**.
Ko'chishdan oldin uni qayta generatsiya qiling:

```bash
npm run pg:migratsiya
```
