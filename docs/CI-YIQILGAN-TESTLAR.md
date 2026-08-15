# CI'da yiqilgan tekshiruvlar

CI quvuri qurilgan sessiyada (2026-08-15) aniqlangan yiqilishlar ro'yxati.

**Bularning hech biri tuzatilmadi — ataylab.** Testni "yashil qilish" uchun
tuzatish eng xavfli naqsh: signal yo'qoladi, muammo qoladi. Har biri
`.github/workflows/ci.yml` da `continue-on-error: true` va TODO izohi bilan
belgilangan. Tuzatilgach — belgi olib tashlanadi.

Umumiy holat: `test:*` skriptlari **45 ta**. CI'da **43 tasi** ishga tushadi,
**42 tasi o'tadi**, **1 tasi yiqiladi**. 2 tasi CI'da bajarilmaydi (quyida).

---

## 1. `test:dialect` — Postgres migratsiyasi eskirgan

- **Fayl:** `tests/dialect.test.ts:152` (test: "Postgres boshlang'ich migratsiyasi mavjud va to'liq")
- **Xato matni:**
  ```
  Postgres migratsiyasi eskirgan: sxemada 45 model, migratsiyada 43 jadval.
  `npm run pg:migratsiya` ishga tushiring.
  43 !== 45
  ```
- **Sabab:** `prisma/migrations-postgres/00000000000000_init/migration.sql`
  sxemadan orqada qolgan. Yetishmayotgan ikki jadval — **`Role`** va **`Smena`**.
  Ular `20260814090000_pro_rollar_shaxsiy_kassa` va `20260815100000_smena_yakuni`
  migratsiyalarida qo'shilgan, lekin Postgres init migratsiyasi qayta
  generatsiya qilinmagan.
- **Oqibati:** SQLite'da hammasi ishlaydi. Postgres'ga ko'chirilsa esa `Role` va
  `Smena` jadvallari yaratilmaydi — ya'ni PRO rollari va smena yakuni ishlamaydi.
  Test aynan shu holatni ushlash uchun yozilgan va o'z ishini bajardi.
- **Yechim:** `npm run pg:migratsiya` — generatsiya qilingan SQL qo'lda ko'rib
  chiqiladi, keyin commit qilinadi. Bu sxemaga tegadi, shuning uchun bu
  sessiyada qilinmadi.

## 2. `npx tsc --noEmit` — test faylida bitta tur xatosi

- **Fayl:** `tests/toliq-ishga-tushirish.test.ts:158`
- **Xato matni:**
  ```
  error TS2322: Type 'unknown[]' is not assignable to type 'InArgs'.
    Type 'unknown' is not assignable to type 'InValue'.
  ```
- **Sabab:** `const q = (sql: string, args: unknown[] = []) => c.execute({ sql, args })`
  — libsql `execute` `InArgs` (`InValue[]`) kutadi, `unknown[]` esa unga
  tushmaydi. Ya'ni yordamchi funksiyaning tur imzosi torroq bo'lishi kerak.
- **Oqibati:** faqat tur tekshiruvi. Test o'zi o'tadi, chunki ts-node
  `transpileOnly: true` rejimida ishlaydi (`tsconfig.json` → `ts-node`).
  `src/` da tur xatosi YO'Q — butun repoda shu bitta xato bor.
- **Yechim:** `unknown[]` o'rniga `InValue[]` (yoki `(string | number | null)[]`).
  Test fayllariga tegish bu sessiyada taqiqlangan edi.

## 3. `npm run lint` — ESLint sozlanmagan

- **Xato matni:**
  ```
  ? How would you like to configure ESLint?
  ❯ Strict (recommended) / Base / Cancel
  ```
  (chiqish kodi 1)
- **Sabab:** repoda `.eslintrc*` yoki `eslint.config.*` fayli yo'q. `next lint`
  konfiguratsiyani topmasa interaktiv sozlash so'roviga tushadi. CI'da
  `< /dev/null` bilan ishga tushiriladi — shuning uchun osilib qolmaydi,
  darrov exit 1 qaytaradi.
- **Oqibati:** lint hech qachon ishlamagan. Ya'ni bu "yiqilgan test" emas,
  "hech qachon yoqilmagan tekshiruv".
- **Yechim:** `.eslintrc.json` qo'shish (`{ "extends": "next/core-web-vitals" }`)
  va chiqqan ogohlantirishlarni bosqichma-bosqich tozalash. Bu alohida ish:
  birinchi marta yoqilganda `src/` bo'ylab ko'p natija chiqishi kutiladi, ularni
  tuzatish esa `src/` ga tegishni talab qiladi (bu sessiyada taqiqlangan edi).

---

## CI'da ataylab ishlatilmaydigan testlar

Bular yiqilgan emas — CI muhitida bajarib bo'lmaydi. `scripts/test-hammasi.mjs`
dagi `CHETLATILGAN` ro'yxatida, jadvalda "CI'da ishlatilmadi" deb ko'rsatiladi.

| Skript | Sabab |
|---|---|
| `test:smoke` | `tests/smoke-brauzer.test.ts` — Playwright brauzeri va ishlab turgan Next serverini talab qiladi (`npm run e2e:tayyorla`) |
| `test:postgres` | `tests/postgres.test.ts` — haqiqiy Postgres ulanishi (`PG_TEST_URL`) talab qiladi |
