-- ---------------------------------------------------------------------------
-- KATEGORIYA DUBLIKATI — REGISTRGA BEFARQ YAGONALIK.
--
-- Muammo: mavjud `Category_nomi_turi_businessId_key` cheklovi registrga
-- SEZGIR. Ya'ni bitta biznesda "Bantik", "bantik" va "BANTIK" uchta alohida
-- kategoriya bo'lib yashardi. Natijasi jimgina va yomon: bitta xarajat
-- turi hisobotda uch qatorga bo'linib ketardi, budjet faqat bittasini
-- ko'rardi, foydalanuvchi esa "nega jami noto'g'ri" deb tushunolmasdi.
-- Chetlardagi bo'shliq ("Bantik ") ham xuddi shunday ikkilanish berardi.
--
-- Yechim — IFODALI UNIQUE INDEKS: `lower(trim("nomi"))`. Nega ilova
-- darajasidagi tekshiruv yetarli emas: ikki so'rov bir vaqtda kelsa,
-- ikkalasi ham "bunday nom yo'q" deb ko'radi va ikkalasi ham yozadi.
-- Kafolat faqat bazada bo'ladi.
--
-- `turi` indeksda QOLADI: kirimdagi "Reklama" va chiqimdagi "Reklama" —
-- ikki xil narsa va ular konflikt bermasligi kerak (mavjud xatti-harakat).
--
-- SQLite va PostgreSQL ikkalasi ham ifodali indeksni qo'llab-quvvatlaydi
-- (`lower` va `trim` — deterministik/immutable funksiyalar). Postgres yo'li
-- `scripts/pg-migratsiya.mjs` dagi QO'LDA blokiga ham qo'shilgan, chunki
-- Prisma sxemasi ifodali indeksni ifodalay olmaydi.
-- ---------------------------------------------------------------------------

-- HIMOYA: indeksdan OLDIN mavjud registr-dublikatlarini ajratish. Aks holda
-- migratsiya "UNIQUE constraint failed" bilan yarim yo'lda to'xtardi.
--
-- Kategoriyani O'CHIRMAYMIZ va BIRLASHTIRMAYMIZ: har biriga tranzaksiya,
-- budjet, qarz va CRM bitimlari FK bilan bog'langan bo'lishi mumkin —
-- ularning birortasi ham yo'qolmasligi kerak. Shuning uchun har guruhdagi
-- BIRINCHI (id bo'yicha) yozuv nomini saqlaydi, qolganlariga id qo'shimchasi
-- yopishtiriladi. Kategoriya ID o'zgarmaydi, ya'ni barcha bog'lanishlar
-- joyida qoladi — foydalanuvchi keyin ularni qo'lda qayta nomlaydi.
UPDATE "Category"
SET "nomi" = trim("nomi") || ' (' || substr("id", 1, 8) || ')'
WHERE "id" NOT IN (
  SELECT min("id") FROM "Category" GROUP BY "businessId", "turi", lower(trim("nomi"))
);

-- Ko'rinadigan nomlardagi ortiqcha bo'shliqni tozalash. Yuqoridagi guruhlash
-- allaqachon `trim` bo'yicha bo'lgani uchun bu yangi dublikat yaratmaydi.
UPDATE "Category" SET "nomi" = trim("nomi") WHERE "nomi" <> trim("nomi");

CREATE UNIQUE INDEX "Category_businessId_turi_nomi_registrsiz_key"
  ON "Category" ("businessId", "turi", lower(trim("nomi")));
