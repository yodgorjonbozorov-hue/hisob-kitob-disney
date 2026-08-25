-- ---------------------------------------------------------------------------
-- KASSA TOPSHIRISH FARQI — TOPSHIRISH PAYTIDAGI SNAPSHOT.
--
-- Muammo: kassani topshirishda ikkita raqam bor — TIZIM hisoblagan qoldiq va
-- kassir REAL topshirayotgan summa. Ularning farqi (kamomad) nazoratning
-- butun ma'nosi, lekin u hech qayerda saqlanmasdi. Qaror kutayotgan paytda
-- kassaga yangi yozuv tushsa, "hozirgi qoldiq − topshirilgan" hisobi
-- o'zgarib ketardi va direktor tasdiqlayotgan farq kassir ko'rgan farqdan
-- boshqa bo'lardi.
--
-- Yechim: topshirish paytidagi qoldiq va farq AccountTransfer qatoriga
-- muzlatiladi. Ikkalasi ham NULL bo'lishi mumkin — eski yozuvlar va oddiy
-- o'tkazmalar (turi = "transfer") ularsiz avvalgidek ishlaydi.
--
-- YANGI JADVAL YO'Q, mavjud ma'lumot TEGILMAYDI (faqat ADD COLUMN).
-- ---------------------------------------------------------------------------

ALTER TABLE "AccountTransfer" ADD COLUMN "hisoblangan" INTEGER;
ALTER TABLE "AccountTransfer" ADD COLUMN "farq" INTEGER;
